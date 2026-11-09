# 研强录音戒指 App 本地调试指令

## 1. 启动 Metro

原生代码已经完成编译且 Debug App 已安装到手机。本次只调试 JS 时，在终端执行：

```bash
cd /Users/spur/X/space/claudeV2/app_front/app_yanqiang_voice
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
npx expo start --dev-client --clear --localhost --port 8081
```

保持该终端运行。

## 2. 建立 Android 端口映射

手机通过 USB 连接电脑，另开一个终端执行：

```bash
adb devices
adb reverse tcp:8081 tcp:8081
```

## 3. 打开 App

在手机上打开已经安装的 Debug App：

```text
app_yanqiang_voice
```

App 将通过 USB 连接本机 Metro。

## 4. 原生代码变更时重新构建

如果修改了 Java、Kotlin、Gradle、Manifest、AAR 或 JAR，仅重启 Metro 不会生效，需要重新构建安装：

```bash
cd /Users/spur/X/space/claudeV2/app_front/app_yanqiang_voice/android
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
./gradlew :app:installDebug
```

安装完成后重新执行：

```bash
adb reverse tcp:8081 tcp:8081
```

## 5. 常用故障处理

Metro 连接异常时：

```bash
adb reverse --remove tcp:8081
adb reverse tcp:8081 tcp:8081
```

查看原生日志：

```bash
adb logcat | grep -E "YanqiangVoiceModule|ReactNativeJS"
```

查看当前端口映射：

```bash
adb reverse --list
```
