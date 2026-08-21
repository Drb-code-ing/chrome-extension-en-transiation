# Debug Session: active-tab-detection
- **Status**: [OPEN]
- **Issue**: Side Panel 无法识别当前普通网页，并提示浏览器受限页面
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-active-tab-detection.ndjson

## Reproduction Steps
1. 在普通英文文章页面打开 Side Panel。
2. 点击“一键翻译当前文章”。
3. 页面提示当前页面属于浏览器受限页面。

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | 查询到的活动标签页是扩展页而非目标网页 | High | Low | Pending |
| B | 扩展重载后 activeTab 授权或标签信息失效 | Medium | Low | Pending |
| C | 当前网页本身属于 Chrome 禁止注入页面 | Medium | Low | Pending |
| D | UI 状态变化导致读取了过期或空标签上下文 | Low | Medium | Pending |

## Log Evidence
- pre-fix 日志 1-3：活动标签页 ID 和窗口 ID 存在，但 `url`、`pendingUrl`、`title` 均未返回。
- pre-fix 日志 4、6：空 URL 触发受限页面分支。
- Hypothesis A：Rejected，查询到的不是扩展页，而是存在有效 ID 的活动页面。
- Hypothesis B：Confirmed，Side Panel 场景下 `activeTab` 未提供标签页敏感字段访问权限。
- Hypothesis C：Rejected，失败发生在发送内容脚本消息之前。
- Hypothesis D：Rejected，初次查询和点击翻译时结果一致，不是过期 React 状态。

## Verification Conclusion
已在 Manifest 增加 `tabs` 权限。等待 post-fix 运行日志确认 URL 可见且不再进入受限页面分支。
