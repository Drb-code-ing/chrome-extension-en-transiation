/**
 * 设置页（Options）。
 * 三个模块：模型配置 / 展示偏好 / 数据与关于。
 * 配置保存到 chrome.storage.local（shared/storage），主界面翻译与渲染实时读取生效。
 */
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { MESSAGE_TYPES, type TestConnectionRequest, type TestConnectionResponse } from '@/shared/messages/index.ts';
import {
  DEFAULT_SETTINGS,
  MODEL_OPTIONS,
  TEMPERATURE_MAX,
  TEMPERATURE_MIN,
  THEME_OPTIONS,
  VIEW_MODE_OPTIONS,
} from '@/shared/constants/index.ts';
import { clearLastResult, loadSettings, saveSettings } from '@/shared/storage/index.ts';
import type { AppSettings, ThemeType, TranslateError, ViewMode } from '@/shared/types/index.ts';

import './styles/options.css';

/** 视图模式的中文文案。 */
const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  mobile: '手机',
  tablet: '平板',
  desktop: '桌面',
};

/** 将 TranslateError 映射为可读提示。 */
function translateErrorText(error: TranslateError): string {
  switch (error.code) {
    case 'AUTH_FAILED':
      return `认证失败：${error.message}`;
    case 'RATE_LIMITED':
      return `请求过频：${error.message}`;
    case 'NETWORK_ERROR':
      return `网络异常：${error.message}`;
    case 'EMPTY_RESPONSE':
      return `空响应：${error.message}`;
    default:
      return `连接失败：${error.message}`;
  }
}

/** 测试连接返回的结构化结果（成功/失败统一给宿主提示）。 */
interface TestResult {
  ok: boolean;
  text: string;
}

