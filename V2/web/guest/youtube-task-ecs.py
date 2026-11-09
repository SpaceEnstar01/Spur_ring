#!/usr/bin/env python3
"""Give each signed-in guest's task its own short-lived YouTube access token.
Restarts guest workers and the guest gateway only.
Does not modify Caddy, DNS, or the personal Agent container.
Python 3.6 compatible. Never prints credentials or access tokens.
"""
import json, os, re, shutil, subprocess, sys, time
from pathlib import Path
from datetime import datetime
BASE = Path('/root/spur-web-guests')
STAGE = BASE / 'upgrade-youtube-task'
RELEASE = BASE / 'release'
FILES = BASE / 'youtube-task-files'
GATEWAY = 'spur-web-guest-gateway'
SERVER = '/opt/spur/V2/web/server.mjs'
CONNECTOR = '/opt/spur/V2/agent/tools/connectors/youtube'
APP_CONNECTIONS = '/opt/spur/V2/web/app-connections.mjs'

def run(args, timeout=90):
    completed = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=timeout)
    if completed.returncode:
        raise RuntimeError('Docker operation failed')
    return completed.stdout

def redact(text):
    text = re.sub(r'(?i)(authorization|token|secret|password|api[_-]?key)(["\s:=]+)[^\s"\']+', r'\1\2REDACTED', text or '')
    return re.sub(r'ya29\.[A-Za-z0-9._~+/=-]+', 'REDACTED', text)

def workers():
    names = run(['docker', 'ps', '-a', '--format', '{{.Names}}']).splitlines()
    found = [name for name in names if re.fullmatch(r'spur-web-guest-worker-\d+', name)]
    return sorted(found, key=lambda name: int(name.rsplit('-', 1)[1]))

def tasks_clear(name):
    probe = 'const fs=require("fs"),p="/opt/spur/V2/web/.runtime/runs";if(fs.existsSync(p))for(const n of fs.readdirSync(p)){const f=p+"/"+n+"/task.json";if(fs.existsSync(f)&&JSON.parse(fs.readFileSync(f,"utf8")).status==="running")process.exit(2)}'
    completed = subprocess.run(['docker', 'exec', name, 'node', '-e', probe], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=20)
    if completed.returncode == 2:
        raise RuntimeError('A guest task is still running')
    if completed.returncode:
        raise RuntimeError('Could not verify guest task state')

def install_files():
    (FILES / 'youtube').mkdir(parents=True, exist_ok=True)
    os.chmod(str(FILES), 0o755)
    for name in ['server.mjs', 'app-connections.mjs']:
        target = FILES / name
        shutil.copy2(str(STAGE / 'web' / name), str(target))
        os.chmod(str(target), 0o644)
    for name in ['index.cjs', 'client.cjs']:
        target = FILES / 'youtube' / name
        shutil.copy2(str(STAGE / 'youtube' / name), str(target))
        os.chmod(str(target), 0o644)
    os.chmod(str(FILES / 'youtube'), 0o755)

def write_env(info, path):
    if path.exists():
        raise RuntimeError('Worker environment file already exists')
    fd = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as handle:
        for item in info['Config']['Env']:
            if '=' not in item:
                continue
            key, value = item.split('=', 1)
            if key == 'YOUTUBE_ACCESS_TOKEN':
                continue
            if '\n' in value or '\r' in value:
                raise RuntimeError('Unsupported worker environment')
            handle.write(key + '=' + value + '\n')

