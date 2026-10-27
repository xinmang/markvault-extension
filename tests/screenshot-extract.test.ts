import { describe, expect, it } from 'vitest';
import { extractScreenshotContent } from '@/content/screenshot';
import type { ScreenshotBlock } from '@/types/screenshot';

function docFrom(html: string): Document {
  const doc = document.implementation.createHTMLDocument('fixture');
  doc.documentElement.innerHTML = html;
  return doc;
}

function textOfBlock(block: ScreenshotBlock): string {
  if (block.type === 'paragraph' || block.type === 'quote') {
    return block.inlines
      .map((inline) => {
        if (inline.type === 'text') return inline.text;
        if (inline.type === 'emoji') return inline.alt;
        return '\n';
      })
      .join('');
  }
  if (block.type === 'heading' || block.type === 'code') return block.text;
  if (block.type === 'list') {
    return block.items
      .map((item) =>
        item
          .map((inline) => {
            if (inline.type === 'text') return inline.text;
            if (inline.type === 'emoji') return inline.alt;
            return '\n';
          })
          .join('')
      )
      .join('\n');
  }
  return '';
}

describe('X 状态页提取', () => {
  const fixture = `
    <html><head><title>Some tweet / X</title></head><body>
      <article data-testid="tweet">
        <div data-testid="User-Name">
          <a href="/alice"><span>Alice Chen</span></a>
          <a href="/alice"><span>@alice_chen</span></a>
          <a href="/alice/status/1234567890"><time datetime="2024-05-01T10:20:30.000Z">May 1</time></a>
        </div>
        <img src="https://pbs.twimg.com/profile_images/111/avatar_normal.jpg" />
        <div data-testid="tweetText">Hello <strong>world</strong> <img alt="😀" src="https://abs.twimg.com/emoji/v2/72x72/1f600.png" /><br />second line</div>
        <div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/AAA?format=jpg&amp;name=small" /></div>
        <div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/BBB?format=jpg" /></div>
        <div role="link">
          <div data-testid="User-Name"><span>Bob Lee</span><span>@bob</span></div>
          <div data-testid="tweetText">Quoted tweet body</div>
          <div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/QUOTED?format=jpg" /></div>
        </div>
      </article>
      <article data-testid="tweet">
        <div data-testid="tweetText">First reply, should never appear</div>
        <div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/REPLY1?format=jpg" /></div>
      </article>
      <article data-testid="tweet">
        <div data-testid="tweetText">Second reply, should never appear</div>
      </article>
    </body></html>
  `;

  it('只取焦点推文、引用推文合并为一个 quote block', () => {
    const doc = docFrom(fixture);
    const content = extractScreenshotContent(doc, 'https://x.com/alice/status/1234567890');

    expect(content).not.toBeNull();
    if (!content) return;

    expect(content.site).toBe('x');
    expect(content.siteName).toBe('X');
    expect(content.title).toBeUndefined();

    expect(content.author?.name).toBe('Alice Chen');
    expect(content.author?.handle).toBe('@alice_chen');
    expect(content.author?.avatarUrl).toBe(
      'https://pbs.twimg.com/profile_images/111/avatar_400x400.jpg'
    );
    expect(content.publishedAt).toBe('2024-05-01T10:20:30.000Z');

    const allText = content.blocks.map(textOfBlock).join('\n');
    expect(allText).toContain('Hello world 😀');
    expect(allText).not.toContain('First reply');
    expect(allText).not.toContain('Second reply');

    const quotes = content.blocks.filter((block) => block.type === 'quote');
    expect(quotes).toHaveLength(1);
    expect(textOfBlock(quotes[0])).toContain('Quoted tweet body');

    const images = content.blocks.filter(
      (block): block is Extract<ScreenshotBlock, { type: 'image' }> => block.type === 'image'
    );
    expect(images.map((image) => image.src)).toEqual([
      'https://pbs.twimg.com/media/AAA?format=jpg&name=large',
      'https://pbs.twimg.com/media/BBB?format=jpg&name=large',
    ]);
    expect(images.some((image) => image.src.includes('QUOTED'))).toBe(false);
    expect(images.some((image) => image.src.includes('REPLY1'))).toBe(false);
  });

  it('视频封面按图片输出，重复图片只保留一张', () => {
    const doc = docFrom(`
      <html><body>
        <article data-testid="tweet">
          <div data-testid="User-Name">
            <a href="/alice"><span>Alice</span></a>
            <a href="/alice/status/42"><time datetime="2024-01-01T00:00:00.000Z"></time></a>
          </div>
          <div data-testid="tweetText">video tweet</div>
          <div data-testid="tweetPhoto"><video poster="https://pbs.twimg.com/media/POSTER.jpg"></video></div>
          <div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/POSTER.jpg" /></div>
        </article>
      </body></html>
    `);
    const content = extractScreenshotContent(doc, 'https://x.com/alice/status/42');
    const images = (content?.blocks ?? []).filter(
      (block): block is Extract<ScreenshotBlock, { type: 'image' }> => block.type === 'image'
    );
    expect(images).toHaveLength(1);
    expect(images[0].src).toBe('https://pbs.twimg.com/media/POSTER.jpg?name=large');
  });

  it('没有 status id 时回退到第一条 article', () => {
    const doc = docFrom(fixture);
    const content = extractScreenshotContent(doc, 'https://twitter.com/home');
    expect(content?.author?.handle).toBe('@alice_chen');
  });
});

