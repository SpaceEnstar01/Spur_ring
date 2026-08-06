# Audio Agent 工程实现总结

本文档总结 `audio-agent` 从 0 到 1 的实现过程，包括架构设计、关键技术选择、核心链路、踩坑点和最终启动方式。

## 1. 项目目标

本项目目标是在现有 Claude Code/DeepSeek Agent 工程基础上，新增一个独立的音频入口应用：

```text
网页录音
-> 后端接收音频
-> 火山 ASR 转写
-> Agent 理解和处理任务
-> 生成报告网页
-> 邮件发送结果
```

最终实现效果：

```text
用户在网页点击录音
-> 说出任务
-> 停止提交
-> 页面显示转写文本和 Agent 输出
-> 邮箱收到任务结果和报告链接
```

## 2. 工程位置

为了不干扰主工程，新增子应用放在：

```text
/Users/spur/X/space/claudeV2/apps/audio-agent
```

相关文档放在：

```text
/Users/spur/X/space/claudeV2/apps/docs
```

这种结构把主工程作为 Agent 能力底座，`audio-agent` 作为一个独立应用，方便后续继续扩展其他 app。

## 3. 第一阶段：搭建 audio-agent 骨架

最开始创建了以下结构：

```text
apps/audio-agent/
  package.json
  src/
    server.ts
    config.ts
    agent.ts
    stt/
      index.ts
      mock.ts
      volcengine.ts
    web/
      index.html
      app.js
  uploads/
  transcripts/
  outputs/
```

第一版目标不是直接接真实语音，而是先打通完整 mock 流程：

```text
网页录音
-> 上传后端
-> mock STT 返回假转写
-> 调用主工程 Agent
-> 页面显示结果
```

这样可以先验证“网页、后端、Agent 调用”是否通畅。

## 4. 第二阶段：接入火山 ASR

最开始尝试使用火山 `Doubao 录音文件识别 2.0`：

```text
Resource ID: volc.seedasr.auc
```

通过官方文档和 Python demo 确认：

```text
submit endpoint:
https://openspeech-direct.zijieapi.com/api/v3/auc/bigmodel/submit

query endpoint:
https://openspeech-direct.zijieapi.com/api/v3/auc/bigmodel/query
```

调用方式是异步任务：

```text
submit 提交任务
-> query 轮询状态
-> 成功后读取 result.text
```

测试脚本：

```text
apps/audio-agent/scripts/test-volcengine-asr-url.ts
```

用于验证公网 mp3/wav URL 是否能成功转写。

## 5. 第三阶段：解决本地录音和公网 URL 问题

浏览器录音默认生成：

```text
audio/webm
```

而火山 ASR 2.0 需要公网可访问的音频 URL，且音频格式需要 mp3/wav/ogg/raw。

因此采用方案：

```text
浏览器录音 webm
-> 后端保存到 uploads/
-> ffmpeg 转成 mp3
-> 通过 /media/xxx.mp3 暴露
-> ngrok 提供公网 URL
-> 火山 ASR 拉取公网 mp3
```

关键依赖：

```bash
brew install ffmpeg
brew install ngrok
```

ngrok 用于将本地服务暴露为公网地址：

```bash
ngrok http 18987
```

audio-agent 启动时通过：

```text
AUDIO_AGENT_PUBLIC_BASE_URL
```

告诉后端公网地址。

## 6. 第四阶段：调用主工程 Agent

`audio-agent` 不重写 Agent，而是通过子进程调用主工程已有能力：

```text
bun run scripts/dev.ts -p "<prompt>"
```

封装位置：

```text
apps/audio-agent/src/agent.ts
```

这样主工程继续负责：

```text
理解任务
生成报告
写文件
总结内容
```

`audio-agent` 只负责音频输入和结果交付。

## 7. 第五阶段：优化 Agent Prompt

一开始 Agent 会反复询问：

```text
收件人是谁？
报告格式是什么？
发送方式是什么？
```

后来新增专用 Prompt：

```text
apps/audio-agent/src/agentPrompt.ts
```

