# Spur research adapter — local integration stage

Registers `research_capabilities` and `research_search` with the existing DSH tools service. `capabilities.cjs` is the execution allowlist; platform preference does not unlock actions.

Current enabled routes:

- YouTube search → Agent-Reach yt-dlp search metadata.
- Xiaohongshu search → Agent-Reach public-web indexed text. MediaCrawler remains the preferred future provider, but is currently disabled.

2026-11-07 update: non-commercial open-source learning use was explicitly confirmed by the user. Public searches for Reddit, TikTok, Douyin, Bilibili and Weibo passed the local Adapter and Linux container network probes. Reddit uses its public-web route; the other four use Agent-Reach web/exa with an appended platform domain scope and mandatory URL filtering. TikTok still has no native channel. X has not returned usable original-platform results and remains unavailable. These additions have not yet been deployed to ECS.

MediaCrawler now has a separate bounded learning bridge and `research_native_search` tool. It requires `SPUR_MEDIACRAWLER_LEARNING=1`, absolute `SPUR_MEDIACRAWLER_PYTHON`, `SPUR_MEDIACRAWLER_ROOT`, and `SPUR_MEDIACRAWLER_PROFILE_ROOT`. Without this configuration it returns NEED_SETUP. The per-platform profile (`xhs`, `dy`, `bili`, `wb`) must be manually authorized in a dedicated browser; otherwise it returns NEED_LOGIN. Do not point it at a daily browser profile. `media-learning-login.py` opens this dedicated visible Chrome. Close the login window before searching; a live profile lock returns PROFILE_BUSY. This bridge does not collect comments or download media, and is not yet included with MediaCrawler dependencies in the production Docker image. No commercial permission is claimed or upstream license changed. Existing DSH public-search, OAuth, Notion and email tools remain in place.

## Local opt-in

The Node backend registers this adapter only when `SPUR_RESEARCH_ADAPTER_ENABLED=1`. Set `SPUR_AGENT_REACH_BIN` to an administrator-approved absolute executable path. Optional `SPUR_RESEARCH_PROVIDER_PROXY` supplies the existing network proxy specifically to the provider CLI. It is separate from the model connection. No auto-install, account import or login operation runs.

Each task has a private fresh HOME under its output directory. Child environment is allowlisted and does not include model, Notion, email or OAuth credentials. Queries are fixed CLI arguments, never shell commands. Maximum 5 results per call, 6 calls per task, one active call per adapter, 25-second provider budget and 30-second outer timeout, bounded stdout. Platform login/challenge/rate-limit failures stop further calls for that platform in this task.

Responses classify indexed snippets versus search metadata; unknown metrics remain null, and date-range/popularity/completeness/comment claims remain unverified. These are single-task boundaries, not a complete multi-user authorization or global queue system. No generic URL-fetch tool is exposed.

Normalized evidence is written to the task evidence directory with restricted permissions. Existing tool-events records support task activity and source collection. Returned third-party text must be treated as untrusted evidence.

## Validation

`node --test V2/agent/tools/research-adapter/adapter.test.cjs`

Local live validation on 2026-11-06 returned 3 YouTube and 3 Xiaohongshu results. A DSH Headless run using this exact plugin called research_search and save_document successfully. This does not establish full-text, comment, date-window or trend-ranking capability.

Subsequent local packaging (2026-11-06): the Dockerfile now includes the adapter and an isolated Agent-Reach environment; prepare-research-wheels.py builds a hash-verified Linux wheelhouse and Docker installs Python packages without querying an index. The local image passed a live HTTP → DSH → public-web → report/download loop. ECS production has not been updated, and no iOS or webpage UI changes were made. The image defaults SPUR_RESEARCH_ADAPTER_ENABLED=0; local verification explicitly enabled it.
