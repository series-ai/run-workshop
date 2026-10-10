'use strict';
const fs=require('node:fs'),path=require('node:path');const R=require('./experiment-runtime.cjs');
const opt=R.args();if(!opt.url||!opt.out||!opt.cameras)throw Error('Use --url --out --cameras.');
function parseCameras(value, output) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.rows) || !value.rows.length) throw Error('Camera file needs rows.');
  const ids = new Set(), directory = path.resolve(output);
  const vector = (v, n, name) => {
    if (!Array.isArray(v) || v.length !== n || !v.every(Number.isFinite)) throw Error('Invalid ' + name + '.');
    return [...v];
  };
  const rows = value.rows.map(row => {
    if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(row.id) || ids.has(row.id)) throw Error('Camera IDs must be unique file names.');
    ids.add(row.id);
    const route = row.requestedRoutePositionM ?? row.routePositionM;
    if (!Number.isFinite(route)) throw Error('Camera route must be finite.');
    const c = row.camera;
    if (!c || typeof c !== 'object' || !Number.isFinite(c.fov) || c.fov <= 0 || c.fov >= 179 || !Number.isFinite(c.aspect) || c.aspect <= 0) throw Error('Invalid camera projection.');
    const position = vector(c.position, 3, 'position'), quaternion = vector(c.quaternion, 4, 'quaternion'), up = vector(c.up, 3, 'up');
    if (Math.abs(Math.hypot(...quaternion) - 1) > 0.001 || Math.hypot(...up) <= 0) throw Error('Invalid camera orientation.');
    const near = c.near ?? 1, far = c.far ?? 14000;
    if (!Number.isFinite(near) || !Number.isFinite(far) || near <= 0 || far <= near) throw Error('Invalid camera depth range.');
    const file = path.resolve(directory, row.id + '.png');
    if (path.dirname(file) !== directory) throw Error('Screenshot must stay in the output directory.');
    return { ...row, requestedRoutePositionM: route, camera: { ...c, position, quaternion, up, near, far } };
  });
  return { ...value, rows };
}
const cameras=parseCameras(JSON.parse(fs.readFileSync(opt.cameras,'utf8')),opt.out);
(async()=>{const unlock=R.gpuLock('R35 roofscape captures');let s;try{s=await R.open(opt.url,opt.out);const p=s.page,rows=[];
for(const row of cameras.rows){const target=Math.max(0,row.requestedRoutePositionM??row.routePositionM);const current=await p.evaluate(()=>window.__skyriver.scene.routePosition());if(target>current)await R.freezeAtRoute(p,target);else await p.evaluate(()=>window.__skyriver.suspend());
await p.evaluate(({camera,target})=>{const a=window.__skyriver,c=a.scene.camera;a.scene.setRoutePosition(target);c.position.set(...camera.position);c.quaternion.set(...camera.quaternion);c.up.set(...camera.up);c.fov=camera.fov;c.aspect=camera.aspect;c.updateProjectionMatrix();c.updateMatrixWorld(true);},{camera:row.camera,target});
await R.settle(p,24);const file=row.id+'.png';await p.screenshot({path:path.join(opt.out,file)});const evidence=await p.evaluate(()=>{const a=window.__skyriver,s=a.scene,c=s.city;return{phase:a.renderState(),routeM:s.routePosition(),stats:a.stats(),settings:s.renderSettings(),adapter:s.glDiagnostics(),trimCount:c.trimMesh.count,towerCount:c.towerMesh.count,roofDetail:typeof c.getRoofDetailEvidence==='function'?c.getRoofDetailEvidence():null,camera:{position:s.camera.position.toArray(),quaternion:s.camera.quaternion.toArray(),up:s.camera.up.toArray(),fov:s.camera.fov,aspect:s.camera.aspect},glError:s.renderer.getContext().getError()};});
rows.push({id:row.id,file,requested:row,evidence});}
R.write(path.join(opt.out,'captures.json'),{url:opt.url,rows,adapter:s.logs,errors:s.errors});console.log(JSON.stringify({rows:rows.map(r=>({id:r.id,calls:r.evidence.stats.drawCalls,trim:r.evidence.trimCount,towers:r.evidence.towerCount})),errors:s.errors}));if(s.errors.length||rows.some(r=>r.evidence.glError||r.evidence.stats.drawCalls>32))process.exitCode=1;
}finally{if(s)await s.browser.close();unlock();}})().catch(e=>{console.error(e);process.exitCode=1;});
