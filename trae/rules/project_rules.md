# 项目规则（Project Rules）

> 本文档面向在本项目中工作的 AI 助手，是开发时应遵循的高层指导原则。
> 依据：`docs/design.md`（技术架构设计）。实现细节以 `docs/design.md` 与 `docs/tasks.md` 为准。

## 1. 语言与框架

- **语言**：统一使用 **TypeScript**，开启 `strict` 模式；禁止 `any`（确需宽类型时用 `unknown` 并收窄）。
- **框架**：**React** 构建界面层。
- **构建工具**：**Vite** + TypeScript + React；扩展使用支持 Manifest V3 的脚手架（如 `@crxjs/vite-plugin`，WXT 为备选），content / background / panel 多入口分别打包。

## 2. 架构分层与依赖方向

插件按运行环境分三层，业务实现必须遵循：

- **内容脚本层（Content Script）**：仅负责从当前页面 DOM 提取文章并转 Markdown。**不得直接调用 AI 接口。**
- **后台层（Background）**：持有 AI 客户端配置，发起翻译并转发流式结果。**不得包含界面逻辑。**
- **界面层（Panel）**：React 界面、状态、渲染、持久化。**不得直接持有 AI 客户端与提取逻辑，统一通过消息协议交互。**

跨层共享的内容（类型、消息、存储、常量）放共享层，并遵守依赖方向：

- `panel → shared`；`background → shared`；`content → shared`。
- `shared` 不得反向依赖任何上层模块。
- 禁止跨层直连（界面层不得 import 内容脚本或后台内部实现）。

## 3. 代码风格

- 使用 **ESLint + Prettier** 统一风格；格式由 Prettier 强制，提交前必须通过。
- 异步一律使用 `async/await`，禁止回调嵌套；Promise 必须处理拒绝。
- 业务类型集中定义于 `shared/types`，跨层复用；函数与模块给出显式类型签名。
- 避免魔法数字/字符串，集中放于 `shared/constants`。
- 注释使用中文，用于解释"为什么"而非复述代码；逻辑自明处不加注释。
- 不保留调试输出；提交前清除 `console.log` 等，日志经统一工具输出。
- 边界处（消息解析、存储读写、AI 调用）必须做防御性校验并返回结构化错误（携带 `code` 与 `message`）。

### 命名规范

| 类别 | 规范 | 示例 |
|------|------|------|
| 文件/目录 | kebab-case | `article-extractor.ts` |
| 变量/函数 | camelCase | `extractArticle` |
| 组件/类/类型 | PascalCase | `MarkdownRenderer`、`Article` |
| 常量/枚举值 | UPPER_SNAKE_CASE | `DEFAULT_MODEL` |
| React Hook | `use` 前缀 | `useTypingEffect` |
| 类型命名 | 以 `Type`/`Payload`/`Result` 结尾 | `ExtractResult` |

## 4. 目录结构

遵循 `docs/design.md` §5 定义的目录结构，目录职责严格限定：

| 目录 | 允许内容 | 禁止内容 |
|------|----------|----------|
| `src/content` | 页面内提取逻辑，可读 DOM | 不直接调用 AI 接口 |
| `src/background` | 翻译调用、流式转发、消息路由 | 不包含界面逻辑 |
| `src/panel` | React 界面、状态、渲染 | 不包含提取与 AI 直连逻辑 |
| `src/shared` | 类型、消息协议、存储、常量 | 不包含业务实现 |
| `src/config` | 构建与运行配置 | 不包含业务代码 |

## 5. NPM 包管理

- 使用 **npm** 管理依赖，统一使用 `package-lock.json` 锁定版本。
- 依赖目的明确：核心依赖包括 React、md-wx、@mozilla/readability、turndown、turndown-plugin-gfm、openai、扩展脚手架。
- 新增依赖需说明用途与版本，避免引入无关依赖。
- 关键 import 需求：`md-wx` 的 `MarkdownRenderer` 组件与其样式文件；`mozilla/readability` 作为文章提取引擎。

## 6. 对外开放接口约定

- 所有跨层通信使用 Chrome 消息机制（请求-响应 + 事件推送）；消息类型与载荷结构集中定义于 `shared/messages`，作为单一事实来源。
- 存储统一经 `shared/storage` 封装读写 `chrome.storage.local`，键为 `lastResult` 与 `settings`。
- 翻译层基于 **OpenAI 兼容接口**（默认通义千问 Qwen / DashScope 兼容地址），模型、基地址、API Key 均从设置读取，禁止硬编码密钥。
- 消息协议、存储结构变更必须同步更新 `docs/design.md` 与类型定义。

## 7. 其他高层原则

- **最小权限与隐私**：只申请必需权限（`activeTab`、`scripting`、`storage` 与翻译服务域名）；API Key 仅存本地、不写日志、不发送到非配置地址；内容仅用于本次翻译。
- **单一职责**：每个模块只做一件事，功能复杂时拆分子模块。
- **最近结果**：仅翻译**成功完成后**写入 `lastResult` 并覆盖；进行中/失败不写入；不提供历史记录能力。

---

# AI 助手任务执行规范

为确保开发过程有序可控，AI 助手必须严格遵循以下任务执行规范：

## 任务范围控制

- **严格按照任务拆分执行**：必须严格按照 `docs/tasks.md` 中定义的任务范围执行，不得超出指定任务的边界。
- **单一任务原则**：每次只执行一个明确指定的任务（如"任务 T1"、"任务 T3"等），完成后等待用户确认再进行下一步。
- **禁止自动扩展**：不得基于技术架构文档或其他文档自行扩展任务范围；如需扩展，必须通知用户确认。

## 任务指令格式

用户应使用以下格式明确指定任务：

- **明确任务编号**："请执行任务 X.X：[任务名称]"
- **范围限制**："只完成任务 X.X 中列出的具体任务，不要超出范围"
- **停止指令**："完成后等待我确认再进行下一步"

## 执行验收标准

- **任务完成确认**：每个任务完成后，必须对照 `docs/tasks.md` 中的验收标准进行自检。
- **范围边界检查**：确保所有创建的文件和代码都在指定任务范围内。
- **等待用户确认**：任务完成后总结完成情况，等待用户确认后再进行下一个任务。

## 异常处理

- **任务描述不清晰**：如果任务描述不清晰，应先询问具体范围而不是自行决定。
- **依赖关系处理**：如果当前任务依赖其他未完成的任务，应明确指出依赖关系并等待用户指示。
- **超出范围的代码**：如果发现已创建超出任务范围的代码，应主动询问是否需要清理。