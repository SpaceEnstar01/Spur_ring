# Audio Agent Web Recording Startup Guide

本文档说明如何在 Mac 本地启动 `audio-agent`，实现：

```text
网页录音 -> 后端转码 -> 火山 ASR 真实转写 -> Claude Code/DeepSeek agent 处理 -> 网页展示结果
```

## 1. 前置条件

需要安装：

```bash
bun
ffmpeg
ngrok
```

检查 Bun：

```bash
/Users/spur/.bun/bin/bun --version
```

安装 ffmpeg：

```bash
brew install ffmpeg
ffmpeg -version
```

安装 ngrok：

```bash
brew install ngrok
ngrok version
```

首次使用 ngrok 需要配置 authtoken：

```bash
ngrok config add-authtoken 你的_ngrok_token
```

## 2. 启动 ngrok 公网隧道

火山 ASR 2.0 需要公网音频 URL，所以要把本地服务暴露出去。

新开一个终端执行：

```bash
ngrok http 18987
```

成功后会看到类似：

```text
Forwarding  https://xxxx.ngrok-free.app -> http://localhost:18987
```

复制这个公网地址，例如：

```text
https://xxxx.ngrok-free.app
```

保持这个终端不要关闭。

## 3. 启动 audio-agent

新开另一个终端：

```bash
cd /Users/spur/X/space/claudeV2/apps/audio-agent
```

启动服务：

```bash
AUDIO_AGENT_PORT=18987 \
AUDIO_AGENT_STT_PROVIDER=volcengine \
AUDIO_AGENT_PUBLIC_BASE_URL="https://xxxx.ngrok-free.app" \
VOLCENGINE_ASR_APP_ID="你的_APP_ID" \
VOLCENGINE_ASR_ACCESS_TOKEN="你的_ACCESS_TOKEN" \
/Users/spur/.bun/bin/bun run dev
```

如果代码里已经临时写入了 `APP ID` 和 `Access Token`，可以省略最后两行：

```bash
AUDIO_AGENT_PORT=18987 \
AUDIO_AGENT_STT_PROVIDER=volcengine \
AUDIO_AGENT_PUBLIC_BASE_URL="https://xxxx.ngrok-free.app" \
/Users/spur/.bun/bin/bun run dev
```

启动成功后会看到：

```text
Audio Agent listening on http://localhost:18987
```

## 4. 打开网页测试

浏览器打开：

```text
http://localhost:18987
```

操作流程：

1. 点击“开始录音”
2. 说一段话
3. 点击“停止并提交”
4. 等待后端处理
5. 页面会显示转写文本和 Agent 输出

成功示例：

```text
转写文本：
测试中测试中，1234567，测试测试。

Agent 输出：
这看起来是一个测试音频...
```

## 5. 常见问题

### 端口被占用

如果启动时报：

```text
EADDRINUSE
```

说明端口 `18987` 已被占用。

查看占用进程：

```bash
lsof -i :18987
```

杀掉进程：

```bash
kill -9 PID
```

或者一行执行：

```bash
kill -9 $(lsof -ti :18987)
```

### ngrok 没有登录

如果看到：

```text
Usage of ngrok requires a verified account and authtoken
```

需要先配置：

```bash
ngrok config add-authtoken 你的_ngrok_token
```

### 火山 ASR 提示需要公网 URL

如果页面报：

```text
Volcengine ASR 2.0 requires a public audio URL
```

说明启动 audio-agent 时没有设置：

```bash
AUDIO_AGENT_PUBLIC_BASE_URL
```

必须使用 ngrok 生成的公网地址重新启动服务。

## 6. 当前链路说明

当前实现使用的是火山：

```text
Doubao 录音文件识别 2.0
Resource ID: volc.seedasr.auc
```

处理链路：

```text
浏览器录音 webm
-> 后端保存到 uploads/
-> ffmpeg 转成 mp3
-> 通过 /media/xxx.mp3 暴露给公网
-> 火山 ASR submit/query
-> 返回真实转写文本
-> 交给 Claude Code/DeepSeek agent
-> 页面展示结果
```
