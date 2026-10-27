/**
 * 页面内容提取器
 */

import type { PageInfo } from '@/types';
import { safeParseUrl } from './utils';
import { getFallbackDescription, normalizePageText } from '@/lib/utils/page-description';

export class PageContentExtractor {
  /**
   * 不能作为正文读取的区域：导航、页眉页脚、侧栏、对话框等。
   * 选择正文根节点与清理克隆子树共用同一份定义，保证两边原则一致。
   */
  private static readonly CONTENT_EXCLUDE_SELECTOR =
    'script, style, nav, header, footer, aside, iframe, noscript, form, button, ' +
    '[role="navigation"], [role="dialog"], [role="banner"], [role="contentinfo"]';

  /**
   * 明确标记为正文的区域：GitHub 的 README / Issue 正文、文章微数据。
   * 这些页面的 main 里先是文件列表和导航，按 main 读取只能拿到页面框架文字。
   */
  private static readonly READABLE_BODY_SELECTORS = [
    'article.markdown-body',
    '.markdown-body',
    '[itemprop="articleBody"]',
  ];

  /**
   * Extract page information
   */
  extract(): PageInfo {
    const thumbnails = this.getAllThumbnails();
    const title = this.getTitle();
    const content = this.getMainContent();
    const url = window.location.href;
    return {
      title,
      url,
      description: this.getDescription() || getFallbackDescription({ title, url, content }),
      content,
      thumbnail: thumbnails[0] || '',
      thumbnails: thumbnails,
      favicon: this.getFavicon(),
    };
  }

  /**
   * Get page title
   */
  private getTitle(): string {
    return (
      normalizePageText(document.title) ||
      this.getMeta('og:title') ||
      normalizePageText(document.querySelector('h1')?.textContent) ||
      'Untitled'
    );
  }

  /**
   * 优先读取页面专属的分享描述，跳过指向其他页面的过期元数据。
   */
  private getDescription(): string {
    const pageUrl = new URL(window.location.href);
    const references = [
      this.getMeta('og:url'),
      document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ].filter((url): url is string => Boolean(url?.trim()));

    for (const reference of references) {
      try {
        const referenceUrl = new URL(reference, pageUrl);
        const samePath = referenceUrl.pathname.replace(/\/+$/, '') === pageUrl.pathname.replace(/\/+$/, '');
        const sameQuery = !referenceUrl.search || referenceUrl.search === pageUrl.search;
        const sameRoute = !/^#!?\//.test(pageUrl.hash) || referenceUrl.hash === pageUrl.hash;
        if (referenceUrl.origin !== pageUrl.origin || !samePath || !sameQuery || !sameRoute) return '';
      } catch {
        // 无效的来源地址不能证明描述属于当前页面，改用正文兜底。
        return '';
      }
    }

    return (
      this.getMeta('og:description') ||
      this.getMeta('twitter:description') ||
      this.getMeta('description') ||
      ''
    );
  }

  /**
   * Get main content from page
   */
  private getMainContent(): string {
    const contentElement = this.findContentRoot();
    if (!contentElement) {
      // 读不到可信正文时返回空串，交给标题/域名兜底，避免把隐藏全文当描述。
      return '';
    }

    const clone = contentElement.cloneNode(true) as HTMLElement;
    // 仅靠选择器无法排除被 CSS 类隐藏的节点，
    // 这里先按原始 DOM 的可见性剪掉整棵隐藏子树，只改 clone，不动真实页面。
    this.pruneHiddenSubtrees(contentElement, clone);
    clone
      .querySelectorAll(PageContentExtractor.CONTENT_EXCLUDE_SELECTOR)
      .forEach((el) => el.remove());

    // 在块级内容之间保留间隔，避免标题和正文直接粘连。
    clone.querySelectorAll('p, div, section, h1, h2, h3, h4, h5, h6, li, br')
      .forEach((el) => el.append(' '));
    return normalizePageText(clone.textContent).substring(0, 1000);
  }

