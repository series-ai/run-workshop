import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import { useFrame, createPortal } from "@react-three/fiber";
import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { useAssetUrl } from "../useAssetUrl.js";
import { InklineModel } from "./InklineModel.js";
import { SharedMaterials } from "../render/materials.js";
import {
  applyCelShading,
  updatePaleInkContour,
  updateXraySilhouette,
  disposeInstance,
  INK_CONTOUR_COLOR,
} from "../render/celShader.js";
import type { AssetKey } from "../assetLibrary.js";
import type { OperativeState } from "../sim/game.js";

const GUNMETAL_BODY_COLOR = "#292e36";

export interface InklineStickCharacterProps {
  operative?: OperativeState;
  isCurrentPlayer?: boolean;
  assetKey?: AssetKey;
  weapon?: "rifle" | "shotgun" | "pistol" | "fists" | "grenade";
  isMoving: boolean;
  isFiring: boolean;
  flashElapsed?: number;
  isAlive: boolean;
  isRolling?: boolean;
  isBleeding?: boolean;
  facing: number;
  accentColor: string;
  hasWeapon?: boolean;
  hasLaser?: boolean;
  speed?: number;
  moveAngle?: number;
  action?: string;
  onSampleBones?: (bones: { footR: THREE.Vector3; handR: THREE.Vector3 }) => void;
  onMuzzleSample?: (muzzle: { pos: THREE.Vector3; dir: THREE.Vector3 }) => void;
}

/**
 * Synthesizes a blended animation combining lower-body running locomotion
 * with upper-body tactical weapon holding posture so arms don't swing wildly away from the gun.
 */
function createBlendedWeaponRunClip(
  runClip: THREE.AnimationClip,
  upperClip: THREE.AnimationClip,
  name: string
): THREE.AnimationClip {
  const upperBones = new Set([
    "Spine",
    "Chest",
    "Neck",
    "Head",
    "UpperArm_L",
    "Forearm_L",
    "Hand_L",
    "UpperArm_R",
    "Forearm_R",
    "Hand_R",
  ]);

  const tracks: THREE.KeyframeTrack[] = [];
  const duration = runClip.duration;

  // 1. Lower body & root locomotion tracks from runClip
  for (const track of runClip.tracks) {
    const boneName = track.name.split(".")[0];
    if (!upperBones.has(boneName)) {
      tracks.push(track.clone());
    }
  }

  // 2. Upper body weapon holding posture tracks from upperClip
  for (const track of upperClip.tracks) {
    const boneName = track.name.split(".")[0];
    if (upperBones.has(boneName)) {
      const clonedTrack = track.clone();
      if (clonedTrack.times.length > 0) {
        const trackDuration = clonedTrack.times[clonedTrack.times.length - 1];
        if (trackDuration > 0 && Math.abs(trackDuration - duration) > 0.01) {
          const scale = duration / trackDuration;
          for (let i = 0; i < clonedTrack.times.length; i++) {
            clonedTrack.times[i] *= scale;
          }
        }
      }
      tracks.push(clonedTrack);
    }
  }

  return new THREE.AnimationClip(name, duration, tracks);
}

