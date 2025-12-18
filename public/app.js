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
      // NEU: Für verschluckte Nüsse/Bolus
      { label: 'Rückenschläge / Heimlich', token: 'Fremdkörpermanöver' },
      { label: 'Guedel-Tubus', token: 'Guedel' }, 
      { label: 'Wendel-Tubus', token: 'Wendel' }, 
      { label: 'Beutel-Masken-Beatmung', token: 'Beutel-Masken-Beatmung' } 
  ],
  B: [ 
      { label: 'AF messen (zählen)', token: 'AF messen', instant: true }, 
      { label: 'SpO₂ messen', token: 'SpO2 messen', instant: true }, 
      { label: 'Lunge auskultieren', token: 'Lunge auskultieren', instant: true }, 
      { label: 'Sauerstoff geben', special: 'O2' },
      // NEU: Chest Seal für Thorax-Trauma
      { label: 'Chest Seal (Ventilverband)', token: 'Chest Seal kleben' } 
  ],
  C: [ 
      { label: 'RR messen', token: 'RR messen', instant: true }, 
      { label: 'Puls messen', token: 'Puls messen', instant: true }, 
      // NEU: Die wichtigste Maßnahme überhaupt!
      { label: 'REANIMATION (CPR) Starten', token: 'CPR Starten', instant: true },
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
      { label: 'Oberkörper hoch', token: 'Oberkörper hoch lagern' },
      // NEU: Wichtige Trauma-Maßnahmen
      { label: 'Wunde versorgen / kühlen', token: 'Wundversorgung' },
      { label: 'Augen spülen / abdecken', token: 'Augenversorgung' },
      { label: 'Stabile Seitenlage', token: 'Stabile Seitenlage' }, 
      { label: 'Beine hoch (Schock)', token: 'Schocklagerung' }
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
    renderDropdowns();
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
    bindEvent('finishCase', 'click', openHandover);  // Der rote Button oben
bindEvent('btnSinnhaft', 'click', openHandover); // Der neue SINNHAFT-Button unten
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
        
        if(t==='NEXUS') openNexus();
        if(t==='POLYTRAUMA') openPolytrauma();
      });
    });

   
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

let ekgLoopReq = null;

