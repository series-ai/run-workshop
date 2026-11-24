"""Glowing bugs, each with the life stages it really has (larva -> pupa -> adult)."""
from common import *  # noqa: F401,F403


def on_pad(fn, r=0.26):
    def f():
        pad(r=r, seed=60)
        with at((0, 0, 0.075), rz=-35, s=1.6):
            fn()
    return f


def legs(xs, z, w, rgb, h=0.05, spread=0.06, r=0.008):
    """Stubby toy legs: out a little, then down to the ground."""
    for x in xs:
        for s in (-1, 1):
            tube([(x, s * w * 0.6, z), (x + 0.01, s * (w + spread * 0.5), z * 0.55), (x + 0.015, s * (w + spread * 0.7), 0.004)], lambda t: r * 1.5, rgb,
                 rings=4, n=4)


def grub(n, L, r, rgb, glow_tail=None, glow_dots=None, z=0.0, head_rgb=None):
    """A segmented larva lying along x, head at +x."""
    for i in range(n):
        t = i / (n - 1)
        x = -L / 2 + L * t
        k = 0.75 + 0.25 * math.sin(math.pi * t)
        rgb_i = glow_tail if (glow_tail and i == 0) else rgb
        with part(f"seg{i}", pivot=(x, 0, z)):
            ell((x, 0, z + r * k), (L / n * 0.75, r * k, r * k), rgb_i, seg=8, ring=6, emit=GLOW * 0.8 if rgb_i is glow_tail else 0.0)
            if glow_dots and 0 < i < n - 1:
                for s in (-1, 1):
                    ell((x, s * r * k * 0.95, z + r * k * 1.05), r * 0.22, glow_dots, seg=5, ring=4, emit=GLOW)
    hx = L / 2 + r * 0.4
    with part("head", pivot=(hx - r * 0.5, 0, z + r * 0.6)):
        ell((hx, 0, z + r * 0.85), (r * 0.8, r * 0.8, r * 0.75), head_rgb or rgb, seg=8, ring=6)
        critter_eyes((hx + r * 0.55, -r * 0.35, z + r * 1.0), (1, -0.7, 0.2), size=r * 0.2, gap=1.6, blush=False)


def beetle(L, W, H, shell, body, glow=None, glow_where="tail", wings_open=False, eye_glow=None):
    z = 0.06
    ell((0, 0, z + H * 0.5), (L * 0.5, W * 0.5, H * 0.5), body, seg=9, ring=6)
    if glow and glow_where == "tail":
        with part("glow", pivot=(-L * 0.45, 0, z + H * 0.42)):
            ell((-L * 0.62, 0, z + H * 0.42), (L * 0.24, W * 0.44, H * 0.44), glow, seg=8, ring=6, emit=GLOW)
    for s in (-1, 1):
        rz = s * (35 if wings_open else 4)
        with part("shell_L" if s > 0 else "shell_R", pivot=(L * 0.18, s * 0.01, z + H * 0.75)):
            with at((L * 0.18, s * 0.01, z + H * 0.75), rz=rz):
                ell((-L * 0.3, s * W * 0.25, 0), (L * 0.36, W * 0.28, H * 0.28), shell, seg=8, ring=5, rough=0.4)
        if wings_open:
            blade((L * 0.05, s * W * 0.2, z + H * 0.9), (-L * 0.45, s * W * 1.1, z + H * 1.1), L * 0.35, C(200, 210, 240), side=(0, 0, 1), emit=0.1)
    ell((L * 0.42, 0, z + H * 0.55), (L * 0.18, W * 0.36, H * 0.36), shell, seg=8, ring=6)  # pronotum
    hx = L * 0.55
    ell((hx, 0, z + H * 0.5), (L * 0.13, W * 0.28, H * 0.3), body, seg=8, ring=6)
    critter_eyes((hx + L * 0.1, -W * 0.12, z + H * 0.58), (1, -0.8, 0.2), size=W * 0.07, gap=1.7, blush=False)
    for s in (-1, 1):
        with part("antennae", pivot=(hx + L * 0.05, 0, z + H * 0.7)):
            tube([(hx + L * 0.05, s * W * 0.1, z + H * 0.7), (hx + L * 0.2, s * W * 0.35, z + H * 1.1), (hx + L * 0.3, s * W * 0.45, z + H * 1.15)],
                 lambda t: 0.006, body, rings=4, n=4)
        if eye_glow:
            ell((L * 0.42, s * W * 0.25, z + H * 0.82), W * 0.1, eye_glow, seg=6, ring=4, emit=GLOW * 1.3)
    legs([L * 0.25, 0.0, -L * 0.2], z + H * 0.3, W * 0.4, body, h=H, spread=W * 0.25)


