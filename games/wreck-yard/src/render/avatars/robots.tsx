import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { pixelText } from '../pixelFont';
import { getToonGradientMap, Toon } from '../style/toonMaterial';
import { ROBOT_SLOTS, robotBodyTilt, type RobotId } from './robotSlots';

/**
 * Player avatars: four salvage robots, one per player slot. Used in the game
 * and in the avatar lab (avatar-lab.html). Each is about
 * 1.5 m tall, faces +Z, and stands on y = 0.
 *
 * Shared design language, so the four read as one crew: the player color on
 * the main panels, ink joints, steel hardware, one hazard-stripe element, a
 * glowing eye in the player's glow color, a stenciled player number in the
 * yard's sign font, the tool in the right hand, and jets on the back.
 */

export interface RobotColors {
  /** Main paint: the player's slot color. */
  readonly paint: string;
  /** Darker trim of the same hue. */
  readonly trim: string;
  /** Eye and light glow. */
  readonly glow: string;
  /** Jet flame. */
  readonly flame: string;
}

export interface RobotPose {
  readonly jet: boolean;
  readonly tool: 'hand' | 'torch';
  /** Seconds, for idle motion. */
  readonly time: number;
  readonly pitch: number;
  readonly driving: boolean;
  /** Signed distance travelled on the ground, in metres. */
  readonly travel: number;
}

type V3 = [number, number, number];

const INK = '#18212b';
const STEEL = '#7d8c96';
const STEEL_DARK = '#3d4650';
const BONE = '#e9dcc0';
const HAZARD = '#e8b54a';

// ---------------------------------------------------------------------------
// Kit

const roundedCache = new Map<string, RoundedBoxGeometry>();
function roundedBox(size: V3, radius: number): RoundedBoxGeometry {
  const key = `${size.join(',')}:${radius}`;
  let geometry = roundedCache.get(key);
  if (!geometry) {
    geometry = new RoundedBoxGeometry(size[0], size[1], size[2], 3, Math.min(radius, Math.min(...size) / 2 - 1e-4));
    roundedCache.set(key, geometry);
  }
  return geometry;
}

/** A bevelled panel: the rounded edges catch the toon light and the ink line. */
function Panel({ size, color, radius = 0.03, position, rotation }: { size: V3; color: string; radius?: number; position?: V3; rotation?: V3 }) {
  return (
    <mesh geometry={roundedBox(size, radius)} position={position} rotation={rotation} castShadow>
      <Toon color={color} />
    </mesh>
  );
}

function Bolt({ position, rotation = [Math.PI / 2, 0, 0], size = 0.018 }: { position: V3; rotation?: V3; size?: number }) {
  return (
    <mesh position={position} rotation={rotation}>
      <cylinderGeometry args={[size, size, size * 0.9, 6]} />
      <Toon color={STEEL} />
    </mesh>
  );
}

function Glow({ color }: { color: string }) {
  return <meshBasicMaterial color={color} toneMapped={false} />;
}

let hazardMaterial: THREE.MeshToonMaterial | null = null;
/** Yellow and ink diagonal stripes, toon lit like the rest of the robot. */
function getHazardMaterial(): THREE.MeshToonMaterial {
  if (hazardMaterial) return hazardMaterial;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('WRECK_YARD_HAZARD_TEXTURE_CONTEXT');
  context.fillStyle = HAZARD;
  context.fillRect(0, 0, 64, 64);
  context.fillStyle = INK;
  for (let x = -64; x < 128; x += 32) {
    context.beginPath();
    context.moveTo(x, 64);
    context.lineTo(x + 16, 64);
    context.lineTo(x + 80, 0);
    context.lineTo(x + 64, 0);
    context.closePath();
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  hazardMaterial = new THREE.MeshToonMaterial({ map: texture, gradientMap: getToonGradientMap() });
  return hazardMaterial;
}

/** The stripe material with one stripe pair every 8 cm over a surface of `width` by `height` meters. */
function useHazardMaterial(width: number, height: number): THREE.MeshToonMaterial {
  return useMemo(() => {
    const base = getHazardMaterial();
    const copy = base.clone();
    copy.map = base.map!.clone();
    copy.map.repeat.set(Math.max(1, Math.round(width / 0.08)), Math.max(1, Math.round(height / 0.08)));
    copy.map.needsUpdate = true;
    return copy;
  }, [width, height]);
}

function HazardPlate({ size, position, rotation }: { size: V3; position?: V3; rotation?: V3 }) {
  const material = useHazardMaterial(size[0], size[1]);
  return <mesh geometry={roundedBox(size, 0.008)} material={material} position={position} rotation={rotation} />;
}

/** A striped band around a cylinder or sphere of `radius`. */
function HazardBand({ radius, height, position }: { radius: number; height: number; position?: V3 }) {
  const material = useHazardMaterial(2 * Math.PI * radius, height);
  return (
    <mesh material={material} position={position}>
      <cylinderGeometry args={[radius, radius, height, 32, 1, true]} />
    </mesh>
  );
}

/** The player number in the yard's 5 x 7 sign font, stenciled in bone on an ink plate. */
function NumberDecal({ digit, cell = 0.016, position, rotation }: { digit: number; cell?: number; position: V3; rotation?: V3 }) {
  const cells = useMemo(() => pixelText(String(digit)), [digit]);
  const pixels = useMemo(() => cells.flatMap((row, y) => row.flatMap((on, x) => on ? [[x, y] as const] : [])), [cells]);
  const ink = useRef<THREE.InstancedMesh>(null);
  const width = cells[0]!.length * cell;
  const height = cells.length * cell;
  useLayoutEffect(() => {
    if (!ink.current) return;
    const matrix = new THREE.Matrix4();
    pixels.forEach(([x, y], index) => {
      matrix.makeTranslation((x - (cells[0]!.length - 1) / 2) * cell, ((cells.length - 1) / 2 - y) * cell, 0.001);
      ink.current!.setMatrixAt(index, matrix);
    });
    ink.current.instanceMatrix.needsUpdate = true;
    ink.current.computeBoundingSphere();
  }, [pixels, cells, cell]);
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -0.004]}>
        <boxGeometry args={[width + cell * 2, height + cell * 2, 0.006]} />
        <Toon color={INK} />
      </mesh>
      <instancedMesh ref={ink} args={[undefined, undefined, pixels.length]}>
        <boxGeometry args={[cell * 0.9, cell * 0.9, 0.004]} />
        <Toon color={BONE} />
      </instancedMesh>
    </group>
  );
}

