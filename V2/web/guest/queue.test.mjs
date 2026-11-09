import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {GuestQueue} from './queue.mjs'
function fixture(t){
 const root=mkdtempSync(join(tmpdir(),'spur-queue-'));t.after(()=>rmSync(root,{recursive:true,force:true}))
 const calls=[],states=new Map();let lost=false,outage=false
 const options={root,backend:id=>({port:4300+Number(id),token:'x'.repeat(43)}),fetcher:async(url,o)=>{
  if(outage)throw Error('offline')
  if(o.method==='POST'){const p=JSON.parse(o.body);calls.push({tenant:new URL(url).port,id:p.requestId});states.set(p.requestId,'running');if(lost)throw Error('lost acknowledgement');return Response.json({runId:p.requestId},{status:202})}
  const id=url.split('/').at(-1);return states.has(id)?Response.json({runId:id,status:states.get(id)}):Response.json({error:'not found'},{status:404})
 }}
 const q=new GuestQueue(options)
 const enqueue=(tenant,id)=>q.enqueue(tenant,{requestId:id,message:'hello',async:true})
 return {root,options,q,calls,states,enqueue,setLost:v=>lost=v,setOutage:v=>outage=v}
}
test('fifteen visitors, only two execute; completion automatically admits next',async t=>{
 const {q,calls,states,enqueue}=fixture(t);for(let i=0;i<15;i++)enqueue(String(i),'job-'+i)
 await Promise.all([q.tick(),q.tick()]);assert.equal(calls.length,2);assert.equal(q.snapshot('2','job-2').queue.position,1)
 assert.equal(q.snapshot('1','job-2'),null)
 states.set('job-0','finished');await q.tick();assert.deepEqual(calls.map(c=>c.id),['job-0','job-1','job-2']);assert.equal(q.snapshot('2','job-2').queue.state,'running')
})
test('same tenant is serial while another visitor can use the second slot',async t=>{
 const {q,calls,enqueue}=fixture(t);enqueue('0','a');enqueue('0','b');enqueue('1','c');await q.tick();assert.deepEqual(calls.map(c=>c.id),['a','c'])
})
test('lost acknowledgement and gateway restart never repost a task',async t=>{
 const {q,options,calls,enqueue,setLost,states}=fixture(t);enqueue('0','a');enqueue('1','b');enqueue('2','c');setLost(true);await q.tick();assert.equal(calls.length,2)
 const restarted=new GuestQueue(options);await restarted.tick();assert.equal(calls.length,2)
 states.set('a','finished');setLost(false);await restarted.tick();assert.equal(calls.length,3);assert.equal(calls.filter(x=>x.id==='a').length,1)
})
test('unreachable active workers retain slots, queued tasks remain durable',async t=>{
 const {q,options,calls,enqueue,setOutage}=fixture(t);enqueue('0','a');enqueue('1','b');enqueue('2','c');await q.tick();setOutage(true);await q.tick();assert.equal(calls.length,2)
 assert.equal(new GuestQueue(options).snapshot('2','c').queue.state,'queued')
})
test('worker failure releases slot; revoked queued visitor never executes',async t=>{
 const {q,calls,enqueue,states}=fixture(t);enqueue('0','a');enqueue('1','b');enqueue('2','c');enqueue('3','d');await q.tick();q.allowed=id=>id!=='2';states.set('a','failed');await q.tick();assert.equal(q.snapshot('2','c').status,'failed');assert.deepEqual(calls.map(c=>c.id),['a','b','d'])
})
test('duplicate queue ID is refused and pending queue is bounded',t=>{
 const {q,enqueue}=fixture(t);enqueue('0','a');assert.throws(()=>enqueue('0','a'),/已存在/);for(let i=1;i<150;i++)enqueue('0','a'+i);assert.throws(()=>enqueue('0','overflow'),/排队/);assert.equal(q.jobs.length,150)
})
