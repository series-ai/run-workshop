import * as THREE from 'three';

export const BloomShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uThreshold: { value: 1.25 },
    uKnee: { value: 0.50 },
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
    uniform vec2 uResolution; // destination (bloom) resolution
    uniform float uThreshold;
    uniform float uKnee;

    // Peak-channel extraction with soft knee
    vec3 extractBloom(vec3 c) {
      float peak = max(c.r, max(c.g, c.b));
      float soft = clamp(peak - uThreshold + uKnee, 0.0, 2.0 * uKnee);
      soft = soft * soft / (4.0 * uKnee + 0.0001);
      float excess = max(peak - uThreshold, soft);
      return c * (excess / max(peak, 0.0001));
    }

    void main() {
      vec2 texel = 1.0 / uResolution;

      // 4-tap rotated box filter downsampling from HDR scene buffer
      vec2 d0 = vec2(-0.75, -0.75) * texel;
      vec2 d1 = vec2( 0.75, -0.75) * texel;
      vec2 d2 = vec2(-0.75,  0.75) * texel;
      vec2 d3 = vec2( 0.75,  0.75) * texel;

      vec3 c0 = extractBloom(texture2D(tDiffuse, vUv + d0).rgb);
      vec3 c1 = extractBloom(texture2D(tDiffuse, vUv + d1).rgb);
      vec3 c2 = extractBloom(texture2D(tDiffuse, vUv + d2).rgb);
      vec3 c3 = extractBloom(texture2D(tDiffuse, vUv + d3).rgb);

      vec3 bloom = (c0 + c1 + c2 + c3) * 0.25;
      gl_FragColor = vec4(bloom, 1.0);
    }
  `,
};
