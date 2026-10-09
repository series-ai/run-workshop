#!/usr/bin/env python3
"""Check exported prop GLBs for coplanar triangles with different colors.

This is a narrow geometry check. It does not replace a renderer review.
"""

from __future__ import annotations

import argparse
import json
import math
import struct
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence


GLB_JSON = 0x4E4F534A
GLB_BIN = 0x004E4942
TRIANGLES = 4

COMPONENT_FORMAT = {
    5120: ("b", 1),
    5121: ("B", 1),
    5122: ("h", 2),
    5123: ("H", 2),
    5125: ("I", 4),
    5126: ("f", 4),
}
TYPE_WIDTH = {
    "SCALAR": 1,
    "VEC2": 2,
    "VEC3": 3,
    "VEC4": 4,
    "MAT2": 4,
    "MAT3": 9,
    "MAT4": 16,
}


@dataclass(frozen=True)
class Triangle:
    p0: tuple[float, float, float]
    p1: tuple[float, float, float]
    p2: tuple[float, float, float]
    normal: tuple[float, float, float]
    area: float
    material: str
    color: tuple[float, float, float, float]
    primitive: int
    index: int

    @property
    def points(self) -> tuple[tuple[float, float, float], ...]:
        return self.p0, self.p1, self.p2

    @property
    def bounds(self) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
        return (
            tuple(min(p[axis] for p in self.points) for axis in range(3)),
            tuple(max(p[axis] for p in self.points) for axis in range(3)),
        )


@dataclass(frozen=True)
class SurfaceFinding:
    first: Triangle
    second: Triangle
    plane_gap: float
    normal_alignment: float
    overlap_area: float


def _vec_sub(a: Sequence[float], b: Sequence[float]) -> tuple[float, float, float]:
    return a[0] - b[0], a[1] - b[1], a[2] - b[2]


def _cross(a: Sequence[float], b: Sequence[float]) -> tuple[float, float, float]:
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def _dot(a: Sequence[float], b: Sequence[float]) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _length(v: Sequence[float]) -> float:
    return math.sqrt(_dot(v, v))


def _unit(v: Sequence[float]) -> tuple[float, float, float]:
    length = _length(v)
    if length <= 1e-15:
        raise ValueError("cannot normalize a zero vector")
    return v[0] / length, v[1] / length, v[2] / length


def _mat4_apply(matrix: Sequence[float], point: Sequence[float]) -> tuple[float, float, float]:
    # glTF matrices use column-major storage and column vectors.
    x, y, z = point
    return (
        matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
        matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
        matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
    )


def _mat4_multiply(a: Sequence[float], b: Sequence[float]) -> tuple[float, ...]:
    return tuple(
        sum(a[row + 4 * k] * b[k + 4 * column] for k in range(4))
        for column in range(4)
        for row in range(4)
    )


def _node_matrix(node: dict) -> tuple[float, ...]:
    if "matrix" in node:
        return tuple(float(value) for value in node["matrix"])

    translation = node.get("translation", [0.0, 0.0, 0.0])
    rotation = node.get("rotation", [0.0, 0.0, 0.0, 1.0])
    scale = node.get("scale", [1.0, 1.0, 1.0])
    x, y, z, w = (float(value) for value in rotation)
    sx, sy, sz = (float(value) for value in scale)
    tx, ty, tz = (float(value) for value in translation)

    # Rotation matrix from a unit quaternion, then TRS in glTF order.
    return (
        (1 - 2 * (y * y + z * z)) * sx,
        (2 * (x * y + z * w)) * sx,
        (2 * (x * z - y * w)) * sx,
        0.0,
        (2 * (x * y - z * w)) * sy,
        (1 - 2 * (x * x + z * z)) * sy,
        (2 * (y * z + x * w)) * sy,
        0.0,
        (2 * (x * z + y * w)) * sz,
        (2 * (y * z - x * w)) * sz,
        (1 - 2 * (x * x + y * y)) * sz,
        0.0,
        tx,
        ty,
        tz,
        1.0,
    )


