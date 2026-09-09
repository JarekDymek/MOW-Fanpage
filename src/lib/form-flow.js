export function attachFlow(form,getPhotos,isPreparing){
  const sections=[...form.querySelectorAll(':scope > section.card')];
  const names=['Wydarzenie','Zdjęcia','Sposób redakcji','Wizerunek','Potwierdzenia'];
  const guide=document.createElement('section');guide.className='flow-guide';
  guide.innerHTML='<h2>Twój materiał krok po kroku</h2><p id="flowHint" role="status"></p><div class="flow-steps">'+names.map((name,i)=>`<button type="button" data-step="${i}"><span>${i+1}. ${name}</span><small></small></button>`).join('')+'</div><button type="button" id="nextStep">Przejdź do następnego kroku ↓</button>';
  form.prepend(guide);form.noValidate=true;
  sections.forEach((s,i)=>{s.id=`step-${i}`;s.tabIndex=-1;});
  let next=0,ready=[];
  function go(i,focusField=false){
    const s=sections[i];s.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
    const target=focusField?s.querySelector(':invalid'):null;(target||s).focus({preventScroll:true});
  }
  guide.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>go(+b.dataset.step));
  sections.forEach((s,i)=>{const b=document.createElement('button');b.type='button';b.className='section-next';b.textContent=i<4?'Dalej: '+names[i+1]+' ↓':'Przejdź do wysyłania ↓';b.onclick=()=>{update();if(!ready[i])return go(i,true);if(i<4)go(i+1);else form.querySelector('.primary.big').focus();};s.append(b);});
  guide.querySelector('#nextStep').onclick=()=>next<0?form.querySelector('.primary.big').focus():go(next,true);
  function update(){
    ready=sections.map((s,i)=>i===1?getPhotos()>0&&!isPreparing():[...s.querySelectorAll('[required]')].every(el=>el.disabled||el.validity.valid&&(!['text','textarea'].includes(el.type)||el.value.trim())));
    next=ready.indexOf(false);
    sections.forEach((s,i)=>{s.classList.toggle('step-next',i===next);s.classList.toggle('step-complete',ready[i]);});
    guide.querySelectorAll('[data-step]').forEach((b,i)=>{b.classList.toggle('step-next',i===next);b.classList.toggle('step-complete',ready[i]);b.querySelector('small').textContent=ready[i]?'✓ Gotowe':i===next?'→ Uzupełnij teraz':'Do uzupełnienia';if(i===next)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
    guide.querySelector('#flowHint').textContent=next<0?'Wszystko gotowe. Możesz wysłać materiał.':`Następny krok: ${next+1}. ${names[next]}.`;
    guide.querySelector('#nextStep').textContent=next<0?'Przejdź do wysyłania ↓':'Przejdź do następnego kroku ↓';
    form.querySelectorAll('[required]').forEach(el=>{const bad=!el.disabled&&(!el.validity.valid||['text','textarea'].includes(el.type)&&!el.value.trim());el.classList.toggle('field-missing',bad);el.setAttribute('aria-invalid',String(bad));});
    return next<0;
  }
  form.addEventListener('input',update);form.addEventListener('change',update);update();
  return {update,validate(){if(update())return true;go(next,true);return false;}};
}