const Options: React.FC = () => {
  const [form, setForm] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // 载入已保存设置。
  useEffect(() => {
    loadSettings()
      .then((saved) => setForm(saved))
      .catch(() => setForm(DEFAULT_SETTINGS))
      .finally(() => setLoaded(true));
  }, []);

  /** 更新某个表单项。 */
  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** 用当前候选配置向后台发起测试连接。 */
  const handleTest = async (): Promise<void> => {
    setTesting(true);
    setTestResult(null);
    const request: TestConnectionRequest = {
      type: MESSAGE_TYPES.testConnection,
      baseUrl: form.baseUrl.trim(),
      apiKey: form.apiKey.trim(),
      model: form.model,
    };
    try {
      const resp = (await chrome.runtime.sendMessage(request)) as TestConnectionResponse | undefined;
      if (resp?.ok) {
        setTestResult({ ok: true, text: resp.message });
      } else if (resp && !resp.ok) {
        setTestResult({ ok: false, text: translateErrorText(resp.error) });
      } else {
        setTestResult({ ok: false, text: '未收到后台响应，请重试。' });
      }
    } catch (error) {
      setTestResult({
        ok: false,
        text: error instanceof Error ? error.message : '测试连接过程出现异常。',
      });
    } finally {
      setTesting(false);
    }
  };

  /** 保存设置。 */
  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setNotice(null);
    const next: AppSettings = {
      ...form,
      baseUrl: form.baseUrl.trim(),
      apiKey: form.apiKey.trim(),
    };
    try {
      await saveSettings(next);
      setForm(next);
      setNotice('设置已保存。');
      window.setTimeout(() => setNotice(null), 2500);
    } catch (error) {
      setNotice(error instanceof Error ? `保存失败：${error.message}` : '保存失败，请重试。');
    } finally {
      setSaving(false);
    }
  };

  /** 清空最近一次结果（带确认）。 */
  const handleClear = async (): Promise<void> => {
    if (!window.confirm('确定要清空最近一次翻译结果吗？')) {
      return;
    }
    setNotice(null);
    try {
      await clearLastResult();
      setNotice('最近一次翻译结果已清空。');
      window.setTimeout(() => setNotice(null), 2500);
    } catch (error) {
      setNotice(error instanceof Error ? `清空失败：${error.message}` : '清空失败，请重试。');
    }
  };

  if (!loaded) {
    return <main className="options">正在加载…</main>;
  }

  return (
    <main className="options">
      <h1 className="options__title">设置</h1>

      {/* ---- 模型配置模块 ---- */}
      <section className="opt-card">
        <h2 className="opt-card__title">AI 模型</h2>
        <div className="opt-field">
          <label className="opt-field__label" htmlFor="opt-baseUrl">服务基地址</label>
          <input
            id="opt-baseUrl"
            className="opt-input"
            type="url"
            value={form.baseUrl}
            onChange={(e) => update('baseUrl', e.target.value)}
            placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
            spellCheck={false}
          />
        </div>

        <div className="opt-field">
          <label className="opt-field__label" htmlFor="opt-apikey">API Key</label>
          <div className="opt-row">
            <input
              id="opt-apikey"
              className="opt-input"
              type={showKey ? 'text' : 'password'}
              value={form.apiKey}
              onChange={(e) => update('apiKey', e.target.value)}
              placeholder="sk-…"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className="opt-secondary" onClick={() => setShowKey((v) => !v)}>
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
        </div>

        <div className="opt-field">
          <label className="opt-field__label" htmlFor="opt-model">模型名</label>
          <select
            id="opt-model"
            className="opt-input"
            value={form.model}
            onChange={(e) => update('model', e.target.value)}
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="opt-field">
          <label className="opt-field__label" htmlFor="opt-temp">温度</label>
          <div className="opt-row opt-row--temperature">
            <input
              id="opt-temp"
              type="range"
              min={TEMPERATURE_MIN}
              max={TEMPERATURE_MAX}
              step={0.1}
              value={form.temperature}
              onChange={(e) => update('temperature', Number(e.target.value))}
            />
            <span className="opt-value">{form.temperature.toFixed(1)}</span>
          </div>
        </div>

        <div className="opt-card__actions">
          <button
            type="button"
            className="opt-secondary"
            onClick={() => void handleTest()}
            disabled={testing || saving}
            aria-busy={testing}
          >
            {testing ? '测试中…' : '测试连接'}
          </button>
          <button
            type="button"
            className="opt-primary"
            onClick={() => void handleSave()}
            disabled={testing || saving}
            aria-busy={saving}
          >
            {saving ? '保存中…' : '保存设置'}
          </button>
        </div>
        {testResult && (
          <p
            className={testResult.ok ? 'opt-feedback opt-feedback--ok' : 'opt-feedback opt-feedback--err'}
            role={testResult.ok ? 'status' : 'alert'}
            aria-live={testResult.ok ? 'polite' : 'assertive'}
          >
            {testResult.text}
          </p>
        )}
      </section>

      {/* ---- 展示偏好模块 ---- */}
      <section className="opt-card">
        <h2 className="opt-card__title">展示</h2>
        <div className="opt-field">
          <label className="opt-field__label" htmlFor="opt-theme">主题</label>
          <select
            id="opt-theme"
            className="opt-input"
            value={form.theme}
            onChange={(e) => update('theme', e.target.value as ThemeType)}
          >
            {THEME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="opt-field">
          <label className="opt-switch">
            <input
              type="checkbox"
              checked={form.followSystemTheme}
              onChange={(e) => update('followSystemTheme', e.target.checked)}
            />
            <span>跟随系统主题</span>
          </label>
        </div>

        <div className="opt-field">
          <span className="opt-field__label">默认视图模式</span>
          <div className="opt-radio-group">
            {VIEW_MODE_OPTIONS.map((m) => (
              <label key={m} className="opt-radio">
                <input
                  type="radio"
                  name="viewMode"
                  value={m}
                  checked={form.viewMode === m}
                  onChange={() => update('viewMode', m)}
                />
                <span>{VIEW_MODE_LABELS[m]}</span>
              </label>
            ))}
          </div>
          <p className="opt-hint">影响译文中长文与图片的展示宽度。</p>
        </div>
      </section>

      {/* ---- 数据与关于模块 ---- */}
      <section className="opt-card">
        <h2 className="opt-card__title">数据与关于</h2>
        <div className="opt-field">
          <span className="opt-field__label">最近一次结果</span>
          <button type="button" className="opt-secondary opt-secondary--danger" onClick={() => void handleClear()}>
            清空最近一次结果
          </button>
        </div>
        <div className="opt-about">
          <p>Chrome 网页 AI 翻译插件 · v0.1.0</p>
          <p>正文由 Readability 提取，翻译调用 OpenAI 兼容接口（默认 Qwen），结果由 md-wx 渲染。</p>
        </div>
      </section>

      {notice && (
        <p
          className={notice.includes('失败') ? 'opt-notice opt-notice--error' : 'opt-notice'}
          role={notice.includes('失败') ? 'alert' : 'status'}
          aria-live={notice.includes('失败') ? 'assertive' : 'polite'}
        >
          {notice}
        </p>
      )}
    </main>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <Options />
    </React.StrictMode>,
  );
}

export default Options;