# audio-agent 部署到 api.hispurring.com（Workbench 实录指令）

> 适用：改了云端 `app/cloud/audio-agent`（接口 / Prompt / ASR·LLM / 需重启进程）时。  
> 只改手机 App → 用 Xcode Run，**不必**走本流程。  
> 记录日期：2026-08-21

---

## 何时需要更新

改了云端 `audio-agent` 源码或服务器 `.env` 后，用本流程把新代码同步到阿里云 `/opt/audio-agent` 并重启 `bun`。

---

## 1. Mac：打包（不要带 `.env`）

```bash
cd /Users/zexuansun/X/space/spur/app/cloud
tar --exclude='audio-agent/.env' \
    --exclude='audio-agent/uploads' \
    --exclude='audio-agent/transcripts' \
    --exclude='audio-agent/images' \
    --exclude='audio-agent/reports' \
    --exclude='audio-agent/data' \
    --exclude='audio-agent/node_modules' \
    -czf /tmp/audio-agent-cloud.tar.gz audio-agent
cd /tmp
python3 -m http.server 19000
```

另开一个 Mac 终端：

```bash
ngrok http 19000
```

记下 Forwarding 地址，例如：

```text
https://xxxx.ngrok-free.app
```

两个窗口在服务器 `curl` 成功前都不要关。

首次若遇 ngrok 配置报错：

```bash
ngrok config upgrade
ngrok config add-authtoken <你的authtoken>
```

---

## 2. 阿里云 Workbench：备份、下载、解压、重启

打开 Workbench 终端，把 `xxxx` 换成当前 ngrok 地址后执行：

```bash
cp /opt/audio-agent/.env /root/audio-agent.env.bak
# 若提示 overwrite，输入 y

curl -L -H "ngrok-skip-browser-warning: 1" \
  "https://xxxx.ngrok-free.app/audio-agent-cloud.tar.gz" \
  -o /root/audio-agent-cloud.tar.gz

tar -xzf /root/audio-agent-cloud.tar.gz -C /opt
cp /root/audio-agent.env.bak /opt/audio-agent/.env

cd /opt/audio-agent
# 按本次改动抽查新文件，例如流式 STT / 改写：
ls src/stt/saucBigmodel.ts src/resultRewrite.ts package.json
# 新增 ws 依赖，服务器必须安装
bun install

# 整段听写推荐 nostream（覆盖旧 endpoint）
sed -i '/^VOLCENGINE_SAUC_ENDPOINT=/d' .env
echo 'VOLCENGINE_SAUC_ENDPOINT=wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream' >> .env

pkill -f '^bun run src/server.ts$' || true
nohup bun run src/server.ts >/var/log/audio-agent.log 2>&1 &
sleep 1

curl -sS https://api.hispurring.com/health
grep -n "voice-intent\|rewrite-result\|sauc" src/server.ts src/config.ts | head
# 若 App 仍报错：
tail -n 50 /var/log/audio-agent.log
```

成功标志：

```text
{"ok":true,"service":"audio-agent",...}
src/server.ts 中能 grep 到 voice-intent / rewrite-result
```

然后可关闭 Mac 上的 `python3` 与 `ngrok`。

---

## 3. `.env` 提醒（不要贴密钥到聊天）

服务器 `/opt/audio-agent/.env` 需保持硅基流动（对话 + 生图共用 Key），例如：

```env
DEEPSEEK_API_KEY=硅基流动的sk
DEEPSEEK_BASE_URL=https://api.siliconflow.cn/v1
DEEPSEEK_MODEL=deepseek-ai/DeepSeek-V3
SILICONFLOW_IMAGE_MODEL=Kwai-Kolors/Kolors
AUDIO_AGENT_PUBLIC_BASE_URL=https://api.hispurring.com
```

改 Key / URL 后必须重启 `bun`（`getConfig()` 只在启动时读一次）。

---

## 4. 手机

云端验证通过后，本机 Xcode 打开 `app/mobile/ios/RecordingRing.xcworkspace`，选真机 → **Run**。
