import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export function createPfxShockwaveSpawnArrivalFlareGeometry(): THREE.BufferGeometry {
  const components: THREE.BufferGeometry[] = []
  const impactSeedRadius = 0.16
  const impactSeed = new THREE.OctahedronGeometry(impactSeedRadius, 0)
  impactSeed.scale(1.3, 0.45, 1)
  impactSeed.rotateY(0.32)
  impactSeed.translate(0, 0.078, 0)
  impactSeed.computeBoundingBox()
  const impactSeedPosition = impactSeed.getAttribute('position')
  const impactSeedEnergy = new Float32Array(impactSeedPosition.count)
  const impactSeedBurstOffset = new Float32Array(impactSeedPosition.count * 3)
  const impactSeedLayer = new Float32Array(impactSeedPosition.count).fill(0.45)
  const impactSeedMinY = impactSeed.boundingBox!.min.y
  const impactSeedHeight = Math.max(0.001, impactSeed.boundingBox!.max.y - impactSeedMinY)
  for (let index = 0; index < impactSeedPosition.count; index += 1) {
    const progress = THREE.MathUtils.clamp((impactSeedPosition.getY(index) - impactSeedMinY) / impactSeedHeight, 0, 1)
    impactSeedEnergy[index] = THREE.MathUtils.lerp(0.82, 1, progress)
  }
  impactSeed.setAttribute('aEnergy', new THREE.BufferAttribute(impactSeedEnergy, 1))
  impactSeed.setAttribute('aBurstOffset', new THREE.BufferAttribute(impactSeedBurstOffset, 3))
  impactSeed.setAttribute('aLayer', new THREE.BufferAttribute(impactSeedLayer, 1))
  components.push(impactSeed)
  const pressureCollarRadius = 0.39
  const pressureCollarTube = 0.065
  const collarSpecs = [
    { start: 0.03, arc: 0.42, lift: 0.13, tilt: 0.04, energy: 0.94 },
    { start: 0.64, arc: 0.46, lift: 0.112, tilt: -0.06, energy: 0.76 },
    { start: 1.28, arc: 0.4, lift: 0.136, tilt: 0.08, energy: 0.86 },
    { start: 1.9, arc: 0.44, lift: 0.118, tilt: -0.04, energy: 0.7 },
    { start: 2.54, arc: 0.41, lift: 0.13, tilt: 0.06, energy: 0.82 },
    { start: 3.18, arc: 0.45, lift: 0.116, tilt: -0.05, energy: 0.74 },
    { start: 3.82, arc: 0.39, lift: 0.134, tilt: 0.07, energy: 0.9 },
    { start: 4.44, arc: 0.43, lift: 0.114, tilt: -0.07, energy: 0.72 },
    { start: 5.08, arc: 0.4, lift: 0.128, tilt: 0.05, energy: 0.84 },
    { start: 5.7, arc: 0.44, lift: 0.12, tilt: -0.04, energy: 0.78 },
  ]
  collarSpecs.forEach((spec) => {
    const indexedCollar = new THREE.TorusGeometry(pressureCollarRadius, pressureCollarTube, 5, 16, spec.arc)
    const collar = indexedCollar.toNonIndexed()
    indexedCollar.dispose()
    collar.rotateZ(spec.start)
    collar.rotateX(-Math.PI / 2)
    collar.rotateZ(spec.tilt)
    collar.translate(0, spec.lift, 0)
    collar.computeBoundingBox()
    const position = collar.getAttribute('position')
    const energy = new Float32Array(position.count)
    const burstOffset = new Float32Array(position.count * 3)
    const layer = new Float32Array(position.count)
    const minY = collar.boundingBox!.min.y
    const height = Math.max(0.001, collar.boundingBox!.max.y - minY)
    for (let index = 0; index < position.count; index += 1) {
      const progress = THREE.MathUtils.clamp((position.getY(index) - minY) / height, 0, 1)
      energy[index] = THREE.MathUtils.lerp(spec.energy * 0.58, spec.energy, progress)
    }
    collar.setAttribute('aEnergy', new THREE.BufferAttribute(energy, 1))
    collar.setAttribute('aBurstOffset', new THREE.BufferAttribute(burstOffset, 3))
    collar.setAttribute('aLayer', new THREE.BufferAttribute(layer, 1))
    components.push(collar)
  })
  const fragmentSpecs = [
    { radius: 0.082, position: [-0.27, 0.13, 0.07] as const, scale: [1.65, 0.55, 0.5] as const, rotation: [0.2, -0.4, 0.32] as const, energy: 0.72 },
    { radius: 0.07, position: [0.2, 0.22, -0.09] as const, scale: [0.58, 1.75, 0.5] as const, rotation: [-0.3, 0.5, -0.28] as const, energy: 0.94 },
    { radius: 0.06, position: [0.07, 0.47, 0.1] as const, scale: [0.52, 1.9, 0.46] as const, rotation: [0.4, 0.1, 0.42] as const, energy: 1 },
    { radius: 0.074, position: [-0.13, 0.34, -0.18] as const, scale: [1.45, 0.58, 0.62] as const, rotation: [-0.1, -0.7, 0.52] as const, energy: 0.84 },
    { radius: 0.058, position: [0.3, 0.12, 0.16] as const, scale: [1.7, 0.5, 0.48] as const, rotation: [0.35, 0.8, -0.35] as const, energy: 0.68 },
    { radius: 0.064, position: [-0.31, 0.24, -0.1] as const, scale: [0.5, 1.72, 0.54] as const, rotation: [-0.25, 0.2, 0.6] as const, energy: 0.78 },
    { radius: 0.052, position: [0.02, 0.59, -0.04] as const, scale: [0.48, 1.9, 0.44] as const, rotation: [0.18, -0.3, -0.58] as const, energy: 0.9 },
    { radius: 0.056, position: [0.17, 0.39, 0.2] as const, scale: [1.5, 0.5, 0.56] as const, rotation: [-0.38, 0.65, 0.22] as const, energy: 0.82 },
    { radius: 0.05, position: [-0.08, 0.18, 0.23] as const, scale: [1.62, 0.48, 0.5] as const, rotation: [0.5, -0.2, -0.44] as const, energy: 0.76 },
    { radius: 0.047, position: [0.34, 0.27, -0.17] as const, scale: [1.48, 0.52, 0.48] as const, rotation: [-0.32, 0.42, 0.5] as const, energy: 0.8 },
    { radius: 0.045, position: [-0.35, 0.4, 0.13] as const, scale: [0.5, 1.55, 0.46] as const, rotation: [0.22, -0.54, -0.34] as const, energy: 0.88 },
    { radius: 0.043, position: [0.12, 0.63, 0.06] as const, scale: [0.48, 1.42, 0.5] as const, rotation: [-0.2, 0.76, 0.24] as const, energy: 0.96 },
    { radius: 0.046, position: [-0.21, 0.52, 0.23] as const, scale: [1.4, 0.48, 0.52] as const, rotation: [0.38, -0.64, 0.18] as const, energy: 0.84 },
    { radius: 0.044, position: [0.27, 0.48, -0.22] as const, scale: [0.46, 1.5, 0.48] as const, rotation: [-0.44, 0.28, -0.26] as const, energy: 0.9 },
  ]
  fragmentSpecs.forEach((spec) => {
    const fragment = new THREE.OctahedronGeometry(spec.radius, 0)
    const shardScale = spec.scale.map((axisScale) => Math.max(0.78, axisScale)) as [number, number, number]
    fragment.scale(shardScale[0], shardScale[1], shardScale[2])
    fragment.rotateX(spec.rotation[0])
    fragment.rotateY(spec.rotation[1])
    fragment.rotateZ(spec.rotation[2])
    fragment.translate(spec.position[0], spec.position[1], spec.position[2])
    fragment.computeBoundingBox()
    const position = fragment.getAttribute('position')
    const minY = fragment.boundingBox!.min.y
    const height = Math.max(0.001, fragment.boundingBox!.max.y - minY)
    const energy = new Float32Array(position.count)
    const burstOffset = new Float32Array(position.count * 3)
    const layer = new Float32Array(position.count).fill(1)
    for (let index = 0; index < position.count; index += 1) {
      const progress = THREE.MathUtils.clamp((position.getY(index) - minY) / height, 0, 1)
      energy[index] = THREE.MathUtils.lerp(spec.energy * 0.62, spec.energy, progress)
      burstOffset[index * 3] = spec.position[0]
      burstOffset[index * 3 + 1] = spec.position[1] - 0.1
      burstOffset[index * 3 + 2] = spec.position[2]
    }
    fragment.setAttribute('aEnergy', new THREE.BufferAttribute(energy, 1))
    fragment.setAttribute('aBurstOffset', new THREE.BufferAttribute(burstOffset, 3))
    fragment.setAttribute('aLayer', new THREE.BufferAttribute(layer, 1))
    components.push(fragment)
  })
  const geometry = mergeGeometries(components, false)
  components.forEach((component) => component.dispose())
  if (!geometry) throw new Error('Failed to merge shockwave spawn fragmented arrival geometry')
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxShockwaveSpawnGeometry'] = 'broken-pressure-collar-and-shards'
  geometry.userData['pfxShockwaveSpawnDrawCalls'] = 1
  geometry.userData['pfxShockwaveSpawnClosedVolume'] = true
  geometry.userData['pfxShockwaveSpawnComponentCount'] = fragmentSpecs.length + collarSpecs.length + 1
  geometry.userData['pfxShockwaveSpawnVerticalDominance'] = true
  geometry.userData['pfxShockwaveSpawnGroundProfile'] = false
  geometry.userData['pfxShockwaveSpawnAsymmetricLayout'] = true
  geometry.userData['pfxShockwaveSpawnFaceted'] = true
  geometry.userData['pfxShockwaveSpawnFragmented'] = true
  geometry.userData['pfxShockwaveSpawnAnimatedSeparation'] = true
  geometry.userData['pfxShockwaveSpawnVolumetricShards'] = true
  geometry.userData['pfxShockwaveSpawnMinShardMinorScale'] = 0.78
  geometry.userData['pfxShockwaveSpawnOutwardDecay'] = true
  geometry.userData['pfxShockwaveSpawnPressureCollar'] = true
  geometry.userData['pfxShockwaveSpawnPressureCollarArcCount'] = collarSpecs.length
  geometry.userData['pfxShockwaveSpawnPressureCollarOuterRadius'] = pressureCollarRadius + pressureCollarTube
  geometry.userData['pfxShockwaveSpawnImpactSeed'] = true
  geometry.userData['pfxShockwaveSpawnCoreRadius'] = impactSeedRadius
  geometry.userData['pfxShockwaveSpawnPlanarCards'] = false
  return geometry
}

