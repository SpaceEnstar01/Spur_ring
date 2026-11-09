# Smart Ring 录音功能 App 联调协议

版本：V0.1

整理依据：当前上位机录音接收实现

适用对象：App 开发团队，用于 BLE 连接后测试戒指 PDM 录音数据接收、保存和播放验证。

## 0. App 录音联调重点

这份文档的核心目标是让 App 能控制戒指录音，并正确接收、保存录音数据。

App 首版联调时优先实现下面 4 件事即可：

| 优先级 | 必做项 | 关键内容 |
|---|---|---|
| P0 | 订阅录音 Notify | 连接 BLE 后订阅 Notify 特征，用于接收录音数据包 |
| P0 | 启动录音 | 向 Write 特征写入 `00 09 71 00 01` |
| P0 | 停止录音 | 向 Write 特征写入 `00 09 71 00 00` |
| P0 | 解析并保存 PCM | Notify 包满足 `data[2] == 0x71`，PCM 从 `data[10]` 开始，长度为 `data[4] + (data[5] << 8)` |

其他命令，例如时间同步、采集周期、电量、版本号、蓝牙名称、HID 等，都不是录音控制的必要条件。它们只作为附录给 App 团队调试或扩展功能时参考。

录音最小闭环：

```text
连接戒指 -> 订阅 Notify -> 写入 00 09 71 00 01 -> 接收 PCM Notify -> 写入 00 09 71 00 00 -> 保存 WAV/PCM
```

## 1. BLE 通道

App 连接戒指后，需要订阅 Notify 特征，并通过 Write 特征下发控制命令。

当前上位机优先使用的厂商自定义服务如下：

| 类型 | UUID | 属性 |
|---|---|---|
| Service | `bae80001-4f05-4503-8e65-3af1f7329d1f` | 自定义服务 |
| Write | `bae80010-4f05-4503-8e65-3af1f7329d1f` | Write Without Response |
| Notify | `bae80011-4f05-4503-8e65-3af1f7329d1f` | Notify |

部分调试版本也可能暴露旧 UUID：

| 类型 | UUID | 属性 |
|---|---|---|
| Service | `00001000-0000-1000-8000-00805f9b34fb` | 自定义服务 |
| Write | `00001001-0000-1000-8000-00805f9b34fb` | Write Without Response |
| Notify | `00001002-0000-1000-8000-00805f9b34fb` | Notify |

建议 App 扫描到设备后先匹配 `bae80001`；若没有，再尝试旧 UUID。写命令使用 Write Without Response。

## 2. 基础帧格式

普通控制命令采用：

| Byte | 字段 | 说明 |
|---|---|---|
| 0 | Frame_type | 固定按命令填写 |
| 1 | Frame_Id | 命令 ID |
| 2 | Cmd | 主命令 |
| 3 | Subcmd | 子命令 |
| 4..N | Data | 数据区，可为空 |

上位机没有额外添加校验和、长度字段或包尾。发送时直接写完整 byte array。

## 3. 录音控制命令

本节是 App 控制录音的核心协议，建议 App 团队优先按本节实现。

### 3.1 启动录音

App 下发：

```text
00 09 71 00 01
```

字段拆解：

| 字节 | 值 | 说明 |
|---|---|---|
| 0 | `00` | Frame_type |
| 1 | `09` | Frame_Id |
| 2 | `71` | Cmd，PDM/录音控制 |
| 3 | `00` | Subcmd |
| 4 | `01` | Data，`01` 表示启动 |

上位机行为：发送该命令前会先清空本地音频缓存并开始接收 Notify。

### 3.2 停止录音

App 下发：

```text
00 09 71 00 00
```

字段拆解：

| 字节 | 值 | 说明 |
|---|---|---|
| 0 | `00` | Frame_type |
| 1 | `09` | Frame_Id |
| 2 | `71` | Cmd，PDM/录音控制 |
| 3 | `00` | Subcmd |
| 4 | `00` | Data，`00` 表示停止 |

建议 App 停止后再延迟 200 到 500 ms，确保最后几包 Notify 被处理完，再保存文件。

## 4. 录音数据 Notify 格式

