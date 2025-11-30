/**
 * Netlify Function: case-step
 * (Final Final: Protocol Formatting, Robust Debriefing & Action Fixes)
 */
exports.handler = async (event) => {
  const headers = { "content-type": "application/json", "access-control-allow-origin": "*" };

  try {
    const body  = event.body ? JSON.parse(event.body) : {};
    const state = body.case_state || {};
    const ua    = String(body.user_action || "").trim();
    const low   = ua.toLowerCase();

    // 1. State Init
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

    // --- DEBRIEFING LOGIK ---
    if (/debrief|fall beenden/.test(low)) {
      reply.done = true;
      
      const stepsAll = ["X","A","B","C","D","E"];
      const missingSteps = stepsAll.filter(s => !state.steps_done.includes(s));
      const score = state.score;
      
      const userDx = (state.measurements.diagnosis || "").toLowerCase();
      const correctKeys = Array.isArray(H.diagnosis_keys) ? H.diagnosis_keys : [];
      const isDxCorrect = correctKeys.some(key => userDx.includes(key.toLowerCase()));

      const histStr = state.history.map(h => h && h.action ? h.action.toLowerCase() : "").join(" ");
      const hasImmo = histStr.includes("immobilisation");
      const hasO2 = histStr.includes("o2-gabe") || histStr.includes("sauerstoff");
      const hasHandover = state.measurements.handover_done;

      let status = missingSteps.length ? "⚠️ Struktur lückenhaft" : "✅ Bestanden";
      let summary = `<b>Erreichter Score: ${score}</b><br>`;
      
      if (missingSteps.length > 0) {
          summary += `<br>❌ <b>Fehlende Phasen:</b> ${missingSteps.join(', ')}`;
      } else {
          summary += `<br>✅ <b>X-ABCDE:</b> Vollständig abgearbeitet.`;
      }

      summary += `<br><br><b>Diagnose & Maßnahmen:</b>`;
      if (state.measurements.diagnosis) {
          summary += `<br>${isDxCorrect ? '✅' : '⚠️'} Diagnose: "${state.measurements.diagnosis}"`;
      } else {
          summary += `<br>❌ Keine Diagnose gestellt.`;
      }

      if (hasHandover) summary += `<br>✅ Übergabe durchgeführt.`;
      else summary += `<br>❌ Keine Übergabe an den Arzt.`;

      reply.debrief = `<b>${status}</b><br>${summary}`;
      return ok(reply);
    }
    
    // --- 2. MEDIZINISCHE AKTIONEN ---
    
    // X - Exsanguination
    if (low.includes('blutung') || low.includes('x unauffällig')) {
        reply.accepted = true; reply.finding = H.bleeding_info || "Keine kritische Blutung sichtbar.";
        reply.evaluation = "X: Blutungscheck durchgeführt."; touchStep("X"); return ok(reply);
    }
    // A - Airway
    if (/mund/.test(low) || /rachen/.test(low)) {
        reply.accepted = true; reply.finding = H.mouth || "Mundraum frei."; reply.evaluation = "A: Mundraum inspiziert."; touchStep("A"); return ok(reply);
    }
    // B - Breathing
    if (/lunge|auskultieren|abhören/.test(low)) {
        reply.accepted = true; reply.finding = H.lung || "Vesikuläratmen bds., o.B."; reply.evaluation = "B: Auskultation durchgeführt."; touchStep("B"); return ok(reply);
    }
    // D - Disability
    if (/pupillen/.test(low)) {
        reply.accepted = true; reply.finding = H.pupils || "Isokor, mittelweit, prompt."; reply.evaluation = "D: Pupillenkontrolle."; touchStep("D"); return ok(reply);
    }
    // E - Exposure / pDMS
    if (/pdms/.test(low)) {
        reply.accepted = true; reply.evaluation = "pDMS geprüft:";
        let finding = "DMS an allen Extremitäten intakt.";
        if (state.specialty === 'trauma') { finding = `DMS eingeschränkt an betroffener Stelle, Durchblutung erhalten.`; }
        reply.finding = finding; touchStep("C"); return ok(reply);
    }
    
    // --- 3. VITALWERTE & SCHEMATA (FIX: FORMATIERUNG) ---
    
    // SAMPLER DOKU (FIX: Protokolliert vertikal)
    if (/sampler doku/.test(low)) { 
        reply.accepted=true; 
        const s = state.anamnesis?.SAMPLER || {};
        reply.evaluation="SAMPLER dokumentiert:"; 
        // Vertikale Darstellung im Protokoll
        reply.finding = `S: ${text(s.S)}<br>A: ${text(s.A)}<br>M: ${text(s.M)}<br>P: ${text(s.P)}<br>L: ${text(s.L)}<br>E: ${text(s.E)}<br>R: ${text(s.R)}`; 
        return ok(reply); 
    }
    
    // 4S DOKU (FIX: Protokolliert vertikal)
    if (/4s doku/.test(low)) { 
        reply.accepted = true; 
        const s = state.scene_4s || {};
        reply.evaluation = "4S dokumentiert:";
        reply.finding = `Sicherheit: ${text(s.sicherheit)}<br>Szene: ${text(s.szene)}<br>Sichtung: ${text(s.sichtung_personen)}<br>Support: ${text(s.support_empfehlung)}`;
        return ok(reply); 
    }
    
    // --- 4. ORGA & FALLBACKS ---
    if (low.includes("übergabe")) { 
        state.measurements.handover_done = true; 
        reply.accepted = true; 
        reply.evaluation="Übergabe an Klinik/Arzt erfolgt."; 
        return ok(reply); 
    }
    if (low.includes("Verdachtsdiagnose")) { state.measurements.diagnosis = ua.split(":")[1]; reply.accepted = true; reply.evaluation="Verdacht notiert."; return ok(reply); }

    // Fallbacks
    if (/zugang/.test(low)) { state.measurements.iv_access = true; reply.accepted=true; reply.evaluation="Zugang gelegt."; touchStep("C"); return ok(reply); }
    if (/volumen/.test(low)) { reply.accepted=true; reply.evaluation="Infusion läuft."; touchStep("C"); return ok(reply); }
    if (/notarzt/.test(low)) { reply.accepted=true; reply.evaluation="NA nachgefordert."; touchStep("C"); return ok(reply); }
    
    // Vitals (Messen)
    if (/spo2/.test(low)) { state.measurements.vitals.SpO2=true; state.measurements.vitals.Puls=true; updVitals({ SpO2: state.vitals.SpO2, Puls: state.vitals.Puls }); reply.accepted=true; reply.evaluation="Sensor angelegt."; touchStep("B"); return ok(reply); }
    if (/ekg/.test(low)) { state.measurements.vitals.Puls=true; updVitals({ Puls: state.vitals.Puls }); reply.accepted=true; reply.finding=H.ekg12||"Sinus"; reply.evaluation="EKG geschrieben."; touchStep("C"); return ok(reply); }
    if (/rr/.test(low)) { state.measurements.vitals.RR=true; updVitals({ RR: state.vitals.RR }); reply.accepted=true; reply.evaluation="RR gemessen."; touchStep("C"); return ok(reply); }
    if (/puls/.test(low)) { state.measurements.vitals.Puls=true; updVitals({ Puls: state.vitals.Puls }); reply.accepted=true; reply.evaluation="Puls getastet."; touchStep("C"); return ok(reply); }
    if (/temp/.test(low)) { state.measurements.vitals.Temp=true; updVitals({Temp: state.vitals.Temp}); reply.accepted=true; reply.evaluation="Temp gemessen."; touchStep("E"); return ok(reply); }

    reply.accepted = true; reply.evaluation = "OK.";
    return ok(reply);

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};