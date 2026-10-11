import * as THREE from 'three'
import {writeFile} from 'node:fs/promises'
import {ForegroundCutaway} from '../../../src/runtime/cutaway.ts'
import {InklineRenderer} from '../../../src/runtime/renderer.ts'
const checks=[],cutaway=new ForegroundCutaway(),camera=new THREE.PerspectiveCamera();camera.position.set(10,2,0);camera.lookAt(0,1,0);camera.updateMatrixWorld()
const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),line=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial());root.add(mesh,line);cutaway.apply(root)
const shaders=[mesh,line].map(o=>{const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <clipping_planes_fragment>'};o.material.onBeforeCompile(shader);return shader})
cutaway.update(camera,new THREE.Vector3(0,.8,0),1.6,1/60)
checks.push({name:'Primary opening activates without a clearance-ray hit',pass:cutaway.amount>0&&cutaway.amount<1})
checks.push({name:'Double-sided surfaces and lines share both bounded openings',pass:shaders.every(s=>s.fragmentShader.includes('cutWorldY > cutFloor')&&s.fragmentShader.includes('cutView.z > cutFocus.z - cutDepth')&&s.fragmentShader.includes('cutWorldY > cutSecondaryFloor'))&&shaders[0].uniforms.cutSecondaryActive===shaders[1].uniforms.cutSecondaryActive&&mesh.material.side===THREE.DoubleSide})
const actor=(x,reacting)=>({root:new THREE.Group(),reaction:reacting?{kind:'fall'}:null,hold:0,active:'block',origin:new THREE.Vector3()});const hero=actor(0,false),a=actor(1,true),b=actor(3,true);a.root.position.x=1;b.root.position.x=3
const stage=Object.create(InklineRenderer.prototype);Object.assign(stage,{actors:[hero,a,b],secondaryCutawayTarget:null,foregroundCutaway:cutaway,camera,library:{entry(){return{dimensions:[1,1.6,1]}}}})
stage.updateReactionCutaway(1/60);checks.push({name:'Nearest active target is selected',pass:stage.secondaryCutawayTarget===a})
a.reaction=null;const before=cutaway.secondaryAmount;stage.updateReactionCutaway(1/60);checks.push({name:'Old target fades before another target can be selected',pass:stage.secondaryCutawayTarget===a&&cutaway.secondaryAmount<before&&cutaway.secondaryAmount>0})
for(let i=0;i<90;i++)stage.updateReactionCutaway(1/60);checks.push({name:'Next target activates after the fade',pass:stage.secondaryCutawayTarget===b&&cutaway.secondaryAmount>.9})
b.reaction=null;b.active='get-up-forward';b.hold=.5;checks.push({name:'Recovery remains eligible without a fall reaction',pass:stage.isReactionCutawayTarget(b)})
b.root.position.x=4.6;checks.push({name:'Targets beyond the bounded range are excluded',pass:!stage.isReactionCutawayTarget(b)})
cutaway.reset();checks.push({name:'Reset clears both openings',pass:cutaway.amount===0&&cutaway.secondaryAmount===0})
const pass=checks.every(c=>c.pass);await writeFile('docs/verification/correction/camera-cutaway-cpu.json',JSON.stringify({pass,checks},null,2)+'\n');console.log(JSON.stringify({pass,checks},null,2));if(!pass)process.exitCode=1
