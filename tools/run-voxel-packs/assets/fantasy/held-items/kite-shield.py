"""Kite shield: a tall heraldic shield (azure with a gold lion rampant and
a silver rim) strapped over the fist; its face points out of the back of
the hand (+Y), its long axis along +X."""
from _kit import held
from voxgrid import C, Grid


def build():
    L, W = 34, 22
    g = Grid(L, 6, W)
    cz = W / 2
    for x in range(L):
        t = x / (L - 1)
        half = 10.5 if t > 0.4 else 2 + 8.5 * (t / 0.4) ** 0.7
        for z in range(W):
            d = abs(z + 0.5 - cz)
            if d > half:
                continue
            rim = d > half - 1.3 or x >= L - 2
            g.set(x, 3, z, C("steel", 6) if rim else C("blue", 3 + ((x // 4 + z // 4) % 2 == 0) * 0))
            g.set(x, 2, z, C("darkwood", 3))
            if rim:
                g.set(x, 4, z, C("steel", 5))
    lion = ["..##....", ".####...", "..###.#.", "..####..", ".######.", "..#..#..", ".##..##."]
    for r, row in enumerate(lion):
        for i, ch in enumerate(row):
            if ch == "#":
                g.set(L - 10 - r * 2, 4, int(cz) - 4 + i, C("gold", 6))
                g.set(L - 11 - r * 2, 4, int(cz) - 4 + i, C("gold", 5))
    g.box(15, 4, cz - 1, 18, 5, cz + 1, C("gold", 5))  # boss
    g.box(8, 0, cz - 1, 22, 2, cz + 1, C("rust", 3))  # arm strap / grip behind
    return held("kite-shield", "Heraldic Kite Shield", g, (15, 0.5, cz), {"socket-face": (18, 5, cz)},
                [{"effectId": "rvx-fantasy-metal-clang", "socket": "socket-face", "trigger": "manual", "size": 0.32}])
