import * as THREE from 'three'

export function createPfxAcidPoolGeometry(boundarySegments = 48, radialRings = 6): THREE.BufferGeometry {
  const segments = Math.max(40, Math.floor(boundarySegments))
  const rings = Math.max(4, Math.floor(radialRings))
  const positions: number[] = [0, 0, 0]
  const normals: number[] = [0, 1, 0]
  const uvs: number[] = [0.5, 0.5]
  const indices: number[] = []
  const boundaryRadius = (angle: number) => 1 + Math.sin(angle * 3 + 0.4) * 0.075 + Math.sin(angle * 7 - 0.8) * 0.045 + Math.cos(angle * 11) * 0.025
  const ringStarts: number[] = []

  for (let ring = 1; ring <= rings; ring += 1) {
    ringStarts.push(positions.length / 3)
    const fraction = ring / rings
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2
      const radius = boundaryRadius(angle) * fraction
      const x = Math.cos(angle) * radius * 1.12
      const z = Math.sin(angle) * radius * 0.82
      const y = Math.sin(angle * 2.3 + fraction * 1.7) * 0.006 * fraction
      positions.push(x, y, z)
      normals.push(0, 1, 0)
      uvs.push(x / 2.5 + 0.5, z / 1.9 + 0.5)
    }
  }
  const firstRing = ringStarts[0]!
  for (let segment = 0; segment < segments; segment += 1) {
    indices.push(0, firstRing + segment, firstRing + (segment + 1) % segments)
  }
  for (let ring = 0; ring < rings - 1; ring += 1) {
    const inner = ringStarts[ring]!
    const outer = ringStarts[ring + 1]!
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments
      indices.push(inner + segment, outer + segment, inner + next)
      indices.push(inner + next, outer + segment, outer + next)
    }
  }

  const boundaryTop = positions.length / 3
  for (let segment = 0; segment < segments; segment += 1) {
    const angle = (segment / segments) * Math.PI * 2
    const radius = boundaryRadius(angle)
    const x = Math.cos(angle) * radius * 1.12
    const z = Math.sin(angle) * radius * 0.82
    const edgeNormal = new THREE.Vector3(x / 1.12, 0.18, z / 0.82).normalize()
    positions.push(x, 0, z, x, -0.075, z)
    normals.push(edgeNormal.x, edgeNormal.y, edgeNormal.z, edgeNormal.x, edgeNormal.y, edgeNormal.z)
    const u = segment / segments
    uvs.push(u, 1, u, 0)
  }
  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments
    const top = boundaryTop + segment * 2
    const bottom = top + 1
    const nextTop = boundaryTop + next * 2
    const nextBottom = nextTop + 1
    indices.push(top, bottom, nextTop, nextTop, bottom, nextBottom)
  }

  const bubbles: Array<[number, number, number, number]> = [
    [-0.48, 0.18, 0.16, 1], [0.34, -0.26, 0.13, 0.82], [0.08, 0.36, 0.11, 0.68],
    [0.58, 0.18, 0.085, 0.58], [-0.18, -0.42, 0.1, 0.72], [0.02, -0.08, 0.075, 0.5],
  ]
  const bubbleSides = 12
  const bubbleLatitudes = 5
  for (const [centerX, centerZ, radius, heightScale] of bubbles) {
    const bubbleStart = positions.length / 3
    for (let latitude = 0; latitude <= bubbleLatitudes; latitude += 1) {
      const phi = (latitude / bubbleLatitudes) * Math.PI * 0.5
      const ringRadius = Math.cos(phi) * radius
      const y = Math.sin(phi) * radius * heightScale
      for (let side = 0; side < bubbleSides; side += 1) {
        const theta = (side / bubbleSides) * Math.PI * 2
        const nx = Math.cos(theta) * Math.cos(phi)
        const ny = Math.sin(phi)
        const nz = Math.sin(theta) * Math.cos(phi)
        positions.push(centerX + nx * radius, y, centerZ + nz * radius)
        normals.push(nx, ny, nz)
        uvs.push(side / bubbleSides, latitude / bubbleLatitudes)
      }
    }
    for (let latitude = 0; latitude < bubbleLatitudes; latitude += 1) {
      for (let side = 0; side < bubbleSides; side += 1) {
        const next = (side + 1) % bubbleSides
        const a = bubbleStart + latitude * bubbleSides + side
        const b = bubbleStart + latitude * bubbleSides + next
        const c = bubbleStart + (latitude + 1) * bubbleSides + next
        const d = bubbleStart + (latitude + 1) * bubbleSides + side
        indices.push(a, d, b, b, d, c)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxAcidPoolGeometry'] = 'irregular-skirted-pool-with-integrated-domes'
  geometry.userData['pfxAcidPoolDrawCalls'] = 1
  geometry.userData['pfxAcidPoolBoundarySegments'] = segments
  geometry.userData['pfxAcidPoolBubbleCount'] = bubbles.length
  geometry.userData['pfxAcidPoolClosedSkirt'] = true
  return geometry
}
