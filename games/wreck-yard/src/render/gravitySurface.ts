import * as THREE from 'three';

export interface GravitySurfaceUniforms {
  readonly uGravityHeld: THREE.IUniform<number>;
  readonly uGravityTime: THREE.IUniform<number>;
  readonly uGravityHeldIndices: THREE.IUniform<THREE.Vector4>;
}

/** Shared linear light for toon surfaces and voxel hits. */
export const gravitySurfaceGlsl = /* glsl */ `
  vec3 gravitySurfaceLight(vec3 position, vec3 normal, vec3 viewDirection, float held, float time) {
    if (held < 0.5) return vec3(0.0);
    float facing = clamp(dot(normalize(normal), normalize(viewDirection)), 0.0, 1.0);
    float rim = pow(1.0 - facing, 2.5);
    float phase = dot(position, vec3(1.8, 9.0, 1.1)) - time * 0.85;
    float band = pow(0.5 + 0.5 * sin(phase), 6.0);
    return vec3(0.12, 0.60, 0.78) * (0.035 + rim * 0.32 + band * 0.09) * clamp(held, 0.0, 1.0);
  }
`;

export function createGravitySurfaceUniforms(): GravitySurfaceUniforms {
  return {
    uGravityHeld: { value: 0 },
    uGravityTime: { value: 0 },
    uGravityHeldIndices: { value: new THREE.Vector4(-1, -1, -1, -1) },
  };
}

/** The caller owns this clone. Textures and geometry stay with the source. */
export function createGravityToonMaterial(
  source: THREE.MeshToonMaterial,
  uniforms: GravitySurfaceUniforms,
): THREE.MeshToonMaterial {
  const material = source.clone();
  const sourceCompile = source.onBeforeCompile;
  const sourceKey = source.customProgramCacheKey();
  material.name = `${source.name || 'toon'}-gravity-surface`;
  material.userData.gravitySurfaceUniforms = uniforms;
  material.onBeforeCompile = (shader, renderer) => {
    sourceCompile.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', /* glsl */ `
      #include <common>
      uniform float uGravityHeld;
      uniform vec4 uGravityHeldIndices;
      varying vec3 vGravityLocalPosition;
      varying float vGravityHeld;
    `).replace('#include <begin_vertex>', /* glsl */ `
      #include <begin_vertex>
      vGravityLocalPosition = position;
      #ifdef USE_INSTANCING
        vec4 gravityMatches = 1.0 - step(vec4(0.5), abs(vec4(float(gl_InstanceID)) - uGravityHeldIndices));
        vGravityHeld = max(max(gravityMatches.x, gravityMatches.y), max(gravityMatches.z, gravityMatches.w));
      #else
        vGravityHeld = uGravityHeld;
      #endif
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', /* glsl */ `
      #include <common>
      uniform float uGravityTime;
      varying vec3 vGravityLocalPosition;
      varying float vGravityHeld;
      ${gravitySurfaceGlsl}
    `).replace('#include <opaque_fragment>', /* glsl */ `
      outgoingLight += gravitySurfaceLight(vGravityLocalPosition, normal, vViewPosition, vGravityHeld, uGravityTime);
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey = () => `${sourceKey}|gravity-surface-v1`;
  return material;
}
