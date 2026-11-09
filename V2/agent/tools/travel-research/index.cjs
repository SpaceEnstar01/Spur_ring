const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const {appendFileSync, writeFileSync, mkdirSync} = require('node:fs');
const {join} = require('node:path');
const {existsSync,readFileSync}=require('node:fs');
async function hostBridge(out,id,action,args){
 const folder=join(out,'bridge');mkdirSync(folder,{recursive:true});
 writeFileSync(join(folder,`${id}.request.json`),JSON.stringify({id,action,args}));
 const response=join(folder,`${id}.response.json`);
 for(let attempt=0;attempt<240;attempt++){if(existsSync(response))return JSON.parse(readFileSync(response,'utf8'));await new Promise(r=>setTimeout(r,1000));}
 throw new Error('Research host bridge unavailable; no fabricated fallback.');
}
const execute = promisify(execFile);
const output={schema:{type:'object',additionalProperties:true},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]};
exports.inject = ['tools'];
exports.apply = function(ctx) {
  const out = process.env.SPUR_RESEARCH_OUTPUT;
  mkdirSync(join(out,'evidence'),{recursive:true});
  let count=0;
  const log=(event)=>appendFileSync(join(out,'tool-events.jsonl'),JSON.stringify({at:new Date().toISOString(),...event})+'\n');
  for (const [name,action,field,description] of [
    ['creator_search','search','query','Search public YouTube video results first, with a web-search fallback. Use simple creator and travel terms; avoid site: operators.'],
    ['creator_video_metadata','metadata','url','Read real YouTube title, author, views, publish date and caption availability.'],
    ['creator_transcript','transcript','url','Read publicly accessible timestamped captions. May fail; never bypass login or access restrictions.'],
    ['creator_read_source','read_source','url','Read a public HTTPS article or transcript page. Not a video or screenshot observation tool.'],
  ].filter(([name]) => process.env.SPUR_REQUIRE_PUBLIC_PROXY !== '1' || ['creator_video_metadata','creator_transcript'].includes(name))) ctx.tools.register({name,description,output,parameters:{[field]:{type:'string',required:true}},async execute(args){
    const id=++count; if(id>24) throw new Error('Research call budget reached; save an honest report now.');
    log({event:'call',id,tool:name,args});
    let data;
    if(process.env.SPUR_RESEARCH_HOST_BRIDGE==='1') data=await hostBridge(out,id,action,args);
    else {
      if(process.env.SPUR_REQUIRE_PUBLIC_PROXY==='1' && !process.env.SPUR_PUBLIC_PROXY_URL) throw new Error('Public research network proxy unavailable.');
      const {stdout}=await execute(process.env.SPUR_RESEARCH_PYTHON||'python3',[join(__dirname,'research.py'),action,JSON.stringify(args)],{timeout:110000,maxBuffer:2000000,env:{PATH:process.env.PATH,HOME:process.env.HOME,LANG:'en_US.UTF-8',...(process.env.SPUR_PUBLIC_PROXY_URL ? {HTTPS_PROXY:process.env.SPUR_PUBLIC_PROXY_URL,HTTP_PROXY:process.env.SPUR_PUBLIC_PROXY_URL,NO_PROXY:''} : {})}});
      data=JSON.parse(stdout);
    }
    // Full source text stays internal to the session, not in the delivered artifacts.
    const summary={...data}; delete summary.segments; delete summary.text;
    if(data.segments) summary.segment_count=data.segments.length;
    writeFileSync(join(out,'evidence',`${id}-${action}.json`),JSON.stringify({args,...summary},null,2));
    log({event:'result',id,tool:name,source:data.source_url,available:data.available!==false,error:data.error});
    return data;
  }});
  if(process.env.SPUR_RESEARCH_EVIDENCE) ctx.tools.register({name:'creator_read_evidence',output,description:'Read evidence retained by the preceding real Harness research run. source_id=list lists calls and original URLs; a numeric source_id returns the previously retrieved response. Cached source timestamps remain retrieval times, not video timings.',parameters:{source_id:{type:'string',required:true}},async execute(args){
    const folder=join(process.env.SPUR_RESEARCH_EVIDENCE,'bridge');
    const fs=require('node:fs');
    log({event:'cache_read',source_id:args.source_id,from:process.env.SPUR_RESEARCH_EVIDENCE});
    if(args.source_id==='list')return {sources:fs.readdirSync(folder).filter(f=>f.endsWith('.request.json')).map(f=>JSON.parse(fs.readFileSync(join(folder,f),'utf8')))};
    if(!/^\d+$/.test(args.source_id))throw new Error('Invalid source id');
    return JSON.parse(fs.readFileSync(join(folder,args.source_id+'.response.json'),'utf8'));
  }});
  ctx.tools.register({name:'creator_save_report',output,description:'Save original Chinese research outputs. Must include verified source URLs, timestamped analysis and explicit unknowns; no complete or near-verbatim transcripts.',parameters:{report:{type:'string',required:true},outline:{type:'string',required:true},prompt:{type:'string',required:true},timed_transcript_verified:{type:'boolean'},visual_verified:{type:'boolean'}},async execute(args){
    if(!/^https:\/\//m.test(args.report)&&!args.report.includes('https://')) throw new Error('Report needs sources');
    for(const key of ['report','outline','prompt']) if(typeof args[key]!=='string'||args[key].length<150) throw new Error(`Incomplete ${key}`);
    for(const key of ['report','outline','prompt']) writeFileSync(join(out,`${key}.md`),args[key]+'\n');
    writeFileSync(join(out,'evidence-status.json'),JSON.stringify({timed_transcript_verified:args.timed_transcript_verified===true,visual_verified:args.visual_verified===true},null,2));
    log({event:'saved',files:['report.md','outline.md','prompt.md']});
    return {saved:true,paths:['report.md','outline.md','prompt.md'].map(x=>join(out,x))};
  }});
};
