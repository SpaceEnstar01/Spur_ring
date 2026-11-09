# -*- coding: utf-8 -*-
"""Standalone, zero-paid-API production using real OpenMontage contracts and VideoCompose."""
import dataclasses,json,os,subprocess,sys,time,traceback
from pathlib import Path
ROOT=Path('/Users/x/X/space/spur/V2/agent/runtime/OpenMontage-main')
WORK=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
from lib.pipeline_loader import load_pipeline
from lib.checkpoint import init_project,write_checkpoint
from tools.video.video_compose import VideoCompose
PROJECT='spur-personal-agent-30s'
PIPE=WORK/'projects'
PROJECTDIR=init_project(PROJECT,title='Personal Agent · 轻交互',pipeline_type='animated-explainer',pipeline_dir=PIPE,style_playbook='flat-motion-graphics')
ASSETS=PROJECTDIR/'assets/audio';RENDERS=PROJECTDIR/'renders';ART=PROJECTDIR/'artifacts'
os.environ['OPENMONTAGE_PROJECT_DIR']=str(PROJECTDIR)

def save(name,value):
 p=ART/(name+'.json');p.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8');return p

def command(args):
 r=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 with (WORK/'commands.log').open('a',encoding='utf-8') as f:f.write(json.dumps(args,ensure_ascii=False)+'\n'+r.stdout+'\n'+r.stderr+'\n')
 if r.returncode:raise RuntimeError('Command failed: '+args[0]+' '+r.stderr[-1200:])
 return r.stdout

def checkpoint(stage,name,data):
 save(name,data)
 # User authorized this exact local, zero-API technical validation, not publishing.
 write_checkpoint(PIPE,PROJECT,stage,'completed',{name:data},pipeline_type='animated-explainer',style_playbook='flat-motion-graphics',human_approved=True,metadata={'approval_source':'User explicitly approved dependency installation and standalone 30s 9:16 rendering; no cloud/publishing.'})
 print('STAGE_COMPLETED='+stage,flush=True)

