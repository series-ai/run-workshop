"""Planets, in the Pirate Nation terrain style.

Four display planets resting in low faceted cradles on the ground. Each
planet is a faceted ball (five stacked frustums with flat poles, true
slopes, never a voxel sphere) with painted bands, continents or cracks;
rings are flat faceted bands of segments, tilted. One generator, four
variants:
- a banded ringed gas giant (warm bands, a red storm, a gold and cream ring)
- an ice planet (white caps, teal cracks, a tilted ring of ice shards)
- a lava planet (dark crust with glowing ember cracks, a scorched cradle)
- a terra planet (sea, green continents, cloud bands) with a small moon
Each planet turns on `idle` (rings and moon turn too). Faces -Z.
"""
import math

import numpy as np

from _life import P, Clip, Grid, Rig, asset, coords, flat_ngon, globe, light_top, mask_of, ngon_y, rock, spin, spots
from pnshapes import cone, ngon_radius
from voxgrid import C


def stepped_globe(g, cx, cy, cz, r):
    """Build two-unit terraces from fixed one-unit voxels."""
    X,Y,Z=coords(g)
    dx=2*np.floor((X-cx)/2)+1
    dy=2*np.floor((Y-cy)/2)+1
    dz=2*np.floor((Z-cz)/2)+1
    m=dx*dx+dy*dy+dz*dz<=r*r
    g.a[m]=C('bone',5)
    return m


def cradle(g: Grid, cx, cz, r, ramp: str, shade: int, seed: int) -> np.ndarray:
    """A low faceted rock ring the planet sits in, with two boulders."""
    m = ngon_y(g, cx, cz, r, 0, 4, ramp, shade, n=9, r_top=r * 0.72)
    P.flat(g, m, ramp, shade)
    P.flat(g, m & (coords(g)[1] > 3), ramp, shade + 1)
    for k, a in enumerate((0.7, 3.6)):
        b = mask_of(g, rock(g, cx + (r - 1) * math.cos(a), cz + (r - 1) * math.sin(a), 1, 3, 5, ramp, shade - 1, n=6, seed=seed + k))
        P.flat(g, b, ramp, shade - 1)
        light_top(g, b, ramp, shade)
    return m


def terra_cradle(g: Grid, cx, cz, r, ramp: str, shade: int, seed: int) -> np.ndarray:
    """A plated steel cradle with a lit rim and two seated sensor rocks."""
    m = ngon_y(g, cx, cz, r, 0, 4, ramp, shade, n=9, r_top=r * 0.72)
    X, Y, Z = coords(g)
    angle = np.arctan2(Z - cz, X - cx)
    sector = np.floor((angle + math.pi) * 9 / (2 * math.pi))
    P.flat(g, m, "steel", 4)
    P.flat(g, m & (Y < 1.5), "steel", 2)
    P.flat(g, m & (Y >= 3), "bone", 5)
    # Nine framed hull plates wrap the visible outer wall.
    wall = m & (Y >= 1.5) & (Y < 3.0)
    seam = np.abs(((angle + math.pi) * 9 / (2 * math.pi)) - (sector + 0.5)) > 0.43
    P.flat(g, wall & seam, "iron", 3)
    plates = wall & ~seam & ((sector.astype(int) % 3) != 1)
    P.flat(g, plates, "bone", 6)
    # A narrow teal service line and copper hazard tabs mark the cradle rim.
    P.flat(g, m & (Y >= 2.5) & (Y < 3.5), "teal", 5)
    tabs = m & (Y >= 2.5) & (Y < 3.5) & ((sector.astype(int) % 3) == 1)
    P.flat(g, tabs, "orange", 5)
    return m


