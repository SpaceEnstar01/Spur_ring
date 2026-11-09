# Agent Flow：时间闹钟（手机计时）

> 记录：2026-09-12 调试打通

## 做什么

短语音说定时需求 → 手动 **Process** → 瀑布流出 **时间闹钟** 卡片 → 详情倒计时 → 到点手机发指令，戒指连震 **20** 次。

- 时间标准：**手机本地时区**（非戒指 RTC）
- 前提：手机在戒指旁，**BLE 已连接**
- **不改云端**；解析与计时在 App 本地

## 门槛

- Agent Flow：录音 **&lt;30s**
- 录音页：录音 **≥30s**

## 指令示例

| 说法 | 行为 |
|------|------|
| `30秒后震动` / `1分钟后震动` | 相对：now + Δ |
| `16:00震动` / `下午四点震动` | 绝对：当天该时刻（已过则次日） |

## 关键文件

- `src/services/alarmIntent.ts` — 解析相对/绝对时刻
- `src/services/alarmScheduler.ts` — 手机 `setTimeout` 到点震
- `src/services/localAgentCards.ts` — Process 后挂 `alarm`、分类 `alarm`
- `src/services/localAudioLibrary.ts` — 阈值 30s
- `src/screens/assistant/AgentFlowScreen.tsx` — 卡片/详情倒计时 UI

## 演示

1. 连接 Spur Ring  
2. 录「30秒后震动」→ Agent Flow → **处理**  
3. 点 **时间闹钟** 卡片看倒计时 → 到点连震 20 下  
