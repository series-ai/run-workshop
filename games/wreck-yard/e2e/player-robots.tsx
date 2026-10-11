import '../src/deterministicMath';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { YardSim } from '../src/sim/sim';
import { NEUTRAL_INPUT } from '../src/sim/input';
import { FLOOR_Y } from '../src/sim/constants';
import { projectYard, type YardRender, type PlayerRenderPose } from '../src/render/presentation';
import { PlayerAvatars } from '../src/render/PlayerAvatars';
import { VoxelBodies } from '../src/render/VoxelBodies';
import { InkComposer } from '../src/render/style/InkComposer';
import { toolMuzzleAndAim } from '../src/render/toolMuzzle';
import { useWorldOcclusion } from '../src/render/OcclusionUpdater';
import type { UiTool } from '../src/render/keyBindings';

const sim = YardSim.create(4);
for (let i = 0; i < 30; i++) sim.step(Array.from({ length: 4 }, () => NEUTRAL_INPUT));
const initial = projectYard(sim.state, { localSlot: 0, status: 'offline' });
const chassis = initial.poses.get('vehicle-chassis')!;
const capture = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
type Scenario = 'stand' | 'move' | 'torch' | 'aim' | 'jet' | 'first-person' | 'gone' | `driver-${number}`;

function ProofScene() {
  const renderRef = useRef<YardRender | null>(initial);
  const [tool, setTool] = useState<UiTool>('orbit');
  const [showBuggy, setShowBuggy] = useState(false);
  const worldOcclusion = useWorldOcclusion();
  const { gl, scene, camera, advance } = useThree();
  const time = useRef(0);
  useEffect(() => {
    window.__ROBOTS__ = {
      async scenario(scenario) {
        const driver = scenario.startsWith('driver-') ? Number(scenario.slice(7)) : -1;
        const poses = new Map(initial.poses);
        poses.set('vehicle-chassis', { ...chassis, position: [0, FLOOR_Y + 0.9, 0] });
        renderRef.current = {
          ...initial, poses, frame: scenario === 'aim' ? 89 : 120, localSlot: 0,
          players: initial.players.map<PlayerRenderPose>(player => ({
            ...player, position: [(player.slot - 1.5) * 1.9, FLOOR_Y, scenario === 'move' ? 0.18 : 0], yaw: scenario === 'aim' ? 0.7 : Math.PI,
            pitch: scenario === 'aim' ? 0.65 : scenario === 'torch' ? 0.3 : 0,
            activeTool: scenario === 'torch' || scenario === 'aim' ? 'torch' : 'hand',
            jetpackActive: scenario === 'jet', ridingVehicle: player.slot === driver,
          })).filter(player => scenario !== 'gone' || player.slot !== 2),
        };
        setTool(scenario === 'first-person' ? 'hand' : 'orbit');
        setShowBuggy(driver >= 0);
        if (driver >= 0) {
          camera.position.set(3, 2.4, 4.7); camera.lookAt(0, FLOOR_Y + 1.0, 0);
        } else {
          camera.position.set(3, 2.8, 8); camera.lookAt(0, FLOOR_Y + 0.85, 0);
        }
        await capture(); await capture();
        advance(time.current += 1 / 30); advance(time.current += 1 / 30);
      },
      profile() {
        const context = gl.getContext();
        const samples: number[] = [];
        gl.info.autoReset = false;
        try {
          for (let frame = 0; frame < 90; frame++) {
            gl.info.reset();
            const start = performance.now();
            advance(time.current += 1 / 60);
            context.finish();
            if (frame >= 30) samples.push(performance.now() - start);
          }
          samples.sort((a, b) => a - b);
          return { medianFrameMs: samples[Math.floor(samples.length / 2)], p95FrameMs: samples[Math.floor(samples.length * 0.95)], calls: gl.info.render.calls, triangles: gl.info.render.triangles };
        } finally { gl.info.autoReset = true; }
      },
      inspect() {
        scene.updateMatrixWorld(true);
        const players = initial.players.map(player => {
          const root = scene.getObjectByName(`player-robot-${player.slot}`);
          if (!root) return { slot: player.slot, visible: false };
          const seat = root.getObjectByName('robot-seat')!;
          const held = root.getObjectByName('robot-held-tool')!;
          const flames: boolean[] = [];
          root.traverse(object => { if (object.name === 'robot-jet-flame') flames.push(object.visible); });
          const tip = held.getObjectByName('robot-tool-tip')!;
          const tipWorld = tip.getWorldPosition(new THREE.Vector3());
          const muzzle = new THREE.Vector3(), aim = new THREE.Vector3();
          const shown = renderRef.current!.players.find(p => p.slot === player.slot);
          if (shown) toolMuzzleAndAim(shown, false, camera, muzzle, aim, { right: new THREE.Vector3(), up: new THREE.Vector3() });
          const toolDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(held.getWorldQuaternion(new THREE.Quaternion()));
          const eyes = root.getObjectByName('robot-eyes')!.getWorldPosition(new THREE.Vector3());
          const box = new THREE.Box3().setFromObject(root);
          return { slot: player.slot, robot: root.userData.robot, visible: root.visible,
            position: root.position.toArray(), quaternion: root.quaternion.toArray(),
            seatScale: seat.scale.toArray(), toolVisible: held.visible, pitch: held.rotation.x,
            toolColor: (tip as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.color.getHexString(),
            flames, wheelAngle: root.getObjectByName('robot-wheel')?.rotation.x ?? null, trackPhase: root.getObjectByName('robot-track-belt')?.children[0]?.position.z ?? null, aimGapRadians: shown ? toolDirection.angleTo(aim) : 0, tipWorld: tipWorld.toArray(), muzzle: muzzle.toArray(), muzzleGap: tipWorld.distanceTo(muzzle),
            eyeHeightAboveChassis: eyes.y - renderRef.current!.poses.get('vehicle-chassis')!.position[1], bounds: { min: box.min.toArray(), max: box.max.toArray() } };
        });
        return { players, info: { calls: gl.info.render.calls, triangles: gl.info.render.triangles } };
      },
    };
    void window.__ROBOTS__.scenario('stand');
    return () => { delete window.__ROBOTS__; };
  }, [advance, camera, gl, scene]);
  return <>
    <ambientLight intensity={1.2} /><hemisphereLight args={['#adc4d0', '#423b2e', 1.6]} />
    <directionalLight position={[4, 8, 5]} intensity={3} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} receiveShadow>
      <planeGeometry args={[40, 40]} /><meshToonMaterial color="#363d43" />
    </mesh>
    {showBuggy && <VoxelBodies bodies={initial.bodies.filter(body => body.id === 'vehicle-chassis')} renderRef={renderRef} worldOcclusion={worldOcclusion} />}
    <PlayerAvatars renderRef={renderRef} tool={tool} />
    <InkComposer enableInk samples={0} quality="low" />
  </>;
}
declare global { interface Window { __ROBOTS__?: { scenario(scenario: Scenario): Promise<void>; inspect(): unknown; profile(): unknown } } }
createRoot(document.getElementById('root')!).render(<Canvas frameloop="never" shadows gl={{ preserveDrawingBuffer: true }} camera={{ fov: 45, near: 0.1, far: 100 }} onCreated={({ gl }) => { gl.toneMapping = THREE.NoToneMapping; gl.shadowMap.type = THREE.PCFSoftShadowMap; }}><ProofScene /></Canvas>);
