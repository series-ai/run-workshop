"""Painted pixel text and icons for world assets (signs, logos, crests).

Glyphs are paint (rule S1): they recolour the surface voxels of a face, so
they cost no triangles. The font is 5×7 (narrow glyphs are 1–3 wide); the
icons are 7–13 pixels. `scale` makes them chunky: scale=2 paints 2×2
voxels per pixel.

Faces are the pnkit faces: '-z' (the front), '+z', '-x', '+x' and 'top'.
`plane` is the surface coordinate (as in pnkit.on_face). `u0, v0` is the
lowest grid corner of the painted box: u is x on z faces and on 'top', z on
x faces; v is y (z on 'top'). Text and icons always read correctly for a
viewer outside the face, never mirrored: on '-z' and '+x' the viewer's
left is the high-u end, so the painters run the columns toward low u
there. On 'top' the viewer stands at the front (-z) and looks down.

Each pixel paints the first filled voxel found along the face normal,
from `reach` voxels outside the plane to `reach` voxels inside it, and
then `depth - 1` voxels behind it. So glyphs follow proud panels and
shallow steps. A glyph that paints nothing raises an error.
"""
from __future__ import annotations

import numpy as np

from voxgrid import RAMP_SHADES, C, Grid

# 5×7 font, rows top to bottom. '#' is ink. Narrow glyphs are narrower.
FONT: dict[str, list[str]] = {
    "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "B": ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
    "C": [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
    "D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
    "E": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
    "F": ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
    "G": [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
    "H": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "I": ["###", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
    "J": ["..###", "...#.", "...#.", "...#.", "#..#.", "#..#.", ".##.."],
    "K": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    "L": ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
    "M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
    "N": ["#...#", "#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"],
    "O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "P": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
    "Q": [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
    "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    "S": [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    "T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    "U": ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "V": ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
    "W": ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
    "X": ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
    "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
    "Z": ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
    "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
    "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
    "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
    "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
    "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
    "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
    "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
    "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
    "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
    "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
    "-": ["...", "...", "...", "###", "...", "...", "..."],
    "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
    ".": [".", ".", ".", ".", ".", ".", "#"],
    ":": [".", ".", "#", ".", ".", "#", "."],
    "!": ["#", "#", "#", "#", "#", ".", "#"],
    "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
    "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
    " ": ["...", "...", "...", "...", "...", "...", "..."],
}

# Icons, rows top to bottom. '#' is the ink shade, '+' two shades lighter,
# '-' two shades darker; '.' is left unpainted (the surface shows through).
ICONS: dict[str, list[str]] = {
    "skull": [
        "..#####..",
        ".#######.",
        "#########",
        "#..###..#",
        "#..###..#",
        "####.####",
        ".#######.",
        "..#.#.#..",
    ],
    "flame": [
        "....#....",
        "....##...",
        "...###...",
        "..####.#.",
        ".###+###.",
        ".##+++##.",
        "##+++++##",
        "##+++++##",
        ".##+++##.",
        "..#####..",
    ],
    "bolt": [
        "...#####",
        "..#####.",
        ".#####..",
        "########",
        "...####.",
        "..####..",
        ".###....",
        ".##.....",
        "#.......",
    ],
    "planet": [  # a ringed planet: the ring passes in front, with a gap line above it
        "....#####....",
        "...#######...",
        "..#######..++",
        "..#####..++#.",
        "..###..++###.",
        ".#..++######.",
        "..++#######..",
        "++.#######...",
        "....#####....",
    ],
    "heart": [
        ".##...##.",
        "#+##.####",
        "#+#######",
        "#########",
        ".#######.",
        "..#####..",
        "...###...",
        "....#....",
    ],
    "cross": [
        "..###..",
        "..###..",
        "#######",
        "#######",
        "..###..",
        "..###..",
        "..###..",
        "..###..",
        "..###..",
    ],
    "bat": [
        "#....#.#....#",
        "##...###...##",
        "###.#+#+#.###",
        "#############",
        "#############",
        ".###.###.###.",
        "..#...#...#..",
    ],
    "drop": [
        "...#...",
        "...#...",
        "..###..",
        "..###..",
        ".#####.",
        "##+####",
        "#+#####",
        "#######",
        ".#####.",
    ],
    "gear": [
        "...###...",
        ".#.###.#.",
        ".#######.",
        "###...###",
        "###...###",
        "###...###",
        ".#######.",
        ".#.###.#.",
        "...###...",
    ],
    "star": [
        "....#....",
        "...###...",
        "...###...",
        "#########",
        ".#######.",
        "..#####..",
        ".###.###.",
        ".##...##.",
        "#.......#",
    ],
    "coin": [
        "..#####..",
        ".#+++++#.",
        "#+#####-#",
        "#+##+##-#",
        "#+#+++#-#",
        "#+##+##-#",
        "#+#####-#",
        ".#-----#.",
        "..#####..",
    ],
    "anchor": [
        "...###...",
        "...#.#...",
        "...###...",
        ".#######.",
        "....#....",
        "#...#...#",
        "##..#..##",
        ".##.#.##.",
        "..#####..",
    ],
}

_INWARD = {"-z": (2, 1), "+z": (2, -1), "-x": (0, 1), "+x": (0, -1), "top": (1, -1)}
# Faces whose viewer sees the grid u axis run right to left.
_FLIPPED = {"-z", "+x", "top"}


def _cell(face: str, u: int, v: int, d: int) -> tuple[int, int, int]:
    """Grid cell at face coordinates (u, v) and normal coordinate d."""
    if face in ("-z", "+z"):
        return (u, v, d)
    if face in ("-x", "+x"):
        return (d, v, u)
    return (u, d, v)  # top


def stamp(g: Grid, face: str, plane: float, u0: int, v0: int, rows: list[str], legend: dict[str, int], scale: int = 1, depth: int = 1, reach: int = 2) -> np.ndarray:
    """Paint pixel rows on a face. rows[0] is the top row and each row reads
    left to right as seen by a viewer outside the face (never mirrored).
    `legend` maps a character to a palette index; other characters are
    skipped. (u0, v0) is the lowest grid corner of the painted box. Returns
    the mask of painted voxels; raises if nothing was painted."""
    if face not in _INWARD:
        raise ValueError(f"face must be one of {tuple(_INWARD)}, got {face!r}")
    if scale < 1 or depth < 1:
        raise ValueError("scale and depth must be 1 or more")
    axis, step = _INWARD[face]
    surface = int(np.floor(plane)) if step > 0 else int(np.ceil(plane)) - 1
    width = max(len(r) for r in rows) * scale
    height = len(rows) * scale
    painted = np.zeros(g.shape, dtype=bool)
    n = g.shape[axis]
    for r, row in enumerate(rows):
        for k, ch in enumerate(row):
            if ch not in legend:
                continue
            for dv in range(scale):
                v = int(v0) + height - 1 - (r * scale + dv)
                for du in range(scale):
                    col = k * scale + du
                    u = int(u0) + (width - 1 - col if face in _FLIPPED else col)
                    for m in range(-reach, reach + 1):
                        d = surface + m * step
                        cell = _cell(face, u, v, d)
                        if not all(0 <= cell[i] < g.shape[i] for i in range(3)):
                            continue
                        if g.a[cell]:
                            for t in range(depth):
                                dd = d + t * step
                                if 0 <= dd < n:
                                    c2 = _cell(face, u, v, dd)
                                    if g.a[c2]:
                                        g.a[c2] = legend[ch]
                                        painted[c2] = True
                            break
    if not painted.any():
        raise ValueError(f"stamp on {face} at plane {plane}, ({u0}, {v0}) found no surface to paint")
    return painted


def text_size(s: str, scale: int = 1, gap: int = 1) -> tuple[int, int]:
    """(width, height) in voxels of `s` painted with text()."""
    s = s.upper()
    for ch in s:
        if ch not in FONT:
            raise ValueError(f"pnglyph has no glyph for {ch!r}")
    w = sum(len(FONT[ch][0]) for ch in s) + gap * max(0, len(s) - 1)
    return (w * scale, 7 * scale)


def text_rows(s: str, gap: int = 1) -> list[str]:
    """The pixel rows of a string (for stamp or for tests)."""
    s = s.upper()
    text_size(s)  # validates the characters
    rows = [""] * 7
    for i, ch in enumerate(s):
        for r in range(7):
            rows[r] += ("." * gap if i else "") + FONT[ch][r]
    return rows


def text(g: Grid, face: str, plane: float, u0: int, v0: int, s: str, ramp: str, shade: int, scale: int = 1, depth: int = 1, gap: int = 1, reach: int = 2) -> np.ndarray:
    """Paint `s` (A–Z, 0–9, - + . : ! ? / and space) in ramp/shade on a
    face. (u0, v0) is the lowest grid corner of the text box; text_size()
    gives its size, so a centred sign uses u0 = centre - width // 2.
    Returns the painted mask."""
    return stamp(g, face, plane, u0, v0, text_rows(s, gap), {"#": C(ramp, shade)}, scale, depth, reach)


def icon_size(name: str, scale: int = 1) -> tuple[int, int]:
    rows = ICONS[name]
    return (max(len(r) for r in rows) * scale, len(rows) * scale)


def icon(g: Grid, face: str, plane: float, u0: int, v0: int, name: str, ramp: str, shade: int, scale: int = 1, depth: int = 1, inks: dict[str, tuple[str, int]] | None = None, reach: int = 2) -> np.ndarray:
    """Paint an ICONS entry on a face: '#' in ramp/shade, '+' two shades
    lighter, '-' two shades darker. `inks` overrides any character with a
    (ramp, shade) pair. Returns the painted mask."""
    if name not in ICONS:
        raise ValueError(f"unknown icon {name!r}; have {sorted(ICONS)}")
    clamp = lambda s: min(RAMP_SHADES - 1, max(1, s))  # noqa: E731
    legend = {"#": C(ramp, shade), "+": C(ramp, clamp(shade + 2)), "-": C(ramp, clamp(shade - 2))}
    for ch, (r, s) in (inks or {}).items():
        legend[ch] = C(r, s)
    return stamp(g, face, plane, u0, v0, ICONS[name], legend, scale, depth, reach)
