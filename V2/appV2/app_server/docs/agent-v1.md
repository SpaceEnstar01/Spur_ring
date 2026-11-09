# Spur Intent Runtime V1

按《Spur 意图识别与 Agent 执行规范 V1》分期落地：分类/来源追溯、基础 Matter/事件投影、有限工具执行链。无需 Python 服务；不是全功能自主助理。

## 职责

- Java `com.suprring.agent`：设备身份、结构化理解、证据校验、事项、记忆、授权、执行许可、回执与历史。
- APP：云端文字处理的明确同意、本机录音、Keychain 凭据/执行日志、三个状态投影、iOS AlarmKit 与结果核验。
- 硅基流动：只提出理解建议。API Key 继续只由 Java 环境读取；模型不能决定权限或编造执行结果。
- SQL：单设备一个持久聚合，行锁、版本校验，状态与事件原子提交。不是内存 Map，不依赖 Redis/向量库。

## 已实现

### 2026-10-26：知识提问与结构兼容修复

- 对「帮我介绍一下小米汽车」「解释一下电池原理」「小米汽车是什么」等保守匹配的单句知识提问，采用只读问答，不要求模型返回工具 JSON。多句、混合操作、闹钟、发送、付款、承诺、纠错等仍走完整意图/策略链，不因问答兼容跳过校验。不支持实时联网搜索、报价或信息核实。
- 答案保存在当前来源版本的 intent `summary` 中，`processingStatus=answered`，`interpretationVersion=knowledge-v1`，旧 APP 也能展示。不创建 Matter、交付任务、长期记忆或工具动作，重复同步不重复生成。失败仍需明确重试，不自动循环调用模型。
- 结构化路径允许单个完整外层 JSON 代码块，缺失或空白的可选引用字段归一为 `null`，已知 `alarm.create` / `alarm.cancel` 别名映射到内部枚举。分类、工具、原文片段、摘要、数值置信度、布尔澄清标志仍必填；不从字符串强制转换、不推测目标 ID 或授权。
- 原文证据、片段顺序/不重叠、候选 ID 范围、日期证据、租约与系统执行确认保持严格验证。重复 JSON 键、额外对象、未知字段/工具、伪造授权/只读路由标志均拒绝。
- 失败返回 `S01_SIZE`～`S18_OVERLAP` 等静态定位码；内部异常为 `S99_INTERNAL`。模型响应外层 JSON 解析与连接故障分别为 `UPSTREAM_JSON` / `UPSTREAM_CONNECTION`。日志仅输出固定码和异常类，不记录录音原文、模型完整内容、API Key 或异常消息。
- 需发布新版 Java 镜像后才在手机生效；协议保持 schemaVersion 1，无需新增资源或清理数据。部署后可对旧失败录音手动重试。代码/本地测试通过不等于线上发布完成。

Raw：同源录音按 `clientRecordId + revision` 保存原文、来源、原始时间/时区、可信时间标记、理解版本与证据；先持久化，再理解。不上传音频或邮箱，不覆盖旧转写。

Semantic：仅用户逐条确认后保留长期记忆，带来源、原文证据、置信度和确认时间。修正来源后标记 `needs_review`，不再作为模型上下文；支持移除和 API `supersedes` 替代。不把临时表达自动推断成长期偏好，不推断敏感属性。

Intent：idea/decision/commitment/instruction/correction + unknown；一条录音可拆分最多 12 项。Matter、事件、动作分开。决定更新内部方向，承诺保留方向与日期原文，不把猜测日期写成真实提醒。重分类/原文修正追加撤销事件并重建有效方向，不抹掉历史。

交付任务：commitment 提取逐字有据的 `counterparty`、`deliverable`、`direction`、`dateText`，保存独立、带版本的 `tasks`。日期仅采信有效 `YYYY-MM-DD` 或可信录制时间下的今天/明天/后天；周五等不猜。缺字段或存在其他歧义时进入 Needs you；用户可补充对象、内容、方向、日期，或明确暂不设日期。确认后进入内部待交付，支持取消、用户标记完成及完整字段修改历史。用户完成确认不等于邮件/文件交付回执，也不创建闹钟。模型日期不作权威来源。

纠错：模型可引用 owner 范围内的交付任务和当前有效决定；App 让用户选择具体目标和版本，再撤回任务、撤回决定或明确补充替代决定。撤回决定会恢复上一条未撤销方向，替代决定则成为新方向。关联未完成交付任务暂停；关联待执行动作撤回旧许可，已发到设备的动作进入待核对，不伪装撤销系统资源。旧方向、旧任务和来源保留历史。新决定替换旧决定时也保守暂停同事项的未完成交付任务，需用户复核恢复；不是模型自动判断所有排期冲突或生成重规划。

