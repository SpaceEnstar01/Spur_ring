# 完成 Spur 手机 App 端真实连接 YouTube 与 Notion、硅谷 ECS 容器更新、OAuth 授权及真机安装的完整终端与开发回溯记录

日期：**2026年11月05日**；时区 Asia/Shanghai（北京时间）。手机截图确认连接成功时间：**23:48**。本文按本次对话实际操作整理，不使用执行宿主机时区推断日期，也不编造未收到的完成输出。

## 最终成果与验收范围

**已完成：iPhone Spur 1.0.2（1040）安装启动，并在 App 的 Connect Apps 中完成 YouTube 与 Notion 的真实官方账号连接。**云端保留 api.hispurring.com、硅谷 ECS、Caddy、原正式数据卷与回滚备份；两个平台显示真实账号名称与“已连接”。

- 第一阶段：开发者账号的云端 YouTube → Agent 分析 → Notion 创建和回读成功（32.801 秒，6 次工具调用，无超时）。
- 第二阶段：配置 Google/Notion 公网 OAuth、Caddy 两个 GET 回调例外、发布新镜像，连接状态接口验证。
- 第三阶段：完成手机安装与用户自行授权，截图确认两个账号均已连接。
- **待完成：手机语音发起的最终跨应用任务测试、超时/跨请求重复写入故障验收。**不把连接成功等同于这些测试已经通过。

本文是历史操作记录，不是自动执行脚本。区分 Mac 本地终端与硅谷 ECS 终端；变更、停机和真实写入命令必须结合当时状态使用。所有秘密值均省略；不要输出 env、OAuth JSON 或容器完整环境。

## 环境与版本速查

| 项目 | 本次值 |
|---|---|
| Mac 主仓 | /Users/x/X/space/spur |
| V2 手机工程 | /Users/x/X/space/spur/V2/appV2/app_mobile |
| 硅谷 ECS | 47.254.17.22；主机 iZrj926o99lormjfsmw2yyZ |
| ECS 系统 / 架构 | Alibaba Cloud Linux 3；x86_64；宿主 Python 实际为 3.6 |
| ECS 精确规格 | 本轮未拿到最终输出，待确认，不能拿杭州 4核8GB 代替 |
| HTTPS | https://api.hispurring.com |
| 正式容器 / 端口 | spur-agent-ecs-smoke；127.0.0.1:4173 |
| Caddy | spur-agent-https；host 网络；admin off |
| 正式卷 | spur-agent-ecs-runtime → /opt/spur/V2/web/.runtime |
| 第一阶段镜像 | youtube-notion-v1；sha256:9fc1e5115f17bf06b8b224ef668330b9a6d4fe76e1e1e551f4c99b13abdbd498 |
| 手机 OAuth 镜像 | app-oauth-v1；sha256:1e1cf3fc8ba15aaa604b50cdd5edc83eecadd4e5a9e985e5d7dee1cdebec30db |
| iPhone 包 | com.spur.recordingring；1.0.2（1040） |
| iPhone 测试设备 | eFLY，iPhone 12，00008101-00014DA214FA001E |

```text
用户 iPhone App → HTTPS / Caddy → 硅谷 ECS Docker Spur Agent
  → DSH → 当前手机连接身份的 YouTube / Notion 授权 → 工具执行 → App
```

## 第一阶段：云端连接器代码、凭据与跨应用任务验证

以下保留前一阶段完整有效命令。章节中“待完成”均为该阶段当时的状态；后续 OAuth 与手机连接进展以本文后两阶段和顶部最终状态为准。

### 3. ECS：确认旧服务缺少新增能力

```bash
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
docker inspect spur-agent-ecs-smoke --format \
'Image={{.Config.Image}}
ImageID={{.Image}}
Restart={{.HostConfig.RestartPolicy.Name}}
User={{.Config.User}}
ShmSize={{.HostConfig.ShmSize}}
SecurityOpt={{json .HostConfig.SecurityOpt}}
Mounts={{json .Mounts}}'
```

旧容器检查结果：YouTube OAuth 模块及两个连接器文件不存在；只有模型凭据已配置；Notion、Google OAuth 配置、OAuth 文件和容器内访问令牌均未配置。旧健康接口仍为 200 ready，因此健康检查不能代表连接器就绪。外层 Caddy 鉴权与容器内鉴权是两个独立检查项。

### 4. Mac：构建、检查、推送镜像

```bash
cd /Users/x/X/space/spur
docker buildx build --platform linux/amd64 --load \
  -t spur-agent:youtube-notion-v1 \
  -f V2/agent/deploy/docker/Dockerfile V2

docker image inspect spur-agent:youtube-notion-v1 \
  --format 'ID={{.Id}} PLATFORM={{.Os}}/{{.Architecture}}'

docker run --rm --platform linux/amd64 --entrypoint node \
  spur-agent:youtube-notion-v1 -e '
const fs=require("node:fs");
for(const p of [
"/opt/spur/V2/web/youtube-oauth.mjs",
"/opt/spur/V2/agent/tools/connectors/youtube/index.cjs",
"/opt/spur/V2/agent/tools/connectors/notion/index.cjs"
]) console.log(p+": "+fs.existsSync(p));'
```

实际：`linux/amd64`，三个文件均为 true。本地 image ID 与本次 push digest 都为上述 `9fc1…d498`；一般情况下不能假设 image ID 总等于仓库 manifest digest。

提供过的独立冒烟命令：

```bash
docker run --rm --platform linux/amd64 --shm-size=1g \
  --security-opt seccomp=V2/agent/deploy/docker/seccomp-playwright.json \
  --volume "$PWD/V2/agent/deploy/docker/smoke.cjs:/tmp/smoke.cjs:ro" \
  --entrypoint /usr/local/bin/node spur-agent:youtube-notion-v1 /tmp/smoke.cjs
```

推送命令（ACR 密码不是 ECS root 密码）：

```bash
docker login aed-acr-registry.cn-hangzhou.cr.aliyuncs.com
docker tag spur-agent:youtube-notion-v1 \
  aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent:youtube-notion-v1
docker push aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent:youtube-notion-v1
```

ECS 拉取：

