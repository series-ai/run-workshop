import * as THREE from 'three';

const FULLSCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/**
 * Half-resolution ambient occlusion (Alchemy-style) from the depth buffer.
 * Darkens contact areas and creases so props sit on the ground.
 */
export const AmbientOcclusionShader = {
  uniforms: {
    tDepth: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uInverseProjection: { value: new THREE.Matrix4() },
    /** Pixels per view-space meter at distance 1: projectionMatrix[1][1] * 0.5 * height. */
    uProjScale: { value: 1 },
    uCameraNear: { value: 0.1 },
    uCameraFar: { value: 100 },
    uRadius: { value: 0.9 },
    uIntensity: { value: 1.0 },
    uBias: { value: 0.012 },
    uFade: { value: new THREE.Vector2(30, 60) },
  },
  vertexShader: FULLSCREEN_VERTEX,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tDepth;
    uniform vec2 uResolution;
    uniform mat4 uInverseProjection;
    uniform float uProjScale;
    uniform float uCameraNear;
    uniform float uCameraFar;
    uniform float uRadius;
    uniform float uIntensity;
    uniform float uBias;
    uniform vec2 uFade;

    const int SAMPLES = 12;

    float linearizeDepth(float d) {
      float z = d * 2.0 - 1.0;
      return (2.0 * uCameraNear * uCameraFar) / (uCameraFar + uCameraNear - z * (uCameraFar - uCameraNear));
    }

    vec3 viewPos(vec2 uv) {
      float z = linearizeDepth(texture2D(tDepth, uv).r);
      vec4 h = uInverseProjection * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
      return h.xyz * (z / -h.z);
    }

    void main() {
      if (texture2D(tDepth, vUv).r >= 0.9999) {
        gl_FragColor = vec4(1.0);
        return;
      }
      vec2 texel = 1.0 / uResolution;
      vec3 p = viewPos(vUv);
      vec3 pr = viewPos(vUv + vec2(texel.x, 0.0));
      vec3 pl = viewPos(vUv - vec2(texel.x, 0.0));
      vec3 pu = viewPos(vUv + vec2(0.0, texel.y));
      vec3 pd = viewPos(vUv - vec2(0.0, texel.y));
      vec3 dx = length(pr - p) < length(p - pl) ? pr - p : p - pl;
      vec3 dy = length(pu - p) < length(p - pd) ? pu - p : p - pd;
      vec3 n = normalize(cross(dx, dy));

      float screenRadius = min(uRadius * uProjScale / max(-p.z, 0.1), 64.0);
      // Interleaved gradient noise rotates the sample spiral per pixel.
      float angle = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      float occlusion = 0.0;
      float radius2 = uRadius * uRadius;
      for (int i = 0; i < SAMPLES; i++) {
        float t = (float(i) + 0.5) / float(SAMPLES);
        float a = angle + float(i) * 2.3999632;
        vec2 offset = vec2(cos(a), sin(a)) * screenRadius * t * texel;
        vec3 v = viewPos(vUv + offset) - p;
        float vv = dot(v, v);
        float falloff = max(0.0, 1.0 - vv / radius2);
        occlusion += max(0.0, dot(n, v) - uBias * -p.z) / (vv + 0.01) * falloff;
      }
      float ao = max(0.0, 1.0 - uIntensity * occlusion * (2.0 / float(SAMPLES)));
      ao = mix(ao, 1.0, smoothstep(uFade.x, uFade.y, -p.z));
      gl_FragColor = vec4(vec3(ao), 1.0);
    }
  `,
};

/** Dual-filter bloom: 5-tap downsample. */
export const BloomDownShader = {
  uniforms: {
    tInput: { value: null as THREE.Texture | null },
    uSourceTexel: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: FULLSCREEN_VERTEX,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tInput;
    uniform vec2 uSourceTexel;
    void main() {
      vec2 h = uSourceTexel;
      vec3 sum = texture2D(tInput, vUv).rgb * 4.0;
      sum += texture2D(tInput, vUv + vec2(-h.x, -h.y)).rgb;
      sum += texture2D(tInput, vUv + vec2(h.x, -h.y)).rgb;
      sum += texture2D(tInput, vUv + vec2(-h.x, h.y)).rgb;
      sum += texture2D(tInput, vUv + vec2(h.x, h.y)).rgb;
      gl_FragColor = vec4(sum / 8.0, 1.0);
    }
  `,
};

/** Dual-filter bloom: 8-tap tent upsample, added to the same-size downsample level. */
export const BloomUpShader = {
  uniforms: {
    tInput: { value: null as THREE.Texture | null },
    tAdd: { value: null as THREE.Texture | null },
    uSourceTexel: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: FULLSCREEN_VERTEX,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tInput;
    uniform sampler2D tAdd;
    uniform vec2 uSourceTexel;
    void main() {
      vec2 h = uSourceTexel;
      vec3 sum = texture2D(tInput, vUv + vec2(-h.x * 2.0, 0.0)).rgb;
      sum += texture2D(tInput, vUv + vec2(h.x * 2.0, 0.0)).rgb;
      sum += texture2D(tInput, vUv + vec2(0.0, -h.y * 2.0)).rgb;
      sum += texture2D(tInput, vUv + vec2(0.0, h.y * 2.0)).rgb;
      sum += texture2D(tInput, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
      sum += texture2D(tInput, vUv + vec2(h.x, -h.y)).rgb * 2.0;
      sum += texture2D(tInput, vUv + vec2(-h.x, h.y)).rgb * 2.0;
      sum += texture2D(tInput, vUv + vec2(h.x, h.y)).rgb * 2.0;
      gl_FragColor = vec4(sum / 12.0 + texture2D(tAdd, vUv).rgb, 1.0);
    }
  `,
};
