"""Faceted bodies for the quadruped, kaiju, and serpent rigs."""

import polykit as pk
from polykit import V, X, Y, Z


def spike(part, base, tip, radius, region, *, n=3, flat=1.0, up=Y, cap=False, **options):
    axis = (tip - base).normalized()
    if axis.cross(up.normalized()).length < 0.25:
        up = X if abs(axis.x) < 0.8 else Z
    right, upward, _ = pk.frame_from(axis, up)
    rim = pk.ring(base, right, upward, radius, radius * flat, n)
    return part.loft([rim], region, tip_end=tip, cap_start=cap, **options)


def bone(spec):
    if isinstance(spec, dict):
        return pk.rigid(**spec)
    return pk.rigid(**{spec: 1.0})


def panel_hull(part, rings, skins, region, panels=None, **options):
    """Fit a second palette region to selected columns of a closed loft."""
    columns, panel_region = panels or ((), region)
    cells = [(row, col) for row in range(len(rings) - 1) for col in columns]
    ids = part.loft(rings, region, omitted_cells=set(cells), ring_skins=skins,
                    cap_start=True, cap_end=True, **options)
    group = part.group()
    for row, col in cells:
        following = (col + 1) % len(rings[row])
        quad = (ids[row][col], ids[row][following], ids[row + 1][following], ids[row + 1][col])
        center = (pk.centroid(rings[row]) + pk.centroid(rings[row + 1])) / 2
        shade = options['band_ao'][row] if 'band_ao' in options else 0
        part.face(quad, panel_region, group=group, away_from=center, ao=shade)


def hull(part, stations, region='primary', n=8, **options):
    """Join cross sections in the XY plane. Each station names a joint or weight dict."""
    rings = [pk.ring(V(0, y, z), X, Y, width, top, n, rv_neg=bottom, squareness=0.82)
             for joint, z, y, width, top, bottom in stations]
    panel_hull(part, rings, [bone(row[0]) for row in stations], region, **options)