```bash
docker pull aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent@sha256:9fc1e5115f17bf06b8b224ef668330b9a6d4fe76e1e1e551f4c99b13abdbd498
```

实际返回 `Downloaded newer image`，digest 一致。

### 5. 安全传输配置：ECS 建目录，Mac 筛选并 SCP

不复制整个 env 或 `.runtime`，不在聊天、命令输出、镜像中暴露密钥。Notion 使用 NOTION_TOKEN；YouTube 使用 Google 客户端凭据和单用户刷新授权文件，所以多一个 JSON 文件。

ECS：

```bash
install -d -m 700 /root/spur-agent-upgrade
```

Mac（同一个终端连续执行，Python 报错时不要继续 SCP）：

```bash
cd /Users/x/X/space/spur
SPUR_TRANSFER_DIR=$(mktemp -d)
chmod 700 "$SPUR_TRANSFER_DIR"
python3 - "$SPUR_TRANSFER_DIR" <<'PY'
import json, os, sys
from pathlib import Path
root = Path('/Users/x/X/space/spur/V2')
dest = Path(sys.argv[1])
values = {}
for raw in (root / 'agent/config/siliconflow.env').read_text().splitlines():
    line = raw.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    key, value = line.split('=', 1)
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1]
    values[key.strip()] = value
keys = ['SILICONFLOW_API_KEY', 'SILICONFLOW_BASE_URL', 'SPUR_CHAT_MODEL',
        'NOTION_TOKEN', 'YOUTUBE_API_KEY', 'YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET']
for key in ['SILICONFLOW_API_KEY', 'NOTION_TOKEN', 'YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET']:
    if not values.get(key):
        raise SystemExit(f'缺少配置：{key}，停止传输。')
selected = {key: values[key] for key in keys if values.get(key)}
if any('\n' in value or '\r' in value or '${' in value for value in selected.values()):
    raise SystemExit('配置包含未展开变量或换行，停止传输。')
oauth = json.loads((root / 'web/.runtime/youtube-oauth.json').read_text())
if not oauth.get('refresh_token'):
    raise SystemExit('缺少 YouTube refresh_token，停止传输。')
for name, content in [
    ('connectors.env', ''.join(f'{key}={value}\n' for key, value in selected.items())),
    ('youtube-oauth.json', json.dumps(oauth)),
]:
    path = dest / name
    path.write_text(content)
    os.chmod(path, 0o600)
print('TRANSFER_FILES_READY：未输出密钥。')
PY
```

出现 `TRANSFER_FILES_READY` 后：

```bash
scp "$SPUR_TRANSFER_DIR/connectors.env" "$SPUR_TRANSFER_DIR/youtube-oauth.json" \
  root@47.254.17.22:/root/spur-agent-upgrade/ \
&& rm -f "$SPUR_TRANSFER_DIR/connectors.env" "$SPUR_TRANSFER_DIR/youtube-oauth.json" \
&& rmdir "$SPUR_TRANSFER_DIR"
```

实际两个文件均传输 100%。当前源文件 parser 适用于本次简单 KEY=VALUE 格式，不是通用 shell 脚本执行器。生产多人授权不能沿用共享单用户 JSON。

### 6. ECS：复用已有 Caddy 访问令牌

不新建令牌，不改变手机已有设置。缺少符合预期的原令牌即停止。

```bash
python3 - <<'PY'
import os, re
from pathlib import Path
root = Path('/root/spur-agent-upgrade')
values = {}
for raw in Path('/root/spur-https/agent.env').read_text().splitlines():
    line = raw.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    key, value = line.split('=', 1)
    values[key.strip()] = value.strip().strip("\"'")
token = values.get('SPUR_CREATOR_AGENT_TOKEN', '')
if not re.fullmatch(r'[A-Za-z0-9_-]{43}', token):
    raise SystemExit('未找到符合预期的现有访问令牌，停止。')
source = (root / 'connectors.env').read_text()
(root / 'agent.env').write_text(source.rstrip() + '\nSPUR_CREATOR_AGENT_TOKEN=' + token + '\n')
for name in ['agent.env', 'connectors.env', 'youtube-oauth.json']:
    os.chmod(root / name, 0o600)
print('CONFIG_READY：已复用现有令牌，未输出密钥。')
PY
```

### 7. ECS：独立测试卷和测试容器

以下名称为本次首次部署使用。未来若已存在同名测试容器，先检查，不要直接重复执行或删除。

```bash
docker volume create spur-agent-connectors-test-runtime
docker run --rm --user 0:0 \
  --mount type=volume,src=spur-agent-connectors-test-runtime,dst=/runtime \
  --mount type=bind,src=/root/spur-agent-upgrade/youtube-oauth.json,dst=/tmp/youtube-oauth.json,readonly \
  --entrypoint node \
  aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent@sha256:9fc1e5115f17bf06b8b224ef668330b9a6d4fe76e1e1e551f4c99b13abdbd498 -e '
const fs=require("node:fs");
fs.copyFileSync("/tmp/youtube-oauth.json","/runtime/youtube-oauth.json");
fs.chmodSync("/runtime/youtube-oauth.json",0o600);
fs.chownSync("/runtime/youtube-oauth.json",10001,10001);
fs.chownSync("/runtime",10001,10001);
console.log("OAUTH_IMPORTED");'

docker run -d --name spur-agent-connectors-test --platform linux/amd64 \
  --shm-size=1g --security-opt seccomp=/root/seccomp-playwright.json \
  --env-file /root/spur-agent-upgrade/agent.env \
  -p 127.0.0.1:4184:4173 \
  -v spur-agent-connectors-test-runtime:/opt/spur/V2/web/.runtime \
  aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent@sha256:9fc1e5115f17bf06b8b224ef668330b9a6d4fe76e1e1e551f4c99b13abdbd498
```

健康检查：

```bash
docker exec spur-agent-connectors-test node -e '
fetch("http://127.0.0.1:4173/api/creator-agent/health",{
 headers:{Authorization:"Bearer "+process.env.SPUR_CREATOR_AGENT_TOKEN},
 signal:AbortSignal.timeout(10000)
}).then(async r=>console.log("HTTP="+r.status,await r.text()))
.catch(e=>{console.error(e.message);process.exitCode=1});'
```

