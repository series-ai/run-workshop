import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeElements } from '@react-three/fiber';
import { buildMacroOccupancyVolume } from 'voxel-kit';
import { SCORCH_MATERIAL } from '../sim/constants';
import { COLD_AGE, HEAT_GLSL, type BodyHeatLook } from './heatLook';
import { ART_STYLE, YARD_LIGHTING } from './style/artStyle';
import { toonGlsl } from './style/toonGlsl';
import { isMobileDevice } from './DynamicDpr';

type MeshSurfaceProps = Omit<ThreeElements['mesh'], 'args' | 'material' | 'position' | 'scale'>;
type VoxelDims = { x: number; y: number; z: number };

function normalizeTextureBytes(data: Uint8Array): Uint8Array<ArrayBuffer> {
  if (data.buffer instanceof ArrayBuffer) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  const normalized = new Uint8Array(data.byteLength);
  normalized.set(data);
  return normalized;
}

export type VoxelVolumeRendererProps = MeshSurfaceProps & {
  dims: VoxelDims;
  voxels: Uint8Array;
  palette: Uint8Array;
  materialParams?: Uint8Array;
  voxelSize?: number;
  position?: [number, number, number];
  /** The body's last heat (heatLook.ts): its age in seconds and its voxel-space center. */
  heatRef?: { readonly current: BodyHeatLook };
  worldOcclusion?: {
    texture: THREE.Data3DTexture;
    min: [number, number, number];
    max: [number, number, number];
    sunDirection?: [number, number, number];
  };
};

