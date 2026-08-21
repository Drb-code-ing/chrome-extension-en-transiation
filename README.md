# 网页翻译助手（chrome-extension-en-transiation）

一个 Chrome 浏览器插件：翻译英文网页文章，并用 Markdown 精美格式化展示。

## 功能

- 一键提取当前页面的主要文章正文（标题、作者、原文 URL、图片）。
- 调用 OpenAI 兼容接口（默认通义千问 DashScope）流式翻译为简体中文。
- 打字机式增量展示译文，`md-wx` 精美渲染 Markdown 结构。
- 最近一次成功翻译结果持久化，重新打开插件不丢失。
- 下载译文 / 原文 Markdown 文件，在浏览器新标签页打开原文。
- 独立设置页：模型地址、API Key、模型名、温度、主题与默认视图模式。

## 技术栈与约束

- Manifest V3 + React + TypeScript（strict）+ Vite（`@crxjs/vite-plugin`）。
- 单向依赖：`panel | background | content → shared`。
- API Key 仅存 `chrome.storage.local`，内容仅用于翻译。

## 安装与加载

1. 安装依赖：

   ```bash
   pnpm install
   ```

2. 构建：

   ```bash
   pnpm build
   ```

   （产物输出到 `dist/` 目录。）

3. 在 Chrome 中加载未打包扩展：

   - 打开 `chrome://extensions`；
   - 右上角开启「开发者模式」；
   - 点击「加载已解压的扩展程序」；
   - 选择本项目下的 `dist` 目录。

## 配置 API Key

- 点击插件弹窗右上角的齿轮图标打开设置页；
- 填写 OpenAI 兼容服务基地址（默认通义千问）与 API Key；
- 可选模型名、温度；
- 点击「测试连接」校验密钥与地址，再保存；
- 也可在主界面直接临时填写 API Key（仅当前会话）。注意：API Key 仅本地保存。

## 使用流程

1. 打开一篇英文文章（新闻/博客/技术文档）。
2. 点击浏览器工具栏插件图标，弹出主界面。
3. 点击「一键翻译当前文章」，译文流式展示。
4. 完成后可：
   - 下载译文 / 下载原文（Markdown）；点击「打开原文」在新标签页打开原网页；
   - 重新翻译或返回。
5. 翻译失败时界面显示对应错误提示，可返回重试；最近一次成功结果不会被覆盖。

## 隐私说明

- API Key、设置与最近一次结果均保存在浏览器本地（`chrome.storage.local`）。
- 翻译时仅将当前页面提取的标题、作者、链接与正文发送给你配置的翻译服务。
- 权限保持最小化：仅 `activeTab`、`scripting`、`storage`、`downloads`。

## 测试

```bash
pnpm test:extract     # 内容提取（T3）
pnpm test:translate   # 翻译链路 / 提示词组装 / 长度截断（T4+T9）
pnpm test:mdwx        # 打字机聚合与 md-wx 渲染（T5）
pnpm test:storage     # 最近结果持久化与失败不覆盖（T6+T9）
pnpm build            # 类型检查 + 生产构建
```

手动验收清单见 `docs/验收清单.md`。