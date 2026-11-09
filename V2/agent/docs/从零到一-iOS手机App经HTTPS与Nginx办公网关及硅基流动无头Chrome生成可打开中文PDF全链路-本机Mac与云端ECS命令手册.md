# 从零到一：iOS App 经 HTTPS / Nginx 办公网关、硅基流动与无头 Google Chrome 生成可在手机打开的中文 PDF 全链路

本文记录 Spur **云端办公 PDF** 第一次打通时的完整路径：本机仓库、阿里云 ECS、Nginx、办公网关、Chrome 出 PDF、iOS App 下载并打开。  
初验：2026-08-28。后续（Agent Flow、字数连续写、海军蓝模板、App 内预览、排障）见 **§14**（至 2026-08-29）。  
现网域名：`https://api.hispurring.com`。ECS 公网 IP：`8.217.122.71`。

**不要**把本文当成改录音后端的手册。录音仍是 `/opt/audio-agent` + Bun + 端口 `18987`。本文只加办公两条路径。

本机改代码 **不会** 自动同步到 ECS。GitHub `git pull` 也只有已 push 的提交。现网做法是：在 Mac 改 `~/X/space/spur`，用 **scp** 覆盖 `/opt/Spur_ring/...`，再重启 **3081** 网关。不要进 Workbench 手改同一份文件（容易和仓库分叉）。**禁止** `pkill bun`。

---

## 1. 产品目标

手机说一句「做一份 PDF」→ 云端按字数/页数连续写正文（默认约两三页）→ **生成真正的 `%PDF` 文件**（不是把 Markdown 改名为 `.pdf`）→ 文件落到手机本地 → **在 Spur 内 Quick Look 打开**。不要 Safari、不要 `127.0.0.1`。

主路径是 **Agent Flow 卡片详情** 的「文档」块；设备页「云端文档」只作调试。

一页纯中文 PDF 体积应在 **几十 KB～一两百 KB**。若到 **约 7MB**，说明把整套 Noto 字体嵌进去了，那是已废弃的 `pdfkit` / `pdf-lib` 路径。

---

## 2. 现网拓扑（打通后）

```
iPhone App（HTTPS）
  POST https://api.hispurring.com/api/office
        { "prompt": "...", "kind": "pdf" }
              │
              ▼
     Nginx :443  （证书 Let's Encrypt）
       location /api/office     →  127.0.0.1:3081   spur-office-gateway
       location /office-files/  →  127.0.0.1:3081   读磁盘上的 PDF
       location /               →  127.0.0.1:18987  audio-agent（录音，勿改）
              │
              ▼
     gateway/server.mjs
       1) 硅基流动  DEEPSEEK_*  → 按字数/页数多轮写正文（不再死磕一整份 JSON）
       2) writeOfficePdf        → 无头 Google Chrome 把「海军蓝 token 模板」HTML 打成 PDF
       3) 落盘 agent/tools/sandbox/output/pdf-<时间戳>.pdf
       4) 返回 { ok, url, bytes, fileName }
              │
              ▼
     App 再 GET url
       https://api.hispurring.com/office-files/pdf-….pdf
       存到 App 沙盒 documentDirectory/office/
       iOS Quick Look（SpurFilePreview）在 App 内打开；Android 仍可走 expo-sharing
```

调试用网页 **dsh** 仍是本机 `127.0.0.1:3080`，**不进安全组、不给手机用**。Mac 若要开网页，自己做 SSH 隧道，见第 8 节。

| 角色 | 路径 / 端口 | 说明 |
|------|-------------|------|
| 录音 AI | `/opt/audio-agent`，`18987` | 禁止 `pkill bun`，禁止覆盖其 `.env` |
| 办公网关 | `/opt/Spur_ring/agent/gateway`，`127.0.0.1:3081` | 只监听回环 |
| 产物 | `/opt/Spur_ring/agent/tools/sandbox/output/` | PDF / PPTX |
| 仓库 | GitHub `https://github.com/SpaceEnstar01/Spur_ring` | 本机：`~/X/space/spur` |
| LLM | 硅基流动，变量名仍是 `DEEPSEEK_*` | 不要用 deepseek 官方 `thinking` 适配器 |
| 出 PDF | Google Chrome `--print-to-pdf` | 不要用发行版 Chromium 的 GLES 库 |

---

## 3. 代码落点（仓库内）

