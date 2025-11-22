// ===============================================================
// medicIQ – Fallbeispiele (Click-UI, nur Buttons)
// - XABCDE als Tabs
// - Schemata: 4S, SAMPLER, BE-FAST, NRS, Verdachtsdiagnose, Debrief
// - Vitalwerte werden erst nach Messung angezeigt
// - AF: einfache Messung (kein 30-Sekunden-Zähler)
// ===============================================================

const API_CASE_NEW  = '/.netlify/functions/case-new';
const API_CASE_STEP = '/.netlify/functions/case-step';

// ------- UI Elemente -------
const statusEl   = document.getElementById('caseStatus');
const scoreEl    = document.getElementById('caseScore');
const chatLog    = document.getElementById('chatLog');
const queueList  = document.getElementById('queueList');
const runBtn     = document.getElementById('btnRunQueue');
const clearBtn   = document.getElementById('btnClearQueue');
const startBtn   = document.getElementById('startCase');
const finishBtn  = document.getElementById('finishCase');
const roleSel    = document.getElementById('roleSel');

const chips      = Array.from(document.querySelectorAll('.chip'));
const tabs       = Array.from(document.querySelectorAll('.tab'));
const panel      = document.getElementById('panel');
const hintCard   = document.getElementById('hintCard');
const hintText   = document.getElementById('hintText');

const specButtons = Array.from(document.querySelectorAll('.spec-chip'));
let selectedSpec = 'internistisch';

specButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    specButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedSpec = btn.dataset.spec || 'internistisch';
  });
});

// Schemata / Tools
document.querySelectorAll('.schema-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool;
    if (tool === 'AF_SIMPLE') {
      // einfache AF-Messung ohne Zähler
      stepCase('AF messen');
    } else if (tool === 'FOUR_S') {
      openFourS();
    } else if (tool === 'SAMPLER') {
      openSampler();
    } else if (tool === 'BEFAST') {
      openBEFAST();
    } else if (tool === 'NRS') {
      openNRS();
    } else if (tool === 'DIAGNOSIS') {
      openDiagnosis();
    } else if (tool === 'DEBRIEF') {
      openDebrief();
    }
  });
});

// Vital-Anzeige
const vitalsMap = {
  RR:   document.getElementById('vRR'),
  SpO2: document.getElementById('vSpO2'),
  AF:   document.getElementById('vAF'),
  Puls: document.getElementById('vPuls'),
  BZ:   document.getElementById('vBZ'),
  Temp: document.getElementById('vTemp'),
  GCS:  document.getElementById('vGCS')
};
const visibleVitals   = {};
const monitorEnabled  = { RR:false, SpO2:false, AF:false, Puls:false, BZ:false, Temp:false, GCS:false };
let   caseState       = null;

function renderVitalsFromVisible() {
  Object.values(vitalsMap).forEach(el => { el.textContent = '–'; });
  for (const [k, v] of Object.entries(visibleVitals)) {
    if (v != null && vitalsMap[k]) vitalsMap[k].textContent = v;
  }
}
function clearVisibleVitals() {
  for (const k in visibleVitals) delete visibleVitals[k];
  for (const k in monitorEnabled) monitorEnabled[k] = false;
  renderVitalsFromVisible();
}
function markMonitor(keys) {
  keys.forEach(k => {
    if (Object.prototype.hasOwnProperty.call(monitorEnabled, k)) monitorEnabled[k] = true;
  });
}