def ring_band(g: Grid, cx, cy, cz, r0, r1, n: int, inner, outer) -> np.ndarray:
    """A flat ring of n segments (1.5 thick) between flat radii r0 and r1."""
    o, i = flat_ngon(cx, cz, r1, n), flat_ngon(cx, cz, r0, n)
    start = len(g.solids)
    for k in range(n):
        g.prism("y", [o[k], o[(k + 1) % n], i[(k + 1) % n], i[k]], cy - 1, cy + 1, C(*inner))
    m = mask_of(g, g.solids[start:])
    d = ngon_radius(g, "y", cx, cz, n)
    P.flat(g, m, *inner)
    P.flat(g, m & (d > (r0 + r1) / 2), *outer)
    return m


def planet_asset(slug: str, name: str, r: float, paint, base, extra=None):
    size = int(2 * r + 36)
    S = (size, int(2 * r + 12), size)
    cx = cz = size / 2
    cy = r + 1.5
    root_g = Grid(*S)
    from _repair_terrain import ground, stone
    ground(root_g,cx,cz,r*.82,base[0],base[1])
    for dx,dz in ((-r*.65,-r*.35),(r*.52,r*.52)):
        stone(root_g,cx+dx,cz+dz,1,3,5,base[0],base[1],round(dx+20))
    body = Grid(*S)
    m=stepped_globe(body,cx,cy,cz,r)
    paint(body,m,cx,cy,cz,r)
    X,Y,Z=coords(body)
    # Soft mineral changes follow the terraces without grid seams.
    surface=m & ((np.floor(X/3)+np.floor(Y/4)+np.floor(Z/3))%7==0)
    if slug=='lava-planet':
        P.flat(body,surface & (body.a==C('iron',4)),'iron',5)
    elif slug=='ice-planet':
        P.flat(body,surface & (body.a==C('bone',6)),'bone',5)
    elif slug=='terra-planet':
        P.flat(body,surface & (body.a==C('sky',3)),'sky',4)
    rig = Rig()
    rig.add(f"{slug}-base", root_g, (cx, 0, cz))
    rig.add(slug, body, (cx, cy, cz), f"{slug}-base")
    clips = {slug: {"rot": spin(8.0, "y", 360)}}
    if extra:
        extra(rig, S, cx, cy, cz, r, clips)
    return asset("terrain-nature", slug, name, rig.root, clips=[Clip("idle", clips)])


# ------------------------------------------------------------ painters
def paint_gas(g, m, cx, cy, cz, r):
    X, Y, Z = coords(g)
    dx, dy, dz = X - cx, Y - cy, Z - cz
    lon = np.arctan2(dx, dz)
    lat = np.arcsin(np.clip(dy / max(r, 1), -1, 1))
    bands = [("rust", 4), ("orange", 5), ("rust", 5), ("orange", 6),
             ("bone", 5), ("orange", 5), ("gold", 6), ("rust", 4), ("orange", 5)]
    lat_wave = 0.022 * np.sin(lon * 2.0) + 0.012 * np.sin(lon * 5.0 + 0.5)
    phase = (lat + math.pi / 2 + lat_wave) * len(bands) / math.pi
    band_index = np.clip(np.floor(phase).astype(int), 0, len(bands) - 1)
    for k, (ramp, shade) in enumerate(bands):
        band = m & (band_index == k)
        P.flat(g, band, ramp, shade)
        local = phase - k
        edge = band & ((local < 0.055) | (local > 0.945))
        P.flat(g, edge, "rust", 4)
        if k in (1, 4, 6, 7):
            cloud = band & (np.abs(local - (0.52 + 0.07 * np.sin(lon * 2.5 + k))) < 0.07)
            cloud &= np.sin(lon * 2.0 + k * 1.7) > 0.3
            P.flat(g, cloud, "gold", 7)
    current = m & (np.abs(lat - (0.23 + 0.055 * np.sin(lon * 2 + 0.4))) < 0.045)
    current |= m & (np.abs(lat - (-0.39 + 0.035 * np.sin(lon * 3))) < 0.035)
    P.flat(g, current, "rust", 7)
    P.flat(g, current & (np.sin(lon * 5 + 0.7) > 0.15), "teal", 5)
    storm_d = np.sqrt(((X - (cx + 1.0)) / 4.4) ** 2 + ((Y - (cy - 3.0)) / 2.4) ** 2)
    storm = m & (Z < cz - r * 0.48) & (storm_d < 1.0)
    P.flat(g, storm, "rust", 2)
    P.flat(g, storm & (storm_d < 0.82), "orange", 5)
    P.flat(g, storm & (storm_d < 0.54), "red", 5)
    P.flat(g, storm & (storm_d < 0.3), "gold", 7)


