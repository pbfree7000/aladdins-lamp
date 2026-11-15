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
  await page.goto(base+'/#search/qa',{waitUntil:'domcontentloaded'});
  await page.getByText('QA Browser Article').first().waitFor({timeout:12000});
  for(const route of ['home','silver','hunt','fresh','apothecary','underground']){
   await page.goto(base+'/#'+route,{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('main').count()>0,true,'Missing layout on '+route);
   assert.equal((await page.locator('body').innerText()).includes('const inventoryUrl'),false,'Script leaked into page on '+route);
  }
  assert.deepEqual(errors,[],'Public site JavaScript errors');
  console.log('PASS: journal feed, static fallback, article routes, search and six shop routes');
  const desk=await browser.newPage();
  const editorErrors=[];desk.on('pageerror',e=>editorErrors.push(e.message));
  const articles=new Map();let n=0;
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
  await desk.locator('#previewBtn').click();
  await desk.locator('#preview h1').getByText('QA editor story').waitFor({timeout:12000});
  await desk.locator('#cloudPublishBtn').click();
  await desk.getByText('Rachael · Published').waitFor({timeout:12000});
  assert.equal([...articles.values()][0].status,'published');
  assert.deepEqual(editorErrors,[],'Editor JavaScript errors');
  console.log('PASS: author login, autosave, preview, publish and draft state in browser (mock API)');
 }finally{await browser.close()}
}
main().then(()=>server.close()).catch(e=>{console.error(e);server.close();process.exitCode=1});
