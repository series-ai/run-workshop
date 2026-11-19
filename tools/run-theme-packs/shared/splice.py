"""Replace top-level functions in a module with new versions from a patch file.

    python3 splice.py <target.py> <patch.py>

Every top-level `def name(` in the patch replaces the same-named function in the
target (up to the next top-level statement). Functions not in the target are
inserted before the first top-level def."""
import re
import sys

target, patch = sys.argv[1], sys.argv[2]
src = open(target).read()
new = open(patch).read()


def blocks(text):
    """name -> (start, end) of each top-level def, including leading comments/decorators."""
    out = {}
    lines = text.splitlines(keepends=True)
    starts = [i for i, l in enumerate(lines) if re.match(r"(def |class |[A-Za-z_][A-Za-z_0-9]* *=|#|@|\S)", l) and not l.startswith((" ", "\t", "\n"))]
    offs = [0]
    for l in lines:
        offs.append(offs[-1] + len(l))
    for k, i in enumerate(starts):
        m = re.match(r"(?:def|class) (\w+)", lines[i])
        if not m:
            continue
        j = next((s for s in starts[k + 1:] if not lines[s].startswith(("#",))), len(lines))
        # trim trailing blank lines back into the gap
        out[m.group(1)] = (offs[i], offs[j])
    return out


nb = blocks(new)
for name, (a, b) in nb.items():
    body = new[a:b].rstrip("\n") + "\n\n\n"
    tb = blocks(src)
    if name in tb:
        s, e = tb[name]
        src = src[:s] + body + src[e:]
        print(f"replaced {name}")
    else:
        m = re.search(r"^def ", src, re.M)
        pos = m.start() if m else len(src)
        src = src[:pos] + body + src[pos:]
        print(f"added {name}")
open(target, "w").write(src)
