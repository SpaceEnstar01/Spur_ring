# iOS 前端真机编译安装最短步骤

## 已完成

```text
React Native 前端
→ 生成 iOS 工程
→ 安装 CocoaPods
→ Xcode 个人签名
→ iPhone 开发者模式
→ 真机编译安装
→ Metro 加载页面成功
```

## 1. 安装依赖

```bash
cd /Users/spur/X/space/spur/app/mobile
npm install
```

## 2. 生成 iOS 工程

```bash
npx expo prebuild --platform ios
```

## 3. 安装 Pods

```bash
cd ios
pod install
```

## 4. 打开 Xcode 工程

必须打开 `.xcworkspace`：

```bash
open /Users/spur/X/space/spur/app/mobile/ios/RecordingRing.xcworkspace
```

## 5. 配置真机

```text
1. iPhone 用数据线连接 Mac。
2. Xcode → Window → Devices and Simulators，确认设备 Ready。
3. iPhone：设置 → 隐私与安全性 → 开发者模式。
4. TARGETS → RecordingRing → Signing & Capabilities。
5. 勾选 Automatically manage signing。
6. Team 选择 Personal Team。
7. Xcode 顶部选择真实 iPhone，点击 ▶ Run。
```

首次启动若提示开发者证书不受信任：

```text
iPhone 设置 → 通用 → VPN 与设备管理
→ 开发者 App → 选择 Apple ID → 信任
```

## 6. 启动 Metro

Mac 与 iPhone 使用同一局域网：

```bash
cd /Users/spur/X/space/spur/app/mobile
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
npx expo start --dev-client --clear --lan --port 8081
```

查询 Mac 局域网 IP：

```bash
ipconfig getifaddr en0
```

iPhone Development Build 点击 `Enter URL manually`，输入：

```text
http://<Mac局域网IP>:8081
```

本次示例：

```text
http://172.17.117.9:8081
```

> iOS 不使用 `adb reverse`，也不能使用手机的 `127.0.0.1` 访问 Mac Metro。

## 当前状态

```text
iOS 前端：真机运行成功
RingSDK 原生桥接：尚未接入
戒指初始化/扫描/连接：下一阶段
```
