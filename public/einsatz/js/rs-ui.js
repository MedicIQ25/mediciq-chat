// ==========================================================================================
// medicIQ – Einsatz-Simulator Rettungssanitäter: Monitor, Töne, Untersuchungs-Fenster, PDF
// ==========================================================================================

// ------------------------------------------------------------------------------------------
// MONITOR (EKG + Pleth)
// ------------------------------------------------------------------------------------------
let canvas, ctx;
let scanX = 0, lastEcgY = 0, lastPlethY = 0;
let ekgAnimId = null, currentPhase = 0, lastFrameTime = Date.now(), beatLen = 1, beatIndex = 0, vesBeat = false;

function initEKG() {
    if (ekgAnimId) cancelAnimationFrame(ekgAnimId);
    canvas = document.getElementById('ekgCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    canvas.width = canvas.clientWidth || canvas.parentElement.clientWidth || 600;
    canvas.height = canvas.clientHeight || 150;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    lastEcgY = canvas.height * 0.35; lastPlethY = canvas.height * 0.8;
    scanX = 0; currentPhase = 0; lastFrameTime = Date.now();
    ekgAnimId = requestAnimationFrame(animate);
}

function getWave(t, peak, width, amp) { return amp * Math.exp(-Math.pow((t - peak) / width, 2)); }

function animate() {
    if (!canvas || !p.activeCase) { ekgAnimId = requestAnimationFrame(animate); return; }
    const now = Date.now(); let dt = now - lastFrameTime; if (dt > 100) dt = 16; lastFrameTime = now;
    const speed = 2.0, substeps = 4, dtStep = dt / substeps, dxStep = speed / substeps, h = canvas.height;
    ctx.fillStyle = '#000'; ctx.fillRect(scanX, 0, speed + 20, h);

    const ekgOn = p.monitorEkg || p.pads;
    const rhythm = p.isArrest ? p.rhythm : (p.activeCase.vitals.stemi ? 'STEMI' : p.rhythm);
    const cHR = p.isArrest ? 0 : p.hr;
    const hdm = p.isArrest && (p.helperHDM || p.playerHDM);

    for (let i = 0; i < substeps; i++) {
        if (cHR > 0 && !p.isArrest) {
            currentPhase += dtStep / ((60 / cHR) * 1000 * beatLen);
            if (currentPhase >= 1.0) {
                currentPhase -= 1.0; beatIndex++;
                beatLen = rhythm === 'VHF' ? 0.55 + Math.random() * 0.9 : 1;
                vesBeat = rhythm === 'VES' && beatIndex % 5 === 0;
            }
        } else { currentPhase += dtStep / 1000; if (currentPhase >= 1.0) currentPhase -= 1.0; }

        let ecgY = h * 0.35;
        if (!ekgOn) ecgY += (Math.random() * 2 - 1);
        else if (hdm) ecgY += Math.sin(now / 90) * (h * 0.18) + Math.random() * 8 - 4;
        else if (p.isArrest && rhythm === 'VF') ecgY += Math.sin(now / 45) * (h * 0.13) + Math.cos(now / 30) * (h * 0.07) + Math.random() * 6 - 3;
        else if (p.isArrest && rhythm === 'ASY') ecgY += (Math.random() * 2 - 1);
        else if (p.isArrest && rhythm === 'PEA') {
            ecgY += getWave(currentPhase, 0.22, 0.045, h * 0.08); ecgY -= getWave(currentPhase, 0.30, 0.075, h * 0.2);
            ecgY += getWave(currentPhase, 0.41, 0.06, h * 0.12);
        } else if (rhythm === 'VHF') {
            ecgY += Math.sin(now / 23) * 2 + Math.sin(now / 37) * 1.5; // Flimmerwellen, keine P-Welle
            ecgY += getWave(currentPhase, 0.27, 0.008, h * 0.04); ecgY -= getWave(currentPhase, 0.29, 0.008, h * 0.3); ecgY += getWave(currentPhase, 0.31, 0.008, h * 0.07);
            ecgY -= getWave(currentPhase, 0.45, 0.06, h * 0.05);
        } else if (vesBeat) {
            ecgY -= getWave(currentPhase, 0.28, 0.04, h * 0.32); ecgY += getWave(currentPhase, 0.4, 0.06, h * 0.15);
        } else {
            ecgY -= getWave(currentPhase, 0.15, 0.03, h * 0.04); ecgY += getWave(currentPhase, 0.27, 0.008, h * 0.035);
            ecgY -= getWave(currentPhase, 0.29, 0.008, h * 0.3); ecgY += getWave(currentPhase, 0.31, 0.008, h * 0.07);
            if (rhythm === 'STEMI') { ecgY -= getWave(currentPhase, 0.42, 0.08, h * 0.12); ecgY -= getWave(currentPhase, 0.52, 0.06, h * 0.08); }
            else ecgY -= getWave(currentPhase, 0.45, 0.06, h * 0.06);
        }

        let plethY = h * 0.8;
        if (!p.discovered.spo2 || p.isArrest || cHR < 5) plethY += (Math.random() * 1 - 0.5);
        else { plethY -= getWave(currentPhase, 0.25, 0.07, h * 0.14); plethY -= getWave(currentPhase, 0.45, 0.08, h * 0.05); }

        const nextX = scanX + dxStep;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#2ecc71'; ctx.moveTo(scanX, lastEcgY); ctx.lineTo(nextX, ecgY); ctx.stroke();
        ctx.beginPath(); ctx.lineWidth = 2.0; ctx.strokeStyle = '#00d2ff'; ctx.moveTo(scanX, lastPlethY); ctx.lineTo(nextX, plethY); ctx.stroke();
        lastEcgY = ecgY; lastPlethY = plethY; scanX = nextX;
        if (scanX >= canvas.width) scanX = 0;
    }
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 44, 16); ctx.fillRect(0, h * 0.62, 44, 16);
    ctx.font = '11px monospace'; ctx.fillStyle = '#2ecc71'; ctx.fillText(ekgOn ? 'EKG II' : 'EKG --', 4, 12);
    ctx.fillStyle = '#00d2ff'; ctx.fillText('Pleth', 4, h * 0.62 + 12);
    ekgAnimId = requestAnimationFrame(animate);
}

