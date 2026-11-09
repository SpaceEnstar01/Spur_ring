const {mkdirSync,writeFileSync,appendFileSync} = require('node:fs');
const {join} = require('node:path');
const {randomUUID} = require('node:crypto');
const {generateImage} = require('./client.cjs');
exports.inject=['tools'];
exports.apply = function(ctx) {
 const out=process.env.SPUR_RESEARCH_OUTPUT;
 if (!out) throw new Error('Task output folder unavailable.');
 let calls=0;
 const log=e=>appendFileSync(join(out,'tool-events.jsonl'),JSON.stringify({at:new Date().toISOString(),...e})+'\n');
 ctx.tools.register({name:'image_generate',description:'Generate one actual image using the configured image model. Use immediately when asked for an image: preserve the requested subject and choose reasonable unspecified details. Do not search prompt-writing websites or substitute a prompt document/SVG for the image. Returns a saved image which the website will display. On failure briefly report the actual error.',parameters:{prompt:{type:'string',required:true},size:{type:'string',enum:['1024x1024','768x1024','1024x576','576x1024']}},output:{schema:{type:'object',additionalProperties:true},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},async execute(args){
  if (++calls>2) throw new Error('本轮最多生成两张图片。');
  const id=randomUUID();log({event:'call',id,tool:'image_generate',args:{prompt:args.prompt,size:args.size}});
  try {
   const image=await generateImage({apiKey:process.env.SILICONFLOW_API_KEY,baseUrl:process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1',model:process.env.SPUR_IMAGE_MODEL,prompt:args.prompt,size:args.size});
   const filename='image-'+id+image.extension;mkdirSync(join(out,'media'),{recursive:true});writeFileSync(join(out,'media',filename),image.bytes);
   log({event:'result',id,tool:'image_generate',available:true,filename,bytes:image.bytes.length});
   return {generated:true,filename,mime:image.mime,display:'The website displays this image automatically. Reply briefly that it is ready. Do not repeat the prompt or add unsolicited alternatives.'};
  } catch(error) {log({event:'result',id,tool:'image_generate',available:false,error:String(error.message)});throw error}
 }});
};
