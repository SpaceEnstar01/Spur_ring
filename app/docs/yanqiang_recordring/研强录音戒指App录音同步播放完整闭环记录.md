# 研强录音戒指 App 录音同步播放完整闭环记录

## 1. 文档目的

本文记录 `app_yanqiang_voice` 在 Android 真机上完成研强录音戒指完整业务闭环的最终实现，覆盖：

```text
App 启动
  → 厂商 SDK 初始化
  → 扫描并连接戒指
  → 戒指录音
  → 查询录音摘要
  → 从戒指同步 OPUS 数据
  → 厂商 SDK 转换 OGG
  → 保存到 App 私有目录
  → App 列表展示并播放
```

对应工程：

```text
/Users/spur/X/space/claudeV2/app_front/app_yanqiang_voice
```

截至 2026-07-15，上述流程已在 Android 真机完整验证通过。

初始化、依赖迁移、扫描和连接的详细过程另见：

```text
apps/docs/yanqiang_recordring/研强SDK与录音戒指初始化扫描连接打通记录.md
```

## 2. 最终工程结构

闭环的数据链路如下：

```text
YanqiangRecordingDebugScreen.tsx
    ↓ Promise / NativeEventEmitter
YanqiangVoiceNative.ts
    ↓ React Native Bridge
YanqiangVoiceModule.java
    ↓
ServiceSdkCommandV2（研强厂商 SDK）
    ↓ BLE
录音戒指

戒指 OPUS 数据
    ↓ VoiceRecordCallback.onReceive
ServiceSdkCommandV2.opusToOgg
    ↓
App files/voice-recordings/*.ogg
    ↓
expo-av Audio.Sound
```

关键文件：

```text
src/screens/device/YanqiangVoiceDebugScreen.tsx
src/screens/device/YanqiangRecordingDebugScreen.tsx
src/native/YanqiangVoiceNative.ts
android/app/src/main/java/com/spur/recordingring/yanqiang/YanqiangVoiceModule.java
```

## 3. 完整操作步骤

### 3.1 安装新 APK

凡是修改 Java、Kotlin、Gradle、AAR 或 JAR，都必须重新执行 Android Studio Run 或安装重新构建的 APK。Metro 热更新只能更新 JS，无法替换原生模块。

构建命令：

```bash
cd /Users/spur/X/space/claudeV2/app_front/app_yanqiang_voice
npm run typecheck
cd android
./gradlew :app:assembleDebug
```

APK 输出位置：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

### 3.2 初始化、扫描与连接

App 的扫连调试页依次执行：

1. `initSdk()`；
2. `startScan()`；
3. 找到目标戒指后执行 `stopScan()`；
4. 等待扫描资源释放；
5. 使用扫描结果中的 MAC 地址执行 `connect(macAddress)`；
6. 等待连接事件返回 `status=connected`。

连接回调内不能只把 BLE 连接成功当作设备可用。还必须完成厂商侧绑定通知：

```java
ServiceSdkCommandV2.INSTANCE.notifyBoundDevice(
    "DREAME RING",
    currentMacAddress,
    callback
);
```

`notifyBoundDevice` 成功后再执行：

```java
ServiceSdkCommandV2.INSTANCE.requestConnectionPriority();
```

只有这一步成功后，原生层才向 JS 上报：

```json
{"status":"connected","vendorReady":true,"macAddress":"..."}
```

这一步对后续文件传输至关重要：BLE 显示连接并不等于厂商业务通道已经就绪。

### 3.3 在戒指上产生录音

通过戒指完成一次或多次录音并结束录音。工作状态事件的实际含义为：

| state | status | 含义 |
|---:|---|---|
| 1 | `idle` | 空闲，可以发起同步 |
| 2 | `recording` | 正在录音 |
| 3 | `paused` | 暂停 |
| 4 | `ready_to_sync` | 有录音数据待上传，可以立即发起同步 |
| 5 | `syncing` | 正在同步 |

实际状态切换日志示例：

```text
workingState: state=2 status=recording
workingState: state=4 status=ready_to_sync
```

同步可以在 `state=1` 或 `state=4` 发起。`state=4` 不是“录音收尾中”，而是厂商定义的“有录音数据待上传”；若等待它自行回到 `state=1`，可能造成同步死锁。

### 3.4 查询戒指录音摘要

JS 调用：

```ts
YanqiangVoiceNative.queryVoiceRecordingSummary()
```

