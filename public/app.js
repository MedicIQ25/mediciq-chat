// ===============================================================
// medicIQ – App Logic (12-Lead EKG Support & Pathology)
// ===============================================================

const API_CASE_NEW  = '/.netlify/functions/case-new';
const API_CASE_STEP = '/.netlify/functions/case-step';

// ACTIONS
const ACTIONS = {
  X: [ 
      { label: 'Nach krit. Blutungen suchen', token: 'Blutungscheck', instant: true }, 
      { label: 'Keine Blutung feststellbar', token: 'X unauffällig' }, 
      { label: 'Druckverband anlegen', token: 'Druckverband' }, 
      { label: 'Tourniquet anlegen', token: 'Tourniquet' }, 
      { label: 'Beckenschlinge anlegen', token: 'Beckenschlinge' }, 
      { label: 'Woundpacking', token: 'Hämostyptikum' } 
  ],
  A: [ 
      { label: 'Mundraumkontrolle', token: 'Mundraumkontrolle', instant: true }, 
      { label: 'Absaugen', token: 'Absaugen' }, 
      { label: 'Esmarch-Handgriff', token: 'Esmarch' }, 
      { label: 'Guedel-Tubus', token: 'Guedel' }, 
      { label: 'Wendel-Tubus', token: 'Wendel' }, 
      { label: 'Beutel-Masken-Beatmung', token: 'Beutel-Masken-Beatmung' } 
  ],
  B: [ 
      { label: 'AF messen (zählen)', token: 'AF messen', instant: true }, 
      { label: 'SpO₂ messen', token: 'SpO2 messen', instant: true }, 
      { label: 'Lunge auskultieren', token: 'Lunge auskultieren', instant: true }, 
      { label: 'Sauerstoff geben', special: 'O2' } 
  ],
  C: [ 
      { label: 'RR messen', token: 'RR messen', instant: true }, 
      { label: 'Puls messen', token: 'Puls messen', instant: true }, 
      { label: 'pDMS prüfen', token: 'pDMS Kontrolle', instant: true }, 
      { label: '12-Kanal-EKG', special: 'EKG' }, 
      { label: 'i.V. Zugang legen', token: 'i.V. Zugang legen' }, 
      { label: 'Volumen 500 ml', token: 'Volumen 500 ml' } 
  ],
  D: [ 
      { label: 'GCS erheben', token: 'GCS erheben', instant: true }, 
      { label: 'Pupillen prüfen', token: 'Pupillen', instant: true }, 
      { label: 'BZ messen', token: 'BZ messen', instant: true } 
  ],
  E: [ 
      { label: 'Bodycheck (Text)', token: 'Bodycheck', instant: true }, 
      { label: 'Bodycheck (Bild)', special: 'BODYMAP' }, 
      { label: 'pDMS prüfen', token: 'pDMS Kontrolle', instant: true }, 
      { label: 'Immobilisation / Schienung', special: 'IMMO' }, 
      { label: 'Wärmeerhalt', token: 'Wärmeerhalt' }, 
      { label: 'Temp messen', token: 'Temperatur messen', instant: true }, 
      { label: 'Oberkörper hoch', token: 'Oberkörper hoch lagern' } 
  ]
};

// Global Vars
let caseState = null;
const queue = [];
let timerInterval = null;
let startTime = null;
let lastTickTime = 0; 
let soundEnabled = false; 
let isDarkMode = false;
let selectedSpec = 'internistisch';
const visibleVitals = {};

// AUDIO CONTEXT VARS
let audioCtx = null;
let monitorTimeout = null;