describe('Discourse 主题页提取', () => {
  const fixture = `
    <html>
      <head>
        <meta name="generator" content="Discourse 3.2.0" />
        <meta property="og:site_name" content="linux.do" />
        <meta property="og:title" content="OG Fallback Title" />
      </head>
      <body>
        <h1><span class="fancy-title">如何理解 Discourse 的卡片渲染</span></h1>
        <div class="topic-avatar"><img class="avatar" src="https://linux.do/user_avatar/linux.do/alice/96/123_2.png" /></div>

        <article id="post_1" data-post-number="1">
          <div class="topic-avatar"><img class="avatar" src="https://linux.do/user_avatar/linux.do/alice/96/123_2.png" /></div>
          <div class="names"><span class="full-name">Alice</span><span class="username">alice</span></div>
          <div class="post-date"><span data-time="1714557600000"></span></div>
          <div class="cooked">
            <p>第一段正文，包含一个表情 <img class="emoji" src="/images/emoji/smile.png" alt=":smile:" /></p>
            <pre><code>const a = 1;</code></pre>
            <p>
              <span class="lightbox-wrapper">
                <img src="https://linux.do/uploads/default/original/2X/a/abc.jpeg" width="800" height="600" alt="截图" />
                <span class="meta">图片说明 <span class="filename">abc.jpeg</span></span>
              </span>
            </p>
            <aside class="quote">
              <div class="quote-title">引用：</div>
              <blockquote><p>被引用的内容</p></blockquote>
            </aside>
            <p>剧透：<span class="spoiler">秘密答案</span> 结束</p>
            <ul><li>列表项一</li><li>列表项二</li></ul>
            <h2>小标题</h2>
          </div>
        </article>

        <article id="post_2" data-post-number="2">
          <div class="names"><span class="username">bob</span></div>
          <div class="cooked"><p>这是二楼的回复，不应出现在一楼卡片里</p></div>
        </article>
      </body>
    </html>
  `;

  it('只渲染目标楼层并跳过剧透、caption、引用结构', () => {
    const doc = docFrom(fixture);
    const content = extractScreenshotContent(doc, 'https://linux.do/t/slug/123');

    expect(content).not.toBeNull();
    if (!content) return;

    expect(content.site).toBe('discourse');
    expect(content.siteName).toBe('LINUX DO');
    expect(content.title).toBe('如何理解 Discourse 的卡片渲染');
    expect(content.author?.name).toBe('Alice');
    expect(content.author?.handle).toBe('alice');
    expect(content.author?.avatarUrl).toBe(
      'https://linux.do/user_avatar/linux.do/alice/144/123_2.png'
    );
    expect(content.publishedAt).toBe('2024-05-01T10:00:00.000Z');

    const allText = content.blocks.map(textOfBlock).join('\n');
    expect(allText).toContain('第一段正文');
    expect(allText).not.toContain('这是二楼的回复');
    expect(allText).not.toContain('图片说明');
    expect(allText).toContain('（剧透内容已隐藏）');
    expect(allText).not.toContain('秘密答案');
    expect(allText).toContain('被引用的内容');

    expect(content.blocks.some((block) => block.type === 'code' && block.text.includes('const a = 1'))).toBe(true);
    expect(content.blocks.some((block) => block.type === 'heading' && block.text === '小标题')).toBe(true);

    const list = content.blocks.find((block) => block.type === 'list');
    expect(list).toBeDefined();
    if (list?.type === 'list') expect(list.items).toHaveLength(2);

    const emoji = content.blocks.find(
      (block) => block.type === 'paragraph' && block.inlines.some((inline) => inline.type === 'emoji')
    );
    expect(emoji).toBeDefined();

    const images = content.blocks.filter(
      (block): block is Extract<ScreenshotBlock, { type: 'image' }> => block.type === 'image'
    );
    expect(images).toHaveLength(1);
    expect(images[0].src).toBe('https://linux.do/uploads/default/original/2X/a/abc.jpeg');
  });

  it('/t/slug/123/2 选中二楼', () => {
    const doc = docFrom(fixture);
    const content = extractScreenshotContent(doc, 'https://linux.do/t/slug/123/2');

    expect(content).not.toBeNull();
    if (!content) return;

    const allText = content.blocks.map(textOfBlock).join('\n');
    expect(allText).toContain('这是二楼的回复');
    expect(allText).not.toContain('第一段正文');
    expect(content.author?.handle).toBe('bob');
  });
});

