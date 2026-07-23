import * as THREE from 'three'

export function createPfxShardBreakFragmentGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const white: readonly [number, number, number] = [0.94, 1, 1]
  const bright: readonly [number, number, number] = [0.62, 0.91, 1]
  const middle: readonly [number, number, number] = [0.23, 0.62, 0.9]
  const teal: readonly [number, number, number] = [0.08, 0.45, 0.66]
  const deep: readonly [number, number, number] = [0.025, 0.15, 0.36]
  const pushTriangle = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    aColor: readonly [number, number, number],
    bColor: readonly [number, number, number],
    cColor: readonly [number, number, number],
  ) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    colors.push(...aColor, ...bColor, ...cColor)
  }
  const aspectRatios: number[] = []
  const chunkAspectRatios: number[] = []
  const centerDistances: number[] = []
  const volumeProxies: number[] = []

  for (let index = 0; index < 12; index += 1) {
    const azimuth = index * 2.399963229728653 + (index % 3) * 0.11
    const elevation = 0.14 + ((index * 5) % 11) / 10 * 0.76
    const distance = index === 0 ? 0.14 : 0.28 + (index % 6) * 0.145
    centerDistances.push(distance)
    const direction = new THREE.Vector3(
      Math.cos(azimuth) * Math.cos(elevation),
      Math.sin(elevation),
      Math.sin(azimuth) * Math.cos(elevation),
    ).normalize()
    const center = direction.clone().multiplyScalar(distance)
    const tangent = new THREE.Vector3(-Math.sin(azimuth), 0.18, Math.cos(azimuth)).normalize()
    const fragmentAxis = direction.clone().addScaledVector(tangent, ((index % 4) - 1.5) * 0.12).normalize()
    const basisA = fragmentAxis.clone().cross(Math.abs(fragmentAxis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize()
    const basisB = fragmentAxis.clone().cross(basisA).normalize()
    const topology = index % 3
    const baseLength = index === 0 ? 0.72 : 0.34 + (index % 5) * 0.085
    const baseWidth = index === 0 ? 0.2 : 0.075 + (index % 4) * 0.024
    const length = topology === 2 ? baseLength : baseLength * 0.68
    const width = topology === 2
      ? baseWidth
      : index === 0
        ? 0.28
        : Math.max(baseWidth * 1.45, length / 3.1)
    aspectRatios.push(length / width)
    if (topology !== 2) chunkAspectRatios.push(length / width)
    volumeProxies.push(length * width * width)
    const facetSides = index === 0 ? 5 : 3 + ((index * 2) % 3)
    const tip = center.clone()
      .addScaledVector(fragmentAxis, length * (0.54 + (index % 3) * 0.04))
      .addScaledVector(basisA, ((index % 3) - 1) * width * 0.16)
    const root = center.clone()
      .addScaledVector(fragmentAxis, -length * (0.38 + (index % 2) * 0.06))
      .addScaledVector(basisB, ((index % 4) - 1.5) * width * 0.09)
    const ringAt = (ringCenter: THREE.Vector3, radiusScale: number, phaseOffset: number) => Array.from({ length: facetSides }, (_, corner) => {
      const angle = corner / facetSides * Math.PI * 2 + index * 0.27
      const irregularRadius = width * (0.72 + ((corner * 7 + index * 3) % 6) * 0.075)
      const squash = 0.68 + ((corner * 5 + index) % 4) * 0.1
      return ringCenter.clone()
        .addScaledVector(basisA, Math.cos(angle + phaseOffset) * irregularRadius * radiusScale)
        .addScaledVector(basisB, Math.sin(angle + phaseOffset) * irregularRadius * squash * radiusScale)
    })
    const facePalette = [white, bright, middle, teal, deep] as const
    if (topology === 2) {
      const ring = ringAt(center, 1, 0)
      for (let face = 0; face < facetSides; face += 1) {
        const next = (face + 1) % facetSides
        const frontColor = facePalette[(face + index) % facePalette.length]!
        const backColor = facePalette[(face + index + 2) % facePalette.length]!
        pushTriangle(tip, ring[face]!, ring[next]!, frontColor, frontColor, frontColor)
        pushTriangle(root, ring[next]!, ring[face]!, backColor, backColor, backColor)
      }
    } else {
      const rootRing = ringAt(root, topology === 0 ? 0.9 : 0.72, -0.12)
      const tipRing = ringAt(tip, topology === 0 ? 0.48 : 0.58, 0.16 + index * 0.025)
      for (let face = 0; face < facetSides; face += 1) {
        const next = (face + 1) % facetSides
        const sideColor = facePalette[(face + index) % facePalette.length]!
        const nextColor = facePalette[(face + index + 1) % facePalette.length]!
        pushTriangle(rootRing[face]!, tipRing[face]!, tipRing[next]!, sideColor, sideColor, nextColor)
        pushTriangle(rootRing[face]!, tipRing[next]!, rootRing[next]!, sideColor, nextColor, nextColor)
        pushTriangle(tip, tipRing[face]!, tipRing[next]!, white, sideColor, nextColor)
        pushTriangle(root, rootRing[next]!, rootRing[face]!, deep, nextColor, sideColor)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxShardBreakGeometry'] = 'single-draw-closed-faceted-crystal-fracture-volume'
  geometry.userData['pfxShardBreakDrawCalls'] = 1
  geometry.userData['pfxShardBreakFragmentCount'] = 12
  geometry.userData['pfxShardBreakClosedFaces'] = true
  geometry.userData['pfxShardBreakWorldSpaceVolume'] = true
  geometry.userData['pfxShardBreakIrregularTopology'] = true
  geometry.userData['pfxShardBreakFacetSideMin'] = 3
  geometry.userData['pfxShardBreakFacetSideMax'] = 5
  geometry.userData['pfxShardBreakTopologyKinds'] = 3
  geometry.userData['pfxShardBreakTruncatedChunkCount'] = 8
  geometry.userData['pfxShardBreakPointedShardCount'] = 4
  geometry.userData['pfxShardBreakDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxShardBreakWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxShardBreakHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  geometry.userData['pfxShardBreakAspectRatioRange'] = Math.max(...aspectRatios) - Math.min(...aspectRatios)
  geometry.userData['pfxShardBreakMaxChunkAspectRatio'] = Math.max(...chunkAspectRatios)
  geometry.userData['pfxShardBreakMaxCenterDistance'] = Math.max(...centerDistances)
  const sortedVolumes = [...volumeProxies].sort((a, b) => b - a)
  geometry.userData['pfxShardBreakHeroVolumeRatio'] = sortedVolumes[0]! / sortedVolumes[1]!
  return geometry
}

export function createPfxShardBreakFragmentMaterial(opacity: number): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
    },
    vertexColors: true,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec3 vCrystalColor;
      varying vec3 vCrystalNormal;
      varying vec3 vViewPosition;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vCrystalColor = color;
        vCrystalNormal = normalize(normalMatrix * normal);
        vViewPosition = viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vCrystalColor;
      varying vec3 vCrystalNormal;
      varying vec3 vViewPosition;
      void main() {
        vec3 normal = normalize(vCrystalNormal);
        vec3 viewDirection = normalize(-vViewPosition);
        vec3 lightDirection = normalize(vec3(0.42, 0.76, 0.5));
        float facet = 0.34 + max(dot(normal, lightDirection), 0.0) * 0.66;
        float fresnel = pow(1.0 - abs(dot(normal, viewDirection)), 2.25);
        vec3 reflected = reflect(-lightDirection, normal);
        float specular = pow(max(dot(reflected, viewDirection), 0.0), 22.0);
        vec3 crystal = vCrystalColor * facet;
        crystal += vec3(0.3, 0.82, 1.0) * fresnel * 0.62;
        crystal += vec3(0.92, 0.99, 1.0) * specular * 0.78;
        crystal += vCrystalColor * vCrystalColor * 0.32;
        gl_FragColor = vec4(crystal, uOpacity);
      }
    `,
  })
  material.userData['pfxShardBreakMaterial'] = 'fresnel-specular-cut-crystal-volume'
  return material
}
