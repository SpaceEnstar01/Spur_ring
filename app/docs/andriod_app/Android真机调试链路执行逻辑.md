# Android 真机调试链路执行逻辑

这条链路可以理解成：

Android Studio 负责把“壳”装到手机上，Metro 负责把“页面代码”发给手机，`adb reverse` 负责让手机能找到你电脑上的 Metro。

## 1. 整体流程

```text
Android Studio
   ↓
把 RN/Expo Dev Client App 安装到手机
   ↓
手机打开 App
   ↓
App 需要加载 JS 页面代码
   ↓
通过 http://127.0.0.1:8081 找 Metro
   ↓
adb reverse 把手机的 127.0.0.1:8081 转发到电脑的 8081
   ↓
Metro 把 RN JS 包发给手机
   ↓
手机渲染页面
```

## 2. 各环节作用

| 环节 | 作用 | 没做好会怎样 |
|---|---|---|
| Android Studio | 编译 Android 原生工程，把 App 安装到手机 | App 装不上，或者启动就崩 |
| Metro | RN 的 JS 开发服务器，实时打包 `App.tsx/src` 代码 | 手机打开 App 但拿不到页面代码 |
| `adb reverse tcp:8081 tcp:8081` | 让手机访问自己的 `127.0.0.1:8081` 时，其实访问电脑的 Metro | 手机提示连接失败 |
| Node 环境 | Metro 和 Expo/Gradle 脚本都依赖 Node | Metro 启不来，或 Android Studio 构建时报 `node` 找不到 |

## 3. 为什么手机输入 127.0.0.1

手机 App 里输入：

```text
http://127.0.0.1:8081
```

因为对手机来说，`127.0.0.1` 原本是“手机自己”。

但执行：

```bash
adb reverse tcp:8081 tcp:8081
```

之后，手机访问自己的 `8081`，会被 USB 转发到 Mac 的 `8081`，也就是 Metro。

## 4. 正确执行顺序

### 1. Android Studio Run

先用 Android Studio 把 App 壳安装到手机。

### 2. 启动 JS 服务

```bash
cd /Users/spur/X/space/claudeV2/app_front/app_RN
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
npx expo start --dev-client --clear --localhost --port 8081
```

### 3. USB 端口转发

另开一个终端：

```bash
adb reverse tcp:8081 tcp:8081
```

### 4. 手机输入 URL

```text
http://127.0.0.1:8081
```

## 5. 一句话总结

Android Studio 装 App，Metro 提供页面代码，`adb reverse` 把手机和电脑的 8081 接起来，Node 保证这些打包脚本能跑。
