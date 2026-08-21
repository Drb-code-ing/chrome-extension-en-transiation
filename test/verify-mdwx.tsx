/**
 * T5 独立验证脚本：用模拟增量流驱动打字机节流 Hook，并验证 md-wx 渲染。
 * 运行：npm run test:mdwx
 */
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import React, { useEffect, useRef, useState } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useThrottledMarkdown } from '../src/panel/hooks/useThrottledMarkdown';

/** 把 jsdom 的 window/document 等全局挂到 globalThis。 */
function injectDom(): void {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'chrome-extension://test/src/panel/index.html',
  });
  const target = globalThis as Record<string, unknown>;
  for (const key of ['document', 'window', 'Node', 'MutationObserver']) {
    target[key] = (dom.window as unknown as Record<string, unknown>)[key];
  }
  // 声明 React act 测试环境，消除 act(...) 告警。
  target.IS_REACT_ACT_ENVIRONMENT = true;
}

// 通过模块级引用暴露探针组件的 hook 句柄。
const handle: {
  push?: (delta: string) => void;
  commitNow?: () => void;
  reset?: () => void;
  text?: () => string;
} = {};

function ThrottleProbe(): React.JSX.Element {
  const t = useThrottledMarkdown(120);
  const [shown, setShown] = useState('');
  const setShownRef = useRef(setShown);
  setShownRef.current = setShown;

  useEffect(() => {
    setShown(t.text);
  }, [t.text]);

  handle.push = t.push;
  handle.commitNow = t.commitNow;
  handle.reset = t.reset;
  handle.text = () => t.text;

  return <div data-testid="out">{shown}</div>;
}

async function tick(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function run(): Promise<void> {
  // md-wx 在模块加载时访问 document，须在 jsdom 全局就绪后再导入。
  const { MarkdownRenderer } = await import('md-wx');
  let root = createRoot(document.getElementById('root') as HTMLElement);

  // ---- 场景 1：同步推送多段增量不立即提交，节拍后聚合正确。 ----
  await act(async () => {
    root.render(<ThrottleProbe />);
  });
  await act(async () => {
    handle.push?.('你');
    handle.push?.('好');
    handle.push?.('世界');
  });
  // 节流窗口内：展示区尚未刷新。
  assert.strictEqual(handle.text?.(), '', '节流窗口内不应立即提交');
  await act(async () => {
    await tick(200);
  });
  assert.strictEqual(handle.text?.(), '你好世界', '节流后应聚合完整内容');
  const outEl = document.querySelector('[data-testid="out"]');
  assert.ok(outEl && outEl.textContent?.includes('你好世界'), '展示区应包含聚合文本');
  console.log('[PASS] 场景1 打字机节流聚合正确');

  // ---- 场景 2：commitNow 立即提交最终完整结果。 ----
  await act(async () => {
    handle.reset?.();
  });
  await act(async () => {
    handle.push?.('完整');
    handle.push?.('译文');
    handle.commitNow?.();
  });
  assert.strictEqual(handle.text?.(), '完整译文', 'commitNow 应立即提交完整结果');
  console.log('[PASS] 场景2 commitNow 立即提交完整结果');

  // 卸载先前的探针。
  await act(async () => {
    root.unmount();
  });

  // ---- 场景 3：md-wx 渲染 Markdown 标题与代码块。 ----
  root = createRoot(document.getElementById('root') as HTMLElement);
  await act(async () => {
    root.render(
      <MarkdownRenderer
        markdown={'# 测试标题\n\n- 列表项A\n\n```js\nconsole.log(1)\n```'}
        theme="minimal"
        showSettings={false}
        enableCopy={false}
        enableThemeSwitch={false}
        enableViewModeToggle={false}
        followSystemTheme
        className="md-wx-wrap"
      />,
    );
  });
  const bodyText = document.body.textContent ?? '';
  assert.ok(bodyText.includes('测试标题'), 'md-wx 应渲染一级标题文字');
  assert.ok(bodyText.includes('列表项A'), 'md-wx 应渲染列表文字');
  console.log('[PASS] 场景3 md-wx 正确渲染标题与列表');

  await act(async () => {
    root.unmount();
  });

  console.log('\nT5 打字机与 md-wx 渲染独立验证全部通过。');
}

injectDom();
run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });