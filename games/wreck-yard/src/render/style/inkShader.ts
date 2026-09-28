import * as THREE from 'three';
import { ART_STYLE } from './artStyle';

export const InkShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.DepthTexture | null },
    tBloom: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uInkColor: { value: new THREE.Color(ART_STYLE.ink.color) },
    uInkWidth: { value: ART_STYLE.ink.widthPxAt1080 },
    uDepthThreshold: { value: ART_STYLE.ink.depthThreshold },
    uNormalThreshold: { value: ART_STYLE.ink.normalThreshold },
    uInkOpacity: { value: ART_STYLE.ink.opacity },
    uCreaseFade: { value: new THREE.Vector2(ART_STYLE.ink.creaseFade[0], ART_STYLE.ink.creaseFade[1]) },
    uSilhouetteFade: { value: new THREE.Vector2(ART_STYLE.ink.silhouetteFade[0], ART_STYLE.ink.silhouetteFade[1]) },
    uEmissiveLumaCutoff: { value: ART_STYLE.ink.emissiveLumaCutoff },
    uInverseProjection: { value: new THREE.Matrix4() },
    uCameraNear: { value: 0.1 },
    uCameraFar: { value: 100.0 },
    uCavityStrength: { value: ART_STYLE.cavity.strength },
    uCavityBias: { value: ART_STYLE.cavity.bias },
    uCavityWidth: { value: ART_STYLE.cavity.width },
    uCavityMaxDist: { value: ART_STYLE.cavity.maxNeighborDistance },
    uCavityFade: { value: new THREE.Vector2(ART_STYLE.cavity.fade[0], ART_STYLE.cavity.fade[1]) },
    uEnableInk: { value: 0.0 }, // 0.0 for pass-through, 1.0 for ink & cavity
    uEnableBloom: { value: 1.0 },
    uBloomGain: { value: ART_STYLE.post.bloom.gainLow },
    uBloomTexel: { value: new THREE.Vector2(1, 1) },
    tAO: { value: null as THREE.Texture | null },
    uAOTexel: { value: new THREE.Vector2(1, 1) },
    uAOStrength: { value: 0 },
    uContrast: { value: ART_STYLE.post.grade.contrast },
    uSaturation: { value: ART_STYLE.post.grade.saturation },
    uShadowTint: { value: new THREE.Vector3(...ART_STYLE.post.grade.shadowTint) },
    uHighlightTint: { value: new THREE.Vector3(...ART_STYLE.post.grade.highlightTint) },
    uVignette: { value: ART_STYLE.post.grade.vignette },
    uGrime: { value: 0 },
    uCameraWorld: { value: new THREE.Matrix4() },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec2 vUv;

    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform sampler2D tBloom;
    uniform vec2 uResolution;
    uniform vec3 uInkColor;
    uniform float uInkWidth;
    uniform float uDepthThreshold;
    uniform float uNormalThreshold;
    uniform float uInkOpacity;
    uniform vec2 uCreaseFade;
    uniform vec2 uSilhouetteFade;
    uniform float uEmissiveLumaCutoff;
    uniform mat4 uInverseProjection;
    uniform float uCameraNear;
    uniform float uCameraFar;
    uniform float uCavityStrength;
    uniform float uCavityBias;
    uniform float uCavityWidth;
    uniform float uCavityMaxDist;
    uniform vec2 uCavityFade;
    uniform float uEnableInk;
    uniform float uEnableBloom;
    uniform float uBloomGain;
    uniform vec2 uBloomTexel;
    uniform sampler2D tAO;
    uniform vec2 uAOTexel;
    uniform float uAOStrength;
    uniform float uContrast;
    uniform float uSaturation;
    uniform vec3 uShadowTint;
    uniform vec3 uHighlightTint;
    uniform float uVignette;
    uniform float uGrime;
    uniform mat4 uCameraWorld;

    float hash2(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float valueNoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    // Large stains plus fine wear, projected along the dominant world axis.
    float grimeAt(vec3 p, vec3 n) {
      vec3 a = abs(n);
      vec2 uv = a.y > max(a.x, a.z) ? p.xz : (a.x > a.z ? p.zy : p.xy);
      return valueNoise(uv * 0.35) * 0.6 + valueNoise(uv * 1.7) * 0.3 + valueNoise(uv * 7.0) * 0.1;
    }

    // IEC 61966-2-1 standard sRGB transfer function
    vec3 linearToSRGB(vec3 c) {
      return mix(
        12.92 * c,
        1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
        step(vec3(0.0031308), c)
      );
    }

    float linearizeDepth(float d) {
      float z_ndc = d * 2.0 - 1.0;
      return (2.0 * uCameraNear * uCameraFar) / (uCameraFar + uCameraNear - z_ndc * (uCameraFar - uCameraNear));
    }

    // Mathematically exact view-position reconstruction without extra homogeneous divide
    vec3 reconstructViewPos(vec2 uv, float linearZ) {
      vec4 h = uInverseProjection * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
      return h.xyz * (linearZ / -h.z);
    }

    // PairBend screen-space cavity detection reusing cardinal depth samples
    float pairBend(vec3 normal, vec3 a, vec3 b, float maxDist) {
      float distanceSquared = max(dot(a, a), dot(b, b));
      float limitSquared = maxDist * maxDist;
      float support = 1.0 - smoothstep(limitSquared * 0.31, limitSquared, distanceSquared);
      return max(dot(normal, a + b), 0.0) * support;
    }

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      vec3 color = base.rgb;

      // Ambient occlusion (high tier). Four bilinear taps blur the half-res noise.
      if (uAOStrength > 0.0) {
        float ao = 0.25 * (
          texture2D(tAO, vUv + vec2(-1.0, -1.0) * uAOTexel).r +
          texture2D(tAO, vUv + vec2(1.0, -1.0) * uAOTexel).r +
          texture2D(tAO, vUv + vec2(-1.0, 1.0) * uAOTexel).r +
          texture2D(tAO, vUv + vec2(1.0, 1.0) * uAOTexel).r);
        float luma0 = dot(color, vec3(0.299, 0.587, 0.114));
        color *= mix(1.0, ao, uAOStrength * (1.0 - step(uEmissiveLumaCutoff, luma0)));
      }

      if (uEnableInk > 0.5) {
        float dCenterRaw = texture2D(tDepth, vUv).r;

        // Skip sky (depth near 1.0)
        if (dCenterRaw < 0.9999) {
          float dCenter = linearizeDepth(dCenterRaw);
          vec2 texel = (uInkWidth * (uResolution.y / 1080.0)) / uResolution;

          // 4-point cardinal neighbor sampling for silhouettes & cavity
          vec2 offsets[4];
          offsets[0] = vec2(texel.x, 0.0);
          offsets[1] = vec2(-texel.x, 0.0);
          offsets[2] = vec2(0.0, texel.y);
          offsets[3] = vec2(0.0, -texel.y);

          float maxDepthDiff = 0.0;
          float d[4];
          for (int i = 0; i < 4; i++) {
            float dRaw = texture2D(tDepth, vUv + offsets[i]).r;
            d[i] = linearizeDepth(dRaw);
            maxDepthDiff = max(maxDepthDiff, abs(d[i] - dCenter));
          }

          // Relative depth edge calculation
          float relativeDepthEdge = maxDepthDiff / max(dCenter, 0.01);

          // Reconstruct view positions of center and 4 cardinal neighbors
          vec3 pC = reconstructViewPos(vUv, dCenter);
          vec3 pR = reconstructViewPos(vUv + offsets[0], d[0]);
          vec3 pL = reconstructViewPos(vUv + offsets[1], d[1]);
          vec3 pU = reconstructViewPos(vUv + offsets[2], d[2]);
          vec3 pD = reconstructViewPos(vUv + offsets[3], d[3]);

          // Pick the smaller depth difference on each axis to avoid straddling depth discontinuities
          vec3 dx = abs(d[0] - dCenter) < abs(d[1] - dCenter) ? (pR - pC) : (pC - pL);
          vec3 dy = abs(d[2] - dCenter) < abs(d[3] - dCenter) ? (pU - pC) : (pC - pD);
          vec3 n = cross(dx, dy);
          float nLen = length(n);
          vec3 normal = nLen > 1e-6 ? (n / nLen) : vec3(0.0, 0.0, 1.0);

          // Compensate for steep grazing angles (e.g. flat ground plane)
          vec3 viewDir = normalize(-pC);
          float grazing = clamp(1.0 - abs(dot(normal, viewDir)), 0.0, 1.0);
          float depthThresh = uDepthThreshold * (1.0 + grazing * 4.5);

          float depthEdge = step(depthThresh, relativeDepthEdge);

          // Silhouette fade over distance (silhouetteFade[1] < nearest skyline distance)
          float silFade = 1.0 - smoothstep(uSilhouetteFade.x, uSilhouetteFade.y, dCenter);
          depthEdge *= silFade;

          // Screen-space cavity darkening
          float cavityX = pairBend(normal, pR - pC, pL - pC, uCavityMaxDist);
          float cavityY = pairBend(normal, pU - pC, pD - pC, uCavityMaxDist);
          float cavityRaw = max(0.0, (cavityX + cavityY) - uCavityBias) / max(uCavityWidth, 0.0001);
          float cavity = clamp(cavityRaw * uCavityStrength, 0.0, uCavityStrength);
          float cavityFade = 1.0 - smoothstep(uCavityFade.x, uCavityFade.y, dCenter);
          cavity *= cavityFade;

          // Emissive suppression (protect torch tip, molten seam, and sparks)
          float luma = dot(color, vec3(0.299, 0.587, 0.114));
          float emissiveMask = 1.0 - step(uEmissiveLumaCutoff, luma);

          // Apply cavity darkening to shaded diffuse
          color *= (1.0 - cavity * emissiveMask);

          // World-space grime (high tier): stains and wear break up flat surfaces.
          if (uGrime > 0.0) {
            vec3 worldPos = (uCameraWorld * vec4(pC, 1.0)).xyz;
            vec3 worldNormal = normalize(mat3(uCameraWorld) * normal);
            float grime = grimeAt(worldPos, worldNormal);
            float grimeFade = (1.0 - smoothstep(25.0, 70.0, dCenter)) * emissiveMask;
            color *= 1.0 + (grime - 0.5) * 2.0 * uGrime * grimeFade;
            // Dark surfaces barely change under a multiplier. Upward faces also
            // get dusty scuffs (lift) and oil stains (darken) in absolute terms.
            float up = smoothstep(0.6, 0.9, worldNormal.y) * grimeFade;
            float stain = valueNoise(worldPos.xz * 0.18 + 17.0);
            // Hard-edged bands, like painted shapes, to match the cel shading.
            float dust = smoothstep(0.58, 0.61, grime) * 0.6 + smoothstep(0.7, 0.73, grime) * 0.4;
            color += vec3(0.055, 0.047, 0.038) * dust * up * uGrime * 3.0;
            color *= 1.0 - smoothstep(0.68, 0.71, stain) * 0.4 * up;
          }

          // Crease lines: the surface bends where the one-sided slopes on an axis
          // disagree. Reuses the four neighbor positions; no extra texture reads.
          float creaseX = 1.0 - dot(normalize(pR - pC), normalize(pC - pL));
          float creaseY = 1.0 - dot(normalize(pU - pC), normalize(pC - pD));
          float creaseEdge = step(uNormalThreshold, max(creaseX, creaseY));
          creaseEdge *= 1.0 - smoothstep(uCreaseFade.x, uCreaseFade.y, dCenter);

          float edge = max(depthEdge, creaseEdge) * uInkOpacity * emissiveMask;
          color = mix(color, uInkColor, edge);
        }
      }

      // Composite 1/4-resolution bloom with 4 diagonal taps
      if (uEnableBloom > 0.5) {
        vec2 bloomTexel = uBloomTexel;
        vec2 b0 = vec2(-1.0, -1.0) * bloomTexel;
        vec2 b1 = vec2( 1.0, -1.0) * bloomTexel;
        vec2 b2 = vec2(-1.0,  1.0) * bloomTexel;
        vec2 b3 = vec2( 1.0,  1.0) * bloomTexel;

        vec3 bloomSample = (
          texture2D(tBloom, vUv).rgb * 0.4 +
          (texture2D(tBloom, vUv + b0).rgb +
           texture2D(tBloom, vUv + b1).rgb +
           texture2D(tBloom, vUv + b2).rgb +
           texture2D(tBloom, vUv + b3).rgb) * 0.15
        );
        color += bloomSample * uBloomGain;
      }

      // The palette is authored for untonemapped output: clamp, then encode sRGB.
      vec3 display = linearToSRGB(clamp(color, 0.0, 1.0));

      // Display-space grade: saturation, contrast about mid grey, split toning, vignette.
      float luma = dot(display, vec3(0.2126, 0.7152, 0.0722));
      display = mix(vec3(luma), display, uSaturation);
      display = (display - 0.5) * uContrast + 0.5;
      display *= mix(uShadowTint, uHighlightTint, smoothstep(0.12, 0.7, luma));
      vec2 centered = vUv - 0.5;
      display *= 1.0 - uVignette * smoothstep(0.2, 0.75, dot(centered, centered) * 2.0);
      gl_FragColor = vec4(clamp(display, 0.0, 1.0), base.a);
    }
  `,
};