def _read_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError("GLB is shorter than its header")
    magic, version, declared_length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2:
        raise ValueError("expected a version 2 GLB")
    if declared_length > len(data):
        raise ValueError("GLB header length exceeds file length")

    json_chunk: bytes | None = None
    binary_chunk = b""
    offset = 12
    while offset + 8 <= len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset:offset + chunk_length]
        if len(chunk) != chunk_length:
            raise ValueError("GLB chunk exceeds file length")
        if chunk_type == GLB_JSON:
            json_chunk = chunk
        elif chunk_type == GLB_BIN:
            binary_chunk = chunk
        offset += chunk_length
    if json_chunk is None:
        raise ValueError("GLB has no JSON chunk")
    return json.loads(json_chunk.decode("utf-8")), binary_chunk


def _accessor_values(gltf: dict, binary: bytes, accessor_index: int) -> list[tuple[float, ...]]:
    accessor = gltf["accessors"][accessor_index]
    if accessor.get("sparse"):
        raise ValueError("sparse accessors are outside this check's scope")
    component_type = accessor["componentType"]
    component_info = COMPONENT_FORMAT.get(component_type)
    if component_info is None:
        raise ValueError(f"unsupported accessor component type {component_type}")
    fmt, component_size = component_info
    component_count = TYPE_WIDTH[accessor["type"]]
    view = gltf["bufferViews"][accessor["bufferView"]]
    view_offset = int(view.get("byteOffset", 0))
    accessor_offset = int(accessor.get("byteOffset", 0))
    stride = int(view.get("byteStride", component_size * component_count))
    start = view_offset + accessor_offset
    count = int(accessor["count"])
    row_width = component_size * component_count
    if stride < row_width:
        raise ValueError("accessor byte stride is shorter than one element")

    values: list[tuple[float, ...]] = []
    for row in range(count):
        row_start = start + row * stride
        row_end = row_start + row_width
        if row_end > len(binary):
            raise ValueError("accessor reads beyond the GLB binary chunk")
        values.append(tuple(struct.unpack_from("<" + fmt * component_count, binary, row_start)))
    return values


def _material_info(gltf: dict, material_index: int) -> tuple[str, tuple[float, float, float, float]]:
    materials = gltf.get("materials", [])
    if material_index < 0 or material_index >= len(materials):
        return f"material-{material_index}", (1.0, 1.0, 1.0, 1.0)
    material = materials[material_index]
    pbr = material.get("pbrMetallicRoughness", {})
    color = tuple(float(value) for value in pbr.get("baseColorFactor", [1.0, 1.0, 1.0, 1.0]))
    if len(color) != 4:
        color = (1.0, 1.0, 1.0, 1.0)
    return material.get("name", f"material-{material_index}"), color


def _material_colors_differ(first: Triangle, second: Triangle) -> bool:
    return any(abs(a - b) > 1e-5 for a, b in zip(first.color, second.color))


def _scene_mesh_instances(gltf: dict) -> Iterable[tuple[int, tuple[float, ...]]]:
    nodes = gltf.get("nodes", [])
    if not nodes:
        for mesh_index in range(len(gltf.get("meshes", []))):
            yield mesh_index, (1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0)
        return

    parents: dict[int, int] = {}
    for parent_index, node in enumerate(nodes):
        for child_index in node.get("children", []):
            parents[int(child_index)] = parent_index

    def world_matrix(node_index: int) -> tuple[float, ...]:
        chain: list[int] = []
        current = node_index
        while current not in chain:
            chain.append(current)
            if current not in parents:
                break
            current = parents[current]
        matrix = (1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0)
        for current in reversed(chain):
            matrix = _mat4_multiply(matrix, _node_matrix(nodes[current]))
        return matrix

    for node_index, node in enumerate(nodes):
        if "mesh" in node:
            yield int(node["mesh"]), world_matrix(node_index)


def _load_triangles(path: Path) -> list[Triangle]:
    gltf, binary = _read_glb(path)
    triangles: list[Triangle] = []
    meshes = gltf.get("meshes", [])
    for mesh_index, matrix in _scene_mesh_instances(gltf):
        if mesh_index >= len(meshes):
            continue
        for primitive_index, primitive in enumerate(meshes[mesh_index].get("primitives", [])):
            if primitive.get("mode", TRIANGLES) != TRIANGLES:
                continue
            attributes = primitive.get("attributes", {})
            if "POSITION" not in attributes:
                continue
            positions = [
                _mat4_apply(matrix, value)
                for value in _accessor_values(gltf, binary, int(attributes["POSITION"]))
            ]
            if "indices" in primitive:
                index_values = _accessor_values(gltf, binary, int(primitive["indices"]))
                indices = [int(value[0]) for value in index_values]
            else:
                indices = list(range(len(positions)))
            material_name, color = _material_info(gltf, int(primitive.get("material", -1)))
            for triangle_start in range(0, len(indices) - 2, 3):
                index0, index1, index2 = indices[triangle_start:triangle_start + 3]
                if max(index0, index1, index2) >= len(positions):
                    raise ValueError("triangle index exceeds POSITION accessor")
                p0, p1, p2 = positions[index0], positions[index1], positions[index2]
                cross = _cross(_vec_sub(p1, p0), _vec_sub(p2, p0))
                cross_length = _length(cross)
                if cross_length <= 1e-12:
                    continue
                triangles.append(Triangle(
                    p0=p0,
                    p1=p1,
                    p2=p2,
                    normal=_unit(cross),
                    area=cross_length * 0.5,
                    material=material_name,
                    color=color,
                    primitive=primitive_index,
                    index=triangle_start // 3,
                ))
    return triangles


