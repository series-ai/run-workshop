"""Scavenger tank with sloped armor, running tracks and a working gun."""
import numpy as np

import paint as P
import pnglyph
import pnpaint as PP
import pnshapes as S
from _bld import bloom, part, rig, wheel_grid
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Socket

GW, GH, GD = 80, 76, 116
CX = 40


def hull() -> Grid:
    g = Grid(GW, GH, GD)
    X, Y, Z = S.coords(g)
    # The nose and tail use broad sloped faces.
    g.prism("x", [(15, 7), (39, 7), (48, 18), (52, 82), (44, 108), (17, 108), (12, 96), (12, 20)], 19, 61, C("khaki", 5))
    shell = S.last(g)
    P.plates(g, shell, "khaki", 5, size=(12, 10), rivets=True, seed=2)
    for y in (18, 23):
        P.flat(g, shell & (Y >= y) & (Y < y + 2), "rust", 4)
    P.flat(g, shell & (Y > 45), "khaki", 7)
    # A dark track frame joins the wheels into one heavy silhouette.
    for x0, x1 in ((3, 17), (63, 77)):
        track = box(g, x0, 7, 13, x1, 26, 104, "iron", 4)
        P.plates(g, track, "iron", 4, size=(12, 8), rivets=True, seed=x0)
        for z in range(17, 103, 8):
            tread = box(g, x0, 5, z, x1, 9, z + 4, "steel", 5)
            P.flat(g, edges(tread), "iron", 3)
    for xx in (3,76):
        for zz in (26,48,70,92):
            cap=S.disc(g,"x",15,zz,6,xx,xx+1,"steel",5,n=8)
            P.flat(g,cap & (np.hypot(Y-15,Z-zz)<2),"gold",5)
    hatch=box(g,29,49,80,51,53,96,"steel",5)
    P.flat(g,edges(hatch),"iron",3)
    # Rear vents, front tow eyes and a striped dozer lip.
    for x in (24, 29, 34, 39, 44, 49, 54):
        box(g, x, 33, 99, x + 2, 39, 101, "iron", 3)
    blade = box(g, 10, 13, 3, 70, 20, 9, "steel", 5)
    PP.hazard(g, blade, period=8, a=("gold", 5), b=("darkwood", 4))
    for x in (18, 58):
        S.disc(g, "z", x, 19, 3, 0, 4, "steel", 5, n=8)
    bloom(g, shell, 8, ((19, 14, 8), (61, 50, 108)), r=(2.0, 4.0), ramp="rust", shades=(5, 4), seed=5)
    return g


def turret() -> Grid:
    g = Grid(GW, GH, GD)
    X, Y, Z = S.coords(g)
    g.prism("z", [(23, 44), (57, 44), (54, 62), (48, 69), (30, 69), (24, 62)], 42, 78, C("rust", 5))
    shell = S.last(g)
    P.plates(g, shell, "rust", 5, size=(10, 8), rivets=True, seed=6)
    P.flat(g, shell & (Y > 66), "steel", 6)
    hatch = box(g, 33, 69, 52, 47, 72, 66, "steel", 5)
    P.flat(g, edges(hatch), "iron", 4)
    for face, plane in (("+x", 57), ("-x", 23)):
        pnglyph.icon(g, face, plane, 48, 49, "skull", "bone", 5)
    return g


def barrel() -> Grid:
    """The thick gun barrel, its own part so it can kick back on `attack`."""
    g = Grid(GW, GH, GD)
    X, Y, Z = S.coords(g)
    S.disc(g, "z", CX, 57, 3.2, 10, 48, "steel", 6, n=8)
    S.disc(g, "z", CX, 57, 4.2, 7, 11, "iron", 6, n=8)
    P.flat(g, (g.a > 0) & (Z < 15), "steel", 6)
    P.flat(g, (g.a > 0) & (Z < 8) & (np.hypot(X - CX, Y - 57) < 2.8), "iron", 1)
    return g


def rx(deg: float) -> np.ndarray:
    a = np.radians(deg)
    return np.array([[1, 0, 0], [0, np.cos(a), -np.sin(a)], [0, np.sin(a), np.cos(a)]])