// kleine Dynamik: nähert Messwerte den Fallvitalen an
function vitalMonitorTick() {
  if (!caseState) return;
  const target = caseState.vitals || {};

  // RR
  if (monitorEnabled.RR && (visibleVitals.RR || target.RR)) {
    const curStr = String(visibleVitals.RR || target.RR);
    const tgtStr = String(target.RR || curStr);
    const c = curStr.split('/');
    const t = tgtStr.split('/');
    if (c.length === 2 && t.length === 2) {
      let cSys = parseInt(c[0], 10);
      let cDia = parseInt(c[1], 10);
      const tSys = parseInt(t[0], 10);
      const tDia = parseInt(t[1], 10);
      if (!isNaN(cSys) && !isNaN(tSys)) {
        if (cSys < tSys) cSys += 2;
        else if (cSys > tSys) cSys -= 2;
      }
      if (!isNaN(cDia) && !isNaN(tDia)) {
        if (cDia < tDia) cDia += 2;
        else if (cDia > tDia) cDia -= 2;
      }
      visibleVitals.RR = cSys + '/' + cDia;
    }
  }

  ['SpO2','AF','Puls','BZ','Temp','GCS'].forEach(k => {
    if (!monitorEnabled[k]) return;
    const cur = Number(visibleVitals[k] ?? target[k]);
    const tgt = Number(target[k] ?? cur);
    if (!isFinite(cur) || !isFinite(tgt)) return;
    let next = cur;
    const diff = tgt - cur;
    if (Math.abs(diff) > 1) {
      next = cur + Math.sign(diff) * Math.max(1, Math.round(Math.abs(diff)/3));
    } else if (Math.random() < 0.3) {
      next = cur + (Math.random() < 0.5 ? -1 : 1);
    }
    visibleVitals[k] = Math.round(next * 10) / 10;
  });

  renderVitalsFromVisible();
}
setInterval(vitalMonitorTick, 5000);

// ------- Helfer fürs UI -------
function setStatus(t) { statusEl.textContent = t; }
function setScore(n)  { scoreEl.textContent  = 'Score: ' + (n ?? 0); }

function addMsg(html) {
  const el = document.createElement('div');
  el.className = 'msg';
  el.innerHTML = html;
  chatLog.appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });
}
function showHint(t) {
  if (t && t.trim()) {
    hintText.textContent = t;
    hintCard.classList.remove('hidden');
  } else {
    hintText.textContent = '—';
    hintCard.classList.add('hidden');
  }
}

function resetProgress() { chips.forEach(c => c.classList.remove('done','active')); }
function renderProgress(steps) {
  steps = Array.isArray(steps) ? steps : [];
  resetProgress();
  const done = new Set(steps.map(s => String(s).toUpperCase()));
  const order = ['X','A','B','C','D','E'];
  order.forEach(step => {
    const el = chips.find(c => c.dataset.step === step);
    if (!el) return;
    if ([...done].some(s => s.startsWith(step))) el.classList.add('done');
  });
  const next = order.find(step => ![...done].some(s => s.startsWith(step)));
  const activeEl = chips.find(c => c.dataset.step === next);
  if (activeEl) activeEl.classList.add('active');
}

// ------- Maßnahmen-Panel (XABCDE) -------
const ACTIONS = {
  X: [
    { label: 'Druckverband',           token: 'Druckverband' },
    { label: 'Hämostyptikum',          token: 'Hämostyptikum' },
    { label: 'Tourniquet',             token: 'Tourniquet' },
    { label: 'Beckenschlinge',         token: 'Beckenschlinge' }
  ],
  A: [
    { label: 'Esmarch',                token: 'Esmarch' },
    { label: 'Absaugen',               token: 'Absaugen' },
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
    { label: 'Oberkörper hoch lagern', token: 'Oberkörper hoch lagern' }
  ]
};

function renderPanel(tab) {
  panel.innerHTML = '';
  const list = ACTIONS[tab] || [];
  list.forEach((a) => {
    const btn = document.createElement('button');
    btn.className = 'action-card';
    btn.innerHTML = `<div class="label">${a.label}</div>`;
    btn.addEventListener('click', () => {
      queue.push({ label: a.label, token: a.token });
      renderQueue();
    });
    panel.appendChild(btn);
  });
}
tabs.forEach(t => t.addEventListener('click', () => renderPanel(t.dataset.tab)));

