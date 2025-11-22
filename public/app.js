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
// Tools (Buttons unter den Tabs)
document.querySelectorAll('.schema-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const tool = btn.dataset.tool;
    if (tool === 'AF_COUNTER') openAFCounter();
    if (tool === 'NRS')        openNRS();
    if (tool === 'BEFAST')     openBEFAST();
    if (tool === 'SAMPLER')    openSampler();
    if (tool === 'FOUR_S')     openFourS();
    if (tool === 'DIAGNOSIS')  openDiagnosis();
    if (tool === 'DEBRIEF')    openDebrief();
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
  { label: 'SpO₂ messen', token: 'SpO2 messen' },
  { label: 'AF zählen (30s)', token: 'modal:AF' },     // <— neu
  { label: 'Thorax inspizieren', token: 'Thorax inspizieren' },
  { label: 'Lunge auskultieren', token: 'Thorax auskultieren' },
  { label: 'Sauerstoff geben', token: 'O2 geben' }
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
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab)
  );
  panel.innerHTML = '';

  (ACTIONS[tab] || []).forEach(a => {
    const card = document.createElement('button');
    card.className = 'action-card';
    card.innerHTML =
      `<div class="action-title">${a.label}</div>
       <div class="action-sub">${a.token}</div>`;

    card.addEventListener('click', () => {
      // ✅ Modal-Aktionen abfangen
      if (a.token && a.token.startsWith('modal:')) {
        const key = a.token.split(':')[1];

        if (key === 'AF') return openAFCounter();
        if (key === 'NRS') return openNRS();
        if (key === 'BEFAST') return openBEFAST();
        if (key === 'SAMPLER') return openSampler();
        if (key === '4S') return openFourS();
        if (key === 'Dx') return openDiagnosis();
      }

      // ✅ normale Aktion → direkt in die Queue
      addToQueue(a.label, a.token);
    });

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
// ===== MODAL HELPERS =====
const $id = (x)=>document.getElementById(x);
function openModal(id){ $id('modalBackdrop').classList.remove('hidden'); $id(id).classList.remove('hidden'); }
function closeModal(id){ $id('modalBackdrop').classList.add('hidden'); $id(id).classList.add('hidden'); }
function openAFCounter(){
  let secs = 30, count = 0, timer = null, targetAF = null;

  // 1) Zielwert aus dem Fall holen (ohne Anzeige ändern)
  (async ()=>{
    try{
      const res = await fetch(API_CASE_STEP, {
        method: 'POST', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ case_state: caseState, user_action: 'AF Info', role: caseState?.role || 'RS' })
      });
      const data = await res.json();
      // Wir akzeptieren AF in updated_vitals oder im Text (z.B. "AF: 12/min")
      if (data.updated_vitals?.AF) targetAF = Number(String(data.updated_vitals.AF).replace(/\D/g,''));
      else if (data.finding) {
        const m = String(data.finding).match(/AF[^0-9]*([0-9]{1,2})/i);
        if (m) targetAF = Number(m[1]);
      }
      const info = targetAF!=null ? `🎯 Ziel (Erwartung): ${targetAF}/min` : `ℹ️ Zähle 30s – wir rechnen hoch.`;
      document.getElementById('befastInfo')?.textContent; // no-op to avoid linter
      const t = document.createElement('div'); t.className='small muted'; t.textContent = info;
      const body = document.querySelector('#modalAF .modal-body');
      body && body.appendChild(t);
    }catch(e){ /* still ok */ }
  })();

  document.getElementById('afTimer').textContent = secs;
  document.getElementById('afCount').textContent = count;

  const tick = () => {
    secs--; document.getElementById('afTimer').textContent = secs;
    if (secs <= 0) stop(true);
  };

  function stop(finish){
    clearInterval(timer); timer = null;
    document.getElementById('afStart').disabled = false;
    document.getElementById('afTap').disabled = true;

    if (finish){
      const perMin = Math.max(0, Math.round(count * 2));
      visibleVitals.AF = perMin;
      renderVitalsFromVisible();

      // Vergleich mit Ziel (±2)
      let note = '';
      if (targetAF != null) {
        const diff = Math.abs(perMin - targetAF);
        note = diff <= 2 ? ' (🎯 entspricht Erwartung)' : ` (↔︎ abweichend, Ziel: ${targetAF}/min)`;
      }

      // an Backend melden
      stepCase(`AF messen ${perMin}/min${note}`);
      closeModal('modalAF');
    }
  }

  document.getElementById('afStart').onclick = ()=>{
    if (timer) return;
    secs = 30; count = 0;
    document.getElementById('afTimer').textContent = secs;
    document.getElementById('afCount').textContent = count;
    timer = setInterval(tick, 1000);
    document.getElementById('afStart').disabled = true;
    document.getElementById('afTap').disabled = false;
  };
  document.getElementById('afTap').onclick = ()=>{ if (!timer) return; count++; document.getElementById('afCount').textContent = count; };
  document.getElementById('afCancel').onclick = ()=>{ stop(false); closeModal('modalAF'); };
  document.getElementById('afTap').disabled = true;

  openModal('modalAF');
}


