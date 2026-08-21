/**
 * chrome.storage.local 读写封装。
 * 封装 settings（翻译配置）与 lastResult（最近一次翻译结果）。
 */
import { DEFAULT_SETTINGS } from '../constants/index.ts';
import type { AppSettings, LastResult } from '../types/index.ts';

const SETTINGS_KEY = 'settings';
const LAST_RESULT_KEY = 'lastResult';

/** 读取设置，未保存或缺少字段时用默认值补齐。 */
export async function loadSettings(): Promise<AppSettings> {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  const saved = data[SETTINGS_KEY] as Partial<AppSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
}

/** 保存设置（整量覆盖）。 */
export async function saveSettings(settings: AppSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

/** 读取最近一次翻译结果，无结果时返回 null。 */
export async function loadLastResult(): Promise<LastResult | null> {
  const data = await chrome.storage.local.get(LAST_RESULT_KEY);
  return (data[LAST_RESULT_KEY] as LastResult | undefined) ?? null;
}

/** 保存最近一次翻译结果（覆盖旧值，仅在翻译成功后调用）。 */
export async function saveLastResult(result: LastResult): Promise<void> {
  await chrome.storage.local.set({ [LAST_RESULT_KEY]: result });
}

/** 清除最近一次翻译结果（设置页"清空最近结果"使用）。 */
export async function clearLastResult(): Promise<void> {
  await chrome.storage.local.remove(LAST_RESULT_KEY);
}