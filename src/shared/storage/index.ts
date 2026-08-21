/**
 * chrome.storage.local 读写封装。
 * 当前仅封装 settings（T4 翻译所需），后续任务（T6/T8）可在此扩展 lastResult 等。
 */
import { DEFAULT_SETTINGS } from '../constants/index.ts';
import type { AppSettings } from '../types/index.ts';

const SETTINGS_KEY = 'settings';

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