# 成功 APP 连接蓝牙复盘

## 1. 为什么这次能成功连接

这次能成功连接，核心原因是我们把“硬件已经验证可广播”这件事和“RN App 按协议扫描/连接”这件事对上了。

板子当前固件会广播：

```text
BCL603xxxx
```

而 RN SDK 扫描时专门匹配了 `BCL603` 这类设备名，所以 App 能找到目标板子。

## 2. SDK 分层

SDK 的连接逻辑分成三层：

```text
DeviceScreen 前端页面
  ↓
SmartRingBleSdk
  ↓
SmartRingBleTransport
  ↓
react-native-ble-plx / 手机蓝牙
```

其中：

| 层级 | 作用 |
|---|---|
| `DeviceScreen` | 前端联调页面，负责展示设备、连接状态、PCM 包数和 bytes |
| `SmartRingBleSdk` | 对 App 暴露高级方法，例如扫描、连接、开始录音、停止录音 |
| `SmartRingBleTransport` | 封装真实 BLE 操作，例如扫描、连接、写入、订阅 Notify |
| `react-native-ble-plx` | RN 侧真实调用手机蓝牙能力的底层库 |

## 3. 成功连接链路

具体成功链路是：

```text
1. DeviceScreen 点击“扫描设备”
2. 调用 SmartRingBleSdk.scan()
3. SDK 进入 SmartRingBleTransport.scan()
4. react-native-ble-plx 开始扫描附近 BLE 广播
5. 扫描结果里发现设备名类似 BCL603xxxx
6. SDK 把它加入设备列表
7. 页面展示出来
8. 点击设备
9. 调用 SmartRingBleSdk.connect(deviceId)
10. 底层执行 connectToDevice(deviceId)
11. 连接成功后执行 discoverAllServicesAndCharacteristics()
12. SDK 查找协议里的 Service UUID
13. 找到后保存 Write / Notify UUID
14. 启动 Notify 监听
15. 页面显示连接成功
```

## 4. 为什么不是碰巧连上

这次不是“碰巧连上”，而是因为下面几个条件都匹配了：

| 条件 | 实际情况 |
|---|---|
| 板子 BLE 广播正常 | 已用健康戒指 App 验证成功 |
| 广播名可识别 | `BCL603xxxx` |
| RN App 有蓝牙权限 | Android Manifest + 运行时权限已处理 |
| SDK 扫描规则正确 | 匹配 `BCL603` / `SmartRing` / `Recording` / `Ring` |
| SDK 使用真实 BLE 库 | `react-native-ble-plx` |
| 连接后发现服务 | `discoverAllServicesAndCharacteristics()` |
| 协议 UUID 已写入 SDK | 优先 `bae80001...`，兼容旧 `00001000...` |

## 5. 核心匹配点

最终成功来自这三件事打通：

```text
板子广播名 BCL603xxxx
+
RN 蓝牙扫描权限/运行环境
+
SDK 内置协议 UUID 和连接流程
```

所以 App 能从“扫描到设备”走到“连接成功并订阅 Notify”。

## 6. 下一步验证

下一步需要验证录音数据流：

```text
点击开始录音
  ↓
发送开始录音命令 00 09 71 00 01
  ↓
板子通过 Notify 返回 PCM 数据
  ↓
App 页面 PCM 包数 / bytes 持续增长
  ↓
点击停止录音
  ↓
发送停止录音命令 00 09 71 00 00
```

判断标准：

| 现象 | 说明 |
|---|---|
| 能扫到 `BCL603xxxx` | RN App 扫描 OK |
| 能连接成功 | Service / Characteristic 匹配 OK |
| 开始录音后 PCM 包数/bytes 增长 | 录音 BLE 闭环打通 |
| 能停止录音 | Stop 命令写入 OK |
