import * as THREE from 'three'

export function createPfxShockwaveSpawnPressureFrontGeometry(): THREE.BufferGeometry {
  const innerRadius = 0.56
  const outerRadius = 0.78
  const radialSegments = 4
  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 64, radialSegments)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxShockwaveSpawnPressureFront'] = 'thick-open-annular-wave'
  geometry.userData['pfxShockwaveSpawnPressureFrontCenterFilled'] = false
  geometry.userData['pfxShockwaveSpawnPressureFrontInnerRadius'] = innerRadius
  geometry.userData['pfxShockwaveSpawnPressureFrontOuterRadius'] = outerRadius
  geometry.userData['pfxShockwaveSpawnPressureFrontBandWidth'] = outerRadius - innerRadius
  geometry.userData['pfxShockwaveSpawnPressureFrontRadialSegments'] = radialSegments
  return geometry
}

export function createPfxShockwaveSpawnPressureFrontMaterial(opacity: number): THREE.ShaderMaterial {
  const innerRadius = 0.56
  const outerRadius = 0.78
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: opacity },
      uInnerRadius: { value: innerRadius },
      uOuterRadius: { value: outerRadius },
      uInnerColor: { value: new THREE.Color('#ff8a32') },
      uCrestColor: { value: new THREE.Color('#ffe08a') },
      uAccentColor: { value: new THREE.Color('#ff3d6e') },
    },
    vertexShader: `
      varying float vRadius;
      varying float vAngle;
      void main() {
        vRadius = length(position.xy);
        vAngle = atan(position.y, position.x);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uInnerRadius;
      uniform float uOuterRadius;
      uniform vec3 uInnerColor;
      uniform vec3 uCrestColor;
      uniform vec3 uAccentColor;
      varying float vRadius;
      varying float vAngle;
      void main() {
        float bandWidth = uOuterRadius - uInnerRadius;
        float bandProgress = clamp((vRadius - uInnerRadius) / bandWidth, 0.0, 1.0);
        float innerFeather = smoothstep(0.0, 0.2, bandProgress);
        float outerFeather = 1.0 - smoothstep(0.76, 1.0, bandProgress);
        float crest = smoothstep(0.28, 0.62, bandProgress) * (1.0 - smoothstep(0.62, 0.84, bandProgress));
        float angularModulation = 0.72 + 0.28 * (0.5 + 0.5 * sin(vAngle * 9.0 + sin(vAngle * 3.0) * 1.7));
        float accentBand = pow(0.5 + 0.5 * sin(vAngle * 5.0 - bandProgress * 4.0), 4.0) * crest;
        float alpha = innerFeather * outerFeather * angularModulation * uOpacity;
        if (alpha < 0.004) discard;
        vec3 color = mix(mix(uInnerColor, uCrestColor, 0.28 + crest * 0.72), uAccentColor, accentBand * 0.82);
        gl_FragColor = vec4(color, alpha * (0.48 + crest * 0.52));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
  material.userData['pfxMaterial'] = 'shockwave-spawn-pressure-front'
  material.userData['pfxShockwaveSpawnPressureFront'] = true
  return material
}
