'use strict';
const fs = require('node:fs');
const path = require('node:path');
const R = require('./experiment-runtime.cjs');

const opt = R.args();
if (!opt.url || !opt.out || !opt.cameras) throw Error('Use --url, --out and --cameras.');
if (opt.masks !== undefined && !['true', 'false'].includes(opt.masks)) throw Error('Masks must be true or false.');
if (opt.masks === 'true' && opt.isolate !== 'true') throw Error('Masks need isolate true.');
if (opt.isolate !== undefined && !['true', 'false'].includes(opt.isolate)) throw Error('Isolate must be true or false.');

const minY = opt['min-y'] !== undefined ? Number(opt['min-y']) : null;
if (minY !== null && !Number.isFinite(minY)) throw Error('min-y must be a finite number.');

const input = JSON.parse(fs.readFileSync(opt.cameras, 'utf8'));
if (!input || !Array.isArray(input.rows) || !input.rows.length) throw Error('Camera file needs rows.');

const isR41 = input.version === 'r41-coverage-v1';
if (isR41 && minY !== 0) {
  throw Error('R41 capture requires explicit --min-y 0.');
}

const ids = new Set();
for (let idx = 0; idx < input.rows.length; idx++) {
  const row = input.rows[idx];
  if (!row || typeof row.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(row.id) || ids.has(row.id)) {
    throw Error('Invalid camera ID.');
  }
  ids.add(row.id);
  if (!Number.isInteger(row.seed) || row.seed < 0 || row.seed > 0xffffffff) {
    throw Error('Camera seed must be an unsigned 32-bit integer.');
  }
  const c = row.camera;
  const route = row.requestedRoutePositionM ?? row.routePositionM;
  if (!Number.isFinite(route) || !c) throw Error('Camera route must be finite.');

  for (const [key, length] of [['position', 3], ['quaternion', 4], ['up', 3]]) {
    if (!Array.isArray(c[key]) || c[key].length !== length || !c[key].every(Number.isFinite)) {
      throw Error('Invalid camera ' + key + '.');
    }
  }
  const near = c.near ?? 1;
  const far = c.far ?? 14000;
  if (!Number.isFinite(near) || !Number.isFinite(far) || near <= 0 || far <= near) {
    throw Error('Invalid camera depth range.');
  }
  if (opt.isolate === 'true' && !Number.isFinite(row.supportCanyon?.materialOwner)) {
    throw Error('Isolated audit needs a finite tower owner.');
  }
  if (Math.abs(Math.hypot(...c.quaternion) - 1) > 0.001 || Math.hypot(...c.up) === 0 || !(c.fov > 0 && c.fov < 179) || !(c.aspect > 0) || !Number.isFinite(c.fov) || !Number.isFinite(c.aspect)) {
    throw Error('Invalid camera projection.');
  }

  if (isR41) {
    if (row.id !== 'tower-' + idx + '-r41') {
      throw Error('Canonical ID must be tower-' + idx + '-r41; got ' + row.id);
    }
    if (!Number.isInteger(row.towerIndex) || row.towerIndex !== idx) {
      throw Error('Invalid or non-matching integer towerIndex at row ' + idx);
    }
    if (typeof row.key !== 'string' || !row.key) {
      throw Error('Mandatory canonical key missing at row ' + idx);
    }
    const st = row.sourceTower;
    if (!st || !Number.isFinite(st.x) || !Number.isFinite(st.z) || !Number.isFinite(st.width) || !Number.isFinite(st.depth) || !Number.isFinite(st.height) || !Number.isInteger(st.tint)) {
      throw Error('Complete sourceTower {x,z,width,depth,height,tint} mandatory at row ' + idx);
    }
    const exp = (row.requested && row.requested.expected) ? row.requested.expected : row.expected;
    if (!exp || !Array.isArray(exp.selectedRows) || !Array.isArray(exp.sourceIndices)) {
      throw Error('R41 requires expected.selectedRows and expected.sourceIndices at row ' + idx);
    }
    const expShaderSha = exp.vertexShaderSha256;
    if (typeof expShaderSha !== 'string' || !/^[0-9a-f]{64}$/.test(expShaderSha)) {
      throw Error('R41 requires expected.vertexShaderSha256 to be 64 lowercase hex chars at row ' + idx);
    }
  }
}

