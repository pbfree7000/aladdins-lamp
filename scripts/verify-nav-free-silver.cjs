const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),routes=['home','hunt','silver','apothecary','underground','fresh','journal'],widths=[375,430,768,1024,1440,1920];
const server=http.createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+(p==='/'?'/index.html':p));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}try{const ext=path.extname(file);res.writeHead(200,{'content-type':{'.html':'text/html','.jpg':'image/jpeg','.png':'image/png','.json':'application/json','.webp':'image/webp'}[ext]||'application/octet-stream'});res.end(fs.readFileSync(file))}catch{res.writeHead(404);res.end('Not found')}});
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch();fs.mkdirSync('artifacts/nav-free-silver',{recursive:true});
try{
for(const width of widths){const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://journal-feed.aladdinslamp.xyz/api/articles',r=>r.fulfill({status:200,contentType:'application/json',body:'{"posts":[]}'}));
for(const key of routes){await page.goto(base+'/#'+key,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('.hero picture img')?.complete,{timeout:13000});
const st=await page.evaluate(()=>{const hero=document.querySelector('.hero'),img=hero.querySelector('picture img'),clean=document.querySelector('.clean-top-nav'),old=document.querySelector('.image-nav'),silver=hero.dataset.page==='silver',active=clean?.querySelector('a[aria-current="page"]');return{silver,source:img.currentSrc,loaded:img.naturalWidth>0,realNav:!!clean,oldNav:!!old,barBottom:clean?.getBoundingClientRect().bottom||0,heroTop:hero.getBoundingClientRect().top,active:active?.textContent,links:clean?.querySelectorAll('a').length||0,overflow:document.documentElement.scrollWidth>innerWidth+3,artWidth:img.naturalWidth}});
assert.ok(st.loaded,width+'px '+key+' art must load');
assert.equal(st.overflow,false,width+'px '+key+' horizontal overflow');
if(key==='silver'){
 assert.ok(st.realNav&&!st.oldNav,width+'px Silver must have one standalone real nav');
 assert.equal(st.source.endsWith('/assets/silver-vault-navfree.jpg'),true,width+'px Silver source must be clean');
 assert.equal(st.links,7,width+'px Silver must have 7 functioning links');
 assert.equal(st.active,'Silver Vault',width+'px active section must be Silver Vault');
 assert.ok(st.heroTop>=st.barBottom-2,width+'px navigation must sit above art');
 assert.ok(st.artWidth>=1600,width+'px image must have high resolution');
 if(width>=1280){assert.equal(await page.locator('.clean-top-nav').isVisible(),true);assert.ok(await page.locator('.clean-top-nav a[href="#journal"]').isVisible())}
 if(width===375||width===1440)await page.screenshot({path:'artifacts/nav-free-silver/silver-'+width+'.png',animations:'disabled'});
}else assert.ok(!st.realNav,width+'px '+key+' stale Silver nav after page change');
}
await page.goto(base+'/#silver',{waitUntil:'domcontentloaded'});
if(width>=1280){
 await page.locator('.clean-top-nav a[href="#journal"]').click();assert.equal(new URL(page.url()).hash,'#journal','Desktop link from clean header');
 await page.goto(base+'/#silver',{waitUntil:'domcontentloaded'});
 await page.locator('.clean-top-nav input[type=search]').fill('silver');await page.locator('.clean-top-nav input[type=search]').press('Enter');assert.equal(new URL(page.url()).hash,'#search/silver','Desktop search');
}else{
 await page.locator('#menuToggle').click();assert.equal(await page.locator('#menu').isVisible(),true,'Mobile Explore opens');
 await page.locator('#mobileSearch').fill('silver');await page.locator('#mobileSearch').press('Enter');assert.equal(new URL(page.url()).hash,'#search/silver','Mobile search works');
}
assert.deepEqual(errors,[],width+'px no JS errors');console.log('PASS',width,'Silver clean art and routes');await page.close();
}
}finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
