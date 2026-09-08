import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 try{
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const auth=req.headers.get('Authorization')||'';
  const client=createClient(url,anon,{global:{headers:{Authorization:auth}}}); const admin=createClient(url,service);
  const {data:{user},error:uerr}=await client.auth.getUser(); if(uerr||!user)return json({error:'unauthorized'},401);
  const {eventType,submissionId}=await req.json();
  const {data:sub,error}=await admin.from('mow_submissions').select('id,title,author_id,status').eq('id',submissionId).single(); if(error)return json({error:'not-found'},404);
  const {data:profile}=await admin.from('mow_profiles').select('role').eq('id',user.id).single(); const isMod=profile?.role==='moderator';
  const {data:mods}=await admin.from('mow_profiles').select('id').eq('role','moderator'); const modIds=(mods||[]).map(x=>x.id);
  let recipients:string[]=[]; let body=''; const title='MOW Fanpage';
  if(eventType==='submitted'&&user.id===sub.author_id){recipients=modIds;body=`Nowy materiał: ${sub.title}`;}
  else if(eventType==='revision_ready'&&isMod){recipients=[sub.author_id];body=`Wersja „${sub.title}” czeka na Twoją akceptację.`;}
  else if(eventType==='approved'&&user.id===sub.author_id){recipients=modIds;body=`Autor zaakceptował materiał: ${sub.title}`;}
  else if(eventType==='changes_requested'&&user.id===sub.author_id){recipients=modIds;body=`Autor prosi o poprawkę: ${sub.title}`;}
  else if(eventType==='published'&&isMod){recipients=[sub.author_id];body=`Twój materiał został opublikowany: ${sub.title}`;}
  else return json({error:'forbidden-event'},403);
  recipients=[...new Set(recipients)].filter(Boolean);
  for(const uid of recipients) await admin.from('mow_notifications').insert({user_id:uid,submission_id:submissionId,title,body,kind:eventType});
  return json({ok:true});
 }catch(e){return json({error:String(e?.message||e)},500)}
});
function json(x,status=200){return new Response(JSON.stringify(x),{status,headers:{...cors,'content-type':'application/json'}})}
