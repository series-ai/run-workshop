"""Basalt quarry, mine railway, and fossil shrine."""

import math
import random
from polykit import V, Z, Y


def block(p, x, y, z, w, h, d, region, **options):
    p.box(V(x,y,z),(w,h,d),region,**options)


def strut(p,a,b,r,region='primary'):
    axis=(V(*b)-V(*a)).normalized()
    p.prism(a,b,r,r,4,region,up=Z if abs(axis.z)<.9 else Y,phase=math.pi/4)


def rock(p,x,y,z,w,h,d,seed,region='skin',sides=7):
    rng=random.Random(seed)
    outline=[(i*math.tau/sides+rng.uniform(-.13,.13),rng.uniform(.86,1.0),
              rng.uniform(.88,1.0)) for i in range(sides)]
    rings=[]
    for level,radius,dx,dz in ((0,.84,0,0),(.39,1,0,.035),(.81,.90,.07,0),(1,.59,.12,-.06)):
        rings.append([V(x+w*(dx+radius*r*math.cos(a)), y+h*level*t,
                        z+d*(dz+radius*r*math.sin(a))) for a,r,t in outline])
    p.loft(rings,region,cap_start=True,cap_end=True)


def spike(p,x,y,z,r,h,dx,dz,region):
    p.tube([V(x,y,z),V(x+dx*.26,y+h*.45,z+dz*.23),V(x+dx*.65,y+h*.78,z+dz*.63)],
           [r,r*.74,r*.4],6,region,up=Z,cap_start=True,tip_end=V(x+dx,y+h,z+dz))


def rail(p,z0,z1):
    for x in (-.38,.38):
        block(p,x,.14,(z0+z1)/2,.066,.105,z1-z0,'metal')
    count=max(2,round((z1-z0)/.36))
    for i in range(count):
        z=z0+(i+.5)*(z1-z0)/count
        block(p,0,.055,z,1.05,.11,.14,'primary',ao=(i%3)*.025)


def portal(p,z,w,h):
    for s in (-1,1):
        x=s*w/2
        strut(p,(x+s*.09,.01,z),(x,h,z),.14)
        block(p,x+s*.07,.33,z,.24,.08,.24,'metal')
        strut(p,(x,h-.50,z),(x-s*.43,h-.04,z),.10)
    block(p,0,h,z,w+.42,.23,.27,'primary',corner=.04)


def lamp(p,x,y,z):
    p.lathe([(.09,0),(.14,.055),(.12,.09)],6,'metal',center=(x,y,z),cap_start=True)
    p.lathe([(.10,.08),(.12,.21),(.078,.33)],6,'eye',center=(x,y,z),cap_end=True)
    p.lathe([(.14,.32),(.065,.41)],6,'metal',center=(x,y,z),cap_end=True)


def quarry_bed(p, profile, back, front, region, shade):
    # A chipped front edge exposes a fresh break in each bed.
    cx = sum(x for x, y in profile) / len(profile)
    cy = sum(y for x, y in profile) / len(profile)
    rings = [[V(cx + (x-cx)*scale, cy + (y-cy)*scale, z + slope*(x-cx))
              for x, y in profile]
             for scale, z, slope in ((.88, back, .08), (1, front-.14, -.08),
                                     (.88, front, -.11))]
    p.loft(rings, region, band_ao=[-.16, .06], ao=shade, cap_start=True, cap_end=True)


