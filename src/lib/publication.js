export function isFacebookPostUrl(value){
  try{
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password)return false;
    if(url.hostname==='fb.watch')return url.pathname.length>1;
    if(url.hostname!=='facebook.com'&&!url.hostname.endsWith('.facebook.com'))return false;
    return /\/(posts|photos|videos|reel|share)\//.test(url.pathname)
      || (/\/(photo|permalink|story)(\.php)?\/?$/.test(url.pathname)
        && (url.searchParams.has('fbid')||url.searchParams.has('story_fbid')));
  }catch{return false;}
}
