"""Toy weapons for the right hand (exec'd into rig/beanrig.py, which supplies bpy, Matrix, Vector, finish_mat).

Every weapon is chunky bevelled toy plastic built in the grip's frame: x = side, y = along the barrel
(the arm's direction), z = the top of the gun (up once the arm swings forward to aim). The hand closes on
the handle at the origin. The bazooka's handle is its front grip: the tube runs back over the shoulder.

Materials (recolour by name): weapon (main body), weapon-trim (accent), weapon-dark (grips, barrels),
weapon-metal (chrome bits), weapon-glow (emissive muzzles and cores), weapon-tank (soaker water).
"""
WEAPONS = ["blaster", "raygun", "revolver", "smg", "rifle", "sniper", "shotgun", "launcher", "bazooka",
           "minigun", "soaker", "plasma"]
WEAPON_SCALE = {"blaster": 1.3, "raygun": 1.3, "revolver": 1.3, "smg": 1.45, "rifle": 1.6, "sniper": 1.6, "shotgun": 1.6,
                "launcher": 1.6, "soaker": 1.6, "plasma": 1.6, "bazooka": 1.9, "minigun": 1.9}   # chunky toys: heavies read big
WEAPON_RGB = {"weapon": (0.95, 0.42, 0.15), "weapon-trim": (0.95, 0.93, 0.88), "weapon-dark": (0.12, 0.12, 0.13),
              "weapon-metal": (0.8, 0.8, 0.82), "weapon-glow": (0.35, 1.0, 1.0), "weapon-tank": (0.3, 0.75, 1.0)}


class Gun:
    """Primitive helpers that place bevelled pieces in the grip frame."""

    def __init__(self, J, scale=1.0):
        d = J["_dir.R"]
        up = (Vector((0, -1, 0)) - d * d.dot(Vector((0, -1, 0)))).normalized()  # faces up once the arm swings forward
        self.M = Matrix.Translation(J["grip.R"]) @ Matrix((d.cross(up), d, up)).transposed().to_4x4() @ Matrix.Scale(scale, 4)
        self.s = scale
        self.mats = {}
        self.n = 0

    def mat(self, key):
        if key not in self.mats:
            if key == "weapon-metal":
                m = finish_mat(key, WEAPON_RGB[key], "chrome")
            else:
                m = finish_mat(key, WEAPON_RGB[key], "satin")
            if key == "weapon-glow":
                bsdf = m.node_tree.nodes["Principled BSDF"]
                bsdf.inputs["Emission Color"].default_value = (*[lin(x) for x in WEAPON_RGB[key]], 1)
                bsdf.inputs["Emission Strength"].default_value = 4.0
            self.mats[key] = m
        return self.mats[key]

    def _finish(self, o, key, loc, rot=None, bevel=0.0, smooth=True):
        self.n += 1
        o.name = f"prop-{self.n}"
        if bevel:
            b = o.modifiers.new("b", "BEVEL")
            b.width, b.segments, b.limit_method = bevel, 2, "ANGLE"
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier="b")
        if smooth:
            bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
        R = Matrix.Rotation(math.radians(rot[0]), 4, "X") @ Matrix.Rotation(math.radians(rot[1]), 4, "Y") \
            @ Matrix.Rotation(math.radians(rot[2]), 4, "Z") if rot else Matrix()
        o.matrix_world = self.M @ Matrix.Translation(loc) @ R
        o.data.materials.append(self.mat(key))
        return o

    def box(self, key, loc, size, bevel=0.022, rot=None):
        bpy.ops.mesh.primitive_cube_add(size=1)
        o = bpy.context.object
        o.scale = size
        bpy.ops.object.transform_apply(scale=True)
        return self._finish(o, key, loc, rot, min(bevel, min(size) * 0.45))

    def tube(self, key, loc, r, length, r2=None, axis="y", verts=14, bevel=0.012, rot=None):
        """A cylinder (or a cone, r at the back/-axis end, r2 at the front) along an axis."""
        if r2 is None:
            bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=length)
        else:   # cone: radius1 is at -z; -z ends up at +axis after the rotation below
            bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r2, radius2=r, depth=length)
        o = bpy.context.object
        o.rotation_euler = {"y": (math.pi / 2, 0, 0), "x": (0, -math.pi / 2, 0), "z": (math.pi, 0, 0)}[axis]
        bpy.ops.object.transform_apply(rotation=True)
        return self._finish(o, key, loc, rot, bevel)

    def ring(self, key, loc, R, r, axis="y", verts=16):
        bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=verts, minor_segments=6)
        o = bpy.context.object
        o.rotation_euler = {"y": (math.pi / 2, 0, 0), "x": (0, math.pi / 2, 0), "z": (0, 0, 0)}[axis]
        bpy.ops.object.transform_apply(rotation=True)
        return self._finish(o, key, loc)

    def ball(self, key, loc, r, scale=(1, 1, 1)):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=8, radius=r)
        o = bpy.context.object
        o.scale = scale
        bpy.ops.object.transform_apply(scale=True)
        return self._finish(o, key, loc)

    # shared bits
    def handle(self, y=0.0, tilt=-12, h=0.21):
        """The handle stays fist-sized whatever the gun's scale."""
        k = 1.3 / self.s
        return self.box("weapon-dark", (0, y, -0.005 * k), (0.085 * k, 0.095 * k, h * k), bevel=0.025 * k, rot=(tilt, 0, 0))

    def trigger_guard(self, y=0.07, z=0.035):
        return self.box("weapon-dark", (0, y, z), (0.03, 0.1, 0.03), bevel=0.01)


