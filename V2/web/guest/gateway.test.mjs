import test from 'node:test'
import assert from 'node:assert/strict'
import {request} from 'node:http'
import {mkdtempSync,writeFileSync,mkdirSync,rmSync,readFileSync,readdirSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {GuestAccess} from './access.mjs'
import {createGuestGateway,guestYoutubeConnections} from './gateway.mjs'
import {guestYoutubeTaskToken} from './queue.mjs'
import {AppConnections} from '../app-connections.mjs'
const youtubeScopes='https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly'
const id='12345678-1234-4234-8234-123456789abc',artifact='22345678-1234-4234-8234-123456789abc'
async function setup(t,queueEnabled=false,connections=null){const dir=mkdtempSync(join(tmpdir(),'spur-gateway-')),dist=join(dir,'dist'),root=join(dir,'data');mkdirSync(dist);writeFileSync(join(dist,'index.html'),'<h1>Spur</h1>');const access=new GuestAccess(root),a=access.issue(),b=access.issue();writeFileSync(join(root,'workers.json'),JSON.stringify({[a.tenantId]:{port:4300,token:'a'.repeat(43),dailyTasks:1},[b.tenantId]:{port:4301,token:'b'.repeat(43),dailyTasks:1}}),{mode:0o600});const calls=[]
 const server=createGuestGateway({root,dist,queueEnabled,connections,fetcher:async(url,options)=>{calls.push({url,options});const port=new URL(url).port;assert.equal(options.headers.Authorization,'Bearer '+(port==='4300'?'a':'b').repeat(43));if(url.includes('/artifacts/'))return new Response('file-'+port,{headers:{'Content-Type':'text/plain'}});if(options.method==='POST')return Response.json({runId:JSON.parse(options.body).requestId,status:'running'},{status:202});if(url.includes('/tasks/'))return Response.json({runId:id,status:'finished',result:{response:'done-'+port,artifacts:[{title:'result',url:'/api/creator-agent/artifacts/'+artifact}]}});return Response.json({status:'ready'})}})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true})})
 function call(path,{cookie,method='GET',data,origin='https://ai.hispurring.com',headers={}}={}){return new Promise((resolve,reject)=>{const req=request({host:'127.0.0.1',port:server.address().port,path,method,headers:{Host:'ai.hispurring.com',Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:Buffer.concat(chunks).toString(),json(){return JSON.parse(this.text)}}))});req.on('error',reject);req.end(data?JSON.stringify(data):undefined)})}
 async function login(code){const r=await call('/api/guest/login',{method:'POST',data:{code}});assert.equal(r.status,200);return r.headers['set-cookie'][0].split(';')[0]}
 return {call,login,a,b,calls,root}
}
test('only a single short-lived YouTube access token can be forwarded',()=>{assert.equal(guestYoutubeTaskToken('access-guest-a'),'access-guest-a');assert.equal(guestYoutubeTaskToken('bad token'),'');assert.equal(guestYoutubeTaskToken('short'),'');assert.equal(guestYoutubeTaskToken('ya29.\nsecret'),'')})
test('unauthenticated visitor receives login page but cannot query Agent',async t=>{const {call}=await setup(t);assert.match((await call('/')).text,/Spur/);assert.equal((await call('/api/web-backend')).json().mode,'guest-public');assert.equal((await call('/api/creator-agent/health')).status,401)})
test('cross-site login and forged forwarded host are refused',async t=>{const {call,a,calls}=await setup(t);assert.equal((await call('/api/guest/login',{method:'POST',origin:'https://evil.example',data:{code:a.code}})).status,403);assert.equal((await call('/healthz',{headers:{Host:'evil.example','x-forwarded-host':'ai.hispurring.com'}})).status,403);assert.equal(calls.length,0)})
test('two guests cannot query each others tasks or files',async t=>{const {call,login,a,b,calls}=await setup(t),ca=await login(a.code),cb=await login(b.code);assert.equal((await call('/api/creator-agent/chat',{cookie:ca,method:'POST',data:{requestId:id,message:'hello',async:true}})).status,202);assert.equal((await call('/api/creator-agent/tasks/'+id,{cookie:cb})).status,404);assert.equal((await call('/api/creator-agent/tasks/'+id,{cookie:ca})).status,200);assert.equal((await call('/api/creator-agent/artifacts/'+artifact,{cookie:cb})).status,404);assert.equal((await call('/api/creator-agent/artifacts/'+artifact,{cookie:ca})).text,'file-4300');assert(calls.every(c=>new URL(c.url).port==='4300'))})
test('quotas are independent and duplicate submission never repeats execution',async t=>{const {call,login,a,b,calls}=await setup(t),ca=await login(a.code),cb=await login(b.code);const submit=(cookie,requestId)=>call('/api/creator-agent/chat',{cookie,method:'POST',data:{requestId,message:'hello',async:true}});assert.equal((await submit(ca,id)).status,202);assert.equal((await submit(ca,id)).status,409);assert.equal((await submit(ca,artifact)).status,429);assert.equal((await submit(cb,artifact)).status,202);assert.equal(calls.length,2)})
test('personal email, OAuth and arbitrary service routes are never forwarded',async t=>{const {call,login,a,calls}=await setup(t),cookie=await login(a.code);for(const path of ['/api/creator-agent/email/status','/api/creator-agent/connections','/api/youtube/oauth/start','/api/creator-agent/videos'])assert.equal((await call(path,{cookie})).status,403);assert.equal(calls.length,0)})
test('worker registry cannot route guests to the personal Agent port',async t=>{const {call,login,a,root,calls}=await setup(t),cookie=await login(a.code);writeFileSync(join(root,'workers.json'),JSON.stringify({[a.tenantId]:{port:4173,token:'a'.repeat(43)}}),{mode:0o600});assert.equal((await call('/api/creator-agent/health',{cookie})).status,503);assert.equal(calls.length,0)})
test('metadata gives separate visitor storage identity and logout invalidates cookie',async t=>{const {call,login,a}=await setup(t),cookie=await login(a.code);assert.equal((await call('/api/web-backend',{cookie})).json().scope,'guest:'+a.tenantId);assert.equal((await call('/api/guest/logout',{cookie,method:'POST',data:{}})).status,200);assert.equal((await call('/api/web-backend',{cookie})).json().mode,'guest-public');assert.equal((await call('/api/creator-agent/health',{cookie})).status,401)})
test('administration is available only on a private Unix socket',async t=>{
 const {startGuestAdmin}=await import('./gateway.mjs');const root=mkdtempSync('/tmp/spur-admin-');new GuestAccess(root);const admin=startGuestAdmin(root);await new Promise(r=>admin.once('listening',r));t.after(async()=>{await new Promise(r=>admin.close(r));rmSync(root,{recursive:true,force:true})})
 const result=await new Promise((resolve,reject)=>{const req=request({socketPath:join(root,'admin.sock'),method:'POST',path:'/issue',headers:{'Content-Type':'application/json'}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve(JSON.parse(text)))});req.on('error',reject);req.end(JSON.stringify({label:'friend'}))});assert.match(result.code,/^[A-Za-z0-9_-]{43}$/);assert.equal(new GuestAccess(root).data.tenants[result.tenantId].label,'friend')
})

