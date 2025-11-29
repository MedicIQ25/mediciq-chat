// ===============================================================
// medicIQ – App Logic (Updated: Trauma & Syntax Fix)
// ===============================================================

const API_CASE_NEW  = '/.netlify/functions/case-new';
const API_CASE_STEP = '/.netlify/functions/case-step';

// UI
const statusEl  = document.getElementById('caseStatus');
const scoreEl   = document.getElementById('caseScore');
const hintCard  = document.getElementById('hintCard');
const hintText  = document.getElementById('hintText');
const panel     = document.getElementById('panel');
const queueList = document.getElementById('queueList');
const chatLog   = document.getElementById('chatLog');

// Controls
const specRow   = document.getElementById('specRow');
const startBtn  = document.getElementById('startCase');
const finishBtn = document.getElementById('finishCase');
const runBtn    = document.getElementById('btnRunQueue');
const clearBtn  = document.getElementById('btnClearQueue');
const roleSel   = document.getElementById('roleSel');
const specButtons = Array.from(document.querySelectorAll('.spec-chip'));
let selectedSpec  = 'internistisch';

// State
let caseState = null;
const queue = [];
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

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  renderPanel('X');
  updateUI(false); 
});

// Spec Selection
specButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    if(caseState) return; 
    specButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedSpec = btn.dataset.spec || 'internistisch';
  });
});

// Tools
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

// Tabs
const tabs = Array.from(document.querySelectorAll('.tab'));
tabs.forEach(t => t.addEventListener('click', () => {
  tabs.forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  renderPanel(t.dataset.tab);
}));

// Global NA
document.getElementById('btnGlobalNA')?.addEventListener('click', openNA);

// ------- Actions Panel (Updated E for Trauma) -------
const ACTIONS = {
  X: [
    { label: 'Kein bedrohlicher Blutverlust', token: 'X unauffällig' },
    { label: 'Druckverband', token: 'Druckverband' },
    { label: 'Hämostyptikum', token: 'Hämostyptikum' },
    { label: 'Tourniquet', token: 'Tourniquet' },
    { label: 'Beckenschlinge', token: 'Beckenschlinge' }
  ],
  A: [
    { label: 'Esmarch-Handgriff', token: 'Esmarch' },
    { label: 'Absaugen', token: 'Absaugen' },
    { label: 'Mundraumkontrolle', token: 'Mundraumkontrolle' },
    { label: 'Guedel-Tubus', token: 'Guedel' },
    { label: 'Wendel-Tubus', token: 'Wendel' },
    { label: 'Beutel-Masken-Beatmung', token: 'Beutel-Masken-Beatmung' }
  ],
  B: [
    { label: 'AF messen (zählen)', token: 'AF messen' },
    { label: 'SpO₂ messen', token: 'SpO2 messen' },
    { label: 'Lunge auskultieren', token: 'Lunge auskultieren' },
    { label: 'Sauerstoff geben', special: 'O2' }
  ],
  C: [
    { label: 'RR messen', token: 'RR messen' },
    { label: 'Puls messen', token: 'Puls messen' },
    { label: 'pDMS prüfen', token: 'pDMS Kontrolle' }, // <--- NEU HIER
    { label: '12-Kanal-EKG', token: '12-Kanal-EKG' },
    { label: 'i.V. Zugang legen', token: 'i.V. Zugang legen' },
    { label: 'Volumen 500 ml', token: 'Volumen 500 ml' }
  ],
  D: [
    { label: 'GCS erheben', token: 'GCS erheben' },
    { label: 'Pupillen prüfen', token: 'Pupillen' },
    { label: 'BZ messen', token: 'BZ messen' }
  ],
  E: [
    { label: 'Bodycheck (Text)', token: 'Bodycheck' },
    { label: 'Bodycheck (Bild)', special: 'BODYMAP' },
    { label: 'pDMS prüfen', token: 'pDMS Kontrolle' }, // <--- UND HIER AUCH SINNVOLL
    { label: 'Immobilisation / Schienung', special: 'IMMO' },
    { label: 'Wärmeerhalt', token: 'Wärmeerhalt' },
    { label: 'Temp messen', token: 'Temperatur messen' },
    { label: 'Oberkörper hoch', token: 'Oberkörper hoch lagern' }
  ]
};

