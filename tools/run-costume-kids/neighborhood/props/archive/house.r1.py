"""Petite Victorian houses (the street-scene houses): narrow two-storey, steep
front gable with gingerbread trim and a finial, an arched attic window, a
front porch under its own roof with turned posts, railings and steps up to a
glowing front door. One builder, four variants.

    Blender -b -t 1 --factory-startup --python neighborhood/props/house.py -- neighborhood/renders [slug ...]
"""
import math
import os
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

# kid scale: a kid is ~5.5 tall, a door 2.6 x 4.2
W, D = 9.6, 9.0          # main body width (x) and depth (y)
Y0, Y1 = -3.0, 6.0       # front and back wall planes
F = 1.0                  # floor height (porch deck top)
WALL = 6.6               # wall height above the floor
RISE = 6.6               # gable rise (steep)
DOOR_W, DOOR_H = 2.6, 4.2
PORCH_D = 3.4
POST_TOP = F + 4.9


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


class _Null:
    def __enter__(self):
        pass

    def __exit__(self, *a):
        pass


def roof_frame(cx, w, zw, rise):
    a = math.atan2(rise, w / 2)
    L = math.hypot(rise, w / 2)
    return a, L, (cx, zw + rise)


def gabled_mass(cx, yf, yb, w, z0, wall, rise, c, ov=0.55, ovy=0.5, finial=True, gingerbread=True, ridges=True):
    """Walls, a steep front-to-back gable roof and its trim. Returns the roof geometry."""
    body, roof, trim = c["body"], c["roof"], c["trim"]
    depth = yb - yf
    cy = (yf + yb) / 2
    box(cx, cy, z0 + wall / 2, w, depth, wall, body, bevel=0.06)
    zw = z0 + wall
    # corner boards and the frieze band under the eaves
    for sx in (-1, 1):
        for yy in (yf, yb):
            box(cx + sx * (w / 2 - 0.08), yy + (0.08 if yy == yb else -0.08), z0 + wall / 2, 0.36, 0.36, wall, trim)
    box(cx, cy, zw - 0.2, w + 0.12, depth + 0.12, 0.4, trim)
    # clapboard: a few ridge strips on the sides and the back
    if ridges:
        rc = shade(body, 0.86)
        for i in range(1, 6):
            z = z0 + i * wall / 6
            for sx in (-1, 1):
                box(cx + sx * (w / 2 + 0.03), cy, z, 0.08, depth - 0.5, 0.14, rc)
            box(cx, yb + 0.03, z, w - 0.5, 0.08, 0.14, rc)
            box(cx, yf - 0.03, z, w - 0.5, 0.08, 0.14, rc)
    # the gable
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
        if gingerbread:  # scalloped drops hanging under the front bargeboard
            for i in range(7):
                f = 0.12 + i * 0.13
                d = f * L
                px, pz = rx + ux * d - nx * 0.5, rz + uz * d - nz * 0.5
                box(px, yf - ovy + 0.12, pz, 0.26, 0.1, 0.26, trim, rot=(0, math.radians(45), 0))
    box(rx, cy, rz + 0.12, 0.45, depth + 2 * ovy + 0.1, 0.3, shade(roof, 0.8))  # ridge cap
    if gingerbread:
        # king post and collar: the little sunburst at the peak
        dz = 1.7
        half = dz * (w / 2) / rise
        box(rx, yf - ovy + 0.14, rz - dz, 2 * half - 0.3, 0.14, 0.2, trim)
        box(rx, yf - ovy + 0.14, rz - dz / 2 - 0.1, 0.16, 0.14, dz, trim)
        for s in (-1, 1):
            box(rx + s * half * 0.45, yf - ovy + 0.14, rz - dz * 0.72, 0.1, 0.12, dz * 0.7, trim, rot=(0, s * math.radians(-38), 0))
        # gable strips (clapboard continues up the gable face)
        rc = shade(body, 0.86)
        for i in (1, 2, 3):
            z = zw + i * 1.1
            hw = (rise - (z - zw)) * (w / 2) / rise - 0.25
            box(cx, yf - 0.03, z, 2 * hw, 0.08, 0.14, rc)
    if finial:
        fy = yf - ovy + 0.25
        ball(rx, fy, rz + 0.45, 0.4, 0.4, 0.4, trim, seg=6, ring=4)
        can(rx, fy, rz + 1.3, 0.13, 1.6, trim, n=6, r2=0.0)
    return a


def turned_post(x, y, z0, z1, trim):
    box(x, y, z0 + 0.35, 0.44, 0.44, 0.7, trim)
    can(x, y, (z0 + 0.7 + z1 - 0.4) / 2, 0.12, z1 - z0 - 1.1, trim, n=6)
    for zz in (z0 + 1.5, z1 - 1.3):
        can(x, y, zz, 0.21, 0.5, trim, n=6)
    box(x, y, z1 - 0.2, 0.42, 0.42, 0.4, trim)


