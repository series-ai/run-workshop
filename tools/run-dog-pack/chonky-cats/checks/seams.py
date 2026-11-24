from glb import *
import numpy as np, json
js,A=anims(__import__('sys').argv[1] if len(__import__('sys').argv) > 1 else __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), '..', 'rigged', 'clips.glb'))
meta=None
for n in js['nodes']:
    if 'extras' in n and 'clips' in n['extras']: meta=json.loads(n['extras']['clips']); L=n['extras'].get('leg_length')
# rest values for constant channels
nodes={n['name']:n for n in js['nodes']}
def val(clip,key,end):
    ch=A[clip]
    if key in ch:
        t,v,_=ch[key]; return v[-1] if end else v[0]
    n=nodes[key[0]]
    return np.array(n.get('rotation',[0,0,0,1]) if key[1]=='rotation' else n.get('translation',[0,0,0]) if key[1]=='translation' else n.get('scale',[1,1,1]))
def ang(q1,q2):
    d=abs(np.dot(q1/np.linalg.norm(q1),q2/np.linalg.norm(q2))); return np.degrees(2*np.arccos(min(1,d)))
def compare(c1,e1,c2,e2,label,thr=1.0):
    keys=set(A[c1])|set(A[c2])
    out=[]
    for k in sorted(keys):
        a=val(c1,k,e1); b=val(c2,k,e2)
        if k[1]=='rotation':
            d=ang(a,b)
            if d>thr: out.append(f'{k[0]} rot {d:.2f}deg')
        else:
            d=np.linalg.norm(a-b)
            if d>0.003: out.append(f'{k[0]} {k[1]} {d:.4f} ({np.round(a,3)}->{np.round(b,3)})')
    print(label, 'OK' if not out else ''); [print('   ',o) for o in out]
print('leg',L)
for n,m in meta.items():
    if m['loop']: compare(n,True,n,False,f'LOOP {n}: last vs first')
print()
pairs=[('sit_enter','sit_loop'),('sit_enter','groom'),('sit_enter','bat'),('sit_enter','knead'),('sit_enter','sit_exit'),
 ('sit_loop','sit_exit'),('groom','sit_loop'),('bat','sit_loop'),('knead','sit_exit'),('knead','sit_loop'),('groom','sit_exit'),('bat','sit_exit'),
 ('loaf_enter','loaf_loop'),('loaf_loop','loaf_exit'),('loaf_enter','loaf_exit'),
 ('down_enter','down_loop'),('down_enter','flop_enter'),('down_enter','roll_over'),('down_loop','flop_enter'),('roll_over','down_loop'),('down_loop','down_exit'),('flop_exit','down_loop'),('flop_exit','down_exit'),
 ('flop_enter','flop_loop'),('flop_loop','flop_exit'),('flop_enter','flop_exit'),
 ('idle','sit_enter'),('sit_exit','idle'),('idle','down_enter'),('idle','loaf_enter'),('loaf_exit','idle'),('down_exit','idle'),
 ('idle','meow'),('meow','idle'),('idle','hiss'),('hiss','idle'),('idle','pounce'),('pounce','idle'),('idle','stretch'),('stretch','idle'),('idle','sniff')]
for a,b in pairs: compare(a,True,b,False,f'CHAIN {a} end -> {b} start')
print(json.dumps({k:{kk:vv for kk,vv in v.items() if kk not in('duration',)} for k,v in meta.items()},indent=None)[:3000])
