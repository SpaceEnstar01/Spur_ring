# Spur 开发记录逐文件分析索引

整理日期：2026-10-26。范围是整理前 `app/docs` 下递归发现的 **68 个 `.md` 文件，544,438 字节**，包括 SDK 子目录与一个空文件；不包含本轮新建的项目上下文和本索引。不将 PDF、PPTX、ZIP、图片或代码备份混称为已完成全文审查。

分析按内容与章节结构建立覆盖，重点技术链路结合当前源码复核。大型商业／研究材料按章节归纳；本索引不重新核验其中引用的全部外部统计、法规、产品规格或财务假设。文件修改时间不是决策时间，优先采用正文日期与后续明确修订。

状态标记含义：**基线**＝有历史成功记录；**现状**＝本轮代码核对支持；**历史**＝理解演进或旧流程；**规划**＝目标、草案或情景；**参考**＝研究／SDK／对外材料；**待核**＝需要实时环境或业务确认。多个标记可同时成立。

项目总览与冲突表见 [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)。以下每个原始文件都有独立条目，原文件保持不动。

## 1. 根目录文件（8）

| 文件 | 分析与接续用途 |
| --- | --- |
| [o_owncode.md](o_owncode.md) | **空文件**，0 字节，没有可恢复的开发内容。不能当作代码权属或工程说明的证据。 |
| [Audio Agent 工程实现总结](audio火山引擎H5语音转写-agent-implementation-summary.md) | **历史／基线**。还原从 mock 到真实 ASR、FFmpeg、公网音频、主 Agent 子进程、HTML 报告、SMTP 的全过程。适合理解音频服务缘起；旧 claudeV2 路径、固定收件人与子进程启动方式不能直接用作当前生产规范。 |
| [Web Recording 启动指南](audio火山引擎H5语音转写-agent-web-recording-startup-guide.md) | **历史**。本地 Bun＋ngrok 双终端联调，公网 URL 是文件 ASR 拉取音频的条件；不是现在所有手机功能都必须运行 ngrok。旧杀端口与硬编码凭据建议不自动执行。 |
| [最短执行指令](最短执行指令.md) | **历史／参考**。前述双终端流程的精简版，路径已部分更新，密码用占位符。用作本地音频 Demo 启动模板，端口、STT、公开地址仍需显式配置。 |
| [安全推送 GitHub](Recording Ring AI工程安全推送GitHub命令.md) | **历史**。记录从 claudeV2 抽离到 Recording_ring 私仓的发布过程，强调保留源码／SDK、排除密钥／运行数据。仓库名与路径早于 Spur_ring 主仓；不能照抄重新 git init 或整仓 git add。 |
| [PCM 转换指令](戒指PCM音频转换指令.md) | **历史／参考**。特定旧 PCM 样本用 s16le、8 kHz、mono。与 SmartRing 联调的 16 kHz、研强 OPUS 和新 SDK Speex 不同；转换参数应来自实际音频来源。 |
| [录音戒指 APP 四大页面设计](录音戒指APP四大页面设计.md) | **历史规划**。健康／AI 洞察／录音／小龙虾四分法体现最早功能划分。后续产品不再以健康为核心，当前导航也不是四页，不能据此补回旧页。 |
| [智见 AI 未来整理](智见AI未来-核心观点与关键词整理.md) | **参考**。覆盖模型基础设施化、Harness、真实轨迹、输入摩擦、AI 加硬件、工作流与组织。解释 Spur 叙事的思想来源；是对外部报告的整理，不是 Spur 已实现系统能力或市场数据。 |

## 2. MAC_M4toM1（2）

| 文件 | 分析与接续用途 |
| --- | --- |
| [m4-to-m1-repro-guide.md](MAC_M4toM1/m4-to-m1-repro-guide.md) | **基线／参考**。迁移清单：源码、厂商 SDK、Node 20、Pods、workspace、签名、真机与 Release。最有价值的是本机绝对路径和签名不随拷贝生效；旧 Xcode 版本为验证组合，不能推断当前 27.1 必然不兼容。 |
| [M1 打通实战记录](MAC_M4toM1/m1-打通实战记录.md) | **基线**。记录 M1 8GB Release 安装启动；定位 Xcode Explicit Modules 提前扫描 modulemap，修复已落入 Podfile。Homebrew 镜像、系统升级、卸旧 Team 包是当时处理，不应在新机自动照做。BLE 冒烟在该文仍待人工验收。 |

