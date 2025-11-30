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
    // Hinzugefügt: bleeding_controlled Flag zur Verfolgung der Blutstillung
    state.measurements = state.measurements || { vitals: {}, schemas: {}, pain: {}, diagnosis: null, iv_access: false, handover_done: false, o2_given: false, immo_done: false, bleeding_controlled: false };
    
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
                // Konvertierung des aktuellen Werts
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

    // --- 0. SYSTEM CHECK (FIX: Verbesserte Verschlechterung) ---
    if (ua.includes("System-Check")) {
        const hasO2 = state.measurements.o2_given; 
        const curSpO2 = parseFloat(String(state.vitals.SpO2 || baseVitals.SpO2).match(/\d+/)?.[0]);
        reply.accepted = true; 
        
        // Verschlechterung, wenn SpO2 niedrig ist UND noch kein O2 gegeben wurde
        if (curSpO2 < 93 && !hasO2) {
            // Reduziere SpO2 weiter
            const newSpO2 = Math.max(70, curSpO2 - 2);
            updVitals({ SpO2: newSpO2 });
            // Zeige Warnung nur, wenn der Wert gemessen wird
            if (state.measurements.vitals?.SpO2) reply.finding = `⚠️ SpO₂ fällt auf ${newSpO2}% (dringender Handlungsbedarf!)`;
        } 
        // ACHTUNG: Auch wenn O2 gegeben wurde, kann sich der Zustand verschlechtern (z.B. schweres Asthma)
        else if (hasO2 && curSpO2 < 88) {
            // Wenn der Wert niedrig bleibt, sinkt er trotzdem weiter, aber langsamer
            const newSpO2 = Math.max(84, curSpO2 - 1); 
            updVitals({ SpO2: newSpO2 });
            if (state.measurements.vitals?.SpO2) reply.finding = `⚠️ SpO₂ bleibt kritisch bei ${newSpO2}% trotz O₂-Gabe. Notarzt zwingend erforderlich!`;
        }
        
        return ok(reply);
    }

    // --- DEBRIEFING LOGIK (FIX: Farbcodes für Bewertung) ---
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
    
    // --- NEUE FARB-LOGIK ---
    let colorClass = { bg: '#fef3c7', border: '#fbbf24', text: '#92400e' }; // GELB (Standard: Mittel)

    const completionRate = (state.steps_done.length / stepsAll.length) * 100;
    
    if (completionRate >= 80 && isDxCorrect && hasHandover && score >= 4) {
        // GRÜN: Gute Struktur, korrekte Diagnose und Übergabe
        colorClass = { bg: '#f0fdf4', border: '#16a34a', text: '#14532d' };
        status = "✅ Einsatz erfolgreich und strukturiert";
    } else if (completionRate < 50 || !hasHandover) {
        // ROT: Schlechte Struktur, oder keine Übergabe/kritische Schritte fehlen
        colorClass = { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' };
        status = "❌ Kritische Mängel in Struktur und/oder Maßnahmen";
    }
    // Andernfalls bleibt es GELB (mit Lücken oder falscher Diagnose)
    // --- ENDE FARB-LOGIK ---

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

    // Sende die Farbcodes mit der Antwort
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
    
    // Massnahmen zur Blutstillung (FIX: Setzt das Flag bleeding_controlled)
    if (low.includes('druckverband') || low.includes('tourniquet') || low.includes('beckenschlinge') || low.includes('hämostyptikum')) {
        state.measurements.bleeding_controlled = true;
        reply.accepted = true; 
        reply.evaluation = `${ua} erfolgreich angelegt.`; 
        // Bei Trauma sollte nach Blutstillung C berührt werden.
        if (state.specialty === 'trauma') touchStep("C");
        return ok(reply); 
    }

    // X - Exsanguination (FIX: Passt Befund an, wenn Blutung kontrolliert ist)
    if (low.includes('blutungscheck') || low.includes('x unauffällig')) {
        reply.accepted = true; 
        touchStep("X");
        
        // Prüfe, ob eine Blutung im Fall hinterlegt ist
        const initialBleeding = H.bleeding_info && H.bleeding_info !== "Keine kritische Blutung sichtbar.";

        if (initialBleeding && state.measurements.bleeding_controlled) {
            // Wenn Blutung da war, aber Massnahme ergriffen wurde
            reply.finding = `✅ Kritische Blutung ist dank eingeleiteter Massnahme kontrolliert. ${H.bleeding_info}`;
            reply.evaluation = "X: Kritische Blutung ist unter Kontrolle.";
        } else {
            // Normaler/Initialer Befund
            reply.finding = H.bleeding_info || "Keine kritische Blutung sichtbar.";
            reply.evaluation = "X: Blutungscheck durchgeführt.";
        }
        return ok(reply);
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
    // E - Exposure / pDMS (FIX: Unterscheidung vor/nach Schienung)
    if (/pdms/.test(low)) {
        reply.accepted = true;
        let finding;
        let evaluation;
        
        const isTrauma = state.specialty === 'trauma';
        const immoDone = state.measurements.immo_done; // Prüfe, ob geschient wurde

        if (isTrauma) {
            if (!immoDone) {
                // Prüfung vor Schienung (Anfangsbefund)
                finding = `DMS eingeschränkt an betroffener Extremität (Initialbefund).`;
                evaluation = "pDMS Initialbefund dokumentiert (C/E).";
            } else {
                // Prüfung nach Schienung
                finding = `DMS ist nach Anlage der Schiene an der betroffenen Extremität erhalten.`;
                evaluation = "pDMS-Kontrolle nach Immobilisation dokumentiert.";
            }
        } else {
            // Normaler Fall
            finding = "DMS an allen Extremitäten intakt (Motorik/Sensibilität unauffällig).";
            evaluation = "pDMS geprüft.";
        }
        
        reply.finding = finding; 
        reply.evaluation = evaluation;
        touchStep("C"); 
        return ok(reply);
    }
    
    // Bodycheck (FIX: Gibt Text-Befund aus)
    if (low.includes('bodycheck') && !low.includes('(bild)')) {
        reply.accepted = true;
        touchStep("E");
        reply.evaluation = "Bodycheck (Ganzkörperuntersuchung) durchgeführt.";

        const injuries = Array.isArray(H.injuries) ? H.injuries : [];
        
        if (injuries.length > 0) {
            const injuryList = injuries.join(', ');
            reply.finding = `⚠️ Folgende Verletzungen festgestellt: ${injuryList}.`;
        } else {
            reply.finding = `Keine weiteren sichtbaren Verletzungen oder Auffälligkeiten.`;
        }
        return ok(reply);
    }

    // --- 3. INFORMATIONSANFRAGEN & SPEZIELLE MAßNAHMEN ---
    
    // NRS Info
    if (low.includes('schmerz info')) {
        reply.accepted = true; 
        const pain = H.pain || {};
        reply.finding = `<b>Schmerzinformation:</b><br>Ort: ${text(pain.ort)}<br>Charakter: ${text(pain.charakter)}`;
        return ok(reply);
    }

    // BEFAST Info
    if (low.includes('befast info')) {
        reply.accepted = true; 
        reply.finding = `<b>BE-FAST-Details:</b><br>${H.befast || "Keine spezifischen neurologischen Symptome hinterlegt."}`;
        return ok(reply);
    }

    // 4S Info
    if (low.includes('4s info')) {
        reply.accepted = true; 
        const s = state.scene_4s || {};
        reply.finding = `<b>4S-Details:</b><br>Sicherheit: ${text(s.sicherheit)}<br>Szene: ${text(s.szene)}<br>Sichtung: ${text(s.sichtung_personen)}<br>Support: ${text(s.support_empfehlung)}`;
        return ok(reply);
    }

    // NEU: NEXUS Info
    if (low.includes('nexus info')) {
        reply.accepted = true; 
        const nexus = H.nexus_criteria || {};
        let summary = nexus.summary || "Keine Informationen zu ablenkenden Verletzungen vorhanden.";
        if (H.injuries && H.injuries.length > 0) {
            summary += `<br>Ablenkende Verletzungen: ${H.injuries.join(', ')}`;
        }
        reply.finding = `<b>NEXUS-Kriterien (Risikofaktoren):</b><br>${summary}`;
        return ok(reply);
    }

    // NEU: Polytrauma Info
    if (low.includes('polytrauma info')) {
        reply.accepted = true; 
        const poly = H.polytrauma_criteria || {};
        
        let summary = `<b>Polytrauma-Faktoren:</b>`;
        if (poly.vitals) summary += `<br>Vitalparameter: ${poly.vitals}`;
        if (poly.anatomical) summary += `<br>Anatomische Verletzung: ${poly.anatomical}`;
        if (poly.mechanism) summary += `<br>Unfallmechanismus: ${poly.mechanism}`;
        if (poly.special) summary += `<br>Spezielle Faktoren: ${poly.special}`;

        reply.finding = summary;
        return ok(reply);
    }

    // O2-Gabe Logik (FIX: Auswirkung auf SpO2)
    if (low.includes('o2-gabe')) {
        state.measurements.o2_given = true; 
        reply.accepted = true; 
        reply.evaluation = `Sauerstoffgabe erfolgt: ${ua}`; 
        touchStep("B");

        const curSpO2 = parseFloat(String(state.vitals.SpO2 || baseVitals.SpO2).match(/\d+/)?.[0] || 85);
        
        if (curSpO2 < 95) {
            // Erhöht SpO2 um 5% (simulierte Wirkung)
            const newSpO2 = Math.min(98, curSpO2 + 5); 
            updVitals({ SpO2: newSpO2 });
            reply.finding = `✅ SpO₂ steigt auf ${newSpO2}%`;
        }
        return ok(reply);
    }

    // Oberkörper Hochlagerung (FIX: Auswirkung auf SpO2)
    if (low.includes('oberkörper hoch lagern')) {
        reply.accepted = true; 
        reply.evaluation="Oberkörper hochgelagert. Dies unterstützt die Atemmechanik.";
        touchStep("E");

        const curSpO2 = parseFloat(String(state.vitals.SpO2 || baseVitals.SpO2).match(/\d+/)?.[0] || 90);
        
        // Leichte Verbesserung der Sättigung, wenn der Wert unter 96% liegt
        if (curSpO2 < 96) {
            const newSpO2 = Math.min(98, curSpO2 + 2); 
            updVitals({ SpO2: newSpO2 });
            reply.finding = `✅ SpO₂ verbessert sich leicht auf ${newSpO2}%.`;
        }
        return ok(reply);
    }

    // Immobilisation (FIX: Setzt Flag für DMS-Kontrolle)
    if (low.includes('immobilisation:')) {
        state.measurements.immo_done = true; // Neues Flag
        reply.accepted = true;
        reply.evaluation = "Immobilisation durchgeführt.";
        touchStep("E");
        reply.finding = "Hinweis: Kontrolle DMS/Motorik/Sensibilität nach Schienung ist zwingend erforderlich!";
        return ok(reply);
    }
    
    // --- 4. VITALWERTE & SCHEMATA (DOKUMENTATION) ---
    
    // SAMPLER DOKU
    if (/sampler doku/.test(low)) { 
        reply.accepted=true; 
        const s = state.anamnesis?.SAMPLER || {};
        reply.evaluation="SAMPLER dokumentiert:"; 
        reply.finding = `S: ${text(s.S)}<br>A: ${text(s.A)}<br>M: ${text(s.M)}<br>P: ${text(s.P)}<br>L: ${text(s.L)}<br>E: ${text(s.E)}<br>R: ${text(s.R)}`; 
        return ok(reply); 
    }
    
    // 4S DOKU
    if (/4s doku/.test(low)) { 
        reply.accepted = true; 
        const s = state.scene_4s || {};
        reply.evaluation = "4S dokumentiert:";
        reply.finding = `Sicherheit: ${text(s.sicherheit)}<br>Szene: ${text(s.szene)}<br>Sichtung: ${text(s.sichtung_personen)}<br>Support: ${text(s.support_empfehlung)}`;
        return ok(reply); 
    }
    
    // --- 5. ORGA & FALLBACKS ---
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