// ------------------------------------------------------------------------------------------
// TÖNE
// ------------------------------------------------------------------------------------------
let audioCtx, beepTimer, currentLungSound = null, currentAmbientSound = null, currentPatientSound = null, isMuted = false;

function initAudio() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { /* kein Audio verfügbar */ }
    if (!beepTimer) startMonitorBeep();
}
function toggleMute() {
    isMuted = !isMuted;
    const btn = document.getElementById('btn-mute'); if (btn) btn.textContent = isMuted ? '🔇' : '🔊';
    if (isMuted) [currentLungSound, currentAmbientSound, currentPatientSound].forEach(a => a && a.pause());
    else {
        if (currentAmbientSound && !p.inRTW) currentAmbientSound.play().catch(() => {});
        if (currentPatientSound && !p.isArrest && p.gcs > 3 && p.activeCase?.patientSound) currentPatientSound.play().catch(() => {});
    }
}
function stopAllSounds() { [currentLungSound, currentAmbientSound, currentPatientSound].forEach(a => a && a.pause()); clearTimeout(beepTimer); beepTimer = null; }
function playMonitorBeep() {
    if (!audioCtx || isMuted || p.isArrest || p.hr <= 0 || p.caseFinished) return;
    if (!p.discovered.spo2 && !p.monitorEkg) return;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.frequency.value = 300 + ((p.discovered.spo2 ? p.spo2 : 98) * 5);
    osc.type = 'sine'; osc.connect(gain); gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 0.15);
}
function startMonitorBeep() {
    clearTimeout(beepTimer);
    const next = () => {
        if (!p.activeCase || p.caseFinished) { beepTimer = null; return; }
        playMonitorBeep();
        const f = p.rhythm === 'VHF' ? (0.55 + Math.random() * 0.9) : 1;
        beepTimer = setTimeout(next, p.hr > 0 ? (60 / p.hr) * 1000 * f : 1000);
    };
    next();
}
function lungSoundFile() {
    const c = p.activeCase;
    let kind = c.lungSound;
    if (!kind) {
        const t = ((c.findings && c.findings.Lunge) || '').toLowerCase();
        kind = /giemen|brummen|obstrukt/.test(t) ? 'giemen' : /rassel|brodel|schaum/.test(t) ? 'rasseln' : /abgeschwächt|kein atemgeräusch|silent|kaum/.test(t) ? 'leise' : 'normal';
    }
    return { giemen: 'lunge_giemen.mp3', rasseln: 'lunge_rasseln.mp3', leise: 'lunge_leise.mp3' }[kind] || 'lunge_normal.mp3';
}
function playLungSound() {
    if (currentLungSound) { currentLungSound.pause(); currentLungSound.currentTime = 0; }
    if (isMuted) return;
    currentLungSound = new Audio(asset(lungSoundFile())); currentLungSound.volume = 0.8;
    currentLungSound.play().catch(() => {});
    setTimeout(() => currentLungSound && currentLungSound.pause(), 9000);
}
function playAmbientSound(env) {
    if (currentAmbientSound) { currentAmbientSound.pause(); currentAmbientSound.currentTime = 0; currentAmbientSound = null; }
    const file = AMBIENT_FILES[env];
    if (!file) return;
    currentAmbientSound = new Audio(asset(file)); currentAmbientSound.loop = true;
    currentAmbientSound.volume = ['traffic', 'club', 'factory', 'work'].includes(env) ? 0.25 : 0.08;
    if (!isMuted) currentAmbientSound.play().catch(() => {});
}
function playPatientSound(type) {
    if (currentPatientSound) { currentPatientSound.pause(); currentPatientSound.currentTime = 0; }
    const file = { moaning: 'pat_moaning.mp3', screaming: 'pat_screaming.mp3', mumbling: 'pat_mumbling.mp3' }[type];
    if (!file || p.isArrest || p.gcs <= 3) return;
    currentPatientSound = new Audio(asset(file)); currentPatientSound.loop = true; currentPatientSound.volume = 0.45;
    if (!isMuted) currentPatientSound.play().catch(() => {});
}

// ------------------------------------------------------------------------------------------
// MATERIAL, FORTSCHRITT, ANSAGE
// ------------------------------------------------------------------------------------------
function openMaterialModal(action) {
    const m = document.getElementById('material-modal'), list = document.getElementById('material-list');
    const tCont = document.getElementById('target-container'), tSel = document.getElementById('action-target');
    list.innerHTML = action.mat.map(item => `<label class="m-check-label"><input type="checkbox" class="m-check"> ${escHtml(item)}</label>`).join('');
    document.getElementById('material-hint')?.classList.add('hidden');
    list.onchange = (e) => {
        if (!e.target.classList.contains('m-check')) return;
        if (e.target.checked) e.target.closest('label')?.classList.remove('m-check-label--missing');
        if (Array.from(document.querySelectorAll('.m-check')).every(c => c.checked)) document.getElementById('material-hint')?.classList.add('hidden');
    };
    if (action.targets) {
        tSel.innerHTML = '';
        action.targets.forEach(t => tSel.add(new Option(t.l, t.v)));
        tCont.classList.remove('hidden');
    } else tCont.classList.add('hidden');
    const rrCont = document.getElementById('rr-interval-container');
    if (action.token === 'RR_Measure') { document.getElementById('rr-interval-select').value = String(p.rrInterval || 0); rrCont.classList.remove('hidden'); }
    else rrCont.classList.add('hidden');
    document.getElementById('modal-title').textContent = action.label + ' – Material richten';
    m.classList.remove('hidden');
}
function confirmProc() {
    const missing = Array.from(document.querySelectorAll('.m-check')).filter(c => !c.checked);
    if (missing.length) {
        missing.forEach(c => c.closest('label')?.classList.add('m-check-label--missing'));
        document.getElementById('material-hint')?.classList.remove('hidden');
        return;
    }
    if (currentAction.targets) {
        const sel = document.getElementById('action-target');
        p.pendingTarget = sel.value; p.pendingTargetLabel = sel.options[sel.selectedIndex].text;
    } else { p.pendingTarget = null; p.pendingTargetLabel = ''; }
    if (currentAction.token === 'RR_Measure') p.rrInterval = parseInt(document.getElementById('rr-interval-select').value, 10) || 0;
    document.getElementById('material-modal')?.classList.add('hidden');
    startTimer(currentAction, currentActionDelegated);
}
function closeModal() {
    document.getElementById('material-modal')?.classList.add('hidden');
    if (currentActionDelegated) { p.helperBusyWith = null; updateUI(); }
}
function closeO2Modal() { document.getElementById('o2-modal')?.classList.add('hidden'); }

