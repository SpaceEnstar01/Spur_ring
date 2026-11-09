"""Bounded non-commercial learning search using a dedicated manually logged-in profile.

Does not launch login, import daily-browser credentials, inject stealth scripts,
download media or collect comments. JSON stdout is safe for the Node adapter.
"""
import argparse
import asyncio
import contextlib
import importlib
import json
import os
import re
import html
from pathlib import Path
import sys

PLATFORMS = {
    'bilibili': ('bili', 'media_platform.bilibili.core', 'BilibiliLogin'),
    'weibo': ('wb', 'media_platform.weibo.core', 'WeiboLogin'),
    'xiaohongshu': ('xhs', 'media_platform.xhs.core', 'XiaoHongShuLogin'),
    'douyin': ('dy', 'media_platform.douyin.core', 'DouYinLogin'),
}

class LoginRequired(Exception):
    pass

def normalize_record(row):
    url = row.get('video_url') or row.get('note_url') or row.get('aweme_url')
    if not url:
        return None
    return {'title':str(row.get('title') or row.get('content') or row.get('desc') or '')[:500],
            'url':url,'text':str(row.get('desc') or row.get('content') or '')[:6000],
            'published_at':row.get('create_date_time'),
            'raw':{'source':'mediacrawler','comments_collected':False}}

async def main(args, search_override=None, run_timeout=55):
    os.umask(0o077)
    platform, module, login = PLATFORMS[args.platform]
    diagnostics = {}
    root = Path(args.root).resolve()
    profile = Path(args.profile).resolve()
    output = Path(args.output).resolve()
    if not (profile / 'Default').is_dir() and not (profile/'spur-session.json').is_file():
        return {'ok':False,'items':[],'error':{'code':'NEED_LOGIN'}}
    output.mkdir(parents=True, exist_ok=False, mode=0o700)
    sys.path.insert(0, str(root))
    os.chdir(root)
    import config
    config.PLATFORM = platform
    config.KEYWORDS = args.query
    config.CRAWLER_TYPE = 'search'
    config.ENABLE_IP_PROXY = False
    config.ENABLE_CDP_MODE = True
    config.ENABLE_GET_COMMENTS = False
    config.ENABLE_GET_MEDIA = False
    config.ENABLE_GET_WORDCLOUD = False
    config.MAX_CONCURRENCY_NUM = 1
    config.CRAWLER_MAX_NOTES_COUNT = args.limit
    config.SAVE_LOGIN_STATE = False
    config.SAVE_DATA_OPTION = 'jsonl'
    config.SAVE_DATA_PATH = str(output)
    from main import CrawlerFactory
    async def require_login(*a, **kw):
        raise LoginRequired()
    getattr(importlib.import_module(module), login).begin = require_login
    async def fresh(self, p, *a, **kw):
        state = profile/'spur-session.json'
        if state.is_file() and not getattr(args,'use_persistent_profile',False):
            # Explicit state from Spur's own user-authorized login window only.
            self.spur_browser = await p.chromium.launch(channel='chrome',headless=True)
            c = await self.spur_browser.new_context(storage_state=str(state))
        else:
            c = await p.chromium.launch_persistent_context(str(profile), channel='chrome', headless=True)
        c.set_default_navigation_timeout(15000)
        return c
    base = CrawlerFactory.CRAWLERS[platform]
    overrides = {'launch_browser_with_cdp':fresh}
    if platform == 'dy':
        async def create_dy_client(self, *a, **kw):
            client = await base.create_douyin_client(self, *a, **kw)
            original_pong = client.pong
            async def settled_pong(browser_context):
                # Login state is populated asynchronously after navigation.
                # Wait for actual site state; never synthesize a login flag.
                try:
                    await self.context_page.wait_for_function(
                        "() => window.localStorage.getItem('HasUserLogin') === '1'", timeout=5000)
                except Exception:
                    pass
                valid = await original_pong(browser_context)
                diagnostics['loginConfirmed'] = bool(valid)
                return valid
            client.pong = settled_pong
            original_search = client.search_info_by_keyword
            async def measured_search(*a, **kw):
                diagnostics['searchAttempted'] = True
                try:
                    result = await original_search(*a, **kw)
                    diagnostics['searchResultCount'] = len(result.get('data') or [])
                    return result
                except Exception as error:
                    diagnostics['upstreamErrorType'] = type(error).__name__
                    raise
            client.search_info_by_keyword = measured_search
            return client
        overrides['create_douyin_client'] = create_dy_client
    if platform == 'bili':
        async def bounded_bili_search(self):
            # Upstream search expands a two-result request into 20 detail calls.
            # Use its authenticated search client once; return search evidence only.
            data = await self.bili_client.search_video_by_keyword(keyword=args.query, page=1, page_size=20)
            records = []
            for row in (data.get('result') or [])[:args.limit]:
                video = row.get('bvid') or ('av'+str(row['aid']) if row.get('aid') else None)
                if video:
                    records.append({'title':html.unescape(re.sub('<[^>]+>','',str(row.get('title') or ''))),
                                    'desc':str(row.get('description') or '')[:6000],
                                    'video_url':'https://www.bilibili.com/video/'+video})
            directory=output/'bili'/'jsonl'
            directory.mkdir(parents=True,exist_ok=True)
            with (directory/'search_contents.jsonl').open('w') as f:
                for record in records:
                    f.write(json.dumps(record,ensure_ascii=False)+'\n')
        overrides['search'] = bounded_bili_search
    if search_override is not None:
        overrides['search'] = search_override
    crawler = type('SpurLearningCrawler', (base,), overrides)()
    code = None
    try:
        await asyncio.wait_for(crawler.start(), timeout=run_timeout)
    except LoginRequired:
        code = 'NEED_LOGIN'
    except asyncio.TimeoutError:
        code = 'TIMEOUT'
    except Exception as error:
        # Avoid returning provider stderr/Cookies to the agent.
        text = str(error).lower()
        code = 'PROFILE_BUSY' if 'processsingleton' in text or 'singletonlock' in text else 'UPSTREAM_BROKEN'
    finally:
        context = getattr(crawler, 'browser_context', None)
        if context:
            try:
                await context.close()
            except Exception:
                pass
        browser = getattr(crawler,'spur_browser',None)
        if browser:
            try:
                await browser.close()
            except Exception:
                pass
    items = []
    for file in output.glob('**/*contents*.jsonl'):
        for line in file.read_text().splitlines():
            try:
                row = json.loads(line)
            except ValueError:
                continue
            item = normalize_record(row)
            if item:
                items.append(item)
    return {'ok':bool(items) and code is None, 'channel':args.platform, 'backend':'mediacrawler',
            'items':items[:args.limit] if code is None else [],
            'error':{'code':code or 'INSUFFICIENT_EVIDENCE'} if code or not items else None,
            'diagnostics':diagnostics}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    parser.add_argument('--profile', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--platform', choices=PLATFORMS, required=True)
    parser.add_argument('--query', required=True)
    parser.add_argument('--limit', type=int, choices=range(1,6), default=2)
    args = parser.parse_args()
    if not args.query.strip() or len(args.query)>500 or ',' in args.query or any(ord(c)<32 for c in args.query):
        raise SystemExit('Invalid bounded search query')
    with contextlib.redirect_stdout(sys.stderr):
        result = asyncio.run(main(args))
    print(json.dumps(result, ensure_ascii=False))
