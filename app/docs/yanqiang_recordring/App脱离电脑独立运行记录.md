# App 脱离电脑独立运行记录

## 原理

Debug App 依赖电脑 Metro；Release APK 会把 JS Bundle 和资源直接打进安装包，因此不需要电脑、Metro 或 `adb reverse`。

## 构建

```bash
cd /Users/spur/X/space/claudeV2/app_front/app_yanqiang_voice/android
NODE_ENV=production ./gradlew :app:assembleRelease
```

生成文件：

```text
android/app/build/outputs/apk/release/app-release.apk
```

## 安装

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

`-r` 表示覆盖安装，并尽量保留原有 App 数据。

## 验证

关闭 Metro并拔掉数据线，直接打开手机 App，测试：连接戒指 → 同步录音 → 播放 OGG。

## 注意

当前 Release 使用工程内的 Debug 签名，仅用于内部独立测试；修改代码后需要重新构建并安装 APK。
