async page => {
  await page.goto("http://127.0.0.1:4320/play.html");
  await page.getByRole("button", {name:"Begin",exact:true}).waitFor();
  return await page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource');
    const react = await import(resources.find(r => /\/react\.js\?/.test(r.name)).name);
    const dom = await import(resources.find(r => /react-dom_client\.js\?/.test(r.name)).name);
    const { Typewriter } = await import('/src/ui/Typewriter.tsx');
    const host = document.createElement('p');
    host.className = 'opening-narration';
    host.style.cssText = 'position:absolute;left:-1000px;top:0;width:220px';
    document.body.append(host);
    const root = dom.default.createRoot(host);
    const text = 'Oh! My boy is here, in the dark. He must be so scared.';
    const sample = async seconds => {
      root.render(react.default.createElement(Typewriter, { text, seconds }));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        accessible: host.querySelector('.sr-only').textContent,
        words: [...host.querySelectorAll('.typewriter-word')].map(word => {
          const box = word.getBoundingClientRect();
          return { x:box.x, y:box.y, width:box.width, height:box.height, wrap:getComputedStyle(word).whiteSpace };
        }),
        revealed: [...host.querySelectorAll('.typewriter-word')].map(word => [...word.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('')).join(' '),
      };
    };
    try {
      const early=await sample(.15), late=await sample(3);
      if(JSON.stringify(early.words)!==JSON.stringify(late.words)) throw new Error('Word layout moved during typing.');
      if(early.words.some(word=>word.wrap!=='nowrap'||word.width>220)) throw new Error('A word can split or overflow.');
      if(early.revealed===late.revealed || late.accessible!==text) throw new Error('Reveal or accessible text failed.');
      return {stableWordLayout:true,wholeWords:true,accessibleText:late.accessible,early:early.revealed,late:late.revealed,lines:new Set(late.words.map(w=>w.y)).size};
    } finally { root.unmount();host.remove(); }
  });
}