def paint_ice(g, m, cx, cy, cz, r):
    X,Y,Z=coords(g)
    dx,dy,dz=X-cx,Y-cy,Z-cz
    P.flat(g,m,"cyan",5)
    cap=m & ((dy > r*.35+dx*.2)|(dy < -r*.40+dz*.2))
    P.flat(g,cap,"bone",6)
    # Wide angular floes remain visible on both flat poles.
    seams=(np.abs(dx*.65+dz*.45-dy*.3)<.75)|(np.abs(dz*.7-dx*.25+dy*.4-2)<.75)
    P.flat(g,m & seams,"cyan",3)
    P.flat(g,m & cap & (dx>2)&~seams,"bone",7)
    P.flat(g,m & ~cap & (dx-dz>4)&~seams,"cyan",6)


def paint_lava(g, m, cx, cy, cz, r):
    """A dark iron crust split by wide glowing channels. One channel family
    runs over the top cap, so the glow shows from every view."""
    X,Y,Z=coords(g)
    dx,dy,dz=X-cx,Y-cy,Z-cz
    P.flat(g,m,"iron",4)
    c1=np.abs(dx*.55+dy*.65-dz*.35-1.5*np.sin(dy*.35))
    c2=np.abs(dx*.35-dy*.4+dz*.65+1.3*np.cos(dx*.4))
    c3=np.abs(dx*.7-dz*.7+1.6*np.sin(dz*.3))
    channel=np.minimum(np.minimum(c1,c2),c3+(dy<r*.3)*9)
    P.flat(g,m & (channel>3.4)&(dy>r*.45),"iron",5)
    # Thin dark cracks and a few ember dots break the large crust faces.
    crust=m & (channel>2.4)
    P.flat(g,crust & ((np.floor(dx*.8+dz*.5)%6==0)|(np.floor(dy*.9-dx*.3)%7==0)),"iron",3)
    spots(g,crust,"ember",6,cell=6,r=0.9,chance=3,seed=31)
    P.flat(g,m & (channel<2.4),"rust",4)
    P.flat(g,m & (channel<1.7),"orange",6)
    P.flat(g,m & (channel<.7),"gold",7)


