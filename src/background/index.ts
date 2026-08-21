/**
 * 后台层（Service Worker）入口：注册翻译长连接端口路由。
 * 面板通过端口发送"发起翻译"，后台流式调用模型并逐块转发增量、完成与错误事件。
 */
import { MESSAGE_TYPES, TRANSLATE_PORT, isTranslateStartRequest } from '../shared/messages/index.ts';
import { loadSettings } from '../shared/storage/index.ts';
import type { TranslateError } from '../shared/types/index.ts';
import { mapTranslateError, translateStream } from './services/translate-client.ts';

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

export {};