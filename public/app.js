// ===============================================================
// medicIQ – App Logic (Hybrid-UI)
// - Setup verschwindet bei Fallstart
// - Automatisches Debriefing am Ende
// - Vitalwerte-Trends & Hybrid-Input Unterstützung
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
const setupRow  = document.querySelector('.setup-row'); // Fürs Ausblenden

const queueList = document.getElementById('queueList');
const runBtn    = document.getElementById('btnRunQueue');
const clearBtn  = document.getElementById('btnClearQueue');
const startBtn  = document.getElementById('startCase');
const finishBtn = document.getElementById('finishCase');
const chatLog   = document.getElementById('chatLog');
const roleSel   = document.getElementById('roleSel');

// Fachrichtung Auswahl
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

// Vitals Map
const vitalsMap = {
  RR:   document.getElementById('vRR'),
  SpO2: document.getElementById('vSpO2'),
  AF:   document.getElementById('vAF'),
  Puls: document.getElementById('vPuls'),
  BZ:   document.getElementById('vBZ'),
  Temp: document.getElementById('vTemp'),
  GCS:  document.getElementById('vGCS')
};
const visibleVitals = {}; // Persistiert Messwerte

// ------- State -------
let caseState = null;
const queue = [];

// ------- Helpers -------
const setStatus = t => statusEl.textContent = t;
const setScore  = n => scoreEl.textContent  = `Score: ${n ?? 0}`;

function renderVitalsFromVisible() {
  // Reset auf Strich
  for (const el of Object.values(vitalsMap)) el.textContent = '–';
  // Werte schreiben (inkl. Pfeile vom Backend)
  for (const [k, v] of Object.entries(visibleVitals)) {
    if (v != null && vitalsMap[k]) {
      vitalsMap[k].innerHTML = v; // innerHTML erlaubt theoretisch Styling
    }
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

  // Markiere erledigte
  order.forEach(step => {
    const el = chips.find(c => c.dataset.step === step);
    if ([...done].some(s => s.startsWith(step))) {
      el.classList.add('done');
    }
  });

  // Markiere nächsten aktiven Schritt
  const next = order.find(s => ![...done].some(x => x.startsWith(s)));
  const activeEl = chips.find(c => c.dataset.step === next);
  if (activeEl) {
    activeEl.classList.add('active');
  }
}

// ------- Maßnahmen-Kacheln (Tabs) -------
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
    { label: 'Sauerstoff geben',       token: 'O2 geben' }
  ],
  C: [
    { label: 'RR messen',              token: 'RR messen' },
    { label: 'Puls messen',            token: 'Puls messen' },
    { label: '12-Kanal-EKG',           token: '12-Kanal-EKG' },
    { label: 'Volumen 500 ml',         token: 'Volumen 500 ml' }
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
      queue.push({ label: action.label, token: action.token });
      renderQueue();
    });
    panel.appendChild(btn);
  });
}

tabs.forEach(t => t.addEventListener('click', () => {
  tabs.forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  renderPanel(t.dataset.tab);
}));

// ------- Queue Logic -------
function renderQueue() {
  queueList.innerHTML = '';
  queue.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = 'queue-item';
    li.innerHTML = `
      <span class="qi-label">${item.label}</span>
      <button class="btn secondary small">✖</button>
    `;
    li.querySelector('button').addEventListener('click', () => {
      queue.splice(idx, 1);
      renderQueue();
    });
    queueList.appendChild(li);
  });
}

// ===============================================================
// CORE LOGIK: Start & Step
// ===============================================================

async function startCase() {
  chatLog.innerHTML = '';
  queue.length = 0;
  renderQueue();
  clearVisibleVitals();
  resetProgress();
  caseState = null;
  
  // UI aufräumen: Setup ausblenden für mehr Platz
  if(setupRow) setupRow.classList.add('collapsed');
  
  setStatus('Fall wird geladen …');
  startBtn.disabled = true;

  let usedFallback = false;
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
    if (!data || data.error) throw new Error(data?.error || 'Ungültige Antwort vom Server.');
    caseState = data.case || data;
  } catch (e) {
    usedFallback = true;
    caseState = buildLocalCase(selectedSpec, roleSel?.value || 'RS', 'mittel');
    addMsg(`<div class="small">⚠️ Backend nicht erreichbar (${e.message}), verwende lokalen Fallsimulator.</div>`);
  } finally {
    startBtn.disabled = false;
  }

  if (!caseState) {
    setStatus('Kein Fall aktiv.');
    if(setupRow) setupRow.classList.remove('collapsed'); // Setup wieder zeigen bei Fehler
    return;
  }

  clearVisibleVitals();
  setStatus(`Fall aktiv (${caseState.specialty || selectedSpec})`);
  setScore(caseState.score ?? 0);
  renderProgress(caseState.steps_done || []);
  showHint('Starte mit X und arbeite dich nach XABCDE durch.');
  addMsg(`<strong>Fallstart${usedFallback ? ' (lokal)' : ''}:</strong> ${caseState?.story || '—'}`);
}

