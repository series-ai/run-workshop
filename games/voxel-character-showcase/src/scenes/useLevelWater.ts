import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Frustum, Group, Matrix4, Mesh, PerspectiveCamera, PlaneGeometry, ShaderMaterial } from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'
import type { ResolvedLevelKit } from '@voxchar/contracts/levelKits'

function createWaterReflection(height: number) {
  const mirror = new Reflector(new PlaneGeometry(1, 1), {
    textureWidth: 512,
    textureHeight: 256,
    multisample: 0,
    clipBias: 0.0015,
  })
  mirror.position.y = height
  mirror.rotation.x = -Math.PI / 2
  mirror.updateMatrixWorld()
  const material = mirror.material
  const reflectionMatrix = material instanceof ShaderMaterial ? material.uniforms.textureMatrix?.value : undefined
  if (!(material instanceof ShaderMaterial) || !(reflectionMatrix instanceof Matrix4)) {
    mirror.geometry.dispose()
    mirror.dispose()
    throw new Error('The water reflector needs a shader projection matrix.')
  }
  return {
    mirror,
    material,
    group: new Group(),
    inverseWorld: mirror.matrixWorld.clone().invert(),
    reflectionMatrix,
    frustum: new Frustum(),
    viewProjection: new Matrix4(),
    projection: { value: new Matrix4() },
    texture: { value: mirror.getRenderTarget().texture },
    enabled: { value: 0 },
  }
}

export type WaterReflection = Pick<ReturnType<typeof createWaterReflection>, 'projection' | 'texture' | 'enabled'>

export function useLevelWater(layout: ResolvedLevelKit | undefined, eyeLevel: boolean): WaterReflection | undefined {
  const supported = useThree((state) => state.size.width >= 640
    && state.gl.extensions.has('EXT_color_buffer_float'))
  const water = useMemo(() => layout?.placements.filter(({ item }) => item.surface === 'water') ?? [], [layout])
  const ids = useMemo(() => new Set(water.map(({ item }) => item.id)), [water])
  const heights = water.map(({ position, item }) => position[1] + item.bounds.max[1])
  const height = heights.length > 0 && Math.max(...heights) - Math.min(...heights) < 0.05
    ? Math.max(...heights) : undefined
  const reflection = useMemo(() => eyeLevel && supported && height !== undefined
    ? createWaterReflection(height) : undefined, [eyeLevel, height, supported])
  useEffect(() => () => {
    if (reflection) {
      reflection.mirror.geometry.dispose()
      reflection.mirror.dispose()
    }
  }, [reflection])

  useFrame(({ gl, scene, camera }) => {
    if (!reflection) return
    const { mirror, material, group, inverseWorld, reflectionMatrix, projection, enabled, frustum, viewProjection } = reflection
    enabled.value = 0
    if (!(camera instanceof PerspectiveCamera) || camera.position.y <= mirror.position.y + 0.05) return
    const surfaces: Mesh[] = []
    scene.traverseVisible((node) => {
      if (node instanceof Mesh && ids.has(node.name)) surfaces.push(node)
    })
    if (!surfaces.length) return

    camera.updateMatrixWorld()
    viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    frustum.setFromProjectionMatrix(viewProjection)
    if (!surfaces.some((surface) => frustum.intersectsObject(surface))) return

    for (const surface of surfaces) surface.visible = false
    try {
      mirror.onBeforeRender(gl, scene, camera, mirror.geometry, material, group)
      projection.value.copy(reflectionMatrix).multiply(inverseWorld)
      enabled.value = 1
    } finally {
      for (const surface of surfaces) surface.visible = true
    }
  }, -0.5)
  return reflection
}
