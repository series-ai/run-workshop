"""Second-run fantasy model builders.

Each public builder has one subject in the model spec table. The shared
geometry helpers keep voxel size, paint scale, and ground contact consistent.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

import paint as P
import pnshapes as S
from _life import asset, boulder, coords, crystal, facet_paint, foliage, front, fur, grass, keys, leaf_block, ngon, pfx, plan, rig, side, trunk
from _props import coords as prop_coords
from pnkit import box, edges, pennant, posts, window
from voxgrid import C, Clip, Grid, Part, Socket, turn, sway


@dataclass(frozen=True)
class AnimatedSpec:
    name: str
    scale: str
    kind: str
    accent: str
    effect: str | None
    effect_size: int


ANIMATED: dict[str, AnimatedSpec] = {
    "enchanted-anvil": AnimatedSpec("Enchanted Anvil", "person-size", "anvil", "cyan", "rvx-fantasy-metal-clang", 14),
    "alchemy-still": AnimatedSpec("Alchemy Still", "person-size", "still", "magenta", "rvx-fantasy-potion-fizz", 18),
    "quintain": AnimatedSpec("Tournament Quintain", "person-size", "quintain", "red", "rvx-fantasy-metal-clang", 12),
    "magic-fountain": AnimatedSpec("Wishing Fountain", "person-size", "fountain", "sky", "rvx-fantasy-waterfall-mist", 14),
    "spinning-wheel": AnimatedSpec("Spinning Wheel", "person-size", "wheel", "red", None, 0),
    "enchanted-harp": AnimatedSpec("Enchanted Harp", "tall-prop", "harp", "gold", "rvx-fantasy-bell-toll", 14),
    "trebuchet": AnimatedSpec("Field Trebuchet", "tall-prop", "trebuchet", "red", "rvx-fantasy-bow-release", 18),
    "weather-vane": AnimatedSpec("Weather Vane", "tall-prop", "vane", "blue", "rvx-fantasy-leaf-fall", 10),
    "oracle-hourglass": AnimatedSpec("Oracle Hourglass", "person-size", "hourglass", "magenta", "rvx-fantasy-fairy-motes", 14),
    "arcane-orrery": AnimatedSpec("Arcane Orrery", "person-size", "orrery", "cyan", "rvx-fantasy-arcane-orbit", 16),
}


def _base(g: Grid, x0: int, x1: int, z0: int, z1: int, top: int = 4) -> np.ndarray:
    """Build a low, framed stone pad with clear courses."""
    g.prism("y", [(x0 + 3, z0), (x1 - 3, z0), (x1, z0 + 3), (x1, z1 - 3),
                   (x1 - 3, z1), (x0 + 3, z1), (x0, z1 - 3), (x0, z0 + 3)],
            0, top, C("stone", 5),
            top=[(x0 + 4, z0 + 1), (x1 - 4, z0 + 1), (x1 - 1, z0 + 4), (x1 - 1, z1 - 4),
                 (x1 - 4, z1 - 1), (x0 + 4, z1 - 1), (x0 + 1, z1 - 4), (x0 + 1, z0 + 4)])
    m = S.last(g)
    P.stone(g, m, "stone", 5, block=(6, 3), cracks=0.02, seed=x0 + z0)
    P.flat(g, edges(m), "stone", 2)
    P.flat(g, m & (np.indices(g.shape)[1] == top - 1), "stone", 6)
    return m


def _planked(g: Grid, bounds, ramp="wood", base=5, across="x", width=3, seed=0):
    x0, y0, z0, x1, y1, z1 = bounds
    m = box(g, x0, y0, z0, x1, y1, z1, ramp, base)
    P.planks(g, m, ramp, base, width=width, across=across, nails=True, seed=seed)
    P.flat(g, edges(m), "darkwood", 2)
    return m


def _metal(g: Grid, bounds, base=4, edge=True):
    x0, y0, z0, x1, y1, z1 = bounds
    m = box(g, x0, y0, z0, x1, y1, z1, "iron", base)
    P.plates(g, m, "iron", base, seed=x0 + y0 + z0)
    if edge:
        P.flat(g, edges(m), "gray", 2)
    return m


def _loop_clip(name: str, node: str, axis: str, seconds: float, rate: float) -> Clip:
    return Clip(name, {node: {"rot": turn(seconds, axis, rate)}})


def _animated_parts(slug: str):
    """Return subject-specific grids, clips, and a socket point in one frame."""
    spec = ANIMATED[slug]
    g = Grid(64, 100, 64)
    moving = Grid(64, 100, 64)
    fx_point = (32.0, 30.0, 22.0)
    clips: list[Clip] = []
    hinge = (32.0, 4.0, 32.0)
    node = "moving"
    if spec.kind == "anvil":
        _base(g, 15, 49, 18, 46, 5)
        _planked(g, (25, 5, 25, 39, 13, 39), "wood", 4, "y", 4, 2)
        # A tapered waist carries a bright work face, a horn and a square heel.
        front(g, [(25,13),(39,13),(36,19),(37,23),(27,23),(28,19)], 26,38,"iron",5)
        top = front(g, [(17,23),(43,23),(47,25),(44,28),(21,28)], 24,40,"iron",6)
        P.plates(g,top,"iron",6,seed=3)
        front(g, [(43,24),(55,26),(44,28)], 28,36,"steel",6)
        _metal(g, (17,24,26,24,28,38),6)
        P.flat(g, top & (np.indices(g.shape)[1]==27),"steel",7)
        for x in (27,32,37):
            box(g,x,24,23,x+2,26,24,"cyan",6)
        P.flat(g, (g.a > 0) & (np.indices(g.shape)[1] == 28) & (np.indices(g.shape)[0] >= 18), "steel", 6)
        _planked(moving, (30, 31, 30, 34, 45, 33), "wood", 5, "y", 3, 5)
        _metal(moving, (27, 43, 27, 37, 48, 36), 6)
        P.flat(moving, (moving.a > 0) & (np.indices(moving.shape)[1] >= 46), "steel", 6)
        hinge = (32.0, 31.0, 30.0)
        fx_point = (32.0, 25.0, 22.0)
        clips = [Clip("idle", {"moving": {"rot": sway(2.4, amp=(0, 0, 1.5))}}),
                 Clip("active", {"moving": {"rot": keys((0, 0, 0, 0), (.22, 80, 0, 0), (.38, -18, 0, 0), (.58, 0, 0, 0))}}, loop=False)]
    elif spec.kind == "still":
        _base(g, 15, 49, 18, 46, 5)
        _planked(g, (19, 5, 21, 45, 12, 43), "darkwood", 4, "x", 4, 6)
        posts(g, 20, 44, 22, 42, 12, 31, size=3, base=4)
        # A heated boiler, a bent brass pipe and a separate receiving bottle.
        _metal(g, (23, 14, 22, 41, 20, 42), 4)
        S.disc(g, "y", 32, 32, 10, 18, 31, "iron", 5, n=10)
        P.flat(g, (g.a > 0) & (np.indices(g.shape)[1] >= 28) & (S.radial(g, "y", 32, 32) < 8), "magenta", 5)
        P.flat(g, (g.a > 0) & (np.indices(g.shape)[1] >= 29) & (S.radial(g, "y", 32, 32) < 5), "magenta", 7)
        S.disc(g, "y", 32, 32, 9, 30, 34, "gold", 5, n=10)
        S.disc(g, "y", 32, 32, 7, 33, 36, "iron", 5, n=10)
        # Fire box and broad vent bands anchor the vessel on its heat source.
        box(g, 25, 12, 25, 39, 19, 39, "darkwood", 4)
        P.flat(g, (g.a > 0) & (np.indices(g.shape)[1] == 18) & (np.indices(g.shape)[2] < 30), "orange", 6)
        for z in (27, 33, 39):
            g.box(24, 13, z, 40, 15, z + 1, C("rust", 4))
        # Gauge on the boiler front, a visible dial and a brass rim.
        S.disc(g, "z", 32, 25, 4, 20, 23, "gold", 5, n=8)
        S.disc(g, "z", 32, 25, 2.5, 19, 22, "bone", 6, n=8)
        g.box(31, 24, 19, 33, 26, 21, C("red", 5))
        # Neck and bent pipe connect the boiler to a small condenser flask.
        S.disc(g, "y", 32, 32, 3, 35, 42, "gold", 5, n=8)
        S.bar(g, "z", (32, 42), (42, 42), 1.25, 30, 34, "gold", 5)
        S.bar(g, "x", (42, 32), (35, 32), 1.25, 39, 44, "gold", 5)
        S.disc(g, "y", 42, 32, 5, 31, 37, "cyan", 5, n=8)
        vial = S.disc(g, "y", 42, 32, 4, 33, 39, "cyan", 5, n=8)
        P.flat(g, vial & (np.indices(g.shape)[1] >= 34), "magenta", 6)
        P.flat(g, vial & (np.indices(g.shape)[1] == 36), "magenta", 7)
        S.disc(g, "y", 42, 32, 2.4, 39, 42, "gold", 5, n=8)
        g.box(40, 27, 30, 44, 29, 34, C("gold", 5))
        # A short condenser brace and an animated stopcock complete the mechanism.
        S.bar(g, "x", (25, 24), (37, 27), 1.4, 20, 23, "wood", 5)
        _metal(moving, (30, 37, 30, 34, 46, 34), 5)
        moving.box(28, 44, 28, 36, 47, 36, C("gold", 5))
        hinge = (32.0, 31.0, 32.0)
        fx_point = (32.0, 51.0, 32.0)
        clips = [Clip("idle", {"moving": {"rot": sway(2.4, amp=(0, 0, 3))}}),
                 Clip("active", {"moving": {"rot": sway(1.2, amp=(0, 0, 14))}})]
    elif spec.kind == "quintain":
        _base(g, 20, 44, 20, 44, 4)
        _planked(g, (29, 4, 29, 35, 47, 35), "wood", 5, "y", 3, 8)
        g.box(27, 45, 27, 37, 49, 37, C("iron", 4))
        # The bar, target and counterweight share one rotating axle.
        _planked(moving, (20, 46, 31, 44, 49, 33), "darkwood", 5, "x", 3, 9)
        target = S.disc(moving, "z", 25, 41, 9, 27, 30, "red", 5, n=10)
        radius = S.radial(moving, "z", 25, 41)
        P.flat(moving, target & (radius < 6.4), "bone", 6)
        P.flat(moving, target & (radius < 4.0), "blue", 5)
        P.flat(moving, target & (radius < 1.8), "gold", 7)
        moving.box(39, 44, 30, 44, 48, 36, C("iron", 5))
        hinge = (32.0, 48.0, 32.0)
        fx_point = (32.0, 42.0, 23.0)
        clips = [Clip("idle", {"moving": {"rot": sway(2.2, amp=(0, 0, 3))}}),
                 Clip("attack", {"moving": {"rot": keys((0, 0, 0, 0), (.15, 0, 0, -68), (.28, 0, 0, -68), (.62, 0, 0, 0))}}, loop=False)]
    elif spec.kind == "fountain":
        _base(g, 12, 52, 12, 52, 5)
        S.disc(g,"y",32,32,18,5,7,"stone",5,n=10)
        outer,inner=S.flat_ngon(32,32,18,10),S.flat_ngon(32,32,15,10)
        basin=np.zeros(g.shape,dtype=bool)
        for k in range(10):
            basin |= plan(g,[outer[k],outer[(k+1)%10],inner[(k+1)%10],inner[k]],7,16,"stone",5)
        P.stone(g, basin, "stone", 5, block=(4, 3), cracks=0.01, seed=11)
        water = S.disc(g, "y", 32, 32, 15, 7, 12, "sky", 5, n=10)
        P.flat(g,water & (np.floor(S.radial(g,"y",32,32))%4==0),"cyan",6)
        P.flat(g, water & (S.radial(g, "y", 32, 32) < 7), "cyan", 6)
        P.flat(g, basin & (np.indices(g.shape)[1] >= 14) & (S.radial(g, "y", 32, 32) > 14.5), "gold", 5)
        S.disc(g, "y", 32, 32, 9, 29, 32, "stone", 5, n=10)
        S.disc(g, "y", 32, 32, 7, 32, 35, "gold", 5, n=10)
        S.disc(g, "y", 32, 32, 5, 34, 36, "sky", 6, n=10)
        _metal(g, (29, 15, 29, 35, 29, 35), 5)
        # Four sloped water streams connect the high bowl to the lower basin.
        for z0,z1 in ((18,25),(46,39)):
            stream=S.bar(g,"x",(12,z0),(33,z1),1.8,30,34,"sky",6)
            P.flat(g,stream & (np.indices(g.shape)[0]==31),"bone",7)
        for x0,x1 in ((18,25),(46,39)):
            stream=S.bar(g,"z",(x0,12),(x1,33),1.8,30,34,"sky",6)
            P.flat(g,stream & (np.indices(g.shape)[2]==31),"bone",7)
        for x, z in ((28, 31), (34, 31), (31, 28), (31, 34)):
            moving.box(x, 35, z, x + 2, 39, z + 2, C("sky", 7))
        hinge = (32.0, 20.0, 32.0)
        fx_point = (32.0, 21.0, 32.0)
        clips = [Clip("idle", {"water": {"loc": sway(2.0, amp=(0, 1, 0))}}),
                 Clip("active", {"water": {"loc": sway(1.0, amp=(0, 2.5, 0)), "rot": sway(1.0, amp=(0, 2, 0))}})]
        node = "water"
    elif spec.kind == "wheel":
        _base(g, 11, 53, 15, 49, 5)
        # Rear A-frame supports leave the large front-facing wheel in clear view.
        for z in (36, 42):
            S.bar(g, "z", (19, 9), (28, 42), 2.4, z, z + 3, "wood", 5)
            S.bar(g, "z", (45, 9), (36, 42), 2.4, z, z + 3, "wood", 5)
        _planked(g, (18, 5, 38, 46, 9, 44), "darkwood", 4, "x", 3, 12)
        # A small spindle, bobbin and tension belt make this a wool wheel.
        S.bar(g, "z", (43, 34), (48, 42), 1.4, 21, 24, "wood", 5)
        S.disc(g, "z", 49, 43, 2.5, 20, 24, "gold", 5, n=8)
        S.bar(g, "z", (40, 38), (48, 42), 1.0, 19, 21, "red", 4)
        box(g,41,32,23,45,36,28,"wood",5)
        _planked(g,(26,40,36,38,43,45),"darkwood",4,"x",3,11)
        # The wheel is a true face-on flywheel with broad rim, eight spokes and a hub.
        S.wheel(moving,"z",32,15,14,25,28,n=12,spokes=8,gaps=True,rim=("gold",5),spoke=("wood",6),tyre=("darkwood",4))
        outer = S.radial(moving, "z", 32, 29)
        P.flat(moving, (moving.a > 0) & (outer >= 11.5), "gold", 5)
        for k in range(8):
            a = math.tau * k / 8
            S.bar(moving, "z", (32 + math.cos(a) * 3, 29 + math.sin(a) * 3),
                  (32 + math.cos(a) * 12, 29 + math.sin(a) * 12), 1.7, 24, 29, "wood", 6)
        S.disc(moving, "z", 32, 29, 4.5, 23, 29, "iron", 5, n=10)
        P.flat(moving, (moving.a > 0) & (outer < 2.4), "gold", 6)
        _planked(g,(28,5,18,36,7,29),"darkwood",4,"x",3,20)
        _planked(g, (28, 7, 18, 36, 10, 27), "wood", 5, "x", 3, 20)
        S.bar(g,"z",(34,10),(44,24),2,25,28,"iron",5)
        S.bar(g,"z",(44,24),(40,29),2,25,28,"iron",5)
        S.bar(g,"z",(32,29),(32,41),2,27,40,"iron",5)
        hinge = (32.0, 29.0, 25.0)
        fx_point = (32.0, 41.0, 37.0)
        clips = [_loop_clip("idle", "wheel", "z", 6.0, 60),
                 _loop_clip("spin", "wheel", "z", 2.0, 180)]
        node = "wheel"
    elif spec.kind == "harp":
        _base(g, 13, 51, 16, 48, 4)
        _planked(g, (23, 4, 33, 41, 13, 38), "darkwood", 4, "x", 3, 13)
        # Separate rails form a triangular harp silhouette around a clear string field.
        S.bar(g, "z", (22, 11), (28, 44), 3.2, 26, 34, "gold", 5)
        S.bar(g, "z", (28, 44), (40, 50), 3.0, 26, 34, "gold", 5)
        S.bar(g, "z", (40, 50), (42, 14), 3.0, 26, 34, "gold", 5)
        sound = box(g, 23, 7, 24, 43, 17, 34, "wood", 5)
        P.planks(g, sound, "wood", 5, width=3, across="y", seed=14)
        P.flat(g, edges(sound), "darkwood", 3)
        for i in range(8):
            x=27+i*1.7
            S.bar(moving,"z",(x,15),(x,44+(x-28)*.5),1.1,27,28,"gold",6)
        for x in (27,32,37):
            S.disc(g,"z",x,11,1.4,23,25,"darkwood",3,n=6)
        hinge = (32.0, 31.0, 24.0)
        fx_point = (32.0, 44.0, 24.0)
        clips = [Clip("idle", {"strings": {"rot": sway(2.0, amp=(0, 0, .15))}}),
                 Clip("active", {"strings": {"rot": sway(0.9, amp=(0, 0, .4))}})]
        node = "strings"
    elif spec.kind == "trebuchet":
        _base(g, 13, 51, 20, 48, 5)
        # Wheeled bed, two triangular side frames, and a long throwing arm.
        for x in (17, 43):
            for z in (22, 43):
                S.disc(g, "x", 14, z, 5, x, x + 3, "wood", 4, n=10)
        _planked(g, (17, 8, 23, 47, 14, 45), "darkwood", 4, "y", 3, 15)
        for x in (20, 41):
            S.bar(g, "x", (14, 26), (40, 33), 2.7, x, x + 4, "wood", 5)
            S.bar(g, "x", (14, 39), (40, 33), 2.7, x, x + 4, "wood", 5)
        S.bar(g, "x", (33, 26), (33, 40), 2.4, 20, 45, "wood", 5)
        S.bar(moving, "x", (25, 31), (62, 39), 3.0, 29, 35, "wood", 5)
        S.bar(moving, "x", (22, 29), (27, 31), 2.2, 29, 35, "wood", 4)
        # Rope sling and a stone shot sit beyond the tall end of the arm.
        S.bar(moving, "x", (61, 39), (54, 48), 1.1, 30, 34, "sand", 6)
        S.bar(moving, "x", (61, 39), (53, 48), 1.1, 30, 34, "sand", 6)
        S.disc(moving, "x", 52, 47, 4.4, 29, 35, "stone", 5, n=8)
        S.disc(g,"x",33,33,4,18,47,"iron",5,n=8)
        _planked(moving,(25,17,25,39,27,33),"wood",5,"y",3,17)
        P.flat(moving,(moving.a>0)&(np.indices(moving.shape)[1]==19),"iron",5)
        hinge = (32.0, 33.0, 33.0)
        fx_point = (32.0, 55.0, 47.0)
        clips = [Clip("idle", {"arm": {"rot": sway(2.4, amp=(0, 0, 2))}}),
                 Clip("attack", {"arm": {"rot": keys((0, 0, 0, 0), (.18, -52, 0, 0), (.34, -65, 0, 0), (.7, 0, 0, 0))}}, loop=False)]
        node = "arm"
    elif spec.kind == "vane":
        _base(g, 24, 40, 24, 40, 4)
        _planked(g, (28, 4, 28, 36, 72, 36), "darkwood", 4, "y", 4, 16)
        _metal(g, (25, 72, 25, 39, 76, 39), 4)
        # Compass cross and a broad dragon-arrow on a rotating spindle.
        moving.box(27, 74, 31, 37, 76, 33, C("gold", 6))
        moving.box(31, 73, 27, 33, 77, 37, C("gold", 6))
        moving.prism("z", [(22, 76), (40, 76), (51, 82), (39, 85), (40, 79), (24, 79)], 29, 35, C("blue", 5))
        wing = S.last(moving)
        P.flat(moving, wing & (np.indices(moving.shape)[2] < 30), "gold", 6)
        S.disc(moving, "y", 32, 32, 3.2, 75, 79, "iron", 5, n=8)
        hinge = (32.0, 75.0, 32.0)
        fx_point = (32.0, 82.0, 32.0)
        clips = [_loop_clip("idle", "vane", "y", 6.0, 60), _loop_clip("spin", "vane", "y", 2.0, 180)]
        node = "vane"
    elif spec.kind == "hourglass":
        _base(g, 17, 47, 20, 44, 4)
        for x in (22, 41):
            _metal(moving, (x, 4, 27, x + 3, 8, 37), 5)
            _metal(moving, (x, 45, 27, x + 3, 49, 37), 5)
        for z in (27, 35):
            _planked(moving, (22, 5, z, 44, 9, z + 3), "gold", 5, "x", 3, 17)
            _planked(moving, (22, 44, z, 44, 48, z + 3), "gold", 5, "x", 3, 18)
        for x in (22,41):
            for z in (27,35):
                _planked(moving,(x,8,z,x+3,45,z+3),"gold",5,"y",3,21)
        glass=plan(moving,S.flat_ngon(32,32,8,8),10,26,"cyan",5,top=S.flat_ngon(32,32,1.5,8))
        glass|=plan(moving,S.flat_ngon(32,32,1.5,8),26,44,"cyan",5,top=S.flat_ngon(32,32,8,8))
        XX,YY,ZZ=coords(moving)
        P.flat(moving,glass & (YY<17),"sand",6)
        P.flat(moving,glass & (YY>35) & (np.abs(XX-32)<(44-YY)*.5),"sand",6)
        P.flat(moving,glass & (np.abs(XX-32)<.8),"bone",7)
        P.flat(moving,glass & (np.abs(XX-32)<.8) & (YY<27),"gold",7)
        for x in (24,40):
            _planked(g,(x,4,19,x+3,29,23),"darkwood",4,"y",3,x)
        _planked(g,(24,25,19,43,29,23),"gold",5,"x",3,22)
        S.disc(g,"z",32,27,2,22,35,"iron",5,n=8)
        hinge = (32.0, 27.0, 32.0)
        fx_point = (32.0, 29.0, 32.0)
        clips = [Clip("idle", {"glass": {"rot": sway(2.4, amp=(0, 0, 2))}}),
                 Clip("open", {"glass": {"rot": keys((0, 0, 0, 0), (.5, 0, 0, 90), (1.0, 0, 0, 180))}}, loop=False),
                 Clip("close", {"glass": {"rot": keys((0, 0, 0, 180), (.5, 0, 0, 90), (1.0, 0, 0, 0))}}, loop=False)]
        node = "glass"
    elif spec.kind == "orrery":
        _base(g, 13, 51, 15, 49, 5)
        _planked(g, (25, 5, 25, 39, 16, 39), "darkwood", 4, "x", 3, 19)
        posts(g, 29, 35, 32, 38, 16, 39, size=3, base=4)
        S.disc(g, "z", 32, 34, 3.5, 29, 32, "gold", 6, n=10)
        # A visible front-facing orbit ring circles the central sun and planet.
        ring_r = 13.0
        for k in range(12):
            a0, a1 = math.tau * k / 12, math.tau * (k + 1) / 12
            p0 = (32 + math.cos(a0) * ring_r, 34 + math.sin(a0) * ring_r)
            p1 = (32 + math.cos(a1) * ring_r, 34 + math.sin(a1) * ring_r)
            S.bar(moving, "z", p0, p1, 1.4, 26, 28, "gold", 5)
        S.bar(moving, "z", (32, 34), (44, 34), 1.5, 25, 29, "gold", 5)
        S.disc(moving, "z", 32, 34, 4.5, 24, 29, "cyan", 6, n=8)
        S.disc(moving, "z", 44, 34, 3.4, 24, 29, "blue", 5, n=8)
        for radius,z,tilt,ramp in ((10,32,4,"gold"),(15,36,-3,"gold")):
            for k in range(12):
                a,b=math.tau*k/12,math.tau*(k+1)/12
                S.bar(g,"z",(32+math.cos(a)*radius,34+math.sin(a)*radius+tilt),(32+math.cos(b)*radius,34+math.sin(b)*radius+tilt),1.2,z,z+1.5,ramp,5)
        S.bar(g,"z",(22,25),(42,25),2,26,38,"gold",5)
        for x,y,r,ramp in ((24,41,2.3,"red"),(40,27,2,"magenta"),(32,47,1.8,"gold")):
            S.disc(g,"z",x,y,r,31,35,ramp,6,n=8)
        dial=S.disc(g,"y",32,32,12,14,17,"gold",5,n=12)
        XX,YY,ZZ=coords(g)
        P.flat(g,dial & ((np.floor(np.arctan2(ZZ-32,XX-32)*6)%3)==0),"darkwood",4)
        hinge = (32.0, 34.0, 27.0)
        fx_point = (32.0, 48.0, 32.0)
        clips = [_loop_clip("idle", "orrery", "z", 6.0, 60), _loop_clip("active", "orrery", "z", 2.0, 180)]
        node = "orrery"
    parts = [("base", g, None, None), (node, moving, hinge, None)]
    root, to_root = rig(parts)
    sockets = [Socket("socket-function", at=to_root(fx_point), parent=node)]
    trigger = {"anvil": "clip:active", "still": "clip:active", "quintain": "clip:attack",
               "fountain": "idle", "harp": "clip:active", "trebuchet": "clip:attack",
               "vane": "clip:spin"}.get(spec.kind, "idle")
    effects = [] if spec.effect is None else [pfx(spec.effect, "socket-function", trigger, size=spec.effect_size,
                                                       at=.35 if spec.kind in ("anvil", "quintain", "trebuchet") else None)]
    return root, clips, sockets, effects


def build_animated(slug: str):
    spec = ANIMATED[slug]
    root, clips, sockets, effects = _animated_parts(slug)
    return asset("animated-props", slug, spec.name, root, clips=clips, sockets=sockets, fx=effects)


BUILDINGS = {
    "mage-academy": ("Mage Academy", "bone", "blue", "arcane-orbit"),
    "stables": ("Royal Stables", "bone", "red", "lantern-glow"),
    "market-hall": ("Market Hall", "bone", "red", "bell-toll"),
    "mine-entrance": ("Dwarf Mine Entrance", "stone", "darkwood", "torch-flame"),
    "guard-barracks": ("Guard Barracks", "stone", "red", "torch-flame"),
    "alchemist-shop": ("Alchemist Shop", "bone", "blue", "potion-fizz"),
    "thatched-cottage": ("Thatched Cottage", "bone", "sand", "hearth-fire"),
    "moon-temple": ("Moon Temple", "stone", "blue", "arcane-orbit"),
    "granary": ("Village Granary", "wood", "red", "bee-swarm"),
}


TERRAINS = {
    "lily-pond": "Lily Pond",
    "flower-meadow": "Flower Meadow",
    "birch-grove": "Birch Grove",
    "mossy-boulder": "Mossy Boulder",
    "cliff-ledge": "Cliff Ledge",
    "berry-bush": "Berry Bush",
    "hollow-log": "Hollow Log",
    "crystal-cave-mouth": "Crystal Cave Mouth",
    "hedge-maze-corner": "Hedge Maze Corner",
}


CREATURES = {
    "harpy": ("Harpy", "humanoid", "orange", "slash-arc"),
    "phoenix": ("Phoenix", "creature-large", "red", "dragon-breath"),
    "minotaur": ("Minotaur", "humanoid", "wood", "slash-arc"),
    "cyclops": ("Cyclops", "humanoid", "moss", "dust-slam"),
    "basilisk": ("Basilisk", "creature-large", "forest", "holy-smite"),
    "centaur": ("Centaur", "creature-large", "wood", "bow-release"),
    "owlbear": ("Owlbear", "creature-large", "wood", "dust-slam"),
}


VEHICLES = {
    "hay-cart": ("Hay Cart", "vehicle", "lantern-glow"),
    "war-chariot": ("War Chariot", "vehicle", "metal-clang"),
    "mine-cart": ("Mine Cart", "vehicle-small", "torch-flame"),
    "flying-carpet": ("Flying Carpet", "vehicle-small", "fairy-motes"),
    "battering-ram": ("Battering Ram", "vehicle-large", "dust-slam"),
}


def _terrain_grid(slug: str) -> Grid:
    from _scenery import terrain
    return terrain(slug)


def build_terrain(slug: str):
    if slug not in TERRAINS:
        raise KeyError(slug)
    g = _terrain_grid(slug)
    root = Part(slug, g)
    effect = {
        "lily-pond": ("fairy-motes", (32, 12, 32), 16),
        "flower-meadow": ("bee-swarm", (32, 17, 32), 18),
        "birch-grove": ("leaf-fall", (32, 39, 32), 18),
        "cliff-ledge": ("waterfall-mist", (43, 14, 10), 14),
        "berry-bush": ("bee-swarm", (34, 24, 30), 12),
        "crystal-cave-mouth": ("arcane-orbit", (32, 35, 20), 16),
        "hedge-maze-corner": ("leaf-fall", (29, 30, 22), 14),
    }.get(slug)
    sockets, fx = [], []
    if effect:
        e, at, size = effect
        sockets = [Socket("socket-function", at=at)]
        fx = [pfx(f"rvx-fantasy-{e}", "socket-function", "idle", size=size)]
    return asset("terrain-nature", slug, TERRAINS[slug], root, sockets=sockets, fx=fx)


def _paint_building(g: Grid, wall, ramp: str, seed: int):
    P.mottle(g, wall, ramp, 5, cell=5, seed=seed)
    P.flat(g, edges(wall), "darkwood", 3)


def _building_grid(slug: str) -> tuple[Grid, tuple[int, int, int]]:
    width, height, depth = (96, 112, 96) if slug == "moon-temple" else (96, 100, 96)
    g = Grid(width, height, depth)
    X, Y, Z = coords(g)
    name, wall_ramp, roof_ramp, _effect = BUILDINGS[slug]
    if slug == "moon-temple":
        _base(g, 18, 78, 18, 78, 6)
        # A high stone sanctuary with a ring roof, clear entrance and moon crest.
        walls = box(g, 24, 6, 24, 72, 70, 72, "stone", 5)
        _paint_building(g, walls, "stone", 44)
        for x in (22, 70):
            for z in (22, 70):
                S.disc(g, "y", x, z, 5, 6, 75, "stone", 5, n=8)
                P.flat(g, (g.a > 0) & (np.abs(X - x) < 5) & (np.abs(Z - z) < 5) & (Y % 12 < 2), "blue", 5)
        # Wide steps and a dark doorway make the temple function legible.
        for y, z0, z1 in ((1, 10, 22), (3, 14, 24), (5, 18, 26)):
            box(g, 35, y, z0, 61, y + 2, z1, "stone", 5)
        box(g, 40, 6, 20, 56, 42, 25, "darkwood", 4)
        box(g, 42, 8, 19, 54, 40, 22, "blue", 2)
        P.flat(g, (g.a > 0) & (X >= 42) & (X < 54) & (Y % 8 < 1) & (Z < 23), "gold", 5)
        for x in (28, 66):
            S.disc(g, "y", x, 17, 4, 6, 22, "gold", 5, n=8)
            S.disc(g, "y", x, 17, 2.4, 20, 24, "cyan", 6, n=8)
        # The cyan crescent is the oversized function emblem above the door.
        S.disc(g, "z", 48, 54, 13, 20, 24, "cyan", 6, n=10)
        S.disc(g, "z", 54, 58, 12, 19, 23, "stone", 4, n=10)
        box(g, 46, 52, 19, 50, 56, 20, "gold", 6)
        S.disc(g, "y", 48, 48, 29, 69, 76, "blue", 5, n=12)
        S.disc(g, "y", 48, 48, 24, 76, 82, "blue", 4, n=12)
        S.disc(g, "y", 48, 48, 8, 81, 87, "gold", 6, n=10)
        for y in (12,43,65):
            box(g,23,y,23,73,y+3,73,"stone",6)
        for z in (35,53):
            for x in (22,72):
                box(g,x,25,z,x+2,57,z+11,"gold",5)
                pane=box(g,x-1 if x==22 else x+1,28,z+2,x+1 if x==22 else x+3,54,z+9,"blue",5)
                P.flat(g,pane & ((Y.astype(int)%8==0)|((Z-z).astype(int)==5)),"cyan",6)
        for x in (32,54):
            box(g,x,25,72,x+10,57,74,"gold",5)
            box(g,x+2,28,73,x+8,54,75,"blue",5)
        S.cone(g,"y",48,48,22,77,99,"blue",5,n=8)
        crystal(g,48,48,96,3,6,5,"cyan",6,n=6)
        pennant(g, 22, 70, 40, 18, 12, "red", 5)
        return g, (48, 86, 48)

    if slug == "mine-entrance":
        _base(g, 10, 86, 12, 84, 5)
        boulder(g, 27, 45, 4, 17, 43, "stone", 4, n=8, seed=45, moss="moss", moss_drape=.2)
        boulder(g, 68, 45, 4, 17, 43, "stone", 4, n=8, seed=46, moss="moss", moss_drape=.2)
        boulder(g, 48, 37, 36, 27, 24, "stone", 4, n=8, seed=47, moss="moss", moss_drape=.15)
        rear=front(g,[(31,6),(65,6),(65,33),(60,40),(37,40),(31,32)],69,74,"stone",4)
        facet_paint(g,[g.solids[-1]],lambda gg,mm,fr: P.stone(gg,mm,"stone",4,block=(7,4),cracks=.06,frame=fr,seed=48))
        for x0,x1,y0,y1,z1 in ((32,49,7,17,77),(45,63,18,28,76),(36,58,30,38,76)):
            slab=front(g,[(x0,y0),(x1,y0),(x1-2,y1),(x0+2,y1)],73,z1,"stone",5)
            facet_paint(g,[g.solids[-1]],lambda gg,mm,fr: P.stone(gg,mm,"stone",5,block=(7,4),cracks=.04,frame=fr,seed=y0))
        for z in (22,43,63):
            for x in (31,61):
                _planked(g,(x,5,z,x+4,40,z+4),"darkwood",4,"y",4,x+z)
            _planked(g,(31,38,z,65,42,z+4),"wood",5,"x",4,z)
        S.bar(g,"z",(31,25),(40,40),3,21,25,"wood",5)
        S.bar(g,"z",(65,25),(56,40),3,21,25,"wood",5)
        for x in (29, 64):
            _planked(g, (x, 5, 17, x + 4, 42, 21), "wood", 4, "y", 3, x)
        S.bar(g, "x", (43, 17), (43, 67), 3.2, 28, 70, "wood", 5)
        # Mine rails lead from the dark opening to the front lip.
        for x in (40, 54):
            S.bar(g, "x", (6, 14), (6, 58), 1.8, x, x + 2, "iron", 5)
        for z in range(18, 58, 8):
            box(g, 38, 4, z, 58, 6, z + 3, "wood", 4)
        from pnshapes import lantern
        box(g,18,20,14,22,42,18,"wood",5)
        S.bar(g,"z",(20,41),(27,41),3,14,18,"wood",5)
        lantern(g,26,26,15,s=6,body=6,glass="gold",roof="red")
        # A framed timber portal, a lamp and ore crates identify the entrance.
        box(g, 27, 5, 16, 32, 49, 19, "darkwood", 4)
        box(g, 64, 5, 16, 69, 49, 19, "darkwood", 4)
        box(g, 27, 46, 16, 69, 51, 20, "wood", 5)
        for x in (15, 71):
            crate = _planked(g, (x, 5, 8, x + 10, 13, 16), "wood", 5, "y", 3, x)
            P.flat(g, crate & (Y == 8), "gold", 5)
            boulder(g, x + 6, 19, 5, 4, 6, "stone", 4, n=6, seed=x + 3, moss=None)
        return g, (20, 44, 27)

    # Six-by-six-tile footprint: low plinth, readable door, framed plaster and a true pitched roof.
    _base(g, 10, 86, 12, 84, 5)
    x0, x1, z0, z1 = 18, 78, 20, 76
    wall_top, peak = 55, 85
    walls = box(g, x0, 5, z0, x1, wall_top, z1, wall_ramp, 5)
    _paint_building(g, walls, wall_ramp, 50)
    for x in (x0, x1 - 4):
        for z in (z0, z1 - 4):
            post = _planked(g, (x, 5, z, x + 4, wall_top, z + 4), "darkwood", 4, "y", 4, x + z)
            P.flat(g, post & (Y % 16 < 2), "gold", 4)
    for y in (7,25,51):
        _planked(g,(17,y,20,20,y+3,76),"darkwood",4,"z",4,y)
        _planked(g,(76,y,20,79,y+3,76),"darkwood",4,"z",4,y+1)
        _planked(g,(18,y,74,78,y+3,78),"darkwood",4,"x",4,y+2)
    for x in (38,57):
        _planked(g,(x,5,74,x+3,55,78),"darkwood",4,"y",3,x)
    for z in (38,57):
        for x in (16,78):
            box(g,x,30,z,x+2,46,z+12,"gold",5)
            pane=box(g,x-.5 if x==16 else x+1,32,z+2,x+1 if x==16 else x+2.5,44,z+10,"sky",5)
            P.flat(g,pane & ((Y.astype(int)%7==0)|((Z-z).astype(int)==6)),"bone",6)
    for x in (25,63):
        box(g,x,31,77,x+10,46,79,"gold",5)
        pane=box(g,x+2,33,78,x+8,44,80,"sky",5)
        P.flat(g,pane & (Y.astype(int)%7==0),"bone",6)
    # Broad roof planes use true sloped prisms.
    start = len(g.solids)
    g.prism("z", [(x0 - 7, wall_top - 2), (48, peak), (48, peak - 4), (x0 - 7, wall_top - 6)], z0 - 5, z1 + 5, C(roof_ramp, 5))
    g.prism("z", [(48, peak), (x1 + 7, wall_top - 2), (x1 + 7, wall_top - 6), (48, peak - 4)], z0 - 5, z1 + 5, C(roof_ramp, 5))
    if slug=="thatched-cottage":
        facet_paint(g,g.solids[start:],lambda gg,mm,fr:P.thatch(gg,mm,"sand",5,band=5,frame=fr,seed=51))
    else:
        facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.tiles(gg, mm, roof_ramp, 5, row=5, width=7, frame=fr, seed=51))
    front(g, [(x0 + 2, wall_top - 1), (x1 - 2, wall_top - 1), (48, peak - 2)], z0 - 2, z0 + 1, wall_ramp, 5)
    # Deep door, bright border and two broad leaded windows face the approach.
    box(g, 40, 5, 17, 56, 36, 21, "darkwood", 4)
    box(g, 42, 6, 16, 54, 34, 18, "wood", 5)
    P.flat(g, (g.a > 0) & (X >= 42) & (X < 54) & (Y % 7 < 1) & (Z < 19), "darkwood", 3)
    box(g, 39, 5, 16, 42, 37, 22, "gold", 5)
    box(g, 54, 5, 16, 57, 37, 22, "gold", 5)
    for x in (25, 64):
        box(g, x, 27, 16, x + 10, 44, 20, "gold", 5)
        box(g, x + 2, 29, 15, x + 8, 42, 17, "sky", 5)
        box(g, x + 4, 29, 14, x + 6, 42, 16, "bone", 5)
        box(g, x + 2, 35, 14, x + 8, 37, 16, "bone", 5)
    # A sign and a paired pennant make the use visible at thumbnail size.
    sign = box(g, 41, 41, 16, 55, 49, 20, "darkwood", 4)
    P.flat(g, sign & (Z == 16), roof_ramp, 5)
    if slug in ("mage-academy", "alchemist-shop"):
        S.disc(g, "z", 48, 45, 5, 13, 16, "gold", 5, n=8)
        S.disc(g, "z", 48, 45, 3, 12, 15, "magenta" if slug == "alchemist-shop" else "cyan", 6, n=8)
    elif slug == "market-hall":
        g.box(45, 49, 16, 51, 53, 20, C("gold", 6))
        S.disc(g, "x", 49, 49, 4, 46, 50, "gold", 5, n=8)
    elif slug == "stables":
        for x in (23, 63):
            box(g, x, 5, 16, x + 13, 31, 20, "wood", 4)
            for y in (13, 22):
                box(g, x, y, 15, x + 13, y + 2, 17, "bone", 5)
    elif slug == "guard-barracks":
        for x in (27, 65):
            S.disc(g, "z", x, 48, 6, 14, 18, "red", 5, n=8)
            P.flat(g, (g.a > 0) & (np.abs(X - x) < 1) & (Y >= 45) & (Y <= 51) & (Z < 16), "gold", 6)
    elif slug == "thatched-cottage":
        # Extra straw eaves sit below the main thatch plane.
        thatch = box(g, 15, 55, 17, 81, 58, 79, "sand", 5)
        P.planks(g, thatch, "sand", 5, width=5, across="x", seed=56)
    elif slug == "granary":
        silo = S.disc(g, "y", 72, 49, 12, 5, 38, "wood", 5, n=10)
        P.planks(g, silo, "wood", 5, width=4, across="y", seed=59)
        S.cone(g, "y", 72, 49, 14, 37, 52, "red", 5, n=8)
        P.flat(g, (g.a > 0) & (np.abs(X - 72) < 2) & (Y > 15) & (Y < 32), "gold", 5)

    # Three grounded trade props complete the base on every village building.
    crate_xs = (13, 69)
    barrel_x = 80
    if slug in ("mage-academy", "alchemist-shop", "thatched-cottage"):
        crate_xs, barrel_x = (13, 30), 48
    elif slug == "market-hall":
        crate_xs = (13,)
    for x in crate_xs:
        crate = _planked(g, (x, 5, 7, x + 9, 13, 15), "wood", 5, "y", 3, x + 2)
        P.flat(g, crate & (Y == 11), "gold", 5)
    barrel = S.disc(g, "y", barrel_x, 9, 5.5, 5, 18, "darkwood", 5, n=8)
    P.flat(g, barrel & (Y > 9) & (Y < 14), "gold", 5)

    # A small pennant adds a raised, moving silhouette above the roof line.
    pennant(g, 13, wall_top - 2, 31, 27, 14, "red" if slug not in ("mage-academy", "alchemist-shop") else "blue", 5)

    if slug == "mage-academy":
        # A large crystal study pylon is the academy's function prop.
        crystal(g, 68, 10, 5, 7.5, 20, 7, "cyan", 6, n=6, lean=(1.4, 0.0))
        S.disc(g, "y", 68, 10, 9, 5, 8, "gold", 5, n=8)
    elif slug == "alchemist-shop":
        # A stout glass retort, brass collar and bent outlet pipe mark the shop.
        S.disc(g, "y", 69, 10, 7.5, 5, 21, "cyan", 5, n=8)
        S.disc(g, "y", 69, 10, 8.5, 19, 22, "gold", 5, n=8)
        box(g, 66, 21, 8, 72, 29, 12, "magenta", 6)
        S.bar(g, "z", (72, 28), (79, 34), 2.2, 9, 12, "gold", 5)
        S.disc(g, "y", 79, 8, 4.5, 5, 14, "magenta", 6, n=8)
    elif slug == "market-hall":
        # A broad striped awning covers a front counter with baskets of goods.
        g.prism("x", [(49, 17), (51, 21), (41, 8), (39, 8)], 22, 74, C("red", 5))
        awning = S.last(g)
        P.flat(g, awning & (X % 12 < 5), "sand", 6)
        for x in (25, 70):
            box(g, x, 8, 7, x + 3, 48, 12, "darkwood", 4)
        box(g, 22, 7, 7, 75, 13, 14, "wood", 5)
        for x,ramp in ((31,"red"),(45,"gold"),(59,"leaf")):
            basket=S.disc(g,"y",x,10,4,13,17,"wood",5,n=8)
            P.planks(g,basket,"wood",5,width=2,across="y",nails=False,seed=x)
            for dx,dz in ((-2,-1),(2,-1),(0,2)):
                S.disc(g,"y",x+dx,10+dz,1.8,16,20,ramp,6,n=6)
                if ramp=="leaf": S.bar(g,"z",(x+dx,19),(x+dx+2,22),1.2,10+dz,11+dz,"leaf",5)
    elif slug == "stables":
        # A gold horseshoe emblem sits over the wide stable stalls.
        S.bar(g, "z", (40, 43), (42, 54), 3.0, 13, 16, "gold", 5)
        S.bar(g, "z", (56, 43), (54, 54), 3.0, 13, 16, "gold", 5)
        S.bar(g, "z", (42, 54), (54, 54), 3.0, 13, 16, "gold", 5)
        box(g, 43, 42, 13, 53, 45, 16, "blue", 5)
        # A low trough sits in front of the stalls.
        _planked(g, (30, 5, 7, 57, 11, 13), "darkwood", 4, "x", 3, 62)
        P.flat(g, (g.a > 0) & (X >= 32) & (X < 55) & (Y == 10) & (Z < 14), "gold", 5)
    elif slug == "guard-barracks":
        # A broad blue shield and a short lance rack mark the guard post.
        front(g, [(48, 55), (57, 51), (56, 43), (48, 39), (40, 43), (39, 51)], 13, 17, "blue", 5)
        S.bar(g, "z", (46, 42), (46, 55), 1.5, 12, 14, "gold", 6)
        S.bar(g, "z", (50, 42), (50, 55), 1.5, 12, 14, "gold", 6)
        for x in (25, 31):
            S.bar(g, "z", (x, 8), (x + 1, 39), 2.0, 8, 11, "darkwood", 4)
            S.cone(g, "y", x, 9.5, 2.2, 37, 42, "iron", 5, n=4)
    elif slug == "thatched-cottage":
        # A stone bread oven with a bright fire is the cottage's function prop.
        oven = box(g, 68, 5, 7, 84, 19, 19, "stone", 5)
        P.stone(g, oven, "stone", 5, block=(4, 3), seed=63)
        P.flat(g, edges(oven), "stone", 2)
        front(g, [(70, 7), (82, 7), (82, 15), (70, 15)], 5, 8, "darkwood", 3)
        front(g, [(73, 8), (79, 8), (79, 13), (73, 13)], 4, 6, "orange", 6)
        S.cone(g, "y", 76, 13, 9, 17, 29, "stone", 5, n=8)
    elif slug == "granary":
        # Grain sacks stand in front of the attached silo.
        for x, r in ((26, "sand"), (39, "wood"), (53, "sand")):
            S.disc(g, "y", x, 9, 5, 5, 15, r, 5, n=8)
            box(g, x - 2, 13, 7, x + 2, 15, 11, "gold", 5)
    if slug=="alchemist-shop":
        _planked(g,(79,5,31,89,23,65),"wood",5,"z",4,90)
        for z,ramp,h in ((37,"magenta",8),(47,"cyan",11),(58,"sky",6)):
            S.disc(g,"y",84,z,3,23,23+h,ramp,5,n=8)
            S.disc(g,"y",84,z,1.4,23+h,26+h,"gold",5,n=6)
    elif slug=="mage-academy":
        _planked(g,(8,5,35,16,31,67),"wood",5,"z",3,91)
        for z,ramp in ((40,"blue"),(48,"red"),(57,"blue")):
            box(g,8,31,z,16,35,z+6,ramp,5)
            P.flat(g,(g.a>0)&(X<15)&(Y==33)&(Z>=z)&(Z<z+6),"gold",6)
    elif slug=="guard-barracks":
        _planked(g,(80,5,34,86,34,66),"darkwood",4,"y",4,92)
        for z in (39,50,61):
            S.disc(g,"x",23,z,5,84,87,"blue",5,n=8)
            box(g,86,20,z-1,88,26,z+1,"gold",6)
    elif slug=="granary":
        storage=box(g,35,5,77,61,29,80,"wood",5)
        P.planks(g,storage,"wood",5,width=4,across="x",seed=93)
        for y in (8,23): box(g,34,y,79,62,y+3,81,"darkwood",4)
        for z in (38,55):
            vent=box(g,16,45,z,18,51,z+12,"darkwood",4)
            P.flat(g,vent & (Z.astype(int)%3==0),"sand",5)
    elif slug=="stables":
        # Wide twin doors have a continuous diagonal brace and a feeding trough.
        for x in (22,52):
            door=box(g,x,5,15,x+23,33,20,"wood",5)
            P.planks(g,door,"wood",5,width=4,across="x",seed=x)
            S.bar(g,"z",(x+2,7),(x+21,30),3,14,17,"bone",5)
            box(g,x,18,14,x+23,21,17,"darkwood",4)
        _planked(g,(79,5,30,89,10,66),"wood",5,"z",4,94)
        _planked(g,(79,10,30,81,17,66),"darkwood",4,"z",4,95)
        _planked(g,(87,10,30,89,17,66),"darkwood",4,"z",4,96)
        hay=box(g,81,10,31,87,14,65,"sand",5)
        P.planks(g,hay,"sand",5,width=2,across="y",nails=False,seed=97)
    # A chimney supplies a grounded effect socket.
    box(g, 72, 52, 59, 80, 78, 68, "stone", 5)
    box(g, 71, 77, 58, 81, 80, 69, "darkwood", 4)
    P.flat(g, (g.a > 0) & (X >= 72) & (X < 80) & (Y >= 74), "stone", 6)
    return g, (76, 80, 63)


def build_building(slug: str):
    if slug not in BUILDINGS:
        raise KeyError(slug)
    g, socket_at = _building_grid(slug)
    name, _wall, _roof, effect = BUILDINGS[slug]
    root = Part(slug, g)
    return asset("buildings", slug, name, root,
                 sockets=[Socket("socket-function", at=socket_at)],
                 fx=[pfx(f"rvx-fantasy-{effect}", "socket-function", "idle", size=22)])


def _front_face(g: Grid, x: float, y: float, z: float, eye: str = "gold"):
    # Big eye recesses, pupils and a broad jaw line keep the face readable.
    for ex in (x - 4.0, x + 2.0):
        box(g, ex, y, z - 2, ex + 2.5, y + 2.4, z + 1, "darkwood", 2)
        box(g, ex + .6, y + .6, z - 3, ex + 1.9, y + 1.9, z - 1, eye, 6)
    box(g, x - 2.0, y - 4.0, z - 2, x + 2.0, y - 3.0, z + 1, "darkwood", 2)


def _humanoid_creature(slug: str, g: Grid, action: Grid):
    name, scale, coat, effect = CREATURES[slug]
    X, Y, Z = coords(g)
    # Shared body proportions follow the 36-voxel person reference.
    body = front(g, [(23, 18), (41, 18), (43, 31), (39, 37), (25, 37), (21, 31)], 24, 40, coat, 5)
    P.mottle(g, body, coat, 5, cell=5, seed=len(slug))
    box(g, 26, 18, 25, 38, 21, 39, "darkwood", 3)
    for x in (26, 38):
        S.bar(g, "z", (x, 20), (x - 1, 5), 3.0, 27, 36, coat, 5)
        box(g, x - 3, 0, 23, x + 3, 6, 37, "darkwood", 4)
        P.flat(g,(g.a>0)&(np.abs(X-x)<.7)&(Y<5)&(Z<26),"gold",4)
        P.flat(g, (g.a > 0) & (np.abs(X - x) < 3) & (Y < 2), "gold", 4)
    if slug in ("minotaur","cyclops"):
        S.bar(g,"z",(22,32),(17,21),6,24,35,coat,5)
        S.bar(g,"z",(17,21),(18,16),5,23,33,coat,5)
        box(g,15,14,22,22,21,33,coat,6)
        S.bar(action,"z",(42,32),(46,25),6,24,35,coat,5)
        box(action,42,21,22,49,28,32,coat,6)
        P.flat(g,(g.a>0)&(X<22)&(Y<18)&(Z<24),"darkwood",4)
    # Broad shoulders and a raised head sit above the short legs.
    front(g, [(19, 28), (45, 28), (42, 36), (22, 36)], 25, 39, "darkwood", 4)
    head_ramp = "bone" if slug == "cyclops" else coat
    head = S.disc(g, "z", 32, 38, 5.5, 20, 34, head_ramp, 5, n=8)
    P.flat(g, head & (np.indices(g.shape)[2] < 23), "bone", 5)
    if slug == "minotaur":
        S.bar(g, "z", (25, 40), (18, 42), 2.2, 20, 28, "bone", 6)
        S.bar(g, "z", (39, 40), (46, 42), 2.2, 20, 28, "bone", 6)
        S.bar(g, "z", (18, 42), (22, 41), 1.5, 20, 28, "bone", 6)
        S.bar(g, "z", (46, 42), (42, 41), 1.5, 20, 28, "bone", 6)
        box(g, 28, 34, 18, 36, 38, 21, "pink", 5)
        _front_face(g, 32, 39, 19, "gold")
        S.bar(action, "z", (39, 31), (46, 18), 2.8, 20, 26, "darkwood", 4)
        S.disc(action, "z", 47, 17, 4.4, 19, 28, "iron", 5, n=8)
        S.bar(action, "z", (42, 14), (52, 21), 2.2, 21, 26, "iron", 5)
    elif slug == "cyclops":
        S.disc(g, "z", 32, 39, 2.8, 17, 22, "gold", 7, n=8)
        box(g, 31, 38, 16, 33, 40, 18, "navy", 1)
        box(g, 28, 32, 19, 36, 34, 22, "bone", 6)
        # Heavy club is the moving function part.
        S.bar(action, "z", (42, 33), (48, 17), 3.4, 20, 27, "wood", 5)
        box(action, 43, 10, 19, 53, 23, 28, "stone", 5)
        for x in (44, 49):
            P.flat(action, (action.a > 0) & (np.abs(np.indices(action.shape)[0] - x) < 1) & (np.indices(action.shape)[1] < 24), "darkwood", 3)
    else:
        _front_face(g, 32, 39, 19, "gold")
        if slug == "minotaur":
            S.bar(action, "z", (39, 31), (46, 18), 2.8, 20, 26, "darkwood", 4)
            S.disc(action, "z", 47, 17, 4.4, 19, 28, "iron", 5, n=8)
            S.bar(action, "z", (42, 14), (52, 21), 2.2, 21, 26, "iron", 5)
        else:
            # Each feather joins the shoulder spar and ends in a tapered point.
            for sign in (-1,1):
                S.bar(action,"z",(32+sign*5,33),(32+sign*22,41),4,25,31,"orange",5)
                for i in range(5):
                    x=32+sign*(7+i*2.7)
                    front(action,S.quad((x,35+i*.7),(x+sign*5,21+i*2.6),2.7,1.2,cap=1.3),22,28,"orange",5+i%2)
                    xx,yy,zz=coords(action)
                    P.flat(action,S.last(action)&(zz<23)&((yy.astype(int)%7)==0),"gold",5)
            front(g,[(29,40),(35,40),(32,34)],16,21,"gold",7)
            for x in (26,38):
                for dx in (-2,0,2):
                    S.bar(g,"z",(x+dx,5),(x+dx,1),1.8,18,25,"bone",6)
    return (32.0, 34.0, 25.0), (32.0, 39.0, 18.0), effect


def _creature_body(slug: str, g: Grid, action: Grid):
    if slug in ("harpy", "minotaur", "cyclops"):
        return _humanoid_creature(slug, g, action)
    name, scale, coat, effect = CREATURES[slug]
    X, Y, Z = coords(g)
    if slug == "basilisk":
        # Long lizard body, four splayed legs and a wedge head at the front.
        body=plan(g,[(23,14),(41,14),(45,25),(41,51),(24,53),(19,29)],8,21,coat,5,
                  top=[(26,17),(38,17),(41,27),(38,49),(26,50),(23,28)])
        P.mottle(g,body,coat,5,cell=4,seed=13)
        P.flat(g,body & ((Y.astype(int)%6==0)&(Z.astype(int)%7<4)),"leaf",5)
        for x in (20, 41):
            for z in (19, 39):
                S.bar(g, "x", (18, z), (4, z - 2), 3.5, x, x + 5, coat, 5)
                direction=-1 if x==20 else 1
                S.bar(g,"y",(x+2,z),(x+direction*7,z-3),5,2,6,coat,5)
                for dz in (-4,-1,2):
                    S.bar(g,"y",(x+direction*6,z+dz),(x+direction*10,z+dz-2),2,1,3,"bone",6)
        front(g, [(24, 19), (40, 19), (43, 28), (35, 34), (26, 32), (21, 27)], 10, 22, coat, 5)
        head = S.disc(g, "z", 32, 28, 8, 7, 17, "forest", 5, n=8)
        P.flat(g, head & (np.indices(g.shape)[1] > 25), "gold", 5)
        jaw=plan(g,[(23,5),(41,5),(43,14),(21,14)],17,24,"forest",5,
                 top=[(26,4),(38,4),(41,13),(23,13)])
        P.flat(g,jaw & (Y<19),"gold",5)
        for x in (25,29,35,39):
            front(g,[(x,19),(x+2,19),(x+1,16)],4,6,"bone",6)
        _front_face(g, 32, 29, 6, "red")
        # Raised back plates and the broad curling tail move as one part.
        for z in (24, 30, 36, 42):
            front(action, [(27, 22), (32, 31), (37, 22)], z, z + 4, "gold", 5)
        side(action,S.quad((17,47),(17,55),4,2.4),27,37,coat,5)
        side(action,S.quad((17,55),(23,58),2.4,.7),29,35,"forest",5)
        hinge, socket = (32.0, 18.0, 43.0), (32.0, 28.0, 8.0)
    elif slug == "centaur":
        # Four-legged horse base, human chest and a visible bow.
        plan(g,[(23,15),(41,15),(46,29),(42,56),(23,56),(18,29)],12,29,"wood",5,
             top=[(25,17),(39,17),(42,29),(39,54),(26,54),(22,29)])
        P.mottle(g, g.a > 0, "wood", 5, cell=5, seed=27)
        for x in (21, 40):
            for z in (21, 49):
                S.bar(g, "x", (14, z), (3, z - 1), 3.4, x, x + 5, "wood", 5)
                box(g, x - 1, 0, z - 4, x + 6, 5, z + 4, "darkwood", 4)
        front(g, [(24, 24), (40, 24), (42, 39), (37, 47), (27, 47), (22, 39)], 17, 30, "bone", 5)
        S.bar(g,"z",(24,40),(18,30),5,18,27,"bone",5)
        S.bar(g,"z",(18,30),(27,33),4,16,24,"bone",5)
        box(g,25,31,15,31,36,22,"bone",6)
        S.bar(g,"x",(24,52),(15,59),4,29,35,"darkwood",4)
        S.bar(g,"x",(15,59),(6,60),4,29,35,"darkwood",5)
        box(g,27,26,31,37,30,45,"blue",5)
        P.flat(g,(g.a>0)&(X>=27)&(X<37)&(Y==29)&(Z>=31)&(Z<45),"gold",5)
        head = S.disc(g, "z", 32, 52, 6.5, 21, 33, "bone", 5, n=8)
        P.flat(g, head & (np.indices(g.shape)[1] > 49), "wood", 5)
        _front_face(g, 32, 53, 20, "blue")
        S.bar(action, "z", (38, 40), (47, 30), 2.5, 19, 24, "wood", 5)
        front(action, [(45, 28), (51, 35), (47, 48), (44, 47)], 18, 21, "gold", 5)
        S.bar(action, "z", (48, 32), (48, 47), 1.0, 17, 19, "bone", 7)
        hinge, socket = (38.0, 39.0, 24.0), (48.0, 38.0, 18.0)
    elif slug == "owlbear":
        plan(g, [(15, 18), (49, 18), (53, 31), (46, 49), (18, 49), (11, 31)], 9, 34, "wood", 5,
             top=[(19, 20), (45, 20), (48, 31), (43, 45), (21, 45), (16, 31)])
        fur(g, g.a > 0, "wood", 5, seed=29)
        for x in (19, 43):
            S.bar(g, "z", (x, 28), (x - 4, 11), 4.6, 20, 37, "wood", 5)
            box(g, x - 7, 2, 17, x + 1, 10, 37, "darkwood", 4)
        head = S.disc(g, "z", 32, 43, 12, 11, 28, "bone", 5, n=8)
        P.flat(g, head & (np.indices(g.shape)[2] > 23), "wood", 4)
        for x in (23, 39):
            S.disc(g, "z", x, 47, 4.4, 7, 12, "gold", 6, n=8)
            box(g, x - 1, 46, 5, x + 1, 49, 8, "navy", 1)
        front(g, [(28, 40), (36, 40), (32, 34)], 4, 10, "gold", 7)
        S.bar(g,"z",(19,29),(12,17),8,12,22,"wood",5)
        S.bar(g,"z",(12,17),(14,9),7,12,22,"wood",5)
        for x in (10,14,18):
            S.bar(g,"z",(x,12),(x-1,6),2,10,17,"bone",6)
        for x in (22,42):
            S.bar(g,"z",(x,20),(x+1,6),7,38,48,"wood",5)
            box(g,x-3,0,38,x+5,7,51,"darkwood",4)
        # A thick forearm and three claws strike from the shoulder.
        S.bar(action, "z", (43, 29), (50, 16), 5.0, 12, 20, "wood", 5)
        for x in (47, 51, 55):
            S.bar(action, "z", (x, 16), (x + 1, 8), 1.6, 12, 17, "bone", 7)
        hinge, socket = (43.0, 29.0, 16.0), (48.0, 15.0, 9.0)
    elif slug == "phoenix":
        # Broad breast, long neck, hooked beak and split tail flame.
        S.disc(g, "z", 32, 29, 14, 23, 46, "red", 5, n=10)
        P.flat(g, g.a > 0, "orange", 5)
        front(g, [(27, 38), (37, 38), (36, 51), (32, 58), (28, 51)], 20, 35, "orange", 5)
        head = S.disc(g, "z", 32, 57, 7, 18, 32, "gold", 6, n=8)
        P.flat(g, head & (np.indices(g.shape)[1] > 56), "red", 5)
        front(g, [(29, 57), (35, 57), (32, 51)], 14, 20, "bone", 7)
        for x, ramp in ((22, "red"), (27, "orange"), (32, "gold"), (37, "orange"), (42, "red")):
            S.bar(g, "z", (x, 25), (x + (x - 32) * .4, 7), 2.3, 38, 43, ramp, 6)
        for x in (27, 37):
            S.bar(g, "z", (x, 58), (x - 2, 68), 2.0, 24, 30, "red", 6)
        _front_face(g,32,59,17,"blue")
        for sign in (-1,1):
            S.bar(action,"z",(32+sign*5,40),(32+sign*25,62),5,29,35,"red",5)
            for i in range(6):
                x=32+sign*(8+i*3.4)
                m=front(action,S.quad((x,46+i*2.4),(x+sign*5,29+i*3.5),3.1,1.0,cap=1.5),27,33,"red" if i%2 else "orange",5)
                xx,yy,zz=coords(action)
                P.flat(action,m & (yy<34+i*3.5),"gold",6)
                P.flat(action,m & (zz<28)&(yy.astype(int)%8<2),"orange",6)
        for i,(x,ramp) in enumerate(((24,"red"),(32,"gold"),(40,"orange"))):
            side(g,S.quad((24,42),(8+i*2,60),3,1,cap=1),x-2,x+2,ramp,6)
        hinge, socket = (32.0, 36.0, 30.0), (32.0, 53.0, 16.0)
    else:
        raise KeyError(slug)
    return hinge, socket, effect


def build_creature(slug: str):
    if slug not in CREATURES:
        raise KeyError(slug)
    g, action = Grid(64, 96, 64), Grid(64, 96, 64)
    hinge, socket_at, effect = _creature_body(slug, g, action)
    part_name = "action"
    if slug=="phoenix":
        root_lift=.4
    else:
        root_lift=0.0
    root, to_root = rig([("body", g, None, None), (part_name, action, hinge, None)])
    if root_lift:
        root.at=(0.0,root_lift,0.0)
    idle = {part_name: {"rot": sway(2.0, amp=(0, 0, 2))}}
    attack = {part_name: {"rot": keys((0, 0, 0, 0), (.18, -38, 0, 0), (.36, -64, 0, 0), (.8, 0, 0, 0))}}
    hit = {part_name: {"rot": keys((0, 0, 0, 0), (.08, 18, 0, 0), (.18, -8, 0, 0), (.35, 0, 0, 0))}}
    death = {part_name: {"rot": keys((0, 0, 0, 0), (.35, 20, 0, 0), (.9, 78, 0, 0))}}
    name, scale, _coat, _effect = CREATURES[slug]
    return asset("creatures", slug, name, root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                 sockets=[Socket("socket-function", at=to_root(socket_at), parent=part_name)],
                 fx=[pfx(f"rvx-fantasy-{effect}", "socket-function", "clip:attack", size=20, at=.35)])


def _spoked_wheel(g: Grid, x0, x1, radius: float, zc: float, wood="wood"):
    wheel = S.disc(g, "x", radius, zc, radius, x0, x1, wood, 5, n=10)
    rr = S.radial(g, "x", radius, zc)
    P.flat(g, wheel & (rr > radius - 2.2), "darkwood", 3)
    for k in range(8):
        a = math.tau * k / 8
        S.bar(g, "x", (radius + math.cos(a) * 2, zc + math.sin(a) * 2),
              (radius + math.cos(a) * (radius - 2), zc + math.sin(a) * (radius - 2)),
              1.7, x0, x1, "wood", 6)
    S.disc(g, "x", radius, zc, 3.0, x0 - .5, x1 + .5, "iron", 5, n=8)
    P.flat(g, wheel & (rr < 2.1), "gold", 6)
    return wheel


def _vehicle_model(slug: str):
    name, scale, effect = VEHICLES[slug]
    if slug == "flying-carpet":
        g = Grid(96, 80, 96)
        profile=[(16,24),(11,31),(7,40),(5,48),(7,56),(11,65),(16,72)]
        cloth=[]
        for (y0,z0),(y1,z1) in zip(profile,profile[1:]):
            cloth.append(side(g,[(y0,z0),(y1,z1),(y1-1.5,z1),(y0-1.5,z0)],18,78,"blue",5))
        outer=np.logical_or.reduce(cloth)
        X,Y,Z=coords(g)
        border=outer & ((X<23)|(X>73)|(Z<29)|(Z>67))
        P.flat(g,border,"gold",5)
        diamond=np.abs(X-48)+np.abs(Z-48)*1.2
        P.flat(g,outer & ~border & (diamond<18),"red",5)
        P.flat(g,outer & ~border & (diamond<12),"gold",6)
        P.flat(g,outer & ~border & (diamond<6),"cyan",6)
        weave=outer & ((X.astype(int)%7==0)&(Z.astype(int)%5==0))
        P.flat(g,weave,"bone",6)
        for z,y in ((24,16),(72,16)):
            for x in range(21,77,5):
                S.bar(g,"x",(y-.5,z),(y-4,z+(-2 if z==24 else 2)),1.1,x,x+1.5,"gold",5)
        for x in (18,77):
            for y,z in profile[1:-1]:
                S.bar(g,"z",(x,y-.7),(x+(-2 if x==18 else 2),y-4),1.1,z-1,z+1,"gold",5)
        root = Part("carpet", g, pivot=(48,0,48))
        ride = {"carpet": {"loc": keys((0,0,2,0),(1,0,3.2,0),(2,0,2,0)), "rot": sway(2.0, amp=(0, 0, 2))}}
        return asset("vehicles", slug, name, root,
                     clips=[Clip("move", ride)], sockets=[Socket("socket-function", at=(0, 15, 0))],
                     fx=[pfx("rvx-fantasy-fairy-motes", "socket-function", "clip:move", size=17)])

    if slug == "battering-ram":
        g, beam = Grid(112, 90, 112), Grid(112, 90, 112)
        X, Y, Z = coords(g)
        # Long siege bed on four heavy wheels, with a timber roof over the crew.
        for z in (24, 86):
            for x0 in (8, 94):
                _spoked_wheel(g, x0, x0 + 6, 13, z, "darkwood")
        _planked(g, (13, 14, 18, 95, 22, 94), "darkwood", 4, "x", 4, 62)
        for x in (15, 88):
            box(g, x, 22, 22, x + 5, 61, 29, "wood", 5)
            box(g, x, 22, 82, x + 5, 61, 89, "wood", 5)
        canopy = _planked(g, (11, 57, 22, 99, 64, 88), "red", 4, "x", 5, 63)
        P.planks(g, canopy & (Y >= 62), "red", 5, width=5, across="x", frame="top", nails=False, seed=31)
        P.flat(g, canopy & (Y >= 62) & ((X < 15) | (X > 95)), "gold", 5)
        # The iron-capped log hangs lengthwise under the roof and strikes the
        # gate on attack. It extends past the front wheels for a clear read.
        S.bar(beam, "x", (39, 4), (39, 92), 7.0, 50, 60, "darkwood", 5)
        cap = S.disc(beam, "z", 55, 39, 8.0, 4, 12, "iron", 5, n=8)
        P.flat(beam, cap & (np.indices(beam.shape)[2] < 7), "iron", 6)
        P.flat(beam, (beam.a > 0) & (np.indices(beam.shape)[2] > 14) & (np.indices(beam.shape)[2] < 19), "gold", 6)
        for z in (35, 70):
            S.bar(g, "x", (64, z), (43, z), 1.3, 52, 58, "iron", 5)
        for x0 in (13, 88):
            S.bar(g, "x", (18, 24), (58, 43), 6.0, x0, x0 + 5, "wood", 5)
            S.bar(g, "x", (18, 88), (58, 69), 6.0, x0, x0 + 5, "wood", 5)
        # Broad side braces join the lower bed to the roof and read as real
        # sloped timbers in the vehicle silhouette.
        for z0, z1 in ((15, 21), (91, 97)):
            for x0, x1 in ((22, 47), (86, 61)):
                brace = S.bar(g, "z", (x0, 20), (x1, 58), 8.0, z0, z1, "wood", 5)
                P.flat(g, brace & (Y > 54), "wood", 6)
        # Heavy chains connect the swinging log to the roof.
        for z in (35, 70):
            S.bar(g, "z", (52, 43), (52, 58), 2.2, z, z + 4, "iron", 4)
        parts = [("ram-bed", g, None, None), ("ram-head", beam, (55.0, 39.0, 56.0), None)]
        root, to_root = rig(parts)
        attack = {"ram-head": {"rot": keys((0, 0, 0, 0), (.22, -20, 0, 0), (.42, 12, 0, 0), (.8, 0, 0, 0))}}
        return asset("vehicles", slug, name, root,
                     clips=[Clip("idle", {"ram-head": {"rot": sway(2.0, amp=(0, 0, 1))}}), Clip("attack", attack, loop=False)],
                     sockets=[Socket("socket-function", at=to_root((55, 39, 7)), parent="ram-head")],
                     fx=[pfx("rvx-fantasy-dust-slam", "socket-function", "clip:attack", size=30, at=.42)])

    g = Grid(96, 80, 96)
    X, Y, Z = coords(g)
    wheels = []
    extra_parts = []
    root_name = slug
    clips_move = {}
    if slug == "hay-cart":
        for z in (22, 70):
            for x0, x1 in ((11, 15), (81, 85)):
                w = Grid(*g.shape)
                _spoked_wheel(w, x0, x1, 12, z, "wood")
                wheel_name = f"wheel-{x0}-{z}"
                wheels.append((wheel_name, w, (float((x0+x1)/2), 12.0, float(z))))
                clips_move[wheel_name] = {"rot": turn(1.2, "x", -300)}
        _planked(g, (21, 14, 12, 75, 21, 80), "wood", 5, "x", 4, 64)
        for z in (14, 77):
            box(g, 21, 21, z, 75, 29, z + 3, "darkwood", 4)
        for x, z in ((30, 30), (48, 31), (64, 46)):
            hay = box(g, x, 21, z, x + 16, 39, z + 18, "sand", 5)
            P.planks(g,hay,"sand",5,width=2,across="y",nails=False,seed=x)
            P.flat(g,hay & (Y>36)&(Z.astype(int)%3<2),"gold",6)
            P.flat(g,hay & ((X.astype(int)-x)%12<2),"wood",4)
        for z in (22,70):
            box(g,13,10,z-2,84,14,z+2,"iron",5)
        for x in (31,64):
            S.bar(g,"x",(18,73),(12,94),3,x,x+4,"wood",5)
        box(g,46,20,12,50,36,15,"darkwood",4)
        box(g, 45, 35, 9, 51, 43, 14, "gold", 5)
        box(g, 46, 37, 8, 50, 42, 10, "cyan", 6)
        fx_at = (48, 40, 8)
        fx_trigger = "idle"
        # Wheel rotation drives the cart without rotating its ground plane.
        clip_set = [Clip("move", clips_move)]
    elif slug == "war-chariot":
        for z in (20, 69):
            for x0, x1 in ((8, 14), (82, 88)):
                w = Grid(*g.shape)
                _spoked_wheel(w, x0, x1, 16, z, "darkwood")
                wheel_name = f"wheel-{x0}-{z}"
                wheels.append((wheel_name, w, (float((x0+x1)/2), 16.0, float(z))))
                clips_move[wheel_name] = {"rot": turn(1.0, "x", -360)}
        _planked(g, (17, 19, 9, 79, 27, 78), "red", 5, "x", 4, 65)
        for x in (17, 72):
            shield = front(g, [(x, 21), (x + 7, 21), (x + 9, 35), (x + 3, 43), (x - 2, 35)], 14, 18, "blue", 5)
            P.flat(g, shield & (np.indices(g.shape)[2] < 16), "gold", 6)
        for z in (20,69):
            box(g,10,14,z-2,86,19,z+2,"iron",5)
        for x in (29,64):
            S.bar(g,"x",(23,20),(17,1),4,x,x+4,"wood",5)
        face=front(g,[(17,26),(79,26),(76,43),(67,49),(27,49),(20,43)],10,16,"blue",5)
        P.plates(g,face,"blue",5,seed=11)
        P.flat(g,edges(face),"gold",5)
        for x in (17,75):
            _planked(g,(x,27,15,x+4,39,60),"red",5,"z",4,x)
        S.disc(g,"z",48,37,7,8,11,"gold",6,n=8)
        P.flat(g,(g.a>0)&(np.abs(X-48)<2)&(Y>=33)&(Y<42)&(Z<10),"red",5)
        # A forward spear, with a short jab in the attack clip.
        spear = Grid(*g.shape)
        box(spear, 44, 23, 2, 47, 26, 13, "wood", 5)
        front(spear, [(42, 23), (49, 23), (45.5, 30)], 0, 4, "iron", 6)
        root_name = "chariot"
        extra_parts = [("spear", spear, (45.0, 24.0, 8.0), None)]
        attack = {"spear": {"loc": keys((0, 0, 0, 0), (.2, 0, 0, -8), (.45, 0, 0, 0))}}
        # The chassis stays level while its wheels turn.
        clip_set = [Clip("move", {k: v for k, v in clips_move.items()}), Clip("attack", attack, loop=False)]
        fx_at, fx_trigger = (46, 25, 3), "clip:attack"
    else:  # mine cart
        for z in (22, 63):
            for x0, x1 in ((17, 20), (76, 79)):
                w = Grid(*g.shape)
                _spoked_wheel(w, x0, x1, 9, z, "iron")
                wheel_name = f"wheel-{x0}-{z}"
                wheels.append((wheel_name, w, (float((x0+x1)/2), 9.0, float(z))))
                clips_move[wheel_name] = {"rot": turn(1.0, "x", -360)}
        _planked(g, (20, 12, 13, 76, 20, 72), "wood", 4, "x", 3, 66)
        for z in (22,63):
            box(g,18,8,z-2,79,12,z+2,"iron",5)
        for x in (20,70):
            wall=box(g,x,19,14,x+6,36,72,"iron",5)
            P.plates(g,wall,"iron",5,seed=x)
            P.flat(g,edges(wall),"gray",3)
        for z in (14,66):
            wall=box(g,20,19,z,76,36,z+6,"iron",5)
            P.plates(g,wall,"iron",5,seed=z)
            P.flat(g,edges(wall),"gray",3)
        for x in (23,71):
            for z in (17,68):
                box(g,x,19,z,x+2,38,z+2,"gold",5)
        boulder(g, 37, 36, 20, 10, 16, "gold", 5, n=7, seed=67, moss=None)
        boulder(g, 54, 46, 20, 8, 12, "stone", 5, n=7, seed=68, moss=None)
        box(g, 68, 24, 52, 74, 34, 57, "iron", 5)
        box(g, 69, 34, 52, 73, 37, 56, "orange", 6)
        fx_at, fx_trigger = (71, 35, 54), "idle"
        clips_move[slug] = {"loc": sway(2.0, amp=(0, 0, .8))}
        clip_set = [Clip("move", clips_move)]

    if slug in ("hay-cart","war-chariot","mine-cart"):
        from _vehicle_contact import CONTACT_HEIGHTS
        seconds=1.2 if slug=="hay-cart" else 1.0
        clip_set[0].keys[root_name]={"loc":[(i/30,(0.0,y,.8*math.sin(math.tau*i/30/seconds) if slug=="mine-cart" else 0.0)) for i,y in enumerate(CONTACT_HEIGHTS[slug])]}

    parts = [(root_name, g, None, None)] + extra_parts + [(n, w, hub, None) for n, w, hub in wheels]
    root, to_root = rig(parts)
    socket_at = to_root(fx_at)
    return asset("vehicles", slug, name, root, clips=clip_set,
                 sockets=[Socket("socket-function", at=socket_at, parent="spear" if slug == "war-chariot" else None)],
                 fx=[pfx(f"rvx-fantasy-{effect}", "socket-function", fx_trigger, size=18, at=.3 if fx_trigger.startswith("clip:") else None)])


def build_vehicle(slug: str):
    if slug not in VEHICLES:
        raise KeyError(slug)
    return _vehicle_model(slug)


def build_model(category: str, slug: str):
    if category == "terrain-nature":
        return build_terrain(slug)
    if category == "buildings":
        return build_building(slug)
    if category == "creatures":
        return build_creature(slug)
    if category == "vehicles":
        return build_vehicle(slug)
    raise KeyError(category)
