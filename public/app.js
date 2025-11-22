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
    { label: 'BMV', token: 'Beutel-Masken-Beatmung' }
  ],
  B: [
    { label: 'AF zählen (30s)', token: 'AF zählen' },
    { label: 'AF messen', token: 'AF messen' },
    { label: 'SpO2 messen', token: 'SpO2 messen' },
    { label: 'Lunge auskultieren', token: 'Thorax auskultieren' },
    { label: 'Sauerstoff geben', token: 'O2 geben' }
  ],
  C: [
    { label: 'RR messen', token: 'RR messen' },
    { label: 'Puls messen', token: 'Puls messen' },
    { label: '12-Kanal-EKG', token: '12-Kanal-EKG' },
    { label: 'Volumen 500 ml', token: 'Volumen 500 ml' }
  ],
  D: [
    { label: 'GCS erheben', token: 'GCS erheben' },
    { label: 'Pupillen prüfen', token: 'Pupillen' },
    { label: 'BZ messen', token: 'BZ messen' }
  ],
  E: [
    { label: 'Ganzkörper Check', token: 'Bodycheck' },
    { label: 'Wärmeerhalt', token: 'Wärme' },
    { label: 'Oberkörper hoch lagern', token: 'Oberkörper hoch lagern' }
  ]
};

// ------- Panel Rendering -------
function renderPanel(tab) {
  panel.innerHTML = '';
  const list = ACTIONS[tab] || [];
  list.forEach((a, idx) => {
    const card = document.createElement('button');
    card.className = 'action-card';
    card.innerHTML = `<div class="label">${a.label}</div>`;
    card.dataset.idx = idx;
    card.addEventListener('click', () => {
      queue.push({ label: a.label, token: a.token });
      renderQueue();
    });
    panel.appendChild(card);
  });
}

// Tabs (XABCDE)
tabs.forEach(t => t.addEventListener('click', () => renderPanel(t.dataset.tab)));