/** Jet flame: an outer flame and a white-hot core that flicker. */
function Flame({ pose, color, length = 0.6, radius = 0.1 }: { pose: RobotPose; color: string; length?: number; radius?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const flicker = 0.85 + 0.12 * Math.sin(t * 47) + 0.08 * Math.sin(t * 23 + 1);
    ref.current.visible = pose.jet && !pose.driving;
    ref.current.scale.set(1 + 0.05 * Math.sin(t * 31), flicker, 1 + 0.05 * Math.sin(t * 31));
  });
  return (
    <group ref={ref} name="robot-jet-flame" visible={false}>
      <mesh position={[0, -length / 2, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[radius, length, 14, 1, true]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.85} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -length * 0.28, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[radius * 0.5, length * 0.55, 10]} />
        <meshBasicMaterial color="#fff6dc" toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * Robots face +Z. Their right hand is on -X (it is on the viewer's left in a
 * front view); the tool goes there, as in the first-person view.
 */
const RIGHT = -1;
const LEFT = 1;

/** The slot beacon on top of every robot: an ink base and a glowing dome. */
function Beacon({ colors, position }: { colors: RobotColors; position: V3 }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.setScalar(0.9 + 0.12 * Math.max(0, Math.sin(clock.elapsedTime * 3)));
  });
  return (
    <group position={position}>
      <mesh><cylinderGeometry args={[0.055, 0.065, 0.04, 14]} /><Toon color={INK} /></mesh>
      <mesh ref={ref} position={[0, 0.035, 0]}><sphereGeometry args={[0.045, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><Glow color={colors.glow} /></mesh>
    </group>
  );
}

/** The crew's jet pack: a pack in the slot color, the slot number, two big nozzles. Mount it on the back. */
function JetPack({ colors, pose, number, width = 0.34 }: { colors: RobotColors; pose: RobotPose; number: number; width?: number }) {
  const ref = useRef<THREE.Group>(null);
  const nozzle = width * 0.3;
  useFrame(() => { if (ref.current) ref.current.visible = !pose.driving; });
  return (
    <group ref={ref} name="robot-jetpack">
      <Panel size={[width, 0.38, 0.17]} color={colors.paint} radius={0.04} />
      <Panel size={[width + 0.02, 0.06, 0.19]} color={colors.trim} radius={0.015} position={[0, 0.13, 0]} />
      <NumberDecal digit={number} cell={0.02} position={[0, -0.02, -0.088]} rotation={[0, Math.PI, 0]} />
      {[-nozzle, nozzle].map((x) => (
        <group key={x} position={[x, -0.23, 0]}>
          <mesh><cylinderGeometry args={[0.07, 0.095, 0.13, 14]} /><Toon color={INK} /></mesh>
          <mesh position={[0, -0.05, 0]}><cylinderGeometry args={[0.055, 0.055, 0.04, 14, 1, true]} /><Glow color={colors.flame} /></mesh>
          <group position={[0, -0.07, 0]}><Flame pose={pose} color={colors.flame} /></group>
        </group>
      ))}
    </group>
  );
}

/** The held tool, pointing +Z: a glowing barrel and a big tip ring, readable at range. */
function Tool({ pose, design }: { pose: RobotPose; design: RobotId }) {
  const ref = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const rotation = useMemo(() => ({ euler: new THREE.Euler(), tilt: new THREE.Quaternion(), aim: new THREE.Quaternion() }), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: '#5fe0ff', toneMapped: false }), []);
  useLayoutEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    if (ref.current) {
      ref.current.visible = !pose.driving;
      const [x, z] = robotBodyTilt(design, pose.time);
      rotation.tilt.setFromEuler(rotation.euler.set(x, 0, z));
      rotation.aim.setFromEuler(rotation.euler.set(-pose.pitch, 0, 0));
      ref.current.quaternion.copy(rotation.tilt.invert().multiply(rotation.aim));
    }
    if (glow.current) glow.current.color.set(pose.tool === 'torch' ? '#ff8a3c' : '#5fe0ff');
  });
  return (
    <group ref={ref} name="robot-held-tool">
      <Panel size={[0.1, 0.12, 0.3]} color={STEEL_DARK} radius={0.025} />
      <Panel size={[0.06, 0.14, 0.07]} color={INK} radius={0.015} position={[0, -0.1, -0.07]} rotation={[0.3, 0, 0]} />
      <mesh position={[0, 0.065, 0.02]}><boxGeometry args={[0.03, 0.012, 0.2]} /><primitive ref={glow} object={material} attach="material" /></mesh>
      <group position={[0, 0, 0.17]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.04, 0.05, 0.1, 14]} /><Toon color={STEEL} /></mesh>
        <mesh name="robot-tool-tip" position={[0, 0, 0.06]}><torusGeometry args={[0.04, 0.013, 8, 20]} /><primitive ref={glow} object={material} attach="material" /></mesh>
        <mesh position={[0, 0, 0.05]}><sphereGeometry args={[0.026, 12, 12]} /><primitive ref={glow} object={material} attach="material" /></mesh>
      </group>
    </group>
  );
}

