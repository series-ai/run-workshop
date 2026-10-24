import * as THREE from 'three'
import { PFX_BURST_CYCLE_MULTIPLIER } from '../constants/04'

// Original closed gel surface and shaded drops. No scene or texture samples.
export type PfxSlimeBurstStage = 'impact' | 'spread' | 'stretch' | 'recoil' | 'rest'

export interface PfxSlimeBurstRuntimeState {
  cycle: number
  stage: PfxSlimeBurstStage
  energy: number
  flare: number
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const smooth = (value: number) => {
  const x = clamp01(value)
  return x * x * (3 - 2 * x)
}

export function createPfxSlimeBurstRuntimeState(
  input: {
    elapsedSeconds: number
    timing: number
    lifetime: number
    tempo: number
    motionMultiplier: number
    cycleScale: number
    reducedMotion: boolean
  },
  target?: PfxSlimeBurstRuntimeState,
): PfxSlimeBurstRuntimeState {
  // Use the same clock as warp, frost, and getPfxBurstCycleSeconds.
  const timeScale = Math.max(0.05, input.timing) * input.motionMultiplier * Math.max(0.1, input.tempo)
  const span = Math.max(0.3, Math.max(0.25, input.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER * Math.max(1, input.cycleScale)
  const cycle = ((Math.max(0, input.elapsedSeconds) * timeScale) % span) / span
  const state = target ?? { cycle: 0, stage: 'rest', energy: 0, flare: 0 }
  state.cycle = cycle
  state.stage = cycle >= 0.87 ? 'rest' : cycle < 0.08 ? 'impact' : cycle < 0.22 ? 'spread' : cycle < 0.43 ? 'stretch' : 'recoil'
  state.energy = smooth(cycle / 0.025) * (1 - smooth((cycle - 0.67) / 0.17))
  state.flare = smooth(cycle / 0.03) * (1 - smooth((cycle - 0.04) / 0.08))
  return state
}

const SLIME_SHAPE = /* glsl */ `
uniform float uCycle;
uniform float uMotion;
float sat(float x) { return clamp(x,0.0,1.0); }
float ease(float x) { x=sat(x); return x*x*(3.0-2.0*x); }
const float GEL_BREAK=0.36;
const float GEL_NECK=0.70;
vec3 gelAxis(float t,float stretch) {
  float pull=(0.32*t+0.68*t*t)*stretch*uMotion;
  return vec3(0.90*pull,-0.31+t*(0.72+0.18*stretch*uMotion),-0.48*pull);
}
float gelRadius(float t,float stretch,float pinch) {
  float bulk=0.62*(1.0-0.13*stretch*uMotion);
  float neck=0.22*(1.0-pinch);
  float cap=0.245*(0.8+0.2*uMotion);
  float radius;
  if(t<0.28) {
    float a=(t-0.28)/0.28;
    radius=bulk*sqrt(max(0.0,1.0-a*a));
  } else if(t<0.70) {
    radius=mix(bulk,neck,ease((t-0.28)/0.42));
  } else if(t<0.85) {
    radius=mix(neck,cap,ease((t-0.70)/0.15));
  } else {
    float a=(t-0.85)/0.15;
    radius=cap*sqrt(max(0.0,1.0-a*a));
  }
  float sphere=0.62*sqrt(max(0.0,1.0-(t*2.0-1.0)*(t*2.0-1.0)));
  return mix(sphere,radius,stretch);
}
vec3 gelConnected(float t,float theta,float u) {
  t=clamp(t,0.0,1.0);
  float stretch=ease((u-0.10)/0.20);
  float pinch=ease((u-0.26)/0.10);
  vec3 center=gelAxis(t,stretch);
  vec3 tangent=normalize(gelAxis(min(1.0,t+0.001),stretch)-gelAxis(max(0.0,t-0.001),stretch));
  vec3 side=normalize(cross(tangent,vec3(0.0,0.0,1.0)));
  vec3 rear=normalize(cross(side,tangent));
  float radius=gelRadius(t,stretch,pinch);
  float bulkGate=1.0-ease((t-0.52)/0.18);
  float bulge=0.12*sin(theta*2.0+0.8)*sin(t*3.14159265);
  bulge+=0.055*cos(theta*3.0-1.0)*sin(t*6.2831853);
  radius*=1.0+bulge*bulkGate*(0.6+0.4*stretch);
  float compress=1.0-0.16*ease(u/0.10)*(1.0-stretch)*uMotion;
  vec3 p=center+(side*cos(theta)+rear*sin(theta)*0.88)*radius;
  p.y=-0.31+(p.y+0.31)*compress;
  // The lower mass moves toward the neck as the lobe takes its volume.
  p+=vec3(0.10,0.035,-0.05)*stretch*uMotion*sin(t*3.14159265)*bulkGate;
  return p;
}
vec3 gelUnretired(float t,float theta,float u) {
  vec3 p=gelConnected(t,theta,min(u,GEL_BREAK));
  if(u>=GEL_BREAK && t<=GEL_NECK) {
    float recoil=ease((u-GEL_BREAK)/0.16);
    float overshoot=sin(ease((u-GEL_BREAK)/0.26)*3.14159265)*0.075*uMotion;
    float b=clamp(t/GEL_NECK,0.0,1.0);
    float belly=sqrt(max(0.0,1.0-(2.0*b-1.0)*(2.0*b-1.0)));
    float uneven=1.0+0.13*sin(theta*2.0+0.6)*sin(b*3.14159265)+0.065*cos(theta*3.0)*sin(b*6.2831853);
    float width=0.55*(1.0+overshoot)*uneven;
    vec3 settled=vec3(cos(theta)*belly*width,-0.31+b*0.69/(1.0+overshoot),sin(theta)*belly*width*0.9);
    settled.x+=0.10*sin(b*3.14159265)-0.08*uMotion;
    settled.y+=0.045*sin(theta+0.4)*belly;
    p=mix(p,settled,recoil);
  }
  return p;
}
vec3 gelSurface(float t,float theta,float u) {
  vec3 p=gelUnretired(t,theta,u);
  float retire=1.0-ease((u-0.55)/0.27);
  // A uniform retreat preserves the curved surface normals.
  vec3 center=vec3(-0.02,-0.05,0.0);
  return center+(p-center)*retire;
}
vec3 gelNormal(float t,float theta,float u,float limit) {
  float low=limit>0.0?0.001:0.706;
  float high=limit>0.0?limit-0.006:0.999;
  float nT=clamp(t,low,high);
  vec3 dt=gelUnretired(nT+0.0003,theta,u)-gelUnretired(nT-0.0003,theta,u);
  vec3 da=gelUnretired(nT,theta+0.004,u)-gelUnretired(nT,theta-0.004,u);
  // At a collapsed ring, take the normal from the adjacent open surface.
  if(dot(da,da)==0.0) {
    nT=nT<=GEL_NECK?min(nT,GEL_NECK-0.006):max(nT,GEL_NECK+0.006);
    dt=gelUnretired(nT+0.0003,theta,u)-gelUnretired(nT-0.0003,theta,u);
    da=gelUnretired(nT,theta+0.004,u)-gelUnretired(nT,theta-0.004,u);
  }
  // Normalize each derivative before the cross product. Scale cannot flatten normals.
  dt*=inversesqrt(max(dot(dt,dt),1e-30));
  da*=inversesqrt(max(dot(da,da),1e-30));
  vec3 n=cross(dt,da);
  return n*inversesqrt(max(dot(n,n),1e-30));
}
vec3 gelCapPoint(float t,float theta) {
  return gelConnected(GEL_NECK+(1.0-GEL_NECK)*t,theta,GEL_BREAK);
}
vec3 gelLobeCenter() { return gelAxis(0.85,1.0); }
`

const SLIME_BODY_VERTEX = /* glsl */ `
attribute vec2 aGel;
varying vec3 vView;
varying vec3 vNormal;
varying float vT;
varying vec2 vSurface;
${SLIME_SHAPE}
void main() {
  float t=aGel.x;
  float theta=aGel.y;
  vec3 p=gelSurface(t,theta,uCycle);
  float limit=uCycle>=GEL_BREAK?GEL_NECK:1.0;
  if(t>GEL_NECK && uCycle>=GEL_BREAK) limit=0.0;
  vNormal=normalize(normalMatrix*gelNormal(t,theta,uCycle,limit));
  vec4 view=modelViewMatrix*vec4(p,1.0);
  vView=view.xyz;
  vT=t;
  vSurface=aGel;
  gl_Position=projectionMatrix*view;
}
`

export const PFX_SLIME_BURST_BODY_FRAGMENT = /* glsl */ `
uniform float uCycle;
uniform float uOpacity;
uniform float uEnergy;
uniform float uFlare;
uniform vec3 uColor;
uniform vec3 uDeep;
uniform vec3 uHot;
varying vec3 vView;
varying vec3 vNormal;
varying float vT;
varying vec2 vSurface;
void main() {
  // At the pinch the upper closed cap transfers to the detached drop batch.
  if(uCycle>=0.36 && vT>0.7) discard;
  vec3 n=normalize(vNormal);
  vec3 eye=normalize(-vView);
  vec3 light=normalize(vec3(-0.48,0.78,0.75));
  float facing=clamp(dot(n,eye),0.0,1.0);
  float rim=(1.0-facing)*(1.0-facing);
  float diffuse=max(0.0,dot(n,light));
  float wet=pow(max(0.0,dot(reflect(-light,n),eye)),19.0);
  float secondary=pow(max(0.0,dot(reflect(-normalize(vec3(0.75,0.3,0.5)),n),eye)),30.0);
  float thick=facing*(0.72+0.28*(1.0-vT));
  vec3 color=mix(uDeep,uColor,0.14+0.39*diffuse+rim*0.20-thick*0.14);
  color=mix(color,uHot,clamp(wet*0.70+secondary*0.20+rim*0.42+uFlare*0.025,0.0,0.85));
  float bubbles=0.0;
  for(int i=0;i<3;i++) {
    float k=float(i);
    float angle=vSurface.y-(0.8+k*2.0);
    angle=atan(sin(angle),cos(angle));
    vec2 q=vec2(angle*0.35,(vSurface.x-(0.36+0.07*sin(k*2.0)))*0.9);
    float r=length(q);
    float ring=exp(-((r-0.024)*(r-0.024))/0.000022);
    bubbles+=ring*0.16;
  }
  color=mix(color,uHot,clamp(bubbles,0.0,0.25));
  float alpha=(0.91+rim*0.06)*uOpacity*uEnergy;
  if(alpha<0.001) discard;
  gl_FragColor=vec4(color,alpha);
  #include <colorspace_fragment>
}
`

const SLIME_ACCENT_VERTEX = /* glsl */ `
attribute vec3 aSphere;
attribute vec4 aDrop;
attribute vec4 aFlight;
varying vec3 vNormal;
varying vec3 vView;
varying float vAge;
varying float vKind;
varying float vVisible;
${SLIME_SHAPE}
void main() {
  float t=max(0.0,uCycle-aDrop.y);
  float age=t/aFlight.z;
  vec3 normal;
  vec3 p;
  float shrink=1.0-ease((age-0.58)/0.42);
  float turn=uMotion*t*(0.8+aFlight.w);
  mat2 rotation=mat2(cos(turn),-sin(turn),sin(turn),cos(turn));
  if(aDrop.w<0.5) {
    float capT=(aSphere.y+1.0)*0.5;
    float theta=atan(aSphere.z,aSphere.x);
    vec3 center=gelLobeCenter();
    vec3 local=gelCapPoint(capT,theta)-center;
    local.xy=rotation*local.xy;
    p=center+local*shrink;
    float nT=clamp(capT,0.02,0.998);
    vec3 dt=gelCapPoint(nT+0.0002,theta)-gelCapPoint(nT-0.0002,theta);
    vec3 da=gelCapPoint(nT,theta+0.001)-gelCapPoint(nT,theta-0.001);
    normal=normalize(cross(normalize(dt),normalize(da)));
    normal.xy=rotation*normal.xy;
  } else {
    vec3 origin=gelSurface(0.53+0.06*sin(aDrop.x),aDrop.x,aDrop.y);
    float wobble=1.0+0.14*aSphere.x*aSphere.y;
    vec3 axes=vec3(aDrop.z,aDrop.z*1.15,aDrop.z*0.88);
    vec3 local=aSphere*axes*wobble*shrink;
    local.xy=rotation*local.xy;
    p=origin+local;
    normal=normalize(aSphere/axes);
    normal.xy=rotation*normal.xy;
  }
  vec3 velocity=vec3(cos(aDrop.x)*aFlight.x,aFlight.y,sin(aDrop.x)*aFlight.x);
  p+=uMotion*(velocity*t+vec3(0.0,-5.0*t*t,0.0));
  float visible=step(aDrop.y,uCycle)*(1.0-step(1.0,age));
  if(aDrop.w>1.5) {
    p=gelSurface(0.35+0.12*sin(aDrop.x),aDrop.x,uCycle)*0.72;
    p+=aSphere*aDrop.z;
    normal=aSphere;
    visible=1.0-ease((uCycle-0.56)/0.20);
  }
  vNormal=normalize(normalMatrix*normal);
  vec4 view=modelViewMatrix*vec4(p,1.0);
  vView=view.xyz;
  vAge=age;
  vKind=aDrop.w;
  vVisible=visible;
  gl_Position=projectionMatrix*view;

}
`

export const PFX_SLIME_BURST_ACCENT_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform float uEnergy;
uniform vec3 uColor;
uniform vec3 uDeep;
uniform vec3 uHot;
varying vec3 vNormal;
varying vec3 vView;
varying float vAge;
varying float vKind;
varying float vVisible;
void main() {
  vec3 n=normalize(vNormal);
  vec3 eye=normalize(-vView);
  vec3 light=normalize(vec3(-0.48,0.78,0.75));
  float facing=clamp(dot(n,eye),0.0,1.0);
  float rim=(1.0-facing)*(1.0-facing);
  float spec=pow(max(0.0,dot(reflect(-light,n),eye)),19.0);
  float diffuse=max(0.0,dot(n,light));
  vec3 color=mix(uDeep,uColor,0.18+diffuse*0.43);
  color=mix(color,uHot,clamp(spec*0.76+rim*0.32,0.0,0.85));
  float alpha=(0.91+rim*0.06)*uOpacity*uEnergy*vVisible;
  if(vKind>1.5) {
    color=mix(uColor,uHot,0.65);
    alpha*=rim*0.64+spec*0.3;
  }
  if(alpha<0.001) discard;
  gl_FragColor=vec4(color,alpha);
  #include <colorspace_fragment>
}
`

function slimeMaterial(opacity: number, color: THREE.ColorRepresentation, accent: boolean): THREE.ShaderMaterial {
  const base = new THREE.Color(color)
  return new THREE.ShaderMaterial({
    uniforms: {
      uCycle: { value: 0 }, uMotion: { value: 1 }, uEnergy: { value: 0 }, uFlare: { value: 0 },
      uOpacity: { value: clamp01(opacity) }, uColor: { value: base },
      uDeep: { value: base.clone().multiplyScalar(0.10) },
      uHot: { value: base.clone().lerp(new THREE.Color(1, 1, 1), 0.55) },
    },
    vertexShader: accent ? SLIME_ACCENT_VERTEX : SLIME_BODY_VERTEX,
    fragmentShader: accent ? PFX_SLIME_BURST_ACCENT_FRAGMENT : PFX_SLIME_BURST_BODY_FRAGMENT,
    transparent: true, blending: THREE.NormalBlending, depthWrite: true,
    side: THREE.FrontSide, toneMapped: false,
  })
}

export function createPfxSlimeBurstBodyMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return slimeMaterial(opacity, color, false)
}
export function createPfxSlimeBurstAccentMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return slimeMaterial(opacity, color, true)
}

export function applyPfxSlimeBurstUniforms(material: THREE.ShaderMaterial, state: PfxSlimeBurstRuntimeState, opacity: number, reducedMotion: boolean): void {
  const u = material.uniforms
  u.uCycle!.value = state.cycle
  u.uEnergy!.value = state.energy
  u.uOpacity!.value = state.stage === 'rest' ? 0 : clamp01(opacity)
  u.uMotion!.value = reducedMotion ? 0.4 : 1
  u.uFlare!.value = state.flare * (reducedMotion ? 0.35 : 1)
}

export function createPfxSlimeBurstBodyGeometry(): THREE.BufferGeometry {
  const columns = 80
  const rows = 70
  const gel: number[] = []
  const indices: number[] = []
  for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
    gel.push(row / rows, column / columns * Math.PI * 2)
  }
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const a = row * (columns + 1) + column
    const b = a + columns + 1
    indices.push(a, b, a + 1, a + 1, b, b + 1)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(gel.length / 2 * 3), 3))
  geometry.setAttribute('aGel', new THREE.Float32BufferAttribute(gel, 2))
  geometry.setIndex(indices)
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.1, 0), 1.7)
  return geometry
}

export function createPfxSlimeBurstAccentGeometry(): THREE.BufferGeometry {
  const sphere = new THREE.SphereGeometry(1, 24, 16)
  const positions = sphere.getAttribute('position')
  const sourceIndices = sphere.getIndex()!
  const point: number[] = []
  const drop: number[] = []
  const flight: number[] = []
  const indices: number[] = []
  for (let i = 0; i < 9; i++) {
    const seed = Math.sin(i * 73.71 + 2.3) * 43758.5453
    const s = seed - Math.floor(seed)
    const bubble = i >= 6
    const theta = i === 0 ? -0.37 : i * 2.39996323
    const launch = i === 0 ? 0.36 : 0.36 + s * 0.10
    for (let j = 0; j < positions.count; j++) {
      point.push(positions.getX(j), positions.getY(j), positions.getZ(j))
      drop.push(theta, launch, bubble ? 0.026 : 0.045 + s * 0.033, bubble ? 2 : i === 0 ? 0 : 1)
      flight.push(i === 0 ? 0.67 : 0.24 + s * 0.3, i === 0 ? 0.12 : 0.2 + s * 0.35, i === 0 ? 0.28 : 0.23 + s * 0.08, s)
    }
    for (let j = 0; j < sourceIndices.count; j++) indices.push(i * positions.count + sourceIndices.getX(j))
  }
  sphere.dispose()
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(point.length), 3))
  geometry.setAttribute('aSphere', new THREE.Float32BufferAttribute(point, 3))
  geometry.setAttribute('aDrop', new THREE.Float32BufferAttribute(drop, 4))
  geometry.setAttribute('aFlight', new THREE.Float32BufferAttribute(flight, 4))
  geometry.setIndex(indices)
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.1, 0), 1.8)
  return geometry
}
