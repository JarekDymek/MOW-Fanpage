import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {isFacebookPostUrl} from '../src/lib/publication.js';

test('Publication accepts a post link and rejects a fanpage, script or lookalike host',()=>{
  for(const url of ['https://www.facebook.com/mow/posts/123','https://m.facebook.com/story.php?story_fbid=123&id=456','https://www.facebook.com/share/p/abcd/','https://fb.watch/abcd/'])assert.equal(isFacebookPostUrl(url),true,url);
  for(const url of ['','javascript:alert(1)','https://facebook.com/','https://facebook.com/mow','https://facebook.com.evil.invalid/mow/posts/123','http://facebook.com/mow/posts/123','https://user:password@facebook.com/mow/posts/123'])assert.equal(isFacebookPostUrl(url),false,url);
});

test('Worker only removes MOW caches and never handles private assets or API data',async()=>{
  const events={},deleted=[];
  vm.runInNewContext(fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{
    self:{addEventListener:(type,handler)=>events[type]=handler,skipWaiting(){},clients:{claim:async()=>{}}},
    caches:{keys:async()=>['mow-fanpage-v1','mow-fanpage-v11','other-app-cache'],delete:async name=>deleted.push(name)},
    fetch:async()=>{throw Error('offline')},Response,Promise
  });
  let activation;events.activate({waitUntil:promise=>activation=promise});await activation;
  assert.deepEqual(deleted,['mow-fanpage-v1','mow-fanpage-v11']);
  for(const mode of ['cors','no-cors','same-origin'])events.fetch({request:{mode},respondWith(){assert.fail('Private request intercepted')}});
  let response;events.fetch({request:{mode:'navigate'},respondWith:promise=>response=promise});
  assert.equal((await response).status,503);assert.match(await(await response).text(),/Brak połączenia/);
});


test('New educator activation is moderator-gated and cannot self-register by magic link',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  const edge=fs.readFileSync(new URL('../supabase/functions/mow-access/index.ts',import.meta.url),'utf8');
  const migration=fs.readFileSync(new URL('../supabase/migrations/20260918065530_mow_device_access_approval.sql',import.meta.url),'utf8');
  assert.match(app,/requestDeviceAccess\(S/);
  assert.match(app,/isStandalone\(\)/);
  assert.doesNotMatch(app,/shouldCreateUser:true/);
  assert.match(edge,/case 'approve'/);
  assert.match(edge,/requireModerator/);
  assert.match(edge,/@mowmalbork\\\.pl/);
  assert.match(migration,/mow_has_access/);
  assert.match(migration,/as restrictive for all to authenticated/);
});
