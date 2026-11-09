# Spur 项目上下文与新设备接续说明

整理日期：2026-10-26（Asia/Shanghai）  
工作区：`/Users/x/X/space/spur`  
用途：让新设备上的开发者与 Agent 恢复产品、工程与历史决策上下文。

**2026-10-28 接续更新：** 用户明确暂以旧版 `app/mobile` 为主。Node 20.20.2／npm 10.8.2 已安装，修正 Xcode Node 路径及 Pods Expo 生成脚本中的旧账户路径后，Xcode 27.1 的签名 Release 构建已返回 `BUILD SUCCEEDED`。未执行手机安装或业务验收。下文“找不到 Node”的检查属于 10-26 历史快照；最新安装位置与复现见 [Mac mini 编译记录](MAC_M4toM1/mac-mini-2026-10-28-build.md)。

**同日启动修复更新：** 上述首次构建之后，用户 Run 出现 iOS 27 的 NoSceneLifecycleAdoption 崩溃。经明确授权，已在 AppDelegate.mm／Info.plist 接入单窗口 Scene 生命周期，重新编译、覆盖安装到 eFLY 并启动；进程持续存活、设备未新增同应用崩溃报告，用户明确确认已显示 Agent Flow 首页。完整业务回归尚未进行，不能把首次“仅编译成功”与本次安装启动验证混同。

本文基于 `app/docs` 原有 68 个 Markdown 文件的内容梳理，并对导航、卡片存储、音频服务、办公任务、原生依赖及本机工具链做有限静态核对。逐文件分析见 [开发记录索引](DEVELOPMENT_RECORDS_INDEX.md)。没有进行手机、戒指、服务器或 App Store 的实时验收。

证据分为四种：**当前源码可见**、**历史记录已验证**、**产品规划／讨论**、**本轮环境检查**。文档中的成功记录不自动等于当前部署仍成功；源码存在也不等于功能已上线。

## 1. 项目是什么，以及现在聚焦什么

Spur 的整体方向是：通过随身戒指降低现实世界中的语音输入摩擦，让个人 Agent 理解用户正在推进的事情，并持续交付结果。戒指承担主动采集，App 承担理解回执、查看成果、补充条件与确认，后台承担上下文与执行。

历史叙事从“录音转写与会议纪要”，发展为“语音执行入口”，再收敛到“创作者的想法、选题、素材、脚本与持续修改”。产品文档中的通用个人助理愿景继续保留，但购物、订车、机票不应被当成当前已经完成的主交付。

当前最具体的业务验证对象是：同时推进多个内容选题、随时捕捉素材、需要持续产出脚本的创作者。核心价值要用素材找回、正确关联、脚本采用与修改耗时证明，不能只统计录音数或生成文件数。

主要依据：

- [产品目标与方向](product/Spur-产品目标与方向-精简版.md)：正文是整体愿景，末节明确当前创作者重点。
- [Harness 落地方案](product/Spur-Harness-投资人问题分析与落地方案.md)：2026-10-05，明确是方案与验证计划。
- [对话式执行助理定义](product/Spur-对话式个人执行助理-产品定义.md)：2026-10-03，目标交互，不代表当前导航已经切换。

### 本聊天最新对齐：个人意图状态

以下来自本聊天用户说明与已对齐内容，属于新增产品方向，不能冒充现有代码能力：

1. 原始事件记忆：保存用户实际说过的话、音频引用、时间与来源；推断另存。
2. Semantic memory：有依据的长期偏好、习惯与知识，服务个性化。
3. Personal intent state：持续维护用户想推进的事项、有效决定、承诺、任务、进度与授权。

同一条录音可影响多层。业务组织单位可采用 Matter；创作者选题 Topic 可以作为一种 Matter，具体数据迁移方案尚未实现或定稿。

五类核心表达为 `idea`、`decision`、`commitment`、`instruction`、`correction`。另外需要事实／进度更新通道：例如“我刚才把脚本发给摄影师了”应记录用户报告的交付事件，不能再次发送；“帮我把脚本发给摄影师”才是执行指令。

关键原则：想法不等于决定，决定不等于外部行动授权；纠错必须影响当前状态及相关未完成任务。一句录音可能有多个意图，不能只依赖时长或单标签。`Needs you / In motion / From your ring` 是本聊天材料中的目标状态视图，不是本轮确认已实现的首页。

