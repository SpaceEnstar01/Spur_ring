#!/usr/bin/env python3
"""Guest workers only. Preserve Docker isolation and existing volumes/credentials.
Uses Node's internal loader directly, avoiding the unavailable optional native binding.
Python 3.6 compatible. No packages installed; no Caddy/personal service changes.
"""
import json,os,subprocess,sys,time
from datetime import datetime
from pathlib import Path
BASE=Path('/root/spur-web-guests')
WRAPPER=BASE/'guest-node-internals.sh'
TARGET='/opt/spur/guest-node'
WORKERS=['spur-web-guest-worker-1','spur-web-guest-worker-2']

def run(args,timeout=60):
 p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True,timeout=timeout)
 if p.returncode:raise RuntimeError('Docker operation failed: '+args[1])
 return p.stdout.strip()

def plan(info,name,env_file,wrapper):
 if name not in WORKERS or info['Config']['User']!='10001:10001':raise RuntimeError('Unexpected worker identity')
 h=info['HostConfig']
 if not h.get('ReadonlyRootfs') or 'ALL' not in h.get('CapDrop',[]):raise RuntimeError('Unexpected isolation configuration')
 volumes=[m for m in info['Mounts'] if m['Destination']=='/opt/spur/V2/web/.runtime' and m['Type']=='volume']
 if len(volumes)!=1 or not volumes[0]['Name'].startswith('spur-web-guest-'):raise RuntimeError('Unexpected guest data volume')
 for m in info['Mounts']:
  if m not in volumes and m['Destination'] not in h.get('Tmpfs',{}):raise RuntimeError('Unexpected extra mount')
 port=h['PortBindings']['4173/tcp']
 expected='4301' if name.endswith('-2') else '4300'
 if len(port)!=1 or port[0]['HostIp']!='127.0.0.1' or port[0]['HostPort']!=expected:raise RuntimeError('Unexpected guest port')
 if not all(h.get(k,0)>0 for k in ['Memory','NanoCpus','PidsLimit','ShmSize']):raise RuntimeError('Missing resource limits')
 env=dict(x.split('=',1) for x in info['Config']['Env'] if '=' in x)
 env['SPUR_NODE_BIN']=TARGET
 if any('\n' in v or '\r' in v for v in env.values()):raise RuntimeError('Unsupported environment format')
 args=['docker','run','-d','--name',name,'--restart','unless-stopped','--platform','linux/amd64','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--security-opt','seccomp=/root/seccomp-playwright.json','--memory',str(h['Memory']),'--cpus',str(h['NanoCpus']/1e9),'--pids-limit',str(h['PidsLimit']),'--shm-size',str(h['ShmSize']),'--env-file',str(env_file),'--mount','type=volume,src='+volumes[0]['Name']+',dst=/opt/spur/V2/web/.runtime','--mount','type=bind,src='+str(wrapper)+',dst='+TARGET+',readonly','-p','127.0.0.1:'+expected+':4173']
 for dest,opts in h.get('Tmpfs',{}).items():args+=['--tmpfs',dest+':'+opts]
 args+=[info['Config']['Image']]
 if info['Config'].get('Cmd')!=['node','server.mjs']:raise RuntimeError('Unexpected worker command')
 return env,args

def healthy(name):
 script='fetch("http://127.0.0.1:4173/api/creator-agent/health",{headers:{Authorization:"Bearer "+process.env.SPUR_CREATOR_AGENT_TOKEN},signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'
 for _ in range(15):
  try:run(['docker','exec',name,'node','-e',script],10);return True
  except Exception:time.sleep(1)
 return False

def main():
 if sys.argv[1:]!=['--apply'] or os.geteuid()!=0:raise RuntimeError('Run as root with --apply on ECS')
 if not Path('/root/seccomp-playwright.json').is_file():raise RuntimeError('Verified seccomp profile missing')
 infos={}
 stamp=datetime.now().strftime('%Y%m%d-%H%M%S')
 for name in WORKERS:
  info=json.loads(run(['docker','inspect',name]))[0]
  env=dict(x.split('=',1) for x in info['Config']['Env'] if '=' in x)
  if env.get('SPUR_NODE_BIN')==TARGET:
   print(name+': ALREADY_PATCHED');continue
  plan(info,name,BASE/'unused.env',WRAPPER)
  run(['docker','exec',name,'node','--expose-internals','-e','if(!require("internal/modules/esm/loader").getOrInitializeCascadedLoader)process.exit(1)'])
  infos[name]=info
 WRAPPER.write_text('#!/bin/sh\nexec /usr/local/bin/node --expose-internals "$@"\n')
 os.chmod(str(WRAPPER),0o755)
 for name,info in infos.items():
  file=BASE/(name+'-loader-'+stamp+'.env')
  env,args=plan(info,name,file,WRAPPER)
  fd=os.open(str(file),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
  with os.fdopen(fd,'w') as f:f.write('\n'.join(k+'='+v for k,v in env.items())+'\n')
  backup=name+'-before-loader-'+stamp
  run(['docker','stop',name]);run(['docker','rename',name,backup])
  new_id=None
  try:
   new_id=run(args)
   if not healthy(name):raise RuntimeError('New worker health not confirmed')
  except Exception:
   if new_id:
    run(['docker','stop',name]);run(['docker','rm',name])
   else:
    # docker run may have created an exited container before returning an error.
    result=subprocess.run(['docker','inspect',name],stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True)
    if result.returncode==0:
     created=json.loads(result.stdout)[0]
     if created['Id']!=info['Id']:run(['docker','rm','-f',name])
   run(['docker','rename',backup,name]);run(['docker','start',name])
   raise RuntimeError('Guest worker restored; inspect before retrying')
  print(name+': LOADER_ENTRY_PATCHED_AND_HEALTHY')
  print('Rollback container: '+backup)
 print('GUEST_LOADER_PATCH_READY')
 print('Re-run the real guest task/isolation test. Model execution is not yet verified.')

if __name__=='__main__':
 try:main()
 except Exception as error:
  print('REPAIR_STOPPED: '+(str(error) if isinstance(error,RuntimeError) else type(error).__name__),file=sys.stderr);sys.exit(1)
