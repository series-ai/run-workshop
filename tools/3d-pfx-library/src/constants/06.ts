import * as THREE from 'three'
import { roundMetric } from './03'
import { PFX_ARC_INNER_RADIUS, PFX_ARC_OUTER_RADIUS, PFX_ARC_THETA_LENGTH, PFX_ARC_THETA_START, PFX_FLAME_BURST_VERTEX, createPfxComboRingMaterial, createPfxExhaustTelegraphMaterial, createPfxHologramBreakMaterial, createPfxMarkerReleaseMaterial, createPfxScanConeMaterial, createPfxTargetSpawnMaterial, createPfxThrusterTrailMaterial, createPfxUiPickupMaterial, createPfxWarningLoopMaterial } from './05'
import type { PfxHologramBreakRuntimeState, PfxMarkerReleaseRuntimeState, PfxScanConeRuntimeState, PfxSurfaceMaterialProps, PfxSurfaceTuning, PfxThrusterTrailRuntimeState, PfxWarningLoopRuntimeState } from '../types/02'

const PFX_MESH_SHADER_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uUndulate;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;
varying vec2 vUv;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  if (uUndulate > 0.0) {
    // Ribbon undulation in WORLD space: both crossed strips ride the SAME
    // snaking spine (per-normal displacement left one strip edge-on and
    // static from any given angle — user-caught). Still at the head,
    // growing toward the tail.
    float u = clamp(0.5 - position.x / 2.2, 0.0, 1.0);
    worldPos.y += sin(position.x * 4.2 - uTime * 5.5) * uUndulate * u;
    worldPos.z += cos(position.x * 3.1 - uTime * 4.2) * uUndulate * u * 0.7;
  }
  vNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - worldPos.xyz);
  vLocalPos = position;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`

const PFX_GLSL_NOISE_HELPERS = /* glsl */ `
float pfxHash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

// Bilinear value noise: per-cell constants render as hard checkerboard
// blocks (round-7's worst artifact on slash erosion + shield cracks).
float pfxValueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = pfxHash21(i);
  float b = pfxHash21(i + vec2(1.0, 0.0));
  float c = pfxHash21(i + vec2(0.0, 1.0));
  float d = pfxHash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
`

const PFX_HEAL_WAVE_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uBreak;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;

${PFX_GLSL_NOISE_HELPERS}

void main() {
  float facing = abs(dot(normalize(vNormal), normalize(vViewDir)));
  float rim = pow(1.0 - facing, 3.2);
  // The healing wave: one bright band born at the apex sweeping DOWN the
  // shell to the ground (+uTime flips the fresnel-shell band direction),
  // with a soft wake behind it.
  float wavePhase = fract(uTime * 0.45);
  float bandPos = 1.0 - wavePhase * 2.0;   // +1 (top) -> -1 (bottom)
  float dist = vLocalPos.y / 0.72 - bandPos;
  float wave = smoothstep(0.16, 0.02, abs(dist)) + smoothstep(0.5, 0.0, dist) * step(0.0, dist) * 0.25;
  float shimmer = pfxValueNoise(vLocalPos.xz * 8.0 + uTime * 0.2) * 0.04;
  float interior = 0.03 + shimmer;
  float breathe = 0.88 + 0.12 * sin(uTime * 2.0);
  float body = (rim * 0.85 + wave * 0.55 + interior) * breathe;
  vec3 color = mix(uColor, uColorHot * 1.25, clamp(wave * 0.8 + rim * 0.3, 0.0, 1.0));
  gl_FragColor = vec4(color, clamp(body, 0.0, 1.0) * uOpacity);
}
`

const PFX_FRESNEL_SHELL_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uBreak;
uniform float uHex;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;

${PFX_GLSL_NOISE_HELPERS}

float pfxHexEdge(vec2 uv) {
  // Distance to the nearest hex-cell edge on a pointy-top grid; 0 at the
  // cell center, ~0.5 on the edge.
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(uv, r) - h;
  vec2 b = mod(uv - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  vec2 p = abs(gv);
  return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x);
}

void main() {
  float facing = abs(dot(normalize(vNormal), normalize(vViewDir)));
  // Tight, overdriven rim — a wide soft gradient reads as a frosted soap
  // bubble; only the rim should saturate (round-5).
  float rim = pow(1.0 - facing, 3.4);
  // Sharp rising energy bands, visible on the face too, not just the rim.
  // Wavy bands: pure-y modulation rendered as hard Neptune latitude stripes.
  float bandWave = sin(vLocalPos.y * 9.0 - uTime * 1.8 + sin(vLocalPos.x * 6.0 + uTime * 0.7) * 0.9);
  float bands = smoothstep(0.5, 0.92, bandWave) * 0.7;
  float pattern = pfxValueNoise(vLocalPos.xy * 7.0 + uTime * 0.15) * 0.045;
  float interior = 0.025 + bands * 0.04 + pattern;
  float breathe = 0.85 + 0.15 * sin(uTime * 2.1);
  float energy = rim * (2.1 + bands * 1.1) * breathe + interior;
  vec3 color = mix(uColor, uColorHot * 1.9, rim * 0.9);
  float alpha = energy;
  if (uHex > 0.5) {
    // Force-field read: a hexagonal energy lattice over the WHOLE sphere,
    // not just the rim — legible from every angle. Cells flicker in slow
    // waves; the lattice drifts so the shield reads alive.
    vec3 n = normalize(vLocalPos);
    vec2 sph = vec2(atan(n.z, n.x) * 2.2, acos(clamp(n.y, -1.0, 1.0)) * 2.2);
    vec2 hexUv = sph * 3.4 + vec2(uTime * 0.16, 0.0);
    float edge = smoothstep(0.36, 0.475, pfxHexEdge(hexUv));
    vec2 cellId = floor(hexUv / vec2(1.0, 1.7320508) + 0.5);
    float cellPulse = 0.5 + 0.5 * sin(uTime * 1.4 + cellId.x * 2.7 + cellId.y * 4.1);
    float lattice = edge * (0.5 + cellPulse * 0.5);
    // Pole caps of the equirect mapping smear — fade the lattice there.
    float poleFade = smoothstep(0.0, 0.35, abs(1.0 - abs(n.y)));
    alpha = rim * 1.7 * breathe + lattice * (0.34 + rim * 0.5) * poleFade + cellPulse * 0.02 + 0.02;
    color = mix(uColor, uColorHot * 1.8, clamp(lattice * 0.85 + rim * 0.55, 0.0, 1.0));
  }
  if (uBreak > 0.0) {
    // Shatter: curved wedge panels (spherical-coordinate cells — an
    // axis-aligned UV grid read as texture corruption) wink out one by one,
    // surviving edges flare hot before they go.
    // Organic dissolve front: interpolated noise with a soft threshold band
    // and a glowing crack line at the front. Cell grids read as checkerboard
    // texture corruption (rounds 6-7).
    vec3 n = normalize(vLocalPos);
    vec2 sph = vec2(atan(n.z, n.x) * 1.6 + 6.0, acos(clamp(n.y, -1.0, 1.0)) * 2.0);
    float noiseField = pfxValueNoise(sph * 3.0) * 0.65 + pfxValueNoise(sph * 7.0) * 0.35;
    float dissolve = smoothstep(0.0, 0.85, uBreak);
    float survive = smoothstep(dissolve - 0.05, dissolve + 0.05, noiseField);
    float crackLine = exp(-abs(noiseField - dissolve) * 34.0);
    alpha = alpha * survive * (1.0 + (1.0 - uBreak) * 0.5) + crackLine * (0.35 + rim * 1.1) * step(0.001, uBreak);
    color = mix(color, uColorHot * 1.7, crackLine);
  }
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0) * uOpacity);
}
`

const PFX_BARRIER_FAILURE_SHELL_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;

${PFX_GLSL_NOISE_HELPERS}

float pfxHexEdge(vec2 uv) {
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(uv, r) - h;
  vec2 b = mod(uv - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  vec2 p = abs(gv);
  return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x);
}

void main() {
  vec3 n = normalize(vLocalPos);
  float facing = abs(dot(normalize(vNormal), normalize(vViewDir)));
  float fresnelAlarm = pow(1.0 - facing, 2.6);
  vec2 sph = vec2(atan(n.z, n.x) * 2.15, acos(clamp(n.y, -1.0, 1.0)) * 2.15);
  vec2 hexUv = sph * 3.65;
  float lattice = smoothstep(0.37, 0.47, pfxHexEdge(hexUv));
  float cellNoise = pfxValueNoise(floor(hexUv * 0.58) + vec2(5.7, 2.1));

  // Persistent status cadence: a strained baseline, sharp double warning
  // beat, then a visible recovery. It never vanishes like a one-shot burst.
  float beatClock = fract(uTime / 0.86);
  float beatA = exp(-pow((beatClock - 0.2) / 0.075, 2.0));
  float beatB = exp(-pow((beatClock - 0.39) / 0.095, 2.0)) * 0.72;
  float dangerBeat = clamp(0.26 + beatA + beatB, 0.0, 1.0);

  vec3 breachDirection = normalize(vec3(0.78, 0.18, 0.6));
  float breachFacing = dot(n, breachDirection);
  float breachHeat = smoothstep(0.46, 0.92, breachFacing);
  float fractureBranch = exp(-abs(n.y - (0.09 + sin(atan(n.z, n.x) * 2.4 + 0.5) * 0.11)) * 34.0)
    * smoothstep(0.42, 0.72, breachFacing);
  float crownFacing = dot(n, normalize(vec3(-0.54, 0.75, -0.38)));
  float crownFailure = smoothstep(0.78, 0.975, crownFacing);
  // These thresholds mirror the missing geometry so the surviving panel lip
  // carries the energy leak instead of delegating all light to a loose blob.
  float breachRim = exp(-abs(breachFacing - 0.92) * 105.0)
    + exp(-abs(crownFacing - 0.975) * 125.0) * 0.72
    + fractureBranch * 0.64;
  float localizedFresnel = fresnelAlarm * (0.55 + breachHeat * 0.45);
  // A hot failure wave propagates away from the wound only at the warning
  // crest. Baseline and recovery keep the stable protection boundary, while
  // the peak changes spatial composition—not merely global brightness.
  float alarmWaveDistance = acos(clamp(dot(n, breachDirection), -1.0, 1.0));
  float alarmSweepCenter = mix(0.18, 1.25, smoothstep(0.26, 1.0, dangerBeat));
  float alarmSweep = exp(-abs(alarmWaveDistance - alarmSweepCenter) * 18.0)
    * smoothstep(0.26, 0.8, dangerBeat);

  // A dark translucent panel body gives volume and occlusion; the lattice is
  // an energized surface detail rather than the entire object being wire.
  float panelValue = 0.56 + cellNoise * 0.14 + dangerBeat * 0.1;
  float interiorFill = 0.32 + cellNoise * 0.08 + dangerBeat * 0.08;
  float edgeEnergy = lattice * (0.18 + dangerBeat * 0.42) + localizedFresnel * (0.42 + dangerBeat * 0.58) + alarmSweep * 0.65;
  float woundEnergy = breachHeat * (0.1 + dangerBeat * 0.34) + breachRim * (0.38 + dangerBeat * 0.82) + crownFailure * 0.24;
  float alpha = clamp(interiorFill + edgeEnergy + woundEnergy, 0.0, 0.94);
  vec3 strainColor = vec3(0.24, 0.025, 0.32);
  vec3 panelColor = mix(strainColor, uColor * panelValue, 0.72 + cellNoise * 0.18);
  float hemisphereShade = 0.78 + 0.22 * clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
  panelColor *= hemisphereShade;
  vec3 color = mix(panelColor, uColor, clamp(lattice * 0.55 + localizedFresnel * 0.52, 0.0, 1.0));
  color = mix(color, uColorHot * 1.12, clamp(breachRim * 0.72 + lattice * dangerBeat * 0.35 + localizedFresnel * 0.45 + alarmSweep * 0.58, 0.0, 1.0));
  vec3 keyLight = normalize(vec3(-0.35, 0.7, 0.62));
  float viewSpecular = pow(max(dot(reflect(-keyLight, normalize(vNormal)), normalize(vViewDir)), 0.0), 18.0);
  vec3 rimColor = vec3(1.0, 0.2, 0.075);
  color += rimColor * (fresnelAlarm * 0.28 + viewSpecular * 0.52);
  // The open wound needs its own hot value family. Reusing the crimson shell
  // tint made the torn edge disappear into the panel body on mobile displays.
  vec3 woundColor = vec3(1.0, 0.22, 0.06);
  float woundHighlight = clamp(breachRim * 0.9 + fractureBranch * 0.45 + crownFailure * 0.18, 0.0, 1.0);
  color = mix(color, woundColor * (0.92 + dangerBeat * 0.55), woundHighlight);
  gl_FragColor = vec4(color, alpha * uOpacity);
}
`

const PFX_HOLOGRAM_SHELL_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;

${PFX_GLSL_NOISE_HELPERS}

