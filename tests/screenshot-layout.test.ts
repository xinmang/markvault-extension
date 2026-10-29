import { describe, expect, it, vi } from 'vitest';
import { truncateBlocks, formatPublishedAt, formatSourceUrl, waitForImages } from '@/offscreen/render-card';
import { upgradeXImageUrl, upgradeXAvatarUrl } from '@/content/screenshot/x';
import { upgradeDiscourseAvatarUrl, parseDiscoursePostNumber } from '@/content/screenshot/discourse';
import type { ScreenshotBlock } from '@/types/screenshot';

const paragraph = (text: string): ScreenshotBlock => ({
  type: 'paragraph',
  inlines: [{ type: 'text', text }],
});

const image = (src: string): ScreenshotBlock => ({ type: 'image', src });

describe('truncateBlocks', () => {
  it('按段落边界截断并标记 truncated', () => {
    const blocks = [paragraph('a'.repeat(50)), paragraph('b'.repeat(50)), paragraph('c'.repeat(50))];
    const result = truncateBlocks(blocks, 120, 10);

    expect(result.blocks).toHaveLength(2);
    expect(result.truncated).toBe(true);
  });

  it('总长度未超限时不做截断', () => {
    const blocks = [paragraph('hello'), paragraph('world')];
    const result = truncateBlocks(blocks, 100, 10);

    expect(result.blocks).toHaveLength(2);
    expect(result.truncated).toBe(false);
  });

  it('至少保留第一个文本块，即便它本身就超长', () => {
    const blocks = [paragraph('x'.repeat(500)), paragraph('y')];
    const result = truncateBlocks(blocks, 10, 10);

    expect(result.blocks).toHaveLength(1);
    expect(result.truncated).toBe(true);
  });

  it('限制图片数量并为超出的图片设置 truncated', () => {
    const blocks = [paragraph('text'), image('https://a/1.png'), image('https://a/2.png'), image('https://a/3.png')];
    const result = truncateBlocks(blocks, 100, 2);

    expect(result.blocks.filter((block) => block.type === 'image')).toHaveLength(2);
    expect(result.truncated).toBe(true);
  });

  it('图片未超过上限时不标记 truncated', () => {
    const blocks = [paragraph('text'), image('https://a/1.png')];
    const result = truncateBlocks(blocks, 100, 4);

    expect(result.truncated).toBe(false);
  });

  it('列表按列表项边界截断', () => {
    const blocks: ScreenshotBlock[] = [
      {
        type: 'list',
        ordered: false,
        items: [
          [{ type: 'text', text: 'item one' }],
          [{ type: 'text', text: 'item two' }],
          [{ type: 'text', text: 'item three' }],
        ],
      },
    ];
    const result = truncateBlocks(blocks, 20, 4);
    const list = result.blocks[0];

    expect(list.type).toBe('list');
    if (list.type === 'list') expect(list.items).toHaveLength(2);
    expect(result.truncated).toBe(true);
  });
});

describe('formatPublishedAt', () => {
  it('格式化 ISO 时间', () => {
    const text = formatPublishedAt('2024-05-01T10:20:30.000Z', 'en-US');
    expect(text).toContain('2024');
    expect(text.length).toBeGreaterThan(4);
  });

  it('无效或缺失时间返回空字符串', () => {
    expect(formatPublishedAt(undefined, 'zh-CN')).toBe('');
    expect(formatPublishedAt('not-a-date', 'zh-CN')).toBe('');
  });

  it('未知 locale 时回退到 ISO 日期', () => {
    const text = formatPublishedAt('2024-05-01T10:20:30.000Z', 'definitely-not-a-locale');
    expect(text).toBe('2024-05-01');
  });
});

describe('formatSourceUrl', () => {
  it('去掉协议与查询串', () => {
    expect(formatSourceUrl('https://example.com/blog/post?utm=1#hash')).toBe('example.com/blog/post');
  });

  it('超长地址省略中段', () => {
    const url = `https://example.com/${'a'.repeat(120)}`;
    const text = formatSourceUrl(url, 60);
    expect(text.length).toBeLessThanOrEqual(60);
    expect(text).toContain('…');
  });
});

describe('URL 升级 helper', () => {
  it('X 图片升级 name=large 并保留其他参数', () => {
    expect(upgradeXImageUrl('https://pbs.twimg.com/media/ABC?format=jpg&name=small')).toBe(
      'https://pbs.twimg.com/media/ABC?format=jpg&name=large'
    );
    expect(upgradeXImageUrl('https://pbs.twimg.com/media/ABC?format=jpg')).toBe(
      'https://pbs.twimg.com/media/ABC?format=jpg&name=large'
    );
  });

  it('不修改非 pbs.twimg.com 的地址', () => {
    const url = 'https://example.com/photo.jpg?name=small';
    expect(upgradeXImageUrl(url)).toBe(url);
  });

  it('X 头像 _normal 升级为 _400x400', () => {
    expect(upgradeXAvatarUrl('https://pbs.twimg.com/profile_images/1/abc_normal.jpg')).toBe(
      'https://pbs.twimg.com/profile_images/1/abc_400x400.jpg'
    );
  });

  it('Discourse 头像尺寸段升级为 /144/', () => {
    expect(
      upgradeDiscourseAvatarUrl('https://linux.do/user_avatar/linux.do/alice/96/123_2.png')
    ).toBe('https://linux.do/user_avatar/linux.do/alice/144/123_2.png');
  });

  it('解析 Discourse 楼层号', () => {
    expect(parseDiscoursePostNumber('https://linux.do/t/slug/123')).toBe(1);
    expect(parseDiscoursePostNumber('https://linux.do/t/slug/123/2')).toBe(2);
    expect(parseDiscoursePostNumber('https://linux.do/t/slug/123/42')).toBe(42);
  });
});

describe('waitForImages', () => {
  // 离屏文档从不绘制，img.decode() 永远不会完成；等待必须只依赖 load / error 与超时
  const pendingImage = () => {
    const img = document.createElement('img');
    Object.defineProperty(img, 'complete', { value: false });
    img.decode = () => new Promise<void>(() => {});
    return img;
  };

  it('decode() 不会完成时按 load 事件结束等待', async () => {
    const root = document.createElement('div');
    const img = pendingImage();
    root.appendChild(img);

    const waiting = waitForImages(root, 60_000);
    img.dispatchEvent(new Event('load'));
    await expect(waiting).resolves.toBeUndefined();
  });

  it('图片既不加载也不报错时按超时结束', async () => {
    vi.useFakeTimers();
    try {
      const root = document.createElement('div');
      root.append(pendingImage(), pendingImage());

      let settled = false;
      const waiting = waitForImages(root, 3000).then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(2999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await waiting;
      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
