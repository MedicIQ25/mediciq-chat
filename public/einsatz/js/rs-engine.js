// ==========================================================================================
// medicIQ – Einsatz-Simulator Rettungssanitäter: Engine
// ==========================================================================================
// Eigenständige RS-Fassung der NotSan-Einsatz-Engine (medicIQ-notsan-engine/js/script.js).
// Übernommen: Aufbau (Patient + Monitor + Akte + Maßnahmen-Tabs), Vitalwerte-Takt, Material-/
// Zeitlogik, xABCDE-Bewertung, SINNHAFT-Übergabe, Auswertung & PDF.
// RS-spezifisch: keine Medikamente/invasiven NotSan-Maßnahmen, Notarzt-Nachforderung mit
// Eintreffen vor Ort, AED-Reanimation, fallentscheidende RS-Maßnahmen je Fall, Pädiatrie.
// ==========================================================================================

let p = { activeCase: null, evaluation: {}, discovered: {} };
let currentAction = null;
let currentActionDelegated = false;
let currentTabName = 'ANAMNESE';
const scenarioDB = RS_SCENARIOS;

// ------------------------------------------------------------------------------------------
// Bilder erst laden, wenn eine Ebene sichtbar wird (spart Datenvolumen, v.a. mobil)
// ------------------------------------------------------------------------------------------
function ensureLayerSrc(img) {
    if (img && img.dataset && img.dataset.src && !img.getAttribute('src')) img.setAttribute('src', asset(img.dataset.src));
}
function initLazyLayers() {
    const view = document.getElementById('patient-view');
    if (!view) return;
    view.querySelectorAll('img[data-src]').forEach(img => { if (!img.classList.contains('hidden')) ensureLayerSrc(img); });
    const obs = new MutationObserver(muts => muts.forEach(m => {
        if (m.target.tagName === 'IMG' && !m.target.classList.contains('hidden')) ensureLayerSrc(m.target);
    }));
    obs.observe(view, { subtree: true, attributes: true, attributeFilter: ['class'] });
}
function showLayer(id) { const el = document.getElementById(id); if (el) { el.classList.remove('hidden'); ensureLayerSrc(el); } }
function hideLayer(id) { document.getElementById(id)?.classList.add('hidden'); }

