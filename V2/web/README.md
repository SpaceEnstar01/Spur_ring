# Spur Creator Web

## 2026-11-07：Personal Agent Web 工作空间

本轮改为极简Home、Agent Workspace、任务历史、成果库，并保留Agent邮箱和视频任务。前端使用既有异步接口：POST `/api/creator-agent/chat`（async:true），再GET `/api/creator-agent/tasks/{id}`。不使用模拟进度或模拟成果。

推荐本地体验方式（依赖已安装时，无需重新npm install）：

```bash
# 终端一：既有后端，默认127.0.0.1:4173
cd /Users/x/X/space/spur/V2/web
npm start

# 终端二：前端开发入口
cd /Users/x/X/space/spur/V2/web
npm run dev
```

打开 `http://127.0.0.1:5174/`。Vite默认代理至本机4173，并仅对当前本机开发页面的同源请求适配后端既有Origin约定；不会为跨站请求补授权，也不附加公网Bearer。旧文档中开发后端8788的默认配置不再适用于这一默认代理。

`npm run build`用于TypeScript与生产构建；`node --test tests/task-api.test.mjs`验证异步任务、丢失回执不重发、鉴权拒绝、文件链接保留和后续任务上下文。任务历史仅将编号、需求、时间、状态和父任务编号保存在此浏览器，结果在打开原任务时查询，不是完整云端任务历史或跨设备同步。

公网Web会话授权仍需后续单独接续。本轮未把服务端Token或Connector密钥注入前端，未修改Node后端、ECS、Caddy、Docker或环境文件。下文是历史启动和能力说明，实时验证记录以V2/docs同日Web UI开发记录为准。

Spur 面向自媒体创作者的网页对话入口。聊天请求由本地 API 适配层调用 DeepSeek Harness，模型密钥只从 `V2/agent/config/siliconflow.env` 或当前进程环境读取。

## 本地启动

先构建前端，再启动同源网页和 API 服务：

```bash
cd /Users/x/X/space/spur/V2/web
npm install
npm run build
npm start
```

默认本机地址为 `http://127.0.0.1:4173/`。开发模式仍可使用 Vite；需要同时启动 `npm run dev` 和 `PORT=8788 npm start`。

`npm start` 会选择已安装的兼容 Node.js 版本；在 macOS 上会读取系统 HTTP(S) 代理设置，供后端访问 AgentMail 等外部 API。浏览器可通过系统代理联网、但 Node 未走代理时，AgentMail 的 CloudFront 网关可能返回 403。

## Agent 接入

网页不直接持有模型或邮件 API 密钥。后端逐条请求启动 DeepSeek Harness headless 会话，使用 SiliconFlow 的 `SPUR_CHAT_MODEL`；网页把最近对话作为上下文传入。Harness 可调用只读 Creator 视频研究工具，并将报告保存在 `V2/web/.runtime/runs/`。响应字段：`response` 为文本，`sources` 和 `artifacts` 为可选链接数组。

### AgentMail 本地收件箱与确认回复

在被忽略的 `V2/agent/config/siliconflow.env` 中添加以下两项，然后重启服务。不要把 Key 放入网页、聊天、命令历史或 Git。当前本机控制台显示 Key 为 Full Access；由于启用了用户确认后回复的功能，建议改用仅覆盖该收件箱、且只包含 `inbox_read`、`message_read`、`message_send` 的 Bearer Key。AgentMail 的 `message_reply` 权限仅用于注册公钥的回复方式，Bearer Key 回复需要 `message_send`：

```ini
AGENTMAIL_API_KEY=你的只读API密钥
AGENTMAIL_INBOX_ID=你的AgentMail收件箱地址
```

侧栏“合作收件箱”可刷新最近来信。选择单封邮件并点击分析后，后端才会把正文交给当前 SiliconFlow 模型生成合作摘要和未发送回复草稿。网页会提取并允许编辑回复主题和正文；只有用户点击“确认并发送回复”，并在系统确认框再次确认后，后端才会在原邮件线程中回复原发件人。服务只允许来自本机页面的确认请求，并在本地记录已发送邮件编号以防重复发送。仍不会自动发送、标记已读或删除邮件。分析运行的 Harness 会话文件保存在本机忽略目录 `V2/web/.runtime/runs/`。

当前采用人工刷新，便于先验证邮箱授权和内容解析；公网 Webhook/后台常驻收信、用户账号隔离和云端发送审批尚未实现。服务默认绑定 `127.0.0.1`，不是可公开部署的多用户服务。

运行要求：DeepSeek Harness 构建文件和依赖可用，并有 Node.js 22.19+ 或 24+。服务默认只绑定 `127.0.0.1`，最多并行处理两个请求，单次运行最长八分钟。它是本地验证后端，不是云端部署；公开服务前需增加登录、会话隔离、密钥托管、限流和审批。
