"""Open pools and connected organic shapes for the monster expansion."""
import math
import numpy as np
import paint as P
import pnshapes as S
from _kit import C, Grid, Socket, pfx, single
from _pn import coords, last
from pnkit import box


def polygon(cx, cz, rx, rz, n=8, phase=0):
    return [(cx + math.cos(phase + i * math.tau / n) * rx,
             cz + math.sin(phase + i * math.tau / n) * rz) for i in range(n)]


def rock(g, x, z, rx, rz, y, height, seed=0, ramp="gray"):
    lower = polygon(x, z, rx, rz, 7, .2)
    upper = polygon(x + rx*.12, z - rz*.12, rx*.65, rz*.65, 7, .2)
    g.prism("y", lower, y, y+height, C(ramp, 4+seed%2), top=upper)
    m=last(g); X,Y,Z=coords(g)
    P.mottle(g,m,ramp,4+seed%2,cell=5,seed=seed)
    P.flat(g,m & (Y>y+height*.65) & (((X//4+Z//5+seed)%4)==0),"moss",5)
    return m


def stepped_rock(g,x,z,rx,rz,y,height,seed=0,ramp="stone"):
    bottom=polygon(x,z,rx,rz,5,.2)
    shoulder=polygon(x+.7,z-.6,rx*.82,rz*.82,5,.2)
    crown=polygon(x-.8,z+.5,rx*.62,rz*.62,5,.2)
    tip=polygon(x+.5,z-.4,rx*.36,rz*.36,5,.2)
    g.prism("y",bottom,y,y+height*.45,C(ramp,4+seed%2),top=shoulder)
    first=last(g)
    g.prism("y",crown,y+height*.45,y+height,C(ramp,5),top=tip)
    m=first|last(g);X,Y,Z=coords(g)
    P.flat(g,m & (Y>y+height*.84),"moss",5)
    P.flat(g,m & (Y>y+2) & (Y<y+height*.75) & (abs(X-x+.3*(Z-z))<.6),ramp,3)
    return m


def branch(g, points, radius=2, ramp="wood", shade=5):
    # Six planar faces keep stems smooth and the triangle count small.
    for i,(a,b) in enumerate(zip(points,points[1:])):
        delta=[abs(b[k]-a[k]) for k in range(3)]
        axis=max(range(3),key=lambda k:delta[k])
        plane=[k for k in range(3) if k!=axis]
        aa,bb=(a,b) if a[axis]<b[axis] else (b,a)
        r=max(1.1,radius*(1-i/(len(points)+1)))
        sides=4 if radius<=2 else 6
        def section(p,rr):
            return [(max(0,min(g.shape[plane[0]],p[plane[0]]+math.cos(.2+j*math.tau/sides)*rr)),
                     max(0,min(g.shape[plane[1]],p[plane[1]]+math.sin(.2+j*math.tau/sides)*rr))) for j in range(sides)]
        g.prism("xyz"[axis],section(aa,r),aa[axis],bb[axis],C(ramp,shade),top=section(bb,max(1.1,r*.83)))


def leaf(g, a, b, width=3, ramp="moss", shade=5):
    # A bent lance tapers to one point.
    x,y,z=a; xx,yy,zz=b
    if abs(xx-x)>=abs(zz-z):
        g.prism("z",[(x,y),(x+(xx-x)*.5-width,y+(yy-y)*.55),
                      (xx,yy),(x+(xx-x)*.5+width,y+(yy-y)*.55)],min(z,zz),max(z,zz)+1.5,C(ramp,shade))
    else:
        g.prism("x",[(y,z),(y+(yy-y)*.55,z+(zz-z)*.5-width),
                      (yy,zz),(y+(yy-y)*.55,z+(zz-z)*.5+width)],min(x,xx),max(x,xx)+1.5,C(ramp,shade))


def ground(g,w,d,y=4):
    g.prism("y",[(1,3),(w*.3,1),(w-3,2),(w-1,d*.6),(w-4,d-1),(3,d-2)],0,y,C("wood",5))
    m=last(g);X,Y,Z=coords(g)
    P.mottle(g,m,"wood",5,cell=5,seed=3)
    P.flat(g,m&(Y>=y-1),"moss",5)
    P.flat(g,m&(Y>=y-1)&(((X//4+Z//5)%5)==1),"moss",5)


def terrain_finish(g,slug):
    X,Y,Z=coords(g);occ=g.a>0
    # Paint mineral layers across every exposed face.
    stone=occ & np.isin(g.a,[C(r,n) for r in ("stone","gray") for n in range(1,8)]) & (Y>4)
    layer=(Y.astype(int)+(X.astype(int)//7+Z.astype(int)//9)%3)%6
    P.flat(g,stone & (layer==0),"stone",3)
    P.flat(g,stone & (layer==1),"stone",6)
    P.flat(g,stone & (layer==2) & (((X+Z).astype(int)%9)<4),"stone",5)
    fissure=((X.astype(int)+2*Z.astype(int)+(Y.astype(int)//4))%17)==0
    P.flat(g,stone & fissure & (layer>2),"stone",3)
    P.flat(g,stone & (layer==5) & (((X+Z).astype(int)%7)<2),"bone",5)
    soil=occ & (Y<4) & np.isin(g.a,[C(r,n) for r in ("wood","moss") for n in range(1,8)])
    P.flat(g,soil & (Y>=2) & (((X.astype(int)//4+Z.astype(int)//5)%4)==1),"moss",6)
    P.flat(g,soil & (Y>=2) & (((X.astype(int)//3+Z.astype(int)//4)%7)==2),"moss",4)
    if slug in ("gnarled-roots","thorn-bramble"):
        bark=occ & (Y>4) & np.isin(g.a,[C(r,n) for r in ("wood","purple") for n in range(1,8)])
        P.flat(g,bark & (((X+Z).astype(int)+Y.astype(int)//3)%5==0),"wood",3)
        P.flat(g,bark & ((Y.astype(int)+(X+Z).astype(int)//4)%6==0),"wood",6)


def pool(g,w,d,kind):
    ground(g,w,d,3)
    cx,cz=w/2,d/2
    radius=[1,.88,1.06,.93,1,.86,1.04,.93,1.02,.9,1,.95]
    rim=[(cx+math.cos(.17+i*math.tau/12)*w*.38*rr,cz+math.sin(.17+i*math.tau/12)*d*.36*rr) for i,rr in enumerate(radius)]
    inner=[(cx+(x-cx)*.72,cz+(z-cz)*.70) for x,z in rim]
    for i,a in enumerate(rim):
        b=rim[(i+1)%12];c=inner[(i+1)%12];e=inner[i]
        g.prism("y",[a,b,c,e],3,5,C("stone",4+i%2))
        if i not in (2,7):
            top=[(x*.82+u*.18,z*.82+v*.18) for (x,z),(u,v) in zip([a,b,c,e],[e,c,b,a])]
            g.prism("y",top,5,7+i%3,C("stone",5))
            X,Y,Z=coords(g);m=last(g)
            P.flat(g,m & (Y>6)&(((X.astype(int)//3+Z.astype(int)//4)%3)!=0),"moss",5)
    ramp,shade=("iron",2) if kind=="tar-pit" else ("toxic",4) if kind=="ectoplasm-pool" else ("purple",2)
    g.prism("y",inner,3,4,C(ramp,shade))
    X,Y,Z=coords(g);m=last(g)
    P.flat(g,m&(((X//5+Z//4)%4)==0),ramp,min(7,shade+1))
    for i,(x,z) in enumerate(((6,18),(w-7,12),(w-8,d-8),(15,d-6),(6,d-11))):
        rock(g,x,z,2.4+(i%2),2,3,2+i%2,i,"stone")
    if kind=="fog-pit":
        for i,(x,z) in enumerate(((cx-5,cz-2),(cx+4,cz+3))):
            # Broad overlapping puffs rise from the dark opening.
            for yy,rr,dx in ((4,5,0),(7,4,1),(10,3,-1)):
                lo=polygon(x+dx,z,rr,rr*.75,8,.2)
                hi=polygon(x+dx+1,z+.5,rr*.6,rr*.5,8,.2)
                g.prism("y",lo,yy+i,yy+3+i,C("teal",5+i),top=hi)
                P.flat(g,last(g)&(((X+Z).astype(int)%5)==0),"teal",6)
    else:
        for x,z,r in ((cx-6,cz-3,2.5),(cx+5,cz+2,3),(cx+1,cz-7,1.5)):
            g.ellipsoid(x,4,z,r,r*.65,r,C(ramp,shade+1))
        rock(g,8,9,5,5,3,5,4)
        S.skull(g,8,8,9,s=6,eyes=("toxic",6),socket=("purple",1))
    return [Socket("socket-pool",at=(0,7,0))],[pfx("rvx-monster-grave-mist" if kind=="fog-pit" else "rvx-monster-sewer-fume" if kind=="tar-pit" else "rvx-monster-ghost-wisps","socket-pool","idle",size=30)]


def build(slug):
    dims={"dungeon-floor":(48,12,48),"dungeon-grate":(48,12,48),"fog-pit":(46,22,46),
          "glow-mushrooms":(42,30,42),"iron-fence":(32,30,12),"mossy-rocks":(48,32,42),
          "thorn-bramble":(48,36,42),"weeping-willow":(48,78,48),"tar-pit":(46,22,44),
          "gnarled-roots":(52,30,42),"crooked-path":(48,12,48),"corpse-flower":(42,48,42),
          "web-thicket":(48,44,42),"stalagmites":(48,54,40),"bog-reeds":(44,48,44),
          "ectoplasm-pool":(42,24,38),"cliff-crags":(56,50,44)}
    w,h,d=dims[slug];cx,cz=w/2,d/2;g=Grid(w,h,d);X,Y,Z=coords(g);sockets=[];effects=[]
    if slug in ("tar-pit","ectoplasm-pool","fog-pit"):
        sockets,effects=pool(g,w,d,slug)
    elif slug in ("dungeon-floor","dungeon-grate","crooked-path"):
        box(g,0,0,0,w,3,d,"wood",5)
        for row in range(5):
            for col in range(5):
                x,z=col*9+2,row*9+2
                if slug=="dungeon-grate" and ((10<x<37 and 10<z<37) or (row,col) in ((0,0),(4,4))):continue
                if slug=="crooked-path" and abs(col-(2+round(math.sin(row*1.7))))>1:continue
                pts=[(x+1,z),(x+7,z),(x+8,z+2),(x+7,z+7),(x,z+8),(x,z+2)]
                g.prism("y",pts,3,5+(row+col)%2,C("gray",4+(row+col)%2))
                m=last(g);P.mottle(g,m,"gray",4+(row+col)%2,cell=3,seed=row*5+col)
                P.flat(g,m & (Y>=4)&(((X+Z+col)%17)==0),"purple",3)
        if slug=="dungeon-grate":
            box(g,12,3,12,38,4,38,"purple",1)
            for a,b,c,e in ((11,11,39,13),(11,37,39,39),(11,13,13,37),(37,13,39,37)):
                box(g,a,5,b,c,8,e,"iron",3)
            for x in range(15,37,5):box(g,x,7,13,x+2,9,37,"iron",4)
            for z in (16,32):box(g,13,6,z,37,8,z+2,"iron",4)
            for x in (12,37):
                for z in (12,37):box(g,x,8,z,x+1,9,z+1,"gold",5)
        if slug != "dungeon-grate":
            for i,(x,z) in enumerate(((5,28),(39,9),(35,40),(8,7))):
                rock(g,x,z,2.5,2.4,3,2,i,"moss")
    elif slug in ("mossy-rocks","cliff-crags","stalagmites"):
        ground(g,w,d,4)
        if slug=="mossy-rocks":
            for i,(x,z,rx,rz,hh) in enumerate(((12,12,10,8,11),(27,15,12,10,22),(35,28,9,9,12),(15,29,10,8,7))):
                stepped_rock(g,x,z,rx,rz,4,hh,i)
                for yy,factor in ((6,.96),(10,.78)):
                    if yy<4+hh*.8:
                        box(g,x-3,yy,z-rz*factor-1,x+4,yy+2,z-rz*factor+3,"stone",5)
                rock(g,x-2,z-2,rx*.63,rz*.67,4+hh*.55,hh*.48,i+4,"stone")
        elif slug=="cliff-crags":
            for i,(x,z,rx,rz,hh) in enumerate(((14,14,12,11,25),(30,22,14,13,40),(43,28,10,12,30),(16,32,10,9,16))):
                stepped_rock(g,x,z,rx,rz,4,hh,i,"stone")
                for k in (1,2,3):
                    yy=4+hh*k*.18;factor=1-k*.13
                    box(g,x-4+k,yy,z-rz*factor-2,x+5,yy+2,z-rz*factor+3,"stone",5)
                rock(g,x-2,z+1,rx*.75,rz*.8,hh*.47,hh*.45,i+1)
            for i in range(4):rock(g,6+i*12,7,3,3,4,3+i%2,i)
        else:
            for i,(x,z,r,hh) in enumerate(((10,10,6,26),(23,13,8,46),(37,20,6,34),(13,31,5,22),(29,30,7,36))):
                a=polygon(x,z,r,r*.8,6,.3)
                b=polygon(x+1,z-1,r*.73,r*.58,6,.3)
                c=polygon(x+.3,z-.5,r*.50,r*.40,6,.3)
                e=polygon(x+1,z-1,r*.30,r*.24,6,.3)
                f=polygon(x+1,z-1,r*.22,r*.17,6,.3)
                g.prism("y",a,4,hh*.42,C("stone",4+i%2),top=b)
                g.prism("y",c,hh*.42,hh*.72,C("stone",5),top=e)
                g.prism("y",f,hh*.72,hh,C("stone",5),top=polygon(x+2,z-2,.6,.6,6,.3))
                m=last(g);P.flat(g,m&(Y>hh-8),"purple",5)
        if slug=="stalagmites":
            for i,(x,z) in enumerate(((7,18),(18,8),(32,8),(37,31),(20,32))):
                rock(g,x,z,3,2.7,4,3+i%2,i,"stone")
                S.cone(g,"y",x,z,1.8,5,10+i,"stone",5,n=5,r_top=.5)
    elif slug=="glow-mushrooms":
        ground(g,w,d,4)
        branch(g,[(5,7,8),(12,8,18),(15,7,33)],3,"wood",5)
        for i,(x,z,r,hh) in enumerate(((11,11,7,22),(25,22,10,27),(30,33,6,17),(9,30,4,14))):
            branch(g,[(x+1,4,z),(x-1,hh-8,z+1),(x,hh-5,z)],1.8,"bone",5)
            a=polygon(x,z,r,r*.85,9,.2);b=polygon(x-1,z,r*.7,r*.65,9,.2)
            g.prism("y",a,hh-6,hh-3,C("purple",3),top=b)
            g.prism("y",b,hh-3,hh,C("magenta",5),top=polygon(x-1,z,2,2,9,.2))
            m=last(g);P.flat(g,m&(((X//3+Z//3+i)%4)==0),"toxic",6)
            for angle in range(0,360,60):
                t=math.radians(angle);branch(g,[(x,hh-6,z),(x+math.cos(t)*r*.8,hh-6,z+math.sin(t)*r*.7)],.7,"bone",4)
    elif slug in ("gnarled-roots","thorn-bramble","weeping-willow","web-thicket"):
        ground(g,w,d,4)
        if slug=="weeping-willow":
            trunk=[(cx,4,cz),(cx-3,24,cz),(cx+1,42,cz+1),(cx-2,59,cz)]
            branch(g,trunk,4,"wood",5)
            for i in range(7):
                t=i*math.tau/7
                xx,zz=cx+math.cos(t)*15,cz+math.sin(t)*15
                branch(g,[(cx,43,cz),(cx+math.cos(t)*10,59,cz+math.sin(t)*10),(xx,65-i%3,zz)],2.5,"wood",5)
                for j in (-1,0,1):
                    px,pz=xx+j*2,zz+j
                    yy=65-i%3
                    branch(g,[(px,yy,pz),(px+1,yy-9,pz),(px-1,yy-22-(i+j)%7,pz+1)],1.8,"moss",5+(i+j)%2)
                    leaf(g,(px,yy-5,pz),(px+2,yy-17,pz+1),2,"moss",5)
            for t in range(6):
                a=t*math.tau/6;branch(g,[(cx,10,cz),(cx+math.cos(a)*7,5,cz+math.sin(a)*7),(cx+math.cos(a)*13,4,cz+math.sin(a)*13)],2.5)
        elif slug=="gnarled-roots":
            rock(g,cx,cz,7,6,4,18,1,"wood")
            for i in range(7):
                t=i*math.tau/7
                pts=[(cx,16,cz),(cx+math.cos(t)*10,11,cz+math.sin(t)*8),
                     (cx+math.cos(t+.18)*17,6,cz+math.sin(t+.18)*13),(cx+math.cos(t+.12)*23,4,cz+math.sin(t+.12)*17)]
                branch(g,pts,3.3,"wood",5+i%2)
                a=pts[2]
                tip=(max(3,min(w-3,a[0]+math.cos(t+1)*7)),4,max(3,min(d-3,a[2]+math.sin(t+1)*6)))
                branch(g,[a,((a[0]+tip[0])/2,5,(a[2]+tip[2])/2),tip],1.4,"wood",5)
            # Cut growth rings remain visible on the stump top.
            m=(g.a>0)&(Y>20)&(abs(X-cx)<5)&(abs(Z-cz)<5)
            P.flat(g,m&((np.maximum(abs(X-cx),abs(Z-cz)).astype(int)%2)==0),"wood",3)
        elif slug=="thorn-bramble":
            paths=[[(22,4,19),(10,10,9),(8,22,14),(16,29,19),(22,22,17)],
                   [(24,4,20),(34,11,9),(38,23,14),(31,30,23)],
                   [(24,5,23),(15,12,31),(19,25,33),(27,31,28)],
                   [(26,4,23),(36,11,30),(32,20,34),(25,23,28)]]
            for i,pts in enumerate(paths):
                branch(g,pts,2,"purple" if i%2 else "wood",5)
                for j,(x,y,z0) in enumerate(pts[1:]):
                    side=1 if (i+j)%2 else -1
                    g.prism("z",[(x-1.5,y),(x+1.5,y),(x+side*4,y+5)],z0-1,z0+1,C("bone",5))
                    leaf(g,(x,y,z0),(x+side*5,y+3,z0+2),2,"moss",5)
                a=pts[2]
                branch(g,[a,(a[0]+(-4 if i%2 else 4),a[1]+3,a[2]-5)],1.2,"wood",5)
        else:
            for x,zz in ((7,13),(40,13)):
                branch(g,[(x,4,zz),(x-2 if x<20 else x+2,20,zz),(x,39,zz)],2.5)
                branch(g,[(x,26,zz),(cx,40,13)],1.5)
            hub=(cx,25,13)
            rings=[]
            for r in (5,10,16):rings.append([(cx+math.cos(i*math.tau/8)*r,25+math.sin(i*math.tau/8)*r*.8,13) for i in range(8)])
            for pt in rings[-1]:S.bar(g,"z",(hub[0],hub[1]),(pt[0],pt[1]),1.2,12,14,"bone",6)
            for ring in rings:
                for i in range(8):S.bar(g,"z",ring[i][:2],ring[(i+1)%8][:2],1.2,12,14,"bone",5)
            for a,b in (((8,25,13),(7,20,13)),((40,25,13),(40,20,13)),((24,38,13),(24,40,13))):S.bar(g,"z",a[:2],b[:2],1.4,12,14,"bone",6)
    elif slug=="bog-reeds":
        ground(g,w,d,4)
        S.disc(g,"y",cx,cz,12,4,5,"teal",3,n=9)
        for i,(x,z,top,bend) in enumerate(((8,12,34,2),(16,19,41,-1),(26,10,32,3),(33,23,38,-2),(22,32,35,2),(11,31,30,-2))):
            branch(g,[(x,4,z),(x+1,top*.55,z),(x+bend,top,z+1)],1,"moss",5)
            g.ellipsoid(x+bend,top,z+1,2,4,2,C("wood",5))
            for side in (-1,1):leaf(g,(x,top*.35,z),(x+side*6,top*.7,z+side*3),2,"moss",5+i%2)
    elif slug=="corpse-flower":
        ground(g,w,d,4)
        branch(g,[(cx,4,cz),(cx-2,14,cz),(cx,23,cz)],3,"moss",4)
        for i in range(6):
            t=i*math.tau/6;x,z=cx+math.cos(t)*13,cz+math.sin(t)*13
            leaf(g,(cx,8,cz),(x,13+i%2*3,z),4,"moss",5+i%2)
        # The spathe has six curved, separate lobes around a tall spadix.
        for i in range(8):
            t=i*math.tau/8;dt=.32
            inner=[(cx+math.cos(t-dt)*4,cz+math.sin(t-dt)*4),(cx+math.cos(t+dt)*4,cz+math.sin(t+dt)*4),(cx+math.cos(t+dt)*7,cz+math.sin(t+dt)*7),(cx+math.cos(t-dt)*7,cz+math.sin(t-dt)*7)]
            outer=[(cx+math.cos(t-dt)*10,cz+math.sin(t-dt)*10),(cx+math.cos(t+dt)*10,cz+math.sin(t+dt)*10),(cx+math.cos(t+dt)*14,cz+math.sin(t+dt)*14),(cx+math.cos(t-dt)*14,cz+math.sin(t-dt)*14)]
            g.prism("y",inner,18,32+i%3,C("blood",4),top=outer)
            P.mottle(g,last(g),"magenta",4,cell=3,seed=i)
        S.cone(g,"y",cx,cz,3.5,21,42,"bone",5,n=8,r_top=1.2)
        P.flat(g,last(g)&(Y>35),"toxic",6)
    elif slug=="iron-fence":
        ground(g,w,d,3)
        for x in (4,28):
            for low,high,width in ((3,8,6),(8,14,4),(14,20,5),(20,24,6)):
                post=box(g,x-width/2,low,2,x+width/2,high,10,"stone",5)
                P.flat(g,post & ((Y-low)<1),"stone",3)
                P.flat(g,post & (abs(X-x)<.6) & (Y>low+2),"stone",4)
            P.flat(g,last(g)&(Y>22),"purple",4)
            S.spire(g,x,6,24,3,4,"purple",4,tiles=False)
        for x in (8,13,18,23):
            box(g,x,3,5,x+1.5,23,7,"iron",3)
            g.prism("z",[(x-1,22),(x+2,22),(x+.5,27)],5,7,C("iron",4))
        for yy in (9,18):box(g,5,yy,5,27,yy+2,7,"iron",3)
        for x in (8,13,18,23):box(g,x,18,4,x+1,20,5,"gold",5)
    else:raise KeyError(slug)
    if slug in ("cliff-crags","mossy-rocks","stalagmites","tar-pit","ectoplasm-pool","fog-pit","gnarled-roots","thorn-bramble"):
        terrain_finish(g,slug)
    if not effects and slug not in ("dungeon-floor","iron-fence","mossy-rocks"):
        sockets=[Socket("socket-nature",at=(0,min(h-4,18),0))]
        effects=[pfx("rvx-monster-spore-glow","socket-nature","idle",size=24)]
    return single(slug,"terrain-nature",slug.replace("-"," ").title(),g,sockets=sockets,pfx=effects)
