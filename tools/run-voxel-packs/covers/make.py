"""Build the 16 pack covers (4 packs x world, characters, icons, ui) into covers/out/.

    python3 covers/make.py [--only fantasy-world,space-icons] [--blender out/blender1.sh] [--reuse]

World and characters covers are Blender scenes of the pack's own staged GLBs
(cover_scene.py); icons and ui covers lay the pack's own PNGs over a softened copy of
the world scene. Every cover gets the pack logo along the bottom (cover_title.py).
`npm run stage` copies covers/out/<leaf>.png into the jam-ready-assets checkout as the
leaf's preview source. Run after a pack build (needs out/jam-stage).
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
TOOL = os.path.dirname(HERE)
STAGE = os.path.join(TOOL, "out", "jam-stage")
OUT = os.path.join(HERE, "out")
sys.path.insert(0, HERE)
import cover_title as T  # noqa: E402

PACKS = {  # pack key -> (stage dir, theme dir, file prefix, ground colour)
    "fantasy": ("run-voxel-fantasy", "fantasy", "fantasy", (0.16, 0.32, 0.09)),
    "space": ("run-voxel-space", "space-scifi", "space", (0.16, 0.14, 0.24)),
    "monster": ("run-voxel-monster", "monster", "monster", (0.09, 0.12, 0.08)),
    "apocalypse": ("run-voxel-post-apocalypse", "post-apocalypse", "apocalypse", (0.30, 0.22, 0.13)),
}

# World scenes are a little town: buildings along the back (they may crop at the top),
# creatures hanging out in the middle (the hero in the centre, posed mid-attack), and
# props with the smallest critters in front. The camera frames the front two rows.
WORLD = {
    "fantasy": dict(
        front=["creatures/slime", "props/market-stall", "creatures/goblin"],
        mid=["creatures/griffin", ("creatures/dragon", "attack", 0.3), "creatures/unicorn"],
        back=["buildings/windmill", "buildings/tavern", "buildings/castle-keep", "buildings/wizard-tower"]),
    "space": dict(
        front=["creatures/robot-dog", "creatures/alien-grunt", "creatures/ufo-drone"],
        mid=[("creatures/mech-walker", "attack", 0.3)],
        back=["buildings/hab-dome", "buildings/control-tower", "buildings/observatory"]),
    "monster": dict(
        front=["props/jack-o-lantern", "creatures/imp", "animated-props/witch-cauldron", "creatures/vampire-bat"],
        mid=["creatures/werewolf", ("creatures/vampire-lord", "attack", 0.35), "creatures/wailing-ghost", "creatures/zombie-ghoul"],
        back=["buildings/witch-hut", "buildings/haunted-manor", "buildings/gothic-chapel", "buildings/potion-shop", "buildings/haunted-windmill"]),
    "apocalypse": dict(
        front=["props/oil-drum", "creatures/rad-rat", "animated-props/burning-barrel", "props/shopping-cart", "creatures/crow", "props/tire-stack"],
        mid=["creatures/zombie-walker", "creatures/mutant-dog", ("creatures/mutant-behemoth", "attack", 0.6), "creatures/raider-bot", "creatures/zombie-runner"],
        back=["buildings/gas-station", "buildings/roadside-diner", "buildings/water-tower", "buildings/trading-post", "buildings/watchtower"]),
}
# How far the town's front rows may run past the frame edges (less = the camera stands back).
WORLD_OVERFLOW = {"fantasy": 0.98, "space": 0.72}
WORLD_BEHIND = {"space": 1.8}
WORLD_GAP = {"space": 1.1}  # its crew spread out in front of the mech  # the space hero (the tall mech) stands further back, behind its crew
# Characters: the pack's six avatar skins hanging out in front of a few props and buildings.
CHARACTER_SET = {
    "fantasy": dict(props=["props/barrel", "props/market-stall", "props/crate"], back=["buildings/tavern", "buildings/castle-tower", "buildings/bakery"]),
    "space": dict(props=["props/cargo-crate", "props/vending-machine", "props/fuel-barrel"], back=["buildings/hab-dome", "buildings/cantina", "buildings/control-tower"]),
    "monster": dict(props=["props/jack-o-lantern", "props/lamp-post", "props/gravestone-rounded"], back=["buildings/crypt", "buildings/haunted-manor", "buildings/potion-shop"]),
    "apocalypse": dict(props=["props/oil-drum", "props/vending-machine", "props/tire-stack"], back=["buildings/trading-post", "buildings/gas-station", "buildings/roadside-diner"]),
}
ICONS = {  # nine icons per pack, by model id suffix
    "fantasy": ["creatures-dragon", "creatures-griffin", "creatures-unicorn", "held-items-flail", "animated-props-rune-portal",
                "vehicles-sky-airship", "creatures-phoenix", "animated-props-treasure-chest", "creatures-slime"],
    "space": ["creatures-mech-walker", "creatures-ufo-drone", "creatures-xeno-queen", "vehicles-star-fighter", "animated-props-airlock-door",
              "creatures-alien-grunt", "vehicles-hover-bike", "creatures-robot-dog", "creatures-space-jelly"],
    "monster": ["creatures-vampire-lord", "creatures-werewolf", "creatures-wailing-ghost", "creatures-lich", "animated-props-jack-in-the-box",
                "vehicles-pumpkin-coach", "creatures-giant-spider", "animated-props-vampire-coffin", "creatures-imp"],
    "apocalypse": ["creatures-mutant-behemoth", "creatures-raider-bot", "creatures-zombie-walker", "vehicles-war-pickup", "animated-props-spike-trap",
                   "creatures-rad-rat", "vehicles-gyrocopter", "creatures-crow", "creatures-mutant-dog"],
}
SKIN_TURN = 90  # the avatar skins are modelled facing sideways
SUBTITLE = {"world": "VOXEL WORLD", "characters": "VOXEL HEROES", "icons": "VOXEL ICONS", "ui": "VOXEL UI"}


def glb(pack: str, rel: str, leaf: str = "world") -> str:
    stage, theme, prefix, _ = PACKS[pack]
    cat, name = rel.split("/")
    sub = "characters" if leaf == "characters" else theme
    return os.path.join(STAGE, stage, "3D", sub, cat, f"{prefix}-{cat}-{name}.glb")


def row(pack, items, leaf="world"):
    out = []
    for it in items:
        rel, clip, t = (it, "", 0.0) if isinstance(it, str) else it
        out.append({"path": glb(pack, rel, leaf), "clip": clip, "t": t})
    return out


REUSE = "--reuse" in sys.argv  # keep the last scene renders (to redo logos and 2D covers quickly)


def render(spec: dict, png: str, blender: str) -> None:
    if REUSE and os.path.exists(png):
        return
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(spec, f)
    if os.path.exists(png):
        os.remove(png)  # Blender exits 0 even when the script fails: never pick up a stale render
    r = subprocess.run([blender, "-b", "--factory-startup", "--python", os.path.join(HERE, "cover_scene.py"), "--", f.name, png],
                       capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(png) or "Traceback" in r.stderr + r.stdout:
        raise SystemExit(f"render failed for {png}:\n{r.stdout[-2000:]}\n{r.stderr[-2000:]}")


def backdrop(pack: str, size: int = 1024) -> Image.Image:
    """A plain sky in the pack's colours: the 2D covers show their pieces on it, nothing behind."""
    return T.gradient((size, size), *T.THEMES[pack]["sky"]).convert("RGBA")


