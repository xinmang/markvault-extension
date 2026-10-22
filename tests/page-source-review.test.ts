import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PageContentExtractor } from '@/content/extractors/PageContentExtractor';

describe('正文来源独立验收', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/current');
    document.head.innerHTML = '<title>当前页面标题</title>';
    document.body.removeAttribute('style');
    document.body.innerHTML = '';
  });

  afterEach(() => document.body.removeAttribute('style'));

  it.each([
    'hidden',
    'aria-hidden="true"',
    'inert',
    'style="display: none"',
    'class="previous-page"',
  ])('隐藏祖先中的旧 main 不得作为正文：%s', (attribute) => {
    document.head.insertAdjacentHTML('beforeend', '<style>.previous-page { display: none; }</style>');
    document.body.innerHTML = `
      <section ${attribute}><main><p>旧页面的过期正文</p></main></section>
      <main><p>当前页面的可见正文</p></main>
    `;
    expect(new PageContentExtractor().extract().description).toBe('当前页面的可见正文');
  });

  it('首个 main 隐藏时优先第二个可见 main，排除站点和侧栏内容', () => {
    document.body.innerHTML = `
      <div>站点通用介绍</div>
      <main hidden><p>隐藏的旧正文</p></main>
      <main><p>当前页面的可见正文</p></main>
      <aside><article><p>侧栏推荐的其他文章</p></article></aside>
    `;
    expect(new PageContentExtractor().extract().description).toBe('当前页面的可见正文');
  });

  it('没有 main 时跳过侧栏和对话框中的 article', () => {
    document.body.innerHTML = `
      <aside><article><p>侧栏文章</p></article></aside>
      <div role="dialog"><article><p>弹窗文章</p></article></div>
      <article><p>当前页面的文章正文</p></article>
    `;
    expect(new PageContentExtractor().extract().description).toBe('当前页面的文章正文');
  });

  it('整个 body 不可见时使用当前标题兜底', () => {
    document.body.style.display = 'none';
    document.body.innerHTML = '<main><p>尚未展示的旧内容</p></main>';
    expect(new PageContentExtractor().extract().description).toBe('当前页面标题');
  });

  it('脚本和样式即使被页面 CSS 显示也不能成为描述', () => {
    document.body.innerHTML = `
      <main>
        <script type="text/plain" style="display: block">脚本中的其他页面数据</script>
        <style style="display: block">.example { color: red; }</style>
        <p>当前页面的可见正文</p>
      </main>
    `;
    expect(new PageContentExtractor().extract().description).toBe('当前页面的可见正文');
  });
});
