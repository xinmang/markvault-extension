import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareCaptureTab } from '@/background/services/page-capture';
import { capturePageSnapshotV2 } from '@/lib/services/snapshot-service';
import { capturePageV2 } from '@/content/singlefile-capture-v2';

const sendMessage = vi.fn();
const executeScript = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('chrome', {
    tabs: { sendMessage },
    scripting: { executeScript },
    runtime: { getManifest: () => ({ content_scripts: [{ js: ['content.js'] }] }) },
  });
  sendMessage.mockReset();
  executeScript.mockReset();
  document.documentElement.innerHTML = '<head></head><body></body>';
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('快照消息通道', () => {
  it('旧标签页缺少内容脚本时注入一次并确认主框架可响应', async () => {
    sendMessage.mockRejectedValueOnce(new Error('Receiving end does not exist'));
    sendMessage.mockResolvedValueOnce({ success: true, data: 'pong' });
    await expect(prepareCaptureTab(42)).resolves.toBe(42);
    expect(executeScript).toHaveBeenCalledExactlyOnceWith({ target: { tabId: 42, frameIds: [0] }, files: ['content.js'] });
    expect(sendMessage).toHaveBeenCalledWith(42, { type: 'PING' }, { frameId: 0 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('只向来源标签页的主框架捕获，完成后清除超时计时器', async () => {
    const data = { html: '<html>正文</html>', images: [] };
    sendMessage.mockResolvedValue({ success: true, data });
    await expect(capturePageSnapshotV2(42)).resolves.toEqual(data);
    expect(sendMessage).toHaveBeenCalledWith(42, expect.objectContaining({ type: 'CAPTURE_PAGE_V2' }), { frameId: 0 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('内容脚本失去响应时返回快照错误，而不是永久等待', async () => {
    sendMessage.mockReturnValue(new Promise(() => {}));
    const work = capturePageSnapshotV2(42);
    const assertion = expect(work).rejects.toThrow('网页捕获超时');
    await vi.advanceTimersByTimeAsync(35000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('快照资源预算', () => {
  it('CSS 与图片共享截止时间，慢资源不会阻止正文快照返回', async () => {
    document.documentElement.innerHTML = '<head><link rel="stylesheet" href="https://example.com/a.css"><link rel="stylesheet" href="https://example.com/b.css"></head><body><h1>文章正文</h1><img src="https://example.com/slow.png"><script>敏感脚本()</script></body>';
    const signals: AbortSignal[] = [];
    const fetch = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = options.signal!;
      signals.push(signal);
      signal.addEventListener('abort', () => reject(new Error('资源超时')), { once: true });
    }));
    vi.stubGlobal('fetch', fetch);
    const work = capturePageV2({ timeout: 12000 });
    await vi.advanceTimersByTimeAsync(12000);
    const result = await work;
    expect(result.html).toContain('文章正文');
    expect(result.html).toContain('https://example.com/slow.png');
    expect(result.html).not.toContain('<script');
    expect(result.images).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('超过图片大小限制时保留原地址和 HTML', async () => {
    document.body.innerHTML = '<p>正文</p><img src="https://example.com/large.png">';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['large-image']) }));
    const result = await capturePageV2({ maxImageSize: 4 });
    expect(result.html).toContain('https://example.com/large.png');
    expect(result.images).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
