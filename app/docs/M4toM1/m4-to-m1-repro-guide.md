# Spur iOS 工程复现完整指南（M4 Pro → M1 Mac）

> 适用场景：同事用 **Apple Silicon M1** Mac，要从你这台 **M4 Pro** 上已跑通的 Spur / Recording Ring 工程，完整复现到能 **Release 编译并装到真机**。  
> 目标 App：`com.spur.recordingring`（显示名 spur）  
> 工程路径（本仓）：`app/mobile`

---

## 0. 结论（先看这段）

1. **可以**用硬盘 / 网盘拷源码，也可以 `git clone`；两者都能复现。  
2. **不要指望**拷完就能直接打开 Xcode 一键成功——还要装同款工具链、重装依赖、登录开发者账号签名。  
3. M1 与 M4 Pro **同属 arm64**，比 Intel→Apple Silicon 省事；关键是对齐 **Xcode / Node / CocoaPods** 版本。  
4. 复现成功的标志：能打开 `ios/RecordingRing.xcworkspace`，Release 编过，真机能安装并启动。

---

## 1. 已验证的源机器环境（请对齐）

以下为当前 M4 Pro 上已验证可编可装的环境，**M1 尽量对齐**：

| 项 | 版本 / 值 |
|----|-----------|
| 芯片 | Apple Silicon（M1 / M4 均可） |
| macOS | **26.0.1**（建议 M1 也升到能安装 Xcode 26.2 的系统） |
| Xcode | **26.2**（Build `17C52`） |
| Node | **20.x**（本机验证：`v20.20.2`，Homebrew `node@20`） |
| CocoaPods | **1.16.2** |
| Bundle ID | `com.spur.recordingring` |
| Development Team | `8S35TQSBHH` |
| 主工程 | `app/mobile` |
| 打开方式 | **必须**打开 `ios/RecordingRing.xcworkspace`（不是 `.xcodeproj`） |

> 文档与脚本里习惯：  
> `export PATH="/opt/homebrew/opt/node@20/bin:$PATH"`

---

## 2. 建议怎么把工程弄到 M1（二选一）

### 方案 A（推荐）：Git 克隆

若已有私有仓 / 共享远端：

```bash
git clone <仓库地址>
cd spur/app/mobile
```

### 方案 B：硬盘 / 网盘拷贝

从 M4 Pro **拷整个仓库目录**到 M1 均可，但注意：

| 建议拷 | 建议不要依赖 / 到 M1 后重装 |
|--------|------------------------------|
| `app/mobile` 源码 | `node_modules/` |
| `ios/`（含 `Podfile`、`Podfile.lock`、`.xcworkspace`） | `ios/Pods/` |
| `android/`（若也要编 Android） | `ios/build/`、`DerivedData` |
| `native-sdk/`（**必须**，含 `RingSDK.framework` 等） | `.expo/`、本机 `DerivedData` |
| `assets/`、`package-lock.json` | `ios/.xcode.env.local`（里面是本机绝对路径，到 M1 必改） |
| `app/docs/`（可选，方便对照） | 任意 `.env` 密钥文件（按安全策略处理） |

拷完后建议在 M1 上删掉再装依赖（更干净）：

```bash
cd /path/to/spur/app/mobile
rm -rf node_modules ios/Pods ios/build
```

---

## 3. M1 机器：系统与 Xcode

### 3.1 升级 macOS

先确认 M1 的 macOS **能安装 Xcode 26.2**。  
建议升到与源机接近的 **macOS 26.x**，避免「Xcode 装不上 / SDK 对不上」。

### 3.2 安装 Xcode **26.2**

