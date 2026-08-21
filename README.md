# 网页翻译助手（chrome-extension-en-transiation）

一个运行在 Chrome 侧边栏中的网页翻译扩展：提取英文文章，通过 AI 流式翻译为中文，并以 Markdown 格式展示。

## 功能

- 点击工具栏扩展图标，在浏览器右侧打开全高 Side Panel。
- 一键提取当前页面正文，包括标题、作者、原文 URL 和图片。
- 调用 OpenAI 兼容接口（默认通义千问 DashScope）流式翻译为简体中文。
- 使用 `md-wx` 渲染 Markdown，长译文在侧边栏主体区域连续滚动。
- 最近一次成功结果持久化，关闭并重新打开侧边栏后仍可查看。
- 下载译文或原文 Markdown，并可在新标签页打开原文。
- 独立设置页支持服务地址、API Key、模型、温度、主题和视图模式。

## 技术栈

- Manifest V3、Chrome Side Panel API、React、TypeScript（strict）、Vite、`@crxjs/vite-plugin`。
- 单向依赖：`panel | background | content → shared`。
- API Key、设置和最近一次结果保存在 `chrome.storage.local`。

## 安装与加载

```bash
npm install
npm run build
```

构建产物位于 `dist/`。打开 `chrome://extensions`，启用“开发者模式”，选择“加载已解压的扩展程序”，然后选择项目的 `dist` 目录。

每次重新构建后，需要在扩展管理页点击“重新加载”；如果内容脚本发生变化，还应刷新待翻译网页。

## 配置 API Key

1. 点击工具栏扩展图标打开右侧侧边栏。
2. 点击侧边栏右上角的设置按钮，在独立标签页打开设置页。
3. 填写 OpenAI 兼容服务地址和 API Key，并选择模型及温度。
4. 点击“测试连接”，成功后保存设置。

也可以在主界面填写 API Key；保存后会写入浏览器本地设置，而不是上传到扩展自己的服务器。

## 使用流程

1. 打开一篇英文新闻、博客或技术文章。
2. 点击浏览器工具栏中的扩展图标，在右侧打开侧边栏。
3. 点击“一键翻译当前文章”。
4. 译文会随模型响应持续追加，可在翻译过程中继续浏览原网页。
5. 完成后可以下载译文、下载原文或在新标签页打开原文。
6. 关闭侧边栏后，再次点击扩展图标即可重新打开；最近一次成功结果会自动恢复。

翻译失败时会显示分类错误和重试入口，且不会覆盖最近一次成功结果。

## 权限与隐私

浏览器权限：

- `activeTab`：读取用户当前主动访问的标签页。
- `scripting`：在内容脚本尚未注入时补充注入正文提取脚本。
- `storage`：保存设置和最近一次成功结果。
- `downloads`：下载原文与译文 Markdown。
- `sidePanel`：在浏览器右侧承载主界面。

站点访问权限：

- `https://dashscope.aliyuncs.com/*`：调用默认 DashScope OpenAI 兼容服务。

翻译时仅将提取的标题、作者、链接和正文发送给用户配置的翻译服务。API Key、设置和最近结果只保存在浏览器本地。

## 测试

```bash
npm run test:extract
npm run test:translate
npm run test:mdwx
npm run test:storage
npm run build
```

手动验收清单见 `docs/验收清单.md`。
