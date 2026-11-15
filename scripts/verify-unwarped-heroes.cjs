const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.json':'application/json','.js':'application/javascript'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const pathname=decodeURIComponent(url.pathname);
 const full=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!full.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 try{const buf=fs.readFileSync(full);res.writeHead(200,{'content-type':types[path.extname(full)]||'application/octet-stream'});res.end(buf)}
 catch{res.writeHead(404);res.end('Missing file')}
});
const paths={hunt:'treasure-hunt-navfree-fixed.jpg',fresh:'fresh-finds-navfree-fixed.jpg',apothecary:'rachaels-apothecary-navfree-fixed.jpg',underground:'autumns-underground-navfree-fixed.jpg',journal:'treasure-journal-navfree-fixed.jpg',home:'home-navfree.jpg',silver:'silver-vault-navfree.jpg'};
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 const log=[];
 try{
  for(const width of [375,430,768,1440,1920]){
   const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
   const errors=[];page.on('pageerror',err=>errors.push(err.message));
   await page.route('https://journal-feed.aladdinslamp.xyz/api/articles',r=>r.fulfill({status:200,contentType:'application/json',body:'{"posts":[]}'}));
   fs.mkdirSync('artifacts/restored-heroes',{recursive:true});
   for(const route of Object.keys(paths)){
    await page.goto(base+'/#'+route,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>{const im=document.querySelector('.hero picture img');return im?.complete&&im?.naturalWidth>0},{timeout:12000});
    const state=await page.evaluate(()=>{
     const im=document.querySelector('.hero picture img'),nav=document.querySelector('.clean-top-nav');
     return {
      currentSrc:im?.currentSrc||'',
      naturalWidth:im?.naturalWidth||0,
      menuLabel:nav?.dataset.currentLabel||'',
      active:nav?.querySelectorAll('.illustrated-links a[aria-current="page"]').length||0,
      linkCount:nav?.querySelectorAll('.illustrated-links a').length||0,
      navCount:document.querySelectorAll('.clean-top-nav').length,
      overflow:document.documentElement.scrollWidth>innerWidth+3
     }
    });
    const expected=width<=680&&route==='home'?'Aladdin%E2%80%99s%20Lamp%20Hidden%20Treasures%20Poster.png':paths[route];
    assert.ok(decodeURI(state.currentSrc).endsWith(decodeURI(expected)),route+' '+width+': wrong asset: '+state.currentSrc);
    assert.ok(state.naturalWidth>0,route+' '+width+': hero failed');
    assert.equal(state.navCount,1,route+' '+width+': duplicate or missing functional header');
    assert.equal(state.linkCount,7,route+' '+width+': missing section links');
    assert.equal(state.active,1,route+' '+width+': active link not indicated');
    assert.equal(state.overflow,false,route+' '+width+': horizontal overflow');
    if((width===375||width===1440)&&['apothecary','hunt','fresh','underground','journal'].includes(route)){
     await page.waitForTimeout(125);
     await page.screenshot({path:'artifacts/restored-heroes/'+route+'-'+width+'.png',animations:'disabled'});
    }
    log.push({route,width,asset:expected,result:'PASS'});
   }
   assert.deepEqual(errors,[],'Browser JS errors at '+width+'px');
   await page.close();
  }
  console.log('PASS: '+log.length+' restored hero source/nav checks across five viewports');
  fs.writeFileSync('artifacts/restored-heroes/browser-audit.json',JSON.stringify(log,null,2));
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
