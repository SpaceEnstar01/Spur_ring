import asyncio,json,pathlib,subprocess,re,time,sys,copy,dataclasses,hashlib,traceback
import edge_tts
BASE=pathlib.Path(__file__).resolve().parents[1];W=BASE/'英文Sonia成片';W.mkdir(exist_ok=True);A=W/'audio';A.mkdir(exist_ok=True)
ROOT=pathlib.Path('/Users/x/X/space/spur/V2/agent/runtime/OpenMontage-main');sys.path.insert(0,str(ROOT))
from tools.video.video_compose import VideoCompose
from lib.checkpoint import init_project,write_checkpoint
from lib.pipeline_loader import load_pipeline
P=W/'projects';ID='alps-sonia-english'
TEXTS=[
"I left before dawn, wondering why I'd dragged myself out into the cold.",
"Then the first light caught the peaks. Some moments just don't fit inside a photograph.",
"But the trail got rough. My legs ached. For a while, I really wanted to turn back.",
"An old man on the path told me, 'Don't rush to the top. Take your time.'",
"So I put my phone away. Cowbells, wind... bread and cheese. Somehow, it was enough.",
"Then the clouds lifted. The whole valley opened up. I just stood there, saying nothing.",
"The hard part passed. From up here, the things I'd worried about felt so small.",
"By dusk, the village lights felt like home. What I'd found was my own pace."
]
def run(args):
 r=subprocess.run(args,capture_output=True,text=True)
 with (W/'commands.log').open('a') as f:f.write(json.dumps(args)+'\n'+r.stderr+'\n')
 r.check_returncode();return r.stdout
proxytext=subprocess.check_output(['/usr/sbin/scutil','--proxy'],text=True)
def value(k):
 m=re.search(r'^\s*'+k+r'\s*:\s*(.+)$',proxytext,re.M);return m.group(1).strip() if m else ''
proxy='http://'+value('HTTPSProxy')+':'+value('HTTPSPort') if value('HTTPSEnable')=='1' else None
async def generate():
 old=json.loads((BASE/'story.json').read_text());sem=asyncio.Semaphore(2)
 async def one(i,text):
  async with sem:
   p=A/(str(i)+'.mp3')
   await asyncio.wait_for(edge_tts.Communicate(text,'en-GB-SoniaNeural',rate='-8%',proxy=proxy).save(str(p)),90)
   return p
 files=await asyncio.gather(*(one(i,t) for i,t in enumerate(TEXTS)))
 segments=[];captions=[];cursor=0
 for i,p in enumerate(files):
  dur=old['segments'][i]['duration_seconds'];actual=float(json.loads(run(['/opt/homebrew/bin/ffprobe','-v','error','-show_format','-of','json',str(p)]))['format']['duration'])
  speed=max(1,actual/(dur-.45));out=A/(str(i)+'.wav')
  run(['/opt/homebrew/bin/ffmpeg','-y','-i',str(p),'-af',f'atempo={speed},adelay=150|150,apad','-t',str(dur),'-ar','48000','-ac','2','-c:a','pcm_s16le',str(out)])
  parts=[s.strip() for s in re.split(r'(?<=[.!?])\s+|,\s*|\.\.\.\s*',TEXTS[i]) if s.strip()]
  total=sum(len(x) for x in parts);at=cursor+.15;spoken=actual/speed
  for phrase in parts:
   span=spoken*len(phrase)/total;captions.append({'word':phrase,'startMs':round(at*1000),'endMs':round((at+span)*1000)});at+=span
  segments.append({'id':i,'narration':TEXTS[i],'duration':dur,'original_tts_seconds':actual,'speed_factor':speed,'path':str(out),'recording_ids':old['segments'][i]['recording_ids']});cursor+=dur
 (A/'concat.txt').write_text(''.join("file '"+s['path']+"'\n" for s in segments))
 run(['/opt/homebrew/bin/ffmpeg','-y','-f','concat','-safe','0','-i',str(A/'concat.txt'),'-c:a','pcm_s16le',str(W/'narration-sonia.wav')])
 (W/'english-script.json').write_text(json.dumps({'voice':'en-GB-SoniaNeural','rate':'-8%','segments':segments,'captions':captions,'alignment':'clause-level estimated timings, not ASR'},indent=2))
 return segments,captions

