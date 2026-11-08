"""Petite Victorian houses as a modular kit (the street-scene houses).

Parts, all fitted to any body width:
  body       narrow / medium / wide, two storeys, clapboard, corner boards
  roof       gable (the steep front gable with gingerbread, a finial and an
             arched attic window) / hip (a steep Queen Anne hip) / cross
             (the front gable crossed by a side gable, tucked back); all steep
  gingerbread  scallop / spindle / sunburst / pendant (front and wing gables)
  porch      left / centre / wrap (full width, wrapping down the left side)
  rail       plain (square balusters) / fancy (sawn balusters with a diamond bulge)
  extras     turret (front-right corner), bay (side bay window), wing (lower
             side wing with its own gable), dormer, chimney (outside brick
             chimney on the right wall, or on the wing's wall), balcony
             (small upper balcony over the porch), boxes (window boxes)
  palette    one of PALETTES

`make_house(seed_or_spec)` turns a seed (or a partial spec) into a valid spec
and builds it; `PRESETS` holds the four hand-made houses (house-a..d) and
`SEEDS` the twelve generated ones (house-01..12). Every house bakes into one
mesh with two draw calls (PALETTE + GLOW) and stays under 5,000 triangles.

    Blender -b -t 1 --factory-startup --python neighborhood/props/house.py -- neighborhood/renders [slug ...]
    Blender ... -- neighborhood/renders --plan     # print the specs only
"""
import math
import os
import random
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from kit import *  # noqa: E402,F403
import kit  # noqa: E402

TRIM = (0.96, 0.90, 0.78)
DECK = (0.80, 0.64, 0.47)
DARK_WIN = (0.18, 0.17, 0.25)
DOOR_INSET = (0.88, 0.42, 0.17)
KNOB = (0.25, 0.18, 0.12)
BRICK = (0.66, 0.33, 0.26)
SOOT = (0.30, 0.29, 0.31)
LEAF = (0.36, 0.52, 0.30)
FLOWERS = ((0.86, 0.42, 0.52), (0.96, 0.66, 0.28), (0.62, 0.42, 0.72))

# kid scale: a kid is ~5.5 tall, a door 2.6 x 4.2
D = 9.0                  # body depth (y)
Y0, Y1 = -3.0, 6.0       # front and back wall planes
F = 1.0                  # floor height (porch deck top)
WALL = 6.6               # wall height above the floor
DOOR_W, DOOR_H = 2.6, 4.2
PORCH_D = 3.4
POST_TOP = F + 4.9
SIDE_L = 3.6             # how far a wrap-around porch runs down the left side
BUDGET = 5000

WIDTHS = {"narrow": 8.0, "medium": 9.6, "wide": 11.2}
RISES = {"narrow": 6.9, "medium": 8.25, "wide": 9.6}   # same steep (witchy) pitch at every width
HIP_K = 0.8              # the hip is all roof: a little lower than the gable
PORCH_RISE = 1.45        # porch roof rise
GINGERBREAD = ("scallop", "spindle", "sunburst", "pendant")
RAILS = ("plain", "fancy")
# front windows per width: (x, glass width); "left" porch: door x, porch right end,
# windows under the porch and the window right of it
LAYOUT = {
    "narrow": dict(centre=[(-2.6, 1.2), (2.6, 1.2)], door_left=-1.75, px1_left=1.6,
                   in_left=[(0.75, 0.9)], out_left=[(2.9, 1.0)], back=2.0),
    "medium": dict(centre=[(-3.0, 1.4), (3.0, 1.4)], door_left=-2.15, px1_left=1.9,
                   in_left=[(0.45, 1.4)], out_left=[(3.2, 1.4)], back=2.4),
    "wide": dict(centre=[(-3.75, 1.6), (3.75, 1.6)], door_left=-2.95, px1_left=1.5,
                 in_left=[(0.05, 1.4)], out_left=[(3.55, 1.6)], back=2.9),
}

PALETTES = {
    "lavender": dict(body=(0.64, 0.56, 0.72), trim=TRIM, roof=(0.31, 0.19, 0.30)),    # plum roof
    "sage": dict(body=(0.58, 0.67, 0.52), trim=TRIM, roof=(0.22, 0.22, 0.26)),        # charcoal roof
    "mustard": dict(body=(0.86, 0.69, 0.32), trim=TRIM, roof=(0.34, 0.20, 0.28)),     # plum roof
    "slate": dict(body=(0.46, 0.56, 0.69), trim=TRIM, roof=(0.20, 0.21, 0.27)),       # charcoal roof
    "rose": dict(body=(0.82, 0.58, 0.60), trim=TRIM, roof=(0.37, 0.24, 0.20)),        # brown roof
    "teal": dict(body=(0.33, 0.58, 0.58), trim=TRIM, roof=(0.30, 0.18, 0.27)),        # plum roof
    "cream": dict(body=(0.91, 0.82, 0.60), trim=(0.47, 0.25, 0.34), roof=(0.40, 0.26, 0.21)),  # plum trim, brown roof
    "charcoal": dict(body=(0.36, 0.36, 0.41), trim=TRIM, roof=(0.36, 0.21, 0.30)),    # plum roof
}

EXTRAS = ("turret", "bay", "wing", "dormer", "chimney", "balcony", "boxes")

PRESETS = {
    "house-a": dict(width="medium", roof="gable", porch="left", bay=True, palette="lavender"),
    "house-b": dict(width="medium", roof="gable", porch="centre", palette="sage"),
    "house-c": dict(width="medium", roof="gable", porch="left", turret=True, palette="mustard"),
    "house-d": dict(width="medium", roof="gable", porch="centre", wing=True, palette="slate"),
}


def shade(rgb, k):
    return tuple(min(1.0, c * k) for c in rgb)


def rotv(dx, dy, ang):
    """Rotate a local (x, y) offset by ang around z."""
    c, s = math.cos(ang), math.sin(ang)
    return dx * c - dy * s, dx * s + dy * c


def wbox(cx, cy, z, ang, dx, dy, sx, sy, sz, rgb, bevel=0.0):
    """A box in a wall's local frame (local -y faces out of the wall; ang turns the frame around z)."""
    ox, oy = rotv(dx, dy, ang)
    return box(cx + ox, cy + oy, z, sx, sy, sz, rgb, bevel=bevel, rot=(0, 0, ang))


class _Null:
    def __enter__(self):
        pass

    def __exit__(self, *a):
        pass


# ---------------------------------------------------------------- windows and doors

