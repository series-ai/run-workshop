"""Petite Victorian houses as a modular kit (the street-scene houses).

Parts, all fitted to any body width:
  body       narrow / medium / wide, two storeys, clapboard, corner boards
  roof       gable (the steep front gable with gingerbread, a finial and an
             arched attic window) / hip (a steep Queen Anne hip) / cross
             (the front gable crossed by a side gable, tucked back); all steep
  gingerbread  scallop / spindle / sunburst / pendant (front and wing gables)
  porch      left / centre / wrap (full width, wrapping down the left side)
  rail       plain (square balusters) / fancy (sawn balusters with a diamond bulge)
  frieze     under the porch beams: spindle / scallop (a scalloped valance) /
             sunburst (fan brackets in the corners of each bay) / pendant (hanging drops)
  extras     turret (front-right corner), bay (side bay window), wing (lower
             side wing with its own gable), dormer, chimney (outside brick
             chimney on the right wall, or on the wing's wall), balcony
             (small upper balcony over the porch), boxes (window boxes)
  palette    one of PALETTES

The house is assembled from PART_DEFS (see part_defs(); house_parts.py ships
each part as its own GLB for in-game assembly). `make_house(seed_or_spec)` turns a seed (or a partial spec) into a valid spec
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
GINGERBREAD = ("scallop", "valance", "spindle", "sunburst", "pendant")
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
    "charcoal": dict(body=(0.36, 0.36, 0.41), trim=TRIM, roof=(0.36, 0.21, 0.30)),    # plum roof
}

for _p in PALETTES.values():
    _p["porch"] = _p["trim"]       # the porch's woodwork matches the trim unless picked apart
BRICK_WALL = (0.62, 0.30, 0.24)

# the swatches the builder offers per role (the palettes' own colours first)
SWATCHES = {
    "body": [p["body"] for p in PALETTES.values()] + [BRICK_WALL, (0.91, 0.82, 0.60), (0.93, 0.91, 0.86), (0.94, 0.70, 0.56),
                                                       (0.62, 0.76, 0.66), (0.55, 0.38, 0.52)],
    "trim": [TRIM, (0.99, 0.98, 0.95), (0.47, 0.25, 0.34), (0.30, 0.29, 0.33), (0.27, 0.40, 0.33), (0.86, 0.69, 0.32),
             (0.62, 0.30, 0.24)],
    "roof": [(0.31, 0.19, 0.30), (0.22, 0.22, 0.26), (0.34, 0.20, 0.28), (0.20, 0.21, 0.27), (0.37, 0.24, 0.20),
             (0.30, 0.18, 0.27), (0.36, 0.21, 0.30), (0.25, 0.31, 0.42), (0.26, 0.34, 0.25), (0.50, 0.20, 0.18)],
    "porch": [TRIM, (0.99, 0.98, 0.95), (0.47, 0.25, 0.34), (0.30, 0.29, 0.33), (0.27, 0.40, 0.33), (0.62, 0.45, 0.30),
              (0.86, 0.69, 0.32)],
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


def round_window(cx, cy, zc, ang, r, lit, trim):
    """A round (oculus) window on a wall face; ang 0 faces -y, pi/2 faces +x."""
    rot = (math.radians(90), math.radians(18), ang)
    for dy, rr, th, rgb in ((-0.05, r + 0.2, 0.14, trim), (-0.11, r, 0.1, GLOW_RGB if lit else DARK_WIN)):
        ox, oy = rotv(0, dy, ang)
        with (glow() if lit and rgb == GLOW_RGB else _Null()):
            can(cx + ox, cy + oy, zc, rr, th, rgb, n=10, rot=rot)
    wbox(cx, cy, zc, ang, 0, -0.17, 0.09, 0.06, 2 * r, trim)
    wbox(cx, cy, zc, ang, 0, -0.17, 2 * r, 0.06, 0.09, trim)
    wbox(cx, cy, zc - r - 0.24, ang, 0, -0.2, 0.7, 0.24, 0.14, trim)   # a little sill


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
        siding_lines("clapboard", cx, yf, yb, w, z0, wall, c)


MORTAR_K = 1.2   # mortar courses: a light shade of the (brick) body, so they recolour with it


def siding_lines(siding, cx, yf, yb, w, z0, wall, c):
    """clapboard: the darker board lines round the walls. brick: thin mortar courses."""
    depth = yb - yf
    cy = (yf + yb) / 2
    n, rgb, h = (6, shade(c["body"], 0.86), 0.14) if siding == "clapboard" else (9, shade(c["body"], MORTAR_K), 0.06)
    for i in range(1, n):
        z = z0 + i * wall / n
        for sx in (-1, 1):
            box(cx + sx * (w / 2 + 0.03), cy, z, 0.08, depth - 0.5, h, rgb)
        box(cx, yb + 0.03, z, w - 0.5, 0.08, h, rgb)
        box(cx, yf - 0.03, z, w - 0.5, 0.08, h, rgb)


def gable_lines(siding, cx, yf, w, zw, rise, c):
    """The siding carried up a front gable's face (gable_roof(..., strips=False) leaves it off)."""
    step, rgb, h = (1.1, shade(c["body"], 0.86), 0.14) if siding == "clapboard" else (0.74, shade(c["body"], MORTAR_K), 0.06)
    for i in range(1, int(rise * 0.55 / step) + 1):
        z = zw + i * step
        hw = (rise - (z - zw)) * (w / 2) / rise - 0.25
        box(cx, yf - 0.03, z, 2 * hw, 0.08, h, rgb)


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
    elif style == "valance":    # half-round scallops hung along the bargeboards, like the porch valance
        ca, sa = math.cos(a), math.sin(a)
        for s in (-1, 1):
            ux, uz = s * ca, -sa                 # down the board
            dx, dz = -s * sa, -ca                # away from it, below
            k = 7
            seg = 0.86 * L / k
            r = seg / 2
            for j in range(k):
                cx, cz = along(s, 0.1 + (j + 0.5) * 0.86 / k, 0.36)
                pts = [(cx + r * math.cos(t) * ux + 0.9 * r * math.sin(t) * dx, cz + r * math.cos(t) * uz + 0.9 * r * math.sin(t) * dz)
                       for t in (math.radians(d) for d in (0, 45, 90, 135, 180))]
                hull([(px, yy, pz) for px, pz in pts for yy in (y - 0.05, y + 0.05)], trim)
        box(rx, y, z_under - 0.35, 0.16, 0.12, 0.9, trim)
        box(rx, y, z_under - 0.9, 0.3, 0.12, 0.3, trim, rot=d45)
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
                ln, up = 0.45, 0.3 + 0.2 * abs(math.tan(a))   # every drop the same, reaching up into the board
                box(px, y, pz + (up - ln) / 2, 0.09, 0.1, ln + up, trim)
                box(px, y, pz - ln - 0.08, 0.24, 0.1, 0.24, trim, rot=d45)
        box(rx, y, z_under - 0.65, 0.16, 0.14, 1.9, trim)
        box(rx, y, z_under - 1.75, 0.38, 0.12, 0.38, trim, rot=d45)
        box(rx, y, z_under - 0.45, 0.9, 0.12, 0.14, trim)


