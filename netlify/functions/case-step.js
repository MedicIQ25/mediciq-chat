/**
 * Netlify Function: case-step
 * (Fix: GCS Logic & NIBP Values)
 */
exports.handler = async (event) => {
  const headers = { "content-type": "application/json", "access-control-allow-origin": "*" };

  try {
    const body  = event.body ? JSON.parse(event.body) : {};
    const state = body.case_state || {};
    const ua    = String(body.user_action || "").trim();
    const low   = ua.toLowerCase();

    // Init State
    state.vitals     = state.vitals || {};
    state.steps_done = state.steps_done || [];
    state.history    = state.history || [];
    state.score      = state.score || 0;
    state.action_count = (state.action_count || 0) + 1;
    state.measurements = state.measurements || { vitals: {}, schemas: {}, pain: {}, diagnosis: null, iv_access: false, handover_done: false };
    
    if (ua) {
      state.history.push({ ts: new Date().toISOString(), action: ua });
      if (state.history.length > 50) state.history.shift();
    }

    const reply = { accepted: false, updated_vitals: {}, done: false, case_state: state };
    const H = state.hidden || {};
    // Base Vitals Defaults
    const baseVitals = H.vitals_baseline || { SpO2: 96, RR: "120/80", AF: 14, Puls: 80, GCS: 15, BZ: 100, Temp: 36.5 };

    // Helper: Vitalwerte Update
    const updVitals = (obj) => {
      for (const k in obj) {
        const oldValStr = String(state.vitals[k] || "0"); 
        const oldVal = parseFloat(oldValStr.match(/\d+/)?.[0] || 0);
        const newVal = parseFloat(String(obj[k]).match(/\d+/)?.[0] || 0);
        
        state.vitals[k] = obj[k];

        // Nur senden, wenn Wert sichtbar ist (gemessen wurde)
        if (state.measurements.vitals[k]) {
            let arrow = "";
            if (newVal > oldVal) arrow = " ⬆";
            if (newVal < oldVal) arrow = " ⬇";
            reply.updated_vitals[k] = newVal + arrow;
        }
      }
    };

    const touchStep = (l) => { if(!state.steps_done.includes(l.toUpperCase())) { state.steps_done.push(l.toUpperCase()); state.score+=1; } };
    function ok(body) { return { statusCode: 200, headers, body: JSON.stringify(body) }; }

    // --- SYSTEM LOGIC ---
    if (ua.includes("System-Check")) {
        const hasO2 = state.history.some(h => h.action.includes('O2-Gabe') || h.action.toLowerCase().includes('beatmung'));
        const curSpO2 = parseFloat(String(state.vitals.SpO2 || baseVitals.SpO2).match(/\d+/)?.[0]);
        
        reply.accepted = true; 
        if (curSpO2 < 93 && !hasO2) {
            const newSpO2 = Math.max(70, curSpO2 - 2);
            updVitals({ SpO2: newSpO2 });
            if (state.measurements.vitals?.SpO2) reply.finding = `⚠️ SpO₂ fällt auf ${newSpO2}%`;
        } 
        return ok(reply);
    }

    if (ua.includes("Verdachtsdiagnose") || ua.includes("Verdacht:")) { 
      state.measurements.diagnosis = ua.replace("Verdachtsdiagnose:", "").trim(); 
      reply.accepted = true; 
      reply.evaluation = "Verdachtsdiagnose dokumentiert.";
      return ok(reply); 
    }
    
    if (ua.includes("Übergabe:")) {
        state.measurements.handover_done = true;
        reply.evaluation = "Übergabe erfolgt.";
        reply.accepted = true;
        return ok(reply);
    }

    if (/debrief|fall beenden/.test(low)) {
      reply.done = true;
      const score = state.score;
      const userDxRaw = (state.measurements.diagnosis || "").toLowerCase();
      const correctKeys = state.hidden?.diagnosis_keys || [];
      const isDxCorrect = correctKeys.some(key => userDxRaw.includes(key.toLowerCase()));
      
      let summary = isDxCorrect ? "Diagnose korrekt." : "Diagnose unklar.";
      reply.debrief = `Ergebnis: ${summary}\nScore: ${score}`;
      return ok(reply);
    }

    // --- ACTIONS ---

    // O2 Gabe
    if (ua.includes('O2-Gabe')) {
      const flowMatch = ua.match(/(\d+)\s*l\/min/);
      const flow = flowMatch ? parseInt(flowMatch[1]) : 0;
      const currentSpO2 = parseFloat(String(state.vitals.SpO2 || baseVitals.SpO2).match(/\d+/)?.[0]);
      let boost = flow * 1.5; 
      const newSpO2 = Math.min(100, Math.max(currentSpO2, currentSpO2 + boost));
      updVitals({ SpO2: Math.floor(newSpO2) });
      reply.accepted = true;
      reply.evaluation = `Sauerstoff ${flow} l/min.`;
      reply.finding = `SpO₂ steigt an.`;
      touchStep("B");
      return ok(reply);
    }

    // SpO2 Messung 
    if (/spo2|sättigung/.test(low)) { 
        state.measurements.vitals.SpO2 = true; 
        state.measurements.vitals.Puls = true; 
        updVitals({
            SpO2: state.vitals.SpO2 || baseVitals.SpO2,
            Puls: state.vitals.Puls || baseVitals.Puls
        });
        reply.accepted = true; 
        reply.evaluation = "B: Sensor angelegt."; 
        touchStep("B"); 
        return ok(reply); 
    }

    // EKG 
    if (/ekg/.test(low)) { 
        state.measurements.vitals.Puls = true;
        updVitals({ Puls: state.vitals.Puls || baseVitals.Puls });
        reply.accepted = true; 
        reply.finding = H.ekg12 || "Sinus"; 
        reply.evaluation = "C: EKG geschrieben."; 
        touchStep("C"); 
        return ok(reply); 
    }

    // RR
    if (/rr|blutdruck/.test(low)) { 
        state.measurements.vitals.RR = true; 
        updVitals({RR: state.vitals.RR || baseVitals.RR}); 
        reply.accepted=true; 
        reply.evaluation="C: RR gemessen."; 
        touchStep("C"); 
        return ok(reply); 
    }
    
    // Puls manuell
    if (/puls/.test(low)) { 
        state.measurements.vitals.Puls = true; 
        updVitals({Puls: state.vitals.Puls || baseVitals.Puls}); 
        reply.accepted=true; 
        reply.evaluation="C: Puls getastet."; 
        touchStep("C"); 
        return ok(reply); 
    }

    // GCS (HIER WAR DAS PROBLEM EVENTUELL)
    if (/gcs/.test(low)) { 
        state.measurements.vitals.GCS = true; 
        updVitals({ GCS: state.vitals.GCS || baseVitals.GCS || 15 }); 
        reply.accepted=true; 
        reply.evaluation="D: GCS erhoben."; 
        touchStep("D"); 
        return ok(reply); 
    }

    // BZ
    if (/bz|blutzucker/.test(low)) { 
        state.measurements.vitals.BZ = true; 
        updVitals({BZ: state.vitals.BZ || baseVitals.BZ || 100}); 
        reply.accepted=true; 
        reply.evaluation="D: BZ gemessen."; 
        touchStep("D"); 
        return ok(reply); 
    }

    // Temp
    if (/temp/.test(low)) { 
        state.measurements.vitals.Temp = true; 
        updVitals({Temp: state.vitals.Temp || baseVitals.Temp || 36.5}); 
        reply.accepted=true; 
        reply.evaluation="E: Temp gemessen."; 
        touchStep("E"); 
        return ok(reply); 
    }

    // AF
    if (/af|atemfreq/.test(low)) { 
        state.measurements.vitals.AF = true; 
        updVitals({AF: state.vitals.AF || baseVitals.AF || 14}); 
        reply.accepted=true; 
        reply.evaluation="B: AF gezählt."; 
        touchStep("B"); 
        return ok(reply); 
    }

    // Standard Fallbacks
    if (/zugang/.test(low)) { state.measurements.iv_access = true; reply.accepted=true; reply.evaluation="i.V. Zugang liegt."; touchStep("C"); return ok(reply); }
    if (/volumen/.test(low)) { reply.accepted=true; reply.evaluation="Infusion läuft."; touchStep("C"); return ok(reply); }
    if (/notarzt/.test(low)) { reply.accepted=true; reply.evaluation="NA alarmiert."; touchStep("C"); return ok(reply); }
    if (/bodycheck/.test(low)) { reply.accepted=true; reply.finding=H.injuries?.join(', ')||"o.B."; reply.evaluation="E: Bodycheck."; touchStep("E"); return ok(reply); }
    if (/immobilisation/.test(low)) { reply.accepted=true; reply.evaluation="Immobilisiert."; touchStep("E"); return ok(reply); }
    
    // Schemata
    if (/sampler info/.test(low)) { reply.accepted=true; reply.finding="SAMPLER Info..."; return ok(reply); }
    if (/sampler doku/.test(low)) { reply.accepted=true; reply.evaluation="SAMPLER doku."; return ok(reply); }
    
    // Default
    reply.accepted = true;
    reply.evaluation = "Maßnahme registriert.";
    return ok(reply);

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};