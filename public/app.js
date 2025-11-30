// ===============================================================
// medicIQ – App Logic (Realism Edition: Better EKG, Smart Audio)
// ===============================================================

const API_CASE_NEW  = '/.netlify/functions/case-new';
const API_CASE_STEP = '/.netlify/functions/case-step';

// CONSTANTS
const ACTIONS = {
  X: [ { label: 'Nach krit. Blutungen suchen', token: 'Blutungscheck' }, { label: 'Keine Blutung feststellbar', token: 'X unauffällig' }, { label: 'Druckverband anlegen', token: 'Druckverband' }, { label: 'Tourniquet anlegen', token: 'Tourniquet' }, { label: 'Beckenschlinge anlegen', token: 'Beckenschlinge' }, { label: 'Woundpacking', token: 'Hämostyptikum' } ],
  A: [ { label: 'Esmarch-Handgriff', token: 'Esmarch' }, { label: 'Absaugen', token: 'Absaugen' }, { label: 'Mundraumkontrolle', token: 'Mundraumkontrolle' }, { label: 'Guedel-Tubus', token: 'Guedel' }, { label: 'Wendel-Tubus', token: 'Wendel' }, { label: 'Beutel-Masken-Beatmung', token: 'Beutel-Masken-Beatmung' } ],
  B: [ { label: 'AF messen (zählen)', token: 'AF messen' }, { label: 'SpO₂ messen', token: 'SpO2 messen' }, { label: 'Lunge auskultieren', token: 'Lunge auskultieren' }, { label: 'Sauerstoff geben', special: 'O2' } ],
  C: [ { label: 'RR messen', token: 'RR messen' }, { label: 'Puls messen', token: 'Puls messen' }, { label: 'pDMS prüfen', token: 'pDMS Kontrolle' }, { label: '12-Kanal-EKG', special: 'EKG' }, { label: 'i.V. Zugang legen', token: 'i.V. Zugang legen' }, { label: 'Volumen 500 ml', token: 'Volumen 500 ml' } ],
  D: [ { label: 'GCS erheben', token: 'GCS erheben' }, { label: 'Pupillen prüfen', token: 'Pupillen' }, { label: 'BZ messen', token: 'BZ messen' } ],
  E: [ { label: 'Bodycheck (Text)', token: 'Bodycheck' }, { label: 'Bodycheck (Bild)', special: 'BODYMAP' }, { label: 'pDMS prüfen', token: 'pDMS Kontrolle' }, { label: 'Immobilisation / Schienung', special: 'IMMO' }, { label: 'Wärmeerhalt', token: 'Wärmeerhalt' }, { label: 'Temp messen', token: 'Temperatur messen' }, { label: 'Oberkörper hoch', token: 'Oberkörper hoch lagern' } ]
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

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
    // 1. Init UI
    renderPanel('X');
    updateUI(false); 
    
    // 2. Attach Listeners Safely
    bindEvent('btnSound', 'click', (e) => {
        soundEnabled = !soundEnabled;
        e.target.textContent = soundEnabled ? "🔊 An" : "🔇 Aus";
        
        // Monitor Sound umschalten
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
    caseState = d.case || d; // Fallback
    
    document.getElementById('caseStatus').textContent = `Aktiv: ${caseState.specialty}`;
    document.getElementById('caseScore').textContent = 'Score: 0';
    renderProgress([]);
    showHint('Beginne mit XABCDE.');

    // START DISPLAY & AUDIO
    addMsg(`<strong>Fallstart:</strong> ${caseState.story}`);

    // LOGIK: NUR den Dialog sprechen. Keine Story-Vorlesung mehr.
    if (caseState.intro_dialogue) {
        setTimeout(() => speak(caseState.intro_dialogue), 500);
    } 
    // Falls kein Dialog da ist, bleibt es still (Realismus: Du kommst an und musst erst schauen)

    // Monitor starten, falls Sound an ist
    if(soundEnabled) startMonitorLoop();

  } catch(e) {
    // FALLBACK LOCAL
    caseState = { 
        id:'local', 
        specialty:selectedSpec, 
        steps_done:[], 
        history:[], 
        score:0, 
        vitals:{}, 
        hidden: { ekg_pattern: 'sinus' },
        story: "⚠️ Offline-Modus: Server nicht erreichbar." 
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
      
      // FIX: Monitor-Sound SOFORT aktualisieren, nicht warten
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
        
        // LOGIK: Sprachausgabe stumm schalten für normale Befunde
        // Wir wollen nur Patientendialog. Da wir aktuell keine getrennten Dialoge für den Verlauf haben,
        // lassen wir die KI hier schweigen. Das wirkt professioneller.
        // Falls du willst, dass sie doch spricht, nimm den Kommentar raus:
        /*
        const isDoku = txt.toLowerCase().includes('doku');
        if(d.finding && !isSystemTick && !isDoku) {
            speak(d.finding);
        }
        */
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
      stopMonitorLoop(); // Monitor aus bei Ende
      document.getElementById('caseStatus').textContent = 'Fall beendet.';
    }
  } catch(e) {
    addMsg(`Fehler: ${e.message}`);
  }
}

// ... (renderPanel, renderVitals, Timer Functions bleiben gleich wie vorher) ...
// Ich füge sie hier der Vollständigkeit halber ein:

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
  if(el) {
      el.classList.remove('hidden');
      el.textContent = "00:00";
  }
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
    
    // Check if Monitor connected (Puls is visible)
    if(!visibleVitals.Puls) {
        monitorTimeout = setTimeout(scheduleBeep, 1000);
        return;
    }

    let hrVal = parseFloat(String(visibleVitals.Puls).match(/\d+/)?.[0] || 60);
    if(hrVal <= 0) hrVal = 60;

    let spo2Val = 99;
    if(visibleVitals.SpO2) {
        spo2Val = parseFloat(String(visibleVitals.SpO2).match(/\d+/)?.[0] || 98);
    }

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

// --- EKG VISUAL UPDATE ---
function openEKG() {
    if(!caseState) return;
    const type = caseState.hidden?.ekg_pattern || "sinus";
    const line = $id('ekgLine');
    const txt  = $id('ekgText');
    line.classList.add('ekg-anim');
    
    // REALE EKG KURVEN (SVG Path Data)
    // Wir nutzen 'd' Attribute (path) statt 'points' (polyline) für Kurven
    let pathData = "";
    
    // Helper für Sinus-Kurve (wiederholend)
    const pWave = "c 2 -5, 5 -5, 8 0 ";   // Kleine Welle
    const segment = "l 5 0 ";            // Gerade
    const qrs = "l 2 5 l 3 -45 l 3 55 l 2 -15 "; // Zacke hoch/runter
    const tWave = "c 5 -10, 10 -10, 15 0 "; // Breite Welle
    const base = "l 10 0 "; // Pause
    
    // Bauen wir den Pfadstring zusammen
    // M = MoveTo, l = lineTo relative, c = curveTo relative
    
    if(type === "sinus") {
        // Ein Loop besteht aus ca 60px breite
        let d = "M 0 75 ";
        for(let i=0; i<8; i++) {
             d += base + pWave + segment + qrs + segment + tWave + base;
        }
        // Damit es ein path ist, müssen wir das Element ändern
        // Da wir im HTML ein <polyline> haben, müssen wir es per JS zu <path> ändern
        // ODER wir nutzen eine sehr dichte Polyline für "Fake-Kurven". 
        // BESSER: Wir tauschen im HTML <polyline> gegen <path> aus.
        // Quick Fix via JS:
        const svg = document.getElementById('ekgSvg');
        svg.innerHTML = `<path id="ekgLine" d="${d}" fill="none" stroke="#00ff00" stroke-width="2" class="ekg-anim" />`;
        
        txt.textContent = "Monitorbild (Ableitung II) - Sinus";
        txt.style.color = "#0f766e";
        
    } else if (type === "vt") {
        // Breite Zacken
        let d = "M 0 75 ";
        for(let i=0; i<15; i++) {
            d += "l 10 -40 l 10 80 l 5 -40 "; 
        }
        const svg = document.getElementById('ekgSvg');
        svg.innerHTML = `<path id="ekgLine" d="${d}" fill="none" stroke="#ef4444" stroke-width="2" class="ekg-anim" />`;
        
        txt.textContent = "Monitorbild - VT (Puls prüfen!)";
        txt.style.color = "#ef4444";
    } else {
        // Asystolie
        const svg = document.getElementById('ekgSvg');
        svg.innerHTML = `<path id="ekgLine" d="M 0 75 L 400 75" fill="none" stroke="#ef4444" stroke-width="2" class="ekg-anim" />`;
        
        txt.textContent = "Monitorbild - Asystolie";
        txt.style.color = "#ef4444";
    }

    $id('ekgClose').onclick = () => closeModal('modalEKG');
    openModal('modalEKG');
    stepCase('12-Kanal-EKG');
}

// ... Restliche Funktionen (openOxygen, openNA, openAFCounter...) bleiben gleich ...
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
    if(d.finding) speak(d.finding);
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
    if(d.finding) speak(d.finding);
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
    if(d.finding) speak(d.finding);
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
    speak("Fall beendet. Hier ist dein Debriefing.");
  } catch(e){}
}