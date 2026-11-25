"""Castle river quay, market, and cooper's yard."""

import math
from mathutils import Matrix
from polykit import V, X, Y, Z
from props_level_common import gable_roof, hip_roof, door_unit, window_pane


def block(p, x, y, z, w, h, d, region, **options):
    p.box(V(x, y, z), (w, h, d), region, **options)


def beam(p, a, b, width, region='secondary'):
    p.prism(a, b, width * .707, width * .707, 4, region, up=Z, phase=math.pi / 4)


def barrel(p, x, y, z, r, h, lid=True):
    profile = [(r*.78, 0), (r*.93, h*.18), (r, h*.52), (r*.9, h*.86), (r*.77, h)]
    p.lathe(profile, 10, 'primary', center=(x,y,z), cap_start=True, cap_end=lid)
    for rad, level in ((.93,.18),(.91,.84)):
        p.lathe([(r*(rad+.025), h*(level-.04)), (r*(rad+.04), h*(level+.04))],
                10, 'metal', center=(x,y,z))
    if not lid:
        outer = .77*r
        inner = .64*r
        p.lathe([(outer,h-.015*h), (outer,h), (inner,h)],10,'primary',center=(x,y,z))
        p.lathe([(inner,h*.85)],10,'secondary',center=(x,y,z),cap_end=True)


def trestle(p, w, h, d):
    for x in (-w*.38,w*.38):
        for side in (-1,1):
            beam(p,(x,.04,side*d*.48),(x,h,side*d*.26),.10)
        block(p,x,h-.07,0,.14,.14,d,'secondary')
    block(p,0,h*.4,0,w*.82,.10,.12,'primary')


def facade(p, width, height, depth):
    block(p,0,height/2,0,width,height,depth,'skin')
    for side in (-1,1):
        z = side * depth/2
        for x in (-width*.47, 0, width*.47):
            block(p,x,height/2,z,.105,height,.085,'secondary')
        for y in (.14,height-.08):
            block(p,0,y,z,width,.12,.09,'primary')
        beam(p,(width*.06,.22,z),(width*.43,height-.18,z),.075)


def prop_castle_keep_tower(p):
    def square_course(profile, regions, shades, *, bottom=False, top=False):
        rings = [[V(x * radius, y, z * radius)
                  for x, z in ((1, -1), (1, 1), (-1, 1), (-1, -1))]
                 for y, radius in profile]
        p.loft(rings, regions[0], band_regions=regions, band_ao=shades,
               cap_start=bottom, cap_end=top)

    # The battered footing ends in a projecting cap with a sloped drip edge.
    square_course([(0,.99),(.18,.99),(.47,.92),(.49,.96),(.61,.96),(.68,.85),
                   (2.39,.85),(2.55,.98),(2.59,1.02),(2.73,1.02)],
                  ['skin'] * 9, [-.21,-.10,-.24,.12,.16,-.04,-.15,-.22,.10],
                  bottom=True, top=True)
    for x in (-.75,.75):
        for z in (-.75,.75):
            block(p,x,2.97,z,.21,.50,.21,'secondary',cap_start=False,cap_end=False)
            block(p,x,3.12,z,.33,.16,.33,'primary',taper=1.22,cap_end=False)

    # The lowest slate course flares over the timber wall plate.
    square_course([(3.17,.98),(3.27,.98),(3.28,1.055),(3.36,1.055),
                   (3.55,.78),(3.57,.81),(3.86,.48),(3.88,.50),(4.23,.105)],
                  ['primary','secondary','accent','accent','accent','accent','accent','accent'],
                  [.04,-.22,-.24,-.04,-.22,.03,-.20,.08], bottom=True, top=True)
    block(p,0,4.43,0,.065,.44,.065,'metal')
    p.slab([V(0,4.62,0),V(.53,4.53,0),V(0,4.39,0)],.025,'primary',normal=Z,back=True)
    p.lathe([(.15,1.48),(.34,1.85),(.34,2.60)],8,'skin',
            center=(.84,0,.67),cap_start=True,cap_end=False)
    p.lathe([(.44,2.59),(.44,2.67)],8,'accent',
            center=(.84,0,.67),cap_start=True,tip_end=V(.84,3.17,.67))
    block(p,.84,2.28,1.00,.10,.30,.04,'eye')
    # Five arch stones meet above a round oak door.
    angles = [i * math.pi / 5 for i in range(6)]
    crown = [V(.41 * math.cos(a), 1.99 + .41 * math.sin(a), .967) for a in angles]
    p.slab([V(-.41,.06,.967), V(.41,.06,.967), *crown], .034, 'primary',
           normal=Z, shrink=.99)
    for i, (left, right) in enumerate(zip(angles, angles[1:])):
        outer = .67 if i == 2 else .60
        outline = [V(r * math.cos(a), 1.99 + r * math.sin(a), .85)
                   for a, r in ((left,.40), (left,outer), (right,outer), (right,.40))]
        p.slab(outline, .21 if i == 2 else .18, 'skin', normal=Z, shrink=.94,
               ao=(.04, -.12, .19, -.08, .06)[i])
    for side in (-1,1):
        for y, shade in ((.52,-.09), (1.50,.09)):
            block(p,side*.50,y,.94,.20,.98,.18,'skin',ao=shade)
    for x, shade in ((-.22,-.10), (.02,.09), (.25,-.04)):
        half = .106
        top = 1.99 + math.sqrt(.40**2 - (abs(x) + half)**2)
        p.plate(V(x,(top+.07)/2,1.006),Z,Y,half*2,top-.07,.008,'primary',
                shrink=.98,ao=shade)
    p.plate(V(.23,1.04,1.012),Z,Y,.076,.14,.024,'metal',shrink=.80)
    for y in (.52,1.62):
        p.plate(V(-.14,y,1.012),Z,Y,.43,.065,.018,'secondary',shrink=.88)
    # Alternate the long face of each corner stone between adjacent walls.
    for side in (-1,1):
        for end in (-1,1):
            for y, h, w, d, shade in ((.91,.50,.40,.26,.12),(1.61,.90,.24,.34,-.14),
                                      (2.25,.38,.37,.37,.16)):
                edge = .92 if y > 2 else .89
                block(p,side*(edge-w/2),y,end*(edge-d/2),w,h,d,'skin',ao=shade,
                      cap_start=y > 1, cap_end=y < 1)

    for side in (-1,1):
        block(p,side*.86,1.78,0,.04,.48,.14,'eye')


