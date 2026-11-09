# Android Studio 运行 RN App 使用方法

## 1. 打开项目

Android Studio 里选择打开这个目录：

```text
/Users/spur/X/space/claudeV2/app_front/app_RN/android
```

注意：打开 `android` 目录，不是打开 `app_RN` 根目录。

## 2. 等待 Gradle Sync

打开后先等 Android Studio 自动 Sync 完成。

如果右下角提示安装 SDK、NDK、Build Tools，点击 `Install / Accept / Sync`。

当前项目需要的 NDK 版本：

```text
26.1.10909125
```

## 3. 选择运行设备

连接 OPPO/Android 手机，打开手机 USB 调试。

Android Studio 顶部设备栏选择你的手机设备。

## 4. 点击 Run

点击绿色三角形 `Run`。

Android Studio 会把 App 安装到手机上。

## 5. 启动 Metro

如果手机 App 打开后提示输入 URL，需要在终端启动 Metro：

```bash
cd /Users/spur/X/space/claudeV2/app_front/app_RN
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
npx expo start --dev-client --clear --localhost --port 8081
```

另开一个终端执行：

```bash
adb reverse tcp:8081 tcp:8081
```

手机 App 手动输入：

```text
http://127.0.0.1:8081
```

## 6. 常见问题

### 找不到 node

如果 Android Studio 报：

```text
A problem occurred starting process 'command 'node''
```

说明 Android Studio 没拿到终端里的 Node 环境，需要检查 Gradle 脚本里的 Node 路径，当前使用：

```text
/opt/homebrew/bin/node
```

### App 红屏 main has not been registered

通常是 Metro 启错目录、端口不一致、缓存没清理。

重新执行：

```bash
cd /Users/spur/X/space/claudeV2/app_front/app_RN
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
npx expo start --dev-client --clear --localhost --port 8081
adb reverse tcp:8081 tcp:8081
```

然后手机输入：

```text
http://127.0.0.1:8081
```