def label(img: Image.Image, text: str, centre, size: int, fill=(255, 255, 255), big: bool = False) -> None:
    """Pixel-font text with a square ink outline, centred on a point."""
    f = T.font(T.WORD_FONT if big else T.SMALL_FONT, size)
    bb = f.getbbox(text)
    m = Image.new("L", img.size, 0)
    x, y = centre[0] - (bb[0] + bb[2]) // 2, centre[1] - (bb[1] + bb[3]) // 2
    ImageDraw.Draw(m).text((x, y), text, font=f, fill=255)
    ink = Image.new("RGBA", img.size, (24, 16, 40, 0))
    ink.putalpha(T.grow(m, max(2, size // 10)))
    img.alpha_composite(ink)
    col = Image.new("RGBA", img.size, fill + (0,))
    col.putalpha(m)
    img.alpha_composite(col)


def icon_fit(stage: str, prefix: str, name: str, box: int) -> Image.Image:
    icon = Image.open(os.path.join(STAGE, stage, "icons", f"icon-{prefix}-{name}.png")).convert("RGBA")
    icon = icon.crop(icon.getchannel("A").getbbox())  # the icon files are padded
    k = box / max(icon.size)
    return icon.resize((round(icon.width * k), round(icon.height * k)), Image.LANCZOS)


def up(img: Image.Image, k: float) -> Image.Image:
    return img.resize((round(img.width * k), round(img.height * k)), Image.NEAREST)


def icons_cover(pack: str, bg: Image.Image) -> Image.Image:
    stage, _, prefix, _ = PACKS[pack]
    out = bg.copy()
    size, gap = 230, 16
    x0 = (out.width - 3 * size - 2 * gap) // 2
    for i, name in enumerate(ICONS[pack]):
        icon = Image.open(os.path.join(STAGE, stage, "icons", f"icon-{prefix}-{name}.png")).convert("RGBA")
        icon = icon.crop(icon.getchannel("A").getbbox())  # the icon files are padded
        k = size / max(icon.size)
        icon = icon.resize((round(icon.width * k), round(icon.height * k)), Image.LANCZOS)
        shadow = Image.new("RGBA", icon.size, (0, 0, 0, 0))
        shadow.putalpha(icon.getchannel("A").point(lambda v: v * 0.35).filter(ImageFilter.GaussianBlur(6)))
        x = x0 + (i % 3) * (size + gap) + (size - icon.width) // 2
        y = 22 + (i // 3) * (size + gap) + (size - icon.height) // 2
        out.alpha_composite(shadow, (x + 4, y + 8))
        out.alpha_composite(icon, (x, y))
    return out


UI_WORDS = {"fantasy": ("INVENTORY", "BACK", "EQUIP"), "space": ("CARGO BAY", "BACK", "EQUIP"),
            "monster": ("CRYPT LOOT", "BACK", "EQUIP"), "apocalypse": ("STASH", "BACK", "EQUIP")}


def ui_cover(pack: str, bg: Image.Image) -> Image.Image:
    """A game screen built from the pack's UI pieces: a titled dialog with labelled bars,
    inventory slots and rarity frames holding the pack's icons, and labelled buttons."""
    stage, _, prefix, _ = PACKS[pack]

    def ui(name: str) -> Image.Image:
        return Image.open(os.path.join(STAGE, stage, "ui", f"ui-{prefix}-{name}.png")).convert("RGBA")

    title, back, ok = UI_WORDS[pack]
    out = bg.copy()
    W = out.width
    dialog = up(ui("general-dialog"), 3)
    dx, dy = (W - dialog.width) // 2 + 30, 92
    out.alpha_composite(dialog, (dx, dy))
    banner = up(ui("general-header-banner"), 2)
    bx, by = dx + (dialog.width - banner.width) // 2, 34
    out.alpha_composite(banner, (bx, by))
    label(out, title, (bx + banner.width // 2, by + round(banner.height * 0.53)), 54, big=True)  # the face sits a little low in the art
    close = up(ui("general-icon-close"), 1)
    out.alpha_composite(close, (dx + dialog.width - close.width + 14, dy - 14))
    frame = up(ui("general-progress-frame"), 2)
    for k, (fill, share, name) in enumerate((("health", 0.8, "HP"), ("energy", 0.55, "MP"), ("xp", 0.35, "XP"))):
        fx, fy = dx + (dialog.width - frame.width) // 2, 212 + k * 70  # centred: even margins on both sides
        out.alpha_composite(frame, (fx, fy))
        bar = up(ui(f"general-progress-fill-{fill}"), 2)
        out.alpha_composite(bar.crop((0, 0, round(bar.width * share), bar.height)), (fx + 16, fy + 16))
        label(out, name, (fx + 46, fy + frame.height // 2 - 1), 30)  # the label rides on the bar
    slots = ["general-slot-filled", "general-slot-selected", "general-slot-filled", "general-slot-locked"]
    s0 = up(ui(slots[0]), 2)
    sx0 = dx + (dialog.width - 4 * s0.width - 3 * 20) // 2
    for k, name in enumerate(slots):
        sx = sx0 + k * (s0.width + 20)
        out.alpha_composite(up(ui(name), 2), (sx, 430))
        if name != "general-slot-locked":
            icon = icon_fit(stage, prefix, ICONS[pack][3 + k], s0.width - 28)
            out.alpha_composite(icon, (sx + (s0.width - icon.width) // 2, 430 + (s0.height - icon.height) // 2))
    for k, (name, text) in enumerate((("buttons-secondary-wide-default", back), ("buttons-primary-wide-default", ok))):
        b = ui(name)
        x = dx + dialog.width // 2 - b.width - 12 + k * (b.width + 24)
        out.alpha_composite(b, (x, 572))
        label(out, text, (x + b.width // 2, 572 + b.height // 2 - 3), 36)
    # side tabs: the rarity frames holding the pack's own UI glyphs (model sprites read badly this small)
    glyphs = ("general-icon-plus", "general-icon-check", "general-icon-arrow", "general-checkbox-on", "general-icon-close")
    for k, (r, glyph) in enumerate(zip(("common", "uncommon", "rare", "epic", "legendary"), glyphs)):
        g = up(ui(f"rarities-rarity-{r}"), 1.5)
        gx, gy = dx - g.width // 2 - 6, dy + 24 + k * (g.height + 10)
        out.alpha_composite(g, (gx, gy))
        icon = ui(glyph)
        icon = icon.crop(icon.getchannel("A").getbbox())
        icon = up(icon, max(1, (g.width - 40) // max(icon.size)))
        out.alpha_composite(icon, (gx + (g.width - icon.width) // 2, gy + (g.height - icon.height) // 2))
    return out


def finish(img: Image.Image, pack: str, leaf: str, dst: str, flat: bool) -> None:
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        img.save(f.name)
    args = [sys.executable, os.path.join(HERE, "cover_title.py")] + (["--flat"] if flat else []) + [f.name, pack, SUBTITLE[leaf], dst]
    subprocess.run(args, check=True, capture_output=True)


def leaf_name(pack: str, leaf: str) -> str:
    stage, theme, _, _ = PACKS[pack]
    return {"world": f"{stage}--3D--{theme}", "characters": f"{stage}--3D--characters", "icons": f"{stage}--icons", "ui": f"{stage}--ui"}[leaf]


def main() -> None:
    only = set(sys.argv[sys.argv.index("--only") + 1].split(",")) if "--only" in sys.argv else None
    blender = sys.argv[sys.argv.index("--blender") + 1] if "--blender" in sys.argv else os.path.join(TOOL, "out", "blender1.sh")
    os.makedirs(OUT, exist_ok=True)
    work = os.path.join(tempfile.gettempdir(), "rvx-covers")
    os.makedirs(work, exist_ok=True)
    for pack, (stage, theme, prefix, ground) in PACKS.items():
        want = lambda leaf: only is None or f"{pack}-{leaf}" in only  # noqa: E731
        scene = os.path.join(work, f"{pack}-world.png")
        if want("world"):
            w = WORLD[pack]
            render({"ground": list(ground), "yaw": 14, "pitch": 10, "lens": 60, "overflow": WORLD_OVERFLOW.get(pack, 1.15), "bottom": 0.16,
                    "rows": [{"items": row(pack, w["front"]), "gap": WORLD_GAP.get(pack, 0.25), "stagger": 0.25, "behind": WORLD_BEHIND.get(pack, 0.5)},
                             {"items": row(pack, w["mid"]), "gap": 0.35, "stagger": 0.45, "behind": 1.2},
                             {"items": row(pack, w["back"]), "gap": 0.6, "stagger": 0.8, "frame": False}]}, scene, blender)
        if want("world"):
            finish(Image.open(scene), pack, "world", os.path.join(OUT, leaf_name(pack, "world") + ".png"), flat=False)
        if want("characters"):
            skins = sorted(f for f in os.listdir(os.path.join(STAGE, stage, "3D", "characters", "characters-skins")) if f.endswith(".glb"))
            chars = os.path.join(work, f"{pack}-characters.png")
            c = CHARACTER_SET[pack]
            skin = lambda f: {"path": os.path.join(STAGE, stage, "3D", "characters", "characters-skins", f), "turn": SKIN_TURN, "arms": 65}  # noqa: E731
            render({"ground": list(ground), "yaw": 12, "pitch": 8, "lens": 60, "overflow": 1.3, "bottom": 0.16,
                    "rows": [{"items": [skin(f) for f in skins[:3]], "gap": 0.3, "stagger": 0.08, "behind": 0.55},
                             {"items": [skin(f) for f in skins[3:]], "gap": 0.3, "stagger": 0.08, "behind": 0.4, "shift": 0.42},
                             # the avatars are built far smaller than the world models: size the set to them
                             {"items": [dict(i, height=0.75) for i in row(pack, c["props"])], "gap": 0.9, "stagger": 0.15, "behind": 0.6, "frame": False},
                             {"items": [dict(i, height=2.6) for i in row(pack, c["back"])], "gap": 0.15, "stagger": 0.3, "frame": False}]}, chars, blender)
            finish(Image.open(chars), pack, "characters", os.path.join(OUT, leaf_name(pack, "characters") + ".png"), flat=False)
        if want("icons"):
            finish(icons_cover(pack, backdrop(pack)), pack, "icons", os.path.join(OUT, leaf_name(pack, "icons") + ".png"), flat=True)
        if want("ui"):
            finish(ui_cover(pack, backdrop(pack)), pack, "ui", os.path.join(OUT, leaf_name(pack, "ui") + ".png"), flat=True)
        print(pack, "done")


if __name__ == "__main__":
    main()
