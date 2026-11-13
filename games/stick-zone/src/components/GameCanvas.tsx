import { telemetry } from "../render/telemetry.js";
import React, { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { SectorDepotSimulation } from "../sim/game.js";
import { DEPOT_CONTAINERS } from "../sim/game.js";
import { globalCutaway } from "../render/cutaway.js";
import { SectorMap } from "./SectorMap.js";
import { SharedGeometries, SharedMaterials } from "../render/materials.js";
import { StickOperative } from "./StickOperative.js";
import { RivalOperative } from "./RivalOperative.js";
import { MachineEnemy } from "./MachineEnemy.js";
import { sound } from "../audio.js";
import { ExfilZone } from "./ExfilZone.js";
import { InkEffects } from "../render/InkEffects.js";
import { InkTrails } from "../render/InkTrails.js";
import { ShatterMesh } from "../render/ShatterMesh.js";
import {
  cameraImpulse,
  cameraOnActorSide,
  createCameraObstacles,
  computeCameraLookAhead,
  computeCameraKineticHeight,
  computeTraumaImpulse,
} from "../render/cameraKinetics.js";

interface GameCanvasProps {
  sim: SectorDepotSimulation;
}

const cameraObstacles = createCameraObstacles(DEPOT_CONTAINERS);

const DynamicShadowLight: React.FC<{ playerPos: { x: number; y: number; z: number } }> = ({ playerPos }) => {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);
  const lastPosRef = useRef({ x: -9999, z: -9999 });

  useFrame(() => {
    if (lightRef.current && targetRef.current) {
      const snapX = Math.round(playerPos.x * 2) / 2;
      const snapZ = Math.round(playerPos.z * 2) / 2;
      if (snapX !== lastPosRef.current.x || snapZ !== lastPosRef.current.z) {
        lastPosRef.current.x = snapX;
        lastPosRef.current.z = snapZ;
        targetRef.current.position.set(snapX, 0, snapZ);
        targetRef.current.updateMatrixWorld();
        lightRef.current.target = targetRef.current;
        lightRef.current.position.set(snapX + 25, 45, snapZ + 18);
      }
    }
  });

  return (
    <>
      <object3D ref={targetRef} position={[playerPos.x, 0, playerPos.z]} />
      <directionalLight
        ref={lightRef}
        position={[playerPos.x + 25, 45, playerPos.z + 18]}
        intensity={2.2}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={5}
        shadow-camera-far={95}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-bias={-0.0005}
      />
    </>
  );
};

