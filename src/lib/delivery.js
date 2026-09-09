const hex=buffer=>[...new Uint8Array(buffer)].map(x=>x.toString(16).padStart(2,'0')).join('');
export async function materialIdentity(payload,photos){
  const hashes=[];
  for(const photo of photos)hashes.push(hex(await crypto.subtle.digest('SHA-256',await photo.arrayBuffer())));
  const body=JSON.stringify([Object.keys(payload).sort().map(k=>[k,payload[k]]),hashes]);
  const h=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body)));
  return {id:`${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`,hashes};
}

// Stable content ID + existing database uniqueness constraints protect retries,
// lost acknowledgements, reloads and concurrent tabs. Never overwrite a photo.
export async function deliver(client,payload,photos,identity,progress=()=>{}){
  const {id,hashes}=identity;
  const read=async()=>{const r=await client.from('mow_submissions').select('id,status').eq('id',id).maybeSingle();if(r.error)throw r.error;return r.data;};
  let saved=await read();
  if(saved&&saved.status!=='draft')return {id,alreadySent:true};
  if(!saved){
    progress(0,'Zapisywanie opisu…');
    const result=await client.from('mow_submissions').insert({...payload,id});
    if(result.error){saved=await read();if(!saved)throw result.error;if(saved.status!=='draft')return {id,alreadySent:true};}
  }
  const listed=await client.from('mow_submission_photos').select('order_index,storage_path').eq('submission_id',id);
  if(listed.error)throw listed.error;
  for(let i=0;i<photos.length;i++){
    const path=`${payload.author_id}/${id}/${i}-${hashes[i]}.jpg`;
    const prior=listed.data?.find(x=>x.order_index===i);
    if(prior&&prior.storage_path!==path)throw Error('Zapisane zdjęcie różni się od wybranego. Otwórz Moje materiały.');
    progress(i,`Wysyłanie zdjęcia ${i+1} z ${photos.length}…`);
    if(!prior){
      const uploaded=await client.storage.from('mow-materials').upload(path,photos[i],{contentType:'image/jpeg',upsert:false});
      if(uploaded.error){
        // A timeout or "already exists" response is not proof of the stored bytes.
        const existing=await client.storage.from('mow-materials').download(path);
        if(existing.error||!existing.data||hex(await crypto.subtle.digest('SHA-256',await existing.data.arrayBuffer()))!==hashes[i])throw uploaded.error;
      }
      const added=await client.from('mow_submission_photos').insert({submission_id:id,storage_path:path,order_index:i,uploaded_by:payload.author_id});
      if(added.error){
        const check=await client.from('mow_submission_photos').select('storage_path').eq('submission_id',id).eq('order_index',i).maybeSingle();
        if(check.error||check.data?.storage_path!==path)throw added.error;
      }
    }
    progress(i+1,`Zapisano zdjęcia: ${i+1} z ${photos.length}`);
  }
  progress(photos.length,'Potwierdzanie odbioru przez moderatora…');
  const result=await client.rpc('mow_submit_submission',{p_submission_id:id});
  if(result.error){saved=await read();if(!saved||saved.status==='draft')throw result.error;return {id,alreadySent:true};}
  return {id,alreadySent:false};
}