| 层 | 文件 | 职责 |
|----|------|------|
| 网关 | `agent/gateway/server.mjs` | `POST /api/office`，`GET /office-files/*`，`GET /health` |
| 启动 | `agent/gateway/run.sh` | nvm Node 22 + `spur-profile/.env` |
| 写 PDF | `agent/tools/pdf/src/write-pdf.mjs` | HTML + 无头 Chrome |
| 落盘 | `agent/tools/sandbox/src/output.mjs` | `output/` 目录 |
| 密钥样例 | `agent/runtime/spur-profile/.env.example` | 三行 `DEEPSEEK_*` |
| App API | `app/mobile/src/services/officeApi.ts` | 创建、下载；iOS 走原生 Quick Look |
| App 任务 | `app/mobile/src/services/officeJob.ts` | 卡片上后台生成、取消、轨迹 |
| App 主路径 | `app/mobile/src/screens/assistant/AgentFlowScreen.tsx` | Agent Flow 详情「文档」块 |
| App 悬浮球 | `app/mobile/src/components/AgentSkillPanel.tsx` | 口述做成 PDF/PPT |
| App 调试页 | `app/mobile/src/screens/office/CloudOfficeScreen.tsx` | 设备页「云端文档」，不是主路径 |
| 入口 | `app/mobile/src/screens/device/YanqiangVoiceDebugScreen.tsx` | 仍有「云端文档」调试入口 |
| 原生预览 | `app/mobile/ios/RecordingRing/SpurFilePreview.m` | QLPreviewController，需 Xcode Run |
| 路由 | `app/mobile/src/navigation/AppNavigator.tsx`、`types/navigation.ts` | `CloudOffice` |
| 域名 | `app/mobile/src/config/api.ts` | `AUDIO_AGENT_BASE_URL` = `https://api.hispurring.com` |
| UI 设计 | `app/docs/ios/Agent-Flow页-pdf-ppt生成UI设计.md` | Process 必须先成功再进详情 |

`agent/tools/pdf/src/index.ts` 只再导出 `write-pdf.mjs`，不要再走 `pdf-lib` 嵌整套字体。

PPT 走 `writeOfficePptx`，与 PDF 共用网关，**本文不展开 PPT 排版**。

---

## 4. 明确不要动的东西

- `/opt/audio-agent`、Bun、`18987`、录音 `/health` 必须仍是 `audio-agent`
- Nginx 的 `location /` 必须继续反代 `18987`
- 安全组不要放行 `3080`、`3081`
- 不要把办公 PDF 接到 `audio-agent` 的 `pdfReport.ts`（那是 Mac Chrome 给录音报告用的，路径不同）
- 不要用 `npx expo` 乱升 Expo；`expo-sharing` 跟 SDK 52
- `.env` 里只留有效赋值行；中文注释或 `chmod` 粘进去会把 `source` 弄坏

---

## 5. 本机 Mac：仓库与拷文件

本机根目录：`/Users/zexuansun/X/space/spur`（即 `~/X/space/spur`）。

Workbench **不能** `scp /Users/...`（那是你 Mac 的路径）。改代码后在 **Mac 终端** 往 ECS 拷。

### 5.1 第一次把办公相关文件拷上云（按需）

网关：

```bash
scp /Users/zexuansun/X/space/spur/agent/gateway/server.mjs \
    /Users/zexuansun/X/space/spur/agent/gateway/run.sh \
  root@8.217.122.71:/opt/Spur_ring/agent/gateway/
```

写 PDF（打通 Chrome 方案后，通常只需要这一份）：

```bash
scp /Users/zexuansun/X/space/spur/agent/tools/pdf/src/write-pdf.mjs \
  root@8.217.122.71:/opt/Spur_ring/agent/tools/pdf/src/write-pdf.mjs
```

注意：曾把整个 `gateway` 目录 `scp -r` 成 `/opt/Spur_ring/agent/gateway/gateway/`。正确结构是 `run.sh` 与 `server.mjs` **同级**。

也可以整仓 `git pull`（见第 6 节），不必每次 scp。

### 5.2 本机验收写 PDF（可选）

Mac 需已安装 Google Chrome。

