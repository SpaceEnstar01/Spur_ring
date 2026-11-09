# Spur V2 iOS 从代码修改到 iPhone 真机运行的构建签名打包安装流程与实际命令记录

记录日期：2026-11-04。对应最近成功版本：Spur iOS 1.0.2（1037）。

本文根据当前源码、构建日志及已成功执行的安装命令整理。编写本文时只读取资料，没有重新编译、安装或修改 App 代码。下面的构建与安装命令是历史执行记录及接续参考，不代表阅读文档即授权执行。

## 1. 当前采用的方式

**Mac 本机构建并签名 Release App → Apple 设备工具安装到 iPhone → 结束旧进程并启动新版本。**

最近这些更新不是 Fast Refresh，也不是手机自动从云端下载 UI 代码。

```text
修改 V2 源码
  → 判断是否需要更新依赖
  → 类型、Lint、测试检查
  → xcodebuild 构建
      ├─ 原生编译和链接
      ├─ Metro 打包 JS／TSX 和资源
      ├─ Hermes 编译
      └─ 代码签名，形成 .app
  → devicectl 安装
  → devicectl 结束旧进程并启动新版
  → iPhone 实际功能和视觉检查
```

Xcode 会调度内部构建任务，部分可以并行；图中的子步骤是职责说明，不表示所有编译任务都严格串行。

## 2. 当前工程与环境

| 项目 | 核对结果 |
|---|---|
| 主仓 | `/Users/x/X/space/spur` |
| 当前 V2 移动工程 | `/Users/x/X/space/spur/V2/appV2/app_mobile` |
| React Native | 0.82.1 |
| React | 19.1.1 |
| Node.js | 20.20.2 |
| Xcode | 27.2，Build 27B52 |
| iOS workspace | `ios/SuprRing.xcworkspace` |
| Scheme | `SuprRing` |
| App 产物名 | `SuprRing.app` |
| App 显示名称 | Spur |
| Bundle ID | `com.spur.recordingring` |
| 最近构建版本 | 1.0.2（1037） |
| 测试手机 | eFLY，iPhone 12 |
| 测试设备 UDID | `00008101-00014DA214FA001E` |
| 构建缓存与产物根目录 | `/tmp/spur-agent-workspace-build` |

`/tmp` 路径是这次构建的本机位置，可能被系统清理，不是长期归档目录。源码与文档位于主仓。

版本号本次由命令行参数指定。工程文件中仍可能有默认的 `1.0`／`1`，不能仅凭默认值判断实际安装包版本。

## 3. 第一步：修改源码

执行命令的工作目录为：

```bash
cd /Users/x/X/space/spur/V2/appV2/app_mobile
```

主要修改位置：

- `src/`：React Native 页面、组件、样式、业务逻辑。
- `src/assets/`：图片等资源。
- `ios/`：原生工程、Swift、权限、构建及签名配置。
- `native-sdk/`：原生 SDK 与桥接模块。

只改 TypeScript／TSX 不代表当前真机可以直接刷新，因为现在真机读取的是安装包里的代码。

## 4. 第二步：判断是否更新依赖

### JavaScript 依赖

由 npm 管理：

- `package.json`
- `package-lock.json`
- `node_modules/`

新增或更换 JavaScript 库时，需要相应安装依赖并核对锁文件。

### iOS 原生依赖

由 CocoaPods 管理：

- `ios/Podfile`
- `ios/Podfile.lock`
- `ios/Pods/`
- 工程根目录 `Gemfile`、`Gemfile.lock`

当前 Podfile 接入 React Native、Hermes 及本地 `YanqiangRingSDK` 等。新增原生库或修改 Podfile 时，需要相应处理 CocoaPods 依赖。

**最近 UI 修改没有新增 App 依赖，因此没有每次重跑 npm 安装或 `pod install`。** 已准备好的依赖直接用于构建。为视觉检查临时安装在 `/tmp` 的浏览器工具不是 App 生产依赖。

依赖安装只准备构建材料，不会自动安装 App 到手机。

## 5. 第三步：检查代码与测试