// EKG State
let currentLead = 'II'; // Standard-Ableitung

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
    renderPanel('X');
    updateUI(false); 
    
    bindEvent('btnSound', 'click', (e) => {
        soundEnabled = !soundEnabled;
        e.target.textContent = soundEnabled ? "🔊 An" : "🔇 Aus";
        if(soundEnabled) startMonitorLoop();
        else stopMonitorLoop();
    });

    bindEvent('btnDark', 'click', () => {
        isDarkMode = !isDarkMode;
        document.body.classList.toggle('dark-mode', isDarkMode);
    });

    bindEvent('btnPrint', 'click', () => window.print());
    bindEvent('startCase', 'click', startCase);
    bindEvent('finishCase', 'click', openHandover);
    
    bindEvent('btnRunQueue', 'click', async () => {
        if(!caseState) return;
        while(queue.length) {
            const it = queue.shift();
            renderQueue();
            await stepCase(it.token);
            await new Promise(r=>setTimeout(r,500));
        }
    });
    
    bindEvent('btnClearQueue', 'click', () => { queue.length=0; renderQueue(); });
    bindEvent('btnGlobalNA', 'click', openNA);

    document.querySelectorAll('.spec-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        if(caseState) return; 
        document.querySelectorAll('.spec-chip').forEach(b => b.classList.remove('active'));
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

    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        renderPanel(t.dataset.tab);
    }));
});

function bindEvent(id, event, func) {
    const el = document.getElementById(id);
    if(el) el.addEventListener(event, func);
}

// --- Logic ---

async function startCase() {
  const chatLog = document.getElementById('chatLog');
  chatLog.innerHTML = '';
  queue.length = 0;
  renderQueue();
  for(let k in visibleVitals) delete visibleVitals[k];
  renderVitals(); 
  updateUI(true); 
  startTimer(); 
  
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('done','active'));
  document.getElementById('caseStatus').textContent = 'Lade Fall...';
  document.getElementById('hintCard').classList.add('hidden');
  document.getElementById('startCase').disabled = true;

  try {
    const r = await fetch(API_CASE_NEW, {
      method:'POST',
      body: JSON.stringify({ specialty: selectedSpec, role: 'RS' })
    });
    
    if(!r.ok) throw new Error("Server Fehler: " + r.statusText);
    
    const d = await r.json();
    caseState = d.case || d; 
    
    document.getElementById('caseStatus').textContent = `Aktiv: ${caseState.specialty}`;
    document.getElementById('caseScore').textContent = 'Score: 0';
    renderProgress([]);
    showHint('Beginne mit XABCDE.');

    addMsg(`<strong>Fallstart:</strong> ${caseState.story}`);

    if (caseState.intro_dialogue) {
        setTimeout(() => speak(caseState.intro_dialogue), 500);
    } 

    if(soundEnabled) startMonitorLoop();

  } catch(e) {
    caseState = { 
        id:'local', specialty:selectedSpec, steps_done:[], history:[], score:0, vitals:{}, 
        hidden: { ekg_pattern: 'sinus' }, story: "⚠️ Offline-Modus: Server nicht erreichbar." 
    };
    addMsg(`⚠️ Konnte Fall nicht laden (${e.message}).`);
    document.getElementById('caseStatus').textContent = 'Fehler';
  } finally {
    document.getElementById('startCase').disabled = false;
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
      if(soundEnabled) {
          if(monitorTimeout) clearTimeout(monitorTimeout);
          scheduleBeep();
      }
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
    }

    caseState = d.case_state || caseState;
    const scoreEl = document.getElementById('caseScore');
    if(scoreEl) scoreEl.textContent = `Score: ${caseState.score||0}`;
    renderProgress(caseState.steps_done||[]);
    
    if(d.done) {
      openDebrief();
      caseState = null;
      updateUI(false); 
      stopTimer();
      stopMonitorLoop(); 
      document.getElementById('caseStatus').textContent = 'Fall beendet.';
    }
  } catch(e) {
    addMsg(`Fehler: ${e.message}`);
  }
}

// --- DYNAMIC MONITOR LOGIC (12-Lead Support) ---
function openEKG() {
    if(!caseState) return;
    currentLead = 'II'; // Reset auf Standard

    const modalBody = document.querySelector('#modalEKG .modal-body');
    
    // UI mit Dropdown für Ableitungen
    modalBody.innerHTML = `
      <div style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
        <label style="font-weight:bold;">Ableitung:</label>
        <select id="leadSelect" style="padding:5px; border-radius:4px; font-weight:bold;">
            <option value="I">I</option>
            <option value="II" selected>II</option>
            <option value="III">III</option>
            <option value="aVR">aVR</option>
            <option value="aVL">aVL</option>
            <option value="aVF">aVF</option>
            <option value="V1">V1</option>
            <option value="V2">V2</option>
            <option value="V3">V3</option>
            <option value="V4">V4</option>
            <option value="V5">V5</option>
            <option value="V6">V6</option>
        </select>
      </div>

      <div class="ekg-screen" style="width:100%; height:200px;">
        <svg id="monitorSvg" width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none">
            </svg>
      </div>
      <div id="ekgText" style="margin-top:10px; font-weight:bold; color:#0f766e; text-align:center;"></div>
    `;

    openModal('modalEKG');
    
    // Event Listener für Dropdown
    const sel = document.getElementById('leadSelect');
    sel.onchange = () => {
        currentLead = sel.value;
        updateEKGView();
    };

    const closeBtn = document.getElementById('ekgClose');
    if(closeBtn) closeBtn.onclick = () => closeModal('modalEKG');

    // Erster Render
    updateEKGView();
}

