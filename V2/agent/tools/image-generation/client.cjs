const {fetchPublic} = require('../playwright-browser/public-network.cjs');
function imageType(bytes) {
  if (bytes.length>=8 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return {extension:'.png',mime:'image/png'};
  if (bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return {extension:'.jpg',mime:'image/jpeg'};
  if (bytes.length>=12 && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP') return {extension:'.webp',mime:'image/webp'};
  throw new Error('生图服务没有返回有效的 PNG/JPEG/WebP 图片。');
}
async function generateImage({apiKey,baseUrl,model,prompt,size='1024x1024'}, {fetchApi=fetch,download=async url=>(await fetchPublic(url,0,{binary:true,maxBytes:20000000,timeoutMs:40000})).bytes} = {}) {
  if (!apiKey || !model) throw new Error('尚未配置生图服务。');
  if (typeof prompt!=='string' || !prompt.trim() || prompt.length>4000) throw new Error('图片描述应为 1–4000 个字符。');
  if (!['1024x1024','768x1024','1024x576','576x1024'].includes(size)) throw new Error('不支持的图片尺寸。');
  const endpoint = new URL(baseUrl.replace(/\/$/,'')+'/images/generations');
  if (endpoint.protocol!=='https:' || endpoint.username || endpoint.password) throw new Error('生图服务地址必须为可信 HTTPS 配置。');
  const response=await fetchApi(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},body:JSON.stringify({model,prompt,image_size:size,batch_size:1}),signal:AbortSignal.timeout(120000),redirect:'error'});
  if (!response.ok) throw new Error(`生图服务返回 HTTP ${response.status}，尚未生成图片。`);
  const body=await response.json();
  const first=(body.images || body.data)?.[0];
  let bytes;
  if (first?.b64_json) bytes=Buffer.from(first.b64_json,'base64');
  else {
    const url=typeof first==='string'?first:first?.url;
    if (!url) throw new Error('生图服务返回结果中没有图片。');
    bytes=await download(url);
  }
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length>20000000) throw new Error('生成图片为空或超过 20 MB。');
  return {bytes,...imageType(bytes)};
}
module.exports={generateImage,imageType};