export function createPfxShockwaveSpawnArrivalFlareMaterial(opacity: number): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: opacity },
      uTime: { value: 0 },
      uBurstProgress: { value: 0 },
      uInnerColor: { value: new THREE.Color('#ff6a1c') },
      uHotColor: { value: new THREE.Color('#fff3c4') },
      uRimColor: { value: new THREE.Color('#ff3d55') },
      uShardColor: { value: new THREE.Color('#b8ecff') },
    },
    vertexShader: `
      attribute float aEnergy;
      attribute vec3 aBurstOffset;
      attribute float aLayer;
      uniform float uBurstProgress;
      varying float vEnergy;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      varying vec3 vObjectPosition;
      varying float vLayer;
      void main() {
        float burstProgress = smoothstep(0.0, 1.0, min(uBurstProgress, 1.0));
        float outwardProgress = max(0.0, uBurstProgress - 1.0);
        vec3 animatedPosition = position
          - aBurstOffset * (1.0 - burstProgress)
          + aBurstOffset * outwardProgress * 0.82;
        vec4 viewPosition = modelViewMatrix * vec4(animatedPosition, 1.0);
        vEnergy = aEnergy;
        vViewNormal = normalize(normalMatrix * normal);
        vViewPosition = viewPosition.xyz;
        vObjectPosition = animatedPosition;
        vLayer = aLayer;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform vec3 uInnerColor;
      uniform vec3 uHotColor;
      uniform vec3 uRimColor;
      uniform vec3 uShardColor;
      varying float vEnergy;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      varying vec3 vObjectPosition;
      varying float vLayer;
      void main() {
        vec3 viewDirection = normalize(-vViewPosition);
        vec3 surfaceNormal = normalize(vViewNormal);
        float fresnel = pow(1.0 - abs(dot(surfaceNormal, viewDirection)), 1.55);
        float facetLight = 0.58 + 0.42 * max(0.0, dot(surfaceNormal, normalize(vec3(0.38, 0.72, 0.46))));
        float grain = 0.88 + 0.12 * sin(vObjectPosition.x * 31.0 + vObjectPosition.y * 43.0 + vObjectPosition.z * 37.0);
        float hotCore = 1.0 - abs(vEnergy * 2.0 - 1.0);
        vec3 body = mix(uInnerColor, uHotColor, clamp(hotCore * 0.86 + vEnergy * 0.18, 0.0, 1.0));
        vec3 groundedColor = mix(body * facetLight * grain, uRimColor, fresnel * 0.42);
        vec3 color = mix(groundedColor, uShardColor * (0.82 + facetLight * 0.28), vLayer * 0.72);
        float alpha = uOpacity * (0.52 + hotCore * 0.24 + fresnel * 0.22);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
  material.userData['pfxMaterial'] = 'shockwave-spawn-arrival-flare'
  material.userData['pfxShockwaveSpawnArrivalFlare'] = true
  material.userData['pfxShockwaveSpawnPalette'] = 'gold-orange-pressure-energy'
  return material
}
