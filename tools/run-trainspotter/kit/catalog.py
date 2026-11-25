"""Everything the kit builds, as lazy entries, and the kit.json catalogue.

Pure Python (no Blender), so the lint and the build share one list. Library
subfolders and file names are descriptive on purpose: the asset library
derives its search keywords from them.

Each family module registers its own models with a module-level `CATALOG`
list, so families can be worked on independently:

    CATALOG = [
        stock("steam-locomotives", express, tier="slice"),
        stock("steam-locomotives", tender),
        plain("stations-platforms", country_station, "buildings", "building", "structures"),
    ]

`stock(...)` entries are vehicles built from a `Stock` (stock.py); `plain(...)`
entries are builders returning (root Part, sockets, clips, data). A builder's
first default argument is its file name. Track pieces come from track.pieces().
"""
from __future__ import annotations

import importlib
import os
import time
from dataclasses import dataclass, field
from typing import Callable

import railkit as RK

HERE = os.path.dirname(os.path.abspath(__file__))
# Family modules in catalogue order; any other kit/*.py with a top-level CATALOG comes after.
FAMILIES = ["track", "civil", "steam", "diesel", "electric", "highspeed", "urban", "commuter", "coaches", "wagons", "loads",
            "structures", "stations", "props", "tokens"]
# Sections of kit.json, and what the helper and the GLB check expect in each.
SECTIONS = ("track", "civil", "stock", "loads", "structures", "props", "tokens")


@dataclass
class Entry:
    folder: str  # library subfolder
    file: str  # file name without .glb
    category: str  # pipeline category (for the asset id)
    scale: str  # scale class written by finalize (lint/glb.mjs)
    make: Callable  # -> (root Part, sockets, clips, data)
    section: str = "track"
    tier: str = "release"  # "slice" entries are also in the slice build
    _built: tuple | None = field(default=None, repr=False)

    def built(self):
        if self._built is None:
            self._built = self.make()
        return self._built

    @property
    def data(self) -> dict:
        return self.built()[3]

    def asset(self) -> RK.Asset:
        root, sockets, clips, _ = self.built()
        return RK.Asset(id=f"{RK.PACK}-{self.category}-{self.file}", pack=RK.PACK, category=self.category, name=self.file,
                        root=root, sockets=sockets, clips=clips, scale=self.scale)


def _name(builder: Callable) -> str:
    return builder.__defaults__[0]  # a builder's first default argument is its file name


def stock(folder: str, builder: Callable, tier: str = "release") -> Entry:
    """A vehicle: builder() returns a Stock."""
    def make(builder=builder):
        from stock import assemble

        return assemble(builder())

    return Entry(folder, _name(builder), "vehicles", "vehicle-large", make, "stock", tier)


def plain(folder: str, builder: Callable, category: str, scale: str, section: str, tier: str = "release") -> Entry:
    """Anything else: builder() returns (root, sockets, clips, data)."""
    if section not in SECTIONS:
        raise ValueError(f"{_name(builder)}: unknown section {section!r}")
    return Entry(folder, _name(builder), category, scale, builder, section, tier)


def _track_entries(tier: str) -> list[Entry]:
    import track as T

    def entry(spec):
        def make(spec=spec):
            root, socks, clips = T.build_piece(spec)
            return root, socks, clips, spec.json()

        return Entry("railway-track", spec.name, "terrain-nature", "tile", make, "track")

    return [entry(s) for s in T.pieces(tier)]


def family_names() -> list[str]:
    found = [f[:-3] for f in os.listdir(HERE) if f.endswith(".py")]
    extra = sorted(n for n in found if n not in FAMILIES and "\nCATALOG" in open(os.path.join(HERE, n + ".py"), encoding="utf-8").read())
    return [n for n in FAMILIES if n in found] + extra


def entries(tier: str = "release", families: list[str] | None = None) -> list[Entry]:
    """Every entry of the given tier; `families` limits it to those modules."""
    out: list[Entry] = []
    for name in families or family_names():
        if name == "track":
            out += _track_entries(tier)
            continue
        mod = importlib.import_module(name)
        for e in getattr(mod, "CATALOG", []):
            if tier == "release" or e.tier == "slice":
                out.append(e)
    seen: dict[str, str] = {}
    for e in out:
        if e.file in seen:
            raise ValueError(f"duplicate model name {e.file!r} ({seen[e.file]} and {e.folder})")
        seen[e.file] = e.folder
    return out


def manifest(items: list[Entry]) -> dict:
    sections: dict[str, dict] = {}
    for e in items:
        sections.setdefault(e.section, {})[e.file] = {"file": f"{e.folder}/{e.file}.glb", "scaleClass": e.scale, **e.data}
    return {
        "version": int(time.time()),
        "contract": {
            "unit": RK.UNIT, "lattice": RK.LATTICE, "railX": RK.RAIL_X, "railTop": RK.RAIL_TOP, "couplerY": RK.COUPLER_Y,
            "floorY": RK.FLOOR_Y, "platformTop": RK.PLATFORM_TOP, "platformEdge": RK.PLATFORM_EDGE, "gaugeHalf": RK.GAUGE_HALF,
            "gaugeTop": RK.GAUGE_TOP, "moveSeconds": RK.MOVE_SECONDS, "moveSpeed": RK.MOVE_SPEED,
        },
        "ramps": RK.ramp_colors(RK.PALETTE["ramps"]),
        "swatches": list(RK.SWATCHES),
        **sections,
    }


def parse_families(argv: list[str]) -> list[str] | None:
    """--family a,b (or repeated --family) from a command line."""
    out: list[str] = []
    for i, a in enumerate(argv):
        if a == "--family":
            out += argv[i + 1].split(",")
    return out or None


if __name__ == "__main__":  # python kit/catalog.py [--tier slice] [--family a,b] [--track-only]: the catalogue as JSON
    import json
    import sys

    tier = sys.argv[sys.argv.index("--tier") + 1] if "--tier" in sys.argv else "release"
    fams = ["track"] if "--track-only" in sys.argv else parse_families(sys.argv)
    json.dump(manifest(entries(tier, fams)), sys.stdout)
