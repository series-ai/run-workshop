import * as THREE from 'three'
import { smoothPfxWaterColumnNormals } from '../constants/04'

export function createPfxWaterColumnFoamGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const progresses: number[] = []
  const colors: number[] = []
  let activeProgress = 0
  const pushTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, shade: number) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    progresses.push(activeProgress, activeProgress, activeProgress)
    colors.push(shade, 0.9 + shade * 0.1, 1, shade, 0.9 + shade * 0.1, 1, shade, 0.9 + shade * 0.1, 1)
  }
  const appendFoamTube = (
    points: readonly THREE.Vector3[],
    radius: number,
    progress: number,
    scalloped = false,
  ) => {
    activeProgress = progress
    const sides = 6
    const rings = points.map((point, pointIndex) => {
      const next = points[Math.min(points.length - 1, pointIndex + 1)]!
      const previous = points[Math.max(0, pointIndex - 1)]!
      const axis = next.clone().sub(previous).normalize()
      const basisA = axis.clone().cross(Math.abs(axis.y) > 0.86 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize()
      const basisB = axis.clone().cross(basisA).normalize()
      const localProgress = pointIndex / Math.max(1, points.length - 1)
      const scallopEnvelope = [0.62, 1.38, 1.7, 0.94, 0.28][pointIndex] ?? 0.28
      const taper = scalloped
        ? scallopEnvelope
        : 0.72 + Math.sin(localProgress * Math.PI) * 0.28
      return Array.from({ length: sides }, (_, side) => {
        const angle = side / sides * Math.PI * 2 + pointIndex * 0.12
        return point.clone()
          .addScaledVector(basisA, Math.cos(angle) * radius * taper)
          .addScaledVector(basisB, Math.sin(angle) * radius * taper)
      })
    })
    for (let ring = 0; ring < rings.length - 1; ring += 1) {
      for (let side = 0; side < sides; side += 1) {
        const next = (side + 1) % sides
        pushTriangle(rings[ring]![side]!, rings[ring]![next]!, rings[ring + 1]![next]!, 0.84 + ring * 0.025)
        pushTriangle(rings[ring]![side]!, rings[ring + 1]![next]!, rings[ring + 1]![side]!, 0.9 + ring * 0.018)
      }
    }
    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides
      pushTriangle(points[0]!, rings[0]![next]!, rings[0]![side]!, 0.82)
      pushTriangle(points.at(-1)!, rings.at(-1)![side]!, rings.at(-1)![next]!, 0.98)
    }
  }
  const crownFoamStreakCount = 9
  const crownAzimuths = [0.05, 0.38, 0.92, 1.58, 2.45, 3.08, 3.62, 4.45, 5.48] as const
  const crownReaches = [1.28, 0.82, 0.62, 0.7, 0.78, 1.18, 0.62, 0.58, 0.68] as const
  const crownFoamCoverageRatios = [0.56, 0.42, 0.48, 0.38, 0.52, 0.58, 0.44, 0.36, 0.5] as const
  const crownTerminalDrops = [0.52, 0.42, 0.58, 0.46, 0.64, 0.48, 0.56, 0.44, 0.6] as const
  for (let streak = 0; streak < crownFoamStreakCount; streak += 1) {
    const angle = crownAzimuths[streak]!
    const reach = crownReaches[streak]!
    const bend = ((streak % 2 === 0 ? 1 : -1) * (0.055 + (streak % 3) * 0.018))
    const coverage = crownFoamCoverageRatios[streak]!
    const points = Array.from({ length: 5 }, (_, station) => {
      const local = station / 4
      const progress = 0.1 + local * coverage
      const radial = reach * Math.sin(progress * Math.PI * 0.5)
      const arcAngle = angle + Math.sin(progress * Math.PI) * bend
      const lift = Math.sin(progress * Math.PI) * (0.28 + (streak % 4) * 0.045)
      return new THREE.Vector3(
        Math.cos(arcAngle) * radial,
        1.335 + lift - progress * crownTerminalDrops[streak]!,
        Math.sin(arcAngle) * radial * (0.88 + Math.cos(angle * 2 - 0.3) * 0.035),
      )
    })
    appendFoamTube(points, 0.034 + (streak % 3) * 0.005, 0.72 + (streak % 3) * 0.08, true)
  }
  const groundFoamStreakCount = 6
  for (let streak = 0; streak < groundFoamStreakCount; streak += 1) {
    const angle = streak / groundFoamStreakCount * Math.PI * 2 + 0.34
    const points = Array.from({ length: 5 }, (_, station) => {
      const progress = station / 4
      const radius = 0.14 + progress * (0.42 + (streak % 3) * 0.05)
      const curve = angle + Math.sin(progress * Math.PI) * (streak % 2 === 0 ? 0.08 : -0.08)
      return new THREE.Vector3(
        Math.cos(curve) * radius,
        -0.875 - progress * 0.07 + Math.sin(progress * Math.PI) * 0.025,
        Math.sin(curve) * radius * 0.9,
      )
    })
    appendFoamTube(points, 0.022 + (streak % 2) * 0.004, 0.08 + streak * 0.025)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('pfxWaterProgress', new THREE.Float32BufferAttribute(progresses, 1))
  geometry.setAttribute('pfxWaterFlowLane', new THREE.Float32BufferAttribute(progresses.map((progress) => progress * 7), 1))
  smoothPfxWaterColumnNormals(geometry)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxWaterColumnFoamGeometry'] = 'closed-crown-caps-and-ground-foam-streaks'
  geometry.userData['pfxWaterColumnFoamDrawCalls'] = 1
  geometry.userData['pfxWaterColumnFoamClosedFaces'] = true
  geometry.userData['pfxWaterColumnCrownFoamStreakCount'] = crownFoamStreakCount
  geometry.userData['pfxWaterColumnCrownFoamScallopedCapCount'] = crownFoamStreakCount
  geometry.userData['pfxWaterColumnCrownFoamCoverageRatio'] = Math.max(...crownFoamCoverageRatios)
  geometry.userData['pfxWaterColumnDetachedDropletCount'] = 0
  geometry.userData['pfxWaterColumnFoamAttachedToCrown'] = true
  geometry.userData['pfxWaterColumnGroundFoamStreakCount'] = groundFoamStreakCount
  geometry.userData['pfxWaterColumnFlatFoamCardCount'] = 0
  geometry.userData['pfxWaterColumnFoamBillboardCount'] = 0
  geometry.userData['pfxWaterColumnRoundedFoamTopology'] = true
  geometry.userData['pfxWaterColumnFoamTopology'] = 'attached-scalloped-caps-and-ground-streaks'
  return geometry
}