原生层调用：

```java
ServiceSdkCommandV2.INSTANCE.getDeviceStorageState(
    1,
    callback
);
```

这里 `function=1` 表示录音文件。成功结果会返回：

- `fileCount`：戒指内录音数量；
- `totalBytes`：戒指录音总字节数；
- `files`：当前 App 私有目录中已经保存的 OGG 文件。

验收日志示例：

```text
summary: code=1 supported=true count=4 bytes=47664 local=0
```

这表明戒指中存在 4 个录音，总计 47664 字节，但尚未同步到 App。

### 3.5 发起录音同步

JS 调用：

```ts
YanqiangVoiceNative.syncVoiceRecordings()
```

原生层正确调用如下：

```java
ServiceSdkCommandV2.INSTANCE.getVoiceRecordFile(
    false,
    voiceRecordCallback
);
```

这是整个录音闭环中最关键的坑。经厂商 SDK 字节码确认，该布尔参数是 `resumeOnly` 语义：

| 参数 | 实际行为 |
|---|---|
| `true` | 仅尝试恢复匹配的缓存或未完成任务；没有缓存时直接返回 `code=2 Failed` |
| `false` | 正常同步；有未完成任务则续传，否则查询并创建新的文件传输 |

因此，首次同步或普通的“同步全部录音”必须传 `false`。

错误调用：

```java
getVoiceRecordFile(true, callback);
```

对应的稳定失败日志：

```text
sync: start code=2 message=Failed
sync: FAILED Vendor failed to start voice file transfer: code=2 message=Failed
```

修正为 `false` 后，正常起始日志为：

```text
sync: request
sync: start code=1 message=Success
```

### 3.6 接收进度、转换并保存 OGG

`VoiceRecordCallback` 的处理顺序：

```text
onStart
  → onProgress（多次）
  → onReceive（每个 OPUS 文件）
  → onFinish
```

`onProgress` 向 JS 上报：

- 当前文件名；
- 当前文件序号和总文件数；
- 当前文件进度；
- 文件时间。

`onReceive(OpusFileBean)` 收到厂商文件对象后调用：

```java
ServiceSdkCommandV2.INSTANCE.opusToOgg(
    opusFile,
    oggFileCallback
);
```

转换成功后将字节写入：

```text
<App 私有 files 目录>/voice-recordings/<文件名>.ogg
```

JS 使用的 URI 格式为：

```text
file:///data/user/0/com.spur.recordingring/files/voice-recordings/xxx.ogg
```

文件保存后发送 `yanqiangVoiceFileReady` 事件，页面立即把它加入本地文件列表。

### 3.7 本地播放

调试页使用 `expo-av`：

```ts
Audio.Sound.createAsync(
  { uri: file.uri },
  { shouldPlay: true },
  playbackStatusCallback
)
```

页面支持：

- 展示本地 OGG 文件名、大小和时间；
- 播放和暂停；
- 展示当前播放位置和总时长；
- 切换文件时卸载上一个 `Audio.Sound`；
- 页面退出时释放播放器。

当录音可以从戒指同步、保存为 OGG 并在 App 内正常播放，即完成录音业务闭环。

## 4. JS 与原生接口

### 4.1 Promise 方法

```ts
initSdk(): Promise<boolean>
startScan(): Promise<boolean>
stopScan(): void
connect(macAddress: string): Promise<boolean>
disconnect(): Promise<boolean>
queryVoiceRecordingSummary(): Promise<RecordingSummary>
syncVoiceRecordings(): Promise<{ files: NativeFile[] }>
getVoiceRecordParam(): Promise<VoiceRecordParamResult>
setVoiceRecordParam(...): Promise<VoiceRecordParamResult>
```

### 4.2 事件

| 事件名 | 用途 |
|---|---|
| `yanqiangVoiceScanEvent` | 扫描开始、发现设备、扫描结束 |
| `yanqiangVoiceConnectionChanged` | 连接、断开和连接错误 |
| `yanqiangVoiceStatusUpdate` | 戒指工作状态 |
| `yanqiangVoiceSyncState` | 文件同步开始和结束 |
| `yanqiangVoiceSyncProgress` | 文件传输进度 |
| `yanqiangVoiceFileReady` | 单个 OGG 已转换并保存 |
| `yanqiangVoiceError` | 转换或文件保存错误 |

## 5. 已加入的稳定性保护

### 5.1 空闲态门禁