## 2. 当前工程地图

| 位置 | 作用 | 本轮确认范围 |
| --- | --- | --- |
| `app/mobile/` | React Native／Expo 移动主工程 | 当前导航、服务、依赖与原生工程存在 |
| `app/mobile/android/` | Android 原生、厂商模块、AAR/JAR | 主线研强 SDK，历史闭环记录充分 |
| `app/mobile/ios/` | iOS 原生工程与 CocoaPods 配置 | workspace、Podfile 及兼容修复存在 |
| `app/mobile/native-sdk/` | RingSDK、AB_FOTA、iOS 桥接与转码 | 厂商二进制与桥接文件存在 |
| `app/cloud/audio-agent/` | Bun 音频接收、ASR、文本／图片处理 API | 路由与会议流水线源码可见 |
| `app/web/Recording-H5/` | 早期 H5 原型 | 保留为参考，不能代替移动主工程 |
| `agent/runtime/` | DeepSeek Harness 与 Spur profile | 上游运行底座与业务挂载面 |
| `agent/gateway/` | PDF/PPT 办公网关 | `server.mjs` 存在，默认端口 3081 |
| `agent/tools/` | PDF、PPTX 等执行能力 | 办公网关引用这些模块 |
| `agent/memory/` | 长期记忆方向 | 本轮目录枚举仅有 README |
| `agent/trajectory/` | 意图与执行轨迹方向 | 本轮目录枚举仅有 README |
| `agent/eval/` | 黄金集与回归方向 | 本轮目录枚举仅有 README |
| `desktop/` | Spur Buddy、旧 bridge、桌面记录 | 目录存在；本轮未做功能审计 |
| 根 `hardware/` | 顶层硬件占位 | 本轮仅见 `.gitkeep` |
| `app/docs/otherfiles/sdk/ring_sound_SDK/` | 另一套 NUS／Speex Python SDK 与协议 | 与研强移动主线分开理解 |

仓库根 README 已提到桌面 Spur Buddy；旧上传目标仍写 desktop 为空。`app/README.md` 中“iOS 尚是占位”“当前 Android 为主”等说法落后于实际工程。不要依据旧 README 再生成一遍 iOS 工程。

### 旧路径换算

| 历史路径片段 | 当前对应 |
| --- | --- |
| `claudeV2/app_front/app_yanqiang_voice/` | `app/mobile/` |
| `claudeV2/apps/audio-agent/` | `app/cloud/audio-agent/` |
| `claudeV2/app_front/Recording-H5/` | `app/web/Recording-H5/` |
| `claudeV2/apps/docs/` | `app/docs/`，部分子目录已重组 |
| `claudeV2/app_front/app_RN/` | 旧实验工程，不能机械替代为主工程 |
| `claudeV2/hardware/3_boardring/` | 当前主仓未见对应固件工程，不能假定已迁移 |
| `/Users/spur/...`、`/Users/zexuansun/...` | 旧机器账户路径；本工作区是 `/Users/x/X/space/spur` |

## 3. 产品与工程演进

