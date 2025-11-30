// ===============================================================
// medicIQ – App Logic (COMPLETE FIXED VERSION)
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

// Audio & Monitor Vars
let audioCtx = null;
let monitorTimeout = null;
let currentLead = 'II'; 

// --- INITIALIZATION ---
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

// --- CORE LOGIC ---

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
      
      // Update Audio
      if(soundEnabled) {
          if(monitorTimeout) clearTimeout(monitorTimeout);
          scheduleBeep();
      }

      // Update Monitor Visuals (falls offen)
      const modal = document.getElementById('modalEKG');
      if(modal && modal.style.display === 'block') {
          updateEKGView();
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

// --- MONITOR & AUDIO LOGIC ---

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

function openEKG() {
    if(!caseState) return;
    currentLead = 'II';

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
        <svg id="monitorSvg" width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none"></svg>
      </div>
      <div id="ekgText" style="margin-top:10px; font-weight:bold; color:#0f766e; text-align:center;"></div>
    `;

    openModal('modalEKG');
    
    const sel = document.getElementById('leadSelect');
    sel.onchange = () => { currentLead = sel.value; updateEKGView(); };

    const closeBtn = document.getElementById('ekgClose');
    if(closeBtn) closeBtn.onclick = () => closeModal('modalEKG');

    updateEKGView();
    stepCase('12-Kanal-EKG'); 
}

function updateEKGView() {
    const type = caseState.hidden?.ekg_pattern || "sinus";
    const pathology = (caseState.hidden?.diagnosis_keys || []).join(' ').toLowerCase(); 
    const hasSpO2 = !!visibleVitals.SpO2;
    const hasPuls = !!visibleVitals.Puls; 

    let spo2Val = hasSpO2 ? visibleVitals.SpO2.replace(/\D/g,'') : '--';
    let pulsVal = hasPuls ? visibleVitals.Puls.replace(/\D/g,'') : '--';
    let spo2Num = hasSpO2 ? parseInt(spo2Val) : 98;

    const svg = document.getElementById('monitorSvg');
    if(!svg) return;

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

    let ekgPath = generateLoopPath(type, 75, 400, 100, currentLead, pathology);
    let plethPath = hasSpO2 ? generateLoopPath('pleth', 160, 400, spo2Num) : `M 0 160 L 400 160`;

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

function generateLoopPath(type, yBase, totalWidth, qualityValue, lead = 'II', pathology = '') {
    let d = `M 0 ${yBase} `;
    let currentX = 0;
    let beatWidth = 70; 
    let amp = { p: -5, q: 3, r: -50, s: 15, t: -12 };
    
    if(type === 'sinus') {
        if (lead === 'aVR') { amp = { p: 5, q: -3, r: 10, s: -40, t: 8 }; } 
        else if (lead === 'V1') { amp = { p: -3, q: 0, r: -15, s: 40, t: 5 }; } 
        else if (lead === 'V6' || lead === 'I') { amp = { p: -5, q: 3, r: -45, s: 5, t: -12 }; } 
        else if (lead === 'aVL') { amp = { p: -3, q: 2, r: -30, s: 10, t: -8 }; } 
        else if (lead === 'III' || lead === 'aVF') { amp = { p: -4, q: 5, r: -40, s: 10, t: -10 }; }
    }

    const isInferior = pathology.includes('hinterwand') || pathology.includes('inferior');
    let stShift = 0; 
    if (type === 'sinus' && isInferior) {
        if (['II', 'III', 'aVF'].includes(lead)) stShift = -12; 
        else if (['I', 'aVL'].includes(lead)) stShift = 8; 
    }

    while(currentX < totalWidth) {
        if (type === 'sinus') {
            beatWidth = 70;
            const p = `c 3 ${amp.p}, 7 ${amp.p}, 10 0`;
            const dyQ = amp.q;
            const dyR = amp.r - amp.q;
            const dyS = amp.s - amp.r;
            const dyJ = stShift - amp.s; 
            const qrs = `l 2 ${dyQ} l 3 ${dyR} l 3 ${dyS} l 2 ${dyJ}`;
            const tPeak = amp.t; 
            const tEnd = -stShift; 
            const t = `c 5 ${tPeak}, 12 ${tPeak}, 18 ${tEnd}`;
            d += p + `l 5 0` + qrs + `l 5 0` + t + `l 22 0` + " ";
            currentX += beatWidth;
        } else if (type === 'vt') {
            beatWidth = 40;
            d += `l 15 -45 l 15 90 l 10 -45 `;
            currentX += beatWidth;
        } else if (type === 'pleth') {
            beatWidth = 50;
            let scale = 1.0;
            if(qualityValue < 80) scale = 0.1;
            else if(qualityValue < 88) scale = 0.3;
            else if(qualityValue < 94) scale = 0.6;
            const hasNotch = qualityValue > 90;
            const riseY = -25 * scale;
            let c1 = `c 5 ${riseY}, 10 ${riseY}, 12 -5`; 
            let c2 = hasNotch ? `c 2 8, 5 0, 8 5` : `c 2 2, 5 4, 8 5`; 
            let c3 = `c 5 0, 10 0, 30 0`;
            d += c1 + " " + c2 + " " + c3 + " ";
            currentX += beatWidth;
        } else {
            d += `L ${totalWidth} ${yBase}`;
            currentX = totalWidth;
        }
    }
    d += `L ${totalWidth} ${yBase}`;
    return d;
}

// --- TTS ---
let currentAudio = null;
async function speak(text) {
    if (!soundEnabled || !text) return;
    if(currentAudio) { currentAudio.pause(); currentAudio = null; }

    let speakText = text.replace(/\//g, ' zu ').replace(/SpO2/g, 'Sauerstoffsättigung').replace(/AF/g, 'Atemfrequenz').replace(/RR/g, 'Blutdruck').replace(/l\/min/g, 'Liter').replace(/°C/g, 'Grad');
    let selectedVoice = "fable"; 
    if (caseState && caseState.story) {
        const storyLower = caseState.story.toLowerCase();
        const specialty = (caseState.specialty || "").toLowerCase();
        if (specialty === 'paediatrisch' || storyLower.includes('kind') || storyLower.includes('säugling')) { selectedVoice = "alloy"; } 
        else if (storyLower.includes('frau') || storyLower.includes('patientin') || storyLower.includes('sie ')) { selectedVoice = "nova"; }
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

// --- DEBRIEFING ---
async function openDebrief() {
  if (!caseState) { addMsg("⚠️ Fehler: Kein Fall aktiv."); return; }
  stopTimer(); stopMonitorLoop();
  
  const statusEl = document.getElementById('caseStatus');
  if(statusEl) statusEl.textContent = 'Analysiere Fall...';
  addMsg("⏳ <em>Sende Daten an Auswertung...</em>");

  try {
    const r = await fetch(API_CASE_STEP, {
        method: 'POST',
        body: JSON.stringify({ case_state: caseState, user_action: 'Debriefing' })
    });
    if (!r.ok) throw new Error("Server Fehler");
    const d = await r.json();
    
    caseState = null; 
    updateUI(false);
    if(statusEl) statusEl.textContent = 'Fall beendet.';

    if (d.debrief) {
        addMsg(`<div style="background:#f0fdf4; border:2px solid #16a34a; padding:20px; border-radius:12px; margin-top:15px; color:#14532d; font-size: 1rem; line-height: 1.6;"><h3 style="margin-top:0; color:#166534;">🎓 Fall-Auswertung</h3>${d.debrief}</div>`);
    } else { addMsg("⚠️ Auswertung leer."); }
  } catch(e) {
    caseState = null; updateUI(false);
    addMsg(`❌ Fehler: ${e.message}`);
  }
}

// --- UI HELPERS & MODALS ---
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
  const map = { RR: 'vRR', SpO2: 'vSpO2', AF: 'vAF', Puls: 'vPuls', BZ: 'vBZ', Temp: 'vTemp', GCS: 'vGCS' };
  for(let k in map) {
    const el = document.getElementById(map[k]);
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

function stopTimer() { if(timerInterval) clearInterval(timerInterval); }

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
    if(el) { el.classList.toggle('done', s.has(l)); el.classList.remove('active'); }
  });
  const next = ['X','A','B','C','D','E'].find(l => !s.has(l));
  if(next) { const el = document.querySelector(`.chip[data-step="${next}"]`); if(el) el.classList.add('active'); }
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
  if(log) { log.appendChild(d); d.scrollIntoView({block:'end', behavior:'smooth'}); }
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
    $id('nrsInfo').innerHTML = d.finding; 
  };
  $id('nrsOk').onclick=()=>{ stepCase(`NRS ${r.value}`); closeModal('modalNRS'); };
  $id('nrsCancel').onclick=()=>closeModal('modalNRS');
  openModal('modalNRS');
}
function openBEFAST() {
  $id('befastFetch').onclick=async()=>{
    const res = await fetch(API_CASE_STEP, {method:'POST', body:JSON.stringify({case_state:caseState, user_action:'BEFAST Info'})});
    const d = await res.json();
    $id('befastInfo').innerHTML = d.finding; 
  };
  $id('befastOk').onclick=()=>{ stepCase('BEFAST dokumentiert'); closeModal('modalBEFAST'); };
  $id('befastCancel').onclick=()=>closeModal('modalBEFAST');
  openModal('modalBEFAST');
}
// ...

function openSampler() {
  // Wenn wir das Modal öffnen, holen wir die Daten direkt aus dem lokalen caseState (falls vorhanden)
  // oder fragen den Server.
  
  $id('samplerFetch').onclick = async () => {
    // 1. Daten vom Server holen (für Text-Vorschau)
    const res = await fetch(API_CASE_STEP, {
        method:'POST', 
        body:JSON.stringify({case_state:caseState, user_action:'SAMPLER Info'})
    });
    const d = await res.json();
    
    if(d.finding) document.getElementById('samplerInfo').innerHTML = d.finding;

    // 2. Felder automatisch füllen
    // Wir greifen auf caseState.anamnesis.SAMPLER zu
    const S = caseState?.anamnesis?.SAMPLER || {};
    
    // Checken, ob die Elemente existieren, dann füllen
    if($id('s_sympt')) $id('s_sympt').value = S.S || '';
    if($id('s_allerg')) $id('s_allerg').value = S.A || '';
    if($id('s_med')) $id('s_med').value = S.M || '';
    if($id('s_hist')) $id('s_hist').value = S.P || '';
    if($id('s_last')) $id('s_last').value = S.L || '';
    if($id('s_events')) $id('s_events').value = S.E || '';
    if($id('s_risk')) $id('s_risk').value = S.R || '';
  };

  $id('samplerOk').onclick = () => { 
      stepCase('SAMPLER doku'); 
      closeModal('modalSampler'); 
  };
  $id('samplerCancel').onclick = () => closeModal('modalSampler');
  openModal('modalSampler');
}

function openFourS() {
  $id('s4Fetch').onclick=async()=>{
    const res = await fetch(API_CASE_STEP, {method:'POST', body:JSON.stringify({case_state:caseState, user_action:'4S Info'})});
    const d = await res.json();
    $id('s4Info').innerHTML = d.finding;
  };
  $id('s4Ok').onclick=()=>{ stepCase('4S dokumentiert'); closeModal('modal4S'); };
  $id('s4Cancel').onclick=()=>closeModal('modal4S');
  openModal('modal4S');
}
function openDiagnosis() {
  const dxSel = $id('dxSelect');
  const list = ['ACS','Asthma/Bronchialobstruktion','COPD-Exazerbation','Lungenembolie','Sepsis','Metabolische Entgleisung','Schlaganfall','Krampfanfall','Hypoglykämie','Polytrauma','Fraktur','Fieberkrampf'];
  dxSel.innerHTML = list.map(x=>`<option>${x}</option>`).join('');
  $id('dxOk').onclick=()=>{ stepCase(`Verdachtsdiagnose: ${dxSel.value} | Prio: ${$id('dxPrio').value}`); closeModal('modalDx'); };
  $id('dxCancel').onclick=()=>closeModal('modalDx');
  openModal('modalDx');
}
function openImmo() {
  if(!caseState) return;
  $id('immoOk').onclick = () => { stepCase(`Immobilisation: ${$id('immoMat').value} an ${$id('immoLoc').value}`); closeModal('modalImmo'); };
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
  loc.forEach(l => { const el = document.getElementById(`body_${l}`); if(el) el.setAttribute('fill', '#f87171'); });
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
        // Wir bauen einen String, der das Wort "Übergabe" enthält, damit das Backend es erkennt
        const text = `Übergabe: SINNHAFT: I:${$id('s_ident').value} | N:${$id('s_event').value} | N:${$id('s_prio').value} | H:${$id('s_action').value} | A:${$id('s_anam').value}`;
        
        stepCase(text);
        
        // Modal schließen
        closeModal('modalHandover');
        
        // Kurze Verzögerung, dann automatisch beenden?
        // Besser: Der User klickt danach selbst auf "Debriefing" oder wir triggern es manuell?
        // User soll aktiv beenden.
    };
    
    $id('handoverCancel').onclick = () => closeModal('modalHandover');
    openModal('modalHandover');
}