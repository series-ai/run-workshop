// Shared GLSL for the material features. Every block is behind a feature
// define that the material sets at creation (bindings.ts). A layer without a
// material object sets no define, so the preprocessor removes all of this and
// the original formulas run unchanged. Composition order (plan, "Shader
// composition"): local UV and atlas cell, one distortion sample, mask on the
// displacement, displacement → rotation → scale → offset → scroll, wrap in the
// local cell, filter-aware inset, atlas placement, existing body, existing
// erosion, then mask and dissolve coverage, then edge and rim inside the
// surviving coverage.

/** Uniforms and helpers for every supported path. Insert before main(). */
export const PFX_MATERIAL_COMMON_CHUNK = /* glsl */ `
#if defined(PFX_MAT_UV) || defined(PFX_MAT_DISTORTION)
  #define PFX_MAT_LOCAL_UV
#endif
#if defined(PFX_MAT_MASK) || defined(PFX_MAT_DISSOLVE)
  #define PFX_MAT_COVERAGE
#endif
#ifdef PFX_MAT_UV
  uniform vec2 uPfxUvScale;
  uniform vec2 uPfxUvOffset;
  uniform float uPfxUvRotation;
  // fract(scroll * effect seconds), bounded on the host in double precision.
  uniform vec2 uPfxUvScrollOffset;
#endif
#ifdef PFX_MAT_DISTORTION
  uniform sampler2D uPfxDistortionMap;
  uniform vec3 uPfxDistortionStrength;
  // Unit axis for noise distortion. Unused by flow distortion.
  uniform vec2 uPfxDistortionDirection;
  uniform vec2 uPfxDistortionScrollOffset;
#endif
#ifdef PFX_MAT_MASK
  uniform sampler2D uPfxMaskMap;
  uniform vec4 uPfxMaskChannel;
  uniform float uPfxMaskStrength;
#endif
#ifdef PFX_MAT_DISSOLVE
  uniform sampler2D uPfxDissolveMap;
  uniform vec3 uPfxDissolveProgress;
  uniform float uPfxDissolveSoftness;
  uniform float uPfxDissolveEdgeWidth;
  uniform vec3 uPfxDissolveEdgeColor;
#endif
#ifdef PFX_MAT_RIM
  uniform float uPfxRimPower;
  uniform vec3 uPfxRimStrength;
  // Feeds the existing hot-colour mix. Equals uColorHot when omitted.
  uniform vec3 uPfxRimColor;
#endif

// Linear life curve with stops at 0, 0.5, and 1. A constant has three equal
// stops; the a + (b - a) * t form then returns it exactly, so an explicit
// value equal to the baseline reproduces the baseline bit for bit.
float pfxLifeValue(vec3 stops, float t) {
  float life = clamp(t, 0.0, 1.0);
  return life < 0.5
    ? stops.x + (stops.y - stops.x) * (life * 2.0)
    : stops.y + (stops.z - stops.y) * (life * 2.0 - 1.0);
}

#ifdef PFX_MAT_LOCAL_UV
// Continuous (unwrapped) local UV. Derivatives for filtering use this value,
// so a repeat seam never selects a coarse mip level.
vec2 pfxMaterialLocalUv(vec2 baseUv, float lifeT, float maskCoverage) {
  vec2 uv = baseUv;
  #ifdef PFX_MAT_DISTORTION
    vec2 pfxDistortionUv = baseUv + uPfxDistortionScrollOffset;
    #ifdef PFX_MAT_DISTORTION_FLOW
      vec2 pfxDisplacement = texture2D(uPfxDistortionMap, pfxDistortionUv).rg * 2.0 - 1.0;
    #else
      vec2 pfxDisplacement = (texture2D(uPfxDistortionMap, pfxDistortionUv).r * 2.0 - 1.0) * uPfxDistortionDirection;
    #endif
    uv += pfxDisplacement * pfxLifeValue(uPfxDistortionStrength, lifeT) * maskCoverage;
  #endif
  #ifdef PFX_MAT_UV
    vec2 pfxCentered = uv - 0.5;
    float pfxCos = cos(uPfxUvRotation);
    float pfxSin = sin(uPfxUvRotation);
    uv = vec2(pfxCos * pfxCentered.x - pfxSin * pfxCentered.y, pfxSin * pfxCentered.x + pfxCos * pfxCentered.y);
    uv = uv * uPfxUvScale + 0.5 + uPfxUvOffset + uPfxUvScrollOffset;
  #endif
  return uv;
}

vec2 pfxWrapLocalUv(vec2 uv) {
  #ifdef PFX_MAT_UV_REPEAT
    return fract(uv);
  #else
    return clamp(uv, 0.0, 1.0);
  #endif
}
#endif
`

