import * as THREE from 'three'

export function createPfxTargetBreakFragmentGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const faceColor: readonly [number, number, number] = [0.68, 0.95, 1]
  const edgeColor: readonly [number, number, number] = [0.14, 0.67, 0.94]
  const backColor: readonly [number, number, number] = [0.025, 0.24, 0.48]
  const cells = [
    { direction: [0.92, 0.22, 0.32], radius: 0.7, size: 0.115, sides: 6 },
    { direction: [-0.88, 0.4, -0.28], radius: 0.63, size: 0.105, sides: 6 },
    { direction: [0.18, 0.92, -0.42], radius: 0.66, size: 0.1, sides: 5 },
    { direction: [-0.32, -0.9, 0.5], radius: 0.72, size: 0.12, sides: 6 },
    { direction: [0.3, 0.12, 0.95], radius: 0.58, size: 0.095, sides: 6 },
    { direction: [-0.46, -0.16, -0.88], radius: 0.68, size: 0.11, sides: 5 },
    { direction: [0.58, -0.72, -0.4], radius: 0.61, size: 0.1, sides: 6 },
    { direction: [-0.64, 0.28, 0.72], radius: 0.56, size: 0.09, sides: 6 },
    { direction: [0.42, 0.68, 0.64], radius: 0.48, size: 0.085, sides: 5 },
    { direction: [-0.22, 0.62, -0.78], radius: 0.73, size: 0.105, sides: 6 },
    { direction: [0.72, -0.22, 0.66], radius: 0.52, size: 0.09, sides: 6 },
    { direction: [-0.76, -0.56, 0.34], radius: 0.47, size: 0.08, sides: 5 },
  ] as const
  const push = (point: THREE.Vector3, color: readonly [number, number, number]) => {
    positions.push(point.x, point.y, point.z)
    colors.push(...color)
  }
  const triangle = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    aColor: readonly [number, number, number],
    bColor: readonly [number, number, number],
    cColor: readonly [number, number, number],
  ) => {
    push(a, aColor)
    push(b, bColor)
    push(c, cColor)
  }
  const worldUp = new THREE.Vector3(0, 1, 0)
  const worldDepth = new THREE.Vector3(0, 0, 1)
  for (const [index, cell] of cells.entries()) {
    const normal = new THREE.Vector3(...cell.direction).normalize()
    const reference = Math.abs(normal.dot(worldUp)) > 0.82 ? worldDepth : worldUp
    const tangent = new THREE.Vector3().crossVectors(normal, reference).normalize()
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize()
    const center = normal.clone().multiplyScalar(cell.radius)
    const thickness = 0.035 + (index % 3) * 0.009
    const frontCenter = center.clone().addScaledVector(normal, thickness)
    const backCenter = center.clone().addScaledVector(normal, -thickness)
    const phase = index * 0.61
    const front = Array.from({ length: cell.sides }, (_, side) => {
      const angle = phase + (side / cell.sides) * Math.PI * 2
      const radius = cell.size * (1 + 0.06 * Math.sin(index * 1.7 + side * 2.1))
      return frontCenter.clone()
        .addScaledVector(tangent, Math.cos(angle) * radius)
        .addScaledVector(bitangent, Math.sin(angle) * radius)
    })
    const back = front.map((point) => point.clone().addScaledVector(normal, -thickness * 2))
    for (let side = 0; side < cell.sides; side += 1) {
      const next = (side + 1) % cell.sides
      triangle(frontCenter, front[side]!, front[next]!, faceColor, faceColor, edgeColor)
      triangle(backCenter, back[next]!, back[side]!, backColor, edgeColor, backColor)
      triangle(front[side]!, back[side]!, back[next]!, edgeColor, backColor, backColor)
      triangle(front[side]!, back[next]!, front[next]!, edgeColor, backColor, edgeColor)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxTargetBreakFragmentGeometry'] = 'single-draw-closed-honeycomb-shell-cells'
  geometry.userData['pfxTargetBreakFragmentDrawCalls'] = 1
  geometry.userData['pfxTargetBreakFragmentCount'] = cells.length
  geometry.userData['pfxTargetBreakClosedHoneycombCells'] = true
  geometry.userData['pfxTargetBreakDepthCrossingCount'] = cells.filter((cell) => Math.abs(new THREE.Vector3(...cell.direction).normalize().z) > 0.45).length
  geometry.userData['pfxTargetBreakMaximumRadius'] = geometry.boundingSphere!.radius
  return geometry
}

export function createPfxTargetBreakFragmentMaterial(opacity: number): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    transparent: true,
    opacity: THREE.MathUtils.clamp(opacity, 0, 1),
    blending: THREE.NormalBlending,
    depthWrite: true,
    side: THREE.DoubleSide,
    emissive: '#063c62',
    emissiveIntensity: 0.32,
    roughness: 0.18,
    metalness: 0.24,
    flatShading: true,
    toneMapped: false,
  })
  const shaderId = 'target-break-controlled-crystal-rim-v1'
  material.userData['pfxTargetBreakFragmentMaterial'] = 'faceted-cyan-crystal-with-controlled-rim'
  material.customProgramCacheKey = () => shaderId
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPfxTargetViewNormal;\nvarying vec3 vPfxTargetLocalPosition;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvPfxTargetLocalPosition = position;')
      .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\nvPfxTargetViewNormal = normalize(transformedNormal);')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPfxTargetViewNormal;\nvarying vec3 vPfxTargetLocalPosition;')
      .replace('#include <opaque_fragment>', `
        vec3 pfxTargetNormal = normalize(vPfxTargetViewNormal);
        vec3 pfxTargetView = normalize(vViewPosition);
        float pfxTargetRim = pow(1.0 - clamp(abs(dot(pfxTargetNormal, pfxTargetView)), 0.0, 1.0), 2.2);
        float pfxTargetFacet = pow(max(dot(pfxTargetNormal, normalize(vec3(0.28, 0.82, 0.5))), 0.0), 18.0);
        float pfxTargetBand = 0.5 + 0.5 * sin(dot(vPfxTargetLocalPosition, vec3(17.0, 23.0, 13.0)));
        outgoingLight *= mix(0.86, 1.08, pfxTargetBand);
        outgoingLight += vec3(0.08, 0.58, 0.92) * pfxTargetRim * 0.28;
        outgoingLight += vec3(0.82, 0.97, 1.0) * pfxTargetFacet * 0.24;
        #include <opaque_fragment>
      `)
  }
  return material
}
