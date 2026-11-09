#!/usr/bin/env python3
"""Publish the homepage coming-soon dialog to the guest website.
Replaces static files only. Does not restart workers, Caddy, or the personal Agent.
Python 3.6 compatible.
"""
import os, shutil, sys
from pathlib import Path
from datetime import datetime
BASE = Path('/root/spur-web-guests')
STAGE = BASE / 'upgrade-coming-soon' / 'dist'
RELEASE = BASE / 'release' / 'dist'
SCRIPT = 'index-BEb0yIhi.js'
STYLE = 'index-Cuwjz5WC.css'

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
    if SCRIPT not in page or STYLE not in page:
        raise RuntimeError('Upload the coming soon package before applying')
    if not (STAGE / 'assets' / SCRIPT).is_file() or not (STAGE / 'assets' / STYLE).is_file():
        raise RuntimeError('Upload the coming soon package before applying')
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    backup = BASE / ('before-coming-soon-' + stamp)
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
    print('COMING_SOON_READY')
    print('Backup: ' + str(backup))

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('COMING_SOON_STOPPED: ' + (str(error) if isinstance(error, RuntimeError) else type(error).__name__), file=sys.stderr)
        sys.exit(1)
