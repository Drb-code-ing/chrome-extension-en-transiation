/**
 * 文档规范化：在 Readability 处理前，对克隆文档做预处理，
 * 恢复懒加载图片的真实地址，并将图片/链接的相对路径基于页面 baseURI 转绝对。
 * 目的是避免懒加载导致的漏图，以及后续 Markdown 中出现无法访问的相对链接。
 */

/** 常见懒加载图片候选地址属性。 */
const LAZY_SRC_ATTRIBUTES = ['data-src', 'data-original', 'data-lazy-src'];

/**
 * 解析单个属性值，将其转换为绝对 URL。
 * 值为空或无法解析时原样返回，保证不破坏原有结构。
 */
function resolveAbsoluteUrl(value: string, baseURI: string): string {
  if (!value) {
    return value;
  }
  try {
    return new URL(value, baseURI).href;
  } catch {
    return value;
  }
}

/**
 * 规范化 `srcset` 中每个候选地址，保留原有的描述符（如 "1x"、"500w"）。
 */
function normalizeSrcset(srcset: string, baseURI: string): string {
  return srcset
    .split(',')
    .map((candidate) => {
      const [url = '', ...descriptors] = candidate.trim().split(/\s+/);
      if (!url) {
        return candidate;
      }
      return [resolveAbsoluteUrl(url, baseURI), ...descriptors].join(' ');
    })
    .join(', ');
}

/**
 * 对克隆文档执行规范化：
 * 1. 恢复懒加载图片的真实地址到 `src`；
 * 2. 将图片 `src` / `srcset` 与链接 `href` 转为绝对地址。
 */
export function normalizeDocument(clone: Document, baseURI: string): void {
  clone.querySelectorAll('img').forEach((img) => {
    // 懒加载：将候选真实地址提升到 src。
    for (const attr of LAZY_SRC_ATTRIBUTES) {
      const candidate = img.getAttribute(attr);
      if (candidate) {
        img.setAttribute('src', candidate);
      }
    }

    const src = img.getAttribute('src');
    if (src) {
      img.setAttribute('src', resolveAbsoluteUrl(src, baseURI));
    }

    const srcset = img.getAttribute('srcset');
    if (srcset) {
      img.setAttribute('srcset', normalizeSrcset(srcset, baseURI));
    }
  });

  clone.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href');
    if (href) {
      anchor.setAttribute('href', resolveAbsoluteUrl(href, baseURI));
    }
  });
}