/**
 * 内容脚本层入口：负责注册跨层消息监听，作为提取链路在页面中的消息边界。
 * 保持薄入口，具体提取逻辑委托给 extractor / meta 模块。
 */
import {
  isExtractArticleRequest,
  type ExtractArticleResponse,
} from '../shared/messages/index.ts';
import type { ExtractError } from '../shared/types/index.ts';
import { extractArticle } from './extractor/article-extractor.ts';

/** 将任意异常规范化为结构化 ExtractError。 */
function toExtractError(error: unknown): ExtractError {
  if (
    error &&
    typeof error === 'object' &&
    typeof (error as ExtractError).code === 'string'
  ) {
    return error as ExtractError;
  }
  return {
    code: 'EXTRACT_FAILED',
    message: error instanceof Error ? error.message : '文章提取过程出现异常。',
  };
}

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse): boolean => {
    if (!isExtractArticleRequest(message)) {
      return false;
    }

    // 异步提取：返回 true 保持消息通道在异步处理期间不关闭。
    const respond: (response: ExtractArticleResponse) => void = sendResponse;
    try {
      const article = extractArticle();
      respond({ ok: true, article });
    } catch (error) {
      respond({ ok: false, error: toExtractError(error) });
    }
    return true;
  },
);

export {};