实际执行过的命令如下，工作目录均为移动工程。

### TypeScript

```bash
/Users/x/.local/bin/node node_modules/typescript/bin/tsc --noEmit
```

作用：检查类型，不输出安装包。React Native 构建中的代码转换与该类型检查不是同一步。

### ESLint

```bash
/Users/x/.local/bin/node node_modules/eslint/bin/eslint.js \
  src/adaptive \
  src/components/RecordingReplyCard.tsx
```

作用：检查指定改动源码。检查路径会根据实际改动范围调整。

### Jest

```bash
/Users/x/.local/bin/node node_modules/jest/bin/jest.js --runInBand
```

1037 这轮完整结果：

```text
Test Suites: 33 passed, 33 total
Tests:       234 passed, 234 total
```

测试通过不代表已经安装，也不代表实际界面的视觉质量通过验收。三者需要分别验证。

## 6. 第四步：Xcode 命令行构建

实际使用的构建命令：

```bash
xcodebuild \
  -workspace ios/SuprRing.xcworkspace \
  -scheme SuprRing \
  -configuration Release \
  -destination generic/platform=iOS \
  -derivedDataPath /tmp/spur-agent-workspace-build \
  CURRENT_PROJECT_VERSION=1037 \
  MARKETING_VERSION=1.0.2 \
  build
```

实际最终构建时将输出重定向到了：

```text
/tmp/spur-ui-1037-final-build.log
```

| 参数 | 作用 |
|---|---|
| `-workspace` | 使用 App 工程与 CocoaPods 依赖 |
| `-scheme SuprRing` | 指定构建目标 |
| `-configuration Release` | 构建内置代码包、可独立启动的 Release 版本 |
| `generic/platform=iOS` | 为真实 iOS 设备构建，不是模拟器 |
| `-derivedDataPath` | 指定缓存、中间文件和产物位置 |
| `CURRENT_PROJECT_VERSION` | 构建号，本次 1037 |
| `MARKETING_VERSION` | 对外版本，本次 1.0.2 |
| `build` | 执行构建，不是 archive 或 App Store 上传 |

不打开 Xcode 图形界面，仍然在使用 Xcode 的编译器、iOS SDK、构建系统和签名工具。

构建会复用缓存：重新构建不等于把所有依赖每次从零编译。

## 7. 构建中的 React Native／Metro／Hermes

工程配置了构建阶段：

```text
Bundle React Native code and images
```

配置位置：

```text
/Users/x/X/space/spur/V2/appV2/app_mobile/ios/SuprRing.xcodeproj/project.pbxproj
```

该阶段调用：

```text
react-native/scripts/xcode/with-environment.sh
react-native/scripts/react-native-xcode.sh
```

Node 路径由 `ios/.xcode.env` 和本机 `.xcode.env.local` 提供；核对到本机实际路径为：

```text
/Users/x/.local/share/nodejs/node-v20.20.2-darwin-arm64/bin/node
```

1037 最终日志包含以下参数，省略了重复绝对路径：

```text
react-native/scripts/bundle.js bundle
--entry-file index.js
--platform ios
--dev false
--bundle-output .../main.jsbundle
--assets-dest .../SuprRing.app
```

随后输出：

```text
Writing bundle output to: .../main.jsbundle
Done writing bundle output
```

接着执行：

```text
hermesc -emit-binary ... -out .../SuprRing.app/main.jsbundle ...
```

职责划分：

| 工具 | 作用 |
|---|---|
| Node | 运行 React Native／Metro 打包脚本 |
| React Native／Metro | 转换并打包前端入口、依赖和资源 |
| Hermes 编译器 | 生成运行用的 JavaScript 字节码 |
| Xcode 构建系统 | 触发这些步骤，组织最终 App |

**用 Metro 打包不等于运行 Metro 开发服务器。** Release 构建会把代码打进 App，不需要 Mac 持续运行 `npm start`。

## 8. 第五步：原生链接、签名和 App 产物

Xcode 处理 Swift／Objective-C／C++ 等原生代码及依赖框架的编译、链接、复制和签名。

