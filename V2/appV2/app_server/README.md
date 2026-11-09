# Spur Ring Java 对话服务

Agent V1 的架构、接口、能力边界和持久数据库上线步骤见 [Agent 实施说明](docs/agent-v1.md)。默认关闭，不影响原有聊天接口。

Java 17+、Spring Boot 3.5.7、Maven。通过服务端调用硅基流动，移动端不包含模型密钥。

## 运行

复制 `.env.example` 为本机 `.env`，填入 `SILICONFLOW_API_KEY`。也可直接设置同名环境变量。

```sh
mvn test package
java -jar target/my-app-server-0.1.0.jar
```

默认只监听 `127.0.0.1:8080`，默认模型 `Qwen/Qwen3-8B`，可通过 `SILICONFLOW_MODEL` 调整。

Android USB 联调执行 `adb reverse tcp:8080 tcp:8080`；iOS 模拟器直接访问本机。
真机 Wi-Fi 联调可设置 `SERVER_ADDRESS=0.0.0.0`，然后在 APP 设置中填写电脑局域网 IP。
内测版按产品要求不接入账号登录，所有安装 TestFlight 的用户均可使用。
已添加服务端限流与请求大小限制；这不是身份认证，也不能保证只允许 TestFlight 用户调用。
公网部署仍须配置 HTTPS，并在模型平台设置可用的费用/额度告警。不要在 APP 内置共享密钥当作认证。

## 无登录内测访问保护

三个付费接口（普通对话、流式对话、云端转写）共用进程内配额。所有 POST（含无效请求）均计入准入额度，
超限在调用模型之前返回 HTTP 429、中文 `message` 和 `Retry-After` 秒数，APP 现有错误处理可直接显示。
`GET /api/health` 不占配额。默认值可通过环境变量调整：

| 环境变量 | 默认值 | 含义 |
| --- | --- | --- |
| `SPUR_GUARD_REQUESTS_PER_MINUTE` | 60 | 整站每自然分钟准入次数 |
| `SPUR_GUARD_REQUESTS_PER_DAY` | 500 | 整站每日准入次数，UTC 零点（北京时间 08:00）重置 |
| `SPUR_GUARD_PER_CLIENT_PER_MINUTE` | 20 | 同一 TCP 来源地址每自然分钟准入次数 |
| `SPUR_GUARD_MAX_CONCURRENT` | 4 | 整站同时处理请求数，SSE 保持名额直至异步请求完成 |
| `SPUR_GUARD_MAX_JSON_BYTES` | 262144 | 非 multipart 请求体上限（256 KiB），也检查未知长度/chunked 请求 |
| `SPUR_GUARD_MAX_TRACKED_CLIENTS` | 2048 | 每分钟最多记录的来源数，防止限流表无界增长 |

每条消息最多 8000 字符、最多 20 条；笔记最多 16000 字符，消息与笔记合计最多 32000 字符。
模型输出仍限制为每次最多 2048 tokens；音频保持单文件 20 MB、整个 multipart 请求 21 MB 上限。
不记录密钥、请求正文或用户 IP。默认不信任 `X-Forwarded-For`、`Forwarded` 或设备自报 ID，避免伪造绕过。
在 ALB/Kubernetes 代理后，来源额度可能由多个用户共享；全站额度仍生效。核实代理链与网络隔离后再启用可信真实 IP，
不要直接开启任意转发头信任。HTTP 连接数/线程数亦有限制，但这不代替边缘抗 DDoS/WAF。

**限制：** 配额保存在单个 JVM 内存，重启会重置，多副本会各自计数，自然窗口边界允许短时双倍突发。
因此保护版部署必须维持 1 个副本，发布时将更新策略设为 `Recreate`，避免滚动期间双份额度（更新会短暂不可用）。
每日次数不是金额硬上限，不能彻底防盗用或阻止恶意请求耗尽额度。增加用户/副本前应接入 Redis 等共享配额或网关，
并视需要加入 App Attest/设备证明或用户身份。客户端断开不保证停止已经发出的上游请求。