/** A three-finger claw. */
function Claw({ color, open = 0.35 }: { color: string; open?: number }) {
  return (
    <group>
      <mesh><sphereGeometry args={[0.05, 12, 10]} /><Toon color={INK} /></mesh>
      {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle) => (
        <group key={angle} rotation={[0, angle, 0]}>
          <Panel size={[0.028, 0.1, 0.035]} color={color} radius={0.01} position={[0, -0.055, 0.034]} rotation={[open, 0, 0]} />
        </group>
      ))}
    </group>
  );
}

function Limb({ from, to, radius, color }: { from: V3; to: V3; radius: number; color: string }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const direction = b.clone().sub(a);
    return {
      position: a.clone().add(b).multiplyScalar(0.5).toArray() as V3,
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()),
      length: direction.length(),
    };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <cylinderGeometry args={[radius, radius, length, 12]} />
      <Toon color={color} />
    </mesh>
  );
}

function Joint({ position, radius = 0.05, color = INK }: { position: V3; radius?: number; color?: string }) {
  return <mesh position={position}><sphereGeometry args={[radius, 14, 10]} /><Toon color={color} /></mesh>;
}

function Group({ children, position, rotation }: { children: ReactNode; position?: V3; rotation?: V3 }) {
  return <group position={position} rotation={rotation}>{children}</group>;
}

/** Shoulder, upper arm, elbow cap in the slot color, forearm; the hand goes at `hand`. */
function Arm({ shoulder, elbow, wrist, colors, children }: { shoulder: V3; elbow: V3; wrist: V3; colors: RobotColors; children: ReactNode }) {
  return (
    <group>
      <Joint position={shoulder} radius={0.065} />
      <Limb from={shoulder} to={elbow} radius={0.042} color={STEEL_DARK} />
      <Joint position={elbow} radius={0.055} color={colors.paint} />
      <Limb from={elbow} to={wrist} radius={0.038} color={STEEL_DARK} />
      <Group position={wrist}>{children}</Group>
    </group>
  );
}

/** The crew's hazard belt around a box body: four striped plates. */
/** One belt height for the whole crew. */
const BELT = 0.08;

