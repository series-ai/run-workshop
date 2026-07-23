import * as THREE from 'three'

export function createPfxPlasmaAmbientOrbitGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const orbitSpecs = [
    { radius: 0.66, tube: 0.025, start: 0.28, arc: Math.PI * 1.48, rotation: [0.48, 0.08, 0.18], color: [0.16, 0.68, 1] },
    { radius: 0.76, tube: 0.021, start: 1.72, arc: Math.PI * 1.3, rotation: [1.38, 0.54, -0.2], color: [0.48, 0.94, 1] },
    { radius: 0.84, tube: 0.018, start: 3.18, arc: Math.PI * 1.14, rotation: [0.84, 1.16, 0.44], color: [0.12, 0.46, 1] },
  ] as const
  const segments = 28
  const sides = 6

  for (const spec of orbitSpecs) {
    const startVertex = positions.length / 3
    const rotation = new THREE.Euler(spec.rotation[0], spec.rotation[1], spec.rotation[2])
    for (let segment = 0; segment <= segments; segment += 1) {
      const t = segment / segments
      const theta = spec.start + spec.arc * t
      const radial = new THREE.Vector3(Math.cos(theta), Math.sin(theta), 0)
      const binormal = new THREE.Vector3(0, 0, 1)
      const center = radial.clone().multiplyScalar(spec.radius).applyEuler(rotation)
      for (let side = 0; side < sides; side += 1) {
        const phi = (side / sides) * Math.PI * 2
        const normal = radial.clone().multiplyScalar(Math.cos(phi)).addScaledVector(binormal, Math.sin(phi)).applyEuler(rotation).normalize()
        const point = center.clone().addScaledVector(normal, spec.tube)
        positions.push(point.x, point.y, point.z)
        normals.push(normal.x, normal.y, normal.z)
        const heat = 0.68 + Math.sin(t * Math.PI) * 0.32
        colors.push(spec.color[0] * heat, spec.color[1] * heat, spec.color[2])
      }
    }
    for (let segment = 0; segment < segments; segment += 1) {
      for (let side = 0; side < sides; side += 1) {
        const next = (side + 1) % sides
        const a = startVertex + segment * sides + side
        const b = startVertex + segment * sides + next
        const c = startVertex + (segment + 1) * sides + next
        const d = startVertex + (segment + 1) * sides + side
        indices.push(a, d, b, b, d, c)
      }
    }

    const addCap = (segment: number, reverse: boolean) => {
      const theta = spec.start + spec.arc * (segment / segments)
      const center = new THREE.Vector3(Math.cos(theta) * spec.radius, Math.sin(theta) * spec.radius, 0).applyEuler(rotation)
      const tangent = new THREE.Vector3(-Math.sin(theta), Math.cos(theta), 0).applyEuler(rotation).normalize().multiplyScalar(reverse ? -1 : 1)
      const centerIndex = positions.length / 3
      positions.push(center.x, center.y, center.z)
      normals.push(tangent.x, tangent.y, tangent.z)
      colors.push(spec.color[0], spec.color[1], spec.color[2])
      const ringStart = startVertex + segment * sides
      for (let side = 0; side < sides; side += 1) {
        const next = (side + 1) % sides
        indices.push(
          centerIndex,
          ringStart + (reverse ? next : side),
          ringStart + (reverse ? side : next),
        )
      }
    }
    addCap(0, true)
    addCap(segments, false)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxPlasmaAmbientOrbitGeometry'] = 'single-draw-capped-broken-three-axis-cage'
  geometry.userData['pfxPlasmaAmbientOrbitDrawCalls'] = 1
  geometry.userData['pfxPlasmaAmbientBrokenOrbitCount'] = orbitSpecs.length
  geometry.userData['pfxPlasmaAmbientAxisCount'] = orbitSpecs.length
  geometry.userData['pfxPlasmaAmbientClosedTubes'] = true
  return geometry
}

export function createPfxPlasmaAmbientOrbitMaterial(opacity: number): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    vertexColors: true,
    transparent: true,
    opacity: THREE.MathUtils.clamp(opacity, 0, 1),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
  material.userData['pfxPlasmaAmbientOrbitMaterial'] = 'broken-three-axis-containment'
  return material
}
