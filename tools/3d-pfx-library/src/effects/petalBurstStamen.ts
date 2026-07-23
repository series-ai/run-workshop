import * as THREE from 'three'

export function createPfxPetalBurstStamenGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const forms: number[] = []
  const shells: number[] = []
  const appendGeometry = (source: THREE.BufferGeometry, center: THREE.Vector3, seed: number, form: number, shell: number) => {
    const nonIndexed = source.index ? source.toNonIndexed() : source
    const sourcePositions = nonIndexed.getAttribute('position')
    for (let vertex = 0; vertex < sourcePositions.count; vertex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(sourcePositions, vertex)
      positions.push(point.x, point.y, point.z)
      centers.push(center.x, center.y, center.z)
      seeds.push(seed)
      forms.push(form)
      shells.push(shell)
    }
    if (nonIndexed !== source) nonIndexed.dispose()
    source.dispose()
  }
  const stamenCount = 16
  const pathStationCount = 5
  for (let stamen = 0; stamen < stamenCount; stamen += 1) {
    const seed = ((stamen * 29 + 7) % 97) / 97
    const angle = stamen / stamenCount * Math.PI * 2 + (stamen % 3) * 0.16
    const elevation = -0.28 + (stamen % 5) * 0.14
    const direction = new THREE.Vector3(Math.cos(angle), elevation, Math.sin(angle)).normalize()
    const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle))
    const end = direction.clone().multiplyScalar(0.44 + (stamen % 4) * 0.045)
    const curve = new THREE.CatmullRomCurve3([
      direction.clone().multiplyScalar(0.05),
      direction.clone().multiplyScalar(0.17).add(tangent.clone().multiplyScalar((seed - 0.5) * 0.08)).add(new THREE.Vector3(0, 0.06, 0)),
      direction.clone().multiplyScalar(0.31).add(tangent.clone().multiplyScalar((seed - 0.5) * 0.12)).add(new THREE.Vector3(0, 0.1, 0)),
      end,
    ])
    appendGeometry(new THREE.TubeGeometry(curve, pathStationCount - 1, 0.022 + (stamen % 3) * 0.002, 5, false), new THREE.Vector3(), seed, 0, stamen % 3)
    const pollen = new THREE.IcosahedronGeometry(0.046 + (stamen % 3) * 0.006, 0)
    pollen.translate(end.x, end.y, end.z)
    appendGeometry(pollen, new THREE.Vector3(), seed, 1, stamen % 3)
  }
  const calyx = new THREE.DodecahedronGeometry(0.19, 0)
  calyx.scale(1, 0.84, 1)
  appendGeometry(calyx, new THREE.Vector3(), 0.5, 2, 0)
  const sepalCount = 5
  for (let sepalIndex = 0; sepalIndex < sepalCount; sepalIndex += 1) {
    const angle = sepalIndex / sepalCount * Math.PI * 2
    const sepal = new THREE.ConeGeometry(0.075, 0.3, 5, 1, false)
    sepal.rotateZ(-Math.PI / 2)
    sepal.rotateY(angle)
    sepal.translate(Math.cos(angle) * 0.12, -0.045, Math.sin(angle) * 0.12)
    appendGeometry(sepal, new THREE.Vector3(), 0.2 + sepalIndex * 0.13, 3, 0)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('pfxPetalBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  geometry.setAttribute('pfxPetalBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxPetalBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxPetalBurstShell', new THREE.Float32BufferAttribute(shells, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxPetalBurstStamenDrawCalls'] = 1
  geometry.userData['pfxPetalBurstStamenClosedFaces'] = true
  geometry.userData['pfxPetalBurstStamenCount'] = stamenCount
  geometry.userData['pfxPetalBurstStamenPathStationCount'] = pathStationCount
  geometry.userData['pfxPetalBurstPollenCount'] = stamenCount
  geometry.userData['pfxPetalBurstCalyxCoreCount'] = 1
  geometry.userData['pfxPetalBurstSepalCount'] = sepalCount
  geometry.userData['pfxPetalBurstStamenMinimumRadius'] = 0.022
  geometry.userData['pfxPetalBurstStamenBillboardCount'] = 0
  geometry.userData['pfxPetalBurstStamenTopology'] = 'closed-curved-filaments-pollen-and-calyx'
  geometry.userData['pfxPetalBurstStamenTriangleCount'] = positions.length / 9
  return geometry
}

