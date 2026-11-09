# Spur Web Agent网页端从零搭建、开发调试、云端部署与完整复现操作手册

整理日期：2026年11月08日。本文根据当前工作区源码、历史开发文档及本聊天终端输出整理。按负责人最新要求采用精简可操作版。本轮仅阅读与生成本文，没有安装依赖、构建、重启或部署。

## 一、阅读前须知与真实完成状态

本文标签：**【已验证】**表示历史日志或用户终端输出明确成功；**【源码推导】**表示按当前代码整理、尚未在全新机器重跑；**【待验证】**表示证据不足。命令是给后续操作者执行，不代表本轮已经执行。

| 内容 | 当前证据 |
|---|---|
| 网页 HTTPS | 【已验证】`https://ai.hispurring.com/healthz` 返回200 |
| 个人 App API | 【已验证】`https://api.hispurring.com/api/creator-agent/health` 无令牌返回401 |
| 两位访客真实任务及成果隔离 | 【已验证】提交202；本人文件200；另一访客任务和文件404；任务编号 `a49716cb-8989-4125-9e29-b06e7d016025` |
| 扩容十五位访客 | 【已验证】用户回传 `FIFTEEN_GUESTS_QUEUE_READY`，worker-14/15健康；原release备份位于 `/root/spur-web-guests/before-fifteen-20261108-113146` |
| 全站两个并发、排队及重启恢复 | 本地模拟测试通过；【待验证】线上三位访客真实并发、排队和自动补位 |
| 未登录展示完整首页、首页填邀请码 | 本地构建与38项测试通过；包已上传并返回 `PUBLIC_HOME_PACKAGE_VERIFIED`；【待验证】更新脚本成功输出和无痕窗口验收，不能写成已经上线 |
| YouTube、Notion、AgentMail | 个人 App 路径有历史真实成功记录；访客网页不继承这些个人授权 |
| MediaCrawler | 个人v3测试容器中的抖音原生搜索成功；访客环境默认关闭，不代表十五人均能使用个人登录态 |

**重要交接缺口：**本次 `git ls-files V2/web V2/agent/deploy/docker` 返回0，`git status` 显示两个目录未跟踪。仅克隆当前已提交主仓不能复现网页端，必须先取得包含这些目录的完整源码交接包或后续正式提交。根仓当前提交为 `95e0903`，不能把它当作网页V5发布版本。`deepseek-harness` 路径的 Git 命令实际回溯到主仓，不能把该提交冒充上游Harness提交。

## 二、架构、目录与调用关系

```text
浏览器 → ai域名/Caddy → 访客网关4190
                       ├─ 静态页面、邀请码、30天Cookie
                       ├─ 私有持久队列：最多2个任务执行
                       └─ 按访客路由4300–4314 → 各自Node后端4173
                                              → DSH headless
                                              → 模型服务及研究/文件工具
                                              → Playwright MCP → Chrome
App → api域名/Caddy → 个人后端宿主机4173（独立保留）
```

DSH由Node后端为每次任务启动子进程，不是另一个固定HTTP端口。Playwright MCP由工具经stdio启动，不需要另开公网MCP端口。

| 路径（相对主仓） | 作用 |
|---|---|
| `V2/web/src/` | React界面：App、Conversation、TaskInput、Sidebar、成果预览 |
| `V2/web/src/taskApi.ts` | 异步提交、轮询、结果合并、同源文件地址 |
| `V2/web/server.mjs`、`start.mjs` | Node任务API、DSH启动、配置、运行数据 |
| `V2/web/task-results.mjs` | 结果文件保存与回读 |
| `V2/web/cloud-bridge.mjs`、`scripts/connect-ecs.mjs` | 所有者本机开发网页访问个人云端；不是访客生产网关 |
| `V2/web/guest/` | 邀请、访客网关、队列、部署与修复脚本 |
| `V2/agent/runtime/deepseek-harness/` | DSH源代码及CLI构建产物 |
| `V2/agent/runtime/mcp-servers/playwright-mcp/` | MCP与Chrome桥接 |
| `V2/agent/tools/` | research-adapter、playwright-browser、personal-workspace、travel-research、connectors、图片/视频工具 |
| `V2/agent/deploy/docker/` | Dockerfile、依赖准备、seccomp及冒烟脚本 |
| `V2/docs/` | 历史证据与专项开发记录 |

前端React18、TypeScript6、Vite6；实际版本以 `V2/web/package-lock.json` 为准，不使用全局latest替代锁文件。

## 三、取得源码与准备环境

### 3.1 源码交接

【源码推导】已有正式仓库地址时，由队友提供，不在本文编造：

```bash
# 新电脑；将占位符替换为团队真实仓库地址
mkdir -p "$HOME/work"
cd "$HOME/work"
git clone <团队主仓地址> spur
cd spur
# 必须存在；否则先取得完整源码，不能继续
ls V2/web/server.mjs V2/web/package-lock.json V2/agent/deploy/docker/Dockerfile
```

若这些文件未提交，可由原电脑导出源码包。以下排除常见秘密和产物，但**不等同于自动安全审计**；交接前检查包内清单，不传运行目录或浏览器会话。

```bash
# 原Mac，主仓目录
cd /Users/x/X/space/spur
tar --exclude='.git' --exclude='node_modules' --exclude='.runtime' \
  --exclude='.venv' --exclude='__pycache__' --exclude='browser_data' \
  --exclude='*.env' --exclude='.env*' --exclude='*.pem' --exclude='*.key' \
  --exclude='.npmrc' --exclude='research-wheels' --exclude='dist' \
  -czf /tmp/spur-web-source.tar.gz \
  V2/web V2/agent/runtime/deepseek-harness \
  V2/agent/runtime/mcp-servers/playwright-mcp \
  V2/agent/runtime/Agent-Reach V2/agent/runtime/MediaCrawler \
  V2/agent/tools V2/agent/deploy V2/.dockerignore V2/docs
chmod 600 /tmp/spur-web-source.tar.gz
tar -tzf /tmp/spur-web-source.tar.gz > /tmp/spur-web-source-files.txt
```

