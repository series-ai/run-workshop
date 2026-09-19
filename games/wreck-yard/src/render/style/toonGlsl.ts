export const toonGlsl = /* glsl */ `
uniform vec2 uRampEdges;
uniform vec3 uShadeTint;
uniform vec3 uLitTint;
uniform float uHalfLevel;

vec3 toonTint(float nDotL, float shadow) {
  float v = nDotL * shadow;
  vec3 halfTint = mix(uShadeTint, uLitTint, uHalfLevel);
  if (v < uRampEdges.x) {
    return uShadeTint;
  } else if (v < uRampEdges.y) {
    return halfTint;
  } else {
    return uLitTint;
  }
}
`;
