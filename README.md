# Spur_ring

Spur 录音戒指 Private 主仓：可编译的 App（Android / iOS）+ 云端音频 Agent + 文档。

## 目录

```text
spur/
├── app/          # 主交付：mobile + cloud + web + docs
├── desktop/      # 占位（桌面端后续）
├── hardware/     # 占位（固件后续）
├── README.md
└── .gitignore
```

## 快速开始（App）

```bash
cd app/mobile
npm install
```

### Android

```bash
npm run android
# 或
cd android && ./gradlew :app:assembleRelease
```

本机需安装 Android SDK；`local.properties` 由本机生成，勿提交。

### iOS（需 Mac + Xcode）

```bash
cd ios && pod install && cd ..
npm run ios
# 或用 Xcode 打开 ios/RecordingRing.xcworkspace
```

### 云端

```bash
cd app/cloud/audio-agent
cp .env.example .env   # 填写密钥后启动
```

上传目标与验收说明见 `app/docs/github/spur-private-repo-upload-目标.md`。