const CameraController: React.FC<{
  playerPos: { x: number; y: number; z: number };
  isCorridorActive?: boolean;
  sim: SectorDepotSimulation;
  recoilImpulseRef: React.MutableRefObject<[number, number]>;
}> = ({ playerPos, sim, recoilImpulseRef }) => {
  const isTestMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("testMode") === "1";
  const initialCamY = 16.0;
  const initialCamZ = sim.zoneMode === "hub" ? 7.5 : 6.46;
  const baseCameraPos = useRef(
    isTestMode
      ? new THREE.Vector3(0, 10.0, -10.0)
      : new THREE.Vector3(playerPos.x, playerPos.y + initialCamY, playerPos.z + initialCamZ)
  );
  const baseCameraTarget = useRef(
    isTestMode
      ? new THREE.Vector3(0, 0, 0)
      : new THREE.Vector3(playerPos.x, playerPos.y + 1.0, playerPos.z)
  );
  const lastDamageTickRef = useRef(0);
  const damageTraumaRef = useRef({ angleDeg: 0, amount: 0, timestamp: 0 });

  useFrame(({ camera }, delta) => {
    const isPaused =
      typeof window !== "undefined" &&
      Boolean((window as any).__STICK_ZONE_TEST__?.isPaused);
    if (isPaused) return;

    // Responsive 14Hz exp dampening for immediate, silky smooth camera tracking
    const lerpFactor = 1 - Math.exp(-14 * Math.min(delta, 0.1));

    // Dynamic extraction presentation check from live simulation state
    const exfilState = sim.exfilController.getState();
    const isCorridor =
      exfilState.kind === "corridor_presentation" ||
      exfilState.kind === "submitting_settlement" ||
      exfilState.kind === "extracted";

    let desiredX: number;
    let desiredY: number;
    let desiredZ: number;
    let targetX: number;
    let targetY: number;
    let targetZ: number;

    if (isTestMode && playerPos.x === 0 && playerPos.z === 0) {
      // Deterministic fixed top-down camera for visual test harness
      desiredX = 0;
      desiredY = 10.0;
      desiredZ = -10.0;
      targetX = 0;
      targetY = 0;
      targetZ = 0;
    } else if (isCorridor) {
      // Cinematic low-angle corridor vantage
      desiredX = playerPos.x + 3.0;
      desiredY = playerPos.y + 4.0;
      desiredZ = playerPos.z + 5.5;
      targetX = playerPos.x;
      targetY = playerPos.y + 1.2;
      targetZ = playerPos.z;
    } else if (sim.zoneMode === "hub") {
      // FOB Outpost tactical staging vantage with smooth responsive aim look-ahead
      const vx = (sim.slideTicksRemaining > 0 ? sim.slideVx : sim.walkVx) || 0;
      const vz = (sim.slideTicksRemaining > 0 ? sim.slideVz : sim.walkVz) || 0;
      const hubLead = computeCameraLookAhead(sim.player.facing, { x: vx, z: vz }, {
        aimLeadDistance: 1.8,
        velocityLeadFactor: 0.25,
        maxOffset: 3.2,
      });
      desiredX = playerPos.x + hubLead.offsetX;
      desiredY = playerPos.y + 16.0;
      desiredZ = playerPos.z + hubLead.offsetZ + 7.5;
      targetX = playerPos.x + hubLead.offsetX;
      targetY = playerPos.y + 1.0;
      targetZ = playerPos.z + hubLead.offsetZ;
    } else {
      // Top-down tactical extraction vantage (68.0 deg tactical angle)
      // Look-ahead tracking downrange crosshair and movement velocity
      const vx = (sim.slideTicksRemaining > 0 ? sim.slideVx : sim.walkVx) || 0;
      const vz = (sim.slideTicksRemaining > 0 ? sim.slideVz : sim.walkVz) || 0;
      const isSliding = sim.player.isSliding || sim.player.action === "slide" || ((sim.player.slideTicksRemaining || 0) > 0);
      const isSprinting = sim.player.action === "sprint";
      const kineticHeight = computeCameraKineticHeight(16.0, {
        isSliding,
        isSprinting,
        isAds: sim.isAds,
      });
      const lookAhead = computeCameraLookAhead(sim.player.facing, { x: vx, z: vz }, {
        aimLeadDistance: sim.isAds ? 3.6 : 2.4,
        velocityLeadFactor: isSprinting ? 0.38 : 0.30,
        maxOffset: 4.8,
      });

      desiredX = playerPos.x + lookAhead.offsetX;
      desiredY = playerPos.y + kineticHeight;
      desiredZ = playerPos.z + lookAhead.offsetZ + 6.46;
      targetX = playerPos.x + lookAhead.offsetX;
      targetY = playerPos.y + 1.0;
      targetZ = playerPos.z + lookAhead.offsetZ;
    }

    baseCameraPos.current.x = THREE.MathUtils.lerp(
      baseCameraPos.current.x,
      desiredX,
      lerpFactor
    );
    baseCameraPos.current.y = THREE.MathUtils.lerp(
      baseCameraPos.current.y,
      desiredY,
      lerpFactor
    );
    baseCameraPos.current.z = THREE.MathUtils.lerp(
      baseCameraPos.current.z,
      desiredZ,
      lerpFactor
    );

    baseCameraTarget.current.x = THREE.MathUtils.lerp(
      baseCameraTarget.current.x,
      targetX,
      lerpFactor
    );
    baseCameraTarget.current.y = THREE.MathUtils.lerp(
      baseCameraTarget.current.y,
      targetY,
      lerpFactor
    );
    baseCameraTarget.current.z = THREE.MathUtils.lerp(
      baseCameraTarget.current.z,
      targetZ,
      lerpFactor
    );

    // Update Inkline foreground cutaway aperture around operative
    const playerFocus = new THREE.Vector3(playerPos.x, playerPos.y + 0.95, playerPos.z);
    globalCutaway.update(camera, playerFocus, 1.85, delta);

    if (typeof window !== "undefined" && (window as any).__STICK_ZONE_TEST__) {
      (window as any).__STICK_ZONE_TEST__.lastCameraOcclusion = {
        adjusted: false,
        obstacleIndex: null,
        cutawayAmount: globalCutaway.amount,
      };
    }

    // Assign plain coordinate objects matching game.ts types (no camera zoom-in against walls)
    sim.cameraPos = {
      x: baseCameraPos.current.x,
      y: baseCameraPos.current.y,
      z: baseCameraPos.current.z,
    };
    sim.cameraTarget = {
      x: baseCameraTarget.current.x,
      y: baseCameraTarget.current.y,
      z: baseCameraTarget.current.z,
    };

    // Process incoming damage camera trauma impulse
    if (sim.lastPlayerDamageTick > 0 && sim.lastPlayerDamageTick !== lastDamageTickRef.current) {
      lastDamageTickRef.current = sim.lastPlayerDamageTick;
      damageTraumaRef.current = {
        angleDeg: sim.lastDamageDirectionDeg ?? 0,
        amount: sim.lastPlayerDamageAmount,
        timestamp: performance.now(),
      };
    }

    const traumaAgeSec = damageTraumaRef.current.timestamp > 0
      ? (performance.now() - damageTraumaRef.current.timestamp) / 1000
      : 999;
    const traumaOffset = computeTraumaImpulse(
      damageTraumaRef.current.angleDeg,
      damageTraumaRef.current.amount,
      traumaAgeSec
    );

    // Apply recoil impulse and trauma displacement strictly as transient render offset
    const [recoilX, recoilY] = recoilImpulseRef.current;
    camera.position.set(
      baseCameraPos.current.x + recoilX + traumaOffset.x,
      baseCameraPos.current.y + recoilY + traumaOffset.y,
      baseCameraPos.current.z + traumaOffset.z
    );
    camera.lookAt(
      baseCameraTarget.current.x,
      baseCameraTarget.current.y,
      baseCameraTarget.current.z
    );

    // Dynamic FOV kinetics: ADS zoom, kinetic speed stretch & recoil punch
    if (!isTestMode && "fov" in camera) {
      const persCamera = camera as THREE.PerspectiveCamera;
      let targetFov = 46.0;
      const isSliding = sim.player.isSliding || sim.player.action === "slide" || ((sim.player.slideTicksRemaining || 0) > 0);
      if (sim.isAds) {
        targetFov = 38.0; // Precision tactical ADS focus zoom
      } else if (isSliding) {
        targetFov = 52.5; // Dynamic anime speed perspective stretch
      }
      const newFov = THREE.MathUtils.lerp(persCamera.fov, targetFov, lerpFactor);
      if (Math.abs(persCamera.fov - newFov) > 0.02) {
        persCamera.fov = newFov;
        persCamera.updateProjectionMatrix();
      }
      sim.cameraFov = persCamera.fov;
    }
  });

  return null;
};

const HIT_POOL_SIZE = 32;

interface PooledFloatingHit {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  startX: number;
  startY: number;
  startZ: number;
  birth: number;
  duration: number;
  isCrit: boolean;
  active: boolean;
}