function openEKG() {
    if(!caseState) return;
    openModal('modalEKG');

    const canvas = document.getElementById('ekgCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    const status = document.getElementById('ekgStatusText');
    const sel = document.getElementById('leadSelect');

    let x = 0;
    const hf = parseInt(String(visibleVitals.Puls || 80).match(/\d+/)?.[0] || 80);
    const hasSpO2 = !!visibleVitals.SpO2;
    const type = caseState.hidden?.ekg_pattern || "sinus";
    const pathol = (caseState.hidden?.diagnosis_keys || []).join(' ').toLowerCase();
    const isSTEMI = pathol.includes('hinterwand') || pathol.includes('stemi') || pathol.includes('inferior');

    // 1. Initialisierung: Einmalig das Raster zeichnen
    function drawGrid() {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Millimeter-Gitter (1mm = 10px)
        ctx.lineWidth = 0.5;
        for (let i = 0; i < canvas.width; i += 10) {
            ctx.strokeStyle = (i % 50 === 0) ? '#222' : '#111';
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        }
        for (let i = 0; i < canvas.height; i += 10) {
            ctx.strokeStyle = (i % 50 === 0) ? '#222' : '#111';
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
        }
    }

    drawGrid();

    let lastY_EKG = null;
    let lastY_Pleth = null;

    function animate() {
        // 2. Scanner-Effekt: Löscht nur einen kleinen Streifen vor dem Strahl
        // WICHTIG: Wir füllen hier mit Schwarz, um die Kurve zu löschen, 
        // zeichnen aber das Raster in diesem Streifen sofort wieder nach.
        ctx.fillStyle = '#000';
        ctx.fillRect(x, 0, 20, canvas.height);
        
        // Raster im gelöschten Bereich wiederherstellen
        ctx.lineWidth = 0.5;
        for(let i=0; i<20; i++) {
            let currX = x + i;
            if(currX % 10 === 0) {
                ctx.strokeStyle = (currX % 50 === 0) ? '#222' : '#111';
                ctx.beginPath(); ctx.moveTo(currX, 0); ctx.lineTo(currX, canvas.height); ctx.stroke();
            }
        }

        // 3. Kurven-Mathematik
        const t_ekg = x / 65; 
        const cycle = (t_ekg * (hf / 60)) % 1.0;
        let yEKG = 0;
        if (type === 'sinus') {
            if (cycle < 0.1) yEKG = Math.sin(cycle * Math.PI * 10) * -10; 
            else if (cycle > 0.15 && cycle < 0.17) yEKG = 12; 
            else if (cycle >= 0.17 && cycle < 0.21) yEKG = -85; 
            else if (cycle >= 0.21 && cycle < 0.24) yEKG = 35; 
            else if (cycle > 0.35 && cycle < 0.55) {
                let stLift = (isSTEMI && ['II','III','aVF'].includes(sel.value)) ? -45 : 0;
                yEKG = (Math.sin((cycle - 0.35) * Math.PI * 5) * -15) + stLift;
            }
        }

        const drawY_EKG = 130 + yEKG;
        const drawY_Pleth = 280 + (hasSpO2 ? Math.sin(x/40)*20 : 0);

        // 4. Zeichnen der Linien
        ctx.lineWidth = 2.5;
        if (lastY_EKG !== null && x > 0) {
            ctx.strokeStyle = '#00ff00';
            ctx.beginPath(); ctx.moveTo(x - 2, lastY_EKG); ctx.lineTo(x, drawY_EKG); ctx.stroke();
            if(hasSpO2) {
                ctx.strokeStyle = '#3b82f6';
                ctx.beginPath(); ctx.moveTo(x - 2, lastY_Pleth); ctx.lineTo(x, drawY_Pleth); ctx.stroke();
            }
        }

        lastY_EKG = drawY_EKG;
        lastY_Pleth = drawY_Pleth;
        x += 2;
        if (x >= canvas.width) { x = 0; lastY_EKG = null; }

        ekgLoopReq = requestAnimationFrame(animate);
    }

    // Buttons & Close
    sel.onchange = () => { drawGrid(); x = 0; lastY_EKG = null; };
    $id('ekgClose').onclick = () => { cancelAnimationFrame(ekgLoopReq); closeModal('modalEKG'); };
    
    animate();
    stepCase('12-Kanal-EKG');
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

    if(statusEl) statusEl.textContent = 'Fall beendet.';

    if (d.debrief) {
        // NEU: Fügt das gesamte Debriefing-HTML (inkl. Farben) vom Server ein
        addMsg(d.debrief); 
    } else { addMsg("⚠️ Auswertung leer."); }
  } catch(e) {
    caseState = null; updateUI(false);
    addMsg(`❌ Fehler: ${e.message}`);
  }
}

// --- UI HELPERS & MODALS ---
// --- UI HELPERS & MODALS (FIX: renderPanel durch renderDropdowns ersetzt) ---