| 阶段／时间 | 记录内容 | 接续时应怎样理解 |
| --- | --- | --- |
| 早期 H5 | 网页录音 → FFmpeg → 火山 ASR → Agent → HTML／邮件；ngrok 联调 | 证明音频入口与处理链路；固定收件人只是 Demo 配置 |
| 早期 SmartRing | BCL603 广播、ble-plx、PCM Notify、nRF52840 烧录 | 独立实验路径，不能套到 AIZO 上 |
| 2026-07-15 | 研强 Android 扫连、业务绑定、同步 OPUS、转 OGG、播放 | 有明确真机成功记录，是移动端硬件接入的重要基线 |
| 2026-07-16 | 长按／双击来源无法从研强公开回调可靠区分 | 工作状态不是手势事件，枚举存在不等于固件上报 |
| 2026-08-04 及后续 | iOS AuthSuccess 连接快照；后续修正同步为 M4A | 连接快照与最新转码说明要分开读 |
| 2026-08-09 | api.hispurring.com HTTPS 打通，实际 Nginx + Certbot | 之前 Caddy／Ubuntu 安装文档是方案，不是实际部署证据 |
| 2026-08-21／28 | 流式听写、结果改写、办公出件及详情 UI | 音频 Process 与文档任务是两条状态链 |
| 2026-09-12 | 上架构建移除 Laptop／Office／Button Debug 导航；手机计时闹钟 | 源码保留不代表入口对外开放；计时不是戒指独立闹钟 |
| 2026-09-13 | 原始转写 → 可读转写 → 腾讯会议体纪要 | 原文与润色结果必须分开 |
| 2026-09-20 | Spur Flow 纯软件语音输入、运营／融资清单 | Flow 是独立产品定义；清单为推断快照，不是实时业务台账 |
| 2026-10-03／05 | 对话式个人助理目标；创作者 Harness 收敛方案 | 目标状态与已完成能力分开 |
| 2026-10-16 | 合并首页为 Agent Flow | 当前源码已确认，旧双 Tab 图示为历史 |
| 2026-10-22／23 | 七年经营与融资情景规划 | 千万元种子资金、销量、营收、估值均为假设，不是已发生事实 |
| 本聊天 | 个人意图三层模型、五类意图、事实更新、Matter | 后续实现方向，尚未据此修改运行代码 |

## 4. 当前 App：以源码为准的事实

### 导航与处理分流

`app/mobile/src/navigation/AppNavigator.tsx` 当前将路由名 `MainTabs` 直接指向 `AgentFlowScreen`，没有旧的 Recordings／AI Assistant 双 Tab 容器。路由名保留不代表仍有 Tab。

仍注册：设备、我的、同步、纪要结果、转写。VoiceAgent 仅在 `__DEV__ && Platform.OS === 'ios'` 时注册。Laptop、CloudOffice、ButtonDebug 仍未注册。

`localAudioLibrary.ts` 仍有 `AGENT_THRESHOLD_MS = 30_000`。`localAgentCards.ts` 将普通本地录音合并进卡片流，用 `processingKind` 保留处理差异：长录音 `recording_summary`，短录音 `agent_command`。独立 VoiceAgent 会话音频通过 `isVoiceAgentOwnedFile` 排除。

因此要区分三件事：

- 首页是否分开：已经合并。
- 音频处理模式是否分开：仍然分开，当前阈值 30 秒。
- 语义意图是否识别：当前时长路由／关键词类别，不等于新的五类意图引擎。

### 本地数据与真实限制

`LocalAgentCard` 的类别是 `idea | report | action | note | alarm`，状态是 `pending | processing | completed | failed`，存于 `agent-cards.json`。它不是 Matter 状态模型。

历史会议结果来自 `recording-analysis.json`，有原始／可读转写、纪要等字段。当前卡片同步以现有音频文件为集合来源，文件消失可能使卡片从索引中消失；长期想法资产尚需独立生命周期。

`updateAgentCardResult` 更新当前输出，不能据此声称已有完整成果版本树。未来局部修改与纠错要有明确版本、来源与历史关系。

### 办公出件与闹钟

`officeJob.ts` 使用进程内 Map 管理任务，卡片 `office` 保存生成状态与进度。切换页面可继续；进程终止后不能靠这套 Map 自动恢复服务端工作。客户端取消调用会 abort 请求，但不证明云端计算已经取消。

音频卡片 Process 成败与 `card.office` 成败分开：办公任务失败不应把已完成转写卡片改成 Process 失败。详情用 Quick Look 打开本机文件的设计已有记录。

`alarmScheduler.ts` 使用手机 `setTimeout`，到点调用 `sendVibrationWithType`；需要 App 执行条件及 BLE 连接。历史演示为连震 20 次。不能称为设备离线、自主、系统级可靠闹钟。

## 5. 三套硬件资料不能混用

| 路径 | 传输与编码 | 适用范围 |
| --- | --- | --- |
| 研强 AIZO 主线 | Android 厂商 ServiceSdkCommandV2；iOS RingSDK；OPUS 文件 | 当前移动 App 已有验证基线 |
| 早期 SmartRing／BCL603 | ble-plx、自定义 UUID、`00 09 71...`、16 kHz PCM | 早期板级协议实验 |
| Ring Sound Python SDK 0.3.4 | NUS、v4 协议、11 字节头、Speex → WAV、IMU/HMM | 另套 SDK／固件资料；本轮未证明已接入移动主线 |

