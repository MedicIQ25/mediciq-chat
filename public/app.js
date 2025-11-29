// ===============================================================
// medicIQ – App Logic
// Updates: Notarzt global (neben Tabs), i.V. Zugang, Fixes
// ===============================================================

const API_CASE_NEW  = '/.netlify/functions/case-new';
const API_CASE_STEP = '/.netlify/functions/case-step';

// ------- UI Referenzen -------
const statusEl  = document.getElementById('caseStatus');
const scoreEl   = document.getElementById('caseScore');
const chips     = Array.from(document.querySelectorAll('.chip'));
const hintCard  = document.getElementById('hintCard');
const hintText  = document.getElementById('hintText');
const tabs      = Array.from(document.querySelectorAll('.tab'));
const panel     = document.getElementById('panel');
const setupRow  = document.querySelector('.setup-row');

const queueList = document.getElementById('queueList');
const runBtn    = document.getElementById('btnRunQueue');
const clearBtn  = document.getElementById('btnClearQueue');
const startBtn  = document.getElementById('startCase');
const finishBtn = document.getElementById('finishCase');
const chatLog   = document.getElementById('chatLog');
const roleSel   = document.getElementById('roleSel');

// Fachrichtung
const specButtons = Array.from(document.querySelectorAll('.spec-chip'));
let selectedSpec  = 'internistisch';
specButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    specButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedSpec = btn.dataset.spec || 'internistisch';
  });
});

// Schema-Buttons
document.querySelectorAll('.schema-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool;
    if (tool === 'AF_COUNTER')   openAFCounter();
    if (tool === 'NRS')          openNRS();
    if (tool === 'BEFAST')       openBEFAST();
    if (tool === 'SAMPLER')      openSampler();
    if (tool === 'FOUR_S')       openFourS();
    if (tool === 'DIAGNOSIS')    openDiagnosis();
    if (tool === 'DEBRIEF')      openDebrief();
  });
});

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
const visibleVitals = {};

// ------- State -------
let caseState = null;
const queue = [];

// ------- Helpers -------
const setStatus = t => statusEl.textContent = t;
const setScore  = n => scoreEl.textContent  = `Score: ${n ?? 0}`;

function renderVitalsFromVisible() {
  for (const el of Object.values(vitalsMap)) el.textContent = '–';
  for (const [k, v] of Object.entries(visibleVitals)) {
    if (v != null && vitalsMap[k]) vitalsMap[k].innerHTML = v;
  }
}

function clearVisibleVitals() {
  for (const k of Object.keys(visibleVitals)) delete visibleVitals[k];
  renderVitalsFromVisible();
}

