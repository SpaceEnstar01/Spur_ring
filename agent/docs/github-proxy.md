# GitHub 网络

浏览器能开 GitHub、终端 `git`/`curl` 失败时：本机代理是 `127.0.0.1:7897`，终端默认不走它。

当前 shell 执行后再 `git fetch` / `git clone`：

```bash
export https_proxy=http://127.0.0.1:7897
export http_proxy=http://127.0.0.1:7897
```

不写入全局 git config。新开终端需再 export 一次。
