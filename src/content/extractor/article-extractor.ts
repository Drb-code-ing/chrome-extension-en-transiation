/**
 * 文章提取器：编排完整提取链路。
 * 流程：深克隆 DOM -> 规范化(懒加载/绝对地址) -> Readability 提取 -> 元数据补充
 *       -> 正文兜底 -> Turndown 转 Markdown。
 * 所有异常统一映射为结构化 ExtractError，供消息边界透传。
 */
import { Readability } from '@mozilla/readability';
import { resolveArticleMetadata } from '../meta/article-meta.ts';
import { normalizeDocument } from './document-normalizer.ts';
import { htmlToMarkdown } from './markdown-converter.ts';
import type { ExtractedArticle, ExtractError } from '../../shared/types/index.ts';

/** 判定某块正文 HTML 是否视为"无正文"。 */
function isEmptyHtml(html: string | null | undefined, text: string | null | undefined): boolean {
  return !html || !text || text.trim().length === 0;
}

/**
 * 选择正文 HTML：
 * 优先 Readability 结果，其次回退到克隆文档中的首个 <article>，再次 <main>。
 */
function pickContentHtml(clone: Document, readableContent: string | null): string {
  if (readableContent && readableContent.trim().length > 0) {
    return readableContent;
  }
  const article = clone.querySelector('article');
  if (article && article.textContent && article.textContent.trim().length > 0) {
    return article.innerHTML;
  }
  const main = clone.querySelector('main');
  if (main && main.textContent && main.textContent.trim().length > 0) {
    return main.innerHTML;
  }
  return '';
}

/** 提取当前页面文章，成功返回文章对象，失败抛出结构化 ExtractError。 */
export function extractArticle(): ExtractedArticle {
  // 1. 捕获原始 baseURI（cloneNode 可能丢失稳定的 base 解析）。
  const baseURI = document.baseURI || document.documentURI || document.URL;

  // 2. 深克隆，避免 Readability 修改污染真实页面。
  const clone = document.cloneNode(true) as Document;

  // 3. 文档规范化：恢复懒加载、绝对化资源地址。
  normalizeDocument(clone, baseURI);

  // 4. Readability 提取正文。
  let readableContent: string | null = null;
  let readableByline: string | null = null;
  let readableTitle = '';
  try {
    // Readability 的选项类型未收录 url，但运行时会将 baseURI 用于相对地址解析。
    const options = { url: baseURI } as unknown as ConstructorParameters<typeof Readability>[1];
    const reader = new Readability(clone, options);
    const parsed = reader.parse();
    if (parsed) {
      readableContent = typeof parsed.content === 'string' ? parsed.content : null;
      readableByline = typeof parsed.byline === 'string' ? parsed.byline : null;
      readableTitle = typeof parsed.title === 'string' ? parsed.title : '';
    }
  } catch {
    // Readability 失败不阻断，交由兜底与元数据逻辑处理。
  }

  // 5. 正文兜底（<article> / <main>）。
  const contentHtml = pickContentHtml(clone, readableContent);

  // 6. 元数据补充。
  const { title, author } = resolveArticleMetadata(
    clone,
    readableTitle || readableByline ? { title: readableTitle, byline: readableByline, content: readableContent ?? '' } : null,
  );

  // 7. 转为 Markdown。
  const markdown = contentHtml ? htmlToMarkdown(contentHtml) : '';

  // 8. 空正文判定。
  if (
    !contentHtml ||
    isEmptyHtml(contentHtml, markdown)
  ) {
    const error: ExtractError = {
      code: 'EXTRACT_EMPTY',
      message: '无法从当前页面识别出可阅读的文章正文。',
    };
    throw error;
  }

  return { title, author, url: baseURI, markdown };
}