def _project(point: Sequence[float], drop_axis: int) -> tuple[float, float]:
    axes = [axis for axis in range(3) if axis != drop_axis]
    return point[axes[0]], point[axes[1]]


def _signed_area(polygon: Sequence[Sequence[float]]) -> float:
    return 0.5 * sum(
        polygon[index][0] * polygon[(index + 1) % len(polygon)][1]
        - polygon[(index + 1) % len(polygon)][0] * polygon[index][1]
        for index in range(len(polygon))
    )


def _ccw(polygon: Sequence[Sequence[float]]) -> list[tuple[float, float]]:
    points = [(float(point[0]), float(point[1])) for point in polygon]
    return points if _signed_area(points) >= 0 else list(reversed(points))


def _line_intersection(a: Sequence[float], b: Sequence[float], c: Sequence[float], d: Sequence[float]) -> tuple[float, float]:
    ab = b[0] - a[0], b[1] - a[1]
    cd = d[0] - c[0], d[1] - c[1]
    denominator = ab[0] * cd[1] - ab[1] * cd[0]
    if abs(denominator) <= 1e-15:
        return b[0], b[1]
    ac = c[0] - a[0], c[1] - a[1]
    t = (ac[0] * cd[1] - ac[1] * cd[0]) / denominator
    return a[0] + t * ab[0], a[1] + t * ab[1]


def _inside(point: Sequence[float], edge_start: Sequence[float], edge_end: Sequence[float]) -> bool:
    edge = edge_end[0] - edge_start[0], edge_end[1] - edge_start[1]
    relative = point[0] - edge_start[0], point[1] - edge_start[1]
    return edge[0] * relative[1] - edge[1] * relative[0] >= -1e-12


def _intersection_area(first: Triangle, second: Triangle) -> float:
    normal = first.normal
    drop_axis = max(range(3), key=lambda axis: abs(normal[axis]))
    subject = _ccw([_project(point, drop_axis) for point in first.points])
    clip = _ccw([_project(point, drop_axis) for point in second.points])
    result = subject
    for edge_index, edge_start in enumerate(clip):
        edge_end = clip[(edge_index + 1) % len(clip)]
        if not result:
            return 0.0
        output: list[tuple[float, float]] = []
        previous = result[-1]
        previous_inside = _inside(previous, edge_start, edge_end)
        for current in result:
            current_inside = _inside(current, edge_start, edge_end)
            if current_inside != previous_inside:
                output.append(_line_intersection(previous, current, edge_start, edge_end))
            if current_inside:
                output.append(current)
            previous, previous_inside = current, current_inside
        result = output
    return abs(_signed_area(result)) if len(result) >= 3 else 0.0


def _plane_gap(first: Triangle, second: Triangle) -> float:
    first_gap = max(abs(_dot(first.normal, _vec_sub(point, first.p0))) for point in second.points)
    second_gap = max(abs(_dot(second.normal, _vec_sub(point, second.p0))) for point in first.points)
    return max(first_gap, second_gap)


def _aabb_overlaps(first: Triangle, second: Triangle, tolerance: float) -> bool:
    first_min, first_max = first.bounds
    second_min, second_max = second.bounds
    return all(
        first_min[axis] <= second_max[axis] + tolerance
        and second_min[axis] <= first_max[axis] + tolerance
        for axis in range(3)
    )


