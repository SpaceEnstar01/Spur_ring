import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const check = new URL('./healthcheck.mjs', import.meta.url).href;
function run(token, ok=true) {
 const script = `globalThis.fetch=async(_url,options)=>{if(${JSON.stringify(token)} && options.headers.Authorization!=="Bearer "+${JSON.stringify(token)})throw Error('Missing auth');return {ok:${ok},json:async()=>({status:'ready'})}};await import(${JSON.stringify(check)});`;
 return spawnSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,SPUR_CREATOR_AGENT_TOKEN:token},encoding:'utf8'}).status;
}
test('health check authenticates without exposing token',()=>assert.equal(run('private-test-token'),0));
test('health check preserves failure when server is not ready',()=>assert.equal(run('',false),1));
