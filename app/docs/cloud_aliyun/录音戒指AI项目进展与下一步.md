# 录音戒指 AI 项目进展与下一步

## 总体目标

```text
戒指录音 → App 同步 OGG → 阿里云 → 火山转写 → DeepSeek 处理 → App 展示结果
```

## 已完成

- 厂商 SDK 初始化、扫描、连接和业务绑定成功；
- 查询并同步戒指录音成功，OPUS 转 OGG 成功；
- App 支持本地播放、单条删除、全部删除和脱离电脑运行；
- 香港 ECS、Bun、FFmpeg 和公网服务已经配置；
- `/api/audio-task` 音频上传接口已经打通；
- 火山录音文件识别 2.0 已返回真实转写；
- DeepSeek API 已接入并返回 AI 结果；
- 云端完整链路“音频上传 → ASR → DeepSeek”已验证成功。
- App 已能上传戒指真实 OGG，并展示火山转写和 DeepSeek 结果。

## App 接入云端 AI 的实现记录

### 1. 新增云端 API 封装

文件：

```text
app_front/app_yanqiang_voice/src/services/audioAgentApi.ts
```

功能：

- 固定 Demo 后端地址 `http://8.217.122.71:18987`；
- 将 App 私有目录中的 `file://...ogg` 封装为 `FormData`；
- 使用字段名 `audio` 上传到 `POST /api/audio-task`；
- 不手动设置 `Content-Type`，由 React Native 自动生成 multipart boundary；
- 解析 `id`、`transcript`、`agent.output` 和 `agent.exitCode`；
- 处理 HTTP 错误、非法 JSON、字段缺失和 5 分钟超时。

### 2. 新增单条录音 AI 面板

文件：

```text
app_front/app_yanqiang_voice/src/components/AudioAiPanel.tsx
```

每条本地 OGG 下新增：

```text
Process with AI
```

状态流程：

```text
Idle
→ Uploading and processing
→ Completed / Failed
```

成功后直接展示：

```text
Transcript
AI Result
```

每个 OGG 使用独立组件和状态，避免一条录音的处理结果污染其他录音。

### 3. 接入录音闭环调试页

修改文件：

```text
app_front/app_yanqiang_voice/src/screens/device/YanqiangRecordingDebugScreen.tsx
```

保留原有戒指查询、同步、播放、单条删除和全部删除逻辑，只在每条本地 OGG 下增加 `AudioAiPanel`。

操作路径：

```text
Device
→ Open Recording Sync Debug
→ Local OGG Files
→ Process with AI
```

### 4. 中英文文案

修改：

```text
src/locales/en.ts
src/locales/zh.ts
```

新增文案包括：

```text
Process with AI / 使用 AI 处理
Uploading and processing / 正在上传并处理
Transcript / 转写文本
AI Result / AI 结果
```

### 5. Android HTTP 配置

当前 Demo 后端使用 HTTP，因此在：

```text
android/app/src/main/AndroidManifest.xml
```

为 `<application>` 增加：

```xml
android:usesCleartextTraffic="true"
```

该配置只用于当前 Demo。正式上线应改用 HTTPS，并移除全局明文流量许可。

### 6. 构建和安装

类型检查：

```bash
cd /Users/spur/X/space/claudeV2/app_front/app_yanqiang_voice
npm run typecheck
```

Release 构建：

```bash
cd /Users/spur/X/space/claudeV2/app_front/app_yanqiang_voice/android
NODE_ENV=production ./gradlew :app:assembleRelease
```

安装到 USB 手机：

```bash
adb install -r app/build/outputs/apk/release/app-release.apk
```

本次结果：

```text
TypeScript 检查通过
BUILD SUCCESSFUL
ADB 安装 Success
App 正常启动
```

### 7. 真机验收结果

已在手机使用戒指真实 OGG 验证成功：

```text
戒指录音
→ App 同步 OGG
→ 点击 Process with AI
→ 上传阿里云
→ 火山 ASR 返回真实 Transcript
→ DeepSeek 返回 AI Result
→ App 页面正常展示
```

至此完成真正的端到端闭环：

```text
录音戒指 → Android App → 阿里云 → 火山 ASR → DeepSeek → Android App
```

## 当前状态

P0“App 单条 OGG 云端处理”已经完成并通过真机验收。

## 下一步目标

1. 大于 15 秒的录音自动进入 Recording 页面；
2. 小于等于 15 秒的录音自动进入 AI Agent 页面；
3. 将转写和 AI 结果持久化，退出页面后仍可查看；
4. 将当前同步接口升级为异步任务和状态查询；
5. 增加 HTTPS、App 鉴权、上传限制、失败重试和去重；
6. 使用 systemd 管理阿里云服务并设置开机自启。

## 下一步验收

```text
戒指录音同步后自动按时长分流，并在 Recording 或 AI Agent 正式页面持久展示结果
```
