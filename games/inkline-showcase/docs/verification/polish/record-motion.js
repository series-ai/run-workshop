async page => {
await page.waitForFunction(()=>window.figureReview);await page.setViewportSize({width:1260,height:710});await page.addStyleTag({content:"main{padding:16px;max-width:none}h1{font-size:24px}#sheet,h2{display:none}nav{margin-bottom:8px}canvas{height:auto}"});
const group=await page.evaluate(()=>new URLSearchParams(location.search).get("reel")); const output=await page.evaluate(()=>new URLSearchParams(location.search).get("output")||"docs/verification/polish"); const errors=[];page.on("pageerror",e=>errors.push(e.message));await page.evaluate(async()=>{const manifest=await fetch("/assets/manifest.json").then(r=>r.json());document.querySelector("h1").textContent="INKLINE "+manifest.version+" / Actual exported motion."});
await page.screencast.start({path:`${output}/figure-final-${group}-normal-speed.webm`,size:{width:800,height:450}});let playback;
try{playback=await (async page => {
  await page.waitForFunction(()=>window.figureReview);
  return await page.evaluate(async()=>{
    const parameters=new URLSearchParams(location.search);
    const base=parameters.get('assets')||'/.cache/correction-character-family';
    const catalog=await fetch(base+'/characters.json').then(r=>r.json());
    const groups={movement:['movement'],combat:['melee','ranged'],other:['reactions','interaction','sport']};
    const categories=groups[parameters.get('reel')||'movement'];
    const played=[];
    for(const clip of catalog.animations.filter(clip=>categories.includes(clip.category))){
      const equipment=clip.id.startsWith('sword-')?'sword':clip.id.startsWith('staff-')?'staff':clip.id.startsWith('shield-')?'shield-riot':clip.id.startsWith('pistol-')?'pistol':clip.id.startsWith('rifle-')?'rifle':clip.id.startsWith('bow-')?'bow':clip.id==='shotgun-fire'?'shotgun':clip.id==='hammer-overhead'?'hammer-war':clip.id==='dagger-stab'?'dagger':clip.id==='bat-swing'?'bat':clip.id==='ball-throw'?'basketball':clip.id==='throw'?'grenade-frag':null;
      await window.figureReview.equip(equipment);
      window.figureReview.choose(clip.id);await window.figureReview.sheet();window.figureReview.play();
      await new Promise(resolve=>setTimeout(resolve,(clip.duration*(clip.loop?2:1)+.15)*1000));
      const state=window.figureReview.state;
      if(state.clip!==clip.id)throw new Error(`${clip.id} changed during playback`);
      if(!clip.loop&&Math.abs(state.time-clip.duration)>.001)throw new Error(`${clip.id} did not finish at normal speed`);
      played.push({clip:clip.id,equipment,duration:clip.duration,cycles:clip.loop?2:1});
    }
    window.figureReview.pause();return {count:played.length,clips:played.map(item=>item.clip)};
  });
})(page)}finally{await page.screencast.stop()}
if(errors.length)throw new Error(errors.join("\n"));await page.evaluate(result=>window.__lineMotionPlayback=result,{group,playback,errors});
}