def window(cx, cy, zc, ang, w, h, lit, trim, mull=True):
    """A window on a wall face at (cx, cy); ang 0 faces -y, pi/2 faces +x."""
    wbox(cx, cy, zc, ang, 0, -0.06, w + 0.36, 0.16, h + 0.36, trim)
    if lit:
        with glow():
            wbox(cx, cy, zc, ang, 0, -0.12, w, 0.1, h, GLOW_RGB)
    else:
        wbox(cx, cy, zc, ang, 0, -0.12, w, 0.1, h, DARK_WIN)
    if mull:
        wbox(cx, cy, zc, ang, 0, -0.17, 0.1, 0.06, h, trim)
        wbox(cx, cy, zc + h * 0.08, ang, 0, -0.17, w, 0.06, 0.1, trim)
    wbox(cx, cy, zc - h / 2 - 0.2, ang, 0, -0.2, w + 0.6, 0.3, 0.16, trim)  # sill
    wbox(cx, cy, zc + h / 2 + 0.24, ang, 0, -0.16, w + 0.6, 0.26, 0.2, trim)  # head


def window_box(cx, cy, zc, ang, w, h, c, k=0):
    """A planter under a window's sill with a row of flowers."""
    zt = zc - h / 2 - 0.36
    wbox(cx, cy, zt - 0.22, ang, 0, -0.42, w + 0.4, 0.5, 0.44, c.get("planter", shade(c["roof"], 1.25)))
    wbox(cx, cy, zt + 0.04, ang, 0, -0.42, w + 0.2, 0.36, 0.14, LEAF)
    for i, dx in enumerate((-w / 3, 0.0, w / 3)):
        ox, oy = rotv(dx, -0.42, ang)
        ball(cx + ox, cy + oy, zt + 0.16, 0.44, 0.4, 0.36, FLOWERS[(i + k) % 3], seg=6, ring=3)


def arched_window(cx, cy, z0, w, h, lit, trim):
    """A round-topped window facing -y, bottom at z0, total height h."""
    r = w / 2
    rect_h = h - r
    rot = (math.radians(90), math.radians(22.5), 0)  # spin about its own axis: flat top
    box(cx, cy - 0.05, z0 + rect_h / 2, w + 0.34, 0.14, rect_h, trim)
    can(cx, cy - 0.03, z0 + rect_h, r + 0.17, 0.14, trim, n=8, rot=rot)
    pane = GLOW_RGB if lit else DARK_WIN
    with (glow() if lit else _Null()):
        box(cx, cy - 0.12, z0 + rect_h / 2 + 0.05, w, 0.1, rect_h - 0.1, pane)
        can(cx, cy - 0.1, z0 + rect_h, r, 0.08, pane, n=8, rot=rot)
    box(cx, cy - 0.17, z0 + (rect_h + r * 0.7) / 2, 0.09, 0.06, rect_h + r * 0.7, trim)
    box(cx, cy - 0.2, z0 - 0.08, w + 0.5, 0.3, 0.16, trim)


def front_door(door_x, trim):
    """Trim frame, glowing door with orange panels, transom and knob."""
    box(door_x, Y0 - 0.08, F + (DOOR_H + 0.3) / 2, DOOR_W + 0.5, 0.18, DOOR_H + 0.3, trim)
    with glow():
        box(door_x, Y0 - 0.16, F + DOOR_H / 2, DOOR_W, 0.12, DOOR_H, GLOW_RGB)
        box(door_x, Y0 - 0.16, F + DOOR_H + 0.75, DOOR_W, 0.12, 0.5, GLOW_RGB)
    box(door_x, Y0 - 0.12, F + DOOR_H + 0.42, DOOR_W + 0.5, 0.2, 0.16, trim)
    box(door_x, Y0 - 0.12, F + DOOR_H + 1.1, DOOR_W + 0.7, 0.24, 0.2, trim)
    for s in (-1, 1):
        box(door_x + s * 0.6, Y0 - 0.24, F + 1.15, 0.85, 0.08, 1.5, DOOR_INSET)
    box(door_x, Y0 - 0.22, F + 2.15, DOOR_W, 0.08, 0.18, DOOR_INSET)
    box(door_x, Y0 - 0.24, F + 3.2, 0.12, 0.08, 1.8, DOOR_INSET)  # the upper glow reads as a two-light window
    box(door_x + 0.95, Y0 - 0.3, F + 2.0, 0.18, 0.18, 0.18, KNOB)


# ---------------------------------------------------------------- body and roofs

def roof_frame(cx, w, zw, rise):
    a = math.atan2(rise, w / 2)
    L = math.hypot(rise, w / 2)
    return a, L, (cx, zw + rise)


def walls(cx, yf, yb, w, z0, wall, c, ridges=True):
    """The box of the body with corner boards, frieze band and clapboard strips."""
    body, trim = c["body"], c["trim"]
    depth = yb - yf
    cy = (yf + yb) / 2
    box(cx, cy, z0 + wall / 2, w, depth, wall, body, bevel=0.06)
    zw = z0 + wall
    for sx in (-1, 1):
        for yy in (yf, yb):
            box(cx + sx * (w / 2 - 0.08), yy + (0.08 if yy == yb else -0.08), z0 + wall / 2, 0.36, 0.36, wall, trim)
    box(cx, cy, zw - 0.2, w + 0.12, depth + 0.12, 0.4, trim)
    if ridges:
        rc = shade(body, 0.86)
        for i in range(1, 6):
            z = z0 + i * wall / 6
            for sx in (-1, 1):
                box(cx + sx * (w / 2 + 0.03), cy, z, 0.08, depth - 0.5, 0.14, rc)
            box(cx, yb + 0.03, z, w - 0.5, 0.08, 0.14, rc)
            box(cx, yf - 0.03, z, w - 0.5, 0.08, 0.14, rc)


