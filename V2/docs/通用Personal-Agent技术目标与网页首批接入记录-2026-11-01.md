# 通用 Personal Agent 技术目标与网页首批接入记录

日期：2026-11-01，Asia/Shanghai。

## 已对齐目标

Spur 是具备通用能力的 Mobile-first Personal Agent。创作者是商业切入点，不是工具与任务边界。目标执行链为：理解目标 → 规划 → 选择工具 → 执行 → 检查结果 → 依据反馈继续推进。

以未预设的真实任务完成情况验收，不以 Demo 数量、工具数量或仓库数量验收。DSH、NanoMuse、OpenClaw 均按效果与部署成本评估，不要求保留某一框架。网页先验证，执行层后续供手机 App 复用。

## 本批实现

只修改 V2，自有适配代码放在 tools 和 web，上游源码、原工程、邮件收发模块未修改。当前网页仍由 DSH 执行；启动器优先使用 V2 内已构建的 Harness，缺失时只读复用主工程已构建副本（本次实际走此 fallback），迁云前仍需补齐 V2 自身的可重复构建；NanoMuse 和 OpenClaw 未接入本批执行链。

- `agent/tools/playwright-browser/index.cjs`：将浏览器从品牌域名白名单改为公开 HTTP/HTTPS 网络访问；开放 browser_navigate、browser_snapshot、web_search、web_fetch。
- 搜索支持 Bing 静态结果提取及浏览器搜索；Google、DuckDuckGo 可作为浏览器搜索替代。搜索页空白、验证码或访问失败不是有效搜索结果。没有宣称接入付费搜索 API。
- MCP 默认返回快照文件链接；适配器现在读取受限路径内的快照正文交给模型，优先保留 main 内容。否则仅返回文件路径，模型实际上看不到正文。
- `public-network.cjs`：每个请求解析并检查全部 DNS 答案，实际连接已验证数字 IP；新连接重新检查，避免验证后再次 DNS 解析。浏览器走本机受控代理，重定向和子资源也经过该代理。静态 fetch 使用相同目标策略。
- 拒绝本地、内网、链路本地、云元数据、保留网段及非全局 IPv6 地址；只支持 HTTP/HTTPS 标准端口。不关闭 TLS 证书验证。
- `read-only-page.cjs`：只允许 GET/HEAD；禁用 Service Worker、WebSocket 和下载；浏览器禁用 QUIC、限制非代理 WebRTC UDP。没有开放任意脚本执行工具、表单提交或登录操作。
- YouTube 专用元数据/字幕工具保留；网页不再暴露旧 creator_search/creator_read_source，避免通用请求被导向视频工具。专用 Python 网络请求也通过本轮代理。
- `personal-workspace/index.cjs`：update_plan、save_document、read_document、list_documents，文件限制在本轮任务 documents 目录。支持 Markdown、纯文本、CSV、JSON，不要求每次都生成“报告+大纲+Prompt”三件套。
- `web/server.mjs`：改为通用 Agent 提示词，提供任务状态接口、计划、工具活动和文件下载；明确不能把“打开网页”视为“完成任务”。超时即失败，即使 Harness 优雅退出返回 0，也不能伪报成功。
- `web/src/App.tsx`：保留现有网页布局，改为 Personal Agent 入口，显示任务活动、计划和文件。中文文件名使用 RFC 5987 下载头。

## 已完成的验证

- 网络策略 4 个测试通过：私网/元数据/保留地址、混合 DNS 答案、DNS 重绑定与 IP 固定连接、私网请求拒绝。
- 真实 Chromium 测试通过：测试页重定向、子资源及 POST 尝试均未触达本机测试服务。
- 任务文件测试通过：计划更新、保存/读取/列举文件、目录穿越阻止。
- 真实 Playwright MCP 浏览：example.com、huawei.com、apple.com、speedtest.net、mozilla.org 可打开；speedtest 正文 9,478 字符、Mozilla 正文有返回。localhost 被阻止。
- wikipedia.org、DuckDuckGo 在本机网络出现超时；这是实际访问失败，不能列为读取成功。
- Bing 静态 HTML 可提取真实标题、链接与摘要；搜索质量受当前地区与引擎影响，不承诺相关性或全网覆盖。
- TypeScript 检查及 Vite 构建通过。

## 端到端测试与问题

首轮 Firefox/Safari 研究执行了搜索、多站点浏览和初始规划，但遍历过多来源，未在时限内生成文件。不能记作任务成功。已据此补充来源够用即交付、限制同一阻碍的替代次数、静态正文读取和任务进度显示。

调整后端到端通过：任务为比较 Speedtest 与 Cloudflare Speed Test。实际运行时间 10:50:17 至 10:55:31（约 313 秒）。Agent 自主规划、读取两家官方来源、遇到 404 后选择其他官方路径、撰写报告、调用 save_document、read_document 读回检查，最后将四步计划置为 completed。

- 运行编号：`fe2d0998-b95f-4341-981c-c0f459960eab`。
- 报告：`web/.runtime/runs/fe2d0998-b95f-4341-981c-c0f459960eab/documents/Speedtest与Cloudflare测速对比及三步清单.md`，6,752 字节。
- HTTP 下载 200，中文文件名下载头通过检查。
- 完整 API 回执：`web/.runtime/personal-agent-e2e-final.json`。
- 任务状态接口可返回运行状态、实际工具活动和计划。
- 网页 Personal Agent 入口已由真实 Chromium 打开验证。
- 邮件模块原有 7 个测试通过，未发送测试邮件。
- 本次测试不是测速任务，未点击开始测速、未生成虚构测速数据。整体耗时仍明显需要优化，不能据一次通过声称已达到成熟平台体验。

后续测试证据记录在 `web/.runtime/validation/`、`web/.runtime/runs/`。这些是本地执行数据，不提交密钥或邮箱内容。端到端结果必须核查来源、文件实际存在、内容与计划状态，不能只看 Harness 退出码。

## 尚待建设的技术能力

本批是通用公开资料研究与任务文件交付的第一步，不代表已经完成成熟 Personal Agent 全部能力。后续仍需逐项落地：

1. 隔离的代码执行与文件上传/解析/办公出件。
2. 可恢复任务队列、取消/重试/幂等与进程重启恢复。当前 HTTP 请求同步等待；task.json 是状态记录，不是恢复调度器。
3. 服务端会话、长期记忆与用户反馈导致的任务状态更新。当前历史由网页传入最近对话，不等于长期记忆。
4. 授权连接器、跨应用操作与统一外部动作审批。
5. 定时、事件触发、通知和持续跟进。
6. 云端多用户身份、凭证隔离、容器及网络出口控制。应用代理不等于操作系统级沙箱；部署阿里云仍需独立验收。
7. 真实多领域任务集，统计完成质量、失败率、耗时与成本。

不能通过直接打开本机 shell、取消所有限制，或声称克隆 NanoMuse 就已接通上述能力来代替这些工作。
