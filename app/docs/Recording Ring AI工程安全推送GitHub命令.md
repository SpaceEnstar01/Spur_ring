# Recording Ring AI 推送 GitHub 最短流程

## 本次采用的方式

没有直接推送原来的 `claudeV2` 工程，因为它属于另一个 Git 仓库，并包含大量无关文件。

本次采用：

1. 创建独立、干净的发布目录。
2. 复制 App、Android 原生代码、厂商 SDK、云端后端和相关文档。
3. 排除依赖、构建产物、录音数据及密钥。
4. 使用 GitHub CLI 浏览器登录。
5. 初始化新 Git 仓库并推送至 GitHub Private 仓库。

本地独立仓库：

```text
/Users/spur/Documents/New project/Recording_ring
```

GitHub 仓库：

```text
https://github.com/SpaceEnstar01/Recording_ring
```

## GitHub 安全登录

安装 GitHub CLI：

```bash
brew install gh
```

通过浏览器登录：

```bash
gh auth login --web
```

检查登录状态：

```bash
gh auth status
```

让 Git 使用 GitHub CLI 保存的安全凭据：

```bash
gh auth setup-git
```

此方式不需要在终端命令中填写或保存 GitHub Token。

## 初始化本地仓库

```bash
cd "/Users/spur/Documents/New project/Recording_ring"

git init -b main

git remote add origin \
https://github.com/SpaceEnstar01/Recording_ring.git
```

## 检查并提交

```bash
git status

git add .

git status

git commit -m "Initial release of Recording Ring AI"
```

## 首次推送

```bash
git push -u origin main
```

`-u` 会让本地 `main` 与远程 `origin/main` 建立跟踪关系。

## 后续更新

以后修改并确认代码后，只需执行：

```bash
cd "/Users/spur/Documents/New project/Recording_ring"

git status

git add .

git commit -m "Describe the update"

git push
```

## 本次过滤内容

未上传：

```text
node_modules/
.expo/
.gradle/
build/
*.apk
*.aab
.env
local.properties
uploads/
transcripts/
reports/
outputs/
录音测试数据
API Key、Token 和云端密钥
```

保留上传：

```text
app/
  React Native App
  Android 原生工程
  NativeModule
  厂商 AAR/JAR
  录音戒指 SDK

backend/
  阿里云 Bun 后端
  火山引擎语音转写
  DeepSeek 调用
  Recordings / AI Agent 双 Prompt

docs/
  Android 调试文档
  录音戒指 SDK 文档
  构建、安装和运行记录
```
