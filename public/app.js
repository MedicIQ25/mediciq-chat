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
const roleSel   = document.getElementById('roleSelect');
const startBtn  = document.getElementById('btnStart');
const finishBtn = document.getElementById('btnFinish');
const panel     = document.getElementById('panel');
const hintEl    = document.getElementById('nextHint');
const chatLog   = document.getElementById('chatLog');
const scoreBox  = document.getElementById('scoreBox');
const runBtn    = document.getElementById('btnRunQueue');
const clearBtn  = document.getElementById('btnClearQueue');

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
const monitorEnabled = { RR:false, SpO2:false, AF:false, Puls:false, BZ:false, Temp:false, GCS:false };

// Monitor-Steuerung: welche Vitalparameter sollen „live“ nachlaufen?
function markMonitor(keys){
  keys.forEach(k => {
    if (Object.prototype.hasOwnProperty.call(monitorEnabled, k)) {
      monitorEnabled[k] = true;
    }
  });
}

// sanfte Dynamik der Vitals – nähert sich den Fallwerten an, kleine Schwankungen
function vitalMonitorTick(){
  if (!caseState) return;
  const target = caseState.vitals || {};

  // Blutdruck separat behandeln (RR = SYS/DIA)
  if (monitorEnabled.RR && (visibleVitals.RR || target.RR)) {
    const base = String(visibleVitals.RR || target.RR).split('/');
    const tgt  = String(target.RR || visibleVitals.RR || '').split('/');
    if (base.length === 2 && tgt.length === 2) {
      let [cSys, cDia] = base.map(v => parseInt(v,10));
      const [tSys, tDia] = tgt.map(v => parseInt(v,10));
      if (!isNaN(cSys) && !isNaN(cDia) && !isNaN(tSys) && !isNaN(tDia)) {
        const stepSys = cSys < tSys ? 2 : cSys > tSys ? -2 : 0;
        const stepDia = cDia < tDia ? 2 : cDia > tDia ? -2 : 0;
        cSys += stepSys;
        cDia += stepDia;
        visibleVitals.RR = `${cSys}/${cDia}`;
      }
    }
  }

  // alle anderen Vitals (numerisch)
  ["SpO2","AF","Puls","BZ","Temp","GCS"].forEach(key => {
    if (!monitorEnabled[key]) return;
    const curRaw = visibleVitals[key];
    const tgtRaw = target[key];
    if (curRaw == null || tgtRaw == null) return;
    let cur = Number(curRaw);
    let tgt = Number(tgtRaw);
    if (Number.isNaN(cur) || Number.isNaN(tgt)) return;

    const diff = tgt - cur;
    if (Math.abs(diff) <= 1) {
      // leichte zufällige Schwankung
      if (Math.random() < 0.3) {
        cur += Math.random() < 0.5 ? -1 : 1;
      }
    } else {
      const step = Math.sign(diff) * Math.max(1, Math.round(Math.abs(diff) / 3));
      cur += step;
    }
    visibleVitals[key] = Math.round(cur);
  });

  renderVitalsFromVisible();
}

// „Monitor“ alle 5 Sekunden laufen lassen
setInterval(vitalMonitorTick, 5000);

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
  for (const k in monitorEnabled) {
    if (Object.prototype.hasOwnProperty.call(monitorEnabled, k)) {
      monitorEnabled[k] = false;
    }
  }
  renderVitalsFromVisible();
}

// ... (dein restlicher UI-Code: renderPanel, Queue, startCase etc. bleibt wie gehabt,
// nur stepCase, openAFCounter und openNRS sind angepasst – hier die geänderten Teile:)

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
      const keys = Object.keys(data.updated_vitals);
      keys.forEach(k => { visibleVitals[k] = data.updated_vitals[k]; });
      if (keys.length) markMonitor(keys);
      renderVitalsFromVisible();
    }

    // 1b) Messwerte aus Textbefunden extrahieren (z. B. "RR: 120/80")
    if (data.finding) {
      const f = String(data.finding);
      const patterns = [
        { key: 'RR',   re: /RR:\s*([0-9]{2,3}\/[0-9]{2,3})/i },
        { key: 'SpO2', re: /SpO[²2]?:?\s*([0-9]{2,3})/i },
        { key: 'AF',   re: /\bAF:\s*([0-9]{1,2})/i },
        { key: 'Puls', re: /Puls:\s*([0-9]{2,3})/i },
        { key: 'BZ',   re: /BZ:\s*([0-9]{2,3})/i },
        { key: 'Temp', re: /Temp:\s*([0-9]{2,3}(?:[.,][0-9])?)/i },
        { key: 'GCS',  re: /GCS:\s*([0-9]{1,2})/i }
      ];
      const newly = [];
      patterns.forEach(p => {
        const m = f.match(p.re);
        if (!m) return;
        if (p.key === 'Temp') {
          visibleVitals[p.key] = parseFloat(m[1].replace(',', '.'));
        } else {
          visibleVitals[p.key] = m[1];
        }
        newly.push(p.key);
      });
      if (newly.length) {
        markMonitor(newly);
        renderVitalsFromVisible();
      }
    }

    // 2) Feedback & Progress (unverändert)
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

// AF-Zähler: nur kleine Änderung -> Monitor aktivieren, wenn fertig gezählt
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
      // Hinweis in Modal einblenden
      const t = document.createElement('div');
      t.className = 'small';
      t.textContent = targetAF != null
        ? `Erwartete AF im Fall: ca. ${targetAF}/min (±2).`
        : 'AF-Sollwert im Fall nicht eindeutig hinterlegt.';
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
      markMonitor(['AF']);
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

// ---- NRS / Schmerzskala ----
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

  const range = document.getElementById('nrsRange');
  const val   = document.getElementById('nrsVal');
  if (!range || !val) return;

  val.textContent = range.value;
  range.oninput = () => { val.textContent = range.value; };

  document.getElementById('nrsOk').onclick = () => {
    const n = Number(range.value || 0);
    stepCase(`NRS ${n}`);
    closeModal('modalNRS');
  };
  document.getElementById('nrsCancel').onclick = () => closeModal('modalNRS');
  openModal('modalNRS');
}
