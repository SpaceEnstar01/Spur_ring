# Android 真机调试最短指令

## 1. 启动 Metro

```bash
cd /Users/spur/X/space/claudeV2/app_front/app_RN
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
npx expo start --dev-client --clear --localhost --port 8081
```

## 2. OPPO/Android 真机 USB 转发

新开一个终端：

```bash
adb reverse tcp:8081 tcp:8081
```

## 3. 手机 App 手动输入 URL

```text
http://127.0.0.1:8081
```

## 4. Android Studio

打开：

```text
/Users/spur/X/space/claudeV2/app_front/app_RN/android
```

点击绿色 Run 三角形即可。
