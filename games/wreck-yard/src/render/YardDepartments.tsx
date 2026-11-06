import { useEffect, useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DEPARTMENTS, DEPARTMENT_DIRECTORY, DEPARTMENT_RENDER_BUDGET, type Department, type DepartmentPoint } from '../scene/departments';
import { FLOOR_Y, getTerrainHeightAt } from '../sim/constants';
import type { YardRender } from './presentation';
import { ART_STYLE } from './style/artStyle';

const INK = ART_STYLE.palette.ink;
const BONE = '#efe4cc';
const FONT = 'Arial, Helvetica, sans-serif';
const ATLAS_SIZE = DEPARTMENT_RENDER_BUDGET.atlasSize;
const noRaycast = () => null;
type Tile = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
const DIRECTORY_TILE: Tile = { x: 0, y: 768, width: 1024, height: 768 };
const signTile = (index: number): Tile => ({ x: index % 4 * 512, y: Math.floor(index / 4) * 256, width: 512, height: 256 });
const numberTile = (index: number): Tile => ({ x: 1024 + index % 4 * 256, y: 768 + Math.floor(index / 4) * 256, width: 256, height: 256 });

function fitText(context: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, width: number, horizontalScale = 1) {
  context.font = `900 ${size}px ${FONT}`;
  while (context.measureText(text).width * horizontalScale > width && size > 12) {
    size -= 1;
    context.font = `900 ${size}px ${FONT}`;
  }
  context.save();
  context.translate(x, y);
  context.scale(horizontalScale, 1);
  context.fillText(text, 0, 0);
  context.restore();
}

