# Spur App 真实连接 YouTube 与 Notion：OAuth 实现、部署前置与验收接续

日期：2026-11-05。当前是本地实现记录，不代表云端发布或手机真实授权已完成。

## 用户流程

V2 App → Connect Apps → 展开 YouTube / Notion → 点击连接 → 系统浏览器打开官方授权页面 → 选择自己的账号及权限 → 官方 HTTPS 回调 → 返回 App → 自动/手动核验连接 → Agent 使用该连接身份的授权。

只在真实官方查询成功时显示已连接。取消、过期、失效和网络不可核验分别处理。YouTube 只读，不上传或修改视频；Notion 访问范围由集成权限和用户在官方选择的页面共同决定。其他 App 仍为原有工具选择示例，本轮没有开发其授权。

## 身份与兼容边界

当前工程没有可复用的用户登录/账号后端。本次沿用 ECS Bearer 作为个人内测入口，再由服务器签发随机连接凭据；手机按后端地址保存至 SpurIdentity（iOS Keychain / 原生安全存储）。服务器以凭据哈希作为 profile ID，不接受任意客户端指定的用户 ID。

这是手机连接身份之间的第三方授权分离，不是注册/登录、账号找回、跨设备同步或完整多人 SaaS 隔离。共享 ECS Bearer 仍是管理员级凭据，旧本地网页/旧客户端兼容路径仍可访问开发者共享配置；不能把它当作面向所有用户的最终身份体系。

新 App 的任务必须带 X-Spur-Connection；未连接时不继承开发者的 NOTION_TOKEN、旧 youtube-oauth.json 或 YOUTUBE_API_KEY。旧服务器缺少新接口时明确报错，不静默回退。

## 代码位置（相对 /Users/x/X/space/spur）

- `V2/web/app-connections.mjs`：连接身份、官方授权、Google PKCE、一次性 state、交换/刷新、真实状态、断开、任务授权覆盖。
- `V2/web/server.mjs`：连接路由、公开回调、App 任务配置、独立任务 DSH_HOME、进度归属校验。保留本地开发者流程。
- `V2/appV2/app_mobile/src/services/creatorAgentApi.ts`：连接身份安全存储；任务和进度请求携带身份。
- `V2/appV2/app_mobile/src/services/appConnections.ts`：连接状态、开始、断开 API。
- `V2/appV2/app_mobile/src/components/RealAppConnections.tsx`：真实状态、官方跳转、重连/断开、返回前台刷新、前台授权等待轮询。
- `V2/appV2/app_mobile/src/screens/ConnectAppsScreen.tsx`：保持现有样式，移除 YouTube/Notion 的示例选择项，接入真实组件。
- `V2/web/app-connections.test.mjs`、`app-connections-http.test.mjs`：临时目录、模拟官方响应和隔离 HTTP 测试，不接触真实账号。
- 移动测试：`__tests__/RealAppConnections.test.tsx`、`__tests__/CreatorAgentApi.test.ts`。

## 接口

| 方法与路径 | 身份 | 作用 |
|---|---|---|
| POST /api/creator-agent/connections/profile | ECS Bearer | 签发连接身份，App 安全保存 |
| GET /api/creator-agent/connections | Bearer + X-Spur-Connection | 真实官方只读核验，返回状态/名称，不返回令牌 |
| POST /api/creator-agent/connections/{youtube或notion}/start | 同上 | 返回官方授权 URL |
| POST /api/creator-agent/connections/{youtube或notion}/disconnect | 同上 | 删除本连接授权，使旧回调失效 |
| GET /api/connections/callback/youtube | 一次性 state | 官方浏览器回调，不携带 App Bearer |
| GET /api/connections/callback/notion | 一次性 state | 同上 |
| POST /api/creator-agent/chat | Bearer + X-Spur-Connection | 采用当前连接身份的授权执行 |

回调只输出固定成功/失败文字，不回显 code、state 或令牌，无任意 return URL。

## 持久化与安全

