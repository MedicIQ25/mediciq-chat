// ===============================================================
// medicIQ – App Logic (Fixed: Crash Prevention & Layout)
// ===============================================================

const API_CASE_NEW  = '/.netlify/functions/case-new';
const API_CASE_STEP = '/.netlify/functions/case-step';

// UI Elements
const statusEl  = document.getElementById('caseStatus');
const scoreEl   = document.getElementById('caseScore');
const hintCard  = document.getElementById('hintCard');
const hintText  = document.getElementById('hintText');
const panel     = document.getElementById('panel');
const queueList = document.getElementById('queueList');
const chatLog   = document.getElementById('chatLog');
const timerEl   = document.getElementById('missionTimer');

// Controls
const specRow   = document.getElementById('specRow');
const startBtn  = document.getElementById('startCase');
const finishBtn = document.getElementById('finishCase');
const runBtn    = document.getElementById('btnRunQueue');
const clearBtn  = document.getElementById('btnClearQueue');
const roleSel   = document.getElementById('roleSel');
const specButtons = Array.from(document.querySelectorAll('.spec-chip'));
let selectedSpec  = 'internistisch';

// Settings
let soundEnabled = false; 
let isDarkMode = false;
let availableVoices = [];

window.speechSynthesis.onvoiceschanged = () => {
    availableVoices = window.speechSynthesis.getVoices();
};

// State
let caseState = null;
const queue = [];
let timerInterval = null;
let startTime = null;
let lastTickTime = 0; 

const visibleVitals = {};
const vitalsMap = {
  RR:   document.getElementById('vRR'),
  SpO2: document.getElementById('vSpO2'),
  AF:   document.getElementById('vAF'),
  Puls: document.getElementById('vPuls'),
  BZ:   document.getElementById('vBZ'),
  Temp: document.getElementById('vTemp'),
  GCS:  document.getElementById('vGCS')
};

document.addEventListener('DOMContentLoaded', () => {
  renderPanel('X');
  updateUI(false); 
});

// === Features ===
document.getElementById('btnSound')?.addEventListener('click', (e) => {
    soundEnabled = !soundEnabled;
    e.target.textContent = soundEnabled ? "🔊 An" : "🔇 Aus";
    if(availableVoices.length === 0) availableVoices = window.speechSynthesis.getVoices();
});

document.getElementById('btnDark')?.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode', isDarkMode);
});

document.getElementById('btnPrint')?.addEventListener('click', () => window.print());

function speak(text) {
    if(!soundEnabled || !window.speechSynthesis || !text) return;
    if(text.length > 300) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE';
    let bestVoice = availableVoices.find(v => v.lang === 'de-DE' && v.name.includes('Google'));
    if (!bestVoice) bestVoice = availableVoices.find(v => v.lang === 'de-DE' && v.name.includes('Natural'));
    if (!bestVoice) bestVoice = availableVoices.find(v => v.lang === 'de-DE');
    if (bestVoice) { u.voice = bestVoice; u.pitch = 1.0; u.rate = 1.1; }
    window.speechSynthesis.speak(u);
}

specButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    if(caseState) return; 
    specButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedSpec = btn.dataset.spec || 'internistisch';
  });
});

document.querySelectorAll('.schema-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const t = btn.dataset.tool;
    if(t==='AF_COUNTER') openAFCounter();
    if(t==='NRS') openNRS();
    if(t==='BEFAST') openBEFAST();
    if(t==='SAMPLER') openSampler();
    if(t==='FOUR_S') openFourS();
    if(t==='DIAGNOSIS') openDiagnosis();
    if(t==='DEBRIEF') openDebrief();
  });
});

const tabs = Array.from(document.querySelectorAll('.tab'));
tabs.forEach(t => t.addEventListener('click', () => {
  tabs.forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  renderPanel(t.dataset.tab);
}));

document.getElementById('btnGlobalNA')?.addEventListener('click', openNA);

