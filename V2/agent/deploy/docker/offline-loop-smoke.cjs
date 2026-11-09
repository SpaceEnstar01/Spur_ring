// Deterministic transport/tool-loop test. This is NOT a live-model quality test.
const {createServer} = require('node:http');
const {spawn} = require('node:child_process');
const assert = require('node:assert/strict');
const token = require('node:crypto').randomBytes(32).toString('base64url');
const auth = { Authorization: 'Bearer ' + token };
let app, calls = 0;
const stub = createServer(async (req,res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  calls++;
  const hasResult = body.messages?.some(m=>m.role === 'tool');
  const delta = hasResult
    ? {role:'assistant',content:'已保存。'}
    : {role:'assistant',tool_calls:[{index:0,id:'call_offline_save',type:'function',function:{name:'save_document',arguments:JSON.stringify({filename:'offline-check.md',content:'# Offline container check\nLinux AMD64\n'})}}]};
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});
  const base={id:'offline-smoke',object:'chat.completion.chunk',created:Math.floor(Date.now()/1000),model:body.model};
  res.write('data: '+JSON.stringify({...base,choices:[{index:0,delta,finish_reason:null}]})+'\n\n');
  res.write('data: '+JSON.stringify({...base,choices:[{index:0,delta:{},finish_reason:hasResult?'stop':'tool_calls'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}})+'\n\n');
  res.end('data: [DONE]\n\n');
});
async function main() {
  await new Promise(resolve=>stub.listen(8177,'127.0.0.1',resolve));
  app=spawn(process.execPath,['/opt/spur/V2/web/server.mjs'],{env:{...process.env,HOST:'127.0.0.1',PORT:'4273',SPUR_CREATOR_AGENT_TOKEN:token,SILICONFLOW_API_KEY:'offline-test-only',SILICONFLOW_BASE_URL:'http://127.0.0.1:8177/v1'},stdio:['ignore','inherit','inherit']});
  let ready=false;
  for(let i=0;i<45;i++){
    try {if((await fetch('http://127.0.0.1:4273/api/creator-agent/health',{headers:auth})).ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  assert(ready,'App did not become ready');
  const response=await fetch('http://127.0.0.1:4273/api/creator-agent/chat',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({message:'使用 save_document 保存 offline-check.md，内容为 Linux AMD64。'}),signal:AbortSignal.timeout(90000)});
  const result=await response.json();
  assert.equal(response.status,200,JSON.stringify(result));
  assert(calls>=2,'DSH did not complete the tool-result round trip');
  assert(result.artifacts?.length,'No artifact was returned');
  const download=await fetch('http://127.0.0.1:4273'+result.artifacts[0].url);
  assert.equal(download.status,200);
  assert.equal(await download.text(),'# Offline container check\nLinux AMD64\n');
  console.log(JSON.stringify({test:'offline-model-HTTP-DSH-tool-loop',calls,result},null,2));
  console.log('OFFLINE LOOP PASS (simulated model, no paid API)');
}
main().catch(error=>{console.error(error.stack||String(error));process.exitCode=1;}).finally(()=>{
  app?.kill('SIGTERM');stub.close();setTimeout(()=>process.exit(process.exitCode||0),2000);
});
