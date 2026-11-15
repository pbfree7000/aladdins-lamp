// Cloudflare Worker: authenticated journal drafts and GitHub-backed publishing.
// Cloudflare Access JWT is verified against the team's JWKS on EVERY request.
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
function cors(request,env){const origin=request.headers.get('Origin');return origin===env.ALLOWED_ORIGIN?{'access-control-allow-origin':origin,'access-control-allow-headers':'authorization, content-type','access-control-allow-methods':'GET, POST, PUT, DELETE, OPTIONS','vary':'Origin'}:{}}
async function identity(request,env){
 const token=request.headers.get('Cf-Access-Jwt-Assertion')||request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
 if(!token)throw Error('Missing authentication');
 const parts=token.split('.');if(parts.length!==3)throw Error('Invalid token');
 const header=JSON.parse(new TextDecoder().decode(bytes(parts[0]))),claims=JSON.parse(new TextDecoder().decode(bytes(parts[1])));
 const domain=env.ACCESS_TEAM_DOMAIN;const aud=env.ACCESS_AUD;
 if(!domain||!aud||!/^[-a-z0-9]+\.cloudflareaccess\.com$/.test(domain))throw Error('Access not configured');
 const now=Math.floor(Date.now()/1000);
 if(header.alg!=='RS256'||!header.kid||claims.iss!=='https://'+domain||!(Array.isArray(claims.aud)?claims.aud.includes(aud):claims.aud===aud)||!claims.exp||claims.exp<=now||claims.nbf>now||!claims.email)throw Error('Invalid token claims');
 const response=await fetch('https://'+domain+'/cdn-cgi/access/certs');if(!response.ok)throw Error('Access keys unavailable');
 const keys=await response.json();const jwk=keys.keys?.find(k=>k.kid===header.kid&&k.kty==='RSA');
 if(!jwk)throw Error('Unknown signing key');
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))throw Error('Bad signature');
 const email=String(claims.email).toLowerCase();
 const entry=String(env.ALLOWED_AUTHORS||'').split(',').map(x=>x.trim()).find(x=>x.toLowerCase().startsWith(email+':'));
 if(!entry)throw Error('Author not permitted');
 const author=entry.slice(entry.indexOf(':')+1);
 if(!['Mike','Rachael'].includes(author))throw Error('Invalid author mapping');
 return {email,author};
}
function validate(d){if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Invalid story');const out={};for(const k of ['title','category','excerpt','body','cover']){if(d[k]!==undefined&&typeof d[k]!=='string')throw Error('Invalid '+k);out[k]=String(d[k]||'').trim()}if(out.title.length>200||out.category.length>100||out.excerpt.length>1000||out.body.length>100000||out.cover.length>2000)throw Error('Story too long');if(out.cover&&!/^https:\/\//i.test(out.cover))throw Error('Cover must be an HTTPS URL');return out}
function slugify(s){return s.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'story'}
async function githubPublish(env,story){
 if(!env.GITHUB_TOKEN)throw Error('Publishing not configured');
 const repo=env.GITHUB_REPO,branch=env.GITHUB_BRANCH||'main',api='https://api.github.com/repos/'+repo+'/contents/journal/posts.json';
 const headers={'authorization':'Bearer '+env.GITHUB_TOKEN,'accept':'application/vnd.github+json','x-github-api-version':'2022-11-28','user-agent':'AladdinsJournalWorker'};
 for(let attempt=0;attempt<3;attempt++){
  const get=await fetch(api+'?ref='+encodeURIComponent(branch),{headers});if(!get.ok)throw Error('Cannot read published journal');
  const file=await get.json();const raw=Uint8Array.from(atob(file.content.replace(/\s/g,'')),c=>c.charCodeAt(0));const posts=JSON.parse(new TextDecoder().decode(raw));
  if(!Array.isArray(posts))throw Error('Invalid journal data');
  const slug=story.slug||slugify(story.title)+'-'+story.id.slice(0,8);
  const entry={slug,title:story.title,date:new Date().toISOString().slice(0,10),author:story.author,category:story.category,status:'published',excerpt:story.excerpt,body:story.body};
  if(story.cover)entry.cover=story.cover;
  const next=[entry,...posts.filter(p=>p.slug!==slug)];
  const content=btoa(Array.from(new TextEncoder().encode(JSON.stringify(next,null,2)+'\n'),b=>String.fromCharCode(b)).join(''));
  const put=await fetch(api,{method:'PUT',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({message:'Publish Treasure Journal: '+story.title,content,sha:file.sha,branch})});
  if(put.ok)return {slug,commit:(await put.json()).commit?.sha};
  if(put.status!==409)throw Error('Publishing failed: '+put.status);
 }
 throw Error('Publishing conflict: please retry');
}
export default {async fetch(request,env){
 const corsHeaders=cors(request,env);const origin=request.headers.get('Origin');
 if(origin&&origin!==env.ALLOWED_ORIGIN)return json({error:'Origin not allowed'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders});
 let user;try{user=await identity(request,env)}catch(e){return json({error:'Unauthorized'},401,corsHeaders)}
 if(!env.DB)return json({error:'Database not configured'},503,corsHeaders);
 const url=new URL(request.url),path=url.pathname.replace(/\/$/,'');
 try{
 if(path==='/api/me'&&request.method==='GET')return json(user,200,corsHeaders);
 if(path==='/api/articles'&&request.method==='GET'){const data=await env.DB.prepare('SELECT * FROM articles WHERE owner_email=? ORDER BY updated_at DESC').bind(user.email).all();return json({articles:data.results},200,corsHeaders)}
 if(path==='/api/articles'&&request.method==='POST'){
  const d=validate(await request.json()),id=crypto.randomUUID(),now=new Date().toISOString();
  await env.DB.prepare('INSERT INTO articles(id,author,owner_email,title,category,excerpt,body,cover,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,user.author,user.email,d.title,d.category,d.excerpt,d.body,d.cover,'draft',now,now).run();
  return json({id,author:user.author,status:'draft'},201,corsHeaders)}
 const match=path.match(/^\/api\/articles\/([a-f0-9-]{36})(\/publish)?$/);
 if(match){const id=match[1];const story=await env.DB.prepare('SELECT * FROM articles WHERE id=? AND owner_email=?').bind(id,user.email).first();if(!story)return json({error:'Not found'},404,corsHeaders);
  if(match[2]&&request.method==='POST'){
   if(!story.title.trim()||!story.excerpt.trim()||!story.body.trim())return json({error:'Title, introduction and body are required'},422,corsHeaders);
   if(story.status==='published')return json({error:'Already published'},409,corsHeaders);
   const result=await githubPublish(env,story);
   await env.DB.prepare('UPDATE articles SET status=?,slug=?,published_at=?,updated_at=? WHERE id=? AND owner_email=?').bind('published',result.slug,new Date().toISOString(),new Date().toISOString(),id,user.email).run();
   return json({status:'published',...result},200,corsHeaders)}
  if(!match[2]&&request.method==='PUT'){if(story.status==='published')return json({error:'Published stories are read-only'},409,corsHeaders);const d=validate(await request.json());await env.DB.prepare('UPDATE articles SET title=?,category=?,excerpt=?,body=?,cover=?,updated_at=? WHERE id=? AND owner_email=?').bind(d.title,d.category,d.excerpt,d.body,d.cover,new Date().toISOString(),id,user.email).run();return json({saved:true},200,corsHeaders)}
  if(!match[2]&&request.method==='DELETE'){if(story.status==='published')return json({error:'Cannot delete published story'},409,corsHeaders);await env.DB.prepare('DELETE FROM articles WHERE id=? AND owner_email=?').bind(id,user.email).run();return json({deleted:true},200,corsHeaders)}
 }
 return json({error:'Not found'},404,corsHeaders);
 }catch(e){return json({error:e.message==='Invalid story'||e.message.startsWith('Invalid ')||e.message.startsWith('Story too long')||e.message.startsWith('Cover must')?e.message:'Request failed'},400,corsHeaders)}
}};