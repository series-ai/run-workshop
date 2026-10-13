"""Scarecrow: a huge floppy straw hat (the silhouette): a wide wavy brim that
droops at the sides and back and flips up over the face, a dented crown with
a red band and patches, straw poking out under the brim; a cute little crow
perched on the brim. Straw hair, a red plaid shirt, patched blue overalls,
straw tufts at the collar, cuffs and ankles. Carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts/costumes")
from _kit5 import *  # noqa: F401,F403

HAT, HAT_D, STRAW, STRAW_D = (0.96, 0.78, 0.40), (0.82, 0.62, 0.28), (1.0, 0.86, 0.36), (0.90, 0.70, 0.22)
SHIRT, SHIRT_D, DENIM, DENIM_D = (0.88, 0.24, 0.20), (0.62, 0.12, 0.12), (0.30, 0.48, 0.82), (0.20, 0.34, 0.64)
BAND, PATCH1, PATCH2, CROW, BEAK = (0.80, 0.20, 0.16), (0.42, 0.66, 0.36), (0.40, 0.56, 0.90), (0.16, 0.15, 0.20), (1.0, 0.62, 0.12)
HZ = HEAD_Z + HEAD * 0.48 - 0.18       # where the hat sits on the head


def tufts(cx, cy, cz, r, n, length, out=True, down=False, col=STRAW):
    """A ring of little straw spikes poking out round (cx, cy, cz)."""
    for k in range(n):
        a = 2 * math.pi * k / n + 0.3
        dx, dy = math.cos(a), math.sin(a)
        p0 = (cx + dx * r * 0.7, cy + dy * r * 0.7, cz)
        dz = -0.6 if down else 0.0
        L = length * (0.75 + 0.5 * ((k * 5) % 3) / 2)
        p1 = (cx + dx * (r + L), cy + dy * (r + L), cz + dz * L)
        bar(p0, p1, 0.05, 0.0, col if k % 2 else STRAW_D, n=4)


def brim_wob(a, r, z):
    k = max(0.0, (r - 1.5) / 1.55)
    droop = -0.8 * k * (0.6 + 0.4 * math.cos(3 * a + 0.5))
    flip = 1.5 * k * max(0.0, -math.sin(a)) ** 2       # flips up over the face
    return droop + flip


def crow(x, y, z):
    """A round little crow sitting at (x, y, z), facing the camera a bit."""
    ball(x, y, z + 0.32, 0.6, 0.72, 0.55, CROW, seg=10, ring=6)
    ball(x - 0.05, y - 0.32, z + 0.68, 0.46, 0.44, 0.44, CROW, seg=10, ring=6)
    can(x - 0.05, y - 0.62, z + 0.64, 0.09, 0.3, BEAK, n=4, r2=0.0, rot=(math.radians(95), 0, 0))
    for s in (-1, 1):
        ball(x - 0.05 + s * 0.13, y - 0.53, z + 0.76, 0.13, 0.05, 0.13, WHITE, seg=6, ring=4)
        ball(x - 0.05 + s * 0.13, y - 0.56, z + 0.75, 0.07, 0.03, 0.07, DARK, seg=6, ring=4)
        o = ball(x + s * 0.3, y + 0.05, z + 0.35, 0.18, 0.55, 0.36, (0.10, 0.10, 0.14), seg=6, ring=4, rot=(math.radians(-20), 0, 0))
        limb((x + s * 0.1, y, z + 0.1), (x + s * 0.1, y - 0.05, z - 0.04), 0.03, BEAK)
    plate([(y + 0.3, z + 0.35), (y + 0.75, z + 0.55), (y + 0.75, z + 0.25)], "x", x, 0.2, CROW)  # tail


def build():
    body(shirt=SHIRT, pants=DENIM, leg_colour=DENIM, shoe=(0.40, 0.25, 0.14), arms=False)
    fy = -TD * 0.5
    with part("chest"):  # the plaid, the bib, its straps, buttons and patch
        # plaid on the shirt, the overall bib and straps, patches
        for z in (TOP - 0.12, TOP - 0.4):
            box(0, 0, z, TW + 0.02, TD + 0.02, 0.05, SHIRT_D)
        for x in (-0.3, 0.3):
            box(x, 0, HIP + TH * 0.66, 0.05, TD + 0.02, TH * 0.66, SHIRT_D)
        box(0, fy - 0.03, HIP + TH * 0.5, TW * 0.62, 0.06, TH * 0.5, DENIM, bevel=0.03)
        for s in (-1, 1):
            box(s * 0.28, 0, TOP - 0.1, 0.13, TD + 0.08, 0.06, DENIM)
            box(s * 0.28, fy - 0.05, HIP + TH * 0.72, 0.1, 0.04, 0.1, (1.0, 0.82, 0.3))   # buttons
        box(0.12, fy - 0.07, HIP + TH * 0.4, 0.26, 0.04, 0.22, PATCH1)
        with part("body"):  # the knee-high patch is on the trousers
            box(-0.15, fy - 0.03, HIP + 0.02, 0.2, 0.04, 0.18, PATCH2)
    # straw at the collar and the ankles
    with part("chest"):
        tufts(0, 0, TOP + 0.02, 0.45, 12, 0.3)
    for s in (-1, 1):
        with part("leg.l" if s > 0 else "leg.r"):
            tufts(s * TW * 0.24, 0, FOOT * 0.42, 0.1, 7, 0.22, down=True)
    # the arms: plaid sleeves, straw at the cuffs
    arms(SHIRT, full=True)
    with part("arm.l"):
        tufts(HANG[0], HANG[1], HANG[2] + 0.28, 0.12, 7, 0.22, down=True)
    with part("arm.r"):
        tufts(HOLD[0] + 0.2, HOLD[1] + 0.04, HOLD[2] + 0.05, 0.12, 7, 0.2)
    # the kid's head with straw hair
    kid_head(hair=STRAW)
    with part("head"):  # straw hair, the hat, its patches, straw and the crow on the brim
        for s in (-1, 1):  # straw sticking out of the hair at the sides
            for k in range(4):
                bar((s * 1.2, 0.2 + k * 0.25, 3.45 - k * 0.05), (s * (1.65 + 0.1 * (k % 2)), 0.25 + k * 0.3, 3.2 - k * 0.1), 0.06, 0.0, STRAW_D if k % 2 else STRAW, n=4)
        # the floppy hat: crown, dent, band, patches
        lathe([(1.58, HZ), (1.5, HZ + 0.6), (1.32, HZ + 1.15), (0.95, HZ + 1.5), (0.4, HZ + 1.6), (0.0, HZ + 1.42)], HAT, n=12, at=(0, 0.1, 0),
              rot0=math.pi / 12, wob=lambda a, r, z: 0.15 * math.cos(a) * (z - HZ) / 1.6)
        lathe([(1.6, HZ + 0.02), (1.56, HZ + 0.38)], BAND, n=12, at=(0, 0.1, 0), rot0=math.pi / 12)
        for ang, zz, col, w in ((-112, 0.85, PATCH2, 0.6), (-60, 0.45, PATCH1, 0.45), (40, 0.7, PATCH2, 0.55)):
            a = math.radians(ang)
            rr = 1.5 - (zz - 0.6) * 0.33 + 0.04 if zz > 0.6 else 1.54
            px, py = rr * math.cos(a), 0.1 + rr * math.sin(a)
            box(px + 0.15 * math.cos(a) * zz / 1.6, py, HZ + zz, w, 0.07, w * 0.85, col, rot=(math.radians(-12), 0, a + math.pi / 2))
            for k in (-1, 1):  # stitches
                box(px + 0.15 * math.cos(a) * zz / 1.6 + math.cos(a) * 0.04, py + math.sin(a) * 0.04, HZ + zz + k * w * 0.3, w * 0.8, 0.03, 0.04,
                    (0.3, 0.2, 0.12), rot=(math.radians(-12), 0, a + math.pi / 2))
        # straw poking out of a hole in the crown top
        for k in range(6):
            a = 2 * math.pi * k / 6
            bar((0.1, 0.2, HZ + 1.45), (0.1 + 0.45 * math.cos(a), 0.2 + 0.45 * math.sin(a), HZ + 1.85 + 0.1 * (k % 2)), 0.07, 0.0, STRAW if k % 2 else STRAW_D, n=4)
        # the wide floppy brim (droops at the sides and back, flips up at the front)
        lathe([(1.4, HZ + 0.08), (2.3, HZ - 0.02), (3.05, HZ - 0.12), (3.05, HZ - 0.24), (2.3, HZ - 0.14), (1.4, HZ - 0.06)], HAT, n=24,
              at=(0, 0.1, 0), wob=brim_wob)
        # straw poking out from under the brim edge
        for k in range(18):
            a = 2 * math.pi * k / 18 + 0.1
            if math.sin(a) < -0.55:
                continue
            r = 2.95
            x, y = r * math.cos(a), 0.1 + r * math.sin(a)
            z = HZ - 0.2 + brim_wob(a, r, 0)
            L = 0.35 + 0.15 * (k % 3)
            bar((x, y, z), (x + math.cos(a) * L, y + math.sin(a) * L, z - 0.25), 0.06, 0.0, STRAW if k % 2 else STRAW_D, n=4)
        # the crow perched on the right of the brim
        a = math.radians(15)
        r = 2.4
        crow(r * math.cos(a), 0.1 + r * math.sin(a), HZ - 0.02 + brim_wob(a, r, 0))


if __name__ == "__main__" or True:
    render_costume("scarecrow", build, out_dir(), ortho=8.5, target_z=3.0)
