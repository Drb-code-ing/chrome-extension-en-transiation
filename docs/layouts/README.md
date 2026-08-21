# 页面规划与实现步骤总览

> 依据：`docs/proposal.md` 与 `docs/design.md`。本目录按页面记录布局和交互。

## 1. 页面划分

| 文件 | 页面 | 页面内模块 | 核心动作 |
|------|------|------------|----------|
| `主界面-页面.md` | Chrome Side Panel | 顶部栏、初始、最近结果、原文预览、翻译中、成功、失败 | 翻译、查看、下载 |
| `设置页-页面.md` | Options 独立标签页 | 模型配置、展示偏好、数据与关于 | 测试连接、保存设置、清理数据 |

## 2. 设计原则

- 主界面不使用 Action Popup，点击扩展图标直接打开浏览器右侧 Side Panel。
- Side Panel 使用全高单列布局，宽度由 Chrome 和用户拖动控制，最小内容宽度为 `320px`。
- 顶部栏固定，正文区域统一纵向滚动；长译文不使用嵌套固定高度容器。
- 每次仅展示一个主要状态模块，避免操作和信息堆叠。
- 下载操作只在成功结果中出现，分别提供原文和译文 Markdown。

## 3. 实现阶段

### 阶段 A：扩展骨架

1. 使用 Vite、React、TypeScript 和 Manifest V3 建立工程。
2. 配置 Side Panel UI、Options UI、Content Script 和 Background Service Worker 多入口。
3. 配置权限：`activeTab`、`scripting`、`storage`、`downloads`、`sidePanel`。
4. 配置默认翻译服务 Host 权限：`https://dashscope.aliyuncs.com/*`。
5. 后台调用 `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`，使工具栏图标打开侧边栏。

### 阶段 B：正文提取

1. 使用 Mozilla Readability 提取正文、标题和作者。
2. 使用 Turndown 与 GFM 将 HTML 转为 Markdown。
3. 处理图片绝对路径、懒加载图片和空正文错误。
4. Content Script 提供结构化正文提取消息接口。

### 阶段 C：翻译链路

1. Background Service Worker 接入 OpenAI 兼容客户端。
2. 组装保留 Markdown 结构、图片和元信息的翻译提示词。
3. 通过长连接转发流式增量、完成和错误消息。
4. 实现文章截断和认证、限流、网络、空响应错误映射。

### 阶段 D：侧边栏交互

1. 按 `主界面-页面.md` 实现全高 Side Panel 与状态模块。
2. 对增量 Markdown 节流后使用 `md-wx` 渲染。
3. 保存最近一次成功结果，失败不覆盖旧结果。
4. 实现下载 Markdown 和打开原文。
5. 按 `设置页-页面.md` 实现模型配置与展示偏好。

### 阶段 E：验证与收尾

1. 验证侧边栏入口、响应式宽度和长内容滚动。
2. 运行正文提取、翻译、渲染和存储测试。
3. 检查 Manifest 权限、隐私说明、构建产物和文档一致性。

## 4. 状态流转

```text
[无历史结果：初始] ──点击翻译──> [翻译中] ──完成──> [成功]
       ↑                              │
       └──────── 返回重试 <── [失败] <─┘

[存在历史结果：最近结果] ──翻译当前页面──> [翻译中]
[初始] ──预览原文──> [原文预览] ──返回──> [初始]
```