def find_surface_findings(
    triangles: Sequence[Triangle],
    plane_tolerance: float,
    normal_tolerance: float,
    minimum_overlap_area: float,
    minimum_overlap_fraction: float,
    maximum_findings: int,
    target_material: str | None = None,
) -> tuple[list[SurfaceFinding], int]:
    ordered = sorted(enumerate(triangles), key=lambda pair: pair[1].bounds[0][0])
    findings: list[SurfaceFinding] = []
    candidate_pairs = 0
    active: list[tuple[int, Triangle]] = []
    cosine_limit = 1.0 - normal_tolerance

    for ordered_index, (triangle_index, current) in enumerate(ordered):
        current_min_x = current.bounds[0][0]
        active = [
            pair for pair in active
            if pair[1].bounds[1][0] + plane_tolerance >= current_min_x
        ]
        for _prior_index, prior in active:
            if not _material_colors_differ(prior, current):
                continue
            if target_material is not None and target_material not in (prior.material, current.material):
                continue
            if not _aabb_overlaps(prior, current, plane_tolerance):
                continue
            candidate_pairs += 1
            alignment = abs(_dot(prior.normal, current.normal))
            if alignment < cosine_limit:
                continue
            gap = _plane_gap(prior, current)
            if gap > plane_tolerance:
                continue
            overlap_area = _intersection_area(prior, current)
            if overlap_area <= minimum_overlap_area:
                continue
            if overlap_area < min(prior.area, current.area) * minimum_overlap_fraction:
                continue
            findings.append(SurfaceFinding(prior, current, gap, alignment, overlap_area))
            if len(findings) >= maximum_findings:
                return findings, candidate_pairs
        active.append((triangle_index, current))
    return findings, candidate_pairs


def _finding_json(finding: SurfaceFinding) -> dict:
    return {
        "materials": [finding.first.material, finding.second.material],
        "triangles": [
            {"primitive": finding.first.primitive, "index": finding.first.index},
            {"primitive": finding.second.primitive, "index": finding.second.index},
        ],
        "plane_gap": finding.plane_gap,
        "normal_alignment": finding.normal_alignment,
        "projected_overlap_area": finding.overlap_area,
    }


def scan_props(
    props_dir: Path,
    plane_tolerance: float,
    normal_tolerance: float,
    minimum_overlap_area: float,
    minimum_overlap_fraction: float,
    maximum_findings: int,
    target_material: str | None,
) -> dict:
    files = sorted(props_dir.glob("*.glb"))
    file_reports: list[dict] = []
    errors: list[dict] = []
    for path in files:
        try:
            triangles = _load_triangles(path)
            findings, candidate_pairs = find_surface_findings(
                triangles,
                plane_tolerance,
                normal_tolerance,
                minimum_overlap_area,
                minimum_overlap_fraction,
                maximum_findings,
                target_material,
            )
            file_reports.append({
                "file": path.name,
                "triangles": len(triangles),
                "candidate_pairs": candidate_pairs,
                "findings": [_finding_json(finding) for finding in findings],
                "passed": not findings,
            })
        except (OSError, ValueError, KeyError, json.JSONDecodeError, struct.error) as error:
            errors.append({"file": path.name, "error": str(error)})

    finding_count = sum(len(report["findings"]) for report in file_reports)
    return {
        "schema": "inkline.prop-surface-check.v1",
        "scope": {
            "directory": str(props_dir),
            "files": "one mesh file at a time",
            "materials": (
                f"different baseColorFactor values with at least one {target_material} triangle"
                if target_material is not None
                else "all pairs with different baseColorFactor values"
            ),
            "geometry": "near-coplanar triangle pairs with positive projected area overlap",
            "excludes": [
                "curved or merely intersecting surfaces",
                "edge-only or point-only contact",
                "different GLB instances",
                "renderer depth precision and camera-dependent artifacts",
            ],
        },
        "settings": {
            "plane_tolerance_m": plane_tolerance,
            "normal_tolerance": normal_tolerance,
            "minimum_overlap_area_m2": minimum_overlap_area,
            "minimum_overlap_fraction": minimum_overlap_fraction,
            "maximum_findings_per_file": maximum_findings,
            "target_material": target_material,
        },
        "files": file_reports,
        "errors": errors,
        "summary": {
            "files_scanned": len(files),
            "files_with_findings": sum(bool(report["findings"]) for report in file_reports),
            "finding_count": finding_count,
            "error_count": len(errors),
            "passed": not errors and finding_count == 0,
        },
    }


