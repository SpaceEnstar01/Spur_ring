# Agent Workspace 首页十八种自适应展示与同一任务状态变化交互示例实现记录

日期：2026-11-04。版本：iOS 1.0.2（1036）。

## 用户确认的范围

在现有 Agent Workspace 首页直接放置 18 种交互示例，不要求先进入独立 Showcase；不逐条标注 Demo。真实事项优先，示例整体可收起。示例动作仅改变本地状态；模拟授权、发送、文件修改等在操作反馈说明，不调用外部服务。不新增 Memory 页面，不改 Agent API、录音转写、自动分析或云端执行逻辑。

## 如何体验

打开 Spur 默认 Agent Workspace，向下滚动至 **A day with Spur.**。

- **All 18 layouts**：完整示例，按 01–18 顺序展示，不在首页加入模式编号和重复说明标签。
- **Today composition**：选择性组合标题选择、重要授权、执行状态、脚本成果、轻量完成事件、下一步和录音，不简单堆叠全部面板。
- **Hide examples / Show examples**：整体收起／展开示例。
- 底部 **From intention to outcome**：同一任务生命周期演示。
- 原首页底部输入仍是真实 Agent 对话入口，不是模拟命令输入。

## 十八种模式

| 序号 | 模式 | 本地交互 |
|---|---|---|
| 01 | 轻量通知 | 展开／收起脚本 |
| 02 | 行内问题 | Continue／Tomorrow，支持更改 |
| 03 | 紧凑清单 | 勾选、取消勾选、展开详情 |
| 04 | 执行阶段 | 手动推进 Searching／Analyzing／Drafting／Ready，不伪造百分比 |
| 05 | 研究报告 | 本地圣托里尼图片、摘要与完整报告展开 |
| 06 | 数据分析 | SVG 折线图，可点图点或日期；扩展洞察；数字明确为示意指标 |
| 07 | 邮件草稿审批 | 编辑、保存、取消编辑、批准反馈；不发信 |
| 08 | 录音转化时间线 | 展开原文、逐项查看提取内容；无虚假播放按钮 |
| 09 | 横向选项 | 可横滑、选择、切换标题 |
| 10 | 紧凑日程 | 查看事件详情；不写入日历 |
| 11 | 偏好反馈 | 推断与确认区分、编辑纠正；不写入真实长期记忆 |
| 12 | 轻量完成事件 | 展开结果 |
| 13 | 行动授权 | 大幅信封插画、Deny／Allow／重置；批准不等于已发送 |
| 14 | 完成成果 | 绿色文稿视觉、实际示例脚本预览 |
| 15 | 视觉选择 | 巴黎／圣托里尼现有照片，两列选择 |
| 16 | 交付物 | 演示文稿内容预览、输入修改请求；不声称改动真实文件 |
| 17 | 修改对比 | Original／Spur’s revision 切换 |
| 18 | 下一步建议 | 选择后显示模拟任务，Not now 收起，可恢复 |

## 同一任务的形态变化

稳定 ID：`example-jack-followup`。

```text
Captured → Executing → Needs approval
  ├─ Denied → Return to draft
  └─ Approved — awaiting execution
       ├─ Simulate successful execution → Completed
       └─ Simulate failed execution → Failed → Retry／Return to draft
```

每个阶段原位替换，不新增重复任务；批准后不会直接显示发送成功。只有显式模拟成功事件后才出现 Email sent，同时说明没有真实发信。

## 文件与结构

主仓 `/Users/x/X/space/spur`，以下路径相对主仓：

新增：

- `V2/appV2/app_mobile/src/adaptive/model.ts`：18 种展示类型、示例数据类型、真实事项确定性选择函数；不调用模型，不改变任务权限。
- `V2/appV2/app_mobile/src/adaptive/examples.ts`：同一虚构 Creator 账号的 18 条独立示例与示意指标，不写入录音或事项台账。
- `V2/appV2/app_mobile/src/adaptive/Patterns.tsx`：可复用交互组件、SVG 图表／插画、共享样式、尊重减少动态效果设置的展开动画。
- `V2/appV2/app_mobile/src/adaptive/WorkspaceExamples.tsx`：首页示例组合、整体收起、Today composition 和稳定任务 ID 生命周期。
- `V2/appV2/app_mobile/src/adaptive/RealAdaptiveItem.tsx`：真实事项轻量展示；不使用示例交互伪造真实状态。
- `V2/appV2/app_mobile/__tests__/AdaptiveWorkspace.test.tsx`：模式展示与交互、来源分离、生命周期及展示规则测试。

修改：

- `V2/appV2/app_mobile/src/components/AgentDashboard.tsx`：真实事项后加入示例入口与组合。
- `V2/appV2/app_mobile/src/components/IntentWorkspace.tsx`：接入真实事项自适应展示。
- `V2/appV2/app_mobile/__tests__/AgentDashboard.test.tsx`：正确等待异步组件状态。

## 真实事项的接入边界

想法／轻量完成事件使用无边框文字，信息不足使用行内问题，明确待办使用紧凑行。真实事项仍沿用已有详情、纠错、来源、完成操作和真实执行数据；复杂报告、脚本、审批及分析继续复用已有真实组件，避免把示例里的照片、数字、阶段或文件错误套用成真实证据。更多模式需要真实数据字段支撑后逐项映射，不会多调用一次 LLM 来决定外观。

## 实际验证

- TypeScript 检查通过。
- 改动源码 ESLint 通过，无错误或警告。
- 33 套／233 项 Jest 测试通过。新增 20 项测试覆盖所有模式交互、同任务身份、批准与执行分离、无真实网络副作用。
- iOS Release 1036 构建成功，已通过 devicectl 安装到 eFLY，随后启动 App。
- 未运行新的云端部署，未调用真实邮件、日历或发布接口。
- 当前环境无可用 iOS Simulator；组件渲染测试和签名构建不等于已逐屏完成真机视觉验收。用户可在已安装版本中查看实际布局并反馈。