function updateEKGView() {
    const type = caseState.hidden?.ekg_pattern || "sinus";
    const pathology = (caseState.hidden?.diagnosis_keys || []).join(' ').toLowerCase(); // z.B. "hinterwand"
    
    // SpO2 Logic
    const hasSpO2 = !!visibleVitals.SpO2;
    let spo2Value = 98; 
    if(hasSpO2) spo2Value = parseInt(String(visibleVitals.SpO2).match(/\d+/)?.[0] || 98);
    else if(caseState.vitals?.SpO2) spo2Value = parseInt(caseState.vitals.SpO2);

    const svg = document.getElementById('monitorSvg');
    if(!svg) return;

    // Grid Definition
    const defs = `
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#222" stroke-width="1"/>
        </pattern>
        <pattern id="grid-bold" width="100" height="100" patternUnits="userSpaceOnUse">
          <rect width="100" height="100" fill="url(#grid)" />
          <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#444" stroke-width="2"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid-bold)" />
    `;

    // Paths berechnen
    // Übergeben wir auch die pathology und currentLead an den Generator
    let ekgPath = generateLoopPath(type, 75, 400, 100, currentLead, pathology);
    let plethPath = hasSpO2 ? generateLoopPath('pleth', 160, 400, spo2Value) : `M 0 160 L 400 160`;

    svg.innerHTML = `
        ${defs}
        <g class="infinite-scroll">
             <g>
                <path d="${ekgPath}" fill="none" stroke="#00ff00" stroke-width="2" class="monitor-glow" />
                <path d="${plethPath}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round" class="monitor-glow-blue" />
             </g>
             <g transform="translate(400, 0)">
                <path d="${ekgPath}" fill="none" stroke="#00ff00" stroke-width="2" class="monitor-glow" />
                <path d="${plethPath}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round" class="monitor-glow-blue" />
             </g>
        </g>
        <text x="5" y="20" fill="#00ff00" font-family="monospace" font-size="12" font-weight="bold">${currentLead}</text>
        <text x="5" y="130" fill="#3b82f6" font-family="monospace" font-size="12" font-weight="bold">Pleth</text>
        <text x="350" y="30" fill="#00ff00" font-family="monospace" font-size="16" font-weight="bold">${visibleVitals.Puls || '--'}</text>
        <text x="350" y="140" fill="#3b82f6" font-family="monospace" font-size="16" font-weight="bold">${visibleVitals.SpO2 || '--'}</text>
    `;

    // Diagnose-Text anpassen
    const txt = document.getElementById('ekgText');
    if(type === "sinus") {
        txt.textContent = "Sinusrhythmus";
        txt.style.color = "#00ff00";
    } else if (type === "vt") {
        txt.textContent = "!!! V-TACH !!!";
        txt.style.color = "#ef4444";
    } else {
        txt.textContent = "Asystolie";
        txt.style.color = "#ef4444";
    }
}

