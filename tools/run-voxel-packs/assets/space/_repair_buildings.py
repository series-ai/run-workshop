"""Distinct forms for the seven Space building repairs.

Each building has its own plinth: a dark plated pad with a hazard band, as
on the original Space buildings. Each pad is a whole number of 16-voxel
tiles and has its own outline (Art Director repair F19). Person doors are
blast doors with a leaf 24-28 high and 14-24 wide (scale.json grammar).
"""
import math
import numpy as np
from _life import Grid, Part, asset, box, coords, edges, front, plan, side, ngon_y, gem, mask_of, hazard, octo
from _bld import steel_roof, hull_box, sign, window, crate, beacon, blast_door, corner_posts, steel_box, fuel_drum
from pnshapes import cone, disc, dome, bar, facets, pipe
import paint as P


def block(g, xyz, ramp='steel', shade=5):
    m = box(g, *xyz, ramp, shade)
    P.flat(g, edges(m), ramp, max(2, shade - 2))
    X, Y, Z = coords(g)
    P.flat(g, m & (Y > xyz[4] - 1.1), ramp, min(7, shade + 1))
    return m


# Pad bounds (x0, x1, z0, z1) and the corner chamfer. Sizes are whole tiles.
PADS = {
    'alien-temple': (16, 112, 0, 112, 20),        # 96 x 112, a wide octagon
    'barracks-pod': (8, 120, 12, 92, 6),          # 112 x 80
    'cantina': (16, 112, 6, 102, 12),             # 96 x 96
    'cargo-depot': (8, 120, 12, 108, 3),          # 112 x 96, a square yard
    'greenhouse-dome': (14, 110, 8, 104, 18),     # 96 x 96, an octagon
    'power-relay': (16, 112, 16, 96, 9),          # 96 x 80
    'spaceport-terminal': (0, 128, 4, 100, 14),   # 128 x 96
}


