import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export function createPfxShadowBurstSplinterGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const directions: number[] = []
  const forms: number[] = []
  const appendPrimitive = (source: THREE.BufferGeometry, center: THREE.Vector3, rotation: THREE.Quaternion, scale: THREE.Vector3, direction: THREE.Vector3, seed: number, form: number) => {
    const raw = source.index ? source.toNonIndexed() : source
    const position = raw.getAttribute('position')
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(position, vertex).multiply(scale).applyQuaternion(rotation).add(center)
      positions.push(point.x, point.y, point.z)
      centers.push(center.x, center.y, center.z)
      seeds.push(seed)
      directions.push(direction.x, direction.y, direction.z)
      forms.push(form)
    }
    if (raw !== source) raw.dispose()
    source.dispose()
  }

  const depthLanes = [-0.72, -0.48, -0.24, 0, 0.24, 0.48, 0.72] as const
  const radialLanes = [0.34, 0.39, 0.44, 0.49, 0.54, 0.59, 0.64, 0.69, 0.74, 0.79, 0.84] as const
  const splinters = Array.from({ length: 18 }, (_, index) => {
    const angle = index / 18 * Math.PI * 2 + (index % 3) * 0.08
    const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle) * 0.84, depthLanes[index % depthLanes.length]).normalize()
    const seed = index < 14 ? 0.04 + index * 0.044 : 0.74 + (index - 14) * 0.06
    return { direction, seed, length: 0.1 + (index % 4) * 0.018, radius: 0.045 + (index % 3) * 0.008 }
  })
  splinters.forEach((splinter, index) => {
    const center = new THREE.Vector3(0, 0.42, 0).addScaledVector(splinter.direction, radialLanes[(index * 7) % radialLanes.length]!)
    appendPrimitive(
      new THREE.IcosahedronGeometry(1, 0),
      center,
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), splinter.direction),
      new THREE.Vector3(splinter.radius, splinter.length, splinter.radius * 0.84),
      splinter.direction,
      splinter.seed,
      index % 3,
    )
  })

  const rawGeometry = new THREE.BufferGeometry()
  rawGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  rawGeometry.setAttribute('pfxShadowBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  rawGeometry.setAttribute('pfxShadowBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  rawGeometry.setAttribute('pfxShadowBurstDirection', new THREE.Float32BufferAttribute(directions, 3))
  rawGeometry.setAttribute('pfxShadowBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  const geometry = mergeVertices(rawGeometry, 1e-4)
  rawGeometry.dispose()
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  const width = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  const depth = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxShadowBurstSplinterDrawCalls'] = 1
  geometry.userData['pfxShadowBurstSplinterClosedFaces'] = true
  geometry.userData['pfxShadowBurstSplinterSmoothNormals'] = true
  geometry.userData['pfxShadowBurstSplinterBillboardCount'] = 0
  geometry.userData['pfxShadowBurstSplinterCount'] = splinters.length
  geometry.userData['pfxShadowBurstDepthLaneCount'] = depthLanes.length
  geometry.userData['pfxShadowBurstDefaultVisibleSplinterCount'] = 14
  geometry.userData['pfxShadowBurstMaximumVisibleSplinterCount'] = 18
  geometry.userData['pfxShadowBurstSplinterPrimitive'] = 'compact-faceted-shadow-mote'
  geometry.userData['pfxShadowBurstMoteRadialLaneCount'] = radialLanes.length
  geometry.userData['pfxShadowBurstCompleteRingCount'] = 0
  geometry.userData['pfxShadowBurstSplinterProfile'] = 'eighteen-compact-faceted-shadow-motes-radiating-through-seven-world-space-depth-lanes'
  geometry.userData['pfxShadowBurstSplinterTriangleCount'] = positions.length / 9
  geometry.userData['pfxShadowBurstSplinterWidthSpan'] = width
  geometry.userData['pfxShadowBurstSplinterDepthSpan'] = depth
  geometry.userData['pfxShadowBurstSplinterHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  geometry.userData['pfxShadowBurstSplinterPlanarBalance'] = Math.min(width, depth) / Math.max(width, depth)
  return geometry
}

export function createPfxShadowBurstSplinterMaterial(
  opacity: number,
  primaryColor = '#020106',
  secondaryColor = '#5b21b6',
  accentColor = '#ddd6fe',
  density = 0.58,
  styleEdgeHardness = 0.66,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uPrimaryColor: { value: new THREE.Color(primaryColor) },
      uSecondaryColor: { value: new THREE.Color(secondaryColor) },
      uAccentColor: { value: new THREE.Color(accentColor) },
      uDensity: { value: THREE.MathUtils.clamp(density, 0, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
    },
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      uniform float uDensity;
      attribute vec3 pfxShadowBurstCenter;
      attribute float pfxShadowBurstSeed;
      attribute vec3 pfxShadowBurstDirection;
      attribute float pfxShadowBurstForm;
      varying vec3 vSplinterNormal;
      varying vec3 vSplinterViewPosition;
      varying float vSplinterSeed;
      varying float vSplinterForm;
      varying float vSplinterLife;
      void main() {
        float radialDetonation = smoothstep(0.08 + pfxShadowBurstSeed * 0.018, 0.34 + pfxShadowBurstSeed * 0.024, uCycle);
        float splinterDisperse = smoothstep(0.4, 0.9, uCycle);
        float depthLaneSeparation = radialDetonation * (0.12 + abs(pfxShadowBurstDirection.z) * 0.22);
        vec3 origin = vec3(0.0, 0.42, 0.0);
        vec3 local = position - pfxShadowBurstCenter;
        local *= mix(0.1, 1.0, radialDetonation) * mix(1.0, 0.68, splinterDisperse);
        vec3 center = mix(origin, pfxShadowBurstCenter, radialDetonation);
        center += pfxShadowBurstDirection * (radialDetonation * (0.08 + pfxShadowBurstSeed * 0.12) + splinterDisperse * (0.22 + pfxShadowBurstSeed * 0.36));
        center.z += sign(pfxShadowBurstDirection.z) * depthLaneSeparation;
        center.y -= splinterDisperse * splinterDisperse * (0.08 + pfxShadowBurstSeed * 0.18);
        vec3 transformed = center + local;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vSplinterNormal = normalize(normalMatrix * normal);
        vSplinterViewPosition = viewPosition.xyz;
        vSplinterSeed = pfxShadowBurstSeed;
        vSplinterForm = pfxShadowBurstForm;
        float densityReveal = step(pfxShadowBurstSeed, 0.18 + uDensity * 0.82);
        float birth = smoothstep(0.055 + pfxShadowBurstSeed * 0.018, 0.15 + pfxShadowBurstSeed * 0.025, uCycle);
        float retirement = 1.0 - smoothstep(0.41 + pfxShadowBurstSeed * 0.018, 0.67, uCycle);
        vSplinterLife = densityReveal * birth * retirement;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uCycle;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform vec3 uAccentColor;
      uniform float uStyleEdgeHardness;
      varying vec3 vSplinterNormal;
      varying vec3 vSplinterViewPosition;
      varying float vSplinterSeed;
      varying float vSplinterForm;
      varying float vSplinterLife;
      void main() {
        vec3 normal = normalize(vSplinterNormal);
        vec3 viewDirection = normalize(-vSplinterViewPosition);
        float facing = max(0.0, dot(normal, viewDirection));
        float rim = pow(1.0 - facing, mix(2.0, 0.7, uStyleEdgeHardness));
        vec3 keyDirection = normalize(vec3(-0.5, 0.74, 0.46));
        vec3 fillDirection = normalize(vec3(0.72, -0.14, -0.68));
        float keyLight = max(0.0, dot(normal, keyDirection));
        float fillLight = max(0.0, dot(normal, fillDirection));
        float splinterVolume = 0.16 + keyLight * 0.25 + fillLight * 0.13 + facing * 0.05;
        float emissiveEdgeGradient = rim * (0.72 + 0.28 * sin(vSplinterSeed * 47.0 + vSplinterForm * 2.4 + uCycle * 17.0));
        float facetTier = fract(vSplinterForm * 0.37 + vSplinterSeed * 3.0);
        vec3 color = mix(uPrimaryColor * 1.08, uSecondaryColor * 0.72, splinterVolume + facetTier * 0.06);
        color += uSecondaryColor * emissiveEdgeGradient * 1.02;
        color += mix(uSecondaryColor, uAccentColor, 0.3) * pow(max(0.0, keyLight), 6.0) * 0.18;
        float alpha = uOpacity * vSplinterLife * (0.62 + facing * 0.2 + rim * 0.18);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.93));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxShadowBurstMaterial'] = true
  material.userData['pfxShadowBurstMaterialRole'] = 'void-splinters'
  material.userData['pfxShadowBurstMaterialProfile'] = 'faceted-violet-void-splinters-with-cold-emissive-edge-gradients'
  return material
}