def _markdown(report: dict) -> str:
    summary = report["summary"]
    settings = report["settings"]
    lines = [
        "# INKLINE prop surface verification",
        "",
        f"Result: **{'PASS' if summary['passed'] else 'FAIL'}**.",
        "",
        f"Scanned {summary['files_scanned']} GLB files. Found {summary['finding_count']} near-coplanar differently-colored triangle overlaps in {summary['files_with_findings']} files.",
        "",
        f"The default scan requires one triangle to use `{report['settings']['target_material']}`. Use `--all-materials` for a broad material audit.",
        "",
        f"The check uses a plane gap of `{settings['plane_tolerance_m']}` m, a normal tolerance of `{settings['normal_tolerance']}`, and a minimum projected overlap of `{settings['minimum_overlap_area_m2']}` m².",
        "",
        "The check covers triangle pairs inside one GLB. It does not cover curved contact, volume intersections, edge-only contact, cross-file placement, or renderer depth precision.",
        "",
    ]
    for file_report in report["files"]:
        if not file_report["findings"]:
            continue
        lines.append(f"## {file_report['file']}")
        lines.append("")
        for finding in file_report["findings"]:
            lines.append(
                f"- `{finding['materials'][0]}` triangle {finding['triangles'][0]['index']} overlaps `{finding['materials'][1]}` triangle {finding['triangles'][1]['index']} by `{finding['projected_overlap_area']:.6g}` m² at a plane gap of `{finding['plane_gap']:.6g}` m."
            )
        lines.append("")
    if report["errors"]:
        lines.extend(["## Parse errors", ""])
        lines.extend(f"- `{error['file']}`: {error['error']}" for error in report["errors"])
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--props-dir", type=Path, default=Path("public/assets/props"))
    parser.add_argument("--json", type=Path, dest="json_path")
    parser.add_argument("--markdown", type=Path, dest="markdown_path")
    parser.add_argument("--plane-tolerance", type=float, default=1e-5, help="maximum plane gap in metres")
    parser.add_argument("--normal-tolerance", type=float, default=1e-4, help="one minus the minimum absolute normal dot product")
    parser.add_argument("--minimum-overlap-area", type=float, default=1e-8, help="minimum projected overlap area in square metres")
    parser.add_argument("--minimum-overlap-fraction", type=float, default=0.02, help="minimum overlap as a fraction of the smaller triangle")
    parser.add_argument("--maximum-findings", type=int, default=200, help="maximum findings recorded per file")
    parser.add_argument("--target-material", default="InkMat_SafetyOrange", help="material that must occur in a reported pair")
    parser.add_argument("--all-materials", action="store_true", help="check every pair of differently colored materials")
    args = parser.parse_args()

    if not args.props_dir.is_dir():
        print(f"Prop directory does not exist: {args.props_dir}", file=sys.stderr)
        return 2
    if args.plane_tolerance <= 0 or args.minimum_overlap_area <= 0 or args.maximum_findings <= 0:
        print("Tolerance, overlap area, and maximum findings must be positive", file=sys.stderr)
        return 2
    if not 0 < args.normal_tolerance < 1 or not 0 < args.minimum_overlap_fraction <= 1:
        print("Normal tolerance and overlap fraction are outside their valid ranges", file=sys.stderr)
        return 2

    report = scan_props(
        args.props_dir,
        args.plane_tolerance,
        args.normal_tolerance,
        args.minimum_overlap_area,
        args.minimum_overlap_fraction,
        args.maximum_findings,
        None if args.all_materials else args.target_material,
    )
    encoded = json.dumps(report, indent=2) + "\n"
    if args.json_path:
        args.json_path.parent.mkdir(parents=True, exist_ok=True)
        args.json_path.write_text(encoded, encoding="utf-8")
    if args.markdown_path:
        args.markdown_path.parent.mkdir(parents=True, exist_ok=True)
        args.markdown_path.write_text(_markdown(report), encoding="utf-8")

    summary = report["summary"]
    print(
        f"Prop surface check: {'PASS' if summary['passed'] else 'FAIL'}; "
        f"{summary['files_scanned']} files, {summary['finding_count']} findings, {summary['error_count']} parse errors."
    )
    for file_report in report["files"]:
        if file_report["findings"]:
            print(f"  {file_report['file']}: {len(file_report['findings'])} finding(s)")
    for error in report["errors"]:
        print(f"  {error['file']}: parse error: {error['error']}")
    return 0 if summary["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