def prop_thatched_cottage(p):
    block(p,0,.12,0,2.65,.24,2.04,'secondary',corner=.09)
    with p.placed(Matrix.Translation(V(0,.24,0))):
        facade(p,2.54,2.04,1.88)
    for i in range(3):
        span = 2.28 * (1-i*.29)
        gable_roof(p,0,2.28+i*.19,0,2.68-i*.03,span,.60-i*.14,
                   'accent',overhang=.08,ao=.04*i)
    block(p,0,2.98,0,2.76,.11,.16,'primary',corner=.035)
    block(p,-.83,2.51,-.42,.37,1.22,.40,'skin',corner=.04)
    block(p,-.83,3.13,-.42,.46,.14,.49,'secondary')
    door_unit(p,(-.59,.24,.98),.84,2.00)
    window_pane(p,V(.55,1.08,1),Z,Y,.45,.52)
    for x in (.20,.90):
        block(p,x,1.08,1.03,.17,.57,.075,'primary')
    block(p,.55,.76,1.07,.94,.1,.19,'secondary')
    for side in (-1,1):
        x=side*1.275
        block(p,x,1.26,0,.085,2.04,.12,'secondary')
        for z in (-.89,.89):
            block(p,x,1.26,z,.09,2.04,.12,'secondary')
            p.prism((x,.54,z*.94),(x,2.09,z*.12),.062,.062,4,'primary',up=V(1,0,0))
        block(p,x,2.12,0,.09,.11,1.89,'secondary')
    # The dormer sits across the main ridge.
    block(p,.50,2.51,.54,.70,.47,.55,'skin')
    gable_roof(p,.50,2.73,.56,.78,.72,.30,'primary',along='z',overhang=.045)
    block(p,.50,2.55,.827,.37,.28,.045,'eye')
    block(p,.50,2.55,.858,.044,.30,.026,'primary')
    block(p,.50,2.38,.83,.56,.09,.14,'secondary')
    block(p,-.59,.10,1.08,.91,.20,.47,'skin')


def prop_quay_deck(p):
    for x in (-.72,.72):
        for z in (-.75,.75):
            p.lathe([(.15,0),(.13,.68)],7,'secondary',center=(x,0,z),cap_end=True)
        block(p,x,.49,0,.18,.19,2,'secondary')
    for i in range(8):
        block(p,0,.64,-.875+i*.25,2,.13,.237,'primary',ao=.025*(i%3))