实际：HTTP 200，`status=ready`，`authConfigured=true`，`emailConfigured=false`（本次未接邮件）。

### 8. ECS：真实连接器只读验证

```bash
docker exec -i spur-agent-connectors-test node --input-type=module <<'JS'
import { createRequire } from 'node:module';
import { youtubeAccessToken } from '/opt/spur/V2/web/youtube-oauth.mjs';
const require = createRequire(import.meta.url);
const youtube = require('/opt/spur/V2/agent/tools/connectors/youtube/client.cjs');
const notion = require('/opt/spur/V2/agent/tools/connectors/notion/client.cjs');
const timer = setTimeout(() => { console.error('CHECK_TIMEOUT'); process.exit(1); }, 90000);
try {
  const token = await youtubeAccessToken(process.env, '/opt/spur/V2/web/.runtime');
  if (!token) throw new Error('YouTube 授权刷新失败');
  process.env.YOUTUBE_ACCESS_TOKEN = token;
  console.log('YOUTUBE_OAUTH_OK');
  const result = await youtube.searchVideos({query:'AI glasses',maxResults:2});
  console.log('YOUTUBE_SEARCH_OK');
  console.log(JSON.stringify(result));
  const pages = await notion.listPages();
  console.log('NOTION_READ_OK');
  console.log(JSON.stringify(pages));
} catch (error) {
  console.error('CHECK_FAILED:', error.message); process.exitCode=1;
} finally { clearTimeout(timer); }
JS
```

实际三个 OK 均出现。页面列表可能含私人标题，不要求将完整输出对外粘贴。本测试不调用模型，不写入 Notion。

### 9. ECS：模型驱动 YouTube → Notion 创建 → 回读

以下为本次已执行的真实写入命令，保留用于回溯。未来重跑应明确测试父页面和新标题；同名检查依赖模型，不是可靠的服务端跨请求幂等保证。超时后先查询实际写入，不能盲目重试。

```bash
docker exec -i spur-agent-connectors-test node --input-type=module <<'JS'
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 510000);
try {
  const response = await fetch('http://127.0.0.1:4173/api/creator-agent/chat', {
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.SPUR_CREATOR_AGENT_TOKEN},
    signal:controller.signal,
    body:JSON.stringify({message:`进行一次硅谷云端跨应用验收：
1. 用 youtube_search 搜索 AI glasses，只取2个公开视频。
2. 简短分析，并保留真实视频链接；不读取字幕，不扩展研究。
3. 在 Notion 父页面 40cf8a68-d361-80ce-9cad-f628950f43cb 下，新建子页面，标题为“硅谷ECS跨应用验收-YouTube-Notion-01”。
4. 报告控制在300字以内。若该父页面下已有同名验收页面，先读取并报告，不重复创建。
5. 写入后必须调用 notion_read_page 回读，核对标题、正文和视频链接。
6. 最后简短返回页面链接与回读结论。不要修改其他页面，不生成其他文件。`})
  });
  console.log('HTTP='+response.status); console.log(await response.text());
} catch(error) {
  console.error('REQUEST_FAILED:',error.message);
  console.error('若超时，先核对Notion和任务记录，不要直接重跑。');
} finally {clearTimeout(timer);}
JS
```

本次返回：

```text
runId=b31335f2-55fd-4fe1-8352-3978b27214e9
totalMs=32801; toolCalls=6; timedOut=false; exitCode=0
Agent 报告：标题、4 段正文、两个视频链接回读一致。
```

实际页面：https://app.notion.com/p/ECS-YouTube-Notion-01-40ff8a68d36181a492ade4c004342fa9

工具日志复核命令（用户确认已完成）：

```bash
docker exec spur-agent-connectors-test node -e '
const fs=require("node:fs");
const p="/opt/spur/V2/web/.runtime/runs/b31335f2-55fd-4fe1-8352-3978b27214e9/tool-events.jsonl";
for(const line of fs.readFileSync(p,"utf8").split("\n")){
 if(!line.trim())continue;
 const e=JSON.parse(line);
 console.log(JSON.stringify({event:e.event,tool:e.tool,available:e.available,summary:e.summary}));
}'
```

该 run 位于测试卷，不在正式卷；切换只导入 OAuth 文件，没有搬运测试任务历史。

### 10. ECS：备份、替换正式容器、自动失败回退

此段会短暂中断服务。仅适用于本次已核实的容器名、端口、数据卷和启动参数。未来必须先检查是否新增挂载、网络或配置，不要直接覆盖套用。

```bash
bash <<'SH'
set -euo pipefail
umask 077
IMAGE='aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent@sha256:9fc1e5115f17bf06b8b224ef668330b9a6d4fe76e1e1e551f4c99b13abdbd498'
OLD='spur-agent-ecs-smoke'
BACKUP="spur-agent-before-connectors-$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/root/spur-agent-upgrade/$BACKUP"
test -s /root/spur-agent-upgrade/agent.env
docker inspect "$OLD" >/dev/null
docker image inspect "$IMAGE" >/dev/null
install -d -m 700 "$BACKUP_DIR"
docker inspect "$OLD" > "$BACKUP_DIR/container.json"

rollback() {
  trap - ERR
  echo '切换未通过，正在恢复旧容器。'
  docker rm -f "$OLD" >/dev/null 2>&1 || true
  docker rename "$BACKUP" "$OLD"
  docker start "$OLD"
  echo "旧容器已恢复；备份目录：$BACKUP_DIR"
  exit 1
}

docker stop "$OLD"
if ! docker rename "$OLD" "$BACKUP"; then
  docker start "$OLD"
  exit 1
fi
trap rollback ERR

docker run --rm --user 0:0 \
  --mount type=volume,src=spur-agent-ecs-runtime,dst=/runtime,readonly \
  --mount "type=bind,src=$BACKUP_DIR,dst=/backup" \
  --entrypoint tar "$IMAGE" -czf /backup/runtime.tar.gz -C /runtime .

docker run --rm --user 0:0 \
  --mount type=volume,src=spur-agent-connectors-test-runtime,dst=/source,readonly \
  --mount type=volume,src=spur-agent-ecs-runtime,dst=/target \
  --entrypoint node "$IMAGE" -e '
const fs=require("node:fs");
const data=JSON.parse(fs.readFileSync("/source/youtube-oauth.json","utf8"));
if(!data.refresh_token)throw new Error("缺少YouTube刷新授权");
const target="/target/youtube-oauth.json";
fs.writeFileSync(target,JSON.stringify(data),{mode:0o600});
fs.chmodSync(target,0o600); fs.chownSync(target,10001,10001);'

docker run -d --name "$OLD" --restart unless-stopped --platform linux/amd64 \
  --shm-size=1g --security-opt seccomp=/root/seccomp-playwright.json \
  --env-file /root/spur-agent-upgrade/agent.env \
  -p 127.0.0.1:4173:4173 \
  -v spur-agent-ecs-runtime:/opt/spur/V2/web/.runtime "$IMAGE"

docker exec "$OLD" node -e '
(async()=>{
 for(let i=0;i<15;i++){
  try{
   const r=await fetch("http://127.0.0.1:4173/api/creator-agent/health",{
    headers:{Authorization:"Bearer "+process.env.SPUR_CREATOR_AGENT_TOKEN},
    signal:AbortSignal.timeout(3000)});
   const data=await r.json();
   if(r.ok&&data.status==="ready"&&data.authConfigured===true){
    console.log("PRODUCTION_HEALTH_OK",JSON.stringify(data));return;
   }
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,2000));
 }
 process.exitCode=1;
})().catch(()=>{process.exitCode=1});'
trap - ERR
echo 'SWITCH_OK'
echo "回滚容器：$BACKUP"
echo "私有备份：$BACKUP_DIR"
SH
```

