import {createReadStream,statSync} from 'node:fs'
export function parseRange(range,size){
 if(!range)return null
 const match=/^bytes=(\d*)-(\d*)$/.exec(range)
 if(!match||(!match[1]&&!match[2]))throw new Error('Invalid range')
 let start,end
 if(!match[1]){const count=Number(match[2]);if(!count)throw new Error('Invalid range');start=Math.max(0,size-count);end=size-1}
 else{start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),size-1):size-1}
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)throw new Error('Invalid range')
 return{start,end}
}
export function streamVideo(request,response,file){
 const size=statSync(file).size
 let range
 try{range=parseRange(request.headers.range,size)}catch{response.writeHead(416,{'Content-Range':`bytes */${size}`});response.end();return}
 const headers={'Content-Type':'video/mp4','Accept-Ranges':'bytes','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline; filename="spur-video.mp4"','Content-Length':range?range.end-range.start+1:size}
 if(range)headers['Content-Range']=`bytes ${range.start}-${range.end}/${size}`
 response.writeHead(range?206:200,headers)
 if(request.method==='HEAD'){response.end();return}
 const stream=createReadStream(file,range||{})
 stream.on('error',()=>response.destroy());response.on('close',()=>stream.destroy());stream.pipe(response)
}
