import { Canvas, useFrame } from '@react-three/fiber';
import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import RundotAPI from '@series-inc/rundot-game-sdk/api';
import * as THREE from 'three';
import '../ui/Hud.css';
import { ROBOT_DESIGNS, ROBOT_PALETTES, type RobotPose } from '../render/avatars/robots';
import { ART_STYLE, deriveLightRig, YARD_LIGHTING } from '../render/style/artStyle';
import { InkComposer } from '../render/style/InkComposer';

/**
 * Avatar lab (dev only): the robot candidates side by side in the yard's light
 * and ink style. URL: ?color=0..3 paints all designs one slot color (default:
 * one slot each), ?design=scrapper|drum|tread|hover shows one design in all
 * four slot colors, ?angle=deg fixes the turn, ?jet shows the thrusters,
 * ?torch holds the torch, ?far looks from 15 m (gameplay distance), ?only=<design>
 * shows one robot close up.
 */
const params = new URLSearchParams(window.location.search);
const fixedColor = params.has('color') ? Number(params.get('color')) : null;
const fixedAngle = params.has('angle') ? (Number(params.get('angle')) * Math.PI) / 180 : null;
const jet = params.has('jet');
const tool = params.has('torch') ? 'torch' as const : 'hand' as const;
const single = ROBOT_DESIGNS.find((design) => design.id === params.get('design'));
/** ?only=<design>: one robot, close up. */
const only = ROBOT_DESIGNS.findIndex((design) => design.id === params.get('only'));
/** What stands on each of the four pads: one design per pad, or one design four times. */
const LINEUP = (only >= 0 ? [only] : [0, 1, 2, 3]).map((index) => ({
  design: single ?? ROBOT_DESIGNS[index]!,
  colors: ROBOT_PALETTES[single ? index : fixedColor ?? index]!,
}));
const SPACING = 1.7;

function Lineup() {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const [time, setTime] = useState(0);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    setTime(t);
    groups.current.forEach((group) => {
      if (group) group.rotation.y = fixedAngle ?? -0.5 + Math.sin(t * 0.4) * 0.9;
    });
  });
  const pose: RobotPose = { jet, tool, time };
  return (
    <>
      {LINEUP.map(({ design, colors }, index) => (
        <group key={index} position={[only >= 0 ? 0 : (index - 1.5) * SPACING, 0, 0]}>
          <group ref={(group) => { groups.current[index] = group; }}>
            <design.Component colors={colors} pose={pose} number={(only >= 0 ? only : index) + 1} />
          </group>
          <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[0.62, 32]} />
            <meshStandardMaterial color="#3a4048" />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Lab() {
  const rig = deriveLightRig(ART_STYLE);
  return (
    <>
      <Canvas shadows camera={{ position: only >= 0 ? [0, 1.25, 2.9] : params.has('far') ? [0, 2.2, 15] : [0, 1.55, 5.4], fov: 42 }} onCreated={({ camera }) => camera.lookAt(0, only >= 0 ? 0.85 : 0.75, 0)} style={{ position: 'absolute', inset: 0 }}>
        <color attach="background" args={[ART_STYLE.palette.skyBand]} />
        <ambientLight intensity={Math.PI * 0.42} color={new THREE.Color(...YARD_LIGHTING.ambientFloor)} />
        <hemisphereLight args={[new THREE.Color(...YARD_LIGHTING.sky), new THREE.Color(...YARD_LIGHTING.ground), Math.PI * 0.5]} position={[0, 1, 0]} />
        <directionalLight position={[...rig.key.position]} intensity={Math.PI * 1.05} color={new THREE.Color(...YARD_LIGHTING.sun)} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color={ART_STYLE.palette.floor} />
        </mesh>
        <Lineup />
        <InkComposer enableInk samples={4} quality="high" />
      </Canvas>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 22, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '0 4%', pointerEvents: 'none' }}>
        {(only >= 0 ? [] : LINEUP).map(({ design }, index) => (
          <div key={index} className="yard-plate" style={{ padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ font: '400 20px/1 var(--yard-display)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{single ? `Player ${index + 1}` : `${index + 1}. ${design.name}`}</div>
            <div style={{ marginTop: 4, font: '600 12px/1.3 var(--yard-text)', color: 'var(--yard-bone-dim)' }}>{single ? design.name : design.note}</div>
          </div>
        ))}
      </div>
    </>
  );
}

async function boot(): Promise<void> {
  const root = document.getElementById('root');
  if (!root) throw new Error('AVATAR_LAB_ROOT_MISSING');
  // The dev playground puts its load screen on every page; the SDK init takes it down.
  try {
    await Promise.race([RundotAPI.initializeAsync(), new Promise((_, reject) => setTimeout(() => reject(new Error('RUN SDK init timed out')), 5000))]);
    RundotAPI.preloader.hideLoadScreen();
  } catch (error) {
    console.warn('Avatar lab: RUN SDK init failed; continuing.', error);
  }
  createRoot(root).render(<StrictMode><Lab /></StrictMode>);
}

void boot();