### 研强 Android 必须保留的知识

- SDK 初始化依赖 MMKV，厂商标识沿用验证配置；新 App 包名仍为 `com.spur.recordingring`。
- 本地 AAR 不能自动带齐所有传递依赖，三个 Realtek JAR 缺失会导致运行时缺类。
- 扫描停止与连接有时序要求，历史实现等待约 800ms 释放扫描资源。
- BLE 连上后仍需 `notifyBoundDevice`，以业务通道 `vendorReady` 为准。
- 工作状态：1 空闲、2 录音、3 暂停、4 待同步、5 同步中。允许同步为 1／4；等 4 自动回 1 可能死锁。
- 普通同步使用 `getVoiceRecordFile(false, callback)`；`true` 是 resumeOnly，不是“同步全部”。
- 文件传输 finish 后还要等待所有异步 Opus→OGG 转换结束。并发锁、generation、超时不能随意移除。
- 双击、长按曾均只出现 1→2→4；不能用工作状态反推出手势来源。

### 研强 iOS 必须保留的知识

- 使用 `bindDevice`／`bindDeviceWithPeripheral` 后等 RingSDK 的 `AuthSuccess(1)`；不要在 `BLEConnected(-2)` 后抢先手调 authorize。
- 鉴权事件与录音工作状态事件分开，避免自动同步误判。
- 最新同步说明为 SDK 写 `Documents/Audio/*.opus`，扫描待转码文件，解析 16 字节自定义头，经系统 AVAudioConverter 转为 `Documents/voice-recordings/*.m4a`。
- 不依赖 SingleSuccess 才收尾；AllSuccess／Empty 时也检查文件。进度只报进度，不写未完成文件。
- 旧连接文档末节仍写 Opus→OGG，应以专门的 iOS 同步文档与当前转码实现为准；禁止退回已知产出坏 OGG 的转换路径。

### NUS／Speex SDK 的独立约束

协议 magic 为 0x3F，头 11 字节，协议数值以大端为主，CRC 只覆盖 body；音频内层 Speex 长度前缀则是两字节小端。BLE 通知需重组后再解析。

录音保存后自动上报 0x0505 的路径不先发 0x0504；主动下载与自动接收不能并发消费同一队列。出现缺口后查询元数据并补传，不能把不完整字节当成功音频。`.bin` 不是 WAV，改扩展名不能完成解码。

设备启动默认录音模式；IMU 实时上报需要手势模式且成功开启上报。单击事件不保证模式一定已切换，也没有可随意假设存在的模式查询 API。原手册以 MAC 为连接入口；移植到 Mac／其他平台时应核对 Bleak 的实际设备标识，不能直接照抄 Windows 地址示例。

## 6. 云端架构与部署边界

```text
戒指 → 手机原生同步／转码 → 本地音频
                             ↓ POST /api/audio-task
                     HTTPS 反向代理
                             ↓
                     Bun audio-agent
                      ├─ 火山 ASR
                      ├─ 会议：可读转写 → 结构化纪要
                      └─ 短语音：文字／按意图生图

卡片详情的 PDF/PPT → /api/office → 办公网关 → 文件下载 → 本机预览
```

### 已在代码中确认

- 移动端默认 API 是 `https://api.hispurring.com`，可由 `EXPO_PUBLIC_AUDIO_AGENT_BASE_URL` 覆盖；Release 有 HTTPS 检查。
- audio-agent 的 `server.ts` 实际注册 `/api/audio-task`、`/api/chat`、`/api/recordings`、语音意图／润色／结果改写等路由。早期 Demo 规划中的每一个接口名不能自动视为已实现。
- `config.ts` 默认端口 **8787**、默认 STT **mock**；历史部署命令显式配置为 **18987 + volcengine**。不能直接启动默认值后声称进入真实 ASR。
- `FFMPEG_PATH` 默认 `/usr/local/bin/ffmpeg`，Apple Silicon 新机需核实实际位置。
- 文本走 OpenAI 兼容 Chat Completions，`DEEPSEEK_*` 是历史变量名，可能指 DeepSeek 官方或 SiliconFlow；只给官方 host 附加 `thinking` 字段。
- `meetingNotesPipeline.ts` 已存在，分别生成可读转写和纪要；语言按拉丁字母／汉字比例确定。原始转写保留。
- 生图使用独立 intent 判断和 images/generations；不能把所有短语音当生图。
- 办公网关 `server.mjs` 默认 3081，生成 PDF/PPTX，提供 `/office-files/`。profile 和 audio-agent 是两个配置面，不能假设改一个 `.env` 两者都生效。

