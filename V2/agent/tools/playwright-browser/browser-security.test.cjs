const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {createRequire}=require('node:module');
const {resolve}=require('node:path');
const {startPublicProxy}=require('./public-network.cjs');
const runtimeRequire=createRequire(resolve(__dirname,'../../runtime/mcp-servers/playwright-mcp/package.json'));
const {chromium}=runtimeRequire('playwright-core');
test('real Chromium: private redirects, subresources and POST stay blocked',async()=>{
 let hits=0;const blocked=[];
 const honeypot=http.createServer((req,res)=>{hits++;res.end('private secret')});
 await new Promise(resolve=>honeypot.listen(0,'127.0.0.1',resolve));
 const target=`http://127.0.0.1:${honeypot.address().port}/secret`;
 const proxy=await startPublicProxy({onBlocked:e=>blocked.push(e)});
 let browser;
 try {
  browser=await chromium.launch({channel:'chrome',headless:true,proxy:{server:proxy.url,bypass:'<-loopback>'},args:['--disable-quic','--force-webrtc-ip-handling-policy=disable_non_proxied_udp']});
  const context=await browser.newContext({serviceWorkers:'block'});const page=await context.newPage();
  await require('./read-only-page.cjs').default({page});
  await page.route('https://public-fixture.example/**',async route=>{
   if(route.request().url().endsWith('/redirect')) return route.fulfill({status:302,headers:{location:target}});
   return route.fulfill({contentType:'text/html',body:`<h1>Fixture</h1><iframe src="${target}"></iframe><img src="${target}"><script>fetch('${target}',{method:'POST',mode:'no-cors',body:'leak'}).catch(()=>{});</script>`});
  });
  await page.goto('https://public-fixture.example/page');
  await page.waitForTimeout(700);
  await page.goto('https://public-fixture.example/redirect').catch(()=>{});
  await page.waitForTimeout(200);
  assert.equal(hits,0,'no request may reach the private server');
  assert.ok(blocked.length>=1,'private browser requests must traverse proxy');
 }finally{await browser?.close();await proxy.close();await new Promise(resolve=>honeypot.close(resolve))}
});
