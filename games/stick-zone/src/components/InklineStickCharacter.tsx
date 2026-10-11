import React, { useEffect, useMemo, useRef } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import { useFrame, createPortal } from "@react-three/fiber";
import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { useAssetUrl } from "../useAssetUrl.js";
import { InklineModel } from "./InklineModel.js";
import {
  applyCelShading,
  updatePaleInkContour,
  disposeInstance,
} from "../render/celShader.js";
import type { AssetKey } from "../assetLibrary.js";

const GUNMETAL_BODY_COLOR = "#292e36";

export interface InklineStickCharacterProps {
  isCurrentPlayer?: boolean;
  assetKey?: AssetKey;
  weapon?: "rifle" | "shotgun" | "pistol";
  isMoving: boolean;
  isFiring: boolean;
  flashElapsed?: number;
  isAlive: boolean;
  isRolling?: boolean;
  isBleeding?: boolean;
  facing: number;
  accentColor: string;
  hasWeapon?: boolean;
  onSampleBones?: (bones: { footR: THREE.Vector3; handR: THREE.Vector3 }) => void;
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
  url,
  weapon = "rifle",
  isMoving,
  isFiring,
  flashElapsed,
  isAlive,
  isRolling = false,
  facing,
  accentColor,
  hasWeapon = true,
  isCurrentPlayer = false,
  onSampleBones,
}: InklineStickCharacterProps & { url: string }) {
  const { scene, animations } = useGLTF(url);
  const clonedScene = useMemo(() => skeletonClone(scene), [scene]);
  const groupRef = useRef<THREE.Group>(null);

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

  // Transition animations smoothly based on operative locomotion & combat state
  useEffect(() => {
    if (!actions) return;

    let targetClip = "rifle-idle";
    if (!isAlive) {
      targetClip = actions["death"] ? "death" : "idle";
    } else if (isRolling && actions["roll"]) {
      targetClip = "roll";
    } else if (isFiring) {
      if (weapon === "shotgun" && actions["shotgun-fire"]) {
        targetClip = "shotgun-fire";
      } else if (weapon === "pistol" && actions["pistol-fire"]) {
        targetClip = "pistol-fire";
      } else if (actions["rifle-fire"]) {
        targetClip = "rifle-fire";
      }
    } else if (isMoving) {
      if (hasWeapon && weapon === "shotgun" && actions["run-shotgun"]) {
        targetClip = "run-shotgun";
      } else if (hasWeapon && weapon === "pistol" && actions["run-pistol"]) {
        targetClip = "run-pistol";
      } else if (hasWeapon && actions["run-rifle"]) {
        targetClip = "run-rifle";
      } else if (actions["run"]) {
        targetClip = "run";
      }
    } else if (hasWeapon && weapon === "pistol" && actions["pistol-idle"]) {
      targetClip = "pistol-idle";
    } else if (hasWeapon && actions["rifle-idle"]) {
      targetClip = "rifle-idle";
    } else if (actions["idle"]) {
      targetClip = "idle";
    }

    const action = actions[targetClip];
    if (action) {
      if (targetClip === "death") {
        action.reset().play();
        action.clampWhenFinished = true;
        action.loop = THREE.LoopOnce;
      } else {
        action.reset().fadeIn(0.12).play();
      }
    }

    return () => {
      if (action && targetClip !== "death") {
        action.fadeOut(0.12);
      }
    };
  }, [actions, isMoving, isFiring, isAlive, isRolling, weapon, hasWeapon]);

  // Apply graphic-novel cel-shading, ink contours, palette, and disposal
  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh && !child.userData.inkContour) {
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

        // Attach authentic Inkline screen-space back-face contour with squad/team accent
        const contourColor = isCurrentPlayer ? "#38bdf8" : accentColor;
        updatePaleInkContour(child, 1.45, contourColor);
      }
    });

    return () => {
      disposeInstance(clonedScene);
    };
  }, [clonedScene, accentColor]);

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
  });

  const weaponKey: AssetKey =
    weapon === "shotgun" ? "shotgun" : weapon === "pistol" ? "pistol" : "rifle";

  // Exact grip rotation angles in right hand palm (Euler radians)
  const gripEuler: [number, number, number] =
    weapon === "shotgun"
      ? [(-24 * Math.PI) / 180, (-38 * Math.PI) / 180, (10 * Math.PI) / 180]
      : weapon === "pistol"
      ? [(-15 * Math.PI) / 180, (-35 * Math.PI) / 180, (5 * Math.PI) / 180]
      : [(-27.37 * Math.PI) / 180, (-40.81 * Math.PI) / 180, (12.82 * Math.PI) / 180];

  // Exact grip translation offsets within Hand_R palm
  const gripPos: [number, number, number] =
    weapon === "shotgun"
      ? [0, 0.04, 0.03]
      : weapon === "pistol"
      ? [0, 0.06, 0.01]
      : [0, 0.05, 0.02];

  return (
    <group ref={groupRef} rotation={[0, facing, 0]} dispose={null}>
      {/* 3D Skeletal Mesh with Cel-Shading and Ink Contours */}
      <primitive object={clonedScene} />

      {/* DISTINCT CHARACTER PROPS & TACTICAL GEAR */}
      {/* Head Gear: Player Cyber Visor vs Squadmate Recon Beret vs Rival Faceplate */}
      {isAlive && headBone && (
        createPortal(
          isCurrentPlayer ? (
            /* Player Cyber Visor with Glowing Cyan Lens Band */
            <group position={[0, 0.08, 0.12]}>
              <mesh>
                <boxGeometry args={[0.22, 0.05, 0.08]} />
                <meshBasicMaterial color="#0f172a" />
              </mesh>
              <mesh position={[0, 0, 0.045]}>
                <boxGeometry args={[0.18, 0.03, 0.02]} />
                <meshBasicMaterial color="#38bdf8" />
              </mesh>
              {/* Comms Boom Mic */}
              <mesh position={[-0.10, -0.04, 0.08]} rotation={[0, 0, -0.2]}>
                <cylinderGeometry args={[0.008, 0.008, 0.12]} />
                <meshBasicMaterial color="#475569" />
              </mesh>
            </group>
          ) : (
            /* Squadmate Recon Beret with Antenna */
            <group position={[0.04, 0.17, -0.02]} rotation={[0.1, 0, -0.25]}>
              <mesh>
                <cylinderGeometry args={[0.13, 0.11, 0.06, 16]} />
                <meshStandardMaterial color="#1e3a8a" roughness={0.9} />
              </mesh>
              {/* Recon Antenna */}
              <mesh position={[-0.10, 0.08, -0.02]} rotation={[0.15, 0, -0.1]}>
                <cylinderGeometry args={[0.006, 0.006, 0.28]} />
                <meshBasicMaterial color="#94a3b8" />
              </mesh>
            </group>
          ),
          headBone
        )
      )}

      {/* Chest Gear: Player Plate Carrier vs Squadmate Radio Pack */}
      {isAlive && chestBone && (
        createPortal(
          isCurrentPlayer ? (
            /* Tactical Plate Harness */
            <group position={[0, 0.08, 0.08]}>
              <mesh>
                <boxGeometry args={[0.24, 0.22, 0.05]} />
                <meshStandardMaterial color="#1e293b" roughness={0.7} />
              </mesh>
              {/* Dual Mag Pouches */}
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
                <meshStandardMaterial color="#172554" roughness={0.8} />
              </mesh>
              {/* Radio Antenna */}
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
      {hasWeapon && isAlive && !isRolling && handBone && (
        createPortal(
          <group position={gripPos} rotation={gripEuler}>
            <group position={[0, 0, recoilKickRef.current]}>
              <InklineModel
                assetKey={weaponKey}
                scale={weapon === "shotgun" ? 1.05 : weapon === "pistol" ? 0.95 : 1.1}
              />

              {/* Barrel Socket Muzzle Flash (0-80ms physically rooted at barrel tip) */}
              {(isFiring || (typeof flashElapsed === "number" && flashElapsed >= 0 && flashElapsed <= 80)) && (
                <group position={weapon === "shotgun" ? [0, 0.04, 0.58] : [0, 0.04, 0.52]}>
                  <mesh rotation={[0, 0, Math.random() * Math.PI]}>
                    <ringGeometry args={[0.03, 0.28, 4]} />
                    <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
                  </mesh>
                  <mesh rotation={[0, 0, (Math.random() + 0.5) * Math.PI]}>
                    <ringGeometry args={[0.05, 0.38, 4]} />
                    <meshBasicMaterial color={weapon === "shotgun" ? "#f59e0b" : "#fbbf24"} side={THREE.DoubleSide} />
                  </mesh>
                  <pointLight intensity={4.0} distance={6} color="#fef08a" />
                </group>
              )}

              {/* Physical Ballistic Tracers Extending Directly from Barrel Tip (Zero Offset) */}
              {typeof flashElapsed === "number" && flashElapsed >= 0 && flashElapsed <= 240 && (
                <group position={weapon === "shotgun" ? [0, 0.04, 0.58] : [0, 0.04, 0.52]}>
                  {weapon === "shotgun" ? (
                    <group>
                      {[-0.08, -0.04, 0, 0.04, 0.08].map((spreadX, idx) => (
                        <mesh key={idx} position={[spreadX, (idx % 2 - 0.5) * 0.03, 2.6]} rotation={[Math.PI / 2, 0, 0]}>
                          <cylinderGeometry args={[0.022, 0.012, 5.2, 5]} />
                          <meshBasicMaterial color="#fbbf24" transparent opacity={0.9} />
                        </mesh>
                      ))}
                    </group>
                  ) : (
                    <mesh position={[0, 0, 7.5]} rotation={[Math.PI / 2, 0, 0]}>
                      <cylinderGeometry args={[0.018, 0.018, 15, 5]} />
                      <meshBasicMaterial color="#fef08a" transparent opacity={0.9} />
                    </mesh>
                  )}
                </group>
              )}

              {/* Laser Aiming Beam Co-axial to Gun Barrel */}
              {isCurrentPlayer && (
                <mesh position={weapon === "shotgun" ? [0, 0.04, 6.0] : [0, 0.04, 8.0]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.005, 0.005, 16, 4]} />
                  <meshBasicMaterial color="#38bdf8" transparent opacity={0.4} />
                </mesh>
              )}
            </group>
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
