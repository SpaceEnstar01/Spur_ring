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

## 2. VPN 代理（push 卡住 / `Empty reply from server` 时）

VPN 已开 ≠ Git 能连 GitHub。须确认 **HTTP 代理端口** 在监听，且 `git config` 里的端口与 Clash Verge 等客户端一致（常见 **7897**，不一定是 7890）。

```bash
git config --global http.proxy http://127.0.0.1:7897
git config --global https.proxy http://127.0.0.1:7897
git config --global http.version HTTP/1.1
git config --global http.postBuffer 524288000
```

验证代理是否通（应返回 `HTTP/2 200` 或 `HTTP/1.1 200`）：

```bash
curl -x http://127.0.0.1:7897 -I https://github.com
```

若 `Couldn't connect to 127.0.0.1 port 7890`，说明端口写错了。查本机实际监听端口（Clash Verge / verge-mih 等）：

```bash
lsof -iTCP -sTCP:LISTEN -P | grep -E 'verge|Clash|789'
```

看到例如 `localhost:7897 (LISTEN)` 后，把上面 `git config` 和 `curl -x` 里的端口改成 **7897**（或你机器上的实际端口），再 `git push`。

取消代理（在稳定网络 / 不需要 VPN 时）：

```bash
git config --global --unset http.proxy
git config --global --unset https.proxy
```

## 3. 日常更新并推送

```bash
cd /Users/spur/X/space/spur

git status
git add .
git status
git commit -m "Describe the update"
git push
```

## 4. 首次初始化（已完成，仅作记录）

仓已建好且本地已关联时，一般不必再跑。若换电脑重做：

```bash
cd /Users/spur/X/space/spur

git init -b main
git remote add origin https://github.com/SpaceEnstar01/Spur_ring.git
git add .
git commit -m "Initial import of Spur_ring app for clone-and-build on Android and iOS."
git push -u origin main
```

## 5. 另一台电脑拉取编译

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
