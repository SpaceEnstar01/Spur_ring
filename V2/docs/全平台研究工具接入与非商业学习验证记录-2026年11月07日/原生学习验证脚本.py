import asyncio,json,os,sys
from pathlib import Path
root=Path('/Users/x/X/space/spur/V2/agent/runtime/MediaCrawler')
sys.path.insert(0,str(root));os.chdir(root)
import config
platform=sys.argv[1]
config.PLATFORM=platform;config.KEYWORDS='AI硬件';config.CRAWLER_TYPE='search'
config.ENABLE_IP_PROXY=False;config.ENABLE_CDP_MODE=True
config.ENABLE_GET_COMMENTS=False;config.ENABLE_GET_MEDIA=False
config.ENABLE_GET_WORDCLOUD=False;config.MAX_CONCURRENCY_NUM=1
config.CRAWLER_MAX_NOTES_COUNT=1;config.SAVE_LOGIN_STATE=False
config.SAVE_DATA_PATH='/private/tmp/spur-media-learning-probe-output'
config.SAVE_DATA_OPTION='jsonl'
from main import CrawlerFactory
class NeedLogin(Exception):pass
async def no_login(self,*a,**kw):raise NeedLogin('User login required; no automatic login attempted')
mods={'xhs':('media_platform.xhs.core','XiaoHongShuLogin'),'dy':('media_platform.douyin.core','DouYinLogin'),'bili':('media_platform.bilibili.core','BilibiliLogin'),'wb':('media_platform.weibo.core','WeiboLogin')}
import importlib
mod,name=mods[platform];getattr(importlib.import_module(mod),name).begin=no_login
browser=None
async def fresh(self,p,*args,**kw):
 global browser
 browser=await p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
 c=await browser.new_context();c.set_default_navigation_timeout(12000);return c
base=CrawlerFactory.CRAWLERS[platform]
probe=type('LearningProbe',(base,),{'launch_browser_with_cdp':fresh})()
async def main():
 try:
  await asyncio.wait_for(probe.start(),timeout=25)
  state='finished_requires_output_inspection'
 except NeedLogin:state='NEED_LOGIN'
 except Exception as e:state=type(e).__name__+': '+str(e)[:350]
 finally:
  if browser:
   try:await browser.close()
   except Exception:pass
 print('PROBE_RESULT='+json.dumps({'platform':platform,'status':state},ensure_ascii=False))
asyncio.run(main())
