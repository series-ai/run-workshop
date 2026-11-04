import { beginPhase, endPhase, perfCount } from '../perf/recorder';
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { portalExitClipPlane3D, portalTransformMatrix3D, type PortalRenderEndName } from '@series-inc/rundot-syncplay/physics/3d';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { VOXEL_SIZE } from '../sim/constants';
import { crateTone, toneOfFaces } from '../sim/crateArt';
import { voxelStats } from '../sim/physics';
import type { CrateArrow, CrateFace, YardBody } from '../sim/state';
import type { YardRender } from './presentation';
import { getToonGradientMap } from './style/toonMaterial';
import { CRATE_APPEARANCE } from './crateAppearance';
import { RETURNS_PAIR } from '../sim/returns';
import { portalEndClipPlane } from './portalScene';
import { createGravitySurfaceUniforms, createGravityToonMaterial, type GravitySurfaceUniforms } from './gravitySurface';
import { useReducedMotionRef } from './reducedMotion';

const CRATE_VOXELS = 12;
const MAX_INSTANCED_CRATES = 512;
const CRATE_SIZE = CRATE_VOXELS * VOXEL_SIZE;
const CRATE_BODY_SIZE = CRATE_SIZE - 0.016;
const FRAME_WIDTH = 0.064;
/** One atlas cell is this many pixels square. */
const CELL_PX = 512;
/** Cells are inset this far from their UV edges on both axes, so that mip levels do not bleed a neighbour in. */
const CELL_INSET_PX = 16;
const noRaycast = () => null;

/** The look of one face. Each cell of the crate atlas draws one look. */
export type CrateCell = 'plain-light' | 'dark' | `light-${CrateArrow}`;
/** The cells that one crate shows: its east and south faces, and its plain faces. */
export interface CrateSkin {
  readonly east: CrateCell;
  readonly south: CrateCell;
  readonly rest: CrateCell;
  /** The frame follows the face that carries the art: the south face on the front row. */
  readonly frame: 'light' | 'dark';
}
type SkinShape = Pick<CrateSkin, 'east' | 'south' | 'rest'>;

interface BoardColors { readonly wood: string; readonly grain: string; readonly seam: string; readonly frame: string }
/** The label and arrow. `turn` is in radians, clockwise on screen, from an arrow that points up. */
interface CrateMarking { readonly turn: number; readonly caption: string }
interface CellStyle { readonly boards: BoardColors; readonly marking?: CrateMarking }

const LIGHT_BOARDS: BoardColors = {
  wood: CRATE_APPEARANCE.wood, grain: CRATE_APPEARANCE.grain, seam: CRATE_APPEARANCE.seam, frame: CRATE_APPEARANCE.frame,
};
const DARK_BOARDS: BoardColors = {
  wood: CRATE_APPEARANCE.darkWood, grain: CRATE_APPEARANCE.darkGrain, seam: CRATE_APPEARANCE.darkSeam, frame: CRATE_APPEARANCE.darkFrame,
};
/** One style per cell. A cell without a marking reads as plain boards. */
const CELL_STYLE: Record<CrateCell, CellStyle> = {
  'plain-light': { boards: LIGHT_BOARDS },
  dark: { boards: DARK_BOARDS },
  'light-up': { boards: LIGHT_BOARDS, marking: { turn: 0, caption: 'THIS SIDE UP' } },
  'light-left': { boards: LIGHT_BOARDS, marking: { turn: -Math.PI / 2, caption: 'THIS WAY' } },
  'light-right': { boards: LIGHT_BOARDS, marking: { turn: Math.PI / 2, caption: 'THIS WAY' } },
};
/** The atlas order. The position of a cell here is its place in the texture. */
const CRATE_CELLS = ['plain-light', 'dark', 'light-up', 'light-left', 'light-right'] as const;
/** Fails to compile when a cell has no place in the atlas. */
const ATLAS_HOLDS_EVERY_CELL: [Exclude<CrateCell, (typeof CRATE_CELLS)[number]>] extends [never] ? true : false = true;
void ATLAS_HOLDS_EVERY_CELL;
/** The V range of a cell, inset on the same terms as the U range, so that the art keeps its proportions. */
const CELL_V_RANGE: readonly [number, number] = [CELL_INSET_PX / CELL_PX, 1 - CELL_INSET_PX / CELL_PX];