let progressTimer = null;
function startTimer(action, delegated = false, onComplete = finalizeAction) {
    const prog = document.getElementById('progress-container'), fill = document.getElementById('progress-fill');
    prog?.classList.remove('hidden');
    document.getElementById('progress-text').textContent = delegated ? `Helfer: „${action.label}“ läuft...` : `${action.label} läuft...`;
    let pct = 0; const step = 100 / ((action.time || 3) * 10);
    const t = setInterval(() => {
        pct += step; if (fill) fill.style.width = Math.min(100, pct) + '%';
        if (pct >= 100) { clearInterval(t); prog?.classList.add('hidden'); if (fill) fill.style.width = '0%'; onComplete(action, delegated); }
    }, 100);
}

let ansageCallback = null;
function showAnsageModal(text, onConfirm) { ansageCallback = onConfirm; document.getElementById('ansage-text').textContent = text; document.getElementById('ansage-modal')?.classList.remove('hidden'); }
function closeAnsageModal() { document.getElementById('ansage-modal')?.classList.add('hidden'); ansageCallback = null; }
function confirmAnsage() { const cb = ansageCallback; closeAnsageModal(); if (cb) cb(); }

// ------------------------------------------------------------------------------------------
// 12-KANAL-EKG
// ------------------------------------------------------------------------------------------
function showEKGModal() {
    const c = p.activeCase; if (!c) return;
    const img = document.getElementById('ekg-image-display'), wrap = document.getElementById('ekg-image-wrap');
    if (c.ekgImage) { img.src = asset(c.ekgImage); wrap.classList.remove('hidden'); }
    else wrap.classList.add('hidden');
    let extra = '';
    if (c.vitals.stemi) extra = '<br><strong style="color:#c0392b;">→ STEMI: Notarzt, Voranmeldung Herzkatheterlabor!</strong>';
    document.getElementById('ekg-feedback').innerHTML = `<strong>Rückmeldung Telenotarzt/Notarzt:</strong> ${escHtml(c.findings.ekg || 'Sinusrhythmus, keine ST-Veränderungen.')}${extra}
        <br><span style="color:#667; font-size:0.85rem;">Als RS schreibst und übermittelst du das 12-Kanal-EKG – die Befundung erfolgt ärztlich.</span>`;
    document.getElementById('ekg-modal')?.classList.remove('hidden');
}
function closeEKGModal() { document.getElementById('ekg-modal')?.classList.add('hidden'); }

// ------------------------------------------------------------------------------------------
// PUPILLEN
// ------------------------------------------------------------------------------------------
function showPupilModal() {
    const m = document.getElementById('pupil-modal'); if (!m) return;
    const mode = p.isArrest ? 'starr' : (p.activeCase.pupils || 'normal');
    const cfg = {
        normal: { l: 28, r: 28, min: 14, lr: true, rr: true }, weit: { l: 38, r: 38, min: 26, lr: true, rr: true },
        miosis: { l: 9, r: 9, min: 8, lr: false, rr: false }, starr: { l: 46, r: 46, min: 46, lr: false, rr: false },
        aniso_r: { l: 28, r: 42, min: 14, lr: true, rr: false }, aniso_l: { l: 33, r: 28, min: 16, lr: true, rr: true }
    }[mode] || { l: 28, r: 28, min: 14, lr: true, rr: true };
    const L = document.getElementById('pupil-patient-left'), R = document.getElementById('pupil-patient-right');
    L.style.setProperty('--pupil-size', cfg.l + 'px'); R.style.setProperty('--pupil-size', cfg.r + 'px');
    const cnt = document.getElementById('eyes-container'), fl = document.getElementById('flashlight');
    cnt.onpointermove = cnt.ontouchmove = (e) => {
        e.preventDefault(); fl.style.opacity = '1';
        const pt = (e.touches && e.touches[0]) || e;
        const r = cnt.getBoundingClientRect();
        fl.style.left = (pt.clientX - r.left) + 'px'; fl.style.top = (pt.clientY - r.top) + 'px';
        const check = (eyeId, pup, base, react) => {
            if (!react) return;
            const rE = document.getElementById(eyeId).getBoundingClientRect();
            const dist = Math.hypot(pt.clientX - (rE.left + rE.width / 2), pt.clientY - (rE.top + rE.height / 2));
            pup.style.setProperty('--pupil-size', (dist < 120 ? base - (base - cfg.min) * Math.pow((120 - dist) / 120, 0.7) : base) + 'px');
        };
        check('eye-patient-left', L, cfg.l, cfg.lr); check('eye-patient-right', R, cfg.r, cfg.rr);
    };
    cnt.onpointerleave = cnt.ontouchend = () => { fl.style.opacity = '0'; L.style.setProperty('--pupil-size', cfg.l + 'px'); R.style.setProperty('--pupil-size', cfg.r + 'px'); };
    m.classList.remove('hidden');
}
function closePupilModal() { document.getElementById('pupil-modal')?.classList.add('hidden'); }

