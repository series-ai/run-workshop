"""The base kids: ten ready-made looks from the wardrobe (concepts/wardrobe.py),
each a hairstyle, a face extra, a top, bottoms, shoes and a held prop on the
same Bobble body, in its own colourways and skin tone. The avatar kit
(rig/export_kit.py) ships every piece separately so a game can mix them."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from wardrobe import *  # noqa: F401,F403

T = SKIN_TONES

# slug: (skin tone, look). The kid is always built in SKIN, so the export marks all of it as
# swappable skin; render_costume recolours it to the tone.
LOOKS = {
    # Anime kid: red hoodie, hood down, drawstrings; spiky blue-black crest
    "kid-spiky": (1, {"hair": ("anime", "blue"), "face": ("none", "-"), "top": ("hoodie", "red"), "bottom": ("pants", "charcoal"),
                      "shoes": ("sneakers", "white"), "prop": ("bucket-full", "pumpkin"), "side": -1}),
    # Farm kid: denim overalls on a striped tee; long ginger braids with bows
    "kid-pigtails": (0, {"hair": ("braids", "ginger"), "face": ("none", "-"), "top": ("stripy", "sailor"), "bottom": ("overalls", "denim"),
                         "shoes": ("classic", "gold"), "prop": ("bucket", "pumpkin")}),
    # Sporty: gold and purple basketball jersey; the afro with a comb
    "kid-afro": (5, {"hair": ("afro", "black"), "face": ("none", "-"), "top": ("jersey", "gold"), "bottom": ("shorts", "purple"),
                     "shoes": ("sneakers", ("white", "purple", "white")), "prop": ("bucket-full", "pumpkin")}),
    # Dreamy: mint cardigan, skirt; long chestnut hair to the shoulders with a flower
    "kid-bob": (2, {"hair": ("long", "chestnut"), "face": ("none", "-"), "top": ("cardigan", "mint"), "bottom": ("skirt", "rose"),
                    "shoes": ("classic", "red"), "prop": ("bucket", "pumpkin"), "side": -1}),
    # Sparkly: pink tube top with a star, tutu; the space buns
    "kid-puffs": (4, {"hair": ("puffs", "dark"), "face": ("none", "-"), "top": ("tube-top", "pink"), "bottom": ("tutu", "lilac"),
                      "shoes": ("classic", "yellow"), "prop": ("bucket-full", "pumpkin"), "side": -1}),
    # Puddle jumper: yellow rain jacket, red wellies; giant fountain ponytail
    "kid-ponytail": (3, {"hair": ("ponytail", "brown"), "face": ("none", "-"), "top": ("raincoat", "yellow"), "bottom": ("pants", "yellow"),
                         "shoes": ("wellies", "red"), "prop": ("bucket", "pumpkin")}),
    # Rocker: black lightning tee, ripped jeans, bandana; hot pink mohawk
    "kid-buzz": (4, {"hair": ("mohawk", "punk"), "face": ("none", "-"), "top": ("band-tee", "rock"), "bottom": ("jeans", "light"),
                     "shoes": ("sneakers", "black"), "prop": ("bucket", "pumpkin"), "side": -1}),
    # Little professor: argyle sweater vest, bow tie, shorts; blonde pompadour
    "kid-bun": (1, {"hair": ("quiff", "blonde"), "face": ("none", "-"), "top": ("sweater-vest", "green"), "bottom": ("shorts", "khaki"),
                    "shoes": ("classic", "brown"), "prop": ("bucket-full", "pumpkin")}),
    # Explorer: teal puffer vest, backpack; giant copper curly cloud
    "kid-curly": (3, {"hair": ("cloud", "copper"), "face": ("none", "-"), "top": ("puffer", "teal"), "bottom": ("pants", "brown"),
                      "shoes": ("sneakers", "blue"), "prop": ("bucket-full", "pumpkin"), "side": -1}),
    # Cool kid: oversized striped sweater, headphones; platinum side swoop
    "kid-platinum": (0, {"hair": ("swoop", "platinum"), "face": ("none", "-"), "top": ("sweater", "midnight"), "bottom": ("pants", "grey"),
                         "shoes": ("sneakers", ("white", "black", "white")), "prop": ("bucket", "pumpkin")}),
}


def make(tone, look):
    def build():
        dress(look)
    build.tone = T[tone]
    return build


KIDS = {slug: make(tone, look) for slug, (tone, look) in LOOKS.items()}

if __name__ == "__main__" or True:
    run(KIDS)
