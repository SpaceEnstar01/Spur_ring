# V2 首轮迁移记录

日期：2026-10-28（Asia/Shanghai）。用户授权在 V2 内复制、整合和验证；要求完整复制 Harness，原工程不移动、不覆盖，不推送、不部署。

## 来源与目录

移动端已由用户放入 `V2/appV2/app_mobile`，配套 Java 在 `V2/appV2/app_server`。本轮保留该结构，没有再次移动。后端源自 `app/cloud/audio-agent`，复制到 `V2/cloud/audio-agent`；Agent 源自根 `agent`，复制到 `V2/agent`。

复制保留源码、原生 SDK、上游插件、vendored Cordis、示例、测试、配置模板、锁文件和许可证；排除嵌套 Git 历史、原 node_modules/Pods、编译输出、缓存、密钥文件、实际 .env、会话与业务运行数据。后续为 V2 独立安装的依赖放在各自目录，本机辅助工具位于被忽略的 `.tools/`。

Harness Git 跟踪项共 7903 项；7902 个可检查文件与源文件逐个 SHA-256 对比，没有缺失或内容变化，剩余为非普通文件项。结果见 `harness-source-audit.json`；初次复制清单见 `source-copy-manifest.json`。未修改复制后的 Harness 包源码。Spur 启动脚本改为使用 PATH，移除对旧机器 nvm 安装位置的硬依赖。

## App 改动

- 默认连接 `https://api.hispurring.com`，使用 V2 独立地址存储键；不继承旧 Java 地址，不从 Metro 自动推断后端端口。
- `chatApi.ts` 将现有 UI 调用适配到 `GET /health` 和 `POST /api/chat` 的原音频云端协议。保留用户选择的上下文与最近对话，响应读取 `message`，错误读取 `error`。
- 原后端没有 SSE，故只在完整回答成功后回调一次。不使用模拟打字，不声称已流式接入。取消、超时和错误不标记成功，不自动重复请求。
- Java Agent 保留为参考；`config/backend.ts` 禁止其请求和启动循环。旧设置也不会使录音被 Java 绑定截走。工作区入口明确标记尚未接入，用户仍可使用普通 AI 回复。
- 对应确认提示改为音频云端和模型服务，保留文字上传同意、单条处理和原有权限流程。
- 对话页原实现会自动附带全部本机笔记；V2 改为只附带当前打开的录音及关联笔记。普通聊天仅发送当前对话，未自动附带其他笔记。
- iOS `AppDelegate.swift` 和 `Info.plist` 加入单窗口 Scene 生命周期：窗口由 Scene 创建，保留 RN 工厂及链接处理，真机仍使用内嵌 bundle。未改戒指 SDK、鉴权或转码代码。
- `.xcode.env.local` 为本机 Node 配置，已忽略，不作为跨机器配置复制。

## V2 云端改动

- 依赖脚本使用 PATH 中的 Bun，不再写死 `$HOME/.bun/bin/bun`。
- 缺少模型密钥且未显式配置本地 Agent 命令时，明确返回配置错误，避免调用旧目录中不存在的 `scripts/dev.ts`。
- 添加本机模拟模型 HTTP 测试；生成独立 npm 锁文件。原 HTTP 聊天协议保持不变，无生产部署。

## 已完成验证

- App `npm ci` 独立安装成功；Node 20.20.2。
- TypeScript `tsc --noEmit`：通过。
- ESLint：通过，无警告。
- App Jest：26 组测试、179 项断言全部通过。包含接口协议、上下文、取消、超时、错误响应及 Java 隔离验证；保留的 Java 行为测试仅在测试中显式启用。
- V2 音频后端 Bun 打包：21 个模块通过。
- Bun 本地 HTTP 测试：5 项通过、13 项断言，使用本机模拟模型；覆盖正常响应、空输入、上游失败、空结果和未提供的 Java 接口。
- 现有公网 `GET /health` 返回 `{ok:true,service:"audio-agent"}`。只读健康检查，没有发送用户内容，没有调用付费模型。
- iOS Info.plist 与 shell 启动脚本静态检查通过。
- Metro Release iOS JS bundle 生成成功，约 2.8 MB，并导出 15 个资源文件；这不等于 Xcode 原生编译成功。

## 原生构建进度

当前系统 PATH 没有 CocoaPods，旧 `RecordingRing` 使用已有 Pods 成功，不意味着 V2 的 RN 0.82 依赖已经具备。系统 Ruby 2.6 访问 RubyGems 出现 TLS 超时和旧索引回退。现已在 `V2/.tools` 隔离安装 Homebrew 官方 portable Ruby 3.4.5（SHA-256 `20fa657858e44a4b39171d6e4111f8a9716eb62a78ebbd1491d94f90bb7b830a`）与 CocoaPods 1.16.2，安装成功，共 41 个 gem。

