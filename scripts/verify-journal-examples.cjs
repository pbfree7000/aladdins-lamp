const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.json':'application/json','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg'};
const sampleSlugs=['sample-rachaels-apothecary-tea-tray','sample-mikes-silver-field-notes'];
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 try{res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file))}
 catch{res.writeHead(404);res.end('Not found')}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 const checks=[];
 try{
  for(const width of [375,430,768,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://journal-feed.aladdinslamp.xyz/api/articles',r=>r.fulfill({status:200,contentType:'application/json',body:'{"posts":[]}'}));
   await page.route('https://images.unsplash.com/**',r=>r.fulfill({status:200,contentType:'image/png',body:image}));
   const inspect=async url=>{
    await page.goto(base+'/'+url,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#journal')?.hidden===false,{timeout:15000});
    await page.waitForTimeout(120);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3),'No horizontal overflow at '+width+' '+url);
   };
   await inspect('#journal');
   await page.getByText('The Little Ritual of a Tea Tray').first().waitFor({timeout:8000});
   await page.getByText('The Silver Spoon That Makes You Look Twice').first().waitFor({timeout:8000});
   assert.equal(await page.locator('#journal .journal-sample-tag').count(),2);
   await inspect('#journal/collection/rachael');
   await page.getByText('The Little Ritual of a Tea Tray').first().waitFor({timeout:8000});
   assert.equal(await page.getByText('The Silver Spoon That Makes You Look Twice').count(),0);
   await inspect('#journal/collection/mike');
   await page.getByText('The Silver Spoon That Makes You Look Twice').first().waitFor({timeout:8000});
   assert.equal(await page.getByText('The Little Ritual of a Tea Tray').count(),0);
   await inspect('#journal/collection/silver');
   await page.getByText('The Silver Spoon That Makes You Look Twice').first().waitFor({timeout:8000});
   for(const slug of sampleSlugs){
    await inspect('#journal/'+slug);
    await page.locator('#journal .journal-sample-banner').waitFor({timeout:8000});
    assert.equal(await page.locator('#journal article img').count(),2,'Cover and inline photo required '+slug);
    const loaded=await page.locator('#journal article img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth>0));
    assert.ok(loaded,'Sample images must load '+slug);
    assert.equal(await page.locator('#journal figure figcaption').count(),1,'Caption missing '+slug);
    assert.equal(await page.locator('#journal .sharebar a').count(),2,'Facebook and Pinterest links missing');
    assert.equal(await page.locator('#journal .sharebar button').count(),2,'Native share/copy link controls missing');
    assert.ok((await page.locator('#journal .sharebar a').first().getAttribute('href')).includes(encodeURIComponent(slug)),'Facebook link should include story URL');
   }
   assert.deepEqual(errors,[],'No JavaScript errors at '+width);
   checks.push({width,result:'PASS'});
   console.log('PASS: samples and share controls at '+width+'px');
   await page.close();
  }
  console.log('ALL SAMPLE QA PASSED',JSON.stringify(checks));
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
