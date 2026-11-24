"""Pumpkins & gourds as a mix-and-match system: body shape + stem + warts + skin.
Every variety is a recipe of those four parts (plus a scale)."""
import math

from hh import *  # noqa: F401,F403

# ---------------------------------------------------------------- body shapes (unit ~ 1 m wide classic)
# profile [(r, z)], lobes, lobe depth. The last point is the stem dimple.
BODIES = {
    "round": ([(0, 0.04), (0.28, 0), (0.47, 0.08), (0.55, 0.25), (0.53, 0.43), (0.42, 0.57), (0.2, 0.63), (0, 0.57)], 8, 0.13),
    "tall": ([(0, 0.03), (0.26, 0), (0.4, 0.1), (0.45, 0.3), (0.43, 0.5), (0.32, 0.63), (0.14, 0.67), (0, 0.63)], 8, 0.09),
    "flat": ([(0, 0.03), (0.33, 0), (0.56, 0.07), (0.64, 0.19), (0.6, 0.32), (0.44, 0.41), (0.17, 0.44), (0, 0.38)], 10, 0.15),
    "squat": ([(0, 0.02), (0.42, 0), (0.62, 0.07), (0.67, 0.19), (0.6, 0.33), (0.42, 0.43), (0.16, 0.46), (0, 0.42)], 10, 0.07),
    "turban": ([(0, 0.02), (0.3, 0), (0.5, 0.07), (0.56, 0.18), (0.5, 0.28), (0.36, 0.33), (0, 0.33)], 8, 0.08),
    "pear": ([(0, 0.02), (0.2, 0), (0.3, 0.08), (0.31, 0.18), (0.22, 0.3), (0.14, 0.42), (0.11, 0.5), (0.06, 0.55), (0, 0.55)], 0, 0),
    "bottle": ([(0, 0.02), (0.22, 0), (0.32, 0.1), (0.33, 0.22), (0.24, 0.34), (0.13, 0.41), (0.16, 0.5), (0.18, 0.6), (0.12, 0.69), (0, 0.71)], 0, 0),
    "neck": ([(0, 0.02), (0.18, 0), (0.29, 0.06), (0.32, 0.17), (0.26, 0.3), (0.17, 0.4), (0.16, 0.6), (0.15, 0.72), (0.08, 0.78), (0, 0.78)], 0, 0),
    "acorn": ([(0, 0), (0.12, 0.03), (0.3, 0.14), (0.38, 0.27), (0.35, 0.38), (0.2, 0.46), (0, 0.44)], 8, 0.3),
    "oval": ([(0, 0), (0.17, 0.02), (0.25, 0.12), (0.28, 0.3), (0.25, 0.48), (0.17, 0.58), (0, 0.6)], 10, 0.04),
    "crown": ([(0, 0.02), (0.2, 0), (0.29, 0.06), (0.31, 0.14), (0.24, 0.22), (0.16, 0.3), (0.12, 0.38), (0.06, 0.42), (0, 0.42)], 6, 0.1),
    "swan": (None, 0, 0),  # spline tube, see swan_body()
}
TURBAN_CAP = [(0.33, 0.3), (0.36, 0.37), (0.3, 0.47), (0.14, 0.53), (0, 0.52)]

# ---------------------------------------------------------------- skins (colourways)
SKINS = {
    "orange": dict(col=ORANGE),
    "ghost white": dict(col=C(244, 240, 228), stem=C(150, 156, 112)),
    "cinder red": dict(col=C(236, 76, 40)),
    "jarrah blue": dict(col=C(128, 176, 196), stem=C(150, 140, 100)),
    "cream stripe": dict(col=C(244, 230, 196), stripe=C(76, 128, 70)),
    "goblin": dict(col=ORANGE, col2=C(108, 150, 70), split=0.62),
    "turban": dict(col=C(222, 88, 46), cap=C(240, 228, 186), stripe=C(98, 150, 80)),
    "butternut": dict(col=C(244, 190, 112), stem=C(150, 130, 90)),
    "acorn green": dict(col=C(54, 116, 72), spot=ORANGE),
    "spaghetti": dict(col=C(248, 214, 96)),
    "speckled": dict(col=C(250, 214, 80), col2=C(96, 148, 74), split=0.48, speck=CREAM),
    "swan green": dict(col=C(84, 136, 72), speck=C(206, 222, 150)),
    "bottle": dict(col=C(196, 214, 110), stem=C(150, 130, 90)),
    "crown": dict(col=CREAM, col2=C(110, 158, 76), split=0.3, spike=C(110, 158, 76)),
    "prize": dict(col=C(252, 160, 44), stem=C(150, 150, 96)),
    "withered": dict(col=C(196, 128, 74), stem=DRY_D),
    "putty": dict(col=C(236, 202, 156), stem=C(170, 150, 110)),
}
STEM_COL = C(118, 128, 64)