def gable_trim(style, rx, rz, y, a, L, w, rise, trim):
    """The gingerbread hung under a front gable's bargeboards (peak at rx, rz; trim plane y).
    scallop: diamond drops along the boards and a little king-post sunburst at the peak
    spindle: a Queen Anne spindle screen, a collar beam with beaded spindles up to the boards
    sunburst: a fan of rays from a half-round hub on a collar beam, filling the peak
    pendant: hanging drops with beads along the boards and a long drop from the peak"""
    ta = math.tan(a)
    z_under = rz - 0.4 / math.cos(a)        # underside of the bargeboards at the peak

    def under(x):
        return z_under - ta * abs(x - rx)

    def along(s, f, off):                   # a point f*L down side s, off below the board line
        return rx + s * math.cos(a) * f * L - s * math.sin(a) * off, rz - math.sin(a) * f * L - math.cos(a) * off

    d45 = (0, math.radians(45), 0)
    if style == "scallop":
        for s in (-1, 1):
            for i in range(7):
                px, pz = along(s, 0.12 + i * 0.13, 0.5)
                box(px, y, pz, 0.26, 0.1, 0.26, trim, rot=d45)
        dz = 1.7
        half = dz * (w / 2) / rise
        box(rx, y, rz - dz, 2 * half - 0.3, 0.14, 0.2, trim)
        box(rx, y, rz - dz / 2 - 0.1, 0.16, 0.14, dz, trim)
        for s in (-1, 1):
            box(rx + s * half * 0.45, y, rz - dz * 0.72, 0.1, 0.12, dz * 0.7, trim, rot=(0, s * math.radians(-38), 0))
    elif style == "spindle":
        zc = rz - min(2.7, rise * 0.45)
        hw = (z_under - zc) / ta
        box(rx, y, zc, 2 * hw + 0.1, 0.16, 0.26, trim)
        n = 7
        for i in range(n):
            x = rx - hw + (i + 0.5) * 2 * hw / n
            h = under(x) - zc
            if h < 0.3:
                continue
            box(x, y + 0.02, zc + h / 2, 0.1, 0.1, h, trim)
            box(x, y, zc + 0.12 + min(h * 0.45, 0.7), 0.2, 0.12, 0.2, trim, rot=d45)
        for i in range(1, n, 2):   # little drops under the collar
            box(rx - hw + (i + 0.5) * 2 * hw / n, y, zc - 0.3, 0.2, 0.1, 0.2, trim, rot=d45)
    elif style == "sunburst":
        zc = rz - min(3.2, rise * 0.48)
        hw = (z_under - zc) / ta
        box(rx, y, zc, 2 * hw + 0.1, 0.16, 0.24, trim)
        zh = zc + 0.12
        can(rx, y - 0.03, zh, 0.5, 0.14, trim, n=8, rot=(math.radians(90), math.radians(22.5), 0))
        for deg in (22, 48, 74, 90, 106, 132, 158):
            th = math.radians(deg)
            t = (z_under - zh) / (math.sin(th) + ta * abs(math.cos(th)))
            box(rx + math.cos(th) * t / 2, y + 0.02, zh + math.sin(th) * t / 2, t, 0.1, 0.12 if deg != 90 else 0.16,
                trim, rot=(0, -th, 0))
    elif style == "pendant":
        for s in (-1, 1):
            for i in range(5):
                px, pz = along(s, 0.2 + i * 0.16, 0.4)
                ln = 0.75 if i % 2 == 0 else 0.45
                box(px, y, pz - ln / 2, 0.09, 0.1, ln, trim)
                box(px, y, pz - ln - 0.08, 0.24, 0.1, 0.24, trim, rot=d45)
        box(rx, y, z_under - 0.8, 0.16, 0.14, 1.6, trim)
        box(rx, y, z_under - 1.75, 0.38, 0.12, 0.38, trim, rot=d45)
        box(rx, y, z_under - 0.45, 0.9, 0.12, 0.14, trim)


def gable_roof(cx, yf, yb, w, zw, rise, c, ov=0.55, ovy=0.5, finial=True, gingerbread="scallop"):
    """A steep front-to-back gable on walls topping out at zw, with its trim
    (gingerbread: one of GINGERBREAD, or None for a plain gable)."""
    body, roof, trim = c["body"], c["roof"], c["trim"]
    depth = yb - yf
    cy = (yf + yb) / 2
    prism(cx, cy, zw, w, rise, depth, body)
    a, L, (rx, rz) = roof_frame(cx, w, zw, rise)
    t = 0.38
    for s in (-1, 1):
        ux, uz = s * math.cos(a), -math.sin(a)
        nx, nz = s * math.sin(a), math.cos(a)
        k = (L + ov - 0.2) / 2 - 0.0
        box(rx + ux * (k - 0.1) + nx * t / 2, cy, rz + uz * (k - 0.1) + nz * t / 2,
            L + ov + 0.2, depth + 2 * ovy, t, roof, bevel=0.05, rot=(0, s * a, 0))
        # bargeboards front and back, just under the roof edge
        for yy, dy in ((yf - ovy + 0.12, -1), (yb + ovy - 0.12, 1)):
            m = (L + ov * 0.6) / 2
            box(rx + ux * m - nx * 0.2, yy, rz + uz * m - nz * 0.2, L + ov * 0.6, 0.16, 0.4, trim, rot=(0, s * a, 0))
    box(rx, cy, rz + 0.12, 0.45, depth + 2 * ovy + 0.1, 0.3, shade(roof, 0.8))  # ridge cap
    if gingerbread:
        gable_trim(gingerbread, rx, rz, yf - ovy + 0.14, a, L, w, rise, trim)
        # gable strips (clapboard continues up the gable face)
        rc = shade(body, 0.86)
        for i in range(1, int(rise * 0.55 / 1.1) + 1):
            z = zw + i * 1.1
            hw = (rise - (z - zw)) * (w / 2) / rise - 0.25
            box(cx, yf - 0.03, z, 2 * hw, 0.08, 0.14, rc)
    if finial:
        fy = yf - ovy + 0.25
        ball(rx, fy, rz + 0.45, 0.4, 0.4, 0.4, trim, seg=6, ring=4)
        can(rx, fy, rz + 1.3, 0.13, 1.6, trim, n=6, r2=0.0)
    return a


def gabled_mass(cx, yf, yb, w, z0, wall, rise, c, ov=0.55, ovy=0.5, finial=True, gingerbread="scallop", ridges=True):
    """Walls plus a steep front gable: the body of the house and of the side wing."""
    walls(cx, yf, yb, w, z0, wall, c, ridges)
    return gable_roof(cx, yf, yb, w, z0 + wall, rise, c, ov, ovy, finial, gingerbread)


def hip_roof(w, zw, rise, c, ov=0.6):
    """A steep Queen Anne hip (a pyramid on the squarer bodies) with eave brackets.
    Returns z(x, y) of its top surface."""
    roof, trim = c["roof"], c["trim"]
    hw = w / 2 + ov
    ye, yk = Y0 - ov, Y1 + ov
    mid = (ye + yk) / 2
    yr0, yr1 = min(ye + hw, mid), max(yk - hw, mid)
    z0 = zw - 0.05
    pts = [(sx * hw, y, z) for sx in (-1, 1) for y in (ye, yk) for z in (z0, z0 + 0.25)]
    pts += [(0, yr0, zw + rise), (0, yr1, zw + rise)]
    hull(pts, roof, bevel=0.04)
    for y in (ye + 0.06, yk - 0.06):   # fascia boards
        box(0, y, z0 - 0.06, 2 * hw - 0.1, 0.14, 0.24, trim)
    for sx in (-1, 1):
        box(sx * (hw - 0.06), mid, z0 - 0.06, 0.14, yk - ye - 0.1, 0.24, trim)
        n = 7
        for i in range(n + 1):   # paired brackets under the side eaves
            y = Y0 + 0.4 + i * (D - 0.8) / n
            box(sx * (w / 2 + 0.24), y, zw - 0.36, 0.5, 0.16, 0.42, trim)
    if yr1 - yr0 > 0.05:
        box(0, (yr0 + yr1) / 2, zw + rise + 0.04, 0.4, yr1 - yr0 + 0.3, 0.24, shade(roof, 0.8))
    ball(0, yr0, zw + rise + 0.3, 0.4, 0.4, 0.4, trim, seg=6, ring=4)
    can(0, yr0, zw + rise + 1.1, 0.13, 1.6, trim, n=6, r2=0.0)

    def z_at(x, y):
        fx = (hw - abs(x)) / hw
        fy = (y - ye) / (yr0 - ye) if y < yr0 else (yk - y) / (yk - yr1) if y > yr1 else 1.0
        return z0 + 0.25 + (zw + rise - z0 - 0.25) * max(0.0, min(fx, fy))
    return z_at