def build_warhorse_mesh(solver):
    part = pk.Part('body_warhorse')
    joints = solver.rig.position
    hull(part, [
        ('pelvis', -.47, .65, .090, .110, .110),
        ('pelvis', -.32, .67, .172, .171, .187),
        ({'pelvis': .5, 'spine_01': .5}, -.21, .665, .162, .155, .175),
        ('spine_01', -.10, .66, .155, .142, .166),
        ({'spine_01': .5, 'spine_02': .5}, .01, .665, .163, .150, .175),
        ('spine_02', .12, .67, .171, .159, .185),
        ({'spine_02': .5, 'chest': .5}, .23, .68, .178, .168, .198),
        ('chest', .34, .69, .185, .177, .211),
        ('chest', .43, .735, .142, .175, .182),
        ({'chest': .5, 'neck': .5}, .47, .78, .122, .172, .142),
        ('neck', .51, .83, .103, .162, .106),
        ('neck', .55, .90, .084, .126, .092),
        ({'neck': .5, 'head': .5}, .595, .938, .076, .096, .082),
    ])
    hull(part, [
        ({'neck': .45, 'head': .55}, .57, .958, .072, .082, .068),
        ('head', .645, .957, .102, .098, .097),
        ('head', .728, .928, .079, .075, .068),
        ('head', .826, .880, .052, .049, .038),
        ('head', .907, .852, .063, .044, .037),
    ], band_regions=['primary', 'primary', 'primary', 'skin'])
    hull(part, [
        ({'head': .42, 'jaw': .58}, .68, .86, .068, .044, .041),
        ('jaw', .792, .832, .047, .031, .022),
        ('jaw', .898, .819, .051, .024, .020),
    ], 'skin', 6)
    with part.skinned(bone('head')):
        part.slab([V(-.065, 1.027, .685), V(.065, 1.027, .685), V(.047, 1.008, .728),
                   V(0, .912, .855), V(-.047, 1.008, .728)], .014, 'metal', normal=Y)
        with part.mirrored():
            spike(part, V(.054, 1.015, .618), V(.081, 1.159, .60), .041, 'primary', n=4, flat=.54, up=Z)
            spike(part, V(.056, 1.027, .633), V(.079, 1.133, .612), .025, 'skin', flat=.4, up=Z)
            part.plate(V(.086, .971, .697), V(.91, .16, .38), Y, .043, .023, .006, 'eye')
            part.plate(V(.055, .863, .901), V(.81, .28, .50), Y, .026, .018, .003, 'accent')
    for z, y, length, joint in ((.61, 1.03, .10, 'head'), (.55, 1.023, .14, 'neck'),
                                 (.49, .981, .15, 'neck'), (.42, .91, .13, 'chest')):
        with part.skinned(bone(joint)):
            spike(part, V(0, y, z), V(.016, y - .032, z - length), .067, 'hair', n=5, flat=.67)
    with part.skinned(bone('spine_01')):
        part.box(V(0, .816, -.078), (.235, .065, .287), 'secondary', bevel=.015)
        with part.mirrored():
            part.slab([V(.115, .831, -.25), V(.12, .83, .093), V(.177, .625, .085),
                       V(.164, .568, -.125), V(.169, .63, -.255)], .014, 'secondary', normal=X)
            part.plate(V(.184, .664, -.094), X, Y, .105, .044, .007, 'metal')
    with part.skinned(bone('chest')):
        with part.mirrored():
            part.slab([V(.037, .81, .505), V(.135, .8, .443), V(.181, .718, .354),
                       V(.131, .555, .392), V(.042, .601, .477)], .02, 'metal', normal=V(.7, 0, .7))
    t1, t2, t3 = joints['tail_01'], joints['tail_02'], joints['tail_03']
    part.tube(
        [t1 + Z * .04, t1, t1.lerp(t2, .5), t2, t2.lerp(t3, .5), t3, V(.018, .466, -.86)],
        [.042, .052, .066, .081, .074, .067, .034],
        7,
        'hair',
        tip_end=V(.034, .455, -.905),
        ring_skins=[
            bone({'pelvis': .5, 'tail_01': .5}),
            bone('tail_01'),
            bone({'tail_01': .5, 'tail_02': .5}),
            bone('tail_02'),
            bone({'tail_02': .5, 'tail_03': .5}),
            bone('tail_03'),
            bone('tail_03'),
        ],
    )
    for side, tag in ((1, 'l'), (-1, 'r')):
        for end in ('f', 'b'):
            trunk = 'chest' if end == 'f' else 'pelvis'
            upper, lower, paw = [f'leg_{end}{tag}_{segment}' for segment in ('upper', 'lower', 'paw')]
            hip, knee, ankle = (joints[n] for n in (upper, lower, paw))
            thigh = hip.lerp(knee, .54) + Z * (.054 if end == 'b' else .012)
            part.tube(
                [hip + Y * .10, hip, thigh, hip.lerp(knee, .86), knee, knee.lerp(ankle, .16),
                 knee.lerp(ankle, .62), ankle],
                [(.062, .079), (.075, .10), (.059, .077), (.044, .057), (.039, .051), (.035, .045),
                 (.029, .031), (.035, .039)],
                6,
                'primary',
                up=Z,
                ring_skins=[
                    bone({trunk: .55, upper: .45}),
                    bone({trunk: .20, upper: .80}),
                    bone(upper),
                    bone({upper: .78, lower: .22}),
                    bone({upper: .50, lower: .50}),
                    bone({upper: .20, lower: .80}),
                    bone(lower),
                    bone({lower: .50, paw: .50}),
                ],
                band_regions=['primary', 'primary', 'primary', 'primary', 'primary', 'primary', 'hair'],
            )
            with part.skinned(bone(paw)):
                rings = [pk.ring(V(side * abs(ankle.x), y, ankle.z + dz), X, Z, w, d, 8)
                         for y, dz, w, d in ((ankle.y, 0, .035, .039), (.014, .002, .047, .047),
                                             (0, .002, .046, .045))]
                part.loft(rings, 'accent', cap_end=True,
                          ring_skins=[bone({lower: .45, paw: .55}), bone(paw), bone(paw)],
                          band_regions=['accent', 'metal'])
    return part.to_mesh(solver)


