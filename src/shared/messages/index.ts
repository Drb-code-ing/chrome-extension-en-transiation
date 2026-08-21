/**
 * 跨层消息协议集中定义（单一事实来源）。
 * Panel 与 Content / Background 之间的消息类型、载荷与响应统一在此声明，
 * 依赖方向与类型均来自 shared，避免各层自行硬编码协议。
 */
import type { ExtractedArticle, ExtractError, TranslateError } from '../types/index.ts';

/** 消息类型常量，供各层引用。 */
export const MESSAGE_TYPES = {
  /** 请求内容脚本提取当前页面文章。 */
  extractArticle: 'EXTRACT_ARTICLE',
  /** 面板发起翻译（经端口发送）。 */
  translateStart: 'TRANSLATE_START',
  /** 后台转发翻译增量块。 */
  translateDelta: 'TRANSLATE_DELTA',
  /** 后台通知翻译完成。 */
  translateDone: 'TRANSLATE_DONE',
  /** 后台通知翻译失败。 */
  translateError: 'TRANSLATE_ERROR',
} as const;

/** 面板 → 后台用于流式翻译的长连接端口名。 */
export const TRANSLATE_PORT = 'translate';

/** "提取文章"请求载荷（当前无需额外页面信息，由内容脚本自行读取 DOM）。 */
export interface ExtractArticleRequest {
  type: typeof MESSAGE_TYPES.extractArticle;
}

/** "提取文章"成功响应。 */
export interface ExtractArticleSuccessResponse {
  ok: true;
  article: ExtractedArticle;
}

/** "提取文章"失败响应。 */
export interface ExtractArticleErrorResponse {
  ok: false;
  error: ExtractError;
}

/** "提取文章"响应联合类型。 */
export type ExtractArticleResponse =
  | ExtractArticleSuccessResponse
  | ExtractArticleErrorResponse;

/**
 * 判断消息是否为"提取文章"请求。
 * 供消息监听器安全收窄 useMessage 入参类型。
 */
export function isExtractArticleRequest(value: unknown): value is ExtractArticleRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === MESSAGE_TYPES.extractArticle
  );
}

// ---------------------------------------------------------------------------
// 翻译消息（经长连接端口传输）
// ---------------------------------------------------------------------------

/** 面板发起翻译的请求载荷。 */
export interface TranslateStartRequest {
  type: typeof MESSAGE_TYPES.translateStart;
  /** 任务标识，用于关联增量/完成/错误事件。 */
  requestId: string;
  /** 提取得到的原文 Markdown。 */
  markdown: string;
  /** 文章标题（用于提示词补充）。 */
  title: string;
  /** 文章作者（用于提示词补充）。 */
  author: string;
  /** 原文 URL（用于提示词补充）。 */
  url: string;
}

/** 后台转发的增量块。 */
export interface TranslateDeltaMessage {
  type: typeof MESSAGE_TYPES.translateDelta;
  requestId: string;
  delta: string;
}

/** 后台通知翻译完成。 */
export interface TranslateDoneMessage {
  type: typeof MESSAGE_TYPES.translateDone;
  requestId: string;
  fullText: string;
}

/** 后台通知翻译失败。 */
export interface TranslateErrorMessage {
  type: typeof MESSAGE_TYPES.translateError;
  requestId: string;
  error: TranslateError;
}

/** 端口上的翻译消息联合类型（请求 + 三条事件）。 */
export type TranslatePortMessage =
  | TranslateStartRequest
  | TranslateDeltaMessage
  | TranslateDoneMessage
  | TranslateErrorMessage;

/** 判断端口消息是否为"发起翻译"请求。 */
export function isTranslateStartRequest(value: unknown): value is TranslateStartRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === MESSAGE_TYPES.translateStart
  );
}