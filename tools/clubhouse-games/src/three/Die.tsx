import { ComponentProps, useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { DIE_PALETTES, DieColorway } from '../dice/colorways'
import { dieGeometry, facesForDie } from '../dice/geometry'
import { DieKind, DieStyle, resolveDieStyle } from '../dice/kinds'
import { paintDieFace } from '../dice/paintDieFace'
import { paintDieNumeral } from '../dice/paintDieNumeral'
import { DIE_FACES, DieValue } from '../dice/pipFaces'
import { BoxFaceName, BoxPiece } from './BoxPiece'
import { getCachedTexture } from './textures'

export interface DieProps extends Omit<ComponentProps<'mesh'>, 'ref'> {
  size?: number
  lit?: boolean
  kind?: DieKind
  style?: DieStyle
  colorway?: DieColorway
}

export function Die({
  size = 0.6,
  lit = true,
  kind = 6,
  style = 'pip',
  colorway = 'ivory',
  ...meshProps
}: DieProps) {
  const resolved = resolveDieStyle(kind, style)
  if (kind === 6) {
    return (
      <CubeDie
        size={size}
        lit={lit}
        style={resolved}
        colorway={colorway}
        {...meshProps}
      />
    )
  }
  return (
    <PolyhedronDie
      size={size}
      lit={lit}
      kind={kind}
      style={resolved}
      colorway={colorway}
    />
  )
}

function CubeDie({
  size,
  lit,
  style,
  colorway,
  ...meshProps
}: {
  size: number
  lit: boolean
  style: DieStyle
  colorway: DieColorway
} & Omit<ComponentProps<'mesh'>, 'ref'>) {
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const pal = DIE_PALETTES[colorway]
  const faces = useMemo(() => {
    const map: Partial<Record<BoxFaceName, THREE.Texture>> = {}
    for (const [face, value] of Object.entries(DIE_FACES)) {
      const v = value as DieValue
      const key =
        style === 'numeral'
          ? `die-numeral:${style}:${colorway}:${v}:solid`
          : `die-face:${style}:${colorway}:${v}:solid`
      map[face as BoxFaceName] = getCachedTexture(
        key,
        () =>
          style === 'numeral'
            ? paintDieNumeral(v, { colorway, style, opaque: true })
            : paintDieFace(v, { style, colorway }),
        maxAniso,
      )
    }
    return map
  }, [maxAniso, style, colorway])
  return (
    <BoxPiece
      size={[size, size, size]}
      faces={faces}
      edgeColor={pal.edge}
      lit={lit}
      roughness={style === 'ornate' ? 0.38 : 0.55}
      transparentMaps={false}
      {...meshProps}
    />
  )
}

function PolyhedronDie({
  size,
  lit,
  kind,
  style,
  colorway,
}: {
  size: number
  lit: boolean
  kind: DieKind
  style: DieStyle
  colorway: DieColorway
}) {
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const radius = size / 2
  const pal = DIE_PALETTES[colorway]
  const geom = useMemo(() => dieGeometry(kind, radius), [kind, radius])
  const faces = useMemo(() => facesForDie(kind, radius), [kind, radius])
  const labelStyle: DieStyle = style === 'pip' ? 'numeral' : style
  const labelSize =
    radius *
    (kind === 20 ? 0.4 : kind === 12 ? 0.46 : kind === 4 ? 0.72 : kind === 10 ? 0.42 : 0.55)

  const textures = useMemo(() => {
    return faces.map((f) =>
      getCachedTexture(
        `die-numeral:${labelStyle}:${colorway}:${f.value}`,
        () => paintDieNumeral(f.value, { colorway, style: labelStyle }),
        maxAniso,
      ),
    )
  }, [faces, labelStyle, colorway, maxAniso])

  const bodyMat = useMemo(() => {
    return lit
      ? new THREE.MeshStandardMaterial({
          color: pal.face,
          roughness: style === 'ornate' ? 0.38 : 0.55,
        })
      : new THREE.MeshBasicMaterial({ color: pal.face })
  }, [lit, pal.face, style])
  useEffect(() => () => {
    geom.dispose()
    bodyMat.dispose()
  }, [geom, bodyMat])

  const labelQuats = useMemo(() => {
    const z = new THREE.Vector3(0, 0, 1)
    return faces.map((f) => new THREE.Quaternion().setFromUnitVectors(z, f.normal))
  }, [faces])

  return (
    <group>
      <mesh geometry={geom} material={bodyMat} castShadow />
      {faces.map((f, i) => (
        <mesh
          key={f.value}
          position={[
            f.centroid.x + f.normal.x * radius * 0.02,
            f.centroid.y + f.normal.y * radius * 0.02,
            f.centroid.z + f.normal.z * radius * 0.02,
          ]}
          quaternion={labelQuats[i]}
        >
          <planeGeometry args={[labelSize, labelSize]} />
          <meshStandardMaterial
            map={textures[i]}
            transparent
            roughness={0.45}
            metalness={0}
            polygonOffset
            polygonOffsetFactor={-2}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}
