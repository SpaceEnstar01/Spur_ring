# DeepSeek Harness 与 nanoMuse 源码技术对比

## 范围与证据

对比本机 `V2/agent/runtime/deepseek-harness`（package.json 为 0.1.1-rc.2）和 `V2/agent/runtime/nanoMuse`（插件 1.0.9，本轮前检查提交为 14fc6aed）。nanoMuse 桌面插件依赖 dsh 0.2.0-rc.2，因此这不是相同版本运行时的性能对照。

本轮读取执行循环、工具调度、审批、持久化、调度器、记忆、Relay 和隔离实现。没有安装依赖、启动服务、调用付费模型或执行基准测试。下列优势和限制是源码结构判断，不是完成率、延迟或安全认证结论。

## 1. 执行架构

DeepSeek Harness 通过 Cordis 将 loop、tools、session、LLM 等能力组织为可替换服务和插件。Session 事件日志是模型上下文的重要事实来源，可以从日志重建请求，插件通过 pre-step、pre-execute 等扩展点介入。

优势：可替换底层策略，适合自定义工具治理、请求上下文和执行流程；事件边界适合排查与回放。代价：扩展需理解作用域、事件、插件注入和启动顺序，集成成本高于直接注册工具函数。

nanoMuse Python 的 app.py 是组合入口，agent/core.py 的 MuseAgent.run() 明确组装上下文、请求模型、执行工具、检测卡住并停止。优势是流程集中、便于沿调用栈理解；限制是修改执行循环通常需要修改组合入口或循环实现，扩展边界不如 Harness 的插件接缝细。

nanoMuse 桌面路径使用 DeepSeek Harness 和 nanoMuse 插件，不应把 Python 路径的限制直接套到桌面路径。

证据：deepseek-harness/docs/architecture.md；packages/core/agent-loop/src/agent.ts；nanoMuse/nanomuse/app.py；nanomuse/agent/core.py。

## 2. 工具并发和复杂编排

Harness 的 agent-loop/src/tool-calls.ts 实现有界并行池、独占工具屏障、顺序预检查与结果提交、取消后的收尾；另有 workflow worker-thread 和 subagent 接口。

nanoMuse Python 在单次模型响应的 response.tool_calls 上使用 for 循环，每个调用 await sentinel.guard()。同一批次工具默认串行；不同会话、后台任务和跨设备委派仍可并发，不能说整个系统单线程或没有多 Agent。

推论：多个互不依赖网页的抓取/读取有并行潜力时，Harness 的调度机制更有利；nanoMuse Python 容易累积串行等待。实际耗时还取决于连接器是否批量并行、模型轮次、网络及限流，未实测。

## 3. 审批与隔离

两边都有审批。Harness user-approval 提供请求、取消、审计和会话策略，无答复处理器默认拒绝；tools 提供执行前后拦截。sandbox-local 包含 Linux bwrap/Landlock、macOS Seatbelt 和 Windows ACL 的选择与探测路径。

nanoMuse Sentinel 包含工具风险评估、显式规则、授权范围、私有数据读取后的外发检查、凭据替换和审计。对个人邮件和设备任务已提供较完整的审批交互。

边界：Sentinel 的规则判断和工具 assess 并不等同于 OS 隔离。nanoMuse Python sandbox.py 对 Linux bubblewrap 进行探测；无可用隔离的环境（其说明包括 macOS、Windows 等）可能直接使用主机/容器作为边界，必须检查实际生效配置。此结论针对 Python 执行路径，不否认桌面 dsh 路径可以利用 dsh 隔离。两边的批准都不证明执行结果必然正确。

## 4. 会话与恢复

Harness 使用追加式 SessionEvent，支持 JSONL / SQLite 持久化和 write-behind/flush 协调。便于按事件追踪模型看到了什么、工具做了什么；有批写窗口，不能把尚未 flush 的内存事件当成已经持久化。