def main():
 started=time.time()
 if (W/'english-script.json').is_file() and (W/'narration-sonia.wav').is_file():
  saved=json.loads((W/'english-script.json').read_text());segments,captions=saved['segments'],saved['captions']
 else: segments,captions=asyncio.run(generate())
 print('SONIA_NARRATION_READY',flush=True)
 load_pipeline('documentary-montage');project=init_project(ID,title='Finding My Own Pace — Sonia English',pipeline_type='documentary-montage',pipeline_dir=P)
 oldA=BASE/'projects/alps-finding-my-own-pace/artifacts'
 def cp(stage,name,data):
  (project/'artifacts'/(name+'.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2))
  write_checkpoint(P,ID,stage,'completed',{name:data},pipeline_type='documentary-montage',human_approved=True,metadata={'approval':'User selected voice 4 Sonia for full English narration and subtitles; retain 60s picture and music.'})
 brief=json.loads((oldA/'brief.json').read_text());brief['title']='Finding My Own Pace';brief['metadata']['narration']='en-GB-SoniaNeural, user approved sample 4';cp('idea','brief',brief)
 sceneplan=json.loads((oldA/'scene_plan.json').read_text());sceneplan['metadata']['english_script']=segments;cp('scene_plan','scene_plan',sceneplan)
 assets=json.loads((oldA/'asset_manifest.json').read_text())
 for asset in assets['assets']:
  if asset['id']=='narration':asset.update(path=str(W/'narration-sonia.wav'),source_tool='Microsoft Edge neural TTS via edge-tts, user-selected en-GB-SoniaNeural')
 cp('assets','asset_manifest',assets)
 canonical=json.loads((oldA/'edit_decisions.json').read_text());canonical['metadata']['language']='English';canonical['metadata']['voice']='Sonia';canonical['metadata']['subtitles']='English clause-level estimated timing';cp('edit','edit_decisions',canonical)
 props=json.loads((oldA/'render_props.json').read_text());props['soundtrack']['src']=str(W/'narration-sonia.wav');props['captions']['words']=captions
 props['captionProps'].update(fontSize=40,fontFamily='Arial, sans-serif',wordSeparator=' ',wordStyle={'whiteSpace':'normal','maxWidth':'100%'},boxStyle={'maxWidth':'84%','borderRadius':8,'padding':'8px 18px','textAlign':'center'})
 for scene in props['scenes']:
  if scene['id']=='opening':scene['text']='Slow Down.\nSee More.'
  if scene['id']=='end-tag':scene['text']='Find your own pace.'
 (project/'artifacts/render_props.json').write_text(json.dumps(props,ensure_ascii=False,indent=2))
 output=project/'renders/Alps-Sonia-English-original.mp4';t=time.time();print('OPENMONTAGE_RENDER_STARTED',flush=True)
 result=VideoCompose().execute({'operation':'render','edit_decisions':props,'asset_manifest':assets,'proposal_packet':{'production_plan':{'render_runtime':'remotion','renderer_family':'documentary-montage'}},'scene_plan':sceneplan['scenes'],'output_path':str(output),'profile':'youtube_shorts','remotion_concurrency':2,'remotion_timeout_ms':180000,'remotion_browser_executable':'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
 (project/'artifacts/tool-result.json').write_text(json.dumps(dataclasses.asdict(result),ensure_ascii=False,indent=2))
 if not result.success:raise RuntimeError(result.error)
 final=W/'Alps-Vlog-60s-Sonia-British-English.mp4'
 run(['/opt/homebrew/bin/ffmpeg','-y','-i',str(output),'-t','60','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart','-metadata','comment=Stock reconstruction from simulated records. Source attribution accompanies original Chinese edition. Sonia British English neural narration. CC BY-SA 4.0.',str(final)])
 probe=json.loads(run(['/opt/homebrew/bin/ffprobe','-v','error','-show_streams','-show_format','-of','json',str(final)]));video=next(s for s in probe['streams'] if s['codec_type']=='video')
 assert abs(float(probe['format']['duration'])-60)<.05 and (video['width'],video['height'])==(1080,1920) and int(video['nb_frames'])==1800
 run(['/opt/homebrew/bin/ffmpeg','-v','error','-i',str(final),'-f','null','-'])
 cp('compose','render_report',{'version':'1.0','outputs':[{'path':str(final),'format':'mp4','resolution':'1080x1920','duration_seconds':60}]})
 (W/'verification.json').write_text(json.dumps({'file':str(final),'duration':60,'width':1080,'height':1920,'frames':1800,'voice':'en-GB-SoniaNeural','subtitles':'English','compose_and_finalize_seconds':time.time()-t,'total_seconds':time.time()-started,'sha256':hashlib.sha256(final.read_bytes()).hexdigest(),'bytes':final.stat().st_size,'original_chinese_video_preserved':True},indent=2));print('ENGLISH_VIDEO_READY='+str(final),flush=True)
if __name__=='__main__':
 try:main()
 except Exception:
  (W/('error-'+str(time.time_ns())+'.log')).write_text(traceback.format_exc());traceback.print_exc();sys.exit(1)
