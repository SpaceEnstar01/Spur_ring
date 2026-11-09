# 完成硅谷 ECS 异步任务升级及 iPhone 1046 安装记录

日期：2026年11月07日（中国时间）。只记录实际执行结果；无密码、Token、私钥。

## 目标与实际结果

解决手机等待长任务约一分钟后连接中断、但云端仍完成任务的问题。现在 App 以 async:true 提交任务，服务立即202返回任务编号，App分次查询任务状态和持久化结果。

历史失败任务 b0069299-932e-47f8-b477-28d818173824 在云端实际运行140261毫秒、调用24次工具、exitCode=0。不能把手机连接中断等同云端执行失败。

## 实际顺序与命令

1. 本地镜像 spur-agent:research-async-v2 已构建。向 aed-acr-registry.cn-hangzhou.cr.aliyuncs.com/spur/spur-agent:research-async-v2 推送多次 context deadline exceeded，未完成本次ACR发布。
2. 改为Mac导出和直接SSH传输，上传714MB，用户日志显示33分38秒：

```bash
docker save spur-agent:research-async-v2 | gzip > /tmp/spur-research-async-v2.tar.gz
scp /tmp/spur-research-async-v2.tar.gz root@47.254.17.22:/root/spur-agent-upgrade/
```

3. ECS加载并检查：

```bash
docker load -i /root/spur-agent-upgrade/spur-research-async-v2.tar.gz
docker image inspect spur-agent:research-async-v2 --format 'ID={{.Id}} PLATFORM={{.Os}}/{{.Architecture}}'
```

ECS输出 ID=sha256:e727a45e3d91e9df95f64b11f7012bc7c2947e80cfe437c4f36d86204de180fc，PLATFORM=linux/amd64。本地导出包manifest配置ID与此一致；此前本地inspect的09af2dc1…不应直接充当ECS预期值。

4. 镜像只读检查：TASK_RESULTS_EXISTS=true、ASYNC_SUBMIT_PRESENT=true。
5. 隔离测试容器 spur-agent-async-v2-test：仅127.0.0.1:4188，tmpfs独立runtime，邮件自动摘要关闭，不挂正式数据卷；health200、authConfigured=true、emailConfigured=true。
6. 隔离真实模型验收：POST /api/creator-agent/chat 传requestId、async:true、message，SUBMIT_HTTP=202、ACCEPT_MS=38；任务59425cff-1e91-4c8a-b54d-8127158680e2，经GET /api/creator-agent/tasks/{id}取回finished及response，ASYNC_TASK_PASS。
7. 正式容器检查：UID10001:10001、bridge、127.0.0.1:4173→4173、unless-stopped、原seccomp、唯一数据卷spur-agent-ecs-runtime→/opt/spur/V2/web/.runtime。
8. 用户执行Python3.6兼容切换脚本：备份完整inspect和原环境变量（私有权限）、原seccomp；停止旧容器后tar备份数据卷；重命名旧容器；新容器复用原环境变量、端口、卷和安全配置。失败分支自动删除本次新容器并重新启动原容器。未修改Caddy或DNS。
9. 实际输出：PRODUCTION_HEALTH_OK、ASYNC_PRODUCTION_SWITCH_OK。

回滚容器：spur-agent-before-async-20261107-130338。
私有备份：/root/spur-agent-upgrade/spur-agent-before-async-20261107-130338。
其中environment.env、container.json及runtime.tar.gz可能包含敏感内容，不应分享或提交Git。

10. 正式公网 https://api.hispurring.com/api/creator-agent/chat 验收：HTTPS_SUBMIT_HTTP=202、ACCEPT_MS=59、任务06b6db9e-d912-414f-9f71-6eb64dbcbdb4，GET查询返回“HTTPS异步执行成功”，HTTPS_ASYNC_PASS。

## iPhone实际安装

产物：/tmp/spur-app-connections-build/Build/Products/Release-iphoneos/SuprRing.app。
codesign --verify --deep --strict 校验通过。

```bash
xcrun devicectl device install app --device 00008101-00014DA214FA001E /tmp/spur-app-connections-build/Build/Products/Release-iphoneos/SuprRing.app
xcrun devicectl device process launch --device 00008101-00014DA214FA001E --terminate-existing com.spur.recordingring
xcrun devicectl device info apps --device 00008101-00014DA214FA001E --filter "bundleIdentifier == 'com.spur.recordingring'"
```

首次安装因连接中断失败（CoreDeviceError3002 / IXRemoteErrorDomain6）；第二次安装成功并启动。设备查询实际显示Spur、com.spur.recordingring、1.0.2、1046。

## 代码与证据边界

- V2/web/server.mjs：202异步提交与任务查询。
- V2/web/task-results.mjs：结果原子保存及旧结果恢复。
- V2/appV2/app_mobile/src/services/creatorAgentApi.ts：短提交、轮询、同任务编号恢复，避免重复POST。
- V2/appV2/app_mobile/src/components/CompactAgentReply.tsx：首页摘要与详情安全区域。
- 既有本地测试：后端34项、手机13项；65秒模拟模型Linux容器测试通过，详情见同日接续文档。
- 本次公网任务是简单真实模型测试，不代表所有平台研究任务再次通过手机验收。
- 尚无持续两天、重启后恢复执行、App退出后自动恢复任务队列或APNs完成推送。本次实现的是异步请求和结果持久化。
