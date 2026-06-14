# 修复 Kimi 浏览器连接

## 背景

`.env.local` 中的 Moonshot 地址、密钥和模型均可从本机终端正常调用，但浏览器直接跨域请求 `api.moonshot.cn` 时被 CORS 策略拦截，只显示 `Failed to fetch`。

## 目标

- 本地开发时通过 Vite 同源代理访问 Moonshot API。
- 保持 `.env.local` 原有 Moonshot 地址配置可用。
- 将原始 `Failed to fetch` 转换为可诊断的中文错误提示。
- 补充 Provider 与代理路径测试。

## 阶段

- [x] 增加 Moonshot 本地开发代理
- [x] 改善 AI 网络错误提示并补充测试
- [x] 完成全量质量检查并推送合并
