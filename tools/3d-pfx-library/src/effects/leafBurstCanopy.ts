import * as THREE from 'three'
import { createPfxLeafBurstDescriptors } from './leafBurstDescriptors'

export function createPfxLeafBurstCanopyGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const directions: number[] = []
  const forms: number[] = []
  const shells: number[] = []
  const descriptors = createPfxLeafBurstDescriptors()
  const outlines = [
    [[-0.62, 0], [-0.38, 0.3], [-0.05, 0.48], [0.34, 0.34], [0.68, 0], [0.34, -0.34], [-0.05, -0.48], [-0.38, -0.3]],
    [[-0.62, 0], [-0.48, 0.16], [-0.4, 0.32], [-0.22, 0.28], [-0.1, 0.48], [0.08, 0.34], [0.26, 0.44], [0.34, 0.24], [0.6, 0.2], [0.7, 0], [0.6, -0.2], [0.34, -0.24], [0.26, -0.44], [0.08, -0.34], [-0.1, -0.48], [-0.22, -0.28], [-0.4, -0.32], [-0.48, -0.16]],
    [[-0.58, 0], [-0.24, 0.18], [-0.05, 0.48], [0.28, 0.62], [0.62, 0.5], [0.76, 0.18], [0.72, 0], [0.76, -0.18], [0.62, -0.5], [0.28, -0.62], [-0.05, -0.48], [-0.24, -0.18]],
  ] as const
  let active = descriptors[0]!
  const pushTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, shade: number) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    const palettes = [[0.34, 0.67, 0.18], [0.45, 0.7, 0.16], [0.28, 0.57, 0.34]] as const
    const palette = palettes[active.form]!
    for (let vertex = 0; vertex < 3; vertex += 1) {
      colors.push(palette[0] * shade, palette[1] * shade, palette[2] * shade)
      centers.push(active.center.x, active.center.y, active.center.z)
      seeds.push(active.seed)
      directions.push(active.direction.x, active.direction.y, active.direction.z)
      forms.push(active.form)
      shells.push(active.shell)
    }
  }
  const transform = (point: THREE.Vector3) => point.applyQuaternion(active.rotation).add(active.center)
  for (const descriptor of descriptors) {
    active = descriptor
    const outline = outlines[active.form]!
    const depth = active.size * (0.09 + active.form * 0.012)
    const top = outline.map(([x, y]) => {
      const midribCrown = 0.42 + (1 - Math.min(1, Math.abs(y) / 0.62)) * 0.3 + (1 - Math.min(1, Math.abs(x) / 0.76)) * 0.2
      return transform(new THREE.Vector3(x * active.size * 1.35, y * active.size, depth * midribCrown))
    })
    const bottom = outline.map(([x, y]) => transform(new THREE.Vector3(x * active.size * 1.35, y * active.size, -depth * 0.72)))
    const topCenter = transform(new THREE.Vector3(0.02 * active.size, 0, depth * 1.42))
    const bottomCenter = transform(new THREE.Vector3(0.02 * active.size, 0, -depth * 0.82))
    for (let edge = 0; edge < outline.length; edge += 1) {
      const next = (edge + 1) % outline.length
      pushTriangle(topCenter, top[edge]!, top[next]!, 0.9 + active.form * 0.07)
      pushTriangle(bottomCenter, bottom[next]!, bottom[edge]!, 0.64 + active.form * 0.06)
      pushTriangle(top[edge]!, bottom[edge]!, bottom[next]!, 0.72 + (edge % 3) * 0.08)
      pushTriangle(top[edge]!, bottom[next]!, top[next]!, 0.78 + (edge % 2) * 0.1)
    }
    const stemStart = new THREE.Vector3(-0.79 * active.size * 1.35, 0, 0)
    const stemEnd = new THREE.Vector3(-0.45 * active.size * 1.35, 0, 0)
    const stemRadius = active.size * 0.035
    const stem = [
      new THREE.Vector3(stemStart.x, stemRadius, 0), new THREE.Vector3(stemStart.x, -stemRadius, 0), new THREE.Vector3(stemStart.x, 0, stemRadius),
      new THREE.Vector3(stemEnd.x, stemRadius, 0), new THREE.Vector3(stemEnd.x, -stemRadius, 0), new THREE.Vector3(stemEnd.x, 0, stemRadius),
    ].map(transform)
    const stemFaces = [[0, 2, 1], [3, 4, 5], [0, 1, 4], [0, 4, 3], [1, 2, 5], [1, 5, 4], [2, 0, 3], [2, 3, 5]] as const
    for (const [a, b, c] of stemFaces) pushTriangle(stem[a]!, stem[b]!, stem[c]!, 0.7)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('pfxLeafBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  geometry.setAttribute('pfxLeafBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxLeafBurstDirection', new THREE.Float32BufferAttribute(directions, 3))
  geometry.setAttribute('pfxLeafBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxLeafBurstShell', new THREE.Float32BufferAttribute(shells, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxLeafBurstDrawCalls'] = 1
  geometry.userData['pfxLeafBurstClosedFaces'] = true
  geometry.userData['pfxLeafBurstWorldSpaceVolume'] = true
  geometry.userData['pfxLeafBurstBillboardCount'] = 0
  geometry.userData['pfxLeafBurstLeafCount'] = descriptors.length
  geometry.userData['pfxLeafBurstSpeciesCount'] = 3
  geometry.userData['pfxLeafBurstSpeciesProfile'] = 'ovate-oak-ginkgo'
  geometry.userData['pfxLeafBurstStemCount'] = descriptors.length
  geometry.userData['pfxLeafBurstRadialShellCount'] = 4
  geometry.userData['pfxLeafBurstAngularSectorCount'] = 9
  geometry.userData['pfxLeafBurstDepthLayerCount'] = 12
  geometry.userData['pfxLeafBurstRadialEmitter'] = true
  geometry.userData['pfxLeafBurstTopology'] = 'closed-sculpted-leaf-prisms-with-integrated-stems'
  geometry.userData['pfxLeafBurstAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxLeafBurstCrownedMidrib'] = true
  geometry.userData['pfxLeafBurstTriangleCount'] = positions.length / 9
  geometry.userData['pfxLeafBurstWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxLeafBurstDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxLeafBurstHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxLeafBurstCanopyMaterial(
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
    vertexColors: true,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      attribute vec3 pfxLeafBurstCenter;
      attribute float pfxLeafBurstSeed;
      attribute vec3 pfxLeafBurstDirection;
      attribute float pfxLeafBurstForm;
      attribute float pfxLeafBurstShell;
      varying vec3 vLeafColor;
      varying vec3 vLeafNormal;
      varying vec3 vLeafViewPosition;
      varying vec3 vLeafLocalPosition;
      varying float vLeafSeed;
      varying float vLeafForm;
      varying float vLeafLife;
      void main() {
        float canopyRelease = smoothstep(0.035 + pfxLeafBurstSeed * 0.018, 0.25 + pfxLeafBurstSeed * 0.025, uCycle);
        float anticipationShellReveal = pfxLeafBurstShell < 0.5 ? 1.0 : pfxLeafBurstShell < 1.5 ? mix(0.42, 1.0, smoothstep(0.02, 0.13, uCycle)) : smoothstep(pfxLeafBurstShell * 0.04 - 0.01, pfxLeafBurstShell * 0.04 + 0.035, uCycle);
        float shellReveal = anticipationShellReveal;
        float flutterFall = smoothstep(0.34, 0.76, uCycle);
        vec3 local = position - pfxLeafBurstCenter;
        float decaySilhouetteLock = mix(1.0, 0.26, smoothstep(0.43, 0.74, uCycle));
        float flutterAngle = (flutterFall * (0.55 + pfxLeafBurstSeed * 1.2) + canopyRelease * pfxLeafBurstSeed * 0.35) * decaySilhouetteLock;
        mat2 flutterRotation = mat2(cos(flutterAngle), -sin(flutterAngle), sin(flutterAngle), cos(flutterAngle));
        local.xy = flutterRotation * local.xy;
        local.yz = mat2(cos(flutterAngle * 0.58), -sin(flutterAngle * 0.58), sin(flutterAngle * 0.58), cos(flutterAngle * 0.58)) * local.yz;
        vec3 center = pfxLeafBurstCenter * mix(0.78, 1.0, canopyRelease);
        float sustainedPeakEnvelope = smoothstep(0.06, 0.32, uCycle) * (1.0 - smoothstep(0.68, 0.82, uCycle));
        float peakRadialSeparation = sustainedPeakEnvelope * (0.08 + pfxLeafBurstShell * 0.12);
        center += pfxLeafBurstDirection * peakRadialSeparation;
        center.y -= flutterFall * flutterFall * (0.4 + pfxLeafBurstSeed * 0.9);
        center.x += (pfxLeafBurstSeed - 0.5) * flutterFall * 0.45 + sin(pfxLeafBurstSeed * 19.0) * flutterFall * 0.12;
        center.z += cos(pfxLeafBurstSeed * 13.0) * flutterFall * 0.22;
        vec3 transformed = center + local * mix(0.92, 1.0, canopyRelease);
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vec3 rotatedNormal = normal;
        rotatedNormal.xy = flutterRotation * rotatedNormal.xy;
        vLeafColor = color;
        vLeafNormal = normalize(normalMatrix * rotatedNormal);
        vLeafViewPosition = viewPosition.xyz;
        vLeafLocalPosition = local;
        vLeafSeed = pfxLeafBurstSeed;
        vLeafForm = pfxLeafBurstForm;
        float staggeredLeafRetire = 1.0 - smoothstep(0.43 + pfxLeafBurstSeed * 0.05, 0.65 + pfxLeafBurstSeed * 0.1, uCycle);
        vLeafLife = (0.76 + canopyRelease * 0.24) * staggeredLeafRetire * shellReveal;
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
      varying vec3 vLeafColor;
      varying vec3 vLeafNormal;
      varying vec3 vLeafViewPosition;
      varying vec3 vLeafLocalPosition;
      varying float vLeafSeed;
      varying float vLeafForm;
      varying float vLeafLife;
      void main() {
        vec3 normal = normalize(vLeafNormal);
        vec3 viewDirection = normalize(-vLeafViewPosition);
        float facing = abs(dot(normal, viewDirection));
        float waxyLeafSheen = pow(max(0.0, dot(normal, normalize(vec3(0.36, 0.88, 0.3)))), mix(2.0, 4.5, uStyleEdgeHardness));
        float leafChlorophyll = 0.72 + facing * 0.28;
        vec3 speciesPigment = vLeafForm < 0.5 ? vec3(0.55, 0.92, 0.28) : vLeafForm < 1.5 ? vec3(0.48, 0.72, 0.22) : vec3(0.38, 0.76, 0.46);
        vec3 controlledLeafColor = mix(uPrimaryColor * 0.56, uSecondaryColor, facing * 0.28 + waxyLeafSheen * 0.34);
        controlledLeafColor = mix(controlledLeafColor, speciesPigment, 0.38 + vLeafSeed * 0.1);
        controlledLeafColor = mix(controlledLeafColor, vLeafColor * 1.75, 0.28);
        controlledLeafColor *= (1.18 + leafChlorophyll * 0.32);
        controlledLeafColor += uSecondaryColor * waxyLeafSheen * mix(0.18, 0.34, uDensity);
        float leafFiber = 0.5 + 0.5 * sin(vLeafLocalPosition.x * 24.0 + vLeafLocalPosition.y * 11.0 + vLeafSeed * 17.0);
        float translucentLeafBacklight = pow(1.0 - facing, 1.35) * (0.18 + leafFiber * 0.12);
        controlledLeafColor += mix(uPrimaryColor, uSecondaryColor, leafFiber) * translucentLeafBacklight;
        float leafEdgeThickness = pow(1.0 - facing, 0.8);
        controlledLeafColor += speciesPigment * leafEdgeThickness * 0.24;
        float botanicalRim = pow(1.0 - facing, 1.7) * 0.18;
        controlledLeafColor += uSecondaryColor * botanicalRim;
        float decayBotanicalMemory = smoothstep(0.52, 0.76, uCycle);
        float decayReadabilityHold = smoothstep(0.4, 0.56, uCycle) * (1.0 - smoothstep(0.66, 0.79, uCycle));
        vec3 warmDecayPigment = mix(vec3(0.86, 0.42, 0.08), vec3(1.0, 0.72, 0.2), leafFiber * 0.42 + facing * 0.18);
        float compactBudGlow = 1.0 - smoothstep(0.0, 0.16, uCycle);
        controlledLeafColor = mix(controlledLeafColor, uSecondaryColor * 1.32, compactBudGlow * 0.4);
        controlledLeafColor = mix(controlledLeafColor, speciesPigment * 1.38, decayBotanicalMemory * 0.46);
        controlledLeafColor += uSecondaryColor * decayBotanicalMemory * (0.16 + waxyLeafSheen * 0.18);
        controlledLeafColor = mix(controlledLeafColor, warmDecayPigment * 1.62, decayReadabilityHold * 0.78);
        controlledLeafColor *= 1.0 + decayBotanicalMemory * 1.7 + compactBudGlow * 0.5 + decayReadabilityHold * 0.88;
        float alpha = uOpacity * vLeafLife * (0.72 + facing * 0.25 + compactBudGlow * 0.34 + decayReadabilityHold * 0.34) * mix(1.0, 2.35, decayReadabilityHold);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(controlledLeafColor, clamp(alpha, 0.0, 0.96));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxLeafBurstMaterial'] = true
  material.userData['pfxLeafBurstMaterialRole'] = 'canopy'
  material.userData['pfxLeafBurstControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxLeafBurstMaterialProfile'] = 'waxy-species-pigment-with-decay-readability-lock'
  return material
}