const ACTIONS = {
  X: [ { label: 'Nach krit. Blutungen suchen', token: 'Blutungscheck' }, { label: 'Keine Blutung feststellbar', token: 'X unauffällig' }, { label: 'Druckverband anlegen', token: 'Druckverband' }, { label: 'Tourniquet anlegen', token: 'Tourniquet' }, { label: 'Beckenschlinge anlegen', token: 'Beckenschlinge' }, { label: 'Woundpacking', token: 'Hämostyptikum' } ],
  A: [ { label: 'Esmarch-Handgriff', token: 'Esmarch' }, { label: 'Absaugen', token: 'Absaugen' }, { label: 'Mundraumkontrolle', token: 'Mundraumkontrolle' }, { label: 'Guedel-Tubus', token: 'Guedel' }, { label: 'Wendel-Tubus', token: 'Wendel' }, { label: 'Beutel-Masken-Beatmung', token: 'Beutel-Masken-Beatmung' } ],
  B: [ { label: 'AF messen (zählen)', token: 'AF messen' }, { label: 'SpO₂ messen', token: 'SpO2 messen' }, { label: 'Lunge auskultieren', token: 'Lunge auskultieren' }, { label: 'Sauerstoff geben', special: 'O2' } ],
  C: [ { label: 'RR messen', token: 'RR messen' }, { label: 'Puls messen', token: 'Puls messen' }, { label: 'pDMS prüfen', token: 'pDMS Kontrolle' }, { label: '12-Kanal-EKG', special: 'EKG' }, { label: 'i.V. Zugang legen', token: 'i.V. Zugang legen' }, { label: 'Volumen 500 ml', token: 'Volumen 500 ml' } ],
  D: [ { label: 'GCS erheben', token: 'GCS erheben' }, { label: 'Pupillen prüfen', token: 'Pupillen' }, { label: 'BZ messen', token: 'BZ messen' } ],
  E: [ { label: 'Bodycheck (Text)', token: 'Bodycheck' }, { label: 'Bodycheck (Bild)', special: 'BODYMAP' }, { label: 'pDMS prüfen', token: 'pDMS Kontrolle' }, { label: 'Immobilisation / Schienung', special: 'IMMO' }, { label: 'Wärmeerhalt', token: 'Wärmeerhalt' }, { label: 'Temp messen', token: 'Temperatur messen' }, { label: 'Oberkörper hoch', token: 'Oberkörper hoch lagern' } ]
};

function renderPanel(k) {
  panel.innerHTML = '';
  (ACTIONS[k]||[]).forEach(a => {
    const b = document.createElement('button');
    b.className = 'action-card';
    b.textContent = a.label;
    b.onclick = () => {
      if(a.special === 'O2') openOxygen(); else if(a.special === 'NA') openNA(); else if(a.special === 'IMMO') openImmo(); else if(a.special === 'BODYMAP') openBodyMap(); else if(a.special === 'EKG') openEKG(); else { queue.push(a); renderQueue(); }
    };
    panel.appendChild(b);
  });
}

function renderQueue() {
  queueList.innerHTML = '';
  queue.forEach((it, i) => {
    const li = document.createElement('li');
    li.className = 'queue-item';
    li.innerHTML = `<span>${it.label}</span><button class="btn secondary small">x</button>`;
    li.querySelector('button').onclick = () => { queue.splice(i,1); renderQueue(); };
    queueList.appendChild(li);
  });
}

function renderVitals() {
  for(let k in vitalsMap) {
    const el = vitalsMap[k];
    const valStr = visibleVitals[k] || '--';
    el.innerHTML = valStr;
    const box = el.parentElement; 
    if(box) {
        box.classList.remove('critical');
        const valNum = parseFloat(valStr.match(/\d+/)?.[0] || 0);
        if (k === 'SpO2' && valNum > 0 && valNum < 90) box.classList.add('critical');
        if (k === 'RR' && valNum > 0 && valNum < 90) box.classList.add('critical'); 
        if (k === 'Puls' && valNum > 0 && (valNum < 40 || valNum > 140)) box.classList.add('critical');
        if (k === 'BZ' && valNum > 0 && valNum < 60) box.classList.add('critical');
    }
  }
}

function startTimer() {
  startTime = Date.now();
  lastTickTime = Date.now(); 
  timerEl.classList.remove('hidden');
  timerEl.textContent = "00:00";
  if(timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const now = Date.now();
    const diff = Math.floor((now - startTime) / 1000);
    const m = Math.floor(diff / 60).toString().padStart(2,'0');
    const s = (diff % 60).toString().padStart(2,'0');
    timerEl.textContent = `${m}:${s}`;
    if (now - lastTickTime >= 30000) { 
        lastTickTime = now;
        if(caseState && !caseState.measurements?.handover_done) { stepCase('System-Check: 30s vergangen'); }
    }
  }, 1000);
}