实际输出：

```text
新容器 ID：a8c37fd304778a313007aa8c051721e8c4c21feafc5cafbaa4bb8a80d12ab2d9
PRODUCTION_HEALTH_OK {"status":"ready","model":"deepseek-ai/DeepSeek-V4.1-Flash","emailConfigured":false,"authConfigured":true,"reasons":[]}
SWITCH_OK
回滚容器：spur-agent-before-connectors-20261105-221724
私有备份：/root/spur-agent-upgrade/spur-agent-before-connectors-20261105-221724
```

备份内 `container.json` 可能含旧环境凭据，`runtime.tar.gz` 可能含私人记录和授权，只保留在 root 私有目录，不提交或对外分享。失败回退只恢复旧容器，不自动恢复数据卷快照；不等于数据库迁移回滚。

#### 后续人工回滚参考（本轮未执行）

在确认需要回滚、旧容器仍存在且新任务已停止后，才使用：

```bash
docker stop spur-agent-ecs-smoke
docker rename spur-agent-ecs-smoke "spur-agent-connectors-failed-$(date +%Y%m%d-%H%M%S)"
docker rename spur-agent-before-connectors-20261105-221724 spur-agent-ecs-smoke
docker start spur-agent-ecs-smoke
```

这会继续使用同一数据卷，不自动恢复 tar 备份。数据恢复须先评估更新后新增记录，另行备份与确认，不能直接清空卷。

### 11. 待完成：公网 HTTPS 与 iPhone 验收

ECS 已提供以下命令，但本轮尚未收到执行输出：

```bash
docker exec -i spur-agent-ecs-smoke node <<'JS'
(async()=>{
 const r=await fetch('https://api.hispurring.com/api/creator-agent/health',{
  headers:{Authorization:'Bearer '+process.env.SPUR_CREATOR_AGENT_TOKEN},
  signal:AbortSignal.timeout(15000),redirect:'error'});
 console.log('HTTPS_HTTP='+r.status,await r.text());
})().catch(e=>{console.error(e.message);process.exitCode=1});
JS
```

公网健康通过后，iPhone 保持原服务地址和令牌，提交：“搜索 YouTube 上两个 AI glasses 公开视频，简短总结并给出链接；再读取 Notion 页面列表确认连接，不创建或修改页面。”

该手机测试只读；完整写入闭环已在测试容器验证，正式 HTTPS 写入与手机写入是否验收应另记实际证据。手机访问失败时先区分 HTTPS、Bearer、App 配置和任务错误，不更换域名、不绕回旧 ECS。

### 12. 后续维护边界

- 当前仍为单用户授权，不具备多人 OAuth 隔离；Google access token 自动刷新不代表完整公网 OAuth 登录已开发。
- 测试容器、测试卷、旧容器和备份均保留，本轮没有清理；测试服务仍可能刷新其授权，后续验收后再规划停用。
- 正式 env 保留在 `/root/spur-agent-upgrade/agent.env`，后续重建需要它；不要误删后再假设能够原样重建。
- 未修改 DNS、Caddy 配置和安全组；4173、4184 继续只映射回环地址。
- 未部署 AgentMail；`emailConfigured=false` 是当前预期状态。
- 未验证长期任务恢复、主动提醒、跨请求幂等和超时故障恢复；本次成功是有限范围内的实际成果。

## 第二阶段：完成手机 App 自行连接账号的 OAuth 部署

第一阶段只是开发者共享账号在云端可用。第二阶段让用户在手机 Connect Apps 中授权自己的账号，任务通过 X-Spur-Connection 使用该手机连接身份的授权，不继承开发者共享 Notion / YouTube 凭据。当前仍是个人内测 Bearer 入口，不等于完成注册登录、跨设备恢复或完整多人 SaaS 隔离。

### 1. 官方平台配置（人工网页操作）

Google：已确认现有客户端为 Web 应用；保留本地回调，新增并保存：

```text
https://api.hispurring.com/api/connections/callback/youtube
```

Notion：在“开发者工具 → 连接 → 新连接”创建 `Spur App`，选择 OAuth、任意工作空间，填写名称后创建。原来 `spur_notion` 内部集成保留。新 OAuth 回调：

```text
https://api.hispurring.com/api/connections/callback/notion
```

用户截图确认读取、更新、插入内容已勾选。截图还勾选评论和电子邮件信息，助手说明本轮用不到、可取消；未收到取消后的确认，不能记录为已取消。市集“未发布”与开发测试授权状态分开理解。

### 2. ECS：隐藏输入 Notion Client ID / Secret 并保存配置

