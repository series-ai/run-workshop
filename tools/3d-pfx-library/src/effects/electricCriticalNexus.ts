import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { appendPfxPlasmaHitPrimitive } from '../constants/04'

export function createPfxElectricCriticalNexusGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const core = new THREE.OctahedronGeometry(1, 0)
  appendPfxPlasmaHitPrimitive(
    positions,
    colors,
    core,
    new THREE.Matrix4().makeScale(0.22, 0.25, 0.22),
    [1, 0.82, 0.24],
  )
  core.dispose()
  const crown = new THREE.OctahedronGeometry(1, 0)
  const crownTransforms = [
    { position: new THREE.Vector3(-0.1, 0.21, -0.04), rotation: 0.34, scale: 0.075 },
    { position: new THREE.Vector3(0, 0.27, 0.05), rotation: 0, scale: 0.09 },
    { position: new THREE.Vector3(0.11, 0.2, -0.04), rotation: -0.34, scale: 0.07 },
  ]
  for (const shard of crownTransforms) {
    appendPfxPlasmaHitPrimitive(
      positions,
      colors,
      crown,
      new THREE.Matrix4().compose(
        shard.position,
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0.24, 0.18, shard.rotation)),
        new THREE.Vector3(shard.scale * 0.42, shard.scale, shard.scale * 0.42),
      ),
      [1, 0.5, 0.06],
    )
  }
  crown.dispose()
  const raw = new THREE.BufferGeometry()
  raw.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  raw.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const geometry = mergeVertices(raw, 1e-4)
  raw.dispose()
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxElectricCriticalNexusCoreCount'] = 1
  geometry.userData['pfxElectricCriticalNexusCrownShardCount'] = crownTransforms.length
  geometry.userData['pfxElectricCriticalNexusCoreRadius'] = 0.22
  geometry.userData['pfxElectricCriticalNexusTopology'] = 'faceted-octa-core-with-three-gold-crown-shards'
  geometry.userData['pfxElectricCriticalNexusDrawCalls'] = 1
  geometry.userData['pfxElectricCriticalNexusWorldSpace'] = true
  return geometry
}

export function createPfxElectricCriticalNexusMaterial(
  opacity: number,
  primaryColor = '#5eeaff',
  secondaryColor = '#ffd45a',
  density = 0.56,
  styleEdgeHardness = 0.54,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: opacity },
      uCycle: { value: 0 },
      uPrimaryColor: { value: new THREE.Color(primaryColor) },
      uSecondaryColor: { value: new THREE.Color(secondaryColor) },
      uDensity: { value: THREE.MathUtils.clamp(density, 0, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
    },
    vertexColors: true,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      varying vec3 vColor;
      varying vec3 vNormalView;
      varying vec3 vView;
      varying vec3 vLocal;
      void main() {
        float build = smoothstep(0.02, 0.18, uCycle);
        float pulse = 1.0 + sin(uCycle * 54.0) * 0.045 * (1.0 - smoothstep(0.18, 0.5, uCycle));
        vec3 animated = position * mix(0.18, pulse, build);
        vec4 viewPosition = modelViewMatrix * vec4(animated, 1.0);
        vColor = color;
        vNormalView = normalize(normalMatrix * normal);
        vView = viewPosition.xyz;
        vLocal = animated;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uCycle;
      uniform float uDensity;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      varying vec3 vColor;
      varying vec3 vNormalView;
      varying vec3 vView;
      varying vec3 vLocal;
      void main() {
        vec3 normalView = normalize(vNormalView);
        vec3 viewDirection = normalize(-vView);
        float facing = max(dot(normalView, viewDirection), 0.0);
        float cyanRim = pow(1.0 - facing, mix(2.6, 1.55, uStyleEdgeHardness));
        float key = max(dot(normalView, normalize(vec3(0.36, 0.74, 0.56))), 0.0);
        float facet = mix(0.16, 0.24, uDensity) + key * 0.8;
        vec3 controlledCriticalGold = mix(uSecondaryColor, vec3(1.0, 1.0, 0.96), 0.18);
        vec3 goldCore = mix(controlledCriticalGold, vec3(1.0, 1.0, 0.96), 0.48 + facing * 0.32 + key * 0.12);
        float hotCenter = 1.0 - smoothstep(0.0, 0.26, length(vLocal));
        vec3 color = mix(vColor * facet, goldCore, 0.84 + hotCenter * 0.12);
        color += uPrimaryColor * cyanRim * mix(0.48, 0.72, uDensity);
        float release = 1.0 - smoothstep(0.34, 0.72, uCycle);
        float alpha = uOpacity * release * (0.88 + cyanRim * 0.1);
        if (alpha < 0.025) discard;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.98));
      }
    `,
  })
  material.userData['pfxElectricCriticalMaterial'] = 'faceted-white-gold-critical-nexus'
  material.userData['pfxElectricCriticalMaterialLayer'] = 'depth-writing-critical-nexus'
  material.userData['pfxElectricCriticalNexusFragmentModel'] = 'normal-lit-gold-core-cyan-rim'
  material.userData['pfxElectricCriticalControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxElectricCriticalTextureSamples'] = 0
  return material
}