# ---------------------------------------------------------------- stems

def stem(kind, col=STEM_COL, s=1.0):
    """Built at the local origin, standing up from the dimple."""
    with at((0, 0, -0.012 * s), s=s):
        if kind == "stub":
            lathe([(0.055, 0), (0.045, 0.06), (0.04, 0.11), (0.046, 0.125), (0, 0.13)], (0, 0, 0), col, n=5, ry=8, twist=25)
        elif kind == "tall":
            with at((0, 0, 0), ry=12):
                lathe([(0.07, 0), (0.05, 0.06), (0.042, 0.16), (0.038, 0.24), (0.044, 0.255), (0, 0.26)], (0, 0, 0), col, n=5, twist=50)
        elif kind == "curly":
            lathe([(0.05, 0), (0.04, 0.07), (0.036, 0.1)], (0, 0, 0), col, n=5)
            pts = [(0, 0, 0.08), (0.04, 0.0, 0.16), (0.12, -0.02, 0.18)]
            pts += [(0.12 + 0.05 * math.cos(a), -0.02 + 0.05 * math.sin(a) * 0.4, 0.13 + 0.05 * math.sin(a)) for a in (1.2, 0.0, -1.2, -2.4)]
            tube(pts, lambda t: 0.032 * (1 - 0.55 * t), col, rings=14, n=5)
        elif kind == "giant":
            lathe([(0.13, 0), (0.09, 0.05), (0.075, 0.12), (0.08, 0.16), (0, 0.165)], (0, 0, 0), col, n=7, lobes=5, lobe_depth=0.35, twist=30, ry=6)
            lathe([(0.07, 0.159), (0.072, 0.168), (0, 0.17)], (0, 0, 0), C(212, 206, 150), n=7, ry=6)
        elif kind == "leafy":
            lathe([(0.05, 0), (0.04, 0.08), (0.036, 0.11), (0, 0.115)], (0, 0, 0), col, n=5, ry=6)
            leaf((0.0, 0.0, 0.05), -20, 0.26, 0.24, 25, LEAF, droop=0.25, shape=ROUND)
            pts = [(0, 0, 0.06), (-0.08, -0.03, 0.1)] + [(-0.12 + 0.04 * math.cos(a), -0.04, 0.1 + 0.04 * math.sin(a)) for a in (0.5, 2.0, 3.5, 5.0)]
            tube(pts, lambda t: 0.012, LEAF_L, rings=12, n=4)
        elif kind == "dry":
            with at((0, 0, 0), ry=-18):
                lathe([(0.04, 0), (0.03, 0.06), (0.026, 0.12), (0, 0.125)], (0, 0, 0), DRY_D, n=5, twist=40)
        elif kind == "nub":
            lathe([(0.035, 0), (0.03, 0.04), (0, 0.05)], (0, 0, 0), col, n=5)


# ---------------------------------------------------------------- warts

def warts(g, kind, col, seed=3):
    top = g.top
    if kind == "few":
        g.bumps(col, 7, 0.035, seed=seed, z0=0.2, z1=0.8)
    elif kind == "many":
        g.bumps(col, 26, 0.032, seed=seed, z0=0.12, z1=0.88)
    elif kind == "knobbly":
        g.bumps(col, 12, 0.055, seed=seed, z0=0.18, z1=0.8)
        g.bumps(col, 26, 0.028, seed=seed + 7, z0=0.1, z1=0.9)
    elif kind == "crown":
        # finger spikes around the shoulder (crown of thorns)
        for i in range(g.lobes or 6):
            th = 2 * math.pi * (i + 0.5) / (g.lobes or 6)
            p, nrm = g.surf(th, top * 0.42)
            d = (nrm * 0.45 + P(0, 0, 1.0)).normalized()
            with oriented(p - nrm * 0.02, d):
                lathe([(0.055, 0), (0.05, 0.06), (0.035, 0.11), (0, 0.13)], (0, 0, 0), col, n=6)


# ---------------------------------------------------------------- the assembler