/**
 * Sprite-only atlas helpers. `pfxSampleAtlasCell` chooses the mip level from
 * the continuous local UV and widens the cell inset to cover the trilinear
 * footprint at that level, so no sample reaches an adjacent cell at any
 * size, rotation, or blended frame.
 */
export const PFX_MATERIAL_SPRITE_CHUNK = /* glsl */ `
#if defined(PFX_MAT_FRAME_ANIMATION) || defined(PFX_MAT_LOCAL_UV)
  uniform vec2 uPfxAtlasGrid;
  uniform vec2 uPfxAtlasCellPixels;
  uniform float uPfxAtlasMaxLod;
  uniform float uPfxAtlasCellInset;
  vec4 pfxSampleAtlasCell(sampler2D atlas, vec2 cellOrigin, vec2 cellSize, vec2 wrappedUv, vec2 continuousUv) {
    vec2 texelUv = continuousUv * uPfxAtlasCellPixels;
    vec2 pfxDx = dFdx(texelUv);
    vec2 pfxDy = dFdy(texelUv);
    float pfxFootprint = max(dot(pfxDx, pfxDx), dot(pfxDy, pfxDy));
    float pfxLod = clamp(0.5 * log2(max(pfxFootprint, 1e-8)), 0.0, uPfxAtlasMaxLod);
    // Trilinear filtering reads level floor(lod) + 1, whose texels span
    // 2^(lod + 1) base texels at most. Keep that whole footprint in the cell.
    vec2 pfxInset = max(vec2(uPfxAtlasCellInset), vec2(exp2(pfxLod + 1.0)) / uPfxAtlasCellPixels);
    vec2 pfxLocal = mix(pfxInset, vec2(1.0) - pfxInset, wrappedUv);
    return textureLod(atlas, cellOrigin + pfxLocal * cellSize, pfxLod);
  }
#endif
#ifdef PFX_MAT_FRAME_ANIMATION
  uniform float uPfxAtlasFrameCount;
  uniform float uPfxAtlasFrameRate;
  vec4 pfxSampleAtlasFrame(sampler2D atlas, float frame, vec2 wrappedUv, vec2 continuousUv) {
    float pfxColumn = mod(frame, uPfxAtlasGrid.x);
    float pfxRow = floor(frame / uPfxAtlasGrid.x);
    vec2 pfxCell = vec2(1.0) / uPfxAtlasGrid;
    // Frame 0 is the top-left cell of a flipY texture.
    vec2 pfxOrigin = vec2(pfxColumn, uPfxAtlasGrid.y - 1.0 - pfxRow) * pfxCell;
    return pfxSampleAtlasCell(atlas, pfxOrigin, pfxCell, wrappedUv, continuousUv);
  }
#endif
`

/** Mesh-only helpers: the life clock and explicit shell coordinates. */
export const PFX_MATERIAL_MESH_CHUNK = /* glsl */ `
#ifdef PFX_MAT_MESH
  // Existing burst master cycle. One-shot shells read it as normalized life.
  uniform float uCycle;
  float pfxMeshLifeT() {
    return clamp(uCycle, 0.0, 1.0);
  }
  // Explicit local coordinates for a shell without texture UV: longitude and
  // colatitude of the local position, each in 0..1.
  vec2 pfxShellLocalUv(vec3 localPosition) {
    vec3 pfxDirection = normalize(localPosition);
    return vec2(
      atan(pfxDirection.z, pfxDirection.x) * 0.15915494 + 0.5,
      acos(clamp(pfxDirection.y, -1.0, 1.0)) * 0.31830989
    );
  }
#endif
#ifdef PFX_MAT_RIM
  // Replaces the existing term. It never adds a second rim.
  #define PFX_RIM_TERM(facing, basePower) (pow(1.0 - (facing), uPfxRimPower) * pfxLifeValue(uPfxRimStrength, pfxMeshLifeT()))
  #define PFX_RIM_HOT uPfxRimColor
#else
  #define PFX_RIM_TERM(facing, basePower) pow(1.0 - (facing), basePower)
  #define PFX_RIM_HOT uColorHot
#endif
`

