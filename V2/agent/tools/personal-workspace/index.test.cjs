const {test}=require('node:test');const assert=require('node:assert/strict');const {mkdtempSync,rmSync,readFileSync}=require('node:fs');const {tmpdir}=require('node:os');const {join}=require('node:path');
test('plan, save, inspect and revise deliverables stay in task workspace',async()=>{
 const root=mkdtempSync(join(tmpdir(),'spur-task-'));const old=process.env.SPUR_RESEARCH_OUTPUT;process.env.SPUR_RESEARCH_OUTPUT=root;const tools=new Map();
 try {
  require('./index.cjs').apply({tools:{register:tool=>tools.set(tool.name,tool)}});
  await tools.get('update_plan').execute({steps:[{title:'核实信息',status:'in_progress'}]});
  assert.equal(JSON.parse(readFileSync(join(root,'plan.json'),'utf8')).steps[0].status,'in_progress');
  const saved=await tools.get('save_document').execute({filename:'研究报告.md',content:'有来源的任务结果'});
  assert.equal(saved.verified,true);
  assert.equal(saved.bytes,Buffer.byteLength('有来源的任务结果'));
  assert.match(saved.sha256,/^[a-f0-9]{64}$/);
  assert.equal((await tools.get('read_document').execute({filename:'研究报告.md'})).content,'有来源的任务结果');
  assert.deepEqual((await tools.get('list_documents').execute({})).files,['研究报告.md']);
  await assert.rejects(tools.get('save_document').execute({filename:'../outside.txt',content:'bad'}));
  await assert.rejects(tools.get('read_document').execute({filename:'/etc/passwd'}));
 }finally{if(old===undefined)delete process.env.SPUR_RESEARCH_OUTPUT;else process.env.SPUR_RESEARCH_OUTPUT=old;rmSync(root,{recursive:true,force:true})}
});
