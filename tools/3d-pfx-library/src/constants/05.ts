import * as THREE from 'three'
import { PFX_PLASMA_IMPACT_FLIPBOOK_ATLAS } from '../plasmaImpactFlipbook'
import { sharedGradientTextureCache } from './04'
import type { PfxComboRingMultiplier, PfxGradientTextureKind, PfxSurfaceTuning } from '../types/02'

export const PFX_SCREEN_VIGNETTE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  // A HUD vignette owns the viewport, not a perspective-space rectangle.
  // Clip-space placement removes camera/parent scale and aspect seams.
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const PFX_SCREEN_VIGNETTE_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
varying vec2 vUv;

float vignetteHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  // Rectangular edge distance follows the viewport itself. max(), rather
  // than radial length, keeps the center clear on wide and tall screens.
  float edgeX = smoothstep(0.44, 1.0, abs(p.x));
  float edgeY = smoothstep(0.44, 1.0, abs(p.y));
  float edge = max(edgeX, edgeY);
  float corner = smoothstep(0.48, 1.18, length(p));

  // Coarse edge cells make the inner border pool at different depths instead
  // of revealing a perfect airbrushed rectangle. Narrow cells on the upper
  // edge extend farther inward and read as short gravity-led blood drips.
  float xCell = floor(vUv.x * 17.0);
  float yCell = floor(vUv.y * 11.0);
  float xNoise = vignetteHash(vec2(xCell, 3.0));
  float yNoise = vignetteHash(vec2(7.0, yCell));
  float topPool = smoothstep(0.78 + xNoise * 0.14, 0.985, vUv.y);
  float bottomPool = 1.0 - smoothstep(0.015, 0.15 + xNoise * 0.1, vUv.y);
  float leftPool = 1.0 - smoothstep(0.015, 0.12 + yNoise * 0.08, vUv.x);
  float rightPool = smoothstep(0.8 + yNoise * 0.1, 0.985, vUv.x);
  float pooledEdge = max(max(topPool, bottomPool), max(leftPool, rightPool));
  edge = max(edge * 0.62, pooledEdge * 0.72);

  // Thin, curved capillaries grow inward from each edge. Their sparse broken
  // rhythm is the signature layer: more organic than a perfect red frame and
  // cheaper than another texture or emitter draw.
  float capillary = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float root = (fi + 0.5) / 6.0;
    float reach = 0.055 + vignetteHash(vec2(fi, 11.0)) * 0.105;
    float topDistance = 1.0 - vUv.y;
    float bottomDistance = vUv.y;
    float topCurve = root + sin(topDistance * 31.0 + fi * 1.7) * (0.006 + reach * 0.045);
    float bottomCurve = root + sin(bottomDistance * 27.0 + fi * 2.1) * (0.005 + reach * 0.04);
    float topVein = 1.0 - smoothstep(0.0025, 0.0075, abs(vUv.x - topCurve));
    float bottomVein = 1.0 - smoothstep(0.0025, 0.0075, abs(vUv.x - bottomCurve));
    capillary = max(capillary, topVein * (1.0 - smoothstep(reach * 0.7, reach, topDistance)));
    capillary = max(capillary, bottomVein * (1.0 - smoothstep(reach * 0.7, reach, bottomDistance)) * 0.72);
  }
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float root = (fi + 0.5) / 4.0;
    float reach = 0.045 + vignetteHash(vec2(19.0, fi)) * 0.075;
    float leftDistance = vUv.x;
    float rightDistance = 1.0 - vUv.x;
    float leftCurve = root + sin(leftDistance * 29.0 + fi * 1.4) * 0.009;
    float rightCurve = root + sin(rightDistance * 25.0 + fi * 1.9) * 0.009;
    float leftVein = 1.0 - smoothstep(0.0025, 0.0075, abs(vUv.y - leftCurve));
    float rightVein = 1.0 - smoothstep(0.0025, 0.0075, abs(vUv.y - rightCurve));
    capillary = max(capillary, leftVein * (1.0 - smoothstep(reach * 0.7, reach, leftDistance)) * 0.8);
    capillary = max(capillary, rightVein * (1.0 - smoothstep(reach * 0.7, reach, rightDistance)) * 0.8);
  }

  // Two close cardiac beats followed by a rest. The base never vanishes,
  // so low-health information remains available between pulses.
  float beatClock = mod(uTime * 0.92, 2.4);
  float beatA = exp(-pow((beatClock - 0.28) / 0.12, 2.0));
  float beatB = exp(-pow((beatClock - 0.7) / 0.15, 2.0)) * 0.62;
  float heartbeat = 0.84 + 0.16 * clamp(beatA + beatB, 0.0, 1.0);
  float grain = vignetteHash(floor(vUv * vec2(46.0, 72.0)));
  float innerMetric = max(abs(p.x), abs(p.y));
  float innerPulseRim = exp(-pow((innerMetric - 0.63) / 0.032, 2.0))
    * (0.18 + clamp(beatA + beatB, 0.0, 1.0) * 0.82)
    * (0.55 + grain * 0.45);

  // Fine, stationary breakup prevents an airbrushed gradient while keeping
  // the center untouched and avoiding animated-noise shimmer.
  float breakup = mix(0.86, 1.05, grain);
  float alpha = clamp((pow(edge, 1.18) * 0.82 + corner * 0.14) * breakup + capillary * 0.34 + innerPulseRim * 0.12, 0.0, 1.0);
  vec3 bloodShadow = vec3(0.045, 0.004, 0.015);
  vec3 color = mix(bloodShadow, uColor, 0.3 + edge * 0.46 + capillary * 0.24 + innerPulseRim * 0.28 + beatA * 0.14);
  gl_FragColor = vec4(color, alpha * uOpacity * heartbeat);
}
`

export const PFX_ARC_THETA_START = -0.45

export const PFX_ARC_THETA_LENGTH = 2.5

export const PFX_ARC_INNER_RADIUS = 0.68

export const PFX_ARC_OUTER_RADIUS = 1.0

export const PFX_FLAME_CHARGE_TENDRIL_VERTEX = /* glsl */ `
attribute float aFlowProgress;
attribute float aTendrilLane;
uniform float uTime;
varying float vFlowProgress;
varying float vTendrilLane;
varying float vCircumference;
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  float bodyEnvelope = sin(aFlowProgress * 3.14159265);
  float tendrilPulse = sin(aFlowProgress * 19.0 - uTime * 7.2 + aTendrilLane * 2.31);
  vec3 animatedPosition = position + normal * tendrilPulse * bodyEnvelope * 0.009;
  vec4 worldPos = modelMatrix * vec4(animatedPosition, 1.0);
  vFlowProgress = aFlowProgress;
  vTendrilLane = aTendrilLane;
  vCircumference = uv.y;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - worldPos.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`

export const PFX_FLAME_CHARGE_TENDRIL_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uCycle;
uniform float uOpacity;
uniform float uCoreBoost;
uniform vec3 uColor;
uniform vec3 uColorHot;
uniform vec3 uColorCore;
varying float vFlowProgress;
varying float vTendrilLane;
varying float vCircumference;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  float chargeEnvelope = smoothstep(0.0, 0.12, uCycle)
    * (1.0 - smoothstep(0.54, 0.72, uCycle));
  // Positive time advances the crests from the outer birth point (0) into
  // the core entry (1), so even a still frame exposes a clear causal lane.
  float inwardFlow = vFlowProgress - uTime * 0.82;
  float travelingCrest = pow(0.5 + 0.5 * cos(inwardFlow * 18.84956 + vTendrilLane * 1.73), 4.0);
  float followingCrest = pow(0.5 + 0.5 * cos(inwardFlow * 31.41593 + vTendrilLane * 2.47 + 1.2), 7.0);
  float circumferenceLick = 0.5 + 0.5 * sin(
    vCircumference * 3.14159 + vFlowProgress * 13.0 - uTime * 4.8 + vTendrilLane * 1.9
  );
  float surfaceBreakup = smoothstep(0.28, 0.76,
    circumferenceLick * 0.68 + travelingCrest * 0.28 + followingCrest * 0.12
  );
  float ribbonWidthCoordinate = 1.0 - abs(vCircumference * 2.0 - 1.0);
  float ribbonEdgeFade = smoothstep(0.0, 0.28, ribbonWidthCoordinate);
  float outerBirthFade = smoothstep(0.0, 0.1, vFlowProgress);
  float coreHotBand = smoothstep(0.7, 0.98, vFlowProgress);
  float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 1.35);
  float heat = clamp(0.12 + travelingCrest * 0.64 + followingCrest * 0.2 + coreHotBand * 0.62 + rim * 0.14 + surfaceBreakup * 0.12, 0.0, 1.0);
  vec3 color = mix(uColorCore * 0.88, uColor, smoothstep(0.05, 0.42, heat));
  color = mix(color, uColorHot * uCoreBoost, smoothstep(0.52, 0.94, heat));
  float stableBody = 0.48 + travelingCrest * 0.35 + followingCrest * 0.1 + rim * 0.08;
  float coherentFlameBody = 0.44 + surfaceBreakup * 0.28 + travelingCrest * 0.22 + coreHotBand * 0.12;
  // Preserve a screen-readable strand between hot traveling crests. The old
  // multiplicative floor made each ribbon sub-pixel dim once scaled around
  // the core, so only the occasional crest survived the gameplay camera.
  float readableStrandBody = max(
    stableBody * coherentFlameBody,
    0.58 + surfaceBreakup * 0.18 + travelingCrest * 0.16 + coreHotBand * 0.08
  );
  float energy = ribbonEdgeFade * outerBirthFade * readableStrandBody * mix(0.82, 1.12, chargeEnvelope);
  gl_FragColor = vec4(color, clamp(energy, 0.0, 1.0) * uOpacity);
}
`

let pfxComboRingMaskTexture: THREE.DataTexture | undefined

let pfxComboRingTwoMaskTexture: THREE.DataTexture | undefined

function createPfxComboRingMaskTexture(): THREE.DataTexture {
  if (pfxComboRingMaskTexture) return pfxComboRingMaskTexture
  const size = 96
  const data = new Uint8Array(size * size * 4)
  const smoothstep = (edge0: number, edge1: number, value: number): number => {
    const normalized = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1)
    return normalized * normalized * (3 - 2 * normalized)
  }
  const band = (distance: number, center: number, inner: number, outer: number): number =>
    1 - smoothstep(inner, outer, Math.abs(distance - center))
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const x = ((column + 0.5) / size) * 2 - 1
      const y = ((row + 0.5) / size) * 2 - 1
      const radius = Math.sqrt(x * x + y * y)
      const ring = band(radius, 0.62, 0.028, 0.058) * (x + y >= -0.18 ? 1 : 0.55)
      const outer = band(radius, 0.79, 0.025, 0.055)
      const tickGap = Math.abs(Math.abs(x) - Math.abs(y)) >= 0.13 ? 1 : 0
      const confirmNotch = y >= 0.46 && x >= 0.18 ? outer : 0
      const outerMarks = Math.max(outer * tickGap, confirmNotch)
      const glyphX = x
      const glyphY = y - 0.05
      const xStroke = Math.min(
        Math.abs(glyphX - glyphY * 0.72 + 0.18),
        Math.abs(glyphX + glyphY * 0.72 + 0.18),
      )
      const multiplierX = (1 - smoothstep(0.025, 0.065, xStroke))
        * (Math.abs(glyphX + 0.18) <= 0.2 && Math.abs(glyphY) <= 0.25 ? 1 : 0)
      const upperThree = band(Math.hypot(glyphX - 0.14, glyphY - 0.13), 0.14, 0.025, 0.065)
      const lowerThree = band(Math.hypot(glyphX - 0.14, glyphY + 0.13), 0.14, 0.025, 0.065)
      const multiplierThree = glyphX >= 0.1 ? Math.max(upperThree, lowerThree) : 0
      const diamond = (centerX: number, centerY: number): number =>
        1 - smoothstep(0.035, 0.07, Math.abs(Math.abs(x - centerX) + Math.abs(y - centerY) - 0.105))
      const chain = Math.max(diamond(-0.28, -0.47), diamond(0, -0.52), diamond(0.28, -0.47))
      const offset = (row * size + column) * 4
      data[offset] = Math.round(THREE.MathUtils.clamp(ring, 0, 1) * 255)
      data[offset + 1] = Math.round(THREE.MathUtils.clamp(outerMarks, 0, 1) * 255)
      data[offset + 2] = Math.round(THREE.MathUtils.clamp(Math.max(multiplierX, multiplierThree), 0, 1) * 255)
      data[offset + 3] = Math.round(THREE.MathUtils.clamp(chain, 0, 1) * 255)
    }
  }
  pfxComboRingMaskTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType)
  pfxComboRingMaskTexture.name = 'pfx-combo-ring-shared-mask'
  pfxComboRingMaskTexture.minFilter = THREE.LinearFilter
  pfxComboRingMaskTexture.magFilter = THREE.LinearFilter
  pfxComboRingMaskTexture.generateMipmaps = false
  pfxComboRingMaskTexture.needsUpdate = true
  return pfxComboRingMaskTexture
}