def front_gable_trim(style, cx, yf, w, zw, rise, ovy, trim):
    """The gingerbread of a gable_roof(cx, yf, ..., w, zw, rise, ovy=ovy) on its own."""
    a, L, (rx, rz) = roof_frame(cx, w, zw, rise)
    gable_trim(style, rx, rz, yf - ovy + 0.14, a, L, w, rise, trim)


def gable_roof(cx, yf, yb, w, zw, rise, c, ov=0.55, ovy=0.5, finial=True, gingerbread="scallop", strips=True):
    """A steep front-to-back gable on walls topping out at zw, with its trim
    (gingerbread: one of GINGERBREAD, or None to leave it off, e.g. to ship it as its own part)."""
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
    if strips:
        gable_lines("clapboard", cx, yf, w, zw, rise, c)
    if finial:
        fy = yf - ovy + 0.25
        ball(rx, fy, rz + 0.45, 0.4, 0.4, 0.4, trim, seg=6, ring=4)
        can(rx, fy, rz + 1.3, 0.13, 1.6, trim, n=6, r2=0.0)
    return a


def gabled_mass(cx, yf, yb, w, z0, wall, rise, c, ov=0.55, ovy=0.5, finial=True, gingerbread="scallop", ridges=True):
    """Walls plus a steep front gable: the body of the house and of the side wing."""
    walls(cx, yf, yb, w, z0, wall, c, ridges)
    return gable_roof(cx, yf, yb, w, z0 + wall, rise, c, ov, ovy, finial, gingerbread)


def hip_z(w, zw, rise, ov=0.6):
    """z(x, y) of the top surface of hip_roof(w, zw, rise, ov=ov)."""
    hw = w / 2 + ov
    ye, yk = Y0 - ov, Y1 + ov
    mid = (ye + yk) / 2
    yr0, yr1 = min(ye + hw, mid), max(yk - hw, mid)
    z0 = zw - 0.05

    def z_at(x, y):
        fx = (hw - abs(x)) / hw
        fy = (y - ye) / (yr0 - ye) if y < yr0 else (yk - y) / (yk - yr1) if y > yr1 else 1.0
        return z0 + 0.25 + (zw + rise - z0 - 0.25) * max(0.0, min(fx, fy))
    return z_at


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
    return hip_z(w, zw, rise, ov)


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
    # no finials here: at 3/4 they doubled up with the front gable's


def cross_gable_round(w, cy, zw, R, c, ovx=0.22, n=6):
    """A side gable whose ends are half-circles: a barrel roof of n facets across the house."""
    body, roof, trim = c["body"], c["roof"], c["trim"]
    hw = w / 2
    angs = [math.pi * i / n for i in range(n + 1)]
    hull([(sx * hw, cy + R * math.cos(a), zw + R * math.sin(a)) for sx in (-1, 1) for a in angs], body)
    t, da = 0.34, math.pi / n
    for i in range(n):
        am = (angs[i] + angs[i + 1]) / 2
        rr = (R + t / 2) * math.cos(da / 2)
        chord = 2 * (R + t) * math.sin(da / 2) + 0.06
        box(0, cy + rr * math.cos(am), zw + rr * math.sin(am), w + 2 * ovx, chord, t, roof, bevel=0.04, rot=(am + math.pi / 2, 0, 0))
        rb = (R - 0.12) * math.cos(da / 2)
        for xx in (-(hw + ovx - 0.12), hw + ovx - 0.12):     # bargeboards following the curve
            box(xx, cy + rb * math.cos(am), zw + rb * math.sin(am), 0.16, 2 * R * math.sin(da / 2) + 0.04, 0.3, trim,
                rot=(am + math.pi / 2, 0, 0))
    for xx in (-(hw + ovx - 0.12), hw + ovx - 0.12):         # a keystone drop at the crown
        box(xx, cy, zw + R - 0.55, 0.1, 0.3, 0.3, trim, rot=(math.radians(45), 0, 0))


CROSS_CY, CROSS_SPAN = 2.2, 4.4


def cross_windows(W, gable_window, c):
    """The windows in the cross gable's two end gables."""
    hw = W / 2
    for sx in (-1, 1):
        if gable_window == "round":
            round_window(sx * hw, CROSS_CY, F + WALL + 1.5, sx * math.pi / 2, 0.55, True, c["trim"])
        else:
            window(sx * hw, CROSS_CY, F + WALL + 1.25, sx * math.pi / 2, 0.9, 1.1, True, c["trim"], mull=False)


HG_YF, HG_YB, HG_W, HG_RISE, HG_LIFT = Y0 - 0.5, Y0 + 3.6, 4.4, 3.6, 0.2


def hip_front_gable(c):
    """A little front gable sitting on the hip roof's front eave (the same at every width:
    its back end is buried in the hip), with diamond drops like the cross gable's."""
    zb = F + WALL + HG_LIFT
    gable_roof(0, HG_YF, HG_YB, HG_W, zb, HG_RISE, c, ov=0.4, ovy=0.4, finial=True, gingerbread=None, strips=False)
    a, L, (rx, rz) = roof_frame(0, HG_W, zb, HG_RISE)
    y = HG_YF - 0.4 + 0.14
    for s in (-1, 1):
        for i in range(4):
            d = (0.16 + i * 0.2) * L
            box(rx + s * math.cos(a) * d - s * math.sin(a) * 0.5, y, rz - math.sin(a) * d - math.cos(a) * 0.5,
                0.26, 0.1, 0.26, c["trim"], rot=(0, math.radians(45), 0))


def gable_window_at(gable_window, cx, cy, zb, trim, w=1.6, h=2.6, r=0.85, zr=None):
    """The attic window of a front gable: arched (w x h, bottom at zb) or round (radius r, centre zr)."""
    if gable_window == "round":
        round_window(cx, cy, zr if zr is not None else zb + h * 0.5, 0.0, r, True, trim)
    else:
        arched_window(cx, cy, zb, w, h, True, trim)


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


BAL_W, BAL_D = 3.0, 1.5


def balcony(c, zw, rail="plain"):
    """A little balcony on the porch roof under the front gable, with a glowing door
    (rail=None leaves the railings off: balcony_rail ships them as their own part)."""
    trim, wood = c["trim"], c["porch"]
    bw, bd = BAL_W, BAL_D
    zt = zw + 0.35
    yf = Y0 - bd
    box(0, Y0 - bd / 2, zt - 0.6, bw, bd, 1.0, shade(c["roof"], 1.15))  # the block sitting in the porch roof
    box(0, Y0 - bd / 2 - 0.05, zt - 0.06, bw + 0.2, bd + 0.1, 0.16, DECK, bevel=0.03)
    box(0, yf - 0.02, zt - 0.3, bw + 0.24, 0.14, 0.32, wood)
    xs = (-bw / 2 + 0.12, bw / 2 - 0.12)
    for x in xs:
        box(x, yf + 0.12, zt + 0.7, 0.24, 0.24, 1.4, wood)
        ball(x, yf + 0.12, zt + 1.48, 0.28, 0.28, 0.24, wood, seg=6, ring=4)
    if rail:
        balcony_rail(c, zw, rail)
    arched_window(0, Y0, zt + 0.05, 1.5, 3.0, True, trim)


