async page => {
  await page.clock.install();
  await page.goto('http://127.0.0.1:4321/play.html');
  await page.getByRole('button',{name:'Begin',exact:true}).click();
  const expected='You hear shuffling on the stone next to you.';
  const next=page.getByRole('button',{name:'Reveal text or continue',exact:true});
  let clicks=0;
  while(await page.locator('.opening-story .sr-only').innerText()!==expected) {
    await next.click();
    if(++clicks>8)throw new Error('Shuffling line was skipped.');
  }
  const visible=()=>page.locator('.opening-narration .typewriter [aria-hidden=true]').evaluate(el=>{
    const copy=el.cloneNode(true);
    copy.querySelectorAll('.typewriter-hidden').forEach(node=>node.remove());
    return copy.textContent;
  });
  await page.clock.runFor(140);
  const early=await visible();
  await page.clock.runFor(560);
  const middle=await visible();
  if(!(early.length>0 && middle.length>early.length && middle.length<expected.length))throw new Error(JSON.stringify({early,middle}));
  await next.click();
  const completed=await visible();
  if(completed!==expected)throw new Error('Click did not reveal the caption.');
  if(await page.locator('.opening-story .sr-only').innerText()!==expected)throw new Error('Reveal advanced the line.');
  const style=()=>page.locator('.opening-narration').evaluate(el=>({fontStyle:getComputedStyle(el).fontStyle,color:getComputedStyle(el).color}));
  const narrator=await style();
  await next.click();
  const thought=await style();
  if(narrator.fontStyle!=="normal" || thought.fontStyle!=="italic" || narrator.color===thought.color) throw new Error(JSON.stringify({narrator,thought}));
  return {early,middle,completed,usesNarrationRenderer:true,clickRevealsWithoutAdvancing:true,narrator,thought};
}