def swan_body(col, speck=None):
    pts = [(0, 0, 0.0), (0, 0, 0.18), (0.02, 0, 0.36), (0.0, 0, 0.56), (-0.12, 0, 0.7), (-0.26, 0, 0.66), (-0.3, 0, 0.56)]

    def prof(t):
        if t < 0.28:
            return 0.04 + 0.26 * math.sin(math.pi * min(1, t / 0.28 * 0.62 + 0.0) * 0.9 + 0.25)
        return 0.085 - 0.04 * (t - 0.28) / 0.72
    sp = spline(pts, 18)
    tube(pts, prof, col, rings=18, n=10, side=(0, 1, 0))
    if speck:
        r = rng(11)
        for i in range(30):
            k = r.randint(1, 16)
            t = k / 17
            c = sp[k]
            tg = (sp[k + 1] - sp[k - 1]).normalized()
            u, v = kit.frame(tg, (1, 0, 0))
            a = r.uniform(0, 2 * math.pi)
            nrm = u * math.cos(a) + v * math.sin(a)
            rr = prof(t)
            with oriented(c + nrm * rr * 0.97, nrm):
                ell((0, 0, 0), (0.022, 0.022, 0.008), speck, seg=6, ring=4)
    return P(-0.3, 0, 0.5)


def gourd(body="round", skin="orange", stem_kind="stub", wart=None, s=1.0, rz=25.0, lay=False):
    """A pumpkin/gourd from parts. Returns the Gourd (for carving) or None."""
    sk = SKINS[skin]
    prof, lobes, depth = BODIES[body]
    scol = sk.get("stem", STEM_COL)
    with at((0, 0, 0), rz=rz, s=s):
        if body == "swan":
            tip = swan_body(sk["col"], sk.get("speck"))
            with at(tip, ry=180):
                stem("nub", scol)
            return None
        g = Gourd(prof, lobes, depth)
        if lay:
            # lying on its side, stem end toward +x
            rad = max(r for r, _ in prof)
            with at((-g.top / 2, 0, rad * (1 - depth * 0.5)), ry=90):
                g.build(sk["col"], rough=0.55)
                if sk.get("stripe"):
                    g.stripes(sk["stripe"])
                with at((0, 0, prof[-1][1])):
                    stem(stem_kind, scol)
            return g
        g.build(sk["col"], sk.get("col2"), sk.get("split", 0.5), rough=0.55)
        if body == "turban":
            cap = Gourd(TURBAN_CAP, 5, 0.18)
            cap.build(sk.get("cap", CREAM))
            for i in range(5):
                th = 2 * math.pi * i / 5
                pts = []
                for z in (0.33, 0.38, 0.44, 0.5):
                    p, nrm = cap.surf(th, z)
                    pts.append(p + nrm * 0.006)
                tube(pts, lambda t: (0.03 * (1 - 0.7 * t), 0.012), sk.get("stripe", LEAF_D), rings=6, n=6,
                     side=(-math.sin(th), math.cos(th), 0))
            top = TURBAN_CAP[-1][1]
        else:
            top = prof[-1][1]
        if sk.get("stripe") and body != "turban":
            g.stripes(sk["stripe"])
        if sk.get("speck"):
            g.speckles(sk["speck"], 46, 0.018, z0=0.08, z1=0.9)
        if sk.get("spot"):
            with at((0, 0, 0)):
                g.speckles(sk["spot"], 1, 0.11, seed=5, z0=0.1, z1=0.2)
        if wart:
            warts(g, wart, sk.get("spike") or sk.get("wart") or _wartcol(sk), seed=4)
        with at((0, 0, top)):
            stem(stem_kind, scol)
        return g


def _wartcol(sk):
    c = sk.get("col2") or sk["col"]
    return tuple(min(1, x * 0.92 + 0.02) for x in c)


# ---------------------------------------------------------------- varieties (recipes)
VARIETIES = [
    ("classic orange", dict(body="round", skin="orange", stem_kind="stub")),
    ("giant prize", dict(body="squat", skin="prize", stem_kind="giant", s=1.0)),
    ("mini", dict(body="flat", skin="orange", stem_kind="tall", s=0.42)),
    ("white ghost", dict(body="round", skin="ghost white", stem_kind="curly", s=0.9)),
    ("Cinderella", dict(body="flat", skin="cinder red", stem_kind="leafy")),
    ("blue Jarrahdale", dict(body="flat", skin="jarrah blue", stem_kind="stub", s=0.95)),
    ("warty goblin", dict(body="tall", skin="goblin", stem_kind="curly", wart="knobbly", s=0.85)),
    ("green-striped", dict(body="round", skin="cream stripe", stem_kind="stub", s=0.7)),
    ("turban squash", dict(body="turban", skin="turban", stem_kind="stub", s=0.8)),
    ("butternut", dict(body="neck", skin="butternut", stem_kind="nub", s=0.75)),
    ("acorn", dict(body="acorn", skin="acorn green", stem_kind="stub", s=0.7)),
    ("spaghetti", dict(body="oval", skin="spaghetti", stem_kind="nub", lay=True, s=0.9)),
    ("swan-neck gourd", dict(body="swan", skin="swan green", stem_kind="nub", s=0.9, rz=70)),
    ("bottle gourd", dict(body="bottle", skin="bottle", stem_kind="nub", s=0.85)),
    ("crown of thorns", dict(body="crown", skin="crown", stem_kind="stub", wart="crown", s=0.85)),
    ("speckled pear", dict(body="pear", skin="speckled", stem_kind="curly", s=0.6)),
]


