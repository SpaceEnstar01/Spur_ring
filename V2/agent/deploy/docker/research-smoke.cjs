// Linux packaging/guard tests. No live platform request or model call.
const assert=require('node:assert/strict');
const fs=require('node:fs');const {execFileSync}=require('node:child_process');
const root='/opt/spur/V2';
assert.equal(process.arch,'x64');assert.notEqual(process.getuid(),0);
assert(fs.existsSync('/opt/research-venv/bin/agent-reach'));
assert(!fs.existsSync(root+'/agent/runtime/MediaCrawler'));
assert(!fs.existsSync(root+'/agent/config/siliconflow.env'));
for(const file of ['youtube/index.cjs','notion/index.cjs']) assert(fs.existsSync(root+'/agent/tools/connectors/'+file));
const home=fs.mkdtempSync('/tmp/research-home-');
const output=execFileSync('/opt/research-venv/bin/agent-reach',['channels'],{env:{PATH:'/opt/research-venv/bin:/usr/local/bin:/usr/bin:/bin',HOME:home,LANG:'C.UTF-8'},encoding:'utf8',timeout:10000});
assert.equal(JSON.parse(output).ok,true);
console.log('LINUX_RESEARCH_PACKAGING_OK uid='+process.getuid());