// ---- NRS ----
function openNRS(){
  const infoBox = document.getElementById('nrsInfo');
  document.getElementById('nrsFetch')?.addEventListener('click', async ()=>{
    const res = await fetch(API_CASE_STEP, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ case_state: caseState, user_action: 'Schmerz Info', role: caseState?.role || 'RS' })
    });
    const data = await res.json();
    infoBox.textContent = data.finding || data.evaluation || 'Schmerzangabe nicht verfügbar – erfrage aktiv.';
  }, { once:true });

  const range=document.getElementById('nrsRange'), val=document.getElementById('nrsVal');
  val.textContent=range.value; range.oninput=()=> val.textContent=range.value;
  document.getElementById('nrsOk').onclick=()=>{ const n=Number(range.value||0); stepCase(`NRS ${n}`); closeModal('modalNRS'); };
  document.getElementById('nrsCancel').onclick=()=> closeModal('modalNRS');
  openModal('modalNRS');
}

// ---- BE-FAST ----
function openBEFAST(){
  const infoBox = document.getElementById('befastInfo');
  document.getElementById('befastFetch')?.addEventListener('click', async ()=>{
    const res = await fetch(API_CASE_STEP, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ case_state: caseState, user_action: 'BEFAST Info', role: caseState?.role || 'RS' })
    });
    const data = await res.json();
    infoBox.textContent = data.finding || data.evaluation || 'Keine neurologischen Hinweise.';
  }, { once:true });

  document.getElementById('befastOk').onclick = ()=>{
    const data={
      B:document.getElementById('b_face').checked,
      E:document.getElementById('e_eyes').checked,
      F:document.getElementById('f_face').checked,
      A:document.getElementById('a_arm').checked,
      S:document.getElementById('s_speech').checked,
      T:document.getElementById('t_time').value||''
    };
    const parts=[]; if(data.B) parts.push('Balance'); if(data.E) parts.push('Eyes'); if(data.F) parts.push('Face'); if(data.A) parts.push('Arm'); if(data.S) parts.push('Speech');
    const msg=`BEFAST: ${parts.join(', ') || 'unauffällig'}${data.T?` | Last known well: ${data.T}`:''}`;
    stepCase(msg);
    closeModal('modalBEFAST');
  };
  document.getElementById('befastCancel').onclick = ()=> closeModal('modalBEFAST');
  openModal('modalBEFAST');
}

// ---- SAMPLER ----
function openSampler(){
  const infoBox = document.getElementById('samplerInfo');
  document.getElementById('samplerFetch')?.addEventListener('click', async ()=>{
    const res = await fetch(API_CASE_STEP, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ case_state: caseState, user_action: 'SAMPLER Info', role: caseState?.role || 'RS' })
    });
    const data = await res.json();
    infoBox.textContent = data.finding || data.evaluation || 'Keine zusätzlichen Infos verfügbar.';
  }, { once:true });

  document.getElementById('samplerOk').onclick = ()=>{
    const msg = `SAMPLER: S=${document.getElementById('s_sympt').value||'-'}; A=${document.getElementById('s_allerg').value||'-'}; M=${document.getElementById('s_med').value||'-'}; P=${document.getElementById('s_hist').value||'-'}; L=${document.getElementById('s_last').value||'-'}; E=${document.getElementById('s_events').value||'-'}; R=${document.getElementById('s_risk').value||'-'}`;
    stepCase(msg); closeModal('modalSampler');
  };
  document.getElementById('samplerCancel').onclick = ()=> closeModal('modalSampler');
  openModal('modalSampler');
}