function renderDropdowns() {
    const phases = ['X', 'A', 'B', 'C', 'D', 'E'];
    const panel = document.getElementById('actionPanel');
    if (!panel) return;
    panel.innerHTML = '';
    
    phases.forEach(k => {
        const actions = ACTIONS[k] || [];
        if (actions.length === 0) return;

        // 1. Erstelle das Dropdown-Element (Select-Box)
        const select = document.createElement('select');
        select.className = 'action-dropdown';
        select.setAttribute('data-phase', k);

        // 2. Erstelle die Standard-Option (Label)
        const defaultOption = document.createElement('option');
        defaultOption.textContent = `${k} – ${
            k === 'X' ? 'Exsanguination' : 
            k === 'A' ? 'Airway' : 
            k === 'B' ? 'Breathing' : 
            k === 'C' ? 'Circulation' : 
            k === 'D' ? 'Disability' : 
            'Exposure'
        }`;
        defaultOption.value = '';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        select.appendChild(defaultOption);

        // 3. Füge die Aktionen als Optionen hinzu
        actions.forEach(a => {
            const option = document.createElement('option');
            option.textContent = a.label;
            option.value = a.token || a.special;
            option.setAttribute('data-instant', a.instant ? 'true' : 'false');
            option.setAttribute('data-special', a.special || '');
            select.appendChild(option);
        });

        // 4. Erstelle den Container und hänge das Dropdown an
        const container = document.createElement('div');
        container.className = 'action-dropdown-container';
        container.appendChild(select);
        panel.appendChild(container);

        // 5. Füge den Event Listener hinzu
        select.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const token = selectedOption.value;
            const isInstant = selectedOption.dataset.instant === 'true';
            const specialAction = selectedOption.dataset.special;
            
            // Setze den Select wieder auf den Standardwert
            e.target.value = '';

            if (specialAction) {
                // Spezialbehandlung (Modals)
                if(specialAction === 'O2') openOxygen();
                else if(specialAction === 'NA') openNA();
                else if(specialAction === 'IMMO') openImmo();
                else if(specialAction === 'BODYMAP') openBodyMap();
                else if(specialAction === 'EKG') openEKG();
            } else if (isInstant) {
                // Sofortige Aktion (z.B. Messung)
                stepCase(token);
            } else {
                // Geplante Aktion (Warteschlange)
                queue.push({ label: selectedOption.textContent, token: token }); 
                renderQueue();
            }
        });
    });
}
// ... (Restliche UI-Funktionen folgen hier)

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
  
  // Setze den Initialwert beim Öffnen, falls bereits vorhanden
  const initialPainValue = caseState?.hidden?.pain?.nrs || 0;
  r.value = initialPainValue;
  v.textContent = initialPainValue;

  $id('nrsFetch').onclick = async () => {
    const res = await fetch(API_CASE_STEP, {method:'POST', body:JSON.stringify({case_state:caseState, user_action:'Schmerz Info'})});
    const d = await res.json();
    $id('nrsInfo').innerHTML = d.finding; 
    
    // NEU: Setze den NRS-Wert aus dem Fall nach Abruf der Infos
    const painValue = caseState?.hidden?.pain?.nrs || 0;
    r.value = painValue;
    v.textContent = painValue;
  };
  
  $id('nrsOk').onclick=()=>{ stepCase(`NRS ${r.value}`); closeModal('modalNRS'); };
  $id('nrsCancel').onclick=()=>closeModal('modalNRS');
  openModal('modalNRS');
}
function openBEFAST() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  $id('t_time').value = `${hours}:${minutes}`;
  $id('befastFetch').onclick=async()=>{
    const res = await fetch(API_CASE_STEP, {method:'POST', body:JSON.stringify({case_state:caseState, user_action:'BEFAST Info'})});
    const d = await res.json();
    $id('befastInfo').innerHTML = d.finding; 
  };
  $id('befastOk').onclick=()=>{ stepCase('BEFAST dokumentiert'); closeModal('modalBEFAST'); };
  $id('befastCancel').onclick=()=>closeModal('modalBEFAST');
  openModal('modalBEFAST');
}

function openNexus() {
  $id('nexusFetch').onclick=async()=>{
    const res = await fetch(API_CASE_STEP, {method:'POST', body:JSON.stringify({case_state:caseState, user_action:'NEXUS Info'})});
    const d = await res.json();
    $id('nexusInfo').innerHTML = d.finding; 
  };
  $id('nexusOk').onclick=()=>{ stepCase('NEXUS Kriterien geprüft'); closeModal('modalNEXUS'); };
  $id('nexusCancel').onclick=()=>closeModal('modalNEXUS');
  openModal('modalNEXUS');
  // Setze die Checkboxen auf Basis des hidden State, falls vorhanden
  if (caseState?.hidden?.nexus_criteria) {
    const n = caseState.hidden.nexus_criteria;
    // Setze alle Checkboxen auf false, bevor du die Fall-Daten anwendest (sauberes Modal)
    $id('n1').checked = false; $id('n2').checked = false; $id('n3').checked = false; $id('n4').checked = false; $id('n5').checked = false;
    if(n.c1) $id('n1').checked = true; 
    if(n.c2) $id('n2').checked = true; 
    if(n.c3) $id('n3').checked = true; 
    if(n.c4) $id('n4').checked = true; 
    if(n.c5) $id('n5').checked = true;
  }
}

