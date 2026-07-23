import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export function createPfxSlimeBurstCrownGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const forms: number[] = []
  const appendGeometry = (source: THREE.BufferGeometry, center: THREE.Vector3, seed: number, form: number) => {
    const nonIndexed = source.index ? source.toNonIndexed() : source
    const sourcePositions = nonIndexed.getAttribute('position')
    for (let vertex = 0; vertex < sourcePositions.count; vertex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(sourcePositions, vertex)
      positions.push(point.x, point.y, point.z)
      centers.push(center.x, center.y, center.z)
      seeds.push(seed)
      forms.push(form)
    }
    if (nonIndexed !== source) nonIndexed.dispose()
    source.dispose()
  }

  const core = new THREE.SphereGeometry(1, 14, 7)
  core.scale(0.86, 0.52, 0.74)
  core.translate(0, 0.18, 0)
  appendGeometry(core, new THREE.Vector3(0, 0.18, 0), 0.5, 0)

  const puddleLobeCount = 9
  for (let lobe = 0; lobe < puddleLobeCount; lobe += 1) {
    const seed = ((lobe * 29 + 11) % 97) / 97
    const angle = lobe / puddleLobeCount * Math.PI * 2 + (seed - 0.5) * 0.42
    const radius = 0.72 + (lobe % 3) * 0.15
    const center = new THREE.Vector3(Math.cos(angle) * radius * 1.14, 0.045 + (lobe % 3) * 0.025, Math.sin(angle) * radius)
    const lobeGeometry = new THREE.SphereGeometry(1, 12, 6)
    lobeGeometry.scale(0.48 + (lobe % 3) * 0.07, 0.14 + (lobe % 2) * 0.045, 0.36 + ((lobe + 1) % 3) * 0.065)
    lobeGeometry.rotateY(angle * 0.54)
    lobeGeometry.translate(center.x, center.y, center.z)
    appendGeometry(lobeGeometry, center, seed, 1)
  }

  const tentacleCount = 11
  const tentacleLengths = [1.42, 1.88, 1.58, 2.02, 1.35, 1.72, 1.5, 1.94, 1.63, 1.4, 1.8] as const
  for (let tentacle = 0; tentacle < tentacleCount; tentacle += 1) {
    const seed = ((tentacle * 43 + 7) % 103) / 103
    const angle = tentacle / tentacleCount * Math.PI * 2 + (seed - 0.5) * 0.48
    const direction = new THREE.Vector3(Math.cos(angle) * (0.42 + (tentacle % 4) * 0.1), 0.68 + ((tentacle * 3) % 5) * 0.09, Math.sin(angle) * (0.44 + ((tentacle + 2) % 4) * 0.09)).normalize()
    const base = new THREE.Vector3(Math.cos(angle) * 0.2, 0.08, Math.sin(angle) * 0.2)
    const length = tentacleLengths[tentacle]!
    const center = base.clone().addScaledVector(direction, length * 0.5)
    const tentacleGeometry = new THREE.ConeGeometry(0.105 + (tentacle % 4) * 0.015, length, 7, 3, false)
    tentacleGeometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction))
    tentacleGeometry.translate(center.x, center.y, center.z)
    appendGeometry(tentacleGeometry, center, seed, 2)

    const tip = base.clone().addScaledVector(direction, length)
    const tipGeometry = new THREE.SphereGeometry(1, 8, 5)
    const tipRadius = 0.046 + (tentacle % 3) * 0.007
    tipGeometry.scale(tipRadius, tipRadius * (2.35 + (tentacle % 2) * 0.3), tipRadius)
    tipGeometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction))
    tipGeometry.translate(tip.x, tip.y, tip.z)
    appendGeometry(tipGeometry, tip, seed, 3)
  }

  const rawGeometry = new THREE.BufferGeometry()
  rawGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  rawGeometry.setAttribute('pfxSlimeBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  rawGeometry.setAttribute('pfxSlimeBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  rawGeometry.setAttribute('pfxSlimeBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  const geometry = mergeVertices(rawGeometry, 1e-4)
  rawGeometry.dispose()
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxSlimeBurstCrownDrawCalls'] = 1
  geometry.userData['pfxSlimeBurstCrownClosedFaces'] = true
  geometry.userData['pfxSlimeBurstCrownWorldSpaceVolume'] = true
  geometry.userData['pfxSlimeBurstSmoothNormals'] = true
  geometry.userData['pfxSlimeBurstCrownBillboardCount'] = 0
  geometry.userData['pfxSlimeBurstCoreCount'] = 1
  geometry.userData['pfxSlimeBurstPuddleLobeCount'] = puddleLobeCount
  geometry.userData['pfxSlimeBurstTentacleCount'] = tentacleCount
  geometry.userData['pfxSlimeBurstTipBulbCount'] = tentacleCount
  geometry.userData['pfxSlimeBurstTipProfile'] = 'stretched-teardrop-not-round-bulb'
  geometry.userData['pfxSlimeBurstOnsetProfile'] = 'gel-bulge-before-eruption'
  geometry.userData['pfxSlimeBurstAsymmetricFootprint'] = true
  geometry.userData['pfxSlimeBurstTopology'] = 'filled-gel-core-puddle-lobes-tentacles-and-tip-bulbs'
  geometry.userData['pfxSlimeBurstAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxSlimeBurstCrownTriangleCount'] = positions.length / 9
  geometry.userData['pfxSlimeBurstCrownWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxSlimeBurstCrownDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxSlimeBurstCrownHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxSlimeBurstCrownMaterial(
  opacity: number,
  primaryColor = '#2c8f45',
  secondaryColor = '#b8ff75',
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
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      attribute vec3 pfxSlimeBurstCenter;
      attribute float pfxSlimeBurstSeed;
      attribute float pfxSlimeBurstForm;
      varying vec3 vSlimeNormal;
      varying vec3 vSlimeViewPosition;
      varying vec3 vSlimeLocalPosition;
      varying float vSlimeSeed;
      varying float vSlimeForm;
      varying float vSlimeLife;
      void main() {
        float elasticRebound = smoothstep(0.045 + pfxSlimeBurstSeed * 0.01, 0.29 + pfxSlimeBurstSeed * 0.025, uCycle);
        float preBurstBulge = 1.0 - elasticRebound;
        float viscousSettle = smoothstep(0.43, 0.8, uCycle);
        float splatCompression = 1.0 - smoothstep(0.02, 0.2, uCycle);
        vec3 local = position - pfxSlimeBurstCenter;
        float tallForm = step(1.5, pfxSlimeBurstForm);
        float coreForm = 1.0 - step(0.5, pfxSlimeBurstForm);
        float puddleForm = step(0.5, pfxSlimeBurstForm) * (1.0 - step(1.5, pfxSlimeBurstForm));
        float onsetVertical = coreForm * 1.42 + puddleForm * 0.72 + tallForm * (0.28 + pfxSlimeBurstSeed * 0.06);
        float onsetRadial = coreForm * 0.88 + puddleForm * (1.08 + splatCompression * 0.05) + tallForm * 0.5;
        local.y *= mix(onsetVertical, 1.0, elasticRebound);
        local.xz *= mix(onsetRadial, 1.0, elasticRebound);
        local.xz *= 1.0 + sin(uCycle * 17.0 + pfxSlimeBurstSeed * 21.0) * 0.035 * tallForm;
        float onsetCenterScale = coreForm * 0.95 + puddleForm * 0.9 + tallForm * 0.38;
        vec3 center = pfxSlimeBurstCenter * mix(onsetCenterScale, 1.0, elasticRebound);
        center.y += preBurstBulge * (1.0 - tallForm) * 0.06;
        center.y -= viscousSettle * viscousSettle * mix(0.08, 0.58 + pfxSlimeBurstSeed * 0.26, tallForm);
        center.xz *= 1.0 + viscousSettle * (pfxSlimeBurstSeed - 0.5) * 0.08;
        vec3 transformed = center + local;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vSlimeNormal = normalize(normalMatrix * normal);
        vSlimeViewPosition = viewPosition.xyz;
        vSlimeLocalPosition = local;
        vSlimeSeed = pfxSlimeBurstSeed;
        vSlimeForm = pfxSlimeBurstForm;
        float rapidGelRetire = 1.0 - smoothstep(0.44 + pfxSlimeBurstSeed * 0.014, 0.57 + pfxSlimeBurstSeed * 0.02, uCycle);
        float residueRetire = 1.0 - smoothstep(0.58 + pfxSlimeBurstSeed * 0.012, 0.73 + pfxSlimeBurstSeed * 0.024, uCycle);
        float authoredReveal = mix(coreForm * 0.9 + puddleForm * 0.38 + tallForm * 0.08, 1.0, elasticRebound);
        vSlimeLife = (0.78 + elasticRebound * 0.22) * mix(residueRetire, rapidGelRetire, tallForm) * authoredReveal;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      varying vec3 vSlimeNormal;
      varying vec3 vSlimeViewPosition;
      varying vec3 vSlimeLocalPosition;
      varying float vSlimeSeed;
      varying float vSlimeForm;
      varying float vSlimeLife;
      void main() {
        vec3 normal = normalize(vSlimeNormal);
        vec3 viewDirection = normalize(-vSlimeViewPosition);
        float facing = abs(dot(normal, viewDirection));
        float gelThickness = pow(max(facing, 0.02), mix(0.65, 1.4, uStyleEdgeHardness));
        float wetRim = pow(1.0 - facing, mix(1.8, 3.8, uStyleEdgeHardness));
        float transmissionGlow = pow(max(facing, 0.02), 0.58);
        float thinEdgeCaustic = pow(1.0 - facing, 2.35);
        float surfaceRipple = 0.5 + 0.5 * sin(vSlimeLocalPosition.y * 11.0 + vSlimeLocalPosition.x * 8.0 + vSlimeSeed * 17.0);
        vec3 subsurfaceLime = mix(uPrimaryColor * 0.72, uSecondaryColor, 0.38 + gelThickness * 0.3);
        float tonalLayerSeparation = smoothstep(1.0, 2.0, vSlimeForm);
        float viscousDepthTone = mix(0.54, 1.0, tonalLayerSeparation);
        vec3 formTone = mix(uPrimaryColor * 0.58, mix(uPrimaryColor, uSecondaryColor, 0.56), tonalLayerSeparation);
        vec3 gelColor = mix(formTone, subsurfaceLime, 0.34 + gelThickness * 0.34);
        gelColor = mix(gelColor, uSecondaryColor * 1.08, wetRim * (0.38 + uDensity * 0.28));
        gelColor += uSecondaryColor * pow(max(0.0, dot(normal, normalize(vec3(0.28, 0.9, 0.32)))), 4.5) * 0.42;
        gelColor += mix(uSecondaryColor, vec3(0.82, 1.0, 0.58), 0.36) * thinEdgeCaustic * 0.34;
        gelColor += uPrimaryColor * transmissionGlow * 0.08;
        gelColor *= viscousDepthTone * (0.9 + surfaceRipple * 0.16 + (vSlimeForm > 2.5 ? 0.12 : 0.0));
        float alpha = uOpacity * vSlimeLife * (0.72 + gelThickness * 0.18 + wetRim * 0.12);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(gelColor, clamp(alpha, 0.0, 0.94));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxSlimeBurstMaterial'] = true
  material.userData['pfxSlimeBurstMaterialRole'] = 'crown'
  material.userData['pfxSlimeBurstControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxSlimeBurstMaterialProfile'] = 'translucent-gel-crown-with-wet-rim'
  return material
}
