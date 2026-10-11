import { DataTexture, FloatType, NearestFilter, RGBAFormat, type ShaderMaterial } from 'three';

// Keep the source buffers and base shader contract. Apply design at compile time.
function replace(source: string, before: string, after: string): string {
  if (!source.includes(before)) throw new Error('SIGN_DESIGN_SHADER_CONTRACT');
  return source.replace(before, after);
}

function designVertex(source: string): string {
  source = replace(source, `  vMargin = margin;
  vAtlas = aAtlas;
  vDistrictTint = aDistrictTint;
`, `  vMargin = margin;
  vAtlas = aDesignAtlas;
  vDesign = aDesign;
  vDistrictTint = aDistrictTint;
`);
  source = replace(source, `  vSignNormal = normalW;
  vSignSize = aSize;
  vMargin = margin;
`, `  vSignNormal = normalW;
  vSignSize = size;
  vMargin = margin;
`);
  source = replace(source, `  vLocal = local;
  vSignUv = local / aSize + 0.5;
  vSignColor = aColor;
`, `  vLocal = local;
  vSignUv = local / size + 0.5;
  vSignColor = aColor;
`);
  source = replace(source, `  vec2 local = position.xy * extent;
  vec3 world = aCentre + tangent * local.x + up * local.y;

`, `  vec2 local = position.xy * extent;
  // Both folds stay inside the certified 0.4 metre board thickness.
  float fold = 0.0;
  if ( aDesign.y > 3.5 && aDesign.y < 4.5 ) {
    fold = 0.18 * ( 1.0 - cos( clamp( local.x / ( size.x * 0.5 ), -1.0, 1.0 ) * 1.5707963 ) );
  } else if ( aDesign.y > 1.5 && aDesign.y < 2.5 ) {
    fold = clamp( local.x - size.x * 0.2, 0.0, 0.18 );
  }
  vec3 world = centre + tangent * local.x + up * local.y + normalW * fold;

`);
  source = replace(source, `  // concrete and the haze around it — the scene is lit by its signage, not just decorated with it.
  float margin = clamp( 0.6 * min( aSize.x, aSize.y ), 3.0, 36.0 );
  vec2 extent = aSize + 2.0 * margin;
  vec2 local = position.xy * extent;
`, `  // concrete and the haze around it — the scene is lit by its signage, not just decorated with it.
  vec2 size = aSize;
  if ( aDesign.x > 4.5 ) size.y = min( size.y, size.x * 0.25 );
  else if ( aDesign.x > 2.5 && aDesign.x < 3.5 ) size.y = min( size.y, size.x );
  else if ( aDesign.x > 3.5 && aDesign.x < 4.5 ) size.y = min( size.y, size.x * 1.6 );
  vec3 centre = aCentre + vec3( 0.0, ( size.y - aSize.y ) * 0.5, 0.0 );
  float margin = clamp( 0.6 * min( size.x, size.y ), 3.0, 36.0 );
  vec2 extent = size + 2.0 * margin;
  vec2 local = position.xy * extent;
`);
  source = replace(source, `varying vec2 vSignUv;     // 0..1 across the sign face; outside that range is the halo
varying vec4 vAtlas;
`, `varying vec2 vSignUv;     // 0..1 across the sign face; outside that range is the halo
varying vec2 vDesign;
varying vec4 vAtlas;
`);
  source = replace(source, `attribute float aSeed;
attribute vec4 aAtlas;    // T7: lettered atlas cell (u0, v0, u1, v1); u1 <= u0 means procedural
`, `attribute float aSeed;
uniform sampler2D uSignDesign;
uniform float uSignDesignWidth;
attribute vec4 aAtlas;    // T7: lettered atlas cell (u0, v0, u1, v1); u1 <= u0 means procedural
`);
  source = replace(source, `void main() {`, `void main() {
  float column = float( gl_InstanceID ) * 2.0;
  vec2 aDesign = texture2D( uSignDesign, vec2( ( column + 0.5 ) / uSignDesignWidth, 0.5 ) ).xy;
  vec4 aDesignAtlas = texture2D( uSignDesign, vec2( ( column + 1.5 ) / uSignDesignWidth, 0.5 ) );`);
  return source;
}

