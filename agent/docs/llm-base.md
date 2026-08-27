# Spur LLM 基座（与 iOS / audio-agent 同一套）

手机不直连模型；云端 `agent` 与现网 `audio-agent` 共用同一组环境变量。换厂商只改 `.env`，不改 DeepSeek-Harness 源码。

## 环境变量（历史名 `DEEPSEEK_*`，值可指向任意 OpenAI 兼容服务）

| 变量 | 含义 | 与 iOS 现网一致的示例 |
|------|------|------------------------|
| `DEEPSEEK_API_KEY` | 密钥，勿提交 git | 硅基流动 `sk-…` |
| `DEEPSEEK_BASE_URL` | Chat Completions 根路径 | `https://api.siliconflow.cn/v1`（必须带 `/v1`） |
| `DEEPSEEK_MODEL` | 模型 id | `deepseek-ai/DeepSeek-V3` |

切回 DeepSeek 官方：`BASE_URL=https://api.deepseek.com`（不要 `/v1`），`MODEL=deepseek-v4-flash`。

对照长文：`app/docs/model/audio-agent-LLM调用对照.md`。

## 本机怎么喂给 Harness

必须用 **Node 22**（`nvm use 22`）。系统默认 Node 20 会报 `node:sqlite` / pnpm 版本不够。

密钥放在 `runtime/spur-profile/.env`（已 gitignore）。推荐：

```bash
~/X/space/spur/agent/runtime/spur-profile/run-web.sh
```

GitHub 拉包若超时，先 `export https_proxy=http://127.0.0.1:7897`（见 `github-proxy.md`）。

Web 默认走 **`llm-pi-ai` 的 `siliconflow` 路由**（OpenAI Chat Completions），不要用 `deepseek-official`。官方适配器会带上 `thinking` 字段，硅基流动会返回 HTTP 400 `INVALID_REQUEST`（和 audio-agent 不给非 deepseek.com 发 `thinking` 是同一原因）。

## 换基座清单

1. 改 `.env` 三元组（key / url / model）。
2. 同步 `cordis.patch.yml` 里 `baseURL`、`models[].id`、`agent-default-model`。
3. 改完后重启 `run-web.sh`。
4. 非 OpenAI 兼容协议再加 `llm-pi-ai` 的其它 `providers` 项，密钥仍只放 `.env`。
