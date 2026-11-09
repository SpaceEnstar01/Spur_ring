# Playwright MCP 接入 DSH 与公开网页读取验证记录

日期：2026-10-31

## 目标

在 Spur 网页 Creator Agent 中接入微软 Playwright MCP，让 DeepSeek Harness 可以自主打开公开网页、读取页面快照，并保留来源与调用日志。首轮范围仅限只读网页研究；不开放登录、表单填写、页面脚本、文件上传或邮件发送。

## 文件位置与调用关系

- 上游 Playwright MCP：`V2/agent/runtime/mcp-servers/playwright-mcp/`
- Spur 的受限浏览器桥接：`V2/agent/tools/playwright-browser/index.cjs`
- 网页服务的 Harness 配置：`V2/web/server.mjs`
- 每轮工具日志与证据：`V2/web/.runtime/runs/<run-id>/tool-events.jsonl` 与 `evidence/`
- 独立页面快照：`V2/files/playwright-mcp/standalone-example-domain-snapshot.yml`

当前网页服务优先寻找 V2 中已构建的 DSH，若不存在则回退到主工程 DSH。此次检查发现 V2 DSH 复制件尚无 CLI 构建产物，因此网页运行时使用主工程现有的已构建 DSH；没有修改主工程。网页通过已有的绝对路径插件加载能力，加载 V2 的 Spur 浏览器桥接。桥接通过 stdio 启动克隆目录中的 Playwright MCP CLI，并通过 MCP SDK 转发调用。

## 首轮限制

桥接仅注册两个 Spur 工具：

- `creator_browser_navigate`：打开白名单内的 HTTPS 页面。
- `creator_browser_snapshot`：读取当前页面的结构化快照。

白名单初始包含 `example.com` 及 YouTube 相关 HTTPS 来源。桥接不向模型注册 Playwright 的点击、输入、上传、页面脚本等其他工具。网页文本作为不可信资料处理。白名单校验针对导航 URL；Playwright MCP 本身不是完整网络隔离边界，因此本地验证结果不能当作云端安全验收。

Playwright MCP 以无头 Chrome、隔离浏览上下文启动。用独立 MCP 客户端确认服务发现到 25 个上游工具，但只在 Spur 桥接中暴露上述两个工具。

## 验证结果

1. `npm ci` 安装成功。npm 报告依赖中有 3 项安全公告（1 项 moderate、2 项 high）；本轮未自动升级依赖。
2. Playwright 自带 Chromium 从官方 CDN 下载超时。Mac 上已有 Google Chrome，因此使用现有 Chrome 验证，无需下载 Chromium。
3. 独立 MCP 测试成功打开 `https://example.com/`，快照标题为 `Example Domain`，并读到实际页面文本。
4. 网页服务通过独立测试端口调用真实 DSH，模型先后调用 `creator_browser_navigate` 和 `creator_browser_snapshot`，答复与页面内容一致，并返回 `https://example.com/` 来源。
5. 本机地址 `http://127.0.0.1:4174/` 被桥接拒绝，原因是协议不是 HTTPS 且 origin 不在白名单。
6. 网页服务通过 `127.0.0.1:4173` 的真实 DSH 请求搜索 YouTube `paris travel vlog`，页面快照包含真实标题、频道、缩写播放量、时长和视频链接；模型答复按页面可见信息整理，来源为 YouTube 搜索结果页。
7. `node --check` 检查服务端和桥接脚本通过；`npm run build` 网页构建通过。

网页验证运行记录：

- 成功读取：`V2/web/.runtime/runs/1793449284671-cb0e60a8/`
- 白名单拒绝：`V2/web/.runtime/runs/1793449368515-5351015b/`
- YouTube 搜索：`V2/web/.runtime/runs/1793449708045-9f712939/`

## 未验证事项

- 已通过 DSH 实测 YouTube 搜索结果页；尚未通过浏览器打开单个视频页，也未验证播放页上字幕、发布日期和完整元数据链路。
- `creator_search` Python 工具仍可能遇到 DNS 私网校验拒绝或 TLS 连接失败；Playwright 工具现为另一条独立浏览器路径。
- 浏览器读取的是页面可访问文本，不代表视频画面观察或完整字幕获取。
- 云端部署、多人隔离、身份认证和真实外部操作均未验收。未来接入航班、酒店、票务等站点时，需要有意识地扩展域名与权限，并重新测试。
