"""Shipyard plasma welding station, in the Pirate Nation mecha style.

One iconic shape (rule K3): a mobile plasma welding repair station on heavy
shop casters. A welded steel cart frame with hazard-striped rub rails carries
dual high-pressure shielding gas cylinders at the back (one in hazard orange,
one in teal) with brass regulator manifold valves (F4). An articulated overhead
torch boom arm swings out over the steel work surface (F5), holding a heavy
copper plasma torch head with gold ceramic nozzle tips. The central power unit
features an amperage meter readout and dual cable plug sockets. Welding spark
effects emit from the torch nozzle. Detail is paint (S1). Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnpaint
from _pn import pipe
from _props import dots, ngon_prism
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part, Socket

W, H, D = 26, 30, 20
X0, X1 = 2, 24
Z0, Z1 = 2, 18


def cart() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)

    # 4 Heavy shop caster wheels (Y=0 to 3)
    for wx, wz in ((X0 + 2, Z0 + 2), (X1 - 2, Z0 + 2), (X0 + 2, Z1 - 2), (X1 - 2, Z1 - 2)):
        wheel = ngon_prism(g, "y", wx, wz, 1.8, 0, 3, "iron", 4, n=8)
        P.flat(g, wheel, "iron", 4)
        dots(g, wheel, "top", [(wx, wz)], 0.7, "gold", 6)

    # Lower chassis frame and bottom shelf (Y=3 to 5)
    chassis = box(g, X0, 3, Z0, X1, 5, Z1, "steel", 4)
    P.flat(g, edges(chassis), "steel", 3)
    pnpaint.hazard(g, chassis & ((X < X0 + 2) | (X > X1 - 2)), period=4, a=("orange", 5), b=("iron", 4))

    # Ground cable spool on lower shelf (X=5 to 11, Z=4 to 10, Y=5 to 9)
    spool = ngon_prism(g, "y", 8.0, 7.0, 3.2, 5, 8, "orange", 5, n=8)
    P.flat(g, edges(spool), "orange", 4)
    hub = ngon_prism(g, "y", 8.0, 7.0, 1.4, 5, 9, "rust", 5, n=8)
    P.flat(g, hub, "rust", 5)

    # Main workbench tabletop slab (Y=12 to 14, X=X0 to X1, Z=Z0 to 13)
    table = box(g, X0, 12, Z0, X1, 14, 13, "steel", 5)
    P.flat(g, edges(table), "steel", 3)
    P.plates(g, table, "steel", 5, size=(8, 6))

    # 4 Upright steel corner posts supporting tabletop (Y=5 to 12)
    for px, pz in ((X0, Z0), (X1 - 2, Z0), (X0, 11), (X1 - 2, 11)):
        post = box(g, px, 5, pz, px + 2, 12, pz + 2, "iron", 5)
        P.flat(g, edges(post), "iron", 3)

    # DUAL GAS CYLINDERS IN REAR RACK (Z=12 to 17, Y=5 to 25):
    # Left cylinder: Argon gas (hazard orange)
    cyl1 = ngon_prism(g, "y", 7.5, 14.5, 3.2, 5, 23, "orange", 5, n=8)
    P.flat(g, edges(cyl1), "orange", 4)
    dome1 = ngon_prism(g, "y", 7.5, 14.5, 3.2, 23, 25, "orange", 5, n=8, r_top=1.6)
    P.flat(g, edges(dome1), "orange", 4)
    # Cylinder 1 brass regulator and gauge (Y=25 to 28)
    val1 = ngon_prism(g, "y", 7.5, 14.5, 1.4, 25, 28, "rust", 5, n=6)
    P.flat(g, val1, "rust", 5)
    P.flat(g, val1 & (Y == 27), "gold", 6)

    # Right cylinder: Ion shielding plasma (deep teal)
    cyl2 = ngon_prism(g, "y", 18.5, 14.5, 3.2, 5, 23, "teal", 5, n=8)
    P.flat(g, edges(cyl2), "teal", 4)
    dome2 = ngon_prism(g, "y", 18.5, 14.5, 3.2, 23, 25, "teal", 5, n=8, r_top=1.6)
    P.flat(g, edges(dome2), "teal", 4)
    # Cylinder 2 brass regulator and gauge
    val2 = ngon_prism(g, "y", 18.5, 14.5, 1.4, 25, 28, "rust", 5, n=6)
    P.flat(g, val2, "rust", 5)
    P.flat(g, val2 & (Y == 27), "cyan", 6)

    # Rear retaining strap bar locking cylinders in place (Y=16 to 18)
    strap = box(g, X0, 16, 12, X1, 18, 14, "iron", 5)
    P.flat(g, edges(strap), "iron", 3)
    pnpaint.hazard(g, strap & (coords(g)[2] < 13), period=4, a=("orange", 5), b=("iron", 4))

    # Power supply transformer unit under table (X=13 to 22, Y=5 to 12, Z=4 to 12)
    transformer = box(g, 13, 5, 4, 22, 12, 12, "steel", 4)
    P.flat(g, edges(transformer), "steel", 3)
    # Front amperage display meter on transformer
    amp_meter = box(g, 14, 8, 3, 18, 11, 4, "cyan", 6)
    P.flat(g, amp_meter, "cyan", 6)
    P.flat(g, amp_meter & (coords(g)[1] == 9), "cyan", 7)
    # Heavy copper terminal plugs on transformer front
    dots(g, transformer, "-z", [(19.5, 7.5)], 1.0, "rust", 5)
    dots(g, transformer, "-z", [(19.5, 9.5)], 1.0, "rust", 5)

    # Protective spark shield visor on left of table (X=X0 to X0+1, Y=14 to 22, Z=4 to 12)
    shield = box(g, X0, 14, 4, X0 + 1, 22, 12, "steel", 4)
    P.flat(g, edges(shield), "steel", 3)
    # Dark welding glass viewport in shield
    viewport = box(g, X0, 16, 6, X0 + 1, 20, 10, "iron", 2)
    P.flat(g, viewport, "iron", 1)

    return g


def welding_torch_boom() -> Grid:
    # Articulated boom arm swinging over the table holding the plasma torch (F4, F5)
    bw, bh, bd = 14, 16, 14
    g = Grid(bw, bh, bd)
    X, Y, Z = coords(g)

    # Base swivel mounting post on rear corner (X=10 to 13, Y=0 to 8, Z=10 to 13)
    swivel = box(g, 10, 0, 10, 13, 8, 13, "iron", 5)
    P.flat(g, edges(swivel), "iron", 3)
    dots(g, swivel, "top", [(11.5, 11.5)], 1.2, "gold", 6)

    # Diagonal cantilever boom arm reaching forward and over (from (11, 7, 11) to (4, 14, 4))
    poly_arm = [(7, 10), (7, 13), (14, 4), (14, 2)]
    g.prism("x", poly_arm, 10, 12, P.C("steel", 4))
    m_arm = g.solids[-1].mask(g.shape)
    P.flat(g, edges(m_arm), "steel", 3)

    # Horizontal arm reaching out to torch head
    arm_h = box(g, 3, 13, 2, 11, 15, 5, "rust", 5)
    P.flat(g, edges(arm_h), "rust", 4)

    # Torch head assembly hanging downward at (3 to 6, 6 to 14, 2 to 5)
    torch_body = box(g, 3, 8, 2, 6, 13, 5, "rust", 5)
    P.flat(g, edges(torch_body), "rust", 3)
    # Ceramic heat shield nozzle cone
    nozzle = ngon_prism(g, "y", 4.5, 3.5, 1.8, 4, 8, "rust", 6, n=8, r_top=0.9)
    P.flat(g, edges(nozzle), "rust", 4)
    # Glowing electrode tip
    tip = box(g, 4, 3, 3, 5, 4, 4, "cyan", 7)
    P.flat(g, tip, "cyan", 7)

    return g


def build() -> Asset:
    root = Part("welding-station", cart())
    # Add articulated boom and torch head swinging over the work surface
    root.add(Part("boom", welding_torch_boom(), pivot=(11.5, 0.0, 11.5), at=(11.0, 13.0, 3.0), rot=(0.0, 10.0, 0.0)))
    # Socket for welding sparks right at the torch tip
    # In world space: boom is at (11.0, 13.0, 3.0), torch tip is at local ~(4.5, 3.5, 3.5)
    socket_weld = Socket("socket-weld", at=(15.5, 16.5, 6.5))
    return Asset(
        id="space-props-welding-station",
        pack="space",
        category="props",
        name="Shipyard Plasma Welding Station",
        root=root,
        sockets=[socket_weld],
        pfx=[{"effectId": "rvx-space-weld-sparks", "socket": "socket-weld", "trigger": "idle", "size": 16}],
    )
