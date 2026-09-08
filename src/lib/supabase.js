import { createClient } from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL || 'https://tuxtnlqtakhtvdesbmow.supabase.co';
const key=import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_d2cI7gwgLZE2OCzw8wr82Q_Zh0pDBqf';
export const supabase=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
