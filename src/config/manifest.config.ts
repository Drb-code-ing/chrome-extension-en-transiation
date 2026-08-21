import { defineManifest } from '@crxjs/vite-plugin';

/**
 * Manifest V3 扩展配置（由 @crxjs/vite-plugin 生成最终 manifest.json）。
 */
export default defineManifest({
  manifest_version: 3,
  name: '网页翻译助手',
  description: '提取英文网页主要文章内容，并通过 AI 大模型翻译为中文',
  version: '0.1.0',
  action: {
    default_icon: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
  },
  icons: {
    '16': 'icons/icon16.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  side_panel: {
    default_path: 'src/panel/index.html',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  options_ui: {
    page: 'src/panel/options.html',
    open_in_tab: true,
  },
  permissions: ['activeTab', 'tabs', 'scripting', 'storage', 'downloads', 'sidePanel'],
  host_permissions: ['http://*/*', 'https://*/*', 'https://dashscope.aliyuncs.com/*'],
});