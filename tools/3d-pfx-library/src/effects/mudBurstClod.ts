import * as THREE from 'three'
import { createPfxMudBurstClodDescriptors } from './mudBurstClodDescriptors'
import type { PfxMudBurstClodDescriptor } from '../types/02'

export function createPfxMudBurstClodGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const directions: number[] = []
  const forms: number[] = []
  const shells: number[] = []
  const descriptors = createPfxMudBurstClodDescriptors()
  const appendGeometry = (source: THREE.BufferGeometry, descriptor: PfxMudBurstClodDescriptor, localScale: THREE.Vector3, localOffset = new THREE.Vector3()) => {
    const nonIndexed = source.index ? source.toNonIndexed() : source
    const sourcePositions = nonIndexed.getAttribute('position')
    for (let vertex = 0; vertex < sourcePositions.count; vertex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(sourcePositions, vertex).multiply(localScale).applyQuaternion(descriptor.rotation).add(localOffset).add(descriptor.center)
      positions.push(point.x, point.y, point.z)
      centers.push(descriptor.center.x, descriptor.center.y, descriptor.center.z)
      seeds.push(descriptor.seed)
      directions.push(descriptor.direction.x, descriptor.direction.y, descriptor.direction.z)
      forms.push(descriptor.form)
      shells.push(descriptor.shell)
    }
    if (nonIndexed !== source) nonIndexed.dispose()
    source.dispose()
  }
  for (const descriptor of descriptors) {
    // Strong per-seed anisotropic stretch so no two clods share a silhouette.
    const stretchX = 0.62 + descriptor.seed * 0.98
    const stretchY = 0.58 + ((descriptor.seed * 7.3) % 1) * 0.9
    const stretchZ = 0.6 + ((descriptor.seed * 13.1) % 1) * 0.94
    appendGeometry(new THREE.DodecahedronGeometry(1, 0), descriptor, new THREE.Vector3(descriptor.size * 1.08 * stretchX, descriptor.size * (0.82 + descriptor.form * 0.08) * stretchY, descriptor.size * 0.94 * stretchZ))
  }
  const dropletCount = 12
  for (let droplet = 0; droplet < dropletCount; droplet += 1) {
    const descriptor = descriptors[droplet + 4]!
    const dropletGeometry = new THREE.IcosahedronGeometry(1, 1)
    const size = 0.045 + (droplet % 4) * 0.008
    appendGeometry(dropletGeometry, { ...descriptor, form: 3 }, new THREE.Vector3(size, size * (1.9 + (droplet % 3) * 0.18), size), descriptor.direction.clone().multiplyScalar(0.16))
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('pfxMudBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  geometry.setAttribute('pfxMudBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxMudBurstDirection', new THREE.Float32BufferAttribute(directions, 3))
  geometry.setAttribute('pfxMudBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxMudBurstShell', new THREE.Float32BufferAttribute(shells, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxMudBurstClodDrawCalls'] = 1
  geometry.userData['pfxMudBurstClodClosedFaces'] = true
  geometry.userData['pfxMudBurstClodCount'] = descriptors.length
  geometry.userData['pfxMudBurstDropletCount'] = dropletCount
  geometry.userData['pfxMudBurstRadialShellCount'] = 3
  geometry.userData['pfxMudBurstAngularSectorCount'] = 8
  geometry.userData['pfxMudBurstDepthLayerCount'] = 12
  geometry.userData['pfxMudBurstClodBillboardCount'] = 0
  geometry.userData['pfxMudBurstClodTopology'] = 'closed-faceted-clods-and-capsule-droplets'
  geometry.userData['pfxMudBurstClodTriangleCount'] = positions.length / 9
  return geometry
}

export function createPfxMudBurstClodMaterial(
  opacity: number,
  primaryColor = '#2a170c',
  secondaryColor = '#6f4526',
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
      attribute vec3 pfxMudBurstCenter;
      attribute float pfxMudBurstSeed;
      attribute vec3 pfxMudBurstDirection;
      attribute float pfxMudBurstForm;
      attribute float pfxMudBurstShell;
      varying vec3 vClodNormal;
      varying vec3 vClodViewPosition;
      varying float vClodSeed;
      varying float vClodForm;
      varying float vClodLife;
      void main() {
        float release = smoothstep(0.045 + pfxMudBurstSeed * 0.014, 0.28 + pfxMudBurstSeed * 0.024, uCycle);
        float ballisticLift = smoothstep(0.06, 0.3, uCycle) * (1.0 - smoothstep(0.68, 0.84, uCycle));
        float gravitySettle = smoothstep(0.42, 0.82, uCycle);
        float shellReveal = pfxMudBurstShell < 0.5 ? 1.0 : smoothstep(pfxMudBurstShell * 0.05 - 0.01, pfxMudBurstShell * 0.05 + 0.05, uCycle);
        vec3 local = position - pfxMudBurstCenter;
        float tumble = gravitySettle * (0.34 + pfxMudBurstSeed * 0.72);
        mat2 rotation = mat2(cos(tumble), -sin(tumble), sin(tumble), cos(tumble));
        local.xy = rotation * local.xy;
        local.yz = mat2(cos(tumble * 0.46), -sin(tumble * 0.46), sin(tumble * 0.46), cos(tumble * 0.46)) * local.yz;
        vec3 center = pfxMudBurstCenter * mix(0.62, 1.0, release);
        center += pfxMudBurstDirection * ballisticLift * (0.12 + pfxMudBurstShell * 0.16);
        center.y += ballisticLift * (0.28 + pfxMudBurstSeed * 0.54);
        center.y -= gravitySettle * gravitySettle * (0.52 + pfxMudBurstSeed * 0.86);
        center.x += (pfxMudBurstSeed - 0.5) * gravitySettle * 0.28;
        center.z += sin(pfxMudBurstSeed * 18.0) * gravitySettle * 0.16;
        vec3 transformed = center + local * mix(0.84, 1.0, release);
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vec3 rotatedNormal = normal;
        rotatedNormal.xy = rotation * rotatedNormal.xy;
        vClodNormal = normalize(normalMatrix * rotatedNormal);
        vClodViewPosition = viewPosition.xyz;
        vClodSeed = pfxMudBurstSeed;
        vClodForm = pfxMudBurstForm;
        float retire = 1.0 - smoothstep(0.56 + pfxMudBurstSeed * 0.035, 0.85 + pfxMudBurstSeed * 0.06, uCycle);
        vClodLife = (0.7 + release * 0.3) * retire * shellReveal;
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
      varying vec3 vClodNormal;
      varying vec3 vClodViewPosition;
      varying float vClodSeed;
      varying float vClodForm;
      varying float vClodLife;
      void main() {
        vec3 normal = normalize(vClodNormal);
        // Facet-hardened normals so the low-poly clods read as tumbling 3D
        // rocks instead of flat matte discs.
        vec3 clodHardFacet = normalize(cross(dFdx(vClodViewPosition), dFdy(vClodViewPosition)));
        if (dot(clodHardFacet, normal) < 0.0) clodHardFacet *= -1.0;
        normal = normalize(mix(normal, clodHardFacet, 0.78));
        vec3 viewDirection = normalize(-vClodViewPosition);
        float facing = abs(dot(normal, viewDirection));
        float clodFacetLight = max(0.0, dot(normal, normalize(vec3(0.3, 0.9, 0.34))));
        float clodWetSpec = pow(max(0.0, dot(normal, normalize(viewDirection + normalize(vec3(0.3, 0.9, 0.34))))), 22.0);
        float clodValueVariance = 0.62 + vClodSeed * 0.76;
        float wetDropletGlint = vClodForm > 2.5 ? pow(1.0 - facing, mix(1.1, 2.4, uStyleEdgeHardness)) + 0.42 : 0.0;
        vec3 clodPigment = vClodForm < 0.5 ? vec3(0.18, 0.105, 0.05) : vClodForm < 1.5 ? vec3(0.26, 0.155, 0.072) : vec3(0.33, 0.2, 0.095);
        vec3 controlledClodColor = mix(uPrimaryColor * 0.74, uSecondaryColor, clodFacetLight * 0.34 + wetDropletGlint * 0.2);
        controlledClodColor = mix(controlledClodColor, clodPigment, 0.44 + vClodSeed * 0.08);
        controlledClodColor *= 0.98 + facing * 0.2 + clodFacetLight * 0.3;
        controlledClodColor *= clodValueVariance;
        controlledClodColor += mix(uSecondaryColor, vec3(0.85, 0.9, 0.95), 0.7) * clodWetSpec * mix(0.7, 1.2, uDensity);
        controlledClodColor += mix(uSecondaryColor, vec3(0.6, 0.68, 0.76), 0.52) * (wetDropletGlint * 0.52 + pow(1.0 - facing, 1.5) * 0.12);
        float settleReadability = smoothstep(0.44, 0.58, uCycle) * (1.0 - smoothstep(0.7, 0.8, uCycle));
        controlledClodColor = mix(controlledClodColor, clodPigment * 1.1, settleReadability * 0.42);
        controlledClodColor *= 1.0 + settleReadability * 0.2;
        float alpha = uOpacity * vClodLife * (0.72 + facing * 0.26 + wetDropletGlint * 0.18 + settleReadability * 0.24);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(controlledClodColor, clamp(alpha, 0.0, 0.94));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxMudBurstMaterial'] = true
  material.userData['pfxMudBurstMaterialRole'] = 'clods'
  material.userData['pfxMudBurstControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxMudBurstMaterialProfile'] = 'wet-faceted-clods-and-capsule-droplets'
  return material
}
