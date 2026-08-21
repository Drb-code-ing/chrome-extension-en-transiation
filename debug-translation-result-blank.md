# Translation result blank debugging

- Session: `translation-result-blank`
- Status: [OPEN]
- Symptom: 翻译完成状态正常显示，但译文内容区域为空白。
- Expected: 完成后渲染完整译文 Markdown。

## Hypotheses

1. `translateDone.fullText` 实际为空，`completedMarkdown` 因此被设置为空字符串。
2. `translateDone.fullText` 有内容，但完成事件后其他状态更新又清空了 `completedMarkdown`。
3. `MarkdownRenderer` 收到非空 Markdown，但内部主题或渲染过程输出为空。
4. Markdown 已生成 DOM，但 CSS 颜色、尺寸或定位导致内容不可见。

## Evidence

### Pre-fix

日志显示：

- `completedMarkdownLength: 0`
- `streamedTextLength: 5997`
- `previewTextLength: 0`
- `previewHtmlLength: 397`

结论：流式译文已完整到达前端，但完成分支没有把最终文本写入 `completedMarkdown`。MarkdownRenderer 收到空字符串，CSS 与渲染器不是根因。

- 假设 1：部分成立。最终展示数据为空，但不是模型无输出；流式文本已有 5997 字符。
- 假设 2：确认。完成态的 `completedMarkdown` 始终为空。
- 假设 3：排除。
- 假设 4：排除。

## Fix

在 `translateDone` 分支中用 `msg.fullText` 设置 `completedMarkdown`，再进入成功状态。