// ------------------------------------------------------------------------------------------
// REKAPILLARISIERUNG
// ------------------------------------------------------------------------------------------
let recapT = null, isNail = false;
function showReCapModal() {
    const nail = document.getElementById('nail-bed'), txt = document.getElementById('recap-timer');
    nail.style.transition = 'none'; nail.style.background = '#f1a9a0'; txt.textContent = 'Bereit...'; txt.style.color = '#fff';
    const cnt = document.getElementById('finger-container');
    cnt.onpointerdown = (e) => {
        e.preventDefault(); isNail = true; clearTimeout(recapT);
        nail.style.transition = 'background 0.3s ease-out'; nail.style.background = '#fdfdfd';
        txt.textContent = 'Gedrückt halten...'; txt.style.color = '#f39c12';
    };
    document.getElementById('recap-modal')?.classList.remove('hidden');
}
window.addEventListener('pointerup', () => { if (isNail) endNail(); });
function endNail() {
    isNail = false;
    const nail = document.getElementById('nail-bed'), txt = document.getElementById('recap-timer');
    let t = p.isArrest || p.rr_sys < 40 ? 999 : 1.5;
    if (t !== 999) { if (p.rr_sys < 90) t += 1.5; if (p.rr_sys < 70) t += 1.5; if (p.temp < 35) t += 1.5; if (p.hr > p.rr_sys) t += 0.8; if (/exsikk|sepsis|meningokokken/.test(p.activeCase.id)) t += 1.2; }
    if (t >= 99) { nail.style.transition = 'none'; txt.textContent = 'Keine Rekapillarisierung!'; txt.style.color = '#e74c3c'; }
    else {
        nail.style.transition = `background ${t}s ease-in`; nail.style.background = '#f1a9a0'; txt.textContent = 'Beobachte...'; txt.style.color = '#3498db';
        recapT = setTimeout(() => {
            txt.textContent = `Rekap-Zeit: ${t.toFixed(1)} s`; txt.style.color = t > 2.0 ? '#e74c3c' : '#2ecc71';
            if (!done('recap')) { markDone('recap'); addToLog(`<strong>Rekapillarisierungszeit:</strong> <span class="${t > 2 ? 'critical' : 'ok'}">${t.toFixed(1)} s</span>`); }
        }, t * 1000);
    }
}
function closeReCapModal() { document.getElementById('recap-modal')?.classList.add('hidden'); }

// ------------------------------------------------------------------------------------------
// ATEMFREQUENZ
// ------------------------------------------------------------------------------------------
let afInt = null;
function showAFModal() {
    const inp = document.getElementById('af-input'); inp.value = ''; inp.disabled = true;
    document.getElementById('btn-af-submit').disabled = true;
    const b = document.getElementById('btn-af-timer'); b.textContent = '⏱️ 15 Sek. Timer starten'; b.disabled = false; b.style.background = '#333'; b.style.color = 'white';
    const v = document.getElementById('af-visualizer');
    const cAF = p.isArrest ? ((p.helperVent || p.playerVent) ? 10 : 0) : Math.max(0, p.af);
    if (cAF > 0) { v.style.animation = `ui-breathe ${(60 / cAF).toFixed(2)}s ease-in-out infinite`; v.style.opacity = '1'; } else { v.style.animation = 'none'; v.style.opacity = '0.3'; }
    document.getElementById('af-modal')?.classList.remove('hidden');
}
function startAFTimer() {
    const b = document.getElementById('btn-af-timer'); if (b.disabled) return;
    b.disabled = true; let left = 15; b.textContent = `⏱️ Beobachte... (${left}s)`;
    afInt = setInterval(() => {
        left--;
        if (left > 0) b.textContent = `⏱️ Beobachte... (${left}s)`;
        else {
            clearInterval(afInt); b.textContent = '✅ Zeit abgelaufen!'; b.style.background = '#2ecc71'; b.style.color = '#000';
            const inp = document.getElementById('af-input'); inp.disabled = false; inp.focus();
            document.getElementById('btn-af-submit').disabled = false;
        }
    }, 1000);
}
function closeAFModal() { document.getElementById('af-modal')?.classList.add('hidden'); clearInterval(afInt); }
function submitAFCount() {
    const val = parseInt(document.getElementById('af-input').value, 10);
    if (isNaN(val)) return alert('Bitte eine Zahl eintragen!');
    const calc = val * 4, act = Math.round(p.af);
    if (Math.abs(calc - act) <= 4 || (p.isArrest && calc === 0)) {
        p.discovered.af = true; markDone('AF_zählen');
        addToLog(`✅ <strong style="color:#e67e22;">Atemfrequenz korrekt:</strong> ca. ${calc}/min.`);
        p.stressFactor = Math.max(1.0, p.stressFactor - 0.2);
    } else {
        p.evaluation.medErrors++; p.discovered.af = true; markDone('AF_zählen');
        addToLog(`❌ <span class="critical">Atemfrequenz falsch gezählt</span> (${calc}/min) – tatsächlich ca. ${act}/min.`);
    }
    closeAFModal(); updateUI(); refreshTab();
}

// ------------------------------------------------------------------------------------------
// GCS
// ------------------------------------------------------------------------------------------
function showGCSModal() {
    document.getElementById('gcs-feedback').innerHTML = '<div style="text-align:center; color:#aaa; font-style:italic;">Wähle eine Aktion...</div>';
    document.getElementById('gcs-input').value = '';
    document.getElementById('gcs-modal')?.classList.remove('hidden');
}
function closeGCSModal() { document.getElementById('gcs-modal')?.classList.add('hidden'); }
const GCS_MAP = { 15: [4, 5, 6], 14: [3, 5, 6], 13: [3, 4, 6], 12: [3, 4, 5], 11: [2, 4, 5], 10: [2, 3, 5], 9: [2, 3, 4], 8: [2, 2, 4], 7: [1, 2, 4], 6: [1, 2, 3], 5: [1, 1, 3], 4: [1, 1, 2], 3: [1, 1, 1] };
function testGCS(type) {
    const fb = document.getElementById('gcs-feedback');
    const g = p.isArrest ? 3 : Math.max(3, Math.min(15, Math.round(p.gcs)));
    const [e, v, m] = GCS_MAP[g];
    const small = isPaed() && p.activeCase.ageUnit === 'M';
    const row = (i, t, txt) => `<div style="display:flex; gap:12px; text-align:left;"><div style="font-size:1.3rem;">${i}</div><div><strong style="color:#9b59b6;">${t}:</strong> ${txt}</div></div>`;
    const eT = e === 4 ? 'Spontan geöffnet.' : e === 3 ? 'Öffnen auf Ansprache.' : e === 2 ? 'Öffnen auf Schmerzreiz.' : 'Kein Augenöffnen.';
    const vT = small ? (v === 5 ? 'Brabbelt, fixiert, lächelt.' : v === 4 ? 'Weint, ist aber tröstbar.' : v === 3 ? 'Schreit unstillbar.' : v === 2 ? 'Stöhnt, unruhig.' : 'Keine Lautäußerung.')
        : (v === 5 ? 'Orientiert, adäquat.' : v === 4 ? 'Verwirrt, desorientiert.' : v === 3 ? 'Inadäquate Wörter.' : v === 2 ? 'Unverständliche Laute.' : 'Keine verbale Reaktion.');
    const mT = m === 6 ? 'Befolgt Aufforderungen.' : m === 5 ? 'Gezielte Abwehr auf Schmerz.' : m === 4 ? 'Ungezielte Beugeabwehr.' : m === 3 ? 'Beugesynergismen.' : m === 2 ? 'Strecksynergismen.' : 'Keine motorische Reaktion.';
    if (type === 'speak') { fb.innerHTML = row('👀', 'Augen', eT) + row('🗣️', 'Sprache', vT) + (m === 6 ? row('👋', 'Motorik', mT) : ''); }
    else { fb.innerHTML = row('⚡', 'Motorik (Schmerzreiz)', mT) + (e === 2 ? row('👀', 'Augen', 'Öffnen sich unter dem Schmerzreiz.') : '') + (v === 2 ? row('🗣️', 'Sprache', 'Stöhnt beim Schmerzreiz.') : ''); }
}
function submitGCS() {
    const val = parseInt(document.getElementById('gcs-input').value, 10);
    if (isNaN(val) || val < 3 || val > 15) return alert('Wert zwischen 3 und 15 eingeben!');
    const actual = p.isArrest ? 3 : Math.max(3, Math.min(15, Math.round(p.gcs)));
    p.discovered.gcs = true; markDone('gcs');
    if (Math.abs(val - actual) <= 1) { addToLog(`✅ <strong style="color:#9b59b6;">GCS korrekt:</strong> ${val}`); p.stressFactor = Math.max(1.0, p.stressFactor - 0.2); }
    else { p.evaluation.medErrors++; addToLog(`❌ <span class="critical">GCS falsch eingeschätzt:</span> ${val} (tatsächlich ca. ${actual})`); }
    closeGCSModal(); updateUI(); refreshTab();
}

