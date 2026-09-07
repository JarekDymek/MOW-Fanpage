import { supabase } from './supabase.js';
function b64ToUint8(s){const p='='.repeat((4-s.length%4)%4), b=(s+p).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(b);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
export async function enablePush(userId){
  const key=import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if(!key||!('serviceWorker'in navigator)||!('PushManager'in window)) return {ok:false,reason:'unsupported'};
  const permission=await Notification.requestPermission(); if(permission!=='granted') return {ok:false,reason:'permission'};
  const reg=await navigator.serviceWorker.ready;
  let sub=await reg.pushManager.getSubscription();
  if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint8(key)});
  const payload=sub.toJSON();
  const {error}=await supabase.from('push_subscriptions').upsert({user_id:userId,endpoint:payload.endpoint,p256dh:payload.keys?.p256dh,auth:payload.keys?.auth,user_agent:navigator.userAgent},{onConflict:'user_id,endpoint'});
  if(error) throw error; return {ok:true};
}
export async function notifyWorkflow(eventType,submissionId){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session) return;
  await supabase.functions.invoke('notify-workflow',{body:{eventType,submissionId},headers:{Authorization:`Bearer ${session.access_token}`}}).catch(()=>{});
}