/** The crew's hazard belt around a box body of `width` x `depth`: four striped plates on its faces. */
function HazardWrap({ width, depth, y }: { width: number; depth: number; y: number }) {
  const out = 0.008;
  return (
    <group position={[0, y, 0]}>
      <HazardPlate size={[width - 0.04, BELT, 0.012]} position={[0, 0, depth / 2 + out]} />
      <HazardPlate size={[width - 0.04, BELT, 0.012]} position={[0, 0, -depth / 2 - out]} />
      <HazardPlate size={[depth - 0.04, BELT, 0.012]} position={[width / 2 + out, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      <HazardPlate size={[depth - 0.04, BELT, 0.012]} position={[-width / 2 - out, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// 1. Scrapper: one big wheel, a box body, a camera eye with a shutter.

export function ScrapperBot({ colors, pose, number = 1 }: { colors: RobotColors; pose: RobotPose; number?: number }) {
  const wheel = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);
  const pupil = useRef<THREE.Mesh>(null);
  const antenna = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = pose.time;
    if (wheel.current) wheel.current.rotation.x = pose.travel / 0.3;
    if (body.current) body.current.rotation.x = robotBodyTilt('scrapper', t)[0];
    // The shutter drops over the lens to blink, and sits half shut now and then (a squint).
    // Blink: the pupil squashes shut; a squint now and then tips the lid hood down.
    const blink = (t % 3.7) < 0.16;
    const squint = (t % 11) > 8.5;
    const dilate = 0.85 + 0.15 * Math.sin(t * 0.8);
    if (pupil.current) pupil.current.scale.set(dilate, 1, blink ? 0.12 : dilate);
    if (lid.current) lid.current.rotation.x = squint ? 0.35 : 0;
    if (antenna.current) antenna.current.rotation.z = 0.12 + Math.sin(t * 3.1) * 0.08;
  });
  return (
    <group>
      {/* Wheel: wide tire, tread blocks, hub disc in the slot color with a bolt ring */}
      <group position={[0, 0.3, 0]}>
        <group name="robot-wheel" ref={wheel}>
          <mesh rotation={[0, Math.PI / 2, 0]} castShadow scale={[1, 1, 1.35]}><torusGeometry args={[0.21, 0.09, 14, 30]} /><Toon color={INK} /></mesh>
          {[-0.115, 0.115].map((x) => (
            <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.215, 0.014, 6, 30]} /><Toon color={colors.paint} /></mesh>
          ))}
          {Array.from({ length: 16 }, (_, i) => (i / 16) * Math.PI * 2).map((a) => (
            <Panel key={a} size={[0.22, 0.045, 0.04]} color={INK} radius={0.01} position={[0, Math.cos(a) * 0.3, Math.sin(a) * 0.3]} rotation={[a, 0, 0]} />
          ))}
          <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.15, 0.15, 0.2, 22]} /><Toon color={colors.paint} /></mesh>
          {[-0.105, 0.105].map((x) => (
            <group key={x}>
              <mesh position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.065, 0.065, 0.02, 16]} /><Toon color={STEEL} /></mesh>
              {Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2).map((a) => (
                <Bolt key={a} position={[x * 1.05, Math.cos(a) * 0.11, Math.sin(a) * 0.11]} rotation={[0, 0, Math.PI / 2]} size={0.016} />
              ))}
            </group>
          ))}
        </group>
      </group>
      {/* Fork: one strut each side to the hub */}
      {[-0.16, 0.16].map((x) => (
        <Limb key={x} from={[x, 0.3, 0]} to={[x * 0.85, 0.66, -0.02]} radius={0.034} color={STEEL_DARK} />
      ))}
      <group ref={body} position={[0, 0.66, 0]}>
        {/* Body: hips, chest box, lid, the crew's hazard belt */}
        <Panel size={[0.36, 0.12, 0.3]} color={colors.trim} position={[0, 0.05, 0]} />
        <Panel size={[0.52, 0.52, 0.4]} color={colors.paint} radius={0.055} position={[0, 0.37, 0]} />
        <Panel size={[0.54, 0.06, 0.42]} color={colors.trim} radius={0.025} position={[0, 0.64, 0]} />
        <HazardWrap width={0.52} depth={0.4} y={0.19} />
        <NumberDecal digit={number} cell={0.012} position={[0, 0.05, 0.156]} />
        {/* Camera eye: housing, lens ring, glowing pupil, shutter lid */}
        <group position={[0, 0.42, 0.21]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.18, 0.19, 0.08, 30]} /><Toon color={STEEL_DARK} /></mesh>
          <mesh position={[0, 0, 0.045]}><torusGeometry args={[0.145, 0.024, 10, 30]} /><Toon color={colors.trim} /></mesh>
          <mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.13, 0.13, 0.01, 30]} /><Toon color={INK} /></mesh>
          <mesh name="robot-eyes" ref={pupil} position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.075, 0.075, 0.012, 26]} /><Glow color={colors.glow} /></mesh>
          <mesh position={[0.04, 0.04, 0.058]}><sphereGeometry args={[0.016, 8, 8]} /><Glow color="#ffffff" /></mesh>
          {/* Lid hood: a steel half-shell over the top of the lens */}
          <group ref={lid} position={[0, 0, 0.05]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.162, 0.162, 0.07, 24, 1, true, Math.PI / 2, Math.PI]} />
              <Toon color={STEEL} side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>
        {/* Antenna and beacon */}
        <group ref={antenna} position={[LEFT * 0.17, 0.68, -0.08]}>
          <Limb from={[0, 0, 0]} to={[0, 0.26, 0]} radius={0.012} color={INK} />
          <Beacon colors={colors} position={[0, 0.27, 0]} />
        </group>
        <Arm shoulder={[RIGHT * 0.31, 0.47, 0.02]} elbow={[RIGHT * 0.4, 0.28, 0.1]} wrist={[RIGHT * 0.38, 0.24, 0.24]} colors={colors}>
          <Tool pose={pose} design="scrapper" />
        </Arm>
        <Arm shoulder={[LEFT * 0.31, 0.47, 0.02]} elbow={[LEFT * 0.42, 0.27, 0.06]} wrist={[LEFT * 0.4, 0.12, 0.16]} colors={colors}>
          <Group rotation={[-0.6, 0, 0]}><Claw color={colors.trim} /></Group>
        </Arm>
        <Group position={[0, 0.38, -0.29]}><JetPack colors={colors} pose={pose} number={number} /></Group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// 2. Drum-Bot: an oil drum on hydraulic legs, a big periscope head.

