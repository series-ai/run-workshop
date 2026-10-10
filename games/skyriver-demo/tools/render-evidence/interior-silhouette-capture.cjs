'use strict';
const fs=require('node:fs'),path=require('node:path');
const R=require('./experiment-runtime.cjs');
const opt=R.args();if(!opt.url||!opt.out||!opt.installer)throw Error('Use --url --out --installer.');
const installer=require(path.resolve(opt.installer));
(async()=>{const unlock=R.gpuLock('R34 image guards');let s;try{
s=await R.open(opt.url,opt.out);const p=s.page;
await p.evaluate(source=>{window.__interiorExperiment=new Function('app',source)(window.__skyriver);},installer.installSource);
const phase=await R.freezeAtRoute(p,2400);
const rows=[];
async function shot(name,offset,rebuilt=false){await p.evaluate(({offset,rebuilt})=>rebuilt?window.__interiorExperiment.selectRebuilt(offset):window.__interiorExperiment.select(offset),{offset,rebuilt});await R.settle(p,24);await p.screenshot({path:path.join(opt.out,name+'.png')});rows.push({name,offset,rebuilt,stats:await p.evaluate(()=>({calls:window.__skyriver.scene.renderer.info.render.calls,glError:window.__skyriver.scene.renderer.getContext().getError()}))});}
await p.evaluate(()=>{window.__skyriver.scene.setVolumeAllowed(false);window.__skyriver.scene.setBloomAllowed(false);});
async function directParity(name,rebuilt){const encoded=await p.evaluate(rebuilt=>{const a=window.__skyriver,s=a.scene;rebuilt?window.__interiorExperiment.selectRebuilt(0):window.__interiorExperiment.select(0);s.renderer.render(s.scene,s.camera);s.renderer.getContext().finish();return s.renderer.domElement.toDataURL('image/png').split(',')[1];},rebuilt);fs.writeFileSync(path.join(opt.out,name+'.png'),Buffer.from(encoded,'base64'));}
await R.settle(p,24);await directParity('parity-original-a',false);await directParity('parity-rebuilt-zero',true);await directParity('parity-original-b',false);
await p.evaluate(()=>{window.__skyriver.scene.setVolumeAllowed(true);window.__skyriver.scene.setBloomAllowed(true);});
for(const offset of [0,150,300,450])await shot('play-offset-'+offset,offset);
const lab=await p.evaluate(()=>{
const a=window.__skyriver,c=a.scene.camera,h=a.scene.city.towerMesh,mat=h.instanceMatrix.array;const candidates=[];
for(let i=0;i<h.count;i++){const j=i*16,y=mat[j+13],height=Math.hypot(mat[j+4],mat[j+5],mat[j+6]);if(Math.abs(y-c.position.y)>height*.35||height<250)continue;const d=Math.hypot(mat[j+12]-c.position.x,mat[j+14]-c.position.z);if(d>100&&d<700)candidates.push({i,d});}
candidates.sort((a,b)=>a.d-b.d);if(!candidates.length)throw Error('No actual facade candidate.');const index=candidates[0].i,m=c.matrixWorld.clone().fromArray(Array.from(mat.slice(index*16,index*16+16)));const target=c.position.clone().set(0,0,.5).applyMatrix4(m),normal=c.position.clone().set(0,0,1).transformDirection(m);
const saved=[];a.scene.scene.traverse(o=>{if(o.isMesh&&o!==h){saved.push([o,o.visible]);o.visible=false;}});
const attributes=[h.instanceMatrix,...Object.values(h.geometry.attributes).filter(x=>x.isInstancedBufferAttribute)];const prefix=attributes.map(x=>({x,first:Array.from(x.array.slice(0,x.itemSize)),chosen:Array.from(x.array.slice(index*x.itemSize,(index+1)*x.itemSize))}));
for(const q of prefix){q.x.array.set(q.chosen,0);q.x.needsUpdate=true;}
window.__r34Lab={h,count:h.count,prefix,saved,target,normal,camera:{position:c.position.clone(),quaternion:c.quaternion.clone(),fov:c.fov}};h.count=1;a.scene.setVolumeAllowed(false);a.scene.setBloomAllowed(false);
return{selectedInstance:index,matrix:m.toArray(),target:target.toArray(),normal:normal.toArray(),originalCount:window.__r34Lab.count,protocol:'Actual uploaded tower instance and material. Other mesh objects hidden. Fog and bloom off. The same facade is used at every distance.'};
});
for(const distance of [1350,1200,1050,900,750,600,450,300]){await p.evaluate(distance=>{const c=window.__skyriver.scene.camera,l=window.__r34Lab;c.position.copy(l.target).addScaledVector(l.normal,distance);c.up.set(0,1,0);c.fov=35;c.lookAt(l.target);c.updateProjectionMatrix();c.updateMatrixWorld(true);},distance);for(const offset of [0,150,300,450])await shot('wall-'+distance+'-offset-'+offset,offset);}
await p.evaluate(()=>{const l=window.__r34Lab,c=window.__skyriver.scene.camera;for(const q of l.prefix){q.x.array.set(q.first,0);q.x.needsUpdate=true;}for(const [o,v]of l.saved)o.visible=v;l.h.count=l.count;c.position.copy(l.camera.position);c.quaternion.copy(l.camera.quaternion);c.fov=l.camera.fov;c.updateProjectionMatrix();c.updateMatrixWorld(true);window.__skyriver.scene.setVolumeAllowed(true);window.__skyriver.scene.setBloomAllowed(true);});
R.write(path.join(opt.out,'captures.json'),{phase,lab,rows,installerSha:R.sha(installer.installSource),evidence:await p.evaluate(()=>window.__interiorExperiment.evidence()),adapter:s.logs,errors:s.errors});
await p.evaluate(()=>window.__interiorExperiment.dispose());if(s.errors.length||rows.some(r=>r.stats.glError||r.stats.calls>32))process.exitCode=1;
console.log(JSON.stringify({rows:rows.length,errors:s.errors}));
}finally{if(s)await s.browser.close();unlock();}})().catch(e=>{console.error(e);process.exitCode=1;});
