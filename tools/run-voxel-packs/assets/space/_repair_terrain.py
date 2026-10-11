"""Rock, ice, and plant forms for the failed Space terrain models."""
import math
import numpy as np
import paint as P
from _life import Grid, Part, asset, box, coords, front, plan, ngon_y, gem, mask_of, light_top
from pnshapes import cone, disc, facets


def calm(g, solids, ramp, shade):
    P.mottle(g,mask_of(g,solids),ramp,shade,cell=8,seed=7)
    for m,fr in facets(g,solids):
        if fr=='top': P.flat(g,m,ramp,min(7,shade+1))


def polygon(cx,cz,rx,rz,n=8,seed=0):
    return [(cx+rx*(1+.18*math.sin(k*2.3+seed))*math.cos(k*2*math.pi/n),
             cz+rz*(1+.16*math.cos(k*1.7+seed))*math.sin(k*2*math.pi/n)) for k in range(n)]


def layer(g,cx,cz,rx,rz,y0,y1,ramp='steel',shade=5,seed=0,inset=1,lean=(0,0)):
    bottom=polygon(cx,cz,rx,rz,7,seed)
    top=polygon(cx+lean[0],cz+lean[1],max(1,rx-inset),max(1,rz-inset),7,seed)
    m=plan(g,bottom,y0,y1,ramp,shade,top=top)
    calm(g,g.solids[-1:],ramp,shade)
    return m


def ground(g,cx,cz,r,ramp='steel',shade=5):
    layer(g,cx,cz,r,r*.85,0,3,ramp,shade,seed=3,inset=2)
    layer(g,cx-2,cz+1,r-3,r*.85-3,3,5,ramp,min(6,shade+1),seed=5,inset=2)
    for dx,dz,w,h in ((-r*.62,-r*.28,5,5),(r*.63,r*.12,6,4),(-r*.15,r*.58,5,4)):
        layer(g,cx+dx,cz+dz,w,w*.8,3,h+3,ramp,shade,seed=round(dx),inset=2)


def stone(g,cx,cz,y0,r,h,ramp='steel',shade=5,seed=0):
    # Short offset strata expose ledges and broken crowns.
    levels=[(0,1.00),(0.18,.91),(.35,1.03),(.51,.80),(.69,.83),(.84,.60),(1,.39)]
    if h<12: levels=[(0,1),(.4,.8),(1,.45)]
    for k,((a,ra),(b,rb)) in enumerate(zip(levels,levels[1:])):
        dx=(k%3-1)*r*.12;dz=((k+seed)%3-1)*r*.10
        layer(g,cx+dx,cz+dz,r*ra,r*ra*.78,y0+h*a,y0+h*b,ramp,shade+(k%3==2),seed+k,inset=max(.5,r*(ra-rb)*.35),lean=(0,0))
    for k in range(6):
        a=2*math.pi*k/6+.2*seed
        y=y0+h*(.18+.105*k)
        rr=r*(.87-.07*k)
        w=max(2,r*.22)
        m=box(g,cx+rr*math.cos(a)-w,y,cz+rr*.8*math.sin(a)-w,cx+rr*math.cos(a)+w,y+max(2,h*.08),cz+rr*.8*math.sin(a)+w,ramp,shade)
        P.mottle(g,m & (g.a!=0),ramp,shade,cell=4,seed=seed+k)
        P.flat(g,m & (g.a!=0) & (coords(g)[1]>y+max(2,h*.08)-1),ramp,min(7,shade+1))


