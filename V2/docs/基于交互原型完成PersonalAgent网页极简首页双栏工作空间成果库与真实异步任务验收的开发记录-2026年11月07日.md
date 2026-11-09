# Spur Personal Agent Web UI 重设计与本地真实验收记录

日期：2026年11月07日（中国时间）。用户先批准只读方案，再明确确认实施。主要参考用户提供的Spur_Web_V1_Interactive_Prototype.html及Web UI Redesign Prompt。保留原技术栈，不引入新依赖。

## 产品结构

- Home：暖白背景、蓝色Spur Pulse、居中输入框与四个轻量提示入口。Enter提交、Shift+Enter换行，中文输入法组词不误提交；快捷入口只填入需求，不自动执行。
- Agent Workspace：左列原始需求、真实计划、实际查询到的工具活动；右列真实文字、来源、文件、图片和视频任务。没有模拟浏览器或固定五步百分比；不提供虚假暂停按钮。
- 成果库与任务历史：浏览器已记录的任务、状态和真实成果；打开任务可以重新查询，不冒充全量云端历史。
- Agent邮箱：原有读取、分析、草稿编辑、版本保存、批准和确认发送流程完整迁出至Mailbox组件。默认不自动分析或发送。

用户当前确认仅三大主线，不实现Memory页面。长期主动服务、跨设备任务同步与APNs不在本轮完成范围。

## 文件

修改：V2/web/src/App.tsx、styles.css、V2/web/vite.config.ts、README.md。

新增前端组件：Sidebar.tsx、SpurPulse.tsx、TaskInput.tsx、AgentWorkspace.tsx、Deliverables.tsx、ResultContent.tsx、Mailbox.tsx、Icon.tsx、mailbox.css。

新增任务服务：V2/web/src/taskApi.ts。新增验证：V2/web/tests/task-api.test.mjs。

既有VideoTask.tsx保留，继续查询、恢复查询与下载视频。未删除既有图片、来源、文档和邮件功能。未修改package.json、依赖锁文件或安装依赖。

## 接口与数据处理

POST /api/creator-agent/chat发送requestId、message、history、async:true，202回执校验同一任务编号。提交响应丢失或409只GET原编号，不重复POST。旧同步200结果兼容保留。

每次请求15秒上限；顺序轮询避免重叠。运行任务切换页面后继续查询；刷新从浏览器保存的任务编号恢复查询，不承诺后端重启续跑或无限执行。

本地历史只持久化任务编号、需求、时间、状态和父任务编号；结果及文件URL不作为全量历史落盘。后续任务携带父链最近五轮上下文，不混入其他任务。

结果只使用React文本与安全http(s)链接渲染，不注入模型HTML。Markdown加粗、段落、简单列表与链接格式化；sandbox标记仅显示文件名，实际下载使用后端返回的artifact URL，不拼造映射，不改变签名参数。

## 本地联调与鉴权范围

现有sameLocalOrigin只认可Origin和Host一致且为本机4173；浏览器GET通常不发送Origin，5174开发代理也与4173不同。因此仅调整Vite现有开发代理：默认后端由8788改为4173，changeOrigin=true；只在输入Host为127.0.0.1:5174或localhost:5174、浏览器Origin匹配或Sec-Fetch-Site为same-origin、目标确为本机4173时，适配目标Origin。不给跨站来源补同源身份，不附加Bearer，不向网页发送密钥。

实际本机正常同源health200；Origin=https://example.invalid且Sec-Fetch-Site=cross-site请求503被原后端拒绝。没有修改后端鉴权规则。

本次启动本机后端4173及Vite5174；仅为本次测试进程关闭邮件自动摘要、视频后台任务，未修改已有环境文件。公网api.hispurring.com、ECS及Docker未更新。公网Web用户会话鉴权、全量历史API、更多执行事件流属于后续需求，不能认为本轮已实现。

## 实际验证

1. npm run build通过：TypeScript与Vite生产构建，37 modules；前端包约178KB、gzip约58KB，不含大框架新增。
2. node --test tests/task-api.test.mjs：6项通过（异步提交、回执丢失只GET、409与401、回执ID拒绝、活动去重和原文件URL、父任务上下文隔离）。
3. 浏览器从Home提交真实本地模型任务8cdea753-3fdb-412d-92b4-c961ddb733be，请求只写本机验收说明，不访问外部网站或外部账号。真实观察到save_document、list_documents工具结果，随后任务finished。
4. 真实返回Spur Web UI 验收说明.md，artifact编号d623a55a-e34c-4adb-9d12-89d974578d3f。浏览器文件下载成功，验证文件内容；下载副本位于用户Downloads。模型生成的验收说明文字是测试交付物，不能作为模型亲自检查过UI的证据。
5. 刷新页面后同一任务编号恢复真实结果与文件；成果库显示该真实任务。
6. 邮箱入口读取4封既有来信，无错误；未生成草稿、未点击批准、未发送真实邮件。本轮不宣称重测全部邮件发送链路。
7. 1440、1280、1024与390窄屏检查。1280、1024保持双栏；390单栏并显示移动导航，无横向溢出。支持prefers-reduced-motion。
8. 浏览器控制台检查未发现错误。未对ECS或手机重新部署。

本地体验地址：http://127.0.0.1:5174/。当前任务在侧栏可回看；Home保留空白输入体验，不注入演示历史或假成果。
