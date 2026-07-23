import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export function createPfxShadowBurstFragmentGeometry(): THREE.BufferGeometry {
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
  const depthLanes = [-0.72, -0.43, -0.14, 0.14, 0.43, 0.72] as const
  const fragments = [
    { center: new THREE.Vector3(-0.78, 0.53, 0.4), direction: new THREE.Vector3(-0.92, 0.2, 0.28).normalize(), seed: 0.04 },
    { center: new THREE.Vector3(-0.36, 1.46, -0.32), direction: new THREE.Vector3(-0.3, 0.94, -0.24).normalize(), seed: 0.16 },
    { center: new THREE.Vector3(0.05, 1.61, -0.1), direction: new THREE.Vector3(0.03, 1, -0.08).normalize(), seed: 0.28 },
    { center: new THREE.Vector3(0.31, 1.48, 0.15), direction: new THREE.Vector3(0.3, 0.94, 0.12).normalize(), seed: 0.4 },
    { center: new THREE.Vector3(0.59, 1.2, 0.34), direction: new THREE.Vector3(0.72, 0.66, 0.24).normalize(), seed: 0.52 },
    { center: new THREE.Vector3(0, 0.04, -0.44), direction: new THREE.Vector3(0, -0.9, -0.32).normalize(), seed: 0.64 },
  ] as const
  let fragmentSegmentCount = 0
  fragments.forEach((fragment, index) => {
    const direction = fragment.direction.clone()
    const reference = Math.abs(direction.y) < 0.88 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
    const curl = new THREE.Vector3().crossVectors(direction, reference).normalize().multiplyScalar(index % 2 === 0 ? 1 : -1)
    const path = [
      fragment.center.clone(),
      fragment.center.clone().addScaledVector(direction, 0.08),
      fragment.center.clone().addScaledVector(direction, 0.17).addScaledVector(curl, 0.035),
      fragment.center.clone().addScaledVector(direction, 0.25).addScaledVector(curl, 0.09),
    ]
    const radii = [0.046, 0.038, 0.023, 0.006]
    const radialSegments = 5
    const centroid = path.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / path.length)
    const rings = path.map((point, pathIndex) => {
      const tangent = pathIndex === 0
        ? new THREE.Vector3().subVectors(path[1]!, point).normalize()
        : pathIndex === path.length - 1
        ? new THREE.Vector3().subVectors(point, path[pathIndex - 1]!).normalize()
        : new THREE.Vector3().subVectors(path[pathIndex + 1]!, path[pathIndex - 1]!).normalize()
      const ringReference = Math.abs(tangent.z) < 0.86 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)
      const normalA = new THREE.Vector3().crossVectors(tangent, ringReference).normalize()
      const normalB = new THREE.Vector3().crossVectors(tangent, normalA).normalize()
      return Array.from({ length: radialSegments }, (_, radialIndex) => {
        const angle = radialIndex / radialSegments * Math.PI * 2
        return point.clone()
          .addScaledVector(normalA, Math.cos(angle) * radii[pathIndex]!)
          .addScaledVector(normalB, Math.sin(angle) * radii[pathIndex]!)
          .sub(centroid)
      })
    })
    const tendrilPositions: number[] = []
    const appendTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => tendrilPositions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
      for (let radialIndex = 0; radialIndex < radialSegments; radialIndex += 1) {
        const nextRadialIndex = (radialIndex + 1) % radialSegments
        appendTriangle(rings[ringIndex]![radialIndex]!, rings[ringIndex + 1]![radialIndex]!, rings[ringIndex + 1]![nextRadialIndex]!)
        appendTriangle(rings[ringIndex]![radialIndex]!, rings[ringIndex + 1]![nextRadialIndex]!, rings[ringIndex]![nextRadialIndex]!)
      }
    }
    const localStart = path[0]!.clone().sub(centroid)
    const localEnd = path.at(-1)!.clone().sub(centroid)
    for (let radialIndex = 0; radialIndex < radialSegments; radialIndex += 1) {
      const nextRadialIndex = (radialIndex + 1) % radialSegments
      appendTriangle(localStart, rings[0]![nextRadialIndex]!, rings[0]![radialIndex]!)
      appendTriangle(localEnd, rings.at(-1)![radialIndex]!, rings.at(-1)![nextRadialIndex]!)
    }
    const source = new THREE.BufferGeometry()
    source.setAttribute('position', new THREE.Float32BufferAttribute(tendrilPositions, 3))
    appendPrimitive(source, centroid, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1), direction, fragment.seed, index % 3)
    fragmentSegmentCount += path.length - 1
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
  geometry.userData['pfxShadowBurstFragmentDrawCalls'] = 1
  geometry.userData['pfxShadowBurstFragmentClosedFaces'] = true
  geometry.userData['pfxShadowBurstFragmentSmoothNormals'] = true
  geometry.userData['pfxShadowBurstFragmentBillboardCount'] = 0
  geometry.userData['pfxShadowBurstFragmentCount'] = fragments.length
  geometry.userData['pfxShadowBurstFragmentDepthLaneCount'] = depthLanes.length
  geometry.userData['pfxShadowBurstDefaultVisibleFragmentCount'] = 5
  geometry.userData['pfxShadowBurstMaximumVisibleFragmentCount'] = 6
  geometry.userData['pfxShadowBurstFragmentSourceCount'] = fragments.length
  geometry.userData['pfxShadowBurstFragmentSegmentCount'] = fragmentSegmentCount
  geometry.userData['pfxShadowBurstFragmentPrimitive'] = 'continuous-closed-five-sided-curved-shadow-tendril'
  geometry.userData['pfxShadowBurstCompleteRingCount'] = 0
  geometry.userData['pfxShadowBurstFragmentProfile'] = 'six-continuous-curved-shadow-tendrils-peeling-from-five-claw-tips-and-the-palm-through-six-world-space-depth-lanes'
  geometry.userData['pfxShadowBurstFragmentTriangleCount'] = positions.length / 9
  geometry.userData['pfxShadowBurstFragmentWidthSpan'] = width
  geometry.userData['pfxShadowBurstFragmentDepthSpan'] = depth
  geometry.userData['pfxShadowBurstFragmentHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  geometry.userData['pfxShadowBurstFragmentPlanarBalance'] = Math.min(width, depth) / Math.max(width, depth)
  return geometry
}