  /**
   * 查找当前页面的正文根节点。
   * 按明确的正文区域 → main → [role=main] → article 的优先顺序遍历同类全部候选，
   * 跳过隐藏的（含隐藏祖先）以及位于导航、侧栏、对话框等排除区域内的候选；
   * 全部不可用时才退回可见的 body，都不可用则视为无正文。
   */
  private findContentRoot(): HTMLElement | null {
    const selectors = [...PageContentExtractor.READABLE_BODY_SELECTORS, 'main', '[role="main"]', 'article'];

    for (const selector of selectors) {
      for (const candidate of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
        if (candidate.closest(PageContentExtractor.CONTENT_EXCLUDE_SELECTOR)) continue;
        if (!this.isElementVisible(candidate, true)) continue;
        return candidate;
      }
    }

    const body = document.body;
    // body 自身隐藏时整页都不可信，不能再把隐藏全文当成正文。
    if (body && this.isElementVisible(body, true)) return body;
    return null;
  }

  /**
   * 判断元素是否对用户可见。
   * 只依据属性与计算样式，不依赖布局尺寸。
   * checkAncestors 为 true 时连同祖先链一起校验（用于挑选正文根节点）；
   * 剪除子树时父节点已校验过，无需为每个后代重复遍历祖先链。
   */
  private isElementVisible(element: Element, checkAncestors: boolean): boolean {
    if (checkAncestors) {
      for (let node: Element | null = element; node; node = node.parentElement) {
        if (!this.isElementVisible(node, false)) return false;
        // body 已验证，无需再向上检查 html/document，且必须避开自身递归。
        if (node === document.body) break;
      }
      return true;
    }

    if (!(element instanceof HTMLElement)) return true;
    if (element.hidden) return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;
    if (element.hasAttribute('inert')) return false;

    const inlineStyle = element.style;
    if (
      inlineStyle.display === 'none' ||
      inlineStyle.visibility === 'hidden' ||
      inlineStyle.opacity === '0'
    ) {
      return false;
    }

    try {
      const computed = window.getComputedStyle(element);
      if (
        computed.display === 'none' ||
        computed.visibility === 'hidden' ||
        computed.opacity === '0'
      ) {
        return false;
      }
    } catch {
      // 计算样式不可用时只按上面的属性判断，避免抛错影响抽取。
    }
    return true;
  }

  /**
   * 按原始 DOM 的可见性剪除 clone 中对应的隐藏子树。
   * 两侧子元素按同下标对应，结构不一致时停止递归，避免误删内容。
   */
  private pruneHiddenSubtrees(original: Element, clone: Element): void {
    const originalChildren = Array.from(original.children);
    const cloneChildren = Array.from(clone.children);
    if (originalChildren.length !== cloneChildren.length) return;

    for (let index = 0; index < originalChildren.length; index += 1) {
      const originalChild = originalChildren[index];
      const cloneChild = cloneChildren[index];
      if (!this.isElementVisible(originalChild, false)) {
        cloneChild.remove();
        continue;
      }
      this.pruneHiddenSubtrees(originalChild, cloneChild);
    }
  }

