async page => {
  await page.waitForFunction(() => window.effectReview);
  await page.setViewportSize({width:1000,height:820});
  await page.addStyleTag({content:'h1{font-size:28px}main{padding:22px}canvas{max-width:768px}'});
  const category=await page.evaluate(()=>new URLSearchParams(location.search).get('category'));
  if(!['Combat','Weapons','Movement','Destruction','Status'].includes(category))throw new Error('Choose one effect category.');
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.evaluate(()=>{document.querySelector('h1').textContent='INKLINE 1.4.0 / Clear effects';});
  await page.screencast.start({path:`docs/verification/polish/effects-${category.toLowerCase()}-normal-speed.webm`,size:{width:800,height:656}});
  let playback;
  try {
    playback=await page.evaluate(async category=>{
      const clips=[];
      for(const effect of window.effectReview.effects.filter(effect=>effect.category===category)){
        const started=performance.now();
        for(let repeat=0;repeat<2;repeat++){
          window.effectReview.start(effect.id);
          const duration=window.effectReview.state.duration;
          await new Promise(resolve=>setTimeout(resolve,(duration+.3)*1000));
          window.effectReview.pause();
        }
        clips.push({id:effect.id,seconds:(performance.now()-started)/1000});
      }
      return {category,count:clips.length,clips};
    },category);
  } finally {await page.screencast.stop();}
  if(errors.length)throw new Error(errors.join('\n'));
  await page.evaluate(result=>window.__effectPlayback=result,{...playback,errors});
}
