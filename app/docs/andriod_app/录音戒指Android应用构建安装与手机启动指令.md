# Android App 最短构建安装指令

## 1. 进入工程并检查

```bash
cd /Users/spur/X/space/claudeV2/app_front/app_yanqiang_voice
./node_modules/.bin/tsc --noEmit --pretty false
```

## 2. 构建 Release APK

```bash
cd android
./gradlew --version
GRADLE_OPTS="-Dorg.gradle.daemon=false" NODE_ENV=production ./gradlew :app:assembleRelease --console=plain
```

APK 位置：

```text
android/app/build/outputs/apk/release/app-release.apk
```

## 3. 安装并启动

手机连接 USB，并开启 USB 调试：

```bash
adb devices
adb install -r app/build/outputs/apk/release/app-release.apk
adb shell am force-stop com.spur.recordingring
adb shell monkey -p com.spur.recordingring -c android.intent.category.LAUNCHER 1
```

看到 `Success` 表示覆盖安装完成，不需要 Metro，也不需要 Android Studio。