function stopTimer() {
  if(timerInterval) clearInterval(timerInterval);
}

function updateUI(running) {
  if (running) {
    specRow.classList.add('hidden');
    startBtn.classList.add('hidden');
    finishBtn.classList.remove('hidden');
    roleSel.disabled = true;
  } else {
    specRow.classList.remove('hidden');
    startBtn.classList.remove('hidden');
    finishBtn.classList.add('hidden');
    roleSel.disabled = false;
    startBtn.disabled = false;
    timerEl.classList.add('hidden'); 
  }
}

async function startCase() {
  chatLog.innerHTML = '';
  queue.length = 0;
  renderQueue();
  for(let k in visibleVitals) delete visibleVitals[k];
  renderVitals(); 
  
  updateUI(true); 
  startTimer(); 
  
  const chips = Array.from(document.querySelectorAll('.chip'));
  chips.forEach(c => c.classList.remove('done','active'));
  setStatus('Lade Fall...');
  hintCard.classList.add('hidden');
  startBtn.disabled = true;

  try {
    const r = await fetch(API_CASE_NEW, {
      method:'POST',
      body: JSON.stringify({ specialty: selectedSpec, role: roleSel.value })
    });
    if(!r.ok) throw new Error(r.statusText);
    const d = await r.json();
    caseState = d.case || d;
    setStatus(`Aktiv: ${caseState.specialty}`);
    setScore(0);
    renderProgress([]);
    showHint('Beginne mit XABCDE.');
    addMsg(`<strong>Fallstart:</strong> ${caseState.story}`);
    speak(caseState.story); 
  } catch(e) {
    // FIX: Fallback hat jetzt eine Story, damit es nicht crasht
    caseState = { 
        id:'local', 
        specialty:selectedSpec, 
        steps_done:[], 
        history:[], 
        score:0, 
        vitals:{}, 
        story: "Offline-Modus: Simulierter Fall ohne Server-Verbindung. Vitals manuell prüfen." 
    };
    addMsg(`⚠️ Offline/Fehler: ${e.message}. Lokaler Modus aktiv.`);
    setStatus('Lokal Aktiv');
    speak(caseState.story);
  } finally {
    startBtn.disabled = false;
  }
}

async function stepCase(txt) {
  if(!caseState) return;
  
  try {
    const r = await fetch(API_CASE_STEP, {
      method:'POST',
      body: JSON.stringify({ case_state: caseState, user_action: txt })
    });
    const d = await r.json();
    
    if(d.updated_vitals) {
      Object.assign(visibleVitals, d.updated_vitals);
      renderVitals(); 
    }
    
    const isSystemTick = txt.includes('System-Check');
    const hasFinding = !!d.finding;

    if (!isSystemTick || (isSystemTick && hasFinding)) {
        let meta = [];
        if(d.accepted && !isSystemTick) meta.push('✓');
        if(d.unsafe) meta.push('⛔');
        
        let displayTxt = txt;
        if(isSystemTick) displayTxt = "⏱️ <i>Zeit vergeht...</i>";

        addMsg(`
          <div><strong>${displayTxt}</strong> <small>${meta.join(' ')}</small></div>
          ${d.evaluation ? `<div>${d.evaluation.replace(/\n/g,'<br>')}</div>` : ''}
          ${d.finding ? `<div style="color:#b91c1c; margin-top:4px;">${d.finding.replace(/\n/g,'<br>')}</div>` : ''}
          ${d.next_hint ? `<div class="small muted" style="margin-top:6px;">💡 ${d.next_hint}</div>` : ''}
        `);
        
        if(d.finding && !isSystemTick) speak(d.finding);
    }

    caseState = d.case_state || caseState;
    setScore(caseState.score||0);
    renderProgress(caseState.steps_done||[]);
    
    if(d.done) {
      openDebrief();
      caseState = null;
      updateUI(false); 
      stopTimer();
      setStatus('Fall beendet.');
    }
  } catch(e) {
    addMsg(`Fehler: ${e.message}`);
  }
}

// ------- Helpers & Modals -------
const $id = (id) => document.getElementById(id);
const backdrop = $id('modalBackdrop');

