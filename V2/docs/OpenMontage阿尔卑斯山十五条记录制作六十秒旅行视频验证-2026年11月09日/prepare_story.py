# -*- coding: utf-8 -*-
import pathlib,json,requests,time,subprocess,re
W=pathlib.Path(__file__).resolve().parent
cfg={}
for ln in pathlib.Path('/Users/x/X/space/spur/V2/agent/config/siliconflow.env').read_text().splitlines():
 if '=' in ln and not ln.lstrip().startswith('#'):
  k,v=ln.split('=',1);cfg[k.strip()]=v.strip().strip('"\'')
source=(W/'原始记录.txt').read_text()
system='你是旅行纪录片编剧。只基于提供的15条模拟口语记录编排一条60秒9:16电影感Vlog，不能添加新的事件、地名、事实或假装真实Ring数据。叙事必须从出发的期待，到疲惫想放弃，再通过老人的话、云散和归途找回生活节奏；不要逐条汇报，不做风景清单。输出严格JSON，无代码围栏：title,theme,logline,segments。segments恰好8段，每段含id、duration_seconds、narration、recording_ids(整数数组)、visual_query(英文检索词)、emotion。8段时长依次为7,7,8,8,8,8,7,7秒，总60。旁白总长170-210个汉字，第一人称口语、有停顿、有情绪、有留白；不要用英文词，不要讲产品广告。每段文字控制在24字左右，不超过30字；结尾落在找回自己的节奏。'
payload={'model':cfg.get('SPUR_CHAT_MODEL','deepseek-ai/DeepSeek-V4.1-Flash'),'messages':[{'role':'system','content':system},{'role':'user','content':source}],'temperature':0.65,'max_tokens':2500}
proxy_text=subprocess.check_output(["/usr/sbin/scutil","--proxy"],text=True)
def proxy_value(key):
 m=re.search(r"^\s*"+key+r"\s*:\s*(.+)$",proxy_text,re.M);return m.group(1).strip() if m else ""
proxies={}
if proxy_value("HTTPSEnable")=="1":
 proxy="http://"+proxy_value("HTTPSProxy")+":"+proxy_value("HTTPSPort");proxies={"http":proxy,"https":proxy}
start=time.time()
r=requests.post(cfg.get('SILICONFLOW_BASE_URL','https://api.siliconflow.cn/v1').rstrip('/')+'/chat/completions',headers={'Authorization':'Bearer '+cfg['SILICONFLOW_API_KEY']},json=payload,timeout=150,proxies=proxies)
if not r.ok:
 (W/'model-error.json').write_text(json.dumps({'status':r.status_code,'body':r.text[:1800]},ensure_ascii=False));r.raise_for_status()
x=r.json();text=x['choices'][0]['message']['content'].strip();text=text.removeprefix('```json').removeprefix('```').removesuffix('```').strip();story=json.loads(text)
assert len(story['segments'])==8 and sum(s['duration_seconds'] for s in story['segments'])==60
(W/'story.json').write_text(json.dumps(story,ensure_ascii=False,indent=2));(W/'model-usage.json').write_text(json.dumps({'model':payload['model'],'usage':x.get('usage'),'elapsed_seconds':time.time()-start,'api_calls':1,'billing_usd':'not verified; consult provider billing'},ensure_ascii=False,indent=2));print(json.dumps(story,ensure_ascii=False,indent=2))
