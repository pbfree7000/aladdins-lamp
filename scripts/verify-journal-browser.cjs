const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.css':'text/css'};
const server=http.createServer((req,res)=>{
 let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(name==='/desk')name='/writing-desk/index.html';
 if(name==='/')name='/index.html';
 const full=path.resolve(root,'.'+name);
 if(!full.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden')}
 try{const body=fs.readFileSync(full);res.writeHead(200,{'content-type':types[path.extname(full)]||'application/octet-stream'});res.end(body)}catch{res.writeHead(404);res.end('Not found')}
});
const mockArticle={slug:'qa-browser-article',title:'QA Browser Article',author:'Mike',category:'The Silver Vault',date:'2026-11-14',status:'published',excerpt:'QA sample for journal smoke test.',body:'This article tests the dynamic public feed.'};
const photoId='aabbccdd-1111-4111-8111-000000000001';
const richArticle={...mockArticle,slug:'qa-rich-photo',title:'QA Rich Photo',body:'ALADDIN_BLOCKS_V1:'+JSON.stringify([{kind:'text',style:'paragraph',text:'Before the photo.'},{kind:'image',id:photoId,caption:'The lucky find',size:'small',align:'right'},{kind:'text',style:'paragraph',text:'After the photo.'}])};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
async function main(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port,base='http://127.0.0.1:'+port;
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://journal-feed.aladdinslamp.xyz/api/articles',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({posts:[mockArticle,richArticle]})}));
  await page.goto(base+'/#journal',{waitUntil:'domcontentloaded'});
  await page.getByText('QA Browser Article').first().waitFor({timeout:12000});
  await page.getByText('The Art of the Find').first().waitFor({timeout:12000});
  await page.goto(base+'/#journal/qa-browser-article',{waitUntil:'domcontentloaded'});
  await page.getByText('This article tests the dynamic public feed.').waitFor({timeout:12000});
  await page.route('https://journal-feed.aladdinslamp.xyz/media/**',r=>r.fulfill({status:200,contentType:'image/png',body:png}));
  await page.goto(base+'/#journal/qa-rich-photo',{waitUntil:'domcontentloaded'});
  await page.getByText('The lucky find').waitFor({timeout:12000});
  assert.equal(await page.locator('.journal-body-photo.align-right.size-small').count(),1,'Rich body image alignment must render');
  await page.goto(base+'/#apothecary',{waitUntil:'domcontentloaded'});
  await page.locator('#journalShelf .journal-story-card').getByText('The Quiet Ritual of Tea').waitFor({timeout:12000});
  assert.equal(await page.locator('#journalShelf .journal-story-card').count(),1,'Apothecary shelf should feature only its relevant stories');
  const cardColors=await page.locator('#journalShelf .journal-story-card').first().evaluate(e=>({background:getComputedStyle(e).backgroundImage,color:getComputedStyle(e).color}));
  assert.match(cardColors.background,/gradient/i,'Embedded journal cards must have an opaque parchment background for readable copy');
  assert.equal(cardColors.color,'rgb(60, 45, 33)','Embedded journal card text should be dark brown on parchment');
  await page.goto(base+'/#fresh',{waitUntil:'domcontentloaded'});
  await page.locator('#journalShelf .journal-story-card').getByText('QA Browser Article').waitFor({timeout:12000});
  await page.goto(base+'/#silver',{waitUntil:'domcontentloaded'});
  await page.locator('#journalShelf .journal-story-card').getByText('QA Browser Article').waitFor({timeout:12000});
  await page.goto(base+'/#journal',{waitUntil:'domcontentloaded'});
  await page.locator('.journal-room').first().waitFor({timeout:12000});
  assert.equal(await page.locator('.journal-room').count(),3,'One hub must expose Rachael, Mike and Silver collections');
  await page.goto(base+'/#journal/collection/rachael',{waitUntil:'domcontentloaded'});
  await page.locator('#journal .journal-story-card').getByText('The Quiet Ritual of Tea').waitFor({timeout:12000});
  assert.equal(await page.locator('#journal .journal-story-card').getByText('The Art of the Find').count(),0,'Rachael collection must not contain general legacy story');
  await page.goto(base+'/#journal/collection/mike',{waitUntil:'domcontentloaded'});
  await page.locator('#journal .journal-story-card').getByText('QA Browser Article').waitFor({timeout:12000});
  await page.locator('#journal .journal-story-card').getByText('The Art of the Find').waitFor({timeout:12000});
  await page.goto(base+'/#journal/collection/silver',{waitUntil:'domcontentloaded'});
  await page.locator('#journal .journal-story-card').getByText('A Little Silver Knowledge').waitFor({timeout:12000});
  console.log('PASS: three themed journal collections and contextual story shelves');
  await page.goto(base+'/#search/qa',{waitUntil:'domcontentloaded'});
  await page.getByText('QA Browser Article').first().waitFor({timeout:12000});
  for(const route of ['home','silver','hunt','fresh','apothecary','underground']){
   await page.goto(base+'/#'+route,{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('main').count()>0,true,'Missing layout on '+route);
   assert.equal((await page.locator('body').innerText()).includes('const inventoryUrl'),false,'Script leaked into page on '+route);
  }

  // All seven storefront routes must work across phone, tablet and desktop widths.
  fs.mkdirSync(path.resolve(root,'artifacts/responsive'),{recursive:true});
  const viewports=[{width:375,height:812},{width:430,height:932},{width:768,height:1024},{width:1024,height:768},{width:1440,height:900}];
  const routes=['home','hunt','silver','apothecary','underground','fresh','journal'];
  let checked=0;
  for(const viewport of viewports){
   await page.setViewportSize(viewport);
   for(const key of routes){
    await page.goto(base+'/#'+key,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>{const el=document.querySelector('.hero > picture img');return !!el&&el.complete},{timeout:15000});
    const result=await page.evaluate(()=>{
     const nav=document.querySelector('.art-nav'),links=nav?.querySelector('.nav-links'),chosen=links?.querySelector('[aria-current="page"]');
     const hero=document.querySelector('.hero'),img=hero?.querySelector('picture img'),nr=nav?.getBoundingClientRect(),hr=hero?.getBoundingClientRect(),clip=links?.getBoundingClientRect(),active=chosen?.getBoundingClientRect();
     return {
      image:img?.naturalWidth||0,source:img?.currentSrc||'',
      navCount:document.querySelectorAll('.art-nav').length,
      navVisible:!!nr&&nr.height>30,
      heroClear:!!nr&&!!hr&&nr.bottom<=hr.top+3,
      noHorizontalOverflow:document.documentElement.scrollWidth<=innerWidth+3,
      active:!!chosen,
      selectedVisible:!!active&&!!clip&&active.left>=clip.left-7&&active.right<=clip.right+7,
      menuVisible:!!document.getElementById('menuToggle')?.getBoundingClientRect().width
     }
    });
    const label=viewport.width+'px '+key;
    assert.ok(result.image>0,label+': hero image failed: '+result.source);
    assert.equal(result.navCount,1,label+': duplicate navigation');
    assert.ok(result.navVisible&&result.heroClear,label+': navigation obscures hero');
    assert.ok(result.noHorizontalOverflow,label+': page horizontally overflows');
    assert.ok(result.active&&result.selectedVisible,label+': selected section is not visible in navigation');
    assert.ok(result.menuVisible,label+': Explore control missing');
    if(viewport.width===375&&key==='fresh')assert.ok(result.source.endsWith('/fresh-finds-mobile.jpg'),'Mobile Fresh Finds should use its existing artwork: '+result.source);
    if(viewport.width===375||viewport.width===1440){await page.waitForTimeout(150);await page.screenshot({path:path.join(root,'artifacts/responsive',key+'-'+viewport.width+'.png'),fullPage:true,animations:'disabled'})}
    checked++;
   }
  }
  await page.setViewportSize({width:375,height:812});
  await page.goto(base+'/#home',{waitUntil:'domcontentloaded'});
  await page.locator('#menuToggle').click();
  assert.equal(await page.locator('#menu').isVisible(),true,'Explore menu should open on phone');
  await page.locator('#mobileSearch').fill('silver');
  await page.locator('#mobileSearchForm').press('Enter');
  assert.equal(new URL(page.url()).hash.startsWith('#search/silver'),true,'Mobile search should submit');
  assert.equal(await page.locator('#menu').isVisible(),false,'Explore menu must close on route change');

  await page.goto(base+'/#home',{waitUntil:'domcontentloaded'});
  await page.locator('.room-list a[href="#silver"]').click();
  assert.equal(new URL(page.url()).hash,'#silver','Home room navigation should open the Silver Vault');
  await page.goto(base+'/#apothecary',{waitUntil:'domcontentloaded'});
  await page.locator('.subcategory-mobile a[href="#apothecary/herbal-teas"]').click();
  assert.equal(new URL(page.url()).hash,'#apothecary/herbal-teas','Apothecary category link should open the intended collection');
  assert.equal(await page.locator('#catalog .catalog-grid[data-product-mount]').count(),1,'Product integration mount must remain intact');
  await page.goto(base+'/#home',{waitUntil:'domcontentloaded'});
  await page.locator('.art-nav .nav-links a[href="#journal"]').click();
  assert.equal(new URL(page.url()).hash,'#journal','Mobile top navigation should open the Journal');
  await page.locator('#menuToggle').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#menu').isVisible(),false,'Escape should dismiss the mobile Explore menu');
  console.log('PASS: '+checked+' responsive hero/navigation checks across five widths and seven routes, plus mobile search');
  assert.deepEqual(errors,[],'Public site JavaScript errors');
  console.log('PASS: journal feed, static fallback, article routes, search and six shop routes');
  const desk=await browser.newPage();
  const editorErrors=[];desk.on('pageerror',e=>editorErrors.push(e.message));
  const articles=new Map();let n=0;const uploadedPhotoRequests=[];
  await desk.route('**/config.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({apiUrl:'https://journal-api.aladdinslamp.xyz'})}));
  await desk.route('https://journal-api.aladdinslamp.xyz/api/**',r=>{
   const u=new URL(r.request().url()),p=u.pathname,method=r.request().method();
   const headers={'access-control-allow-origin':base,'access-control-allow-credentials':'true','access-control-allow-headers':'content-type','access-control-allow-methods':'GET, POST, PUT, DELETE, OPTIONS'};
   if(method==='OPTIONS')return r.fulfill({status:204,headers});
   let status=200,value={};
   if(p==='/api/me')value={email:'rachael@example.com',author:'Rachael',publishEnabled:true};
   else if(p==='/api/articles'&&method==='GET')value={articles:[...articles.values()]};
   else if(p==='/api/articles'&&method==='POST'){const data=JSON.parse(r.request().postData());const id='11111111-1111-4111-8111-'+String(++n).padStart(12,'0'),updated_at=new Date().toISOString();articles.set(id,{id,...data,author:'Rachael',owner_email:'rachael@example.com',updated_at,status:'draft'});value={id,author:'Rachael',updated_at,status:'draft'};status=201}
   else if(p.endsWith('/photos')&&method==='POST'){
    uploadedPhotoRequests.push(r.request().postDataBuffer().length);
    const articleId=p.split('/')[3];
    value={id:photoId,url:'https://journal-feed.aladdinslamp.xyz/media/'+photoId,previewUrl:'/api/articles/'+articleId+'/photos/'+photoId};status=201
   }
   else if(p.includes('/photos/')&&method==='GET')return r.fulfill({status:200,contentType:'image/png',headers,body:png});
   else {const id=p.split('/')[3],d=articles.get(id);
    if(!d){status=404;value={error:'Not found'}}
    else if(p.endsWith('/publish')){d.status='published';value={status:'published',slug:'qa-editor-story'}}
    else if(method==='PUT'){const data=JSON.parse(r.request().postData());Object.assign(d,data,{updated_at:new Date().toISOString()});value={saved:true,updated_at:d.updated_at}}
    else if(method==='DELETE'){articles.delete(id);value={deleted:true}}
   }
   return r.fulfill({status,contentType:'application/json',headers,body:JSON.stringify(value)});
  });
  desk.on('dialog',dialog=>dialog.accept());
  await desk.goto(base+'/desk',{waitUntil:'domcontentloaded'});
  try{await desk.getByText('Secure account connected.').waitFor({timeout:12000})}catch(e){throw Error('Could not connect to mock API; status: '+await desk.locator('#connectionState').innerText()+'; help: '+await desk.locator('#connectionHelp').innerText()+'; page errors: '+editorErrors.join(' | '))}
  await desk.locator('#title').fill('QA editor story');
  await desk.locator('#excerpt').fill('An introduction.');
  await desk.locator('.story-part-text').first().fill('An illustrative story.');
  await desk.locator('#inlinePhotoFile').setInputFiles({name:'treasure.png',mimeType:'image/png',buffer:png});
  await desk.locator('.story-photo').waitFor({timeout:12000});
  await desk.locator('.story-photo select[aria-label="Photo position"]').selectOption('right');
  await desk.locator('.story-photo select[aria-label="Photo width"]').selectOption('small');
  assert.equal(await desk.locator('.story-photo.align-right.size-small').count(),1,'Photo controls must update visual placement');
  await desk.locator('.story-photo button').filter({hasText:'↑ Move'}).click();
  assert.equal(await desk.locator('#storyCanvas > .story-block').first().locator('.story-photo').count(),1,'Photo must move above paragraph');
  await desk.locator('.story-photo button').filter({hasText:'↓ Move'}).click();
  await desk.locator('.story-part-text').last().evaluate(el=>{
   const clipboard=new DataTransfer();
   clipboard.items.add(new File([new Uint8Array([137,80,78,71,13,10,26,10,...Array(24).fill(0)])],'pasted.png',{type:'image/png'}));
   el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:clipboard,bubbles:true,cancelable:true}));
  });
  await desk.locator('.story-photo').nth(1).waitFor({timeout:12000});
  assert.equal(await desk.locator('.story-photo').count(),2,'Pasted image must appear as second inline story photograph');
  await desk.getByText('Saved securely').waitFor({timeout:12000});
  assert.equal(articles.size,1,'Autosave should persist exactly one draft');
  let serialized='',blocks=[];
  for(let tries=0;tries<90;tries++){
   serialized=[...articles.values()][0].body||'';
   if(serialized.startsWith('ALADDIN_BLOCKS_V1:')){
    blocks=JSON.parse(serialized.slice('ALADDIN_BLOCKS_V1:'.length));
    if(blocks.some(b=>b.kind==='image'&&b.id===photoId&&b.align==='right'&&b.size==='small'))break
   }
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(serialized.startsWith('ALADDIN_BLOCKS_V1:'),'Editor should persist structured body');
  assert.ok(blocks.some(b=>b.kind==='image'&&b.id===photoId&&b.align==='right'&&b.size==='small'),'Inline photo layout must survive autosave: '+JSON.stringify(blocks));
  // A realistic oversized phone-camera PNG should upload successfully after
  // the editor converts it to a smaller JPEG, without the author resizing it.
  await desk.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=1200;
   const ctx=canvas.getContext('2d');const data=ctx.createImageData(canvas.width,canvas.height);
   let state=7291;
   for(let i=0;i<data.data.length;i+=4){
    state=(Math.imul(state,1664525)+1013904223)>>>0;data.data[i]=state&255;
    state=(Math.imul(state,1664525)+1013904223)>>>0;data.data[i+1]=state&255;
    state=(Math.imul(state,1664525)+1013904223)>>>0;data.data[i+2]=state&255;
    data.data[i+3]=255;
   }
   ctx.putImageData(data,0,0);
   const large=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
   if(!large||large.size<5*1024*1024)throw Error('Fixture must exceed 5 MB');
   const transfer=new DataTransfer();transfer.items.add(new File([large],'large-phone.png',{type:'image/png'}));
   const input=document.getElementById('photoFile');input.files=transfer.files;
   input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await desk.getByText('Photo added! Select Preview',{exact:false}).waitFor({timeout:20000});
  assert.ok(uploadedPhotoRequests.length>=3,'Mock API should receive both inline photos and a resized cover');
  assert.ok(uploadedPhotoRequests.at(-1)<5*1024*1024+32768,'Optimized photo must fit the actual server upload cap');
  await desk.locator('#previewBtn').click();
  await desk.locator('#preview h1').getByText('QA editor story').waitFor({timeout:12000});
  await desk.locator('#cloudPublishBtn').click();
  await desk.getByText('Rachael · Published').waitFor({timeout:12000});
  assert.equal([...articles.values()][0].status,'published');
  assert.equal(await desk.locator('header a').getAttribute('href'),'https://aladdinslamp.xyz/#journal','Public Journal link should lead to the storefront');
  await desk.locator('#new').click();
  await desk.locator('#title').fill('Signout save test');
  await desk.locator('#excerpt').fill('Test pending draft before signing out');
  await desk.locator('.story-part-text').first().fill('This text must reach the cloud before logout.');
  await desk.route('**/cdn-cgi/access/logout',r=>r.fulfill({status:200,contentType:'text/html',body:'<html><body>Signed out</body></html>'}));
  await desk.getByRole('button',{name:'Sign Out of the Writing Desk'}).click();
  await desk.waitForURL('**/cdn-cgi/access/logout',{timeout:15000});
  assert.ok([...articles.values()].some(a=>a.title==='Signout save test'&&a.body.includes('must reach the cloud')),'Sign Out must save unsent author edits before session termination');
  assert.deepEqual(editorErrors,[],'Editor JavaScript errors');
  console.log('PASS: author login, autosave, preview, publish and draft state in browser (mock API)');
 }finally{await browser.close()}
}
main().then(()=>server.close()).catch(e=>{console.error(e);server.close();process.exitCode=1});
