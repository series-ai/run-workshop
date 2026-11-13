async page => {
  const results=[];
  const input=(action,pressed)=>page.evaluate(detail=>window.dispatchEvent(new CustomEvent('inkline-input',{detail})),{action,pressed});
  for (const camera of ['third-person','side','top','perspective']) {
    await page.evaluate(camera=>{const a=window.inklineAudit;a.set({mode:'combat',camera,playing:true,motion:'reduced',reset:a.state().settings.reset+1})},camera);
    await page.waitForFunction(()=>!window.inklineAudit.state().stats?.loading);
    await input('forward',true);await page.waitForTimeout(1400);await input('forward',false);
    await input('right',true);await page.waitForTimeout(685);await input('right',false);
    await page.waitForTimeout(500);
    results.push(await page.evaluate(async camera=>{
      const rows=[];const start=performance.now();
      await new Promise(resolve=>{function frame(now){const s=window.inklineAudit.artState();rows.push({t:(now-start)/1000,p:s.camera.position,target:s.camera.target,body:s.body.position,clip:s.actors[0].clip,hip:s.actors[0].joints.Hips});if(now-start<3000)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame)});
      const jumps=rows.slice(1).map((row,i)=>({distance:Math.hypot(...row.p.map((v,k)=>v-rows[i].p[k])),before:rows[i],after:row})).sort((a,b)=>b.distance-a.distance);
      return {camera,worst:jumps.slice(0,5),jumpsOverOne:jumps.filter(x=>x.distance>1).length,rows};
    },camera));
  }
  for (const mode of ['overview','animations']) {
    await page.evaluate(mode=>{const a=window.inklineAudit;a.set({mode,camera:'perspective',playing:true,motion:'reduced',animationId:'kick-roundhouse'})},mode);
    await page.waitForFunction(()=>!window.inklineAudit.state().stats?.loading);
    const first=await page.evaluate(()=>window.inklineAudit.artState().camera);await page.waitForTimeout(2000);
    const last=await page.evaluate(()=>window.inklineAudit.artState().camera);
    results.push({mode,first,last,drift:Math.hypot(...last.position.map((v,i)=>v-first.position[i]))});
  }
  await page.mouse.move(700,450);await page.mouse.down();await page.mouse.move(1050,490,{steps:10});await page.mouse.up();await page.waitForTimeout(1000);
  const orbited=await page.evaluate(()=>window.inklineAudit.artState().camera);
  await page.setViewportSize({width:1440,height:901});await page.waitForTimeout(200);
  const resized=await page.evaluate(()=>window.inklineAudit.artState().camera);
  results.push({mode:'preview resize after orbit',orbited,resized,distance:Math.hypot(...resized.position.map((v,i)=>v-orbited.position[i]))});
  return results;
}