(async () => {
  const unlock = R.gpuLock('R36 fixed shape cameras');
  let run;
  try {
    run = await R.open(opt.url, opt.out);
    const rows = [];
    for (const row of input.rows) {
      await run.page.evaluate(({ camera: c, route }) => {
        const a = window.__skyriver, s = a.scene, camera = s.camera;
        a.suspend();
        s.setRoutePosition(route);
        camera.position.set(...c.position);
        camera.quaternion.set(...c.quaternion);
        camera.up.set(...c.up);
        camera.fov = c.fov;
        camera.aspect = c.aspect;
        camera.near = c.near ?? 1;
        camera.far = c.far ?? 14000;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
      }, { camera: row.camera, route: row.requestedRoutePositionM ?? row.routePositionM });

      await R.settle(run.page);

      // Re-apply frozen camera after settle to prevent alteration by s.update
      await run.page.evaluate(({ camera: c }) => {
        const s = window.__skyriver.scene, camera = s.camera;
        camera.position.set(...c.position);
        camera.quaternion.set(...c.quaternion);
        camera.up.set(...c.up);
        camera.fov = c.fov;
        camera.aspect = c.aspect;
        camera.near = c.near ?? 1;
        camera.far = c.far ?? 14000;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
      }, { camera: row.camera });

      const evidence = await run.page.evaluate(() => {
        const a = window.__skyriver, s = a.scene, c = s.camera;
        return {
          seed: s.city.layout.seed,
          source: a.renderState(),
          routeM: s.routePosition(),
          stats: a.stats(),
          settings: s.renderSettings(),
          adapter: s.glDiagnostics(),
          camera: {
            position: c.position.toArray(),
            quaternion: c.quaternion.toArray(),
            up: c.up.toArray(),
            fov: c.fov,
            aspect: c.aspect,
            near: c.near,
            far: c.far,
          },
          towers: s.city.towerMesh.count,
          towerCapacity: s.city.towerMesh.instanceMatrix.count,
          trims: s.city.trimMesh.count,
          trimCapacity: s.city.trimMesh.instanceMatrix.count,
          roofDetail: s.city.getRoofDetailEvidence(),
          glError: s.renderer.getContext().getError(),
        };
      });

      if (evidence.seed !== row.seed) throw Error('Camera seed differs from the actual city seed.');

      // Strict finite numeric equality across all 7 camera fields
      const cReq = row.camera;
      const cAct = evidence.camera;
      if (!Array.isArray(cAct.position) || !Array.isArray(cReq.position) || cAct.position.length !== 3 || cReq.position.length !== 3) {
        throw Error('Camera position must be an array of 3 numbers at ' + row.id);
      }
      for (let i = 0; i < 3; i++) {
        if (!Number.isFinite(cAct.position[i]) || !Number.isFinite(cReq.position[i]) || cAct.position[i] !== cReq.position[i]) {
          throw Error('Actual camera position differs at ' + row.id);
        }
      }

      if (!Array.isArray(cAct.quaternion) || !Array.isArray(cReq.quaternion) || cAct.quaternion.length !== 4 || cReq.quaternion.length !== 4) {
        throw Error('Camera quaternion must be an array of 4 numbers at ' + row.id);
      }
      for (let i = 0; i < 4; i++) {
        if (!Number.isFinite(cAct.quaternion[i]) || !Number.isFinite(cReq.quaternion[i]) || cAct.quaternion[i] !== cReq.quaternion[i]) {
          throw Error('Actual camera quaternion differs at ' + row.id);
        }
      }

      if (!Array.isArray(cAct.up) || !Array.isArray(cReq.up) || cAct.up.length !== 3 || cReq.up.length !== 3) {
        throw Error('Camera up must be an array of 3 numbers at ' + row.id);
      }
      for (let i = 0; i < 3; i++) {
        if (!Number.isFinite(cAct.up[i]) || !Number.isFinite(cReq.up[i]) || cAct.up[i] !== cReq.up[i]) {
          throw Error('Actual camera up differs at ' + row.id);
        }
      }

      if (!Number.isFinite(cAct.fov) || !Number.isFinite(cReq.fov) || cAct.fov !== cReq.fov) {
        throw Error('Actual camera fov differs at ' + row.id);
      }

      if (!Number.isFinite(cAct.aspect) || !Number.isFinite(cReq.aspect) || cAct.aspect !== cReq.aspect) {
        throw Error('Actual camera aspect differs at ' + row.id);
      }

      const reqNear = cReq.near ?? 1;
      if (!Number.isFinite(cAct.near) || !Number.isFinite(reqNear) || cAct.near !== reqNear) {
        throw Error('Actual camera near differs at ' + row.id);
      }

      const reqFar = cReq.far ?? 14000;
      if (!Number.isFinite(cAct.far) || !Number.isFinite(reqFar) || cAct.far !== reqFar) {
        throw Error('Actual camera far differs at ' + row.id);
      }

      if (rows.length > 0) {
        const firstEvidence = rows[0].evidence;
        if (evidence.source.current.tick !== firstEvidence.source.current.tick || evidence.source.alpha !== firstEvidence.source.alpha) {
          throw Error('Simulation tick or alpha differs across rows.');
        }
        for (const key of ['tier', 'pixelRatio', 'maxPixelRatio', 'roomMode', 'bloomEnabled', 'farMode']) {
          if (evidence.settings[key] !== firstEvidence.settings[key]) {
            throw Error('Render setting ' + key + ' differs across rows.');
          }
        }
      }

      let isolated = null;
      if (opt.isolate === 'true') {
        if (!Number.isFinite(row.supportCanyon?.materialOwner)) throw Error('Isolated audit needs the frozen tower owner.');
        isolated = await run.page.evaluate(({ reqRow, isR41Mode }) => {
          const s = window.__skyriver.scene;
          const original = s.city.towerMesh;
          const identity = original.geometry.getAttribute('aMaterial');
          let owner = reqRow.supportCanyon?.materialOwner;
          let actualIdentity = null;

          if (isR41Mode) {
            const towers = s.city.layout.towers;
            const towerIdx = reqRow.towerIndex;
            if (typeof towerIdx !== 'number' || towerIdx < 0 || towerIdx >= towers.length) {
              throw Error('Invalid towerIndex for r41 row: ' + towerIdx);
            }
            const actualTower = towers[towerIdx];
            function towerKey(t) { return `${t.x.toFixed(2)}:${t.z.toFixed(2)}`; }
            const actualKey = towerKey(actualTower);
            if (reqRow.key !== actualKey) {
              throw Error('Tower key mismatch for r41 row: expected ' + reqRow.key + ' actual ' + actualKey);
            }

            const st = reqRow.sourceTower;
            if (actualTower.x !== st.x || actualTower.z !== st.z || actualTower.width !== st.width ||
                actualTower.depth !== st.depth || actualTower.height !== st.height || actualTower.tint !== st.tint) {
              throw Error('Tower complete fields mismatch for r41 row: ' + reqRow.id);
            }

            function hash1(n) {
              const val = Math.sin(n * 127.1) * 43758.5453123;
              return val - Math.floor(val);
            }
            function buildingSeedOf(x, z) {
              return hash1(x * 0.0173 + z * 0.00411 + 0.5);
            }

            const rawBrowserOwner = buildingSeedOf(actualTower.x, actualTower.z);
            const canonicalFloat32Owner = Math.fround(rawBrowserOwner);

            if (owner !== canonicalFloat32Owner) {
              throw Error('Reject fabricated near-owner: requested ' + owner + ' !== canonical ' + canonicalFloat32Owner);
            }
            owner = canonicalFloat32Owner;

            actualIdentity = {
              towerIndex: towerIdx,
              key: actualKey,
              actualTower: {
                x: actualTower.x,
                z: actualTower.z,
                width: actualTower.width,
                depth: actualTower.depth,
                height: actualTower.height,
                tint: actualTower.tint,
              },
              rawBrowserOwner,
              canonicalFloat32Owner,
            };
          }

          const selected = [];
          if (isR41Mode) {
            for (let i = 0; i < original.count; i++) {
              if (identity.getX(i) === owner) selected.push(i);
            }
          } else {
            for (let i = 0; i < original.count; i++) {
              if (Math.abs(identity.getX(i) - owner) < 0.00000008) selected.push(i);
            }
          }
          if (!selected.length) throw Error('Tower has no actual uploaded rows.');

          const expectedRows = reqRow.expected?.selectedRows ?? reqRow.expectedSelectedRows;
          const expectedSourceIndices = reqRow.expected?.sourceIndices;
          const uploadedSourceIndices = selected.map(i => s.city.towerSourceIndices[i]);

          if (isR41Mode) {
            if (!expectedRows || selected.length !== expectedRows.length || !selected.every((val, idx) => val === expectedRows[idx])) {
              throw Error('Uploaded selected rows do not match frozen expected rows for ' + reqRow.id);
            }
            if (!expectedSourceIndices || uploadedSourceIndices.length !== expectedSourceIndices.length || !uploadedSourceIndices.every((val, idx) => val === expectedSourceIndices[idx])) {
              throw Error('Uploaded source indices do not match frozen expected source indices for ' + reqRow.id);
            }
          }

          const geometry = original.geometry.clone();
          const mesh = new original.constructor(geometry, original.material, selected.length);
          const attrSubarrays = {};
          for (const [name, attribute] of Object.entries(geometry.attributes)) {
            if (attribute.isInstancedBufferAttribute) {
              const before = attribute.array.slice();
              for (let i = 0; i < selected.length; i++) {
                attribute.array.set(before.subarray(selected[i] * attribute.itemSize, (selected[i] + 1) * attribute.itemSize), i * attribute.itemSize);
              }
              attribute.needsUpdate = true;
              attrSubarrays[name] = Array.from(attribute.array.subarray(0, selected.length * attribute.itemSize));
            }
          }
          for (let i = 0; i < selected.length; i++) {
            mesh.instanceMatrix.array.set(original.instanceMatrix.array.subarray(selected[i] * 16, (selected[i] + 1) * 16), i * 16);
          }
          mesh.instanceMatrix.needsUpdate = true;
          mesh.frustumCulled = false;
          const matrixSubarray = Array.from(mesh.instanceMatrix.array.subarray(0, selected.length * 16));

          const scene = new s.scene.constructor();
          scene.fog = s.scene.fog;
          const sky = s.scene.getObjectByName('skyriver.sky');
          if (!sky) throw Error('Actual sky mesh is unavailable.');
          scene.add(sky.clone());
          scene.add(mesh);

          const precedingCalls = s.renderer.info.render.calls;
          s.renderer.setRenderTarget(null);
          s.renderer.render(scene, s.camera);
          const calls = s.renderer.info.render.calls - precedingCalls;

          const result = {
            owner,
            identity: actualIdentity,
            actualSourceIndices: uploadedSourceIndices,
            selectedDrawRows: selected,
            expectedSelectedRows: expectedRows ?? selected,
            count: selected.length,
            calls,
            vertexShader: original.material.vertexShader,
            matrixData: matrixSubarray,
            attrData: attrSubarrays,
            protocol: 'Actual production geometry, instance attributes, material, world matrices, and sky. Other city objects hidden. Direct render without bloom or volume. The camera is the frozen 2km camera. This is a shape diagnostic, not a full-city visibility claim.'
          };
          window.__towerShapeDiagnostic = { scene, mesh, geometry };
          return result;
        }, { reqRow: row, isR41Mode: isR41 });

        if (isolated.calls !== 2) throw Error('Isolated draw calls must be 2; actual ' + isolated.calls);

        const matrixBuffer = Float32Array.from(isolated.matrixData).buffer;
        const matrixSha256 = R.sha(Buffer.from(matrixBuffer));
        const attributeHashes = {};
        for (const [name, arr] of Object.entries(isolated.attrData)) {
          const buf = Float32Array.from(arr).buffer;
          attributeHashes[name] = R.sha(Buffer.from(buf));
        }
        const vertexShaderBytes = Buffer.byteLength(isolated.vertexShader, 'utf8');
        const vertexShaderSha256 = R.sha(isolated.vertexShader);

        if (isR41) {
          const exp = (row.requested && row.requested.expected) ? row.requested.expected : row.expected;
          if (exp?.matrixSha256 && matrixSha256 !== exp.matrixSha256) {
            throw Error('Matrix SHA mismatch for ' + row.id);
          }
          if (exp?.attributeHashes) {
            for (const [k, expH] of Object.entries(exp.attributeHashes)) {
              if (attributeHashes[k] !== expH) {
                throw Error('Attribute hash mismatch for ' + k + ' at ' + row.id);
              }
            }
          }
          if (typeof exp?.vertexShaderSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(exp.vertexShaderSha256)) {
            throw Error('R41 requires expected.vertexShaderSha256 to be 64 lowercase hex chars at ' + row.id);
          }
          if (vertexShaderSha256 !== exp.vertexShaderSha256) {
            throw Error('Vertex shader SHA mismatch for ' + row.id);
          }
        }

        isolated.matrixSha256 = matrixSha256;
        isolated.attributeHashes = attributeHashes;
        isolated.vertexShaderBytes = vertexShaderBytes;
        isolated.vertexShaderSha256 = vertexShaderSha256;
        isolated.expected = (row.requested && row.requested.expected) ? row.requested.expected : row.expected;
        delete isolated.matrixData;
        delete isolated.attrData;
      }

      const file = row.id + '.png';
      await run.page.screenshot({ path: path.join(opt.out, file) });

      let mask = null;
      if (opt.masks === 'true') {
        mask = await run.page.evaluate(({ minYVal }) => {
          const s = window.__skyriver.scene, d = window.__towerShapeDiagnostic;
          const originalMaterial = d.mesh.material;
          const maskMaterial = originalMaterial.clone();

          if (minYVal !== null) {
            maskMaterial.fragmentShader = `
              varying vec3 vWorldPos;
              void main() {
                if (vWorldPos.y < ${minYVal.toFixed(6)}) discard;
                gl_FragColor = vec4(1.0);
              }
            `;
          } else {
            maskMaterial.fragmentShader = 'void main() { gl_FragColor = vec4(1.0); }';
          }
          maskMaterial.fog = false;
          maskMaterial.toneMapped = false;
          maskMaterial.needsUpdate = true;
          d.mesh.material = maskMaterial;

          for (const child of [...d.scene.children]) if (child !== d.mesh) d.scene.remove(child);
          window.__towerShapeClearColour ??= Object.values(s.city.towerMaterial.uniforms).find(u => u.value?.isColor)?.value.clone();
          if (!window.__towerShapeClearColour) throw Error('No current Color value found.');
          const oldColour = s.renderer.getClearColor(window.__towerShapeClearColour).clone(), oldAlpha = s.renderer.getClearAlpha();
          const previousCalls = s.renderer.info.render.calls;
          s.renderer.setRenderTarget(null);
          s.renderer.setClearColor(0x000000, 1);
          s.renderer.clear();
          s.renderer.render(d.scene, s.camera);
          s.renderer.setClearColor(oldColour, oldAlpha);
          const calls = s.renderer.info.render.calls - previousCalls;
          const glError = s.renderer.getContext().getError();

          d.mesh.material = originalMaterial;
          maskMaterial.dispose();

          return {
            calls,
            glError,
            scope: {
              minY: minYVal,
              version: 'r41-coverage-v1',
            },
            minY: minYVal,
            protocol: 'White coverage mask. Actual production vertex shader, geometry, instance attributes, matrices and camera. Only the fragment output changes. No sky, bloom or fog. Other buildings hidden.'
          };
        }, { minYVal: minY });
      }

      if (mask && (mask.glError || mask.calls !== 1)) throw Error('Invalid mask draw.');
      if (mask) {
        const hiddenHud = await run.page.addStyleTag({ content: '[class^="skyriver-hud"], [class*=" skyriver-hud"] { visibility: hidden !important; }' });
        mask.file = row.id + '-mask.png';
        await run.page.locator('canvas').first().screenshot({ path: path.join(opt.out, mask.file) });
        await hiddenHud.evaluate(element => element.remove());
      }

      if (isolated) {
        await run.page.evaluate(() => {
          const d = window.__towerShapeDiagnostic;
          if (d) {
            if (d.geometry) d.geometry.dispose();
            if (d.mesh) d.mesh.dispose();
            delete window.__towerShapeDiagnostic;
          }
        });
      }

      rows.push({
        id: row.id,
        file,
        requested: row,
        actualSourceIndices: isolated?.actualSourceIndices,
        evidence,
        isolated,
        mask,
      });
    }

    R.write(path.join(opt.out, 'captures.json'), {
      url: opt.url,
      protocol: 'Fixed source pose. Set each diagnostic camera and route directly. No autopilot, route seeking or backward simulation.',
      minY,
      version: isR41 ? 'r41-coverage-v1' : undefined,
      rows,
      adapterLogs: run.logs,
      errors: run.errors,
    });

    console.log(JSON.stringify({
      out: opt.out,
      rows: rows.map(r => ({ id: r.id, calls: r.evidence.stats.drawCalls, towers: r.evidence.towers, trims: r.evidence.trims })),
      errors: run.errors,
    }));

    if (run.errors.length || rows.some(r => r.evidence.glError || r.evidence.stats.drawCalls > 32)) process.exitCode = 1;
  } finally {
    if (run) await run.browser.close();
    unlock();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