nanoMuse Python 使用消息列表，会话 JSON 通过临时文件加 os.replace 原子替换，配合审计及时间线持久化。基础流程更直接，但不是与 Harness 完全相同的统一事件投影模型。nanoMuse 桌面路径仍可使用 dsh 会话基础。

证据：packages/session/session-persistence/src/write-behind.ts；packages/session/session-persistence-sqlite/src/store.ts；nanomuse/agent/core.py 会话写入；nanomuse/server/service.py。

## 5. 持续任务

纠正前述过于概括的判断：Harness 已有 packages/schedule/schedule，提供 after、显式时区绝对时间和固定周期工具；状态进入会话日志，管理读写等待持久化屏障，交付是 session-local，并且依赖插件挂载、Agent 生命周期及运行进程。

nanoMuse 除提醒外还有 GoalStore、目标推进、后台 scheduler 和持久化 DeliveryOutbox。源码通过唯一 source_key 去重投递，并在完成前保留 pending，启动时可以恢复待处理交付。更接近持续的个人任务工作流。

nanoMuse outbox 是至少一次交付设计，不意味着外部副作用恰好一次：发送邮件后、标记任务完成前崩溃仍需连接器幂等和状态核对。两边进程停止都不能继续运行；需要常驻及恢复措施。

## 6. 个人记忆

nanoMuse 的 memory/store.py 已有 SQLite memories、变更记录及向量相关存储；embeddings.py 将可配置语义检索与关键词结果结合。使用 DeepSeek 时，语义向量能力还需单独的 embedding 来源，不能把模型名等同于向量检索可用。

本轮在独立 Harness 中未发现对等的用户个人记忆存储与整理模块；会话持久化及压缩不等同于跨会话个人记忆。Harness 可以通过插件接入外部记忆服务，但需自行定义事实来源、删除、检索和更新。

nanoMuse 的现成记忆能减少实现工作；记忆正确性和过期决策仍需业务验证，不自动等于 Spur 的承诺/项目状态。

## 7. 跨设备与服务扩展

nanoMuse hub、delegate、设备动作及审批回传已有实现，桌面 phone-approvals.ts 对接手机审批。优势是不用从零建设个人设备发现和控制通路；代价是依赖 Relay、设备在线、平台权限、同步与重连，Spur 要适配实际协议。

独立 Harness 有 SDK、API 和子 Agent 扩展接口，但本轮未发现对等的完整个人设备账号/发现/跨设备审批成套实现。能远程调用 API 不等同于已具备 nanoMuse 的跨设备产品协议。

nanoMuse Relay 的 db.py 使用 SQLite WAL、单连接锁。部署简单；高并发多租户横向扩容需要额外设计，源码存在不等于已经经过相应压测。Harness 本身同样不等于完整多租户 SaaS 后端。

## 8. 两个业务场景的技术选择

- 视频研究：Harness 在受控并行、工具可替换性、工作流编排和执行回放方面更适合构建专用研究流水线；nanoMuse 更快提供浏览器、记忆、交互和结果工作区。两者都需要真实数据连接器、指标口径、来源校验和研究技能。
- 商务邮件持续跟进：nanoMuse 已有目标、后台任务、记忆、邮箱工具与跨设备审批基础，首轮整合量较小；正式执行仍需限定授权、撤销、邮件线程匹配和发送幂等。Harness 也能做，但要将对应业务服务组合起来。

## 结论

Harness 的优势是执行底座的可组合性、受控并发、事件可追踪和隔离适配；弱项是个人 Agent 业务需要继续整合，配置及插件概念较多。

nanoMuse 的优势是个人任务、记忆、持续推进和跨设备交互已经连成实现；弱项是多语言多端维护面更大，Python 单轮工具串行、平台隔离有差异、Relay 扩展及外部动作幂等需要额外验证。

不能据源码断言哪个模型更聪明、哪个完成率更高或费用更低。比较 nanoMuse 桌面插件与普通 Harness 时，应固定相同 dsh 版本和模型后再做基准；Python 路径应作为另一项实验，不混淆测试对象。
