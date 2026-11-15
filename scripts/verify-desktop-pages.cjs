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
     // The approved hero itself contains a painted navigation bar. A DOM bar above it is a visual regression.
     const c=await page.evaluate(()=>{
      const image=document.querySelector('.hero > picture img'),hero=document.querySelector('.hero');
      const painted=document.querySelector('.image-nav'),toggle=document.getElementById('menuToggle');
      const form=document.querySelector('.hero > .search-form');
      const r=hero?.getBoundingClientRect();
      return {
       imageLoaded:!!image?.naturalWidth,imageWidth:image?.naturalWidth||0,imageHeight:image?.naturalHeight||0,
       imageUrl:image?.currentSrc||'',heroTop:r?.top||0,
       extraNavCount:document.querySelectorAll('.art-nav').length,
       paintedNavActive:!!painted&&getComputedStyle(painted).display!=='none',
       paintedLinkCount:painted?.querySelectorAll('.illustrated-links a').length||0,
       navLinksClickable:painted?[...painted.querySelectorAll('.illustrated-links a')].every(a=>getComputedStyle(a).pointerEvents==='auto'&&getComputedStyle(a).fontSize!=='0px'&&a.getBoundingClientRect().width>40):false,
       activeLink:painted?.querySelector('.illustrated-links a[aria-current="page"]')?.textContent||'',
       visibleNavText:painted?[...painted.querySelectorAll('.illustrated-links a')].map(el=>el.textContent?.trim()).join('|'):'',
       activeNavClearlyVisible:!!painted?.querySelector('.illustrated-links a[aria-current="page"]')&&getComputedStyle(painted.querySelector('.illustrated-links a[aria-current="page"]')).fontSize!=='0px',
       imageSearchVisible:!!form&&getComputedStyle(form).display!=='none',
       exploreVisible:!!toggle&&getComputedStyle(toggle).display!=='none'&&toggle.getBoundingClientRect().height>=40,
       exploreBottom:toggle?.getBoundingClientRect().bottom||0,
       horizontalOverflow:document.documentElement.scrollWidth>innerWidth+4,
       journalRooms:document.querySelectorAll('#journal .journal-room').length
      }
     });
     if(!c.imageLoaded)issues.push('Hero artwork failed to load');
     if(c.extraNavCount!==0||c.heroTop>3)issues.push('Duplicate navigation above approved artwork');
     if(c.horizontalOverflow)issues.push('Horizontal overflow');
     if(viewport.width>=1280){
      if(!c.paintedNavActive||c.paintedLinkCount!==7||!c.navLinksClickable||!c.activeLink||!c.activeNavClearlyVisible)issues.push('Visible desktop navigation is not readable or functional');
      if(route!=='home'&&!c.imageSearchVisible)issues.push('Illustrated desktop search is not functional');
      if(c.exploreVisible)issues.push('Duplicate floating Explore control on desktop');
     }else{
      if(c.paintedNavActive)issues.push('Tiny painted links in mobile mode');
      if(!c.exploreVisible||c.exploreBottom>viewport.height/3)issues.push('Mobile Explore is missing or overlays story text');
     }
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


  // Exercise the real navigation in the image, not merely its hidden DOM structure.
  for(const width of [375,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});
   const issues=[];
   try{
    await page.goto(new URL(base+'#journal').toString(),{waitUntil:'domcontentloaded'});
    if(width>980){
     await page.locator('.image-nav .illustrated-links a[href="#silver"]').click();
     if(new URL(page.url()).hash!=='#silver')issues.push('Painted Silver Vault link failed');
     await page.locator('.illustrated-more').click();
     if(!(await page.locator('#menu').isVisible()))issues.push('Painted hamburger failed to open menu');
     await page.keyboard.press('Escape');
     await page.locator('.hero>.search-form input[type="search"]').fill('silver');
     await page.locator('.hero>.search-form input[type="search"]').press('Enter');
     if(new URL(page.url()).hash!=='#search/silver')issues.push('Painted search field failed');
    }else{
     await page.locator('#menuToggle').click();
     if(!(await page.locator('#menu').isVisible()))issues.push('Mobile painted hamburger failed');
     await page.locator('#mobileSearch').fill('silver');
     await page.locator('#mobileSearch').press('Enter');
     if(new URL(page.url()).hash!=='#search/silver')issues.push('Mobile search failed');
    }
   }catch(e){issues.push('Interaction error: '+e.message)}
   if(issues.length)failed=true;
   report.push({viewport:'interaction-'+width,width,route:'nav-controls',issues});
   console.log('navigation controls '+width+': '+(issues.length?'FAIL '+issues.join('; '):'PASS'));
   await page.close();
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
     const facebookHref=await page.locator('#journal .sharebar a').first().getAttribute('href');
     const shareTarget=new URL(facebookHref).searchParams.get('u');
     const expected=new URL('journal/'+slug+'.html',base).toString();
     if(shareTarget!==expected)issues.push('Facebook share target missing individual preview page');
     const previewResponse=await page.request.get(expected);
     const previewHtml=await previewResponse.text();
     if(previewResponse.status()!==200||!previewHtml.includes('property="og:title"')||!previewHtml.includes('property="og:image"')||!previewHtml.includes('property="og:description"'))issues.push('Article-specific social metadata missing');
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