def ring(g,cx,cz,outer,inner,y0,heights,ramp,shade):
    n=len(heights)
    for k,h in enumerate(heights):
        a,b=2*math.pi*k/n,2*math.pi*(k+1)/n
        ro=outer+(k%3-1)*1.5
        ri=inner+(k%2)*1.0
        pts=[(cx+ro*math.cos(a),cz+ro*math.sin(a)),(cx+ro*math.cos(b),cz+ro*math.sin(b)),
             (cx+ri*math.cos(b),cz+ri*math.sin(b)),(cx+ri*math.cos(a),cz+ri*math.sin(a))]
        top=[(cx+(ro-(ro-ri)*.33)*math.cos(a),cz+(ro-(ro-ri)*.33)*math.sin(a)),(cx+(ro-(ro-ri)*.33)*math.cos(b),cz+(ro-(ro-ri)*.33)*math.sin(b)),
             (cx+(ri+(ro-ri)*.33)*math.cos(b),cz+(ri+(ro-ri)*.33)*math.sin(b)),(cx+(ri+(ro-ri)*.33)*math.cos(a),cz+(ri+(ro-ri)*.33)*math.sin(a))]
        tiers=((0,1),) if h-y0<5 else ((0,.38),(.38,.70),(.70,1))
        for tier,(lo,hi) in enumerate(tiers):
            f=.12*tier
            lower=[(x+(tx-x)*f,z+(tz-z)*f) for (x,z),(tx,tz) in zip(pts,top)]
            upper=[(x+(tx-x)*(f+.10),z+(tz-z)*(f+.10)) for (x,z),(tx,tz) in zip(pts,top)]
            m=plan(g,lower,y0+(h-y0)*lo,y0+(h-y0)*hi,ramp,shade+(k%3==0),top=upper)
            calm(g,g.solids[-1:],ramp,shade+(k%3==0))
        angle=(a+b)/2;rr=(ro+ri)/2
        w=max(2,(ro-ri)*.18)
        y=y0+(h-y0)*.48
        ledge=box(g,cx+rr*math.cos(angle)-w,y,cz+rr*math.sin(angle)-w,cx+rr*math.cos(angle)+w,y+2,cz+rr*math.sin(angle)+w,ramp,min(7,shade+1))
        P.mottle(g,ledge & (g.a!=0),ramp,shade,cell=3,seed=k)


def comet():
    g=Grid(90,52,104);cx,cz=43,34
    # Three overlapping tapered trails spread behind a rough ice head.
    for dx,dz,w,y,h,ramp in ((-7,82,11,14,11,'cyan'),(7,98,8,10,8,'bone'),(15,78,7,8,8,'teal')):
        for k in range(5):
            a=k/5;b=(k+1)/5
            z0=cz+(dz-cz)*a;z1=cz+(dz-cz)*b
            x0=cx+dx*a;x1=cx+dx*b
            w0=w*(1-a)*.8+1;w1=w*(1-b)*.8+1
            yy=y+(k%2)*2
            m=plan(g,[(x0-w0,z0),(x0+w0,z0),(x1+w1,z1),(x1-w1,z1)],yy,yy+h*(1-.12*k),ramp,5)
            P.mottle(g,m & (g.a!=0),ramp,5,cell=4,seed=k)
            edge=box(g,x0-2,yy+h*(1-.12*k)-1,z0,x0+2,yy+h*(1-.12*k)+2,z0+max(3,(z1-z0)*.5),ramp,6)
            P.flat(g,edge & (g.a!=0),ramp,6)
    stone(g,cx,cz,5,18,32,'bone',5,seed=4)
    layer(g,cx-4,cz-13,8,5,10,22,'steel',4,seed=5,inset=2)
    layer(g,cx+11,cz+3,6,5,5,18,'cyan',5,seed=6,inset=2)
    return g


def mushrooms():
    g=Grid(66,62,64);ground(g,33,32,28,'purple',4)
    X,Y,Z=coords(g)
    for x,z,y,r,h in ((25,30,8,15,30),(47,38,6,11,22),(17,47,6,8,15)):
        stem=cone(g,'y',x,z,r*.24,y,y+h,'bone',5,n=6,r_top=r*.32)
        P.flat(g,stem,'bone',5)
        cap=ngon_y(g,x,z,r,y+h-4,y+h+5,'magenta',5,n=8,r_top=r*.42)
        P.flat(g,cap,'magenta',5)
        P.flat(g,cap & (Y>y+h+3),'magenta',6)
        for dx,dz,rr in ((-r*.35,-r*.25,r*.20),(r*.3,r*.15,r*.25)):
            spot=cap&(np.hypot(X-x-dx,Z-z-dz)<rr)&(Y>y+h-1)
            P.flat(g,spot,'bone',6)
        P.flat(g,cap&(Y<y+h-2),'purple',4)
    return g


def basalt():
    g=Grid(76,76,70);ground(g,38,35,32,'steel',4)
    for x,z,r,h in ((27,33,10,56),(44,44,11,43),(51,24,9,64),(22,51,8,30),(58,49,7,25)):
        for k in range(6):
            y0=5+(h-5)*k/6;y1=5+(h-5)*(k+1)/6
            radius=r*(1-.035*k)+(1 if k in (1,4) else 0)
            layer(g,x+(k%2)*1.5,z-(k%3),radius,radius*.74,y0,y1,'steel',4+k%2,seed=x+k,inset=1)
            if k in (1,3,5):
                ledge=box(g,x-radius-2,y0+1,z-3,x-radius+3,y0+4,z+4,'steel',5)
                P.mottle(g,ledge & (g.a!=0),'steel',5,cell=3,seed=k)
        front(g,[(x-r*.55,h-5),(x+r*.50,h-5),(x+r*.45,h),(x-r*.35,h+2)],z-r*.4,z+r*.3,'steel',5)
    stone(g,13,31,4,6,16,'steel',5,7)
    return g


