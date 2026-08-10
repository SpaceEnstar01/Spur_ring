# 请协助：为 App 配置 API 域名 + HTTPS

App Store 上架要求：App **不能**再直接访问 `http://8.217.122.71:18987`，必须改成带 HTTPS 的域名。

我们不新买域名，用现有 **hispurring.com** 增加一个 API 子域名即可。

---

## 目标结果

浏览器或 curl 能访问（示例）：

```bash
curl -I https://api.hispurring.com
```

并且请求会转到现有后端：

```text
客户端 → https://api.hispurring.com  →  (TLS)  →  服务器反代  →  127.0.0.1:18987（或本机 audio-agent）
```

App 最终使用的地址：

```text
https://api.hispurring.com
```

（路径仍是原来的，例如 `/api/audio-task`）

---

## 任务清单

### 1. DNS（在 hispurring.com 的 DNS 面板）

新增一条记录：

| 类型 | 主机记录 | 记录值 | 说明 |
|------|----------|--------|------|
| A | `api` | `8.217.122.71` | 即 `api.hispurring.com` → 该服务器 |

- 若官网已在 Cloudflare 等代理，`api` 建议先 **DNS only（灰云）**，证书由服务器自己签（Let’s Encrypt）更省事；若要用 Cloudflare 代理再另说。
- 生效后本机可查：`dig api.hispurring.com` 或 `nslookup api.hispurring.com`，应返回 `8.217.122.71`。

### 2. 服务器 HTTPS 反代（登录 `8.217.122.71`）

在服务器上用 **Caddy** 或 **Nginx** 任选其一即可。

#### 方案 A：Caddy（推荐，自动证书）

安装 Caddy 后，示例 Caddyfile：

```caddy
api.hispurring.com {
    reverse_proxy 127.0.0.1:18987
}
```

说明：
- 假定 audio-agent 已在该机监听 `18987`
- 若服务只绑在公网 IP 端口、未听 localhost，把 `127.0.0.1:18987` 改成实际地址（例如 `127.0.0.1:18987` 或进程所在端口）
- Caddy 会自动申请 Let’s Encrypt 证书（需 80/443 入站开放）

#### 方案 B：Nginx + Certbot

1. Nginx server 块：`server_name api.hispurring.com;`，`proxy_pass http://127.0.0.1:18987;`
2. `certbot --nginx -d api.hispurring.com` 申请证书
3. 开放防火墙 **80 / 443**

上传大文件（音频）时建议加大：

```nginx
client_max_body_size 100m;
proxy_read_timeout 300s;
proxy_send_timeout 300s;
```

### 3. 防火墙 / 安全组

云厂商控制台确认入站放行：

- `80/tcp`（申请/续期证书）
- `443/tcp`（HTTPS）

`18987` **不必**对公网开放（仅本机反代访问更安全）；若暂时仍对外开放也可以，但不作为 App 入口。

### 4. 验收（做完请跑一遍）

```bash
# 1) DNS
dig +short api.hispurring.com
# 期望：8.217.122.71

# 2) HTTPS 通
curl -I https://api.hispurring.com

# 3) 业务接口（按你们现有 API 测）
curl -I https://api.hispurring.com/api/audio-task
# 或用现有能成功的测试方式打同一个 path
```

期望：HTTPS 证书有效、不是明文 IP、能转到 18987 上的服务（不要 502 一直挂）。

---

## 做完请回我的信息

1. 最终 API 根地址确认：`https://api.hispurring.com`（若改成别的子域名请说明）
2. DNS 面板是哪家（阿里云 / Cloudflare / 其他）
3. 用的是 Caddy 还是 Nginx
4. 上面 3 条验收命令的结果（可截图或粘贴）

---

## 不需要做

- 不用改 iOS/Android 工程（我们这边改 App 配置）
- 不用动官网首页 UI
- 不需要再买新域名

---

## 背景（一句话）

苹果要求生产环境走 HTTPS；现有后端是 `8.217.122.71:18987` 的 HTTP。给 `hispurring.com` 加 `api` 子域名 + 反代，App 即可使用 `https://api.hispurring.com`。
