# 从新建 spur_agent 独立 ECS 到 Docker 镜像拉取、Chrome 沙箱、Playwright MCP 及真实模型端到端验证完整操作记录

日期：2026-11-03（Asia/Shanghai）  
用途：从新建独立 ECS 开始，记录 Spur Agent 容器验证的实际步骤、终端命令、输出和当前状态，便于以后按步骤复现。

## 三句话概览

新建独立 ECS spur_agent，在 Alibaba Cloud Linux 3 上安装 Docker，并从 ACR 拉取已验证的 linux/amd64 镜像。保持非 root 用户和 Chrome 沙箱，先后通过 Chrome、Playwright MCP、真实模型请求和模型驱动的浏览器访问验证。Agent 当前只绑定 ECS 本机 127.0.0.1:4173；公网访问未开放，Mac 浏览器 SSH 隧道尚待执行。

## 环境与镜像

| 项目 | 已观察到的值 |
|---|---|
| ECS 名称 | spur_agent |
| 地域／可用区 | 华东1（杭州）／B |
| 系统 | Alibaba Cloud Linux 3.2104 LTS 64 位 |
| 架构／规格 | x86_64／4 vCPU、8 GiB |
| ECS 公网 IP | 47.96.149.37 |
| 公网带宽 | 1 Mbps |
| 登录用户 | root |
| ACR 仓库 | aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent |
| 镜像版本 | dev-20261102-01，按 digest 拉取 |
| 镜像 digest | sha256:24d3fc5e2e1ec3d80ed5684ef51caa21fd2712d29f808c49802788310a787d84 |
| ECS 镜像平台 | linux/amd64 |
| ECS 镜像 ID | sha256:1854df208b81442bc66c31b70c850cf86590d41ae280a8d055d36c81b285fa86 |

ACR 密码、ECS root 密码、SiliconFlow API Key 均未写入本文。

## 1. ECS Workbench：核对主机和 user namespace

进入阿里云控制台 spur_agent 实例的远程连接／Workbench，确认这是新 ECS 而非 ACK Workbench。执行：

    whoami
    hostname
    cat /etc/os-release | head -6
    uname -m
    sysctl -n user.max_user_namespaces
    sysctl -n kernel.unprivileged_userns_clone
    unshare -Ur true && echo USERNS_OK || echo USERNS_BLOCKED
    docker --version 2>&1 || echo DOCKER_NOT_INSTALLED

实际输出摘要：

    root
    iZbp1b77lxfd9lbz4j8uzvZ
    Alibaba Cloud Linux 3 (OpenAnolis Edition)
    x86_64
    29689
    1
    USERNS_OK
    DOCKER_NOT_INSTALLED

结论：这台 ECS 主机允许 user namespace；与此前 ACK 容器内 user.max_user_namespaces=0 的情况不同。仍需在容器内实测 Chrome。

## 2. ECS Workbench：安装 Docker CE、Buildx 和 Compose

