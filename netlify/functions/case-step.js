/**
 * Netlify Function: case-step
 * REPARIERT: Kombiniert Realismus-Features (Trends) mit allen Button-Funktionen
 */

exports.handler = async (event) => {
  const headers = {
    "content-type": "application/json",
    "access-control-allow-origin": "*"
  };

  try {
    const body  = event.body ? JSON.parse(event.body) : {};
    const state = body.case_state || {};
    const ua    = String(body.user_action || "").trim();
    const low   = ua.toLowerCase();

    // Init State falls leer
    state.id         = state.id || "unknown_case";
    state.vitals     = state.vitals || {};
    state.hidden     = state.hidden || {};
    state.steps_done = Array.isArray(state.steps_done) ? state.steps_done : [];
    state.history    = Array.isArray(state.history)    ? state.history    : [];
    state.score      = typeof state.score === "number" ? state.score      : 0;
    
    // Messungen Tracking
    state.measurements = state.measurements || { vitals: {}, schemas: {}, pain: { documented:false, nrs:null }, diagnosis: null };
    const meas = state.measurements;

    // Zähler für Aktionen (Zeitverlauf für Realismus)
    state.action_count = (state.action_count || 0) + 1;

    // History pflegen
    if (ua) {
      state.history.push({ ts:new Date().toISOString(), action:ua });
      if (state.history.length > 50) state.history.shift();
    }

    const reply = {
      accepted: false,
      outside_scope: false,
      unsafe: false,
      finding: undefined,
      evaluation: undefined,
      next_hint: undefined,
      updated_vitals: {},
      debrief: undefined,
      done: false,
      case_state: state
    };

    // Helper
    const text = (v) => (v === undefined || v === null || v === "") ? "—" : String(v).trim();
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    // --- Trend-Pfeile berechnen ---
    const getTrendArrow = (oldVal, newVal) => {
        const parse = (v) => parseFloat(String(v).replace(',','.').match(/[\d\.]+/)?.[0] || 0);
        const o = parse(oldVal);
        const n = parse(newVal);
        if (n > o) return " ⬆";
        if (n < o) return " ⬇";
        return "";
    };

    const updVitals = (obj) => {
      state.vitals = state.vitals || {};
      for (const k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
        const oldVal = state.vitals[k];
        const newVal = obj[k];
        state.vitals[k] = newVal;
        const arrow = getTrendArrow(oldVal, newVal);
        reply.updated_vitals[k] = newVal + arrow; 
      }
    };

    const touchStep = (letter) => {
      const label = letter.toUpperCase();
      if (!state.steps_done.includes(label)) {
        state.steps_done.push(label);
        state.score += 1;
      }
    };
    
    // Baseline laden
    const H = state.hidden;
    const baseVitals = H.vitals_baseline || { RR: "120/80", SpO2: 96, AF: 16, Puls: 80, BZ: 110, Temp: 36.8, GCS: 15 };

    // =================================================================
    // 1. REALISMUS: Verschlechterung bei Inaktivität
    // =================================================================
    const hasO2 = state.history.some(h => /o2|sauerstoff|beatmung/.test(h.action.toLowerCase()));
    const currentSpO2 = parseFloat(state.vitals.SpO2 || baseVitals.SpO2);
    
    // Wenn SpO2 kritisch (<92) und kein O2 gegeben -> alle 3 Schritte verschlechtern
    if (currentSpO2 < 92 && !hasO2 && state.action_count % 3 === 0) {
        const newSpO2 = Math.max(70, currentSpO2 - 2);
        updVitals({ SpO2: newSpO2 });
        reply.finding = (reply.finding || "") + "\n⚠️ Patient wirkt zyanotischer (SpO₂ fällt).";
    }

    // =================================================================
    // 2. INPUT LOGIK (Buttons & Text)
    // =================================================================
    
    if (!ua) return { statusCode:200, headers, body: JSON.stringify(reply) };

    // --- Debriefing / Ende ---
    if (/debrief|fall beenden/.test(low)) {
      reply.done = true;
      const missing = ["X","A","B","C","D","E"].filter(s => !state.steps_done.includes(s));
      const feedback = missing.length 
        ? `Nicht alle Phasen durchlaufen (Fehlt: ${missing.join(', ')}).`
        : `Sehr gut! Struktur eingehalten.`;
      
      reply.debrief = `Ergebnis:\n${feedback}\nEnd-Vitals: SpO2 ${state.vitals.SpO2||'-'}%, RR ${state.vitals.RR||'-'}`;
      reply.evaluation = "Fall abgeschlossen.";
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // --- A) X - Exsanguination ---
    if (/x unauff[aä]llig|kein[e]? (akute|bedrohliche)?\s*blutung/.test(low)) {
      reply.accepted = true;
      reply.evaluation = "Keine bedrohliche äußere Blutung gefunden.";
      touchStep("X");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/druckverband/.test(low)) {
      reply.accepted = true;
      reply.evaluation = "Druckverband angelegt.";
      touchStep("X");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/tourniquet/.test(low)) {
      reply.accepted = true;
      reply.evaluation = "Tourniquet angelegt (Zeit notieren!).";
      touchStep("X");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/beckenschlinge/.test(low)) {
      reply.accepted = true;
      reply.evaluation = "Beckenschlinge angelegt.";
      touchStep("C"); // Becken gehört oft zu C (oder X je nach Lehrmeinung)
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/hämostyptika|haemostyptika/.test(low)) {
      reply.accepted = true;
      reply.evaluation = "Wunde mit Hämostyptikum versorgt.";
      touchStep("X");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // --- B) A - Airway ---
    if (/mundraum|mund/.test(low)) { // Deckt "Mundraumkontrolle" ab
      reply.accepted = true;
      reply.finding = text(H.mouth);
      reply.evaluation = "Mundraum inspiziert.";
      touchStep("A");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/absaugen/.test(low)) {
      reply.accepted = true;
      reply.evaluation = "Atemwege abgesaugt.";
      touchStep("A");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/guedel/.test(low)) {
      reply.accepted = true;
      reply.evaluation = "Guedel-Tubus eingelegt.";
      touchStep("A");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/wendel/.test(low)) {
      reply.accepted = true;
      reply.evaluation = "Wendel-Tubus eingelegt.";
      touchStep("A");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/esmarch/.test(low)) {
      reply.accepted = true;
      reply.evaluation = "Esmarch-Handgriff durchgeführt.";
      touchStep("A");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/beutel|masken|beatmung/.test(low)) {
      reply.accepted = true;
      reply.evaluation = "Beutel-Masken-Beatmung gestartet.";
      const currentAF = parseInt(state.vitals.AF || baseVitals.AF);
      // Beatmung normalisiert AF oft Richtung 12-15
      updVitals({ SpO2: clamp((state.vitals.SpO2||90)+5, 90, 100) });
      touchStep("A"); // und B
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // --- C) B - Breathing ---
    if (/auskultieren|lunge|abhorchen/.test(low)) {
      reply.accepted = true;
      reply.finding = text(H.lung);
      reply.evaluation = "Lunge auskultiert.";
      touchStep("B");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/af|atemfrequenz|atmung/.test(low) && (/mess|zähl|check/.test(low) || low === 'af messen')) {
        const v = state.vitals.AF ?? baseVitals.AF;
        updVitals({ AF:v });
        meas.vitals.AF = true;
        reply.accepted = true;
        reply.evaluation = "Atemfrequenz ausgezählt.";
        reply.finding = `AF: ${v}/min`;
        touchStep("B");
        return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/spo2|sättigung/.test(low) && (/mess|check|prüf/.test(low) || low === 'spo2 messen')) {
        const v = state.vitals.SpO2 ?? baseVitals.SpO2;
        updVitals({ SpO2:v });
        meas.vitals.SpO2 = true;
        reply.accepted = true;
        reply.evaluation = "SpO₂ gemessen.";
        reply.finding = `SpO₂: ${v}%`;
        touchStep("B");
        return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/o2|sauerstoff/.test(low)) { // Deckt "O2 geben" ab
        const oldSpO2 = parseFloat(state.vitals.SpO2 ?? baseVitals.SpO2);
        const newSpO2 = clamp(oldSpO2 + 6, 90, 100);
        updVitals({ SpO2: newSpO2 });
        reply.accepted = true;
        reply.evaluation = "Sauerstoffgabe eingeleitet.";
        touchStep("B");
        return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // --- D) C - Circulation ---
    if (/rr|blutdruck/.test(low)) {
      const v = state.vitals.RR ?? baseVitals.RR;
      updVitals({ RR:v });
      meas.vitals.RR = true;
      reply.accepted = true;
      reply.evaluation = "Blutdruck gemessen.";
      reply.finding = `RR: ${v} mmHg`;
      touchStep("C");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/puls|herzfrequenz/.test(low)) {
      const v = state.vitals.Puls ?? baseVitals.Puls;
      updVitals({ Puls:v });
      meas.vitals.Puls = true;
      reply.accepted = true;
      reply.evaluation = "Puls getastet.";
      reply.finding = `Puls: ${v}/min`;
      touchStep("C");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/ekg/.test(low)) {
      reply.accepted = true;
      reply.finding = text(H.ekg12);
      reply.evaluation = "EKG geschrieben.";
      touchStep("C");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/volumen/.test(low)) { // "Volumen 500 ml"
        reply.accepted = true;
        reply.evaluation = "Volumen (500ml) infundiert.";
        // RR etwas verbessern
        const rr = state.vitals.RR || baseVitals.RR;
        const [sys, dia] = rr.split('/').map(x=>parseInt(x));
        if(sys && sys < 120) {
            const newRR = `${sys+10}/${dia+5}`;
            updVitals({ RR: newRR });
        }
        touchStep("C");
        return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // --- E) D - Disability ---
    if (/gcs/.test(low)) {
      const v = state.vitals.GCS ?? baseVitals.GCS;
      updVitals({ GCS:v });
      meas.vitals.GCS = true;
      reply.accepted = true;
      reply.finding = `GCS: ${v}`;
      reply.evaluation = "GCS erhoben.";
      touchStep("D");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/pupillen/.test(low)) {
      reply.accepted = true;
      reply.finding = text(H.pupils);
      reply.evaluation = "Pupillen kontrolliert.";
      touchStep("D");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/bz|blutzucker/.test(low)) {
      const v = state.vitals.BZ ?? baseVitals.BZ;
      updVitals({ BZ:v });
      meas.vitals.BZ = true;
      reply.accepted = true;
      reply.finding = `BZ: ${v} mg/dl`;
      reply.evaluation = "BZ gemessen.";
      touchStep("D");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // --- F) E - Exposure ---
    if (/bodycheck|ganzkörper/.test(low)) {
      const parts = [];
      if (H.skin) parts.push("Haut: " + text(H.skin));
      if (H.abdomen) parts.push("Abd: " + text(H.abdomen));
      if (H.injuries && H.injuries.length) parts.push("Verletzungen: " + H.injuries.join(", "));
      reply.finding = parts.join(" | ");
      reply.accepted = true;
      reply.evaluation = "Bodycheck durchgeführt.";
      touchStep("E");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/temp/.test(low)) {
      const v = state.vitals.Temp ?? baseVitals.Temp;
      updVitals({ Temp:v });
      meas.vitals.Temp = true;
      reply.accepted = true;
      reply.finding = `Temp: ${v} °C`;
      touchStep("E");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/wärme|decke/.test(low)) {
      reply.accepted = true;
      reply.evaluation = "Wärmeerhalt sichergestellt.";
      touchStep("E");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/lagerung|hoch/.test(low)) {
      reply.accepted = true;
      reply.evaluation = "Oberkörper hochgelagert.";
      touchStep("E");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }


    // --- G) Schemata & Diagnosen ---
    if (/sampler info/.test(low)) {
        const s = state.anamnesis?.SAMPLER || {};
        reply.finding = `S: ${text(s.S)}\nA: ${text(s.A)}\nM: ${text(s.M)}\nP: ${text(s.P)}\nL: ${text(s.L)}\nE: ${text(s.E)}\nR: ${text(s.R)}`;
        reply.accepted = true;
        return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/befast/.test(low)) {
        reply.finding = `BE-FAST: ${text(H.befast)}`;
        reply.accepted = true;
        touchStep("D");
        return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/4s info/.test(low)) {
        const s = state.scene_4s || {};
        reply.finding = `Sicherheit: ${text(s.sicherheit)}\nSzene: ${text(s.szene)}`;
        reply.accepted = true;
        return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/schmerz info/.test(low)) {
        const p = H.pain || {};
        reply.finding = `Schmerz (Patient): NRS ${p.nrs} (${p.ort})`;
        reply.accepted = true;
        return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/nrs [0-9]+/.test(low)) {
        const n = parseInt(low.match(/nrs ([0-9]+)/)[1]);
        meas.pain.documented = true;
        meas.pain.nrs = n;
        reply.accepted = true;
        reply.evaluation = `NRS ${n} dokumentiert.`;
        return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    
    // Diagnosen speichern
    if (ua.startsWith("Verdachtsdiagnose:")) {
        meas.diagnosis = ua.split(":")[1];
        reply.accepted = true;
        reply.evaluation = "Diagnose & Transportziel notiert.";
        return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // --- Fallback ---
    reply.outside_scope = true;
    reply.evaluation = "Maßnahme nicht eindeutig zugeordnet.";
    reply.next_hint = "Tippe oder klicke z.B. 'RR messen', 'O2 geben', 'Bodycheck'.";

    return { statusCode:200, headers, body: JSON.stringify(reply) };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};