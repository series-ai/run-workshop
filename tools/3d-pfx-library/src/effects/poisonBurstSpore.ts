import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createPfxPoisonBurstSporeDescriptors } from './poisonBurstSporeDescriptors'
import type { PfxPoisonBurstSporeDescriptor } from '../types/02'

export function createPfxPoisonBurstSporeGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const directions: number[] = []
  const forms: number[] = []
  const descriptors = createPfxPoisonBurstSporeDescriptors()
  const appendGeometry = (source: THREE.BufferGeometry, descriptor: PfxPoisonBurstSporeDescriptor, scale: THREE.Vector3, offset = new THREE.Vector3()) => {
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
    const width = 0.82 + descriptor.form * 0.14
    const height = 1.38 - descriptor.form * 0.18
    const depth = 0.92 + ((descriptor.form + 1) % 3) * 0.14
    appendGeometry(new THREE.IcosahedronGeometry(1, 1), descriptor, new THREE.Vector3(descriptor.size * width, descriptor.size * height, descriptor.size * depth))
  }
  const needleCount = 12
  for (let needle = 0; needle < needleCount; needle += 1) {
    const descriptor = descriptors[(needle * 7 + 3) % descriptors.length]!
    const size = 0.034 + (needle % 4) * 0.008
    appendGeometry(new THREE.IcosahedronGeometry(1, 1), { ...descriptor, form: 4 }, new THREE.Vector3(size, size * (2.8 + (needle % 3) * 0.42), size), descriptor.direction.clone().multiplyScalar(0.22))
  }
  const rawGeometry = new THREE.BufferGeometry()
  rawGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  rawGeometry.setAttribute('pfxPoisonBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  rawGeometry.setAttribute('pfxPoisonBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  rawGeometry.setAttribute('pfxPoisonBurstDirection', new THREE.Float32BufferAttribute(directions, 3))
  rawGeometry.setAttribute('pfxPoisonBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  const geometry = mergeVertices(rawGeometry, 1e-4)
  rawGeometry.dispose()
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxPoisonBurstSporeDrawCalls'] = 1
  geometry.userData['pfxPoisonBurstSporeClosedFaces'] = true
  geometry.userData['pfxPoisonBurstSporeSmoothNormals'] = true
  geometry.userData['pfxPoisonBurstSporeCount'] = descriptors.length
  geometry.userData['pfxPoisonBurstNeedleCount'] = needleCount
  geometry.userData['pfxPoisonBurstSporeDepthLayerCount'] = 12
  geometry.userData['pfxPoisonBurstSporeBillboardCount'] = 0
  geometry.userData['pfxPoisonBurstSporeTopology'] = 'closed-faceted-pods-and-stretched-toxin-needles'
  geometry.userData['pfxPoisonBurstSporeAspectProfile'] = 'four-organic-pod-species'
  geometry.userData['pfxPoisonBurstSporeTriangleCount'] = positions.length / 9
  return geometry
}

export function createPfxPoisonBurstSporeMaterial(
  opacity: number,
  primaryColor = '#6b2a8e',
  secondaryColor = '#9cff57',
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
      attribute vec3 pfxPoisonBurstCenter;
      attribute float pfxPoisonBurstSeed;
      attribute vec3 pfxPoisonBurstDirection;
      attribute float pfxPoisonBurstForm;
      varying vec3 vSporeNormal;
      varying vec3 vSporeViewPosition;
      varying float vSporeSeed;
      varying float vSporeForm;
      varying float vSporeLife;
      void main() {
        float sporeExpulsion = smoothstep(0.06 + pfxPoisonBurstSeed * 0.012, 0.29 + pfxPoisonBurstSeed * 0.025, uCycle);
        float toxicFalloff = smoothstep(0.44, 0.82, uCycle);
        float depthScatterAmplifier = 1.45;
        vec3 local = position - pfxPoisonBurstCenter;
        float tumble = toxicFalloff * (0.3 + pfxPoisonBurstSeed * 0.75);
        mat2 rotation = mat2(cos(tumble), -sin(tumble), sin(tumble), cos(tumble));
        local.xz = rotation * local.xz;
        vec3 center = pfxPoisonBurstCenter * mix(0.32, 1.0, sporeExpulsion);
        center.z *= mix(1.0, depthScatterAmplifier, sporeExpulsion);
        center += pfxPoisonBurstDirection * sporeExpulsion * (0.18 + pfxPoisonBurstSeed * 0.28);
        center.y += sporeExpulsion * (0.22 + pfxPoisonBurstSeed * 0.46);
        center.y -= toxicFalloff * toxicFalloff * (0.24 + pfxPoisonBurstSeed * 1.18);
        center.y += sin(pfxPoisonBurstSeed * 37.0) * toxicFalloff * 0.22;
        center.xz += vec2(sin(pfxPoisonBurstSeed * 29.0), cos(pfxPoisonBurstSeed * 31.0)) * toxicFalloff * 0.16;
        vec3 transformed = center + local;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vSporeNormal = normalize(normalMatrix * normal);
        vSporeViewPosition = viewPosition.xyz;
        vSporeSeed = pfxPoisonBurstSeed;
        vSporeForm = pfxPoisonBurstForm;
        float retire = 1.0 - smoothstep(0.54 + pfxPoisonBurstSeed * 0.03, 0.73 + pfxPoisonBurstSeed * 0.065, uCycle);
        vSporeLife = sporeExpulsion * retire;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      varying vec3 vSporeNormal;
      varying vec3 vSporeViewPosition;
      varying float vSporeSeed;
      varying float vSporeForm;
      varying float vSporeLife;
      void main() {
        vec3 normal = normalize(vSporeNormal);
        vec3 viewDirection = normalize(-vSporeViewPosition);
        float facing = abs(dot(normal, viewDirection));
        float sporePoreBands = 0.5 + 0.5 * sin(vSporeSeed * 33.0 + facing * 12.0);
        float toxinNeedleGlint = pow(max(0.0, dot(normal, normalize(vec3(-0.26, 0.9, 0.34)))), mix(3.0, 6.0, uStyleEdgeHardness));
        vec3 sporeColor = mix(uPrimaryColor * 0.82, uSecondaryColor, 0.46 + facing * 0.24 + sporePoreBands * 0.12);
        sporeColor += uSecondaryColor * toxinNeedleGlint * (0.32 + uDensity * 0.38);
        sporeColor *= vSporeForm > 3.5 ? 1.18 : 0.86 + facing * 0.26;
        float alpha = uOpacity * vSporeLife * (0.68 + facing * 0.22 + toxinNeedleGlint * 0.16);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(sporeColor, clamp(alpha, 0.0, 0.94));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxPoisonBurstMaterial'] = true
  material.userData['pfxPoisonBurstMaterialRole'] = 'spores'
  material.userData['pfxPoisonBurstControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxPoisonBurstMaterialProfile'] = 'faceted-spore-pods-and-toxin-needles'
  return material
}