// ------- Queue -------
function renderQueue() {
  queueList.innerHTML = '';
  queue.forEach((item, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${item.label}</span>
      <button class="btn secondary small">Entfernen</button>
    `;
    li.querySelector('button').addEventListener('click', () => removeFromQueue(idx));
    queueList.appendChild(li);
  });
}
function removeFromQueue(i) {
  queue.splice(i, 1);
  renderQueue();
}

// ====================================================================
// Lokaler Fallsimulator (Fallback, falls Netlify-Function nicht geht)
// ====================================================================
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

    paediatrisch: () => ({
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
  c.history = c.history || [];
  c.score = typeof c.score === 'number' ? c.score : 0;
  return c;
}

// ------- Case handling / Start -------
async function startCase() {
  if (!selectedSpec) selectedSpec = 'internistisch';

  // UI-Reset
  clearVisibleVitals();
  resetProgress();
  caseState = null;
  setStatus('Fall wird geladen …');

  startBtn.disabled = true;
  addMsg('<div class="small">Neuer Fall wird erstellt …</div>');

  let usedFallback = false;
  try {
    const res = await fetch(API_CASE_NEW, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specialty: selectedSpec,
        difficulty: 'mittel',
        role: roleSel?.value || 'RS'
      })
    });

    if (!res.ok) {
      throw new Error('Backend antwortet mit Status ' + res.status);
    }

    const data = await res.json().catch(() => {
      throw new Error('Antwort konnte nicht als JSON gelesen werden.');
    });

    if (!data || data.error) {
      throw new Error(data && data.error ? data.error : 'Ungültige Antwort vom Backend.');
    }

    caseState = data.case || data;
  } catch (e) {
    // Fallback: lokale Fallsimulation
    usedFallback = true;
    caseState = buildLocalCase(selectedSpec, roleSel?.value || 'RS', 'mittel');
    addMsg(`<div class="small">⚠️ Backend nicht erreichbar, verwende lokalen Fallsimulator (${e.message}).</div>`);
  } finally {
    startBtn.disabled = false;
  }

  if (!caseState) {
    setStatus('Kein Fall aktiv.');
    return;
  }

  clearVisibleVitals();
  setStatus(`Fall aktiv: ${caseState?.patient?.name || 'Patient/in'} (${selectedSpec})`);
  setScore(caseState?.score ?? 0);
  renderProgress(caseState?.steps_done || []);
  showHint('Starte mit X: lebensbedrohliche Blutungen ausschließen/stoppen.');

  addMsg(`<strong>Fallstart${usedFallback ? ' (lokal)' : ''}:</strong> ${caseState?.story || '—'}`);
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
      markMonitor(Object.keys(data.updated_vitals));
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
      showHint('—');
      resetProgress();
      caseState = null;
    }
  } catch (e) {
    addMsg(`⚠️ Schrittfehler: <span class="small">${e.message}</span>`);
  }
}

// AF-Zähler
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
      document.getElementById('befastInfo')?.textContent; // no-op
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
      markMonitor(['AF']);
      stepCase(`AF messen ${perMin}/min`);
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

// ---- BE-FAST ----
function openBEFAST(){
  const infoBox = document.getElementById('befastInfo');
  document.getElementById('befastFetch')?.addEventListener('click', async ()=>{
    const res = await fetch(API_CASE_STEP, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ case_state: caseState, user_action: 'BEFAST Info', role: caseState?.role || 'RS' })
    });
    const data = await res.json();
    infoBox.textContent = data.evaluation || data.finding || 'Keine spezifische BEFAST-Information hinterlegt.';
  }, { once:true });

  document.getElementById('befastOk').onclick = ()=>{
    const data={
      B:document.getElementById('b_balance').checked,
      E:document.getElementById('e_eyes').checked,
      F:document.getElementById('f_face').checked,
      A:document.getElementById('a_arm').checked,
      S:document.getElementById('s_speech').checked,
      T:document.getElementById('t_time').value||''
    };
    const parts=[]; if(data.B) parts.push('Balance'); if(data.E) parts.push('Eyes');
    if(data.F) parts.push('Face'); if(data.A) parts.push('Arm'); if(data.S) parts.push('Speech');
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
    infoBox.textContent = data.evaluation || 'Keine detaillierte SAMPLER-Anamnese im Fall hinterlegt.';
  }, { once:true });

  document.getElementById('samplerOk').onclick = ()=>{
    const sData = {
      S:document.getElementById('s_symptom').value||'',
      A:document.getElementById('s_allergy').value||'',
      M:document.getElementById('s_medication').value||'',
      P:document.getElementById('s_past').value||'',
      L:document.getElementById('s_last').value||'',
      E:document.getElementById('s_events').value||'',
      R:document.getElementById('s_risk').value||''
    };
    const parts=[];
    Object.entries(sData).forEach(([k,v])=>{ if(v) parts.push(`${k}:${v}`); });
    const msg = parts.length ? `SAMPLER dokumentiert (${parts.join(' | ')})` : 'SAMPLER dokumentiert (keine zusätzlichen Angaben).';
    stepCase(msg);
    closeModal('modalSAMPLER');
  };
  document.getElementById('samplerCancel').onclick = ()=> closeModal('modalSAMPLER');
  openModal('modalSAMPLER');
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
    infoBox.textContent = data.evaluation || 'Keine Details zur Lagebeurteilung hinterlegt.';
  }, { once:true });

  document.getElementById('s4Ok').onclick = ()=>{
    const flags=[
      document.getElementById('s1').checked,
      document.getElementById('s2').checked,
      document.getElementById('s3').checked,
      document.getElementById('s4').checked
    ];
    const parts=[];
    if(flags[0]) parts.push('Sicherheit');
    if(flags[1]) parts.push('Szene');
    if(flags[2]) parts.push('Sichtung');
    if(flags[3]) parts.push('Support');
    const msg = parts.length ? `4S abgearbeitet (${parts.join(', ')})` : '4S abgefragt (ohne Details).';
    stepCase(msg);
    closeModal('modal4S');
  };
  document.getElementById('s4Cancel').onclick = ()=> closeModal('modal4S');
  openModal('modal4S');
}

// ---- Diagnose & Transport ----
const DX_BY_SPEC = {
  internistisch: ['ACS','Asthma/Bronchialobstruktion','COPD-Exazerbation','Lungenembolie','Sepsis','Metabolische Entgleisung'],
  neurologisch:  ['Schlaganfall','Krampfanfall','Hypoglykämie','Bewusstlosigkeit unklarer Genese'],
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
    const parts=[`Verdachtsdiagnose: ${txt}`, `Priorität: ${prio}`];
    if(note) parts.push(`Kommentar: ${note}`);
    const msg = parts.join(' | ');
    stepCase(`Verdachtsdiagnose: ${msg}`);
    closeModal('modalDx');
  };
  $id('dxCancel').onclick=()=> closeModal('modalDx');
  openModal('modalDx');
}

// ---- Debrief / Zusammenfassung ----
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

  // Fallback: ganz grobe Auswertung auf Basis von caseState
  if (!caseState) {
    addMsg('<div class="small">Kein aktiver Fall für ein Debriefing.</div>');
    return;
  }
  const s   = caseState;
  const v   = s.measurements?.vitals || {};
  const sch = s.measurements?.schemas || {};
  const pain = s.measurements?.pain || {};
  const steps = s.steps_done || [];

  const vitalsAll     = ['RR','SpO2','AF','Puls','BZ','Temp','GCS'];
  const vitalsDone    = vitalsAll.filter(k => v[k]);
  const vitalsMissing = vitalsAll.filter(k => !v[k]);
  const openXABCDE    = ['X','A','B','C','D','E'].filter(letter => !steps.some(x=>String(x).toUpperCase().startsWith(letter)));

  const bullets = [];
  bullets.push(`XABCDE: erledigt → ${steps.length ? steps.join(' → ') : 'keine Schritte dokumentiert'}`);
  if (openXABCDE.length) bullets.push(`Offen: ${openXABCDE.join(', ')}`);
  bullets.push(`Vitals erhoben: ${vitalsDone.length ? vitalsDone.join(', ') : 'keine vollständigen Vitalzeichen'}`);
  if (vitalsMissing.length) bullets.push(`Vitals fehlen: ${vitalsMissing.join(', ')}`);
  bullets.push(`4S: ${sch['4S'] ? 'durchgeführt' : 'nicht dokumentiert'}`);
  bullets.push(`SAMPLER: ${sch['SAMPLER'] ? 'dokumentiert' : 'fehlt'}`);
  bullets.push(`BE-FAST: ${sch['BEFAST'] ? 'geprüft' : 'nicht dokumentiert'}`);
  bullets.push(`Schmerzskala: ${pain.documented ? `NRS ${pain.nrs ?? '—'}` : 'nicht erhoben'}`);

  addMsg(`<strong>Debriefing (lokal)</strong><ul class="small"><li>${bullets.join('</li><li>')}</li></ul>`);
}

// ------- Modal Helpers -------
function $id(id){ return document.getElementById(id); }

function openModal(id){
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('hidden');
}
function closeModal(id){
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('hidden');
}

// ------- Queue ausführen -------
async function runQueue() {
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
