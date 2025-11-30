/**
 * Netlify Function: case-step
 * (Fix: SAMPLER Complete & 4S Details visible)
 */
exports.handler = async (event) => {
  const headers = { "content-type": "application/json", "access-control-allow-origin": "*" };

  try {
    const body  = event.body ? JSON.parse(event.body) : {};
    const state = body.case_state || {};
    const ua    = String(body.user_action || "").trim();
    const low   = ua.toLowerCase();

    // --- 1. STATE INITIALISIERUNG (ROBUST) ---
    state.vitals     = state.vitals || {};
    state.steps_done = Array.isArray(state.steps_done) ? state.steps_done : [];
    state.history    = Array.isArray(state.history) ? state.history : [];
    state.score      = state.score || 0;
    
    // Sicherstellen, dass measurements existiert
    state.measurements = state.measurements || {};
    state.measurements.vitals = state.measurements.vitals || {};
    state.measurements.schemas = state.measurements.schemas || {};
    state.measurements.pain = state.measurements.pain || {};
    
    // Flags initialisieren
    if (state.measurements.iv_access === undefined) state.measurements.iv_access = false;
    if (state.measurements.handover_done === undefined) state.measurements.handover_done = false;
    if (state.measurements.o2_given === undefined) state.measurements.o2_given = false;
    if (state.measurements.immo_done === undefined) state.measurements.immo_done = false;
    if (state.measurements.bleeding_controlled === undefined) state.measurements.bleeding_controlled = false;

    // History Log
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
                const currentValStr = String(state.vitals[k] || baseVitals[k]).match(/\d+/)?.[0] || 0;
                const oldVal = parseFloat(currentValStr);
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
        const hasO2 = state.measurements.o2_given; 
        const curSpO2 = parseFloat(String(state.vitals.SpO2 || baseVitals.SpO2).match(/\d+/)?.[0]);
        reply.accepted = true; 
        
        if (curSpO2 < 93 && !hasO2) {
            const newSpO2 = Math.max(70, curSpO2 - 2);
            updVitals({ SpO2: newSpO2 });
            if (state.measurements.vitals?.SpO2) reply.finding = `⚠️ SpO₂ fällt auf ${newSpO2}% (dringender Handlungsbedarf!)`;
        } else if (hasO2 && curSpO2 < 88) {
            const newSpO2 = Math.max(84, curSpO2 - 1); 
            updVitals({ SpO2: newSpO2 });
            if (state.measurements.vitals?.SpO2) reply.finding = `⚠️ SpO₂ bleibt kritisch bei ${newSpO2}% trotz O₂-Gabe. Notarzt zwingend erforderlich!`;
        }
        return ok(reply);
    }

    // --- DEBRIEFING ---
    if (/debrief|fall beenden/.test(low)) {
        reply.done = true;
        
        const stepsAll = ["X","A","B","C","D","E"];
        const missingSteps = stepsAll.filter(s => !state.steps_done.includes(s));
        const score = state.score;
        const userDx = (state.measurements.diagnosis || "").toLowerCase();
        const correctKeys = Array.isArray(H.diagnosis_keys) ? H.diagnosis_keys : [];
        const isDxCorrect = correctKeys.some(key => userDx.includes(key.toLowerCase()));
        const hasHandover = state.measurements.handover_done;

        let status = missingSteps.length ? "⚠️ Struktur lückenhaft" : "✅ Bestanden";
        let summary = `<b>Erreichter Score: ${score}</b><br>`;
        
        let colorClass = { bg: '#fef3c7', border: '#fbbf24', text: '#92400e' }; // GELB

        const completionRate = (state.steps_done.length / stepsAll.length) * 100;
        
        if (completionRate >= 80 && isDxCorrect && hasHandover && score >= 4) {
            colorClass = { bg: '#f0fdf4', border: '#16a34a', text: '#14532d' }; // GRÜN
            status = "✅ Einsatz erfolgreich und strukturiert";
        } else if (completionRate < 50 || !hasHandover) {
            colorClass = { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' }; // ROT
            status = "❌ Kritische Mängel in Struktur und/oder Maßnahmen";
        }

        if (missingSteps.length > 0) summary += `<br>❌ <b>Fehlende Phasen:</b> ${missingSteps.join(', ')}`;
        else summary += `<br>✅ <b>X-ABCDE:</b> Vollständig abgearbeitet.`;

        summary += `<br><br><b>Diagnose & Maßnahmen:</b>`;
        summary += `<br>${isDxCorrect ? '✅' : '⚠️'} Diagnose: "${state.measurements.diagnosis || 'Keine'}"`;
        summary += hasHandover ? `<br>✅ Übergabe durchgeführt.` : `<br>❌ Keine Übergabe.`;

        reply.debrief = `
            <div style="background:${colorClass.bg}; border:2px solid ${colorClass.border}; padding:20px; border-radius:12px; margin-top:15px; color:${colorClass.text}; font-size: 1rem; line-height: 1.6;">
                <h3 style="margin-top:0; color:${colorClass.text};">🎓 Fall-Auswertung</h3>
                <p style="font-weight:bold;">${status}</p>
                ${summary}
            </div>
        `;
        return ok(reply);
    }
    
    // --- 2. MEDIZINISCHE AKTIONEN ---
    
    // Blutstillung
    if (/druckverband|tourniquet|beckenschlinge|hämostyptikum/.test(low)) {
        state.measurements.bleeding_controlled = true;
        reply.accepted = true; 
        reply.evaluation = `${ua} erfolgreich angelegt.`; 
        if (state.specialty === 'trauma') touchStep("C");
        return ok(reply); 
    }

    // X - Exsanguination
    if (/blutungscheck|x unauffällig/.test(low)) {
        reply.accepted = true; 
        touchStep("X");
        const initialBleeding = H.bleeding_info && !H.bleeding_info.includes("Keine");
        if (initialBleeding && state.measurements.bleeding_controlled) {
            reply.finding = `✅ Kritische Blutung ist dank eingeleiteter Massnahme kontrolliert. ${H.bleeding_info}`;
            reply.evaluation = "X: Kritische Blutung kontrolliert.";
        } else {
            reply.finding = H.bleeding_info || "Keine kritische Blutung sichtbar.";
            reply.evaluation = "X: Blutungscheck durchgeführt.";
        }
        return ok(reply);
    }

    // A - Airway
    if (/mund|rachen/.test(low)) {
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
        reply.accepted = true;
        touchStep("C"); 
        const isTrauma = state.specialty === 'trauma';
        if (isTrauma) {
            if (!state.measurements.immo_done) {
                reply.finding = `DMS eingeschränkt an betroffener Extremität (Initialbefund).`;
                reply.evaluation = "pDMS Initialbefund dokumentiert (C/E).";
            } else {
                reply.finding = `DMS ist nach Anlage der Schiene an der betroffenen Extremität erhalten.`;
                reply.evaluation = "pDMS-Kontrolle nach Immobilisation dokumentiert.";
            }
        } else {
            reply.finding = "DMS an allen Extremitäten intakt.";
            reply.evaluation = "pDMS geprüft.";
        }
        return ok(reply);
    }
    
    // Bodycheck
    if (low.includes('bodycheck') && !low.includes('(bild)')) {
        reply.accepted = true;
        touchStep("E");
        reply.evaluation = "Bodycheck durchgeführt.";
        const injuries = Array.isArray(H.injuries) ? H.injuries : [];
        if (injuries.length > 0) reply.finding = `⚠️ Verletzungen: ${injuries.join(', ')}.`;
        else reply.finding = `Keine weiteren Verletzungen sichtbar.`;
        return ok(reply);
    }
// --- NEUE TRAUMA-MAßNAHMEN (Chest Seal, Wunde, Augen) ---
    
    // Chest Seal (B)
    if (low.includes('chest seal')) {
        reply.accepted = true; 
        touchStep("B");
        if ((H.diagnosis_keys||[]).join(' ').toLowerCase().includes('pneumothorax') || (H.diagnosis_keys||[]).join(' ').toLowerCase().includes('offen')) {
            reply.evaluation = "✅ Chest Seal erfolgreich geklebt. Dyspnoe bessert sich leicht.";
            // SpO2 verbessern
             const curSpO2 = parseFloat(String(state.vitals.SpO2 || baseVitals.SpO2).match(/\d+/)?.[0] || 80);
             updVitals({ SpO2: Math.min(94, curSpO2 + 5) });
        } else {
            reply.evaluation = "Chest Seal geklebt (prophylaktisch).";
        }
        return ok(reply);
    }

    // Wundversorgung / Kühlen (E)
    if (low.includes('wundversorgung')) {
        reply.accepted = true; 
        touchStep("E");
        let msg = "Wunde steril abgedeckt / versorgt.";
        
        // Spezielle Reaktionen je nach Fall
        const dx = (H.diagnosis_keys||[]).join(' ').toLowerCase();
        if (dx.includes('verbrennung') || dx.includes('verätzung')) msg = "✅ Betroffene Stellen werden intensiv gekühlt/gespült.";
        if (dx.includes('eviszeration')) msg = "✅ Darmschlingen feucht & steril abgedeckt.";
        if (dx.includes('amputation')) msg = "✅ Amputat gesichert und gekühlt.";
        
        reply.evaluation = msg;
        return ok(reply);
    }

    // Augenversorgung (E)
    if (low.includes('augenversorgung')) {
        reply.accepted = true; 
        touchStep("E");
        let msg = "Augen geschützt.";
        const dx = (H.diagnosis_keys||[]).join(' ').toLowerCase();
        
        if (dx.includes('säure') || dx.includes('verätzung')) msg = "✅ Augen werden ausgiebig gespült.";
        if (dx.includes('auge') || dx.includes('perforation')) msg = "✅ Beide Augen steril abgedeckt (Ruhigstellung).";
        
        reply.evaluation = msg;
        return ok(reply);
    }
    // --- 3. INFOS & MAßNAHMEN ---
    
    if (/schmerz info/.test(low)) {
        reply.accepted = true; 
        const pain = H.pain || {};
        reply.finding = `<b>Schmerzinformation:</b><br>Ort: ${text(pain.ort)}<br>Charakter: ${text(pain.charakter)}`;
        return ok(reply);
    }
    if (/befast info/.test(low)) {
        reply.accepted = true; reply.finding = `<b>BE-FAST:</b><br>${H.befast || "Keine Auffälligkeiten."}`; return ok(reply);
    }
    
    // ** FIX 4S INFO **
    if (/4s info/.test(low)) {
        reply.accepted = true; 
        const s = state.scene_4s || {};
        reply.finding = `<b>4S:</b><br>Sicherheit: ${text(s.sicherheit)}<br>Szene: ${text(s.szene)}<br>Sichtung: ${text(s.sichtung_personen)}<br>Support: ${text(s.support_empfehlung)}`;
        return ok(reply);
    }
    if (/nexus info/.test(low)) {
        reply.accepted = true; reply.finding = `<b>NEXUS:</b><br>${(H.nexus_criteria || {}).summary || "Keine Info."}`; return ok(reply);
    }
    if (/polytrauma info/.test(low)) {
        reply.accepted = true; 
        const poly = H.polytrauma_criteria || {};
        reply.finding = `<b>Polytrauma-Faktoren:</b><br>Vit: ${text(poly.vitals)}<br>Ana: ${text(poly.anatomical)}<br>Mech: ${text(poly.mechanism)}`;
        return ok(reply);
    }

    // Maßnahmen
    if (/o2-gabe/.test(low)) {
        state.measurements.o2_given = true; 
        reply.accepted = true; reply.evaluation = `Sauerstoffgabe erfolgt: ${ua}`; touchStep("B");
        const curSpO2 = parseFloat(String(state.vitals.SpO2 || baseVitals.SpO2).match(/\d+/)?.[0] || 85);
        if (curSpO2 < 95) {
            const newSpO2 = Math.min(98, curSpO2 + 5); 
            updVitals({ SpO2: newSpO2 });
            reply.finding = `✅ SpO₂ steigt auf ${newSpO2}%`;
        }
        return ok(reply);
    }
    if (/oberkörper hoch/.test(low)) {
        reply.accepted = true; reply.evaluation="Oberkörper hochgelagert."; touchStep("E");
        const curSpO2 = parseFloat(String(state.vitals.SpO2 || baseVitals.SpO2).match(/\d+/)?.[0] || 90);
        if (curSpO2 < 96) {
            const newSpO2 = Math.min(98, curSpO2 + 2); 
            updVitals({ SpO2: newSpO2 });
            reply.finding = `✅ SpO₂ verbessert sich auf ${newSpO2}%.`;
        }
        return ok(reply);
    }
    if (/immobilisation:/.test(low)) {
        state.measurements.immo_done = true; 
        reply.accepted = true; reply.evaluation = "Immobilisation durchgeführt."; touchStep("E");
        reply.finding = "Hinweis: DMS-Kontrolle zwingend erforderlich!";
        return ok(reply);
    }
    
    // --- 4. DOKUMENTATION (FIXED) ---
    
    // ** FIX SAMPLER DOKU **
    if (/sampler doku/.test(low)) { 
        reply.accepted=true; 
        const s = state.anamnesis?.SAMPLER || {};
        reply.evaluation="SAMPLER dokumentiert:"; 
        // Hier fehlten P, L, E und R -> Jetzt hinzugefügt!
        reply.finding = `S: ${text(s.S)}<br>A: ${text(s.A)}<br>M: ${text(s.M)}<br>P: ${text(s.P)}<br>L: ${text(s.L)}<br>E: ${text(s.E)}<br>R: ${text(s.R)}`; 
        return ok(reply); 
    }
    
    // ** FIX 4S DOKU **
    if (/4s doku/.test(low)) { 
        reply.accepted = true; 
        const s = state.scene_4s || {};
        reply.evaluation = "4S dokumentiert.";
        // Hier fehlte die Ausgabe -> Jetzt hinzugefügt!
        reply.finding = `Sicherheit: ${text(s.sicherheit)}<br>Szene: ${text(s.szene)}<br>Sichtung: ${text(s.sichtung_personen)}<br>Support: ${text(s.support_empfehlung)}`;
        return ok(reply); 
    }

    if (/übergabe/.test(low)) { state.measurements.handover_done = true; reply.accepted = true; reply.evaluation="Übergabe erfolgt."; return ok(reply); }
    if (/verdachtsdiagnose/.test(low)) { state.measurements.diagnosis = ua.split(":")[1]; reply.accepted = true; reply.evaluation="Verdacht notiert."; return ok(reply); }

    // Fallbacks
    if (/zugang/.test(low)) { state.measurements.iv_access = true; reply.accepted=true; reply.evaluation="Zugang gelegt."; touchStep("C"); return ok(reply); }
    if (/notarzt/.test(low)) { reply.accepted=true; reply.evaluation="NA nachgefordert."; touchStep("C"); return ok(reply); }
    
    // VITALWERTE MESSEN
    if (/spo2/.test(low)) { 
        state.measurements.vitals.SpO2=true; 
        state.measurements.vitals.Puls=true; 
        updVitals({ SpO2: state.vitals.SpO2, Puls: state.vitals.Puls }); 
        reply.accepted=true; reply.evaluation="Sensor angelegt."; touchStep("B"); 
        return ok(reply); 
    }
    if (/ekg/.test(low)) { 
        state.measurements.vitals.Puls=true; 
        updVitals({ Puls: state.vitals.Puls }); 
        reply.accepted=true; reply.finding=H.ekg12||"Sinus"; reply.evaluation="EKG geschrieben."; touchStep("C"); 
        return ok(reply); 
    }
    if (/rr/.test(low)) { 
        state.measurements.vitals.RR=true; 
        updVitals({ RR: state.vitals.RR }); 
        reply.accepted=true; reply.evaluation="RR gemessen."; touchStep("C"); 
        return ok(reply); 
    }
    if (/puls/.test(low)) { 
        state.measurements.vitals.Puls=true; 
        updVitals({ Puls: state.vitals.Puls }); 
        reply.accepted=true; reply.evaluation="Puls getastet."; touchStep("C"); 
        return ok(reply); 
    }
    if (/temp/.test(low)) { 
        state.measurements.vitals.Temp=true; 
        updVitals({Temp: state.vitals.Temp}); 
        reply.accepted=true; reply.evaluation="Temp gemessen."; touchStep("E"); 
        return ok(reply); 
    }

    reply.accepted = true; reply.evaluation = "OK.";
    return ok(reply);

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};