test('queued submission survives logout, hides other guest state, and dispatches without browser polling',async t=>{
 const {call,login,a,b,calls}=await setup(t,true),ca=await login(a.code),cb=await login(b.code)
 assert.equal((await call('/api/creator-agent/chat',{cookie:ca,method:'POST',data:{requestId:id,message:'hello',async:true}})).status,202)
 const pending=(await call('/api/creator-agent/tasks/'+id,{cookie:ca})).json();assert.equal(pending.queue.state,'queued');assert.equal(pending.queue.position,1);assert.equal(calls.length,0)
 assert.equal((await call('/api/creator-agent/tasks/'+id,{cookie:cb})).status,404)
 await call('/api/guest/logout',{cookie:ca,method:'POST',data:{}})
 await new Promise(r=>setTimeout(r,2300));const posts=calls.filter(c=>c.options.method==='POST');assert.equal(posts.length,1);assert.equal(posts[0].options.headers['X-Spur-Task-Youtube-Token'],undefined)
})

test('guest YouTube callback is fixed to the visitor site',t=>{
 const dir=mkdtempSync(join(tmpdir(),'spur-guest-youtube-config-'))
 t.after(()=>rmSync(dir,{recursive:true,force:true}))
 assert.equal(guestYoutubeConnections(dir,{}),null)
 const store=guestYoutubeConnections(dir,{YOUTUBE_CLIENT_ID:'google-client',YOUTUBE_CLIENT_SECRET:'google-secret',SPUR_PUBLIC_URL:'https://api.hispurring.com'})
 const start=store.start(store.credentialForTenant('guest-'+'c'.repeat(24)),'youtube')
 assert.equal(new URL(start.authorizationUrl).searchParams.get('redirect_uri'),'https://ai.hispurring.com/api/connections/callback/youtube')
})

