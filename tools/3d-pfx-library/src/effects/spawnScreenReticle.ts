import * as THREE from 'three'

export function createPfxSpawnScreenReticleGeometry(
  color: THREE.ColorRepresentation = '#35d8ff',
): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const base = new THREE.Color(color)
  const shadow = base.clone().multiplyScalar(0.34)
  const pale = base.clone().lerp(new THREE.Color('#ffffff'), 0.82)
  const push = (x: number, y: number, z: number, value: THREE.Color, intensity = 1) => {
    positions.push(x, y, z)
    const visible = value.clone().multiplyScalar(0.32 + intensity * 0.68)
    colors.push(visible.r, visible.g, visible.b)
  }
  const triangle = (
    a: readonly [number, number],
    b: readonly [number, number],
    c: readonly [number, number],
    value: THREE.Color,
    intensity = 1,
    z = 0,
  ) => {
    push(a[0], a[1], z, value, intensity)
    push(b[0], b[1], z, value, intensity)
    push(c[0], c[1], z, value, intensity)
  }
  const quad = (
    a: readonly [number, number],
    b: readonly [number, number],
    c: readonly [number, number],
    d: readonly [number, number],
    value: THREE.Color,
    intensity = 1,
    z = 0,
  ) => {
    triangle(a, b, c, value, intensity, z)
    triangle(a, c, d, value, intensity, z)
  }
  const line = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    width: number,
    value: THREE.Color,
    z = 0,
    intensity = 1,
  ) => {
    const dx = bx - ax
    const dy = by - ay
    const length = Math.max(0.0001, Math.hypot(dx, dy))
    const nx = (-dy / length) * width
    const ny = (dx / length) * width
    quad([ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny], value, intensity, z)
  }

  // Recessed fabrication rails and scan ticks establish a portal/workbench,
  // not a circular aim reticle. Their darker value is the rear depth band.
  for (const side of [-1, 1]) {
    const x = side * 0.91
    line(x, -0.72, x, -0.28, 0.018, shadow, -0.035, 0.72)
    line(x, -0.14, x, 0.24, 0.018, shadow, -0.035, 0.72)
    line(x, 0.38, x, 0.72, 0.018, shadow, -0.035, 0.72)
    for (const y of [-0.72, -0.28, 0.24, 0.72]) {
      line(x, y, x - side * 0.16, y, 0.018, base, -0.025, 0.78)
    }
  }
  line(-0.72, 0.88, 0.72, 0.88, 0.012, shadow, -0.04, 0.55)
  line(-0.72, -0.88, 0.72, -0.88, 0.012, shadow, -0.04, 0.55)

  // Two low-value registration ghosts sit behind the resolved body. Their
  // opposing offsets read as holographic depth/chromatic registration while
  // preserving the screen-space camera contract and the one-draw budget.
  for (const offset of [-0.052, 0.052]) {
    const ghost = shadow.clone().lerp(base, offset > 0 ? 0.36 : 0.18)
    const z = -0.055 + (offset > 0 ? 0.012 : 0)
    quad([-0.2 + offset, 0.31], [0.2 + offset, 0.31], [0.14 + offset, -0.21], [-0.14 + offset, -0.21], ghost, 0.56, z)
    quad([-0.13 + offset, -0.27], [-0.015 + offset, -0.27], [-0.08 + offset, -0.7], [-0.2 + offset, -0.7], ghost, 0.52, z)
    quad([0.015 + offset, -0.27], [0.13 + offset, -0.27], [0.2 + offset, -0.7], [0.08 + offset, -0.7], ghost, 0.52, z)
    triangle([-0.115 + offset, 0.58], [offset, 0.67], [0.115 + offset, 0.58], ghost, 0.58, z)
    triangle([-0.115 + offset, 0.58], [0.115 + offset, 0.58], [offset, 0.36], ghost, 0.58, z)
  }

  // Seven-part avatar: head, torso, paired arms, paired legs, and luminous
  // chest core. Small gaps make it visibly assemble from discrete pieces.
  const head: ReadonlyArray<readonly [number, number]> = [
    [-0.12, 0.6], [0, 0.68], [0.12, 0.6], [0.12, 0.43], [0, 0.36], [-0.12, 0.43],
  ]
  for (let index = 1; index < head.length - 1; index += 1) {
    triangle(head[0]!, head[index]!, head[index + 1]!, pale, 0.84, 0.035)
  }
  quad([-0.21, 0.31], [0.21, 0.31], [0.15, -0.21], [-0.15, -0.21], base, 0.76, 0.012)
  quad([-0.25, 0.27], [-0.17, 0.24], [-0.29, -0.18], [-0.37, -0.14], pale, 0.72, 0.025)
  quad([0.17, 0.24], [0.25, 0.27], [0.37, -0.14], [0.29, -0.18], pale, 0.72, 0.025)
  quad([-0.14, -0.27], [-0.01, -0.27], [-0.08, -0.7], [-0.22, -0.7], base, 0.86, 0.018)
  quad([0.01, -0.27], [0.14, -0.27], [0.22, -0.7], [0.08, -0.7], base, 0.86, 0.018)
  triangle([0, 0.18], [0.1, 0.06], [0, -0.06], pale, 1, 0.055)
  triangle([0, 0.18], [0, -0.06], [-0.1, 0.06], base, 0.92, 0.05)

  // Bright scan slices reveal an object being reconstructed rather than
  // simply selected. Offset depths keep additive overlaps tonally layered.
  for (const [index, y] of [0.48, 0.26, 0.04, -0.2, -0.46].entries()) {
    const halfWidth = 0.3 + (index % 2) * 0.08
    line(-halfWidth, y, halfWidth, y, 0.009, pale, 0.065, 0.76 + index * 0.05)
  }

  // Twelve converging data fragments form mirrored assembly traffic. Their
  // slanted silhouettes point toward the avatar without becoming aim arrows.
  for (let fragment = 0; fragment < 12; fragment += 1) {
    const side = fragment % 2 === 0 ? -1 : 1
    const row = Math.floor(fragment / 2)
    const y = 0.64 - row * 0.255
    const x = side * (0.5 + (row % 3) * 0.085)
    const inward = -side * 0.12
    quad(
      [x, y + 0.035],
      [x + inward, y + 0.012],
      [x + inward, y - 0.012],
      [x, y - 0.035],
      fragment % 4 < 2 ? base : pale,
      0.7 + (row % 3) * 0.12,
      fragment % 4 < 2 ? -0.005 : 0.045,
    )
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData = {
    pfxGeometry: 'spawn-screen-avatar-assembly-lattice',
    avatarPartCount: 7,
    assemblyRailCount: 2,
    depthBandCount: 3,
    fragmentCount: 12,
    ghostShellCount: 2,
    scanSliceCount: 5,
  }
  return geometry
}

export function createPfxSpawnScreenReticleMaterial(opacity: number): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: opacity },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vColor;
      varying vec3 vLocalPosition;
      void main() {
        vColor = color;
        vLocalPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uTime;
      varying vec3 vColor;
      varying vec3 vLocalPosition;
      void main() {
        float vertical = clamp(vLocalPosition.y * 0.48 + 0.52, 0.0, 1.0);
        float scan = 0.82 + 0.18 * sin(vLocalPosition.y * 42.0 - uTime * 8.0);
        float frontBand = smoothstep(-0.055, 0.065, vLocalPosition.z);
        float sideRim = smoothstep(0.12, 0.92, abs(vLocalPosition.x));
        vec3 graded = mix(vColor * 0.68, vColor * 1.26, vertical);
        graded *= scan * mix(0.72, 1.16, frontBand);
        graded += vColor * sideRim * 0.16;
        graded += vec3(0.06, 0.2, 0.28) * frontBand * 0.22;
        gl_FragColor = vec4(graded, uOpacity * mix(0.62, 1.0, frontBand));
      }
    `,
    transparent: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
  material.userData = { pfxMaterial: 'spawn-screen-avatar-scan-gradient' }
  return material
}
