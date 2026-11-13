import * as THREE from 'three'
import { PFX_BURST_CYCLE_MULTIPLIER } from '../constants/04'

// Original curved sheet particles, drops, vapor, and bubbles. No textures.
export type PfxAcidBurstStage = 'impact' | 'eruption' | 'recede' | 'rest'

export interface PfxAcidBurstRuntimeState {
  cycle: number
  stage: PfxAcidBurstStage
  energy: number
  flare: number
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const smooth = (value: number) => {
  const x = clamp01(value)
  return x * x * (3 - 2 * x)
}

export function createPfxAcidBurstRuntimeState(
  input: {
    elapsedSeconds: number
    timing: number
    lifetime: number
    tempo: number
    motionMultiplier: number
    cycleScale: number
    reducedMotion: boolean
  },
  target?: PfxAcidBurstRuntimeState,
): PfxAcidBurstRuntimeState {
  // Use the same clock as warp, frost, and getPfxBurstCycleSeconds.
  const timeScale = Math.max(0.05, input.timing) * input.motionMultiplier * Math.max(0.1, input.tempo)
  const span = Math.max(0.3, Math.max(0.25, input.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER * Math.max(1, input.cycleScale)
  const cycle = ((Math.max(0, input.elapsedSeconds) * timeScale) % span) / span
  const state = target ?? { cycle: 0, stage: 'rest', energy: 0, flare: 0 }
  state.cycle = cycle
  state.stage = cycle >= 0.87 ? 'rest' : cycle < 0.07 ? 'impact' : cycle < 0.3 ? 'eruption' : 'recede'
  state.energy = smooth(cycle / 0.025) * (1 - smooth((cycle - 0.67) / 0.17))
  state.flare = smooth(cycle / 0.03) * (1 - smooth((cycle - 0.04) / 0.08))
  return state
}

const ACID_SHAPE = /* glsl */ `
uniform float uCycle;
uniform float uMotion;
float sat(float x) { return clamp(x,0.0,1.0); }
float ease(float x) { x=sat(x); return x*x*(3.0-2.0*x); }
vec3 sheetPoint(vec2 q, vec4 part, vec4 flight) {
  float age=max(0.0,uCycle-part.y);
  float rise=ease(age/0.085);
  float tear=ease((age-0.11)/0.20);
  float y=q.y*0.5+0.5;
  float curl=ease((age-0.075)/0.20)*uMotion;
  float theta=part.x+q.x*part.z*3.0+uMotion*0.12*sin(flight.w*7.0)*tear;
  float radius=flight.x+0.16*y+0.28*y*y;
  radius+=uMotion*(0.07*rise+0.20*tear*y);
  radius-=0.17*curl*y*y*y;
  radius+=0.09*sin(q.x*4.8+flight.w*5.0)*y*y;
  vec3 radial=vec3(cos(theta),0.0,sin(theta));
  vec3 p=radial*radius;
  float upper=1.0-0.37*curl*y;
  p.y=-0.28+sin(y*2.05)*flight.y*(0.25+0.75*rise)*(0.6+0.4*uMotion)*upper;
  p.y+=uMotion*(0.10*(q.x*q.x-0.3)*sin(y*2.8)*rise-0.7*age*age);
  p.y+=0.055*sin(q.x*5.4+flight.w*6.0)*y*y*rise*uMotion;
  return p;
}
`

const ACID_BODY_VERTEX = /* glsl */ `
attribute vec2 aCorner;
attribute vec4 aPart;
attribute vec4 aFlight;
varying vec2 vLocal;
varying vec3 vNormal;
varying vec3 vView;
varying float vAge;
varying float vSeed;
varying float vKind;
varying float vVisible;
${ACID_SHAPE}
void main() {
  float age=uCycle-aPart.y;
  vec3 p;
  vLocal=aCorner;
  vAge=max(0.0,age);
  vSeed=aFlight.w;
  vKind=aPart.w;
  vVisible=step(0.0,age)*(1.0-step(aFlight.z,age));
  if(aPart.w<0.5) {
    p=sheetPoint(aCorner,aPart,aFlight);
    vec3 dx=sheetPoint(aCorner+vec2(0.003,0.0),aPart,aFlight)-sheetPoint(aCorner-vec2(0.003,0.0),aPart,aFlight);
    vec3 dy=sheetPoint(aCorner+vec2(0.0,0.003),aPart,aFlight)-sheetPoint(aCorner-vec2(0.0,0.003),aPart,aFlight);
    vNormal=normalize(normalMatrix*cross(dx,dy));
    vec4 view=modelViewMatrix*vec4(p,1.0);
    vView=view.xyz;
    gl_Position=projectionMatrix*view;
  } else {
    float t=max(0.0,age);
    vec3 radial=vec3(cos(aPart.x),0.0,sin(aPart.x));
    p=radial*aFlight.x;
    p.y=-0.16+0.15*aFlight.w;
    p+=uMotion*(radial*(t*(1.0+aFlight.w))+vec3(0.0,aFlight.y*t-4.8*t*t,0.0));
    float shrink=1.0-ease((t-aFlight.z*0.72)/(aFlight.z*0.28));
    float size=aPart.z*shrink;
    vec4 view=modelViewMatrix*vec4(p,1.0);
    float turn=uMotion*(aFlight.w-0.5)*t*3.0;
    vec2 q=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*aCorner;
    view.xy+=q*vec2(size,size*(1.18+0.15*sin(t*8.0)))*length(modelViewMatrix[0].xyz);
    vNormal=vec3(0.0,0.0,1.0);
    vView=view.xyz;
    gl_Position=projectionMatrix*view;
  }
}
`

export const PFX_ACID_BURST_BODY_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform float uEnergy;
uniform float uFlare;
uniform vec3 uColor;
uniform vec3 uDeep;
uniform vec3 uHot;
varying vec2 vLocal;
varying vec3 vNormal;
varying vec3 vView;
varying float vAge;
varying float vSeed;
varying float vKind;
varying float vVisible;
void main() {
  vec3 n;
  float alpha;
  float thin;
  float broken=1.0;
  float edgeLight=0.0;
  if(vKind<0.5) {
    vec2 q=vLocal;
    float y=q.y*0.5+0.5;
    float outline=1.0-dot(q*vec2(1.13,1.09),q*vec2(1.13,1.09));
    outline-=0.10*sin(q.x*9.0+vSeed*9.0)*sin(y*4.0);
    outline-=0.08*sin(q.y*11.0+vSeed*13.0);
    float opening=smoothstep(0.035,0.21,vAge);
    vec2 holeA=(q-vec2(-0.18+vSeed*0.18,0.20))*vec2(1.1,1.35);
    float hole=length(holeA)-opening*(0.16+vSeed*0.20);
    float tearA=length((q-vec2(-0.88,0.12+vSeed*0.30))*vec2(1.0,1.2))-opening*0.60;
    float tearB=length((q-vec2(0.62,0.82))*vec2(1.1,0.9))-opening*0.70;
    float tearC=length((q-vec2(0.93,-0.30))*vec2(1.2,0.9))-opening*0.47;
    float erosion=smoothstep(0.13,0.31,vAge)*(0.13+0.7*y);
    float boundary=min(min(outline-erosion,hole),min(tearA,min(tearB,tearC)));
    if(boundary<0.008) discard;
    float edge=1.0-smoothstep(0.015,0.09,boundary);
    thin=clamp(0.18+y*0.54+abs(q.x)*0.24-0.30*cos(q.x*3.14159)*sin(y*3.14159)+edge*0.15,0.0,1.0);
    n=normalize(vNormal);
    if(!gl_FrontFacing) n=-n;
    alpha=(0.43-0.18*y+edge*0.14)*(1.0-smoothstep(0.22,0.315,vAge));
    broken=smoothstep(-0.35,0.65,sin(q.x*17.0+q.y*9.0+vSeed*9.0));
    float edgeDistance=(boundary-0.026)/0.018;
    edgeLight=exp(-edgeDistance*edgeDistance)*broken;
  } else {
    float r2=dot(vLocal,vLocal);
    if(r2>0.96) discard;
    float z=sqrt(max(0.0,1.0-r2));
    n=normalize(vec3(vLocal,z));
    thin=0.4+0.4*(1.0-z);
    alpha=0.78*smoothstep(0.0,0.10,1.0-r2);
  }
  vec3 eye=normalize(-vView);
  vec3 light=normalize(vec3(-0.45,0.75,0.8));
  float spec=pow(max(0.0,dot(reflect(-light,n),eye)),44.0)*broken;
  spec+=pow(max(0.0,dot(reflect(-normalize(vec3(0.55,0.4,0.7)),n),eye)),90.0)*0.35;
  vec3 reflection=reflect(-eye,n);
  float reflectedBand=(reflection.y-0.38)/0.075;
  float wetBand=exp(-reflectedBand*reflectedBand)*smoothstep(-0.3,0.4,reflection.z);
  float lowerBand=(reflection.y+0.32)/0.045;
  wetBand+=exp(-lowerBand*lowerBand)*0.55;
  spec+=wetBand*0.90*broken;
  if(vKind<0.5) alpha+=(edgeLight*0.46+clamp(spec,0.0,1.0)*0.38)*(1.0-smoothstep(0.22,0.315,vAge));
  float facing=abs(dot(n,eye));
  float rim=(1.0-facing)*(1.0-facing);
  float diffuse=max(0.0,dot(n,light));
  vec3 color=mix(uDeep,mix(uColor,uHot,0.20),0.17+thin*0.48+diffuse*0.22);
  color=mix(color,uHot,clamp(thin*0.13+spec*0.78+rim*0.12+edgeLight*0.62+uFlare*0.025,0.0,0.87));
  alpha*=uOpacity*uEnergy*vVisible;
  if(alpha<0.001) discard;
  gl_FragColor=vec4(color,alpha);
  #include <colorspace_fragment>
}
`

const ACID_ACCENT_VERTEX = /* glsl */ `
attribute vec2 aCorner;
attribute vec4 aPart;
attribute vec4 aFlight;
varying vec2 vLocal;
varying float vAge;
varying float vKind;
varying float vVisible;
${ACID_SHAPE}
void main() {
  float t=max(0.0,uCycle-aPart.y);
  float age=t/aFlight.z;
  vec3 p=vec3(cos(aPart.x)*aFlight.x,-0.12,sin(aPart.x)*aFlight.x-0.12);
  p+=uMotion*vec3(cos(aPart.x)*t*0.14,aFlight.y*t-0.2*t*t,sin(aPart.x)*t*0.14);
  float size=aPart.z*(aPart.w<0.5?0.6+age*0.8:1.0);
  vec4 view=modelViewMatrix*vec4(p,1.0);
  view.xy+=aCorner*size*length(modelViewMatrix[0].xyz);
  vLocal=aCorner;
  vAge=age;
  vKind=aPart.w;
  vVisible=step(aPart.y,uCycle)*(1.0-step(1.0,age));
  gl_Position=projectionMatrix*view;
}
`

export const PFX_ACID_BURST_ACCENT_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform float uEnergy;
uniform vec3 uColor;
uniform vec3 uDeep;
uniform vec3 uHot;
varying vec2 vLocal;
varying float vAge;
varying float vKind;
varying float vVisible;
void main() {
  float r=length(vLocal);
  float alpha;
  vec3 color;
  if(vKind<0.5) {
    float tuft=exp(-dot(vLocal*vec2(1.0,0.8),vLocal*vec2(1.0,0.8))*4.0);
    tuft*=0.8+0.2*sin(vLocal.x*8.0+vLocal.y*5.0);
    alpha=tuft*(1.0-smoothstep(0.5,1.0,r))*sin(clamp(vAge,0.0,1.0)*3.14159265)*0.16;
    color=mix(uDeep,uHot,0.48);
  } else {
    float rim=exp(-((r-0.75)*(r-0.75))/0.012);
    alpha=rim*(1.0-smoothstep(0.45,1.0,vAge))*0.5;
    color=mix(uColor,uHot,0.55);
  }
  alpha*=uOpacity*uEnergy*vVisible;
  if(alpha<0.001) discard;
  gl_FragColor=vec4(color,alpha);
  #include <colorspace_fragment>
}
`

function acidMaterial(opacity: number, color: THREE.ColorRepresentation, accent: boolean): THREE.ShaderMaterial {
  const base = new THREE.Color(color)
  const hsl = { h: 0, s: 0, l: 0 }
  base.getHSL(hsl)
  const hot = new THREE.Color().setHSL((hsl.h + 0.925) % 1, hsl.s * 0.74, 0.67)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uCycle: { value: 0 }, uMotion: { value: 1 }, uEnergy: { value: 0 }, uFlare: { value: 0 },
      uOpacity: { value: clamp01(opacity) }, uColor: { value: base },
      uDeep: { value: base.clone().multiplyScalar(0.12) }, uHot: { value: hot },
    },
    vertexShader: accent ? ACID_ACCENT_VERTEX : ACID_BODY_VERTEX,
    fragmentShader: accent ? PFX_ACID_BURST_ACCENT_FRAGMENT : PFX_ACID_BURST_BODY_FRAGMENT,
    transparent: true, blending: THREE.NormalBlending, depthWrite: false,
    side: THREE.DoubleSide, toneMapped: false,
  })
  material.forceSinglePass = true
  return material
}

export function createPfxAcidBurstBodyMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return acidMaterial(opacity, color, false)
}
export function createPfxAcidBurstAccentMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return acidMaterial(opacity, color, true)
}

export function applyPfxAcidBurstUniforms(material: THREE.ShaderMaterial, state: PfxAcidBurstRuntimeState, opacity: number, reducedMotion: boolean): void {
  const u = material.uniforms
  u.uCycle!.value = state.cycle
  u.uEnergy!.value = state.energy
  u.uOpacity!.value = state.stage === 'rest' ? 0 : clamp01(opacity)
  u.uMotion!.value = reducedMotion ? 0.4 : 1
  u.uFlare!.value = state.flare * (reducedMotion ? 0.35 : 1)
}

interface AcidParticle {
  part: [number, number, number, number]
  flight: [number, number, number, number]
  segments: number
}

function acidParticles(particles: AcidParticle[]): THREE.BufferGeometry {
  const corner: number[] = []
  const part: number[] = []
  const flight: number[] = []
  const indices: number[] = []
  for (const particle of particles) {
    const start = corner.length / 2
    const n = particle.segments
    for (let y = 0; y <= n; y++) for (let x = 0; x <= n; x++) {
      corner.push(x / n * 2 - 1, y / n * 2 - 1)
      part.push(...particle.part)
      flight.push(...particle.flight)
    }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const a = start + y * (n + 1) + x
      const b = a + n + 1
      indices.push(a, a + 1, b, a + 1, b + 1, b)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(corner.length / 2 * 3), 3))
  geometry.setAttribute('aCorner', new THREE.Float32BufferAttribute(corner, 2))
  geometry.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 4))
  geometry.setAttribute('aFlight', new THREE.Float32BufferAttribute(flight, 4))
  geometry.setIndex(indices)
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.05, 0), 1.8)
  return geometry
}

