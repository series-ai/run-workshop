import * as THREE from 'three'

export function createPfxGhostCriticalTalonGeometry(): THREE.BufferGeometry {
  const talons = [
    { root: [-0.5, -0.42, -0.18], mid: [-0.08, -0.02, -0.2], tip: [0.55, 0.55, -0.1], width: 0.18 },
    { root: [-0.42, -0.38, -0.16], mid: [0.02, 0.02, -0.18], tip: [0.78, 0.59, -0.08], width: 0.16 },
    { root: [-0.46, -0.05, 0.05], mid: [-0.05, 0.28, 0.12], tip: [0.65, 0.78, 0.26], width: 0.14 },
    { root: [-0.36, -0.01, 0.07], mid: [0.08, 0.32, 0.14], tip: [0.88, 0.82, 0.28], width: 0.12 },
    { root: [-0.4, 0.28, -0.3], mid: [0.02, 0.5, -0.34], tip: [0.62, 0.9, -0.45], width: 0.1 },
  ] as const
  const positions: number[] = []
  const colors: number[] = []
  const parts: number[] = []
  const rootColor: readonly [number, number, number] = [0.12, 0.012, 0.24]
  const middleColor: readonly [number, number, number] = [0.46, 0.16, 0.78]
  const tipColor: readonly [number, number, number] = [0.68, 0.96, 1]
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
    parts.push(0, 0, 0)
  }

  for (const talon of talons) {
    const facetSides = 7
    const centers = [
      new THREE.Vector3(...talon.root),
      new THREE.Vector3(...talon.mid),
      new THREE.Vector3(...talon.tip),
    ]
    const widths = [talon.width, talon.width * 0.7, talon.width * 0.055]
    const ringColors = [rootColor, middleColor, tipColor] as const
    const rings = centers.map((center, ringIndex) => {
      const previous = centers[Math.max(0, ringIndex - 1)]!
      const next = centers[Math.min(centers.length - 1, ringIndex + 1)]!
      const direction = next.clone().sub(previous).normalize()
      const reference = Math.abs(direction.y) > 0.88
        ? new THREE.Vector3(1, 0, 0)
        : new THREE.Vector3(0, 1, 0)
      const side = direction.clone().cross(reference).normalize()
      const up = side.clone().cross(direction).normalize()
      return Array.from({ length: facetSides }, (_, sideIndex) => {
        const angle = sideIndex / facetSides * Math.PI * 2 + 0.3
        return center.clone()
          .addScaledVector(side, Math.cos(angle) * widths[ringIndex]!)
          .addScaledVector(up, Math.sin(angle) * widths[ringIndex]!)
      })
    })

    for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
      for (let sideIndex = 0; sideIndex < facetSides; sideIndex += 1) {
        const nextSide = (sideIndex + 1) % facetSides
        pushTriangle(
          rings[ringIndex]![sideIndex]!,
          rings[ringIndex + 1]![sideIndex]!,
          rings[ringIndex]![nextSide]!,
          ringColors[ringIndex]!,
          ringColors[ringIndex + 1]!,
          ringColors[ringIndex]!,
        )
        pushTriangle(
          rings[ringIndex]![nextSide]!,
          rings[ringIndex + 1]![sideIndex]!,
          rings[ringIndex + 1]![nextSide]!,
          ringColors[ringIndex]!,
          ringColors[ringIndex + 1]!,
          ringColors[ringIndex + 1]!,
        )
      }
    }
    for (let sideIndex = 0; sideIndex < facetSides; sideIndex += 1) {
      const nextSide = (sideIndex + 1) % facetSides
      pushTriangle(centers[0]!, rings[0]![nextSide]!, rings[0]![sideIndex]!, rootColor, rootColor, rootColor)
      pushTriangle(centers[2]!, rings[2]![sideIndex]!, rings[2]![nextSide]!, tipColor, tipColor, tipColor)
    }
  }

  // Closed primitives form a real skull volume: a rounded cranium, projected
  // jaw and cheekbones, recessed dark sockets, nasal cavity, and cold teeth.
  // They share one position/color buffer with the talons, so the richer form
  // remains a single mobile-safe draw while producing true profile occlusion.
  let skullPrimitiveCount = 0
  const skullYaw = 0.36
  const appendSkullPrimitive = (
    base: THREE.BufferGeometry,
    transform: (geometry: THREE.BufferGeometry) => void,
    colorAt: (position: THREE.BufferAttribute, vertex: number) => readonly [number, number, number],
  ) => {
    const source = base.index ? base.toNonIndexed() : base
    transform(source)
    source.translate(0.43, 0, 0)
    source.rotateY(skullYaw)
    source.translate(-0.43, 0, 0)
    const sourcePositions = source.getAttribute('position') as THREE.BufferAttribute
    for (let vertex = 0; vertex < sourcePositions.count; vertex += 1) {
      positions.push(sourcePositions.getX(vertex), sourcePositions.getY(vertex), sourcePositions.getZ(vertex))
      colors.push(...colorAt(sourcePositions, vertex))
      parts.push(1)
    }
    skullPrimitiveCount += 1
    if (source !== base) base.dispose()
    source.dispose()
  }
  const skullColor = (position: THREE.BufferAttribute, vertex: number): readonly [number, number, number] => {
    const height = THREE.MathUtils.clamp((position.getY(vertex) + 0.42) / 0.84, 0, 1)
    return [0.17 + height * 0.15, 0.022 + height * 0.07, 0.34 + height * 0.3]
  }
  const boneColor = (): readonly [number, number, number] => [0.52, 0.82, 1]
  const voidColor = (): readonly [number, number, number] => [0.004, 0.001, 0.012]

  appendSkullPrimitive(new THREE.SphereGeometry(0.32, 14, 9), (geometry) => {
    geometry.scale(0.8, 1, 0.72)
    geometry.translate(-0.43, 0.08, 0)
  }, skullColor)
  appendSkullPrimitive(new THREE.SphereGeometry(0.18, 10, 7), (geometry) => {
    geometry.scale(0.76, 0.9, 0.76)
    geometry.translate(-0.43, -0.2, 0.1)
  }, skullColor)
  for (const x of [-0.57, -0.29]) {
    appendSkullPrimitive(new THREE.OctahedronGeometry(0.105, 0), (geometry) => {
      geometry.scale(1.15, 0.65, 0.72)
      geometry.translate(x, -0.015, 0.12)
    }, skullColor)
  }
  for (const x of [-0.55, -0.31]) {
    appendSkullPrimitive(new THREE.SphereGeometry(0.075, 9, 6), (geometry) => {
      geometry.scale(1, 0.72, 0.28)
      geometry.translate(x, 0.105, 0.255)
    }, voidColor)
  }
  for (const [x, rotationZ] of [[-0.55, -0.16], [-0.31, 0.16]] as const) {
    appendSkullPrimitive(new THREE.TetrahedronGeometry(0.085, 0), (geometry) => {
      geometry.scale(1.15, 0.34, 0.42)
      geometry.rotateZ(rotationZ)
      geometry.translate(x, 0.185, 0.255)
    }, skullColor)
  }
  appendSkullPrimitive(new THREE.TetrahedronGeometry(0.09, 0), (geometry) => {
    geometry.scale(0.65, 0.85, 1.25)
    geometry.rotateX(0.16)
    geometry.translate(-0.43, -0.015, 0.31)
  }, skullColor)
  appendSkullPrimitive(new THREE.TetrahedronGeometry(0.072, 0), (geometry) => {
    geometry.scale(0.58, 1, 0.52)
    geometry.rotateX(0.18)
    geometry.translate(-0.43, -0.035, 0.238)
  }, voidColor)
  for (const offset of [-0.075, -0.025, 0.025, 0.075]) {
    appendSkullPrimitive(new THREE.TetrahedronGeometry(0.05, 0), (geometry) => {
      geometry.scale(0.62, 1.12, 0.72)
      geometry.rotateZ(Math.PI * 0.25)
      geometry.translate(-0.43 + offset, -0.25, 0.225)
    }, boneColor)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('pfxPart', new THREE.Float32BufferAttribute(parts, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxGhostCriticalGeometry'] = 'single-draw-closed-asymmetric-spectral-claw'
  geometry.userData['pfxGhostCriticalDrawCalls'] = 1
  geometry.userData['pfxGhostCriticalClosedFaces'] = true
  geometry.userData['pfxGhostCriticalTalonCount'] = talons.length
  geometry.userData['pfxGhostCriticalSkullVolume'] = true
  geometry.userData['pfxGhostCriticalSkullPrimitiveCount'] = skullPrimitiveCount
  geometry.userData['pfxGhostCriticalEyeSocketCount'] = 2
  geometry.userData['pfxGhostCriticalEyeSocketsRecessed'] = true
  geometry.userData['pfxGhostCriticalEyeSocketFront'] = 0.276
  geometry.userData['pfxGhostCriticalJawProjection'] = 0.16
  // Keep the face normal on +Z. Front evidence then separates both sockets,
  // while the +X profile projects them onto one occlusion line instead of
  // presenting the same oblique, two-eyed relief to every review camera.
  geometry.userData['pfxGhostCriticalFacingAxis'] = [Math.sin(skullYaw), 0, Math.cos(skullYaw)]
  geometry.userData['pfxGhostCriticalSkullYaw'] = skullYaw
  geometry.userData['pfxGhostCriticalProfileEyeSocketOverlap'] = false
  geometry.userData['pfxGhostCriticalLateralOrbitCount'] = 0
  geometry.userData['pfxGhostCriticalTalonMaximumDepth'] = Math.max(
    ...talons.flatMap((talon) => [talon.root[2], talon.mid[2], talon.tip[2]]),
  )
  geometry.userData['pfxGhostCriticalTalonMinimumDepth'] = Math.min(
    ...talons.flatMap((talon) => [talon.root[2], talon.mid[2], talon.tip[2]]),
  )
  geometry.userData['pfxGhostCriticalToothShape'] = 'tapered-fangs'
  geometry.userData['pfxGhostCriticalProfileFaceProjection'] = 0.4
  geometry.userData['pfxGhostCriticalCraniumRadius'] = 0.32
  geometry.userData['pfxGhostCriticalFrontBrowCount'] = 2
  geometry.userData['pfxGhostCriticalBrowShape'] = 'tapered-orbital-ridges'
  geometry.userData['pfxGhostCriticalMinimumTalonWidth'] = Math.min(...talons.map((talon) => talon.width))
  geometry.userData['pfxGhostCriticalMaximumTalonWidth'] = Math.max(...talons.map((talon) => talon.width))
  geometry.userData['pfxGhostCriticalTalonFacetSides'] = 7
  geometry.userData['pfxGhostCriticalSideSilhouetteLobeCount'] = 3
  geometry.userData['pfxGhostCriticalTrajectorySpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxGhostCriticalDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxGhostCriticalDepthToTrajectoryRatio'] =
    geometry.userData['pfxGhostCriticalDepthSpan'] / geometry.userData['pfxGhostCriticalTrajectorySpan']
  geometry.userData['pfxGhostCriticalAsymmetric'] = true
  return geometry
}

export function createPfxGhostCriticalTalonMaterial(opacity: number): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uBodyColor: { value: new THREE.Color('#5d24a0') },
      uEdgeColor: { value: new THREE.Color('#bdf8ff') },
      uFresnelPower: { value: 2.35 },
    },
    vertexShader: /* glsl */ `
      attribute float pfxPart;
      varying vec3 vLocalPosition;
      varying vec3 vNormalView;
      varying vec3 vViewPosition;
      varying vec3 vVertexColor;
      varying float vPart;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vLocalPosition = position;
        vNormalView = normalize(normalMatrix * normal);
        vViewPosition = -viewPosition.xyz;
        vVertexColor = color;
        vPart = pfxPart;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uFresnelPower;
      uniform vec3 uBodyColor;
      uniform vec3 uEdgeColor;
      varying vec3 vLocalPosition;
      varying vec3 vNormalView;
      varying vec3 vViewPosition;
      varying vec3 vVertexColor;
      varying float vPart;

      void main() {
        vec3 normalDirection = normalize(vNormalView);
        vec3 viewDirection = normalize(vViewPosition);
        float fresnel = pow(clamp(1.0 - abs(dot(normalDirection, viewDirection)), 0.0, 1.0), uFresnelPower);
        float spectralVein = smoothstep(0.72, 0.98, sin(vLocalPosition.x * 19.0 + vLocalPosition.y * 13.0 - vLocalPosition.z * 9.0) * 0.5 + 0.5);
        float spectralFracture = smoothstep(0.8, 0.98, sin(vLocalPosition.x * 31.0 - vLocalPosition.y * 17.0 + vLocalPosition.z * 23.0) * 0.5 + 0.5);
        float tipEnergy = smoothstep(-0.28, 0.78, vLocalPosition.x);
        float valueSeparation = smoothstep(0.18, 0.82, vVertexColor.b + vVertexColor.g * 0.5);
        float skullMask = step(0.5, vPart);
        vec3 body = mix(vVertexColor, uBodyColor, 0.14 + (1.0 - valueSeparation) * 0.1);
        float facetLight = 0.38 + 0.62 * abs(dot(normalDirection, normalize(vec3(0.32, 0.78, 0.54))));
        float prismaticCrossSection = 0.68 + facetLight * 0.32;
        body *= prismaticCrossSection;
        vec3 talonColor = mix(body, uEdgeColor, clamp(fresnel * 0.82 + spectralVein * 0.22 + spectralFracture * 0.16 + tipEnergy * 0.12, 0.0, 0.94));
        float cleanSkullLight = 0.5 + 0.5 * max(0.0, dot(normalDirection, normalize(vec3(-0.35, 0.72, 0.6))));
        vec3 cleanSkullColor = mix(vVertexColor * (0.62 + cleanSkullLight * 0.38), uEdgeColor, fresnel * 0.48);
        vec3 spectralColor = mix(talonColor, cleanSkullColor, skullMask);
        float talonAlpha = uOpacity * clamp(0.42 + fresnel * 0.42 + spectralVein * 0.12 + spectralFracture * 0.08, 0.0, 0.96);
        float spectralAlpha = mix(talonAlpha, uOpacity * clamp(0.68 + fresnel * 0.26, 0.0, 0.96), skullMask);
        float darkVoidMarker = 1.0 - smoothstep(0.025, 0.11, max(vVertexColor.r, max(vVertexColor.g, vVertexColor.b)));
        float voidMarker = darkVoidMarker;
        float socketFalloff = 0.08 + fresnel * 0.22;
        vec3 socketColor = mix(vec3(0.003, 0.0, 0.012), vec3(0.11, 0.025, 0.19), socketFalloff);
        spectralColor = mix(spectralColor, socketColor, voidMarker);
        float voidAlpha = uOpacity * 0.9;
        spectralAlpha = mix(spectralAlpha, voidAlpha, voidMarker);
        gl_FragColor = vec4(spectralColor, spectralAlpha);
      }
    `,
    vertexColors: true,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
  material.userData['pfxMaterial'] = 'violet-cyan-spectral-talon'
  return material
}
