"""Shaped vessels, paper, silk, stone, and a working jaw trap."""
import math
import numpy as np
import paint as P
import pnshapes as S
from _kit import C, Grid, Clip, Socket, keys, pfx, single, world
from _pn import coords, last, assemble
from pnkit import box
from _double_nature import polygon, branch, rock


def ring(g,axis,cu,cv,r,thickness,lo,hi,ramp,shade,start=0,end=math.tau,n=16):
    for i in range(n):
        a=start+(end-start)*i/n;b=start+(end-start)*(i+1)/n
        pts=[(cu+math.cos(a)*r,cv+math.sin(a)*r),(cu+math.cos(b)*r,cv+math.sin(b)*r),
             (cu+math.cos(b)*(r-thickness),cv+math.sin(b)*(r-thickness)),(cu+math.cos(a)*(r-thickness),cv+math.sin(a)*(r-thickness))]
        g.prism(axis,pts,lo,hi,C(ramp,shade))


def base(g,cx,cz,rx,rz):
    g.prism("y",polygon(cx,cz,rx,rz,8,.2),0,4,C("purple",4))
    P.mottle(g,last(g),"purple",4,cell=4,seed=2)


def jar(slug):
    g=Grid(30,36,30);X,Y,Z=coords(g)
    base(g,15,15,13,13)
    S.disc(g,"y",15,15,10,4,6,"teal",4,n=12)
    # Thin arcs describe the vessel. Open sectors keep the sample visible.
    for yy in (6,25):ring(g,"y",15,15,10,1.2,yy,yy+2,"teal",5,n=12)
    for angle in (math.pi/4,3*math.pi/4,5*math.pi/4,7*math.pi/4):
        x,z=15+math.cos(angle)*9,15+math.sin(angle)*9
        branch(g,[(x,7,z),(x+math.cos(angle),15,z+math.sin(angle)),(x,26,z)],.8,"teal",6)
    S.disc(g,"y",15,15,10,27,29,"gold",4,n=12)
    S.disc(g,"y",15,15,8,29,31,"purple",5,n=12)
    box(g,13,31,13,17,33,17,"gold",5)
    if slug=="brain-jar":
        for x in (11.5,18.5):g.ellipsoid(x,18,15,4.5,5.5,6,C("magenta",5))
        brain=(g.a>0)&(Y>12)&(Y<25)&(X>6)&(X<24)&(Z>8)&(Z<22)
        P.flat(g,brain & (((X.astype(int)+Y.astype(int)*2+Z.astype(int))%6)<2),"blood",4)
        box(g,14,7,14,16,14,16,"bone",4)
        box(g,24,5,12,28,12,18,"purple",4)
        branch(g,[(25,10,15),(27,17,15),(23,21,15)],1,"gold",5)
    else:
        g.sphere(15,17,15,7,C("bone",6))
        m=(g.a>0)&(Y>10)&(Y<24)&(X>7)&(X<23)&(Z>7)&(Z<23)
        P.flat(g,m & (((X+Y*2+Z)%13)==0),"blood",5)
        S.disc(g,"z",15,17,4,7,9,"toxic",5,n=12)
        S.disc(g,"z",15,17,2,6,8,"purple",1,n=8)
        box(g,15,18,5,16,19,7,"bone",7)
        branch(g,[(15,12,18),(17,8,20),(15,6,17)],1.5,"blood",4)
    return single(slug,"props",slug.replace("-"," ").title(),g,sockets=[Socket("socket-sample",at=(0,20,0))],pfx=[pfx("rvx-monster-spore-glow","socket-sample","idle",size=14)])