## 3. Android（7，原目录名为 andriod_app）

| 文件 | 分析与接续用途 |
| --- | --- |
| [Android Studio 使用方法](andriod_app/Android%20Studio运行RN%20App使用方法.md) | **历史**。旧 app_RN 壳、Gradle Sync、NDK、Metro、GUI Node 环境问题。适合理解开发包，不是当前主路径清单。 |
| [真机调试最短指令](andriod_app/Android真机调试APP最短指令.md) | **历史**。Metro 8081＋ADB reverse；旧工程路径须换，原生模块变更必须另行构建。 |
| [真机调试链路逻辑](andriod_app/Android真机调试链路执行逻辑.md) | **参考**。清楚区分 Android Studio 安装原生壳、Metro 提供 JS、ADB USB 转发三个职责；有助于定位“装不上”与“加载不到 JS”的不同问题。 |
| [SmartRing 联调协议](andriod_app/SmartRing录音功能APP联调协议.md) | **历史硬件参考**。自定义 bae8／旧 1000 UUID，00 09 71 启停，Notify offset 10、16 kHz PCM；包括采集周期、校时、电量、HID 等附录及字节序不一致提醒。不是研强 AIZO 文件同步协议，也不是 NUS v4。 |
| [双 Prompt 设计](andriod_app/录音会议与短语音智能体双Prompt设计.md) | **历史／设计基础**。区别会议纪要与短命令输出，App 传 taskType、云端持有 Prompt。15 秒路由已过时，短语音“立即完成”策略不能代替五类语义意图与授权判断；语言规则也被后续会议流水线细化。 |
| [Android 构建安装指令](andriod_app/录音戒指Android应用构建安装与手机启动指令.md) | **基线／路径历史**。TypeScript→Release APK→ADB 覆盖安装→启动，可脱离 Metro。当前应在 app/mobile 操作，不能据此认定发行签名已配置完成。 |
| [成功连接蓝牙复盘](andriod_app/成功APP连接蓝牙复盘.md) | **历史基线**。BCL603 广播与 SmartRingBleSdk／Transport／ble-plx 对齐，证明扫描和连接，不证明当时 PCM 数据闭环。与厂商 SDK 路径严格分开。 |

## 4. 研强记录（7，实际归档于 PPT/yanqiang_recordring）

| 文件 | 分析与接续用途 |
| --- | --- |
| [SDK 扫描连接打通](PPT/yanqiang_recordring/研强SDK与录音戒指初始化扫描连接打通记录.md) | **基线**。2026-07-15：MMKV 初始化、AAR＋Realtek JAR、厂商身份参数、原生模块注册、权限、停扫后连接、1001 绑定故障。该文件只证明扫连；同步闭环另见后续专文。 |
| [录音同步播放完整闭环](PPT/yanqiang_recordring/研强录音戒指App录音同步播放完整闭环记录.md) | **核心基线**。notifyBoundDevice→vendorReady；state 1／4 同步；getVoiceRecordFile(false)；OPUS→OGG、fileReady、expo-av。记录锁恢复、generation、180s 超时与等待全部转换的重要性。 |
| [工作状态定义](PPT/yanqiang_recordring/研强厂商录音工作状态定义.md) | **核心协议依据**。state 4 是已有文件等待 App 上传，不是收尾；1／4 可同步，2／3／5 禁止。后续改自动同步必须保留该语义。 |
| [按键手势调试记录](PPT/yanqiang_recordring/研强录音戒指按键手势区分调试记录.md) | **基线／未解决项**。2026-07-16 实测长按与双击只有相同录音工作状态；触控枚举、系统按键、SDK 字节码与空 HCI 日志都不能提供来源证据。建议厂商协议／Debug SDK／真实抓包，不得宣称已可靠识别。 |
| [疑难杂症](PPT/yanqiang_recordring/疑难杂症解决方案.md) | **排障参考**。Android Studio 没有 Node PATH；ColorOS 完整 HCI 被限制；外置 Nordic Sniffer 是替代方案但有连接时序与事件是否上报的前提。 |
| [本地调试终端指令](PPT/yanqiang_recordring/研强录音戒指App本地调试终端指令.md) | **参考**。仅 JS 改动用 Metro；原生、Manifest、Gradle、AAR/JAR 改动重装 APK；附 logcat 与 reverse 排障。 |
| [脱离电脑独立运行](PPT/yanqiang_recordring/App脱离电脑独立运行记录.md) | **基线**。Release 内嵌 JS，拔线后连接同步播放。文中明确 Android Release 当时仍为 Debug 签名，只是内部测试，不能等同正式发布。 |