void main() {
  vec3 n = normalize(vLocalPos);
  float facing = abs(dot(normalize(vNormal), normalize(vViewDir)));
  float rim = pow(1.0 - facing, 2.25);

  // Object-space latitude/longitude lattice: it wraps the volume and keeps
  // genuine parallax instead of behaving like a camera-facing scan card.
  float longitude = atan(n.z, n.x);
  float latitude = asin(clamp(n.y, -1.0, 1.0));
  float longitudeLine = pow(1.0 - abs(sin(longitude * 6.0)), 22.0);
  float latitudeLine = pow(1.0 - abs(sin(latitude * 8.0)), 24.0);
  float lattice = max(longitudeLine, latitudeLine) * smoothstep(0.05, 0.38, 1.0 - abs(n.y));

  // A narrow scan crest climbs through the object over fine CRT-like rows.
  float scanY = clamp(vLocalPos.y / 0.72 * 0.5 + 0.5, 0.0, 1.0);
  float scanCenter = fract(uTime * 0.34);
  float wrappedDistance = min(abs(scanY - scanCenter), 1.0 - abs(scanY - scanCenter));
  float scan = exp(-pow(wrappedDistance / 0.052, 2.0));
  float rows = pow(0.5 + 0.5 * sin(vLocalPos.y * 68.0 - uTime * 2.4), 12.0);

  // Sparse horizontal corruption bands momentarily displace value—not the
  // geometry—so the loop reads as transmitted data without noisy vibration.
  float bandId = floor(scanY * 18.0);
  float glitchSeed = pfxHash21(vec2(bandId, floor(uTime * 7.0)));
  float glitch = step(0.84, glitchSeed) * rows;
  float interior = 0.025 + rows * 0.07 + lattice * 0.12;
  float alpha = rim * 0.72 + scan * (0.58 + rim * 0.3) + lattice * 0.24 + glitch * 0.28 + interior;
  vec3 color = mix(uColor * 0.78, uColorHot * 1.55, clamp(scan * 0.72 + lattice * 0.38 + rim * 0.36 + glitch, 0.0, 1.0));
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0) * uOpacity);
}
`

const PFX_FORCE_FIELD_SHELL_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;

float pfxForceHexEdge(vec2 uv) {
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(uv, r) - h;
  vec2 b = mod(uv - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  vec2 p = abs(gv);
  return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x);
}

void main() {
  vec3 n = normalize(vLocalPos);
  float facing = abs(dot(normalize(vNormal), normalize(vViewDir)));
  float rim = pow(1.0 - facing, 2.35);
  vec2 sph = vec2(atan(n.z, n.x) * 2.2, acos(clamp(n.y, -1.0, 1.0)) * 2.2);
  vec2 hexUv = sph * 3.4 + vec2(uTime * 0.12, 0.0);
  float edge = smoothstep(0.36, 0.475, pfxForceHexEdge(hexUv));
  vec2 cellId = floor(hexUv / vec2(1.0, 1.7320508) + 0.5);
  float cellPulse = 0.5 + 0.5 * sin(uTime * 1.4 + cellId.x * 2.7 + cellId.y * 4.1);

  // A shield-wide scan travels top-to-bottom and loops at a calm defensive
  // cadence. Its broad wake energizes existing cells instead of introducing
  // an unrelated ring or particle decal.
  float scanCenter = sin(uTime * 4.2) * 0.72;
  float scan = exp(-abs(n.y - scanCenter) * 9.0);
  float wake = exp(-abs(n.y - scanCenter - 0.18) * 4.5) * 0.3;
  float lattice = edge * (0.42 + cellPulse * 0.28 + scan * 0.9 + wake * 0.35);
  float interior = 0.035 + rim * 0.12 + scan * 0.09;
  float alpha = clamp(interior + lattice * (0.3 + rim * 0.55) + rim * 1.55, 0.0, 1.0);
  vec3 color = mix(uColor, uColorHot * 1.9, clamp(rim * 0.62 + scan * 0.72 + lattice * scan * 0.32, 0.0, 1.0));
  gl_FragColor = vec4(color, alpha * uOpacity);
}
`

const PFX_VORTEX_SWIRL_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying vec2 vUv;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float angle = atan(p.y, p.x);
  // Inner radius spins faster than the rim — the differential is what sells
  // "vortex" over "rotating texture".
  float swirl = angle + (1.0 - r) * 4.2 + uTime * 0.9;
  // pow 3.2 keeps arm filaments crisp — softer exponents render as milky
  // yogurt with no value hierarchy (round-5).
  float arms = pow(0.5 + 0.5 * sin(swirl * 3.0), 3.2);
  float fine = pow(0.5 + 0.5 * sin(swirl * 9.0 - uTime * 1.8), 2.0);
  float edge = smoothstep(1.0, 0.84, r);
  float rimGlow = smoothstep(0.55, 0.95, r) * smoothstep(1.0, 0.93, r);
  float depth = smoothstep(0.0, 0.55, r);
  // The one white element: a hot pulsing eye at the center of the well.
  float core = exp(-r * r * 10.0) * (1.1 + 0.25 * sin(uTime * 3.0));
  // Rim stays in-hue at moderate energy — the core is this effect's ONE
  // white; an overdriven rim clipped to a fat featureless donut (round-6).
  float energy = edge * (arms * (0.85 + fine * 0.5) * depth + rimGlow * 0.65) + core;
  vec3 color = mix(uColor, uColorHot * 1.35, clamp(rimGlow * 0.25 + arms * fine * 0.5 + core, 0.0, 1.0));
  float alpha = energy;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0) * uOpacity);
}
`

const PFX_PORTAL_THROAT_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;

void main() {
  float facing = abs(dot(normalize(vNormal), normalize(vViewDir)));
  float rim = pow(1.0 - facing, 2.2);
  float axial = 0.5 + 0.5 * sin(vLocalPos.y * 17.0 - uTime * 2.4);
  float taperGlow = smoothstep(0.62, 0.0, abs(vLocalPos.y)) * 0.24;
  float energy = rim * (0.48 + axial * 0.24) + taperGlow;
  vec3 color = mix(uColor, uColorHot, clamp(rim * 0.65 + axial * 0.18, 0.0, 1.0));
  gl_FragColor = vec4(color, clamp(energy, 0.0, 0.82) * uOpacity);
}
`

const PFX_ARC_SWEEP_FRAGMENT = /* glsl */ `
uniform float uCycle;
uniform float uOpacity;
uniform float uArcErosion;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying vec3 vLocalPos;

${PFX_GLSL_NOISE_HELPERS}

const float THETA_START = ${PFX_ARC_THETA_START};
const float THETA_LENGTH = ${PFX_ARC_THETA_LENGTH};
const float MID_RADIUS = ${(PFX_ARC_INNER_RADIUS + PFX_ARC_OUTER_RADIUS) / 2};
const float HALF_WIDTH = ${(PFX_ARC_OUTER_RADIUS - PFX_ARC_INNER_RADIUS) / 2};

void main() {
  // One-shot: build, strike, and connected recovery live in the first 62%
  // of the burst cycle, leaving a clean rest before the next swing.
  float t = uCycle / 0.62;
  if (t >= 1.0) discard;
  float r = length(vLocalPos.xy);
  float angle = atan(vLocalPos.y, vLocalPos.x);
  float sweep = (angle - THETA_START) / THETA_LENGTH;
  if (sweep < 0.0 || sweep > 1.0) discard;
  // Leading edge races ahead; tail erosion chases it — the visible blade is
  // the band between them.
  float lead = smoothstep(0.0, 0.48, t);
  float erode = smoothstep(0.42, 1.0, t);
  // Tight edge windows: wide smoothsteps rendered the blade as 40px of
  // gaussian mush (round-5). Slashes live or die on razor silhouette.
  float band = smoothstep(erode, erode + 0.04, sweep) * (1.0 - smoothstep(lead - 0.015, lead, sweep));
  // Crescent silhouette: widest mid-swing, tapered at root and tip, with a
  // hard outer edge and only slight inner softness.
  float widthProfile = sin(clamp(sweep, 0.0, 1.0) * 3.14159);
  float halfWidth = HALF_WIDTH * (0.25 + widthProfile * 0.75) + 0.02;
  float radial = 1.0 - smoothstep(halfWidth * 0.72, halfWidth, abs(r - MID_RADIUS));
  // Blade gradient: hot dense outer edge fading toward the inner trail —
  // uniform fill read as a flat radar wedge (round-6).
  float bladeEdge = smoothstep(-halfWidth, halfWidth * 0.5, r - MID_RADIUS);
  // Tail erosion: fine organic dropout with a soft threshold — coarse cells
  // with a hard step read as checkerboard pixelation.
  float noise = pfxValueNoise(vec2(sweep * 26.0, r * 14.0)) * 0.6 + pfxValueNoise(vec2(sweep * 61.0, r * 31.0)) * 0.4;
  float tailness = 1.0 - smoothstep(erode, erode + 0.25, sweep);
  float tailNoise = smoothstep(0.74, 0.9, noise);
  float erosion = 1.0 - uArcErosion * tailness * tailNoise * 0.62;
  // Body erosion: the blade itself gets progressively chewed as the swing
  // ages (fireball hole technique) — early swing solid, holes bite in and
  // widen toward the end so the arc dies as consumed matter, never a wipe.
  float bodyNoise = pfxValueNoise(vec2(sweep * 44.0 + 7.3, r * 24.0)) * 0.65 + pfxValueNoise(vec2(sweep * 90.0 + 3.1, r * 52.0)) * 0.35;
  // Erosion follows AGE: the band just behind the racing edge is fresh and
  // solid; the further back (older) the arc, the deeper the holes bite.
  float ageBehind = clamp((lead - sweep) * 1.6, 0.0, 1.0);
  float bodyTexture = 0.92 + bodyNoise * 0.08;
  float recoveryErode = 1.0 - uArcErosion * ageBehind * smoothstep(0.48, 0.82, bodyNoise) * 0.38;
  float alpha = band * radial * erosion * bodyTexture * recoveryErode * (0.35 + bladeEdge * 0.75);
  vec3 color = mix(uColor, uColorHot * 1.35, clamp(smoothstep(lead - 0.12, lead, sweep) * 0.4 + bladeEdge * 0.5, 0.0, 1.0));
  gl_FragColor = vec4(color, clamp(alpha * 1.25, 0.0, 1.0) * uOpacity);
}
`

const PFX_WATER_FLOW_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uCycle;
uniform float uConeFlow;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;

${PFX_GLSL_NOISE_HELPERS}

void main() {
  if (uConeFlow > 1.5) {
    // Pool mode (flat disc): a BODY of water, not a column. Ripple bands
    // drift radially outward from the center, foam collects at the shore,
    // the whole surface sways — the canonical water shader reused flat.
    float r = length(vLocalPos.xy);
    float angP = atan(vLocalPos.x, vLocalPos.y);
    float ripple = pfxValueNoise(vec2(angP * 3.0 + 4.2, r * 6.5 - uTime * 1.4));
    float streaksP = smoothstep(0.42, 0.68, ripple);
    float foamP = smoothstep(0.64, 0.8, pfxValueNoise(vec2(angP * 7.0 + 2.3, r * 11.0 - uTime * 2.2)));
    float shoreFoam = smoothstep(0.78, 0.92, r) * (1.0 - smoothstep(0.92, 0.99, r));
    float edgeP = 1.0 - smoothstep(0.88, 0.99, r);
    float sway = 0.88 + 0.12 * sin(uTime * 1.3 + r * 4.0);
    float bodyP = (0.52 + streaksP * 0.28 + foamP * 0.55 + shoreFoam * 0.5) * edgeP * sway;
    vec3 colorP = mix(uColor * 1.05, vec3(1.0), clamp(foamP * 0.8 + shoreFoam * 0.6 + streaksP * 0.18, 0.0, 1.0));
    gl_FragColor = vec4(colorP, clamp(bodyP, 0.0, 1.0) * uOpacity);
    return;
  }
  float y = vLocalPos.y;
  float directionalCone = step(1.2, uConeFlow);
  // Crown cones flow RADIALLY: water enters at the throat and streams
  // outward to the rim, streaks arranged around the axis — never the
  // column's vertical scroll pasted on a cone.
  float ang = atan(vLocalPos.x, vLocalPos.z);
  if (uConeFlow > 0.5 && directionalCone < 0.5) {
    y = -vLocalPos.y;
  }
  float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 1.6);
  // Beam-spec envelope: fire-in ~100ms, sustained plateau, erosion collapse
  // ~250ms at the wrap (research timings, not clock defaults).
  float fireIn = smoothstep(0.0, 0.05, uCycle);
  float collapse = smoothstep(0.86, 0.985, uCycle);
  // The column GROWS from the base during fire-in (never pops in whole).
  float grow = smoothstep(y, y + 0.35, mix(-0.85, 1.2, pow(fireIn, 0.6)));
  // Rivulets scroll UP; froth caps ride the flow.
  vec2 flowUv = uConeFlow > 0.5 ? vec2(ang * 5.0, y * 4.5 - uTime * 6.5) : vec2(vLocalPos.x * 26.0 + vLocalPos.z * 26.0, y * 3.2 - uTime * 6.5);
  float rivulet = pfxValueNoise(flowUv);
  float streaks = smoothstep(0.4, 0.7, rivulet);
  vec2 foamUv = uConeFlow > 0.5 ? vec2(ang * 9.0 + 3.7, y * 8.0 - uTime * 8.5) : vec2(vLocalPos.x * 40.0 - uTime * 0.8, y * 9.0 - uTime * 8.5);
  float foamNoise = pfxValueNoise(foamUv);
  float foam = smoothstep(0.62, 0.8, foamNoise) * smoothstep(-0.2, 0.55, y);
  // Fireball erosion technique: hard-threshold holes churn the water body;
  // the collapse raises the threshold so the column DISSOLVES, never fades.
  float holeNoise =
    pfxValueNoise(vec2(vLocalPos.x * 34.0 + vLocalPos.z * 22.0, y * 6.5 - uTime * 7.0)) * 0.62 +
    pfxValueNoise(vec2(y * 12.0 - uTime * 4.5, vLocalPos.z * 38.0)) * 0.38;
  float erode = smoothstep(0.3 + collapse * 0.45, 0.42 + collapse * 0.45, holeNoise);
  // Directional spray remains one connected translucent sheet. Hard holes
  // made the fan read as agate/ice; continuous density plus scrolling
  // rivulets carries liquid motion while collapse still dissolves the sheet.
  float liquidContinuity = (0.58 + holeNoise * 0.34) * (1.0 - collapse * 0.92);
  erode = mix(erode, liquidContinuity, directionalCone);
  float radialBaseFade = mix(1.0, smoothstep(-0.98, -0.72, y), directionalCone);
  float radialTopFade = mix(1.0 - smoothstep(0.1, 0.28, y), 1.0 - smoothstep(0.88, 1.14, y), directionalCone);
  float baseFade = uConeFlow > 0.5 ? radialBaseFade : smoothstep(-0.88, -0.55, y);
  float topFade = uConeFlow > 0.5 ? radialTopFade : 1.0 - smoothstep(0.55, 0.88, y);
  float surge = 0.78 + 0.28 * sin(uTime * 1.9) * (0.6 + 0.4 * sin(uTime * 0.63));
  float mouthFoam = directionalCone * smoothstep(0.48, 1.02, y) * streaks;
  float body = (0.3 + rim * 0.3 + streaks * 0.4 + foam * 0.75 + mouthFoam * 0.22) * erode * grow * baseFade * topFade * surge;
  float whiteMix = clamp(foam * mix(0.95, 0.48, directionalCone) + rim * 0.22 + streaks * 0.2 + mouthFoam * 0.42, 0.0, 1.0);
  vec3 color = mix(uColor * 1.1, vec3(0.88, 0.98, 1.0), whiteMix);
  gl_FragColor = vec4(color, clamp(body, 0.0, 1.0) * uOpacity);
}
`

const PFX_TRAIL_FLOW_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uCycle;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;

${PFX_GLSL_NOISE_HELPERS}

void main() {
  // u: 0 at the head (+x, nearest the mover) -> 1 at the tail.
  float u = clamp(0.5 - vLocalPos.x / 2.2, 0.0, 1.0);
  float v = vLocalPos.y != 0.0 ? vLocalPos.y : vLocalPos.z;
  // Taper law: width AND alpha reach zero at the tail — never a chopped end.
  float halfW = mix(0.24, 0.015, u);
  // Softer cross-section near the head: the crossed strips must read as a
  // soft volume blending into the mover, never a hard '+' silhouette.
  float across = 1.0 - smoothstep(halfW * mix(0.0, 0.55, smoothstep(0.0, 0.35, u)), halfW, abs(v));
  // Flowing erosion: holes bite deeper toward the tail (spec: erode, don't fade).
  float flow = pfxValueNoise(vec2(u * 7.0 - uTime * 2.6, v * 18.0)) * 0.65 + pfxValueNoise(vec2(u * 15.0 - uTime * 4.1, v * 34.0)) * 0.35;
  float threshold = mix(0.12, 0.72, u);
  float keep = smoothstep(threshold, threshold + 0.14, flow);
  float tipFade = 1.0 - smoothstep(0.78, 1.0, u);
  float hot = 1.0 - smoothstep(0.0, 0.22, u);
  float headBlend = smoothstep(0.0, 0.3, u);
  float body = across * keep * tipFade * headBlend;
  vec3 color = mix(uColor, uColorHot * 1.3, hot);
  gl_FragColor = vec4(color, clamp(body, 0.0, 1.0) * uOpacity);
}
`