export function DrumBot({ colors, pose, number = 2 }: { colors: RobotColors; pose: RobotPose; number?: number }) {
  const scope = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const lens = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = pose.time;
    if (scope.current) {
      scope.current.rotation.x = -pose.pitch;
      scope.current.rotation.y = Math.sin(t * 0.7) * 0.5;
      scope.current.position.y = 0.06 + Math.max(0, Math.sin(t * 1.9)) * 0.02;
    }
    if (body.current) body.current.position.y = 0.92 + Math.sin(t * 2.4) * 0.012;
    if (lens.current) lens.current.scale.y = (t % 4.1) < 0.14 ? 0.12 : 1;
  });
  return (
    <group>
      {/* Hydraulic legs: steel cylinders in slot-color sleeves, chrome rods, boots */}
      {[-0.16, 0.16].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <Panel size={[0.22, 0.11, 0.32]} color={INK} radius={0.035} position={[0, 0.055, 0.03]} />
          <Panel size={[0.2, 0.045, 0.09]} color={HAZARD} radius={0.012} position={[0, 0.08, 0.18]} />
          <Joint position={[0, 0.14, 0]} radius={0.055} color={STEEL_DARK} />
          <mesh position={[0, 0.27, 0]}><cylinderGeometry args={[0.04, 0.04, 0.24, 12]} /><Toon color={STEEL} /></mesh>
          <mesh position={[0, 0.47, 0]} castShadow><cylinderGeometry args={[0.085, 0.08, 0.24, 14]} /><Toon color={colors.trim} /></mesh>
          <mesh position={[0, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.083, 0.015, 6, 16]} /><Toon color={INK} /></mesh>
        </group>
      ))}
      <group ref={body} position={[0, 0.92, 0]}>
        {/* Drum: shell, rolling hoops, the crew's hazard belt, chest number, dent */}
        <mesh castShadow><cylinderGeometry args={[0.33, 0.33, 0.7, 30]} /><Toon color={colors.paint} /></mesh>
        {[-0.22, 0.22].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.336, 0.026, 8, 32]} /><Toon color={colors.trim} /></mesh>
        ))}
        <HazardBand radius={0.334} height={BELT} position={[0, -0.3, 0]} />
        <NumberDecal digit={number} cell={0.024} position={[0, 0.02, 0.336]} />
        <mesh position={[LEFT * 0.21, -0.12, 0.24]} scale={[1, 1, 0.4]}><sphereGeometry args={[0.07, 10, 8]} /><Toon color={colors.trim} /></mesh>
        {/* Weld seam down the side opposite the dent */}
        <group rotation={[0, RIGHT * 0.75, 0]}>
          <mesh position={[0, 0, 0.334]}><boxGeometry args={[0.014, 0.42, 0.012]} /><Toon color={colors.trim} /></mesh>
          {[-0.16, -0.08, 0, 0.08, 0.16].map((y) => <Bolt key={y} position={[0, y, 0.338]} size={0.012} />)}
        </group>
        {/* Flat drum lid with chime ring and bung cap */}
        <mesh position={[0, 0.36, 0]}><cylinderGeometry args={[0.345, 0.345, 0.03, 30]} /><Toon color={colors.trim} /></mesh>
        <mesh position={[0, 0.375, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.33, 0.022, 8, 32]} /><Toon color={INK} /></mesh>
        <mesh position={[LEFT * 0.2, 0.395, 0.08]}><cylinderGeometry args={[0.045, 0.045, 0.04, 12]} /><Toon color={STEEL} /></mesh>
        {/* Bellows arms: tool (right), claw (left) */}
        {[RIGHT, LEFT].map((side) => (
          <group key={side} position={[side * 0.35, 0.1, 0.02]}>
            <Joint position={[0, 0, 0]} radius={0.065} color={STEEL_DARK} />
            {[0, 1, 2, 3, 4].map((i) => (
              <mesh key={i} position={[side * (0.045 + i * 0.038), -0.035 - i * 0.032, 0.025 + i * 0.03]} rotation={[0.6, 0, side * 0.6]}>
                <torusGeometry args={[0.042, 0.017, 6, 14]} />
                <Toon color={INK} />
              </mesh>
            ))}
            <Joint position={[side * 0.23, -0.2, 0.17]} radius={0.05} color={colors.paint} />
            {side === RIGHT
              ? <Group position={[side * 0.25, -0.2, 0.28]}><Tool pose={pose} design="drum" /></Group>
              : <Group position={[side * 0.24, -0.25, 0.19]} rotation={[-0.5, 0, 0]}><Claw color={colors.trim} open={0.5} /></Group>}
          </group>
        ))}
        <Group position={[0, 0.05, -0.4]}><JetPack colors={colors} pose={pose} number={number} /></Group>
        {/* Periscope: a big head with a hood and one large lens */}
        <group ref={scope} position={[0, 0.06, 0]}>
          <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.055, 0.065, 0.24, 14]} /><Toon color={STEEL_DARK} /></mesh>
          <mesh position={[0, 0.36, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.07, 0.018, 6, 16]} /><Toon color={HAZARD} /></mesh>
          <Panel size={[0.3, 0.24, 0.32]} color={colors.paint} radius={0.06} position={[0, 0.66, 0.06]} />
          <Panel size={[0.32, 0.035, 0.17]} color={colors.trim} radius={0.015} position={[0, 0.785, 0.15]} rotation={[0.28, 0, 0]} />
          <mesh position={[0, 0.65, 0.225]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.1, 0.11, 0.05, 24]} /><Toon color={INK} /></mesh>
          <mesh name="robot-eyes" ref={lens} position={[0, 0.65, 0.252]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.072, 0.072, 0.008, 24]} /><Glow color={colors.glow} /></mesh>
          <mesh position={[0.03, 0.68, 0.258]}><sphereGeometry args={[0.014, 8, 8]} /><Glow color="#ffffff" /></mesh>
          <Beacon colors={colors} position={[0, 0.8, -0.06]} />
        </group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// 3. Tread-Bot: tracks, a hull, a CRT head with LED eyes, a crane arm.

