import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { ELEVATOR, STORAGE, STORAGE_SOLIDS, type AttractionState, type ElevatorFloor } from '../sim/attractions';
import { FLOOR_Y } from '../sim/constants';
import { STORAGE_ELEVATOR_CAR_FIXTURE, STORAGE_FIXTURE_SOLIDS, STORAGE_LANDING_SIGN_X, STORAGE_SHAFT_TOP_Y } from '../sim/storageFixtures';
import type { YardBody } from '../sim/state';
import type { YardRender } from './presentation';
import { ART_STYLE } from './style/artStyle';
import { Toon } from './style/toonMaterial';
import { isIntactShippingCrate } from './ShippingCrates';

type V3 = readonly [number, number, number];
const noRaycast = () => null;
const TOP_Y = STORAGE_SHAFT_TOP_Y;
const STEEL = '#53636b';
const DARK_STEEL = '#28343a';
const ORANGE = ART_STYLE.palette.signalOrange;

function Block({ center, size, color }: { center: V3; size: V3; color: string }) {
  return (
    <mesh position={[...center]} castShadow receiveShadow raycast={noRaycast}>
      <boxGeometry args={[...size]} />
      <Toon color={color} />
    </mesh>
  );
}

/**
 * The top of the ground landing, which sits level with the yard floor. The offset
 * draws this top over the floor and over the box beneath it. The box sides keep
 * their depth, so they cannot show through the floor.
 */
function LandingTop({ center, size, color }: { center: V3; size: V3; color: string }) {
  return (
    <mesh position={[center[0], center[1] + size[1] / 2, center[2]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={noRaycast}>
      <planeGeometry args={[size[0], size[2]]} />
      <Toon color={color} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  );
}

function groundLanding(): (typeof STORAGE_SOLIDS)[number] {
  const solid = STORAGE_SOLIDS.find((entry) => entry.id === 'storage-landing-0');
  if (!solid) throw new Error('WRECK_YARD_GROUND_LANDING_MISSING');
  return solid;
}
const GROUND_LANDING = groundLanding();

interface CanvasPanel {
  readonly context: CanvasRenderingContext2D;
  readonly material: THREE.MeshBasicMaterial;
  readonly texture: THREE.CanvasTexture;
}

function createCanvasPanel(width: number, height: number): CanvasPanel {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('WRECK_YARD_STORAGE_PANEL_CONTEXT');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide });
  return { context, material, texture };
}

function useCanvasPanel(width: number, height: number): CanvasPanel {
  const panel = useMemo(() => createCanvasPanel(width, height), [width, height]);
  useEffect(() => () => {
    panel.material.dispose();
    panel.texture.dispose();
  }, [panel]);
  return panel;
}

function paintPanelFrame(context: CanvasRenderingContext2D, title: string) {
  const { width, height } = context.canvas;
  context.fillStyle = '#1c282f';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = '#121a1f';
  context.lineWidth = Math.max(8, width * 0.018);
  context.strokeRect(7, 7, width - 14, height - 14);
  context.fillStyle = '#c87536';
  context.fillRect(width * 0.035, height * 0.035, width * 0.93, height * 0.11);
  context.fillStyle = '#18212b';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `bold ${Math.round(height * 0.065)}px Arial, sans-serif`;
  context.fillText(title, width / 2, height * 0.09, width * 0.88);
}

function paintStorageInfo(context: CanvasRenderingContext2D, actual: number) {
  const { width, height } = context.canvas;
  paintPanelFrame(context, 'STORAGE');
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#f0d7a5';
  context.font = `bold ${Math.round(height * 0.15)}px Arial, sans-serif`;
  context.fillText('STACK LIMIT: 4', width / 2, height * 0.36, width * 0.9);
  context.fillStyle = '#f6a64f';
  context.font = `bold ${Math.round(height * 0.14)}px Arial, sans-serif`;
  context.fillText(`ACTUAL: ${actual}`, width / 2, height * 0.56, width * 0.9);
}

