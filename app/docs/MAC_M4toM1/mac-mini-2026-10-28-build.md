# Mac mini 迁移：旧版 RecordingRing Release 编译通过

日期：2026-10-28。目标工程为 `app/mobile/ios/RecordingRing.xcworkspace`，不是 V2。

## 结果

macOS 27.0.1、Xcode 27.1（27A9275）、Apple Silicon 环境下，使用现有依赖与开发签名编译 Release，`xcodebuild` 返回 0，日志明确显示 `BUILD SUCCEEDED`。这是编译与签名验证，不代表已安装到手机或完成戒指业务验收。

## 修复

1. 原日志 Hermes 脚本报 `/opt/homebrew/opt/node@20/bin/node: No such file or directory`。安装旧基线版本 Node **20.20.2**（npm **10.8.2**），官方 SHA-256 校验通过。
2. Node 为当前用户共用安装：`/Users/x/.local/share/nodejs/node-v20.20.2-darwin-arm64`；命令入口在 `~/.local/bin`；`~/.zprofile` 添加该目录到 PATH。新开终端生效，未安装 Homebrew。
3. `app/mobile/ios/.xcode.env.local` 的 NODE_BINARY 改为上述安装下的 `bin/node`。这是本机配置，不应复制到其他账户后原样使用。
4. 已拷贝的 Pods 生成脚本 `Pods/Target Support Files/Pods-RecordingRing/expo-configure-project.sh` 中两处 `/Users/zexuansun/...` 改为基于 `$PODS_ROOT` 的路径，分别指向 ExpoModulesProvider.swift 和 RecordingRing.entitlements。将来重新 pod install 会重新生成此文件。

没有重装 node_modules／Pods，没有修改业务逻辑、厂商 SDK、签名团队、最低 iOS 版本或 V2。现有应用最低 iOS 为 27.0；这是构建前已有配置，本轮保留。

## 编译命令

在 `app/mobile/ios` 执行：

```bash
xcodebuild -workspace RecordingRing.xcworkspace \
  -scheme RecordingRing \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -jobs 4 build
```

完整日志：`/private/tmp/spur-macmini-release-build.log`（临时文件，系统清理后可能消失）。

产物：`/Users/x/Library/Developer/Xcode/DerivedData/RecordingRing-buickplyprhlzxewvjlzytsazlln/Build/Products/Release-iphoneos/RecordingRing.app`。

工程 Scheme 的 Run 已是 Release，内嵌 main.jsbundle，不依赖 Metro 提供页面。回到 Xcode，选择实体 eFLY 后 Run 可继续安装／启动验证；本轮没有执行手机安装或启动。

后续若需要重装原生依赖，再单独恢复 CocoaPods。当前编译已通过，没有必要为了迁移而清空既有依赖。

## 后续：iOS 27 启动兼容修复

同日用户在 Xcode Run 后停在 `main.m` 的 UIApplicationMain。设备崩溃报告 `RecordingRing-2026-10-28-104800.ips` 确认主线程 `EXC_BREAKPOINT/SIGTRAP`，首帧为 `___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption_block_invoke`。编译成功和启动成功是两个验收阶段。

原因是旧版采用 UIApplicationDelegate 窗口启动路径；使用 iOS 27 SDK 构建后，系统要求 Scene 生命周期。降低最低部署版本不能替代 Scene 迁移。

用户明确授权后，修改两个原生文件：

- `RecordingRing/AppDelegate.mm`：保留 Expo／RN 初始化，但关闭自动创建旧窗口；在同一编译单元加入 SpurSceneDelegate，用 UIWindowScene 创建窗口，沿用已有 rootViewFactory／rootViewController；转发 Expo 前后台回调、URL／Universal Link、RN 窗口尺寸变化回调。冷启动链接通过 React launchOptions 保留。不修改 main.m、业务 JS 或戒指 SDK。
- `RecordingRing/Info.plist`：加入单窗口 Scene manifest，并注册 SpurSceneDelegate。

Release 重新编译成功；停止 Xcode 旧调试会话后，覆盖安装到 eFLY 成功（未卸载 App）。通过 devicectl 启动，进程 PID 5869 持续存在；检查设备崩溃目录仍仅有 10:48 旧报告，没有新增同应用崩溃。用户随后明确确认“已显示首页”，启动和首页验收通过；蓝牙、同步、前后台或链接功能未在本次全面回归。

构建日志：`/private/tmp/spur-macmini-scene-build.log`；安装日志：`/private/tmp/spur-scene-install.log`；启动日志：`/private/tmp/spur-scene-launch.log`。临时日志可能被系统清理。
