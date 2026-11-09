const { execFile } = require('node:child_process');
const { existsSync, mkdirSync, realpathSync } = require('node:fs');
const { join, isAbsolute, dirname } = require('node:path');
const { randomUUID } = require('node:crypto');
const profiles = {xiaohongshu:'xhs',douyin:'dy',bilibili:'bili',weibo:'wb'};
// A dedicated manually authorized session is required. Never import a daily browser profile.
async function search() {
  return { ok: false, status: 'unavailable', provider: 'mediacrawler', items: [], error: { code: 'NEED_SETUP', message: 'Non-commercial learning use confirmed. Native execution still needs runtime verification and a dedicated authorized platform session; this adapter does not launch collection yet.' } };
}
function createLearningAdapter({python, root, profileRoot, taskRoot, learningEnabled=false, execute=execFile}) {
  let busy=false, calls=0;
  return {async search(input) {
    const unavailable = (code) => ({ok:false,status:'unavailable',provider:'mediacrawler',platform:input?.platform,items:[],error:{code}});
    const {validInput}=require('./adapter.cjs');
    let args;try{args=validInput(input);}catch{return unavailable('BAD_INPUT');}
    if(!profiles[args.platform] || args.query.includes(',')) return unavailable('BAD_INPUT');
    if(!learningEnabled || ![python,root,profileRoot,taskRoot].every(p=>p && isAbsolute(p))) return unavailable('NEED_SETUP');
    const profile=join(profileRoot,profiles[args.platform]);
    if(!existsSync(join(profile,'Default')) && !existsSync(join(profile,'spur-session.json'))) return unavailable('NEED_LOGIN');
    if(busy) return unavailable('BUSY');
    if(calls>=2) return unavailable('BUDGET_EXCEEDED');
    mkdirSync(taskRoot,{recursive:true,mode:0o700});
    const task=realpathSync(taskRoot), output=join(task,'mediacrawler-'+randomUUID());
    const home=join(task,'media-home');mkdirSync(home,{recursive:true,mode:0o700});
    busy=true;calls++;
    try {
      const argv=[join(__dirname,'media-learning-search.py'),'--root',root,'--profile',profile,'--output',output,'--platform',args.platform,'--query',args.query,'--limit',String(args.limit)];
      const env={PATH:dirname(python)+':'+dirname(process.execPath)+':/usr/bin:/bin',HOME:home,LANG:'en_US.UTF-8',PYTHONIOENCODING:'utf-8'};
      const result=await new Promise(resolve=>execute(python,argv,{env,cwd:root,timeout:65000,maxBuffer:512000,encoding:'utf8',shell:false,killSignal:'SIGTERM'},(error,stdout)=>resolve({error,stdout})));
      if(result.error) return unavailable(result.error.killed?'TIMEOUT':'UPSTREAM_BROKEN');
      let data;try{data=JSON.parse(result.stdout);}catch{return unavailable('UPSTREAM_INVALID');}
      if(!data.ok) return unavailable(['NEED_LOGIN','PROFILE_BUSY','TIMEOUT','UPSTREAM_BROKEN','INSUFFICIENT_EVIDENCE'].includes(data.error?.code)?data.error.code:'UPSTREAM_BROKEN');
      const {domains}=require('./capabilities.cjs');
      if(data.channel!==args.platform || data.backend!=='mediacrawler' || !Array.isArray(data.items)) return unavailable('UPSTREAM_INVALID');
      const items=data.items.slice(0,args.limit).filter(item=>{try{const u=new URL(item.url);return u.protocol==='https:'&&!u.username&&!u.password&&domains[args.platform].some(d=>u.hostname===d||u.hostname.endsWith('.'+d));}catch{return false;}}).map(item=>({title:String(item.title||'').slice(0,500),url:item.url,text:String(item.text||'').slice(0,6000),evidenceType:'native_search_result'}));
      if(!items.length) return unavailable('INSUFFICIENT_EVIDENCE');
      return {ok:true,status:'partial',platform:args.platform,provider:'mediacrawler',items,limits:{commentsAvailable:false,popularityRankingVerified:false,dateRangeVerified:false},error:null};
    } finally {busy=false;}
  }};
}
module.exports = { search, createLearningAdapter };
