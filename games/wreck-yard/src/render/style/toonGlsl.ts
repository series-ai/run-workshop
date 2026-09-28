export const toonGlsl = /* glsl */ `
uniform vec2 uRampEdges;
uniform vec3 uShadeTint;
uniform vec3 uLitTint;
uniform float uHalfLevel;

float bayer4x4(vec2 screenPos) {
  mat4 bayer = mat4(
     0.0/16.0, 12.0/16.0,  3.0/16.0, 15.0/16.0,
     8.0/16.0,  4.0/16.0, 11.0/16.0,  7.0/16.0,
     2.0/16.0, 14.0/16.0,  1.0/16.0, 13.0/16.0,
    10.0/16.0,  6.0/16.0,  9.0/16.0,  5.0/16.0
  );
  ivec2 p = ivec2(mod(screenPos, 4.0));
  return bayer[p.x][p.y];
}

vec3 toonTint(float nDotL, float visibility) {
  float n = clamp(nDotL, 0.0, 1.0);
  float band = step(uRampEdges.x, n) * uHalfLevel
             + step(uRampEdges.y, n) * (1.0 - uHalfLevel);
  return mix(uShadeTint, uLitTint, band * clamp(visibility, 0.0, 1.0));
}

vec3 toonTintDither(float nDotL, float visibility, vec2 screenPos) {
  float n = clamp(nDotL, 0.0, 1.0);
  float dither = (bayer4x4(screenPos) - 0.5) * 0.12;
  float band = step(uRampEdges.x + dither, n) * uHalfLevel
             + step(uRampEdges.y + dither, n) * (1.0 - uHalfLevel);
  return mix(uShadeTint, uLitTint, band * clamp(visibility, 0.0, 1.0));
}

vec3 metallicRim(vec3 viewDir, vec3 normal, float metalness, vec3 sunDir) {
  float fresnel = pow(1.0 - max(0.0, dot(viewDir, normal)), 3.5);
  float rimStep = step(0.68, fresnel) * metalness;
  float sunAlign = max(0.0, dot(normal, sunDir)) * 0.4 + 0.6;
  vec3 warmTungsten = vec3(1.0, 0.88, 0.70);
  return warmTungsten * (rimStep * sunAlign * 0.35);
}

// =========================================================================
// Astra Teardown Visual Pass: Dual-Hemisphere, Specular Glint & Ground Haze
// =========================================================================

uniform vec3 uAmbientFloor;

float yardBand(float nDotL) {
  float n = clamp(nDotL, 0.0, 1.0);
  float width = 0.025;
  return smoothstep(uRampEdges.x - width, uRampEdges.x + width, n) * uHalfLevel
       + smoothstep(uRampEdges.y - width, uRampEdges.y + width, n) * (1.0 - uHalfLevel);
}

vec3 yardDiffuse(vec3 N, vec3 L, float visibility) {
  float skyWeight = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 ambient = uAmbientFloor + mix(uGroundColor, uSkyColor, skyWeight);
  return ambient + uSunColor * yardBand(dot(N, L)) * clamp(visibility, 0.0, 1.0);
}

vec3 yardMetal(vec3 N, vec3 V, vec3 L, float metalness, float visibility) {
  float grazing = 1.0 - clamp(dot(N, V), 0.0, 1.0);
  float fresnel = grazing * grazing;
  fresnel *= fresnel;

  float sun = max(dot(N, L), 0.0) * clamp(visibility, 0.0, 1.0);

  vec3 H = L + V;
  H *= inversesqrt(max(dot(H, H), 0.0001));

  float glint = smoothstep(0.90, 0.985, max(dot(N, H), 0.0));

  return metalness * (
    vec3(0.62, 0.76, 1.0) * fresnel * 0.025
    + vec3(1.0, 0.86, 0.65) * sun * (fresnel * 0.08 + glint * 0.12)
  );
}

float yardFog(vec3 P, vec3 eye, float floorY) {
  float distanceFromEye = max(length(P - eye) - 6.0, 0.0);
  float height = max(P.y - floorY, 0.0);
  float groundWeight = exp2(-height * 0.5);
  float density = 0.004 + 0.014 * groundWeight;
  return min(0.38, 1.0 - exp2(-distanceFromEye * density * 1.442695));
}

vec3 yardShoulder(vec3 color) {
  color = max(color, vec3(0.0));
  float peak = max(max(color.r, color.g), color.b);
  float excess = max(peak - 0.75, 0.0);
  float compressed = 0.75 + excess / (1.0 + 4.0 * excess);
  return color * min(1.0, compressed / max(peak, 0.00001));
}
`;
