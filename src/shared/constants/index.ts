/**
 * 共享常量：默认配置、翻译提示词与长度上限。
 * 集中管理，避免在业务代码中出现魔法字符串/数字。
 */
import type { AppSettings } from '../types/index.ts';

/** 默认模型（Qwen 性能与成本均衡）。 */
export const DEFAULT_MODEL = 'qwen-plus';

/** 默认 OpenAI 兼容基地址（通义千问 DashScope 兼容模式）。 */
export const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

/** 默认采样温度。 */
export const DEFAULT_TEMPERATURE = 0.3;

/** 送入模型的最大字符数，超长文章在此边界截断。 */
export const MAX_INPUT_CHARS = 12000;

/** 默认设置（apiKey 为空，由用户在设置页或临时输入填充）。 */
export const DEFAULT_SETTINGS: AppSettings = {
  baseUrl: DEFAULT_BASE_URL,
  apiKey: '',
  model: DEFAULT_MODEL,
  temperature: DEFAULT_TEMPERATURE,
};

/** 翻译 System 提示词：规定输出格式、结构与图片保留规则。 */
export const TRANSLATE_SYSTEM_PROMPT = [
  '你是一名专业的英译中翻译工具。',
  '请将用户提供的英文 Markdown 文章翻译为简体中文，并严格遵守以下规则：',
  '1. 保留标题层级（ATX 风格 `#`）、列表、引用、代码块、表格结构；',
  '2. 图片 Markdown 语法 `![alt](src)` 必须原样保留，不得转成普通文本；',
  '3. 一级标题使用文章标题，作者与原文链接用引用块展示；',
  '4. 只输出翻译结果，不输出任何与文章无关的解释或说明。',
].join(' ');