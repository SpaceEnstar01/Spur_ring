import sys,pathlib,json,dataclasses,concurrent.futures
root=pathlib.Path('/Users/x/X/space/spur/V2/agent/runtime/OpenMontage-main');sys.path.insert(0,str(root))
from tools.video.stock_sources.wikimedia import WikimediaSource
from tools.video.stock_sources.base import SearchFilters
W=pathlib.Path('/Users/x/X/space/spur/V2/docs/OpenMontage阿尔卑斯山十五条记录制作六十秒旅行视频验证-2026年11月09日')
def search(q):
 try:return q,[dataclasses.asdict(c) for c in WikimediaSource().search(q,SearchFilters(kind='video',per_page=8))]
 except Exception as e:return q,{'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:rows=dict(pool.map(search,['hiking Switzerland','Alps cows','Zermatt village']))
(W/'stock-candidates.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
for q,cs in rows.items():
 print(q)
 if isinstance(cs,list):
  for c in cs:print(c['source_id'],c.get('duration'),c.get('width'),c.get('title'),str(c.get('extra'))[:300])
