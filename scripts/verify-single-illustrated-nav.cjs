const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.json':'application/json','.css':'text/css','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const full=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!full.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 try{res.writeHead(200,{'content-type':types[path.extname(full)]||'application/octet-stream'});res.end(fs.readFileSync(full))}
 catch{res.writeHead(404);res.end('Not found')}
});
const routes=['home','hunt','silver','apothecary','underground','fresh','journal'];
const viewports=[375,430,768,1024,1280,1440,1920];
async function main(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 fs.mkdirSync('artifacts/single-nav',{recursive:true});
 const browser=await chromium.launch({headless:true});
 const report=[];let failures=0;
 try {
  for(const width of viewports){
   const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://journal-feed.aladdinslamp.xyz/api/articles',r=>r.fulfill({status:200,contentType:'application/json',body:'{"posts":[]}'}));
   for(const route of routes){
    await page.goto(base+'/#'+route,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>{const i=document.querySelector('.hero picture img');return i?.complete&&i?.naturalWidth>0},{timeout:15000});
    if(route==='journal')await page.locator('.journal-room').first().waitFor({timeout:12000});
    const state=await page.evaluate(()=>{
     const hero=document.querySelector('.hero'),rect=hero.getBoundingClientRect();
     const painted=document.querySelector('.image-nav');
     const menu=document.querySelector('#menuToggle');
     const search=document.querySelector('.hero>.search-form');
     return {
      artNavCount:document.querySelectorAll('.art-nav').length,
      heroTop:rect.top,
      heroImageCount:hero.querySelectorAll(':scope > picture').length,
      paintedNavVisible:!!painted&&getComputedStyle(painted).display!=='none',
      linkCount:painted?.querySelectorAll('.illustrated-links a').length||0,
      activeLink:painted?.querySelector('.illustrated-links a[aria-current="page"]')?.textContent||null,
      panelRight:painted?.querySelector('.illustrated-links')?.getBoundingClientRect().right||0,
      paintedLinksClickable:painted?[...painted.querySelectorAll('.illustrated-links a')].every(el=>getComputedStyle(el).pointerEvents==='auto'&&getComputedStyle(el).fontSize!=='0px'&&el.getBoundingClientRect().width>40):false,
      searchVisible:!!search&&getComputedStyle(search).display!=='none',
      exploreVisible:!!menu&&getComputedStyle(menu).display!=='none',
      explorePosition:menu?getComputedStyle(menu).position:null,
      exploreBottom:menu?.getBoundingClientRect().bottom||0,
      viewportHeight:innerHeight,
      currentScrollY:scrollY,
      horizontalOverflow:document.documentElement.scrollWidth>innerWidth+3
     }
    });
    const label=width+' '+route;
    assert.equal(state.artNavCount,0,label+' still creates a second visual nav');
    assert.ok(state.heroTop<=3,label+' art pushed down: '+state.heroTop);
    assert.equal(state.heroImageCount,1,label+' unexpected art');
    assert.equal(state.horizontalOverflow,false,label+' horizontal overflow');
    if(width>=1280){
     assert.ok(state.paintedNavVisible&&state.linkCount===7&&state.paintedLinksClickable,label+' visible illustrated nav inactive');
     assert.ok(state.activeLink,label+' active page is not indicated');
     if(route==='home')assert.ok(state.panelRight>width*.79&&state.panelRight<width*.86,label+' Home nav must mask baked section labels');
     else assert.ok(state.panelRight<width*.405,label+' header panel extends across logo');
     if(route!=='home')assert.ok(state.searchVisible,label+' illustrated search overlay unavailable');
     assert.equal(state.exploreVisible,false,label+' redundant floating Explore');
    }else{
     assert.equal(state.paintedNavVisible,false,label+' tiny picture links should not be touchscreen targets');
     assert.ok(state.exploreVisible,label+' phone Explore missing');
     assert.ok(state.exploreBottom<state.viewportHeight/3,label+' mobile Explore should be over top artwork, never article text');
     assert.equal(state.searchVisible,false,label+' painted search overlay should not cover mobile hero');
    }
    if((width===375||width===1440)&&(route==='journal'||route==='hunt'||route==='home'||route==='silver'||route==='apothecary')){
     await page.waitForTimeout(350);await page.screenshot({path:path.join('artifacts/single-nav',route+'-'+width+'.png'),animations:'disabled'});
    }
    report.push({width,route,...state});
    console.log('PASS: '+label+' single painted navigation');
   }
   await page.goto(base+'/#journal',{waitUntil:'domcontentloaded'});
   if(width>=1280){
    await page.locator('.image-nav .illustrated-links a[href="#silver"]').click();
    assert.equal(new URL(page.url()).hash,'#silver',width+' painted link should navigate');
    await page.locator('.illustrated-more').click();
    assert.equal(await page.locator('#menu').isVisible(),true,width+' painted hamburger must open menu');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#menu').isVisible(),false,'Escape should close menu');
    const input=page.locator('.hero>.search-form input[type="search"]');
    await input.fill('silver');
    await input.press('Enter');
    assert.equal(new URL(page.url()).hash,'#search/silver',width+' painted search should work');
   }else{
    await page.locator('#menuToggle').click();
    assert.equal(await page.locator('#menu').isVisible(),true,width+' mobile Explore should open');
    await page.locator('#mobileSearch').fill('silver');
    await page.locator('#mobileSearch').press('Enter');
    assert.equal(new URL(page.url()).hash,'#search/silver',width+' mobile search route');
   }
   assert.deepEqual(errors,[],width+' no JS errors');
   await page.close();
  }
 }finally{await browser.close();server.close()}
 fs.writeFileSync('artifacts/single-nav/report.json',JSON.stringify({testedAt:new Date().toISOString(),checks:report},null,2));
 console.log('PASS: '+report.length+' legible single-navigation route/viewport checks and all interactions');
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1});
