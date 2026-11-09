# Spur Agent Linux AMD64 容器

只部署当前网页 Agent 执行链。不会启动 NanoMuse、OpenClaw、Java 后端或原音频服务。

2026-11-02 最新验证：已在本机 Docker 默认网络完成真实模型文件任务及网页研究/成果下载。此前 TLS 阻塞通过 Docker Desktop 的容器代理域名绕过解决，未更换镜像或关闭 TLS；详见[正式修复与验证记录](../../../docs/完成容器代理域名绕过配置及真实模型直连网页研究和成果下载验证的开发接续记录-2026-11-02.md)。Mac 上容器代理现为手动沿用 `127.0.0.1:7897`，保留原例外并增加 `api.siliconflow.cn`；未来系统代理端口改变时需同步 Docker。这是本机设置，不应复制到镜像或 ACK。

## 构建

在项目根目录 `/Users/x/X/space/spur` 执行：

```bash
docker buildx build --platform linux/amd64 --load -t spur-agent:dev -f V2/agent/deploy/docker/Dockerfile V2
```

Docker CLI 所在目录需要在 PATH 中；Docker Desktop 的 CLI 在 `/Applications/Docker.app/Contents/Resources/bin`。构建不需要 API Key。

构建上下文仅为 V2，`.dockerignore` 默认拒绝，仅允许当前执行链源码，再排除敏感配置、运行数据、本机 node_modules 和构建产物。DSH 使用 pnpm 11.7.0 与现有锁文件在 Linux 内构建。Node 24.22.1 官方 Linux AMD64 二进制经过 SHA-256 校验，匹配本机实际使用的 Harness Node 版本。

MCP 保留 0.0.83 / Playwright 1.65.0-alpha-2026-10-30；不修改当前 `--browser chrome` 配置。镜像通过此版本 Playwright 的安装器安装 Google Chrome 与系统依赖。Google Chrome 来自上游 stable 安装源，其实际版本须记录在构建/测试报告；从头重新构建时可能变化，镜像发布后应以不可变镜像摘要部署。

网页锁文件固定当前已安装的直接依赖版本并补齐 Linux 平台的可选包。DSH/MCP 的原锁文件不变。

## 本地运行

创建持久卷：

```bash
docker volume create spur-agent-runtime
```

从项目根目录启动，仅绑定本机回环地址：

```bash
docker run -d --name spur-agent-local --platform linux/amd64 --shm-size=1g --security-opt seccomp=V2/agent/deploy/docker/seccomp-playwright.json --env-file V2/agent/config/siliconflow.env -p 127.0.0.1:4183:4173 -v spur-agent-runtime:/opt/spur/V2/web/.runtime spur-agent:dev
```

不要提交或将上述 env 文件复制到镜像。Docker 的 env-file 是字面值，不会执行 `${VAR}` 替换，也不会按 shell 方式去掉引号；其中值需使用适合 Docker 的格式，或单独创建权限受限的部署 env 文件。不要为了调试打印环境变量内容。若改用宿主机目录挂载，需要先让 UID/GID 10001 具备写权限。

```bash
curl --fail http://127.0.0.1:4183/api/creator-agent/health
```

### Personal Agent API 鉴权

网页同源本机请求可继续使用本机服务。所有来自外部客户端的 `/api/creator-agent/*` 请求必须携带 `Authorization: Bearer <token>`；未配置或令牌格式不符合 32 字节 base64url（43 个字符）时，外部请求会失败关闭。App 在设置页保存该令牌时使用 iOS Keychain 或 Android Keystore，不写入 AsyncStorage。报告、图片等成果链接使用 30 天有效的 HMAC 签名。

硅谷 ECS 的受限 env 文件需单独加入 `SPUR_CREATOR_AGENT_TOKEN`，权限设为仅 root 可读，并将同一令牌填入 V2 App 的 Personal Agent 设置。示例生成命令会输出秘密，运行时不要录屏、复制到聊天、shell 命令参数、日志或 Git：

```bash
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='
```