def cross_gable(w, cy, zw, span, rise, c, ov=0.5, ovx=0.55):
    """A side gable crossing the main front gable: gable ends on both side walls."""
    body, roof, trim = c["body"], c["roof"], c["trim"]
    hw = w / 2
    hull([(sx * hw, cy + sy * span / 2, zw) for sx in (-1, 1) for sy in (-1, 1)]
         + [(sx * hw, cy, zw + rise) for sx in (-1, 1)], body)
    a = math.atan2(rise, span / 2)
    L = math.hypot(rise, span / 2)
    t = 0.38
    rz = zw + rise
    ends = (-(hw + ovx - 0.12), hw + ovx - 0.12)
    for s in (-1, 1):
        uy, uz = s * math.cos(a), -math.sin(a)
        ny, nz = s * math.sin(a), math.cos(a)
        k = (L + ov - 0.2) / 2
        box(0, cy + uy * (k - 0.1) + ny * t / 2, rz + uz * (k - 0.1) + nz * t / 2,
            w + 2 * ovx, L + ov + 0.2, t, roof, bevel=0.05, rot=(-s * a, 0, 0))
        m = (L + ov * 0.6) / 2
        for xx in ends:
            box(xx, cy + uy * m - ny * 0.2, rz + uz * m - nz * 0.2, 0.16, L + ov * 0.6, 0.4, trim, rot=(-s * a, 0, 0))
            for i in range(4):
                d = (0.16 + i * 0.2) * L
                box(xx, cy + uy * d - ny * 0.5, rz + uz * d - nz * 0.5, 0.1, 0.26, 0.26, trim, rot=(math.radians(45), 0, 0))
    box(0, cy, rz + 0.12, w + 2 * ovx + 0.1, 0.45, 0.3, shade(roof, 0.8))  # ridge cap
    for sx in (-1, 1):   # no finials here: at 3/4 they doubled up with the front gable's
        window(sx * hw, cy, zw + 1.25, sx * math.pi / 2, 0.9, 1.1, True, trim, mull=False)


def dormer(cx, cy, zb, ang, c, wd=2.2, hd=2.0, rd=1.85, dd=3.2, lit=True):
    """A gabled dormer whose front face sits at (cx, cy) on the roof (bottom zb);
    ang 0 faces -y, pi/2 faces +x. It runs dd back into the roof."""
    body, roof, trim = c["body"], c["roof"], c["trim"]

    def lp(dx, dy, z):
        ox, oy = rotv(dx, dy, ang)
        return (cx + ox, cy + oy, z)

    wbox(cx, cy, zb + hd / 2, ang, 0, dd / 2, wd, dd, hd, body, bevel=0.04)
    for sx in (-1, 1):
        wbox(cx, cy, zb + hd / 2, ang, sx * (wd / 2 - 0.06), -0.06, 0.24, 0.24, hd, trim)
    zt = zb + hd
    hull([lp(x, y, z) for y in (0.0, dd) for (x, z) in ((-wd / 2, zt), (wd / 2, zt), (0.0, zt + rd))], body)
    a = math.atan2(rd, wd / 2)
    L = math.hypot(rd, wd / 2)
    ov, t = 0.3, 0.26
    rz = zt + rd
    for s in (-1, 1):
        ux, uz = s * math.cos(a), -math.sin(a)
        nx, nz = s * math.sin(a), math.cos(a)
        k = (L + ov) / 2
        x, y, _ = lp(ux * k + nx * t / 2, dd / 2 - ov / 2, 0)
        box(x, y, rz + uz * k + nz * t / 2, L + ov + 0.1, dd + ov, t, roof, bevel=0.03, rot=(0, s * a, ang))
        m = (L + ov * 0.5) / 2
        x, y, _ = lp(ux * m - nx * 0.15, -ov + 0.1, 0)
        box(x, y, rz + uz * m - nz * 0.15, L + ov * 0.5, 0.12, 0.3, trim, rot=(0, s * a, ang))
    wbox(cx, cy, rz + 0.08, ang, 0, dd / 2 - ov / 2, 0.3, dd + ov + 0.05, 0.22, shade(roof, 0.8))
    x, y, _ = lp(0, -ov + 0.15, 0)
    ball(x, y, rz + 0.3, 0.3, 0.3, 0.3, trim, seg=6, ring=4)
    can(x, y, rz + 0.9, 0.1, 1.0, trim, n=6, r2=0.0)
    window(cx, cy, zb + hd / 2 + 0.05, ang, 1.0, 1.15, lit, trim)


def chimney(x, y, side, z_eave, c):
    """An outside brick chimney against a side wall (wall plane x, side +1 right, -1 left),
    rising from the ground past the eave at z_eave: it reads from the street at 3/4."""
    top = z_eave + 2.6
    zs = F + WALL * 0.42                       # the shoulder where the firebox narrows to the flue
    bx = x + side * 0.55
    box(bx, y, zs / 2, 1.1, 1.5, zs, BRICK)
    frustum(bx, y, zs, 1.1, 1.5, 0.6, 0.86, 1.06, BRICK)
    sx = bx - side * 0.12                      # the flue keeps hugging the wall
    box(sx, y, (zs + 0.6 + top) / 2, 0.86, 1.06, top - zs - 0.6, BRICK)
    for dz in (0.75, 0.45):
        box(sx, y, top - dz, 0.96, 1.16, 0.12, shade(BRICK, 0.8))
    box(sx, y, top + 0.1, 1.12, 1.32, 0.22, SOOT, bevel=0.03)
    box(sx, y, top + 0.24, 0.5, 0.7, 0.1, (0.12, 0.11, 0.12))


def balcony(c, zw, rail="plain"):
    """A little balcony on the porch roof under the front gable, with a glowing door."""
    trim = c["trim"]
    bw, bd = 3.0, 1.5
    zt = zw + 0.35
    yf = Y0 - bd
    box(0, Y0 - bd / 2, zt - 0.6, bw, bd, 1.0, shade(c["roof"], 1.15))  # the block sitting in the porch roof
    box(0, Y0 - bd / 2 - 0.05, zt - 0.06, bw + 0.2, bd + 0.1, 0.16, DECK, bevel=0.03)
    box(0, yf - 0.02, zt - 0.3, bw + 0.24, 0.14, 0.32, trim)
    xs = (-bw / 2 + 0.12, bw / 2 - 0.12)
    for x in xs:
        box(x, yf + 0.12, zt + 0.7, 0.24, 0.24, 1.4, trim)
        ball(x, yf + 0.12, zt + 1.48, 0.28, 0.28, 0.24, trim, seg=6, ring=4)
    railing((xs[0] + 0.12, yf + 0.12), (xs[1] - 0.12, yf + 0.12), zt, zt + 1.3, trim, spacing=0.45, style=rail)
    for x in xs:
        railing((x, yf + 0.24), (x, Y0 - 0.15), zt, zt + 1.3, trim, spacing=0.45, style=rail)
    arched_window(0, Y0, zt + 0.05, 1.5, 3.0, True, trim)


