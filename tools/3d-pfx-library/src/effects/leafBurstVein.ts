import * as THREE from 'three'
import { createPfxLeafBurstDescriptors } from './leafBurstDescriptors'
import type { PfxLeafBurstDescriptor } from '../types/02'

export function createPfxLeafBurstVeinGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const forms: number[] = []
  const shells: number[] = []
  const descriptors = createPfxLeafBurstDescriptors()
  const pushPrimitive = (source: THREE.BufferGeometry, descriptor: PfxLeafBurstDescriptor, localCenter: THREE.Vector3, localScale: THREE.Vector3, localRotation: THREE.Quaternion, form: number) => {
    const nonIndexed = source.index ? source.toNonIndexed() : source
    const sourcePositions = nonIndexed.getAttribute('position')
    for (let vertex = 0; vertex < sourcePositions.count; vertex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(sourcePositions, vertex).multiply(localScale).applyQuaternion(localRotation).add(localCenter).applyQuaternion(descriptor.rotation).add(descriptor.center)
      positions.push(point.x, point.y, point.z)
      centers.push(descriptor.center.x, descriptor.center.y, descriptor.center.z)
      seeds.push(descriptor.seed)
      forms.push(form)
      shells.push(descriptor.shell)
    }
    if (nonIndexed !== source) nonIndexed.dispose()
    source.dispose()
  }
  for (const descriptor of descriptors) {
    const size = descriptor.size
    pushPrimitive(
      new THREE.CylinderGeometry(0.32, 1, 1, 5, 1, false),
      descriptor,
      new THREE.Vector3(0.03 * size, 0, size * 0.08),
      new THREE.Vector3(size * 0.03, size * 0.88, size * 0.026),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2),
      0,
    )
    for (const sign of [-1, 1]) {
      const length = size * (0.38 + descriptor.form * 0.04)
      const angle = sign * (0.5 + descriptor.form * 0.08)
      pushPrimitive(
        new THREE.CylinderGeometry(0.25, 1, 1, 5, 1, false),
        descriptor,
        new THREE.Vector3(size * 0.12, sign * size * 0.12, size * 0.085),
        new THREE.Vector3(size * 0.024, length, size * 0.021),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2 + angle),
        0,
      )
    }
  }
  const curlStationCount = 6
  const curlSides = 5
  for (let curl = 0; curl < 9; curl += 1) {
    const descriptor = descriptors[curl]!
    const rings: THREE.Vector3[][] = []
    for (let station = 0; station < curlStationCount; station += 1) {
      const t = station / (curlStationCount - 1)
      const theta = t * Math.PI * 1.35 + descriptor.seed * Math.PI
      const center = descriptor.center.clone().multiplyScalar(0.92).add(new THREE.Vector3(
        Math.cos(theta) * (0.08 + t * 0.08),
        (curl % 2 === 0 ? 1 : -1) * (0.08 + t * 0.28),
        Math.sin(theta) * (0.08 + t * 0.08),
      ))
      const radius = 0.014 + Math.sin(t * Math.PI) * 0.012
      const ring: THREE.Vector3[] = []
      for (let side = 0; side < curlSides; side += 1) {
        const sideAngle = side / curlSides * Math.PI * 2
        ring.push(center.clone().add(new THREE.Vector3(Math.cos(sideAngle) * radius, 0, Math.sin(sideAngle) * radius)))
      }
      rings.push(ring)
    }
    const pushPoint = (point: THREE.Vector3) => {
      positions.push(point.x, point.y, point.z)
      centers.push(descriptor.center.x, descriptor.center.y, descriptor.center.z)
      seeds.push(descriptor.seed)
      forms.push(1)
      shells.push(descriptor.shell)
    }
    for (let station = 0; station < curlStationCount - 1; station += 1) {
      for (let side = 0; side < curlSides; side += 1) {
        const next = (side + 1) % curlSides
        for (const point of [rings[station]![side]!, rings[station + 1]![side]!, rings[station + 1]![next]!]) pushPoint(point)
        for (const point of [rings[station]![side]!, rings[station + 1]![next]!, rings[station]![next]!]) pushPoint(point)
      }
    }
    const start = rings[0]!.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / curlSides)
    const end = rings.at(-1)!.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / curlSides)
    for (let side = 0; side < curlSides; side += 1) {
      const next = (side + 1) % curlSides
      for (const point of [start, rings[0]![next]!, rings[0]![side]!]) pushPoint(point)
      for (const point of [end, rings.at(-1)![side]!, rings.at(-1)![next]!]) pushPoint(point)
    }
  }
  const secondarySeedMoteCount = 12
  for (let mote = 0; mote < secondarySeedMoteCount; mote += 1) {
    const descriptor = descriptors[mote]!
    const moteOffset = descriptor.direction.clone().multiplyScalar(0.035 + (mote % 4) * 0.012)
    pushPrimitive(
      new THREE.IcosahedronGeometry(1, 0),
      descriptor,
      moteOffset,
      new THREE.Vector3(0.045 + (mote % 3) * 0.008, 0.034 + (mote % 2) * 0.006, 0.04),
      new THREE.Quaternion(),
      2,
    )
  }
  const seedPodCoreCount = 1
  const seedPodDescriptor: PfxLeafBurstDescriptor = {
    center: new THREE.Vector3(),
    direction: new THREE.Vector3(0, 1, 0),
    rotation: new THREE.Quaternion(),
    seed: 0.5,
    form: 3,
    size: 0.2,
    shell: 0,
  }
  pushPrimitive(
    new THREE.DodecahedronGeometry(1, 0),
    seedPodDescriptor,
    new THREE.Vector3(),
    new THREE.Vector3(0.19, 0.16, 0.19),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.24, 0.38, 0.12)),
    3,
  )
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('pfxLeafBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  geometry.setAttribute('pfxLeafBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxLeafBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxLeafBurstShell', new THREE.Float32BufferAttribute(shells, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxLeafBurstVeinDrawCalls'] = 1
  geometry.userData['pfxLeafBurstVeinClosedFaces'] = true
  geometry.userData['pfxLeafBurstVeinSpineCount'] = descriptors.length
  geometry.userData['pfxLeafBurstVeinBranchCount'] = descriptors.length * 2
  geometry.userData['pfxLeafBurstSeedCurlCount'] = 9
  geometry.userData['pfxLeafBurstSeedCurlPathStationCount'] = curlStationCount
  geometry.userData['pfxLeafBurstSecondarySeedMoteCount'] = secondarySeedMoteCount
  geometry.userData['pfxLeafBurstSeedPodCoreCount'] = seedPodCoreCount
  geometry.userData['pfxLeafBurstAnticipationCore'] = true
  geometry.userData['pfxLeafBurstVeinPrimitive'] = 'closed-tapered-pentagonal-prisms'
  geometry.userData['pfxLeafBurstVeinBillboardCount'] = 0
  geometry.userData['pfxLeafBurstVeinTopology'] = 'closed-tapered-veins-helical-seed-curls-and-seed-motes'
  geometry.userData['pfxLeafBurstVeinTriangleCount'] = positions.length / 9
  geometry.userData['pfxLeafBurstVeinWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxLeafBurstVeinDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxLeafBurstVeinHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxLeafBurstVeinMaterial(
  opacity: number,
  primaryColor = '#69a83e',
  secondaryColor = '#d8f29a',
  density = 0.58,
  styleEdgeHardness = 0.52,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uPrimaryColor: { value: new THREE.Color(primaryColor) },
      uSecondaryColor: { value: new THREE.Color(secondaryColor) },
      uDensity: { value: THREE.MathUtils.clamp(density, 0, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      attribute vec3 pfxLeafBurstCenter;
      attribute float pfxLeafBurstSeed;
      attribute float pfxLeafBurstForm;
      attribute float pfxLeafBurstShell;
      varying vec3 vVeinNormal;
      varying vec3 vVeinViewPosition;
      varying float vVeinSeed;
      varying float vVeinForm;
      varying float vVeinShell;
      varying float vVeinLife;
      void main() {
        float canopyRelease = smoothstep(0.05 + pfxLeafBurstSeed * 0.02, 0.27 + pfxLeafBurstSeed * 0.03, uCycle);
        float anticipationShellReveal = pfxLeafBurstShell < 0.5 ? 1.0 : pfxLeafBurstShell < 1.5 ? mix(0.42, 1.0, smoothstep(0.02, 0.13, uCycle)) : smoothstep(pfxLeafBurstShell * 0.04 - 0.005, pfxLeafBurstShell * 0.04 + 0.04, uCycle);
        float shellReveal = anticipationShellReveal;
        float flutterFall = smoothstep(0.34, 0.76, uCycle);
        vec3 local = position - pfxLeafBurstCenter;
        float angle = flutterFall * (0.5 + pfxLeafBurstSeed * 1.1);
        mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        local.xy = rotation * local.xy;
        vec3 center = pfxLeafBurstCenter * mix(pfxLeafBurstForm > 0.5 ? 0.82 : 0.78, 1.0, canopyRelease);
        center.y -= flutterFall * flutterFall * (0.38 + pfxLeafBurstSeed * 0.82);
        center.x += (pfxLeafBurstSeed - 0.5) * flutterFall * 0.42 + sin(pfxLeafBurstSeed * 17.0) * flutterFall * 0.1;
        vec3 transformed = center + local * mix(0.92, 1.0, canopyRelease);
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vec3 rotatedNormal = normal;
        rotatedNormal.xy = rotation * rotatedNormal.xy;
        vVeinNormal = normalize(normalMatrix * rotatedNormal);
        vVeinViewPosition = viewPosition.xyz;
        vVeinSeed = pfxLeafBurstSeed;
        vVeinForm = pfxLeafBurstForm;
        vVeinShell = pfxLeafBurstShell;
        float staggeredVeinRetire = 1.0 - smoothstep(0.41 + pfxLeafBurstSeed * 0.04, 0.63 + pfxLeafBurstSeed * 0.09, uCycle);
        vVeinLife = (0.66 + canopyRelease * 0.34) * staggeredVeinRetire * shellReveal;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uCycle;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      varying vec3 vVeinNormal;
      varying vec3 vVeinViewPosition;
      varying float vVeinSeed;
      varying float vVeinForm;
      varying float vVeinShell;
      varying float vVeinLife;
      void main() {
        vec3 normal = normalize(vVeinNormal);
        vec3 viewDirection = normalize(-vVeinViewPosition);
        float facing = abs(dot(normal, viewDirection));
        float botanicalBackscatter = pow(max(0.0, dot(normal, normalize(vec3(-0.28, 0.86, 0.42)))), 2.0);
        float veinSapGlow = 0.68 + facing * 0.24 + botanicalBackscatter * 0.34;
        float seedCurlGlint = vVeinForm > 0.5 ? pow(1.0 - facing, mix(1.2, 2.4, uStyleEdgeHardness)) : 0.0;
        float anticipationCoreGlow = (1.0 - smoothstep(0.03, 0.17, uCycle)) * (1.0 - step(0.5, vVeinShell)) * step(0.5, vVeinForm);
        float releaseSeedSpark = smoothstep(0.08, 0.16, uCycle) * (1.0 - smoothstep(0.3, 0.44, uCycle)) * step(0.5, vVeinForm);
        float burstSeedPodGlow = smoothstep(0.05, 0.16, uCycle) * (1.0 - smoothstep(0.5, 0.66, uCycle)) * step(2.5, vVeinForm);
        vec3 botanicalSeedPodTint = mix(uPrimaryColor, uSecondaryColor, 0.62);
        vec3 controlledVeinColor = mix(uPrimaryColor, uSecondaryColor, 0.7 + botanicalBackscatter * 0.3);
        float impulseFalloff = 0.72 + fract(vVeinSeed * 7.13) * 0.28;
        controlledVeinColor *= (veinSapGlow + seedCurlGlint * 0.65 + mix(0.0, 0.18, uDensity) + anticipationCoreGlow * 1.5 + releaseSeedSpark * 0.92 + burstSeedPodGlow * 1.45) * impulseFalloff;
        controlledVeinColor += uSecondaryColor * (anticipationCoreGlow * 0.82 + releaseSeedSpark * 0.48);
        controlledVeinColor += botanicalSeedPodTint * burstSeedPodGlow * 0.68;
        float alpha = uOpacity * vVeinLife * (0.44 + facing * 0.31 + seedCurlGlint * 0.16 + anticipationCoreGlow * 0.35 + releaseSeedSpark * 0.16 + burstSeedPodGlow * 0.42);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(controlledVeinColor, clamp(alpha, 0.0, 0.86));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxLeafBurstMaterial'] = true
  material.userData['pfxLeafBurstMaterialRole'] = 'veins'
  material.userData['pfxLeafBurstControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxLeafBurstMaterialProfile'] = 'additive-veins-seed-curls-and-anticipation-core'
  return material
}