预先告诉 Agent：

```text
默认收件人已配置
默认发件人已配置
后端会自动发送邮件
后端会自动生成报告网页
默认格式是 Markdown
默认详细程度是中等详细
```

这样用户说：

```text
帮我写一份 OpenAI 发展历史报告并发送邮件
```

Agent 就会直接生成最终内容，而不是反问发送方式。

## 8. 第六阶段：生成报告网页

为了让邮件不只是大段文本，新增报告页生成能力：

```text
apps/audio-agent/src/report.ts
```

每次任务完成后生成：

```text
apps/audio-agent/reports/{taskId}.html
```

并通过路由访问：

```text
/reports/{taskId}.html
```

邮件里会包含报告链接：

```text
https://xxxx.ngrok-free.app/reports/{taskId}.html
```

## 9. 第七阶段：接入邮箱发送

邮箱发送使用 163 SMTP：

```text
SMTP_HOST=smtp.163.com
SMTP_PORT=465
SMTP_USER=17302289985@163.com
SMTP_PASS=网易邮箱授权码
```

实现位置：

```text
apps/audio-agent/src/email.ts
```

测试脚本：

```text
apps/audio-agent/scripts/test-email.ts
```

任务完成后邮件内容包含：

```text
任务 ID
处理耗时
Agent exitCode
报告链接
转写文本
Agent 输出
```

## 10. 最终启动方式

每次启动需要两个终端。

### 终端 1：启动 ngrok

```bash
ngrok http 18987
```

复制输出的公网地址，例如：

```text
https://xxxx.ngrok-free.app
```

### 终端 2：启动 audio-agent

```bash
cd /Users/spur/X/space/claudeV2/apps/audio-agent

AUDIO_AGENT_PORT=18987 \
AUDIO_AGENT_STT_PROVIDER=volcengine \
AUDIO_AGENT_PUBLIC_BASE_URL="https://xxxx.ngrok-free.app" \
AUDIO_AGENT_EMAIL_ENABLED=1 \
AUDIO_AGENT_EMAIL_TO="poland053151@gmail.com" \
AUDIO_AGENT_EMAIL_FROM="17302289985@163.com" \
SMTP_HOST="smtp.163.com" \
SMTP_PORT=465 \
SMTP_USER="17302289985@163.com" \
SMTP_PASS="网易邮箱授权码" \
/Users/spur/.bun/bin/bun run dev
```

浏览器访问：

```text
http://localhost:18987
```

## 11. 最终链路

完整链路如下：

```text
用户网页录音
-> MediaRecorder 生成 webm
-> Bun 后端保存音频
-> ffmpeg 转 mp3
-> ngrok 提供公网音频 URL
-> 火山 ASR submit/query 转写
-> DeepSeek/Claude Code Agent 处理任务
-> 生成 HTML 报告页
-> SMTP 发送邮件
-> 页面显示转写文本、Agent 输出和报告链接
```

## 12. 当前成果

目前已经完成：

```text
网页录音
真实语音转写
Agent 任务处理
报告网页生成
邮件自动发送
固定收件人配置
Audio Agent 专用 Prompt
```

成功验证示例：

```text
用户语音：写一个关于追觅科技的发展记录，大概 800 字左右
-> ASR 转写成功
-> Agent 生成报告
-> 邮箱收到结果
```

## 13. 后续优化方向

后续可以继续优化：

```text
1. 将授权码移出代码，全部改为环境变量
2. 将 ngrok 替换为正式对象存储或固定公网服务
3. 增加任务历史列表
4. 支持多个收件人
5. 支持语音指定任务类型
6. 支持报告 Markdown/PDF 导出
7. 支持录音戒指真实设备上传音频
8. 支持移动端查看报告
```

## 14. 总结

这个工程的核心设计是：

```text
主工程负责 Agent 能力
audio-agent 负责音频输入和结果交付
火山 ASR 负责语音转文字
SMTP 邮箱负责异步通知
报告网页负责最终阅读体验
```

最终形成了一个最小可用的“录音戒指任务助手”原型。
