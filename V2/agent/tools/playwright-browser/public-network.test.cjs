const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const {isPublicAddress,publicUrl,resolvePublic,startPublicProxy} = require('./public-network.cjs');

test('reject local, metadata, reserved and IPv6 transition addresses',() => {
  for (const ip of ['127.0.0.1','10.0.0.1','172.16.1.1','192.168.1.1','169.254.169.254','100.100.100.200','198.18.0.1','224.0.0.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2002:7f00:1::','2001:db8::1']) assert.equal(isPublicAddress(ip),false,ip);
  for (const ip of ['1.1.1.1','8.8.8.8','2606:4700:4700::1111']) assert.equal(isPublicAddress(ip),true,ip);
  for (const url of ['file:///etc/passwd','http://127.1','http://2130706433','http://[::1]','https://user:pass@example.com','http://example.com:8787','http://metadata.local']) assert.throws(()=>publicUrl(url),undefined,url);
  for (const host of ['speedtest.net','huawei.com','apple.com','wikipedia.org']) assert.equal(publicUrl('https://'+host).hostname,host);
});

test('DNS validates every answer and fails closed',async () => {
  await assert.rejects(resolvePublic('mixed.test',async()=>[{address:'1.1.1.1',family:4},{address:'127.0.0.1',family:4}]));
  await assert.rejects(resolvePublic('empty.test',async()=>[]));
});

test('CONNECT pins validated IP and rechecks DNS on later connections',async () => {
  const connections=[];
  let calls=0;
  const proxy=await startPublicProxy({lookup:async()=>[{address:++calls===1?'1.1.1.1':'127.0.0.1',family:4}],connect:options=>{connections.push(options);const stream=new net.Socket();queueMicrotask(()=>stream.destroy());return stream;}});
  try {
    const request=()=>new Promise(resolve=>{const req=http.request(proxy.url,{method:'CONNECT',path:'rebinding.test:443'});req.on('connect',(res,socket)=>{socket.destroy();resolve(res.statusCode)});req.on('error',()=>resolve(0));req.on('close',()=>resolve(0));req.end()});
    await request();
    assert.equal(await request(),403);
    assert.equal(connections.length,1);
    assert.equal(connections[0].host,'1.1.1.1');
  } finally {await proxy.close()}
});

test('HTTP redirect follow-up and subresource destinations cannot reach private network',async()=>{
  const proxy=await startPublicProxy({lookup:async()=>[{address:'127.0.0.1',family:4}]});
  try {
    for (const target of ['http://127.0.0.1/secret','http://redirect-target.test/metadata','http://subresource.test/private']) {
      const code=await new Promise((resolve,reject)=>{const req=http.get(proxy.url,{path:target},res=>{res.resume();resolve(res.statusCode)});req.on('error',reject)});
      assert.equal(code,403);
    }
  } finally {await proxy.close()}
});
