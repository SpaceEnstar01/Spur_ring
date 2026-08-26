# audio-agent 大模型调用对照（DeepSeek / 硅基流动）

> 目的：记录 **ASR 之后** 文本交给大模型的调用方式，方便以后换厂商或切回旧配置。  
> 服务代码：`app/cloud/audio-agent`  
> 密钥只写本机 / 服务器 `.env`，**不要**写进本文件或 `.env.example`。

---

## 1. 整条链路（不要和 ASR 搞混）

```text
手机 App
  → POST 云端 /api/audio-task
       ├─ recording_summary   会议纪要（Chat Completions）
       ├─ agent_command       短语音文字结果（Chat Completions）
       └─ agent_image         Agent Flow 生图（images/generations）

云端 audio-agent
  1) 火山引擎 Volcengine ASR   ← 语音转文字（本条链路不改）
  2) 按 taskType：
       文字任务 → Chat Completions
       agent_image → 硅基流动 Images API，落盘后经 /images/{id}.png 提供
```

- **手机不直连任何 LLM**，只打你们的 API（如 `https://api.hispurring.com`）。
- 换 DeepSeek ↔ 硅基流动：**只改云端 LLM 配置**（及必要时 `agent.ts` 请求体），**不要改火山 ASR**。

---

## 2. 代码落点

| 文件 | 作用 |
|------|------|
| `app/cloud/audio-agent/src/config.ts` | 读取 `DEEPSEEK_*` / `SILICONFLOW_IMAGE_*` 环境变量 |
| `app/cloud/audio-agent/src/agent.ts` | `fetch {baseUrl}/chat/completions` |
| `app/cloud/audio-agent/src/image.ts` | Agent Flow：`fetch {baseUrl}/images/generations` 并落盘 |
| `app/cloud/audio-agent/src/taskPrompts.ts` | 会议纪要 / 智能体 Prompt |
| `app/cloud/audio-agent/.env` | **本机/服务器私密配置**（gitignore） |
| `app/cloud/audio-agent/.env.example` | 无密钥模板，可进 git |

实现特点：

- **不用** OpenAI Python/JS SDK，用 **Bun 原生 `fetch`**。
- 协议是 **OpenAI 兼容** `POST /v1/chat/completions`（DeepSeek 官方 Base URL 一般不带 `/v1`，硅基流动 **必须带** `/v1`）。
- 环境变量名仍叫 `DEEPSEEK_*`，只是历史命名；值可以指向任意兼容服务。

环境变量：

```text
DEEPSEEK_API_KEY          # 必填才会走云端 LLM；为空则走本地 Claude CLI 回退
DEEPSEEK_BASE_URL         # 默认 https://api.deepseek.com
DEEPSEEK_MODEL            # 默认 deepseek-v4-flash
DEEPSEEK_TIMEOUT_MS       # 默认 180000
```

`agent.ts` 额外逻辑：仅当 `baseUrl` 的 host 以 **`deepseek.com` 结尾** 时，才附加 DeepSeek 专有字段：

```json
"thinking": { "type": "disabled" }
```

硅基流动等兼容网关可能拒收未知字段，故 **非 DeepSeek 官方域名不发送 `thinking`**。

---

## 3. 方案 A：DeepSeek 官方

| 项 | 值 |
|----|-----|
| 用途 | 原线上默认 LLM |
| Base URL | `https://api.deepseek.com`（**不要**加 `/v1`，代码会拼 `/chat/completions` → `https://api.deepseek.com/chat/completions`） |
| Model（曾用） | `deepseek-v4-flash`（以控制台当前可用名为准） |
| API Key | DeepSeek 控制台 `sk-...` |
| `thinking` | **发送** `thinking: { type: "disabled" }` |

`.env` 示例（注释块，切回时用）：

```env
DEEPSEEK_API_KEY=sk-你的DeepSeek密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

请求形态（示意）：

```http
POST https://api.deepseek.com/chat/completions
Authorization: Bearer <DEEPSEEK_API_KEY>
Content-Type: application/json

{
  "model": "deepseek-v4-flash",
  "messages": [
    { "role": "system", "content": "You are a reliable AI voice assistant. ..." },
    { "role": "user", "content": "<taskPrompts 拼好的转写任务>" }
  ],
  "thinking": { "type": "disabled" },
  "stream": false
}
```

---

## 4. 方案 B：硅基流动 SiliconFlow（当前试用）

| 项 | 值 |
|----|-----|
| 用途 | OpenAI 兼容中转，可选用 DeepSeek-V3 等广场模型 |
| Base URL | `https://api.siliconflow.cn/v1`（**必须带 `/v1`**） |
| Model（当前试用） | `deepseek-ai/DeepSeek-V3`（以硅基流动模型广场复制的名为准） |
| API Key | 硅基流动控制台 `sk-...` |
| `thinking` | **不发送**（`agent.ts` 按 host 自动省略） |
| 兼容性 | 官方说明完全兼容 OpenAI 接口；本工程继续用 `fetch`，不必上 `openai` SDK |

