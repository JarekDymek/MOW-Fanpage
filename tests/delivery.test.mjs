import {test} from 'node:test';import assert from 'node:assert/strict';
import {materialIdentity,deliver} from '../src/lib/delivery.js';
const payload={author_id:'author-a',title:'Test',status:'draft'},photos=[new Blob(['photo-a']),new Blob(['photo-b'])];
function fixture(lost=''){
 const db={submission:null,photos:[],objects:new Set(),inserts:0,submits:0,failed:false};
 const failure=stage=>{if(lost===stage&&!db.failed){db.failed=true;return {error:{message:'Lost acknowledgement'}};}return {error:null};};
 const client={from(table){let inserted,filters={},single=false;const q={select(){return q},eq(k,v){filters[k]=v;return q},maybeSingle(){single=true;return q},insert(data){inserted=data;return q},then(resolve,reject){return Promise.resolve().then(()=>{
  if(inserted){if(table==='mow_submissions'){if(db.submission)return {error:{code:'23505'}};db.submission={...inserted};db.inserts++;return failure('submission');}if(db.photos.some(x=>x.order_index===inserted.order_index))return {error:{code:'23505'}};db.photos.push(inserted);return failure('metadata');}
  const rows=(table==='mow_submissions'?[db.submission].filter(Boolean):db.photos).filter(x=>Object.entries(filters).every(([k,v])=>x[k]===v));return {data:single?(rows[0]||null):rows,error:null};
 }).then(resolve,reject)}};return q;},storage:{from(){return {async upload(path){if(db.objects.has(path))return {error:{statusCode:'400',message:'Asset Already Exists'}};db.objects.add(path);return failure('upload');},async download(path){return db.objects.has(path)?{data:photos[Number(path.split('/').at(-1).split('-')[0])],error:null}:{error:{message:'Not found'}};}}}},async rpc(){if(db.submission.status!=='draft')return {error:{message:'already submitted'}};db.submission.status='submitted';db.submits++;return failure('submit');}};
 return {client,db};
}
test('Same content ignores file names, survives reconstruction and is scoped to author',async()=>{
 const a=await materialIdentity(payload,photos);assert.deepEqual(a,await materialIdentity(payload,[new File(['photo-a'],'different.jpg'),photos[1]]));
 assert.notEqual(a.id,(await materialIdentity({...payload,author_id:'other'},photos)).id);assert.notEqual(a.id,(await materialIdentity(payload,[photos[1],photos[0]])).id);
});
for(const lost of ['submission','upload','metadata','submit'])test('Retry after lost '+lost+' response keeps one complete submission',async()=>{
 const {client,db}=fixture(lost),id=await materialIdentity(payload,photos);
 try{await deliver(client,payload,photos,id);}catch{}
 await deliver(client,payload,photos,await materialIdentity(payload,photos));
 assert.equal(db.inserts,1);assert.equal(db.photos.length,2);assert.equal(db.objects.size,2);assert.equal(db.submits,1);assert.equal(db.submission.status,'submitted');
 assert.equal((await deliver(client,payload,photos,id)).alreadySent,true);
});
test('Concurrent tabs share one record, photo set and transition',async()=>{
 const {client,db}=fixture(),id=await materialIdentity(payload,photos);
 const results=await Promise.all([deliver(client,payload,photos,id),deliver(client,payload,photos,id)]);
 assert.equal(results.length,2);assert.equal(db.inserts,1);assert.equal(db.photos.length,2);assert.equal(db.submits,1);assert.equal(db.objects.size,2);
});