/** True only for a whole, solid 12-cubed shipping crate. */
export function isIntactShippingCrate(body: YardBody): boolean {
  if (body.renderModel !== 'shipping-crate') return false;
  if (body.dims.x !== CRATE_VOXELS || body.dims.y !== CRATE_VOXELS || body.dims.z !== CRATE_VOXELS) return false;
  const volume = CRATE_VOXELS ** 3;
  return body.voxels.length === volume && voxelStats(body.voxels, body.dims).occupiedCount === volume;
}

/** The cell that draws one visible face. */
function cellOf(face: CrateFace): CrateCell {
  return face.tone === 'dark' ? 'dark' : `light-${face.arrow}`;
}

/** The cells of one storage crate. Its plain faces follow the crate tone. */
export function crateSkin(body: YardBody): CrateSkin {
  const faces = body.crateFaces;
  if (!faces) throw new Error(`WRECK_YARD_CRATE_FACES_MISSING:${body.id}`);
  return {
    east: cellOf(faces.east),
    south: cellOf(faces.south),
    rest: crateTone(faces) === 'dark' ? 'dark' : 'plain-light',
    frame: faces.frame,
  };
}

/** Keep the GPU instance count bounded. Crates above this limit use the voxel renderer. */
export function instancedShippingCrateIds(bodies: readonly YardBody[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const body of bodies) {
    if (ids.size >= MAX_INSTANCED_CRATES) break;
    if (isIntactShippingCrate(body)) ids.add(body.id);
  }
  return ids;
}

/** The U range of one atlas cell. The range is inset so that neighbouring cells do not bleed in. */
export function cellUv(cell: CrateCell): readonly [number, number] {
  const index = CRATE_CELLS.indexOf(cell);
  if (index < 0) throw new Error(`WRECK_YARD_CRATE_CELL_MISSING:${cell}`);
  const width = CRATE_CELLS.length * CELL_PX;
  return [(index * CELL_PX + CELL_INSET_PX) / width, ((index + 1) * CELL_PX - CELL_INSET_PX) / width];
}

/** Draws one atlas cell at the origin of the context. */
function drawCrateCell(context: CanvasRenderingContext2D, { boards, marking }: CellStyle): void {
  context.fillStyle = boards.wood;
  context.fillRect(0, 0, CELL_PX, CELL_PX);
  context.fillStyle = boards.seam;
  for (let y = 102; y < CELL_PX; y += 102) context.fillRect(0, y, CELL_PX, 3);
  context.globalAlpha = 0.12;
  context.fillStyle = boards.grain;
  for (let y = 10; y < CELL_PX; y += 24) context.fillRect(0, y, CELL_PX, 2);
  context.globalAlpha = 1;

  context.strokeStyle = boards.frame;
  context.lineWidth = 12;
  context.strokeRect(13, 13, 486, 486);
  context.strokeStyle = boards.seam;
  context.lineWidth = 3;
  context.strokeRect(28, 28, 456, 456);

  if (!marking) return;
  context.fillStyle = CRATE_APPEARANCE.label;
  context.fillRect(46, 40, 420, 96);
  context.fillStyle = CRATE_APPEARANCE.fragile;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = 'bold 58px Arial, sans-serif';
  context.fillText('FRAGILE', 256, 88, 396);

  // The arrow spans about 40% of the face height, with its caps. It turns about its own centre.
  context.save();
  context.translate(256, 250);
  context.rotate(marking.turn);
  context.translate(-256, -250);
  context.strokeStyle = CRATE_APPEARANCE.ink;
  context.lineWidth = 28;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(256, 340);
  context.lineTo(256, 160);
  context.lineTo(180, 236);
  context.moveTo(256, 160);
  context.lineTo(332, 236);
  context.stroke();
  context.restore();

  context.fillStyle = CRATE_APPEARANCE.ink;
  context.font = 'bold 36px Arial, sans-serif';
  context.fillText(marking.caption, 256, 388, 420);
  for (let index = 0; index < 15; index += 1) {
    const width = index % 3 === 0 ? 5 : 2;
    context.fillRect(106 + index * 20, 466, width, 10);
  }
}

