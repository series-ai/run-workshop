/** Shared local-light range and world-space detail. Distances are in metres. */
export const SKYRIVER_LOCAL_LIGHT_RANGE = Object.freeze({ fadeStartM: 100, radiusM: 200 });

export const SKYRIVER_STRUCTURED_LIGHT_GLSL = /* glsl */ `
float localLightRange( float distanceM ) {
  return 1.0 - smoothstep( ${SKYRIVER_LOCAL_LIGHT_RANGE.fadeStartM.toFixed(1)}, ${SKYRIVER_LOCAL_LIGHT_RANGE.radiusM.toFixed(1)}, distanceM );
}
float localAreaLight( float areaM2, float distanceM ) {
  float area = max( areaM2, 0.0 );
  return area / max( area + 12.566370614359172 * distanceM * distanceM, 1e-6 ) * localLightRange( distanceM );
}
float lightHash( vec3 p ) {
  p = fract( p * vec3( 0.1031, 0.1030, 0.0973 ) );
  p += dot( p, p.yxz + 33.33 );
  return fract( ( p.x + p.y ) * p.z );
}
float lightNoise( vec3 p ) {
  vec3 i = floor( p );
  vec3 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( lightHash( i ), lightHash( i + vec3(1,0,0) ), f.x ),
                   mix( lightHash( i + vec3(0,1,0) ), lightHash( i + vec3(1,1,0) ), f.x ), f.y ),
              mix( mix( lightHash( i + vec3(0,0,1) ), lightHash( i + vec3(1,0,1) ), f.x ),
                   mix( lightHash( i + vec3(0,1,1) ), lightHash( i + vec3(1,1,1) ), f.x ), f.y ), f.z );
}
float lightBreakup( vec3 world, float seed ) {
  vec3 offset = vec3( seed * 17.1, seed * 9.7, seed * 23.3 );
  float field = lightNoise( world / 12.0 + offset ) * 0.7
              + lightNoise( world / 3.0 + offset ) * 0.3;
  return 0.65 + 0.7 * field;
}
float wetMicrodetail( vec3 world, float seed ) {
  vec3 p = world * vec3( 2.0, 0.35, 2.0 ) + seed * 19.3;
  return 0.55 + 0.9 * lightNoise( p );
}
`;
