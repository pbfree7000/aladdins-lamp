// Aladdin's Lamp Journal API — deploy only behind authenticated Cloudflare Access.
// D1 binding: DB. Cloudflare Access JWT verification is REQUIRED before write routes.
// No write route is enabled in this initial build.
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'https://aladdinslamp.xyz','x-content-type-options':'nosniff'}});
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(request.method==='GET'&&url.pathname==='/api/posts'){
  const {results}=await env.DB.prepare("SELECT slug,title,author,category,body,published_at AS date FROM posts WHERE status='published' ORDER BY published_at DESC LIMIT 100").all();
  return json(results);
 }
 if(request.method==='GET'&&url.pathname.startsWith('/api/posts/')){
  const slug=decodeURIComponent(url.pathname.slice('/api/posts/'.length));
  const post=await env.DB.prepare("SELECT slug,title,author,category,body,published_at AS date FROM posts WHERE slug=? AND status='published'").bind(slug).first();
  return json(post||{error:'Not found'},post?200:404);
 }
 return json({error:'Not available. Editorial authentication is not configured.'},403);
}};
