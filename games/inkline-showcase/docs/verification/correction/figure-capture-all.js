async page => {
  await page.waitForFunction(() => Boolean(window.figureReview));
  const ids = await page.locator('#clip option').evaluateAll(options => options.map(option => option.value));
  await page.setViewportSize({width:1260,height:960});
  for(let batch=0;batch<6;batch++) {
    const list=ids.slice(batch*15,batch*15+15);
    await page.evaluate(async({list,batch})=>{
      window.figureReview.pause();await window.figureReview.equip(null);
      const catalog=await fetch((new URLSearchParams(location.search).get('assets')||'/.cache/correction-character-prototype')+'/characters.json').then(r=>r.json());
      const old=document.querySelector('#board');if(old)old.remove();
      document.querySelector('main').style.display='block';
      const rows=[];
      for(const id of list){
        const clip=catalog.animations.find(c=>c.id===id);window.figureReview.choose(id);
        const phase=clip.motion?.phases.find(phase=>phase.name==='contact')??clip.motion?.phases.find(phase=>phase.name==='grasp');
        const times=[1/30,phase?phase.frame/30:clip.contactTime??clip.duration*.4,clip.duration*.82];
        rows.push(`<section style="display:grid;grid-template-columns:150px repeat(4,1fr);gap:8px;border-top:1px solid #c7c9c1;padding:10px 0"><h2 style="padding:10px">${id}</h2>${times.map(t=>`<figure><img src="${window.figureReview.capture(t,1)}"><figcaption>Side / ${t.toFixed(3)} s</figcaption></figure>`).join('')}<figure><img src="${window.figureReview.capture(times[1],0)}"><figcaption>Front / ${times[1].toFixed(3)} s</figcaption></figure></section>`);
      }
      document.querySelector('main').style.display='none';
      const board=document.createElement('div');board.id='board';board.style.cssText='padding:24px;width:1260px';board.innerHTML=`<h1>New Core GLB / all 85 clips / sheet ${batch+1}</h1><p>Actual source export. Fixed side and front cameras. No effects or equipment. Start, action, return, and front action.</p>`+rows.join('');document.body.append(board);
    },{list,batch});
    await page.locator('#board').screenshot({path:`docs/verification/correction/figure-final-all-${batch+1}.png`});
  }
  return {count:ids.length,sheets:6};
}