# ---------------------------------------------------------------- species

def firefly(st):
    if st == 0:
        grub(7, 0.24, 0.035, C(90, 80, 70), glow_tail=LIME, glow_dots=AMBER)
    elif st == 1:
        with at((0, 0, 0), ry=-15):
            grub(6, 0.18, 0.04, C(220, 200, 160), glow_tail=LIME)
    else:
        beetle(0.24, 0.14, 0.09, C(60, 60, 80), C(240, 130, 90), glow=LIME, wings_open=False)


def glowworm(st):
    if st == 0:
        grub(8, 0.26, 0.03, C(110, 90, 80), glow_tail=MINT)
    else:
        grub(9, 0.3, 0.04, C(120, 100, 90), glow_tail=MINT, glow_dots=MINT)


def click_beetle(st):
    if st == 0:
        grub(7, 0.24, 0.035, C(220, 170, 100), head_rgb=C(170, 120, 70))
        return
    z = 0.03
    ell((-0.05, 0, z + 0.07), (0.15, 0.07, 0.06), C(110, 85, 70), seg=9, ring=6)
    for s in (-1, 1):  # shiny shell halves
        with part("shell_L" if s > 0 else "shell_R", pivot=(0.06, s * 0.02, z + 0.12)):
            ell((-0.06, s * 0.032, z + 0.1), (0.14, 0.04, 0.045), C(140, 105, 80), seg=8, ring=6, rough=0.35)
    ell((0.08, 0, z + 0.1), (0.06, 0.075, 0.055), C(120, 90, 72), seg=8, ring=6)  # thorax
    with part("glow", pivot=(0.1, 0, z + 0.14)):
        for s in (-1, 1):  # the two glowing headlamps on its shoulders
            ell((0.1, s * 0.045, z + 0.14), 0.026, LIME, seg=7, ring=5, emit=GLOW * 1.3)
    chibi_head((0.15, 0, z + 0.08), 0.055, C(120, 90, 72))
    stubs([0.06, 0.0, -0.06], z + 0.05, 0.06, C(90, 70, 60))
    for s in (-1, 1):
        tube([(0.17, s * 0.02, z + 0.13), (0.2, s * 0.05, z + 0.18)], lambda t: 0.008, C(120, 90, 72), rings=2, n=4)


def moth(st):
    if st == 0:
        grub(6, 0.22, 0.045, C(140, 210, 170), glow_dots=CYAN)
        for i in range(3):
            ell((-0.05 + 0.05 * i, 0, 0.1), 0.02, CYAN, seg=6, ring=4, emit=GLOW)
        return
    if st == 1:
        tube([(0, 0, 0.36), (0, 0, 0.3)], lambda t: 0.005, ICE, rings=2, n=3, emit=GLOW * 0.6)
        lathe([(0, 0.0), (0.07, 0.04), (0.08, 0.13), (0.06, 0.2), (0, 0.23)], (0, 0, 0.07), C(220, 215, 250), n=9, emit=0.05)
        for k in range(3):
            torus(0.077 - 0.008 * k, 0.012, (0, 0, 0.12 + 0.05 * k), CYAN, n=10, k=4, emit=GLOW)
        return
    z = 0.1
    ell((-0.03, 0, z), (0.08, 0.06, 0.06), C(220, 210, 245), seg=9, ring=6)  # fluffy body
    ell((0.04, 0, z + 0.03), (0.06, 0.07, 0.06), C(245, 240, 255), seg=9, ring=6)  # fluffy collar
    for s in (-1, 1):  # big rounded wings held up in a V, with glowing eye-spots
        with part("wing_L" if s > 0 else "wing_R", pivot=(0.0, s * 0.04, z + 0.06)):
            ell((0.0, s * 0.12, z + 0.16), (0.12, 0.016, 0.14), C(170, 155, 240), seg=10, ring=6, rx=s * -28)
            ell((0.005, s * 0.135, z + 0.18), (0.045, 0.012, 0.045), CYAN, seg=8, ring=5, rx=s * -28, emit=GLOW)
            ell((-0.07, s * 0.07, z + 0.07), (0.06, 0.014, 0.06), C(150, 135, 225), seg=9, ring=5, rx=s * -45)
    chibi_head((0.1, 0, z + 0.05), 0.05, C(245, 240, 255))
    for s in (-1, 1):  # fluffy antennae
        tube([(0.11, s * 0.02, z + 0.09), (0.12, s * 0.06, z + 0.16)], lambda t: 0.007, C(245, 240, 255), rings=2, n=4)
        for k in range(5):  # feathery comb antennae
            p = V(0.11 + 0.003 * k, s * (0.025 + 0.009 * k), z + 0.1 + 0.015 * k)
            blade(p, p + V(0.03, s * 0.012, 0.012), 0.012, C(245, 240, 255), side=(0, 0, 1))
    stubs([0.04, -0.02], z - 0.05, 0.035, C(220, 210, 245), r=0.012)


