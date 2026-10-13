"""Gallery page of every rendered costume: the 3/4 view, front and side under it."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import os
OUT = _PKG + "/concepts/costumes/renders"
ORDER = ["kid-spiky", "kid-pigtails", "kid-afro", "kid-bob", "kid-puffs", "kid-ponytail", "kid-buzz", "kid-bun", "kid-curly", "kid-platinum", "ghost", "bucket-empty", "bucket-full", "ned-kelly", "reverse-mermaid", "inflatable-trex", "hot-dog", "cardboard-robot",
         "skeleton-onesie", "pumpkin-clown", "frankenstein", "dracula", "mummy", "werewolf", "pirate-ghost", "hamilton", "cat-onesie"]
have = {f[:-7] for f in os.listdir(OUT) if f.endswith("-34.png")}
slugs = [s for s in ORDER if s in have] + sorted(have - set(ORDER))
cards = "".join(f'''<figure><a href="{s}-sheet.png"><img src="{s}-34.png"></a><div class=row><img src="{s}-front.png"><img src="{s}-side.png"></div>
<figcaption>{s.replace("-", " ").title()}</figcaption></figure>''' for s in slugs)
open(os.path.join(OUT, "gallery.html"), "w").write(f"""<!doctype html><meta charset=utf-8><title>Costume kids</title>
<style>body{{background:#dcd4c7;font-family:Helvetica,Arial;margin:24px;color:#2b2622}}h1{{font-size:22px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}}figure{{margin:0;background:#e6dfd3;border-radius:10px;padding:8px}}
img{{width:100%;display:block}}.row{{display:flex;gap:4px}}.row img{{width:50%}}figcaption{{font-weight:bold;padding:6px 2px}}</style>
<h1>Costume kids: Bobble body concepts ({len(slugs)})</h1><p><a href="../../skins.png">Skin tone swap test (4 costumes × 4 tones)</a></p><div class=grid>{cards}</div>""")
print(len(slugs), "in gallery")
