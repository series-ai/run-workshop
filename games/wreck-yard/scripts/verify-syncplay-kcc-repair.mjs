// Compile and verify the proposed SDK repair in a temporary directory.
// Run with --sdk-source=<movement3d-revision1.ts> and --keep to retain the module.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transform } from 'esbuild';
import { initPhysics3D, createPhysicsWorld3D, meters, metersPerSecondSquared, vec3 } from '@series-inc/rundot-syncplay/physics/3d';

const argument = (name) => process.argv.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
const sourceArgument = argument('--sdk-source');
if (!sourceArgument) throw new Error('Use --sdk-source=<path to movement3d-revision1.ts>.');
const keep = process.argv.includes('--keep');
const project = dirname(dirname(fileURLToPath(import.meta.url)));
const sdkDist = new URL('.', import.meta.resolve('@series-inc/rundot-syncplay/browser'));
const originalSource = readFileSync(resolve(sourceArgument), 'utf8');
const patch = readFileSync(join(project, 'docs/patches/syncplay-rc39-kcc-standing.patch'), 'utf8');
const originalRuntime = readFileSync(new URL('movement3d-revision1.js', sdkDist));
const temporary = mkdtempSync(join(tmpdir(), 'syncplay-kcc-repair-'));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const runtimeDigest = digest(originalRuntime);
const require = createRequire(import.meta.url);

