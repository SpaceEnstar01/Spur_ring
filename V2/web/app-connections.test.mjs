import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AppConnections } from './app-connections.mjs'
const scopes = 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly'
function fixture(t, fetchImpl) {
  const root=mkdtempSync(join(tmpdir(),'spur-connections-'))
  t.after(()=>rmSync(root,{recursive:true,force:true}))
  const config={SPUR_PUBLIC_URL:'https://agent.example.com',YOUTUBE_CLIENT_ID:'google-client',YOUTUBE_CLIENT_SECRET:'google-secret',NOTION_CLIENT_ID:'notion-client',NOTION_CLIENT_SECRET:'notion-secret'}
  const store=new AppConnections(root,config,fetchImpl || (async()=>{throw new Error('Unexpected network')}))
  const credential=store.createProfile().credential
  return {root,config,store,credential}
}
function callback(start,code='test-code') {const q=new URLSearchParams(new URL(start.authorizationUrl).search);q.set('code',code);return q}
function ok(data){return {ok:true,status:200,json:async()=>data}}
test('profiles cannot inherit developer credentials and private grants are encrypted at rest',async t=>{
  const {root,store,credential}=fixture(t,async()=>ok({access_token:'private-notion-access',workspace_name:'My Notes'}))
  assert.deepEqual(await store.taskConfig(credential),{NOTION_TOKEN:'',YOUTUBE_ACCESS_TOKEN:'',YOUTUBE_API_KEY:'',YOUTUBE_CLIENT_ID:'',YOUTUBE_CLIENT_SECRET:''})
  await store.callback('notion',callback(store.start(credential,'notion')))
  assert.equal((await store.taskConfig(credential)).NOTION_TOKEN,'private-notion-access')
  const other=store.createProfile().credential
  assert.equal((await store.taskConfig(other)).NOTION_TOKEN,'')
  for(const file of readdirSync(join(root,'app-connections')).filter(f=>f.startsWith('profile-')))assert.ok(!readFileSync(join(root,'app-connections',file),'utf8').includes('private-notion-access'))
  assert.throws(()=>store.profile('a'.repeat(43)),/无效/)
})
test('guest tenants receive separate YouTube credentials and cannot read each other',async t=>{
  const {store}=fixture(t,async()=>ok({access_token:'tenant-access',refresh_token:'tenant-refresh',expires_in:3600,scope:scopes}))
  const first='guest-'+'a'.repeat(24),second='guest-'+'b'.repeat(24)
  const firstCredential=store.credentialForTenant(first),secondCredential=store.credentialForTenant(second)
  assert.notEqual(firstCredential,secondCredential)
  assert.equal(store.credentialForTenant(first),firstCredential)
  await store.callback('youtube',callback(store.start(firstCredential,'youtube')))
  assert.equal((await store.taskConfig(firstCredential)).YOUTUBE_ACCESS_TOKEN,'tenant-access')
  assert.equal((await store.taskConfig(secondCredential)).YOUTUBE_ACCESS_TOKEN,'')
})
test('YouTube start uses fixed HTTPS redirect and PKCE; callback requires both scopes and refresh token',async t=>{
  const {store,credential}=fixture(t,async()=>ok({access_token:'access',refresh_token:'refresh',expires_in:3600,scope:scopes}))
  const start=store.start(credential,'youtube');const url=new URL(start.authorizationUrl)
  assert.equal(url.origin,'https://accounts.google.com')
  assert.equal(url.searchParams.get('redirect_uri'),'https://agent.example.com/api/connections/callback/youtube')
  assert.equal(url.searchParams.get('code_challenge_method'),'S256')
  await store.callback('youtube',callback(start))
  assert.equal((await store.taskConfig(credential)).YOUTUBE_ACCESS_TOKEN,'access')
  await assert.rejects(()=>store.callback('youtube',callback(start)),/已使用/)
})
test('denial, superseded flows and disconnect invalidate outstanding callbacks',async t=>{
  const {store,credential}=fixture(t)
  const old=store.start(credential,'notion');const current=store.start(credential,'notion')
  await assert.rejects(()=>store.callback('notion',callback(old)),/替代/)
  const denied=callback(current);denied.set('error','access_denied')
  await assert.rejects(()=>store.callback('notion',denied),/取消/)
  const pending=store.start(credential,'notion');store.disconnect(credential,'notion')
  await assert.rejects(()=>store.callback('notion',callback(pending)),/取消/)
})
test('callback cannot resurrect a disconnected grant while code exchange is in flight',async t=>{
  let finish;const response=new Promise(resolve=>{finish=resolve})
  const {store,credential}=fixture(t,()=>response)
  const request=store.callback('notion',callback(store.start(credential,'notion')))
  store.disconnect(credential,'notion');finish(ok({access_token:'late'}))
  await assert.rejects(()=>request,/取消/)
  assert.equal((await store.taskConfig(credential)).NOTION_TOKEN,'')
})
test('missing provider config fails closed without falling back to internal integration',t=>{
  const {store,credential,config}=fixture(t);config.NOTION_CLIENT_ID='';config.NOTION_TOKEN='developer'
  assert.throws(()=>store.start(credential,'notion'),/共享授权/)
  config.SPUR_PUBLIC_URL='http://localhost:4173';assert.throws(()=>store.start(credential,'youtube'),/尚未/)
})
test('Google partial consent is not stored as a connected account',async t=>{
  const {store,credential}=fixture(t,async()=>ok({access_token:'access',refresh_token:'refresh',scope:scopes.split(' ')[0]}))
  await assert.rejects(()=>store.callback('youtube',callback(store.start(credential,'youtube'))),/完整/)
  assert.equal((await store.taskConfig(credential)).YOUTUBE_ACCESS_TOKEN,'')
})
test('status probes real providers and returns no token fields',async t=>{
  const calls=[]
  const {store,credential}=fixture(t,async(url)=>{calls.push(url);return ok(url.includes('/token')?{access_token:'private',refresh_token:'refresh',scope:scopes,expires_in:3600}:{items:[{snippet:{title:'My channel'}}]})})
  await store.callback('youtube',callback(store.start(credential,'youtube')))
  const result=await store.status(credential)
  assert.equal(result.connections[0].state,'connected');assert.equal(result.connections[0].label,'My channel')
  assert.ok(calls.some(url=>url.includes('channels?')))
  assert.ok(!JSON.stringify(result).includes('private'))
})
test('concurrent refreshes share one request and preserve rotated token',async t=>{
  let count=0
  const {store,credential}=fixture(t,async()=>{count++;return ok({access_token:'fresh',refresh_token:'rotated',expires_in:3600})})
  const p=store.profile(credential);p.generations.notion='initial';p.grants.notion={access_token:'old',refresh_token:'old-refresh',expires:1,state:'connected'};store.write(`profile-${p.id}`,p)
  const tokens=await Promise.all([store.token(credential,'notion'),store.token(credential,'notion')])
  assert.deepEqual(tokens,['fresh','fresh']);assert.equal(count,1)
  assert.equal(store.profile(credential).grants.notion.refresh_token,'rotated')
})
