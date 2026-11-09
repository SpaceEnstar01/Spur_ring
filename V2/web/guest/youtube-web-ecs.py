#!/usr/bin/env python3
"""Enable guest-site YouTube OAuth. Restarts only the guest gateway.
Does not modify Caddy, workers, or the personal Agent container.
Python 3.6 compatible. Never prints credentials.
"""
import json, os, shutil, subprocess, sys, time
from pathlib import Path
from datetime import datetime
BASE = Path('/root/spur-web-guests')
RELEASE = BASE / 'release'
DATA = BASE / 'data'
STAGE = BASE / 'upgrade-youtube-web'
NAME = 'spur-web-guest-gateway'
PERSONAL = 'spur-agent-ecs-smoke'

def run(args, timeout=90):
    p = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=timeout)
    if p.returncode:
        raise RuntimeError('Docker operation failed')
    return p.stdout

def main():
    if os.geteuid() != 0 or sys.argv[1:] != ['--apply']:
        raise RuntimeError('Run as root with --apply')
    for path in [STAGE / 'dist/index.html', STAGE / 'guest/gateway.mjs', STAGE / 'app-connections.mjs']:
        if not path.is_file():
            raise RuntimeError('Upload the YouTube web package before applying')
    info = json.loads(run(['docker', 'inspect', NAME]))[0]
    host = info['HostConfig']
    mounts = {item['Destination']: item for item in info['Mounts']}
    if host.get('NetworkMode') != 'host' or mounts.get('/app', {}).get('Source') != str(RELEASE) or mounts.get('/data', {}).get('Source') != str(DATA):
        raise RuntimeError('Guest gateway layout is not the expected release mount')
    if info['Config'].get('User') not in ('', '10001:10001', '10001'):
        raise RuntimeError('Unexpected gateway user')
    personal = json.loads(run(['docker', 'inspect', PERSONAL]))[0]
    env = dict(item.split('=', 1) for item in personal['Config']['Env'] if '=' in item)
    client_id = env.get('YOUTUBE_CLIENT_ID', '').strip()
    client_secret = env.get('YOUTUBE_CLIENT_SECRET', '').strip()
    if not client_id or not client_secret or '\n' in client_id or '\r' in client_id or '\n' in client_secret or '\r' in client_secret:
        raise RuntimeError('YouTube client is missing on the personal service')
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    backup = BASE / ('before-youtube-web-' + stamp)
    shutil.copytree(str(RELEASE), str(backup))
    gateway_env = {item.split('=', 1)[0]: item.split('=', 1)[1] for item in info['Config']['Env'] if '=' in item}
    gateway_env['YOUTUBE_CLIENT_ID'] = client_id
    gateway_env['YOUTUBE_CLIENT_SECRET'] = client_secret
    env_file = BASE / ('gateway-youtube-' + stamp + '.env')
    fd = os.open(str(env_file), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as handle:
        for key in sorted(gateway_env):
            value = gateway_env[key]
            if '\n' in value or '\r' in value:
                raise RuntimeError('Unsupported environment value')
            handle.write(key + '=' + value + '\n')
    shutil.copy2(str(STAGE / 'guest/gateway.mjs'), str(RELEASE / 'guest/gateway.mjs'))
    shutil.copy2(str(STAGE / 'app-connections.mjs'), str(RELEASE / 'app-connections.mjs'))
    if (RELEASE / 'dist').exists():
        shutil.rmtree(str(RELEASE / 'dist'))
    shutil.copytree(str(STAGE / 'dist'), str(RELEASE / 'dist'))
    old = NAME + '-before-youtube-' + stamp
    run(['docker', 'stop', NAME])
    run(['docker', 'rename', NAME, old])
    started = False
    try:
        args = ['docker', 'run', '-d', '--name', NAME, '--network', 'host', '--restart', 'unless-stopped', '--init', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true']
        if host.get('Memory'):
            args.extend(['--memory', str(host['Memory'])])
        if host.get('NanoCpus'):
            args.extend(['--cpus', str(host['NanoCpus'] / 1e9)])
        if host.get('PidsLimit'):
            args.extend(['--pids-limit', str(host['PidsLimit'])])
        for dest, opts in (host.get('Tmpfs') or {}).items():
            args.extend(['--tmpfs', dest + ':' + opts])
        args.extend(['--mount', 'type=bind,src=' + str(RELEASE) + ',dst=/app,readonly', '--mount', 'type=bind,src=' + str(DATA) + ',dst=/data', '--env-file', str(env_file), '--no-healthcheck', '--entrypoint', 'node', info['Config']['Image'], '/app/guest/gateway.mjs'])
        run(args)
        started = True
        ready = False
        probe = 'const http=require("http");const req=http.get({host:"127.0.0.1",port:4190,path:"/healthz",headers:{Host:"ai.hispurring.com"}},res=>{res.resume();process.exit(res.statusCode===200?0:1)});req.on("error",()=>process.exit(1));req.setTimeout(3000,()=>{req.destroy();process.exit(1)})'
        probe_error = ''
        for _ in range(25):
            check = subprocess.run(['docker', 'exec', NAME, 'node', '-e', probe], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
            if check.returncode == 0:
                ready = True
                break
            probe_error = (check.stderr or check.stdout or '').strip()
            time.sleep(1)
        log = subprocess.run(['docker', 'logs', '--tail', '40', NAME], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, timeout=30).stdout or ''
        if not ready:
            raise RuntimeError('Gateway health check failed')
        if 'YouTube guest connections enabled' not in log:
            raise RuntimeError('YouTube connections were not enabled')
    except Exception:
        if started:
            failed = subprocess.run(['docker', 'logs', '--tail', '80', NAME], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, timeout=30)
            fd = os.open('/root/spur-web-guests/youtube-web-failure.log', os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, 'w') as handle:
                handle.write(failed.stdout or '')
                if probe_error:
                    handle.write('\nPROBE\n' + probe_error + '\n')
            subprocess.run(['docker', 'rm', '-f', NAME], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
        shutil.rmtree(str(RELEASE))
        shutil.copytree(str(backup), str(RELEASE))
        run(['docker', 'rename', old, NAME])
        run(['docker', 'start', NAME])
        raise
    print('YOUTUBE_WEB_GATEWAY_READY')
    print('Backup: ' + str(backup))
    print('Previous gateway container: ' + old)
    print('Add this redirect in the existing Google client, then test with one guest invite: https://ai.hispurring.com/api/connections/callback/youtube')

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('YOUTUBE_WEB_UPDATE_STOPPED: ' + (str(error) if isinstance(error, RuntimeError) else type(error).__name__), file=sys.stderr)
        sys.exit(1)
