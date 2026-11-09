import asyncio,json,pathlib,subprocess,re,time,traceback
import edge_tts
W=pathlib.Path(__file__).resolve().parent
TEXT='I thought I was climbing toward a summit. Somewhere along the way, I stopped rushing... and found my own pace.'
VOICES=[('01-British-male-Ryan','en-GB-RyanNeural'),('02-American-male-Guy','en-US-GuyNeural'),('03-Australian-male-William','en-AU-WilliamNeural'),('04-British-female-Sonia','en-GB-SoniaNeural')]
proxytext=subprocess.check_output(['/usr/sbin/scutil','--proxy'],text=True)
def value(k):
 m=re.search(r'^\s*'+k+r'\s*:\s*(.+)$',proxytext,re.M);return m.group(1).strip() if m else ''
proxy='http://'+value('HTTPSProxy')+':'+value('HTTPSPort') if value('HTTPSEnable')=='1' else None
async def main():
 sem=asyncio.Semaphore(2)
 async def one(name,voice):
  async with sem:
   p=W/(name+'.mp3');start=time.time()
   try:
    await asyncio.wait_for(edge_tts.Communicate(TEXT,voice,rate='-8%',proxy=proxy).save(str(p)),timeout=60)
    probe=json.loads(subprocess.check_output(['/opt/homebrew/bin/ffprobe','-v','error','-show_format','-of','json',str(p)],text=True))
    return {'file':str(p),'voice':voice,'status':'completed','duration':float(probe['format']['duration']),'elapsed_seconds':time.time()-start,'bytes':p.stat().st_size}
   except Exception as e:return {'voice':voice,'status':'failed','error':str(e)}
 rows=await asyncio.gather(*(one(*v) for v in VOICES))
 (W/'试听记录.json').write_text(json.dumps({'text':TEXT,'engine':'Microsoft Edge neural TTS via edge-tts; no API key','rate':'-8%','samples':rows,'video_modified':False},ensure_ascii=False,indent=2))
 for row in rows:print(json.dumps(row,ensure_ascii=False),flush=True)
asyncio.run(main())
