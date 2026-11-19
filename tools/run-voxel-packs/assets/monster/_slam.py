"""Slam keys for the monster pack's doors, hatches, lids, gates and traps (a copy of
assets/space/_slam.py; each pack imports from its own folder).

One motion rule for everything that opens or shuts (Sterf, 2026-11-15):
near-still for the first few frames, then a strong accelerating curve
(u ** power, keyed once per frame so the exporter can't soften it) into a
hard stop at full speed, a tiny rebound off the stop, then dead still.
Use it with Clip(ease=0) so the per-frame spacing survives the export.
"""
from __future__ import annotations

F = 1 / 30


def slam(a, b, frames: int = 12, power: float = 3.5, rebound: float = 0.05, start: int = 0,
         end: int | None = None, hold_from: int = 0):
    """Per-frame keys [(seconds, (x, y, z)), ...] moving `a` -> `b`.

    The part holds `a` until frame `start`, travels for `frames` frames along
    a + (b - a) * u ** power (the last frame covers ~25% of the travel, so it
    arrives at `power` x its mean speed), stops dead on frame start + frames,
    hops back off the stop by `rebound` x the travel over 4 frames (a small
    ballistic tick) and lands again, then holds `b` to frame `end`.
    `hold_from` adds a key at that frame with value `a` (for clips whose
    other parts start earlier)."""
    a = tuple(float(c) for c in a)
    b = tuple(float(c) for c in b)
    hit = start + frames
    last = hit + 10 if end is None else end
    out = []
    if start > hold_from:
        out.append((hold_from * F, a))
    for k in range(frames + 1):
        u = (k / frames) ** power
        out.append(((start + k) * F, tuple(x + (y - x) * u for x, y in zip(a, b))))
    for k, h in ((1, 0.75), (2, 1.0), (3, 0.75), (4, 0.0)):
        if hit + k > last:
            break
        out.append(((hit + k) * F, tuple(y + (x - y) * rebound * h for x, y in zip(a, b))))
    if last > hit + 4:
        out.append((last * F, b))
    return out, hit * F
