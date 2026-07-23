import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createPfxAcidBurstDropletDescriptors } from './acidBurstDropletDescriptors'
import type { PfxAcidBurstDropletDescriptor } from '../types/02'

export function createPfxAcidBurstDropletGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const directions: number[] = []
  const forms: number[] = []
  const descriptors = createPfxAcidBurstDropletDescriptors()
  const appendGeometry = (source: THREE.BufferGeometry, descriptor: PfxAcidBurstDropletDescriptor, scale: THREE.Vector3, offset = new THREE.Vector3()) => {
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
    appendGeometry(new THREE.IcosahedronGeometry(1, 1), descriptor, new THREE.Vector3(descriptor.size * 0.96, descriptor.size * (1.12 + descriptor.form * 0.055), descriptor.size))
  }
  const midZoneDropletCount = 6
  for (let index = 0; index < midZoneDropletCount; index += 1) {
    const source = descriptors[(index * 5 + 2) % descriptors.length]!
    const descriptor = {
      ...source,
      center: new THREE.Vector3(source.center.x * 0.72, 0.36 + (index % 3) * 0.12, source.center.z * 0.72),
      seed: 0.08 + index * 0.13,
      form: index % 4,
    }
    const size = 0.13 + (index % 2) * 0.025
    appendGeometry(new THREE.IcosahedronGeometry(1, 0), descriptor, new THREE.Vector3(size, size * 1.18, size))
  }
  const needleCount = 10
  for (let needle = 0; needle < needleCount; needle += 1) {
    const descriptor = descriptors[(needle * 9 + 4) % descriptors.length]!
    const size = 0.028 + (needle % 4) * 0.007
    appendGeometry(new THREE.IcosahedronGeometry(1, 0), { ...descriptor, form: 5 }, new THREE.Vector3(size, size * (3.1 + (needle % 3) * 0.44), size), descriptor.direction.clone().multiplyScalar(0.2))
  }
  const rawGeometry = new THREE.BufferGeometry()
  rawGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  rawGeometry.setAttribute('pfxAcidBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  rawGeometry.setAttribute('pfxAcidBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  rawGeometry.setAttribute('pfxAcidBurstDirection', new THREE.Float32BufferAttribute(directions, 3))
  rawGeometry.setAttribute('pfxAcidBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  const geometry = mergeVertices(rawGeometry, 1e-4)
  rawGeometry.dispose()
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxAcidBurstDropletDrawCalls'] = 1
  geometry.userData['pfxAcidBurstDropletClosedFaces'] = true
  geometry.userData['pfxAcidBurstDropletSmoothNormals'] = true
  geometry.userData['pfxAcidBurstDropletCount'] = descriptors.length
  geometry.userData['pfxAcidBurstMidZoneDropletCount'] = midZoneDropletCount
  geometry.userData['pfxAcidBurstNeedleCount'] = needleCount
  geometry.userData['pfxAcidBurstRadialShellCount'] = 4
  geometry.userData['pfxAcidBurstDepthLayerCount'] = 12
  geometry.userData['pfxAcidBurstDropletBillboardCount'] = 0
  geometry.userData['pfxAcidBurstDropletTopology'] = 'closed-teardrops-and-stretched-corrosive-needles'
  geometry.userData['pfxAcidBurstDropletAspectProfile'] = 'rounded-volumetric-droplets-not-cards'
  geometry.userData['pfxAcidBurstDropletTriangleCount'] = positions.length / 9
  return geometry
}

export function createPfxAcidBurstDropletMaterial(
  opacity: number,
  primaryColor = '#3f9f2f',
  secondaryColor = '#d9ff47',
  density = 0.58,
  styleEdgeHardness = 0.52,
  accentColor = '#67e8f9',
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uPrimaryColor: { value: new THREE.Color(primaryColor) },
      uSecondaryColor: { value: new THREE.Color(secondaryColor) },
      uDensity: { value: THREE.MathUtils.clamp(density, 0, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
      uAccentColor: { value: new THREE.Color(accentColor) },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      uniform float uDensity;
      attribute vec3 pfxAcidBurstCenter;
      attribute float pfxAcidBurstSeed;
      attribute vec3 pfxAcidBurstDirection;
      attribute float pfxAcidBurstForm;
      varying vec3 vAcidDropletNormal;
      varying vec3 vAcidDropletViewPosition;
      varying float vAcidDropletSeed;
      varying float vAcidDropletForm;
      varying float vAcidDropletLife;
      void main() {
        float dropletExpulsion = smoothstep(0.055 + pfxAcidBurstSeed * 0.012, 0.29 + pfxAcidBurstSeed * 0.022, uCycle);
        float ballisticFall = smoothstep(0.36, 0.79, uCycle);
        float radialDepthScatter = 0.18 + abs(pfxAcidBurstDirection.z) * 0.24;
        vec3 local = position - pfxAcidBurstCenter;
        float dropletTumble = uCycle * (2.4 + pfxAcidBurstSeed * 3.8);
        mat2 tumbleRotation = mat2(cos(dropletTumble), -sin(dropletTumble), sin(dropletTumble), cos(dropletTumble));
        local.xz = tumbleRotation * local.xz;
        local.xy = mat2(cos(dropletTumble * 0.7), -sin(dropletTumble * 0.7), sin(dropletTumble * 0.7), cos(dropletTumble * 0.7)) * local.xy;
        local *= mix(vec3(0.52, 0.68, 0.52), vec3(1.0), dropletExpulsion);
        vec3 center = pfxAcidBurstCenter * mix(0.3, 1.0, dropletExpulsion);
        center += pfxAcidBurstDirection * dropletExpulsion * (0.18 + pfxAcidBurstSeed * 0.3 + radialDepthScatter);
        center.y += dropletExpulsion * (0.18 + pfxAcidBurstSeed * 0.42);
        center.y -= ballisticFall * ballisticFall * (0.3 + pfxAcidBurstSeed * 1.16);
        center.xz += vec2(sin(pfxAcidBurstSeed * 31.0), cos(pfxAcidBurstSeed * 27.0)) * ballisticFall * 0.16;
        vec3 transformed = center + local;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vAcidDropletNormal = normalize(normalMatrix * normal);
        vAcidDropletViewPosition = viewPosition.xyz;
        vAcidDropletSeed = pfxAcidBurstSeed;
        vAcidDropletForm = pfxAcidBurstForm;
        float minimumSemanticDropletFloor = 0.18;
        float authoredDensityReveal = step(pfxAcidBurstSeed, minimumSemanticDropletFloor + uDensity * (1.0 - minimumSemanticDropletFloor));
        vAcidDropletLife = (1.0 - smoothstep(0.52 + pfxAcidBurstSeed * 0.025, 0.76 + pfxAcidBurstSeed * 0.055, uCycle)) * authoredDensityReveal;
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
      uniform vec3 uAccentColor;
      varying vec3 vAcidDropletNormal;
      varying vec3 vAcidDropletViewPosition;
      varying float vAcidDropletSeed;
      varying float vAcidDropletForm;
      varying float vAcidDropletLife;
      void main() {
        vec3 normal = normalize(vAcidDropletNormal);
        vec3 viewDirection = normalize(-vAcidDropletViewPosition);
        float facing = max(0.0, dot(normal, viewDirection));
        float hotAcidCore = pow(facing, 2.4) * (0.52 + uDensity * 0.38);
        float dropletMeniscus = pow(1.0 - facing, mix(1.8, 0.7, uStyleEdgeHardness));
        float liquidTransmission = pow(1.0 - abs(dot(normal, viewDirection)), 2.2);
        float directionalVolumeShading = 0.4 + 0.6 * max(0.0, dot(normal, normalize(vec3(-0.38, 0.76, 0.52))));
        float needle = step(4.5, vAcidDropletForm);
        float styleEmissiveBoost = smoothstep(0.58, 0.72, uStyleEdgeHardness);
        float neonAccentIsolation = styleEmissiveBoost * 0.86;
        float chemicalShimmer = 0.5 + 0.5 * sin(vAcidDropletSeed * 43.0 + uCycle * 22.0);
        float secondaryOverrideSaturation = 0.86 + chemicalShimmer * 0.24;
        float corrosionDissolve = smoothstep(0.5, 0.82, uCycle);
        vec3 acidColor = mix(uPrimaryColor * 0.5, uSecondaryColor, 0.72 + hotAcidCore * 0.2);
        acidColor += uSecondaryColor * dropletMeniscus * (0.18 + needle * 0.34);
        acidColor += uSecondaryColor * liquidTransmission * 0.34;
        acidColor *= mix(0.94, 1.18, needle);
        acidColor += uAccentColor * styleEmissiveBoost * (0.88 + dropletMeniscus * 0.46);
        acidColor += uSecondaryColor * chemicalShimmer * (0.12 + styleEmissiveBoost * 0.16);
        acidColor = mix(acidColor, uSecondaryColor * secondaryOverrideSaturation * 1.12, 0.48);
        acidColor = mix(acidColor, uAccentColor * (1.18 + dropletMeniscus * 0.24), neonAccentIsolation);
        acidColor *= directionalVolumeShading;
        float secondaryColorPostLightLock = 1.0 - styleEmissiveBoost;
        acidColor += uSecondaryColor * secondaryOverrideSaturation * secondaryColorPostLightLock * 0.68;
        float alpha = uOpacity * vAcidDropletLife * (0.62 + facing * 0.16 + dropletMeniscus * 0.18);
        alpha *= 1.0 - corrosionDissolve * (0.14 + chemicalShimmer * 0.24);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(acidColor, clamp(alpha, 0.0, 0.96));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxAcidBurstMaterial'] = true
  material.userData['pfxAcidBurstMaterialRole'] = 'droplets'
  material.userData['pfxAcidBurstControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxAcidBurstMaterialProfile'] = 'hot-caustic-teardrops-and-needle-spray'
  return material
}
