import sys
CH = sys.argv[sys.argv.index("--") + 1:]
sys.argv = [sys.argv[0], "--", "/tmp/rck-j", "x"]
P = __import__("os").path.dirname(__import__("os").path.abspath(__file__)) + "/"
__file__ = P + "toyanim.py"
exec(compile(open(P + "toyanim.py").read().split("\nfor slug in SLUGS:")[0], P + "toyanim.py", "exec"))
FPS = 30  # as the exporter
_e = open(P + "export_glb.py").read()
exec(compile(_e[_e.index("def pose_loop"):_e.index("\ndef export(")], "x", "exec"))
for slug in CH:
    parts, rest = build_rig(slug)
    for label, clip, period, _ in CLIPS:
        n = round(period * 30)
        plan = guard_plan(parts, rest, clip, period, n)
        for guard in (False, True):
            fr = []
            for k in range(n):
                if guard:
                    pose_guarded(parts, rest, clip, period, k, n, plan)
                else:
                    pose_loop(parts, rest, clip, period * k / n, period)
                bpy.context.view_layer.update()
                fr.append({nm: (tuple(e.location), tuple(e.rotation_euler)) for nm, e in parts.items()})
            worst = (0, None, None)
            for k in range(n):
                a, b, c = fr[k - 1], fr[k], fr[(k + 1) % n]
                for nm in b:
                    for i in range(2):
                        for j in range(3):
                            acc = abs(a[nm][i][j] - 2 * b[nm][i][j] + c[nm][i][j]) * (57.3 if i else 10)
                            if acc > worst[0]:
                                worst = (acc, nm, k)
            print("JIT", slug, label, "guard" if guard else "raw", f"{worst[0]:.1f}", worst[1], worst[2], flush=True)