新电脑在 `spur` 空目录解压交接包，再检查上述必要文件。上游Agent-Reach核查提交为 `47898829204ad27521d8a1719e3aeca3b8a3e0ca`，MediaCrawler为 `54a3d92412f4b20c06b45f1d542b78dd92049d6d`。这些提交不是全部Spur改动的替代品。

### 3.2 版本与安装

推荐开发机Node24，DSH声明支持 `^22.19.0 || >=24.0.0`。镜像固定Node24.22.1、Ubuntu24.04、pnpm11.7.0、Linux AMD64。研究wheel目标为CPython3.12 Linux x86_64。ECS宿主机Python3.6只运行运维脚本，与容器Python不是同一环境。

```bash
# 开发电脑，只读检查
node --version
npm --version
python3 --version
docker version
docker buildx version
```

【源码推导】Mac缺少工具时可按团队已有安装方式安装Docker Desktop和Node24。若已使用Homebrew：

```bash
brew install node@24 python@3.12
brew install --cask docker
# 手动打开Docker Desktop，确认docker version包含Server
export PATH="$(brew --prefix node@24)/bin:$PATH"
npm install --global pnpm@11.7.0
```

这些是可选新机准备命令，不代表原机器通过Homebrew安装。本地历史Node24来自Codex运行时，新机器无需安装Codex来获得Node。

## 四、本地运行与调试

### 4.1 安装锁定依赖

【源码推导】以下按新电脑主仓位置执行；示例以 `/Users/x/X/space/spur` 为原机器路径，新电脑自行替换。

```bash
cd /Users/x/X/space/spur/V2/agent/runtime/deepseek-harness
pnpm install --frozen-lockfile
pnpm run build:lib
ls apps/cli/lib/bin.js

cd /Users/x/X/space/spur/V2/agent/runtime/mcp-servers/playwright-mcp
npm ci --include=dev --ignore-scripts --no-audit --no-fund
./node_modules/.bin/playwright install chrome

cd /Users/x/X/space/spur/V2/web
npm ci --include=dev --ignore-scripts --no-audit --no-fund
```

目的分别为构建DSH、安装MCP运行依赖和Chrome、安装网页依赖。Linux开发机Chrome安装需系统依赖时使用同版本安装器 `playwright install --with-deps chrome`。不要只安装production依赖：当前MCP桥还依赖上游列为devDependency的SDK。

### 4.2 安全创建配置

默认配置源为 `V2/agent/config/siliconflow.env`，`SPUR_CONFIG_FILE`可覆盖；进程环境优先于文件。不要使用 `VITE_` 保存密钥，Vite变量可能进入浏览器。

```bash
# 开发电脑，主仓目录；交互输入秘密，终端不回显
cd /Users/x/X/space/spur
python3 - <<'PY'
import getpass, os, pathlib, secrets
p=pathlib.Path('V2/agent/config/siliconflow.env')
p.parent.mkdir(parents=True,exist_ok=True)
key=getpass.getpass('输入模型API Key（不回显）：').strip()
if not key or '\n' in key or '\r' in key: raise SystemExit('无效配置')
fd=os.open(str(p),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f:
    f.write('SILICONFLOW_API_KEY='+key+'\n')
    f.write('SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1\n')
    f.write('SPUR_CHAT_MODEL=deepseek-ai/DeepSeek-V4.1-Flash\n')
    f.write('SPUR_CREATOR_AGENT_TOKEN='+secrets.token_urlsafe(32)+'\n')
    f.write('SPUR_AGENTMAIL_AUTOSUMMARY=0\nSPUR_RESEARCH_ADAPTER_ENABLED=0\n')
print('CONFIG_CREATED：未输出密钥；已存在文件不会覆盖')
PY
```

最小闭环先关闭研究Adapter，再在Docker研究环境验证；本机Python与Agent-Reach未安装时，不应声称研究能力可用。示例模型名来自历史配置，未来服务变更需按实际可用模型调整。

### 4.3 两个终端启动

```bash
# 终端A，后端
cd /Users/x/X/space/spur/V2/web
npm start
```

预期监听本机4173。`start.mjs`选择兼容Node并处理系统代理；Mac代理不应原样复制到云端。

```bash
# 终端B，前端
cd /Users/x/X/space/spur/V2/web
npm run dev
```

打开 `http://127.0.0.1:5174/`。Vite严格使用5174；“Port already in use”时先检查已有服务，不反复启动，不盲目杀进程。

```bash
# Mac只读检查
lsof -nP -iTCP:5174 -sTCP:LISTEN
lsof -nP -iTCP:4173 -sTCP:LISTEN
```

`vite.config.ts`将 `/api` 转发本机4173。若希望所有者本地页面连接既有个人ECS，可运行：

```bash
cd /Users/x/X/space/spur/V2/web
node scripts/connect-ecs.mjs
```

此脚本硬编码原ECS地址，通过SSH只提取个人服务访问令牌，保存到 `~/.local/share/spur/web-cloud/agent-token`，不会打印秘密。完成后手动重启Vite。**新电脑做纯本地开发时不要执行；它会切换所有者网页的数据来源。** 新服务器须先审查脚本固定地址。

## 五、任务、工具、连接器与配置

### 5.1 异步协议

前端为每轮生成UUID，POST `/api/creator-agent/chat`：

```json
{"requestId":"<UUID>","message":"<用户需求>","history":[],"async":true}
```

返回202后，GET `/api/creator-agent/tasks/<UUID>`轮询；完成返回 `result.response`、`artifacts`、`sources`等。`409`或回执丢失时只查询原任务，不能重复POST。成果下载为 `/api/creator-agent/artifacts/<UUID>`，访客网关另做所有权检查。

后端生成任务patch，执行 `apps/cli/lib/bin.js --profile headless --patch <patch文件> <提示词>`。工具记录、stdout/stderr、timing和最终结果位于 `.runtime/runs/<UUID>/`。当前单次Harness限时八分钟；异步HTTP不等于可连续执行两天，也不保证worker进程被杀后自动续跑。

### 5.2 配置清单