def balcony_rail(c, zw, rail):
    trim = c["porch"]
    zt = zw + 0.35
    yf = Y0 - BAL_D
    xs = (-BAL_W / 2 + 0.12, BAL_W / 2 - 0.12)
    railing((xs[0] + 0.12, yf + 0.12), (xs[1] - 0.12, yf + 0.12), zt, zt + 1.3, trim, spacing=0.45, style=rail)
    for x in xs:
        railing((x, yf + 0.24), (x, Y0 - 0.15), zt, zt + 1.3, trim, spacing=0.45, style=rail)


# ---------------------------------------------------------------- porch

def turned_post(x, y, z0, z1, trim):
    box(x, y, z0 + 0.35, 0.44, 0.44, 0.7, trim)
    can(x, y, (z0 + 0.7 + z1 - 0.4) / 2, 0.15, z1 - z0 - 1.1, trim, n=6)
    for zz in (z0 + 1.9, z1 - 1.3):    # the lower collar is where the top rail meets the post
        can(x, y, zz, 0.21, 0.5, trim, n=6)
    box(x, y, z1 - 0.2, 0.42, 0.42, 0.4, trim)


def railing(p0, p1, z0, z1, trim, spacing=0.5, style="plain", ext=0.2):
    """A straight railing from p0 to p1 (xy), deck at z0, top rail at z1; the rails run
    on ext past both ends, into the posts (or wall) they span between.
    plain: square balusters. fancy: flat sawn balusters with a diamond bulge
    (a low-poly turned spindle), a sparser rhythm and a capped top rail."""
    (x0, y0), (x1, y1) = p0, p1
    L = math.hypot(x1 - x0, y1 - y0)
    ang = math.atan2(y1 - y0, x1 - x0)
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    box(mx, my, z1, L + 2 * ext, 0.2, 0.18, trim, rot=(0, 0, ang))
    box(mx, my, z0 + 0.35, L + 2 * ext, 0.14, 0.14, trim, rot=(0, 0, ang))
    zb, hb = (z0 + 0.35 + z1) / 2, z1 - z0 - 0.35
    if style == "fancy":
        box(mx, my, z1 + 0.13, L + 2 * ext, 0.28, 0.08, trim, rot=(0, 0, ang))   # the cap
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
    """Hanging spindles and a bottom rail under a porch beam from p0 to p1."""
    (x0, y0), (x1, y1) = p0, p1
    L = math.hypot(x1 - x0, y1 - y0)
    ang = math.atan2(y1 - y0, x1 - x0)
    n = int(L / spacing)
    for i in range(n + 1):
        f = i / n
        box(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, POST_TOP - 0.25, 0.09, 0.12, 0.5, trim, rot=(0, 0, ang))
    box((x0 + x1) / 2, (y0 + y1) / 2, POST_TOP - 0.52, L, 0.16, 0.1, trim, rot=(0, 0, ang))


def frieze_run(style, p0, p1, posts, trim, spacing):
    """A porch frieze hung under the beam from p0 to p1 (xy); posts are the post
    positions as distances along the run. They echo the gable gingerbread:
    valance: a valance board with a row of half-round scallops
    scallop: the gable scallop's diamond drops hung in a row, with corner brackets
    sunburst: a fan bracket (hub and three rays) in each corner of each bay
    pendant: a board with a row of hanging drops, long and short, each with a bead"""
    (x0, y0), (x1, y1) = p0, p1
    L = math.hypot(x1 - x0, y1 - y0)
    ang = math.atan2(y1 - y0, x1 - x0)
    ux, uy = (x1 - x0) / L, (y1 - y0) / L
    zt = POST_TOP

    def at(t, n=0.0):
        return x0 + ux * t - uy * n, y0 + uy * t + ux * n

    def lbox(t, z, sl, sn, sz, tilt=0.0):
        x, y = at(t)
        box(x, y, z, sl, sn, sz, trim, rot=(0, tilt, ang))

    def plate(pts, th=0.1):        # a flat convex plate in the run's plane from (t, z) points
        hull([(*at(t, n), z) for t, z in pts for n in (-th / 2, th / 2)], trim)

    ps = sorted({0.0, L, *[min(L, max(0.0, p)) for p in posts]})
    bays = [(a + 0.22, b - 0.22) for a, b in zip(ps, ps[1:]) if b - a > 0.8]
    if style == "scallop":
        for a, b in bays:
            k = max(1, round((b - a) / 0.46))
            for j in range(k):
                lbox(a + (j + 0.5) * (b - a) / k, zt - 0.12, 0.3, 0.1, 0.3, tilt=math.radians(45))
        for p in ps:
            for s in (-1, 1):
                if -0.1 < p + s * 0.45 < L + 0.1:
                    lbox(p + s * 0.32, zt - 0.3, 0.12, 0.14, 0.7, tilt=s * math.radians(-45))
    elif style == "valance":
        zb = zt - 0.26
        lbox(L / 2, zt - 0.13, L, 0.12, 0.26)
        for a, b in bays:
            k = max(1, round((b - a) / 0.8))
            r = (b - a) / (2 * k)
            for j in range(k):
                tc = a + r * (2 * j + 1)
                plate([(tc + r * math.cos(th), zb + 0.9 * r * math.sin(th))
                       for th in (math.radians(d) for d in (180, 225, 270, 315, 360))])
    elif style == "sunburst":
        for p in ps:
            for s in (-1, 1):
                if not -0.1 < p + s * 0.45 < L + 0.1:
                    continue
                nxt = [q for q in ps if (q - p) * s > 0.01]
                gap = min(abs(q - p) for q in nxt) if nxt else 0.0
                R = min(1.15, (gap - 0.42) / 2 - 0.05)
                if R < 0.32:
                    continue
                t0 = p + s * 0.21

                def pt(deg, rad):
                    th = math.radians(deg)
                    return (t0 + s * rad * math.cos(th), zt - rad * math.sin(th))
                plate([(t0, zt)] + [pt(d, 0.3) for d in (0, 30, 60, 90)])               # the hub
                for d in (14, 45, 76):                                                    # the rays
                    plate([pt(d - 8, 0.3), pt(d + 8, 0.3), pt(d - 9, R * 0.9), pt(d, R), pt(d + 9, R * 0.9)])
    elif style == "pendant":
        lbox(L / 2, zt - 0.09, L, 0.12, 0.18)
        for a, b in bays:
            k = max(1, round((b - a) / (spacing * 1.25)))
            for j in range(k):
                t = a + (j + 0.5) * (b - a) / k
                ln = 0.5 if j % 2 == 0 else 0.26
                lbox(t, zt - 0.18 - ln / 2, 0.08, 0.08, ln)
                lbox(t, zt - 0.18 - ln - 0.08, 0.22, 0.1, 0.22, tilt=math.radians(45))