- 正式卷中 `/opt/spur/V2/web/.runtime/app-connections/` 保存加密 profile/state。
- AES-256-GCM、原子替换、文件 0600、目录 0700；`encryption.key` 同卷持久化，不能丢失。
- 卷与备份仍应当作秘密数据；此加密不能防止能读取密钥的服务器管理员。
- state 十分钟过期，交换前消费；重连/断开后旧回调不能复活授权。
- token 刷新合并并保留轮换后的 refresh token；网络故障不清除长期授权。
- 断开阻止后续新任务使用授权，不撤销运行中任务已拿到的 token；官方撤销由用户在官方平台操作。
- 单进程文件存储，扩为多副本前需要事务状态库和独立密钥管理。
- 新增 SPUR_RUNTIME_ROOT / SPUR_CONFIG_FILE 配置仅用于管理员控制的运行目录/配置选择；隔离 HTTP 测试借此避免接触真实运行数据和开发者密钥。

## 官方平台及云端前置

字段存在性检查发现：已有 YOUTUBE_CLIENT_ID/SECRET；NOTION_CLIENT_ID、NOTION_CLIENT_SECRET 和 SPUR_PUBLIC_URL 缺失。没有输出密钥。

在现有 Agent env 基础上补：

```dotenv
SPUR_PUBLIC_URL=https://api.hispurring.com
NOTION_CLIENT_ID=<Notion OAuth应用Client ID>
NOTION_CLIENT_SECRET=<Notion OAuth应用Client Secret>
```

NOTION_TOKEN 是内部集成令牌，不是 OAuth client secret。继续保留现有模型与 ECS Bearer；Google 若当前是 Desktop 客户端，应配置支持 HTTPS 回调的 Web application，不能假定本机 loopback 客户端可直接复用。

Google Authorized redirect URI：

```text
https://api.hispurring.com/api/connections/callback/youtube
```

Google 需要 YouTube Data / Analytics API、youtube.readonly 与 yt-analytics.readonly。测试用户、发布与公开审核以官方控制台真实状态为准。

Notion OAuth 集成回调：

```text
https://api.hispurring.com/api/connections/callback/notion
```

在 Notion 官方平台配置适合目标用户范围的 OAuth 集成、读取/插入/更新能力；让用户选择共享页面。不以开发者内部集成授权替代用户选择。

## Caddy 精确回调例外

官方浏览器回调没有 App Bearer。部署阶段先检查和备份真实 Caddyfile，再将以下互斥处理合并到现有认证规则之前；不是整份替换文件，不放开整个 API。

```caddyfile
@connectionCallback {
    method GET
    path /api/connections/callback/youtube /api/connections/callback/notion
}
handle @connectionCallback {
    reverse_proxy 127.0.0.1:4173
}
# 其余请求保留原有 Bearer 验证，放入默认 handle，确保回调不会再次落入认证拦截。
```

上游示例适用于 Caddy 可访问宿主机回环的现有部署；上线必须核对 network mode 与原 upstream。先 validate 后 reload。本轮没有改云端配置。

## 发布顺序