// ------------------------------------------------------------------------------------------
// qSOFA
// ------------------------------------------------------------------------------------------
function showQsofaModal() { document.getElementById('qsofa-input').value = ''; document.getElementById('qsofa-modal')?.classList.remove('hidden'); }
function closeQsofaModal() { document.getElementById('qsofa-modal')?.classList.add('hidden'); }
function submitQsofa() {
    const val = parseInt(document.getElementById('qsofa-input').value, 10);
    if (isNaN(val) || val < 0 || val > 3) return alert('Bitte 0 bis 3 eingeben!');
    const truth = (p.af >= 22 ? 1 : 0) + (Math.round(p.gcs) < 15 ? 1 : 0) + (p.rr_sys <= 100 ? 1 : 0);
    if (!p.discovered.af || !p.discovered.rr || !p.discovered.gcs) addToLog(`💡 <span class="info">Für qSOFA brauchst du AF, Blutdruck und GCS – erhebe fehlende Werte zuerst.</span>`);
    markDone('qsofa');
    if (val === truth) addToLog(`✅ <strong style="color:#f1c40f;">qSOFA korrekt: ${val} Punkt(e)</strong> – ${val >= 2 ? '<span class="critical">Sepsis-Verdacht! Notarzt, Voranmeldung.</span>' : 'aktuell kein qSOFA-positiver Befund.'}`);
    else { p.evaluation.medErrors++; addToLog(`❌ <span class="critical">qSOFA falsch berechnet</span> (${val}) – richtig wären ${truth} Punkt(e).`); }
    closeQsofaModal(); refreshTab();
}

// ------------------------------------------------------------------------------------------
// 4S
// ------------------------------------------------------------------------------------------
function showFourSModal() {
    const fs = p.activeCase.fourS || {};
    document.getElementById('fours-scene').textContent = fs.scene || '–';
    document.getElementById('fours-safety').textContent = fs.safety || '–';
    document.getElementById('fours-situation').textContent = fs.situation || '–';
    document.getElementById('fours-support').textContent = fs.support || '–';
    document.getElementById('fours-modal')?.classList.remove('hidden');
}
function closeFourSModal() {
    document.getElementById('fours-modal')?.classList.add('hidden');
    if (!done('4s_check')) {
        markDone('4s_check');
        const fs = p.activeCase.fourS;
        addToLog(`<strong>4S-Erkundung:</strong> Sicherheit: ${escHtml(fs.safety)} · Szene: ${escHtml(fs.scene)} · Sichtung: ${escHtml(fs.situation)}`);
        refreshTab();
    }
}

// ------------------------------------------------------------------------------------------
// BE-FAST
// ------------------------------------------------------------------------------------------
const BEFAST_TEXT = {
    B: ['🚶 <b>Balance:</b> Gleichgewichtsstörung – kann nicht sicher sitzen/stehen.', '🚶 <b>Balance:</b> Unauffällig, sicherer Sitz/Stand.'],
    E: ['👀 <b>Eyes:</b> Sehstörung / Blickwendung festgestellt!', '👀 <b>Eyes:</b> Unauffällig, keine Sehstörung.'],
    F: ['😐 <b>Face:</b> Asymmetrie – ein Mundwinkel hängt herab!', '😐 <b>Face:</b> Symmetrische Mimik.'],
    A: ['💪 <b>Arms:</b> Positiver Armhalteversuch – ein Arm sinkt ab!', '💪 <b>Arms:</b> Beide Arme werden 10 Sekunden gehalten.'],
    S: ['🗣️ <b>Speech:</b> Sprache verwaschen / Wortfindungsstörung!', '🗣️ <b>Speech:</b> Klare Sprache, Satz wird korrekt nachgesprochen.']
};
function showBefastModal() { document.getElementById('befast-feedback').innerHTML = '<span style="color:#aaa;">Wähle einen Test aus...</span>'; document.getElementById('befast-modal')?.classList.remove('hidden'); }
function testBefast(letter) {
    const fb = document.getElementById('befast-feedback');
    const pos = p.activeCase.befastPositive || {};
    if (letter === 'T') {
        markDone('befast_time');
        fb.innerHTML = `⏱️ <b>Time:</b> ${escHtml(p.activeCase.lastKnownWell || 'Symptombeginn laut Anamnese – bitte genau erfragen (Time is Brain)!')}`;
        return;
    }
    if (p.isArrest || p.gcs <= 8) { fb.innerHTML = 'Nicht prüfbar – ' + patientWord() + ' ist nicht kooperationsfähig.'; return; }
    fb.innerHTML = BEFAST_TEXT[letter][pos[letter] ? 0 : 1];
}
function closeBefastModal() {
    document.getElementById('befast-modal')?.classList.add('hidden');
    if (!done('befast')) {
        markDone('befast');
        const pos = Object.keys(p.activeCase.befastPositive || {}).filter(k => p.activeCase.befastPositive[k]);
        addToLog(`<strong>BE-FAST:</strong> ${pos.length ? `<span class="critical">auffällig (${pos.join(', ')})</span>` : 'unauffällig'}. Neurologischer Kurzbefund: ${escHtml(finding('BEFAST', 'unauffällig'))}`);
        refreshTab();
    }
}

