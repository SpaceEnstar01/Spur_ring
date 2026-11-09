const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
test('output contract, source requirement and complete artifact saving',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'spur-research-test-'));const old=process.env.SPUR_RESEARCH_OUTPUT;
 process.env.SPUR_RESEARCH_OUTPUT=dir;
 try{
  const tools=[];require('./index.cjs').apply({tools:{register:t=>tools.push(t)}});
  assert.ok(tools.every(t=>t.output.schema&&typeof t.output.render==='function'));
  const save=tools.find(t=>t.name==='creator_save_report');
  await assert.rejects(()=>save.execute({report:'no source',outline:'',prompt:''}),/sources/);
  await assert.rejects(()=>save.execute({report:'https://example.com',outline:'',prompt:''}),/Incomplete/);
  const result=await save.execute({report:'https://example.com\n'+'Original structural critique. '.repeat(10),outline:'Original outline. '.repeat(20),prompt:'Original prompt. '.repeat(20)});
  assert.equal(result.saved,true);assert.equal(result.paths.length,3);assert.ok(fs.existsSync(path.join(dir,'tool-events.jsonl')));
 }finally{process.env.SPUR_RESEARCH_OUTPUT=old;fs.rmSync(dir,{recursive:true,force:true})}
});
