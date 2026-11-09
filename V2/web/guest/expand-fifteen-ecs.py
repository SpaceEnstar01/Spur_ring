#!/usr/bin/env python3
"""Explicit ECS upgrade: 15 isolated visitors, durable two-slot gateway queue.
Python 3.6; existing image, Caddy and personal services are untouched.
"""
import json, os, secrets, shutil, socket, subprocess, sys, time
from pathlib import Path
from datetime import datetime
BASE=Path('/root/spur-web-guests')
GATEWAY='spur-web-guest-gateway'
STAGE=BASE/'upgrade-fifteen'

def run(args,data=None,timeout=90):
 p=subprocess.run(args,input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True,timeout=timeout)
 if p.returncode:raise RuntimeError('Command failed: '+args[0]+' '+args[1]+'; credentials not printed')
 return p.stdout.strip()

def private_json(path,value):
 tmp=path.with_name(path.name+'.tmp')
 fd=os.open(str(tmp),os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
 with os.fdopen(fd,'w') as f:json.dump(value,f)
 os.chmod(str(tmp),0o600);os.replace(str(tmp),str(path))

def admin(action,value):
 return json.loads(run(['docker','exec','-i',GATEWAY,'node','/app/guest/admin.mjs',action],json.dumps(value)))

def healthy(name):
 code='fetch("http://127.0.0.1:4173/api/creator-agent/health",{headers:{Authorization:"Bearer "+process.env.SPUR_CREATOR_AGENT_TOKEN},signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'
 for _ in range(20):
  try:run(['docker','exec',name,'node','-e',code],timeout=8);return True
  except Exception:time.sleep(1)
 return False

def main():
 if sys.argv[1:]!=['--apply'] or os.geteuid()!=0:raise RuntimeError('Run as root with --apply')
 if (BASE/'data/queue-enabled').exists():raise RuntimeError('Queue upgrade already enabled; do not repeat')
 for file in ['guest/gateway.mjs','guest/queue.mjs','dist/index.html']:
  if not (STAGE/file).is_file():raise RuntimeError('Upgrade package incomplete')
 available=next(int(x.split()[1]) for x in Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:'))
 if available<5*1024*1024:raise RuntimeError('Less than 5 GiB available; review capacity before adding workers')
 template=json.loads(run(['docker','inspect','spur-web-guest-worker-1']))[0]
 h=template['HostConfig'];env=dict(x.split('=',1) for x in template['Config']['Env'] if '=' in x)
 wrapper=BASE/'guest-node-internals.sh'
 if template['Config']['User']!='10001:10001' or not h.get('ReadonlyRootfs') or env.get('SPUR_NODE_BIN')!='/opt/spur/guest-node' or not wrapper.is_file():raise RuntimeError('Expected verified isolated loader-patched worker')
 # Select only model connection configuration. Never clone personal/platform grants.
 model={k:env[k] for k in ['SILICONFLOW_API_KEY','SILICONFLOW_BASE_URL','SPUR_CHAT_MODEL'] if env.get(k)}
 if not model.get('SILICONFLOW_API_KEY'):raise RuntimeError('Model credential missing')
 invites_path=BASE/'invites-private.json'
 invites=json.loads(invites_path.read_text())
 if len(invites)<2 or len(invites)>15:raise RuntimeError('Unexpected invitation inventory')
 for i,entry in enumerate(invites,1):
  if entry.get('worker')!='spur-web-guest-worker-'+str(i):raise RuntimeError('Unexpected worker mapping')
 # Issue 13 new identities at most; original logins and data are retained.
 while len(invites)<15:
  i=len(invites)+1
  invitation=admin('issue',{'label':'friend-'+str(i)})
  invites.append(dict(invitation,label='friend-'+str(i),worker='spur-web-guest-worker-'+str(i)))
  private_json(invites_path,invites)
 for i,entry in enumerate(invites[2:],3):
  name=entry['worker'];port=4299+i;volume='spur-web-'+entry['tenantId'];env_file=BASE/('worker-'+str(i)+'.env')
  names=run(['docker','ps','-a','--format','{{.Names}}']).splitlines()
  if name not in names:
   sock=socket.socket()
   try:
    if sock.connect_ex(('127.0.0.1',port))==0:raise RuntimeError('Worker port occupied')
   finally:sock.close()
   if not env_file.exists():
    config=dict(model)
    config.update({'SPUR_CREATOR_AGENT_TOKEN':secrets.token_urlsafe(32),'SPUR_CONFIG_FILE':'/nonexistent/guest.env','SPUR_AGENTMAIL_AUTOSUMMARY':'0','SPUR_RESEARCH_ADAPTER_ENABLED':'1','SPUR_MEDIACRAWLER_LEARNING':'0','SPUR_MEDIACRAWLER_PROFILE_ROOT':'','SPUR_IMAGE_MODEL':'','SPUR_VIDEO_T2V_MODEL':'','YOUTUBE_API_KEY':'','NOTION_TOKEN':'','SPUR_NODE_BIN':'/opt/spur/guest-node'})
    if any('\n' in v or '\r' in v for v in config.values()):raise RuntimeError('Multiline environment refused')
    fd=os.open(str(env_file),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as f:f.write('\n'.join(k+'='+v for k,v in config.items())+'\n')
   run(['docker','volume','create',volume])
   run(['docker','run','--rm','--user','0:0','--network','none','--mount','type=volume,src='+volume+',dst=/guest-data','--entrypoint','sh',template['Config']['Image'],'-c','chown 10001:10001 /guest-data && chmod 700 /guest-data'])
   run(['docker','run','-d','--name',name,'--restart','unless-stopped','--platform','linux/amd64','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--security-opt','seccomp=/root/seccomp-playwright.json','--memory','1536m','--cpus','0.5','--pids-limit','256','--shm-size','256m','--env-file',str(env_file),'--mount','type=volume,src='+volume+',dst=/opt/spur/V2/web/.runtime','--mount','type=bind,src='+str(wrapper)+',dst=/opt/spur/guest-node,readonly','--tmpfs','/home/spur:rw,uid=10001,gid=10001,mode=0700,size=128m','--tmpfs','/tmp:rw,nosuid,nodev,mode=1777,size=512m','-p','127.0.0.1:'+str(port)+':4173',template['Config']['Image']])
  info=json.loads(run(['docker','inspect',name]))[0]
  config=dict(x.split('=',1) for x in info['Config']['Env'] if '=' in x)
  volumes=[m for m in info['Mounts'] if m['Type']=='volume']
  binding=info['HostConfig']['PortBindings'].get('4173/tcp')
  if len(volumes)!=1 or volumes[0]['Name']!=volume or binding!=[{'HostIp':'127.0.0.1','HostPort':str(port)}]:raise RuntimeError('Unexpected worker identity')
  if not healthy(name):raise RuntimeError('Worker health not ready: '+name)
  registry=json.loads((BASE/'data/workers.json').read_text())
  if entry['tenantId'] not in registry:admin('register',{'tenantId':entry['tenantId'],'port':port,'token':config['SPUR_CREATOR_AGENT_TOKEN']})
  elif registry[entry['tenantId']]['port']!=port or registry[entry['tenantId']]['token']!=config['SPUR_CREATOR_AGENT_TOKEN']:raise RuntimeError('Registry mismatch')
  print(name+': HEALTH_READY')
 # Pause only guest ingress, then refuse upgrade if ANY previous guest task is running.
 stamp=datetime.now().strftime('%Y%m%d-%H%M%S');backup=BASE/('before-fifteen-'+stamp)
 shutil.copytree(str(BASE/'release'),str(backup))
 run(['docker','stop',GATEWAY]);changed=False
 try:
  check='const fs=require("fs"),p="/opt/spur/V2/web/.runtime/runs";if(fs.existsSync(p))for(const n of fs.readdirSync(p)){const f=p+"/"+n+"/task.json";if(fs.existsSync(f)&&JSON.parse(fs.readFileSync(f)).status==="running")process.exit(2)}'
  for entry in invites:run(['docker','exec',entry['worker'],'node','-e',check])
  shutil.copytree(str(BASE/'data'),str(backup/'private-data'))
  changed=True
  for file in ['gateway.mjs','queue.mjs']:shutil.copy2(str(STAGE/'guest'/file),str(BASE/'release/guest'/file))
  shutil.rmtree(str(BASE/'release/dist'));shutil.copytree(str(STAGE/'dist'),str(BASE/'release/dist'))
  marker=BASE/'data/queue-enabled';marker.write_text('two-slots-v1\n');os.chmod(str(marker),0o600);os.chown(str(marker),10001,10001)
  run(['docker','start',GATEWAY])
  import urllib.request
  ready=False
  for _ in range(20):
   try:
    req=urllib.request.Request('http://127.0.0.1:4190/healthz',headers={'Host':'ai.hispurring.com'})
    with urllib.request.urlopen(req,timeout=3) as r:
     if r.status==200 and json.loads(r.read().decode()).get('queueEnabled') is True:ready=True;break
   except Exception:time.sleep(1)
  if not ready:raise RuntimeError('Updated gateway health failed')
 except Exception:
  if changed:
   run(['docker','stop',GATEWAY])
   marker=BASE/'data/queue-enabled'
   if marker.exists():marker.unlink()
   for file in ['gateway.mjs']:shutil.copy2(str(backup/'guest'/file),str(BASE/'release/guest'/file))
   shutil.rmtree(str(BASE/'release/dist'));shutil.copytree(str(backup/'dist'),str(BASE/'release/dist'))
  run(['docker','start',GATEWAY]);raise
 print('FIFTEEN_GUESTS_QUEUE_READY')
 print('15 separate visitors; maximum 2 active guest tasks; 10 tasks/day/visitor.')
 print('Private invitations: '+str(invites_path)+' (do not paste contents into chat)')
 print('Guest release backup: '+str(backup))
 print('Real ECS concurrency and browser queue acceptance are still required.')

if __name__=='__main__':
 try:main()
 except Exception as e:
  print('UPGRADE_STOPPED: '+(str(e) if isinstance(e,RuntimeError) else type(e).__name__)+'. Personal API and Caddy were not modified.',file=sys.stderr);sys.exit(1)
