import pathlib,subprocess,json,time,concurrent.futures
W=pathlib.Path(__file__).resolve().parent;D=W/'shots';D.mkdir(exist_ok=True)
clips=W/'stock/clips';night=next((W/'night/clips').glob('*.jpg'))
# Each cut is separately authored from a documented source and inspected preview.
plan=[('01', '44585217',0,7,'dark cloudy peak / expectation'),('02','44585056',4,7,'sunlight breaking into valley'),('03','127709956',39,8,'rocky mountain face / fatigue'),('04','127709956',107,8,'ridge / slow down'),('05a','42572206',3,4,'alpine cows / attention'),('05b','127709956',0,4,'quiet meadow'),('06a','44585217',25,3,'clouds / held breath'),('06b','127709956',121,5,'valley opening / release'),('07','127709956',7,7,'wide mountain landscape / perspective'),('08','image',0,7,'Zermatt at night / home')]
def prepare(item):
 name,key,ss,duration,why=item;out=D/(name+'.mp4');t=time.time()
 source=night if key=='image' else clips/('wikimedia_'+key+'.webm')
 if key=='image':
  args=['/opt/homebrew/bin/ffmpeg','-y','-loop','1','-i',str(source),'-t',str(duration),'-vf',"scale=1200:2134:force_original_aspect_ratio=increase,crop=1200:2134,zoompan=z='1.02+0.00012*on':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1080x1920:fps=30"]
 else:
  args=['/opt/homebrew/bin/ffmpeg','-y','-ss',str(ss),'-i',str(source),'-t',str(duration),'-vf','scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1']
 args+=['-an','-r','30','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',str(out)]
 r=subprocess.run(args,capture_output=True,text=True);(D/(name+'.log')).write_text(r.stderr);r.check_returncode()
 return {'id':name,'source_id':key,'original_path':str(source),'source_in_seconds':ss,'duration':duration,'path':str(out),'reason':why,'prepare_seconds':time.time()-t}
start=time.time()
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:rows=list(ex.map(prepare,plan))
(W/'shot-plan.json').write_text(json.dumps({'shots':rows,'elapsed_seconds':time.time()-start},ensure_ascii=False,indent=2));print('SHOTS_READY',len(rows))
