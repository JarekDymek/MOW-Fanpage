import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:4173';
const browser=await chromium.launch({channel:'msedge',headless:true});
const reports=[];
const fixturePage=await browser.newPage();
const png=Buffer.from(await fixturePage.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=32;canvas.height=24;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#17345b';ctx.fillRect(0,0,32,24);
  return canvas.toDataURL('image/png').split(',')[1];
}),'base64');
await fixturePage.close();
const author='11111111-1111-4111-8111-111111111111',moderator='22222222-2222-4222-8222-222222222222';
let submission={id:'33333333-3333-4333-8333-333333333333',author_id:author,title:'Próba formularza – dane fikcyjne',event_date:'2026-09-07',location:'Sala testowa',body_original:'Fikcyjny opis wydarzenia do testu.',editorial_mode:'edit_approval',consent_status:'verified',status:'submitted'};
let revisions=[],photoCount=15,failUpload=false,failedOnce=false,insertCount=0,signCalls=0;
const calls=[];
async function session(role,{mobile=false,signedIn=true}={}){
  const uid=role==='moderator'?moderator:author;
  const context=await browser.newContext({serviceWorkers:'block',viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,permissions:['clipboard-read','clipboard-write']});
  await context.addInitScript(({uid,role,signedIn})=>{
    if(signedIn)localStorage.setItem('sb-tuxtnlqtakhtvdesbmow-auth-token',JSON.stringify({access_token:'test-access',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id:uid,email:'tester@example.invalid',aud:'authenticated',role:'authenticated'}}));
    // These test-only stubs never touch a native share destination.
    Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true});
    Object.defineProperty(navigator,'share',{value:async()=>{throw new DOMException('Test blocked','NotAllowedError')},configurable:true});
  },{uid,role,signedIn});
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===origin)return route.continue();
    if(!url.hostname.endsWith('.supabase.co'))return route.abort();
    const path=url.pathname,method=req.method();calls.push({path,method});
    const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(path.startsWith('/auth/'))return reply({user:{id:uid,email:'tester@example.invalid'}});
    if(path.includes('/functions/'))return reply({ok:true});
    if(path.startsWith('/storage/v1/object/sign/')&&method==='POST'){
      signCalls++;const body=req.postDataJSON();
      if(body.paths)return reply(body.paths.map(path=>({path,signedURL:'/object/sign/mow-materials/test-photo.png?token=fake',error:null})));
      return reply({signedURL:'/object/sign/mow-materials/test-photo.png?token=fake'});
    }
    if(path.includes('test-photo.png'))return route.fulfill({status:200,contentType:'image/png',body:png});
    if(path.startsWith('/storage/v1/object/')&&method==='POST'){
      if(failUpload&&!failedOnce){failedOnce=true;return reply({message:'Test przerwanego wysyłania',statusCode:'500',error:'test'},500)}
      return reply({Key:'test'});
    }
    if(path.endsWith('/mow_profiles'))return reply({id:uid,full_name:role==='moderator'?'Moderator testowy':'Autor testowy',unit:'wychowawca · internat · grupa testowa',role});
    if(path.endsWith('/mow_submissions')){
      if(method==='PATCH'){submission={...submission,...req.postDataJSON()};return reply([{id:submission.id}]);}
      if(method==='POST'){insertCount++;submission={...submission,...req.postDataJSON(),id:submission.id};return reply(submission,201)}
      return reply(req.headers().accept?.includes('vnd.pgrst.object')?submission:[submission]);
    }
    if(path.endsWith('/mow_submission_photos')){
      if(method==='POST')return reply(null,201);
      return reply(Array.from({length:photoCount},(_,i)=>({submission_id:submission.id,order_index:i,storage_path:`${author}/${submission.id}/${i}.jpg`})));
    }
    if(path.endsWith('/mow_revisions'))return reply(revisions);
    if(path.includes('/rpc/')){
      const body=req.postDataJSON();
      if(path.endsWith('mow_create_revision_and_send')){revisions=[{id:'44444444-4444-4444-8444-444444444444',content:body.p_content,version_no:1}];submission.status='awaiting_author';}
      if(path.endsWith('mow_respond_to_revision')){submission.status=body.p_approved?'approved':'changes_requested';revisions[0].response=submission.status;}
      if(path.endsWith('mow_submit_submission'))submission.status='submitted';
      if(path.endsWith('mow_mark_published')){submission.status='published';submission.published_url=body.p_url;}
      return reply(null);
    }
    throw new Error('Unhandled mock route '+method+' '+path);
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  return {context,page,errors};
}
try{
  const guest=await session('employee',{signedIn:false});
  for(const path of ['/admin/','/wychowawca/']){
    await guest.page.goto(origin+path);await guest.page.locator('#l').waitFor();
    assert.equal(await guest.page.locator('input[type=email]').count(),1);
  }
  await guest.page.keyboard.press('p');await guest.page.locator('#mowHelpOverlay').waitFor();
  await guest.page.keyboard.press('Escape');assert.equal(await guest.page.locator('#mowHelpOverlay').count(),0);
  await guest.page.locator('input[type=email]').fill('p');assert.equal(await guest.page.locator('#mowHelpOverlay').count(),0);
  reports.push('Start obu wejść i pomoc P/Esc bez logowania: PASS');await guest.context.close();

  const mod=await session('moderator');
  await mod.page.goto(origin+'/admin/?submission='+submission.id);await mod.page.locator('#rev').waitFor();
  await mod.page.locator('#copyEdit').click();assert.equal(await mod.page.evaluate(()=>navigator.clipboard.readText()),submission.body_original);
  await mod.page.locator('#rev').fill('Wersja redakcyjna testowa 🎉');
  await mod.page.locator('#send').click();await mod.page.waitForFunction(()=>document.body.innerText.includes('Czeka na autora'));
  assert.equal(submission.status,'awaiting_author');reports.push('Moderator: kopiowanie i odesłanie redakcji: PASS');

  const worker=await session('employee',{mobile:true});
  await worker.page.goto(origin+'/wychowawca/?submission='+submission.id);await worker.page.locator('#ok').waitFor();
  await worker.page.locator('#ok').click();await worker.page.waitForFunction(()=>document.body.innerText.includes('Zaakceptowane'));
  assert.equal(submission.status,'approved');assert.equal(await worker.page.locator('[data-mod]').count(),0);
  reports.push('Autor na ekranie 390 px: akceptacja, brak panelu moderatora: PASS');
  await mod.page.reload();await mod.page.locator('#downloadPhotos:not([disabled])').waitFor();
  assert.equal(await mod.page.locator('#photoDownloads a').count(),15);
  assert.equal(await mod.page.locator('#sharePhotos').isDisabled(),true);
  await mod.page.locator('#copyFinal').click();assert.equal(await mod.page.evaluate(()=>navigator.clipboard.readText()),'Wersja redakcyjna testowa 🎉');
  await mod.page.locator('#photoDownloads summary').click();
  const download=mod.page.waitForEvent('download');await mod.page.locator('#photoDownloads a').first().click();assert.equal((await download).suggestedFilename(),'01.jpg');
  reports.push('15 zdjęć: komplet linków, pobranie JPEG, kopiowanie zaakceptowanego tekstu: PASS');
  await mod.page.evaluate(()=>scrollTo(0,0));await mod.page.screenshot({path:'output/playwright/moderator.png',fullPage:true});

  await mod.page.evaluate(()=>Object.defineProperty(navigator,'canShare',{value:()=>true,configurable:true}));
  await mod.page.reload();await mod.page.locator('#downloadPhotos:not([disabled])').waitFor();
  // Init scripts reset canShare at reload; set support before the next preload using a new init script.
  await mod.context.addInitScript(()=>Object.defineProperty(navigator,'canShare',{value:()=>true,configurable:true}));
  await mod.page.reload();await mod.page.locator('#sharePhotos:not([disabled])').waitFor();
  await mod.page.locator('#sharePhotos').click();await mod.page.getByText(/Udostępnianie zostało zablokowane/).waitFor();
  assert.equal(await mod.page.locator('#downloadPhotos').isEnabled(),true);
  reports.push('Odmowa Web Share: widoczny komunikat i działające pobieranie: PASS');

  await mod.page.locator('#url').fill('https://www.facebook.com/mow');
  await mod.page.locator('#pub').click();await mod.page.getByText(/Wklej pełny adres konkretnego posta/).waitFor();
  assert.equal(submission.status,'approved');
  await mod.page.locator('#url').fill('https://www.facebook.com/test-page/posts/123');
  await mod.page.locator('#pub').click();await mod.page.getByText('Otwórz post',{exact:true}).waitFor();
  assert.equal(submission.status,'published');
  reports.push('Adres fanpage odrzucony, oznaczenie konkretnego posta zapisane tylko w atrapie: PASS');
  submission.status='approved';

  submission.consent_status='needs_review';await mod.page.reload();await mod.page.locator('.warnbox').waitFor();
  assert.equal(await mod.page.locator('#pub').count(),0);assert.equal(await mod.page.locator('#copyFinal').count(),0);
  reports.push('Status wizerunku do weryfikacji blokuje publikację w UI: PASS');
  await mod.page.locator('#verifyConsent input').check();await mod.page.locator('#verifyConsent button').click();await mod.page.locator('#pub').waitFor();
  assert.equal(submission.consent_status,'verified');reports.push('Moderator zapisuje sprawdzenie wizerunku i odblokowuje gotowy materiał: PASS');
  await worker.page.goto(origin+'/wychowawca/');await worker.page.locator('#n').waitFor();
  await worker.page.locator('#e').click();await worker.page.locator('#ep').waitFor();
  assert.equal(await worker.page.locator('[name=position]').inputValue(),'wychowawca');
  await worker.page.locator('[data-new]').click();await worker.page.locator('#f').waitFor();
  await worker.page.locator('[name=title]').fill('Nowy test');await worker.page.locator('[name=event_date]').fill('2026-09-07');
  await worker.page.locator('[name=location]').fill('Sala testowa');await worker.page.locator('[name=body_original]').fill('Tekst testowy');
  await worker.page.locator('[value=verified]').check();for(let i=0;i<5;i++)await worker.page.locator(`[name=c${i}]`).check();
  await worker.page.locator('#ph').setInputFiles({name:'test.png',mimeType:'image/png',buffer:png});
  await worker.page.getByText('Gotowe: 1/15',{exact:true}).waitFor();
  await worker.page.evaluate(()=>scrollTo(0,0));await worker.page.screenshot({path:'output/playwright/worker-mobile.png',fullPage:true});
  failUpload=true;photoCount=1;
  await worker.page.locator('.primary.big').click();await worker.page.getByText(/Wysyłanie przerwane/).waitFor();
  await worker.page.locator('.primary.big').click();await worker.page.waitForURL('**/?submission=*');
  await worker.page.locator('h1').waitFor();assert.equal(insertCount,1);assert.equal(submission.status,'submitted');
  reports.push('Przetworzenie PNG, błąd wysyłki i wznowienie bez drugiego zgłoszenia: PASS');
  assert.equal((await worker.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),false);
  assert.deepEqual(mod.errors,[]);assert.deepEqual(worker.errors,[]);reports.push('Brak pageerror i poziomego przewijania na 390 px: PASS');
  await worker.context.close();await mod.context.close();
  fs.writeFileSync('output/playwright/results.json',JSON.stringify({reports,signCalls,productionWrites:0,scope:'Real browser, mocked Supabase; no live backend or native Facebook test.'},null,2));
  console.log(reports.join('\n'));
}finally{await browser.close();}