function command(file, args, cwd = temporary) {
  const result = spawnSync(file, args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed: ${file}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

try {
  const relativeSource = 'packages/syncplay/src/movement3d-revision1.ts';
  const stagedSource = join(temporary, relativeSource);
  mkdirSync(dirname(stagedSource), { recursive: true });
  writeFileSync(stagedSource, originalSource);
  const stagedPatch = join(temporary, 'repair.patch');
  writeFileSync(stagedPatch, patch);
  command('git', ['apply', '--check', stagedPatch]);
  command('git', ['apply', stagedPatch]);
  const typedSource = readFileSync(stagedSource, 'utf8').replace(/from '\.\/([^']+)'/g,
    (_match, relative) => `from ${JSON.stringify(fileURLToPath(new URL(relative, sdkDist)))}`);
  const isolatedSource = join(temporary, 'repair.mts');
  writeFileSync(isolatedSource, typedSource);
  command(process.execPath, [require.resolve('typescript/bin/tsc'), '--noEmit', '--strict', '--skipLibCheck',
    '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', isolatedSource]);
  const compiled = await transform(typedSource, { loader: 'ts', format: 'esm', target: 'es2022' });
  const repairModule = join(temporary, 'repair.mjs');
  writeFileSync(repairModule, compiled.code);
  const originalModuleUrl = pathToFileURL(fileURLToPath(new URL('movement3d-revision1.js', sdkDist))).href;
  const repairModuleUrl = pathToFileURL(repairModule).href;
  const loaderModule = join(temporary, 'loader.mjs');
  const registerModule = join(temporary, 'register.mjs');
  writeFileSync(loaderModule, `// This hook is for verification only.
const original = ${JSON.stringify(originalModuleUrl)};
const repair = ${JSON.stringify(repairModuleUrl)};
export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  return result.url === original ? { ...result, url: repair, shortCircuit: true } : result;
}
`);
  writeFileSync(registerModule, `// This hook is for verification only.
import * as nodeModule from 'node:module';
const original = ${JSON.stringify(originalModuleUrl)};
const repair = ${JSON.stringify(repairModuleUrl)};
if (typeof nodeModule.registerHooks === 'function') {
  nodeModule.registerHooks({ resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context);
    return result.url === original ? { ...result, url: repair, shortCircuit: true } : result;
  } });
} else {
  nodeModule.register(new URL('./loader.mjs', import.meta.url), import.meta.url);
}
`);
  const { stepDeterministicKccRevision1_3D } = await import(pathToFileURL(repairModule).href);
  await initPhysics3D();

  const BOUNDS={minX:-20,maxX:20,minY:-10,maxY:40,minZ:-20,maxZ:20,maxSlopeRisePerUnit:.8,stepHeight:.5};
  const GEOMETRY={radius:.4,halfHeight:.5,skinWidth:.005};
  const PROBE={type:'capsule',radius:meters(.405),halfHeight:meters(.505)};
  const pose=(x=0,y=.9101,z=0)=>({...GEOMETRY,x,y,z,vx:0,vy:0,vz:0,grounded:true,coyoteFrames:0,jumpBufferFrames:0});
  const box=(key,position,halfExtents,extra={})=>({key,kind:'static',position:vec3(meters,position),shape:{type:'box',halfX:meters(halfExtents[0]),halfY:meters(halfExtents[1]),halfZ:meters(halfExtents[2])},...extra});
  const floor=box('floor',[0,-.1,0],[10,.1,10]);
  const wall=box('wall',[0,1.5,0],[.1,1.5,10]);
  function open(bodies){
   const raw=createPhysicsWorld3D({tickRate:30,initialGravity:vec3(metersPerSecondSquared,0,0,0),capacity:{bodies:16,joints:0}});
   const handles=raw.edit(edit=>bodies.map(body=>edit.createBody(body))).created;
   const counts={native:0,step:0};
   const physics=new Proxy({},{get(_target,key){const target=raw;const value=Reflect.get(target,key);if(['raycast','overlap','shapeCast'].includes(key))return(...args)=>{counts.native++;return value.apply(target,args)};return typeof value==='function'?value.bind(target):value;}});
   return {raw,physics,handles,counts};
  }
  function step(open,body,input,options={}) {
   open.counts.native=0;
   const result=stepDeterministicKccRevision1_3D(body,input,BOUNDS,{frame:open.counts.step++,physics:open.physics,groundOnStaticBodies:true,standOnDynamicBodies:true,...options},options.gravityPerFrame??-.015,'required');
   assert.equal(result.physicsQueryCount,open.counts.native,'Every native query must be in the query count.');
   return result;
  }
  function noOverlap(open,body){assert.equal(open.raw.overlap({shape:PROBE,x:meters(body.x),y:meters(body.y),z:meters(body.z),hitTriggers:false,hitSensors:false,layerMask:15,maxPortalDepth:0}).length,0)}
  const reports=[];
  function check(name,fn){fn();reports.push({case:name,result:'pass'})}
  check('walking-into-wall-cannot-recover-forward-target',()=>{
   const w=open([floor,wall]);try{let body=pose(-1.2);for(let frame=0;frame<80;frame++){w.raw.step();body=step(w,body,{moveX:.08,moveZ:0}).body;assert.ok(body.x<-.505);noOverlap(w,body)}}finally{w.raw.dispose()}
  });
  check('fast-wall-crossing-uses-existing-sweep',()=>{
   const w=open([floor,wall]);try{w.raw.step();const result=step(w,pose(-3),{moveX:6,moveZ:0});assert.ok(result.body.x<0);assert.ok(result.events.includes('physics-sweep'));noOverlap(w,result.body)}finally{w.raw.dispose()}
  });
  check('diagonal-wall-contact-allows-tangent-motion',()=>{
   const w=open([floor,wall]);try{let body=pose(-.6);for(let frame=0;frame<20;frame++){w.raw.step();body=step(w,body,{moveX:.08,moveZ:.08}).body;assert.ok(body.x<-.505);noOverlap(w,body)}assert.ok(body.z>1.4)}finally{w.raw.dispose()}
  });
  check('existing-wall-penetration-recovers-before-motion',()=>{
   const w=open([floor,wall]);try{w.raw.step();const result=step(w,pose(-.4),{moveX:.08,moveZ:0});assert.ok(result.body.x<-.505);noOverlap(w,result.body)}finally{w.raw.dispose()}
  });
  check('existing-ceiling-penetration-recovers-downward',()=>{
   const w=open([floor,box('ceiling',[0,2.6,0],[3,.1,3])]);try{w.raw.step();const result=step(w,pose(0,1.65),{moveX:0,moveZ:0},{gravityPerFrame:0});assert.ok(result.body.y<=1.59001);noOverlap(w,result.body)}finally{w.raw.dispose()}
  });
  check('walking-below-ceiling-does-not-move-to-roof',()=>{
   const w=open([floor,box('ceiling',[0,2.01,0],[3,.1,3])]);try{let body=pose(-2);for(let frame=0;frame<30;frame++){w.raw.step();body=step(w,body,{moveX:.04,moveZ:0}).body;assert.ok(Math.abs(body.y-.9101)<1e-8);noOverlap(w,body)}}finally{w.raw.dispose()}
  });
  for(const flag of ['sensor','trigger'])check(`${flag}-body-does-not-correct-or-support`,()=>{
   const w=open([box(flag,[0,0,0],[1,1,1],{[flag]:true})]);try{w.raw.step();const result=step(w,pose(0,.5),{moveX:.04,moveZ:0},{gravityPerFrame:0});assert.equal(result.correctionCount,0);assert.equal(result.body.grounded,false);assert.ok(Math.abs(result.body.x-.04)<1e-8);assert.equal(result.collisionFilterCalls,0)}finally{w.raw.dispose()}
  });
  check('ignored-body-does-not-correct-or-support',()=>{
   const w=open([box('ignored',[0,0,0],[1,1,1])]);try{w.raw.step();const result=step(w,pose(0,.5),{moveX:.04,moveZ:0},{gravityPerFrame:0,ignoredPhysicsBodyIds:[w.handles[0].id]});assert.equal(result.correctionCount,0);assert.equal(result.body.grounded,false);assert.ok(Math.abs(result.body.x-.04)<1e-8)}finally{w.raw.dispose()}
  });
  check('rejected-body-does-not-correct-or-support',()=>{
   const w=open([box('filtered',[0,0,0],[1,1,1])]);let calls=0;try{w.raw.step();const filter={id:'reject',order:0,shouldCollide:()=>{calls++;return false}};const result=step(w,pose(0,.5),{moveX:.04,moveZ:0},{gravityPerFrame:0,collisionFilters:[filter]});assert.equal(result.correctionCount,0);assert.equal(result.body.grounded,false);assert.ok(Math.abs(result.body.x-.04)<1e-8);assert.equal(result.collisionFilterCalls,calls);assert.equal(result.collisionFilterRejectedHits,calls)}finally{w.raw.dispose()}
  });
  check('filter-state-mutation-is-rejected',()=>{
   const w=open([box('filtered',[0,0,0],[1,1,1])]);try{const filter={id:'mutates',order:0,count:0,shouldCollide(){this.count++;return true}};assert.throws(()=>step(w,pose(0,.5),{moveX:0,moveZ:0},{gravityPerFrame:0,collisionFilters:[filter]}),/Nondeterministic KCC collision filter state mutation/)}finally{w.raw.dispose()}
  });
  check('duplicate-filter-ids-are-rejected',()=>{
   const w=open([floor]);try{const filter={id:'duplicate',order:0,shouldCollide:()=>true};assert.throws(()=>step(w,pose(),{moveX:0,moveZ:0},{collisionFilters:[filter,filter]}),/Duplicate deterministic KCC collision filter/)}finally{w.raw.dispose()}
  });
  check('outside-collision-layer-does-not-correct-or-support',()=>{
   const w=open([box('filtered-layer',[0,0,0],[1,1,1],{layer:16})]);try{const result=step(w,pose(0,.5),{moveX:.04,moveZ:0},{gravityPerFrame:0});assert.equal(result.correctionCount,0);assert.equal(result.body.grounded,false);assert.ok(Math.abs(result.body.x-.04)<1e-8)}finally{w.raw.dispose()}
  });
  check('body-and-child-ties-repeat-with-same-checksum',()=>{
   const child={shape:{type:'box',halfX:meters(1),halfY:meters(1),halfZ:meters(1)},offset:vec3(meters,0,0,0)};
   const compound={kind:'static',shape:{type:'compound',children:[child,child]},position:vec3(meters,0,0,0)};
   const w=open([{...compound,key:'first'},{...compound,key:'second'}]);try{const initial=pose(-1.3,.5);const options={frame:1,physics:w.physics,groundOnStaticBodies:false,standOnDynamicBodies:false};let checksum;for(let i=0;i<5;i++){w.counts.native=0;const result=stepDeterministicKccRevision1_3D(initial,{moveX:0,moveZ:0},BOUNDS,options,0,'required');assert.equal(result.physicsQueryCount,w.counts.native);noOverlap(w,result.body);checksum??=result.checksum;assert.equal(result.checksum,checksum);assert.ok(result.body.x< -1.405)}}finally{w.raw.dispose()}
  });
  check('filter-order-is-stable-by-order-and-id',()=>{
   const w=open([floor,wall]);const observed=[];try{const filters=[{id:'b',order:0,shouldCollide:()=>{observed.push('b');return true}},{id:'a',order:0,shouldCollide:()=>{observed.push('a');return true}}];step(w,pose(-.4),{moveX:0,moveZ:0},{collisionFilters:filters});assert.ok(observed.length>0);for(let i=0;i<observed.length;i+=2)assert.deepEqual(observed.slice(i,i+2),['a','b'])}finally{w.raw.dispose()}
  });
  check('deep-existing-overlap-cannot-cross-a-separate-clear-wall',()=>{
   const w=open([box('embedded',[0,0,0],[2,5,5]),box('clear-wall',[1.9,0,0],[.05,5,5])]);
   try {const result=step(w,pose(1,0),{moveX:0,moveZ:0},{gravityPerFrame:0,groundOnStaticBodies:false,standOnDynamicBodies:false});
    assert.ok(result.body.x<1.44501);const hits=w.raw.overlap({shape:PROBE,x:meters(result.body.x),y:meters(result.body.y),z:meters(result.body.z),hitSensors:false,hitTriggers:false});
    assert.ok(hits.some(hit=>hit.bodyKey==='embedded'));assert.ok(hits.every(hit=>hit.bodyKey!=='clear-wall'));assert.ok(result.correctionCount<=4);
   }finally{w.raw.dispose()}
  });
  check('ground-filters-do-not-add-support-to-a-rejected-floor',()=>{
   const w=open([floor]);try{let calls=0;const filter={id:'no-floor',order:0,shouldCollide:()=>{calls++;return false}};const initial=pose();const result=step(w,initial,{moveX:0,moveZ:0},{collisionFilters:[filter]});assert.equal(result.body.grounded,false);assert.ok(result.body.y<initial.y);assert.equal(result.collisionFilterCalls,calls)}finally{w.raw.dispose()}
  });
  check('native-upward-normal-floor-filter-keeps-walking-grounded',()=>{
   for(const [moveX,moveZ] of [[.04,0],[-.04,0],[0,.04],[0,-.04]]){
    const w=open([floor]);let calls=0;try{let body=pose();const filter={id:'floor-normal',order:0,shouldCollide:(candidate)=>{calls++;return candidate.normalY>0}};
     for(let frame=0;frame<20;frame++){w.raw.step();calls=0;const result=step(w,body,{moveX,moveZ},{collisionFilters:[filter]});body=result.body;assert.equal(body.grounded,true);assert.ok(Math.abs(body.y-.9101)<1e-8);assert.equal(result.collisionFilterCalls,calls);noOverlap(w,body)}
     assert.ok(Math.abs(body.x-20*moveX)<1e-8);assert.ok(Math.abs(body.z-20*moveZ)<1e-8);
    }finally{w.raw.dispose()}
   }
  });

  const matrix = JSON.parse(command(process.execPath, [join(project, 'scripts/repro-syncplay-kcc-standing.mjs'),
    '--revision=1', '--assert', `--repair-module=${repairModule}`], project));
  assert.equal(matrix.failures, 0);
  const hookMatrix = JSON.parse(command(process.execPath, [`--import=${registerModule}`,
    join(project, 'scripts/repro-syncplay-kcc-standing.mjs'), '--revision=1', '--assert'], project));
  assert.equal(hookMatrix.failures, 0);
  assert.equal(digest(readFileSync(new URL('movement3d-revision1.js', sdkDist))), runtimeDigest,
    'The installed SDK runtime must stay the same.');
  console.log(JSON.stringify({
    artifact: 'proposed typed SDK repair with installed WASM',
    sourceSha256: digest(originalSource), patchSha256: digest(patch), installedRuntimeSha256: runtimeDigest,
    repairModuleSha256: digest(compiled.code),
    nativeChecks: reports.length, standingCases: matrix.results.length, standingFailures: matrix.failures,
    hookStandingCases: hookMatrix.results.length, hookStandingFailures: hookMatrix.failures,
    repairModule: keep ? repairModule : null, verificationHook: keep ? registerModule : null,
    verificationOnly: true, results: reports,
    limits: ['Recovery has four passes. Deep contact can remain when a separate solid blocks the exit.',
      'The repair changes revision 1 query counts and checksums. It requires a new SDK artifact.',
      'The game must pass a separate full scene and regression gate.'],
  }, null, 2));
} finally {
  if (!keep) rmSync(temporary, { recursive: true, force: true });
}