  /**
   * Get website favicon/logo
   */
  private getFavicon(): string {
    // 1. Apple Touch Icon
    try {
      const appleTouchIcons = Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]')
      );
      if (appleTouchIcons.length > 0) {
        let largestIcon: HTMLLinkElement | undefined;
        let maxSize = 0;

        for (const icon of appleTouchIcons) {
          if (icon.href) {
            const sizes = icon.getAttribute('sizes');
            if (sizes) {
              const size = parseInt(sizes.split('x')[0]);
              if (!isNaN(size) && size > maxSize) {
                maxSize = size;
                largestIcon = icon;
              }
            } else if (!largestIcon) {
              largestIcon = icon;
            }
          }
        }

        if (largestIcon && largestIcon.href) {
          const url = safeParseUrl(largestIcon.href);
          if (url) return url;
        }
      }
    } catch (e) {
      // Silently handle error
    }

    // 2. Standard icon
    try {
      const iconLinks = Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[rel*="icon"]')
      );
      if (iconLinks.length > 0) {
        let bestIcon: HTMLLinkElement | undefined;
        let maxSize = 0;

        for (const icon of iconLinks) {
          if (icon.href) {
            const type = icon.getAttribute('type') || '';
            const sizes = icon.getAttribute('sizes');
            const href = icon.href.toLowerCase();

            if (type.includes('svg') || href.endsWith('.svg')) {
              bestIcon = icon;
              break;
            }

            if (type.includes('png') || href.endsWith('.png')) {
              if (sizes) {
                const size = parseInt(sizes.split('x')[0]);
                if (!isNaN(size) && size > maxSize) {
                  maxSize = size;
                  bestIcon = icon;
                }
              } else if (!bestIcon || maxSize === 0) {
                bestIcon = icon;
              }
            }

            if (!bestIcon) {
              bestIcon = icon;
            }
          }
        }

        if (bestIcon && bestIcon.href) {
          const url = safeParseUrl(bestIcon.href);
          if (url) return url;
        }
      }
    } catch (e) {
      // Silently handle error
    }

    // 3. Chrome favicon API
    try {
      const domain = window.location.origin;
      return `chrome://favicon/size/64@2x/${domain}`;
    } catch (e) {
      // Silently handle error
    }

    // 4. Fallback to favicon.ico
    try {
      return new URL('/favicon.ico', window.location.origin).href;
    } catch (e) {
      // Silently handle error
    }

    return '';
  }

  /**
   * Get all possible page thumbnails/cover images
   */
  private getAllThumbnails(): string[] {
    const thumbnails: string[] = [];

    // 1. Open Graph image
    try {
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage instanceof HTMLMetaElement && ogImage.content) {
        const url = safeParseUrl(ogImage.content);
        if (url && !thumbnails.includes(url)) {
          thumbnails.push(url);
        }
      }
    } catch (e) {
      // Silently handle error
    }

    // 2. Twitter image
    try {
      const twitterImage = document.querySelector('meta[name="twitter:image"]');
      if (twitterImage instanceof HTMLMetaElement && twitterImage.content) {
        const url = safeParseUrl(twitterImage.content);
        if (url && !thumbnails.includes(url)) {
          thumbnails.push(url);
        }
      }
    } catch (e) {
      // Silently handle error
    }

    // 3. Large images in page
    try {
      const searchAreas = [
        document.querySelector('main'),
        document.querySelector('[role="main"]'),
        document.querySelector('article'),
        document.body,
      ].filter(Boolean) as HTMLElement[];

      const foundImages: Array<{ url: string; area: number }> = [];

      for (const area of searchAreas) {
        if (!area) continue;
        const images = area.querySelectorAll('img');

        for (const img of images) {
          try {
            if (!img.src) continue;
            if (img.src.startsWith('data:') || img.src.startsWith('blob:')) continue;

            let width = img.naturalWidth;
            let height = img.naturalHeight;

            if (width === 0 || height === 0) {
              const attrWidth = img.getAttribute('width');
              const attrHeight = img.getAttribute('height');

              if (attrWidth && attrHeight) {
                const parsedWidth = parseInt(attrWidth);
                const parsedHeight = parseInt(attrHeight);
                if (!isNaN(parsedWidth) && !isNaN(parsedHeight)) {
                  width = parsedWidth;
                  height = parsedHeight;
                }
              }

              if (width === 0 || height === 0) {
                width = img.width || img.offsetWidth || img.clientWidth;
                height = img.height || img.offsetHeight || img.clientHeight;
              }
            }

            if (width > 200 && height > 200 && width < 5000 && height < 5000) {
              const url = safeParseUrl(img.src);
              if (url && !foundImages.some((item) => item.url === url)) {
                foundImages.push({ url, area: width * height });
              }
            }
          } catch (imgError) {
            continue;
          }
        }
      }

      foundImages.sort((a, b) => b.area - a.area);
      const topImages = foundImages.slice(0, 5);

      for (const { url } of topImages) {
        if (!thumbnails.includes(url)) {
          thumbnails.push(url);
        }
      }
    } catch (e) {
      // Silently handle error
    }

    return thumbnails;
  }

  /**
   * Get meta tag content
   */
  private getMeta(name: string): string {
    const metas = document.querySelectorAll('meta[name], meta[property]');
    for (const meta of metas) {
      const matchesName = [meta.getAttribute('name'), meta.getAttribute('property')]
        .some((value) => value?.trim().toLowerCase() === name.toLowerCase());
      if (!matchesName) continue;
      const content = normalizePageText(meta.getAttribute('content'));
      if (content) return content;
    }
    return '';
  }
}