def railing(p0, p1, z0, z1, trim, spacing=0.5):
    """A straight railing from p0 to p1 (xy), deck at z0, top rail at z1."""
    (x0, y0), (x1, y1) = p0, p1
    L = math.hypot(x1 - x0, y1 - y0)
    ang = math.atan2(y1 - y0, x1 - x0)
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    box(mx, my, z1, L, 0.2, 0.18, trim, rot=(0, 0, ang))
    box(mx, my, z0 + 0.35, L, 0.14, 0.14, trim, rot=(0, 0, ang))
    n = max(1, int(L / spacing))
    for i in range(1, n):
        f = i / n
        box(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, (z0 + 0.35 + z1) / 2, 0.11, 0.11, z1 - z0 - 0.35, trim)


def house(c, porch="centre", bay=False, turret=False, wing=False):
    trim, body, roof = c["trim"], c["body"], c["roof"]
    found = c.get("found", shade(roof, 1.3))
    # foundation and the main mass
    box(0, (Y0 + Y1) / 2, F / 2, W + 0.3, D + 0.3, F, found, bevel=0.06)
    gabled_mass(0, Y0, Y1, W, F, WALL, RISE, c)
    zw = F + WALL
    arched_window(0, Y0, zw + 1.0, 1.6, 2.6, True, trim)

    # porch footprint, door and front windows
    if porch == "centre":
        px0, px1, door_x = -W / 2 - 0.2, W / 2 + 0.2, 0.0
        front_wins = [(-3.0, True), (3.0, True)]
        out_wins = []
    else:
        px0, px1, door_x = -W / 2 - 0.2, 1.9, -2.15
        front_wins = [(0.45, True)]
        out_wins = [] if turret else [(3.2, True)]
    pyf = Y0 - PORCH_D
    pcx, pcy = (px0 + px1) / 2, (pyf + Y0) / 2
    box(pcx, pcy, (F - 0.16) / 2, px1 - px0 - 0.2, PORCH_D - 0.1, F - 0.16, found)        # skirt
    box(pcx, pcy - 0.05, F - 0.08, px1 - px0, PORCH_D + 0.1, 0.16, DECK, bevel=0.04)   # deck

    # front door: trim frame, glowing door with orange panels, transom, knob
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

    for x, lit in front_wins + out_wins:
        window(x, Y0, F + 2.6, 0.0, 1.4, 2.5, lit, trim)

    # posts: the porch ends and either side of the steps
    sx0, sx1 = door_x - 1.75, door_x + 1.75
    post_xs = [px0 + 0.3, px1 - 0.3]
    for x in (sx0, sx1):
        if all(abs(x - p) > 1.0 for p in post_xs):
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
    n = int((px1 - px0 - 0.6) / 0.42)
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
    pts += [(px0 + 0.9, Y0 + 0.05, zr0 + 1.25), (px1 - 0.9, Y0 + 0.05, zr0 + 1.25)]
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
        if a >= sx0 - 0.01 and b <= sx1 + 0.01:
            continue  # the step opening
        railing((a + 0.22, py), (b - 0.22, py), F, rz, trim)
    for x in (xs[0], xs[-1]):
        if not (porch != "centre" and x == xs[-1]):
            railing((x, py + 0.22), (x, Y0 - 0.15), F, rz, trim)
    if porch != "centre":
        railing((xs[-1], py + 0.22), (xs[-1], Y0 - 0.15), F, rz, trim)

    # side and back windows (some lit, some dark)
    for s in (-1, 1):
        ang = s * math.pi / 2
        for y, lit in ((-0.3, True), (3.6, s < 0)):
            if (bay and s > 0 and y > 0) or (wing and s > 0):
                continue
            window(s * W / 2, y, F + 2.6, ang, 1.3, 2.4, lit, trim)
        if not (wing and s > 0):
            window(s * W / 2, 2.0, F + WALL - 1.4, ang, 1.0, 1.2, s > 0, trim, mull=False)
    for x, lit in ((-2.4, False), (2.4, True)):
        window(x, Y1, F + 2.6, math.pi, 1.3, 2.4, lit, trim)
    window(0, Y1, zw + 1.8, math.pi, 1.1, 1.5, False, trim, mull=False)

    if bay:   # a three-sided bay window on the right wall
        by, bw, bo = 3.3, 3.2, 1.1
        x0 = W / 2
        z0, z1 = 0.2, F + 4.3
        pts = []
        for z in (z0, z1):
            pts += [(x0 - 0.1, by - bw / 2, z), (x0 - 0.1, by + bw / 2, z), (x0 + bo, by - bw / 2 + 0.7, z), (x0 + bo, by + bw / 2 - 0.7, z)]
        hull(pts, body)
        roofp = []
        for (x, y, _) in pts[4:]:
            roofp += [(x + (0.25 if x > x0 else 0), y + (0.25 if y > by else -0.25), z1), (x + (0.25 if x > x0 else 0), y + (0.25 if y > by else -0.25), z1 + 0.15)]
        roofp += [(x0 - 0.1, by - bw / 2 + 0.6, z1 + 1.1), (x0 - 0.1, by + bw / 2 - 0.6, z1 + 1.1)]
        hull(roofp, roof)
        window(x0 + bo, by, F + 2.4, math.pi / 2, 1.2, 2.3, True, trim)
        for s in (-1, 1):
            mx, my = x0 + bo / 2, by + s * (bw / 2 - 0.35)
            ang = math.pi / 2 + s * (math.pi / 2 - math.atan2(bo, 0.7))
            window(mx + 0.02, my, F + 2.4, ang, 0.55, 2.3, True, trim, mull=False)

    if turret:   # an eight-sided corner tower with a witch-hat roof
        tx, ty, tr = W / 2 - 0.25, Y0 - 0.15, 1.55
        th = F + WALL + 2.2
        rot8 = (0, 0, math.radians(22.5))
        can(tx, ty, F / 2, tr + 0.12, F, found, n=8, rot=rot8)
        can(tx, ty, F + (th - F) / 2, tr, th - F, body, n=8, rot=rot8)
        for zz in (F + 0.9 + i * 1.45 for i in range(int((th - F - 0.5) / 1.45))):
            can(tx, ty, zz, tr + 0.05, 0.12, shade(body, 0.86), n=8, rot=rot8)
        can(tx, ty, th - 0.2, tr + 0.12, 0.4, trim, n=8, rot=rot8)
        can(tx, ty, th + 2.6, tr + 0.5, 5.2, roof, n=8, r2=0.05, rot=rot8)
        ball(tx, ty, th + 5.3, 0.36, 0.36, 0.36, trim, seg=6, ring=4)
        can(tx, ty, th + 6.1, 0.12, 1.4, trim, n=6, r2=0.0)
        apo = tr * math.cos(math.radians(22.5))
        for ang, z in ((0.0, F + 2.6), (math.radians(45), F + 2.6), (0.0, F + WALL - 0.2), (math.radians(45), F + WALL - 0.2)):
            ox, oy = rotv(0, -apo, ang)
            window(tx + ox, ty + oy, z, ang, 0.8, 1.9 if z < F + 4 else 1.4, True, trim, mull=False)

    if wing:     # a lower side wing with its own front gable, set back on the right
        ww, wx = 4.6, W / 2 + 2.0
        wy0, wy1 = Y0 + 2.6, Y1 - 0.4
        wwall, wrise = 4.6, 3.8
        box(wx + 0.2, (wy0 + wy1) / 2, F / 2, ww - 0.1, wy1 - wy0 + 0.3, F, found)
        gabled_mass(wx, wy0, wy1, ww, F, wwall, wrise, c, ov=0.45, ovy=0.4, finial=True, gingerbread=True)
        window(wx + 0.2, wy0, F + 2.4, 0.0, 1.4, 2.4, True, trim)
        arched_window(wx, wy0, F + wwall + 0.6, 1.0, 1.7, True, trim)
        window(wx + ww / 2, (wy0 + wy1) / 2, F + 2.4, math.pi / 2, 1.3, 2.4, False, trim)


COLOURS = {
    "house-a": dict(body=(0.64, 0.56, 0.72), trim=TRIM, roof=(0.31, 0.19, 0.30)),   # dusty lavender, plum roof
    "house-b": dict(body=(0.58, 0.67, 0.52), trim=TRIM, roof=(0.22, 0.22, 0.26)),   # sage, charcoal roof
    "house-c": dict(body=(0.86, 0.69, 0.32), trim=TRIM, roof=(0.34, 0.20, 0.28)),   # mustard, plum roof
    "house-d": dict(body=(0.46, 0.56, 0.69), trim=TRIM, roof=(0.20, 0.21, 0.27)),   # slate blue, charcoal roof
}
VARIANTS = {
    "house-a": dict(porch="left", bay=True),
    "house-b": dict(porch="centre"),
    "house-c": dict(porch="left", turret=True),
    "house-d": dict(porch="centre", wing=True),
}


def main():
    out = out_dir_arg()
    only = sys.argv[sys.argv.index("--") + 2:] if "--" in sys.argv else []
    entries = []
    for slug, v in VARIANTS.items():
        if only and slug not in only:
            continue
        entries.append(build_and_ship(slug, "house", lambda: house(COLOURS[slug], **v), out))
    kit.update_index(entries)


main()