## 5. iOS（8）

| 文件 | 分析与接续用途 |
| --- | --- |
| [APP 画面地图](ios/APP画面地图.md) | **现状＋历史**。最上方 2026-10-16 修订优先：统一 Agent Flow；正文双 Tab 图示为历史。当前 AppNavigator 与之吻合，定位页面时先看修订。 |
| [真机编译安装](ios/iOS前端真机编译安装最短步骤.md) | **早期基线**。曾完成 prebuild、Pods、个人签名、Metro；末尾“RingSDK 尚未接入”已经被后续记录取代。现有工程已定制，不能再把 prebuild 当默认接续操作。 |
| [戒指连接最短步骤](ios/iOS戒指连接最短步骤.md) | **核心基线**。bindDevice 等 AuthSuccess，禁止 -2 时手动 authorize；保留 08-04 快照、UUID/MAC 重复与 PairingRemoved 已知问题。末尾旧 OGG 描述需服从新同步专文。 |
| [录音同步最短步骤](ios/iOS录音同步最短步骤.md) | **核心基线**。AllSuccess／Empty 收尾扫描、16 字节 Opus 文件头、AVAudioConverter→M4A、避免坏 OGG。iOS 转码修改优先读这份。 |
| [PDF/PPT 生成 UI](ios/Agent-Flow页-pdf-ppt生成UI设计.md) | **基线／交互约束**。Process 先成功；文档块只挂当前卡，生成中／成功／失败独立；切页继续但杀 App 中断；Quick Look 本机预览。包含 08-28 Nginx 临时目录权限导致 multipart 失败案例，不能靠改 UI 修网络问题。其旧双 Tab 位置已变。 |
| [时间闹钟](ios/Agent-Flow-时间闹钟-手机计时.md) | **基线／有限能力**。2026-09-12 手机本地时间解析与 setTimeout，到点 BLE 连震20次；不是戒指 RTC 闹钟。旧短录音页面门槛不代表当前首页仍拆开。 |
| [可读转写与纪要](ios/Recordings-可读转写与腾讯会议体纪要.md) | **现状／需部署验收**。两步 LLM、raw／polished／meetingNotes 分存、语言判定、MeetingNotesRichText。旧录音重处理才用到新流水线。 |
| [audio-agent 部署快照](ios/snapshots/audio-agent-部署到-api.hispurring.com.md) | **历史运维基线**。08-21 打包排除 .env 与运行数据、Workbench 更新、ws 依赖、nostream 配置与重启。代码／云端／手机生效范围不同；旧绝对路径和临时 URL 需替换，不代表已获生产操作授权。 |

## 6. 阿里云与模型（4）

