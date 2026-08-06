# 录音 App 后端智能体 Demo 核心逻辑

本文档记录当前 Demo 的后端实现思路。前端页面、录音交互和结果展示由其他同事负责，本文只定义后端处理链路、接口分层和智能体能力边界。

## 1. 项目目标

本 Demo 参考 PLAUD / 录音卡片类产品的核心体验，但当前阶段只实现后端智能处理能力。

整体目标：

```text
前端录音或上传音频
-> 后端接收音频
-> 豆包 / 火山引擎 ASR 转写
-> 保存录音、转写文本和元数据
-> DeepSeek API 总结和分析
-> 智能体根据用户指令生成报告、PPT 大纲、计划等内容
-> 返回结构化结果给前端
```

## 2. 职责边界

前端负责：

```text
- 录音交互
- 音频上传
- 页面展示转写文本、总结、历史记录和智能体输出
- 调用后端 API
```

后端负责：

```text
- 接收音频文件
- 调用豆包 / 火山引擎完成语音转文字
- 存储录音文件、转写文本、摘要和任务结果
- 调用 DeepSeek API 做文本总结、归纳和结构化分析
- 聚合历史录音内容
- 执行智能体任务，例如写报告、写 PPT 大纲、整理想法
```

当前不负责：

```text
- 录音硬件协议
- App 页面设计
- 完整账号体系
- 商业化订阅体系
```

## 3. 后端能力分层

### 3.1 ASR 转写层

输入音频，输出文字。

```text
音频文件
-> ffmpeg 转码
-> 豆包 / 火山引擎 ASR
-> transcript
```

这一层只关注语音识别，不做总结和复杂推理。

### 3.2 存储层

保存录音相关数据，方便后续查询、总结和智能体调用。

建议保存：

```text
- recordingId
- 音频文件路径或 URL
- transcript 转写文本
- title 标题
- summary 摘要
- keyPoints 重点
- todos 待办
- tags 标签
- createdAt 创建时间
- updatedAt 更新时间
```

Demo 阶段可以先使用本地 JSON 文件或轻量数据库，后续再替换为正式数据库。

### 3.3 LLM 分析层

调用 DeepSeek API，对单条或多条录音文本进行总结、提炼和结构化分析。

典型能力：

```text
- 生成标题
- 生成摘要
- 提取重点
- 提取待办事项
- 提取关键词 / 标签
- 整理会议纪要
- 按时间范围总结历史录音
```

### 3.4 Agent 智能体层

智能体层处理更复杂的用户指令，不只是总结，而是结合历史录音、实时想法和用户目标生成最终内容。

典型任务：

```text
- 记录实时想法
- 根据今天的所有录音写日报
- 根据某个主题整理报告
- 根据历史录音生成 PPT 大纲
- 生成邮件、计划、会议纪要
- 汇总最近一段时间的待办事项
```

## 4. 核心 API 设计

### 4.1 只做音频转文字

```http
POST /api/transcribe
```

用途：

```text
前端上传录音文件
-> 后端调用豆包 / 火山引擎 ASR
-> 返回转写文本
-> 可选保存 recording 记录
```

建议返回：

```json
{
  "recordingId": "rec_xxx",
  "transcript": "今天讨论了录音卡片的后端方案...",
  "duration": 123,
  "createdAt": "2026-06-29T10:00:00.000Z"
}
```

### 4.2 输入文本，返回智能结构化分析

```http
POST /api/analyze
```

用途：

```text
输入 transcript 或 recordingId
-> 调用 DeepSeek API
-> 返回标题、摘要、重点、待办、标签等结构化结果
```

建议请求：

```json
{
  "recordingId": "rec_xxx",
  "transcript": "今天讨论了录音卡片的后端方案..."
}
```

建议返回：

```json
{
  "title": "录音卡片后端方案讨论",
  "summary": "本次录音主要讨论了后端 ASR、总结和智能体任务链路。",
  "keyPoints": [
    "前端负责录音和展示",
    "后端负责转写、总结和智能体任务"
  ],
  "todos": [
    "实现 /api/transcribe",
    "实现 /api/analyze"
  ],
  "tags": ["录音", "ASR", "智能体"]
}
```

### 4.3 一次性完成音频转写和智能体分析

```http
POST /api/audio-agent
```

用途：

```text
上传音频
-> ASR 转写
-> DeepSeek 总结分析
-> 保存记录
-> 返回完整结果
```

适合前端的一键处理流程。

建议返回：

```json
{
  "recordingId": "rec_xxx",
  "transcript": "今天讨论了...",
  "analysis": {
    "title": "录音卡片后端方案讨论",
    "summary": "本次录音主要讨论了...",
    "keyPoints": [],
    "todos": [],
    "tags": []
  }
}
```

### 4.4 总结历史录音

```http
POST /api/recordings/summary
```

用途：

```text
读取历史录音文本
-> 根据时间范围、标签、关键词或用户指定 recordingIds 筛选
-> 调用 DeepSeek API
-> 生成阶段性总结
```

典型场景：

```text
- 总结今天所有录音
- 总结本周关于某项目的录音
- 提取最近所有待办事项
- 生成日报 / 周报
```

### 4.5 智能体任务接口

```http
POST /api/agent
```

用途：

```text
接收用户指令
-> 拉取相关历史录音和实时想法
-> 组织上下文
-> 判断任务类型
-> 调用 DeepSeek API 或本地 Agent
-> 输出报告、PPT 大纲、计划、邮件等内容
```

建议请求：

```json
{
  "instruction": "根据我今天的想法写一份产品方案报告",
  "recordingIds": ["rec_xxx", "rec_yyy"],
  "outputType": "report"
}
```

建议返回：

```json
{
  "taskId": "task_xxx",
  "outputType": "report",
  "title": "录音卡片智能体产品方案",
  "content": "..."
}
```

### 4.6 历史录音查询

```http
GET /api/recordings
GET /api/recordings/:id
```

用途：

```text
前端展示录音列表和录音详情
智能体按 recordingId 拉取上下文
```

## 5. 页面能力和后端接口对应关系

### 5.1 录音直接转文字

页面动作：

```text
用户录音
-> 前端上传音频
-> 页面展示转写文字
```

后端接口：

```text
POST /api/transcribe
```

### 5.2 将录音文件总结

页面动作：

```text
用户选择某条录音
-> 点击总结
-> 页面展示摘要、重点、待办
```

后端接口：

```text
POST /api/analyze
```

或者：

```text
POST /api/audio-agent
```

### 5.3 大模型总结历史录音

页面动作：

```text
用户选择今天 / 本周 / 某个主题
-> 点击总结
-> 页面展示综合总结
```

后端接口：

```text
POST /api/recordings/summary
```

### 5.4 智能体执行任务

页面动作：

```text
用户输入想法或指令
-> 选择相关录音
-> 请求生成报告 / PPT / 计划 / 邮件
```

后端接口：

```text
POST /api/agent
```

## 6. 推荐实现顺序

第一阶段先打通最小闭环：

```text
POST /api/transcribe
POST /api/analyze
POST /api/audio-agent
GET /api/recordings
GET /api/recordings/:id
```

第二阶段增加历史总结：

```text
POST /api/recordings/summary
```

第三阶段增加智能体任务：

```text
POST /api/agent
```

这样前端可以先接入基础录音转写和单条总结，后端再逐步扩展到历史记忆和智能体生成能力。

## 7. 一句话总结

当前 Demo 要做的是一个录音内容智能处理后端：

```text
前端负责录音和展示；
后端负责音频转写、文本存储、DeepSeek 总结、历史内容聚合和智能体任务执行。
```
