# 打通 https://api.hispurring.com 实录（极简）

> 完成日期：2026-08-09  
> 服务器：阿里云 ECS `8.217.122.71`（Alibaba Cloud Linux 8）  
> 后端：本机 `bun` 监听 `*:18987`（audio-agent）

## 最终结果

```text
Internet → Nginx:443 (HTTPS) → 127.0.0.1:18987
```

验收：

```bash
curl -sS https://api.hispurring.com/health
# {"ok":true,"service":"audio-agent",...}
```

App 生产 API 根地址：`https://api.hispurring.com`

---

## 分工

| 谁 | 做什么 |
|----|--------|
| 同事 | DNS：`api.hispurring.com` A 记录 → `8.217.122.71` |
| 你（有服务器权限） | 安全组放行 80/443；装 Nginx；申请证书；反代到 18987 |

---

## 实际步骤（按顺序）

### 1. DNS（同事已完成）

```bash
dig +short api.hispurring.com
# 期望：8.217.122.71
```

### 2. 确认后端

Workbench：

```bash
ss -ltnp | grep 18987
curl -sS http://127.0.0.1:18987/health
```

### 3. 安全组放行

阿里云控制台 → ECS 安全组入方向，各加一条（或等价）：

- TCP **80**（授权 `0.0.0.0/0`）
- TCP **443**（授权 `0.0.0.0/0`）

未放行时外网访问会 timeout；放行后 HTTP 反代先通。

### 4. 安装 Nginx（本机是 dnf，不是 apt）

```bash
dnf install -y nginx certbot python3-certbot-nginx
systemctl enable --now nginx
```

### 5. 先配 HTTP 反代

```bash
cat >/etc/nginx/conf.d/api.hispurring.com.conf <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name api.hispurring.com;

    client_max_body_size 100m;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;

    location / {
        proxy_pass http://127.0.0.1:18987;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

nginx -t && systemctl reload nginx
```

Mac 验收 HTTP：

```bash
curl -sS http://api.hispurring.com/health
# 200 + {"ok":true,...}
```

说明：`curl -I`（HEAD）可能 404，用 GET 测。

### 6. 申请证书（Workbench 交互输入会编码报错，用非交互）

`certbot --nginx` 在 Workbench 里输入邮箱曾出现：

```text
UnicodeDecodeError: 'utf-8' codec can't decode byte ...
```

改用：

```bash
systemctl stop nginx

certbot certonly --standalone -d api.hispurring.com \
  --email 你的邮箱@example.com \
  --agree-tos \
  --no-eff-email \
  --non-interactive

systemctl start nginx
```

证书路径：

```text
/etc/letsencrypt/live/api.hispurring.com/fullchain.pem
/etc/letsencrypt/live/api.hispurring.com/privkey.pem
```

### 7. 写入 HTTPS 站点并 reload

```bash
cat >/etc/nginx/conf.d/api.hispurring.com.conf <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name api.hispurring.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.hispurring.com;

    ssl_certificate     /etc/letsencrypt/live/api.hispurring.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.hispurring.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;

    client_max_body_size 100m;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;

    location / {
        proxy_pass http://127.0.0.1:18987;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

nginx -t && systemctl reload nginx
```

### 8. HTTPS 验收（Mac）

```bash
curl -sS https://api.hispurring.com/health
```

---

## App 侧

`app/mobile/src/config/api.ts` 生产地址：

```text
https://api.hispurring.com
```

---

## 建议收尾（可选）

1. `/opt/audio-agent/.env` 中 `AUDIO_AGENT_PUBLIC_BASE_URL=https://api.hispurring.com`，重启 bun  
2. 安全组去掉公网 **18987**，只保留 80/443  

---

## 关键踩坑

| 现象 | 原因 / 处理 |
|------|-------------|
| 443/80 timeout | 安全组未放行 |
| `apt` 装不上 | 系统是 Alibaba Cloud Linux 8，用 `dnf` |
| Certbot 交互 UnicodeDecodeError | Workbench 编码问题 → `certonly --standalone --non-interactive` |
| `curl -I` 得到 404 | 用 GET：`curl -sS https://.../health` |