## 容器构建与内部验证

`Dockerfile` 使用 Java 17 多阶段构建，构建时运行测试，运行时使用非 root 用户。
构建上下文仅允许 `pom.xml`、`src` 和 Docker 构建文件，排除本机 `.env`、Git、缓存及构建产物。
基础镜像复用 ACK 平台私有 ACR 中的 Alibaba Cloud Linux 3 镜像，通过 `dnf` 安装 Java 17，
并从 Maven Central 下载固定版本 Maven 3.9.11、校验 SHA-512（系统源 Maven 版本过旧），
避免构建时访问 Docker Hub。该镜像含现有平台的 Node 环境，但 Spur 运行进程仅为 Java；
后续可在 ACR 中建立专用 Java 基础镜像以进一步精简。构建需要 ACR 内网可达和拉取权限，
以及系统软件源、Maven 依赖仓库可达；普通电脑不能直接通过下方命令访问此 VPC 镜像。

```sh
docker build -t spur-api:local .
docker run --rm -p 127.0.0.1:8080:8080 --env-file .env spur-api:local
```

ACK 部署时通过 Kubernetes Secret 注入 `SILICONFLOW_API_KEY`，不要写入镜像、Git 或命令行参数。
容器内监听 `0.0.0.0:8080`；健康检查为 `/api/health`。当前应仅创建 ClusterIP 服务做内部验证，
访问保护完成前不创建公网 Ingress、NodePort 或 LoadBalancer 服务。

## 接口

- `GET /api/health`：健康检查。
- `POST /api/chat`：多轮文字对话。
- `POST /api/audio/transcriptions`：multipart 文件字段 `file`，返回 `{"text":"识别文字"}`。

语音默认模型 `FunAudioLLM/SenseVoiceSmall`，通过 `SILICONFLOW_TRANSCRIPTION_MODEL` 可配置。
支持 M4A、OGG、WAV、MP3，单文件最大 20 MB。上游限制时长不超过 1 小时，APP 手机录音另限 10 分钟。
上游超时 120 秒、最多同时处理 2 个转写请求；文件格式/识别失败返回安全错误，不暴露服务商响应或密钥。
音频仅转发至硅基流动，不在业务服务中持久化；Spring multipart 临时文件随请求清理。
取消 APP 请求不保证终止已经发出的上游请求。接口无用户认证；公网内测须启用上述限制及 HTTPS，并接受公开接口的剩余风险。
官方接口说明：https://docs.siliconflow.cn/docs/api/audio-transcriptions-post

```json
{
  "messages": [{"role": "user", "content": "帮我整理今天的待办"}],
  "context": "用户主动提供的本地笔记参考内容"
}
```

返回 `{"content":"模型回复"}`。最多 20 条消息，每条 8000 字符，笔记上下文最多 16000 字符。
`POST /api/chat/stream` 提供 SSE 流式回复（delta/error/done），APP 使用原生 XHR 增量接收，边生成边显示。保留 `/api/chat` 完整响应接口兼容旧版本。流式请求等待首字最多 55 秒，文字分段间隔最多 40 秒，总生成时间最多 150 秒；失败不自动重复请求，已生成文字保留供查看，手动重试会重新生成。API Key 仅由服务端读取，`.env` 被 Git 排除。代理部署需关闭 SSE 响应缓冲。
服务端每 5 秒发送 SSE 注释保活，避免 ALB 空闲超时；保活与数据帧串行写入，结束/异常时取消定时任务。
APP 不把注释保活计为 AI 文字进展，因此保活不会延长首字、分段或总时限。ALB 真实流式链路仍须上线验收，
不要用 Nginx 注解配置 ALB，也不要未经核实就修改共享 AlbConfig/监听超时影响其他应用。
