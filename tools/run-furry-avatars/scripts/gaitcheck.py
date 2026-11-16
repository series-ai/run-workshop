"""Frame-by-frame gait check from a GAIT_DUMP json (see build.py).
Prints per frame: body height, each paw's ball/toe height and forward speed, and flags
  POP    a joint whose acceleration (2nd difference) is far above the clip's typical value
  SKATE  a paw on the floor (ball < 1 cm) moving forward/back at a different speed than the floor
  FLOAT  a planted-phase paw more than 1 cm above the floor
  SINK   a paw below the floor
and draws a side-view strip of every frame (out/gait-<clip>-frames.png)."""
import json
import sys
from PIL import Image, ImageDraw

d = json.load(open(sys.argv[1]))
out = sys.argv[2] if len(sys.argv) > 2 else "out"
for clip, D in d.items():
    R, n = D["rows"], D["frames"]
    # floor speed: how fast a planted paw must slide back (the clip is in place)
    print(f"\n== {clip}: {n} frames @ {D['fps']} fps, stance {D['stance']}")
    joints = [k for k in R[0] if k != "root"]
    acc = {}
    for k in joints:
        acc[k] = [sum((R[(i + 1) % n][k][a] - 2 * R[i][k][a] + R[(i - 1) % n][k][a]) ** 2 for a in (1, 2)) ** 0.5 for i in range(n)]
    allacc = sorted(v for k in joints for v in acc[k])
    med = allacc[len(allacc) // 2]
    st = D["stance"]
    off = D.get("offset", 0.5)   # the right leg's phase behind the left (a gallop is less than half a cycle)
    sts = D.get("stances") or {"L": st, "R": st}   # per-leg stance (a gallop's legs differ)
    planted = lambda s, i: ((i / n) if s == "L" else ((i / n) + off) % 1) < sts[s] - 1e-9  # noqa: E731
    pl = [(s, i) for s in ("L", "R") for i in range(n) if planted(s, i)]
    ref_z = sorted(R[i][f"ball.{s}"][2] for s, i in pl)[len(pl) // 2]
    vys = sorted((R[(i + 1) % n][f"ball.{s}"][1] - R[(i - 1) % n][f"ball.{s}"][1]) / 2 for s, i in pl if planted(s, (i + 1) % n) and planted(s, (i - 1) % n))
    ref_vy = vys[len(vys) // 2] if vys else 0
    print(f"   planted ball height {ref_z*100:.1f} cm, floor speed {ref_vy*100:.2f} cm/frame; body range {min(r['hips'][2] for r in R[:n])*100:.1f}-{max(r['hips'][2] for r in R[:n])*100:.1f} cm")
    print(" f   body   L.ball  L.toe  L.vy    R.ball  R.toe  R.vy   flags")
    for i in range(n):
        flags = []
        for k in joints:
            if acc[k][i] > max(0.012, 6 * med):
                flags.append(f"POP {k} {acc[k][i]*100:.1f}cm/f2")
        line = f"{i:2d}  {R[i]['hips'][2]:.3f} "
        for s in ("L", "R"):
            b, t = R[i][f"ball.{s}"][2], R[i][f"toe.{s}"][2]
            vy = (R[(i + 1) % n][f"ball.{s}"][1] - R[(i - 1) % n][f"ball.{s}"][1]) / 2
            line += f"  {b:6.3f} {t:6.3f} {vy*100:6.2f} "
            if min(b, t) < -0.006:
                flags.append(f"SINK {s} {min(b, t)*100:.1f}cm")
            if planted(s, i):
                if abs(b - ref_z) > 0.01:
                    flags.append(f"{'FLOAT' if b > ref_z else 'DIP'} {s} {(b - ref_z)*100:+.1f}cm")
                if planted(s, (i + 1) % n) and planted(s, (i - 1) % n):
                    if abs(vy - ref_vy) > max(0.004, 0.2 * abs(ref_vy)):
                        flags.append(f"SKATE {s} {vy*100:.1f} vs {ref_vy*100:.1f}cm/f")
                    vx = (R[(i + 1) % n][f"ball.{s}"][0] - R[(i - 1) % n][f"ball.{s}"][0]) / 2
                    if abs(vx) > 0.004:
                        flags.append(f"SIDESLIP {s} {vx*100:.1f}cm/f")
            else:
                pass
        print(line, " ".join(flags))
    # side-view strip
    W, H, sc = 170, 300, 150
    img = Image.new("RGB", (W * n, H), "white")
    dr = ImageDraw.Draw(img)
    for i in range(n):
        ox = i * W + W // 2
        P = lambda k: (ox - R[i][k][1] * sc, H - 20 - R[i][k][2] * sc)  # noqa: E731  (front to the left... -y is forward)
        dr.line([(i * W, H - 20), (i * W + W, H - 20)], fill=(180, 180, 180))
        for s, col in (("L", (40, 90, 220)), ("R", (220, 80, 40))):
            dr.line([P(f"hip.{s}"), P(f"knee.{s}"), P(f"hock.{s}"), P(f"ball.{s}"), P(f"toe.{s}")], fill=col, width=3)
        dr.line([P("hips"), P("chest"), P("head")], fill=(60, 60, 60), width=4)
        dr.text((i * W + 4, 4), str(i), fill="black")
    img.save(f"{out}/gait-{clip}-frames.png")
    print("wrote", f"{out}/gait-{clip}-frames.png")
