import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign} from 'node:crypto';
import worker from '../dist/worker.js';
import publicFeed from '../src/public-feed.js';

const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'journal-test-key',alg:'RS256'};
const originalFetch=globalThis.fetch;
globalThis.fetch=async url=>{
 if(String(url)==='https://unit.cloudflareaccess.com/cdn-cgi/access/certs')return Response.json({keys:[jwk]});
 throw Error('Unexpected outbound request: '+url);
};
function jwt(email){
 const head=Buffer.from(JSON.stringify({alg:'RS256',kid:jwk.kid})).toString('base64url');
 const body=Buffer.from(JSON.stringify({iss:'https://unit.cloudflareaccess.com',aud:['journal-test-aud'],sub:'test-subject',email,exp:Math.floor(Date.now()/1000)+1200})).toString('base64url');
 const signed=head+'.'+body;
 return signed+'.'+createSign('RSA-SHA256').update(signed).sign(privateKey).toString('base64url');
}
class FakeD1{
 constructor(){this.rows=new Map();this.photos=new Map();this.revisions=new Map()}
 remember(row){
  const prior=this.revisions.get(row.id)||[];
  const snapshot={article_id:row.id,version:prior.length+1,title:row.title,category:row.category,excerpt:row.excerpt,body:row.body,cover:row.cover,status:row.status,slug:row.slug,published_at:row.published_at,source_updated_at:row.updated_at,recorded_at:new Date().toISOString()};
  const last=prior.at(-1);
  if(last&&['title','category','excerpt','body','cover','status','slug','published_at'].every(k=>last[k]===snapshot[k]))return;
  prior.push(snapshot);this.revisions.set(row.id,prior)
 }
 prepare(sql){
  const prepared={bind:(...p)=>({
   first:async()=>{if(sql.includes('FROM article_revisions'))return this.revisions.get(p[0])?.find(v=>v.version===p[1])||null;if(sql.includes('FROM journal_photos WHERE id=?')){const ph=this.photos.get(p[0]);return ph?.article_id===p[1]?{...ph}:null}if(sql.includes('SELECT p.object_key,p.content_type')){const ph=this.photos.get(p[0]);return ph&&this.rows.get(ph.article_id)?.status==='published'?{...ph,cover:this.rows.get(ph.article_id).cover,body:this.rows.get(ph.article_id).body}:null}if(sql.includes('FROM articles WHERE id=?')){const d=this.rows.get(p[0]);return d&&(p.length===1||d.owner_email===p[1])?{...d}:null}throw Error('Unsupported first SQL: '+sql)},
   all:async()=>{if(sql.includes('FROM article_revisions'))return {results:(this.revisions.get(p[0])||[]).filter(v=>v.version<p[1]).slice().sort((a,b)=>b.version-a.version).slice(0,41).map(({version,title,status,slug,source_updated_at,recorded_at})=>({version,title,status,slug,source_updated_at,recorded_at}))};if(sql.includes('owner_email=?'))return {results:[...this.rows.values()].filter(d=>d.owner_email===p[0]).map(d=>({...d}))};if(sql.includes('SELECT * FROM articles ORDER BY'))return {results:[...this.rows.values()].map(d=>({...d}))};if(sql.includes("status='published'"))return {results:[...this.rows.values()].filter(d=>d.status==='published').map(d=>({...d,date:d.published_at}))};throw Error('Unsupported all SQL: '+sql)},
   run:async()=>{let changes=0;
    if(sql.startsWith('INSERT INTO journal_photos')){const [id,article_id,owner_email,object_key,content_type,created_at]=p;this.photos.set(id,{id,article_id,owner_email,object_key,content_type,created_at});changes=1}
    else if(sql.startsWith('INSERT INTO articles')){const [id,author,owner_email,title,category,excerpt,body,cover,status,created_at,updated_at]=p;this.rows.set(id,{id,author,owner_email,title,category,excerpt,body,cover,status,created_at,updated_at,slug:null,published_at:null});changes=1;this.remember(this.rows.get(id))}
    else if(sql.includes("SET status='published'")){const [slug,published_at,updated_at,id,owner_email,expected]=p;const d=this.rows.get(id);if(d&&d.owner_email===owner_email&&d.status==='draft'&&d.updated_at===expected){Object.assign(d,{status:'published',slug,published_at,updated_at});changes=1;this.remember(d)}}
    else if(sql.startsWith('UPDATE articles SET title=')){const [title,category,excerpt,body,cover,updated_at,id,owner_email,status,expected]=p;const d=this.rows.get(id);if(d&&d.owner_email===owner_email&&d.status===status&&d.updated_at===expected){Object.assign(d,{title,category,excerpt,body,cover,updated_at});changes=1;this.remember(d)}}
    else if(sql.startsWith('DELETE FROM articles')){const [id,email]=p;const d=this.rows.get(id);if(d&&d.owner_email===email){this.rows.delete(id);changes=1;this.revisions.delete(id)}}
    else throw Error('Unsupported run SQL: '+sql);
    return {success:true,meta:{changes}}
   }
  })};prepared.all=()=>prepared.bind().all();return prepared
 }
}
const DB=new FakeD1();
const objects=new Map();const JOURNAL_PHOTOS={put:async(k,bytes)=>objects.set(k,bytes),get:async(k)=>objects.has(k)?{body:objects.get(k)}:null};
const env={DB,JOURNAL_PHOTOS,EDITOR_ASSETS:{get:async()=>'<html><body>Publish online</body></html>'},ACCESS_TEAM_DOMAIN:'unit.cloudflareaccess.com',ACCESS_AUD:'journal-test-aud',OWNER_EMAIL:'owner@example.com',ALLOWED_AUTHORS:'mike@example.com:Mike,rachael@example.com:Rachael',ALLOWED_ORIGIN:'https://aladdinslamp.xyz'};
function request(path,method='GET',email='mike@example.com',payload,origin){
 return new Request('https://journal-api.aladdinslamp.xyz'+path,{method,headers:{'Cf-Access-Jwt-Assertion':jwt(email),...(payload?{'content-type':'application/json'}:{}),...(origin?{Origin:origin}:{})},body:payload?JSON.stringify(payload):undefined})
}
const article={title:'A remarkable silver find',category:'The Silver Vault',excerpt:'A silver story',body:'An old treasure.',cover:''};
test('reject unauthenticated and forged Access tokens',async()=>{
 const noAuth=await worker.fetch(new Request('https://journal-api.aladdinslamp.xyz/api/me'),env);
 assert.equal(noAuth.status,401);
 const r=request('/api/me');const parts=jwt('mike@example.com').split('.');parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);r.headers.set('Cf-Access-Jwt-Assertion',parts.join('.'));
 assert.equal((await worker.fetch(r,env)).status,401);
});
test('author identity and same-origin writing desk',async()=>{
 const r=await worker.fetch(request('/api/me'),env);
 assert.equal((await r.json()).author,'Mike');
 const root=await worker.fetch(request('/'),env);
 assert.equal(root.status,302,'Authenticated API homepage should redirect to the Writing Desk');
 assert.equal(root.headers.get('location'),'https://journal-api.aladdinslamp.xyz/desk');
 const desk=await worker.fetch(request('/desk'),env);
 assert.equal(desk.status,200);
 assert.match(await desk.text(),/Publish online/);
 const config=await worker.fetch(request('/config.json'),env);
 assert.equal((await config.json()).apiUrl,'https://journal-api.aladdinslamp.xyz');
 const options=await worker.fetch(new Request('https://journal-api.aladdinslamp.xyz/api/articles',{method:'OPTIONS',headers:{Origin:'https://aladdinslamp.xyz'}}),env);
 assert.equal(options.status,204);
});
test('author same-origin saving and photo upload work, foreign origins remain blocked',async()=>{
 const envLocal={...env,DB:new FakeD1(),JOURNAL_PHOTOS:{put:async()=>{},get:async()=>null}};
 for(const origin of ['https://journal-api.aladdinslamp.xyz','https://aladdinslamp.xyz']){
  const created=await worker.fetch(request('/api/articles','POST','mike@example.com',{...article,title:'Origin check '+origin},origin),envLocal);
  assert.equal(created.status,201,'Author should create a draft from '+origin);
  const d=await created.json();
  assert.equal(created.headers.get('access-control-allow-origin'),origin);
  const revised=await worker.fetch(request('/api/articles/'+d.id,'PUT','mike@example.com',{...article,title:'Edited from '+origin,expectedUpdatedAt:d.updated_at},origin),envLocal);
  assert.equal(revised.status,200,'Author should save the existing draft from '+origin);
  const body=new FormData();
  body.append('photo',new Blob([Uint8Array.from([137,80,78,71,13,10,26,10,...Array(24).fill(0)])],{type:'image/png'}),'test.png');
  const upload=await worker.fetch(new Request('https://journal-api.aladdinslamp.xyz/api/articles/'+d.id+'/photos',{method:'POST',headers:{'Origin':origin,'Cf-Access-Jwt-Assertion':jwt('mike@example.com')},body}),envLocal);
  assert.equal(upload.status,201,'Author should upload a photo from '+origin);
 }
 const foreign=await worker.fetch(request('/api/articles','POST','mike@example.com',article,'https://unauthorized.example'),envLocal);
 assert.equal(foreign.status,403,'Foreign origins must not create drafts');
 const foreignPhoto=await worker.fetch(new Request('https://journal-api.aladdinslamp.xyz/api/articles',{method:'OPTIONS',headers:{Origin:'https://unauthorized.example'}}),envLocal);
 assert.equal(foreignPhoto.status,403,'Foreign origins must not pass CORS preflight');
});
test('create, retrieve and revise privately with cross-author protection',async()=>{
 const created=await worker.fetch(request('/api/articles','POST','mike@example.com',article),env);
 assert.equal(created.status,201);
 const c=await created.json(); assert.ok(c.id); assert.ok(c.updated_at);
 const own=await (await worker.fetch(request('/api/articles'),env)).json();
 assert.equal(own.articles.length,1);
 const other=await (await worker.fetch(request('/api/articles','GET','rachael@example.com'),env)).json();
 assert.equal(other.articles.length,0);
 assert.equal((await worker.fetch(request('/api/articles/'+c.id,'PUT','rachael@example.com',{...article,expectedUpdatedAt:c.updated_at}),env)).status,404);
 const stale=await worker.fetch(request('/api/articles/'+c.id,'PUT','mike@example.com',{...article,expectedUpdatedAt:'stale-version'}),env);
 assert.equal(stale.status,409);
 const edited=await worker.fetch(request('/api/articles/'+c.id,'PUT','mike@example.com',{...article,title:'Updated silver find',expectedUpdatedAt:c.updated_at}),env);
 assert.equal(edited.status,200);
 const noVersion=await worker.fetch(request('/api/articles/'+c.id+'/publish','POST','mike@example.com',{}),env);
 assert.equal(noVersion.status,428);
 const stalePublish=await worker.fetch(request('/api/articles/'+c.id+'/publish','POST','mike@example.com',{expectedUpdatedAt:c.updated_at}),env);
 assert.equal(stalePublish.status,409);
 const current=(await (await worker.fetch(request('/api/articles'),env)).json()).articles[0];
 const published=await worker.fetch(request('/api/articles/'+c.id+'/publish','POST','mike@example.com',{expectedUpdatedAt:current.updated_at}),env);
 assert.equal(published.status,200);
 assert.equal((await published.json()).status,'published');
 assert.equal((await worker.fetch(request('/api/articles/'+c.id,'PUT','mike@example.com',{...article,expectedUpdatedAt:c.updated_at}),env)).status,409);
});
test('owner can oversee both authors without impersonating them',async()=>{
 const mike=await worker.fetch(request('/api/articles','POST','mike@example.com',article),env);
 const rachael=await worker.fetch(request('/api/articles','POST','rachael@example.com',{...article,title:'Rachael finds treasure'}),env);
 assert.equal(mike.status,201);assert.equal(rachael.status,201);
 const me=await (await worker.fetch(request('/api/me','GET','owner@example.com'),env)).json();
 assert.equal(me.role,'owner');assert.equal(me.author,'Owner');
 assert.equal((await worker.fetch(request('/api/articles','POST','owner@example.com',article),env)).status,403);
 const overview=await (await worker.fetch(request('/api/articles','GET','owner@example.com'),env)).json();
 assert.ok(overview.articles.some(d=>d.author==='Mike'));
 assert.ok(overview.articles.some(d=>d.author==='Rachael'));
 const r=await rachael.json();
 assert.equal((await worker.fetch(request('/api/articles/'+r.id,'DELETE','owner@example.com'),env)).status,403);
 assert.equal((await worker.fetch(request('/api/articles/'+r.id,'PUT','owner@example.com',{...article,title:'Reviewed by owner',expectedUpdatedAt:r.updated_at}),env)).status,200);
 const latest=(await (await worker.fetch(request('/api/articles','GET','owner@example.com'),env)).json()).articles.find(d=>d.id===r.id);
 assert.equal((await worker.fetch(request('/api/articles/'+r.id+'/publish','POST','owner@example.com',{expectedUpdatedAt:latest.updated_at}),env)).status,200);
});
test('photos stay private until publication and reject unauthorized access and spoofed formats',async()=>{
 const draft=await (await worker.fetch(request('/api/articles','POST','mike@example.com',article),env)).json();
 const makeReq=(buf,type,email='mike@example.com')=>{
  const form=new FormData();form.append('photo',new Blob([buf],{type}),'photo.jpg');
  return new Request('https://journal-api.aladdinslamp.xyz/api/articles/'+draft.id+'/photos',{method:'POST',headers:{'Cf-Access-Jwt-Assertion':jwt(email)},body:form});
 };
 const png=Uint8Array.from([137,80,78,71,13,10,26,10,...Array(24).fill(0)]);
 assert.equal((await worker.fetch(makeReq(png,'image/jpeg'),env)).status,422);
 assert.equal((await worker.fetch(makeReq(png,'image/png','rachael@example.com'),env)).status,404);
 const uploaded=await worker.fetch(makeReq(png,'image/png'),env);
 assert.equal(uploaded.status,201);
 const photo=await uploaded.json();
 assert.match(photo.url,/\/media\//);
 assert.equal((await publicFeed.fetch(new Request(photo.url),{DB,JOURNAL_PHOTOS})).status,404);
 assert.equal((await worker.fetch(request(photo.previewUrl,'GET','rachael@example.com'),env)).status,404);
 assert.equal((await worker.fetch(request(photo.previewUrl),env)).status,200);
 const pub=await worker.fetch(request('/api/articles/'+draft.id+'/publish','POST','mike@example.com',{expectedUpdatedAt:draft.updated_at}),env);
 assert.equal(pub.status,200);
 const unused=await publicFeed.fetch(new Request(photo.url),{DB,JOURNAL_PHOTOS});
 assert.equal(unused.status,404,'Unreferenced uploaded photo must stay private even when its article is published');
 const published=DB.rows.get(draft.id);
 published.cover=photo.url;
 const coverLive=await publicFeed.fetch(new Request(photo.url),{DB,JOURNAL_PHOTOS});
 assert.equal(coverLive.status,200);assert.equal(coverLive.headers.get('content-type'),'image/png');
 published.cover='';
 published.body='ALADDIN_BLOCKS_V1:'+JSON.stringify([{kind:'text',style:'paragraph',text:'Story'},{kind:'image',id:photo.id,size:'medium',align:'center',caption:''}]);
 assert.equal((await publicFeed.fetch(new Request(photo.url),{DB,JOURNAL_PHOTOS})).status,200,'Image explicitly placed in article must be public');
 published.body=article.body;
 assert.equal((await publicFeed.fetch(new Request(photo.url),{DB,JOURNAL_PHOTOS})).status,404,'Removing photo from story must make it private again');
});
test('authors can replace photos and revise published stories without changing the URL or exposing staged images',async()=>{
 const created=await (await worker.fetch(request('/api/articles','POST','rachael@example.com',article),env)).json();
 const id=created.id;
 const published=await worker.fetch(request('/api/articles/'+id+'/publish','POST','rachael@example.com',{expectedUpdatedAt:created.updated_at}),env);
 assert.equal(published.status,200);
 const before={...DB.rows.get(id)};
 const png=Uint8Array.from([137,80,78,71,13,10,26,10,...Array(24).fill(0)]);
 const form=new FormData();form.append('photo',new Blob([png],{type:'image/png'}),'replacement.png');
 const upload=await worker.fetch(new Request('https://journal-api.aladdinslamp.xyz/api/articles/'+id+'/photos',{method:'POST',headers:{'Cf-Access-Jwt-Assertion':jwt('rachael@example.com')},body:form}),env);
 assert.equal(upload.status,201,'Published article should accept staged photo upload');
 const photo=await upload.json();
 assert.equal((await publicFeed.fetch(new Request(photo.url),{DB,JOURNAL_PHOTOS})).status,404,'Unreferenced replacement stays private');
 const update={...article,title:'Corrected ginger article',cover:photo.url,expectedUpdatedAt:before.updated_at};
 const unauthorized=await worker.fetch(request('/api/articles/'+id+'/revise','POST','mike@example.com',update),env);
 assert.equal(unauthorized.status,404,'Other author cannot edit published article');
 const missingVersion=await worker.fetch(request('/api/articles/'+id+'/revise','POST','rachael@example.com',{...update,expectedUpdatedAt:''}),env);
 assert.equal(missingVersion.status,428,'Update needs version token');
 const invalid=await worker.fetch(request('/api/articles/'+id+'/revise','POST','rachael@example.com',{...update,body:'ALADDIN_BLOCKS_V1:invalid'}),env);
 assert.equal(invalid.status,422);
 assert.equal(DB.rows.get(id).cover,before.cover,'Failed updates do not modify the live article');
 const live=await worker.fetch(request('/api/articles/'+id+'/revise','POST','rachael@example.com',update),env);
 assert.equal(live.status,200);
 const result=await live.json();
 assert.equal(result.slug,before.slug,'Public URL remains identical');
 assert.equal(result.published_at,before.published_at,'Original publication date remains identical');
 const stored=DB.rows.get(id);
 assert.equal(stored.status,'published');assert.equal(stored.slug,before.slug);
 assert.equal(stored.cover,photo.url);assert.equal(stored.title,'Corrected ginger article');
 assert.equal((await publicFeed.fetch(new Request(photo.url),{DB,JOURNAL_PHOTOS})).status,200,'Only committed replacement becomes public');
 const stale=await worker.fetch(request('/api/articles/'+id+'/revise','POST','rachael@example.com',update),env);
 assert.equal(stale.status,409,'A stale device cannot overwrite a newer published article');
});
test('private version history records each meaningful save, isolates authors and allows safe restoration',async()=>{
 const localDB=new FakeD1(),privateEnv={...env,DB:localDB};
 const created=await (await worker.fetch(request('/api/articles','POST','rachael@example.com',{...article,title:'Ginger beginnings'}),privateEnv)).json();
 const id=created.id;
 let list=await (await worker.fetch(request('/api/articles/'+id+'/revisions','GET','rachael@example.com'),privateEnv)).json();
 assert.equal(list.versions.length,1,'A new story must have an initial snapshot');
 const old=await worker.fetch(request('/api/articles/'+id+'/revisions','GET','mike@example.com'),privateEnv);
 assert.equal(old.status,404,'Other authors must not access revision metadata');
 const blocked=await worker.fetch(request('/api/articles/'+id+'/revisions/1','GET','mike@example.com'),privateEnv);
 assert.equal(blocked.status,404,'Other authors must not access revision bodies');
 const second=await (await worker.fetch(request('/api/articles/'+id,'PUT','rachael@example.com',{...article,title:'First revision',expectedUpdatedAt:created.updated_at}),privateEnv)).json();
 assert.ok(second.updated_at);
 const p=await worker.fetch(request('/api/articles/'+id+'/publish','POST','rachael@example.com',{expectedUpdatedAt:second.updated_at}),privateEnv);
 assert.equal(p.status,200);
 list=await (await worker.fetch(request('/api/articles/'+id+'/revisions','GET','rachael@example.com'),privateEnv)).json();
 assert.equal(list.versions.length,3);
 assert.deepEqual(list.versions.map(x=>x.version),[3,2,1]);
 const first=await (await worker.fetch(request('/api/articles/'+id+'/revisions/1','GET','rachael@example.com'),privateEnv)).json();
 assert.equal(first.revision.title,'Ginger beginnings');
 assert.equal(first.revision.status,'draft');
 const saved=localDB.rows.get(id);
 const restored=await worker.fetch(request('/api/articles/'+id+'/revise','POST','rachael@example.com',{title:first.revision.title,category:first.revision.category,excerpt:first.revision.excerpt,body:first.revision.body,cover:first.revision.cover,expectedUpdatedAt:saved.updated_at}),privateEnv);
 assert.equal(restored.status,200);
 assert.equal((await restored.json()).slug,saved.slug,'Restore cannot change public link');
 const after=await (await worker.fetch(request('/api/articles/'+id+'/revisions','GET','rachael@example.com'),privateEnv)).json();
 assert.equal(after.versions[0].version,4,'Restoration creates a NEW version rather than overwriting');
 assert.equal(after.versions[0].status,'published','Published status is preserved during restoration');
 const page2=await (await worker.fetch(request('/api/articles/'+id+'/revisions?before=3','GET','rachael@example.com'),privateEnv)).json();
 assert.deepEqual(page2.versions.map(x=>x.version),[2,1],'History cursor returns older records');
 const invalid=await worker.fetch(request('/api/articles/'+id+'/revisions?before=NOT_A_NUMBER','GET','rachael@example.com'),privateEnv);
 assert.equal(invalid.status,422);
 const missing=await worker.fetch(request('/api/articles/'+id+'/revisions/999','GET','rachael@example.com'),privateEnv);
 assert.equal(missing.status,404);
});
test('image-only rich layout is not a publishable story',async()=>{
 const imageOnly={...article,body:'ALADDIN_BLOCKS_V1:'+JSON.stringify([{kind:'image',id:'aabbccdd-1111-4111-8111-000000000001',caption:'Photo',size:'medium',align:'center'}])};
 const created=await (await worker.fetch(request('/api/articles','POST','mike@example.com',imageOnly),env)).json();
 const publish=await worker.fetch(request('/api/articles/'+created.id+'/publish','POST','mike@example.com',{expectedUpdatedAt:created.updated_at}),env);
 assert.equal(publish.status,422);
 const corrupted={...article,body:'ALADDIN_BLOCKS_V1:not-json'};
 const invalid=await (await worker.fetch(request('/api/articles','POST','mike@example.com',corrupted),env)).json();
 assert.equal((await worker.fetch(request('/api/articles/'+invalid.id+'/publish','POST','mike@example.com',{expectedUpdatedAt:invalid.updated_at}),env)).status,422);
});
test('public feed includes only published fields and no draft ownership',async()=>{
 const a=await publicFeed.fetch(new Request('https://journal-feed.aladdinslamp.xyz/api/articles'),{DB});
 assert.equal(a.status,200);const payload=await a.json();
 assert.equal(payload.posts.length,[...DB.rows.values()].filter(row=>row.status==='published').length);
 assert.equal(payload.posts[0].status,'published');
 assert.ok(!JSON.stringify(payload).includes('owner_email'));
 assert.equal((await publicFeed.fetch(new Request('https://journal-feed.aladdinslamp.xyz/api/articles',{method:'POST'}),{DB})).status,405);
});
test('block unexpected origins and unauthorized users',async()=>{
 assert.equal((await worker.fetch(request('/api/me','GET','mike@example.com',undefined,'https://malicious.example'),env)).status,403);
 assert.equal((await worker.fetch(request('/api/me','GET','someone@example.com'),env)).status,401);
});
test.after(()=>{globalThis.fetch=originalFetch});
