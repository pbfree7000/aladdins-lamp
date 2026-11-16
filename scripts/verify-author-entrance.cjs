const {chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.json':'application/json','.css':'text/css'};
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const full=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!full.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 try{res.writeHead(200,{'content-type':types[path.extname(full)]||'application/octet-stream'});res.end(fs.readFileSync(full))}
 catch{res.writeHead(404);res.end('Not found')}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port+'/';
 const browser=await chromium.launch({headless:true});
 const checks=[];fs.mkdirSync('artifacts/author-login',{recursive:true});
 try{
  for(const width of [375,430,768,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.route('https://journal-feed.aladdinslamp.xyz/api/articles',route=>route.fulfill({status:200,contentType:'application/json',body:'{"posts":[]}'}));
   await page.goto(base+'#journal',{waitUntil:'domcontentloaded'});
   await page.locator('.journal-author-entry a').waitFor({timeout:15000});
   assert.equal(await page.locator('.journal-author-entry a').getAttribute('href'),'/journal/author.html');
   assert.equal(await page.locator('.journal-author-entry').count(),1);
   assert.equal(await page.locator('.journal-room').count(),3,'Public Journal must remain readable');
   assert.equal(await page.locator('footer a[href="/journal/author.html"]').count(),1);
   await page.locator('.journal-author-entry a').click();
   await page.waitForURL('**/journal/author.html');
   await page.getByRole('heading',{name:'The Writing Desk'}).waitFor();
   const secure=page.locator('a.login');
   assert.equal(await secure.getAttribute('href'),'https://journal-api.aladdinslamp.xyz/desk');
   assert.equal(await page.getByText(/do not need to create a Cloudflare account/i).count(),1);
   assert.equal(await page.getByText(/authorized email address/i).count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3),true,'No mobile horizontal overflow');
   await page.screenshot({path:'artifacts/author-login/author-'+width+'.png',fullPage:true,animations:'disabled'});
   await page.goto(base+'journal/write.html',{waitUntil:'domcontentloaded'});
   await page.waitForURL('**/journal/author.html');
   await page.goto(base+'#journal/collection/rachael',{waitUntil:'domcontentloaded'});
   await page.locator('.journal-author-entry a').waitFor({timeout:15000});
   await page.goto(base+'#journal/collection/mike',{waitUntil:'domcontentloaded'});
   await page.locator('.journal-author-entry a').waitFor({timeout:15000});
   await page.goto(base+'#journal',{waitUntil:'domcontentloaded'});
   if(width<1280){
    await page.locator('#menuToggle').click();
    await page.locator('#menu a[href="/journal/author.html"]').waitFor({timeout:4000});
   } else {
    assert.equal(await page.locator('.journal-author-entry a').getAttribute('href'),'/journal/author.html');
   }
   assert.deepEqual(errors,[],'No JS errors at '+width);
   checks.push({width,result:'PASS'});console.log('PASS author sign-in entrance '+width+'px');
   await page.close();
  }
  console.log('PASS '+checks.length+' responsive author entrance tests');
 }finally{await browser.close();server.close()}
 fs.writeFileSync('artifacts/author-login/results.json',JSON.stringify(checks,null,2));
})().catch(err=>{console.error(err);server.close();process.exitCode=1});