function createPfxComboRingTwoMaskTexture(): THREE.DataTexture {
  if (pfxComboRingTwoMaskTexture) return pfxComboRingTwoMaskTexture
  const size = 96
  const data = new Uint8Array(size * size * 4)
  const smoothstep = (edge0: number, edge1: number, value: number): number => {
    const normalized = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1)
    return normalized * normalized * (3 - 2 * normalized)
  }
  const segment = (
    x: number,
    y: number,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    thickness: number,
  ): number => {
    const deltaX = endX - startX
    const deltaY = endY - startY
    const lengthSq = deltaX * deltaX + deltaY * deltaY
    const projection = THREE.MathUtils.clamp(((x - startX) * deltaX + (y - startY) * deltaY) / lengthSq, 0, 1)
    const nearestX = startX + deltaX * projection
    const nearestY = startY + deltaY * projection
    const distance = Math.hypot(x - nearestX, y - nearestY)
    return 1 - smoothstep(thickness, thickness + 0.022, distance)
  }
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const x = ((column + 0.5) / size) * 2 - 1
      const y = ((row + 0.5) / size) * 2 - 1
      const digitTwo = Math.max(
        segment(x, y, 0.02, 0.2, 0.3, 0.2, 0.035),
        segment(x, y, 0.3, 0.2, 0.34, 0.08, 0.035),
        segment(x, y, 0.34, 0.08, 0.04, -0.02, 0.035),
        segment(x, y, 0.04, -0.02, 0.01, -0.2, 0.035),
        segment(x, y, 0.01, -0.2, 0.32, -0.2, 0.035),
      )
      const offset = (row * size + column) * 4
      data[offset] = Math.round(THREE.MathUtils.clamp(digitTwo, 0, 1) * 255)
    }
  }
  pfxComboRingTwoMaskTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType)
  pfxComboRingTwoMaskTexture.name = 'pfx-combo-ring-two-mask'
  pfxComboRingTwoMaskTexture.minFilter = THREE.LinearFilter
  pfxComboRingTwoMaskTexture.magFilter = THREE.LinearFilter
  pfxComboRingTwoMaskTexture.generateMipmaps = false
  pfxComboRingTwoMaskTexture.needsUpdate = true
  return pfxComboRingTwoMaskTexture
}

export function createPfxComboRingMaterial(
  opacity: number,
  color: THREE.ColorRepresentation = '#ffc928',
  density = 1,
  styleEdgeHardness = 0.5,
  comboMultiplier: PfxComboRingMultiplier = 3,
): THREE.ShaderMaterial {
  const base = new THREE.Color(color)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uComboMask: { value: createPfxComboRingMaskTexture() },
      uComboTwoMask: { value: createPfxComboRingTwoMaskTexture() },
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uDensity: { value: THREE.MathUtils.clamp(density, 0.25, 2) },
      uComboMultiplier: { value: THREE.MathUtils.clamp(comboMultiplier, 2, 3) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
      uColor: { value: new THREE.Vector3(base.r, base.g, base.b) },
    },
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec2 vComboUv;
      void main() {
        vComboUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uCycle;
      uniform float uDensity;
      uniform float uComboMultiplier;
      uniform float uStyleEdgeHardness;
      uniform vec3 uColor;
      uniform sampler2D uComboMask;
      uniform sampler2D uComboTwoMask;
      varying vec2 vComboUv;
      void main() {
        float decayProgress = clamp((uCycle - 0.38) * 2.9412, 0.0, 1.0);
        vec2 decayUv = vComboUv * mix(1.0, 0.92, decayProgress);
        vec4 comboMask = texture2D(uComboMask, decayUv * 0.5 + 0.5);
        vec4 comboTwoMask = texture2D(uComboTwoMask, decayUv * 0.5 + 0.5);
        float sweepFront = mix(-0.92, 0.92, clamp((uCycle - 0.02) * 3.5714, 0.0, 1.0));
        float streakTicks = comboMask.g * step(decayUv.x, sweepFront);
        float comboChain = comboMask.a * step(0.35, uDensity) * (1.0 - decayProgress * 0.45);
        float xGlyph = comboMask.b * step(decayUv.x, 0.0);
        float threeGlyph = comboMask.b * step(0.0, decayUv.x);
        float multiplierGlyph = mix(comboTwoMask.r, threeGlyph, step(2.5, uComboMultiplier));
        float glyph = max(xGlyph, multiplierGlyph) * (1.0 - decayProgress * 0.72);
        float residue = max(streakTicks * mix(0.62, 0.9, decayProgress), comboChain);
        float alpha = max(comboMask.r * (1.0 - decayProgress * 0.68), max(residue, glyph));
        vec3 pigment = mix(vec3(1.0, 0.72, 0.08), uColor, 0.86);
        vec3 hot = mix(pigment, vec3(1.0, 0.96, 0.72), mix(0.42, 0.72, uStyleEdgeHardness));
        vec3 color = mix(pigment, hot, max(comboMask.g, glyph));
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(color, alpha * uOpacity);
      }
    `,
  })
  material.userData['pfxComboRingMaterial'] = true
  material.userData['pfxComboRingDrawCalls'] = 1
  material.userData['pfxComboRingTriangles'] = 2
  material.userData['pfxComboRingParticleCount'] = 0
  material.userData['pfxComboRingFragmentTranscendentalOps'] = 0
  material.userData['pfxComboRingFragmentTextureSamples'] = 2
  material.userData['pfxComboRingTransientAllocationsPerFrame'] = 0
  material.userData['pfxComboRingMultiplierVariants'] = '2x/3x'
  material.userData['pfxComboRingMeshJustification'] = 'screen-space-quad-for-analytic-ring-and-ticks'
  return material
}

let pfxUiPickupMaskTexture: THREE.DataTexture | undefined

function createPfxUiPickupMaskTexture(): THREE.DataTexture {
  if (pfxUiPickupMaskTexture) return pfxUiPickupMaskTexture
  const width = 128
  const height = 80
  const data = new Uint8Array(width * height * 4)
  const smoothstep = (edge0: number, edge1: number, value: number): number => {
    const normalized = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1)
    return normalized * normalized * (3 - 2 * normalized)
  }
  const segment = (
    x: number,
    y: number,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    thickness: number,
  ): number => {
    const deltaX = endX - startX
    const deltaY = endY - startY
    const lengthSq = deltaX * deltaX + deltaY * deltaY
    const projection = THREE.MathUtils.clamp(((x - startX) * deltaX + (y - startY) * deltaY) / lengthSq, 0, 1)
    const distance = Math.hypot(x - (startX + deltaX * projection), y - (startY + deltaY * projection))
    return 1 - smoothstep(thickness, thickness + 0.022, distance)
  }
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const x = ((column + 0.5) / width) * 2 - 1
      const y = ((row + 0.5) / height) * 2 - 1
      const cornerFrame = Math.max(
        segment(x, y, -0.82, -0.42, -0.54, -0.42, 0.025),
        segment(x, y, -0.82, -0.42, -0.82, -0.15, 0.025),
        segment(x, y, -0.82, 0.42, -0.54, 0.42, 0.025),
        segment(x, y, -0.82, 0.42, -0.82, 0.15, 0.025),
        segment(x, y, 0.82, -0.42, 0.54, -0.42, 0.025),
        segment(x, y, 0.82, -0.42, 0.82, -0.15, 0.025),
        segment(x, y, 0.82, 0.42, 0.54, 0.42, 0.025),
        segment(x, y, 0.82, 0.42, 0.82, 0.15, 0.025),
      )
      const tokenX = x + 0.48
      const tokenY = y
      const hexDistance = Math.max(Math.abs(tokenX) * 0.866 + Math.abs(tokenY) * 0.5, Math.abs(tokenY))
      const tokenOutline = 1 - smoothstep(0.035, 0.07, Math.abs(hexDistance - 0.22))
      const tokenGem = 1 - smoothstep(0.025, 0.055, Math.abs(Math.abs(tokenX) + Math.abs(tokenY) - 0.115))
      const plusOne = Math.max(
        segment(x, y, -0.12, -0.12, -0.12, 0.12, 0.028),
        segment(x, y, -0.23, 0, -0.01, 0, 0.028),
        segment(x, y, 0.23, -0.16, 0.23, 0.16, 0.034),
        segment(x, y, 0.15, 0.1, 0.23, 0.16, 0.034),
        segment(x, y, 0.13, -0.16, 0.33, -0.16, 0.028),
      )
      const chevrons = Math.max(
        segment(x, y, 0.54, -0.1, 0.66, 0.03, 0.026),
        segment(x, y, 0.66, 0.03, 0.78, -0.1, 0.026),
        segment(x, y, 0.54, 0.12, 0.66, 0.25, 0.026),
        segment(x, y, 0.66, 0.25, 0.78, 0.12, 0.026),
      )
      const offset = (row * width + column) * 4
      data[offset] = Math.round(THREE.MathUtils.clamp(cornerFrame, 0, 1) * 255)
      data[offset + 1] = Math.round(THREE.MathUtils.clamp(Math.max(tokenOutline, tokenGem), 0, 1) * 255)
      data[offset + 2] = Math.round(THREE.MathUtils.clamp(plusOne, 0, 1) * 255)
      data[offset + 3] = Math.round(THREE.MathUtils.clamp(chevrons, 0, 1) * 255)
    }
  }
  pfxUiPickupMaskTexture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType)
  pfxUiPickupMaskTexture.name = 'pfx-ui-pickup-shared-mask'
  pfxUiPickupMaskTexture.minFilter = THREE.LinearFilter
  pfxUiPickupMaskTexture.magFilter = THREE.LinearFilter
  pfxUiPickupMaskTexture.generateMipmaps = false
  pfxUiPickupMaskTexture.needsUpdate = true
  return pfxUiPickupMaskTexture
}

export function createPfxUiPickupMaterial(
  opacity: number,
  colorA: THREE.ColorRepresentation = '#fbbf24',
  colorB: THREE.ColorRepresentation = '#f472b6',
  density = 0.38,
  styleEdgeHardness = 0.22,
): THREE.ShaderMaterial {
  const primary = new THREE.Color(colorA)
  const secondary = new THREE.Color(colorB)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPickupMask: { value: createPfxUiPickupMaskTexture() },
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uDensity: { value: THREE.MathUtils.clamp(density, 0.05, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
      uColorA: { value: new THREE.Vector3(primary.r, primary.g, primary.b) },
      uColorB: { value: new THREE.Vector3(secondary.r, secondary.g, secondary.b) },
    },
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec2 vPickupUv;
      void main() {
        vPickupUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uCycle;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform sampler2D uPickupMask;
      varying vec2 vPickupUv;
      void main() {
        vec4 pickupMask = texture2D(uPickupMask, vPickupUv);
        float neonStyle = step(0.5, uStyleEdgeHardness);
        vec4 styleMask = mix(pickupMask, step(vec4(0.46), pickupMask), neonStyle);
        float token = styleMask.g * (1.0 - step(0.56, uCycle) * 0.42);
        float increment = styleMask.b * step(0.06, uCycle);
        float upperChevron = step(0.54, vPickupUv.y);
        float densityGate = max(1.0 - upperChevron, step(0.3, uDensity));
        float upperReveal = step(mix(0.1, 0.22, neonStyle), uCycle);
        float lowerReveal = step(mix(0.1, 0.06, neonStyle), uCycle);
        float chevronReveal = mix(lowerReveal, upperReveal, upperChevron);
        float chevrons = styleMask.a * chevronReveal * densityGate;
        float diagonalFrameGate = step(0.36, abs(vPickupUv.x - vPickupUv.y));
        float styleFrameGate = mix(1.0, diagonalFrameGate, neonStyle);
        float receiptFrame = styleMask.r * step(0.03, uCycle) * styleFrameGate;
        float alpha = max(max(receiptFrame, token), max(increment, chevrons));
        vec3 panelColor = mix(mix(uColorA, uColorB, 0.08), mix(uColorA, uColorB, 0.48), neonStyle);
        vec3 rewardColor = mix(uColorA, vec3(1.0, 0.94, 0.68), mix(0.32, 0.62, uStyleEdgeHardness));
        vec3 chevronColor = mix(uColorA, uColorB, neonStyle);
        vec3 color = mix(panelColor, uColorB, increment);
        color = mix(color, chevronColor, chevrons);
        color = mix(color, rewardColor, token);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(color, alpha * uOpacity);
      }
    `,
  })
  material.userData['pfxUiPickupMaterial'] = true
  material.userData['pfxUiPickupDrawCalls'] = 1
  material.userData['pfxUiPickupTriangles'] = 2
  material.userData['pfxUiPickupParticleCount'] = 0
  material.userData['pfxUiPickupFragmentTranscendentalOps'] = 0
  material.userData['pfxUiPickupFragmentTextureSamples'] = 1
  material.userData['pfxUiPickupTransientAllocationsPerFrame'] = 0
  material.userData['pfxUiPickupMeshJustification'] = 'screen-space-quad-for-procedural-pickup-receipt'
  return material
}

