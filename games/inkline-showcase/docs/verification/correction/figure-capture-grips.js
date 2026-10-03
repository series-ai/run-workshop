async page => {
  const base='/.cache/correction-character-family';
  await page.setViewportSize({width:1440,height:960});
  await page.waitForFunction(()=>window.figureReview);
  const catalog=await page.evaluate(async base=>await fetch(base+'/characters.json').then(r=>r.json()),base);
  const cases=[['sword','sword-overhead'],['sword','sword-thrust'],['sword','sword-lunge'],['sword','sword-diagonal'],['shield-riot','shield-slam']];
  for(let batch=0;batch<2;batch++){
    const rows=[];
    for(const body of catalog.models.slice(batch*6,batch*6+6)){
      await page.goto(`http://localhost:5197/docs/verification/correction/figure-review.html?assets=${base}&body=${body.id}`);
      await page.waitForFunction(()=>window.figureReview);
      const shots=await page.evaluate(async cases=>{
        const results=[];
        for(const [gear,id] of cases){
          await window.figureReview.equip(gear);window.figureReview.choose(id);
          const catalog=await fetch(new URLSearchParams(location.search).get('assets')+'/characters.json').then(r=>r.json());
          const time=catalog.animations.find(clip=>clip.id===id).motion.phases.find(phase=>phase.name==='contact').frame/30;
          results.push({id,side:window.figureReview.capture(time,1),quarter:window.figureReview.capture(time,2)});
        }
        return results;
      },cases);
      rows.push({body:body.label,shots});
    }
    await page.evaluate(({rows,batch})=>{
      document.querySelector('main').style.display='none';
      const board=document.createElement('div');board.id='grips';board.style.cssText='width:2160px;padding:24px';
      board.innerHTML=`<h1>Mounted contact / bodies ${batch*6+1}–${batch*6+6}</h1><p>Actual new GLBs. Fixed common scale. Side and three-quarter views at the canonical contact phase.</p>`+rows.map(row=>`<section style="display:grid;grid-template-columns:160px repeat(5,1fr);gap:8px;border-top:1px solid #aaa;padding:8px 0"><h2>${row.body}</h2>${row.shots.map(shot=>`<figure><div style="display:flex"><img style="width:50%" src="${shot.side}"><img style="width:50%" src="${shot.quarter}"></div><figcaption>${shot.id}</figcaption></figure>`).join('')}</section>`).join('');document.body.append(board);
    },{rows,batch});
    await page.locator('#grips').screenshot({path:`docs/verification/correction/figure-grip-family-${batch+1}.png`});
  }
  return {bodies:catalog.models.length,clips:cases.length,views:2};
}
