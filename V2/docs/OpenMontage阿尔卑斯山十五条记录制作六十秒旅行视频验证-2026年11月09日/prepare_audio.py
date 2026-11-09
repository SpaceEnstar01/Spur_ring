import pathlib,json,subprocess,time,re
w=pathlib.Path(__file__).resolve().parent;a=w/'audio';a.mkdir(exist_ok=True);story=json.loads((w/'story.json').read_text());started=time.time();segments=[];captions=[];cursor=0
log=(w/'audio-commands.log').open('w')
def run(args):
 r=subprocess.run(args,capture_output=True,text=True);log.write(json.dumps(args,ensure_ascii=False)+'\n'+r.stderr+'\n');r.check_returncode();return r.stdout
for s in story['segments']:
 i=s['id'];duration=s['duration_seconds'];raw=a/(i+'.aiff');wav=a/(i+'-raw.wav');out=a/(i+'.wav')
 run(['/usr/bin/say','-v','Tingting','-r','158','-o',str(raw),s['narration']]);run(['/usr/bin/afconvert','-f','WAVE','-d','LEI16@48000','-c','2',str(raw),str(wav)])
 actual=float(json.loads(run(['/opt/homebrew/bin/ffprobe','-v','error','-show_format','-of','json',str(wav)]))['format']['duration']);speed=max(1,actual/(duration-.6));spoken=actual/speed
 run(['/opt/homebrew/bin/ffmpeg','-y','-i',str(wav),'-af','atempo='+str(speed)+',adelay=250|250,apad','-t',str(duration),'-c:a','pcm_s16le',str(out)])
 pieces=[x for x in re.split('[，。！？：；]',s['narration']) if x];total=sum(len(x) for x in pieces);at=cursor+.25
 for piece in pieces:
  length=spoken*len(piece)/total;captions.append({'word':piece,'startMs':int(at*1000),'endMs':int((at+length)*1000)});at+=length
 segments.append({'id':i,'path':str(out),'start_seconds':cursor,'duration':duration,'spoken_duration':spoken,'speed_factor':speed});cursor+=duration
(a/'concat.txt').write_text(''.join("file '"+x['path']+"'\n" for x in segments));run(['/opt/homebrew/bin/ffmpeg','-y','-f','concat','-safe','0','-i',str(a/'concat.txt'),'-c:a','pcm_s16le',str(w/'narration.wav')])
(w/'audio-plan.json').write_text(json.dumps({'segments':segments,'captions':captions,'elapsed_seconds':time.time()-started,'alignment':'clause-level estimated proportional timings from local TTS segments; not ASR'},ensure_ascii=False,indent=2));print('AUDIO_COMPLETED',cursor)
