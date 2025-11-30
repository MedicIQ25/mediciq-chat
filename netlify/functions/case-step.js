/**
 * Netlify Function: case-step
 * (Final Stability Update: Robust Debriefing & RR Fix)
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
    
    // History Eintrag
    if (ua) {
      state.history.push({ ts: new Date().toISOString(), action: ua });
      // Begrenzen, damit Payload nicht zu riesig wird
      if (state.history.length > 60) state.history.shift();
    }

    const reply = { accepted: false, updated_vitals: {}, done: false, case_state: state };
    const H = state.hidden || {};
    const baseVitals = H.vitals_baseline || { SpO2: 96, RR: "120/80", AF: 14, Puls: 80, GCS: 15, BZ: 100, Temp: 36.5 };

    // --- HELPER: VITALWERTE UPDATE ---
    const updVitals = (obj) => {
      for (const k in obj) {
        state.vitals[k] = obj[k];
        // Nur senden, wenn Wert "sichtbar" (gemessen) ist
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

    // --- DEBRIEFING (ROBUST) ---
    // Trigger: "Debriefing" oder "Fall beenden"
    if (/debrief|fall beenden/.test(low)) {
      reply.done = true;
      
      // A. Analyse
      const stepsAll = ["X","A","B","C","D","E"];
      const missingSteps = stepsAll.filter(s => !state.steps_done.includes(s));
      const score = state.score;
      
      const userDxRaw = (state.measurements.diagnosis || "").toLowerCase();
      const correctKeys = Array.isArray(H.diagnosis_keys) ? H.diagnosis_keys : [];
      const isDxCorrect = correctKeys.some(key => userDxRaw.includes(key.toLowerCase()));

      const actionsDone = state.history.map(h => (h.action || "").toLowerCase());
      const hasImmo = actionsDone.some(a => a.includes("immobilisation") || a.includes("schiene"));
      const hasO2   = actionsDone.some(a => a.includes("o2-gabe"));
      const hoDone  = state.measurements.handover_done;

      // B. Text
      let status = "Bestanden";
      let summary = "";

      if (missingSteps.length > 0) {
        status = "⚠️ Struktur lückenhaft";
        summary = `Es fehlten Phasen im ABCDE-Schema: ${missingSteps.join(', ')}`;
      } else {
        status = isDxCorrect ? "✅ Hervorragend" : "✅ Bestanden";
        summary = `Struktur wurde sauber abgearbeitet (Score ${score}).`;
      }

      summary += "<br><br><b>Maßnahmen-Check:</b>";
      if (hasImmo) summary += "<br>✅ Trauma-Versorgung (Immobilisation) erkannt.";
      if (hasO2 && parseFloat(state.vitals.SpO2) < 94) summary += "<br>✅ Sauerstoffgabe war indiziert.";
      if (hoDone) summary += "<br>✅ Übergabe ist erfolgt.";
      else summary += "<br>⚠️ Übergabe an den Arzt fehlte.";
      
      summary += "<br><br><b>Diagnose:</b>";
      if (state.measurements.diagnosis) {
        summary += `<br>Deine Diagnose: "<i>${state.measurements.diagnosis}</i>"`;
        if (isDxCorrect) summary += `<br>✅ <b>Korrekt!</b> Das entspricht dem Krankheitsbild.`;
        else summary += `<br>⚠️ <b>Abweichung.</b> Erwartet wurde etwas aus dem Bereich: ${correctKeys.join(' / ')}.`;
      } else {
        summary += `<br>⚠️ Keine Verdachtsdiagnose dokumentiert.`;
      }

      reply.debrief = `<b>${status}</b><br>${summary}`;
      return ok(reply);
    }

    // --- STANDARDS (DIAGNOSE, ÜBERGABE) ---
    if (ua.includes("Verdachtsdiagnose") || ua.includes("Verdacht:")) { 
      state.measurements.diagnosis = ua.replace("Verdachtsdiagnose:", "").trim(); 
      reply.accepted = true; reply.evaluation = "Verdachtsdiagnose dokumentiert.";
      return ok(reply); 
    }
    if (ua.includes("Übergabe:")) {
        state.measurements.handover_done = true;
        reply.evaluation = "Übergabe erfolgt."; reply.accepted = true;
        return ok(reply);
    }

    // --- ACTIONS ---
    if (ua.includes('O2-Gabe')) {
      const flowMatch = ua.match(/(\d+)\s*l\/min/);
      const flow = flowMatch ? parseInt(flowMatch[1]) : 0;
      const currentSpO2 = parseFloat(String(state.vitals.SpO2 || baseVitals.SpO2).match(/\d+/)?.[0]);
      let boost = flow * 1.5; 
      const newSpO2 = Math.min(100, Math.max(currentSpO2, currentSpO2 + boost));
      updVitals({ SpO2: Math.floor(newSpO2) });
      reply.accepted = true; reply.evaluation = `Sauerstoff ${flow} l/min.`; reply.finding = `SpO₂ steigt an.`; touchStep("B"); return ok(reply);
    }

    // Messungen (aktivieren Display)
    if (/spo2|sättigung/.test(low)) { 
        state.measurements.vitals.SpO2 = true; state.measurements.vitals.Puls = true; 
        updVitals({ SpO2: state.vitals.SpO2 || baseVitals.SpO2, Puls: state.vitals.Puls || baseVitals.Puls });
        reply.accepted = true; reply.evaluation = "Sensor angelegt."; touchStep("B"); return ok(reply); 
    }
    if (/ekg/.test(low)) { 
        state.measurements.vitals.Puls = true;
        updVitals({ Puls: state.vitals.Puls || baseVitals.Puls });
        reply.accepted = true; reply.finding = H.ekg12 || "Sinus"; reply.evaluation = "EKG geschrieben."; touchStep("C"); return ok(reply); 
    }
    if (/rr|blutdruck/.test(low)) { state.measurements.vitals.RR = true; updVitals({RR: state.vitals.RR || baseVitals.RR}); reply.accepted=true; reply.evaluation="RR gemessen."; touchStep("C"); return ok(reply); }
    if (/puls/.test(low)) { state.measurements.vitals.Puls = true; updVitals({Puls: state.vitals.Puls || baseVitals.Puls}); reply.accepted=true; reply.evaluation="Puls getastet."; touchStep("C"); return ok(reply); }
    if (/gcs/.test(low)) { state.measurements.vitals.GCS = true; updVitals({ GCS: state.vitals.GCS || baseVitals.GCS || 15 }); reply.accepted=true; reply.evaluation="GCS erhoben."; touchStep("D"); return ok(reply); }
    if (/bz|blutzucker/.test(low)) { state.measurements.vitals.BZ = true; updVitals({BZ: state.vitals.BZ || baseVitals.BZ || 100}); reply.accepted=true; reply.evaluation="BZ gemessen."; touchStep("D"); return ok(reply); }
    if (/temp/.test(low)) { state.measurements.vitals.Temp = true; updVitals({Temp: state.vitals.Temp || baseVitals.Temp || 36.5}); reply.accepted=true; reply.evaluation="Temp gemessen."; touchStep("E"); return ok(reply); }
    if (/af|atemfreq/.test(low)) { state.measurements.vitals.AF = true; updVitals({AF: state.vitals.AF || baseVitals.AF || 14}); reply.accepted=true; reply.evaluation="AF gezählt."; touchStep("B"); return ok(reply); }

    // Schemata
    if (/sampler info/.test(low)) {
      reply.accepted = true;
      const s = state.anamnesis?.SAMPLER || {};
      reply.finding = `S: ${text(s.S)}\nA: ${text(s.A)}\nM: ${text(s.M)}\nP: ${text(s.P)}\nL: ${text(s.L)}\nE: ${text(s.E)}\nR: ${text(s.R)}`;
      return ok(reply);
    }
    if (/sampler doku/.test(low)) { reply.accepted=true; reply.evaluation="SAMPLER doku."; return ok(reply); }
    
    if (/befast info/.test(low)) { reply.accepted = true; reply.finding = H.befast || "BE-FAST: o.B."; touchStep("D"); return ok(reply); }
    if (/befast doku/.test(low)) { reply.accepted=true; reply.evaluation="BE-FAST doku."; return ok(reply); }

    if (/schmerz info|nrs/.test(low)) { reply.accepted = true; const p = H.pain || {}; reply.finding = `NRS ${p.nrs || '0'}/10 (${p.ort || '-'})`; return ok(reply); }

    if (/4s info/.test(low)) { reply.accepted = true; const s = state.scene_4s || {}; reply.finding = `Sicherheit: ${text(s.sicherheit)}\nSzene: ${text(s.szene)}`; return ok(reply); }
    if (/4s doku/.test(low)) { reply.accepted=true; reply.evaluation="4S doku."; return ok(reply); }

    // Fallbacks
    if (/zugang/.test(low)) { state.measurements.iv_access = true; reply.accepted=true; reply.evaluation="i.V. Zugang liegt."; touchStep("C"); return ok(reply); }
    if (/volumen/.test(low)) { reply.accepted=true; reply.evaluation="Infusion läuft."; touchStep("C"); return ok(reply); }
    if (/notarzt/.test(low)) { reply.accepted=true; reply.evaluation="NA alarmiert."; touchStep("C"); return ok(reply); }
    if (/bodycheck/.test(low)) { reply.accepted=true; reply.finding=H.injuries?.join(', ')||"Keine äußeren Verletzungen."; reply.evaluation="Bodycheck."; touchStep("E"); return ok(reply); }
    if (/immobilisation/.test(low)) { reply.accepted=true; reply.evaluation="Immobilisiert."; touchStep("E"); return ok(reply); }
    
    reply.accepted = true; reply.evaluation = "OK.";
    return ok(reply);

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};