// ------------------------------------------------------------------------------------------
// BLUTUNGSRÄUME
// ------------------------------------------------------------------------------------------
const BLEEDING_REGIONS = ['thorax', 'abdomen', 'becken', 'oberschenkel'];
function showBleedingModal() { document.getElementById('bleeding-feedback').innerHTML = '<span style="color:#aaa;">Welchen Bereich möchtest du abtasten?</span>'; document.getElementById('bleeding-modal')?.classList.remove('hidden'); }
function bleedingPositives() {
    const c = p.activeCase, s = new Set();
    if (c.bleedingSpaces) s.add(c.bleedingSpaces);
    if (flag('pelvic')) s.add('becken');
    if (['rs_flail_chest', 'rs_perthes_01', 'rs_stich_01', 'rs_open_pneu', 'rs_poly_sturz'].includes(c.id)) s.add('thorax');
    if (['rs_abd_trauma', 'rs_evisz_01'].includes(c.id)) s.add('abdomen');
    if (['rs_femur_01', 'rs_shf_01'].includes(c.id)) s.add('oberschenkel');
    return s;
}
function testBleeding(region) {
    if (!p.evaluation.bleedingRegionsChecked.includes(region)) p.evaluation.bleedingRegionsChecked.push(region);
    const pos = bleedingPositives().has(region);
    const txt = {
        thorax: pos ? '🩻 <b>Thorax:</b> Schmerzhafte Instabilität / Prellmarken – Verletzung des Brustkorbs!' : '🩻 <b>Thorax:</b> Stabil, keine Prellmarken.',
        abdomen: pos ? '🩸 <b>Abdomen:</b> Abwehrspannung, druckschmerzhaft – V.a. innere Blutung!' : '🩸 <b>Abdomen:</b> Weich, kein Druckschmerz.',
        becken: pos ? '🦴 <b>Becken:</b> Instabil bei vorsichtiger Kompression – massive Blutungsgefahr!' : '🦴 <b>Becken:</b> Stabil, kein Beckenschmerz.',
        oberschenkel: pos ? '🦵 <b>Oberschenkel:</b> Deutliche Schwellung und Fehlstellung – großer Blutverlust möglich!' : '🦵 <b>Oberschenkel:</b> Beidseits unauffällig.'
    }[region];
    document.getElementById('bleeding-feedback').innerHTML = `<div>${txt}</div>`;
}
function closeBleedingModal() {
    document.getElementById('bleeding-modal')?.classList.add('hidden');
    const all = BLEEDING_REGIONS.every(r => p.evaluation.bleedingRegionsChecked.includes(r));
    if (all && !done('blutungsraeume')) {
        markDone('blutungsraeume');
        const pos = [...bleedingPositives()];
        addToLog(`<strong>Blutungsräume:</strong> ${pos.length ? `<span class="critical">auffällig: ${pos.join(', ')}</span>` : 'Thorax, Abdomen, Becken und Oberschenkel unauffällig.'}`);
        refreshTab();
    } else if (!all) addToLog(`<strong>Blutungsräume:</strong> Untersuchung unvollständig (nicht alle vier Regionen abgetastet).`);
}

// ------------------------------------------------------------------------------------------
// MUNDRAUM
// ------------------------------------------------------------------------------------------
let mouthLightBound = false, mouthState = 'clear';
function showMouthModal() {
    mouthState = p.mouthCleared ? 'clear' : (p.activeCase.mouthState || 'clear');
    const content = document.getElementById('mouth-content');
    content.innerHTML = mouthState === 'clear' ? '👅<br><span style="font-size:1rem; color:#2ecc71;">Mundraum frei</span>'
        : mouthState === 'fluid' ? '🤢<br><span style="font-size:1rem; color:#e74c3c;">Sekret / Erbrochenes / Blut!</span>'
        : '🥜<br><span style="font-size:1rem; color:#e74c3c;">Fremdkörper sichtbar!</span>';
    document.getElementById('mouth-feedback').innerHTML = `<span style="color:#ddd;">${escHtml(finding('Mund', 'Mundraum frei.'))}</span>`;
    const md = document.getElementById('mouth-darkness');
    md.style.setProperty('--light-x', '50%'); md.style.setProperty('--light-y', '50%');
    if (!mouthLightBound) {
        const mc = document.getElementById('mouth-container');
        const move = (e) => { e.preventDefault(); const pt = (e.touches && e.touches[0]) || e; const r = mc.getBoundingClientRect(); md.style.setProperty('--light-x', (pt.clientX - r.left) + 'px'); md.style.setProperty('--light-y', (pt.clientY - r.top) + 'px'); };
        mc.addEventListener('pointermove', move); mc.addEventListener('touchmove', move, { passive: false });
        mouthLightBound = true;
    }
    document.getElementById('mouth-modal')?.classList.remove('hidden');
}
function closeMouthModal() {
    document.getElementById('mouth-modal')?.classList.add('hidden');
    hideLayer('layer-absaugen');
    if (!done('mundraum')) { markDone('mundraum'); addToLog(`<strong>Mundraum:</strong> ${escHtml(finding('Mund', 'frei'))}`); refreshTab(); }
}
function actionMouth(type) {
    const fb = document.getElementById('mouth-feedback');
    if (type === 'suction') {
        showLayer('layer-absaugen');
        if (mouthState === 'fluid') {
            p.mouthCleared = true; p.stressFactor = Math.max(1.0, p.stressFactor - 0.3); markDone('absaugen');
            addToLog(`✅ <strong style="color:#3498db;">Mundraum abgesaugt</strong> – Atemweg frei.`);
            showMouthModal(); fb.innerHTML = '<span class="ok">Erfolgreich abgesaugt!</span>';
        } else if (mouthState === 'solid') { fb.innerHTML = '<span class="critical">Ein fester Fremdkörper lässt sich nicht absaugen!</span>'; p.evaluation.medErrors++; }
        else fb.innerHTML = '<span style="color:#aaa;">Absaugen nicht nötig – Mundraum ist frei.</span>';
    } else {
        if (mouthState === 'solid') { p.mouthCleared = true; addToLog(`✅ <strong style="color:#3498db;">Fremdkörper unter Sicht entfernt.</strong>`); showMouthModal(); fb.innerHTML = '<span class="ok">Fremdkörper entfernt!</span>'; }
        else if (mouthState === 'fluid') { fb.innerHTML = '<span class="critical">Flüssigkeiten muss man absaugen!</span>'; p.evaluation.medErrors++; }
        else fb.innerHTML = '<span style="color:#aaa;">Kein Fremdkörper sichtbar – niemals blind im Mund tasten!</span>';
    }
}

