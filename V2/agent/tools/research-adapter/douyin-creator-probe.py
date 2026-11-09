"""Read-only three-video/five-comment learning probe for an explicitly supplied creator.

Uses only Spur's dedicated manually authorized state. No bulk pagination,
sub-comments, media downloads, account changes or LLM upload.
"""
import argparse
import asyncio
import contextlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
from types import SimpleNamespace
from urllib.parse import urlsplit, parse_qs


def creator_id(url):
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or parsed.hostname not in ('www.douyin.com','douyin.com') or parsed.username or parsed.password:
        raise ValueError('Expected an HTTPS Douyin creator homepage URL')
    if parsed.path.rstrip('/')=='/user/self':
        return 'self'
    match = re.fullmatch(r'/user/([A-Za-z0-9_-]{10,250})/?', parsed.path)
    if not match:
        raise ValueError('Expected a full /user/... homepage URL; short links must be resolved first')
    return match[1]


def normalize_video(row):
    vid = str(row.get('aweme_id') or '')
    if not re.fullmatch(r'\d{10,30}',vid):
        return None
    stats = row.get('statistics') or {}
    def count(key):
        value = stats.get(key)
        return value if type(value) is int and value >= 0 else None
    play = count('play_count')
    return {'id':vid,'url':'https://www.douyin.com/video/'+vid,
            'description':str(row.get('desc') or '')[:6000], 'createdAt':row.get('create_time'),
            'metrics':{'likes':count('digg_count'),'comments':count('comment_count'),
                       'shares':count('share_count'),'collections':count('collect_count'),
                       'plays':play if play and play>0 else None}, 'comments':[]}


