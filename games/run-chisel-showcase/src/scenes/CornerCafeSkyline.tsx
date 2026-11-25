import { useEffect, useMemo } from 'react'
import { BoxGeometry, Color, Float32BufferAttribute, PlaneGeometry, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const BUILDINGS = [
  { x: -20.5, z: -5.8, width: 4.4, height: 5.8, color: '#81918f', roof: 0.26, top: 0 },
  { x: -16.2, z: -7.9, width: 4.8, height: 7.5, color: '#7a8d93', roof: 0.32, top: 1.05 },
  { x: -11.8, z: -10.2, width: 4.0, height: 6.25, color: '#89948c', roof: 0.46, top: 0 },
  { x: -7.0, z: -12.8, width: 3.8, height: 8.1, color: '#788b95', roof: 0.36, top: 0.74 },
  { x: -2.8, z: -15.6, width: 4.6, height: 6.5, color: '#829396', roof: 0.47, top: 0 },
] as const

function skylineGeometry() {
  const meshes: BufferGeometry[] = []
  const box = (x: number, y: number, z: number, width: number, height: number, depth: number, color: Color) => {
    const geometry = depth === 0 ? new PlaneGeometry(width, height) : new BoxGeometry(width, height, depth)
    geometry.translate(x, y, z)
    const colors: number[] = []
    const normals = geometry.getAttribute('normal')
    for (let i = 0; i < normals.count; i++) {
      const shade = normals.getY(i) > 0 ? 1.08 : normals.getZ(i) > 0 ? 1 : 0.81
      colors.push(color.r * shade, color.g * shade, color.b * shade)
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
    meshes.push(geometry)
  }
  for (const { x, z, width, height, color, roof, top } of BUILDINGS) {
    const stone = new Color(color)
    const trim = stone.clone().multiplyScalar(0.70)
    box(x, height / 2, z, width, height, 2.5, stone)
    box(x, height + roof / 2, z, width + 0.16, roof, 2.58, trim)
    if (top) {
      box(x + width * 0.17, height + roof + top / 2, z - 0.35, width * 0.48, top, 1.35, trim)
    }
    for (let floor = height - 1.13; floor > 1.8; floor -= 1.48) {
      for (const offset of [-0.29, 0, 0.29]) {
        box(x + width * offset, floor, z + 1.26, 0.56, 0.74, 0, trim)
      }
    }
  }
  const geometry = mergeGeometries(meshes)
  meshes.forEach((mesh) => mesh.dispose())
  return geometry
}

export function CornerCafeSkyline() {
  const geometry = useMemo(skylineGeometry, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial vertexColors />
    </mesh>
  )
}
