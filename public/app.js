// ===============================================================
// medicIQ – Click-UI (nur Klicks) mit:
// - sichtbaren Vitalen erst nach Messung
// - persistierenden Messwerten
// - Fachrichtungs-/Rollenwahl vor Start
// ===============================================================

const API_CASE_NEW  = '/.netlify/functions/case-new';
const API_CASE_STEP = '/.netlify/functions/case-step';

// ------- UI -------
const statusEl  = document.getElementById('caseStatus');
const scoreEl   = document.getElementById('caseScore');
const chips     = Array.from(document.querySelectorAll('.chip'));
const hintCard  = document.getElementById('hintCard');
const hintText  = document.getElementById('hintText');
const tabs      = Array.from(document.querySelectorAll('.tab'));
const panel     = document.getElementById('panel');
const queueList = document.getElementById('queueList');
const runBtn    = document.getElementById('btnRunQueue');
const clearBtn  = document.getElementById('btnClearQueue');
const startBtn  = document.getElementById('startCase');
const finishBtn = document.getElementById('finishCase');
const chatLog   = document.getElementById('chatLog');

const roleSel   = document.getElementById('roleSel');
let selectedSpec = 'internistisch';
document.querySelectorAll('.spec-chip').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.spec-chip').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    selectedSpec = btn.dataset.spec;
  });
});

// Vitals – DOM + sichtbarer Zustand (nur erhobene Werte)
const vitalsMap = {
  RR:   document.getElementById('vRR'),
  SpO2: document.getElementById('vSpO2'),
  AF:   document.getElementById('vAF'),
  Puls: document.getElementById('vPuls'),
  BZ:   document.getElementById('vBZ'),
  Temp: document.getElementById('vTemp'),
  GCS:  document.getElementById('vGCS')
};
const visibleVitals = {}; // <- persistiert Messungen

// ------- State -------
let caseState = null;
const queue = []; // [{label, token}]

// ------- Helpers -------
const setStatus = t => statusEl.textContent = t;
const setScore  = n => scoreEl.textContent  = `Score: ${n ?? 0}`;

function renderVitalsFromVisible() {
  // Erst „–“ überall…
  for (const el of Object.values(vitalsMap)) el.textContent = '–';
  // …dann nur erhobene/aktualisierte Werte schreiben
  for (const [k, v] of Object.entries(visibleVitals)) {
    if (v != null && vitalsMap[k]) vitalsMap[k].textContent = v;
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
  if (text && text.trim()) { hintText.textContent = text; hintCard.classList.remove('hidden'); }
  else { hintText.textContent = '—'; hintCard.classList.add('hidden'); }
}
function resetProgress() { chips.forEach(c => c.classList.remove('done','active')); }
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
    { label: 'Druckverband', token: 'Druckverband am Unterarm rechts' },
    { label: 'Hämostyptikum', token: 'Hämostyptika in Oberschenkel links' },
    { label: 'Tourniquet', token: 'Tourniquet am Oberschenkel links' },
    { label: 'Beckenschlinge', token: 'Beckenschlinge anlegen' }
  ],
  A: [
    { label: 'Esmarch', token: 'Esmarch' },
    { label: 'Absaugen', token: 'Absaugen' },
    { label: 'Guedel', token: 'Guedel' },
    { label: 'Wendel', token: 'Wendel' },
    { label: 'BVM', token: 'Beutel-Masken-Beatmung' }
  ],
  B: [
    { label: 'SpO₂ messen', token: 'SpO2 messen' }, // Messaktion
    { label: 'Thorax inspizieren', token: 'Thorax inspizieren' },
    { label: 'Lunge auskultieren', token: 'Thorax auskultieren' },
    { label: 'Sauerstoff geben', token: 'O2 geben' } // Intervention -> Backend ändert SpO2
  ],
  C: [
    { label: 'RR messen', token: 'RR messen' },         // Messaktion
    { label: 'Puls messen', token: 'Puls messen' },     // Messaktion
    { label: '12-Kanal-EKG', token: '12-Kanal-EKG' },
    { label: 'Volumen 500 ml', token: 'Volumen 500 ml' }
  ],
  D: [
    { label: 'GCS erheben', token: 'GCS erheben' },     // Messaktion
    { label: 'Pupillen prüfen', token: 'Pupillen' },
    { label: 'BZ messen', token: 'BZ messen' }          // Messaktion
  ],
  E: [
    { label: 'Temperatur messen', token: 'Temp messen' }, // Messaktion
    { label: 'Wärmeerhalt', token: 'Wärme' },
    { label: 'Kopfteil hoch lagern', token: 'Oberkörper hoch lagern' }
  ]
};

function renderPanel(tab = 'X') {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  panel.innerHTML = '';
  (ACTIONS[tab] || []).forEach(a => {
    const card = document.createElement('button');
    card.className = 'action-card';
    card.innerHTML = `<div class="action-title">${a.label}</div><div class="action-sub">${a.token}</div>`;
    card.addEventListener('click', () => addToQueue(a.label, a.token));
    panel.appendChild(card);
  });
}
tabs.forEach(t => t.addEventListener('click', () => renderPanel(t.dataset.tab)));

