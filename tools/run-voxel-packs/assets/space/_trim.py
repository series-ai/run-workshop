"""Re-time a clip's tail without touching its action (space creatures).

Sterf's rules: hits last at most 0.6 s and a death is still within a few
frames of its last flop. Many clips keep the blow / fall exactly right but
then drift or hold for half a second. `squeeze` keeps every key up to frame
`keep` as it is and compresses the rest of the clip linearly so the frame
that was `old_end` lands on `new_end`. Keys are snapped to whole frames; if
two land on one frame the later one wins (it is the pose being arrived at).
"""
from __future__ import annotations

F = 1 / 30


def _map(t: float, keep: int, old_end: int, new_end: int) -> int:
    f = t * 30
    if f <= keep + 1e-6:
        return round(f)
    return round(keep + (f - keep) * (new_end - keep) / (old_end - keep))


def squeeze(clip: dict, keep: int, old_end: int, new_end: int) -> dict:
    out = {}
    for part, channels in clip.items():
        out[part] = {}
        for ch, ks in channels.items():
            frames = {}
            for t, v in ks:
                frames[_map(t, keep, old_end, new_end)] = v
            out[part][ch] = [(f * F, v) for f, v in sorted(frames.items())]
    return out