test('two guests keep separate YouTube grants and tokens never enter the queue',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'spur-guest-youtube-'))
 t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const fetchImpl=async(url,options={})=>{
  const address=String(url)
  if(address.includes('oauth2.googleapis.com/token')){
   const code=new URLSearchParams(options.body).get('code')
   return {ok:true,status:200,json:async()=>({access_token:'access-'+code,refresh_token:'refresh-'+code,expires_in:3600,scope:youtubeScopes})}
  }
  const token=String(options.headers?.Authorization||'').replace('Bearer access-','')
  return {ok:true,status:200,json:async()=>({items:[{snippet:{title:'Channel '+token}}]})}
 }
 const connections=new AppConnections(dir,{SPUR_PUBLIC_URL:'https://ai.hispurring.com',YOUTUBE_CLIENT_ID:'google-client',YOUTUBE_CLIENT_SECRET:'google-secret'},fetchImpl)
 const {call,login,a,b,calls,root}=await setup(t,true,connections)
 const ca=await login(a.code),cb=await login(b.code)
 async function connect(cookie,code){
  const start=await call('/api/guest/connections/youtube/start',{cookie,method:'POST',data:{}})
  assert.equal(start.status,200)
  const location=new URL(start.json().authorizationUrl)
  assert.equal(location.origin,'https://accounts.google.com')
  assert.equal(location.searchParams.get('redirect_uri'),'https://ai.hispurring.com/api/connections/callback/youtube')
  const query=location.searchParams;query.set('code',code)
  const done=await call('/api/connections/callback/youtube?'+query.toString(),{headers:{'sec-fetch-site':'cross-site'}})
  assert.equal(done.status,200);assert.doesNotMatch(done.text,/access-|refresh-/)
 }
 await connect(ca,'guest-a');await connect(cb,'guest-b')
 const mine=await call('/api/guest/connections',{cookie:ca}),other=await call('/api/guest/connections',{cookie:cb})
 assert.equal(mine.json().connections[0].label,'Channel guest-a')
 assert.equal(other.json().connections[0].label,'Channel guest-b')
 assert.doesNotMatch(mine.text,/guest-b|access-|refresh-/)
 assert.doesNotMatch(other.text,/guest-a|access-|refresh-/)
 assert.equal((await call('/api/creator-agent/chat',{cookie:ca,method:'POST',data:{requestId:id,message:'分析我的 YouTube',async:true,headersIgnored:true},headers:{'X-Spur-Task-Youtube-Token':'forged-token-should-never-pass'}})).status,202)
 const stored=[readFileSync(join(root,'access.json'),'utf8'),readFileSync(join(root,'queue.json'),'utf8'),...readdirSync(join(dir,'app-connections')).map(name=>readFileSync(join(dir,'app-connections',name),'utf8'))].join('\n')
 assert.doesNotMatch(stored,/access-guest-|refresh-guest-/)
 assert.equal(calls.filter(item=>item.options.method==='POST').length,0)
 await new Promise(r=>setTimeout(r,2300))
 const posts=calls.filter(item=>item.options.method==='POST')
 assert.equal(posts.length,1)
 assert.equal(posts[0].options.headers['X-Spur-Task-Youtube-Token'],'access-guest-a')
 assert.doesNotMatch(posts[0].options.body,/access-guest-|refresh-guest-|forged-token/)
 assert.doesNotMatch(readFileSync(join(root,'queue.json'),'utf8'),/access-guest-|refresh-guest-|forged-token/)
 assert.equal((await call('/api/guest/connections/youtube/disconnect',{cookie:ca,method:'POST',data:{}})).status,200)
 assert.equal((await call('/api/guest/connections',{cookie:ca})).json().connections[0].state,'disconnected')
 assert.equal((await call('/api/guest/connections',{cookie:cb})).json().connections[0].state,'connected')
})

test('public homepage assets are visible but task submission and files remain protected',async t=>{
 const {call,dist,calls}=await setup(t);
 assert.equal((await call('/')).status,200)
 assert.equal((await call('/api/creator-agent/chat',{method:'POST',data:{requestId:id,message:'hello',async:true}})).status,401)
 assert.equal((await call('/api/creator-agent/artifacts/'+artifact)).status,401)
 assert.equal((await call('/api/creator-agent/tasks/'+id)).status,401);assert.equal(calls.length,0)
})
