from glb import *
import numpy as np, json
js,A=anims(__import__('sys').argv[1] if len(__import__('sys').argv) > 1 else __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), '..', 'rigged', 'clips.glb'))
def ang(a,b):
    d=np.abs(np.sum(a*b,axis=1)/np.linalg.norm(a,axis=1)/np.linalg.norm(b,axis=1)); return np.degrees(2*np.arccos(np.minimum(1,d)))
for clip,ch in A.items():
    for (node,path),(t,v,interp) in ch.items():
        if len(t)<4: continue
        if path=='rotation':
            d=ang(v[1:],v[:-1])
        else:
            d=np.linalg.norm(v[1:]-v[:-1],axis=1)*(1 if path=='translation' else 1)
        # spike: delta much larger than both neighbours
        for i in range(1,len(d)-1):
            nb=max(d[i-1],d[i+1])
            thr = 1.5 if path=='rotation' else 0.004
            if d[i]>thr and d[i]>3*nb:
                print(f'{clip:12s} {node:12s} {path:11s} frame {i}->{i+1} t={t[i]:.3f}: {d[i]:.3f} (neighbours {d[i-1]:.3f},{d[i+1]:.3f})')
        if interp=='STEP': print('STEP', clip, node, path)
