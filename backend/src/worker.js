// Cloudflare Worker: authenticated, isolated author drafts with D1 publication.
// Cloudflare Access JWT is verified against the team's JWKS on EVERY request.
// Writing Desk HTML is served from private, Worker-bound KV; it is never a public KV endpoint.
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
function cors(request,env){const origin=request.headers.get('Origin');return origin===env.ALLOWED_ORIGIN?{'access-control-allow-origin':origin,'access-control-allow-headers':'authorization, content-type','access-control-allow-methods':'GET, POST, PUT, DELETE, OPTIONS','access-control-allow-credentials':'true','vary':'Origin'}:{}}
async function identity(request,env){
 const token=request.headers.get('Cf-Access-Jwt-Assertion')||request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
 if(!token)throw Error('Missing authentication');
 const parts=token.split('.');if(parts.length!==3)throw Error('Invalid token');
 const header=JSON.parse(new TextDecoder().decode(bytes(parts[0]))),claims=JSON.parse(new TextDecoder().decode(bytes(parts[1])));
 const domain=env.ACCESS_TEAM_DOMAIN;const aud=env.ACCESS_AUD;
 if(!domain||!aud||!/^[-a-z0-9]+\.cloudflareaccess\.com$/.test(domain))throw Error('Access not configured');
 const now=Math.floor(Date.now()/1000);
 if(header.alg!=='RS256'||!header.kid||!claims.sub||claims.iss!=='https://'+domain||!(Array.isArray(claims.aud)?claims.aud.includes(aud):claims.aud===aud)||!claims.exp||claims.exp<=now||claims.nbf>now||!claims.email)throw Error('Invalid token claims');
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
async function publishToDatabase(env,story,user){
 const slug=slugify(story.title)+'-'+story.id.slice(0,8);
 const now=new Date().toISOString();
 const result=await env.DB.prepare("UPDATE articles SET status='published',slug=?,published_at=?,updated_at=? WHERE id=? AND owner_email=? AND status='draft'").bind(slug,now,now,story.id,user.email).run();
 if(!result.success||result.meta?.changes!==1)throw Error('Publication conflict, reload and try again');
 return {status:'published',slug};
}
export default {async fetch(request,env){
 const corsHeaders=cors(request,env);const origin=request.headers.get('Origin');
 if(origin&&origin!==env.ALLOWED_ORIGIN)return json({error:'Origin not allowed'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders});
 let user;try{user=await identity(request,env)}catch(e){return json({error:'Unauthorized'},401,corsHeaders)}
 if(!env.DB)return json({error:'Database not configured'},503,corsHeaders);
 const url=new URL(request.url),path=url.pathname.replace(/\/$/,'');
 try{
 if(path==='/desk'&&request.method==='GET'){const editorHtml=await env.EDITOR_ASSETS?.get('desk-v1');return new Response(editorHtml||'The editor assets have not been uploaded',{status:editorHtml?200:503,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','content-security-policy':"default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'"}})}
 if(path==='/config.json'&&request.method==='GET')return json({apiUrl:new URL(request.url).origin},200,corsHeaders);
 if(path==='/api/me'&&request.method==='GET')return json({...user,publishEnabled:true},200,corsHeaders);
 if(path==='/api/articles'&&request.method==='GET'){const data=await env.DB.prepare('SELECT * FROM articles WHERE owner_email=? ORDER BY updated_at DESC').bind(user.email).all();return json({articles:data.results},200,corsHeaders)}
 if(path==='/api/articles'&&request.method==='POST'){
  const d=validate(await request.json()),id=crypto.randomUUID(),now=new Date().toISOString();
  await env.DB.prepare('INSERT INTO articles(id,author,owner_email,title,category,excerpt,body,cover,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,user.author,user.email,d.title,d.category,d.excerpt,d.body,d.cover,'draft',now,now).run();
  return json({id,author:user.author,status:'draft',updated_at:now},201,corsHeaders)}
 const match=path.match(/^\/api\/articles\/([a-f0-9-]{36})(\/publish)?$/);
 if(match){const id=match[1];const story=await env.DB.prepare('SELECT * FROM articles WHERE id=? AND owner_email=?').bind(id,user.email).first();if(!story)return json({error:'Not found'},404,corsHeaders);
  if(match[2]&&request.method==='POST'){
   if(!story.title.trim()||!story.excerpt.trim()||!story.body.trim())return json({error:'Title, introduction and body are required'},422,corsHeaders);
   if(story.status==='published')return json({error:'Already published'},409,corsHeaders);
   const result=await publishToDatabase(env,story,user);
   return json(result,200,corsHeaders)}
  if(!match[2]&&request.method==='PUT'){
    if(story.status==='published')return json({error:'Published stories are read-only'},409,corsHeaders);
    const input=await request.json(),expected=input.expectedUpdatedAt;
    if(typeof expected!=='string'||!expected)return json({error:'Reload story before saving'},428,corsHeaders);
    const d=validate(input),now=new Date().toISOString();
    const result=await env.DB.prepare('UPDATE articles SET title=?,category=?,excerpt=?,body=?,cover=?,updated_at=? WHERE id=? AND owner_email=? AND status=? AND updated_at=?').bind(d.title,d.category,d.excerpt,d.body,d.cover,now,id,user.email,'draft',expected).run();
    if(result.meta?.changes!==1)return json({error:'This story changed on another device. Export your draft, then refresh to resolve the changes.'},409,corsHeaders);
    return json({saved:true,updated_at:now},200,corsHeaders)}
  if(!match[2]&&request.method==='DELETE'){if(story.status==='published')return json({error:'Cannot delete published story'},409,corsHeaders);await env.DB.prepare('DELETE FROM articles WHERE id=? AND owner_email=?').bind(id,user.email).run();return json({deleted:true},200,corsHeaders)}
 }
 return json({error:'Not found'},404,corsHeaders);
 }catch(e){return json({error:e.message==='Invalid story'||e.message.startsWith('Invalid ')||e.message.startsWith('Story too long')||e.message.startsWith('Cover must')?e.message:'Request failed'},400,corsHeaders)}
}};