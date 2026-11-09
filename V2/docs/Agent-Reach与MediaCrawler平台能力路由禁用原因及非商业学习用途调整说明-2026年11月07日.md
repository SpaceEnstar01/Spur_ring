# Agent-Reach 与 MediaCrawler 平台能力及学习用途说明

日期：2026年11月07日。区分已部署与本地新增，不能把上游宣称支持当成Spur实际验收。

## 本轮用户授权澄清

用户明确项目为非商业开源学习，并要求继续接通全部平台。因此不再把“商业授权待确认”当作本轮学习验证的阻碍。上游LICENSE原文保留，学习用途不等于修改许可证或获得商业授权。

## 当前能力

| 平台 | 首选设计 | 实际路径与验证范围 |
| --- | --- | --- |
| YouTube | Agent-Reach | yt-dlp搜索，既有Linux/ECS真实验证通过；账号Analytics为独立OAuth链路 |
| 小红书 | MediaCrawler | 正式环境为Agent-Reach public-web，既有ECS搜索通过；非站内热榜或完整评论 |
| Reddit | Agent-Reach | 本轮本地统一Adapter真实返回2条公开索引结果，尚未部署这次改动 |
| TikTok | 待验证专用渠道 | 上游无专用渠道，但Agent-Reach web/exa按tiktok.com范围搜索，本轮本地Adapter通过2条 |
| 抖音 | MediaCrawler | 本轮Agent-Reach web/exa范围搜索本地Adapter通过1条；原生MediaCrawler未通过 |
| B站 | MediaCrawler | Agent-Reach公开搜索本地及Linux通过；用户登录后MediaCrawler原生搜索也已在Mac取得2条 |
| 微博 | MediaCrawler | Agent-Reach公开搜索本地及Linux通过；用户登录后MediaCrawler原生Adapter也已在Mac取得2条 |
| X | Agent-Reach | 本轮两次twitter/public-web无可用平台结果；generic web结果来自站外文章/镜像，不能充当X原站验证通过 |
| 详情、字幕、评论、创作者深采 | 按平台单独验证 | 本Adapter尚未启用，不能由搜索成功推断这些能力成功 |

## MediaCrawler为什么目前还不能直接执行

此前两个阻碍为许可证适用用途及运行未通过；本轮已明确学习用途，实际余下卡点是运行和会话。

本轮调用真实上游Crawler.start，使用独立普通Chrome上下文，不读取日常浏览器资料，不注入隐匿脚本；登录入口只报告需要用户登录，不自动扫码或注入Cookie：

- 小红书：Page.goto 12000ms超时，未采集结果。
- 抖音：Page.evaluate Execution context was destroyed，未采集结果。
- B站：pong返回账号未登录，NEED_LOGIN。
- 微博：pong返回Cookie无效，NEED_LOGIN。

用户已同意亲自登录。专用登录辅助脚本media-learning-login.py已打开B站与微博窗口，资料目录为用户主目录下.local/share/spur/research-learning-sessions/{bili,wb}，不入Git；登录完成后须关闭窗口释放会话。打开窗口不等于已登录或采集通过。

## 代码位置

- V2/agent/tools/research-adapter/capabilities.cjs：平台动作白名单与验证环境。
- V2/agent/tools/research-adapter/adapter.cjs：域名范围校验、固定参数子进程、凭据隔离、预算与标准化结果。
- V2/agent/tools/research-adapter/mediacrawler.cjs：新增独立学习执行桥接，需要明确配置和专用会话；默认未配置时返回NEED_SETUP，已移除“商业授权”作为学习模式报错原因。
- V2/agent/tools/research-adapter/media-learning-login.py：专用可见浏览器登录。
- V2/agent/tools/research-adapter/index.cjs：DSH工具注册。
- V2/agent/runtime/Agent-Reach/：上游工具。
- V2/agent/runtime/MediaCrawler/：上游源码和LICENSE，未改上游授权。

## 验证证据与后续

原始探测、统一Adapter规范化结果位于“全平台研究工具接入与非商业学习验证记录-2026年11月07日”目录。Adapter单元测试11项通过，包含跨平台链接拒绝、新路由参数范围校验和原生桥接隔离。

补记：用户亲自完成微博、B站专用浏览器登录；微博原生MediaCrawler已取回2条内容（本地），B站初次原生超时后正在限定请求规模重测。五个新增公开搜索平台已通过本地Linux Docker真实网络验证。均不能当作ECS已更新。

本轮新增路由尚未打入新镜像或部署ECS；云端仍是已切换的research-async-v2。待原生登录与采集测试后集中打包，复用原HTTPS、OAuth、邮件、异步任务和卷；手机前端接口不变，纯后端新增平台通常不需要再次安装App。