本节是 App 保存录音文件的核心协议。App 收到 Notify 后，应先按本节判断是否为录音数据包，再提取 PCM payload。

上位机按以下规则识别录音包：

- Notify 数据长度至少大于等于 12 字节。
- `data[2] == 0x71`，否则不作为录音数据处理。
- `data[4..5]` 是 PCM payload 长度，低字节在前，即 little-endian。
- PCM 数据默认从 `data[10]` 开始。
- PCM payload 长度必须大于 0，且必须为偶数。

录音 Notify 推荐解析格式：

| Byte | 字段 | 说明 |
|---|---|---|
| 0 | Frame_type | 当前上位机不强依赖 |
| 1 | Frame_Id | 当前上位机不强依赖 |
| 2 | Cmd | 必须为 `71` |
| 3 | Subcmd/Type | 当前上位机不强依赖 |
| 4 | PayloadLen_L | PCM 长度低字节 |
| 5 | PayloadLen_H | PCM 长度高字节 |
| 6..9 | Reserved/Header | 当前上位机跳过，不写入音频 |
| 10.. | PCM payload | 16-bit PCM 小端数据 |

长度计算：

```text
payloadLength = data[4] | (data[5] << 8)
payload = data[10 : 10 + payloadLength]
```

注意：如果固件后续调整头长度，App 需要同步调整 payload offset。当前上位机界面默认 Payload 偏移 = 10。

## 5. 音频数据格式

当前上位机按以下音频参数保存 WAV：

| 参数 | 值 |
|---|---|
| 编码 | PCM |
| 声道 | 1，单声道 |
| 采样率 | 16000 Hz，界面可手动改 |
| 位深 | 16 bit |
| 字节序 | Little-endian |

每 2 字节组成一个有符号采样值：

```text
sample = int16_le(payload[i], payload[i + 1])
```

保存 WAV 时使用标准 RIFF/WAVE 头即可。也可以先保存 `.pcm` 原始数据，后续用 16 kHz / mono / signed 16-bit little-endian 方式播放或转换。

## 6. App 建议流程

1. 扫描并连接戒指。
2. 查找录音 BLE Service、Write、Notify 特征。
3. 订阅 Notify。
4. 清空 App 端音频缓存。
5. 写入启动录音命令：`00 09 71 00 01`。
6. 收到 Notify 后，按第 4 节解析出 PCM payload 并追加到缓存。
7. 录制完成后写入停止命令：`00 09 71 00 00`。
8. 等待 200 到 500 ms 后停止接收，保存 WAV 或 PCM。
9. 用保存文件回放，确认音量、连续性和时长。

## 7. 采集周期/采集频率参数

本节为可选配置，不是 App 控制录音的必要条件。仅当 App 需要同时配置戒指通用采集周期时接入。

录音联调时，如果 App 还需要配置戒指的通用采集周期，可参考当前上位机“通用设置”里的采集周期命令。代码里的字段命名为 `AcquisitionCycle`，注释单位为秒 S。

### 7.1 设置采集周期

App 下发：

```text
00 1B 37 00 XX XX XX XX
```

字段拆解：

| 字节 | 值 | 说明 |
|---|---|---|
| 0 | `00` | Frame_type |
| 1 | `1B` | Frame_Id |
| 2 | `37` | Cmd，通用配置/采集周期 |
| 3 | `00` | Subcmd，设置采集周期 |
| 4..7 | `XX XX XX XX` | 采集周期，当前上位机按 UInt32 小端发送 |

上位机调用方式：

```text
CollectionCycleSetting(BitConverter.GetBytes(AcquisitionCyclenum))
```

因此 App 侧建议按 4 字节 little-endian 组包。例如设置采集周期为 60 秒：

```text
00 1B 37 00 3C 00 00 00
```

### 7.2 读取采集周期

App 下发：

```text
00 1B 37 01
```

字段拆解：

| 字节 | 值 | 说明 |
|---|---|---|
| 0 | `00` | Frame_type |
| 1 | `1B` | Frame_Id |
| 2 | `37` | Cmd，通用配置/采集周期 |
| 3 | `01` | Subcmd，读取采集周期 |

