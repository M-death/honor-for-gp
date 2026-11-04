const { chromium } = require('playwright');
(async () => {
  const dir = process.argv[2];
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs=[]; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text()); });
  await p.addInitScript(() => { localStorage.setItem('honorGP.controlMode', 'pad'); });
  await p.goto('file://' + dir + '/index.html'); await p.waitForTimeout(800);
  console.log('load errors', errs.splice(0));
  await p.evaluate(() => { const s=document.getElementById('simSpeed'); s.value='3'; s.dispatchEvent(new Event('change',{bubbles:true})); });
  await p.click('#pmDev summary'); await p.click('#goDemo'); for (let i=0;i<400;i++){ await p.waitForTimeout(250); if (await p.evaluate(()=>!document.getElementById('resBox').hidden)) break; }
  await p.screenshot({path: dir + '/../split_demo.png'});
  console.log('demo errors', errs.splice(0), await p.evaluate(()=>document.getElementById('resInfo').textContent+' | '+document.getElementById('resBody').textContent));
  await b.close();
})();