function addMsg(html) {
  const el = document.createElement('div');
  el.className = 'msg';
  el.innerHTML = html;
  chatLog.appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function showHint(text) {
  if (text && text.trim()) { 
    hintText.textContent = text; 
    hintCard.classList.remove('hidden'); 
  } else { 
    hintText.textContent = '—'; 
    hintCard.classList.add('hidden'); 
  }
}

function resetProgress() { 
  chips.forEach(c => c.classList.remove('done','active')); 
}

function renderProgress(steps = []) {
  resetProgress();
  const done = new Set(steps.map(s => s.toUpperCase()));
  const order = ['X','A','B','C','D','E'];
  order.forEach(step => {
    const el = chips.find(c => c.dataset.step === step);
    if ([...done].some(s => s.startsWith(step))) el.classList.add('done');
  });
  const next = order.find(s => ![...done].some(x => x.startsWith(s)));
  const activeEl = chips.find(c => c.dataset.step === next);
  if (activeEl) activeEl.classList.add('active');
}

// ------- Actions -------
const ACTIONS = {
  X: [
    { label: 'Kein bedrohlicher Blutverlust', token: 'X unauffällig' },
    { label: 'Druckverband',           token: 'Druckverband' },
    { label: 'Hämostyptikum',          token: 'Hämostyptikum' },
    { label: 'Tourniquet',             token: 'Tourniquet' },
    { label: 'Beckenschlinge',         token: 'Beckenschlinge' }
  ],
  A: [
    { label: 'Esmarch-Handgriff',      token: 'Esmarch' },
    { label: 'Absaugen',               token: 'Absaugen' },
    { label: 'Mundraumkontrolle',      token: 'Mundraumkontrolle' },
    { label: 'Guedel-Tubus',           token: 'Guedel' },
    { label: 'Wendel-Tubus',           token: 'Wendel' },
    { label: 'Beutel-Masken-Beatmung', token: 'Beutel-Masken-Beatmung' }
  ],
  B: [
    { label: 'AF messen (zählen)',     token: 'AF messen' },
    { label: 'SpO₂ messen',            token: 'SpO2 messen' },
    { label: 'Lunge auskultieren',     token: 'Lunge auskultieren' },
    { label: 'Sauerstoff geben',       special: 'O2' } 
  ],
  C: [
    { label: 'RR messen',              token: 'RR messen' },
    { label: 'Puls messen',            token: 'Puls messen' },
    { label: '12-Kanal-EKG',           token: '12-Kanal-EKG' },
    { label: 'i.V. Zugang legen',      token: 'i.V. Zugang legen' }, 
    { label: 'Volumen 500 ml',         token: 'Volumen 500 ml' }
    // Notarzt hier entfernt, da jetzt globaler Button
  ],
  D: [
    { label: 'GCS erheben',            token: 'GCS erheben' },
    { label: 'Pupillen prüfen',        token: 'Pupillen' },
    { label: 'BZ messen',              token: 'BZ messen' }
  ],
  E: [
    { label: 'Bodycheck (Ganzkörper)', token: 'Bodycheck' },
    { label: 'Wärmeerhalt',            token: 'Wärmeerhalt' },
    { label: 'Temperatur messen',      token: 'Temperatur messen' },
    { label: 'Oberkörper hoch lagern', token: 'Oberkörper hoch lagern' }
  ]
};

function renderPanel(tabKey) {
  panel.innerHTML = '';
  (ACTIONS[tabKey] || []).forEach(action => {
    const btn = document.createElement('button');
    btn.className = 'action-card';
    btn.innerHTML = `<div class="label">${action.label}</div>`;
    btn.addEventListener('click', () => {
      if (action.special === 'O2') openOxygen();
      else if (action.special === 'NA') openNA(); 
      else {
        queue.push({ label: action.label, token: action.token });
        renderQueue();
      }
    });
    panel.appendChild(btn);
  });
}

tabs.forEach(t => t.addEventListener('click', () => {
  tabs.forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  renderPanel(t.dataset.tab);
}));

// NEU: Listener für den Globalen Notarzt Button
document.getElementById('btnGlobalNA')?.addEventListener('click', openNA);

function renderQueue() {
  queueList.innerHTML = '';
  queue.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = 'queue-item';
    li.innerHTML = `<span class="qi-label">${item.label}</span><button class="btn secondary small">✖</button>`;
    li.querySelector('button').addEventListener('click', () => {
      queue.splice(idx, 1);
      renderQueue();
    });
    queueList.appendChild(li);
  });
}

// ------- Start & Step -------
async function startCase() {
  chatLog.innerHTML = '';
  queue.length = 0;
  renderQueue();
  clearVisibleVitals();
  resetProgress();
  caseState = null;
  if(setupRow) setupRow.classList.add('collapsed');
  
  setStatus('Fall wird geladen …');
  startBtn.disabled = true;

  try {
    const res = await fetch(API_CASE_NEW, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specialty: selectedSpec,
        role: roleSel?.value || 'RS',
        difficulty: 'mittel'
      })
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    caseState = data.case || data;
  } catch (e) {
    caseState = buildLocalCase(selectedSpec, roleSel?.value || 'RS');
    addMsg(`<div class="small">⚠️ Offline-Modus (${e.message}).</div>`);
  } finally {
    startBtn.disabled = false;
  }

  if (!caseState) {
    if(setupRow) setupRow.classList.remove('collapsed');
    return;
  }
  clearVisibleVitals();
  setStatus(`Fall aktiv (${caseState.specialty})`);
  setScore(caseState.score);
  renderProgress(caseState.steps_done);
  showHint('Beginne mit X oder A.');
  addMsg(`<strong>Fallstart:</strong> ${caseState?.story || '—'}`);
}