const PFX_TARGET_SPAWN_VERTEX = /* glsl */ `
  varying vec2 vTargetUv;
  void main() {
    vTargetUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const PFX_TARGET_SPAWN_RETICLE_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uCycle;
  uniform float uDensity;
  uniform float uStyleEdgeHardness;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vTargetUv;
  float aaBelow(float value, float edge, float width) {
    return clamp((edge - value) / width + 0.5, 0.0, 1.0);
  }
  float aaAbove(float value, float edge, float width) {
    return 1.0 - aaBelow(value, edge, width);
  }
  float aaBand(float value, float center, float halfWidth, float width) {
    return 1.0 - clamp((abs(value - center) - halfWidth) / width, 0.0, 1.0);
  }
  void main() {
    vec2 p = vTargetUv - vec2(0.5);
    vec2 a = abs(p);
    float neonStyle = step(0.5, uStyleEdgeHardness);
    float edgeSoftness = mix(1.55, 0.72, neonStyle);
    float aaWidth = max((fwidth(p.x) + fwidth(p.y)) * 0.5 * edgeSoftness, 0.0015);
    float lineWidth = mix(0.034, 0.02, neonStyle);
    float horizontalCorners = aaAbove(a.x, 0.3, aaWidth) * aaBelow(a.x, 0.44, aaWidth) * aaBand(a.y, 0.36, lineWidth, aaWidth);
    float verticalCorners = aaBand(a.x, 0.36, lineWidth, aaWidth) * aaAbove(a.y, 0.26, aaWidth) * aaBelow(a.y, 0.39, aaWidth);
    float diagonalGate = mix(1.0, step(0.0, p.x * p.y), neonStyle);
    float cornerBrackets = max(horizontalCorners, verticalCorners) * diagonalGate;
    float squareDistance = max(a.x, a.y);
    float boundaryGap = step(0.065, abs(a.x - a.y));
    float segmentedBoundary = aaBand(squareDistance, 0.235, lineWidth * 0.58, aaWidth) * boundaryGap * step(0.06, uCycle);
    float approach = mix(0.45, 0.17, min(1.0, uCycle / 0.42));
    float pipWidth = mix(0.027, 0.016, neonStyle);
    float horizontalChevronDistance = abs(abs(a.x - approach) - a.y);
    float verticalChevronDistance = abs(abs(a.y - approach) - a.x);
    float horizontalPips = aaBelow(horizontalChevronDistance, pipWidth, aaWidth) * aaBelow(a.y, 0.085, aaWidth) * aaAbove(a.x, approach - 0.085, aaWidth) * aaBelow(a.x, approach + 0.085, aaWidth);
    float verticalPips = aaBelow(verticalChevronDistance, pipWidth, aaWidth) * aaBelow(a.x, 0.085, aaWidth) * aaAbove(a.y, approach - 0.085, aaWidth) * aaBelow(a.y, approach + 0.085, aaWidth);
    float densityTopology = step(0.3, uDensity);
    float innerPips = aaBand(a.x, approach * 0.7, pipWidth * 0.65, aaWidth) * aaBelow(a.y, 0.035, aaWidth) * densityTopology;
    float lockPips = max(max(horizontalPips, verticalPips), innerPips) * step(0.05, uCycle) * (1.0 - step(0.62, uCycle));
    float diamondDistance = a.x + a.y;
    float diamondOutline = aaBand(diamondDistance, 0.105 + lineWidth * 0.5, lineWidth * 0.5, aaWidth);
    float diamondFill = aaBelow(diamondDistance, 0.072, aaWidth) * step(0.44, uCycle) * (1.0 - step(0.6, uCycle));
    float centerDiamond = max(diamondOutline * step(0.32, uCycle), diamondFill);
    float confirmPulse = step(0.44, uCycle) * (1.0 - step(0.64, uCycle));
    float alpha = max(max(cornerBrackets, segmentedBoundary), max(lockPips, centerDiamond));
    vec3 frameColor = mix(uColorA, uColorB, mix(0.2, 0.42, neonStyle));
    vec3 color = mix(frameColor, uColorB, max(diamondFill, confirmPulse * centerDiamond));
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`