def prop_mine_tunnel_mouth(p):
    for side in (-1, 1):
        def bed(points, back, front, region, shade):
            quarry_bed(p, [(side*x, y) for x, y in points], back, front, region, shade)

        offset = .24 if side == 1 else 0
        bed([(.88, 0), (1.98, 0), (2.01, .55), (1.79, .92+offset),
             (1.05, .69+offset), (.85, .39)], -1.18, .89, 'skin', -.10)
        bed([(.87, .57+offset), (1.83, .83+offset), (1.73-offset, 1.52+offset),
             (1.38, 2.05+offset), (.92, 1.94)], -1.18, .47, 'secondary', .08)
    # The rear timber set marks the low ore haulage passage.
    # A continuous cap spans the cut. Its top rises at the left shoulder.
    quarry_bed(p, [(-1.63, 2.12), (-.39, 2.16), (1.51, 2.18),
                   (1.41, 2.35), (.53, 2.45), (-.34, 2.40), (-1.49, 2.28)],
               -1.12, .41, 'skin', -.05)
    quarry_bed(p, [(-1.51, 2.23), (-.32, 2.35), (.76, 2.40), (.62, 2.61),
                   (-.49, 2.72), (-1.23, 2.64)], -1.12, .20, 'skin', .04)

    roof = [[V(x, y, z) for x, y in ((-1.12, low), (1.12, low),
                                       (1.12, low+.41), (-1.12, low+.41))]
            for z, low in ((-1.11, 1.48), (-.19, 1.63), (.37, 2.18))]
    p.loft(roof, 'skin', cap_start=True, cap_end=True, ao=-.22)
    # The recessed end face keeps the sky out of the tunnel.
    block(p, 0, .85, -1.08, 1.93, 1.70, .15, 'secondary', ao=-.42)

    # Timber sets support the roof runners. Iron dogs hold the front joints.
    block(p, 0, 1.50, -.19, 1.45, .26, .25, 'accent', ao=.04)
    for side in (-1, 1):
        x = side*.81
        block(p, side*.55, .73, -.19, .22, 1.46, .25, 'accent', ao=.02)
        p.prism((side*.55, 1.09, -.19), (side*.29, 1.44, -.19),
                .095, .095, 4, 'accent', up=Z, phase=math.pi/4,
                cap_start=False, cap_end=False)
        wall = [[V(side*x, y, z) for x, y in
                 ((inset, 0), (1.16, 0), (1.16, top), (inset+.035, top))]
                for z, inset, top in ((-1.12, .71, 1.57), (-.36, .76, 1.72),
                                      (.38, .92, 2.05))]
        p.loft(wall, 'skin', cap_start=True, cap_end=True, ao=-.20)
        block(p, x, 1.075, .52, .245, 2.15, .30, 'primary', ao=-.07)
        block(p, x, .17, .52, .27, .23, .33, 'metal', ao=-.23)
        block(p, x, 2.09, -.085, .21, .16, 1.57, 'primary', ao=-.18)
        strut(p, (x, 1.64, .50), (side*.42, 2.11, .50), .105)
        plate = [(x+side*dx, y+.25) for dx, y in
                 ((-.21, 1.97), (.16, 1.97), (.16, 1.82), (.085, 1.78),
                  (.085, 1.61), (-.064, 1.65), (-.064, 1.82), (-.21, 1.85))]
        p.slab([V(px, y, .672) for px, y in plate], .032, 'metal',
               normal=Z, shrink=.98, ao=-.16)
    block(p, 0, 2.18, .52, 2.13, .24, .30, 'primary', ao=.035)
    rail(p, -1.11, 1.11)
    block(p, -.81, 1.38, .70, .13, .07, .33, 'metal')
    lamp(p, -.81, 1.415, .80)


def basalt_beds(p, outline, sections):
    # The beds share a dip. Broken edges expose the darker lower bed.
    rings = []
    for width, depth, x_offset, z_offset, height, dip in sections:
        rings.append([V(x_offset + width*x, height + dip*x, z_offset + depth*z)
                      for x, z in outline])
    p.loft(rings, 'skin', band_regions=['secondary', 'skin', 'secondary', 'skin'],
           cap_start=True, cap_end=True)


def layered_outcrop(p, outline, beds):
    # Each point carries a local rise. The same fracture crosses successive beds.
    rings = [[V(x*width + shift, height + dip*x + rise*relief, z*depth + setback)
              for x, z, relief in outline]
             for width, depth, shift, setback, height, dip, rise, _ in beds]
    p.loft(rings, 'skin', band_regions=[bed[-1] for bed in beds[1:]],
           cap_start=True, cap_end=True)