def porch_frame(W, lay, kind):
    """Where everything on the porch goes, for a porch kind on a body width."""
    f = dict(kind=kind, wrap=kind == "wrap")
    if kind == "left":
        f.update(px0=-W / 2 - 0.2, px1=lay["px1_left"], door_x=lay["door_left"],
                 front_wins=list(lay["in_left"]), out_wins=list(lay["out_left"]))
    else:
        f.update(px0=-W / 2 - 0.2, px1=W / 2 + 0.2, door_x=0.0, front_wins=list(lay["centre"]), out_wins=[])
    if f["wrap"]:
        f["px0"] = -W / 2 - PORCH_D   # the front deck runs on to the corner of the side porch
    f["fs"], f["rs"] = (0.6, 0.66) if f["wrap"] else (0.42, 0.5)   # the long wrap porch gets sparser spindles to stay in budget
    px0, px1, door_x = f["px0"], f["px1"], f["door_x"]
    f["pyf"] = Y0 - PORCH_D
    f["py"] = f["pyf"] + 0.3
    f["sx0"], f["sx1"] = door_x - 1.75, door_x + 1.75
    # posts: the porch ends and either side of the steps (a step post only
    # gives way to an end post standing right next to it)
    post_xs = [px0 + 0.3, px1 - 0.3]
    if f["wrap"]:
        post_xs.append(-W / 2 - 0.2 + 0.3)
    for x in (f["sx0"], f["sx1"]):
        if all(abs(x - p) > 0.5 for p in post_xs):
            post_xs.append(x)
    f["post_xs"] = sorted(post_xs)
    # the side run of the wrap-around porch, down the left wall
    f["x1s"] = -W / 2
    f["ye"] = Y0 + SIDE_L
    f["sx"] = px0 + 0.3
    f["side_ys"] = [f["py"], (f["py"] + f["ye"] - 0.3) / 2, f["ye"] - 0.3]
    return f


def porch_body(c, W, lay, kind):
    """Deck, door, the windows under the porch roof, posts, beams, roof and steps."""
    f = porch_frame(W, lay, kind)
    trim, roof, wood = c["trim"], c["roof"], c["porch"]   # wood: the porch's own trim colour
    found = c.get("found", shade(roof, 1.3))
    px0, px1, door_x, pyf, py, wrap = f["px0"], f["px1"], f["door_x"], f["pyf"], f["py"], f["wrap"]
    pcx, pcy = (px0 + px1) / 2, (pyf + Y0) / 2
    box(pcx, pcy, (F - 0.16) / 2, px1 - px0 - 0.2, PORCH_D - 0.1, F - 0.16, found)        # skirt
    box(pcx, pcy - 0.05, F - 0.08, px1 - px0, PORCH_D + 0.1, 0.16, DECK, bevel=0.04)   # deck

    front_door(door_x, trim)
    for x, w in f["front_wins"]:
        window(x, Y0, F + 2.6, 0.0, w, 2.5, True, trim)
    for x in f["post_xs"]:
        turned_post(x, py, F, POST_TOP, wood)
    # beam and its returns to the wall
    box(pcx, py, POST_TOP + 0.25, px1 - px0, 0.4, 0.5, wood)
    for s in (0, 1):
        x = (px0, px1)[s] + (0.3 if s == 0 else -0.3)
        box(x, (py + Y0) / 2, POST_TOP + 0.25, 0.4, Y0 - py, 0.5, wood)
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
    box(pcx, pyf - ov + 0.06, zr0 - 0.12, px1 - px0 + 2 * ov - 0.1, 0.14, 0.26, wood)  # fascia

    # steps up to the porch, with newels and sloped handrails
    rise, tread, nsteps = F / 3, 0.6, 3
    for i in range(nsteps):
        depth = (nsteps - i) * tread
        box(door_x, pyf - depth / 2 + 0.05, (i + 0.5) * rise, 3.0, depth + 0.1, rise, DECK if i % 2 == 0 else shade(DECK, 0.92))
    yb = pyf - nsteps * tread
    for sx in (f["sx0"], f["sx1"]):
        x = min(f["post_xs"], key=lambda p: abs(p - sx))   # the handrails run to the post nearest the steps
        box(x, yb + 0.25, 1.0, 0.36, 0.36, 2.0, wood)
        ball(x, yb + 0.25, 2.1, 0.36, 0.36, 0.3, wood, seg=6, ring=4)
        limb((x, yb + 0.25, 1.95), (x, py, F + 1.95), 0.08, wood)
        limb((x, yb + 0.25, 0.35), (x, py, F + 0.35), 0.06, wood)
        for fr in (0.33, 0.66):
            yy = yb + 0.25 + (py - yb - 0.25) * fr
            box(x, yy, 0.35 + fr * F + 0.8, 0.1, 0.1, 1.6, wood)

    if wrap:     # the side run of the wrap-around porch, down the left wall
        x0, x1, ye, sx = px0, f["x1s"], f["ye"], f["sx"]
        scx, scy = (x0 + x1) / 2, (Y0 + ye) / 2
        box(scx, scy, (F - 0.16) / 2, x1 - x0 - 0.1, SIDE_L, F - 0.16, found)
        box(scx - 0.05, scy, F - 0.08, x1 - x0 + 0.1, SIDE_L + 0.1, 0.16, DECK, bevel=0.04)
        for y in f["side_ys"][1:]:
            turned_post(sx, y, F, POST_TOP, wood)
        y0s, y1s = py + 0.3, ye - 0.3
        box(sx, (y0s + y1s) / 2, POST_TOP + 0.25, 0.4, y1s - y0s + 0.4, 0.5, wood)   # side beam
        box((sx + x1) / 2, ye - 0.3, POST_TOP + 0.25, x1 - sx, 0.4, 0.5, wood)
        # its roof: same pitch as the front, meeting it in a hip at the corner
        sp = [(x, y, z) for x in (x0 - ov, x1 + 0.05) for y in (pyf - ov, ye + ov) for z in (zr0, zr0 + 0.22)]
        sp += [(x1 + 0.05, Y0 + 0.05, zr0 + PORCH_RISE), (x1 + 0.05, ye + ov - 0.9, zr0 + PORCH_RISE)]
        hull(sp, roof, bevel=0.04)
        box(x0 - ov + 0.06, (pyf + ye) / 2, zr0 - 0.12, 0.14, ye - pyf + 2 * ov - 0.1, 0.26, wood)


def porch_windows_right(c, W, lay):
    """The left porch's front window(s) right of the porch roof (the turret takes their place)."""
    for x, w in lay["out_left"]:
        window(x, Y0, F + 2.6, 0.0, w, 2.5, True, c["trim"])


def porch_boxes(c, W, lay, kind, right=False):
    """Window boxes under the porch's front windows (right: under the left porch's outer windows)."""
    f = porch_frame(W, lay, kind)
    wins = f["out_wins"] if right else f["front_wins"]
    k0 = len(f["front_wins"]) if right else 0
    for i, (x, w) in enumerate(wins):
        window_box(x, Y0, F + 2.6, 0.0, w, 2.5, c, k0 + i)


def porch_rails(c, W, lay, kind, rail):
    """Railings across the front either side of the steps, the porch ends and the wrap's side run."""
    f = porch_frame(W, lay, kind)
    trim, py, rs, wrap = c["porch"], f["py"], f["rs"], f["wrap"]
    rz = F + 1.95
    xs = f["post_xs"]
    for a, b in zip(xs, xs[1:]):
        if a < f["sx1"] - 0.3 and b > f["sx0"] + 0.3:
            continue  # the step opening
        railing((a + 0.22, py), (b - 0.22, py), F, rz, trim, rs, rail)
    if not wrap:
        railing((xs[0], py + 0.22), (xs[0], Y0 - 0.15), F, rz, trim, rs, rail)
    railing((xs[-1], py + 0.22), (xs[-1], Y0 - 0.15), F, rz, trim, rs, rail)
    if wrap:
        sx, side_ys = f["sx"], f["side_ys"]
        for a, b in zip(side_ys, side_ys[1:]):
            railing((sx, a + 0.22), (sx, b - 0.22), F, rz, trim, rs, rail)
        railing((sx + 0.22, f["ye"] - 0.3), (f["x1s"] - 0.15, f["ye"] - 0.3), F, rz, trim, rs, rail)


