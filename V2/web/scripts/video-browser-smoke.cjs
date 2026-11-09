const {createRequire}=require('node:module');const {resolve}=require('node:path');const {readFileSync,writeFileSync}=require('node:fs');const http=require('node:http');
const runtimeRequire=createRequire(resolve(__dirname,'../../agent/runtime/mcp-servers/playwright-mcp/package.json'));
(async()=>{
 const {streamVideo}=await import('../video-stream.mjs');
 const file=resolve(__dirname,'../../files/football-video/football-on-ship-g6a4ybb3fbrr.mp4');
 const ranges=[];const server=http.createServer((req,res)=>{ranges.push(req.headers.range||null);streamVideo(req,res,file)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await runtimeRequire('playwright-core').chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();const response=JSON.parse(readFileSync(resolve(__dirname,'../.runtime/video-test-result.json'),'utf8'));const id=response.videoJobs[0].id;
  await page.goto('http://127.0.0.1:4173');await page.locator(`[data-video-job="${id}"]`).waitFor();
  await page.reload();await page.locator(`[data-video-job="${id}"]`).waitFor();
  await page.screenshot({path:resolve(__dirname,'../.runtime/validation/video-pending-ui.png'),fullPage:true});
  console.log('Real queued job restored after reload:',id);
  await page.setContent(`<video controls preload="metadata" src="http://127.0.0.1:${server.address().port}/video.mp4"></video>`);
  await page.waitForFunction(()=>document.querySelector('video').readyState>=1);
  const metadata=await page.locator('video').evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight}));
  if(!metadata.duration||!metadata.width)throw new Error('Video decode failed');
  console.log('Previously generated real MP4 playback fixture:',JSON.stringify({metadata,ranges}));
  writeFileSync(resolve(__dirname,'../.runtime/validation/video-browser-smoke.json'),JSON.stringify({queuedJobRestored:id,previousVideoPlayback:{metadata,ranges}},null,2));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
