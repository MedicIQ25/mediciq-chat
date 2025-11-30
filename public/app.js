// ===============================================================
// medicIQ – App Logic (Stable Vector EKG Generator)
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
let currentLead = 'II'; 

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
    
    const sel = document.getElementById('leadSelect');
    sel.onchange = () => {
        currentLead = sel.value;
        updateEKGView();
    };

    const closeBtn = document.getElementById('ekgClose');
    if(closeBtn) closeBtn.onclick = () => closeModal('modalEKG');

    updateEKGView();
}

function updateEKGView() {
    const type = caseState.hidden?.ekg_pattern || "sinus";
    const pathology = (caseState.hidden?.diagnosis_keys || []).join(' ').toLowerCase(); 
    
    // Werte holen (Sicherstellen, dass Zahlen da sind)
    const hasPuls = !!visibleVitals.Puls;
    const hasSpO2 = !!visibleVitals.SpO2;
    
    // Parse Zahlenwerte oder Platzhalter
    let pulsVal = hasPuls ? visibleVitals.Puls.replace(/\D/g,'') : '--';
    let spo2Val = hasSpO2 ? visibleVitals.SpO2.replace(/\D/g,'') : '--';
    
    // Für die Kurvengenerierung (Zahl benötigt)
    let spo2Num = hasSpO2 ? parseInt(spo2Val) : 98;
    // Wenn kein SpO2 gemessen, simulieren wir für die EKG-Kurven-Logik "gesund" (98), 
    // aber die Pleth-Linie wird unten eh flach gemacht.

    const svg = document.getElementById('monitorSvg');
    if(!svg) return;

    // Raster (Grid)
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

    // Kurven berechnen
    // Wir nutzen currentLead (globale Variable aus openEKG)
    let ekgPath = generateLoopPath(type, 75, 400, 100, currentLead, pathology);
    let plethPath = hasSpO2 ? generateLoopPath('pleth', 160, 400, spo2Num) : `M 0 160 L 400 160`;

    // VISUALISIERUNG
    // Wir zeichnen erst die Kurven, dann einen schwarzen Kasten rechts ("Sidebar"),
    // dann die Texte darauf. So läuft keine Linie durch den Text.
    
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

        <rect x="320" y="0" width="80" height="200" fill="#000" stroke-left="1px solid #333" />
        <line x1="320" y1="0" x2="320" y2="200" stroke="#444" stroke-width="2" />

        <text x="5" y="20" fill="#00ff00" font-family="monospace" font-size="14" font-weight="bold">${currentLead}</text>

        <text x="330" y="25" fill="#00ff00" font-family="sans-serif" font-size="10" font-weight="bold">HF</text>
        <text x="390" y="55" fill="#00ff00" font-family="monospace" font-size="35" font-weight="bold" text-anchor="end" class="monitor-glow">${pulsVal}</text>
        <text x="385" y="25" fill="#00ff00" font-size="10">♥</text>

        <text x="330" y="115" fill="#3b82f6" font-family="sans-serif" font-size="10" font-weight="bold">SpO2</text>
        <text x="390" y="145" fill="#3b82f6" font-family="monospace" font-size="35" font-weight="bold" text-anchor="end" class="monitor-glow-blue">${spo2Val}</text>
        <text x="385" y="155" fill="#3b82f6" font-size="10" text-anchor="end">%</text>

    `;

    // Status-Text unter dem Monitor aktualisieren
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
// --- CORE EKG GENERATOR (GLITCH-FREE) ---
function generateLoopPath(type, yBase, totalWidth, qualityValue, lead = 'II', pathology = '') {
    let d = `M 0 ${yBase} `;
    let currentX = 0;
    let mode = 'curve';
    let beatWidth = 70; // Standard

    // --- CONFIGURATION DER VEKTOREN ---
    // Wir definieren die Amplituden für P, Q, R, S, T
    // Standard (II): P+, Q klein, R groß, S klein, T+
    let amp = { p: -5, q: 3, r: -50, s: 15, t: -12 };
    
    // Lead-Specific Adjustments (Medizinisch angelehnt)
    if(type === 'sinus') {
        if (lead === 'aVR') {
            // Invertiert alles
            amp = { p: 5, q: -3, r: 10, s: -40, t: 8 }; // Tiefes S entspricht Hauptvektor
        } else if (lead === 'V1') {
            // Kleines r, tiefes S, T oft flach/inv
            amp = { p: -3, q: 0, r: -15, s: 40, t: 5 }; 
        } else if (lead === 'V6' || lead === 'I') {
            // Septales q, hohes R
            amp = { p: -5, q: 3, r: -45, s: 5, t: -12 };
        } else if (lead === 'aVL') {
            // Kleiner
            amp = { p: -3, q: 2, r: -30, s: 10, t: -8 };
        } else if (lead === 'III' || lead === 'aVF') {
            // Variabel, oft R > S
            amp = { p: -4, q: 5, r: -40, s: 10, t: -10 };
        }
    }

    // --- PATHOLOGIE (STEMI) ---
    const isInferior = pathology.includes('hinterwand') || pathology.includes('inferior');
    let stShift = 0; // 0 = Isoelektrisch

    if (type === 'sinus' && isInferior) {
        if (['II', 'III', 'aVF'].includes(lead)) stShift = -12; // Hebung
        else if (['I', 'aVL'].includes(lead)) stShift = 8; // Senkung (reziprok)
    }

    // Generator Loop
    while(currentX < totalWidth) {
        
        if (type === 'sinus') {
            beatWidth = 70;
            
            // MATH MAGIC: Wir berechnen die relativen Bewegungen so, dass sie IMMER auf 0 enden.
            // SVG Koordinaten: Y-Negativ ist Oben!
            
            // P-Welle (Kurve)
            // Start bei 0. Ende bei 0. Höhe amp.p
            const p = `c 3 ${amp.p}, 7 ${amp.p}, 10 0`;
            
            // PR-Strecke (Linie)
            const pr = `l 5 0`;
            
            // QRS (Linien)
            // Q: runter (pos Y)
            // R: steil hoch (neg Y)
            // S: steil runter (pos Y)
            // J-Point (Rückkehr): Muss zur Basis zurück oder zur ST-Hebung (stShift)
            
            // Wir müssen sicherstellen, dass die Summe der Y-Bewegungen = stShift ist (nicht 0, wegen Hebung)
            // Q (+), R (-), S (+)
            // Beispiel: Q=+3, R=-50, S=+15.  Summe = -32.  Wir wollen aber zu 0 (oder stShift).
            // Also muss der letzte Strich (J-Point Return) den Rest ausgleichen.
            
            // Wir zeichnen Q, R, S fest:
            // Q: geht zu y = amp.q
            // R: geht zu y = amp.r (von der Basis aus gesehen!) -> Delta = amp.r - amp.q
            // S: geht zu y = amp.s -> Delta = amp.s - amp.r
            // J: geht zu y = stShift -> Delta = stShift - amp.s
            
            // Da SVG 'l' relativ ist, berechnen wir die Deltas:
            const dyQ = amp.q;
            const dyR = amp.r - amp.q;
            const dyS = amp.s - amp.r;
            const dyJ = stShift - amp.s; // Rückkehr zur ST-Höhe
            
            const qrs = `l 2 ${dyQ} l 3 ${dyR} l 3 ${dyS} l 2 ${dyJ}`;
            
            // ST-Strecke (Horizontal auf stShift Höhe)
            const st = `l 5 0`;
            
            // T-Welle
            // Startet auf stShift. Muss zu 0 zurückkehren.
            // Wir nutzen eine Kurve.
            // Control Points relativ zur Startposition (stShift).
            // Ende relativ: Wir müssen um -stShift runter, um auf 0 zu kommen.
            // Amplitude draufrechnen.
            const tPeak = amp.t; // relative Spitze
            const tEnd = -stShift; // Zurück zur Basis
            
            const t = `c 5 ${tPeak}, 12 ${tPeak}, 18 ${tEnd}`;
            
            // Pause
            const iso = `l 22 0`;
            
            d += p + pr + qrs + st + t + iso + " ";
            currentX += beatWidth;

        } else if (type === 'vt') {
            beatWidth = 40;
            // VT ist Breitkomplex
            d += `l 15 -45 l 15 90 l 10 -45 `;
            currentX += beatWidth;

        } else if (type === 'pleth') {
            mode = 'curve';
            beatWidth = 50;
            
            let scale = 1.0;
            if(qualityValue < 80) scale = 0.1;
            else if(qualityValue < 88) scale = 0.3;
            else if(qualityValue < 94) scale = 0.6;
            
            const hasNotch = qualityValue > 90;
            const riseY = -25 * scale;
            
            // Hier nutzen wir einfache relative Kurven, die in sich geschlossen sind (dy Summe = 0)
            // Anstieg: -25. Fall1: +8. Fall2: +17. Summe = 0.
            let c1 = `c 5 ${riseY}, 10 ${riseY}, 12 -5`; 
            // Fall bis Notch: wir müssen von y=-5 (relativ start) ein stück runter
            let c2 = hasNotch ? `c 2 8, 5 0, 8 5` : `c 2 2, 5 4, 8 5`; 
            // Rest zurück zur Basis: Wenn wir bei y=0 starteten:
            // c1 endete bei -5.
            // c2 (notch) endete bei -5 + 5 = 0.
            // c3 flacht aus.
            let c3 = `c 5 0, 10 0, 30 0`;
            
            d += c1 + " " + c2 + " " + c3 + " ";
            currentX += beatWidth;
        } else {
            // Asystolie
            d += `L ${totalWidth} ${yBase}`;
            currentX = totalWidth;
        }
    }
    
    // Finish line
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
  } catch(e){}
}