def porch_frieze(c, W, lay, kind, style="spindle"):
    """The frieze under the porch beams: one of FRIEZES."""
    f = porch_frame(W, lay, kind)
    trim, px0, px1, py, fs = c["porch"], f["px0"], f["px1"], f["py"], f["fs"]
    if style == "spindle":    # spindles, a bottom rail and corner brackets
        n = int((px1 - px0 - 0.6) / fs)
        for i in range(n + 1):
            x = px0 + 0.3 + i * (px1 - px0 - 0.6) / n
            box(x, py, POST_TOP - 0.25, 0.09, 0.12, 0.5, trim)
        box((px0 + px1) / 2, py, POST_TOP - 0.52, px1 - px0 - 0.6, 0.16, 0.1, trim)
        for x in f["post_xs"]:
            for s in (-1, 1):
                if px0 + 0.2 < x + s * 0.45 < px1 - 0.2:
                    box(x + s * 0.32, py, POST_TOP - 0.55, 0.12, 0.14, 0.7, trim, rot=(0, s * math.radians(-45), 0))
        if f["wrap"]:
            sx = f["sx"]
            spindle_frieze((sx, py + 0.3), (sx, f["ye"] - 0.3), trim, fs)
            for y in f["side_ys"][1:]:
                for s in (-1, 1):
                    box(sx, y + s * 0.32, POST_TOP - 0.55, 0.14, 0.12, 0.7, trim, rot=(s * math.radians(45), 0, 0))
        return
    x0 = px0 + 0.3
    frieze_run(style, (x0, py), (px1 - 0.3, py), [x - x0 for x in f["post_xs"]], trim, fs)
    if f["wrap"]:
        sx = f["sx"]
        frieze_run(style, (sx, py), (sx, f["ye"] - 0.3), [y - py for y in f["side_ys"]], trim, fs)


def porch(c, W, lay, kind, turret, boxes, rail="plain", frieze="spindle"):
    """Deck, door, front windows, posts, frieze, roof, steps and railings."""
    porch_body(c, W, lay, kind)
    if kind == "left" and not turret:
        porch_windows_right(c, W, lay)
    if boxes:
        porch_boxes(c, W, lay, kind)
        if kind == "left" and not turret:
            porch_boxes(c, W, lay, kind, right=True)
    porch_rails(c, W, lay, kind, rail)
    porch_frieze(c, W, lay, kind, frieze)


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


WING_W, WING_WALL, WING_RISE, WING_OVY = 4.6, 4.6, 4.75, 0.4


def wing_frame(W):
    return W / 2 + 2.0, Y0 + 2.6, Y1 - 0.4      # wx, wy0, wy1


def wing_body(c, W):
    """A lower side wing with its own front gable, set back on the right (its siding,
    gingerbread, attic window, side window, window box and chimney are separate parts).
    A left wing is this mirrored."""
    trim, roof = c["trim"], c["roof"]
    found = c.get("found", shade(roof, 1.3))
    ww, (wx, wy0, wy1) = WING_W, wing_frame(W)
    box(wx + 0.2, (wy0 + wy1) / 2, F / 2, ww - 0.1, wy1 - wy0 + 0.3, F, found)
    walls(wx, wy0, wy1, ww, F, WING_WALL, c, ridges=False)
    gable_roof(wx, wy0, wy1, ww, F + WING_WALL, WING_RISE, c, ov=0.45, ovy=WING_OVY, finial=True, gingerbread=None, strips=False)
    window(wx + 0.2, wy0, F + 2.4, 0.0, 1.4, 2.4, True, trim)


def wing_siding(c, W, siding):
    wx, wy0, wy1 = wing_frame(W)
    siding_lines(siding, wx, wy0, wy1, WING_W, F, WING_WALL, c)
    gable_lines(siding, wx, wy0, WING_W, F + WING_WALL, WING_RISE, c)


def wing_attic(c, W, gable_window):
    wx, wy0, _ = wing_frame(W)
    gable_window_at(gable_window, wx, wy0, F + WING_WALL + 0.6, c["trim"], w=1.0, h=1.7, r=0.5, zr=F + WING_WALL + 1.45)


def wing_trim(c, W, gingerbread):
    wx, wy0, _ = wing_frame(W)
    front_gable_trim(gingerbread, wx, wy0, WING_W, F + WING_WALL, WING_RISE, WING_OVY, c["trim"])


def wing_side_window(c, W, chim=False):
    wx, wy0, wy1 = wing_frame(W)
    window(wx + WING_W / 2, (wy0 + wy1) / 2 - (0.6 if chim else 0), F + 2.4, math.pi / 2, 1.3, 2.4, False, c["trim"])


def wing_boxes(c, W):
    wx, wy0, _ = wing_frame(W)
    window_box(wx + 0.2, wy0, F + 2.4, 0.0, 1.4, 2.4, c, 1)


def wing_chimney(c, W):
    """The chimney climbing the wing's outer wall."""
    wx, _, wy1 = wing_frame(W)
    chimney(wx + WING_W / 2, wy1 - 1.0, 1, F + WING_WALL, c)


# ---------------------------------------------------------------- the house, as parts

ROOFS = ("gable", "hip", "hip-gable", "cross")
PORCHES = ("left", "right", "centre", "wrap")        # right: the left porch mirrored
FRIEZES = ("spindle", "valance", "scallop", "sunburst", "pendant")
SIDINGS = ("clapboard", "brick")
GABLE_WINDOWS = ("arched", "round")
CROSS_STYLES = ("pointy", "round")
SIDED = ("turret", "bay", "wing", "chimney")         # extras that go on a side: none / left / right / both
SIDES = ("none", "left", "right", "both")
ZW = F + WALL
CHIM_Y = Y1 - 0.85


def _dims(width):
    return WIDTHS[width], LAYOUT[width], RISES[width]


def _gable_z(W, rise):
    a = math.atan2(rise, W / 2)
    return lambda x, y: ZW + rise * (1 - abs(x) / (W / 2)) + 0.38 / math.cos(a)


def _side_window(c, W, s, y, lit, k=None, box_only=False):
    """A ground-floor side window (s -1 left, +1 right) and/or its window box (k)."""
    ang = s * math.pi / 2
    if not box_only:
        window(s * W / 2, y, F + 2.6, ang, 1.3, 2.4, lit, c["trim"])
    if k is not None:
        window_box(s * W / 2, y, F + 2.6, ang, 1.3, 2.4, c, k)


def _upper_side_window(c, W, s, lit):
    window(s * W / 2, 2.0, F + WALL - 1.4, s * math.pi / 2, 1.0, 1.2, lit, c["trim"], mull=False)


