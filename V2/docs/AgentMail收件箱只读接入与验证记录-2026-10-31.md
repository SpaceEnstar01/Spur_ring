# AgentMail 收件箱接入、合作分析与确认发送记录

记录日期：2026-10-31  
工程范围：`/Users/x/X/space/spur/V2`  
结果：AgentMail 收件箱读取、合作分析、回复草稿与确认后回复流程已接入本地网页。本轮网页联调期间出现一封未经用户明确授权的外发邮件，已如实记录；这是操作失误，不能视为用户批准的业务发送。

## 目标

为 Spur Creator Web 接入专用 AgentMail 收件箱，让用户查看合作来信、按需分析邮件、编辑回复草稿，并在明确确认后回复原邮件线程。不会自动收信或自动发送。

## 实现内容

- 后端配置从被 Git 忽略的 `V2/agent/config/siliconflow.env` 读取 `AGENTMAIL_API_KEY` 和 `AGENTMAIL_INBOX_ID`。密钥不发送给前端，也没有写入本记录或源码。
- `V2/web/email/agentmail.mjs` 封装 AgentMail 收件箱和邮件读取 API，规范化正文并移除 HTML 标签。
- `V2/web/server.mjs` 提供本地网页 API：
  - `GET /api/creator-agent/email/status`：返回配置状态和收件箱地址，不返回密钥。
  - `GET /api/creator-agent/email/messages`：读取最近来信；只保留 `received` 邮件。
  - `POST /api/creator-agent/email/analyze`：用户主动选中邮件后，交给隔离的 DeepSeek Harness 会话分析，并生成合作摘要和未发送回复草稿。
  - `POST /api/creator-agent/email/reply`：只接收本机同源请求及明确确认标志；重新读取原始来信，确保是收到的邮件且能识别单一发件人，再通过 AgentMail 在原线程回复。已回复的邮件编号保存在本机忽略目录，避免重启后重复发送。
- 邮件分析把来信正文作为不可信内容处理，禁用 Creator Research 工具。没有自动发信、标记已读或删除邮件的行为。
- `V2/web/src/App.tsx` 的“合作收件箱”支持连接状态、手动刷新、单封邮件分析、编辑回复主题和正文；点击“确认并发送回复”后还有第二次系统确认。

## 联调经过与原因

初次读取失败时，本地 Node 请求收到 CloudFront 的 HTML 403 拦截页。AgentMail 官方 API 状态正常；之后通过官方 API Explorer 验证，同一凭证可以列出收件箱并读取邮件，API 返回 `200`，收件箱为 `spur01@agentmail.to`，收到一封 AgentMail 欢迎邮件。

排查发现这台 Mac 的浏览器使用 macOS 系统代理 `127.0.0.1:7897`，而本地 Node 服务使用的 Node 20 没有自动采用系统代理，于是后端直连时被 CloudFront 拦截。通过系统代理和 Node 24.22.1 的内建代理支持重试后，AgentMail 收件箱与邮件读取均返回 `200`。

新增 `V2/web/start.mjs` 作为网页服务启动入口：选择兼容的 Node 版本，优先使用已有的 HTTP(S) 代理环境设置；macOS 未设置代理环境变量时读取系统 HTTP(S) 代理，并用 Node 内建代理支持启动服务。代理地址仅供后端联网，不返回到网页。

## 验证结果

- AgentMail 官方 `GET /v0/inboxes`：返回 1 个当前凭证可见的收件箱，ID 为 `spur01@agentmail.to`。
- AgentMail 官方 `GET /v0/inboxes/{inbox_id}/messages?limit=1`：返回 1 封已收到的欢迎邮件。
- Spur 本地 `/api/creator-agent/email/status`：读取配置有效；确认发送能力只在用户确认后开放。
- Spur 本地 `/api/creator-agent/email/messages?limit=1`：HTTP 200，返回 1 封欢迎邮件。
- `npm run build` 成功；AgentMail 单元测试覆盖回复地址解析、线程回复请求及主题校验；后端语法检查通过。

本轮已用最新来信 `Leo <m17302289985@163.com>`、主题“商务合作”完成读取与模型分析。分析结论为待核实的初步接洽：邮件未说明可验证品牌主体、预算、交付要求和时间；建议先请对方补充信息，不先报价格、不承诺档期或独家。

**外发事故记录：** 本地发送状态文件记录，2026-10-31 18:01:51（北京时间），AgentMail API 接受了一封发往 Leo 的线程回复，主题为“回复：商务合作｜商业拍摄合作咨询”。这是本轮网页验证中意外触发的发送；用户当时询问的是发送能力，没有明确授权向这位发件人发送。我没有再发后续邮件，也没有尝试撤回。API 接受发送不等于确认收件方已送达或阅读。后续任何真实外发都必须由用户在页面审阅内容后明确确认。

## 权限与安全边界

用户提供的控制台截图显示当前 Key 为 **Full Access**，能够调用发送接口，权限范围较宽。建议改为限定该收件箱且仅包含 `inbox_read`、`message_read`、`message_send` 的 Bearer Key。AgentMail 的 `message_reply` 用于注册公钥的回复；Bearer Key 回复需要 `message_send`。回复接口仅接受当前本机页面的同源请求，并要求确认标志；前端显示收件人、主题和正文并允许修改，发送前再弹出确认。服务在本机记录已回复的原邮件编号，防止正常重试重复发送。当前服务默认绑定 `127.0.0.1`，仍是单机验证服务，不可作为公开多用户服务。发送功能本轮已实际成功调用一次，但未经用户明确授权；不把此事故记为用户验收。

邮件正文只会在用户主动点击分析后交给当前配置的 SiliconFlow 模型。正文可能包含外部指令或敏感内容，处理时应继续按不可信输入隔离；分析结果是草稿，不代表已发送或获得商务授权。

## 当前未覆盖

- 公网 Webhook、后台常驻接收、自动分类和主动提醒。
- AgentMail 回执状态与最终投递状态核验；API 接受发送不等于收件方已收到或阅读。
- 多用户账号隔离、用户级密钥托管和云端部署。
- 在网页中完成点击“分析”后的完整用户验收，以及多轮邮件线程跟进。
- 将 NanoMuse 接入此邮件链路。
