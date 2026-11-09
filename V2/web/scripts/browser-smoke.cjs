const {resolve,join}=require('node:path');
const {mkdirSync,writeFileSync}=require('node:fs');
const root=resolve(__dirname,'../..');
const out=join(root,'web/.runtime/validation',new Date().toISOString().replace(/[:.]/g,'-'));
mkdirSync(out,{recursive:true});
process.env.SPUR_PLAYWRIGHT_MCP_ROOT=join(root,'agent/runtime/mcp-servers/playwright-mcp');
process.env.SPUR_RESEARCH_OUTPUT=out;
const tools=new Map();let cleanup;
(async()=>{
  await require('../../agent/tools/playwright-browser/index.cjs').apply({tools:{register:t=>{tools.set(t.name,t);return()=>{}}},effect:f=>{cleanup=f()}});
  const results=[];
  try {
    for(const url of process.argv.slice(2)){
      try{const r=await tools.get('browser_navigate').execute({url});writeFileSync(join(out,`page-${results.length}.txt`),r.text); const title=r.text.match(/Page Title: (.*)/)?.[1];results.push({url,ok:true,title,characters:r.text.length,preview:r.text.slice(0,240)});}catch(error){results.push({url,ok:false,error:error.message.slice(0,500)})}
      console.log(JSON.stringify(results.at(-1)));
    }
    writeFileSync(join(out,'results.json'),JSON.stringify({tools:[...tools.keys()],results},null,2));console.log('Evidence:',out);
  }finally{cleanup?.()}
})().catch(e=>{console.error(e);process.exitCode=1});
