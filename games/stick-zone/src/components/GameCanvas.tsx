import React, { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { SectorDepotSimulation } from "../sim/game.js";
import { DEPOT_CONTAINERS } from "../sim/game.js";
import { globalCutaway } from "../render/cutaway.js";
import { SectorMap } from "./SectorMap.js";
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
} from "../render/cameraKinetics.js";

interface GameCanvasProps {
  sim: SectorDepotSimulation;
}

const cameraObstacles = createCameraObstacles(DEPOT_CONTAINERS);

const DynamicShadowLight: React.FC<{ playerPos: { x: number; y: number; z: number } }> = ({ playerPos }) => {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);

  useFrame(() => {
    if (lightRef.current && targetRef.current) {
      targetRef.current.position.set(playerPos.x, 0, playerPos.z);
      targetRef.current.updateMatrixWorld();
      lightRef.current.target = targetRef.current;
      lightRef.current.position.set(playerPos.x + 30, 50, playerPos.z + 20);
    }
  });

  return (
    <>
      <object3D ref={targetRef} position={[playerPos.x, 0, playerPos.z]} />
      <directionalLight
        ref={lightRef}
        position={[playerPos.x + 30, 50, playerPos.z + 20]}
        intensity={2.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={5}
        shadow-camera-far={110}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
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
}> = ({ playerPos, isCorridorActive, sim, recoilImpulseRef }) => {
  const isTestMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("testMode") === "1";
  const baseCameraPos = useRef(
    isTestMode
      ? new THREE.Vector3(0, 10.0, -10.0)
      : new THREE.Vector3(playerPos.x, playerPos.y + 16.0, playerPos.z + 6.46)
  );
  const baseCameraTarget = useRef(
    isTestMode
      ? new THREE.Vector3(0, 0, 0)
      : new THREE.Vector3(playerPos.x, playerPos.y + 1.0, playerPos.z)
  );

  useFrame(({ camera }, delta) => {
    const isPaused =
      typeof window !== "undefined" &&
      Boolean((window as any).__STICK_ZONE_TEST__?.isPaused);
    if (isPaused) return;

    const lerpFactor = 1 - Math.exp(-6 * Math.min(delta, 0.1));

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
    } else if (isCorridorActive) {
      // Cinematic low-angle corridor vantage
      desiredX = playerPos.x + 3.0;
      desiredY = playerPos.y + 4.0;
      desiredZ = playerPos.z + 5.5;
      targetX = playerPos.x;
      targetY = playerPos.y + 1.2;
      targetZ = playerPos.z;
    } else if (sim.zoneMode === "hub") {
      // FOB Outpost tactical staging vantage
      desiredX = playerPos.x;
      desiredY = playerPos.y + 20.0;
      desiredZ = playerPos.z + 10.0;
      targetX = playerPos.x;
      targetY = playerPos.y + 1.2;
      targetZ = playerPos.z - 1.0;
    } else {
      // Top-down tactical extraction vantage (68.0 deg tactical angle)
      desiredX = playerPos.x;
      desiredY = playerPos.y + 16.0;
      desiredZ = playerPos.z + 6.46;
      targetX = playerPos.x;
      targetY = playerPos.y + 1.0;
      targetZ = playerPos.z;
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

    // Apply recoil impulse strictly as transient render offset
    const [recoilX, recoilY] = recoilImpulseRef.current;
    camera.position.set(
      baseCameraPos.current.x + recoilX,
      baseCameraPos.current.y + recoilY,
      baseCameraPos.current.z
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
      } else if (recoilImpulseRef.current[0] !== 0 || recoilImpulseRef.current[1] !== 0) {
        targetFov = 44.0; // Recoil zoom snap
      }
      const newFov = THREE.MathUtils.lerp(persCamera.fov, targetFov, lerpFactor);
      if (Math.abs(persCamera.fov - newFov) > 0.02) {
        persCamera.fov = newFov;
        persCamera.updateProjectionMatrix();
      }
    }
  });

  return null;
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
        const fireAngle = Math.atan2(ev.dir.x, ev.dir.z);
        const flashPreset = ev.weapon === "shotgun" ? "shotgun-flash" : "rifle-flash";
        const flashScale = ev.weapon === "shotgun" ? 1.7 : 1.35;
        const originVec = new THREE.Vector3(ev.origin.x, ev.origin.y, ev.origin.z);

        // Directional comic muzzle flash with paper core burst
        effects.trigger(flashPreset, originVec, undefined, flashScale, fireAngle);
        effects.trigger("muzzle-snap", originVec, undefined, 1.25, fireAngle);

        // Directional high-speed brass cartridge ejection (90 deg to right flank)
        effects.trigger(
          "shell-eject",
          originVec,
          "#f59e0b",
          1.3,
          fireAngle + Math.PI / 2
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
            x: ev.origin.x + ev.dir.x * 32.0,
            y: ev.origin.y + ev.dir.y * 32.0,
            z: ev.origin.z + ev.dir.z * 32.0,
          };
          trails.line(
            tracerSlot,
            ev.origin,
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
            x: ev.origin.x + ev.dir.x * 36.0,
            y: ev.origin.y + ev.dir.y * 36.0,
            z: ev.origin.z + ev.dir.z * 36.0,
          };
          trails.line(
            tracerSlot,
            ev.origin,
            endPt,
            { x: 0, y: 0.05, z: 0 },
            elapsedTime,
            "#fde047",
            0.12
          );
        }
      } else if (ev.type === "impact") {
        const impactVec = new THREE.Vector3(ev.position.x, ev.position.y, ev.position.z);
        effects.trigger("bullet-impact", impactVec, undefined, 1.35);
        if (ev.surface === "metal") {
          effects.trigger("metal-sparks", impactVec, undefined, 1.6);
        } else if (ev.surface === "flesh") {
          effects.trigger("critical-hit", impactVec, "#ef4444", 1.4);
        } else {
          effects.trigger("concrete-chips", impactVec, undefined, 1.3);
        }
      } else if (ev.type === "elimination") {
        const elimVec = new THREE.Vector3(ev.position.x, ev.position.y, ev.position.z);
        shatter.trigger(elimVec);
        effects.trigger("explosion", elimVec, undefined, 1.9);
        effects.trigger("metal-sparks", elimVec, undefined, 1.6);
        effects.trigger("critical-hit", elimVec, "#ef4444", 1.4);
      } else if (ev.type === "kick") {
        const kickPos = new THREE.Vector3(ev.position.x, ev.position.y, ev.position.z);
        // Kinetic Xiao Xiao melee slash sweep
        effects.trigger("sword-slash", kickPos, "#eeece5", 1.9, ev.facing);
        // Kinetic air compression shockwave ring
        effects.trigger("plasma-pulse", kickPos, "#38bdf8", 1.4, ev.facing);
        if (ev.isHit) {
          const hitPos = new THREE.Vector3(
            ev.position.x + Math.sin(ev.facing) * 1.5,
            ev.position.y,
            ev.position.z + Math.cos(ev.facing) * 1.5
          );
          effects.trigger("heavy-impact", hitPos, undefined, 1.6);
          effects.trigger("metal-sparks", hitPos, undefined, 1.3);
          effects.trigger("critical-hit", hitPos, "#ef4444", 1.3);
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
          "crate-break",
          new THREE.Vector3(ev.position.x, 0.4, ev.position.z),
          undefined,
          0.8
        );
      } else if (ev.type === "locomotion") {
        if (ev.subtype === "roll" || ev.subtype === "slide") {
          effects.trigger(
            "slide-dust",
            new THREE.Vector3(ev.position.x, 0.05, ev.position.z),
            undefined,
            1.2
          );
          if (ev.subtype === "slide") {
            effects.trigger(
              "sprint-streak",
              new THREE.Vector3(ev.position.x, 0.2, ev.position.z),
              "#eeece5",
              1.0
            );
          }
        }
      } else if (ev.type === "grenade_throw") {
        sound.playGrenadePin();
        effects.trigger(
          "spark-burst",
          new THREE.Vector3(ev.origin.x, ev.origin.y, ev.origin.z),
          "#f97316",
          1.2
        );
      } else if (ev.type === "explosion") {
        sound.playExplosion();
        const blastPos = new THREE.Vector3(ev.position.x, ev.position.y, ev.position.z);
        effects.trigger("explosion", blastPos, undefined, 2.2);
        effects.trigger("plasma-pulse", blastPos, "#f97316", 2.4);
        effects.trigger("metal-sparks", blastPos, undefined, 1.8);
        effects.trigger("smoke-ring", blastPos, undefined, 2.0);
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
        -Math.sin(dmgAngle) * 0.16,
        Math.cos(dmgAngle) * 0.12,
      ];
    }

    // Step weapon recoil impulse
    let recoilX = 0;
    let recoilY = 0;
    if (recoilAgeRef.current >= 0) {
      recoilAgeRef.current += delta;
      if (recoilAgeRef.current < 0.2) {
        const impulse = cameraImpulse(recoilAgeRef.current, 0.35);
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
          new THREE.Vector3(sim.player.x, 0.05, sim.player.z),
          undefined,
          1.15
        );
      }
    } else if (sim.player.action === "sprint" && sim.tick % 8 === 0) {
      effects.trigger(
        "footstep-dust",
        new THREE.Vector3(sim.player.x, 0.05, sim.player.z),
        undefined,
        0.95
      );
    }

    effects.update(delta, camera);
    trails.update(elapsedTime);
    shatter.update(delta);
  });

  return (
    <>
      <primitive object={effects.group} />
      <primitive object={trails.group} />
      <primitive object={shatter.group} />
    </>
  );
};