function openPolytrauma() {
  $id('polyFetch').onclick=async()=>{
    const res = await fetch(API_CASE_STEP, {method:'POST', body:JSON.stringify({case_state:caseState, user_action:'Polytrauma Info'})});
    const d = await res.json();
    $id('polyInfo').innerHTML = d.finding; 
  };
  $id('polyOk').onclick=()=>{ stepCase('Polytrauma Kriterien geprüft'); closeModal('modalPolytrauma'); };
  $id('polyCancel').onclick=()=>closeModal('modalPolytrauma');
  openModal('modalPolytrauma');
}

function openSampler() {
  $id('samplerFetch').onclick=async()=>{
    const res = await fetch(API_CASE_STEP, {
        method:'POST', 
        body:JSON.stringify({case_state:caseState, user_action:'SAMPLER Info'})
    });
    const d = await res.json();
    
    // WICHTIG: Text oben anzeigen
    if(d.finding) document.getElementById('samplerInfo').innerHTML = d.finding;

    // Felder automatisch füllen
    // In openSampler()
const S = caseState?.anamnesis?.SAMPLER || {};
if($id('s_sympt'))  $id('s_sympt').value  = S.S || '';
if($id('s_allerg')) $id('s_allerg').value = S.A || ''; // Fix für Allergien
if($id('s_med'))    $id('s_med').value    = S.M || '';
if($id('s_hist'))   $id('s_hist').value   = S.P || '';
if($id('s_last'))   $id('s_last').value   = S.L || '';
if($id('s_events')) $id('s_events').value = S.E || '';
if($id('s_risk'))   $id('s_risk').value   = S.R || '';
  };
  $id('samplerOk').onclick=()=>{ stepCase('SAMPLER doku'); closeModal('modalSampler'); };
  $id('samplerCancel').onclick=()=>closeModal('modalSampler');
  openModal('modalSampler');
}