def railroad(st):
    n = 9 if st else 6
    L = 0.34 if st else 0.22
    grub(n, L, 0.036, C(170, 130, 100), glow_dots=LIME)
    hx = L / 2 + 0.036 * 0.4
    ell((hx + 0.025, 0, 0.045), 0.022, C(255, 70, 60), seg=6, ring=4, emit=GLOW)  # the red headlamp


def snail(st):
    k = 0.65 if st == 0 else 1.0
    with at((0, 0, 0), s=k):
        with part("foot", pivot=(-0.14, 0, 0)):
            loft([((-0.14, 0, 0.02), 0.025, 0.035), ((0.0, 0, 0.04), 0.04, 0.055), ((0.1, 0, 0.06), 0.05, 0.05), ((0.14, 0, 0.1), 0.05, 0.05),
                  ((0.15, 0, 0.13), 0, 0)], C(215, 225, 205), n=8, side=(0, 0, 1))
        for s in (-1, 1):
          with part("eyes", pivot=(0.14, 0, 0.12)):
            tube([(0.14, s * 0.02, 0.12), (0.16, s * 0.04, 0.19)], lambda t: 0.01, C(215, 225, 205), rings=2, n=4)
            ell((0.16, s * 0.04, 0.2), 0.018, EYE, seg=6, ring=4, rough=0.3)
            ell((0.168, s * 0.046, 0.21), 0.006, (1, 1, 1), seg=5, ring=4)
        sp = [(-0.02 + 0.075 * (1 - t * 0.8) * math.cos(t * 4.4 * math.pi + math.pi / 2), 0.0,
               0.13 - 0.075 * (1 - t * 0.8) * math.sin(t * 4.4 * math.pi + math.pi / 2)) for t in [i / 24 for i in range(25)]]
        with part("shell", pivot=(-0.02, 0, 0.06)):
          tube(sp, lambda t: (0.05 * (1 - 0.75 * t), 0.06 * (1 - 0.7 * t)), C(70, 150, 100), rings=36, n=7, side=(0, 1, 0))
          for sgn in (-1, 1):
            tube([(x, sgn * (0.06 * (1 - 0.7 * i / 24) + 0.003), z) for i, (x, _, z) in enumerate(sp)], lambda t: 0.012 * (1 - 0.6 * t), LIME, rings=36, n=4,
                 emit=GLOW)