export const PFX_PROJECTILE_WAKE_HEAD_COLLAR_OPACITY = 0.65

const PFX_BUBBLE_SURFACE_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;

${PFX_GLSL_NOISE_HELPERS}

void main() {
  vec3 normal = normalize(vNormal);
  float facing = abs(dot(normal, normalize(vViewDir)));
  float rim = pow(1.0 - facing, 2.2);
  vec3 lightDirection = normalize(vec3(-0.38, 0.76, 0.52));
  float glint = pow(max(dot(normal, lightDirection), 0.0), 34.0);
  float meniscus = pow(0.5 + 0.5 * sin(vLocalPos.y * 13.0 + vLocalPos.x * 5.0 - uTime * 1.4), 10.0) * rim;
  float shimmer = pfxValueNoise(vLocalPos.xy * 5.0 + uTime * 0.08) * 0.06;
  float alpha = 0.055 + rim * 0.62 + glint * 0.92 + meniscus * 0.24 + shimmer;
  vec3 color = mix(uColor * 0.7, uColorHot * 1.32, clamp(rim * 0.42 + glint + meniscus * 0.35, 0.0, 1.0));
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0) * uOpacity);
}
`

const PFX_PROJECTILE_WAKE_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uWakeEnvelope;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;

${PFX_GLSL_NOISE_HELPERS}

void main() {
  // Closed tube authored from +X (head) to -X (tail). The angular term
  // keeps the flowing cells coherent around the full cross-section.
  float u = clamp((1.1 - vLocalPos.x) / 2.7, 0.0, 1.0);
  float angle = atan(vLocalPos.y, vLocalPos.z);
  float flow =
    pfxValueNoise(vec2(u * 11.0 - uTime * 3.8, angle * 2.6)) * 0.62 +
    pfxValueNoise(vec2(u * 25.0 - uTime * 7.2, angle * 5.2 + 7.1)) * 0.38;
  float lanePhase = angle * 3.0 + u * 10.0 - uTime * 6.5 + (flow - 0.5) * 2.2;
  float collarFlow = mix(0.18, 1.0, smoothstep(0.0, 0.12, u));
  float lane = pow(0.5 + 0.5 * sin(lanePhase), 5.0) * collarFlow;
  float brokenFlow = smoothstep(0.38, 0.64, flow + lane * 0.12) * mix(0.35, 1.0, collarFlow);
  float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 1.8);
  float grow = 1.0 - smoothstep(uWakeEnvelope - 0.02, uWakeEnvelope + 0.16, u);
  float tail = 1.0 - smoothstep(0.72, 1.0, u);
  float headJoin = mix(${PFX_PROJECTILE_WAKE_HEAD_COLLAR_OPACITY.toFixed(2)}, 1.0, smoothstep(0.0, 0.08, u));
  // Coverage follows the envelope as well as length. This prevents shader
  // churn from producing a false early local peak in review captures.
  float envelopeWeight = 0.14 + uWakeEnvelope * 0.86;
  float body = (0.1 + brokenFlow * 0.24 + lane * 0.66 + rim * 0.34) * grow * tail * headJoin * envelopeWeight;
  float heat = clamp(lane * 0.78 + rim * 0.28 + brokenFlow * 0.16, 0.0, 1.0);
  vec3 color = mix(uColor * 0.58, uColorHot * 1.38, heat);
  gl_FragColor = vec4(color, clamp(body, 0.0, 1.0) * uOpacity);
}
`

const PFX_ELECTRIC_WAKE_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uElectricReach;
uniform float uElectricDecay;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;
varying vec2 vUv;

${PFX_GLSL_NOISE_HELPERS}

void main() {
  // Geometry UV.x is global distance from the mover-facing source, shared by
  // the main bolt and both forks. UV.y packs the strand id in two-unit bands.
  float u = clamp(vUv.x, 0.0, 1.0);
  float strand = floor(vUv.y * 0.5 + 0.01);
  float around = fract(vUv.y * 0.5) * 6.2831853;
  float surfaceNoise =
    pfxValueNoise(vec2(u * 17.0 - uTime * 8.2, around * 1.7 + strand * 5.3)) * 0.62 +
    pfxValueNoise(vec2(u * 39.0 - uTime * 14.6 + 9.1, around * 3.4)) * 0.38;
  float travelingLane = pow(0.5 + 0.5 * sin(u * 34.0 - uTime * 25.0 + strand * 2.7 + surfaceNoise * 2.8), 7.0);
  float microCrackle = smoothstep(0.64, 0.8, surfaceNoise);
  float facing = abs(dot(normalize(vNormal), normalize(vViewDir)));
  float rim = pow(1.0 - facing, 1.8);
  float core = pow(facing, 2.6);
  float headBand = pow(0.5 + 0.5 * sin(around * 3.0 - uTime * 18.0), 9.0) * (1.0 - smoothstep(0.0, 0.22, u));

  // Charge propagates head -> tail. Recovery erases the oldest charge from
  // tail -> head, producing a directional ending instead of a whole-card fade.
  float reach = 1.0 - smoothstep(uElectricReach - 0.025, uElectricReach + 0.055, u);
  // Keep enough of the authored zigzag visible through the selected decay
  // frame; opacity performs the final clean ending after this erosion front.
  float recoveryFront = 1.0 - uElectricDecay * 0.58;
  float recovery = 1.0 - smoothstep(recoveryFront - 0.06, recoveryFront + 0.035, u);
  float branchThreshold = mix(0.0, 0.2 + strand * 0.11, step(0.5, strand));
  float branchGate = smoothstep(branchThreshold, branchThreshold + 0.09, uElectricReach);
  float branchFlicker = strand < 0.5
    ? 1.0
    : 0.48 + 0.52 * step(0.42, pfxValueNoise(vec2(floor(uTime * 24.0) + strand * 11.0, strand * 7.0)));
  float coverage = (0.34 + travelingLane * 0.66) * reach * recovery * branchGate * branchFlicker;
  // Fine crackle and three angular head lanes live in VALUE, not alpha: the
  // voltage surface stays coherent while its hot core still scintillates.
  float heat = clamp(core * 0.64 + travelingLane * 0.54 + microCrackle * 0.24 + headBand * 0.3, 0.0, 1.0);
  vec3 color = mix(uColor * (0.58 + rim * 0.28), uColorHot * 1.48, heat);
  gl_FragColor = vec4(color, clamp(coverage * (0.64 + rim * 0.34), 0.0, 1.0) * uOpacity);
}
`

const PFX_ENERGY_COLUMN_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uCycle;
uniform float uConeFlow;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;

${PFX_GLSL_NOISE_HELPERS}

void main() {
  float y = vLocalPos.y;
  float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 1.8);
  float angle = atan(vLocalPos.z, vLocalPos.x);
  float cells = pfxValueNoise(vec2(y * 8.0 - uTime * 2.1, angle * 2.4 + uTime * 0.3));
  float fine = pfxValueNoise(vec2(y * 17.0 - uTime * 4.2, angle * 5.0 + 9.7));
  float braided = pow(0.5 + 0.5 * sin(y * 13.0 - angle * 2.0 - uTime * 6.4 + cells * 2.2), 4.0);
  float levelUp = step(2.5, uConeFlow);
  float blastBeam = step(1.25, uConeFlow) * (1.0 - levelUp);
  float blastCore = step(1.75, uConeFlow) * blastBeam;
  float baseFade = smoothstep(-0.82, -0.46, y);
  float genericTopFade = 1.0 - smoothstep(0.5, 0.84, y);
  float blastTopFade = 1.0 - smoothstep(1.16, 1.3, y);
  float topFade = mix(genericTopFade, blastTopFade, blastBeam);
  float discovery = 0.72 + 0.28 * sin(uTime * 2.2);
  // The level-up variant uses the same mobile-cheap shader but replaces the
  // old barcode bands with angular braided cells. Its CPU lifecycle owns the
  // large intensity arc; this small crest keeps the surge alive at peak.
  float crest = mix(discovery, 0.82 + 0.18 * sin(uTime * 4.2), levelUp);
  float genericEnergy = (rim * 0.4 + cells * 0.3 + fine * 0.16 + braided * 0.38) * baseFade * topFade * crest;
  // The containment field uses one broad traveling helix rather than two
  // crossing lattices. The nested attack core is nearly solid, with a fast
  // longitudinal compression pulse carried in value rather than alpha.
  float beamHelix = pow(0.5 + 0.5 * sin(y * 10.0 - angle * 1.15 - uTime * 7.4), 8.0);
  float coreCompression = pow(0.5 + 0.5 * sin(y * 8.0 - uTime * 12.0), 10.0);
  float coronaEnergy = (0.12 + rim * 0.5 + beamHelix * 0.28 + fine * 0.035) * baseFade * topFade;
  float coreEnergy = (0.72 + rim * 0.18 + coreCompression * 0.16) * baseFade * topFade;
  float beamEnergy = mix(coronaEnergy, coreEnergy, blastCore) * (0.9 + discovery * 0.1);
  // Reward light stays graphic and clean: two thin helical lanes move upward
  // over a stable gold body. Noise only feathers the coverage; it no longer
  // drives color into the brown lava blotches found by independent review.
  float ribbonA = pow(0.5 + 0.5 * sin(y * 10.0 - angle * 2.0 - uTime * 6.8), 7.0);
  float ribbonB = pow(0.5 + 0.5 * sin(y * 8.0 + angle * 3.0 - uTime * 5.4 + 1.7), 8.0);
  float cleanFlow = max(ribbonA, ribbonB * 0.72);
  float axialHeat = smoothstep(-0.76, 0.56, y);
  float levelEnergy = (0.18 + rim * 0.34 + cleanFlow * 0.56 + fine * 0.045) * baseFade * topFade * crest;
  float energy = mix(genericEnergy, beamEnergy, blastBeam);
  energy = mix(energy, levelEnergy, levelUp);
  vec3 genericColor = mix(uColor * 0.82, uColorHot * 1.52, clamp(braided * 0.68 + rim * 0.38 + fine * 0.18, 0.0, 1.0));
  vec3 coronaColor = mix(uColor * 0.9, uColorHot * 1.38, clamp(beamHelix * 0.42 + rim * 0.46, 0.0, 1.0));
  vec3 coreColor = mix(uColor * 1.2, uColorHot * 1.72, clamp(0.42 + coreCompression * 0.28 + rim * 0.2, 0.0, 1.0));
  vec3 beamColor = mix(coronaColor, coreColor, blastCore);
  vec3 levelColor = mix(uColor * 1.06, uColorHot * 1.5, clamp(0.14 + axialHeat * 0.18 + cleanFlow * 0.54 + rim * 0.24, 0.0, 1.0));
  vec3 color = mix(genericColor, beamColor, blastBeam);
  color = mix(color, levelColor, levelUp);
  gl_FragColor = vec4(color, clamp(energy, 0.0, 1.0) * uOpacity);
}
`

const PFX_TOXIC_POOL_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying vec3 vLocalPos;

${PFX_GLSL_NOISE_HELPERS}

void main() {
  vec2 p = vLocalPos.xy;
  float r = length(p);
  float edgeNoise = pfxValueNoise(p * 4.8 + vec2(uTime * 0.22, -uTime * 0.16));
  float boundary = 0.84 + (edgeNoise - 0.5) * 0.22;
  if (r > boundary) discard;
  float cells = pfxValueNoise(p * 9.0 - vec2(uTime * 0.35, 0.0));
  float boil = pow(0.5 + 0.5 * sin(cells * 9.0 + uTime * 2.8), 4.0);
  float rim = smoothstep(boundary - 0.12, boundary, r);
  float depth = 0.42 + (1.0 - r / max(boundary, 0.01)) * 0.34;
  float alpha = depth + boil * 0.26 + rim * 0.32;
  vec3 darkToxic = uColor * vec3(0.28, 0.58, 0.34);
  vec3 color = mix(darkToxic, uColorHot, clamp(boil * 0.75 + rim * 0.32, 0.0, 1.0));
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.92) * uOpacity);
}
`

const PFX_ACID_POOL_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;

${PFX_GLSL_NOISE_HELPERS}

void main() {
  vec2 p = vLocalPos.xz;
  float radius = length(p);
  float dome = smoothstep(0.018, 0.055, vLocalPos.y);
  float facing = abs(dot(normalize(vNormal), normalize(vViewDir)));
  float meniscus = pow(1.0 - facing, 2.1);
  float coarse = pfxValueNoise(p * 4.8 + vec2(uTime * 0.16, -uTime * 0.12));
  float fine = pfxValueNoise(p * 12.0 - vec2(uTime * 0.28, uTime * 0.09));
  float causticField = coarse * 0.62 + fine * 0.38 + sin(uTime * 1.7 + radius * 5.0) * 0.07;
  float caustic = smoothstep(0.68, 0.84, causticField);
  float slowPulse = 0.9 + 0.1 * sin(uTime * 1.15 + radius * 3.2);
  float poolAlpha = (0.5 + coarse * 0.18 + caustic * 0.22 + meniscus * 0.16) * slowPulse;
  float bubbleGlint = pow(max(dot(normalize(vNormal), normalize(vec3(-0.35, 0.82, 0.46))), 0.0), 28.0);
  float bubbleCadence = 0.58 + 0.42 * (0.5 + 0.5 * sin(uTime * 2.35 + p.x * 8.0 + p.y * 6.0));
  float bubbleAlpha = (0.06 + meniscus * 0.76 + bubbleGlint * 0.9) * bubbleCadence;
  float acidHeat = clamp(caustic * 0.76 + fine * 0.18 + meniscus * 0.22, 0.0, 1.0);
  vec3 deepAcid = uColor * vec3(0.24, 0.5, 0.08);
  vec3 poolColor = mix(deepAcid, uColorHot * 1.06, acidHeat);
  vec3 bubbleColor = mix(uColor * 0.62, uColorHot * 1.35, clamp(meniscus + bubbleGlint, 0.0, 1.0));
  float alpha = mix(poolAlpha, bubbleAlpha, dome);
  vec3 color = mix(poolColor, bubbleColor, dome);
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0) * uOpacity);
}
`

