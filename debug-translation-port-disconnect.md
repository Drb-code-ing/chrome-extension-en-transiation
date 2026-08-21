# 翻译端口意外断开调试记录

状态：[OPEN]
会话 ID：translation-port-disconnect
症状：正文提取成功后，翻译端口立即断开，界面显示“网络连接异常 / 翻译连接意外断开”。

## 假设

1. Service Worker 没有成功启动或启动时报错。
2. 后台加载设置或初始化 OpenAI 客户端时抛错，但错误未回传。
3. 自定义 API 地址未包含在 host_permissions 中，请求被扩展权限拦截。
4. React StrictMode 或弹窗生命周期清理主动断开端口。
5. 面板与后台的端口名或加载版本不一致。

## 证据

- pre-fix 日志 1/3/5：面板成功创建 `translate` 端口。
- pre-fix 日志 2/4/6：端口在 1–2ms 内断开，Chrome 报错 `Receiving end does not exist`。
- 后台 `onConnect` 日志为零，说明 Service Worker 未注册监听器。
- `dist/service-worker-loader.js` 导入 `assets/index.ts-DxDBJawj.js`，该文件实际包含 Readability 正文提取逻辑。
- 真正包含 OpenAI 后台逻辑的是另一个同名入口产物 `assets/index.ts-BPNdM5gq.js`。

## 结论

确认根因：`src/background/index.ts` 与 `src/content/index.ts` 同名，CRXJS/Vite 生成 Service Worker 加载器时发生入口名碰撞，错误加载 content bundle，导致翻译端口没有接收端。
