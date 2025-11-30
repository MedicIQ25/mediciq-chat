/**
 * Netlify Function: case-step
 * (Fix: O2 Logic, Full Protocol Output, Formatted Strings)
 */
exports.handler = async (event) => {
  const headers = { "content-type": "application/json", "access-control-allow-origin": "*" };

  try {
    const body  = event.body ? JSON.parse(event.body) : {};
    const state = body.case_state || {};
    const ua    = String(body.user_action || "").trim();
    const low   = ua.toLowerCase();

    // Init
    state.vitals = state.vitals || {};
    state.steps_done = Array.isArray(state.steps_done) ? state.steps_done : [];
    state.history = Array.isArray(state.history) ? state.history : [];
    state.score = state.score || 0;
    state.measurements = state.measurements || { vitals: {}, schemas: {}, pain: {}, diagnosis: null, iv_access: false, handover_done: false };
    
    // History (ohne Debriefing commands)
    if (ua && !low.includes('debriefing')) {
      state.history.push({ ts: new Date().toISOString(), action: ua });
      if (state.history.length > 60) state.history.shift();
    }

    const reply = { accepted: false, updated_vitals: {}, done: false, case_state: state };
    const H = state.hidden || {};
    const baseVitals = H.vitals_baseline || { SpO2: 96, RR: "120/80", AF: 14, Puls: 80 };

    const updVitals = (obj) => {
      for (const k in obj) {
        state.vitals[k] = obj[k];
        if (state.measurements.vitals[k]) {
            if (k === 'RR') reply.updated_vitals[k] = obj[k]; 
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
    const touchStep = (l) => { if(!state.steps_done.includes(l.toUpperCase())) { state.steps_done.push(l.toUpperCase()); state.score+=1; } };
    function ok(body) { return { statusCode: 200, headers, body: JSON.stringify(body) }; }

    // --- SYSTEM ---
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

    // --- O2 GABE (FIXED) ---
    if (ua.includes('O2-Gabe')) {
      // Wir suchen ALLE Zahlen vor "l/min"
      const matches = ua.match(/(\d+)\s*l\/min/g);
      let flow = 0;
      if (matches && matches.length > 0) {
          // Wir nehmen den LETZTEN Treffer (das ist die User-Eingabe am Ende des Strings)
          // String ist z.B.: "O2-Gabe: Maske (10-15 l/min) mit 12 l/min"
          // Matches sind: "15 l/min", "12 l/min". Wir wollen die 12.
          const lastMatch = matches[matches.length - 1];
          flow = parseInt(lastMatch.match(/\d+/)[0]);
      }
      
      const cur = parseFloat(String(state.vitals.SpO2 || 96).match(/\d+/)?.[0]);
      updVitals({ SpO2: Math.min(100, cur + (flow * 1.5)) });
      
      reply.accepted = true; 
      reply.evaluation = `O2-Gabe: ${flow} l/min.`; 
      reply.finding = "Sättigungstrend steigend."; 
      touchStep("B"); 
      return ok(reply);
    }

    // --- SCHEMATA (FIX: INHALTE ANZEIGEN) ---
    
    // 4S
    if (/4s info/.test(low)) {
        reply.accepted = true;
        const s = state.scene_4s || {};
        reply.finding = `<b>Sicherheit:</b> ${text(s.sicherheit)}<br><b>Szene:</b> ${text(s.szene)}<br><b>Sichtung:</b> ${text(s.sichtung_personen)}<br><b>Support:</b> ${text(s.support_empfehlung)}`;
        return ok(reply);
    }
    if (/4s doku/.test(low)) { 
        reply.accepted = true; 
        const s = state.scene_4s || {};
        // Wir senden den Inhalt zurück ins Protokoll
        reply.evaluation = "4S dokumentiert:";
        reply.finding = `Sicherheit: ${text(s.sicherheit)}<br>Szene: ${text(s.szene)}<br>Lage: ${text(s.sichtung_personen)}`;
        return ok(reply); 
    }

    // SAMPLER
    if (/sampler info/.test(low)) {
      reply.accepted = true;
      const s = state.anamnesis?.SAMPLER || {};
      // Formatiert für das Modal
      reply.finding = `S: ${text(s.S)}<br>A: ${text(s.A)}<br>M: ${text(s.M)}<br>P: ${text(s.P)}<br>L: ${text(s.L)}<br>E: ${text(s.E)}<br>R: ${text(s.R)}`;
      return ok(reply);
    }
    if (/sampler doku/.test(low)) { 
        reply.accepted=true; 
        const s = state.anamnesis?.SAMPLER || {};
        reply.evaluation="SAMPLER dokumentiert:"; 
        // Kompakt für den Chat
        reply.finding = `S: ${text(s.S)}<br>A: ${text(s.A)}<br>M: ${text(s.M)}<br>P: ${text(s.P)}<br>E: ${text(s.E)}`; 
        return ok(reply); 
    }

    // BEFAST
    if (/befast info/.test(low)) {
        reply.accepted = true;
        reply.finding = H.befast || "Unauffällig.";
        touchStep("D"); return ok(reply);
    }
    if (/befast doku/.test(low)) {
        reply.accepted = true;
        reply.evaluation = "BE-FAST dokumentiert:";
        reply.finding = H.befast || "o.B.";
        return ok(reply);
    }
    
    // NRS
    if (/schmerz info/.test(low)) {
        const p = H.pain || {};
        reply.finding = `NRS ${p.nrs || 0}/10 (${p.ort || '-'})`;
        reply.accepted = true; return ok(reply);
    }
    if (/nrs/.test(low)) {
        // Wenn der User einen Wert sendet "NRS 5"
        reply.accepted = true;
        reply.evaluation = "Schmerz dokumentiert:";
        reply.finding = ua; // Zeigt den Wert an
        return ok(reply);
    }

    // --- VITALWERTE & ACTIONS ---
    if (/blutung/.test(low)) { reply.accepted=true; reply.finding=H.bleeding_info||"Keine kritische Blutung."; reply.evaluation="X: Blutungscheck."; touchStep("X"); return ok(reply); }
    if (/mund/.test(low)) { reply.accepted=true; reply.finding=H.mouth||"Frei."; reply.evaluation="A: Mundraum."; touchStep("A"); return ok(reply); }
    if (/lunge/.test(low)) { reply.accepted=true; reply.finding=H.lung||"o.B."; reply.evaluation="B: Auskultation."; touchStep("B"); return ok(reply); }
    
    // pDMS (FIX: Echter Text)
    if (/pdms/.test(low)) {
        reply.accepted = true;
        reply.evaluation = "pDMS geprüft:";
        let finding = "DMS an allen Extremitäten intakt.";
        if (state.specialty === 'trauma') {
            const loc = H.injury_map?.[0] || "betroffener Stelle";
            finding = `DMS an ${loc} schmerzbedingt eingeschränkt, aber Durchblutung erhalten.`;
        } else if (state.specialty === 'neurologisch' && H.befast && !H.befast.includes('ohne')) {
            finding = "Motorik/Sensibilität einseitig reduziert.";
        }
        reply.finding = finding;
        touchStep("E"); 
        return ok(reply);
    }

    if (/spo2/.test(low)) { state.measurements.vitals.SpO2=true; state.measurements.vitals.Puls=true; updVitals({ SpO2: state.vitals.SpO2, Puls: state.vitals.Puls }); reply.accepted=true; reply.evaluation="Sensor dran."; touchStep("B"); return ok(reply); }
    if (/ekg/.test(low)) { state.measurements.vitals.Puls=true; updVitals({ Puls: state.vitals.Puls }); reply.accepted=true; reply.finding=H.ekg12||"Sinus"; reply.evaluation="12-Kanal EKG."; touchStep("C"); return ok(reply); }
    if (/rr/.test(low)) { state.measurements.vitals.RR=true; updVitals({ RR: state.vitals.RR }); reply.accepted=true; reply.evaluation="RR gemessen."; touchStep("C"); return ok(reply); }
    if (/puls/.test(low)) { state.measurements.vitals.Puls=true; updVitals({ Puls: state.vitals.Puls }); reply.accepted=true; reply.evaluation="Puls getastet."; touchStep("C"); return ok(reply); }
    if (/bz/.test(low)) { state.measurements.vitals.BZ=true; updVitals({ BZ: state.vitals.BZ }); reply.accepted=true; reply.evaluation="BZ gemessen."; touchStep("D"); return ok(reply); }
    if (/temp/.test(low)) { state.measurements.vitals.Temp=true; updVitals({ Temp: state.vitals.Temp }); reply.accepted=true; reply.evaluation="Temp gemessen."; touchStep("E"); return ok(reply); }
    
    // Fallbacks für Maßnahmen
    if (/zugang/.test(low)) { state.measurements.iv_access=true; reply.accepted=true; reply.evaluation="Zugang gelegt."; touchStep("C"); return ok(reply); }
    if (/volumen/.test(low)) { reply.accepted=true; reply.evaluation="Infusion läuft."; touchStep("C"); return ok(reply); }
    if (/notarzt/.test(low)) { reply.accepted=true; reply.evaluation="NA nachgefordert."; touchStep("C"); return ok(reply); }
    if (/immobilisation/.test(low)) { reply.accepted=true; reply.evaluation="Immobilisiert."; touchStep("E"); return ok(reply); }
    if (/bodycheck/.test(low)) { reply.accepted=true; reply.finding=H.skin||"o.B."; reply.evaluation="Bodycheck."; touchStep("E"); return ok(reply); }

    // Orga
    if (ua.includes("Verdachtsdiagnose")) { state.measurements.diagnosis = ua.split(":")[1]; reply.accepted = true; reply.evaluation="Verdacht notiert."; return ok(reply); }
    if (ua.includes("Übergabe:")) { state.measurements.handover_done = true; reply.accepted = true; reply.evaluation="Übergabe erfolgt."; return ok(reply); }

    if (/debrief|fall beenden/.test(low)) {
      reply.done = true;
      const stepsAll = ["X","A","B","C","D","E"];
      const missingSteps = stepsAll.filter(s => !state.steps_done.includes(s));
      const isDxCorrect = (state.hidden?.diagnosis_keys||[]).some(k => (state.measurements.diagnosis||"").toLowerCase().includes(k.toLowerCase()));
      
      let summary = `Score: ${state.score}. `;
      if (missingSteps.length) summary += `Fehlende Phasen: ${missingSteps.join(', ')}. `;
      else summary += `Struktur OK. `;
      
      if(state.measurements.diagnosis) summary += `<br>Diagnose: ${state.measurements.diagnosis} (${isDxCorrect?'Richtig':'Falsch'})`;
      else summary += `<br>Keine Diagnose.`;

      reply.debrief = summary;
      return ok(reply);
    }

    reply.accepted = true; reply.evaluation = "OK.";
    return ok(reply);

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};