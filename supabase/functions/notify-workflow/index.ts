import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 try{
  const supabaseUrl=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader=req.headers.get('Authorization')||'';
  const client=createClient(supabaseUrl,anon,{global:{headers:{Authorization:authHeader}}});
  const admin=createClient(supabaseUrl,service);
  const {data:{user},error:uerr}=await client.auth.getUser(); if(uerr||!user) return json({error:'unauthorized'},401);
  const {eventType,submissionId}=await req.json();
  const {data:sub,error}=await admin.from('submissions').select('id,title,author_id,status').eq('id',submissionId).single(); if(error) return json({error:'not-found'},404);
  const {data:profile}=await admin.from('profiles').select('role').eq('id',user.id).single();
  const isMod=profile?.role==='moderator';
  let recipients:string[]=[]; let title='MOW Fanpage',body='',url=`/?submission=${submissionId}`;
  if(eventType==='submitted' && user.id===sub.author_id){const {data:mods}=await admin.from('profiles').select('id').eq('role','moderator');recipients=(mods||[]).map(x=>x.id);body=`Nowy materiał: ${sub.title}`;}
  else if(eventType==='revision_ready' && isMod){recipients=[sub.author_id];body=`Wersja „${sub.title}” czeka na Twoją akceptację.`;}
  else if(eventType==='approved' && user.id===sub.author_id){const {data:mods}=await admin.from('profiles').select('id').eq('role','moderator');recipients=(mods||[]).map(x=>x.id);body=`Autor zaakceptował materiał: ${sub.title}`;}
  else if(eventType==='changes_requested' && user.id===sub.author_id){const {data:mods}=await admin.from('profiles').select('id').eq('role','moderator');recipients=(mods||[]).map(x=>x.id);body=`Autor prosi o poprawkę: ${sub.title}`;}
  else if(eventType==='published' && isMod){recipients=[sub.author_id];body=`Twój materiał został opublikowany: ${sub.title}`;}
  else return json({error:'forbidden-event'},403);
  recipients=[...new Set(recipients)].filter(Boolean);
  for(const uid of recipients) await admin.from('notifications').insert({user_id:uid,submission_id:submissionId,title,body,kind:eventType});
  const pub=Deno.env.get('VAPID_PUBLIC_KEY'),priv=Deno.env.get('VAPID_PRIVATE_KEY'),subject=Deno.env.get('VAPID_SUBJECT')||'mailto:admin@example.com';
  if(pub&&priv){webpush.setVapidDetails(subject,pub,priv);const {data:subs}=await admin.from('push_subscriptions').select('*').in('user_id',recipients);for(const s of subs||[]){try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({title,body,url}))}catch(err){if(err?.statusCode===404||err?.statusCode===410)await admin.from('push_subscriptions').delete().eq('id',s.id)}}}
  return json({ok:true});
 }catch(e){return json({error:String(e?.message||e)},500)}
});
function json(x,status=200){return new Response(JSON.stringify(x),{status,headers:{...cors,'content-type':'application/json'}})}
