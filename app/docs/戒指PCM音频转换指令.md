# 戒指 PCM 音频转换指令

本文档记录将录音戒指生成的 `.pcm` 音频文件转换为 `.mp3` 或 `.wav` 的最短命令。

## 1. 进入音频目录

```bash
cd /Users/spur/X/space/claudeV2/apps/recording2
```

## 2. PCM 转 MP3

转换 `1.pcm`：

```bash
ffmpeg -f s16le -ar 8000 -ac 1 -i ./1.pcm ./1.mp3
```

转换 `2.pcm`：

```bash
ffmpeg -f s16le -ar 8000 -ac 1 -i ./2.pcm ./2.mp3
```

一次性转换两个：

```bash
ffmpeg -f s16le -ar 8000 -ac 1 -i ./1.pcm ./1.mp3 && ffmpeg -f s16le -ar 8000 -ac 1 -i ./2.pcm ./2.mp3
```

## 3. PCM 转 WAV

转换 `1.pcm`：

```bash
ffmpeg -f s16le -ar 8000 -ac 1 -i ./1.pcm ./1.wav
```

转换 `2.pcm`：

```bash
ffmpeg -f s16le -ar 8000 -ac 1 -i ./2.pcm ./2.wav
```

一次性转换两个：

```bash
ffmpeg -f s16le -ar 8000 -ac 1 -i ./1.pcm ./1.wav && ffmpeg -f s16le -ar 8000 -ac 1 -i ./2.pcm ./2.wav
```

## 4. 参数说明

```text
-f s16le   PCM 数据格式
-ar 8000   采样率 8000 Hz
-ac 1      单声道
-i         输入文件
```

## 5. 输出结果

转换完成后会得到：

```text
1.mp3
2.mp3
1.wav
2.wav
```
