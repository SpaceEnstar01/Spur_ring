# Connect Apps 展示页（2026-10-28）

用户要求在侧边栏增加“连接应用”，按所附参考图和英文 UI Prompt 实现，仅做示范展示。

- 新增原生 Stack 路由 `ConnectApps` 与 `src/screens/ConnectAppsScreen.tsx`，白底、spur.、关闭按钮、紧凑列表，无底部导航。
- 侧栏“连接应用”附“示范”提示，沿用原关闭侧栏和导航流程。其他入口保持原有行为。
- `src/integrations/demoApps.ts` 单独维护七个应用的展示数据：Gmail、Notion、Google Drive 默认示范 Added；Wideframe、Frame.io、YouTube Studio、Metricool 默认 Connect。
- 支持按名称及描述搜索，与 All / Creator / Communication / Analytics 分类联合筛选，空结果提示，Connected / Available 分组。
- 点击行或 Connect 打开详情，展示示范能力、未选账号及权限说明。Simulate Connection 仅更新页面内状态；Manage 可以确认移除示范连接。退出页面重置。
- `src/components/IntegrationIcon.tsx` 使用本地向量示意标识，不联网加载图片，不引入依赖。
- 页面始终标明 Demo preview / No accounts connected。不会 OAuth 登录、不调用外部 API、不接入 Java 权限或 Agent 执行状态，不会让 Today 邮件示范产生真实发送能力。

验证：Lint、TypeScript 通过，26 套 / 179 项既有 Jest 测试通过；签名 Release 编译成功，已覆盖安装到 eFLY。新页面的真机观感及具体点击仍待用户从侧栏进入验收。