```bash
node --input-type=module <<'EOF'
import { writeOfficePdf } from '/Users/zexuansun/X/space/spur/agent/tools/pdf/src/write-pdf.mjs'
import { readFileSync } from 'node:fs'
const dest = '/tmp/spur-office-one-page.pdf'
await writeOfficePdf({
  title: '纳斯达克上市流程',
  body: '发行人需满足财务、治理与信息披露要求。',
  bullets: ['财务门槛', '信息披露'],
}, dest)
const b = readFileSync(dest)
console.log('bytes', b.length, 'magic', b.subarray(0, 8).toString('latin1'))
EOF
```

期望：`bytes` 约 6万～15万，`magic` 为 `%PDF-1.`。

---

## 6. 云端 ECS（阿里云 Linux / Workbench）：从零铺到能生成

以下均在 **Workbench 或 SSH 到 root@8.217.122.71** 执行。系统是 yum 系（Alibaba Cloud Linux 3），不是 Ubuntu 的 apt（`agent/deploy/README.md` 里 apt 段仅作对照）。

### 6.1 代码目录

```bash
cd /opt
# 若尚无仓库：
# git clone https://github.com/SpaceEnstar01/Spur_ring.git
cd /opt/Spur_ring
git pull
```

运行树：`/opt/Spur_ring/agent/`。

### 6.2 Node 22（nvm）

网关 `run.sh` 依赖 nvm 的 Node 22。

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] || curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
. "$NVM_DIR/nvm.sh"
nvm install 22
nvm use 22
node -v
```

### 6.3 密钥（与 iOS / audio-agent 同一套硅基流动）

```bash
cp -n /opt/Spur_ring/agent/runtime/spur-profile/.env.example \
      /opt/Spur_ring/agent/runtime/spur-profile/.env
# 用编辑器只保留三行赋值，不要粘 shell 注释进 .env
```

文件内容形态：

```bash
DEEPSEEK_API_KEY=sk-实际密钥
DEEPSEEK_BASE_URL=https://api.siliconflow.cn/v1
DEEPSEEK_MODEL=deepseek-ai/DeepSeek-V3
```

```bash
chmod 600 /opt/Spur_ring/agent/runtime/spur-profile/.env
```

`DEEPSEEK_BASE_URL` 必须是硅基流动。不要配成会返回 `thinking` 400 的官方 DeepSeek 适配。

### 6.4 中文字体（Chrome 排版用系统字体，再子集嵌入 PDF）

Linux 上 Chrome 的 CSS 会找 `Noto Sans SC` / `Noto Sans CJK SC`。现网曾用：

```text
/usr/share/fonts/truetype/noto/NotoSansSC-Regular.otf
```

若没有，按发行版安装 Noto CJK（包名因 yum 源而异），然后：

```bash
fc-cache -f
fc-list :lang=zh | head
```

### 6.5 安装 Google Chrome（不要用自带 Chromium 出 PDF）

发行版 `chromium-browser` 在无头环境会加载：

```text
/usr/lib64/chromium-browser/libGLESv2.so
```

常见失败：`Permission denied` → GPU 进程退出 → App 里 `Chrome PDF failed (null)`。UPower / D-Bus 日志可忽略。

```bash
chmod -R a+rX /usr/lib64/chromium-browser 2>/dev/null || true

cat >/etc/yum.repos.d/google-chrome.repo <<'EOF'
[google-chrome]
name=google-chrome
baseurl=https://dl.google.com/linux/chrome/rpm/stable/x86_64
enabled=1
gpgcheck=1
gpgkey=https://dl.google.com/linux/linux_signing_key.pub
EOF

yum install -y google-chrome-stable
ls -l /opt/google/chrome/chrome
/opt/google/chrome/chrome --version
```

`write-pdf.mjs` 会优先用 `/opt/google/chrome/chrome`。覆盖路径：`export SPUR_CHROME=/opt/google/chrome/chrome`（可写进 `run.sh` 前或 `.env`，当前 `.env` 未强制要求这一行）。

可选：在 ECS 上直接打一份 PDF 确认 Chrome：

```bash
cd /opt/Spur_ring
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22
node --input-type=module <<'EOF'
import { writeOfficePdf } from '/opt/Spur_ring/agent/tools/pdf/src/write-pdf.mjs'
import { readFileSync } from 'node:fs'
const dest = '/tmp/ecs-chrome.pdf'
await writeOfficePdf({ title: '测试', body: '云端中文一页。', bullets: ['A'] }, dest)
const b = readFileSync(dest)
console.log('bytes', b.length, b.subarray(0, 8).toString('latin1'))
EOF
```

### 6.6 办公网关启动与重启

```bash
chmod +x /opt/Spur_ring/agent/gateway/run.sh