| 配置 | 用途和边界 |
|---|---|
| `SILICONFLOW_API_KEY`、`SILICONFLOW_BASE_URL`、`SPUR_CHAT_MODEL` | 模型服务，只有服务器持有秘密 |
| `SPUR_CREATOR_AGENT_TOKEN` |43字符base64url服务访问令牌，不是邀请码 |
| `SPUR_RUNTIME_ROOT` | 默认网页 `.runtime`，需可写、持久化 |
| `SPUR_NODE_BIN` | DSH子进程Node路径，访客使用内部加载器包装器 |
| `SPUR_RESEARCH_ADAPTER_ENABLED=1` | 启用研究工具注册，不等于所有平台可用 |
| `SPUR_AGENT_REACH_BIN` | 镜像默认 `/opt/research-venv/bin/agent-reach` |
| `SPUR_MEDIACRAWLER_ROOT`、`SPUR_MEDIACRAWLER_PYTHON` | MediaCrawler源码及独立Python环境 |
| `SPUR_MEDIACRAWLER_LEARNING=1` | 非商业学习原生采集开关，仍需该访客自己的会话 |
| `SPUR_MEDIACRAWLER_PROFILE_ROOT` | 专用会话目录；访客默认不挂个人目录 |
| `YOUTUBE_CLIENT_ID/SECRET`、`NOTION_CLIENT_ID/SECRET`、`SPUR_PUBLIC_URL` | 个人App OAuth；访客网页授权尚未接入 |
| `YOUTUBE_API_KEY`、`NOTION_TOKEN` | 旧共享连接器配置，不能给所有访客继承 |
| `AGENTMAIL_API_KEY`、`AGENTMAIL_INBOX_ID` | 个人邮箱；回复必须由用户批准 |
| `SPUR_AGENTMAIL_AUTOSUMMARY=1` | 个人来信自动摘要，访客关闭 |
| `SPUR_IMAGE_MODEL`、`SPUR_VIDEO_T2V_MODEL` | 图片/视频生成，访客当前置空 |

注册代码见 `server.mjs` 的 `makePatch()`：按配置插入research-adapter、personal-workspace、travel-research、playwright-browser及已配置连接器，同时禁用通用shell、任意文件系统和子Agent等工具。Chrome以headless、isolated、只读页面及公网代理边界运行。

官方授权回调：

- `https://api.hispurring.com/api/connections/callback/youtube`
- `https://api.hispurring.com/api/connections/callback/notion`

Google登记Web OAuth回调，Notion创建OAuth连接并配置相同回调。凭据只安全注入个人后端，不能写前端。详细步骤以历史手机OAuth记录为准；网页上展示平台按钮不等于已经接通网页授权。

公开内容可访问不等于免登录采集，也不能将公开索引结果当成完整评论或热门排行。当前云端验证有YouTube的yt-dlp公开搜索、小红书public-web索引、个人抖音native搜索；未验证动作不宣称可用。

## 六、Docker构建与本地容器验证

### 6.1 准备研究依赖与构建

【已验证历史路径，当前源码重新构建待验证】在开发电脑执行：

```bash
cd /Users/x/X/space/spur
python3.12 -m venv /tmp/spur-build-python
/tmp/spur-build-python/bin/python -m pip install pip==25.0.1
/tmp/spur-build-python/bin/python V2/agent/deploy/docker/prepare-research-wheels.py

docker buildx build --platform linux/amd64 --load \
  -t spur-agent:research-async-v3 \
  -f V2/agent/deploy/docker/Dockerfile V2

docker image inspect spur-agent:research-async-v3 \
  --format 'ID={{.Id}} PLATFORM={{.Os}}/{{.Architecture}}'
```

构建上下文是 `V2`，不是主仓根。预期wheel脚本输出 `LINUX_WHEELHOUSE_READY`，镜像平台为linux/amd64。`prepare-research-wheels.py`核验PyPI文件hash并从本地Agent-Reach源码构建wheel；Docker离线安装这部分依赖。MediaCrawler单独venv目前仍在线安装，其依赖与Chrome上游源并非全部不可变：新构建不保证镜像字节与历史完全一致。历史v3镜像ID为 `sha256:d4365bb9187c73c75d50d169e8a6c10bd8661cd60534cef555c9aa1e1fe3aff8`；新构建应记录新ID，不强求相同。

Ubuntu是容器基础镜像，不是给Mac或ECS重装系统。最终镜像包含Node、Python研究venv、MediaCrawler、Chrome、MCP、DSH、Node后端和dist；`V2/.dockerignore`排除env、运行数据、浏览器profile及本机node_modules。guest源码虽进入builder，最终镜像没有自动启动guest网关，生产guest另以小包挂载。

### 6.2 启动本地隔离容器

```bash
# 主仓目录；使用独立测试名和卷，不影响线上
cd /Users/x/X/space/spur
docker volume create spur-agent-local-runtime
docker run --rm --user 0:0 --network none \
  --mount type=volume,src=spur-agent-local-runtime,dst=/data \
  --entrypoint sh spur-agent:research-async-v3 \
  -c 'chown 10001:10001 /data && chmod 700 /data'

docker run -d --name spur-agent-local --platform linux/amd64 \
  --shm-size=1g \
  --security-opt seccomp="$PWD/V2/agent/deploy/docker/seccomp-playwright.json" \
  --env-file V2/agent/config/siliconflow.env \
  -e SPUR_RESEARCH_ADAPTER_ENABLED=1 \
  -p 127.0.0.1:4183:4173 \
  --mount type=volume,src=spur-agent-local-runtime,dst=/opt/spur/V2/web/.runtime \
  spur-agent:research-async-v3
```

非root UID/GID为10001。不要用privileged或关闭Chrome沙箱掩盖问题。Apple Silicon构建和运行AMD64需模拟，速度可能较慢。浏览器共享内存由 `--shm-size` 提供。

```bash
# 健康检查；令牌在容器内部读取，不打印
 docker exec spur-agent-local node -e '
fetch("http://127.0.0.1:4173/api/creator-agent/health",{
 headers:{Authorization:"Bearer "+process.env.SPUR_CREATOR_AGENT_TOKEN},
 signal:AbortSignal.timeout(10000)
}).then(async r=>console.log("HTTP="+r.status,await r.text()))
.catch(e=>{console.error(e.message);process.exitCode=1})'

# 无付费模型的工具与DSH测试；第二项默认约65秒延迟
 docker exec -i spur-agent-local node < V2/agent/deploy/docker/smoke.cjs
 docker run --rm -i --platform linux/amd64 --shm-size=1g \
  --security-opt seccomp="$PWD/V2/agent/deploy/docker/seccomp-playwright.json" \
  spur-agent:research-async-v3 node < V2/agent/deploy/docker/async-loop-smoke.cjs
```