async function stepCase(phrase) {
  if (!caseState) return;
  
  // Kleiner Indikator im Chat (optional)
  // addMsg(`<div class="small muted">... verarbeite "${phrase}"</div>`);

  try {
    const res = await fetch(API_CASE_STEP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        case_state: caseState, 
        user_action: phrase, 
        role: caseState.role || 'RS' 
      })
    });
    const data = await res.json();

    // 1) Sichtbare Vitals aktualisieren (inkl. Trends vom Backend)
    if (data.updated_vitals) {
      Object.entries(data.updated_vitals).forEach(([k,v]) => { 
        visibleVitals[k] = v; 
      });
      renderVitalsFromVisible();
    }

    // 2) Feedback & Progress
    const badges = [];
    if (data.accepted)      badges.push('✓');
    if (data.outside_scope) badges.push('⚠ Kompetenz?');
    if (data.unsafe)        badges.push('⛔ Unsicher');

    let vitalsMini = '';
    if (data.updated_vitals && Object.keys(data.updated_vitals).length) {
      // Vitals schön formatieren
      const parts = Object.entries(data.updated_vitals).map(([k,v]) => `${k}: <b>${v}</b>`);
      vitalsMini = `<div class="small" style="margin-top:4px; border-top:1px solid #eee; padding-top:4px;">🔎 ${parts.join(' · ')}</div>`;
    }

    addMsg(`
      <div><strong>${phrase}</strong> <span class="small muted" style="float:right;">${badges.join(' ')}</span></div>
      ${data.evaluation ? `<div style="margin-top:4px;">${String(data.evaluation).replace(/\n/g,'<br>')}</div>` : ''}
      ${data.finding ? `<div class="small" style="color:#0f766e; margin-top:2px;">${String(data.finding).replace(/\n/g,'<br>')}</div>` : ''}
      ${vitalsMini}
      ${data.next_hint ? `<div class="small muted" style="margin-top:6px;">💡 Tipp: ${String(data.next_hint)}</div>` : ''}
    `);

    caseState = data.case_state || caseState;
    setScore(caseState?.score ?? 0);
    renderProgress(caseState?.steps_done || []);
    showHint(data.next_hint || '');

    if (data.done) {
      setStatus('Fall abgeschlossen.');
      addMsg(`<strong>🏁 Fall beendet. Öffne Debriefing...</strong>`);
      
      // Automatisch Debriefing öffnen
      openDebrief(); 
      
      // Setup wieder einblenden für neuen Fall
      if(setupRow) setupRow.classList.remove('collapsed'); 
      showHint('—'); 
      resetProgress(); 
      caseState = null;
    }
  } catch (e) {
    addMsg(`⚠️ Fehler: <span class="small">${e.message}</span>`);
  }
}

// ===============================================================
// MODALS
// ===============================================================

const $id = (x) => document.getElementById(x);
function openModal(id) { $id('modalBackdrop').classList.remove('hidden'); $id(id).classList.remove('hidden'); }
function closeModal(id) { $id('modalBackdrop').classList.add('hidden'); $id(id).classList.add('hidden'); }

// AF Counter (vereinfacht)
function openAFCounter() {
  if (!caseState) return;
  stepCase('AF messen');
}

// BE-FAST
function openBEFAST() {
  const infoBox = document.getElementById('befastInfo');
  document.getElementById('befastFetch').onclick = async () => {
    const res = await fetch(API_CASE_STEP, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ case_state: caseState, user_action: 'BEFAST Info', role: caseState?.role || 'RS' })
    });
    const data = await res.json();
    infoBox.textContent = data.finding || data.evaluation || 'Keine neurologischen Hinweise.';
  };

  document.getElementById('befastOk').onclick = () => {
    const data = {
      B: document.getElementById('b_face').checked,
      E: document.getElementById('e_eyes').checked,
      F: document.getElementById('f_face').checked,
      A: document.getElementById('a_arm').checked,
      S: document.getElementById('s_speech').checked,
      T: document.getElementById('t_time').value || ''
    };
    const parts=[]; 
    if(data.B) parts.push('Balance'); if(data.E) parts.push('Eyes'); 
    if(data.F) parts.push('Face'); if(data.A) parts.push('Arm'); if(data.S) parts.push('Speech');
    const msg = `BEFAST: ${parts.join(', ') || 'unauffällig'}${data.T ? ` | Last known well: ${data.T}` : ''}`;
    stepCase(msg);
    closeModal('modalBEFAST');
  };
  document.getElementById('befastCancel').onclick = () => closeModal('modalBEFAST');
  openModal('modalBEFAST');
}