# ---------------------------------------------------------------- porch

def turned_post(x, y, z0, z1, trim):
    box(x, y, z0 + 0.35, 0.44, 0.44, 0.7, trim)
    can(x, y, (z0 + 0.7 + z1 - 0.4) / 2, 0.12, z1 - z0 - 1.1, trim, n=6)
    for zz in (z0 + 1.5, z1 - 1.3):
        can(x, y, zz, 0.21, 0.5, trim, n=6)
    box(x, y, z1 - 0.2, 0.42, 0.42, 0.4, trim)


def railing(p0, p1, z0, z1, trim, spacing=0.5, style="plain"):
    """A straight railing from p0 to p1 (xy), deck at z0, top rail at z1.
    plain: square balusters. fancy: flat sawn balusters with a diamond bulge
    (a low-poly turned spindle), a sparser rhythm and a capped top rail."""
    (x0, y0), (x1, y1) = p0, p1
    L = math.hypot(x1 - x0, y1 - y0)
    ang = math.atan2(y1 - y0, x1 - x0)
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    box(mx, my, z1, L, 0.2, 0.18, trim, rot=(0, 0, ang))
    box(mx, my, z0 + 0.35, L, 0.14, 0.14, trim, rot=(0, 0, ang))
    zb, hb = (z0 + 0.35 + z1) / 2, z1 - z0 - 0.35
    if style == "fancy":
        box(mx, my, z1 + 0.13, L, 0.28, 0.08, trim, rot=(0, 0, ang))   # the cap
        n = max(1, round(L / (spacing * 1.4)))
        for i in range(1, n):
            x, y = x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n
            box(x, y, zb, 0.2, 0.08, hb, trim, rot=(0, 0, ang))
            box(x, y, zb - 0.05, 0.4, 0.12, 0.4, trim, rot=(0, math.radians(45), ang))
        return
    n = max(1, int(L / spacing))
    for i in range(1, n):
        f = i / n
        box(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, zb, 0.11, 0.11, hb, trim)


def spindle_frieze(p0, p1, trim, spacing=0.42):
    """Beam, hanging spindles and a bottom rail along the porch top from p0 to p1."""
    (x0, y0), (x1, y1) = p0, p1
    L = math.hypot(x1 - x0, y1 - y0)
    ang = math.atan2(y1 - y0, x1 - x0)
    box((x0 + x1) / 2, (y0 + y1) / 2, POST_TOP + 0.25, L + 0.4, 0.4, 0.5, trim, rot=(0, 0, ang))
    n = int(L / spacing)
    for i in range(n + 1):
        f = i / n
        box(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, POST_TOP - 0.25, 0.09, 0.12, 0.5, trim, rot=(0, 0, ang))
    box((x0 + x1) / 2, (y0 + y1) / 2, POST_TOP - 0.52, L, 0.16, 0.1, trim, rot=(0, 0, ang))


