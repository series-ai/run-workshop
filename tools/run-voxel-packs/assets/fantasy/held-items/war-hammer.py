"""Paladin's war hammer: a darkwood shaft with a gold-wrapped grip and
steel collars, riveted langets that bind a layered steel head to the
haft, two bevelled striking faces framed in dark iron with a gold
sunburst, a royal-blue sun roundel on the cheeks (the holy glow) and a
pyramid spike on top. Head along +X; the striking faces point along ±Y."""
import numpy as np

from _kit import held
from voxgrid import C, Grid

L, SY, SZ = 47, 24, 14
CY, CZ = 12, 7  # the shaft axis lies on grid lines, so even widths stay centred
HX = 35  # head centre (grid line) along x


def _idx(g: Grid):
    x = np.arange(g.shape[0])[:, None, None] + 0.5
    y = np.arange(g.shape[1])[None, :, None] + 0.5 - CY
    z = np.arange(g.shape[2])[None, None, :] + 0.5 - CZ
    return x, y, z  # voxel centres; y and z as signed offsets from the shaft axis


def build():
    g = Grid(L, SY, SZ)
    x, y, z = _idx(g)
    ay, az = np.abs(y), np.abs(z)
    u = x - HX  # along the head
    au = np.abs(u)
    shaft = (ay < 1) & (az < 1)
    quad = (y > 0).astype(int) * 2 + ((y > 0) ^ (z > 0)).astype(int)
    # haft: darkwood with grain, a gold-wrapped grip with dark seams
    haft = shaft & (x < 30)
    g.where(haft, C("darkwood", 4))
    g.where(haft & (y > 0), C("darkwood", 5))
    g.where(haft & ((np.floor(x) * 3 + quad) % 7 == 0), C("darkwood", 2))
    grip = shaft & (x > 2) & (x < 13)
    g.where(grip, C("gold", 4))
    g.where(grip & (y > 0), C("gold", 5))
    g.where(grip & ((np.floor(x) + quad) % 3 == 0), C("gold", 2))  # spiral seam of the wrap
    # steel pommel with a short spike, and two collars
    pom = (x < 3) & (ay < 2) & (az < 2) & ~((ay > 1) & (az > 1))
    g.where(pom, C("steel", 5))
    g.where(pom & (y < 0), C("steel", 3))
    for x0 in (13, 21):
        col = (x > x0) & (x < x0 + 2) & (ay < 2) & (az < 2) & ~((ay > 1) & (az > 1))
        g.where(col, C("steel", 6))
        g.where(col & (y < 0), C("steel", 4))
        g.where(col & (np.floor(x) == x0 + 1) & (ay < 1) & (az > 1), C("gold", 5))  # a gold rivet each side
    # langets: steel straps down both cheeks of the haft, riveted
    lang = (x > 24) & (x < 30) & (ay < 1) & (az > 1) & (az < 2)
    g.where(lang, C("steel", 5))
    g.where(lang & (np.floor(x) % 2 == 0), C("iron", 4))
    g.where(lang & (np.floor(x) == 25), C("gold", 5))
    # head, layer 1: the socket block the haft passes through
    sock = (au < 6) & (ay < 4) & (az < 4)
    g.where(sock, C("steel", 4))
    g.where(sock & (au > 5) & ((ay > 3) | (az > 3)), C("iron", 4))  # dark rims round both ends of the socket
    g.where(sock & (au > 5) & (ay < 3) & (az < 3), C("steel", 3))
    # head, layer 2: necks narrowing toward each face
    neck = (au < 4.5) & (ay >= 4) & (ay < 7) & (az < 3)
    g.where(neck, C("steel", 4))
    g.where(neck & (ay > 4) & (ay < 5), C("gold", 5))  # gold collar where the neck leaves the socket
    # head, layer 3: bevelled striking blocks
    def eq(v, k):
        return np.abs(v - k) < 0.1

    blk = (ay > 7) & (ay < 11) & (au < 6) & (az < 5) & ~((au > 5) & (az > 4))
    face = blk & (ay > 10)
    blk &= ~(face & ((au > 5) | (az > 4)))  # the striking face is one voxel smaller: a bevel
    face &= blk
    ring = blk & ~face & ((au > 5) | (az > 4))
    g.where(blk, C("steel", 5))
    g.where(blk & (z > 0), C("steel", 6))
    g.where(ring & (ay < 8), C("iron", 4))  # dark back edge against the neck
    g.where(blk & ~ring & (ay < 8), C("steel", 3))
    g.where(ring & (ay > 8) & (ay < 10) & (((au > 5) & eq(z, 0.5)) | ((az > 4) & eq(u, 0.5))), C("iron", 3))  # plate seams
    g.where(ring & eq(ay, 8.5) & (((au > 5) & eq(az, 3.5)) | ((az > 4) & eq(au, 4.5))), C("gold", 5))  # rivets
    g.where(ring & eq(ay, 9.5) & (((au > 5) & eq(az, 3.5)) | ((az > 4) & eq(au, 4.5))), C("gold", 3))
    g.where(blk & ~face & (ay > 10), C("steel", 6))  # lit ledge of the bevel
    # striking faces: dark iron frame, steel field, a gold sunburst with a white-gold core
    g.where(face, C("steel", 4))
    g.where(face & ((au > 4) | (az > 3)), C("iron", 3))
    r = np.hypot(u, z)
    ray = ((np.abs(u) < 0.6) | (np.abs(z) < 0.6) | (np.abs(au - az) < 0.6)) & (r < 4.4)
    g.where(face & ray, C("gold", 5))
    g.where(face & (r < 2.3), C("gold", 6))
    g.where(face & (r < 1.0), C("gold", 7))
    g.where(face & eq(au, 3.5) & eq(az, 2.5), C("gold", 4))  # corner rivets
    # cheeks of the socket: a royal-blue roundel framed in gold with a gold sun cross
    cheek = sock & (az > 3)
    rr = np.hypot(u, y)
    g.where(cheek & (rr < 4.0), C("gold", 4))
    g.where(cheek & (rr < 3.2), C("blue", 4))
    g.where(cheek & (rr < 3.2) & (y > 1), C("blue", 5))
    g.where(cheek & (rr < 2.2) & ((np.abs(u) < 0.6) | (np.abs(y) < 0.6)), C("gold", 6))
    g.where(cheek & (rr < 1.3), C("gold", 6))
    g.where(cheek & (rr < 0.8), C("gold", 7))
    g.where(cheek & eq(au, 4.5) & eq(ay, 2.5), C("gold", 4))  # rivets in the socket corners
    # pyramid spike on top
    for k, h in enumerate((2, 2, 1, 1)):
        sp = (np.floor(x) == 41 + k) & (ay < h) & (az < h)
        g.where(sp, C("steel", 6 if k < 3 else 7))
        g.where(sp & (y < 0), C("steel", 4))
    g.where((np.floor(x) == 41) & (ay < 3) & (az < 3) & ~((ay > 2) & (az > 2)), C("gold", 4))  # spike collar
    g.where((np.floor(x) == 41) & (ay < 2) & (az < 2), C("steel", 5))
    return held("war-hammer", "Paladin's War Hammer", g, (6.5, CY, CZ), {"socket-head": (HX, CY + 11, CZ)},
                [{"effectId": "rvx-fantasy-metal-clang", "socket": "socket-head", "trigger": "manual", "size": 0.36}])
