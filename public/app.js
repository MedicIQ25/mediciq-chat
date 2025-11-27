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

// Fachrichtung
const specButtons = Array.from(document.querySelectorAll('.spec-chip'));
let selectedSpec  = 'internistisch';
specButtons.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    specButtons.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    selectedSpec = btn.dataset.spec || 'internistisch';
  });
});

// Schema-Buttons (4S, SAMPLER, BE-FAST, NRS, DX, Debrief)
document.querySelectorAll('.schema-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const tool = btn.dataset.tool;
    if (tool === 'AF_COUNTER')   openAFCounter();       // AF-Button: einfache Messung
    if (tool === 'NRS')          openNRS();
    if (tool === 'BEFAST')       openBEFAST();
    if (tool === 'SAMPLER')      openSampler();
    if (tool === 'FOUR_S')       openFourS();
    if (tool === 'DIAGNOSIS')    openDiagnosis();
    if (tool === 'DEBRIEF')      openDebrief();
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

  // Markiere erledigte Schritte
  order.forEach(step => {
    const el = chips.find(c => c.dataset.step === step);
    if ([...done].some(s => s.startsWith(step))) {
      el.classList.add('done');
    }
  });

  // Markiere nächsten Schritt
  const next = order.find(s => ![...done].some(x => x.startsWith(s)));
  const activeEl = chips.find(c => c.dataset.step === next);
  if (activeEl) {
    activeEl.classList.add('active');
  }
}

// ------- Maßnahmen-Kacheln pro Tab -------
const ACTIONS = {
  X: [
    { label: 'Kein bedrohlicher Blutverlust', token: 'X unauffällig' },
    { label: 'Druckverband',           token: 'Druckverband' },
    { label: 'Hämostyptikum',          token: 'Hämostyptikum' },
    { label: 'Tourniquet',             token: 'Tourniquet' },
    { label: 'Beckenschlinge',         token: 'Beckenschlinge' }
  ],
  A: [
    { label: 'Esmarch',                token: 'Esmarch' },
    { label: 'Absaugen',               token: 'Absaugen' },
    { label: 'Mundraumkontrolle',      token: 'Mundraumkontrolle' },
    { label: 'Guedel',                 token: 'Guedel' },
    { label: 'Wendel',                 token: 'Wendel' },
    { label: 'Beutel-Masken-Beatmung', token: 'Beutel-Masken-Beatmung' }
  ],
  B: [
    { label: 'AF messen',              token: 'AF messen' },
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
    { label: 'Bodycheck',              token: 'Bodycheck' },
    { label: 'Wärmeerhalt',            token: 'Wärmeerhalt' },
    { label: 'Temperatur messen',      token: 'Temperatur messen' },
    { label: 'Oberkörper hoch lagern', token: 'Oberkörper hoch lagern' }
  ]
};

function renderPanel(tabKey) {
  panel.innerHTML = '';
  (ACTIONS[tabKey] || []).forEach(action=>{
    const btn = document.createElement('button');
    btn.className = 'action-card';
    btn.innerHTML = `<div class="label">${action.label}</div>`;
    btn.addEventListener('click', ()=>{
      queue.push({ label: action.label, token: action.token });
      renderQueue();
    });
    panel.appendChild(btn);
  });
}
tabs.forEach(t=>t.addEventListener('click', ()=> renderPanel(t.dataset.tab)));