const random = (i: number, salt: number) => {
  const value = Math.sin(i * 127.1 + salt) * 43758.5453
  return value - Math.floor(value)
}

export function createPfxAcidBurstBodyGeometry(): THREE.BufferGeometry {
  const sheets: AcidParticle[] = [
    { part: [3.8, 0.005, 0.40, 0], flight: [0.06, 0.58, 0.39, 0.24], segments: 18 },
    { part: [0.48, 0.014, 0.37, 0], flight: [0.07, 0.45, 0.34, 0.71], segments: 18 },
    { part: [2.1, 0.008, 0.32, 0], flight: [0.08, 0.50, 0.37, 0.45], segments: 18 },
    { part: [5.4, 0.035, 0.20, 0], flight: [0.10, 0.32, 0.25, 0.84], segments: 14 },
    { part: [2.85, 0.055, 0.18, 0], flight: [0.12, 0.28, 0.22, 0.14], segments: 14 },
    { part: [0.05, 0.07, 0.16, 0], flight: [0.11, 0.24, 0.21, 0.57], segments: 14 },
  ]
  for (let i = 0; i < 24; i++) {
    const s = random(i, 3.7)
    sheets.push({
      part: [i * 2.39996323, 0.045 + s * 0.13, 0.013 + random(i, 17.8) * 0.024, 1],
      flight: [0.14 + random(i, 4.8) * 0.25, 1.25 + random(i, 8.1) * 1.7, 0.27 + s * 0.12, s],
      segments: 1,
    })
  }
  return acidParticles(sheets)
}

export function createPfxAcidBurstAccentGeometry(): THREE.BufferGeometry {
  const particles: AcidParticle[] = []
  for (let i = 0; i < 8; i++) {
    const s = random(i, 17.3)
    const vapor = i < 4
    particles.push({
      part: [i * 2.39996323, vapor ? 0.24 + s * 0.08 : 0.06 + s * 0.12, vapor ? 0.12 + s * 0.07 : 0.024 + s * 0.012, vapor ? 0 : 1],
      flight: [0.08 + s * 0.17, vapor ? 0.35 + s * 0.2 : 0.6, vapor ? 0.43 : 0.18, s],
      segments: 1,
    })
  }
  return acidParticles(particles)
}
