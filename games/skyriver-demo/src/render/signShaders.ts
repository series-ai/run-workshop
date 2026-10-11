/**
 * @file signShaders.ts - Sign design and media layer shader customization.
 *
 * This file modifies the base sign shaders to render shaped boards,
 * media animations, screen displays, and floating holograms.
 */

import { CustomBlending, DataTexture, FloatType, NearestFilter, OneFactor, OneMinusSrcAlphaFactor, RGBAFormat, type ShaderMaterial } from 'three';
import { createSignMediaAtlas, deriveMediaMotion, type SignMediaAtlas } from './signMedia';

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
  vDesignMedia = aDesignMedia;
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
  float holoDrift = 0.0;
  if ( aDesignMedia.x > 19.5 ) {
    holoDrift = sin( uTime * 0.2 + aDesignMedia.y * 6.2831853 ) * 3.5;
  }
  vec3 world = centre + tangent * local.x + up * ( local.y + holoDrift ) + normalW * fold;

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
  float margin = aDesignMedia.x > 19.5 ? 0.0 : clamp( 0.6 * min( size.x, size.y ), 3.0, 36.0 );
  vec2 extent = size + 2.0 * margin;
  vec2 local = position.xy * extent;
`);
  source = replace(source, `varying vec2 vSignUv;     // 0..1 across the sign face; outside that range is the halo
varying vec4 vAtlas;
`, `varying vec2 vSignUv;     // 0..1 across the sign face; outside that range is the halo
varying vec2 vDesign;
varying vec2 vDesignMedia;
varying vec4 vAtlas;
`);
  source = replace(source, `attribute float aSeed;
