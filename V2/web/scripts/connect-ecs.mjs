// Run interactively on the owner's Mac. Never copies the full ECS environment.
import {execFileSync} from 'node:child_process'
import {mkdirSync,chmodSync,writeFileSync,renameSync,rmSync,lstatSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
const folder=join(homedir(),'.local/share/spur/web-cloud')
mkdirSync(folder,{recursive:true,mode:0o700})
if(lstatSync(folder).isSymbolicLink())throw Error('配置目录不能是符号链接。')
chmodSync(folder,0o700)
const temporary=join(folder,'token-'+randomUUID())
try{
 const value=execFileSync('ssh',['-o','ConnectTimeout=10','root@47.254.17.22',`docker exec spur-agent-ecs-smoke node -e 'process.stdout.write(process.env.SPUR_CREATOR_AGENT_TOKEN || "")'`],{encoding:'utf8',stdio:['inherit','pipe','inherit'],timeout:180000}).trim()
 if(!/^[A-Za-z0-9_-]{43}$/.test(value))throw Error('服务器没有返回有效访问令牌；配置未更新。')
 writeFileSync(temporary,value,{mode:0o600,flag:'wx'})
 renameSync(temporary,join(folder,'agent-token'))
 console.log('WEB_ECS_CREDENTIAL_READY：单独的访问令牌已保存到本机私有目录，未打印凭据。')
 console.log('重启 V2/web 的 npm run dev 后，页面刷新应显示“硅谷 ECS · 已连接”。')
}catch{console.error('配置未完成，请核对 SSH 登录和正式容器状态；未输出凭据。');process.exitCode=1}
finally{rmSync(temporary,{force:true})}
