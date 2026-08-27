# 阿里云 Workbench：Spur Agent 最短指令

现网录音后端不要动：`/opt/audio-agent`、Caddy 反代 `18987`、`https://api.hispurring.com`。  
Agent 另放目录、另用端口，先内网验收，**先不要改 Caddy**。

以前 audio-agent 用 ngrok 传 tar；这次代码已在 GitHub，Workbench **git 拉下来**即可。

---

## 1. 和现网的关系

| | 录音 AI | 本次 Agent |
|--|---------|------------|
| 目录 | `/opt/audio-agent` | `/opt/Spur_ring`（只跑里面的 `agent/`） |
| 端口 | `18987` | `3080`（只本机） |
| 域名 | `api.hispurring.com` | 暂不挂 |

不要 `pkill bun`，不要覆盖 `/opt/audio-agent/.env`。

---

## 2. Workbench：拉代码（整仓或只 agent）

仓库若是私有，先配 GitHub 登录（Token / SSH），再：

**整仓：**

```bash
cd /opt
git clone https://github.com/SpaceEnstar01/Spur_ring.git
cd /opt/Spur_ring
git pull
```

**只要 agent/：**

```bash
cd /opt
git clone --filter=blob:none --sparse https://github.com/SpaceEnstar01/Spur_ring.git
cd Spur_ring
git sparse-checkout set agent
```

---

## 3. 机器依赖（Ubuntu / Debian）

```bash
sudo apt-get update
sudo apt-get install -y git curl fonts-noto-cjk
```

Node **22**（不要系统自带的 18/20）：

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm install 22
nvm use 22
corepack enable
corepack prepare pnpm@11.7.0 --activate
node -v   # v22.x
pnpm -v
```

---

## 4. 安装与配置

```bash
cd /opt/Spur_ring/agent/runtime/deepseek-harness
pnpm install
pnpm run build

cd /opt/Spur_ring/agent/tools/pdf && npm install
cd /opt/Spur_ring/agent/tools/pptx && npm install
```

密钥（与 iOS / audio-agent 同一套硅基流动，**不要提交 git**）：

```bash
cp /opt/Spur_ring/agent/runtime/spur-profile/.env.example \
   /opt/Spur_ring/agent/runtime/spur-profile/.env
nano /opt/Spur_ring/agent/runtime/spur-profile/.env
chmod 600 /opt/Spur_ring/agent/runtime/spur-profile/.env
```

```env
DEEPSEEK_API_KEY=你的硅基流动Key
DEEPSEEK_BASE_URL=https://api.siliconflow.cn/v1
DEEPSEEK_MODEL=deepseek-ai/DeepSeek-V3
```

可从 `/opt/audio-agent/.env` **手工抄这三行**，不要整文件覆盖。

---

## 5. 启动（Workbench）

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22
set -a
source /opt/Spur_ring/agent/runtime/spur-profile/.env
set +a
cd /opt/Spur_ring/agent/runtime/deepseek-harness
pkill -f 'dsh web' || true
nohup pnpm dsh web --patch /opt/Spur_ring/agent/runtime/spur-profile/cordis.patch.yml \
  --no-open --host 127.0.0.1 --port 3080 \
  >/var/log/spur-agent.log 2>&1 &
```

检查：

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3080
tail -n 20 /var/log/spur-agent.log
```

浏览器不要直接打公网 `8.217.122.71:3080`（安全组也别开 3080）。本机预览用 SSH 隧道：

```bash
ssh -L 3080:127.0.0.1:3080 你的ECS
```

然后打开 `http://127.0.0.1:3080`。

---

## 6. 验收

对话里说「做一页特斯拉 PDF / PPT」，应生成合法文件。  
云上产物目录：

```text
/opt/Spur_ring/agent/tools/sandbox/output/
```

录音链路验收仍用：

```bash
curl -sS https://api.hispurring.com/health
```

应继续正常。

---

## 以后更新 Agent

本机 push `Spur_ring` 之后，Workbench：

```bash
cd /opt/Spur_ring
git pull
# 若依赖有变，再 pnpm install / npm install
# 再按第 5 节重启 dsh web
```

不要再为 Agent 走 ngrok 传 tar（那是旧的 audio-agent 更新方式）。