# --------------------------------------------------------------------------
# the set: sidearms, long guns, heavies. Toy proportions: short and fat, with the one feature that names
# the gun (muzzle, scope, drum, mag, tank) blown up so the silhouette reads at a glance.
# --------------------------------------------------------------------------
def muzzle(g, key, y, z, r, length=0.07, x=0.0, glow=True):
    """A fat muzzle ring with a glowing bore."""
    g.tube(key, (x, y, z), r, length, verts=16, bevel=0.02)
    if glow:
        g.tube("weapon-glow", (x, y + length / 2 + 0.002, z), r * 0.6, 0.01, verts=12, bevel=0)


def _blaster(g):
    g.handle()
    g.box("weapon", (0, 0.11, 0.115), (0.15, 0.3, 0.18), bevel=0.055)
    g.box("weapon-dark", (0, 0.06, 0.225), (0.06, 0.2, 0.06), bevel=0.025)   # top fin
    g.tube("weapon-dark", (0, 0.3, 0.12), 0.055, 0.1)
    muzzle(g, "weapon-trim", 0.36, 0.12, 0.08)


def _raygun(g):
    g.handle(tilt=-18)
    g.ball("weapon", (0, 0.05, 0.14), 0.13, (0.95, 1.1, 0.95))
    g.tube("weapon-trim", (0, 0.24, 0.14), 0.09, 0.2, r2=0.035)
    for i, y in enumerate((0.18, 0.24, 0.3)):
        g.ring("weapon-metal", (0, y, 0.14), 0.1 - 0.02 * i, 0.022)
    g.ball("weapon-glow", (0, 0.36, 0.14), 0.06)
    g.box("weapon-trim", (0, -0.05, 0.28), (0.035, 0.16, 0.13), bevel=0.016, rot=(-25, 0, 0))   # tail fin
    for s in (-1, 1):
        g.box("weapon-trim", (0.13 * s, -0.04, 0.14), (0.1, 0.12, 0.03), bevel=0.012, rot=(0, -25 * s, 0))


def _revolver(g):
    g.handle(tilt=-20, h=0.23)
    g.trigger_guard()
    g.box("weapon", (0, 0.05, 0.135), (0.11, 0.18, 0.12), bevel=0.04)
    g.tube("weapon-trim", (0, 0.07, 0.13), 0.1, 0.12, verts=6, bevel=0.03)   # the hex drum, oversized
    g.tube("weapon-dark", (0, 0.24, 0.16), 0.052, 0.2)
    muzzle(g, "weapon-dark", 0.35, 0.16, 0.065, glow=False)
    g.box("weapon-trim", (0, 0.33, 0.235), (0.03, 0.05, 0.07), bevel=0.012)   # big front sight
    g.box("weapon-dark", (0, -0.07, 0.22), (0.05, 0.06, 0.08), bevel=0.016, rot=(30, 0, 0))   # hammer


