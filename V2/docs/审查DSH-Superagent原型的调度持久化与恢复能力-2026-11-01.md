# 审查 DSH Super-agent 原型的调度、持久化与恢复能力

记录日期：2026-11-01。

## 审查范围与结论

源码：`/Users/x/X/space/spur/V2/agent/runtime/dsh-superagent-prototype`。
审查提交：`6337fc823ce20251c8de8085948165c81aaa701e`。

本次仅静态阅读源码与文档，未安装依赖、启动服务、执行安装脚本或测试套件，未接入真实账号，未修改上游源码和现有网页服务。下述“已实现”表示存在对应实现，不等于已通过本地运行验证。

结论：值得作为 Spur 通用任务编排层的候选。它已经实现事务状态、事件路由、独立 Worker 会话、持久化副作用队列及部分故障恢复；不是开箱即用的通用 Personal Agent，也不是第二个独立 DSH 引擎。

README 明确标注：研究原型、非 DeepSeek 官方产品、非生产就绪；公开版本与内部版本及文章描述存在差异。当前产品是服务单个 GitHub 仓库的主动编程 Agent，飞书可选。

## 核心执行链

```text
Source 接收外部事件
  → Trigger 去重并归入 Thread
  → Gate 规则检查 + Assessment 模型判断
  → Decision / Mandate 记录决策与授权依据
  → Ticket 持久事务
  → Assignment 分配一次执行
  → DSH Worker 独立会话及工作目录
  → Report / Attention 汇报结果或请求人工处理
  → Outbox 持久发送队列，回复原渠道
```

Thread 与 Ticket 通过 Subscription 关联；后续消息可以进入已有事务，而不是每条消息重新创建任务。Ticket、Assignment、Worker Session 分离，使重试和重启不必丢失整个业务事务。

## 已实现与边界

| 能力 | 源码证据 | 当前边界 |
| --- | --- | --- |
| Router / Worker | `src/core/engine.ts`、`src/core/evals.ts`、`src/executor/dsh.ts` | 主会话评估事件，执行器管理独立 Worker；当前提示词、权限和工作目录准备面向编程任务 |
| 事件输入 | `src/sources/registry.ts` 及 GitHub、飞书适配器 | 有可扩展 Source 接口；未发现现成 AgentMail、Spur App 录音或网页聊天 Source，需适配 |
| 任务状态 | `src/core/model.ts`、`src/core/tickets.ts`、`src/core/assignments.ts` | 记录任务、执行轮次、进展、等待、就绪、阻塞和失败；这些状态不能直接等同 Spur 的意图分类 |
| 持久化 | `src/app/store.ts` | SQLite，WAL、synchronous=FULL；保存事件、事务、决策、Outbox、Effect 等。DSH 会话历史由另一套会话持久化服务保存 |
| 可靠副作用调度 | `src/app/effects.ts`、`src/app/outbox.ts` | 持久队列、退避重试及提交后执行；不能由此推导任意外部操作都严格只执行一次 |
| 并发控制 | `src/executor/dsh.ts` 中 WorkerSlots | 限制 Worker 数，为人工跟进保留额外容量；不等于分布式 Worker 集群 |
| 重启恢复 | `src/executor/dsh.ts:524`、`src/core/assignments.ts:83` | 对中断 Assignment 加恢复说明并重新推进；稳定等待状态保留会话。需要检查外部操作是否已经完成，不是恢复被杀进程的指令位置 |
| 网络错误重试 | `src/executor/dsh.ts:549` | 瞬时错误最多追加三次重试，15 秒起指数退避；工作目录准备失败不会盲目自动重试 |
| 后台任务回收 | `src/executor/dsh.ts:634`、`src/executor/background.ts` | Worker 回合结束后后台活动最多观察 30 分钟；超时处理 shell job，子 Agent 可继续。不是所有任务的总执行超时 |
| 通用 Watchdog | 未发现独立实现 | 有健康状态、超时、重试与回收，但未发现统一的无进展检测、语义死循环检测和所有卡死任务自动恢复机制 |

GitHub 回复在 `src/sources/github-channel.ts` 通过消息标记检查已有评论，减少重试重复发帖；这属于具体渠道的去重实现，不能直接当作任意邮件、支付或其他动作的幂等保证。

## 接入前的重要问题

1. **DSH 版本不匹配。** 原型 `package.json` 要求 DSH `^0.2.1-alpha.2`；现有 V2 和主工程的 DSH CLI 源码 `apps/cli/package.json` 均为 `0.1.1-rc.2`。源码版本检查不能证明当前运行产物版本，但足以说明不能假设直接兼容，后续须单独验证依赖与实际构建。
2. **它是插件，不是另一套完整 Harness。** `src/index.ts` 注入 DSH 会话、模型、工具、权限与 Web 服务等组件，`cordis.patch.yml` 挂载插件。所谓并行验证，应使用独立兼容的 DSH Host 和配置/状态目录，不将原型直接替换现有网页的 CLI。
3. **目录隔离不等于安全沙箱。** `src/infra/environment.ts` 明确说明 CLI 包装器只是默认路径防护。Worker 以操作系统用户权限运行，绝对路径可以绕过命令包装；上云、多用户、任意文件/命令执行需要单独设计容器、资源与凭据边界。
4. **Mandate 不等于每次外部发送审批。** 它表达来源规则与任务授权依据。Spur 邮件发送前确认、收件人和正文绑定、撤销等机制仍需保留，不能用原型默认的编程工具执行策略替代。
5. **不是完整云端基础设施。** SQLite 与状态目录锁适合单实例候选验证；锁的 30 秒 stale 配置不是业务 Watchdog。多实例竞争、故障转移、租户隔离、资源配额与备份恢复尚需额外设计和验收。
6. **定时扫描不等于提醒产品。** `src/app/passes.ts` 的两秒调度扫描用于内部事件评估和队列推进，不能据此宣称已具备日历、用户定时任务或长期提醒能力。

## 与 Spur 现有能力的组合方向

建议职责：Spur 管用户、意图、审批和结果展示；该原型候选承担事件与事务编排；DSH 提供模型执行循环；现有 MCP、网页研究、文件、媒体与邮件适配器提供执行能力。

当前网页已具备按请求调用 DSH 和多类工具的基础，但不能据此宣称已具备该原型的通用持久事务编排。NanoMuse 当前也未接入网页执行链，不能把它仓库中的记忆、后台任务能力算作 Spur 已交付能力。

最值得复用的是 `src/core` 的领域模型/接口，以及 `src/app` 的持久队列和恢复结构。GitHub/飞书 Source、Git 工作目录准备、编程提示词及 Worker 权限配置需要替换或适配，不能整包接入后就视为完成通用化。

## 下一阶段建议，尚未执行

先建立独立兼容版本的验证环境，不连接真实 GitHub、飞书、邮箱，不改现有网页。用 Mock Source、Mock Executor 验证：事件去重、两任务并发、同事务追加消息、人工等待/继续、停止/重试、进程重启恢复、待发送结果恢复。

核心状态验证通过后，再挑一个现有低风险研究工具接入真实 DSH Worker，验证端到端执行及来源记录。最后才决定迁移现有网页请求链、扩展 AgentMail Source 和后续云端部署；避免同时保留两个互相争抢状态和审批的规划循环。

本次没有运行测试；测试目录的存在仅说明上游提供测试源码，不代表在本机或 Spur 场景已通过。
