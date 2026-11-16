// Public read-only Treasure Journal feed. This Worker NEVER exposes drafts or owner_email.
const CORS_ORIGIN='https://aladdinslamp.xyz';
export default {
 async fetch(request, env) {
  const origin=request.headers.get('Origin');
  const headers={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=30','x-content-type-options':'nosniff'};
  if(origin===CORS_ORIGIN){headers['access-control-allow-origin']=CORS_ORIGIN;headers['vary']='Origin'}
  const url=new URL(request.url);
  const photoId=url.pathname.match(/^\/media\/([a-f0-9-]{36})$/);
  if(photoId&&(request.method==='GET'||request.method==='HEAD')){
   try{
    const photo=await env.DB.prepare("SELECT p.object_key,p.content_type,a.cover,a.body FROM journal_photos p JOIN articles a ON a.id=p.article_id WHERE p.id=? AND a.status='published'").bind(photoId[1]).first();
    if(!photo||!env.JOURNAL_PHOTOS)return new Response('Not found',{status:404,headers:{'cache-control':'no-store'}});
    const usedAsCover=String(photo.cover||'')==='https://journal-feed.aladdinslamp.xyz/media/'+photoId[1];
    let usedInBody=false;
    if(String(photo.body||'').startsWith('ALADDIN_BLOCKS_V1:')){
     try{const blocks=JSON.parse(photo.body.slice('ALADDIN_BLOCKS_V1:'.length));usedInBody=Array.isArray(blocks)&&blocks.some(b=>b?.kind==='image'&&b.id===photoId[1])}catch{}
    }
    // Attachment metadata is not publication permission. Only explicitly used photos are public.
    if(!usedAsCover&&!usedInBody)return new Response('Not found',{status:404,headers:{'cache-control':'no-store'}});
    const object=await env.JOURNAL_PHOTOS.get(photo.object_key);
    if(!object)return new Response('Not found',{status:404});
    return new Response(request.method==='HEAD'?null:object.body,{headers:{'content-type':photo.content_type,'cache-control':'public, max-age=3600','x-content-type-options':'nosniff','content-disposition':'inline'}});
   }catch{return new Response('Unavailable',{status:503,headers:{'cache-control':'no-store'}})}
  }
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