/**
 * Mask and dissolve coverage. `alpha` and `color` name the caller's
 * variables. Coverage multiplies the existing alpha, so neither the dissolve
 * nor its edge can restore a texel that an earlier rule removed. The edge
 * colour mixes in only where coverage survives. `maskCoverage` reuses a mask
 * value that the caller already sampled; otherwise the mask is sampled here.
 */
export function pfxMaterialCoverageGlsl(options: {
  alpha: string
  coverageUv: string
  lifeT: string
  maskCoverage?: string
}): { coverage: string; edge: (color: string) => string } {
  const { alpha, coverageUv, lifeT, maskCoverage } = options
  const mask = maskCoverage ?? `mix(1.0, dot(texture2D(uPfxMaskMap, ${coverageUv}), uPfxMaskChannel), uPfxMaskStrength)`
  const coverage = /* glsl */ `
  #ifdef PFX_MAT_DISSOLVE
    float pfxEdge = 0.0;
  #endif
  #ifdef PFX_MAT_COVERAGE
  {
    #ifdef PFX_MAT_MASK
      ${alpha} *= ${mask};
    #endif
    #ifdef PFX_MAT_DISSOLVE
      float pfxNoise = texture2D(uPfxDissolveMap, ${coverageUv}).r;
      float pfxThreshold = pfxLifeValue(uPfxDissolveProgress, ${lifeT});
      float pfxSurvive = smoothstep(pfxThreshold - uPfxDissolveSoftness, pfxThreshold + uPfxDissolveSoftness, pfxNoise);
      float pfxEdgeStart = pfxThreshold + uPfxDissolveSoftness;
      pfxEdge = pfxSurvive
        * (1.0 - smoothstep(pfxEdgeStart, pfxEdgeStart + max(uPfxDissolveEdgeWidth, 0.0001), pfxNoise))
        * step(0.0001, uPfxDissolveEdgeWidth)
        * smoothstep(0.0, 0.02, pfxThreshold);
      ${alpha} *= pfxSurvive;
    #endif
  }
  #endif
`
  const edge = (color: string) => /* glsl */ `
  #ifdef PFX_MAT_DISSOLVE
    ${color} = mix(${color}, uPfxDissolveEdgeColor, pfxEdge);
  #endif
`
  return { coverage, edge }
}

/**
 * Sprite depth fade against a caller-owned standard depth texture. Scene and
 * particle depth are linearized with the same projection terms, which the
 * host captured with the depth (validated equal to the render camera). Fade
 * = positive depth gap / softness, clamped to 0..1. Fully occluded pixels
 * keep the existing depth test, which the material still uses. A closed gate
 * (late camera change at draw time) returns exactly 1, the hard result.
 */
export const PFX_MATERIAL_SOFT_PARTICLE_CHUNK = /* glsl */ `
#ifdef PFX_MAT_SOFT_PARTICLES
  uniform sampler2D uPfxSceneDepth;
  // projectionMatrix elements [10], [14], [11], [15]: perspective or orthographic.
  uniform vec4 uPfxDepthProjection;
  uniform vec2 uPfxDepthBufferSize;
  uniform float uPfxDepthFadeGate;
  uniform float uPfxSoftDistance;
  // Positive view distance of a standard [0, 1] window depth.
  float pfxViewDistance(float windowDepth) {
    float pfxNdc = windowDepth * 2.0 - 1.0;
    return -(uPfxDepthProjection.y - pfxNdc * uPfxDepthProjection.w)
      / (pfxNdc * uPfxDepthProjection.z - uPfxDepthProjection.x);
  }
  float pfxSoftParticleFade() {
    if (uPfxDepthFadeGate < 0.5) return 1.0;
    float pfxSceneDepth = texture2D(uPfxSceneDepth, gl_FragCoord.xy / uPfxDepthBufferSize).r;
    float pfxGap = pfxViewDistance(pfxSceneDepth) - pfxViewDistance(gl_FragCoord.z);
    return clamp(pfxGap / uPfxSoftDistance, 0.0, 1.0);
  }
#endif
`
