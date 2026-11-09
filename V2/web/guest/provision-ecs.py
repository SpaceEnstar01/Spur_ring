#!/usr/bin/env python3
"""Run explicitly on ECS after uploading release. Only creates separate guest resources.
Does not modify Caddy, the personal Agent container or its volumes. Python 3.6 compatible.
"""
import json,os,secrets,socket,subprocess,sys,time
from pathlib import Path
BASE=Path('/root/spur-web-guests')
RELEASE=BASE/'release'
DATA=BASE/'data'
IMAGE='spur-agent:research-async-v3'
GATEWAY='spur-web-guest-gateway'

def run(args,data=None,timeout=90):
 p=subprocess.run(args,input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True,timeout=timeout)
 if p.returncode:raise RuntimeError('Docker operation failed; no credentials printed')
 return p.stdout

def private_json(path,value):
 fd=os.open(str(path),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:json.dump(value,f,ensure_ascii=False)

def admin(action,value):
 return json.loads(run(['docker','exec','-i',GATEWAY,'node','/app/guest/admin.mjs',action],json.dumps(value)))

def main():
 if sys.argv[1:]!=['--apply']:raise RuntimeError('Use --apply on ECS to create guest services')
 if os.geteuid()!=0:raise RuntimeError('Run as root on ECS')
 if (os.cpu_count() or 1)<2:raise RuntimeError('Fewer than two logical CPUs; review resource limits first')
 if not (RELEASE/'dist/index.html').is_file() or not (RELEASE/'guest/gateway.mjs').is_file():raise RuntimeError('Release not found')
 if not Path('/root/seccomp-playwright.json').is_file():raise RuntimeError('Verified seccomp profile missing')
 if DATA.exists() or (BASE/'invites-private.json').exists():raise RuntimeError('Guest data already exists; stopped to avoid replacing users')
 image=json.loads(run(['docker','image','inspect',IMAGE]))[0]
 if image.get('Architecture')!='amd64':raise RuntimeError('Expected amd64 image')
 names=run(['docker','ps','-a','--format','{{.Names}}']).splitlines()
 if GATEWAY in names or any('spur-web-guest-worker-' in n for n in names):raise RuntimeError('Guest containers already exist; stopped')
 for port in [4190,4300,4301]:
  s=socket.socket();s.settimeout(1)
  try:
   if s.connect_ex(('127.0.0.1',port))==0:raise RuntimeError('A required loopback port is already occupied')
  finally:s.close()
 personal=json.loads(run(['docker','inspect','spur-agent-ecs-smoke']))[0]
 config=dict(item.split('=',1) for item in personal['Config']['Env'] if '=' in item)
 if not config.get('SILICONFLOW_API_KEY'):raise RuntimeError('Model service credential not found')
 DATA.mkdir(mode=0o700);os.chown(str(DATA),10001,10001)
 run(['docker','run','-d','--name',GATEWAY,'--network','host','--restart','unless-stopped','--init','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory','192m','--cpus','0.25','--pids-limit','96','--tmpfs','/tmp:rw,nosuid,nodev,size=32m,mode=1777','--mount','type=bind,src='+str(RELEASE)+',dst=/app,readonly','--mount','type=bind,src='+str(DATA)+',dst=/data','-e','SPUR_GUEST_ROOT=/data','-e','SPUR_WEB_DIST=/app/dist','-e','PORT=4190','--no-healthcheck','--entrypoint','node',IMAGE,'/app/guest/gateway.mjs'])
 ready=False
 for _ in range(25):
  try:
   if admin('ping',{}).get('ok'):ready=True;break
  except Exception:pass
  time.sleep(1)
 if not ready:raise RuntimeError('Guest gateway did not start')
 invites=[]
 for index,port in enumerate([4300,4301],1):
  invitation=admin('issue',{'label':'friend-'+str(index)})
  tenant=invitation['tenantId'];token=secrets.token_urlsafe(32)
  if not __import__('re').fullmatch(r'guest-[a-f0-9]{24}',tenant):raise RuntimeError('Invalid generated tenant')
  volume='spur-web-'+tenant
  run(['docker','volume','create',volume])
  run(['docker','run','--rm','--user','0:0','--network','none','--mount','type=volume,src='+volume+',dst=/guest-data','--entrypoint','sh',IMAGE,'-c','chown 10001:10001 /guest-data && chmod 700 /guest-data'])
  env={k:config[k] for k in ['SILICONFLOW_API_KEY','SILICONFLOW_BASE_URL','SPUR_CHAT_MODEL'] if config.get(k)}
  env.update({'SPUR_CREATOR_AGENT_TOKEN':token,'SPUR_CONFIG_FILE':'/nonexistent/guest.env','SPUR_AGENTMAIL_AUTOSUMMARY':'0','SPUR_RESEARCH_ADAPTER_ENABLED':'1','SPUR_MEDIACRAWLER_LEARNING':'0','SPUR_MEDIACRAWLER_PROFILE_ROOT':'','SPUR_IMAGE_MODEL':'','SPUR_VIDEO_T2V_MODEL':'','YOUTUBE_API_KEY':'','NOTION_TOKEN':''})
  env_file=BASE/('worker-'+str(index)+'.env')
  if any('\n' in v or '\r' in v for v in env.values()):raise RuntimeError('Unsupported multiline configuration')
  fd=os.open(str(env_file),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
  with os.fdopen(fd,'w') as f:f.write('\n'.join(k+'='+v for k,v in env.items())+'\n')
  name='spur-web-guest-worker-'+str(index)
  run(['docker','run','-d','--name',name,'--restart','unless-stopped','--platform','linux/amd64','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--security-opt','seccomp=/root/seccomp-playwright.json','--memory','1536m','--cpus','0.5','--pids-limit','256','--shm-size','256m','--env-file',str(env_file),'--mount','type=volume,src='+volume+',dst=/opt/spur/V2/web/.runtime','--tmpfs','/home/spur:rw,uid=10001,gid=10001,mode=0700,size=128m','--tmpfs','/tmp:rw,nosuid,nodev,mode=1777,size=512m','-p','127.0.0.1:'+str(port)+':4173',IMAGE])
  admin('register',{'tenantId':tenant,'port':port,'token':token})
  invites.append({'label':'friend-'+str(index),'tenantId':tenant,'code':invitation['code'],'worker':name})
 private_json(BASE/'invites-private.json',invites)
 print('GUEST_SERVICES_CREATED')
 print('Two independent workers; 10 tasks/day/guest; no personal volumes or platform grants mounted.')
 print('Private invitation file: /root/spur-web-guests/invites-private.json (do not paste it into chat).')
 print('Caddy has NOT been modified. Run private smoke verification before connecting the domain.')

try:main()
except Exception as error:
 print('GUEST_SETUP_NOT_CONFIRMED: '+(str(error) if isinstance(error,RuntimeError) else type(error).__name__)+'. Existing personal services were not changed; do not rerun blindly.',file=sys.stderr)
 sys.exit(1)