function LoadedCharacter({
  operative,
  url,
  assetKey = "playerStickman",
  weapon = "rifle",
  isMoving,
  isFiring,
  flashElapsed,
  isAlive,
  isRolling = false,
  facing,
  accentColor,
  hasWeapon = true,
  hasLaser = false,
  isCurrentPlayer = false,
  speed,
  moveAngle,
  action: operativeAction,
  onSampleBones,
  onMuzzleSample,
}: InklineStickCharacterProps & { url: string }) {
  const lastCharPosRef = useRef({ x: operative?.x ?? 0, z: operative?.z ?? 0 });
  const liveSpeedRef = useRef(0);
  const { scene, animations } = useGLTF(url);
  const clonedScene = useMemo(() => skeletonClone(scene), [scene]);
  const groupRef = useRef<THREE.Group>(null);
  const muzzleTipRef = useRef<THREE.Group>(null);
  const _scratchMuzzlePos = useMemo(() => new THREE.Vector3(), []);
  const _scratchMuzzleDir = useMemo(() => new THREE.Vector3(), []);

  // Reactively track weapon changes on the operative
  const [activeWeapon, setActiveWeapon] = useState<string>(() => operative ? (operative.weapon || weapon || "rifle") : (weapon || "rifle"));
  const activeWeaponRef = useRef<string>(activeWeapon);

  const liveAction = operative ? operative.action : operativeAction;
  const isHoldingFirearm = hasWeapon && (activeWeapon === "shotgun" || activeWeapon === "rifle" || activeWeapon === "pistol");
  const isHoldingGrenade =
    activeWeapon === "grenade" &&
    ((operative?.fragGrenades ?? 2) > 0) &&
    (liveAction !== "throw" || (operative?.actionTicks ?? 0) > 18);

  // Synthesize blended weapon-run clips (run legs + rifle/pistol upper body)
  const effectiveAnimations = useMemo(() => {
    if (!animations || animations.length === 0) return animations;
    const runClip = animations.find((a) => a.name === "run");
    const rifleClip = animations.find((a) => a.name === "rifle-idle");
    const pistolClip = animations.find((a) => a.name === "pistol-idle");

    const list = [...animations];
    if (runClip && rifleClip) {
      list.push(createBlendedWeaponRunClip(runClip, rifleClip, "run-rifle"));
      list.push(createBlendedWeaponRunClip(runClip, rifleClip, "run-shotgun"));
    }
    if (runClip && pistolClip) {
      list.push(createBlendedWeaponRunClip(runClip, pistolClip, "run-pistol"));
    }
    return list;
  }, [animations]);

  const { actions, mixer } = useAnimations(effectiveAnimations, groupRef);

  useEffect(() => {
    if (mixer && typeof window !== "undefined") {
      (window as any).__STICK_ZONE_MIXER__ = mixer;
    }
  }, [mixer]);

  const currentActionNameRef = useRef<string>("");

  // Separate upper and lower body animation, continuous aim rotation, and dynamic clip cross-fading
  useFrame((_, delta) => {
    // 1. Resolve live parameters from operative instance if passed
    const liveFacing = operative ? operative.facing : (facing ?? 0);
    const liveIsAlive = operative ? operative.isAlive : isAlive;
    const liveIsRolling = operative ? operative.isRolling : isRolling;
    const liveWeapon = operative ? (operative.weapon || "rifle") : (weapon || "rifle");
    const liveAction = operative ? operative.action : operativeAction;

    if (liveWeapon !== activeWeaponRef.current) {
      activeWeaponRef.current = liveWeapon;
      setActiveWeapon(liveWeapon);
    }
    const isHoldingFirearm = hasWeapon && (liveWeapon === "shotgun" || liveWeapon === "rifle" || liveWeapon === "pistol");

    const curX = operative ? operative.x : 0;
    const curZ = operative ? operative.z : 0;
    const distMoved = Math.hypot(curX - lastCharPosRef.current.x, curZ - lastCharPosRef.current.z);
    const measuredSpeed = distMoved / Math.max(0.001, delta);
    liveSpeedRef.current = THREE.MathUtils.lerp(liveSpeedRef.current, measuredSpeed, 0.25);
    const liveIsMoving = operative
      ? (operative.action === "walk" || operative.action === "sprint" || distMoved > 0.012)
      : isMoving;
    const liveMoveAngle = distMoved > 0.012
      ? Math.atan2(curX - lastCharPosRef.current.x, curZ - lastCharPosRef.current.z)
      : moveAngle;
    lastCharPosRef.current = { x: curX, z: curZ };

    const distinctFireTime = operative
      ? Math.max((operative as any).lastFiredAtMs || 0, (operative as any).lastFireTimestamp || 0)
      : 0;
    const liveFlashElapsed = distinctFireTime > 0
      ? Date.now() - distinctFireTime
      : (flashElapsed ?? 999999);
    const liveIsFiring = liveFlashElapsed >= 0 && liveFlashElapsed <= 70;

    // 2. Cross-fade animation clips dynamically in useFrame without virtual DOM reconciliations
    if (actions) {
      let targetClip = "idle";
      if (!liveIsAlive) {
        targetClip = actions["death"] ? "death" : "idle";
      } else if (liveIsRolling && actions["roll"]) {
        targetClip = "roll";
      } else if (liveAction === "kick") {
        targetClip = actions["kick-roundhouse"] ? "kick-roundhouse" : actions["kick-front"] ? "kick-front" : "sweep";
      } else if (liveAction === "throw") {
        targetClip = actions["throw"] ? "throw" : actions["ball-throw"] ? "ball-throw" : "punch-heavy";
      } else if (liveAction === "reload") {
        targetClip = actions["reload"] ? "reload" : isHoldingFirearm ? (liveWeapon === "shotgun" ? "run-shotgun" : "rifle-idle") : "idle";
      } else if (liveIsFiring) {
        if (liveWeapon === "shotgun" && actions["shotgun-fire"]) {
          targetClip = "shotgun-fire";
        } else if (liveWeapon === "pistol" && actions["pistol-fire"]) {
          targetClip = "pistol-fire";
        } else if (actions["rifle-fire"]) {
          targetClip = "rifle-fire";
        }
      } else if (liveIsMoving) {
        if (isHoldingFirearm && liveWeapon === "shotgun" && actions["run-shotgun"]) {
          targetClip = "run-shotgun";
        } else if (isHoldingFirearm && liveWeapon === "pistol" && actions["run-pistol"]) {
          targetClip = "run-pistol";
        } else if (isHoldingFirearm && actions["run-rifle"]) {
          targetClip = "run-rifle";
        } else if (actions["run"]) {
          targetClip = "run";
        }
      } else if (isHoldingFirearm && liveWeapon === "pistol" && actions["pistol-idle"]) {
        targetClip = "pistol-idle";
      } else if (isHoldingFirearm && actions["rifle-idle"]) {
        targetClip = "rifle-idle";
      } else if (actions["idle"]) {
        targetClip = "idle";
      }

      if (currentActionNameRef.current !== targetClip) {
        const prevAction = actions[currentActionNameRef.current];
        const nextAction = actions[targetClip];

        if (nextAction) {
          if (targetClip === "death") {
            nextAction.reset().play();
            nextAction.clampWhenFinished = true;
            nextAction.loop = THREE.LoopOnce;
          } else if (
            targetClip === "kick-roundhouse" ||
            targetClip === "kick-front" ||
            targetClip === "throw" ||
            targetClip === "ball-throw" ||
            targetClip === "reload"
          ) {
            nextAction.reset();
            nextAction.setLoop(THREE.LoopOnce, 1);
            nextAction.clampWhenFinished = false;
            nextAction.timeScale = targetClip === "throw" ? 1.35 : 1.2;
            nextAction.fadeIn(0.06).play();
            if (prevAction && prevAction !== nextAction) {
              prevAction.fadeOut(0.06);
            }
          } else if (prevAction && prevAction !== nextAction) {
            nextAction.enabled = true;
            nextAction.setLoop(THREE.LoopRepeat, Infinity);
            nextAction.play();
            prevAction.crossFadeTo(nextAction, 0.14, false);
          } else {
            nextAction.reset().fadeIn(0.14).play();
          }
          currentActionNameRef.current = targetClip;
        }
      }
    }

    // 3. Separate upper and lower body animation & aim rotation
    let targetBaseRotation = liveFacing;
    let targetTorsoTwist = 0;
    let isBackpedaling = false;

    if (liveAction === "kick" || liveAction === "throw") {
      targetBaseRotation = liveFacing;
      targetTorsoTwist = 0;
      isBackpedaling = false;
    } else if (liveIsMoving && liveMoveAngle !== undefined) {
      let angleDiff = liveFacing - liveMoveAngle;
      angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

      if (Math.abs(angleDiff) <= 1.95) {
        // Forward / flanking run: legs face move direction, torso twists to aim
        targetBaseRotation = liveMoveAngle;
        targetTorsoTwist = angleDiff;
      } else {
        // Retreating / backpedaling: legs face aim target, run animation plays in reverse
        targetBaseRotation = liveFacing;
        targetTorsoTwist = 0;
        isBackpedaling = true;
      }
    }

    if (groupRef.current) {
      const curRot = groupRef.current.rotation.y;
      const rotDiff = Math.atan2(Math.sin(targetBaseRotation - curRot), Math.cos(targetBaseRotation - curRot));
      groupRef.current.rotation.y = curRot + rotDiff * Math.min(1, delta * 18);
    }

    if (spineBone && chestBone && liveAction !== "kick" && liveAction !== "throw") {
      const halfTwist = targetTorsoTwist * 0.5;
      spineBone.rotation.y = THREE.MathUtils.lerp(spineBone.rotation.y, halfTwist, Math.min(1, delta * 15));
      chestBone.rotation.y = THREE.MathUtils.lerp(chestBone.rotation.y, halfTwist, Math.min(1, delta * 15));
    }

    const isSpecialAction =
      currentActionNameRef.current === "death" ||
      currentActionNameRef.current === "roll" ||
      currentActionNameRef.current === "kick-roundhouse" ||
      currentActionNameRef.current === "kick-front" ||
      currentActionNameRef.current === "throw" ||
      currentActionNameRef.current === "ball-throw";

    if (actions && currentActionNameRef.current && liveIsMoving && !isSpecialAction) {
      const activeAction = actions[currentActionNameRef.current];
      if (activeAction) {
        const curSpeed = liveSpeedRef.current > 0.05 ? liveSpeedRef.current : 4.8;
        const baseScale = THREE.MathUtils.clamp(curSpeed / 4.8, 0.75, 1.55);
        const targetScale = isBackpedaling ? -baseScale : baseScale;
        activeAction.timeScale = THREE.MathUtils.lerp(activeAction.timeScale, targetScale, 0.2);
      }
    }
  });

  // Apply graphic-novel cel-shading, ink contours, palette, and disposal
  useEffect(() => {
    const targetMeshes: THREE.SkinnedMesh[] = [];
    clonedScene.traverse((child) => {
      if (
        child instanceof THREE.SkinnedMesh &&
        !child.userData.inkContour &&
        !child.userData.xraySilhouette
      ) {
        targetMeshes.push(child);
      }
    });

    for (const child of targetMeshes) {
      child.castShadow = true;
      child.receiveShadow = true;

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      for (const mat of materials) {
        if ('color' in mat && mat.color instanceof THREE.Color) {
          const isAccent = /accent/i.test(mat.name) || /visor/i.test(mat.name);
          mat.color.set(isAccent ? accentColor : GUNMETAL_BODY_COLOR);
        }
        if ('roughness' in mat) (mat as THREE.MeshStandardMaterial).roughness = 0.95;
        if ('metalness' in mat) (mat as THREE.MeshStandardMaterial).metalness = 0.05;
        if ('emissive' in mat) {
          const isAccent = /accent/i.test(mat.name);
          if (!isAccent) {
            (mat as THREE.MeshStandardMaterial).emissive.set(0x000000);
          }
        }
        applyCelShading(mat);
      }

      // Attach authentic Inkline pitch-black comic ink outline
      updatePaleInkContour(child, 1.35, INK_CONTOUR_COLOR);

      // Attach X-Ray occluded silhouette through walls (cyan for allies, threat red for enemies)
      const xrayColor = isCurrentPlayer || accentColor === "#38bdf8" || accentColor === "#51E5F0" ? "#38bdf8" : "#ef4444";
      updateXraySilhouette(child, xrayColor);
    }

    return () => {
      disposeInstance(clonedScene);
    };
  }, [clonedScene, accentColor, isCurrentPlayer]);

  // Locate Hand_R and Foot_R bones in skeleton hierarchy
  const handBone = useMemo(() => {
    if (!clonedScene) return null;
    let handR = clonedScene.getObjectByName('Hand_R') || clonedScene.getObjectByName('RightHand');
    if (!handR) {
      clonedScene.traverse((obj) => {
        if (obj instanceof THREE.Bone && !handR && /hand.*r/i.test(obj.name)) {
          handR = obj;
        }
      });
    }
    return handR;
  }, [clonedScene]);

  const headBone = useMemo(() => {
    if (!clonedScene) return null;
    let head = clonedScene.getObjectByName('Head');
    if (!head) {
      clonedScene.traverse((obj) => {
        if (obj instanceof THREE.Bone && !head && /head/i.test(obj.name)) {
          head = obj;
        }
      });
    }
    return head;
  }, [clonedScene]);

  const spineBone = useMemo(() => {
    if (!clonedScene) return null;
    let spine = clonedScene.getObjectByName("Spine");
    if (!spine) {
      clonedScene.traverse((obj) => {
        if (obj instanceof THREE.Bone && !spine && /spine/i.test(obj.name)) spine = obj;
      });
    }
    return spine;
  }, [clonedScene]);

  const chestBone = useMemo(() => {
    if (!clonedScene) return null;
    let chest = clonedScene.getObjectByName('Chest') || clonedScene.getObjectByName('Spine1');
    if (!chest) {
      clonedScene.traverse((obj) => {
        if (obj instanceof THREE.Bone && !chest && /(chest|spine)/i.test(obj.name)) {
          chest = obj;
        }
      });
    }
    return chest;
  }, [clonedScene]);

  const footPos = useMemo(() => new THREE.Vector3(), []);
  const handPos = useMemo(() => new THREE.Vector3(), []);
  const recoilKickRef = useRef(0);

  useFrame((_, delta) => {
    if (isFiring) {
      recoilKickRef.current = -0.05;
    } else {
      recoilKickRef.current = THREE.MathUtils.lerp(recoilKickRef.current, 0, Math.min(1, delta * 20));
    }

    if (typeof window !== "undefined" && Boolean((window as any).__STICK_ZONE_TEST__?.isPaused)) {
      if (mixer.timeScale !== 0) mixer.timeScale = 0;
    }
    if (!clonedScene) return;

    if (onSampleBones && isAlive && handBone) {
      let footR = clonedScene.getObjectByName('Foot_R') || clonedScene.getObjectByName('RightFoot');
      if (!footR) {
        clonedScene.traverse((obj) => {
          if (obj instanceof THREE.Bone && !footR && /foot.*r/i.test(obj.name)) footR = obj;
        });
      }
      if (footR) {
        footR.getWorldPosition(footPos);
        handBone.getWorldPosition(handPos);
        onSampleBones({ footR: footPos, handR: handPos });
      }
    }
    const liveAliveCheck = operative ? operative.isAlive : isAlive;
    const liveRollingCheck = operative ? operative.isRolling : isRolling;
    if (muzzleTipRef.current && isHoldingFirearm && liveAliveCheck && !liveRollingCheck && liveAction !== "kick") {
      muzzleTipRef.current.getWorldPosition(_scratchMuzzlePos);
      muzzleTipRef.current.getWorldDirection(_scratchMuzzleDir);
      onMuzzleSample?.({ pos: _scratchMuzzlePos, dir: _scratchMuzzleDir });
    }
  });

  const weaponKey: AssetKey =
    activeWeapon === "shotgun" ? "shotgun" : activeWeapon === "pistol" ? "pistol" : "rifle";

  // Exact grip rotation angles in right hand palm (Euler radians)
  const gripEuler: [number, number, number] =
    activeWeapon === "shotgun"
      ? [(-24 * Math.PI) / 180, (-38 * Math.PI) / 180, (10 * Math.PI) / 180]
      : activeWeapon === "pistol"
      ? [(-15 * Math.PI) / 180, (-35 * Math.PI) / 180, (5 * Math.PI) / 180]
      : [(-27.37 * Math.PI) / 180, (-40.81 * Math.PI) / 180, (12.82 * Math.PI) / 180];

  // Exact grip translation offsets within Hand_R palm
  const gripPos: [number, number, number] =
    activeWeapon === "shotgun"
      ? [0, 0.04, 0.03]
      : activeWeapon === "pistol"
      ? [0, 0.06, 0.01]
      : [0, 0.05, 0.02];

  return (
    <group ref={groupRef} dispose={null}>
      {/* 3D Skeletal Mesh with Cel-Shading and Ink Contours */}
      <primitive object={clonedScene} />

      {/* DISTINCT CHARACTER PROPS & TACTICAL SILHOUETTES */}
      {/* 1. Head Gear (Class-Stratified 3D Props) */}
      {isAlive && headBone && (
        createPortal(
          assetKey === "scavBoss" ? (
            /* Sector Boss Warlord: Cybernetic Horned Helm with Crimson Visor */
            <group position={[0, 0.12, 0.02]}>
              <mesh>
                <cylinderGeometry args={[0.15, 0.14, 0.14, 16]} />
                <meshStandardMaterial color="#18181b" roughness={0.7} />
              </mesh>
              {/* Left Horn */}
              <mesh position={[-0.14, 0.10, 0]} rotation={[0, 0, 0.35]}>
                <cylinderGeometry args={[0.015, 0.035, 0.22, 8]} />
                <meshBasicMaterial color="#FF365E" />
              </mesh>
              {/* Right Horn */}
              <mesh position={[0.14, 0.10, 0]} rotation={[0, 0, -0.35]}>
                <cylinderGeometry args={[0.015, 0.035, 0.22, 8]} />
                <meshBasicMaterial color="#FF365E" />
              </mesh>
              {/* Glowing Crimson Visor Slit */}
              <mesh position={[0, -0.02, 0.13]}>
                <boxGeometry args={[0.18, 0.025, 0.02]} />
                <meshBasicMaterial color="#FF365E" />
              </mesh>
            </group>
          ) : assetKey === "scavRunner" ? (
            /* Scavenger Runner: Wrapped Asymmetric Scarf/Hood with Amber Monocle */
            <group position={[0, 0.06, 0.04]}>
              <mesh position={[0, -0.06, 0]}>
                <torusGeometry args={[0.15, 0.05, 8, 16]} />
                <meshStandardMaterial color="#334155" roughness={0.9} />
              </mesh>
              {/* Amber Monocle Lens */}
              <mesh position={[0.05, 0.02, 0.11]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.03, 0.03, 0.02, 12]} />
                <meshBasicMaterial color="#FFC247" />
              </mesh>
            </group>
          ) : isCurrentPlayer ? (
            /* Player Cyber Visor with Glowing Cyan Lens Band */
            <group position={[0, 0.08, 0.12]}>
              <mesh material={SharedMaterials.darkNavy}>
                <boxGeometry args={[0.22, 0.05, 0.08]} />
              </mesh>
              <mesh position={[0, 0, 0.045]} material={SharedMaterials.cyanVisor}>
                <boxGeometry args={[0.18, 0.03, 0.02]} />
              </mesh>
              <mesh position={[-0.10, -0.04, 0.08]} rotation={[0, 0, -0.2]} material={SharedMaterials.slateJoint}>
                <cylinderGeometry args={[0.008, 0.008, 0.12]} />
              </mesh>
            </group>
          ) : (
            /* Squadmate Recon Helmet with Antenna & Cyan Visor */
            <group position={[0, 0.10, 0.02]}>
              <mesh>
                <sphereGeometry args={[0.16, 16, 16]} />
                <meshStandardMaterial color="#1e293b" roughness={0.8} />
              </mesh>
              <mesh position={[0, -0.01, 0.14]}>
                <boxGeometry args={[0.16, 0.03, 0.02]} />
                <meshBasicMaterial color="#51E5F0" />
              </mesh>
              <mesh position={[-0.12, 0.14, -0.04]} rotation={[0.15, 0, -0.1]}>
                <cylinderGeometry args={[0.006, 0.006, 0.28]} />
                <meshBasicMaterial color="#94a3b8" />
              </mesh>
            </group>
          ),
          headBone
        )
      )}

      {/* 2. Chest & Shoulder Gear (Class-Stratified 3D Props) */}
      {isAlive && chestBone && (
        createPortal(
          assetKey === "scavBoss" ? (
            /* Boss Heavy Ballistic Armor + Broad Pauldrons */
            <group position={[0, 0.08, 0.04]}>
              <mesh>
                <boxGeometry args={[0.32, 0.26, 0.08]} />
                <meshStandardMaterial color="#18181b" roughness={0.6} />
              </mesh>
              {/* Broad Left Pauldron */}
              <mesh position={[-0.22, 0.08, 0]} rotation={[0, 0, -0.2]}>
                <boxGeometry args={[0.14, 0.16, 0.12]} />
                <meshStandardMaterial color="#27272a" roughness={0.6} />
              </mesh>
              {/* Broad Right Pauldron */}
              <mesh position={[0.22, 0.08, 0]} rotation={[0, 0, 0.2]}>
                <boxGeometry args={[0.14, 0.16, 0.12]} />
                <meshStandardMaterial color="#27272a" roughness={0.6} />
              </mesh>
            </group>
          ) : assetKey === "scavRunner" ? (
            /* Scavenger Diagonal Bandolier & Pouches */
            <group position={[0, 0.08, 0.06]}>
              <mesh rotation={[0, 0, 0.6]}>
                <boxGeometry args={[0.05, 0.36, 0.02]} />
                <meshStandardMaterial color="#475569" roughness={0.9} />
              </mesh>
              <mesh position={[-0.04, 0.02, 0.02]}>
                <boxGeometry args={[0.06, 0.06, 0.04]} />
                <meshStandardMaterial color="#52525b" roughness={0.9} />
              </mesh>
            </group>
          ) : isCurrentPlayer ? (
            /* Player Tactical Plate Harness */
            <group position={[0, 0.08, 0.08]}>
              <mesh>
                <boxGeometry args={[0.24, 0.22, 0.05]} />
                <meshStandardMaterial color="#1e293b" roughness={0.7} />
              </mesh>
              <mesh position={[-0.06, -0.02, 0.03]}>
                <boxGeometry args={[0.06, 0.09, 0.03]} />
                <meshStandardMaterial color="#334155" roughness={0.8} />
              </mesh>
              <mesh position={[0.06, -0.02, 0.03]}>
                <boxGeometry args={[0.06, 0.09, 0.03]} />
                <meshStandardMaterial color="#334155" roughness={0.8} />
              </mesh>
            </group>
          ) : (
            /* Squadmate Radio Backpack */
            <group position={[0, 0.08, -0.10]}>
              <mesh>
                <boxGeometry args={[0.20, 0.24, 0.10]} />
                <meshStandardMaterial color="#1e293b" roughness={0.8} />
              </mesh>
              <mesh position={[-0.08, 0.22, -0.02]} rotation={[-0.1, 0, 0.1]}>
                <cylinderGeometry args={[0.006, 0.006, 0.40]} />
                <meshBasicMaterial color="#94a3b8" />
              </mesh>
            </group>
          ),
          chestBone
        )
      )}

      {/* Primary Weapon Physically Socketed Inside Hand_R Bone Hierarchy (Zero Float, Zero Latency) */}
      {isHoldingFirearm && isAlive && !isRolling && liveAction !== "kick" && handBone && (
        createPortal(
          <group position={gripPos} rotation={gripEuler}>
            <group position={[0, 0, recoilKickRef.current]}>
              <InklineModel
                assetKey={weaponKey}
                scale={activeWeapon === "shotgun" ? 1.05 : activeWeapon === "pistol" ? 0.95 : 1.1}
              />

              {/* Physical Barrel Socket Muzzle Tip Reference & Flash */}
              <group ref={muzzleTipRef} position={activeWeapon === "shotgun" ? [0, 0.04, 0.58] : [0, 0.04, 0.52]}>
                {(isFiring || (typeof flashElapsed === "number" && flashElapsed >= 0 && flashElapsed <= 65)) && (
                  <>
                    {/* Central high-intensity white core */}
                    <mesh>
                      <sphereGeometry args={[0.065, 8, 8]} />
                      <meshBasicMaterial color="#ffffff" />
                    </mesh>
                    {/* Stylized 8-point Manga Ink Star */}
                    {[0, 45, 90, 135].map((angleDeg, idx) => (
                      <mesh key={idx} rotation={[0, 0, (angleDeg * Math.PI) / 180]}>
                        <planeGeometry args={[idx % 2 === 0 ? 0.38 : 0.22, 0.04]} />
                        <meshBasicMaterial color="#fbbf24" side={THREE.DoubleSide} />
                      </mesh>
                    ))}
                    {/* Forward Conical Gas Flame */}
                    <mesh position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
                      <coneGeometry args={[0.07, 0.22, 6]} />
                      <meshBasicMaterial color="#f59e0b" transparent opacity={0.85} />
                    </mesh>
                    <pointLight intensity={5.0} distance={7} color="#fef08a" />
                  </>
                )}
              </group>

              {/* Laser Aiming Beam Co-axial to Gun Barrel (Weapon Upgrade / Attachment - Off by Default) */}
              {isCurrentPlayer && Boolean(operative ? operative.hasLaser : hasLaser) && (
                <mesh position={activeWeapon === "shotgun" ? [0, 0.04, 6.0] : [0, 0.04, 8.0]} rotation={[Math.PI / 2, 0, 0]} material={SharedMaterials.cyanGlow}>
                  <cylinderGeometry args={[0.005, 0.005, 16, 4]} />
                </mesh>
              )}
            </group>
          </group>,
          handBone
        )
      )}

      {/* Handheld F-1 Frag Grenade Socketed Inside Hand_R */}
      {isHoldingGrenade && isAlive && !isRolling && handBone && (
        createPortal(
          <group position={[0, 0.06, 0.02]} scale={1.15}>
            <mesh castShadow>
              <cylinderGeometry args={[0.065, 0.075, 0.15, 10]} />
              <meshStandardMaterial color="#475e2e" roughness={0.7} metalness={0.2} />
            </mesh>
            <mesh position={[0, 0.09, 0]}>
              <cylinderGeometry args={[0.025, 0.025, 0.04, 8]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.8} />
            </mesh>
            <mesh position={[0, 0.12, 0]}>
              <sphereGeometry args={[0.025, 8, 8]} />
              <meshBasicMaterial color="#ef4444" />
            </mesh>
          </group>,
          handBone
        )
      )}
    </group>
  );
}

export const InklineStickCharacter: React.FC<InklineStickCharacterProps> = (props) => {
  const url = useAssetUrl(props.assetKey || "playerStickman");
  if (!url) return null;
  return (
    <React.Suspense fallback={null}>
      <LoadedCharacter {...props} url={url} />
    </React.Suspense>
  );
};
