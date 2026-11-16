"""Silhouette overlay: concept vs model at the same height, aligned on the chest.
grey = both, red = only the concept (model too small there), blue = only the model (too big).
Also prints the silhouette width of each at every 5% of height, and the mismatch score."""
import sys
import numpy as np
from PIL import Image, ImageChops, ImageDraw

species, variant, out = sys.argv[1], sys.argv[2], sys.argv[3]
H = 900


def concept_mask(half):
    im = Image.open(f"concepts/2d/{species}.png").convert("RGB")
    w, h = im.size
    im = im.crop((0, 0, w // 2, h) if half == 0 else (w // 2, 0, w, h))
    a = np.asarray(im).astype(int)
    bg = a[5, 5]
    m = (np.abs(a - bg).sum(axis=2) > 30)
    return m


def model_mask(view):
    im = Image.open(f"out/review/{species}-{variant}-{view}.png")
    return np.asarray(im)[:, :, 3] > 40


def fit(m):
    ys, xs = np.nonzero(m)
    m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    im = Image.fromarray((m * 255).astype(np.uint8))
    im = im.resize((max(1, int(im.width * H / im.height)), H), Image.NEAREST)
    return np.asarray(im) > 127


def chest_x(m):
    rows = m[int(H * 0.28):int(H * 0.45)]   # 55-72% height from the floor
    ys, xs = np.nonzero(rows)
    return xs.mean()


panels, report = [], []
for half, view in ((1, "side"), (0, "34")):
    c, mo = fit(concept_mask(half)), fit(model_mask(view))
    W = 1400
    canvas_c, canvas_m = np.zeros((H, W), bool), np.zeros((H, W), bool)
    for src, dst in ((c, canvas_c), (mo, canvas_m)):
        off = int(W / 2 - chest_x(src))
        x0, x1 = max(0, off), min(W, off + src.shape[1])
        dst[:, x0:x1] = src[:, x0 - off:x1 - off]
    rgb = np.full((H, W, 3), 245, np.uint8)
    rgb[canvas_c & canvas_m] = (150, 150, 158)
    rgb[canvas_c & ~canvas_m] = (230, 60, 60)
    rgb[~canvas_c & canvas_m] = (60, 110, 230)
    img = Image.fromarray(rgb)
    d = ImageDraw.Draw(img)
    for i in range(21):
        y = int(H * i / 20)
        d.line([(0, y), (W, y)], fill=(200, 200, 205))
        d.text((3, y + 1), str(100 - 5 * i), fill=(90, 90, 90))
    d.text((10, H - 20), f"{view}: red = concept only, blue = model only", fill=(20, 20, 20))
    panels.append(img)
    miss = (canvas_c ^ canvas_m).sum() / max(1, canvas_c.sum())
    report.append(f"{view} mismatch {miss:.3f}")
    rows = []
    for i in range(20):
        y0, y1 = int(H * i / 20), int(H * (i + 1) / 20)
        cw = canvas_c[y0:y1].any(axis=0).sum()
        mw = canvas_m[y0:y1].any(axis=0).sum()
        rows.append(f"{100 - 5 * i:3d}% c{cw:4d} m{mw:4d} {'+' if mw > cw * 1.06 else '-' if mw < cw * 0.94 else ' '}")
    report.append("\n".join(rows))
sheet = Image.new("RGB", (sum(p.width for p in panels), H), (245, 245, 245))
x = 0
for p in panels:
    sheet.paste(p, (x, 0)); x += p.width
sheet.save(out)
print("\n".join(report))
