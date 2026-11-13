"""Build connected terrain with broken edges and painted material faces."""
import math
import numpy as np
import paint as P
import pnshapes as S
from _life import coords, crystal, facet_paint, foliage, grass, leaf_block, ngon, plan, trunk
from pnkit import box, edges
from voxgrid import C, Grid


def broken_rock(g, x, z, y, r, h, seed=0, moss=True, patch_moss=False):
    rng = np.random.default_rng(seed)
    masks = []
    for k, (lo, hi, width) in enumerate(((0, .36, 1), (.30, .70, .85), (.65, 1, .63))):
        dx, dz = rng.uniform(-r*.12, r*.12, 2)
        poly = ngon(x+dx, z+dz, r*width, 7, .1+k*.16, [.88, 1.08, .90, 1.1, .85, 1.04, .94])
        top = [(x+dx+(u-x-dx)*.92, z+dz+(v-z-dz)*.92) for u,v in poly]
        start = len(g.solids)
        m = plan(g, poly, y+h*lo, y+h*hi, 'stone', 5, top=top)
        facet_paint(g, g.solids[start:], lambda gg,mm,fr: P.stone(gg,mm,'stone',5,block=(7,4),cracks=.05,frame=fr,seed=seed+k))
        X,Y,Z=coords(g)
        P.flat(g,m & S.seams(g,g.solids[start:],.65),'stone',6)
        if moss and k==2:
            cap=m & (Y>y+h-.8)
            if patch_moss:
                P.flat(g,cap,'stone',5)
                u=(X-x-dx)/max(r*.63,1)
                v=(Z-z-dz)/max(r*.63,1)
                patch=cap & (((u+.35)**2/.65+(v-.1)**2/.8<1) | ((u-.4)**2/.16+(v+.45)**2/.25<1))
                P.flat(g,patch,'moss',5)
                P.flat(g,patch & ((u+.35)**2/.2+(v-.1)**2/.24<1),'leaf',4)
            else:
                patch=cap & (((X+Z+seed)%11)<8)
                P.flat(g,patch,'moss',5)
                P.flat(g,patch & ((X+Z)%5<2),'leaf',5)
        masks.append(m)
    return np.logical_or.reduce(masks)


