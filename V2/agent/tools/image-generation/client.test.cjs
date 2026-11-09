const {test}=require('node:test');const assert=require('node:assert/strict');const {generateImage,imageType}=require('./client.cjs');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1cAAAAASUVORK5CYII=','base64');
const config={apiKey:'private-test-key',baseUrl:'https://api.siliconflow.cn/v1',model:'Tongyi-MAI/Z-Image-Turbo',prompt:'Stephen Curry playing basketball'};
test('generation uses configured model and actual image bytes',async()=>{
 let sent;
 const result=await generateImage(config,{fetchApi:async(url,options)=>{sent={url:String(url),...options};return{ok:true,json:async()=>({images:[{b64_json:png.toString('base64')}]})}}});
 assert.equal(sent.url,'https://api.siliconflow.cn/v1/images/generations');
 assert.equal(JSON.parse(sent.body).prompt,config.prompt);assert.equal(JSON.parse(sent.body).model,config.model);assert.equal(sent.headers.Authorization,'Bearer private-test-key');
 assert.equal(result.mime,'image/png');assert.deepEqual(result.bytes,png);
});
test('signed image URL goes to download adapter without API credentials',async()=>{
 let args;
 const result=await generateImage(config,{fetchApi:async()=>({ok:true,json:async()=>({images:[{url:'https://cdn.example.com/image.png?signature=private'}]})}),download:async(...input)=>{args=input;return png}});
 assert.equal(args.length,1);assert.equal(result.extension,'.png');assert.equal(JSON.stringify(args).includes(config.apiKey),false);
});
test('provider errors are concise and do not echo response body or credentials',async()=>{
 await assert.rejects(generateImage(config,{fetchApi:async()=>({ok:false,status:429,text:async()=>config.apiKey})}),error=>error.message.includes('429')&&!error.message.includes(config.apiKey));
 assert.throws(()=>imageType(Buffer.from('<svg>not a raster image</svg>')));
});
