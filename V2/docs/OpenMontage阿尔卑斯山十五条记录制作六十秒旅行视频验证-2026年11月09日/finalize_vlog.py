# -*- coding: utf-8 -*-
import pathlib,json,subprocess,hashlib,time
from render_vlog import checkpoint,W,P,ID
original=P/ID/'renders/OpenMontage-Alps-Vlog-60s-original.mp4'
final=W/'阿尔卑斯山徒步-找回自己的节奏-60秒-9比16.mp4'
credits='Illustrative stock reconstruction from 15 simulated recordings. Wikimedia Commons: anotherview CC BY 3.0; jendall CC BY 3.0; Urs Zihlmann CC BY 3.0; Alex Lomas CC BY 2.0; chensiyuan CC BY-SA 4.0. Full source links and editing changes accompany this file. Original local music; adaptation CC BY-SA 4.0.'
r=subprocess.run(['/opt/homebrew/bin/ffmpeg','-y','-i',str(original),'-t','60','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart','-metadata','comment='+credits,'-metadata','copyright=CC BY-SA 4.0; see accompanying attributions',str(final)],capture_output=True,text=True);(W/'finalize-success.log').write_text(r.stderr);r.check_returncode()
info=json.loads(subprocess.check_output(['/opt/homebrew/bin/ffprobe','-v','error','-show_streams','-show_format','-of','json',str(final)],text=True));(W/'final-ffprobe.json').write_text(json.dumps(info,indent=2))
v=next(x for x in info['streams'] if x['codec_type']=='video')
assert (v['width'],v['height'])==(1080,1920) and int(v['nb_frames'])==1800 and abs(float(info['format']['duration'])-60)<.05
r=subprocess.run(['/opt/homebrew/bin/ffmpeg','-v','error','-i',str(final),'-f','null','-'],capture_output=True,text=True);(W/'decode-check.log').write_text(r.stderr);r.check_returncode()
checkpoint('compose','render_report',{'version':'1.0','outputs':[{'path':str(final),'format':'mp4','resolution':'1080x1920','duration_seconds':60.0}],'metadata':{'renderer':'OpenMontage VideoCompose → Remotion CinematicRenderer','full_decode_exit':0,'limitations':['illustrative stock','local TTS','clause-level estimated subtitles, not ASR','no Spur tool integration']}})
verification={'status':'completed','video_path':str(final),'duration':float(info['format']['duration']),'frames':v['nb_frames'],'width':v['width'],'height':v['height'],'bytes':final.stat().st_size,'sha256':hashlib.sha256(final.read_bytes()).hexdigest(),'native_compose_seconds':json.loads((W/'timing.json').read_text())['native_compose_seconds'],'verified_decode_exit':0,'main_spur_code_modified':False}
(W/'verification.json').write_text(json.dumps(verification,ensure_ascii=False,indent=2));print(json.dumps(verification,ensure_ascii=False,indent=2))