function openFourS() {
  const sData = caseState?.scene_4s || {};
  
  // 1. Checkboxen beim Öffnen basierend auf den Fall-Daten setzen
  // Wir prüfen, ob im Text "Keine Gefahr" oder "Sicher" steht
  if($id('s1')) $id('s1').checked = sData.sicherheit && !sData.sicherheit.toLowerCase().includes("gefahr");
  if($id('s2')) $id('s2').checked = !!sData.szene;
  if($id('s3')) $id('s3').checked = !!sData.sichtung_personen;
  if($id('s4')) $id('s4').checked = !!sData.support_empfehlung;

  // 2. Info-Button Logik (Daten vom Server holen)
  $id('s4Fetch').onclick = async () => {
    const res = await fetch(API_CASE_STEP, {
      method:'POST', 
      body:JSON.stringify({case_state:caseState, user_action:'4S Info'})
    });
    const d = await res.json();
    if(d.finding) $id('s4Info').innerHTML = d.finding;
    
    // Nach dem Abrufen die Sicherheit-Box explizit haken, wenn sicher
    if(d.finding && d.finding.toLowerCase().includes("sicherheit: keine gefahr")) {
        $id('s1').checked = true;
    }
  };

  $id('s4Ok').onclick=()=>{ stepCase('4S dokumentiert'); closeModal('modal4S'); };
  $id('s4Cancel').onclick=()=>closeModal('modal4S');
  openModal('modal4S');
}
// --- DIAGNOSEN KATALOG (Update: 85 Fälle) ---
const DIAGNOSES_MAP = {
  internistisch: [
    "ACS / Herzinfarkt (STEMI/NSTEMI)",
    "Akutes Abdomen / Ileus",
    "Allergische Reaktion / Anaphylaxie",
    "Aortendissektion / Aortenaneurysma",
    "COPD Exazerbation",
    "Exsikkose / Synkope",
    "Gastroenteritis / Norovirus",
    "Gastrointestinale Blutung (GI-Blutung)",
    "Herzrhythmusstörung / Vorhofflimmern",
    "Hitzschlag / Hitzeschaden",
    "Hyperglykämie / Ketoazidose",
    "Hypertoner Notfall / Hypertensive Krise",
    "Hypoglykämie",
    "Intoxikation (Alkohol / C2)",
    "Intoxikation (Medikamente / Suizidversuch)",
    "Lungenembolie (LAE)",
    "Lungenödem / Herzinsuffizienz",
    "Myokarditis / Perikarditis",
    "Nierenkolik / Urolithiasis",
    "Pneumonie / Sepsis"
  ],
  neurologisch: [
    "Akinetische Krise (Parkinson)",
    "Akute Psychose / Wahn",
    "Bandscheibenvorfall / Cauda-Equina",
    "Commotio Cerebri / SHT (Leicht)",
    "Epiduralhämatom / SHT (Schwer)",
    "Generalisierter Krampfanfall (Grand Mal)",
    "Hirnblutung (ICB / SAB)",
    "Hirntumor / Erstmanifestation Krampf",
    "Hypoglykämie (neurologisch)",
    "Intoxikation (Alkoholentzug / Delir)",
    "Intoxikation (CO / Kohlenmonoxid)",
    "Intoxikation (Opiate / Drogen)",
    "Meningitis / Enzephalitis",
    "Migräne / Status Migraenosus",
    "Multiple Sklerose (Schub)",
    "Psychogener Krampfanfall (PNES)",
    "Schlaganfall (Apoplex)",
    "Sepsis (Urosepsis / Enzephalopathie)",
    "Subduralhämatom (chronisch)",
    "TIA (Transitorische Ischämische Attacke)",
    "Transiente Globale Amnesie (TGA)"
  ],
  trauma: [
    "Amputationsverletzung",
    "Augenverletzung / Perforation",
    "Beckenfraktur",
    "Commotio Cerebri / SHT",
    "Eviszeration (Offenes Bauchtrauma)",
    "Explosionstrauma / Handverletzung",
    "Femurschaftfraktur",
    "Hundebiss / Tierbiss",
    "Instabiler Thorax / Rippenserienfraktur",
    "Knalltrauma / Tinnitus",
    "Offene Fraktur (Unterschenkel)",
    "Offener Pneumothorax (Saugende Wunde)",
    "Patellaluxation",
    "Perthes-Syndrom (Traumatische Asphyxie)",
    "Pfählungsverletzung",
    "Polytrauma (Sturz aus Höhe)",
    "Querschnittslähmung / Wirbelsäulentrauma",
    "Radiusfraktur (Unterarm)",
    "Schädelbasisbruch",
    "Schenkelhalsfraktur",
    "Skalpierungsverletzung",
    "Spannungspneumothorax",
    "Stromunfall",
    "Stumpfes Bauchtrauma (Milz/Leber)",
    "Suizidversuch (Strangulation)",
    "Verbrennung (Thermisch)",
    "Verätzung (Chemisch)"
  ],
  paediatrisch: [
    "Alkoholintoxikation (Jugendlich)",
    "Anaphylaxie (Kind)",
    "Appendizitis / Akutes Abdomen",
    "Exsikkose / Gastroenteritis",
    "Fieberkrampf",
    "Fremdkörperaspiration (Bolus)",
    "Grünholzfraktur",
    "Hodentorsion",
    "Invagination",
    "Ketoazidose (Erstmanifestation Typ 1)",
    "Kindeswohlgefährdung / Misshandlung",
    "Meningokokkensepsis",
    "Pseudokrupp",
    "Reanimation (SIDS)",
    "SHT (Fahrradsturz)",
    "SHT (Wickeltischsturz)",
    "Sekundäres Ertrinken / Beinahe-Ertrinken",
    "Status Asthmaticus (Kind)",
    "Verbrühung",
    "Vergiftung / Ingestion (Reiniger)"
  ]
};
// --- NEUE DIAGNOSE FUNKTION ---
function openDiagnosis() {
  const modal = document.getElementById('modalDx');
  const specSel = document.getElementById('dxSpec');
  const dxSel = document.getElementById('dxSelect');
  const prioSel = document.getElementById('dxPrio');
  const note = document.getElementById('dxNote');

  // Reset Fields
  prioSel.value = "mittel (gelb)";
  note.value = "";

  // 1. Fachrichtung vorwählen (basierend auf dem aktuellen Fall)
  if (caseState && caseState.specialty) {
      // Mapping falls Fall-Kategorien slightly anders heißen (z.B. Kleinschreibung)
      let currentSpec = caseState.specialty.toLowerCase();
      if (DIAGNOSES_MAP[currentSpec]) {
          specSel.value = currentSpec;
      }
  }

  // 2. Funktion zum Rendern der Liste
  const renderList = () => {
      const selectedSpec = specSel.value;
      const diagnoses = DIAGNOSES_MAP[selectedSpec] || [];
      
      // Alphabetisch sortieren für bessere Übersicht
      diagnoses.sort();

      dxSel.innerHTML = diagnoses.map(d => `<option value="${d}">${d}</option>`).join('');
      
      // Fallback, falls Liste leer ist (sollte nicht passieren)
      if(diagnoses.length === 0) {
          dxSel.innerHTML = `<option>-- Keine Diagnosen verfügbar --</option>`;
      }
  };

  // 3. Event Listener: Wenn User oben Fachrichtung ändert, Liste unten anpassen
  specSel.onchange = renderList;

  // 4. Initiale Liste rendern
  renderList();

  // 5. Speicher-Logik
  document.getElementById('dxOk').onclick = () => { 
      stepCase(`Verdachtsdiagnose: ${dxSel.value} (${specSel.value}) | Prio: ${prioSel.value} | Notiz: ${note.value}`); 
      closeModal('modalDx'); 
  };
  
  document.getElementById('dxCancel').onclick = () => closeModal('modalDx');
  
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
    
    // Felder leeren für neue Eingabe
    $id('s_ident').value = ""; 
    $id('s_event').value = ""; 
    $id('s_prio').value = ""; 
    $id('s_action').value = ""; 
    $id('s_anam').value = "";
    
    // Verknüpfung für den "Übergeben & Beenden" Button
    const okBtn = document.getElementById('handoverOk');
    if (okBtn) {
        okBtn.onclick = async () => {
            const ident = $id('s_ident').value.trim();
            if (ident.length < 2) {
                 alert('Bitte füllen Sie mindestens die Identifikation aus.');
                 return;
            }

            const text = `Übergabe: SINNHAFT: I:${ident} | N:${$id('s_event').value} | H:${$id('s_prio').value} | A:${$id('s_action').value} | A:${$id('s_anam').value}`;
            
            // WICHTIG: Erst Daten senden, dann Modal schließen
            await stepCase(text); 
            closeModal('modalHandover');
        };
    }
    
    // Verknüpfung für den "Abbrechen" Button
    const cancelBtn = document.getElementById('handoverCancel');
    if (cancelBtn) {
        cancelBtn.onclick = () => closeModal('modalHandover');
    }

    openModal('modalHandover');
}
let ekgAnimationFrame = null;

