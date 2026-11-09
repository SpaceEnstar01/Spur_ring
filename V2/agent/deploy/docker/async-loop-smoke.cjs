// Real HTTP/DSH/storage, simulated delayed model. No paid API/platform request.
const {createServer}=require('node:http');const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');const {randomBytes,randomUUID}=require('node:crypto');
const token=randomBytes(32).toString('base64url');const auth={Authorization:'Bearer '+token,'Content-Type':'application/json'};
const base='http://127.0.0.1:4273';const delayMs=Number(process.env.SPUR_TEST_DELAY_MS||65000);
let app,calls=0;
const stub=createServer(async(req,res)=>{
 let text='';for await(const x of req)text+=x;const body=JSON.parse(text);calls++;
 const hasResult=body.messages?.some(m=>m.role==='tool');if(!hasResult)await new Promise(r=>setTimeout(r,delayMs));
 const delta=hasResult?{role:'assistant',content:'Saved verified test document.'}:{role:'assistant',tool_calls:[{index:0,id:'save-async',type:'function',function:{name:'save_document',arguments:JSON.stringify({filename:'async-check.md',content:'# Async verified\n'})}}]};
 const event={id:'async-mock',object:'chat.completion.chunk',created:Math.floor(Date.now()/1000),model:body.model};
 res.writeHead(200,{'Content-Type':'text/event-stream'});
 res.write('data: '+JSON.stringify({...event,choices:[{index:0,delta,finish_reason:null}]})+'\n\n');
 res.write('data: '+JSON.stringify({...event,choices:[{index:0,delta:{},finish_reason:hasResult?'stop':'tool_calls'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}})+'\n\n');res.end('data: [DONE]\n\n');
});
async function start(){
 app=spawn(process.execPath,['/opt/spur/V2/web/server.mjs'],{env:{...process.env,HOST:'127.0.0.1',PORT:'4273',SPUR_CREATOR_AGENT_TOKEN:token,SILICONFLOW_API_KEY:'offline-test-only',SILICONFLOW_BASE_URL:'http://127.0.0.1:8177/v1'},stdio:['ignore','inherit','inherit']});
 for(let i=0;i<40;i++){try{if((await fetch(base+'/api/creator-agent/health',{headers:auth})).ok)return;}catch{}await new Promise(r=>setTimeout(r,500));}throw Error('App not ready');
}
async function main(){
 await new Promise(r=>stub.listen(8177,'127.0.0.1',r));await start();
 const profile=async()=>{const r=await fetch(base+'/api/creator-agent/connections/profile',{method:'POST',headers:auth});assert.equal(r.status,201);return(await r.json()).credential;};
 const credential=await profile(),other=await profile();const headers={...auth,'X-Spur-Connection':credential};
 const runId=randomUUID(),body=JSON.stringify({requestId:runId,async:true,message:'Save async-check.md with save_document.'});
 const time=Date.now();const accepted=await fetch(base+'/api/creator-agent/chat',{method:'POST',headers,body,signal:AbortSignal.timeout(5000)});
 assert.equal(accepted.status,202);assert.equal((await accepted.json()).runId,runId);assert(Date.now()-time<5000);
 console.log('ASYNC_ACCEPTED_BEFORE_MODEL_FINISHED');
 const duplicate=await fetch(base+'/api/creator-agent/chat',{method:'POST',headers,body});assert.equal(duplicate.status,409);
 const denied=await fetch(base+'/api/creator-agent/tasks/'+runId,{headers:{...auth,'X-Spur-Connection':other}});assert.equal(denied.status,404);
 let task;for(let i=0;i<120;i++){const r=await fetch(base+'/api/creator-agent/tasks/'+runId,{headers,signal:AbortSignal.timeout(5000)});assert.equal(r.status,200);task=await r.json();if(task.status==='finished'||task.status==='failed')break;await new Promise(r=>setTimeout(r,1000));}
 assert.equal(task.status,'finished',JSON.stringify(task));assert(task.result?.response);assert.equal(calls,2);
 const original=task.result.response;
 const exited=new Promise(r=>app.once('exit',r));app.kill('SIGTERM');await exited;await start();
 const recovered=await(await fetch(base+'/api/creator-agent/tasks/'+runId,{headers})).json();assert.equal(recovered.result.response,original);
 const file=await fetch(base+recovered.result.artifacts[0].url);assert.equal(file.status,200);assert.equal(await file.text(),'# Async verified\n');
 console.log(JSON.stringify({test:'async-delay-and-restart',delayMs,calls,runId,elapsedMs:Date.now()-time}));
 console.log('ASYNC_DELAY_RESTART_PASS_SIMULATED_MODEL');
}
main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;}).finally(()=>{app?.kill('SIGTERM');stub.close();setTimeout(()=>process.exit(process.exitCode||0),2000);});