// ------- Queue -------
function renderQueue() {
  queueList.innerHTML = '';
  queue.forEach((item,idx)=>{
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${item.label}</span>
      <button class="btn secondary small">Entfernen</button>
    `;
    li.querySelector('button').addEventListener('click', ()=>{
      queue.splice(idx,1);
      renderQueue();
    });
    queueList.appendChild(li);
  });
}

// ===== Lokaler Fallsimulator (Fallback, wenn Netlify down) =====
function buildLocalCase(spec, role, difficulty) {
  spec = (spec || 'internistisch').toLowerCase();
  role = role || 'RS';
  difficulty = difficulty || 'mittel';

  const cases = {
    internistisch: () => ({
      id: "rs_asthma_01",
      specialty: "internistisch",
      role,
      difficulty,
      story: "17-jähriger Patient auf dem Sportplatz mit akuter Atemnot nach Sprint. Sprechdyspnoe, 2-Wort-Sätze.",
      target_outcome: "AF und SpO₂ verbessern (O₂ + inhalatives β₂-Mimetikum), Transport vorbereiten.",
      key_findings: ["Dyspnoe", "verlängertes Exspirium", "Giemen", "Sprechdyspnoe"],
      red_flags: ["SpO₂ < 90 %", "Erschöpfung", "Silent chest"],
      vitals: { RR:"138/86", SpO2:85, AF:28, Puls:124, BZ:108, Temp:36.8, GCS:15 },
      scene_4s: {
        sicherheit: "Keine akute Eigen-/Fremdgefährdung, Sportplatz gesichert.",
        szene: "Sportplatz, Patient sitzt nach vorne gebeugt, stützt sich auf die Knie.",
        sichtung_personen: "1 Patient, Trainer und Mannschaftskameraden anwesend.",
        support_empfehlung: "NA bei fehlender Besserung unter Therapie oder klinischer Verschlechterung erwägen."
      },
      anamnesis: {
        SAMPLER: {
          S: "akute Atemnot nach Sprint, bekannte Asthma bronchiale",
          A: "Pollen, Hausstaub",
          M: "Bedarfs-Spray (β₂-Mimetikum), Controller unregelmäßig",
          P: "Asthma bronchiale seit Kindheit",
          L: "keine Krankenhausaufenthalte in letzter Zeit",
          E: "Belastung/Sport, Pollenflug, Inhalator vergessen",
          R: "keine Reise, kein Fieber"
        },
        vorerkrankungen: ["Asthma bronchiale"],
        medikation: ["β₂-Mimetikum Spray", "inhalatives Steroid (unregelmäßig)"],
        allergien: ["Pollen", "Hausstaub"],
        antikoagulation: false,
        OPQRST: {
          O: "plötzlich nach Sprint",
          P: "schlimmer bei Belastung, besser im Sitzen nach vorne gebeugt",
          Q: "Engegefühl in der Brust",
          R: "kein Ausstrahlen",
          S: "NRS 2–3, eher Luftnot als Schmerz",
          T: "seit ca. 10 Minuten zunehmend"
        }
      },
      hidden: {
        pupils: "isokor, mittelweit, prompt",
        mouth: "Mund-/Rachenraum frei, kein Stridor, kein Erbrochenes",
        lung: "Giemen beidseits, verlängertes Exspirium, keine Rasselgeräusche",
        abdomen: "weich, kein Abwehrspannungsbefund",
        skin: "rosig, leicht schweißig",
        ekg3: "Sinusrhythmus 110/min, keine ST-Hebungen",
        ekg12: "Sinusrhythmus, keine Ischämiezeichen",
        befast: "ohne Auffälligkeiten",
        lkw: "nicht relevant",
        pain: { nrs:2, ort:"thorakal, diffus", charakter:"Engegefühl/Pressen" },
        injuries: [],
        vitals_baseline: { RR:"130/80", SpO2:94, AF:18, Puls:98, BZ:108, Temp:36.8, GCS:15 }
      }
    }),

    neurologisch: () => ({
      id: "rs_hypoglyk_01",
      specialty: "neurologisch",
      role,
      difficulty,
      story: "65-jähriger Patient, zuhause aufgefunden, wirkt verwirrt und schwitzig. Angehörige berichten von Diabetes.",
      target_outcome: "Hypoglykämie erkennen, Glukosegabe, Bewusstseinslage und BZ im Verlauf dokumentieren.",
      key_findings: ["Vigilanzminderung", "kaltschweißig", "niedriger BZ", "Diabetesanamnese"],
      red_flags: ["Bewusstlosigkeit", "Krampfanfälle", "fehlende Besserung nach Glukose"],
      vitals: { RR:"146/88", SpO2:96, AF:18, Puls:96, BZ:42, Temp:36.4, GCS:13 },
      scene_4s: {
        sicherheit: "Wohnung, keine akute Gefährdungslage, Zugang frei.",
        szene: "Patient halb auf dem Sofa, reagiert verzögert, Wohnumgebung unauffällig.",
        sichtung_personen: "1 Patient, Ehepartner anwesend.",
        support_empfehlung: "NA/RTW ausreichend, bei Krampf oder fehlender Besserung ggf. NA nachfordern."
      },
      anamnesis: {
        SAMPLER: {
          S: "Verwirrtheit, Schwitzen, Schwäche",
          A: "keine bekannten Allergien",
          M: "Metformin, Insulin (unbekanntes Schema)",
          P: "Diabetes mellitus Typ 2, arterielle Hypertonie",
          L: "letzte KH-Aufnahme vor 2 Jahren wegen Pneumonie",
          E: "heute wenig gegessen, Insulin wie gewohnt gespritzt",
          R: "kein Trauma, kein Fieber"
        },
        vorerkrankungen: ["Diabetes mellitus Typ 2", "arterielle Hypertonie"],
        medikation: ["Metformin", "Insulin", "ACE-Hemmer"],
        allergien: [],
        antikoagulation: false,
        OPQRST: {}
      },
      hidden: {
        pupils: "isokor, mittelweit, prompt",
        mouth: "Mund-/Rachenraum frei",
        lung: "vesikuläres AG, keine Rasselgeräusche",
        abdomen: "weich, kein Druckschmerz",
        skin: "kaltschweißig, blass",
        ekg12: "Sinusrhythmus, keine akuten Ischämiezeichen",
        befast: "kein Paresen, keine Sprachstörung, keine Blickdeviation",
        lkw: "nicht relevant (kein LKW für Schlaganfall)",
        pain: { nrs:1, ort:"diffus", charakter:"Schwächegefühl" },
        injuries: [],
        vitals_baseline: { RR:"140/85", SpO2:97, AF:16, Puls:88, BZ:90, Temp:36.6, GCS:15 }
      }
    }),

    trauma: () => ({
      id: "rs_trauma_unterarm_01",
      specialty: "trauma",
      role,
      difficulty,
      story: "28-jährige Person, Sturz vom Fahrrad auf den ausgestreckten Arm. Schmerzen und Fehlstellung am Unterarm.",
      target_outcome: "Starke Blutung ausschließen, Schmerz und Fraktur versorgen, adäquaten Transport planen.",
      key_findings: ["lokaler Schmerz", "Fehlstellung", "Bewegungsschmerz", "intakte periphere Perfusion"],
      red_flags: ["starke Blutung", "neurovaskuläre Ausfälle", "Begleitverletzungen Kopf/Thorax"],
      vitals: { RR:"132/82", SpO2:98, AF:16, Puls:88, BZ:104, Temp:36.9, GCS:15 },
      scene_4s: {
        sicherheit: "Straßenrand, kein fließender Verkehr mehr, RTW schützt Unfallstelle.",
        szene: "Fahrrad neben Patient, Helm getragen, keine Fremdgefährdung.",
        sichtung_personen: "1 Patient, Passant als Ersthelfer.",
        support_empfehlung: "Bei Anzeichen Polytrauma / Instabilität NA nachfordern."
      },
      anamnesis: {
        SAMPLER: {
          S: "Schmerzen und Fehlstellung rechter Unterarm nach Sturz",
          A: "keine bekannten Allergien",
          M: "keine Dauermedikation",
          P: "keine bekannten Vorerkrankungen",
          L: "letzte Mahlzeit vor ca. 3 Stunden",
          E: "Sturz über Lenker, Landung auf ausgestrecktem Arm",
          R: "keine Risikofaktoren"
        },
        vorerkrankungen: [],
        medikation: [],
        allergien: [],
        antikoagulation: false,
        OPQRST: {}
      },
      hidden: {
        pupils: "isokor, mittelweit, prompt",
        mouth: "unauffällig",
        lung: "beidseits belüftet, kein Thoraxschmerz",
        abdomen: "weich, kein Druckschmerz",
        skin: "rosig, lokal Hämatom/Schwellung am Unterarm",
        ekg12: "Sinusrhythmus 80/min",
        befast: "unauffällig",
        lkw: "nicht relevant",
        pain: { nrs:6, ort:"rechter Unterarm", charakter:"stechend/ziehend" },
        injuries: ["Fehlstellung rechter Unterarm", "Schwellung, Druckschmerz"],
        vitals_baseline: { RR:"125/78", SpO2:99, AF:14, Puls:76, BZ:104, Temp:36.8, GCS:15 }
      }
    }),

    pädiatrisch: () => ({
      id: "rs_paed_bronchiolitis_01",
      specialty: "pädiatrisch",
      role,
      difficulty,
      story: "8 Monate alter Säugling mit Husten, Tachypnoe und Trinkschwäche. Eltern berichten von Fieber seit gestern.",
      target_outcome: "Schweregrad der Atemwegsinfektion einschätzen, ggf. O₂/Monitoring, zügiger Transport in Kinderklinik.",
      key_findings: ["Tachypnoe", "Einziehungen", "Giemen/Brummen", "Fieber", "Trinkschwäche"],
      red_flags: ["Atempausen", "Zyanose", "Erschöpfung", "SpO₂ < 92 %"],
      vitals: { RR:"110/70", SpO2:91, AF:48, Puls:168, BZ:92, Temp:38.5, GCS:14 },
      scene_4s: {
        sicherheit: "Wohnung, keine akute Fremd-/Eigengefährdung, Eltern anwesend.",
        szene: "Kind liegt auf dem Arm der Mutter, wirkt erschöpft, trinkt schlecht.",
        sichtung_personen: "1 Kind, Eltern anwesend.",
        support_empfehlung: "Bei respiratorischer Verschlechterung NA/ITW nachfordern."
      },
      anamnesis: {
        SAMPLER: {
          S: "Husten, schnelle Atmung, Trinkschwäche",
          A: "keine bekannten Allergien",
          M: "Paracetamol-Zäpfchen nach Bedarf",
          P: "gesund, reif geboren",
          L: "letzte Mahlzeit vor ca. 4 Stunden, trinkt weniger",
          E: "Infekt in der Familie, seit 1–2 Tagen Husten/Fieber",
          R: "kein Rauchen in der Wohnung"
        },
        vorerkrankungen: [],
        medikation: ["Paracetamol nach Bedarf"],
        allergien: [],
        antikoagulation: false,
        OPQRST: {}
      },
      hidden: {
        pupils: "isokor, prompt",
        mouth: "leichter Nasenausfluss, kein Stridor",
        lung: "Giemen/Brummen beidseits, verlängertes Exspirium, Einziehungen subcostal",
        abdomen: "weich, keine Abwehrspannung",
        skin: "leicht blass, Warm-feucht, keine Zyanose",
        ekg12: "Sinustachykardie altersentsprechend",
        befast: "nicht anwendbar (pädiatrischer Patient)",
        lkw: "nicht dokumentiert",
        pain: { nrs:null, ort:"—", charakter:"Unruhe/Weinen" },
        injuries: [],
        vitals_baseline: { RR:"100/60", SpO2:95, AF:32, Puls:140, BZ:92, Temp:37.5, GCS:15 }
      }
    })
  };

  const createCase = cases[spec] || cases.internistisch;
  const c = createCase();
  c.steps_done = c.steps_done || [];
  c.history    = c.history    || [];
  c.score      = typeof c.score === 'number' ? c.score : 0;
  return c;
}

// ===== Fallstart =====
async function startCase() {
  clearVisibleVitals();
  resetProgress();
  caseState = null;
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
    return;
  }

  clearVisibleVitals();
  setStatus(`Fall aktiv (${caseState.specialty || selectedSpec})`);
  setScore(caseState.score ?? 0);
  renderProgress(caseState.steps_done || []);
  showHint('Starte mit X und arbeite dich nach XABCDE durch.');
  addMsg(`<strong>Fallstart${usedFallback ? ' (lokal)' : ''}:</strong> ${caseState?.story || '—'}`);
}

// ===== Schritt ausführen =====
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
      ${data.evaluation ? `<div>${String(data.evaluation).replace(/\n/g,'<br>')}</div>` : ''}
      ${data.finding ? `<div class="small">${String(data.finding).replace(/\n/g,'<br>')}</div>` : ''}
      ${vitalsMini}
      ${data.next_hint ? `<div class="small">💡 ${String(data.next_hint).replace(/\n/g,'<br>')}</div>` : ''}
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

// Vereinfachte AF-Erhebung: kein 30s-Zähler mehr
function openAFCounter(){
  // vereinfachte Version: AF einmal messen ohne 30-Sekunden-Zähler
  if (!caseState) return;
  stepCase('AF messen');
}

// ---- BE-FAST ----
function openBEFAST(){
  const infoBox = document.getElementById('befastInfo');
  const fetchBtn = document.getElementById('befastFetch');
  if (fetchBtn) fetchBtn.onclick = async ()=>{
    const res = await fetch(API_CASE_STEP, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ case_state: caseState, user_action: 'BEFAST Info', role: caseState?.role || 'RS' })
    });
    const data = await res.json();
    infoBox.textContent = data.finding || data.evaluation || 'Keine neurologischen Hinweise.';
  };

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
  if (infoBox) infoBox.textContent = '';

  // Eingabefelder leeren
  ['s_sympt','s_allerg','s_med','s_hist','s_last','s_events','s_risk'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // Infos aus dem Fall holen und Felder vorbefüllen
  const fetchBtn = document.getElementById('samplerFetch');
  if (fetchBtn) {
    fetchBtn.onclick = async ()=>{
      if (!caseState) return;
      await stepCase('SAMPLER Info');
      const a = caseState.anamnesis || {};
      const S = a.SAMPLER || {};
      const m = (id, val)=>{ const el = document.getElementById(id); if (el && val) el.value = val; };
      m('s_sympt',  S.S || '');
      m('s_allerg', S.A || '');
      m('s_med',    S.M || '');
      m('s_hist',   S.P || '');
      m('s_last',   S.L || '');
      m('s_events', S.E || '');
      m('s_risk',   S.R || '');
    };
  }

  const okBtn = document.getElementById('samplerOk');
  if (okBtn) {
    okBtn.onclick = ()=>{
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
      Object.entries(data).forEach(([k,v])=>{ if (v) parts.push(`${k}:${v}`); });
      const msg = parts.length ? `SAMPLER dokumentiert (${parts.join(' | ')})` : 'SAMPLER dokumentiert';
      stepCase(msg);
      closeModal('modalSampler');
    };
  }

  const cancelBtn = document.getElementById('samplerCancel');
  if (cancelBtn) cancelBtn.onclick = ()=> closeModal('modalSampler');

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
    infoBox.textContent = data.finding || data.evaluation || 'Keine zusätzlichen Hinweise.';
  }, { once:true });

  document.getElementById('s4Ok').onclick = ()=>{
    const parts=[];
    if(document.getElementById('s1').checked) parts.push('Sicherheit');
    if(document.getElementById('s2').checked) parts.push('Szene');
    if(document.getElementById('s3').checked) parts.push('Sichtung');
    if(document.getElementById('s4').checked) parts.push('Support');
    const msg = parts.length ? `4S dokumentiert (${parts.join(', ')})` : '4S dokumentiert';
    stepCase(msg);
    closeModal('modal4S');
  };
  document.getElementById('s4Cancel').onclick = ()=> closeModal('modal4S');
  openModal('modal4S');
}

// ---- NRS ----
function openNRS(){
  const range = document.getElementById('nrsRange');
  const val   = document.getElementById('nrsVal');
  const info  = document.getElementById('nrsInfo');
  if (!range || !val) return;
  range.value = '0'; val.textContent = '0'; info.textContent = '';

  document.getElementById('nrsFetch')?.addEventListener('click', async ()=>{
    const res = await fetch(API_CASE_STEP, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ case_state: caseState, user_action: 'Schmerz Info', role: caseState?.role || 'RS' })
    });
    const data = await res.json();
    info.textContent = data.finding || data.evaluation || 'Keine zusätzlichen Infos.';
  }, { once:true });

  range.oninput = ()=>{ val.textContent = range.value; };
  document.getElementById('nrsOk').onclick = ()=>{
    const n = Number(range.value||0);
    stepCase(`NRS ${n}`);
    closeModal('modalNRS');
  };
  document.getElementById('nrsCancel').onclick = ()=> closeModal('modalNRS');
  openModal('modalNRS');
}

// ---- Diagnose & Transport ----
const DX_BY_SPEC = {
  internistisch: ['ACS','Asthma/Bronchialobstruktion','COPD-Exazerbation','Lungenembolie','Sepsis','Metabolische Entgleisung'],
  neurologisch:  ['Schlaganfall','Krampfanfall','Hypoglykämie','Bewusstlosigkeit unklarer Genese'],
  trauma:        ['Polytrauma','Schädel-Hirn-Trauma','Thoraxtrauma','Fraktur/Blutung'],
  pädiatrisch:   ['Fieberkrampf','Asthmaanfall','Dehydratation','Trauma Kind']
};

function openDiagnosis(){
  const dxSpec = $id('dxSpec');
  const dxSel  = $id('dxSelect');
  const fill = ()=>{
    const list = DX_BY_SPEC[dxSpec.value] || [];
    dxSel.innerHTML = list.map(x=>`<option>${x}</option>`).join('') + '<option>Andere (Kommentar)</option>';
  };
  dxSpec.value = selectedSpec; fill();
  dxSpec.onchange = fill;

  $id('dxOk').onclick = ()=>{
    const txt  = dxSel.value;
    const prio = $id('dxPrio').value;
    const note = ($id('dxNote').value || '').trim();
    const parts = [`Verdachtsdiagnose: ${txt}`, `Priorität: ${prio}`];
    if (note) parts.push(`Kommentar: ${note}`);
    const msg = parts.join(' | ');
    stepCase(`Verdachtsdiagnose: ${msg}`);
    closeModal('modalDx');
  };
  $id('dxCancel').onclick = ()=> closeModal('modalDx');
  openModal('modalDx');
}

// ---- Debriefing ----
async function openDebrief() {
  // Hilfsfunktion: Rohtext in hübsche Liste mit Labels umwandeln
  function formatDebrief(raw) {
    if (!raw) return '';
    const lines = String(raw).split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return '';

    const items = lines.map(line => {
      const [label, ...restParts] = line.split(':');
      if (restParts.length) {
        const rest = restParts.join(':').trim();
        return `<li><span class="debrief-label">${label}:</span> <span class="debrief-value">${rest}</span></li>`;
      }
      return `<li>${line}</li>`;
    }).join('');

    return `<ul class="debrief-list small">${items}</ul>`;
  }

  // 1) Versuche zuerst, ein Debrief vom Backend zu bekommen
  try {
    const res = await fetch(API_CASE_STEP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        case_state: caseState,
        user_action: 'Debriefing',
        role: caseState?.role || 'RS'
      })
    });

    if (res.ok) {
      const data = await res.json();
      const raw = data.debrief || data.evaluation || data.finding;
      if (raw) {
        const html = formatDebrief(raw);
        addMsg(`<strong>Debriefing</strong>${html}`);
        return;
      }
    }
  } catch (e) {
    console.warn('Debriefing vom Backend nicht verfügbar, nutze lokalen Fallback.', e);
  }

  // 2) Fallback: Lokale Auswertung (Score, Schritte, Vitals)
  const steps  = (caseState?.steps_done || []).join(' → ') || '–';
  const vitals = Object.entries(visibleVitals)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ') || 'keine erhoben';
  const score  = caseState?.score ?? 0;

  const fallbackText = [
    `XABCDE-Fortschritt: ${steps}`,
    `Vitals erhoben: ${vitals}`,
    `Score: ${score}`
  ].join('\n');

  const html = formatDebrief(fallbackText);
  addMsg(`<strong>Debriefing (lokal)</strong>${html}`);
}

// ===== Queue-Buttons =====
runBtn.addEventListener('click', async ()=>{
  if (!caseState || !queue.length) return;
  runBtn.disabled = clearBtn.disabled = true;
  try{
    while (queue.length) {
      const { token } = queue.shift();
      renderQueue();
      await stepCase(token);
      await new Promise(r=>setTimeout(r,120));
    }
  }finally{
    runBtn.disabled = clearBtn.disabled = false;
  }
});
clearBtn.addEventListener('click', ()=>{ queue.length=0; renderQueue(); });

// ===== Setup-Buttons =====
startBtn.addEventListener('click', startCase);
finishBtn.addEventListener('click', ()=>{ if(caseState) stepCase('Fall beenden'); });

// Initialzustand
clearVisibleVitals();
setStatus('Kein Fall aktiv.');
setScore(0);
resetProgress();
showHint('—');
renderPanel('X');
addMsg('👋 Wähle oben die Fachrichtung, starte den Fall, nutze XABCDE und die Schemata. Gemessene Vitalwerte bleiben sichtbar; Maßnahmen verändern den Verlauf.');