def _smg(g):
    g.handle()
    g.trigger_guard()
    g.box("weapon", (0, 0.08, 0.125), (0.14, 0.3, 0.17), bevel=0.05)
    g.box("weapon-dark", (0, 0.17, -0.1), (0.08, 0.1, 0.32), bevel=0.03, rot=(14, 0, 0))   # extra-long mag
    g.box("weapon-trim", (0, 0.08, 0.225), (0.06, 0.22, 0.04), bevel=0.015)   # rail
    g.tube("weapon-dark", (0, 0.27, 0.13), 0.05, 0.1)
    muzzle(g, "weapon-trim", 0.33, 0.13, 0.072)
    g.box("weapon-trim", (0, -0.15, 0.13), (0.06, 0.14, 0.06), bevel=0.02)   # stubby stock
    g.box("weapon-trim", (0, -0.23, 0.09), (0.08, 0.05, 0.15), bevel=0.02)


def _rifle(g):
    g.handle()
    g.trigger_guard()
    g.box("weapon", (0, 0.07, 0.13), (0.13, 0.34, 0.16), bevel=0.05)
    g.box("weapon-trim", (0, 0.32, 0.125), (0.13, 0.2, 0.14), bevel=0.05)   # fat handguard
    g.tube("weapon-dark", (0, 0.46, 0.13), 0.035, 0.1)
    muzzle(g, "weapon-dark", 0.53, 0.13, 0.07, 0.1)
    g.box("weapon-dark", (0, 0.15, -0.05), (0.075, 0.1, 0.17), bevel=0.025, rot=(10, 0, 0))   # banana mag, two bends
    g.box("weapon-dark", (0, 0.2, -0.17), (0.075, 0.1, 0.13), bevel=0.025, rot=(32, 0, 0))
    g.box("weapon", (0, -0.2, 0.12), (0.11, 0.2, 0.15), bevel=0.05)          # chunky stock
    g.box("weapon-dark", (0, -0.31, 0.11), (0.12, 0.05, 0.2), bevel=0.02)
    g.tube("weapon-dark", (0, 0.1, 0.27), 0.05, 0.16)                       # scope with bells
    g.tube("weapon-dark", (0, 0.21, 0.27), 0.05, 0.06, r2=0.07)
    g.tube("weapon-dark", (0, -0.01, 0.27), 0.065, 0.05, r2=0.05)
    g.tube("weapon-glow", (0, 0.245, 0.27), 0.06, 0.01, verts=12, bevel=0)
    g.box("weapon-dark", (0, 0.1, 0.22), (0.05, 0.08, 0.06), bevel=0.012)


def _sniper(g):
    g.handle()
    g.trigger_guard()
    g.box("weapon", (0, 0.07, 0.13), (0.12, 0.32, 0.15), bevel=0.05)
    g.box("weapon-trim", (0, 0.29, 0.12), (0.11, 0.14, 0.12), bevel=0.04)
    g.tube("weapon-dark", (0, 0.58, 0.13), 0.04, 0.46)
    g.box("weapon-dark", (0, 0.84, 0.13), (0.13, 0.11, 0.1), bevel=0.03)     # giant muzzle brake
    g.tube("weapon-glow", (0, 0.896, 0.13), 0.03, 0.01, verts=10, bevel=0)
    g.box("weapon-trim", (0, -0.22, 0.11), (0.1, 0.26, 0.18), bevel=0.05)    # stock
    g.box("weapon-dark", (0, -0.37, 0.11), (0.11, 0.05, 0.21), bevel=0.02)
    g.tube("weapon-dark", (0, 0.1, 0.31), 0.065, 0.3)                       # the huge scope
    g.tube("weapon-dark", (0, 0.3, 0.31), 0.065, 0.1, r2=0.1)
    g.tube("weapon-dark", (0, -0.1, 0.31), 0.09, 0.08, r2=0.065)
    g.tube("weapon-glow", (0, 0.352, 0.31), 0.088, 0.01, verts=14, bevel=0)
    for y in (0.0, 0.2):
        g.box("weapon-dark", (0, y, 0.23), (0.06, 0.05, 0.08), bevel=0.015)
    for s in (-1, 1):                                                         # folded bipod
        g.tube("weapon-metal", (0.035 * s, 0.5, 0.075), 0.016, 0.26, verts=8, bevel=0)