function paintDepartment(context: CanvasRenderingContext2D, department: Department, tile: Tile) {
  context.save();
  context.translate(tile.x, tile.y);
  const accent = ART_STYLE.palette[department.accent];
  const aspect = department.sign.size[0] / department.sign.size[1];
  const textScale = (tile.width / tile.height) / aspect;
  const numberWidth = 98 * textScale;
  const titleX = numberWidth + 28;
  const lines = aspect >= 3 ? [department.title.toUpperCase()] : department.headline.filter(Boolean);
  context.fillStyle = INK;
  context.fillRect(2, 2, 508, 252);
  context.fillStyle = accent;
  context.fillRect(10, 10, numberWidth, 236);
  context.fillRect(10 + numberWidth, 10, 492 - numberWidth, 8);
  context.fillStyle = INK;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  fitText(context, department.number, 10 + numberWidth / 2, 128, 86, numberWidth - 16 * textScale, textScale);
  context.textAlign = 'left';
  context.fillStyle = BONE;
  lines.forEach((line, index) => {
    fitText(context, line, titleX, lines.length === 1 ? 128 : 104 + index * 48, aspect >= 3 ? 72 : 40, 484 - titleX, textScale);
  });
  context.fillStyle = '#7d8c96';
  for (const [x, y] of [[17, 17], [495, 17], [17, 239], [495, 239]]) {
    context.beginPath();
    context.ellipse(x!, y!, 3 * textScale, 3, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function paintDirectory(context: CanvasRenderingContext2D) {
  context.save();
  context.translate(DIRECTORY_TILE.x, DIRECTORY_TILE.y);
  context.fillStyle = INK;
  context.fillRect(4, 4, 1016, 760);
  context.strokeStyle = BONE;
  context.lineWidth = 5;
  context.strokeRect(20, 20, 984, 728);
  context.fillStyle = ART_STYLE.palette.signalOrange;
  context.fillRect(20, 20, 984, 126);
  context.fillStyle = INK;
  context.textBaseline = 'middle';
  context.textAlign = 'left';
  context.font = `900 63px ${FONT}`;
  context.fillText(DEPARTMENT_DIRECTORY.title, 40, 83);
  DEPARTMENTS.forEach((department, index) => {
    const x = 42 + Math.floor(index / 6) * 494;
    const y = 188 + index % 6 * 85;
    context.fillStyle = ART_STYLE.palette[department.accent];
    context.font = `900 45px ${FONT}`;
    context.fillText(department.number, x, y + 14);
    context.fillStyle = BONE;
    fitText(context, department.title.toUpperCase(), x + 69, y + 4, 23, 390);
    context.fillStyle = '#b2a18a';
    context.font = `700 17px ${FONT}`;
    context.fillText(department.zone, x + 70, y + 32);
    context.fillStyle = '#39444b';
    context.fillRect(x, y + 58, 451, 2);
  });
  context.font = `900 23px ${FONT}`;
  context.textAlign = 'right';
  context.fillStyle = ART_STYLE.palette.signalOrange;
  context.fillText('NORTH  ↑', 977, 718);
  context.restore();
}

function createAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('WRECK_YARD_DEPARTMENT_ATLAS_CONTEXT');
  DEPARTMENTS.forEach((department, index) => {
    paintDepartment(context, department, signTile(index));
    const tile = numberTile(index);
    context.save();
    context.translate(tile.x, tile.y);
    context.fillStyle = BONE;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `900 169px ${FONT}`;
    context.fillText(department.number, 128, 130);
    context.globalCompositeOperation = 'destination-out';
    for (const x of [70, 128, 186]) context.fillRect(x, 32, 5, 194);
    context.restore();
  });
  paintDirectory(context);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'yard-department-atlas-14-tiles';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  texture.userData = { departments: DEPARTMENTS, tiles: DEPARTMENT_RENDER_BUDGET.atlasTiles, width: ATLAS_SIZE, height: ATLAS_SIZE };
  return texture;
}

function atlasUv(geometry: THREE.BufferGeometry, tile: Tile) {
  const uv = geometry.getAttribute('uv');
  for (let index = 0; index < uv.count; index += 1) {
    uv.setXY(index, (tile.x + uv.getX(index) * tile.width) / ATLAS_SIZE, 1 - (tile.y + (1 - uv.getY(index)) * tile.height) / ATLAS_SIZE);
  }
}

function floorPlane(center: DepartmentPoint, size: readonly [number, number], yaw: number, tile: Tile): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(size[0], size[1], Math.ceil(size[0]), Math.ceil(size[1]));
  atlasUv(geometry, tile);
  geometry.rotateX(-Math.PI / 2);
  geometry.rotateY(yaw);
  geometry.translate(center[0], 0, center[1]);
  const position = geometry.getAttribute('position');
  for (let index = 0; index < position.count; index += 1) {
    position.setY(index, FLOOR_Y + getTerrainHeightAt(position.getX(index), position.getZ(index)) + 0.012);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function mergeParts(parts: THREE.BufferGeometry[], name: string): THREE.BufferGeometry {
  const geometry = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  if (!geometry) throw new Error('WRECK_YARD_DEPARTMENT_MERGE_FAILED');
  geometry.name = name;
  return geometry;
}

function paintGeometry(): THREE.BufferGeometry {
  const vertices: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();
  function polygon(points: readonly DepartmentPoint[], shade: string) {
    color.set(shade);
    for (let index = 1; index < points.length - 1; index += 1) {
      for (const point of [points[0]!, points[index]!, points[index + 1]!]) {
        vertices.push(point[0], FLOOR_Y + getTerrainHeightAt(point[0], point[1]) + 0.009, point[1]);
        colors.push(color.r, color.g, color.b);
      }
    }
  }
  function bar(x: number, z: number, width: number, depth: number, shade: string) {
    polygon([[x - width / 2, z - depth / 2], [x - width / 2, z + depth / 2], [x + width / 2, z + depth / 2], [x + width / 2, z - depth / 2]], shade);
  }
  function brackets(center: DepartmentPoint, size: readonly [number, number], shade: string) {
    for (const xSide of [-1, 1]) {
      for (const zSide of [-1, 1]) {
        const x = center[0] + xSide * size[0] / 2;
        const z = center[1] + zSide * size[1] / 2;
        bar(x - xSide * 0.24, z, 0.58, 0.09, shade);
        bar(x, z - zSide * 0.24, 0.09, 0.58, shade);
      }
    }
  }
  DEPARTMENTS.forEach((department) => {
    const { center, size } = department.paint;
    const accent = ART_STYLE.palette[department.accent];
    brackets(center, size, accent);
    const dx = department.target[0] - center[0];
    const dz = department.target[1] - center[1];
    const length = Math.hypot(dx, dz);
    if (length < 0.1) return;
    const nx = dx / length;
    const nz = dz / length;
    const x = center[0] + nx * (size[0] * 0.5 + 0.65);
    const z = center[1] + nz * (size[1] * 0.5 + 0.65);
    polygon([[x + nx * 0.5, z + nz * 0.5], [x - nx * 0.2 + nz * 0.38, z - nz * 0.2 - nx * 0.38], [x - nx * 0.2 - nz * 0.38, z - nz * 0.2 + nx * 0.38]], accent);
  });
  brackets([-8.5, 20.8], [5.4, 2.25], ART_STYLE.palette.teal);
  brackets([-6, 13.6], [4.6, 5.5], ART_STYLE.palette.mustard);
  brackets([2.95, 0.55], [6.3, 5.3], ART_STYLE.palette.teal);
  for (let z = -14; z <= 13; z += 2.5) {
    for (const x of [11.35, 16.65]) bar(x, z, 0.12, 1.2, ART_STYLE.palette.mustard);
  }
  for (let z = -10; z < 14; z += 2) bar(-17.5, z, 0.1, 0.8, ART_STYLE.palette.teal);
  for (const x of [-9.8, -9, -8.2, -7.4]) {
    polygon([[x, 22.15], [x + 0.2, 22.15], [x + 0.52, 22.6], [x + 0.32, 22.6]], ART_STYLE.palette.teal);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.name = 'yard-department-work-brackets-arrows-and-lanes';
  return geometry;
}

function createDepartmentAssets() {
  const atlas = createAtlas();
  const material = new THREE.MeshBasicMaterial({ map: atlas, alphaTest: 0.15, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const signs = mergeParts(DEPARTMENTS.map((department, index) => {
    const geometry = new THREE.PlaneGeometry(...department.sign.size);
    atlasUv(geometry, signTile(index));
    geometry.rotateY(department.sign.yaw);
    geometry.translate(department.sign.center[0], department.sign.center[1], department.sign.center[2]);
    return geometry;
  }), 'yard-department-fixed-panel-geometry');
  const floor = mergeParts([
    ...DEPARTMENTS.map((department, index) => floorPlane(department.paint.center, [1.65, 1.65], department.paint.yaw, numberTile(index))),
    floorPlane(DEPARTMENT_DIRECTORY.center, DEPARTMENT_DIRECTORY.size, DEPARTMENT_DIRECTORY.yaw, DIRECTORY_TILE),
  ], 'yard-department-floor-stencils-and-directory-geometry');
  const paint = paintGeometry();
  const paintMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  return { atlas, material, signs, floor, paint, paintMaterial };
}

export function YardDepartments({ renderRef: _renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  const assets = useMemo(createDepartmentAssets, []);
  useEffect(() => () => {
    assets.atlas.dispose();
    assets.material.dispose();
    assets.paintMaterial.dispose();
    assets.signs.dispose();
    assets.floor.dispose();
    assets.paint.dispose();
  }, [assets]);

  return (
    <group name="yard-departments" userData={{ departments: DEPARTMENTS, directory: DEPARTMENT_DIRECTORY, budget: DEPARTMENT_RENDER_BUDGET, staticAtlas: true }}>
      <mesh name="yard-department-panels" geometry={assets.signs} material={assets.material} raycast={noRaycast} userData={{ departmentIds: DEPARTMENTS.map((entry) => entry.id), mountedDecoration: true }} />
      <mesh name="yard-department-floor-labels" geometry={assets.floor} material={assets.material} raycast={noRaycast} userData={{ departmentIds: DEPARTMENTS.map((entry) => entry.id), nonSolidDecoration: true }} />
      <mesh name="yard-department-paint" geometry={assets.paint} material={assets.paintMaterial} raycast={noRaycast} userData={{ nonSolidDecoration: true }} />
      <group name="yard-department-directory" position={[DEPARTMENT_DIRECTORY.center[0], FLOOR_Y + 0.012, DEPARTMENT_DIRECTORY.center[1]]} userData={{ text: DEPARTMENT_DIRECTORY.title, entries: DEPARTMENTS, size: DEPARTMENT_DIRECTORY.size, nonSolidDecoration: true }} />
      {DEPARTMENTS.map((department) => <group key={department.id} name={`yard-department-${department.id}`} position={[...department.sign.center]} userData={{ departmentId: department.id, text: department.title, department }} />)}
    </group>
  );
}