def build_kaiju_rex_mesh(solver):
    part = pk.Part('body_tyrant_rex')
    joints = solver.rig.position
    stations = [
        ('tail_03', -1.48, .405, .015, .022, .017),
        ('tail_03', -1.28, .41, .055, .072, .057),
        ({'tail_02': .5, 'tail_03': .5}, -1.06, .46, .072, .088, .072),
        ('tail_02', -.84, .515, .09, .105, .088),
        ({'tail_01': .5, 'tail_02': .5}, -.64, .57, .110, .124, .102),
        ('tail_01', -.44, .625, .131, .143, .116),
        ({'pelvis': .5, 'tail_01': .5}, -.34, .685, .162, .178, .162),
        ('pelvis', -.22, .75, .191, .214, .208),
        ({'pelvis': .5, 'spine_01': .5}, -.10, .825, .205, .225, .222),
        ('spine_01', .02, .91, .216, .233, .232),
        ({'spine_01': .5, 'chest': .5}, .12, 1.01, .210, .228, .220),
        ('chest', .21, 1.13, .204, .223, .209),
        ({'chest': .5, 'neck': .5}, .27, 1.255, .162, .188, .188),
        ('neck', .32, 1.38, .126, .155, .168),
        ({'neck': .45, 'head': .55}, .38, 1.49, .115, .122, .113),
    ]
    hull(part, stations, panels=((5, 6), 'skin'))
    spine_spikes = [
        ('tail_03', -1.28, .41, .055, .072),
        ('tail_02', -.84, .515, .09, .105),
        ('tail_01', -.44, .625, .131, .143),
        ('pelvis', -.22, .75, .191, .214),
        ('spine_01', .02, .91, .216, .233),
        ('chest', .21, 1.13, .204, .223),
        ('neck', .32, 1.38, .126, .155),
    ]
    for joint, z, y, width, top in spine_spikes:
        with part.skinned(bone(joint)):
            spike(part, V(0, y + top * .83, z), V(0, y + top * 1.50, z - width * .62),
                  width * .55, 'secondary', n=4, flat=.54, up=X)
    hull(part, [
        ({'neck': .40, 'head': .60}, .297, 1.56, .098, .105, .118),
        ('head', .409, 1.575, .158, .133, .122),
        ('head', .565, 1.57, .141, .113, .086),
        ('head', .727, 1.548, .106, .073, .058),
        ('head', .775, 1.547, .088, .059, .049),
    ])
    hull(part, [
        ({'head': .40, 'jaw': .60}, .385, 1.465, .106, .049, .065),
        ('jaw', .527, 1.445, .131, .032, .063),
        ('jaw', .742, 1.456, .085, .022, .035),
    ], 'skin', panels=(range(4), 'hair'))
    with part.mirrored():
        with part.skinned(bone('head')):
            spike(part, V(.112, 1.657, .467), V(.178, 1.755, .378), .058, 'metal', n=5, up=Z)
            part.plate(V(.147, 1.611, .501), V(.98, .15, .09), Y, .079, .043, .013, 'hair')
            part.plate(V(.16, 1.612, .503), X, Y, .049, .014, .005, 'eye')
            for z, x in ((.56, .112), (.616, .096), (.67, .085), (.724, .076)):
                spike(part, V(x, 1.508, z), V(x * .96, 1.452, z - .007), .018, 'accent', up=Z)
        with part.skinned(bone('jaw')):
            for z, x in ((.575, .114), (.639, .10), (.697, .083)):
                spike(part, V(x, 1.456, z), V(x, 1.498, z + .006), .014, 'accent', up=Z)
        shoulder, elbow, hand = [joints[n] for n in ('arm_upper_l', 'arm_lower_l', 'hand_l')]
        part.tube(
            [shoulder - X * .05, shoulder, shoulder.lerp(elbow, .5), elbow, elbow.lerp(hand, .55), hand],
            [.072, .076, .058, .042, .034, .028],
            6,
            'primary',
            ring_skins=[
                bone({'chest': .55, 'arm_upper_l': .45}),
                bone({'chest': .20, 'arm_upper_l': .80}),
                bone('arm_upper_l'),
                bone({'arm_upper_l': .50, 'arm_lower_l': .50}),
                bone('arm_lower_l'),
                bone({'arm_lower_l': .45, 'hand_l': .55}),
            ],
        )
        with part.skinned(bone('hand_l')):
            part.box(hand + V(.018, -.004, .004), (.068, .058, .072), 'secondary', taper=.73)
            for dz in (-.018, .018):
                spike(part, hand + V(.038, -.010, dz), hand + V(.078, -.042, dz * 1.4), .018, 'accent')
        hip, knee, ankle = [joints[n] for n in ('leg_upper_l', 'leg_lower_l', 'foot_l')]
        part.tube(
            [hip + Y * .092, hip, hip.lerp(knee, .57) + Z * .038, hip.lerp(knee, .85), knee,
             knee.lerp(ankle, .16), knee.lerp(ankle, .52) - Z * .048, ankle],
            [(.111, .145), (.152, .188), (.122, .148), (.098, .108), (.085, .090), (.072, .084),
             (.057, .076), (.057, .064)],
            8,
            'primary',
            up=Z,
            cap_start=True,
            ring_skins=[
                bone({'pelvis': .55, 'leg_upper_l': .45}),
                bone({'pelvis': .20, 'leg_upper_l': .80}),
                bone('leg_upper_l'),
                bone({'leg_upper_l': .78, 'leg_lower_l': .22}),
                bone({'leg_upper_l': .50, 'leg_lower_l': .50}),
                bone({'leg_upper_l': .20, 'leg_lower_l': .80}),
                bone('leg_lower_l'),
                bone({'leg_lower_l': .50, 'foot_l': .50}),
            ],
        )
        with part.skinned(bone('foot_l')):
            foot_rings = [
                pk.ring(V(ankle.x, ankle.y, ankle.z - .010), X, Z, .058, .068, 6),
                pk.ring(V(ankle.x, .032, ankle.z - .012), X, Z, .068, .072, 6),
                pk.ring(V(ankle.x, .0, ankle.z - .010), X, Z, .062, .066, 6),
            ]
            part.loft(foot_rings, 'secondary', cap_end=True,
                      ring_skins=[bone({'leg_lower_l': .45, 'foot_l': .55}), bone('foot_l'), bone('foot_l')])
            for dx in (-.044, 0, .044):
                toe = ankle + V(dx, -.024, .018)
                part.tube([toe, toe + V(dx * .38, -.002, .033)], [.028, .021], 5, 'primary',
                          tip_end=toe + V(dx * .50, -.008, .059))
                spike(part, toe + V(dx * .4, -.005, .039), toe + V(dx * .58, -.008, .073),
                      .017, 'accent', n=4)
    return part.to_mesh(solver)


