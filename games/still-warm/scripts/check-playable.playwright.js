async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4320/play.html');
  await page.getByRole('button', {name:'Begin',exact:true}).click();
  const choose = async (text) => {
    const button = page.getByRole('button', {name:text,exact:true});
    await button.waitFor({timeout:90000});
    await button.click();
    await page.getByRole('button', {name:'Stop',exact:true}).waitFor({state:'hidden',timeout:90000});
  };
  await choose('Light the lantern. I am here.');
  await choose('You can do it. Lift it off me.');
  await page.screenshot({path:'/tmp/still-warm-freed.png'});
  await choose('Open my shirt. Gently.');
  await choose('A little morphine. Only a little.');
  await choose('Bar the door. Then come back.');
  await choose('Take the metal out. Slowly.');
  await choose('The fire. Use the water.');
  await page.screenshot({path:'/tmp/still-warm-operation.png'});
  await choose('Cut hair from the wig. Thread the needle.');
  await choose('Stitch it shut. Stay with me.');
  await choose('Cover it with something clean.');
  await choose('Unlock the brace. Help me up.');
  await page.getByRole('heading',{name:'Still warm.',exact:true}).waitFor({timeout:20000});
  await page.screenshot({path:'/tmp/still-warm-saved.png'});
  if (errors.length) throw new Error(errors.join('\n'));
  return {ending: await page.locator('.ending').innerText(), errors};
}