def _walls_part(c, width):
    W, lay, _ = _dims(width)
    box(0, (Y0 + Y1) / 2, F / 2, W + 0.3, D + 0.3, F, c.get("found", shade(c["roof"], 1.3)), bevel=0.06)
    walls(0, Y0, Y1, W, F, WALL, c, ridges=False)
    bx = lay["back"]
    for x, lit in ((-bx, False), (bx, True)):
        window(x, Y1, F + 2.6, math.pi, 1.3, 2.4, lit, c["trim"])


def _roof_part(kind):
    def build(c, width):
        W, _, rise = _dims(width)
        if kind == "hip":
            hip_roof(W, ZW, rise * HIP_K, c)
            return
        gable_roof(0, Y0, Y1, W, ZW, rise, c, gingerbread=None, strips=False)
        window(0, Y1, ZW + 1.8, math.pi, 1.1, 1.5, False, c["trim"], mull=False)   # the back gable's window
    return build


def _cross_part(style):
    def build(c, width):
        W, _, rise = _dims(width)
        if style == "round":
            cross_gable_round(W, CROSS_CY, ZW, CROSS_SPAN / 2 + 0.1, c)
        else:
            cross_gable(W, CROSS_CY, ZW, CROSS_SPAN, CROSS_SPAN / 2 * rise / (W / 2), c, ovx=0.22)   # tucked back, short overhang
    return build


def _dormer_part(kind):
    def build(c, width):
        W, _, rise = _dims(width)
        if kind == "hip":      # on the front slope, over the porch roof
            yd = Y0 + 0.6
            dormer(0, yd, hip_z(W, ZW, rise * HIP_K)(0, yd) - 0.08, 0.0, c, dd=3.8)
        else:                  # on the right slope, seen from the street at 3/4
            xd = W / 2 - 1.4
            dormer(xd, 0.8, _gable_z(W, rise)(xd, 0.8) - 0.08, math.pi / 2, c)
    return build


_SWAP = {"left": "right", "right": "left"}


def mirror_cond(cond):
    """A part condition seen in the mirror: left and right swap."""
    return {k: ([_SWAP.get(v, v) for v in vals] if k in SIDED + ("porch",) else vals) for k, vals in cond.items()}


def part_defs():
    """Every part of the kit as dicts: name, slot, option, when, when_mirror, build, shared.

    `when` is a list of alternative conditions (the part is in a house if any of
    them holds), each a dict of spec key -> allowed values; build(c, width) makes
    the part's pieces in house space. A mirrorable part is also used mirrored
    (x -> -x, faces flipped) when `when_mirror` holds: the left wing, bay, chimney,
    turret and the right porch are the right/left ones in the mirror. Parts are per
    body width (file <name>-<width>) unless shared."""
    P = []
    T, Fa = [True], [False]
    R, L = ["right", "both"], ["left", "both"]
    NR, NL = ["none", "left"], ["none", "right"]
    gabled, hips = ["gable", "cross"], ["hip", "hip-gable"]

    def add(name, slot, option, when, build, shared=False, mirror=False):
        P.append(dict(name=name, slot=slot, option=option, when=when, build=build, shared=shared,
                      when_mirror=[mirror_cond(cnd) for cnd in when] if mirror else None))
    add("walls", "walls", "", [{}], _walls_part)
    for sd in SIDINGS:
        add(f"siding-{sd}", "siding", sd, [{"siding": [sd]}],
            lambda c, wd, sd=sd: siding_lines(sd, 0, Y0, Y1, WIDTHS[wd], F, WALL, c))
        add(f"gable-siding-{sd}", "siding", f"gable-{sd}", [{"siding": [sd], "roof": gabled}],
            lambda c, wd, sd=sd: gable_lines(sd, 0, Y0, WIDTHS[wd], ZW, RISES[wd], c))
    add("roof-gable", "roof", "gable", [{"roof": gabled}], _roof_part("gable"))
    add("roof-hip", "roof", "hip", [{"roof": hips}], _roof_part("hip"))
    for cs in CROSS_STYLES:
        add(f"cross-{cs}", "cross", cs, [{"roof": ["cross"], "cross_style": [cs]}], _cross_part(cs))
    add("hip-gable", "hip-gable", "", [{"roof": ["hip-gable"]}], lambda c, wd: hip_front_gable(c), shared=True)
    for gw in GABLE_WINDOWS:
        add(f"attic-window-{gw}", "gable-window", gw, [{"roof": gabled, "balcony": Fa, "gable_window": [gw]}],
            lambda c, wd, gw=gw: gable_window_at(gw, 0, Y0, ZW + 1.3, c["trim"], zr=ZW + 2.5))
        add(f"cross-windows-{gw}", "gable-window", f"cross-{gw}", [{"roof": ["cross"], "gable_window": [gw]}],
            lambda c, wd, gw=gw: cross_windows(WIDTHS[wd], gw, c))
        add(f"hip-gable-window-{gw}", "gable-window", f"hip-gable-{gw}", [{"roof": ["hip-gable"], "gable_window": [gw]}],
            lambda c, wd, gw=gw: gable_window_at(gw, 0, HG_YF, ZW + HG_LIFT + 0.35, c["trim"], w=1.1, h=1.9, r=0.6,
                                                 zr=ZW + HG_LIFT + 1.35), shared=True)
    for g in GINGERBREAD:
        add(f"gable-{g}", "gable", g, [{"roof": gabled, "gingerbread": [g]}],
            lambda c, wd, g=g: front_gable_trim(g, 0, Y0, WIDTHS[wd], ZW, RISES[wd], 0.5, c["trim"]))
    # side windows: each wall gives way to a wing, a bay or a chimney on its side
    add("windows-left", "side-windows", "left", [{"wing": NL}],
        lambda c, wd: (_side_window(c, WIDTHS[wd], -1, -0.3, True), _upper_side_window(c, WIDTHS[wd], -1, False)))
    add("window-left-rear", "side-windows", "left-rear", [{"wing": NL, "bay": NL, "chimney": NL}],
        lambda c, wd: _side_window(c, WIDTHS[wd], -1, 3.6, True))
    add("window-left-rear-chim", "side-windows", "left-rear-chimney", [{"wing": NL, "bay": NL, "chimney": L}],
        lambda c, wd: _side_window(c, WIDTHS[wd], -1, 2.6, True))
    add("windows-right", "side-windows", "right", [{"wing": NR}],
        lambda c, wd: (_side_window(c, WIDTHS[wd], 1, -0.3, True), _upper_side_window(c, WIDTHS[wd], 1, True)))
    add("window-right-rear", "side-windows", "right-rear", [{"wing": NR, "bay": NR, "chimney": NR}],
        lambda c, wd: _side_window(c, WIDTHS[wd], 1, 3.6, False))
    add("window-right-rear-chim", "side-windows", "right-rear-chimney", [{"wing": NR, "bay": NR, "chimney": R}],
        lambda c, wd: _side_window(c, WIDTHS[wd], 1, 2.6, False))
    add("boxes-right", "boxes", "right", [{"boxes": T, "wing": NR}],
        lambda c, wd: _side_window(c, WIDTHS[wd], 1, -0.3, True, 2, box_only=True))
    add("boxes-right-rear", "boxes", "right-rear", [{"boxes": T, "wing": NR, "bay": NR, "chimney": NR}],
        lambda c, wd: _side_window(c, WIDTHS[wd], 1, 3.6, False, 0, box_only=True))
    add("boxes-right-rear-chim", "boxes", "right-rear-chimney", [{"boxes": T, "wing": NR, "bay": NR, "chimney": R}],
        lambda c, wd: _side_window(c, WIDTHS[wd], 1, 2.6, False, 0, box_only=True))
    # the porch and its options (the left porch mirrors into the right porch)
    for k in ("left", "centre", "wrap"):
        m = k == "left"
        add(f"porch-{k}", "porch", k, [{"porch": [k]}], lambda c, wd, k=k: porch_body(c, WIDTHS[wd], LAYOUT[wd], k), mirror=m)
        add(f"boxes-porch-{k}", "boxes", f"porch-{k}", [{"boxes": T, "porch": [k]}],
            lambda c, wd, k=k: porch_boxes(c, WIDTHS[wd], LAYOUT[wd], k), mirror=m)
        for r in RAILS:
            add(f"rail-{r}-{k}", "rail", f"{r}/{k}", [{"rail": [r], "porch": [k]}],
                lambda c, wd, k=k, r=r: porch_rails(c, WIDTHS[wd], LAYOUT[wd], k, r), mirror=m)
        for fz in FRIEZES:
            add(f"frieze-{fz}-{k}", "frieze", f"{fz}/{k}", [{"frieze": [fz], "porch": [k]}],
                lambda c, wd, k=k, fz=fz: porch_frieze(c, WIDTHS[wd], LAYOUT[wd], k, fz), mirror=m)
    add("porch-windows-right", "porch", "left-windows-right", [{"porch": ["left"], "turret": NR}],
        lambda c, wd: porch_windows_right(c, WIDTHS[wd], LAYOUT[wd]), mirror=True)
    add("boxes-porch-right", "boxes", "porch-left-right", [{"boxes": T, "porch": ["left"], "turret": NR}],
        lambda c, wd: porch_boxes(c, WIDTHS[wd], LAYOUT[wd], "left", right=True), mirror=True)
    # extras (the sided ones are built on the right and mirrored to the left)
    add("turret", "turret", "", [{"turret": R}], lambda c, wd: turret(c, WIDTHS[wd]), mirror=True)
    add("bay", "bay", "", [{"bay": R, "chimney": NR}], lambda c, wd: bay_window(c, WIDTHS[wd], 1, 3.3), mirror=True)
    add("bay-chim", "bay", "chimney", [{"bay": R, "chimney": R}], lambda c, wd: bay_window(c, WIDTHS[wd], 1, 2.5), mirror=True)
    add("wing", "wing", "", [{"wing": R}], lambda c, wd: wing_body(c, WIDTHS[wd]), mirror=True)
    for sd in SIDINGS:
        add(f"wing-siding-{sd}", "wing-siding", sd, [{"wing": R, "siding": [sd]}],
            lambda c, wd, sd=sd: wing_siding(c, WIDTHS[wd], sd), mirror=True)
    for gw in GABLE_WINDOWS:
        add(f"wing-window-{gw}", "wing-gable-window", gw, [{"wing": R, "gable_window": [gw]}],
            lambda c, wd, gw=gw: wing_attic(c, WIDTHS[wd], gw), mirror=True)
    for g in GINGERBREAD:
        add(f"wing-gable-{g}", "wing-gable", g, [{"wing": R, "gingerbread": [g]}],
            lambda c, wd, g=g: wing_trim(c, WIDTHS[wd], g), mirror=True)
    add("wing-side-window", "wing-side-window", "", [{"wing": R, "chimney": NR}],
        lambda c, wd: wing_side_window(c, WIDTHS[wd]), mirror=True)
    add("wing-side-window-chim", "wing-side-window", "chimney", [{"wing": R, "chimney": R}],
        lambda c, wd: wing_side_window(c, WIDTHS[wd], True), mirror=True)
    add("boxes-wing", "boxes", "wing", [{"wing": R, "boxes": T}], lambda c, wd: wing_boxes(c, WIDTHS[wd]), mirror=True)
    add("chimney", "chimney", "wall", [{"chimney": R, "wing": NR}], lambda c, wd: chimney(WIDTHS[wd] / 2, CHIM_Y, 1, ZW, c),
        mirror=True)
    add("chimney-wing", "chimney", "wing", [{"chimney": R, "wing": R}], lambda c, wd: wing_chimney(c, WIDTHS[wd]), mirror=True)
    add("dormer-hip", "dormer", "hip", [{"dormer": T, "roof": ["hip"]}], _dormer_part("hip"))
    add("dormer-gable", "dormer", "gable", [{"dormer": T, "roof": ["gable"]}], _dormer_part("gable"))
    add("balcony", "balcony", "", [{"balcony": T}], lambda c, wd: balcony(c, ZW, None), shared=True)
    for r in RAILS:
        add(f"balcony-rail-{r}", "balcony-rail", r, [{"balcony": T, "rail": [r]}],
            lambda c, wd, r=r: balcony_rail(c, ZW, r), shared=True)
    return P