下面是已执行的凭据录入脚本；秘密不进入聊天或命令参数，输入由 getpass 从终端读取。字段不是旧 NOTION_TOKEN，也不是 ECS root 密码。脚本保留现有其他配置并创建私有备份，不重启容器。

```bash
python3 - <<'PY'
import getpass
import os
import tempfile
from datetime import datetime
from pathlib import Path

path = Path('/root/spur-agent-upgrade/agent.env')
if not path.is_file():
    raise SystemExit('原配置文件不存在，停止。')
client_id = getpass.getpass('粘贴 Notion 客户端 ID，然后回车：').strip()
client_secret = getpass.getpass('粘贴 Notion 客户端密钥，然后回车：').strip()
if not client_id or not client_secret:
    raise SystemExit('输入为空，未修改配置。')
if any(c in client_id + client_secret for c in '\r\n'):
    raise SystemExit('输入包含换行，未修改配置。')
updates = {
    'SPUR_PUBLIC_URL': 'https://api.hispurring.com',
    'NOTION_CLIENT_ID': client_id,
    'NOTION_CLIENT_SECRET': client_secret,
}
original = path.read_text()
backup = path.with_name('agent.env.before-oauth-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
fd = os.open(str(backup), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as f:
    f.write(original)
lines = [line for line in original.splitlines() if line.strip().split('=', 1)[0] not in updates]
lines.extend(f'{key}={value}' for key, value in updates.items())
fd, temporary = tempfile.mkstemp(dir=str(path.parent), prefix='.agent-env-')
with os.fdopen(fd, 'w') as f:
    f.write('\n'.join(lines) + '\n')
os.replace(temporary, path)
os.chmod(path, 0o600)
print('OAUTH_CONFIG_SAVED：已保存，未输出凭据；现有容器未变更。')
PY
```

用户实际返回：`OAUTH_CONFIG_SAVED`。后续只输出字段存在性的检查确认 NOTION_CLIENT_ID、NOTION_CLIENT_SECRET、SPUR_PUBLIC_URL 均为 True。

### 3. Caddy 排错：站点首行、Python 3.6、admin off

先前脚本没有适配实际环境，失败过程必须保留，避免未来重犯：

| 步骤 | 实际结果 | 原因与影响 |
|---|---|---|
| 首版整站点包装检查 | 配置与预期不一致，未修改 | 站点首行不是脚本硬编码的那一行；不代表 Notion 凭据失败 |
| 诊断字段 | 首行 False；末括号 True；鉴权匹配次数 1；上游 True；回调 False | 应只修改鉴权匹配器，不应重写整个站点 |
| 第二版 inspect 子进程 | TypeError: unexpected keyword argument 'text' | ECS Python 3.6 不支持 text=True/capture_output=True；报错在写文件之前 |
| 兼容 Python 后执行 reload | 已恢复原文件，重新加载未确认 | 错误详情最初被脚本隐藏，需要诊断，不能当作服务已停止 |
| 实际诊断 | running、host、ADMIN_OFF=True、VALIDATE_EXIT=0、Valid configuration | Caddy 禁用了管理 API，常规 reload 不适用；原服务和原配置均正常 |
| 最终成功方案 | validate 后 docker restart Caddy | 保留 admin off；仅两个 GET 回调免 Bearer，其余鉴权原样保留 |

只读诊断命令（Python 3.6 兼容；输出自动遮盖容器凭据）：

```bash
python3 - <<'PY'
import json, re, subprocess
from pathlib import Path

def run(args):
    return subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
result = run(['docker', 'inspect', 'spur-agent-https'])
if result.returncode:
    raise SystemExit('无法检查 Caddy 容器。')
info = json.loads(result.stdout)[0]
secrets = []
for item in info.get('Config', {}).get('Env', []):
    key, _, value = item.partition('=')
    if value and any(word in key.upper() for word in ['TOKEN', 'SECRET', 'PASSWORD', 'KEY']):
        secrets.append(value)
def redact(text):
    for value in sorted(secrets, key=len, reverse=True):
        text = text.replace(value, '<REDACTED>')
    text = re.sub(r'(?i)Bearer[^\r\n]*', 'Bearer <REDACTED>', text)
    return re.sub(r'(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])', '<REDACTED>', text)
path = Path('/root/spur-https/Caddyfile')
text = path.read_text()
print('CADDY_STATUS=' + info['State']['Status'])
print('NETWORK_MODE=' + info['HostConfig']['NetworkMode'])
print('ADMIN_OFF=' + str(bool(re.search(r'(?m)^\s*admin\s+off\s*$', text))))
print('CALLBACK_RULE_PRESENT=' + str('/api/connections/callback/' in text))
container_path = None
for mount in info['Mounts']:
    source = Path(mount['Source'])
    if source == path:
        container_path = mount['Destination']
        break
    if source in path.parents:
        container_path = str(Path(mount['Destination']) / path.relative_to(source))
if not container_path:
    raise SystemExit('CONFIG_MOUNT_NOT_FOUND')
print('CONFIG_PATH=' + container_path)
check = run(['docker', 'exec', 'spur-agent-https', 'caddy', 'validate', '--config', container_path, '--adapter', 'caddyfile'])
print('VALIDATE_EXIT=' + str(check.returncode))
print(redact(check.stdout + check.stderr)[-4000:])
PY
```

实际确定的配置路径：宿主 `/root/spur-https/Caddyfile` → 容器 `/etc/caddy/Caddyfile`。警告“Caddyfile 未格式化”不是验证失败；validate 过程中的临时服务关闭日志不等于正在运行的 Caddy 退出。

### 4. ECS：成功的 Caddy 修改、验证、重启命令

本段为历史实际成功版本，未来再执行会检测到已有回调而停止。配置文件原地写入，避免单文件 bind mount 仍引用旧 inode。会短暂中断 HTTPS，不停止 Agent。