describe('通用网页提取', () => {
  it('排除评论与侧边栏，保留标题/作者/时间', () => {
    const doc = docFrom(`
      <html>
        <head>
          <title>Fallback document title</title>
          <meta property="og:title" content="一场关于渲染的讨论" />
          <meta property="og:site_name" content="Example Blog" />
          <meta name="author" content="Zhang San" />
          <meta property="article:published_time" content="2024-03-04T05:06:07.000Z" />
        </head>
        <body>
          <nav><a href="/">首页</a></nav>
          <article>
            <h1>一场关于渲染的讨论</h1>
            <p>这是文章的正文段落，足够长以满足最小长度限制，并且包含一些链接和 <strong>重点</strong>。</p>
            <p>第二段继续补充说明，让提取器能识别到有效内容。</p>
            <img src="https://example.com/cover.jpg" width="800" height="450" alt="封面" />
          </article>
          <section class="comments">
            <p>评论区里说的话，绝不应该出现在卡片中。</p>
          </section>
          <aside class="sidebar">
            <p>侧边栏推荐内容，也不应该出现。</p>
          </aside>
          <footer>版权所有</footer>
        </body>
      </html>
    `);

    const content = extractScreenshotContent(doc, 'https://example.com/blog/post');
    expect(content).not.toBeNull();
    if (!content) return;

    expect(content.site).toBe('generic');
    expect(content.siteName).toBe('Example Blog');
    expect(content.title).toBe('一场关于渲染的讨论');
    expect(content.author?.name).toBe('Zhang San');
    expect(content.publishedAt).toBe('2024-03-04T05:06:07.000Z');

    const allText = content.blocks.map(textOfBlock).join('\n');
    expect(allText).toContain('这是文章的正文段落');
    expect(allText).not.toContain('评论区里说的话');
    expect(allText).not.toContain('侧边栏推荐内容');
    expect(allText).not.toContain('版权所有');

    expect(content.blocks.some((block) => block.type === 'image')).toBe(true);
  });

  it('保留换行与行内格式，跳过导航/页脚/表单', () => {
    const doc = docFrom(`
      <html><head><title>Formatting</title></head><body>
        <main>
          <h2>Section</h2>
          <p>Line one<br />line <b>two</b> with <a href="/x">link</a> and <code>code</code>.</p>
          <form><p>搜索框里的文字不应该出现，因为它位于表单元素内部。</p></form>
          <p>补充一段足够长的正文内容，确保提取器认为页面有实质内容。</p>
        </main>
      </body></html>
    `);
    const content = extractScreenshotContent(doc, 'https://example.com/fmt');
    expect(content).not.toBeNull();
    if (!content) return;

    const first = content.blocks.find((block) => block.type === 'paragraph');
    expect(first?.type).toBe('paragraph');
    if (first?.type !== 'paragraph') return;

    expect(first.inlines.some((inline) => inline.type === 'break')).toBe(true);
    expect(first.inlines.some((inline) => inline.type === 'text' && inline.bold)).toBe(true);
    expect(first.inlines.some((inline) => inline.type === 'text' && inline.link)).toBe(true);
    expect(first.inlines.some((inline) => inline.type === 'text' && inline.code)).toBe(true);

    const allText = content.blocks.map(textOfBlock).join('\n');
    expect(allText).not.toContain('搜索框里的文字');
  });

  it('几乎空白页面返回 null', () => {
    const doc = docFrom('<html><body><div>短</div></body></html>');
    expect(extractScreenshotContent(doc, 'https://example.com/empty')).toBeNull();
  });
});
