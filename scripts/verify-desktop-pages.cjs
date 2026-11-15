const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.SITE_URL || 'https://aladdinslamp.xyz/';
const routes = ['home','hunt','silver','apothecary','underground','fresh','journal'];
const viewports = [
 {name:'desktop',width:1920,height:1080,screenshots:true},
 {name:'tablet',width:768,height:1024,screenshots:true},
 {name:'phone',width:375,height:812,screenshots:true},
 {name:'large-phone',width:430,height:932,screenshots:false}
];
(async () => {
 const browser = await chromium.launch({headless:true});
 const report = [], errors = [];
 let failed = false;
 try {
  for(const viewport of viewports) {
   const folder=path.join('artifacts',viewport.name);
   if(viewport.screenshots)fs.mkdirSync(folder,{recursive:true});
   for(const route of routes) {
    const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1});
    const issues=[];
    page.on('pageerror',e=>issues.push('JavaScript: '+e.message));
    const url=new URL(base);url.hash=route;
    try {
     const response=await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:45000});
     if(!response||response.status()>=400)issues.push('HTTP '+(response&&response.status()));
     await page.waitForSelector('.hero > picture img',{timeout:15000});
     await page.waitForFunction(()=>{const im=document.querySelector('.hero > picture img');return im&&im.complete},{timeout:15000});
     if(route==='journal')await page.locator('#journal .journal-room').first().waitFor({timeout:10000});
     else await page.waitForTimeout(250);
     const c=await page.evaluate(()=>{
      const image=document.querySelector('.hero > picture img');
      const nav=document.querySelector('.art-nav');
      const links=nav?.querySelector('.nav-links');
      const chosen=links?.querySelector('[aria-current="page"]');
      const ir=image?.getBoundingClientRect(),nr=nav?.getBoundingClientRect(),cr=links?.getBoundingClientRect(),sr=chosen?.getBoundingClientRect();
      const toggle=document.getElementById('menuToggle');
      return {
       imageLoaded:!!image?.naturalWidth,
       imageWidth:image?.naturalWidth||0,imageHeight:image?.naturalHeight||0,imageUrl:image?.currentSrc||'',
       navCount:document.querySelectorAll('.art-nav').length,
       navVisible:!!nr&&nr.height>30,
       navOverlapsImage:!!ir&&!!nr&&nr.bottom>ir.top+2,
       imageClippedAtTop:!!ir&&ir.top<(nr?.bottom||0)-2,
       horizontalOverflow:document.documentElement.scrollWidth>innerWidth+4,
       currentNavVisible:!!sr&&!!cr&&sr.left>=cr.left-7&&sr.right<=cr.right+7,
       activeLinkCount:links?.querySelectorAll('[aria-current="page"]').length||0,
       touchNavHeight:chosen?.getBoundingClientRect().height||0,
       exploreVisible:!!toggle&&toggle.getBoundingClientRect().height>=40,
       journalRooms:document.querySelectorAll('#journal .journal-room').length
      }
     });
     if(!c.imageLoaded)issues.push('Hero artwork failed to load');
     if(c.navCount!==1||!c.navVisible)issues.push('Missing/duplicate navigation');
     if(c.navOverlapsImage||c.imageClippedAtTop)issues.push('Navigation overlaps/crops approved artwork');
     if(c.horizontalOverflow)issues.push('Horizontal overflow');
     if(!c.currentNavVisible||c.activeLinkCount!==1)issues.push('Current section not visible/identified in navigation');
     if(!c.exploreVisible)issues.push('Explore menu missing/too small');
     if(viewport.width<=980&&c.touchNavHeight<42)issues.push('Mobile navigation tap target too small');
     if(viewport.width<=680&&route==='fresh'&&!c.imageUrl.endsWith('/fresh-finds-mobile.jpg'))issues.push('Wrong Fresh Finds mobile artwork: '+c.imageUrl);
     if(route==='journal'&&c.journalRooms!==3)issues.push('Journal collections not rendered');
     if(viewport.screenshots)await page.screenshot({path:path.join(folder,route+'.png'),fullPage:true,animations:'disabled'});
     report.push({viewport:viewport.name,width:viewport.width,height:viewport.height,route,url:url.toString(),...c,issues});
    }catch(e){
     issues.push('Navigation/test failure: '+e.message);
     report.push({viewport:viewport.name,width:viewport.width,route,url:url.toString(),issues});
     if(viewport.screenshots)await page.screenshot({path:path.join(folder,route+'.png'),fullPage:true}).catch(()=>{});
    }
    if(issues.length)failed=true;
    console.log(viewport.name+' '+route+': '+(issues.length?'FAIL '+issues.join('; '):'PASS'));
    await page.close();
   }
  }

  // Also verify the two public example journal articles, including their actual image URLs.
  for(const width of [375,1440]){
   for(const slug of ['sample-rachaels-apothecary-tea-tray','sample-mikes-silver-field-notes']){
    const page=await browser.newPage({viewport:{width,height:900}});
    const issues=[];const url=new URL(base);url.hash='journal/'+slug;
    page.on('pageerror',e=>issues.push('JavaScript: '+e.message));
    try{
     await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:45000});
     await page.waitForSelector('#journal .journal-sample-banner',{timeout:15000});
     await page.waitForFunction(()=>{
      const images=[...document.querySelectorAll('#journal article img')];
      return images.length===2&&images.every(im=>im.complete&&im.naturalWidth>0)
     },{timeout:20000});
     const check=await page.evaluate(()=>({
      imageCount:document.querySelectorAll('#journal article img').length,
      captions:document.querySelectorAll('#journal figure figcaption').length,
      socialLinks:document.querySelectorAll('#journal .sharebar a').length,
      socialButtons:document.querySelectorAll('#journal .sharebar button').length,
      horizontalOverflow:document.documentElement.scrollWidth>innerWidth+3
     }));
     if(check.imageCount!==2||check.captions!==1)issues.push('Missing cover or captioned inline image');
     if(check.socialLinks!==2||check.socialButtons!==2)issues.push('Missing share actions');
     if(check.horizontalOverflow)issues.push('Horizontal overflow');
     report.push({viewport:'sample-'+width,width,route:slug,url:url.toString(),...check,issues});
    }catch(e){issues.push('Sample/article image failure: '+e.message);report.push({viewport:'sample-'+width,width,route:slug,url:url.toString(),issues})}
    if(issues.length)failed=true;
    console.log('sample '+width+' '+slug+': '+(issues.length?'FAIL '+issues.join('; '):'PASS'));
    await page.close();
   }
  }
 }finally{await browser.close()}
 fs.mkdirSync('artifacts',{recursive:true});
 fs.writeFileSync('artifacts/report.json',JSON.stringify({testedAt:new Date().toISOString(),base,viewports,routes:report},null,2));
 console.log('Verified '+report.length+' page/viewport combinations; '+report.filter(x=>x.issues.length).length+' failures.');
 if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