export const GameCanvas: React.FC<GameCanvasProps> = ({ sim }) => {
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
    sim.exfilController.getState().kind === "extracted" ||
    sim.zoneMode === "airlock_corridor";

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
                sim.player.y + (sim.zoneMode === "hub" ? 20.0 : 16.0),
                sim.player.z + (sim.zoneMode === "hub" ? 10.0 : 6.46),
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
        <ambientLight intensity={1.4} />
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

          {/* Active F-1 Fragmentation Grenades */}
          {sim.activeGrenades.map((g) => (
            <group key={g.id} position={[g.x, g.y, g.z]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.07, 0.07, 0.16, 10]} />
                <meshStandardMaterial color="#365314" roughness={0.7} metalness={0.4} />
              </mesh>
              {/* Glowing tactical fuse beacon */}
              <mesh position={[0, 0.1, 0]}>
                <sphereGeometry args={[0.035, 8, 8]} />
                <meshBasicMaterial color="#ef4444" />
              </mesh>
              {/* Dynamic contact shadow projection */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -g.y + 0.02, 0]}>
                <circleGeometry args={[0.16, 16]} />
                <meshBasicMaterial color="#000000" transparent opacity={0.65} />
              </mesh>
            </group>
          ))}
        </Suspense>
      </Canvas>
    </div>
  );
};