1. 从 App Store 或 [Apple Developer Downloads](https://developer.apple.com/download/all/) 安装 **Xcode 26.2**。  
2. 打开一次 Xcode，装完额外组件，接受协议：

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
xcodebuild -version
# 期望：Xcode 26.2
```

3. Xcode → **Settings → Platforms**，确保已下载对应 **iOS** 平台支持（真机调试需要）。

> **不要**用明显更旧的 Xcode（如 15 / 16）硬编本工程（Expo 52 / RN 0.76），差异大、容易踩坑。

---

## 4. M1 机器：Homebrew / Node / CocoaPods

### 4.1 Homebrew（arm64）

若未安装：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

确保用的是 `/opt/homebrew`（Apple Silicon 默认路径）。

### 4.2 Node 20（强制建议）

```bash
brew install node@20
echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

node -v    # 期望 v20.x
npm -v
which node # 期望带 /opt/homebrew/opt/node@20/
```

### 4.3 CocoaPods

```bash
brew install cocoapods
pod --version   # 期望 1.16.x 附近
```

若 `pod` 报 Ruby 相关问题，优先用 Homebrew 的 cocoapods，不要混用过旧系统 Ruby gem 路径。

---

## 5. 安装 JS 与 iOS 依赖

在工程目录：

```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
cd /path/to/spur/app/mobile

npm install

cd ios
pod install
cd ..
```

检查：

- 存在 `ios/Pods/`
- 存在 `ios/RecordingRing.xcworkspace`
- `native-sdk/RingSDK.framework`、`native-sdk/AB_FOTA.framework` 仍在（拷丢了会导致 pod / 链接失败）

### 修正 Node 路径（重要）

编辑（没有就新建）`app/mobile/ios/.xcode.env.local`：

```bash
export NODE_BINARY=/opt/homebrew/opt/node@20/bin/node
```

源机上的 `.xcode.env.local` 往往指向 M4 本机 Cellar 绝对路径，**原样拷到 M1 会编失败**。

---

## 6. Apple 账号与签名

1. 用有权限的 **Apple Developer** 账号登录 Xcode（Settings → Accounts）。  
2. 打开 `ios/RecordingRing.xcworkspace`。  
3. 选中 target **RecordingRing** → **Signing & Capabilities**：  
   - Team：与源机一致时为 `8S35TQSBHH`（或你们团队指定 Team）  
   - Bundle Identifier：`com.spur.recordingring`  
   - 勾选 Automatically manage signing（一般即可）  
4. 用数据线连上 iPhone，在设备上点「信任此电脑」。  
5. 若提示证书 / 描述文件问题：在 Xcode Accounts 里 Download Manual Profiles，或让管理员把该 Mac / 该 Apple ID 加进 Team。

> 签名证书**不会**随工程硬盘拷贝自动在新电脑生效，必须在 M1 上重新登录并拉取。

---

## 7. 第一次编译并装到真机

### 方式 A：Xcode GUI（同事最省事）

1. 打开：`app/mobile/ios/RecordingRing.xcworkspace`  
2. 顶部选真机（不要选 Simulator，若要测 BLE / 戒指）  
3. Scheme：`RecordingRing`  
4. 建议配置：**Release**（与当前已验证路径一致；可脱离 Metro 独立跑）  
5. Product → Run（或 Archive，若要上架包）

### 方式 B：命令行（对齐源机习惯）

先查设备 UDID：

```bash
xcrun xctrace list devices
```

然后（把 `DEVICE_UDID` 换成真机）：

```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
cd /path/to/spur/app/mobile/ios

xcodebuild -workspace RecordingRing.xcworkspace \
  -scheme RecordingRing \
  -configuration Release \
  -destination "id=DEVICE_UDID" \
  -allowProvisioningUpdates \
  build
```

安装并启动示例：

```bash
APP=$(ls -d ~/Library/Developer/Xcode/DerivedData/RecordingRing-*/Build/Products/Release-iphoneos/RecordingRing.app | head -1)
echo "APP=$APP"

xcrun devicectl device install app --device DEVICE_UDID "$APP"
xcrun devicectl device process launch --device DEVICE_UDID com.spur.recordingring
```

---

## 8. 装上后建议冒烟检查

| 检查项 | 期望 |
|--------|------|
| App 能启动 | 看到 spur 界面 |
| Recordings | 有紫色 **DEMO** 录音可播（静音模式也可播） |
| AI Assistant | 有约 3 条 DEMO（旅行 report / Judy idea / Apple report） |
| Device 页 | 能扫到戒指（需真机蓝牙权限） |
| 连接戒指 | 以 `AuthSuccess` / `vendorReady` 为准（详见 `iOS戒指连接最短步骤.md`） |

相关文档：

- `app/docs/ios/iOS前端真机编译安装最短步骤.md`
- `app/docs/ios/iOS戒指连接最短步骤.md`
- `app/docs/ios/iOS录音同步最短步骤.md`

---

## 9. 常见失败与处理

| 现象 | 处理 |
|------|------|
| `node: command not found` / Xcode Script 失败 | 确认 `node@20` 在 PATH；写好 `ios/.xcode.env.local` |
| `pod install` 找不到 `expo` / `react-native` | 先在 `app/mobile` 执行 `npm install`，再用同一终端跑 pod |
| 找不到 `RingSDK` / YanqiangRingSDK | 检查是否拷全 `app/mobile/native-sdk/` |
| Code signing / Team 错误 | Xcode 登录正确 Apple ID；确认 Team 与 Bundle ID |
| 能编不能装 | 设备已信任电脑；开发者模式已开；UDID 已进描述文件 |
| 打开了 `.xcodeproj` 一堆红错 | 改开 `.xcworkspace`，并先 `pod install` |
| 静音模式播不了音频 | 当前主线已设 `playsInSilentModeIOS`；确认跑的是新编 Release，不是旧包 |
| Node 变成 v25 等其它主版本 | 不要用；强制 `node@20` 再编 |

清理重来（依赖坏了时）：

```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
cd /path/to/spur/app/mobile
rm -rf node_modules ios/Pods ios/build
npm install
cd ios && pod install
```

Xcode 派生数据（可选）：

```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/RecordingRing-*
```

---

## 10. 给同事的最短 checklist

把下面当 Todolist 打勾即可：

- [ ] macOS 已升到可装 **Xcode 26.2**
- [ ] 已安装 **Xcode 26.2**，`xcodebuild -version` 正确
- [ ] Homebrew + **node@20** + CocoaPods 可用
- [ ] 工程已到位（git 或硬盘），且含 `native-sdk/`
- [ ] `npm install` 成功
- [ ] `cd ios && pod install` 成功
- [ ] 已改 `ios/.xcode.env.local` 指向本机 `node@20`
- [ ] Xcode 已登录开发者账号，Signing 通过
- [ ] 打开的是 **`RecordingRing.xcworkspace`**
- [ ] Release 编过并装到真机，App 能启动
- [ ] DEMO 录音 / 智能体列表正常

---

## 11. 可选：同时复现 Android

若也要在 M1 上编 Android：

1. 安装 Android Studio + SDK  
2. `app/mobile/android/local.properties` 由本机生成（不要抄源机 SDK 路径）  
3. 同样先：

```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
cd /path/to/spur/app/mobile
npm install
```

4. 再用 Android Studio 打开 `android/`，或按 `app/docs/andriod_app/` 下文档操作。

---

## 12. 联系与范围说明

- 本指南只保证：**工程在 M1 上可完整编译安装**，对齐当前 iOS 主路径。  
- 戒指连接 / 录音同步细节以 `app/docs/ios/` 其它「最短步骤」为准。  
- 若 Team / 证书账号与上文不一致，以你们 Apple Developer 团队实际配置为准，只需保持 Bundle ID 与工程一致。

---

*文档生成依据：源机 macOS 26.0.1 + Xcode 26.2 + Node 20.20.2 + CocoaPods 1.16.2，工程 `app/mobile`，Bundle ID `com.spur.recordingring`。*
