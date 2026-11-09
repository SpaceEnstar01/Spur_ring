const {mkdirSync,writeFileSync,readFileSync,readdirSync,appendFileSync} = require('node:fs');
const {randomUUID,createHash} = require('node:crypto');
const {join} = require('node:path');

exports.inject = ['tools'];
exports.apply = function(ctx) {
  const root = process.env.SPUR_RESEARCH_OUTPUT;
  if (!root) throw new Error('Task workspace is not configured.');
  const folder = join(root,'documents');
  mkdirSync(folder,{recursive:true});
  const output = {schema:{type:'object',additionalProperties:true},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]};
  const log = event => appendFileSync(join(root,'tool-events.jsonl'),JSON.stringify({at:new Date().toISOString(),...event})+'\n');
  const register = (name,description,parameters,execute) => ctx.tools.register({name,description,parameters,output,async execute(args) {
    const id=randomUUID();
    log({event:'call',id,tool:name,args:{...args,content:args.content ? `[${Buffer.byteLength(args.content)} bytes]` : undefined}});
    try {
      const result=await execute(args);
      log({event:'result',id,tool:name,available:true});
      return result;
    } catch(error) {log({event:'result',id,tool:name,available:false,error:String(error.message)});throw error}
  }});
  function nameOf(name) {
    if (typeof name !== 'string' || !/^[\p{L}\p{N}_ -]{1,80}\.(md|txt|csv|json)$/u.test(name)) throw new Error('Use a simple .md/.txt/.csv/.json filename without directory components.');
    return name;
  }
  register('update_plan','Record and revise the current task plan. Set each step to pending, in_progress, completed or blocked. A saved plan is not proof of completed work; verify outputs before marking completed.',{
    steps:{type:'array',required:true,items:{type:'object',properties:{title:{type:'string'},status:{type:'string',enum:['pending','in_progress','completed','blocked']},evidence:{type:'string'}},required:['title','status'],additionalProperties:false}},
  },async ({steps}) => {
    if (!Array.isArray(steps) || steps.length < 1 || steps.length > 12 || steps.some(s=>!s.title || s.title.length>300 || !['pending','in_progress','completed','blocked'].includes(s.status) || String(s.evidence || '').length>2000)) throw new Error('Provide 1–12 bounded plan steps.');
    writeFileSync(join(root,'plan.json'),JSON.stringify({updatedAt:new Date().toISOString(),steps},null,2));
    return {saved:true,steps};
  });
  register('save_document','Save an original task deliverable. Automatically reads back the file and verifies byte-for-byte persistence; returns bytes and SHA-256. No extra read_document call is needed just to check storage. This check does not verify factual accuracy. Cite sources and distinguish unknowns.',{filename:{type:'string',required:true},content:{type:'string',required:true}},async ({filename,content}) => {
    nameOf(filename);
    if (typeof content !== 'string' || !content.trim() || Buffer.byteLength(content)>300000) throw new Error('Document must contain 1–300000 bytes.');
    if (readdirSync(folder).length >= 12 && !readdirSync(folder).includes(filename)) throw new Error('Task document limit reached.');
    writeFileSync(join(folder,filename),content);
    const stored = readFileSync(join(folder,filename));
    if (!stored.equals(Buffer.from(content))) throw new Error('Document persistence verification failed.');
    return {saved:true,filename,verified:true,bytes:stored.length,sha256:createHash('sha256').update(stored).digest('hex')};
  });
  register('read_document','Inspect a document saved in this task before revising or delivering it.',{filename:{type:'string',required:true}},async ({filename}) => ({filename:nameOf(filename),content:readFileSync(join(folder,nameOf(filename)),'utf8')}));
  register('list_documents','List this task’s saved deliverables.',{},async () => ({files:readdirSync(folder)}));
};
