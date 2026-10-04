"""Pitch torch: a grain-painted wooden handle, a flared iron-and-gold cup,
and a stepped flame. Flame and held-item long axis point along +X."""
import numpy as np

from _kit import held
from voxgrid import C, Grid


def build():
    g = Grid(34, 9, 9)
    cy = cz = 4

    # The square haft has painted grain and leather binding. Keep the hand
    # frame on the same point as the original torch.
    g.box(0, cy - 1, cz - 1, 19, cy + 1, cz + 1, C("wood", 3))
    x = np.arange(g.shape[0])[:, None, None] + 0.5
    dy = np.arange(g.shape[1])[None, :, None] + 0.5 - cy
    dz = np.arange(g.shape[2])[None, None, :] + 0.5 - cz
    ax, ay, az = np.broadcast_arrays(x, dy, dz)
    haft = (ax < 19) & (np.abs(ay) < 1) & (np.abs(az) < 1)
    skin = haft & ((np.abs(ay) >= 0.5) | (np.abs(az) >= 0.5))
    g.where(skin & (ay > 0), C("wood", 4))
    grain = skin & (np.abs(az) < 0.6) & ((np.floor(ax).astype(int) % 7) == 1)
    g.where(grain, C("darkwood", 2))
    grain_glint = skin & (ay > 0) & (np.abs(az) >= 0.5) & ((np.floor(ax).astype(int) % 9) == 5)
    g.where(grain_glint, C("wood", 5))

    # Four narrow cloth turns wrap the haft. Dark pixels mark their seams.
    wrap = haft & np.isin(np.floor(ax).astype(int), (4, 5, 7, 8, 10, 11, 13, 14))
    g.where(wrap, C("sand", 4))
    wrap_seam = haft & np.isin(np.floor(ax).astype(int), (5, 8, 11, 14))
    g.where(wrap_seam, C("darkwood", 2))
    g.where(wrap & (ay > 0) & ~wrap_seam, C("sand", 5))

    # A dark iron socket and a broad, stepped cup cradle the flame.
    # Each ring is clipped at its corners to soften the square silhouette.
    rad = np.maximum(np.abs(ay), np.abs(az))
    socket = (ax >= 17) & (ax < 20) & (rad < 2) & ~((np.abs(ay) > 1) & (np.abs(az) > 1))
    g.where(socket, C("iron", 3))
    g.where(socket & (ay > 0), C("iron", 4))
    g.where((ax >= 19) & (ax < 20) & (rad > 1) & (rad < 2), C("darkwood", 1))

    throat = (ax >= 20) & (ax < 21) & (rad < 2.5)
    g.where(throat, C("gold", 3))
    g.where(throat & (ay > 0), C("gold", 5))
    bowl = (ax >= 21) & (ax < 22) & (rad < 2.5)
    g.where(bowl, C("sand", 4))
    g.where(bowl & (ay > 0), C("sand", 5))
    rim = (ax >= 22) & (ax < 23) & (rad < 3.5) & ~((np.abs(ay) > 2) & (np.abs(az) > 2))
    g.where(rim, C("gold", 5))
    g.where(rim & (ay < 0), C("gold", 3))
    g.where(rim & ((np.abs(ay) > 2) | (np.abs(az) > 2)), C("gold", 6))
    # Dark inner ring at the mouth of the cup. The flame starts inside it.
    g.where((ax >= 22) & (ax < 23) & (rad >= 1) & (rad < 2), C("iron", 2))

    # The red outer flame flares, bends, then narrows into three tongues.
    # Nested orange and gold volumes keep the fire readable from every side.
    flame_rad = np.select(
        [ax < 25, ax < 28, ax < 30, ax < 32, ax < 33],
        [1.0, 2.5, 2.0, 1.0, 1.0],
        default=0.0,
    )
    bend_y = np.select([ax < 27, ax < 30], [0.0, 0.5], default=1.0)
    bend_z = np.select([ax < 28, ax < 31], [0.0, -0.5], default=0.5)
    fy, fz = ay - bend_y, az - bend_z
    fire = (ax >= 22) & (ax < 33) & (np.maximum(np.abs(fy), np.abs(fz)) < flame_rad)
    fire &= ~((np.abs(fy) > flame_rad - 1) & (np.abs(fz) > flame_rad - 1) & (flame_rad > 1.5))
    g.where(fire, C("red", 4))
    orange = fire & (ax >= 24) & (np.maximum(np.abs(fy), np.abs(fz)) < flame_rad - 0.5)
    g.where(orange, C("orange", 4))
    gold_core = fire & (ax >= 25) & (ax < 31) & (np.abs(fy) < 1) & (np.abs(fz) < 1)
    g.where(gold_core, C("gold", 4))
    hot_core = gold_core & (ax < 29) & (np.abs(fy) < 0.55)
    g.where(hot_core, C("gold", 5))
    # Paint a bright side streak where the inner fire reaches the surface.
    gold_streak = fire & (ax >= 25) & (ax < 32) & (fy >= 0.5) & (np.abs(fz) < 0.6)
    g.where(gold_streak, C("gold", 4))

    # The three short tips branch from the hot body. Each has a connected
    # orange root and a red end voxel, so no fire pixel floats by itself.
    g.set(30, 4, 5, C("orange", 4))
    for xx in (30, 31):
        g.set(xx, 6, 4, C("orange", 4) if xx == 30 else C("red", 4))
        g.set(xx, 3, 4, C("orange", 4) if xx == 30 else C("red", 4))
        g.set(xx, 4, 6, C("orange", 4) if xx == 30 else C("red", 4))
    return held("torch", "Pitch Torch", g, (8, cy, cz), {"socket-flame": (25, cy, cz)},
                [{"effectId": "rvx-fantasy-torch-flame", "socket": "socket-flame", "trigger": "manual", "size": 0.16, "aim": [1.0, 0.0, 0.0]}])
