"""Normalize the real OpenMontage render and validate without re-rendering."""
import json,subprocess,hashlib,sys
from pathlib import Path
work=Path(__file__).resolve().parent
root=work.parents[1]/'agent/runtime/OpenMontage-main'
sys.path.insert(0,str(root))
from lib.checkpoint import write_checkpoint
original=work/'projects/spur-personal-agent-30s/renders/Spur-Personal-Agent-30s-9x16.mp4'
output=work/'Spur-Personal-Agent-30s-9x16.mp4'
args=['/opt/homebrew/bin/ffmpeg','-y','-i',str(original),'-t','30','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart',str(output)]
r=subprocess.run(args,capture_output=True,text=True);(work/'finalize.log').write_text(r.stderr);r.check_returncode()
info=json.loads(subprocess.check_output(['/opt/homebrew/bin/ffprobe','-v','error','-show_streams','-show_format','-of','json',str(output)],text=True))
v=next(x for x in info['streams'] if x['codec_type']=='video')
assert (v['width'],v['height'])==(1080,1920) and int(v['nb_frames'])==900
assert abs(float(info['format']['duration'])-30)<0.05
r=subprocess.run(['/opt/homebrew/bin/ffmpeg','-v','error','-i',str(output),'-f','null','-'],capture_output=True,text=True);(work/'decode-check.log').write_text(r.stderr);r.check_returncode()
report={'version':'1.0','outputs':[{'path':str(output),'format':'mp4','resolution':'1080x1920','duration_seconds':30}]}
write_checkpoint(work/'projects','spur-personal-agent-30s','compose','completed',{'render_report':report},pipeline_type='animated-explainer',style_playbook='flat-motion-graphics')
print('VIDEO_VALIDATED='+str(output))
