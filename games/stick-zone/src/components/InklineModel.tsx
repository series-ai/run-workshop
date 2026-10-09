import React, { useEffect, useMemo, useRef } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import { useAssetUrl } from "../useAssetUrl.js";
import { addOutlines, disposeInstance } from "../render/celShader.js";
import type { AssetKey } from "../assetLibrary.js";

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
        if (tintColor && mesh.material) {
          const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
          if (mat && mat.color) {
            mat.color.set(tintColor);
          }
        }
      }
    });

    if (addStaticOutlines) {
      addOutlines(clonedScene, '#494c46', 0.65);
    }

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
