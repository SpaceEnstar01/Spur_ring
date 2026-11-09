# AgentMail 邮件智能体背景、已完成演示、历史卡点与源码位置——队友交接说明

整理日期：2026-11-04。资料来源：2026-10-31 开发记录、后续 ECS 部署记录，以及本次读取的当前源码。本次没有请求真实邮箱、发送邮件、读取密钥值或改变云端配置。

## 1. 先区分三件不同的东西

1. **真实 AgentMail 本地网页接入**：本交接的主体。已接真实收件箱、邮件读取、合作分析、回复草稿和确认回复接口。
2. **iOS Agent Workspace 邮件 UI 示例**：仅本地模拟审批／执行状态，不读取 AgentMail，也不真正发信。
3. **旧音频后端 SMTP 邮件**：用于把音频分析结果／报告发到指定收件人，不是合作收件箱，也不是 AgentMail 线程回复。

不能因为 iPhone 上有 Allow 按钮或“Email sent”示例，就说手机真实邮箱链路已打通。

## 2. 产品背景与当时目标

Spur 面向创作者，希望从商业合作来信中提取可行动信息：谁发来的、合作形式、预算、交付要求、时间、缺失条件、风险，以及建议如何回复。

首轮选择 AgentMail 专用邮箱，先通过 Creator Web 验证，不是 Gmail／Outlook 授权登录方案，也不是队友的 Java 邮件后端。

当时的目标流程：

```text
用户打开 Mac 本地 Creator Web
  → 查看专用收件箱／手动刷新
  → 选中一封来信，主动点击分析
  → Node 后端读取原邮件
  → 隔离 DSH 会话 + 配置的 SiliconFlow 模型
  → 中文合作分析 + 尚未发送的回复草稿
  → 用户修改主题／正文
  → 点击确认发送 + 第二次系统确认
  → 后端核对原来信，通过 AgentMail 在原线程回复
  → 记录发送结果
```

首轮核心是“读信 → 理解 → 草稿 → 人工确认”，不是自动后台收信和自动外发。

## 3. 当时实际完成的 Demo

### 真实邮箱读取

2026-10-31 记录表明：

- AgentMail 官方列出收件箱接口返回成功。
- 测试专用收件箱为 `spur01@agentmail.to`。
- 官方邮件读取接口、本地邮件列表接口均返回 HTTP 200。
- 读取过欢迎邮件，也读取并分析过一封主题为“商务合作”的真实来信。

### 模型分析

已对合作来信完成分析。内容覆盖：合作判断、发件方与品牌、形式、预算、交付、时间、追问项、风险及回复草稿。

该来信缺少可验证品牌、预算、交付和时间信息，模型建议先补充条件，不先报价格、不承诺档期或独家。该分析是对收到内容的判断，不等于核验了对方身份或合作真实性。

### 网页操作

已实现合作收件箱、配置状态、手动刷新、单封分析、编辑草稿、确认回复与发送反馈。

历史记录包含网页构建成功、后端语法检查及 7 项邮件单元测试通过。这些历史证据不等同于所有真实收发与多轮跟进已完成用户验收。

### 发送状态必须如实描述

回复接口确实具备真实发送能力，并有一次 AgentMail API 接受线程回复的历史记录。但是，那次外发发生在 2026-10-31 18:01:51（北京时间）的网页联调过程中，**没有取得用户对该邮件的明确发送授权，属于操作事故**。

它不能计为用户批准的业务发送验收；API 接受也不代表收件人最终收到或阅读。原始开发记录已保留事故说明，本交接不重复真实收件人的私人地址与邮件正文。

## 4. 当时卡点及如何解决

| 卡点 | 核对到的原因／状态 | 处理与剩余边界 |
|---|---|---|
| 本地 Node 请求 AgentMail 返回 CloudFront HTML 403 | 浏览器可访问，但后端 Node 20 未自动使用 Mac 系统代理 | 官方 API Explorer 验证凭据可用；使用系统代理及支持内建代理的 Node 后，接口返回 200 |
| 浏览器成功、后端失败，容易误判为 Key 错误 | 两者使用的出站网络路径不同 | 新增网页启动器读取代理配置并选择兼容 Node；不能将 Mac 代理地址直接照搬进 ECS |
| 不知道模型草稿能否稳定提取 | 自然语言报告不适合作为直接发送参数 | 加结构化草稿标记和解析器；提取失败不提供发送入口 |
| 邮件正文可能包含外部指令 | 来信不是用户授权 | 分析提示词按不可信资料处理，禁用研究路径、使用隔离会话；不将提示词约束夸大为全部工具的服务端强制权限沙箱 |
| 发送需要明确授权 | 曾发生未经明确批准的外发 | 当前网页增加草稿审阅与二次确认，后端检查确认标志及本机同源；事故不能掩盖为成功验收 |
| 重试可能重复发送 | 外部发送有副作用 | 同邮件编号的进程内发送占用检查、已发送文件记录；不是严格 exactly-once 保证 |

