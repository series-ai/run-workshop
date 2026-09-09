async page => {
  await page.clock.install();
  await page.goto('http://127.0.0.1:4320/play.html');
  await page.getByRole('button',{name:'Begin',exact:true}).click();
  const next=page.getByRole('button',{name:'Reveal text or continue',exact:true});
  await next.click();
  const first=await page.locator('.opening-story .sr-only').innerText();
  if(first!=='Pitch black. Cold stone against my face.') throw new Error('First line mismatch.');
  await next.click();
  const visible=()=>page.locator('.opening-story .typewriter [aria-hidden=true]').evaluate(el=>{
    const copy=el.cloneNode(true);
    copy.querySelectorAll('.typewriter-hidden').forEach(node=>node.remove());
    return copy.textContent;
  });
  await page.clock.runFor(630);
  const one=await visible();
  await page.clock.runFor(280);
  const two=await visible();
  await page.clock.runFor(420);
  const four=await visible();
  await page.clock.runFor(300);
  const held=await visible();
  if(one!=='I try to move.' || two!=='I try to move..' || four!=='I try to move....' || held!==four) throw new Error(JSON.stringify({one,two,four,held}));
  await next.click();
  const skipped=await visible();
  if(skipped!=="I try to move.... I can't.") throw new Error('Click did not skip the remaining pause.');
  if((await page.locator('.opening-story').innerText()).includes('{{')) throw new Error('Pause marker leaked into text.');
  return {first,one,two,four,held,skipped,markersHidden:true};
}