// ------------------------------------------------------------------------------------------
// SAMPLER-GESPRÄCH
// ------------------------------------------------------------------------------------------
let samplerAsked = 0;
function showSamplerModal() {
    samplerAsked = 0;
    document.getElementById('sampler-chat').innerHTML = '<div class="chat-msg msg-sys">Wähle eine Frage, um das Gespräch zu beginnen.</div>';
    document.querySelectorAll('.sampler-btn').forEach(b => b.disabled = false);
    document.getElementById('sampler-modal')?.classList.remove('hidden');
}
function closeSamplerModal() {
    document.getElementById('sampler-modal')?.classList.add('hidden');
    const n = Object.keys(p.samplerCaptured || {}).length;
    if (samplerAsked >= 4 || n >= 4) {
        if (!done('SAMPLER')) { markDone('SAMPLER'); addToLog(`<strong>SAMPLER:</strong> Anamnese erhoben (${n} von 7 Punkten beantwortet).`); }
    } else if (samplerAsked > 0) addToLog(`<strong>SAMPLER:</strong> <span class="warn">unvollständig – nur ${samplerAsked} Frage(n) gestellt.</span>`);
    updateUI(); refreshTab();
}
function askSampler(letter) {
    const chat = document.getElementById('sampler-chat');
    const q = { S: 'Welche Beschwerden haben Sie genau?', A: 'Haben Sie bekannte Allergien?', M: 'Nehmen Sie regelmäßig Medikamente?', P: 'Gibt es Vorerkrankungen?', L: 'Wann haben Sie zuletzt gegessen oder getrunken?', E: 'Was ist passiert, was haben Sie davor gemacht?', R: 'Gibt es Risikofaktoren – Rauchen, Schwangerschaft, Blutverdünner?' };
    const qKid = { S: 'Welche Beschwerden hat Ihr Kind?', A: 'Hat Ihr Kind Allergien?', M: 'Bekommt es Medikamente?', P: 'Hat Ihr Kind Vorerkrankungen?', L: 'Wann hat es zuletzt gegessen/getrunken?', E: 'Was ist genau passiert?', R: 'Gibt es Besonderheiten (Frühgeburt, Impfungen, Rauchen im Haushalt)?' };
    const c = p.activeCase;
    const parentAnswers = isPaed() && (c.ageUnit === 'M' || c.age < 8 || p.gcs < 13 || p.isArrest);
    chat.insertAdjacentHTML('beforeend', `<div class="chat-msg msg-user">${(parentAnswers ? qKid : q)[letter]}</div>`);
    samplerAsked++;
    document.querySelectorAll('.sampler-btn').forEach(b => b.disabled = true);
    chat.scrollTop = chat.scrollHeight;
    setTimeout(() => {
        const raw = c.sampler && c.sampler[letter];
        const answer = raw && raw !== '-' ? raw : null;
        let response, cls = 'msg-patient', captured = null;
        const confused = c.patientSound === 'mumbling' && p.gcs < 14;
        if (parentAnswers) { captured = answer; response = '<em>Elternteil:</em> ' + escHtml(answer || 'Da fällt mir nichts ein...'); cls = 'msg-bystander'; }
        else if (p.isArrest || p.gcs <= 8 || confused) {
            if (c.env === 'home' || c.env === 'work' || c.env === 'public') { captured = answer; response = '<em>Angehörige/Kollegen:</em> ' + escHtml(answer || 'Das wissen wir leider nicht.'); cls = 'msg-bystander'; }
            else { response = '<em>(Keine verwertbare Antwort – der Patient ist nicht orientiert, niemand kennt ihn.)</em>'; cls = 'msg-sys'; }
        } else if (c.patientSound === 'screaming') { captured = answer; response = '<em>(unter starken Schmerzen)</em> ' + escHtml(answer || 'Weiß nicht!'); }
        else { captured = answer; response = escHtml(answer || 'Nein, da ist nichts.'); }
        if (captured) p.samplerCaptured[letter] = captured;
        chat.insertAdjacentHTML('beforeend', `<div class="chat-msg ${cls}">${response}</div>`);
        chat.scrollTop = chat.scrollHeight;
        document.querySelectorAll('.sampler-btn').forEach(b => b.disabled = false);
    }, 700);
}