def worker_args(info, name, env_file, overlay=True):
    host = info['HostConfig']
    if not host.get('ReadonlyRootfs') or info['Config'].get('User') not in ('10001:10001', '10001'):
        raise RuntimeError('Unexpected worker runtime')
    if host.get('NetworkMode') == 'host':
        raise RuntimeError('Unexpected worker network')
    bindings = (host.get('PortBindings') or {}).get('4173/tcp') or []
    if len(bindings) != 1 or bindings[0].get('HostIp') != '127.0.0.1':
        raise RuntimeError('Unexpected worker port')
    if not os.path.isfile('/root/seccomp-playwright.json'):
        raise RuntimeError('Verified seccomp profile missing')
    args = ['docker', 'run', '-d', '--name', name, '--restart', 'unless-stopped', '--platform', 'linux/amd64', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--security-opt', 'seccomp=/root/seccomp-playwright.json']
    if host.get('Memory'):
        args.extend(['--memory', str(host['Memory'])])
    if host.get('NanoCpus'):
        args.extend(['--cpus', str(host['NanoCpus'] / 1e9)])
    if host.get('PidsLimit'):
        args.extend(['--pids-limit', str(host['PidsLimit'])])
    if host.get('ShmSize'):
        args.extend(['--shm-size', str(host['ShmSize'])])
    args.extend(['-p', '127.0.0.1:' + bindings[0]['HostPort'] + ':4173'])
    for dest, opts in (host.get('Tmpfs') or {}).items():
        args.extend(['--tmpfs', dest + ':' + opts])
    for mount in info['Mounts']:
        if mount['Destination'] in (SERVER, CONNECTOR, APP_CONNECTIONS):
            continue
        if mount['Type'] == 'volume':
            args.extend(['--mount', 'type=volume,src=' + mount['Name'] + ',dst=' + mount['Destination']])
        elif mount['Type'] == 'bind':
            option = ',readonly' if mount.get('RW') is False else ''
            args.extend(['--mount', 'type=bind,src=' + mount['Source'] + ',dst=' + mount['Destination'] + option])
    if overlay:
        args.extend([
            '--mount', 'type=bind,src=' + str(FILES / 'server.mjs') + ',dst=' + SERVER + ',readonly',
            '--mount', 'type=bind,src=' + str(FILES / 'app-connections.mjs') + ',dst=' + APP_CONNECTIONS + ',readonly',
            '--mount', 'type=bind,src=' + str(FILES / 'youtube') + ',dst=' + CONNECTOR + ',readonly',
        ])
    args.extend(['--env-file', str(env_file), info['Config']['Image']])
    return args

def healthy_worker(name):
    probe = 'fetch("http://127.0.0.1:4173/api/creator-agent/health",{headers:{Authorization:"Bearer "+process.env.SPUR_CREATOR_AGENT_TOKEN},signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'
    for _ in range(25):
        check = subprocess.run(['docker', 'exec', name, 'node', '-e', probe], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
        if check.returncode == 0:
            return True
        time.sleep(1)
    return False

def recreate_worker(name, stamp):
    info = json.loads(run(['docker', 'inspect', name]))[0]
    env_file = BASE / ('worker-youtube-task-' + name + '-' + stamp + '.env')
    write_env(info, env_file)
    updated = worker_args(info, name, env_file, True)
    original = worker_args(info, name, env_file, False)
    removed = False
    created = None
    try:
        # A stopped container keeps its published port, so remove it before replacement.
        run(['docker', 'stop', name])
        run(['docker', 'rm', name])
        removed = True
        created = subprocess.run(updated, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=90)
        if created.returncode:
            detail = redact(created.stderr or created.stdout or '').strip().splitlines()
            raise RuntimeError('Worker start failed: ' + (detail[-1][:180] if detail else 'docker run failed'))
        if not healthy_worker(name):
            raise RuntimeError('Worker health check failed')
    except Exception:
        failed = subprocess.run(['docker', 'logs', '--tail', '40', name], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, timeout=30)
        fd = os.open(str(BASE / 'youtube-task-failure.log'), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, 'w') as handle:
            handle.write(redact((created.stderr if created else '') or ''))
            handle.write('\n' + redact(failed.stdout or ''))
        if not removed:
            subprocess.run(['docker', 'start', name], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
            raise
        subprocess.run(['docker', 'rm', '-f', name], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
        run(original)
        if not healthy_worker(name):
            raise RuntimeError('Worker rollback failed')
        raise

def gateway_ready():
    probe = 'const http=require("http");const req=http.get({host:"127.0.0.1",port:4190,path:"/healthz",headers:{Host:"ai.hispurring.com"}},res=>{res.resume();process.exit(res.statusCode===200?0:1)});req.on("error",()=>process.exit(1));req.setTimeout(3000,()=>{req.destroy();process.exit(1)})'
    for _ in range(25):
        check = subprocess.run(['docker', 'exec', GATEWAY, 'node', '-e', probe], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
        if check.returncode == 0:
            return True
        time.sleep(1)
    return False

def update_gateway():
    backup = BASE / ('before-youtube-task-gateway-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
    backup.mkdir()
    for name in ['gateway.mjs', 'queue.mjs']:
        shutil.copy2(str(RELEASE / 'guest' / name), str(backup / name))
        shutil.copy2(str(STAGE / 'guest' / name), str(RELEASE / 'guest' / name))
    run(['docker', 'restart', GATEWAY])
    try:
        if not gateway_ready():
            raise RuntimeError('Gateway health check failed')
    except Exception:
        for name in ['gateway.mjs', 'queue.mjs']:
            shutil.copy2(str(backup / name), str(RELEASE / 'guest' / name))
        run(['docker', 'restart', GATEWAY])
        raise
    return backup

def main():
    if os.geteuid() != 0 or sys.argv[1:] != ['--apply']:
        raise RuntimeError('Run as root with --apply')
    required = [STAGE / 'guest/gateway.mjs', STAGE / 'guest/queue.mjs', STAGE / 'web/server.mjs', STAGE / 'web/app-connections.mjs', STAGE / 'youtube/index.cjs', STAGE / 'youtube/client.cjs']
    for path in required:
        if not path.is_file():
            raise RuntimeError('Upload the YouTube task package before applying')
    names = workers()
    if not names:
        raise RuntimeError('No guest workers found')
    for name in names:
        tasks_clear(name)
    install_files()
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    updated = []
    for name in names:
        recreate_worker(name, stamp)
        updated.append(name)
        print(name + ': TASK_TOKEN_READY')
    backup = update_gateway()
    print('YOUTUBE_TASK_READY')
    print('Workers updated: ' + str(len(updated)))
    print('Gateway file backup: ' + str(backup))
    print('Use the same signed-in guest and ask again. The page shows the channel name only; no token is displayed.')

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('YOUTUBE_TASK_UPDATE_STOPPED: ' + (str(error) if isinstance(error, RuntimeError) else type(error).__name__), file=sys.stderr)
        sys.exit(1)