// ---- 4S ----
function openFourS(){
  const infoBox = document.getElementById('s4Info');
  document.getElementById('s4Fetch')?.addEventListener('click', async ()=>{
    const res = await fetch(API_CASE_STEP, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ case_state: caseState, user_action: '4S Info', role: caseState?.role || 'RS' })
    });
    const data = await res.json();
    infoBox.textContent = data.finding || data.evaluation || 'Keine Hinweise zur Einsatzstelle.';
  }, { once:true });

  document.getElementById('s4Ok').onclick = ()=>{
    const list=[];
    if(document.getElementById('s1').checked) list.push('Sicherheit');
    if(document.getElementById('s2').checked) list.push('Szenerie beurteilt');
    if(document.getElementById('s3').checked) list.push('Sichtung/Ressourcen');
    if(document.getElementById('s4').checked) list.push('Support angefordert');
    stepCase(`4S: ${list.length?list.join(', '):'ohne Auffälligkeit'}`);
    closeModal('modal4S');
  };
  document.getElementById('s4Cancel').onclick = ()=> closeModal('modal4S');
  openModal('modal4S');
}

// ---- Diagnose & Transport ----
const DX_BY_SPEC = {
  internistisch: ['ACS (STEMI/NSTEMI?)','Ateminsuffizienz','Sepsis','Hypoglykämie','Exsikkose'],
  neurologisch:  ['Schlaganfall/TIA','Krampfanfall postiktal','Intrazerebrale Blutung','Delir'],
  trauma:        ['Polytrauma','Schädel-Hirn-Trauma','Thoraxtrauma','Fraktur/Blutung'],
  paediatrisch:  ['Fieberkrampf','Asthmaanfall','Dehydratation','Trauma Kind']
};
function openDiagnosis(){
  const dxSpec=$id('dxSpec'), dxSel=$id('dxSelect');
  const fill=()=>{
    const list=DX_BY_SPEC[dxSpec.value]||[];
    dxSel.innerHTML = list.map(x=>`<option>${x}</option>`).join('') + `<option>Andere (Kommentar)</option>`;
  };
  dxSpec.value = (selectedSpec || 'internistisch');
  fill();
  dxSpec.onchange=fill;
  $id('dxOk').onclick=()=>{
    const txt = dxSel.value;
    const prio= $id('dxPrio').value;
    const note= ($id('dxNote').value||'').trim();
    let msg = `Verdachtsdiagnose: ${txt}; Priorität: ${prio}`;
    if(note) msg += `; Hinweis: ${note}`;
    stepCase(msg);
    closeModal('modalDx');
  };
  $id('dxCancel').onclick=()=> closeModal('modalDx');
  openModal('modalDx');
}
async function openDebrief(){
  // Versuche zuerst, ein Debrief vom Backend zu bekommen
  try{
    const res = await fetch(API_CASE_STEP, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ case_state: caseState, user_action: 'Debriefing', role: caseState?.role || 'RS' })
    });
    const data = await res.json();
    if (data.debrief || data.evaluation || data.finding) {
      addMsg(`<strong>Debriefing</strong><div class="small">${data.debrief || data.evaluation || data.finding}</div>`);
      return;
    }
  }catch(e){ /* fallback unten */ }

  // Fallback: Lokale Auswertung (Score, Schritte, Vitals)
  const steps = (caseState?.steps_done || []).join(' → ') || '–';
  const vitals = Object.entries(visibleVitals).map(([k,v])=>`${k}: ${v}`).join(' · ') || 'keine erhoben';
  const score  = caseState?.score ?? 0;

  addMsg(`
    <strong>Debriefing (lokal)</strong>
    <div class="small">Score: <b>${score}</b></div>
    <div class="small">Schritte: ${steps}</div>
    <div class="small">Erhobene Vitals: ${vitals}</div>
    <div class="small">Hinweis: Nutze X→A→B→C→D→E und verknüpfe Maßnahmen mit Befund (z. B. O₂ ↔︎ SpO₂).</div>
  `);
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
