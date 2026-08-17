export function toLocalCameraPosition(
  worldX: number,
  worldY: number,
  worldZ: number,
  worldScale: number,
): [number, number, number] {
  const scale = worldScale || 1
  return [worldX / scale, worldY / scale, worldZ / scale]
}

export function verticalBillboardYaw(
  cameraX: number,
  cameraZ: number,
  particleX: number,
  particleZ: number,
): number {
  return Math.atan2(cameraX - particleX, cameraZ - particleZ)
}