健康200只证明配置及基础路径通过，不证明真实模型密钥有效。模拟模型测试也不能代替真实模型验证。旧 `research-smoke.cjs` 仍断言MediaCrawler目录不存在，已不适合当前v3镜像，不能不加辨别地运行并将失败当成打包错误。

## 七、服务器准备、镜像上传与基础后端

### 7.1 原服务器事实和新机要求

原硅谷ECS：`47.254.17.22`，历史系统Alibaba Cloud Linux3、x86_64；用户回传内存7.4GiB、磁盘40GB，Docker运行。具体当前实例规格及Docker版本需只读核对，不把另一个早期杭州实例的4vCPU规格套用过来。

```bash
# Mac登录；在ECS检查
ssh root@47.254.17.22
cat /etc/os-release
uname -m
nproc
free -h
df -h /
docker version
docker buildx version
docker compose version
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
```

新机仅需Docker即可运行镜像中的Node/Python，宿主机无需再安装全部Agent依赖。Alibaba Cloud Linux3安装流程见历史11月03日部署记录；不要将该发行版的仓库适配命令照搬Ubuntu。新Ubuntu服务器的示例安装方式【源码推导、未在本轮执行】：

```bash
sudo apt-get update
sudo apt-get install -y docker.io python3 ca-certificates
sudo systemctl enable --now docker
sudo docker version
```

完整buildx/compose组件由发行版或Docker软件源另装；若只load/run已有镜像，不依赖Compose。当前工程实际使用Docker CLI脚本，不存在已验收的Spur Compose生产方案。安全组仅向公网开放80/443及受控SSH，不开放4173、4190、4300–4399。

### 7.2 推荐按历史成功路径离线传输

```bash
# Mac，导出已验证镜像
docker save spur-agent:research-async-v3 | gzip > /tmp/spur-research-async-v3.tar.gz
shasum -a 256 /tmp/spur-research-async-v3.tar.gz
scp /tmp/spur-research-async-v3.tar.gz root@47.254.17.22:/root/spur-agent-upgrade/
scp V2/agent/deploy/docker/seccomp-playwright.json root@47.254.17.22:/root/seccomp-playwright.json
```

首次新服务器先运行 `install -d -m 700 /root/spur-agent-upgrade`。上述scp前必须位于主仓。记录本地hash，再在ECS运行：

```bash
sha256sum /root/spur-agent-upgrade/spur-research-async-v3.tar.gz
# 两端hash一致才load
docker load -i /root/spur-agent-upgrade/spur-research-async-v3.tar.gz
docker image inspect spur-agent:research-async-v3 \
  --format 'ID={{.Id}} PLATFORM={{.Os}}/{{.Architecture}}'
chmod 600 /root/seccomp-playwright.json
```

【已验证】历史v3包约996MB，上传约31分40秒；速度取决于网络，不能承诺固定时间。

ACR替代路径【历史多次成功，后续也发生超时】：

```bash
# Mac；交互登录，密码不写命令参数
docker login aed-acr-registry.cn-hangzhou.cr.aliyuncs.com
docker tag spur-agent:research-async-v3 \
  aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent:research-async-v3
docker push aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent:research-async-v3
# ECS；拉取前使用有权限的账号登录
docker pull aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent:research-async-v3
```

杭州是镜像仓库地域，容器仍在硅谷运行。历史research-async-v2 push因HEAD请求context deadline exceeded改走scp；这不是Agent运行失败。索引digest、registry manifest digest与image inspect的配置ID可能不同，不能未经核对混用。

### 7.3 全新服务器的基础个人后端模板

以下【源码推导】是为了满足现有guest部署脚本对模板容器的依赖，不代表已部署到现有ECS。**原ECS已有 `spur-agent-ecs-smoke`，禁止重复运行或覆盖其卷。** 新机先按第四章交互创建同格式私有env，路径改为 `/root/spur-agent-upgrade/agent.env`，至少填模型Key和有效服务Token；不使用别人凭据。

```bash
# 仅全新ECS，确认同名容器不存在
docker volume create spur-agent-ecs-runtime
docker run --rm --user 0:0 --network none \
  --mount type=volume,src=spur-agent-ecs-runtime,dst=/data \
  --entrypoint sh spur-agent:research-async-v3 \
  -c 'chown 10001:10001 /data && chmod 700 /data'
docker run -d --name spur-agent-ecs-smoke --restart unless-stopped \
  --platform linux/amd64 --shm-size=1g \
  --security-opt seccomp=/root/seccomp-playwright.json \
  --env-file /root/spur-agent-upgrade/agent.env \
  -p 127.0.0.1:4173:4173 \
  --mount type=volume,src=spur-agent-ecs-runtime,dst=/opt/spur/V2/web/.runtime \
  spur-agent:research-async-v3
```

复用第六章健康检查，将容器名改成 `spur-agent-ecs-smoke`。原线上个人服务在此前清单仍是v2，v3曾在4189测试；不能将新机推荐v3模板写成原个人服务已切v3。

## 八、从零建立访客网页，再扩容十五人

### 8.1 打包当前网页和guest脚本

【源码推导】新机不要依赖原电脑 `/tmp` 临时包，应从交接源码重建。此步骤不修改业务源码。

```bash
# Mac主仓；确保当前是已核对的完整源码版本
cd /Users/x/X/space/spur
(cd V2/web && VITE_CREATOR_AGENT_API_URL= npm run build)
python3 - <<'PY'
import pathlib, tarfile, hashlib
base=pathlib.Path('V2/web')
p=pathlib.Path('/tmp/spur-web-release.tar.gz')
with tarfile.open(str(p),'w:gz') as t:
    t.add(str(base/'dist'),arcname='dist')
    for f in sorted((base/'guest').glob('*.mjs')):
        if not f.name.endswith('.test.mjs'):t.add(str(f),arcname='guest/'+f.name)
    for f in sorted((base/'guest').glob('*.py')):t.add(str(f),arcname='guest/'+f.name)
print('SHA256='+hashlib.sha256(p.read_bytes()).hexdigest())
PY
scp /tmp/spur-web-release.tar.gz root@47.254.17.22:/root/spur-agent-upgrade/
```