def main():
 load_pipeline('animated-explainer')
 original='今天我在研究 Personal AI Agent。\n我认为未来的 AI 不应该只是聊天工具，而应该能够理解用户的长期记忆，主动帮助用户完成任务。\n真正优秀的个人智能体，应该通过轻交互融入用户的日常生活。'
 (WORK/'用户原始文案.txt').write_text(original,encoding='utf-8')
 srcs=[WORK/'用户原始文案.txt',ROOT/'AGENT_GUIDE.md',ROOT/'pipeline_defs/animated-explainer.yaml',ROOT/'tools/video/video_compose.py',ROOT/'lib/media_profiles.py']
 brief={'version':'1.0','topic':'用户关于Personal AI Agent的个人观点；仅做本地制作能力验证','research_date':'2026-11-09','landscape':{'existing_content':[{'title':'用户原始文案','source':srcs[0].as_uri(),'angle':'第一人称产品观点','what_it_covers':'长期记忆、主动执行与轻交互'}],'saturated_angles':[],'underserved_gaps':['本次不做市场研究，不宣称观点已被外部数据验证']},'data_points':[{'claim':x,'source_url':p.as_uri(),'credibility':'primary_source'} for x,p in [('原始文案表达个人观点，不是对Spur现有能力的完整声明',srcs[0]),('合成工具提供Remotion渲染入口',srcs[3]),('youtube_shorts输出为1080×1920',srcs[4])]],'audience_insights':{'common_questions':['策划假设：为什么不只是聊天？','策划假设：长期记忆有什么用？','策划假设：轻交互如何融入日常？'],'misconceptions':[],'knowledge_level':'面向普通观众；未做用户调研'},'angles_discovered':[{'name':x,'hook':x,'type':'narrative','why_now':'基于用户已授权的当前文案制作验证'} for x in ['不止聊天','记住与行动','轻交互融入日常']],'sources':[{'url':p.as_uri(),'title':p.name,'used_for':'用户来源或本地制作技术依据；不是互联网市场研究','reliability':'primary'} for p in srcs],'metadata':{'external_research_performed':False,'paid_api_used':False}}
 brief['landscape']['existing_content'].extend([{'title':'OpenMontage production contract','source':srcs[1].as_uri(),'angle':'Local production architecture','what_it_covers':'Pipeline manifests and Python tools, not an end-to-end hosted API'},{'title':'OpenMontage video composer','source':srcs[3].as_uri(),'angle':'Local renderer implementation','what_it_covers':'MP4 rendering through Remotion; not market research'}])
 checkpoint('research','research_brief',brief)
 titles=['不止聊天','记住与行动','轻交互融入日常']
 proposal={'version':'1.0','concept_options':[{'id':str(i),'title':t,'hook':t,'narrative_structure':'problem_solution','visual_approach':'本地科技风动态图文，不使用生成式实拍素材','target_duration_seconds':30,'why_this_works':'使用用户明确提供的观点；仅技术验证备选概念'} for i,t in enumerate(titles)],'selected_concept':{'concept_id':'0','rationale':'用户指定科技风、30秒、9:16；以原观点为主线'},'production_plan':{'pipeline':'animated-explainer','render_runtime':'remotion','renderer_family':'explainer-data','composition_mode':'templated','stages':[{'stage':'compose','tools':[{'tool_name':'video_compose','role':'OpenMontage正式合成和检查','available':True}],'approach':'Remotion现有组件＋Mac本地中文TTS＋分句时间轴'}]},'cost_estimate':{'total_estimated_usd':0,'line_items':[{'tool':'video_compose','operation':'local render','estimated_usd':0}],'budget_verdict':'within_budget'},'approval':{'status':'approved','user_notes':'用户明确批准本地独立生成；现有API服务亦已获准复用，本次选择零API本地路线，不部署、不发布'}}
 checkpoint('proposal','proposal_packet',proposal)
 sections=[
  ('今天，我在研究，个人AI智能体。','Personal AI Agent','今天，我在研究'),
  ('我认为，未来的人工智能，不应该只是聊天工具。','不止于聊天','从回答问题，到理解你'),
  ('它应该理解用户的长期记忆。','理解长期记忆','让每一次想法，都有延续'),
  ('并且，主动帮助用户，完成真正的任务。','主动完成任务','从意图，到真实行动'),
  ('真正优秀的个人智能体，应该通过轻交互，','Light Interaction','让复杂留在后台'),
  ('自然地，融入我们的日常生活。','融入日常生活','一句话，让想法开始发生')]
 script={'version':'1.0','title':'Personal Agent · 不止聊天','total_duration_seconds':30,'voice_performance':{'performance_intent':'清楚、克制的中文科技叙述','pacing_profile':'conversational','energy_curve':'平稳开场，重点强调行动，温和收尾','pause_policy':'按语义分句，六段各五秒','provider_notes':{'local':'macOS say Tingting，无云端请求'}},'sections':[{'id':str(i),'text':v[0],'start_seconds':i*5,'end_seconds':(i+1)*5} for i,v in enumerate(sections)]}
 checkpoint('script','script',script)
 scene={'version':'1.0','scenes':[{'id':str(i),'type':'animation','description':v[1]+'；现有Remotion组件动态呈现，不伪装成实拍','start_seconds':i*5,'end_seconds':(i+1)*5} for i,v in enumerate(sections)]}
 checkpoint('scene_plan','scene_plan',scene)
 print('GENERATING_LOCAL_NARRATION',flush=True)
 paths=[]
 for i,(text,title,subtitle) in enumerate(sections):
  raw=ASSETS/(str(i)+'.aiff');wav=ASSETS/(str(i)+'.wav')
  command(['/usr/bin/say','-v','Tingting','-r','175','-o',str(raw),text])
  converted=ASSETS/(str(i)+'-raw.wav')
  command(['/usr/bin/afconvert','-f','WAVE','-d','LEI16@48000','-c','2',str(raw),str(converted)])
  probe=json.loads(command(['ffprobe','-v','error','-show_format','-of','json',str(converted)]));length=float(probe['format']['duration'])
  speed=max(1.0,length/4.65)
  command(['ffmpeg','-y','-i',str(converted),'-af','atempo='+str(speed)+',apad','-t','5','-ar','48000','-ac','2',str(wav)])
  paths.append(wav)
 (ASSETS/'concat.txt').write_text(''.join("file '"+str(p)+"'\n" for p in paths))
 voice=ASSETS/'narration.wav'
 command(['ffmpeg','-y','-f','concat','-safe','0','-i',str(ASSETS/'concat.txt'),'-c:a','pcm_s16le',str(voice)])
 manifest={'version':'1.0','assets':[{'id':'narration','type':'narration','path':str(voice),'source_tool':'macOS say Tingting + FFmpeg; explicit local alternative','scene_id':'all'}]}
 checkpoint('assets','asset_manifest',manifest)
 cuts=[]
 for i,(_,title,subtitle) in enumerate(sections):
  c={'id':str(i),'source':'','in_seconds':i*5,'out_seconds':(i+1)*5,'type':'hero_title','text':title,'heroSubtitle':subtitle,'accentColor':'#59E1E8','transition_in':'fade','transition_out':'fade','transition_duration':0.35,'backgroundColor':'#0A1020','color':'#F1F5FF'}
  if i==2:c.update(type='text_card',text='理解用户的\n长期记忆',fontSize=86)
  if i==3:c.update(type='comparison',title='从意图，到行动',leftLabel='过去',rightLabel='未来',leftValue='回答问题',rightValue='完成任务')
  cuts.append(c)
 # Captions are sentence-timed from controlled 5s audio segments, not ASR word timing.
 captions=[{'word':v[0],'startMs':i*5000+200,'endMs':(i+1)*5000-250,'pageBreakAfter':True} for i,v in enumerate(sections)]
 edit={'version':'1.0','cuts':cuts,'render_runtime':'remotion','renderer_family':'explainer-data','composition_mode':'templated','tailPaddingSeconds':0,'theme':'flat-motion-graphics','captions':captions,'captionProps':{'fontSize':34,'bottomOffset':290,'wordsPerPage':1,'wordSeparator':'','fontFamily':'PingFang SC, sans-serif','boxStyle':{'maxWidth':'86%','textAlign':'center'}},'audio':{'narration':{'src':str(voice),'volume':1}},'metadata':{'paid_api_used':False,'subtitle_alignment':'sentence-level using local TTS segment boundaries, no ASR','script_source':'user-provided opinion'}}
 save('render_props',edit)
 # Upstream canonical edit schema omits renderer-specific cut fields; retain them separately.
 schema=json.loads((ROOT/'schemas/artifacts/edit_decisions.schema.json').read_text())
 canonical={k:v for k,v in edit.items() if k in schema['properties']}
 allowed=schema['properties']['cuts']['items']['properties']
 canonical['cuts']=[{k:v for k,v in c.items() if k in allowed} for c in cuts]
 canonical['metadata']['render_props_path']=str(ART/'render_props.json')
 checkpoint('edit','edit_decisions',canonical)
 print('RENDERING_OPENMONTAGE_REMOTION',flush=True)
 result=VideoCompose().execute({'operation':'render','edit_decisions':edit,'asset_manifest':manifest,'scene_plan':scene['scenes'],'proposal_packet':proposal,'output_path':str(RENDERS/'Spur-Personal-Agent-30s-9x16.mp4'),'profile':'youtube_shorts','remotion_concurrency':2,'remotion_timeout_ms':120000,'remotion_browser_executable':'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
 save('openmontage_tool_result',dataclasses.asdict(result))
 if not result.success:raise RuntimeError(result.error)
 output=RENDERS/'Spur-Personal-Agent-30s-9x16.mp4'
 info=json.loads(command(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(output)]));save('ffprobe',info)
 video=next(s for s in info['streams'] if s['codec_type']=='video')
 assert (video['width'],video['height'])==(1080,1920)
 assert abs(float(info['format']['duration'])-30)<0.1
 assert any(s['codec_type']=='audio' for s in info['streams'])
 command(['ffmpeg','-v','error','-i',str(output),'-f','null','-'])
 report={'version':'1.0','outputs':[{'path':str(output),'format':'mp4','resolution':'1080x1920','duration_seconds':30}]}
 checkpoint('compose','render_report',report)
 print('VIDEO_VALIDATED='+str(output),flush=True)
if __name__=='__main__':
 try:main()
 except Exception:
  (WORK/('failure-'+str(time.time_ns())+'.log')).write_text(traceback.format_exc(),encoding='utf-8');traceback.print_exc();sys.exit(1)
