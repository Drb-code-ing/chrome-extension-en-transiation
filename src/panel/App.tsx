import React, { useState } from 'react';

type ViewState = 'idle' | 'translating' | 'success' | 'error';

const VIEW_LABELS: Record<ViewState, string> = {
  idle: '初始',
  translating: '翻译中',
  success: '成功',
  error: '失败',
};

const ResultPreview: React.FC = () => (
  <article className="result-preview">
    <h1>让复杂的技术文章更容易阅读</h1>
    <blockquote>
      <p><strong>作者：</strong>Alex Morgan</p>
      <p><strong>原文链接：</strong>https://example.com/article</p>
    </blockquote>
    <p>优秀的翻译不只是替换词语，还应保留文章的结构、语气与阅读节奏。</p>
    <h2>从清晰的结构开始</h2>
    <p>标题、列表、引用与图片都会按照原文顺序呈现，让长文依然易于浏览。</p>
  </article>
);

const App: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('idle');

  const renderContent = () => {
    switch (viewState) {
      case 'translating':
        return (
          <section className="state-panel state-panel--translating" aria-live="polite">
            <div className="status-heading">
              <span className="spinner" aria-hidden="true" />
              <div>
                <p className="eyebrow">正在翻译</p>
                <h2>正在整理文章内容…</h2>
              </div>
              <span className="status-value">62%</span>
            </div>
            <div className="progress-track" aria-label="模拟翻译进度 62%">
              <span style={{ width: '62%' }} />
            </div>
            <div className="translation-preview">
              <ResultPreview />
              <span className="typing-caret" aria-hidden="true" />
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
              <button type="button" className="button button--secondary">下载译文</button>
              <button type="button" className="button button--secondary">下载原文</button>
            </div>
            <div className="translation-preview translation-preview--complete">
              <ResultPreview />
            </div>
            <div className="bottom-actions">
              <button type="button" className="text-button" onClick={() => setViewState('translating')}>重新翻译</button>
              <button type="button" className="button button--primary button--compact">打开原文</button>
            </div>
          </section>
        );
      case 'error':
        return (
          <section className="state-panel state-panel--error">
            <span className="error-symbol" aria-hidden="true">!</span>
            <p className="eyebrow eyebrow--error">翻译未完成</p>
            <h2>无法提取当前页面的主要文章内容</h2>
            <p className="error-message">请确认当前页面是可阅读的文章页面，然后重新尝试。</p>
            <button type="button" className="button button--primary" onClick={() => setViewState('translating')}>重新尝试</button>
            <p className="supporting-text">已有的最近一次成功结果不会被覆盖。</p>
          </section>
        );
      case 'idle':
      default:
        return (
          <section className="state-panel state-panel--idle">
            <div>
              <p className="eyebrow">当前页面</p>
              <h2>准备翻译这篇英文文章</h2>
            </div>
            <div className="page-card">
              <span className="page-card__icon" aria-hidden="true">EN</span>
              <div className="page-card__content">
                <strong>How AI Is Changing the Way We Read</strong>
                <span>example.com/article</span>
              </div>
            </div>
            <button type="button" className="button button--primary button--large" onClick={() => setViewState('translating')}>一键翻译当前文章</button>
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
        <button type="button" className="icon-button" aria-label="打开设置" title="设置功能将在 T8 接通">⚙</button>
      </header>
      <main className="popup__body">{renderContent()}</main>
      <nav className="demo-switcher" aria-label="界面状态模拟切换">
        <span>演示状态</span>
        <div className="demo-switcher__controls">
          {(Object.keys(VIEW_LABELS) as ViewState[]).map((state) => (
            <button
              type="button"
              key={state}
              className={viewState === state ? 'is-active' : ''}
              onClick={() => setViewState(state)}
            >
              {VIEW_LABELS[state]}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default App;