const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.json':'application/json'};
const target='fresh-finds-navfree-fixed.jpg';
async function run(){
 let server,base=process.env.SITE_URL;
 if(!base){
  server=http.createServer((req,res)=>{
   const location=new URL(req.url,'http://localhost').pathname;
   const file=path.resolve(root,'.'+(location==='/'?'/index.html':decodeURIComponent(location)));
   if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
   try{res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file))}
   catch{res.writeHead(404);res.end('Not found')}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base='http://127.0.0.1:'+server.address().port+'/';
 }
 const browser=await chromium.launch({headless:true});
 const report=[];
 try{
  for(const width of [375,1440]){
   const page=await browser.newPage({viewport:{width,height:850},deviceScaleFactor:1});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://journal-feed.aladdinslamp.xyz/api/articles',route=>route.fulfill({status:200,contentType:'application/json',body:'{"posts":[]}'}));
   let unblock;const hold=new Promise(resolve=>{unblock=resolve});
   await page.route('**/'+target,async route=>{await hold;await route.continue()});
   await page.goto(base+'#home',{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>document.querySelector('#hero')?.dataset.page==='home'&&document.querySelector('#hero>picture img')?.naturalWidth>0,{timeout:15000});
   const previous=await page.locator('#hero>picture img').getAttribute('src');
   await page.evaluate(()=>{location.hash='#fresh'});
   await page.waitForTimeout(240);
   let state=await page.evaluate(()=>({
    route:location.hash,
    displayed:document.querySelector('#hero')?.dataset.page,
    image:document.querySelector('#hero>picture img')?.getAttribute('src'),
    naturalWidth:document.querySelector('#hero>picture img')?.naturalWidth,
    heroHeight:document.querySelector('#hero')?.getBoundingClientRect().height,
    bg:getComputedStyle(document.querySelector('#hero')).backgroundColor,
    scrollY:scrollY
   }));
   assert.equal(state.route,'#fresh','Navigation must update URL immediately at '+width);
   assert.equal(state.displayed,'home','Old hero must stay visible during slow network at '+width);
   assert.equal(state.image,previous,'Do not discard old artwork before new decode at '+width);
   assert.ok(state.naturalWidth>0&&state.heroHeight>180,'Never expose empty green background at '+width);
   assert.equal(state.scrollY,0,'Switch routes without smooth-scrolling through empty content at '+width);
   unblock();
   await page.waitForFunction(()=>document.querySelector('#hero')?.dataset.page==='fresh'&&document.querySelector('#hero>picture img')?.naturalWidth>0,{timeout:15000});
   await page.waitForTimeout(100);
   assert.ok((await page.locator('#hero>picture img').getAttribute('src')).endsWith(target),'New hero should appear at '+width);
   assert.equal(await page.locator('.clean-top-nav [aria-current="page"]').textContent(), 'Fresh Finds');
   // Two rapid navigations must resolve to the latest selected route.
   await page.evaluate(()=>{location.hash='#silver';location.hash='#apothecary'});
   await page.waitForFunction(()=>document.querySelector('#hero')?.dataset.page==='apothecary'&&document.querySelector('#hero>picture img')?.naturalWidth>0,{timeout:15000});
   assert.equal(await page.locator('.clean-top-nav [aria-current="page"]').textContent(),'Apothecary');
   assert.deepEqual(errors,[],'JavaScript errors at '+width);
   report.push({width,slowImageHeldPrevious:state.displayed,oldImageRetained:true,final:'apothecary',result:'PASS'});
   console.log('PASS no-flash transition at '+width+'px including delayed hero and rapid navigation');
   await page.close();
  }
 }finally{
  await browser.close();
  if(server)await new Promise(resolve=>server.close(resolve));
 }
 fs.mkdirSync('artifacts',{recursive:true});
 fs.writeFileSync('artifacts/no-flash-navigation.json',JSON.stringify(report,null,2)+'\n');
}
run().catch(err=>{console.error(err);process.exitCode=1});
