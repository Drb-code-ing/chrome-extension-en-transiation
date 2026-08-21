/**
 * T3 提取器独立验证脚本（tsx 直接运行，无需真实浏览器）。
 * 通过 jsdom 注入标准文章 / 非文章 DOM，断言标题、作者、Markdown 图片与结构。
 * 运行：npm run test:extract
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { extractArticle } from '../src/content/extractor/article-extractor';
import type { ExtractError } from '../src/shared/types';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = (name: string): string =>
  readFileSync(resolve(here, 'fixtures', name), 'utf8');

/** 将 jsdom 的 window/document 及常用 DOM 全局挂到 globalThis，供提取器使用。 */
function injectDom(html: string, url: string): void {
  const dom = new JSDOM(html, { url });
  const { window } = dom;
  const target = globalThis as Record<string, unknown>;
  const keys = [
    'document',
    'window',
    'Node',
    'NodeFilter',
    'Element',
    'HTMLElement',
    'Document',
    'Range',
    'TreeWalker',
    'DOMParser',
    'MutationObserver',
    'HTMLTableElement',
  ];
  for (const key of keys) {
    target[key] = (window as unknown as Record<string, unknown>)[key];
  }
}

function run(): void {
  // 场景 1：标准文章，验证标题/作者/图片/结构。
  injectDom(fixtures('article.html'), 'https://example.com/post/article');
  const article = extractArticle();
  assert.strictEqual(article.title, 'Relative URLs in Web Performance', '标题应为 document.title');
  assert.strictEqual(article.author, 'Jane Doe', '作者应来自 meta author');
  assert.strictEqual(article.url, 'https://example.com/post/article', '原文 URL 应为页面地址');

  // 普通图片：alt 保留，相对路径转绝对。
  assert.match(article.markdown, /!\[Hero image\]\(https:\/\/example\.com\/post\/images\/hero\.png\)/);
  // 懒加载图片：data-src 被提升到 src 并转绝对。
  assert.match(article.markdown, /!\[Flow diagram\]\(https:\/\/example\.com\/post\/image\/flow\.png\)/);
  // 标题层级 ATX。
  assert.match(article.markdown, /^## Why base paths matter$/m, '应保留二级标题');
  // 列表、引用、代码块保留。
  assert.match(article.markdown, /^- /m, '应保留无序列表');
  assert.match(article.markdown, /^> /m, '应保留引用');
  assert.match(article.markdown, /```/, '应保留代码块');
  assert.match(article.markdown, /^\| Type \| Resolution \|$/m, '应保留表格');
  // 导航链接不应进入正文。
  assert.ok(!article.markdown.includes('Home'), '导航内容不应被提取');

  console.log('[PASS] 场景1 标准文章：标题/作者/URL/图片/结构断言全部通过');

  // 场景 2：无法识别页面，应返回 EXTRACT_EMPTY。
  injectDom(fixtures('non-article.html'), 'https://app.example.com/dashboard');
  let threwEmpty = false;
  try {
    extractArticle();
  } catch (error) {
    const code = (error as ExtractError).code;
    assert.strictEqual(code, 'EXTRACT_EMPTY', '非文章页应返回 EXTRACT_EMPTY');
    threwEmpty = true;
  }
  assert.ok(threwEmpty, '非文章页应抛出 EXTRACT_EMPTY');
  console.log('[PASS] 场景2 非文章页：正确返回 EXTRACT_EMPTY');

  console.log('\nT3 提取器独立验证全部通过。');
}

run();