// ------- Queue -------
function addToQueue(label, token) { queue.push({ label, token }); renderQueue(); }
function removeFromQueue(idx) { queue.splice(idx, 1); renderQueue(); }
function renderQueue() {
  queueList.innerHTML = '';
  queue.forEach((q, idx) => {
    const li = document.createElement('li');
    li.className = 'queue-item';
    li.innerHTML = `
      <span class="qi-label">${q.label}</span>
      <div class="q-actions"><button class="btn secondary" data-i="${idx}">Entfernen</button></div>`;
    li.querySelector('button').addEventListener('click', () => removeFromQueue(idx));
    queueList.appendChild(li);
  });
}

// ------- Backend -------
async function startCase() {
  startBtn.disabled = true;
  addMsg('<div class="small">Neuer Fall wird erstellt …</div>');
  try {
    const res = await fetch(API_CASE_NEW, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specialty: selectedSpec,       // <- vom Chip
        difficulty: 'mittel',
        role: roleSel?.value || 'RS'   // <- Rolle
      })
    });
    const data = await res.json();
    caseState = data.case || data;

    // Wichtig: NICHT automatisch Vitals setzen -> alles auf „–“ bis gemessen
    clearVisibleVitals();
    setStatus(`Fall aktiv: ${caseState?.patient?.name || 'Patient/in'} (${selectedSpec})`);
    setScore(caseState?.score ?? 0);
    renderProgress(caseState?.steps_done || []);
    showHint('Starte mit **X**: lebensbedrohliche Blutungen ausschließen/stoppen.');

    addMsg(`<strong>Fallstart:</strong> ${caseState?.story || '—'}`);
  } catch (e) {
    addMsg(`⚠️ Konnte keinen Fall starten: <span class="small">${e.message}</span>`);
  } finally {
    startBtn.disabled = false;
  }
}

async function stepCase(phrase) {
  if (!caseState) return;
  try {
    const res = await fetch(API_CASE_STEP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_state: caseState, user_action: phrase, role: caseState.role || 'RS' })
    });
    const data = await res.json();

    // 1) sichtbare Vitals MERGEN (nur keys, die zurückkommen)
    if (data.updated_vitals) {
      Object.entries(data.updated_vitals).forEach(([k,v]) => { visibleVitals[k] = v; });
      renderVitalsFromVisible();
    }

    // 2) Feedback & Progress
    const badges = [];
    if (data.accepted)      badges.push('✓ akzeptiert');
    if (data.outside_scope) badges.push('⚠ außerhalb Kompetenz');
    if (data.unsafe)        badges.push('⛔ unsicher');

    let vitalsMini = '';
    if (data.updated_vitals && Object.keys(data.updated_vitals).length) {
      const parts = Object.entries(data.updated_vitals).map(([k,v])=>`${k}: <b>${v}</b>`);
      vitalsMini = `<div class="small">🔎 ${parts.join(' · ')}</div>`;
    }

    addMsg(`
      <div><strong>Aktion:</strong> ${phrase}</div>
      ${badges.length ? `<div class="small">${badges.join(' · ')}</div>` : ''}
      ${data.evaluation ? `<div>${data.evaluation}</div>` : ''}
      ${data.finding ? `<div class="small">${data.finding}</div>` : ''}
      ${vitalsMini}
      ${data.next_hint ? `<div class="small">💡 ${data.next_hint}</div>` : ''}
    `);

    caseState = data.case_state || caseState;
    setScore(caseState?.score ?? 0);
    renderProgress(caseState?.steps_done || []);
    showHint(data.next_hint || '');

    if (data.done) {
      setStatus('Fall abgeschlossen.');
      if (data.found) addMsg(`<strong>Ergebnis:</strong> ${data.found}`);
      showHint('—'); resetProgress(); caseState = null;
    }
  } catch (e) {
    addMsg(`⚠️ Schrittfehler: <span class="small">${e.message}</span>`);
  }
}

async function runQueue() {
  if (!caseState || queue.length === 0) return;
  runBtn.disabled = clearBtn.disabled = true;
  try {
    while (queue.length) {
      const { token } = queue.shift();
      renderQueue();
      await stepCase(token);
      await new Promise(r => setTimeout(r, 120));
    }
  } finally {
    runBtn.disabled = clearBtn.disabled = false;
  }
}

// ------- Events/Init -------
runBtn.addEventListener('click', runQueue);
clearBtn.addEventListener('click', () => { queue.length = 0; renderQueue(); });
startBtn.addEventListener('click', startCase);
finishBtn.addEventListener('click', () => { if (caseState) stepCase('Fall beenden'); });

clearVisibleVitals();
setStatus('Kein Fall aktiv.');
setScore(0);
resetProgress();
showHint('—');
renderPanel('X');
addMsg('👋 Wähle oben die Fachrichtung, starte den Fall, erhebe Werte per Buttons. Gemessene Werte bleiben sichtbar; Interventionen passen Vitals an.');