// Helper: Generiert die Kurven (Mit Pathologie & Ableitung)
function generateLoopPath(type, yBase, totalWidth, qualityValue, lead = 'II', pathology = '') {
    let d = `M 0 ${yBase} `;
    let currentX = 0;
    let mode = 'curve';
    let beatWidth = 0;
    let commands = []; 

    // --- FAKTOREN FÜR ABLEITUNGEN ---
    let polarity = 1.0; // 1 = Positiv, -1 = Negativ (aVR)
    let amplitude = 1.0; // Höhe
    
    if (lead === 'aVR') {
        polarity = -1.0; 
    } else if (lead === 'V1' || lead === 'aVL') {
        // Oft kleiner oder biphasisch
        amplitude = 0.8;
    }

    // --- PATHOLOGIE ERKENNUNG (STEMI HINTERWAND) ---
    // Betroffene Ableitungen: II, III, aVF (Hebung)
    // Reziprok: I, aVL (Senkung)
    const isInferiorWall = pathology.includes('hinterwand') || pathology.includes('inferior');
    
    let stElevation = 0; // 0 = Isoelektrisch
    
    if (type === 'sinus' && isInferiorWall) {
        if (['II', 'III', 'aVF'].includes(lead)) {
            stElevation = -15; // Hebung nach oben (SVG Y ist invertiert, also minus)
        } else if (['I', 'aVL'].includes(lead)) {
            stElevation = 10; // Senkung nach unten
        }
    }

    if (type === 'sinus') {
        mode = 'curve';
        beatWidth = 70; 
        
        // BASIS-KURVE (Lead II)
        // Wir modifizieren die Y-Werte basierend auf Polarity & ST-Strecke
        
        // P-Welle
        let pY = -5 * polarity * amplitude;
        let qrsTop = -55 * polarity * amplitude;
        let qrsBot = 60 * polarity * amplitude;
        let tY = -15 * polarity * amplitude;
        
        // ST-Segment Y-Shift
        // ST-Hebung zieht den J-Punkt (Ende S) und Start T hoch
        // Bei Hebung: S-Zacke geht nicht ganz zur Basis zurück
        
        // QRS Ende (J-Point)
        let jPointY = -8 + stElevation; 
        // Wir müssen sicherstellen, dass die Linie dort landet.
        
        // Bei Invertierung (aVR) müssen wir aufpassen:
        // P negativ, QRS hauptvektor negativ (tiefes S/QS), T negativ
        
        if(lead === 'aVR') {
             // Spezialform aVR: P negativ, QRS ist meist rS oder QS (tief)
             commands = [
                "c 3 5, 7 5, 10 0", // P (negativ)
                "l 5 0", // PR
                "l 2 -5 l 3 60 l 3 -55 l 2 5", // QRS (klein hoch, tief runter)
                "l 5 0", // ST
                "c 5 10, 12 10, 18 0", // T (negativ)
                "l 22 0" 
             ];
        } else {
            // Standard (mit ST-Shift)
            commands = [
                `c 3 ${pY}, 7 ${pY}, 10 0`, // P
                "l 5 0", // PR
                // QRS:
                `l 2 3 l 3 ${qrsTop} l 3 ${qrsBot} l 2 ${-8 + stElevation}`, // Ende bei J-Point (Shifted!)
                
                // ST-Strecke (Horizontal auf neuer Höhe)
                "l 5 0", 
                
                // T-Welle (Startet auf ST-Höhe, endet auf 0)
                // c dx1 dy1, dx2 dy2, dx dy (relativ!)
                // Wir starten bei stElevation. Ende muss 0 sein (Basis).
                // Die Y-Differenz zum Ende ist: -stElevation
                `c 5 ${tY}, 12 ${tY}, 18 ${-stElevation}`, 
                
                "l 22 0" // Pause
            ];
        }

    } else if (type === 'vt') {
        mode = 'line';
        beatWidth = 40;
        commands = [[15,-45], [15,90], [10,-45]];
    } else if (type === 'pleth') {
        mode = 'curve';
        beatWidth = 50;
        let scale = 1.0;
        if(qualityValue < 80) scale = 0.1;
        else if(qualityValue < 88) scale = 0.3;
        else if(qualityValue < 94) scale = 0.6;
        const hasNotch = qualityValue > 90;
        const riseY = -25 * scale;
        let cmd1 = `c 5 ${riseY}, 10 ${riseY}, 12 -5`; 
        let cmd2 = hasNotch ? `c 2 8, 5 0, 8 5` : `c 2 2, 5 4, 8 6`;
        let cmd3 = `c 5 5, 10 0, 30 0`;
        commands = [cmd1, cmd2, cmd3];
    } else {
        return `M 0 ${yBase} L ${totalWidth} ${yBase}`;
    }

    while(currentX < totalWidth) {
        if(mode === 'line') {
            commands.forEach(pt => {
                currentX += pt[0];
                d += `L ${currentX} ${yBase + pt[1]} `;
            });
        } else {
            commands.forEach(cmd => {
                d += cmd + " ";
            });
            currentX += beatWidth;
        }
    }
    
    d += `L ${totalWidth} ${yBase}`;
    return d;
}


