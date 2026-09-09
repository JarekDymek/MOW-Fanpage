import { createClient } from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL || 'https://tuxtnlqtakhtvdesbmow.supabase.co';
const key=import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_d2cI7gwgLZE2OCzw8wr82Q_Zh0pDBqf';
async function timedFetch(input,init={}){const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),45000);const abort=()=>controller.abort();init.signal?.addEventListener('abort',abort,{once:true});if(init.signal?.aborted)controller.abort();try{return await fetch(input,{...init,signal:controller.signal});}finally{clearTimeout(timeout);init.signal?.removeEventListener('abort',abort);}}
export const supabase=createClient(url,key,{global:{fetch:timedFetch},auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
