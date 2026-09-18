import {createClient} from 'npm:@supabase/supabase-js@2.57.4';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'
};
const MODERATOR_EMAIL='dymek.jaroslaw@mowmalbork.pl';
const MODERATOR_NAME='Jarosław Dymek';
const ADMIN_REDIRECT='https://mow-fanpage.vercel.app/admin/';
const WORK_EMAIL=/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@mowmalbork\.pl$/i;

const url=Deno.env.get('SUPABASE_URL')!;
const anonKey=Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const service=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const publicClient=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'method-not-allowed'},405);
  try{
    const body=await req.json();
    switch(body?.action){
      case 'request': return await requestAccess(req,body);
      case 'status': return await accessStatus(body);
      case 'list': return await moderatorList(req);
      case 'approve': return await moderatorDecision(req,body.requestId,'approved');
      case 'reject': return await moderatorDecision(req,body.requestId,'rejected');
      case 'revoke': return await moderatorDecision(req,body.requestId,'revoked');
      default:return json({error:'Nieznana operacja.'},400);
    }
  }catch(error){
    console.error('mow-access',error);
    return json({error:'Nie udało się wykonać operacji aktywacji.'},500);
  }
});

async function requestAccess(req,body){
  const workEmail=String(body.workEmail||'').trim().toLowerCase();
  const deviceId=String(body.deviceId||'').trim();
  const deviceSecret=String(body.deviceSecret||'');
  if(!WORK_EMAIL.test(workEmail))return json({error:'Wpisz służbowy adres w domenie @mowmalbork.pl.'},400);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId))return json({error:'Nieprawidłowy identyfikator urządzenia.'},400);
  if(!/^[0-9a-f]{64}$/i.test(deviceSecret))return json({error:'Nieprawidłowy sekret urządzenia.'},400);

  const secretHash=await sha256(deviceSecret);
  const {data:existing,error:existingError}=await service.from('mow_access_requests')
    .select('id,work_email,secret_hash,status,last_notified_at')
    .eq('device_id',deviceId).maybeSingle();
  if(existingError)throw existingError;
  if(existing){
    if(existing.work_email!==workEmail||!safeEqual(existing.secret_hash||'',secretHash))return json({error:'Ta instalacja ma inne dane aktywacji.'},403);
    if(existing.status==='pending')await maybeNotifyModerator(existing.id,existing.last_notified_at);
    return json({requestId:existing.id,status:existing.status});
  }

  const rawIp=(req.headers.get('x-forwarded-for')||req.headers.get('cf-connecting-ip')||'unknown').split(',')[0].trim();
  const ipHash=await sha256('mow-access-ip:'+rawIp);
  const since=new Date(Date.now()-60*60*1000).toISOString();
  const {count,error:countError}=await service.from('mow_access_requests').select('id',{count:'exact',head:true})
    .eq('request_ip_hash',ipHash).gte('requested_at',since);
  if(countError)throw countError;
  if((count||0)>=5)return json({error:'Zbyt wiele prób aktywacji z tego urządzenia. Spróbuj później.'},429);

  const {data:created,error:createError}=await service.from('mow_access_requests').insert({
    device_id:deviceId,work_email:workEmail,secret_hash:secretHash,status:'pending',
    request_ip_hash:ipHash,user_agent:(req.headers.get('user-agent')||'').slice(0,300)
  }).select('id,status').single();
  if(createError)throw createError;
  await maybeNotifyModerator(created.id,null);
  return json({requestId:created.id,status:created.status});
}

async function accessStatus(body){
  const requestId=String(body.requestId||'');
  const deviceId=String(body.deviceId||'');
  const deviceSecret=String(body.deviceSecret||'');
  if(!requestId||!deviceId||!/^[0-9a-f]{64}$/i.test(deviceSecret))return json({error:'Brak danych aktywacji.'},400);
  const {data:row,error}=await service.from('mow_access_requests')
    .select('id,device_id,secret_hash,status,auth_user_id').eq('id',requestId).eq('device_id',deviceId).maybeSingle();
  if(error)throw error;
  if(!row||!safeEqual(row.secret_hash||'',await sha256(deviceSecret)))return json({error:'Nieprawidłowe dane aktywacji.'},403);
  if(row.status!=='approved')return json({status:row.status});
  const loginEmail=internalEmail(row.id);
  if(!row.auth_user_id){
    const user=await ensureDeviceUser(row.id,loginEmail,deviceSecret);
    const {error:updateError}=await service.from('mow_access_requests').update({auth_user_id:user.id,updated_at:new Date().toISOString()})
      .eq('id',row.id).is('auth_user_id',null);
    if(updateError)throw updateError;
  }
  return json({status:'approved',loginEmail});
}