async def probe(args):
    target = creator_id(args.creator_url)
    spec = importlib.util.spec_from_file_location('spur_media_learning',Path(__file__).with_name('media-learning-search.py'))
    learning = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(learning)
    videos=[]
    diagnostics={'creatorRequestCount':0,'commentRequestCount':0,'commentsLimitPerVideo':5}
    async def bounded_creator(self):
        nonlocal target
        if target=='self':
            candidates=set()
            observed_paths=set()
            expected=getattr(args,'expected_handle','')
            def observe(request):
                parsed=urlsplit(request.url)
                if parsed.hostname=='www.douyin.com' and '/aweme/' in parsed.path and ('post' in parsed.path or 'user' in parsed.path):
                    observed_paths.add(parsed.path)
                if parsed.hostname=='www.douyin.com' and parsed.path=='/aweme/v1/web/aweme/post/':
                    candidate=parse_qs(parsed.query).get('sec_user_id',[''])[0]
                    if re.fullmatch(r'[A-Za-z0-9_-]{10,250}',candidate):
                        candidates.add(candidate)
            async def observe_profile(response):
                parsed=urlsplit(response.url)
                if parsed.hostname!='www.douyin.com' or '/user/profile/' not in parsed.path:
                    return
                try:
                    data=await response.json()
                    user=data.get('user') or {}
                    if '/self/' in parsed.path or str(user.get('unique_id') or user.get('short_id') or '')==expected:
                        candidate=user.get('sec_uid') or ''
                        if re.fullmatch(r'[A-Za-z0-9_-]{10,250}',candidate):
                            candidates.add(candidate)
                except Exception:
                    pass
            self.context_page.on('request',observe)
            self.context_page.on('response',observe_profile)
            await self.context_page.goto('https://www.douyin.com/user/self',timeout=20000,wait_until='domcontentloaded')
            for _ in range(8):
                if candidates:
                    break
                await asyncio.sleep(1)
            text=await self.context_page.locator('body').inner_text(timeout=5000)
            diagnostics['observedAccountPaths']=sorted(observed_paths)[:12]
            diagnostics['selfAccountDisplayMatched']=bool(expected and expected in text)
            if not diagnostics['selfAccountDisplayMatched']:
                diagnostics['selfResolution']='ACCOUNT_NOT_CONFIRMED'
                return
            # Match the public account handle before accepting server-rendered
            # profile data; never infer identity from unrelated video authors.
            embedded=await self.context_page.evaluate('''(handle) => {
                const ids = new Set();
                function visit(value, depth=0) {
                    if (!value || typeof value !== 'object' || depth>25) return;
                    if ([value.unique_id, value.short_id, value.uniqueId, value.shortId].some(x => String(x ?? '')===handle)) {
                        const id=value.sec_uid || value.secUid;
                        if (typeof id==='string' && /^[A-Za-z0-9_-]{10,250}$/.test(id)) ids.add(id);
                    }
                    for (const child of Object.values(value)) visit(child,depth+1);
                }
                for (const script of document.querySelectorAll('script[type="application/json"],script#RENDER_DATA')) {
                    const raw=script.textContent || '';
                    for (const text of [raw, (()=>{try{return decodeURIComponent(raw)}catch{return ''}})()]) {
                        try {visit(JSON.parse(text));} catch {}
                    }
                }
                return [...ids];
            }''',expected)
            candidates.update(embedded)
            diagnostics['matchedEmbeddedProfileCount']=len(embedded)
            resolved=creator_id(self.context_page.url)
            if resolved!='self':
                target=resolved
            elif len(candidates)==1:
                target=next(iter(candidates))
            else:
                diagnostics['selfResolution']='NO_UNAMBIGUOUS_CREATOR_ID'
                return
            diagnostics['selfResolution']='OWN_PROFILE_REQUEST_OBSERVED'
        diagnostics['creatorRequestCount']+=1
        data=await asyncio.wait_for(self.dy_client.get_user_aweme_posts(target),timeout=15)
        rows=data.get('aweme_list')
        diagnostics['returnedVideoCount']=len(rows) if isinstance(rows,list) else 0
        if not isinstance(rows,list):
            diagnostics['creatorResponseUsable']=False
            return
        # Pinned videos can be first; sort only the returned first page by time.
        rows=sorted(rows,key=lambda row:row.get('create_time') or 0,reverse=True)
        for row in rows:
            author=(row.get('author') or {}).get('sec_uid')
            if author and author!=target:
                continue
            video=normalize_video(row)
            if video:
                videos.append(video)
            if len(videos)>=3:
                break
        directory=Path(args.output)/'douyin'/'jsonl'
        directory.mkdir(parents=True,exist_ok=True)
        with (directory/'search_contents.jsonl').open('w') as f:
            for video in videos:
                f.write(json.dumps({'aweme_url':video['url'],'desc':video['description']},ensure_ascii=False)+'\n')
        for video in videos:
            diagnostics['commentRequestCount']+=1
            try:
                response=await asyncio.wait_for(self.dy_client.get_aweme_comments(video['id'],0),timeout=10)
                if response.get('verify_check') or response.get('captcha'):
                    video['commentStatus']='PLATFORM_BLOCKED'
                    break
                comments=response.get('comments')
                if not isinstance(comments,list):
                    video['commentStatus']='UNAVAILABLE'
                    continue
                for c in comments[:5]:
                    if str(c.get('aweme_id') or video['id'])!=video['id']:
                        continue
                    video['comments'].append({'text':str(c.get('text') or '')[:2000],
                                              'likes':c.get('digg_count') if type(c.get('digg_count')) is int else None,
                                              'createdAt':c.get('create_time')})
                video['commentStatus']='available' if video['comments'] else 'empty'
            except asyncio.TimeoutError:
                video['commentStatus']='TIMEOUT'
            except Exception as error:
                video['commentStatus']='UPSTREAM_BROKEN'
                diagnostics['commentErrorType']=type(error).__name__
                break
            await asyncio.sleep(1)
    bridge=await learning.main(SimpleNamespace(root=args.root,profile=args.profile,output=args.output,platform='douyin',query='creator verification',limit=3,use_persistent_profile=True),search_override=bounded_creator,run_timeout=90)
    comments=sum(len(v['comments']) for v in videos)
    return {'status':'passed' if videos and comments and bridge.get('ok') else 'partial' if videos else 'failed',
            'provider':'mediacrawler','creatorUrl':args.creator_url,'videos':videos,
            'commentCount':comments,'diagnostics':{**bridge.get('diagnostics',{}),**diagnostics},
            'error':bridge.get('error'),
            'limits':{'maxVideos':3,'maxTopLevelCommentsPerVideo':5,'firstPageOnly':True,
                      'latestAcrossWholeAccountVerified':False,'subComments':False,
                      'privateStudioMetrics':False,'zeroPlayCountsTreatedAsUnavailable':True}}


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    for name in ('root','profile','output','creator-url'):
        parser.add_argument('--'+name,required=True)
    parser.add_argument('--expected-handle',default='')
    args=parser.parse_args()
    os.umask(0o077)
    creator_id(args.creator_url)
    with contextlib.redirect_stdout(sys.stderr):
        result=asyncio.run(probe(args))
    print(json.dumps(result,ensure_ascii=False))