期望应答帧头：

```text
00 1B 37 01 ...
```

当前上位机读取后使用 `LessonData.DataToInt()` 解析，默认按前 2 字节 big-endian 转 Int16。但设置时又按 4 字节 little-endian 发送 UInt32，这里存在实现不完全一致的地方。App 联调时建议优先以固件最终协议为准；若固件沿用当前上位机设置逻辑，设置值按 4 字节 little-endian 发送。

### 7.3 常用采集周期示例

| 采集周期 | Data 小端字节 | 完整设置命令 |
|---|---|---|
| 1 秒 | `01 00 00 00` | `00 1B 37 00 01 00 00 00` |
| 5 秒 | `05 00 00 00` | `00 1B 37 00 05 00 00 00` |
| 10 秒 | `0A 00 00 00` | `00 1B 37 00 0A 00 00 00` |
| 30 秒 | `1E 00 00 00` | `00 1B 37 00 1E 00 00 00` |
| 60 秒 | `3C 00 00 00` | `00 1B 37 00 3C 00 00 00` |

## 8. 其他建议配置/读取参数

本节全部为可选参数，不影响 App 启动录音、停止录音和接收 PCM 数据。若当前目标只是测试录音功能，App 可以先不实现本节命令。

下面这些参数来自当前上位机“通用设置”和设备接口。它们主要用于调试记录、设备状态展示或后续扩展功能。

### 8.1 建议 App 接入的基础参数

| 功能 | App 下发命令 | Data 说明 | 应答/解析建议 |
|---|---|---|---|
| 时间同步 | `00 3F 10 00 + 9字节时间` | Data[0..7] 为 UNIX ms，little-endian；Data[8] 当前上位机固定 `00` | 应答帧头参考 `00 3F 10 00` |
| 读取戒指时间 | `00 41 10 01` | 无 | 应答 Data[0..7] 为 UNIX ms，little-endian；Data[8] 为时区小时 |
| 读取软件/固件版本 | `00 01 11 02` | 无 | 当前上位机按 UTF-8 字符串解析应答 Data |
| 读取硬件版本 | `00 03 11 02` | 无 | 当前上位机按 UTF-8 字符串解析应答 Data |
| 读取电量 | `00 05 12 00` | 无 | 应答 Data 建议按百分比 0..100 解析 |
| 读取充电状态 | `00 07 12 01` | 无 | Data[0]：`00` 未充电，`01` 充电中，`02` 已充满 |
| 电量推送开关/读取 | `00 07 12 02` | 无 | 当前上位机只发送命令并等待 Notify/应答 |
| 读取电量校准值 | `00 01 F2 43` | 无 | 工程/校准用途；App 常规录音可不接 |

### 8.2 时间同步 Data 说明

时间同步完整命令格式：

```text
00 3F 10 00 T0 T1 T2 T3 T4 T5 T6 T7 TZ
```

| 字段 | 说明 |
|---|---|
| T0..T7 | UNIX 毫秒时间戳，UTC 基准，little-endian |
| TZ | 时区小时，带符号单字节；当前上位机用保留模式固定发送 `00` |

示例：App 可直接取当前 UTC 时间 `DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()`，写成 8 字节 little-endian，再追加 `00`。

### 8.3 蓝牙名称/MAC 参数

| 功能 | App 下发命令 | Data 说明 | 示例 |
|---|---|---|---|
| 设置蓝牙名称 | `00 1D 37 03 + Data` | Data[0] 为名称 UTF-8 字节长度，Data[1..] 为名称 UTF-8 | 名称 Ring：`00 1D 37 03 04 52 69 6E 67` |
| 读取蓝牙名称 | `00 1D 37 04` | 无 | 应答 Data 按 UTF-8 字符串解析 |
| 读取蓝牙 MAC | `00 1D 37 0D` | 无 | 当前上位机将应答 Data 转成十六进制字符串显示 |

注意：上位机的蓝牙名称设置成功判断示例为应答去空格后等于 `0001370301`，但发送帧头为 `00 1D 37 03`。这里建议 App 以固件最终应答定义为准。