| 文件 | 分析与接续用途 |
| --- | --- |
| [项目进展与下一步](cloud_aliyun/录音戒指AI项目进展与下一步.md) | **历史基线**。Android 真 OGG→multipart audio→火山→DeepSeek→App 已验收。下一步中的15秒分流、持久化、HTTPS等属于当时待办，后续部分已经推进，不能整页视为当前任务清单。 |
| [HTTPS 最短指令](cloud_aliyun/配置api.hispurring.com-HTTPS最短指令.md) | **历史方案**。Caddy＋apt 写法假定 Debian/Ubuntu；实际 08-09 实录是 Alibaba Cloud Linux／dnf／Nginx。读它了解目标，不直接在未知服务器执行。 |
| [音频后端运行指令](cloud_aliyun/阿里云音频后端最短运行指令.md) | **历史运维基线**。HTTPS、18987、Volcengine、SiliconFlow 配置、保留服务器 .env、排除数据、nohup。代码默认端口／STT 与该配置不同，必须检查运行环境。 |
| [LLM 调用对照](model/audio-agent-LLM调用对照.md) | **代码基本支持／配置待核**。ASR 与 LLM 分离、官方 DeepSeek 与 SiliconFlow base/model/key 配对、thinking 按 host、images API 与关键词＋语义意图。段落对 agent_image／agent_command 的表述存在演进，实际路由看 server.ts；未证明现在线上模型选择。 |

## 7. H5 与 ASR Demo（4）

| 文件 | 分析与接续用途 |
| --- | --- |
| [后端 Demo 核心逻辑](recordApp_H5/backend-agent-demo-plan.md) | **规划／架构历史**。ASR、存储、LLM、Agent 分层；列出 transcribe／analyze／audio-agent／历史总结等建议 API。建议接口不等于当前实现；移动主线实际核心是 audio-task。 |
| [聊天接口对接](recordApp_H5/frontend-chat-api-guide.md) | **历史接口参考**。POST /api/chat，message／recordingIds／createdAt 契约与 loading/error 交互。临时 ngrok 地址已无当前有效性证明；当前服务仍可见 chat 路由。 |
| [语音智能体测试命令](recordApp_H5/语音指令智能体测试命令.md) | **历史联调**。agent-command-local 接受服务器本机 filePath，不是手机或前端电脑文件路径。不能拿任意本地路径给部署服务，也不能把该调试能力当正式上传契约。 |
| [auc_python_2/readme.md](auc_python_2/readme.md) | **厂商参考**。ASR HTTP Python demo，appid／token 占位符、新旧鉴权提示。不是 App 后端运行入口，具体鉴权以接入版本为准。 |

## 8. App Store 与隐私（7）

| 文件 | 分析与接续用途 |
| --- | --- |
| [5.6 回信与审核备注](appstore/ASC-5.6-回信与审核备注.md) | **历史发布资料**。SAMPLE 全员可见、游客无登录、硬件连接演示和真实能力说明；旧 Records／Assistant 步骤已与统一 Flow 导航不符。重新提交前应按实际包重写，文档不是已过审证明。 |
| [商店文案](appstore/real_info_appstore.md) | **参考／部分愿景**。定位、关键词、用户与范围，包含较广 Agent／提醒能力；不能直接用作当前全部能力已交付的说明。 |
| [HTTPS 打通实录](appstore/打通-api.hispurring.com-HTTPS实录.md) | **历史运维事实**。08-09 的系统、Nginx、Certbot、80/443、100m 上传与超时参数；GET health 而非 HEAD 为验收。比早期 Caddy 提议更接近当时实际，但现网仍需核实。 |
| [入口移除与恢复备份](appstore/store/2026-09-12-Laptop-Office-Debug-下架与恢复备份.md) | **现状部分支持／历史**。Laptop／CloudOffice／ButtonDebug 源码保留但断开导航，同步保留；当前导航仍如此。恢复步骤只是历史方案，不能自动执行，也不意味着审核包与用户包可以隐藏差异。 |
| [英文隐私政策](appstore/store/privacy-policy.en.md) | **政策草稿／发布待核**。08-09 生效文本，游客、蓝牙、本地存储、用户发起云处理、第三方处理、保留／删除／联系。后续自动上传、长期记忆、多入口功能需核对与政策是否一致；文本存在不证明实际遵循或已上线。 |
| [请同事上线政策](appstore/store/请同事上线隐私政策.md) | **历史交接／待核**。匿名可访问 privacy 页面与有效邮箱；引用路径少了 appstore，提及 privacy@ 与政策正文实际邮箱不一致。不能推定该页面当前已发布。 |
| [请同事配置 API HTTPS](appstore/store/请同事配置API域名HTTPS.md) | **历史交接**。DNS、TLS 反代、80/443、上传与安全组验收目标。后续实录证明当时打通，不代表本轮需再建域名或重新部署。 |