PART_DEFS = part_defs()


def matches(when, spec):
    return bool(when) and any(all(spec[k] in v for k, v in cond.items()) for cond in when)


def part_file(p, width):
    return p["name"] if p["shared"] else f"{p['name']}-{width}"


def parts_for(spec):
    """The parts a (valid) spec is assembled from, as (part, mirrored) pairs."""
    out = []
    for p in PART_DEFS:
        if matches(p["when"], spec):
            out.append((p, False))
        if p["when_mirror"] and matches(p["when_mirror"], spec):
            out.append((p, True))
    return out


def mirror_objects(objs):
    """Mirror freshly built pieces across x = 0 (x -> -x), flipping their faces back outward."""
    import bmesh
    from mathutils import Matrix
    S = Matrix.Scale(-1, 4, (1, 0, 0))
    for o in objs:
        if o.type != "MESH":
            continue
        o.data.transform(o.matrix_basis)
        o.matrix_basis = Matrix.Identity(4)
        o.data.transform(S)
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
        bm.to_mesh(o.data)
        bm.free()


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))


def rgbhex(c):
    return "#" + "".join(f"{round(v * 255):02x}" for v in c)


def colours(spec):
    """The four role colours (body, trim, roof, porch) of a spec: its palette preset, a brick
    body for brick siding, then any explicit `colours` (hex) on top."""
    c = dict(PALETTES[spec["palette"]])
    c.setdefault("porch", c["trim"])
    if spec["siding"] == "brick":
        c["body"] = BRICK_WALL
    for role, h in (spec.get("colours") or {}).items():
        c[role] = hexrgb(h)
    return c


def house(spec):
    """Build the house: every part its spec calls for, in the spec's colours."""
    import bpy
    c = colours(spec)
    for p, mirrored in parts_for(spec):
        before = set(bpy.data.objects)
        p["build"](c, spec["width"])
        if mirrored:
            mirror_objects(set(bpy.data.objects) - before)


# ---------------------------------------------------------------- generator

