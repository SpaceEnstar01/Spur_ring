# V2 audio-agent

来源：主工程 `app/cloud/audio-agent`。本轮保留原 `/health`、`/api/chat` 协议，App 在客户端适配。不含原密钥和运行数据，未部署线上。运行需 Bun；可 `bun install` 或 `npm ci` 安装此目录的依赖，再 `bun run dev`。模型参数按 `.env.example` 独立配置。测试：`bun test tests`，仅调用本机模拟模型。

整体说明：[V2 README](../../README.md)。以下保留来源说明，旧相对路径应重新核对。

---

# Audio Agent

Audio Agent is a small local web app for recording audio and sending the
transcribed text into the parent Claude Code agent.

## Architecture

```text
browser recording
  -> Bun server upload
  -> STT provider
  -> parent agent CLI
  -> browser result
```

The app is intentionally isolated from the main CLI code. It calls the parent
agent through a subprocess first, so the existing Claude Code implementation can
stay unchanged.

## Run

```bash
cd /Users/spur/X/space/claudeV2/apps/audio-agent
bun run dev
```

Then open:

```text
http://localhost:8787
```

## Environment

```bash
export AUDIO_AGENT_PORT=8787
export AUDIO_AGENT_STT_PROVIDER=mock
export AUDIO_AGENT_PARENT_ROOT=/Users/spur/X/space/claudeV2
export AUDIO_AGENT_AGENT_COMMAND="bun run scripts/dev.ts -p"
```

`mock` STT is the default for the first development pass.
