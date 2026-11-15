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
 constructor(){this.rows=new Map()}
 prepare(sql){
  const prepared={bind:(...p)=>({
   first:async()=>{if(sql.includes('FROM articles WHERE id=?')){const d=this.rows.get(p[0]);return d?.owner_email===p[1]?{...d}:null}throw Error('Unsupported first SQL: '+sql)},
   all:async()=>{if(sql.includes('owner_email=?'))return {results:[...this.rows.values()].filter(d=>d.owner_email===p[0]).map(d=>({...d}))};if(sql.includes("status='published'"))return {results:[...this.rows.values()].filter(d=>d.status==='published').map(d=>({...d,date:d.published_at}))};throw Error('Unsupported all SQL: '+sql)},
   run:async()=>{let changes=0;
    if(sql.startsWith('INSERT INTO articles')){const [id,author,owner_email,title,category,excerpt,body,cover,status,created_at,updated_at]=p;this.rows.set(id,{id,author,owner_email,title,category,excerpt,body,cover,status,created_at,updated_at,slug:null,published_at:null});changes=1}
    else if(sql.includes("SET status='published'")){const [slug,published_at,updated_at,id,owner_email]=p;const d=this.rows.get(id);if(d&&d.owner_email===owner_email&&d.status==='draft'){Object.assign(d,{status:'published',slug,published_at,updated_at});changes=1}}
    else if(sql.startsWith('UPDATE articles SET title=')){const [title,category,excerpt,body,cover,updated_at,id,owner_email,status,expected]=p;const d=this.rows.get(id);if(d&&d.owner_email===owner_email&&d.status===status&&d.updated_at===expected){Object.assign(d,{title,category,excerpt,body,cover,updated_at});changes=1}}
    else if(sql.startsWith('DELETE FROM articles')){const [id,email]=p;const d=this.rows.get(id);if(d&&d.owner_email===email){this.rows.delete(id);changes=1}}
    else throw Error('Unsupported run SQL: '+sql);
    return {success:true,meta:{changes}}
   }
  })};prepared.all=()=>prepared.bind().all();return prepared
 }
}
const DB=new FakeD1();
const env={DB,EDITOR_ASSETS:{get:async()=>'<html><body>Publish online</body></html>'},ACCESS_TEAM_DOMAIN:'unit.cloudflareaccess.com',ACCESS_AUD:'journal-test-aud',ALLOWED_AUTHORS:'mike@example.com:Mike,rachael@example.com:Rachael',ALLOWED_ORIGIN:'https://aladdinslamp.xyz'};
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
 const desk=await worker.fetch(request('/desk'),env);
 assert.equal(desk.status,200);
 assert.match(await desk.text(),/Publish online/);
 const config=await worker.fetch(request('/config.json'),env);
 assert.equal((await config.json()).apiUrl,'https://journal-api.aladdinslamp.xyz');
 const options=await worker.fetch(new Request('https://journal-api.aladdinslamp.xyz/api/articles',{method:'OPTIONS',headers:{Origin:'https://aladdinslamp.xyz'}}),env);
 assert.equal(options.status,204);
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
 const published=await worker.fetch(request('/api/articles/'+c.id+'/publish','POST','mike@example.com'),env);
 assert.equal(published.status,200);
 assert.equal((await published.json()).status,'published');
 assert.equal((await worker.fetch(request('/api/articles/'+c.id,'PUT','mike@example.com',{...article,expectedUpdatedAt:c.updated_at}),env)).status,409);
});
test('public feed includes only published fields and no draft ownership',async()=>{
 const a=await publicFeed.fetch(new Request('https://journal-feed.aladdinslamp.xyz/api/articles'),{DB});
 assert.equal(a.status,200);const payload=await a.json();
 assert.equal(payload.posts.length,1);
 assert.equal(payload.posts[0].status,'published');
 assert.ok(!JSON.stringify(payload).includes('owner_email'));
 assert.equal((await publicFeed.fetch(new Request('https://journal-feed.aladdinslamp.xyz/api/articles',{method:'POST'}),{DB})).status,405);
});
test('block unexpected origins and unauthorized users',async()=>{
 assert.equal((await worker.fetch(request('/api/me','GET','mike@example.com',undefined,'https://malicious.example'),env)).status,403);
 assert.equal((await worker.fetch(request('/api/me','GET','someone@example.com'),env)).status,401);
});
test.after(()=>{globalThis.fetch=originalFetch});
