const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const rawBase = process.env.SITE_URL || 'https://aladdinslamp.xyz/';
const base = rawBase + (rawBase.includes('?')?'&':'?') + 'qa_revision=' + encodeURIComponent((process.env.GITHUB_SHA||'current').slice(0,12));
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
      const painted=document.querySelector('.image-nav'),clean=document.querySelector('.clean-top-nav'),toggle=document.getElementById('menuToggle');
      const form=document.querySelector('.hero > .search-form');
      const r=hero?.getBoundingClientRect();
      return {
       imageLoaded:!!image?.naturalWidth,imageWidth:image?.naturalWidth||0,imageHeight:image?.naturalHeight||0,
       imageUrl:image?.currentSrc||'',heroTop:r?.top||0,
       extraNavCount:document.querySelectorAll('.art-nav').length,
       cleanNavCount:document.querySelectorAll('.clean-top-nav').length,
       cleanNavLinks:clean?.querySelectorAll('.illustrated-links a').length||0,
       cleanNavActive:clean?.querySelector('.illustrated-links a[aria-current="page"]')?.textContent||'',
       cleanNavLabel:clean?.dataset.currentLabel||'',
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
     if(c.extraNavCount!==0||c.cleanNavCount!==1||c.cleanNavLinks!==7||!c.cleanNavActive)issues.push('Site must use one real seven-section navigation');
     if(c.paintedNavActive)issues.push('Illustrated navigation must not reappear over the hero');
     const labelByRoute={home:'Home',hunt:'Treasure Hunt',silver:'Silver Vault',apothecary:'Rachael’s Apothecary',underground:'Autumn’s Underground',fresh:'Fresh Finds',journal:'Treasure Journal'};
     if(c.cleanNavLabel!==labelByRoute[route])issues.push('Incorrect mobile page heading: '+c.cleanNavLabel);

     if(c.horizontalOverflow)issues.push('Horizontal overflow');
     const expectedHero={home:'home-navfree.jpg',hunt:'treasure-hunt-navfree-fixed.jpg',silver:'silver-vault-navfree.jpg',apothecary:'rachaels-apothecary-navfree-fixed.jpg',underground:'autumns-underground-navfree-fixed.jpg',fresh:'fresh-finds-navfree-fixed.jpg',journal:'treasure-journal-navfree-fixed.jpg'};
     if(!(route==='home'&&viewport.width<=680)&&!c.imageUrl.endsWith('/'+expectedHero[route]))issues.push('Incorrect navigation-free hero artwork: '+c.imageUrl);
     if(viewport.width>=1280){
       if(c.exploreVisible)issues.push('Second floating Explore control on desktop');
     }else{
       if(!c.exploreVisible)issues.push('Mobile Explore control missing');
     }
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
    if(width>=1280){
     await page.locator('.clean-top-nav a[href="#silver"]').click();
     if(new URL(page.url()).hash!=='#silver')issues.push('Journal to Silver link failed');
     try{await page.locator('.clean-top-nav a[aria-current="page"]').waitFor({state:'visible',timeout:10000})}catch{issues.push('Silver active tab missing')}
     await page.locator('.clean-top-nav a[href="#journal"]').click();
     if(new URL(page.url()).hash!=='#journal')issues.push('Silver to Journal link failed');
     if(await page.locator('.clean-top-nav .illustrated-more').isVisible()){
       await page.locator('.clean-top-nav .illustrated-more').click();
       if(!(await page.locator('#menu').isVisible()))issues.push('Explore menu failed');
       await page.keyboard.press('Escape');
     }
     await page.locator('.clean-top-nav input[type="search"]').fill('silver');
     await page.locator('.clean-top-nav input[type="search"]').press('Enter');
     try{await page.waitForFunction(()=>location.hash==='#search/silver',{timeout:6000})}catch{const source=await page.evaluate(()=>document.documentElement.outerHTML.includes('const runSearch=()=>'));issues.push('Header search failed: '+new URL(page.url()).hash+'; updated handler loaded='+source)}
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

// Nav-free seven-room release gate: image sources must never contain baked navigation.
