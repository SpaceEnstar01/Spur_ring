# -*- coding: utf-8 -*-
import pathlib,json,sys,time,subprocess,dataclasses,hashlib,traceback,os
ROOT=pathlib.Path('/Users/x/X/space/spur/V2/agent/runtime/OpenMontage-main');sys.path.insert(0,str(ROOT))
from lib.pipeline_loader import load_pipeline
from lib.checkpoint import init_project,write_checkpoint
from tools.video.video_compose import VideoCompose
W=pathlib.Path(__file__).resolve().parent;P=W/'projects';ID='alps-finding-my-own-pace';A=P/ID/'artifacts'
start=time.time()

def save(name,value):
 A.mkdir(parents=True,exist_ok=True);(A/(name+'.json')).write_text(json.dumps(value,ensure_ascii=False,indent=2))
def checkpoint(stage,name,value):
 save(name,value)
 write_checkpoint(P,ID,stage,'completed',{name:value},pipeline_type='documentary-montage',human_approved=True,metadata={'user_delegation':'User explicitly requests final MP4 without stepwise approval; sources are stock reconstruction of simulated recordings, no publishing.'})
 print('COMPLETED_STAGE='+stage,flush=True)
def main():
 load_pipeline('documentary-montage');project=init_project(ID,title='慢下来，才看见山',pipeline_type='documentary-montage',pipeline_dir=P)
 story=json.loads((W/'story.json').read_text());shots=json.loads((W/'shot-plan.json').read_text())['shots'];audio=json.loads((W/'audio-plan.json').read_text())
 brief={'version':'1.0','title':story['title'],'hook':'出发时想赶到山顶，回来时想找回自己。','key_points':['期待出发','疲惫与放弃念头','老人的提醒','云散与安静','归途找回节奏'],'tone':'reverent','style':'克制自然的电影感旅行叙事，素材重构而非个人实拍','target_platform':'tiktok','target_duration_seconds':60,'reference_material':[str(W/'原始记录.txt')],'core_message':story['theme'],'metadata':{'thematic_question':'当不再急着到山顶，我们能找回什么？','shape':'before/after with emotional turn','render_runtime':'remotion','renderer_family':'documentary-montage','sources_allowed':['wikimedia'],'generated_clips_allowed':False,'music_plan':{'source':'original_local','source_path':str(W/'music-original.wav'),'description':'本地原创氛围钢琴/持续和弦，前半克制，后半舒展'},'narration':'macOS Tingting local Chinese speech','end_tag_plan':{'text':'慢下来，找回自己的节奏。','mode':'overlay','duration_seconds':7,'render_engine':'remotion','component':'CinematicRenderer title overlay'},'delegated_approval':True,'source_records_simulated':True,'runtime_options_considered':{'remotion':'selected: native CinematicRenderer','hyperframes':'not used: no documentary parity on this pipeline'}}}
 checkpoint('idea','brief',brief)
 cursor=0;scenes=[];cuts=[];sceneplan=[]
 for sh in shots:
  duration=sh['duration'];i=sh['id'];scenes.append({'id':i,'kind':'video','src':sh['path'],'startSeconds':cursor,'durationSeconds':duration,'fadeInFrames':8 if cursor else 15,'fadeOutFrames':8,'filter':'contrast(1.035) saturate(0.92) brightness(0.98)'})
  cuts.append({'id':i,'source':i,'in_seconds':0,'out_seconds':duration,'reason':sh['reason'],'transition_in':'fade','transition_out':'fade','transition_duration':.25})
  sceneplan.append({'id':i,'type':'broll','description':sh['reason'],'start_seconds':cursor,'end_seconds':cursor+duration});cursor+=duration
 # Project-native cinematic title overlays over matching footage; no new renderer code.
 scenes.append({'id':'opening','kind':'title','startSeconds':.7,'durationSeconds':3.5,'text':'慢下来\n才看见山','accent':'ALPS · A DAY IN EIGHT MOMENTS','backgroundSrc':shots[0]['path'],'backgroundTrimBeforeSeconds':.7,'variant':'overlay','intensity':.1})
 scenes.append({'id':'end-tag','kind':'title','startSeconds':55,'durationSeconds':5,'text':'找回自己的节奏','accent':'THE SUMMIT CAN WAIT','backgroundSrc':shots[-1]['path'],'backgroundTrimBeforeSeconds':2,'variant':'overlay','intensity':.08})
 checkpoint('scene_plan','scene_plan',{'version':'1.0','scenes':sceneplan,'metadata':{'slots':[{**s,'queries':['Swiss Alps',story['segments'][min(i,7)]['emotion']],'preferred_sources':['wikimedia'],'target_hold_seconds':s['end_seconds']-s['start_seconds']} for i,s in enumerate(sceneplan)],'recording_to_narration':story['segments']}})
 # The native acquisition tool and adapter return provenance; never replace it with guessed geography.
 acquired=json.loads((W/'stock-search.json').read_text())['result']['data']['clips']
 acquired+=json.loads((W/'additional-assets.json').read_text())
 acquired+=json.loads((W/'night-search.json').read_text())['data']['clips']
 byid={str(c.get('source_id')):c for c in acquired}
 assets=[]
 for sh in shots:
  c=byid['20091840' if sh['source_id']=='image' else sh['source_id']]
  assets.append({'id':sh['id'],'type':'video','path':sh['path'],'source_tool':'OpenMontage DirectClipSearch / WikimediaSource, then FFmpeg crop/trim','scene_id':sh['id'],'provider':'wikimedia','license':c.get('license','verify source'),'original_url':c.get('source_url',''),'duration_seconds':sh['duration'],'generation_summary':'Third-party illustrative stock; not captured by user; night shot animated from a still.'})
 assets.extend([{'id':'narration','type':'narration','path':str(W/'narration.wav'),'source_tool':'macOS say Tingting + afconvert','scene_id':'all'},{'id':'score','type':'music','path':str(W/'music-original.wav'),'source_tool':'local original procedural score','scene_id':'all','license':'Original score, shared under CC BY-SA 4.0 for this test'}])
 manifest={'version':'1.0','assets':assets,'total_cost_usd':0,'metadata':{'search_stats':{'downloaded_usable_sources':len(byid),'initial_search_timed_out':True,'review_method':'manual inspection of source thumbnails and contact sheets; rejected Czech Switzerland and New Zealand'},'warning':'Source label Alpine cows does not establish Swiss location; illustrative Alpine stock. 7 seconds of final scene are an animated Zermatt photo.'}}
 checkpoint('assets','asset_manifest',manifest)
 canonical={'version':'1.0','cuts':cuts,'renderer_family':'documentary-montage','render_runtime':'remotion','composition_mode':'templated','audio':{'narration':{'segments':[{'asset_id':'narration','start_seconds':0,'end_seconds':60}]},'music':{'asset_id':'score','volume':.28,'fade_in_seconds':2,'fade_out_seconds':4}},'end_tag':{'offset_seconds':55,'notes':'Native CinematicRenderer title overlay, background is Zermatt night image animated as video.'},'metadata':{'render_props_path':str(A/'render_props.json'),'subtitles':'clause-level proportional local TTS timing, no ASR','raw_records':str(W/'原始记录.txt'),'story_path':str(W/'story.json'),'stock_reconstruction':True}}
 checkpoint('edit','edit_decisions',canonical)
 render=dict(canonical,scenes=scenes,soundtrack={'src':str(W/'narration.wav'),'volume':1,'fadeInSeconds':.1,'fadeOutSeconds':.6},music={'src':str(W/'music-original.wav'),'volume':.28,'fadeInSeconds':2,'fadeOutSeconds':4},captions={'words':audio['captions'],'wordsPerPage':1,'fontSize':42,'color':'#F9F6EF','highlightColor':'#F9F6EF','backgroundColor':'rgba(0,0,0,0.40)'},captionProps={'wordsPerPage':1,'fontSize':42,'bottomOffset':245,'fontFamily':'PingFang SC, sans-serif','wordSeparator':'','boxStyle':{'maxWidth':'86%','borderRadius':8},'wordPop':{'scale':1}},titleFontSize=64,titleWidth=900,signalLineCount=0)
 save('render_props',render)
 # Concrete selected renderer agreed with the requested autonomous production.
 proposal={'production_plan':{'render_runtime':'remotion','renderer_family':'documentary-montage'}}
 output=project/'renders/OpenMontage-Alps-Vlog-60s-original.mp4'
 print('RENDER_STARTED',flush=True);render_start=time.time()
 result=VideoCompose().execute({'operation':'render','edit_decisions':render,'asset_manifest':manifest,'proposal_packet':proposal,'scene_plan':sceneplan,'output_path':str(output),'profile':'youtube_shorts','remotion_concurrency':2,'remotion_timeout_ms':180000,'remotion_browser_executable':'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
 render_elapsed=time.time()-render_start;save('openmontage_tool_result',dataclasses.asdict(result))
 (W/'timing.json').write_text(json.dumps({'production_checkpoint_to_render_seconds':time.time()-start,'native_compose_seconds':render_elapsed,'shot_preparation_seconds':json.loads((W/'shot-plan.json').read_text())['elapsed_seconds'],'audio_preparation_seconds':audio['elapsed_seconds'],'initial_stock_search_seconds':json.loads((W/'stock-search.json').read_text())['elapsed_seconds']},indent=2))
 if not result.success:raise RuntimeError(result.error)
 final=W/'阿尔卑斯山徒步-找回自己的节奏-60秒-9比16.mp4'
 credits='Stock reconstruction from simulated recordings. Wikimedia Commons: anotherview CC BY 3.0; jendall CC BY 3.0; Urs Zihlmann CC BY 3.0; Alex Lomas CC BY 2.0; chensiyuan CC BY-SA 4.0. Source links and changes in accompanying attribution. Original local music. Adaptation CC BY-SA 4.0.'
 r=subprocess.run(['/opt/homebrew/bin/ffmpeg','-y','-i',str(output),'-t','60','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart','-metadata','comment='+credits,'-metadata','copyright=CC BY-SA 4.0; source attributions accompany this file',str(final)],capture_output=True,text=True);(W/'finalize.log').write_text(r.stderr);r.check_returncode()
 info=json.loads(subprocess.check_output(['/opt/homebrew/bin/ffprobe','-v','error','-show_streams','-show_format','-of','json',str(final)],text=True));save('final_ffprobe',info)
 v=next(s for s in info['streams'] if s['codec_type']=='video');assert (v['width'],v['height'])==(1080,1920);assert abs(float(info['format']['duration'])-60)<.1
 r=subprocess.run(['/opt/homebrew/bin/ffmpeg','-v','error','-i',str(final),'-f','null','-'],capture_output=True,text=True);(W/'decode-check.log').write_text(r.stderr);r.check_returncode()
 checkpoint('compose','render_report',{'version':'1.0','outputs':[{'path':str(final),'format':'mp4','resolution':'1080x1920','duration_seconds':float(info['format']['duration'])}],'metadata':{'actual_renderer':'OpenMontage VideoCompose → Remotion CinematicRenderer','full_decode_exit':0,'native_compose_seconds':render_elapsed,'quality_limit':'Stock illustrative reconstruction, local TTS and estimated clause subtitles; not original travel footage or full autonomous Spur integration'}})
 verify={'status':'completed','video_path':str(final),'duration':float(info['format']['duration']),'frames':v.get('nb_frames'),'bytes':final.stat().st_size,'sha256':hashlib.sha256(final.read_bytes()).hexdigest(),'native_compose_seconds':render_elapsed,'main_spur_code_modified':False}
 (W/'verification.json').write_text(json.dumps(verify,ensure_ascii=False,indent=2));print(json.dumps(verify,ensure_ascii=False,indent=2),flush=True)
 # Preserve exact per-source metadata alongside the shareable result.
 (W/'素材来源与署名.json').write_text(json.dumps(acquired,ensure_ascii=False,indent=2))
if __name__=='__main__':
 try:main()
 except Exception:
  (W/('render-failure-'+str(time.time_ns())+'.log')).write_text(traceback.format_exc());traceback.print_exc();sys.exit(1)