def millipede(st):
    n = 5 if st == 0 else 8
    R = 0.04 if st == 0 else 0.045
    pts = [(-0.05 * (n - 1) / 2 * 1.6 + 0.08 * i, 0.03 * math.sin(i * 0.9), R) for i in range(n)]
    for i, p in enumerate(pts):
      with part(f"seg{i}", pivot=(p[0], p[1], 0)):
        ell(p, (0.048, R, R), C(80, 80, 140), seg=8, ring=6)
        ell(V(p) + V(0, 0, R * 0.85), (0.026, R * 0.55, R * 0.3), CYAN, seg=6, ring=4, emit=GLOW)
        for s in (-1, 1):
            ell(V(p) + V(0, s * R * 0.95, -R * 0.75), 0.013, C(80, 80, 140), seg=5, ring=4)
    hp = part("head", pivot=V(pts[-1]) + V(0.03, 0, 0))
    hp.__enter__()
    chibi_head(V(pts[-1]) + V(0.065, 0, 0.012), R * 1.25, C(90, 90, 150))
    for s in (-1, 1):
        tube([V(pts[-1]) + V(0.08, s * 0.02, R * 1.6), V(pts[-1]) + V(0.11, s * 0.05, R * 2.6)], lambda t: 0.007, C(90, 90, 150), rings=2, n=4)
        ell(V(pts[-1]) + V(0.11, s * 0.05, R * 2.7), 0.014, CYAN, seg=5, ring=4, emit=GLOW)
    hp.__exit__(None, None, None)


def cave_gnat(st):
    if st == 0:
        with at((0, 0, 0), s=0.62, rz=35):
            _gnat_larva()
        return
    with at((0, 0, 0), s=1.6):
        _gnat_adult()


def _gnat_larva():
    if True:
        # a mossy rock arch with a chubby larva hanging on beaded glowing threads
        tube([(-0.2, 0, 0.0), (-0.18, 0, 0.45), (0.0, 0, 0.58), (0.18, 0, 0.45), (0.2, 0, 0.0)], lambda t: 0.07, STONE, rings=12, n=7)
        ell((0, 0, 0.62), (0.16, 0.08, 0.04), MOSS, seg=8, ring=4)
        for i, x in enumerate((-0.08, -0.03, 0.03, 0.08)):
            L = 0.2 + 0.06 * (i % 2)
            tube([(x, 0, 0.53), (x, 0, 0.53 - L)], lambda t: 0.003, ICE, rings=2, n=3, emit=GLOW * 0.4)
            for kk in range(4):
                ell((x, 0, 0.53 - L * (kk + 1) / 4), 0.016, CYAN, seg=5, ring=4, emit=GLOW)
        with at((0, -0.02, 0.5)):
            grub(5, 0.1, 0.025, C(210, 220, 240), glow_tail=CYAN)


def _gnat_adult():
    if True:
        z = 0.08
        ell((-0.03, 0, z), (0.055, 0.04, 0.04), C(80, 80, 120), seg=8, ring=6)
        with part("glow", pivot=(-0.06, 0, z)):
            ell((-0.08, 0, z - 0.005), (0.035, 0.03, 0.03), CYAN, seg=7, ring=5, emit=GLOW)
        for s in (-1, 1):
            with part("wing_L" if s > 0 else "wing_R", pivot=(-0.02, s * 0.03, z + 0.035)):
                with at((-0.02, s * 0.03, z + 0.035), rx=s * -30):
                    ell((-0.03, s * 0.05, 0), (0.05, 0.035, 0.01), C(200, 215, 250), seg=8, ring=4, emit=0.08)
        chibi_head((0.04, 0, z + 0.015), 0.042, C(90, 90, 130))
        stubs([0.0, -0.04], z - 0.03, 0.025, C(80, 80, 120), r=0.008)


def springtail(st):
    k = 0.7 if st == 0 else 1.0
    with at((0, 0, 0), s=k):
        ell((-0.03, 0, 0.07), (0.075, 0.06, 0.06), C(170, 150, 240), seg=9, ring=6)
        for i in range(3):
            ell((-0.06 + 0.03 * i, 0, 0.13), 0.018, MAGENTA, seg=6, ring=4, emit=GLOW)
        with part("legs", pivot=(-0.05, 0, 0.04)):
            tube([(-0.09, 0, 0.04), (-0.05, 0, 0.012)], lambda t: 0.014, C(170, 150, 240), rings=2, n=5)  # the spring
        chibi_head((0.06, 0, 0.08), 0.06, C(185, 165, 250))
        for s in (-1, 1):
            tube([(0.08, s * 0.025, 0.13), (0.1, s * 0.05, 0.18)], lambda t: 0.009, C(185, 165, 250), rings=2, n=4)
            ell((0.1, s * 0.05, 0.19), 0.014, MAGENTA, seg=5, ring=4, emit=GLOW)
        stubs([0.02, -0.04], 0.04, 0.04, C(170, 150, 240), r=0.012)


