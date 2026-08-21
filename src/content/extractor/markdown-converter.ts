/**
 * Markdown 转换：基于 Turndown 将正文 HTML 转为 Markdown。
 * - 标题使用 ATX 风格（#），保留原文层级。
 * - 启用 GFM 插件，保留表格、删除线、任务列表。
 * - 代码块使用围栏风格。
 * - 图片输出为 `![alt](src)`。
 */
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

let converter: TurndownService | null = null;

/**
 * 惰性创建并返回统一的 Turndown 实例。
 * Turndown 实例可跨调用复用，故仅初始化一次。
 */
function getConverter(): TurndownService {
  if (converter) {
    return converter;
  }
  const instance = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    linkStyle: 'inlined',
    emDelimiter: '*',
    strongDelimiter: '**',
  });
  instance.use(gfm);
  converter = instance;
  return instance;
}

/** 将正文 HTML 转为 Markdown 文本。 */
export function htmlToMarkdown(html: string): string {
  return getConverter()
    .turndown(html)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}