async function stepCase(phrase) {
  if (!caseState) return;
  try {
    const res = await fetch(API_CASE_STEP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_state: caseState, user_action: phrase, role: caseState.role })
    });
    const data = await res.json();

    if (data.updated_vitals) {
      Object.entries(data.updated_vitals).forEach(([k,v]) => visibleVitals[k] = v);
      renderVitalsFromVisible();
    }
    
    // UI Feedback
    const badges = [];
    if (data.accepted)      badges.push('✓');
    if (data.outside_scope) badges.push('⚠ ?');
    if (data.unsafe)        badges.push('⛔');
    
    let vitalsMini = '';
    if (data.updated_vitals && Object.keys(data.updated_vitals).length) {
      const parts = Object.entries(data.updated_vitals).map(([k,v]) => `${k}: <b>${v}</b>`);
      vitalsMini = `<div class="small" style="margin-top:4px; border-top:1px solid #eee; padding-top:4px;">🔎 ${parts.join(' · ')}</div>`;
    }

    addMsg(`
      <div><strong>${phrase}</strong> <span class="small muted" style="float:right;">${badges.join(' ')}</span></div>
      ${data.evaluation ? `<div style="margin-top:4px;">${String(data.evaluation).replace(/\n/g,'<br>')}</div>` : ''}
      ${data.finding ? `<div class="small" style="color:#0f766e; margin-top:2px;">${String(data.finding).replace(/\n/g,'<br>')}</div>` : ''}
      ${vitalsMini}
      ${data.next_hint ? `<div class="small muted" style="margin-top:6px;">💡 ${String(data.next_hint)}</div>` : ''}
    `);

    caseState = data.case_state || caseState;
    setScore(caseState?.score ?? 0);
    renderProgress(caseState?.steps_done || []);
    showHint(data.next_hint || '');

    if (data.done) {
      setStatus('Fall abgeschlossen.');
      openDebrief();
      if(setupRow) setupRow.classList.remove('collapsed');
      showHint('—'); resetProgress(); caseState = null;
    }
  } catch (e) {
    addMsg(`⚠️ Fehler: ${e.message}`);
  }
}

// ------- Modals -------
const $id = (x) => document.getElementById(x);
function openModal(id) { $id('modalBackdrop').classList.remove('hidden'); $id(id).classList.remove('hidden'); }
function closeModal(id) { $id('modalBackdrop').classList.add('hidden'); $id(id).classList.add('hidden'); }

// Notarzt Modal
function openNA() {
  if (!caseState) return;
  $id('naReason').value = '';
  $id('naOk').onclick = () => {
    const reason = $id('naReason').value || 'Keine Angabe';
    stepCase(`Notarzt nachfordern: ${reason}`);
    closeModal('modalNA');
  };
  $id('naCancel').onclick = () => closeModal('modalNA');
  openModal('modalNA');
}

// O2 Modal
function openOxygen() {
  if (!caseState) return;
  const flowSlider = $id('o2Flow');
  const flowVal    = $id('o2FlowVal');
  const deviceSel  = $id('o2Device');
  
  flowSlider.value = 0; 
  flowVal.textContent = '0';
  
  flowSlider.oninput = () => flowVal.textContent = flowSlider.value;
  
  $id('o2Ok').onclick = () => {
    const flow = flowSlider.value;
    const dev  = deviceSel.options[deviceSel.selectedIndex].text;
    stepCase(`O2-Gabe: ${dev} mit ${flow} l/min`);
    closeModal('modalO2');
  };
  $id('o2Cancel').onclick = () => closeModal('modalO2');
  openModal('modalO2');
}

function openAFCounter() { stepCase('AF messen'); }

function openBEFAST() {
  const info = document.getElementById('befastInfo');
  document.getElementById('befastFetch').onclick = async () => {
    const res = await fetch(API_CASE_STEP, {method:'POST', body:JSON.stringify({case_state:caseState, user_action:'BEFAST Info'})});
    const d = await res.json();
    info.textContent = d.finding || 'Unauffällig';
  };
  document.getElementById('befastOk').onclick = () => {
    stepCase('BEFAST dokumentiert');
    closeModal('modalBEFAST');
  };
  document.getElementById('befastCancel').onclick = () => closeModal('modalBEFAST');
  openModal('modalBEFAST');
}

function openSampler() {
  ['s_sympt','s_allerg','s_med','s_hist','s_last','s_events','s_risk'].forEach(id=>{
    if($id(id)) $id(id).value='';
  });
  
  document.getElementById('samplerFetch').onclick = async () => {
    await stepCase('SAMPLER Info');
    const S = caseState?.anamnesis?.SAMPLER || {};
    if($id('s_sympt')) $id('s_sympt').value = S.S || '';
    if($id('s_allerg')) $id('s_allerg').value = S.A || '';
    if($id('s_med')) $id('s_med').value = S.M || '';
    if($id('s_hist')) $id('s_hist').value = S.P || '';
    if($id('s_last')) $id('s_last').value = S.L || '';
    if($id('s_events')) $id('s_events').value = S.E || '';
    if($id('s_risk')) $id('s_risk').value = S.R || '';
  };
  document.getElementById('samplerOk').onclick = () => {
    stepCase('SAMPLER doku'); 
    closeModal('modalSampler');
  };
  document.getElementById('samplerCancel').onclick = () => closeModal('modalSampler');
  openModal('modalSampler');
}

