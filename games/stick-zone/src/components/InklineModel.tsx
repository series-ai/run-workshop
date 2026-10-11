import React, { useEffect, useMemo, useRef } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import { useAssetUrl } from "../useAssetUrl.js";
import { addOutlines, disposeInstance } from "../render/celShader.js";
import { globalCutaway } from "../render/cutaway.js";
import type { AssetKey } from "../assetLibrary.js";


const DEFAULT_TACTICAL_TINTS: Partial<Record<AssetKey, string>> = {
  cargoContainer: "#3d4a36",
  barrierConcrete: "#787366",
  terminalConsole: "#222a24",
  powerCore: "#292f2b",
  dumpster: "#354235",
  barrel: "#b48228",
  watertankIndustrial: "#4a544c",
  catwalkStraight: "#2f3631",
  pipeStraight: "#524c42",
  pipeCurve: "#524c42",
  valveWheel: "#854d0e",
  floodlightTower: "#29302c",
  teleporterPad: "#1e2421",
  warpBeacon: "#262c28",
  crateMilitary: "#3f4939",
  stackedPallets: "#6b583e",
  generatorLarge: "#2b332d",
};

export interface InklineModelProps {
  assetKey: AssetKey;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  animationName?: string;
  tintColor?: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
  addStaticOutlines?: boolean;
  onLoaded?: (group: THREE.Group) => void;
}

function LoadedInklineModel({
  url,
  assetKey,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  animationName,
  tintColor,
  castShadow = true,
  receiveShadow = true,
  addStaticOutlines = true,
  onLoaded,
}: InklineModelProps & { url: string }) {
  const { scene, animations } = useGLTF(url);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const groupRef = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, groupRef);

  // Play animation if available
  useEffect(() => {
    if (!actions || animations.length === 0) return;
    const clipName =
      animationName && actions[animationName]
        ? animationName
        : animations[0]?.name;

    if (clipName && actions[clipName]) {
      const activeAction = actions[clipName];
      activeAction.reset().fadeIn(0.15).play();
      return () => {
        activeAction.fadeOut(0.15);
      };
    }
  }, [actions, animationName, animations]);

  // Apply shadows, optional tint, edge outlines, and disposal
  useEffect(() => {
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = castShadow;
        mesh.receiveShadow = receiveShadow;
        const effectiveTint = tintColor || DEFAULT_TACTICAL_TINTS[assetKey];
        if (effectiveTint && mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            if ("color" in m && m.color instanceof THREE.Color) {
              m.color.set(effectiveTint);
            }
            if ("roughness" in m) (m as THREE.MeshStandardMaterial).roughness = 0.92;
            if ("metalness" in m) (m as THREE.MeshStandardMaterial).metalness = 0.05;
          }
        }
      }
    });

    if (addStaticOutlines) {
      addOutlines(clonedScene, '#494c46', 0.65);
    }

    // Foreground cutaway hole discard removed in favor of full solid geometry and occluded X-Ray outlines

    if (onLoaded && groupRef.current) {
      onLoaded(groupRef.current);
    }

    return () => {
      disposeInstance(clonedScene);
    };
  }, [clonedScene, castShadow, receiveShadow, tintColor, addStaticOutlines, onLoaded]);

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale} dispose={null}>
      <primitive object={clonedScene} />
    </group>
  );
}

export const InklineModel: React.FC<InklineModelProps> = (props) => {
  const url = useAssetUrl(props.assetKey);
  if (!url) return null;
  return (
    <React.Suspense fallback={null}>
      <LoadedInklineModel {...props} url={url} />
    </React.Suspense>
  );
};
