async page => {
 const results=[];
 const ready=()=>page.waitForFunction(()=>window.inklineAudit.state().stats?.loading===false);
 const state=()=>page.evaluate(()=>window.inklineAudit.artState());
 const direction=c=>{const v=c.position.map((x,i)=>x-c.target[i]);const l=Math.hypot(...v);return v.map(x=>x/l);};
 const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,direction(a).reduce((s,x,i)=>s+x*direction(b)[i],0))))*180/Math.PI;
 const span=s=>{const points=Object.values(s.actors[0].joints);return Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y));};
 await page.setViewportSize({width:1440,height:900});
 await page.evaluate(()=>{const a=window.inklineAudit;a.set({mode:'avatars',camera:'side',playing:false,avatar:{...a.state().settings.avatar,equipment:null},reset:a.state().settings.reset+1});});
 await ready();
 await page.mouse.move(700,450);await page.mouse.wheel(0,350);await page.waitForTimeout(400);
 const before=await state();
 await page.setViewportSize({width:1440,height:901});await page.waitForTimeout(200);
 const after=await state();
 results.push({kind:'orthographic user zoom survives one-pixel resize',angle:angle(before.camera,after.camera),pixelSpanChange:span(after)-span(before),pass:angle(before.camera,after.camera)<.05&&Math.abs(span(after)-span(before))<.05});
 for(const camera of ['perspective','side']){
  await page.setViewportSize({width:1440,height:900});
  await page.evaluate(camera=>{const a=window.inklineAudit;a.set({mode:'effects',camera,effectId:'punch-impact',effectScale:1,playing:false,reset:a.state().settings.reset+1});},camera);
  await ready();
  await page.mouse.move(500,350);await page.mouse.down();await page.mouse.move(700,390,{steps:8});await page.mouse.up();await page.waitForTimeout(1800);
  const original=await state();
  await page.evaluate(()=>window.inklineAudit.set({effectScale:2}));
  const scaled=await state();
  results.push({kind:'effect scale preserves orbit',camera,angle:angle(original.camera,scaled.camera),pass:angle(original.camera,scaled.camera)<.05});
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   await page.setViewportSize(viewport);await page.waitForTimeout(120);
   await page.evaluate(()=>{const a=window.inklineAudit;a.set({playing:true,trigger:a.state().settings.trigger+1});});
   await page.waitForTimeout(85);
   await page.evaluate(()=>window.inklineAudit.set({playing:false}));
   await page.screenshot({path:`games/inkline-showcase/docs/verification/correction/camera-refit-effect-visible-${viewport.width}-${camera}.png`});
   results.push({kind:'effect capture',camera,viewport,cameraState:(await state()).camera,stats:await page.evaluate(()=>window.inklineAudit.state().stats)});
  }
 }
 return {results};
}
