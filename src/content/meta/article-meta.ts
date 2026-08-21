/**
 * 元数据补充器：优先使用 Readability 提供的 title / byline，
 * 不足时回退到 meta、OpenGraph、JSON-LD 结构化数据与 document.title。
 */
/** 由 Readability 解析出的对象形状（仅用到其中标题与作者字段）。 */
export interface ReadabilityResultLike {
  title: string;
  byline: string | null;
  content: string;
}

/**
 * 解析 JSON-LD，提取文章类结构的 headline / headLine 与 author.name。
 * 兼容嵌套 author 对象（{ "@type": "Person", "name": "..." }）。
 */
function parseJsonLd(): { title: string; author: string } {
  const result = { title: '', author: '' };

  document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
    let data: unknown;
    try {
      data = JSON.parse(String(script.textContent ?? ''));
    } catch {
      return;
    }
    const nodes = Array.isArray(data) ? data : [data];
    for (const node of nodes) {
      if (!node || typeof node !== 'object') {
        continue;
      }
      const obj = node as Record<string, unknown>;
      const type = String(obj['@type'] ?? '');
      const isArticle =
        type === 'Article' || type === 'NewsArticle' || type === 'BlogPosting';
      if (!isArticle) {
        continue;
      }
      const titleValue = obj.headline ?? obj.headLine;
      if (typeof titleValue === 'string' && titleValue) {
        result.title = titleValue;
      }
      const author = obj.author;
      if (typeof author === 'string') {
        result.author = author;
      } else if (typeof author === 'object' && author !== null) {
        const authorName = (author as Record<string, unknown>).name;
        if (typeof authorName === 'string') {
          result.author = authorName;
        }
      }
    }
  });

  return result;
}

/** 读取首个匹配的 meta 文本内容（property 或 name 任一命中）。 */
function readMetaContent(keys: string[]): string {
  for (const key of keys) {
    const selector = [`meta[property="${key}"]`, `meta[name="${key}"]`].join(', ');
    const el = document.querySelector(selector);
    const value = el?.getAttribute('content')?.trim();
    if (value) {
      return value;
    }
  }
  return '';
}

/**
 * 组装最终标题与作者信息。
 * 优先级：Readability > meta/OG/JSON-LD/语义元素 > document.title。
 */
export function resolveArticleMetadata(
  doc: Document,
  readable: ReadabilityResultLike | null,
): { title: string; author: string } {
  // 标题：Readability 兜底逐级。
  const jsonLd = parseJsonLd();
  const ogTitle = readMetaContent(['og:title']);
  const title =
    readable?.title?.trim() ||
    jsonLd.title ||
    ogTitle ||
    doc.title.trim() ||
    (doc.querySelector('article')?.getAttribute('aria-label') ?? '').trim() ||
    '未命名文章';

  // 作者：Readability byline 优先，其次 meta / JSON-LD。
  const cleanByline = (readable?.byline ?? '').replace(/^by\s+/i, '').trim();
  const author =
    cleanByline ||
    readMetaContent(['article:author', 'author', 'parsely-author', 'dc.creator']) ||
    jsonLd.author ||
    doc.querySelector('a[rel="author"]')?.textContent?.trim() ||
    '';

  return { title, author };
}