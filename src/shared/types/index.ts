/**
 * 共享层跨层复用类型定义。
 * 仅包含纯类型，不包含任何业务实现，保证可被各层安全引用。
 */

/** 一篇文章的提取结果，后续翻译与渲染均以此为输入。 */
export interface ExtractedArticle {
  /** 文章标题（元数据兜底后的最终值）。 */
  title: string;
  /** 文章作者，缺失时为空字符串。 */
  author: string;
  /** 原文 URL（取当前页面绝对地址）。 */
  url: string;
  /** 由正文 HTML 转换得到的 Markdown 文本。 */
  markdown: string;
}

/** 提取阶段的结构化错误码，用于界面提示方向。 */
export type ExtractErrorCode = 'EXTRACT_EMPTY' | 'EXTRACT_FAILED';

/** 提取阶段的结构化错误，跨消息边界传输。 */
export interface ExtractError {
  code: ExtractErrorCode;
  message: string;
}

/** 翻译阶段的结构化错误码，用于界面提示方向。 */
export type TranslateErrorCode =
  | 'AUTH_FAILED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'EMPTY_RESPONSE'
  | 'UNKNOWN';

/** 翻译阶段的结构化错误，跨消息边界传输。 */
export interface TranslateError {
  code: TranslateErrorCode;
  message: string;
}

/** 最近一次翻译结果（存储于 chrome.storage.local，仅保留最新一条）。 */
export interface LastResult {
  /** 文章标题。 */
  title: string;
  /** 文章作者，缺失时为空字符串。 */
  author: string;
  /** 原文 URL。 */
  url: string;
  /** 翻译后的完整 Markdown（可直接渲染展示）。 */
  translatedMarkdown: string;
  /** 保存时间戳（毫秒）。 */
  savedAt: number;
}

/** 用户可配置的翻译设置（存储于 chrome.storage.local）。 */
export interface AppSettings {
  /** OpenAI 兼容服务基地址。 */
  baseUrl: string;
  /** API Key，仅存本地。 */
  apiKey: string;
  /** 模型名，默认 qwen-plus。 */
  model: string;
  /** 采样温度。 */
  temperature: number;
}