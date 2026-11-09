# Spur Agent 容器化构建与验证记录

> 同日最新：Docker 代理域名绕过已正式应用，原镜像在默认网络的真实模型、网页研究和成果下载均已通过，无需临时通道。见[正式修复与验证记录](完成容器代理域名绕过配置及真实模型直连网页研究和成果下载验证的开发接续记录-2026-11-02.md)。下文保留各阶段历史状态。

> 同日后续进展：已定位当前失败的代理路径，并通过临时受限直连通道完成真实模型文件任务和网页研究；Docker 默认网络尚未正式修复。见[网络定位与真实任务验证记录](定位容器系统代理导致硅基流动连接失败并通过临时直连验证真实模型与网页研究任务的接续记录-2026-11-02.md)。下文保留首次构建时的历史测试结果。

日期：2026-11-02（Asia/Shanghai）。范围：本地 Linux AMD64 镜像构建和测试。未操作阿里云、未推送镜像、未接入 NanoMuse、未修改 Agent 业务代码。

## 结论

已构建并加载本地 `spur-agent:dev`。Ubuntu 24.04、Linux AMD64、非 root 启动、DSH 独立构建、网页、MCP、Chrome、Python、文件工具、成果下载和持久卷测试均有通过证据。

**真实硅基流动模型直连未通过**：容器内 TLS 建连被重置，真实 HTTP 任务返回 502。相同凭据在 Mac 的模型列表接口返回 200。当前只能将问题隔离到容器出站网络路径差异，尚未定位具体 VPN、防火墙或 Docker 网络策略原因，不能宣称完整真实任务闭环通过。

本地模拟 SSE 模型的端到端工具测试已通过，用于验证 HTTP → DSH → save_document → 工具结果返回模型 → 成果下载。这是执行链测试，不是模型效果、真实性能或真实提供商连通性测试。

## 新建文件

- `V2/agent/deploy/docker/Dockerfile`：多阶段构建；从 V2 源码构建 DSH 和网页；运行层 UID/GID 10001，tini 管理进程。
- `V2/.dockerignore`：默认拒绝构建上下文，仅允许当前执行链；再次排除密钥、运行数据、Mac node_modules、构建产物、Git 历史等。
- `V2/web/package-lock.json`：固定原本已安装的直接依赖版本，补齐 Linux 可选包。原 package.json 未修改。
- `V2/agent/deploy/docker/healthcheck.mjs`：调用现有健康接口，非 ready 返回失败。
- `V2/agent/deploy/docker/smoke.cjs`：实际运行时、Python 辅助脚本加载、文件读写、MCP stdio、网页导航/快照、SSRF 拦截测试。
- `V2/agent/deploy/docker/offline-loop-smoke.cjs`：本地模拟模型驱动的 HTTP/DSH/工具执行及成果下载验证。
- `V2/agent/deploy/docker/seccomp-playwright.json`：未修改的 Playwright 官方浏览器 sandbox 配置。
- `V2/agent/deploy/docker/PLAYWRIGHT-LICENSE`：上述上游配置的 Apache-2.0 许可文本。
- `V2/agent/deploy/docker/agent.env.example`、`.gitignore`、`README.md`：配置示例、敏感配置/测试日志排除及操作指南。
- 本记录。

DSH/MCP 源码、package.json、原有锁文件、网页 server.mjs、邮件模块和工具业务逻辑未修改。

## 版本和镜像信息

| 项目 | 实际值 |
| --- | --- |
| 镜像 | `spur-agent:dev`，仅在本机 |
| 本地 image ID | `sha256:24d3fc5e2e1ec3d80ed5684ef51caa21fd2712d29f808c49802788310a787d84` |
| 系统/架构 | Ubuntu 24.04 / linux/amd64；运行进程 process.arch 为 x64 |
| Node | 24.22.1，与本机 Harness 选择的 Node 版本一致 |
| Python | 3.12.3，Ubuntu 安全更新包 |
| DSH | 0.1.1-rc.2，V2 源码独立构建 |
| pnpm | 11.7.0，构建阶段使用 |
| Playwright MCP | 0.0.83 |
| Playwright | 1.65.0-alpha-2026-10-30 |
| MCP SDK | 1.32.0，保留运行所需的上游 devDependency |
| Chrome | Google Chrome 156.0.8078.79 |
| 运行用户 | UID/GID 10001:10001 |
| 内容大小 | Docker 报告 734 MB；inspect Size = 734,463,718 bytes |
| 本地磁盘占用 | Docker 报告 3.22 GB，与内容大小口径不同 |

Ubuntu 基础镜像固定摘要；Node 官方 Linux AMD64 二进制固定版本并核验官方 SHA-256。Chrome 由锁定版本 Playwright 的安装器从 Google stable 源安装；未来完全无缓存重建可能获取新的 Chrome，因此发布镜像应使用不可变摘要，或后续增加 Chrome 安装包固定/归档策略。

运行镜像未复制主工程 DSH 的产物；V2 之外的回退路径 `/opt/spur/agent` 不存在。主工程与 Mac node_modules 未进入构建上下文。编译器未复制进最终层；DSH 的 workspace 依赖暂完整保留，后续可做经过回归验证的体积精简。

## 构建命令

工作目录：`/Users/x/X/space/spur`。

```bash
docker buildx build --platform linux/amd64 --load -t spur-agent:dev -f V2/agent/deploy/docker/Dockerfile V2
```

实际工具终端 PATH 未包含 Docker，执行时增加 `/Applications/Docker.app/Contents/Resources/bin` 到该命令的 PATH，未修改全局配置。

构建中执行 `pnpm install --frozen-lockfile`、`pnpm run build:lib`、网页 `npm ci` 和 `npm run build`。DSH Host/Client 与网页构建均通过。