ECS核对hash后安全解压；将 `<刚才记录的SHA256>` 替换为真实值，不跳过校验：

```bash
python3 - <<'PY'
import pathlib,tarfile,hashlib
p=pathlib.Path('/root/spur-agent-upgrade/spur-web-release.tar.gz')
dst=pathlib.Path('/root/spur-web-guests/release')
expected='<刚才记录的SHA256>'
if hashlib.sha256(p.read_bytes()).hexdigest()!=expected:raise SystemExit('STOP：hash不符')
if dst.exists():raise SystemExit('STOP：已有release，不覆盖')
with tarfile.open(str(p),'r:gz') as t:
    for m in t.getmembers():
        q=pathlib.PurePosixPath(m.name)
        if q.is_absolute() or '..' in q.parts or not (m.isfile() or m.isdir()):raise SystemExit('STOP：非法成员')
    dst.mkdir(parents=True,mode=0o700)
    t.extractall(str(dst))
print('RELEASE_READY')
PY
```

Alibaba Python3.6的tarfile安全策略RuntimeWarning本身不是失败；以末尾成功标记为准。

### 8.2 初始化两位与修复加载器

```bash
# ECS，仅全新guest环境，不能对已部署环境重复provision
python3 /root/spur-web-guests/release/guest/provision-ecs.py --apply
python3 /root/spur-web-guests/release/guest/repair-loader-ecs.py --apply
```

初始化脚本依赖固定镜像名 `spur-agent:research-async-v3`、个人模板容器 `spur-agent-ecs-smoke`、至少2逻辑CPU、端口4190/4300/4301空闲。按模型配置白名单创建worker，不复制个人OAuth和邮箱。网关4190为host网络但只监听回环；两个worker分别映射4300/4301；各自独立卷、HOME和tmpfs。

【已验证故障修复】访客最初DSH原生内部加载器不可用，随后大量插件MODULE_NOT_FOUND。修复脚本只读挂载 `/root/spur-web-guests/guest-node-internals.sh` 至 `/opt/spur/guest-node`，设 `SPUR_NODE_BIN`，实际执行 `/usr/local/bin/node --expose-internals`。它保留10001用户、只读根、drop ALL、seccomp、no-new-privileges及资源限制。健康成功后仍须真实模型任务验收，不能只看模块静态路径。

### 8.3 扩容十五位

```bash
# ECS，新机源码推导流程：stage目录必须尚不存在
cp -a /root/spur-web-guests/release /root/spur-web-guests/upgrade-fifteen
python3 /root/spur-web-guests/upgrade-fifteen/guest/expand-fifteen-ecs.py --apply
```

预期 `FIFTEEN_GUESTS_QUEUE_READY`。脚本要求可用内存至少5GiB，增加friend-3至friend-15、端口4302–4314，沿用已验证loader包装器；切换前暂停访客网关并检查无running任务，发现运行任务即恢复网关、停止升级。原ECS已成功扩容，不重复运行。

当前源码已包含公开首页，新机用上述完整release初始化后无需再套旧public-home补丁；历史现网从旧release升级时才运行 `public-home-ecs.py`。

### 8.4 账号、邀请码和排队

- 邀请码原始值仅在服务器私有文件 `/root/spur-web-guests/invites-private.json`；access.json只保存邀请码/会话摘要。
- 每人一个独立身份、worker、卷和任务所有权；默认十次任务/日，按UTC日期计数，是任务额度而非精确费用上限。
- 邀请码默认七天兑换期，一次性使用；登录Cookie约三十天绝对有效。Cookie为Secure、HttpOnly、SameSite=Lax、host-only。
- 最多两个guest任务处于dispatching/running，同访客串行，其他人等待；关闭网页或退出登录不取消任务。
- `data/queue.json`保存请求与队列；仅一个网关进程负责调度，不允许两个网关副本共享该文件。
- 网络中断或回执不确定时只查询原任务，不重新提交；无法确认时保守占住名额，需管理员核查。未实现可靠的多日任务引擎及网页取消按钮。

只在项目负责人私有终端查看邀请码，不粘贴聊天，不放公开首页：

```bash
python3 - <<'PY'
import json
with open('/root/spur-web-guests/invites-private.json') as f:
    for x in json.load(f):print('{}：{}'.format(x['label'],x['code']))
PY
```

补发同身份新码【源码推导；该命令会在私有终端输出新码】：

```bash
# 替换真实tenantId；不要使用个人服务Token代替邀请码
printf '%s' '{"tenantId":"guest-<原24位十六进制ID>","days":7}' | \
  docker exec -i spur-web-guest-gateway node /app/guest/admin.mjs issue
```

撤销某访客：

```bash
printf '%s' '{"tenantId":"guest-<原24位十六进制ID>"}' | \
  docker exec -i spur-web-guest-gateway node /app/guest/admin.mjs revoke
```

这些是本地Unix socket管理命令，不能开放成公网管理API。

## 九、域名、Caddy与HTTPS

队友在DNS管理处配置 `ai.hispurring.com` 的A记录指向 `47.254.17.22`；TTL历史为600。新云平台替换IP；域名证书由Caddy自动签发。DNS先就绪，安全组和主机防火墙开放80/443。

```bash
# Mac或Linux，预期解析到目标ECS
dig +short ai.hispurring.com
# ECS，先验证回环网关
curl -sS -H 'Host: ai.hispurring.com' http://127.0.0.1:4190/healthz
```

新访客站点块：

```caddyfile
ai.hispurring.com {
    reverse_proxy 127.0.0.1:4190
}
```

原个人站点继续反代4173，原Bearer鉴权保留，仅两个GET OAuth回调例外。以下仅展示结构，**占位符不能直接覆盖真实配置**：