```bash
python3 - <<'PY'
import os, re, subprocess
from datetime import datetime
from pathlib import Path
path = Path('/root/spur-https/Caddyfile')
original = path.read_text()
if '/api/connections/callback/' in original:
    raise SystemExit('已有回调配置，停止重复修改。')
pattern = re.compile(r'^([ \t]*)@unauthorized[ \t]+not[ \t]+header[ \t]+Authorization[ \t]+([^\r\n]+)$', re.MULTILINE)
matches = list(pattern.finditer(original))
if len(matches) != 1:
    raise SystemExit('未找到唯一鉴权规则，未修改。')
match = matches[0]
indent, authorization = match.group(1), match.group(2)
replacement = '\n'.join([
    indent + '@unauthorized {',
    indent + '    not header Authorization ' + authorization,
    indent + '    not {',
    indent + '        method GET',
    indent + '        path /api/connections/callback/youtube /api/connections/callback/notion',
    indent + '    }',
    indent + '}',
])
updated = original[:match.start()] + replacement + original[match.end():]
backup = path.with_name('Caddyfile.before-oauth-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
fd = os.open(str(backup), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as f:
    f.write(original)
def run(args):
    return subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=60)
try:
    path.write_text(updated)
    check = run(['docker', 'exec', 'spur-agent-https', 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'])
    if check.returncode:
        path.write_text(original)
        raise SystemExit('新配置验证失败，已恢复原文件；没有重启服务。')
except SystemExit:
    raise
except Exception:
    path.write_text(original)
    raise SystemExit('配置验证未完成，已恢复原文件；没有重启服务。')
try:
    result = run(['docker', 'restart', 'spur-agent-https'])
    if result.returncode:
        raise RuntimeError('restart failed')
except Exception:
    path.write_text(original)
    try:
        restored = run(['docker', 'restart', 'spur-agent-https'])
        ok = restored.returncode == 0
    except Exception:
        ok = False
    raise SystemExit('已恢复原配置文件；' + ('旧配置重启成功。' if ok else '容器状态待检查，请停止后续操作。'))
print('CADDY_CALLBACKS_READY')
print('Caddy 已重启；admin off 和原 Bearer 鉴权保留。')
print('备份位置：' + str(backup))
PY
```

实际成功输出：

```text
CADDY_CALLBACKS_READY
备份位置：/root/spur-https/Caddyfile.before-oauth-20261105-233507
```

普通 API 未带令牌的验证：

```bash
curl -sS -o /dev/null --connect-timeout 5 --max-time 15 \
  -w 'UNAUTH_HTTP=%{http_code}\n' \
  https://api.hispurring.com/api/creator-agent/health
```

实际：`UNAUTH_HTTP=401`。仅放行两个准确 GET 回调，未取消全站 API 鉴权。

### 5. Mac：构建并上传手机 OAuth 版镜像

由助手在本机构建，用户完成推送。镜像没有内置用户授权、Notion secret 或旧运行卷。

```bash
cd /Users/x/X/space/spur
docker buildx build --platform linux/amd64 --load -t spur-agent:app-oauth-v1 \
  -f V2/agent/deploy/docker/Dockerfile V2

docker image inspect spur-agent:app-oauth-v1 \
  --format 'ID={{.Id}} PLATFORM={{.Os}}/{{.Architecture}}'

docker tag spur-agent:app-oauth-v1 \
  aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent:app-oauth-v1
docker push aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent:app-oauth-v1
```

需要时先交互执行 docker login（不要把密码放参数）：

```bash
docker login aed-acr-registry.cn-hangzhou.cr.aliyuncs.com
```

用户实际 push digest：

```text
sha256:1e1cf3fc8ba15aaa604b50cdd5edc83eecadd4e5a9e985e5d7dee1cdebec30db
```

本地 Linux 临时连接身份测试实际返回 LINUX_CONNECTION_PROFILE_OK，未配置凭据时两个平台均正确 disconnected/configured=false；该检查不等于真实第三方 OAuth。

### 6. ECS：拉取、独立 OAuth 测试容器

```bash
docker pull aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent@sha256:1e1cf3fc8ba15aaa604b50cdd5edc83eecadd4e5a9e985e5d7dee1cdebec30db
docker volume create spur-agent-oauth-test-runtime
docker run -d --name spur-agent-oauth-test --platform linux/amd64 \
  --shm-size=1g --security-opt seccomp=/root/seccomp-playwright.json \
  --env-file /root/spur-agent-upgrade/agent.env \
  -p 127.0.0.1:4185:4173 \
  -v spur-agent-oauth-test-runtime:/opt/spur/V2/web/.runtime \
  aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent@sha256:1e1cf3fc8ba15aaa604b50cdd5edc83eecadd4e5a9e985e5d7dee1cdebec30db
```

验证身份与状态接口（不打印连接凭据，不开始真实第三方授权）：

```bash
docker exec -i spur-agent-oauth-test node <<'JS'
(async () => {
  const base = 'http://127.0.0.1:4173/api/creator-agent';
  const headers = {Authorization:'Bearer '+process.env.SPUR_CREATOR_AGENT_TOKEN};
  const health = await fetch(base+'/health',{headers,signal:AbortSignal.timeout(10000)});
  console.log('HEALTH_HTTP='+health.status,await health.text());
  if(!health.ok)throw new Error('健康检查未通过');
  const profile = await fetch(base+'/connections/profile',{method:'POST',headers,signal:AbortSignal.timeout(10000)});
  console.log('PROFILE_HTTP='+profile.status);
  if(!profile.ok)throw new Error('连接身份接口未通过');
  const data = await profile.json();
  if(!data.credential)throw new Error('未返回连接身份');
  const status = await fetch(base+'/connections',{
    headers:{...headers,'X-Spur-Connection':data.credential},signal:AbortSignal.timeout(15000)});
  console.log('CONNECTIONS_HTTP='+status.status);
  console.log(await status.text());
})().catch(e=>{console.error('CHECK_FAILED:',e.message);process.exitCode=1;});
JS
```

实际：health 200 ready/authConfigured=true；profile 201；connections 200；两个平台 configured=true、state=disconnected。未执行官方授权前不显示 connected，证明不是沿用开发者共享状态。

### 7. ECS：正式替换 OAuth 镜像，保留原卷、备份、失败回退