// Pre-allocated scratch vectors to eliminate runtime object allocations in useFrame
const _scratchOrigin = new THREE.Vector3();
const _scratchImpact = new THREE.Vector3();
const _scratchElim = new THREE.Vector3();
const _scratchKick = new THREE.Vector3();
const _scratchHit = new THREE.Vector3();
const _scratchBlast = new THREE.Vector3();
const _scratchLocomotion = new THREE.Vector3();


const PROJECTILE_POOL_SIZE = 48;
const _dummy = new THREE.Object3D();
const _colCore = new THREE.Color();
const _colTail = new THREE.Color();

const ActiveProjectilesRenderer: React.FC<{ sim: SectorDepotSimulation }> = ({ sim }) => {
  const { coreInstanced, outlineInstanced, tailInstanced, shadowInstanced } = useMemo(() => {
    const core = new THREE.InstancedMesh(SharedGeometries.projectileCore, SharedMaterials.goldBullet.clone(), PROJECTILE_POOL_SIZE);
    const outline = new THREE.InstancedMesh(SharedGeometries.projectileOutline, (SharedMaterials as any).projectileOutlineBackside?.clone() || SharedMaterials.darkNavy.clone(), PROJECTILE_POOL_SIZE);
    const tail = new THREE.InstancedMesh(SharedGeometries.projectileTail, SharedMaterials.amberWarning.clone(), PROJECTILE_POOL_SIZE);
    const shadow = new THREE.InstancedMesh(SharedGeometries.projectileShadow, SharedMaterials.shadowDark.clone(), PROJECTILE_POOL_SIZE);

    core.frustumCulled = false;
    outline.frustumCulled = false;
    tail.frustumCulled = false;
    shadow.frustumCulled = false;

    core.count = 0;
    outline.count = 0;
    tail.count = 0;
    shadow.count = 0;

    return { coreInstanced: core, outlineInstanced: outline, tailInstanced: tail, shadowInstanced: shadow };
  }, []);

  useEffect(() => {
    return () => {
      coreInstanced.dispose();
      outlineInstanced.dispose();
      tailInstanced.dispose();
      shadowInstanced.dispose();
    };
  }, [coreInstanced, outlineInstanced, tailInstanced, shadowInstanced]);

  useFrame(() => {
    const isPaused =
      typeof window !== "undefined" &&
      Boolean((window as any).__STICK_ZONE_TEST__?.isPaused);
    if (isPaused) return;

    const projs = sim.activeProjectiles;
    const count = Math.min(projs.length, PROJECTILE_POOL_SIZE);

    for (let i = 0; i < count; i++) {
      const p = projs[i];
      const speed = Math.hypot(p.vx, p.vy, p.vz) || 1;
      const dirX = p.vx / speed;
      const dirY = p.vy / speed;
      const dirZ = p.vz / speed;

      const baseScale = p.isPellet ? 0.75 : 1.0;

      // Core & Outline matrix
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.lookAt(p.x + dirX, p.y + dirY, p.z + dirZ);
      _dummy.scale.set(baseScale, baseScale, baseScale * 1.2);
      _dummy.updateMatrix();
      coreInstanced.setMatrixAt(i, _dummy.matrix);
      outlineInstanced.setMatrixAt(i, _dummy.matrix);

      // Tail matrix: sleek aerodynamic tracer trail matching shooting velocity
      const tailLen = p.isPellet ? 0.55 : 0.95;
      _dummy.scale.set(baseScale * 0.8, baseScale * 0.8, tailLen);
      _dummy.updateMatrix();
      tailInstanced.setMatrixAt(i, _dummy.matrix);

      // Shadow matrix on ground plane
      _dummy.position.set(p.x, 0.02, p.z);
      _dummy.rotation.set(-Math.PI / 2, 0, 0);
      _dummy.scale.set(baseScale, baseScale, 1);
      _dummy.updateMatrix();
      shadowInstanced.setMatrixAt(i, _dummy.matrix);

      // Dynamic colors
      if (p.shooterIsPlayer) {
        _colCore.set(p.isPellet ? "#fef08a" : "#fde047");
        _colTail.set(p.isPellet ? "#facc15" : "#f59e0b");
      } else {
        _colCore.set("#ff1a1a");
        _colTail.set("#ff6600");
      }
      coreInstanced.setColorAt(i, _colCore);
      tailInstanced.setColorAt(i, _colTail);
    }

    coreInstanced.count = count;
    outlineInstanced.count = count;
    tailInstanced.count = count;
    shadowInstanced.count = count;

    if (count > 0) {
      coreInstanced.instanceMatrix.needsUpdate = true;
      outlineInstanced.instanceMatrix.needsUpdate = true;
      tailInstanced.instanceMatrix.needsUpdate = true;
      shadowInstanced.instanceMatrix.needsUpdate = true;
      if (coreInstanced.instanceColor) coreInstanced.instanceColor.needsUpdate = true;
      if (tailInstanced.instanceColor) tailInstanced.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      <primitive object={coreInstanced} />
      <primitive object={outlineInstanced} />
      <primitive object={tailInstanced} />
      <primitive object={shadowInstanced} />
    </>
  );
};

const MAX_GRENADES = 12;

const ActiveGrenadesRenderer: React.FC<{ sim: SectorDepotSimulation }> = ({ sim }) => {
  const groupsRef = useRef<(THREE.Group | null)[]>([]);
  const meshRefs = useRef<(THREE.Group | null)[]>([]);
  const fuseRefs = useRef<(THREE.Mesh | null)[]>([]);
  const shadowRefs = useRef<(THREE.Mesh | null)[]>([]);
  const rotRefs = useRef<Array<{ x: number; y: number; z: number }>>(
    Array.from({ length: MAX_GRENADES }, () => ({ x: 0, y: 0, z: 0 }))
  );

  useFrame((_, delta) => {
    const isPaused =
      typeof window !== "undefined" &&
      Boolean((window as any).__STICK_ZONE_TEST__?.isPaused);
    if (isPaused) return;

    const grenades = sim.activeGrenades;
    for (let i = 0; i < MAX_GRENADES; i++) {
      const group = groupsRef.current[i];
      const mesh = meshRefs.current[i];
      const fuse = fuseRefs.current[i];
      const shadow = shadowRefs.current[i];
      if (!group) continue;

      if (i < grenades.length) {
        const g = grenades[i];
        group.visible = true;
        group.position.set(g.x, g.y, g.z);

        // Dynamic 3D physics tumbling in flight
        const rot = rotRefs.current[i];
        const isAirborne = g.y > 0.22 || Math.hypot(g.vx, g.vz) > 1.0;
        if (isAirborne) {
          rot.x += delta * 8.5;
          rot.y += delta * 6.0;
          rot.z += delta * 7.0;
        } else {
          // Settled on ground, roll slightly along momentum
          rot.x = THREE.MathUtils.lerp(rot.x, Math.PI / 2, Math.min(1, delta * 12));
          rot.y += delta * 1.5;
        }
        if (mesh) {
          mesh.rotation.set(rot.x, rot.y, rot.z);
        }

        // Blinking tactical fuse beacon: accelerates as fuse runs down
        if (fuse && fuse.material) {
          const blinkRate = g.fuseTicks < 30 ? 3 : 6;
          const isBlinkOn = Math.floor(g.fuseTicks / blinkRate) % 2 === 0;
          const mat = fuse.material as THREE.MeshBasicMaterial;
          mat.color.set(isBlinkOn ? "#ff2222" : "#ffffff");
        }

        // Dynamic ground contact shadow projected onto terrain at y = 0.02
        if (shadow) {
          shadow.position.set(0, -g.y + 0.02, 0);
          const heightScale = Math.max(0.2, 1.0 - g.y * 0.22);
          shadow.scale.set(heightScale, heightScale, 1);
          if (shadow.material) {
            (shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.25, 0.75 - g.y * 0.15);
          }
        }
      } else {
        group.visible = false;
      }
    }
  });

  return (
    <>
      {Array.from({ length: MAX_GRENADES }).map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            groupsRef.current[i] = el;
          }}
          visible={false}
        >
          {/* Tactical Pineapple F-1 Frag Grenade Body (High Readability Scale) */}
          <group
            ref={(el) => {
              meshRefs.current[i] = el;
            }}
          >
            {/* Cast shadow grenade core */}
            <mesh castShadow>
              <cylinderGeometry args={[0.15, 0.17, 0.32, 12]} />
              <meshStandardMaterial color="#475e2e" roughness={0.8} metalness={0.2} />
            </mesh>
            {/* Pineapple fragmentation ribbed ring */}
            <mesh>
              <torusGeometry args={[0.165, 0.035, 8, 16]} />
              <meshStandardMaterial color="#2d3f1a" roughness={0.9} metalness={0.1} />
            </mesh>
            {/* Dark Inkline comic outline */}
            <mesh scale={[1.18, 1.14, 1.18]}>
              <cylinderGeometry args={[0.15, 0.17, 0.32, 12]} />
              <meshBasicMaterial color="#000000" side={THREE.BackSide} />
            </mesh>
            {/* Metal collar & fuse striker head */}
            <mesh position={[0, 0.19, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 0.09, 8]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.8} />
            </mesh>
            {/* Lever spoon mechanism */}
            <mesh position={[0.06, 0.12, 0]} rotation={[0, 0, -0.2]}>
              <boxGeometry args={[0.03, 0.24, 0.05]} />
              <meshStandardMaterial color="#64748b" roughness={0.5} metalness={0.7} />
            </mesh>
            {/* High-visibility glowing crimson fuse LED */}
            <mesh
              ref={(el) => {
                fuseRefs.current[i] = el;
              }}
              position={[0, 0.25, 0]}
            >
              <sphereGeometry args={[0.065, 8, 8]} />
              <meshBasicMaterial color="#ff2222" />
            </mesh>
            <pointLight position={[0, 0.25, 0]} color="#ef4444" intensity={2.0} distance={3.5} />
          </group>

          {/* Dynamic ground shadow */}
          <mesh
            ref={(el) => {
              shadowRefs.current[i] = el;
            }}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.02, 0]}
          >
            <circleGeometry args={[0.26, 16]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.65} />
          </mesh>
        </group>
      ))}
    </>
  );
};

