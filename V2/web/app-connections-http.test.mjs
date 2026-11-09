import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'

test('isolated HTTP: bearer enrollment, profile scope, safe public callback, no developer fallback',async t=>{
 const root=mkdtempSync(join(tmpdir(),'spur-connection-http-'))
 const port=await new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});})
 const empty=join(root,'empty.env');writeFileSync(empty,'')
 const bearer='b'.repeat(43)
 const child=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{env:{PATH:process.env.PATH,HOME:root,HOST:'127.0.0.1',PORT:String(port),SPUR_RUNTIME_ROOT:root,SPUR_CONFIG_FILE:empty,SPUR_CREATOR_AGENT_TOKEN:bearer,NOTION_TOKEN:'developer-must-not-inherit'},stdio:'ignore'})
 t.after(async()=>{child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);});rmSync(root,{recursive:true,force:true})})
 const base=`http://127.0.0.1:${port}`
 let up=false
 for(let i=0;i<100;i++){try{await fetch(base+'/api/creator-agent/health');up=true;break}catch{await new Promise(r=>setTimeout(r,50))}}
 assert.ok(up,'fixture started')
 const endpoint=base+'/api/creator-agent/connections'
 assert.equal((await fetch(endpoint)).status,401)
 const headers={Authorization:`Bearer ${bearer}`}
 const enroll=await fetch(endpoint+'/profile',{method:'POST',headers});assert.equal(enroll.status,201)
 const {credential}=await enroll.json();assert.match(credential,/^[A-Za-z0-9_-]{43}$/)
 assert.equal((await fetch(endpoint,{headers})).status,401)
 const scoped={...headers,'X-Spur-Connection':credential}
 const state=await (await fetch(endpoint,{headers:scoped})).json()
 assert.equal(state.connections.find(c=>c.provider==='notion').state,'disconnected')
 assert.equal(state.connections.find(c=>c.provider==='notion').configured,false)
 assert.equal((await fetch(endpoint+'/notion/start',{method:'POST',headers:scoped})).status,503)
 assert.equal((await fetch(endpoint,{headers:{...headers,'X-Spur-Connection':'a'.repeat(43)}})).status,401)
 const callback=await fetch(base+'/api/connections/callback/notion?state=bad&code=secret')
 assert.equal(callback.status,400);assert.ok(!(await callback.text()).includes('secret'))
 assert.equal(callback.headers.get('referrer-policy'),'no-referrer')
})
