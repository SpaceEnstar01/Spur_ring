const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createAdapter } = require('./adapter.cjs');
function fixture(t, execute) {
 const root = mkdtempSync(join(tmpdir(), 'spur-research-test-'));
 t.after(() => rmSync(root, { recursive:true, force:true }));
 return createAdapter({binary:'/approved/bin/agent-reach',taskRoot:root,execute});
}
const good = {ok:true,channel:'youtube',backend:'yt-dlp',items:[{title:'Example',url:'https://www.youtube.com/watch?v=abcdefghijk',raw:{view_count:100,duration:42}}]};
test('rejects platform, CLI flag injection, extra arguments and limits without execution', async t => {
 let calls=0;const a=fixture(t,async()=>{calls++;});
 for(const input of [{platform:'shell',query:'hi'},{platform:'youtube',query:'--timeout=999'},{platform:'youtube',query:'hi',cookie:'secret'},{platform:'youtube',query:'hi',limit:99}]) assert.equal((await a.search(input)).error.code,'BAD_INPUT');
 assert.equal(calls,0);
});
test('unavailable X and unconfigured native MediaCrawler never launch',async t=>{
 let calls=0;const a=fixture(t,async()=>{calls++;});
 assert.equal((await a.search({platform:'x',query:'AI'})).status,'unavailable');
 assert.equal((await require('./mediacrawler.cjs').search()).error.code,'NEED_SETUP');assert.equal(calls,0);
});
test('new public routes scope queries and reject off-platform evidence',async t=>{
 for(const [platform,channel,backend,domain] of [['tiktok','web','exa','tiktok.com'],['douyin','web','exa','douyin.com'],['bilibili','web','exa','bilibili.com'],['weibo','web','exa','weibo.com'],['reddit','reddit','public-web','reddit.com']]){
  const a=fixture(t,async(bin,argv)=>{
   assert.equal(argv[0],channel);assert.equal(argv[argv.indexOf('--backend')+1],backend);
   if(channel==='web') assert.equal(argv[2],`AI site:${domain}`);
   return {stdout:JSON.stringify({ok:true,channel,backend,items:[{title:'Public result',url:`https://www.${domain}/example`},{title:'Wrong platform',url:'https://example.com/wrong'},{url:null}]})};
  });
  const result=await a.search({platform,query:'AI'});
  assert.equal(result.ok,true);assert.equal(result.items.length,1);
  assert.equal(result.limits.commentsAvailable,false);
  assert.equal(result.limits.popularityRankingVerified,false);
 }
});
test('isolates credentials and results, preserves unknown metrics and caches repeated search',async t=>{
 let calls=0;const a=fixture(t,async(bin,argv,options)=>{calls++;assert.equal(options.shell,false);assert.equal(options.env.AGENTMAIL_API_KEY,undefined);assert.equal(options.env.SILICONFLOW_API_KEY,undefined);assert.equal(options.env.SPUR_CREATOR_AGENT_TOKEN,undefined);assert.ok(options.env.HOME.endsWith('research-home'));assert.deepEqual(argv,['youtube','search','AI','--limit','3','--backend','yt-dlp','--timeout','25']);return {stdout:JSON.stringify(good)};});
 const first=await a.search({platform:'youtube',query:'AI'});assert.equal(first.ok,true);assert.equal(first.limits.commentsAvailable,false);assert.equal(first.limits.dateRangeVerified,false);
 assert.equal((await a.search({platform:'youtube',query:'AI'})).cached,true);assert.equal(calls,1);
});
test('challenge blocks all later queries on same platform in this task',async t=>{
 let calls=0;const a=fixture(t,async()=>{calls++;return {stdout:JSON.stringify({ok:false,error:{code:'PLATFORM_BLOCKED',message:'Cookie secret unsafe details'}})};});
 const result=await a.search({platform:'youtube',query:'AI'});assert.equal(result.error.code,'PLATFORM_BLOCKED');assert.ok(!JSON.stringify(result).includes('secret'));
 await a.search({platform:'youtube',query:'different'});assert.equal(calls,1);
});
test('rejects malformed output, unexpected backend and off-platform URLs',async t=>{
 for(const stdout of ['not json',JSON.stringify({...good,backend:'unexpected'}),JSON.stringify({...good,items:[{url:'http://127.0.0.1/private'}]})]){
 const a=fixture(t,async()=>({stdout}));assert.equal((await a.search({platform:'youtube',query:'AI'})).ok,false);
 }
});
test('concurrent requests do not share active execution',async t=>{
 let finish;const a=fixture(t,()=>new Promise(resolve=>{finish=()=>resolve({stdout:JSON.stringify(good)});}));
 const first=a.search({platform:'youtube',query:'one'});assert.equal((await a.search({platform:'youtube',query:'two'})).error.code,'BUSY');finish();assert.equal((await first).ok,true);
});
test('xiaohongshu uses public-only fallback while preference remains MediaCrawler',async t=>{
 const a=fixture(t,async(bin,argv)=>{assert.equal(argv[argv.indexOf('--backend')+1],'public-web');return {stdout:JSON.stringify({ok:true,channel:'xiaohongshu',backend:'public-web',items:[{url:'https://xhslink.com/o/example',text:'Indexed snippet'}]})};});
 const out=await a.search({platform:'xiaohongshu',query:'AI硬件'});assert.equal(out.preferredProvider,'mediacrawler');assert.equal(out.provider,'agent-reach');assert.equal(out.items[0].evidenceType,'search_results');
});
