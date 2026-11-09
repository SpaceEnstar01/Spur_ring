import numpy as np,wave,pathlib
W=pathlib.Path(__file__).resolve().parent
rate=44100;length=60;t=np.arange(rate*length)/rate;score=np.zeros_like(t)
# Original ambient piano-like score, not a borrowed or pretrained music recording.
chords=[[50,57,62,65],[46,53,58,62],[43,50,58,62],[45,52,57,61],[53,60,65,69],[48,55,60,64],[46,53,58,62],[53,60,65,69]]
starts=[0,7,14,22,30,38,46,53]
for i,(start,notes) in enumerate(zip(starts,chords)):
 end=starts[i+1] if i<7 else 60;sel=(t>=start)&(t<end+3);u=t[sel]-start
 env=(1-np.exp(-u/1.2))*np.exp(-np.maximum(0,u-(end-start-1))/2.0)
 for n in notes:
  f=440*2**((n-69)/12);score[sel]+=0.035*env*(np.sin(2*np.pi*f*u)+.18*np.sin(2*np.pi*f*2*u))
 for step in range(int((end-start)/.88)):
  at=start+step*.88;sel2=(t>=at)&(t<at+3.5);u2=t[sel2]-at
  n=notes[step%4]+12;f=440*2**((n-69)/12)
  score[sel2]+=.07*np.exp(-u2*1.7)*(1-np.exp(-u2*70))*(np.sin(2*np.pi*f*u2)+.26*np.sin(2*np.pi*f*2*u2))
score*=np.minimum(1,t/2)*np.minimum(1,np.maximum(0,60-t)/4)
left=score.copy();right=score.copy()
for delay,gain in [(.21,.23),(.43,.15),(.71,.09)]:
 d=int(delay*rate);left[d:]+=score[:-d]*gain;right[d+900:]+=score[:-(d+900)]*gain
stereo=np.stack([left,right],axis=1);stereo=stereo/max(1,np.max(abs(stereo))/.7)
p=W/'music-original.wav'
with wave.open(str(p),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(rate);w.writeframes((stereo*32767).astype('<i2').tobytes())
print('ORIGINAL_MUSIC_CREATED',p)