const PresentationFXManager: React.FC<{
  sim: SectorDepotSimulation;
  recoilImpulseRef: React.MutableRefObject<[number, number]>;
  onRegisterHarness?: (harness: {
    effects: InkEffects;
    trails: InkTrails;
    shatter: ShatterMesh;
  }) => void;
}> = ({ sim, recoilImpulseRef, onRegisterHarness }) => {
  const { camera } = useThree();
  const effects = useMemo(() => new InkEffects(2048), []);
  const trails = useMemo(() => new InkTrails(), []);
  const shatter = useMemo(() => new ShatterMesh(256), []);
  // Floating tactical damage numbers directly over targets (Object-pooled)
  const floatingGroup = useMemo(() => new THREE.Group(), []);
  const floatingHitPool = useMemo<PooledFloatingHit[]>(() => {
    if (typeof document === "undefined") return [];
    return Array.from({ length: HIT_POOL_SIZE }, () => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext("2d")!;
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      floatingGroup.add(sprite);
      return {
        sprite,
        material,
        texture,
        canvas,
        ctx,
        startX: 0,
        startY: 0,
        startZ: 0,
        birth: 0,
        duration: 750,
        isCrit: false,
        active: false,
      };
    });
  }, [floatingGroup]);

  const spawnFloatingHit = useCallback((
    pos: { x: number; y: number; z: number },
    text: string,
    color: string,
    isCrit: boolean
  ) => {
    if (floatingHitPool.length === 0) return;
    let slot = floatingHitPool.find((h) => !h.active);
    if (!slot) {
      let oldestBirth = Infinity;
      slot = floatingHitPool[0];
      for (const h of floatingHitPool) {
        if (h.birth < oldestBirth) {
          oldestBirth = h.birth;
          slot = h;
        }
      }
    }

    slot.active = true;
    slot.startX = pos.x;
    slot.startY = pos.y + 0.6;
    slot.startZ = pos.z;
    slot.birth = performance.now();
    slot.duration = 750;
    slot.isCrit = isCrit;

    const ctx = slot.ctx;
    ctx.clearRect(0, 0, 256, 128);
    ctx.font = isCrit ? "900 48px monospace" : "900 40px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 7;
    ctx.strokeStyle = "rgba(10, 15, 20, 0.95)";
    ctx.lineJoin = "round";
    ctx.strokeText(text, 128, 64);
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 64);

    slot.texture.needsUpdate = true;
    slot.material.opacity = 1.0;
    const baseScale = isCrit ? 1.8 : 1.4;
    slot.sprite.scale.set(baseScale, baseScale * 0.5, 1);
    slot.sprite.position.set(pos.x, slot.startY, pos.z);
    slot.sprite.visible = true;
  }, [floatingHitPool]);

  const recoilAgeRef = useRef(-1);
  const aimPunchAgeRef = useRef(-1);
  const aimPunchDirRef = useRef<[number, number]>([0, 0]);
  const lastDamageTickRef = useRef(0);

  useEffect(() => {
    onRegisterHarness?.({ effects, trails, shatter });
  }, [effects, trails, shatter, onRegisterHarness]);

  useEffect(() => {
    return () => {
      effects.dispose();
      trails.dispose();
      shatter.dispose();
      for (const h of floatingHitPool) {
        floatingGroup.remove(h.sprite);
        h.material.dispose();
        h.texture.dispose();
      }
    };
  }, [effects, trails, shatter]);

  useFrame((state, delta) => {
    const isPaused =
      typeof window !== "undefined" &&
      Boolean((window as any).__STICK_ZONE_TEST__?.isPaused);
    if (isPaused) return;

    // Single-owner presentation event drain
    const events = sim.drainPresentationEvents();
    const elapsedTime = state.clock.getElapsedTime();

    for (const ev of events) {
      if (ev.type === "fire") {
        if (ev.shooterId !== sim.player.id) {
          if (ev.weapon === "shotgun") {
            sound.playShotgun();
          } else {
            sound.playGunshot();
          }
        }
        // Resolve exact physical 3D muzzle tip origin from shooter bone hierarchy if sampled
        const shooter = ev.shooterId === sim.player.id
          ? sim.player
          : sim.squadmate.id === ev.shooterId
          ? sim.squadmate
          : sim.rivals.find((r) => r.id === ev.shooterId);
        // Authoritative fire event origin and dir guarantee visuals exit from front gun tip along aim vector
        const muzzlePos = ev.origin ?? shooter?.muzzlePos;
        const muzzleDir = ev.dir ?? shooter?.muzzleDir ?? { x: Math.sin(shooter?.facing ?? 0), y: 0, z: Math.cos(shooter?.facing ?? 0) };

        // Compute 2D screen-projected firing angle matching the actual shooting direction
        const fireAngle = Math.atan2(-muzzleDir.z, muzzleDir.x);
        const flashPreset = ev.weapon === "shotgun" ? "shotgun-flash" : "rifle-flash";
        const flashScale = ev.weapon === "shotgun" ? 1.7 : 1.35;
        const originVec = _scratchOrigin.set(muzzlePos.x, muzzlePos.y, muzzlePos.z);

        // Directional comic muzzle flash rooted exactly at 3D physical gun tip
        effects.trigger(flashPreset, originVec, undefined, flashScale, fireAngle);
        effects.trigger("muzzle-snap", originVec, undefined, 1.25, fireAngle);

        // Directional high-speed brass cartridge ejection (90 deg to right weapon flank)
        effects.trigger(
          "shell-eject",
          originVec,
          "#f59e0b",
          1.3,
          fireAngle - Math.PI / 2
        );

        // Ballistic projectile tracer strokes
        const tracerSlot = ev.shooterId === sim.player.id ? 2 : 3;
        if (ev.shooterId === sim.player.id) {
          recoilAgeRef.current = 0;
          trails.clear(tracerSlot);
        } else {
          trails.setAction(tracerSlot, `shot_${ev.shooterId}_${Date.now()}`);
        }

        if (ev.weapon === "shotgun") {
          // Diverging buckshot tracer wakes across 30° cone
          const PELLETS = [-0.22, -0.12, -0.04, 0.04, 0.12, 0.22];
          for (const pAngleOffset of PELLETS) {
            effects.trigger(
              "bullet-tracer",
              originVec,
              "#fde047",
              1.1,
              fireAngle + pAngleOffset
            );
          }
          const endPt = {
            x: muzzlePos.x + muzzleDir.x * 3.5,
            y: muzzlePos.y + muzzleDir.y * 3.5,
            z: muzzlePos.z + muzzleDir.z * 3.5,
          };
          trails.line(
            tracerSlot,
            muzzlePos,
            endPt,
            { x: 0, y: 0.06, z: 0 },
            elapsedTime,
            "#fde047",
            0.12
          );
        } else {
          // Intense golden-amber rifle tracer beam with bullet stroke
          effects.trigger("bullet-tracer", originVec, "#fde047", 1.2, fireAngle);
          const endPt = {
            x: muzzlePos.x + muzzleDir.x * 4.0,
            y: muzzlePos.y + muzzleDir.y * 4.0,
            z: muzzlePos.z + muzzleDir.z * 4.0,
          };
          trails.line(
            tracerSlot,
            muzzlePos,
            endPt,
            { x: 0, y: 0.05, z: 0 },
            elapsedTime,
            "#fde047",
            0.12
          );
        }
      } else if (ev.type === "impact") {
        const impactVec = _scratchImpact.set(ev.position.x, ev.position.y, ev.position.z);
        effects.trigger("bullet-impact", impactVec, undefined, 1.35);
        if (ev.surface === "metal") {
          effects.trigger("metal-sparks", impactVec, undefined, 1.6);
        } else if (ev.surface === "flesh") {
          effects.trigger("critical-hit", impactVec, "#ef4444", 1.4);
        } else {
          effects.trigger("concrete-chips", impactVec, undefined, 1.3);
        }
        if (ev.label || ev.damage) {
          const text = ev.label ?? `${ev.damage}`;
          const isCrit = Boolean(ev.isCrit);
          const color = isCrit ? "#ef4444" : ev.surface === "metal" ? "#fbbf24" : "#ffffff";
          spawnFloatingHit(ev.position, text, color, isCrit);
        }
      } else if (ev.type === "elimination") {
        const elimVec = _scratchElim.set(ev.position.x, ev.position.y, ev.position.z);
        shatter.trigger(elimVec);
        effects.trigger("explosion", elimVec, undefined, 1.9);
        effects.trigger("metal-sparks", elimVec, undefined, 1.6);
        effects.trigger("critical-hit", elimVec, "#ef4444", 1.4);
      } else if (ev.type === "kick") {
        const kickPos = _scratchKick.set(ev.position.x, ev.position.y, ev.position.z);
        const screenFacing = Math.atan2(-Math.cos(ev.facing), Math.sin(ev.facing));
        // Kinetic Xiao Xiao roundhouse sweep scaled to 2.8m physical reach
        effects.trigger("sword-slash", kickPos, "#eeece5", 2.4, screenFacing);
        // Kinetic air compression shockwave ring
        effects.trigger("plasma-pulse", kickPos, "#38bdf8", 1.8, screenFacing);
        if (ev.isHit) {
          const hitPos = _scratchHit.set(
            ev.position.x + Math.sin(ev.facing) * 1.6,
            ev.position.y,
            ev.position.z + Math.cos(ev.facing) * 1.6
          );
          effects.trigger("heavy-impact", hitPos, undefined, 1.8);
          effects.trigger("metal-sparks", hitPos, undefined, 1.5);
          effects.trigger("critical-hit", hitPos, "#ef4444", 1.5);
        }
      } else if (ev.type === "stim") {
        effects.trigger(
          "health-pulse",
          new THREE.Vector3(ev.position.x, ev.position.y, ev.position.z),
          "#22c55e",
          1.3
        );
      } else if (ev.type === "loot") {
        effects.trigger(
          "pickup-sparkle",
          new THREE.Vector3(ev.position.x, ev.position.y, ev.position.z),
          "#f59e0b",
          1.4
        );
        effects.trigger(
          "metal-sparks",
          _scratchImpact.set(ev.position.x, 0.4, ev.position.z),
          "#f59e0b",
          1.2
        );
        effects.trigger(
          "crate-break",
          _scratchImpact.set(ev.position.x, 0.4, ev.position.z),
          undefined,
          0.8
        );
      } else if (ev.type === "reload") {
        sound.playReload();
        effects.trigger(
          "pickup-sparkle",
          _scratchOrigin.set(ev.position.x, ev.position.y, ev.position.z),
          "#38bdf8",
          1.1
        );
      } else if (ev.type === "dry_fire") {
        sound.playEmptyClick();
      } else if (ev.type === "locomotion") {
        if (ev.subtype === "roll" || ev.subtype === "slide") {
          effects.trigger(
            "slide-dust",
            _scratchLocomotion.set(ev.position.x, 0.05, ev.position.z),
            undefined,
            1.2
          );
          if (ev.subtype === "slide") {
            effects.trigger(
              "sprint-streak",
              _scratchLocomotion.set(ev.position.x, 0.2, ev.position.z),
              "#eeece5",
              1.0
            );
          }
        }
      } else if (ev.type === "grenade_throw") {
        sound.playGrenadePin();
        effects.trigger(
          "metal-sparks",
          _scratchOrigin.set(ev.origin.x, ev.origin.y, ev.origin.z),
          "#f97316",
          1.2
        );
      } else if (ev.type === "explosion") {
        sound.playExplosion();
        const blastPos = _scratchBlast.set(ev.position.x, ev.position.y, ev.position.z);
        effects.trigger("explosion", blastPos, undefined, 2.2);
        effects.trigger("plasma-pulse", blastPos, "#f97316", 2.4);
        effects.trigger("metal-sparks", blastPos, undefined, 1.8);
        effects.trigger("smoke-puff", blastPos, undefined, 2.0);
        // Heavy concussion camera impulse
        aimPunchAgeRef.current = 0;
        aimPunchDirRef.current = [(Math.random() - 0.5) * 0.35, 0.25];
      }
    }

    // Visceral Tarkov Aim Punch: player damage triggers violent kinetic flinch
    if (sim.lastPlayerDamageTick > lastDamageTickRef.current) {
      lastDamageTickRef.current = sim.lastPlayerDamageTick;
      aimPunchAgeRef.current = 0;
      const dmgAngle = (sim as any).lastPlayerDamageAngle ?? (Math.random() * Math.PI * 2);
      aimPunchDirRef.current = [
        -Math.sin(dmgAngle) * 0.07,
        Math.cos(dmgAngle) * 0.05,
      ];
    }

    // Step weapon recoil impulse
    let recoilX = 0;
    let recoilY = 0;
    if (recoilAgeRef.current >= 0) {
      recoilAgeRef.current += delta;
      if (recoilAgeRef.current < 0.2) {
        const impulse = cameraImpulse(recoilAgeRef.current, sim.player.weapon === "shotgun" ? 0.14 : 0.08);
        recoilX = impulse[0];
        recoilY = impulse[1];
      } else {
        recoilAgeRef.current = -1;
      }
    }

    // Step incoming damage aim punch
    let punchX = 0;
    let punchY = 0;
    if (aimPunchAgeRef.current >= 0) {
      aimPunchAgeRef.current += delta;
      if (aimPunchAgeRef.current < 0.18) {
        const t = aimPunchAgeRef.current / 0.18;
        const intensity = Math.sin(t * Math.PI) * Math.exp(-t * 3.5);
        punchX = aimPunchDirRef.current[0] * intensity;
        punchY = aimPunchDirRef.current[1] * intensity;
      } else {
        aimPunchAgeRef.current = -1;
      }
    }

    recoilImpulseRef.current = [recoilX + punchX, recoilY + punchY];

    // Locomotion PFX: Continuous swept ink ribbons on slide + footstep dust on sprint
    const isSlidingActive = sim.player.isSliding || sim.player.action === "slide" || ((sim.player.slideTicksRemaining || 0) > 0);
    if (isSlidingActive) {
      const perpX = Math.cos(sim.player.facing) * 0.26;
      const perpZ = -Math.sin(sim.player.facing) * 0.26;
      trails.sample(
        0,
        { x: sim.player.x - perpX, y: 0.05, z: sim.player.z - perpZ },
        { x: sim.player.x + perpX, y: 0.05, z: sim.player.z + perpZ },
        elapsedTime,
        "#151716",
        0.28
      );
      if (Math.random() < 0.35) {
        effects.trigger(
          "slide-dust",
          _scratchLocomotion.set(sim.player.x, 0.05, sim.player.z),
          undefined,
          1.15
        );
      }
    } else if (sim.player.action === "sprint" && sim.tick % 8 === 0) {
      effects.trigger(
        "footstep-dust",
        _scratchLocomotion.set(sim.player.x, 0.05, sim.player.z),
        undefined,
        0.95
      );
    }

    // Animate floating damage numbers from pre-allocated object pool
    const now = performance.now();
    for (let i = 0; i < floatingHitPool.length; i++) {
      const h = floatingHitPool[i];
      if (!h.active) continue;
      const elapsed = now - h.birth;
      const progress = elapsed / h.duration;
      if (progress >= 1.0) {
        h.active = false;
        h.sprite.visible = false;
      } else {
        const yOffset = Math.sin(progress * Math.PI * 0.5) * 0.9;
        h.sprite.position.set(h.startX, h.startY + yOffset, h.startZ);
        h.material.opacity = progress < 0.6 ? 1.0 : 1.0 - (progress - 0.6) / 0.4;
        const pop = progress < 0.15 ? 1.0 + (0.15 - progress) * 1.5 : 1.0;
        const s = (h.isCrit ? 1.8 : 1.4) * pop;
        h.sprite.scale.set(s, s * 0.5, 1);
      }
    }

    effects.update(delta, camera);
    trails.update(elapsedTime);
    shatter.update(delta);
    telemetry.recordFrame(state.gl, delta * 1000, effects.activeCount, sim.activeProjectiles.length);
  });

  return (
    <>
      <primitive object={effects.group} />
      <primitive object={trails.group} />
      <primitive object={shatter.group} />
      <primitive object={floatingGroup} />
    </>
  );
};

