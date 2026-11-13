import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  computeVisibilityPolygon,
  MAX_VISIBILITY_RAYS,
  type LightOcclusionOptions,
} from "../render/lightOcclusion.js";
import { ALL_OCCLUDING_OBSTACLES, type OperativeState } from "../sim/game.js";

export interface DynamicFlashlightOcclusionProps {
  operative?: OperativeState;
  origin?: { x: number; y: number; z: number };
  facing?: number;
  isActive?: boolean;
  colorHex?: string;
  maxRange?: number;
  halfAngle?: number;
  baseAlpha?: number;
  showSpotLight?: boolean;
}

const MAX_RAYS = MAX_VISIBILITY_RAYS;
const MAX_VERTICES = MAX_RAYS + 1;

export const DynamicFlashlightOcclusion: React.FC<DynamicFlashlightOcclusionProps> = ({
  operative,
  origin,
  facing,
  isActive = true,
  colorHex = "#fffbeb",
  maxRange = 24.0,
  halfAngle = 0.50,
  baseAlpha = 0.55,
  showSpotLight = true,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const edgesRef = useRef<THREE.LineSegments>(null);
  const spotLightRef = useRef<THREE.SpotLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);
  const lastStateRef = useRef({ x: -9999, z: -9999, facing: -9999 });

  // Pre-allocate fixed buffers to prevent runtime GC garbage
  const meshGeom = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX_VERTICES * 3);
    const col = new Float32Array(MAX_VERTICES * 4);
    const idx = new Uint16Array(MAX_RAYS * 3);

    const posAttr = new THREE.BufferAttribute(pos, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    geom.setAttribute("position", posAttr);

    const colAttr = new THREE.BufferAttribute(col, 4);
    colAttr.setUsage(THREE.DynamicDrawUsage);
    geom.setAttribute("color", colAttr);

    const idxAttr = new THREE.BufferAttribute(idx, 1);
    idxAttr.setUsage(THREE.DynamicDrawUsage);
    geom.setIndex(idxAttr);

    geom.setDrawRange(0, 0);
    return geom;
  }, []);

  const edgeGeom = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX_RAYS * 6);
    const posAttr = new THREE.BufferAttribute(pos, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    geom.setAttribute("position", posAttr);
    geom.setDrawRange(0, 0);
    return geom;
  }, []);

  useEffect(() => {
    return () => {
      meshGeom.dispose();
      edgeGeom.dispose();
    };
  }, [meshGeom, edgeGeom]);

  useFrame(() => {
    const curActive = operative ? (operative.isFlashlightOn ?? true) : isActive;
    if (!curActive) {
      if (meshRef.current) meshRef.current.visible = false;
      if (edgesRef.current) edgesRef.current.visible = false;
      if (spotLightRef.current) spotLightRef.current.visible = false;
      return;
    }

    if (meshRef.current) meshRef.current.visible = true;
    if (edgesRef.current) edgesRef.current.visible = true;
    if (spotLightRef.current) spotLightRef.current.visible = showSpotLight;

    const curX = operative ? operative.x : (origin?.x ?? 0);
    const curY = operative ? (operative.y || 0) : (origin?.y ?? 0);
    const curZ = operative ? operative.z : (origin?.z ?? 0);
    const curFacing = operative ? operative.facing : (facing ?? 0);

    const last = lastStateRef.current;
    const dx = curX - last.x;
    const dz = curZ - last.z;
    const df = Math.abs(curFacing - last.facing);
    if (dx * dx + dz * dz < 0.0001 && df < 0.002) {
      return;
    }
    last.x = curX;
    last.z = curZ;
    last.facing = curFacing;

    const poly = computeVisibilityPolygon(
      curX,
      curZ,
      curFacing,
      ALL_OCCLUDING_OBSTACLES,
      {
        maxRange,
        halfAngle,
        colorHex,
        baseAlpha,
        groundY: 0.03,
      }
    );

    // Update ground light fan
    const posAttr = meshGeom.attributes.position as THREE.BufferAttribute;
    const colAttr = meshGeom.attributes.color as THREE.BufferAttribute;
    const idxAttr = meshGeom.index as THREE.BufferAttribute;

    const copyVerts = Math.min(poly.vertexCount, MAX_VERTICES);
    const copyTris = Math.min(poly.triangleCount, MAX_RAYS, Math.max(0, copyVerts - 1));
    (posAttr.array as Float32Array).set(poly.positions.subarray(0, copyVerts * 3));
    (colAttr.array as Float32Array).set(poly.colors.subarray(0, copyVerts * 4));
    (idxAttr.array as Uint16Array).set(poly.indices.subarray(0, copyTris * 3));

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    idxAttr.needsUpdate = true;
    meshGeom.setDrawRange(0, copyTris * 3);

    // Update shadow boundary lines
    const edgePosAttr = edgeGeom.attributes.position as THREE.BufferAttribute;
    const copyEdgeFloats = Math.min(poly.edgeLines.length, MAX_RAYS * 6);
    (edgePosAttr.array as Float32Array).set(poly.edgeLines.subarray(0, copyEdgeFloats));
    edgePosAttr.needsUpdate = true;
    edgeGeom.setDrawRange(0, (copyEdgeFloats / 3));

    // Update 3D spotlight
    if (spotLightRef.current && targetRef.current && showSpotLight) {
      spotLightRef.current.position.set(curX, curY + 1.25, curZ);
      const targetX = curX + Math.sin(curFacing) * 14.0;
      const targetZ = curZ + Math.cos(curFacing) * 14.0;
      targetRef.current.position.set(targetX, 0.4, targetZ);
      targetRef.current.updateMatrixWorld();
      spotLightRef.current.target = targetRef.current;
    }
  });

  return (
    <>
      {/* 2D Ground Occluded Light Fan (Soft Tactical Ground Wash) */}
      <mesh ref={meshRef} geometry={meshGeom} renderOrder={1}>
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.30}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 3D SpotLight for volumetric illumination with soft feathered penumbra */}
      {showSpotLight && (
        <>
          <object3D ref={targetRef} />
          <spotLight
            ref={spotLightRef}
            color={colorHex}
            intensity={5.5}
            distance={maxRange + 12}
            angle={halfAngle * 1.15}
            penumbra={0.75}
            decay={1.6}
          />
        </>
      )}
    </>
  );
};