工程当前为自动签名。1037 首次构建日志中可以看到：

```text
CodeSign .../SuprRing.app
Signing Identity: "Apple Development: ..."
Provisioning Profile: "iOS Team Provisioning Profile: com.spur.recordingring"
/usr/bin/codesign ...
```

使用的是本机已配置的 Apple Development 身份和对应描述文件。没有在每次更新时重新创建证书，也不需要用户每次手动输入手机登录密码。

**Release 是构建配置，不等于 App Store 分发方式。** 本次是 Release 构建、开发签名、测试设备安装。

最终产物：

```text
/tmp/spur-agent-workspace-build/Build/Products/Release-iphoneos/SuprRing.app
```

构建成功标志：

```text
** BUILD SUCCEEDED **
```

本次没有额外导出 `.ipa`，没有执行 Archive、TestFlight 或 App Store 发布；Apple 工具直接安装 `.app`。

只读检查安装包版本的实际命令：

```bash
/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' \
  /tmp/spur-agent-workspace-build/Build/Products/Release-iphoneos/SuprRing.app/Info.plist
```

输出：

```text
1037
```

读取 `CFBundleShortVersionString` 得到 `1.0.2`。该检查不编译、不安装。

## 9. 第六步：检查手机连接

实际执行：

```bash
xcrun devicectl list devices
```

安装前曾确认：

```text
eFLY   00008101-00014DA214FA001E (UDID)   connected   iPhone 12
```

设备此前已配对、建立信任，并开启开发者模式。连接不可用时，不能仅因为本地构建成功就说手机已更新。

`xcrun` 定位并运行 Xcode 工具，`devicectl` 使用 Apple CoreDevice 能力管理设备及 App。

## 10. 第七步：安装到 iPhone

实际成功命令：

```bash
xcrun devicectl device install app \
  --device 00008101-00014DA214FA001E \
  /tmp/spur-agent-workspace-build/Build/Products/Release-iphoneos/SuprRing.app
```

实际成功输出节选：

```text
App installed:
• bundleID: com.spur.recordingring
• installationURL: file:///private/var/containers/Bundle/Application/…/SuprRing.app/
```

这是安装新的完整 App，不是只同步少量 UI 文本。相同 Bundle ID 的正常覆盖安装通常保留已有 App 数据，不是先卸载再安装；仍不能据此替代重要数据的备份策略。

## 11. 第八步：结束旧进程并启动新版

实际成功命令：

```bash
xcrun devicectl device process launch \
  --device 00008101-00014DA214FA001E \
  --terminate-existing \
  com.spur.recordingring
```

输出：

```text
Launched application with com.spur.recordingring bundle identifier.
```

`--terminate-existing` 先结束旧进程，再启动已安装 App。因此用户看到的启动和界面变化，是执行安装及启动命令的结果，不是源码保存后手机自行更新。

## 12. 第九步：手机读取内置代码，连接云端 Agent

当前源码：

```text
/Users/x/X/space/spur/V2/appV2/app_mobile/ios/SuprRing/AppDelegate.swift
```

实际关键条件：

```swift
#if DEBUG && targetEnvironment(simulator)
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
```

含义：

- 只有 **Debug＋模拟器** 从 Metro 获取代码。
- 真机即使是 Debug，也走内置代码包。
- Release 读取内置代码包，不依赖 Metro 开发服务器。

手机启动后，再通过已配置的 HTTPS 与 Personal Agent 通信。App 的更新流程与 ECS 服务更新是两条不同链路。

## 13. 为什么不打开 Xcode 也能完成

因为使用了 Xcode 命令行工具：

| 工作 | 使用方式 |
|---|---|
| 编译、链接、资源处理和构建脚本调度 | `xcodebuild` |
| 签名 | Xcode 调用 `codesign` |
| 查询设备、安装和启动 | `xcrun devicectl` |

图形窗口不是必须条件，但本机仍需已安装并配置可用的 Xcode、SDK、签名身份和设备信任。

## 14. 无线安装与当前连接事实

