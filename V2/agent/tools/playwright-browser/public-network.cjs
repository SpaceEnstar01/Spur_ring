const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const dns = require('node:dns/promises');

const blocked = new net.BlockList();
for (const [ip, bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]]) blocked.addSubnet(ip,bits,'ipv4');
for (const [ip, bits] of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]]) blocked.addSubnet(ip,bits,'ipv6');
const global6 = new net.BlockList();
global6.addSubnet('2000::',3,'ipv6');

function isPublicAddress(address) {
  const family = net.isIP(address);
  if (family === 4) return !blocked.check(address,'ipv4');
  // Reject mapped IPv4, ULA, link-local, transition and non-global IPv6.
  return family === 6 && global6.check(address,'ipv6') && !blocked.check(address,'ipv6');
}

function publicUrl(value) {
  const url = new URL(value);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80','443'].includes(url.port))) throw new Error('Only public HTTP(S) pages on ports 80/443 are supported.');
  const hostname = url.hostname.replace(/^\[|\]$/g,'');
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || (net.isIP(hostname) && !isPublicAddress(hostname))) throw new Error('Private, local or reserved network destination blocked.');
  return url;
}

async function resolvePublic(hostname, lookup = dns.lookup) {
  const records = await lookup(hostname, {all:true, verbatim:true});
  if (!records.length || records.some(({address}) => !isPublicAddress(address))) throw new Error('DNS resolved to a private or reserved address.');
  return records.find(({family}) => family === 4) || records[0];
}

// Resolve once, validate all answers, then connect to the numeric address. Each
// redirected URL and subresource makes a new proxy request and is checked again.
async function startPublicProxy({lookup = dns.lookup, connect = net.connect, onBlocked = () => {}} = {}) {
  const sockets = new Set();
  const fail = (target,error) => onBlocked({target,error:String(error.message || error)});
  const server = http.createServer(async (req,res) => {
    try {
      const url = publicUrl(req.url);
      if (url.protocol !== 'http:' || !['GET','HEAD'].includes(req.method)) throw new Error('Read-only HTTP required.');
      const record = await resolvePublic(url.hostname,lookup);
      const headers = {...req.headers,host:url.host};
      delete headers['proxy-authorization']; delete headers['proxy-connection'];
      const upstream = http.request({hostname:record.address,family:record.family,port:url.port || 80,path:url.pathname+url.search,method:req.method,headers,agent:false}, reply => {
        res.writeHead(reply.statusCode,reply.headers); reply.pipe(res);
      });
      upstream.setTimeout(30000,() => upstream.destroy(new Error('Upstream timeout')));
      upstream.on('error',() => { if (!res.headersSent) res.writeHead(502); res.end(); });
      res.on('close',() => upstream.destroy());
      upstream.end();
    } catch (error) { fail(req.url,error); res.writeHead(403); res.end('Public network policy blocked destination.'); }
  });
  server.on('connect',async (req,socket,head) => {
    try {
      const url = publicUrl('https://'+req.url);
      if ((url.port || '443') !== '443') throw new Error('CONNECT requires TLS port 443.');
      const record = await resolvePublic(url.hostname.replace(/^\[|\]$/g,''),lookup);
      if (socket.destroyed) return;
      const upstream = connect({host:record.address,family:record.family,port:443});
      sockets.add(upstream); upstream.on('close',() => sockets.delete(upstream));
      upstream.setTimeout(45000,() => upstream.destroy());
      upstream.once('connect',() => {
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) upstream.write(head);
        socket.pipe(upstream); upstream.pipe(socket);
      });
      upstream.on('error',() => socket.destroy());
      upstream.on('close',() => socket.destroy());
      socket.on('close',() => upstream.destroy());
    } catch (error) { fail(req.url,error); socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); }
  });
  server.on('connection',socket => { sockets.add(socket); socket.on('error',() => {}); socket.on('close',() => sockets.delete(socket)); });
  await new Promise((resolve,reject) => { server.once('error',reject); server.listen(0,'127.0.0.1',resolve); });
  return {url:`http://127.0.0.1:${server.address().port}`,close:async () => { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); }};
}
async function fetchPublic(value, redirects = 0, options = {}) {
  const {binary = false, maxBytes = 2000000, timeoutMs = 10000, mediaKind = 'image'} = options;
  if (redirects > 5) throw new Error('Public fetch redirect limit reached.');
  const url = publicUrl(value);
  const hostname = url.hostname.replace(/^\[|\]$/g,'');
  const record = await resolvePublic(hostname);
  const result = await new Promise((resolve,reject) => {
    const req = (url.protocol === 'https:' ? https : http).get({hostname:record.address,family:record.family,port:url.port || (url.protocol === 'https:' ? 443 : 80),servername:hostname,headers:{Host:url.host,'User-Agent':'Spur/1.0 public research','Accept':'text/html,application/xml,text/plain'},path:url.pathname+url.search,agent:false},res => {
      const type = res.headers['content-type'] || '';
      if (res.statusCode >= 200 && res.statusCode < 300 && type && !(binary ? (mediaKind === 'video' ? /^(video\/mp4(?:;|$)|application\/octet-stream(?:;|$)|binary\/octet-stream(?:;|$))/i.test(type) : /^(image\/|application\/octet-stream(?:;|$)|binary\/octet-stream(?:;|$))/i.test(type)) : /^(text\/|application\/(json|xml|xhtml\+xml|rss\+xml))/i.test(type))) { res.destroy(new Error('Public fetch supports HTML and text sources only.')); reject(new Error('Unsupported source content type.')); return; }
      let size=0;const chunks=[];
      res.on('data',chunk=>{size+=chunk.length;if(size>maxBytes) res.destroy(new Error('Public source exceeds size limit.'));else chunks.push(chunk)});
      res.on('error',reject);
      res.on('end',()=>resolve({status:res.statusCode,location:res.headers.location,...(binary ? {bytes:Buffer.concat(chunks)} : {text:Buffer.concat(chunks).toString('utf8')}),url:url.href}));
    });
    const timer=setTimeout(()=>req.destroy(new Error('Public fetch timeout.')),timeoutMs);
    req.on('close',()=>clearTimeout(timer));req.on('error',reject);
  });
  if ([301,302,303,307,308].includes(result.status) && result.location) return fetchPublic(new URL(result.location,url).href,redirects+1,options);
  if (result.status < 200 || result.status >= 300) throw new Error(`Public source returned HTTP ${result.status}.`);
  return result;
}
module.exports = {isPublicAddress,publicUrl,resolvePublic,startPublicProxy,fetchPublic};