### 8.4 计步参数

| 功能 | App 下发命令 | Data 说明 | 应答/解析建议 |
|---|---|---|---|
| 读取当前步数 | `00 0F 35 00` | 无 | 当前上位机用 `DataToInt()` 解析前 2 字节 |
| 清除实时步数 | `00 11 35 01` | 无 | 应答帧头参考 `00 11 35 01` |

### 8.5 ADPCM/HID/触摸相关可选参数

| 功能 | App 下发命令 | Data 说明 | 建议 |
|---|---|---|---|
| ADPCM 音频传输控制 | `00 1C 71 01 + Data` | Data 由固件定义 | 若 App 只测试当前 PCM 录音，可先不接；若固件切到 ADPCM，需要补充 Data 定义 |
| HID 模式设置 | `00 2A 85 01 + Data` | Data 由固件定义 | 可选，和录音无直接依赖 |
| HID 模式读取 | `00 2A 85 02` | 无 | 可选 |
| HID 功能表读取 | `00 2A 85 03 + Data` | Data 由固件定义 | 可选 |
| Touch 压感推送 | `00 3A 84 03 + Data` | Data 由固件定义 | 可选 |

### 8.6 App 复合/工程操作

这些命令不建议在普通录音测试流程里自动调用，只在明确需要时人工触发。

| 功能 | App 下发命令 | 说明 |
|---|---|---|
| 蓝牙解绑 | `00 3B A0 03` | 会影响绑定状态，谨慎使用 |
| 船运模式 | `00 3B F2 05` | 设备可能进入低功耗/运输状态，谨慎使用 |
| 系统复位测试 | `00 3B F2 09` | 工程测试用途，谨慎使用 |
| PAH8151 PPG 工厂测试 | `00 3C F2 16` | 工厂测试用途 |

### 8.7 建议 App 录音联调初始化顺序

推荐最小流程：

1. 连接 BLE，发现 Write/Notify 特征。
2. 订阅 Notify。
3. 启动录音：`00 09 71 00 01`。
4. 接收并保存 PCM/WAV。
5. 停止录音：`00 09 71 00 00`。

可选增强流程：

1. 读取软件版本：`00 01 11 02`，用于记录固件版本。
2. 读取电量：`00 05 12 00`，避免低电量造成录音异常。
3. 时间同步：`00 3F 10 00 + 9字节时间`。
4. 按需要设置采集周期：`00 1B 37 00 + 4字节周期`。
5. 再执行最小录音流程。

## 9. 参考伪代码

```ts
const START_RECORD = [0x00, 0x09, 0x71, 0x00, 0x01];
const STOP_RECORD = [0x00, 0x09, 0x71, 0x00, 0x00];
const PAYLOAD_OFFSET = 10;
const SAMPLE_RATE = 16000;

pcmBuffer.clear();
subscribeNotify(notifyCharacteristic, onNotify);
writeWithoutResponse(writeCharacteristic, START_RECORD);

function onNotify(data: number[]) {
  if (data == null || data.length < PAYLOAD_OFFSET + 2) {
    return;
  }

  if (data[2] !== 0x71) {
    return;
  }

  const payloadLength = data[4] | (data[5] << 8);
  const available = data.length - PAYLOAD_OFFSET;

  if (payloadLength <= 0) {
    return;
  }

  if (payloadLength > available) {
    return;
  }

  if (payloadLength % 2 !== 0) {
    return;
  }

  const pcm = data.slice(PAYLOAD_OFFSET, PAYLOAD_OFFSET + payloadLength);
  pcmBuffer.append(pcm);
}

function stopAndSave() {
  writeWithoutResponse(writeCharacteristic, STOP_RECORD);
  delay(300);
  saveWav(pcmBuffer, SAMPLE_RATE, 1, 16);
}

function setAcquisitionCycle(seconds: number) {
  const data = uint32LittleEndian(seconds);
  const cmd = [0x00, 0x1B, 0x37, 0x00, ...data];
  writeWithoutResponse(writeCharacteristic, cmd);
}

function readAcquisitionCycle() {
  writeWithoutResponse(writeCharacteristic, [0x00, 0x1B, 0x37, 0x01]);
}

function syncTime(unixMsUtc: number) {
  const timeBytes = uint64LittleEndian(unixMsUtc);
  const timezone = [0x00];
  writeWithoutResponse(writeCharacteristic, [0x00, 0x3F, 0x10, 0x00, ...timeBytes, ...timezone]);
}

function setBluetoothName(nameUtf8Bytes: number[]) {
  const cmd = [0x00, 0x1D, 0x37, 0x03, nameUtf8Bytes.length, ...nameUtf8Bytes];
  writeWithoutResponse(writeCharacteristic, cmd);
}
```

