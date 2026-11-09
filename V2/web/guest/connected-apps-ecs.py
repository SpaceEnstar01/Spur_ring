#!/usr/bin/env python3
"""Publish the connected-apps page to the guest website.
Replaces static files only. Does not restart workers, Caddy, or the personal Agent.
Python 3.6 compatible.
"""
import os, shutil, sys
from pathlib import Path
from datetime import datetime
BASE = Path('/root/spur-web-guests')
STAGE = BASE / 'upgrade-connected-apps' / 'dist'
RELEASE = BASE / 'release' / 'dist'
MARKER = 'index-Ductc3ns.js'

def readable(path):
    for root, dirs, files in os.walk(str(path)):
        os.chmod(root, 0o755)
        for name in files:
            os.chmod(os.path.join(root, name), 0o644)

def main():
    if os.geteuid() != 0 or sys.argv[1:] != ['--apply']:
        raise RuntimeError('Run as root with --apply')
    index = STAGE / 'index.html'
    if not index.is_file() or not (STAGE / 'assets' / MARKER).is_file() or MARKER not in index.read_text():
        raise RuntimeError('Upload the connected apps package before applying')
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    backup = BASE / ('before-connected-apps-' + stamp)
    shutil.copytree(str(RELEASE), str(backup))
    try:
        shutil.rmtree(str(RELEASE))
        shutil.copytree(str(STAGE), str(RELEASE))
        readable(RELEASE)
        if MARKER not in (RELEASE / 'index.html').read_text():
            raise RuntimeError('Live page was not updated')
    except Exception:
        if RELEASE.exists():
            shutil.rmtree(str(RELEASE))
        shutil.copytree(str(backup), str(RELEASE))
        raise
    print('CONNECTED_APPS_READY')
    print('Backup: ' + str(backup))

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('CONNECTED_APPS_STOPPED: ' + (str(error) if isinstance(error, RuntimeError) else type(error).__name__), file=sys.stderr)
        sys.exit(1)
