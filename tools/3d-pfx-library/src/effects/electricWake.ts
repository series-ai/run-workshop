import * as THREE from 'three'

export function createPfxElectricWakeGeometry(radialSegments = 10): THREE.BufferGeometry {
  const radial = Math.max(8, Math.floor(radialSegments))
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  type BoltNode = { point: THREE.Vector3; u: number; radius: number }

  const appendTube = (nodes: BoltNode[], strand: number) => {
    const vertexStart = positions.length / 3
    const tangents = nodes.map((_node, nodeIndex) => {
      const previous = nodes[Math.max(0, nodeIndex - 1)]!.point
      const next = nodes[Math.min(nodes.length - 1, nodeIndex + 1)]!.point
      return next.clone().sub(previous).normalize()
    })
    const firstReference = Math.abs(tangents[0]!.y) < 0.86
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(0, 0, 1)
    let transportedAxis = new THREE.Vector3().crossVectors(tangents[0]!, firstReference).normalize()
    for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
      const node = nodes[nodeIndex]!
      const tangent = tangents[nodeIndex]!
      if (nodeIndex > 0) {
        // Parallel-transport the previous ring frame onto the new tangent's
        // normal plane. Independent per-node cross products can flip by 90°
        // at a lightning kink, stretching the connecting quads into sails.
        const projected = transportedAxis.clone().addScaledVector(tangent, -transportedAxis.dot(tangent))
        if (projected.lengthSq() < 1e-6) {
          const fallback = Math.abs(tangent.y) < 0.86
            ? new THREE.Vector3(0, 1, 0)
            : new THREE.Vector3(0, 0, 1)
          transportedAxis = new THREE.Vector3().crossVectors(tangent, fallback).normalize()
        } else {
          transportedAxis = projected.normalize()
        }
      }
      const axisA = transportedAxis
      const axisB = new THREE.Vector3().crossVectors(tangent, axisA).normalize()
      for (let side = 0; side < radial; side += 1) {
        const angle = (side / radial) * Math.PI * 2
        const radialNormal = axisA.clone().multiplyScalar(Math.cos(angle)).addScaledVector(axisB, Math.sin(angle)).normalize()
        const lobe = 1 + Math.sin(angle * 3 + strand * 1.7 + node.u * 9) * 0.08
        const position = node.point.clone().addScaledVector(radialNormal, node.radius * lobe)
        positions.push(position.x, position.y, position.z)
        normals.push(radialNormal.x, radialNormal.y, radialNormal.z)
        // Two UV units per strand let the shader recover both an integer
        // strand id and a wrapped angular coordinate without another buffer.
        uvs.push(node.u, strand * 2 + (side / radial) * 2)
      }
    }
    for (let ring = 0; ring < nodes.length - 1; ring += 1) {
      for (let side = 0; side < radial; side += 1) {
        const nextSide = (side + 1) % radial
        const a = vertexStart + ring * radial + side
        const b = vertexStart + ring * radial + nextSide
        const c = vertexStart + (ring + 1) * radial + nextSide
        const d = vertexStart + (ring + 1) * radial + side
        indices.push(a, d, b, b, d, c)
      }
    }
    const startCenter = positions.length / 3
    const startTangent = nodes[1]!.point.clone().sub(nodes[0]!.point).normalize().multiplyScalar(-1)
    positions.push(nodes[0]!.point.x, nodes[0]!.point.y, nodes[0]!.point.z)
    normals.push(startTangent.x, startTangent.y, startTangent.z)
    uvs.push(nodes[0]!.u, strand * 2 + 1)
    const endCenter = positions.length / 3
    const last = nodes.length - 1
    const endTangent = nodes[last]!.point.clone().sub(nodes[last - 1]!.point).normalize()
    positions.push(nodes[last]!.point.x, nodes[last]!.point.y, nodes[last]!.point.z)
    normals.push(endTangent.x, endTangent.y, endTangent.z)
    uvs.push(nodes[last]!.u, strand * 2 + 1)
    const endRing = vertexStart + last * radial
    for (let side = 0; side < radial; side += 1) {
      const nextSide = (side + 1) % radial
      indices.push(startCenter, vertexStart + nextSide, vertexStart + side)
      indices.push(endCenter, endRing + side, endRing + nextSide)
    }
  }

  const node = (x: number, y: number, z: number, u: number, radius: number): BoltNode => ({
    point: new THREE.Vector3(x, y, z), u, radius,
  })
  const main = [
    node(1.02, 0, 0, 0, 0.13),
    node(0.72, 0.06, 0.04, 0.1, 0.12),
    node(0.42, -0.11, 0.16, 0.2, 0.12),
    node(0.12, 0.1, 0.12, 0.3, 0.11),
    node(-0.18, -0.08, 0.28, 0.4, 0.1),
    node(-0.48, 0.11, 0.24, 0.5, 0.09),
    node(-0.78, -0.05, 0.4, 0.6, 0.078),
    node(-1.08, 0.09, 0.36, 0.7, 0.065),
    node(-1.38, -0.12, 0.54, 0.8, 0.05),
    node(-1.68, 0.03, 0.5, 0.9, 0.04),
    node(-2.04, -0.04, 0.62, 1, 0.025),
  ]
  const upperFork = [
    node(0.12, 0.1, 0.12, 0.3, 0.09),
    node(-0.16, 0.3, 0.32, 0.43, 0.07),
    node(-0.48, 0.47, 0.55, 0.58, 0.05),
    node(-0.84, 0.6, 0.72, 0.73, 0.022),
  ]
  const lowerFork = [
    node(-0.18, -0.08, 0.28, 0.4, 0.075),
    node(-0.5, -0.25, 0.05, 0.54, 0.06),
    node(-0.86, -0.43, -0.2, 0.7, 0.04),
    node(-1.26, -0.57, -0.42, 0.86, 0.02),
  ]
  appendTube(main, 0)
  appendTube(upperFork, 1)
  appendTube(lowerFork, 2)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxElectricWakeGeometry'] = 'closed-forked-directional-bolt-volume'
  geometry.userData['pfxElectricWakeClosedCaps'] = true
  geometry.userData['pfxElectricWakeFrameTransport'] = 'parallel-transport'
  geometry.userData['pfxElectricWakeMainDepthDrift'] = 0.62
  geometry.userData['pfxElectricWakeMainDepthOscillation'] = 0.08
  geometry.userData['pfxElectricWakeStrandCount'] = 3
  geometry.userData['pfxElectricWakeRadialSegments'] = radial
  geometry.userData['pfxElectricWakeHeadRadius'] = 0.13
  geometry.userData['pfxElectricWakeTailRadius'] = 0.025
  geometry.userData['pfxElectricWakeDrawCalls'] = 1
  return geometry
}