def crystal(g,x,z,y,r,h,ramp,lean):
    # Each cut crystal has a broad waist and an offset blunt tip.
    n=5
    b=polygon(x,z,r*.68,r*.65,n,2)
    mid=polygon(x+lean[0]*.35,z+lean[1]*.35,r,r*.8,n,2)
    top=polygon(x+lean[0],z+lean[1],max(1,r*.18),max(1,r*.15),n,2)
    m=np.zeros(g.shape,dtype=bool)
    profiles=((0,.68),(.18,.91),(.36,1),(.54,.78),(.72,.60),(1,.15))
    if h<12: profiles=((0,.68),(.4,1),(1,.15))
    for k,((a,ra),(b,rb)) in enumerate(zip(profiles,profiles[1:])):
        bottom=polygon(x+lean[0]*a,z+lean[1]*a,r*ra,r*.8*ra,n,2)
        upper=polygon(x+lean[0]*b,z+lean[1]*b,r*rb*.92,r*.8*rb*.92,n,2)
        m|=plan(g,bottom,y+h*a,y+h*b,ramp,5,top=upper)
    X,Y,Z=coords(g)
    P.flat(g,m,ramp,5)
    P.flat(g,m&(X>x+lean[0]*.3),ramp,6)
    P.flat(g,m&(Y>y+h*.8),'bone',6)
    P.mottle(g,m & (Y<y+h*.8),ramp,5,cell=5,seed=round(x))
    fracture=m & (np.abs(X-x-lean[0]*(Y-y)/max(h,1)+.30*(Z-z))<.7) & (Y>y+h*.2)&(Y<y+h*.75)
    P.flat(g,fracture,ramp,3)
    if h>18:
        for k in range(3):
            yy=y+h*(.18+.19*k)
            xx=x+lean[0]*(yy-y)/h+(-1 if k%2 else 1)*r*.57
            zz=z+lean[1]*(yy-y)/h+r*.25
            chip=front(g,[(xx-2,yy),(xx+2,yy),(xx+1,yy+max(3,h*.10)),(xx-2,yy+max(2,h*.05))],zz-2,zz+2,ramp,6)
            P.flat(g,chip & (g.a!=0),ramp,6)


def spires():
    g=Grid(76,80,70);ground(g,38,35,32,'purple',4)
    for x,z,r,h in ((25,27,10,61),(44,43,12,44),(55,25,7,30),(23,48,6,20)):
        stone(g,x,z,3,r+3,12,'steel',5,x)
        crystal(g,x,z,10,r,h,'cyan' if x!=44 else 'purple',(-5 if x<38 else 4,3))
    return g


def meteor():
    g=Grid(72,65,68);ground(g,36,34,31,'sand',4)
    stone(g,34,34,3,23,51,'steel',4,7)
    stone(g,52,45,3,8,15,'rust',4,2)
    X,Y,Z=coords(g);m=g.a!=0
    P.flat(g,m&(Y>18)&(Y<22)&(Z<34),'rust',5)
    P.flat(g,m&(Y>40)&(Y<43)&(X<34),'cyan',5)
    return g


def ice_shards():
    g=Grid(78,70,74);ground(g,39,37,33,'cyan',4)
    layer(g,34,36,24,20,5,9,'bone',6,seed=4,inset=4)
    for x,z,r,h,lean in ((26,29,11,50,(-7,3)),(49,47,10,38,(7,4)),(55,24,6,26,(3,-5)),(21,49,7,23,(-4,-3))):
        crystal(g,x,z,7,r,h,'cyan',lean)
    return g


