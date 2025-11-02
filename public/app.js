// ===============================================================
// medicIQ – App Frontend (app.js)
// Chat, Fallbeispiele, XABCDE-Fortschritt & Hinweisfeld
// ===============================================================

const API_CHAT      = '/.netlify/functions/chat';
const API_CASE_NEW  = '/.netlify/functions/case-new';
const API_CASE_STEP = '/.netlify/functions/case-step';

// UI-Refs
const box       = document.getElementById('chat-box');
const send      = document.getElementById('send');
const msg       = document.getElementById('msg');
const startBtn  = document.getElementById('startCase');
const finishBtn = document.getElementById('finishCase');
const statusEl  = document.getElementById('caseStatus');
const scoreEl   = document.getElementById('caseScore');
const chips     = Array.from(document.querySelectorAll('.chip'));
const hintCard  = document.getElementById('hintCard');
const hintText  = document.getElementById('hintText');

// Vitals
const vitalsMap = {
  RR:   document.getElementById('vRR'),
  SpO2: document.getElementById('vSpO2'),
  AF:   document.getElementById('vAF'),
  Puls: document.getElementById('vPuls'),
  BZ:   document.getElementById('vBZ'),
  Temp: document.getElementById('vTemp'),
  GCS:  document.getElementById('vGCS')
};

let caseState = null;

// ---------------- UI Helpers ----------------
function addMsg(text, role='ai'){
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  el.innerHTML = window.marked ? marked.parse(text) : text;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

function renderVitals(v){
  v = v || {};
  for(const [k, el] of Object.entries(vitalsMap)){
    el.textContent = (v[k] === undefined || v[k] === null) ? '–' : v[k];
  }
}

function setStatus(t){ statusEl.textContent = t; }
function setScore(n){ scoreEl.textContent = `Score: ${n ?? 0}`; }

function resetProgress(){
  chips.forEach(c => c.classList.remove('done','active'));
}

function renderProgress(stepsDone){
  resetProgress();
  const done = new Set((stepsDone || []).map(s => s.toUpperCase()));
  const order = ['X','A','B','C','D','E'];
  order.forEach(step => {
    const el = chips.find(c => c.dataset.step === step);
    if(!el) return;
    if ([...done].some(s => s.startsWith(step))) el.classList.add('done');
  });
  // aktive Empfehlung: markiere nächsten fehlenden Schritt
  const next = order.find(s => ![...done].some(x => x.startsWith(s)));
  const activeEl = chips.find(c => c.dataset.step === next);
  if (activeEl) activeEl.classList.add('active');
}

function showHint(text){
  if (text && text.trim()){
    hintText.textContent = text;
    hintCard.classList.remove('hidden');
  }else{
    hintText.textContent = '—';
    hintCard.classList.add('hidden');
  }
}

// ---------------- Backend Calls ----------------
async function startCase(){
  startBtn.disabled = true;
  addMsg('_Neuer Fall wird erstellt …_', 'ai');
  try{
    const res = await fetch(API_CASE_NEW, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ specialty:'internistisch', difficulty:'mittel', role:'RS' })
    });
    const data = await res.json();
    caseState = data.case || data;

    renderVitals(caseState?.current_vitals || caseState?.hidden?.vitals_baseline || {});
    setStatus(`Fall aktiv: ${caseState?.patient?.name || 'Patient/in'}`);
    setScore(caseState?.score ?? 0);
    renderProgress(caseState?.steps_done || []);
    showHint('Starte mit **X**: Lebensbedrohliche Blutungen ausschließen/stoppen.');

    addMsg(`**Fallstart**: ${caseState?.story || 'Beschwerdebild nicht definiert.'}\n\n_Arbeite strukturiert nach **XABCDE**._`, 'ai');
  }catch(e){
    console.error(e);
    addMsg('⚠️ Konnte keinen Fall starten.', 'ai');
  }finally{
    startBtn.disabled = false;
  }
}

async function stepCase(userText){
  if(!caseState) return;
  try{
    const res = await fetch(API_CASE_STEP, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        case_state: caseState,
        user_action: userText,
        role: caseState.role || 'RS'
      })
    });
    const data = await res.json();

    if (data.result_text) addMsg(data.result_text, 'ai');
    if (data.updated_vitals) renderVitals(data.updated_vitals);

    caseState = data.case_state || caseState;
    setScore(caseState?.score ?? 0);
    renderProgress(caseState?.steps_done || []);

    // next_hint vom Backend nutzen
    showHint(data.next_hint || '');

    if (data.done){
      setStatus('Fall abgeschlossen.');
      if (data.found) addMsg(data.found, 'ai');
      showHint('—');
      resetProgress();
      caseState = null;
    }
  }catch(e){
    console.error(e);
    addMsg('⚠️ Schritt konnte nicht verarbeitet werden.', 'ai');
  }
}

async function chatGeneral(userText){
  try{
    const res = await fetch(API_CHAT, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ message: userText })
    });
    const data = await res.json();
    addMsg(data.reply || 'Keine Antwort erhalten.', 'ai');
  }catch(err){
    console.error(err);
    addMsg('⚠️ Fehler bei der Chat-Kommunikation.', 'ai');
  }
}

// ---------------- Events ----------------
async function handleSend(){
  const q = msg.value.trim();
  if(!q) return;
  addMsg(q, 'user');
  msg.value=''; msg.focus(); send.disabled=true;

  try{
    if (caseState) await stepCase(q);
    else           await chatGeneral(q);
  }finally{
    send.disabled=false;
  }
}

send.addEventListener('click', handleSend);
msg.addEventListener('keydown', (e)=>{ if(e.key==='Enter') handleSend(); });

startBtn.addEventListener('click', startCase);
finishBtn.addEventListener('click', ()=>{ if(caseState) stepCase('Fall beenden'); });

// ---------------- Init ----------------
renderVitals({});
setStatus('Kein Fall aktiv.');
setScore(0);
resetProgress();
showHint('—');
addMsg('👋 Willkommen bei **medicIQ Fallbeispiele**!\n\nStarte einen Fall oder stelle eine medizinische Frage.', 'ai');
