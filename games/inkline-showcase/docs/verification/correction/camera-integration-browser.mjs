import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { cameraSourceHashes, cameraPoseEvidence } from '../../../scripts/verify-camera-motion.ts'
const url=process.env.INKLINE_AUDIT_URL??'http://localhost:5197/audit.html'
const sourceSHA256=await cameraSourceHashes()
const browser=await chromium.launch({headless:true,channel:'chromium'})
const checks=[],errors=[]
const direction=c=>{const v=c.position.map((x,i)=>x-c.target[i]);const length=Math.hypot(...v);return v.map(x=>x/length)}
const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,direction(a).reduce((sum,x,i)=>sum+x*direction(b)[i],0))))*180/Math.PI
const outside=(points,view)=>Object.entries(points).filter(([,p])=>p.x<0||p.y<0||p.x>view.width||p.y>view.height||p.depth<=-1||p.depth>=1).map(([name])=>name)
const span=s=>{const ps=s.sceneFrame;return Math.max((Math.max(...ps.map(p=>p.x))-Math.min(...ps.map(p=>p.x)))/s.viewport.width,(Math.max(...ps.map(p=>p.y))-Math.min(...ps.map(p=>p.y)))/s.viewport.height)}
try{
 const page=await browser.newPage()
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
 await page.goto(url)
 const ready=()=>page.waitForFunction(()=>window.inklineAudit?.state().stats?.loading===false)
 const art=()=>page.evaluate(()=>window.inklineAudit.artState())
 const input=(action,pressed)=>page.evaluate(detail=>window.dispatchEvent(new CustomEvent('inkline-input',{detail})),{action,pressed})
 await ready()
 for(const view of [{width:1440,height:900},{width:390,height:844}])for(const camera of ['side','top']){
  await page.setViewportSize(view)
  await page.evaluate(camera=>{const a=window.inklineAudit;a.set({mode:'assets',modelId:'pistol',camera,playing:false,reset:a.state().settings.reset+1})},camera);await ready()
  await page.mouse.move(view.width*.4,view.height*.5);await page.mouse.down();await page.mouse.move(view.width*.55,view.height*.55,{steps:8});await page.mouse.up();await page.waitForTimeout(1800)
  await page.mouse.wheel(0,200);await page.waitForTimeout(500)
  const chosen=await art()
  await page.setViewportSize({...view,height:view.height+1});await page.waitForTimeout(200);const resized=await art()
  checks.push({name:`${view.width}/${camera}: user zoom survives small resize`,pass:Math.abs(span(chosen)-span(resized))<.003&&angle(chosen.camera,resized.camera)<.03,spanChange:span(resized)-span(chosen),angle:angle(chosen.camera,resized.camera)})
  for(const modelId of ['warehouse','pistol']){
   await page.evaluate(modelId=>window.inklineAudit.set({modelId}),modelId);await ready();await page.waitForTimeout(150)
   const state=await art(),clipped=outside(state.sceneFrame,state.viewport),turn=angle(chosen.camera,state.camera)
   const screenshot=`docs/verification/correction/camera-integration-${view.width}-${camera}-${modelId}.png`;await page.screenshot({path:screenshot})
   checks.push({name:`${view.width}/${camera}: exact ${modelId} fit keeps orbit and depth`,pass:!clipped.length&&turn<.03&&span(state)>.25&&span(state)<1,clipped,angle:turn,span:span(state),camera:state.camera,screenshot})
  }
 }
 for(const camera of ['side','top','third-person','perspective']){
  await page.setViewportSize({width:1440,height:900})
  await page.evaluate(camera=>{const a=window.inklineAudit;a.set({mode:'overview',camera,playing:true,motion:'full',reset:a.state().settings.reset+1})},camera);await ready()
  for(const view of [{width:1440,height:900},{width:390,height:844}]){
   const before=await art();await page.setViewportSize(view);await page.waitForTimeout(150);const after=await art()
   const rows=await page.evaluate(async()=>{const rows=[],started=performance.now();while(performance.now()-started<7000){await new Promise(r=>setTimeout(r,70));rows.push(window.inklineAudit.artState())}return rows})
   const failures=[];let minFigureHeight=Infinity
   for(const [frame,state]of rows.entries())for(const [index,actor]of state.actors.entries()){
    const clipped=outside(actor.joints,state.viewport);if(clipped.length)failures.push({frame,index,clipped})
    const ys=Object.values(actor.joints).map(p=>p.y);minFigureHeight=Math.min(minFigureHeight,Math.max(...ys)-Math.min(...ys))
   }
   const screenshot=`docs/verification/correction/camera-integration-overview-${view.width}-${camera}.png`;await page.screenshot({path:screenshot})
   checks.push({name:`${view.width}/${camera}: overview full cycle after resize`,pass:!failures.length&&angle(before.camera,after.camera)<.03,failures,angle:angle(before.camera,after.camera),minFigureHeight,frames:rows.length,screenshot})
  }
  const firstPhone=await art();await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(180);await page.setViewportSize({width:390,height:844});await page.waitForTimeout(180);const secondPhone=await art()
  const drift=Math.hypot(...secondPhone.camera.position.map((v,i)=>v-firstPhone.camera.position[i])),spanChange=span(secondPhone)-span(firstPhone)
  checks.push({name:`${camera}: repeated resize does not compound zoom`,pass:drift<.003&&Math.abs(spanChange)<.001,drift,spanChange})
 }
 await page.setViewportSize({width:600,height:844})
 await page.evaluate(()=>{const a=window.inklineAudit;a.set({mode:'parkour',camera:'third-person',playing:true,motion:'full',avatar:{...a.state().settings.avatar,equipment:null,headwear:'none'},reset:a.state().settings.reset+1})});await ready();await page.waitForTimeout(2200)
 const tracePromise=page.evaluate(async()=>{const rows=[],start=performance.now();while(performance.now()-start<1400){await new Promise(r=>requestAnimationFrame(r));rows.push({time:performance.now(),art:window.inklineAudit.artState()})}return rows})
 await page.waitForTimeout(250);await page.setViewportSize({width:599,height:844});const trace=await tracePromise
 const steps=trace.slice(1).map((row,i)=>({step:Math.hypot(...row.art.camera.position.map((v,k)=>v-trace[i].art.camera.position[k])),angle:angle(row.art.camera,trace[i].art.camera)}))
 checks.push({name:'600 to 599 pixels keeps third-person continuity',pass:steps.every(s=>s.step<.05&&s.angle<.01)&&trace.every(row=>!cameraPoseEvidence(row.art).outside.length),maxStep:Math.max(...steps.map(s=>s.step)),maxAngle:Math.max(...steps.map(s=>s.angle)),samples:trace.map(row=>({time:row.time,...cameraPoseEvidence(row.art)}))})
 await page.setViewportSize({width:1280,height:800})
 await page.evaluate(()=>{const a=window.inklineAudit;a.set({mode:'combat',camera:'perspective',playing:true,motion:'reduced',reset:a.state().settings.reset+1})});await ready()
 for(let attempt=0;attempt<100;attempt++){
  const error=5.82-(await art()).body.position.z;if(Math.abs(error)<.05)break
  const action=error<0?'forward':'back';await input(action,true);await page.waitForTimeout(Math.min(60,Math.max(14,Math.abs(error)*180)));await input(action,false)
 }
 await input('forward',true);await page.waitForTimeout(20);await input('forward',false)
 for(let hit=0;hit<3;hit++){
  const health=(await art()).actors[1].health;await input('attack',true);await page.waitForTimeout(20);await input('attack',false)
  await page.waitForFunction(health=>window.inklineAudit.artState().actors[1].health<health,health,{timeout:2500})
  if(hit<2){await page.waitForFunction(()=>!window.inklineAudit.artState().attack);await page.waitForTimeout(550)}
 }
 await page.waitForTimeout(1400);await page.evaluate(()=>window.inklineAudit.set({playing:false}));const fallen=await art()
 await input('reset',true);await input('reset',false);await page.waitForTimeout(200);const reset=await art()
 const screenshot='docs/verification/correction/camera-integration-paused-reset.png';await page.screenshot({path:screenshot})
 checks.push({name:'Paused reset restores a knocked-out target and player',pass:fallen.actors[1].health<=0&&fallen.actors[1].worldJoints.Head[1]<.65&&reset.actors.every(a=>a.health===3&&a.clip==='block'&&a.reaction.done&&a.worldJoints.Head[1]>1)&&Math.abs(reset.body.position.z-8)<1e-8,fallen:fallen.actors[1],reset:reset.actors,body:reset.body,screenshot})
}catch(error){errors.push(String(error))}finally{await browser.close()}
const pass=checks.length===26&&checks.every(c=>c.pass)&&!errors.length
await writeFile('docs/verification/correction/camera-integration-browser.json',JSON.stringify({checkedAt:new Date().toISOString(),sourceSHA256,url,pass,checks,errors},null,2)+'\n')
console.log(JSON.stringify({pass,checks:checks.length,failures:checks.filter(c=>!c.pass).map(c=>c.name),errors},null,2));if(!pass)process.exitCode=1
