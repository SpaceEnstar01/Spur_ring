# Spur_ring 推送 GitHub 最短指令

仓库：https://github.com/SpaceEnstar01/Spur_ring  
本地根目录：`/Users/spur/X/space/spur`

## 1. 登录（仅首次 / token 失效时）

```bash
gh auth login --web
gh auth status
gh auth setup-git
```

token 失效时：

```bash
gh auth refresh -h github.com
```

## 2. 日常更新并推送

```bash
cd /Users/spur/X/space/spur

git status
git add .
git status
git commit -m "Describe the update"
git push
```

## 3. 首次初始化（已完成，仅作记录）

仓已建好且本地已关联时，一般不必再跑。若换电脑重做：

```bash
cd /Users/spur/X/space/spur

git init -b main
git remote add origin https://github.com/SpaceEnstar01/Spur_ring.git
git add .
git commit -m "Initial import of Spur_ring app for clone-and-build on Android and iOS."
git push -u origin main
```

## 4. 另一台电脑拉取编译

```bash
git clone https://github.com/SpaceEnstar01/Spur_ring.git
cd Spur_ring/app/mobile
npm install
```

Android：

```bash
npm run android
# 或
cd android && ./gradlew :app:assembleRelease
```

iOS（需 Mac + Xcode）：

```bash
cd ios && pod install && cd ..
npm run ios
```

## 注意

- 不要提交：`node_modules`、`build`、`Pods`、`.env`、`local.properties`、`app/archive`、uploads 运行数据。
- `desktop/`、`hardware/` 当前只占位，本地大文件被 `.gitignore` 排除。
- 目标说明见同目录：`spur-private-repo-upload-目标.md`。
