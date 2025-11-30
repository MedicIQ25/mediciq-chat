/**
 * Netlify Function: case-step
 * (Final Protocol Logic Repair)
 */
exports.handler = async (event) => {
  const headers = { "content-type": "application/json", "access-control-allow-origin": "*" };

  try {
    const body  = event.body ? JSON.parse(event.body) : {};
    const state = body.case_state || {};
    const ua    = String(body.user_action || "").trim();
    const low   = ua.toLowerCase();

    // Init
    state.vitals     = state.vitals || {};
    state.steps_done = Array.isArray(state.steps_done) ? state.steps_done : [];
    state.history    = Array.isArray(state.history) ? state.history : [];
    state.score      = state.score || 0;
    state.measurements = state.measurements || { vitals: {}, schemas: {}, pain: {}, diagnosis: null, iv_access: false, handover_done: false };
    
    // History
    if (ua && !low.includes('debriefing')) {
      state.history.push({ ts: new Date().toISOString(), action: ua });
      if (state.history.length > 60) state.history.shift();
    }

    const reply = { accepted: false, updated_vitals: {}, done: false, case_state: state };
    const H = state.hidden || {};
    const baseVitals = H.vitals_baseline || { SpO2: 96, RR: "120/80", AF: 14, Puls: 80 };

    // --- HELPER ---
    const updVitals = (obj) => {
      for (const k in obj) {
        state.vitals[k] = obj[k];
        if (state.measurements.vitals[k]) {
            if (k === 'RR') { reply.updated_vitals[k] = obj[k]; } 
            else {
                const oldVal = parseFloat(String(state.vitals[k]).match(/\d+/)?.[0] || 0);
                const newVal = parseFloat(String(obj[k]).match(/\d+/)?.[0] || 0);
                let arrow = "";
                if (newVal > oldVal) arrow = " ⬆";
                if (newVal < oldVal) arrow = " ⬇";
                reply.updated_vitals[k] = newVal + arrow;
            }
        }
      }
    };

    const text = (v) => (v === undefined || v === null || v === "") ? "—" : String(v).trim();
    const touchStep = (l) => { 
        if(!state.steps_done.includes(l.toUpperCase())) { 
            state.steps_done.push(l.toUpperCase()); 
            state.score += 1; 
        } 
    };
    function ok(body) { return { statusCode: 200, headers, body: JSON.stringify(body) }; }

    // --- 0. SYSTEM CHECK ---
    if (ua.includes("System-Check")) {
        const hasO2 = state.history.some(h => h && h.action && (h.action.includes('O2-Gabe')));
        const curSpO2 = parseFloat(String(state.vitals.SpO2 || baseVitals.SpO2).match(/\d+/)?.[0]);
        reply.accepted = true; 
        if (curSpO2 < 93 && !hasO2) {
            const newSpO2 = Math.max(70, curSpO2 - 2);
            updVitals({ SpO2: newSpO2 });
            if (state.measurements.vitals?.SpO2) reply.finding = `⚠️ SpO₂ fällt auf ${newSpO2}%`;
        } 
        return ok(reply);
    }

    // --- 1. MEDIZINISCHE AKTIONEN ---
    
    // X - Exsanguination (TOUCH STEP FÜR BEIDE PFADE!)
    if (low.includes('blutung') || low.includes('x unauffällig')) {
        reply.accepted = true; 
        reply.finding = H.bleeding_info || "Keine kritische Blutung sichtbar.";
        reply.evaluation = "X: Blutungscheck durchgeführt.";
        touchStep("X"); 
        return ok(reply);
    }
    if (/tourniquet|druckverband/.test(low)) { reply.accepted = true; reply.evaluation = "Blutung gestillt."; reply.finding = "Blutungskontrolle erfolgreich."; touchStep("X"); return ok(reply); }

    // A - Airway
    if (/mund/.test(low) || /rachen/.test(low)) {
        reply.accepted = true; reply.finding = H.mouth || "Mundraum frei."; reply.evaluation = "A: Mundraum inspiziert."; touchStep("A"); return ok(reply);
    }
    if (/absaugen/.test(low)) { reply.accepted = true; reply.evaluation = "Atemwege abgesaugt."; reply.finding = "Weg wieder frei."; touchStep("A"); return ok(reply); }

    // B - Breathing
    if (/lunge|auskultieren|abhören/.test(low)) {
        reply.accepted = true; reply.finding = H.lung || "Vesikuläratmen bds., o.B."; reply.evaluation = "B: Auskultation durchgeführt."; touchStep("B"); return ok(reply);
    }

    // D - Disability
    if (/pupillen/.test(low)) {
        reply.accepted = true;
        reply.finding = H.pupils || "Isokor, mittelweit, prompt."; // <--- FIX: LIEFERT DETAILS
        reply.evaluation = "D: Pupillenkontrolle.";
        touchStep("D"); return ok(reply);
    }
    
    // E - Exposure / pDMS
    if (/pdms/.test(low)) {
        reply.accepted = true;
        reply.evaluation = "pDMS geprüft:";
        let finding = "DMS an allen Extremitäten intakt.";
        if (state.specialty === 'trauma') {
            const loc = H.injury_map?.[0] || "betroffener Stelle";
            finding = `DMS eingeschränkt an ${loc} (schmerzbedingt). Durchblutung erhalten.`;
        }
        reply.finding = finding;
        touchStep("C"); // pDMS zählt zu C/E, aber E ist besser
        return ok(reply);
    }
    if (/bodycheck/.test(low)) { 
        reply.accepted=true; 
        let info = H.skin || "Haut unauffällig.";
        if(H.injuries && H.injuries.length > 0) info += " Verletzungen: " + H.injuries.join(', ');
        reply.finding = info; 
        reply.evaluation="E: Bodycheck durchgeführt."; touchStep("E"); return ok(reply); 
    }

    // --- 2. VITALWERTE & SCHEMATA (mit Doku-Protokoll) ---
    
    // Vitals (Messen)
    if (/spo2/.test(low)) { state.measurements.vitals.SpO2=true; state.measurements.vitals.Puls=true; updVitals({ SpO2: state.vitals.SpO2, Puls: state.vitals.Puls }); reply.accepted=true; reply.evaluation="Sensor angelegt."; touchStep("B"); return ok(reply); }
    if (/ekg/.test(low)) { state.measurements.vitals.Puls=true; updVitals({ Puls: state.vitals.Puls }); reply.accepted=true; reply.finding=H.ekg12||"Sinus"; reply.evaluation="EKG geschrieben."; touchStep("C"); return ok(reply); }
    if (/rr|puls|gcs|bz|temp|af/.test(low)) {
        // Muss in touchStep Logik erweitert werden, aber hier nur Ausführung
        reply.accepted = true; reply.evaluation="Werte erfasst."; return ok(reply);
    }

    // SAMPLER DOKU (FIX: Protokolliert Inhalt)
    if (/sampler doku/.test(low)) { 
        reply.accepted=true; 
        const s = state.anamnesis?.SAMPLER || {};
        reply.evaluation="SAMPLER dokumentiert:"; 
        // Protokolliert die wichtigsten Kürzel im Chat
        reply.finding = `S: ${text(s.S)} | A: ${text(s.A)} | M: ${text(s.M)} | P: ${text(s.P)} | L: ${text(s.L)} | E: ${text(s.E)} | R: ${text(s.R)}`; 
        return ok(reply); 
    }

    // 4S DOKU (FIX: Protokolliert Inhalt)
    if (/4s doku/.test(low)) { 
        reply.accepted = true; 
        const s = state.scene_4s || {};
        reply.evaluation = "4S dokumentiert:";
        reply.finding = `Sicherheit: ${text(s.sicherheit)}<br>Szene: ${text(s.szene)}`;
        return ok(reply); 
    }

    // --- 3. ORGA & FALLBACK ---
    if (low.includes("übergabe") && !low.includes("fehlt")) { state.measurements.handover_done = true; reply.accepted = true; reply.evaluation="Übergabe an Klinik/Arzt erfolgt."; return ok(reply); }
    if (low.includes("Verdachtsdiagnose")) { state.measurements.diagnosis = ua.split(":")[1]; reply.accepted = true; reply.evaluation="Verdacht notiert."; return ok(reply); }
    if (/debrief|fall beenden/.test(low)) { /* ... Debriefing Logic ... */ } // Sollte durch Debriefing-Fix abgedeckt sein

    reply.accepted = true; reply.evaluation = "OK.";
    return ok(reply);

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};