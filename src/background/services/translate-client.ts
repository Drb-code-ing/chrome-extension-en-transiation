/**
 * AI 翻译客户端：基于 OpenAI 兼容 SDK（默认指向 Qwen / DashScope）发起流式翻译。
 * 对外暴露：createOpenAIClient、truncateMarkdown、translateStream、mapTranslateError。
 */
import OpenAI from 'openai';
import { MAX_INPUT_CHARS, TRANSLATE_SYSTEM_PROMPT } from '../../shared/constants/index.ts';
import type { AppSettings, TranslateError } from '../../shared/types/index.ts';

/** 依据配置创建 OpenAI 兼容客户端。 */
export function createOpenAIClient(settings: AppSettings): OpenAI {
  return new OpenAI({
    apiKey: settings.apiKey,
    baseURL: settings.baseUrl,
    dangerouslyAllowBrowser: true,
  });
}

/**
 * 超长文章按段落边界朴素截断，避免超出模型上下文。
 * 返回截断后的文本，并在末尾附加提示。
 */
export function truncateMarkdown(markdown: string, limit = MAX_INPUT_CHARS): string {
  if (markdown.length <= limit) {
    return markdown;
  }
  const slice = markdown.slice(0, limit);
  const boundary = slice.lastIndexOf('\n\n');
  const cut = boundary > 0 ? slice.slice(0, boundary) : slice;
  return `${cut}\n\n> [文章过长，后续内容已截断]`;
}

/**
 * 将任意异常规范化为结构化 TranslateError。
 * 依据 OpenAI SDK 错误中的 status 分类；网络异常归为 NETWORK_ERROR。
 */
export function mapTranslateError(error: unknown): TranslateError {
  if (
    error &&
    typeof error === 'object' &&
    typeof (error as TranslateError).code === 'string' &&
    typeof (error as TranslateError).message === 'string'
  ) {
    return error as TranslateError;
  }

  const status = (error as { status?: unknown }).status;
  if (status === 401 || status === 403) {
    return { code: 'AUTH_FAILED', message: 'API Key 无效或未授权，请检查设置。' };
  }
  if (status === 429) {
    return { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后重试。' };
  }

  const message = error instanceof Error ? error.message : String(error);
  const looksLikeNetwork =
    /fetch failed|ECONNRESET|ENOTFOUND|temporary failure|network|timeout/i.test(message);
  if (looksLikeNetwork) {
    return { code: 'NETWORK_ERROR', message: '网络连接异常，请检查网络后重试。' };
  }
  return { code: 'UNKNOWN', message: message || '翻译过程出现未知错误。' };
}

/**
 * 流式翻译：异步迭代输出增量文本块。
 * 失败时抛出结构化 TranslateError，空响应抛 EMPTY_RESPONSE。
 */
export async function* translateStream(params: {
  settings: AppSettings;
  markdown: string;
  title: string;
  author: string;
  url: string;
}): AsyncIterable<string> {
  const client = createOpenAIClient(params.settings);
  const userMessage = [
    `# ${params.title}`,
    '',
    `> 作者：${params.author || '未知'}`,
    `> 原文链接：${params.url}`,
    '',
    truncateMarkdown(params.markdown),
  ].join('\n');

  let stream: AsyncIterable<unknown>;
  try {
    stream = await client.chat.completions.create({
      model: params.settings.model,
      temperature: params.settings.temperature,
      messages: [
        { role: 'system', content: TRANSLATE_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      stream: true,
    });
  } catch (error) {
    throw mapTranslateError(error);
  }

  let totalChars = 0;
  try {
    for await (const chunk of stream) {
      const delta = (chunk as { choices?: Array<{ delta?: { content?: string } }> }).choices?.[0]
        ?.delta?.content;
      if (typeof delta === 'string' && delta.length > 0) {
        totalChars += delta.length;
        yield delta;
      }
    }
  } catch (error) {
    // 流式中断（网络断开/服务中断）。
    throw mapTranslateError(error);
  }

  if (totalChars === 0) {
    throw { code: 'EMPTY_RESPONSE', message: '模型未返回任何翻译内容。' } satisfies TranslateError;
  }
}