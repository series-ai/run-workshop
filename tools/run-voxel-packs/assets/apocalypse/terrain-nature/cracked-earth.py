"""Dry earth plates separate along deep, forked cracks."""
import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import blob, ctr, make, plan, rock, tuft
from pnkit import edges
from voxgrid import C, Grid, Part

SIZE = (66, 18, 66)


def build():
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    outline = blob(33, 33, 30, 30, n=10, jitter=0.06, seed=1)
    ground = plan(g, outline, 0, 4, "sand", 5)
    P.mottle(g, ground, "sand", 5, cell=12, seed=2)
    # Raised plates form a broken mosaic around one dark fissure.
    cells = (
        [(5, 9), (17, 6), (20, 16), (15, 23), (6, 20)],
        [(20, 7), (31, 6), (30, 20), (24, 22), (21, 16)],
        [(34, 7), (46, 8), (46, 19), (40, 23), (33, 19)],
        [(49, 10), (59, 13), (59, 26), (52, 28), (48, 20)],
        [(7, 25), (16, 25), (23, 32), (18, 40), (6, 37)],
        [(26, 25), (37, 25), (41, 35), (33, 40), (25, 34)],
        [(44, 26), (56, 31), (57, 41), (47, 42), (42, 35)],
        [(6, 41), (17, 44), (19, 54), (11, 58), (5, 53)],
        [(21, 42), (32, 43), (34, 55), (24, 60), (20, 54)],
        [(37, 43), (46, 46), (55, 45), (53, 56), (39, 59)],
    )
    for k, points in enumerate(cells):
        cx = sum(x for x, z in points) / len(points)
        cz = sum(z for x, z in points) / len(points)
        crown = [(cx + (x-cx)*.85, cz + (z-cz)*.85) for x,z in points]
        cut=k%len(crown)
        broken=[]
        for ii,a in enumerate(crown):
            broken.append(a)
            if ii==cut:
                b=crown[(ii+1)%len(crown)]
                u=(a[0]*.6+b[0]*.4,a[1]*.6+b[1]*.4)
                v=(a[0]*.4+b[0]*.6,a[1]*.4+b[1]*.6)
                broken.extend([u,((u[0]+v[0])*.5+(cx-(u[0]+v[0])*.5)*.32,(u[1]+v[1])*.5+(cz-(u[1]+v[1])*.5)*.32),v])
        crown=broken
        ledge = plan(g, points, 4, 5, "sand", 4)
        m = plan(g, crown, 5, 7 + (k % 3), "sand", 5 + k % 2)
        P.flat(g, m & (Y < 6), "rust", 4)
        angle=k*1.71
        along=(X-cx)*np.cos(angle)+(Z-cz)*np.sin(angle)
        across=-(X-cx)*np.sin(angle)+(Z-cz)*np.cos(angle)
        crack=(abs(across-.8*np.sin(along*.6+k))<.65)&(along>-3)&(along<4+k%3)
        fork=(abs(across-1.5-along*.65)<.55)&(along>0)&(along<4)
        P.flat(g,m&(crack|fork)&(Y>6),"sand",3)
        P.mottle(g,m,"sand",5+k%2,cell=4,seed=30+k)
        P.flat(g,m&(crack|fork)&(Y>6),"sand",3)
        P.flat(g, edges(ledge), "sand", 3)
        if k%2==0:
            px,pz=crown[(cut+3)%len(crown)]
            pts=[(px-.5,pz-.5),(px+2,pz+.2),(px+.7,pz+2)]
            plan(g,pts,7+k%3,8+k%3,"sand",5)
    P.flat(g, ground & (Y > 2) & (np.hypot(X - 33, Z - 33) < 10), "rust", 4)
    for cx, cz, r in ((13, 37, 3.2), (52, 45, 4.2), (45, 13, 3.0)):
        rock(g, cx, cz, 4, r, r * 0.7, 3, "stone", 5, shrink=0.58, n=6, seed=int(cx))
    for k, (tx, tz) in enumerate(((10, 12), (47, 52), (59, 25))):
        tuft(g, tx, tz, 4, 5, blades=4, spread=2.5, ramp="khaki", shade=5, seed=10 + k)
    # A faded warning stripe points at the unstable center.
    P.flat(g, ground & (Y > 2) & (X > 30) & (X < 35) & (Z > 4) & (Z < 12), "gold", 5)
    return make("terrain-nature", "cracked-earth", "Cracked Earth", Part("cracked-earth", g))
