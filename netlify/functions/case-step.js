/**
 * Netlify Function: case-step
 * (Final Medical Logic Repair)
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

    // --- 1. MEDIZINISCHE MAẞNAHMEN (XABCDE) ---
    
    // X - Exsanguination
    // WICHTIG: "Blutungscheck" ODER "X unauffällig" triggert Phase X
    if (low.includes('blutung') || low.includes('x unauffällig')) {
        reply.accepted = true; 
        // Holen der Info aus hidden.bleeding_info
        reply.finding = H.bleeding_info || "Keine kritische Blutung sichtbar.";
        reply.evaluation = "X: Blutungscheck durchgeführt.";
        touchStep("X"); // <--- HIER WIRD DAS KREUZCHEN GESETZT
        return ok(reply);
    }
    if (/tourniquet|abbinden/.test(low)) {
        reply.accepted = true; reply.evaluation = "Tourniquet angelegt (Zeit notiert)."; 
        reply.finding = "Blutung steht."; touchStep("X"); return ok(reply);
    }
    if (/druckverband/.test(low)) {
        reply.accepted = true; reply.evaluation = "Druckverband angelegt."; 
        reply.finding = "Blutung kontrolliert."; touchStep("X"); return ok(reply);
    }

    // A - Airway
    if (/mund/.test(low) || /rachen/.test(low)) {
        reply.accepted = true; 
        reply.finding = H.mouth || "Mundraum frei.";
        reply.evaluation = "A: Mundraum inspiziert.";
        touchStep("A"); return ok(reply);
    }
    if (/absaugen/.test(low)) {
        reply.accepted = true; reply.evaluation = "Atemwege abgesaugt."; 
        reply.finding = "Weg wieder frei."; touchStep("A"); return ok(reply);
    }
    if (/guedel|wendel|esmarch/.test(low)) {
        reply.accepted = true; reply.evaluation = "Atemwegshilfe eingelegt/angewendet."; 
        reply.finding = "Atemweg gesichert."; touchStep("A"); return ok(reply);
    }

    // B - Breathing
    if (/auskultieren|lunge|abhören/.test(low)) {
        reply.accepted = true; 
        reply.finding = H.lung || "Vesikuläratmen bds., keine RG.";
        reply.evaluation = "B: Lunge auskultiert.";
        touchStep("B"); return ok(reply);
    }
    if (ua.includes('O2-Gabe')) {
      const flow = parseInt(ua.match(/\d+/)?.[0] || 0);
      const cur = parseFloat(String(state.vitals.SpO2 || 96).match(/\d+/)?.[0]);
      updVitals({ SpO2: Math.min(100, cur + (flow * 1.5)) });
      reply.accepted = true; reply.evaluation = `O2: ${flow}l/min`; reply.finding = "SpO2 steigt."; touchStep("B"); return ok(reply);
    }
    if (/beatmung|beutel/.test(low)) {
        reply.accepted = true; reply.evaluation = "Beatmung gestartet."; 
        reply.finding = "Thorax hebt sich."; touchStep("B"); return ok(reply);
    }

    // C - Circulation
    if (/zugang/.test(low)) { state.measurements.iv_access = true; reply.accepted=true; reply.evaluation="i.V. Zugang liegt."; touchStep("C"); return ok(reply); }
    if (/volumen/.test(low)) { 
        if(!state.measurements.iv_access) { reply.accepted=false; reply.finding="Kein Zugang!"; return ok(reply); }
        reply.accepted=true; reply.evaluation="Infusion läuft."; touchStep("C"); return ok(reply); 
    }
    if (/notarzt/.test(low)) { reply.accepted=true; reply.evaluation="NA alarmiert."; touchStep("C"); return ok(reply); }
    if (/reanimation|cpr|drücken/.test(low)) { reply.accepted=true; reply.evaluation="CPR gestartet (30:2)."; touchStep("C"); return ok(reply); }

    // D - Disability
    if (/pupillen/.test(low)) {
        reply.accepted = true;
        reply.finding = H.pupils || "Isokor, mittelweit, lichtreagibel."; // <--- HIER WAR DAS PROBLEM
        reply.evaluation = "D: Pupillenkontrolle.";
        touchStep("D"); return ok(reply);
    }
    if (/gcs/.test(low)) { state.measurements.vitals.GCS = true; updVitals({ GCS: state.vitals.GCS || 15 }); reply.accepted=true; reply.evaluation="GCS erhoben."; touchStep("D"); return ok(reply); }
    if (/bz/.test(low)) { state.measurements.vitals.BZ = true; updVitals({BZ: state.vitals.BZ || 100}); reply.accepted=true; reply.evaluation="BZ gemessen."; touchStep("D"); return ok(reply); }

    // E - Exposure / Other
    if (/bodycheck/.test(low)) { 
        reply.accepted=true; 
        let info = H.skin || "Haut unauffällig.";
        if(H.injuries && H.injuries.length > 0) info += " Verletzungen: " + H.injuries.join(', ');
        reply.finding = info; 
        reply.evaluation="E: Bodycheck durchgeführt."; touchStep("E"); return ok(reply); 
    }
    if (/immobilisation|schiene|stifneck/.test(low)) { 
        reply.accepted=true; reply.evaluation="Immobilisation durchgeführt."; 
        reply.finding = "Patient stabilisiert, Schmerz etwas gebessert."; touchStep("E"); return ok(reply); 
    }
    if (/wärme|decke/.test(low)) { reply.accepted=true; reply.evaluation="Wärmeerhalt (Decke)."; touchStep("E"); return ok(reply); }
    if (/lagerung|oberkörper/.test(low)) { reply.accepted=true; reply.evaluation="Patient gelagert."; touchStep("E"); return ok(reply); }


    // --- 2. VITALWERTE (Messen & Anzeigen) ---
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
    if (/temp/.test(low)) { state.measurements.vitals.Temp = true; updVitals({Temp: state.vitals.Temp || 36.5}); reply.accepted=true; reply.evaluation="Temp gemessen."; touchStep("E"); return ok(reply); }
    if (/af/.test(low)) { state.measurements.vitals.AF = true; updVitals({AF: state.vitals.AF || 14}); reply.accepted=true; reply.evaluation="AF gezählt."; touchStep("B"); return ok(reply); }


    // --- 3. SCHEMATA ---
    if (/sampler info/.test(low)) {
      const s = state.anamnesis?.SAMPLER || {};
      reply.finding = `S: ${text(s.S)}\nA: ${text(s.A)}\nM: ${text(s.M)}\nP: ${text(s.P)}\nL: ${text(s.L)}\nE: ${text(s.E)}\nR: ${text(s.R)}`;
      reply.accepted = true; return ok(reply);
    }
    if (/befast info/.test(low)) { reply.finding = H.befast || "o.B."; reply.accepted = true; return ok(reply); }
    if (/schmerz info/.test(low)) { const p = H.pain || {}; reply.finding = `NRS ${p.nrs||0}`; reply.accepted=true; return ok(reply); }
    if (/4s info/.test(low)) { const s = state.scene_4s || {}; reply.finding = `Sicherheit: ${s.sicherheit}`; reply.accepted=true; return ok(reply); }
    
    // Dokumentation
    if (/doku/.test(low)) { reply.accepted=true; reply.evaluation="Dokumentiert."; return ok(reply); }


    // --- 4. ORGANISATION (Diagnose, Übergabe, Debriefing) ---
    if (ua.includes("Verdachtsdiagnose")) { state.measurements.diagnosis = ua.split(":")[1]; reply.accepted = true; reply.evaluation="Diagnose notiert."; return ok(reply); }
    
    // FIX ÜBERGABE:
    // Der String im Frontend heißt "Übergabe: SINNHAFT: ..." -> Wir suchen nach "übergabe"
    if (low.includes("übergabe") && !low.includes("fehlt")) { 
        state.measurements.handover_done = true; 
        reply.accepted = true; 
        reply.evaluation="Übergabe an Klinik/Arzt erfolgt."; 
        return ok(reply); 
    }

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
          summary += `<br>✅ <b>X-ABCDE:</b> Vollständig abgearbeitet.`;
      }

      summary += `<br><br><b>Diagnose & Maßnahmen:</b>`;
      if (state.measurements.diagnosis) {
          summary += `<br>${isDxCorrect ? '✅' : '⚠️'} Diagnose: "${state.measurements.diagnosis}"`;
      } else {
          summary += `<br>❌ Keine Diagnose gestellt.`;
      }

      if (state.measurements.handover_done) summary += `<br>✅ Übergabe durchgeführt.`;
      else summary += `<br>❌ Keine Übergabe an den Arzt.`;

      reply.debrief = `<b>${status}</b><br>${summary}`;
      return ok(reply);
    }

    // --- FALLBACK ---
    reply.accepted = true; reply.evaluation = "Maßnahme registriert.";
    return ok(reply);

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};