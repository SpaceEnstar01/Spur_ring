# Agent Workspace 二十种示例按确认稿重新排版与默认折叠修复记录

日期：2026-11-04；修订版本：iOS 1.0.2（1037）。

## 修复原因与确认基准

1036 实际已安装，但视觉层级与确认意图不符：仅有 18 种示例，无编号／适用说明，部分正文直接展示，真实 Agent 结果也完整铺在工作区。

本轮依据用户确认的独立 20 种示范修订，而非只增加组件数。保留全部示例，默认展示精简预览，长正文须点击后展开。未修改 Agent API、自动理解或真实云端执行逻辑。

## 改动

- 完整 20 种：原 18 种，加 19 失败恢复和 20 同任务状态变化；每项有编号、名称与适用说明。
- All 20 examples 默认展示全部，Today composition 为可选组合，仍可整体收起。
- 行动授权：浅桃色标题区，居中的小发送图标、标题与副标题，下方 Recipient／Action 信息行，等宽 Deny／Allow 按钮。完整草稿改为点击 Read draft 才显示。
- 成果凭证：浅绿色标题区，版本和状态信息行，整行 View script 按钮，脚本默认折叠。
- 文件交付：Preview presentation／Refine 同行，预览和修改输入均由点击打开。
- 保留轻量通知、清单、日程、问题等各自形态，不强行统一成大卡片。
- 真实 Personal Agent 结果：工作区默认三行预览，点击“查看完整结果”才展示 Markdown、来源及成果链接；完成状态不再重复显示通用提交按钮。
- 示例始终使用独立本地状态。批准不等于执行，模拟结果仍有操作反馈说明；不发信、不发布、不产生真实任务。

## 主要源码

相对 `/Users/x/X/space/spur`：

- `V2/appV2/app_mobile/src/adaptive/model.ts`
- `V2/appV2/app_mobile/src/adaptive/examples.ts`
- `V2/appV2/app_mobile/src/adaptive/Patterns.tsx`
- `V2/appV2/app_mobile/src/adaptive/WorkspaceExamples.tsx`
- `V2/appV2/app_mobile/src/components/RecordingReplyCard.tsx`
- `V2/appV2/app_mobile/__tests__/AdaptiveWorkspace.test.tsx`
- `V2/appV2/app_mobile/__tests__/AgentDashboard.test.tsx`

## 验证证据与限制

- TypeScript、改动源码 ESLint 通过。
- 完整 Jest：33 套／234 项通过；后续清理空白预览节点后又通过对应工作区测试。
- 以同一套 React Native 组件，通过 React Native Web 在浏览器渲染核对，而不是另写一份 HTML 代替实际组件。390／320 宽度无横向溢出，20 种组件可见，无页面 JS 错误；授权及默认折叠交互经浏览器检查。
- 截图为同源组件的浏览器渲染，不是 iPhone 截屏：
  - `assets/adaptive-ui-1037/approval-source-render.png`
  - `assets/adaptive-ui-1037/artifact-source-render.png`
  - `assets/adaptive-ui-1037/deliverable-source-render.png`
- 最终 Release 1037 构建成功，已安装到 eFLY。真机最终视觉效果仍需实际查看，不能将浏览器检查或单元测试称为真机视觉验收。