def porch(c, W, lay, kind, turret, boxes, rail="plain"):
    """Deck, door, front windows, posts, frieze, roof, steps and railings."""
    trim, roof = c["trim"], c["roof"]
    found = c.get("found", shade(roof, 1.3))
    if kind == "left":
        px0, px1, door_x = -W / 2 - 0.2, lay["px1_left"], lay["door_left"]
        front_wins = list(lay["in_left"])
        out_wins = [] if turret else list(lay["out_left"])
    else:
        px0, px1, door_x = -W / 2 - 0.2, W / 2 + 0.2, 0.0
        front_wins = list(lay["centre"])
        out_wins = []
    wrap = kind == "wrap"
    if wrap:
        px0 = -W / 2 - PORCH_D   # the front deck runs on to the corner of the side porch
    fs, rs = (0.6, 0.66) if wrap else (0.42, 0.5)   # the long wrap porch gets sparser spindles to stay in budget
    pyf = Y0 - PORCH_D
    pcx, pcy = (px0 + px1) / 2, (pyf + Y0) / 2
    box(pcx, pcy, (F - 0.16) / 2, px1 - px0 - 0.2, PORCH_D - 0.1, F - 0.16, found)        # skirt
    box(pcx, pcy - 0.05, F - 0.08, px1 - px0, PORCH_D + 0.1, 0.16, DECK, bevel=0.04)   # deck

    front_door(door_x, trim)
    for i, (x, w) in enumerate(front_wins + out_wins):
        window(x, Y0, F + 2.6, 0.0, w, 2.5, True, trim)
        if boxes:
            window_box(x, Y0, F + 2.6, 0.0, w, 2.5, c, i)

    # posts: the porch ends and either side of the steps (a step post only
    # gives way to an end post standing right next to it)
    sx0, sx1 = door_x - 1.75, door_x + 1.75
    post_xs = [px0 + 0.3, px1 - 0.3]
    if wrap:
        post_xs.append(-W / 2 - 0.2 + 0.3)
    for x in (sx0, sx1):
        if all(abs(x - p) > 0.5 for p in post_xs):
            post_xs.append(x)
    post_xs.sort()
    py = pyf + 0.3
    for x in post_xs:
        turned_post(x, py, F, POST_TOP, trim)
    # beam, spindle frieze and corner brackets
    box(pcx, py, POST_TOP + 0.25, px1 - px0, 0.4, 0.5, trim)
    for s in (0, 1):
        x = (px0, px1)[s] + (0.3 if s == 0 else -0.3)
        box(x, (py + Y0) / 2, POST_TOP + 0.25, 0.4, Y0 - py, 0.5, trim)
    n = int((px1 - px0 - 0.6) / fs)
    for i in range(n + 1):
        x = px0 + 0.3 + i * (px1 - px0 - 0.6) / n
        box(x, py, POST_TOP - 0.25, 0.09, 0.12, 0.5, trim)
    box(pcx, py, POST_TOP - 0.52, px1 - px0 - 0.6, 0.16, 0.1, trim)
    for x in post_xs:
        for s in (-1, 1):
            if px0 + 0.2 < x + s * 0.45 < px1 - 0.2:
                box(x + s * 0.32, py, POST_TOP - 0.55, 0.12, 0.14, 0.7, trim, rot=(0, s * math.radians(-45), 0))
    # porch roof: a low hip leaning on the front wall
    ov = 0.45
    zr0 = POST_TOP + 0.5
    pts = []
    for x in (px0 - ov, px1 + ov):
        for y in (pyf - ov, Y0 + 0.05):
            pts += [(x, y, zr0), (x, y, zr0 + 0.22)]
    left_ridge = -W / 2 + 0.05 if wrap else px0 + 0.9   # wrap: a true 45-degree hip at the corner
    pts += [(left_ridge, Y0 + 0.05, zr0 + PORCH_RISE), (px1 - 0.9, Y0 + 0.05, zr0 + PORCH_RISE)]
    hull(pts, roof, bevel=0.04)
    box(pcx, pyf - ov + 0.06, zr0 - 0.12, px1 - px0 + 2 * ov - 0.1, 0.14, 0.26, trim)  # fascia

    # steps up to the porch, with newels and sloped handrails
    rise, tread, nsteps = F / 3, 0.6, 3
    for i in range(nsteps):
        depth = (nsteps - i) * tread
        box(door_x, pyf - depth / 2 + 0.05, (i + 0.5) * rise, 3.0, depth + 0.1, rise, DECK if i % 2 == 0 else shade(DECK, 0.92))
    yb = pyf - nsteps * tread
    for x in (sx0, sx1):
        box(x, yb + 0.25, 1.0, 0.36, 0.36, 2.0, trim)
        ball(x, yb + 0.25, 2.1, 0.36, 0.36, 0.3, trim, seg=6, ring=4)
        limb((x, yb + 0.25, 1.95), (x, py, F + 1.95), 0.08, trim)
        limb((x, yb + 0.25, 0.35), (x, py, F + 0.35), 0.06, trim)
        for f in (0.33, 0.66):
            yy = yb + 0.25 + (py - yb - 0.25) * f
            box(x, yy, 0.35 + f * F + 0.8, 0.1, 0.1, 1.6, trim)
    # railings: across the front either side of the steps, and the porch ends
    rz = F + 1.95
    xs = sorted(post_xs)
    for a, b in zip(xs, xs[1:]):
        if a < sx1 - 0.3 and b > sx0 + 0.3:
            continue  # the step opening
        railing((a + 0.22, py), (b - 0.22, py), F, rz, trim, rs, rail)
    if not wrap:
        railing((xs[0], py + 0.22), (xs[0], Y0 - 0.15), F, rz, trim, rs, rail)
    railing((xs[-1], py + 0.22), (xs[-1], Y0 - 0.15), F, rz, trim, rs, rail)

    if wrap:     # the side run of the wrap-around porch, down the left wall
        x0, x1 = px0, -W / 2
        ye = Y0 + SIDE_L
        sx = px0 + 0.3
        scx, scy = (x0 + x1) / 2, (Y0 + ye) / 2
        box(scx, scy, (F - 0.16) / 2, x1 - x0 - 0.1, SIDE_L, F - 0.16, found)
        box(scx - 0.05, scy, F - 0.08, x1 - x0 + 0.1, SIDE_L + 0.1, 0.16, DECK, bevel=0.04)
        side_ys = [py, (py + ye - 0.3) / 2, ye - 0.3]
        for y in side_ys[1:]:
            turned_post(sx, y, F, POST_TOP, trim)
        spindle_frieze((sx, py + 0.3), (sx, ye - 0.3), trim, fs)
        box((sx + x1) / 2, ye - 0.3, POST_TOP + 0.25, x1 - sx, 0.4, 0.5, trim)
        for y in side_ys[1:]:
            for s in (-1, 1):
                box(sx, y + s * 0.32, POST_TOP - 0.55, 0.14, 0.12, 0.7, trim, rot=(s * math.radians(45), 0, 0))
        for a, b in zip(side_ys, side_ys[1:]):
            railing((sx, a + 0.22), (sx, b - 0.22), F, rz, trim, rs, rail)
        railing((sx + 0.22, ye - 0.3), (x1 - 0.15, ye - 0.3), F, rz, trim, rs, rail)
        # its roof: same pitch as the front, meeting it in a hip at the corner
        sp = [(x, y, z) for x in (x0 - ov, x1 + 0.05) for y in (pyf - ov, ye + ov) for z in (zr0, zr0 + 0.22)]
        sp += [(x1 + 0.05, Y0 + 0.05, zr0 + PORCH_RISE), (x1 + 0.05, ye + ov - 0.9, zr0 + PORCH_RISE)]
        hull(sp, roof, bevel=0.04)
        box(x0 - ov + 0.06, (pyf + ye) / 2, zr0 - 0.12, 0.14, ye - pyf + 2 * ov - 0.1, 0.26, trim)


# ---------------------------------------------------------------- attachments

def bay_window(c, W, side=1, by=3.3):
    """A three-sided bay window on a side wall (side +1 right, -1 left)."""
    body, roof, trim = c["body"], c["roof"], c["trim"]
    bw, bo = 3.2, 1.1
    x0 = W / 2
    z0, z1 = 0.2, F + 4.3
    pts = []
    for z in (z0, z1):
        pts += [(x0 - 0.1, by - bw / 2, z), (x0 - 0.1, by + bw / 2, z), (x0 + bo, by - bw / 2 + 0.7, z), (x0 + bo, by + bw / 2 - 0.7, z)]
    hull([(side * x, y, z) for x, y, z in pts], body)
    roofp = []
    for (x, y, _) in pts[4:]:
        roofp += [(x + (0.25 if x > x0 else 0), y + (0.25 if y > by else -0.25), z1), (x + (0.25 if x > x0 else 0), y + (0.25 if y > by else -0.25), z1 + 0.15)]
    roofp += [(x0 - 0.1, by - bw / 2 + 0.6, z1 + 1.3), (x0 - 0.1, by + bw / 2 - 0.6, z1 + 1.3)]
    hull([(side * x, y, z) for x, y, z in roofp], roof)
    window(side * (x0 + bo), by, F + 2.4, side * math.pi / 2, 1.2, 2.3, True, trim)
    for s in (-1, 1):
        mx, my = x0 + bo / 2, by + s * (bw / 2 - 0.35)
        ang = math.pi / 2 + s * (math.pi / 2 - math.atan2(bo, 0.7))
        window(side * (mx + 0.02), my, F + 2.4, side * ang, 0.55, 2.3, True, trim, mull=False)


def turret(c, W):
    """An eight-sided corner tower with a witch-hat roof (front-right corner)."""
    body, roof, trim = c["body"], c["roof"], c["trim"]
    found = c.get("found", shade(roof, 1.3))
    tx, ty, tr = W / 2 - 0.25, Y0 - 0.15, 1.55
    th = F + WALL + 2.2
    rot8 = (0, 0, math.radians(22.5))
    can(tx, ty, F / 2, tr + 0.12, F, found, n=8, rot=rot8)
    can(tx, ty, F + (th - F) / 2, tr, th - F, body, n=8, rot=rot8)
    for zz in (F + 0.9 + i * 1.45 for i in range(int((th - F - 0.5) / 1.45))):
        can(tx, ty, zz, tr + 0.05, 0.12, shade(body, 0.86), n=8, rot=rot8)
    can(tx, ty, th - 0.2, tr + 0.12, 0.4, trim, n=8, rot=rot8)
    hat = 6.6
    can(tx, ty, th + hat / 2, tr + 0.5, hat, roof, n=8, r2=0.05, rot=rot8)
    ball(tx, ty, th + hat + 0.1, 0.36, 0.36, 0.36, trim, seg=6, ring=4)
    can(tx, ty, th + hat + 0.9, 0.12, 1.4, trim, n=6, r2=0.0)
    apo = tr * math.cos(math.radians(22.5))
    for ang, z in ((0.0, F + 2.6), (math.radians(45), F + 2.6), (0.0, F + WALL - 0.2), (math.radians(45), F + WALL - 0.2)):
        ox, oy = rotv(0, -apo, ang)
        window(tx + ox, ty + oy, z, ang, 0.8, 1.9 if z < F + 4 else 1.4, True, trim, mull=False)


