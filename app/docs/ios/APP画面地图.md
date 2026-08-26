# Spur App 画面地图（方便对齐「哪个页面」）

> 目的：开发对话时用**固定叫法**指页面，少靠口头描述。  
> 依据：`app/mobile/src/navigation/AppNavigator.tsx` + 各 Screen 文案（英文 UI 为主）。  
> 更新：2026-08-20

---

## 1. 一眼结构

```text
┌─────────────────────────────────────────────┐
│  左上角：Device（蓝牙） · Me（我的）          │  ← 两个 Tab 顶栏都有
├─────────────────────────────────────────────┤
│                                             │
│           【当前 Tab 主内容区】               │
│                                             │
├──────────────┬──────────────────────────────┤
│  Recordings  │       AI Assistant           │  ← 底部只有 2 个 Tab
│   （录音）    │      （AI 助手 / Agent Flow） │
└──────────────┴──────────────────────────────┘
```

---

## 2. 固定叫法（以后优先用这些名字）

| 叫法 | 用户看见的标题 | 代码入口 |
|------|----------------|----------|
| **Recordings 页** | Recordings | `RecordingListScreen` / Tab `Records` |
| **Agent Flow 页** | Agent Flow（Tab 名 AI Assistant） | `AgentFlowScreen`；详情页天蓝悬浮球：流式 STT（sauc/bigmodel）听写文字意图 → 确认后 LLM 改写结果 |
| **蓝牙连接页** | Spur Ring | `YanqiangVoiceDebugScreen` / `Device` |
| **电脑控制页** | Connect to laptop | `ConnectLaptopScreen` / `ConnectLaptop` |
| **同步页** | Sync recordings（Synced files on this iPhone） | `YanqiangRecordingDebugScreen` |
| **录音结果页** | 纪要 / Summary | `LocalRecordingResultScreen` |
| **转写页** | Transcript | `TranscriptScreen` |
| **我的页** | Me | `MeScreen` |
| **按键调试页** | Button Event Debug | `YanqiangButtonDebugScreen`（少用） |

---

## 3. 主画面勾勒

### A. Recordings 页（底部左 Tab）

```text
┌──────────────────────────────┐
│ [Device] [Me]          [↻]   │
│                              │
│  （可选）SAMPLE 提示条         │
│                              │
│  ┌────────────────────────┐  │
│  │ SAMPLE?  标题 / 时长    │  │
│  │ 摘要…                   │  │
│  │ [▶] [处理] [删]         │  │
│  └────────────────────────┘  │
│  …更多 ≥15s 录音…            │
└──────────────────────────────┘
         Recordings | AI Assistant
```

- 放 **≥15 秒** 的录音（会议纪要向）。
- 点卡片 → **录音结果页**；可进 **转写页**。

---

### B. Agent Flow 页（底部右 Tab）

```text
┌──────────────────────────────┐
│ [Device] [Me]                │
│ Agent Flow          [全部处理]│
│                              │
│  ┌─────┐  ┌─────┐            │
│  │卡片 │  │卡片 │  瀑布流     │
│  │图?  │  │…    │            │
│  └─────┘  └─────┘            │
└──────────────────────────────┘
         Recordings | AI Assistant
```

- 放 **&lt;15 秒** 短语音指令。
- 点卡片进详情：AI 结果（可含图）+ 转写。

---

### C. 蓝牙连接页（左上 Device）

```text
┌──────────────────────────────┐
│ Spur Ring                    │
│ Scan and connect…            │
│                              │
│ [扫描]  设备列表…             │
│ Connect to laptop → 电脑控制页 │
│ 已连接 → 入口进「同步页」      │
└──────────────────────────────┘
```

---

### D. 同步页（连接完成后的「蓝牙主页面」）

```text
┌──────────────────────────────┐
│ ‹ Back                       │
│ Sync recordings              │
│                              │
│ Ring summary | Sync again    │
│                              │
│ Synced files on this iPhone  │
│              [Delete All]    │
│ ┌ 本地文件列表 + 播放/删除 ┐  │
└──────────────────────────────┘
```

- 就是你说的：**Synced files… + Delete All** 那一页。

---

### E. 我的页（左上 Me）

```text
┌──────────────────────────────┐
│ Me / Spur Guest              │
│ 账号、配额、关于等            │
└──────────────────────────────┘
```

---

## 4. 跳转关系（简图）

```text
Recordings ──► 录音结果页 ──► 转写页
     │
Agent Flow ──► 卡片详情（同页内）
     │
Device ──► 蓝牙连接页 ──► 同步页
              └──► 电脑控制页
     │
Me ──► 我的页
```

---

## 5. 说话示例

- 「同步页 Delete All」= Sync recordings 那页的全部删除  
- 「Recordings 页卡死」= 底部左 Tab 录音列表  
- 「Agent Flow 处理失败」= 底部右 Tab 智能体任务流  
- 「蓝牙连接页扫不到」= Spur Ring 扫描页  

有新页面时，只改本文件的「固定叫法」表即可。
