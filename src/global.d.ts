/**
 * 全局模块声明：turndown-plugin-gfm 未提供官方类型。
 * gfm 为 Turndown 插件函数，参数类型用 unknown 收窄，避免使用 any。
 */
declare module 'turndown-plugin-gfm' {
  export function gfm(turndownService: unknown): void;
}