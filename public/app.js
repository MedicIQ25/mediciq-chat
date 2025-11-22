// ==============================================================
// medicIQ – Click-UI (nur Klicks) mit sichtbaren Vitalen nach Messung
// ==============================================================

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
document.querySelectorAll('.spec-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.spec-chip').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    selectedSpec = btn.dataset.spec;
  });
});

// Tools (Buttons unter den Tabs)
document.querySelectorAll('.schema-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool;
    if (tool) queue.push({ tool });
    renderQueue();
  });
});

let caseState = null;
let queue = [];
let visibleVitals = {};
let currentPanel = 'X';

const setStatus = text => statusEl.textContent = text;
const setScore = score => scoreEl.textContent = `Score: ${score}`;
const addMsg = text => {
  const div = document.createElement('div');
  div.innerHTML = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
};
const clearVisibleVitals = () => visibleVitals = {};
const renderVitals = () => {
  Object.entries(visibleVitals).forEach(([k, v]) => {
    const el = document.querySelector(`[data-vital="${k}"]`);
    if (el) el.textContent = v;
  });
};
const renderQueue = () => {
  queueList.innerHTML = queue.map((item, i) => `<li>${item.tool}</li>`).join('');
};
const stepCase = async (action) => {
  if (!caseState) return;
  try {
    const res = await fetch(API_CASE_STEP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, case: caseState })
    });
    const data = await res.json();
    if (data.vitals_update) {
      Object.assign(visibleVitals, data.vitals_update);
      renderVitals();
    }
    if (data.finding_text) {
      addMsg(`<strong>Befund:</strong> ${data.finding_text}`);
    }
    if (data.modal_type) {
      // Trigger Modal – passe an deine Modal-IDs an
      const modal = document.getElementById(`modal${data.modal_type.charAt(0).toUpperCase() + data.modal_type.slice(1)}`);
      if (modal) {
        // Füll Modal-Data (z.B. für SAMPLER)
        if (data.modal_data) {
          Object.entries(data.modal_data).forEach(([k, v]) => {
            const input = modal.querySelector(`[data-field="${k}"]`);
            if (input) input.value = v;
          });
        }
        modal.classList.remove('hidden');
      }
    }
    if (data.feedback) addMsg(`<strong>${action}:</strong> ${data.feedback}`);
    caseState.score += data.score_change || 0;
    setScore(caseState.score);
    caseState.steps_done.push(action);
  } catch (e) {
    addMsg(`<strong>Fehler:</strong> ${e.message}`);
  }
};

async function startCase() {
  setStatus('Fall wird erstellt...');
  try {
    const res = await fetch(API_CASE_NEW, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specialty: selectedSpec, role: roleSel.value })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    caseState = data;
    setStatus(`Fall aktiv: ${data.patient.name} (${data.specialty})`);
    setScore(0);
    clearVisibleVitals();
    renderVitals();
    addMsg(`<strong>Fallstart:</strong> ${data.story}`);
    showHint(data.solution.diagnosis); // Hint mit Diagnose
  } catch (e) {
    setStatus('Fehler beim Laden');
    addMsg(`<strong>Fehler:</strong> ${e.message}`);
  }
}

// Events
runBtn.addEventListener('click', runQueue);
clearBtn.addEventListener('click', () => { queue = []; renderQueue(); });
startBtn.addEventListener('click', startCase);
finishBtn.addEventListener('click', () => { if (caseState) stepCase('Fall beenden'); });

// Button-Events für Tools (erweitert)
document.querySelectorAll('.vital-btn').forEach(btn => {
  btn.addEventListener('click', () => stepCase(btn.dataset.action));
});
document.querySelectorAll('.finding-btn').forEach(btn => {
  btn.addEventListener('click', () => stepCase(btn.textContent));
});

// Init
clearVisibleVitals();
setStatus('Kein Fall aktiv.');
setScore(0);
addMsg('👋 Wähle Fachrichtung, starte Fall, erhebe Werte per Buttons.');