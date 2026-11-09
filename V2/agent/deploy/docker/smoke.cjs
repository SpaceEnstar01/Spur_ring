// Run inside the built image as its normal non-root user. No paid API calls.
const assert = require('node:assert/strict');
const {mkdtempSync} = require('node:fs');
const {execFileSync} = require('node:child_process');
const {join} = require('node:path');
const root = '/opt/spur/V2';
const tools = new Map();
const cleanup = [];
const ctx = {
  tools: {register(tool) { tools.set(tool.name, tool); return () => tools.delete(tool.name); }},
  effect(factory) { cleanup.push(factory()); },
};
async function main() {
  assert.notEqual(process.getuid(), 0, 'Container must not run as root');
  const os = execFileSync('cat', ['/etc/os-release'], {encoding: 'utf8'});
  assert.match(os, /VERSION_ID="24.04"/);
  assert.equal(process.arch, 'x64');
  console.log('runtime', JSON.stringify({uid:process.getuid(),node:process.version,
    python:execFileSync('python3',['--version'],{encoding:'utf8'}).trim(),
    chrome:execFileSync('google-chrome',['--version'],{encoding:'utf8'}).trim()}));
  execFileSync('python3',['-c',`import runpy; m=runpy.run_path('${root}/agent/tools/travel-research/research.py'); assert callable(m['run'])`]);
  console.log('Python research helper loaded');
  process.env.SPUR_RESEARCH_OUTPUT = mkdtempSync('/tmp/spur-smoke-');
  process.env.SPUR_PLAYWRIGHT_MCP_ROOT = join(root,'agent/runtime/mcp-servers/playwright-mcp');
  require(join(root,'agent/tools/personal-workspace/index.cjs')).apply(ctx);
  const saved = await tools.get('save_document').execute({filename:'smoke.md',content:'# Container smoke\nVerified local document.\n'});
  assert.equal((await tools.get('read_document').execute({filename:'smoke.md'})).content,'# Container smoke\nVerified local document.\n');
  console.log('document',JSON.stringify(saved));
  // Exercises the actual stdio bridge, public-network proxy, Chrome launch and snapshot.
  await require(join(root,'agent/tools/playwright-browser/index.cjs')).apply(ctx);
  console.log('MCP initialized', [...tools.keys()].filter(name=>name.startsWith('browser_')));
  for (const url of ['http://127.0.0.1/', 'http://169.254.169.254/']) {
    await assert.rejects(() => tools.get('browser_navigate').execute({url}));
  }
  console.log('SSRF loopback and metadata blocked');
  const page = await tools.get('browser_navigate').execute({url:'https://example.com/'});
  assert.match(page.text,/Example Domain/);
  const snapshot = await tools.get('browser_snapshot').execute({});
  assert.match(snapshot.text,/Example Domain/);
  console.log('Chrome navigation and snapshot passed');
}
main().then(()=>{console.log('SMOKE PASS');process.exitCode=0;},error=>{
  console.error(error.stack || String(error));process.exitCode=1;
}).finally(()=>{
  for(const dispose of cleanup.reverse()) dispose?.();
  // Permit the MCP transport to flush/close, but never keep a failed smoke hanging.
  setTimeout(()=>process.exit(process.exitCode || 0),2000);
});
