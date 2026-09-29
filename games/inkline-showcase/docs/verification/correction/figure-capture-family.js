async page => {
  const base='/.cache/correction-character-family';
  const catalog=await page.evaluate(async base=>await fetch(base+'/characters.json').then(r=>r.json()),base);
  const rows=[];
  for(const model of catalog.models){
    await page.goto('http://localhost:5197/docs/verification/correction/figure-review.html?assets='+encodeURIComponent(base)+'&body='+model.id);
    await page.waitForFunction(()=>window.figureReview);
    const pictures=await page.evaluate(async()=>{
      await window.figureReview.equip(null);
      return ['idle','block'].map(clip=>{window.figureReview.choose(clip,.5);return window.figureReview.capture(.5,2)});
    });
    rows.push({id:model.id,label:model.label,triangles:model.triangles,pictures});
  }
  await page.evaluate(rows=>{
    document.querySelector('main').style.display='none';
    const board=document.createElement('main');board.id='family';board.style.cssText='display:block;max-width:none;width:1440px;padding:24px';
    board.innerHTML='<h1>Twelve bodies. One stick rig.</h1><p>Actual corrected GLBs. Fixed camera and common scale. Idle and guard at 0.5 s. No effects or equipment.</p><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">'+rows.map(row=>`<section><h2>${row.label}</h2><p>${row.id} / ${row.triangles} triangles</p><div style="display:grid;grid-template-columns:1fr 1fr">${row.pictures.map((url,index)=>`<figure><img src="${url}"><figcaption>${index?'Guard':'Idle'}</figcaption></figure>`).join('')}</div></section>`).join('')+'</div>';
    document.body.append(board);
  },rows);
  await page.locator('#family').screenshot({path:'docs/verification/correction/figure-family-idle-guard.png'});
  return rows.map(({id,label,triangles})=>({id,label,triangles}));
}
