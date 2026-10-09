"""Space industrial cable spool, in the Pirate Nation mecha style.

One iconic shape (rule K3): a heavy starport conduit spool resting on a
welded steel cradle stand. Two large octagonal flanges (F2) in dark iron with
riveted rims and yellow hazard sectors contain thick coiled orange high-voltage
power cable. A heavy copper axle with flanged hubs runs through the centre. An
unspooled length of thick cable trails off the drum onto the ground (F5),
terminating in an oversized industrial copper connector coupling with gold pins.
Detail is paint (S1). Faces -Z.
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnpaint
from _props import dots, ngon_prism
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part

W, H, D = 24, 20, 22
CY, CZ = 10.5, 11.0  # axle centre
R_FLANGE = 8.5
R_DRUM = 4.0
R_CABLE = 7.0


def spool() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)

    # Welded floor base runners (Y=0 to 2)
    runners = box(g, 2, 0, 3, W - 2, 2, D - 3, "iron", 4)
    P.flat(g, edges(runners), "iron", 3)
    pnpaint.hazard(g, runners & (Z < 5), period=4, a=("orange", 5), b=("iron", 4))
    pnpaint.hazard(g, runners & (Z > D - 5), period=4, a=("orange", 5), b=("iron", 4))

    # A-frame cradle supports on left (X=3 to 6) and right (X=W-6 to W-3)
    for x0, x1 in ((3, 6), (W - 6, W - 3)):
        # Triangular upright: wide base (Z=4 to 18), narrow top (Z=9 to 13) at Y=CY
        poly_a = [(0, 4), (0, 18), (CY + 1, 14), (CY + 1, 8)]
        g.prism("x", poly_a, x0, x1, P.C("steel", 4))
        m = g.solids[-1].mask(g.shape)
        for f, fr in facets(g, g.solids[-1:]):
            P.plates(g, f, "steel", 4, size=(6, 6), frame=fr)
        P.flat(g, edges(m), "steel", 3)
        # Bearing block on top
        bearing = box(g, x0 - 0.5, CY - 2, CZ - 2.5, x1 + 0.5, CY + 2, CZ + 2.5, "rust", 4)
        P.flat(g, edges(bearing), "rust", 3)
        dots(g, bearing, "top", [((x0 + x1) / 2, CZ)], 1.0, "gold", 6)

    # Two octagonal spool flanges at X=6 to 8 and X=W-8 to W-6
    for x0, x1 in ((6, 8), (W - 8, W - 6)):
        flange = ngon_prism(g, "x", CY, CZ, R_FLANGE, x0, x1, "iron", 5, n=8)
        P.flat(g, edges(flange), "iron", 3)
        # Hazard stripe wedges on the outer faces
        R = np.hypot(Y - CY, Z - CZ)
        ang = np.arctan2(Z - CZ, Y - CY)
        wedge = flange & (R > 4.5) & (((ang + math.pi) % (math.pi / 2)) < math.pi / 4)
        P.flat(g, wedge, "orange", 5)
        # Outer rim rivet ring
        rim_bolts = flange & (R > R_FLANGE - 1.2)
        P.flat(g, rim_bolts & (np.floor(ang * 4) % 2 == 0), "steel", 6)

    # Heavy copper axle running all the way through (X=2 to W-2)
    axle = ngon_prism(g, "x", CY, CZ, 2.0, 2, W - 2, "rust", 5, n=8)
    P.flat(g, edges(axle), "rust", 4)
    # Axle end caps with big gold locking nuts
    for x0, x1 in ((1, 2), (W - 2, W - 1)):
        nut = ngon_prism(g, "x", CY, CZ, 1.4, x0, x1, "rust", 6, n=8)
        P.flat(g, nut, "rust", 6)

    # Core spool drum inner cylinder
    drum = ngon_prism(g, "x", CY, CZ, R_DRUM, 8, W - 8, "steel", 4, n=12)
    P.flat(g, drum, "steel", 4)

    # Wound cable bundle between the flanges (X=8 to W-8, R from R_DRUM to R_CABLE)
    cable_mask = ngon_prism(g, "x", CY, CZ, R_CABLE, 8, W - 8, "orange", 5, n=16)
    cable_outer = cable_mask & ~drum
    P.flat(g, cable_outer, "orange", 5)
    # Cable ribbed wraps along X: 1-voxel wide grooves
    P.flat(g, cable_outer & (np.floor(X) % 2 == 0), "orange", 6)
    P.flat(g, cable_outer & (np.floor(X) % 4 == 0), "rust", 4)
    # Concentric winding layer lines
    R_grid = np.hypot(Y - CY, Z - CZ)
    P.flat(g, cable_outer & (np.abs(R_grid - 5.5) < 0.5), "iron", 4)

    return g


def loose_cable() -> Grid:
    # Trailing uncoiled cable that sweeps down to the floor with a connector plug (F5)
    gw, gh, gd = 10, 10, 14
    g = Grid(gw, gh, gd)
    X, Y, Z = coords(g)

    # Curved cable body coming down from drum (top back) to floor (front)
    # Sweeping from (3, 8, 12) down to (5, 1, 3)
    pts = [
        (3.0, 8.5, 12.5),
        (3.5, 6.0, 10.5),
        (4.0, 3.5, 8.0),
        (4.5, 1.5, 5.5),
        (5.0, 1.0, 3.0),
    ]
    for (x0, y0, z0), (x1, y1, z1) in zip(pts, pts[1:]):
        steps = 8
        for s in range(steps + 1):
            t = s / steps
            cx = x0 + t * (x1 - x0)
            cy = y0 + t * (y1 - y0)
            cz = z0 + t * (z1 - z0)
            seg = box(g, cx - 1.2, cy - 1.2, cz - 1.2, cx + 1.2, cy + 1.2, cz + 1.2, "orange", 5)
            P.flat(g, seg & (coords(g)[1] > cy), "orange", 6)

    # Heavy connector head plug at the end (X=3 to 7, Y=0 to 3, Z=0 to 3)
    plug = box(g, 3, 0, 0, 7, 3, 3, "rust", 5)
    P.flat(g, edges(plug), "rust", 3)
    # Gold terminal pins extending forward from plug
    pins = box(g, 4, 1, 0, 6, 2, 1, "gold", 6)
    P.flat(g, pins, "gold", 7)
    # Status LED on connector
    dots(g, plug, "-z", [(5.0, 1.5)], 0.8, "cyan", 6)

    return g


def build() -> Asset:
    root = Part("cable-spool", spool())
    # Attach trailing loose cable off the front right of the spool
    root.add(Part("loose-cable", loose_cable(), pivot=(3.0, 8.5, 12.5), at=(11.0, 3.0, float(D) - 12.0), rot=(0.0, 12.0, 0.0)))
    return Asset(id="space-props-cable-spool", pack="space", category="props", name="Heavy Industrial Cable Spool", root=root)
