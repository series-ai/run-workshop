"""Wheel modules that socket onto a body.

Axle modules hang from a body's `socket-axle-f` / `socket-axle-r`; a tread
module hangs from `socket-belly`. A module's origin is its mount point (the
top of its mount plate, touching the body underside), +Y up, front -Z.
`drop` is the height of the mount above the ground at rest.

Moving parts, so suspension can be driven at runtime or keyed in clips:
- `axle-<t>`: the beam, hubs and wheels; slides up/down as the body bounces.
- `wheel-<t>…`: children of the axle; spin about x.
- `spring-<t>l` / `spring-<t>r`: pivot at the top; scale y to stretch/squash.
For treads the `track-l` / `track-r` units play the axle role (they stay on
the ground while the hull rides on the body).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from gear import _road_wheel, coil, knobby_tyre, slick_tyre
from kit import AK, TX, WB, C, Grid, P, Part, box, coords, ngon, radial
from pnshapes import bar, last

GW = 96
XC = GW // 2


@dataclass
class Module:
    root: Part
    drop: float  # mount height above the ground at rest
    radius: float  # main wheel radius
    spring: float = 0.0  # spring rest length (0: no springs)
    meta: dict = field(default_factory=dict)


def _plate(g: Grid, top: int, half: int, zc: int, d: int = 5, ramp="steel", rails: bool = True) -> np.ndarray:
    """Mount plate: a riveted crossmember right under the body plus two short
    frame rail stubs, so the module visibly bolts onto the underside."""
    m = box(g, XC - half, top - 4, zc - d, XC + half, top, zc + d, ramp, 3)
    P.plates(g, m, ramp, 3, size=(6, 4), seed=1)
    for sx in (-1, 1) if rails else ():
        m |= box(g, XC + sx * 11 - 2, top - 3, zc - d - 3, XC + sx * 11 + 2, top, zc + d + 3, ramp, 2)
    return m


# radius, width, track half, mount height, spring colour, rim colour
SPECS = {
    "monster": dict(R=22, W=18, TX=TX, drop=54, spring_ramp="orange", rim=("orange", 5)),
    "tractor": dict(R=21, W=16, TX=34, drop=22, spring_ramp="red", rim=("steel", 5)),
    "wire": dict(R=9, W=6, TX=24, drop=16, spring_ramp="red", rim=("steel", 6)),
    "steel": dict(R=13, W=11, TX=26, drop=20, spring_ramp="steel", rim=("steel", 4)),
    "spiked": dict(R=14, W=12, TX=27, drop=24, spring_ramp="iron", rim=("iron", 3)),
    "slick": dict(R=17, W=22, TX=31, drop=26, spring_ramp="red", rim=("steel", 6)),
    "balloon": dict(R=21, W=20, TX=31, drop=32, spring_ramp="gold", rim=("gold", 5)),
    "chained": dict(R=20, W=16, TX=30, drop=48, spring_ramp="red", rim=("red", 4)),
}
# Motorcycle wheels: single only (mono-road etc.), drawn at bike size, never paired on a car axle.
MOTO = {
    "road": dict(R=13, W=5, spring_ramp="steel", rim=("steel", 6)),      # round-shouldered street tyre, chrome spokes
    "enduro": dict(R=14, W=5, spring_ramp="orange", rim=("steel", 6)),   # tall skinny knobby, spokes
    "scooter": dict(R=9, W=7, spring_ramp="steel", rim=("bone", 6)),     # small fat tyre on a solid split rim
}
COILED = ("monster", "chained", "balloon")  # coil-overs; the rest get plain struts / fork tubes


def _moto_wheel(wg: Grid, kind: str, cx, ay, zc, R, W, rim) -> None:
    """A motorcycle wheel: a round-shouldered tyre (a full-radius crown and
    narrower-radius shoulders), a chrome rim, wire spokes (or a solid split
    rim for the scooter), a drum hub and a brake disc on the left."""
    half = W / 2
    if kind == "enduro":
        knobby_tyre(wg, cx, ay, zc, R, W, lugs=22, depth=1.7, rim=rim, hub=("steel", 5))
    else:
        n = 22
        wg.prism("x", [(ay + v, zc + u) for u, v in ngon(0, 0, R, n, math.pi / n)], cx - half + 1, cx + half - 1, C("iron", 3))  # crown
        wg.prism("x", [(ay + v, zc + u) for u, v in ngon(0, 0, R - 1.3, n, math.pi / n)], cx - half, cx + half, C("iron", 3))  # shoulders
    m = wg.a > 0
    rr = radial(wg, "x", ay, zc)
    X, Y, Z = coords(wg)
    face = m & ((X < cx - half + 1) | (X >= cx + half - 1))
    rim_r = R * (0.66 if kind == "scooter" else 0.76)
    P.flat(wg, face & (rr > rim_r), "iron", 2)  # sidewall
    P.flat(wg, face & (rr <= rim_r) & (rr > rim_r - 1.4), *rim)  # rim
    inner = face & (rr <= rim_r - 1.4)
    if kind == "scooter":
        P.flat(wg, inner, rim[0], rim[1] - 1)
        ang = np.arctan2(Y + 0.5 - ay, Z + 0.5 - zc)
        P.flat(wg, inner & (rr > 2.2) & ((np.floor((ang + math.pi) / (2 * math.pi) * 5) % 2) == 0) & (rr < rim_r - 2.4), rim[0], rim[1] - 3)
    else:
        P.flat(wg, inner, "iron", 1)  # dark between the spokes
        ang = np.arctan2(Y + 0.5 - ay, Z + 0.5 - zc)
        # road: a cast five-spoke wheel (wide spokes read at game size); enduro: ten straight wire spokes
        nsp, width = (5, 0.16) if kind == "road" else (10, 0.07)
        arc = np.abs(((ang / (2 * math.pi) * nsp) % 1.0) - 0.5)  # 0.5 on a spoke's centre line
        spoke = (0.5 - arc) * 2 * math.pi / nsp * np.maximum(rr, 1) < width * R
        P.flat(wg, inner & (rr > 2.2) & spoke, "steel", 6 if kind == "road" else 5)
    for lo, hi in ((cx - half - 1.5, cx - half), (cx + half, cx + half + 1.5)):  # drum hub
        wg.prism("x", [(ay + v, zc + u) for u, v in ngon(0, 0, max(2.0, R * 0.22), 10, math.pi / 10)], lo, hi, C("steel", 4))
    disc = [(ay + v, zc + u) for u, v in ngon(0, 0, R * 0.45, 14, math.pi / 14)]
    wg.prism("x", disc, cx + half + 1.5, cx + half + 2.5, C("steel", 6))  # brake disc, left side
    dm = last(wg)
    P.flat(wg, dm & (radial(wg, "x", ay, zc) > R * 0.3) & ((coords(wg)[1] + coords(wg)[2]) % 3 == 0), "steel", 3)  # drilled


def _draw_wheel(wg: Grid, kind: str, spec: dict, cx, ay, zc, outboard=(1,)) -> None:
    """One wheel of `kind` centred at (cx, ay, zc), axle along x. Hub spikes
    and studs go on the `outboard` sides (+1 / -1)."""
    R, W = spec["R"], spec["W"]
    if kind in MOTO:
        _moto_wheel(wg, kind, cx, ay, zc, R, W, spec["rim"])
    elif kind in ("monster", "tractor", "chained"):
        knobby_tyre(wg, cx, ay, zc, R, W, lugs=13 if kind != "tractor" else 16, depth=3.6 if kind != "tractor" else 3.2,
                    rim=spec["rim"], hub=(spec["rim"][0], 3) if kind != "tractor" else ("red", 5))
        if kind == "chained":
            _chains(wg, cx, ay, zc, R, W)
    elif kind == "slick":
        slick_tyre(wg, cx, ay, zc, R, W, n=18, rim=spec["rim"], hub=("red", 5), mud=False)
        rr = radial(wg, "x", ay, zc)
        X = coords(wg)[0]
        face = (wg.a > 0) & ((X < cx - W / 2 + 1) | (X >= cx + W / 2 - 1))
        P.flat(wg, face & (rr > R * 0.66) & (rr < R * 0.66 + 1.3), "bone", 6)  # white sidewall ring
    elif kind == "balloon":
        _balloon(wg, cx, ay, zc, R, W, spec["rim"])
    elif kind == "spiked":
        slick_tyre(wg, cx, ay, zc, R, W, n=12, rim=("iron", 3), hub=("steel", 6))
        P.flat(wg, (wg.a > 0) & (radial(wg, "x", ay, zc) > R - 1.4), "iron", 2)
        for sx in outboard:
            # a big faceted spike out of the hub, pointing outboard
            face_x = cx + sx * (W / 2 + 1)
            tip = [(ay + v, zc + u) for u, v in ngon(0, 0, 0.5, 8)]
            base = [(ay + v, zc + u) for u, v in ngon(0, 0, 3.4, 8)]
            if sx > 0:
                wg.prism("x", base, face_x, face_x + 9, C("steel", 6), top=tip)
            else:
                wg.prism("x", tip, face_x - 9, face_x, C("steel", 6), top=base)
            for k in range(6):  # studs round the rim
                a = 2 * math.pi * k / 6
                yy, zz = ay + math.sin(a) * R * 0.62, zc + math.cos(a) * R * 0.62
                sface = cx + sx * (W / 2)
                lo, hi = (sface, sface + 3) if sx > 0 else (sface - 3, sface)
                wg.prism("x", [(yy + v, zz + u) for u, v in ngon(0, 0, 1.2, 6)], lo, hi, C("steel", 5))
    elif kind == "wire":
        slick_tyre(wg, cx, ay, zc, R, W, n=12, spokes=10, rim=spec["rim"], hub=("red", 5))
    else:  # studded steel discs: a slick carcass, a plain dished disc with stud bolts
        slick_tyre(wg, cx, ay, zc, R, W, n=14, rim=("steel", 4), hub=("steel", 6))
        rr = radial(wg, "x", ay, zc)
        X, Y, Z = coords(wg)
        face = (wg.a > 0) & ((X < cx - W / 2 + 1) | (X >= cx + W / 2 - 1))
        ang = np.arctan2(Y + 0.5 - ay, Z + 0.5 - zc)
        P.flat(wg, face & (rr < R * 0.6) & (rr > R * 0.6 - 2.2) & ((np.floor((ang + math.pi) / (2 * math.pi) * 12) % 2) == 0), "steel", 6)
        P.flat(wg, face & (rr > R - 1.4), "iron", 2)


def _leg(sg: Grid, kind: str, spec: dict, x, zc, bot, top) -> None:
    """A suspension leg: coil-over for the tall kinds, a plain strut else."""
    if kind in COILED:
        coil(sg, x - 3, x + 3, zc - 3, zc + 3, bot, top, ramp=spec["spring_ramp"])
    else:
        st = box(sg, x - 1.5, bot, zc - 1.5, x + 1.5, top, zc + 1.5, "steel", 4)
        P.flat(sg, st & (coords(sg)[1] % 4 == 0), "steel", 2)


def axle_module(kind: str, tag: str) -> Module:
    """A pair of wheels on a beam axle. `kind`: one of AXLE_KINDS; a
    `mono-<kind>` is one centred wheel in a fork (see mono_module). `tag`:
    'f', 'r' or 't' (part names)."""
    if kind.startswith("mono-"):
        return mono_module(kind[5:], tag)
    spec = SPECS[kind]
    R, W, tx, drop = spec["R"], spec["W"], spec["TX"], spec["drop"]
    gh = int(max(drop, 2 * R) + 8)
    gd = 2 * R + 10
    zc = gd // 2
    ay = R  # axle height above the ground
    frame = Grid(GW, gh, gd)
    _plate(frame, drop, 16, zc)
    # the axle beam, a diff pumpkin, hubs out to the wheels
    axle = Grid(GW, gh, gd)
    inner = tx - W / 2 - 1
    box(axle, XC - inner, ay - 2, zc - 2, XC + inner, ay + 2, zc + 2, "steel", 3)
    axle.prism("z", [(XC + u, ay + v) for u, v in ngon(0, 0, 4.5 if R > 12 else 3, 8, math.pi / 8)], zc - 3, zc + 3, C("steel", 4))
    AK.rust_patches(axle, 3, 4, from_ramps=("steel",), rmin=0.8, rmax=1.5)
    root = Part(f"{kind}-{tag}", None, pivot=(XC, drop, zc))
    root.add(Part(f"frame-{tag}", frame, pivot=(XC, drop, zc), at=(0, 0, 0)))
    ax = root.add(Part(f"axle-{tag}", axle, pivot=(XC, ay, zc), at=(0, ay - drop, 0)))
    for sx, side in ((-1, "r"), (1, "l")):  # +x is the vehicle's left
        wg = Grid(GW, gh, gd)
        cx = XC + sx * tx
        _draw_wheel(wg, kind, spec, cx, ay, zc, outboard=(sx,))
        ax.add(Part(f"wheel-{tag}{side}", wg, pivot=(cx, ay, zc), at=(cx - XC, 0, 0), meta={"radius": R}))
    # suspension: `spring-*` parts pivoted at the top, so a rig can stretch
    # them (also to hang a small axle lower when a body is raked).
    top = drop - 2
    bot = min(ay + 2, top - 4)
    spring = float(top - bot)
    for sx, side in ((-1, "r"), (1, "l")):
        sg = Grid(GW, gh, gd)
        x = XC + sx * (min(tx - W / 2 - 4, 17) if kind in COILED else (tx - W / 2 - 3))
        _leg(sg, kind, spec, x, zc, bot, top)
        root.add(Part(f"spring-{tag}{side}", sg, pivot=(x, top, zc), at=(x - XC, top - drop, 0)))
    return Module(root, drop, R, spring, {"kind": kind, "track": tx, "width": W})


RAKE = math.radians(27)  # front fork rake


def _fender(g: Grid, cx, ay, zc, R, W, a0, a1, ramp="iron", shade=3) -> np.ndarray:
    """A thin fender arc over a single tyre from angle a0 to a1 (radians,
    measured from +z toward +y), extruded across the tyre width."""
    r0, r1 = R + 1.2, R + 3.0
    ts = np.linspace(a0, a1, 9)
    outer = [(ay + r1 * math.sin(t), zc + r1 * math.cos(t)) for t in ts]
    inner = [(ay + r0 * math.sin(t), zc + r0 * math.cos(t)) for t in ts[::-1]]
    g.prism("x", outer + inner, cx - W / 2 - 1.5, cx + W / 2 + 1.5, C(ramp, shade))
    return last(g)


def mono_module(kind: str, tag: str) -> Module:
    """One centred, bike-sized wheel: the motorcycle and trike axle.

    Front ('f'): a raked telescopic fork. Chrome stanchions run down from a
    triple clamp at the mount; the sliders, the axle and a front fender ride
    with the wheel, which sits ahead of the mount (the bike's trail).
    Rear ('r'): a swingarm from a pivot plate under the mount back to the
    wheel, with twin coil shocks and a rear fender riding on the arm, so the
    wheel trails behind the mount. Trailer ('t'): the wheel straight under
    the mount in a short fork. The mount sits just above the tyre, so the
    bike body clears every wheel size and its belly stays between the wheels.
    """
    if kind in MOTO:  # motorcycle wheels are drawn at bike size
        spec = dict(MOTO[kind])
    else:  # bike-sized: about 60% of the car wheel of the same kind
        spec = dict(SPECS[kind])
        spec["R"], spec["W"] = max(6, round(spec["R"] * 0.6)), max(4, round(spec["W"] * 0.65))
    R, W = spec["R"], spec["W"]
    drop = 2 * R + 4  # mount (fork crown / pivot plate) just above the tyre
    ay = R
    fx = W / 2 + 2.5  # fork legs / swingarm tubes either side of the tyre
    crown = drop - 1.5
    trail = (crown - ay) * math.tan(RAKE) if tag == "f" else 0.0
    arm = 1.3 * R + 6 if tag == "r" else 0.0
    off = -trail if tag == "f" else arm  # wheel centre relative to the mount, along z
    gh = int(drop + 8)
    gd = int(2 * (R + max(trail, arm)) + 18)
    zc = gd // 2
    wz = zc + off
    name = f"mono-{kind}"
    root = Part(f"{name}-{tag}", None, pivot=(XC, drop, zc))
    frame = Grid(GW, gh, gd)
    axle = Grid(GW, gh, gd)
    springs = []
    box(axle, XC - fx - 1.5, ay - 1.5, wz - 1.5, XC + fx + 1.5, ay + 1.5, wz + 1.5, "steel", 5)  # axle through the hub
    if tag == "f":
        box(frame, XC - fx - 2.5, crown - 1.5, zc - 3, XC + fx + 2.5, drop, zc + 3, "steel", 5)  # triple clamp
        dz = math.tan(RAKE)
        mid = ay + 0.55 * (crown - ay)  # stanchions reach down to here, sliders up past it
        for sx in (-1, 1):
            x = XC + sx * fx
            bar(frame, "x", (crown, zc), (mid - 1, zc - (crown - mid + 1) * dz), 2.6, x - 1.2, x + 1.2, "steel", 6)  # chrome stanchion
            top = mid + 0.45 * (crown - ay) * 0.5
            bar(axle, "x", (ay, wz), (top, wz + (top - ay) * dz), 3.6, x - 1.8, x + 1.8, "iron", 3)  # slider
            box(axle, x - 2, ay - 2.5, wz - 2.5, x + 2, ay + 2.5, wz + 2.5, "iron", 2)  # fork foot
        fen = _fender(axle, XC, ay, wz, R, W, math.radians(75), math.radians(160))  # front fender, over the top and forward
    elif tag == "r":
        py, pz = ay + 0.45 * R, zc - 1.5  # swingarm pivot, under the mount
        frame.prism("x", [(drop, zc - 3.5), (drop, zc + 3.5), (py - 2.5, pz + 3), (py - 2.5, pz - 3)], XC - fx - 2, XC + fx + 2, C("steel", 3))  # pivot plate
        box(frame, XC - fx - 2.5, py - 1.5, pz - 1.5, XC + fx + 2.5, py + 1.5, pz + 1.5, "steel", 5)  # pivot bolt
        for sx in (-1, 1):
            x = XC + sx * fx
            bar(axle, "x", (py, pz), (ay, wz), 3.2, x - 1.4, x + 1.4, "iron", 3)  # swingarm tube
        box(axle, XC - fx - 1.4, py - 1.6, pz - 1, XC + fx + 1.4, py + 1.6, pz + 4, "iron", 3)  # arm cross brace at the pivot
        _fender(axle, XC, ay, wz, R, W, math.radians(40), math.radians(175))  # rear fender, over the top and back
        # twin shocks from the arm (at 60% of its length) up to the mount
        sz = pz + 0.6 * (wz - pz)
        sy = py + 0.6 * (ay - py) + 2
        top = drop - 1
        for sx, side in ((-1, "r"), (1, "l")):
            x = XC + sx * (fx + 1)
            box(frame, x - 2, top, sz - 2, x + 2, drop + 1, sz + 2, "steel", 4)  # top mount
            sg = Grid(GW, gh, gd)
            coil(sg, x - 2, x + 2, sz - 2, sz + 2, sy, top, ramp=spec["spring_ramp"]) if kind in COILED + ("road", "enduro") else \
                box(sg, x - 1.5, sy, sz - 1.5, x + 1.5, top, sz + 1.5, "steel", 4)
            springs.append((f"spring-{tag}{side}", sg, x, top, sz))
        box(frame, XC - fx - 3, drop - 2.5, sz - 2, XC + fx + 3, drop, sz + 2, "steel", 4)  # shock cross bar
    else:  # trailer: the old short fork, wheel straight under the mount
        box(frame, XC - fx - 2, drop - 3, zc - 2.5, XC + fx + 2, drop, zc + 2.5, "steel", 5)
        for sx in (-1, 1):
            x = XC + sx * fx
            box(frame, x - 1.5, ay + 2, zc - 1.5, x + 1.5, drop - 3, zc + 1.5, "steel", 4)
            box(axle, x - 2, ay - 3, zc - 3, x + 2, ay + 3, zc + 3, "steel", 3)
        _fender(axle, XC, ay, zc, R, W, math.radians(25), math.radians(155))
    root.add(Part(f"frame-{tag}", frame, pivot=(XC, drop, zc), at=(0, 0, 0)))
    ax = root.add(Part(f"axle-{tag}", axle, pivot=(XC, ay, zc), at=(0, ay - drop, 0)))
    wg = Grid(GW, gh, gd)
    _draw_wheel(wg, kind, spec, XC, ay, wz, outboard=(-1, 1))
    ax.add(Part(f"wheel-{tag}c", wg, pivot=(XC, ay, wz), at=(0, 0, wz - zc), meta={"radius": R}))
    spring = 0.0
    for nm, sg, x, top, sz in springs:
        root.add(Part(nm, sg, pivot=(x, top, sz), at=(x - XC, top - drop, sz - zc)))
        spring = float(top - (py + 0.6 * (ay - py) + 2))
    return Module(root, drop, R, spring, {"kind": name, "width": W, "single": True, "offset": off})


def tread_module(cls: str) -> Module:
    """Two rusty tracks joined by a riveted tank hull tub under the body."""
    from voxgrid import _inside_polygon

    TW, TH = 18, 34
    r = TH / 2
    drop = TH + 6
    L = WB[cls] + 2 * r + 6
    gd = int(L + 12)
    zc = gd // 2
    gh = drop + 4
    root = Part(f"treads-{cls}", None, pivot=(XC, drop, zc))
    # hull: a tub between the tracks with a sloped glacis front and back
    hull = Grid(GW, gh, gd)
    hx = TX - TW // 2  # reaches the tracks' inner faces
    hz = L / 2 - 4
    hull.prism("x", [(10, zc - hz + 8), (drop - 4, zc - hz), (drop - 4, zc + hz), (10, zc + hz - 8)], XC - hx, XC + hx, C("steel", 2))
    hm = hull.a > 0
    P.plates(hull, hm, "steel", 2, size=(10, 6), seed=4)
    from pnpaint import hazard as hz_paint

    X, Y, Z = coords(hull)
    hz_paint(hull, hm & (Z < zc - hz + 8 + (Y - 10) * -0.3 + 3) & (Y > 14) & (Y < 22), period=6, a=("gold", 5), b=("iron", 2))
    _plate(hull, drop, 16, zc - WB[cls] // 2)
    _plate(hull, drop, 16, zc + WB[cls] // 2)
    AK.rust_patches(hull, 5, 18, from_ramps=("steel",), rmin=1.0, rmax=2.6)
    root.add(Part("hull", hull, pivot=(XC, drop, zc), at=(0, 0, 0)))
    for sx, side in ((-1, "r"), (1, "l")):
        tg = Grid(GW, gh, gd)
        cx = XC + sx * TX
        x0, x1 = cx - TW / 2, cx + TW / 2
        za, zb = zc - L / 2 + r, zc + L / 2 - r

        def stadium(rad, lift=3):
            pts = [(r + lift + rad * math.sin(math.pi / 2 + math.pi * k / 10), za + rad * math.cos(math.pi / 2 + math.pi * k / 10)) for k in range(11)]
            pts += [(r + rad * math.sin(-math.pi / 2 + math.pi * k / 10), zb + rad * math.cos(-math.pi / 2 + math.pi * k / 10)) for k in range(11)]
            return [(max(0.0, y), z) for y, z in pts]

        tg.prism("x", stadium(r), x0, x1, C("rust", 3))
        t = tg.a > 0
        X, Y, Z = coords(tg)
        inside = _inside_polygon(Y + 0.5, Z + 0.5, stadium(r - 3.5))
        band = t & ~inside
        mid = (Z + 0.5 >= za) & (Z + 0.5 <= zb)
        ang = np.where(Z + 0.5 < za, np.arctan2(Y + 0.5 - r, Z + 0.5 - za), np.arctan2(Y + 0.5 - r, Z + 0.5 - zb))
        along = np.where(mid, Z, (ang * r).astype(int) + 1000)
        P.flat(tg, band, "rust", 3)
        P.flat(tg, band & (along % 5 == 0), "iron", 2)
        P.flat(tg, band & (along % 5 == 2), "rust", 5)
        P.flat(tg, band & (Y < 4) & ((along + Y) % 3 != 0), "sand", 2)
        P.flat(tg, t & inside, "rust", 1)
        P.flat(tg, t & inside & ((Y + Z) % 6 == 0), "rust", 2)
        tp = root.add(Part(f"track-{side}", tg, pivot=(cx, r, zc), at=(cx - XC, r - drop, 0)))
        face_x = (x1, x1 + 2) if sx > 0 else (x0 - 2, x0)
        specs = [(za, r + 3, r - 4.5, True), (zb, r, r - 4.5, True)]
        n_bogie = max(2, int((zb - za - 2 * (r - 4.5)) // 12))
        for i in range(n_bogie):
            specs.append((za + (zb - za) * (i + 1) / (n_bogie + 1), 8.5, 6.5, False))
        for i, (wz, wy, rad, big) in enumerate(specs):
            wg = Grid(GW, gh, gd)
            _road_wheel(wg, face_x, wy, wz, rad, big)
            tp.add(Part(f"wheel-{side}{i}", wg, pivot=(face_x[0] + 1, wy, wz), at=(face_x[0] + 1 - cx, wy - r, wz - zc), meta={"radius": rad}))
    return Module(root, drop, r, 0.0, {"kind": "treads", "length": L})


def _chains(g: Grid, cx, cy, cz, r, w) -> None:
    """Snow chains: steel links in an X across the tread at every other lug."""
    X, Y, Z = coords(g)
    rr = radial(g, "x", cy, cz)
    ang = np.arctan2(Y + 0.5 - cy, Z + 0.5 - cz)
    u = (X + 0.5 - (cx - w / 2)) / w  # 0..1 across the tread
    a = ((ang + math.pi) / (2 * math.pi) * 6) % 1.0  # 6 chain bays round the tyre
    on = (g.a > 0) & (rr > r - 4.5) & ((np.abs(a - u) < 0.06) | (np.abs(a - (1 - u)) < 0.06) | (np.abs(u - 0.5) > 0.47))
    P.flat(g, on, "steel", 6)


def _balloon(g: Grid, cx, cy, cz, r, w, rim) -> None:
    """Fat round low-pressure tyre: a barrel of frustum slices, a small rim."""
    n = 16
    slices = 6
    for k in range(slices):
        x0, x1 = cx - w / 2 + w * k / slices, cx - w / 2 + w * (k + 1) / slices
        f = lambda x: r * (0.72 + 0.28 * math.sqrt(max(0.0, 1 - ((x - cx) / (w / 2)) ** 2)))  # noqa: E731
        ring = lambda rad: [(cy + v, cz + u) for u, v in ngon(0, 0, rad, n, math.pi / n)]  # noqa: E731
        g.prism("x", ring(f(x0)), x0, x1, C("iron", 3), top=ring(f(x1)))
    rr = radial(g, "x", cy, cz)
    X = coords(g)[0]
    tyre = g.a > 0
    P.flat(g, tyre & (rr > r * 0.9), "iron", 4)  # lit crown
    face = tyre & ((X < cx - w / 2 + 1) | (X >= cx + w / 2 - 1))
    P.flat(g, face & (rr < r * 0.42), *rim)
    P.flat(g, face & (rr < r * 0.42) & (rr > r * 0.42 - 1.2), rim[0], rim[1] - 2)
    P.flat(g, face & (rr < 2.2), "steel", 6)


AXLE_KINDS = ("monster", "tractor", "wire", "steel", "spiked", "slick", "balloon", "chained")
MONO_KINDS = tuple(f"mono-{k}" for k in tuple(MOTO) + AXLE_KINDS)  # one wheel in a fork: bikes and trikes