指令引用：有依据时关联内部交付任务，并注明“任务不是实际文件”。本版没有联系人目录/附件库/邮件发送器；称呼不是收件地址，脚本名不是文件。缺实际文件、联系方式、工具或权限时阻塞在 Needs you，不显示正在发送或已发送。

APP：Needs you / In motion / From your ring 是状态投影，不是互斥录音目录。可确认、纠正分类/关联、修改原文、查看版本、留存/移除长期记忆、管理动作。旧版已创建的本机闹钟仍可在 In motion 管理。

想法可由用户新建 emerging Matter 或关联已有事项，默认不创建执行任务。原文卡片显示关联 Matter、内部更新/待确认、交付对象和日期；交付任务显示来源与版本历史；决定可查看旧方向；纠错显示目标及变更历史。三处状态来自同一工作区数据，不用 LLM 回复猜进度。

## 执行边界

1. 模型 JSON 枚举/字段、置信度、连续且不重叠的原文证据、当前设备候选 ID 必须通过校验。`.85` 只表示理解较明确，不授予权限。低分/含糊内容先问用户。
2. 唯一实际工具是 `alarm.create` / `alarm.cancel`。需要 iOS 26；创建 Spur 的 AlarmKit 闹钟，**不写入苹果时钟 APP 列表**。邮件、付款等明确显示未接入。
3. 自动闹钟默认关闭，需用户预授权和系统许可。仅覆盖授权后、可信录制时间的新指令。含糊 AM/PM、周期闹钟、引用、否定、假设、DST 重叠/跳时、过期指令不自动执行。
4. 闹钟时间由确定性解析器按录制时间/时区计算，不采用模型猜测，不把戒指同步时间当录制时间。已有录音或原始时间不明的离线戒指录音要逐条选择分析，闹钟时间另行确认。
5. 改时间使用新动作 UUID；旧动作有过执行尝试时，先取消并核验旧闹钟不存在，再创建新闹钟。修改提议不会直接另建一个闹钟。
6. 设备领取 60 秒、带版本的许可，操作前再核对服务器。Keychain 执行日志未保存不调用系统。断线后补传回执；进程中断后只查询 OS，不盲目重放。取消、修正、撤权会使旧许可失效；迟到结果只审计，不覆盖更新状态。
7. 不能消除最后一次服务端核验与本机 OS 调用间的所有竞态，因此必须继续对账，不能宣称分布式原子执行。设备报告的系统结果也不是 Apple 服务端签名证明。
8. 创建成功 ≠ 已响铃 ≠ 已起床；系统中消失仅标记已结束或被移除。

APP 需前台联网才能分析、领取并执行新动作；已经创建的闹钟由 iOS 管理。没有静默后台建闹钟、无限轮询或无限自动重试的承诺。

## 身份与隐私

无需邮箱登录：注册生成 256-bit 随机 bearer，服务端只存 SHA-256 摘要。每个私有 handler 鉴权并按 owner 隔离；UUID/邮箱/APP 常量不是凭据。私有响应 `Cache-Control: no-store`。

APP 按服务地址隔离 Keychain 凭据，`AfterFirstUnlockThisDeviceOnly`。AsyncStorage 不保存 bearer/执行 token。更换服务地址不会把原身份发送给新地址。Keychain 可能在卸载后仍保留，因此不是“卸载即清除云数据”，也不是跨设备登录。

开启前明确同意上传转写与持久状态到 Java、文字到硅基流动。默认不整批上传历史；历史逐条提交。暂停停止新上传/执行并尝试撤销自动授权，**不会取消已有闹钟**。恢复时先撤销旧自动授权，自动闹钟需要重新开启。

删除云端录音会清除同源所有转写版本、关联记忆及内容摘要/证据；活动系统动作需先取消核验。保留最小去重/执行审计，避免删除后重建闹钟。本机音频/戒指原件继续由已有独立删除流程管理。

内测 bearer 不是强登录/硬件证明；公开注册和模型接口仍有滥用风险。必须保留现有 HTTPS、请求预算与费用限额，不能把 TestFlight 下载权限当作 API 鉴权。

## 本机启动

