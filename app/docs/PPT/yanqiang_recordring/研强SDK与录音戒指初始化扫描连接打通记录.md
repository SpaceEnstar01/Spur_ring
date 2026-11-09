# 研强 SDK 与录音戒指初始化、扫描、连接打通记录

## 1. 文档目的

本文记录 React Native Android App 接入研强（AIZO）录音戒指 SDK，并完成以下最小闭环的过程：

```text
原生模块加载 → SDK 初始化 → 扫描戒指 → 停止扫描 → 连接戒指
```

本文对应工程：

```text
/Users/spur/X/space/claudeV2/app_front/app_yanqiang_voice
```

旧工程参考来源：

```text
/Users/spur/X/lab/dreameApp_record/DreameRing
```

截至 2026-07-15，Android 真机已经验证：

- `YanqiangVoiceModule` 可被 React Native 加载；
- `ServiceSdkCommandV2.init()` 初始化成功；
- 可以扫描到 `AIZO RING`；
- 可以通过 MAC 地址成功连接录音戒指；
- JS 可以收到扫描和连接状态事件。

录音文件查询、同步、OPUS 转 OGG 和播放不属于本次已验证范围，将在后续阶段继续联调。

## 2. 整体结构

App 没有直接使用 `react-native-ble-plx` 与研强戒指通信，而是通过厂商 SDK：

```text
React Native UI
    ↓ Promise / NativeEventEmitter
YanqiangVoiceNative.ts
    ↓
YanqiangVoiceModule.java
    ↓
ServiceSdkCommandV2
    ↓
研强 AAR + Realtek JAR
    ↓
AIZO RING
```

关键文件：

```text
src/native/YanqiangVoiceNative.ts
src/screens/device/YanqiangVoiceDebugScreen.tsx
android/app/src/main/java/com/spur/recordingring/yanqiang/YanqiangVoiceModule.java
android/app/src/main/java/com/spur/recordingring/yanqiang/YanqiangVoicePackage.kt
android/app/src/main/java/com/spur/recordingring/MainApplication.kt
android/app/src/main/AndroidManifest.xml
android/app/build.gradle
```

## 3. 必须迁移的厂商依赖

### 3.1 研强 SDK AAR

将旧工程中的以下文件复制到新工程 `android/app/libs/`：

```text
AliAgent-release-4.1.3.aar
aizo_be_lib_release_v2.1.0.aar
aizo_sdk_release_v2.1.2.aar
aizo_serversdk_release_v2_2.2.6.aar
```

### 3.2 Realtek 传递依赖

还必须复制以下三个 JAR：

```text
rtk-core-1.6.9.jar
rtk-bbpro-core-1.6.1.jar
rtk-dfu-3.12.32.jar
```

这一步非常容易遗漏。AAR 通过本地 `flatDir/fileTree` 引入时，没有 Maven POM 帮助解析传递依赖，因此 Gradle 可以编译成功，但运行时仍可能缺类。

遗漏 `rtk-core-1.6.9.jar` 时，真机初始化错误为：

```text
Failed resolution of: Lcom/realsil/sdk/core/RtkConfigure$Builder;
Didn't find class "com.realsil.sdk.core.RtkConfigure$Builder"
```

`RtkConfigure$Builder` 实际位于：

```text
rtk-core-1.6.9.jar
```

补齐三个 Realtek JAR 并重新安装 APK 后，该错误消失。

## 4. Gradle 配置

`android/app/build.gradle` 使用本地依赖目录：

```gradle
repositories {
    flatDir {
        dirs 'libs'
    }
}

dependencies {
    implementation fileTree(dir: 'libs', include: ['*.jar', '*.aar'])

    implementation 'com.tencent:mmkv-static:1.3.14'
    implementation 'com.github.liangjingkanji:Serialize:1.3.1'
    implementation 'com.alibaba:fastjson:1.1.72.android'
    implementation 'com.blankj:utilcodex:1.30.6'
}
```

注意 MMKV 的正确坐标是：

```gradle
com.tencent:mmkv-static:1.3.14
```

不是：

```gradle
com.tencent.mmkv:mmkv
```

根工程仓库还需包含 JitPack，以解析 Serialize：

