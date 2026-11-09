# H5 前端对接：大模型智能体聊天接口

本文档只说明 H5 前端如何调用后端的大模型智能体接口。

## 1. 接口用途

该接口用于前端“大模型”页面。

前端把用户输入的问题或指令发给后端，后端调用大模型 / 智能体处理后，返回一段可直接展示的回答。

典型场景：

```text
用户输入：你好，请用一句话介绍一下你能做什么
后端返回：我是你的智能任务助手，可以帮你转写录音、总结内容、提取重点待办、生成报告等。
```

## 2. 接口地址

当前 Demo 地址：

```http
POST https://34d5-240e-390-aa3-5a90-d43e-2916-d6ae-a786.ngrok-free.app/api/chat
```

说明：

```text
https://34d5-240e-390-aa3-5a90-d43e-2916-d6ae-a786.ngrok-free.app
```

是后端当前通过 ngrok 暴露出来的临时公网地址。

如果后端重新启动 ngrok，这个地址可能会变化。前端只需要替换 API_BASE 即可。

建议前端代码中这样管理：

```js
const API_BASE = 'https://34d5-240e-390-aa3-5a90-d43e-2916-d6ae-a786.ngrok-free.app'
```

然后拼接：

```js
`${API_BASE}/api/chat`
```

## 3. 请求方式

```http
POST /api/chat
Content-Type: application/json
```

## 4. 请求参数

### 4.1 普通聊天

请求体：

```json
{
  "message": "你好，请用一句话介绍一下你能做什么"
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| message | string | 是 | 用户输入的问题、指令或聊天内容 |

## 5. 返回数据

返回示例：

```json
{
  "message": "你好！我是你的智能任务助手，可以帮你转写录音、总结内容、提取重点待办、生成报告等。",
  "recordingIds": [],
  "createdAt": "2026-06-30T11:52:30.543Z"
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| message | string | 大模型 / 智能体返回内容，前端直接展示 |
| recordingIds | string[] | 本次使用的录音记录 ID。普通聊天时通常为空数组 |
| createdAt | string | 后端生成结果的时间 |

前端主要展示：

```js
data.message
```

## 6. 前端调用示例

```js
const API_BASE = 'https://34d5-240e-390-aa3-5a90-d43e-2916-d6ae-a786.ngrok-free.app'

async function sendChatMessage(message) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || '大模型请求失败')
  }

  return data
}

const data = await sendChatMessage('你好，请用一句话介绍一下你能做什么')
console.log(data.message)
```

## 7. H5 页面交互建议

前端页面可以按普通聊天框实现：

```text
用户输入内容
-> 点击发送
-> 前端调用 POST /api/chat
-> 展示 data.message
```

建议页面状态：

```text
idle：等待用户输入
loading：请求中，按钮禁用，展示加载状态
success：展示大模型返回内容
error：展示错误提示
```

## 8. 终端测试命令

前端同事可以先在自己电脑终端执行：

```bash
curl --http1.1 -i -X POST "https://34d5-240e-390-aa3-5a90-d43e-2916-d6ae-a786.ngrok-free.app/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"你好，请用一句话介绍一下你能做什么"}'
```

如果返回：

```http
HTTP/1.1 200 OK
```

并且响应体里有：

```json
{
  "message": "..."
}
```

说明前端电脑已经可以访问后端服务。

## 9. 常见问题

### 9.1 请求地址不要写 localhost

前端同事电脑上不能写：

```http
http://localhost:18987/api/chat
```

因为这个 `localhost` 指的是前端同事自己的电脑，不是后端电脑。

跨电脑联调时必须使用后端提供的 ngrok 地址：

```http
https://xxxx.ngrok-free.app/api/chat
```

### 9.2 ngrok 地址可能会变化

如果后端重新启动 ngrok，公网地址会变化。

这时前端只需要替换：

```js
const API_BASE = '新的 ngrok 地址'
```

### 9.3 前端只展示 message 字段即可

普通聊天页面当前只需要展示：

```js
data.message
```

`recordingIds` 和 `createdAt` 可以先不展示。
