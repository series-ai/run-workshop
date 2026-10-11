import * as THREE from 'three'
import { InklineRenderer } from '../../../src/runtime/renderer.ts'
import { CameraMotion } from '../../../src/runtime/camera.ts'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { readFile, writeFile } from 'node:fs/promises'
import { DEFAULT_SETTINGS } from '../../../src/types.ts'
const checks=[]
const fixture=()=>{
 const stage=Object.create(InklineRenderer.prototype)
 Object.assign(stage,{settings:{...DEFAULT_SETTINGS},sceneKey:'fixture',stats:{loading:false},actors:[],content:new THREE.Group(),container:{clientWidth:1440,clientHeight:900},renderer:{setPixelRatio(){},setSize(){}},camera:new THREE.PerspectiveCamera(),controls:{target:new THREE.Vector3(),update(){}},target:new THREE.Vector3(),cameraMotion:{reset(){}},foregroundCutaway:{reset(){}}})
 return stage
}
const fit=fixture();fit.settings={...fit.settings,mode:'assets',camera:'side'};const box=new THREE.Mesh(new THREE.BoxGeometry(4,4,4),new THREE.MeshBasicMaterial());box.position.y=2;fit.content.add(box);fit.camera=new THREE.OrthographicCamera(-1,1,1,-1,.05,180);fit.camera.position.set(.6,2,0);fit.controls.target.set(0,2,0);fit.viewRadius=1;fit.refitPreviewCamera(true,false);fit.camera.updateMatrixWorld(true);const front=new THREE.Vector3(2,2,0).project(fit.camera)
checks.push({name:'Small to large orthographic asset remains in front of the near plane',pass:front.z>-1&&front.z<1,position:fit.camera.position.toArray(),frontDepth:front.z})
const overview=fixture();overview.settings={...overview.settings,mode:'overview',camera:'side'};overview.frameCamera();overview.container.clientWidth=390;overview.container.clientHeight=844;overview.resizeReviewView();overview.camera.updateMatrixWorld(true);const acrobat=new THREE.Vector3(2.8,1,-3).project(overview.camera)
checks.push({name:'Overview acrobat remains framed after phone resize',pass:Math.abs(acrobat.x)<1&&Math.abs(acrobat.y)<1,screenX:(acrobat.x+1)*195,viewRadius:overview.viewRadius})
const chase=fixture();chase.container.clientWidth=600;const before=chase.chaseOffset();chase.container.clientWidth=599;const after=chase.chaseOffset();const motion=new CameraMotion(),target=new THREE.Vector3();motion.reset(before,target);motion.update({position:after,target,focus:target,bodyHeight:1.8,parallel:false,delta:1/60},null);const step=motion.pose.position.distanceTo(before)
checks.push({name:'Third-person direction stays stable across 600 pixels',pass:step<1e-9,step})
const bytes=await readFile('.cache/correction-character-prototype/characters/stick-standard.glb');const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');const root=gltf.scene,mixer=new THREE.AnimationMixer(root),death=gltf.animations.find(clip=>clip.name==='death');const action=mixer.clipAction(death).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();mixer.update(death.duration);root.updateMatrixWorld(true)
const headY=()=>root.getObjectByName('Head').getWorldPosition(new THREE.Vector3()).y
const beforeHeadY=headY();const actor={root,mixer,actions:new Map([['death',action]]),clips:new Map(gltf.animations.map(clip=>[clip.name,clip])),active:'death',health:0,respawn:2,spawn:new THREE.Vector3(0,0,8),origin:new THREE.Vector3(),recoil:new THREE.Vector3(),reaction:{kind:'fall'},hold:1,sequencePhase:0,spawnRotation:new THREE.Quaternion(),shadow:new THREE.Mesh(new THREE.CircleGeometry(),new THREE.MeshBasicMaterial())}
const reset=fixture();Object.assign(reset,{settings:{...DEFAULT_SETTINGS,mode:'combat',playing:false},actors:[actor],clearInput(){},body:{},trails:{clear(){}},effects:{clear(){}},cameraLead:new THREE.Vector3(),contacts:[],effectSlots:[],pickups:[],clips:new Map([['block',{loop:true}]]),frameCamera(){}});reset.resetGame();root.updateMatrixWorld(true)
checks.push({name:'Paused reset evaluates a standing pose',pass:actor.active==='block'&&headY()>1&&actor.health===3&&actor.respawn===0,beforeHeadY,afterHeadY:headY(),active:actor.active})
const changed=fixture();Object.assign(changed,{settings:{...DEFAULT_SETTINGS,mode:'assets',camera:'side'},camera:new THREE.OrthographicCamera(-6,6,3,-3,.05,180),container:{clientWidth:1200,clientHeight:600},viewRadius:3,previewAspect:.5});changed.camera.position.set(10,0,0);changed.content.add(new THREE.Mesh(new THREE.BoxGeometry(2,2,8),new THREE.MeshBasicMaterial()));changed.refitPreviewCamera(true,true);changed.container.clientWidth=300;changed.resizeReviewView();changed.camera.updateMatrixWorld(true);const changedCorner=new THREE.Vector3(0,0,4).project(changed.camera)
checks.push({name:'Content changes replace stale resize coverage',pass:Math.abs(changedCorner.x)<1,horizontalNdc:changedCorner.x,viewRadius:changed.viewRadius})
const firstRadius=changed.viewRadius;changed.container.clientWidth=1200;changed.resizeReviewView();changed.container.clientWidth=300;changed.resizeReviewView();checks.push({name:'Repeated resize does not compound the fitted radius',pass:Math.abs(changed.viewRadius-firstRadius)<1e-9,firstRadius,secondRadius:changed.viewRadius})
const pass=checks.every(check=>check.pass)
await writeFile('docs/verification/correction/camera-integration-cpu.json',JSON.stringify({checkedAt:new Date().toISOString(),pass,scope:'CPU calls to actual renderer methods. Geometry fixture and current stick-standard prototype. No browser or final-asset claim.',checks},null,2)+'\n')
console.log(JSON.stringify({pass,checks},null,2));if(!pass)process.exitCode=1