def prop_basalt_cliff_block(p):
    outline = [(-1, -.67, -.05), (-.78, -1, .01), (.53, -.97, .12),
               (.99, -.72, .04), (1, .42, -.03), (.74, .83, -.07),
               (.19, .89, .01), (-.21, 1, .10), (-.86, .78, .07), (-.98, .58, 0)]
    layered_outcrop(p, outline, [
        (1.05, 1.035, 0, 0, 0, 0, 0, 'skin'),
        (1.04, 1.00, 0, 0, .46, -.13, .8, 'primary'),
        (.96, .92, -.06, -.03, .54, -.08, .8, 'skin'),
        (.99, .95, -.05, -.03, .62, -.02, .8, 'primary'),
        (.97, .88, -.07, -.06, 1.05, -.22, 1.5, 'skin'),
        (.83, .69, -.17, -.15, 1.09, -.22, 1.5, 'skin'),
        (.85, .73, -.17, -.13, 1.18, -.16, 1.35, 'primary'),
        (.83, .68, -.10, -.15, 1.52, -.19, 1, 'skin'),
        (.75, .59, -.12, -.17, 1.538, -.17, 1, 'primary'),
    ])


def prop_mine_track(p):
    rail(p,-1,1)


def prop_mine_track_bend(p):
    for radius in (.62,1.38):
        points=[V(-1+radius*math.cos(i*math.pi/12),.14,-1+radius*math.sin(i*math.pi/12))
                for i in range(7)]
        p.tube(points,[(.038,.058)]*7,4,'metal',up=Y,phase=math.pi/4,cap_start=True,cap_end=True)
    for i in range(5):
        a=(i+.5)*math.pi/10
        strut(p,(-1+.46*math.cos(a),.055,-1+.46*math.sin(a)),
              (-1+1.54*math.cos(a),.055,-1+1.54*math.sin(a)),.077)


def prop_mine_buffer(p):
    rail(p,-.67,.67)
    for x in (-.39,.39):
        strut(p,(x,.18,-.54),(x,.81,.34),.105)
        block(p,x,.43,.34,.18,.78,.17,'secondary')
    block(p,0,.79,.34,1.37,.29,.21,'primary')
    for x in (-.38,.38):
        block(p,x,.8,.46,.23,.18,.07,'metal')


def prop_mine_shoring(p):
    portal(p,0,1.63,2.17)
    for x in (-.88,.88):
        block(p,x,.08,0,.32,.16,.67,'secondary')


def prop_mine_lagging_wall(p):
    for x in (-.91,.91):
        block(p,x,.93,.12,.19,1.86,.21,'secondary')
        block(p,x,.35,.12,.20,.09,.23,'metal')
    for i in range(8):
        block(p,0,.12+i*.23,0,2,.222,.14,'primary',ao=.025*(i%3))
    strut(p,(-.83,.19,.16),(.83,1.69,.16),.087)


