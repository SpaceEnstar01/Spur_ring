# 录音自动理解直连硅谷 Personal Agent 并统一进入 Agent Workspace 的实现与真机验收记录

日期：2026-11-04。

## 本轮确认范围

- 沿用 V2 App UI，不新增 Memory 页面。
- 想法、灵感、知识和待办、承诺、目标均在 Agent Workspace 展示，按内容分区。
- 普通对话允许只保留录音、转写及摘要，不强制生成工作区任务。
- 自动分析、录音重试和文字对话直接使用新 Personal Agent；不再回退旧 `/api/chat`。
- 手机自动分析需首次开启文字上传授权，之后新录音无需逐条点击；不开启时不自动发送。保留原有历史录音排除规则，不批量上传旧库。

## 实际链路

```text
Ring／手机录音 → iPhone 本地转写
  → 已授权的自动处理队列
  → HTTPS Personal Agent /api/creator-agent/chat（Bearer）
  → 结构化理解 + 来源证据校验
      ├─ 想法／知识 → 工作区想法分区
      ├─ 待办／承诺／方向 → 工作区事项；缺失信息继续澄清
      ├─ 普通对话 → 录音摘要，intents=[]
      └─ 明确且信息充分的公开网页研究指令
          → 独立 Agent 执行请求 → 工作区显示真实进度、结果和来源
```

服务地址与令牌继续读取已有 Personal Agent 设置；未配置或请求失败时直接报错，不走旧音频 AI 回复服务。设置页已移除旧 AI 回复服务地址配置，保留 Personal Agent 配置。

## 关键实现

主仓根目录：`/Users/x/X/space/spur`。

- `V2/appV2/app_mobile/src/services/automaticReplies.ts`：自动理解改为新 Agent；先解析并保存分类，再按已校验的 research 请求执行。执行失败与分类结果分开保存；恢复时中断任务显示待重试，不伪造继续执行。
- `V2/appV2/app_mobile/src/services/chatApi.ts`：保留对话调用签名，内部统一使用 Personal Agent 客户端，保留已选上下文与最近对话；不回退旧接口。
- `V2/appV2/app_mobile/src/intent/prompt.ts`：新增自动捕捉理解协议，允许普通录音无任务；知识和灵感归入想法；研究执行须明确请求。
- `V2/appV2/app_mobile/src/intent/model.ts`：允许空 intents；research 仅接受高置信度、无澄清问题的 instruction/report，保留逐字来源证据校验。
- `V2/appV2/app_mobile/src/components/IntentWorkspace.tsx`：需要确认、待办承诺任务、想法灵感知识分区；研究项目显示关联执行状态和结果。
- `V2/appV2/app_mobile/src/components/AgentDashboard.tsx`：默认展示真实工作区，不再混排虚构示范交付；保留未迁移的历史实际结果和来源入口。
- `V2/appV2/app_mobile/src/components/RecordingReplyCard.tsx`：不再为每条未执行录音展示第二个通用 Agent 提交按钮；已有执行显示结果或重试。
- `V2/appV2/app_mobile/src/screens/NoteScreen.tsx`：录音重新分析直接进入统一理解流程，不另开旧 AI 请求；继续对话也使用统一的新 Agent 客户端。
- `V2/appV2/app_mobile/src/screens/SettingsScreen.tsx`：自动理解开关说明与单一服务配置。

## 边界

- 本轮未改火山云端转写，仍是 Apple 本地识别。转写方案后续单独切换。
- 当前分类及事项台账仍主要本机持久化，不等于已经建立云端长期 Memory 或跨设备同步。
- 自动执行本轮只接明确的公开网页只读研究；发送、发布、交易等不自动执行。模型提示词约束不是新的服务端工具权限沙箱。
- 未部署新的 ECS 镜像，复用已有 Personal Agent API；当前云端进度查询是否支持以部署版本为准，客户端不伪造步骤。
- App 关闭后的持久任务调度、长期主动跟踪及 iOS 推送不在本轮已完成范围。
- 文件成果链接仍需单独验证公网鉴权兼容性，不以网页研究成功替代文件下载验收。

## 验证

- TypeScript 检查、改动源码 ESLint 通过。
- 全部 32 套／213 项 Jest 测试通过，覆盖自动触发、重复同步去重、普通对话不生成任务、想法沉淀、研究分流、非法分类、失败重试及取消后迟到响应。
- iOS Release 1.0.2（1035）构建；安装包路径：`/tmp/spur-agent-workspace-build/Build/Products/Release-iphoneos/SuprRing.app`。
- 用户连接手机后，iPhone eFLY（UDID `00008101-00014DA214FA001E`）显示 connected；已通过 devicectl 成功安装 1035 并启动 `com.spur.recordingring`。实际新录音的云端分类与执行闭环仍待真机验收。

## 真机验收

1. 已配置 Personal Agent 地址和令牌，开启一次“转写后自动理解与整理”。
2. 新录音：“我觉得可以做一期 AI 眼镜的视频。”应自动生成工作区想法卡，无执行任务。
3. 新录音：“周五之前我要完成视频脚本。”应自动生成事项，未知时间及必要信息需要确认。
4. 新录音：“帮我用浏览器打开 YouTube，读取页面标题。”应先理解，随后显示真实云端执行状态、结果及来源，不再逐条手动提交 Agent。
5. 普通聊天应保留录音摘要，不强制出现任务卡。
6. 断网、修改转写后核对错误可重试、旧结果不覆盖新文字；已有录音仍可播放与查看。