/** One texture with every cell side by side. Each face picks its cell with its UVs. */
function crateAtlasTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = CELL_PX * CRATE_CELLS.length;
  canvas.height = CELL_PX;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('WRECK_YARD_CRATE_TEXTURE_CONTEXT');
  CRATE_CELLS.forEach((cell, index) => {
    context.save();
    context.translate(index * CELL_PX, 0);
    drawCrateCell(context, CELL_STYLE[cell]);
    context.restore();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

interface CrateMaterials {
  readonly atlas: THREE.CanvasTexture;
  readonly body: THREE.MeshToonMaterial;
  readonly frame: Record<'light' | 'dark', THREE.MeshToonMaterial>;
}

function createCrateMaterials(): CrateMaterials {
  const atlas = crateAtlasTexture();
  return {
    atlas,
    body: new THREE.MeshToonMaterial({ color: '#ffffff', map: atlas, gradientMap: getToonGradientMap() }),
    frame: {
      light: new THREE.MeshToonMaterial({ color: CRATE_APPEARANCE.frame, gradientMap: getToonGradientMap() }),
      dark: new THREE.MeshToonMaterial({ color: CRATE_APPEARANCE.darkFrame, gradientMap: getToonGradientMap() }),
    },
  };
}

function skinKey(skin: SkinShape): string {
  return `${skin.east}|${skin.south}|${skin.rest}`;
}

/**
 * The cell of one face, from its outward normal. The east and south faces carry
 * the art. Every other face takes the plain tone of the crate, so that a cut dark
 * crate keeps its tone on all faces.
 */
function cellOfNormal(skin: SkinShape, nx: number, nz: number): CrateCell {
  if (nx > 0.5) return skin.east;
  if (nz > 0.5) return skin.south;
  return skin.rest;
}

/** A copy of the box. Each face samples the cell that its normal selects. */
export function skinnedBox(base: THREE.BoxGeometry, skin: SkinShape): THREE.BufferGeometry {
  const geometry = base.clone();
  const uv = geometry.getAttribute('uv');
  const normal = geometry.getAttribute('normal');
  if (!(uv instanceof THREE.BufferAttribute) || !(normal instanceof THREE.BufferAttribute)) {
    throw new Error('WRECK_YARD_CRATE_BOX_ATTRIBUTES');
  }
  const [vStart, vEnd] = CELL_V_RANGE;
  for (let index = 0; index < uv.count; index += 1) {
    const cell = cellOfNormal(skin, normal.getX(index), normal.getZ(index));
    const [uStart, uEnd] = cellUv(cell);
    uv.setXY(index, uStart + (uEnd - uStart) * uv.getX(index), vStart + (vEnd - vStart) * uv.getY(index));
  }
  uv.needsUpdate = true;
  return geometry;
}

/** Builds one geometry for every skin that the cells allow, once at mount. The GPU uploads a geometry only when a batch draws it. */
function allSkinGeometries(base: THREE.BoxGeometry): Map<string, THREE.BufferGeometry> {
  const geometries = new Map<string, THREE.BufferGeometry>();
  for (const east of CRATE_CELLS) {
    for (const south of CRATE_CELLS) {
      // The plain faces follow the crate tone, by the same rule that crateSkin uses.
      const tone = toneOfFaces(east === 'dark' ? 'dark' : 'light', south === 'dark' ? 'dark' : 'light');
      const rest: CrateCell = tone === 'dark' ? 'dark' : 'plain-light';
      const skin = { east, south, rest };
      geometries.set(skinKey(skin), skinnedBox(base, skin));
    }
  }
  return geometries;
}

function crateFrameGeometry(): THREE.BufferGeometry {
  const half = CRATE_SIZE / 2;
  const inset = half - FRAME_WIDTH / 2;
  const parts: { size: readonly [number, number, number]; position: readonly [number, number, number] }[] = [];

  for (const x of [-inset, inset]) {
    for (const z of [-inset, inset]) parts.push({ size: [FRAME_WIDTH, CRATE_SIZE, FRAME_WIDTH], position: [x, 0, z] });
  }
  for (const y of [-inset, inset]) {
    for (const z of [-inset, inset]) parts.push({ size: [CRATE_SIZE, FRAME_WIDTH, FRAME_WIDTH], position: [0, y, z] });
    for (const x of [-inset, inset]) parts.push({ size: [FRAME_WIDTH, FRAME_WIDTH, CRATE_SIZE], position: [x, y, 0] });
  }
  for (const z of [-inset, inset]) parts.push({ size: [CRATE_SIZE * 0.88, FRAME_WIDTH * 0.52, FRAME_WIDTH * 0.28], position: [0, 0, z] });

  const geometries = parts.map(({ size, position }) => {
    const geometry = new THREE.BoxGeometry(...size);
    geometry.translate(...position);
    return geometry;
  });
  const merged = mergeGeometries(geometries, false);
  for (const geometry of geometries) geometry.dispose();
  if (!merged) throw new Error('WRECK_YARD_CRATE_FRAME_GEOMETRY');
  merged.computeBoundingSphere();
  return merged;
}

function crateTint(body: YardBody): THREE.Color {
  let hash = 2166136261;
  for (let index = 0; index < body.id.length; index += 1) {
    hash = Math.imul(hash ^ body.id.charCodeAt(index), 16777619);
  }
  const variation = (hash >>> 0) % 5;
  const base = 0xf2efeb;
  const shade = 1 - variation * 0.018;
  return new THREE.Color(base).multiplyScalar(shade);
}

interface CrateGroup { readonly key: string; readonly skin: CrateSkin; readonly crates: YardBody[] }

/** One batch per storage bay and skin. Each batch is two instanced meshes. */
function groupCrates(crates: readonly YardBody[]): CrateGroup[] {
  const groups = new Map<string, CrateGroup>();
  for (const body of crates) {
    const skin = crateSkin(body);
    const bay = body.storageBay === 'returns' ? 'returns' : 'storage';
    const key = `${bay}|${skinKey(skin)}|${skin.frame}`;
    const group = groups.get(key) ?? { key, skin, crates: [] };
    group.crates.push(body);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function ShippingCrates({ bodies, renderRef }: {
  bodies: readonly YardBody[];
  renderRef: MutableRefObject<YardRender | null>;
}) {
  const boxGeometry = useMemo(() => new THREE.BoxGeometry(CRATE_BODY_SIZE, CRATE_BODY_SIZE, CRATE_BODY_SIZE), []);
  const frameGeometry = useMemo(crateFrameGeometry, []);
  const materials = useMemo(createCrateMaterials, []);
  const skinGeometries = useMemo(() => allSkinGeometries(boxGeometry), [boxGeometry]);
  const ids = useMemo(() => instancedShippingCrateIds(bodies), [bodies]);
  const crates = useMemo(() => bodies.filter((body) => ids.has(body.id)), [bodies, ids]);
  const groups = useMemo(() => groupCrates(crates), [crates]);
  useEffect(() => () => {
    boxGeometry.dispose();
    frameGeometry.dispose();
    materials.atlas.dispose();
    materials.body.dispose();
    materials.frame.light.dispose();
    materials.frame.dark.dispose();
    for (const geometry of skinGeometries.values()) geometry.dispose();
  }, [boxGeometry, frameGeometry, materials, skinGeometries]);

  return (
    <group name="ShippingCrates">
      {groups.map((group) => {
        const geometry = skinGeometries.get(skinKey(group.skin));
        if (!geometry) throw new Error(`WRECK_YARD_CRATE_SKIN_MISSING:${skinKey(group.skin)}`);
        return <CrateBatch key={group.key} crates={group.crates} renderRef={renderRef}
          bodyGeometry={geometry} frameGeometry={frameGeometry} bodyMaterial={materials.body} frameMaterial={materials.frame[group.skin.frame]} />;
      })}
      <PortalCrateCopies crates={crates} renderRef={renderRef} skinGeometries={skinGeometries}
        frameGeometry={frameGeometry} materials={materials} />
    </group>
  );
}

function CrateBatch({ crates, renderRef, bodyGeometry, frameGeometry, bodyMaterial, frameMaterial }: {
  crates: readonly YardBody[];
  renderRef: MutableRefObject<YardRender | null>;
  bodyGeometry: THREE.BufferGeometry;
  frameGeometry: THREE.BufferGeometry;
  bodyMaterial: THREE.MeshToonMaterial;
  frameMaterial: THREE.MeshToonMaterial;
}) {
  const reducedMotion = useReducedMotionRef();
  const gravity = useMemo(createGravitySurfaceUniforms, []);
  const heldMaterials = useMemo(() => ({
    body: createGravityToonMaterial(bodyMaterial, gravity),
    frame: createGravityToonMaterial(frameMaterial, gravity),
  }), [bodyMaterial, frameMaterial, gravity]);
  useEffect(() => () => {
    heldMaterials.body.dispose();
    heldMaterials.frame.dispose();
  }, [heldMaterials]);
  const bodyMesh = useRef<THREE.InstancedMesh>(null);
  const frameMesh = useRef<THREE.InstancedMesh>(null);
  const transform = useMemo(() => new THREE.Object3D(), []);
  const previousPoses = useMemo(() => new Float64Array(MAX_INSTANCED_CRATES * 8).fill(NaN), [crates]);
  const previousMatrices = useMemo(() => new Float32Array(MAX_INSTANCED_CRATES * 16).fill(NaN), [crates]);

  useLayoutEffect(() => {
    if (!bodyMesh.current || !frameMesh.current) return;
    crates.forEach((body, index) => {
      const color = crateTint(body);
      bodyMesh.current!.setColorAt(index, color);
      frameMesh.current!.setColorAt(index, color);
    });
    if (bodyMesh.current.instanceColor) bodyMesh.current.instanceColor.needsUpdate = true;
    if (frameMesh.current.instanceColor) frameMesh.current.instanceColor.needsUpdate = true;
  }, [crates]);

  useFrame(({ clock }) => {
    const render = renderRef.current;
    gravity.uGravityTime.value = reducedMotion.current ? 0 : clock.elapsedTime;
    gravity.uGravityHeldIndices.value.set(-1, -1, -1, -1);
    let heldCount = 0;
    for (const player of render?.players ?? []) {
      if (!player.grabbing || !render?.poses.has(player.grabbing)) continue;
      const index = crates.findIndex((body) => body.id === player.grabbing);
      if (index >= 0 && heldCount < 4) gravity.uGravityHeldIndices.value.setComponent(heldCount++, index);
    }
    const bodyInstances = bodyMesh.current;
    const frameInstances = frameMesh.current;
    if (!bodyInstances || !frameInstances) return;

    const timing = beginPhase('crates.upload');
    bodyInstances.count = crates.length;
    frameInstances.count = crates.length;
    let writes = 0;
    let firstChanged = crates.length;
    let lastChanged = -1;
    for (let index = 0; index < crates.length; index += 1) {
      const pose = render?.poses.get(crates[index]!.id);
      const straddlingPortal = render?.portalStraddlers?.some((entry) => entry.bodyId === crates[index]!.id && entry.pairId === RETURNS_PAIR.id) ?? false;
      const hidden = !pose || straddlingPortal;
      const poseOffset = index * 8;
      if (previousPoses[poseOffset + 7] === Number(hidden) && (hidden || (
        pose!.position.every((value, axis) => value === previousPoses[poseOffset + axis])
        && pose!.rotation.every((value, axis) => value === previousPoses[poseOffset + 3 + axis])))) continue;
      previousPoses[poseOffset + 7] = Number(hidden);
      if (pose) {
        previousPoses.set(pose.position, poseOffset);
        previousPoses.set(pose.rotation, poseOffset + 3);
      }
      if (hidden) {
        transform.position.set(0, -1000, 0);
        transform.quaternion.identity();
        transform.scale.setScalar(0);
      } else {
        transform.position.set(pose.position[0], pose.position[1], pose.position[2]);
        transform.quaternion.set(pose.rotation[0], pose.rotation[1], pose.rotation[2], pose.rotation[3]);
        transform.scale.setScalar(1);
      }
      transform.updateMatrix();
      const offset = index * 16;
      const elements = transform.matrix.elements;
      let changed = false;
      for (let component = 0; component < 16; component += 1) {
        if (previousMatrices[offset + component] !== Math.fround(elements[component]!)) { changed = true; break; }
      }
      if (!changed) continue;
      previousMatrices.set(elements, offset);
      bodyInstances.setMatrixAt(index, transform.matrix);
      frameInstances.setMatrixAt(index, transform.matrix);
      firstChanged = Math.min(firstChanged, index);
      lastChanged = index;
      writes += 2;
    }
    if (lastChanged >= 0) {
      for (const mesh of [bodyInstances, frameInstances]) {
        mesh.computeBoundingSphere();
        const pending = mesh.instanceMatrix.updateRanges[0];
        const start = Math.min(firstChanged * 16, pending?.start ?? Infinity);
        const end = Math.max((lastChanged + 1) * 16, pending ? pending.start + pending.count : -1);
        // Keep changes from frames where this batch was outside the view.
        mesh.instanceMatrix.clearUpdateRanges();
        mesh.instanceMatrix.addUpdateRange(start, end - start);
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
    perfCount('crates.instanceWrites', writes);
    endPhase('crates.upload', timing);
  });

  return (
    <>
      <instancedMesh
        ref={bodyMesh}
        args={[bodyGeometry, heldMaterials.body, MAX_INSTANCED_CRATES]}
        count={crates.length}
        castShadow
        receiveShadow
        frustumCulled
        raycast={noRaycast}
      />
      <instancedMesh
        ref={frameMesh}
        args={[frameGeometry, heldMaterials.frame, MAX_INSTANCED_CRATES]}
        count={crates.length}
        castShadow
        receiveShadow
        frustumCulled
        raycast={noRaycast}
      />
    </>
  );
}

interface PortalCrateHalf {
  readonly group: THREE.Group;
  readonly plane: THREE.Plane;
  readonly materials: readonly THREE.MeshToonMaterial[];
}

interface PortalCrateCopy {
  readonly gravity: GravitySurfaceUniforms;
  readonly skin: string;
  readonly entry: PortalCrateHalf;
  readonly exit: PortalCrateHalf;
}

function createPortalCrateHalf(
  name: string,
  bodyGeometry: THREE.BufferGeometry,
  frameGeometry: THREE.BufferGeometry,
  materials: CrateMaterials,
  skin: CrateSkin,
  tint: THREE.Color,
  gravity: GravitySurfaceUniforms,
): PortalCrateHalf {
  const plane = new THREE.Plane();
  const bodyMaterial = createGravityToonMaterial(materials.body, gravity);
  const frameMaterial = createGravityToonMaterial(materials.frame[skin.frame], gravity);
  const group = new THREE.Group();
  group.name = name;
  for (const [geometry, material] of [[bodyGeometry, bodyMaterial], [frameGeometry, frameMaterial]] as const) {
    material.color.multiply(tint);
    material.clippingPlanes = [plane];
    material.clipShadows = true;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.raycast = noRaycast;
    group.add(mesh);
  }
  return { group, plane, materials: [bodyMaterial, frameMaterial] };
}

function disposePortalCrateCopy(copy: PortalCrateCopy): void {
  for (const half of [copy.entry, copy.exit]) {
    half.group.removeFromParent();
    for (const material of half.materials) material.dispose();
  }
}

/** Allocate copies only for active whole crates. Both halves share the batch geometry and atlas. */
function PortalCrateCopies({ crates, renderRef, skinGeometries, frameGeometry, materials }: {
  crates: readonly YardBody[];
  renderRef: MutableRefObject<YardRender | null>;
  skinGeometries: ReadonlyMap<string, THREE.BufferGeometry>;
  frameGeometry: THREE.BufferGeometry;
  materials: CrateMaterials;
}) {
  const reducedMotion = useReducedMotionRef();
  const root = useRef<THREE.Group>(null);
  const copies = useMemo(() => new Map<string, PortalCrateCopy>(), []);
  const crateById = useMemo(() => new Map(crates.map((body) => [body.id, body])), [crates]);
  const portalPieces = useMemo(() => {
    const pieces = new Map<PortalRenderEndName, { entry: THREE.Plane; exit: THREE.Plane; transform: THREE.Matrix4 }>();
    for (const end of ['A', 'B'] as const) {
      const entry = portalEndClipPlane(end);
      const exit = portalExitClipPlane3D(RETURNS_PAIR, end);
      pieces.set(end, {
        entry: new THREE.Plane(new THREE.Vector3(entry[0], entry[1], entry[2]), entry[3]),
        exit: new THREE.Plane(new THREE.Vector3(exit[0], exit[1], exit[2]), exit[3]),
        transform: new THREE.Matrix4().fromArray(portalTransformMatrix3D(RETURNS_PAIR, end)),
      });
    }
    return pieces;
  }, []);

  useEffect(() => () => {
    for (const copy of copies.values()) disposePortalCrateCopy(copy);
    copies.clear();
  }, [copies]);

  useFrame(({ clock }) => {
    const render = renderRef.current;
    if (!root.current) return;
    const active = new Map((render?.portalStraddlers ?? [])
      .filter((entry) => entry.pairId === RETURNS_PAIR.id && crateById.has(entry.bodyId) && render?.poses.has(entry.bodyId))
      .map((entry) => [entry.bodyId, entry]));
    for (const [id, copy] of copies) {
      if (active.has(id)) continue;
      disposePortalCrateCopy(copy);
      copies.delete(id);
    }
    for (const [id, straddler] of active) {
      const body = crateById.get(id)!;
      const pose = render!.poses.get(id)!;
      const skin = crateSkin(body);
      const key = `${skinKey(skin)}|${skin.frame}`;
      let copy = copies.get(id);
      if (copy && copy.skin !== key) {
        disposePortalCrateCopy(copy);
        copies.delete(id);
        copy = undefined;
      }
      if (!copy) {
        const geometry = skinGeometries.get(skinKey(skin));
        if (!geometry) throw new Error(`WRECK_YARD_CRATE_SKIN_MISSING:${skinKey(skin)}`);
        const tint = crateTint(body);
        const gravity = createGravitySurfaceUniforms();
        copy = {
          gravity,
          skin: key,
          entry: createPortalCrateHalf(`crate-${id}-entry`, geometry, frameGeometry, materials, skin, tint, gravity),
          exit: createPortalCrateHalf(`crate-${id}-exit`, geometry, frameGeometry, materials, skin, tint, gravity),
        };
        copy.exit.group.matrixAutoUpdate = false;
        root.current.add(copy.entry.group, copy.exit.group);
        copies.set(id, copy);
      }
      copy.gravity.uGravityHeld.value = render!.players.some((player) => player.grabbing === id) ? 1 : 0;
      copy.gravity.uGravityTime.value = reducedMotion.current ? 0 : clock.elapsedTime;
      const pieces = portalPieces.get(straddler.end)!;
      copy.entry.plane.copy(pieces.entry);
      copy.exit.plane.copy(pieces.exit);
      copy.entry.group.position.fromArray(pose.position);
      copy.entry.group.quaternion.fromArray(pose.rotation);
      copy.entry.group.updateMatrix();
      copy.exit.group.matrix.copy(pieces.transform).multiply(copy.entry.group.matrix);
      copy.exit.group.matrixWorldNeedsUpdate = true;
    }
  });

  return <group ref={root} name="PortalCrateCopies" />;
}