## 测试结果

| 检查 | 结果与证据 |
| --- | --- |
| 镜像构建、加载 | 通过，Buildx 退出码 0 |
| Linux AMD64 / Ubuntu 24.04 / 非 root | 通过，运行时断言和 image inspect 双重确认 |
| DSH CLI | `--version` 返回 0.1.1-rc.2 |
| Node/Python/Chrome | 版本命令通过；Python 实际 research.py 及其标准库依赖加载通过 |
| 网页 | GET `/` 返回 200 |
| 健康接口 | 配置运行时聊天凭据后返回 ready/200，Docker 状态 healthy；不等于模型连通性验证 |
| 文件工具 | 实际保存/读回一致，返回 SHA-256 |
| MCP | 实际 stdio 连接、工具注册通过 |
| 私网保护 | 127.0.0.1 与 169.254.169.254 导航均拒绝 |
| Chrome 默认 Docker 策略 | 失败：创建 namespace 时 Operation not permitted |
| Chrome 加官方 seccomp 策略 | 通过：实际导航 example.com、快照读取均含 Example Domain；未使用 --no-sandbox、privileged 或 SYS_ADMIN |
| 模拟模型端到端任务 | 通过：2 次模型请求，1 次 save_document，HTTP 200；成果下载 200 且字节匹配。模拟模型不代表真实模型完成率 |
| 真实模型端到端任务 | 未通过：HTTP 502，DSH 报 TRANSPORT Connection error；底层 Node fetch 为 TLS 建连前 ECONNRESET |
| 网络对照 | 容器 curl 与 Node 都失败；Mac curl/Node 可连接，同一 Key 的模型列表接口返回 200。尝试本地已有代理和不同解析地址仍未解决；未硬编码 IP 到产品配置 |
| 持久卷 | UID 10001 写入标记，移除原容器后由新容器读回，通过；测试标记已清理。仅验证文件持久化，不代表普通任务能自动恢复 |
| 凭据检查 | 允许源码中未匹配到本地真实密钥值；镜像 Config.Env 无 SiliconFlow/AgentMail Key；镜像内无硅基流动 env 文件 |

本轮未测试真实邮件收发、图片/视频生成及多用户访问；没有执行邮件发送或付费媒体生成。真实模型任务在建立连接时失败，不计为完成。

## 本地运行

先建立持久卷：

```bash
docker volume create spur-agent-runtime
```

运行时注入配置，仅开放本机端口：

```bash
docker run -d --name spur-agent-local --platform linux/amd64 --shm-size=1g --security-opt seccomp=V2/agent/deploy/docker/seccomp-playwright.json --env-file V2/agent/config/siliconflow.env -p 127.0.0.1:4183:4173 -v spur-agent-runtime:/opt/spur/V2/web/.runtime spur-agent:dev
```

Docker env-file 不进行 shell 变量替换，也不去掉引号；如现有配置不符合格式，复制 agent.env.example 到被 Git 忽略的 agent.env 并手工配置，不打印密钥。实际本轮验证使用权限 0600 的临时 env，仅注入模型聊天配置；临时文件与测试容器已清理，镜像和持久卷保留，本机原 4173 服务未修改。

无付费 API 的运行时冒烟：

```bash
docker exec -i spur-agent-local node < V2/agent/deploy/docker/smoke.cjs
```

模拟模型端到端测试：

```bash
docker run --rm -i --platform linux/amd64 --shm-size=1g --security-opt seccomp=V2/agent/deploy/docker/seccomp-playwright.json spur-agent:dev node < V2/agent/deploy/docker/offline-loop-smoke.cjs
```

## 失败项与下一步

1. **尚未通过真实模型直连。** 先核对 Docker Desktop / VPN 对容器的出站路径及策略，或在经授权的独立 AMD64 测试环境验证；解决后重新执行真实 HTTP 工具任务，不能仅凭本次健康接口上线。
2. **Chrome 需要合适的运行时 namespace/seccomp 支持。** 官方配置本机测试通过；ACK 需要管理员确认可实施的策略及权限，并验证节点内核/AppArmor等边界。不能为了运行而默认改为 root、privileged 或关闭浏览器沙箱。
3. **业务部署门槛仍在。** 对外开放前需鉴权、Secret、PVC、Ingress/TLS、资源配额和出站策略；普通任务恢复、成果索引、多副本状态等不是本次容器化已解决的问题。
4. **构建可重现性与体积。** 核心版本和锁文件已保留；Chrome stable、Ubuntu 软件包仍随上游变化，最终发布应固定镜像摘要并保留构建记录。当前磁盘占用 3.22 GB，可后续缩减不被 headless 执行链使用的依赖，但不应未经测试直接裁剪。

前期基础镜像元数据拉取停滞，改为校验 Node 官方二进制；首次添加的非必要 fonts-noto-cjk 包下载连接失败，移除该额外包后继续构建成功。DSH 安装出现大包下载重试和编译前 demo bin 产物未生成警告，最终安装与构建成功，未通过更换依赖版本绕过。

## 证据与上游来源

本机证据保存在被 Git 和 Docker 上下文排除的 `V2/agent/deploy/docker/.build/`：build.log、first-download-failure.log、image.json、health.json、smoke.log（默认策略失败）、smoke-seccomp.log（通过）、offline-loop.log（通过）、chat.json（真实失败）、container.log、volume.log。

seccomp 来源：[Playwright Docker 文档](https://playwright.dev/docs/docker)、[官方原文件](https://github.com/microsoft/playwright/blob/main/utils/docker/seccomp_profile.json)。下载原文件未修改，SHA-256 为 `cc3e61cabda6bbc1e53e54d27ba4d55a9d3be829b6dd1a596f4a7b31b1cc7849`，许可文本随文件保留。
