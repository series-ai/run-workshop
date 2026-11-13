async page => {
 const results=[];
 const ready=()=>page.waitForFunction(()=>window.inklineAudit?.state().stats?.loading===false);
 const state=()=>page.evaluate(()=>window.inklineAudit.artState());
 const dir=c=>{const v=c.position.map((x,i)=>x-c.target[i]);const l=Math.hypot(...v);return v.map(x=>x/l);};
 const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,dir(a).reduce((s,v,i)=>s+v*dir(b)[i],0))))*180/Math.PI;
 await page.setViewportSize({width:390,height:844});
 for(const camera of ['perspective','side']){
  await page.evaluate(camera=>{const a=window.inklineAudit;a.set({mode:'assets',camera,modelId:'stick-standard',animationId:'idle',playing:false,reset:a.state().settings.reset+1});},camera);
  await ready();
  await page.mouse.move(110,340);await page.mouse.down();await page.mouse.move(185,380,{steps:8});await page.mouse.up();await page.waitForTimeout(1800);
  const before=await state();
  await page.evaluate(()=>window.inklineAudit.set({animationId:'kick-roundhouse',playing:true}));
  const after=await state();
  let outside=0;
  for(let i=0;i<24;i++){await page.waitForTimeout(65);const s=await state();outside+=Object.values(s.actors[0].joints).filter(p=>p.x<0||p.y<0||p.x>s.viewport.width||p.y>s.viewport.height||p.depth<=-1||p.depth>=1).length;}
  results.push({kind:'animated character asset',camera,angle:angle(before.camera,after.camera),outside,pass:angle(before.camera,after.camera)<.05&&outside===0});
  await page.evaluate(()=>window.inklineAudit.set({modelId:'cargo-container',playing:false}));await ready();
  const model=await state();
  outside=model.sceneFrame.filter(p=>p.x<0||p.y<0||p.x>model.viewport.width||p.y>model.viewport.height||p.depth<=-1||p.depth>=1).length;
  results.push({kind:'asset selection retains orbit',camera,angle:angle(after.camera,model.camera),outside,pass:angle(after.camera,model.camera)<.05&&outside===0});
 }
 return{results,pass:results.every(r=>r.pass)};
}