在 spur_agent ECS Workbench 以 root 执行。命令依据：[阿里云 Linux Docker 安装说明](https://www.alibabacloud.com/help/zh/ecs/user-guide/install-and-use-docker)，含 Alibaba Cloud Linux 3 专用 DNF 兼容插件。

    wget -O /etc/yum.repos.d/docker-ce.repo http://mirrors.cloud.aliyuncs.com/docker-ce/linux/centos/docker-ce.repo
    sed -i 's|https://mirrors.aliyun.com|http://mirrors.cloud.aliyuncs.com|g' /etc/yum.repos.d/docker-ce.repo
    dnf -y install dnf-plugin-releasever-adapter --repo alinux3-plus
    dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
    docker version
    docker buildx version
    systemctl is-active docker

实际确认：

    Buildx: github.com/docker/buildx v0.14.0 171fcbe
    systemctl is-active docker: active

用户粘贴的 docker version 输出不完整，故不推断具体 Client／Server 版本。

## 3. ECS Workbench：确认 ACR 出口和网络

先查 ECS 实际公网出口：

    curl --noproxy '*' -4 --connect-timeout 10 --max-time 20 https://myip.ipip.net

实际输出：

    当前 IP：47.96.149.37 来自于：中国 浙江 杭州 阿里云

访问 ACR 的首次测试超时，命令为：

    curl --noproxy '*' -Iv --connect-timeout 10 --max-time 20 https://aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/v2/

将实际出口添加到 ACR 实例 aed-acr 的公网访问白名单：

    47.96.149.37/32

白名单生效后重试同一 curl。实际收到 TLS 证书验证成功、Registry 响应头 docker-distribution-api-version: registry/2.0、Bearer challenge 和 HTTP 401。未认证探测返回 401 是正常结果，表示网络/TLS 已通，不表示登录失败。

## 4. ECS Workbench：登录 ACR 并拉取镜像

登录使用 ACR 专用访问密码，不是 ECS root 密码或 Mac 密码。终端输入密码时不显示字符：

    docker login --username=aierdream aed-acr-registry.cn-hangzhou.cr.aliyuncs.com

用户确认返回：

    Login Succeeded

使用不可变 digest 拉取本次已上传的镜像：

    docker pull aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent@sha256:24d3fc5e2e1ec3d80ed5684ef51caa21fd2712d29f808c49802788310a787d84

检查镜像：

    docker image inspect aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent@sha256:24d3fc5e2e1ec3d80ed5684ef51caa21fd2712d29f808c49802788310a787d84 --format 'OS={{.Os}} ARCH={{.Architecture}} SIZE={{.Size}} ID={{.Id}}'

实际输出：

    OS=linux ARCH=amd64 SIZE=2185407491 ID=sha256:1854df208b81442bc66c31b70c850cf86590d41ae280a8d055d36c81b285fa86

## 5. Mac 本地终端：传 Chrome 沙箱 seccomp 配置

从项目把 Playwright MCP 使用的受限 seccomp 配置传到 ECS：

    scp /Users/x/X/space/spur/V2/agent/deploy/docker/seccomp-playwright.json root@47.96.149.37:/root/seccomp-playwright.json

确认主机指纹时用户输入 yes；密码提示输入 ECS root 登录密码。SCP 返回 100% 13KB。本地文件 SHA-256：

    cc3e61cabda6bbc1e53e54d27ba4d55a9d3be829b6dd1a596f4a7b31b1cc7849

后续以此配置运行 Chrome，使用镜像默认非 root UID/GID 10001:10001、保留 Chrome 沙箱；没有使用 privileged 或 --no-sandbox。

## 6. ECS Workbench：Chrome 空白页沙箱测试

    docker run --rm --platform linux/amd64 --shm-size=1g --security-opt seccomp=/root/seccomp-playwright.json --user 10001:10001 --entrypoint /opt/google/chrome/chrome aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent@sha256:24d3fc5e2e1ec3d80ed5684ef51caa21fd2712d29f808c49802788310a787d84 --headless --no-first-run --user-data-dir=/tmp/chrome-spur-ecs-test --dump-dom about:blank

实际结果：输出若干 D-Bus/system bus 不可用提示后，Chrome 成功返回：

    <html><head></head><body></body></html>

没有 namespace 拒绝或 Zygote 崩溃；Chrome 沙箱启动测试通过。无桌面容器没有 D-Bus 服务，相关提示未阻止 Chrome 启动。

## 7. Mac 本地终端：传项目 Playwright MCP 冒烟脚本

    scp /Users/x/X/space/spur/V2/agent/deploy/docker/smoke.cjs root@47.96.149.37:/root/smoke.cjs

## 8. ECS Workbench：完整 MCP／浏览器／SSRF 冒烟

    docker run --rm --platform linux/amd64 --shm-size=1g --security-opt seccomp=/root/seccomp-playwright.json --volume /root/smoke.cjs:/tmp/smoke.cjs:ro --entrypoint /usr/local/bin/node aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent@sha256:24d3fc5e2e1ec3d80ed5684ef51caa21fd2712d29f808c49802788310a787d84 /tmp/smoke.cjs

实际输出：

    MCP initialized [ 'browser_navigate', 'browser_snapshot' ]
    SSRF loopback and metadata blocked
    Chrome navigation and snapshot passed
    SMOKE PASS

通过：Playwright MCP stdio 初始化、Chrome 导航与快照、公开网页访问、loopback 与云元数据地址拦截。该脚本不调用真实模型，也不启动常驻 Agent HTTP 服务。

## 9. Mac 本地终端：只传 SiliconFlow 配置，不传 AgentMail

本地配置文件 V2/agent/config/siliconflow.env 还包含其他服务凭据，因此只筛选模型测试所需字段，创建权限为 600 的临时文件，传输后删除本地临时文件：

    grep -E '^(SILICONFLOW_API_KEY|SILICONFLOW_BASE_URL|SPUR_CHAT_MODEL)=' /Users/x/X/space/spur/V2/agent/config/siliconflow.env > /tmp/spur-agent-ecs.env
    chmod 600 /tmp/spur-agent-ecs.env
    scp /tmp/spur-agent-ecs.env root@47.96.149.37:/root/spur-agent-ecs.env && rm -f /tmp/spur-agent-ecs.env

用户确认传输成功。密钥内容没有输出或写入本文；AgentMail 变量没有复制。

## 10. ECS Workbench：启动仅本机可访问的临时 Agent

创建运行数据卷并启动服务。宿主机只监听 127.0.0.1:4173；容器仍使用非 root、Chrome seccomp profile 和 1 GiB /dev/shm：

    chmod 600 /root/spur-agent-ecs.env &&
    docker volume create spur-agent-ecs-runtime &&
    docker run --rm -d --name spur-agent-ecs-smoke --platform linux/amd64 --shm-size=1g --security-opt seccomp=/root/seccomp-playwright.json --env-file /root/spur-agent-ecs.env -p 127.0.0.1:4173:4173 -v spur-agent-ecs-runtime:/opt/spur/V2/web/.runtime aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent@sha256:24d3fc5e2e1ec3d80ed5684ef51caa21fd2712d29f808c49802788310a787d84 &&
    rm -f /root/spur-agent-ecs.env

rm 只删除 ECS 上的临时 env 文件；运行中容器仍持有模型配置。检查健康状态和日志：

    curl -i http://127.0.0.1:4173/api/creator-agent/health
    docker logs --tail=30 spur-agent-ecs-smoke

实际结果：HTTP 响应为：

    {"status":"ready","model":"deepseek-ai/DeepSeek-V4.1-Flash","emailConfigured":false,"reasons":[]}

日志确认：

    Spur Personal Agent: http://0.0.0.0:4173
    Harness: ready (24.22.1); model: deepseek-ai/DeepSeek-V4.1-Flash

emailConfigured:false 是预期结果，本轮未注入 AgentMail 配置。

## 11. ECS Workbench：真实模型请求

    curl --max-time 180 -sS -X POST http://127.0.0.1:4173/api/creator-agent/chat -H 'Content-Type: application/json' -d '{"message":"请只用一句话回答：2 加 2 等于几？"}'

用户确认真实模型请求成功。未收到该次 JSON 原文，不记录未观察到的 runId 或响应内容。

## 12. ECS Workbench：真实模型驱动 Playwright 浏览器请求

    curl --max-time 240 -sS -X POST http://127.0.0.1:4173/api/creator-agent/chat -H 'Content-Type: application/json' -d '{"message":"请必须调用 browser_navigate 工具打开 https://example.com/，读取页面标题和主标题。不要使用 web_fetch，也不要用其他工具代替。最后用中文简短报告标题和主标题。"}'

返回关键字段：

    runId: c46de785-9dc8-4f73-b8b3-bfee5b2cf668
    sources: browser navigate → https://example.com/
    timing.totalMs: 9836
    timing.toolCalls: 2
    timing.timedOut: false

Agent 返回页面标题 Example Domain，并说页面没有 H1。随后读取该次任务的浏览器证据：

    docker exec spur-agent-ecs-smoke node -e 'const fs=require("node:fs");const d="/opt/spur/V2/web/.runtime/runs/c46de785-9dc8-4f73-b8b3-bfee5b2cf668/evidence";for(const f of fs.readdirSync(d)){const x=JSON.parse(fs.readFileSync(d+"/"+f,"utf8"));console.log("--- "+x.tool+" "+x.source+" ---");console.log(x.text.split("\n").filter(v=>/Page Title|Example Domain|heading|H1|h1|main/i.test(v)).slice(0,10).join("\n"));}'

browser_navigate 与 browser_snapshot 都返回 Page Title: Example Domain 和说明段落，没有 H1/heading 条目。因此 Agent 对这次页面快照的回答正确，模型→DSH→MCP→Chrome→网页内容→响应链路通过。曾依据旧印象误判 H1，之后按实际工具证据更正。

## 当前状态与下一步

已通过：独立 ECS user namespace 检查、Docker 安装、ACR 网络与镜像拉取、非 root Chrome 沙箱、Playwright MCP 初始化、网页导航和 snapshot、SSRF 拦截、模型健康检查、真实模型调用及模型驱动浏览器任务。

最后确认时临时容器名为 spur-agent-ecs-smoke，运行数据卷为 spur-agent-ecs-runtime。端口仅映射到 ECS 主机 127.0.0.1:4173。未配置公网访问、域名、TLS、登录鉴权、AgentMail 或生产级自动重启。

### Mac 浏览器经 SSH 隧道访问（待执行）

Mac 本地终端运行并保持窗口打开：

    ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:4183:127.0.0.1:4173 root@47.96.149.37

输入 spur_agent ECS root 登录密码后，在 Mac 浏览器打开：

    http://127.0.0.1:4183/

隧道只将 ECS 本机服务转发到 Mac 回环地址，不需要把 ECS 的 4173 端口开放到公网。

长期运行前，还需规划容器自动重启、数据持久化、密钥管理及带身份认证的 HTTPS 入口；当前验证容器不等同生产部署。

## 13. 2026-11-03：在美国（硅谷）ECS 复跑验证

杭州实例流程验证完成后，用户新建美国（硅谷）ECS 并从头复跑部署。当前已观察到的新实例信息：

| 项目 | 已观察到的值 |
|---|---|
| ECS Workbench 主机名 | `iZrj926o99lormjfsmw2yyZ` |
| 地域 | 美国（硅谷） |
| 系统 | Alibaba Cloud Linux 3（OpenAnolis Edition） |
| 架构 | `x86_64` |
| 登录用户 | `root` |
| ECS 公网出口 IP | `47.254.17.22` |
| Docker Buildx | `v0.14.0 171fcbe` |
| Docker 服务 | `active` |
| ECS 规格／公网带宽 | 本轮没有收到创建后实例详情，待核对 |

### 安装 Docker、验证杭州 ACR 连通并拉镜像

在硅谷 ECS 上按 Alibaba Cloud Linux 3 步骤安装 Docker CE、Buildx 和 Compose。随后 `systemctl is-active docker` 返回 `active`。

在 ACR `aed-acr` 的公网访问白名单新增 `47.254.17.22/32` 后，硅谷 ECS 对杭州 Registry 域名 `/v2/` 探测返回 HTTP `401`。这是 Registry 的未认证响应，证明从硅谷 ECS 到杭州 ACR 的公网 DNS/TCP/TLS/HTTP 路径已通；不是登录成功凭据的验证。

用户随后在硅谷 ECS 执行 ACR 登录并得到 `Login Succeeded`，从杭州 ACR 拉取与杭州部署相同的不可变镜像 digest：

    aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent@sha256:24d3fc5e2e1ec3d80ed5684ef51caa21fd2712d29f808c49802788310a787d84

拉取完成；`docker image inspect` 确认 `OS=linux ARCH=amd64 SIZE=2185407491`，适配新 ECS 的 `x86_64` 架构。ACR 是镜像仓库，镜像拉取到本机后容器在硅谷 ECS 运行；杭州 ACR 并非 Agent 运行节点。

### 复制沙箱文件并复跑浏览器冒烟

从 Mac 本地终端将项目内 `seccomp-playwright.json` 和 `smoke.cjs` 复制至 `root@47.254.17.22:/root/`。首次复制均成功。之后在硅谷 ECS 用镜像运行 Chrome headless 空白页测试，Chrome 输出 D-Bus 诊断日志，但最终正常返回：

    <html><head></head><body></body></html>

再运行 MCP 冒烟脚本，得到：

    Chrome navigation and snapshot passed
    SMOKE PASS

### 启动硅谷临时 Agent 并验真模型与 YouTube

从 Mac 只筛选并复制 `SILICONFLOW_API_KEY`、`SILICONFLOW_BASE_URL`、`SPUR_CHAT_MODEL` 三项模型配置；没有复制 AgentMail，密钥值不写入记录。硅谷 ECS 使用同一镜像启动容器 `spur-agent-ecs-smoke`，运行数据卷 `spur-agent-ecs-runtime`，容器 ID：

    f4466abcec6878f5647c2b6ae9366449fbc46792b09e98ad3a999be5573422cc

宿主机端口只映射至 `127.0.0.1:4173`。健康接口返回：

    {"status":"ready","model":"deepseek-ai/DeepSeek-V4.1-Flash","emailConfigured":false,"reasons":[]}

日志显示 Harness `ready (24.22.1)`；用户确认真实模型简单请求成功。

用户再请求 Agent 必须调用 `browser_navigate` 打开 `https://www.youtube.com/` 并调用 `browser_snapshot`。返回 runId：

    bea507c2-7490-41d4-b57a-380cbe2d58e1

返回 `toolCalls=2`、`timedOut=false`，页面标题 `YouTube`；快照中有 YouTube 标志、搜索框、登录入口和“Try searching to get started”空状态。该次实测证明未登录时可由硅谷 ECS 上的浏览器访问 YouTube 首页并读取当前公开页面。它不证明已登录功能、推荐流、视频播放、字幕读取或任意频道资料采集都可用。

用户随后确认将硅谷容器改为 Docker 后台自动恢复运行。最初的容器使用 `--rm`，不能直接设置重启策略；保留 `spur-agent-ecs-runtime` 数据卷后移除旧容器，并以 `--restart unless-stopped` 重新创建 `spur-agent-ecs-smoke`。用户报告该操作成功；最终 `docker inspect` 输出未粘贴，因此重启策略值依据用户确认的成功操作记录，待下次状态检查复核。Docker 服务先前已设置为随 ECS 启动。

### 新地域测试后的手机 App 接入边界

该容器现使用 `unless-stopped` 重启策略，仍只绑定 ECS 本机 `127.0.0.1:4173`，当前没有公网 HTTPS 或用户鉴权。不能直接让手机访问此本机端口，也不要把 4173 暴露到安全组。

当前 `app/mobile/src/config/api.ts` 的 `AUDIO_AGENT_BASE_URL` 指向 `https://api.hispurring.com`；录音、办公等服务复用该 base URL。不能把它整体改成新 ECS 地址，否则会把原音频/办公接口一起改走。要接入 Creator Agent，应单独建立它的安全 HTTPS API 地址与客户端调用，并先明确服务端身份认证方式。

