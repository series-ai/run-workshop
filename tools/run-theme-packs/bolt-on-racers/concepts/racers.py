"""Bolt-On Racers concept boards: modular chunky toy vehicles.

    cd tools/run-theme-packs/bolt-on-racers/concepts
    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -t 1 --python racers.py -- renders [board-prefix ...]
    python3 ../../shared/board.py renders [board-prefix ...]

Every vehicle on every board is assembled by vehicle(): chassis -> wheels on the
chassis wheel snaps -> body shell on the 'body' snap (scaled to the chassis
class) -> bolt-ons on the shell's snaps -> driver on the seat. Nothing is placed
by hand, which is the proof that the mix-and-match works.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mathutils import Matrix, Vector  # noqa: E402

import rk  # noqa: E402  (puts shared/ on sys.path)
import kit  # noqa: E402
from rk import (C, V, at, at_m, box, cyl, ell, CHASSIS, CLS, ORDER, WHEELS, chassis_snaps, chassis_build, wheel,  # noqa: E402
                wheel_dims, marker, mix, shade, RED, YEL, TEAL, BLUE, WHITE, ORANGE, CHAR, BLACK, CHROME, _tread)
from bodies import BODIES, BODY_ORDER  # noqa: E402
import parts  # noqa: E402
from parts import BOLTONS, driver, HELMETS  # noqa: E402
import track  # noqa: E402

DISPLAY_RZ = -24  # turn the nose a little away so the side profile reads


def _bscale(ch):
    k = CLS[CHASSIS[ch]["cls"]]
    return (k["W"] / 0.66, k["L"] / 1.2, k["h"]), k["s"]


def body_snaps(ch, body, B):
    (sx, sy, sz), _ = _bscale(ch)
    bp = V(chassis_snaps(ch)["body"])
    out = {}
    for n, p in B.items():
        if n == "open":
            continue
        out[n] = tuple(bp + V(p[0] * sx, p[1] * sy, p[2] * sz))
    return out


def _wheels(ch, kind, acc, skip=(), camber=None):
    c = CHASSIS[ch]
    S = chassis_snaps(ch)
    r, w = wheel_dims(ch, kind)
    if kind == "treads" and c["layout"] == "4":
        wb = c["wb"]
        for side, (nm) in ((1, "wheel_FL"), (-1, "wheel_FR")):
            x = S[nm][0]
            with at((x, 0, r), s=(side, 1, 1)):
                _tread(r, w, acc, y0=-wb / 2, y1=wb / 2)
        return
    for nm, p in S.items():
        if not nm.startswith("wheel_") or nm in skip:
            continue
        side = 1 if p[0] > 0 else -1
        k = kind if not (kind == "treads") else "slick"
        with at((p[0], p[1], r), ry=(camber if (camber is not None and nm == "wheel_FL") else 0)):
            wheel(k, r, w, acc=acc, side=side, centred=(abs(p[0]) < 1e-6))


def _tilt(ch, kind):
    """Rotation that drops the FL corner (missing wheel) about the FR-RL contact axis."""
    c = CHASSIS[ch]
    S = chassis_snaps(ch)
    r, w = wheel_dims(ch, kind)
    fr = V(S["wheel_FR"][0] - w / 2, S["wheel_FR"][1], 0)
    rl = V(S["wheel_RL"][0] + w / 2, S["wheel_RL"][1], 0)
    fl = V(S["wheel_FL"][0], S["wheel_FL"][1], r)
    d = (rl - fr).normalized()
    mid = (rl + fr) / 2
    rel = fl - mid
    dist = (rel - d * rel.dot(d)).length
    drop = r * 0.75
    th = math.asin(min(0.9, drop / dist))
    return Matrix.Translation(mid) @ Matrix.Rotation(th, 4, d) @ Matrix.Translation(-mid)


def vehicle(ch="coupe", body=None, wheels=None, bolts=(), helmet=0, suit=RED, helm=WHITE, hacc=BLUE, paint=None,
            damage=0, rz=DISPLAY_RZ, rider=True, decals=(), markers=None, show_wheels=True, rim=None, debris=False):
    c = CHASSIS[ch]
    kind = wheels or c["wheels"]
    r_eff, w = wheel_dims(ch, kind)
    lift = r_eff - c["r"]
    S = chassis_snaps(ch)
    P = dict(paint or (BODIES[body][2] if body else dict(main=RED, acc=WHITE)))
    if damage == 2:
        P = {k: (mix(v, C(60, 56, 56), 0.4) if isinstance(v, tuple) else v) for k, v in P.items()}
    rim = rim or P.get("rim") or (P["acc"] if P["acc"] not in (WHITE, CHAR) else P["main"])
    (sx, sy, sz), bs = _bscale(ch)
    tilt = _tilt(ch, kind) if (damage == 2 and c["layout"] == "4" and kind not in ("treads", "hover", "thruster", "skis")) else Matrix.Identity(4)
    with at((0, 0, 0), rz=rz):
        if debris:
            parts_debris()
        with at_m(tilt), at((0, 0, lift)):
            chassis_build(ch, bare=body is None, acc=P["main"] if body is None else CHAR, wheels=kind)
            if show_wheels:
                _wheels(ch, kind, rim, skip=("wheel_FL",) if damage == 2 and tilt is not Matrix.Identity(4) and c["layout"] == "4" else (),
                        camber=10 if damage == 1 else None)
            if body:
                with at(S["body"], s=(sx, sy, sz)):
                    B = BODIES[body][0](P)
                BS, open_ = body_snaps(ch, body, B), B["open"]
            else:
                BS, open_ = {k: v for k, v in S.items() if not k.startswith("wheel_") and k != "body"}, True
            for d in decals:
                _decal(d, ch, body, BS, P)
            for b in bolts:
                kind_b, fn, _, _ = BOLTONS[b]
                pts = {"exhaust": ["exhaust_L", "exhaust_R"], "side": ["side_L", "side_R"]}.get(kind_b, [kind_b])
                for pn in pts:
                    p = BS[pn]
                    mir = -1 if p[0] < -1e-6 else 1
                    rot = {}
                    if damage >= 1 and kind_b == "front":
                        rot = dict(rx=-14, rz=9)
                        p = (p[0] + 0.03, p[1] - 0.02, p[2] - 0.04)
                    if damage == 2 and kind_b == "rear":
                        rot = dict(ry=22, rx=-10)
                    if damage == 2 and kind_b == "mast":
                        rot = dict(rx=35)
                    with at(p, **rot):
                        with at((0, 0, 0), s=(mir * bs, bs, bs)):
                            fn(P.get("bolt", P["acc"] if P["acc"] != WHITE else P["main"]) if b != "lightbar" else None)
            if damage:
                _damage(damage, ch, body, BS, P)
            if rider and open_:
                with at(BS["seat"]):
                    driver(helmet, suit=suit, helm=helm, acc=hacc, legs=True)
                    if damage == 2:
                        for i, (x, y) in enumerate(((0.12, 0.0), (-0.06, 0.1), (-0.06, -0.1))):
                            with at((x, y, 0.5), rz=i * 40):
                                kit.slab(rk.star(0.035), 0.012, (0, 0, 0), YEL, emit=0.6)
            if markers:
                _markers(markers, S, BS, ch)


def _markers(mode, S, BS, ch):
    def kind_of(n):
        for k in ("wheel", "body", "seat", "roof", "front", "rear", "tail", "exhaust", "side", "hood", "mast"):
            if n.startswith(k):
                return k
    if mode in ("chassis", "all"):
        for n, p in S.items():
            if n.startswith("wheel_") or n in ("body", "seat"):
                marker(p, kind_of(n), 1.2)
    if mode in ("body", "all"):
        for n, p in BS.items():
            if n in ("seat",) and mode == "body":
                continue
            marker(p, kind_of(n), 1.2)


def _sh(side, y, z):
    """Side-surface hit, starting the ray just outside the shell (inside the wheel flanges)."""
    return parts.side_hit(y, z, x0=side.x + 0.015)


def _decal(d, ch, body, BS, P):
    (sx, sy, sz), _ = _bscale(ch)
    bp = V(chassis_snaps(ch)["body"])
    side = V(BS["side_L"])
    kind = d[0]
    if kind == "number":
        for s in (1, -1):
            h = _sh(side, 0.02 * sy + bp.y, side.z + 0.07 * sz) if s > 0 else None
            if s < 0:
                hit = rk.cast((-1.5, 0.02 * sy + bp.y, side.z + 0.07 * sz), (1, 0, 0))
                h = hit[0] if hit else None
            if h is None:
                continue
            with at((h.x + 0.004 * s, h.y, h.z), s=(s, 1, 1)):
                parts.number_roundel(d[1], r=0.085 * sz, bg=d[2] if len(d) > 2 else WHITE)
    elif kind == "stripes":
        col = d[1] if len(d) > 1 else WHITE
        for x in (-0.07, 0.07):
            parts.conform_strip(x * sx, bp.y - 0.64 * sy, bp.y + 0.64 * sy, 0.075 * sx, col)
    elif kind == "flames":
        h = _sh(side, bp.y - 0.3 * sy, side.z + 0.05 * sz)
        if h is not None:
            with at((h.x + 0.003, h.y, h.z), s=(1, sy, sz)):
                parts.flame_decal(0.55, 0.2)
    elif kind == "sidestripe":
        col = d[1] if len(d) > 1 else WHITE
        h = _sh(side, bp.y, side.z + 0.1 * sz)
        if h is not None:
            for s in (1, -1):
                box((0.008, 1.1 * sy, 0.035 * sz), (s * (h.x + 0.002), bp.y, h.z), col)
                box((0.008, 1.1 * sy, 0.012 * sz), (s * (h.x + 0.002), bp.y, h.z - 0.04 * sz), col)
    elif kind == "checker":
        h = _sh(side, bp.y, side.z + 0.03 * sz)
        if h is not None:
            for s in (1, -1):
                for i in range(14):
                    for j in range(2):
                        col = BLACK if (i + j) % 2 else WHITE
                        box((0.008, 0.05 * sy, 0.03 * sz), (s * (h.x + 0.002), bp.y - 0.34 * sy + i * 0.05 * sy, h.z + j * 0.03 * sz), col)


def _damage(stage, ch, body, BS, P):
    (sx, sy, sz), _ = _bscale(ch)
    bp = V(chassis_snaps(ch)["body"])
    side = V(BS["side_L"])
    main = P["main"]
    for i, (y, dz) in enumerate(((-0.14, 0.04), (0.14, 0.02)) if stage == 1 else ((-0.18, 0.05), (0.2, 0.02))):
        h = _sh(side, bp.y + y * sy, side.z + dz * sz)
        if h is not None:
            parts.crumple(h, (1, 0, 0), main, size=0.11 * sz, seed=i + stage * 7)
            if i == 1:
                parts.plaster((h.x + 0.02, h.y, h.z + 0.06 * sz))
    # scratches
    h = _sh(side, bp.y + 0.05 * sy, side.z + 0.1 * sz)
    if h is not None:
        for k in range(3):
            box((0.006, 0.18 * sy, 0.008), (h.x + 0.004, h.y + k * 0.02, h.z - k * 0.02), shade(main, 1.35), rx=12)
    if stage == 1:
        hood = V(BS["hood"])
        hit = rk.cast((hood.x, hood.y, 3), (0, 0, -1))
        hz = hit[0].z if hit else hood.z
        parts.smoke((hood.x, hood.y, hz + 0.05), n=3, k=0.55, seed=5)
    if stage == 2:
        hood = V(BS["hood"])
        hit = rk.cast((hood.x, hood.y, 3), (0, 0, -1))
        hz = hit[0].z if hit else hood.z
        with at((hood.x, hood.y + 0.08 * sy, hz + 0.01), rx=-28):
            box((0.42 * sx, 0.26 * sy, 0.022), (0, -0.13 * sy, 0.0), main, bevel=0.006)
        parts.scorch((hood.x, hood.y, hz + 0.004), r=0.12)
        parts.smoke((hood.x, hood.y, hz + 0.08), n=7, k=1.0, seed=3)
        # missing door: a dark opening on the left side
        h = _sh(side, bp.y + 0.0 * sy, side.z + 0.05 * sz)
        if h is not None:
            box((0.012, 0.3 * sy, 0.15 * sz), (h.x + 0.002, h.y, h.z), C(30, 28, 34))
            for k in range(3):
                ell((h.x - 0.01, h.y - 0.1 + k * 0.1, h.z - 0.02), (0.02, 0.025, 0.02), C(255, 200, 80), seg=4, ring=2, emit=1.2)


def parts_debris():
    """Loose bits around a wreck (in display space, on the ground)."""
    with at((1.05, -0.2, 0), rz=30):
        parts.loose_wheel("slick", RED)
    for i, (x, y) in enumerate(((0.45, -0.95), (0.75, -0.75), (1.1, -0.65))):
        with at((x, y, 0.015), rx=90 if i % 2 else 0, rz=i * 50):
            parts.bolt_piece(seed=i, s=1.6) if i != 1 else parts.nut_piece(1.6)


# ---------------------------------------------------------------- board cells

def V_(**kw):
    return lambda: vehicle(**kw)


def part_cell(name):
    kind, fn, label, grp = BOLTONS[name]
    def f():
        with at((0, 0, 0), rz=DISPLAY_RZ):
            pts = [(0, 0, 0)]
            if kind in ("exhaust", "side"):
                pts = [(0.3, 0, 0), (-0.3, 0, 0)] if kind == "side" else [(0.2, 0, 0), (-0.2, 0, 0)]
            base = 0.0 if kind in ("roof", "hood", "mast", "rear") else 0.12
            for p in pts:
                mir = -1 if p[0] < 0 else 1
                with at((p[0], p[1], p[2] + base), s=(mir, 1, 1)):
                    fn(RED if name != "lightbar" else None)
                    rk.marker((0, 0, 0), {"exhaust": "exhaust", "side": "side"}.get(kind, kind))
    return (label, f)


def wheel_cell(kind):
    def f():
        with at((0, 0, 0), rz=DISPLAY_RZ - 50):
            if kind == "treads":
                _tread(0.21, 0.22, RED, y0=-0.32, y1=0.32)
                with at((0, 0, 0.21)):
                    pass
                return
            if kind in ("hover", "skis", "thruster"):
                with at((0, 0, 0), s=2.0):
                    with at((0, 0, 0.21)):
                        wheel(kind, 0.21, 0.17, acc=RED, side=1, centred=True)
                return
            r = 0.21 * WHEELS[kind][1]
            w = 0.17 * WHEELS[kind][2]
            lift = r if kind not in ("hover", "thruster", "skis") else 0.21
            with at((0, 0, lift)):
                wheel(kind, r, w, acc=RED, side=1, centred=True)
    return (WHEELS[kind][3], f)


def driver_cell(style, suit, helm, acc):
    def f():
        with at((0, 0, 0.0), rz=DISPLAY_RZ + 10):
            box((0.24, 0.22, 0.12), (0, 0.0, 0.06), CHAR, bevel=0.02)
            box((0.24, 0.05, 0.26), (0, 0.12, 0.18), CHAR, bevel=0.02, rx=-10)
            with at((0, 0, 0.13)):
                driver(style, suit=suit, helm=helm, acc=acc)
    return f


COLOURWAYS = [
    ("Red", dict(main=RED, acc=WHITE)), ("Yellow", dict(main=YEL, acc=CHAR)), ("Teal", dict(main=TEAL, acc=WHITE)),
    ("Blue", dict(main=BLUE, acc=WHITE)), ("White", dict(main=WHITE, acc=RED)), ("Orange", dict(main=ORANGE, acc=CHAR)),
    ("Red / yellow roof", dict(main=RED, acc=YEL, roof=YEL)), ("Blue / orange roof", dict(main=BLUE, acc=ORANGE, roof=ORANGE)),
    ("Teal / white roof", dict(main=TEAL, acc=ORANGE, roof=WHITE)), ("Charcoal / yellow", dict(main=CHAR, acc=YEL, roof=YEL)),
    ("White / blue roof", dict(main=WHITE, acc=BLUE, roof=BLUE)), ("Yellow / teal roof", dict(main=YEL, acc=TEAL, roof=TEAL)),
]

SHOWCASE = [
    ("Red Fang", dict(ch="coupe", body="race", wheels="slick", bolts=("wing", "rocket", "twinpipe"), helmet=1, suit=WHITE, helm=RED, hacc=WHITE,
                      decals=(("number", 7),))),
    ("Mud Daddy", dict(ch="monster", body="jeep", bolts=("bullbar", "rack", "stack", "antenna"), helmet=3, suit=BLUE, helm=ORANGE, hacc=CHAR)),
    ("Bad Cop", dict(ch="coupe", body="police", wheels="knobbly", bolts=("lightbar", "ram", "cannons", "twinpipe"))),
    ("Snow Dog", dict(ch="hatchback", body="hotdog", wheels="skis", bolts=("antenna", "nitro"), helmet=5, suit=TEAL, helm=WHITE, hacc=RED)),
    ("Hammerhead", dict(ch="hover", body="shark", bolts=("cannons", "jet"), helmet=4, suit=CHAR, helm=YEL, hacc=RED)),
    ("Lunar Pod", dict(ch="hatchback", body="bubble", wheels="thruster", bolts=("antenna", "rocket"), paint=dict(main=WHITE, acc=ORANGE))),
    ("Tub Thumper", dict(ch="kart", body="bathtub", bolts=("nitro", "shield"), helmet=2)),
    ("Mr Whippy GT", dict(ch="van", body="icecream", wheels="spoke", bolts=("siren", "chromebar", "fins"))),
    ("Field Marshal", dict(ch="tank", body="tractor", bolts=("cowcatcher", "scoop", "stack"), helmet=3, suit=YEL, helm=TEAL, hacc=WHITE)),
    ("Hot Rod Cab", dict(ch="hatchback", body="taxi", wheels="whitewall", bolts=("ducktail", "zoomie", "scoop"))),
    ("Dust Devil", dict(ch="buggy", body="rally", bolts=("gtwing", "rack", "bullbar"), decals=(("number", 42),))),
    ("Moto Max", dict(ch="bike", wheels="knobbly", bolts=("rocket", "twinpipe", "antenna"), paint=dict(main=TEAL, acc=YEL), helmet=1, suit=TEAL, helm=YEL, hacc=CHAR)),
]

BOARDS = [
    ("01-chassis", "Bolt-On Racers: chassis", {"note": "11 rolling chassis, bare (deck plate + seat show where the body shell goes). Classes: S kart/hatchback/bike/trike/hover, M buggy/coupe/monster, L pickup/van/tank."}, [
        ("Small class (S)", [(CHASSIS[k]["label"], V_(ch=k, rider=False)) for k in ("kart", "hatchback", "bike", "trike", "hover")]),
        ("Medium (M) and large (L) classes", [(CHASSIS[k]["label"] + f" ({CHASSIS[k]['cls']})", V_(ch=k, rider=False)) for k in ("buggy", "coupe", "monster", "pickup", "van", "tank")]),
    ]),
    ("02-anatomy", "Bolt-On Racers: chassis anatomy (snap points)", {"note": "Yellow wheel, red body, green seat, blue roof, orange front, purple rear, pink tail, black exhaust, teal side, white hood, brown mast"}, [
        ("Chassis snaps (wheels hidden)", [(CHASSIS[k]["label"], V_(ch=k, rider=False, show_wheels=False, markers="chassis")) for k in ("kart", "coupe", "monster", "bike", "trike", "tank")]),
        ("Body-shell snaps (shell scaled to the class deck)", [
            ("Race car on coupe", V_(ch="coupe", body="race", rider=False, markers="body")),
            ("Police on coupe", V_(ch="coupe", body="police", rider=False, markers="body")),
            ("Ice-cream van on van", V_(ch="van", body="icecream", rider=False, markers="body")),
            ("Bubble on hatchback", V_(ch="hatchback", body="bubble", rider=False, markers="body")),
            ("Bathtub on kart", V_(ch="kart", body="bathtub", rider=False, markers="body")),
        ]),
    ]),
    ("03-bodies", "Bolt-On Racers: body shells", {"note": "14 shells, each on its default chassis. One shell is authored once and scales to the S / M / L deck, so it fits every chassis (bike excepted)."}, [
        ("Shells 1-7", [(BODIES[b][1] + " / " + CHASSIS[BODIES[b][3]]["label"].lower(),
                         V_(ch=BODIES[b][3], body=b, helmet=i % 6, bolts=("lightbar",) if b == "police" else ())) for i, b in enumerate(BODY_ORDER[:7])]),
        ("Shells 8-14", [(BODIES[b][1] + " / " + CHASSIS[BODIES[b][3]]["label"].lower(),
                          V_(ch=BODIES[b][3], body=b, helmet=(i + 3) % 6)) for i, b in enumerate(BODY_ORDER[7:])]),
        ("Fit test: the race car shell on every class", [(CHASSIS[k]["label"], V_(ch=k, body="race")) for k in ("kart", "hatchback", "hover", "coupe", "buggy", "monster", "pickup", "tank")]),
    ]),
    ("04-wheels", "Bolt-On Racers: wheels & movement", {"note": "10 movement parts. Each mounts on the hub flange of a wheel snap; bigger or smaller wheels lift or drop the whole car so it still sits on the ground."}, [
        ("Rolling wheels", [wheel_cell(k) for k in ("slick", "knobbly", "monster", "spoke", "whitewall", "stubby")]),
        ("Movement parts (non-tread parts shown 2x)", [wheel_cell(k) for k in ("hover", "treads", "skis", "thruster")]),
        ("One car, every wheel", [(WHEELS[k][3], V_(ch="coupe", body="muscle", wheels=k)) for k in WHEELS]),
    ]),
    ("05-boltons", "Bolt-On Racers: bolt-ons", {"shared": False, "note": "23 bolt-ons, each shown alone with its snap bead. Every bolt-on fits every shell; it scales with the chassis class."}, [
        ("Spoilers (rear)", [part_cell(n) for n in ("wing", "ducktail", "gtwing", "biplane", "fins")]),
        ("Bumpers (front)", [part_cell(n) for n in ("chromebar", "bullbar", "ram", "cowcatcher")]),
        ("Exhausts (exhaust_L / R)", [part_cell(n) for n in ("twinpipe", "trumpet", "stack", "zoomie")]),
        ("Boosters (tail) + roof + mast", [part_cell(n) for n in ("rocket", "nitro", "jet", "rack", "siren", "lightbar", "antenna")]),
        ("Hood, side, front", [part_cell(n) for n in ("scoop", "cannons", "shield")]),
        ("One muscle car wearing them", [
            ("Street", V_(ch="coupe", body="muscle", bolts=("ducktail", "chromebar", "twinpipe", "scoop"))),
            ("Drag", V_(ch="coupe", body="muscle", bolts=("gtwing", "zoomie", "scoop", "nitro"))),
            ("Patrol", V_(ch="coupe", body="muscle", bolts=("lightbar", "bullbar", "antenna"))),
            ("Road trip", V_(ch="coupe", body="muscle", bolts=("rack", "chromebar", "trumpet", "fins"))),
            ("Battle", V_(ch="coupe", body="muscle", bolts=("cannons", "shield", "rocket", "biplane", "siren"))),
            ("Farm", V_(ch="coupe", body="muscle", bolts=("cowcatcher", "stack", "jet", "wing"))),
        ]),
    ]),
    ("06-drivers", "Bolt-On Racers: drivers", {"note": "One chibi helmeted bean, one seated pose. 6 helmet styles, any suit / helmet colour. Visor only, no face."}, [
        ("Helmet styles", [(HELMETS[i], driver_cell(i, *cols)) for i, cols in enumerate(
            ((RED, WHITE, BLUE), (WHITE, RED, CHAR), (TEAL, WHITE, YEL), (BLUE, ORANGE, CHAR), (CHAR, YEL, RED), (ORANGE, WHITE, TEAL)))]),
        ("Same pose in every seat", [
            ("Kart", V_(ch="kart", helmet=0)), ("Bike", V_(ch="bike", helmet=3, suit=BLUE, helm=ORANGE, hacc=CHAR)),
            ("Trike", V_(ch="trike", helmet=2, suit=TEAL)), ("Race car", V_(ch="coupe", body="race", helmet=1, suit=WHITE, helm=RED, hacc=WHITE)),
            ("Jeep", V_(ch="buggy", body="jeep", helmet=4, suit=CHAR, helm=YEL, hacc=RED)), ("Rocket", V_(ch="hover", body="rocket", helmet=5, suit=ORANGE, helm=WHITE, hacc=TEAL)),
            ("Bathtub", V_(ch="kart", body="bathtub", helmet=2)), ("Tractor", V_(ch="pickup", body="tractor", helmet=3, suit=BLUE, helm=YEL, hacc=CHAR)),
        ]),
    ]),
    ("07-paint", "Bolt-On Racers: paint & decals", {"note": "12 colourways (main / accent / roof) from the toy palette. Decals are thin coloured slabs; stripes drape over the shell by ray cast, so they fit any body."}, [
        ("Colourways 1-6", [(n, V_(ch="coupe", body="muscle", paint=p)) for n, p in COLOURWAYS[:6]]),
        ("Colourways 7-12", [(n, V_(ch="coupe", body="muscle", paint=p)) for n, p in COLOURWAYS[6:]]),
        ("Decals", [
            ("Racing number", V_(ch="coupe", body="muscle", paint=dict(main=BLUE, acc=WHITE), decals=(("number", 8),))),
            ("Racing stripes", V_(ch="coupe", body="muscle", paint=dict(main=RED, acc=WHITE), decals=(("stripes", WHITE),))),
            ("Flames", V_(ch="coupe", body="muscle", paint=dict(main=CHAR, acc=ORANGE), decals=(("flames",),))),
            ("Side stripe", V_(ch="coupe", body="muscle", paint=dict(main=TEAL, acc=WHITE), decals=(("sidestripe", WHITE),))),
            ("Checker band", V_(ch="coupe", body="muscle", paint=dict(main=YEL, acc=CHAR), decals=(("checker",),))),
            ("Full livery", V_(ch="coupe", body="muscle", paint=dict(main=WHITE, acc=BLUE), decals=(("stripes", BLUE), ("number", 23, YEL)))),
            ("Number on rally", V_(ch="buggy", body="rally", decals=(("number", 5),))),
            ("Stripes on rocket", V_(ch="hover", body="rocket", paint=dict(main=BLUE, acc=WHITE), decals=(("stripes", YEL),))),
        ]),
    ]),
    ("08-damage", "Bolt-On Racers: damage", {"note": "Clean -> dented (crumpled panels, bent bumper, cambered wheel) -> smoking wreck (wheel off, door off, hood popped, smoke). Overlays work on any shell."}, [
        ("Race car", [(s, V_(ch="coupe", body="race", bolts=("wing", "chromebar"), damage=i, debris=(i == 2))) for i, s in enumerate(("Clean", "Dented", "Wreck"))]),
        ("Police", [(s, V_(ch="coupe", body="police", bolts=("lightbar", "bullbar"), damage=i, debris=(i == 2))) for i, s in enumerate(("Clean", "Dented", "Wreck"))]),
        ("Ice-cream van", [(s, V_(ch="van", body="icecream", bolts=("chromebar", "antenna"), damage=i, debris=(i == 2))) for i, s in enumerate(("Clean", "Dented", "Wreck"))]),
        ("Loose debris", [
            ("Wheel", lambda: parts.loose_wheel("slick", RED)), ("Door", lambda: parts.door_piece(RED)), ("Bumper", parts.bumper_piece),
            ("Bolts", lambda: [_place(lambda i=i: parts.bolt_piece(i, s=2.2), (i * 0.24 - 0.24, (i % 2) * 0.15, 0.035), rx=90 if i else 0) for i in range(3)]),
            ("Nuts", lambda: [_place(lambda: parts.nut_piece(2.2), (i * 0.2 - 0.2, (i % 2) * 0.14, 0)) for i in range(3)]),
            ("Hubcap", lambda: _place(lambda: parts.hubcap_piece(2.0), (0, 0, 0.0), rx=12)),
            ("Smoke puff", lambda: parts.smoke((0, 0, 0.05), n=6)),
        ]),
    ]),
    ("09-showcase", "Bolt-On Racers: 12 example racers", {"note": "Built only from the parts on the other boards: chassis + wheels + shell + bolt-ons + driver + paint."}, [
        ("Racers 1-6", [(n, V_(**kw)) for n, kw in SHOWCASE[:6]]),
        ("Racers 7-12", [(n, V_(**kw)) for n, kw in SHOWCASE[6:]]),
    ]),
    ("10-track-optional", "Bolt-On Racers: track kit (OPTIONAL)", {"shared": False, "note": "Optional add-on, not decided yet. Same chunky style; road tiles are 2.4 wide (two M cars abreast)."}, [
        ("Road", [(n, f) for n, f in track.TRACK[:5]]),
        ("Trackside", [(n, f) for n, f in track.TRACK[5:]]),
    ]),
]


def _place(fn, loc, rx=0):
    with at(loc, rx=rx):
        fn()


if __name__ == "__main__":
    kit.run(BOARDS)