def cricket(st):
    k = 0.7 if st == 0 else 1.0
    with at((0, 0, 0), s=k):
        z = 0.07
        ell((-0.03, 0, z), (0.1, 0.055, 0.055), C(120, 200, 110), seg=9, ring=6)
        for s in (-1, 1):
            tube([(-0.11, s * 0.035, z + 0.035), (0.04, s * 0.04, z + 0.045)], lambda t: 0.012, LIME, rings=2, n=4, emit=GLOW)
            with part("legs", pivot=(0.0, 0, z)):
                tube([(0.0, s * 0.05, z + 0.0), (-0.07, s * 0.075, z + 0.11), (-0.11, s * 0.078, z + 0.12)], lambda t: 0.03 * (1 - 0.5 * t), C(120, 200, 110),
                     rings=6, n=6)  # big jumping thighs
                tube([(-0.11, s * 0.078, z + 0.12), (-0.17, s * 0.08, 0.012)], lambda t: 0.011, C(120, 200, 110), rings=3, n=5)
        if st:
            for s in (-1, 1):
                with part("wing_L" if s > 0 else "wing_R", pivot=(0.03, s * 0.02, z + 0.05)):
                    ell((-0.04, s * 0.03, z + 0.05), (0.08, 0.03, 0.012), C(130, 200, 120), seg=8, ring=4, rx=s * -20)
        chibi_head((0.08, 0, z + 0.03), 0.058, C(135, 210, 120))
        for s in (-1, 1):
            with part("antennae", pivot=(0.1, 0, z + 0.08)):
                tube([(0.1, s * 0.02, z + 0.08), (0.14, s * 0.06, z + 0.16), (0.2, s * 0.08, z + 0.18)], lambda t: 0.007, C(135, 210, 120), rings=4, n=4)
        stubs([0.03, -0.01], z - 0.03, 0.04, C(120, 200, 110), r=0.012)


def chibi_head(c, r, rgb, look=(1, -0.8, 0.15), eye=0.3, blush=True):
    """A big round bug head with compound eyes on its sides (no face sticker)."""
    ell(c, (r, r * 0.95, r * 0.92), rgb, seg=9, ring=7)
    head_eyes(c, r, fwd=(1, 0, 0), size=r * 0.36, up=0.3, spread=0.62)

def stubs(xs, z, w, rgb, r=0.014):
    """Stubby round toy legs."""
    for x in xs:
        for s in (-1, 1):
            tube([(x, s * w * 0.8, z), (x + 0.005, s * (w + 0.02), 0.012)], lambda t: r, rgb, rings=2, n=5)
            ell((x + 0.006, s * (w + 0.022), 0.01), r * 1.15, rgb, seg=6, ring=4)


BUGS = [
    ("Firefly", firefly, ["larva", "pupa", "adult"]),
    ("Glowworm", glowworm, ["larva", "adult"]),
    ("Click beetle", click_beetle, ["larva", "adult"]),
    ("Glow moth", moth, ["caterpillar", "cocoon", "adult"]),
    ("Railroad worm", railroad, ["young", "adult"]),
    ("Glow snail", snail, ["baby", "adult"]),
    ("Glow millipede", millipede, ["young", "adult"]),
    ("Cave gnat", cave_gnat, ["larva (silk threads)", "adult"]),
    ("Glow springtail", springtail, ["young", "adult"]),
    ("Glow cricket", cricket, ["nymph", "adult"]),
]


def board_rows(bugs):
    out = []
    for name, f, stages in bugs:
        out.append((name, [(lab, on_pad(lambda f=f, i=i: f(i))) for i, lab in enumerate(stages)]))
    return out


D = {"dark": True}
# Pair short rows so the board stays compact: two bugs per line.
BOARDS = [
    ("11-bugs", "Glowing bugs and their life stages (shared scale per bug)", D, board_rows(BUGS[:5])),
    ("12-bugs-b", "Glowing bugs (2/2)", D, board_rows(BUGS[5:])),
]