## 5. 现在接到硅谷 ECS／iOS 的具体缺口

### 缺口 A：部署记录中没有配置邮箱

最近已知的硅谷 ECS 健康输出是：

```json
{"status":"ready","model":"deepseek-ai/DeepSeek-V4.1-Flash","emailConfigured":false,"reasons":[]}
```

当时有意只复制模型相关配置，没有复制 AgentMail 凭据。`ready` 证明 Agent 主链路就绪，不证明邮箱已配置。

本次未登录 ECS 重新核验；上述是最近已知记录，不是此刻实时查询结果。

### 缺口 B：当前回复接口只允许 Mac 本机网页同源

`sameLocalOrigin` 明确要求 Origin 与 Host 相等，且 Host 是：

```text
127.0.0.1:4173
localhost:4173
```

当前源码对外部 `/api/creator-agent/*` 有 Bearer 检查，但 `/email/reply` 还会单独要求 `sameLocalOrigin`。

所以即使提供有效 Bearer，iPhone 经 `https://api.hispurring.com` 调用回复接口，仍不能直接通过这道本机限制。不能把“加域名、加 Token”当成发送功能已经迁云。

外层 Caddy 的认证也不能自动解决业务层的本机同源限制。改造前须核对实际镜像版本；本地最新源码不等于 ECS 已运行同一版本。

### 缺口 C：手机只有邮件展示示例，没有真实邮箱集成

当前 App 已接 Personal Agent 普通聊天／任务请求，但邮件示例没有接收件箱状态、列表、分析或真实回复接口。

### 缺口 D：长期后台工作尚未完成

未证明已接公网 Webhook、后台自动收信、事件去重、多轮线程持续跟进、云端调度或 iOS 主动推送。

### 缺口 E：发送可靠性与用户隔离

当前是单机验证方案：已发送编号落地到本地文件，以原邮件 ID 为键。它不能替代：

- 按用户／邮箱隔离的持久化状态；
- 对批准内容的版本、收件人与正文绑定；
- 外部发送幂等和发送后回执核对；
- 多副本并发和失败恢复。

若 AgentMail 已接受发送，而本地写记录之前进程崩溃，不能依赖当前文件机制保证绝不重复。代码还会把同一原邮件视为已回复，不等于已具备完整的多轮线程状态机。

## 6. 核心源码位置

仓库：`/Users/x/X/space/spur`。以下均为绝对路径。

| 文件 | 重点入口／职责 |
|---|---|
| `/Users/x/X/space/spur/V2/web/email/agentmail.mjs` | `agentMailConfig`、`normalizeMessage`、`getAgentMailInbox`、`listAgentMailMessages`、`getAgentMailMessage`、`emailAddressFromSender`、`replyToAgentMailMessage`；封装 AgentMail API |
| `/Users/x/X/space/spur/V2/web/email/reply-draft.mjs` | `extractEmailDraft`、`stripDraftMarker`；分离人类可读分析与可编辑草稿 |
| `/Users/x/X/space/spur/V2/web/server.mjs` | `makeEmailAnalysisPrompt` 约 300 行；`sameLocalOrigin` 约 316 行；邮箱路由约 370–449 行 |
| `/Users/x/X/space/spur/V2/web/src/App.tsx` | `refreshMailbox` 附近的列表读取、`analyzeEmail` 约 154 行、`sendEmailReply` 约 176 行；合作收件箱 UI 约 300 行以后 |
| `/Users/x/X/space/spur/V2/web/start.mjs` | Node 选择、系统／环境代理处理、启动 Node 服务 |
| `/Users/x/X/space/spur/V2/web/email/agentmail.test.mjs` | 7 项模块测试：配置、正文规范化、仅收到邮件、缺配置、单发件人、线程回复参数、结构化草稿 |
| `/Users/x/X/space/spur/V2/web/creator-agent-auth.mjs` | 当前源码的 Agent 对外访问凭据检查；不能绕过回复接口本机限制 |

运行数据位置：

- `/Users/x/X/space/spur/V2/web/.runtime/sent-email-replies.json`：已回复记录，属于本地运行数据。
- `/Users/x/X/space/spur/V2/web/.runtime/runs/email-*/`：分析运行记录。

运行目录可能含真实邮件内容，不应整体提交 Git、打进公开镜像或直接转给队友。

## 7. API 契约