def _shotgun(g):
    g.handle()
    g.trigger_guard()
    g.box("weapon", (0, 0.05, 0.13), (0.15, 0.22, 0.16), bevel=0.05)
    for s in (-1, 1):                                                         # fat side-by-side barrels
        g.tube("weapon-dark", (0.04 * s, 0.33, 0.17), 0.045, 0.42)
        muzzle(g, "weapon-dark", 0.55, 0.17, 0.052, 0.05, x=0.04 * s)
    g.box("weapon-trim", (0, 0.32, 0.075), (0.15, 0.18, 0.11), bevel=0.045)   # big pump
    for y in (0.27, 0.32, 0.37):
        g.box("weapon-dark", (0, y, 0.075), (0.155, 0.015, 0.115), bevel=0.005)
    g.box("weapon", (0, -0.18, 0.11), (0.12, 0.26, 0.17), bevel=0.05, rot=(-6, 0, 0))   # stock
    g.box("weapon-dark", (0, -0.32, 0.095), (0.13, 0.05, 0.2), bevel=0.02, rot=(-6, 0, 0))


def _launcher(g):
    g.handle()
    g.trigger_guard()
    g.box("weapon", (0, -0.04, 0.13), (0.12, 0.18, 0.14), bevel=0.045)
    g.tube("weapon-trim", (0, 0.12, 0.17), 0.17, 0.17, verts=14, bevel=0.035)   # the huge drum
    for k in range(6):
        a = math.radians(60 * k + 30)
        g.tube("weapon-dark", (0.11 * math.cos(a), 0.21, 0.17 + 0.11 * math.sin(a)), 0.035, 0.012, verts=10, bevel=0)
    g.tube("weapon", (0, 0.32, 0.17), 0.1, 0.22)
    muzzle(g, "weapon-dark", 0.45, 0.17, 0.125, 0.07)
    g.box("weapon-dark", (0, 0.31, 0.02), (0.08, 0.08, 0.17), bevel=0.025, rot=(-10, 0, 0))   # fore grip
    g.box("weapon-dark", (0, -0.2, 0.13), (0.06, 0.18, 0.06), bevel=0.02)   # folding stock
    g.box("weapon-dark", (0, -0.29, 0.1), (0.09, 0.045, 0.17), bevel=0.016)


def _bazooka(g):
    """Shoulder-fired, held by the FRONT grip: the tube runs back over the shoulder and well behind the figure,
    outside the shoulder so it clears the head. The trigger handle further back hangs free."""
    x, z, front, back = 0.09, 0.18, 0.3, -0.66
    y0, L = (front + back) / 2, front - back
    g.handle(tilt=-8)                                                        # the hand: front grip
    g.box("weapon-dark", (0.045, 0.0, 0.08), (0.1, 0.1, 0.08), bevel=0.025)    # bracket to the tube
    g.tube("weapon", (x, y0, z), 0.13, L, verts=18)
    g.tube("weapon-dark", (x, front + 0.06, z), 0.13, 0.14, r2=0.19, verts=18)    # big front flare
    g.tube("weapon-trim", (x, front + 0.15, z), 0.11, 0.16, r2=0.0, verts=16)     # fat warhead poking out
    g.tube("weapon-dark", (x, back - 0.05, z), 0.19, 0.12, r2=0.13, verts=18)     # back blast flare
    for y in (back + 0.12, -0.12, 0.16):
        g.ring("weapon-trim", (x, y, z), 0.135, 0.03)
    g.box("weapon-dark", (x, -0.36, z - 0.16), (0.07, 0.08, 0.16), bevel=0.025, rot=(-10, 0, 0))   # rear trigger grip
    g.box("weapon-dark", (x + 0.16, 0.0, z + 0.06), (0.07, 0.18, 0.11), bevel=0.025)   # sight box
    g.tube("weapon-glow", (x + 0.16, 0.093, z + 0.06), 0.032, 0.01, verts=10, bevel=0)