def floor(g, radius=24):
    poly=ngon(32,32,radius,10,.15,[1,.88,1.03,.94,.85,1.1,.91,1.04,.92,1])
    m=plan(g,poly,0,2,'wood',4)
    X,Y,Z=coords(g)
    P.flat(g,m & (Y>1),'moss',4)
    P.flat(g,m & (Y>1) & (((X//6+Z//5)%4)==0),'leaf',5)
    for i,(x,z) in enumerate(((14,23),(45,15),(50,37),(20,49))):
        plan(g,ngon(x,z,4.3,5,.2+i),2,2.8,'wood',5)
    grass(g,[(17,2,35),(43,2,20),(46,2,44),(27,2,48)],'leaf',5)
    return m


def flower(g,x,z,y,ramp='red',size=3,rise=7):
    S.bar(g,'z',(x,y),(x+.5,y+rise),1.5,z,z+1.5,'forest',5)
    for dx,dz in ((-size,0),(size,0),(0,-size),(0,size)):
        plan(g,[(x+dx-size*.7,z+dz),(x+dx,z+dz-size*.7),(x+dx+size*.7,z+dz),(x+dx,z+dz+size*.7)],y+rise,y+rise+1.2,ramp,6)
    S.disc(g,'y',x,z,1.3,y+rise+.5,y+rise+2,'gold',7,n=6)
    S.bar(g,'z',(x,y+3),(x+3,y+5),2,z,z+2,'leaf',5)
    S.bar(g,'x',(y+2,z),(y+4,z-3),2,x-1,x+1,'leaf',5)


def terrain(slug):
    g=Grid(64,72,64)
    X,Y,Z=coords(g)
    if slug=='cliff-ledge':
        floor(g,27)
        for x,z,r,h,s in ((23,39,20,44,1),(44,42,16,32,2),(17,22,12,19,3),(42,22,15,15,4),(51,44,9,20,5)):
            broken_rock(g,x,z,0,r,h,s,patch_moss=True)
        plan(g,[(19,35),(27,32),(35,38),(32,43),(20,42)],44,45,'leaf',5)
        for x,z in ((11,17),(49,17),(56,31)):
            broken_rock(g,x,z,0,4,6,x,patch_moss=True)
    elif slug=='mossy-boulder':
        floor(g)
        broken_rock(g,31,30,2,17,26,7,patch_moss=True)
        broken_rock(g,19,41,2,9,12,8,patch_moss=True)
        broken_rock(g,46,40,2,7,9,9,patch_moss=True)
        broken_rock(g,46,20,2,4,5,11,patch_moss=True)
    elif slug=='crystal-cave-mouth':
        # Separate rock banks and roof leave a deep open cavity.
        for x,z,r,h,s in ((15,37,10,34,21),(49,37,10,31,22),(16,52,9,25,23),(48,51,10,27,24)):
            broken_rock(g,x,z,0,r,h,s,moss=False)
        roof=plan(g,[(9,28),(18,23),(48,25),(57,34),(52,59),(15,59)],30,42,'stone',5,
                  top=[(13,30),(23,26),(43,27),(51,35),(46,56),(20,56)])
        P.stone(g,roof,'stone',5,block=(7,4),cracks=.06,seed=25)
        P.flat(g,edges(roof),'stone',6)
        g.prism('z',[(19,1),(45,1),(45,24),(41,30),(25,30),(19,23)],54,59,C('stone',4))
        rear=S.last(g)
        facet_paint(g,[g.solids[-1]],lambda gg,mm,fr: P.stone(gg,mm,'stone',4,block=(7,4),cracks=.05,frame=fr,seed=26))
        g.prism('z',[(27,1),(43,1),(42,12),(38,26),(31,24)],58,62,C('stone',5))
        facet_paint(g,[g.solids[-1]],lambda gg,mm,fr: P.stone(gg,mm,'stone',5,block=(7,4),cracks=.04,frame=fr,seed=27))
        plan(g,[(20,18),(44,18),(45,57),(19,57)],0,2,'stone',4)
        for x,z,h,ramp in ((14,23,21,'cyan'),(49,26,25,'blue'),(28,40,17,'magenta'),(40,47,13,'cyan'),(22,18,9,'blue')):
            crystal(g,x,z,0,3.4,h,6,ramp,5,n=6,lean=(1.5,0))
    elif slug=='lily-pond':
        # A ring of separate earth banks encloses low water.
        outer=ngon(32,32,25,12,.2,[1,.91,1.05,.92,1,1.06,.95,1,.90,1,.95,1.05])
        inner=ngon(32,32,18,12,.2)
        for k in range(12):
            m=plan(g,[outer[k],outer[(k+1)%12],inner[(k+1)%12],inner[k]],0,5+(k%3)*.5,'wood',4)
            P.flat(g,m & (Y>4),'moss',5)
        water=S.disc(g,'y',32,32,18,0,2.5,'sky',5,n=12)
        P.flat(g,water & ((np.floor(S.radial(g,'y',32,32))%6)==0),'cyan',6)
        for i,(x,z) in enumerate(((23,29),(39,35),(30,42),(43,25))):
            pad=plan(g,[(x-4,z-1),(x-3,z-4),(x+2,z-4),(x+4,z),(x,z-1),(x+2,z+3),(x-2,z+4)],2.5,3.3,'leaf',5)
            P.flat(g,edges(pad),'forest',4)
            if i<3: flower(g,x,z,3,'pink' if i==0 else 'bone',2,rise=1)
        for x,z in ((12,25),(49,43),(37,10),(19,48)):
            broken_rock(g,x,z,0,4,5,x)
        grass(g,[(13,4,36),(48,4,20),(44,4,46)],'leaf',5)
    else:
        floor(g)
        if slug=='flower-meadow':
            for i,(x,z,ramp) in enumerate(((18,22,'red'),(28,19,'gold'),(42,22,'blue'),(21,38,'gold'),(35,43,'red'),(47,38,'blue'),(32,31,'orange'))):
                flower(g,x,z,2+i%3,ramp,2.5+i%2*.5)
        elif slug=='birch-grove':
            for i,(x,z,h) in enumerate(((22,28,43),(39,32,53),(30,43,37))):
                start=len(g.solids)
                trunk(g,[(x,2,z),(x-1,h*.6,z+1),(x+i-1,h,z-1)],[3.4,2.4,1.5],'bone',6,seed=i)
                stem=np.logical_or.reduce([q.mask(g.shape) for q in g.solids[start:]])
                P.flat(g,stem & (Y%9<2) & (((X+Z)%7)<4),'darkwood',3)
                for j,(dx,dy,dz) in enumerate(((-7,-12,0),(8,-8,1),(-4,0,3),(4,-4,-5))):
                    S.bar(g,'z',(x,h-20),(x+dx,h+dy),2,z+dz-1,z+dz+2,'bone',5)
                    leaf_block(g,x+dx,h+dy,z+dz,15-j,10,12,'leaf',4+j%2,bevel=2,seed=i*5+j)
        elif slug=='berry-bush':
            for i,(x,y,z) in enumerate(((23,13,29),(38,17,32),(30,23,39),(43,11,39),(21,9,40),(30,8,23))):
                leaf_block(g,x,y,z,17,13,15,'leaf',4+i%2,bevel=3,seed=i+20)
            for x,y,z in ((23,16,21),(39,19,24),(45,13,32),(28,25,32),(17,11,33),(39,11,46)):
                for dx,dy in ((-1.8,0),(1.8,1),(0,-2.5)):
                    S.disc(g,'z',x+dx,y+dy,1.7,z-2,z+1,'red',5,n=6)
        elif slug=='hedge-maze-corner':
            path=plan(g,[(12,47),(12,11),(48,11),(48,18),(20,18),(20,47)],2,3,'sand',5)
            P.stone(g,path,'sand',5,block=(6,4),cracks=.02,seed=2)
            for i,(x,z) in enumerate(((21,25),(32,25),(44,25),(25,36),(25,46))):
                leaf_block(g,x,18,z,16,28,14,'leaf',5,bevel=2.5,seed=i+30)
                leaf_block(g,x+(i%2-1)*3,30,z-1,16,8,15,'leaf',5,bevel=2,seed=i+35)
        elif slug=='hollow-log':
            outer=S.flat_ngon(32,15,13,8)
            inner=S.flat_ngon(32,15,8,8)
            masks=[]
            for k in range(8):
                # A different end length breaks each bark strip.
                m=front_log(g,[outer[k],outer[(k+1)%8],inner[(k+1)%8],inner[k]],10+k%3,53-k%2)
                P.planks(g,m,'wood',4,width=4,across='z',nails=False,seed=k)
                P.flat(g,m & (Z<14+k%3),'wood',6)
                P.flat(g,m & (Z<14+k%3) & ((np.floor(S.radial(g,'z',32,15))%3)==0),'darkwood',4)
                masks.append(m)
            for x,y,z in ((23,26,29),(35,27,42)):
                leaf_block(g,x,y,z,15,4,12,'moss',5,bevel=1.5,seed=x)
            S.bar(g,'z',(39,18),(49,28),4,34,39,'wood',4)
            S.disc(g,'z',49,28,3,34,39,'wood',6,n=6)
        else: raise KeyError(slug)
    return g


def front_log(g,poly,lo,hi):
    g.prism('z',poly,lo,hi,C('wood',4))
    return S.last(g)
