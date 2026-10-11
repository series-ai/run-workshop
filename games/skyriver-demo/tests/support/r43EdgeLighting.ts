/** Reverse only the exact approved R43 shader delta before the old hash guard. */
const VERTEX_DELTA = [
  "  // Unit-box axial normals stay correct after scale and yaw. Normalize the result.",
  "  // Axis-aligned extents only, so normalising after the scale is enough — no inverse transpose."
] as const;
const FRAGMENT_DELTAS = [
  [
    "// R43: local edges use the rotated box frame. Noise breaks the added sky light.\nfloat facadeEdgeCatch( float grain ) {\n  vec2 edgeDistance = max( vFaceHalf - abs( vSurf ), vec2( 0.0 ) );\n  vec2 edgePixels = edgeDistance / max( fwidth( vSurf ), vec2( 1e-4 ) );\n  float sideEdge = 1.0 - smoothstep( 1.2, 2.8, edgePixels.x );\n  float topEdge = 1.0 - smoothstep( 1.2, 2.8, min( edgePixels.x, edgePixels.y ) );\n  vec3 viewDir = normalize( cameraPosition - vWorldPos );\n  float grazing = pow( 1.0 - clamp( dot( vNormalW, viewDir ), 0.0, 1.0 ), 2.0 );\n  float faceCatch = vIsSide * sideEdge * ( 0.85 + 0.15 * grazing )\n    + ( 1.0 - vIsSide ) * topEdge * max( vNormalW.y, 0.0 );\n  float brokenCatch = smoothstep( 0.38, 0.56, grain );\n  float distanceGain = smoothstep( 200.0, 500.0, vFogDepth )\n    * mix( 0.06, 0.08, smoothstep( 500.0, 3000.0, vFogDepth ) );\n  return faceCatch * brokenCatch * distanceGain;\n}\n\nvec3 familyEdgeLight( vec3 base, vec3 chroma, float catchWeight ) {\n  float baseY = dot( base, vec3( 0.2126, 0.7152, 0.0722 ) );\n  float chromaY = max( dot( chroma, vec3( 0.2126, 0.7152, 0.0722 ) ), 1e-4 );\n  // This term adds at most eight percent of the material light. It has no emission.\n  return min( vec3( 0.04 ), baseY * chroma / chromaY * catchWeight );\n}\n\nvoid main() {\n  // R15 far-city layers:",
    "void main() {\n  // R15 far-city layers:"
  ],
  [
    "    vec3 farBase = normalizeFamilyMaterial( farBase0, farBase1, farB, farW, farF, farFamily );\n    float farGrain = skyValueNoise( vSurf * 0.07 + vec2( vSeed * 137.0, vFaceId * 19.0 ) );\n    farBase += familyEdgeLight( farBase, farChroma, facadeEdgeCatch( farGrain ) );",
    "    vec3 farBase = normalizeFamilyMaterial( farBase0, farBase1, farB, farW, farF, farFamily );"
  ],
  [
    "  vec3 color = normalizeFamilyMaterial( matC0, matC1, matB, matW, matF, matFamily );\n  color += familyEdgeLight( color, matChroma, facadeEdgeCatch( grain ) );",
    "  vec3 color = normalizeFamilyMaterial( matC0, matC1, matB, matW, matF, matFamily );"
  ]
] as const;

export function withoutR43EdgeLighting(source: string, key: string): string {
  const deltas = key === 'towerVertex' ? [VERTEX_DELTA]
    : key === 'towerFragment' ? FRAGMENT_DELTAS : [];
  for (const [approved] of deltas) {
    if (source.split(approved).length !== 2) {
      throw new Error(`R43_EDGE_LIGHTING_DELTA_CHANGED:${key}`);
    }
  }
  for (const [approved, original] of deltas) source = source.replace(approved, original);
  return source;
}