def prop_quay_landing_steps(p):
    for i in range(5):
        y=(i+1)*.14
        block(p,0,y/2,.8-i*.4,1.55,y,.40,'skin',ao=.025*(i%2))
    for x in (-.79,.79):
        beam(p,(x,.10,.89),(x,.69,-.90),.12)


def prop_quay_bollard(p):
    p.lathe([(.33,0),(.32,.12),(.20,.18),(.19,.62),(.26,.67),(.23,.75)],8,
            'primary',cap_start=True,cap_end=True)
    for y in (.28,.35,.42):
        p.lathe([(.21,y),(.23,y+.033),(.21,y+.065)],9,'skin')


def prop_quay_crane(p):
    block(p,0,.12,0,1.29,.24,1.10,'skin',corner=.09)
    block(p,-.32,1.35,0,.24,2.36,.24,'secondary')
    beam(p,(-.36,1.68,0),(.69,2.47,0),.17)
    block(p,.12,2.49,0,1.70,.18,.23,'primary')
    for x in (-.32,.84):
        p.prism((x,2.52,-.14),(x,2.52,.14),.15,.15,8,'metal')
    block(p,.84,1.83,0,.042,1.26,.042,'skin')
    p.tube([V(.84,1.24,0),V(.84,1.1,0),V(.72,1.06,0),V(.64,1.17,0)],
           [.033,.04,.04,.022],5,'metal',up=Z,cap_end=True)
    p.prism((-.32,1.02,-.29),(-.32,1.02,.29),.20,.20,10,'primary')


def prop_quay_fish_rack(p):
    for x in (-.80,.80):
        block(p,x,.70,0,.10,1.40,.10,'secondary')
        block(p,x,.06,0,.20,.12,.59,'primary')
    block(p,0,1.31,0,1.78,.09,.10,'primary')
    for i in range(6):
        x,y=-.62+i*.25,.79+.06*(i%2)
        block(p,x,(1.31+y)/2,0,.018,1.31-y,.023,'skin')
        p.lathe([(.04,0),(.115,.25),(.043,.4),(.095,.51)],6,'metal',
                center=(x,y-.35,0),scale_z=.47,cap_start=True,cap_end=True)


def prop_cooper_casks(p):
    for x,z in ((-.38,.15),(.37,.20),(0,-.42)):
        barrel(p,x,0,z,.36,.88)


def prop_cooper_wash_vat(p):
    barrel(p,0,0,0,.68,.72,False)
    beam(p,(-.47,.09,.12),(-.19,1.08,.16),.07,'primary')


def prop_cooper_drawbench(p):
    trestle(p,1.50,.53,.56)
    block(p,0,.58,0,1.6,.12,.48,'primary')
    beam(p,(.14,.15,0),(.48,.92,0),.12)
    block(p,.43,.85,0,.24,.14,.42,'primary')


def prop_cooper_stave_stack(p):
    for z in (-.48,.48):
        block(p,0,.065,z,1.26,.13,.19,'secondary')
    for row in range(3):
        for i in range(5-row):
            x=(i-(4-row)/2)*.23
            block(p,x,.18+row*.11,0,.21,.11,1.37,'primary',taper=(.85,.93),ao=.04*row)


def prop_market_bread_table(p):
    trestle(p,1.58,.74,.72)
    block(p,0,.79,0,1.66,.11,.78,'primary')
    for i in range(5):
        x=(i-2)*.29
        p.lathe([(.13,.845),(.14,.92),(.095,.99)],8,'skin',center=(x,0,0),
                scale_z=1.9,cap_end=True,ao=.10)


def prop_market_cloth_booth(p):
    for x in (-.87,.87):
        block(p,x,1.28,-.30,.12,2.56,.12,'secondary')
        block(p,x,.39,.30,.12,.78,.12,'secondary')
        beam(p,(x,1.48,-.30),(x,2.03,.66),.09)
    block(p,0,.71,0,1.96,.15,.87,'primary')
    block(p,0,.28,-.30,1.80,.15,.11,'secondary')
    block(p,0,2.44,-.30,1.88,.12,.12,'secondary')
    # The cloth hangs lower between the arms. One woven band marks each end.
    sections = [(-1.05,.01),(-.90,0),(-.78,.02),(0,.12),
                (.78,.02),(.90,0),(1.05,.01)]
    rings = [[V(x,2.49,-.435),V(x,2.19-drop*.5,.11),
              V(x,2.04-drop,.725),V(x,1.91-drop,.71)] for x,drop in sections]
    p.loft(rings,'skin',closed=False,two_sided=True,thickness=.006,
           band_regions=['skin','accent','skin','skin','accent','skin'])


