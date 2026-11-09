# YouTube 适配器验收报告

**能力确认**：research_capabilities 显示仅 YouTube 搜索可用，provider=agent-reach，后端 yt-dlp；详情、字幕、评论、创作者均未验证。

**实际调用**：research_search(platform=youtube, query="AI glasses review", limit=1)，返回 ok=true、status=partial，耗时约 5.5 秒（retrievedAt 2026-11-06T14:27:08Z）。

**证据（仅搜索元数据）**：《Meta Ray-Ban Smart Glasses Review - 6 Months Later》，作者 6 Months Later，约 340.9 万观看、694 秒，链接：https://www.youtube.com/watch?v=ViA4-YWx8Y4 。发布日期字段为空。

**证据限制**：仅平台索引的搜索元数据；未验证排行榜、近期热度、完整视频内容、字幕与评论；未观看视频，不据此作热门或质量结论。
