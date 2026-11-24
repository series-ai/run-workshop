"""Shared death timing for the upright monsters: fall over backwards.

An upright creature faces -Z, so it falls back toward +Z, away from the
attacker. The beats, in frames at 30 fps (scaled by `k` for heavier or
lighter bodies):

- 0-5: the blow rocks it forward over its toes (anticipation);
- 5-11: it teeters back onto its heels, arms thrown up to catch itself;
- 11-16: it keeps tipping back past the balance point (no reversal);
- 16-23: it falls back, fastest at the floor (`Clip(impact=...)` on the
  landing frame), so the slow start of the ease-in is short;
- 23-27: a heavy thud, one small bounce (2 frames up, 2 down), and it lands again;
- then it settles. The arms, the legs and the head land a few frames after
  the body (they lag up at the impact, slam down, rebound once).

While the feet are on the floor (until the fall) the legs counter-rotate
under the hips, so the feet stay planted. Every rotation is XYZ degrees about
glTF axes; a part's `final` pose is its pose relative to its parent once the
body lies on its back (found per creature so that it rests on the floor).
"""
from __future__ import annotations

import math

from _kit import keys

Z3 = (0.0, 0.0, 0.0)


def fr(n: float) -> float:
    return n / 30.0


def _add(a, b):
    return tuple(x + y for x, y in zip(a, b))


def fall_back(root: str, D: float, F: float, R: float = 86.0, roll: float = 6.0, k: float = 1.0, bounce: float = 0.6,
              legs: dict | None = None, arms: dict | None = None, head: tuple | None = None, torso: str | None = None,
              squash: tuple | None = None, extra: dict | None = None, leg_len: float = 15.0, tee: float = 1.0, torso_fin: tuple = Z3, settle: float = 0.0,
              pre_y: float = 0.0, lead: int = 1, bspan: int = 2):
    """Keys for a fall onto the back. `D` drops the root and `F` moves it back
    (+Z) on landing. `legs`: {name: final rot}; `arms`: {name: (final rot,
    side[, lag])} with side -1 for the left arm; `head`: (name, final rot).
    The impact frame is the flattest frame: the root, torso and head reach
    their lying angles ON it (the torso a touch past, with the squash); only
    the arms and legs trail and land a few frames later. One small bounce of
    2 frames up, 2 down, then a hard settle with no limb rebound. The root's
    drop arrives `lead` frames before its rotation (0 or negative, i.e. after it, for a root
    pivoted at or near the feet that has to rise as it lies down), so during the fall the body is
    never above the heel arc (it pivots on its heels; small sinks are lifted
    by the exporter). Returns (keys, impact seconds)."""
    t = {n: round(v * k) for n, v in dict(A=5, B=11, C=16, I=23).items()}
    A, B, C, I = (t[n] for n in "A B C I".split())
    Bn, L, E = I + bspan, I + 2 * bspan, I + round(21 * k)
    t.update(Bn=Bn, L=L, E=E)
    # `tee` < 1 keeps the root still while the torso rocks (feet built into
    # the root part cannot counter-rotate).
    # C keeps drifting back from B (no reversal), so the teeter flows into the fall.
    rA, rB, rC = (-11.0 * tee, 0, -2.0 * tee), (12.0 * tee, 0, 3.0 * tee), (19.0 * tee, 0, 4.0 * tee)
    zA, zB, zC = -0.8 * tee, 0.8 * tee, 1.4 * tee
    lie = (R, 0.0, roll)
    down = (0, -D, F)
    rest = (0, -D - settle, F + 0.3)
    out = {root: {"rot": keys((0, Z3), (fr(A), rA), (fr(B), rB), (fr(C), rC), (fr(I), lie), (fr(Bn), (R - 2, 0.0, roll)),
                              (fr(L), lie), (fr(E), lie)),
                  "loc": keys((0, Z3), (fr(A), (0, pre_y, zA)), (fr(B), (0, pre_y, zB)), (fr(C), (0, pre_y, zC)), *(((fr(I - lead), down),) if lead > 0 else ()), (fr(I), down if lead >= 0 else (0, pre_y, F)),
                              *(((fr(I - lead), down),) if lead < 0 else ()),
                              (fr(Bn), (0, -D + bounce, F + 0.2)), (fr(L), rest), (fr(E), rest))}}
    if squash:
        sq, st = squash
        out[root]["scale"] = keys((0, (1, 1, 1)), (fr(C), (1, 1, 1)), (fr(I), sq), (fr(Bn), st), (fr(L + 2), (1, 1, 1)), (fr(E), (1, 1, 1)))
    plant = lambda rx, dz: -rx + math.degrees(math.asin(max(-1.0, min(1.0, dz / leg_len))))  # noqa: E731
    for n, fin in (legs or {}).items():
        out[n] = {"rot": keys((0, Z3), (fr(A), (plant(rA[0], zA), 0, 0)), (fr(B), (plant(rB[0], zB), 0, 0)), (fr(C), (plant(rC[0], zC), 0, 0)),
                              (fr(I - 2), (-0.45 * R, 0, 0)), (fr(I), _add(fin, (3, 0, 0))), (fr(Bn), _add(fin, (2, 0, 0))), (fr(L + 1), fin),
                              (fr(E), fin))}
    for n, arm in (arms or {}).items():
        fin, s, lag = arm if len(arm) == 3 else (*arm, 25.0)  # lag: how far it trails up at the impact
        out[n] = {"rot": keys((0, Z3), (fr(A), (-30, 0, s * 10)), (fr(B), (60, 0, -s * 25)), (fr(C), (75, 0, -s * 32)),
                              (fr(I - 1), _add(fin, (lag, 0, 0))), (fr(Bn), _add(fin, (lag * 0.5, 0, 0))), (fr(L + 1), fin), (fr(E), fin))}
    if head:
        n, fin = head
        out[n] = {"rot": keys((0, Z3), (fr(A), (-14, 0, 0)), (fr(B), (18, 0, 4)), (fr(C), (24, 0, 5)), (fr(I), _add(fin, (-8, 0, 0))),
                              (fr(Bn), _add(fin, (-4, 0, 0))), (fr(L), fin), (fr(E), fin))}
    if torso:
        g = 1.0 + 1.5 * (1.0 - tee)  # the torso takes over the rock
        out[torso] = {"rot": keys((0, Z3), (fr(A), (-10 * g, 0, 0)), (fr(B), (8 * g, 0, 0)), (fr(C), (10 * g, 0, 0)), (fr(I), _add(torso_fin, (3, 0, 0))),
                                  (fr(Bn), _add(torso_fin, (-2, 0, 0))), (fr(L), torso_fin), (fr(E), torso_fin))}
    for n, ks in (extra or {}).items():
        out[n] = {"rot": ks(t)}
    return out, fr(I)


