# iOS 录音同步最短步骤

## 结论

已验证：BLE 拉文件 → `Documents/Audio/*.opus` → Opus→M4A → `Documents/voice-recordings/*.m4a`，可播、时长 > 0。

**不要改连接鉴权**（见 `iOS戒指连接最短步骤.md`）。

## 流程

```text
syncVoiceRecordings / fetchLargeAudioFile
  → SDK 写入 Documents/Audio/*.opus
  → AllSuccess / Empty（不依赖 SingleSuccess）
  → 筛出尚无同名 m4a/ogg 的 Opus
  → VoiceRecordingTranscoder（16 字节小端头 → Opus 帧 → AAC/M4A）
  → Documents/voice-recordings/*.m4a
  → yanqiangVoiceFileReady；JS 认 .m4a / .ogg
```

## 要点

1. **进度只报进度，不落盘。**
2. **禁止** `convertOpusToOggDefaultPath`（产出坏 OGG，0 秒不可播）。
3. Opus 前 **16 字节自定义头**（版本、采样率、声道、帧时长、帧字节、码率），其后定长 Opus 帧。
4. 转码用系统 `AVAudioConverter`；失败不留半成品。

## 关键源码

| 文件 | 作用 |
|------|------|
| `native-sdk/ios/YanqiangVoiceModule.m` | 同步收尾：扫描 Opus → 调转码 → 发 fileReady |
| `native-sdk/ios/VoiceRecordingTranscoder.swift` | Opus → M4A（自 DreameRing `feature/recording`） |
| `native-sdk/ios/VoiceRecordingFileSelector.swift` | 待转码 Opus 筛选 |
| `native-sdk/ios/YanqiangVoiceOpusBridge.swift` | ObjC ↔ Swift 桥 |
| `src/services/localAudioLibrary.ts` | 列表认 `.m4a` / `.ogg` |

参考：`app/test/docs/DreameRing录音同步逻辑速查.md`