```bash
bash <<'SH'
set -euo pipefail
umask 077
IMAGE='aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent@sha256:1e1cf3fc8ba15aaa604b50cdd5edc83eecadd4e5a9e985e5d7dee1cdebec30db'
NAME='spur-agent-ecs-smoke'
BACKUP="spur-agent-before-app-oauth-$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/root/spur-agent-upgrade/$BACKUP"
test -s /root/spur-agent-upgrade/agent.env
docker image inspect "$IMAGE" >/dev/null
docker inspect "$NAME" >/dev/null
install -d -m 700 "$BACKUP_DIR"
docker inspect "$NAME" > "$BACKUP_DIR/container.json"
rollback() {
  trap - ERR
  echo '切换未通过，正在恢复旧容器。'
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker rename "$BACKUP" "$NAME"
  docker start "$NAME"
  echo '旧容器已恢复；请停止后续操作。'
  exit 1
}
docker stop "$NAME"
if ! docker rename "$NAME" "$BACKUP"; then
  docker start "$NAME"
  exit 1
fi
trap rollback ERR
docker run --rm --user 0:0 \
  --mount type=volume,src=spur-agent-ecs-runtime,dst=/runtime,readonly \
  --mount "type=bind,src=$BACKUP_DIR,dst=/backup" \
  --entrypoint tar "$IMAGE" -czf /backup/runtime.tar.gz -C /runtime .
docker run -d --name "$NAME" --restart unless-stopped --platform linux/amd64 \
  --shm-size=1g --security-opt seccomp=/root/seccomp-playwright.json \
  --env-file /root/spur-agent-upgrade/agent.env \
  -p 127.0.0.1:4173:4173 \
  -v spur-agent-ecs-runtime:/opt/spur/V2/web/.runtime "$IMAGE"
docker exec "$NAME" node -e '
(async()=>{
 for(let i=0;i<15;i++){
  try{
   const r=await fetch("http://127.0.0.1:4173/api/creator-agent/health",{
    headers:{Authorization:"Bearer "+process.env.SPUR_CREATOR_AGENT_TOKEN},signal:AbortSignal.timeout(3000)});
   const data=await r.json();
   if(r.ok&&data.status==="ready"&&data.authConfigured===true){console.log("PRODUCTION_HEALTH_OK",JSON.stringify(data));return;}
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,2000));
 }
 process.exitCode=1;
})().catch(()=>{process.exitCode=1});'
trap - ERR
echo 'OAUTH_SWITCH_OK'
echo "回滚容器：$BACKUP"
echo "私有备份：$BACKUP_DIR"
SH
```

本轮未收到 OAUTH_SWITCH_OK 和自动生成的回滚容器名称原文，不编造时间戳；随后公网新回调返回 400、手机真实授权完成，支持新服务已在正式入口工作。

备份含容器环境和私人运行数据，只保留 root 私有目录，不对外粘贴。上述回退只恢复旧容器，不自动还原运行卷；若未来有数据结构迁移，必须单独评估数据恢复。

### 8. 公网回调与普通 API 鉴权

```bash
for path in \
  /api/creator-agent/health \
  /api/connections/callback/youtube \
  /api/connections/callback/notion
do
  printf '%s ' "$path"
  curl -sS -o /dev/null --connect-timeout 5 --max-time 15 \
    -w '%{http_code}\n' "https://api.hispurring.com$path"
done
```

用户实际返回：

```text
/api/creator-agent/health 401
/api/connections/callback/youtube 400
/api/connections/callback/notion 400
```

401 表示普通 API 仍受保护；两个 400 表示回调到达新后端后因缺少有效 state/code 被拒绝，不能以此代替真实账号授权。

## 第三阶段：完成手机 App 构建、安装、启动和账号连接

### 1. Mac：构建签名 Release 1040

```bash
cd /Users/x/X/space/spur/V2/appV2/app_mobile
xcodebuild -workspace ios/SuprRing.xcworkspace -scheme SuprRing \
  -configuration Release -destination generic/platform=iOS \
  -derivedDataPath /tmp/spur-app-connections-build \
  CURRENT_PROJECT_VERSION=1040 MARKETING_VERSION=1.0.2 build \
  > /tmp/spur-app-connections-ios-build.log 2>&1
```

实际 BUILD SUCCEEDED。产物 `/tmp/spur-app-connections-build/Build/Products/Release-iphoneos/SuprRing.app`。先部署后端，再安装新客户端；旧云端没有 /connections/profile 会使新客户端任务失败。

### 2. Mac：检查连接、签名和安装版本

```bash
xcrun devicectl list devices
/usr/libexec/PlistBuddy -c 'Print CFBundleVersion' \
  /tmp/spur-app-connections-build/Build/Products/Release-iphoneos/SuprRing.app/Info.plist
codesign --verify --deep --strict \
  /tmp/spur-app-connections-build/Build/Products/Release-iphoneos/SuprRing.app
```

最初 eFLY unavailable，故没有安装；用户解锁并连接手机后，实际 available (paired)，包版本 1040，签名校验通过。连接状态不等于已确认采用无线传输。

### 3. Mac：实际安装、启动并复核

```bash
xcrun devicectl device install app \
  --device 00008101-00014DA214FA001E \
  /tmp/spur-app-connections-build/Build/Products/Release-iphoneos/SuprRing.app

xcrun devicectl device process launch \
  --device 00008101-00014DA214FA001E \
  --terminate-existing com.spur.recordingring

xcrun devicectl device info apps \
  --device 00008101-00014DA214FA001E \
  --filter "bundleIdentifier == 'com.spur.recordingring'"
```

实际输出：

```text
App installed: bundleID com.spur.recordingring
Launched application with com.spur.recordingring bundle identifier.
Spur  com.spur.recordingring  Version 1.0.2  Bundle Version 1040
```

这是编译后的原生安装包覆盖安装，不是只改 Metro 或 Fast Refresh。

### 4. 用户在手机完成真实官方授权

操作：侧边栏 → Connect Apps → YouTube → 官方 Google 授权 → 返回刷新；再连接 Notion → 官方选择工作区/允许访问页面 → 返回刷新。

用户于截图手机时间 **23:48** 确认全部成功，截图显示：

- YouTube：已连接，显示频道 LEO。
- Notion：已连接，显示 LEO Sun's Notion。
- 页面含重新授权与断开入口。