def cactus():
    g=Grid(60,72,56);ground(g,30,28,25,'sand',5)
    X,Y,Z=coords(g)
    body=ngon_y(g,30,28,8,5,56,'teal',5,n=8,r_top=7)
    cap=cone(g,'y',30,28,7,55,66,'teal',5,n=8,r_top=3)
    P.flat(g,body|cap,'teal',5)
    P.flat(g,(body|cap)&((np.abs(X-26)<1)|(np.abs(X-33)<1)),'leaf',6)
    P.mottle(g,(body|cap)&(g.a!=0),'teal',5,cell=4,seed=6)
    for k in range(5):
        a=k*2*math.pi/5
        for yy,hh,rr in ((8,15,8),(25,14,8.5),(41,12,7.5)):
            rib=box(g,30+rr*math.cos(a)-1,yy,28+rr*math.sin(a)-1,30+rr*math.cos(a)+1,yy+hh,28+rr*math.sin(a)+1,'leaf',5)
            P.mottle(g,rib & (g.a!=0),'leaf',5,cell=4,seed=k)
        for yy in (14,31,47):
            thorn=cone(g,'y',30+8.5*math.cos(a),28+8.5*math.sin(a),1.4,yy,yy+4,'bone',6,n=4,r_top=0)
            P.flat(g,thorn & (g.a!=0),'bone',6)
    for s,y in ((-1,22),(1,34)):
        m=front(g,[(30+s*5,y),(30+s*16,y),(30+s*20,y+5),(30+s*20,y+20),(30+s*15,y+20),(30+s*15,y+7),(30+s*5,y+7)],24,32,'teal',5)
        P.flat(g,m,'teal',5)
        P.flat(g,m&(Y>y+17),'leaf',6)
        P.mottle(g,m & (g.a!=0) & (Y<y+17),'teal',5,cell=4,seed=y)
        for yy in (y+8,y+14):
            box(g,30+s*17-2,yy,23,30+s*17+2,yy+2,25,'leaf',5)
        crystal(g,30+s*17,28,y+19,3,6,'magenta',(s*2,0))
    for x,z in ((14,36),(44,18)):
        crystal(g,x,z,5,3,7,'magenta',(0,0))
    return g


def coral():
    g=Grid(70,70,64);ground(g,35,32,28,'purple',4)
    for x,z,dx,dz,h,ramp in ((35,32,-9,2,54,'teal'),(30,35,-19,-5,38,'magenta'),(38,29,18,-3,45,'purple'),(38,35,12,14,30,'teal')):
        for k in range(4):
            a=k/4;b=(k+1)/4
            xx=x+dx*a;zz=z+dz*a
            rr=4.5*(1-a)+1.5
            layer(g,xx,zz,rr,rr*.75,5+h*a,5+h*b,ramp,5,seed=k+round(x),inset=.7,lean=(dx/4,dz/4))
            if k in (1,2):
                side=-1 if k==1 else 1
                yy=5+h*(a+.13)
                twig=front(g,[(xx-2,yy-3),(xx+2,yy-3),(xx+side*9+2,yy+10),(xx+side*9-1,yy+14)],zz-2,zz+2,ramp,5)
                P.mottle(g,twig & (g.a!=0),ramp,5,cell=3,seed=k)
                crystal(g,xx+side*9,zz,yy+11,2,5,'magenta',(side,1))
        crystal(g,x+dx,z+dz,5+h-2,3,7,'lime',(dx*.08,dz*.08))
    return g


def lava_vent():
    g=Grid(84,63,80);cx,cz=42,40;ground(g,cx,cz,36,'steel',4)
    ring(g,cx,cz,37,22,3,[10,12,14,13,10,8,7,9],'steel',4)
    ring(g,cx,cz,32,9,4,[31,36,40,37,28,19,16,22],'steel',4)
    disc(g,'y',cx,cz,13,5,20,'orange',6,n=8)
    disc(g,'y',cx,cz,8,20,22,'gold',7,n=8)
    for dx,dz,r in ((-5,2,3),(3,-4,2),(6,4,3)):
        crust=ngon_y(g,cx+dx,cz+dz,r,21,23,'rust',3,n=5,r_top=r*.65)
        P.mottle(g,crust & (g.a!=0),'rust',3,cell=3,seed=dx+10)
    X,Y,Z=coords(g)
    flow=(g.a!=0)&(Y>19)&(Y<22)&(np.abs(X-cx+.45*(Z-cz))<1.5)
    P.flat(g,flow,'orange',6)
    # Two broad lava streams cross open notches in the broken rim.
    for dx,dz in ((-7,-14),(12,-10)):
        front(g,[(cx+dx-3,5),(cx+dx+3,5),(cx+dx+2,23),(cx+dx-1,26)],cz+dz-2,cz+dz+2,'orange',6)
    for x,z in ((15,47),(72,40),(25,12),(62,65)):
        stone(g,x,z,3,7,14,'steel',4,x)
    return g