# ---------------------------------------------------------------- carved faces (inserts)

def _tri(cx, cy, w, h, up=True, skew=0.0):
    if up:
        return [(cx - w / 2, cy - h / 2), (cx + w / 2, cy - h / 2), (cx + skew, cy + h / 2)]
    return [(cx - w / 2, cy + h / 2), (cx + skew, cy - h / 2), (cx + w / 2, cy + h / 2)]


def _ngon(cx, cy, rx, ry, n=8, rot=0.0):
    return [(cx + rx * math.cos(rot + 2 * math.pi * i / n), cy + ry * math.sin(rot + 2 * math.pi * i / n)) for i in range(n)]


def _smile(cx, cy, w, h, thick=0.45, teeth=0, a0=200, a1=340, tooth_h=0.35):
    """A crescent grin. teeth > 0 bites square notches out of its top edge."""
    k = 12
    outer = [(cx + w / 2 * math.cos(math.radians(a0 + (a1 - a0) * i / k)), cy + h * math.sin(math.radians(a0 + (a1 - a0) * i / k))) for i in range(k + 1)]
    inner = []
    m = 24
    for i in range(m + 1):
        a = math.radians(a0 + (a1 - a0) * i / m)
        x = cx + w / 2 * 0.92 * math.cos(a)
        y = cy + h * thick * math.sin(a) + h * 0.05
        if teeth:
            band = int(i / (m + 1) * (teeth * 2 + 1))
            if band % 2 == 1:
                y -= h * tooth_h
        inner.append((x, y))
    return outer + inner[::-1]


FACES = {
    "classic": lambda: [_tri(-0.13, 0.08, 0.13, 0.11), _tri(0.13, 0.08, 0.13, 0.11), _tri(0, -0.01, 0.07, 0.06),
                        _smile(0, -0.06, 0.4, 0.13, thick=0.3, teeth=2)],
    "happy": lambda: [_ngon(-0.12, 0.09, 0.055, 0.065, 6, 0.5), _ngon(0.12, 0.09, 0.055, 0.065, 6, 0.5),
                      _smile(0, -0.02, 0.38, 0.15, thick=0.2, a0=195, a1=345)],
    "spooky": lambda: [[(-0.2, 0.13), (-0.05, 0.06), (-0.17, 0.03)], [(0.2, 0.13), (0.17, 0.03), (0.05, 0.06)],
                       [(-0.19, -0.04), (-0.12, -0.02), (-0.08, -0.07), (-0.03, -0.02), (0.03, -0.07), (0.08, -0.02), (0.12, -0.07), (0.19, -0.04),
                        (0.12, -0.14), (0.07, -0.1), (0.02, -0.15), (-0.03, -0.1), (-0.08, -0.15), (-0.13, -0.1)]],
    "surprised": lambda: [_ngon(-0.11, 0.1, 0.06, 0.075, 8), _ngon(0.11, 0.1, 0.06, 0.075, 8), _ngon(0, -0.08, 0.06, 0.075, 8)],
    "wink": lambda: [_smile(-0.12, 0.1, 0.12, 0.05, thick=0.1, a0=20, a1=160), _tri(0.12, 0.09, 0.12, 0.11),
                     _smile(0.02, -0.03, 0.34, 0.12, thick=0.3, a0=200, a1=330)],
    "toothy": lambda: [[(-0.18, 0.05), (-0.06, 0.05), (-0.06, 0.14), (-0.18, 0.14)], [(0.06, 0.05), (0.18, 0.05), (0.18, 0.14), (0.06, 0.14)],
                       [(-0.18, -0.02), (-0.04, -0.02), (-0.04, -0.06), (0.04, -0.06), (0.04, -0.02), (0.18, -0.02), (0.12, -0.13), (-0.12, -0.13)]],
}
INSIDE = C(64, 34, 24)
GLOW = C(255, 196, 84)


