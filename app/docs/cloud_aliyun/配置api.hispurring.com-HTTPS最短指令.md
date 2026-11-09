# 在阿里云服务器配置 api.hispurring.com HTTPS（你来做）

前提：同事已把 DNS `api.hispurring.com` → `8.217.122.71`（已确认）。  
你在 **阿里云 Workbench** 登录该机器执行下面步骤。

---

## 0. 先开安全组（阿里云控制台，不是 Workbench 里）

对该 ECS 安全组入方向放行：

| 端口 | 协议 | 说明 |
|------|------|------|
| 80 | TCP | Let’s Encrypt 申请证书 |
| 443 | TCP | HTTPS |

保存后再继续。不放行会一直超时。

---

## 1. Workbench：确认后端还在

```bash
curl -sS http://127.0.0.1:18987/health
```

期望有类似：`{"ok":true,...}`  
若失败，先按《阿里云音频后端最短运行指令》把 `bun` 服务拉起来。

---

## 2. 安装 Caddy（自动 HTTPS，推荐）

Debian/Ubuntu 常见装法：

```bash
sudo apt update
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

若系统不是 Debian/Ubuntu，把 `cat /etc/os-release` 结果发我，换对应安装方式。

---

## 3. 写入反代配置

```bash
sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
api.hispurring.com {
	encode gzip
	reverse_proxy 127.0.0.1:18987 {
		transport http {
			read_timeout 300s
			write_timeout 300s
		}
	}
}
EOF
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

第一次会自动申请 Let’s Encrypt 证书（需 80/443 已放行、DNS 已生效）。

---

## 4. 改后端对外地址（可选但建议）

```bash
cd /opt/audio-agent
nano .env
```

把：

```env
AUDIO_AGENT_PUBLIC_BASE_URL=http://8.217.122.71:18987
```

改成：

```env
AUDIO_AGENT_PUBLIC_BASE_URL=https://api.hispurring.com
```

然后重启：

```bash
pkill -f '^bun run src/server.ts$'
cd /opt/audio-agent
nohup bun run src/server.ts >/var/log/audio-agent.log 2>&1 &
curl -sS http://127.0.0.1:18987/health
```

---

## 5. 本机 Mac 验收（你电脑终端）

```bash
dig +short api.hispurring.com
curl -I --connect-timeout 10 https://api.hispurring.com/health
curl -I --connect-timeout 10 https://api.hispurring.com/api/audio-task
```

成功标志：
- DNS 仍是 `8.217.122.71`
- `https://.../health` 返回 **200**（或服务真实 health 状态），**不再 timeout**
- 证书有效（浏览器打开也不报警）

可选完整上传测（有测试音频时）：

```bash
curl --max-time 300 \
  -F "audio=@/path/to/test.wav;type=audio/wav" \
  -F "taskType=recording_summary" \
  https://api.hispurring.com/api/audio-task
```

---

## 常见失败

| 现象 | 处理 |
|------|------|
| Mac 上 443 timeout | 安全组没开 80/443，或 Caddy 没起来：`sudo systemctl status caddy` |
| 证书申请失败 | DNS 未生效、80 被挡、或域名指错 IP |
| 502 Bad Gateway | 18987 后端没开：先 `curl http://127.0.0.1:18987/health` |
| 413 / 上传中断 | 已在 Caddy 里放宽 timeout；仍失败把报错发我 |

---

## 做完后告诉我

把这三条输出贴回来即可：

```bash
dig +short api.hispurring.com
curl -I --connect-timeout 10 https://api.hispurring.com/health
sudo systemctl is-active caddy
```

我再帮你确认 App 配置并继续上架下一步。
