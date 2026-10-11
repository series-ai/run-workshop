'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const esbuild = require('esbuild');
const R = require('./experiment-runtime.cjs');

const opt = R.args();
if (!opt.url || !opt.out) {
  throw new Error('Use --url and --out.');
}

let outFile = path.resolve(opt.out);
if (!outFile.endsWith('.json')) {
  if (fs.existsSync(outFile) && fs.statSync(outFile).isDirectory()) {
    outFile = path.join(outFile, 'cameras.json');
  }
}
if (fs.existsSync(outFile)) {
  throw new Error('Output file already exists: ' + outFile);
}

const unlock = R.gpuLock('R41 tower cohort camera generator');
let run;

(async () => {
  try {
    const canyonPath = path.resolve(__dirname, '../../src/render/canyonWarp.ts');
    const bundle = esbuild.buildSync({
      entryPoints: [canyonPath],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      write: false,
      logLevel: 'silent',
    });
    const canyonCode = bundle.outputFiles[0].text;

    run = await R.open(opt.url, path.dirname(outFile));
    await run.page.evaluate(() => window.__skyriver.suspend());

    const result = await run.page.evaluate(({ canyonCodeText }) => {
      const a = window.__skyriver;
      const s = a.scene;
      const layout = s.city.layout;

      if (!layout || layout.seed !== 424242) {
        throw new Error('Seed must be 424242.');
      }
      const towers = layout.towers;
      if (!Array.isArray(towers) || towers.length !== 211) {
        throw new Error('Layout must contain exactly 211 towers.');
      }

      const canyonModule = { exports: {} };
      new Function('module', 'exports', canyonCodeText)(canyonModule, canyonModule.exports);
      const { canyonHeading } = canyonModule.exports;

      function hash1(n) {
        const s = Math.sin(n * 127.1) * 43758.5453123;
        return s - Math.floor(s);
      }
      function buildingSeedOf(x, z) {
        return hash1(x * 0.0173 + z * 0.00411 + 0.5);
      }
      function towerKey(t) {
        return `${t.x.toFixed(2)}:${t.z.toFixed(2)}`;
      }

      const towerMesh = s.city.towerMesh;
      const aMaterial = towerMesh.geometry.getAttribute('aMaterial');
      const towerSourceIndices = s.city.towerSourceIndices;
      const count = towerMesh.count;

      const seenOwners = new Set();
      const towerEntries = [];
      const tempMatrix = s.camera.matrix.clone();

      const localCorners = [
        [-0.5, -0.5],
        [-0.5, 0.5],
        [0.5, -0.5],
        [0.5, 0.5],
      ];

      for (let towerIndex = 0; towerIndex < towers.length; towerIndex++) {
        const tower = towers[towerIndex];
        const key = towerKey(tower);
        const rawOwner = buildingSeedOf(tower.x, tower.z);
        const exactFloat32 = Math.fround(rawOwner);

        if (seenOwners.has(exactFloat32)) {
          throw new Error('Duplicate material owner: ' + exactFloat32);
        }
        seenOwners.add(exactFloat32);

        const selectedDrawRows = [];
        for (let i = 0; i < count; i++) {
          if (aMaterial.getX(i) === exactFloat32) {
            selectedDrawRows.push(i);
          }
        }

        if (selectedDrawRows.length < 1) {
          throw new Error('Tower ' + towerIndex + ' has no uploaded rows.');
        }

        const sourceIndices = selectedDrawRows.map(i => towerSourceIndices[i]);

        // Collect instance matrix floats for selected rows
        const matrixFloats = [];
        for (let i = 0; i < selectedDrawRows.length; i++) {
          const rowIdx = selectedDrawRows[i];
          const sub = towerMesh.instanceMatrix.array.subarray(rowIdx * 16, (rowIdx + 1) * 16);
          for (let k = 0; k < 16; k++) matrixFloats.push(sub[k]);
        }

        // Collect every instanced attribute floats for selected rows
        const attrFloats = {};
        for (const [name, attr] of Object.entries(towerMesh.geometry.attributes)) {
          if (attr.isInstancedBufferAttribute) {
            const vals = [];
            for (let i = 0; i < selectedDrawRows.length; i++) {
              const rowIdx = selectedDrawRows[i];
              const sub = attr.array.subarray(rowIdx * attr.itemSize, (rowIdx + 1) * attr.itemSize);
              for (let k = 0; k < attr.itemSize; k++) vals.push(sub[k]);
            }
            attrFloats[name] = vals;
          }
        }

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let minZ = Infinity;
        let maxZ = -Infinity;
        const corners = [];

        for (const rowIdx of selectedDrawRows) {
          towerMesh.getMatrixAt(rowIdx, tempMatrix);
          const e = tempMatrix.elements;
          const yMinBox = e[13] - 0.5 * e[5];
          const yMaxBox = e[13] + 0.5 * e[5];
          if (yMaxBox <= 0) continue;

          const y0 = Math.max(0, yMinBox);
          const y1 = yMaxBox;

          for (const [lx, lz] of localCorners) {
            const wx = e[12] + e[0] * lx + e[8] * lz;
            const wz = e[14] + e[2] * lx + e[10] * lz;

            corners.push([wx, y0, wz]);
            corners.push([wx, y1, wz]);

            minX = Math.min(minX, wx);
            maxX = Math.max(maxX, wx);
            minZ = Math.min(minZ, wz);
            maxZ = Math.max(maxZ, wz);
          }
          minY = Math.min(minY, y0);
          maxY = Math.max(maxY, y1);
        }

        if (corners.length === 0) {
          throw new Error('Tower ' + towerIndex + ' has no volume above Y0.');
        }

        const centerX = (minX + maxX) * 0.5;
        const centerY = (minY + maxY) * 0.5;
        const centerZ = (minZ + maxZ) * 0.5;

        const heading = canyonHeading(tower.z);
        const camAngle = heading + Math.PI * 0.25;
        const camDist = 2000.0;
        const camX = centerX + camDist * Math.sin(camAngle);
        const camY = centerY;
        const camZ = centerZ + camDist * Math.cos(camAngle);

        towerEntries.push({
          towerIndex,
          id: `tower-${towerIndex}-r41`,
          seed: 424242,
          key,
          sourceTower: {
            x: tower.x,
            z: tower.z,
            width: tower.width,
            depth: tower.depth,
            height: tower.height,
            tint: tower.tint,
          },
          rangeM: 2000,
          requestedRoutePositionM: tower.z,
          supportCanyon: {
            materialOwner: exactFloat32,
            exactFloat32,
            rawOwner,
          },
          bounds: {
            min: [minX, minY, minZ],
            max: [maxX, maxY, maxZ],
            center: [centerX, centerY, centerZ],
          },
          cameraPos: [camX, camY, camZ],
          cameraTarget: [centerX, centerY, centerZ],
          heading,
          selectedDrawRows,
          sourceIndices,
          corners,
          matrixFloats,
          attrFloats,
        });
      }

      // Calculate common FOV with at least 10% NDC margin across all 211 towers
      const aspect = 1280 / 720;
      const marginFactor = 0.90;
      let maxTanHalfFov = 0;

      const evalCamera = new s.camera.constructor(60, aspect, 1, 14000);
      const tempVec = s.camera.position.clone();

      for (const entry of towerEntries) {
        evalCamera.position.set(...entry.cameraPos);
        evalCamera.up.set(0, 1, 0);
        evalCamera.lookAt(entry.cameraTarget[0], entry.cameraTarget[1], entry.cameraTarget[2]);
        evalCamera.updateMatrixWorld(true);
        evalCamera.matrixWorldInverse.copy(evalCamera.matrixWorld).invert();

        for (const [cx, cy, cz] of entry.corners) {
          tempVec.set(cx, cy, cz);
          tempVec.applyMatrix4(evalCamera.matrixWorldInverse);
          const depth = -tempVec.z;
          if (depth <= 1.0) {
            throw new Error('Camera corner depth <= near clipping plane for ' + entry.id);
          }

          const tanY = Math.abs(tempVec.y) / (depth * marginFactor);
          const tanX = Math.abs(tempVec.x) / (depth * aspect * marginFactor);
          maxTanHalfFov = Math.max(maxTanHalfFov, tanY, tanX);
        }
      }

      const minFovDeg = 2 * Math.atan(maxTanHalfFov) * (180 / Math.PI);
      const commonFov = Math.ceil(minFovDeg * 10) / 10;

      // Build rows with final camera orientation and projection
      evalCamera.fov = commonFov;
      evalCamera.aspect = aspect;
      evalCamera.near = 1;
      evalCamera.far = 14000;
      evalCamera.updateProjectionMatrix();

      const rows = [];
      const rawEntries = [];
      for (const entry of towerEntries) {
        evalCamera.position.set(...entry.cameraPos);
        evalCamera.up.set(0, 1, 0);
        evalCamera.lookAt(entry.cameraTarget[0], entry.cameraTarget[1], entry.cameraTarget[2]);
        evalCamera.updateMatrixWorld(true);

        const q = evalCamera.quaternion;
        const p = evalCamera.position;
        const u = evalCamera.up;

        // Verify NDC bounds
        evalCamera.matrixWorldInverse.copy(evalCamera.matrixWorld).invert();
        for (const [cx, cy, cz] of entry.corners) {
          tempVec.set(cx, cy, cz);
          tempVec.applyMatrix4(evalCamera.matrixWorldInverse);
          tempVec.applyMatrix4(evalCamera.projectionMatrix);
          if (Math.abs(tempVec.x) > 0.9001 || Math.abs(tempVec.y) > 0.9001) {
            throw new Error('Corner outside NDC margin for ' + entry.id);
          }
        }

        rows.push({
          id: entry.id,
          seed: entry.seed,
          towerIndex: entry.towerIndex,
          key: entry.key,
          sourceTower: entry.sourceTower,
          rangeM: entry.rangeM,
          requestedRoutePositionM: entry.requestedRoutePositionM,
          supportCanyon: entry.supportCanyon,
          camera: {
            position: [p.x, p.y, p.z],
            quaternion: [q.x, q.y, q.z, q.w],
            up: [u.x, u.y, u.z],
            fov: commonFov,
            aspect,
            near: 1,
            far: 14000,
          },
          expected: {
            selectedRows: entry.selectedDrawRows,
            sourceIndices: entry.sourceIndices,
            count: entry.selectedDrawRows.length,
          },
          expectedSelectedRows: entry.selectedDrawRows,
          bounds: entry.bounds,
        });

        rawEntries.push({
          matrixFloats: entry.matrixFloats,
          attrFloats: entry.attrFloats,
        });
      }

      // Freeze 137 subset
      const selected137Indices = [];
      for (let k = 0; k < 137; k++) {
        selected137Indices.push(Math.floor(k * 211 / 137));
      }
      const selected137Ids = selected137Indices.map(idx => rows[idx].id);

      return {
        rows,
        rawEntries,
        selected137: {
          rule: 'floor(k * 211 / 137) for k in 0..136',
          count: 137,
          indices: selected137Indices,
          ids: selected137Ids,
        },
        commonFov,
        source: a.renderState(),
        render: s.renderSettings(),
        adapter: s.glDiagnostics(),
        glError: s.renderer.getContext().getError(),
        drawCalls: a.stats().drawCalls,
        cache: {
          towerMeshCount: s.city.towerMesh.count,
          trimMeshCount: s.city.trimMesh.count,
          geometryIdentity: s.city.geometryIdentity(),
        },
        vertexShader: s.city.towerMaterial.vertexShader,
      };
    }, { canyonCodeText: canyonCode });

    if (run.errors && run.errors.length > 0) {
      throw new Error('Browser recorded errors: ' + JSON.stringify(run.errors));
    }
    if (result.glError !== 0) {
      throw new Error('GL error occurred: ' + result.glError);
    }
    if (result.drawCalls > 32) {
      throw new Error('Draw calls exceeded budget 32: ' + result.drawCalls);
    }

    const vertexShaderBytes = Buffer.byteLength(result.vertexShader, 'utf8');
    const vertexShaderSha256 = R.sha(result.vertexShader);

    const sidecarRows = [];
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i];
      const entry = result.rawEntries[i];

      const matrixBuf = Float32Array.from(entry.matrixFloats).buffer;
      const matrixSha256 = R.sha(Buffer.from(matrixBuf));

      const attributeHashes = {};
      for (const [name, floats] of Object.entries(entry.attrFloats)) {
        const attrBuf = Float32Array.from(floats).buffer;
        attributeHashes[name] = R.sha(Buffer.from(attrBuf));
      }

      row.expected.matrixSha256 = matrixSha256;
      row.expected.attributeHashes = attributeHashes;
      row.expected.vertexShaderSha256 = vertexShaderSha256;

      sidecarRows.push({
        id: row.id,
        towerIndex: row.towerIndex,
        selectedRows: row.expected.selectedRows,
        sourceIndices: row.expected.sourceIndices,
        matrixFloats: entry.matrixFloats,
        attributeFloats: entry.attrFloats,
      });
    }

    // Save sibling sidecar file
    const sidecarFile = path.join(path.dirname(outFile), 'raw-source-bytes.json');
    if (fs.existsSync(sidecarFile)) {
      throw new Error('Sidecar file already exists: ' + sidecarFile);
    }
    fs.writeFileSync(sidecarFile, JSON.stringify({
      protocol: 'Raw source bytes sidecar for R41 independent verification.',
      rows: sidecarRows,
    }, null, 2) + '\n', { flag: 'wx' });

    const outputData = {
      protocol: 'R41 tower cohort camera definitions. Fixed 2km camera at bound centerY, 45 degree oblique to canyon heading. Unit box matrix bounds above Y0.',
      version: 'r41-coverage-v1',
      seed: 424242,
      totalRows: result.rows.length,
      commonFov: result.commonFov,
      selected137: result.selected137,
      evidence: {
        source: result.source,
        render: result.render,
        adapter: result.adapter,
        glError: result.glError,
        drawCalls: result.drawCalls,
        cache: result.cache,
        vertexShaderBytes,
        vertexShaderSha256,
      },
      rows: result.rows,
    };

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(outputData, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({
      out: outFile,
      sidecar: sidecarFile,
      totalRows: result.rows.length,
      selected137Count: result.selected137.ids.length,
      commonFov: result.commonFov,
      glError: result.glError,
      drawCalls: result.drawCalls,
    }));
  } finally {
    if (run) await run.browser.close();
    unlock();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