def carved(face_kind, lit=False, s=1.0, body="round", skin="orange", stem_kind="stub"):
    g = gourd(body, skin, stem_kind, s=s, rz=0)
    zc = 0.3 if body == "round" else g.top * 0.5
    with at((0, 0, 0), s=s):
        decal(FACES[face_kind](), gourd_surf(g, FRONT, zc), GLOW if lit else INSIDE,
              proud=0.008, depth=0.06, emit=1.4 if lit else 0.0, rough=0.9)


# ---------------------------------------------------------------- prize sizes

def prize(size):
    s = [0.55, 1.0, 1.6, 2.3][size]
    body = "round" if size == 0 else "squat"
    stem_kind = ["curly", "stub", "giant", "giant"][size]
    skin = "orange" if size < 2 else "prize"
    if size == 3:
        # record-breaker sits on a pallet and wears a rosette
        with at((0, 0, 0), rz=25):
            for x in (-0.7, 0, 0.7):
                box((0.16, 1.7, 0.1), (x, 0, 0.05), WOOD_D, bevel=0.02)
            for y in (-0.7, 0, 0.7):
                box((1.8, 0.28, 0.06), (0, y, 0.13), WOOD, bevel=0.02)
        sq = s * 0.8
        with at((0, 0, 0.16)):
            gourd(body, skin, stem_kind, s=sq, rz=0)
        import props
        g = Gourd(BODIES["squat"][0], 10, 0.07)
        p, nrm = g.surf(FRONT * D2R, 0.26)
        with oriented(P(p.x * sq, p.y * sq, 0.16 + p.z * sq) + nrm * 0.01, nrm):
            props.rosette_flat(0, s=2.0)
        return
    gourd(body, skin, stem_kind, s=s)



def stem_cell(kind):
    with at((0, 0, 0), rz=25):
        lathe([(0.32, 0), (0.3, 0.05), (0.2, 0.1), (0.08, 0.125), (0, 0.11)], (0, 0, 0), ORANGE, n=16, lobes=8, lobe_depth=0.1)
        with at((0, 0, 0.11)):
            stem(kind)


BODY_ORDER = ["round", "tall", "flat", "squat", "turban", "acorn", "oval", "neck", "pear", "bottle", "crown", "swan"]
SKIN_ORDER = ["orange", "ghost white", "cinder red", "jarrah blue", "cream stripe", "goblin", "prize", "butternut",
              "acorn green", "spaghetti", "speckled", "swan green", "bottle", "crown", "withered"]


def _body_cell(b):
    kw = dict(body=b, skin="putty", stem_kind="nub" if b in ("neck", "oval", "pear", "bottle", "swan") else "stub")
    if b == "oval":
        kw["lay"] = True
    if b == "swan":
        kw["rz"] = 70
    return lambda: gourd(**kw)


def parts_rows():
    bodies = [(b, _body_cell(b)) for b in BODY_ORDER]
    stems = [(k, (lambda k=k: stem_cell(k))) for k in ("stub", "tall", "curly", "leafy", "giant", "dry", "nub")]
    warts_ = [("none", lambda: gourd("round", "orange", "stub")),
              ("few", lambda: gourd("round", "orange", "stub", wart="few")),
              ("many", lambda: gourd("round", "orange", "stub", wart="many")),
              ("knobbly", lambda: gourd("round", "orange", "stub", wart="knobbly")),
              ("crown spikes", lambda: gourd("crown", "orange", "stub", wart="crown"))]
    skins = [(k, (lambda k=k: gourd("round", k, "stub"))) for k in SKIN_ORDER]
    return [("Body shapes", bodies[:6]), ("Body shapes (gourds)", bodies[6:]), ("Stems", stems), ("Warts", warts_),
            ("Skins (colourways)", skins[:8]), ("Skins (cont.)", skins[8:])]


def prize_rows():
    sizes = [(n, (lambda i=i: prize(i))) for i, n in enumerate(["small", "big", "huge", "record-breaker"])]
    faces = [(k, (lambda k=k: carved(k))) for k in FACES]
    lit = [("classic, lit", lambda: carved("classic", lit=True)), ("spooky, lit", lambda: carved("spooky", lit=True)),
           ("happy on ghost white", lambda: carved("happy", skin="ghost white", stem_kind="curly")),
           ("surprised on tall", lambda: carved("surprised", body="tall", stem_kind="tall")),
           ("toothy on Jarrahdale", lambda: carved("toothy", body="flat", skin="jarrah blue")),
           ("wink, lit, on goblin", lambda: carved("wink", lit=True, body="tall", skin="goblin", stem_kind="curly"))]
    return [("Prize pumpkin sizes (true scale)", sizes), ("Carved face inserts", faces), ("Inserts on other bodies + lit", lit)]
