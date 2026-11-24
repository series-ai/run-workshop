"""A shorter `_fall.hit_back` for the boss-sized monsters (Sterf's rule: a
hit from the front is over in 0.6 s): the same beats, compressed to 18
frames (the blow on frames 0-3, a hold to 8, recovery past rest by 14,
settled on 18). `k` is accepted and ignored. Used by the vampire lord, the
headless horseman and the gargoyle."""
from __future__ import annotations

import math

from _kit import keys

Z3 = (0.0, 0.0, 0.0)


def fr(n: float) -> float:
    return n / 30.0


def quick_hit(root: str, push: float = 3.0, pop: float = 1.5, tilt: float = 14.0, twist: float = 6.0, k: float = 1.0,
             head: tuple | None = None, arms: dict | None = None, extra: dict | None = None, squash: float = 0.0,
             root_rot: str = "rot", foot: tuple = (0.0, 0.0, 0.0), snap: float = 0.8, sway_front: bool = False, sway: float = 0.25):
    """A hit that reads as a hit. The blow is at the start: from frame 0 the
    body is thrown back fast and eases out into the push pose by frame 4,
    with a short pop up that peaks on frame 4 and lands with gravity by
    frame 8; it keeps drifting back a little more through the beat, sways
    forward past rest with its weight and settles. The head and the arms
    snap back a frame behind the body. The root tilts about its floor
    contact `foot` = (y, z back, z front) in voxels from the root pivot; it
    pivots on the back edge, so the feet never lift off the floor while it
    tilts (a dip at the toes is lifted by the exporter). `head`: (name, degrees);
    `arms`: {name: (degrees, side)}; `snap` is how far it gets on frame 1;
    `sway_front` pivots the forward sway on the front contact `foot[2]`
    instead (for a body whose back edge is far behind the feet). Returns (keys, None): a hit has no
    impact key (that would ease into the blow)."""
    t = dict(B=8, L=11, O=14, E=18)
    B, L, O, E = (t[n] for n in "B L O E".split())
    t.update(H=3)
    beats = [(0, 0.0, 0.0, 0.0), (1, snap, snap * 0.83, snap * 1.08), (3, 1.0, 1.0, 1.0), (5, 1.04, 1.08, 0.7), (B, 1.06, 1.12, 0.0),
             (L, 0.6, 1.2, 0.0), ((L + O) // 2, (0.6 - sway) / 2, 0.8, 0.0), (O, -sway, 0.3, 0.0),
             ((O + E) // 2, -sway / 2, 0.12, 0.0), (E, 0.0, 0.0, 0.0)]  # frame, tilt, push, pop (mid keys keep the pivot on its arc)
    fy, zb, zf = foot
    rot, loc = [], []
    for f, a, z, y in beats:
        th = math.radians(tilt * a)
        # Tilting back it rocks on the heel; swaying forward it pivots behind
        # the toes too, so the front only dips (the exporter lifts small sinks)
        # and nothing hops off the floor.
        fz = zf if (sway_front and tilt * a < 0) else zb
        dy = fy - (fy * math.cos(th) - fz * math.sin(th))
        dz = fz - (fy * math.sin(th) + fz * math.cos(th))
        rot.append((fr(f), (tilt * a, twist * a, 0)))
        loc.append((fr(f), (0, pop * y + dy, push * z + dz)))
    out = {root: {root_rot: keys(*rot), "loc": keys(*loc)}}
    if squash:
        sq = lambda q: (1 + squash * q, 1 - squash * q, 1 + squash * q)  # noqa: E731
        out[root]["scale"] = keys((0, sq(0)), (fr(1), sq(0.6)), (fr(3), sq(-0.6)), (fr(B), sq(0.7)), (fr(L + 2), sq(-0.2)), (fr(O), sq(0)), (fr(E), sq(0)))
    if head:
        n, a = head
        out[n] = {"rot": keys((0, Z3), (fr(2), (a * 0.5, -twist * 0.4, 0)), (fr(4), (a, -twist, 0)), (fr(B + 1), (a * 0.7, -twist * 0.5, 0)),
                              (fr(O - 1), (-a * 0.35, 0, 0)), (fr(E), Z3))}
    for n, (a, s) in (arms or {}).items():
        out[n] = {"rot": keys((0, Z3), (fr(2), (a * 0.4, 0, -s * a * 0.15)), (fr(4), (a, 0, -s * a * 0.4)), (fr(B + 2), (a * 0.5, 0, -s * a * 0.2)),
                              (fr(O), (a * 0.1, 0, 0)), (fr(E), Z3))}
    for n, ks in (extra or {}).items():
        out[n] = {"rot": ks(t)}
    return out, None
