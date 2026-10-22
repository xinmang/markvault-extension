import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleExtractPageInfo } from '@/background/handlers/page-info';

const query = vi.fn();
const get = vi.fn();
const sendMessage = vi.fn();
const executeScript = vi.fn();
const currentTab = { id: 8, url: 'https://example.com/current', title: '当前页面' };
const currentPage = { url: currentTab.url, title: currentTab.title, description: '当前描述' };
const message = { type: 'EXTRACT_PAGE_INFO' as const };

beforeEach(() => {
  query.mockReset().mockResolvedValue([currentTab]);
  get.mockReset().mockResolvedValue(currentTab);
  sendMessage.mockReset();
  executeScript.mockReset();
  vi.stubGlobal('chrome', {
    tabs: { query, get, sendMessage },
    scripting: { executeScript },
    runtime: { getManifest: () => ({ content_scripts: [{ js: ['content.js'] }] }) },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('后台页面信息来源校验', () => {
  it('提取消息只发送给主框架', async () => {
    sendMessage.mockResolvedValueOnce({ success: true, data: 'pong' }).mockResolvedValueOnce({ success: true, data: currentPage });
    const response = await handleExtractPageInfo(message);
    expect(response.data).toEqual(currentPage);
    expect(sendMessage).toHaveBeenLastCalledWith(currentTab.id, message, { frameId: 0 });
  });

  it('收到跳转前的页面信息时重新提取', async () => {
    sendMessage.mockResolvedValueOnce({ success: true, data: 'pong' })
      .mockResolvedValueOnce({ success: true, data: { ...currentPage, url: 'https://example.com/old', description: '旧描述' } })
      .mockResolvedValueOnce({ success: true, data: currentPage });
    expect((await handleExtractPageInfo(message)).data).toEqual(currentPage);
    expect(sendMessage).toHaveBeenCalledTimes(3);
  });

  it('反复返回其他页面时只用当前标签页标题兜底', async () => {
    sendMessage.mockResolvedValueOnce({ success: true, data: 'pong' })
      .mockResolvedValue({ success: true, data: { ...currentPage, url: 'https://example.com/old', description: '旧描述' } });
    expect((await handleExtractPageInfo(message)).data).toMatchObject({ url: currentTab.url, description: '当前页面' });
    expect(sendMessage).toHaveBeenCalledTimes(3);
  });

  it('抓取到空描述时使用同页正文', async () => {
    sendMessage.mockResolvedValueOnce({ success: true, data: 'pong' })
      .mockResolvedValueOnce({ success: true, data: { ...currentPage, description: '', content: '当前正文' } });
    expect((await handleExtractPageInfo(message)).data).toMatchObject({ description: '当前正文' });
  });

  it('无法注入脚本时描述仍对应当前标题', async () => {
    sendMessage.mockRejectedValueOnce(new Error('无法连接'));
    executeScript.mockRejectedValueOnce(new Error('禁止注入'));
    expect((await handleExtractPageInfo(message)).data).toMatchObject({ url: currentTab.url, description: '当前页面' });
  });

  it('浏览器内部页面使用自身标题且不注入脚本', async () => {
    query.mockResolvedValueOnce([{ id: 8, url: 'chrome://settings/', title: '浏览器设置' }]);
    expect((await handleExtractPageInfo(message)).data).toMatchObject({ url: 'chrome://settings/', description: '浏览器设置' });
    expect(executeScript).not.toHaveBeenCalled();
  });
});