原生层仅允许 `state=1`（空闲）和 `state=4`（数据待上传）同步，其他已知工作状态会被拒绝：

```text
Ring cannot sync ... Wait for state=1 or state=4.
```

页面也会在非空闲态禁用同步按钮。

### 5.2 单任务锁

同一时间只允许一个 `syncVoiceRecordings()`。这避免重复点击启动多条厂商传输链。

### 5.3 失效锁恢复

如果旧同步超过 15 秒没有任何回调活动，新请求可以恢复失效的同步锁，避免页面长期提示：

```text
Voice recording sync is already running
```

### 5.4 同步代次隔离

每次同步使用独立 generation。旧任务迟到的回调不会污染或完成新任务。

### 5.5 超时

完整同步最长等待 180 秒。超时会释放锁并向 JS 返回明确错误，防止页面永久停留在“启动中”。

### 5.6 等待全部转换完成

厂商 `onFinish` 只代表文件传输回调结束，不保证异步 `opusToOgg` 已全部完成。实现中同时检查：

```text
finishSeen == true
pendingConversions == 0
```

两个条件都满足后才 resolve Promise 并返回完整本地文件列表。

## 6. 最终验收标准

一次完整验收应满足：

1. 原生模块存在，`initSdk: result=true`；
2. 能扫描到目标戒指；
3. 连接事件返回 `status=connected` 且 `vendorReady=true`；
4. 戒指能够从录音状态进入 `state=4 ready_to_sync`；
5. summary 返回 `code=1` 且戒指文件数大于 0；
6. 同步启动返回 `code=1 message=Success`；
7. 页面持续收到同步进度；
8. 每个文件转换并保存为 OGG；
9. Promise 最终完成，本地 OGG 数量正确；
10. 点击本地文件可以播放出戒指录音。

典型成功日志链：

```text
initSdk: result=true
scan: found AIZO RING <MAC>
connection: {"status":"connected","vendorReady":true,...}
workingState: state=4 status=ready_to_sync
summary: code=1 supported=true count=4 bytes=47664 local=0
sync: request
sync: start code=1 message=Success
sync: progress file=... index=1/4 progress=...
save: success name=....ogg bytes=... uri=file:///...
sync: finish code=1 message=Success
sync: resolved local=4
player: playing ....ogg
```

## 7. 故障定位速查

| 现象 | 优先检查 |
|---|---|
| `NativeModules...=false` | 原生 Package 是否注册，APK 是否重新安装 |
| 初始化缺 `RtkConfigure$Builder` | `rtk-core`、`rtk-bbpro-core`、`rtk-dfu` JAR 是否齐全 |
| 初始化在 `LocalSave` 失败 | MMKV/Serialize 依赖和 `MMKV.initialize` 顺序 |
| 扫描成功但绑定失败 | 戒指是否已绑定其他手机、扫描是否先停止、蓝牙权限 |
| BLE 已连但业务命令失败 | `notifyBoundDevice` 是否成功，是否请求连接优先级 |
| summary 有文件但同步 `code=2` | `getVoiceRecordFile` 是否错误传入 `true` |
| 页面一直“启动中” | 是否处理 `onStart code != 1`、超时和锁释放 |
| 提示同步已经运行 | 是否重复点击；旧任务是否长期无回调并触发失效锁恢复 |
| 同步在录音后立即失败 | 确认已进入 `state=4 ready_to_sync`；不要等待其自行回到 `state=1` |
| 已 finish 但文件不全 | 是否等待所有 `opusToOgg` 回调完成后才 resolve |
| OGG 已保存但不能播放 | URI 是否带 `file://`，文件是否非空，播放器是否正确卸载/切换 |

## 8. 最终结论

`app_yanqiang_voice` 已完成研强 SDK 与录音戒指的 Android 端完整小闭环：

```text
初始化成功
  → 扫描连接成功
  → 厂商业务绑定成功
  → 读取戒指录音摘要
  → 正常启动文件传输
  → 接收 OPUS
  → 转换并保存 OGG
  → App 内列表展示和播放成功
```

决定闭环成功的三个关键点是：

1. 连接成功后必须完成 `notifyBoundDevice`，不能只依赖 BLE connected；
2. 同步应在戒指 `state=1 idle` 或 `state=4 ready_to_sync` 时发起；
3. 普通同步必须使用 `getVoiceRecordFile(false, callback)`，`true` 仅用于恢复已有缓存任务。
