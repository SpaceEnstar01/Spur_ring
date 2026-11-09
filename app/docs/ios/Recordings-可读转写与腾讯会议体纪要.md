# Recordings：可读转写 + 腾讯会议体纪要

> 记录：2026-09-13

## 链路

```text
录音 → ASR 原始转写
    → LLM 全文润色（保留信息，调格式/语适）
    → LLM 腾讯会议体纪要
    → App：Transcript 默认「可读转写」；Notes 显示结构化纪要
```

## 云端

- `meetingNotesPipeline.ts`：两步 `completeChatPrompt`
- `POST /api/audio-task` + `taskType=recording_summary` 返回：
  - `transcript` 原始
  - `polishedTranscript` 润色全文
  - `agent.output` 会议纪要

## App

- `localRecordingAnalysis`：存 `rawTranscript` / `polishedTranscript` / `meetingNotes`
- 结果页可在「可读转写 / 原始转写」间切换

## 语言规则

按转写字母占比自动判定（在云端 `detectNotesLanguage`）：

- 汉字为主（英文字母不足一半）→ **中文纪要**
- 英文字母约占一半及以上 → **英文纪要**

## 展示

App 用 `MeetingNotesRichText` 渲染：大标题 / 蓝色小节标题 / 灰色元信息 / 正文 / 待办表 / 引用块，层次用字号与颜色区分。

## 生效

需重新部署 `audio-agent`；旧录音需重新 Process。