1. 官方应用配置、云端 env 和 Caddy 回调例外准备好。
2. 用现有 Dockerfile 构建新 linux/amd64 镜像（web/*.mjs 已覆盖新增模块，无新增生产依赖）。上一轮 youtube-notion-v1 digest 不包含本次 OAuth 代码。
3. 独立测试后更新云端，保留原卷、Caddy、备份和回滚容器。
4. 后端先发布，再安装新版 App；新 App 依赖 /connections/profile，不能先覆盖用户已可用的版本。
5. iPhone 内完成两个真实账号授权；验证取消、断开、失效重连和未连接不借用开发者数据。
6. 手机发起搜索→Notion创建测试报告→回读→显示真实链接；第二连接身份不能使用第一连接身份授权。

本轮未实际登录第三方账号、未创建第三方页面、未部署新镜像、未改 Caddy、未覆盖手机 App。

## 官方依据

- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.notion.com/guides/authorization/overview

## 验证结果

见下方后续追加；模拟官方服务测试不能代替真实授权验收。


### 本轮实际检查结果

- 后端 27 项测试通过（包含 8 项连接状态/授权边界测试、1 项隔离 HTTP 测试及原有邮件/鉴权/耗时/视频测试）。无真实第三方授权请求。
- 移动相关 6 套 32 项测试通过；TypeScript 与改动文件 ESLint 通过。
- 全量移动测试：35 套中 34 套通过；243 项中 240 项通过，3 项 AgentDashboard 旧页面断言失败。当前 AgentDashboard 委托 ChatWorkspaceHome；本轮未改首页，不将旧页面断言失败称为通过。
- 网页 `npm --prefix V2/web run build` 通过。
- iOS Release 1.0.2（1040）签名构建 `BUILD SUCCEEDED`，尚未安装。命令：

```bash
cd /Users/x/X/space/spur/V2/appV2/app_mobile
xcodebuild -workspace ios/SuprRing.xcworkspace -scheme SuprRing \
  -configuration Release -destination generic/platform=iOS \
  -derivedDataPath /tmp/spur-app-connections-build \
  CURRENT_PROJECT_VERSION=1040 MARKETING_VERSION=1.0.2 build \
  > /tmp/spur-app-connections-ios-build.log 2>&1
```

构建产物：`/tmp/spur-app-connections-build/Build/Products/Release-iphoneos/SuprRing.app`。
后端尚未更新时不先安装，因为新客户端需要连接身份接口。未把编译成功当成真机授权成功。


### Linux 镜像准备

本地已构建 `spur-agent:app-oauth-v1`，平台 `linux/amd64`，本地 image ID：
`sha256:1e1cf3fc8ba15aaa604b50cdd5edc83eecadd4e5a9e985e5d7dee1cdebec30db`。
尚未推送 ACR，不能把 image ID 冒充已发布的仓库 digest。
镜像内运行 AppConnections 临时连接身份测试返回 `LINUX_CONNECTION_PROFILE_OK`，两个平台均正确显示 disconnected/configured=false；未注入真实凭据，未访问真实第三方。
已明确清除 DSH 子进程继承的 Google/Notion OAuth client secret 和 ECS Bearer，只传工具需要的当前连接 access token。

```bash
cd /Users/x/X/space/spur
docker buildx build --platform linux/amd64 --load -t spur-agent:app-oauth-v1 \
  -f V2/agent/deploy/docker/Dockerfile V2
```

构建日志：`/tmp/spur-app-oauth-docker-build.log`。本地镜像验证不等于云端 OAuth / 浏览器端到端验收。


## 后续部署与真机安装更新（接续实际输出）

以下进展替代上文的对应“待部署/未安装”状态，历史阶段说明保留：

- 用户完成 Google Web OAuth 公网回调登记；Notion 新建 Spur App OAuth 连接并配置内容读写能力。用户在 ECS 隐藏输入凭据，返回 OAUTH_CONFIG_SAVED，未输出秘密。
- Caddy 实际为 host 网络、admin off；不能 reload。首次配置首行检查失败未修改，Python 3.6 又因 text/capture_output 参数不兼容失败。改用兼容版本、仅改鉴权匹配器，validate 后重启 Caddy，保留 admin off 和原鉴权。用户返回 CADDY_CALLBACKS_READY；备份 /root/spur-https/Caddyfile.before-oauth-20261105-233507。
- ACR 已推送 app-oauth-v1，用户返回 digest sha256:1e1cf3fc8ba15aaa604b50cdd5edc83eecadd4e5a9e985e5d7dee1cdebec30db。
- 独立测试容器 spur-agent-oauth-test：health=200、profile=201、connections=200；两个平台 configured=true、state=disconnected。
- 用户执行正式切换步骤后，公网无令牌检查返回：health 401、YouTube callback 400、Notion callback 400，符合认证入口与无效 OAuth state 拒绝行为；未收到该轮 OAUTH_SWITCH_OK/回滚容器名称原文，不编造名称。
- 手机重新连接后，devicectl 显示 available (paired)。本轮实际 install app 返回 App installed，process launch 返回 Launched application；再次查询安装版本为 1.0.2（1040），bundle com.spur.recordingring。
- 安装包：/tmp/spur-app-connections-build/Build/Products/Release-iphoneos/SuprRing.app，签名校验通过。
- 仍待用户在 Connect Apps 中完成两个真实官方授权、核验身份与任务调用。本轮安装不代表账号授权已成功。