export function VoxelVolumeRenderer({
  dims,
  voxels,
  palette,
  materialParams,
  voxelSize = 0.08,
  position = [0, 0, 0],
  heatRef,
  worldOcclusion,
  ...meshProps
}: VoxelVolumeRendererProps) {
  const isWebGL2 = useThree((state) => state.gl.capabilities.isWebGL2);

  const { emptyWorldTex, macroVoxelTex, material, materialParamsTex, paletteTex, scale, voxelTex } = useMemo(() => {
    if (!isWebGL2) {
      throw new Error('VoxelVolumeRenderer requires WebGL2 for Data3DTexture support.');
    }

    const voxelTex = new THREE.Data3DTexture(normalizeTextureBytes(voxels), dims.x, dims.y, dims.z);
    voxelTex.format = THREE.RedFormat;
    voxelTex.type = THREE.UnsignedByteType;
    voxelTex.minFilter = THREE.NearestFilter;
    voxelTex.magFilter = THREE.NearestFilter;
    voxelTex.unpackAlignment = 1;
    voxelTex.needsUpdate = true;

    const macroVolume = buildMacroOccupancyVolume(voxels, dims, 4);
    const macroVoxelTex = new THREE.Data3DTexture(
      normalizeTextureBytes(macroVolume.data),
      macroVolume.dims.x,
      macroVolume.dims.y,
      macroVolume.dims.z,
    );
    macroVoxelTex.format = THREE.RedFormat;
    macroVoxelTex.type = THREE.UnsignedByteType;
    macroVoxelTex.minFilter = THREE.NearestFilter;
    macroVoxelTex.magFilter = THREE.NearestFilter;
    macroVoxelTex.unpackAlignment = 1;
    macroVoxelTex.needsUpdate = true;

    const paletteTex = new THREE.DataTexture(normalizeTextureBytes(palette), 256, 1, THREE.RGBAFormat);
    paletteTex.type = THREE.UnsignedByteType;
    paletteTex.colorSpace = THREE.SRGBColorSpace;
    paletteTex.minFilter = THREE.NearestFilter;
    paletteTex.magFilter = THREE.NearestFilter;
    paletteTex.needsUpdate = true;

    const materialParamsTex = new THREE.DataTexture(
      normalizeTextureBytes(materialParams ?? new Uint8Array(256 * 4)),
      256,
      1,
      THREE.RGBAFormat,
    );
    materialParamsTex.type = THREE.UnsignedByteType;
    materialParamsTex.minFilter = THREE.NearestFilter;
    materialParamsTex.magFilter = THREE.NearestFilter;
    materialParamsTex.needsUpdate = true;

    const emptyWorldTex = new THREE.Data3DTexture(normalizeTextureBytes(new Uint8Array([0])), 1, 1, 1);
    emptyWorldTex.format = THREE.RedFormat;
    emptyWorldTex.type = THREE.UnsignedByteType;
    emptyWorldTex.minFilter = THREE.LinearFilter;
    emptyWorldTex.magFilter = THREE.LinearFilter;
    emptyWorldTex.unpackAlignment = 1;
    emptyWorldTex.needsUpdate = true;

    const vertexShader = /* glsl */ `
    precision highp float;
    in vec3 position;

    uniform mat4 modelMatrix;
    uniform mat4 viewMatrix;
    uniform mat4 projectionMatrix;
    uniform vec3 cameraPosition;

    out vec3 vRayOriginLS;
    out vec3 vRayDirLS;

    void main() {
      mat4 invModel = inverse(modelMatrix);
      vec3 originLS = (invModel * vec4(cameraPosition, 1.0)).xyz;
      vRayOriginLS = originLS;
      vRayDirLS = position - originLS;
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
    }
    `;

    const fragmentShader = /* glsl */ `
    precision highp float;
    precision highp sampler3D;

    in vec3 vRayOriginLS;
    in vec3 vRayDirLS;

    uniform sampler3D uVoxels;
    uniform sampler3D uMacroOcc;
    uniform sampler2D uPalette;
    uniform sampler2D uMaterialParams;
    uniform sampler3D uWorldOcc;
    uniform vec3 uDims;
    uniform float uMacroCellSize;
    uniform vec3 uWorldMin;
    uniform vec3 uWorldMax;
    uniform vec3 uSunDir;
    uniform vec3 uSunColor;
    uniform vec3 uSkyColor;
    uniform vec3 uGroundColor;
    uniform vec3 uFogColor;
    uniform float uFogNear;
    uniform float uFogFar;
    uniform float uHasWorldOcc;
    uniform float uIsMobile;
    uniform float uOutputSRGB;
    uniform int uHeatMaterial;
    uniform float uHeatAge;
    uniform vec3 uHeatCenter;
    uniform vec3 uBurntColor;
    uniform vec3 cameraPosition;
    uniform mat4 modelMatrix;
    uniform mat4 viewMatrix;
    uniform mat4 projectionMatrix;

    #include <colorspace_pars_fragment>

    ${toonGlsl}
    ${HEAT_GLSL}

    out vec4 outColor;

    vec3 defaultSurfaceNormal(vec3 rd) {
      vec3 absDir = abs(rd);
      if (absDir.x > absDir.y && absDir.x > absDir.z) {
        return vec3(-sign(rd.x), 0.0, 0.0);
      }
      if (absDir.y > absDir.z) {
        return vec3(0.0, -sign(rd.y), 0.0);
      }
      return vec3(0.0, 0.0, -sign(rd.z));
    }

    bool hitBox(vec3 ro, vec3 rd, out float tMin, out float tMax, out vec3 entryNormal) {
      vec3 safeDir = mix(vec3(1e-7), rd, greaterThan(abs(rd), vec3(1e-7)));
      vec3 inv = 1.0 / safeDir;
      vec3 t0s = (-0.5 - ro) * inv;
      vec3 t1s = ( 0.5 - ro) * inv;
      vec3 tsmaller = min(t0s, t1s);
      vec3 tbigger = max(t0s, t1s);
      tMin = max(max(tsmaller.x, tsmaller.y), tsmaller.z);
      tMax = min(min(tbigger.x, tbigger.y), tbigger.z);
      if (tMax < max(tMin, 0.0)) {
        return false;
      }
      if (tsmaller.x > tsmaller.y && tsmaller.x > tsmaller.z) {
        entryNormal = vec3(-sign(rd.x), 0.0, 0.0);
      } else if (tsmaller.y > tsmaller.z) {
        entryNormal = vec3(0.0, -sign(rd.y), 0.0);
      } else {
        entryNormal = vec3(0.0, 0.0, -sign(rd.z));
      }
      return true;
    }

    bool isMacroEmpty(ivec3 cell) {
      ivec3 macroCell = cell / int(uMacroCellSize);
      return texelFetch(uMacroOcc, macroCell, 0).r < 0.01;
    }

    int voxelAt(ivec3 c) {
      return int(round(texelFetch(uVoxels, c, 0).r * 255.0));
    }

    int safeVoxelAt(ivec3 c) {
      if (any(lessThan(c, ivec3(0))) || any(greaterThanEqual(c, ivec3(uDims)))) {
        return 0;
      }
      return voxelAt(c);
    }

    float surfaceExposure(ivec3 cell, vec3 faceNormal) {
      ivec3 faceDir = ivec3(round(faceNormal));
      ivec3 tangentA;
      ivec3 tangentB;

      if (abs(faceNormal.x) > 0.5) {
        tangentA = ivec3(0, 1, 0);
        tangentB = ivec3(0, 0, 1);
      } else if (abs(faceNormal.y) > 0.5) {
        tangentA = ivec3(1, 0, 0);
        tangentB = ivec3(0, 0, 1);
      } else {
        tangentA = ivec3(1, 0, 0);
        tangentB = ivec3(0, 1, 0);
      }

      float filled = 0.0;
      filled += float(safeVoxelAt(cell - faceDir) != 0);
      filled += float(safeVoxelAt(cell + tangentA) != 0);
      filled += float(safeVoxelAt(cell - tangentA) != 0);
      filled += float(safeVoxelAt(cell + tangentB) != 0);
      filled += float(safeVoxelAt(cell - tangentB) != 0);
      return clamp(1.0 - filled / 5.0, 0.0, 1.0);
    }

    float worldOccAt(vec3 worldPos) {
      if (uHasWorldOcc < 0.5) {
        return 0.0;
      }

      vec3 uvw = (worldPos - uWorldMin) / max(uWorldMax - uWorldMin, vec3(1e-4));
      if (any(lessThan(uvw, vec3(0.0))) || any(greaterThan(uvw, vec3(1.0)))) {
        return 0.0;
      }
      return texture(uWorldOcc, uvw).r;
    }

    float shadowAlongSun(vec3 worldPos, vec3 worldNormal) {
      if (uHasWorldOcc < 0.5) {
        return 1.0;
      }

      vec3 start = worldPos + worldNormal * 0.18 + uSunDir * 0.12;
      float shadow = 1.0;
      int maxProbes = uIsMobile > 0.5 ? 4 : 7;
      float stepDist = uIsMobile > 0.5 ? 0.60 : 0.40;
      for (int i = 0; i < 7; i++) {
        if (i >= maxProbes) break;
        vec3 probe = start + uSunDir * (0.12 + float(i) * stepDist);
        float occ = worldOccAt(probe);
        if (occ > 0.02) {
          shadow = min(shadow, clamp(1.0 - occ * 0.85, 0.36, 1.0));
          if (shadow <= 0.36) break;
        }
      }
      return shadow;
    }

    float ambientOcclusion(vec3 worldPos, vec3 worldNormal) {
      if (uHasWorldOcc < 0.5) {
        return 1.0;
      }

      float occ = 0.0;
      for (int i = 1; i <= 4; i++) {
        occ += worldOccAt(worldPos + worldNormal * (0.12 * float(i)));
      }
      return clamp(1.0 - occ * 0.18, 0.45, 1.0);
    }

    void main() {
      vec3 ro = vRayOriginLS;
      vec3 rd = normalize(vRayDirLS);

      float tEntry;
      float tExit;
      vec3 entryNormal;
      if (!hitBox(ro, rd, tEntry, tExit, entryNormal)) {
        discard;
      }

      // Convert ray to voxel coordinate space [0, uDims]
      vec3 roVox = (ro + 0.5) * uDims;
      vec3 rdVox = rd * uDims;

      float tStart = max(0.0, tEntry);
      vec3 p = roVox + rdVox * (tStart + 1e-5);
      ivec3 cell = ivec3(clamp(floor(p), vec3(0.0), uDims - vec3(1.0)));
      vec3 faceNormal = tEntry >= 0.0 ? entryNormal : defaultSurfaceNormal(rd);

      vec3 stepDir = sign(rdVox);
      vec3 invRdVox = 1.0 / max(abs(rdVox), vec3(1e-7));
      vec3 tDelta = invRdVox;
      vec3 nextBoundary = mix(vec3(cell), vec3(cell + 1), step(vec3(0.0), rdVox));
      vec3 tMax = (nextBoundary - roVox) * stepDir * invRdVox;

      tMax = mix(vec3(1e20), tMax, greaterThan(abs(rdVox), vec3(1e-7)));

      vec3 lightDir = normalize(uSunDir);
      mat3 rotMat = mat3(
        normalize(modelMatrix[0].xyz),
        normalize(modelMatrix[1].xyz),
        normalize(modelMatrix[2].xyz)
      );

      float tHit = tStart;
      const int MAX_STEPS = 96;
      for (int i = 0; i < MAX_STEPS; i++) {
        // Hierarchical macro-occupancy acceleration: leapfrog empty 4x4x4 voxel void blocks
        if (isMacroEmpty(cell)) {
          ivec3 macroIdx = cell / int(uMacroCellSize);
          vec3 nextMacroBoundary = mix(vec3(macroIdx) * uMacroCellSize, vec3(macroIdx + 1) * uMacroCellSize, step(vec3(0.0), rdVox));
          vec3 tMacroExit = (nextMacroBoundary - roVox) * stepDir * invRdVox;
          tMacroExit = mix(vec3(1e20), tMacroExit, greaterThan(abs(rdVox), vec3(1e-7)));
          float tSkip = min(min(tMacroExit.x, tMacroExit.y), tMacroExit.z);
          if (tSkip > tHit + 1e-4) {
            tHit = tSkip;
            if (tMacroExit.x <= tMacroExit.y && tMacroExit.x <= tMacroExit.z) {
              faceNormal = vec3(-stepDir.x, 0.0, 0.0);
            } else if (tMacroExit.y <= tMacroExit.z) {
              faceNormal = vec3(0.0, -stepDir.y, 0.0);
            } else {
              faceNormal = vec3(0.0, 0.0, -stepDir.z);
            }
            vec3 newP = roVox + rdVox * (tHit + 1e-5);
            cell = ivec3(floor(newP));
            if (any(lessThan(cell, ivec3(0))) || any(greaterThanEqual(cell, ivec3(uDims)))) {
              break;
            }
            nextBoundary = mix(vec3(cell), vec3(cell + 1), step(vec3(0.0), rdVox));
            tMax = (nextBoundary - roVox) * stepDir * invRdVox;
            tMax = mix(vec3(1e20), tMax, greaterThan(abs(rdVox), vec3(1e-7)));
            continue;
          }
        }

        int materialId = voxelAt(cell);
        if (materialId != 0) {
          float u = (float(materialId) + 0.5) / 256.0;
          vec4 albedo = texture(uPalette, vec2(u, 0.5));
          bool heated = materialId == uHeatMaterial;
          float heatCells = distance(vec3(cell), uHeatCenter);
          float voxelHeatAge = heatAgeAt(uHeatAge, heatCells);
          if (heated) albedo.rgb = heatAlbedo(voxelHeatAge, uBurntColor);

          vec3 hitLS = ro + rd * tHit;
          vec3 worldPos = (modelMatrix * vec4(hitLS, 1.0)).xyz;
          vec3 worldNormal = rotMat * faceNormal;
          vec3 viewDir = normalize(cameraPosition - worldPos);
          vec4 materialInfo = texture(uMaterialParams, vec2(u, 0.5));
          float metalness = materialInfo.g;
          float emissive = materialInfo.b;
          float shadow = shadowAlongSun(worldPos, worldNormal);
          float NdotL = max(dot(worldNormal, lightDir), 0.0);

          vec3 shaded = albedo.rgb;

          // Keep texture variation fixed to each voxel as the camera moves.
          float vHash = fract(sin(dot(vec3(cell), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          float speckle = (vHash - 0.5) * 0.08;
          vec3 gritAlbedo = albedo.rgb * (1.0 + speckle);

          // Astra Teardown Pass: Dual-Hemisphere Ambient Diffuse + Smooth Shadow Response
          float visibility = smoothstep(0.36, 1.0, shadow);
          shaded = gritAlbedo * yardDiffuse(worldNormal, lightDir, visibility);

          // Astra Teardown Specular Glint & Glancing Fresnel Rim
          shaded += yardMetal(worldNormal, viewDir, lightDir, metalness, visibility);

          // Torch and blast heat: a red glow that cools (heatLook.ts).
          if (heated) {
            shaded += heatEmission(voxelHeatAge, heatCells);
          } else if (emissive > 0.01) {
            vec3 moltenOrange = vec3(1.0, 0.32, 0.02);
            vec3 moltenGold = vec3(1.0, 0.85, 0.22);
            vec3 emissiveColor = mix(moltenOrange, moltenGold, smoothstep(0.2, 0.85, emissive)) * (emissive * 2.6);
            shaded += emissiveColor;
          }

          // Astra Teardown Height Fog (Industrial Ground Dust Haze)
          shaded = mix(shaded, uFogColor, yardFog(worldPos, cameraPosition, -0.86));
          // Linear into the ink composer's target; sRGB only straight to the screen.
          outColor = vec4(yardShoulder(shaded), 1.0);
          if (uOutputSRGB > 0.5) outColor = sRGBTransferOETF(outColor);


          vec4 clip = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
          float ndc = clip.z / clip.w;
          gl_FragDepth = ndc * 0.5 + 0.5;
          return;
        }

        if (tMax.x < tMax.y) {
          if (tMax.x < tMax.z) {
            tHit = tMax.x;
            cell.x += int(stepDir.x);
            tMax.x += tDelta.x;
            faceNormal = vec3(-stepDir.x, 0.0, 0.0);
          } else {
            tHit = tMax.z;
            cell.z += int(stepDir.z);
            tMax.z += tDelta.z;
            faceNormal = vec3(0.0, 0.0, -stepDir.z);
          }
        } else {
          if (tMax.y < tMax.z) {
            tHit = tMax.y;
            cell.y += int(stepDir.y);
            tMax.y += tDelta.y;
            faceNormal = vec3(0.0, -stepDir.y, 0.0);
          } else {
            tHit = tMax.z;
            cell.z += int(stepDir.z);
            tMax.z += tDelta.z;
            faceNormal = vec3(0.0, 0.0, -stepDir.z);
          }
        }

        if (any(lessThan(cell, ivec3(0))) || any(greaterThanEqual(cell, ivec3(uDims)))) {
          break;
        }
      }

      discard;
    }
    `;

    const shaderMaterial = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader,
      uniforms: {
        uVoxels: { value: voxelTex },
        uMacroOcc: { value: macroVoxelTex },
        uPalette: { value: paletteTex },
        uMaterialParams: { value: materialParamsTex },
        uWorldOcc: { value: worldOcclusion?.texture ?? emptyWorldTex },
        uDims: { value: new THREE.Vector3(dims.x, dims.y, dims.z) },
        uMacroCellSize: { value: macroVolume.cellSize },
        uWorldMin: { value: new THREE.Vector3(...(worldOcclusion?.min ?? [0, 0, 0])) },
        uWorldMax: { value: new THREE.Vector3(...(worldOcclusion?.max ?? [1, 1, 1])) },
        uSunDir: {
          value: new THREE.Vector3(...(worldOcclusion?.sunDirection ?? [0.55, 0.82, 0.25])).normalize(),
        },
        uRampEdges: { value: new THREE.Vector2(ART_STYLE.ramp.edges[0], ART_STYLE.ramp.edges[1]) },
        uShadeTint: { value: new THREE.Vector3(...ART_STYLE.ramp.shadeTint) },
        uLitTint: { value: new THREE.Vector3(...ART_STYLE.ramp.litTint) },
        uHalfLevel: { value: ART_STYLE.ramp.halfLevel },
        uAmbientFloor: { value: new THREE.Color(...YARD_LIGHTING.ambientFloor) },
        uSunColor: { value: new THREE.Color(...YARD_LIGHTING.sun) }, // Astra warm tungsten sun
        uSkyColor: { value: new THREE.Color(...YARD_LIGHTING.sky) }, // Astra cool blue-slate sky fill
        uGroundColor: { value: new THREE.Color(...YARD_LIGHTING.ground) }, // Astra warm concrete ground bounce
        uFogColor: { value: new THREE.Color(ART_STYLE.palette.haze) },
        uFogNear: { value: 35.0 },
        uFogFar: { value: 110.0 },
        uHasWorldOcc: { value: worldOcclusion ? 1 : 0 },
        uIsMobile: { value: isMobileDevice() ? 1.0 : 0.0 },
        uOutputSRGB: { value: 1 },
        uHeatMaterial: { value: SCORCH_MATERIAL },
        uHeatAge: { value: COLD_AGE },
        uHeatCenter: { value: new THREE.Vector3() },
        uBurntColor: { value: new THREE.Color(ART_STYLE.palette.burnt) },
      },
      side: THREE.BackSide,
      depthTest: true,
      depthWrite: true,
    });

    // Three.js encodes sRGB only for the default framebuffer. This raw shader must match it.
    shaderMaterial.onBeforeRender = (renderer) => {
      const outputSRGB = renderer.getRenderTarget() === null ? 1 : 0;
      if (shaderMaterial.uniforms.uOutputSRGB!.value !== outputSRGB) {
        shaderMaterial.uniforms.uOutputSRGB!.value = outputSRGB;
        shaderMaterial.uniformsNeedUpdate = true;
      }
    };

    return {
      emptyWorldTex,
      macroVoxelTex,
      material: shaderMaterial,
      materialParamsTex,
      paletteTex,
      scale: new THREE.Vector3(dims.x * voxelSize, dims.y * voxelSize, dims.z * voxelSize),
      voxelTex,
    };
  }, [
    dims.x,
    dims.y,
    dims.z,
    isWebGL2,
    materialParams,
    palette,
    voxelSize,
    voxels,
    worldOcclusion,
  ]);

  useFrame(() => {
    const heat = heatRef?.current;
    material.uniforms.uHeatAge!.value = heat?.age ?? COLD_AGE;
    if (heat) (material.uniforms.uHeatCenter!.value as THREE.Vector3).set(heat.at[0], heat.at[1], heat.at[2]);
  });

  useEffect(() => {
    return () => {
      emptyWorldTex.dispose();
      macroVoxelTex.dispose();
      material.dispose();
      materialParamsTex.dispose();
      voxelTex.dispose();
      paletteTex.dispose();
    };
  }, [emptyWorldTex, macroVoxelTex, material, materialParamsTex, paletteTex, voxelTex]);

  return (
    <mesh material={material} scale={scale} position={position} {...meshProps}>
      <boxGeometry args={[1, 1, 1]} />
    </mesh>
  );
}