def prop_market_apple_bin(p):
    block(p,0,.17,0,1.20,.34,.76,'secondary')
    for x in (-.62,.62):
        block(p,x,.29,0,.07,.58,.88,'primary')
    for z in (-.41,.41):
        for y in (.11,.31,.48):
            block(p,0,y,z,1.23,.12,.06,'primary')
    for i in range(5):
        for j in range(3):
            x,z=(i-2)*.222,(j-1)*.224
            p.lathe([(.075,.36),(.126,.49),(.088,.58)],6,'hair' if (i+j)%4==0 else 'accent',
                    center=(x,0,z),cap_end=True)


def prop_market_balance(p):
    block(p,0,.07,0,.65,.14,.47,'primary',corner=.06)
    block(p,0,.64,0,.09,1.05,.09,'metal')
    block(p,0,1.13,0,1.08,.06,.07,'primary')
    for x in (-.48,.48):
        for dx in (-.16,.16):
            beam(p,(x,1.12,0),(x+dx,.68,0),.018,'metal')
        p.lathe([(.09,.58),(.23,.68),(.21,.69),(.09,.62)],8,'metal',center=(x,0,0),cap_end=True)


def prop_bake_oven(p):
    block(p,0,.45,0,1.48,.90,1.26,'skin',corner=.12)
    p.lathe([(.83,.90),(.80,1.15),(.65,1.43),(.30,1.62)],8,'accent',scale_z=.92,cap_end=True)
    block(p,0,1.12,.69,.55,.38,.18,'eye',corner=.08)
    block(p,0,.90,.76,1.09,.14,.42,'skin')
    block(p,-.38,1.60,-.30,.24,.72,.26,'secondary')


def prop_castle_buttress(p):
    for w,y,h,d in ((.84,0,.31,1.2),(.68,.31,.95,.95),(.61,1.26,.13,.78),
                      (.49,1.39,.84,.65),(.55,2.23,.13,.68)):
        block(p,0,y+h/2,-.6+d/2,w,h,d,'skin',taper=(.98,.84),ao=.05 if h<.4 else -.04)


def prop_castle_gallery(p):
    for x in (-.82,0,.82):
        block(p,x,1.06,-.28,.17,2.12,.18,'secondary')
        beam(p,(x,1.28,-.27),(x,1.95,.49),.13)
    block(p,0,1.99,.08,2,.16,1.02,'primary')
    for x in (-.89,-.46,0,.46,.89):
        block(p,x,2.39,.51,.09,.74,.09,'secondary')
    block(p,0,2.75,.51,2,.11,.13,'primary')


def prop_castle_herald(p):
    block(p,0,.10,0,.76,.2,.63,'skin',corner=.09)
    block(p,0,1.42,0,.09,2.64,.09,'secondary')
    block(p,0,2.51,.02,1.06,.08,.085,'metal')
    p.slab([V(-.44,2.49,.07),V(.44,2.49,.07),V(.41,1.48,.11),
            V(0,1.12,.14),V(-.41,1.48,.11)],.023,'accent',normal=Z,back=True)
    p.slab([V(0,2.31,.11),V(.19,1.96,.12),V(0,1.64,.14),V(-.19,1.96,.12)],
           .02,'skin',normal=Z,back=True)


def prop_castle_sentry_box(p):
    facade(p,1.08,2.1,.96)
    door_unit(p,(0,.04,.49),.80,2.00,'primary','eye')
    hip_roof(p,0,2.10,0,1.12,1.00,.64,'accent',shrink=.11)


def prop_castle_arrow_screen(p):
    for x in (-.61,.61):
        block(p,x,.09,0,.17,.18,.85,'secondary')
        beam(p,(x,.12,-.38),(x,1.19,.06),.10)
    for i in range(7):
        h=1.67-.07*abs(i-3)
        block(p,(i-3)*.21,.15+h/2,.10,.204,h,.15,'primary',taper=(.91,1))
    for y in (.42,1.22):
        block(p,0,y,.20,1.5,.09,.06,'metal')