配置令牌后重建容器；宿主机仍只映射 `127.0.0.1:4173`。外部 HTTPS 反向代理只应转发到该本机映射并保留 `Authorization` 请求头；代理超时需覆盖最长八分钟任务。不要开放 4173 公网安全组规则。该单令牌适用于个人内测，轮换会同时撤销所有已配置 App 的访问；它不是多用户、逐设备撤销体系。

```bash
docker logs --tail 80 spur-agent-local
```

## 无付费 API 的执行能力冒烟

```bash
docker exec -i spur-agent-local node < V2/agent/deploy/docker/smoke.cjs
```

检查非 root、Ubuntu 版本、AMD64、Node/Python/Chrome、实际文档读写、MCP stdio 初始化、公开网页导航/快照及内网/云元数据阻止。浏览器会访问 example.com，需要公网网络。该脚本不调用模型、生成媒体或发送邮件。

健康检查只检查基础配置与路径，不能证明 API Key 有效或模型可用；必须另做真实 HTTP 聊天验证。未配置有效模型密钥时，服务可以监听端口但健康接口应返回 503。

本机默认 Docker seccomp 实测阻止 Chrome 创建 namespace，Chrome 会崩溃；上面的 `seccomp-playwright.json` 为 Playwright 官方提供的配置，在保留 syscall 默认拒绝策略的同时允许浏览器所需的 namespace 操作。非 root 和 Chrome 沙箱保持启用，不使用 privileged 或 `--no-sandbox`。ACK 上需要由集群管理员评估对应 seccomp/namespace 策略，不能假设默认 RuntimeDefault 就能运行。

配置来源：[Playwright 官方 Docker 指南](https://playwright.dev/docs/docker) 与 [seccomp 原文件](https://github.com/microsoft/playwright/blob/main/utils/docker/seccomp_profile.json)。2026-11-02 下载内容 SHA-256：`cc3e61cabda6bbc1e53e54d27ba4d55a9d3be829b6dd1a596f4a7b31b1cc7849`；原文件未修改，Apache-2.0 许可文本保存在 `PLAYWRIGHT-LICENSE`。

无需真实模型的完整 HTTP/DSH/工具往返测试（本地模拟 SSE 模型，明确不能代替真实模型测试）：

```bash
docker run --rm -i --platform linux/amd64 --shm-size=1g --security-opt seccomp=V2/agent/deploy/docker/seccomp-playwright.json spur-agent:dev node < V2/agent/deploy/docker/offline-loop-smoke.cjs
```

## ACK 部署前提

- 节点架构与镜像 AMD64 一致，资源请求/配额足够；首轮单副本。
- 通过 Secret 注入模型和 AgentMail 凭据，不写入 Deployment 明文仓库。
- PVC 挂载 `.runtime`，检查 UID/GID 10001、fsGroup 及磁盘写权限。
- Service 对接 4173，Ingress/TLS 前增加访问鉴权；HTTP 任务可能持续数分钟，需匹配网关超时。
- 为 Chrome 提供合适的 `/dev/shm`；核对集群 seccomp/用户命名空间与浏览器沙箱兼容性，不默认启用 privileged。
- 网络策略允许必要公网 DNS/HTTPS 和现有本机 MCP/公开网络代理；保留工具 SSRF 防护。
- 采用镜像摘要、回滚版本与离机备份；不要把单副本文件存储当作分布式任务系统。

当前业务限制：普通执行中任务不能保证跨进程恢复，部分成果链接依赖进程内映射；不能仅凭 PVC 就宣称所有任务和旧链接重启恢复。容器化不自动解决多用户鉴权、任务调度、邮件重复发送窗口等业务可靠性问题。


## App 自行连接 YouTube / Notion（2026-11-05 本地新增，待部署）

新 App 使用独立连接身份与官方 OAuth，不继承开发者共享连接器凭据。部署须配置 SPUR_PUBLIC_URL、Google Web OAuth 和 Notion OAuth 客户端，并在 Caddy 中仅对两个 GET 回调放行；其余 API 保留鉴权。必须先部署后端，再安装依赖新连接接口的 App。完整路径、接口、测试结果和限制见 [App OAuth 实现与接续](../../../docs/Spur手机App真实连接YouTube与Notion的OAuth实现接口部署前置配置及验收接续记录-2026-11-05.md)。旧 youtube-notion-v1 镜像不包含本次新增代码。