### 历史部署事实与不确定性

历史服务器为香港阿里云 ECS、Alibaba Cloud Linux 8，工作目录 `/opt/audio-agent`。2026-08-09 实录使用 **Nginx + Certbot**，而早期安装建议写 Caddy／apt；后来的办公网关 README 又写 Caddy 转发。说明存在方案／部署版本差异，实际拓扑需登录服务器后核对，不能从某一份文档猜定。

旧启动方式是 nohup 加进程重启，systemd 在早期下一步中出现。本轮未核实线上服务管理方式。历史 18987 也不是当前公网开放端口的证明。

本机代码修改不会自动部署到线上；手机默认访问线上 API，也不会自动改用新 Mac mini 的 localhost。环境变量、模型可用性、域名健康、证书、密钥权限与部署版本均待独立验收。

## 7. 新 Mac mini 的实际状态

本轮只读检查结果：

| 项目 | 结果 |
| --- | --- |
| 架构 | arm64 |
| macOS | 27.0.1，Build 26A434 |
| Xcode | 27.1，Build 27A9275 |
| xcode-select | `/Applications/Xcode.app/Contents/Developer` |
| 当前 PATH | 未找到 node、npm、bun、pod、ffmpeg、adb；java 命令入口存在，未验证 JDK |
| 常见 Homebrew／Bun 位置 | 所检查的 `/opt/homebrew/bin/brew`、Node 20、pod、ffmpeg、Bun 位置均不存在 |
| `node_modules`／Pods | 目录存在，但不能认为拷贝依赖在新机有效 |
| `.xcode.env.local` | 仍指 `/opt/homebrew/opt/node@20/bin/node`，该文件路径本轮不存在 |
| 私密配置 | audio-agent 与 spur-profile 的 `.env` 文件存在；本轮未读取或验证值 |

旧迁移文档的已验证组合是 Node 20.x、CocoaPods 1.16.2、Xcode 26.2。当前 Xcode 27.1 与旧基线不同，应先按当前环境试验与记录兼容性，不能因为旧文档要求 26.2 就断言新版本一定不支持，也不应未经验证就升级全部依赖。

Podfile 中仍保留关闭 Explicit Modules 和修正 aggregate xcconfig modulemap 路径的处理。现有原生定制较多，恢复环境时不要直接运行 clean prebuild 重建整个 iOS 工程。

### Git 工作区必须先辨别

本轮写入本文之前，状态统计有 8,505 条修改、13 条删除、39 条未跟踪记录。抽查 README 的差异只有 100644→100755 权限变化，而 `server.ts`、`package.json` 也包含真实内容修改。因此既不能把全部状态当作本轮改动，也不能认定全部都是迁移噪音。

本轮没有清理、恢复、提交、推送这些已有改动。下一次涉及 Git 操作时应针对目标文件检查内容与 mode，保留未跟踪源码，禁止用整仓 reset／clean 解决迁移问题。统计是当时快照，新增本报告后的数字会变化。

## 8. 当前能力与缺口

| 能力 | 结论 |
| --- | --- |
| Android AIZO 同步、播放、云端处理 | 有历史真机成功记录；本轮未复测 |
| iOS AIZO 鉴权、同步、M4A 播放 | 有历史成功记录与对应实现；本轮未复测 |
| Agent Flow 统一首页 | 当前导航与卡片代码支持 |
| 可读转写、会议纪要 | 流水线与展示组件存在；线上版本待验收 |
| 图文／PDF／PPT | 有实现和历史演示；格式质量、线上连通待验收 |
| 手机计时让戒指震动 | 有实现；受手机进程、BLE、后台条件限制 |
| 通用跨 App／订票购物 | 产品愿景与可接入能力描述，未在本轮证明完整闭环 |
| Topic／Matter 持续状态 | 已有方案，未在本轮确认完整业务实现 |
| 五类意图＋事实更新 | 本聊天对齐方向；不能与现有卡片关键词分类混同 |
| Semantic memory／事件账本／黄金集 | 顶层对应目录仅 README；不排除其他目录有局部能力，但没有完整闭环证据 |
| 长期任务断线恢复 | 方案要求明确；现有办公进程 Map 不能满足完整要求 |
| 成果版本及纠错传播 | 产品要求明确；当前输出更新不等于版本系统 |
| 上架通过、量产、PMF、融资到账 | 本轮均无实时证明 |

