import {materialIdentity,deliver} from './lib/delivery.js';
import {attachFlow} from './lib/form-flow.js';
import { supabase as S } from './lib/supabase.js';
import { isFacebookPostUrl } from './lib/publication.js';

export async function startApp(){
  try {
    const ENTRY=location.pathname.startsWith('/admin')?'admin':'employee';
    const WORKER=ENTRY==='employee';
    const SHARE_BATCH_SIZE=10;
    const st={user:null,profile:null,photos:[],install:null,shareFiles:[],shareOffset:0};
    const $=(q,r=document)=>r.querySelector(q);
    const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const labels={draft:'Szkic',submitted:'Nowe',editing:'Do redakcji',awaiting_author:'Czeka na autora',changes_requested:'Do poprawki',approved:'Zaakceptowane',published:'Opublikowane',rejected:'Wstrzymane'};

    injectHelpStyles();
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();st.install=e;if(!$('#f'))render()});

    document.addEventListener('keydown',e=>{
      if(!WORKER)return;
      if(e.key==='Escape'){closeHelp();return;}
      if(e.key.toLowerCase()!=='p'||e.ctrlKey||e.altKey||e.metaKey)return;
      const t=e.target;
      if(t&&(t.matches?.('input,textarea,select')||t.isContentEditable))return;
      e.preventDefault();showContextHelp();
    });

    document.addEventListener('click',e=>{if((st.sending||st.preparing)&&e.target.closest('header button')){e.preventDefault();e.stopImmediatePropagation();}},true);
    window.addEventListener('beforeunload',e=>{if(st.sending){e.preventDefault();e.returnValue='';}});
    await boot();

    async function boot(){
      const {data:{session},error}=await S.auth.getSession();
      if(error) throw error;
      st.user=session?.user||null;
      if(st.user) await loadProfile();
      S.auth.onAuthStateChange((_event,session)=>{
        const nextUser=session?.user||null;
        if(nextUser?.id===st.user?.id)return;
        st.user=nextUser;st.profile=null;
        // Release Supabase's auth lock before requesting the profile.
        setTimeout(async()=>{
          try{if(st.user)await loadProfile();await render();}
          catch(error){shell(`<section class="card"><h1>Nie udało się otworzyć profilu</h1><p>${esc(error.message)}</p><p>Odśwież stronę, aby ponowić próbę.</p></section>`);}
        },0);
      });
      await render();
    }

    async function loadProfile(){
      const {data,error}=await S.from('mow_profiles').select('*').eq('id',st.user.id).maybeSingle();
      if(error) throw error;
      st.profile=data||null;
    }

    function shell(body){
      for(const url of [...(st.thumbUrls||[]),...(st.downloadUrls||[])])URL.revokeObjectURL(url);
      st.thumbUrls=[];st.downloadUrls=[];st.shareFiles=[];
      document.body.innerHTML=`<header><div class="brand"><img src="/icons/icon.svg" alt=""><b>MOW Fanpage</b>${ENTRY==='admin'?'<span class="pill">ADMIN</span>':''}</div><nav>${st.user&&st.profile?'<button data-home>Start</button><button data-new>Nowy materiał</button><button data-mine>Moje materiały</button><button data-profile>Profil</button>':''}${st.profile?.role==='moderator'?'<button data-mod>Moderator</button>':''}${st.install?'<button data-install>Zainstaluj</button>':''}${st.user?'<button data-out>Wyloguj</button>':''}</nav></header><main>${body}</main>`;
      $('[data-home]')?.addEventListener('click',home);
      $('[data-new]')?.addEventListener('click',form);
      $('[data-mine]')?.addEventListener('click',mine);
      $('[data-profile]')?.addEventListener('click',editProfile);
      $('[data-mod]')?.addEventListener('click',mod);
      $('[data-out]')?.addEventListener('click',()=>S.auth.signOut());
      $('[data-install]')?.addEventListener('click',async()=>{await st.install.prompt();st.install=null;render()});
      if(WORKER) ensureHelpButton();
    }

    function render(){
      if(!st.user)return login();
      if(!st.profile)return setup();
      const id=new URLSearchParams(location.search).get('submission');
      if(id)return detail(id);
      if(ENTRY==='admin'&&st.profile.role==='moderator')return mod();
      home();
    }

    function login(){
      shell(`<section class="card login"><h1>${ENTRY==='admin'?'Panel administratora':'Materiały do fanpage’a MOW'}</h1><p>Zaloguj się adresem e-mail. Każdy wychowawca widzi tylko własne materiały.</p><form id="l"><label>E-mail<input type="email" name="email" required autocomplete="email"></label><button class="primary">Wyślij link logowania</button><p class="msg"></p></form></section>`);
      $('#l').onsubmit=async e=>{
        e.preventDefault();const loginButton=e.currentTarget.querySelector('button');if(loginButton.disabled)return;loginButton.disabled=true;const m=$('.msg'),email=new FormData(e.currentTarget).get('email'),r=`${location.origin}${ENTRY==='admin'?'/admin/':'/wychowawca/'}`;
        m.textContent='Wysyłanie…';
        const{error}=await S.auth.signInWithOtp({email,options:{emailRedirectTo:r,shouldCreateUser:true}});
        m.textContent=error?error.message:'Sprawdź skrzynkę i otwórz link logowania. Kolejny link możesz wysłać za minutę.';setTimeout(()=>{if(loginButton.isConnected)loginButton.disabled=false;},error?1000:60000);
      };
    }

    function profileFields(values={}){
      return `<div class="grid"><label class="wide">Imię i nazwisko<input name="full_name" required maxlength="120" value="${esc(values.full_name||'')}"></label><label>Funkcja<input name="position" placeholder="np. wychowawca, nauczyciel" required maxlength="60" value="${esc(values.position||'')}"></label><label>Miejsce pracy<input name="workplace" placeholder="np. internat, szkoła" required maxlength="60" value="${esc(values.workplace||'')}"></label><label class="wide">Grupa / dodatkowy opis (opcjonalnie)<input name="group_name" placeholder="np. grupa V" maxlength="60" value="${esc(values.group_name||'')}"></label></div>`;
    }
    function composeUnit(fd){return [fd.get('position'),fd.get('workplace'),fd.get('group_name')].map(x=>String(x||'').trim()).filter(Boolean).join(' · ')}
    function splitUnit(unit=''){const p=String(unit).split(' · ');return p.length>=2?{position:p[0]||'',workplace:p[1]||'',group_name:p.slice(2).join(' · ')}:{position:'',workplace:'',group_name:unit||''}}

    function setup(){
      shell(`<section class="card login"><h1>Pierwsze uruchomienie</h1><p class="hint">Uzupełnij dane służbowe. Rola moderatora jest nadawana systemowo.</p><form id="p">${profileFields()}<button class="primary">Utwórz profil</button><p class="msg"></p></form></section>`);
      $('#p').onsubmit=async e=>{
        e.preventDefault();const f=new FormData(e.currentTarget);
        if(composeUnit(f).length>120)return $('.msg').textContent='Skróć funkcję, miejsce pracy i grupę: razem do 120 znaków.';
        const{error}=await S.rpc('mow_create_profile',{p_full_name:String(f.get('full_name')).trim(),p_unit:composeUnit(f)});
        if(error)return $('.msg').textContent=error.message;
        await loadProfile();render();
      };
    }

    function editProfile(){
      const v={full_name:st.profile.full_name,...splitUnit(st.profile.unit)};
      shell(`<section class="hero"><h1>Edytuj profil</h1><p>Uprawnienie moderatora nie podlega edycji.</p></section><section class="card"><form id="ep">${profileFields(v)}<p class="hint">Obecny opis: <b>${esc(st.profile.unit)}</b></p><button class="primary">Zapisz profil</button><p class="msg"></p></form></section>`);
      $('#ep').onsubmit=async e=>{
        e.preventDefault();const f=new FormData(e.currentTarget),m=$('.msg');m.textContent='Zapisywanie…';
        if(composeUnit(f).length>120)return m.textContent='Skróć funkcję, miejsce pracy i grupę: razem do 120 znaków.';
        const{error}=await S.rpc('mow_update_profile',{p_full_name:f.get('full_name'),p_unit:composeUnit(f)});
        if(error)return m.textContent=error.message;
        await loadProfile();m.textContent='Profil zapisany.';setTimeout(home,350);
      };
    }

    function workerGuide(){
      return `<section class="card mowGuide"><h2>Instrukcja dla wychowawcy</h2><p>Rozwiń temat, którego potrzebujesz. W każdej chwili możesz też użyć przycisku <b>P – Pomoc</b>.</p>
      <details><summary>Logowanie i profil</summary><p>Zaloguj się swoim adresem e-mail. Przy pierwszym wejściu wpisz imię i nazwisko, funkcję, miejsce pracy i ewentualnie grupę.</p></details>
      <details><summary>Dodanie materiału</summary><p>Wybierz <b>+ Nowy materiał</b>. Wpisz tytuł, datę, miejsce i tekst opisujący wydarzenie. Uwagi dla moderatora są opcjonalne.</p></details>
      <details><summary>Zdjęcia</summary><p>Dodaj fotografie związane z wydarzeniem i przeznaczone do rozpatrzenia do publikacji. Sprawdź miniatury przed wysłaniem. Maksymalnie piętnaście zdjęć.</p></details>
      <details><summary>Redakcja tekstu</summary><p>Jeżeli chcesz zobaczyć i zaakceptować tekst po redakcji moderatora, wybierz opcję redakcji z akceptacją. Jeżeli tekst ma pozostać w Twoim brzmieniu, wybierz oryginał.</p></details>
      <details><summary>Status wizerunku</summary><ul><li><b>Zgody / podstawy sprawdzone</b> – wybierz, gdy zgodnie z zasadami placówki sprawdziłeś podstawę publikacji osób widocznych na zdjęciach.</li><li><b>Tylko szerokie ujęcia wydarzenia</b> – wybierz przy ogólnych kadrach, gdy żadna osoba nie jest głównym bohaterem zdjęcia.</li><li><b>Proszę o weryfikację</b> – wybierz zawsze, gdy masz wątpliwość; administrator sprawdzi materiał przed publikacją.</li></ul></details>
      <details><summary>Potwierdzenia</summary><p>Przed wysłaniem sprawdź każde potwierdzenie: prawo do przekazania materiału, status wizerunku, brak danych wrażliwych, brak zgłoszonego sprzeciwu i prawdziwość informacji.</p></details>
      <details><summary>Po wysłaniu</summary><p>Materiał trafia do administratora. W zakładce <b>Moje materiały</b> możesz sprawdzić jego status. Jeżeli wybrałeś redakcję z akceptacją, wróć do materiału po otrzymaniu wersji do zatwierdzenia.</p></details>
      <details><summary>Akceptacja tekstu</summary><p>Przeczytaj wersję redakcyjną. Jeśli jest poprawna, zaakceptuj ją. Jeśli wymaga zmiany, wybierz prośbę o poprawkę i krótko wskaż, co poprawić.</p></details></section>`;
    }

    function home(){
      history.replaceState({},'',ENTRY==='admin'?'/admin/':'/wychowawca/');
      shell(`<section class="hero"><h1>Materiały do fanpage’a MOW</h1><p>Zdjęcia, opis, kontrola zgód, redakcja i akceptacja w jednym miejscu.</p></section><section class="card"><h2>${esc(st.profile.full_name)}</h2><p>${esc(st.profile.unit)}</p><div class="actions home-actions"><button class="primary" id="n"><span aria-hidden="true">＋</span> Przygotuj nowy materiał</button><button id="m">Moje materiały</button><button id="e">Edytuj profil</button>${st.profile.role==='moderator'?'<button id="x">Panel moderatora</button>':''}</div></section>${WORKER?'<details class="card guide-collapsed"><summary>Instrukcja i najczęstsze pytania</summary>'+workerGuide()+'</details>':''}`);
      $('#n').onclick=form;$('#m').onclick=mine;$('#e').onclick=editProfile;$('#x')&&($('#x').onclick=mod);
    }

    function inlineHelp(title,html){return `<details class="mowInlineHelp"><summary>Wyjaśnienie: ${title}</summary>${html}</details>`}

    function form(){
      if(st.sending||st.preparing)return;
      st.photos=[];st.upload=null;st.preparing=false;
      shell(`<section class="hero"><h1>Nowy materiał</h1><p>Wypełnij pięć kroków. Podświetlony krok pokaże Ci, co zrobić dalej.</p></section><form id="f"><section class="card"><h2>1. Wydarzenie</h2><div class="grid"><label class="wide">Tytuł<input name="title" required></label><label>Data<input type="date" name="event_date" required></label><label>Miejsce<input name="location" required></label><label class="wide">Tekst / opis<textarea name="body_original" rows="8" required></textarea></label><label class="wide">Uwagi dla moderatora<textarea name="editor_notes" rows="3"></textarea></label></div></section><section class="card"><h2>2. Zdjęcia</h2><p>Dodaj zdjęcia przeznaczone do publikacji.</p><input id="ph" type="file" accept="image/*" multiple><div id="th" class="thumbs"></div><p id="pm"></p>${inlineHelp('zdjęcia','<p>Wybierz zdjęcia dotyczące wydarzenia. Przed wysłaniem sprawdź miniatury i usuń fotografie, których nie chcesz przekazywać administratorowi.</p>')}</section><section class="card"><h2>3. Tekst</h2><label class="choice"><input type="radio" name="editorial_mode" value="edit_approval" checked> Przeredaguj w stylu fanpage’a MOW i odeślij do akceptacji</label><label class="choice"><input type="radio" name="editorial_mode" value="original"> Zachowaj mój tekst w oryginalnym brzmieniu</label>${inlineHelp('redakcja','<p>Opcja z akceptacją oznacza, że administrator przygotuje wersję redakcyjną i odeśle ją Tobie do zatwierdzenia. Oryginał pozostawia tekst bez tego etapu.</p>')}</section><section class="card"><h2>4. Status wizerunku</h2><label class="choice"><input type="radio" name="consent_status" value="verified" required> Zgody / podstawy sprawdzone</label><label class="choice"><input type="radio" name="consent_status" value="group_shots"> Tylko szerokie ujęcia wydarzenia</label><label class="choice"><input type="radio" name="consent_status" value="needs_review"> Proszę o weryfikację</label>${inlineHelp('status wizerunku','<p>Wskaż, czy podstawa publikacji została sprawdzona. Jeśli masz jakąkolwiek wątpliwość dotyczącą fotografii, wybierz <b>Proszę o weryfikację</b>.</p>')}</section><section class="card"><h2>5. Potwierdzenia</h2>${['Mam prawo przekazać zdjęcia i tekst MOW do publikacji.','Sprawdziłem/-am podstawę publikacji wizerunku lub oznaczyłem/-am materiał do weryfikacji.','Materiał nie zawiera danych wrażliwych ani informacji o terapii, karach lub sytuacji rodzinnej.','Żadna osoba będąca głównym bohaterem zdjęcia nie zgłosiła sprzeciwu.','Potwierdzam prawdziwość przekazanych informacji.'].map((t,i)=>`<label class="choice"><input type="checkbox" name="c${i}" required> ${t}</label>`).join('')}${inlineHelp('potwierdzenia','<p>Zaznacz je dopiero po rzeczywistym sprawdzeniu wskazanych kwestii.</p>')}</section><section class="send-panel"><h2>6. Wyślij do moderatora</h2><p>Jedno kliknięcie wystarczy. Poczekaj na potwierdzenie odbioru.</p><button class="primary big">Wyślij materiał</button><div id="deliveryStatus" role="status" aria-live="polite"></div><p class="msg" role="alert"></p></section></form>`);
      const formNode=$('#f');st.flow=attachFlow(formNode,()=>st.photos.length,()=>st.preparing);
      $('#ph').onchange=async e=>{
        const input=e.target,fs=[...input.files],msg=$('#pm');if(st.preparing||st.sending)return;
        if(fs.length>15||fs.some(f=>f.size>20*1024*1024)||fs.reduce((n,f)=>n+f.size,0)>120*1024*1024){input.value='';msg.textContent='Wybierz do 15 zdjęć: każde do 20 MB, razem do 120 MB.';return;}
        st.preparing=true;input.disabled=true;st.flow.update();
        try{const prepared=[];for(const f of fs){msg.innerHTML='<span class="spinner" aria-hidden="true"></span> Przygotowywanie zdjęcia '+(prepared.length+1)+' z '+fs.length;const file=await prep(f);if(file.size>3*1024*1024)throw Error('Zdjęcie jest zbyt duże');prepared.push(file);}if(!formNode.isConnected)return;st.photos=prepared;thumbs();msg.textContent='Gotowe: '+st.photos.length+'/15';}
        catch(error){if(formNode.isConnected)msg.textContent='Nie udało się odczytać zdjęcia. Wybierz plik JPEG lub PNG. Poprzedni wybór pozostał bez zmian.';}
        finally{st.preparing=false;input.disabled=false;if(formNode.isConnected)st.flow.update();}
      };
      $('#f').onsubmit=submit;
    }

    function thumbs(){for(const url of st.thumbUrls||[])URL.revokeObjectURL(url);st.thumbUrls=[];const b=$('#th');b.innerHTML=st.photos.map((f,i)=>`<div class="thumb"><img src="${(()=>{const url=URL.createObjectURL(f);st.thumbUrls.push(url);return url})()}"><button type="button" data-i="${i}" aria-label="Usuń zdjęcie ${i+1}">×</button></div>`).join('');b.querySelectorAll('button').forEach(x=>x.onclick=()=>{if(st.upload||st.sending)return;st.photos.splice(+x.dataset.i,1);thumbs();$('#pm').textContent=`Gotowe: ${st.photos.length}/15`;st.flow?.update()})}
    async function prep(f){const bmp=await createImageBitmap(f,{imageOrientation:'from-image'}),max=2048,sc=Math.min(1,max/Math.max(bmp.width,bmp.height)),c=document.createElement('canvas');c.width=Math.round(bmp.width*sc);c.height=Math.round(bmp.height*sc);c.getContext('2d',{alpha:false}).drawImage(bmp,0,0,c.width,c.height);bmp.close?.();const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.84));if(!blob)throw new Error('Nie udało się przygotować zdjęcia');return new File([blob],`${crypto.randomUUID()}.jpg`,{type:'image/jpeg'})}

    function deliveryProgress(done,text){
      const target=$('#deliveryStatus');if(!target)return;
      target.innerHTML='<div class="delivery-working"><span class="spinner" aria-hidden="true"></span><strong>'+esc(text)+'</strong></div><progress max="'+Math.max(1,st.photos.length)+'" value="'+done+'" aria-label="Liczba zapisanych zdjęć"></progress><p>Nie wysyłaj ponownie. Aplikacja sprawdza zapis.</p>';
    }
    function deliverySuccess(id,alreadySent){
      history.replaceState({},'',(ENTRY==='admin'?'/admin/':'/wychowawca/')+'?submission='+id);
      shell('<section class="card delivery-success" role="status"><div class="success-mark" aria-hidden="true">✓</div><h1>'+(alreadySent?'Ten materiał jest już wysłany':'Wysłano do moderatora')+'</h1><p>Opis i zdjęcia są zapisane. Nie musisz wysyłać ich ponownie.</p><div class="actions"><button class="primary" id="openSent">Zobacz wysłany materiał</button><button id="sentList">Moje materiały</button></div></section>');
      $('#openSent').onclick=()=>detail(id);$('#sentList').onclick=mine;
    }
    async function submit(e){
      e.preventDefault();if(st.sending)return;const formNode=e.currentTarget,m=formNode.querySelector('.msg');
      if(st.preparing){m.textContent='Poczekaj na przygotowanie zdjęć.';return;}
      if(!st.upload&&!st.flow.validate())return;
      if(!navigator.onLine){m.textContent='Brak internetu. Połącz się i spróbuj ponownie. Formularz pozostaje na ekranie.';return;}
      st.sending=true;const button=formNode.querySelector('button.primary.big');button.disabled=true;button.textContent='Wysyłanie…';m.textContent='';
      document.querySelectorAll('header button').forEach(b=>b.disabled=true);
      try{
        if(!st.upload){
          const f=new FormData(formNode),p={author_id:st.user.id,title:String(f.get('title')).trim(),event_date:f.get('event_date'),location:String(f.get('location')).trim(),body_original:String(f.get('body_original')).trim(),editor_notes:String(f.get('editor_notes')||'').trim(),editorial_mode:f.get('editorial_mode'),consent_status:f.get('consent_status'),rights_confirmed:true,consents_verified:true,safe_content_confirmed:true,youth_objection_checked:true,accuracy_confirmed:true,status:'draft'};
          formNode.querySelectorAll('input,textarea,select').forEach(el=>el.disabled=true);
          deliveryProgress(0,'Sprawdzanie materiału…');st.upload={payload:p,identity:await materialIdentity(p,st.photos)};
        }
        const result=await deliver(S,st.upload.payload,st.photos,st.upload.identity,deliveryProgress);
        if(!result.alreadySent)void notify('submitted',result.id);
        st.sending=false;deliverySuccess(result.id,result.alreadySent);
      }catch(error){
        $('#deliveryStatus').innerHTML='<strong>Nie mamy jeszcze potwierdzenia wysłania.</strong><p>Przy ponowieniu sprawdzimy dotychczasowy zapis, bez tworzenia drugiej kopii.</p>';
        m.textContent='Wysyłanie przerwane: '+(error.message||'Sprawdź połączenie.');button.textContent='Sprawdź zapis i ponów';
        if(!st.upload)formNode.querySelectorAll('input,textarea,select').forEach(el=>el.disabled=false);
      }finally{st.sending=false;if(button.isConnected)button.disabled=false;document.querySelectorAll('header button').forEach(b=>b.disabled=false);}
    }

    async function mine(){shell('<section class="hero"><h1>Moje materiały</h1></section><section class="card"><div id="list">Ładowanie…</div></section>');const{data,error}=await S.from('mow_submissions').select('id,title,status,consent_status,event_date').eq('author_id',st.user.id).order('created_at',{ascending:false});if(error)return $('#list').textContent=error.message;$('#list').innerHTML=data?.length?data.map(row).join(''):'Brak materiałów.';openers()}
    async function mod(){if(st.profile?.role!=='moderator')return home();shell('<section class="hero"><h1>Panel moderatora</h1></section><section class="card"><div id="list">Ładowanie…</div></section>');const{data,error}=await S.from('mow_submissions').select('id,title,status,consent_status,event_date').neq('status','draft').order('created_at',{ascending:false});if(error)return $('#list').textContent=error.message;$('#list').innerHTML=data?.length?data.map(row).join(''):'Brak zgłoszeń.';openers()}
    function row(x){return `<article class="item"><div><b>${esc(x.title)}</b><span class="status">${labels[x.status]||x.status}</span>${x.consent_status==='needs_review'?'<span class="warn">RODO — sprawdź</span>':''}</div><small>${esc(x.event_date)}</small><button data-open="${x.id}">Otwórz</button></article>`}
    function openers(){document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>location.href=`${ENTRY==='admin'?'/admin/':'/wychowawca/'}?submission=${b.dataset.open}`)}

    function fbPreview(text,urls){
      const shown=urls.slice(0,5),extra=Math.max(0,urls.length-5);
      return `<section class="card fb-wrap"><h2>Podgląd na fanpage’u</h2><p class="hint">Podgląd orientacyjny — Facebook może nieznacznie zmienić układ zależnie od urządzenia.</p><div class="fb-card"><div class="fb-head"><div class="fb-avatar">M</div><div><b>MOW Malbork</b><small>Teraz · 🌐</small></div></div><div class="fb-text">${esc(text).replace(/\n/g,'<br>')}</div><div class="fb-grid n${Math.min(shown.length,5)}">${shown.map((u,i)=>`<div class="fb-photo"><img src="${esc(u)}">${i===4&&extra?`<span>+${extra}</span>`:''}</div>`).join('')}</div><div class="fb-actions">👍 Lubię to! &nbsp;&nbsp; 💬 Skomentuj &nbsp;&nbsp; ↗ Udostępnij</div></div><div class="actions"><button class="primary" id="copyFinal">Kopiuj zaakceptowany tekst</button><button id="sharePhotos" disabled>Przygotowywanie zdjęć…</button><button id="downloadPhotos" disabled>Pobierz zdjęcia</button></div><p class="hint">Udostępnij zdjęcia do posta.</p><p class="msg" id="publishMsg"></p><div id="photoDownloads"></div></section>`;
    }

    async function detail(id){
      const q=await S.from('mow_submissions').select('*').eq('id',id).single();if(q.error)return shell(`<section class="card">${esc(q.error.message)}</section>`);
      const s=q.data;
      const results=await Promise.all([
        S.from('mow_profiles').select('full_name,unit').eq('id',s.author_id).maybeSingle(),
        S.from('mow_submission_photos').select('*').eq('submission_id',id).order('order_index'),
        S.from('mow_revisions').select('*').eq('submission_id',id).order('version_no',{ascending:false})
      ]);
      const failed=results.find(result=>result.error);
      if(failed)return shell(`<section class="card"><h1>Nie udało się pobrać materiału</h1><p>${esc(failed.error.message)}</p></section>`);
      const [{data:a},{data:ps},{data:rs}]=results,urls=[];
      if(ps?.length){
        const signed=await S.storage.from('mow-materials').createSignedUrls(ps.map(photo=>photo.storage_path),900);
        if(signed.error||signed.data?.some(item=>item.error||!item.signedUrl)||signed.data?.length!==ps.length)
          return shell('<section class="card"><h1>Nie udało się pobrać wszystkich zdjęć</h1><p>Odśwież stronę, aby ponowić próbę.</p></section>');
        urls.push(...signed.data.map(item=>item.signedUrl));
      }
      const last=rs?.[0],finalText=s.editorial_mode==='original'?s.body_original:(last?.content||s.body_original);let act='';
      if(st.user.id===s.author_id&&s.status==='awaiting_author'&&last)act=`<section class="card"><h2>Twoja akceptacja</h2><textarea id="c" rows="3" placeholder="Komentarz do poprawki (opcjonalnie)"></textarea><div class="actions"><button class="primary" id="ok">Akceptuję wersję</button><button id="fix">Proszę o poprawkę</button></div><p class="msg"></p></section>`;
      if(st.profile.role==='moderator'){
        act+=`<section class="card"><h2>Moderator</h2>${s.editorial_mode==='edit_approval'&&s.status!=='approved'&&s.status!=='published'?`<textarea id="rev" rows="10">${esc(last?.content||s.body_original)}</textarea><div class="actions"><button type="button" id="copyEdit">Kopiuj tekst do przeredagowania</button><button class="primary" id="send">Wyślij autorowi do akceptacji</button></div><p class="hint">Skopiuj tekst, przeredaguj go ręcznie w ChatGPT, wklej gotową wersję z powrotem do pola i wyślij autorowi do akceptacji.</p><p class="msg" id="editMsg"></p>`:''}${s.consent_status==='needs_review'?'<p class="warnbox">Publikacja zablokowana do wyjaśnienia statusu wizerunku.</p><form id="verifyConsent"><label class="choice"><input type="checkbox" required> Sprawdziłem/am aktualne podstawy publikacji wszystkich osób na zdjęciach, zakres zgód i brak sprzeciwu. Dokumentacja jest w placówce.</label><button type="submit">Zapisz weryfikację wizerunku</button><p id="consentMsg"></p></form>':''}<p class="msg"></p></section>`;
        if(s.consent_status!=='needs_review'&&(s.status==='approved'||(s.editorial_mode==='original'&&s.status==='submitted')))act+=fbPreview(finalText,urls)+`<section class="card"><h2>Po publikacji na Facebooku</h2><p class="hint">Wklej tu adres konkretnego opublikowanego posta.</p><input id="url" type="url" placeholder="https://www.facebook.com/.../posts/..."><button class="primary" id="pub">Oznacz jako opublikowane</button><p class="msg"></p></section>`;
      }
      shell(`<section class="hero"><h1>${esc(s.title)}</h1><p><span class="status">${labels[s.status]||s.status}</span></p></section><section class="card"><p><b>Autor:</b> ${esc(a?.full_name||'')} — ${esc(a?.unit||'')}</p><p>${esc(s.location)} · ${esc(s.event_date)}</p><h3>Tekst źródłowy</h3><div class="text">${esc(s.body_original).replace(/\n/g,'<br>')}</div><div class="gallery">${urls.map(u=>`<img src="${u}">`).join('')}</div></section>${last?`<section class="card"><h2>Wersja redakcyjna nr ${last.version_no}</h2><div class="text">${esc(last.content).replace(/\n/g,'<br>')}</div></section>`:''}${isFacebookPostUrl(s.published_url)?`<section class="card"><a class="primary linkbtn" href="${esc(s.published_url)}" target="_blank" rel="noopener">Otwórz post</a></section>`:''}${act}`);
      $('#verifyConsent')&&($('#verifyConsent').onsubmit=async e=>{
        e.preventDefault();const btn=e.currentTarget.querySelector('button'),m=$('#consentMsg');btn.disabled=true;
        const{data,error}=await S.from('mow_submissions').update({consent_status:'verified'}).eq('id',id).eq('consent_status','needs_review').select('id');
        if(error||!data?.length){m.textContent=error?.message||'Stan zmienił się. Otwórz materiał ponownie.';btn.disabled=false;return;}
        await detail(id);
      });
      $('#ok')&&($('#ok').onclick=()=>once(['#ok','#fix'],()=>respond(last.id,true)));
      $('#fix')&&($('#fix').onclick=()=>once(['#ok','#fix'],()=>respond(last.id,false,$('#c').value)));
      $('#copyEdit')&&($('#copyEdit').onclick=async()=>{const t=$('#rev').value,m=$('#editMsg');try{await navigator.clipboard.writeText(t);m.textContent='Tekst skopiowany. Wklej go teraz do ChatGPT.'}catch{m.textContent='Nie udało się skopiować automatycznie — zaznacz tekst i skopiuj ręcznie.'}});
      $('#send')&&($('#send').onclick=()=>once(['#send'],()=>revision(id,$('#rev').value)));
      $('#pub')&&($('#pub').onclick=()=>once(['#pub'],()=>publish(id,$('#url').value)));
      $('#copyFinal')&&($('#copyFinal').onclick=()=>copyAcceptedText(finalText));
      if($('#sharePhotos'))preloadShareFiles(urls);
    }

    async function copyAcceptedText(text){const m=$('#publishMsg');try{await navigator.clipboard.writeText(text);m.textContent='Zaakceptowany tekst skopiowany.'}catch{m.textContent='Nie udało się skopiować automatycznie — zaznacz tekst i skopiuj ręcznie.'}}

    async function preloadShareFiles(urls){
      const btn=$('#sharePhotos'),m=$('#publishMsg');if(!btn)return;
      try{
        m.textContent=`Przygotowywanie ${urls.length} zdjęć do udostępnienia…`;
        const files=await Promise.all(urls.map(async(u,i)=>{const r=await fetch(u);if(!r.ok)throw new Error(`Nie udało się przygotować zdjęcia ${i+1}`);const b=await r.blob();return new File([b],`${String(i+1).padStart(2,'0')}.jpg`,{type:b.type||'image/jpeg'})}));
        if(!btn.isConnected)return;
        st.shareFiles=files;
        st.shareOffset=0;updateShareButton();btn.onclick=shareAllPhotos;
        const download=$('#downloadPhotos');download.disabled=!st.shareFiles.length;download.onclick=downloadPhotos;
        const links=$('#photoDownloads');
        for(const url of st.downloadUrls||[])URL.revokeObjectURL(url);
        st.downloadUrls=st.shareFiles.map(file=>URL.createObjectURL(file));
        links.innerHTML='<details><summary>Pobierz pojedyncze zdjęcia</summary>'+st.downloadUrls.map((url,i)=>`<p><a href="${url}" download="${st.shareFiles[i].name}">Zdjęcie ${i+1}</a></p>`).join('')+'</details>';
      }catch(e){btn.disabled=true;btn.textContent='Nie udało się przygotować zdjęć';m.textContent=`Błąd: ${e.message}`;}
    }

    function updateShareButton(){
      const btn=$('#sharePhotos'),m=$('#publishMsg');if(!btn)return;
      const remaining=st.shareFiles.length-st.shareOffset;
      if(remaining<=0){btn.disabled=true;btn.textContent='Wszystkie zdjęcia udostępnione';if(m)m.textContent='Wszystkie zdjęcia zostały przekazane.';return;}
      const batch=st.shareFiles.slice(st.shareOffset,st.shareOffset+SHARE_BATCH_SIZE);
      if(!navigator.share||!navigator.canShare?.({files:batch})){btn.disabled=true;btn.textContent='Udostępnianie zdjęć niedostępne';if(m)m.textContent='Ta przeglądarka nie obsługuje udostępniania tego zestawu. Wybierz Pobierz zdjęcia lub pobierz je pojedynczo.';return;}
      btn.disabled=false;
      btn.textContent=st.shareOffset===0?`Udostępnij zdjęcia (${batch.length}${st.shareFiles.length>batch.length?` z ${st.shareFiles.length}`:''})`:`Udostępnij pozostałe zdjęcia (${remaining})`;
      if(m)m.textContent=st.shareFiles.length>SHARE_BATCH_SIZE&&st.shareOffset===0?`Zdjęcia gotowe. Udostępnij pierwszą część, a potem pozostałe.`:'Zdjęcia gotowe do udostępnienia.';
    }

    function downloadPhotos(){
      for(const [index,url] of st.downloadUrls.entries()){
        const link=document.createElement('a');link.href=url;link.download=st.shareFiles[index].name;
        document.body.append(link);link.click();link.remove();
      }
      $('#publishMsg').textContent='Rozpoczęto pobieranie zdjęć. Jeśli przeglądarka blokuje wiele plików, zezwól na pobieranie lub użyj linków do pojedynczych zdjęć.';
    }

    async function shareAllPhotos(){
      const m=$('#publishMsg'),batch=st.shareFiles.slice(st.shareOffset,st.shareOffset+SHARE_BATCH_SIZE);if(!batch.length)return;
      try{
        if(!navigator.canShare?.({files:batch}))throw new Error('Urządzenie nie obsługuje tego zestawu zdjęć.');
        await navigator.share({files:batch,title:'Zdjęcia do posta MOW'});
        st.shareOffset+=batch.length;updateShareButton();
      }catch(e){if(e?.name==='AbortError')return;if(m)m.textContent=e?.name==='NotAllowedError'?'Udostępnianie zostało zablokowane przez przeglądarkę lub system. Wybierz Pobierz zdjęcia albo pobierz je pojedynczo.':`Nie udało się udostępnić zdjęć: ${e.message}`;}
    }

    async function once(selectors,action){const buttons=selectors.map(x=>$(x)).filter(Boolean);if(buttons.some(b=>b.disabled))return;buttons.forEach(b=>b.disabled=true);try{await action();}catch(error){const m=$('.msg');if(m)m.textContent=error.message;}finally{buttons.forEach(b=>{if(b.isConnected)b.disabled=false;});}}
    async function respond(r,ok,c=''){const x=await S.rpc('mow_respond_to_revision',{p_revision_id:r,p_approved:ok,p_comment:c||null});if(x.error)return $('.msg').textContent=x.error.message;const id=new URLSearchParams(location.search).get('submission');await notify(ok?'approved':'changes_requested',id);location.reload()}
    async function revision(id,c){const x=await S.rpc('mow_create_revision_and_send',{p_submission_id:id,p_content:c});if(x.error)return $('.msg').textContent=x.error.message;await notify('revision_ready',id);location.reload()}
    async function publish(id,u){
      const message=$('#pub').parentElement.querySelector('.msg');
      if(!isFacebookPostUrl(u))return message.textContent='Wklej pełny adres konkretnego posta na Facebooku (https), skopiowany po publikacji.';
      const x=await S.rpc('mow_mark_published',{p_submission_id:id,p_url:u});
      if(x.error)return message.textContent=x.error.message;
      await notify('published',id);location.reload();
    }
    async function notify(eventType,submissionId){await S.functions.invoke('mow-notify-workflow',{body:{eventType,submissionId}}).catch(()=>{})}

    function injectHelpStyles(){
      const s=document.createElement('style');s.textContent=`#mowHelpButton{position:fixed;right:18px;bottom:18px;z-index:9998;min-width:54px;height:54px;padding:0 13px;border-radius:27px;border:0;background:#101827;color:#fff;font-size:18px;font-weight:800;box-shadow:0 6px 22px #0004;cursor:pointer}#mowHelpOverlay{position:fixed;inset:0;z-index:9999;background:#0008;display:flex;align-items:flex-end;justify-content:center;padding:12px}#mowHelpPanel{position:relative;background:#fff;color:#172033;width:min(720px,100%);max-height:88vh;overflow:auto;border-radius:18px 18px 8px 8px;padding:20px;box-shadow:0 12px 40px #0006}#mowHelpPanel h2{margin:0 42px 8px 0}#mowHelpPanel .helpClose{position:absolute;right:12px;top:10px;font-size:26px;border:0;background:transparent;cursor:pointer}.mowGuide details,.mowInlineHelp{border:1px solid #d9dee7;border-radius:10px;padding:10px 12px;margin:9px 0;background:#fbfcfe}.mowGuide summary,.mowInlineHelp summary{cursor:pointer;font-weight:700}@media(min-width:700px){#mowHelpOverlay{align-items:center}#mowHelpPanel{border-radius:18px}}`;document.head.appendChild(s);
    }

    function ensureHelpButton(){
      if(!WORKER||$('#mowHelpButton'))return;
      const b=document.createElement('button');b.id='mowHelpButton';b.type='button';b.textContent='P · Pomoc';b.setAttribute('aria-label','Pomoc kontekstowa');b.onclick=showContextHelp;document.body.appendChild(b);
    }
    function closeHelp(){$('#mowHelpOverlay')?.remove()}
    function showContextHelp(){
      closeHelp();const c=contextHelp(),o=document.createElement('div');o.id='mowHelpOverlay';o.innerHTML=`<div id="mowHelpPanel" role="dialog" aria-modal="true"><button class="helpClose" aria-label="Zamknij">×</button><h2>${esc(c.title)}</h2><p>${c.text}</p><p><small>Zamknij przyciskiem × lub klawiszem Esc.</small></p></div>`;document.body.appendChild(o);o.querySelector('.helpClose').onclick=closeHelp;o.onclick=e=>{if(e.target===o)closeHelp()};
    }
    function contextHelp(){
      const main=$('main'),h1=main?.querySelector('h1')?.textContent?.trim()||'';
      if(main?.querySelector('#l'))return{title:'Logowanie',text:'Wpisz swój adres e-mail, wybierz „Wyślij link logowania”, a następnie otwórz wiadomość i kliknij otrzymany link.'};
      if(h1==='Pierwsze uruchomienie')return{title:'Twój profil',text:'Uzupełnij imię i nazwisko, funkcję, miejsce pracy i ewentualnie grupę. Zapisz profil, aby przejść dalej.'};
      if(h1==='Nowy materiał')return{title:'Nowy materiał',text:'Uzupełnij opis wydarzenia, dodaj zdjęcia, wybierz sposób redakcji, wskaż status wizerunku, sprawdź potwierdzenia i wyślij materiał.'};
      if(h1==='Moje materiały')return{title:'Moje materiały',text:'Tutaj sprawdzasz status swoich zgłoszeń. Otwórz materiał, aby zobaczyć szczegóły albo zaakceptować wersję redakcyjną.'};
      if($('#ok')||/Czeka na autora/i.test(main?.innerText||''))return{title:'Akceptacja tekstu',text:'Przeczytaj wersję redakcyjną. Zaakceptuj ją albo poproś o poprawkę i krótko opisz potrzebną zmianę.'};
      if(h1==='Materiały do fanpage’a MOW')return{title:'Ekran startowy',text:'Wybierz „+ Nowy materiał”, aby przesłać relację, albo „Moje materiały”, aby sprawdzić wcześniejsze zgłoszenia. Pełna instrukcja znajduje się niżej.'};
      return{title:'Pomoc',text:'Sprawdź informacje i status na bieżącym ekranie. Jeśli widzisz przycisk działania, wykonaj wskazany krok. Pełną instrukcję znajdziesz na ekranie Start.'};
    }

  } catch(e) {
    console.error(e);
    document.body.innerHTML=`<main style="font-family:system-ui;max-width:760px;margin:40px auto;padding:20px"><h1>MOW Fanpage</h1><p>Nie udało się uruchomić aplikacji.</p><pre style="white-space:pre-wrap;background:#f3f4f6;padding:12px;border-radius:8px">${String(e?.message||e).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre><p>Odśwież stronę. Jeżeli komunikat się powtórzy, przekaż jego treść administratorowi.</p></main>`;
  }
}
