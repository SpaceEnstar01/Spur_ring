// Real read-only network probe. No model, OAuth, Cookie or external writes.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createAdapter } = require(process.env.SPUR_ADAPTER_MODULE || '/opt/spur/V2/agent/tools/research-adapter/adapter.cjs');
(async () => {
  const results = [];
  const selected = process.argv.slice(2);
  for (const platform of selected.length ? selected : ['reddit','tiktok','douyin','bilibili','weibo']) {
    const adapter = createAdapter({
      binary: process.env.SPUR_AGENT_REACH_BIN || '/opt/research-venv/bin/agent-reach',
      taskRoot: fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'spur-platform-smoke-')),
    });
    const result = await adapter.search({platform, query:['reddit','tiktok','x'].includes(platform) ? 'personal agent' : 'AI硬件', limit:2});
    results.push(result);
    console.log(JSON.stringify({platform,ok:result.ok,count:result.items.length,backend:result.backend,error:result.error?.code}));
  }
  if (process.env.SPUR_PROBE_RESULT_FILE) fs.writeFileSync(process.env.SPUR_PROBE_RESULT_FILE, JSON.stringify(results,null,2), {mode:0o600});
  if (results.some(r=>!r.ok)) process.exitCode=1;
  else console.log('PUBLIC_PLATFORM_SEARCH_PASS');
})().catch(() => {console.error('PLATFORM_PROBE_FAILED');process.exitCode=1;});