截图源（本机临时文件，未来可能清理）：`/var/folders/6j/911w8p554qv3ctgwplsb8s6c0000gn/T/codex-clipboard-c8a46f18-9a4f-4c8f-a7bf-acf26204a2ad.jpg`。

该状态由云端官方只读核验返回，不是旧示例列表的 Selected。下方 Gmail / Drive 的 Selected 仍为示例工具选择，不应误称已完成 OAuth。

## 手机后续语音任务验收（提示词已提供，结果待确认）

1. “请读取我已连接的 YouTube 频道，告诉我频道名称，以及最近发布的两个视频标题和链接。如果没有视频，就如实说明。”
2. “请列出我已授权给 Spur 的 Notion 页面名称，只读取，不创建也不修改。”
3. “帮我搜索 YouTube 上两个关于 AI 眼镜的公开视频，简短总结各自的主题，并保留视频链接。然后在我授权的 Notion 页面下，新建一篇‘手机语音联调测试’报告。如果有多个可选父页面，先问我存在哪里。写完后重新读取确认，最后把页面链接发给我。”

用户在执行这些语音测试前要求先记录文档，因此不能写成手机跨应用任务也已验收。第三项会真实写入，仅在用户主动测试时执行。

## 代码、接口与维护速查

- App 连接 UI：`V2/appV2/app_mobile/src/components/RealAppConnections.tsx`。
- 连接页面：`V2/appV2/app_mobile/src/screens/ConnectAppsScreen.tsx`。
- App API：`V2/appV2/app_mobile/src/services/appConnections.ts`、`creatorAgentApi.ts`。
- OAuth 服务：`V2/web/app-connections.mjs`；路由、任务配置：`V2/web/server.mjs`。
- 旧本地 OAuth：`V2/web/youtube-oauth.mjs`；保留给开发者兼容流程，不用它冒充用户授权。
- 连接器：`V2/agent/tools/connectors/youtube/`、`notion/`。
- `POST /api/creator-agent/connections/profile`：Bearer 下建立随机连接身份，App 安全保存。
- `GET /api/creator-agent/connections`：Bearer + X-Spur-Connection 查询真实状态。
- `POST /api/creator-agent/connections/{youtube或notion}/{start或disconnect}`：开始授权/断开。
- `POST /api/creator-agent/chat` 与任务进度请求携带 X-Spur-Connection。
- 手机 Keychain 保存连接身份，第三方令牌不回传手机。
- 云端加密连接数据：正式卷 `.runtime/app-connections/`；`encryption.key` 同卷保留，备份必须包含，不可丢失。拥有卷与密钥的服务器管理员仍可读取数据，不能把这种加密说成管理员不可访问。
- OAuth state 十分钟、一次性消费；重连/断开使旧流程失效；断开不保证撤回正在执行的外部请求。
- 单 Node 进程文件状态不是多副本事务数据库；共享 ECS Bearer 不是完整用户账号体系。

### 本轮代码检查结果

- 后端 27 项测试通过；移动相关 6 套 32 项通过；TypeScript / 改动文件 ESLint 通过；网页构建通过。
- 全量移动测试：35 套中 34 套、243 项中 240 项通过；3 项 AgentDashboard 旧首页断言不匹配，未伪报全部通过，也未为此改写现有首页。
- 测试命令（按对应环境运行）：

```bash
cd /Users/x/X/space/spur
node --test V2/web/app-connections*.test.mjs V2/web/email/*.test.mjs \
  V2/web/creator-agent-auth.test.mjs V2/web/performance.test.mjs V2/web/video-stream.test.mjs
npm --prefix V2/web run build
```

```bash
cd /Users/x/X/space/spur/V2/appV2/app_mobile
npx --no-install tsc --noEmit
npx --no-install jest --runInBand \
  __tests__/RealAppConnections.test.tsx __tests__/CreatorAgentApi.test.ts \
  __tests__/CreatorAgentIntegration.test.ts __tests__/AutomaticReplies.test.ts \
  __tests__/ChatApi.test.ts __tests__/AgentMailbox.test.tsx
```

### 资源与清理边界

正式容器仍为 spur-agent-ecs-smoke，restart unless-stopped，原卷 spur-agent-ecs-runtime，4173 回环；Caddy host 网络、admin off、域名不变。测试容器及卷（connectors-test / oauth-test）、历史容器和备份本轮没有清理。清理前核对数据和授权，不能删除正式卷/加密密钥。测试卷中的任务 runId 不自动进入正式卷。

未来回滚先核对真实旧容器名称，用“停止新容器→改名保留→旧容器恢复正式名称→启动”方式保留现场；数据恢复和 OAuth schema 兼容性另行评估，不直接清空原卷。Google/Notion 密钥轮换、生产多人登录隔离、跨设备恢复、长期调度和超时幂等仍需独立实施与验收。


## 2026年11月06日接续：手机任务成功反馈与回复排版修复

用户于手机截图 00:08 反馈“全部打通”，截图中显示选择 Notion 父页面后 Agent 返回已新建“手机语音联调测试”、回读确认及真实页面链接。此为用户确认与屏幕反馈，未在本轮重新读取服务器工具日志；此前“手机任务待执行”状态据此更新为用户反馈成功，不混同新的独立服务端审计。

发现首页 AI 回复直接用 Text 显示 Markdown，导致 **加粗** 标记裸露、列表拥挤及长 Notion URL 占据多行。修改：新增 V2/appV2/app_mobile/src/components/AgentReplyMarkdown.tsx，使用已有 react-native-markdown-display；首页与追问回复接入，支持段落、加粗、列表、标题与可点击链接；裸 Notion 长链接显示“打开 Notion 页面 ↗”，原链接目标不变，代码中的合法星号保留。无新增依赖，未更改云端执行逻辑。

TypeScript、改动组件 ESLint 通过；AgentReplyMarkdown / ChatScreen / AgentWorkspacePanel 共 3 套 13 项测试通过；iOS Release 1.0.2（1041）BUILD SUCCEEDED、签名验证通过、devicectl 返回 App installed。新 UI 最终视觉效果仍待用户查看。构建日志 /tmp/spur-reply-layout-ios-build.log，安装包沿用 /tmp/spur-app-connections-build/Build/Products/Release-iphoneos/SuprRing.app（该路径现为1041，不再是先前1040产物）。