function openModal(id) { 
  const el = $id(id);
  if(!el) return;
  backdrop.style.display = 'block';
  el.style.display = 'block';
}
function closeModal(id) { 
  const el = $id(id);
  if(!el) return;
  backdrop.style.display = 'none';
  el.style.display = 'none';
}

runBtn.onclick = async () => {
  if(!caseState) return;
  while(queue.length) {
    const it = queue.shift();
    renderQueue();
    await stepCase(it.token);
    await new Promise(r=>setTimeout(r,500));
  }
};
clearBtn.onclick = () => { queue.length=0; renderQueue(); };
startBtn.onclick = startCase;
finishBtn.onclick = () => { openHandover(); };

function openOxygen() {
  if(!caseState) return;
  const s = $id('o2Flow'), v = $id('o2FlowVal');
  s.value=0; v.textContent='0';
  s.oninput=()=>v.textContent=s.value;
  $id('o2Ok').onclick = () => { stepCase(`O2-Gabe: ${$id('o2Device').value} mit ${s.value} l/min`); closeModal('modalO2'); };
  $id('o2Cancel').onclick = () => closeModal('modalO2');
  openModal('modalO2');
}
function openNA() {
  if(!caseState) return;
  $id('naReason').value='';
  $id('naOk').onclick=()=>{ stepCase(`Notarzt nachfordern: ${$id('naReason').value}`); closeModal('modalNA'); };
  $id('naCancel').onclick=()=>closeModal('modalNA');
  openModal('modalNA');
}
function openAFCounter() { if(caseState) stepCase('AF messen'); }
function openNRS() {
  const r=$id('nrsRange'), v=$id('nrsVal'); r.value=0; v.textContent='0';
  r.oninput=()=>v.textContent=r.value;
  $id('nrsFetch').onclick = async () => {
    const res = await fetch(API_CASE_STEP, {method:'POST', body:JSON.stringify({case_state:caseState, user_action:'Schmerz Info'})});
    const d = await res.json();
    $id('nrsInfo').textContent = d.finding;
    speak(d.finding);
  };
  $id('nrsOk').onclick=()=>{ stepCase(`NRS ${r.value}`); closeModal('modalNRS'); };
  $id('nrsCancel').onclick=()=>closeModal('modalNRS');
  openModal('modalNRS');
}
function openBEFAST() {
  $id('befastFetch').onclick=async()=>{
    const res = await fetch(API_CASE_STEP, {method:'POST', body:JSON.stringify({case_state:caseState, user_action:'BEFAST Info'})});
    const d = await res.json();
    $id('befastInfo').textContent = d.finding;
    speak(d.finding);
  };
  $id('befastOk').onclick=()=>{ stepCase('BEFAST dokumentiert'); closeModal('modalBEFAST'); };
  $id('befastCancel').onclick=()=>closeModal('modalBEFAST');
  openModal('modalBEFAST');
}
function openSampler() {
  $id('samplerFetch').onclick=async()=>{
    await stepCase('SAMPLER Info');
    const S = caseState?.anamnesis?.SAMPLER || {};
    if($id('s_sympt')) $id('s_sympt').value = S.S||'';
    if($id('s_allerg')) $id('s_allerg').value = S.A||'';
    if($id('s_med')) $id('s_med').value = S.M||'';
    if($id('s_hist')) $id('s_hist').value = S.P||'';
    if($id('s_last')) $id('s_last').value = S.L||'';
    if($id('s_events')) $id('s_events').value = S.E||'';
    if($id('s_risk')) $id('s_risk').value = S.R||'';
  };
  $id('samplerOk').onclick=()=>{ stepCase('SAMPLER doku'); closeModal('modalSampler'); };
  $id('samplerCancel').onclick=()=>closeModal('modalSampler');
  openModal('modalSampler');
}
function openFourS() {
  $id('s4Fetch').onclick=async()=>{
    const res = await fetch(API_CASE_STEP, {method:'POST', body:JSON.stringify({case_state:caseState, user_action:'4S Info'})});
    const d = await res.json();
    $id('s4Info').textContent = d.finding;
    speak(d.finding);
  };
  $id('s4Ok').onclick=()=>{ stepCase('4S dokumentiert'); closeModal('modal4S'); };
  $id('s4Cancel').onclick=()=>closeModal('modal4S');
  openModal('modal4S');
}
function openDiagnosis() {
  const dxSel = $id('dxSelect');
  const list = ['ACS','Asthma/Bronchialobstruktion','COPD-Exazerbation','Lungenembolie','Sepsis','Metabolische Entgleisung','Schlaganfall','Krampfanfall','Hypoglykämie','Polytrauma','Fraktur','Fieberkrampf'];
  dxSel.innerHTML = list.map(x=>`<option>${x}</option>`).join('');
  
  $id('dxOk').onclick=()=>{
    stepCase(`Verdachtsdiagnose: ${dxSel.value} | Prio: ${$id('dxPrio').value}`);
    closeModal('modalDx');
  };
  $id('dxCancel').onclick=()=>closeModal('modalDx');
  openModal('modalDx');
}

