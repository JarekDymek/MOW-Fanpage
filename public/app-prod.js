(async function(){
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');

    const SUPABASE_URL='https://tuxtnlqtakhtvdesbmow.supabase.co';
    const SUPABASE_KEY='sb_publishable_d2cI7gwgLZE2OCzw8wr82Q_Zh0pDBqf';
    const S=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const ENTRY=location.pathname.startsWith('/admin')?'admin':'employee';
    const WORKER=ENTRY==='employee';
    const SHARE_BATCH_SIZE=10;
    const st={user:null,profile:null,photos:[],install:null,shareFiles:[],shareOffset:0};
    const $=(q,r=document)=>r.querySelector(q);
    const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const labels={draft:'Szkic',submitted:'Nowe',editing:'Do redakcji',awaiting_author:'Czeka na autora',changes_requested:'Do poprawki',approved:'Zaakceptowane',published:'Opublikowane',rejected:'Wstrzymane'};

    injectHelpStyles();
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();st.install=e;render()});
    if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
    document.addEventListener('keydown',e=>{
      if(!WORKER)return;
      if(e.key==='Escape'){closeHelp();return;}
      if(e.key.toLowerCase()!=='p'||e.ctrlKey||e.altKey||e.metaKey)return;
      const t=e.target;
      if(t&&(t.matches?.('input,textarea,select')||t.isContentEditable))return;
      e.preventDefault();showContextHelp();
    });

    await boot();

    async function boot(){
      const {data:{session},error}=await S.auth.getSession();
      if(error) throw error;
      st.user=session?.user||null;
      if(st.user) await loadProfile();
      S.auth.onAuthStateChange(async(_e,s)=>{
        st.user=s?.user||null;st.profile=null;
        if(st.user)await loadProfile();
        render();
      });
      render();
    }

    async function loadProfile(){
      const {data,error}=await S.from('mow_profiles').select('*').eq('id',st.user.id).maybeSingle();
      if(error) throw error;
      st.profile=data||null;
    }

    function shell(body){
      document.body.innerHTML=`<header><div class="brand"><img src="/icons/icon.svg" alt=""><b>MOW Fanpage</b>${ENTRY==='admin'?'<span class="pill">ADMIN</span>':''}</div><nav>${st.user?'<button data-home>Start</button><button data-new>Nowy materiał</button><button data-mine>Moje</button><button data-profile>Profil</button>':''}${st.profile?.role==='moderator'?'<button data-mod>Moderator</button>':''}${st.install?'<button data-install>Zainstaluj</button>':''}${st.user?'<button data-out>Wyloguj</button>':''}</nav></header><main>${body}</main>`;
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
        e.preventDefault();const m=$('.msg'),email=new FormData(e.currentTarget).get('email'),r=`${location.origin}${ENTRY==='admin'?'/admin/':'/wychowawca/'}`;
        m.textContent='Wysyłanie…';
        const{error}=await S.auth.signInWithOtp({email,options:{emailRedirectTo:r,shouldCreateUser:true}});
        m.textContent=error?error.message:'Sprawdź skrzynkę i otwórz link logowania.';
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
        e.preventDefault();const f=new FormData(e.currentTarget),{error}=await S.rpc('mow_create_profile',{p_full_name:f.get('full_name'),p_unit:composeUnit(f)});
        if(error)return $('.msg').textContent=error.message;
        await loadProfile();render();
      };
    }

    function editProfile(){
      const v={full_name:st.profile.full_name,...splitUnit(st.profile.unit)};
      shell(`<section class="hero"><h1>Edytuj profil</h1><p>Uprawnienie moderatora nie podlega edycji.</p></section><section class="card"><form id="ep">${profileFields(v)}<p class="hint">Obecny opis: <b>${esc(st.profile.unit)}</b></p><button class="primary">Zapisz profil</button><p class="msg"></p></form></section>`);
      $('#ep').onsubmit=async e=>{
        e.preventDefault();const f=new FormData(e.currentTarget),m=$('.msg');m.textContent='Zapisywanie…';
        const{error}=await S.rpc('mow_update_profil',{p_full_name:f.get('full_name'),p_unit:composeUnit(f)});
        if(error)return m.textContent=error.message;
        await loadProfile();m.textContent='Profil zapisany.';setTimeout(home,350);
      };
    }

    function workerGuide(){
      return `<section class="card mowGuide"><h2>Instrukcja dla wychowawcy</h2><p>RozwiŅ temat, którego potrzebujesz. W każdej chwili możesz też użyć przycisku <b>P – Pomoc</b>.</p>
      <details><summary>Logowanie i profil</summary><p>Zaloguj się swoim adresem e-mail. Przy pierwszym wejściu wpisz imię i nazwisko, funkcję, miejsce pracy i ewentualnie grupę.</p></details>
      <details><summary>Dodanie materiału</summary><p>Wybierz <b>+ Nowy materiał</b>. Wpisz tytuł, datę, miejsce i tekst opisujący wydarzenie. Uwagi dla moderatora są opcjonalne.</p></details>
      <details><summary>Zdjęcia</summary><p>Dodaj fotografie związane z wydarzeniem i przeznaczone do rozpatrzenia do publikacji. Sprawdź miniatury przed wysłaniem. Maksymalnie piętnaście zdjęc.</p></details>
      <details><summary>Redakcja tekstu</summary><p>Jeżeli chcesz zobaczyć i zaakceptować tekst po redakcji moderatora, wybierz opcję redakcji z akceptacją. Jeżeli tekst ma pozostaŇ w Twoim brmieniu, wybierz oryginał.</p></details>
      <details><summary>Status wizerunku</summary><ul><li><b>Zgody / podstawy sprawdzone</b> –