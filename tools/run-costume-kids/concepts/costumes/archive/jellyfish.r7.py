"""Jellyfish: a huge see-through pink bell hat (the silhouette) over the
kid's own head, a darker magenta inner cap and glowing dots inside, a
scalloped frill round the rim and a curtain of long wavy ribbon tentacles
(pink, lilac and pale) hanging from the rim all round the kid, the front
left open for the face. A lilac outfit. Carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts/costumes")
from _kit5 import *  # noqa: F401,F403

BELL, CORE, FRILL = (1.0, 0.55, 0.82), (0.78, 0.30, 0.78), (0.95, 0.42, 0.75)
LILAC, LILAC_D, PALE = (0.72, 0.56, 0.98), (0.55, 0.40, 0.86), (1.0, 0.86, 0.95)
HAIR = (0.36, 0.20, 0.10)
RIM_Z, RIM_R, TILT = 3.68, 2.15, 0.38


def rz(a):
    """The rim height at angle a: the bell tips back, higher over the face."""
    return RIM_Z - TILT * math.sin(a)


def tilt(a, r, z):
    return -TILT * math.sin(a) * min(1.0, r / RIM_R)


def ribbon(a, r, z0, length, width, col, waves=2.5, amp=0.16, steps=10):
    """A flat wavy ribbon hanging from the point at angle `a` on a ring of
    radius `r`, its face along the ring's tangent."""
    cx, cy = r * math.cos(a), r * math.sin(a) + 0.05
    tx, ty = -math.sin(a), math.cos(a)        # tangent
    nx, ny = math.cos(a), math.sin(a)         # radial
    left, right = [], []
    for i in range(steps + 1):
        t = i / steps
        z = z0 - t * length
        off = amp * math.sin(t * waves * 2 * math.pi + a * 3) * t ** 0.5
        rad = 0.08 * math.sin(t * waves * 2 * math.pi + a)
        w = width * (1 - 0.45 * t)
        px, py = cx + tx * off + nx * rad, cy + ty * off + ny * rad
        left.append((px - tx * w / 2, py - ty * w / 2, z))
        right.append((px + tx * w / 2, py + ty * w / 2, z))
    poly = left + list(reversed(right))
    th = 0.035
    f = [(x - nx * th, y - ny * th, z) for x, y, z in poly]
    b = [(x + nx * th, y + ny * th, z) for x, y, z in poly]
    return wedge(f, b, col)


def build():
    body(shirt=LILAC, pants=LILAC_D, leg_colour=LILAC, shoe=CORE, arms=False)
    fy = -TD * 0.5
    for k, z in enumerate((HIP + 0.25, HIP + 0.5)):
        box(0, fy - 0.01, z, TW * 1.02, 0.04, 0.08, PALE)  # wavy bands on the top
    arms(LILAC, full=True, cuff=PALE)
    kid_head(hair=HAIR)
    # the inner cap that sits on the head (the jelly's core, seen through the bell)
    lathe([(1.6, 3.55), (1.62, 3.9), (1.35, 4.35), (0.8, 4.6), (0.0, 4.68)], CORE, n=12, at=(0, 0.05, 0), rot0=math.pi / 12)
    for k in range(4):  # four little lobes on the core
        a = math.pi / 4 + k * math.pi / 2
        ball(0.7 * math.cos(a), 0.05 + 0.7 * math.sin(a), 4.62, 0.62, 0.62, 0.32, FRILL, seg=8, ring=4)
    # the big see-through bell
    prof = [(RIM_R, RIM_Z), (RIM_R + 0.08, RIM_Z + 0.3), (RIM_R, RIM_Z + 0.95), (1.82, RIM_Z + 1.6), (1.35, RIM_Z + 2.05),
            (0.72, RIM_Z + 2.3), (0.0, RIM_Z + 2.38)]
    o = lathe(prof, BELL, n=16, at=(0, 0.05, 0), rot0=math.pi / 16, cap=False, wob=tilt)
    glassy(o, 0.5, glow=0.25)
    # glowing dots on the bell
    for a, zz in ((-1.9, 4.3), (-1.2, 4.9), (-2.4, 5.1), (-0.7, 4.2), (-1.55, 3.95)):
        zz += 0.3
        rr = 0.06 + RIM_R * 0.98 * (1 - ((zz - RIM_Z) / 2.5) ** 2) ** 0.5
        ball(rr * math.cos(a), 0.05 + rr * math.sin(a), zz + tilt(a, rr, zz), 0.22, 0.22, 0.22, WHITE, seg=6, ring=4)
    # the scalloped frill round the rim
    n = 20
    for k in range(n):
        a = 2 * math.pi * k / n
        ball((RIM_R + 0.05) * math.cos(a), 0.05 + (RIM_R + 0.05) * math.sin(a), rz(a) - 0.02, 0.46, 0.46, 0.3, FRILL, seg=6, ring=4)
    # ribbon tentacles all round, the front left open for the face
    cols = [BELL, LILAC, PALE, FRILL]
    n = 22
    for k in range(n):
        a = 2 * math.pi * (k + 0.5) / n
        if math.sin(a) < -0.45 and abs(math.cos(a)) < 0.8:
            continue
        L = 2.5 + 0.7 * ((k * 7) % 5) / 4 - TILT * math.sin(a)
        ribbon(a, RIM_R - 0.05, rz(a), L, 0.3, cols[k % 4])
    for k in range(n // 2):  # an inner row, shorter
        a = 2 * math.pi * (k + 0.25) / (n // 2)
        if math.sin(a) < -0.3:
            continue
        ribbon(a, 1.55, 3.6, 2.0 + 0.3 * (k % 3), 0.24, cols[(k + 2) % 4], waves=3)


if __name__ == "__main__" or True:
    render_costume("jellyfish", build, out_dir(), ortho=8.5, target_z=3.0)