def prop_tavern_board(p):
    block(p,-.37,1.18,0,.14,2.36,.15,'secondary')
    block(p,.05,2.22,0,1.05,.12,.14,'primary')
    beam(p,(-.35,1.72,0),(.21,2.20,0),.10)
    for x in (-.04,.40):
        block(p,x,2.02,0,.04,.32,.04,'metal')
    block(p,.18,1.59,0,.74,.57,.12,'accent',corner=.06)
    block(p,.18,1.59,.068,.22,.29,.04,'skin',taper=.78)


def prop_street_water_trough(p):
    for x in (-.72,.72):
        block(p,x,.12,0,.30,.24,.75,'skin')
    block(p,0,.26,0,1.91,.14,.70,'secondary')
    for z in (-.34,.34):
        block(p,0,.44,z,1.91,.38,.08,'primary')
    for x in (-.92,.92):
        block(p,x,.44,0,.09,.38,.63,'primary')
    block(p,0,.43,0,1.78,.04,.61,'eye')


def prop_street_dovecote(p):
    block(p,0,.14,0,.73,.28,.70,'skin',taper=.82)
    block(p,0,.99,0,.21,1.56,.20,'secondary')
    block(p,0,1.94,0,.92,.70,.78,'skin')
    for x in (-.23,.23):
        block(p,x,1.95,.40,.18,.25,.04,'eye',corner=.03)
    block(p,0,1.79,.42,1.03,.08,.28,'primary')
    hip_roof(p,0,2.29,0,.93,.82,.48,'accent',shrink=.15)


def prop_herb_planter(p):
    barrel(p,0,0,0,.47,.41,False)
    for i in range(9):
        a=i*2.40
        x,z=.27*math.cos(a),.27*math.sin(a)
        p.prism((x*.2,.35,z*.2),(x,.55+.09*(i%3),z),.11,.012,5,'hair',up=Z)


def prop_reed_bundle(p):
    for i in range(9):
        a=i*2.40
        x,z=.16*math.cos(a),.16*math.sin(a)
        p.prism((x,0,z),(x*1.7,1.06+(i%3)*.10,z*1.7),.075,.04,5,'primary',up=Z)
    for y in (.29,.67):
        p.lathe([(.24,y),(.24,y+.055)],9,'secondary')


def prop_quay_net_frame(p):
    for x in (-.84,.84):
        block(p,x,.81,0,.11,1.62,.13,'secondary')
        block(p,x,.07,0,.25,.14,.64,'primary')
    block(p,0,1.52,0,1.82,.10,.12,'primary')
    for i in range(7):
        x=(i-3)*.22
        beam(p,(x,1.48,0),(x,.49+.07*abs(i-3),0),.025,'skin')
    for j in range(4):
        y=.50+j*.23
        for s in (-1,1):
            beam(p,(0,y,0),(s*.66,y+.19,0),.024,'skin')


QUAY_PROPS = [
    (prop_quay_deck,'Pile-Supported Quay Deck'), (prop_quay_landing_steps,'Quay Landing Steps'),
    (prop_quay_bollard,'Rope-Wound Mooring Bollard'), (prop_quay_crane,'Quay Cargo Crane'),
    (prop_quay_fish_rack,'Herring Drying Rack'), (prop_quay_net_frame,'Net Mending Frame'),
    (prop_cooper_casks,'Cooper’s Shipping Casks'), (prop_cooper_wash_vat,'Open Wash Vat'),
    (prop_cooper_drawbench,'Cooper’s Shaving Horse'), (prop_cooper_stave_stack,'Seasoned Cask Staves'),
    (prop_market_bread_table,'Baker’s Trestle Table'), (prop_market_cloth_booth,'Striped Market Booth'),
    (prop_market_apple_bin,'Slatted Apple Bin'), (prop_market_balance,'Merchant’s Balance'),
    (prop_bake_oven,'Courtyard Bread Oven'), (prop_castle_buttress,'Stepped Castle Buttress'),
    (prop_castle_gallery,'Timber Wall Gallery'), (prop_castle_herald,'Pennant Standard'),
    (prop_castle_sentry_box,'Roofed Sentry Box'), (prop_castle_arrow_screen,'Plank Mantlet'),
    (prop_tavern_board,'Hanging Tankard Sign'), (prop_street_water_trough,'Stable Water Trough'),
    (prop_street_dovecote,'Village Dovecote'), (prop_herb_planter,'Coopered Herb Tub'),
    (prop_reed_bundle,'Bound Thatching Reeds'),
]
