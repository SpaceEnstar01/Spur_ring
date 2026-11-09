# Agent Today Dashboard（2026-10-28）

## 已对齐范围

用户提供 Today 参考图和英文 UI 规格，确认在 V2 实现：真实生成的分析、总结优先置顶；无结果时以三个示范卡为主体，示范始终保留在真实结果下方。录音、转写及云端文字分析保持既有链路。原工程不修改，不运行 Java 后端。

## 实现

- `appV2/app_mobile/src/components/AgentDashboard.tsx`：Today / Projects / Memory，真实结果卡，处理中及待分析内容。Projects 只展示已有捕捉内容，明确项目关联未接入；Memory 展示笔记及完成分析。没有创建假的 Matter 或权限记录。
- `src/components/TodayDemoCards.tsx`：视频表现、爆款脚本、邮件决策三个 pastel 渐变示范卡；原生详情弹层、草稿审阅、二次确认模拟发送、暂缓与恢复示范。邮件不调用任何服务。
- `src/agent/todayDemo.ts`：独立示范数据，未写入真实录音、记忆或执行状态。
- `src/agent/todayState.ts`：完成结果排序及独立持久化的示范决策状态。
- `src/screens/HomeScreen.tsx`：白底、spur. 字标、通知说明入口、固定输入栏及键盘适配；点击字标可打开原侧栏，录音和设备入口仍由侧栏保留。底部麦克风进入现有录音，输入和 Use This Framework 打开可审阅聊天草稿，不自动发送。
- `src/ring/types.ts`、`store/useRecordingStore.ts`、`recordingIdentity.ts`：成功分析保存完成时间，按完成时间倒序。旧数据回退录音时间，不伪造历史完成时间；转写修改清除旧结果时间。文件同步合并保留对应结果时间。
- `src/assets/today/`：本地打包巴黎及 Santorini 配图，来源见同目录 README；图表叠层由 UI 绘制。

录音文件保存、本机转换修复、语音识别和戒指 SDK 均未修改。真实分析继续要求现有的文字共享确认。规格中的完整意图、Matter、外部执行能力属于后续接入范围，本次不宣称实现。

## 验证

Lint、TypeScript 通过；26 套 / 179 项 Jest 测试全部通过。覆盖真实结果按完成时间排序且位于示范前、失败片段不作为完成结果、真实分析确认、模拟邮件审阅和授权、暂缓状态、框架转聊天草稿、原卡片打开及删除确认。

签名 Release 编译通过。已在 eFLY 覆盖安装并启动，通过真机截图发现并修复 react-native-linear-gradient 内容容器裁切：使用普通 View 承载内容，渐变仅作绝对定位背景；标题栏按屏幕宽度明确约束，长描述移至缩略图行下方全宽换行，以适配真机并保留完整英文内容。截图确认真实分析在示范前、卡片与固定输入栏显示。最终交互与观感由用户继续真机验收，未声称实际邮件、视频研究或 Matter 后端已接入。