更新 Gemfile 中与现有 Podfile.lock 冲突的 xcodeproj 旧上限，并生成 Gemfile.lock；未改原工程工具链。`scripts/pod-install.sh` 自动选用隔离工具。默认 Maven 源曾回退源码构建，CocoaPods CDN 出现 TLS 错误。确认 Maven Central 官方重定向的 `repo.reactnative.dev/maven2` 可用，V2 安装脚本通过 RN 官方 `ENTERPRISE_REPOSITORY` 配置该入口，继续使用预编译包。

Xcode Scheme 的 Run 改为 Release，保留原签名配置。`scripts/build-ios-release.sh` 提供无签名编译，输出在被忽略的 `.build/ios`，不会安装或覆盖手机应用。

原生依赖已安装成功：80 个 Pods，CocoaPods 1.16.2。CDN 的蓝牙库元数据通过 CocoaPods 官方 GitHub API 缓存；未修改蓝牙版本或源码。官方 Maven 地址变更使 hermes-engine、React-Core-prebuilt、ReactNativeDependencies 的 podspec 来源校验值更新，版本仍为 0.82.1。第一次 `--deployment` 正确拦截该变化，确认只有来源校验变化后在 V2 中重新安装。原工程未改。

第一轮无签名编译被两个资源包的过低最低系统版本阻止（RNCAsyncStorage 13.4、RNSVG 12.4），Xcode 27 支持下限为 15.0。Podfile post_install 将低于 15.1 的生成目标提升至 App 既有 15.1 基线，不改 App 最低版本或硬件代码。Pods 重新生成成功，继续编译。

无签名 iOS Release 编译完成，退出码 0，日志包含 `BUILD SUCCEEDED`。产物位于 `V2/.build/ios/Build/Products/Release-iphoneos/SuprRing.app`，主二进制约 10 MB，内嵌 main.jsbundle 约 4.2 MB。日志在 `/private/tmp/spur-v2-ios-release.log`，临时文件可能被系统清理。此结果验证当前 V2 工程，不借用旧 RecordingRing 的验收。

无签名构建阶段尚未完成手机安装、首次启动或真实语音闭环；无签名包不能直接安装手机。已获准的可用模拟器设备列表为空；进一步检查模拟器运行时的授权被拒绝，未继续操作模拟器。后续启动验证另行记录。

## 后续验收与边界

先完成本工程 Pod 安装和 Release 构建，再验证设备启动、权限、本机识别及经用户明确提交的真实云端回复。当前 Bundle ID 沿用原应用，安装会更新旧应用，原始音频和数据恢复需要单独注意。初轮未安装手机；后续用户明确授权覆盖安装，已执行并确认首页正常，见下节。全程未卸载 App 或清空数据。

办公 UI、Harness 任务接入、意图/Matter/权限状态迁移、数据库持久化与线上发布均不属于已完成内容。Java 服务首版不启动。无需为了运行当前移动端另外安装 Java 或数据库。

## 后续：用户授权覆盖安装与真机启动

用户随后明确授权直接覆盖旧 App，并要求在 iOS 真机验证。使用同一 V2 workspace、SuprRing scheme、Release 配置和既有 Bi JingZhao 团队开发签名重新构建，退出码 0，`BUILD SUCCEEDED`。未修改 Bundle ID 或签名团队。

通过 Xcode 开发工具覆盖安装到连接的 eFLY（iPhone 12），bundle ID `com.spur.recordingring`；未卸载 App，未清空本机数据。安装回执成功。随后前台启动成功，PID 6564，复查进程持续存在，安装路径对应本轮 SuprRing.app。用户明确反馈“正常首页”，真机启动与首页展示验收通过。

正在请用户用测试语句验证“手机录音 → 本机转写 → 原云端 AI 回复”。当前未据启动成功声称录音、语音识别、云端模型或戒指已验收。真机安装覆盖了旧应用，是用户后续明确授权的操作，不改变原源码保留的边界。

日志：`/private/tmp/spur-v2-ios-signed-release.log`、`/private/tmp/spur-v2-device-install.json`、`/private/tmp/spur-v2-device-launch.json`、`/private/tmp/spur-v2-device-processes.json`。临时日志可能被系统清理。

### 意图台账与商业合作示范

按用户确认新增首批八种意图卡片与独立商业合作演示，沿用主工程云端文本接口，Java 仍不运行。详见 [INTENT-WORKSPACE-2026-10-28.md](INTENT-WORKSPACE-2026-10-28.md)，其中区分真实接入、示范能力、状态约束与验收范围。
