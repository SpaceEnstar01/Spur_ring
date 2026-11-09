# Spur V2 集成工程

新版移动端 UI + 原 audio-agent 云端 + 完整 Harness 源码。所有整合改动位于 V2；原 `app/`、`agent/`、`desktop/` 不修改，未部署或推送。

```text
V2/
  appV2/app_mobile/          React Native 0.82.1 新版 App
  web/                       Spur Creator 网页对话入口
  appV2/app_server/          Java 原实现，仅作参考，首版不启动
  cloud/audio-agent/        从主工程复制的 Bun 音频后端
  agent/                    原 Agent、办公工具和完整 Harness 源码
  docs/                     迁移记录、接口及验收边界
  scripts/                  本地检查入口
```

网页端源码位于 `web/`，目前提供本地响应式聊天界面。DeepSeek Harness 是主要执行层，NanoMuse 能力通过独立插件/服务按需接入；当前聊天 API 尚未接通，模型密钥必须保留在服务端。产品边界和阶段见 `docs/CREATOR-WEB-ARCHITECTURE.md`。

## 第一版范围

启动 → 手机录音 → iPhone 本机识别 → 经用户同意将文字发送到原音频云端 → 在录音详情和对话页展示 AI 回复。

默认云端为 `https://api.hispurring.com`，App 设置可以修改。Debug 构建也默认使用该地址，只有明确的 `SUPR_API_URL` 构建设置或 App 设置才切换到本地服务。V2 使用独立的服务地址存储键，不沿用旧 Java 地址；同一 Bundle ID 的其他本机资料仍可能共享。

原音频云端返回完整 JSON，首版显示等待状态，收到完整回答后显示内容，不使用 Java SSE 接口或模拟逐字输出。选中的本地上下文和最近 20 条对话封装成一个消息发送，不上传音频、不自动附带其他历史录音。

意图工作区、Matter、长期记忆及 Java 云端动作尚未接入。相关入口明确提示不可用，并在请求层禁用 `/api/agent/*`；保留原实现供后续逐项整合。保留既有本机闹钟和硬件代码，未将其视为云端业务闭环。

## 移动端

需要 Node 20+、Xcode 和 CocoaPods。使用本工程自己的依赖，不能使用旧 Expo 工程的 Pods。

```bash
cd /Users/x/X/space/spur/V2/appV2/app_mobile
npm ci
cd ../..
./scripts/pod-install.sh
open appV2/app_mobile/ios/SuprRing.xcworkspace
```

本机若没有全局 CocoaPods，检查脚本会使用 V2 内已安装的隔离 Ruby/CocoaPods；其他机器仍需准备工具。

Xcode 选择 `SuprRing` 和目标设备。Run 默认 Release，内嵌 JS，不需要 Metro；模拟器 Debug 需要从移动端目录运行 `npm start`。签名仍保留既有配置；安装前注意 Bundle ID 与旧 App 相同，安装 V2 会更新该应用，不会并存。用户后续已明确授权覆盖，V2 已签名覆盖安装到 eFLY，用户确认首页正常；未卸载 App 或清空数据。录音和真实云端回复仍在验收。

原生入口已适配 Scene 生命周期，保留 React Native 工厂初始化及冷启动链接。实际构建与真机验收结果以迁移记录为准，不能将旧 `RecordingRing` 的编译成功视为本项目成功。

## 本地音频后端（可选）

App 连接已有云端时，无需本地 Java、数据库或 Bun。若要运行 V2 后端，需要 Bun：

```bash
cd /Users/x/X/space/spur/V2/cloud/audio-agent
bun install
# 独立配置 .env，可依据 .env.example；不复制原工程密钥。
bun run dev
```

默认端口 8787；聊天需要单独配置 `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL` 和 `DEEPSEEK_MODEL`。没有模型密钥且未显式指定本地 Agent 命令时，返回配置错误，不尝试运行不存在的旧目录脚本。云端转写默认 mock，仅本轮 App 的 iPhone 本机识别路径已纳入复现范围。

## Harness 与办公

完整源码在 `agent/runtime/deepseek-harness`，包括插件、vendored Cordis、测试、示例、锁文件和许可证；不包含 `.git` 历史、原 node_modules、编译输出和会话数据。

Harness 需要 Node 22.19+ 或 24+，以及 pnpm 11.7.0，和移动端 Node 20 环境分开准备。先按其 package.json 安装并构建，再运行 `agent/runtime/spur-profile/run-web.sh`。V2 启动脚本使用 PATH，不要求旧机器的 nvm 目录。模型与办公插件配置在 `cordis.patch.yml`；替换模型需同步配置和独立环境参数。

办公网关在 `agent/gateway`，复用 `agent/tools/pdf` 与 `agent/tools/pptx`。它仍是独立的固定出件流程，不代表已接入 App，也不等于通过 Harness 执行。PDF 还需要 Chrome/Chromium。原目录 README、部署手册作为来源快照保留，旧绝对路径和操作命令不应直接执行。

## 检查

```bash
./scripts/check-mobile.sh
./scripts/build-ios-release.sh # 无签名编译，不安装手机
cd cloud/audio-agent
bun test tests
```

后端测试仅使用本机模拟模型，无真实录音和付费请求。完整进度见 `docs/MIGRATION-2026-10-28.md`，逐页能力对应见 `docs/UI-INTEGRATION-MAP.md`。