```caddyfile
{
    admin off
}
api.hispurring.com {
    @unauthorized {
        not header Authorization "Bearer <服务访问令牌>"
        not {
            method GET
            path /api/connections/callback/youtube /api/connections/callback/notion
        }
    }
    respond @unauthorized "Unauthorized" 401
    reverse_proxy 127.0.0.1:4173 {
        transport http {
            response_header_timeout 540s
        }
    }
}
```

### 9.1 已有Caddy的推荐更新

先确认挂载，绝不cat含Bearer完整配置到聊天：

```bash
docker inspect spur-agent-https \
  --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
```

原路径为 `/root/spur-https/Caddyfile` → `/etc/caddy/Caddyfile`。下面【已验证历史同逻辑】仅添加新站点，重复执行会停止；原域名配置不动：

```bash
python3 - <<'PY'
import pathlib,subprocess,datetime,os
p=pathlib.Path('/root/spur-https/Caddyfile')
old=p.read_bytes()
if b'ai.hispurring.com' in old:raise SystemExit('STOP：已有站点，不重复添加')
bak=p.with_name('Caddyfile.before-web-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
fd=os.open(str(bak),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'wb') as f:f.write(old)
def write(v):
    with open(str(p),'wb') as f:f.write(v);f.flush();os.fsync(f.fileno())
def run(a):subprocess.check_output(a,stderr=subprocess.STDOUT,universal_newlines=True)
restarted=False
try:
    write(old+b'\nai.hispurring.com {\n    reverse_proxy 127.0.0.1:4190\n}\n')
    run(['docker','exec','spur-agent-https','caddy','validate','--config','/etc/caddy/Caddyfile','--adapter','caddyfile'])
    restarted=True
    run(['docker','restart','spur-agent-https'])
    print('CADDY_APPLIED；备份：'+str(bak))
except Exception:
    write(old)
    if restarted:
        try:run(['docker','restart','spur-agent-https']);print('已恢复原配置并重启')
        except Exception:print('原文件已恢复，但重启失败，请人工处理')
    raise SystemExit('STOP：未确认上线')
PY
```

采用原文件原地写入，避免单文件bind mount因替换inode读到旧文件。`admin off`不支持通常的reload，所以使用受控重启，HTTPS会短暂中断，不能承诺零中断。

### 9.2 全新服务器只部署网页的Caddy示例

【源码推导】没有个人App接口需求时无需创建api站点。先创建 `/root/spur-https/Caddyfile`，仅写上面的全局admin off和ai站点块。`install`、编辑文件需由操作者执行：

```bash
install -d -m 700 /root/spur-https
# 用编辑器创建 /root/spur-https/Caddyfile，填已确认的新域名
chmod 600 /root/spur-https/Caddyfile
docker volume create spur-caddy-data
docker volume create spur-caddy-config
docker run --rm --entrypoint caddy \
  --mount type=bind,src=/root/spur-https/Caddyfile,dst=/etc/caddy/Caddyfile,readonly \
  caddy:2 validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker run -d --name spur-agent-https --restart unless-stopped --network host \
  --mount type=bind,src=/root/spur-https/Caddyfile,dst=/etc/caddy/Caddyfile,readonly \
  --mount type=volume,src=spur-caddy-data,dst=/data \
  --mount type=volume,src=spur-caddy-config,dst=/config \
  caddy:2
```

新部署需记录实际Caddy镜像digest；这里的 `caddy:2` 是历史使用标签，不是不可变发布版本。当前gateway严格校验Host和Origin，迁移域名还需修改其默认origin参数或生产启动调用，不能仅换DNS/Caddy就宣布迁移完成。

## 十、测试与最终验收

### 10.1 本地测试

```bash
# 主仓；不会访问线上，guest测试使用模拟worker
node --test V2/web/guest/*.test.mjs \
  V2/web/tests/cloud-bridge.test.mjs V2/web/tests/task-api.test.mjs
cd V2/web
npm run build
```

历史最后本地结果：公开首页版38项通过，TypeScript/Vite构建通过。本轮仅整理文档，未重跑这些测试。首次guest版30项，队列版37项，不可把不同阶段的数量混为同一次运行。

### 10.2 公网健康与鉴权

```bash
# ECS或Mac；预期200，队列版附queueEnabled:true
curl -sS --connect-timeout 10 --max-time 30 \
  -w '\nWEB_HTTPS_HTTP=%{http_code}\n' https://ai.hispurring.com/healthz
# 原个人API，预期401
curl -sS -o /dev/null --max-time 15 -w 'API_UNAUTH_HTTP=%{http_code}\n' \
  https://api.hispurring.com/api/creator-agent/health
# 原个人OAuth回调缺参数，历史预期400，不应401
curl -sS -o /dev/null --max-time 15 -w 'CALLBACK_HTTP=%{http_code}\n' \
  https://api.hispurring.com/api/connections/callback/notion
```

新机仅部署ai站点时不执行不存在的api域名检查。公开首页版的 `/api/web-backend` 匿名200仅返回guest-public元信息，Agent执行接口匿名仍401。

### 10.3 真实浏览器与研究验收

1. 无痕窗口打开网站：能看到完整首页，中央输入邀请码；未登录不能提交任务或打开私有历史。
2. 使用一个未兑换码登录，刷新仍登录，任务历史只属于该身份。不同访客用不同浏览器profile，不能在同一Cookie里同时冒充三个人。
3. 提交：“生成一份中文Markdown文档，标题为Spur网页上线验证，列出三个创作者使用Personal Agent的场景，保存为可下载文件。”确认提交、实际完成、下载内容正确。
4. 再提交公开YouTube研究，要求两个真实来源、说明时间和数据限制，核对来源与工具活动；不要把模型直接回答冒充工具调用。
5. 用访客B请求A的任务URL和文件URL，应404；不能只凭界面没有链接判断隔离成功。
6. 三个不同访客各提交稍长研究任务，确认最多两个运行、第三个排队；前两项结束后第三项自动开始。关闭第三位网页再回来应能查看进度和结果。
7. 排队中重启guest网关的恢复测试只在专用测试环境做；确认同UUID没有重复POST或重复外部写入。

