export async function removeMaterial(client,id,progress=()=>{}){
 const current=await client.from('mow_submissions').select('id,status,author_id').eq('id',id).maybeSingle();
 if(current.error)throw current.error;
 if(!current.data)return;
 const photos=await client.from('mow_submission_photos').select('storage_path').eq('submission_id',id);
 if(photos.error)throw photos.error;
 const paths=photos.data.map(p=>p.storage_path);
 // Drafts can have uploaded files whose metadata was not yet saved.
 const prefix=current.data.author_id+'/'+id;
 for(let offset=0;;offset+=100){
  const listed=await client.storage.from('mow-materials').list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}});
  if(listed.error)throw listed.error;
  paths.push(...listed.data.filter(x=>x.id).map(x=>prefix+'/'+x.name));
  if(listed.data.length<100)break;
 }
 if(paths.length){
  progress('Usuwanie zdjęć z aplikacji…');
  const removed=await client.storage.from('mow-materials').remove([...new Set(paths)]);
  if(removed.error)throw removed.error;
 }
 progress('Usuwanie materiału i historii redakcji…');
 const result=await client.rpc('mow_delete_submission',{p_submission_id:id});
 if(result.error){
  const check=await client.from('mow_submissions').select('id').eq('id',id).maybeSingle();
  if(check.error||check.data)throw result.error;
 }
}
