/**
 * Netlify Function: case-step
 * Fixes: Diagnose-Bug (Prio 'hoch'), SAMPLER-Text, Lagerung-Split, SpO2-Sichtbarkeit
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
    state.measurements = state.measurements || { vitals: {}, schemas: {}, pain: {}, diagnosis: null };
    
    // History
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
        const old = parseFloat(String(state.vitals[k]||"0").match(/\d+/)?.[0]);
        state.vitals[k] = obj[k];
        const neu = parseFloat(String(obj[k]).match(/\d+/)?.[0]);
        const arrow = (neu > old) ? " ⬆" : (neu < old) ? " ⬇" : "";
        reply.updated_vitals[k] = obj[k] + arrow;
      }
    };
    const touchStep = (l) => { if(!state.steps_done.includes(l.toUpperCase())) { state.steps_done.push(l.toUpperCase()); state.score+=1; } };
    const text = (v) => (v === undefined || v === null || v === "") ? "—" : String(v).trim();
    function ok(body) { return { statusCode: 200, headers, body: JSON.stringify(body) }; }

    // =================================================================
    // 0. PRIORITÄT: DIAGNOSE & DEBRIEF (Bevor andere Keywords greifen!)
    // =================================================================
    if (ua.includes("Verdachtsdiagnose") || ua.includes("Verdacht:")) { 
      state.measurements.diagnosis = ua; 
      reply.accepted = true; 
      reply.evaluation = "Verdachtsdiagnose & Priorität dokumentiert.";
      return ok(reply); 
    }

    if (/debrief|fall beenden/.test(low)) {
      reply.done = true;
      const stepsAll = ["X","A","B","C","D","E"];
      const missingSteps = stepsAll.filter(s => !state.steps_done.includes(s));
      const score = state.score;
      
      let status = "Bestanden";
      let summary = "";
      if (missingSteps.length > 0) {
        status = "Nicht bestanden";
        summary = `Es wurden nicht alle Phasen durchlaufen.\nFehlende: ${missingSteps.join(', ')}`;
      } else if (score < 6) {
        status = "Teilweise bestanden";
        summary = `Struktur ok, aber zu wenig Maßnahmen (Score ${score}).`;
      } else {
        summary = `Sehr gut! Struktur und Maßnahmen passen (Score ${score}).`;
      }

      if (state.measurements.diagnosis) {
        summary += `\nDiagnose gestellt: ${state.measurements.diagnosis}`;
      } else {
        summary += `\nHinweis: Keine Verdachtsdiagnose dokumentiert.`;
      }

      reply.debrief = `${status}\n\n${summary}\n\nEnd-Vitals: SpO2 ${state.vitals.SpO2||'-'}%, RR ${state.vitals.RR||'-'}`;
      return ok(reply);
    }

    // =================================================================
    // 1. O2 LOGIK (Gerät + Flow)
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
    // 2. REALISMUS: Verschlechterung
    // =================================================================
    const hasO2 = state.history.some(h => /o2|sauerstoff|beatmung/.test(h.action.toLowerCase()));
    const curSpO2 = parseFloat(state.vitals.SpO2 || baseVitals.SpO2);
    
    // Nur verschlechtern wenn kritisch und kein O2
    if (curSpO2 < 92 && !hasO2 && state.action_count % 3 === 0) {
        const newSpO2 = Math.max(70, curSpO2 - 2);
        updVitals({ SpO2: newSpO2 });
        
        // FIX: Wert nur anzeigen wenn gemessen
        if (state.measurements.vitals?.SpO2) {
             reply.finding = (reply.finding || "") + `\n⚠️ Patient wirkt zyanotischer (SpO₂ fällt auf ${newSpO2}%).`;
        } else {
             reply.finding = (reply.finding || "") + "\n⚠️ Patient wirkt zyanotischer (Lippenzyanose).";
        }
    }

    // =================================================================
    // 3. 4S, SAMPLER, NRS
    // =================================================================
    if (/sampler doku/.test(low)) {
      reply.accepted = true;
      // FIX: Inhalt anzeigen
      const s = state.anamnesis?.SAMPLER || {};
      const content = `S: ${text(s.S)} | A: ${text(s.A)} | M: ${text(s.M)} | P: ${text(s.P)} | L: ${text(s.L)} | E: ${text(s.E)}`;
      reply.evaluation = "SAMPLER dokumentiert.";
      reply.finding = content;
      return ok(reply);
    }
    
    // FIX: Schmerz Info immer beantworten
    if (/schmerz info/.test(low)) {
        const p = H.pain || {};
        reply.finding = `Patient angabe: NRS ${p.nrs || '?'} (${p.ort || 'unbekannt'})`;
        reply.accepted = true;
        return ok(reply);
    }

    // =================================================================
    // STANDARD LOGIK
    // =================================================================
    
    // X
    if (/x unauff|keine.*blutung/.test(low)) { reply.accepted=true; reply.evaluation="X: Keine bedrohliche Blutung."; touchStep("X"); return ok(reply); }
    if (/druckverband|tourniquet/.test(low)) { reply.accepted=true; reply.evaluation="X: Blutung gestoppt."; touchStep("X"); return ok(reply); }
    if (/beckenschlinge/.test(low)) { reply.accepted=true; reply.evaluation="Beckenschlinge angelegt."; touchStep("C"); return ok(reply); }
    if (/hämostyptika/.test(low)) { reply.accepted=true; reply.evaluation="Hämostyptikum genutzt."; touchStep("X"); return ok(reply); }
    
    // A
    if (/mund|mundraum/.test(low)) { reply.accepted=true; reply.finding=H.mouth||"o.B."; reply.evaluation="A: Mundraum inspiziert."; touchStep("A"); return ok(reply); }
    if (/absaugen/.test(low)) { reply.accepted=true; reply.evaluation="Atemwege abgesaugt."; touchStep("A"); return ok(reply); }
    if (/guedel/.test(low)) { reply.accepted=true; reply.evaluation="Guedel eingelegt."; touchStep("A"); return ok(reply); }
    if (/wendel/.test(low)) { reply.accepted=true; reply.evaluation="Wendel eingelegt."; touchStep("A"); return ok(reply); }
    if (/esmarch/.test(low)) { reply.accepted=true; reply.evaluation="Esmarch durchgeführt."; touchStep("A"); return ok(reply); }
    if (/beutel|masken|beatmung/.test(low)) { 
      updVitals({SpO2:Math.min(100, (state.vitals.SpO2||90)+10)}); 
      reply.accepted=true; reply.evaluation="Beatmung gestartet."; touchStep("A"); return ok(reply); 
    }
    
    // B
    if (/spo2|sättigung/.test(low)) { 
      updVitals({SpO2:state.vitals.SpO2||baseVitals.SpO2}); state.measurements.vitals.SpO2=true; reply.accepted=true; reply.evaluation="B: SpO2 gemessen."; touchStep("B"); return ok(reply); 
    }
    if (/af|atemfreq/.test(low)) { 
      updVitals({AF:state.vitals.AF||baseVitals.AF}); reply.accepted=true; reply.evaluation="B: AF gezählt."; touchStep("B"); return ok(reply); 
    }
    if (/auskultieren|lunge/.test(low)) { 
      reply.accepted=true; reply.finding=H.lung||"o.B."; reply.evaluation="B: Auskultiert."; touchStep("B"); return ok(reply); 
    }

    // C
    if (/rr|blutdruck/.test(low)) { 
      updVitals({RR:state.vitals.RR||baseVitals.RR}); reply.accepted=true; reply.evaluation="C: RR gemessen."; touchStep("C"); return ok(reply); 
    }
    if (/puls/.test(low)) { 
      updVitals({Puls:state.vitals.Puls||baseVitals.Puls}); reply.accepted=true; reply.evaluation="C: Puls getastet."; touchStep("C"); return ok(reply); 
    }
    if (/ekg/.test(low)) { reply.accepted=true; reply.finding=H.ekg12||"Sinus"; reply.evaluation="C: EKG geschrieben."; touchStep("C"); return ok(reply); }
    if (/volumen/.test(low)) { reply.accepted=true; reply.evaluation="500ml infundiert."; touchStep("C"); return ok(reply); }

    // D
    if (/gcs/.test(low)) { updVitals({GCS:state.vitals.GCS||15}); reply.accepted=true; reply.evaluation="D: GCS erhoben."; touchStep("D"); return ok(reply); }
    if (/pupillen/.test(low)) { reply.accepted=true; reply.finding=H.pupils||"Isokor"; reply.evaluation="D: Pupillen gecheckt."; touchStep("D"); return ok(reply); }
    if (/bz|blutzucker/.test(low)) { updVitals({BZ:state.vitals.BZ||100}); reply.accepted=true; reply.evaluation="D: BZ gemessen."; touchStep("D"); return ok(reply); }
    if (/befast info/.test(low)) { reply.accepted=true; reply.finding=H.befast||"negativ"; touchStep("D"); return ok(reply); }
    if (/befast doku/.test(low)) { reply.accepted=true; reply.evaluation="BE-FAST dokumentiert."; touchStep("D"); return ok(reply); }

    // E
    if (/bodycheck/.test(low)) { reply.accepted=true; reply.finding=(H.skin||"o.B.")+" "+(H.injuries?.join(',')||""); reply.evaluation="E: Bodycheck."; touchStep("E"); return ok(reply); }
    if (/temp/.test(low)) { updVitals({Temp:state.vitals.Temp||36.5}); reply.accepted=true; reply.evaluation="E: Temp gemessen."; touchStep("E"); return ok(reply); }
    
    // FIX: Trennung Lagerung vs. Wärme & SpO2 Effekt
    if (/oberkörper|lagerung|lagern/.test(low) && /hoch/.test(low)) { 
        // Physiologie: Hochlagerung verbessert Ventilation leicht
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
    
    // Schemata
    if (/4s/.test(low)) { reply.accepted=true; reply.evaluation="4S doku."; return ok(reply); }
    if (/nrs/.test(low)) { reply.accepted=true; reply.evaluation="Schmerz doku."; return ok(reply); }

    // Fallback
    reply.outside_scope = true;
    reply.evaluation = "Unbekannte Aktion.";
    return ok(reply);

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};