## 9. 需要显式保留的冲突与过时点

| 问题 | 接续结论 |
| --- | --- |
| 健康／洞察／录音／小龙虾四页 | 历史设计，不能重新变成当前产品导航 |
| 15 秒与 30 秒 | 早期 15 秒，当前代码为 30 秒；无论哪个都不是语义授权判断 |
| 双 Tab 与统一 Flow | 10-16 更新＋源码支持统一 Flow |
| 对话中心与 Flow 首页 | 前者为目标交互，后者为当前实现；切换需要专门产品／代码任务 |
| Spur Flow 与 Agent Flow | 前者纯软件听写产品，后者当前卡片页／创作流程，名字相近但范围不同 |
| iOS“尚未接入 RingSDK” | 早期文档；后续已打通，不应从头重复接入 |
| iOS OGG 与 M4A | 最新同步专文采用 M4A，不退回坏 OGG 路径 |
| 固定收件人／自动邮件 | 早期 Demo 能力，不是所有未来邮件的默认授权 |
| Caddy、Nginx、apt、dnf | 方案与实录不同；服务器现态待核实 |
| 隐私邮箱与发布网址 | 政策正文和交接文档邮箱不一致，不能推定已上线／已收信 |
| 审核移除入口“通过后恢复” | 这是历史建议，不是自动执行的任务；未来发布需保证用户与审核可见能力一致 |
| 公司／融资进度与七年规划 | 旧周报是推断快照；后续千万元方案与旧约两千万元口径不能拼成已定融资 |
| AdventureX 样本 19／20 | 全量报告补了 InspireFlow，旧汇报／摘要仍为 19；外部详情抓取 0/20，不能称完整核验 |

## 10. 建议的恢复与开发顺序

以下是分析后的建议，不代表本轮已执行：

1. **恢复可复现环境。** 安装或定位可用 Node、npm、Bun、CocoaPods、FFmpeg；确认 Xcode 27.1 兼容，修正本机 Node 路径，确认签名与真机。
2. **恢复最小业务基线。** 从当前源码编译 Release，验证启动、AIZO 扫连鉴权、录音同步、播放；再验证线上转写与卡片处理。分别记录本机、手机、服务器版本。
3. **查清部署。** 核实实际反代、18987／3081 路由、环境配置与健康；不为本地编译无故重启生产。
4. **落地意图状态。** 统一 Capture ID、来源与事件；建立 Matter／Topic，区分 idea、decision、commitment、instruction、correction、事实更新；模型输出结构化提议，程序校验状态变更。
5. **接续执行。** 将任务、授权、外部事件、取消、重试与结果证据持久化；状态变化可使旧任务失效，外部动作重试前先核实结果。
6. **验证创作者价值。** 并行相似选题、归属纠正、脚本局部修改与版本；以误归档、重复解释、改稿耗时、采用及每周实际推进事项衡量。

用户最初提出的意图规范 MD 可在这份项目上下文之上另行定稿；本文的职责是项目全貌与工程接续，不把尚未编写的完整 Prompt／Schema 规范标记为已交付。

## 11. 持续维护方式

每次完成重要开发，更新对应原始记录与本文件的“当前能力／缺口”，保留日期、源码入口与验证条件。不要把整个历史记录合成一份没有来源的摘要后覆盖原文件。

新聊天先读本文，再按 [逐文件索引](DEVELOPMENT_RECORDS_INDEX.md) 查目标领域，最后核对当前源码。这样恢复的是可审查的项目上下文，而不是依赖某台电脑上不可见的聊天记忆。