def paint_terra(g, m, cx, cy, cz, r):
    X, Y, Z = coords(g)
    dx, dy, dz = X - cx, Y - cy, Z - cz
    lon = np.arctan2(dx, dz)
    lat = np.arcsin(np.clip(dy / max(r, 1), -1, 1))

    # A clear mid-blue ocean gives the land a strong silhouette.
    P.flat(g, m, "sky", 3)

    # Large land areas have rough edges and small islands.
    continents = ((3.00, 0.34, 0.67, 0.42), (-1.55, -0.42, 0.60, 0.40),
                  (0.02, -0.10, 0.67, 0.47), (1.55, 0.62, 0.58, 0.36),
                  (2.55, -0.64, 0.30, 0.18), (-0.55, 0.68, 0.19, 0.12))
    land = np.zeros_like(m)
    coast = np.zeros_like(m)
    for k, (lo, la, w, h) in enumerate(continents):
        dl = (lon - lo + np.pi) % (2 * np.pi) - np.pi
        # Two waves make rough coast edges at different sizes.
        coast_wave = (0.075 * np.sin(lon * (5 + k) + 0.8 * k)
                      + 0.035 * np.sin(lon * (9 + k) - lat * 7.0))
        d = np.sqrt((dl * np.cos(la) / w) ** 2 + ((lat - la) / h) ** 2)
        edge = 1.0 + coast_wave
        land |= m & (np.abs(lat) < 0.77) & (d <= edge)
        coast |= m & (np.abs(lat) < 0.79) & (d > edge - 0.10) & (d <= edge + 0.02)
    P.flat(g, coast & ~land, "forest", 3)
    P.flat(g, land, "leaf", 5)
    P.flat(g, land & (np.sin(lon * 3.0 + lat * 4.0) > 0.45), "leaf", 6)
    # Sand interiors make the continents read as varied terrain.
    desert = np.zeros_like(m)
    for lo, la, w, h in ((2.90, 0.37, 0.29, 0.16), (-1.45, -0.33, 0.24, 0.15),
                         (0.00, -0.16, 0.29, 0.17), (1.68, 0.55, 0.25, 0.15)):
        dl = (lon - lo + np.pi) % (2 * np.pi) - np.pi
        desert_d = np.sqrt((dl * np.cos(la) / w) ** 2 + ((lat - la) / h) ** 2)
        desert |= land & (desert_d < 1.0)
    P.flat(g, desert, "sand", 5)
    P.flat(g, desert & (np.sin(lon * 4.0 - lat * 3.0) > 0.4), "sand", 6)

    # Small polar ice breaks into a stepped coastline around each pole.
    cap_edge = 0.92 + 0.012 * np.sin(lon * 3.0)
    cap_radius = r * (0.31 + 0.012 * np.sin(lon * 3.0))
    pole_r = np.hypot(dx, dz)
    polar_surface = (np.abs(lat) < 0.985) | (pole_r < cap_radius)
    caps = m & (np.abs(lat) > cap_edge) & polar_surface
    P.flat(g, caps, "bone", 6)
    P.flat(g, caps & (np.abs(lat) > 0.975), "bone", 7)

    # A thin broken cloud belt adds a light mark across the oceans.
    cloud_lat = -0.05 + 0.018 * np.sin(lon * 2.5) + 0.008 * np.sin(lon * 5.0)
    clouds = m & (np.abs(lat - cloud_lat) < 0.03)
    clouds &= (np.sin(lon * 2.5 + 0.5) > -0.2)
    P.flat(g, clouds, "bone", 6)


# ------------------------------------------------------------ extras
def gas_rings(rig, S, cx, cy, cz, r, clips):
    g = Grid(*S)
    from _repair_terrain import layer
    for k in range(22):
        a=k*2*math.pi/22
        rr=r*(1.48+.08*math.sin(k*2))
        layer(g,cx+rr*math.cos(a),cz+rr*math.sin(a),3.1,2.4,cy-1+(k%3)*.6,cy+1+(k%3)*.6,'gold' if k%3 else 'bone',6,seed=k,inset=.5)
        if k%2==0:
            layer(g,cx+(rr+3)*math.cos(a+.05),cz+(rr+3)*math.sin(a+.05),1.5,1.3,cy-1,cy+1,'bone',5,seed=k+2,inset=.4)
    X, Y, Z = coords(g)
    radius = np.hypot(X - cx, Z - cz)
    angle = (np.arctan2(Z - cz, X - cx) + math.pi) % (2 * math.pi)
    segment = np.floor(angle * 14 / (2 * math.pi)).astype(int)
    ring = (g.a!=0)&(radius >= r * 1.3) & (radius <= r * 1.75) & (Y >= cy - 1) & (Y <= cy + 1)
    segment_phase = angle * 14 / (2 * math.pi)
    segment_local = segment_phase - segment
    seam = ring & ((segment_local < 0.045) | (segment_local > 0.955))
    P.flat(g, seam & (g.a!=0), "gold", 4)
    # Small cyan ports sit inside selected plates. Most of the ring stays hull white.
    ports = ring & (radius > r * 1.48) & (radius < r * 1.58)
    ports &= (segment % 4 == 0) & (segment_local > 0.28) & (segment_local < 0.56)
    P.flat(g, ports & (g.a!=0), "gold", 7)
    tabs = ring & (radius > r * 1.62) & (radius < r * 1.69) & (segment % 7 == 0)
    tabs &= (segment_local > 0.18) & (segment_local < 0.33)
    P.flat(g, tabs & (g.a!=0), "rust", 5)
    rig.add("gas-giant-rings", g, (cx, cy, cz), "gas-giant-base", rot=(16.0, 0.0, -10.0))
    clips["gas-giant-rings"] = {"rot": spin(16.0, "y", 360)}


