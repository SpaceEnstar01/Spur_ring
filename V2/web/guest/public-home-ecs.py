#!/usr/bin/env python3
"""Guest frontend/gateway only; retain queue, invites, workers and Caddy."""
import json,os,shutil,subprocess,sys,time
from pathlib import Path
from datetime import datetime
import urllib.request
BASE=Path('/root/spur-web-guests')
STAGE=BASE/'upgrade-public-home'
NAME='spur-web-guest-gateway'
def run(args):
 p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True,timeout=60)
 if p.returncode:raise RuntimeError('Docker operation failed')
def check():
 for _ in range(20):
  try:
   def get(path):
    req=urllib.request.Request('http://127.0.0.1:4190'+path,headers={'Host':'ai.hispurring.com'})
    with urllib.request.urlopen(req,timeout=3) as r:return json.loads(r.read().decode())
   if get('/api/web-backend').get('mode')=='guest-public' and get('/healthz').get('queueEnabled') is True:return True
  except Exception:time.sleep(1)
 return False
def main():
 if os.geteuid()!=0 or sys.argv[1:]!=['--apply']:raise RuntimeError('Run as root with --apply')
 for path in [STAGE/'guest/gateway.mjs',STAGE/'dist/index.html',BASE/'release/guest/queue.mjs',BASE/'data/queue-enabled']:
  if not path.is_file():raise RuntimeError('Expected queued guest deployment and complete upgrade package')
 backup=BASE/('before-public-home-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
 shutil.copytree(str(BASE/'release'),str(backup))
 run(['docker','stop',NAME])
 try:
  shutil.copy2(str(STAGE/'guest/gateway.mjs'),str(BASE/'release/guest/gateway.mjs'))
  shutil.rmtree(str(BASE/'release/dist'));shutil.copytree(str(STAGE/'dist'),str(BASE/'release/dist'))
  run(['docker','start',NAME])
  if not check():raise RuntimeError('Public homepage gateway check failed')
 except Exception:
  run(['docker','stop',NAME])
  shutil.copy2(str(backup/'guest/gateway.mjs'),str(BASE/'release/guest/gateway.mjs'))
  shutil.rmtree(str(BASE/'release/dist'));shutil.copytree(str(backup/'dist'),str(BASE/'release/dist'))
  run(['docker','start',NAME]);raise
 print('PUBLIC_HOME_INVITE_READY')
 print('Public homepage; invitation required for tasks; existing identities and two-slot queue retained.')
 print('Backup: '+str(backup))
if __name__=='__main__':
 try:main()
 except Exception as e:print('PUBLIC_HOME_UPDATE_STOPPED: '+(str(e) if isinstance(e,RuntimeError) else type(e).__name__),file=sys.stderr);sys.exit(1)