// SAMPLER
function openSampler() {
  const infoBox = document.getElementById('samplerInfo');
  if (infoBox) infoBox.textContent = '';
  
  // Reset fields
  ['s_sympt','s_allerg','s_med','s_hist','s_last','s_events','s_risk'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  document.getElementById('samplerFetch').onclick = async () => {
    if (!caseState) return;
    await stepCase('SAMPLER Info');
    const a = caseState.anamnesis || {};
    const S = a.SAMPLER || {};
    const m = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    m('s_sympt',  S.S || ''); m('s_allerg', S.A || ''); m('s_med',    S.M || '');
    m('s_hist',   S.P || ''); m('s_last',   S.L || ''); m('s_events', S.E || ''); m('s_risk',   S.R || '');
  };

  document.getElementById('samplerOk').onclick = () => {
    const data = {
      S: document.getElementById('s_sympt')?.value  || '',
      A: document.getElementById('s_allerg')?.value || '',
      M: document.getElementById('s_med')?.value    || '',
      P: document.getElementById('s_hist')?.value   || '',
      L: document.getElementById('s_last')?.value   || '',
      E: document.getElementById('s_events')?.value || '',
      R: document.getElementById('s_risk')?.value   || ''
    };
    const parts = [];
    Object.entries(data).forEach(([k,v]) => { if (v) parts.push(`${k}:${v}`); });
    stepCase(parts.length ? `SAMPLER dokumentiert (${parts.join(' | ')})` : 'SAMPLER dokumentiert');
    closeModal('modalSampler');
  };
  document.getElementById('samplerCancel').onclick = () => closeModal('modalSampler');
  openModal('modalSampler');
}

// 4S
function openFourS() {
  const infoBox = document.getElementById('s4Info');
  document.getElementById('s4Fetch').onclick = async () => {
    const res = await fetch(API_CASE_STEP, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ case_state: caseState, user_action: '4S Info', role: caseState?.role || 'RS' })
    });
    const data = await res.json();
    infoBox.textContent = data.finding || data.evaluation || 'Keine zusätzlichen Hinweise.';
  };

  document.getElementById('s4Ok').onclick = () => {
    const parts=[];
    if(document.getElementById('s1').checked) parts.push('Sicherheit');
    if(document.getElementById('s2').checked) parts.push('Szene');
    if(document.getElementById('s3').checked) parts.push('Sichtung');
    if(document.getElementById('s4').checked) parts.push('Support');
    stepCase(parts.length ? `4S dokumentiert (${parts.join(', ')})` : '4S dokumentiert');
    closeModal('modal4S');
  };
  document.getElementById('s4Cancel').onclick = () => closeModal('modal4S');
  openModal('modal4S');
}

// NRS
function openNRS() {
  const range = document.getElementById('nrsRange');
  const val   = document.getElementById('nrsVal');
  const info  = document.getElementById('nrsInfo');
  range.value = '0'; val.textContent = '0'; info.textContent = '';

  document.getElementById('nrsFetch').onclick = async () => {
    const res = await fetch(API_CASE_STEP, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ case_state: caseState, user_action: 'Schmerz Info', role: caseState?.role || 'RS' })
    });
    const data = await res.json();
    info.textContent = data.finding || data.evaluation || 'Keine zusätzlichen Infos.';
  };

  range.oninput = () => { val.textContent = range.value; };
  document.getElementById('nrsOk').onclick = () => {
    stepCase(`NRS ${range.value}`);
    closeModal('modalNRS');
  };
  document.getElementById('nrsCancel').onclick = () => closeModal('modalNRS');
  openModal('modalNRS');
}

// Diagnosis
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
    const txt  = dxSel.value;
    const prio = $id('dxPrio').value;
    const note = ($id('dxNote').value || '').trim();
    const parts = [`Verdachtsdiagnose: ${txt}`, `Priorität: ${prio}`];
    if (note) parts.push(`Kommentar: ${note}`);
    stepCase(`Verdachtsdiagnose: ${parts.join(' | ')}`);
    closeModal('modalDx');
  };
  $id('dxCancel').onclick = () => closeModal('modalDx');
  openModal('modalDx');
}

