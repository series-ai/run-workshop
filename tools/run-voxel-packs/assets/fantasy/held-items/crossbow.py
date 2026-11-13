"""Heavy crossbow: a two-tone oak stock that tapers from a deep butt to a
slim tiller, iron bands with gold rivets, one trigger group (a brass side
plate, a darkwood grip and an iron lever), a red-lacquered nut with a
gold pin, a wide steel prod (bow) bound into an iron bracket with gold
nocks, one taut string from tip to tip through the nut, a loaded bolt
with red fletching and a stirrup loop at the nose. Bolt along +X; held
at the trigger grip."""
from _kit import held
from voxgrid import C, Grid

L, SY, SZ = 41, 12, 29
CY, CZ = 6, 14  # the tiller is 3 wide: z CZ-1..CZ+1 (centre CZ + 0.5)
NUT_X = 19
PROD_X = 29
HALF = 13  # half-span of the prod


def prod_x(dz: int) -> int:
    """Front face of the prod: the drawn limbs bend back toward the shooter."""
    a = abs(dz)
    return PROD_X - (0 if a < 5 else 1 if a < 8 else 2 if a < 11 else 3)


def build():
    g = Grid(L, SY, SZ)
    z0, z1 = CZ - 1, CZ + 2
    # butt: deep, darker plank at the back, a darkwood butt plate
    for x in range(0, 10):
        drop = 4 if x < 6 else 4 - (x - 5)  # the underside rises toward the tiller
        g.box(x, CY - drop, z0, x + 1, CY + 1, z1, C("wood", 3))
        g.box(x, CY - drop, z0, x + 1, CY - drop + 1, z1, C("wood", 2))  # dark lower edge
        g.box(x, CY, z0, x + 1, CY + 1, z1, C("wood", 4))  # lit upper plank
    g.box(0, CY - 4, z0, 2, CY + 1, z1, C("darkwood", 2))
    g.box(0, CY - 4, z0, 1, CY + 1, z1, C("darkwood", 1))
    g.box(5, CY - 3, z0, 6, CY - 1, z1, C("wood", 2))  # plank seam on the cheek
    # tiller: two planks with a dark seam and a bolt groove on top
    g.box(10, CY - 1, z0, 33, CY + 1, z1, C("wood", 4))
    g.box(10, CY, z0, 33, CY + 1, z1, C("wood", 5))
    g.box(10, CY - 1, z0, 33, CY, z1, C("wood", 3))
    g.box(10, CY, CZ, 33, CY + 1, CZ + 1, C("wood", 2))  # groove
    for x in (14, 23):
        g.box(x, CY, CZ - 1, x + 1, CY + 1, CZ, C("wood", 3)).box(x + 4, CY, CZ + 1, x + 5, CY + 1, CZ + 2, C("wood", 3))  # grain flecks
    # iron bands with gold rivets
    for x in (9, 24):
        g.box(x, CY - 2 if x == 9 else CY - 1, z0 - 1, x + 1, CY + 1, z1 + 1, C("iron", 4))
        g.box(x, CY - 1, z0 - 1, x + 1, CY, z1 + 1, C("iron", 3))
        g.set(x, CY, z0 - 1, C("gold", 5)).set(x, CY, z1, C("gold", 5))
    # trigger group: brass side plates, the grip block and the lever, all one piece
    for zz in (z0 - 1, z1):  # brass lock plates on both cheeks
        g.box(12, CY - 2, zz, 17, CY, zz + 1, C("gold", 4))
        g.box(12, CY - 2, zz, 17, CY - 1, zz + 1, C("gold", 3))
        g.set(12, CY - 1, zz, C("gold", 6))
    g.set(16, CY - 1, z0 - 1, C("red", 4)).set(16, CY - 1, z1, C("red", 4))  # pivot pins
    g.box(9, CY - 5, z0, 12, CY - 2, z1, C("darkwood", 3))  # grip
    g.box(9, CY - 5, z0, 12, CY - 4, z1, C("darkwood", 2))
    g.box(10, CY - 4, z0, 11, CY - 2, z1, C("darkwood", 4))
    g.box(13, CY - 4, CZ, 14, CY - 1, CZ + 1, C("iron", 5))  # lever, hung from the lock
    g.box(13, CY - 5, CZ, 16, CY - 4, CZ + 1, C("iron", 5))
    # nut: red lacquer with a gold pin, where the string catches
    g.box(NUT_X - 1, CY + 1, z0, NUT_X + 2, CY + 3, z1, C("red", 4))
    g.box(NUT_X - 1, CY + 2, z0, NUT_X + 2, CY + 3, z1, C("red", 5))
    g.box(NUT_X, CY + 1, z0 - 1, NUT_X + 1, CY + 2, z1 + 1, C("gold", 6))  # axle pin through the nut
    g.box(NUT_X - 1, CY + 1, CZ, NUT_X + 2, CY + 3, CZ + 1, C("red", 3))  # notch for the bolt
    # prod: one continuous, symmetric steel bow, thick at the centre and tapering
    for dz in range(-HALF, HALF + 1):
        zz = CZ + dz
        a = abs(dz)
        x = prod_x(dz)
        thick = 3 if a < 6 else 2
        g.box(x - thick + 1, CY, zz, x + 1, CY + 2, zz + 1, C("steel", 3))
        g.box(x - thick + 1, CY + 1, zz, x + 1, CY + 2, zz + 1, C("steel", 4))  # lit top
        g.set(x, CY + 1, zz, C("steel", 5))  # bright front edge
        g.set(x - thick + 1, CY, zz, C("steel", 2))  # dark back edge
        if a >= HALF - 1:
            g.box(x - 1, CY, zz, x + 1, CY + 2, zz + 1, C("gold", 5 if a == HALF else 4))  # nocks
    # iron bracket and lashing where the prod meets the stock
    g.box(PROD_X - 3, CY - 1, z0 - 1, PROD_X + 2, CY + 2, z1 + 1, C("iron", 4))
    g.box(PROD_X - 3, CY + 1, z0 - 1, PROD_X + 2, CY + 2, z1 + 1, C("iron", 5))
    for zz in (z0 - 2, z1 + 1):
        g.box(PROD_X - 2, CY - 1, zz, PROD_X + 1, CY + 2, zz + 1, C("rust", 2))  # cord lashing
        g.box(PROD_X - 1, CY - 1, zz, PROD_X, CY + 2, zz + 1, C("rust", 4))
    g.set(PROD_X - 1, CY + 1, z0 - 1, C("gold", 5)).set(PROD_X - 1, CY + 1, z1, C("gold", 5))
    # string: one taut 1-voxel cord from each nock to the nut, stepped but face-connected
    for side in (-1, 1):
        tip_z = CZ + side * (HALF - 1)
        tip_x = prod_x(HALF - 1) - 1
        end_z = CZ + 1 if side > 0 else CZ - 1
        n = abs(tip_z - end_z)
        prev = tip_x
        for k in range(n + 1):
            zz = tip_z - side * k
            xx = round(tip_x + (NUT_X - tip_x) * k / n)
            lo, hi = min(prev, xx), max(prev, xx)
            g.box(lo, CY + 1, zz, hi + 1, CY + 2, zz + 1, C("bone", 7))
            prev = xx
    g.box(NUT_X - 1, CY + 1, z0, NUT_X, CY + 2, z1, C("bone", 6))  # the string across the nut
    # bolt: a wood shaft in the groove, red fletching, a steel broadhead
    g.box(NUT_X + 1, CY + 1, CZ, 37, CY + 2, CZ + 1, C("wood", 6))
    g.box(NUT_X + 2, CY + 2, CZ, NUT_X + 6, CY + 3, CZ + 1, C("red", 5))  # top vane
    g.box(NUT_X + 2, CY + 1, CZ - 1, NUT_X + 5, CY + 2, CZ, C("red", 4)).box(NUT_X + 2, CY + 1, CZ + 1, NUT_X + 5, CY + 2, CZ + 2, C("red", 4))
    g.box(NUT_X + 3, CY + 2, CZ, NUT_X + 4, CY + 3, CZ + 1, C("bone", 7))  # white cock-feather stripe
    g.box(37, CY + 1, CZ - 1, 39, CY + 2, CZ + 2, C("steel", 6))  # broadhead
    g.box(37, CY + 1, CZ - 1, 38, CY + 2, CZ + 2, C("steel", 4))
    g.box(39, CY + 1, CZ, 41, CY + 2, CZ + 1, C("steel", 7))
    # nose and stirrup loop in front of the prod
    g.box(33, CY - 1, z0, 35, CY + 1, z1, C("iron", 4))
    for x in range(34, 39):
        for zz in range(CZ - 3, CZ + 4):
            if x in (34, 38) or zz in (CZ - 3, CZ + 3):
                g.set(x, CY - 1, zz, C("iron", 5 if x != 38 else 6))
    return held("crossbow", "Heavy Crossbow", g, (10.5, CY - 2.5, CZ + 0.5), {"socket-muzzle": (40, CY + 1.5, CZ + 0.5)},
                [{"effectId": "rvx-fantasy-bow-release", "socket": "socket-muzzle", "trigger": "manual", "size": 0.36, "aim": [1.0, 0.0, 0.0]}])