| 方法与路径 | 输入 | 输出／行为 |
|---|---|---|
| `GET /api/creator-agent/email/status` | 无 | 配置状态、收件箱 ID、能力描述，不返回 Key |
| `GET /api/creator-agent/email/messages?limit=30` | 可选 limit，后端限制范围 | 近期收件列表；不是全邮箱历史扫描 |
| `POST /api/creator-agent/email/analyze` | `{ "messageId": "原邮件编号" }` | 分析正文、收件人、`draft: {subject,text}`、runId |
| `POST /api/creator-agent/email/reply` | `{ "messageId": "原邮件编号", "subject": "已审阅主题", "text": "已审阅正文", "confirm": true }` | 重新核对原来信，在原线程回复，记录发送结果；受本机同源限制 |

适配器当前使用的服务根地址：`https://api.agentmail.to/v0`。列表／详情／回复分别使用 inbox messages 相关接口，回复走 `/inboxes/{inboxId}/messages/{messageId}/reply`，不是随意创建新邮件。

`confirm: true` 是当前程序检查，不等于一套完整、不可伪造的业务授权协议。正式接入应将批准与具体用户、原邮件、收件人、草稿版本等绑定。

## 8. 配置与本地运行资料

需要的变量名：

```text
AGENTMAIL_API_KEY
AGENTMAIL_INBOX_ID
```

后端读取被忽略的 `V2/agent/config/siliconflow.env`，并以进程环境变量覆盖。模型分析还依赖可用 DSH 和模型配置。只告诉队友变量名和配置位置，不把真实 Key 贴在交接文档。

历史权限截图中的 Key 是 Full Access；是否已换成更小权限，本次没有核验。正式交接应限定到目标邮箱和必要读取／发送权限，并核对当前服务商权限规则。

网页工程脚本：

```text
npm run build → tsc -b && vite build
npm start     → node start.mjs
```

历史本地页面：`http://127.0.0.1:4173`。`npm start` 会实际启动服务，本次未执行。也不要为“验证一下”调用 reply 接口。

无真实发送的模块测试入口：

```bash
cd /Users/x/X/space/spur/V2/web
node --test email/agentmail.test.mjs
```

该测试使用模拟请求；本交接仅说明入口，没有重新运行测试，也没有把历史通过结果当作本次测试结果。

## 9. iOS UI 与旧 SMTP 的位置

### iOS 邮件示例

- `/Users/x/X/space/spur/V2/appV2/app_mobile/src/adaptive/Patterns.tsx`
  - `EmailApproval`：草稿审阅。
  - `ActionApproval`：Allow／Deny。
  - `RecoveryState`：失败恢复。
- `/Users/x/X/space/spur/V2/appV2/app_mobile/src/adaptive/WorkspaceExamples.tsx`
  - `TaskTransformation`：同任务从捕捉到审批、模拟成功／失败。
- `/Users/x/X/space/spur/V2/appV2/app_mobile/src/adaptive/examples.ts`
  - Jack 等虚构 Creator 示例数据。

这些组件只改本地交互状态，不代表 AgentMail 已接入手机。

### 旧 SMTP 报告邮件

- `/Users/x/X/space/spur/app/cloud/audio-agent/src/email.ts`
- `/Users/x/X/space/spur/V2/cloud/audio-agent/src/email.ts`

`sendAgentResultEmail` 是音频分析结果／报告的 SMTP 发送路径，不能与 AgentMail 收件箱和线程回复混用。

## 10. 建议队友按此顺序接续

1. 核对要复用的模块是 `V2/web/email`，而非 iOS 示例或旧 SMTP。
2. 先确认硅谷 ECS 运行的镜像版本、邮件模块是否在内、AgentMail 配置与网络是否可用；先做只读检查。
3. 定义 iPhone 身份、邮箱归属、草稿版本和批准凭证，改造本机同源回复限制；不能只删除保护。
4. 接通手机的只读收件箱和单封分析，再接草稿编辑与审阅。
5. 在明确授权的测试对象上验证一次真实回复，并核对 API 结果与实际投递证据。
6. 再做 Webhook、持续跟进、云端持久任务、推送和多用户隔离。

## 11. 给队友的一句话结论

**AgentMail 的真实收信、合作分析、草稿和线程回复代码已在 Mac 本地网页完成首轮接入；当前硅谷部署记录未配置邮箱，iOS 仍是展示示例，且回复接口还有本机同源限制。下一阶段是迁移与鉴权／审批／持久化改造，不是从零重写邮件 SDK，也不是已经拥有自动商务跟进系统。**

原始证据文档：`/Users/x/X/space/spur/V2/docs/AgentMail收件箱只读接入与验证记录-2026-10-31.md`。文件名保留“只读”，但正文已记录后续确认回复代码及外发事故，应阅读正文而非只凭标题判断。
