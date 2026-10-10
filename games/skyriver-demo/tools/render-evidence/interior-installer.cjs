'use strict';

const crypto = require('node:crypto');

function installInteriorExperiment(app) {
  'use strict';

  const KEY = '__interiorExperiment';
  const OFFSET_UNIFORM = 'uR34InteriorSilhouetteOffset';
  const ALLOWED_OFFSETS = [0, 150, 300, 450];
  const UNIFORM_ANCHOR = 'uniform float uInteriorStrength; // 0 = off (low tier), 1 = on\n';
  // This anchor is after the fragment's assembled hash helpers, which the silhouette uses.
  const FUNCTION_ANCHOR = 'float windowSdf( vec2 cellLocal, float ribbon ) {';
  const TRACE_START_ANCHOR = '  // --- T7-4 interiors: within uInteriorFade of the camera, the glass shows a traced room. -----------\n  if ( S > 0.001 && glassRaw > 0.001 ) {\n';
  const TRACE_END_ANCHOR = '    resolved = mix( resolved, resolvedInterior, S );\n  }\n  // R22: ONE equal-luminance recolour of the finished pane-and-room emission.';
  const T_EXPRESSION = '  float S = clamp( uInteriorStrength * interiorDepthMix * grazingFade * vIsSide * vEmissionAllowed, 0.0, 1.0 );';
  const F_EXPRESSION = '  float F = clamp( S * furnitureDepthMix * furniturePixelMix, 0.0, 1.0 );';
  const FRATIO_EXPRESSION = '  float fRatio = F / max( S, 1e-4 );';

  function countExact(source, text) {
    let count = 0;
    let offset = 0;
    while ((offset = source.indexOf(text, offset)) !== -1) {
      count += 1;
      offset += text.length;
    }
    return count;
  }

  function replaceUnique(source, anchor, replacement, name) {
    const count = countExact(source, anchor);
    if (count !== 1) throw new Error('R34 strict anchor count for ' + name + ' is ' + count + ', expected 1.');
    return source.replace(anchor, replacement);
  }

  function makeSilhouetteFunction() {
    return [
      'vec3 traceRoomSilhouette( vec2 cellLocal, vec3 ray, float mirror, float roomSeed ) {',
      '  vec3 o = vec3( cellLocal, 0.0 );',
      '  if ( mirror > 0.5 ) { o.x = 1.0 - o.x; ray.x = - ray.x; }',
      '  vec3 r = vec3(',
      '    ray.x < 0.0 ? -max( abs( ray.x ), 1e-4 ) : max( abs( ray.x ), 1e-4 ),',
      '    ray.y < 0.0 ? -max( abs( ray.y ), 1e-4 ) : max( abs( ray.y ), 1e-4 ),',
      '    max( ray.z, 1e-4 )',
      '  );',
      '  vec3 tAxis = ( step( 0.0, r ) - o ) / r;',
      '  float wallT = min( tAxis.x, min( tAxis.y, tAxis.z ) );',
      '  vec3 hit = o + r * wallT;',
      '  float faceShade = 1.0;',
      '  vec3 faceColor = vec3( 0.18 );',
      '  if ( tAxis.z <= tAxis.x && tAxis.z <= tAxis.y ) {',
      '    faceShade = 1.0;',
      '    faceColor = vec3( 0.18, 0.19, 0.21 );',
      '  } else if ( tAxis.x <= tAxis.y ) {',
      '    faceShade = 0.72;',
      '    faceColor = vec3( 0.15, 0.16, 0.18 );',
      '  } else if ( r.y < 0.0 ) {',
      '    faceShade = 0.60;',
      '    faceColor = vec3( 0.11, 0.12, 0.14 );',
      '  } else {',
      '    faceShade = 0.95;',
      '    faceColor = vec3( 0.19, 0.20, 0.22 );',
      '  }',
      '  float wallDepthShade = faceShade * mix( 1.0, 0.5, clamp( hit.z, 0.0, 1.0 ) );',
      '  float seedShade = 0.96 + 0.08 * skyHash12( vec2( roomSeed * 17.0, floor( hit.y * 8.0 ) ) );',
      '  vec3 wallColor = faceColor * wallDepthShade * seedShade;',
      '  float boxShift = 0.12 * skyHash11( roomSeed * 31.0 + 4.0 );',
      '  vec3 boxLo = vec3( 0.18 + boxShift, 0.08, 0.30 );',
      '  vec3 boxHi = vec3( min( boxLo.x + 0.36, 0.82 ), 0.54, 0.66 );',
      '  vec3 t0 = ( boxLo - o ) / r;',
      '  vec3 t1 = ( boxHi - o ) / r;',
      '  vec3 nearAxis = min( t0, t1 );',
      '  vec3 farAxis = max( t0, t1 );',
      '  float boxNear = max( nearAxis.x, max( nearAxis.y, nearAxis.z ) );',
      '  float boxFar = min( farAxis.x, min( farAxis.y, farAxis.z ) );',
      '  if ( boxNear > 0.0 && boxNear < wallT && boxNear < boxFar ) {',
      '    vec3 boxHit = o + r * boxNear;',
      '    float boxDepthShade = mix( 0.72, 0.40, clamp( boxHit.z, 0.0, 1.0 ) );',
      '    return vec3( 0.10, 0.105, 0.12 ) * boxDepthShade;',
      '  }',
      '  return wallColor;',
      '}'
    ].join('\n');
  }

  function makeSilhouetteBlend(terms) {
    const screenSourceLine = terms.screenSource.replace('vec3 screenSource =', 'vec3 r34ScreenSource =');
    const dimLightBlock = [
      terms.dimLightBase
        .replace('vec3 dimLight =', 'vec3 r34DimLight =')
        .replace(/\bscreenSource\b/g, 'r34ScreenSource'),
      terms.dimLightPristine.replace(/\bdimLight\b/g, 'r34DimLight'),
    ].join('\n');
    const roomLightLine = terms.roomLight.replace('vec3 roomLight =', 'vec3 r34RoomLight =').replace('dimLight * dim', 'r34DimLight * dim');
    const sheenLine = terms.sheen.replace('interior +=', 'r34Interior +=');
    const resolvedLine = terms.resolved
      .replace('vec3 resolvedInterior =', 'vec3 r34Resolved =')
      .replace('( interior * glassRaw', '( r34Interior * glassRaw');
    return [
      '  // R34 diagnostic C path. T and F above still use the original trace and atlas.',
      '  // The delta form gives base(1-C) + silhouette(C-T) + trace(T).',
      '  if ( uR34InteriorSilhouetteOffset > 0.0 && glassRaw > 0.001 ) {',
      '    float r34DepthMix = interiorDepthWeight( viewDepth, uInteriorFade + vec2( uR34InteriorSilhouetteOffset ) );',
      '    float r34RawC = clamp( uInteriorStrength * r34DepthMix * grazingFade * vIsSide * vEmissionAllowed, 0.0, 1.0 );',
      '    float r34T = ( S > 0.001 && glassRaw > 0.001 ) ? S : 0.0;',
      '    // Selected dim screens keep their original screen path and receive no added C-T silhouette.',
      '    float r34ScreenGate = 1.0 - clamp( screenActive * dim, 0.0, 1.0 );',
      '    float r34C = r34T + max( r34RawC - r34T, 0.0 ) * r34ScreenGate;',
      '    float r34SilhouetteWeight = max( r34C - r34T, 0.0 );',
      '    if ( r34SilhouetteWeight > 0.0 ) {',
      '      vec3 r34Ray = vec3( dot( d, vTangentW ) / uCellWidth, d.y / uCellHeight, - dot( d, vNormalW ) / ROOM_DEPTH_M );',
      '      float r34Mirror = step( 0.5, skyHash11( roomHash * 37.0 + 3.0 ) );',
      '      vec3 r34Room = traceRoomSilhouette( cellLocal, r34Ray, r34Mirror, roomHash );',
      '      ' + screenSourceLine.trim(),
      '      ' + dimLightBlock.trim().replace(/\n/g, '\n      '),
      '      ' + roomLightLine.trim().replace(/\n/g, '\n      '),
      '      vec3 r34Interior = r34Room * r34RoomLight * glassTint;',
      '      ' + sheenLine.trim(),
      '      ' + resolvedLine.trim(),
      '      resolved += ( r34Resolved - r34PaneBase ) * r34SilhouetteWeight;',
      '    }',
      '  }',
      '  // R22: ONE equal-luminance recolour of the finished pane-and-room emission.'
    ].join('\n');
  }

  if (!app || !app.scene || !app.scene.city || !app.scene.renderer) {
    throw new Error('R34 requires app.scene.city, app.scene.renderer, and a live tower mesh.');
  }
  if (window[KEY]) throw new Error('R34 experiment is already installed.');
  const mesh = app.scene.city.towerMesh;
  const original = mesh && mesh.material;
  if (!mesh || !original || Array.isArray(original) || typeof original.clone !== 'function') {
    throw new Error('R34 requires the single live ShaderMaterial on app.scene.city.towerMesh.');
  }
  if (typeof original.vertexShader !== 'string' || typeof original.fragmentShader !== 'string' || !original.uniforms) {
    throw new Error('R34 live tower material does not expose ShaderMaterial source and uniforms.');
  }
  const originalVertex = original.vertexShader;
  const originalFragment = original.fragmentShader;
  const originalUniforms = original.uniforms;
  const initialMeshUserData = mesh.userData;
  const initialUniformKeys = Object.keys(originalUniforms).sort();
  const initialFlags = {
    name: original.name,
    type: original.type,
    fog: original.fog,
    side: original.side,
    transparent: original.transparent,
    depthTest: original.depthTest,
    depthWrite: original.depthWrite,
    colorWrite: original.colorWrite,
    blending: original.blending,
    toneMapped: original.toneMapped,
    polygonOffset: original.polygonOffset,
    polygonOffsetFactor: original.polygonOffsetFactor,
    polygonOffsetUnits: original.polygonOffsetUnits,
    vertexColors: original.vertexColors,
    lights: original.lights,
    clipping: original.clipping,
    extensions: JSON.stringify(original.extensions),
    glslVersion: original.glslVersion,
    stage: original.stage === undefined ? null : original.stage
  };
  const meshFlags = {
    name: mesh.name,
    count: mesh.count,
    geometry: mesh.geometry && mesh.geometry.uuid,
    renderOrder: mesh.renderOrder,
    frustumCulled: mesh.frustumCulled,
    visible: mesh.visible,
    layersMask: mesh.layers && mesh.layers.mask,
    userData: JSON.stringify(mesh.userData)
  };

  const anchors = [
    ['uniform.uInteriorStrength', UNIFORM_ANCHOR],
    ['function.windowSdf', FUNCTION_ANCHOR],
    ['trace.start', TRACE_START_ANCHOR],
    ['trace.end', TRACE_END_ANCHOR],
    ['T.expression', T_EXPRESSION],
    ['F.expression', F_EXPRESSION],
    ['fRatio.expression', FRATIO_EXPRESSION]
  ];
  const anchorCounts = Object.fromEntries(anchors.map(([name, text]) => [name, countExact(originalFragment, text)]));
  for (const [name, text] of anchors) {
    const expected = name.startsWith('T.') || name.startsWith('F.') || name.startsWith('fRatio.') ? 1 : 1;
    if (countExact(originalFragment, text) !== expected) {
      throw new Error('R34 source anchor mismatch: ' + name + ' count=' + countExact(originalFragment, text));
    }
  }
  if (originalFragment.includes('uniform float ' + OFFSET_UNIFORM + ';')) {
    throw new Error('R34 offset uniform already exists in the live material.');
  }

  function extractUnique(regex, name) {
    const matches = Array.from(originalFragment.matchAll(new RegExp(regex.source, 'g')));
    if (matches.length !== 1) throw new Error('R34 source-pinned term mismatch: ' + name + ' count=' + matches.length + ', expected 1.');
    return matches[0][0];
  }
  const pinnedTerms = {
    screenSource: extractUnique(/vec3 screenSource = interiorScreenSource\([\s\S]*?\);/, 'screen source'),
    dimLightBase: extractUnique(/vec3 dimLight = mix\( paneColor \* [0-9.]+, screenSource, screenActive \);/, 'screen dim light'),
    dimLightPristine: extractUnique(/dimLight = mix\( dimLight, vec3\( [^)]* \) \* [0-9.]+, pristine \);/, 'pristine dim light'),
    roomLight: extractUnique(/vec3 roomLight = paneColor \* \( lit \* blockLive \* brightness \* buzz \* 7\.0 \) \+ dimLight \* dim \* 5\.5\s*\+ vec3\( [0-9.]+, [0-9.]+, [0-9.]+ \) \* glassTint \* mix\( 1\.0, 0\.25, pristine \);/, 'room light and dark spill'),
    sheen: extractUnique(/interior \+= sheen \* fresnel \* [0-9.]+;/, 'room sheen'),
    resolved: extractUnique(/vec3 resolvedInterior = \( interior \* glassRaw \+ paneColor \* \( lit \* blockLive \* brightness \) \* halo \* 0\.1 \) \* \( 1\.0 - heroShadow \);/, 'resolved room composition')
  };
  const silhouetteFunction = makeSilhouetteFunction();
  if (silhouetteFunction.includes('texture2D') || silhouetteFunction.includes('texture(')) {
    throw new Error('R34 cheap silhouette must not read an atlas.');
  }
  let candidateFragment = replaceUnique(
    originalFragment,
    UNIFORM_ANCHOR,
    UNIFORM_ANCHOR + 'uniform float ' + OFFSET_UNIFORM + '; // diagnostic view-depth offset in metres\n',
    'uniform.uInteriorStrength'
  );
  candidateFragment = replaceUnique(
    candidateFragment,
    FUNCTION_ANCHOR,
    silhouetteFunction + '\n\n' + FUNCTION_ANCHOR,
    'function.windowSdf'
  );
  candidateFragment = replaceUnique(
    candidateFragment,
    TRACE_START_ANCHOR,
    TRACE_START_ANCHOR.replace('  if ( S > 0.001', '  vec3 r34PaneBase = resolved;\n  if ( S > 0.001'),
    'trace.start'
  );
  candidateFragment = replaceUnique(
    candidateFragment,
    TRACE_END_ANCHOR,
    '    resolved = mix( resolved, resolvedInterior, S );\n  }\n' + makeSilhouetteBlend(pinnedTerms),
    'trace.end'
  );

  const tfTokens = [T_EXPRESSION, F_EXPRESSION, FRATIO_EXPRESSION, '    vec3 roomColor = traceRoom( cellLocal, ray, room, mirror, fRatio, depth01 );'];
  const tfTokenCounts = Object.fromEntries(tfTokens.map((token, index) => [['T', 'F', 'fRatio', 'traceRoom'][index], countExact(candidateFragment, token)]));
  for (const [name, count] of Object.entries(tfTokenCounts)) {
    if (count !== 1) throw new Error('R34 must retain original T/F trace code: ' + name + ' count=' + count);
  }
  const silhouetteStart = candidateFragment.indexOf('vec3 traceRoomSilhouette');
  const silhouetteEnd = candidateFragment.indexOf('\n' + FUNCTION_ANCHOR, silhouetteStart);
  if (silhouetteStart < 0 || silhouetteEnd < 0) throw new Error('R34 silhouette function placement failed.');
  const addedFunctionText = candidateFragment.slice(silhouetteStart, silhouetteEnd);
  if (addedFunctionText.includes('texture2D') || addedFunctionText.includes('texture(')) {
    throw new Error('R34 silhouette function contains an atlas read.');
  }

  function uniformProxy(extras) {
    const target = Object.create(null);
    return new Proxy(target, {
      get(_target, key) {
        if (Object.prototype.hasOwnProperty.call(extras, key)) return extras[key];
        return original.uniforms[key];
      },
      set(_target, key, value) {
        if (Object.prototype.hasOwnProperty.call(extras, key)) extras[key] = value;
        else original.uniforms[key] = value;
        return true;
      },
      has(_target, key) {
        return Object.prototype.hasOwnProperty.call(extras, key) || key in original.uniforms;
      },
      ownKeys() {
        return Array.from(new Set(Reflect.ownKeys(original.uniforms).concat(Reflect.ownKeys(extras))));
      },
      getOwnPropertyDescriptor(_target, key) {
        if (!Object.prototype.hasOwnProperty.call(extras, key) && !(key in original.uniforms)) return undefined;
        return { configurable: true, enumerable: true, writable: true, value: Object.prototype.hasOwnProperty.call(extras, key) ? extras[key] : original.uniforms[key] };
      },
      defineProperty(_target, key, descriptor) {
        if (Object.prototype.hasOwnProperty.call(extras, key)) {
          if (Object.prototype.hasOwnProperty.call(descriptor, 'value')) extras[key] = descriptor.value;
        } else {
          Object.defineProperty(original.uniforms, key, descriptor);
        }
        return true;
      },
      deleteProperty(_target, key) {
        if (Object.prototype.hasOwnProperty.call(extras, key)) return false;
        return delete original.uniforms[key];
      }
    });
  }

  const originalOnBeforeCompile = original.onBeforeCompile;
  const originalCacheKey = original.customProgramCacheKey;
  const candidateMaterials = new Map();
  for (const offset of ALLOWED_OFFSETS) {
    const clone = original.clone();
    clone.vertexShader = originalVertex;
    clone.fragmentShader = candidateFragment;
    clone.uniforms = uniformProxy({ [OFFSET_UNIFORM]: { value: offset } });
    clone.fog = original.fog;
    clone.userData = original.userData;
    if ('stage' in original) clone.stage = original.stage;
    clone.onBeforeCompile = function (shader, renderer) {
      return originalOnBeforeCompile.call(original, shader, renderer);
    };
    clone.customProgramCacheKey = function () {
      return String(originalCacheKey.call(original)) + '|r34-interior-silhouette-v1';
    };
    clone.name = original.name + '.r34.' + offset;
    clone.program = null;
    clone.needsUpdate = true;
    candidateMaterials.set(offset, clone);
  }

  let selected = 0;
  let restored = false;
  const managedMaterials = new Set([original, ...candidateMaterials.values()]);
  function checkedOffset(offsetM) {
    const value = Number(offsetM);
    if (!ALLOWED_OFFSETS.includes(value)) throw new Error('R34 offset must be 0, 150, 300, or 450 m.');
    return value;
  }
  function assertMaterialOwnership() {
    if (!managedMaterials.has(mesh.material)) throw new Error('R34 mesh material changed outside this experiment.');
  }
  function select(offsetM) {
    if (restored) throw new Error('R34 experiment was restored.');
    assertMaterialOwnership();
    const offset = checkedOffset(offsetM);
    selected = offset;
    mesh.material = offset === 0 ? original : candidateMaterials.get(offset);
    return { offsetM: offset, rebuilt: false, materialName: mesh.material.name };
  }
  function selectRebuilt(offsetM) {
    if (restored) throw new Error('R34 experiment was restored.');
    assertMaterialOwnership();
    const offset = checkedOffset(offsetM);
    selected = offset;
    mesh.material = candidateMaterials.get(offset);
    return { offsetM: offset, rebuilt: true, materialName: mesh.material.name };
  }
  function restore() {
    mesh.material = original;
    selected = 0;
    restored = true;
    return { restored: mesh.material === original, materialName: mesh.material.name };
  }
  function materialFlagSnapshot(material) {
    return {
      name: material.name,
      type: material.type,
      fog: material.fog,
      side: material.side,
      transparent: material.transparent,
      depthTest: material.depthTest,
      depthWrite: material.depthWrite,
      colorWrite: material.colorWrite,
      blending: material.blending,
      toneMapped: material.toneMapped,
      polygonOffset: material.polygonOffset,
      polygonOffsetFactor: material.polygonOffsetFactor,
      polygonOffsetUnits: material.polygonOffsetUnits,
      vertexColors: material.vertexColors,
      lights: material.lights,
      clipping: material.clipping,
      extensions: JSON.stringify(material.extensions),
      glslVersion: material.glslVersion,
      stage: material.stage === undefined ? null : material.stage,
      hasOnBeforeCompile: typeof material.onBeforeCompile === 'function',
      hasCustomProgramCacheKey: typeof material.customProgramCacheKey === 'function'
    };
  }
  async function hashText(value) {
    if (!window.crypto || !window.crypto.subtle || typeof TextEncoder !== 'function') {
      throw new Error('R34 SHA-256 evidence needs WebCrypto and TextEncoder.');
    }
    const bytes = new TextEncoder().encode(value);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  async function evidence() {
    const candidate = candidateMaterials.get(selected);
    const fogKeys = Object.keys(original.uniforms).filter(key => /fog/i.test(key)).sort();
    const aliases = Object.fromEntries(Object.keys(original.uniforms).sort().map(key => [key,
      candidate.uniforms[key] === original.uniforms[key]]));
    const currentMeshFlags = {
      name: mesh.name,
      count: mesh.count,
      geometry: mesh.geometry && mesh.geometry.uuid,
      renderOrder: mesh.renderOrder,
      frustumCulled: mesh.frustumCulled,
      visible: mesh.visible,
      layersMask: mesh.layers && mesh.layers.mask,
      userData: JSON.stringify(mesh.userData)
    };
    const currentCandidateFlags = materialFlagSnapshot(candidate);
    const candidateUniformKeys = Object.keys(candidate.uniforms).sort();
    const flagNames = ['type', 'fog', 'side', 'transparent', 'depthTest', 'depthWrite', 'colorWrite', 'blending', 'toneMapped', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits', 'vertexColors', 'lights', 'clipping', 'extensions', 'glslVersion', 'stage'];
    const preservedFlags = Object.fromEntries(flagNames.map(name => [name, currentCandidateFlags[name] === initialFlags[name]]));
    const originalCacheKeyValue = originalCacheKey.call(original);
    const candidateCacheKeyValue = candidate.customProgramCacheKey();
    const originalHash = await hashText(originalVertex + '\n' + originalFragment);
    const candidateHash = await hashText(candidate.vertexShader + '\n' + candidate.fragmentShader);
    const anchorHashes = {};
    for (const [name, anchor] of anchors) anchorHashes[name] = await hashText(anchor);
    const pinnedTermHashes = {};
    for (const [name, term] of Object.entries(pinnedTerms)) pinnedTermHashes[name] = await hashText(term);
    return {
      schema: 'r34-interior-silhouette-installer-v1',
      offsetsM: ALLOWED_OFFSETS,
      selectedOffsetM: selected,
      selectedIsOriginal: mesh.material === original,
      restored,
      materialName: mesh.material && mesh.material.name,
      shaderHashes: { originalSha256: originalHash, rebuiltCandidateSha256: candidateHash },
      sourceLengths: { vertex: originalVertex.length, fragment: originalFragment.length, candidateFragment: candidateFragment.length },
      sourceAnchors: { counts: anchorCounts, sha256: anchorHashes, preservedTFTokenCounts: tfTokenCounts, sourcePinnedTermSha256: pinnedTermHashes, sourcePinnedTerms: pinnedTerms },
      silhouetteNoAtlasRead: !addedFunctionText.includes('texture2D') && !addedFunctionText.includes('texture('),
      composition: {
        base: '1-C',
        cheapSilhouette: 'C-T',
        existingTrace: 'T',
        screenGate: '1-screenActive*dim',
        screenException: 'Selected dim screens receive no added C-T silhouette contribution; their original screen path stays active.',
        lightingTerms: 'Runtime expressions are extracted from the live shader. The installer fails if an expected expression changes shape.'
      },
      original: { flags: initialFlags, uniformKeys: initialUniformKeys, vertexShader: originalVertex, fragmentShader: originalFragment },
      candidate: { flags: currentCandidateFlags, preservedFlags, uniformKeys: candidateUniformKeys, uniformAliases: aliases, fogUniformKeys: fogKeys, offsetUniform: OFFSET_UNIFORM, offsetValue: candidate.uniforms[OFFSET_UNIFORM].value },
      mesh: { original: meshFlags, current: currentMeshFlags, unchanged: JSON.stringify(meshFlags) === JSON.stringify(currentMeshFlags) },
      callbackForwarding: { onBeforeCompile: true, customProgramCacheKey: true, programCacheKey: { original: originalCacheKeyValue, candidate: candidateCacheKeyValue, keepsOriginalPrefix: candidateCacheKeyValue.startsWith(String(originalCacheKeyValue)) }, userDataShared: candidate.userData === original.userData, fogCopied: candidate.fog === original.fog, stageRoleOnMeshUnchanged: mesh.userData === initialMeshUserData && JSON.stringify(mesh.userData) === meshFlags.userData },
      cache: { candidateOffsetsM: Array.from(candidateMaterials.keys()), oneShaderSourceForAllOffsets: Array.from(candidateMaterials.values()).every(material => material.fragmentShader === candidateFragment), cloneCount: candidateMaterials.size }
    };
  }
  function dispose() {
    restore();
    for (const material of candidateMaterials.values()) material.dispose();
    if (window[KEY] === experiment) delete window[KEY];
    return { disposed: true, restored: mesh.material === original };
  }

  const experiment = Object.freeze({ select, selectRebuilt, restore, evidence, dispose });
  window[KEY] = experiment;
  return experiment;
}

const installSource = 'return (' + installInteriorExperiment.toString() + ')(app);';
const installSourceSha256 = crypto.createHash('sha256').update(installSource).digest('hex');
const offsetsM = Object.freeze([0, 150, 300, 450]);
module.exports = { installSource, installSourceSha256, offsetsM };
