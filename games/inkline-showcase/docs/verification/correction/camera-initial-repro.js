async page => {
  await page.setViewportSize({width:1440,height:900});
  await page.waitForFunction(() => window.inklineAudit?.state().stats?.loading === false);
  const results=[];
  for (const camera of ['third-person','side','top','perspective']) {
    await page.evaluate(camera=>{const a=window.inklineAudit;a.set({mode:'combat',camera,playing:true,motion:'reduced',reset:a.state().settings.reset+1})},camera);
    await page.waitForFunction(()=>!window.inklineAudit.state().stats?.loading);
    await page.waitForTimeout(500);
    results.push(await page.evaluate(async camera=>{
      const a=window.inklineAudit;const rows=[];const started=performance.now();let previous='';
      const input=(action,pressed)=>window.dispatchEvent(new CustomEvent('inkline-input',{detail:{action,pressed}}));
      await new Promise(resolve=>{
        function frame(now){
          const t=(now-started)/1000;
          const action=t<.8?'':t<2.2?'forward':t<3.6?'right':t<5?'backward':'';
          if(action!==previous){if(previous)input(previous,false);if(action)input(action,true);previous=action;}
          const s=a.artState();rows.push({t,action,p:s.camera.position,target:s.camera.target,body:s.body.position,clip:s.actors[0].clip,hip:s.actors[0].joints.Hips,blocked:Object.entries(s.actors[0].blocked).filter(x=>x[1]).map(x=>x[0])});
          if(t<5.8)requestAnimationFrame(frame);else{if(previous)input(previous,false);resolve();}
        }
        requestAnimationFrame(frame);
      });
      const jumps=rows.slice(1).map((row,i)=>({distance:Math.hypot(...row.p.map((v,k)=>v-rows[i].p[k])),dt:row.t-rows[i].t,before:rows[i],after:row})).sort((a,b)=>b.distance-a.distance);
      return {camera,frames:rows.length,blockedFrames:rows.filter(x=>x.blocked.length).length,jumpsOverOne:jumps.filter(x=>x.distance>1).length,worst:jumps.slice(0,8),rows};
    },camera));
  }
  return results;
}
