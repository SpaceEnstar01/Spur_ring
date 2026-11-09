#!/usr/bin/env python3
"""Publish Idea and Memory pages to the guest website.
Replaces static files only. Does not restart workers, Caddy, or the personal Agent.
Python 3.6 compatible.
"""
import os, shutil, sys
from pathlib import Path
from datetime import datetime
BASE = Path('/root/spur-web-guests')
STAGE = BASE / 'upgrade-memory-idea' / 'dist'
RELEASE = BASE / 'release' / 'dist'
SCRIPT = 'index-DwUAIAWD.js'
STYLE = 'index-DPOG4762.css'

def readable(path):
    for root, dirs, files in os.walk(str(path)):
        os.chmod(root, 0o755)
        for name in files:
            os.chmod(os.path.join(root, name), 0o644)

def main():
    if os.geteuid() != 0 or sys.argv[1:] != ['--apply']:
        raise RuntimeError('Run as root with --apply')
    index = STAGE / 'index.html'
    page = index.read_text() if index.is_file() else ''
    script = STAGE / 'assets' / SCRIPT
    if SCRIPT not in page or STYLE not in page or not script.is_file() or not (STAGE / 'assets' / STYLE).is_file():
        raise RuntimeError('Upload the Idea and Memory package before applying')
    if 'From Idea to Content' not in script.read_text(errors='replace'):
        raise RuntimeError('Package is not the Idea and Memory build')
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    backup = BASE / ('before-memory-idea-' + stamp)
    shutil.copytree(str(RELEASE), str(backup))
    try:
        shutil.rmtree(str(RELEASE))
        shutil.copytree(str(STAGE), str(RELEASE))
        readable(RELEASE)
        live = (RELEASE / 'index.html').read_text()
        if SCRIPT not in live or STYLE not in live:
            raise RuntimeError('Live page was not updated')
    except Exception:
        if RELEASE.exists():
            shutil.rmtree(str(RELEASE))
        shutil.copytree(str(backup), str(RELEASE))
        raise
    print('MEMORY_IDEA_READY')
    print('Backup: ' + str(backup))

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('MEMORY_IDEA_STOPPED: ' + (str(error) if isinstance(error, RuntimeError) else type(error).__name__), file=sys.stderr)
        sys.exit(1)