def build(slug):
    if slug in ("brain-jar","eyeball-jar"):return jar(slug)
    if slug=="werewolf-trap":return trap()
    if slug=="mortuary-slab":
        g=Grid(38,30,46);X,Y,Z=coords(g);base(g,19,23,17,20)
        for x in (7,26):
            for z in (10,32):box(g,x,4,z,x+5,11,z+5,"stone",5)
        m=box(g,4,11,5,34,14,42,"stone",5);P.stone(g,m,"stone",5,block=(8,5),seed=2)
        # Shoulders, torso, knees, and feet have separate cloth contours.
        for pts,z0,z1 in (([(10,14),(28,14),(26,19),(23,21),(15,21),(12,19)],14,23),
                          ([(12,14),(26,14),(25,19),(20,21),(14,18)],23,32),
                          ([(14,14),(25,14),(24,18),(17,18)],32,39)):
            g.prism("z",pts,z0,z1,C("bone",5));m=last(g)
            P.flat(g,m&(((X+Y*2+Z//3)%8)<2),"bone",4)
        g.ellipsoid(19,18,11,5,4,4,C("bone",5))
        for z in (19,29):
            box(g,8,14,z,30,15,z+2,"darkwood",3)
            box(g,10,15,z,13,20,z+2,"darkwood",3)
            box(g,25,15,z,28,20,z+2,"darkwood",3)
            box(g,12,20,z,26,21,z+2,"darkwood",3)
        box(g,5,14,29,8,15,39,"iron",5)
        box(g,6,15,31,7,16,36,"gold",5)
    elif slug=="spell-scroll-pile":
        g=Grid(36,24,32);base(g,18,16,16,14)
        for i,(x,z,length) in enumerate(((5,8,20),(9,16,21),(4,24,20))):
            y=12 if i==1 else 7
            ring(g,"x",y,z,3.2,1.0,x,x+length,"bone",6,n=12)
            for xx in (x+5,x+length-5):
                ring(g,"x",y,z,3.8,.6,xx,xx+2,"purple",4,n=12)
            if i==1:
                g.prism("x",[(y+2,z+1),(y+2,z+4),(y+1,z+5),(y,z+4),(y+1,z+1)],x+7,x+length-7,C("bone",6))
                X,Y,Z=coords(g)
                P.flat(g,last(g)&(Z>z+3)&((X.astype(int)%4)==0),"purple",4)
    elif slug=="spider-egg-sac":
        g=Grid(38,30,34);X,Y,Z=coords(g);base(g,19,17,17,15)
        for i,(x,y,z,r) in enumerate(((10,11,10,5),(26,13,12,6),(17,14,24,6))):
            first=len(g.solids)
            g.prism("y",polygon(x,z,.8,.8,8,.2),y-r*1.5,y,C("bone",5),top=polygon(x,z,r,r,8,.2))
            g.prism("y",polygon(x,z,r,r,8,.2),y,y+r*.9,C("bone",5),top=polygon(x,z,r*.65,r*.65,8,.2))
            g.prism("y",polygon(x,z,r*.65,r*.65,8,.2),y+r*.9,y+r*1.5,C("bone",5),top=polygon(x,z,.8,.8,8,.2))
            m=np.logical_or.reduce([solid.mask(g.shape) for solid in g.solids[first:]])
            P.flat(g,m&(((X+Y*2+Z)%6)<1.5),"purple",3)
            P.flat(g,m&(((X-Y+Z)%7)<1.5),"bone",7)
        web=[(5,7),(18,5),(32,9),(30,23),(19,30),(7,25)]
        for k in range(2):
            ringpts=[(19+(x-19)*(1-k*.2),17+(z-17)*(1-k*.2)) for x,z in web]
            for i,a in enumerate(ringpts):
                S.bar(g,"y",a,ringpts[(i+1)%6],1.2,4+k,5+k,"bone",5+k)
        for a,b in (((5,7),(30,23)),((18,5),(19,30)),((32,9),(7,25))):
            S.bar(g,"y",a,b,1.2,5,6,"bone",6)
        # Sagging strands attach the neighboring sacs to the same nest.
        for a,b in (((10,10),(18,7)),((18,7),(26,11))):
            S.bar(g,"z",a,b,1.2,8,9,"bone",6)
        S.bar(g,"x",(10,12),(7,18),1.2,15,16,"bone",5)
        S.bar(g,"x",(7,18),(12,24),1.2,15,16,"bone",5)
    elif slug=="cracked-statue":
        g=Grid(36,52,32);X,Y,Z=coords(g);base(g,18,16,16,14)
        # The right shoulder is broken below the arm. The fracture is geometry.
        g.prism("z",[(8,5),(29,5),(25,20),(27,30),(22,34),(21,29),(18,33),(12,34),(9,29)],11,22,C("stone",5))
        P.mottle(g,last(g),"stone",5,cell=4,seed=2)
        for x in (12,18,24):
            g.prism("z",[(x-2,6),(x+2,6),(x+1,24),(x,29)],9,12,C("stone",4))
        S.skull(g,17,34,15,s=11,ramp="stone",base=5,eyes=("purple",2),socket=("purple",2))
        branch(g,[(11,31,16),(6,24,15),(8,19,12)],2.7,"stone",5)
        rock(g,28,23,4,3,4,4,1,"stone")
        # Dark fissures follow the fractured edge instead of a brick pattern.
        P.flat(g,(g.a>0)&(Z<13)&(Y>19)&(Y<31)&(abs(X-(Y*.3+12))<1),"purple",2)
    elif slug=="broken-wagon-wheel":
        g=Grid(38,40,28);base(g,19,14,17,12)
        # The missing upper-right arc is open geometry.
        ring(g,"z",17,19,14,3,10,13,"darkwood",5,start=.95,end=6.0,n=17)
        ring(g,"z",17,19,14.7,1,10,13,"iron",4,start=.95,end=6.0,n=17)
        for a in (1.2,1.95,2.7,3.45,4.2,4.95,5.7):
            end=(17+math.cos(a)*11.5,19+math.sin(a)*11.5)
            S.bar(g,"z",(17,19),end,1.1,10,13,"wood",6)
        S.bar(g,"z",(17,19),(23,23),1.2,10,13,"wood",5)
        S.disc(g,"z",17,19,3.5,8,15,"gold",4,n=8)
        rock(g,25,18,5,5,4,8,2)
        branch(g,[(29,4,8),(34,5,12)],1.2,"wood",5)
    else:raise KeyError(slug)
    return single(slug,"props",slug.replace("-"," ").title(),g,sockets=[Socket("socket-detail",at=(0,16,0))],pfx=[pfx("rvx-monster-spore-glow","socket-detail","idle",size=12)])


def trap():
    baseg,jaw=Grid(42,28,42),Grid(42,28,42)
    base(baseg,21,21,19,19)
    # Fixed jaw and moving jaw form two open semicircles.
    for g,a,b in ((baseg,0,math.pi),(jaw,math.pi,math.tau)):
        ring(g,"y",21,21,15,3,6,9,"iron",4,start=a,end=b,n=10)
        for i in range(8):
            t=a+(b-a)*(i+.5)/8;x,z=21+math.cos(t)*12.6,21+math.sin(t)*12.6
            S.cone(g,"y",x,z,1.7,9,14,"bone",6,n=4,r_top=.1)
    for x in (6,34):S.disc(baseg,"x",8,21,3,x,x+3,"gold",5,n=8)
    S.disc(baseg,"y",21,21,5.5,5,7,"purple",4,n=8)
    box(baseg,19,7,17,23,8,25,"gold",5)
    branch(baseg,[(21,5,21),(21,5,32),(28,5,34)],1,"iron",4)
    root=assemble({"base":baseg,"jaw":jaw},[("base",None,(21,0,21)),("jaw","base",(21,8,21))])
    close=Clip("close",{"jaw":{"rot":keys((0,(0,0,0)),(.5,(145,0,0)),(.8,(145,0,0)))}},loop=False)
    open_=Clip("open",{"jaw":{"rot":keys((0,(145,0,0)),(.7,(0,0,0)))}},loop=False)
    idle=Clip("idle",{"jaw":{"rot":keys((0,(0,0,0)),(1,(2,0,0)),(2,(0,0,0)))}})
    return world("werewolf-trap","props","Werewolf Trap",root,clips=[open_,close,idle],sockets=[Socket("socket-teeth",at=(0,10,0),parent="base")],pfx=[pfx("rvx-monster-blood-splat","socket-teeth","clip:close",size=18,at=.42)])