async function ensureDeviceUser(requestId,email,password){
  const existing=await findAuthUser(email);
  if(existing)return existing;
  const {data,error}=await service.auth.admin.createUser({
    email,password,email_confirm:true,
    app_metadata:{mow_device:true,mow_access_request:requestId}
  });
  if(!error&&data.user)return data.user;
  const recovered=await findAuthUser(email);
  if(recovered)return recovered;
  throw error||new Error('Nie udało się utworzyć konta urządzenia.');
}

async function maybeNotifyModerator(requestId,lastNotifiedAt){
  if(lastNotifiedAt&&Date.now()-new Date(lastNotifiedAt).getTime()<10*60*1000)return;
  const oneMinuteAgo=new Date(Date.now()-60*1000).toISOString();
  const {data:recent}=await service.from('mow_access_requests').select('id').gte('last_notified_at',oneMinuteAgo).limit(1);
  if(recent?.length)return;
  await ensureModeratorAccount();
  const {error}=await publicClient.auth.signInWithOtp({
    email:MODERATOR_EMAIL,
    options:{shouldCreateUser:false,emailRedirectTo:ADMIN_REDIRECT}
  });
  if(error){console.error('Moderator email notification failed',error.message);return;}
  await service.from('mow_access_requests').update({last_notified_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',requestId);
}

async function ensureModeratorAccount(){
  let user=await findAuthUser(MODERATOR_EMAIL);
  if(!user){
    const {data,error}=await service.auth.admin.createUser({email:MODERATOR_EMAIL,email_confirm:true});
    if(error)throw error;
    user=data.user;
  }
  const {error:profileError}=await service.from('mow_profiles').upsert({
    id:user.id,full_name:MODERATOR_NAME,unit:'moderator · MOW nr 1',role:'moderator',work_email:MODERATOR_EMAIL
  },{onConflict:'id'});
  if(profileError)throw profileError;
  const {data:access,error:accessError}=await service.from('mow_access_requests').select('id,status').eq('auth_user_id',user.id).maybeSingle();
  if(accessError)throw accessError;
  if(!access){
    const {error:insertError}=await service.from('mow_access_requests').insert({
      device_id:crypto.randomUUID(),work_email:MODERATOR_EMAIL,status:'approved',auth_user_id:user.id,
      approved_at:new Date().toISOString(),approved_by:user.id,is_legacy:true
    });
    if(insertError)throw insertError;
  }else if(access.status!=='approved'){
    const {error:updateError}=await service.from('mow_access_requests').update({status:'approved',approved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',access.id);
    if(updateError)throw updateError;
  }
  return user;
}

async function moderatorList(req){
  const moderator=await requireModerator(req);
  if(!moderator)return json({error:'Brak uprawnień moderatora.'},403);
  const {data,error}=await service.from('mow_access_requests')
    .select('id,work_email,status,requested_at,approved_at,rejected_at,revoked_at,auth_user_id')
    .eq('is_legacy',false).order('requested_at',{ascending:false}).limit(100);
  if(error)throw error;
  return json({requests:data||[]});
}

async function moderatorDecision(req,requestId,status){
  const moderator=await requireModerator(req);
  if(!moderator)return json({error:'Brak uprawnień moderatora.'},403);
  if(!requestId)return json({error:'Brak identyfikatora prośby.'},400);
  const now=new Date().toISOString();
  const patch={status,updated_at:now};
  if(status==='approved'){patch.approved_at=now;patch.approved_by=moderator.id;patch.rejected_at=null;patch.rejected_by=null;patch.revoked_at=null;patch.revoked_by=null;}
  if(status==='rejected'){patch.rejected_at=now;patch.rejected_by=moderator.id;}
  if(status==='revoked'){patch.revoked_at=now;patch.revoked_by=moderator.id;}
  const {data,error}=await service.from('mow_access_requests').update(patch).eq('id',requestId).eq('is_legacy',false)
    .select('id,status,work_email').maybeSingle();
  if(error)throw error;
  if(!data)return json({error:'Prośba nie istnieje.'},404);
  return json({ok:true,request:data});
}

async function requireModerator(req){
  const auth=req.headers.get('Authorization')||'';
  if(!auth)return null;
  const client=createClient(url,anonKey,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user)return null;
  const {data:profile}=await service.from('mow_profiles').select('role').eq('id',user.id).maybeSingle();
  const {data:access}=await service.from('mow_access_requests').select('status').eq('auth_user_id',user.id).maybeSingle();
  return profile?.role==='moderator'&&access?.status==='approved'?user:null;
}

async function findAuthUser(email){
  const normalized=email.toLowerCase();
  for(let page=1;page<=10;page++){
    const {data,error}=await service.auth.admin.listUsers({page,perPage:100});
    if(error)throw error;
    const found=data.users.find(user=>user.email?.toLowerCase()===normalized);
    if(found)return found;
    if(data.users.length<100)break;
  }
  return null;
}

function internalEmail(id){return 'mow-app+'+id.replaceAll('-','')+'@mowmalbork.pl';}
async function sha256(value){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function safeEqual(a,b){
  if(a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
}
function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{...cors,'content-type':'application/json'}});}