export function createPfxWaterColumnFoamMaterial(
  opacity: number,
  primaryColor = '#168fd1',
  secondaryColor = '#bdefff',
  density = 0.58,
  styleEdgeHardness = 0.52,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uPrimaryColor: { value: new THREE.Color(primaryColor) },
      uSecondaryColor: { value: new THREE.Color(secondaryColor) },
      uDensity: { value: THREE.MathUtils.clamp(density, 0, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
    },
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      attribute float pfxWaterProgress;
      attribute float pfxWaterFlowLane;
      varying vec3 vFoamColor;
      varying vec3 vFoamNormal;
      varying vec3 vFoamViewPosition;
      varying vec3 vFoamObjectPosition;
      varying float vFoamProgress;
      float mobileFoamWave(float value) {
        return abs(fract(value) - 0.5) * 2.0;
      }
      void main() {
        float lift = sin(uCycle * 15.0 + pfxWaterFlowLane) * 0.025 * pfxWaterProgress;
        vec3 transformed = position;
        transformed.y += lift;
        float crownMask = smoothstep(0.55, 0.7, pfxWaterProgress);
        float crownBuild = smoothstep(0.0, 0.14, uCycle);
        float crownEmergence = smoothstep((pfxWaterProgress - 0.7) * 1.5, (pfxWaterProgress - 0.7) * 1.5 + 0.24, crownBuild);
        float crownFactor = mix(1.0, crownEmergence, crownMask);
        transformed.xz *= crownFactor;
        transformed.y = mix(1.29, transformed.y, crownFactor);
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vFoamColor = color;
        vFoamNormal = normalize(normalMatrix * normal);
        vFoamViewPosition = viewPosition.xyz;
        vFoamObjectPosition = transformed;
        vFoamProgress = pfxWaterProgress;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uCycle;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      varying vec3 vFoamColor;
      varying vec3 vFoamNormal;
      varying vec3 vFoamViewPosition;
      varying vec3 vFoamObjectPosition;
      varying float vFoamProgress;
      float mobileFoamWave(float value) {
        return abs(fract(value) - 0.5) * 2.0;
      }
      void main() {
        vec3 normal = normalize(vFoamNormal);
        vec3 viewDirection = normalize(-vFoamViewPosition);
        float facing = abs(dot(normal, viewDirection));
        float rimBase = 1.0 - facing;
        float rimFoam = rimBase * rimBase;
        float foamSoftness = smoothstep(0.12, 0.82, facing);
        float foamNoise = mobileFoamWave(dot(vFoamObjectPosition, vec3(1.3, 0.9, 1.7)) - uCycle * 3.4 + vFoamProgress * 1.1);
        float foamBreakup = smoothstep(0.18, 0.82, foamNoise);
        float foamCrest = 0.64 + mobileFoamWave((uCycle + vFoamProgress) * 3.0) * 0.36;
        float collapse = smoothstep(0.56, 0.94, uCycle);
        float coverage = (0.42 + rimFoam * 0.2 + foamSoftness * 0.38) * (0.62 + foamBreakup * 0.38) * foamCrest * (1.0 - collapse);
        vec3 brightFoam = mix(uPrimaryColor, uSecondaryColor, 0.62);
        vec3 foamWhite = uSecondaryColor;
        vec3 controlledFoamColor = mix(brightFoam, foamWhite, foamSoftness * 0.62 + 0.3);
        vec3 foam = mix(controlledFoamColor, foamWhite, foamBreakup * 0.24);
        gl_FragColor = vec4(foam * coverage * mix(1.02, 1.28, uDensity), uOpacity * coverage * mix(0.88, 1.0, uStyleEdgeHardness));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxWaterColumnMaterial'] = 'closed-radial-foam-and-droplets'
  material.userData['pfxWaterColumnFoamMaterial'] = true
  material.userData['pfxWaterColumnControlBinding'] = 'primary-secondary-density-style'
  return material
}