以下在浏览器控制台仅请求自己的任务，替换真实UUID，返回状态应可读取；换到另一个访客profile后同请求应404：

```javascript
fetch('/api/creator-agent/tasks/<真实UUID>')
  .then(async r => console.log(r.status, await r.json()))
```

真实DSH测试会调用模型产生费用，但文档任务不发送邮件、不发布内容。访客平台授权、主动通知、图片/视频、字幕和评论深采不在当前全部通过的验收范围内。

## 十一、常见故障快速定位

| 症状 | 核查及处理 |
|---|---|
|5174已占用|用lsof确认是否已有Vite，直接打开页面，不重复启动 |
|容器not running|先inspect State，再看logs，不能直接反复exec |
|EACCES创建.runtime/runs|镜像UID10001；挂载覆盖镜像原目录权限，修正专用测试卷或tmpfs，不能chmod777整棵目录 |
|MediaCrawler NEED_LOGIN且会话读EACCES|先检查容器用户能否读专用会话；不是看到NEED_LOGIN就要求重新登录 |
|模型TRANSPORT连接错误|工具还未运行时先查模型DNS/TLS/代理，不能归咎YouTube或网页前端 |
|约一分钟网络失败但云端finished|旧同步长连接中断；使用async202+UUID轮询，原任务可能仍在运行，不重复提交 |
|brotli/yt-dlp无版本伴随SSL错误|历史是构建网络问题；准备验证过的Linux wheelhouse，不盲目降级或关闭TLS |
|大量MODULE_NOT_FOUND|先查内部loader实际可用性；错误解析目录下require失败不能证明镜像缺包；按repair-loader脚本处理 |
|Python unexpected keyword text|ECS Python3.6不支持subprocess text参数，使用universal_newlines=True |
|Caddy校验通过但reload失败|admin off；受控重启，备份、失败恢复，不假定旧配置已重载 |
|tar文件不存在|核查scp目标目录和文件名；未成功上传不能继续解压 |
|邀请码无效|可能已使用或七天过期，补发原tenant新码；不要给不同人共用身份 |
|排队长时间不释放|可能回执不确定或worker不可达，保守保留槽位；核对任务原编号，禁止直接删queue条目强行重跑 |
|有2条搜索结果但status=partial|只是已获得有限公开数据，不代表日期、热度或评论已验证 |

只读排查命令：

```bash
# ECS，先看状态，不打印容器全量Config.Env
docker inspect spur-web-guest-worker-1 \
  --format 'STATUS={{.State.Status}} EXIT={{.State.ExitCode}} OOM={{.State.OOMKilled}} ERROR={{.State.Error}}'
docker logs --tail 60 spur-web-guest-worker-1
docker logs --tail 60 spur-web-guest-gateway
free -h
df -h /
# 日志可能包含用户任务和来源，分享前脱敏
```

专用测试容器tmpfs正确挂载形式【已验证】：

```bash
--tmpfs /opt/spur/V2/web/.runtime:rw,uid=10001,gid=10001,mode=0700
```

tmpfs在容器停止后丢失，不可用于正式任务持久化。`--mount type=tmpfs,destination=...`不设置归属时可能root所有，导致EACCES。个人生产卷不能为了排查方便随意chown或清空。

## 十二、升级、备份、回滚与恢复

### 12.1 升级原则

- 前端/guest网关改动：构建dist并打小包挂到release，通常不需要重传近1GB镜像。
- 后端、DSH、MCP、Python依赖改动：重新构建AMD64镜像，先隔离测试，再明确切换哪些worker或个人容器；标签变化不自动更新已运行容器。
- 每次记录源码来源、包hash、镜像ID/digest、容器名、数据卷、端口、环境配置来源和验收结果。
- 个人服务、访客服务分别维护；不要因更新网页就重建个人App后端或挂入其授权目录。

历史小包与状态：

| 包 | 校验值及状态 |
|---|---|
| `spur-web-guests-v1.tar.gz` | `0b1f9f38bd51a5e4719d807ff4f30319fe568831caf5acdd09d2b0e0f0b0442f`；历史两访客初始化包 |
| `spur-web-fifteen-queue-v1.tar.gz` | `1a01643b5cfebabe0c6c4f67e15a348fc4d7f7b74ebbc4e7977dfe4ad4a65bf2`；用户已完成扩容 |
| `spur-web-public-home-v1.tar.gz` | `f9bc6435f0387cd546ecc20a038b28102d127e7cfe253aac2a76fb6f05b2fc0f`；用户已校验解压，执行更新待确认 |

原ECS下一步公开首页更新命令（已具备校验过的目录才执行）：

```bash
python3 /root/spur-web-guests/upgrade-public-home/guest/public-home-ecs.py --apply
```

预期 `PUBLIC_HOME_INVITE_READY`；短暂停止guest网关、备份release、替换gateway/dist、保留queue和worker；失败尝试恢复旧release。完成后无痕窗口验收，不把解压成功当更新成功。

### 12.2 备份

运行数据和源码分开备份，访问备份必须私有。不要在任务执行中直接打包可写JSON并宣称一致性。以下【源码推导】适用于明确维护窗口，先确认guest队列无等待/运行任务，再执行；不会自动判断业务是否空闲：

```bash
# ECS；仅在确认无在途任务且获准维护后执行
umask 077
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/root/spur-backups/$STAMP"
install -d -m 700 "$BACKUP_DIR"
docker stop spur-web-guest-gateway
for i in $(seq 1 15); do docker stop "spur-web-guest-worker-$i"; done
# root目录备份包含原始邀请码与模型配置，不得公开
cp -a /root/spur-web-guests "$BACKUP_DIR/guest-host"
# 导出各独立worker数据卷；辅助容器无网络、只读挂源卷
for i in $(seq 1 15); do
  WORKER="spur-web-guest-worker-$i"
  VOLUME=$(docker inspect "$WORKER" --format '{{range .Mounts}}{{if eq .Destination "/opt/spur/V2/web/.runtime"}}{{.Name}}{{end}}{{end}}')
  test -n "$VOLUME" || break
  docker run --rm --user 0:0 --network none --read-only \
    --mount "type=volume,src=$VOLUME,dst=/source,readonly" \
    --mount "type=bind,src=$BACKUP_DIR,dst=/backup" \
    --entrypoint sh spur-agent:research-async-v3 \
    -c "tar -czf /backup/worker-$i.tar.gz -C /source ." || break
done
for i in $(seq 1 15); do docker start "spur-web-guest-worker-$i"; done
docker start spur-web-guest-gateway
```