// ------------------------------------------------------------------------------------------
// Hilfsfunktionen
// ------------------------------------------------------------------------------------------
function escHtml(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function escJs(str) { return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }
function shuffleCopy(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function pickDistractors(pool, count, isSame) {
    const picked = [];
    for (const val of shuffleCopy(pool)) { if (picked.length >= count) break; if (picked.some(x => isSame(x, val))) continue; picked.push(val); }
    return picked;
}
function getAllCases() { const all = []; Object.keys(scenarioDB).forEach(cat => scenarioDB[cat].forEach(c => all.push(Object.assign({ category: cat }, c)))); return all; }
function fmtTime(sec) { sec = Math.max(0, Math.floor(sec)); return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`; }
function elapsedSec() { return p.evaluation && p.evaluation.startTime ? (Date.now() - p.evaluation.startTime) / 1000 : 0; }
function flag(name) { return !!(p.activeCase && p.activeCase.flags && p.activeCase.flags[name]); }
function done(token) { return (p.evaluation.diagnosticsDone || []).includes(token); }
function markDone(token) { if (!p.evaluation.diagnosticsDone.includes(token)) p.evaluation.diagnosticsDone.push(token); }
function isPaed() { return p.activeCategory === 'paed'; }
function isTrauma() { return flag('trauma') || p.activeCategory === 'trauma'; }
function ageLabel(c) { return c.ageUnit === 'M' ? `${c.age} Monate` : `${c.age} Jahre`; }
function patientWord() { return isPaed() ? 'das Kind' : 'der Patient'; }
function storageGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function storageSet(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* Storage blockiert (z.B. iFrame) */ } }
function storageRemove(key) { try { localStorage.removeItem(key); } catch (e) { /* s.o. */ } }

// ------------------------------------------------------------------------------------------
// START
// ------------------------------------------------------------------------------------------
// Fälle werden wie ein Kartenstapel gezogen (keine Wiederholung, bis alle Fälle einer Kategorie
// dran waren). Der Stapel wird im Browser gespeichert und überlebt so das Neuladen der Seite.
function drawCase(cat) {
    const cases = scenarioDB[cat] || scenarioDB.intern;
    const key = 'mediciq_rs_deck_' + cat;
    let deck = [];
    try { deck = JSON.parse(storageGet(key) || '[]'); } catch (e) { deck = []; }
    deck = deck.filter(id => cases.some(c => c.id === id));
    if (!deck.length) deck = shuffleCopy(cases.map(c => c.id));
    const id = deck.pop();
    storageSet(key, JSON.stringify(deck));
    return cases.find(c => c.id === id) || cases[0];
}

function pickCategory(cat) {
    const sel = document.getElementById('categorySelector');
    if (sel) sel.value = cat;
    document.querySelectorAll('.category-desc').forEach(el => el.classList.toggle('selected', (el.getAttribute('onclick') || '').includes(`'${cat}'`)));
    updateNextCasePreview();
}

function startMission(forcedCaseId) {
    const cat = document.getElementById('categorySelector').value;
    let caseObj = null;
    if (forcedCaseId) caseObj = getAllCases().find(c => c.id === forcedCaseId) || null;
    if (!caseObj) caseObj = drawCase(cat);
    const activeCat = forcedCaseId ? (getAllCases().find(c => c.id === forcedCaseId)?.category || cat) : cat;
    const c = JSON.parse(JSON.stringify(caseObj));
    const [sys, dia] = String(c.vitals.rr).split('/').map(n => parseInt(n, 10));

    p = {
        activeCase: c, activeCategory: activeCat,
        hr: c.vitals.hr, spo2: c.vitals.spo2, af: c.vitals.af, rr_sys: sys, rr_dia: dia, gcs: c.vitals.gcs, temp: c.vitals.temp, bz: c.vitals.bz,
        rhythm: c.vitals.rhythm || 'SR',
        position: 'none', isDressedUpper: true, isDressedLower: true, inRTW: false,
        o2Active: false, oxygenBoost: 0, bvm: false, bvmSavedDecline: null,
        isArrest: false, hadArrest: false, pads: false, shocksDelivered: 0, shockAdvised: false, analysing: false,
        helperHDM: false, helperVent: false, playerHDM: false, playerVent: false, helperHDMStartTime: null, playerHDMStartTime: null,
        hdmDepthQuality: 1.0, hdmReleaseQuality: 1.0, hdmHistory: [], hdmQualityWindow: [], helperBusyWith: null,
        arrestStartTime: null, lastAnalysisTime: null, rhythmChecksPerformed: 0, caseEndTriggered: false, noFlowSeconds: 0, firstHdmTime: null, ventilated: false,
        naCalled: false, naCallTime: null, naArrivalAt: null, naOnScene: false, naRea: false,
        mouthCleared: false, airwayManaged: false, needsHWS: undefined, isSplinted: false, coolingActive: false,
        rrInterval: 0, lastRRTime: 0, rrPauseStart: null, displayed_rr: '--/--',
        stressFactor: 1.0, hypoxiaSeconds: 0, warnedOnce: {}, sinnhaft: null, samplerCaptured: {},
        pendingTarget: null, pendingTargetLabel: '', pendingO2Boost: 0, pendingO2Type: '', pendingO2Device: '', pendingO2Flow: 0,
        discovered: { hr: false, spo2: false, rr: false, af: false, bz: false, temp: false, gcs: false },
        evaluation: { startTime: Date.now(), ekgTime: 0, diagnosticsDone: [], medErrors: 0, errorDetails: [], contraDone: [], bleedingRegionsChecked: [], bleedingControlDone: false, copdOverO2: false, hdmStartDelay: null }
    };

    // Patientenbild: Kinder als eigene Illustration, Erwachsene mit Ebenen-System
    const view = document.getElementById('patient-view');
    const baseImg = document.getElementById('patient-body');
    view.classList.toggle('paed-mode', isPaed());
    if (baseImg) baseImg.src = asset(isPaed() ? 'patient-child.webp' : ((c.baseImage || 'patient-base') + '.webp'));
    setSceneBackgroundImage(isPaed() ? null : SCENE_BACKGROUNDS[c.sceneCategory]);

    document.querySelectorAll('#patient-view .layer').forEach(l => {
        if (l.id !== 'patient-lips' && l.id !== 'layer-pullover' && l.id !== 'layer-hose') l.classList.add('hidden');
    });
    showLayer('layer-pullover'); showLayer('layer-hose');
    (c.initialLayers || []).forEach(showLayer);

    document.getElementById('setup-area').classList.add('hidden');
    document.getElementById('sim-interface').classList.remove('hidden');
    document.getElementById('summary-content').innerHTML = '<p class="empty-hint">Führe Anamnese und Diagnostik durch...</p>';
    updateNaBadge();

    addToLog(`<strong>LEITSTELLE:</strong> ${escHtml(c.dispatch)}`);
    addToLog(`<strong>Lage bei Eintreffen:</strong> ${escHtml(c.story)}`);
    if (c.intro) addToLog(`🗣️ <span class="log-quote">„${escHtml(c.intro)}“</span>`);

    initAudio();
    playAmbientSound(c.env);
    if (c.patientSound) playPatientSound(c.patientSound);

    if (flag('startInArrest')) {
        setTimeout(() => triggerArrest(c.arrestRhythm || 'ASY'), 600);
    }

    setTimeout(() => { initEKG(); switchTab('ANAMNESE'); updateUI(); }, 100);
}

function setSceneBackgroundImage(bgFile) {
    const view = document.getElementById('patient-view');
    if (!view) return;
    view.style.setProperty('--scene-bg', bgFile ? `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url('${asset(bgFile)}')` : 'none');
    view.style.backgroundColor = bgFile ? 'transparent' : '';
}

// ------------------------------------------------------------------------------------------
// PATIENTENAKTE
// ------------------------------------------------------------------------------------------
function addToLog(msg) {
    const log = document.getElementById('summary-content');
    const timeStr = `<span class="log-time">[${fmtTime(elapsedSec())}]</span>`;
    if (log) {
        log.querySelector('.empty-hint')?.remove();
        log.insertAdjacentHTML('beforeend', `<div class="log-entry">${timeStr} ${msg}</div>`);
        log.scrollTop = log.scrollHeight;
    }
    if (/🛑|KUNSTFEHLER|FATALER/.test(msg) && p && p.evaluation && p.evaluation.errorDetails) {
        p.evaluation.errorDetails.push(msg.replace(/<[^>]*>?/gm, '').trim());
    }
}
function warnOnce(key, msg) { if (!p.warnedOnce[key]) { p.warnedOnce[key] = true; addToLog(msg); } }

// ------------------------------------------------------------------------------------------
// TABS
// ------------------------------------------------------------------------------------------
function hasOpenCriticalBleeding() {
    return flag('criticalBleeding') && done('X-Check') && !p.evaluation.bleedingControlDone;
}

function switchTab(name) {
    const content = document.getElementById('tab-content');
    if (!content || !p.activeCase) return;
    currentTabName = name;
    if (name === 'HANDOVER') { renderHandover(); }
    else {
        let html = '<div class="action-grid">';
        (ACTIONS[name] || []).forEach((act, idx) => {
            const crit = (act.token === 'tourniquet' || act.token === 'druckverband') && hasOpenCriticalBleeding();
            const active = act.toggleable && p[act.activeFlag];
            const isDone = !act.toggleable && done(act.token === 'o2_modal' ? 'o2_applied' : act.token);
            let badge = '';
            if (crit) badge = '<span class="action-badge action-badge--critical">kritisch offen</span>';
            else if (active) badge = '<span class="action-badge action-badge--active">läuft – Klick beendet</span>';
            html += `<button class="action-btn${isDone ? ' done' : ''}${active ? ' active-equipment' : ''}" onclick="processAction('${name}', ${idx})">${crit ? '🩸 ' : ''}${act.label}${badge}</button>`;
        });
        content.innerHTML = html + '</div>';
    }
    document.querySelectorAll('#nav-tabs button').forEach(b => b.classList.toggle('active', (b.getAttribute('onclick') || '').includes(`'${name}'`)));
}
function refreshTab() { if (currentTabName && currentTabName !== 'HANDOVER') switchTab(currentTabName); }

// ------------------------------------------------------------------------------------------
// MASSNAHMEN AUSFÜHREN
// ------------------------------------------------------------------------------------------
const EQUIPMENT_REMOVE = {
    o2_modal: () => {
        ['layer-o2-brille', 'layer-o2-maske', 'layer-o2-reservoir'].forEach(hideLayer);
        p.oxygenBoost = 0;
    },
    bvm: () => {
        hideLayer('patient-bvm');
        if (p.bvmSavedDecline && p.activeCase.baseDecline) Object.assign(p.activeCase.baseDecline, p.bvmSavedDecline);
        p.bvmSavedDecline = null;
        if (!p.o2Active) p.oxygenBoost = 0;
    },
    toggle_rtw: () => {
        setSceneBackgroundImage(isPaed() ? null : SCENE_BACKGROUNDS[p.activeCase.sceneCategory]);
        hideLayer('layer-trage-rtw');
        if (!isMuted && currentAmbientSound) currentAmbientSound.play().catch(() => {});
    }
};

function removeEquipment(action) {
    p[action.activeFlag] = false;
    EQUIPMENT_REMOVE[action.token]?.();
    addToLog(`<strong>${action.label}:</strong> beendet.`);
    updateUI(); refreshTab();
}

function checkContra(token) {
    const contra = (p.activeCase.contraActions || []).find(c => c.token === token);
    if (!contra) return;
    if (!p.evaluation.contraDone.includes(token)) p.evaluation.contraDone.push(token);
    addToLog(`⚠️ <span class="warn">KONTRAINDIKATION: ${escHtml(contra.text)}</span>`);
    p.stressFactor += 0.3;
}

function processAction(tab, idx, delegated = false) {
    if (!p.activeCase || p.caseFinished) return;
    const action = ACTIONS[tab] && ACTIONS[tab][idx];
    if (!action) return;
    if (action.toggleable && p[action.activeFlag]) { removeEquipment(action); return; }

    const t = action.token;
    const lifesaving = /hws|tourniquet|druckverband|becken|blutung|x-check|dms|recap|fremdk/i.test(t);
    if (action.needsUpperSkin && p.isDressedUpper && !lifesaving) {
        addToLog(`⚠️ <span class="warn">Oberkörper ist bekleidet!</span> Entkleide zuerst den Oberkörper (Start-Tab).`);
        p.evaluation.medErrors++; return;
    }
    if (action.needsLowerSkin && p.isDressedLower && !lifesaving) {
        addToLog(`⚠️ <span class="warn">Beine sind bekleidet!</span> Entferne zuerst die Hose (Start-Tab).`);
        p.evaluation.medErrors++; return;
    }

    checkContra(t);

    // Maßnahmen mit eigenem, interaktivem Fenster
    const modalMap = {
        o2_modal: () => document.getElementById('o2-modal').classList.remove('hidden'),
        'AF_zählen': showAFModal, gcs: showGCSModal, recap: showReCapModal, befast: showBefastModal,
        blutungsraeume: showBleedingModal, mundraum: showMouthModal, SAMPLER: showSamplerModal,
        '4s_check': showFourSModal, qsofa: showQsofaModal
    };
    if (modalMap[t]) { modalMap[t](); return; }

    // Indikationsprüfungen (Hinweis + Fehlerpunkt, Maßnahme läuft trotzdem)
    if (t === 'tourniquet' && !flag('criticalBleeding')) { addToLog(`⚠️ <span class="warn">INDIKATIONSFEHLER: Tourniquet ohne kritische (spritzende) Blutung!</span>`); p.evaluation.medErrors++; }
    if ((t === 'beckenschlinge' || t === 'hws' || t === 'vakuum' || t === 'helm') && !isTrauma() && p.activeCase.id !== 'rs_bsv_01') {
        addToLog(`⚠️ <span class="warn">INDIKATIONSFEHLER: ${escHtml(action.label)} ohne Trauma.</span>`); p.evaluation.medErrors++;
    }

    if (action.needsMaterial) { currentAction = action; currentActionDelegated = delegated; openMaterialModal(action); }
    else if (action.time) { startTimer(action, delegated); }
    else { finalizeAction(action, delegated); }
}

function applyO2() {
    const device = document.getElementById('o2-device').value;
    const flow = parseInt(document.getElementById('o2-flow').value, 10);
    if (isNaN(flow) || flow < 1 || flow > 15) return alert('Flussrate 1–15 l/min eingeben!');
    closeO2Modal();
    let boost = 0;
    if (device === 'brille') {
        boost = flow * 0.15;
        if (flow > 6) { addToLog(`⚠️ <span class="warn">Sauerstoffbrille über 6 l/min: kein Zusatznutzen, trocknet die Schleimhäute aus!</span>`); p.stressFactor += 0.2; }
    } else if (device === 'maske') {
        if (flow < 6) { addToLog(`🛑 <span class="critical">Einfache Maske unter 6 l/min: Gefahr der CO₂-Rückatmung!</span>`); boost = 0.05; p.evaluation.medErrors++; }
        else boost = flow * 0.25;
    } else {
        if (flow < 10) { addToLog(`⚠️ <span class="warn">Reservoirmaske braucht mind. 10 l/min, sonst fällt der Beutel zusammen!</span>`); boost = flow * 0.15; }
        else boost = flow * 0.4;
    }
    if (flag('copd') && flow > 4) addToLog(`⚠️ <span class="warn">COPD: Sauerstoff vorsichtig titrieren – Ziel-SpO₂ 88–92 %!</span>`);
    p.pendingO2Boost = boost; p.pendingO2Type = device; p.pendingO2Flow = flow;
    // Sättigungs-Plateau unter O2 (bezogen auf den Ausgangswert des Falls)
    const gain = device === 'brille' ? Math.min(flow, 6) * 2 : device === 'maske' ? flow * 1.3 : flow * 1.0;
    p.pendingO2Cap = Math.min(99, p.activeCase.vitals.spo2 + gain + 2);
    p.pendingO2Device = device === 'brille' ? 'Sauerstoffbrille' : device === 'maske' ? 'Einfache Maske' : 'Maske mit Reservoir';
    startTimer({ label: `O₂ anschließen (${p.pendingO2Device})`, time: 4, token: 'o2_applied' });
}

// Befundtext eines Tokens aus dem Fall (oder Standardtext)
function finding(token, fallback) { const f = p.activeCase.findings || {}; return f[token] || fallback || 'Unauffällig.'; }

function finalizeAction(action, delegated = false) {
    if (!p.activeCase || p.caseFinished) return;
    const c = p.activeCase;
    const t = action.token;
    let text = finding(t, 'Durchgeführt.');
    let cls = '';
    let skipMark = false;

    switch (t) {
        // ---------------- Lage / Anamnese ----------------
        case 'psa': text = 'Schutzausrüstung angelegt (Handschuhe, bei Bedarf FFP2-Maske, Schutzbrille, Kittel).'; p.psa = true; break;
        case 'entkleiden_oben': p.isDressedUpper = false; hideLayer('layer-pullover'); text = 'Oberkörper entkleidet. Brustkorb frei.'; break;
        case 'entkleiden_unten': p.isDressedLower = false; hideLayer('layer-hose'); text = 'Beine entkleidet.'; break;
        case 'OPQRST':
            text = (p.isArrest || p.gcs < 10) ? 'Nicht erhebbar – ' + patientWord() + ' ist nicht adäquat ansprechbar.' : finding('OPQRST');
            break;
        case 'NRS':
            text = (p.isArrest || p.gcs < 10) ? 'Nicht erhebbar – ' + patientWord() + ' ist nicht adäquat ansprechbar.' : finding('NRS');
            break;
        case 'betreuung': {
            p.stressFactor = Math.max(1.0, p.stressFactor - 0.4);
            const betreuungText = {
                rs_psych_01: 'Du sprichst ruhig, hältst Abstand, lässt dem Patienten einen Ausweg und nimmst seine Angst ernst. Er wird etwas ruhiger.',
                rs_krupp_01: 'Das Kind bleibt auf dem Arm der Mutter, du erklärst ruhig. Das Weinen lässt nach, der Stridor wird leiser.',
                rs_misshandlung_01: 'Du bleibst ruhig und sachlich, ohne Vorwürfe. Die Bezugsperson willigt in den Transport ein.'
            };
            text = betreuungText[c.id] || (isPaed() ? 'Du beruhigst Kind und Eltern und erklärst jeden Schritt.' : 'Du sprichst ruhig mit dem Patienten und erklärst jeden Schritt. Er wirkt etwas ruhiger.');
            if (c.id === 'rs_krupp_01') { p.spo2 = Math.min(98, p.spo2 + 2); p.af = Math.max(26, p.af - 4); }
            break;
        }
        case 'asservate': text = 'Asservate (Packungen, Behälter, Etiketten) gesichert und für die Klinik mitgenommen.'; break;
        case 'call_nef': callNA(); return;
        case 'call_fw': text = 'Leitstelle: Feuerwehr alarmiert (technische Hilfe / Absicherung / Messung).'; p.fwCalled = true; break;
        case 'call_pol': text = 'Leitstelle: Polizei alarmiert und auf Anfahrt.'; p.polCalled = true; break;
        case 'toggle_rtw':
            p.inRTW = true;
            setSceneBackgroundImage(isPaed() ? null : RTW_BACKGROUND_FILE);
            showLayer('layer-trage-rtw');
            if (currentAmbientSound && !currentAmbientSound.paused) currentAmbientSound.pause();
            text = 'Patient liegt jetzt im RTW – geschützte, warme Umgebung.';
            if (c.id === 'rs_hitze_01') { p.coolingActive = true; text += ' Klimaanlage auf kühl.'; }
            if (hasOpenCriticalBleeding()) { p.evaluation.rtwWithOpenBleeding = true; addToLog(`⚠️ <span class="warn">Kritische Blutung ist noch nicht versorgt – X kommt vor dem Transport!</span>`); }
            break;

        // ---------------- X ----------------
        case 'X-Check':
            text = finding('X-Check', 'Keine kritische Blutung sichtbar.');
            if (hasOpenCriticalBleeding() || (flag('criticalBleeding') && !p.evaluation.bleedingControlDone)) cls = 'critical';
            break;
        case 'druckverband':
        case 'tourniquet': {
            const rt = c.requiredTargets || {};
            const label = p.pendingTargetLabel || 'Extremität';
            if (rt[t] && rt[t] === p.pendingTarget) {
                text = `Korrekt angelegt an: ${label}. <strong class="ok">Blutung steht!</strong>`;
                controlBleeding(t);
            } else if (rt[t] && rt[t] !== p.pendingTarget) {
                text = `🛑 <span class="critical">Falscher Ort (${escHtml(label)})! Die blutende Stelle ist woanders.</span>`; p.evaluation.medErrors++;
            } else if (flag('criticalBleeding')) {
                text = `${escHtml(action.label)} an ${escHtml(label)}: <span class="critical">Die Blutung steht damit nicht!</span>`;
            } else {
                text = `${escHtml(action.label)} an ${escHtml(label)} angelegt.`;
            }
            if (p.pendingTarget && p.pendingTarget !== 'kopf') showLayer(`layer-${t}-${p.pendingTarget}`);
            break;
        }
        case 'nasenbluten':
            text = c.id === 'rs_rr_01' ? 'Kopf nach vorne gebeugt, Nasenflügel 10 Minuten komprimiert, Nacken gekühlt – die Blutung lässt deutlich nach.' : 'Kein Nasenbluten vorhanden.';
            break;
        case 'fremdk_stabi':
            if (flag('impaled')) { text = 'Fremdkörper belassen, steril umpolstert und gegen Verrutschen fixiert.'; cls = 'ok'; p.evaluation.bleedingControlDone = true; p.stressFactor = Math.max(1.0, p.stressFactor - 0.3); }
            else text = 'Kein Fremdkörper vorhanden.';
            break;
        case 'fremdk_raus':
            if (flag('impaled')) {
                text = '🛑 FATALER FEHLER: Fremdkörper herausgezogen! Massive, schwallartige Blutung aus der Tiefe – der Fremdkörper hat die Blutung tamponiert!';
                cls = 'critical'; p.evaluation.medErrors += 3; p.stressFactor += 2.0; p.rr_sys -= 35; p.hr += 30;
                c.baseDecline = Object.assign({}, c.baseDecline, { rr: -1.0, hr: 0.6 }); p.evaluation.impaledRemoved = true;
            } else if (c.id === 'rs_auge_01') {
                text = '🛑 KUNSTFEHLER: Fremdkörper im Auge darf nicht entfernt werden (Perforation, Glaskörperverlust)!'; cls = 'critical'; p.evaluation.medErrors += 2;
            } else text = 'Es gibt keinen Fremdkörper zu entfernen.';
            break;

        // ---------------- A ----------------
        case 'esmarch':
            if (p.gcs <= 12 || p.isArrest) { p.airwayManaged = true; text = 'Atemweg mit Esmarch-Handgriff freigemacht – das Schnarchen verschwindet.'; if (c.id === 'rs_opiat_01' && !p.bvm) text += ' Die Atmung bleibt aber viel zu langsam!'; }
            else text = 'Nicht nötig – ' + patientWord() + ' hält den Atemweg selbst frei.';
            break;
        case 'man_hws': showLayer('layer-man_hws'); p.hwsManual = true; text = 'Kopf in Neutralposition manuell stabilisiert (In-line-Stabilisierung).'; break;
        case 'husten_ermutigen':
            if (flag('coughEffective')) { text = 'Das Kind hustet kräftig weiter – der Husten ist effektiv. Richtig: ermutigen und beobachten!'; cls = 'ok'; p.spo2 = Math.min(97, p.spo2 + 2); p.stressFactor = Math.max(1.0, p.stressFactor - 0.3); }
            else text = 'Kein Hinweis auf eine Fremdkörperverlegung.';
            break;
        case 'fremdkoerper_manoever':
            if (flag('coughEffective')) text = '5 Rückenschläge durchgeführt – das Kind wird dabei unruhig und hustet schlechter.';
            else text = 'Rückenschläge/Oberbauchkompressionen durchgeführt – keine Fremdkörperverlegung erkennbar.';
            break;
        case 'guedel':
            if (p.gcs > 8 && !p.isArrest) {
                text = '🛑 FATALER FEHLER: Schutzreflexe vorhanden! Massives Würgen und Erbrechen – Aspirationsgefahr!';
                cls = 'critical'; p.stressFactor += 1.0; p.evaluation.medErrors += 2; p.spo2 -= 8;
            } else { showLayer('layer-guedel'); p.airwayManaged = true; text = 'Guedel-Tubus eingelegt – Atemweg bei tief bewusstlosem Patienten freigehalten.'; cls = 'ok'; }
            break;
        case 'wendel':
            if (c.id === 'rs_sbb_01') {
                text = '🛑 FATALER FEHLER: Wendl-Tubus bei V.a. Schädelbasisbruch – Gefahr der intrakraniellen Fehllage!';
                cls = 'critical'; p.stressFactor += 2.0; p.evaluation.medErrors += 3;
            } else { showLayer('layer-wendel'); p.airwayManaged = true; text = 'Wendl-Tubus mit Gleitgel eingelegt – Atemweg gesichert, wird toleriert.'; }
            break;

        // ---------------- B ----------------
        case 'Thorax_insp': text = finding('Thorax_insp', 'Thorax seitengleich, symmetrische Atemexkursionen, keine Prellmarken.'); break;
        case 'Lunge': {
            playLungSound();
            text = finding('Lunge', 'Vesikuläratmen beidseits, keine Nebengeräusche.');
            break;
        }
        case 'spo2_clip': p.discovered.spo2 = true; p.discovered.hr = true; text = `Pulsoxymeter angelegt. SpO₂ ${Math.round(p.spo2)} %, Puls ${Math.round(p.hr)}/min.`; if (flag('coIntox')) text += ' <span class="warn">(Achtung: Bei CO-Vergiftung ist der SpO₂-Wert falsch hoch!)</span>'; break;
        case 'o2_applied':
            p.oxygenBoost = p.pendingO2Boost; p.o2Active = true; p.o2Cap = p.pendingO2Cap || 99;
            ['layer-o2-brille', 'layer-o2-maske', 'layer-o2-reservoir'].forEach(hideLayer);
            showLayer(`layer-o2-${p.pendingO2Type}`);
            text = `${p.pendingO2Device} läuft mit ${p.pendingO2Flow} l/min.`;
            markDone('o2_modal');
            if (flag('coIntox')) p.evaluation.coO2Ok = p.pendingO2Type === 'reservoir' && p.pendingO2Flow >= 10;
            break;
        case 'okh': case 'schocklage': case 'flach': case 'ssl': case 'knierolle':
            text = setPosition(t);
            if (p.position !== (t === 'knierolle' ? 'knierolle' : t)) skipMark = true;
            break;
        case 'bvm': text = startBVM(); cls = text.includes('FEHLER') ? 'critical' : ''; break;
        case 'atemtechnik':
            if (flag('copd') || c.lungSound === 'giemen') { text = 'Lippenbremse und Kutschersitz angeleitet – die Ausatmung wird länger, die Atmung ruhiger.'; p.af = Math.max(18, p.af - 3); p.spo2 = Math.min(96, p.spo2 + 2); p.stressFactor = Math.max(1.0, p.stressFactor - 0.3); }
            else text = 'Atemtechnik angeleitet – hier ohne erkennbaren Nutzen.';
            break;
        case 'kaltluft':
            if (c.id === 'rs_krupp_01') { text = 'Fenster geöffnet, kühle feuchte Nachtluft – der Stridor wird leiser.'; p.spo2 = Math.min(98, p.spo2 + 2); p.stressFactor = Math.max(1.0, p.stressFactor - 0.3); }
            else text = 'Frische Luft – ohne besondere Wirkung.';
            break;
        case 'chest_seal':
            if (flag('openPneu')) {
                text = 'Chest Seal mit Ventil luftdicht aufgeklebt – das Sauggeräusch verschwindet.'; cls = 'ok';
                c.baseDecline = Object.assign({}, c.baseDecline, { spo2: 0.03, hr: -0.03 }); p.spo2 = Math.min(95, p.spo2 + 4); p.stressFactor = Math.max(1.0, p.stressFactor - 0.3);
            } else if (c.revCause === 'spannungspneu') {
                text = 'Stichwunde mit Chest Seal (Ventil) verschlossen. Die Atemnot besteht weiter – Verdacht auf Spannungspneu, der Notarzt muss entlasten!';
                c.baseDecline = Object.assign({}, c.baseDecline, { spo2: (c.baseDecline.spo2 || 0) / 2 });
            } else text = 'Chest Seal geklebt – keine Thoraxwunde, keine Indikation.';
            break;

        // ---------------- C ----------------
        case 'puls': {
            p.discovered.hr = true;
            const regular = p.rhythm === 'VHF' ? 'unregelmäßig' : p.rhythm === 'VES' ? 'mit einzelnen Aussetzern' : 'regelmäßig';
            const quality = p.rr_sys < 80 ? 'schwach, fadenförmig' : p.rr_sys < 100 ? 'eher schwach' : 'kräftig';
            text = `Radialispuls ${Math.round(p.hr)}/min, ${regular}, ${quality}.`;
            break;
        }
        case 'hautstatus': text = finding('hautstatus', 'Rosig, warm, trocken.'); break;
        case 'RR_Measure':
            p.discovered.rr = true; p.lastRRTime = Date.now(); p.displayed_rr = `${Math.round(p.rr_sys)}/${Math.round(p.rr_dia)}`;
            showLayer('layer-rr_measure');
            text = `RR: <strong>${p.displayed_rr} mmHg</strong>.`;
            break;
        case 'rr_beidseits':
            p.discovered.rr = true; p.lastRRTime = Date.now(); p.displayed_rr = `${Math.round(p.rr_sys)}/${Math.round(p.rr_dia)}`;
            showLayer('layer-rr_beidseits');
            text = finding('rr_beidseits', `RR rechts ${p.displayed_rr}, links ${Math.round(p.rr_sys) - 4}/${Math.round(p.rr_dia) - 2} mmHg – keine relevante Seitendifferenz.`);
            break;
        case 'ekg_monitor':
            p.discovered.hr = true; p.monitorEkg = true; showLayer('layer-ekg_monitor');
            text = `EKG-Monitoring läuft. Monitor: ${rhythmDescription()}.`;
            break;
        case 'ekg':
            p.discovered.hr = true; p.monitorEkg = true; showLayer('layer-ekg');
            if (!p.evaluation.ekgTime) p.evaluation.ekgTime = Date.now();
            text = `12-Kanal-EKG geschrieben und an Notarzt/Telenotarzt übermittelt. <button class="inline-btn" style="background:#00d2ff;" onclick="showEKGModal()">🔍 EKG ansehen</button>`;
            setTimeout(showEKGModal, 300);
            break;
        case 'iv_vorbereiten':
            text = 'Material für Zugang und Infusion vorbereitet – der Notarzt/NotSan kann sofort punktieren.';
            if (!p.naCalled) text += ' <span class="warn">Hinweis: Ohne Notarzt/NotSan wird der Zugang nicht gelegt.</span>';
            break;
        case 'trinken':
            if (p.gcs < 14) { text = '🛑 KUNSTFEHLER: Bewusstseinsgetrübter Patient – Aspirationsgefahr beim Trinken!'; cls = 'critical'; p.evaluation.medErrors += 2; }
            else if (c.id === 'rs_exsikkose_01') { text = 'Die Patientin trinkt langsam ein Glas Wasser.'; cls = 'ok'; c.baseDecline = Object.assign({}, c.baseDecline, { rr: 0.03, hr: -0.03 }); }
            else text = 'Patient trinkt einen Schluck Wasser.';
            break;

        // ---------------- D ----------------
        case 'Neuro':
            text = `${escHtml(finding('Neuro', 'Isokor, prompt lichtreagibel.'))} <button class="inline-btn" style="background:#f39c12;" onclick="showPupilModal()">🔦 Taschenlampe</button>`;
            setTimeout(showPupilModal, 300);
            break;
        case 'BZ':
            p.discovered.bz = true;
            text = `Blutzucker: <strong class="${(p.bz < 60 || p.bz > 250) ? 'critical' : 'ok'}">${Math.round(p.bz)} mg/dl</strong>.`;
            break;
        case 'dms': {
            const fr = flag('fraktur') || c.id === 'rs_bsv_01' || flag('spinal');
            if (p.isSplinted && flag('fraktur')) text = 'DMS nach der Schienung kontrolliert: Durchblutung, Motorik und Sensibilität erhalten.';
            else text = finding('dms', fr ? 'DMS distal eingeschränkt – engmaschig kontrollieren!' : 'DMS an allen Extremitäten intakt.');
            if (p.isSplinted) markDone('dms_after');
            break;
        }
        case 'meningismus': text = finding('meningismus', flag('meningismus') ? 'Meningismus positiv.' : 'Kein Meningismus.'); break;
        case 'glukose_oral': text = giveOralGlucose(); cls = text.includes('KUNSTFEHLER') ? 'critical' : ''; break;
        case 'schutz_krampf': text = 'Gefährliche Gegenstände entfernt, Kopf gepolstert – nicht festgehalten.'; break;

        // ---------------- E ----------------
        case 'bodycheck': text = finding('bodycheck', 'Keine weiteren Verletzungen sichtbar.'); break;
        case 'abdomen': text = finding('abdomen', 'Weich, kein Druckschmerz.'); break;
        case 'temperatur':
            p.discovered.temp = true;
            text = `Temperatur: <strong class="${(p.temp < 35 || p.temp > 38.5) ? 'critical' : 'ok'}">${p.temp.toFixed(1)} °C</strong>.`;
            break;
        case 'waerme': p.warmth = true; p.stressFactor = Math.max(1.0, p.stressFactor - 0.2); text = 'Wärmeerhalt mit Decke – Auskühlung wird verhindert.'; break;
        case 'kuehlung': text = startCooling(); break;
        case 'wund_sek':
            if (flag('evisz')) text = 'Darmschlingen NICHT zurückgedrückt, feucht (NaCl) und steril abgedeckt.';
            else if (c.id === 'rs_offen_tib_01') text = 'Offene Fraktur steril abgedeckt, Knochen nicht zurückgeschoben.';
            else text = 'Wunde steril abgedeckt und verbunden.';
            if (p.evaluation.bleedingControlDone && !document.getElementById('patient-ambutation-fuss-links')?.classList.contains('hidden')) {
                hideLayer('patient-ambutation-fuss-links'); showLayer('patient-amputation-fuss-links-versorgt');
            }
            p.stressFactor = Math.max(1.0, p.stressFactor - 0.2);
            break;
        case 'brandwunde':
            text = 'Brandwunden mit sterilem, nicht haftendem Verbandtuch (z.B. Metalline) locker abgedeckt.';
            [['patient-verbrennung-brust', 'patient-verbrennung-brust-versorgt'], ['patient-verbrennung-arm-rechts', 'patient-verbrennung-arm-rechts-versorgt'], ['patient-verbrennung-bein-rechts', 'patient-verbrennung-bein-rechts-versorgt']]
                .forEach(([a, b]) => { const el = document.getElementById(a); if (el && !el.classList.contains('hidden')) { hideLayer(a); showLayer(b); } });
            if (!flag('burn')) text = 'Keine Brandwunden vorhanden.';
            break;
        case 'spuelen':
            if (c.id === 'rs_acid_01') { text = 'Haut und Gesicht ausgiebig mit fließendem Wasser gespült (mindestens 10–20 Minuten fortsetzen).'; cls = 'ok'; p.stressFactor = Math.max(1.0, p.stressFactor - 0.4); }
            else if (c.id === 'rs_intox_kind') text = 'Mund vorsichtig ausgewischt/ausgespült – kein Erbrechen ausgelöst, nichts nachtrinken lassen.';
            else text = 'Gespült – ohne erkennbare Indikation.';
            break;
        case 'augen': text = c.id === 'rs_auge_01' ? 'Beide Augen steril abgedeckt (verhindert Mitbewegung), Fremdkörper belassen.' : 'Augen abgedeckt – ohne erkennbare Indikation.'; break;
        case 'amputat':
            text = ['rs_ampu_01', 'rs_blast_01', 'rs_scalp_01'].includes(c.id)
                ? 'Amputat trocken in sterile Kompresse gewickelt, in Replantatbeutel verpackt und indirekt gekühlt (nie direkt auf Eis).'
                : 'Kein Amputat vorhanden.';
            break;
        case 'schiene':
        case 'alu_schiene': text = applySplint(t); break;
        case 'polstern':
            text = c.id === 'rs_patella_01' ? 'Knie in vorgefundener Beugestellung mit Decken gepolstert – deutliche Schmerzlinderung.' : 'Betroffene Region gepolstert.';
            if (c.id === 'rs_patella_01') p.stressFactor = Math.max(1.0, p.stressFactor - 0.3);
            break;

        // ---------------- TRAUMA ----------------
        case 'NEXUS': text = nexusCheck(); break;
        case 'hws':
            hideLayer('layer-man_hws'); showLayer('layer-hws');
            if (p.needsHWS === false) text = 'HWS immobilisiert. Hinweis: NEXUS war negativ – Maßnahme nicht zwingend.';
            else text = 'HWS mit Zervikalstütze immobilisiert.';
            break;
        case 'helm': text = flag('spinal') ? 'Helm zu zweit unter manueller In-line-Stabilisierung abgenommen.' : 'Kein Helm vorhanden.'; break;
        case 'beckenschlinge':
            showLayer('layer-beckenschlinge');
            if (flag('pelvic')) {
                text = 'Beckenschlinge auf Höhe der Trochanteren angelegt und geschlossen – der Beckenring ist stabilisiert.'; cls = 'ok';
                c.baseDecline = Object.assign({}, c.baseDecline, { rr: 0 }); p.rr_sys += 10; p.stressFactor = Math.max(1.0, p.stressFactor - 0.3);
            } else text = 'Beckenschlinge angelegt (kein instabiler Beckenring festgestellt).';
            break;
        case 'vakuum': hideLayer('layer-man_hws'); showLayer('layer-vakuum'); text = 'Patient mit Schaufeltrage in die Vakuummatratze umgelagert und immobilisiert.'; p.isSplinted = p.isSplinted || flag('fraktur'); break;

        // ---------------- REANIMATION ----------------
        case 'pads':
            p.pads = true; p.discovered.hr = true; p.monitorEkg = true; showLayer('layer-pads');
            if (p.isDressedUpper) { p.isDressedUpper = false; hideLayer('layer-pullover'); }
            text = 'Oberkörper freigemacht, AED eingeschaltet, Pads geklebt. AED: „Analyse starten – Patient nicht berühren!“';
            document.getElementById('btn-pads-cpr')?.classList.add('done-task');
            break;
    }

    if (!skipMark) markDone(t);
    if (delegated) { p.helperBusyWith = null; addToLog(`<strong>${escHtml(action.label)}:</strong> Dein Helfer hat das übernommen. ${text}`); }
    else addToLog(cls ? `<strong>${escHtml(action.label)}:</strong> <span class="${cls}">${text}</span>` : `<strong>${escHtml(action.label)}:</strong> ${text}`);
    updateUI();
    refreshTab();
}

function controlBleeding(token) {
    p.evaluation.bleedingControlDone = true;
    document.querySelectorAll('#patient-view .layer').forEach(l => { if (/blut/.test(l.id)) l.classList.add('hidden'); });
    if (p.activeCase.baseDecline) p.activeCase.baseDecline = Object.assign({}, p.activeCase.baseDecline, { rr: 0.05, hr: -0.08, spo2: 0 });
    p.stressFactor = Math.max(1.0, p.stressFactor - 0.5);
}

function setPosition(t) {
    const c = p.activeCase;
    const prev = p.position;
    p.position = t === 'knierolle' ? 'knierolle' : t;
    if (t === 'okh') {
        if (p.rr_sys < 90) warnOnce('okh_hypo', `⚠️ <span class="warn">Oberkörperhochlagerung bei Hypotonie verschlechtert den Kreislauf!</span>`);
        return 'Oberkörper hochgelagert.';
    }
    if (t === 'schocklage') {
        if (c.vitals.stemi || c.lungSound === 'rasseln' || flag('copd') || c.id === 'rs_oedem_01') warnOnce('schock_kontra', `⚠️ <span class="warn">Schocklage bei Atemnot/kardialer Ursache verschlechtert die Atmung!</span>`);
        if (isTrauma() && (flag('pelvic') || flag('spinal'))) {
            p.evaluation.medErrors++;
            addToLog(`⛔ <span class="critical">KUNSTFEHLER: Schocklage bei V.a. Becken-/Wirbelsäulenverletzung – flach lagern!</span>`);
        }
        return 'Beine hochgelagert (Schocklage).';
    }
    if (t === 'flach') return 'Flach gelagert.';
    if (t === 'knierolle') { if (/abdomen|appendizitis|evisz|ileus|invagination/i.test(c.id)) p.stressFactor = Math.max(1.0, p.stressFactor - 0.2); return 'Knierolle untergelegt – die Bauchdecke ist entspannt.'; }
    if (t === 'ssl') {
        if (p.gcs >= 14 && !p.isArrest) { warnOnce('ssl_wach', `ℹ️ <span class="info">Stabile Seitenlage bei wachem Patienten nicht nötig.</span>`); p.position = prev; return 'Patient ist wach und lehnt die Seitenlage ab.'; }
        if (isTrauma() && (flag('spinal') || p.activeCase.id === 'rs_poly_sturz') && !p.hwsManual && !done('hws')) addToLog(`⚠️ <span class="warn">Seitenlage beim Traumapatienten nur unter HWS-Stabilisierung!</span>`);
        p.airwayManaged = true;
        return 'Stabile Seitenlage – Atemwege frei, Aspirationsschutz.';
    }
    return 'Gelagert.';
}

function startBVM() {
    ['layer-o2-brille', 'layer-o2-maske', 'layer-o2-reservoir'].forEach(hideLayer);
    p.o2Active = false;
    showLayer('patient-bvm');
    p.bvm = true; p.ventilated = true;
    if (p.isArrest) { if (!p.helperHDM) p.helperVent = true; else { p.playerVent = true; p.playerHDM = false; } updateDelegateVisuals(); return 'Beutel-Masken-Beatmung mit Sauerstoff im Rahmen der Reanimation.'; }
    if (p.af < 8 || p.gcs < 9) {
        p.af = 12; p.spo2 = Math.min(100, p.spo2 + 20); p.oxygenBoost = 1.5; p.airwayManaged = true;
        const d = p.activeCase.baseDecline || {};
        p.bvmSavedDecline = { spo2: d.spo2 || 0 };
        p.activeCase.baseDecline = Object.assign({}, d, { spo2: 0 });
        p.stressFactor = Math.max(1.0, p.stressFactor - 0.5);
        return 'Assistierte Beatmung begonnen – der Thorax hebt sich, die Sättigung steigt.';
    }
    if (p.gcs > 12 && p.af >= 10) {
        p.evaluation.medErrors += 2; p.stressFactor += 1.0; p.hr += 15; p.rr_sys += 20;
        playPatientSound('screaming');
        return '🛑 FATALER FEHLER: Beutel-Masken-Beatmung bei wachem Patienten mit ausreichender Eigenatmung – er wehrt sich panisch!';
    }
    p.spo2 = Math.min(100, p.spo2 + 8); p.oxygenBoost = 1.0;
    return 'Atmung mit dem Beatmungsbeutel unterstützt.';
}

function giveOralGlucose() {
    const c = p.activeCase;
    if (p.gcs < 13 || p.isArrest) {
        p.evaluation.medErrors += 2; p.spo2 -= 6; p.stressFactor += 1.0;
        return '🛑 KUNSTFEHLER: Orale Glukose bei Bewusstseinsstörung (GCS < 13) – Aspirationsgefahr! Hier muss der Notarzt Glukose i.v. geben.';
    }
    if (!p.discovered.bz) { p.evaluation.medErrors++; addToLog(`⚠️ <span class="warn">Glukose gegeben, ohne vorher den Blutzucker zu messen!</span>`); }
    if (p.bz < 70) {
        p.bz = 110; p.gcs = 15;
        p.activeCase.patientSound = ''; if (currentPatientSound) currentPatientSound.pause();
        p.stressFactor = Math.max(1.0, p.stressFactor - 0.5);
        p.evaluation.glucoseOralOk = true;
        return 'Glukose-Gel/Saft geschluckt. Nach wenigen Minuten klart ' + patientWord() + ' vollständig auf.';
    }
    return 'Glukose gegeben – der Blutzucker war nicht erniedrigt.';
}

function startCooling() {
    const c = p.activeCase;
    if (c.id === 'rs_hitze_01') { p.coolingActive = true; p.stressFactor = Math.max(1.0, p.stressFactor - 0.3); return 'Aktive Kühlung: Kleidung geöffnet, feuchte Tücher, Kühlpacks an Hals/Leiste/Achsel.'; }
    if (c.id === 'rs_fieber_01') { p.coolingActive = true; return 'Kind leicht entkleidet, lauwarme Wadenwickel angelegt.'; }
    if (c.id === 'rs_ana_01') return 'Stachel ausgekratzt, Einstichstelle mit Kühlpack gekühlt.';
    if (flag('burn')) {
        if (isPaed()) { addToLog(`⚠️ <span class="warn">Kind: Kühlung nur kurz und lauwarm – Unterkühlungsgefahr!</span>`); }
        return 'Kurz mit lauwarmem Wasser gekühlt (max. 10 Minuten, nur bei kleinen Flächen).';
    }
    if (flag('fraktur') || c.id === 'rs_patella_01' || c.id === 'rs_trauma_arm') return 'Kühlpack mit Polsterung aufgelegt (nie direkt auf die Haut).';
    if (c.id === 'rs_exsikkose_01') { p.coolingActive = true; return 'Fenster geöffnet, Patientin aus der Hitze gebracht, feuchte Tücher.'; }
    return 'Gekühlt – ohne klare Indikation.';
}

function applySplint(t) {
    const c = p.activeCase;
    const rt = c.requiredTargets || {};
    const label = p.pendingTargetLabel || 'Extremität';
    const type = t === 'alu_schiene' ? 'Alu-Polsterschiene' : 'schiene';
    if (rt[t] && rt[t] !== p.pendingTarget) {
        p.evaluation.medErrors++;
        return `⚠️ <span class="warn">Schiene am falschen Körperteil (${escHtml(label)})!</span>`;
    }
    if (p.pendingTarget) showLayer(`patient-${type}-${p.pendingTarget}`);
    if (flag('fraktur') && rt[t] === p.pendingTarget) {
        p.isSplinted = true;
        document.querySelectorAll('#patient-view .layer').forEach(l => { if (l.id.includes('fraktur') && !l.classList.contains('hidden')) l.classList.add('hidden'); });
        p.stressFactor = Math.max(1.0, p.stressFactor - 0.3);
        return `Ruhigstellung an ${escHtml(label)} erfolgt – spürbare Schmerzlinderung. DMS erneut kontrollieren!`;
    }
    return `Schiene an ${escHtml(label)} angelegt.`;
}

function nexusCheck() {
    const c = p.activeCase;
    const f = c.findings && c.findings.NEXUS;
    const positive = flag('spinal') || (isTrauma() && (p.gcs < 15 || ['screaming', 'mumbling'].includes(c.patientSound) || /sht|sturz|schädel|strangulation|polytrauma/i.test(c.diagnosis)));
    p.needsHWS = positive;
    if (positive) return `NEXUS-Kriterien POSITIV${f ? ' – ' + escHtml(f) : ' (z.B. Bewusstseinsstörung, ablenkende Verletzung, neurologisches Defizit)'}. HWS-Immobilisation indiziert!`;
    return 'NEXUS-Kriterien NEGATIV: wach, orientiert, keine Intoxikation, kein Druckschmerz der HWS, keine ablenkende Verletzung.';
}

function rhythmDescription() {
    if (p.isArrest) return { VF: 'Kammerflimmern', ASY: 'Nulllinie', PEA: 'organisierte Kammerkomplexe ohne Puls' }[p.rhythm] || p.rhythm;
    if (p.rhythm === 'VHF') return 'unregelmäßige, schnelle Kammerkomplexe (absolute Arrhythmie)';
    if (p.rhythm === 'VES') return 'Sinusrhythmus mit einzelnen breiten Extraschlägen';
    const hr = Math.round(p.hr);
    return hr > 100 ? 'regelmäßige Tachykardie' : hr < 60 ? 'regelmäßige Bradykardie' : 'regelmäßiger Rhythmus';
}

// ------------------------------------------------------------------------------------------
// NOTARZT
// ------------------------------------------------------------------------------------------
function callNA() {
    if (p.naCalled) { addToLog(`<strong>Notarzt:</strong> ist bereits alarmiert${p.naOnScene ? ' und vor Ort' : ''}.`); return; }
    p.naCalled = true; p.naCallTime = Date.now(); p.naArrivalAt = Date.now() + NA_DELAY_MS;
    markDone('call_nef');
    p.stressFactor = Math.max(1.0, p.stressFactor - 0.2);
    addToLog(`<strong>🚑 Notarzt nachgefordert:</strong> Leitstelle bestätigt – NEF ist alarmiert, Eintreffen in ca. ${Math.round(NA_DELAY_MS / 60000 * 10) / 10} Minuten.`);
    updateNaBadge(); refreshTab();
}

const NA_EFFECTS = {
    glucose: () => { p.bz = 110; if (!p.isArrest) p.gcs = 15; p.activeCase.patientSound = ''; currentPatientSound?.pause(); },
    naloxon: () => { if (!p.isArrest) { p.gcs = 14; p.af = 14; p.spo2 = Math.min(97, p.spo2 + 10); } },
    entlastung: () => { p.spo2 = Math.min(96, p.spo2 + 12); p.hr -= 30; p.rr_sys += 25; p.rr_dia += 15; },
    adrenalin: () => { p.spo2 = Math.min(97, p.spo2 + 6); p.rr_sys += 25; p.rr_dia += 12; p.hr -= 10; },
    volumen: () => { p.rr_sys += 15; p.rr_dia += 8; p.hr -= 10; },
    analgesie: () => { p.activeCase.patientSound = ''; currentPatientSound?.pause(); p.activeCase.findings.NRS = 'Schmerzskala: 3/10 (nach Analgesie durch den Notarzt).'; p.hr -= 8; p.stressFactor = Math.max(1.0, p.stressFactor - 0.5); },
    atropin: () => { if (p.hr < 50) { p.hr += 25; p.rr_sys += 15; } },
    broncho: () => { p.spo2 = Math.min(95, p.spo2 + 5); p.af = Math.max(18, p.af - 6); },
    oedem: () => { p.spo2 = Math.min(95, p.spo2 + 5); p.af = Math.max(20, p.af - 4); p.rr_sys -= 25; p.rr_dia -= 10; },
    rrsenkung: () => { p.rr_sys -= 30; p.rr_dia -= 15; },
    frequenz: () => { p.hr = Math.max(95, p.hr - 45); },
    sedierung: () => { p.hr -= 20; p.rr_sys -= 25; p.rr_dia -= 10; p.activeCase.patientSound = ''; currentPatientSound?.pause(); },
    rea: () => { p.naRea = true; }
};

function naArrive() {
    if (p.naOnScene) return;
    p.naOnScene = true;
    const c = p.activeCase;
    addToLog(`🚑 <strong class="ok">Der Notarzt trifft ein.</strong> Kurzübergabe an den Notarzt – ${escHtml(c.naText)}`);
    // Verschlechterung stoppt, der Patient stabilisiert sich langsam
    const d = c.baseDecline || {};
    c.baseDecline = { spo2: Math.max(0, d.spo2 || 0, (d.spo2 || 0) < 0 ? 0.04 : 0), hr: (d.hr || 0) > 0 ? -0.04 : (d.hr || 0) < 0 ? 0.04 : 0, rr: (d.rr || 0) < 0 ? 0.04 : 0, gcs: Math.max(0, d.gcs || 0) };
    (c.naEffects || []).forEach(fx => NA_EFFECTS[fx] && NA_EFFECTS[fx]());
    if (p.isArrest) p.naRea = true;
    p.stressFactor = 1.0;
    updateNaBadge(); updateUI();
}

function updateNaBadge() {
    const b = document.getElementById('na-badge');
    if (!b) return;
    if (!p.activeCase || !p.naCalled) { b.classList.add('hidden'); return; }
    b.classList.remove('hidden');
    if (p.naOnScene) { b.className = 'na-here'; b.textContent = '🚑 Notarzt vor Ort'; }
    else { b.className = 'na-coming'; b.textContent = `🚑 NA auf Anfahrt · ${fmtTime((p.naArrivalAt - Date.now()) / 1000)}`; }
}

// ------------------------------------------------------------------------------------------
// VITALWERTE-TAKT (alle 2 Sekunden)
// ------------------------------------------------------------------------------------------
setInterval(() => {
    if (!p.activeCase || p.caseFinished || p.reaHandedOver) return;
    const c = p.activeCase;
    if (p.isArrest) { reaTick(); updateUI(); return; }

    const d = c.baseDecline || {};
    const s = p.stressFactor;
    const delta = (v) => (v || 0) < 0 ? (v || 0) * s : (v || 0);

    const prevSpo2 = p.spo2;
    p.spo2 += delta(d.spo2) + ((p.o2Active || p.bvm) ? p.oxygenBoost : 0);
    p.hr += delta(d.hr);
    const rrD = delta(d.rr); p.rr_sys += rrD; p.rr_dia += rrD * 0.7;
    if (d.gcs) p.gcs = Math.max(3, Math.min(15, p.gcs + d.gcs));

    // Lagerung
    const noAirwayProtection = !(p.position === 'ssl' || p.airwayManaged || p.bvm);
    if (p.position === 'okh') { if (p.spo2 < 96) p.spo2 += 0.15; if (p.rr_sys < 90) p.rr_sys -= 0.2; }
    if (p.position === 'schocklage') {
        if (p.rr_sys < c.vitals.rr.split('/')[0] * 1 + 10) p.rr_sys += 0.25;
        if (c.vitals.stemi || c.lungSound === 'rasseln' || flag('copd')) { p.spo2 -= 0.4; p.hr += 0.3; }
    }
    if (p.gcs <= 8 && noAirwayProtection) { p.spo2 -= 0.5; warnOnce('airway_gcs', `⚠️ <span class="critical">Schnarchende Atmung – bei GCS ≤ 8 sind die Atemwege gefährdet (Seitenlage / Esmarch / Atemwegshilfe)!</span>`); }

    // Kühlung (Hitzschlag/Fieber)
    if (p.coolingActive && p.temp > 37.5) p.temp -= 0.03;

    // Deckel für die Sättigung: ohne O2 nur leichte Erholung über den Ausgangswert; nach dem
    // Absetzen von Sauerstoff sinkt sie langsam wieder in Richtung dieses Werts.
    const withO2 = p.o2Active || p.bvm || p.naOnScene;
    const baseCap = Math.min(98, c.vitals.spo2 + 4);
    const cap = (p.bvm || p.naOnScene) ? 99 : p.o2Active ? Math.max(baseCap, p.o2Cap || 99) : baseCap;
    if (p.spo2 > cap) p.spo2 = Math.max(cap, Math.min(prevSpo2, p.spo2) - (withO2 ? 0 : 0.3));

    if (p.spo2 < 90 && !p.o2Active && !p.bvm) p.hypoxiaSeconds += 2;
    if (flag('copd') && p.o2Active && !p.naOnScene && p.spo2 > 94) p.evaluation.copdOverO2 = true;

    p.rr_sys = Math.max(30, Math.min(p.rr_sys, 250));
    p.rr_dia = Math.max(20, Math.min(p.rr_dia, 150));
    p.hr = Math.max(0, Math.min(p.hr, 230));
    p.af = Math.max(0, Math.min(p.af, 60));
    if (p.spo2 < 35 || p.hr < 25) { triggerArrest(); return; }
    p.spo2 = Math.min(Math.max(p.spo2, 0), 100);

    const view = document.getElementById('patient-view');
    if (view) {
        if (p.spo2 < 90) { const i = Math.min(100, Math.max(0, (90 - p.spo2) * 3)); view.style.filter = `grayscale(${i}%) brightness(${1 + i / 500})`; }
        else view.style.filter = 'none';
    }
    updateUI();
}, 2000);

// Sekundentakt: Einsatzuhr, NA-Anfahrt, RR-Intervall, Reanimations-Zeiten
setInterval(() => {
    if (!p.activeCase || p.caseFinished) return;
    const el = document.getElementById('mission-timer');
    if (el) el.textContent = fmtTime(elapsedSec());

    if (p.naCalled && !p.naOnScene) { if (Date.now() >= p.naArrivalAt) naArrive(); else updateNaBadge(); }

    const rrNextEl = document.getElementById('rr-next');
    if (p.discovered.rr && p.rrInterval > 0 && !p.isArrest) {
        if (p.lastRRTime > 0 && Date.now() - p.lastRRTime >= p.rrInterval) {
            p.lastRRTime = Date.now(); p.displayed_rr = `${Math.round(p.rr_sys)}/${Math.round(p.rr_dia)}`;
            addToLog(`🔄 <strong>Automatische RR-Kontrolle:</strong> ${p.displayed_rr} mmHg`);
            updateUI();
        }
        if (rrNextEl) rrNextEl.textContent = `nächste in ${fmtTime((p.rrInterval - (Date.now() - p.lastRRTime)) / 1000)}`;
    } else if (rrNextEl) rrNextEl.textContent = '';

    if (p.isArrest && p.arrestStartTime) {
        document.getElementById('cpr-timer').textContent = `REA: ${fmtTime((Date.now() - p.arrestStartTime) / 1000)}`;
        const hdm = p.helperHDM || p.playerHDM;
        if (!hdm && !p.analysing) p.noFlowSeconds++;
        const rt = document.getElementById('rhythm-timer');
        if (rt) {
            if (!p.pads) { rt.style.color = '#e74c3c'; rt.textContent = '⚠️ AED-Pads kleben!'; }
            else if (p.analysing) { rt.style.color = '#f1c40f'; rt.textContent = 'AED analysiert – nicht berühren!'; }
            else if (p.lastAnalysisTime) {
                const remaining = 120 - (Date.now() - p.lastAnalysisTime) / 1000;
                rt.style.color = remaining > 0 ? '#00d2ff' : '#e74c3c';
                rt.textContent = remaining > 0 ? `Nächste AED-Analyse in: ${fmtTime(remaining)}` : '⚠️ AED-Analyse jetzt fällig!';
            } else { rt.style.color = '#f1c40f'; rt.textContent = '➡️ AED-Analyse starten'; }
        }
        if (hdm) {
            const start = p.helperHDM ? p.helperHDMStartTime : p.playerHDMStartTime;
            if (start) {
                const target = computeHdmFatigueFactor((Date.now() - start) / 1000);
                const SM = 0.12;
                p.hdmDepthQuality += (Math.max(0, Math.min(1, target + (Math.random() - 0.5) * 0.1)) - p.hdmDepthQuality) * SM;
                p.hdmReleaseQuality += (Math.max(0, Math.min(1, target + (Math.random() - 0.5) * 0.1)) - p.hdmReleaseQuality) * SM;
                renderHdmQualityUI();
            }
        }
        if ((p.rhythmChecksPerformed >= 4 || Date.now() - p.arrestStartTime > 12 * 60000) && !p.caseEndTriggered && !p.analysing) { p.caseEndTriggered = true; showCaseEndModal(); }
    }
}, 1000);

// Kompressions-Samples fürs Balkendiagramm
setInterval(() => {
    if (!p.activeCase || !p.isArrest || !(p.helperHDM || p.playerHDM)) return;
    const depth = Math.max(0, Math.min(1, p.hdmDepthQuality + (Math.random() - 0.5) * 0.15));
    const release = Math.max(0, Math.min(1, p.hdmReleaseQuality + (Math.random() - 0.5) * 0.15));
    p.hdmHistory.push({ depth, release }); if (p.hdmHistory.length > 15) p.hdmHistory.shift();
    p.hdmQualityWindow.push({ t: Date.now(), q: (depth + release) / 2 });
    while (p.hdmQualityWindow.length && p.hdmQualityWindow[0].t < Date.now() - 90000) p.hdmQualityWindow.shift();
    renderHdmQualityUI();
}, 550);

// ------------------------------------------------------------------------------------------
// REANIMATION (AED)
// ------------------------------------------------------------------------------------------
function triggerArrest(forcedRhythm) {
    if (p.isArrest || p.reaHandedOver || p.caseFinished) return;
    p.isArrest = true; p.hadArrest = true; p.hr = 0; p.spo2 = 0; p.gcs = 3; p.af = 0;
    currentPatientSound?.pause();
    if (forcedRhythm) p.rhythm = forcedRhythm;
    else {
        const roll = Math.random();
        const mech = ['hypovolaemie', 'spannungspneu', 'hypoxie', 'intoxikation'].includes(p.activeCase.revCause);
        p.rhythm = mech ? (roll < 0.5 ? 'PEA' : 'ASY') : (roll < 0.6 ? 'VF' : roll < 0.8 ? 'ASY' : 'PEA');
    }
    p.arrestStartTime = Date.now();
    addToLog(`🚨 <span class="critical">${patientWord() === 'das Kind' ? 'Das Kind' : 'Der Patient'} ist bewusstlos, atmet nicht normal – HERZ-KREISLAUF-STILLSTAND!</span>`);
    const hint = document.getElementById('rea-hint');
    if (hint) hint.textContent = isPaed()
        ? 'Kind/Säugling: 5 initiale Beatmungen, dann 15:2 · AED mit Kinder-Pads/-Modus · Notarzt nachfordern!'
        : '30:2 · Frequenz 100–120/min · Drucktiefe 5–6 cm · AED so früh wie möglich · Notarzt nachfordern!';
    document.getElementById('arrest-hud')?.classList.remove('hidden');
    document.getElementById('tab-rea')?.classList.remove('hidden');
    document.getElementById('hdm-quality-panel')?.classList.remove('hidden');
    if (!p.naCalled) warnOnce('rea_na', `💡 <span class="info">Denk an die Notarzt-Nachforderung (Start-Tab)!</span>`);
    updateDelegateVisuals(); updateUI();
}

function reaTick() {
    const hdm = p.helperHDM || p.playerHDM;
    const vent = p.helperVent || p.playerVent;
    if (hdm && vent && p.naRea && p.rhythm !== 'VF' && Math.random() < 0.012) triggerROSC();
}

function triggerROSC() {
    p.isArrest = false; p.arrestStartTime = null; p.shockAdvised = false; p.analysing = false;
    p.helperHDM = false; p.playerHDM = false; p.helperVent = false; p.playerVent = false;
    p.hr = 70 + Math.floor(Math.random() * 30); p.spo2 = 86; p.rr_sys = 95; p.rr_dia = 55; p.af = 8; p.gcs = 3;
    p.activeCase.baseDecline = { spo2: 0.3, hr: 0, rr: 0.05 };
    p.rhythm = 'SR';
    ['layer-hdm', 'layer-vent'].forEach(hideLayer);
    document.getElementById('arrest-hud')?.classList.add('hidden');
    document.getElementById('tab-rea')?.classList.add('hidden');
    document.getElementById('hdm-quality-panel')?.classList.add('hidden');
    ['rhythm-timer', 'cpr-timer'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = ''; });
    document.getElementById('btn-shock')?.classList.add('hidden');
    addToLog(`🎉 <span class="ok" style="font-size:1.05rem;">ROSC! Puls wieder tastbar.</span> Weiter beatmen, Vitalwerte überwachen.`);
    updateDelegateVisuals(); updateUI();
}

function applyPads(delegated) {
    if (!p.isArrest) return;
    if (p.pads) { addToLog('AED-Pads kleben bereits.'); return; }
    if (delegated) {
        const busy = getHelperBusyLabel();
        if (busy) { addToLog(`⚠️ <span class="warn">Helfer ist beschäftigt (${busy})!</span>`); return; }
        p.helperBusyWith = 'AED-Pads';
    }
    currentAction = REA_ACTIONS.pads; currentActionDelegated = !!delegated;
    openMaterialModal(REA_ACTIONS.pads);
}

function analyzeAED() {
    if (!p.isArrest) return;
    if (!p.pads) { addToLog(`⚠️ <span class="warn">Erst die AED-Pads kleben!</span>`); return; }
    if (p.analysing) return;
    if (p.lastAnalysisTime && (Date.now() - p.lastAnalysisTime) < 90000) {
        addToLog(`⚠️ <span class="warn">Zu frühe Analyse – jede Unterbrechung der Herzdruckmassage verschlechtert die Prognose (Zyklus 2 Minuten)!</span>`);
        p.evaluation.medErrors++;
    }
    if (p.helperHDM) stopHdmFor('helper');
    if (p.playerHDM) stopHdmFor('player');
    p.helperHDM = false; p.playerHDM = false;
    p.analysing = true; p.shockAdvised = false;
    updateDelegateVisuals(); updateUI();
    addToLog(`🔎 AED: „Analyse läuft – Patient nicht berühren!“`);
    setTimeout(() => {
        if (!p.isArrest) { p.analysing = false; return; }
        p.analysing = false; p.lastAnalysisTime = Date.now(); p.rhythmChecksPerformed++;
        markDone('aed_analyse');
        if (p.rhythm === 'VF') {
            p.shockAdvised = true;
            addToLog(`⚡ AED: <span class="warn">„Schock empfohlen! Alle weg vom Patienten!“</span>`);
        } else {
            addToLog(`AED: „Kein Schock empfohlen. Sofort mit der Herz-Lungen-Wiederbelebung beginnen.“ ➡️ <strong>HDM sofort fortsetzen!</strong>`);
        }
        updateUI();
    }, 5000);
}

function confirmShock() {
    if (!p.shockAdvised) return;
    showAnsageModal('„Achtung, Schock! Alle weg vom Patienten!“ – Schock auslösen?', () => shock());
}

function shock() {
    if (!p.isArrest || !p.shockAdvised) return;
    p.shockAdvised = false; p.shocksDelivered++;
    markDone('aed_schock');
    let rC = 0.22 + (p.naRea ? 0.12 : 0) + Math.min(0.1, p.shocksDelivered * 0.02);
    if (p.hdmQualityWindow.length >= 5) {
        const avg = p.hdmQualityWindow.reduce((s, x) => s + x.q, 0) / p.hdmQualityWindow.length;
        if (avg >= 0.75) rC += 0.05; else if (avg <= 0.4) rC -= 0.1;
    }
    const roll = Math.random();
    addToLog(`⚡ ${p.shocksDelivered}. Schock abgegeben. ➡️ <strong>Sofort HDM fortsetzen!</strong>`);
    if (roll < rC) setTimeout(() => { if (p.isArrest) triggerROSC(); }, 8000);
    else if (roll < rC + 0.3) p.rhythm = 'ASY';
    updateUI();
}

function computeHdmFatigueFactor(sec) {
    const FLOOR = 0.30, ONSET = 90, FULL = 180;
    if (sec <= ONSET) return 1.0; if (sec >= FULL) return FLOOR;
    return 1.0 - ((sec - ONSET) / (FULL - ONSET)) * (1.0 - FLOOR);
}
function renderHdmQualityUI() {
    const chart = document.getElementById('hdm-bar-chart');
    if (chart) chart.innerHTML = p.hdmHistory.map(s => `<div class="hdm-bar" style="height:${Math.round(10 + s.depth * 90)}%; background:${s.depth >= 0.6 ? 'var(--ekg-green)' : '#e74c3c'};"></div>`).join('');
    const rel = document.getElementById('hdm-release-value');
    if (rel) {
        if (p.helperHDM || p.playerHDM) { rel.textContent = Math.round(p.hdmReleaseQuality * 100) + '%'; rel.style.color = p.hdmReleaseQuality < 0.6 ? '#f1c40f' : 'var(--ekg-green)'; }
        else { rel.textContent = '--'; rel.style.color = 'var(--ekg-green)'; }
    }
}
function getHelperBusyLabel() {
    if (p.helperHDM) return 'Herzdruckmassage';
    if (p.helperVent) return 'Beatmung';
    return p.helperBusyWith || null;
}
function stopHdmFor(actor) { if (actor === 'helper') p.helperHDMStartTime = null; else p.playerHDMStartTime = null; renderHdmQualityUI(); }
function noteHdmStart() {
    if (!p.firstHdmTime && p.arrestStartTime) { p.firstHdmTime = Date.now(); p.evaluation.hdmStartDelay = (p.firstHdmTime - p.arrestStartTime) / 1000; }
}
function delegateTask(task) {
    if (!p.isArrest) return;
    if (p.analysing) { addToLog(`⚠️ <span class="warn">AED analysiert – Patient nicht berühren!</span>`); return; }
    if (task === 'hdm') {
        p.helperHDM = !p.helperHDM;
        if (p.helperHDM) { p.playerHDM = false; p.playerHDMStartTime = null; if (p.helperVent) p.helperVent = false; p.helperHDMStartTime = Date.now(); noteHdmStart(); if (p.helperBusyWith) p.helperBusyWith = null; }
        else stopHdmFor('helper');
    } else {
        p.helperVent = !p.helperVent;
        if (p.helperVent) { p.playerVent = false; p.ventilated = true; if (p.helperHDM) { p.helperHDM = false; stopHdmFor('helper'); } }
    }
    updateDelegateVisuals(); updateUI();
}
function takeTaskSelf(task) {
    if (!p.isArrest) return;
    if (p.analysing) { addToLog(`⚠️ <span class="warn">AED analysiert – Patient nicht berühren!</span>`); return; }
    if (task === 'hdm') {
        p.playerHDM = !p.playerHDM;
        if (p.playerHDM) { p.helperHDM = false; p.helperHDMStartTime = null; if (p.playerVent) p.playerVent = false; p.playerHDMStartTime = Date.now(); noteHdmStart(); }
        else stopHdmFor('player');
    } else {
        p.playerVent = !p.playerVent;
        if (p.playerVent) { p.helperVent = false; p.ventilated = true; if (p.playerHDM) { p.playerHDM = false; stopHdmFor('player'); } }
    }
    updateDelegateVisuals(); updateUI();
}
function updateDelegateVisuals() {
    document.getElementById('btn-hdm')?.classList.toggle('active-task', p.helperHDM);
    document.getElementById('btn-vent')?.classList.toggle('active-task', p.helperVent);
    document.getElementById('btn-hdm-self')?.classList.toggle('active-task', p.playerHDM);
    document.getElementById('btn-vent-self')?.classList.toggle('active-task', p.playerVent);
    document.getElementById('layer-hdm')?.classList.toggle('hidden', !(p.helperHDM || p.playerHDM));
    if (p.helperHDM || p.playerHDM) showLayer('layer-hdm');
    const vent = p.helperVent || p.playerVent;
    document.getElementById('layer-vent')?.classList.toggle('hidden', !vent);
    if (vent) showLayer('layer-vent');
    const busy = getHelperBusyLabel();
    document.querySelectorAll('.btn-delegate').forEach(b => { if (b.id === 'btn-delegate-pads') b.disabled = !!busy || p.pads; });
    const hT = document.getElementById('helper-text');
    if (hT) {
        const parts = [];
        if (p.playerHDM) parts.push('HDM: Du'); else if (p.helperHDM) parts.push('HDM: Helfer');
        if (p.playerVent) parts.push('Beatmung: Du'); else if (p.helperVent) parts.push('Beatmung: Helfer');
        hT.textContent = parts.length ? parts.join(' | ') : (p.analysing ? 'AED analysiert…' : '⚠️ Niemand drückt – Herzdruckmassage starten!');
    }
    const an = document.getElementById('btn-analyse'); if (an) an.disabled = !p.pads || p.analysing;
}
function toggleArrestHUD() { document.getElementById('arrest-hud')?.classList.toggle('hidden'); }

function showCaseEndModal() {
    const down = p.arrestStartTime ? (Date.now() - p.arrestStartTime) / 1000 : 0;
    const txt = document.getElementById('case-end-text');
    const naLine = p.naOnScene ? 'Der Notarzt ist vor Ort und übernimmt die Leitung der Reanimation (Medikamente, Atemwegssicherung, Transportentscheidung).'
        : `<span class="critical">Der Notarzt wurde ${p.naCalled ? 'zwar nachgefordert, ist aber noch nicht vor Ort' : 'NICHT nachgefordert'}!</span> Die Reanimation wird bis zum Eintreffen fortgeführt.`;
    if (txt) txt.innerHTML = `
        <p><strong>Reanimationsdauer:</strong> ${fmtTime(down)} min</p>
        <p><strong>AED-Analysen:</strong> ${p.rhythmChecksPerformed} (davon ${p.shocksDelivered} Schock/s)</p>
        <p><strong>Zeit ohne Herzdruckmassage:</strong> ${p.noFlowSeconds} s</p>
        <p>${naLine}</p>`;
    document.getElementById('case-end-modal')?.classList.remove('hidden');
}
function acknowledgeCaseEnd() {
    document.getElementById('case-end-modal')?.classList.add('hidden');
    addToLog(`🏥 <strong>Übergabe der Reanimation an den Notarzt.</strong> Weiter mit der strukturierten Übergabe (🤝 Übergabe).`);
    p.reaHandedOver = true;
    p.isArrest = false; p.helperHDM = false; p.playerHDM = false; p.helperVent = false; p.playerVent = false;
    ['layer-hdm', 'layer-vent'].forEach(hideLayer);
    document.getElementById('arrest-hud')?.classList.add('hidden');
    document.getElementById('tab-rea')?.classList.add('hidden');
    document.getElementById('hdm-quality-panel')?.classList.add('hidden');
    updateUI();
}

// ------------------------------------------------------------------------------------------
// ANZEIGE
// ------------------------------------------------------------------------------------------
function updateUI() {
    if (!p.activeCase) return;
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    const monitorHr = p.discovered.hr || p.pads;
    set('val-hr', monitorHr ? (p.isArrest ? (p.rhythm === 'VF' ? '---' : '0') : Math.round(p.hr)) : '--');
    set('val-spo2', p.discovered.spo2 ? (p.isArrest ? '--' : Math.round(p.spo2)) : '--');
    set('val-af', p.discovered.af ? (p.isArrest ? '0' : Math.round(p.af)) : '--');
    set('val-rr', p.discovered.rr ? p.displayed_rr : '--/--');
    set('val-bz', p.discovered.bz ? Math.round(p.bz) : '--');
    set('val-temp', p.discovered.temp ? p.temp.toFixed(1) : '--');
    set('val-gcs', p.discovered.gcs ? Math.round(p.gcs) : '--');

    const alarm = (id, on) => document.getElementById(id)?.parentElement?.classList.toggle('alarm', !!on);
    alarm('val-hr', monitorHr && (p.isArrest || p.hr < 40 || p.hr > 150));
    alarm('val-spo2', p.discovered.spo2 && p.spo2 < 90);
    alarm('val-af', p.discovered.af && (p.af < 8 || p.af > 30));
    alarm('val-rr', p.discovered.rr && parseInt(p.displayed_rr, 10) < 90);
    alarm('val-bz', p.discovered.bz && (p.bz < 60 || p.bz > 250));

    document.getElementById('btn-shock')?.classList.toggle('hidden', !(p.isArrest && p.shockAdvised));
    updateDelegateVisuals();

    const lips = document.getElementById('patient-lips');
    if (lips) lips.style.opacity = p.spo2 < 94 ? Math.min(1, (94 - p.spo2) / 15) : 0;
    const c = p.activeCase;
    const shocky = p.rr_sys <= 95 || p.isArrest || p.spo2 <= 80 || c.vitals.stemi;
    document.getElementById('patient-blass')?.classList.toggle('hidden', !shocky);
    if (shocky) showLayer('patient-blass');
    const sweat = c.vitals.stemi || p.bz < 60 || p.hr >= 125 || p.temp >= 39.5;
    document.getElementById('patient-schweiss')?.classList.toggle('hidden', !sweat);
    if (sweat) showLayer('patient-schweiss');

    const cAF = p.isArrest ? ((p.helperVent || p.playerVent) ? 10 : 0) : Math.max(0, p.af);
    const bAnim = cAF > 0 ? `breathe ${(60 / cAF).toFixed(2)}s ease-in-out infinite` : 'none';
    document.querySelectorAll('#patient-view img').forEach(img => { if (img.id !== 'patient-augen-zu') img.style.animation = bAnim; });
    const eye = document.getElementById('patient-augen-zu');
    if (eye) {
        if (p.isArrest || p.gcs <= 8) { showLayer('patient-augen-zu'); eye.style.opacity = '1'; eye.style.animation = bAnim; }
        else if (p.gcs >= 15) { showLayer('patient-augen-zu'); eye.style.opacity = ''; eye.style.animation = cAF > 0 ? `${bAnim}, blink-eyes 5s infinite` : 'blink-eyes 5s infinite'; }
        else { eye.classList.add('hidden'); }
    }
}

// ------------------------------------------------------------------------------------------
// ÜBERGABE (Zielklinik + SINNHAFT)
// ------------------------------------------------------------------------------------------
function renderHandover() {
    const content = document.getElementById('tab-content');
    if (!content) return;
    const c = p.activeCase;
    const dxList = (RS_DIAGNOSES[p.activeCategory] || []).slice().sort((a, b) => a.localeCompare(b, 'de'));
    const row = (l, v, known) => `<div class="handover-row"><span style="color:#aaa;">${l}</span><strong style="color:${known ? '#fff' : '#666'};">${known ? v : 'nicht erhoben'}</strong></div>`;
    content.innerHTML = `
        <div class="handover-card">
            <h2>🤝 Einsatzübergabe</h2>
            <div class="handover-grid">
                <div class="handover-box span-2"><div class="hb-title">Leitstelle / Lage</div><div>${escHtml(c.dispatch)}</div></div>
                <div class="handover-box" style="border-left-color:#f39c12;"><div class="hb-title">Anamnese (SAMPLER)</div>
                    <div style="color:#ddd;">${done('SAMPLER') ? Object.keys(p.samplerCaptured).length + ' von 7 SAMPLER-Punkten erfragt' : '<span class="critical">⚠️ Nicht erhoben!</span>'}</div></div>
                <div class="handover-box" style="border-left-color:#2ecc71;"><div class="hb-title">Aktueller Status</div>
                    ${row('Herzfrequenz', Math.round(p.hr) + '/min', p.discovered.hr)}
                    ${row('SpO₂', Math.round(p.spo2) + ' %', p.discovered.spo2)}
                    ${row('Blutdruck', p.displayed_rr + ' mmHg', p.discovered.rr)}
                    ${row('GCS', Math.round(p.gcs), p.discovered.gcs)}</div>
            </div>
            <div class="handover-select-block">
                <label style="color: var(--accent);">VERDACHTSDIAGNOSE</label>
                <select id="final-diagnosis" style="border: 2px solid var(--accent);">
                    <option value="">-- Bitte Verdachtsdiagnose wählen --</option>
                    ${dxList.map(d => `<option value="${escHtml(d)}">${escHtml(d)}</option>`).join('')}
                </select>
                <label style="color: #2ecc71;">ZIELKLINIK / FACHABTEILUNG</label>
                <select id="final-department" style="border: 2px solid #2ecc71;">
                    <option value="">-- Bitte Fachabteilung wählen --</option>
                    ${RS_DEPARTMENTS.map(d => `<option value="${escHtml(d)}">${escHtml(d)}</option>`).join('')}
                </select>
                <button class="handover-go" onclick="startSinnhaftHandover()">📋 Patient übergeben & Auswertung</button>
            </div>
        </div>`;
}

const SINNHAFT_STEP_IDS = ['S', 'I', 'N_EVENT', 'N_PRIO', 'H', 'A', 'F', 'T'];
const SAMPLER_LETTERS = ['S', 'A', 'M', 'P', 'L', 'E', 'R'];
const SAMPLER_LABELS = { S: 'S – Symptome', A: 'A – Allergien', M: 'M – Medikamente', P: 'P – Vorerkrankungen', L: 'L – Letzte Mahlzeit/Flüssigkeit', E: 'E – Ereignis', R: 'R – Risikofaktoren' };

function startSinnhaftHandover() {
    const diagSelect = document.getElementById('final-diagnosis');
    const deptSelect = document.getElementById('final-department');
    if (!diagSelect || !diagSelect.value) return alert('Bitte stelle eine Verdachtsdiagnose!');
    if (!deptSelect || !deptSelect.value) return alert('Bitte wähle eine Zielklinik aus!');
    if (p.isArrest) return alert('Der Patient wird noch reanimiert – eine Übergabe ist erst nach ROSC oder Übernahme durch den Notarzt möglich.');
    p.evaluation.selectedDiagnosis = diagSelect.value;
    p.evaluation.selectedDepartment = deptSelect.value;
    p.sinnhaft = { stepIndex: 0, answers: {} };
    document.getElementById('sinnhaft-modal')?.classList.remove('hidden');
    renderSinnhaftStep();
}
function renderSinnhaftStep() {
    const stepId = SINNHAFT_STEP_IDS[p.sinnhaft.stepIndex];
    const body = document.getElementById('sinnhaft-body');
    const prog = document.getElementById('sinnhaft-progress');
    if (!body) return;
    if (prog) prog.textContent = `Schritt ${p.sinnhaft.stepIndex + 1} / ${SINNHAFT_STEP_IDS.length}`;
    ({ S: renderSinnhaftS, I: renderSinnhaftI, N_EVENT: renderSinnhaftNEvent, N_PRIO: renderSinnhaftNPrio, H: renderSinnhaftH, A: renderSinnhaftA, F: renderSinnhaftF, T: renderSinnhaftT })[stepId](body);
}
function advanceSinnhaftStep() {
    if (p.sinnhaft.stepIndex < SINNHAFT_STEP_IDS.length - 1) { p.sinnhaft.stepIndex++; renderSinnhaftStep(); }
    else { document.getElementById('sinnhaft-modal')?.classList.add('hidden'); finishMission(); }
}
function cancelSinnhaftHandover() {
    const btn = document.getElementById('sinnhaft-cancel-btn');
    if (btn && !btn.dataset.confirming) {
        btn.dataset.confirming = '1'; btn.textContent = 'Wirklich? Fortschritt geht verloren'; btn.style.color = '#e74c3c';
        setTimeout(() => { if (btn.dataset.confirming) { delete btn.dataset.confirming; btn.textContent = '✕ Abbrechen'; btn.style.color = ''; } }, 4000);
        return;
    }
    if (btn) { delete btn.dataset.confirming; btn.textContent = '✕ Abbrechen'; btn.style.color = ''; }
    document.getElementById('sinnhaft-modal')?.classList.add('hidden');
    p.sinnhaft = null;
}
const continueBtn = (enabled) => `<button class="confirm-btn" id="sinnhaft-continue" onclick="advanceSinnhaftStep()" ${enabled ? '' : 'disabled'}>Weiter</button>`;
function mcBlock(stepKey, subKey, label, options, correct, fmt = x => x, correctLabel) {
    return `
        <div class="sinnhaft-q">${label}</div>
        <div id="sinnhaft-options-${subKey}">
            ${options.map(v => `<label class="m-check-label"><input type="radio" name="sinnhaft-${subKey}" value="${escHtml(v)}" onchange="answerSinnhaftMC('${stepKey}', '${subKey}', this.value, '${escJs(correct)}', '${escJs(correctLabel || fmt(correct))}')"> ${escHtml(fmt(v))}</label>`).join('')}
        </div>
        <div id="sinnhaft-feedback-${subKey}" class="sinnhaft-fb"></div>`;
}
function renderSinnhaftS(body) {
    body.innerHTML = `<p class="modal-hint">Ruhe bewahren, Face-to-Face-Kommunikation mit dem übernehmenden Team – während der Übergabe finden keine weiteren Tätigkeiten am Patienten statt.</p>
        <div class="sinnhaft-info"><strong>S – Situation schaffen</strong><br>Du stellst dich vor und sicherst dir die volle Aufmerksamkeit des Übernahmeteams.</div>${continueBtn(true)}`;
}
function renderSinnhaftI(body) {
    const c = p.activeCase;
    p.sinnhaft.stepRequiredKeys = ['age'];
    const correct = ageLabel(c);
    const pool = getAllCases().filter(x => x.id !== c.id && (x.ageUnit || 'J') === (c.ageUnit || 'J')).map(ageLabel).filter(a => a !== correct);
    const options = shuffleCopy([correct, ...pickDistractors(pool, 3, (a, b) => a === b)]);
    body.innerHTML = `<p class="modal-hint"><strong>I – Identifikation:</strong> Wie alt ist ${isPaed() ? 'das Kind' : 'dein Patient'}?</p>${mcBlock('I', 'age', 'Alter:', options, correct)}${continueBtn(false)}`;
}
function renderSinnhaftNEvent(body) {
    const c = p.activeCase;
    p.sinnhaft.stepRequiredKeys = ['diagnosis', 'env'];
    const dxPool = getAllCases().filter(x => x.category !== p.activeCategory && x.diagnosis !== c.diagnosis).map(x => x.diagnosis);
    const dxOptions = shuffleCopy([c.diagnosis, ...pickDistractors(dxPool, 3, (a, b) => a === b)]);
    const envOptions = shuffleCopy([c.env, ...pickDistractors(SINNHAFT_ENV_VALUES.filter(v => v !== c.env), 3, (a, b) => a === b)]);
    body.innerHTML = `<p class="modal-hint"><strong>N – Notfallereignis:</strong> Was ist passiert, und wo?</p>
        ${mcBlock('N_EVENT', 'diagnosis', 'Verdachtsdiagnose:', dxOptions, c.diagnosis)}
        ${mcBlock('N_EVENT', 'env', 'Einsatzort:', envOptions, c.env, v => SINNHAFT_ENV_LABELS[v] || v)}
        ${continueBtn(false)}`;
}
function renderSinnhaftNPrio(body) {
    const c = p.activeCase;
    const cand = [
        { key: 'hr', label: 'Herzfrequenz', unit: '/min', known: p.discovered.hr, val: Math.round(p.hr), pool: x => Math.round(x.vitals.hr) },
        { key: 'spo2', label: 'SpO₂', unit: ' %', known: p.discovered.spo2, val: Math.round(p.spo2), pool: x => Math.round(x.vitals.spo2) },
        { key: 'gcs', label: 'GCS', unit: '', known: p.discovered.gcs, val: Math.round(p.gcs), pool: x => x.vitals.gcs }
    ].filter(v => v.known);
    p.sinnhaft.stepRequiredKeys = cand.map(v => v.key);
    if (!cand.length) { body.innerHTML = `<p class="modal-hint"><strong>N – Notfallpriorität:</strong> Es wurden keine Vitalwerte erhoben – diese Frage entfällt.</p>${continueBtn(true)}`; return; }
    const all = getAllCases().filter(x => x.id !== c.id);
    body.innerHTML = `<p class="modal-hint"><strong>N – Notfallpriorität:</strong> Wie ist der aktuelle Zustand?</p>` + cand.map(v => {
        const correct = String(v.val);
        const pool = all.map(x => String(v.pool(x))).filter(x => x !== correct);
        const options = shuffleCopy([correct, ...pickDistractors(pool, 3, (a, b) => a === b)]);
        return mcBlock('N_PRIO', v.key, v.label + ':', options, correct, x => x + v.unit);
    }).join('') + continueBtn(false);
}
// H – Handlungen: RS-Maßnahmen statt Medikamente
function renderSinnhaftH(body) {
    const therapyTokens = [];
    Object.values(ACTIONS).flat().forEach(a => { if (a.therapy && !therapyTokens.includes(a.token)) therapyTokens.push(a.token); });
    const doneTherapy = therapyTokens.filter(t => done(t === 'o2_modal' ? 'o2_applied' : t));
    const capped = shuffleCopy(doneTherapy).slice(0, 2);
    p.sinnhaft.stepRequiredKeys = capped.map((_, i) => `m${i}`);
    if (!capped.length) { body.innerHTML = `<p class="modal-hint"><strong>H – Handlungen:</strong> Es wurden keine Maßnahmen durchgeführt – diese Frage entfällt.</p>${continueBtn(true)}`; return; }
    const notDone = therapyTokens.filter(t => !doneTherapy.includes(t)).map(actionLabel);
    const used = new Set();
    body.innerHTML = `<p class="modal-hint"><strong>H – Handlungen:</strong> Welche Maßnahme hast du durchgeführt?</p>` + capped.map((t, i) => {
        const correct = actionLabel(t);
        const distr = pickDistractors(notDone.filter(x => !used.has(x)), 3, (a, b) => a === b);
        distr.forEach(x => used.add(x));
        return mcBlock('H', `m${i}`, `Maßnahme ${i + 1}:`, shuffleCopy([correct, ...distr]), correct);
    }).join('') + continueBtn(false);
}
function renderSinnhaftA(body) {
    const known = done('SAMPLER');
    const letters = known ? SAMPLER_LETTERS.filter(l => p.samplerCaptured[l] && p.samplerCaptured[l] !== '-') : [];
    const chosen = shuffleCopy(letters).slice(0, 2);
    if (!chosen.length) {
        p.sinnhaft.stepRequiredKeys = [];
        body.innerHTML = `<p class="modal-hint"><strong>A – Anamnese:</strong> ${known ? 'Es wurden keine verwertbaren SAMPLER-Angaben erhoben' : 'SAMPLER wurde nicht erhoben'} – diese Frage entfällt.</p>${continueBtn(true)}`;
        return;
    }
    p.sinnhaft.stepRequiredKeys = chosen;
    const others = getAllCases().filter(x => x.id !== p.activeCase.id);
    body.innerHTML = `<p class="modal-hint"><strong>A – Anamnese:</strong> Was wurde bei der SAMPLER-Anamnese berichtet?</p>` + chosen.map(l => {
        const correct = p.samplerCaptured[l];
        const pool = others.map(x => x.sampler && x.sampler[l]).filter(t => t && t !== '-' && t !== correct);
        return mcBlock('A', l, SAMPLER_LABELS[l] + ':', shuffleCopy([correct, ...pickDistractors(pool, 3, (a, b) => a === b)]), correct);
    }).join('') + continueBtn(false);
}
function sinnhaftFactLabel(stepKey, subKey) {
    if (stepKey === 'I') return 'Alter';
    if (stepKey === 'N_EVENT') return subKey === 'diagnosis' ? 'Verdachtsdiagnose' : 'Einsatzort';
    if (stepKey === 'N_PRIO') return { hr: 'Herzfrequenz', spo2: 'SpO₂', gcs: 'GCS' }[subKey] || subKey;
    if (stepKey === 'H') return `Maßnahme ${parseInt(subKey.slice(1), 10) + 1}`;
    if (stepKey === 'A') return SAMPLER_LABELS[subKey] || subKey;
    return subKey;
}
function sinnhaftFactDisplay(stepKey, subKey, raw) {
    if (stepKey === 'N_EVENT' && subKey === 'env') return SINNHAFT_ENV_LABELS[raw] || raw;
    if (stepKey === 'N_PRIO' && subKey === 'hr') return `${raw}/min`;
    if (stepKey === 'N_PRIO' && subKey === 'spo2') return `${raw} %`;
    return raw;
}
function renderSinnhaftF(body) {
    if (!p.sinnhaft.fCheck) {
        const facts = [];
        ['I', 'N_EVENT', 'N_PRIO', 'H', 'A'].forEach(stepKey => {
            const ans = p.sinnhaft.answers[stepKey]; if (!ans) return;
            Object.keys(ans).forEach(subKey => facts.push({ stepKey, subKey, label: sinnhaftFactLabel(stepKey, subKey), correct: ans[subKey].correct }));
        });
        const display = facts.map(f => sinnhaftFactDisplay(f.stepKey, f.subKey, f.correct));
        let hasError = facts.length > 0 && Math.random() < 0.35, corruptedIndex = -1;
        if (hasError) {
            const i = Math.floor(Math.random() * facts.length);
            const f = facts[i];
            const optsEl = document.getElementById(`sinnhaft-options-${f.subKey}`);
            // Distraktor: eine andere, plausible Antwort aus derselben Kategorie
            const alt = getAllCases().filter(x => x.id !== p.activeCase.id);
            let wrong = null;
            if (f.stepKey === 'I') wrong = pickDistractors(alt.map(ageLabel).filter(a => a !== f.correct), 1, (a, b) => a === b)[0];
            else if (f.stepKey === 'N_EVENT' && f.subKey === 'diagnosis') wrong = pickDistractors(alt.map(x => x.diagnosis).filter(d => d !== f.correct), 1, (a, b) => a === b)[0];
            else if (f.stepKey === 'N_EVENT') wrong = pickDistractors(SINNHAFT_ENV_VALUES.filter(v => v !== f.correct), 1, (a, b) => a === b)[0];
            else if (f.stepKey === 'N_PRIO') wrong = String(parseInt(f.correct, 10) + (Math.random() < 0.5 ? -12 : 12));
            else if (f.stepKey === 'A') wrong = pickDistractors(alt.map(x => x.sampler && x.sampler[f.subKey]).filter(t => t && t !== '-' && t !== f.correct), 1, (a, b) => a === b)[0];
            else if (f.stepKey === 'H') wrong = pickDistractors(Object.values(ACTIONS).flat().filter(a => a.therapy).map(a => actionLabel(a.token)).filter(l => l !== f.correct), 1, (a, b) => a === b)[0];
            if (wrong) { corruptedIndex = i; display[i] = sinnhaftFactDisplay(f.stepKey, f.subKey, wrong); } else hasError = false;
            void optsEl;
        }
        p.sinnhaft.fCheck = { facts, display, hasError, corruptedIndex, stage: facts.length ? 'confirm' : 'done', isCorrect: facts.length ? null : true };
        p.sinnhaft.answers.F = {};
    }
    p.sinnhaft.stepRequiredKeys = ['fcheck'];
    renderSinnhaftFBody(body);
}
function renderSinnhaftFBody(body) {
    const fc = p.sinnhaft.fCheck;
    const list = (clickable) => fc.facts.map((f, i) => `<div class="m-check-label" ${clickable ? `onclick="answerSinnhaftFPick(${i})"` : ''}><strong>${escHtml(f.label)}:</strong> ${escHtml(String(fc.display[i]))}</div>`).join('');
    if (fc.stage === 'confirm') {
        body.innerHTML = `<p class="modal-hint"><strong>F – Fazit:</strong> Das Übernahmeteam liest die Übergabe zurück. Stimmt das?</p>${list(false)}
            <div class="tool-row" style="margin-top:15px;"><button class="confirm-btn" style="margin-top:0;" onclick="answerSinnhaftFConfirm(true)">✅ Ja, stimmt</button><button class="confirm-btn" style="margin-top:0; background:#e74c3c;" onclick="answerSinnhaftFConfirm(false)">❌ Nein, Fehler</button></div>`;
        return;
    }
    if (fc.stage === 'pick') { body.innerHTML = `<p class="modal-hint"><strong>F – Fazit:</strong> Welche Angabe war falsch? Klicke sie an.</p>${list(true)}`; return; }
    let line;
    if (!fc.facts.length) line = 'Keine Fakten zum Zurücklesen.';
    else if (!fc.hasError) line = fc.isCorrect ? '✅ <span class="ok">Richtig – die Zusammenfassung war korrekt.</span>' : '❌ <span class="critical">Die Zusammenfassung war korrekt – hier war kein Fehler.</span>';
    else {
        const f = fc.facts[fc.corruptedIndex];
        const truth = `${escHtml(f.label)}: ${escHtml(String(sinnhaftFactDisplay(f.stepKey, f.subKey, f.correct)))}`;
        line = fc.isCorrect ? `✅ <span class="ok">Richtig erkannt! Korrekt ist: ${truth}</span>` : `❌ <span class="critical">Nicht erkannt. Korrekt ist: ${truth}</span>`;
    }
    p.sinnhaft.answers.F.fcheck = { selected: fc.isCorrect ? 'richtig' : 'falsch', correct: 'richtig', isCorrect: !!fc.isCorrect };
    body.innerHTML = `<p class="modal-hint"><strong>F – Fazit:</strong> Das Übernahmeteam liest die Übergabe zurück.</p>${list(false)}<div style="margin:12px 0; font-weight:600;">${line}</div>${continueBtn(true)}`;
}
function answerSinnhaftFConfirm(saidCorrect) {
    const fc = p.sinnhaft.fCheck;
    if (!fc.hasError) { fc.isCorrect = saidCorrect; fc.stage = 'done'; }
    else if (saidCorrect) { fc.isCorrect = false; fc.stage = 'done'; }
    else fc.stage = 'pick';
    renderSinnhaftFBody(document.getElementById('sinnhaft-body'));
}
function answerSinnhaftFPick(i) { const fc = p.sinnhaft.fCheck; fc.isCorrect = i === fc.corruptedIndex; fc.stage = 'done'; renderSinnhaftFBody(document.getElementById('sinnhaft-body')); }
function answerSinnhaftMC(stepKey, subKey, selected, correct, correctLabel) {
    const isCorrect = selected === correct;
    if (!p.sinnhaft.answers[stepKey]) p.sinnhaft.answers[stepKey] = {};
    p.sinnhaft.answers[stepKey][subKey] = { selected, correct, isCorrect };
    const fb = document.getElementById(`sinnhaft-feedback-${subKey}`);
    if (fb) fb.innerHTML = isCorrect ? '✅ <span class="ok">Richtig.</span>' : `❌ <span class="critical">Nicht korrekt – richtig wäre: ${escHtml(correctLabel || correct)}</span>`;
    const given = p.sinnhaft.answers[stepKey];
    const all = (p.sinnhaft.stepRequiredKeys || [subKey]).every(k => given[k]);
    const btn = document.getElementById('sinnhaft-continue'); if (btn) btn.disabled = !all;
}
function renderSinnhaftT(body) {
    const c = p.activeCase;
    p.sinnhaft.stepRequiredKeys = ['safety', 'support'];
    const others = getAllCases().filter(x => x.id !== c.id);
    body.innerHTML = `<p class="modal-hint"><strong>T – Teamfragen:</strong> Kurze Rückfragen vom Übernahmeteam.</p>` +
        [{ key: 'safety', label: 'Sicherheitslage am Einsatzort:' }, { key: 'support', label: 'Nachforderung / Unterstützung:' }].map(f => {
            const correct = c.fourS[f.key];
            const pool = others.map(x => x.fourS[f.key]).filter(t => t && t !== correct);
            return mcBlock('T', f.key, f.label, shuffleCopy([correct, ...pickDistractors(pool, 3, (a, b) => a === b)]), correct);
        }).join('') + continueBtn(false);
}
function buildSinnhaftSummaryHtml() {
    if (!p.sinnhaft || !p.sinnhaft.answers) return '<p style="margin:4px 0;">Keine SINNHAFT-Daten verfügbar.</p>';
    let ok = 0, total = 0;
    Object.values(p.sinnhaft.answers).forEach(step => Object.values(step).forEach(e => { if (e && typeof e.isCorrect === 'boolean') { total++; if (e.isCorrect) ok++; } }));
    const fc = p.sinnhaft.fCheck;
    const fS = !fc || !fc.facts.length ? 'Fazit-Check (F): keine Daten.' : !fc.hasError ? 'Fazit-Check (F): kein Fehler vorhanden.' : fc.isCorrect ? 'Fazit-Check (F): Fehler in der Rückmeldung erkannt.' : 'Fazit-Check (F): Fehler in der Rückmeldung übersehen.';
    p.evaluation.sinnhaftScore = total ? Math.round(ok / total * 100) : null;
    return `<p style="margin:4px 0;"><strong>${ok}/${total} SINNHAFT-Fragen korrekt beantwortet.</strong></p><p style="margin:4px 0;">${fS}</p>`;
}

// ------------------------------------------------------------------------------------------
// BEWERTUNG
// ------------------------------------------------------------------------------------------
const SCORE_EVENT_LETTER_LABELS = { X: 'X', A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', SZENE: 'Szene', uebergreifend: 'Allgemein' };
const SCORE_EVENT_LETTER_ORDER = ['X', 'A', 'B', 'C', 'D', 'E', 'SZENE', 'uebergreifend'];
const XABCDE_CATEGORY_NAMES = { X: 'Blutungskontrolle', A: 'Atemweg', B: 'Atmung', C: 'Kreislauf', D: 'Neurologie', E: 'Exposure/Anamnese' };

function reqFulfilled(r) { return r.tokens.some(t => t === 'o2_modal' ? (done('o2_applied') || p.bvm) : done(t)); }

function buildScoreEvents() {
    const c = p.activeCase;
    const events = [];
    const push = (text, weight, letter, critical = false) => events.push({ text, weight, letter, critical });
    const disc = p.discovered;
    const wasUnconscious = c.vitals.gcs <= 8 || p.hadArrest;

    // X
    if (!done('X-Check') && !(p.hadArrest && !isTrauma())) push('Kritische Blutungen nicht gesucht (X-Check).', flag('criticalBleeding') ? 30 : 20, 'X');
    if (flag('criticalBleeding') && !p.evaluation.bleedingControlDone) push('Kritische Blutung nicht (korrekt) gestillt!', 70, 'X', true);
    if (p.evaluation.impaledRemoved) push('Fremdkörper entfernt – Blutung dadurch freigesetzt!', 60, 'X', true);

    // A
    if (!flag('noMouthCheck') && !done('mundraum')) push('Mundraum nicht inspiziert.', 30, 'A');
    if (c.mouthState === 'fluid' && !p.mouthCleared) push('Verlegter Atemweg (Sekret/Erbrochenes) nicht abgesaugt!', 60, 'A', true);
    if (wasUnconscious && !p.hadArrest && !(done('ssl') || done('esmarch') || done('guedel') || done('wendel') || done('bvm'))) push('Atemweg des bewusstlosen Patienten nicht gesichert (Seitenlage/Esmarch/Atemwegshilfe).', 40, 'A', true);

    // B
    if (!disc.af && !p.hadArrest) push('Atemfrequenz nicht gezählt.', 30, 'B');
    if (!disc.spo2 && !p.hadArrest) push('SpO₂ nicht gemessen.', 30, 'B');
    if (!done('Lunge') && !p.hadArrest) push('Lunge nicht auskultiert.', 15, 'B');
    if (p.hypoxiaSeconds >= 60 && !done('o2_applied') && !p.bvm) push('Hypoxie (SpO₂ < 90 %) ohne Sauerstoffgabe!', 50, 'B', true);
    if (p.evaluation.copdOverO2) push('COPD: Sauerstoff nicht titriert (SpO₂ > 94 %, Ziel 88–92 %).', 15, 'B');

    // C
    if (!disc.hr && !p.hadArrest) push('Puls/Herzfrequenz nicht erhoben.', 30, 'C');
    if (!disc.rr && !p.hadArrest) push('Blutdruck nicht gemessen.', 30, 'C');
    if (c.vitals.stemi && p.evaluation.ekgTime && (p.evaluation.ekgTime - p.evaluation.startTime) > 10 * 60000) push('12-Kanal-EKG bei V.a. Herzinfarkt zu spät (> 10 min).', 20, 'C');

    // D
    if (!disc.gcs && !p.hadArrest) push('GCS nicht erhoben.', 30, 'D');
    const bzImportant = c.vitals.gcs < 15 || p.activeCategory !== 'trauma' || flag('hypo');
    if (!disc.bz) push('Blutzucker nicht gemessen.', p.hadArrest ? 10 : (bzImportant ? 30 : 10), 'D');

    // E
    if (!disc.temp && !p.hadArrest) push('Temperatur nicht gemessen.', 10, 'E');
    if (!done('SAMPLER') && !p.hadArrest) push('SAMPLER-Anamnese nicht erhoben.', 40, 'E');
    if (isTrauma() && !done('bodycheck') && !p.hadArrest) push('Kein Bodycheck beim Traumapatienten.', 30, 'E');

    // Szene / Organisation
    if (!done('4s_check')) push('4S-Erkundung (Sicherheit, Szene, Sichtung, Support) nicht durchgeführt.', 15, 'SZENE');
    if (c.naRequired && !p.naCalled) push('Notarzt-Indikation nicht erkannt – kein Notarzt nachgefordert!', 40, 'uebergreifend', true);
    else if (c.naRequired && p.naCallTime && (p.naCallTime - p.evaluation.startTime) > 5 * 60000) push('Notarzt zu spät nachgefordert (> 5 min).', 15, 'uebergreifend');
    if (p.evaluation.rtwWithOpenBleeding) push('In den RTW verlegt, obwohl die kritische Blutung noch nicht versorgt war.', 30, 'SZENE');

    // Reanimation
    if (p.hadArrest) {
        if (p.evaluation.hdmStartDelay === null || p.evaluation.hdmStartDelay === undefined) push('Reanimation: Herzdruckmassage nie begonnen!', 80, 'C', true);
        else if (p.evaluation.hdmStartDelay > 30) push(`Reanimation: Herzdruckmassage erst nach ${Math.round(p.evaluation.hdmStartDelay)} s begonnen.`, 25, 'C');
        if (!p.pads) push('Reanimation: AED-Pads nicht geklebt.', 40, 'C', true);
        else if (!done('aed_analyse')) push('Reanimation: keine AED-Analyse durchgeführt.', 30, 'C');
        if (p.noFlowSeconds > 60) push(`Reanimation: zu lange Pausen ohne Herzdruckmassage (${p.noFlowSeconds} s).`, 20, 'C');
        if (!p.ventilated) push('Reanimation: keine Beatmung.', 30, 'B', true);
    }

    // Verdachtsdiagnose & Zielklinik (Übergabe)
    if (p.evaluation.selectedDiagnosis && !isDiagnosisCorrect()) push(`Verdachtsdiagnose „${p.evaluation.selectedDiagnosis}“ – richtig wäre: ${c.diagnosis}`, 15, 'uebergreifend', true);
    if (p.evaluation.selectedDepartment && !isDepartmentCorrect()) push(`Zielklinik „${p.evaluation.selectedDepartment}“ – passend wäre: ${c.department}`, 10, 'SZENE');

    // Fallentscheidende RS-Maßnahmen
    (c.requiredActions || []).forEach(r => { if (!reqFulfilled(r)) push(`${r.text} – nicht durchgeführt.`, r.weight, r.letter, r.critical); });
    (c.contraActions || []).forEach(r => { if (p.evaluation.contraDone.includes(r.token)) push(`Kontraindiziert: ${r.text}`, r.weight, 'uebergreifend', true); });

    // Kunstfehler & Handhabungsfehler
    const errs = [...new Set(p.evaluation.errorDetails || [])];
    if (errs.length) push(`${errs.length} kritische(r) Behandlungsfehler (siehe unten).`, Math.min(40, errs.length * 10), 'uebergreifend');
    if (p.evaluation.medErrors > 0) push(`${p.evaluation.medErrors}x Fehler bei Durchführung/Indikation von Maßnahmen.`, Math.min(30, p.evaluation.medErrors * 5), 'uebergreifend');
    return events;
}

function finishMission() {
    p.caseFinished = true;
    const events = buildScoreEvents();
    p.evaluation.scoreEvents = events;
    const sum = (l) => events.filter(e => e.letter === l).reduce((s, e) => s + e.weight, 0);
    const common = sum('uebergreifend') + sum('SZENE');
    const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
    p.evaluation.scoreX = clamp(100 - sum('X'));
    ['A', 'B', 'C', 'D', 'E'].forEach(l => { p.evaluation['score' + l] = clamp(100 - sum(l) - common); });
    const ev = p.evaluation;
    ev.overallScore = Math.round((ev.scoreX + ev.scoreA + ev.scoreB + ev.scoreC + ev.scoreD + ev.scoreE) / 6);

    const prev = parseInt(storageGet('mediciq_rs_streak') || '0', 10) || 0;
    ev.streak = ev.overallScore >= 90 ? prev + 1 : 0;
    storageSet('mediciq_rs_streak', String(ev.streak));

    stopAllSounds();
    showEvaluation();

    const fehlerLog = events.map(e => e.text);
    setTimeout(() => {
        try {
            window.parent.postMessage({
                typ: 'RS_SIMULATOR_ERGEBNIS',
                ergebnisse: {
                    x: ev.scoreX, a: ev.scoreA, b: ev.scoreB, c: ev.scoreC, d: ev.scoreD, e: ev.scoreE,
                    gesamt: ev.overallScore,
                    fallId: p.activeCase.id, kategorie: p.activeCategory, diagnose: p.activeCase.diagnosis,
                    dauerSekunden: Math.round(elapsedSec()),
                    fehlerLog: fehlerLog.length ? fehlerLog : ['Keine Fehler im Protokoll verzeichnet.']
                }
            }, '*');
        } catch (e) { console.error('Ergebnis konnte nicht gesendet werden:', e); }
    }, 1000);
}

function isDiagnosisCorrect() {
    const c = p.activeCase, sel = p.evaluation.selectedDiagnosis;
    return sel === c.diagnosis || (c.diagnosisAlt || []).includes(sel);
}
function isDepartmentCorrect() {
    const c = p.activeCase, sel = p.evaluation.selectedDepartment;
    return sel === c.department || (c.departmentAlt || []).includes(sel);
}
function getWeakestCategory() {
    let best = null;
    Object.keys(XABCDE_CATEGORY_NAMES).forEach(l => { const v = p.evaluation['score' + l]; if (typeof v === 'number' && (!best || v < best.value)) best = { letter: l, name: XABCDE_CATEGORY_NAMES[l], value: v }; });
    return best && best.value < 100 ? best : null;
}

function showEvaluation() {
    const c = p.activeCase, ev = p.evaluation;
    const positives = [];
    if (isDiagnosisCorrect()) positives.push(`✅ <strong class="ok">Verdachtsdiagnose korrekt:</strong> ${escHtml(ev.selectedDiagnosis)}`);
    if (isDepartmentCorrect()) positives.push(`✅ <strong class="ok">Zielklinik passend:</strong> ${escHtml(ev.selectedDepartment)}`);
    if (c.naRequired && p.naCalled) positives.push('✅ Notarzt-Indikation erkannt und nachgefordert.');
    if (!c.naRequired && !p.naCalled) positives.push('✅ Richtig eingeschätzt: kein Notarzt erforderlich.');
    if (!c.naRequired && p.naCalled) positives.push('ℹ️ Notarzt nachgefordert, obwohl hier keine zwingende Indikation bestand (vertretbar, bindet aber Ressourcen).');
    (c.requiredActions || []).forEach(r => { if (reqFulfilled(r)) positives.push(`✅ ${escHtml(r.text)}`); });

    const grouped = [];
    const all = ev.scoreEvents || [];
    SCORE_EVENT_LETTER_ORDER.forEach(l => { const g = all.filter(e => e.letter === l); grouped.push(...g.filter(e => e.critical), ...g.filter(e => !e.critical)); });

    const errs = [...new Set(ev.errorDetails || [])];
    let errorHtml;
    if (errs.length) errorHtml = `<div class="eval-block" style="padding:14px; background:rgba(231,76,60,0.15); border-left:4px solid #e74c3c; border-radius:5px;">
        <h4 style="color:#e74c3c; margin:0 0 8px;">⚠️ Deine kritischen Fehler:</h4><ul style="margin:0; padding-left:20px; line-height:1.4;">${errs.map(e => `<li style="margin-bottom:6px;">${escHtml(e)}</li>`).join('')}</ul></div>`;
    else if (ev.overallScore >= 90) errorHtml = `<div class="eval-block" style="padding:14px; background:rgba(46,204,113,0.15); border-left:4px solid #2ecc71; border-radius:5px;">
        <h4 style="color:#2ecc71; margin:0 0 5px;">🌟 Starke Arbeit!</h4><p style="margin:0;">Du hast den Einsatz ohne Behandlungsfehler gemeistert.</p>${ev.streak > 1 ? `<p class="ok" style="margin:8px 0 0;">🔥 ${ev.streak}. sehr guter Einsatz in Folge!</p>` : ''}</div>`;
    else errorHtml = `<div class="eval-block" style="padding:14px; background:rgba(243,156,18,0.15); border-left:4px solid #f39c12; border-radius:5px;">
        <h4 style="color:#f39c12; margin:0 0 5px;">⚠️ Lücken in der Versorgung</h4><p style="margin:0;">Keine aktive Gefährdung, aber wichtige Schritte fehlen (siehe Liste).</p></div>`;

    const score = ev.overallScore;
    const note = score >= 90 ? 'Sehr gut' : score >= 75 ? 'Gut' : score >= 50 ? 'Ausreichend' : 'Nicht bestanden';
    const weakest = getWeakestCategory();
    const worst = grouped.slice().sort((a, b) => (b.critical - a.critical) || (b.weight - a.weight))[0];

    document.getElementById('eval-list').innerHTML = `
        <div class="score-circle">${score}%</div>
        <p style="font-size:1.25rem; color:var(--accent); font-weight:bold; margin:0 0 12px; text-align:center;">Note: ${note}</p>
        <div class="abcde-bars">${['X', 'A', 'B', 'C', 'D', 'E'].map(l => `<div class="abcde-bar">${l}<strong style="color:${ev['score' + l] >= 75 ? '#2ecc71' : ev['score' + l] >= 50 ? '#f39c12' : '#e74c3c'};">${ev['score' + l]}%</strong></div>`).join('')}</div>
        <div class="eval-block" style="padding:14px; background:rgba(0,180,216,0.08); border-left:4px solid var(--accent); border-radius:8px;">
            <h4 style="margin:0 0 8px; color:var(--accent);">🤝 SINNHAFT-Übergabe</h4>${buildSinnhaftSummaryHtml()}
        </div>
        <div class="eval-block" style="background:#111; padding:14px; border-radius:10px; border:1px solid #333;">
            <h4 style="margin:0 0 8px; color:#2ecc71;">Das hast du gut gemacht</h4>
            ${positives.map(f => `<p class="eval-row">${f}</p>`).join('') || '<p class="eval-row">–</p>'}
        </div>
        <div class="eval-block" style="background:#1a0f0f; padding:14px; border-radius:10px; border:1px solid #3a2020;">
            <h4 style="margin:0 0 10px; color:#e74c3c;">❌ Vergessen / falsch (nach xABCDE)</h4>
            ${grouped.map(e => `<p class="eval-row" style="display:flex; gap:8px; align-items:flex-start; flex-wrap:wrap;">
                <span class="letter-badge">${SCORE_EVENT_LETTER_LABELS[e.letter] || e.letter}</span>
                ${e.critical ? '<span class="crit-badge">⚠️ Für diesen Fall entscheidend</span>' : ''}
                <span style="${e.critical ? 'font-weight:bold;' : ''}">${escHtml(e.text)} <span style="color:#888; font-size:0.8rem; font-weight:normal;">(-${e.weight})</span></span></p>`).join('') || '<p class="ok">Keine offenen Punkte 🎉</p>'}
        </div>
        ${errorHtml}
        <div class="eval-block" style="padding:14px; background:rgba(52,152,219,0.1); border-left:4px solid #3498db; border-radius:5px;">
            ${weakest ? `<p style="margin:0;">📌 Die meisten Punkte hast du bei <strong>${weakest.letter} (${weakest.name})</strong> verloren (${weakest.value}%).</p>` : '<p style="margin:0;">📌 Alle xABCDE-Bereiche vollständig!</p>'}
            ${worst ? `<p style="margin:8px 0 0;">🎯 Wichtigster Punkt: ${escHtml(worst.text)}</p>` : ''}
        </div>
        ${c.lernziel ? `<div class="eval-block" style="padding:14px; background:rgba(46,204,113,0.08); border-left:4px solid #2ecc71; border-radius:5px;">
            <h4 style="margin:0 0 6px; color:#2ecc71;">📖 Musterlösung / Lernziel</h4><p style="margin:0; line-height:1.5;"><strong>${escHtml(c.diagnosis)}:</strong> ${escHtml(c.lernziel)}</p>
            <p style="margin:8px 0 0; color:#aaa; font-size:0.85rem;">Notarzt-Indikation: ${c.naRequired ? 'ja' : 'nein'} · Zielklinik: ${escHtml(c.department)}</p></div>` : ''}
        <p style="color:#777; font-size:0.78rem; margin:0 0 10px;">Hinweis: Lehraussagen deiner Rettungsdienstschule und regionale Vorgaben haben Vorrang.</p>`;

    document.getElementById('eval-footer').innerHTML = `
        <div class="eval-buttons">
            <button class="pdf-btn" onclick="exportPDF()">📄 Als PDF exportieren</button>
            <button class="restart-btn" onclick="restartSimulator()">Neuen Einsatz starten</button>
        </div>
        ${weakest ? `<button class="focus-btn" onclick="startNextFocusCase('${weakest.letter}', '${escJs(weakest.name)}')">🎯 Nächster Fall zu deiner Schwachstelle: ${weakest.letter} – ${weakest.name}</button>` : ''}`;
    document.getElementById('eval-modal')?.classList.remove('hidden');
}

function restartSimulator() {
    storageSet('mediciq_rs_last_category', p.activeCategory || 'intern');
    location.reload();
}
function startNextFocusCase(letter, name) {
    storageSet('mediciq_rs_next_focus', JSON.stringify({ category: p.activeCategory || 'intern', letter, name }));
    location.reload();
}