function openImmo() {
  if(!caseState) return;
  $id('immoOk').onclick = () => {
    const loc = $id('immoLoc').value;
    const mat = $id('immoMat').value;
    stepCase(`Immobilisation: ${mat} an ${loc}`);
    closeModal('modalImmo');
  };
  $id('immoCancel').onclick = () => closeModal('modalImmo');
  openModal('modalImmo');
}

function openBodyMap() {
  if(!caseState) return;
  ['body_head','body_torso','body_arm_r','body_arm_l','body_leg_r','body_leg_l'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.setAttribute('fill', '#f1f5f9');
  });
  const loc = caseState.hidden?.injury_map || []; 
  loc.forEach(l => {
     const el = document.getElementById(`body_${l}`);
     if(el) el.setAttribute('fill', '#f87171'); 
  });
  
  const txt = caseState.hidden?.injuries?.join(', ') || "Keine sichtbaren Außenverletzungen.";
  $id('bodyMapText').textContent = txt;
  $id('bodyMapClose').onclick = () => closeModal('modalBodyMap');
  openModal('modalBodyMap');
  stepCase('Bodycheck (visuell)');
}

function openEKG() {
    if(!caseState) return;
    const type = caseState.hidden?.ekg_pattern || "sinus";
    const line = $id('ekgLine');
    const txt  = $id('ekgText');
    line.classList.add('ekg-anim');
    let points = "";
    let yBase = 75;
    if(type === "sinus") {
        for(let i=0; i<400; i+=60) {
            points += `${i},${yBase} ${i+10},${yBase} ${i+15},${yBase-10} ${i+20},${yBase+10} ${i+25},${yBase-50} ${i+30},${yBase+20} ${i+35},${yBase} ${i+45},${yBase-5} ${i+50},${yBase} `;
        }
        txt.textContent = "Monitorbild (Ableitung II) - Sinus";
        txt.style.color = "#0f766e";
    } else if (type === "vt") {
        for(let i=0; i<400; i+=30) {
             points += `${i},${yBase} ${i+10},${yBase-60} ${i+20},${yBase+60} ${i+30},${yBase} `;
        }
        txt.textContent = "Monitorbild - VT (Puls prüfen!)";
        txt.style.color = "#ef4444";
    } else {
        points = `0,${yBase} 400,${yBase}`;
        txt.textContent = "Monitorbild - Asystolie";
        txt.style.color = "#ef4444";
    }
    line.setAttribute('points', points);
    $id('ekgClose').onclick = () => closeModal('modalEKG');
    openModal('modalEKG');
    stepCase('12-Kanal-EKG');
}

function openHandover() {
    if(!caseState) return;
    $id('s_ident').value = "";
    $id('s_event').value = "";
    $id('s_prio').value = "";
    $id('s_action').value = "";
    $id('s_anam').value = "";
    
    $id('handoverOk').onclick = () => {
        const text = `SINNHAFT: I:${$id('s_ident').value} | N:${$id('s_event').value} | N:${$id('s_prio').value} | H:${$id('s_action').value} | A:${$id('s_anam').value}`;
        stepCase(`Übergabe: ${text}`);
        setTimeout(() => stepCase('Fall beenden'), 800);
        closeModal('modalHandover');
    };
    $id('handoverCancel').onclick = () => closeModal('modalHandover');
    openModal('modalHandover');
}

async function openDebrief() {
  try {
    const r = await fetch(API_CASE_STEP, {method:'POST',body:JSON.stringify({case_state:caseState, user_action:'Debriefing'})});
    const d = await r.json();
    addMsg(`<strong>Debriefing</strong><br>${d.debrief.replace(/\n/g,'<br>')}`);
    speak("Fall beendet. Hier ist dein Debriefing.");
  } catch(e){}
}