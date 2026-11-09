// One gateway process owns this durable queue. Workers and data remain per visitor.
import {existsSync,readFileSync,writeFileSync,renameSync,lstatSync} from 'node:fs'
import {join} from 'node:path'
export function guestYoutubeTaskToken(value){
 const token=String(value||'').trim()
 return /^[A-Za-z0-9._~+/=-]{10,4096}$/.test(token)?token:''
}
export class GuestQueue {
 constructor({root,backend,allowed=()=>true,fetcher=fetch,now=Date.now,youtubeAccess=async()=>''}) {
  this.file=join(root,'queue.json');this.backend=backend;this.allowed=allowed;this.fetcher=fetcher;this.now=now;this.youtubeAccess=youtubeAccess
  if(existsSync(this.file)&&(!lstatSync(this.file).isFile()||(lstatSync(this.file).mode&0o077)))throw Error('Private queue required')
  this.jobs=existsSync(this.file)?JSON.parse(readFileSync(this.file,'utf8')):[]
 }
 save(){const tmp=this.file+'.tmp';writeFileSync(tmp,JSON.stringify(this.jobs),{mode:0o600});renameSync(tmp,this.file)}
 enqueue(tenantId,payload){
  if(this.jobs.some(j=>j.id===payload.requestId))throw Object.assign(Error('任务编号已存在。'),{status:409})
  if(this.jobs.filter(j=>!['finished','failed'].includes(j.phase)).length>=150)throw Object.assign(Error('排队人数较多，请稍后再试。'),{status:429})
  this.jobs.push({id:payload.requestId,tenantId,payload,phase:'queued',createdAt:this.now()});this.save()
 }
 snapshot(tenantId,id){
  const j=this.jobs.find(j=>j.tenantId===tenantId&&j.id===id);if(!j)return null
  const active=this.jobs.filter(x=>['dispatching','running'].includes(x.phase)).length
  const pending=this.jobs.filter(x=>x.phase==='queued'),position=pending.indexOf(j)+1
  return {runId:id,status:j.phase==='failed'?'failed':'running',error:j.error||null,
   queue:{state:j.phase,position:j.phase==='queued'?position:0,active,limit:2},
   ...(j.phase==='failed'?{error:j.error||'任务未能启动，请联系管理员。'}:{})}
 }
 async call(j,method){const w=this.backend(j.tenantId);if(!w)throw Error('Worker unavailable');const headers={Authorization:'Bearer '+w.token};if(method==='POST'){headers['Content-Type']='application/json';let youtube='';try{youtube=guestYoutubeTaskToken(await this.youtubeAccess(j.tenantId))}catch{youtube=''}if(youtube)headers['X-Spur-Task-Youtube-Token']=youtube}return this.fetcher('http://127.0.0.1:'+w.port+'/api/creator-agent/'+(method==='POST'?'chat':'tasks/'+j.id),{method,headers,body:method==='POST'?JSON.stringify(j.payload):undefined,signal:AbortSignal.timeout(10000),redirect:'manual'})}
 async tick(){
  if(this.ticking)return;this.ticking=true
  try{
   // Never repost after an uncertain acknowledgement, including after restart.
   await Promise.all(this.jobs.filter(j=>['dispatching','running'].includes(j.phase)).map(async j=>{
    try{const r=await this.call(j,'GET');if(!r.ok)return;const s=await r.json();if(s.runId!==j.id)return
     if(['finished','failed'].includes(s.status)){j.phase=s.status;delete j.payload;j.error=s.error||undefined}
     else j.phase='running'
    }catch{/* Unknown outcome holds its slot; an outage cannot exceed the limit. */}
   }))
   this.save()
   for(const j of this.jobs.filter(j=>j.phase==='queued')){
    const active=this.jobs.filter(x=>['dispatching','running'].includes(x.phase))
    if(active.length>=2)break
    if(!this.allowed(j.tenantId)){j.phase='failed';j.error='此访客账号已停用。';delete j.payload;this.save();continue}
    if(active.some(x=>x.tenantId===j.tenantId))continue
    j.phase='dispatching';this.save() // Persist before the network request.
    try{const r=await this.call(j,'POST');
     if(r.status===202){const s=await r.json();if(s.runId===j.id)j.phase='running'}
     else if([400,401,403,413,422].includes(r.status)){j.phase='failed';j.error='独立执行环境拒绝此任务，请联系管理员。';delete j.payload}
     // 409/429/5xx/network errors are reconciled by GET, never guessed or reposted.
    }catch{}
    this.save()
   }
  }finally{this.ticking=false}
 }
}