def ice_rings(rig, S, cx, cy, cz, r, clips):
    g = Grid(*S)
    from _repair_terrain import crystal,layer
    for k in range(16):
        a=k*2*math.pi/16
        rr=r*(1.44+.035*(k%3))
        layer(g,cx+rr*math.cos(a),cz+rr*math.sin(a),2.5,2.1,cy-1,cy+1+(k%3)*.7,'cyan',5,seed=k,inset=.6)
    for k in range(8):
        a=2*math.pi*k/8+.3
        rr=r*(1.43+.05*(k%3))
        crystal(g,cx+rr*math.cos(a),cz+rr*math.sin(a),cy,2.1+(k%2),4+(k%3)*2,"cyan",(math.cos(a)*2,math.sin(a)*2))
    rig.add("ice-planet-rings", g, (cx, cy, cz), "ice-planet-base", rot=(-14.0, 0.0, 12.0))
    clips["ice-planet-rings"] = {"rot": spin(12.0, "y", -360)}


def terra_moon(rig, S, cx, cy, cz, r, clips):
    g = Grid(*S)
    X, Y, Z = coords(g)
    mx = cx + r + 7
    my = cy + r * 0.5
    # A steel arm joins the moon and planet. The arm turns with the moon.
    g.prism("z", [(cx + r * 0.90, my - 0.6), (mx - 2.5, my - 0.6),
                  (mx - 2.5, my + 0.6), (cx + r * 0.90, my + 0.6)],
            cz - 0.7, cz + 0.7, C("steel", 4))
    arm = g.solids[-1].mask(g.shape)
    P.flat(g, arm & (Y > my + 0.2), "steel", 6)
    collar = arm & (X >= mx - 4.5) & (X < mx - 3.5)
    P.flat(g, collar, "rust", 5)
    P.flat(g, collar & (Y > my), "orange", 5)

    moon_solids = globe(g, mx, my, cz, 3.5, "gray", 6, n=8)
    m = mask_of(g, moon_solids)
    P.flat(g, m, "gray", 5)
    # Crater rims and dark centers show on each side.
    for side in (-1, 1):
        face = m & ((Z - cz) * side > 0)
        for ox, oy, size in ((-1.0, 0.8, 1.05), (0.9, 0.45, 0.78),
                             (-0.15, -1.1, 0.68)):
            d = np.sqrt((X - (mx + ox)) ** 2 + (Y - (my + oy)) ** 2)
            rim = face & (d >= size * 0.66) & (d <= size * 1.25)
            bowl = face & (d < size * 0.66)
            P.flat(g, rim, "gray", 7)
            P.flat(g, bowl, "gray", 3)
            P.flat(g, bowl & (d < size * 0.34), "steel", 3)
    light_top(g, m & (Y > my + 1.6), "gray", 7)
    rig.add("terra-planet-moon", g, (cx, cy, cz), "terra-planet-base", rot=(0.0, 0.0, -8.0))
    clips["terra-planet-moon"] = {"rot": spin(6.0, "y", 360)}


def build():
    return [
        planet_asset("gas-giant", "Ringed Gas Giant", 15, paint_gas, ("steel", 4, 1), gas_rings),
        planet_asset("ice-planet", "Ice Planet", 12, paint_ice, ("bone", 6, 2), ice_rings),
        planet_asset("lava-planet", "Lava Planet", 12, paint_lava, ("iron", 3, 3)),
        planet_asset("terra-planet", "Terra Planet with Moon", 12, paint_terra, ("steel", 5, 4), terra_moon),
    ]