## 9. Git 与硬件烧录（3）

| 文件 | 分析与接续用途 |
| --- | --- |
| [Spur_ring 推送指令](github/Spur_ring推送GitHub最短指令.md) | **历史仓库操作参考**。新主仓名、gh 登录与代理端口、排除目录。7897 是旧机观测值，不是新机默认；不自动改全局代理或推送全部变更。 |
| [私仓上传目标](github/spur-private-repo-upload-目标.md) | **历史工程边界**。保留双端源码与厂商 SDK、排除依赖数据密钥、可 clone 编译；desktop 为空和待上传状态已落后于根 README／当前目录。 |
| [板子编译烧录](hardware/板子新路径编译烧录最短指令.md) | **历史独立固件基线**。NRF52840：SoftDevice→Bootloader→App→settings，缺 settings 可能只见 DfuTarg。当前主仓缺此完整固件树；不可把 erase／loadfile 当一般环境恢复步骤。 |

## 10. 产品与运营（6）

| 文件 | 分析与接续用途 |
| --- | --- |
| [产品目标精简版](product/Spur-产品目标与方向-精简版.md) | **优先产品依据**。整体个人助理愿景，明确当前为创作者即时想法→保存→创作→对话交付修改；后台 Harness、素材与脚本时间线，而非要求用户管理表单。 |
| [对话式个人执行助理](product/Spur-对话式个人执行助理-产品定义.md) | **目标交互 V1.1**。对话／任务／确认／真实订单／成果版本，跨入口共享状态；Android 悬浮与 iOS 通知／实时活动区分。大量文字线框是原型示例，不是接入订票购物的完成证据，也不是当前首页代码。 |
| [Harness 落地方案](product/Spur-Harness-投资人问题分析与落地方案.md) | **重要实施方向**。并行相似选题，Capture／IdeaUnit／Topic／Association／Task／ArtifactVersion／Event；先可靠保存找回，再归属、脚本、触达和付费验证。明确校准置信度、原文可溯、不能把 runtime 或 README 当已完成记忆系统。 |
| [Spur Flow 产品文档](product/Spur-Flow-产品文档.md) | **独立产品规划**。09-20：无戒指用户、只做说话→可用文字、Android 悬浮，iOS 另定；不混 Agent／会议／办公。与 Agent Flow 名字相近但目标不同，入口二选一未在本轮确认已实现。 |
| [MiniMax 战略意向](product/Spur-x-MiniMax-战略契合与投资意向说明.md) | **战略参考／合作未证实**。09-19，入口×全模态平台×Harness 的互补叙事；模型与合作表达不能作为已接入 MiniMax、取得投资或正式协议的证据。 |
| [09-20 周同步清单](product/周同步-注册融资市场清单-2026-09-20.md) | **推断型经营快照**。92 项、公司／融资／市场的估计进度；正文承认仓库推断。公司未设立、政策阻塞、KOL 合作等只能按当时记录描述；旧融资约2000万元与后来的千万元规划需分别保留，不合并成当前预算。 |

## 11. BP、视觉与市场材料（5）