export const GameCanvas: React.FC<GameCanvasProps> = React.memo(({ sim }) => {
  const recoilImpulseRef = useRef<[number, number]>([0, 0]);
  const harnessRef = useRef<{
    effects: InkEffects;
    trails: InkTrails;
    shatter: ShatterMesh;
  } | null>(null);

  const handleRegisterHarness = useCallback((h: {
    effects: InkEffects;
    trails: InkTrails;
    shatter: ShatterMesh;
  }) => {
    harnessRef.current = h;
  }, []);

  const isCorridor =
    sim.exfilController.getState().kind === "corridor_presentation" ||
    sim.exfilController.getState().kind === "submitting_settlement" ||
    sim.exfilController.getState().kind === "extracted";

  // Test harness registration for Playwright suites
  useEffect(() => {
    if (typeof window === "undefined") return;


    let isPaused = false;
    const testHarness = {
      isReady: false,
      isPaused: false,
      sim,
      lastCameraOcclusion: { adjusted: false, obstacleIndex: null as number | null },
      triggerFire: (weaponId?: "rifle" | "shotgun" | "pistol") => {
        sim.player.weapon = (weaponId as any) ?? "shotgun";
        return sim.fire();
      },
      teleportPlayer: (pos: { x: number; y: number; z: number }) => {
        sim.player.x = pos.x;
        sim.player.y = pos.y;
        sim.player.z = pos.z;
      },
      getActiveParticleCount: () => harnessRef.current?.effects.activeCount ?? 0,
      getActiveParticleBounds: () =>
        harnessRef.current?.effects.getActiveParticleBounds() ??
        new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)),
      setParticlesVisible: (visible: boolean) => {
        harnessRef.current?.effects.setParticlesVisible(visible);
      },
      setContourVisible: (visible: boolean) => {
        const root = document.querySelector("canvas");
        if (!root) return;
        // Search Three scene for avatar-ink-contour meshes
        const canvasObj = (window as any).__STICK_ZONE_THREE_SCENE__;
        if (canvasObj) {
          canvasObj.traverse((obj: any) => {
            if (obj.userData?.inkContour) {
              obj.visible = visible;
            }
          });
        }
      },
      pause: () => {
        isPaused = true;
        (window as any).__STICK_ZONE_TEST__.isPaused = true;
        const mixer = (window as any).__STICK_ZONE_MIXER__;
        if (mixer) {
          mixer.timeScale = 0;
          if (typeof mixer._actions !== "undefined") {
            for (const act of mixer._actions) {
              if (act) act.paused = true;
            }
          }
        }
      },
      stepTime: (deltaMs: number) => {
        const delta = deltaMs / 1000;
        const h = harnessRef.current;
        const cam = (window as any).__STICK_ZONE_THREE_CAMERA__;
        if (h && cam) {
          const events = sim.drainPresentationEvents();
          for (const ev of events) {
            if (ev.type === "fire") {
              const flashPreset = ev.weapon === "shotgun" ? "shotgun-flash" : "rifle-flash";
              h.effects.trigger(flashPreset, new THREE.Vector3(ev.origin.x, ev.origin.y, ev.origin.z), undefined, 1.0);
            } else if (ev.type === "impact") {
              h.effects.trigger("bullet-impact", new THREE.Vector3(ev.position.x, ev.position.y, ev.position.z));
            } else if (ev.type === "elimination") {
              h.shatter.trigger(new THREE.Vector3(ev.position.x, ev.position.y, ev.position.z));
            }
          }
          h.effects.update(delta, cam);
          h.trails.update(delta);
          h.shatter.update(delta);
        }
      },
      renderFrame: () => {
        const gl = (window as any).__STICK_ZONE_THREE_GL__;
        const scene = (window as any).__STICK_ZONE_THREE_SCENE__;
        const cam = (window as any).__STICK_ZONE_THREE_CAMERA__;
        if (gl && scene && cam) {
          gl.render(scene, cam);
        }
      },
      resetSession: () => {
        sim.confirmedEliminatedIds.clear();
        harnessRef.current?.effects.clear();
        harnessRef.current?.trails.clear();
        harnessRef.current?.shatter.clear();
      },
      cleanup: () => {
        harnessRef.current?.effects.dispose();
        harnessRef.current?.trails.dispose();
        harnessRef.current?.shatter.dispose();
        delete (window as any).__STICK_ZONE_TEST__;
      },
    };

    (window as any).__STICK_ZONE_TEST__ = testHarness;

    let checkTimer: any;
    const checkReady = () => {
      let hasContour = false;
      const scene = (window as any).__STICK_ZONE_THREE_SCENE__;
      if (scene) {
        scene.traverse((obj: any) => {
          if (obj.userData?.inkContour) hasContour = true;
        });
      }
      if (hasContour) {
        testHarness.isReady = true;
      } else {
        checkTimer = setTimeout(checkReady, 50);
      }
    };
    checkTimer = setTimeout(checkReady, 100);

    return () => {
      clearTimeout(checkTimer);
      delete (window as any).__STICK_ZONE_TEST__;
    };
  }, [sim]);

  return (
    <div className="canvas-container">
      <Canvas
        shadows
        dpr={[1, Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 1.75)]}
        performance={{ min: 0.5 }}
        gl={{ preserveDrawingBuffer: true, antialias: true, powerPreference: "high-performance" }}
        camera={{
          position: (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("testMode") === "1")
            ? [0, 10.0, -10.0]
            : [
                sim.player.x,
                sim.player.y + 16.0,
                sim.player.z + (sim.zoneMode === "hub" ? 7.5 : 6.46),
              ],
          fov: 46,
        }}
        onCreated={({ gl, scene, camera }) => {
          gl.setClearColor(new THREE.Color("#dde0e4"), 1);
          (window as any).__STICK_ZONE_THREE_GL__ = gl;
          (window as any).__STICK_ZONE_THREE_SCENE__ = scene;
          (window as any).__STICK_ZONE_THREE_CAMERA__ = camera;
        }}
      >
        <ambientLight intensity={1.3} color="#ffffff" />
        <DynamicShadowLight playerPos={sim.player} />
        <CameraController
          playerPos={sim.player}
          isCorridorActive={isCorridor}
          sim={sim}
          recoilImpulseRef={recoilImpulseRef}
        />

        <PresentationFXManager
          sim={sim}
          recoilImpulseRef={recoilImpulseRef}
          onRegisterHarness={handleRegisterHarness}
        />

        <Suspense fallback={null}>
          {/* Continuous Ballistic Projectiles (surviv.io mechanics) */}
          <ActiveProjectilesRenderer sim={sim} />

          {/* Depot & FOB Outpost Environment */}
          <SectorMap crates={sim.crates} lastDummyHitTick={sim.lastDummyHitTick} lastDummyHitSide={sim.lastDummyHitSide} />

          {/* Extraction LZ Smoke & Countdown Ring */}
          <ExfilZone exfilState={sim.exfilController.getState()} />

          {/* Player Operative */}
          {sim.player.isAlive && !sim.player.isExtracted && (
            <StickOperative operative={sim.player} isCurrentPlayer={true} />
          )}

          {/* Squadmate Companion */}
          {sim.squadmate.isAlive && !sim.squadmate.isExtracted && (
            <StickOperative operative={sim.squadmate} isCurrentPlayer={false} />
          )}

          {/* Rival Operatives (or Rogue AI) */}
          {sim.rivals.map((rival) => (
            <RivalOperative key={rival.id} operative={rival} />
          ))}

          {/* Automated Machine Defenses */}
          {sim.machines.map((machine) => (
            <MachineEnemy key={machine.id} machine={machine} />
          ))}

          {/* Active F-1 Fragmentation Grenades with dynamic 3D physics flight & contact shadows */}
          <ActiveGrenadesRenderer sim={sim} />
        </Suspense>
      </Canvas>
    </div>
  );
});