const LED_EYES: Record<'open' | 'blink' | 'happy', readonly string[]> = {
  open: ['.###..###.', '#####.####', '#####.####', '.###..###.'],
  blink: ['..........', '..........', '####..####', '..........'],
  happy: ['.###..###.', '#...##...#', '..........', '..........'],
};

/** A track: the belt wraps two end wheels and the road wheels; a guard in the slot color on top. */
function Track({ side, pose, colors }: { side: number; pose: RobotPose; colors: RobotColors }) {
  const bars = 14;
  const belt = useRef<THREE.Group>(null);
  useFrame(() => {
    belt.current?.children.forEach((bar, index) => {
      const u = ((index + pose.travel * bars / 0.54) % bars + bars) % bars / bars;
      bar.position.z = -0.27 + u * 0.54;
    });
  });
  return (
    <group position={[side * 0.26, 0, 0]}>
      <Panel size={[0.17, 0.26, 0.6]} color={INK} radius={0.12} position={[0, 0.14, 0]} />
      {[-0.21, -0.07, 0.07, 0.21].map((z, i) => (
        <group key={z} position={[side * 0.088, i === 0 || i === 3 ? 0.14 : 0.1, z]}>
          <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[i === 0 || i === 3 ? 0.08 : 0.06, i === 0 || i === 3 ? 0.08 : 0.06, 0.02, 14]} /><Toon color={STEEL} /></mesh>
          <Bolt position={[side * 0.012, 0, 0]} rotation={[0, 0, Math.PI / 2]} size={0.015} />
        </group>
      ))}
      <group name="robot-track-belt" ref={belt}>
      {Array.from({ length: bars }, (_, i) => i / bars).map((u, i) => (
        <Panel key={i} size={[0.175, 0.02, 0.03]} color={STEEL_DARK} radius={0.006} position={[0, 0.275, -0.27 + u * 0.54]} />
      ))}
      </group>
      <Panel size={[0.2, 0.035, 0.5]} color={colors.trim} radius={0.012} position={[0, 0.31, 0]} />
      <Panel size={[0.02, 0.1, 0.5]} color={colors.paint} radius={0.008} position={[side * 0.1, 0.245, 0]} />
    </group>
  );
}

