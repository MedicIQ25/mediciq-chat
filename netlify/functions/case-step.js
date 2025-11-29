/**
 * Netlify Function: case-step
 * (Fix: Zugang/Volumen, pDMS, Trauma, Übergabe, System-Check/Verschlechterung)
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
    state.measurements = state.measurements || { vitals: {}, schemas: {}, pain: {}, diagnosis: null, iv_access: false, handover_done: false, handover_empty: false };
    
    // History update
    if (ua) {
      state.history.push({ ts: new Date().toISOString(), action: ua });
      if (state.history.length > 50) state.history.shift();
    }

    const reply = { accepted: false, updated_vitals: {}, done: false, case_state: state };
    const H = state.hidden || {};
    const baseVitals = H.vitals_baseline || { SpO2: 96, RR: "120/80", AF: 14 };

    // --- Helpers ---
    const updVitals = (obj) => {
      for (const k in obj) {
        state.vitals[k] = obj[k];
        if (state.measurements.vitals[k]) {
            const old = parseFloat(String(state.vitals[k]||"0").match(/\d+/)?.[0]);
            const neu = parseFloat(String(obj[k]).match(/\d+/)?.[0]);
            const arrow = (neu > old) ? " ⬆" : (neu < old) ? " ⬇" : "";
            reply.updated_vitals[k] = obj[k] + arrow;
        }
      }
    };
    const touchStep = (l) => { if(!state.steps_done.includes(l.toUpperCase())) { state.steps_done.push(l.toUpperCase()); state.score+=1; } };
    const text = (v) => (v === undefined || v === null || v === "") ? "—" : String(v).trim();
    function ok(body) { return { statusCode: 200, headers, body: JSON.stringify(body) }; }

    // =================================================================
    // 0. SYSTEM CHECK (Zeitgesteuerte Verschlechterung)
    // =================================================================
    if (ua.includes("System-Check")) {
        const hasO2 = state.history.some(h => /o2|sauerstoff|beatmung/.test(h.action.toLowerCase()));
        const hasImmo = state.history.some(h => h.action.includes('Immobilisation'));
        const curSpO2 = parseFloat(state.vitals.SpO2 || baseVitals.SpO2);
        
        reply.accepted = true; // Still accept it so it works
        
        // Logik: Ohne O2 sinkt die Sättigung bei Atemnot-Fällen
        if (curSpO2 < 93 && !hasO2) {
            const newSpO2 = Math.max(75, curSpO2 - 2);
            updVitals({ SpO2: newSpO2 });
            // Warnung nur wenn Wert sichtbar
            if (state.measurements.vitals?.SpO2) {
                reply.finding = `⚠️ Zeit vergeht: SpO₂ fällt weiter auf ${newSpO2}%!`;
            } else {
                reply.finding = `⚠️ Zeit vergeht: Patient wirkt zunehmend zyanotisch (blau).`;
            }
        } 
        // Trauma: Ohne Schmerzmittel/Schienung steigt der Schmerz?
        else if (state.specialty === 'trauma' && !hasImmo && !hasO2) {
             reply.finding = "⚠️ Zeit vergeht: Patient klagt über zunehmende Schmerzen und Übelkeit (Schock?).";
        }
        
        // Wenn keine Verschlechterung, kein finding -> wird im Frontend dann nicht fett angezeigt
        return ok(reply);
    }

    // =================================================================
    // 0.1 PRIORITÄT: DIAGNOSE & DEBRIEF & ÜBERGABE
    // =================================================================
    if (ua.includes("Verdachtsdiagnose") || ua.includes("Verdacht:")) { 
      state.measurements.diagnosis = ua.replace("Verdachtsdiagnose:", "").trim(); 
      reply.accepted = true; 
      reply.evaluation = "Verdachtsdiagnose & Priorität dokumentiert.";
      return ok(reply); 
    }
    
    // Handover Check: Ist Inhalt da?
    if (ua.includes("Übergabe:")) {
        const cleanText = ua.replace("SINNHAFT:", "").replace(/I:|N:|H:|A:|\|/g, "").replace(/\s+/g, "");
        if (cleanText.length < 5) { 
             state.measurements.handover_empty = true;
             reply.evaluation = "Übergabe abgeschickt (Inhalt leer!).";
        } else {
             state.measurements.handover_done = true;
             state.measurements.handover_empty = false;
             reply.evaluation = "Übergabe an Klinik/Arzt erfolgt.";
        }
        reply.accepted = true;
        return ok(reply);
    }

    if (/debrief|fall beenden/.test(low)) {
      reply.done = true;
      const stepsAll = ["X","A","B","C","D","E"];
      const missingSteps = stepsAll.filter(s => !state.steps_done.includes(s));
      const score = state.score;
      
      const userDxRaw = (state.measurements.diagnosis || "").toLowerCase();
      const correctKeys = state.hidden?.diagnosis_keys || [];
      const isDxCorrect = correctKeys.some(key => userDxRaw.includes(key.toLowerCase()));

      const actionsDone = state.history.map(h => h.action.toLowerCase());
      const hasImmo = actionsDone.some(a => a.includes("immobilisation"));
      const hasDMS  = actionsDone.some(a => a.includes("pdms") || a.includes("dms"));
      const hasO2   = actionsDone.some(a => a.includes("o2") || a.includes("sauerstoff"));
      
      const hoDone = state.measurements.handover_done;
      const hoEmpty = state.measurements.handover_empty;

      let status = "Bestanden";
      let summary = "";

      if (missingSteps.length > 0) {
        status = "Nicht bestanden (Struktur)";
        if(isDxCorrect) status = "Diagnose korrekt (Struktur fehlt)";
        summary = `Das ABCDE-Schema wurde nicht vollständig durchlaufen.\nFehlende Phasen: ${missingSteps.join(', ')}`;
      } else if (score < 6) {
        status = "Teilweise bestanden";
        summary = `Struktur eingehalten, aber zu wenig Maßnahmen (Score ${score}).`;
      } else {
        status = isDxCorrect ? "Hervorragend" : "Bestanden";
        summary = `Gute Struktur und Maßnahmen (Score ${score}).`;
      }

      summary += "\n\n--- Analyse der Maßnahmen ---";
      if (hasImmo) summary += "\n✅ Trauma-Versorgung: Die Fraktur wurde korrekt immobilisiert.";
      else if (state.specialty === 'trauma') summary += "\n❌ Trauma: Es wurde keine Schienung durchgeführt.";
      if (hasDMS) summary += "\n✅ Sicherheit: pDMS-Kontrolle wurde durchgeführt.";
      if (hasO2 && parseFloat(state.vitals.SpO2) < 94) summary += "\n✅ Therapie: Sauerstoffgabe war indiziert und erfolgte.";
      
      // Handover Feedback
      if (hoDone && !hoEmpty) summary += "\n✅ Kommunikation: Strukturierte Übergabe (SINNHAFT) ist erfolgt.";
      else if (hoEmpty) summary += "\n❌ Kommunikation: Übergabe-Protokoll war leer!";
      else summary += "\n⚠️ Kommunikation: Übergabe an den Arzt fehlte.";
      
      if (state.measurements.diagnosis) {
        summary += `\n\nDeine Diagnose: ${state.measurements.diagnosis}`;
        if (isDxCorrect) summary += `\n✅ Volltreffer! Das Krankheitsbild wurde korrekt erkannt.`;
        else summary += `\n⚠️ Die Diagnose weicht vom erwarteten Bild ab (Erwartet u.a.: ${correctKeys[0] || '?'}).`;
      } else {
        summary += `\n\nHinweis: Keine Verdachtsdiagnose dokumentiert.`;
      }

      reply.debrief = `${status}\n\n${summary}\n\nEnd-Vitals: SpO2 ${state.vitals.SpO2||'-'}%, RR ${state.vitals.RR||'-'}`;
      return ok(reply);
    }

    // =================================================================
    // 1. X - INSPEKTION (Blutungscheck)
    // =================================================================
    if (/blutungscheck|blutung suchen/.test(low)) {
        reply.accepted = true;
        const info = H.bleeding_info || "Keine offensichtlichen massiven Blutungen.";
        reply.finding = info;
        reply.evaluation = "X: Initiale Blutungs-Inspektion durchgeführt.";
        if (info.toLowerCase().includes("spritzend") || info.toLowerCase().includes("massiv")) {
             reply.next_hint = "Sofort Tourniquet oder Druckverband!";
        } else if (info.toLowerCase().includes("keine")) {
             reply.next_hint = "X scheint unauffällig -> Weiter zu A.";
        }
        state.score += 1; 
        return ok(reply);
    }

    // =================================================================
    // 2. O2 LOGIK
    // =================================================================
    if (ua.includes('O2-Gabe')) {
      const flowMatch = ua.match(/(\d+)\s*l\/min/);
      const flow = flowMatch ? parseInt(flowMatch[1]) : 0;
      const isMaske = ua.includes('Maske');
      const isReservoir = ua.includes('Reservoir') || ua.includes('Beutel');
      
      const currentSpO2 = parseFloat(state.vitals.SpO2 || baseVitals.SpO2);
      let boost = 0;
      if (isReservoir && flow >= 10) boost = 15; 
      else if (isMaske && flow >= 5) boost = 8 + (flow - 5); 
      else boost = flow * 1.5; 
      
      const newSpO2 = Math.min(100, Math.max(currentSpO2, currentSpO2 + boost));
      updVitals({ SpO2: Math.floor(newSpO2) });
      reply.accepted = true;
      reply.evaluation = `Sauerstoff: ${isReservoir?'Reservoir':isMaske?'Maske':'Brille'} mit ${flow} l/min.`;
      reply.finding = `SpO₂ steigt an (Effekt ca. +${Math.floor(boost)}%)`;
      touchStep("B");
      return ok(reply);
    }

    // =================================================================
    // 3. I.V. ZUGANG & VOLUMEN & NOTARZT
    // =================================================================
    if (/zugang/.test(low) && /legen/.test(low)) {
        state.measurements.iv_access = true;
        reply.accepted = true;
        reply.evaluation = "Periphervenöser Zugang (PVZ) gelegt.";
        touchStep("C");
        return ok(reply);
    }
    if (/volumen/.test(low)) {
        if (!state.measurements.iv_access) {
            reply.unsafe = true;
            reply.evaluation = "Kein Zugang vorhanden!";
            reply.finding = "Bitte erst i.V. Zugang legen.";
            return ok(reply);
        }
        reply.accepted = true;
        reply.evaluation = "500ml Volumengabe läuft.";
        touchStep("C");
        return ok(reply);
    }
    if (/notarzt/.test(low) && /nachfordern/.test(low)) {
        const reason = ua.split(":")[1] || "";
        reply.accepted = true;
        reply.evaluation = `Notarzt (NEF) nachgefordert.`;
        reply.finding = `Leitstelle bestätigt. Eintreffen in ca. 8-12 Min. (Grund: ${reason.trim()})`;
        touchStep("C"); 
        return ok(reply);
    }

    // =================================================================
    // 4. NEUE FEATURES: TRAUMA
    // =================================================================
    
    // pDMS
    if (/pdms|dms/.test(low) && !/immobilisation/.test(low)) {
        reply.accepted = true;
        const hasImmo = state.history.some(h => h.action.includes('Immobilisation'));
        const dxKeys = (H.diagnosis_keys || []).join(' ').toLowerCase();
        let finding = "";

        if (dxKeys.includes("fraktur") || dxKeys.includes("unterarm") || dxKeys.includes("schenkel")) {
            if (!hasImmo) {
                finding = "DMS vor Schienung: Pulse tastbar. Motorik schmerzbedingt eingeschränkt. Sensibilität: leichtes Kribbeln/Taubheitsgefühl distal der Fraktur.";
                reply.evaluation = "C/E: pDMS Ausgangswert erhoben.";
            } else {
                finding = "DMS nach Schienung: Pulse kräftig tastbar. Motorik und Sensibilität intakt (Kribbeln rückläufig). Patient gibt Schmerzlinderung an.";
                reply.evaluation = "C/E: pDMS Verlaufskontrolle.";
            }
        } else {
            finding = "DMS an allen Extremitäten unauffällig. Keine Seitendifferenz.";
            reply.evaluation = "pDMS geprüft.";
        }
        reply.finding = finding;
        touchStep("C");
        return ok(reply);
    }

    // IMMOBILISATION
    if (ua.includes('Immobilisation:')) {
        const parts = ua.split(':');
        const detail = parts[1] || "";
        reply.accepted = true;
        reply.evaluation = `Maßnahme durchgeführt: ${detail}`;
        
        if (detail.includes("Arm") || detail.includes("Bein")) {
             reply.finding = "Fraktur stabilisiert. Schmerzen laut Patient deutlich gebessert (NRS sinkt).";
        } else if (detail.includes("Stifneck") || detail.includes("HWS")) {
             reply.finding = "HWS immobilisiert. Patient toleriert die Maßnahme.";
        } else if (detail.includes("Becken")) {
             reply.finding = "Beckenschlinge angelegt, Kompression hergestellt.";
        } else {
             reply.finding = "Ruhigstellung erfolgt.";
        }
        touchStep("E"); 
        return ok(reply);
    }
    
    // VISUELLER BODYCHECK
    if (ua.includes('Bodycheck (visuell)')) {
        reply.accepted = true;
        reply.evaluation = "E: Detaillierter Bodycheck erfolgt.";
        reply.finding = (H.injuries && H.injuries.length > 0) 
            ? `Verletzungen identifiziert: ${H.injuries.join(', ')}` 
            : "Keine äußeren Verletzungen erkennbar.";
        touchStep("E");
        return ok(reply);
    }
    
    // EKG LOGIK
    if (ua.includes('12-Kanal-EKG')) {
        reply.accepted = true;
        const pattern = H.ekg_pattern || "sinus";
        reply.evaluation = "C: EKG geschrieben.";
        if (pattern === 'vt') reply.finding = "Achtung! Breitkomplextachykardie.";
        else if (pattern === 'asystolie') reply.finding = "Nulllinie (Asystolie).";
        else reply.finding = H.ekg12 || "Sinusrhythmus.";
        touchStep("C");
        return ok(reply);
    }

    // =================================================================
    // 5. SCHEMATA
    // =================================================================
    if (/sampler info/.test(low)) {
      reply.accepted = true;
      return ok(reply);
    }
    if (/sampler doku/.test(low)) {
      reply.accepted = true;
      const s = state.anamnesis?.SAMPLER || {};
      const content = [
        `S: ${text(s.S)}`, `A: ${text(s.A)}`, `M: ${text(s.M)}`, `P: ${text(s.P)}`, 
        `L: ${text(s.L)}`, `E: ${text(s.E)}`, `R: ${text(s.R)}`
      ].join('\n');
      reply.evaluation = "SAMPLER dokumentiert:";
      reply.finding = content; 
      return ok(reply);
    }
    if (/4s dokumentiert/.test(low)) {
      reply.accepted = true;
      state.measurements.schemas['4S'] = true;
      if(!state.history.some(h=>h.action.includes('4S davor'))) state.score += 1;
      const s4 = state.scene_4s || {};
      reply.evaluation = "4S-Schema dokumentiert:";
      reply.finding = `Sicherheit: ${text(s4.sicherheit)}\nSzene: ${text(s4.szene)}\nSichtung: ${text(s4.sichtung_personen)}\nSupport: ${text(s4.support_empfehlung)}`;
      return ok(reply);
    }
    if (/4s info/.test(low)) {
      const s = state.scene_4s || {};
      reply.finding = `Sicherheit: ${s.sicherheit||'-'}\nSzene: ${s.szene||'-'}`;
      reply.accepted = true;
      return ok(reply);
    }
    if (/schmerz info/.test(low)) {
        const p = H.pain || {};
        reply.finding = `Patient angabe: NRS ${p.nrs || '?'} (${p.ort || 'unbekannt'})`;
        reply.accepted = true;
        return ok(reply);
    }

    // =================================================================
    // STANDARD LOGIK (XABCDE)
    // =================================================================
    if (/x unauff|keine.*blutung/.test(low)) { reply.accepted=true; reply.evaluation="X: Keine bedrohliche Blutung."; touchStep("X"); return ok(reply); }
    if (/druckverband|tourniquet/.test(low)) { reply.accepted=true; reply.evaluation="X: Blutung gestoppt."; touchStep("X"); return ok(reply); }
    if (/beckenschlinge/.test(low)) { reply.accepted=true; reply.evaluation="Beckenschlinge angelegt."; touchStep("C"); return ok(reply); }
    if (/hämostyptika/.test(low)) { reply.accepted=true; reply.evaluation="Hämostyptikum genutzt."; touchStep("X"); return ok(reply); }
    
    if (/mund|mundraum/.test(low)) { reply.accepted=true; reply.finding=H.mouth||"o.B."; reply.evaluation="A: Mundraum inspiziert."; touchStep("A"); return ok(reply); }
    if (/absaugen/.test(low)) { reply.accepted=true; reply.evaluation="Atemwege abgesaugt."; touchStep("A"); return ok(reply); }
    if (/guedel/.test(low)) { reply.accepted=true; reply.evaluation="Guedel eingelegt."; touchStep("A"); return ok(reply); }
    if (/wendel/.test(low)) { reply.accepted=true; reply.evaluation="Wendel eingelegt."; touchStep("A"); return ok(reply); }
    if (/esmarch/.test(low)) { reply.accepted=true; reply.evaluation="Esmarch durchgeführt."; touchStep("A"); return ok(reply); }
    if (/beutel|masken|beatmung/.test(low)) { 
      updVitals({SpO2:Math.min(100, (state.vitals.SpO2||90)+10)}); 
      reply.accepted=true; reply.evaluation="Beatmung gestartet."; touchStep("A"); return ok(reply); 
    }
    
    if (/spo2|sättigung/.test(low)) { 
      state.measurements.vitals.SpO2 = true;
      updVitals({SpO2:state.vitals.SpO2||baseVitals.SpO2}); 
      reply.accepted=true; reply.evaluation="B: SpO2 gemessen."; touchStep("B"); return ok(reply); 
    }
    if (/af|atemfreq/.test(low)) { 
      state.measurements.vitals.AF = true;
      updVitals({AF:state.vitals.AF||baseVitals.AF}); reply.accepted=true; reply.evaluation="B: AF gezählt."; touchStep("B"); return ok(reply); 
    }
    if (/auskultieren|lunge/.test(low)) { 
      reply.accepted=true; reply.finding=H.lung||"o.B."; reply.evaluation="B: Auskultiert."; touchStep("B"); return ok(reply); 
    }

    if (/rr|blutdruck/.test(low)) { 
      state.measurements.vitals.RR = true;
      updVitals({RR:state.vitals.RR||baseVitals.RR}); reply.accepted=true; reply.evaluation="C: RR gemessen."; touchStep("C"); return ok(reply); 
    }
    if (/puls/.test(low)) { 
      state.measurements.vitals.Puls = true;
      updVitals({Puls:state.vitals.Puls||baseVitals.Puls}); reply.accepted=true; reply.evaluation="C: Puls getastet."; touchStep("C"); return ok(reply); 
    }
    if (/ekg/.test(low)) { reply.accepted=true; reply.finding=H.ekg12||"Sinus"; reply.evaluation="C: EKG geschrieben."; touchStep("C"); return ok(reply); }

    if (/gcs/.test(low)) { state.measurements.vitals.GCS=true; updVitals({GCS:state.vitals.GCS||15}); reply.accepted=true; reply.evaluation="D: GCS erhoben."; touchStep("D"); return ok(reply); }
    if (/pupillen/.test(low)) { reply.accepted=true; reply.finding=H.pupils||"Isokor"; reply.evaluation="D: Pupillen gecheckt."; touchStep("D"); return ok(reply); }
    if (/bz|blutzucker/.test(low)) { state.measurements.vitals.BZ=true; updVitals({BZ:state.vitals.BZ||100}); reply.accepted=true; reply.evaluation="D: BZ gemessen."; touchStep("D"); return ok(reply); }
    if (/befast info/.test(low)) { reply.accepted=true; reply.finding=H.befast||"negativ"; touchStep("D"); return ok(reply); }
    if (/befast doku/.test(low)) { reply.accepted=true; reply.evaluation="BE-FAST dokumentiert."; touchStep("D"); return ok(reply); }

    if (/bodycheck/.test(low)) { reply.accepted=true; reply.finding=(H.skin||"o.B.")+" "+(H.injuries?.join(',')||""); reply.evaluation="E: Bodycheck."; touchStep("E"); return ok(reply); }
    if (/temp/.test(low)) { state.measurements.vitals.Temp=true; updVitals({Temp:state.vitals.Temp||36.5}); reply.accepted=true; reply.evaluation="E: Temp gemessen."; touchStep("E"); return ok(reply); }
    
    if (/oberkörper|lagerung|lagern/.test(low) && /hoch/.test(low)) { 
        const cur = parseFloat(state.vitals.SpO2 || baseVitals.SpO2);
        if(cur < 98) updVitals({ SpO2: Math.min(100, cur + 2) });
        reply.accepted=true; 
        reply.evaluation="E: Oberkörper hochgelagert."; 
        reply.finding="Atmung wirkt erleichtert.";
        touchStep("E"); 
        return ok(reply); 
    }
    if (/wärme|decke|erhalt/.test(low)) { 
        reply.accepted=true; 
        reply.evaluation="E: Wärmeerhalt (Decke)."; 
        touchStep("E"); 
        return ok(reply); 
    }
    if (/nrs/.test(low)) { reply.accepted=true; reply.evaluation="Schmerz doku."; return ok(reply); }

    // Fallback
    reply.outside_scope = true;
    reply.evaluation = "Unbekannte Aktion.";
    return ok(reply);

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};