export function createPfxShadowBurstFragmentMaterial(
  opacity: number,
  primaryColor = '#101018',
  secondaryColor = '#4a4560',
  accentColor = '#b6c2d8',
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
    depthTest: false,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      uniform float uDensity;
      attribute vec3 pfxShadowBurstCenter;
      attribute float pfxShadowBurstSeed;
      attribute vec3 pfxShadowBurstDirection;
      attribute float pfxShadowBurstForm;
      varying vec3 vFragmentNormal;
      varying vec3 vFragmentViewPosition;
      varying float vFragmentSeed;
      varying float vFragmentForm;
      varying float vFragmentLife;
      void main() {
        float fragmentDetonation = smoothstep(0.025 + pfxShadowBurstSeed * 0.012, 0.3 + pfxShadowBurstSeed * 0.02, uCycle);
        float fragmentDisperse = smoothstep(0.34, 0.68, uCycle);
        float sweptWristTrail = fragmentDetonation * (0.03 + pfxShadowBurstSeed * 0.07);
        float decayWispCarry = fragmentDisperse * (0.26 + pfxShadowBurstSeed * 0.36);
        float radialDissolutionCarry = fragmentDisperse * fragmentDisperse * (0.22 + pfxShadowBurstSeed * 0.28);
        float depthLaneScatter = fragmentDetonation * (0.12 + abs(pfxShadowBurstDirection.z) * 0.24);
        vec3 origin = vec3(0.0, 0.42, 0.0);
        vec3 local = position - pfxShadowBurstCenter;
        local *= mix(0.12, 1.0, fragmentDetonation) * mix(1.0, 0.64, fragmentDisperse);
        vec3 center = mix(origin, pfxShadowBurstCenter, fragmentDetonation);
        center += pfxShadowBurstDirection * (sweptWristTrail + decayWispCarry + radialDissolutionCarry);
        center.z += sign(pfxShadowBurstDirection.z) * depthLaneScatter;
        center.y -= fragmentDisperse * fragmentDisperse * (0.09 + pfxShadowBurstSeed * 0.18);
        vec3 transformed = center + local;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vFragmentNormal = normalize(normalMatrix * normal);
        vFragmentViewPosition = viewPosition.xyz;
        vFragmentSeed = pfxShadowBurstSeed;
        vFragmentForm = pfxShadowBurstForm;
        float densityReveal = step(pfxShadowBurstSeed, 0.18 + uDensity * 0.82);
        float birth = smoothstep(0.01 + pfxShadowBurstSeed * 0.008, 0.09 + pfxShadowBurstSeed * 0.016, uCycle);
        float retirement = 1.0 - smoothstep(0.5 + pfxShadowBurstSeed * 0.018, 0.84, uCycle);
        vFragmentLife = densityReveal * birth * retirement;
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
      varying vec3 vFragmentNormal;
      varying vec3 vFragmentViewPosition;
      varying float vFragmentSeed;
      varying float vFragmentForm;
      varying float vFragmentLife;
      void main() {
        vec3 normal = normalize(vFragmentNormal);
        vec3 viewDirection = normalize(-vFragmentViewPosition);
        float facing = max(0.0, dot(normal, viewDirection));
        float rim = pow(1.0 - facing, mix(2.0, 0.7, uStyleEdgeHardness));
        vec3 keyDirection = normalize(vec3(-0.48, 0.76, 0.44));
        vec3 fillDirection = normalize(vec3(0.7, -0.12, -0.7));
        float keyLight = max(0.0, dot(normal, keyDirection));
        float fillLight = max(0.0, dot(normal, fillDirection));
        float facetedVoidVolume = 0.22 + keyLight * 0.34 + fillLight * 0.19 + facing * 0.07;
        float fragmentEdgeEmission = rim * (0.74 + 0.26 * sin(vFragmentSeed * 47.0 + vFragmentForm * 2.7 + uCycle * 16.0));
        float wispFalloff = 0.18 + facing * 0.24 + rim * 0.18;
        float recoveryWispGlow = smoothstep(0.38, 0.55, uCycle) * (1.0 - smoothstep(0.7, 0.82, uCycle));
        float decayTendrilEmission = smoothstep(0.34, 0.48, uCycle) * (1.0 - smoothstep(0.78, 0.88, uCycle));
        float solidWispCore = 0.34 + facing * 0.34 + keyLight * 0.2 + fillLight * 0.12;
        float taperedWispGradient = 0.58 + keyLight * 0.24 + rim * 0.18;
        vec3 color = mix(uPrimaryColor * 4.5, uSecondaryColor * 2.9, clamp(0.22 + solidWispCore * 0.62 + facetedVoidVolume * wispFalloff * 0.22, 0.0, 1.0));
        color += uSecondaryColor * fragmentEdgeEmission * 0.9;
        color += uAccentColor * fragmentEdgeEmission * (0.22 + recoveryWispGlow * 0.46) * taperedWispGradient;
        color += mix(uSecondaryColor, uAccentColor, 0.62) * decayTendrilEmission * (0.28 + rim * 0.44);
        color += mix(uSecondaryColor, uAccentColor, 0.34) * pow(max(0.0, keyLight), 5.0) * 0.28;
        vec3 finalShadowPlane = vec3(0.8, 0.82, 0.92);
        color = min(color, finalShadowPlane);
        float alpha = uOpacity * vFragmentLife * (0.9 + facing * 0.08 + rim * 0.06);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.94));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxShadowBurstMaterial'] = true
  material.userData['pfxShadowBurstMaterialRole'] = 'void-fragments'
  material.userData['pfxShadowBurstMaterialProfile'] = 'faceted-near-black-void-fragments-with-cold-slate-edge-emission-and-a-hard-value-ceiling'
  return material
}
