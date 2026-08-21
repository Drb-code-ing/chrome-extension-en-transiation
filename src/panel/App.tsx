import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MarkdownRenderer } from 'md-wx';
import 'md-wx/dist/style.css';
import {
  MESSAGE_TYPES,
  TRANSLATE_PORT,
  type ExtractArticleRequest,
  type ExtractArticleResponse,
  type TranslatePortMessage,
  type TranslateStartRequest,
} from '@/shared/messages/index.ts';
import {
  loadLastResult,
  loadSettings,
  saveLastResult,
  saveSettings,
} from '@/shared/storage/index.ts';
import type {
  AppSettings,
  ExtractedArticle,
  ExtractError,
  LastResult,
  TranslateError,
} from '@/shared/types/index.ts';
import { useThrottledMarkdown } from './hooks/useThrottledMarkdown.ts';

type ViewState = 'idle' | 'translating' | 'success' | 'error';

interface TabInfo {
  title: string;
  url: string;
}

/** 将任意异常规范化为 ExtractError。 */
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
    message: error instanceof Error ? error.message : '文章提取过程出现异常',
  };
}

/** 将任意异常规范化为 TranslateError。 */
function toTranslateError(error: unknown): TranslateError {
  if (
    error &&
    typeof error === 'object' &&
    typeof (error as TranslateError).code === 'string' &&
    typeof (error as TranslateError).message === 'string'
  ) {
    return error as TranslateError;
  }
  return {
    code: 'UNKNOWN',
    message: error instanceof Error ? error.message : '翻译过程出现未知错误',
  };
}