export function TreadBot({ colors, pose, number = 3 }: { colors: RobotColors; pose: RobotPose; number?: number }) {
  const head = useRef<THREE.Group>(null);
  const hook = useRef<THREE.Group>(null);
  const eyesRef = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = pose.time;
    const face = (t % 3.4) < 0.14 ? 'blink' : (t % 9) > 7 ? 'happy' : 'open';
    eyesRef.current?.children.forEach(group => { group.visible = group.name === face; });
    if (head.current) {
      head.current.rotation.x = -pose.pitch;
      head.current.rotation.z = Math.sin(t * 0.9) * 0.06;
      head.current.rotation.y = Math.sin(t * 0.5) * 0.15;
    }
    if (hook.current) hook.current.rotation.x = Math.sin(t * 1.7) * 0.18;
  });
  return (
    <group>
      <Track side={RIGHT} pose={pose} colors={colors} />
      <Track side={LEFT} pose={pose} colors={colors} />
      {/* Hull, torso, the crew's hazard belt, chest number */}
      <Panel size={[0.36, 0.14, 0.46]} color={STEEL_DARK} position={[0, 0.36, 0]} />
      <Panel size={[0.54, 0.44, 0.4]} color={colors.paint} radius={0.055} position={[0, 0.64, 0]} />
      <HazardWrap width={0.54} depth={0.4} y={0.48} />
      {[0, 1, 2].map((i) => <Panel key={i} size={[0.2, 0.016, 0.01]} color={INK} radius={0.004} position={[LEFT * 0.08, 0.66 + i * 0.045, 0.205]} />)}
      <NumberDecal digit={number} position={[RIGHT * 0.15, 0.7, 0.206]} />
      {[[-0.23, 0.8], [0.23, 0.8]].map(([x, y]) => <Bolt key={x} position={[x!, y!, 0.205]} />)}
      {/* Neck */}
      <mesh position={[0, 0.89, 0]}><cylinderGeometry args={[0.1, 0.12, 0.05, 14]} /><Toon color={STEEL_DARK} /></mesh>
      <mesh position={[0, 0.96, 0]}><cylinderGeometry args={[0.04, 0.04, 0.12, 10]} /><Toon color={STEEL} /></mesh>
      {/* CRT head: case, tapered back, thick bezel, LED eyes, antennas, beacon */}
      <group ref={head} position={[0, 1.19, 0.03]}>
        <Panel size={[0.6, 0.42, 0.3]} color={colors.paint} radius={0.065} />
        <mesh position={[0, 0, -0.22]} rotation={[Math.PI / 2, Math.PI / 4, 0]}><cylinderGeometry args={[0.36, 0.2, 0.18, 4]} /><Toon color={colors.paint} /></mesh>
        {[-0.05, 0, 0.05].map((y) => <Panel key={y} size={[0.2, 0.018, 0.01]} color={INK} radius={0.004} position={[0, y, -0.315]} />)}
        <Panel size={[0.53, 0.35, 0.06]} color={STEEL_DARK} radius={0.05} position={[0, 0, 0.14]} />
        <Panel size={[0.47, 0.29, 0.03]} color={INK} radius={0.04} position={[0, 0, 0.16]} />
        <group name="robot-eyes" ref={eyesRef} position={[0, 0.005, 0.178]}>
          {Object.entries(LED_EYES).map(([face, eyes]) => <group key={face} name={face}>
          {eyes.flatMap((row, y) => [...row].map((cell, x) => cell === '#' ? (
            <mesh key={`${x}-${y}`} position={[(x - 4.5) * 0.042, (1.5 - y) * 0.047, 0]}>
              <boxGeometry args={[0.035, 0.039, 0.008]} />
              <Glow color={colors.glow} />
            </mesh>
          ) : null))}
          </group>)}
        </group>
        {[RIGHT, LEFT].map((side) => (
          <group key={side}>
            <mesh position={[side * 0.32, 0.04, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.05, 0.05, 0.05, 12]} /><Toon color={STEEL_DARK} /></mesh>
            <Limb from={[side * 0.13, 0.2, -0.05]} to={[side * 0.26, 0.42, -0.08]} radius={0.01} color={INK} />
            <mesh position={[side * 0.26, 0.43, -0.08]}><sphereGeometry args={[0.022, 8, 8]} /><Toon color={HAZARD} /></mesh>
          </group>
        ))}
        <Beacon colors={colors} position={[0, 0.225, 0.02]} />
      </group>
      {/* Right arm holds the tool */}
      <Panel size={[0.13, 0.13, 0.15]} color={STEEL_DARK} radius={0.03} position={[RIGHT * 0.33, 0.74, 0]} />
      <Arm shoulder={[RIGHT * 0.36, 0.72, 0.04]} elbow={[RIGHT * 0.4, 0.55, 0.12]} wrist={[RIGHT * 0.38, 0.52, 0.26]} colors={colors}>
        <Tool pose={pose} design="tread" />
      </Arm>
      {/* Left arm: a crane boom with a pulley and a hook */}
      <Panel size={[0.13, 0.13, 0.15]} color={STEEL_DARK} radius={0.03} position={[LEFT * 0.33, 0.74, 0]} />
      <Panel size={[0.07, 0.07, 0.42]} color={HAZARD} radius={0.015} position={[LEFT * 0.37, 0.86, 0.14]} rotation={[-0.55, 0, 0]} />
      <group position={[LEFT * 0.37, 0.98, 0.33]}>
        <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.05, 0.05, 0.04, 14]} /><Toon color={STEEL} /></mesh>
        <group ref={hook}>
          <mesh position={[0, -0.16, 0]}><cylinderGeometry args={[0.006, 0.006, 0.32, 4]} /><Toon color={INK} /></mesh>
          <mesh position={[0, -0.34, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.04, 0.012, 6, 14, Math.PI * 1.5]} /><Toon color={STEEL_DARK} /></mesh>
        </group>
      </group>
      <Group position={[0, 0.66, -0.29]}><JetPack colors={colors} pose={pose} number={number} width={0.46} /></Group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// 4. Hover-Welder: a floating split shell, a big welder mask, a thruster disc.

