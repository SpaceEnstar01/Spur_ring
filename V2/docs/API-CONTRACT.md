# 首轮接口约定

## 服务端

以 `V2/cloud/audio-agent` 为云端源码。现有线上服务未发布此副本。本地启动默认端口 8787；App 默认连接现有 HTTPS 云端。

| 路由 | 请求 | 响应 | 本轮用途 |
| --- | --- | --- | --- |
| GET /health | 无 | `{ok:true,service:"audio-agent",timestamp}` | 检查服务类型；不代表模型可用 |
| POST /api/chat | `{message:string,recordingIds:[]}` | `{message:string,recordingIds:[],createdAt}` | 文字 AI 回复 |
| POST /api/audio-task | 既有音频协议 | 既有处理结果 | 原能力保留，本轮 App 不调用 |
| POST /api/office | `{prompt,kind}` | 文件地址等 | 独立办公网关；首轮未接 UI |

## App 适配

`src/services/chatApi.ts` 保留原 UI 的 `chat(messages, notes, signal, onPartial)` 调用接口，将最近 20 条角色消息及最多 16000 字的已选上下文放入 JSON 参考块，再发送到原云端的 message 字段。对话 JSON 超过 32000 字符时要求分段，不静默截断最新指令。原云端没有对话会话协议，按请求携带上下文，不承诺跨会话记忆。

回调只在完整成功响应后触发一次。180 秒超时、取消、非 JSON、HTTP 错误和空回答均进入失败；不自动重试模型请求。原云端并无本轮取消计算接口，因此取消仅停止客户端等待，不承诺撤回服务器已收到的请求或费用。

`/api/chat/stream`、`/api/health` 和 `/api/agent/*` 均不作为原音频后端接口使用。Java Agent 模块保留，但由 `src/config/backend.ts` 禁用，旧启用设置不会启动云端循环或阻断普通文字回复。

## 未完成部分

意图分类与事项持久化、通用授权、执行回执、办公文件入口、Harness 调度接口后续分别设计。复制源码不意味着服务已启动，也不意味着上述能力已接入或上线。

## Personal Agent（V2 App 录音转写的独立目标服务）

- V2 App 保留上面的原音频后端地址和现有自动回复链路；Personal Agent 使用单独地址，不把 `api.hispurring.com` 整体改指向 ECS。
- V2 App 本机语音识别完成后，由用户在对应录音卡片明确点击提交；只发送这条转写文字，不上传音频。
- ECS 服务源码为 `V2/web/server.mjs`，执行层为 `V2/agent/runtime/deepseek-harness`。提交使用 `POST /api/creator-agent/chat`，请求包含 `{ requestId, message, history: [] }`；进度通过 `GET /api/creator-agent/tasks/{requestId}` 查询；最终答复、来源和成果链接由提交响应返回。
- 外部调用须附 `Authorization: Bearer <token>`。ECS 通过未入 Git 的 `SPUR_CREATOR_AGENT_TOKEN` 验证；V2 App 按服务地址将令牌保存到 iOS Keychain / Android Keystore。成果链接使用有时效的 HMAC 签名。
- 当前 ECS 部署仍只映射 `127.0.0.1:4173`。公网 HTTPS 反代、配置 ECS 令牌、手机真机联调必须单独完成；不能因本地镜像构建成功而视为已上线。