def recoil(body_joint, wheels):
    """The hull rocks back on its rear road wheel when the gun fires: nose up
    (+x rotation lifts the -Z front), a slide back (+Z), then it drops
    forward past rest onto its front wheel and settles. The rocking edge
    (the rear wheel's floor contact nose-up, the front one nose-down) stays
    on the floor, and the wheels ride with the hull so nothing separates."""
    #        seconds  nose-up deg  slide back (voxels)
    # (Level keys where the rocking edge swaps, so the hull never lifts.)
    poses = [(0.0, 0.0, 0.0), (0.067, 4.0, 1.8), (0.133, 5.5, 2.2), (0.233, 3.0, 1.2), (0.3, 0.0, 0.5),
             (0.367, -1.6, 0.0), (0.467, 0.0, 0.0), (0.533, 0.5, 0.0), (0.667, 0.0, 0.0), (0.8, 0.0, 0.0)]
    bj = np.array(body_joint, dtype=float)
    zs = [c[2] for _wg, c in wheels]
    rear = np.array((bj[0], 0.0, max(zs)), dtype=float) - bj
    front = np.array((bj[0], 0.0, min(zs)), dtype=float) - bj
    body_rot, body_loc = [], []
    wheel_loc = [[] for _ in wheels]
    for t, deg, slide in poses:
        r = rx(deg)
        hp = rear if deg >= 0 else front
        loc = hp - r @ hp + np.array([0.0, 0.0, slide])
        body_rot.append((t, (deg, 0.0, 0.0)))
        body_loc.append((t, tuple(float(v) for v in loc)))
        for i, (_wg, c) in enumerate(wheels):
            cp = np.array(c, dtype=float) - bj
            wheel_loc[i].append((t, tuple(float(v) for v in r @ cp + loc - cp)))
    keys = {"body": {"rot": body_rot, "loc": body_loc}}
    for i, wl in enumerate(wheel_loc):
        keys[f"wheel-{i}"] = {"loc": wl}
    return keys


def build() -> Asset:
    body = hull()
    wheels = [wheel_grid(body.shape, x0, x0 + 8, z, 8, rim=("steel", 5), hub=("gold", 5), spokes=6,
                         tyre=("gray", 3), spoke=("steel", 5))
              for x0 in (5, 67) for z in (26, 48, 70, 92)]
    joint = (CX, 51.0, 60.0)
    turret_grid = turret()
    rotate = [(0.0, (0.0, 0.0, 0.0)), (1.2, (0.0, 4.0, 0.0)), (2.4, (0.0, 0.0, 0.0))]
    root, clips, sockets = rig("scrap-tank", body, wheels, (58, 38, 102), spin_s=1.0,
                               extra_sockets=[("socket-track-dust", (8, 7, 105))],
                               body_parts=[("turret", turret_grid, joint, (0.0, 0.0, 0.0),
                                            {"rot": rotate}, {"rot": rotate})], bounce=0.2)
    turret_part = next(p for p in root.walk() if p.name == "turret")
    part(turret_part, "barrel", barrel(), (CX, 57.0, 48.0))
    sockets.append(Socket("socket-gun-muzzle", at=tuple(point - root.pivot[i] for i, point in enumerate((CX, 57.0, 7.0))), parent="barrel"))
    # Fire: the barrel slams back in 2 frames, holds, then runs out again;
    # the turret kicks muzzle-up; the hull rocks back hard and settles.
    body_joint = next(p for p in root.walk() if p.name == "body").pivot
    attack = recoil(body_joint, wheels)
    attack["barrel"] = {"loc": [(0.0, (0.0, 0.0, 0.0)), (0.067, (0.0, 0.0, 7.0)), (0.167, (0.0, 0.0, 6.5)),
                                (0.5, (0.0, 0.0, 0.0)), (0.8, (0.0, 0.0, 0.0))]}
    attack["turret"] = {"rot": [(0.0, (0.0, 0.0, 0.0)), (0.067, (3.0, 0.0, 0.0)), (0.267, (-0.6, 0.0, 0.0)),
                                (0.433, (0.0, 0.0, 0.0)), (0.8, (0.0, 0.0, 0.0))]}
    clips.append(Clip("attack", attack, loop=False, ease=0))
    return Asset(id="apocalypse-vehicles-scrap-tank", pack="apocalypse", category="vehicles", name="Scrap Tank",
                 root=root, clips=clips, sockets=sockets,
                 pfx=[{"effectId": "rvx-apocalypse-engine-smoke", "socket": "socket-exhaust", "trigger": "clip:move", "size": 28},
                      {"effectId": "rvx-apocalypse-dust-kick", "socket": "socket-track-dust", "trigger": "clip:move", "size": 28},
                      {"effectId": "rvx-apocalypse-shotgun-blast", "socket": "socket-gun-muzzle", "trigger": "clip:attack", "size": 32, "aim": [0.0, 0.0, -1.0]}])
