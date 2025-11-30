/**
 * Netlify Function: case-step
 * (Final Stability: Robust Debriefing Logic)
 */
exports.handler = async (event) => {
  const headers = { "content-type": "application/json", "access-control-allow-origin": "*" };

  try {
    const body  = event.body ? JSON.parse(event.body) : {};
    const state = body.case_state || {};
    const ua    = String(body.user_action || "").trim();
    const low   = ua.toLowerCase();

    // 1. State Initialisierung (Sicherheitshalber Arrays erzwingen)
    state.vitals     = state.vitals || {};
    state.steps_done = Array.isArray(state.steps_done) ? state.steps_done : [];
    state.history    = Array.isArray(state.history) ? state.history : [];
    state.score      = state.score || 0;
    state.measurements = state.measurements || { vitals: {}, schemas: {}, pain: {}, diagnosis: null, iv_access: false, handover_done: false };
    
    // History Eintrag (nur wenn kein Debriefing Request)
    if (ua && !low.includes('debriefing')) {
      state.history.push({ ts: new Date().toISOString(), action: ua });
      if (state.history.length > 60) state.history.shift();
    }

    const reply = { accepted: false, updated_vitals: {}, done: false, case_state: state };
    const H = state.hidden || {};
    const baseVitals = H.vitals_baseline || { SpO2: 96, RR: "120/80", AF: 14, Puls: 80 };

    // --- HELPER: VITALWERTE UPDATE ---
    const updVitals = (obj) => {
      for (const k in obj) {
        state.vitals[k] = obj[k];
        if (state.measurements.vitals[k]) {
            if (k === 'RR') {
                reply.updated_vitals[k] = obj[k]; // RR als String lassen!
            } else {
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
    const touchStep = (l) => { if(!state.steps_done.includes(l.toUpperCase())) { state.steps_done.push(l.toUpperCase()); state.score+=1; } };
    function ok(body) { return { statusCode: 200, headers, body: JSON.stringify(body) }; }

    // --- SYSTEM CHECK ---
    if (ua.includes("System-Check")) {
        // Safe check for history
        const hasO2 = state.history.some(h => h && h.action && (h.action.includes('O2-Gabe') || h.action.toLowerCase().includes('beatmung')));
        const curSpO2 = parseFloat(String(state.vitals.SpO2 || baseVitals.SpO2).match(/\d+/)?.[0]);
        reply.accepted = true; 
        if (curSpO2 < 93 && !hasO2) {
            const newSpO2 = Math.max(70, curSpO2 - 2);
            updVitals({ SpO2: newSpO2 });
            if (state.measurements.vitals?.SpO2) reply.finding = `⚠️ SpO₂ fällt auf ${newSpO2}%`;
        } 
        return ok(reply);
    }

    // --- DEBRIEFING LOGIK (Safe Mode) ---
    if (/debrief|fall beenden/.test(low)) {
      reply.done = true;
      
      // A. Schritte
      const stepsAll = ["X","A","B","C","D","E"];
      const missingSteps = stepsAll.filter(s => !state.steps_done.includes(s));
      const score = state.score;
      
      // B. Diagnose
      const userDx = (state.measurements.diagnosis || "").toLowerCase();
      const correctKeys = Array.isArray(H.diagnosis_keys) ? H.diagnosis_keys : [];
      const isDxCorrect = correctKeys.some(key => userDx.includes(key.toLowerCase()));

      // C. Maßnahmen (Safe mapping)
      // Wir wandeln das History Array sicher in einen langen String um
      const histStr = state.history.map(h => h && h.action ? h.action.toLowerCase() : "").join(" ");
      
      const hasImmo = histStr.includes("immobilisation") || histStr.includes("schiene") || histStr.includes("stifneck");
      const hasO2 = histStr.includes("o2-gabe") || histStr.includes("sauerstoff");
      const hasHandover = state.measurements.handover_done;

      // D. Text generieren
      let status = "✅ Bestanden";
      if (missingSteps.length > 0) status = "⚠️ Struktur unvollständig";
      
      let summary = `<b>Erreichter Score: ${score}</b><br>`;
      
      if (missingSteps.length > 0) {
          summary += `<br>❌ <b>Fehlende Phasen:</b> ${missingSteps.join(', ')}`;
      } else {
          summary += `<br>✅ <b>X-ABCDE:</b> Struktur eingehalten.`;
      }

      summary += `<br><br><b>Analyse:</b>`;
      
      if (userDx) {
          summary += `<br>${isDxCorrect ? '✅' : '⚠️'} Diagnose: "${state.measurements.diagnosis}"`;
          if(!isDxCorrect && correctKeys.length > 0) summary += ` (Erwartet: ${correctKeys.join(' / ')})`;
      } else {
          summary += `<br>❌ Keine Diagnose gestellt.`;
      }

      if (hasHandover) summary += `<br>✅ Übergabe durchgeführt.`;
      else summary += `<br>❌ Keine Übergabe an den Arzt.`;

      // Fall-spezifisches Feedback
      if (state.specialty === 'trauma') {
          if (hasImmo) summary += `<br>✅ Trauma immobilisiert.`;
          else summary += `<br>⚠️ Immobilisation fehlte.`;
      }
      
      const spo2Val = parseFloat(String(state.vitals.SpO2).match(/\d+/)?.[0] || 99);
      if (spo2Val < 94) {
          if (hasO2) summary += `<br>✅ Sauerstoff gegeben.`;
          else summary += `<br>⚠️ Hypoxie! Sauerstoff vergessen.`;
      }

      reply.debrief = `<b>${status}</b><br>${summary}`;
      return ok(reply);
    }

    // --- STANDARDS ---
    if (ua.includes("Verdachtsdiagnose")) { state.measurements.diagnosis = ua.split(":")[1]; reply.accepted = true; reply.evaluation="Diagnose notiert."; return ok(reply); }
    if (ua.includes("Übergabe:")) { state.measurements.handover_done = true; reply.accepted = true; reply.evaluation="Übergabe erfolgt."; return ok(reply); }

    // --- VITALS ---
    if (/spo2/.test(low)) { 
        state.measurements.vitals.SpO2 = true; state.measurements.vitals.Puls = true; 
        updVitals({ SpO2: state.vitals.SpO2 || baseVitals.SpO2, Puls: state.vitals.Puls || baseVitals.Puls });
        reply.accepted = true; reply.evaluation = "Sensor angelegt."; touchStep("B"); return ok(reply); 
    }
    if (/ekg/.test(low)) { 
        state.measurements.vitals.Puls = true;
        updVitals({ Puls: state.vitals.Puls || baseVitals.Puls });
        reply.accepted = true; reply.finding = H.ekg12 || "Sinus"; reply.evaluation = "EKG geschrieben."; touchStep("C"); return ok(reply); 
    }
    if (/rr|blutdruck/.test(low)) { 
        state.measurements.vitals.RR = true; 
        updVitals({ RR: state.vitals.RR || baseVitals.RR }); 
        reply.accepted=true; reply.evaluation="RR gemessen."; touchStep("C"); return ok(reply); 
    }
    if (/puls/.test(low)) { state.measurements.vitals.Puls = true; updVitals({Puls: state.vitals.Puls || baseVitals.Puls}); reply.accepted=true; reply.evaluation="Puls getastet."; touchStep("C"); return ok(reply); }
    if (/gcs/.test(low)) { state.measurements.vitals.GCS = true; updVitals({ GCS: state.vitals.GCS || 15 }); reply.accepted=true; reply.evaluation="GCS erhoben."; touchStep("D"); return ok(reply); }
    if (/bz/.test(low)) { state.measurements.vitals.BZ = true; updVitals({BZ: state.vitals.BZ || 100}); reply.accepted=true; reply.evaluation="BZ gemessen."; touchStep("D"); return ok(reply); }
    if (/temp/.test(low)) { state.measurements.vitals.Temp = true; updVitals({Temp: state.vitals.Temp || 36.5}); reply.accepted=true; reply.evaluation="Temp gemessen."; touchStep("E"); return ok(reply); }
    if (/af/.test(low)) { state.measurements.vitals.AF = true; updVitals({AF: state.vitals.AF || 14}); reply.accepted=true; reply.evaluation="AF gezählt."; touchStep("B"); return ok(reply); }

    // --- SCHEMATA ---
    if (/sampler info/.test(low)) {
      const s = state.anamnesis?.SAMPLER || {};
      reply.finding = `S: ${text(s.S)}\nA: ${text(s.A)}\nM: ${text(s.M)}\nP: ${text(s.P)}\nL: ${text(s.L)}\nE: ${text(s.E)}\nR: ${text(s.R)}`;
      reply.accepted = true; return ok(reply);
    }
    if (/befast info/.test(low)) { reply.finding = H.befast || "o.B."; reply.accepted = true; return ok(reply); }
    if (/schmerz info/.test(low)) { const p = H.pain || {}; reply.finding = `NRS ${p.nrs||0}`; reply.accepted=true; return ok(reply); }
    if (/4s info/.test(low)) { const s = state.scene_4s || {}; reply.finding = `Sicherheit: ${s.sicherheit}`; reply.accepted=true; return ok(reply); }

    // --- ACTIONS ---
    if (ua.includes('O2-Gabe')) {
      const flow = parseInt(ua.match(/\d+/)?.[0] || 0);
      const cur = parseFloat(String(state.vitals.SpO2 || 96).match(/\d+/)?.[0]);
      updVitals({ SpO2: Math.min(100, cur + (flow * 1.5)) });
      reply.accepted = true; reply.evaluation = `O2: ${flow}l/min`; reply.finding = "SpO2 steigt."; return ok(reply);
    }
    
    // Fallback
    reply.accepted = true; reply.evaluation = "OK.";
    return ok(reply);

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};