```sh
export SPUR_AGENT_ENABLED=true
export SPUR_AGENT_JDBC_URL='jdbc:h2:file:./.agent-data/spur'
export SPUR_AGENT_JDBC_USER=sa
# SILICONFLOW_API_KEY 继续从受保护环境读取，不写入代码或 Git。
mvn spring-boot:run
```

默认 `SPUR_AGENT_ENABLED=false`，无需数据库即可保留现有聊天/转写。启用却没有合格持久 JDBC URL 时启动失败，不回退到内存库。`jdbc:h2:mem:spur-test...` 仅供测试。

`GET /api/agent/capabilities` 返回 `enabled: true, schemaVersion: 1` 后新版 APP 才可开启；否则明确提示尚未部署，不假装生效。

## ACK 上线清单（本次未操作生产）

1. 构建发布新代码镜像。**不要重新应用 `deploy/kubernetes/internal.yaml`**，它是含旧镜像、未具备完整访问保护的烟测草稿。
2. 优先用已有 PostgreSQL/RDS，通过 Secret 注入 `SPUR_AGENT_JDBC_URL`、`SPUR_AGENT_JDBC_USER`、`SPUR_AGENT_JDBC_PASSWORD`；启用受信 TLS、最小权限、备份/恢复。首次初始化需要建表权限；后续应纳入正式迁移管理。
3. 若选择单副本 H2，必须先提供专用 PVC，挂载 `/var/lib/spur-agent` 并让 UID/GID 10001 可写，URL 为 `jdbc:h2:file:/var/lib/spur-agent/spur`。只能一个应用进程访问文件，使用 Recreate、备份及恢复演练。不能用容器可写层、emptyDir、流水线临时盘存业务数据。
4. 设 `SPUR_AGENT_ENABLED=true`；保留现有 `spur-api-runtime` 模型 Key，不把 Key 写入镜像或 Git。
5. 仅在当前 Spur HTTPS host 增加 `/api/agent/` Prefix 到 Spur Service，保留聊天路由。核对 guard、注册限额；不改共享 ALB/其他服务监听和路由。
6. 验收 capabilities、两设备数据隔离、数据库重启持久、明确指令、取消/改时间、断网回执恢复、源文修正与删除，再安装新版 APP 做实机授权和响铃验证。

## API

前缀 `/api/agent`，除 capabilities/devices 外均需设备 bearer。

| 路由 | 用途 |
| --- | --- |
| GET capabilities / POST devices | 功能发现 / 匿名设备身份 |
| GET workspace | 当前状态、来源、历史、记忆和动作 |
| POST records | 原文版本先落盘，再理解；同源同版本幂等 |
| POST records/{id}/retry、resolve、delete | 失败/中断恢复、人工分类与关联、同源内容删除 |
| POST records/{id}/remember、memories/{id}/forget | 显式确认/移除长期记忆 |
| POST records/{id}/matter | 为独立想法新建并关联 emerging Matter |
| POST tasks/{id}/update | 带 version 的 confirm / complete / cancel；完成为用户报告 |
| POST records/{id}/correct | intentId + targetKind(task/decision) + targetId + version；replacement 仅支持替代决定 |
| POST policy | 自动闹钟预授权与撤销 |
| POST actions/{id}/confirm、cancel、reschedule | 用户控制动作 |
| POST actions/{id}/claim、validate、receipt、observe | 设备许可、结果和 OS 缺失状态对账 |

## 当前限制与验证

这是小规模内测实现：直接 JDBC 连接、单工作区聚合、自动建表；非完整事件溯源平台。入库前阈值约为 300 录音、600 动作、5000 事件，删除保留去重历史并不释放全部容量。规模化前需补规范迁移、连接池、保留/归档、设备注销/凭据轮换与成本治理。

工作区 schemaVersion=1 新增 tasks 和可选意图字段，旧聚合反序列化默认空数组。不自动重跑历史录音或生成外部动作；旧版只保存事件的承诺可由用户重新确认分类后建立任务。模型输出契约新增四个必填 nullable 字段，旧结构不完整时原文保留并提示重试。

通用联系人/文件解析、复杂排期冲突、语义搜索、指标看板、邮件/支付/通知、多设备账号、云后台执行尚未实现。不能把规范所有未来阶段宣称为已交付。

验证：Java `mvn verify`；APP `npx tsc --noEmit`、`npm run lint`、`npm test -- --runInBand`；iOS Release 编译。自动测试使用模拟模型与系统结果，不发送真实录音/消耗模型额度；实机授权、真实响铃、生产数据库和公网链路另行验收。
