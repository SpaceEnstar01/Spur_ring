# Spur Creator Research, terminal-only

This integration reuses the existing DeepSeek Harness CLI and its native tool-call loop. It does not run nanoMuse or implement an alternate LLM loop. All new implementation and output are under V2. The launcher prefers a built V2 Harness; when unavailable, it reads the already-built original `agent/runtime/deepseek-harness` without changing that source tree. A compatible Node 22.19+ / 24+ is required.

## Run

From the main workspace:

```bash
bash V2/scripts/run-creator-research.sh
```

Optional task text is passed as one quoted argument. Configuration is read from `V2/agent/config/siliconflow.env`. The key is passed to the Harness through its credential-reference environment variable, never in the patch, task or printed output. A run can spend model tokens. No UI, video generation, mailbox or external write actions are enabled.

## Tools and backend limitations

- `creator_search`: public YouTube search, with a DuckDuckGo discovery fallback.
- `creator_video_metadata`: public player metadata, no invented fallback values.
- `creator_transcript`: public caption tracks, English preferred, auto-caption origin marked.
- `creator_read_source`: read-only HTTPS with size/time limits and private-address checks.
- `creator_save_report`: source-required original report, outline and prompt.
- `creator_read_evidence`: optional read-only reuse of the prior run's retained sources.

This machine's direct public search returned unrelated results, and some direct DNS/page access failed. A fresh standalone internet research run is therefore NOT verified on this environment. The successful research used `SPUR_RESEARCH_HOST_BRIDGE=1`: Harness writes requests to its run's `bridge/` directory; the connected host web-search tool answered them. This flag needs an active host coordinator, not merely an API key. Do not advertise the hosted search as a SiliconFlow capability or leave a standalone terminal waiting for an absent coordinator. A deployed version should bind a reliable authorized search/MCP provider and a usable caption source.

The host transcript operation was source discovery, not an extractor returning timed segments. Author-owned public transcript text was available, exact caption timings were not. Browser access to YouTube was declined, so no shot-level visual analysis was performed or bypass attempted.

For report regeneration from the retained evidence without re-searching:

```bash
SPUR_RESEARCH_EVIDENCE=/Users/x/X/space/spur/V2/files/creator-research/2026-10-30T07-58-28-305Z bash V2/scripts/run-creator-research.sh '先用 creator_read_evidence 读取上次来源列表和相关证据，不联网；生成简洁中文报告、大纲及原创Prompt，调用 creator_save_report 保存。明确无精确字幕时间码和未观察画面，不能将回看热度当剧情时间。'
```

This still invokes the real model and may incur token costs. To inspect the already-produced terminal output without another model request:

```bash
cat /Users/x/X/space/spur/V2/files/creator-research/2026-10-30T08-54-59-911Z/terminal.txt
```

## Evidence and acceptance

Each run retains the task, model/runtime metadata, credential-free patch, tool-events.jsonl, source metadata, Harness event sessions, terminal output and stderr. The successful continuation points to the preceding source run. Full subtitle copies are not delivered. The persisted session contains the original model response; `review.json` records a wording correction to an unsupported correlation claim.

`validation.json` distinguishes saved artifacts from a complete task. New runs return nonzero for missing output, and code 2 for partial evidence coverage even if Harness completed normally. Coverage flags in `creator_save_report` must only be true for genuinely verified evidence; they are not a semantic verifier.

Current result: real US creator Peter Santenello, a high-view domestic travel documentary, official public untimed transcript and original structural analysis; precise timed-caption analysis, first-five-second audiovisual analysis and shot rhythm are NOT completed. It is not a fully verified end-to-end acceptance of all user requirements.

A preceding live model run hit max-tokens while producing tool arguments. The full failure is retained. The continuation reused evidence, increased the model output cap and requested shorter artifacts, then successfully saved all three files and printed findings. This demonstrates failure diagnosis, not automatic production-grade recovery.

## Checks

```bash
python3 V2/agent/tools/travel-research/test_research.py
node --test V2/agent/tools/travel-research/test_plugin.cjs
```

Five offline tests cover URL restrictions, HTML filtering, missing metadata, missing captions and timestamp preservation. One plugin test covers the output schema, source requirement and artifact persistence. They do not replace a fresh network or audiovisual acceptance test.