| 文件 | 分析与接续用途 |
| --- | --- |
| [BP 核心表述](PPT/bp文档表述.md) | **叙事参考**。低摩擦入口＋自有 Harness／记忆／轨迹／办公闭环、10页愿景主讲、模型可替换，融资金额不在主讲定死。文件中“已在跑”描述范围大，工程能力必须逐条验收。 |
| [BP base 文本](PPT/file/Spur_AI录音戒指_BP_base.md) | **演示稿抽取**。20页硬件×Harness×个体数据、用户画像、竞争、团队、价格订阅、PVT与验证指标。$249/$299 与 $119/$239 是定价定义／假设；内容生成、量产、付费与跨端执行不能仅凭页内声明判定成熟。 |
| [七年长期规划](PPT/Spur七年长期规划报告-千万元种子融资到上市的产品经营组织护城河与估值路径.md) | **经营情景**。10-22／23，1000万元种子起点，保守／进取两套销量、订阅、预算、组织与条件触发融资；强调现金、库存、硬件质量、记忆／工作流／评测验证。不能把营收、估值、上市和资金规划写入当前实际经营事实；外部财务与规则本轮未复核。 |
| [戒指背景生成说明](PPT/ppt_image/戒指抠图再合成背景-生成说明.md) | **视觉制作经验**。保留原戒指造型、材质、灯带、孔与按钮，用参考图一次生成新场景及接触阴影，保留已验证16:9图。它是设计资产方法，不是硬件尺寸、量产外观或软件实现规范。 |
| [英文调研传单](market-research/spur-flyer-en.md) | **增长素材**。A4英文、手上入口／整理／行动三特点；二维码目前指官网占位，不代表问卷、漏斗或用研结果已成立。 |

## 12. AdventureX 研究（4）

| 文件 | 分析与接续用途 |
| --- | --- |
| [戒指相关项目](adventureX/戒指相关项目.md) | **外部研究**。08-06 Gallery 20项清单与链接；覆盖控制器、音乐、情感、照护与效率。适合理解输入形态，不是 Spur 需求验证或竞品技术全量核验。 |
| [智能戒指研究报告](adventureX/AdventureX-2026-智能戒指项目研究报告.md) | **较完整研究版**。20项含 InspireFlow，分入口／IMU／生理／场景触发，详情页成功抓取0/20。完整介绍主要基于卡片公开文案，保留证据边界。 |
| [汇报](adventureX/AdventureX-2026-汇报.md) | **旧研究派生版**。仍为19项，与全量版不同；一些小节编号重复。可作为旧汇报档案，不取代20项源报告。 |
| [汇报摘要](adventureX/AdventureX-2026-汇报-摘要.md) | **旧摘要**。19项表和主题分布，不能当20项全量统计。对外引用前统一版本，不悄悄合并旧数字。 |

## 13. Ring Sound SDK（3）

| 文件 | 分析与接续用途 |
| --- | --- |
| [SDK README](otherfiles/sdk/ring_sound_SDK/README.md) | **独立技术参考**。SDK 0.3.4、v4协议、固件 V2.000.0001.0015；NUS／重组／CRC／请求队列，16k Speex length-prefix→Ogg封装→WAV；quick／自动上报、IMU和两模式状态机；APK与机械模型是独立资产。不能视为研强移动端已迁移。 |
| [protocol.md](otherfiles/sdk/ring_sound_SDK/protocol.md) | **字段级参考**。11字节包头、网络字节序、0x01系统／0x03日志／0x04校时／0x05录音／0x06 IMU／0x07事件与错误码。只覆盖公开功能，不自动生成不存在的模式查询或控制能力。 |
| [ring_sound_use.md](otherfiles/sdk/ring_sound_SDK/ring_sound_use.md) | **调用手册**。安装Bleak／FFmpeg、公开类型API、下载／自动接收／解码、批量IMU、HMM和按键、CLI与故障。不得并发抢同一0x0505队列；clear_audio_files是破坏性维护操作；Mac设备标识与平台行为须另验。 |

## 覆盖核对

分类数量：8＋2＋7＋7＋8＋4＋4＋7＋3＋6＋5＋4＋3＝**68**。空文件同样纳入。`UI`、`logo`、`ppt0` 等目录在此次递归清单中没有匹配的 Markdown，因此没有虚构开发记录；其中其他格式的资产不在本轮 Markdown 分析范围内。

如果后续增加或修改开发记录，应同步更新本文和项目上下文中的当前结论；旧文件保留历史价值，无须为消除冲突而删除原记录。