const PFX_ENERGY_TRAIL_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;

${PFX_GLSL_NOISE_HELPERS}

void main() {
  float axial = clamp(vLocalPos.y + 0.5, 0.0, 1.0);
  float flow = pow(0.5 + 0.5 * sin(axial * 22.0 - uTime * 8.0), 2.6);
  float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 1.45);
  float breakup = pfxValueNoise(vec2(axial * 12.0 - uTime * 2.2, vLocalPos.x * 20.0));
  float tailFade = smoothstep(0.0, 0.22, axial);
  float energy = (0.2 + rim * 0.48 + flow * 0.4) * tailFade * (0.72 + breakup * 0.28);
  vec3 color = mix(uColor, uColorHot * 1.4, clamp(flow * 0.65 + rim * 0.4, 0.0, 1.0));
  gl_FragColor = vec4(color, clamp(energy, 0.0, 1.0) * uOpacity);
}
`

const PFX_ENERGY_CHEVRON_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uCycle;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;

void main() {
  float axial = clamp(vLocalPos.y + 0.5, 0.0, 1.0);
  float sweep = fract(axial - uTime * 0.72);
  float crest = pow(1.0 - abs(sweep * 2.0 - 1.0), 4.0);
  float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 1.6);
  float crescendo = 0.55 + 0.45 * smoothstep(0.0, 0.78, uCycle);
  float energy = (0.3 + crest * 0.65 + rim * 0.35) * crescendo;
  vec3 color = mix(uColor, uColorHot * 1.55, clamp(crest * 0.8 + rim * 0.35, 0.0, 1.0));
  gl_FragColor = vec4(color, clamp(energy, 0.0, 1.0) * uOpacity);
}
`

const PFX_FIRE_BODY_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;

${PFX_GLSL_NOISE_HELPERS}

void main() {
  // Reference-matched (hero fireball still): an incandescent MASS — most of
  // the ball burns yellow-white with orange CELLS carved by higher-frequency
  // roil; only the rim and tail cool through orange to deep. Nose bias is
  // gentle: the whole body is on fire, the leading face just burns hottest.
  vec3 dir = normalize(vLocalPos);
  float noseAngle = acos(clamp(dir.x, -1.0, 1.0));
  float ca = cos(atan(dir.y, dir.z));
  float sa = sin(atan(dir.y, dir.z));
  float flow = noseAngle * 2.4 - uTime * 2.3;
  float cells =
    pfxValueNoise(vec2(flow + ca * 2.2, sa * 4.4)) * 0.55 +
    pfxValueNoise(vec2(flow * 2.3 + 11.7 + sa * 3.1, ca * 5.8)) * 0.45;
  float ridge = 1.0 - abs(cells * 2.0 - 1.0);
  // Rim cooling from the view edge (fresnel) + tail cooling from noseAngle.
  float facing = clamp(dot(normalize(vNormal), normalize(vViewDir)), 0.0, 1.0);
  float heat = clamp(0.92 - noseAngle * 0.22 - (1.0 - facing) * 0.38 + (ridge - 0.5) * 0.6, 0.0, 1.0);
  // Reference color script pushed further: golden core, yellow-orange,
  // saturated orange, RED-brown rim (not just dim orange).
  vec3 cWhite = uColorHot * 1.55;
  vec3 cYellow = mix(uColor, uColorHot, 0.42) * 1.3;
  vec3 cOrange = uColor * 0.98;
  vec3 cDeep = uColor * vec3(0.82, 0.38, 0.3);
  vec3 color = cDeep;
  color = mix(color, cOrange, smoothstep(0.28, 0.4, heat));
  color = mix(color, cYellow, smoothstep(0.56, 0.68, heat));
  color = mix(color, cWhite, smoothstep(0.8, 0.92, heat));
  gl_FragColor = vec4(pow(color, vec3(0.4545)), uOpacity);
}
`

const PFX_FIRE_ERODE_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying vec3 vLocalPos;

${PFX_GLSL_NOISE_HELPERS}

void main() {
  vec3 dir = normalize(vLocalPos);
  float noseAngle = acos(clamp(dir.x, -1.0, 1.0));
  float ca = cos(atan(dir.y, dir.z));
  float sa = sin(atan(dir.y, dir.z));
  float flow = noseAngle * 2.6 - uTime * 3.0;
  float n =
    pfxValueNoise(vec2(flow + ca * 2.4, sa * 4.6)) * 0.6 +
    pfxValueNoise(vec2(flow * 2.1 + 11.7 + sa * 3.2, ca * 5.4)) * 0.4;
  // Hard-edged erosion, deeper toward the tail.
  // Review: less erosion — the shell reads as the fireball's outer surface,
  // holes as accents rather than the shell as scraps.
  float erode = smoothstep(0.28, 0.42, n - (noseAngle / 3.14159) * 0.26);
  // Outer layer runs HOT-RED: red-orange cell bodies, orange crests, gold
  // reserved for the highest peaks only (review: more orange/red outside).
  vec3 color = mix(uColor * vec3(1.05, 0.52, 0.38), uColor * 1.15, smoothstep(0.44, 0.66, n));
  color = mix(color, uColorHot * 1.35, smoothstep(0.74, 0.92, n));
  gl_FragColor = vec4(pow(color, vec3(0.4545)), erode * uOpacity);
}
`

