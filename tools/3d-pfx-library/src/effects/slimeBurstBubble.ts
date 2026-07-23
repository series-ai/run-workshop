import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createPfxSlimeBurstBubbleDescriptors } from './slimeBurstBubbleDescriptors'
import type { PfxSlimeBurstBubbleDescriptor } from '../types/02'

export function createPfxSlimeBurstBubbleGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const directions: number[] = []
  const forms: number[] = []
  const descriptors = createPfxSlimeBurstBubbleDescriptors()
  const appendGeometry = (source: THREE.BufferGeometry, descriptor: PfxSlimeBurstBubbleDescriptor, scale: THREE.Vector3, offset = new THREE.Vector3()) => {
    const nonIndexed = source.index ? source.toNonIndexed() : source
    const sourcePositions = nonIndexed.getAttribute('position')
    for (let vertex = 0; vertex < sourcePositions.count; vertex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(sourcePositions, vertex).multiply(scale).applyQuaternion(descriptor.rotation).add(offset).add(descriptor.center)
      positions.push(point.x, point.y, point.z)
      centers.push(descriptor.center.x, descriptor.center.y, descriptor.center.z)
      seeds.push(descriptor.seed)
      directions.push(descriptor.direction.x, descriptor.direction.y, descriptor.direction.z)
      forms.push(descriptor.form)
    }
    if (nonIndexed !== source) nonIndexed.dispose()
    source.dispose()
  }
  for (const descriptor of descriptors) {
    const wobble = 0.88 + descriptor.form * 0.09
    appendGeometry(new THREE.SphereGeometry(1, 9, 6), descriptor, new THREE.Vector3(descriptor.size * 1.08, descriptor.size * wobble, descriptor.size * (1.16 - descriptor.form * 0.05)))
  }
  const dropletCount = 12
  for (let droplet = 0; droplet < dropletCount; droplet += 1) {
    const descriptor = descriptors[(droplet * 5 + 2) % descriptors.length]!
    const size = 0.05 + (droplet % 4) * 0.009
    appendGeometry(new THREE.IcosahedronGeometry(1, 1), { ...descriptor, form: 3 }, new THREE.Vector3(size, size * (2.1 + (droplet % 3) * 0.3), size), descriptor.direction.clone().multiplyScalar(0.2))
  }
  const rawGeometry = new THREE.BufferGeometry()
  rawGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  rawGeometry.setAttribute('pfxSlimeBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  rawGeometry.setAttribute('pfxSlimeBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  rawGeometry.setAttribute('pfxSlimeBurstDirection', new THREE.Float32BufferAttribute(directions, 3))
  rawGeometry.setAttribute('pfxSlimeBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  const geometry = mergeVertices(rawGeometry, 1e-4)
  rawGeometry.dispose()
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxSlimeBurstBubbleDrawCalls'] = 1
  geometry.userData['pfxSlimeBurstBubbleClosedFaces'] = true
  geometry.userData['pfxSlimeBurstBubbleSmoothNormals'] = true
  geometry.userData['pfxSlimeBurstBubbleCount'] = descriptors.length
  geometry.userData['pfxSlimeBurstDropletCount'] = dropletCount
  geometry.userData['pfxSlimeBurstBubbleSizeRange'] = [0.075, 0.225]
  geometry.userData['pfxSlimeBurstDepthLayerCount'] = 9
  geometry.userData['pfxSlimeBurstBubbleBillboardCount'] = 0
  geometry.userData['pfxSlimeBurstBubbleTopology'] = 'closed-wobble-bubbles-and-stretched-droplets'
  geometry.userData['pfxSlimeBurstBubbleTriangleCount'] = positions.length / 9
  return geometry
}

export function createPfxSlimeBurstBubbleMaterial(
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
      attribute vec3 pfxSlimeBurstDirection;
      attribute float pfxSlimeBurstForm;
      varying vec3 vBubbleNormal;
      varying vec3 vBubbleViewPosition;
      varying float vBubbleSeed;
      varying float vBubbleForm;
      varying float vBubbleLife;
      void main() {
        float bubbleRelease = smoothstep(0.05 + pfxSlimeBurstSeed * 0.012, 0.29 + pfxSlimeBurstSeed * 0.025, uCycle);
        float stringSnapback = smoothstep(0.42, 0.8, uCycle);
        float gravityReturn = stringSnapback * stringSnapback;
        vec3 local = position - pfxSlimeBurstCenter;
        float wobble = sin(uCycle * 18.0 + pfxSlimeBurstSeed * 24.0) * (0.025 + pfxSlimeBurstForm * 0.007);
        local.x *= 1.0 + wobble;
        local.y *= 1.0 - wobble * 0.72;
        vec3 center = pfxSlimeBurstCenter * mix(0.48, 1.0, bubbleRelease);
        center += pfxSlimeBurstDirection * bubbleRelease * (0.12 + pfxSlimeBurstSeed * 0.16);
        center.y += bubbleRelease * (0.2 + pfxSlimeBurstSeed * 0.34);
        center.y -= gravityReturn * (0.92 + pfxSlimeBurstSeed * 1.28);
        center.x += sin(pfxSlimeBurstSeed * 31.0) * stringSnapback * 0.14;
        center.z += cos(pfxSlimeBurstSeed * 27.0) * stringSnapback * 0.12;
        vec3 transformed = center + local;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vBubbleNormal = normalize(normalMatrix * normal);
        vBubbleViewPosition = viewPosition.xyz;
        vBubbleSeed = pfxSlimeBurstSeed;
        vBubbleForm = pfxSlimeBurstForm;
        float retire = 1.0 - smoothstep(0.54 + pfxSlimeBurstSeed * 0.035, 0.72 + pfxSlimeBurstSeed * 0.07, uCycle);
        vBubbleLife = bubbleRelease * retire;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      varying vec3 vBubbleNormal;
      varying vec3 vBubbleViewPosition;
      varying float vBubbleSeed;
      varying float vBubbleForm;
      varying float vBubbleLife;
      void main() {
        vec3 normal = normalize(vBubbleNormal);
        vec3 viewDirection = normalize(-vBubbleViewPosition);
        float facing = abs(dot(normal, viewDirection));
        float bubbleFresnel = pow(1.0 - facing, mix(1.3, 3.2, uStyleEdgeHardness));
        float hollowGelCenter = mix(0.42, 0.58, facing);
        float internalGelHighlight = pow(max(0.0, dot(normal, normalize(vec3(-0.36, 0.84, 0.4)))), 5.0);
        float cellVariation = 0.78 + 0.22 * sin(vBubbleSeed * 28.0 + vBubbleForm * 2.4);
        vec3 bubbleColor = mix(uPrimaryColor * 0.92, uSecondaryColor * 1.08, 0.4 + bubbleFresnel * 0.36);
        bubbleColor += uSecondaryColor * internalGelHighlight * (0.42 + uDensity * 0.34);
        bubbleColor *= cellVariation + bubbleFresnel * 0.18;
        float alpha = uOpacity * vBubbleLife * (hollowGelCenter + bubbleFresnel * 0.68 + internalGelHighlight * 0.18);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(bubbleColor, clamp(alpha, 0.0, 0.9));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxSlimeBurstMaterial'] = true
  material.userData['pfxSlimeBurstMaterialRole'] = 'bubbles'
  material.userData['pfxSlimeBurstControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxSlimeBurstMaterialProfile'] = 'translucent-bubbles-and-stretched-droplets'
  return material
}
