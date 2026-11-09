# 手机 Agent 邮箱通知位置与语言修正

日期：2026年11月06日。

用户已确认手机收信、摘要及回复功能完成。本轮将主动来信通知集中到 Agent Workspace，邮箱页保留真实收件箱与批准回复。Workspace 展示未读来信，包括正在摘要与非紧急邮件，直接显示最多5封，更多提供邮箱入口。已读状态以服务端为准。

英文来信的摘要、核心分析和草稿使用英文；中文来信使用中文，混合语言以正文主要语言为准。现有中文摘要不会自动重写。修改的是模型指令，实际输出仍需新英文邮件验收。

## 修改位置

- V2/appV2/app_mobile/src/components/MailActivitySummary.tsx
- V2/appV2/app_mobile/src/screens/AgentMailboxScreen.tsx
- V2/appV2/app_mobile/src/adaptive/ChatWorkspaceHome.tsx
- V2/appV2/app_mobile/__tests__/MailActivity.test.tsx
- V2/web/server.mjs

## 实际结果

- TypeScript、改动文件 ESLint 通过；移动邮件专项3套8项通过；Node邮件测试与服务端语法检查通过。
- Linux amd64镜像构建成功，容器内确认新语言指令存在，此项不代表实际模型输出验收。
- ACR标签 email-workspace-v2 已推送；digest：sha256:5b53b7f2b82576936ddf04d8116f72791e691786c12a290d41bc05e3822e130f。
- iOS Release构建与签名验证通过，已安装并启动；设备查询确认版本1.0.2、构建1043。
- 非交互SSH鉴权失败，云端尚未切换此镜像，需要用户在已有ECS终端执行更新。

## 待验收

更新云端后，发送新英文测试邮件，在Workspace检查来信和英文摘要；进入邮箱分析，确认英文草稿。未批准的草稿不发送。保留现有数据卷、鉴权、OAuth、Caddy和回滚容器。

## 后续真机反馈：已读摘要被首页隐藏

用户更新云端后未看到Workspace提醒。用户提供诊断：enabled=true、initialized=true、error为空；两条通知均ready、有摘要、unread=false，unreadCount=0。此证据只能确认这两条已生成摘要，无法仅凭去标识状态确定它们是否包含最新测试邮件。

源码确认：AgentMailboxPanel.choose打开邮件会调用已读接口，而MailActivitySummary原先仅展示unread通知，导致在邮箱先查看后Workspace不再展示。修正为保留最近5条通知与摘要，已读只影响标记与未读计数，不将已读推定为处理完成。不修改服务端状态、不重新生成摘要或发送邮件。

TypeScript、改动文件ESLint和3项专项测试通过。1044构建安装状态随后记录。

1044 Release构建成功，签名验证通过；devicectl安装、启动成功，查询设备确认1.0.2 (1044)。无需更新云端。待用户确认Workspace已展示近期已读摘要及新来信。