`.env` 示例：

```env
DEEPSEEK_API_KEY=sk-你的硅基流动密钥
DEEPSEEK_BASE_URL=https://api.siliconflow.cn/v1
DEEPSEEK_MODEL=deepseek-ai/DeepSeek-V3
```

请求形态（示意）：

```http
POST https://api.siliconflow.cn/v1/chat/completions
Authorization: Bearer <SILICONFLOW_API_KEY>
Content-Type: application/json

{
  "model": "deepseek-ai/DeepSeek-V3",
  "messages": [
    { "role": "system", "content": "You are a reliable AI voice assistant. ..." },
    { "role": "user", "content": "<taskPrompts 拼好的转写任务>" }
  ],
  "stream": false
}
```

Python 对照（仅供人工调试，**生产 audio-agent 未使用**）：

```python
from openai import OpenAI

client = OpenAI(
    api_key="你的_API_KEY",
    base_url="https://api.siliconflow.cn/v1",
)

response = client.chat.completions.create(
    model="deepseek-ai/DeepSeek-V3",
    messages=[{"role": "user", "content": "你好"}],
)
print(response.choices[0].message.content)
```

---

## 5. 两种方案对照

| | DeepSeek 官方 | 硅基流动 |
|--|---------------|----------|
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | `https://api.siliconflow.cn/v1` |
| 最终 URL | `{base}/chat/completions` | `{base}/chat/completions` |
| 模型名风格 | `deepseek-v4-flash` | `deepseek-ai/DeepSeek-V3`（带厂商前缀） |
| Key | DeepSeek sk | 硅基流动 sk（两套不能混用） |
| `thinking` | 要 | 不要 |
| ASR | 仍火山，不变 | 仍火山，不变 |
| App | 不改 | 不改 |

---

## 6. 如何切换（运维）

1. 编辑运行环境 `.env`（本机：`app/cloud/audio-agent/.env`；线上常见：`/opt/audio-agent/.env`）。
2. **注释掉**当前方案，**启用**另一方案的三行：`API_KEY` / `BASE_URL` / `MODEL`。
3. 重启 audio-agent（本机：`bun run src/server.ts`；线上按 `app/docs/cloud_aliyun/` 部署文档重启）。
4. 用 App 或 `POST /api/audio-task` 各测一单：`recording_summary`、`agent_command`；Agent Flow 生图测 `agent_image`。

本机 `localhost:18987` **不会**自动被手机使用；线上 App 仍打 `api.hispurring.com`。要让用户用上新模型，必须改 **服务器** `.env` 并重启。

---

## 7. 最小连通测试（不经过 ASR）

```bash
# 不要打印完整 Key
curl -s https://api.siliconflow.cn/v1/chat/completions \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-ai/DeepSeek-V3","messages":[{"role":"user","content":"ping"}],"max_tokens":32}'
```

期望 HTTP 200，且 `choices[0].message.content` 非空。

---

## 8. 以后若再加第三家

优先仍走 OpenAI 兼容：只改 `.env` 的 URL / 模型 / Key。  
若对方也拒收未知字段，继续依赖 `agent.ts` 的 host 判断，或改成显式 `LLM_PROVIDER=deepseek|siliconflow|openai`。

---

## 9. Agent Flow 生图（按意图，不是每条都出图）

Agent Flow 仍走 `taskType=agent_command`。火山 ASR 之后：

1. 关键词命中（如「生成图片」「画一张」「帮我画」「generate an image」）→ 生图  
2. 否则用对话模型做一次 YES/NO 语义判断；只有像豆包那样「用户在要一张图」才生图  
3. 其他短指令 → 原来的文字结果  

生图：转写当 prompt → 硅基流动 `POST {baseUrl}/images/generations` → 落到 `images/`，`GET /images/{id}.png`。详情页有图就显示图 + 转写。`recording_summary` 不变。

- 复用 `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL`（需指向硅基流动 `https://api.siliconflow.cn/v1`）。
- 模型默认 `Kwai-Kolors/Kolors`。
- 实现：`src/imageIntent.ts` + `src/image.ts`。手机不直连硅基流动。

```json
{
  "model": "Kwai-Kolors/Kolors",
  "prompt": "<火山转写>",
  "image_size": "1024x1024",
  "batch_size": 1,
  "num_inference_steps": 20
}
```

---

*记录依据：`config.ts` + `agent.ts` + `image.ts`（硅基流动试用 + DeepSeek `thinking` 条件发送），ASR 仍为火山引擎。*