逐项确认十五个卷备份文件存在且可解包，再加密离机保存；脚本中途失败要人工检查并恢复服务，不能看到最后启动命令就认定全部备份成功。个人卷和Caddy证书卷需另设维护备份，不与访客备份混用。

### 12.3 回滚

优先使用对应升级脚本输出的真实备份位置。**代码回滚不能自动撤销已经发送的外部操作，也不能把旧access/queue覆盖到新任务上。** guest队列与release版本要兼容，先暂停入口、核对任务，再决定回滚；涉及身份和任务数据的恢复需单独制定方案。

loader修复保留了 `spur-web-guest-worker-N-before-loader-<时间>`，个人镜像切换曾保留 `spur-agent-before-async-20261107-130338` 等容器。保留容器并不等于可同时启动：原端口和数据卷冲突，必须先停止当前对应容器；禁止两个实例同时写同一运行卷。具体恢复前核对 `docker inspect` 的挂载和端口，不能照抄历史名字操作未知容器。

服务恢复后至少检查：网关health、匿名Agent401、个人API401及持令牌200、本人任务成果可读、另一访客404、新任务真实成功。文件JSON持久化不是高可用数据库；worker执行中重启仍可能留下running任务，需要核对日志，不能无条件自动重放。

## 十三、迁移到其他Mac、Linux或云平台

| 目标 | 推荐路径 |
|---|---|
| 另一台Mac | 获取完整未遗漏源码，Node24/pnpm11.7.0，按第四章安装；开发数据和个人OAuth不默认拷贝 |
| 新Linux/其他云 | 优先复用已验证linux/amd64镜像，Docker+Python3运维脚本；按七至九章建卷、guest和域名 |
| ARM服务器 | 当前Dockerfile下载固定linux-x64 Node，不能直接声称原生ARM兼容；用x86_64服务器或单独适配验证 |
| 新域名 | 修改DNS、Caddy、gateway可信origin；个人OAuth回调还需在提供商控制台登记；浏览器host-only Cookie不会跨域自动迁移 |
| 非root部署 | 当前脚本硬编码/root及UID10001，需要另行适配目录、权限、Docker访问和端口；本轮未验证 |
| Windows | 未验收；可考虑WSL2+Docker，但不能把Mac命令直接标为已支持 |

旧源码、镜像和新镜像不是同一概念；最可复现方式是完整源码快照+锁文件+wheel校验信息+不可变发布镜像+私有配置另行注入。新构建仍受上游Chrome、apt和MediaCrawler依赖影响，文档不能消除这些尚未完全锁定的差异。

## 十四、版本演进及证据索引

| 阶段 | 实际变化与阅读注意 |
|---|---|
| 11月01日至03日 | Node/DSH/MCP本地与容器化，硅谷ECS模型及浏览器验证；早期杭州服务器信息不可套用硅谷 |
| 11月05日 | 保留HTTPS/个人卷更新YouTube、Notion，手机OAuth及跨应用报告验证 |
| 11月06日 | AgentMail手机集成；Agent-Reach研究Adapter与离线wheelhouse；旧文档此时MediaCrawler尚未打包 |
| 11月07日 | 公开研究上线、异步202解决长请求断连；v3加入MediaCrawler及个人会话验证；Web V1/V3/V5迭代 |
| 11月08日 | 独立ai域名、访客隔离、内部loader修复；十五访客与双槽队列；公开首页版待线上最终确认 |

重点来源（主仓相对路径）：

1. `app/docs/PROJECT_CONTEXT.md`、`app/docs/DEVELOPMENT_RECORDS_INDEX.md`：接续背景，不是实时线上状态。
2. `V2/docs/从新建spur_agent独立ECS到Docker镜像拉取Chrome沙箱PlaywrightMCP及真实模型端到端验证完整操作记录-2026-11-03.md`。
3. `V2/docs/硅谷ECS保留HTTPS与原数据卷更新Personal-Agent容器并接通YouTube和Notion完整终端操作与回滚记录-2026-11-05.md`。
4. `V2/docs/完成手机App端真实连接YouTube与Notion及硅谷ECS容器更新授权回调配置真机安装的全部终端命令与开发回溯记录-2026年11月05日.md`。
5. `V2/docs/研究工具Linux镜像离线依赖打包与本地Docker闭环验收记录-2026年11月06日/开发与终端操作记录.md`。
6. `V2/docs/完成硅谷ECS异步任务正式容器升级与公网HTTPS验收及iPhone1046安装启动的终端开发记录-2026年11月07日.md`。
7. `V2/docs/Spur网页V5接入硅谷ECS第一阶段私有代理异步任务与成果转发开发记录-2026年11月07日.md`。
8. `V2/docs/Spur独立子域名邀请体验网站网关三十天登录访客隔离与小包部署准备记录-2026年11月08日.md`。
9. `V2/docs/Spur网站扩容十五位独立访客与全站两个任务并发持久排队小包升级开发记录-2026年11月08日.md`。
10. `V2/docs/Spur网站未登录公开完整首页与首页内邀请码验证入口开发记录-2026年11月08日.md`。
11. 当前源码：`V2/web/server.mjs`、`src/taskApi.ts`、`guest/{access,gateway,queue}.mjs`、三个guest部署/修复脚本及 `public-home-ecs.py`、Dockerfile和`.dockerignore`。
12. 本聊天用户回传的线上终端输出优先于旧文档中“尚未部署”段落；本轮没有SSH实时检查服务器，不能将历史结果保证为此刻运行状态。

**交接完成前仍需补齐：**发布包含未跟踪源码的团队可获取快照；确认公开首页更新实际成功；完成十五人配置下三访客真实排队验收；记录新机完整从零演练结果。本文已给出操作路径，但不把尚未进行的新机演练描述为已完成。