/** 由文章标题生成安全的文件名（去非法字符、压缩空白与连字符）。 */
function safeFilename(title: string): string {
  const normalized = title
    .trim()
    .replace(/[\\/:*?"<>|\n\r]+/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || 'translation';
}

/** 将 Markdown 文本下载为 .md 文件（使用 downloads 权限）。 */
async function downloadMarkdown(content: string, title: string, suffix: string): Promise<void> {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({
      url,
      filename: `${safeFilename(title)}${suffix}.md`,
      saveAs: false,
    });
  } finally {
    // 下载已发起后释放对象 URL。
    URL.revokeObjectURL(url);
  }
}

const App: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('idle');

  // ---- 标签页信息与设置 ----
  const [tabInfo, setTabInfo] = useState<TabInfo>({ title: '', url: '' });
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');

  // ---- 提取（T3）----
  const [isExtracting, setIsExtracting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewArticle, setPreviewArticle] = useState<ExtractedArticle | null>(null);
  const [extractError, setExtractError] = useState<ExtractError | null>(null);

  // ---- 当前翻译的文章（T7：供下载原文 / 打开原文使用）----
  const [currentArticle, setCurrentArticle] = useState<ExtractedArticle | null>(null);

  // ---- 翻译（T4）----
  const translate = useThrottledMarkdown(200);
  const [translateError, setTranslateError] = useState<TranslateError | null>(null);
  const translatingRef = useRef(false);
  const activePortRef = useRef<chrome.runtime.Port | null>(null);

  // ---- 最近一次结果持久化（T6）----
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  // ---- 渲染偏好（T8：由设置页读取，缺省为默认值）----
  const mdTheme = settings?.theme ?? 'minimal';
  const mdFollowSystem = settings?.followSystemTheme ?? true;
  const mdViewMode = settings?.viewMode ?? 'mobile';

  // 弹窗关闭时断开仍在运行的翻译端口，避免后台任务悬挂。
  useEffect(
    () => () => {
      activePortRef.current?.disconnect();
      activePortRef.current = null;
      translatingRef.current = false;
    },
    [],
  );

  // 初次打开：读取活动标签页信息与本地设置。
  useEffect(() => {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        const tab = tabs[0];
        if (!tab) {
          return;
        }
        setTabInfo({
          title: tab.title ?? '',
          url: (tab.url || tab.pendingUrl || '').trim(),
        });
      })
      .catch(() => {
        // activeTab 读取失败时保持空信息，不阻断后续流程。
      });

    // 并发读取本地设置与最近一次翻译结果（T6）。
    Promise.all([loadSettings(), loadLastResult()])
      .then(([loaded, last]) => {
        setSettings(loaded);
        setLastResult(last);
      })
      .catch(() => setSettings(null));
  }, []);

  /** 向指定标签页请求文章；内容脚本未注入时补充注入并重试一次。 */
  const sendExtractRequest = useCallback(async (
    tabId: number,
    allowInjection: boolean,
  ): Promise<ExtractArticleResponse | undefined> => {
    const request: ExtractArticleRequest = { type: MESSAGE_TYPES.extractArticle };
    try {
      return (await chrome.tabs.sendMessage(tabId, request)) as ExtractArticleResponse | undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const missingReceiver = /Receiving end does not exist|Could not establish connection/i.test(message);
      if (!allowInjection || !missingReceiver) {
        throw error;
      }
      const manifest = chrome.runtime.getManifest();
      const files = manifest.content_scripts?.flatMap((script) => script.js ?? []) ?? [];
      if (files.length === 0) {
        throw error;
      }
      await chrome.scripting.executeScript({ target: { tabId }, files });
      return (await chrome.tabs.sendMessage(tabId, request)) as ExtractArticleResponse | undefined;
    }
  }, []);

  /** 向当前活动标签页请求提取文章，返回文章对象。 */
  const requestExtract = useCallback(async (): Promise<ExtractedArticle> => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id) {
      throw { code: 'EXTRACT_FAILED', message: '未找到可提取的活动标签页。' } satisfies ExtractError;
    }
    const url = (tab.url || tab.pendingUrl || '').trim();
    if (!/^https?:\/\//i.test(url)) {
      throw {
        code: 'EXTRACT_FAILED',
        message: '当前页面属于浏览器受限页面，请打开普通网页后重试。',
      } satisfies ExtractError;
    }
    const response = await sendExtractRequest(tab.id, true);
    if (!response) {
      throw { code: 'EXTRACT_FAILED', message: '未收到页面响应，请刷新网页后重试。' } satisfies ExtractError;
    }
    if (!response.ok) {
      throw response.error;
    }
    return response.article;
  }, [sendExtractRequest]);

  // 提取预览（T3）。
  const handleExtract = useCallback(async () => {
    setIsExtracting(true);
    setExtractError(null);
    try {
      const article = await requestExtract();
      setPreviewArticle(article);
      setPreviewOpen(true);
      setExtractError(null);
    } catch (error) {
      setExtractError(toExtractError(error));
      setPreviewOpen(false);
    } finally {
      setIsExtracting(false);
    }
  }, [requestExtract]);

  // 保存临时 API Key（T8 提供正式设置页）。
  const handleSaveApiKey = useCallback(async () => {
    if (!settings) {
      return;
    }
    const next: AppSettings = { ...settings, apiKey: apiKeyInput.trim() };
    await saveSettings(next);
    setSettings(next);
    setApiKeyInput('');
  }, [settings, apiKeyInput]);

  // 一键翻译：提取请求后经端口发起流式翻译，逐块追加展示。
  const handleTranslate = useCallback(async () => {
    if (translatingRef.current) {
      return;
    }
    translatingRef.current = true;
    setTranslateError(null);
    translate.reset();
    setViewState('translating');
    try {
      if (!settings?.apiKey) {
        throw { code: 'AUTH_FAILED', message: '尚未配置 API Key，请先在设置页填写并保存。' } satisfies TranslateError;
      }
      const article = await requestExtract();
      setCurrentArticle(article);
      const requestId = crypto.randomUUID();
      const port = chrome.runtime.connect({ name: TRANSLATE_PORT });
      // #region debug-point A:panel-connect
      void fetch('http://127.0.0.1:7777/event', { method: 'POST', body: JSON.stringify({ sessionId: 'translation-port-disconnect', runId: 'pre-fix', hypothesisId: 'A,D,E', location: 'App.tsx:connect', msg: '[DEBUG] 面板已创建翻译端口', data: { portName: port.name, requestId }, ts: Date.now() }) }).catch(() => {});
      // #endregion
      activePortRef.current = port;
      let settled = false;

      const finish = (): void => {
        settled = true;
        translatingRef.current = false;
        activePortRef.current = null;
      };

      port.onMessage.addListener((message: unknown) => {
        if (!message || typeof message !== 'object') {
          return;
        }
        const msg = message as TranslatePortMessage;
        if (msg.type === MESSAGE_TYPES.translateDelta && msg.requestId === requestId) {
          translate.push(msg.delta);
        } else if (msg.type === MESSAGE_TYPES.translateDone && msg.requestId === requestId) {
          finish();
          translate.commitNow();
          // 仅成功完成后写入最近一次结果并覆盖旧值（T6）。
          const result: LastResult = {
            title: article.title,
            author: article.author,
            url: article.url,
            translatedMarkdown: msg.fullText,
            savedAt: Date.now(),
          };
          void saveLastResult(result);
          setLastResult(result);
          setViewState('success');
          port.disconnect();
        } else if (msg.type === MESSAGE_TYPES.translateError && msg.requestId === requestId) {
          finish();
          setTranslateError(msg.error);
          setViewState('error');
          port.disconnect();
        }
      });
      port.onDisconnect.addListener(() => {
        // #region debug-point A,D:panel-disconnect
        void fetch('http://127.0.0.1:7777/event', { method: 'POST', body: JSON.stringify({ sessionId: 'translation-port-disconnect', runId: 'pre-fix', hypothesisId: 'A,D', location: 'App.tsx:onDisconnect', msg: '[DEBUG] 面板翻译端口断开', data: { settled, lastError: chrome.runtime.lastError?.message ?? null }, ts: Date.now() }) }).catch(() => {});
        // #endregion
        activePortRef.current = null;
        translatingRef.current = false;
        if (!settled) {
          setTranslateError({ code: 'NETWORK_ERROR', message: '翻译连接意外断开，请返回后重试。' });
          setViewState('error');
        }
      });

      const start: TranslateStartRequest = {
        type: MESSAGE_TYPES.translateStart,
        requestId,
        markdown: article.markdown,
        title: article.title,
        author: article.author,
        url: article.url,
      };
      port.postMessage(start);
    } catch (error) {
      translatingRef.current = false;
      activePortRef.current = null;
      setTranslateError(toTranslateError(error));
      setViewState('error');
    }
  }, [settings?.apiKey, requestExtract, translate]);

  // 当前要展示的错误信息（翻译优先，其次提取）。
  const activeError = translateError ?? (previewOpen ? null : extractError);

  // 原文 Markdown 预览面板。
  const renderPreview = () => {
    if (!previewArticle) {
      return null;
    }
    return (
      <section className="preview-panel">
        <div className="preview-panel__head">
          <div>
            <p className="eyebrow">原文提取</p>
            <h2>{previewArticle.title}</h2>
          </div>
        </div>
        <div className="preview-meta">
          <span className="preview-meta__author">作者：{previewArticle.author || '未知'}</span>
          <span className="preview-meta__url">{previewArticle.url}</span>
        </div>
        <pre className="preview-markdown">{previewArticle.markdown}</pre>
        <button
          type="button"
          className="button button--primary button--large"
          onClick={() => setPreviewOpen(false)}
        >
          返回初始状态
        </button>
      </section>
    );
  };

  const renderErrorTitle = (): string => {
    if (!activeError) {
      return '无法提取当前页面的主要文章内容';
    }
    switch (activeError.code) {
      case 'EXTRACT_EMPTY':
      case 'EXTRACT_FAILED':
        return '无法提取当前页面的主要文章内容';
      case 'AUTH_FAILED':
        return '翻译服务未授权';
      case 'RATE_LIMITED':
        return '请求过于频繁';
      case 'NETWORK_ERROR':
        return '网络连接异常';
      case 'EMPTY_RESPONSE':
        return '模型未返回翻译内容';
      default:
        return '翻译未完成';
    }
  };

  // 最近一次结果面板（T6）：初始状态存在最近结果时优先展示。
  const renderLastResultPanel = () => {
    if (!lastResult) {
      return null;
    }
    return (
      <section className="state-panel state-panel--last">
        <div className="last-result-head">
          <div>
            <p className="eyebrow eyebrow--success">最近一次翻译结果</p>
            <h2 className="last-result-title">{lastResult.title}</h2>
          </div>
        </div>
        <div className="last-result-meta">
          <span>作者：{lastResult.author || '未知'}</span>
          <span className="last-result-meta__url">{lastResult.url}</span>
          <span>保存时间：{new Date(lastResult.savedAt).toLocaleString()}</span>
        </div>
        <div className="translation-preview last-result-body">
          <MarkdownRenderer
            markdown={lastResult.translatedMarkdown}
            theme={mdTheme}
            showSettings={false}
            enableCopy={false}
            enableThemeSwitch={false}
            enableViewModeToggle={false}
            defaultViewMode={mdViewMode}
            followSystemTheme={mdFollowSystem}
            className="md-wx-wrap"
          />
        </div>
        <button
          type="button"
          className="button button--primary button--large"
          onClick={handleTranslate}
        >
          翻译当前页面
        </button>
      </section>
    );
  };

  const renderContent = () => {
    switch (viewState) {
      case 'translating':
        return (
          <section className="state-panel state-panel--translating" aria-live="polite">
            <div className="status-heading">
              <span className="spinner" aria-hidden="true" />
              <div>
                <p className="eyebrow">正在翻译</p>
                <h2>正在翻译文章…</h2>
              </div>
            </div>
            <div className="translation-preview">
              {translate.text ? (
                <>
                  <MarkdownRenderer
                    markdown={translate.text}
                    theme={mdTheme}
                    showSettings={false}
                    enableCopy={false}
                    enableThemeSwitch={false}
                    enableViewModeToggle={false}
                    defaultViewMode={mdViewMode}
                    followSystemTheme={mdFollowSystem}
                    className="md-wx-wrap"
                  />
                  <span className="typing-caret" aria-hidden="true" />
                </>
              ) : (
                <pre className="plain-translation">正在建立连接…</pre>
              )}
            </div>
            <p className="supporting-text">译文会随模型返回持续追加，请稍候。</p>
          </section>
        );
      case 'success':
        return (
          <section className="state-panel state-panel--success">
            <div className="status-heading">
              <div>
                <p className="eyebrow eyebrow--success">翻译完成</p>
                <h2>译文已准备好</h2>
              </div>
              <span className="success-mark" aria-hidden="true">✓</span>
            </div>
            <div className="action-row">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => {
                  void downloadMarkdown(translate.text, currentArticle?.title ?? '译文', '-译文');
                }}
              >
                下载译文
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => {
                  if (!currentArticle) {
                    return;
                  }
                  void downloadMarkdown(currentArticle.markdown, currentArticle.title, '-原文');
                }}
              >
                下载原文
              </button>
            </div>
            <div className="translation-preview translation-preview--complete">
              <MarkdownRenderer
                markdown={translate.text}
                theme={mdTheme}
                showSettings={false}
                enableCopy={false}
                enableThemeSwitch={false}
                enableViewModeToggle={false}
                defaultViewMode={mdViewMode}
                followSystemTheme={mdFollowSystem}
                className="md-wx-wrap"
              />
            </div>
            <div className="bottom-actions">
              <button type="button" className="text-button" onClick={() => setViewState('idle')}>重新翻译</button>
              <button
                type="button"
                className="button button--primary button--compact"
                onClick={() => {
                  if (!currentArticle?.url) {
                    return;
                  }
                  void chrome.tabs.create({ url: currentArticle.url });
                }}
              >
                打开原文
              </button>
            </div>
          </section>
        );
      case 'error':
        return (
          <section className="state-panel state-panel--error">
            <span className="error-symbol" aria-hidden="true">!</span>
            <p className="eyebrow eyebrow--error">翻译未完成</p>
            <h2>{renderErrorTitle()}</h2>
            {activeError && <p className="error-message">{activeError.message}</p>}
            <button type="button" className="button button--primary" onClick={() => setViewState('idle')}>返回重试</button>
            <p className="supporting-text">已有的最近一次成功结果不会被覆盖。</p>
          </section>
        );
      case 'idle':
      default:
        // T6：存在最近一次结果时优先展示结果与重新翻译入口。
        if (lastResult) {
          return renderLastResultPanel();
        }
        return (
          <section className="state-panel state-panel--idle">
            <div>
              <p className="eyebrow">当前页面</p>
              <h2>准备翻译这篇英文文章</h2>
            </div>
            <div className="page-card">
              <span className="page-card__icon" aria-hidden="true">EN</span>
              <div className="page-card__content">
                <strong>{tabInfo.title || '当前页面'}</strong>
                <span>{tabInfo.url || '正在识别当前页面地址…'}</span>
              </div>
            </div>
            <button type="button" className="button button--primary button--large" onClick={handleTranslate}>一键翻译当前文章</button>
            {settings && !settings.apiKey && (
              <div className="api-key-box">
                <label className="api-key-box__label">API Key（临时）</label>
                <div className="api-key-box__row">
                  <input
                    type="password"
                    className="api-key-box__input"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="sk-…"
                  />
                  <button type="button" className="button button--secondary" onClick={handleSaveApiKey}>
                    保存
                  </button>
                </div>
                <p className="api-key-box__hint">正式设置页将在 T8 提供。</p>
              </div>
            )}
            <div className="extract-actions">
              <button
                type="button"
                className="text-button"
                disabled={isExtracting}
                onClick={handleExtract}
              >
                {isExtracting ? '提取中…' : '预览提取的原文 Markdown'}
              </button>
            </div>
            {extractError && (
              <p className="extract-error" role="alert">
                提取失败（{extractError.code}）：{extractError.message}
              </p>
            )}
            <ul className="feature-list">
              <li>自动提取页面主要正文</li>
              <li>保留图片、标题、作者与原文链接</li>
            </ul>
          </section>
        );
    }
  };

  return (
    <div className="popup">
      <header className="popup__header">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">译</span>
          <span className="popup__title">网页翻译助手</span>
        </div>
        <button type="button" className="icon-button" aria-label="打开设置" onClick={() => void chrome.runtime.openOptionsPage()}>⚙</button>
      </header>
      <main className="popup__body">{previewOpen ? renderPreview() : renderContent()}</main>
    </div>
  );
};

export default App;