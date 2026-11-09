// Local Unix socket only; this command must never be exposed as a public route.
import {request} from 'node:http'
const action=process.argv[2]
if(!['ping','issue','revoke','register'].includes(action))throw Error('Expected issue/revoke/register')
let input='';for await(const chunk of process.stdin)input+=chunk
const data=JSON.parse(input||'{}')
const req=request({socketPath:(process.env.SPUR_GUEST_ROOT||'/data')+'/admin.sock',path:'/'+action,method:'POST',headers:{'Content-Type':'application/json'}},res=>{let result='';res.on('data',c=>result+=c);res.on('end',()=>{if(res.statusCode!==200){console.error('Guest admin command failed');process.exitCode=1}else process.stdout.write(result)})})
req.setTimeout(10000,()=>req.destroy(Error('timeout')));req.on('error',()=>{console.error('Guest admin socket unavailable');process.exitCode=1});req.end(JSON.stringify(data))
