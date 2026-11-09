import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {MailNotifications} from './notifications.mjs'
function fixture(t,options={}){
 const root=mkdtempSync(join(tmpdir(),'spur-mail-notices-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const file=join(root,'notifications.json');return {file,store:new MailNotifications(file,{enabled:true,list:async()=>[],summarize:async()=>({summary:'待处理',needsAttention:true}),...options})};
}
const mail=id=>({id,subject:'测试来信',sender:'test@example.test',threadId:'thread-'+id,timestamp:'2026-11-06T00:00:00Z'});
test('first sync imports history without AI or notifications; new mail is summarized exactly once',async t=>{
 let incoming=[mail('old')],calls=0;
 const {store}=fixture(t,{list:async()=>incoming,summarize:async()=>{calls++;return {summary:'请确认时间',needsAttention:true}}});
 await store.tick();assert.equal(calls,0);assert.equal(store.view().unreadCount,0);
 incoming=[mail('new'),mail('old')];await store.tick();await store.tick();
 assert.equal(calls,1);assert.equal(store.view().unreadCount,1);assert.equal(store.view().notifications[0].summary,'请确认时间');
 store.read('new');assert.equal(store.view().unreadCount,0);
});
test('restart retains unread and completed summaries, without re-running AI',async t=>{
 let incoming=[];const {store,file}=fixture(t,{list:async()=>incoming});await store.tick();incoming=[mail('new')];await store.tick();
 let calls=0;const restored=new MailNotifications(file,{enabled:true,list:async()=>incoming,summarize:async()=>{calls++;}});
 await restored.tick();assert.equal(calls,0);assert.equal(restored.view().unreadCount,1);
});
test('model failures retry with bounded backoff and never fabricate a completed summary',async t=>{
 let incoming=[],now=0,calls=0;const {store}=fixture(t,{now:()=>now,list:async()=>incoming,summarize:async()=>{calls++;throw new Error('model down')}});
 await store.tick();incoming=[mail('new')];await store.tick();await store.tick();assert.equal(calls,1);
 now=60000;await store.tick();now=180000;await store.tick();now=999999;await store.tick();
 assert.equal(calls,3);assert.equal(store.view().notifications[0].state,'failed');assert.equal(store.view().unreadCount,1);
});
test('concurrent polling is serialized; unread read survives summary completion',async t=>{
 let incoming=[];let resolve;const delayed=new Promise(r=>{resolve=r});const {store}=fixture(t,{list:async()=>incoming,summarize:()=>delayed});
 await store.tick();incoming=[mail('new')];const pending=store.tick();await new Promise(r=>setTimeout(r,0));
 await store.tick();store.read('new');resolve({summary:'已总结',needsAttention:false});await pending;
 assert.equal(store.view().unreadCount,0);assert.equal(store.view().notifications.length,1);
});
test('corrupt notification storage fails closed',async t=>{
 const {file}=fixture(t);writeFileSync(file,'bad json');let calls=0;
 const store=new MailNotifications(file,{enabled:true,list:async()=>{calls++;return []},summarize:async()=>{}});
 await store.tick();assert.equal(calls,0);assert.match(store.view().error,/不可读取/);
});
test('unconfigured worker never fetches mail or calls model',async t=>{
 let calls=0;const {store}=fixture(t,{enabled:false,list:async()=>{calls++;return []}});await store.tick();assert.equal(calls,0);
});
