const ACCESS_KEY='mow-device-access-v1';

export function normalizeWorkEmail(value=''){return String(value).trim().toLowerCase();}
export function validWorkEmail(value=''){return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@mowmalbork\.pl$/i.test(normalizeWorkEmail(value));}
export function isStandalone(){
  if(typeof window==='undefined')return false;
  return window.matchMedia?.('(display-mode: standalone)').matches===true||window.navigator?.standalone===true;
}
export function createDeviceCredentials(){
  const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
  return {deviceId:crypto.randomUUID(),deviceSecret:[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('')};
}
export function loadDeviceAccess(){
  try{return JSON.parse(localStorage.getItem(ACCESS_KEY)||'null');}catch{return null;}
}
export function saveDeviceAccess(value){localStorage.setItem(ACCESS_KEY,JSON.stringify(value));return value;}
export function clearDeviceAccess(){localStorage.removeItem(ACCESS_KEY);}

async function invokeAccess(client,body){
  const {data,error}=await client.functions.invoke('mow-access',{body});
  if(error){
    let message=error.message||'Nie udało się połączyć z usługą aktywacji.';
    try{const payload=await error.context?.json();if(payload?.error)message=payload.error;}catch{}
    throw new Error(message);
  }
  if(data?.error)throw new Error(data.error);
  return data;
}

export async function requestDeviceAccess(client,workEmail){
  const email=normalizeWorkEmail(workEmail);
  if(!validWorkEmail(email))throw new Error('Wpisz służbowy adres w domenie @mowmalbork.pl.');
  const previous=loadDeviceAccess();
  const base=previous?.deviceId&&previous?.deviceSecret?previous:createDeviceCredentials();
  const data=await invokeAccess(client,{action:'request',workEmail:email,deviceId:base.deviceId,deviceSecret:base.deviceSecret});
  return saveDeviceAccess({...base,requestId:data.requestId,workEmail:email,status:data.status||'pending'});
}

export async function checkDeviceAccess(client,state=loadDeviceAccess()){
  if(!state?.requestId||!state?.deviceId||!state?.deviceSecret)return null;
  const data=await invokeAccess(client,{action:'status',requestId:state.requestId,deviceId:state.deviceId,deviceSecret:state.deviceSecret});
  return saveDeviceAccess({...state,status:data.status,loginEmail:data.loginEmail||state.loginEmail||null});
}

export async function signInApprovedDevice(client,state=loadDeviceAccess()){
  if(!state?.loginEmail||!state?.deviceSecret)throw new Error('Brak danych aktywacji urządzenia.');
  const {data,error}=await client.auth.signInWithPassword({email:state.loginEmail,password:state.deviceSecret});
  if(error)throw error;
  return data;
}