满足设备配对、信任、开发者模式和可用网络连接等条件时，Apple 开发工具可以通过无线连接安装、启动 App。安装命令的形式基本相同，底层传输通道不同。

但必须区分能力与证据：

- `App installed` 只证明安装成功，不能单凭这行判断无线还是有线。
- `connected` 也不直接等同于无线。
- 2026-11-04 本轮解释时，只读查询显示：

```text
Pairing State: paired
Developer Mode Status: Enabled
Transport Type: wired
```

因此当前查询时是有线连接。此前没有逐次记录传输类型，不能称每次安装都是无线。之前笼统用“无线更新”描述所有安装不够准确。

只读核对命令：

```bash
xcrun devicectl device info details \
  --device 00008101-00014DA214FA001E
```

是否无线应按当时返回的 Transport Type 判断。

## 15. 无线安装与 Fast Refresh 的区别

| 方式 | 传输／更新内容 | 是否需要安装 |
|---|---|---|
| 无线安装 | 已构建、签名的完整 App，通过网络传输 | 需要 |
| Fast Refresh | 开发中的 App 从 Metro 接收更新的 JS／组件代码 | 普通 JS 改动通常不需要 |
| 最近 Spur 1035–1037 流程 | 内置代码包的 Release 构建，安装后重启 | 需要 |

无线是安装的传输方式；Fast Refresh 是开发时更新代码的机制。二者可以独立存在。

当前工程没有接入 CodePush／Expo Updates 等 OTA 更新依赖或相应源码。不能把最近更新解释成线上热更新。

## 16. 哪些改动需要重新构建和安装

| 改动 | 当前项目处理方式 |
|---|---|
| UI、文案、样式、普通 JS／TS 逻辑 | 当前真机读取内置包，需要重新打包、构建、签名、安装 |
| Swift、原生模块、SDK | 需要原生构建、签名、安装 |
| 原生依赖 | 先更新依赖，再构建、签名、安装 |
| 权限说明、Entitlements、签名配置 | 通常需要重新构建、签名、安装；签名能力变化还需对应配置有效 |
| 只有云端 Agent 行为改变，App 接口仍兼容 | 通常只更新云端，不重装手机 App |
| 已接通 Metro 的 Debug 开发环境中修改普通 JS／样式 | 通常可 Fast Refresh，不必重装；部分修改需要重载 |

**当前真机仅运行 `npm start` 不会进入 Fast Refresh。** 如后续希望改用真机热刷新，需要另行配置真机 Debug 代码加载路径，准备可访问的 Metro 连接，并先安装对应开发版本。只开 Metro 不能改变已安装 Release 的加载行为。

## 17. 验收必须分开记录

至少区分：

1. 类型／静态检查通过。
2. 自动化测试通过。
3. Release 构建与签名成功。
4. 安装到指定手机成功。
5. App 新进程启动成功。
6. 真机功能与视觉符合要求。

前三项不能代替后三项；构建成功不等于手机更新，安装成功不等于 UI 已完成视觉验收。

1037 还用同一套 React Native 组件进行过浏览器窄屏渲染检查。那属于补充布局检查，不是 iPhone 截图，也不是实际安装步骤。

## 18. 日志与接续资料

本机历史日志：

- `/tmp/spur-ui-1037-build.log`：首次 1037 构建，含明确 CodeSign、签名身份及描述文件记录。
- `/tmp/spur-ui-1037-final-build.log`：最终增量构建，含 React Native 打包、Hermes 编译及 BUILD SUCCEEDED。

日志和构建产物位于 `/tmp`，不能假定长期保留。安装、启动的成功输出也保存在本轮会话工具记录中；不要虚构它们都在 xcodebuild 日志里。

相关项目文档：

- `Spur-Agent-Workspace二十种自适应UI设计规范与交互实现及真机版本接续说明.md`
- `Agent-Workspace二十种示例按确认稿重新排版与默认折叠修复记录.md`

未来切换开发方式、设备、签名或版本时，应更新本文对应事实；不要将历史命令、缓存路径或此前已配对状态视为永远有效。
