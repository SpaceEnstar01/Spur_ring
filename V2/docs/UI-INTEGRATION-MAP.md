# 以新版 UI 为主线的能力接入表

2026-10-28。依据当前 V2 源码，不代表设备或生产验收结果。页面保留新版 `app_mobile`，后端与执行能力复用原主工程。常规适配直接完成；会改变上传策略、处理结果或自主执行范围的选择另行对齐。

| 用户入口 | 页面和调用链 | 能力来源 | 当前状态 |
| --- | --- | --- | --- |
| 首次进入、个人资料和权限 | PermissionGate → OnboardingFlow | 新版移动端本机资料及原生权限模块 | 保留；需真机授权验收 |
| 首页麦克风、开始录音 | HomeScreen / AgentDashboard → RecorderScreen → PhoneAudio | 新版原生录音模块 | 保留手机录音与保存逻辑；需真机验收 |
| 结束录音 | RecorderScreen.stop → useRecordingStore.merge → NoteScreen | 新版本机文件库 | 保留落盘、计时、退出保护和中断处理 |
| 本机转写、重新识别 | automaticRecognition / NoteScreen → transcriptionApi → SpurFileSpeech | 新版 iPhone 原生 Speech | 保留本机识别，不自行改成音频上传；Android 暂不支持此路径 |
| 首页分析想法、自动 AI 回复 | generateRecordingReply → chatApi → /api/chat | 原 audio-agent | 已适配 JSON 协议；保留逐条确认和自动回复开关 |
| 录音详情阅读 AI 回复 | RecordingReplyCard / NoteScreen → 文件上的 aiReply 状态 | 新版 UI + 原云端回答 | 保留工作中、成功、失败及手动重试 |
| 详情继续对话 | NoteScreen → ChatScreen(recordingUri) | 当前录音原文与已有完整回复 | 保留问答历史，仅附带当前来源；不附带全部笔记 |
| 普通文字聊天 | 首页输入区 → ChatScreen → chatApi | 原 audio-agent | 已适配；携带最近对话，无全库上下文，原云端没有 SSE |
| 新建／保存笔记 | HomeScreen → NoteScreen → useNotesStore | 新版本机存储 | 保留；未自动上传全部笔记 |
| 设备入口、搜索、配对、同步 | DeviceScreen / RingSearchScreen → RingConnectionService → YanqiangVoice | 新版已迁移的研强 SDK | 保留；不混用旧 SmartRing 或 NUS/Speex 协议，需真实戒指验收 |
| 设置服务地址与检测 | SettingsScreen → chatApi | 原云端 /health | 已适配音频服务类型校验；仅健康不等于模型可用 |
| 意图工作区／Matter／长期记忆 | AgentWorkspacePanel → agent/runtime | Java 参考实现尚未迁入原后端 | 明确未接入；禁用请求，不用聊天回答伪造状态 |
| 本机系统闹钟 | AgentAlarmPanel / agentAlarms → SpurAlarm | 新版 AlarmKit 模块 | 原实现保留，独立授权；未作为原云端执行链验收 |
| 首页旅行分析、脚本示例 | AgentExamples → 本地示例详情 | 本地演示数据 | 保留虚构／离线说明，不调用模型、不算任务完成 |
| 办公出件 | 原办公网关 + PDF/PPTX 工具 | V2/agent | 源码完整复制；新版 UI 尚未设计并接入真实产物入口 |
| 多步 Agent 执行 | Harness 会话与工具循环 | V2/agent/runtime/deepseek-harness | 源码完整复制且核对一致；尚未接 App 的任务协议 |

## 本轮直接完成的适配

- 地址与协议适配，正常／取消／超时／错误状态处理。
- 保留本机识别、单条回复与用户明确同意，不向云端补传整个本地库。
- 阻止 Java 旧状态触发错误接口；UI 标明缺失能力。
- iOS Scene 生命周期与本工程构建环境准备。

## 涉及产品行为的下一步选择

1. 若本机识别不可用，是否允许用户选择云端识别、上传什么音频、是否保留本机优先，需单独明确；首轮不自动上传音频兜底。
2. 长录音应进入会议纪要还是与短录音相同的想法分析，不能只因旧工程存在时长阈值就直接改变新版体验。
3. Matter 和五类意图如何进入新版首页、用户需要确认什么、哪些任务可以自主执行，需明确产品语义后再迁入后端。
4. 办公产物从哪里发起、挂到哪条录音／事项、如何查看版本和下载，需要决定入口，再复用既有生成工具。

当前代码、测试、无签名及开发签名 Release 编译已通过；已按用户明确授权覆盖安装 eFLY，启动成功且用户确认首页正常。真实手机录音到 AI 回复的验收仍未完成。下一步先验收该流程，再沿此表逐项接通。复制完整 Harness 是源码准备，未把其全部工具直接开放给手机用户。
