// Public read-only Treasure Journal feed. This Worker NEVER exposes drafts or owner_email.
const CORS_ORIGIN='https://aladdinslamp.xyz';
export default {
 async fetch(request, env) {
  const origin=request.headers.get('Origin');
  const headers={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=30','x-content-type-options':'nosniff'};
  if(origin===CORS_ORIGIN){headers['access-control-allow-origin']=CORS_ORIGIN;headers['vary']='Origin'}
  const url=new URL(request.url);
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers:{'access-control-allow-origin':CORS_ORIGIN,'access-control-allow-methods':'GET, HEAD, OPTIONS','access-control-max-age':'600','vary':'Origin'}});
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{...headers,'allow':'GET, HEAD, OPTIONS'}});
  if(url.pathname!=='/api/articles'&&url.pathname!=='/api/articles/')return new Response(JSON.stringify({error:'Not found'}),{status:404,headers});
  try{
   const result=await env.DB.prepare("SELECT slug,title,author,category,excerpt,body,cover,published_at AS date FROM articles WHERE status='published' ORDER BY published_at DESC LIMIT 200").all();
   const posts=result.results.map(p=>({slug:p.slug,title:p.title,author:p.author,category:p.category,excerpt:p.excerpt,body:p.body,date:String(p.date||'').slice(0,10),status:'published',...(p.cover?{cover:p.cover}:{})}));
   return new Response(request.method==='HEAD'?null:JSON.stringify({posts}),{status:200,headers});
  }catch(e){return new Response(JSON.stringify({error:'Journal temporarily unavailable'}),{status:503,headers:{...headers,'cache-control':'no-store'}})}
 }
};