def geyser():
    g=Grid(72,52,72);cx,cz=36,36;ground(g,cx,cz,32,'steel',5)
    ring(g,cx,cz,29,15,4,[9,11,12,11,8,7,6,8],'steel',5)
    ring(g,cx,cz,23,6,5,[21,25,27,25,18,12,11,16],'steel',5)
    disc(g,'y',cx,cz,7,8,10,'cyan',6,n=8)
    water=ngon_y(g,cx+1,cz-2,2.5,10,45,'cyan',6,n=8,r_top=2)
    P.mottle(g,water & (g.a!=0),'cyan',6,cell=3,seed=3)
    crown=mask_of(g,gem(g,cx+1,cz-2,41,5,8,'cyan',6,n=8,cap=.45))
    P.flat(g,crown & (g.a!=0),'cyan',6)
    for side in (-1,1):
        splash=front(g,[(cx+side*1,44),(cx+side*6,45),(cx+side*11,40),(cx+side*12,30),(cx+side*10,28),(cx+side*9,38),(cx+side*4,42)],cz-4,cz-1,'cyan',5)
        P.mottle(g,splash & (g.a!=0),'cyan',5,cell=3,seed=side+2)
        P.flat(g,splash & (g.a!=0) & (coords(g)[1]>41),'cyan',7)
    splash=plan(g,[(cx-1,cz-2),(cx+2,cz-2),(cx+3,cz+8),(cx,cz+10)],34,38,'cyan',6,
                top=[(cx-1,cz-2),(cx+2,cz-2),(cx+2,cz+6),(cx,cz+7)])
    P.flat(g,splash & (g.a!=0),'cyan',6)
    for x,z,r,h in ((16,46,8,17),(55,40,9,20),(46,17,7,14)):
        stone(g,x,z,3,r,h,'steel',5,x)
    for x,z in ((23,20),(57,56)):
        crystal(g,x,z,5,4,14,'teal',(2,-2))
    return g


def moon_rocks():
    g=Grid(56,38,48);ground(g,28,24,24,'sand',5)
    for x,z,r,h in ((25,26,13,28),(43,19,7,15),(13,37,7,12)):
        stone(g,x,z,3,r,h,'bone',5,x)
    X,Y,Z=coords(g)
    P.mottle(g,(g.a!=0)&(Y>8),'bone',5,cell=4,seed=7)
    fracture=(g.a!=0)&(Y>10)&(Y<24)&(np.abs(X-25+.3*(Y-15)+.2*(Z-26))<.7)
    P.flat(g,fracture,'steel',4)
    return g


def impact():
    g=Grid(66,28,64);cx,cz=33,32;ground(g,cx,cz,29,'sand',4)
    ring(g,cx,cz,30,19,3,[8,10,11,10,8,6,5,7],'steel',5)
    ring(g,cx,cz,28,10,4,[14,17,19,18,15,10,9,12],'steel',5)
    layer(g,cx,cz,13,11,5,6,'rust',4,seed=4,inset=1)
    stone(g,cx-2,cz+2,5,7,10,'steel',4,3)
    for x,z,h in ((11,24,10),(54,40,8),(38,54,7)):
        stone(g,x,z,3,5,h,'steel',5,x)
    return g


BUILDERS={'comet':comet,'alien-mushrooms':mushrooms,'basalt-columns':basalt,'crystal-spires':spires,'meteor-boulder':meteor,'ice-shards':ice_shards,'alien-cactus':cactus,'alien-coral':coral,'lava-vent':lava_vent,'geyser-vent':geyser,'moon-rocks':moon_rocks,'impact-crater':impact}


def make_terrain(slug):
    # The ten new models use their own pads and forms (Art Director repair).
    # The original models (moon-rocks, impact-crater) keep the builders above.
    import _ad_terrain
    g=(_ad_terrain.BUILDERS[slug] if slug in _ad_terrain.BUILDERS else BUILDERS[slug])()
    root=Part(slug,g,pivot=(g.shape[0]/2,0,g.shape[2]/2))
    if slug=='geyser-vent':
        from voxgrid import Socket
        return asset('terrain-nature',slug,'Geyser Vent',root,sockets=[Socket('socket-steam',at=(0,_ad_terrain.GEYSER_TOP-3,0))],
                     pfx=[{'effectId':'rvx-space-launch-steam','socket':'socket-steam','trigger':'idle','size':16,'aim':[0,1,0]}])
    return asset('terrain-nature',slug,slug.replace('-',' ').title(),root)
