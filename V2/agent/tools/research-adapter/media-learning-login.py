"""Open an isolated visible browser for the user's non-commercial learning session.

No daily browser profile, Cookie import, stealth script or automated login.
Keep the window open after login; the caller requests one final save and close.
"""
import argparse
import asyncio
import os
import signal
import json
import re
from pathlib import Path
from urllib.parse import urlsplit,parse_qs

URLS = {"bili": "https://passport.bilibili.com/login", "wb": "https://weibo.com/login.php",
        "xhs": "https://www.xiaohongshu.com", "dy": "https://www.douyin.com/user/self"}

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("platform", choices=URLS)
    args = parser.parse_args()
    os.umask(0o077)
    profile = Path.home() / ".local/share/spur/research-learning-sessions" / args.platform
    profile.mkdir(parents=True, exist_ok=True, mode=0o700)
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        context = await p.chromium.launch_persistent_context(
            str(profile.resolve()), channel="chrome", headless=False)
        page = context.pages[0] if context.pages else await context.new_page()
        own_ids=set()
        def observe_own_profile(request):
            if args.platform!='dy':
                return
            try:
                parsed=urlsplit(request.url)
                if parsed.hostname=='www.douyin.com' and parsed.path=='/aweme/v1/web/aweme/post/' and urlsplit(request.frame.url).path.rstrip('/')=='/user/self':
                    candidate=parse_qs(parsed.query).get('sec_user_id',[''])[0]
                    if re.fullmatch(r'[A-Za-z0-9_-]{10,250}',candidate):
                        own_ids.add(candidate)
            except Exception:
                pass
        context.on('request',observe_own_profile)
        closed = asyncio.Event()
        context.on("close", lambda _: closed.set())
        async def save_session():
            await context.storage_state(path=str(profile/'spur-session.json'))
            os.chmod(profile/'spur-session.json',0o600)
            if args.platform=='dy':
                text=await page.locator('body').inner_text(timeout=3000)
                handle=re.search(r'抖音号[：:\s]*([A-Za-z0-9_.-]+)',text)
                binding={'platform':'douyin','source':'dedicated-manual-login','profileUrl':page.url,
                         'accountHandle':handle.group(1) if handle else None,
                         'creatorUrl':'https://www.douyin.com/user/'+next(iter(own_ids)) if len(own_ids)==1 and handle else None}
                (profile/'account-binding.json').write_text(json.dumps(binding,ensure_ascii=False))
                os.chmod(profile/'account-binding.json',0o600)
        async def close_cleanly():
            try:
                await save_session()
            finally:
                await context.close()
        asyncio.get_running_loop().add_signal_handler(signal.SIGTERM, lambda:asyncio.create_task(close_cleanly()))
        print("LOGIN_WINDOW_READY=" + args.platform, flush=True)
        try:
            await page.goto(URLS[args.platform], timeout=20000, wait_until="domcontentloaded")
        except Exception:
            print("INITIAL_NAVIGATION_INCOMPLETE: please inspect the visible page", flush=True)
        # No repeated browser reads, snapshots, activation or navigation while
        # the user works. Only save once when they confirm completion.
        try:
            await asyncio.wait_for(closed.wait(),timeout=900)
        except asyncio.TimeoutError:
            await close_cleanly()
        print("LOGIN_WINDOW_CLOSED=" + args.platform, flush=True)

if __name__ == "__main__":
    asyncio.run(main())
