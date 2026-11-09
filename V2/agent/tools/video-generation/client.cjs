const {fetchPublic} = require('../playwright-browser/public-network.cjs');
async function api(config,path,payload,fetchApi=fetch) {
 const endpoint=new URL(config.baseUrl.replace(/\/$/,'')+path);
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||!config.apiKey) throw new Error('视频服务配置无效。');
 const response=await fetchApi(endpoint,{method:'POST',headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000),redirect:'error'});
 if(!response.ok){const error=new Error(`视频服务返回 HTTP ${response.status}。`);error.definitive=response.status>=400&&response.status<500;throw error}
 return response.json();
}
async function submitVideo(config,{prompt,size='1280x720'},fetchApi=fetch){
 if(!config.model) throw new Error('尚未配置视频模型。');
 if(typeof prompt!=='string'||!prompt.trim()||prompt.length>4000) throw new Error('视频描述应为 1–4000 个字符。');
 if(!['1280x720','720x1280','960x960'].includes(size)) throw new Error('不支持的视频尺寸。');
 const result=await api(config,'/video/submit',{model:config.model,prompt,image_size:size},fetchApi);
 if(typeof result.requestId!=='string'||!result.requestId.trim()) throw new Error('视频服务未返回任务编号；不会自动重复提交。');
 return result.requestId;
}
async function videoStatus(config,requestId,fetchApi=fetch){
 if(typeof requestId!=='string'||!requestId||requestId.length>200)throw new Error('视频任务编号无效。');
 const result=await api(config,'/video/status',{requestId},fetchApi);
 const status={InQueue:'queued',InProgress:'generating',Succeed:'ready',Failed:'failed'}[result.status];
 if(!status)throw new Error('视频服务返回未知状态。');
 return {status,url:status==='ready'?result.results?.videos?.[0]?.url:undefined};
}
async function downloadVideo(url){
 const result=await fetchPublic(url,0,{binary:true,maxBytes:200000000,timeoutMs:120000,mediaKind:'video'});
 const bytes=result.bytes;
 if(bytes.length<12||bytes.toString('ascii',4,8)!=='ftyp')throw new Error('返回文件不是有效的 MP4 视频。');
 return bytes;
}
module.exports={submitVideo,videoStatus,downloadVideo};