function designFragment(source: string): string {
  source = replace(source, `  color = skyriverDistrictEmission( color, vDistrictTint.rgb, vDistrictTint.w );
  gl_FragColor = vec4( color * flicker, 1.0 );

`, `  color = skyriverDistrictEmission( color, vDistrictTint.rgb, vDistrictTint.w );
  if ( ( vDesign.x > 0.5 && vDesign.x < 1.5 ) || ( vDesign.x > 3.5 && vDesign.x < 4.5 ) ) {
    vec3 accentColor = skyriverDistrictEmission( color, vDistrictTint.rgb.gbr, vDistrictTint.w );
    color = mix( color, accentColor, accent * 0.48 );
  }
  gl_FragColor = vec4( color * flicker, 1.0 );

`);
  source = replace(source, `    * ( 1.0 + 1.25 * ( lightBreakup( vWorldPos, vSignSeed ) - 1.0 ) );
  float plate = inside * 0.03;

`, `    * ( 1.0 + 1.25 * ( lightBreakup( vWorldPos, vSignSeed ) - 1.0 ) );
  // Tube art has no filled board. Other species use the cut silhouette.
  float tube = step( 1.5, vDesign.x ) * ( 1.0 - step( 2.5, vDesign.x ) );
  mask *= mix( board, 1.0, tube );
  float plate = inside * board * 0.03 * ( 1.0 - tube );
  halo *= mix( 1.0, 0.42, tube );

`);
  source = replace(source, `    if ( !gl_FrontFacing ) cell.x = 1.0 - cell.x;
    mask = texture2D( uAtlas, mix( vAtlas.xy, vAtlas.zw, cell ) ).r * inside;
  }
`, `    if ( !gl_FrontFacing ) cell.x = 1.0 - cell.x;
    vec3 ink = texture2D( uAtlas, mix( vAtlas.xy, vAtlas.zw, cell ) ).rgb;
    mask = ink.r * inside;
    accent = clamp( ( ink.g - ink.r ) * 3.0, 0.0, 1.0 );
  }
`);
  source = replace(source, `    vec2 cell = clamp( uv, 0.0, 1.0 );
    if ( !gl_FrontFacing ) cell.x = 1.0 - cell.x;
`, `    vec2 cell = clamp( uv, 0.0, 1.0 );
    if ( vDesign.x > 2.5 && vDesign.x < 3.5 ) {
      float columns = emblemColumns();
      float localX = ( fract( uv.x * columns ) - 0.5 ) * vSignSize.x / ( vSignSize.y * columns );
      float horizontal = step( vAtlas.w - vAtlas.y, vAtlas.z - vAtlas.x );
      float icon = mod( floor( uv.x * columns ) + floor( vSignSeed * 11.0 ), 2.0 );
      cell.x = mix( 0.5 + localX, 0.25 + icon * 0.5 + localX * 0.25, horizontal );
    }
    if ( !gl_FrontFacing ) cell.x = 1.0 - cell.x;
`);
  source = replace(source, `
  float mask;
`, `
  float board = signBoard( uv, feather );
  float accent = 0.0;
  float mask;
`);
  source = replace(source, `
void main() {
`, `
float emblemColumns() {
  float horizontal = step( vAtlas.w - vAtlas.y, vAtlas.z - vAtlas.x );
  return mix( 1.0, clamp( floor( vSignSize.x / vSignSize.y / 1.3 ), 1.0, 4.0 ), horizontal );
}

float signBoard( vec2 uv, float feather ) {
  vec2 p = uv - 0.5;
  float board = 1.0;
  if ( vDesign.y < 0.5 ) {
    board = 1.0 - smoothstep( 0.40 - feather, 0.40 + feather, abs( p.x - p.y * 0.16 ) );
  } else if ( vDesign.y < 1.5 ) {
    float row = floor( uv.y * 3.0 );
    float width = mix( 0.47, 0.34, mod( row, 2.0 ) );
    board = ( 1.0 - smoothstep( width - feather, width + feather, abs( p.x ) ) )
      * ( 1.0 - smoothstep( 0.88 - feather, 0.88 + feather, fract( uv.y * 3.0 ) ) );
  } else if ( vDesign.y < 2.5 ) {
    board = max( 1.0 - smoothstep( 0.34, 0.36, uv.x ), 1.0 - smoothstep( 0.22, 0.24, uv.y ) );
  } else if ( vDesign.y < 3.5 ) {
    float columns = emblemColumns();
    vec2 tile = vec2( fract( uv.x * columns ) - 0.5, p.y );
    tile.x *= vSignSize.x / ( vSignSize.y * columns );
    board = 1.0 - smoothstep( 0.47 - feather, 0.47 + feather, length( tile ) );
  } else if ( vDesign.y < 4.5 ) {
    board = 1.0 - smoothstep( 0.49 - feather, 0.49 + feather, abs( p.y ) + p.x * p.x * 0.15 );
  } else if ( vDesign.y < 5.5 ) {
    board = 1.0 - smoothstep( 0.50 - feather, 0.50 + feather, uv.x + abs( p.y ) * 0.25 - 0.5 );
  }
  // A narrow foot keeps each shaped board on its assigned ledge edge.
  return max( board, 1.0 - smoothstep( 0.015, 0.025, uv.y ) );
}

void main() {
`);
  source = replace(source, `varying float vMargin;
varying vec4 vAtlas;
`, `varying float vMargin;
varying vec2 vDesign;
varying vec4 vAtlas;
`);
  return source;
}

export function applySignDesignMaterial(material: ShaderMaterial, data: Float32Array<ArrayBuffer>): void {
  if (data.length < 8 || data.length % 8 !== 0) throw new Error('SIGN_DESIGN_DATA_SIZE');
  const width = data.length / 4;
  const texture = new DataTexture(data, width, 1, RGBAFormat, FloatType);
  texture.name = 'skyriver.signDesign';
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.needsUpdate = true;
  material.uniforms.uSignDesign = { value: texture };
  material.uniforms.uSignDesignWidth = { value: width };
  material.addEventListener('dispose', () => texture.dispose());
  material.onBeforeCompile = shader => {
    shader.vertexShader = designVertex(shader.vertexShader);
    shader.fragmentShader = designFragment(shader.fragmentShader);
  };
  material.customProgramCacheKey = () => 'skyriver-sign-design-v1';
}
