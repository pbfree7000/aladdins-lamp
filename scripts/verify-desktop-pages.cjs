const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.SITE_URL || 'https://aladdinslamp.xyz/';
const routes = ['home','hunt','silver','apothecary','underground','fresh','journal'];
(async () => {
  fs.mkdirSync('artifacts/desktop', {recursive:true});
  const browser = await chromium.launch({headless:true});
  const report = [];
  let failed = false;
  for (const route of routes) {
    const page = await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
    const issues = [];
    page.on('pageerror', e => issues.push('JavaScript: '+e.message));
    const url = new URL(base); url.hash = route;
    try {
      const response = await page.goto(url.toString(), {waitUntil:'domcontentloaded',timeout:45000});
      if (!response || response.status() >= 400) issues.push('HTTP '+(response && response.status()));
      await page.waitForSelector('.hero > picture img', {timeout:15000});
      await page.waitForFunction(() => { const i=document.querySelector('.hero > picture img'); return i && i.complete; }, {timeout:15000});
      await page.waitForTimeout(1200);
      const check = await page.evaluate(() => {
        const image = document.querySelector('.hero > picture img');
        const nav = document.querySelector('.art-nav');
        const ir = image?.getBoundingClientRect();
        const nr = nav?.getBoundingClientRect();
        return {
          imageLoaded: !!image?.naturalWidth,
          imageWidth: image?.naturalWidth || 0,
          imageHeight: image?.naturalHeight || 0,
          imageUrl: image?.currentSrc || '',
          navCount: document.querySelectorAll('.art-nav').length,
          navVisible: !!nr && nr.height > 20,
          navOverlapsImage: !!ir && !!nr && nr.bottom > ir.top + 2,
          imageClippedAtTop: !!ir && ir.top < (nr?.bottom || 0) - 2,
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 4
        };
      });
      if (!check.imageLoaded) issues.push('Hero image failed to load');
      if (check.navCount !== 1 || !check.navVisible) issues.push('Missing or duplicate functional navigation');
      if (check.navOverlapsImage || check.imageClippedAtTop) issues.push('Navigation overlaps/crops hero');
      if (check.horizontalOverflow) issues.push('Horizontal overflow');
      await page.screenshot({path:path.join('artifacts/desktop',route+'.png'),fullPage:true,animations:'disabled'});
      report.push({route,url:url.toString(),...check,issues});
    } catch (e) {
      issues.push('Navigation/test failure: '+e.message);
      report.push({route,url:url.toString(),issues});
      await page.screenshot({path:path.join('artifacts/desktop',route+'.png'),fullPage:true}).catch(()=>{});
    }
    if (issues.length) failed = true;
    console.log(route,issues.length ? 'FAIL '+issues.join('; ') : 'PASS');
    await page.close();
  }
  await browser.close();
  fs.writeFileSync('artifacts/report.json',JSON.stringify({testedAt:new Date().toISOString(),base,routes:report},null,2));
  if (failed) process.exitCode = 1;
})().catch(e=>{console.error(e);process.exitCode=1});
