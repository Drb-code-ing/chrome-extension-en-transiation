/**
 * 节流累积 Markdown 的 Hook。
 * 流式增量先写入 ref（pending），再按固定节奏刷新到 state，避免每个增量都触发
 * 渲染区全量重渲染（长文卡顿）。完成时调用 commitNow 立即提交完整结果。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface ThrottledMarkdown {
  /** 当前已提交（展示）的完整 Markdown。 */
  text: string;
  /** 追加一段增量，并安排下一个刷新节拍。 */
  push: (delta: string) => void;
  /** 立即提交 pending 内容（翻译完成时调用）。 */
  commitNow: () => void;
  /** 清空全部内容与定时器。 */
  reset: () => void;
}

export function useThrottledMarkdown(intervalMs = 200): ThrottledMarkdown {
  const [text, setText] = useState('');
  const pending = useRef('');
  const timer = useRef<number | null>(null);

  const commit = useCallback(() => {
    timer.current = null;
    setText(pending.current);
  }, []);

  const push = useCallback(
    (delta: string) => {
      pending.current += delta;
      if (timer.current === null) {
        timer.current = window.setTimeout(commit, intervalMs);
      }
    },
    [commit, intervalMs],
  );

  const commitNow = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setText(pending.current);
  }, []);

  const reset = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    pending.current = '';
    setText('');
  }, []);

  // 卸载时清理定时器。
  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    },
    [],
  );

  return { text, push, commitNow, reset };
}