## 10. 联调关注点

| 现象 | 排查建议 |
|---|---|
| 启动后没有数据 | 确认 Notify 已订阅成功；确认 Write 使用的是 Write Without Response；确认写入的是 `00 09 71 00 01` |
| 收到 Notify 但 App 不解析 | 检查 `data[2]` 是否为 `71`；检查 payload offset 是否仍为 `10` |
| 保存后播放噪声很大 | 确认按 16-bit little-endian 解析；确认采样率使用 16000 Hz；确认没有把前 10 字节包头写入 PCM |
| 播放速度异常 | 优先检查采样率，当前上位机默认 16000 Hz |
| 音频断续 | 统计 Notify 包序/时间间隔；检查手机端 BLE 回调线程是否阻塞；保存文件时不要在 Notify 回调里做重 IO |
| 采集周期设置后不生效 | 确认命令为 `00 1B 37 00`；确认周期值按 4 字节 little-endian 发送；确认单位按秒处理 |
| 读取采集周期解析异常 | 当前上位机设置/读取字节序实现不完全一致，需与固件确认返回 Data 的长度和大小端 |
| 时间同步后时间不对 | 确认 UNIX ms 按 UTC 计算；确认 8 字节 little-endian；当前上位机 TZ 固定发 `00` |
| 蓝牙名称设置失败 | 确认 Data 第 1 字节为 UTF-8 字节长度，不是字符数；中文名称长度要按 UTF-8 字节数计算 |
| 版本/电量无返回 | 先确认 Notify 已订阅；部分上位机方法只发送不阻塞等待，App 侧需要从 Notify 回调里统一收包 |

## 11. 与上位机实现对应关系

| 功能 | 上位机实现 |
|---|---|
| 启动录音按钮 | `StartFirmwarePdmAudio()` |
| 停止录音按钮 | `StopFirmwarePdmAudio()` / `StopAudioReceive()` |
| 启动命令 | `00 09 71 00 01` |
| 停止命令 | `00 09 71 00 00` |
| Notify 识别 | `data[2] == 0x71` |
| PCM 长度 | `data[4] | (data[5] << 8)` |
| PCM 起始偏移 | `10` |
| WAV 参数 | PCM / 16 kHz / mono / 16-bit little-endian |
| 设置采集周期 | `CollectionCycleSetting(BitConverter.GetBytes(AcquisitionCyclenum))` |
| 读取采集周期 | `CollectionCycleReading()` |
| 时间同步 | `TimeSynchronization()` / `BuildTimeDataNow_ReservedTZ()` |
| 读取戒指时间 | `ReadSmartRingTime()` |
| 读取软件版本 | `ReadSmartRingSoftwareVersionNumber()` |
| 读取硬件版本 | `ReadSmartRingHardwareVersionNumber()` |
| 读取电量 | `ReadSmartRingBatteryCapacity()` |
| 读取充电状态 | `ReadSmartRingBatteryChargingStatus()` |
| 设置蓝牙名称 | `BluetoothNameSetting(length + UTF8 bytes)` |
| 读取蓝牙名称 | `BluetoothNameReading()` |
| 读取蓝牙 MAC | `BluetoothMACReading()` |
| 读取/清除步数 | `Pedometer()` / `ClearRealTimeStepCount()` |
| ADPCM 控制 | `AdpcmControl(byte[] bytes)` |
| HID 控制 | `HIDModeSetting()` / `HIDModeReading()` / `HIDFuncationReading()` |