def foundation(g, slug):
    x0, x1, z0, z1, ch = PADS[slug]
    cx, cz, hx, hz = (x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2
    m = plan(g, octo(cx, cz, hx, hz, ch), 0, 5, 'iron', 4, top=octo(cx, cz, hx - 2, hz - 2, max(1, ch - 1)))
    P.plates(g, m, 'iron', 4, size=(12, 7), seed=len(slug))
    X, Y, Z = coords(g)
    hazard(g, m & (Y < 2), period=5)


def plant(g, x, z, y=10):
    block(g,(x-1,y,z-1,x+1,y+18,z+1),'leaf',3)
    for s, h in ((-1,7),(1,12)):
        m=front(g,[(x,y+h-3),(x+s*8,y+h),(x+s*4,y+h+5),(x,y+h+2)],z-2,z+2,'leaf',5 if s<0 else 6)
        P.flat(g,m,'leaf',5 if s<0 else 6)


def temple(g):
    for y, r in ((5,43),(11,38),(17,32)):
        step=ngon_y(g,64,62,r,y,y+6,'purple',5,n=8,r_top=r-3)
        P.stone(g,step,'purple',5,block=(11,5),seed=y)
        P.flat(g,edges(step),'purple',3)
    # The gate stays open between two sloped pillars.
    for x in (38,80):
        front(g,[(x,22),(x+10,22),(x+9,72),(x+5,83),(x+1,72)],39,51,'bone',5)
        block(g,(x+3,30,38,x+7,69,41),'lime',6)
    lintel=front(g,[(35,69),(93,69),(86,83),(42,83)],37,54,'purple',5)
    P.stone(g,lintel,'purple',5,block=(10,5),seed=42)
    P.flat(g,edges(lintel),'bone',4)
    block(g,(44,22,70,84,31,85),'steel',5)
    altar=ngon_y(g,64,75,14,31,43,'purple',5,n=6,r_top=10)
    crystals=gem(g,64,75,43,11,40,'lime',5,n=6,waist=.25,cap=.12)
    X,Y,Z=coords(g)
    P.flat(g,mask_of(g,crystals)&(X>64),'lime',6)
    P.flat(g,mask_of(g,crystals)&(Y>73),'cyan',7)
    for x in (23,100):
        obelisk=cone(g,'y',x,71,6,5,63,'purple',5,n=5,r_top=2)
        P.stone(g,obelisk,'purple',5,block=(7,9),seed=x)
        P.flat(g,edges(obelisk),'purple',3)
        block(g,(x-2,35,65,x+2,56,67),'lime',6)
    P.flat(g,(g.a!=0)&(Y>26)&(Y<28)&(Z<52)&(np.abs(X-64)>16),"purple",4)
    P.flat(g,mask_of(g,crystals)&(Y>56)&(Y<59),"lime",7)
    sign(g,'-z',36,64,75,'XENO',board=('purple',5),ink=('bone',7),scale=2)
    for x in (33,91):
        ngon_y(g,x,30,5,5,12,'rust',5,n=6)
        gem(g,x,30,12,4,9,'lime',6,n=5)
    # A processional path leads from the pad edge to the gate.
    path = block(g,(55,5,4,73,7,38),'bone',5)
    P.flat(g, path & (np.floor(coords(g)[2]) % 6 == 0), 'purple', 4)


def barracks(g):
    # Three ground-level pods open onto one shared corridor.
    hull_box(g,25,5,36,105,40,48,'steel',5,size=(18,12),seed=2)
    for x in (35,65,95):
        pod=side(g,[(5,45),(5,88),(37,90),(59,79),(59,57),(38,45)],x-13,x+13,'bone',6)
        P.plates(g,pod,"bone",6,size=(18,14),seed=x)
        window(g,"+z",90,x-7,x+7,17,31,bar=False)
        steel_roof(g,x-13,x+13,46,91,38,63,ridge='z',ramp='steel',base=5,thick=3,overhang=1)
        window(g,'-z',45,x-8,x+8,18,33,bar=False)
        block(g,(x-12,6,43,x+12,9,46),'orange',5)
    # A recessed entry links the pod row to the front stoop.
    for x in (49,75): block(g,(x,5,21,x+5,40,43),'steel',5)
    front(g,[(46,35),(83,35),(79,48),(50,48)],18,44,'bone',6)
    # The blast door is 18 wide and 26 high (door grammar 24-36 high).
    blast_door(g,'-z',36,55,73,7,33,seed=11)
    block(g,(48,5,20,80,7,36),'steel',5)
    for y,z in ((2,12),(4,16)): block(g,(48,y,z,80,y+3,z+4),'steel',4)
    sign(g,'-z',17,64,44,'BARR',board=('orange',5),ink=('bone',7),scale=2)
    crate(g,21,5,20,12,'steel',5,stripe=('orange',6))
    crate(g,91,5,19,12,'bone',6,stripe=('cyan',6))
    beacon(g,108,5,34,h=14,lamp=('cyan',7))


def cantina(g):
    """A white-hull space bar: a gabled hall, an open service bay under a
    striped awning, a side door, a kitchen annex with a vent and a giant
    mug on the ridge."""
    X,Y,Z=coords(g)
    hall=hull_box(g,28,5,44,100,46,94,'bone',6,size=(14,10),seed=4)
    corner_posts(g,28,100,44,94,5,46,size=4,out=1,ramp='steel',base=3)
    # Orange trim: a kick band and an eave band frame the white hull.
    P.flat(g,hall&(Y>=8)&(Y<11),'orange',5)
    eave=block(g,(26,43,42,102,47,96),'orange',5)
    P.flat(g,eave&(np.floor(X+Z)%6==0),'orange',4)
    roof=steel_roof(g,28,100,44,94,47,70,ridge='x',ramp='steel',base=5,thick=4,overhang=3,seed=3)
    # The open service bay: a lit back window, a long counter and stools.
    window(g,'-z',44,38,90,20,38,bar=True)
    counter=block(g,(36,5,30,92,18,36),'bone',6)
    P.flat(g,counter&(Z<31)&(np.floor(X)%8<4)&(Y>7)&(Y<16),'orange',5)
    block(g,(34,18,28,94,20,38),'steel',5)
    deck=block(g,(30,5,16,98,6,44),'steel',4)
    P.flat(g,deck&(np.floor(X)%6==0),'steel',3)
    for x in (42,56,72,86):
        block(g,(x-1,5,22,x+1,11,24),'steel',4)
        disc(g,'y',x,23,3,11,13,'orange',5,n=8)
    # A striped awning slopes from the eave over the bay on two posts.
    aw=side(g,[(43,44),(46,44),(38,18),(35,18)],30,98,'orange',5)
    P.flat(g,aw&(np.floor(X)%8<4),'bone',6)
    for x in (31,94): block(g,(x,5,18,x+3,36,21),'steel',3)
    sign(g,'-z',39,64,49,'CANT',board=('iron',5),ink=('cyan',7),scale=2)
    # The side door on -x is 24 wide and 28 high, with a step.
    blast_door(g,'-x',28,58,82,6,34,seed=12)
    block(g,(18,5,56,26,6,84),'steel',4)
    for z0 in (50,86):
        window(g,'-x',28,z0-4,z0+4,22,34,bar=False)
    # Rear windows and a kitchen annex with a vent stack on +x.
    for x0 in (36,58,80):
        window(g,'+z',94,x0,x0+12,20,34,bar=False)
    annex=steel_box(g,100,5,56,110,32,88,'steel',5,seed=9)
    P.flat(g,annex&(Y>29),'orange',5)
    window(g,'+x',110,64,74,14,24,bar=False)
    vent=disc(g,'y',105,80,3,32,58,'rust',5,n=8)
    P.flat(g,vent&(np.floor(Y)%5==0),'iron',3)
    cone(g,'y',105,80,5,58,62,'iron',4,n=8,r_top=2)
    # A giant mug on the ridge is the function prop.
    cup=ngon_y(g,64,69,11,66,91,'bone',6,n=8,r_top=12)
    P.flat(g,cup&(Y>88),'rust',3)
    P.flat(g,cup&(Y>89)&(np.hypot(X-64,Z-69)<8),'gold',6)
    P.flat(g,cup&(Y>70)&(Y<74),'orange',5)
    for xyz in ((75,71,65,81,75,73),(77,73,65,82,86,73),(74,84,65,81,89,73)):
        block(g,xyz,'rust',5)
    # Two yard tables with stools.
    for x in (24,104):
        block(g,(x-1,5,23,x+1,14,25),'steel',4)
        disc(g,'y',x,24,6,14,16,'bone',6,n=8)
    crate(g,100,5,90,9,'steel',5,stripe=('orange',6))


def depot(g):
    hull_box(g,21,5,46,106,55,92,'steel',5,size=(18,13),seed=5)
    steel_roof(g,18,109,43,95,55,77,ridge='x',ramp='bone',base=6,thick=4,overhang=2)
    block(g,(37,5,42,89,45,48),'iron',3)
    for x in (34,89):
        post=steel_box(g,x,5,18,x+5,64,46,'steel',5,size=(5,8),seed=x)
        hazard(g,post&(coords(g)[1]<14),period=4)
    block(g,(33,59,17,96,66,25),'rust',5)
    for x in (35,89):
        bar(g,'z',(x,46),(x+(-8 if x>60 else 8),60),3,17,25,'steel',5)
    block(g,(58,55,17,73,61,27),'orange',5)
    block(g,(64,34,19,67,56,23),'steel',4)
    block(g,(59,29,19,67,34,24),'orange',6)
    block(g,(58,29,19,62,37,24),'orange',6)
    # Visible freight occupies the broad loading bay and the front apron.
    for x,y,z,s in ((43,5,45,17),(69,5,48,17),(70,22,48,16),(49,5,23,15)):
        crate(g,x,y,z,s,'orange' if y==5 else 'steel',5,stripe=('cyan',6))
    # The sign hangs on the front of the gantry beam, so the beam no longer hides it.
    sign(g,'-z',17,64,57,'CARGO',board=('steel',5),ink=('orange',7),scale=2)
    # Two window rows break the tall single storey on every face.
    for v0,v1 in ((18,30),(38,48)):
        for x in (26,99): window(g,'+z',92,x,x+9,v0,v1,bar=False)
        for u in (24,96): window(g,'-z',46,u,u+7,v0,v1,bar=False)
        for z in (56,74): window(g,'-x',21,z,z+9,v0,v1,bar=False)
        window(g,'+x',106,58,67,v0,v1,bar=False)
    # A person door on +x beside the freight bay.
    blast_door(g,'+x',106,74,90,5,31,seed=13)


def greenhouse(g):
    drum=ngon_y(g,64,61,39,5,16,'steel',5,n=12,r_top=35)
    X,Y,Z=coords(g)
    P.flat(g,drum&(Y>12),'rust',5)
    shell=dome(g,64,61,16,35,54,n=12,rings=5,ramp='cyan',base=5,ribs=('steel',4))
    # Broad panes and frame ribs follow the dome facets.
    P.flat(g,shell,'cyan',5)
    P.flat(g,shell&(Y>48),'cyan',6)
    angle=np.arctan2(Z-61,X-64)
    ribs=np.abs(np.sin(angle*6))<.13
    P.flat(g,shell&(ribs|((Y>30)&(Y<33))|((Y>50)&(Y<53))),'steel',4)
    P.flat(g,shell&(~ribs)&(Y>58),'cyan',7)
    for x in (33,86):
        block(g,(x-8,5,17,x+8,11,35),'rust',5)
        for dx in (-4,4): plant(g,x+dx,26,11)
    for x in (54,70): plant(g,x,14,5)
    for x in (52,73): block(g,(x,5,25,x+4,38,35),'steel',4)
    side(g,[(33,21),(42,34),(46,35),(37,21)],49,80,'bone',6)
    # The entry leaf is 14 wide and 26 high (door grammar).
    block(g,(55,5,33,73,34,35),'teal',3)
    leaf=block(g,(57,5,32,71,31,34),'cyan',6)
    P.flat(g,leaf&(np.abs(X-64)<0.6),'steel',4)
    P.flat(g,leaf&(Y<8),'steel',4)
    sign(g,'-z',24,64,40,'GROW',board=('steel',5),ink=('lime',7),scale=2)
    crate(g,18,5,55,11,'steel',5,stripe=('lime',6))


def relay(g):
    X,Y,Z=coords(g)
    hull_box(g,35,5,39,94,52,90,'steel',5,size=(18,12),seed=6)
    corner_posts(g,35,94,39,90,5,52,size=4,out=1,ramp='iron',base=3)
    side(g,[(52,37),(52,91),(64,84),(64,44)],31,98,'bone',6)
    # A blast door (24 wide, 28 high) with a hazard frame under the GRID sign.
    blast_door(g,'-z',39,52,76,5,33,seed=14)
    sign(g,'-z',38,64,36,'GRID',board=('steel',5),ink=('cyan',7),scale=2)
    for face,plane in (('-x',35),('+x',94)):
        for z0 in (48,70):
            window(g,face,plane,z0,z0+10,20,32,bar=False)
    window(g,'+z',90,46,58,20,32,bar=False)
    tr=steel_box(g,66,5,90,86,26,95,'steel',4,seed=15)
    P.flat(g,tr&(Z>94)&(np.floor(X)%4==0)&(Y>9)&(Y<22),'iron',3)
    tower=ngon_y(g,64,65,14,55,108,'steel',5,n=8,r_top=10)
    P.flat(g,tower,'steel',5)
    # Four clean copper turns surround the tall insulator.
    for y,r in ((64,31),(76,29),(88,26),(99,22)):
        ring=ngon_y(g,64,65,r,y,y+5,'rust',5,n=12,r_top=r-1)
        P.flat(g,ring,'rust',5)
        P.flat(g,ring&(Y>y+3),'rust',6)
        P.flat(g,ring&(Y<y+1),'rust',3)
    for y in (70,82,94,104):
        ring=ngon_y(g,64,65,12,y,y+4,'cyan',6,n=8)
        P.flat(g,ring,'cyan',6)
    cone(g,'y',64,65,8,108,122,'rust',5,n=8,r_top=3)
    for x in (29,102):
        block(g,(x-3,5,60,x+3,68,66),'steel',5)
        disc(g,'y',x,63,7,62,66,'rust',5,n=8)
        block(g,(x-2,66,61,x+2,76,65),'cyan',6)
    crate(g,21,5,22,11,'steel',5,stripe=('orange',6))
    crate(g,96,5,22,11,'rust',5,stripe=('cyan',6))
    beacon(g,106,5,86,h=15,lamp=('orange',7))


def terminal(g):
    """A spaceport hall: a white base storey, a glass concourse with steel
    corner posts under a gable roof and a skylight, an arrival canopy on
    four posts, and a radar mast."""
    X,Y,Z=coords(g)
    hull_box(g,22,5,44,106,40,92,'bone',6,size=(16,10),seed=7)
    corner_posts(g,22,106,44,92,5,40,size=4,out=1,ramp='steel',base=3)
    block(g,(20,38,42,108,42,94),'steel',3)
    glass=front(g,[(26,42),(102,42),(96,66),(32,66)],46,90,'cyan',5)
    P.flat(g,glass&(Y>58),'cyan',6)
    P.flat(g,glass&((np.floor(X)%12==4)|(np.abs(Y-54)<1)),'steel',4)
    for x0,x1 in ((26,32),(102,96)):
        for z0 in (45,88):
            bar(g,'z',(x0,42),(x1,66),3,z0,z0+3,'steel',3)
    roof=steel_roof(g,30,98,46,90,66,82,ridge='x',ramp='steel',base=5,thick=4,overhang=3,seed=5)
    sky=block(g,(52,76,60,76,87,76),'bone',6)
    P.flat(g,sky&(Y>78)&(Y<85)&((Z<61)|(Z>74)),'cyan',6)
    # Arrival canopy: a sloped slab from the hall over the forecourt.
    canopy=side(g,[(40,44),(43,44),(39,10),(36,10)],22,106,'bone',6)
    for m,fr in facets(g,g.solids[-1:]): P.plates(g,m,'bone',6,size=(16,12),frame=fr,seed=6)
    P.flat(g,canopy&(Z<13),'orange',5)
    for x in (26,50,78,102): block(g,(x-2,5,12,x+1,37,15),'steel',3)
    sign(g,'-z',14,64,40,'PORT',board=('steel',5),ink=('cyan',7),scale=2)
    # The main entry is a 24 x 28 blast door between two wide windows.
    blast_door(g,'-z',44,52,76,5,33,seed=16)
    for u0 in (28,86): window(g,'-z',44,u0,u0+14,14,30,bar=False)
    for x in (38,90):
        block(g,(x-3,5,22,x+3,17,28),'steel',5)
        block(g,(x-2,15,22,x+2,18,28),'cyan',6)
    # Side and rear walls carry windows and a rear access door.
    for face,plane in (('-x',22),('+x',106)):
        for z0 in (52,72): window(g,face,plane,z0,z0+12,16,30,bar=False)
    for u0 in (28,84): window(g,'+z',92,u0,u0+14,16,30,bar=False)
    blast_door(g,'+z',92,56,74,5,31,seed=17)
    pipe(g,[(48,5,95),(48,36,95),(80,36,95),(80,5,95)],s=3,ramp='rust',base=4)
    # A radar mast with a dish and a beacon stands beside the hall.
    mast=block(g,(110,5,66,114,96,70),'steel',4)
    P.flat(g,mast&(np.floor(Y)%10<2),'orange',5)
    for y in (30,60):
        bar(g,'x',(y,68),(y+14,58),2.5,111,113,'steel',4)
    dish=cone(g,'z',112,92,10,58,63,'bone',6,n=10,r_top=3,tip='hi')
    P.flat(g,dish&(Z<59.5),'bone',7)
    beacon(g,112,96,68,h=6,lamp=('orange',7))
    crate(g,6,5,62,10,'steel',5,stripe=('orange',6))
    crate(g,8,5,76,8,'bone',6,stripe=('cyan',6))


BUILDERS={'alien-temple':temple,'barracks-pod':barracks,'cantina':cantina,'cargo-depot':depot,'greenhouse-dome':greenhouse,'power-relay':relay,'spaceport-terminal':terminal}


def make_building(slug):
    g=Grid(128,124,112)
    foundation(g, slug)
    BUILDERS[slug](g)
    return asset('buildings',slug,slug.replace('-',' ').title(),Part(slug+'-body',g,pivot=(64,0,56)))
