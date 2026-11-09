# 硅谷 ECS 更新 Personal Agent 容器并接通 YouTube 与 Notion：终端操作与回滚记录

日期：2026-11-05（Asia/Shanghai）。本文依据本次对话中用户实际执行的命令和返回结果整理。只记录部署，不代表其他功能已验收。文档里的历史命令不是未来自动执行授权。

## 1. 目标、架构与实际完成范围

将另一开发平台已写入本地 Spur V2、并已验证的 YouTube / Notion Connector 部署到现有硅谷 ECS；不重新开发连接器，不重建 ECS，不修改域名，不经过旧 ECS，不操作 ACK。

```text
iPhone Spur V2
  → https://api.hispurring.com
  → 硅谷 ECS 47.254.17.22 的现有 Caddy
  → 127.0.0.1:4173
  → Docker spur-agent-ecs-smoke
  → Node.js → DSH → YouTube / Notion 工具
```

| 事项 | 本次证据与状态 |
|---|---|
| 最新 Linux AMD64 镜像 | 本地构建、文件检查、ACR 推送、ECS 拉取均成功 |
| 本地 smoke.cjs | 提供了命令，但本段对话没有收到 SMOKE PASS 输出，不单独记为通过 |
| 云端独立测试容器 | HTTP 200、ready、authConfigured=true |
| YouTube OAuth 刷新、公开视频搜索 | YOUTUBE_OAUTH_OK、YOUTUBE_SEARCH_OK；返回两个真实视频 |
| Notion 读取 | NOTION_READ_OK；返回已共享页面列表 |
| 模型驱动跨应用任务 | 32.801 秒、6 次工具调用、exitCode=0、未超时；返回创建与回读结果 |
| 工具日志复核 | 用户确认已完成；本对话没有逐行粘贴该次日志 |
| 正式容器更新 | PRODUCTION_HEALTH_OK、SWITCH_OK；旧容器和数据备份保留 |
| 更新后的公网 HTTPS、iPhone 调用 | 已提供检查方法，尚未收到结果，待确认 |
| 超时后跨请求重复写入、故障恢复 | 本轮没有故障注入验收；正常任务成功不能替代该项 |

## 2. 固定信息与代码位置

- Mac 主仓：`/Users/x/X/space/spur`。
- 移动端：`/Users/x/X/space/spur/V2/appV2/app_mobile`。
- 服务端：`/Users/x/X/space/spur/V2/web/server.mjs`。
- YouTube OAuth：`/Users/x/X/space/spur/V2/web/youtube-oauth.mjs`。
- 连接器：`/Users/x/X/space/spur/V2/agent/tools/connectors/{youtube,notion}/`。
- Dockerfile：`/Users/x/X/space/spur/V2/agent/deploy/docker/Dockerfile`。
- 主机：`iZrj926o99lormjfsmw2yyZ`；ECS 精确 CPU / 内存规格本轮未收到输出，待确认。
- 正式卷：`spur-agent-ecs-runtime` → `/opt/spur/V2/web/.runtime`。
- 测试卷：`spur-agent-connectors-test-runtime`；测试端口仅 `127.0.0.1:4184`。
- 沙箱：`/root/seccomp-playwright.json`；`--shm-size=1g`；镜像默认 UID/GID 10001。
- 原 HTTPS 文件确认存在：`/root/spur-https/Caddyfile`、`/root/spur-https/agent.env`。
- 本次镜像：`aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent@sha256:9fc1e5115f17bf06b8b224ef668330b9a6d4fe76e1e1e551f4c99b13abdbd498`。
- 本地标签 / ACR 标签：`spur-agent:youtube-notion-v1` / `youtube-notion-v1`。未来更新使用新标签与实际 digest，不把本次 digest 当成永远最新。

## 3. ECS：确认旧服务缺少新增能力

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

## 4. Mac：构建、检查、推送镜像

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

## 5. 安全传输配置：ECS 建目录，Mac 筛选并 SCP

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

## 6. ECS：复用已有 Caddy 访问令牌

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

## 7. ECS：独立测试卷和测试容器

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

## 8. ECS：真实连接器只读验证

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

## 9. ECS：模型驱动 YouTube → Notion 创建 → 回读

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

## 10. ECS：备份、替换正式容器、自动失败回退

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

### 后续人工回滚参考（本轮未执行）

在确认需要回滚、旧容器仍存在且新任务已停止后，才使用：

```bash
docker stop spur-agent-ecs-smoke
docker rename spur-agent-ecs-smoke "spur-agent-connectors-failed-$(date +%Y%m%d-%H%M%S)"
docker rename spur-agent-before-connectors-20261105-221724 spur-agent-ecs-smoke
docker start spur-agent-ecs-smoke
```

这会继续使用同一数据卷，不自动恢复 tar 备份。数据恢复须先评估更新后新增记录，另行备份与确认，不能直接清空卷。

## 11. 待完成：公网 HTTPS 与 iPhone 验收

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

## 12. 后续维护边界

- 当前仍为单用户授权，不具备多人 OAuth 隔离；Google access token 自动刷新不代表完整公网 OAuth 登录已开发。
- 测试容器、测试卷、旧容器和备份均保留，本轮没有清理；测试服务仍可能刷新其授权，后续验收后再规划停用。
- 正式 env 保留在 `/root/spur-agent-upgrade/agent.env`，后续重建需要它；不要误删后再假设能够原样重建。
- 未修改 DNS、Caddy 配置和安全组；4173、4184 继续只映射回环地址。
- 未部署 AgentMail；`emailConfigured=false` 是当前预期状态。
- 未验证长期任务恢复、主动提醒、跨请求幂等和超时故障恢复；本次成功是有限范围内的实际成果。