def build_serpent_basilisk_mesh(solver):
    part = pk.Part('body_basilisk')
    joints = solver.rig.position
    # Each pair of rings forms one row of ventral scutes.
    chain = [('tail_tip', .0, .019), ('tail_04', -.024, .031), ('tail_03', -.032, .041),
             ('tail_02', -.026, .05), ('tail_01', .037, .062), ('spine_02', .064, .078),
             ('spine_01', .026, .09), ('pelvis', 0, .097), ('neck', 0, .074)]
    rings, skins = [], []
    for i, (joint, x, radius) in enumerate(chain):
        center = joints[joint] + X * x
        if i:
            last_joint, last_x, last_radius = chain[i - 1]
            middle = (center + joints[last_joint] + X * last_x) / 2
            width = (last_radius + radius) * .5
            if joint == 'neck':
                rings.append(pk.ring(middle, X, Y, width, width, 12, rv_neg=.075))
                skins.append(pk.rigid(pelvis=.75, neck=.25))
                rings.append(pk.ring(V(0, .103, .110), X, Y, .078, .078, 12, rv_neg=.064))
                skins.append(pk.rigid(pelvis=.45, neck=.55))
            else:
                rings.append(pk.ring(middle, X, Y, width, width, 12, rv_neg=middle.y - .003))
                skins.append(pk.rigid(**{joint: .78, last_joint: .22}))
        ring_rv_neg = .056 if joint == 'neck' else center.y
        ring_skin = pk.rigid(pelvis=.15, neck=.70, head=.15) if joint == 'neck' else bone(joint)
        rings.append(pk.ring(center, X, Y, radius, radius, 12, rv_neg=ring_rv_neg))
        skins.append(ring_skin)
        with part.skinned(bone(joint)):
            scale = [center + V(dx * radius, dy * radius, dz * radius) for dx, dy, dz in
                     ((0, .88, .9), (.53, .83, 0), (0, .93, -1.22), (-.53, .83, 0))]
            part.slab(scale, radius * .19, 'secondary', normal=Y, shrink=.32)
    # Bridge the throat smoothly from the neck into the head and back of the lower jaw.
    rings.append(pk.ring(V(0, .118, .190), X, Y, .070, .064, 12, rv_neg=.052))
    skins.append(pk.rigid(neck=.45, head=.55))
    rings.append(pk.ring(V(0, .120, .240), X, Y, .072, .054, 12, rv_neg=.052))
    skins.append(pk.rigid(neck=.10, head=.90))
    panel_hull(part, rings, skins, 'primary', panels=(range(7, 11), 'skin'),
               band_ao=[-.066 if i % 2 else .025 for i in range(len(rings) - 1)])
    with part.skinned(bone('tail_tip')):
        part.tube([joints['tail_tip'], V(0, .049, -1.936), V(0, .058, -1.972)],
                  [.019, .03, .017], 6, 'metal', tip_end=V(0, .072, -2.023))
    # Wide ribs support both sides of the hood.
    with part.mirrored():
        hood = [V(.047, .093, -.06), V(.116, .133, -.008), V(.141, .208, .075),
                V(.139, .241, .132), V(.073, .214, .186), V(.048, .115, .155)]
        with part.skinned(pk.rigid(neck=.50, pelvis=.50)):
            part.slab(hood, .014, 'secondary', normal=V(.45, .85, -.30), shrink=.82, back=True)
            for edge in hood[1:4]:
                part.tube([V(.058, .163, .130), edge + Y * .013], [.017, .006], 5, 'primary',
                          up=Z, cap_end=True)
    hull(part, [
        ('neck', .11, .142, .062, .056, .053),
        ({'neck': .45, 'head': .55}, .16, .151, .090, .060, .054),
        ('head', .204, .158, .116, .066, .054),
        ('head', .256, .154, .129, .078, .056),
        ('head', .318, .144, .093, .056, .042),
        ('head', .395, .131, .042, .032, .027),
    ])
    hull(part, [
        ({'head': .90, 'jaw': .10}, .215, .102, .076, .026, .034),
        ({'head': .45, 'jaw': .55}, .275, .094, .098, .020, .030),
        ('jaw', .315, .091, .094, .016, .028),
        ('jaw', .379, .092, .043, .013, .019),
    ], 'skin', panels=(range(4), 'hair'))
    with part.mirrored():
        with part.skinned(bone('head')):
            spike(part, V(.083, .201, .248), V(.134, .287, .197), .037, 'accent', n=5, up=Z)
            part.plate(V(.111, .175, .276), V(.85, .24, .45), Y, .045, .027, .005, 'hair')
            part.plate(V(.116, .177, .278), V(.85, .24, .45), Y, .011, .023, .004, 'eye')
            spike(part, V(.068, .119, .338), V(.061, .068, .332), .014, 'accent', n=4, up=Z)
        with part.skinned(bone('jaw')):
            spike(part, V(.063, .098, .344), V(.062, .124, .353), .01, 'accent', up=Z)
    return part.to_mesh(solver)