// Debriefing
async function openDebrief() {
  function formatDebrief(raw) {
    if (!raw) return '';
    const lines = String(raw).split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return '';
    const items = lines.map(line => {
      const [label, ...restParts] = line.split(':');
      if (restParts.length) {
        return `<li><span class="debrief-label">${label}:</span> <span class="debrief-value">${restParts.join(':').trim()}</span></li>`;
      }
      return `<li>${line}</li>`;
    }).join('');
    return `<ul class="debrief-list small">${items}</ul>`;
  }

  function evaluateCaseQuality() {
    const steps = new Set((caseState?.steps_done || []).map(s => String(s)[0].toUpperCase()));
    const missing = ['X','A','B','C','D','E'].filter(s => !steps.has(s));
    const score = caseState?.score ?? 0;
    
    if (missing.length === 0 && score >= 8) return { label: '🟢 Fall bestanden', color: 'pass' };
    if (missing.length <= 2 && score >= 4) return { label: '🟡 Teilweise bestanden', color: 'warn' };
    return { label: '🔴 Wichtige Schritte fehlen', color: 'fail' };
  }

  try {
    const res = await fetch(API_CASE_STEP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_state: caseState, user_action: 'Debriefing', role: caseState?.role || 'RS' })
    });

    if (res.ok) {
      const data = await res.json();
      const raw = data.debrief || data.evaluation || data.finding;
      if (raw) {
        const html = formatDebrief(raw);
        const evalData = evaluateCaseQuality();
        addMsg(`<div class="debrief-result debrief-${evalData.color}">${evalData.label}</div>`);
        addMsg(`<strong>Debriefing</strong>${html}`);
        return;
      }
    }
  } catch (e) {
    console.warn('Backend Debrief failed, using local fallback', e);
  }

  // Fallback
  const steps  = (caseState?.steps_done || []).join(' → ') || '–';
  const vitals = Object.entries(visibleVitals).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'keine erhoben';
  const fallbackText = [`XABCDE-Fortschritt: ${steps}`, `Vitals: ${vitals}`, `Score: ${caseState?.score??0}`].join('\n');
  const evalData = evaluateCaseQuality();
  
  addMsg(`<div class="debrief-result debrief-${evalData.color}">${evalData.label}</div>`);
  addMsg(`<strong>Debriefing (lokal)</strong>${formatDebrief(fallbackText)}`);
}

// ===============================================================
// EVENTS
// ===============================================================

runBtn.addEventListener('click', async () => {
  if (!caseState || !queue.length) return;
  runBtn.disabled = clearBtn.disabled = true;
  try {
    while (queue.length) {
      const { token } = queue.shift();
      renderQueue();
      await stepCase(token);
      await new Promise(r => setTimeout(r, 800));
    }
  } finally {
    runBtn.disabled = clearBtn.disabled = false;
  }
});

clearBtn.addEventListener('click', () => { queue.length = 0; renderQueue(); });

startBtn.addEventListener('click', startCase);

finishBtn.addEventListener('click', async () => {
  if (caseState) {
    // Erzwinge Debriefing vor dem Schließen
    await openDebrief();
    stepCase('Fall beenden');
  }
});

// ===============================================================
// LOKALER SIMULATOR (Fallback)
// ===============================================================
function buildLocalCase(spec, role, difficulty) {
  spec = (spec || 'internistisch').toLowerCase();
  role = role || 'RS';
  
  // Minimaler Fallback-Inhalt, falls Backend down
  const base = {
    id: `local_${spec}`, specialty: spec, role, difficulty,
    story: "Backend nicht erreichbar. Lokaler Demo-Modus aktiv.",
    vitals: { RR:"120/80", SpO2:98, AF:16, Puls:70, BZ:100, Temp:36.5, GCS:15 },
    hidden: { vitals_baseline: { RR:"120/80", SpO2:98, AF:16, Puls:70, BZ:100, Temp:36.5, GCS:15 } },
    steps_done: [], history: [], score: 0
  };
  return base;
}

// Init
clearVisibleVitals();
setStatus('Kein Fall aktiv.');
setScore(0);
resetProgress();
showHint('—');
renderPanel('X');
addMsg('👋 <strong>Willkommen bei medicIQ!</strong><br>Wähle oben eine Fachrichtung und starte den Fall.');