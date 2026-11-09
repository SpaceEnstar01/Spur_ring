import pathlib,sys,json,dataclasses,concurrent.futures,time
sys.path.insert(0,'/Users/x/X/space/spur/V2/agent/runtime/OpenMontage-main')
from tools.video.stock_sources.wikimedia import WikimediaSource
from tools.video.stock_sources.base import Candidate
W=pathlib.Path('/Users/x/X/space/spur/V2/docs/OpenMontage阿尔卑斯山十五条记录制作六十秒旅行视频验证-2026年11月09日');rows=json.loads((W/'stock-candidates.json').read_text());selected={c['source_id']:c for cs in rows.values() for c in cs if c['source_id'] in ['42572206','44585056']}
def download(item):
 key,c=item;dest=W/'stock/clips'/('wikimedia_'+key+'.webm');t=time.time()
 WikimediaSource().download(Candidate(**c),dest)
 c.update(path=str(dest),download_seconds=time.time()-t);return c
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:out=list(ex.map(download,selected.items()))
(W/'additional-assets.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print('ADDITIONAL_ASSETS',len(out))