def _minigun(g):
    """Hip-heavy: a fat round motor drum over the fist, six chunky barrels, the ammo box hanging off the outside."""
    x, z = 0.05, 0.12
    g.handle()
    g.tube("weapon", (x, 0.04, z), 0.15, 0.28, verts=18, bevel=0.05)         # motor drum
    g.box("weapon-trim", (x + 0.18, 0.02, -0.02), (0.13, 0.2, 0.18), bevel=0.04)   # ammo box
    g.box("weapon-dark", (x + 0.12, 0.1, 0.04), (0.08, 0.07, 0.04), bevel=0.012, rot=(0, 0, 20))   # feed chute
    for k in range(6):
        a = math.radians(60 * k)
        g.tube("weapon-dark", (x + 0.065 * math.cos(a), 0.38, z + 0.065 * math.sin(a)), 0.032, 0.42, verts=8, bevel=0)
    for y in (0.3, 0.56):
        g.tube("weapon-metal", (x, y, z), 0.115, 0.05, verts=16)
    g.tube("weapon-glow", (x, 0.59, z), 0.04, 0.01, verts=10, bevel=0)
    g.box("weapon-dark", (x, 0.04, z + 0.21), (0.05, 0.22, 0.04), bevel=0.015)   # carry handle
    for y in (-0.04, 0.12):
        g.box("weapon-dark", (x, y, z + 0.17), (0.05, 0.04, 0.08), bevel=0.012)


def _soaker(g):
    g.handle()
    g.trigger_guard()
    g.box("weapon", (0, 0.1, 0.12), (0.13, 0.34, 0.14), bevel=0.05)
    g.tube("weapon-tank", (0, -0.02, 0.31), 0.14, 0.28, verts=16, bevel=0.05)   # the big water tank
    g.tube("weapon-trim", (0, 0.15, 0.31), 0.05, 0.05)                       # cap
    g.box("weapon-trim", (0, 0.07, 0.21), (0.06, 0.12, 0.07), bevel=0.02)
    g.tube("weapon-trim", (0, 0.32, 0.12), 0.055, 0.14, r2=0.03)             # nozzle
    g.tube("weapon-trim", (0, 0.25, 0.03), 0.06, 0.16)                       # pump handle
    g.box("weapon-dark", (0, 0.14, 0.03), (0.04, 0.08, 0.04), bevel=0.012)


def _plasma(g):
    z = 0.16
    g.handle()
    g.trigger_guard()
    g.tube("weapon", (0, 0.07, z), 0.13, 0.3, verts=16, bevel=0.04)
    for y in (0.0, 0.08, 0.16):
        g.ring("weapon-glow", (0, y, z), 0.132, 0.024)
    g.tube("weapon-dark", (0, -0.13, z), 0.08, 0.07, r2=0.13)
    for s in (-1, 1):                                                       # forked emitter, chunky prongs
        g.box("weapon-trim", (0.075 * s, 0.31, z), (0.05, 0.22, 0.1), bevel=0.022, rot=(0, 0, -8 * s))
    g.ball("weapon-glow", (0, 0.36, z), 0.065)
    g.box("weapon-trim", (0, 0.07, z + 0.16), (0.06, 0.24, 0.06), bevel=0.02)   # top fin


WEAPON_BUILD = {k: globals()["_" + k] for k in WEAPONS}


def weapon(kind, J):
    WEAPON_BUILD[kind](Gun(J, WEAPON_SCALE[kind]))