export const PFX_FLAME_CHARGE_CRUCIBLE_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uCrownMotionAmplitude;
uniform float uCycle;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;
varying vec2 vUv;
void main() {
  vec3 animatedPosition = position;
  float crownMotion = smoothstep(-0.12, 0.54, position.y);
  float surfaceRipple = (
    sin(position.y * 15.0 - uTime * 5.2 + position.x * 9.0) * 0.58 +
    sin(position.y * 27.0 - uTime * 7.1 - position.z * 11.0) * 0.42
  ) * crownMotion * 0.022;
  float chargeShape = smoothstep(0.02, 0.34, uCycle)
    * (1.0 - smoothstep(0.5, 0.66, uCycle));
  animatedPosition.y += crownMotion * (0.035 + chargeShape * 0.13);
  animatedPosition.x *= 1.0 - crownMotion * (0.04 + chargeShape * 0.08);
  animatedPosition += normal * surfaceRipple;
  animatedPosition.x += sin(uTime * 4.1 + position.y * 8.2 + position.z * 5.4) * crownMotion * uCrownMotionAmplitude;
  animatedPosition.z += cos(uTime * 3.6 + position.y * 7.1 - position.x * 4.8) * crownMotion * uCrownMotionAmplitude * 0.72;
  vec4 worldPos = modelMatrix * vec4(animatedPosition, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - worldPos.xyz);
  vLocalPos = animatedPosition;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`

export const PFX_FLAME_CHARGE_CRUCIBLE_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uCoreGain;
uniform vec3 uColor;
uniform vec3 uColorHot;
uniform vec3 uColorCore;
uniform vec3 uColorOuter;
uniform vec3 uColorMid;
uniform vec3 uColorHeart;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;

${PFX_GLSL_NOISE_HELPERS}

void main() {
  float facing = clamp(abs(dot(normalize(vNormal), normalize(vViewDir))), 0.0, 1.0);
  float rim = pow(1.0 - facing, 1.7);
  float surfaceNoise =
    pfxValueNoise(vec2(vLocalPos.y * 7.2 - uTime * 1.35, vLocalPos.x * 8.4 + vLocalPos.z * 6.1)) * 0.62 +
    pfxValueNoise(vec2(vLocalPos.y * 14.0 - uTime * 2.1 + 9.7, vLocalPos.z * 12.0 - vLocalPos.x * 7.0)) * 0.38;
  float verticalFlow = 0.5 + 0.5 * sin(vLocalPos.y * 17.0 - uTime * 4.8 + surfaceNoise * 3.0);
  float crownHeat = 1.0 - smoothstep(-0.2, 0.34, vLocalPos.y);
  float tipCooling = smoothstep(0.12, 0.52, vLocalPos.y);
  float rootHeat = 1.0 - smoothstep(-0.28, 0.12, vLocalPos.y);
  float incandescentFloor = 0.36;
  float heat = clamp(incandescentFloor + facing * 0.08 + surfaceNoise * 0.38 + verticalFlow * 0.16 + crownHeat * 0.04 + rootHeat * 0.04 - tipCooling * 0.035, 0.0, 1.0);
  float softHeat = smoothstep(0.08, 0.92, heat);
  float turbulentBands = clamp(surfaceNoise * 0.72 + verticalFlow * 0.28, 0.0, 1.0);
  float emberVein = smoothstep(0.7, 0.86, pfxValueNoise(vec2(vLocalPos.y * 18.0 - uTime * 2.7, vLocalPos.x * 13.0 - vLocalPos.z * 9.0)));
  float roilContrast = abs(surfaceNoise - 0.5) * 2.0;
  float flameCells = clamp(surfaceNoise * 0.76 + verticalFlow * 0.24, 0.0, 1.0);
  float thermalBlend = smoothstep(0.06, 0.94, heat);
  float temperatureBands =
    smoothstep(0.2, 0.31, thermalBlend) * 0.32 +
    smoothstep(0.46, 0.58, thermalBlend) * 0.34 +
    smoothstep(0.72, 0.84, thermalBlend) * 0.34;
  float detailContrast = smoothstep(0.34, 0.7, flameCells);
  float crispEmissiveCore = pow(facing, 7.0)
    * (1.0 - smoothstep(0.12, 0.42, abs(vLocalPos.y + 0.03)));
  float focusedIncandescentHeart = crispEmissiveCore * (0.82 + surfaceNoise * 0.18);
  float incandescentHeart = focusedIncandescentHeart;
  // Emissive temperature, not directional mineral lighting: the previous
  // opaque/specular treatment made the organic crucible read as a brown
  // rock. Saturated outer red flows into orange and a bounded gold core.
  vec3 color = mix(uColorOuter, uColorMid * 1.08, smoothstep(0.08, 0.52, temperatureBands));
  color = mix(color, uColorCore * uCoreGain, smoothstep(0.5, 0.92, temperatureBands));
  color *= 0.84 + detailContrast * 0.28;
  color = mix(color, uColorOuter * 0.86, roilContrast * 0.08);
  color = mix(color, uColorMid * 1.18, turbulentBands * 0.1);
  color = mix(color, uColorHot * 1.08, emberVein * 0.22);
  color = mix(color, uColorHeart * 2.4, incandescentHeart * 0.96);
  float specularGlint = pow(max(heat, 0.0), 7.0);
  float rimGlow = pow(1.0 - facing, 1.7) * (0.22 + verticalFlow * 0.18);
  float rimSeparation = pow(1.0 - facing, 0.82);
  color += uColorHot * specularGlint * 0.12;
  color += uColorOuter * rimGlow * 0.34 + uColorMid * rimSeparation * 0.22;
  float volumeShade = 0.92 + facing * 0.08;
  color *= volumeShade * 1.24;
  float moltenShellAlpha = (0.4 + softHeat * 0.22 + facing * 0.18 + emberVein * 0.1)
    * (0.86 + flameCells * 0.14);
  float alpha = clamp(moltenShellAlpha, 0.34, 0.76);
  gl_FragColor = vec4(color, alpha * uOpacity);
}
`

const PFX_MESH_SHADER_FRAGMENTS: Record<NonNullable<PfxSurfaceTuning['meshShader']>, string> = {
  'fire-body': PFX_FIRE_BODY_FRAGMENT,
  'fire-erode': PFX_FIRE_ERODE_FRAGMENT,
  'fresnel-shell': PFX_FRESNEL_SHELL_FRAGMENT,
  'hex-shell': PFX_FRESNEL_SHELL_FRAGMENT,
  'barrier-failure-shell': PFX_BARRIER_FAILURE_SHELL_FRAGMENT,
  'hologram-shell': PFX_HOLOGRAM_SHELL_FRAGMENT,
  'force-field-shell': PFX_FORCE_FIELD_SHELL_FRAGMENT,
  'heal-wave': PFX_HEAL_WAVE_FRAGMENT,
  'vortex-swirl': PFX_VORTEX_SWIRL_FRAGMENT,
  'portal-throat': PFX_PORTAL_THROAT_FRAGMENT,
  'arc-sweep': PFX_ARC_SWEEP_FRAGMENT,
  'energy-column': PFX_ENERGY_COLUMN_FRAGMENT,
  'trail-flow': PFX_TRAIL_FLOW_FRAGMENT,
  'projectile-wake': PFX_PROJECTILE_WAKE_FRAGMENT,
  'electric-wake': PFX_ELECTRIC_WAKE_FRAGMENT,
  'bubble-surface': PFX_BUBBLE_SURFACE_FRAGMENT,
  'water-flow': PFX_WATER_FLOW_FRAGMENT,
  'toxic-pool': PFX_TOXIC_POOL_FRAGMENT,
  'acid-pool': PFX_ACID_POOL_FRAGMENT,
  'energy-trail': PFX_ENERGY_TRAIL_FRAGMENT,
  'energy-chevron': PFX_ENERGY_CHEVRON_FRAGMENT,
  'plasma-impact-flipbook': PFX_FRESNEL_SHELL_FRAGMENT,
  'combo-ring-meter': PFX_FRESNEL_SHELL_FRAGMENT,
  'ui-pickup-receipt': PFX_FRESNEL_SHELL_FRAGMENT,
  'target-spawn-reticle': PFX_FRESNEL_SHELL_FRAGMENT,
  'target-spawn-pin': PFX_FRESNEL_SHELL_FRAGMENT,
  'warning-loop-panel': PFX_FRESNEL_SHELL_FRAGMENT,
  'warning-loop-beacon': PFX_FRESNEL_SHELL_FRAGMENT,
  'marker-release-ground': PFX_FRESNEL_SHELL_FRAGMENT,
  'marker-release-badge': PFX_FRESNEL_SHELL_FRAGMENT,
  'scan-cone-footprint': PFX_FRESNEL_SHELL_FRAGMENT,
  'scan-cone-volume': PFX_FRESNEL_SHELL_FRAGMENT,
  'hologram-break-figure': PFX_FRESNEL_SHELL_FRAGMENT,
  'hologram-break-projector': PFX_FRESNEL_SHELL_FRAGMENT,
  'thruster-trail-plume': PFX_FRESNEL_SHELL_FRAGMENT,
  'thruster-trail-nozzle': PFX_FRESNEL_SHELL_FRAGMENT,
  'exhaust-telegraph-lane': PFX_FRESNEL_SHELL_FRAGMENT,
  'exhaust-telegraph-vent': PFX_FRESNEL_SHELL_FRAGMENT,
  'flame-burst-blossom': PFX_FRESNEL_SHELL_FRAGMENT,
  'meteor-burst-collision': PFX_FRESNEL_SHELL_FRAGMENT,
}

export function createPfxMeshShaderHotColor(
  meshShader: NonNullable<PfxSurfaceTuning['meshShader']>,
  color: THREE.ColorRepresentation,
): THREE.Color {
  const base = new THREE.Color(color)
  if (meshShader === 'arc-sweep') return new THREE.Color('#ffe0a3')
  if (meshShader === 'acid-pool') return new THREE.Color('#dfff52')
  if (meshShader === 'fire-body' || meshShader === 'fire-erode') {
    return base.lerp(new THREE.Color(base.b > base.r ? '#dff1ff' : '#ffe98c'), 0.9)
  }
  return base.lerp(new THREE.Color(1, 1, 1), 0.55)
}

export function createPfxMeshShaderRenderPolicy(
  meshShader: NonNullable<PfxSurfaceTuning['meshShader']> | string,
): { blending: THREE.Blending; depthWrite: boolean; side: THREE.Side } {
  if (meshShader === 'electric-wake') {
    // Additive energy is required by the preview bloom stack. The bolt's
    // rapidly changing closed cross-section also needs both shell sides so a
    // sharp kink never loses its hot lane as the camera orbits.
    return { blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }
  }
  if (meshShader === 'acid-pool') {
    return { blending: THREE.NormalBlending, depthWrite: false, side: THREE.DoubleSide }
  }
  if (meshShader === 'barrier-failure-shell') {
    return { blending: THREE.NormalBlending, depthWrite: false, side: THREE.FrontSide }
  }
  const frontSide = meshShader === 'fresnel-shell' || meshShader === 'hex-shell' || meshShader === 'hologram-shell' ||
    meshShader === 'force-field-shell' || meshShader === 'heal-wave' ||
    meshShader === 'bubble-surface' || meshShader === 'fire-body' || meshShader === 'fire-erode'
  return {
    blending: meshShader === 'fire-body' ? THREE.NormalBlending : THREE.AdditiveBlending,
    depthWrite: meshShader === 'fire-body',
    side: frontSide ? THREE.FrontSide : THREE.DoubleSide,
  }
}

export function createPfxWarningLoopLifecycle(cycle: number): {
  progress: number
  opacity: number
  pulse: number
  stage: 'inhale' | 'alert' | 'hold' | 'exhale'
} {
  const progress = THREE.MathUtils.clamp(cycle, 0, 1)
  if (progress >= 1) return { progress: 1, opacity: 0.42, pulse: 0, stage: 'inhale' }
  if (progress < 0.24) {
    const rise = progress / 0.24
    return { progress, opacity: roundMetric(0.42 + rise * 0.36), pulse: roundMetric(rise * 0.55), stage: 'inhale' }
  }
  if (progress < 0.42) return { progress, opacity: 1, pulse: 1, stage: 'alert' }
  if (progress < 0.64) return { progress, opacity: 0.92, pulse: 1, stage: 'hold' }
  const release = (progress - 0.64) / 0.36
  return {
    progress,
    opacity: roundMetric(0.92 - release * 0.5),
    pulse: roundMetric(1 - release),
    stage: 'exhale',
  }
}

export function createPfxWarningLoopRuntimeState(
  elapsedSeconds: number,
  timing: number,
  lifetime: number,
  tempo: number,
  motionMultiplier: number,
  target?: PfxWarningLoopRuntimeState,
): PfxWarningLoopRuntimeState {
  const rate = Math.max(0.05, timing) * Math.max(0.1, tempo) * Math.max(0.1, motionMultiplier)
  const periodSeconds = 1.08 * Math.max(0.25, lifetime)
  const cycle = ((Math.max(0, elapsedSeconds) * rate) % periodSeconds) / periodSeconds
  const lifecycle = createPfxWarningLoopLifecycle(cycle)
  const state = target ?? { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, pulse: 0, lift: 0, stage: 'inhale' }
  state.cycle = cycle
  state.periodSeconds = periodSeconds
  state.progress = lifecycle.progress
  state.opacity = lifecycle.opacity
  state.pulse = lifecycle.pulse
  state.lift = THREE.MathUtils.clamp((cycle - 0.12) / 0.3, 0, 1)
  state.stage = lifecycle.stage
  return state
}

export function createPfxMarkerReleaseLifecycle(cycle: number): {
  progress: number
  opacity: number
  expansion: number
  lift: number
  stage: 'clamp' | 'confirm' | 'release' | 'settle'
} {
  const progress = THREE.MathUtils.clamp(cycle, 0, 1)
  if (progress < 0.18) {
    const rise = progress / 0.18
    return { progress, opacity: roundMetric(0.32 + rise * 0.68), expansion: roundMetric(rise * 0.12), lift: 0, stage: 'clamp' }
  }
  if (progress < 0.38) {
    const confirm = (progress - 0.18) / 0.2
    return { progress, opacity: 1, expansion: roundMetric(0.12 + confirm * 0.38), lift: roundMetric(confirm * 0.15), stage: 'confirm' }
  }
  if (progress < 0.72) {
    const release = (progress - 0.38) / 0.34
    return { progress, opacity: roundMetric(1 - release * 0.28), expansion: roundMetric(0.5 + release * 0.5), lift: roundMetric(0.15 + release * 0.85), stage: 'release' }
  }
  const settle = (progress - 0.72) / 0.28
  return { progress, opacity: roundMetric(0.72 * (1 - settle)), expansion: 1, lift: 1, stage: 'settle' }
}

export function createPfxMarkerReleaseRuntimeState(
  elapsedSeconds: number,
  timing: number,
  lifetime: number,
  tempo: number,
  motionMultiplier: number,
  target?: PfxMarkerReleaseRuntimeState,
): PfxMarkerReleaseRuntimeState {
  const rate = Math.max(0.05, timing) * Math.max(0.1, tempo) * Math.max(0.1, motionMultiplier)
  const periodSeconds = 0.92 * Math.max(0.25, lifetime)
  const cycle = THREE.MathUtils.clamp((Math.max(0, elapsedSeconds) * rate) / periodSeconds, 0, 1)
  const lifecycle = createPfxMarkerReleaseLifecycle(cycle)
  const state = target ?? { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, expansion: 0, lift: 0, stage: 'clamp' }
  state.cycle = cycle
  state.periodSeconds = periodSeconds
  state.progress = lifecycle.progress
  state.opacity = lifecycle.opacity
  state.expansion = lifecycle.expansion
  state.lift = lifecycle.lift
  state.stage = lifecycle.stage
  return state
}

export function createPfxScanConeLifecycle(cycle: number): {
  progress: number
  opacity: number
  sweep: number
  range: number
  stage: 'acquire' | 'sweep' | 'resolve'
} {
  const progress = THREE.MathUtils.clamp(cycle, 0, 1)
  if (progress < 0.18) {
    const acquire = progress / 0.18
    return { progress, opacity: roundMetric(0.3 + acquire * 0.7), sweep: 0, range: roundMetric(0.22 + acquire * 0.18), stage: 'acquire' }
  }
  if (progress < 0.72) {
    const sweep = (progress - 0.18) / 0.54
    return { progress, opacity: 1, sweep: roundMetric(sweep), range: roundMetric(0.4 + sweep * 0.6), stage: 'sweep' }
  }
  const resolve = (progress - 0.72) / 0.28
  return { progress, opacity: roundMetric(1 - resolve), sweep: 1, range: 1, stage: 'resolve' }
}

export function createPfxScanConeRuntimeState(
  elapsedSeconds: number,
  timing: number,
  lifetime: number,
  tempo: number,
  motionMultiplier: number,
  target?: PfxScanConeRuntimeState,
): PfxScanConeRuntimeState {
  const rate = Math.max(0.05, timing) * Math.max(0.1, tempo) * Math.max(0.1, motionMultiplier)
  const periodSeconds = 1.05 * Math.max(0.25, lifetime)
  const cycle = THREE.MathUtils.clamp((Math.max(0, elapsedSeconds) * rate) / periodSeconds, 0, 1)
  const lifecycle = createPfxScanConeLifecycle(cycle)
  const state = target ?? { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, sweep: 0, range: 0, stage: 'acquire' }
  state.cycle = cycle
  state.periodSeconds = periodSeconds
  state.progress = lifecycle.progress
  state.opacity = lifecycle.opacity
  state.sweep = lifecycle.sweep
  state.range = lifecycle.range
  state.stage = lifecycle.stage
  return state
}

export function createPfxHologramBreakLifecycle(cycle: number): {
  progress: number
  opacity: number
  breakAmount: number
  scan: number
  collapse: number
  stage: 'stabilize' | 'fracture' | 'collapse'
} {
  const progress = THREE.MathUtils.clamp(cycle, 0, 1)
  if (progress < 0.22) {
    const stabilize = progress / 0.22
    return {
      progress,
      opacity: roundMetric(0.45 + stabilize * 0.55),
      breakAmount: roundMetric(stabilize * 0.08),
      scan: roundMetric(0.08 + stabilize * 0.1),
      collapse: 0,
      stage: 'stabilize',
    }
  }
  if (progress < 0.64) {
    const fracture = (progress - 0.22) / 0.42
    return {
      progress,
      opacity: 1,
      breakAmount: roundMetric(0.08 + fracture * 0.72),
      scan: roundMetric(0.18 + fracture * 0.62),
      collapse: 0,
      stage: 'fracture',
    }
  }
  const collapse = (progress - 0.64) / 0.36
  return {
    progress,
    opacity: roundMetric(1 - collapse),
    breakAmount: roundMetric(0.8 + collapse * 0.2),
    scan: 1,
    collapse: roundMetric(collapse),
    stage: 'collapse',
  }
}

export function createPfxHologramBreakRuntimeState(
  elapsedSeconds: number,
  timing: number,
  lifetime: number,
  tempo: number,
  motionMultiplier: number,
  target?: PfxHologramBreakRuntimeState,
): PfxHologramBreakRuntimeState {
  const rate = Math.max(0.05, timing) * Math.max(0.1, tempo) * Math.max(0.1, motionMultiplier)
  const periodSeconds = 1.1 * Math.max(0.25, lifetime)
  const cycle = THREE.MathUtils.clamp((Math.max(0, elapsedSeconds) * rate) / periodSeconds, 0, 1)
  const lifecycle = createPfxHologramBreakLifecycle(cycle)
  const state = target ?? { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, breakAmount: 0, scan: 0, collapse: 0, stage: 'stabilize' }
  state.cycle = cycle
  state.periodSeconds = periodSeconds
  state.progress = lifecycle.progress
  state.opacity = lifecycle.opacity
  state.breakAmount = lifecycle.breakAmount
  state.scan = lifecycle.scan
  state.collapse = lifecycle.collapse
  state.stage = lifecycle.stage
  return state
}

export function createPfxThrusterTrailLifecycle(cycle: number): {
  progress: number
  opacity: number
  flow: number
  thrust: number
  cutoff: number
  stage: 'ignite' | 'sustain' | 'cutoff'
} {
  const progress = THREE.MathUtils.clamp(cycle, 0, 1)
  if (progress < 0.18) {
    const ignite = progress / 0.18
    return { progress, opacity: roundMetric(0.35 + ignite * 0.65), flow: roundMetric(ignite * 0.2), thrust: roundMetric(0.3 + ignite * 0.7), cutoff: 0, stage: 'ignite' }
  }
  if (progress < 0.72) {
    const sustain = (progress - 0.18) / 0.54
    return { progress, opacity: 1, flow: roundMetric(0.2 + sustain * 0.65), thrust: 1, cutoff: 0, stage: 'sustain' }
  }
  const cutoff = (progress - 0.72) / 0.28
  return { progress, opacity: roundMetric(1 - cutoff), flow: roundMetric(0.85 + cutoff * 0.15), thrust: roundMetric(1 - cutoff * 0.55), cutoff: roundMetric(cutoff), stage: 'cutoff' }
}

export function createPfxThrusterTrailRuntimeState(
  elapsedSeconds: number,
  timing: number,
  lifetime: number,
  tempo: number,
  motionMultiplier: number,
  target?: PfxThrusterTrailRuntimeState,
): PfxThrusterTrailRuntimeState {
  const rate = Math.max(0.05, timing) * Math.max(0.1, tempo) * Math.max(0.1, motionMultiplier)
  const periodSeconds = 1.2 * Math.max(0.25, lifetime)
  const cycle = THREE.MathUtils.clamp((Math.max(0, elapsedSeconds) * rate) / periodSeconds, 0, 1)
  const lifecycle = createPfxThrusterTrailLifecycle(cycle)
  const state = target ?? { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, flow: 0, thrust: 0, cutoff: 0, stage: 'ignite' }
  state.cycle = cycle
  state.periodSeconds = periodSeconds
  state.progress = lifecycle.progress
  state.opacity = lifecycle.opacity
  state.flow = lifecycle.flow
  state.thrust = lifecycle.thrust
  state.cutoff = lifecycle.cutoff
  state.stage = lifecycle.stage
  return state
}

export function createPfxExhaustTelegraphLifecycle(cycle: number): {
  progress: number
  opacity: number
  urgency: number
  ventOpen: number
  release: number
  stage: 'arm' | 'countdown' | 'vent'
} {
  const progress = THREE.MathUtils.clamp(cycle, 0, 1)
  if (progress < 0.18) {
    const arm = progress / 0.18
    return { progress, opacity: roundMetric(0.42 + arm * 0.58), urgency: 0, ventOpen: 0, release: 0, stage: 'arm' }
  }
  if (progress < 0.82) {
    const urgency = (progress - 0.18) / 0.64
    return { progress, opacity: 1, urgency: roundMetric(urgency), ventOpen: 0, release: 0, stage: 'countdown' }
  }
  const release = (progress - 0.82) / 0.18
  return { progress, opacity: Math.max(0, roundMetric(1 - release)), urgency: 1, ventOpen: roundMetric(release), release: roundMetric(release), stage: 'vent' }
}

const PFX_FLAME_BURST_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uProgress;
  uniform float uBloom;
  uniform float uHeat;
  uniform float uPeel;
  uniform float uCool;
  uniform float uDensity;
  uniform float uStyleEdgeHardness;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vFlameBurstUv;
  varying float vTongueId;
  varying vec3 vFlameBurstNormal;
  varying vec3 vFlameBurstView;
  void main() {
    float neonStyle = step(0.5, uStyleEdgeHardness);
    float aaWidth = max(fwidth(vFlameBurstUv.x + vFlameBurstUv.y), 0.0015);
    float threeBroadTongues = mix(1.0, 0.72, step(2.5, vTongueId));
    float fiveNarrowTongues = 1.0;
    float tongueTopology = mix(threeBroadTongues, fiveNarrowTongues, neonStyle);
    float facing = abs(dot(normalize(vFlameBurstNormal), normalize(vFlameBurstView)));
    float rim = pow(1.0 - facing, mix(1.8, 0.85, neonStyle));
    float verticalBand = floor(vFlameBurstUv.y * mix(3.0, 5.0, uDensity)) / max(2.0, mix(3.0, 5.0, uDensity));
    float matteBandedBody = mix(0.72, 1.0, verticalBand) * mix(0.8, 1.0, facing);
    float veinCell = abs(fract(vFlameBurstUv.x * 7.0 + vFlameBurstUv.y * 2.0 + vTongueId * 0.37) - 0.5) * 2.0;
    float edgeVeinedBody = max(rim, smoothstep(0.72, 0.72 + aaWidth * 3.0, 1.0 - veinCell) * 0.72);
    float bodyResponse = mix(matteBandedBody, edgeVeinedBody, neonStyle);
    float charThreshold = 1.18 - uCool * 1.25;
    float charFront = smoothstep(charThreshold - 0.1, charThreshold + 0.04, vFlameBurstUv.y);
    float cellHash = fract(floor(vFlameBurstUv.x * 11.0) * 0.47 + floor(vFlameBurstUv.y * 13.0) * 0.73 + vTongueId * 0.29);
    float cellErode = step(cellHash, uCool * mix(0.58, 0.82, uDensity));
    float erosion = mix(charFront * 0.28, cellErode * 0.88, neonStyle);
    float rootHeat = 1.0 - smoothstep(0.0, 0.62, vFlameBurstUv.y);
    float heatBand = clamp(uHeat * 0.28 + rootHeat * 0.7 + (1.0 - vFlameBurstUv.y) * 0.08 + rim * neonStyle * 0.28, 0.0, 1.0);
    vec3 hotColor = mix(uColorA, uColorB, heatBand);
    float foldDistance = abs(fract(vFlameBurstUv.x * 3.0 + vTongueId * 0.13) - 0.5) * 2.0;
    float innerFold = 1.0 - smoothstep(0.08, 0.42, foldDistance);
    hotColor = mix(hotColor, uColorB * 1.28, innerFold * mix(0.16, 0.48, neonStyle) * uHeat);
    vec3 charColor = uColorA * mix(0.18, 0.34, vFlameBurstUv.y);
    vec3 color = mix(hotColor * 1.34, charColor, charFront * mix(0.78, 0.36, neonStyle));
    float tipVeil = mix(1.0, 0.84, smoothstep(0.7, 1.0, vFlameBurstUv.y));
    float breakupGate = step(0.08, uCool);
    float massSurvival = mix(1.0, step(cellHash, uOpacity), breakupGate);
    float silhouette = tongueTopology * tipVeil * (1.0 - erosion) * massSurvival;
    if (silhouette < 0.18) discard;
    color *= mix(0.82, 1.14, bodyResponse);
    gl_FragColor = vec4(color, 1.0);
  }
`

export function createPfxFlameBurstMaterial(
  opacity: number,
  colorA: THREE.ColorRepresentation = '#ff7a18',
  colorB: THREE.ColorRepresentation = '#ffd166',
  density = 0.55,
  styleEdgeHardness = 0.22,
): THREE.ShaderMaterial {
  const primary = new THREE.Color(colorA)
  const secondary = new THREE.Color(colorB).lerp(new THREE.Color('#fff4cf'), 0.28)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uProgress: { value: 0 },
      uBloom: { value: 0 },
      uHeat: { value: 0 },
      uPeel: { value: 0 },
      uCool: { value: 0 },
      uDensity: { value: THREE.MathUtils.clamp(density, 0.05, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
      uColorA: { value: new THREE.Vector3(primary.r, primary.g, primary.b) },
      uColorB: { value: new THREE.Vector3(secondary.r, secondary.g, secondary.b) },
    },
    transparent: false,
    blending: THREE.NormalBlending,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: PFX_FLAME_BURST_VERTEX,
    fragmentShader: PFX_FLAME_BURST_FRAGMENT,
  })
  material.userData['pfxFlameBurstMaterial'] = true
  material.userData['pfxFlameBurstDrawCalls'] = 1
  material.userData['pfxFlameBurstTriangles'] = 480
  material.userData['pfxFlameBurstParticleCount'] = 0
  material.userData['pfxFlameBurstFragmentTextureSamples'] = 0
  material.userData['pfxFlameBurstTransientAllocationsPerFrame'] = 0
  material.userData['pfxFlameBurstMeshJustification'] = 'five-closed-folded-flame-tongues-with-integrated-char-decay'
  return material
}

const PFX_METEOR_BURST_VERTEX = /* glsl */ `
  uniform float uProgress;
  uniform float uImpact;
  uniform float uScatter;
  uniform float uDensity;
  uniform float uStyleEdgeHardness;
  attribute float aMeteorPart;
  attribute vec3 aMeteorOrigin;
  attribute vec3 aMeteorDirection;
  attribute float aMeteorSeed;
  varying vec3 vMeteorLocal;
  varying vec3 vMeteorNormal;
  varying vec3 vMeteorView;
  varying float vMeteorPart;
  varying float vMeteorSeed;
  void main() {
    float neonStyle = step(0.5, uStyleEdgeHardness);
    float headPart = 1.0 - step(0.5, aMeteorPart);
    float crownPart = step(0.5, aMeteorPart) * (1.0 - step(1.5, aMeteorPart));
    float ejectaPart = step(1.5, aMeteorPart) * (1.0 - step(2.5, aMeteorPart));
    float groundPart = step(2.5, aMeteorPart);
    vec3 local = position - aMeteorOrigin;
    float impactEase = uImpact * uImpact * (3.0 - 2.0 * uImpact);
    float descentProgress = clamp(uProgress / 0.22, 0.0, 1.0);

    vec3 incomingPosition = local * mix(0.9, 1.0, descentProgress) + aMeteorOrigin + aMeteorDirection * descentProgress;
    float crownScale = mix(0.08, mix(1.12, 0.92, neonStyle), impactEase);
    vec3 crownPosition = aMeteorOrigin * impactEase + local * crownScale;

    float staggeredBallistic = clamp((uImpact - aMeteorSeed * 0.22) / max(0.2, 1.0 - aMeteorSeed * 0.22), 0.0, 1.0);
    float synchronizedRail = impactEase;
    float ballisticLaunch = mix(staggeredBallistic, synchronizedRail, neonStyle);
    float ejectaWidth = mix(1.12, 0.74, neonStyle) * mix(0.86, 1.12, uDensity);
    vec3 ejectaPosition = aMeteorOrigin * ballisticLaunch + local * mix(0.12, ejectaWidth, ballisticLaunch);
    ejectaPosition += aMeteorDirection * uScatter * mix(0.62, 0.78, neonStyle);
    ejectaPosition.y -= uScatter * uScatter * (0.92 + aMeteorSeed * 0.38);

    vec3 radialGround = aMeteorOrigin * impactEase + local * mix(0.08, 1.0, impactEase);
    vec3 chevronGround = radialGround;
    chevronGround.x *= 1.2;
    chevronGround.z *= 0.64;
    chevronGround.x += sign(aMeteorDirection.x) * uScatter * 0.16;
    vec3 groundPosition = mix(radialGround, chevronGround, neonStyle);

    vec3 animatedPosition = incomingPosition * headPart
      + crownPosition * crownPart
      + ejectaPosition * ejectaPart
      + groundPosition * groundPart;
    vec4 worldPosition = modelMatrix * vec4(animatedPosition, 1.0);
    vMeteorLocal = local;
    vMeteorNormal = normalize(mat3(modelMatrix) * normal);
    vMeteorView = normalize(cameraPosition - worldPosition.xyz);
    vMeteorPart = aMeteorPart;
    vMeteorSeed = aMeteorSeed;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const PFX_METEOR_BURST_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uProgress;
  uniform float uImpact;
  uniform float uFlash;
  uniform float uScatter;
  uniform float uCool;
  uniform float uHead;
  uniform float uDensity;
  uniform float uStyleEdgeHardness;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec3 vMeteorLocal;
  varying vec3 vMeteorNormal;
  varying vec3 vMeteorView;
  varying float vMeteorPart;
  varying float vMeteorSeed;
  void main() {
    float neonStyle = step(0.5, uStyleEdgeHardness);
    float headPart = 1.0 - step(0.5, vMeteorPart);
    float crownPart = step(0.5, vMeteorPart) * (1.0 - step(1.5, vMeteorPart));
    float ejectaPart = step(1.5, vMeteorPart) * (1.0 - step(2.5, vMeteorPart));
    float groundPart = step(2.5, vMeteorPart);
    float facing = abs(dot(normalize(vMeteorNormal), normalize(vMeteorView)));
    float rim = pow(1.0 - facing, mix(2.1, 0.82, neonStyle));
    float aaWidth = max(fwidth(vMeteorLocal.x + vMeteorLocal.y + vMeteorLocal.z), 0.0015);

    float fiveBroadEjecta = mix(1.0, step(vMeteorSeed, 0.66), ejectaPart);
    float eightNarrowEjecta = 1.0;
    float densityGate = mix(1.0, step(vMeteorSeed, mix(0.48, 1.0, uDensity)), ejectaPart);
    float chunkTopology = mix(fiveBroadEjecta, eightNarrowEjecta, neonStyle) * densityGate;

    float strataCoordinate = fract(vMeteorLocal.y * 4.2 + vMeteorLocal.x * 1.7 + vMeteorSeed * 3.1);
    float matteLavaStrata = mix(0.7, 1.0, step(0.46, strataCoordinate)) * mix(0.8, 1.0, facing);
    float fissureCoordinate = abs(fract(vMeteorLocal.x * 5.0 + vMeteorLocal.y * 3.2 + vMeteorLocal.z * 4.1 + vMeteorSeed * 2.7) - 0.5) * 2.0;
    float edgeHotFissures = max(rim, 1.0 - smoothstep(0.08, 0.08 + aaWidth * 4.0, fissureCoordinate));
    float materialResponse = mix(matteLavaStrata, edgeHotFissures, neonStyle);

    float brokenWedgeFan = mix(1.0, step(vMeteorSeed, 0.88), groundPart);
    float splitChevronFront = mix(1.0, step(0.2, abs(vMeteorNormal.x)), groundPart);
    float groundFront = mix(brokenWedgeFan, splitChevronFront, neonStyle);
    float headLife = uHead * headPart;
    float crownLife = uImpact * (1.0 - uCool * 0.82) * crownPart;
    float ejectaLife = uImpact * (1.0 - uCool * 0.66) * ejectaPart;
    float groundLife = uImpact * (1.0 - uCool * 0.88) * groundPart;
    float partLife = headLife + crownLife + ejectaLife + groundLife;
    float componentSurvival = step(vMeteorSeed * 0.52, uOpacity);
    float silhouette = partLife * chunkTopology * groundFront * componentSurvival;
    if (silhouette < 0.08) discard;

    float coreHeat = clamp(uFlash * 0.34 + crownPart * 0.5 + rim * neonStyle * 0.24, 0.0, 1.0);
    vec3 hotColor = mix(uColorA * 0.92, uColorB * 1.16, coreHeat);
    vec3 charColor = uColorA * mix(0.07, 0.2, materialResponse);
    float moltenSeam = max(edgeHotFissures * mix(0.32, 1.0, neonStyle), step(0.78, strataCoordinate));
    vec3 headCrust = mix(charColor * 0.72, uColorB * 1.12, moltenSeam * mix(0.52, 0.9, uFlash));
    float leadMeteor = headPart * (1.0 - step(0.18, vMeteorSeed));
    float meteorTail = headPart - leadMeteor;
    vec3 tailHeat = mix(uColorA * 0.82, uColorB * 1.12, 0.28 + moltenSeam * 0.46 + uFlash * 0.16);
    float compressionCore = crownPart * (1.0 - step(0.18, vMeteorSeed));
    float crownProng = crownPart - compressionCore;
    float hotUnderside = 1.0 - smoothstep(-0.22, 0.58, normalize(vMeteorNormal).y);
    vec3 compressionColor = mix(charColor * 0.58, uColorB * 1.08, max(moltenSeam * 0.58, hotUnderside * uFlash * 0.5));
    vec3 crownHeat = mix(uColorA * 0.78, hotColor, 0.34 + materialResponse * 0.32);
    vec3 ejectaHeat = mix(charColor * 1.5, hotColor * 0.82, 0.3 + materialResponse * 0.42);
    vec3 groundHeat = mix(charColor * 1.24, uColorA * 0.66, materialResponse * 0.44 + uFlash * 0.12);
    vec3 color = headCrust * leadMeteor + tailHeat * meteorTail + compressionColor * compressionCore + crownHeat * crownProng + ejectaHeat * ejectaPart + groundHeat * groundPart;
    color = mix(color, charColor, uCool * mix(0.94, 0.64, crownPart));
    color += uColorB * edgeHotFissures * neonStyle * uFlash * 0.24;
    gl_FragColor = vec4(color, 1.0);
  }
`

export function createPfxMeteorBurstMaterial(
  opacity: number,
  colorA: THREE.ColorRepresentation = '#ff7a18',
  colorB: THREE.ColorRepresentation = '#ffd166',
  density = 0.38,
  styleEdgeHardness = 0.22,
): THREE.ShaderMaterial {
  const primary = new THREE.Color(colorA)
  const secondary = new THREE.Color(colorB).lerp(new THREE.Color('#fff0b0'), 0.24)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uProgress: { value: 0 },
      uImpact: { value: 0 },
      uFlash: { value: 0 },
      uScatter: { value: 0 },
      uCool: { value: 0 },
      uHead: { value: 1 },
      uDensity: { value: THREE.MathUtils.clamp(density, 0.05, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
      uColorA: { value: new THREE.Vector3(primary.r, primary.g, primary.b) },
      uColorB: { value: new THREE.Vector3(secondary.r, secondary.g, secondary.b) },
    },
    transparent: false,
    blending: THREE.NormalBlending,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: PFX_METEOR_BURST_VERTEX,
    fragmentShader: PFX_METEOR_BURST_FRAGMENT,
  })
  material.userData['pfxMeteorBurstMaterial'] = true
  material.userData['pfxMeteorBurstDrawCalls'] = 1
  material.userData['pfxMeteorBurstParticleCount'] = 0
  material.userData['pfxMeteorBurstFragmentTextureSamples'] = 0
  material.userData['pfxMeteorBurstTransientAllocationsPerFrame'] = 0
  material.userData['pfxMeteorBurstMeshJustification'] = 'oblique-meteor-collision-with-integrated-crown-ejecta-and-broken-ground-front'
  return material
}

export const PFX_BLAST_BURST_VERTEX = /* glsl */ `
  uniform float uCompression; uniform float uBreach; uniform float uScatter; uniform float uVacuum; uniform float uDensity; uniform float uStyleEdgeHardness;
  attribute float aBlastPart; attribute vec3 aBlastOrigin; attribute vec3 aBlastDirection; attribute float aBlastSeed;
  varying vec3 vBlastLocal; varying vec3 vBlastNormal; varying vec3 vBlastView; varying float vBlastPart; varying float vBlastSeed;
  void main() {
    float neonStyle = step(0.5, uStyleEdgeHardness);
    float corePart = 1.0 - step(0.5, aBlastPart);
    float platePart = step(0.5, aBlastPart) * (1.0 - step(1.5, aBlastPart));
    float slugPart = step(1.5, aBlastPart) * (1.0 - step(2.5, aBlastPart));
    float spearPart = step(2.5, aBlastPart);
    vec3 local = position - aBlastOrigin;
    float breachEase = uBreach * uBreach * (3.0 - 2.0 * uBreach);
    vec3 compressed = local * mix(0.8, 0.72, uCompression) + aBlastOrigin * (1.0 - uCompression * 0.7);
    vec3 corePosition = local * mix(0.42, 1.0, breachEase) * mix(1.0, 0.34, uVacuum);
    vec3 platePosition = local * mix(0.18, mix(1.0, 0.68, neonStyle), breachEase) + aBlastOrigin * breachEase;
    float staggeredTumble = clamp((uScatter - aBlastSeed * 0.18) / max(0.2, 1.0 - aBlastSeed * 0.18), 0.0, 1.0);
    float synchronizedBoltOut = uScatter;
    float launch = mix(staggeredTumble, synchronizedBoltOut, neonStyle);
    vec3 slugPosition = local + aBlastOrigin * breachEase + aBlastDirection * launch * mix(0.72, 1.0, uDensity);
    slugPosition.y -= launch * launch * (0.18 + aBlastSeed * 0.18);
    vec3 spearPosition = local * mix(0.12, mix(1.05, 0.74, neonStyle), breachEase) + aBlastOrigin * breachEase + aBlastDirection * uScatter * 0.22;
    vec3 released = corePosition * corePart + platePosition * platePart + slugPosition * slugPart + spearPosition * spearPart;
    vec3 animatedPosition = mix(compressed, released, breachEase);
    vec4 worldPosition = modelMatrix * vec4(animatedPosition, 1.0);
    vBlastLocal = local; vBlastNormal = normalize(mat3(modelMatrix) * normal); vBlastView = normalize(cameraPosition - worldPosition.xyz); vBlastPart = aBlastPart; vBlastSeed = aBlastSeed;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

export const PFX_BLAST_BURST_FRAGMENT = /* glsl */ `
  uniform float uOpacity; uniform float uCompression; uniform float uBreach; uniform float uFlash; uniform float uScatter; uniform float uVacuum; uniform float uDensity; uniform float uStyleEdgeHardness;
  uniform vec3 uColorA; uniform vec3 uColorB;
  varying vec3 vBlastLocal; varying vec3 vBlastNormal; varying vec3 vBlastView; varying float vBlastPart; varying float vBlastSeed;
  void main() {
    float neonStyle = step(0.5, uStyleEdgeHardness);
    float corePart = 1.0 - step(0.5, vBlastPart);
    float platePart = step(0.5, vBlastPart) * (1.0 - step(1.5, vBlastPart));
    float slugPart = step(1.5, vBlastPart) * (1.0 - step(2.5, vBlastPart));
    float spearPart = step(2.5, vBlastPart);
    float facing = abs(dot(normalize(vBlastNormal), normalize(vBlastView)));
    float rim = pow(1.0 - facing, mix(2.2, 0.78, neonStyle));
    float aa = max(fwidth(vBlastLocal.x + vBlastLocal.y + vBlastLocal.z), 0.0015);
    float sixBroadPressurePlates = mix(1.0, step(vBlastSeed, 0.86), platePart);
    float sixNarrowContainmentRibs = mix(1.0, step(0.22, abs(vBlastNormal.x) + abs(vBlastNormal.z)), platePart);
    float topology = mix(sixBroadPressurePlates, sixNarrowContainmentRibs, neonStyle);
    float strata = fract(vBlastLocal.y * 4.6 + vBlastLocal.x * 1.8 + vBlastSeed * 2.3);
    float matteCompressionStrata = mix(0.7, 1.0, step(0.48, strata));
    float edgeHotPressureFacets = max(rim, 1.0 - smoothstep(0.08, 0.08 + aa * 4.0, abs(strata - 0.5)));
    float materialResponse = mix(matteCompressionStrata, edgeHotPressureFacets, neonStyle);
    float brokenCrossSpears = mix(1.0, step(vBlastSeed, 0.82), spearPart);
    float splitOctantSpears = mix(1.0, step(0.18, abs(vBlastNormal.y)), spearPart);
    float wakeStructure = mix(brokenCrossSpears, splitOctantSpears, neonStyle);
    float densityGate = mix(1.0, step(vBlastSeed, mix(0.5, 1.0, uDensity)), slugPart + spearPart);
    float coreLife = (uCompression + uBreach * max(0.0, 1.0 - uVacuum * 1.65)) * corePart;
    float plateLife = uBreach * (1.0 - uVacuum * 0.82) * platePart;
    float slugLife = uBreach * (1.0 - uVacuum * 0.62) * slugPart;
    float spearLife = uBreach * (1.0 - uVacuum * 0.9) * spearPart;
    float survival = step(vBlastSeed * 0.5, uOpacity);
    if ((coreLife + plateLife + slugLife + spearLife) * topology * wakeStructure * densityGate * survival < 0.08) discard;
    vec3 pressureWhite = uColorB * (1.0 + uFlash * 0.22);
    vec3 pressureOrange = uColorA * mix(0.52, 0.94, materialResponse);
    vec3 graphite = uColorA * mix(0.055, 0.14, materialResponse);
    vec3 coreColor = mix(pressureOrange, pressureWhite, 0.5 + uFlash * 0.42);
    vec3 plateColor = mix(pressureOrange, pressureWhite, rim * mix(0.2, 0.72, neonStyle));
    vec3 slugColor = mix(graphite, uColorA * 0.64, materialResponse * 0.44);
    vec3 spearColor = mix(graphite * 1.35, pressureOrange, rim * 0.5 + uFlash * 0.12);
    vec3 color = coreColor * corePart + plateColor * platePart + slugColor * slugPart + spearColor * spearPart;
    color = mix(color, graphite, uVacuum * mix(0.92, 0.62, slugPart));
    gl_FragColor = vec4(color, 1.0);
  }
`

export const PFX_SHOCKWAVE_BURST_VERTEX = /* glsl */ `
  uniform float uCompression; uniform float uExpansion; uniform float uFront; uniform float uAttenuation; uniform float uDensity; uniform float uStyleEdgeHardness;
  attribute float aShockPart; attribute vec3 aShockOrigin; attribute vec3 aShockDirection; attribute float aShockSeed;
  varying vec3 vShockLocal; varying vec3 vShockNormal; varying vec3 vShockView; varying float vShockPart; varying float vShockSeed;
  void main() {
    float neonStyle = step(0.5, uStyleEdgeHardness);
    float lensPart = 1.0 - step(0.5, aShockPart); float arcPart = step(0.5, aShockPart) * (1.0 - step(1.5, aShockPart)); float fleckPart = step(1.5, aShockPart);
    vec3 local = position - aShockOrigin;
    float staggeredFront = clamp((uFront - aShockSeed * 0.16) / max(0.18, 1.0 - aShockSeed * 0.16), 0.0, 1.0);
    float synchronizedFront = uFront;
    float propagation = mix(staggeredFront, synchronizedFront, neonStyle);
    vec3 lensPosition = local * mix(0.34, 1.0, uCompression) * mix(1.0, 0.18, uExpansion);
    vec3 rounded = local * mix(0.16, 1.0, propagation) + aShockOrigin * propagation;
    vec3 chevron = rounded; chevron.x *= mix(1.0, 1.12, abs(aShockDirection.x)); chevron.z *= mix(1.0, 1.12, abs(aShockDirection.z)); chevron.y += abs(aShockDirection.x - aShockDirection.z) * 0.08 * propagation;
    vec3 arcPosition = mix(rounded, chevron, neonStyle);
    vec3 fleckPosition = local + aShockOrigin * propagation + aShockDirection * propagation * mix(0.18, 0.38, uDensity);
    vec3 animatedPosition = lensPosition * lensPart + arcPosition * arcPart + fleckPosition * fleckPart;
    vec4 worldPosition = modelMatrix * vec4(animatedPosition, 1.0);
    vShockLocal = local; vShockNormal = normalize(mat3(modelMatrix) * normal); vShockView = normalize(cameraPosition - worldPosition.xyz); vShockPart = aShockPart; vShockSeed = aShockSeed;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

export const PFX_SHOCKWAVE_BURST_FRAGMENT = /* glsl */ `
  uniform float uOpacity; uniform float uCompression; uniform float uExpansion; uniform float uFront; uniform float uAttenuation; uniform float uDensity; uniform float uStyleEdgeHardness; uniform vec3 uColorA; uniform vec3 uColorB;
  varying vec3 vShockLocal; varying vec3 vShockNormal; varying vec3 vShockView; varying float vShockPart; varying float vShockSeed;
  void main() {
    float neonStyle = step(0.5, uStyleEdgeHardness); float lensPart = 1.0 - step(0.5, vShockPart); float arcPart = step(0.5, vShockPart) * (1.0 - step(1.5, vShockPart)); float fleckPart = step(1.5, vShockPart);
    float facing = abs(dot(normalize(vShockNormal), normalize(vShockView))); float rim = pow(1.0 - facing, mix(2.2, 0.72, neonStyle)); float aa = max(fwidth(vShockLocal.x + vShockLocal.y + vShockLocal.z), 0.0015);
    float tenBroadPressureArcs = mix(1.0, step(vShockSeed, 0.72), arcPart); float fourteenNarrowPressureArcs = 1.0; float topology = mix(tenBroadPressureArcs, fourteenNarrowPressureArcs, neonStyle);
    float strata = fract(vShockLocal.x * 3.4 + vShockLocal.z * 3.1 + vShockSeed * 2.7); float matteAirStrata = mix(0.68, 1.0, step(0.46, strata)); float edgeHotRefraction = max(rim, 1.0 - smoothstep(0.08, 0.08 + aa * 4.0, abs(strata - 0.5))); float response = mix(matteAirStrata, edgeHotRefraction, neonStyle);
    float roundedBow = mix(1.0, step(-0.3, vShockNormal.y), arcPart); float splitChevronBow = mix(1.0, step(0.16, abs(vShockNormal.x) + abs(vShockNormal.z)), arcPart); float dome = mix(roundedBow, splitChevronBow, neonStyle);
    float densityGate = mix(1.0, step(vShockSeed, mix(0.45, 1.0, uDensity)), fleckPart);
    float lensLife = (uCompression + uExpansion * max(0.0, 1.0 - uFront * 3.2)) * lensPart; float arcLife = uExpansion * (1.0 - uAttenuation * 0.92) * arcPart; float fleckLife = uExpansion * (1.0 - uAttenuation * 0.72) * fleckPart;
    if ((lensLife + arcLife + fleckLife) * topology * dome * densityGate * step(vShockSeed * 0.46, uOpacity) < 0.08) discard;
    vec3 airDark = uColorA * mix(0.08, 0.18, response); vec3 frontColor = mix(uColorA * 1.05, uColorB * 1.28, 0.32 + rim * mix(0.58, 0.64, neonStyle)); vec3 lensColor = mix(uColorA * 1.04, uColorB * 1.24, 0.42 + facing * 0.28 + uCompression * 0.1); vec3 fleckColor = mix(airDark, uColorB * 0.94, response * 0.72);
    vec3 color = lensColor * lensPart + frontColor * arcPart + fleckColor * fleckPart; color = mix(color, airDark, uAttenuation * mix(0.38, 0.62, fleckPart)); gl_FragColor = vec4(color, 1.0);
  }
`

export const PFX_DUST_BURST_VERTEX = /* glsl */ `
  uniform float uCompression; uniform float uRoll; uniform float uLoft; uniform float uSettle; uniform float uDensity; uniform float uStyleEdgeHardness;
  attribute float aDustPart; attribute vec3 aDustOrigin; attribute vec3 aDustDirection; attribute float aDustSeed;
  varying vec3 vDustLocal; varying vec3 vDustNormal; varying vec3 vDustView; varying float vDustPart; varying float vDustSeed;
  void main() {
    float hardStyle=step(.5,uStyleEdgeHardness); float corePart=1.0-step(.5,aDustPart); float lobePart=step(.5,aDustPart)*(1.0-step(1.5,aDustPart)); float skirtPart=step(1.5,aDustPart)*(1.0-step(2.5,aDustPart)); float gritPart=step(2.5,aDustPart);
    vec3 local=position-aDustOrigin; float staggeredGroundRoll=clamp((uRoll-aDustSeed*.18)/max(.2,1.0-aDustSeed*.18),0.0,1.0); float synchronizedGroundRoll=uRoll; float rollout=mix(staggeredGroundRoll,synchronizedGroundRoll,hardStyle);
    vec3 corePosition=local*mix(.38,1.0,uCompression)*mix(1.0,.58,uRoll); vec3 lobePosition=local*mix(.18,1.0,rollout)*mix(1.0,.28,uSettle)+aDustOrigin*rollout; lobePosition.y+=uLoft*(.05+aDustSeed*.16)-uSettle*(.1+aDustSeed*.16);
    vec3 skirtPosition=local*mix(.2,1.0,rollout)*mix(1.0,.36,uSettle)+aDustOrigin*rollout+aDustDirection*uRoll*.2; skirtPosition.y-=uSettle*.08; vec3 gritPosition=local*mix(1.0,.38,uSettle)+aDustOrigin*rollout+aDustDirection*uRoll*mix(.18,.38,uDensity); gritPosition.y+=uLoft*(.08+aDustSeed*.2)-uSettle*(.2+aDustSeed*.22);
    vec3 animatedPosition=corePosition*corePart+lobePosition*lobePart+skirtPosition*skirtPart+gritPosition*gritPart; vec4 worldPosition=modelMatrix*vec4(animatedPosition,1.0); vDustLocal=local; vDustNormal=normalize(mat3(modelMatrix)*normal); vDustView=normalize(cameraPosition-worldPosition.xyz); vDustPart=aDustPart; vDustSeed=aDustSeed; gl_Position=projectionMatrix*viewMatrix*worldPosition;
  }
`

export const PFX_DUST_BURST_FRAGMENT = /* glsl */ `
  uniform float uOpacity; uniform float uCompression; uniform float uRoll; uniform float uLoft; uniform float uSettle; uniform float uDensity; uniform float uStyleEdgeHardness; uniform vec3 uColorA; uniform vec3 uColorB;
  varying vec3 vDustLocal; varying vec3 vDustNormal; varying vec3 vDustView; varying float vDustPart; varying float vDustSeed;
  void main() {
    float hardStyle=step(.5,uStyleEdgeHardness); float corePart=1.0-step(.5,vDustPart); float lobePart=step(.5,vDustPart)*(1.0-step(1.5,vDustPart)); float skirtPart=step(1.5,vDustPart)*(1.0-step(2.5,vDustPart)); float gritPart=step(2.5,vDustPart); float facing=abs(dot(normalize(vDustNormal),normalize(vDustView))); float rim=pow(1.0-facing,mix(2.4,.8,hardStyle)); float aa=max(fwidth(vDustLocal.x+vDustLocal.y+vDustLocal.z),.0015);
    float eightBroadRollLobes=mix(1.0,step(vDustSeed,.68),lobePart); float twelveCutRollLobes=1.0; float topology=mix(eightBroadRollLobes,twelveCutRollLobes,hardStyle); float band=fract(vDustLocal.y*2.2+vDustLocal.x*1.15+vDustSeed*2.1); float mattePigmentBands=mix(.86,1.02,smoothstep(.18,.82,band)); float edgeLitPigmentFacets=max(rim,1.0-smoothstep(.08,.08+aa*4.0,abs(band-.5))); float response=mix(mattePigmentBands,edgeLitPigmentFacets,hardStyle);
    float roundedCrown=mix(1.0,step(-.42,vDustNormal.y),lobePart); float splitCrown=mix(1.0,step(.12,abs(vDustNormal.x)+abs(vDustNormal.z)),lobePart); float crown=mix(roundedCrown,splitCrown,hardStyle); float densityGate=mix(1.0,step(vDustSeed,mix(.38,1.0,uDensity)),gritPart); float coreLife=(uCompression+max(.16,uRoll)*(1.0-uSettle*.9))*corePart; float lobeLife=uRoll*(1.0-uSettle*.82)*lobePart; float skirtLife=uRoll*(1.0-uSettle*.9)*skirtPart; float gritLife=uRoll*(1.0-uSettle*.64)*gritPart;
    if((coreLife+lobeLife+skirtLife+gritLife)*topology*crown*densityGate*step(vDustSeed*.5,uOpacity)<.08)discard; vec3 deepPigment=uColorA*mix(.6,.76,response); vec3 warmDust=mix(uColorA*.96,uColorB*1.16,.42+facing*.26)*mix(.9,1.04,response); vec3 edgeDust=mix(deepPigment,uColorB,response*.46); vec3 color=warmDust*(corePart+lobePart)+deepPigment*skirtPart+edgeDust*gritPart; color=mix(color,deepPigment*.78,uSettle*mix(.28,.52,gritPart)); gl_FragColor=vec4(pow(color,vec3(.8)),1.0);
  }
`

export const PFX_DEBRIS_BURST_VERTEX = /* glsl */ `
  uniform float uFracture; uniform float uEject; uniform float uFall; uniform float uDensity; uniform float uStyleEdgeHardness;
  attribute float aDebrisPart; attribute vec3 aDebrisOrigin; attribute vec3 aDebrisDirection; attribute vec3 aDebrisAxis; attribute float aDebrisSeed;
  varying vec3 vDebrisLocal; varying vec3 vDebrisNormal; varying vec3 vDebrisView; varying float vDebrisPart; varying float vDebrisSeed;
  vec3 rotateDebris(vec3 value,vec3 axis,float angle){axis=normalize(axis);return value*cos(angle)+cross(axis,value)*sin(angle)+axis*dot(axis,value)*(1.0-cos(angle));}
  void main() {
    float hardStyle=step(.5,uStyleEdgeHardness); float heroPart=1.0-step(.5,aDebrisPart); float midPart=step(.5,aDebrisPart)*(1.0-step(1.5,aDebrisPart)); float splinterPart=step(1.5,aDebrisPart);
    float staggeredChunkFan=clamp((uEject-aDebrisSeed*.16)/max(.2,1.0-aDebrisSeed*.16),0.0,1.0); float synchronizedShatter=uEject; float release=mix(staggeredChunkFan,synchronizedShatter,hardStyle); float partTravel=heroPart*.72+midPart*.62+splinterPart*.8; float spin=release*(.4+aDebrisSeed*2.8)+uFall*(.55+aDebrisSeed*1.6); vec3 local=rotateDebris(position-aDebrisOrigin,aDebrisAxis,spin); vec3 rotatedNormal=rotateDebris(normal,aDebrisAxis,spin);
    vec3 originScale=vec3(mix(.3,.42,uFracture),mix(.17,.28,uFracture),mix(.3,.42,uFracture)); vec3 assembledOrigin=aDebrisOrigin*originScale; float ballisticLift=release*(.07+aDebrisDirection.y*.33+(aDebrisSeed-.5)*.1); float ballisticDrop=uFall*(.48+aDebrisSeed*.42)+uFall*uFall*.34; vec3 travel=vec3(aDebrisDirection.x*.78,0.0,aDebrisDirection.z*.9)*release*partTravel; travel.x+=release*.304; travel.z-=release*.414; travel.y+=ballisticLift-ballisticDrop; float fractureExpansion=1.0+min(uEject,.2)*.12; float fallScale=mix(1.0,heroPart*.42+midPart*.28+splinterPart*.18,uFall); vec3 animatedPosition=local*mix(.78,1.0,uFracture)*fractureExpansion*fallScale+assembledOrigin+travel;
    vec4 worldPosition=modelMatrix*vec4(animatedPosition,1.0); vDebrisLocal=local; vDebrisNormal=normalize(mat3(modelMatrix)*rotatedNormal); vDebrisView=normalize(cameraPosition-worldPosition.xyz); vDebrisPart=aDebrisPart; vDebrisSeed=aDebrisSeed; gl_Position=projectionMatrix*viewMatrix*worldPosition;
  }
`

export const PFX_DEBRIS_BURST_FRAGMENT = /* glsl */ `
  uniform float uOpacity; uniform float uProgress; uniform float uFracture; uniform float uEject; uniform float uFall; uniform float uDarken; uniform float uDensity; uniform float uStyleEdgeHardness; uniform vec3 uColorA; uniform vec3 uColorB;
  varying vec3 vDebrisLocal; varying vec3 vDebrisNormal; varying vec3 vDebrisView; varying float vDebrisPart; varying float vDebrisSeed;
  void main() {
    float hardStyle=step(.5,uStyleEdgeHardness); float heroPart=1.0-step(.5,vDebrisPart); float midPart=step(.5,vDebrisPart)*(1.0-step(1.5,vDebrisPart)); float splinterPart=step(1.5,vDebrisPart); float facing=abs(dot(normalize(vDebrisNormal),normalize(vDebrisView))); float rim=pow(1.0-facing,mix(2.6,.78,hardStyle)); float aa=max(fwidth(vDebrisLocal.x+vDebrisLocal.y+vDebrisLocal.z),.0015);
    float broadChiseledSlabs=mix(1.0,step(vDebrisSeed,mix(.48,.86,uDensity)),midPart+splinterPart); float densityReveal=smoothstep(.05,.55,uDensity); float sharpCutFragments=mix(1.0,step(vDebrisSeed,mix(.18,1.0,densityReveal)),midPart+splinterPart); float topology=mix(broadChiseledSlabs,sharpCutFragments,hardStyle); float facet=dot(abs(normalize(vDebrisNormal)),normalize(vec3(.46,.86,.58))); float softStoneFacets=mix(.74,1.04,smoothstep(.38,.88,facet)); float edgeLitFractures=max(.58+facet*.34,smoothstep(.32-aa*3.0,.32+aa*3.0,rim)); float response=mix(softStoneFacets,edgeLitFractures,hardStyle);
    float roundedBreak=mix(1.0,.84+.16*smoothstep(-.2,.55,vDebrisNormal.y),midPart+splinterPart); float splitBreak=mix(1.0,step(.16,abs(vDebrisNormal.x)+abs(vDebrisNormal.z)),heroPart+midPart); float profile=mix(roundedBreak,splitBreak,hardStyle); float survival=step(vDebrisSeed*.1,uOpacity)*step(uDarken*(.52+vDebrisSeed*.34),.96); if(topology*profile*survival<.08)discard;
    float exposedFacet=step(.38,vDebrisSeed)*(heroPart+midPart)*(.12+.12*hardStyle); float freshFace=clamp((1.0-facing)*uFracture*(1.0-uDarken*.7)*.45+splinterPart*.16+exposedFacet,0.0,1.0); vec3 stone=uColorA*mix(.7,1.06,response); vec3 breakFace=mix(uColorA,uColorB,.78)*mix(.94,1.2,response); vec3 color=mix(stone,breakFace,freshFace*.56+midPart*.06); color=mix(color,uColorA*.34,uDarken*.72); gl_FragColor=vec4(pow(color,vec3(.82)),1.0);
  }
`

export function buildPfxMeshShaderMaterial(
  meshShader: NonNullable<PfxSurfaceTuning['meshShader']>,
  materialProps: PfxSurfaceMaterialProps,
): THREE.ShaderMaterial {
  if (meshShader === 'combo-ring-meter') return createPfxComboRingMaterial(materialProps.opacity, materialProps.color, 1, 0.5, 3)
  if (meshShader === 'ui-pickup-receipt') return createPfxUiPickupMaterial(materialProps.opacity, materialProps.color)
  if (meshShader === 'target-spawn-reticle') return createPfxTargetSpawnMaterial('reticle', materialProps.opacity, materialProps.color)
  if (meshShader === 'target-spawn-pin') return createPfxTargetSpawnMaterial('pin', materialProps.opacity, materialProps.color)
  if (meshShader === 'warning-loop-panel') return createPfxWarningLoopMaterial('panel', materialProps.opacity, materialProps.color)
  if (meshShader === 'warning-loop-beacon') return createPfxWarningLoopMaterial('beacon', materialProps.opacity, materialProps.color)
  if (meshShader === 'marker-release-ground') return createPfxMarkerReleaseMaterial('ground', materialProps.opacity, materialProps.color)
  if (meshShader === 'marker-release-badge') return createPfxMarkerReleaseMaterial('badge', materialProps.opacity, materialProps.color)
  if (meshShader === 'scan-cone-footprint') return createPfxScanConeMaterial('footprint', materialProps.opacity, materialProps.color)
  if (meshShader === 'scan-cone-volume') return createPfxScanConeMaterial('volume', materialProps.opacity, materialProps.color)
  if (meshShader === 'hologram-break-figure') return createPfxHologramBreakMaterial('figure', materialProps.opacity, materialProps.color)
  if (meshShader === 'hologram-break-projector') return createPfxHologramBreakMaterial('projector', materialProps.opacity, materialProps.color)
  if (meshShader === 'thruster-trail-plume') return createPfxThrusterTrailMaterial('plume', materialProps.opacity, materialProps.color)
  if (meshShader === 'thruster-trail-nozzle') return createPfxThrusterTrailMaterial('nozzle', materialProps.opacity, materialProps.color)
  if (meshShader === 'exhaust-telegraph-lane') return createPfxExhaustTelegraphMaterial('lane', materialProps.opacity, materialProps.color)
  if (meshShader === 'exhaust-telegraph-vent') return createPfxExhaustTelegraphMaterial('vent', materialProps.opacity, materialProps.color)
  if (meshShader === 'flame-burst-blossom') return createPfxFlameBurstMaterial(materialProps.opacity, materialProps.color)
  if (meshShader === 'meteor-burst-collision') return createPfxMeteorBurstMaterial(materialProps.opacity, materialProps.color)
  const base = new THREE.Color(materialProps.color)
  // Fire shaders push toward YELLOW-white (the reference core color) —
  // a pure white lerp lands on pale peach.
  const hot = createPfxMeshShaderHotColor(meshShader, base)
  const renderPolicy = createPfxMeshShaderRenderPolicy(meshShader)
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCycle: { value: 0 },
      uArcErosion: { value: 0 },
      uBreak: { value: 0 },
      uHex: { value: meshShader === 'hex-shell' ? 1 : 0 },
      uConeFlow: { value: 0 },
      uUndulate: { value: meshShader === 'trail-flow' ? 0.045 : 0 },
      uWakeEnvelope: { value: 1 },
      uElectricReach: { value: 1 },
      uElectricDecay: { value: 0 },
      uOpacity: { value: materialProps.opacity },
      uColor: { value: new THREE.Vector3(base.r, base.g, base.b) },
      uColorHot: { value: new THREE.Vector3(hot.r, hot.g, hot.b) },
    },
    vertexShader: PFX_MESH_SHADER_VERTEX,
    fragmentShader: PFX_MESH_SHADER_FRAGMENTS[meshShader],
    transparent: true,
    // fire-body is a solid burning surface: additive orange over the glow
    // saturates to yellow-white (the projectile-review washout), and it must
    // occlude its own rear lobes.
    blending: renderPolicy.blending,
    side: renderPolicy.side,
    depthWrite: renderPolicy.depthWrite,
  })
}