```gradle
maven { url 'https://www.jitpack.io' }
```

## 5. Android 权限

`AndroidManifest.xml` 至少需要：

```xml
<uses-permission android:name="android.permission.BLUETOOTH"/>
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN"/>
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.INTERNET"/>
```

仅写 Manifest 不够。Android 12 及以上扫描前必须动态申请：

```ts
PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
```

Android 11 及以下申请：

```ts
PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
```

## 6. 注册 React Native 原生模块

原生包返回轻量模块：

```kotlin
class YanqiangVoicePackage : ReactPackage {
  override fun createNativeModules(
    reactContext: ReactApplicationContext
  ): List<NativeModule> {
    return listOf(YanqiangVoiceModule(reactContext))
  }
}
```

在 `MainApplication.kt` 中注册：

```kotlin
override fun getPackages(): List<ReactPackage> {
    val packages = PackageList(this).packages
    packages.add(YanqiangVoicePackage())
    return packages
}
```

JS 侧用下面的结果判断原生安装是否成功：

```ts
NativeModules.YanqiangVoiceModule
```

真机成功日志：

```text
NativeModules.YanqiangVoiceModule=true
isAvailable=true
```

## 7. SDK 初始化关键点

研强 SDK 主入口：

```java
com.eiot.ringsdk.ServiceSdkCommandV2
```

### 7.1 MMKV 必须先初始化

`ServiceSdkCommandV2` 内部的 `LocalSave` 依赖 MMKV 和 Serialize。必须在厂商 SDK 初始化前执行：

```java
Application application =
    (Application) getReactApplicationContext().getApplicationContext();

MMKV.initialize(application);
```

否则可能在 `LocalSave` 静态初始化阶段抛出异常。

### 7.2 厂商初始化参数

已验证成功的初始化调用：

```java
ServiceSdkCommandV2.INSTANCE.init(
    application,
    1,
    BuildConfig.VERSION_NAME,
    "Dreame Ring",
    "com.aierdream.dreamering",
    "CN",
    "ZH",
    "",
    true
);
```

其中：

- `"Dreame Ring"` 沿用旧工程厂商标识，不应随意修改；
- `"com.aierdream.dreamering"` 是旧工程真实 `applicationId`，作为厂商 SDK 标识继续传入；
- `btuuid` 按旧工程及厂商沟通结果传空字符串；
- 新 App 自身包名仍是 `com.spur.recordingring`。

初始化成功日志：

```text
initSdk: calling...
initSdk: result=true
```

### 7.3 只保留一个初始化入口

不能让按钮初始化和扫描自动初始化分别使用不同参数。当前实现通过同步的 `initializeSdk()` 统一处理：

```text
检查 sdkInitialized
→ MMKV.initialize
→ ServiceSdkCommandV2.init
→ 注册 DeviceWorkingState 回调
→ sdkInitialized = true
```

`initSdk()` 和 `startScan()` 都复用该入口。

## 8. 扫描实现

原生扫描调用：

```java
ServiceSdkCommandV2.INSTANCE.searchBtDevice(
    null,
    null,
    new ArrayList<>(),
    true,
    new OnBluetoothSearchListener() {
        @Override
        public void start() {}

        @Override
        public void search(ExBluetoothDevice device) {}

        @Override
        public void end() {}
    }
);
```

原生层向 JS 发出统一事件：

```text
yanqiangVoiceScanEvent
```

事件示例：

```json
{"type":"start"}
{"type":"device","name":"AIZO RING","macAddress":"D0:9F:D9:DC:D6:BD"}
{"type":"end"}
```

JS 页面使用 MAC 地址作为 key 去重，避免厂商扫描重复返回同一设备。

真机成功日志：

```text
scan: started
startScan: accepted
scan: found AIZO RING D0:9F:D9:DC:D6:BD
```

## 9. 连接实现与关键时序

厂商连接调用本身很简单：

```java
ServiceSdkCommandV2.INSTANCE.addCallback(connectCallback);
ServiceSdkCommandV2.INSTANCE.connect(macAddress);
```

但必须注意扫描器是异步释放的。早期实现中，UI 点击连接后执行：