def hit_back(root: str, push: float = 3.0, pop: float = 1.5, tilt: float = 14.0, twist: float = 6.0, k: float = 1.0,
             head: tuple | None = None, arms: dict | None = None, extra: dict | None = None, squash: float = 0.0,
             root_rot: str = "rot", foot: tuple = (0.0, 0.0, 0.0), snap: float = 0.6, sway_front: bool = False, sway: float = 0.25):
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
    t = {n: round(v * k) for n, v in dict(B=8, L=11, O=17, E=24).items()}
    B, L, O, E = (t[n] for n in "B L O E".split())
    t.update(H=4)
    beats = [(0, 0.0, 0.0, 0.0), (1, snap, snap * 0.83, snap * 1.08), (4, 1.0, 1.0, 1.0), (6, 1.06, 1.1, 0.7), (B, 1.1, 1.18, 0.0),
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
        out[root]["scale"] = keys((0, sq(0)), (fr(1), sq(0.6)), (fr(4), sq(-0.6)), (fr(B), sq(0.7)), (fr(L + 2), sq(-0.2)), (fr(O), sq(0)), (fr(E), sq(0)))
    if head:
        n, a = head
        out[n] = {"rot": keys((0, Z3), (fr(2), (a * 0.5, -twist * 0.4, 0)), (fr(5), (a, -twist, 0)), (fr(B + 1), (a * 0.7, -twist * 0.5, 0)),
                              (fr(O - 1), (-a * 0.35, 0, 0)), (fr(E), Z3))}
    for n, (a, s) in (arms or {}).items():
        out[n] = {"rot": keys((0, Z3), (fr(2), (a * 0.4, 0, -s * a * 0.15)), (fr(5), (a, 0, -s * a * 0.4)), (fr(B + 2), (a * 0.5, 0, -s * a * 0.2)),
                              (fr(O), (a * 0.1, 0, 0)), (fr(E), Z3))}
    for n, ks in (extra or {}).items():
        out[n] = {"rot": ks(t)}
    return out, None