// ------- Queue -------
const queue = [];
function renderQueue() {
  queueList.innerHTML = '';
  queue.forEach((item, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${item.label}</span>
      <button class="btn secondary small">Entfernen</button>
    `;
    li.querySelector('button').addEventListener('click', () => {
      queue.splice(idx, 1);
      renderQueue();
    });
    queueList.appendChild(li);
  });
}

// ------- Fallback-Fallsimulator (wenn case-new nicht erreichbar) -------
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
      vitals: { RR: "138/86", SpO2: 85, AF: 28, Puls: 124, BZ: 108, Temp: 36.8, GCS: 15 },
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
        pain: { nrs: 2, ort: "thorakal, diffus", charakter: "Engegefühl/Pressen" },
        injuries: [],
        vitals_baseline: { RR: "130/80", SpO2: 94, AF: 18, Puls: 98, BZ: 108, Temp: 36.8, GCS: 15 }
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
      vitals: { RR: "146/88", SpO2: 96, AF: 18, Puls: 96, BZ: 42, Temp: 36.4, GCS: 13 },
      scene_4s: {
        sicherheit: "Wohnung, keine akute Gefährdungslage, Zugang frei.",
        szene: "Patient halb auf dem Sofa, reagiert verzögert, Wohnumgebung unauffällig.",
        sichtung_personen: "1 Patient, Ehepartner anwesend.",
        support_empfehlung: "NA bei Bewusstlosigkeit oder fehlender Besserung nach Therapie."
      },
      anamnesis: {
        SAMPLER: {
          S: "Verwirrtheit, Zittern, Schwitzen",
          A: "keine bekannt",
          M: "Insulin, Metformin, Blutdruckmedikamente",
          P: "Diabetes mellitus Typ 2, Hypertonie",
          L: "abends wenig gegessen, morgens keine Mahlzeit",
          E: "Mahlzeit ausgelassen, Insulin dennoch gespritzt",
          R: "keine Reise, keine Infektsymptome"
        },
        vorerkrankungen: ["Diabetes mellitus Typ 2", "arterielle Hypertonie"],
        medikation: ["Basalinsulin", "Metformin", "ACE-Hemmer"],
        allergien: [],
        antikoagulation: false,
        OPQRST: {
          O: "seit ca. 30 Minuten zunehmende Verwirrtheit",
          P: "keine klare Provokation außer Nahrungsverzicht",
          Q: "kein Schmerz, eher Schwächegefühl",
          R: "-",
          S: "-",
          T: "progredient über 30–60 Minuten"
        }
      },
      hidden: {
        pupils: "isokor, mittelweit, prompt",
        mouth: "Mund-/Rachenraum frei",
        lung: "vesikuläres Atemgeräusch beidseits, keine RG",
        abdomen: "weich, kein Druckschmerz",
        skin: "kaltschweißig, leicht blass",
        ekg3: "Sinusrhythmus 90/min, einzelne supraventrikuläre Extrasystolen",
        ekg12: "Sinusrhythmus, keine akuten Ischämiezeichen",
        befast: "ohne fokal-neurologische Ausfälle",
        lkw: "kein Schlaganfallverdacht, daher nicht relevant",
        pain: { nrs: 0, ort: "kein Schmerz", charakter: "-" },
        injuries: [],
        vitals_baseline: { RR: "140/80", SpO2: 97, AF: 16, Puls: 82, BZ: 120, Temp: 36.6, GCS: 15 }
      }
    }),

    trauma: () => ({
      id: "rs_trauma_unterarm_01",
      specialty: "trauma",
      role,
      difficulty,
      story: "29-jährige Patientin stürzt beim Fahrradfahren, fängt sich mit dem rechten Arm ab. Deformität und Schmerzen am Unterarm.",
      target_outcome: "Blutungskontrolle, adäquate Immobilisation, Schmerztherapie einleiten, Traumaschema anwenden.",
      key_findings: ["deformierter Unterarm", "Druckschmerz", "Schwellung", "Bewegungsschmerz"],
      red_flags: ["starke Blutung", "neurologische Ausfälle der Hand", "weitere Verletzungen übersehen"],
      vitals: { RR: "132/84", SpO2: 98, AF: 18, Puls: 88, BZ: 102, Temp: 36.7, GCS: 15 },
      scene_4s: {
        sicherheit: "Straße gesichert, kein laufender Verkehr mehr, Helm vorhanden.",
        szene: "Fahrradsturz, Patientin sitzt am Gehweg, Fahrrad daneben.",
        sichtung_personen: "1 Patientin, Zeuge vor Ort.",
        support_empfehlung: "NA nur bei zusätzlicher Kopfverletzung, Polytrauma oder Schockzeichen."
      },
      anamnesis: {
        SAMPLER: {
          S: "starke Schmerzen rechter Unterarm",
          A: "keine bekannt",
          M: "keine Dauermedikation",
          P: "keine relevanten Vorerkrankungen",
          L: "keine OPs / Krankenhausaufenthalte",
          E: "Fahrradsturz, Sturz auf ausgestreckten Arm",
          R: "keine Reise, kein Infekt"
        },
        vorerkrankungen: [],
        medikation: [],
        allergien: [],
        antikoagulation: false,
        OPQRST: {
          O: "sofort nach Sturz",
          P: "Bewegung / Belastung verschlechtert, Schienen / Ruhigstellung bessert",
          Q: "stechender, lokaler Schmerz",
          R: "kein Ausstrahlen",
          S: "NRS 7–8",
          T: "konstant seit Sturz"
        }
      },
      hidden: {
        pupils: "isokor, mittelweit, prompt",
        mouth: "Mund-/Rachenraum frei",
        lung: "vesikulär beidseits, keine RG",
        abdomen: "weich, kein Druckschmerz",
        skin: "Schürfwunden am rechten Unterarm, Hämatom, keine große offene Wunde",
        ekg3: "Sinusrhythmus 85/min",
        ekg12: "Sinus, keine Auffälligkeiten",
        befast: "ohne Auffälligkeiten",
        lkw: "nicht relevant",
        pain: { nrs: 8, ort: "rechter Unterarm", charakter: "stechend, pulsierend" },
        injuries: ["vermutete distale Unterarmfraktur rechts"],
        vitals_baseline: { RR: "128/78", SpO2: 98, AF: 16, Puls: 80, BZ: 102, Temp: 36.7, GCS: 15 }
      }
    }),

    pädiatrisch: () => ({
      id: "rs_paed_bronchiolitis_01",
      specialty: "pädiatrisch",
      role,
      difficulty,
      story: "9 Monate alter Säugling mit Husten und erschwerter Atmung seit gestern, heute deutliche Verschlechterung.",
      target_outcome: "Respiratorische Situation einschätzen, Oxygenierung verbessern, Transport mit Monitoring in Kinderklinik.",
      key_findings: ["Tachypnoe", "Einziehungen", "Nasenflügeln", "geringe Trinkmenge", "Fieber"],
      red_flags: ["Apnoen", "Zyanose", "Erschöpfung", "SpO₂ < 92 % trotz O₂"],
      vitals: { RR: "110/70", SpO2: 90, AF: 42, Puls: 168, BZ: 96, Temp: 38.7, GCS: 15 },
      scene_4s: {
        sicherheit: "Wohnung, keine akute Gefährdung. Eltern anwesend.",
        szene: "Kind liegt im Bettchen, wirkt erschöpft, atmet schnell.",
        sichtung_personen: "1 Kind, Eltern anwesend.",
        support_empfehlung: "NA / Kinderarzt bei drohender respiratorischer Erschöpfung oder Apnoen."
      },
      anamnesis: {
        SAMPLER: {
          S: "Husten, schnelle Atmung, trinkt schlecht",
          A: "keine bekannt",
          M: "Fiebersaft heute Morgen",
          P: "Frühgeboren 36+0, sonst unauffällig",
          L: "keine Krankenhausaufenthalte",
          E: "seit 2 Tagen Husten und Schnupfen, seit heute deutlich schlechter",
          R: "kein Auslandsaufenthalt, Kontakt zu erkälteten Geschwistern"
        },
        vorerkrankungen: ["Frühgeburt 36+0"],
        medikation: ["Paracetamol-Saft nach Bedarf"],
        allergien: [],
        antikoagulation: false,
        OPQRST: {
          O: "schleichender Beginn vor 2 Tagen",
          P: "Lagewechsel kaum Einfluss, Sitzen auf dem Arm bessert etwas",
          Q: "kein Schmerz, eher Luftnot/Unruhe",
          R: "-",
          S: "-",
          T: "progredient"
        }
      },
      hidden: {
        pupils: "isokor, altersentsprechend, prompt",
        mouth: "Nasen-Rachenraum mit klarem Sekret, kein Stridor",
        lung: "beidseits giemende und pfeifende Atemgeräusche, verlängertes Exspirium, leichte Einziehungen",
        abdomen: "weich, kein Druckschmerz",
        skin: "leicht febril, etwas blass, periphere Zyanose bei Belastung",
        ekg3: "Sinusrhythmus, altersentsprechende HF",
        ekg12: "nicht routinemäßig abgeleitet; kein Hinweis auf kardiale Problematik",
        befast: "nicht relevant",
        lkw: "nicht relevant",
        pain: { nrs: 3, ort: "unklar (Kind kann es nicht äußern)", charakter: "Unruhe, Quengeln" },
        injuries: [],
        vitals_baseline: { RR: "105/65", SpO2: 95, AF: 32, Puls: 150, BZ: 96, Temp: 37.8, GCS: 15 }
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

// ------- Fall starten -------
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
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        specialty: selectedSpec,
        role: roleSel?.value || 'RS',
        difficulty: 'mittel'
      })
    });

    if (!res.ok) throw new Error('Status ' + res.status);
    const data = await res.json();
    if (!data || data.error) throw new Error(data?.error || 'Ungültige Antwort.');

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
  setStatus(`Fall aktiv (${selectedSpec})`);
  setScore(caseState.score);
  renderProgress(caseState.steps_done);
  showHint('Starte mit X und arbeite dich nach XABCDE durch.');

  addMsg(`<strong>Fallstart${usedFallback ? ' (lokal)' : ''}:</strong> ${caseState.story || '—'}`);
}

// ------- Schritt ausführen -------
async function stepCase(phrase) {
  if (!caseState) return;
  try {
    const res = await fetch(API_CASE_STEP, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({
        case_state: caseState,
        user_action: phrase,
        role: caseState.role || roleSel?.value || 'RS'
      })
    });
    const data = await res.json();

    // Vitals aktualisieren
    if (data.updated_vitals) {
      Object.entries(data.updated_vitals).forEach(([k,v]) => {
        visibleVitals[k] = v;
      });
      markMonitor(Object.keys(data.updated_vitals));
      renderVitalsFromVisible();
    }

    // Chat-Ausgabe
    const badges = [];
    if (data.accepted)      badges.push('✓ akzeptiert');
    if (data.outside_scope) badges.push('⚠ außerhalb Kompetenz');
    if (data.unsafe)        badges.push('⛔ unsicher');

    let vitalsMini = '';
    if (data.updated_vitals && Object.keys(data.updated_vitals).length) {
      const parts = Object.entries(data.updated_vitals).map(([k,v]) => `${k}: <b>${v}</b>`);
      vitalsMini = `<div class="small">🔎 ${parts.join(' · ')}</div>`;
    }

    addMsg(`
      <div><strong>Aktion:</strong> ${phrase}</div>
      ${badges.length ? `<div class="small">${badges.join(' · ')}</div>` : ''}
      ${data.evaluation ? `<div>${String(data.evaluation).replace(/\n/g,'<br>')}</div>` : ''}
      ${data.finding ? `<div class="small">${String(data.finding).replace(/\n/g,'<br>')}</div>` : ''}
      ${vitalsMini}
      ${data.next_hint ? `<div class="small">💡 ${data.next_hint}</div>` : ''}
    `);

    caseState = data.case_state || caseState;
    setScore(caseState.score);
    renderProgress(caseState.steps_done);
    showHint(data.next_hint || '');

    if (data.done) {
      setStatus('Fall abgeschlossen.');
      showHint('—');
      caseState = null;
    }
  } catch (e) {
    addMsg(`<div class="small">⚠️ Fehler bei Schritt: ${e.message}</div>`);
  }
}

// ------- Debriefing -------
async function openDebrief() {
  if (!caseState) {
    addMsg('<div class="small">Kein aktiver Fall für Debriefing.</div>');
    return;
  }
  try {
    const res = await fetch(API_CASE_STEP, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ case_state: caseState, user_action:'Debriefing', role: caseState.role || 'RS' })
    });
    const data = await res.json();
    if (data.debrief || data.evaluation) {
      addMsg(`<strong>Debriefing</strong><div class="small">${String(data.debrief || data.evaluation).replace(/\n/g,'<br>')}</div>`);
      caseState = data.case_state || caseState;
      setScore(caseState.score);
      return;
    }
  } catch (e) {
    addMsg(`<div class="small">⚠️ Debriefing nicht abrufbar (${e.message}).</div>`);
  }
}

// ------- Diagnose & Transport -------
function $id(id){ return document.getElementById(id); }

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
    dxSel.innerHTML = list.map(x => `<option>${x}</option>`).join('') +
      '<option>Andere (Kommentar)</option>';
  };
  dxSpec.value = selectedSpec;
  fill();
  dxSpec.onchange = fill;

  $id('dxOk').onclick = () => {
    const txt  = dxSel.value;
    const prio = $id('dxPrio').value;
    const note = ($id('dxNote').value || '').trim();
    const parts = [`Verdachtsdiagnose: ${txt}`, `Priorität: ${prio}`];
    if (note) parts.push(`Kommentar: ${note}`);
    const msg = parts.join(' | ');
    stepCase(`Verdachtsdiagnose: ${msg}`);
    closeModal('modalDx');
  };
  $id('dxCancel').onclick = () => closeModal('modalDx');
  openModal('modalDx');
}

// ------- 4S -------
async function openFourS() {
  const info = document.getElementById('s4Info');
  info.textContent = '';
  document.getElementById('s1').checked = false;
  document.getElementById('s2').checked = false;
  document.getElementById('s3').checked = false;
  document.getElementById('s4').checked = false;

  document.getElementById('s4Fetch').onclick = async () => {
    if (!caseState) return;
    const res = await fetch(API_CASE_STEP, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ case_state: caseState, user_action:'4S Info', role: caseState.role || 'RS' })
    });
    const data = await res.json();
    info.textContent = data.evaluation || data.finding || '';
  };

  document.getElementById('s4Ok').onclick = () => {
    const parts = [];
    if (document.getElementById('s1').checked) parts.push('Sicherheit');
    if (document.getElementById('s2').checked) parts.push('Szene');
    if (document.getElementById('s3').checked) parts.push('Sichtung');
    if (document.getElementById('s4').checked) parts.push('Support');
    const msg = parts.length ? `4S dokumentiert (${parts.join(', ')})` : '4S dokumentiert';
    stepCase(msg);
    closeModal('modal4S');
  };
  document.getElementById('s4Cancel').onclick = () => closeModal('modal4S');
  openModal('modal4S');
}

// ------- BE-FAST -------
function openBEFAST() {
  const info = document.getElementById('befastInfo');
  info.textContent = '';
  ['b_balance','e_eyes','f_face','a_arm','s_speech'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
  document.getElementById('t_time').value = '';

  document.getElementById('befastFetch').onclick = async () => {
    if (!caseState) return;
    const res = await fetch(API_CASE_STEP, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ case_state: caseState, user_action:'BEFAST Info', role: caseState.role || 'RS' })
    });
    const data = await res.json();
    info.textContent = data.evaluation || data.finding || '';
  };

  document.getElementById('befastOk').onclick = () => {
    const data = {
      B: document.getElementById('b_balance').checked,
      E: document.getElementById('e_eyes').checked,
      F: document.getElementById('f_face').checked,
      A: document.getElementById('a_arm').checked,
      S: document.getElementById('s_speech').checked,
      T: document.getElementById('t_time').value || ''
    };
    const parts = [];
    if (data.B) parts.push('Balance');
    if (data.E) parts.push('Eyes');
    if (data.F) parts.push('Face');
    if (data.A) parts.push('Arm');
    if (data.S) parts.push('Speech');
    const msg = `BEFAST: ${parts.join(', ') || 'unauffällig'}${data.T ? ' | LKW: ' + data.T : ''}`;
    stepCase(msg);
    closeModal('modalBEFAST');
  };
  document.getElementById('befastCancel').onclick = () => closeModal('modalBEFAST');
  openModal('modalBEFAST');
}

// ------- SAMPLER -------
function openSampler() {
  const info = document.getElementById('samplerInfo');
  info.textContent = '';
  ['s_sympt','s_allerg','s_meds','s_hist','s_last','s_events','s_risk'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  document.getElementById('samplerFetch').onclick = async () => {
    if (!caseState) return;
    const res = await fetch(API_CASE_STEP, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ case_state: caseState, user_action:'SAMPLER Info', role: caseState.role || 'RS' })
    });
    const data = await res.json();
    info.textContent = data.evaluation || data.finding || '';
  };

  document.getElementById('samplerOk').onclick = () => {
    const data = {
      S: document.getElementById('s_sympt').value || '',
      A: document.getElementById('s_allerg').value || '',
      M: document.getElementById('s_meds').value || '',
      P: document.getElementById('s_hist').value || '',
      L: document.getElementById('s_last').value || '',
      E: document.getElementById('s_events').value || '',
      R: document.getElementById('s_risk').value || ''
    };
    const parts = [];
    Object.entries(data).forEach(([k,v]) => { if (v) parts.push(`${k}:${v}`); });
    const msg = parts.length ? `SAMPLER dokumentiert (${parts.join(' | ')})` : 'SAMPLER dokumentiert';
    stepCase(msg);
    closeModal('modalSampler');
  };

  document.getElementById('samplerCancel').onclick = () => closeModal('modalSampler');
  openModal('modalSampler');
}

// ------- NRS / Schmerzskala -------
function openNRS() {
  const range = document.getElementById('nrsRange');
  const val   = document.getElementById('nrsVal');
  const info  = document.getElementById('nrsInfo');
  if (!range || !val) return;

  range.value = '0';
  val.textContent = '0';
  info.textContent = '';

  range.oninput = () => { val.textContent = range.value; };

  document.getElementById('nrsFetch').onclick = async () => {
    if (!caseState) return;
    const res = await fetch(API_CASE_STEP, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ case_state: caseState, user_action:'Schmerz Info', role: caseState.role || 'RS' })
    });
    const data = await res.json();
    info.textContent = data.evaluation || data.finding || '';
  };

  document.getElementById('nrsOk').onclick = () => {
    const n = Number(range.value || 0);
    stepCase(`NRS ${n}`);
    closeModal('modalNRS');
  };
  document.getElementById('nrsCancel').onclick = () => closeModal('modalNRS');
  openModal('modalNRS');
}

// ------- Modals -------
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

// ------- Queue-Steuerung / Buttons -------
runBtn.addEventListener('click', async () => {
  if (!caseState || !queue.length) return;
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
});

clearBtn.addEventListener('click', () => {
  queue.length = 0;
  renderQueue();
});

startBtn.addEventListener('click', startCase);
finishBtn.addEventListener('click', () => {
  if (caseState) stepCase('Fall beenden');
});

// ------- Initiale UI -------
clearVisibleVitals();
setStatus('Kein Fall aktiv.');
setScore(0);
resetProgress();
showHint('—');
renderPanel('X');
addMsg('👋 Wähle oben die Fachrichtung, starte den Fall, nutze die Button-Leiste für XABCDE und die Schemata unten. Gemessene Werte bleiben sichtbar; Maßnahmen passen die Vitalwerte an.');