pkill -f 'agent/gateway/server.mjs' || true
fuser -k 3081/tcp 2>/dev/null || true

nohup /opt/Spur_ring/agent/gateway/run.sh >/var/log/spur-office-gateway.log 2>&1 &
sleep 2
curl -sS http://127.0.0.1:3081/health
ss -lntp | grep 3081
```

期望 JSON：

```json
{"ok":true,"service":"spur-office-gateway"}
```

**必须** `fuser -k 3081/tcp` 或按 pid `kill`。只 `pkill` 经常杀不掉，端口仍被旧进程占着（`EADDRINUSE`），会一直跑旧的写 PDF 代码。

看日志：

```bash
tail -n 80 /var/log/spur-office-gateway.log
```

本机生成（不经 Nginx）：

```bash
curl -sS -X POST http://127.0.0.1:3081/api/office \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"写一页纳斯达克上市流程","kind":"pdf"}'
```

应返回 `url`、`fileName`、`bytes`。`bytes` 不应接近 7e6。

### 6.7 Nginx（现网是 Nginx，不是 Caddy）

站点文件：`/etc/nginx/conf.d/api.hispurring.com.conf`。

原则：**只加** `/api/office` 与 `/office-files/` 到 `3081`；`location /` 仍到 `18987`。

在 **443 server** 里、`location /` **之前** 加入（`proxy_pass` 不要丢 Host）：

```nginx
    location /api/office {
        proxy_pass http://127.0.0.1:3081;
        proxy_http_version 1.1;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /office-files/ {
        proxy_pass http://127.0.0.1:3081;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_max_temp_file_size 0;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
```

现网 `serveFile` 用 `readFileSync` + `res.end` 一次返回，避免 Nginx 反代 Node **流式**下载在约 147KB 被 HTTP/2 掐断。不要 `alias` 让 nginx 用户直接读 `/opt`（`/` 曾为 `700` 时读不了）。

HTTPS server 上已有 Let's Encrypt：

```text
ssl_certificate     /etc/letsencrypt/live/api.hispurring.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/api.hispurring.com/privkey.pem;
```

应用：

```bash
nginx -t
systemctl reload nginx
```

验收（任意能访问公网的机器）：

```bash
curl -sS https://api.hispurring.com/health
# 必须：service 为 audio-agent

curl -sS https://api.hispurring.com/api/office/health
# 必须：service 为 spur-office-gateway
```

目录 URL 应 404 JSON，且 **不能把网关打崩**（曾对 `GET /office-files/` 做 `createReadStream` 目录导致 `EISDIR` 进程退出，全站办公 502）：

```bash
curl -sS -D - https://api.hispurring.com/office-files/ | head
```

---

## 7. iOS App 设置

### 7.1 域名

`app/mobile/src/config/api.ts` 中开发与正式默认都是：

```text
https://api.hispurring.com
```

办公请求：`POST ${AUDIO_AGENT_BASE_URL}/api/office`。  
下载：网关返回的 `https://api.hispurring.com/office-files/...`。

手机上的 `127.0.0.1` 是手机自己，**没有** ECS 的 3080。不要把 dsh 的 `http://127.0.0.1:3080/spur-office/...` 发给用户。

### 7.2 界面（主路径 2026-08-29）

1. 底部右 Tab **Agent Flow** → 卡片先 **Process 成功**（`POST /api/audio-task`）
2. 进卡片详情：转写下面 **文档** 块（无任务则隐藏）
3. 悬浮球说「做成 PDF / PPT」并确认 → 同卡生成；切走 Tab 仍在进程内跑
4. 成功后 **打开本机文件** → Spur 内 Quick Look

设备页「云端文档」仅调试。仅改 JS：Reload 或 Xcode Run。改了 `SpurFilePreview.m`：**必须 Xcode Run**。

### 7.3 依赖

需要 `expo-file-system`、`expo-sharing`（现网 Pod 已有 `ExpoSharing`）。在 `app/mobile` 安装请用项目自带 Expo，避免 `npx expo` 把 SDK 拉到 57：

```bash
cd /Users/zexuansun/X/space/spur/app/mobile
./node_modules/.bin/expo install expo-sharing
npx pod-install
```

用 Xcode 重新编译安装到真机后再测（仅 Metro 热更新可能不够）。

文案：`app/mobile/src/locales/zh.ts` / `en.ts` 的 `t.office.*`、`t.device.cloudOffice*`。

---

## 8. 本机 SSH 隧道（仅调试 dsh 网页，手机 PDF 不需要）

```bash
ssh -N -L 127.0.0.1:3080:127.0.0.1:3080 root@8.217.122.71
```

然后 Mac 浏览器：`http://127.0.0.1:3080`。  
dsh 里的 `/spur-office/document-….pdf` 只有隧道存在时电脑能开，**不能当 App 下载地址**。

SSH 公钥加在 ECS `/root/.ssh/authorized_keys`。Workbench「免密」和实例登录密码不是一回事；重置 ECS 密码会重启机器，录音与网关都要确认是否还在。

---

## 9. 一条龙验收命令

在 Mac（不要走会 403 的本地代理时，可 `unset http_proxy https_proxy`）：

```bash
curl -sS https://api.hispurring.com/health
curl -sS https://api.hispurring.com/api/office/health

curl -sS -X POST https://api.hispurring.com/api/office \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"写一页特斯拉发展历史","kind":"pdf"}'
```

把返回的 `url` 再 curl：

```bash
curl -sS -D - -o /tmp/office-check.pdf 'https://api.hispurring.com/office-files/把fileName填这里.pdf'
xxd -l 8 /tmp/office-check.pdf
ls -l /tmp/office-check.pdf
```

期望：`HTTP/2 200`，`content-type: application/pdf`，文件以 `%PDF` 开头，体积远小于 7MB。

App：Agent Flow 详情 → 文档块 → 打开本机文件（Quick Look）。旧 `document-*.pdf` 或 `pdf-lib` 产物不要当验收样本。

---

## 10. 走过的弯路（避免再踩）

| 现象 | 原因 | 正确做法 |
|------|------|----------|
| Cursor 打开 `.pdf` 全是符号 | 编辑器当文本读 | 用 Chrome / Preview / 手机图书 |
| 电脑 Chrome 正常、iOS 叠字乱码 | `pdf-lib` 嵌 CJK 编码 iOS PDFKit 不认 | 改 Chrome 打印，不要再调 subset |
| 一页字 7MB，浏览器打不开 | 整份 Noto OTF 嵌入；Nginx 反代大约 128KB 后连接被掐 | Chrome 子集；体积应很小 |
| `Chrome PDF failed (null)` + `libGLESv2.so Permission denied` | yum Chromium 无头 GLES | 安装 `google-chrome-stable` |
| 公网 502、网关消失 | `GET /office-files/` 对目录 `createReadStream` → `EISDIR` | 只给真实文件名；非文件返回 404 |
| 改了代码 PDF 还是旧行为 | 3081 仍是旧 pid | `fuser -k 3081/tcp` 再 `run.sh` |
| 手机打不开 `127.0.0.1:3080` | 环回地址是手机自己 | 只用 `https://api.hispurring.com/office-files/...` |
| HEAD 请求 404 | 网关当初只实现 GET | 浏览器预览偶发失败；GET 下载 App 已走通 |
| Workbench scp Mac 路径失败 | 文件不在 ECS 上 | 在 `zexuansun@X` 执行 scp |
| 所有块 Processing failed | `/` 为 `700`，nginx 写不了 client_body | `chmod 755 /` |
| 缴费后 PDF 仍 502 | 3081 未随开机拉起 | 只重启办公 `run.sh`，勿 `pkill bun` |
| 本机已改、云上仍一页 200 字 | scp 中断，ECS 仍旧网关 | 查云上文件再 scp |
| 写文案 JSON 语法错 | 中文引号打坏数组 | `===PARAS===` + `parseDraft` |
| SSH `pkill -f ...server.mjs` 直接 255 | 命令行含同一路径，误杀 SSH | 只用 `fuser -k 3081/tcp` |

---

## 11. 写 PDF 方案为什么换成 Chrome

`pdf-lib` / `pdfkit` 直接嵌 Linux 上的 Noto SC OTF 时：要么 iOS 乱码，要么无法可靠子集、文件暴涨到数 MB。

2023 年后常见工程做法是 **HTML + 无头 Chromium `print-to-pdf`**：HarfBuzz 排中文，只把用到的字形写进 PDF。录音报告 `app/cloud/audio-agent/src/pdfReport.ts` 在 Mac 上已是这条路；办公 PDF 在 ECS 上用 **Google Chrome** 复用同一能力，不修改 audio-agent。

`write-pdf.mjs` 启动参数包含 `--no-sandbox`、`--disable-gpu`、`--use-gl=disabled` 等，适配无桌面的 ECS。

---

## 12. 日常改完代码后的最短更新

**Mac：**

```bash
scp /Users/zexuansun/X/space/spur/agent/tools/pdf/src/write-pdf.mjs \
  root@8.217.122.71:/opt/Spur_ring/agent/tools/pdf/src/write-pdf.mjs

scp /Users/zexuansun/X/space/spur/agent/gateway/server.mjs \
  root@8.217.122.71:/opt/Spur_ring/agent/gateway/server.mjs
```

**ECS 重启网关（不要在 SSH 一行里 `pkill -f` 带 `server.mjs` 路径）：**

```bash
fuser -k 3081/tcp 2>/dev/null || true
sleep 1
nohup /opt/Spur_ring/agent/gateway/run.sh >/var/log/spur-office-gateway.log 2>&1 &
sleep 2
curl -sS http://127.0.0.1:3081/health
```

App 只改 JS：Reload 或 Xcode Run。云端 PDF 引擎变了不必改 App。改了 Quick Look 原生代码必须 Xcode Run。

---

## 13. 相关文档

- 密钥约定：`agent/docs/llm-base.md`
- Workbench 短指令（含过时的 Caddy 示例）：`agent/deploy/README.md` —— **生产反代以 Nginx 为准**
- 网关说明：`agent/gateway/README.md`
- dsh 调试：`agent/runtime/spur-profile/README.md`（`create_pdf` 网页路径 `/spur-office/`，不是手机公网 URL）
- Agent Flow UI：`app/docs/ios/Agent-Flow页-pdf-ppt生成UI设计.md`
- 画面地图：`app/docs/ios/APP画面地图.md`

---

## 14. 2026-08-28～29 后续

### 14.1 代码怎么上云

本机 Cursor 改的是 `~/X/space/spur`。ECS `/opt/Spur_ring` 不会自动跟上。必须 **scp 后重启 3081**。不要用 Workbench 当编辑器改同一文件。

曾把配额改在本机，scp 中断，欠费重启后仍是旧 `MAX_PAGES = 10` + `Keep it to one page`。以 ECS 文件为准。

### 14.2 Process ≠ PDF

「Agent Flow 处理失败」只指 `POST /api/audio-task`。办公失败不得把卡片 Process 标失败。

全卡片 Process 挂、办公小 JSON 还能过：Nginx 写 `/var/lib/nginx/tmp/client_body` 失败，因为 **`/` 曾是 `drw-------`**。`chmod 755 /`。不要为此改 UI。

录音 health 好、办公 502：开机后 bun 可能还在，**3081 要手动 `run.sh`**。App 不必再 Xcode Run。

### 14.3 下载与超时

两页约 350KB 生成约 30s，下载卡死：流式反代约 147KB 被掐。现网一次读完 + `proxy_buffering off`。

5 页英文 timeout：iOS `fetch` 约 60s。App 办公用 XHR 300s；Nginx `/api/office` 300s。

### 14.4 字数 / 页数

旧逻辑默认一页摘要。现网：`5000字` / `五千字` / `1万字` / `5000个字` / `三页` 都要认；没说则默认约 3 页；多轮续写直到字数够。只说页数才切 N 张。文案用 `===TITLE===` / `===PARAS===`，坏 JSON 也能捞段落。PPT 不要 `slice(0, 1800)`。

### 14.5 版式 token

`write-pdf.mjs` 版式写死。默认海军蓝顶栏 `#002D58`、强调 `#0070C0`。明确说黄底 / 红色商务 / 深色才换 token。模型不写 CSS。PPT 色板尚未与 PDF 完全对齐。

### 14.6 App 内打开

`SpurFilePreview.m` → Quick Look。以后 Excel 可走同一套。须 Xcode Run。

### 14.7 同卡迭代（未做）

第二次生成是新文件重写，不读上一份 PDF。AI 改写才带 `previousOutput`。同卡「旧正文 + 修改意见」是产品迭代；飞轮还要把轨迹沉淀后再用。暂缓。