```text
stopScan
→ 立即 connect
→ 稍后才收到 scan end
```

真实日志顺序为：

```text
stopScan: requested
connect: requesting D0:9F:D9:DC:D6:BD
scan: ended
```

此时厂商 SDK 可能将扫描和连接冲突统一报告为绑定错误 `1001`。

最终实现的连接顺序：

```text
stopSearchBtDevice
→ removeCallback（避免重复注册）
→ addCallback
→ 等待 800ms 释放扫描资源
→ connect(macAddress)
```

核心代码：

```java
ServiceSdkCommandV2.INSTANCE.stopSearchBtDevice();
ServiceSdkCommandV2.INSTANCE.removeCallback(connectCallback);
ServiceSdkCommandV2.INSTANCE.addCallback(connectCallback);

new Handler(Looper.getMainLooper()).postDelayed(() -> {
    ServiceSdkCommandV2.INSTANCE.connect(macAddress);
}, 800L);
```

连接状态通过下面的 RN 事件发送给 JS：

```text
yanqiangVoiceConnectionChanged
```

成功事件示例：

```json
{
  "status": "connected",
  "macAddress": "D0:9F:D9:DC:D6:BD"
}
```

## 10. 绑定错误 1001 的处理

曾遇到：

```text
state=1001
手表绑定失败，原因：请求失败、拒绝绑定、手表已绑定其他设备、绑定超时、匹配错误
```

排查顺序：

1. 确认 SDK 初始化参数与旧工程一致；
2. 确认扫描已经真正结束后再连接；
3. 确认没有重复注册连接回调；
4. 关闭其他曾连接该戒指的手机蓝牙；
5. 使用旧 App 对戒指执行解绑；
6. 如旧 App 不可用，对戒指执行恢复出厂或清绑定；
7. 删除 Android 系统蓝牙设置中的旧配对记录；
8. 重启戒指后重新扫描连接。

SDK 的 `handleDevice(2, callback)` 可以在已经连接时请求解绑，但 SDK 没有提供一个已确认可用的“未连接状态强制清除戒指端绑定”接口。因此戒指已绑定其他主体时，通常需要旧 App 解绑或硬件复位。

## 11. 构建与真机验证

### 11.1 TypeScript 检查

```bash
cd /Users/spur/X/space/claudeV2/app_front/app_yanqiang_voice
npm run typecheck
```

### 11.2 Android 构建

```bash
cd /Users/spur/X/space/claudeV2/app_front/app_yanqiang_voice/android
./gradlew :app:clean :app:assembleDebug
```

APK 输出：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

### 11.3 必须重新安装 APK 的情况

以下改动不能只依赖 Metro 热更新：

- 修改 Java/Kotlin；
- 修改 Gradle 依赖；
- 增删 AAR/JAR；
- 修改 Manifest 权限；
- 修改 NativeModule 方法签名。

这些情况必须使用 Android Studio Run 或重新安装 APK。否则手机仍可能运行旧原生代码，即使 JS 页面已经更新。

### 11.4 阶段 3 验收日志

最小成功链路应包含：

```text
boot: platform=android module=YES
initSdk: success
scan: started
startScan: accepted
scan: found AIZO RING <MAC>
scan: ended
connect: requesting <MAC>
connection: {"macAddress":"<MAC>","status":"connected"}
```

## 12. 已验证结论与后续工作

### 已验证

- 厂商依赖完整进入 APK；
- MMKV、Serialize、Fastjson、UtilCode 可正常工作；
- Realtek SDK 类可在运行时加载；
- `ServiceSdkCommandV2` 初始化成功；
- Android 动态蓝牙权限有效；
- 可以发现 `AIZO RING`；
- 可以连接录音戒指并收到连接事件。

### 后续阶段

```text
阶段 4：queryVoiceRecordingSummary
阶段 5：getVoiceRecordFile → opusToOgg → 保存本地 OGG
阶段 6：录音列表和播放页
阶段 7：前台刷新、并发锁、去重、断线恢复与稳定性
```

后续仍应以研强 SDK 路径为主，避免与工程里原有的 `react-native-ble-plx` SmartRing 实验路径混用连接状态和录音协议。