function StorageInfoSign({ renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  const panel = useCanvasPanel(900, 420);
  const bodiesSeen = useRef<readonly YardBody[] | null>(null);
  const shownCount = useRef<number>(STORAGE.count);

  useFrame(() => {
    const bodies = renderRef.current?.bodies;
    if (!bodies || bodiesSeen.current === bodies) return;
    bodiesSeen.current = bodies;
    const actual = bodies.reduce((count, body) => count + (body.storageBay === 'storage' && isIntactShippingCrate(body) ? 1 : 0), 0);
    if (actual === shownCount.current) return;
    shownCount.current = actual;
    paintStorageInfo(panel.context, actual);
    panel.texture.needsUpdate = true;
  });

  useEffect(() => {
    paintStorageInfo(panel.context, STORAGE.count);
    panel.texture.needsUpdate = true;
  }, [panel]);

  const frontZ = STORAGE.center[2] + STORAGE.rows * STORAGE.spacing * 0.5 + 0.42;
  const center: V3 = [STORAGE.center[0], FLOOR_Y + 1.28, frontZ];
  return (
    <group name="StorageInfoSign">
      <mesh position={[center[0], center[1], center[2] + 0.006]} material={panel.material} raycast={noRaycast}>
        <planeGeometry args={[4.7, 1.62]} />
      </mesh>
    </group>
  );
}

function paintLanding(context: CanvasRenderingContext2D, floor: ElevatorFloor) {
  const { width, height } = context.canvas;
  context.fillStyle = '#25323a';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#c87536';
  context.fillRect(0, 0, width, height * 0.17);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#f0d7a5';
  context.font = `bold ${Math.round(height * 0.56)}px Arial, sans-serif`;
  context.fillText(floor === 0 ? 'G' : String(floor), width / 2, height * 0.58);
  context.fillStyle = '#d2d7d3';
  context.font = `bold ${Math.round(height * 0.14)}px Arial, sans-serif`;
  context.fillText(floor === 0 ? 'GROUND' : `FLOOR ${floor}`, width / 2, height * 0.88);
}

function LandingSign({ floor }: { floor: ElevatorFloor }) {
  const panel = useCanvasPanel(256, 192);
  useEffect(() => {
    paintLanding(panel.context, floor);
    panel.texture.needsUpdate = true;
  }, [floor, panel]);
  const y = ELEVATOR.floors[floor] + 0.92;
  const z = ELEVATOR.z + 1.88;
  return (
    <group name={`ElevatorLanding${floor}`}>
      <mesh position={[STORAGE_LANDING_SIGN_X, y, z + 0.006]} material={panel.material} raycast={noRaycast}>
        <planeGeometry args={[0.74, 0.46]} />
      </mesh>
    </group>
  );
}

function floorNumber(floor: ElevatorFloor): string {
  return floor === 0 ? 'G' : String(floor);
}

function nearestFloor(y: number): ElevatorFloor {
  let nearest: ElevatorFloor = 0;
  for (const floor of [1, 2, 3] as const) {
    if (Math.abs(y - ELEVATOR.floors[floor]) < Math.abs(y - ELEVATOR.floors[nearest])) nearest = floor;
  }
  return nearest;
}

function paintElevatorControl(context: CanvasRenderingContext2D, state: AttractionState['elevator']) {
  const { width, height } = context.canvas;
  context.fillStyle = '#18252c';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = '#10181d';
  context.lineWidth = 8;
  context.strokeRect(4, 4, width - 8, height - 8);
  context.fillStyle = '#c87536';
  context.fillRect(12, 12, width - 24, 96);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#19232a';
  context.font = 'bold 30px Arial, sans-serif';
  context.fillText('FLOOR SELECT', width / 2, 60);

  const floor = nearestFloor(state.y);
  context.fillStyle = state.status === 'blocked' ? '#ee684d' : '#f0d7a5';
  context.font = 'bold 25px Arial, sans-serif';
  const status = state.status === 'moving'
    ? `MOVING TO ${floorNumber(state.target)}`
    : state.status === 'blocked'
      ? `BLOCKED AT ${floorNumber(floor)}`
      : `AT FLOOR ${floorNumber(floor)}`;
  context.fillText(status, width / 2, 152, width - 24);

  context.textAlign = 'left';
  context.fillStyle = '#dce1dd';
  context.font = 'bold 26px Arial, sans-serif';
  for (const selected of [0, 1, 2, 3] as const) {
    const y = 260 + selected * 106;
    context.fillStyle = selected === state.target ? '#f6a64f' : '#dce1dd';
    context.fillText(selected === 0 ? 'G   GROUND' : `${selected}   FLOOR ${selected}`, 34, y, width - 48);
    context.fillStyle = '#3b4a51';
    context.fillRect(26, y + 38, width - 52, 2);
  }
}

function ElevatorControl({ renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  const panel = useCanvasPanel(320, 700);
  const buttonMaterials = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const lastState = useRef('');
  const position: V3 = [
    STORAGE_ELEVATOR_CAR_FIXTURE.center[0],
    STORAGE_ELEVATOR_CAR_FIXTURE.center[1] - ELEVATOR.size[1] / 2,
    STORAGE_ELEVATOR_CAR_FIXTURE.center[2],
  ];

  useFrame(() => {
    const elevator = renderRef.current?.attractions.elevator;
    if (!elevator) return;
    const key = `${nearestFloor(elevator.y)}:${elevator.target}:${elevator.status}`;
    if (lastState.current !== key) {
      lastState.current = key;
      paintElevatorControl(panel.context, elevator);
      panel.texture.needsUpdate = true;
    }
    for (let index = 0; index < buttonMaterials.current.length; index += 1) {
      const material = buttonMaterials.current[index];
      if (material) material.color.set(index === elevator.target ? '#f6a64f' : '#61757b');
    }
  });

  useEffect(() => {
    paintElevatorControl(panel.context, { y: ELEVATOR.floors[0], velocity: 0, target: 0, status: 'ready' });
    panel.texture.needsUpdate = true;
  }, [panel]);

  return (
    <group name="ElevatorControlPanel">
      <group position={[...position]}>
        <Block center={[0, 0, 0]} size={[...STORAGE_ELEVATOR_CAR_FIXTURE.size]} color={DARK_STEEL} />
        <mesh position={[-0.12, 0, 0.086]} material={panel.material} raycast={noRaycast}>
          <planeGeometry args={[0.78, 2.18]} />
        </mesh>
        {([0, 1, 2, 3] as const).map((floor) => {
          const y = (0.5 - (260 + floor * 106) / 700) * 2.18;
          return (
            <mesh
              key={floor}
              ref={(mesh) => { buttonMaterials.current[floor] = mesh?.material as THREE.MeshBasicMaterial | null; }}
              position={[0.37, y, 0.108]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
              raycast={noRaycast}
            >
              <cylinderGeometry args={[0.105, 0.105, 0.055, 16]} />
              <meshBasicMaterial color="#61757b" toneMapped={false} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function paintRestackPanel(context: CanvasRenderingContext2D, status: AttractionState['resetStatus']) {
  const { width, height } = context.canvas;
  context.fillStyle = '#1c282f';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = '#111a20';
  context.lineWidth = 8;
  context.strokeRect(4, 4, width - 8, height - 8);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#f0d7a5';
  context.font = 'bold 52px Arial, sans-serif';
  context.fillText('RESTACK', width / 2, height * 0.42);
  context.fillStyle = status === 'blocked' ? '#ef7256' : '#89b17b';
  context.font = 'bold 24px Arial, sans-serif';
  context.fillText(status === 'blocked' ? 'CLEAR THE BAY' : 'READY', width / 2, height * 0.79);
}

function RestackControl({ renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  const panel = useCanvasPanel(360, 180);
  const lastStatus = useRef<AttractionState['resetStatus'] | null>(null);
  const [x, , z] = ELEVATOR.resetButton;

  useFrame(() => {
    const status = renderRef.current?.attractions.resetStatus;
    if (!status || status === lastStatus.current) return;
    lastStatus.current = status;
    paintRestackPanel(panel.context, status);
    panel.texture.needsUpdate = true;
  });

  useEffect(() => {
    paintRestackPanel(panel.context, 'ready');
    panel.texture.needsUpdate = true;
  }, [panel]);

  return (
    <group name="RestackControl">
      <mesh position={[x, FLOOR_Y + 1.38, z + 0.437]} material={panel.material} raycast={noRaycast}>
        <planeGeometry args={[1.39, 0.68]} />
      </mesh>
    </group>
  );
}

function ElevatorCar({ renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  const car = useRef<THREE.Group>(null);
  const cables = useRef<(THREE.Group | null)[]>([]);

  useFrame(() => {
    const render = renderRef.current;
    const pose = render?.poses.get(ELEVATOR.id);
    const platformCenterY = pose?.position[1] ?? (render?.attractions.elevator.y ?? ELEVATOR.floors[0]) - ELEVATOR.size[1] / 2;
    const platformTopY = platformCenterY + ELEVATOR.size[1] / 2;
    if (car.current) car.current.position.set(ELEVATOR.x, platformTopY, ELEVATOR.z);
    const roofBottomY = TOP_Y - 0.09;
    const cableLength = Math.max(0.04, roofBottomY - platformTopY - 0.02);
    const cableCenterY = platformTopY + cableLength / 2;
    cables.current.forEach((cable) => {
      if (!cable) return;
      cable.position.y = cableCenterY;
      cable.scale.y = cableLength;
    });
  });

  return (
    <>
      {[0, 1].map((index) => (
        <group
          key={index}
          ref={(group) => { cables.current[index] = group; }}
          position={[ELEVATOR.x, TOP_Y / 2 + FLOOR_Y / 2, ELEVATOR.z + (index === 0 ? -1.12 : 1.12)]}
        >
          <mesh raycast={noRaycast} userData={{ nonSolidDecoration: true }}>
            <cylinderGeometry args={[0.024, 0.024, 1, 8]} />
            <Toon color={STEEL} />
          </mesh>
        </group>
      ))}
      <Block center={[ELEVATOR.x, TOP_Y, ELEVATOR.z]} size={[3.5, 0.18, 3.5]} color={DARK_STEEL} />
      <group ref={car} name="ElevatorPlatform" position={[ELEVATOR.x, ELEVATOR.floors[0], ELEVATOR.z]}>
        <Block center={[0, -ELEVATOR.size[1] / 2, 0]} size={[...ELEVATOR.size]} color={STEEL} />
        <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
          <planeGeometry args={[3.02, 3.02]} />
          <meshBasicMaterial color="#343d3e" toneMapped={false} />
        </mesh>
        {[-1, 1].map((side) => (
          <Block key={side} center={[side * 1.4, 0.001, 0]} size={[0.16, 0.002, 2.75]} color={ORANGE} />
        ))}
        {[-1, 1].map((side) => (
          <Block key={`depth-${side}`} center={[0, 0.001, side * 1.4]} size={[2.75, 0.002, 0.16]} color={ORANGE} />
        ))}
        <ElevatorControl renderRef={renderRef} />
      </group>
    </>
  );
}

function ElevatorShaft({ renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  return (
    <group name="ElevatorShaft">
      {STORAGE_SOLIDS.map((solid) => (
        <Block
          key={solid.id}
          center={solid.center}
          size={solid.size}
          color={solid.id.startsWith('storage-guide') ? STEEL : '#756b57'}
        />
      ))}
      <LandingTop center={GROUND_LANDING.center} size={GROUND_LANDING.size} color="#756b57" />
      {[0, 1, 2, 3].map((floor) => <LandingSign key={floor} floor={floor as ElevatorFloor} />)}
      <ElevatorCar renderRef={renderRef} />
    </group>
  );
}

export function StorageAttraction({ renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  return (
    <group name="StorageAttraction">
      {STORAGE_FIXTURE_SOLIDS.map((solid) => {
        const color = solid.id === 'storage-restack-button'
          ? ORANGE
          : solid.id === 'storage-restack-pedestal'
            ? STEEL
            : DARK_STEEL;
        return <Block key={solid.id} center={solid.center} size={solid.size} color={color} />;
      })}
      <StorageInfoSign renderRef={renderRef} />
      <RestackControl renderRef={renderRef} />
      <ElevatorShaft renderRef={renderRef} />
    </group>
  );
}
