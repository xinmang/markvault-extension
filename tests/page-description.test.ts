import { beforeEach, describe, expect, it } from 'vitest';
import { PageContentExtractor } from '@/content/extractors/PageContentExtractor';
import { getFallbackDescription, isSamePageUrl, normalizePageText } from '@/lib/utils/page-description';
import { normalizeTranslatedText } from '@/lib/utils/text';

describe('当前网页描述提取', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/current');
    document.head.innerHTML = '<title>当前页面标题</title>';
    document.body.innerHTML = '<main><p>当前页面的真实正文，用来介绍这篇文章。</p></main>';
  });

  const extract = () => new PageContentExtractor().extract();

  it('没有 meta 时从当前正文生成描述', () => {
    expect(extract().description).toBe('当前页面的真实正文，用来介绍这篇文章。');
  });

  it('空白和无效占位 meta 不会阻止使用有效描述', () => {
    document.head.insertAdjacentHTML('beforeend', `
      <meta property="og:description" content="   ">
      <meta name="twitter:description" content="undefined">
      <meta name="description" content=" 当前页面的\n 简介 ">
    `);
    expect(extract().description).toBe('当前页面的 简介');
  });

  it('优先使用页面专属的分享描述而非通用站点介绍', () => {
    document.head.insertAdjacentHTML('beforeend', `
      <meta name="description" content="通用网站介绍">
      <meta property="og:description" content="当前文章的专属介绍">
    `);
    expect(extract().description).toBe('当前文章的专属介绍');
  });

  it('兼容大小写和重复的空 meta', () => {
    document.head.insertAdjacentHTML('beforeend', `
      <meta name="DESCRIPTION" content=" ">
      <meta name="Description" content="有效介绍">
    `);
    expect(extract().description).toBe('有效介绍');
  });

  it.each([
    '<meta property="og:url" content="https://example.com/previous">',
    '<link rel="canonical" href="/previous">',
    '<meta property="og:url" content="https://another.example/current">',
  ])('元数据指向其他页面时使用当前正文：%s', (reference) => {
    document.head.insertAdjacentHTML('beforeend', `${reference}<meta name="description" content="其他页面的过期介绍">`);
    expect(extract().description).toBe('当前页面的真实正文，用来介绍这篇文章。');
  });

  it('hash 路由改变后不采用旧路由的描述', () => {
    window.history.replaceState({}, '', '/current#/second');
    document.head.insertAdjacentHTML('beforeend', `
      <meta property="og:url" content="https://example.com/current#/first">
      <meta property="og:description" content="第一篇文章的介绍">
    `);
    expect(extract().description).toContain('当前页面的真实正文');
  });

  it('规范地址省略跟踪参数时仍可采用本页描述', () => {
    window.history.replaceState({}, '', '/current?utm_source=test#section');
    document.head.insertAdjacentHTML('beforeend', '<link rel="canonical" href="/current"><meta name="description" content="本页简介">');
    expect(extract().description).toBe('本页简介');
  });

  it('正文兜底排除导航、对话框、隐藏文字和其他区域的文章', () => {
    document.body.innerHTML = `
      <aside><article>不相关的推荐文章</article></aside>
      <main>
        <nav>登录 帮助</nav><div role="dialog">接受 Cookie</div>
        <div hidden>隐藏文字</div><div aria-hidden="true">另一段隐藏文字</div>
        <div style="display: none">隐藏的旧页面</div>
        <h1>当前文章</h1><p>当前正文</p><footer>版权信息</footer>
      </main>
    `;
    expect(extract().description).toBe('当前文章 当前正文');
  });

  it(`靠前的 main 被隐藏时改用可见主体，不抽取旧页面文字`, () => {
    document.body.innerHTML = `
      <main hidden><p>隐藏的旧页面正文</p></main>
      <main><h1>当前文章</h1><p>当前可见正文</p></main>
    `;
    expect(extract().description).toBe(`当前文章 当前可见正文`);
  });

  it(`被 CSS 类隐藏的根元素不会被当作当前正文`, () => {
    document.head.insertAdjacentHTML(`beforeend`, `<style>.mv-hidden-root { display: none; }</style>`);
    document.body.innerHTML = `
      <main class=mv-hidden-root><p>隐藏的旧页面正文</p></main>
      <article><p>当前可见文章</p></article>
    `;
    expect(extract().description).toBe(`当前可见文章`);
  });

  it(`可见主体内被 CSS 类隐藏的子树不会混入描述`, () => {
    document.head.insertAdjacentHTML(`beforeend`, `<style>.mv-hidden-sub { display: none; }</style>`);
    document.body.innerHTML = `
      <main>
        <div class=mv-hidden-sub>侧栏推荐的旧内容</div>
        <p>当前可见正文</p>
      </main>
    `;
    expect(extract().description).toBe(`当前可见正文`);
  });

  it('没有正文时以当前标题兜底', () => {
    document.body.innerHTML = '<script>不应作为正文</script>';
    expect(extract().description).toBe('当前页面标题');
  });

  it('标题也不可用时使用当前域名', () => {
    document.title = '';
    document.body.innerHTML = '';
    expect(extract().description).toBe('example.com');
  });

  it('较长正文只生成有限长度的摘要', () => {
    expect(getFallbackDescription({ title: '标题', url: 'https://example.com', content: '正文'.repeat(500) })).toHaveLength(301);
  });
});

describe('描述归一化与页面身份', () => {
  it.each(['  ', '\u200B', 'null', 'undefined', 'N/A', '暂无描述', '无'])('忽略无效描述 %s', (value) => {
    expect(normalizePageText(value)).toBe('');
    expect(normalizeTranslatedText(value)).toBeUndefined();
  });

  it('页面身份区分查询参数和 hash 路由', () => {
    expect(isSamePageUrl('https://example.com', 'https://example.com/')).toBe(true);
    expect(isSamePageUrl('https://example.com/?id=1', 'https://example.com/?id=2')).toBe(false);
    expect(isSamePageUrl('https://example.com/#/a', 'https://example.com/#/b')).toBe(false);
  });
});