const PFX_TARGET_SPAWN_PIN_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uCycle;
  uniform float uDensity;
  uniform float uStyleEdgeHardness;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vTargetUv;
  float aaBelow(float value, float edge, float width) {
    return clamp((edge - value) / width + 0.5, 0.0, 1.0);
  }
  float aaAbove(float value, float edge, float width) {
    return 1.0 - aaBelow(value, edge, width);
  }
  float aaBand(float value, float center, float halfWidth, float width) {
    return 1.0 - clamp((abs(value - center) - halfWidth) / width, 0.0, 1.0);
  }
  void main() {
    vec2 p = vTargetUv - vec2(0.5);
    vec2 a = abs(p);
    float neonStyle = step(0.5, uStyleEdgeHardness);
    float edgeSoftness = mix(1.55, 0.72, neonStyle);
    float aaWidth = max((fwidth(p.x) + fwidth(p.y)) * 0.5 * edgeSoftness, 0.0015);
    float lineWidth = mix(0.03, 0.016, neonStyle);
    float stemOffset = mix(0.0, 0.035, neonStyle);
    float verticalStem = aaBand(a.x, stemOffset, lineWidth, aaWidth) * aaAbove(p.y, -0.48, aaWidth) * aaBelow(p.y, 0.16, aaWidth);
    float groundedFoot = aaBelow(a.x, 0.105, aaWidth) * aaBand(p.y, -0.46, lineWidth, aaWidth);
    vec2 diamondP = vec2(p.x, p.y - 0.24);
    float diamondDistance = abs(diamondP.x) + abs(diamondP.y);
    float targetDiamond = aaBand(diamondDistance, 0.12 + lineWidth * 0.5, lineWidth * 0.5, aaWidth) * step(0.08, uCycle);
    float diamondCore = aaBelow(diamondDistance, 0.048, aaWidth) * step(0.46, uCycle) * (1.0 - step(0.64, uCycle));
    float horizontalBars = aaAbove(a.x, 0.12, aaWidth) * aaBelow(a.x, 0.29, aaWidth) * aaBand(p.y, -0.12, lineWidth, aaWidth);
    float verticalBars = aaBand(a.x, 0.24, lineWidth, aaWidth) * aaAbove(p.y, -0.2, aaWidth) * aaBelow(p.y, -0.04, aaWidth);
    float staggerGate = mix(1.0, step(0.0, p.x), neonStyle);
    float confirmBars = max(horizontalBars, verticalBars) * step(0.43, uCycle) * (1.0 - step(0.67, uCycle)) * max(1.0 - neonStyle, staggerGate);
    float densityAccent = step(0.3, uDensity) * aaBelow(abs(p.x), 0.075, aaWidth) * aaBand(p.y, -0.28, lineWidth, aaWidth) * step(0.5, uCycle);
    float alpha = max(max(verticalStem, groundedFoot), max(max(targetDiamond, diamondCore), max(confirmBars, densityAccent)));
    vec3 stemColor = mix(uColorA, uColorB, 0.18);
    vec3 color = mix(stemColor, uColorB, max(max(targetDiamond, diamondCore), confirmBars * neonStyle));
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`

export function createPfxTargetSpawnMaterial(
  variant: 'reticle' | 'pin',
  opacity: number,
  colorA: THREE.ColorRepresentation = '#72d7ff',
  colorB: THREE.ColorRepresentation = '#ffcf4d',
  density = 0.42,
  styleEdgeHardness = 0.22,
): THREE.ShaderMaterial {
  const primary = new THREE.Color(colorA)
  const secondary = new THREE.Color(colorB)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uDensity: { value: THREE.MathUtils.clamp(density, 0.05, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
      uColorA: { value: new THREE.Vector3(primary.r, primary.g, primary.b) },
      uColorB: { value: new THREE.Vector3(secondary.r, secondary.g, secondary.b) },
    },
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: PFX_TARGET_SPAWN_VERTEX,
    fragmentShader: variant === 'reticle' ? PFX_TARGET_SPAWN_RETICLE_FRAGMENT : PFX_TARGET_SPAWN_PIN_FRAGMENT,
  })
  material.userData['pfxTargetSpawnMaterial'] = true
  material.userData['pfxTargetSpawnVariant'] = variant
  material.userData['pfxTargetSpawnDrawCalls'] = 1
  material.userData['pfxTargetSpawnTriangles'] = 2
  material.userData['pfxTargetSpawnParticleCount'] = 0
  material.userData['pfxTargetSpawnFragmentTextureSamples'] = 0
  material.userData['pfxTargetSpawnTransientAllocationsPerFrame'] = 0
  material.userData['pfxTargetSpawnMeshJustification'] = 'crossed-ground-reticle-and-camera-facing-confirmation-pin'
  return material
}

const PFX_WARNING_LOOP_VERTEX = /* glsl */ `
  varying vec2 vWarningUv;
  void main() {
    vWarningUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const PFX_WARNING_LOOP_PANEL_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uCycle;
  uniform float uPulse;
  uniform float uDensity;
  uniform float uStyleEdgeHardness;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vWarningUv;
  float aaBelow(float value, float edge, float width) {
    return clamp((edge - value) / width + 0.5, 0.0, 1.0);
  }
  float aaAbove(float value, float edge, float width) {
    return 1.0 - aaBelow(value, edge, width);
  }
  float aaBand(float value, float center, float halfWidth, float width) {
    return 1.0 - clamp((abs(value - center) - halfWidth) / width, 0.0, 1.0);
  }
  void main() {
    vec2 p = vWarningUv - vec2(0.5);
    vec2 a = abs(p);
    float neonStyle = step(0.5, uStyleEdgeHardness);
    float edgeSoftness = mix(1.5, 0.72, neonStyle);
    float aaWidth = max((fwidth(p.x) + fwidth(p.y)) * 0.5 * edgeSoftness, 0.0015);
    float lineWidth = mix(0.03, 0.017, neonStyle);
    float octagonDistance = max(max(a.x, a.y), (a.x + a.y) * 0.7071);
    float cornerCutGate = mix(1.0, mix(0.42, 1.0, step(0.0, p.x * p.y)), neonStyle);
    float octagonBoundary = aaBand(octagonDistance, 0.405, lineWidth, aaWidth) * cornerCutGate;
    float triangleSideDistance = p.y + a.x * 1.48;
    float triangleSides = aaBand(triangleSideDistance, 0.17, lineWidth * 0.82, aaWidth)
      * aaAbove(p.y, -0.17, aaWidth) * aaBelow(p.y, 0.19, aaWidth);
    float triangleBase = aaBand(p.y, -0.17, lineWidth * 0.82, aaWidth) * aaBelow(a.x, 0.235, aaWidth);
    float warningTriangle = max(triangleSides, triangleBase);
    float triangleStem = aaBelow(a.x, lineWidth * 0.72, aaWidth) * aaAbove(p.y, -0.045, aaWidth) * aaBelow(p.y, 0.085, aaWidth);
    vec2 dotP = vec2(p.x, p.y + 0.105);
    float triangleDot = aaBelow(dot(dotP, dotP), 0.0015, aaWidth * 0.08);
    float densityTopology = step(0.3, uDensity);
    float centerBar = aaBand(p.x, 0.0, lineWidth * 0.7, aaWidth) * aaBand(p.y, -0.3, lineWidth * 0.62, aaWidth);
    float sideBars = max(
      aaBand(p.x, -0.14, lineWidth * 0.7, aaWidth),
      aaBand(p.x, 0.14, lineWidth * 0.7, aaWidth)
    ) * aaBand(p.y, -0.3, lineWidth * 0.62, aaWidth) * densityTopology;
    float cozyReveal = step(0.12, uCycle);
    float neonReveal = mix(step(0.09, uCycle), step(0.25, uCycle), step(0.0, p.x));
    float cadenceBars = max(centerBar, sideBars) * mix(cozyReveal, neonReveal, neonStyle);
    float glyph = max(warningTriangle, max(triangleStem, triangleDot)) * mix(0.72, 1.0, uPulse);
    float alpha = max(octagonBoundary * mix(0.74, 1.0, uPulse), max(glyph, cadenceBars));
    vec3 boundaryColor = mix(uColorA, uColorB, mix(0.12, 0.34, neonStyle));
    vec3 color = mix(boundaryColor, uColorB, max(glyph, cadenceBars * uPulse));
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`

const PFX_WARNING_LOOP_BEACON_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uCycle;
  uniform float uPulse;
  uniform float uDensity;
  uniform float uStyleEdgeHardness;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vWarningUv;
  float aaBelow(float value, float edge, float width) {
    return clamp((edge - value) / width + 0.5, 0.0, 1.0);
  }
  float aaAbove(float value, float edge, float width) {
    return 1.0 - aaBelow(value, edge, width);
  }
  float aaBand(float value, float center, float halfWidth, float width) {
    return 1.0 - clamp((abs(value - center) - halfWidth) / width, 0.0, 1.0);
  }
  void main() {
    vec2 p = vWarningUv - vec2(0.5);
    vec2 a = abs(p);
    float neonStyle = step(0.5, uStyleEdgeHardness);
    float edgeSoftness = mix(1.5, 0.72, neonStyle);
    float aaWidth = max((fwidth(p.x) + fwidth(p.y)) * 0.5 * edgeSoftness, 0.0015);
    float lineWidth = mix(0.032, 0.017, neonStyle);
    float exclamationStem = aaBelow(a.x, lineWidth, aaWidth) * aaAbove(p.y, -0.05, aaWidth) * aaBelow(p.y, 0.28, aaWidth);
    vec2 dotP = vec2(p.x, p.y + 0.16);
    float exclamationDot = aaBelow(dot(dotP, dotP), 0.0042, aaWidth * 0.12);
    float sideTopology = mix(1.0, step(0.0, p.x), neonStyle);
    float sideTicks = aaBand(a.x, 0.2, lineWidth * 0.72, aaWidth)
      * aaBand(p.y, 0.045, 0.08, aaWidth) * sideTopology * step(0.16, uCycle);
    float lowerTicks = aaBand(a.x, 0.3, lineWidth * 0.65, aaWidth)
      * aaBand(p.y, -0.08, 0.045, aaWidth) * step(0.3, uDensity) * step(0.28, uCycle);
    float topChevron = aaBand(p.y + a.x * 1.18, 0.36, lineWidth * 0.68, aaWidth)
      * aaAbove(p.y, 0.15, aaWidth) * aaBelow(p.y, 0.38, aaWidth);
    float triangleBase = aaBand(p.y, 0.13, lineWidth * 0.68, aaWidth) * aaBelow(a.x, 0.2, aaWidth);
    float beaconTriangle = max(topChevron, triangleBase) * mix(0.68, 1.0, uPulse);
    float alpha = max(max(exclamationStem, exclamationDot), max(max(sideTicks, lowerTicks), beaconTriangle));
    vec3 stemColor = mix(uColorA, uColorB, mix(0.3, 0.55, neonStyle));
    vec3 color = mix(stemColor, uColorB, max(exclamationDot, beaconTriangle));
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`

export function createPfxWarningLoopMaterial(
  variant: 'panel' | 'beacon',
  opacity: number,
  colorA: THREE.ColorRepresentation = '#ff5b35',
  colorB: THREE.ColorRepresentation = '#ffd166',
  density = 0.42,
  styleEdgeHardness = 0.22,
): THREE.ShaderMaterial {
  const primary = new THREE.Color(colorA)
  const secondary = new THREE.Color(colorB)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uPulse: { value: 0 },
      uDensity: { value: THREE.MathUtils.clamp(density, 0.05, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
      uColorA: { value: new THREE.Vector3(primary.r, primary.g, primary.b) },
      uColorB: { value: new THREE.Vector3(secondary.r, secondary.g, secondary.b) },
    },
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: PFX_WARNING_LOOP_VERTEX,
    fragmentShader: variant === 'panel' ? PFX_WARNING_LOOP_PANEL_FRAGMENT : PFX_WARNING_LOOP_BEACON_FRAGMENT,
  })
  material.userData['pfxWarningLoopMaterial'] = true
  material.userData['pfxWarningLoopVariant'] = variant
  material.userData['pfxWarningLoopDrawCalls'] = 1
  material.userData['pfxWarningLoopTriangles'] = 2
  material.userData['pfxWarningLoopParticleCount'] = 0
  material.userData['pfxWarningLoopFragmentTextureSamples'] = 0
  material.userData['pfxWarningLoopTransientAllocationsPerFrame'] = 0
  material.userData['pfxWarningLoopMeshJustification'] = 'ground-hazard-panel-with-camera-facing-alert-beacon'
  return material
}

const PFX_MARKER_RELEASE_VERTEX = /* glsl */ `
  varying vec2 vMarkerUv;
  void main() {
    vMarkerUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const PFX_MARKER_RELEASE_GROUND_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uProgress;
  uniform float uExpansion;
  uniform float uDensity;
  uniform float uStyleEdgeHardness;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vMarkerUv;
  float aaBelow(float value, float edge, float width) { return clamp((edge - value) / width + 0.5, 0.0, 1.0); }
  float aaAbove(float value, float edge, float width) { return 1.0 - aaBelow(value, edge, width); }
  float aaBand(float value, float center, float halfWidth, float width) { return 1.0 - clamp((abs(value - center) - halfWidth) / width, 0.0, 1.0); }
  void main() {
    vec2 p = vMarkerUv - vec2(0.5);
    vec2 a = abs(p);
    float neonStyle = step(0.5, uStyleEdgeHardness);
    float edgeSoftness = mix(1.5, 0.72, neonStyle);
    float aaWidth = max((fwidth(p.x) + fwidth(p.y)) * 0.5 * edgeSoftness, 0.0015);
    float lineWidth = mix(0.03, 0.016, neonStyle);
    float diamondDistance = a.x + a.y;
    float diamondAnchor = aaBand(diamondDistance, 0.13, lineWidth * 0.72, aaWidth) * mix(1.0, 1.0 - uExpansion * 0.55, neonStyle);
    float clampRadius = mix(0.19, 0.36, uExpansion);
    float verticalClamp = aaBand(a.x, clampRadius, lineWidth, aaWidth)
      * aaAbove(a.y, clampRadius - 0.11, aaWidth) * aaBelow(a.y, clampRadius + 0.025, aaWidth);
    float horizontalClamp = aaBand(a.y, clampRadius, lineWidth, aaWidth)
      * aaAbove(a.x, clampRadius - 0.11, aaWidth) * aaBelow(a.x, clampRadius + 0.025, aaWidth);
    float quadrantGate = mix(1.0, mix(0.42, 1.0, step(0.0, p.x * p.y)), neonStyle);
    float cornerClamps = max(verticalClamp, horizontalClamp) * quadrantGate;
    float railSpan = aaAbove(max(a.x, a.y), 0.17, aaWidth) * aaBelow(max(a.x, a.y), 0.34, aaWidth);
    float axisRails = max(aaBelow(a.x, lineWidth * 0.65, aaWidth), aaBelow(a.y, lineWidth * 0.65, aaWidth));
    float releaseRails = railSpan * axisRails * step(0.22, uProgress) * step(0.3, uDensity);
    float alpha = max(diamondAnchor, max(cornerClamps, releaseRails));
    vec3 color = mix(uColorA, uColorB, max(releaseRails, cornerClamps * uExpansion));
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`

const PFX_MARKER_RELEASE_BADGE_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uProgress;
  uniform float uExpansion;
  uniform float uDensity;
  uniform float uStyleEdgeHardness;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vMarkerUv;
  float aaBelow(float value, float edge, float width) { return clamp((edge - value) / width + 0.5, 0.0, 1.0); }
  float aaAbove(float value, float edge, float width) { return 1.0 - aaBelow(value, edge, width); }
  float aaBand(float value, float center, float halfWidth, float width) { return 1.0 - clamp((abs(value - center) - halfWidth) / width, 0.0, 1.0); }
  float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
  }
  void main() {
    vec2 p = vMarkerUv - vec2(0.5);
    vec2 a = abs(p);
    float neonStyle = step(0.5, uStyleEdgeHardness);
    float edgeSoftness = mix(1.5, 0.72, neonStyle);
    float aaWidth = max((fwidth(p.x) + fwidth(p.y)) * 0.5 * edgeSoftness, 0.0015);
    float lineWidth = mix(0.032, 0.017, neonStyle);
    float diamondBadge = aaBand(a.x + a.y, 0.27, lineWidth, aaWidth);
    float checkA = aaBelow(sdSegment(p, vec2(-0.13, 0.0), vec2(-0.035, -0.09)), lineWidth * 0.82, aaWidth);
    float checkB = aaBelow(sdSegment(p, vec2(-0.035, -0.09), vec2(0.16, 0.12)), lineWidth * 0.82, aaWidth);
    float confirmationCheck = max(checkA, checkB) * step(0.12, uProgress);
    float trailTopology = mix(1.0, step(0.0, p.x), neonStyle);
    float centerTrail = aaBand(p.x, 0.0, lineWidth * 0.65, aaWidth)
      * aaAbove(p.y, -0.42, aaWidth) * aaBelow(p.y, -0.29, aaWidth);
    float sideTrails = aaBand(a.x, 0.12, lineWidth * 0.58, aaWidth)
      * aaAbove(p.y, -0.38, aaWidth) * aaBelow(p.y, -0.3, aaWidth) * step(0.3, uDensity);
    float liftTrails = max(centerTrail, sideTrails) * trailTopology * step(0.32, uProgress);
    float alpha = max(diamondBadge, max(confirmationCheck, liftTrails));
    vec3 color = mix(uColorA, uColorB, max(confirmationCheck, liftTrails * uExpansion));
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`

export function createPfxMarkerReleaseMaterial(
  variant: 'ground' | 'badge',
  opacity: number,
  colorA: THREE.ColorRepresentation = '#f8fafc',
  colorB: THREE.ColorRepresentation = '#60a5fa',
  density = 0.4,
  styleEdgeHardness = 0.22,
): THREE.ShaderMaterial {
  const primary = new THREE.Color(colorA)
  const secondary = new THREE.Color(colorB)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uProgress: { value: 0 },
      uExpansion: { value: 0 },
      uDensity: { value: THREE.MathUtils.clamp(density, 0.05, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
      uColorA: { value: new THREE.Vector3(primary.r, primary.g, primary.b) },
      uColorB: { value: new THREE.Vector3(secondary.r, secondary.g, secondary.b) },
    },
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: PFX_MARKER_RELEASE_VERTEX,
    fragmentShader: variant === 'ground' ? PFX_MARKER_RELEASE_GROUND_FRAGMENT : PFX_MARKER_RELEASE_BADGE_FRAGMENT,
  })
  material.userData['pfxMarkerReleaseMaterial'] = true
  material.userData['pfxMarkerReleaseVariant'] = variant
  material.userData['pfxMarkerReleaseDrawCalls'] = 1
  material.userData['pfxMarkerReleaseTriangles'] = 2
  material.userData['pfxMarkerReleaseParticleCount'] = 0
  material.userData['pfxMarkerReleaseFragmentTextureSamples'] = 0
  material.userData['pfxMarkerReleaseTransientAllocationsPerFrame'] = 0
  material.userData['pfxMarkerReleaseMeshJustification'] = 'ground-clamp-plane-with-camera-facing-release-badge'
  return material
}

const PFX_SCAN_CONE_VERTEX = /* glsl */ `
  varying vec2 vScanUv;
  void main() {
    vScanUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const PFX_SCAN_CONE_FOOTPRINT_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uProgress;
  uniform float uSweep;
  uniform float uDensity;
  uniform float uStyleEdgeHardness;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vScanUv;
  float aaBelow(float value, float edge, float width) { return clamp((edge - value) / width + 0.5, 0.0, 1.0); }
  float aaAbove(float value, float edge, float width) { return 1.0 - aaBelow(value, edge, width); }
  float aaBand(float value, float center, float halfWidth, float width) { return 1.0 - clamp((abs(value - center) - halfWidth) / width, 0.0, 1.0); }
  void main() {
    vec2 p = vec2(0.9 - vScanUv.x, vScanUv.y - 0.5);
    float neonStyle = step(0.5, uStyleEdgeHardness);
    float edgeSoftness = mix(1.5, 0.72, neonStyle);
    float aaWidth = max((fwidth(p.x) + fwidth(p.y)) * 0.5 * edgeSoftness, 0.0015);
    float lineWidth = mix(0.026, 0.014, neonStyle);
    float range = clamp(p.x / 0.82, 0.0, 1.0);
    float halfWidth = max(0.018, range * 0.43);
    float coneMask = aaAbove(p.x, 0.0, aaWidth) * aaBelow(p.x, 0.82, aaWidth) * aaBelow(abs(p.y), halfWidth, aaWidth);
    float coneFootprint = coneMask * mix(0.08, 0.035, neonStyle) * aaBelow(range, mix(0.42, 1.0, uProgress), aaWidth);
    float sideRails = aaBand(abs(p.y), halfWidth, lineWidth, aaWidth) * aaAbove(p.x, 0.02, aaWidth) * aaBelow(p.x, 0.82, aaWidth);
    float endRail = aaBand(p.x, 0.82, lineWidth, aaWidth) * aaBelow(abs(p.y), 0.36, aaWidth);
    float boundaryRails = max(sideRails, endRail);
    float scanFront = aaBand(range, uSweep, lineWidth * 1.4, aaWidth) * coneMask * step(0.16, uProgress);
    float densityRails = max(aaBand(range, 0.38, lineWidth * 0.55, aaWidth), aaBand(range, 0.68, lineWidth * 0.55, aaWidth))
      * coneMask * step(0.3, uDensity);
    float originNotch = max(aaBand(p.x, 0.025, lineWidth, aaWidth) * aaBelow(abs(p.y), 0.085, aaWidth), aaBand(abs(p.y), 0.085, lineWidth, aaWidth) * aaBelow(p.x, 0.075, aaWidth));
    float topologyGate = mix(1.0, mix(0.38, 1.0, step(0.5, range)), neonStyle);
    float alpha = max(coneFootprint, max(originNotch, max(scanFront, max(boundaryRails * topologyGate, densityRails))));
    vec3 color = mix(uColorA, uColorB, max(scanFront, densityRails * uSweep));
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`

const PFX_SCAN_CONE_VOLUME_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uProgress;
  uniform float uSweep;
  uniform float uDensity;
  uniform float uStyleEdgeHardness;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vScanUv;
  float aaBelow(float value, float edge, float width) { return clamp((edge - value) / width + 0.5, 0.0, 1.0); }
  float aaAbove(float value, float edge, float width) { return 1.0 - aaBelow(value, edge, width); }
  float aaBand(float value, float center, float halfWidth, float width) { return 1.0 - clamp((abs(value - center) - halfWidth) / width, 0.0, 1.0); }
  void main() {
    vec2 p = vScanUv - vec2(0.5);
    float neonStyle = step(0.5, uStyleEdgeHardness);
    float edgeSoftness = mix(1.5, 0.72, neonStyle);
    float aaWidth = max((fwidth(p.x) + fwidth(p.y)) * 0.5 * edgeSoftness, 0.0015);
    float lineWidth = mix(0.028, 0.014, neonStyle);
    float edgeRails = max(aaBand(abs(p.x), 0.49, lineWidth, aaWidth), aaBand(abs(p.y), 0.49, lineWidth, aaWidth));
    float coneShell = max(edgeRails, mix(0.055, 0.022, neonStyle));
    float scanBand = aaBand(vScanUv.x, uSweep, lineWidth * 1.5, aaWidth) * step(0.16, uProgress);
    float dataRibs = max(aaBand(vScanUv.y, 0.34, lineWidth * 0.58, aaWidth), aaBand(vScanUv.y, 0.68, lineWidth * 0.58, aaWidth))
      * step(0.3, uDensity) * mix(1.0, step(0.5, vScanUv.x), neonStyle);
    float alpha = max(coneShell, max(scanBand, dataRibs));
    vec3 color = mix(uColorA, uColorB, max(scanBand, dataRibs * uSweep));
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`

export function createPfxScanConeMaterial(
  variant: 'footprint' | 'volume',
  opacity: number,
  colorA: THREE.ColorRepresentation = '#7fe3d2',
  colorB: THREE.ColorRepresentation = '#d8fff8',
  density = 0.4,
  styleEdgeHardness = 0.22,
): THREE.ShaderMaterial {
  const primary = new THREE.Color(colorA)
  const secondary = new THREE.Color(colorB)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uProgress: { value: 0 },
      uSweep: { value: 0 },
      uDensity: { value: THREE.MathUtils.clamp(density, 0.05, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
      uColorA: { value: new THREE.Vector3(primary.r, primary.g, primary.b) },
      uColorB: { value: new THREE.Vector3(secondary.r, secondary.g, secondary.b) },
    },
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: PFX_SCAN_CONE_VERTEX,
    fragmentShader: variant === 'footprint' ? PFX_SCAN_CONE_FOOTPRINT_FRAGMENT : PFX_SCAN_CONE_VOLUME_FRAGMENT,
  })
  material.userData['pfxScanConeMaterial'] = true
  material.userData['pfxScanConeVariant'] = variant
  material.userData['pfxScanConeDrawCalls'] = 1
  material.userData['pfxScanConeTriangles'] = variant === 'volume' ? 24 : 2
  material.userData['pfxScanConeParticleCount'] = 0
  material.userData['pfxScanConeFragmentTextureSamples'] = 0
  material.userData['pfxScanConeTransientAllocationsPerFrame'] = 0
  material.userData['pfxScanConeMeshJustification'] = 'partial-cone-shell-proves-scan-volume-and-side-view-parallax'
  return material
}

const PFX_HOLOGRAM_BREAK_VERTEX = /* glsl */ `
  varying vec2 vHoloUv;
  void main() {
    vHoloUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const PFX_HOLOGRAM_BREAK_FIGURE_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uProgress;
  uniform float uBreakAmount;
  uniform float uScan;
  uniform float uCollapse;
  uniform float uDensity;
  uniform float uStyleEdgeHardness;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vHoloUv;
  float sdBox(vec2 point, vec2 bounds) {
    vec2 delta = abs(point) - bounds;
    return length(max(delta, 0.0)) + min(max(delta.x, delta.y), 0.0);
  }
  void main() {
    vec2 p = vHoloUv - vec2(0.5);
    p.x *= 1.12;
    float neonStyle = step(0.5, uStyleEdgeHardness);
    float aaWidth = max((fwidth(p.x) + fwidth(p.y)) * mix(1.4, 0.72, neonStyle), 0.0015);
    float sliceId = floor((p.y + 0.5) * 11.0);
    float sliceNoise = fract(sliceId * 0.618 + 0.17) - 0.5;
    float sliceOffset = sliceNoise * uBreakAmount * mix(0.16, 0.22, neonStyle);
    p.x -= sliceOffset;
    float head = length(p - vec2(0.0, 0.29)) - 0.105;
    float shoulders = sdBox(p - vec2(0.0, 0.12), vec2(0.245, 0.055));
    float torso = sdBox(p - vec2(0.0, -0.015), vec2(0.155, 0.19));
    float leftArm = sdBox(p - vec2(-0.22, -0.04), vec2(0.047, 0.205));
    float rightArm = sdBox(p - vec2(0.22, -0.04), vec2(0.047, 0.205));
    float leftLeg = sdBox(p - vec2(-0.085, -0.31), vec2(0.062, 0.155));
    float rightLeg = sdBox(p - vec2(0.085, -0.31), vec2(0.062, 0.155));
    float figureDistance = min(head, min(shoulders, min(torso, min(leftArm, min(rightArm, min(leftLeg, rightLeg))))));
    float hologramFigure = 1.0 - smoothstep(-aaWidth, aaWidth, figureDistance);
    float figureOutline = 1.0 - smoothstep(aaWidth, aaWidth * mix(3.8, 2.2, neonStyle), abs(figureDistance));
    float scanLines = mix(0.42, 0.72, step(mix(0.28, 0.52, uDensity), fract((vHoloUv.y + uScan * 0.08) * mix(18.0, 25.0, neonStyle))));
    vec2 cell = floor(vHoloUv * vec2(14.0, 20.0));
    float cellHash = fract(cell.x * 0.37 + cell.y * 0.61);
    float fractureLoss = step(cellHash, uBreakAmount * mix(0.34, 0.5, neonStyle)) * step(uScan - 0.12, vHoloUv.y);
    float collapseMask = smoothstep(uCollapse * 1.18 - 0.18, uCollapse * 1.18 - 0.1 + aaWidth, vHoloUv.y);
    float fragmentCells = step(0.82 - uDensity * 0.12, cellHash) * step(abs(figureDistance), 0.075 + uBreakAmount * 0.09)
      * step(0.08, uBreakAmount) * (1.0 - hologramFigure) * collapseMask;
    float body = hologramFigure * max(figureOutline, scanLines * mix(0.48, 0.28, neonStyle)) * (1.0 - fractureLoss * 0.82) * collapseMask;
    float scanFront = (1.0 - smoothstep(0.018, 0.04, abs(vHoloUv.y - (1.0 - uScan)))) * hologramFigure;
    float alpha = max(body, max(fragmentCells * 0.78, scanFront));
    vec3 color = mix(uColorA, uColorB, max(scanFront, figureOutline * 0.62));
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`

const PFX_HOLOGRAM_BREAK_PROJECTOR_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uProgress;
  uniform float uBreakAmount;
  uniform float uScan;
  uniform float uCollapse;
  uniform float uDensity;
  uniform float uStyleEdgeHardness;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vHoloUv;
  float band(float value, float center, float halfWidth, float width) {
    return 1.0 - clamp((abs(value - center) - halfWidth) / width, 0.0, 1.0);
  }
  void main() {
    vec2 p = vHoloUv - vec2(0.5);
    float neonStyle = step(0.5, uStyleEdgeHardness);
    float aaWidth = max((fwidth(p.x) + fwidth(p.y)) * mix(1.45, 0.75, neonStyle), 0.0015);
    float diamondDistance = abs(p.x) + abs(p.y);
    float projectorDiamond = band(diamondDistance, 0.34, mix(0.025, 0.014, neonStyle), aaWidth);
    float cornerGate = step(0.18, max(abs(p.x), abs(p.y)));
    float bracketX = band(abs(p.x), 0.31, mix(0.035, 0.018, neonStyle), aaWidth) * step(abs(p.y), 0.19);
    float bracketY = band(abs(p.y), 0.31, mix(0.035, 0.018, neonStyle), aaWidth) * step(abs(p.x), 0.19);
    float brokenBrackets = max(bracketX, bracketY) * cornerGate;
    float centerCross = max(band(p.x, 0.0, 0.014, aaWidth), band(p.y, 0.0, 0.014, aaWidth)) * step(diamondDistance, 0.24);
    float traceHash = fract(floor((p.x + 0.5) * 13.0) * 0.47 + floor((p.y + 0.5) * 13.0) * 0.73);
    float collapseTrace = step(0.72 - uDensity * 0.15, traceHash) * band(diamondDistance, mix(0.08, 0.3, uCollapse), 0.025, aaWidth);
    float fractureGate = mix(1.0, step(0.38, traceHash), uBreakAmount * mix(0.45, 0.72, neonStyle));
    float alpha = max((projectorDiamond * fractureGate), max(brokenBrackets, max(centerCross * (1.0 - uCollapse), collapseTrace)));
    alpha *= mix(0.48, 1.0, uProgress) * (1.0 - uCollapse * 0.55);
    vec3 color = mix(uColorA, uColorB, max(centerCross, collapseTrace));
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`

export function createPfxHologramBreakMaterial(
  variant: 'figure' | 'projector',
  opacity: number,
  colorA: THREE.ColorRepresentation = '#8cf5ff',
  colorB: THREE.ColorRepresentation = '#eefcff',
  density = 0.55,
  styleEdgeHardness = 0.22,
): THREE.ShaderMaterial {
  const primary = new THREE.Color(colorA)
  const secondary = new THREE.Color(colorB)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uProgress: { value: 0 },
      uBreakAmount: { value: 0 },
      uScan: { value: 0 },
      uCollapse: { value: 0 },
      uDensity: { value: THREE.MathUtils.clamp(density, 0.05, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
      uColorA: { value: new THREE.Vector3(primary.r, primary.g, primary.b) },
      uColorB: { value: new THREE.Vector3(secondary.r, secondary.g, secondary.b) },
    },
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: PFX_HOLOGRAM_BREAK_VERTEX,
    fragmentShader: variant === 'figure' ? PFX_HOLOGRAM_BREAK_FIGURE_FRAGMENT : PFX_HOLOGRAM_BREAK_PROJECTOR_FRAGMENT,
  })
  material.userData['pfxHologramBreakMaterial'] = true
  material.userData['pfxHologramBreakVariant'] = variant
  material.userData['pfxHologramBreakDrawCalls'] = 1
  material.userData['pfxHologramBreakTriangles'] = 2
  material.userData['pfxHologramBreakParticleCount'] = 0
  material.userData['pfxHologramBreakFragmentTextureSamples'] = 0
  material.userData['pfxHologramBreakTransientAllocationsPerFrame'] = 0
  material.userData['pfxHologramBreakMeshJustification'] = 'camera-facing-sliced-figure-with-grounded-projector-quad'
  return material
}

const PFX_THRUSTER_TRAIL_VERTEX = /* glsl */ `
  uniform float uFlow;
  uniform float uThrust;
  varying vec2 vThrusterUv;
  varying vec3 vThrusterNormal;
  varying vec3 vThrusterView;
  void main() {
    float ripple = 1.0 - abs(fract(uv.y * 5.0 - uFlow * 2.0) * 2.0 - 1.0);
    float tailEnvelope = 4.0 * uv.y * (1.0 - uv.y);
    vec3 animatedPosition = position + normal * (ripple - 0.5) * tailEnvelope * uThrust * 0.075;
    vec4 worldPosition = modelMatrix * vec4(animatedPosition, 1.0);
    vThrusterUv = uv;
    vThrusterNormal = normalize(mat3(modelMatrix) * normal);
    vThrusterView = normalize(cameraPosition - worldPosition.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const PFX_THRUSTER_TRAIL_PLUME_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uProgress;
  uniform float uFlow;
  uniform float uThrust;
  uniform float uCutoff;
  uniform float uDensity;
  uniform float uStyleEdgeHardness;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vThrusterUv;
  varying vec3 vThrusterNormal;
  varying vec3 vThrusterView;
  void main() {
    float neonStyle = step(0.5, uStyleEdgeHardness);
    float sourceHeat = 1.0 - vThrusterUv.y;
    float rim = pow(1.0 - abs(dot(normalize(vThrusterNormal), normalize(vThrusterView))), mix(1.15, 1.9, neonStyle));
    float laneId = floor(vThrusterUv.x * 12.0);
    float laneOffset = fract(laneId * 0.37 + 0.13);
    float compressionPhase = abs(fract(vThrusterUv.y * mix(3.2, 4.4, neonStyle) - uFlow * 2.6 + laneOffset * 0.34) - 0.5) * 2.0;
    float arcGate = step(mix(0.34, 0.48, neonStyle), fract(laneOffset + floor(vThrusterUv.y * 4.0) * 0.31));
    float travelingCompression = smoothstep(mix(0.56, 0.7, neonStyle), 1.0, 1.0 - compressionPhase) * arcGate * mix(0.5, 1.0, sourceHeat);
    float laneHash = fract(laneId * 0.37 + floor(vThrusterUv.y * 8.0) * 0.61);
    float cutoffErosion = step(laneHash, uCutoff * mix(0.62, 0.78, neonStyle)) * step(sourceHeat, 0.78);
    float coherentCore = smoothstep(0.2, 0.86, sourceHeat) * mix(0.12, 0.24, uThrust);
    float axialStreaks = step(mix(0.58, 0.46, uDensity), laneOffset) * smoothstep(0.08, 0.72, sourceHeat) * (1.0 - compressionPhase * 0.35);
    float volumetricPlume = max(rim * mix(0.3, 0.5, uThrust), coherentCore + travelingCompression * 0.34 + axialStreaks * 0.16);
    float tailFade = smoothstep(0.0, 0.16, vThrusterUv.y) * smoothstep(0.0, 0.12, sourceHeat);
    float ignitionLength = mix(0.14, 1.08, uThrust);
    float ignitionMask = 1.0 - smoothstep(ignitionLength, ignitionLength + 0.08, vThrusterUv.y);
    float cutoffFront = 1.02 - uCutoff * 0.92;
    float directionalCutoff = 1.0 - smoothstep(cutoffFront, cutoffFront + 0.08, vThrusterUv.y);
    float alpha = volumetricPlume * tailFade * ignitionMask * directionalCutoff * (1.0 - cutoffErosion * 0.82);
    vec3 color = mix(uColorA, uColorB, clamp(sourceHeat * 0.82 + travelingCompression * 0.35, 0.0, 1.0));
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`

const PFX_THRUSTER_TRAIL_NOZZLE_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uProgress;
  uniform float uFlow;
  uniform float uThrust;
  uniform float uCutoff;
  uniform float uDensity;
  uniform float uStyleEdgeHardness;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vThrusterUv;
  float band(float value, float center, float halfWidth, float width) {
    return 1.0 - clamp((abs(value - center) - halfWidth) / width, 0.0, 1.0);
  }
  void main() {
    vec2 p = vThrusterUv - vec2(0.5);
    float neonStyle = step(0.5, uStyleEdgeHardness);
    float aaWidth = max((fwidth(p.x) + fwidth(p.y)) * mix(1.4, 0.72, neonStyle), 0.0015);
    float radius = length(p);
    float nozzleAperture = band(radius, 0.34, mix(0.045, 0.024, neonStyle), aaWidth);
    float outerCollar = (1.0 - smoothstep(0.31, 0.43, radius)) * smoothstep(0.2, 0.31, radius);
    float hotCore = 1.0 - smoothstep(0.0, mix(0.19, 0.13, neonStyle), radius);
    float vaneWidth = mix(0.026, 0.015, neonStyle);
    float vaneA = band(p.y, 0.0, vaneWidth, aaWidth);
    float vaneB = band(p.x * 0.866 + p.y * 0.5, 0.0, vaneWidth, aaWidth);
    float vaneC = band(p.x * 0.866 - p.y * 0.5, 0.0, vaneWidth, aaWidth);
    float triVanes = max(vaneA, max(vaneB, vaneC)) * step(0.11, radius) * step(radius, 0.3);
    float alpha = max(nozzleAperture, max(outerCollar * 0.34, max(hotCore * mix(0.72, 1.0, uThrust), triVanes * step(0.3, uDensity)))) * (1.0 - uCutoff * 0.48);
    vec3 color = mix(uColorA * mix(0.28, 0.48, outerCollar), uColorB, max(hotCore, triVanes * 0.58));
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`

export function createPfxThrusterTrailMaterial(
  variant: 'plume' | 'nozzle',
  opacity: number,
  colorA: THREE.ColorRepresentation = '#ff5a1f',
  colorB: THREE.ColorRepresentation = '#fff2cc',
  density = 0.55,
  styleEdgeHardness = 0.22,
): THREE.ShaderMaterial {
  const primary = new THREE.Color(colorA)
  const secondary = new THREE.Color(colorB).lerp(new THREE.Color('#ffffff'), 0.68)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uProgress: { value: 0 },
      uFlow: { value: 0 },
      uThrust: { value: 0 },
      uCutoff: { value: 0 },
      uDensity: { value: THREE.MathUtils.clamp(density, 0.05, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
      uColorA: { value: new THREE.Vector3(primary.r, primary.g, primary.b) },
      uColorB: { value: new THREE.Vector3(secondary.r, secondary.g, secondary.b) },
    },
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: PFX_THRUSTER_TRAIL_VERTEX,
    fragmentShader: variant === 'plume' ? PFX_THRUSTER_TRAIL_PLUME_FRAGMENT : PFX_THRUSTER_TRAIL_NOZZLE_FRAGMENT,
  })
  material.userData['pfxThrusterTrailMaterial'] = true
  material.userData['pfxThrusterTrailVariant'] = variant
  material.userData['pfxThrusterTrailDrawCalls'] = 1
  material.userData['pfxThrusterTrailTriangles'] = variant === 'plume' ? 144 : 12
  material.userData['pfxThrusterTrailParticleCount'] = 0
  material.userData['pfxThrusterTrailFragmentTextureSamples'] = 0
  material.userData['pfxThrusterTrailTransientAllocationsPerFrame'] = 0
  material.userData['pfxThrusterTrailMeshJustification'] = 'closed-tapered-plume-with-source-nozzle-aperture'
  return material
}

const PFX_EXHAUST_TELEGRAPH_VERTEX = /* glsl */ `
  varying vec2 vExhaustUv;
  void main() {
    vExhaustUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const PFX_EXHAUST_TELEGRAPH_LANE_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uProgress;
  uniform float uUrgency;
  uniform float uVentOpen;
  uniform float uRelease;
  uniform float uDensity;
  uniform float uStyleEdgeHardness;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vExhaustUv;
  float band(float value, float center, float halfWidth, float width) {
    return 1.0 - clamp((abs(value - center) - halfWidth) / width, 0.0, 1.0);
  }
  void main() {
    vec2 p = vExhaustUv - vec2(0.5);
    float neonStyle = step(0.5, uStyleEdgeHardness);
    float aaWidth = max(fwidth(p.x + p.y) * mix(1.4, 0.78, neonStyle), 0.0015);
    float halfWidth = mix(0.13, 0.34, vExhaustUv.x);
    float lengthGate = step(abs(p.x), 0.475);
    float directionalLane = step(abs(p.y), halfWidth) * lengthGate;
    float sideRail = band(abs(p.y), halfWidth, mix(0.018, 0.011, neonStyle), aaWidth) * lengthGate;
    float endCaps = band(abs(p.x), 0.455, mix(0.016, 0.01, neonStyle), aaWidth) * step(abs(p.y), halfWidth);
    float stableDangerBoundary = max(sideRail, endCaps);

    float cozyChevronCount = mix(3.5, 4.5, uDensity);
    float neonChevronCount = mix(cozyChevronCount, mix(5.0, 7.0, uDensity), neonStyle);
    float chevronCell = fract(vExhaustUv.x * neonChevronCount);
    float chevronSlope = abs(chevronCell - 0.5) * halfWidth * 1.45 + halfWidth * 0.12;
    float cautionChevrons = band(abs(p.y), chevronSlope, mix(0.026, 0.015, neonStyle), aaWidth);
    cautionChevrons *= step(0.06, vExhaustUv.x) * step(vExhaustUv.x, 0.84) * step(abs(p.y), halfWidth - 0.02);

    float countdownCount = mix(3.0, 6.0, neonStyle);
    float segmentIndex = floor(vExhaustUv.x * countdownCount);
    float segmentGate = step(segmentIndex + 0.25, uUrgency * countdownCount);
    float segmentCell = fract(vExhaustUv.x * countdownCount);
    float segmentBody = step(0.12, segmentCell) * step(segmentCell, 0.82) * segmentGate * directionalLane;
    float cozyCenterBars = segmentBody * step(abs(p.y), halfWidth * 0.46);
    float neonCountdownRails = segmentBody * band(abs(p.y), halfWidth * 0.68, 0.012, aaWidth);
    float countdownSegments = mix(cozyCenterBars, neonCountdownRails, neonStyle);

    float notchX = band(p.x, 0.37, 0.038, aaWidth);
    float sourceLockNotch = notchX * step(halfWidth * 0.24, abs(p.y)) * step(abs(p.y), halfWidth * 0.72);
    float cozyFill = directionalLane * mix(0.16, 0.3, uUrgency) * (1.0 - uRelease);
    float neonFill = directionalLane * mix(0.035, 0.09, uUrgency) * (1.0 - uRelease);
    float interior = mix(cozyFill, neonFill, neonStyle);
    float alpha = max(stableDangerBoundary, max(cautionChevrons * mix(0.62, 0.96, uUrgency), max(countdownSegments, sourceLockNotch))) + interior;
    vec3 color = mix(uColorA, uColorB, max(countdownSegments, sourceLockNotch));
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`

const PFX_EXHAUST_TELEGRAPH_VENT_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uProgress;
  uniform float uUrgency;
  uniform float uVentOpen;
  uniform float uRelease;
  uniform float uDensity;
  uniform float uStyleEdgeHardness;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vExhaustUv;
  float band(float value, float center, float halfWidth, float width) {
    return 1.0 - clamp((abs(value - center) - halfWidth) / width, 0.0, 1.0);
  }
  void main() {
    vec2 p = vExhaustUv - vec2(0.5);
    float neonStyle = step(0.5, uStyleEdgeHardness);
    float aaWidth = max(fwidth(p.x + p.y) * mix(1.5, 0.8, neonStyle), 0.0015);
    float radius = length(p);
    float ventAperture = band(radius, 0.34, mix(0.045, 0.024, neonStyle), aaWidth);
    float collar = band(radius, 0.43, mix(0.025, 0.014, neonStyle), aaWidth);
    float shutterOffset = mix(0.055, 0.24, uVentOpen);
    float shutterX = band(abs(p.x), shutterOffset, 0.035, aaWidth) * step(abs(p.y), 0.27);
    float shutterY = band(abs(p.y), shutterOffset, 0.035, aaWidth) * step(abs(p.x), 0.27);
    float neonCrossShutters = max(shutterX, shutterY);
    vec2 diamondP = vec2(p.x + p.y, p.x - p.y) * 0.7071;
    float diamondX = band(abs(diamondP.x), shutterOffset, 0.06, aaWidth) * step(abs(diamondP.y), 0.27);
    float diamondY = band(abs(diamondP.y), shutterOffset, 0.06, aaWidth) * step(abs(diamondP.x), 0.27);
    float cozyDiamondShutters = max(diamondX, diamondY);
    float mechanicalShutters = mix(cozyDiamondShutters, neonCrossShutters, neonStyle) * step(radius, 0.31);
    float pressureCore = (1.0 - smoothstep(0.0, mix(0.03, 0.18, uRelease), radius)) * mix(0.15, 1.0, uUrgency);
    float releaseGate = step(0.01, uRelease);
    float tickAngle = max(abs(p.x), abs(p.y));
    float cardinalTicks = band(tickAngle, 0.36, 0.018, aaWidth) * step(radius, 0.42);
    float alpha = max(ventAperture, max(collar * 0.7, max(mechanicalShutters * (1.0 - uRelease * 0.65), max(cardinalTicks, pressureCore * releaseGate))));
    vec3 coldMetal = mix(vec3(0.22, 0.25, 0.3), uColorA, 0.72);
    float hotSignal = max(pressureCore * releaseGate, max(ventAperture * mix(0.16, 0.42, uUrgency), cardinalTicks * 0.24));
    vec3 color = mix(coldMetal, uColorB, hotSignal);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`

export function createPfxExhaustTelegraphMaterial(
  variant: 'lane' | 'vent',
  opacity: number,
  colorA: THREE.ColorRepresentation = '#ff8a3d',
  colorB: THREE.ColorRepresentation = '#fff0c2',
  density = 0.55,
  styleEdgeHardness = 0.22,
): THREE.ShaderMaterial {
  const primary = new THREE.Color(colorA)
  const secondary = new THREE.Color(colorB).lerp(new THREE.Color('#ffffff'), 0.35)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uProgress: { value: 0 },
      uUrgency: { value: 0 },
      uVentOpen: { value: 0 },
      uRelease: { value: 0 },
      uDensity: { value: THREE.MathUtils.clamp(density, 0.05, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
      uColorA: { value: new THREE.Vector3(primary.r, primary.g, primary.b) },
      uColorB: { value: new THREE.Vector3(secondary.r, secondary.g, secondary.b) },
    },
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: PFX_EXHAUST_TELEGRAPH_VERTEX,
    fragmentShader: variant === 'lane' ? PFX_EXHAUST_TELEGRAPH_LANE_FRAGMENT : PFX_EXHAUST_TELEGRAPH_VENT_FRAGMENT,
  })
  material.userData['pfxExhaustTelegraphMaterial'] = true
  material.userData['pfxExhaustTelegraphVariant'] = variant
  material.userData['pfxExhaustTelegraphDrawCalls'] = 1
  material.userData['pfxExhaustTelegraphTriangles'] = variant === 'lane' ? 2 : 48
  material.userData['pfxExhaustTelegraphParticleCount'] = 0
  material.userData['pfxExhaustTelegraphFragmentTextureSamples'] = 0
  material.userData['pfxExhaustTelegraphTransientAllocationsPerFrame'] = 0
  material.userData['pfxExhaustTelegraphMeshJustification'] = 'stable-directional-danger-lane-with-mechanical-source-vent'
  return material
}

export const PFX_FLAME_BURST_VERTEX = /* glsl */ `
  uniform float uBloom;
  uniform float uPeel;
  uniform float uDensity;
  uniform float uStyleEdgeHardness;
  attribute float aTongueId;
  varying vec2 vFlameBurstUv;
  varying float vTongueId;
  varying vec3 vFlameBurstNormal;
  varying vec3 vFlameBurstView;
  void main() {
    float neonStyle = step(0.5, uStyleEdgeHardness);
    float topWeight = smoothstep(0.18, 1.0, uv.y);
    float tongueOrder = aTongueId * 0.25;
    float sequentialPeel = clamp((uPeel - tongueOrder * 0.1) / 0.62, 0.0, 1.0);
    float synchronizedPeel = uPeel;
    float peelAmount = mix(sequentialPeel, synchronizedPeel, neonStyle);
    vec2 peelDirection = vec2(0.12, -0.08);
    if (aTongueId > 0.5 && aTongueId < 1.5) peelDirection = vec2(-0.94, 0.2);
    if (aTongueId > 1.5 && aTongueId < 2.5) peelDirection = vec2(0.92, -0.28);
    if (aTongueId > 2.5 && aTongueId < 3.5) peelDirection = vec2(-0.24, 0.92);
    if (aTongueId > 3.5) peelDirection = vec2(0.3, -0.88);
    vec3 animatedPosition = position;
    float breadth = mix(1.12, 0.86, neonStyle) * mix(0.9, 1.08, uDensity);
    animatedPosition.xz *= mix(0.16, breadth, uBloom);
    animatedPosition.y *= mix(0.22, 1.0, uBloom);
    float tongueWeight = mix(0.24, 1.0, topWeight);
    animatedPosition.xz += peelDirection * peelAmount * tongueWeight * mix(0.78, 1.02, neonStyle);
    animatedPosition.y += peelAmount * tongueWeight * mix(0.16, 0.3, neonStyle);
    vec4 worldPosition = modelMatrix * vec4(animatedPosition, 1.0);
    vFlameBurstUv = uv;
    vTongueId = aTongueId;
    vFlameBurstNormal = normalize(mat3(modelMatrix) * normal);
    vFlameBurstView = normalize(cameraPosition - worldPosition.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

export function isPfxOmniLightRead(tuning: PfxSurfaceTuning | undefined): boolean {
  const read = tuning?.meshMotion
  return read === 'flash' || read === 'glow' || read === 'charge'
}

let sharedPlasmaImpactFlipbookTexture: THREE.Texture | undefined

export function getPfxPlasmaImpactFlipbookTexture(): THREE.Texture {
  if (sharedPlasmaImpactFlipbookTexture) return sharedPlasmaImpactFlipbookTexture
  const texture = new THREE.TextureLoader().load(PFX_PLASMA_IMPACT_FLIPBOOK_ATLAS.dataUri)
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.colorSpace = THREE.SRGBColorSpace
  texture.userData = {
    pfxFlipbookAtlas: PFX_PLASMA_IMPACT_FLIPBOOK_ATLAS.id,
    pfxFlipbookLicense: PFX_PLASMA_IMPACT_FLIPBOOK_ATLAS.license,
    pfxFlipbookFrames: PFX_PLASMA_IMPACT_FLIPBOOK_ATLAS.frameCount,
    pfxFlipbookRuntimeBytes: PFX_PLASMA_IMPACT_FLIPBOOK_ATLAS.runtimeBytes,
  }
  sharedPlasmaImpactFlipbookTexture = texture
  return texture
}

export function markPfxReferenceAdaptationMaterial(
  material: THREE.ShaderMaterial,
  source: string,
  adaptation: string,
): THREE.ShaderMaterial {
  material.userData['pfxReferenceSource'] = source
  material.userData['pfxReferenceAdaptation'] = adaptation
  material.userData['pfxReferenceLicense'] = 'repo-original-procedural-closed-mesh'
  return material
}

function pfxGradientAlphaAt(kind: PfxGradientTextureKind, nx: number, ny: number): number {
  const radius = Math.hypot(nx, ny)
  const x01 = (nx + 1) / 2
  const y01 = (ny + 1) / 2
  switch (kind) {
    case 'radial-glow': {
      const falloff = Math.pow(Math.max(0, 1 - radius), 1.7)
      const core = Math.pow(Math.max(0, 1 - radius * 2.4), 2) * 0.85
      return Math.min(1, falloff + core)
    }
    case 'ring-glow': {
      // Thin, crisp band — a wide gaussian here reads as a smoke donut on
      // every ring surface in the library (adversarial review finding).
      const ringDistance = Math.abs(radius - 0.72)
      const band = Math.exp(-(ringDistance * ringDistance) / 0.0018)
      const innerHaze = Math.pow(Math.max(0, 1 - radius / 0.72), 2.4) * 0.05
      return Math.min(1, band + innerHaze)
    }
    case 'soft-smoke': {
      const body = Math.pow(Math.max(0, 1 - radius), 1.35)
      const ripple = 0.86 + 0.14 * Math.sin(nx * 9.2) * Math.cos(ny * 7.6)
      return Math.min(1, body * ripple)
    }
    case 'trail-fade': {
      const along = Math.pow(Math.max(0, 1 - x01), 1.4)
      const across = Math.pow(Math.max(0, 1 - Math.abs(ny)), 1.6)
      return along * across
    }
    case 'beam-fade': {
      const alongBeam = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, y01))), 0.85)
      return alongBeam
    }
    case 'screen-vignette': {
      const edge = Math.min(1, Math.max(0, (radius - 0.34) / 0.66))
      return Math.pow(edge, 1.55)
    }
  }
}

export function getPfxSharedGradientTexture(kind: PfxGradientTextureKind): THREE.DataTexture {
  const cached = sharedGradientTextureCache.get(kind)
  if (cached) return cached
  const size = 128
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / (size - 1)) * 2 - 1
      const ny = (y / (size - 1)) * 2 - 1
      const alpha = Math.min(1, Math.max(0, pfxGradientAlphaAt(kind, nx, ny)))
      const index = (y * size + x) * 4
      data[index] = 255
      data[index + 1] = 255
      data[index + 2] = 255
      data[index + 3] = Math.round(alpha * 255)
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  sharedGradientTextureCache.set(kind, texture)
  return texture
}

export const PFX_SPRITE_PARTICLE_FRAGMENT = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec2 uUvOffset;
uniform vec2 uUvScale;
uniform vec2 uUvCellStep;
uniform float uVariantCount;
uniform float uVariantColumns;
uniform float uVariantStartIndex;
uniform float uVariantRowDirection;
uniform float uLifetime;
uniform float uFlipbookColumns;
uniform float uFlipbookRows;
uniform float uFlipbookFrameCount;
uniform float uFlipbookFrameRate;
uniform float uFlipbookTemperatureGrade;
uniform float uFlipbookTurbulentCells;
uniform vec3 uColorHot;
uniform vec3 uColorBase;
uniform vec3 uColorTail;
uniform float uOpacity;
uniform vec2 uFadeWindow;
uniform float uAlphaGamma;
uniform float uSpriteColorMix;
uniform float uTailSnap;
uniform float uAdditiveShrinkF;
uniform float uBands;
uniform float uErode;

varying vec2 vUv;
varying float vProgress;
varying float vBrightness;
varying float vFlicker;
varying float vVariant;
varying float vChargeEnvelope;

void main() {
  float variantIndex = uVariantStartIndex + floor(min(vVariant, 0.9999) * uVariantCount);
  float variantColumn = mod(variantIndex, uVariantColumns);
  float variantRow = floor(variantIndex / uVariantColumns);
  vec2 variantOffset = vec2(variantColumn, variantRow * uVariantRowDirection) * uUvCellStep;
  float flipbookFrame = 0.0;
  vec4 sprite;
  if (uFlipbookFrameCount > 1.5) {
    // Each particle advances at the authored rate from its own age. A stable
    // variant phase prevents a stack of identical flames from pulsing in lockstep.
    flipbookFrame = floor(mod(vProgress * uLifetime * uFlipbookFrameRate + floor(vVariant * 11.0), uFlipbookFrameCount));
    float flipbookColumn = mod(flipbookFrame, uFlipbookColumns);
    float flipbookRow = floor(flipbookFrame / uFlipbookColumns);
    vec2 flipbookCell = vec2(1.0 / uFlipbookColumns, 1.0 / uFlipbookRows);
    vec2 flipbookOrigin = vec2(flipbookColumn, uFlipbookRows - 1.0 - flipbookRow) * flipbookCell;
    vec2 flipbookUv = flipbookOrigin + mix(vec2(0.018), vec2(0.982), vUv) * flipbookCell;
    sprite = texture2D(uAtlas, flipbookUv);
  } else {
    sprite = texture2D(uAtlas, uUvOffset + variantOffset + vUv * uUvScale);
  }
  #ifdef MOTION_DANGER_PULSE
    // Analytic, antialiased blood marks avoid magnifying the generic atlas
    // splat into a blocky repeated stamp. vVariant shifts the body, lobe and
    // satellite layout per fleck while normalized life grows a gravity-led
    // drip, creating genuine local evolution inside the persistent loop.
    vec2 bloodP = vUv * 2.0 - 1.0;
    float bloodSeed = fract(vVariant * 17.731 + 0.137);
    float bloodShift = (bloodSeed - 0.5) * 0.24;
    float bloodMain = 1.0 - smoothstep(0.72, 0.84, length(vec2((bloodP.x - bloodShift) / 0.76, (bloodP.y - 0.2) / 0.58)));
    float bloodLobe = 1.0 - smoothstep(0.42, 0.55, length(vec2((bloodP.x + 0.32 - bloodShift * 0.4) / 0.7, (bloodP.y - 0.08) / 0.84)));
    float bloodStreak = 1.0 - smoothstep(0.7, 0.84, length(vec2((bloodP.x - bloodShift) / 0.34, (bloodP.y + 0.04) / 0.92)));
    float bloodPool = 1.0 - smoothstep(0.68, 0.82, length(vec2((bloodP.x - bloodShift) / 0.92, (bloodP.y - 0.14) / 0.42)));
    float bodyFamilyA = 1.0 - step(0.34, bloodSeed);
    float bodyFamilyB = step(0.34, bloodSeed) * (1.0 - step(0.68, bloodSeed));
    float bodyFamilyC = step(0.68, bloodSeed);
    float bloodBody = max(bloodMain, bloodLobe * 0.82) * bodyFamilyA
      + max(bloodStreak, bloodLobe * 0.55) * bodyFamilyB
      + max(bloodPool, bloodLobe * 0.68) * bodyFamilyC;
    float dripGrowth = smoothstep(0.08, 0.72, vProgress);
    float dripReach = mix(0.12, 0.88, dripGrowth) * (0.82 + bloodSeed * 0.18);
    float dripT = clamp((-bloodP.y + 0.08) / max(0.2, dripReach), 0.0, 1.0);
    float dripWidth = mix(0.15, 0.035, dripT);
    float bloodDrip = (1.0 - smoothstep(dripWidth, dripWidth + 0.045, abs(bloodP.x - bloodShift * 0.55)))
      * smoothstep(-dripReach - 0.06, -dripReach, bloodP.y)
      * (1.0 - smoothstep(0.08, 0.18, bloodP.y));
    vec2 satelliteCenter = vec2(mix(-0.68, 0.7, bloodSeed), mix(-0.12, 0.5, fract(bloodSeed * 5.31)));
    float bloodSatellite = 1.0 - smoothstep(0.08, 0.13, length(bloodP - satelliteCenter));
    sprite = vec4(vec3(1.0), clamp(max(max(bloodBody, bloodDrip), bloodSatellite * 0.85), 0.0, 1.0));
  #endif
  // Border fade: sprite content touching the cell edge renders hard
  // rectangle edges on rotated/stretched quads.
  float borderFade = smoothstep(0.0, 0.09, vUv.x) * smoothstep(1.0, 0.91, vUv.x) *
    smoothstep(0.0, 0.09, vUv.y) * smoothstep(1.0, 0.91, vUv.y);
  sprite.a *= borderFade;
  // Preserve the source animation's internal heat detail without allowing
  // its white core to flatten into an overexposed patch. The highest value
  // resolves to gold, not white; red and orange retain the turbulent edge.
  if (uFlipbookTemperatureGrade > 0.5) {
    vec2 fireballCenteredUv = vec2(vUv.x - 0.5, (vUv.y - 0.5) * 0.82) * 2.0;
    float fireballRadialSoftness = 1.0 - smoothstep(0.7, 1.12, length(fireballCenteredUv));
    // The CC0 fireball sheet contains a few hard angular wisps. Preserve its
    // turbulent internal heat while feathering those card-shaped extremes so
    // a small 3D cluster reads as billowing flame rather than a starburst.
    sprite.a *= mix(1.0, fireballRadialSoftness, 0.58);
    float flameHeat = clamp(dot(sprite.rgb, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
    float flameCellNoise = 0.5
      + 0.25 * sin(vUv.x * 31.0 + vUv.y * 13.0 + vProgress * 9.0 + vVariant * 17.0)
      + 0.25 * sin(vUv.y * 27.0 - vUv.x * 11.0 - vProgress * 7.0 + vVariant * 23.0);
    flameCellNoise = clamp(flameCellNoise, 0.0, 1.0);
    flameHeat *= mix(1.0, 0.7 + flameCellNoise * 0.3, uFlipbookTurbulentCells);
    vec3 flameRed = vec3(0.58, 0.025, 0.002);
    vec3 flameOrange = vec3(1.0, 0.2, 0.008);
    vec3 flameGold = vec3(1.0, 0.58, 0.075);
    vec3 gradedFlame = mix(flameRed, flameOrange, smoothstep(0.04, 0.46, flameHeat));
    gradedFlame = mix(gradedFlame, flameGold, smoothstep(0.46, 0.94, flameHeat));
    sprite.rgb = mix(sprite.rgb, gradedFlame, 0.86);
  }
  // Erosion death: matter breaks apart through chunky cells whose survival
  // threshold rises over life — consumed, not ghost-faded. Value and
  // saturation drop with the erosion below.
  float erodeCut = 0.0;
  if (uErode > 0.5) {
    erodeCut = smoothstep(0.3, 1.0, vProgress);
    float grain = fract(sin(dot(floor(vUv * 9.0) + vBrightness * 7.31, vec2(12.9898, 78.233))) * 43758.5453);
    float body = sprite.a * mix(1.0, 0.3 + 0.7 * grain, erodeCut);
    float eroded = smoothstep(erodeCut * 0.6, erodeCut * 0.6 + 0.24, body);
    sprite.a = mix(sprite.a, eroded * sprite.a, erodeCut);
  }
  // Cel temperature banding: quantize the sprite's radial falloff into flat
  // rings — near-white core, tinted mid, rim at the ramp color — replacing
  // the smooth airbrush gradient with the hand-drawn read.
  float bandLevel = -1.0;
  if (uBands > 0.5) {
    float q = floor(min(sprite.a, 0.999) * (uBands + 1.0));
    bandLevel = clamp(q / uBands, 0.0, 1.0);
    sprite.a = q < 0.5 ? 0.0 : mix(0.62, 1.0, bandLevel);
  }
  vec3 ramp = mix(mix(uColorHot, uColorBase, smoothstep(0.0, 0.45, vProgress)), uColorTail, smoothstep(0.45, 1.0, vProgress));
  if (bandLevel >= 0.0) {
    vec3 core = mix(uColorHot, vec3(1.0), 0.55);
    ramp = mix(ramp, core, pow(bandLevel, 1.6));
  }
  // Fade-out must reach EXACTLY zero at progress 1.0 — the inverted-edge
  // smoothstep(1.01, ...) left dead burst particles (parked at progress 1)
  // rendering forever at ~1% alpha: the library-wide "dim corpse fleck" bug.
  // Additive particles hold FULL alpha for their whole life and die purely
  // by scale (vertex shrink): any additive alpha fade transits dim-mustard
  // pixels over a dark scene — rounds 12-18's recurring artifact, including
  // the luminance-floor attempt, which itself dimmed soft sprite edges.
  float fadeOutTerm = 1.0 - smoothstep(min(uFadeWindow.y, 0.98), 1.0, vProgress);
  float alphaLife = smoothstep(0.0, uFadeWindow.x, vProgress) * mix(pow(fadeOutTerm, uTailSnap), 1.0, uAdditiveShrinkF);
  #ifdef MOTION_FLAME_CHARGE_GATHER
    alphaLife = max(alphaLife, 0.72);
  #endif
  #ifdef MOTION_DANGER_PULSE
    float dangerLifeFloor = 0.62 + 0.12 * sin(vProgress * 6.2831853 + vVariant * 9.0);
    alphaLife = max(alphaLife, dangerLifeFloor);
  #endif
  // Gamma < 1 thickens soft smoke bodies: authored opacities were rendering
  // at ~1/3 strength once sprite alpha, life fade, and opacity multiplied out.
  float alpha = pow(sprite.a, uAlphaGamma) * alphaLife * uOpacity;
  #ifdef MOTION_FLAME_CHARGE_GATHER
    alpha *= mix(0.55, 1.0, vChargeEnvelope);
  #endif
  #ifdef MOTION_BEAM_TELEGRAPH_FLOW
    alpha *= mix(0.08, 1.0, vChargeEnvelope);
  #endif
  #ifdef MOTION_LASER_SPRAY_RICOCHET
    alpha *= vChargeEnvelope;
  #endif
  if (alpha < 0.003) discard;
  // Alpha-blend layers take color from the ramp, mostly ignoring the sprite
  // texture's internal dark greys — multiplying them in rendered smoke as
  // ink blots with dirty fringes (round-5). Additive keeps full sprite color.
  vec3 spriteTint = mix(vec3(1.0), sprite.rgb, uSpriteColorMix);
  // Banded cel rings are flat by definition — texture greys would smear the
  // hard band edges back into a gradient.
  if (bandLevel >= 0.0) spriteTint = vec3(1.0);
  vec3 outColor = ramp * spriteTint * vBrightness * vFlicker;
  #ifdef MOTION_DUST_LOOP
    // Ground dust needs an internal light-to-occlusion gradient even without
    // scene lights: upper lobes catch warm sky light while the overlapping
    // lower body stays dense. A stable per-particle cell term prevents the
    // three alpha layers from collapsing into one uniformly tan airbrush.
    float dustCell = 0.5 + 0.5 * sin(vVariant * 41.0 + vUv.x * 7.0 - vUv.y * 5.0);
    float dustDirectionalLight = smoothstep(-0.55, 0.7, (vUv.y - 0.5) * 1.15 - (vUv.x - 0.5) * 0.7);
    float dustHeightLight = mix(smoothstep(0.12, 0.9, vUv.y), dustDirectionalLight, 0.55);
    float dustCoreOcclusion = smoothstep(0.22, 0.88, sprite.a);
    float dustTopEdge = dustHeightLight * (1.0 - smoothstep(0.58, 0.94, sprite.a));
    float dustCrestLight = pow(dustHeightLight, 1.35) * (1.0 - dustCoreOcclusion * 0.24);
    float dustRimLight = dustTopEdge * mix(0.45, 1.0, dustCell);
    float dustLighting = mix(0.78, 1.72, pow(dustHeightLight, 0.75));
    float dustOcclusion = mix(1.08, 0.58, dustCoreOcclusion) * mix(0.82, 1.22, dustCell);
    vec3 dustColorGrade = mix(vec3(0.72, 0.68, 0.62), vec3(1.18, 1.12, 1.02), dustHeightLight);
    outColor *= dustLighting * dustOcclusion * dustColorGrade;
    outColor += vec3(0.42, 0.36, 0.28) * dustTopEdge * 0.35;
    outColor += vec3(0.24, 0.3, 0.32) * dustRimLight * 0.28;
    outColor += vec3(0.18, 0.15, 0.11) * dustCrestLight * 0.24 * mix(0.45, 1.0, dustCell);
  #endif
  #ifdef MOTION_FLAME_CHARGE_GATHER
    outColor *= mix(0.84, 1.18, vChargeEnvelope);
  #endif
  #ifdef MOTION_BEAM_TELEGRAPH_FLOW
    outColor *= mix(0.58, 1.16, vChargeEnvelope);
  #endif
  #ifdef MOTION_LASER_SPRAY_RICOCHET
    outColor *= mix(0.78, 1.08, vChargeEnvelope);
  #endif
  // Eroding matter cools and dirties as it is consumed.
  outColor *= 1.0 - erodeCut * 0.45;
  gl_FragColor = vec4(outColor, alpha);
}
`
