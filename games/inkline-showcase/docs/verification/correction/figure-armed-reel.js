async page => {
  await page.waitForFunction(()=>window.figureReview);
  return await page.evaluate(async()=>{
    const catalog=await fetch((new URLSearchParams(location.search).get('assets')||'/.cache/correction-character-prototype')+'/characters.json').then(r=>r.json());
    const shots=[['sword','sword-slash'],['sword','sword-overhead'],['sword','sword-thrust'],['staff','staff-spin'],['staff','staff-thrust'],['staff','staff-sweep'],['staff','staff-overhead'],['pistol','pistol-fire'],['rifle','rifle-fire'],['rifle','rifle-reload'],['bow','bow-draw'],['bow','bow-release'],['shield-riot','shield-bash'],['shield-riot','shield-block']];
    const played=[];
    for(const [equipment,clip] of shots){
      await window.figureReview.equip(equipment);
      window.figureReview.choose(clip);await window.figureReview.sheet();
      window.figureReview.play();
      const duration=catalog.animations.find(c=>c.id===clip).duration;
      await new Promise(resolve=>setTimeout(resolve,(duration+0.35)*1000));
      played.push({equipment,clip,duration,state:window.figureReview.state});
    }
    window.figureReview.pause();return played;
  });
}
