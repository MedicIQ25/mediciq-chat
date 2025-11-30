/**
 * Netlify Function: case-step
 * (Final Fix: O2-Regex, pDMS Logic, HTML formatting & Protocol)
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

    // Helper
    const updVitals = (obj) => {
      for (const k in obj) {
        state.vitals[k] = obj[k];
        if (state.measurements.vitals[k]) {
            if (k === 'RR') {
                reply.updated_vitals[k] = obj[k]; 
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
        const hasO2 = state.history.some(h => h && h.action && h.action.includes('O2-Gabe'));
        const curSpO2 = parseFloat(String(state.vitals.SpO2 || baseVitals.SpO2).match(/\d+/)?.[0]);
        reply.accepted = true; 
        if (curSpO2 < 93 && !hasO2) {
            const newSpO2 = Math.max(70, curSpO2 - 2);
            updVitals({ SpO2: newSpO2 });
            if (state.measurements.vitals?.SpO2) reply.finding = `⚠️ SpO₂ fällt auf ${newSpO2}%`;
        } 
        return ok(reply);
    }

    // --- 1. MEDIZINISCHE UNTERSUCHUNGEN ---
    
    // X, A, B Standards
    if (/blutung/.test(low)) { reply.accepted=true; reply.finding=H.bleeding_info||"Keine kritische Blutung."; reply.evaluation="X: Blutungscheck."; touchStep("X"); return ok(reply); }
    if (/mund/.test(low)) { reply.accepted=true; reply.finding=H.mouth||"Mundraum frei."; reply.evaluation="A: Mundraum."; touchStep("A"); return ok(reply); }
    if (/absaugen/.test(low)) { reply.accepted=true; reply.evaluation="Abgesaugt."; reply.finding="Atemweg frei."; touchStep("A"); return ok(reply); }
    if (/lunge|auskult/.test(low)) { reply.accepted=true; reply.finding=H.lung||"Vesikuläratmen bds."; reply.evaluation="B: Auskultation."; touchStep("B"); return ok(reply); }
    
    // pDMS (FIX: Echte Daten liefern)
    if (/pdms/.test(low)) {
        reply.accepted = true;
        
        let pDMS_text = "DMS an allen Extremitäten intakt (x4).";
        
        // Wenn Trauma oder Schlaganfall, dann spezifischer Befund
        if (state.specialty === 'trauma') {
            const loc = H.injury_map?.[0] || "Arm/Bein";
            // Einfache Logik: Schmerz/Einschränkung bei Trauma
            pDMS_text = `DMS eingeschränkt an ${loc} (schmerzbedingt). Durchblutung erhalten (Rekap < 2s). Sensibilität vorhanden.`;
        } else if (state.specialty === 'neurologisch' && H.befast && !H.befast.includes('ohne Auffälligkeiten')) {
            pDMS_text = "Motorische Schwäche einseitig erkennbar. Sensibilität reduziert.";
        }

        reply.finding = pDMS_text;
        reply.evaluation = "pDMS geprüft.";
        touchStep("C"); // oder E
        return ok(reply);
    }

    // E - Bodycheck
    if (/bodycheck/.test(low)) {
        reply.accepted = true;
        let info = H.skin || "Haut rosig/warm.";
        if(H.injuries && H.injuries.length > 0) info += " Verletzungen: " + H.injuries.join(', ');
        reply.finding = info;
        reply.evaluation = "E: Bodycheck.";
        touchStep("E"); return ok(reply);
    }

    // --- 2. MAẞNAHMEN ---
    
    // O2 GABE (FIX: Regex korrigiert, damit er nicht die "2" aus "O2" nimmt)
    if (ua.includes('O2-Gabe')) {
      // Sucht nach einer Zahl, die VOR "l/min" steht
      const match = ua.match(/mit\s+(\d+)\s*l\/min/); 
      const flow = match ? parseInt(match[1]) : 2; // Fallback 2, falls Parsing scheitert
      
      const cur = parseFloat(String(state.vitals.SpO2 || 96).match(/\d+/)?.[0]);
      // Simulation: Sättigung steigt
      updVitals({ SpO2: Math.min(100, cur + (flow * 1.5)) });
      
      reply.accepted = true; 
      reply.evaluation = `O2-Gabe: ${flow} l/min.`; 
      reply.finding = "Sättigungstrend steigend."; 
      touchStep("B"); 
      return ok(reply);
    }

    if (/zugang/.test(low)) { state.measurements.iv_access=true; reply.accepted=true; reply.evaluation="i.V. Zugang liegt."; touchStep("C"); return ok(reply); }
    if (/volumen/.test(low)) { 
        if(!state.measurements.iv_access) { reply.accepted=false; reply.finding="Kein Zugang!"; return ok(reply); }
        reply.accepted=true; reply.evaluation="500ml Vollelektrolytlösung laufen."; touchStep("C"); return ok(reply); 
    }
    if (/immobilisation/.test(low)) { reply.accepted=true; reply.evaluation="Immobilisation erfolgt."; reply.finding="Schmerzreduktion."; touchStep("E"); return ok(reply); }
    if (/lagerung/.test(low)) { reply.accepted=true; reply.evaluation="Patient gelagert."; touchStep("E"); return ok(reply); }

    // --- 3. VITALWERTE ---
    if (/spo2/.test(low)) { state.measurements.vitals.SpO2=true; state.measurements.vitals.Puls=true; updVitals({ SpO2: state.vitals.SpO2, Puls: state.vitals.Puls }); reply.accepted=true; reply.evaluation="Sensor am Finger."; touchStep("B"); return ok(reply); }
    if (/ekg/.test(low)) { state.measurements.vitals.Puls=true; updVitals({ Puls: state.vitals.Puls }); reply.accepted=true; reply.finding=H.ekg12||"Sinus"; reply.evaluation="12-Kanal EKG."; touchStep("C"); return ok(reply); }
    if (/rr|blutdruck/.test(low)) { state.measurements.vitals.RR=true; updVitals({ RR: state.vitals.RR }); reply.accepted=true; reply.evaluation="RR gemessen."; touchStep("C"); return ok(reply); }
    if (/puls/.test(low)) { state.measurements.vitals.Puls=true; updVitals({ Puls: state.vitals.Puls }); reply.accepted=true; reply.evaluation="Puls getastet."; touchStep("C"); return ok(reply); }
    if (/gcs/.test(low)) { state.measurements.vitals.GCS=true; updVitals({ GCS: state.vitals.GCS }); reply.accepted=true; reply.evaluation="GCS geprüft."; touchStep("D"); return ok(reply); }
    if (/bz/.test(low)) { state.measurements.vitals.BZ=true; updVitals({ BZ: state.vitals.BZ }); reply.accepted=true; reply.evaluation="BZ gemessen."; touchStep("D"); return ok(reply); }
    if (/temp/.test(low)) { state.measurements.vitals.Temp=true; updVitals({ Temp: state.vitals.Temp }); reply.accepted=true; reply.evaluation="Temp gemessen."; touchStep("E"); return ok(reply); }
    if (/af/.test(low)) { state.measurements.vitals.AF=true; updVitals({ AF: state.vitals.AF }); reply.accepted=true; reply.evaluation="AF gezählt."; touchStep("B"); return ok(reply); }

    // --- 4. SCHEMATA (FIX: Formatierung und Protokollierung) ---
    
    // 4S
    if (/4s info/.test(low)) {
        reply.accepted = true;
        const s = state.scene_4s || {};
        reply.finding = `<b>Sicherheit:</b> ${text(s.sicherheit)}<br><b>Szene:</b> ${text(s.szene)}<br><b>Support:</b> ${text(s.support_empfehlung)}`;
        return ok(reply);
    }
    if (/4s doku/.test(low)) { 
        reply.accepted = true; 
        const s = state.scene_4s || {};
        // Wir schreiben den Inhalt auch bei "Doku" in die evaluation/finding, damit es im Chat erscheint
        reply.evaluation = "4S dokumentiert.";
        reply.finding = `Sicherheit: ${text(s.sicherheit)} | Szene: ${text(s.szene)}`;
        return ok(reply); 
    }

    // SAMPLER (Kompakter)
    if (/sampler info/.test(low)) {
      reply.accepted = true;
      const s = state.anamnesis?.SAMPLER || {};
      // FIX: Kompaktere Darstellung ohne viele Absätze
      reply.finding = `
      <b>S:</b> ${text(s.S)}<br>
      <b>A:</b> ${text(s.A)}<br>
      <b>M:</b> ${text(s.M)}<br>
      <b>P:</b> ${text(s.P)}<br>
      <b>L:</b> ${text(s.L)}<br>
      <b>E:</b> ${text(s.E)}<br>
      <b>R:</b> ${text(s.R)}`;
      return ok(reply);
    }
    if (/sampler doku/.test(low)) { 
        reply.accepted=true; 
        reply.evaluation="SAMPLER dokumentiert."; 
        const s = state.anamnesis?.SAMPLER || {};
        reply.finding = `S: ${text(s.S)} | A: ${text(s.A)} | M: ${text(s.M)}`; // Short preview in chat
        return ok(reply); 
    }

    // BEFAST
    if (/befast info/.test(low)) {
        reply.accepted = true;
        reply.finding = `<b>Neurologischer Check:</b><br>${H.befast || "Keine Auffälligkeiten."}`;
        touchStep("D"); return ok(reply);
    }
    if (/befast doku/.test(low)) {
        reply.accepted = true;
        reply.evaluation = "BE-FAST dokumentiert.";
        reply.finding = H.befast || "o.B.";
        return ok(reply);
    }
    
    // NRS
    if (/schmerz info|nrs/.test(low)) {
        const p = H.pain || {};
        reply.finding = `<b>Schmerz:</b> NRS ${p.nrs || 0}/10<br>Ort: ${p.ort || '-'}`;
        reply.accepted = true; return ok(reply);
    }

    // --- 5. ORGA ---
    if (ua.includes("Verdachtsdiagnose")) { state.measurements.diagnosis = ua.split(":")[1]; reply.accepted = true; reply.evaluation="Verdacht notiert."; return ok(reply); }
    if (ua.includes("Übergabe:")) { state.measurements.handover_done = true; reply.accepted = true; reply.evaluation="Übergabe erfolgt."; return ok(reply); }

    if (/debrief|fall beenden/.test(low)) {
      reply.done = true;
      const stepsAll = ["X","A","B","C","D","E"];
      const missingSteps = stepsAll.filter(s => !state.steps_done.includes(s));
      const score = state.score;
      const userDx = (state.measurements.diagnosis || "").toLowerCase();
      const correctKeys = Array.isArray(H.diagnosis_keys) ? H.diagnosis_keys : [];
      const isDxCorrect = correctKeys.some(key => userDx.includes(key.toLowerCase()));

      let status = "✅ Bestanden";
      let summary = `<b>Erreichter Score: ${score}</b><br>`;
      
      if (missingSteps.length > 0) {
          status = "⚠️ Struktur lückenhaft";
          summary += `<br>❌ <b>Fehlende Phasen:</b> ${missingSteps.join(', ')}`;
      } else {
          summary += `<br>✅ <b>X-ABCDE:</b> Vollständig.`;
      }

      summary += `<br><br><b>Diagnose & Maßnahmen:</b>`;
      if (state.measurements.diagnosis) {
          summary += `<br>${isDxCorrect ? '✅' : '⚠️'} Diagnose: "${state.measurements.diagnosis}"`;
          if(!isDxCorrect && correctKeys.length) summary += ` (Erwartet: ${correctKeys.join(' / ')})`;
      } else summary += `<br>❌ Keine Diagnose.`;

      if (state.measurements.handover_done) summary += `<br>✅ Übergabe erfolgt.`;
      else summary += `<br>❌ Übergabe fehlte.`;

      reply.debrief = `<b>${status}</b><br>${summary}`;
      return ok(reply);
    }

    // Fallback
    reply.accepted = true; reply.evaluation = "Maßnahme registriert.";
    return ok(reply);

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};