export function HoverBot({ colors, pose, number = 4 }: { colors: RobotColors; pose: RobotPose; number?: number }) {
  const body = useRef<THREE.Group>(null);
  const mask = useRef<THREE.Group>(null);
  const slit = useRef<THREE.Mesh>(null);
  const groundGlow = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const t = pose.time;
    if (groundGlow.current) groundGlow.current.opacity = pose.driving ? 0 : pose.jet ? 0.5 : 0.32;
    if (body.current) {
      body.current.position.y = 0.86 + Math.sin(t * 2.1) * 0.05;
      body.current.rotation.z = robotBodyTilt('hover', t)[1];
    }
    // The mask flips up now and then, like a welder checking the work.
    if (mask.current) mask.current.rotation.x = pose.tool === 'torch' ? 0 : (t % 8) > 6.5 ? -1.0 : 0;
    if (slit.current) slit.current.scale.y = 0.9 + 0.1 * Math.sin(t * 13);
  });
  return (
    <group>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.48, 30]} />
        <meshBasicMaterial ref={groundGlow} color={colors.flame} transparent opacity={0.32} toneMapped={false} depthWrite={false} />
      </mesh>
      <group ref={body} position={[0, 0.86, 0]}>
        {/* Split shell: top in paint, belly in trim, the crew's hazard belt, a light rim band */}
        <mesh scale={[1, 1.12, 1]} castShadow><sphereGeometry args={[0.35, 30, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><Toon color={colors.paint} /></mesh>
        <mesh scale={[1, 0.95, 1]} castShadow><sphereGeometry args={[0.35, 30, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} /><Toon color={colors.trim} /></mesh>
        <HazardBand radius={0.354} height={BELT} />
        {/* Welder mask: a curved shield that wraps the shell, hinged at its top edge */}
        <group position={[0, 0.36, 0.1]}>
          {/* The shell is narrow up here (about 0.14 m radius): keep the hinge inside it. */}
          <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.028, 0.028, 0.24, 12]} /><Toon color={INK} /></mesh>
          {[RIGHT, LEFT].map((side) => (
            <group key={side}>
              <Joint position={[side * 0.12, 0, 0]} radius={0.04} color={STEEL} />
              <Bolt position={[side * 0.145, 0, 0]} rotation={[0, 0, Math.PI / 2]} size={0.02} />
            </group>
          ))}
          <group ref={mask}>
            <group position={[0, -0.36, -0.1]}>
              {/* Shield: a cone segment that follows the shell's curve */}
              <mesh position={[0, 0.19, 0]}>
                <cylinderGeometry args={[0.33, 0.395, 0.3, 64, 1, true, -0.85, 1.7]} />
                <Toon color={colors.trim} side={THREE.DoubleSide} />
              </mesh>
              {/* Raised frame: top and bottom rims in trim */}
              <mesh position={[0, 0.335, 0]}><cylinderGeometry args={[0.338, 0.338, 0.03, 64, 1, true, -0.88, 1.76]} /><Toon color={STEEL_DARK} side={THREE.DoubleSide} /></mesh>
              <mesh position={[0, 0.045, 0]}><cylinderGeometry args={[0.4, 0.4, 0.03, 64, 1, true, -0.88, 1.76]} /><Toon color={STEEL_DARK} side={THREE.DoubleSide} /></mesh>
              {/* Glowing slit that follows the curve */}
              <mesh name="robot-eyes" ref={slit} position={[0, 0.2, 0]}><cylinderGeometry args={[0.366, 0.37, 0.065, 48, 1, true, -0.55, 1.1]} /><meshBasicMaterial color={colors.glow} toneMapped={false} side={THREE.DoubleSide} /></mesh>
            </group>
          </group>
        </group>
        <Beacon colors={colors} position={[0, 0.41, -0.08]} />
        {/* Stabilizer fins with some thickness */}
        {[RIGHT, LEFT].map((side) => (
          <Panel key={side} size={[0.06, 0.24, 0.26]} color={colors.trim} radius={0.025} position={[side * 0.36, 0.04, -0.13]} rotation={[0.3, 0, -side * 0.18]} />
        ))}
        {/* Back plate with the number */}
        <Panel size={[0.24, 0.22, 0.06]} color={colors.paint} radius={0.03} position={[0, 0.1, -0.33]} />
        <NumberDecal digit={number} cell={0.02} position={[0, 0.1, -0.364]} rotation={[0, Math.PI, 0]} />
        {/* Thruster disc with four pods; the flame never goes out */}
        <group position={[0, -0.38, 0]}>
          <mesh><cylinderGeometry args={[0.26, 0.22, 0.06, 28]} /><Toon color={STEEL_DARK} /></mesh>
          <mesh position={[0, -0.03, 0]}><cylinderGeometry args={[0.1, 0.12, 0.06, 18]} /><Toon color={INK} /></mesh>
          <group position={[0, -0.06, 0]}><Flame pose={pose} color={colors.flame} length={0.7} radius={0.1} /></group>
          <mesh position={[0, -0.062, 0]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.09, 18]} /><Glow color={colors.flame} /></mesh>
          {[0, 1, 2, 3].map((i) => {
            const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
            return (
              <group key={i} position={[Math.cos(a) * 0.21, -0.02, Math.sin(a) * 0.21]}>
                <mesh><cylinderGeometry args={[0.05, 0.06, 0.08, 12]} /><Toon color={INK} /></mesh>
                {/* Idle: the nozzle glows; jetting: a flame */}
                <mesh position={[0, -0.041, 0]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.04, 14]} /><Glow color={colors.flame} /></mesh>
                <group position={[0, -0.04, 0]}><Flame pose={pose} color={colors.flame} length={0.45} radius={0.045} /></group>
              </group>
            );
          })}
        </group>
        {/* Floating arms: tool (right), claw (left) */}
        <Arm shoulder={[RIGHT * 0.38, -0.04, 0.08]} elbow={[RIGHT * 0.45, -0.14, 0.17]} wrist={[RIGHT * 0.44, -0.16, 0.3]} colors={colors}>
          <Tool pose={pose} design="hover" />
        </Arm>
        <Arm shoulder={[LEFT * 0.38, -0.04, 0.08]} elbow={[LEFT * 0.46, -0.17, 0.14]} wrist={[LEFT * 0.46, -0.27, 0.22]} colors={colors}>
          <Group rotation={[-0.6, 0, 0]}><Claw color={colors.trim} /></Group>
        </Arm>
      </group>
    </group>
  );
}

export const ROBOT_DESIGNS = [
  { ...ROBOT_SLOTS[0], Component: ScrapperBot },
  { ...ROBOT_SLOTS[1], Component: DrumBot },
  { ...ROBOT_SLOTS[2], Component: TreadBot },
  { ...ROBOT_SLOTS[3], Component: HoverBot },
] as const;

export const ROBOT_PALETTES = ROBOT_DESIGNS.map(design => design.colors);
