# V2 Agent 来源副本

本目录由主工程 `agent/` 复制，含完整 Harness 源码；原工程不改。首轮尚未连接新版 App，旧部署说明和运行记录仅供参考。当前范围与验证见 [V2 README](../README.md) 和 [迁移记录](../docs/MIGRATION-2026-10-28.md)。模型配置、依赖和运行数据独立准备。

---

# agent/

Spur 云端智能体：职责分层，少而稳。壁垒在轨迹 / 记忆 / 评测，不在上游框架名。

```text
agent/
├── runtime/      # 底座与主循环（可跑）
├── tools/        # 能干什么活
├── memory/       # 越来越懂你
├── trajectory/   # 每次任务的账本
├── eval/         # 证明越来越强
├── gateway/      # App/戒指怎么打进来
├── deploy/       # 怎么上阿里云
└── docs/         # 仅本系统的设计说明
```

建造顺序：先让 `runtime` + `gateway` 能转；`tools` 从现有 audio-agent 能力迁入；`trajectory` 尽早有 schema；`memory` / `eval` 有真实回写后再加深。