function renderPanel(k) {
  panel.innerHTML = '';
  (ACTIONS[k]||[]).forEach(a => {
    const b = document.createElement('button');
    b.className = 'action-card';
    b.textContent = a.label;
    b.onclick = () => {
      if(a.special === 'O2') openOxygen();
      else if(a.special === 'NA') openNA();
      else if(a.special === 'IMMO') openImmo(); // NEU
      else if(a.special === 'BODYMAP') openBodyMap(); // NEU
      else { queue.push(a); renderQueue(); }
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

// ------- CORE LOGIC -------

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
  }
}

async function startCase() {
  chatLog.innerHTML = '';
  queue.length = 0;
  renderQueue();
  for(let k in visibleVitals) delete visibleVitals[k];
  renderVitals();
  
  updateUI(true); 
  
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
  } catch(e) {
    caseState = { id:'local', specialty:selectedSpec, steps_done:[], history:[], score:0, vitals:{} };
    addMsg(`⚠️ Offline/Fehler: ${e.message}. Lokaler Modus aktiv.`);
    setStatus('Lokal Aktiv');
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
    
    // Updates
    if(d.updated_vitals) {
      Object.assign(visibleVitals, d.updated_vitals);
      renderVitals();
    }
    
    let meta = [];
    if(d.accepted) meta.push('✓');
    if(d.outside_scope) meta.push('?');
    if(d.unsafe) meta.push('⛔');
    
    addMsg(`
      <div><strong>${txt}</strong> <small>${meta.join(' ')}</small></div>
      ${d.evaluation ? `<div>${d.evaluation.replace(/\n/g,'<br>')}</div>` : ''}
      ${d.finding ? `<div style="color:#0f766e; margin-top:4px;">${d.finding.replace(/\n/g,'<br>')}</div>` : ''}
      ${d.next_hint ? `<div class="small muted" style="margin-top:6px;">💡 ${d.next_hint}</div>` : ''}
    `);

    caseState = d.case_state || caseState;
    setScore(caseState.score||0);
    renderProgress(caseState.steps_done||[]);
    
    if(d.done) {
      openDebrief();
      caseState = null;
      updateUI(false); 
      setStatus('Fall beendet.');
    }
  } catch(e) {
    addMsg(`Fehler: ${e.message}`);
  }
}

// ------- Helpers -------
function setStatus(t) { statusEl.textContent = t; }
function setScore(n) { scoreEl.textContent = `Score: ${n}`; }
function renderVitals() {
  for(let k in vitalsMap) vitalsMap[k].innerHTML = visibleVitals[k] || '–';
}
function renderProgress(doneList) {
  const s = new Set((doneList||[]).map(x=>x[0]));
  ['X','A','B','C','D','E'].forEach(l => {
    const el = Array.from(document.querySelectorAll('.chip')).find(c => c.dataset.step === l);
    if(el) {
      el.classList.toggle('done', s.has(l));
      el.classList.remove('active');
    }
  });
  const next = ['X','A','B','C','D','E'].find(l => !s.has(l));
  if(next) {
    const el = Array.from(document.querySelectorAll('.chip')).find(c => c.dataset.step === next);
    if(el) el.classList.add('active');
  }
}
function showHint(t) {
  hintText.textContent = t;
  hintCard.classList.remove('hidden');
}
function addMsg(h) {
  const d = document.createElement('div');
  d.className = 'msg';
  d.innerHTML = h;
  chatLog.appendChild(d);
  d.scrollIntoView({block:'end', behavior:'smooth'});
}

// ------- Modals (Safe Handling) -------
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

// Handlers
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
finishBtn.onclick = async () => {
  if(caseState) {
    await openDebrief();
    stepCase('Fall beenden');
  }
};

// Specific Modal Logic
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

// NEU: Trauma Funktionen
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
  
  // Reset Colors
  ['body_head','body_torso','body_arm_r','body_arm_l','body_leg_r','body_leg_l'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.setAttribute('fill', '#e2e8f0');
  });

  // Verletzungsort aus caseState holen
  const loc = caseState.hidden?.injury_map || []; 
  
  loc.forEach(l => {
     const el = document.getElementById(`body_${l}`);
     if(el) el.setAttribute('fill', '#f87171'); // Rot
  });

  const txt = caseState.hidden?.injuries?.join(', ') || "Keine sichtbaren Außenverletzungen.";
  $id('bodyMapText').textContent = txt;

  $id('bodyMapClose').onclick = () => closeModal('modalBodyMap');
  openModal('modalBodyMap');
  
  stepCase('Bodycheck (visuell)');
}

async function openDebrief() {
  try {
    const r = await fetch(API_CASE_STEP, {method:'POST',body:JSON.stringify({case_state:caseState, user_action:'Debriefing'})});
    const d = await r.json();
    addMsg(`<strong>Debriefing</strong><br>${d.debrief.replace(/\n/g,'<br>')}`);
  } catch(e){}
}
// Klammerfehler behoben (Hier war vorher eine zu viel)