// ------------------------------------------------------------------------------------------
// PDF-PROTOKOLL
// ------------------------------------------------------------------------------------------
function exportPDF() {
    const ev = p.evaluation, c = p.activeCase;
    const logEntries = Array.from(document.querySelectorAll('.log-entry')).map(el => el.innerHTML.replace(/<button[\s\S]*?<\/button>/g, ''));
    const errors = [...new Set(ev.errorDetails || [])];
    const missed = (ev.scoreEvents || []).map(e => `<li><strong>[${SCORE_EVENT_LETTER_LABELS[e.letter] || e.letter}]</strong>${e.critical ? ' ⚠️ <strong>Für diesen Fall entscheidend:</strong>' : ''} ${escHtml(e.text)} <span style="color:#999;">(-${e.weight})</span></li>`).join('');
    const w = window.open('', '_blank');
    if (!w) return alert('Bitte Pop-ups für diese Seite erlauben, um das PDF zu erstellen.');
    w.document.open();
    w.document.write(`<html><head><title>medicIQ – Einsatzprotokoll RS</title><style>
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; line-height: 1.55; padding: 30px; max-width: 800px; margin: 0 auto; }
        h1 { color: #2c3e50; border-bottom: 3px solid #179299; padding-bottom: 10px; }
        h2 { color: #179299; margin-top: 32px; border-bottom: 2px solid #ecf0f1; padding-bottom: 5px; }
        .box { background: #f8f9fa; padding: 16px; border-radius: 8px; border: 1px solid #e0e0e0; margin-bottom: 18px; }
        .scores { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; text-align: center; }
        .scores div { background: #e8f4f8; border-radius: 6px; padding: 8px; } .scores strong { display: block; font-size: 1.2rem; }
        .err { background: #fadbd8; padding: 14px 18px; border-radius: 8px; color: #922b21; }
        li { margin-bottom: 5px; } table { width: 100%; border-collapse: collapse; } td { padding: 8px; border-bottom: 1px solid #ecf0f1; font-size: 0.92rem; }
        .sig { margin-top: 60px; text-align: right; color: #7f8c8d; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .box, li, tr { break-inside: avoid; } h1, h2 { break-after: avoid; } }
    </style></head><body>
        <h1>🚑 medicIQ – Einsatzprotokoll Rettungssanitäter</h1>
        <div class="box"><strong>Thema:</strong> ${CATEGORY_NAMES[p.activeCategory] || ''} · <strong>Einsatzdauer:</strong> ${fmtTime(elapsedSec())} min<br>
            <strong>Leitstelle:</strong> ${escHtml(c.dispatch)}<br>
            <strong>Gewählte Verdachtsdiagnose:</strong> ${escHtml(ev.selectedDiagnosis || '–')} (richtig: ${escHtml(c.diagnosis)})<br>
            <strong>Zielklinik:</strong> ${escHtml(ev.selectedDepartment || '–')} (passend: ${escHtml(c.department)})<br>
            <strong>Notarzt:</strong> ${p.naCalled ? 'nachgefordert' : 'nicht nachgefordert'} (Indikation: ${c.naRequired ? 'ja' : 'nein'})</div>
        <div class="scores"><div>Gesamt<strong>${ev.overallScore}%</strong></div>${['X', 'A', 'B', 'C', 'D', 'E'].map(l => `<div>${l}<strong>${ev['score' + l]}%</strong></div>`).join('')}</div>
        ${errors.length ? `<h2>⚠️ Kritische Behandlungsfehler</h2><div class="err"><ul>${errors.map(e => `<li>${escHtml(e)}</li>`).join('')}</ul></div>` : ''}
        ${missed ? `<h2>❗ Vergessene Maßnahmen / Fehler</h2><ul>${missed}</ul>` : ''}
        ${c.lernziel ? `<h2>📖 Musterlösung</h2><div class="box">${escHtml(c.lernziel)}</div>` : ''}
        <h2>⏱️ Zeitstrahl</h2><table><tbody>${logEntries.map(e => `<tr><td>${e}</td></tr>`).join('')}</tbody></table>
        <h2>🤝 SINNHAFT-Übergabe</h2><div class="box">${buildSinnhaftSummaryHtml()}</div>
        <div class="sig">Erstellt am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE')} Uhr<br><br><br>____________________________________<br>Unterschrift Praxisanleiter</div>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 700);
}

// ------------------------------------------------------------------------------------------
// START-BILDSCHIRM
// ------------------------------------------------------------------------------------------
const NEXT_CASE_PREVIEW = {
    intern: '🫀 Dein nächster Fall dreht sich um Herz, Kreislauf, Atmung oder Stoffwechsel – bleib nah am Monitor.',
    neuro: '🧠 Dein nächster Fall prüft Bewusstsein und neurologische Ausfälle – GCS, BE-FAST und Blutzucker im Blick.',
    trauma: '🦴 Dein nächster Fall ist ein Trauma – kritische Blutung zuerst, dann konsequent xABCDE.',
    paed: '🧸 Dein nächster Fall ist ein Kindernotfall – ruhig bleiben, Eltern einbeziehen, altersgerecht handeln.'
};
function updateNextCasePreview() {
    const cat = document.getElementById('categorySelector')?.value;
    const el = document.getElementById('next-case-preview'); if (el) el.textContent = NEXT_CASE_PREVIEW[cat] || '';
    document.querySelectorAll('.category-desc').forEach(d => d.classList.toggle('selected', (d.getAttribute('onclick') || '').includes(`'${cat}'`)));
}
function applyStartPreselection() {
    const sel = document.getElementById('categorySelector');
    let focus = null;
    try { focus = JSON.parse(storageGet('mediciq_rs_next_focus') || 'null'); } catch (e) { focus = null; }
    storageRemove('mediciq_rs_next_focus');
    const last = storageGet('mediciq_rs_last_category');
    storageRemove('mediciq_rs_last_category');
    if (focus && focus.category && sel) sel.value = focus.category;
    else if (last && sel) sel.value = last;
    if (focus && focus.letter) {
        document.querySelector('.setup-info')?.insertAdjacentHTML('beforeend', `<div class="focus-banner">🎯 <strong>Fokus für diesen Einsatz:</strong> ${escHtml(focus.letter)} – ${escHtml(focus.name)} (deine Schwachstelle aus dem letzten Einsatz).</div>`);
    }
}

document.body.addEventListener('click', () => { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); });
window.addEventListener('resize', () => { if (p.activeCase) initEKG(); });
document.addEventListener('DOMContentLoaded', () => {
    initLazyLayers();
    applyStartPreselection();
    updateNextCasePreview();
    // Direktstart eines bestimmten Falls, z.B. .../einsatz/?fall=rs_stroke_01 (für Lehrkräfte/Tests)
    const fall = new URLSearchParams(location.search).get('fall');
    if (fall && getAllCases().some(c => c.id === fall)) startMission(fall);
});
