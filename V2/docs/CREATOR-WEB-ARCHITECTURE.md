# Spur Creator Web 架构与实施顺序

更新日期：2026-10-31

## 产品目标

先建设 Spur 自有的浏览器端对话产品，面向自媒体变现博主。用户通过一个熟悉的聊天界面提出目标，Agent 根据任务补查所需资料、展示来源和结果，并在发送邮件等外部动作前请求授权。用户不需要预先准备所有数据；缺少信息时由 Agent 识别并按需补查或询问。

## Harness 分工

- Spur 网页界面位于 `V2/web`，只负责对话输入、任务进度、来源、报告/脚本结果和审批回执，不保存模型密钥。
- DeepSeek Harness 是首要 Agent 执行层，负责会话、模型调用、工具选择、工具结果整理和交付。旅行视频研究工具属于 Spur 自己接入的能力。
- NanoMuse 能力按需集成，优先考虑可独立调用的记忆、后台任务、审批和跨设备服务。每个用户请求由一个主 Agent loop 负责，另一 Harness 能力通过明确的插件、MCP 或服务接口调用，避免两个 Agent loop 对同一请求重复规划和执行。
- 先接通聊天，再按创作者任务接入搜索、公开资料读取、脚本生成和商业合作流程。实时数据、字幕和第三方连接按需补充；没有证据的内容必须显示为未知。

## NanoMuse 源码边界

NanoMuse 仓库及其 Harness 插件标注 GPL-3.0-or-later。首轮在 Spur 页面和闭源业务代码中不直接复制 NanoMuse 源文件；优先通过独立进程、MCP 或稳定 API 使用所需能力，或依据该许可证另行决定分发方式。DeepSeek Harness 在其仓库中标注 MIT。

## 接口方向

网页通过同源 `POST /api/creator-agent/chat` 发送 `{ message, history }`。响应为 `{ response, sources?, artifacts? }`；后续流式进度和审批单独扩展。模型 API key 只在服务端读取。2026-11-03 增加 Personal Agent API 的单令牌 Bearer 鉴权：同源本机网页请求保留本地开发兼容，外部 `/api/creator-agent/*` 请求必须通过 `SPUR_CREATOR_AGENT_TOKEN` 校验；成果 URL 使用 30 天 HMAC 签名。V2 App 按服务地址隔离令牌，保存在 iOS Keychain / Android Keystore。该令牌仅适用于单用户内测；多用户公开服务仍需逐设备注册/撤销、会话隔离、限流、密钥管理和外部动作审批。

2026-10-31 已在 `V2/web/server.mjs` 加入本地 HTTP 服务：提供同源聊天、健康状态和报告下载端点。每轮调用 DeepSeek Harness 的 headless profile，使用 SiliconFlow 聊天模型，并把最近对话传作本轮上下文；只读的 Creator 视频研究工具通过 Harness tool plugin 加载。服务默认绑定 `127.0.0.1`，不是云端部署。

AgentMail 接入：`V2/web/email/agentmail.mjs` 通过后端 API Key 读取指定收件箱；网页可刷新来信，用户主动点击后才把单封邮件正文交给隔离的 Harness profile 做合作分析并起草回复。分析任务禁用 Creator research 工具，把邮件正文作为不可信输入。草稿可在网页修改；仅用户点击“确认并发送回复”并通过二次确认后，后端才会调用 AgentMail 在原线程回复原发件人。不会自动发送、标记已读或删除。发送请求限本机同源，已回复邮件编号本地留存以抑制重复发送。2026-10-31 已验证 AgentMail 官方读取与 Spur 本地读信；本轮新增发送流程尚未做真实外发验收。服务仍为手动刷新，不是 Webhook/实时后台接收。控制台截图显示当前 Key 为 Full Access；建议换成限制在该收件箱的 `inbox_read`、`message_read`、`message_send` Bearer Key。NanoMuse 未参与这一邮件链路，后续按需接入独立能力。详细过程见[AgentMail 接入记录](AgentMail收件箱只读接入与验证记录-2026-10-31.md)。

Playwright MCP 接入：上游克隆在 `V2/agent/runtime/mcp-servers/playwright-mcp`，由 `V2/agent/tools/playwright-browser/index.cjs` 通过 stdio 调用。网页主聊天 Harness 当前仅注册导航与快照两个只读工具，限制初始 HTTPS origin，并把调用来源写入每轮 `tool-events.jsonl`。已通过 DSH 网页请求读取 example.com 页面、拒绝本机地址，并读取 YouTube 巴黎旅行搜索结果页。单个视频页面及字幕、发布日期等后续资料尚未验证。详细过程见[Playwright MCP 接入记录](PlaywrightMCP接入DSH与公开网页读取验证记录-2026-10-31.md)。

## 里程碑

1. 已建立 Spur Creator 对话网页及本地响应式布局。
2. 已实现本地后端 API 并调用 DeepSeek Harness；每轮是新的 Harness 运行，对话上下文由前端传入，尚无服务端持久会话和流式输出。
3. 待通过网页完成真实创作者任务并验证来源与报告下载。
4. 已验证 AgentMail 收件箱读取与单封邮件分析；网页可生成、编辑待发送回复，并提供用户确认后在原线程回复的入口。实际发送和送达仍待用户确认后做一次真实验收。自动收信与 NanoMuse 的记忆、长期任务或跨设备能力后续再决定。
5. 完成账号与权限后再部署到云端。

本地验证（2026-10-31）：`npm run build` 成功；API 健康检查返回 `ready`；对 `POST /api/creator-agent/chat` 发起真实请求后收到 SiliconFlow `DeepSeek-V4.1-Flash` 的中文回复。AgentMail 官方读取端点与 Spur 本地状态、邮件列表 API 均返回成功，且最新“商务合作”来信已完成分析。邮件草稿编辑与确认回复入口已实现，真实发信/送达尚未验收。`creator_search` 仍可能因域名解析私网保护而返回 `Private address denied`；Playwright 已通过 DSH 网页链路读取 example.com 和 YouTube 巴黎旅行搜索结果页，单个视频页面及字幕资料尚未验证。服务仍为本机运行，云端部署和 NanoMuse 联动尚未验收。
