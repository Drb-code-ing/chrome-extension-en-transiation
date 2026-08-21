/**
 * 后台层（Service Worker）入口：注册翻译长连接端口路由。
 * 面板通过端口发送"发起翻译"，后台流式调用模型并逐块转发增量、完成与错误事件。
 */
import {
  MESSAGE_TYPES,
  TRANSLATE_PORT,
  isTestConnectionRequest,
  isTranslateStartRequest,
  type TestConnectionResponse,
} from '../shared/messages/index.ts';
import { DEFAULT_MODEL } from '../shared/constants/index.ts';
import { loadSettings } from '../shared/storage/index.ts';
import type { TranslateError } from '../shared/types/index.ts';
import {
  createOpenAIClient,
  mapTranslateError,
  translateStream,
} from './services/translate-client.ts';

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.runtime.onConnect.addListener((port) => {
  // 只处理翻译专用的长连接。
  if (port.name !== TRANSLATE_PORT) {
    return;
  }

  port.onMessage.addListener(async (message: unknown) => {
    if (!isTranslateStartRequest(message)) {
      return;
    }
    const { requestId, markdown, title, author, url } = message;
    try {
      const settings = await loadSettings();
      const fullText = await streamAndPost(settings, markdown, title, author, url, port, requestId);
      port.postMessage({ type: MESSAGE_TYPES.translateDone, requestId, fullText });
    } catch (error) {
      const translateError: TranslateError = mapTranslateError(error);
      port.postMessage({ type: MESSAGE_TYPES.translateError, requestId, error: translateError });
    }
  });
});

/** 流式翻译并逐块转发增量到面板，返回完整文本。 */
async function streamAndPost(
  settings: Parameters<typeof translateStream>[0]['settings'],
  markdown: string,
  title: string,
  author: string,
  url: string,
  port: chrome.runtime.Port,
  requestId: string,
): Promise<string> {
  const parts: string[] = [];
  for await (const delta of translateStream({ settings, markdown, title, author, url })) {
    parts.push(delta);
    port.postMessage({ type: MESSAGE_TYPES.translateDelta, requestId, delta });
  }
  return parts.join('');
}

// ---- 测试连接（T8）：单次请求-响应，供设置页校验密钥与地址 ----

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse): boolean => {
    if (!isTestConnectionRequest(message)) {
      return false;
    }
    // 异步处理：返回 true 保持消息通道。
    void handleTestConnection(message).then(sendResponse);
    return true;
  },
);

/** 用候选配置发起一次最小请求，返回成功/失败的结构化结果。 */
async function handleTestConnection(
  request: { baseUrl: string; apiKey: string; model: string },
): Promise<TestConnectionResponse> {
  try {
    const client = createOpenAIClient({
      apiKey: request.apiKey,
      baseUrl: request.baseUrl,
      model: request.model || DEFAULT_MODEL,
      temperature: 0.3,
      theme: 'minimal',
      followSystemTheme: true,
      viewMode: 'mobile',
    });
    const res = await client.chat.completions.create({
      model: request.model || DEFAULT_MODEL,
      max_tokens: 5,
      messages: [{ role: 'user', content: '请只回复"ok"一词。' }],
    });
    const reply = res.choices?.[0]?.message?.content?.trim() ?? '';
    return { ok: true, message: reply ? `连接成功（${reply}）` : '连接成功' };
  } catch (error) {
    return { ok: false, error: mapTranslateError(error) };
  }
}

export {};