// --- INTERACTION ---
function renderPanel(k) {
  const panel = document.getElementById('panel');
  if(!panel) return;
  panel.innerHTML = '';
  (ACTIONS[k]||[]).forEach(a => {
    const b = document.createElement('button');
    b.className = 'action-card';
    b.textContent = a.label;
    b.onclick = () => {
      if(a.special === 'O2') openOxygen();
      else if(a.special === 'NA') openNA();
      else if(a.special === 'IMMO') openImmo();
      else if(a.special === 'BODYMAP') openBodyMap();
      else if(a.special === 'EKG') openEKG();
      else if(a.instant) { stepCase(a.token); }
      else { queue.push(a); renderQueue(); }
    };
    panel.appendChild(b);
  });
}

function renderVitals() {
  const map = {
    RR:   document.getElementById('vRR'),
    SpO2: document.getElementById('vSpO2'),
    AF:   document.getElementById('vAF'),
    Puls: document.getElementById('vPuls'),
    BZ:   document.getElementById('vBZ'),
    Temp: document.getElementById('vTemp'),
    GCS:  document.getElementById('vGCS')
  };
  for(let k in map) {
    const el = map[k];
    if(!el) continue;
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
  const el = document.getElementById('missionTimer');
  if(el) { el.classList.remove('hidden'); el.textContent = "00:00"; }
  if(timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const now = Date.now();
    const diff = Math.floor((now - startTime) / 1000);
    const m = Math.floor(diff / 60).toString().padStart(2,'0');
    const s = (diff % 60).toString().padStart(2,'0');
    if(el) el.textContent = `${m}:${s}`;
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
  const specRow = document.getElementById('specRow');
  const startBtn = document.getElementById('startCase');
  const finishBtn = document.getElementById('finishCase');
  const roleSel = document.getElementById('roleSel');
  const timerEl = document.getElementById('missionTimer');
  if (running) {
    if(specRow) specRow.classList.add('hidden');
    if(startBtn) startBtn.classList.add('hidden');
    if(finishBtn) finishBtn.classList.remove('hidden');
    if(roleSel) roleSel.disabled = true;
  } else {
    if(specRow) specRow.classList.remove('hidden');
    if(startBtn) startBtn.classList.remove('hidden');
    if(finishBtn) finishBtn.classList.add('hidden');
    if(roleSel) roleSel.disabled = true;
    if(startBtn) startBtn.disabled = false;
    if(timerEl) timerEl.classList.add('hidden'); 
  }
}

function renderQueue() {
  const list = document.getElementById('queueList');
  if(!list) return;
  list.innerHTML = '';
  queue.forEach((it, i) => {
    const li = document.createElement('li');
    li.className = 'queue-item';
    li.innerHTML = `<span>${it.label}</span><button class="btn secondary small">x</button>`;
    li.querySelector('button').onclick = () => { queue.splice(i,1); renderQueue(); };
    list.appendChild(li);
  });
}

function renderProgress(doneList) {
  const s = new Set((doneList||[]).map(x=>x[0]));
  ['X','A','B','C','D','E'].forEach(l => {
    const el = document.querySelector(`.chip[data-step="${l}"]`);
    if(el) {
      el.classList.toggle('done', s.has(l));
      el.classList.remove('active');
    }
  });
  const next = ['X','A','B','C','D','E'].find(l => !s.has(l));
  if(next) {
    const el = document.querySelector(`.chip[data-step="${next}"]`);
    if(el) el.classList.add('active');
  }
}

function showHint(t) {
  const ht = document.getElementById('hintText');
  const hc = document.getElementById('hintCard');
  if(ht) ht.textContent = t;
  if(hc) hc.classList.remove('hidden');
}

function addMsg(h) {
  const d = document.createElement('div');
  d.className = 'msg';
  d.innerHTML = h;
  const log = document.getElementById('chatLog');
  if(log) {
    log.appendChild(d);
    d.scrollIntoView({block:'end', behavior:'smooth'});
  }
}

const $id = (id) => document.getElementById(id);
const modalBackdrop = document.getElementById('modalBackdrop');
function openModal(id) { 
  const el = $id(id);
  if(!el) return;
  if(modalBackdrop) modalBackdrop.style.display = 'block';
  el.style.display = 'block';
}
function closeModal(id) { 
  const el = $id(id);
  if(!el) return;
  if(modalBackdrop) modalBackdrop.style.display = 'none';
  el.style.display = 'none';
}

// --- EKG MONITOR SOUND LOGIC ---
function startMonitorLoop() {
    if(!soundEnabled || !window.AudioContext) return;
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(monitorTimeout) clearTimeout(monitorTimeout);
    scheduleBeep();
}

function stopMonitorLoop() {
    if(monitorTimeout) clearTimeout(monitorTimeout);
    monitorTimeout = null;
}

function scheduleBeep() {
    if(!soundEnabled || !caseState) return;
    const hasPuls = !!visibleVitals.Puls;
    const hasSpO2 = !!visibleVitals.SpO2;

    if(!hasPuls && !hasSpO2) {
        monitorTimeout = setTimeout(scheduleBeep, 1000);
        return;
    }

    let hrVal = 60;
    if(hasPuls) hrVal = parseFloat(String(visibleVitals.Puls).match(/\d+/)?.[0] || 60);
    else if(hasSpO2) hrVal = parseFloat(caseState.vitals?.Puls || 60);
    if(hrVal <= 0) hrVal = 60;

    let spo2Val = 99;
    if(hasSpO2) spo2Val = parseFloat(String(visibleVitals.SpO2).match(/\d+/)?.[0] || 98);

    playBeep(spo2Val);
    const interval = 60000 / Math.max(30, Math.min(220, hrVal));
    monitorTimeout = setTimeout(scheduleBeep, interval);
}

function playBeep(spo2) {
    if(!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    let freq = 850; 
    if(spo2 < 100) {
        const diff = 100 - spo2;
        freq = 850 - (diff * 20); 
    }
    if(freq < 150) freq = 150;

    osc.frequency.value = freq;
    osc.type = 'triangle';
    gain.gain.value = 0.05;

    const now = audioCtx.currentTime;
    osc.start(now);
    osc.stop(now + 0.12);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
}

// --- OPENAI TTS LOGIC ---
let currentAudio = null;
async function speak(text) {
    if (!soundEnabled || !text) return;
    if(currentAudio) { currentAudio.pause(); currentAudio = null; }

    let speakText = text
        .replace(/\//g, ' zu ')
        .replace(/SpO2/g, 'Sauerstoffsättigung')
        .replace(/AF/g, 'Atemfrequenz')
        .replace(/RR/g, 'Blutdruck')
        .replace(/l\/min/g, 'Liter')
        .replace(/°C/g, 'Grad');

    let selectedVoice = "fable"; 
    if (caseState && caseState.story) {
        const storyLower = caseState.story.toLowerCase();
        const specialty = (caseState.specialty || "").toLowerCase();
        if (specialty === 'paediatrisch' || storyLower.includes('kind') || storyLower.includes('säugling')) {
            selectedVoice = "alloy"; 
        } else if (storyLower.includes('frau') || storyLower.includes('patientin') || storyLower.includes('sie ')) {
            selectedVoice = "nova"; 
        }
    }

    const btn = document.getElementById('btnSound');
    const oldIcon = btn.textContent;
    btn.textContent = "⏳..."; 

    try {
        const response = await fetch('/.netlify/functions/tts', {
            method: 'POST',
            body: JSON.stringify({ text: speakText, voice: selectedVoice })
        });
        if (!response.ok) throw new Error("TTS Fehler");
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        currentAudio = new Audio(audioUrl);
        currentAudio.onended = () => { btn.textContent = oldIcon; };
        currentAudio.onplay = () => { btn.textContent = oldIcon; };
        currentAudio.play();
    } catch (e) {
        btn.textContent = oldIcon; 
    }
}

// ... Feature Modals (FIXED: NO SPEAK CALLS) ...
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
    // KEIN SPEAK MEHR
  } catch(e){}
}