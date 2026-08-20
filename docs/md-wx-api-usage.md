# md-wx

一个专为微信公众号优化的 Markdown 渲染组件库。

这是小册 [《玩转 Trae AI 编程》](https://s.juejin.cn/ds/amxtO6c07Wg/) 的实战项目。

## 特性

- 🎨 **多主题支持** - 内置 5 种精美主题
- 📱 **响应式设计** - 支持桌面和移动端预览
- 🎯 **微信优化** - 一键复制到微信公众号编辑器
- 💻 **代码高亮** - 支持多种编程语言的语法高亮
- ⚡ **实时预览** - 所见即所得的编辑体验
- 🔧 **高度可配置** - 灵活的组件配置选项

## 快速开始

### 安装

```bash
npm install md-wx
```

### 基本使用

```jsx
import React, { useState } from 'react'
import { MarkdownRenderer } from 'md-wx'
import 'md-wx/dist/style.css'

function App() {
  const [markdown, setMarkdown] = useState(`# 欢迎使用 md-wx

  这是一个专为微信公众号优化的 Markdown 渲染器。

  ## 特性

  - 支持多种主题
  - 响应式设计
  - 代码高亮

  \`\`\`javascript
  console.log('Hello, md-wx!');
  \`\`\`
  `)

  return (
    <div>
      <MarkdownRenderer 
        markdown={markdown}
        showSettings={true}
      />
    </div>
  )
}

export default App
```

### TypeScript 支持

md-wx 提供完整的 TypeScript 类型定义，支持强类型开发：

```typescript
import React, { useState } from 'react'
import { MarkdownRenderer, ThemeType, ViewMode } from 'md-wx'
import 'md-wx/dist/style.css'

interface AppProps {
  initialMarkdown?: string
}

const App: React.FC<AppProps> = ({ initialMarkdown = '' }) => {
  const [markdown, setMarkdown] = useState<string>(initialMarkdown)
  const [currentTheme, setCurrentTheme] = useState<ThemeType>('minimal')
  const [viewMode, setViewMode] = useState<ViewMode>('mobile')

  const handleThemeChange = (themeId: ThemeType) => {
    setCurrentTheme(themeId)
    console.log('主题已切换到:', themeId)
  }

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    console.log('视图模式已切换到:', mode)
  }

  const handleCopy = (success: boolean) => {
    if (success) {
      console.log('复制成功！')
    } else {
      console.error('复制失败')
    }
  }

  return (
    <MarkdownRenderer 
      markdown={markdown}
      theme={currentTheme}
      defaultViewMode={viewMode}
      onThemeChange={handleThemeChange}
      onViewModeChange={handleViewModeChange}
      onCopy={handleCopy}
      showSettings={true}
      enableCopy={true}
      enableThemeSwitch={true}
      enableViewModeToggle={true}
    />
  )
}

export default App
```

#### 主要类型定义

```typescript
// 主题类型
type ThemeType = 'minimal' | 'sakura' | 'forest' | 'ocean' | 'sunset'

// 视图模式类型
type ViewMode = 'mobile' | 'tablet' | 'desktop'

// 设备类型
type DeviceType = 'phone' | 'tablet' | 'desktop' | 'large-desktop'

// 组件 Props 类型
interface MarkdownRendererProps {
  markdown?: string
  theme?: ThemeType
  showSettings?: boolean
  followSystemTheme?: boolean
  defaultViewMode?: ViewMode
  enableCopy?: boolean
  enableThemeSwitch?: boolean
  enableViewModeToggle?: boolean
  config?: Partial<DefaultConfig>
  onThemeChange?: (themeId: ThemeType) => void
  onViewModeChange?: (mode: ViewMode) => void
  onCopy?: (success: boolean) => void
  className?: string
}
```

#### 使用 Hooks

```typescript
import { useTheme, useViewModeContext, useCopyToClipboard } from 'md-wx'

const MyComponent: React.FC = () => {
  // 主题相关
  const { themeId, setTheme, theme } = useTheme()
  
  // 视图模式相关
  const { currentMode, setViewMode, isMobileMode } = useViewModeContext()
  
  // 复制功能
  const { copyToClipboard, isCopying } = useCopyToClipboard()
  
  return (
    <div>
      <p>当前主题: {themeId}</p >
      <p>当前视图模式: {currentMode}</p >
      <p>是否为移动模式: {isMobileMode ? '是' : '否'}</p >
    </div>
  )
}
```

## API 文档

### MarkdownRenderer

主要的渲染组件。

#### Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| markdown | string | '' | Markdown 内容 |
| theme | string | 'minimal' | 主题名称 |
| showSettings | boolean | true | 是否显示设置面板 |
| followSystemTheme | boolean | true | 是否跟随系统主题 |
| defaultViewMode | string | 'mobile' | 默认视图模式 |
| enableCopy | boolean | true | 是否启用复制功能 |
| enableThemeSwitch | boolean | true | 是否启用主题切换 |
| enableViewModeToggle | boolean | true | 是否启用视图模式切换 |

### 可用主题

- `minimal`: 极简白（默认）
- `sakura`: 樱花粉
- `forest`: 森林绿
- `ocean`: 海洋蓝
- `sunset`: 日落橙

## 本地开发

如果你想参与开发或在本地测试组件，请参考 [本地开发指南](./LOCAL_DEVELOPMENT.md)。

## 许可证

MIT License