def prop_mine_ore_skip(p):
    for x in (-.38, .38):
        for z in (-.42, .42):
            p.prism((x-.07, .19, z), (x+.07, .19, z), .19, .19, 8, 'metal', ao=-.12)
            outer = x + math.copysign(.07, x)
            p.prism((outer, .19, z), (outer + math.copysign(.035, x), .19, z),
                    .076, .065, 6, 'metal', ao=.07, cap_start=False)
        # The bevel exposes the cut ends of the two chassis timbers.
        timber = [[V(x + dx*width, .32 + dy*height, z)
                   for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
                  for z, width, height in ((-.63, .049, .058), (-.597, .065, .075),
                                           (.584, .065, .075), (.63, .047, .055))]
        split = x > 0
        p.loft(timber, 'primary', band_ao=[.18, .045, .18], ao=.16,
               cap_start=True, cap_end=not split)
        if split:
            # The check opens at the top of the cut face.
            a, b, c, d = timber[-1]
            left = d.lerp(c, .30)
            right = d.lerp(c, .51)
            tip = V(x+.005, .294, .63)
            root = V(x-.007, .375, .603)
            for points in ((a, b, tip), (b, c, right, tip), (a, tip, left, d)):
                p.face([p.vert(v) for v in points], 'primary', ao=.16, toward=Z)
            for points in ((left, tip, root), (tip, right, root), (right, left, root)):
                p.face([p.vert(v) for v in points], 'secondary', ao=-.18, toward=Z)
    for z in (-.42, .42):
        block(p, 0, .33, z, .90, .12, .15, 'primary', ao=.08)

    # The hopper flares above its trunnions. Folded iron protects the mouth.
    rings = [[V(x*w, y, z*d) for x, z in ((-1,-1), (1,-1), (1,1), (-1,1))]
             for w, d, y in ((.27, .40, .38), (.354, .49, .55),
                             (.349, .487, .557), (.359, .496, .568),
                             (.443, .587, .738), (.438, .584, .745),
                             (.448, .593, .756), (.53, .68, .90),
                             (.57, .725, .91), (.57, .725, 1.0),
                             (.49, .65, 1.0), (.31, .42, .56))]
    p.loft(rings, 'primary',
           band_regions=['primary', 'primary', 'primary', 'primary', 'primary',
                         'primary', 'primary', 'secondary', 'metal', 'metal', 'secondary'],
           band_ao=[.01, -.19, -.18, .15, -.19, -.18, .075, -.20, .025, .15, -.19],
           omitted_cells=[(8, 2), (9, 2)],
           cap_start=True, cap_end=True)
    # Ore wears a broad bevel into the discharge edge.
    lip = []
    for fraction, cut in ((-1, 0), (-.77, .012), (-.49, .045),
                          (.18, .037), (.65, .021), (1, 0)):
        lip.append([V(fraction*.57, .91, .725),
                    V(fraction*.57, 1-cut, .725),
                    V(fraction*(.57-cut), 1, .725-cut),
                    V(fraction*.49, 1, .65)])
    for left, right in zip(lip, lip[1:]):
        for row, (region, shade) in enumerate((('metal', .03), ('accent', -.23),
                                               ('metal', .15))):
            points = [left[row], right[row], right[row+1], left[row+1]]
            ids = [p.vert(point) for n, point in enumerate(points)
                   if point != points[n-1]]
            p.face(ids, region, ao=shade, toward=V(0, 1, 1))
    for side in (-1, 1):
        # Each bearing transfers the hopper load to the timber chassis.
        profile = [(-.32, .38), (.32, .38), (.12, .64), (.08, .73),
                   (-.08, .73), (-.12, .64)]
        p.slab([V(.436*side, y, z) for z, y in profile], .046, 'metal',
               normal=V(side, 0, 0), shrink=.96, back=True, ao=-.19)
        p.prism((side*.38, .65, 0), (side*.51, .65, 0),
                .087, .074, 8, 'metal', cap_start=False)
    # Broken basalt shows the same bedding planes as the tunnel face.
    quarry_bed(p, [(-.44,.80), (.18,.77), (.27,1.09), (.06,1.38), (-.31,1.28)],
               -.60, -.10, 'skin', -.07)
    quarry_bed(p, [(-.19,.78), (.43,.80), (.45,1.09), (.12,1.26), (-.16,1.13)],
               -.16, .40, 'skin', .04)
    quarry_bed(p, [(-.42,.77), (-.07,.76), (.0,1.04), (-.26,1.16), (-.43,1.06)],
               .06, .53, 'skin', -.14)


def prop_mine_ore_chute(p):
    for x in (-.55,.55):
        for z,h in ((-.50,1.50),(.62,.65)):
            block(p,x,h/2,z,.15,h,.16,'primary')
        strut(p,(x,.36,.58),(x,1.28,-.50),.085)
    for x in (-.49,-.245,0,.245,.49):
        p.slab([V(x-.12,1.49,-.7),V(x+.12,1.49,-.7),V(x+.12,.55,.84),
                V(x-.12,.55,.84)],.065,'metal',normal=Y,back=True,shrink=1)
    for x in (-.61,.61):
        strut(p,(x,1.60,-.68),(x,.67,.84),.105)


def prop_mine_winding_drum(p):
    for x in (-.54,.54):
        block(p,x,.07,0,.28,.14,.80,'secondary')
        strut(p,(x,.12,-.30),(x,.86,0),.115)
        strut(p,(x,.12,.30),(x,.86,0),.115)
    p.prism((-.68,.80,0),(.68,.80,0),.085,.085,8,'metal')
    p.prism((-.43,.80,0),(.43,.80,0),.25,.25,10,'primary')
    for i in range(8):
        x=(i-3.5)*.11
        p.prism((x-.044,.80,0),(x+.044,.80,0),.34 if i in (0,7) else .27,
                .34 if i in (0,7) else .27,10,'secondary' if i in (0,7) else 'skin')
    strut(p,(.70,.80,0),(.70,1.12,0),.06,'metal')
    p.prism((.69,1.12,0),(.90,1.12,0),.06,.06,6,'primary')


def prop_mine_lamp_post(p):
    block(p,-.17,.12,0,.54,.24,.55,'skin',corner=.06)
    block(p,-.17,.97,0,.14,1.88,.14,'primary')
    strut(p,(-.17,1.48,0),(.20,1.85,0),.06)
    block(p,.07,1.85,0,.62,.10,.12,'primary')
    block(p,.29,1.65,0,.033,.33,.033,'metal')
    lamp(p,.29,1.10,0)


def prop_mine_ladder(p):
    for x in (-.28,.28):
        strut(p,(x,.025,.26),(x,2.55,-.26),.07)
    for i in range(8):
        y=.22+i*.30
        z=.26-y*.52/2.55
        strut(p,(-.28,y,z),(.28,y,z),.052)


def prop_quarry_drill_rack(p):
    for x in (-.59,.59):
        block(p,x,.55,0,.11,1.10,.12,'primary')
        block(p,x,.065,0,.22,.13,.62,'secondary')
    for y in (.28,.96):
        block(p,0,y,0,1.28,.12,.11,'primary')
    for i in range(5):
        x=(i-2)*.21
        strut(p,(x,.07,.17),(x,1.18+.09*(i%3),.04),.042,'metal')
        block(p,x,1.21+.09*(i%3),.04,.16,.08,.09,'secondary')


def prop_quarry_scree_fan(p):
    for i in range(12):
        a=i*2.4
        t=(i/12)**.5
        rock(p,1.02*t*math.cos(a),0,.69*t*math.sin(a),.36-.15*t,
             .46-.22*t,.33-.11*t,120+i,'skin' if i%3 else 'secondary')


def prop_quarry_crystal_seam(p):
    rock(p,0,0,0,1,.72,.69,140,'secondary')
    for i in range(7):
        a=i*2.40
        x,z=.57*math.cos(a),.32*math.sin(a)
        spike(p,x,.37,z,.12+.025*(i%3),.44+.17*(i%3),x*.43,z*.8,'eye')


def prop_quarry_stone_needle(p):
    outline = [(-1, -.38), (-.54, -1), (.56, -.84), (1, -.16),
               (.59, .87), (-.28, 1), (-.89, .54)]
    basalt_beds(p, outline, [
        (.707, .45, -.03, -.005, 0, 0),
        (.62, .42, -.03, -.02, .46, .28),
        (.53, .35, -.06, -.05, 1.06, .39),
        (.37, .29, .02, -.06, 1.16, .42),
        (.16, .14, .28, -.12, 2.35, .478),
    ])
    # A second fracture ends below the long blade.
    rock(p, -.42, 0, .11, .32, 1.18, .29, 163, 'secondary', sides=5)


def prop_quarry_rock_shelf(p):
    outline = [(-1, -.37, -.06), (-.78, -.90, .07), (.40, -1, .08),
               (.91, -.63, -.01), (1, .35, -.04), (.45, .76, .02),
               (-.20, 1, .09), (-.82, .83, -.02)]
    layered_outcrop(p, outline, [
        (1.08, .69, .06, -.02, 0, 0, 0, 'skin'),
        (1.14, .71, .04, -.025, .41, .06, .6, 'primary'),
        (1.05, .60, .07, -.06, .48, .06, .6, 'secondary'),
        (.99, .57, .09, -.08, .77, .08, .7, 'skin'),
        (1.246, .759, 0, 0, .85, .08, .8, 'secondary'),
        (1.21, .72, -.02, -.01, 1.06, .09, 1, 'primary'),
        (1.09, .64, -.04, -.04, 1.113, .09, 1, 'skin'),
    ])


def prop_quarry_vent_stack(p):
    for i,(x,z,r,h) in enumerate(((0,0,.46,1.04),(.45,-.19,.27,.65),(-.36,.18,.24,.44))):
        p.lathe([(r,0),(r*.80,h*.29),(r*.62,h*.88),(r*.71,h),(r*.46,h),(r*.35,h*.62)],
                7,'secondary',center=(x,0,z),cap_start=True)
        p.lathe([(r*.36,h*.63)],7,'eye',center=(x,0,z),cap_end=True)


def prop_quarry_flowstone(p):
    rock(p,0,0,-.15,1.01,1.65,.54,184,'secondary')
    for i in range(6):
        x=(i-2.5)*.25
        p.lathe([(.24,0),(.19,.29),(.09,.72),(.14,1.02+.08*(i%3))],6,
                'skin',center=(x,0,.13+.10*math.cos(i)),cap_end=True)


def prop_fossil_rib_arc(p):
    for i in range(4):
        z=(i-1.5)*.39
        for s in (-1,1):
            h=1.25+.20*math.cos(i)
            p.tube([V(s*.48,.03,z),V(s*.74,.47,z),V(s*.71,.83*h,z-.04),
                    V(s*.43,h,z-.09)], [.13,.14,.09,.053],6,'accent',up=Z,
                   cap_start=True,tip_end=V(s*.18,h+.06,z-.12))
        rock(p,0,0,z,.31,.27,.26,210+i,'skin')


def prop_fossil_jaw(p):
    for s in (-1,1):
        p.tube([V(s*.51,.34,-.61),V(s*.44,.14,-.22),V(s*.36,.12,.26),
                V(s*.12,.14,.62),V(0,.15,.63)],[.16,.15,.13,.11,.09],7,'accent',up=Y,
               cap_start=True,cap_end=True)
        for i in range(4):
            x=s*(.46-.054*i)
            spike(p,x,.18,-.28+i*.20,.073,.17+.05*(i%2),-.036*s,-.04,'skin')


def prop_fossil_spine(p):
    for i in range(6):
        z=(i-2.5)*.28
        x=.23*math.sin(i*.6)
        p.lathe([(.15,0),(.22,.15),(.15,.29)],7,'accent',center=(x,0,z),cap_end=True)
        spike(p,x,.22,z,.087,.27+.11*math.sin(i*.7),0,-.13,'accent')
        for s in (-1,1):
            p.prism((x,.13,z),(x+s*.34,.20,z+.04),.098,.041,5,'skin')


def prop_fossil_tusk_marker(p):
    rock(p,0,0,0,.52,.54,.46,231,'secondary')
    spike(p,.02,.33,0,.22,1.81,-.47,.13,'accent')
    for y,r in ((.47,.23),(.56,.213)):
        p.lathe([(r,y),(r,y+.06)],7,'primary',center=(-.025,0,0))


def prop_shrine_offering_bowl(p):
    p.lathe([(.48,0),(.49,.12),(.28,.21),(.23,.68),(.39,.76)],8,'skin',cap_start=True,cap_end=True)
    p.lathe([(.31,.73),(.57,.94),(.59,1.00),(.49,1.00),(.30,.83)],10,'metal',cap_end=True)
    for x,z in ((-.18,.10),(.12,.12),(.04,-.16)):
        spike(p,x,.83,z,.11,.34,x*.35,z*.28,'eye')


def prop_shrine_ward_stone(p):
    rock(p,0,0,0,.62,.36,.51,255)
    block(p,0,.97,0,.68,1.55,.34,'secondary',taper=(.69,.85),corner=.09)
    for s in (-1,1):
        strut(p,(s*.21,1.38,.16),(0,1.09,.19),.044,'eye')
        strut(p,(s*.16,.82,.18),(0,1.08,.19),.041,'eye')
    block(p,0,1.51,.15,.052,.26,.050,'eye')


def prop_shrine_bone_chimes(p):
    for s in (-1,1):
        rock(p,s*.65,0,0,.27,.29,.26,274+int(s))
        strut(p,(s*.65,.12,0),(s*.73,1.81,0),.10)
    block(p,0,1.74,0,1.67,.14,.15,'primary')
    for i in range(7):
        x=(i-3)*.19
        y=.54+.15*abs(i-3)
        strut(p,(x,1.70,0),(x,y+.36,0),.021,'secondary')
        spike(p,x,y+.35,0,.063,.21,x*.1,.04,'accent')
        p.prism((x,y,0),(x,y+.43,0),.037,.055,6,'accent',up=Z)


def prop_brood_nest(p):
    # Three folds in the rim leave low sight lines to the eggs.
    lip = [.24, .33, .42, .30, .24, .39, .49, .30, .23, .29, .41, .32]
    rings = []
    for radius, base, rise in ((.62, 0, 0), (.86, .09, .12), (.78, 0, 1),
                               (.66, -.02, 1), (.46, .12, 0)):
        ring = []
        for i, height in enumerate(lip):
            angle = i * math.tau / len(lip)
            r = radius * (1 - .07 * (i % 3 == 1))
            ring.append(V(r * math.cos(angle), base + rise*height, r * math.sin(angle)))
        rings.append(ring)
    p.loft(rings, 'primary', band_regions=['secondary', 'primary', 'hair', 'secondary'],
           cap_start=True, cap_end=True)
    for angle in (.47, 2.68, 4.03):
        dx, dz = math.cos(angle), math.sin(angle)
        p.tube([V(.81*dx, .15, .81*dz), V(.78*dx-.08*dz, .34, .78*dz+.08*dx)],
               [.10, .071], 5, 'secondary', up=Y,
               tip_end=V(.69*dx-.18*dz, .49, .69*dz+.18*dx))
    for x, z, r, height, role in ((-.30, -.13, .21, .54, 'skin'),
                                   (.21, -.23, .26, .64, 'accent'),
                                   (.10, .29, .18, .47, 'skin')):
        p.lathe([(r*.57, .11), (r, height*.54), (r*.83, height*.78),
                 (r*.44, height*.94)], 8, role, center=(x, 0, z),
                tip_end=V(x, height, z))


def prop_brood_spore_log(p):
    p.prism((-.84,.26,0),(.83,.30,.09),.27,.24,8,'primary')
    for i in range(7):
        x=(i-3)*.19
        z=(-1)**i*.14
        h=.48+.08*(i%3)
        p.lathe([(.07,.33),(.046,h)],6,'accent',center=(x,0,z))
        p.lathe([(.14,h-.02),(.17,h+.04),(.09,h+.12)],7,'hair',center=(x,0,z),
                cap_start=True,cap_end=True)


QUARRY_PROPS = [
    (prop_mine_track,'Quarry Rail Section'), (prop_mine_track_bend,'Quarter-Circle Mine Rail'),
    (prop_mine_buffer,'Timber Rail Buffer'), (prop_mine_shoring,'Tunnel Shoring Bent'),
    (prop_mine_lagging_wall,'Braced Lagging Wall'), (prop_mine_ore_skip,'Loaded Ore Skip'),
    (prop_mine_ore_chute,'Gravity Ore Chute'), (prop_mine_winding_drum,'Hand Winding Drum'),
    (prop_mine_lamp_post,'Pit Lamp Post'), (prop_mine_ladder,'Inclined Mine Ladder'),
    (prop_quarry_drill_rack,'Rock Drill Rack'), (prop_quarry_scree_fan,'Basalt Scree Fan'),
    (prop_quarry_crystal_seam,'Ember Crystal Seam'), (prop_quarry_stone_needle,'Split Stone Needle'),
    (prop_quarry_rock_shelf,'Overhanging Rock Shelf'), (prop_quarry_vent_stack,'Fumarole Chimneys'),
    (prop_quarry_flowstone,'Cavern Flowstone Curtain'), (prop_fossil_rib_arc,'Fossil Rib Arcade'),
    (prop_fossil_jaw,'Ancient Lower Jaw'), (prop_fossil_spine,'Exposed Vertebrae'),
    (prop_fossil_tusk_marker,'Bound Tusk Cairn'), (prop_shrine_offering_bowl,'Crystal Offering Bowl'),
    (prop_shrine_ward_stone,'Carved Ember Ward'), (prop_shrine_bone_chimes,'Bone Chime Gate'),
    (prop_brood_nest,'Thorn-Rimmed Brood Nest'), (prop_brood_spore_log,'Spore Nurse Log'),
]
