import * as THREE from 'three'
import { createPfxPetalBurstDescriptors } from './petalBurstDescriptors'

export function createPfxPetalBurstCanopyGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const directions: number[] = []
  const forms: number[] = []
  const shells: number[] = []
  const descriptors = createPfxPetalBurstDescriptors()
  const outlines = [
    [[-0.64, 0], [-0.4, 0.24], [-0.02, 0.48], [0.42, 0.56], [0.72, 0.25], [0.55, 0], [0.72, -0.25], [0.42, -0.56], [-0.02, -0.48], [-0.4, -0.24]],
    [[-0.66, 0], [-0.42, 0.2], [-0.08, 0.43], [0.34, 0.5], [0.68, 0.28], [0.78, 0], [0.68, -0.28], [0.34, -0.5], [-0.08, -0.43], [-0.42, -0.2]],
    [[-0.64, 0], [-0.5, 0.18], [-0.3, 0.34], [-0.04, 0.42], [0.22, 0.54], [0.48, 0.49], [0.68, 0.34], [0.78, 0.14], [0.72, 0], [0.78, -0.14], [0.68, -0.34], [0.48, -0.49], [0.22, -0.54], [-0.04, -0.42], [-0.3, -0.34], [-0.5, -0.18]],
  ] as const
  let active = descriptors[0]!
  const pushTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, shade: number) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    const palettes = [[1, 0.42, 0.64], [1, 0.7, 0.8], [0.98, 0.5, 0.7]] as const
    const palette = palettes[active.form]!
    for (let vertex = 0; vertex < 3; vertex += 1) {
      colors.push(palette[0] * shade, palette[1] * shade, palette[2] * shade)
      centers.push(active.center.x, active.center.y, active.center.z)
      seeds.push(active.seed)
      directions.push(active.direction.x, active.direction.y, active.direction.z)
      forms.push(active.form)
      shells.push(active.shell)
    }
  }
  const transform = (point: THREE.Vector3) => point.applyQuaternion(active.rotation).add(active.center)
  for (const descriptor of descriptors) {
    active = descriptor
    const outline = outlines[active.form]!
    const depth = active.size * (0.13 + active.form * 0.01)
    const top = outline.map(([x, y]) => {
      const crown = 0.4 + (1 - Math.min(1, Math.abs(y) / 0.56)) * 0.34 + (1 - Math.min(1, Math.abs(x) / 0.78)) * 0.22
      return transform(new THREE.Vector3(x * active.size * 1.3, y * active.size, depth * crown))
    })
    const bottom = outline.map(([x, y]) => transform(new THREE.Vector3(x * active.size * 1.3, y * active.size, -depth * 0.66)))
    const topCenter = transform(new THREE.Vector3(0.02 * active.size, 0, depth * 1.48))
    const bottomCenter = transform(new THREE.Vector3(0.02 * active.size, 0, -depth * 0.78))
    for (let edge = 0; edge < outline.length; edge += 1) {
      const next = (edge + 1) % outline.length
      pushTriangle(topCenter, top[edge]!, top[next]!, 0.92 + active.form * 0.04)
      pushTriangle(bottomCenter, bottom[next]!, bottom[edge]!, 0.7 + active.form * 0.04)
      pushTriangle(top[edge]!, bottom[edge]!, bottom[next]!, 0.74 + (edge % 3) * 0.06)
      pushTriangle(top[edge]!, bottom[next]!, top[next]!, 0.8 + (edge % 2) * 0.08)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('pfxPetalBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  geometry.setAttribute('pfxPetalBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxPetalBurstDirection', new THREE.Float32BufferAttribute(directions, 3))
  geometry.setAttribute('pfxPetalBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxPetalBurstShell', new THREE.Float32BufferAttribute(shells, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxPetalBurstDrawCalls'] = 1
  geometry.userData['pfxPetalBurstClosedFaces'] = true
  geometry.userData['pfxPetalBurstWorldSpaceVolume'] = true
  geometry.userData['pfxPetalBurstBillboardCount'] = 0
  geometry.userData['pfxPetalBurstPetalCount'] = descriptors.length
  geometry.userData['pfxPetalBurstSpeciesCount'] = 3
  geometry.userData['pfxPetalBurstSpeciesProfile'] = 'heart-teardrop-ruffled'
  geometry.userData['pfxPetalBurstRadialShellCount'] = 5
  geometry.userData['pfxPetalBurstAngularSectorCount'] = 8
  geometry.userData['pfxPetalBurstDepthLayerCount'] = 12
  geometry.userData['pfxPetalBurstCrownedMidrib'] = true
  geometry.userData['pfxPetalBurstRoundedProfiles'] = true
  geometry.userData['pfxPetalBurstMinimumDepthRatio'] = 0.13
  geometry.userData['pfxPetalBurstTopology'] = 'closed-sculpted-curved-petal-prisms'
  geometry.userData['pfxPetalBurstAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxPetalBurstTriangleCount'] = positions.length / 9
  geometry.userData['pfxPetalBurstWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxPetalBurstDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxPetalBurstHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxPetalBurstCanopyMaterial(
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
    vertexColors: true,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      attribute vec3 pfxPetalBurstCenter;
      attribute float pfxPetalBurstSeed;
      attribute vec3 pfxPetalBurstDirection;
      attribute float pfxPetalBurstForm;
      attribute float pfxPetalBurstShell;
      varying vec3 vPetalColor;
      varying vec3 vPetalNormal;
      varying vec3 vPetalViewPosition;
      varying vec3 vPetalLocalPosition;
      varying float vPetalSeed;
      varying float vPetalForm;
      varying float vPetalLife;
      void main() {
        float bloomRelease = smoothstep(0.045 + pfxPetalBurstSeed * 0.018, 0.27 + pfxPetalBurstSeed * 0.022, uCycle);
        float foldedBud = 1.0 - smoothstep(0.04, 0.25, uCycle);
        float multiShellAnticipation = pfxPetalBurstShell < 0.5 ? 1.0 : pfxPetalBurstShell < 1.5 ? mix(0.62, 1.0, smoothstep(0.02, 0.14, uCycle)) : pfxPetalBurstShell < 2.5 ? mix(0.24, 1.0, smoothstep(0.055, 0.18, uCycle)) : smoothstep(pfxPetalBurstShell * 0.038 - 0.012, pfxPetalBurstShell * 0.038 + 0.04, uCycle);
        float anticipationShellReveal = multiShellAnticipation;
        float sustainedBloomEnvelope = smoothstep(0.06, 0.34, uCycle) * (1.0 - smoothstep(0.7, 0.84, uCycle));
        float flutterFall = smoothstep(0.38, 0.8, uCycle);
        vec3 local = position - pfxPetalBurstCenter;
        float flutterAngle = (flutterFall * (0.38 + pfxPetalBurstSeed * 0.92) + bloomRelease * pfxPetalBurstSeed * 0.26) * mix(1.0, 0.34, smoothstep(0.54, 0.8, uCycle));
        mat2 flutterRotation = mat2(cos(flutterAngle), -sin(flutterAngle), sin(flutterAngle), cos(flutterAngle));
        local.xy = flutterRotation * local.xy;
        local.yz = mat2(cos(flutterAngle * 0.42), -sin(flutterAngle * 0.42), sin(flutterAngle * 0.42), cos(flutterAngle * 0.42)) * local.yz;
        vec3 center = pfxPetalBurstCenter * mix(0.82, 1.0, bloomRelease);
        center += pfxPetalBurstDirection * sustainedBloomEnvelope * (0.08 + pfxPetalBurstShell * 0.115);
        center.y -= flutterFall * flutterFall * (0.32 + pfxPetalBurstSeed * 0.76);
        center.x += (pfxPetalBurstSeed - 0.5) * flutterFall * 0.38 + sin(pfxPetalBurstSeed * 17.0) * flutterFall * 0.1;
        center.z += cos(pfxPetalBurstSeed * 14.0) * flutterFall * 0.2;
        vec3 transformed = center + local * mix(0.72, 1.0, bloomRelease);
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vec3 rotatedNormal = normal;
        rotatedNormal.xy = flutterRotation * rotatedNormal.xy;
        vPetalColor = color;
        vPetalNormal = normalize(normalMatrix * rotatedNormal);
        vPetalViewPosition = viewPosition.xyz;
        vPetalLocalPosition = local;
        vPetalSeed = pfxPetalBurstSeed;
        vPetalForm = pfxPetalBurstForm;
        float staggeredPetalRetire = 1.0 - smoothstep(0.48 + pfxPetalBurstSeed * 0.045, 0.7 + pfxPetalBurstSeed * 0.085, uCycle);
        vPetalLife = (0.74 + bloomRelease * 0.26) * staggeredPetalRetire * anticipationShellReveal;
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
      varying vec3 vPetalColor;
      varying vec3 vPetalNormal;
      varying vec3 vPetalViewPosition;
      varying vec3 vPetalLocalPosition;
      varying float vPetalSeed;
      varying float vPetalForm;
      varying float vPetalLife;
      void main() {
        vec3 normal = normalize(vPetalNormal);
        vec3 viewDirection = normalize(-vPetalViewPosition);
        float facing = abs(dot(normal, viewDirection));
        float satinPetalSheen = pow(max(0.0, dot(normal, normalize(vec3(0.3, 0.9, 0.28)))), mix(2.2, 5.2, uStyleEdgeHardness));
        float petalFiber = 0.5 + 0.5 * sin(vPetalLocalPosition.x * 23.0 + vPetalLocalPosition.y * 9.0 + vPetalSeed * 19.0);
        float subsurfaceBlush = pow(1.0 - facing, 1.18) * (0.2 + petalFiber * 0.15);
        vec3 speciesPigment = vPetalForm < 0.5 ? vec3(1.0, 0.38, 0.62) : vPetalForm < 1.5 ? vec3(1.0, 0.68, 0.8) : vec3(0.98, 0.46, 0.7);
        vec3 controlledPetalColor = mix(uPrimaryColor * 0.72, uSecondaryColor, facing * 0.34 + satinPetalSheen * 0.32);
        controlledPetalColor = mix(controlledPetalColor, speciesPigment, 0.4 + vPetalSeed * 0.08);
        controlledPetalColor = mix(controlledPetalColor, vPetalColor * 1.46, 0.3);
        controlledPetalColor *= 1.2 + facing * 0.24;
        controlledPetalColor += uSecondaryColor * satinPetalSheen * mix(0.22, 0.42, uDensity);
        controlledPetalColor += mix(uPrimaryColor, uSecondaryColor, petalFiber) * subsurfaceBlush;
        float petalRim = pow(1.0 - facing, 1.45) * 0.32;
        controlledPetalColor += uSecondaryColor * petalRim;
        float budGlow = 1.0 - smoothstep(0.0, 0.17, uCycle);
        float decayReadabilityHold = smoothstep(0.44, 0.58, uCycle) * (1.0 - smoothstep(0.7, 0.82, uCycle));
        float persistentPetalPigment = smoothstep(0.42, 0.62, uCycle);
        vec3 warmDecayPigment = mix(vec3(1.55, 0.08, 0.32), vec3(1.35, 0.48, 0.28), petalFiber * 0.28 + facing * 0.14);
        vec3 budCorollaTint = mix(uPrimaryColor * 1.5, uSecondaryColor, 0.28 + facing * 0.12);
        controlledPetalColor = mix(controlledPetalColor, budCorollaTint, budGlow * 0.74);
        controlledPetalColor = mix(controlledPetalColor, speciesPigment * 1.54, persistentPetalPigment * 0.66);
        controlledPetalColor = mix(controlledPetalColor, warmDecayPigment, decayReadabilityHold * 0.76);
        controlledPetalColor *= 1.18 + budGlow * 0.72 + decayReadabilityHold * 0.86 + persistentPetalPigment * 0.38;
        float alpha = uOpacity * vPetalLife * (0.82 + facing * 0.18 + budGlow * 0.52 + decayReadabilityHold * 0.42) * mix(1.0, 2.5, decayReadabilityHold);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(controlledPetalColor, clamp(alpha, 0.0, 0.96));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxPetalBurstMaterial'] = true
  material.userData['pfxPetalBurstMaterialRole'] = 'corolla'
  material.userData['pfxPetalBurstControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxPetalBurstMaterialProfile'] = 'satin-translucent-persistent-pigment-corolla'
  return material
}