function openEKG() {
    if(!caseState) return;
    openModal('modalEKG');
    
    const canvas = document.getElementById('ekgCanvas');
    const ctx = canvas.getContext('2d');
    const txt = document.getElementById('ekgText');
    const sel = document.getElementById('leadSelect');

    let x = 0;
    const speed = 2.5; // Geschwindigkeit des Strahls
    
    // Fall-Daten vorbereiten
    const type = caseState.hidden?.ekg_pattern || "sinus";
    const pathology = (caseState.hidden?.diagnosis_keys || []).join(' ').toLowerCase();
    const isSTEMI = pathology.includes('hinterwand') || pathology.includes('stemi');
    const hf = parseInt(String(visibleVitals.Puls || 80).match(/\d+/)?.[0]);

    function drawLoop() {
        // 1. "Scanner"-Effekt: Vor dem Strahl leicht löschen
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(x, 0, 20, canvas.height);
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 20, 0, 5, canvas.height);

        // 2. Hintergrundraster (nur alle x Frames zeichnen für Performance)
        if (x % 40 === 0) {
            ctx.strokeStyle = '#111';
            ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke();
        }

        // 3. EKG Kurve berechnen (Mathematisches Modell für P-QRS-T)
        const yBaseEKG = 120;
        let yEKG = 0;
        const t = (x / 100) * (hf / 60); // Zeitfaktor basierend auf HF
        
        // Simulierter Herzschlag (Sinus-Modell)
        const cycle = t % 1.0;
        if (cycle < 0.1) yEKG = Math.sin(cycle * Math.PI * 10) * -10; // P-Welle
        else if (cycle > 0.15 && cycle < 0.18) yEKG = 15; // Q
        else if (cycle >= 0.18 && cycle < 0.22) yEKG = -80; // R
        else if (cycle >= 0.22 && cycle < 0.26) yEKG = 30; // S
        else if (cycle > 0.35 && cycle < 0.55) {
            // T-Welle + ST-Hebung Logik
            let stLift = (isSTEMI && ['II','III','aVF'].includes(sel.value)) ? -25 : 0;
            yEKG = (Math.sin((cycle-0.35) * Math.PI * 5) * -15) + stLift;
        }

        // 4. Pleth Kurve (SpO2)
        const yBasePleth = 300;
        const hasSpO2 = !!visibleVitals.SpO2;
        let yPleth = hasSpO2 ? Math.sin(t * Math.PI * 2) * -20 + Math.sin(t * Math.PI * 4) * -5 : 0;

        // 5. Zeichnen
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        
        // EKG (Grün)
        ctx.strokeStyle = '#00ff00';
        ctx.beginPath();
        ctx.moveTo(x - speed, canvas.lastY || yBaseEKG);
        ctx.lineTo(x, yBaseEKG + yEKG);
        ctx.stroke();
        canvas.lastY = yBaseEKG + yEKG;

        // Pleth (Blau)
        if(hasSpO2) {
            ctx.strokeStyle = '#3b82f6';
            ctx.beginPath();
            ctx.moveTo(x - speed, canvas.lastPlethY || yBasePleth);
            ctx.lineTo(x, yBasePleth + yPleth);
            ctx.stroke();
            canvas.lastPlethY = yBasePleth + yPleth;
        }

        // 6. UI Updates
        x += speed;
        if (x > canvas.width) x = 0;

        ekgAnimationFrame = requestAnimationFrame(drawLoop);
    }

    // Diagnose-Text setzen
    if (isSTEMI) { txt.textContent = "⚠️ V.A. MYOKARDINFARKT (STEMI)"; txt.style.color = "#facc15"; }
    else if (type === "vt") { txt.textContent = "!!! VENTRIKULÄRE TACHYKARDIE !!!"; txt.style.color = "#ef4444"; }
    else { txt.textContent = "SINUSRHYTHMUS"; txt.style.color = "#00ff00"; }

    sel.onchange = () => { ctx.clearRect(0,0,canvas.width, canvas.height); x=0; };
    $id('ekgClose').onclick = () => { cancelAnimationFrame(ekgAnimationFrame); closeModal('modalEKG'); };
    
    drawLoop();
    stepCase('12-Kanal-EKG');
}