def wing(c, W, boxes, gingerbread="scallop", chim=False):
    """A lower side wing with its own front gable, set back on the right."""
    trim, roof = c["trim"], c["roof"]
    found = c.get("found", shade(roof, 1.3))
    ww, wx = 4.6, W / 2 + 2.0
    wy0, wy1 = Y0 + 2.6, Y1 - 0.4
    wwall, wrise = 4.6, 4.75
    box(wx + 0.2, (wy0 + wy1) / 2, F / 2, ww - 0.1, wy1 - wy0 + 0.3, F, found)
    gabled_mass(wx, wy0, wy1, ww, F, wwall, wrise, c, ov=0.45, ovy=0.4, finial=True, gingerbread=gingerbread)
    window(wx + 0.2, wy0, F + 2.4, 0.0, 1.4, 2.4, True, trim)
    if boxes:
        window_box(wx + 0.2, wy0, F + 2.4, 0.0, 1.4, 2.4, c, 1)
    arched_window(wx, wy0, F + wwall + 0.6, 1.0, 1.7, True, trim)
    window(wx + ww / 2, (wy0 + wy1) / 2 - (0.6 if chim else 0), F + 2.4, math.pi / 2, 1.3, 2.4, False, trim)
    if chim:     # the chimney climbs the wing's outer wall
        chimney(wx + ww / 2, wy1 - 1.0, 1, F + wwall, c)


# ---------------------------------------------------------------- the house

def house(spec):
    c = PALETTES[spec["palette"]]
    trim, roof = c["trim"], c["roof"]
    found = c.get("found", shade(roof, 1.3))
    W, lay, rise = WIDTHS[spec["width"]], LAYOUT[spec["width"]], RISES[spec["width"]]
    rtype, boxes = spec["roof"], spec["boxes"]
    gb, rail = spec["gingerbread"], spec["rail"]
    bay_side = (-1 if spec["wing"] else 1) if spec["bay"] else 0
    chim_wall = spec["chimney"] and not spec["wing"]   # an outside chimney on the right wall, near the back
    chim_y = Y1 - 0.85
    zw = F + WALL

    box(0, (Y0 + Y1) / 2, F / 2, W + 0.3, D + 0.3, F, found, bevel=0.06)
    if rtype == "hip":
        walls(0, Y0, Y1, W, F, WALL, c)
        z_roof = hip_roof(W, zw, rise * HIP_K, c)
    else:
        gabled_mass(0, Y0, Y1, W, F, WALL, rise, c, gingerbread=gb)
        a = math.atan2(rise, W / 2)

        def z_roof(x, y):
            return zw + rise * (1 - abs(x) / (W / 2)) + 0.38 / math.cos(a)
        if not spec["balcony"]:
            arched_window(0, Y0, zw + 1.3, 1.6, 2.6, True, trim)

    porch(c, W, lay, spec["porch"], spec["turret"], boxes, rail)

    # side and back windows (some lit, some dark)
    for s in (-1, 1):
        ang = s * math.pi / 2
        for y, lit in ((-0.3, True), (3.6, s < 0)):
            if (bay_side == s and y > 0) or (spec["wing"] and s > 0):
                continue
            if chim_wall and s > 0 and y > 0:
                y = 2.6 if bay_side != 1 else y   # make room for the chimney
            window(s * W / 2, y, F + 2.6, ang, 1.3, 2.4, lit, trim)
            if boxes and s > 0:
                window_box(s * W / 2, y, F + 2.6, ang, 1.3, 2.4, c, 2 if y < 0 else 0)
        if not (spec["wing"] and s > 0):
            window(s * W / 2, 2.0, F + WALL - 1.4, ang, 1.0, 1.2, s > 0, trim, mull=False)
    bx = lay["back"]
    for x, lit in ((-bx, False), (bx, True)):
        window(x, Y1, F + 2.6, math.pi, 1.3, 2.4, lit, trim)
    if rtype != "hip":
        window(0, Y1, zw + 1.8, math.pi, 1.1, 1.5, False, trim, mull=False)

    if bay_side:
        bay_window(c, W, bay_side, 2.5 if (chim_wall and bay_side == 1) else 3.3)
    if spec["turret"]:
        turret(c, W)
    if spec["wing"]:
        wing(c, W, boxes, gb, spec["chimney"])
    if rtype == "cross":
        cross_gable(W, 2.2, zw, 4.4, 2.2 * rise / (W / 2), c, ovx=0.22)   # tucked back, short overhang
    if spec["dormer"]:
        if rtype == "hip":     # on the front slope, over the porch roof
            yd = Y0 + 0.6
            zb = z_roof(0, yd) - 0.08
            dormer(0, yd, zb, 0.0, c, dd=3.8)
        else:                  # on the right slope, seen from the street at 3/4
            xd = W / 2 - 1.4
            dormer(xd, 0.8, z_roof(xd, 0.8) - 0.08, math.pi / 2, c)
    if chim_wall:
        chimney(W / 2, chim_y, 1, zw, c)
    if spec["balcony"]:
        balcony(c, zw, rail)


# ---------------------------------------------------------------- generator

def validate(spec):
    """Fill defaults and check the combination; returns the full spec."""
    s = dict(width="medium", roof="gable", porch="centre", palette="lavender", rail="plain", gingerbread="scallop")
    s.update({k: False for k in EXTRAS})
    s.update(spec)
    errs = []
    if s["width"] not in WIDTHS or s["roof"] not in ("gable", "hip", "cross") or s["porch"] not in ("left", "centre", "wrap"):
        errs.append("unknown width/roof/porch")
    if s["palette"] not in PALETTES:
        errs.append("unknown palette")
    if s["rail"] not in RAILS or s["gingerbread"] not in GINGERBREAD:
        errs.append("unknown rail/gingerbread")
    if s["turret"] and s["porch"] != "left":
        errs.append("the turret takes the front-right corner: needs the left porch")
    if s["wing"] and s["roof"] == "cross":
        errs.append("the wing would hit the cross gable's right end")
    if s["dormer"] and s["roof"] == "cross":
        errs.append("the cross gable already fills the slopes")
    if s["dormer"] and s["roof"] == "gable" and s["wing"]:
        errs.append("the wing roof would hide a side dormer")
    if s["balcony"] and (s["porch"] == "left" or s["roof"] == "hip"):
        errs.append("the balcony needs a centred porch roof under the front gable")
    if errs:
        raise ValueError(f"{spec}: " + "; ".join(errs))
    return s


