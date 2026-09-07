export async function preparePhoto(file){
  if(!file.type.startsWith('image/')) throw new Error('Nieobsługiwany plik.');
  const bmp=await createImageBitmap(file,{imageOrientation:'from-image'});
  const max=2048, scale=Math.min(1,max/Math.max(bmp.width,bmp.height));
  const w=Math.max(1,Math.round(bmp.width*scale)), h=Math.max(1,Math.round(bmp.height*scale));
  const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
  canvas.getContext('2d',{alpha:false}).drawImage(bmp,0,0,w,h);
  bmp.close?.();
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Nie udało się przetworzyć zdjęcia.')),'image/jpeg',0.84));
  return new File([blob],`${crypto.randomUUID()}.jpg`,{type:'image/jpeg',lastModified:Date.now()});
}
export function objectUrl(file){return URL.createObjectURL(file)}
