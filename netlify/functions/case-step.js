/**
 * Netlify Function: case-step
 * (Content-Rich Processor: Fetches detailed strings from case-new)
 */
exports.handler = async (event) => {
  const headers = { "content-type": "application/json", "access-control-allow-origin": "*" };

  try {
    const body  = event.body ? JSON.parse(event.body) : {};
    const state = body.case_state || {};
    const ua    = String(body.user_action || "").trim();
    const low   = ua.toLowerCase();

    // Init State & History
    state.vitals     = state.vitals || {};
    state.steps_done = Array.isArray(state.steps_done) ? state.steps_done : [];
    state.history    = Array.isArray(state.history) ? state.history : [];
    state.score      = state.score || 0;
    state.measurements = state.measurements || { vitals: {}, schemas: {}, pain: {}, diagnosis: null, iv_access: false, handover_done: false };
    
    if (ua && !low.includes('debriefing')) {
      state.history.push({ ts: new Date().toISOString(), action: ua });
      if (state.history.length > 60) state.history.shift();
    }

    const reply = { accepted: false, updated_vitals: {}, done: false, case_state: state };
    const H = state.hidden || {}; // Hier stehen die DETAILS drin!
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
    const touchStep = (l) => { if(!state.steps_done.includes(l.toUpperCase())) { state.steps_done.push(l.toUpperCase()); state.score+=1; } };
    function ok(body) { return { statusCode: 200, headers, body: JSON.stringify(body) }; }

    // --- 0. SYSTEM ---
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

    // --- 1. MEDIZINISCHE UNTERSUCHUNGEN (DETAILS LADEN) ---
    
    // X - Blutung
    if (/blutung/.test(low) && /check|suchen/.test(low)) {
        reply.accepted = true; 
        reply.finding = H.bleeding_info || "Keine kritischen Blutungen erkennbar."; // <--- DETAIL
        reply.evaluation = "X: Blutungscheck durchgeführt.";
        touchStep("X"); return ok(reply);
    }
    
    // A - Mund/Rachen
    if (/mund/.test(low) || /rachen/.test(low)) {
        reply.accepted = true; 
        reply.finding = H.mouth || "Mundraum frei, keine Hindernisse."; // <--- DETAIL
        reply.evaluation = "A: Mundraum inspiziert.";
        touchStep("A"); return ok(reply);
    }
    if (/absaugen/.test(low)) { reply.accepted=true; reply.finding="Sekret entfernt, Atemweg frei."; reply.evaluation="Abgesaugt."; touchStep("A"); return ok(reply); }

    // B - Lunge
    if (/auskultieren|lunge|abhören/.test(low)) {
        reply.accepted = true; 
        reply.finding = H.lung || "Vesikuläres Atemgeräusch, seitengleich."; // <--- DETAIL
        reply.evaluation = "B: Auskultation durchgeführt.";
        touchStep("B"); return ok(reply);
    }
    
    // E - Bodycheck / Haut / Pupillen
    if (/bodycheck/.test(low)) {
        reply.accepted = true;
        let info = H.skin || "Haut unauffällig.";
        if(H.injuries && H.injuries.length > 0) info += " Verletzungen: " + H.injuries.join(', ');
        reply.finding = info; // <--- DETAIL
        reply.evaluation = "E: Ganzkörperuntersuchung.";
        touchStep("E"); return ok(reply);
    }
    if (/pupillen/.test(low)) {
        reply.accepted = true;
        reply.finding = H.pupils || "Isokor, mittelweit, lichtreagibel."; // <--- DETAIL
        reply.evaluation = "D: Pupillenkontrolle.";
        touchStep("D"); return ok(reply);
    }

    // --- 2. MAẞNAHMEN (Therapie) ---
    if (ua.includes('O2-Gabe')) {
      const flow = parseInt(ua.match(/\d+/)?.[0] || 0);
      const cur = parseFloat(String(state.vitals.SpO2 || 96).match(/\d+/)?.[0]);
      updVitals({ SpO2: Math.min(100, cur + (flow * 1.5)) });
      reply.accepted = true; reply.evaluation = `O2-Gabe: ${flow} l/min.`; reply.finding = "Sättigungstrend steigend."; touchStep("B"); return ok(reply);
    }
    if (/tourniquet/.test(low)) { reply.accepted=true; reply.evaluation="Tourniquet angelegt."; reply.finding="Blutung gestoppt."; touchStep("X"); return ok(reply); }
    if (/druckverband/.test(low)) { reply.accepted=true; reply.evaluation="Druckverband sitzt."; touchStep("X"); return ok(reply); }
    if (/zugang/.test(low)) { state.measurements.iv_access=true; reply.accepted=true; reply.evaluation="PVZ gelegt (Grün/Weiß)."; touchStep("C"); return ok(reply); }
    if (/volumen/.test(low)) { 
        if(!state.measurements.iv_access) { reply.accepted=false; reply.finding="Kein Zugang!"; return ok(reply); }
        reply.accepted=true; reply.evaluation="500ml Vollelektrolytlösung laufen."; touchStep("C"); return ok(reply); 
    }
    if (/notarzt/.test(low)) { reply.accepted=true; reply.evaluation="NEF nachgefordert."; reply.finding="Leitstelle bestätigt."; touchStep("C"); return ok(reply); }
    if (/immobilisation|schiene/.test(low)) { reply.accepted=true; reply.evaluation="Immobilisation erfolgt."; reply.finding="Schmerzreduktion durch Ruhigstellung."; touchStep("E"); return ok(reply); }
    if (/lagerung|oberkörper/.test(low)) { reply.accepted=true; reply.evaluation="Oberkörper hochgelagert."; reply.finding="Atmung erleichtert."; touchStep("E"); return ok(reply); }

    // --- 3. VITALWERTE (Messen) ---
    if (/spo2/.test(low)) { state.measurements.vitals.SpO2=true; state.measurements.vitals.Puls=true; updVitals({ SpO2: state.vitals.SpO2, Puls: state.vitals.Puls }); reply.accepted=true; reply.evaluation="Sensor am Finger."; touchStep("B"); return ok(reply); }
    if (/ekg/.test(low)) { state.measurements.vitals.Puls=true; updVitals({ Puls: state.vitals.Puls }); reply.accepted=true; reply.finding=H.ekg12||"Sinus"; reply.evaluation="12-Kanal EKG."; touchStep("C"); return ok(reply); }
    if (/rr|blutdruck/.test(low)) { state.measurements.vitals.RR=true; updVitals({ RR: state.vitals.RR }); reply.accepted=true; reply.evaluation="Manschette misst..."; touchStep("C"); return ok(reply); }
    if (/puls/.test(low)) { state.measurements.vitals.Puls=true; updVitals({ Puls: state.vitals.Puls }); reply.accepted=true; reply.evaluation="Puls getastet."; touchStep("C"); return ok(reply); }
    if (/gcs/.test(low)) { state.measurements.vitals.GCS=true; updVitals({ GCS: state.vitals.GCS }); reply.accepted=true; reply.evaluation="GCS geprüft."; touchStep("D"); return ok(reply); }
    if (/bz/.test(low)) { state.measurements.vitals.BZ=true; updVitals({ BZ: state.vitals.BZ }); reply.accepted=true; reply.evaluation="BZ-Stix."; touchStep("D"); return ok(reply); }
    if (/temp/.test(low)) { state.measurements.vitals.Temp=true; updVitals({ Temp: state.vitals.Temp }); reply.accepted=true; reply.evaluation="Thermometer im Ohr."; touchStep("E"); return ok(reply); }
    if (/af/.test(low)) { state.measurements.vitals.AF=true; updVitals({ AF: state.vitals.AF }); reply.accepted=true; reply.evaluation="Atemzüge ausgezählt."; touchStep("B"); return ok(reply); }

    // --- 4. SCHEMATA (4S, SAMPLER, BEFAST) - DETAILREICH ---
    
    // 4S
    if (/4s info/.test(low)) {
        reply.accepted = true;
        const s = state.scene_4s || {};
        // Wir bauen einen schönen HTML-String für das Frontend
        reply.finding = `
        <b>Sicherheit:</b> ${text(s.sicherheit)}<br>
        <b>Szene:</b> ${text(s.szene)}<br>
        <b>Sichtung:</b> ${text(s.sichtung_personen)}<br>
        <b>Support:</b> ${text(s.support_empfehlung)}`;
        return ok(reply);
    }
    if (/4s doku/.test(low)) { reply.accepted=true; reply.evaluation="4S dokumentiert."; return ok(reply); }

    // SAMPLER
    if (/sampler info/.test(low)) {
      reply.accepted = true;
      const s = state.anamnesis?.SAMPLER || {};
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
    if (/sampler doku/.test(low)) { reply.accepted=true; reply.evaluation="SAMPLER dokumentiert."; return ok(reply); }

    // BEFAST
    if (/befast info/.test(low)) {
        reply.accepted = true;
        reply.finding = `<b>Neurologischer Check:</b><br>${H.befast || "Keine Auffälligkeiten."}`;
        touchStep("D"); return ok(reply);
    }
    
    // SCHMERZ
    if (/schmerz info|nrs/.test(low)) {
        const p = H.pain || {};
        reply.finding = `<b>Schmerzanamnese:</b><br>Stärke: NRS ${p.nrs || 0}/10<br>Ort: ${p.ort || '-'}<br>Charakter: ${p.charakter || '-'}`;
        reply.accepted = true; return ok(reply);
    }

    // --- 5. ORGA (Debriefing, Übergabe) ---
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

      let status = missingSteps.length ? "⚠️ Struktur lückenhaft" : "✅ Bestanden";
      let summary = `<b>Erreichter Score: ${score}</b><br>`;
      
      if (missingSteps.length) summary += `<br>❌ <b>Fehlende Phasen:</b> ${missingSteps.join(', ')}`;
      else summary += `<br>✅ <b>X-ABCDE:</b> Vollständig.`;

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