def pick(seed):
    """A random valid spec from a seed."""
    r = random.Random(seed)
    s = dict(width=r.choice(sorted(WIDTHS)),
             roof=r.choices(["gable", "hip", "cross"], [5, 3, 3])[0],
             porch=r.choice(["left", "centre", "wrap"]),
             palette=r.choice(sorted(PALETTES)))
    s["turret"] = s["porch"] == "left" and r.random() < 0.6
    s["wing"] = s["roof"] != "cross" and r.random() < 0.35
    s["bay"] = r.random() < 0.45
    s["dormer"] = (s["roof"] == "hip" and r.random() < 0.85) or (s["roof"] == "gable" and not s["wing"] and r.random() < 0.4)
    s["chimney"] = r.random() < 0.55
    s["balcony"] = s["porch"] != "left" and s["roof"] != "hip" and r.random() < 0.45
    s["boxes"] = r.random() < 0.4
    # drawn last, so the seeds above keep the houses they always made
    s["rail"] = "fancy" if r.random() < 0.45 else "plain"
    s["gingerbread"] = r.choice(GINGERBREAD)
    return validate(s)


def make_house(seed_or_spec):
    """Build a house from a seed (int) or a (partial) spec dict; returns the spec used."""
    spec = pick(seed_or_spec) if isinstance(seed_or_spec, int) else validate(seed_or_spec)
    house(spec)
    return spec


def describe(spec):
    ex = [k for k in EXTRAS if spec[k]]
    return (f"{spec['width']}/{spec['roof']}/{spec['porch']}/{spec['palette']} {spec['rail']} rail, {spec['gingerbread']}"
            + (" +" + ",".join(ex) if ex else ""))


# the twelve generated houses: fixed seeds, chosen for variety
SEEDS = {f"house-{i + 1:02d}": s for i, s in enumerate([599, 564, 366, 500, 561, 503, 83, 451, 235, 313, 359, 183])}
# art-review touch-ups on top of a seed
OVERRIDES = {"house-05": dict(wing=False),            # wide + hip + turret + wing was too much
             "house-11": dict(gingerbread="sunburst")}  # a second sunburst on the street


# ---------------------------------------------------------------- montage

MONTAGE_SCALE = 27.0   # one ortho scale for every tile: the houses compare at true size


def montage_tile(name, path):
    import bpy
    from mathutils import Vector
    scene = bpy.context.scene
    sun = bpy.data.objects.new("msun", bpy.data.lights.new("msun", "SUN"))
    sun.data.energy = 2.3
    sun.data.angle = math.radians(12)
    sun.rotation_euler = (math.radians(40), math.radians(18), math.radians(35))
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new("mcam", bpy.data.cameras.new("mcam"))
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = MONTAGE_SCALE
    scene.collection.objects.link(cam)
    target = Vector((0, 0, 8.0))
    cam.location = target + Vector(kit.VIEWS[0][1]).normalized() * 90
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.clip_end = 400
    scene.camera = cam
    # the slug, as text facing the camera at the bottom of the tile
    cu = bpy.data.curves.new("lbl", "FONT")
    cu.body = name
    cu.size = 1.6
    cu.align_x = "CENTER"
    txt = bpy.data.objects.new("lbl", cu)
    m = bpy.data.materials.new("lblm")
    m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.05, 0.04, 0.05, 1)
    cu.materials.append(m)
    rot = cam.rotation_euler.to_matrix()
    txt.rotation_euler = cam.rotation_euler
    txt.location = target + rot @ Vector((0, -MONTAGE_SCALE * 0.44, 30))
    scene.collection.objects.link(txt)
    scene.render.resolution_x = scene.render.resolution_y = 560
    scene.render.film_transparent = True
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for o in (cam, sun, txt):
        bpy.data.objects.remove(o)


def montage(tiles, out, cols=4):
    import bpy
    import numpy as np
    imgs = [bpy.data.images.load(p) for p in tiles]
    w, h = imgs[0].size
    bg = np.array([0.86, 0.83, 0.78])
    rows = []
    for r in range(0, len(imgs), cols):
        row = []
        for img in imgs[r:r + cols]:
            a = np.empty(w * h * 4, dtype=np.float32)
            img.pixels.foreach_get(a)
            a = a.reshape(h, w, 4)
            row.append(a[..., :3] * a[..., 3:4] + bg * (1 - a[..., 3:4]))
        while len(row) < cols:
            row.append(np.ones((h, w, 3)) * bg)
        rows.append(np.concatenate(row, axis=1))
    rgb = np.concatenate(rows[::-1], axis=0)   # image rows run bottom-up
    full = np.concatenate([rgb, np.ones(rgb.shape[:2] + (1,))], axis=2).astype(np.float32)
    im = bpy.data.images.new("montage", rgb.shape[1], rgb.shape[0], alpha=False)
    im.pixels.foreach_set(full.ravel())
    im.filepath_raw = out
    im.file_format = "PNG"
    im.save()


# ---------------------------------------------------------------- main

def all_specs():
    specs = {slug: validate(p) for slug, p in PRESETS.items()}
    specs.update({slug: validate({**pick(seed), **OVERRIDES.get(slug, {})}) for slug, seed in SEEDS.items()})
    return specs


DROP_ORDER = ("boxes", "chimney", "balcony", "dormer", "bay")


def ship(slug, spec, out, tile_dir):
    import bpy
    while True:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        kit._mats.clear()
        house(spec)
        tris = finish_prop(slug)
        if tris <= BUDGET:
            break
        drop = next(k for k in DROP_ORDER if spec[k])   # over budget: shed the smallest extras first
        print(f"PROP {slug}: {tris} tris over budget, dropping {drop}")
        spec = dict(spec, **{drop: False})
    calls = export_prop(slug, os.path.join(kit.GLB_DIR, f"{slug}.glb"))
    render_sheet(slug, out)
    montage_tile(slug, os.path.join(tile_dir, f"{slug}.png"))
    print(f"PROP {slug}: {tris} tris, {calls} draw calls  [{describe(spec)}]")
    return {"slug": slug, "tris": tris, "kind": "house"}


def main():
    out = out_dir_arg()
    rest = sys.argv[sys.argv.index("--") + 2:] if "--" in sys.argv else []
    specs = all_specs()
    if "--plan" in rest:
        for slug, s in specs.items():
            print(f"PLAN {slug}: {describe(s)}")
        return
    only = [a for a in rest if not a.startswith("--")]
    tile_dir = os.path.join("/tmp", "rck-house-tiles")
    os.makedirs(tile_dir, exist_ok=True)
    entries = []
    for slug, spec in specs.items():
        if only and slug not in only:
            continue
        entries.append(ship(slug, spec, out, tile_dir))
    kit.update_index(entries)
    if not only:
        montage([os.path.join(tile_dir, f"{s}.png") for s in specs], os.path.join(out, "houses-montage.png"))


if __name__ == "__main__":
    main()
