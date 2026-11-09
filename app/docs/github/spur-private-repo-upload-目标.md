# Spur Private 仓上传目标

> 状态：已口头确认，待执行上传。  
> 仓库形态：GitHub **Private** 单仓 `spur`。

## 目标仓库结构

```text
spur/
├── app/          # 主交付：mobile + cloud + web + docs
├── desktop/      # 空着（占位，现有不完整代码暂不上传）
├── hardware/     # 空着（大文件固件暂不上传）
├── README.md
└── .gitignore
```

## 核心目标

别人（含另一台电脑 / Mac）可以：

```text
git clone → cd app/mobile → npm install
  → Android 能编译部署
  → iOS 能编译部署
```

只认真上传并维护 `app/`；`desktop/`、`hardware/` 先空目录占位。

## `app/mobile` 必须进仓（双端编译必需）

| 保留内容 | 作用 |
|----------|------|
| `src/`、`App.tsx`、`package.json`、`app.json`、锁文件等 | JS/TS 业务与依赖声明 |
| `android/` 源码 + `android/app/libs/*.aar`（及 jar） | Android 原生工程 + 厂商 SDK |
| `ios/` 工程（`Podfile`、`Podfile.lock`、`*.xcodeproj`、`*.xcworkspace`、原生源码等） | iOS 原生工程 |
| `native-sdk/`（含 `RingSDK.framework`、`AB_FOTA.framework`、podspec 等） | iOS 厂商 SDK（Podfile 已引用） |

同时建议保留：

- `app/cloud/audio-agent` 源码（不含运行数据）
- `app/web/`
- `app/docs/`（去掉明文密钥后再上传）

## 不进仓（本地生成 / 过大 / 非主路径）

| 排除 | 原因 |
|------|------|
| `**/node_modules/` | `npm install` 生成 |
| `**/android/**/build/`、`.gradle/` | 本地编译产物 |
| `android/local.properties` | 本机 SDK 路径 |
| `**/ios/Pods/`、`**/ios/build/` | `pod install` / Xcode 生成 |
| `**/.expo/` | 本地缓存 |
| `*.apk`、`*.aab` | 构建产物 |
| `app/archive/` | 旧 RN 参考工程，非主开发 |
| `cloud/**/uploads/`、`transcripts/`、`reports/`、`outputs/` | 运行/测试数据 |
| `hardware/` 现有大文件（含 `backup_code`、`bcl603s2x` 等） | 体积大，本次空目录 |
| `desktop/` 现有内容 | 尚未完成，本次空目录 |
| `.env` 及真实密钥 | 安全；只保留 `.env.example` |

## 上传前必须处理的问题

1. **`app/mobile/.gitignore` 不能忽略整个 `android/`、`ios/`**  
   否则原生工程与厂商 SDK 进不了仓，clone 后无法编译。应只忽略构建产物。

2. **去掉嵌套 Git**  
   `app/web/Recording-H5/.git` 会导致父仓异常，推送前删除该嵌套 `.git`。

3. **清理文档中的明文密钥**  
   例如 `app/docs/最短执行指令.md` 中的 SMTP 密码等，改为占位符；已泄露的密钥建议轮换。

## 另一台机器的预期编译流程

### Android

```bash
git clone <private-spur-repo>
cd spur/app/mobile
npm install
npm run android
# 或
cd android && ./gradlew :app:assembleRelease
```

本机需已安装 Android SDK；`local.properties` 由本机生成，不提交。

### iOS（需 Mac + Xcode）

```bash
git clone <private-spur-repo>
cd spur/app/mobile
npm install
cd ios && pod install
cd ..
npm run ios
# 或用 Xcode 打开 ios/RecordingRing.xcworkspace
```

`Pods` 不进仓，由 `pod install` 根据 `Podfile` / `Podfile.lock` 与 `native-sdk` 恢复。

### 云端（可选）

```bash
cd spur/app/cloud/audio-agent
cp .env.example .env   # 自行填写密钥
# 按该目录 README 启动
```

## 仓库策略说明

- **一个 Private 仓**，不拆 `spur-app` / `spur-hardware`。
- 不以整仓 4GB+ 原样上传；清理后以可编译的 `app/` 为主。
- 可新建 Private 仓 `spur`，避免把历史垃圾叠进旧的 `Recording_ring` 仓库历史。
- 推送前需有效的 GitHub 登录（当前若 `gh` token 失效，先 `gh auth refresh`）。

## 验收标准

- [ ] Private 仓 `spur` 结构符合上文目录约定
- [ ] `desktop/`、`hardware/` 为空占位（或仅空目录 + 说明）
- [ ] clone 后 Android：`npm install` → 能编出可安装包
- [ ] clone 后 iOS：`npm install` → `pod install` → 能编 / 真机或模拟器运行
- [ ] 仓库中无 `node_modules`、无大体积 build/Pods、无 `archive`、无 uploads 运行数据
- [ ] 仓库中无明文 API Key / SMTP 密码等密钥
