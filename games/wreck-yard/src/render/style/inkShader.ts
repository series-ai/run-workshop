import * as THREE from 'three';
import { ART_STYLE } from './artStyle';

export const InkShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.DepthTexture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uInkColor: { value: new THREE.Color(ART_STYLE.ink.color) },
    uInkWidth: { value: ART_STYLE.ink.widthPxAt1080 },
    uDepthThreshold: { value: ART_STYLE.ink.depthThreshold },
    uNormalThreshold: { value: ART_STYLE.ink.normalThreshold },
    uCreaseFade: { value: new THREE.Vector2(ART_STYLE.ink.creaseFade[0], ART_STYLE.ink.creaseFade[1]) },
    uSilhouetteFade: { value: new THREE.Vector2(ART_STYLE.ink.silhouetteFade[0], ART_STYLE.ink.silhouetteFade[1]) },
    uEmissiveLumaCutoff: { value: ART_STYLE.ink.emissiveLumaCutoff },
    uInverseProjection: { value: new THREE.Matrix4() },
    uCameraNear: { value: 0.1 },
    uCameraFar: { value: 100.0 },
    uEnableInk: { value: 0.0 }, // 0.0 for T2 (pass-through), 1.0 for T4 (ink lines)
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
    uniform vec2 uResolution;
    uniform vec3 uInkColor;
    uniform float uInkWidth;
    uniform float uDepthThreshold;
    uniform float uNormalThreshold;
    uniform vec2 uCreaseFade;
    uniform vec2 uSilhouetteFade;
    uniform float uEmissiveLumaCutoff;
    uniform mat4 uInverseProjection;
    uniform float uCameraNear;
    uniform float uCameraFar;
    uniform float uEnableInk;

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

    vec3 reconstructViewPos(vec2 uv, float linearZ) {
      vec4 clip = vec4(uv * 2.0 - 1.0, 1.0, 1.0);
      vec4 viewRay = uInverseProjection * clip;
      return (viewRay.xyz / viewRay.w) * (linearZ / -viewRay.z);
    }

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      vec3 color = base.rgb;

      if (uEnableInk > 0.5) {
        float dCenterRaw = texture2D(tDepth, vUv).r;

        // Skip sky (depth near 1.0)
        if (dCenterRaw < 0.9999) {
          float dCenter = linearizeDepth(dCenterRaw);
          vec2 texel = (uInkWidth * (uResolution.y / 1080.0)) / uResolution;

          // 4-point cardinal neighbor sampling for depth and normal discontinuities
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
          vec3 normal = normalize(cross(dx, dy));

          // Compensate for steep grazing angles (e.g. flat ground plane)
          vec3 viewDir = normalize(-pC);
          float grazing = clamp(1.0 - abs(dot(normal, viewDir)), 0.0, 1.0);
          float depthThresh = uDepthThreshold * (1.0 + grazing * 4.5);

          float depthEdge = step(depthThresh, relativeDepthEdge);

          // Silhouette fade over distance (silhouetteFade[1] < nearest skyline distance)
          float silFade = 1.0 - smoothstep(uSilhouetteFade.x, uSilhouetteFade.y, dCenter);
          depthEdge *= silFade;

          // Normal crease edge detection across neighbors
          vec3 nR = normalize(cross(pR - pC, dy));
          vec3 nU = normalize(cross(dx, pU - pC));
          float minDot = min(dot(normal, nR), dot(normal, nU));
          float creaseFade = 1.0 - smoothstep(uCreaseFade.x, uCreaseFade.y, dCenter);
          float creaseEdge = step(uNormalThreshold, 1.0 - minDot) * creaseFade;

          // Emissive suppression (protect torch tip, molten seam, and sparks)
          float luma = dot(color, vec3(0.299, 0.587, 0.114));
          float emissiveMask = 1.0 - step(uEmissiveLumaCutoff, luma);

          float edge = max(depthEdge, creaseEdge) * emissiveMask;
          color = mix(color, uInkColor, edge);
        }
      }

      // Final output: convert linear color into display sRGB
      gl_FragColor = vec4(linearToSRGB(color), base.a);
    }
  `,
};