attribute vec4 aAtlas;    // T7: lettered atlas cell (u0, v0, u1, v1); u1 <= u0 means procedural
`, `attribute float aSeed;
uniform float uTime;
uniform float uQualityTier;
uniform sampler2D uSignDesign;
uniform float uSignDesignWidth;
attribute vec4 aAtlas;    // T7: lettered atlas cell (u0, v0, u1, v1); u1 <= u0 means procedural
`);
  source = replace(source, `void main() {`, `void main() {
  float column = float( gl_InstanceID ) * 2.0;
  vec4 aDesignParam = texture2D( uSignDesign, vec2( ( column + 0.5 ) / uSignDesignWidth, 0.5 ) );
  vec2 aDesign = aDesignParam.xy;
  vec2 aDesignMedia = aDesignParam.zw;
  float holoStride = uQualityTier > 1.5 ? 1.0 : ( uQualityTier > 0.5 ? 2.0 : 4.0 );
  if ( aDesignMedia.x > 19.5 && mod( floor( aDesignMedia.x ) - 20.0, holoStride ) > 0.5 ) {
    gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
    return;
  }
  vec4 aDesignAtlas = texture2D( uSignDesign, vec2( ( column + 1.5 ) / uSignDesignWidth, 0.5 ) );`);
  return source;
}

function designFragment(source: string): string {
  source = replace(source, `  color = skyriverDistrictEmission( color, vDistrictTint.rgb, vDistrictTint.w );
  gl_FragColor = vec4( color * flicker, 1.0 );

`, `  float mediaTypeOut = floor( vDesignMedia.x / 10.0 );
  float mClassOut = mod( floor( vDesignMedia.x ), 10.0 );
  float phaseRank = fract( vDesignMedia.y );
  float animG = ( uQualityTier > 1.5 ) ? 1.0 : ( uQualityTier > 0.5 ) ? step( phaseRank, 0.50 ) : step( phaseRank, 0.25 );

  flicker = 1.0;
  // Use one continuous gain for the 28-second cycle.
  if ( mClassOut > 4.5 && mClassOut < 5.5 ) {
    float gain = 1.0 + 0.16 * animG * ( 0.5 - 0.5 * cos( uTime * 0.224399 + phaseRank * 6.2831853 ) );
    flicker = gain;
  }

  vec3 palUnitHue = deriveSignPaletteUnitHue( vSignSeed, vDesign.x, vDistrictTint.rgb );
  color = skyriverDistrictEmission( color, palUnitHue, max( vDistrictTint.w, 0.96 ) );

  if ( mediaTypeOut > 0.5 && mediaTypeOut < 1.5 ) {
    vec3 screenEmission = ( displayFaceOut * angle * uIntensity * 1.5 + vSignColor * ( plate + halo * uHalo * 0.85 ) ) * signNear * EMISSIVE_GAIN;
    color = skyriverDistrictEmission( screenEmission, palUnitHue, vDistrictTint.w * 0.40 );
  }

  if ( ( vDesign.x > 0.5 && vDesign.x < 1.5 ) || ( vDesign.x > 3.5 && vDesign.x < 4.5 ) || ( mediaTypeOut > 0.5 ) ) {
    vec3 palAccentHue = deriveSignPaletteUnitHue( vSignSeed + 0.41, vDesign.x + 1.0, vDistrictTint.rgb );
    vec3 accentColor = skyriverDistrictEmission( color, palAccentHue, vDistrictTint.w );
    color = mix( color, accentColor, accent * 0.48 );
  }

  if ( mediaTypeOut < 0.5 ) {
    float peakHue = max( palUnitHue.r, max( palUnitHue.g, palUnitHue.b ) );
    color *= mix( 1.55, 1.0, smoothstep( 1.9, 3.2, peakHue ) );
  }
  if ( mediaTypeOut > 1.5 ) {
    gl_FragColor = vec4( palUnitHue * 1.8 * mask, 0.0 );
  } else {
    float faceAlpha = mediaTypeOut > 0.5 ? inside * board * 0.96 : 0.0;
    gl_FragColor = vec4( color * flicker, faceAlpha );
  }

`);
  source = replace(source, `    * ( 1.0 + 1.25 * ( lightBreakup( vWorldPos, vSignSeed ) - 1.0 ) );
  float plate = inside * 0.03;

`, `    * ( 1.0 + 1.25 * ( lightBreakup( vWorldPos, vSignSeed ) - 1.0 ) );
  float tube = step( 1.5, vDesign.x ) * ( 1.0 - step( 2.5, vDesign.x ) );
  float mType = floor( vDesignMedia.x / 10.0 );
  float plate = inside * board * 0.03 * ( 1.0 - tube );
  if ( mType > 1.5 ) {
    halo = 0.0;
    plate = 0.0;
  } else if ( mType > 0.5 ) {
    halo *= 1.0;
    mask *= board;
    plate = inside * board * 0.04;
  } else {
    mask *= mix( board, 1.0, tube );
    halo *= mix( 1.0, 0.42, tube );
  }

`);
  source = replace(source, `    if ( !gl_FrontFacing ) cell.x = 1.0 - cell.x;
    mask = texture2D( uAtlas, mix( vAtlas.xy, vAtlas.zw, cell ) ).r * inside;
  }
`, `    if ( !gl_FrontFacing ) cell.x = 1.0 - cell.x;
    float mediaType = floor( vDesignMedia.x / 10.0 );
    float motionClass = mod( floor( vDesignMedia.x ), 10.0 );
    float frameCount = max( 1.0, floor( vDesignMedia.y / 10.0 ) );
    float phase = fract( vDesignMedia.y );
    vec3 ink = vec3( 0.0 );

    if ( mediaType < 0.5 ) {
      vec2 signCell = cell;
      float animG = ( uQualityTier > 1.5 ) ? 1.0 : ( uQualityTier > 0.5 ) ? step( phase, 0.50 ) : step( phase, 0.25 );
      if ( motionClass > 2.5 && motionClass < 3.5 ) {
        signCell.x = fract( signCell.x + ( uTime * 0.15 * animG ) + phase );
      }
      ink = texture2D( uAtlas, mix( vAtlas.xy, vAtlas.zw, signCell ) ).rgb;
      mask = ink.r * inside;
      accent = clamp( ( ink.g - ink.r ) * 3.0, 0.0, 1.0 );

      if ( motionClass > 0.5 && motionClass < 1.5 ) {
        float perim = (uv.y <= 0.06) ? uv.x : (uv.x >= 0.94) ? (1.0 + uv.y) : (uv.y >= 0.94) ? (3.0 - uv.x) : (4.0 - uv.y);
        float bDist = min( min( uv.x, 1.0 - uv.x ), min( uv.y, 1.0 - uv.y ) );
        float onB = 1.0 - smoothstep( 0.02, 0.05, bDist );
        float cPos = fract( ( uTime * 0.45 * animG ) + phase );
        float cLight = 1.0 - smoothstep( 0.0, 0.22, abs( fract( perim * 0.25 - cPos + 0.5 ) - 0.5 ) );
        mask += onB * cLight * inside * 0.85;
      } else if ( motionClass > 1.5 && motionClass < 2.5 ) {
        float tubeGroup = step( 0.5, fract( uv.y * 3.0 + uv.x * 0.5 ) );
        float tradeWave = sin( ( uTime * 3.14159265 * animG ) + phase * 6.2831853 );
        float groupA = 0.5 + 0.5 * tradeWave;
        float groupB = 1.0 - groupA;
        float tubeTrade = mix( groupA, groupB, tubeGroup );
        mask *= 0.08 + 1.84 * tubeTrade;
        accent = mix( 0.15, 0.85, tubeTrade );
      } else if ( motionClass > 3.5 && motionClass < 4.5 ) {
        float cutFrame = mod( floor( uTime * 0.5 * animG + phase * 2.0 ), 2.0 );
        if ( cutFrame > 0.5 ) {
          bool verticalCell = vAtlas.w - vAtlas.y > vAtlas.z - vAtlas.x;
          float cellIndex = verticalCell
            ? floor( vAtlas.x * 16.0 + 0.5 ) + floor( ( 1.0 - vAtlas.w ) / 0.375 + 0.5 ) * 16.0
            : floor( vAtlas.x * 4.0 + 0.5 ) + floor( ( 1.0 - vAtlas.w - 0.75 ) / 0.0625 + 0.5 ) * 4.0;
          float nextCell = cellIndex + ( cellIndex < ( verticalCell ? 23.0 : 10.0 ) ? 6.0 : -6.0 );
          vec2 start = verticalCell
            ? vec2( mod( nextCell, 16.0 ) / 16.0, 1.0 - ( floor( nextCell / 16.0 ) + 1.0 ) * 0.375 )
            : vec2( mod( nextCell, 4.0 ) / 4.0, 0.25 - ( floor( nextCell / 4.0 ) + 1.0 ) * 0.0625 );
          ink = texture2D( uAtlas, start + cell * ( vAtlas.zw - vAtlas.xy ) ).rgb;
          mask = ink.r * inside;
          accent = clamp( ( ink.g - ink.r ) * 3.0, 0.0, 1.0 );
        }
      } else if ( motionClass > 5.5 ) {
        float eqCol = floor( uv.x * 6.0 );
        float eqTick = floor( ( uTime * 5.0 * animG ) + phase * 12.0 );
        float eqLevel = ( floor( mod( eqTick * 1.3 + eqCol * 2.7, 5.0 ) ) + 1.0 ) / 5.0;
        float segGap = step( 0.18, fract( uv.y * 10.0 ) );
        float eqLit = step( uv.y, eqLevel ) * segGap;
        float eqColumn = step( 0.16, fract( uv.x * 6.0 ) ) * step( fract( uv.x * 6.0 ), 0.84 );
        mask = max( mask, eqLit * eqColumn * inside * 0.95 );
      }
    } else if ( mediaType < 1.5 ) {
      float animG = ( uQualityTier > 1.5 ) ? 1.0 : ( uQualityTier > 0.5 ) ? step( phase, 0.50 ) : step( phase, 0.25 );
      float cutSpeed = ( uQualityTier > 1.5 ) ? 0.28 : ( uQualityTier > 0.5 ) ? 0.14 : 0.07;
      float cutFrame = mod( floor( ( uTime * cutSpeed * animG ) + phase * 4.0 ), 4.0 );
      float du = vAtlas.z - vAtlas.x;
      vec2 scCell = cell;
      if ( motionClass > 2.5 && motionClass < 3.5 ) {
        scCell.x = fract( scCell.x + ( uTime * 0.15 * animG ) + phase );
      }
      vec2 adUv = mix( vAtlas.xy, vAtlas.zw, scCell );
      adUv.x += cutFrame * du;

      float fringe = 0.0028 * du;
      float inkR = texture2D( uMediaAtlas, adUv - vec2( fringe, 0.0 ) ).r;
      vec3 inkM = texture2D( uMediaAtlas, adUv ).rgb;
      float inkB = texture2D( uMediaAtlas, adUv + vec2( fringe, 0.0 ) ).b;
      ink = vec3( inkR, inkM.g, inkB );

      float scanline = 0.90 + 0.10 * sin( uv.y * 360.0 );
      float refreshBand = 1.0 + 0.18 * ( 1.0 - smoothstep( 0.0, 0.07, abs( fract( uv.y * 0.8 - ( uTime * 0.35 * animG ) + phase ) - 0.5 ) ) );

      vec2 subCoord = uv * vec2( 4.0, 2.0 );
      vec2 subFrac = fract( subCoord );
      vec2 seamDist = min( subFrac, 1.0 - subFrac );
      vec2 fwMullion = fwidth( subCoord ) * 1.5;
      vec2 mullionBar = smoothstep( vec2( 0.015 ), vec2( 0.015 ) + fwMullion, seamDist );
      float mullion = mullionBar.x * mullionBar.y;

      vec2 pixGrid = abs( sin( uv * vSignSize * 45.0 ) );
      float grid = clamp( pixGrid.x * pixGrid.y * 0.65 + 0.45, 0.0, 1.0 );
      vec3 screenFace = max( ink, vec3( 0.035, 0.05, 0.065 ) * inside );
      displayFaceOut = screenFace * scanline * refreshBand * grid * mix( 0.12, 1.0, mullion ) * inside;

      mask = clamp( max( ink.r, max( ink.g, ink.b ) ) * 0.88 + 0.12, 0.0, 1.0 ) * inside;
      accent = clamp( ( ink.g - ink.r ) * 2.5, 0.0, 1.0 );
    } else {
      #ifdef USE_FOG
        float hDist = 1.0 - smoothstep( 1100.0, 1500.0, vFogDepth );
      #else
        float hDist = 1.0;
      #endif
      float holoIdx = mod( floor( vDesignMedia.x ), 10.0 );
      float holoStride = ( uQualityTier > 1.5 ) ? 1.0 : ( uQualityTier > 0.5 ) ? 2.0 : 4.0;
      if ( mod( holoIdx, holoStride ) > 0.5 ) {
        hDist = 0.0;
      }
      vec2 hEdge = smoothstep( 0.0, 0.12, uv ) * ( vec2( 1.0 ) - smoothstep( 0.88, 1.0, uv ) );
      float hEdgeFade = hEdge.x * hEdge.y;
      float animG = ( uQualityTier > 1.5 ) ? 1.0 : ( uQualityTier > 0.5 ) ? step( phase, 0.50 ) : step( phase, 0.25 );
      float hScan = 0.84 + 0.16 * sin( uv.y * 160.0 + ( uTime * 4.0 * animG ) );
      float glitch = 1.0 + 0.15 * step( 0.96, skyHash11( floor( uTime * 8.0 * animG ) + vSignSeed * 19.0 ) );

      vec2 cUv = cell - 0.5;
      float cDist = length( cUv );
      vec2 sampleUv = cell;
      if ( cDist < 0.28 ) {
        float rot = ( uTime * 0.08 * animG ) + phase * 6.2831853;
        float cosR = cos( rot ); float sinR = sin( rot );
        sampleUv = vec2( cUv.x * cosR - cUv.y * sinR, cUv.x * sinR + cUv.y * cosR ) + 0.5;
        sampleUv = clamp( sampleUv, 0.0, 1.0 );
      }
      vec2 holoUv = mix( vAtlas.xy, vAtlas.zw, sampleUv );
      ink = texture2D( uMediaAtlas, holoUv ).rgb;

      float holoAlpha = max( ink.r, max( ink.g, ink.b ) );
      mask = clamp( holoAlpha * hEdgeFade * hScan * glitch * hDist * 0.20, 0.0, 0.20 );
      accent = clamp( ( ink.g - ink.r ) * 2.5, 0.0, 1.0 );
    }
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
  vec3 displayFaceOut = vec3( 0.0 );
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
  if ( vDesign.y > 5.5 ) return 1.0;
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

vec3 deriveSignPaletteUnitHue( float seed, float species, vec3 districtHue ) {
  float idx = mod( floor( seed * 23.0 + species * 3.0 ), 5.0 );
  vec3 palHue = vec3( 0.0399, 1.2448, 1.4020 );
  if ( idx > 0.5 && idx < 1.5 ) palHue = vec3( 1.8857, 0.8291, 0.0852 );
  else if ( idx > 1.5 && idx < 2.5 ) palHue = vec3( 3.7611, 0.1069, 1.7166 );
  else if ( idx > 2.5 && idx < 3.5 ) palHue = vec3( 0.1214, 1.3359, 0.2600 );
  else if ( idx > 3.5 ) palHue = vec3( 0.4, 0.12, 2.8 );
  palHue /= max( skyriverLinearY( palHue ), 0.00001 );
  vec3 hue = mix( palHue, districtHue, 0.08 );
  return hue / max( skyriverLinearY( hue ), 0.00001 );
}

void main() {
`);
  source = replace(source, `varying float vMargin;
varying vec4 vAtlas;
`, `varying float vMargin;
varying vec2 vDesign;
varying vec2 vDesignMedia;
varying vec4 vAtlas;
uniform sampler2D uMediaAtlas;
uniform float uQualityTier;
`);
  return source;
}

export interface ApplySignDesignMaterialFn {
  (material: ShaderMaterial, data: Float32Array<ArrayBuffer>, mediaAtlas?: SignMediaAtlas): void;
  getMediaAtlas(): SignMediaAtlas;
  deriveMediaMotion(seed: number): { motionClass: number; phase: number };
}

export const applySignDesignMaterial: ApplySignDesignMaterialFn = Object.assign(
  function applySignDesignMaterial(
    material: ShaderMaterial,
    data: Float32Array<ArrayBuffer>,
    mediaAtlas?: SignMediaAtlas,
  ): void {
    if (data.length < 8 || data.length % 8 !== 0) throw new Error('SIGN_DESIGN_DATA_SIZE');
    const width = data.length / 4;
    const texture = new DataTexture(data, width, 1, RGBAFormat, FloatType);
    texture.name = 'skyriver.signDesign';
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;
    texture.needsUpdate = true;
    material.uniforms.uSignDesign = { value: texture };
    material.uniforms.uSignDesignWidth = { value: width };

    const atlas = mediaAtlas ?? createSignMediaAtlas();
    material.uniforms.uMediaAtlas = { value: atlas.texture };
    material.uniforms.uQualityTier = { value: 2.0 };
    // Zero alpha adds light. Screen alpha blocks the facade behind the panel.
    material.blending = CustomBlending;
    material.blendSrc = OneFactor;
    material.blendDst = OneMinusSrcAlphaFactor;

    material.addEventListener('dispose', () => {
      texture.dispose();
      atlas.dispose();
    });

    const prevOnBeforeRender = material.onBeforeRender;
    material.onBeforeRender = function (renderer, scene, camera, geometry, object, group) {
      if (prevOnBeforeRender) {
        prevOnBeforeRender.call(this, renderer, scene, camera, geometry, object, group);
      }
      const tier: unknown = object.userData.mediaQualityTier;
      if (typeof tier === 'number' && Number.isFinite(tier)) {
        if (material.uniforms.uQualityTier) {
          material.uniforms.uQualityTier.value = tier;
        }
      }
    };

    material.onBeforeCompile = shader => {
      shader.vertexShader = designVertex(shader.vertexShader);
      shader.fragmentShader = designFragment(shader.fragmentShader);
    };
    material.customProgramCacheKey = () => 'skyriver-sign-design-v2';
  },
  {
    getMediaAtlas(): SignMediaAtlas {
      return createSignMediaAtlas();
    },
    deriveMediaMotion,
  },
);