export function createPfxPetalBurstStamenMaterial(
  opacity: number,
  primaryColor = '#f48fb1',
  secondaryColor = '#ffe4d6',
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
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      attribute vec3 pfxPetalBurstCenter;
      attribute float pfxPetalBurstSeed;
      attribute float pfxPetalBurstForm;
      attribute float pfxPetalBurstShell;
      varying vec3 vStamenNormal;
      varying vec3 vStamenViewPosition;
      varying float vStamenSeed;
      varying float vStamenForm;
      varying float vStamenLife;
      void main() {
        float bloomRelease = smoothstep(0.045 + pfxPetalBurstSeed * 0.018, 0.27 + pfxPetalBurstSeed * 0.022, uCycle);
        float shellReveal = pfxPetalBurstShell < 0.5 ? 1.0 : pfxPetalBurstShell < 1.5 ? mix(0.42, 1.0, smoothstep(0.025, 0.14, uCycle)) : smoothstep(pfxPetalBurstShell * 0.045 - 0.01, pfxPetalBurstShell * 0.045 + 0.04, uCycle);
        float flutterFall = smoothstep(0.4, 0.8, uCycle);
        vec3 local = position - pfxPetalBurstCenter;
        float angle = flutterFall * (0.28 + pfxPetalBurstSeed * 0.64);
        mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        local.xy = rotation * local.xy;
        local.yz = mat2(cos(angle * 0.34), -sin(angle * 0.34), sin(angle * 0.34), cos(angle * 0.34)) * local.yz;
        vec3 center = pfxPetalBurstCenter;
        center.y -= flutterFall * flutterFall * (0.2 + pfxPetalBurstSeed * 0.38);
        vec3 transformed = center + local * mix(pfxPetalBurstForm > 1.5 ? 0.78 : 0.64, 1.0, bloomRelease);
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vec3 rotatedNormal = normal;
        rotatedNormal.xy = rotation * rotatedNormal.xy;
        vStamenNormal = normalize(normalMatrix * rotatedNormal);
        vStamenViewPosition = viewPosition.xyz;
        vStamenSeed = pfxPetalBurstSeed;
        vStamenForm = pfxPetalBurstForm;
        float stamenRetireBeforeDecay = 1.0 - smoothstep(0.39 + pfxPetalBurstSeed * 0.03, 0.55 + pfxPetalBurstSeed * 0.05, uCycle);
        vStamenLife = (0.68 + bloomRelease * 0.32) * stamenRetireBeforeDecay * shellReveal;
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
      varying vec3 vStamenNormal;
      varying vec3 vStamenViewPosition;
      varying float vStamenSeed;
      varying float vStamenForm;
      varying float vStamenLife;
      void main() {
        vec3 normal = normalize(vStamenNormal);
        vec3 viewDirection = normalize(-vStamenViewPosition);
        float facing = abs(dot(normal, viewDirection));
        float stamenSapGlow = 0.64 + facing * 0.28 + pow(max(0.0, dot(normal, normalize(vec3(-0.3, 0.88, 0.38)))), 2.0) * 0.3;
        float pollenGlint = vStamenForm > 0.5 && vStamenForm < 1.5 ? pow(1.0 - facing, mix(1.1, 2.2, uStyleEdgeHardness)) + 0.4 : 0.0;
        float calyxBloomGlow = vStamenForm > 1.5 ? smoothstep(0.05, 0.18, uCycle) * (1.0 - smoothstep(0.54, 0.7, uCycle)) : 0.0;
        float calyxBudGlow = vStamenForm > 1.5 ? 1.0 - smoothstep(0.0, 0.2, uCycle) : 0.0;
        vec3 roseGoldFilament = mix(vec3(1.0, 0.38, 0.46), vec3(1.0, 0.72, 0.28), 0.42 + vStamenSeed * 0.2);
        vec3 controlledStamenColor = mix(roseGoldFilament, uSecondaryColor, 0.34 + pollenGlint * 0.2);
        controlledStamenColor *= stamenSapGlow + pollenGlint * 0.62 + calyxBloomGlow * 1.1 + calyxBudGlow * 1.32 + mix(0.0, 0.18, uDensity);
        controlledStamenColor += roseGoldFilament * (pollenGlint * 0.52 + calyxBloomGlow * 0.62 + calyxBudGlow * 0.72);
        float filamentAttenuation = vStamenForm < 0.5 ? 0.62 : 1.0;
        float alpha = uOpacity * vStamenLife * (0.52 + facing * 0.3 + pollenGlint * 0.18 + calyxBloomGlow * 0.28 + calyxBudGlow * 0.34) * filamentAttenuation;
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(controlledStamenColor, clamp(alpha, 0.0, 0.88));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxPetalBurstMaterial'] = true
  material.userData['pfxPetalBurstMaterialRole'] = 'stamens'
  material.userData['pfxPetalBurstControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxPetalBurstMaterialProfile'] = 'additive-curved-stamens-pollen-and-calyx'
  return material
}
