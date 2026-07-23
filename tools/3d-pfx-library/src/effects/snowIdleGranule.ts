import * as THREE from 'three'

export function createPfxSnowIdleGranuleGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const colors: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const layers: number[] = []
  const forms: number[] = []
  const granuleCount = 48
  const faces = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]] as const
  for (let granule = 0; granule < granuleCount; granule += 1) {
    const seed = ((granule * 37 + (granule % 7) * 11 + 5) % 97) / 97
    const center = new THREE.Vector3(
      -1.85 + ((granule * 11) % granuleCount) / (granuleCount - 1) * 3.7,
      -0.72 + ((granule * 17) % granuleCount) / (granuleCount - 1) * 3.5,
      -1.55 + ((granule * 19) % granuleCount) / (granuleCount - 1) * 3.1,
    )
    const layer = THREE.MathUtils.clamp((center.z + 1.55) / 3.1, 0, 1)
    const radius = 0.014 + (granule % 4) * 0.004
    const points = [
      new THREE.Vector3(radius, 0, 0), new THREE.Vector3(-radius, 0, 0),
      new THREE.Vector3(0, radius * 0.78, 0), new THREE.Vector3(0, -radius * 0.78, 0),
      new THREE.Vector3(0, 0, radius), new THREE.Vector3(0, 0, -radius),
    ].map((point) => point.add(center))
    for (const [a, b, c] of faces) {
      const shade = 0.74 + ((a + b + c + granule) % 4) * 0.075
      const triangle = [points[a]!, points[b]!, points[c]!]
      const faceNormal = new THREE.Vector3()
        .subVectors(points[b]!, points[a]!)
        .cross(new THREE.Vector3().subVectors(points[c]!, points[a]!))
        .normalize()
      for (const point of triangle) {
        positions.push(point.x, point.y, point.z)
        normals.push(faceNormal.x, faceNormal.y, faceNormal.z)
        colors.push(shade * 0.72, shade * 0.9, shade)
        centers.push(center.x, center.y, center.z)
        seeds.push(seed)
        layers.push(layer)
        forms.push(0)
      }
    }
  }
  const hazeLobes = [
    { center: new THREE.Vector3(-0.78, 0.96, -0.62), scale: new THREE.Vector3(1.22, 1.42, 0.82) },
    { center: new THREE.Vector3(0.68, 1.34, 0.42), scale: new THREE.Vector3(1.12, 1.24, 0.92) },
    { center: new THREE.Vector3(0.08, 0.32, -0.18), scale: new THREE.Vector3(1.42, 0.88, 1.02) },
  ] as const
  for (const [lobeIndex, lobe] of hazeLobes.entries()) {
    const source = new THREE.IcosahedronGeometry(1, 1)
    const nonIndexed = source.index ? source.toNonIndexed() : source
    const sourcePositions = nonIndexed.getAttribute('position')
    const sourceNormals = nonIndexed.getAttribute('normal')
    for (let vertex = 0; vertex < sourcePositions.count; vertex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(sourcePositions, vertex)
        .multiply(lobe.scale)
        .add(lobe.center)
      positions.push(point.x, point.y, point.z)
      const smoothNormal = new THREE.Vector3().fromBufferAttribute(sourceNormals, vertex)
      smoothNormal.set(
        smoothNormal.x / lobe.scale.x,
        smoothNormal.y / lobe.scale.y,
        smoothNormal.z / lobe.scale.z,
      ).normalize()
      normals.push(smoothNormal.x, smoothNormal.y, smoothNormal.z)
      colors.push(0.34, 0.64, 0.78)
      centers.push(lobe.center.x, lobe.center.y, lobe.center.z)
      seeds.push(0.18 + lobeIndex * 0.29)
      layers.push(0.28 + lobeIndex * 0.31)
      forms.push(1)
    }
    if (nonIndexed !== source) nonIndexed.dispose()
    source.dispose()
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('pfxSnowCenter', new THREE.Float32BufferAttribute(centers, 3))
  geometry.setAttribute('pfxSnowSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxSnowLayer', new THREE.Float32BufferAttribute(layers, 1))
  geometry.setAttribute('pfxSnowForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxSnowIdleGranuleDrawCalls'] = 1
  geometry.userData['pfxSnowIdleGranuleClosedFaces'] = true
  geometry.userData['pfxSnowIdleGranuleCount'] = granuleCount
  geometry.userData['pfxSnowIdleHazeLobeCount'] = hazeLobes.length
  geometry.userData['pfxSnowIdleHazeClosedFaces'] = true
  geometry.userData['pfxSnowIdleHazeSmoothNormals'] = true
  geometry.userData['pfxSnowIdleGranuleTrailCorrelation'] = 0
  geometry.userData['pfxSnowIdleGranuleBillboardCount'] = 0
  geometry.userData['pfxSnowIdleGranuleWorldSpaceVolume'] = true
  geometry.userData['pfxSnowIdleGranuleTriangleCount'] = positions.length / 9
  geometry.userData['pfxSnowIdleGranuleWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxSnowIdleGranuleDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxSnowIdleGranuleHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxSnowIdleGranuleMaterial(
  opacity: number,
  primaryColor = '#edfaff',
  secondaryColor = '#bfeeff',
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
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      attribute vec3 pfxSnowCenter;
      attribute float pfxSnowSeed;
      attribute float pfxSnowLayer;
      attribute float pfxSnowForm;
      varying vec3 vGranuleColor;
      varying vec3 vGranuleNormal;
      varying vec3 vGranuleViewPosition;
      varying float vGranuleSeed;
      varying float vGranuleLayer;
      varying float vGranuleForm;
      varying vec3 vGranulePosition;
      void main() {
        vec3 local = position - pfxSnowCenter;
        float fallProgress = fract(pfxSnowSeed + uCycle * (0.48 + pfxSnowLayer * 0.2));
        float spin = uCycle * 9.4247779 + pfxSnowSeed * 23.0;
        mat2 rotation = mat2(cos(spin), -sin(spin), sin(spin), cos(spin));
        local.xz = rotation * local.xz;
        vec3 center = pfxSnowCenter;
        vec3 transformed;
        if (pfxSnowForm > 0.5) {
          float hazeBreath = sin(uCycle * 6.2831853 + pfxSnowSeed * 11.0) * 0.018;
          center.x += sin(uCycle * 6.2831853 + pfxSnowSeed * 7.0) * 0.045;
          transformed = center + local * (1.0 + hazeBreath);
        } else {
          center.y = mix(2.62, -0.78, fallProgress);
          center.x += sin(fallProgress * 7.1 + pfxSnowSeed * 29.0) * (0.08 + pfxSnowLayer * 0.09);
          center.z += cos(fallProgress * 5.3 + pfxSnowSeed * 17.0) * 0.055;
          transformed = center + local * (0.72 + pfxSnowLayer * 0.46);
        }
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vGranuleColor = color;
        vGranuleNormal = normalize(normalMatrix * normal);
        vGranuleViewPosition = viewPosition.xyz;
        vGranuleSeed = pfxSnowSeed;
        vGranuleLayer = pfxSnowLayer;
        vGranuleForm = pfxSnowForm;
        vGranulePosition = transformed;
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
      varying vec3 vGranuleColor;
      varying vec3 vGranuleNormal;
      varying vec3 vGranuleViewPosition;
      varying float vGranuleSeed;
      varying float vGranuleLayer;
      varying float vGranuleForm;
      varying vec3 vGranulePosition;
      void main() {
        vec3 normal = normalize(vGranuleNormal);
        vec3 viewDirection = normalize(-vGranuleViewPosition);
        float facing = abs(dot(normal, viewDirection));
        float softDepth = 0.5 + vGranuleLayer * 0.42;
        float hazeNoise = 0.5 + 0.5 * sin(dot(vGranulePosition, vec3(2.7, 3.9, 3.3)) + uCycle * 6.2831853 + vGranuleSeed * 13.0);
        float hazeEdgeFade = smoothstep(0.08, 0.78, facing);
        float volumetricHaze = hazeEdgeFade * (0.58 + hazeNoise * 0.42);
        if (vGranuleForm > 0.5) {
          vec3 controlledHazeColor = mix(uSecondaryColor * 0.34, uSecondaryColor * 0.72, hazeNoise * 0.42 + facing * 0.18);
          gl_FragColor = vec4(controlledHazeColor, uOpacity * volumetricHaze * mix(0.075, 0.105, uDensity));
          return;
        }
        float granuleGlint = pow(max(0.0, sin(uCycle * 12.5663706 + vGranuleSeed * 41.0)), 12.0);
        float facet = 0.52 + 0.48 * abs(dot(normal, normalize(vec3(0.36, 0.86, 0.36))));
        vec3 ice = mix(uSecondaryColor, uPrimaryColor, facet);
        ice += uSecondaryColor * granuleGlint * mix(0.16, 0.28, uStyleEdgeHardness);
        gl_FragColor = vec4(ice * (0.94 + vGranuleColor.b * 0.06), uOpacity * softDepth * (0.62 + facing * 0.28) * mix(0.86, 1.0, uDensity));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxSnowIdleMaterial'] = 'closed-faceted-depth-granules'
  material.userData['pfxSnowIdleHazeOpacityFloor'] = 0.075
  material.userData['pfxSnowIdleControlBinding'] = 'primary-secondary-density-style'
  return material
}
