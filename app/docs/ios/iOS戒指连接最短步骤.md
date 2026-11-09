# iOS 戒指连接最短步骤

## 结论

Release 包已验证：扫描 → BLE → `AuthSuccess(1)` → `vendorReady=true`。  
录音同步已接入原生（查询 / 拉取 → `Documents/voice-recordings/`）。

## 为什么现在可以成功完成 App 连接戒指（重要点）

1. **不要在 `BLEConnected(-2)` 后手动调 `authorize`**  
   官方 DreameRing iOS 只做 `bindDevice`，鉴权由 RingSDK 内部完成，再回调 `AuthSuccess(1)`。过早手动 `baseReq.authorize` 会卡在 `-2`，App 一直显示 connecting。

2. **以 `AuthSuccess(1)` 为真正连上，而不是系统蓝牙「已连接」**  
   iPhone 设置里显示已连接，只说明系统 BLE 链路在；App 必须等到 `vendorReady=true`（`bleConnected && authSucceeded`）才算厂商侧连上。

3. **用 Release 包、内嵌 `main.jsbundle`**  
   不依赖 Metro / 电脑常连。连接稳定性来自原生 RingSDK 流程，而不是 Dev Client 网络。

4. **连接入口对齐官方：`bindDevice` / `bindDeviceWithPeripheral`**  
   有扫描缓存的 `CBPeripheral` 就用 `bindDeviceWithPeripheral`，否则 `bindDevice(address)`；等 `ringStatusUpdated` 推到 `AuthSuccess`，再发 `connected`。

5. **BLE 状态不要当成录音 workingState**  
   `yanqiangVoiceStatusUpdate` 只发录音相关状态；鉴权过程只用 `yanqiangVoiceConnectionChanged`，避免 autoSync 等逻辑误判。

> 列表双行（UUID/MAC）、偶发 `PairingRemoved(-6)` 仍是已知小问题，与「鉴权成功路径」无关；不稳时在系统蓝牙里忘记 AIZO 再连。

## 已缓存可回滚版本（2026-08-04 auth-success）

本目录旁已冻结当时**能完成 App ↔ AIZO 录音戒指连接**的代码快照（连接可用，仍有小问题，仅作测试基线）：

```text
app/docs/ios/snapshots/2026-08-04-auth-success/
  YanqiangVoiceModule.m          # iOS 原生桥接（鉴权 + 录音同步）
  YanqiangVoiceDebugScreen.tsx   # 设备连接调试页
```

SHA-256（与写入时工作区文件一致）：

| 文件 | sha256 |
|------|--------|
| `YanqiangVoiceModule.m` | `0842057bf67356953d4496a1dabe5d5734e44d94da21dee7fac04d399fd913a7` |
| `YanqiangVoiceDebugScreen.tsx` | `7ae154e3c373cde052429b59605a10c897665a131ee2139e4a93c4d7f06df3c7` |

### 回滚到此版本

```bash
SNAP="/Users/spur/X/space/spur/app/docs/ios/snapshots/2026-08-04-auth-success"
ROOT="/Users/spur/X/space/spur/app/mobile"

cp "$SNAP/YanqiangVoiceModule.m" \
  "$ROOT/native-sdk/ios/YanqiangVoiceModule.m"
cp "$SNAP/YanqiangVoiceDebugScreen.tsx" \
  "$ROOT/src/screens/device/YanqiangVoiceDebugScreen.tsx"
```

然后按下方「编译安装」重新打 Release 装到真机。

### 此版本关键行为（勿再改坏）

- `BLEConnected(-2)` 后**不要**手动 `baseReq.authorize`；只 `bindDevice` / `bindDeviceWithPeripheral`，等 SDK 回调 `AuthSuccess(1)`。
- `connect`：有缓存 `CBPeripheral` 则 `bindDeviceWithPeripheral`，否则 `bindDevice(address)`。
- `yanqiangVoiceStatusUpdate` 只发录音 working state，不要把 BLE 鉴权状态塞进去（避免 autoSync 误判）。

### 已知小问题（可接受，先缓存）

- 列表可能同时出现系统 UUID 行与扫描 MAC 行（同一枚戒指）。
- 系统已配对时偶发 `PairingRemoved(-6)`；可到「设置 → 蓝牙」忘记 AIZO 后再连。
- 录音同步路径已接上，但设备侧可能报空文件（`BLEReceiveStatusEnpty`），与连接鉴权无关。

> 后续修 PairingRemoved / 去重列表时，请先对照本快照做 diff；修坏了按上面命令回滚再测。

## 编译安装（无需 Metro）

```bash
cd /Users/spur/X/space/spur/app/mobile/ios
xcodebuild -workspace RecordingRing.xcworkspace \
  -scheme RecordingRing -configuration Release \
  -destination 'id=00008101-00014DA214FA001E' \
  -allowProvisioningUpdates build

xcrun devicectl device install app --device 00008101-00014DA214FA001E \
  ~/Library/Developer/Xcode/DerivedData/RecordingRing-*/Build/Products/Release-iphoneos/RecordingRing.app

xcrun devicectl device process launch --device 00008101-00014DA214FA001E \
  com.spur.recordingring
```

> 设备名 `eFLY`；可用 `xcrun xctrace list devices` 查 UDID。  
> 不要用 Debug Dev Client 连 Metro，局域网/tunnel 易挂。

## 手机操作

1. 打开 **Recording Ring**
2. 进设备页 → 扫描 → 选 **AIZO RING** → 连接
3. 成功标志：界面已连接，日志含 `AuthSuccess` / `vendorReady=true`

## 关键修复（已合入此快照）

`YanqiangVoiceModule.m`：收到 `BLEConnected(-2)` 后**不要**手动 `authorize`。  
对齐官方：只 `bindDevice`，等 SDK 回调 `AuthSuccess(1)`。

## 录音同步（已接入原生）

基于 `BTAudioManager` / `BTAudioPacketDBManager`：

- `queryVoiceRecordingSummary` → `queryDeviceStorageStatus`
- `syncVoiceRecordings` → `fetchLargeAudioFile` → opus→ogg → `Documents/voice-recordings/`

真机验证：连接成功后，在录音调试页点「查询 / 同步」，或等自动同步；日志应出现 `receiveStatus` / `fileReady`。
