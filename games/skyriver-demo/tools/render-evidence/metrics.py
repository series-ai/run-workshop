import sys,json,colorsys,math
from pathlib import Path
from PIL import Image
import numpy as np
out={}
for folder in sys.argv[1:]:
 frames=[]
 for p in sorted(Path(folder).glob('lap-*s.png')):
  im=np.asarray(Image.open(p).convert('RGB'),dtype=float)/255
  rgb=im[72:-72,128:-154].reshape(-1,3)
  hi=rgb.max(axis=1);lo=rgb.min(axis=1);sat=(hi-lo)/np.maximum(hi,1e-9)
  # Saturated light pixels. Keep the same threshold for all rounds.
  mask=(sat>=0.35)&(hi>=0.45)
  bins=np.zeros(12)
  for c in rgb[mask]: bins[min(11,int(colorsys.rgb_to_hsv(*c)[0]*12))]+=1
  shares=bins/max(1,bins.sum());entropy=-sum(x*math.log2(x) for x in shares if x)
  lum=rgb@np.array([.2126,.7152,.0722])
  frames.append({'file':str(p),'neonPct':100*mask.mean(),'hueCounts':bins.tolist(),'dominantPct':100*max(shares),'entropyBits':entropy,'p5':float(np.percentile(lum*255,5)),'p50':float(np.percentile(lum*255,50)),'p95':float(np.percentile(lum*255,95)),'blackPct':100*float((lum*255<=12).mean())})
 out[folder]=frames
print(json.dumps(out,indent=2))