R_, L_, ANY = ["right", "both"], ["left", "both"], ["left", "right", "both"]
# combinations that don't go together: a spec matching every key of a rule is invalid
RULES = [
    (dict(turret=R_, porch=["centre", "wrap", "right"]), "a right turret takes the front-right corner: needs the left porch"),
    (dict(turret=L_, porch=["centre", "wrap", "left"]), "a left turret takes the front-left corner: needs the right porch"),
    (dict(wing=ANY, roof=["cross"]), "a wing would hit the cross gable's end"),
    (dict(wing=L_, porch=["wrap"]), "the wrap-around porch takes the left side"),
    (dict(bay=R_, wing=R_), "the right wing takes the right wall the bay would sit on"),
    (dict(bay=L_, wing=L_), "the left wing takes the left wall the bay would sit on"),
    (dict(dormer=[True], roof=["cross"]), "the cross gable already fills the slopes"),
    (dict(dormer=[True], roof=["hip-gable"]), "the hip's front gable takes the dormer's spot"),
    (dict(dormer=[True], roof=["gable"], wing=R_), "the right wing's roof would hide the side dormer"),
    (dict(balcony=[True], porch=["left", "right"]), "the balcony needs a centred porch roof under the front gable"),
    (dict(balcony=[True], roof=["hip", "hip-gable"]), "the balcony needs a centred porch roof under the front gable"),
]
DEFAULTS = dict(width="medium", roof="gable", porch="centre", palette="lavender", rail="plain", gingerbread="scallop",
                frieze="spindle", siding="clapboard", gable_window="arched", cross_style="pointy",
                turret="none", bay="none", wing="none", chimney="none", dormer=False, balcony=False, boxes=False)


def on(spec, k):
    return spec[k] not in (False, "none")


def validate(spec):
    """Fill defaults, read the old yes/no sided extras (turret, wing and chimney on the
    right; a bay on the right, or the left when there's a wing) and check the combination;
    returns the full spec."""
    s = dict(DEFAULTS)
    s.update(spec)
    legacy = {k: s[k] for k in SIDED if isinstance(s[k], bool)}
    for k, v in legacy.items():
        s[k] = "none" if not v else ("left" if k == "bay" and s["wing"] in (True, "right") else "right")
    errs = []
    choices = dict(width=WIDTHS, roof=ROOFS, porch=PORCHES, palette=PALETTES, rail=RAILS, gingerbread=GINGERBREAD,
                   frieze=FRIEZES, siding=SIDINGS, gable_window=GABLE_WINDOWS, cross_style=CROSS_STYLES,
                   **{k: SIDES for k in SIDED})
    errs += [f"unknown {k} {s[k]!r}" for k, opts in choices.items() if s[k] not in opts]
    if not errs:
        for cond, why in RULES:
            if all(s[k] in v for k, v in cond.items()) and why not in errs:
                errs.append(why)
    if errs:
        raise ValueError(f"{spec}: " + "; ".join(errs))
    return s


def repair(s):
    """Switch off (or move) the extras a spec's rules rule out, the smallest change first."""
    for _ in range(8):
        bad = [cond for cond, _ in RULES if all(s[k] in v for k, v in cond.items())]
        if not bad:
            return s
        k = next(k for k in ("balcony", "dormer", "bay", "turret", "wing", "chimney") if k in bad[0])
        s[k] = False if isinstance(s[k], bool) else "none"
    return s


LEGACY_PALETTES = ("charcoal", "cream", "lavender", "mustard", "rose", "sage", "slate", "teal")   # the seeds drew from these
LEGACY_GB = ("scallop", "spindle", "sunburst", "pendant")


def pick(seed, legacy=False):
    """A random valid spec from a seed. legacy=True stops after the draws the twelve
    named seeds were made with (so they keep their houses)."""
    r = random.Random(seed)
    s = dict(width=r.choice(sorted(WIDTHS)),
             roof=r.choices(["gable", "hip", "cross"], [5, 3, 3])[0],
             porch=r.choice(["left", "centre", "wrap"]),
             palette=r.choice(LEGACY_PALETTES))
    if s["palette"] not in PALETTES:
        s["palette"] = "rose"            # cream retired
    s["turret"] = s["porch"] == "left" and r.random() < 0.6
    s["wing"] = s["roof"] != "cross" and r.random() < 0.35
    s["bay"] = r.random() < 0.45
    s["dormer"] = (s["roof"] == "hip" and r.random() < 0.85) or (s["roof"] == "gable" and not s["wing"] and r.random() < 0.4)
    s["chimney"] = r.random() < 0.55
    s["balcony"] = s["porch"] != "left" and s["roof"] != "hip" and r.random() < 0.45
    s["boxes"] = r.random() < 0.4
    s["rail"] = "fancy" if r.random() < 0.45 else "plain"
    s["gingerbread"] = r.choice(LEGACY_GB)
    s = validate(s)
    if legacy:
        return s
    # drawn after the legacy draws: the newer options
    s["frieze"] = r.choices(FRIEZES, [4, 2, 2, 2, 2])[0]
    if r.random() < 0.15:
        s["gingerbread"] = "valance"
    s["siding"] = "brick" if r.random() < 0.15 else "clapboard"
    s["gable_window"] = "round" if r.random() < 0.3 else "arched"
    s["cross_style"] = "round" if r.random() < 0.4 else "pointy"
    if s["roof"] == "hip" and r.random() < 0.4:
        s["roof"] = "hip-gable"
    if s["porch"] == "left" and r.random() < 0.3:     # mirror the porch (and its turret) to the right
        s["porch"] = "right"
        s["turret"] = "left" if s["turret"] == "right" else "none"
    if s["wing"] == "right" and r.random() < 0.3:
        s["wing"] = "left" if r.random() < 0.7 else "both"
    if s["chimney"] == "right" and r.random() < 0.3:
        s["chimney"] = "left"
    if s["bay"] != "none" and r.random() < 0.3:
        s["bay"] = "left" if s["bay"] == "right" else "right"
    return validate(repair(s))


def make_house(seed_or_spec):
    """Build a house from a seed (int) or a (partial) spec dict; returns the spec used."""
    spec = pick(seed_or_spec) if isinstance(seed_or_spec, int) else validate(seed_or_spec)
    house(spec)
    return spec


def describe(spec):
    ex = [k if spec[k] is True else f"{k}:{spec[k]}" for k in EXTRAS if on(spec, k)]
    return (f"{spec['width']}/{spec['roof']}/{spec['porch']}/{spec['palette']} {spec['siding']}, {spec['rail']} rail,"
            f" {spec['gingerbread']}, {spec['frieze']} frieze, {spec['gable_window']} window"
            + (f", {spec['cross_style']} cross" if spec["roof"] == "cross" else "")
            + (f" {spec['colours']}" if spec.get("colours") else "")
            + (" +" + ",".join(ex) if ex else ""))


# the twelve generated houses: fixed seeds, chosen for variety
SEEDS = {f"house-{i + 1:02d}": s for i, s in enumerate([599, 564, 366, 500, 561, 503, 83, 451, 235, 313, 359, 183])}
# art-review touch-ups on top of a seed
OVERRIDES = {"house-05": dict(wing="none"),           # wide + hip + turret + wing was too much
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
    specs.update({slug: validate({**pick(seed, legacy=True), **OVERRIDES.get(slug, {})}) for slug, seed in SEEDS.items()})
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
        drop = next(k for k in DROP_ORDER if on(spec, k))   # over budget: shed the smallest extras first
        print(f"PROP {slug}: {tris} tris over budget, dropping {drop}")
        spec = dict(spec, **{drop: "none" if drop in SIDED else False})
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