function openFourS() {
  const info = $id('s4Info');
  $id('s4Fetch').onclick = async () => {
    const res = await fetch(API_CASE_STEP, {method:'POST', body:JSON.stringify({case_state:caseState, user_action:'4S Info'})});
    const d = await res.json();
    info.textContent = d.finding || 'Unauffällig';
  };
  $id('s4Ok').onclick = () => {
    stepCase('4S dokumentiert');
    closeModal('modal4S');
  };
  $id('s4Cancel').onclick = () => closeModal('modal4S');
  openModal('modal4S');
}

function openNRS() {
  const r = $id('nrsRange'), v=$id('nrsVal'), i=$id('nrsInfo');
  r.value=0; v.textContent='0'; i.textContent='';
  $id('nrsFetch').onclick = async () => {
    const res = await fetch(API_CASE_STEP, {method:'POST', body:JSON.stringify({case_state:caseState, user_action:'Schmerz Info'})});
    const d = await res.json();
    i.textContent = d.finding;
  };
  r.oninput = () => v.textContent = r.value;
  $id('nrsOk').onclick = () => { stepCase(`NRS ${r.value}`); closeModal('modalNRS'); };
  $id('nrsCancel').onclick = () => closeModal('modalNRS');
  openModal('modalNRS');
}

// Diagnose & Transport
const DX_BY_SPEC = {
  internistisch: ['ACS','Asthma/Bronchialobstruktion','COPD-Exazerbation','Lungenembolie','Sepsis','Metabolische Entgleisung'],
  neurologisch:  ['Schlaganfall','Krampfanfall','Hypoglykämie','Bewusstlosigkeit unklarer Genese'],
  trauma:        ['Polytrauma','Schädel-Hirn-Trauma','Thoraxtrauma','Fraktur/Blutung'],
  pädiatrisch:   ['Fieberkrampf','Asthmaanfall','Dehydratation','Trauma Kind']
};

function openDiagnosis() {
  const dxSpec = $id('dxSpec');
  const dxSel  = $id('dxSelect');
  const fill = () => {
    const list = DX_BY_SPEC[dxSpec.value] || [];
    dxSel.innerHTML = list.map(x => `<option>${x}</option>`).join('') + '<option>Andere (Kommentar)</option>';
  };
  dxSpec.value = selectedSpec; fill();
  dxSpec.onchange = fill;
  
  $id('dxOk').onclick = () => {
    stepCase(`Verdachtsdiagnose: ${dxSel.value} | Prio: ${$id('dxPrio').value}`);
    closeModal('modalDx');
  };
  $id('dxCancel').onclick = () => closeModal('modalDx');
  openModal('modalDx');
}

async function openDebrief() {
  function format(raw) {
    if(!raw) return '';
    const cleanLines = String(raw).split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const items = cleanLines.map(l => {
      const parts = l.split(':');
      if (parts.length > 1) {
        const key = parts[0];
        const val = parts.slice(1).join(':');
        return `<li><strong>${key}:</strong>${val}</li>`;
      }
      return `<li>${l}</li>`;
    }).join('');
    return `<ul class="debrief-list small">${items}</ul>`;
  }
  
  try {
    const res = await fetch(API_CASE_STEP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_state: caseState, user_action: 'Debriefing' })
    });
    if (res.ok) {
      const data = await res.json();
      const raw = data.debrief || 'Keine Daten.';
      let label = 'Ergebnis';
      let color = 'warn';
      if (raw.includes('Bestanden') || raw.includes('bestanden')) { label='🟢 Bestanden'; color='pass'; }
      else if (raw.includes('Nicht') || raw.includes('Fehlt')) { label='🔴 Nicht bestanden'; color='fail'; }
      else { label='🟡 Abschluss'; }

      addMsg(`<div class="debrief-result debrief-${color}">${label}</div>`);
      addMsg(`<strong>Debriefing</strong>${format(raw)}`);
      return;
    }
  } catch (e) {}
}

// Events
runBtn.addEventListener('click', async () => {
  if (!caseState) return;
  while (queue.length) {
    const { token } = queue.shift();
    renderQueue();
    await stepCase(token);
    await new Promise(r => setTimeout(r, 800));
  }
});
clearBtn.addEventListener('click', () => { queue.length=0; renderQueue(); });
startBtn.addEventListener('click', startCase);
finishBtn.addEventListener('click', async () => { if(caseState) { await openDebrief(); stepCase('Fall beenden'); } });

function buildLocalCase(s){ return {id:'loc', specialty:s, score:0, steps_done:[], history:[], vitals:{RR:'120/80'}}; }

// Init
clearVisibleVitals();
renderPanel('X');