/**
 * Netlify Function: case-step
 * Mit Realismus-Update: Verschlechterung bei Inaktivität & Trend-Pfeile
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

    // --- NEU: Zähler für Aktionen (Zeitverlauf) ---
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

    // Helper: Text sicher ausgeben
    const text = (v) => (v === undefined || v === null || v === "") ? "—" : String(v).trim();
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    // --- NEU: Trend-Pfeile berechnen ---
    const getTrendArrow = (oldVal, newVal) => {
        // Einfache Heuristik: Zahlen extrahieren
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
        
        // Wert speichern
        state.vitals[k] = newVal;
        
        // Trend ermitteln und an Frontend senden
        const arrow = getTrendArrow(oldVal, newVal);
        reply.updated_vitals[k] = newVal + arrow; 
      }
    };

    const STEP_LABEL = { X:"X", A:"A", B:"B", C:"C", D:"D", E:"E" };
    const touchStep = (letter) => {
      const label = STEP_LABEL[letter];
      if (!label) return;
      if (!state.steps_done.includes(label)) {
        state.steps_done.push(label);
        state.score += 1;
      }
    };
    
    // Baseline laden
    const H = state.hidden;
    const baseVitals = H.vitals_baseline || { RR: "120/80", SpO2: 96, AF: 16, Puls: 80, BZ: 110, Temp: 36.8, GCS: 15 };

    // =================================================================
    // 1. REALISMUS-CHECK: Verschlechterung?
    // =================================================================
    // Beispiel: Wenn SpO2 kritisch (<90) und kein O2 gegeben -> Sättigung fällt weiter
    const hasO2 = state.history.some(h => /o2|sauerstoff|beatmung/.test(h.action.toLowerCase()));
    const currentSpO2 = parseFloat(state.vitals.SpO2 || baseVitals.SpO2);
    
    if (currentSpO2 < 92 && !hasO2 && state.action_count % 3 === 0) {
        // Alle 3 Aktionen fällt Sättigung, wenn kein O2
        const newSpO2 = Math.max(70, currentSpO2 - 2);
        updVitals({ SpO2: newSpO2 });
        reply.finding = (reply.finding || "") + "\n⚠️ Patient wirkt zyanotischer (SpO₂ fällt).";
    }

    // =================================================================
    // 2. INPUT LOGIK
    // =================================================================
    
    if (!ua) return { statusCode:200, headers, body: JSON.stringify(reply) };

    // --- Debriefing ---
    if (/debrief|fall beenden/.test(low)) {
      reply.done = true;
      // Hier bauen wir das Debriefing zusammen
      const missing = ["X","A","B","C","D","E"].filter(s => !state.steps_done.includes(s));
      const feedback = missing.length 
        ? `Nicht alle Phasen durchlaufen (Fehlt: ${missing.join(', ')}).`
        : `Sehr gut! Struktur eingehalten.`;
      
      reply.debrief = `Ergebnis:\n${feedback}\nEnd-Vitals: SpO2 ${state.vitals.SpO2||'-'}%, RR ${state.vitals.RR||'-'}`;
      reply.evaluation = "Fall abgeschlossen.";
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // --- Vitals Messen (Toleranter Matcher) ---
    // RR
    if (/rr|blutdruck/.test(low) && /mess|check|prüf/.test(low)) {
      const v = state.vitals.RR ?? baseVitals.RR;
      updVitals({ RR:v });
      meas.vitals.RR = true;
      reply.accepted = true;
      reply.evaluation = "Blutdruck gemessen.";
      touchStep("C");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    // SpO2
    if (/spo2|sättigung|puls|sauerstoffgehalt/.test(low) && /mess|check|prüf/.test(low)) {
        const v = state.vitals.SpO2 ?? baseVitals.SpO2;
        updVitals({ SpO2:v });
        meas.vitals.SpO2 = true;
        reply.accepted = true;
        reply.evaluation = "SpO₂ gemessen.";
        touchStep("B");
        return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    // AF
    if (/af|atemfrequenz|atmung/.test(low) && /mess|zähl|check/.test(low)) {
        const v = state.vitals.AF ?? baseVitals.AF;
        updVitals({ AF:v });
        meas.vitals.AF = true;
        reply.accepted = true;
        reply.evaluation = "Atemfrequenz ausgezählt.";
        touchStep("B");
        return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // --- Interventionen (Mit Effekt auf Vitals) ---
    
    // O2 Gabe
    if (/o2|sauerstoff/.test(low) && /geb|lass|brille|maske/.test(low)) {
        const oldSpO2 = parseFloat(state.vitals.SpO2 ?? baseVitals.SpO2);
        const newSpO2 = clamp(oldSpO2 + 6, 90, 100); // O2 bringt ca 6-10%
        updVitals({ SpO2: newSpO2 });
        reply.accepted = true;
        reply.evaluation = "Sauerstoffgabe eingeleitet.";
        reply.next_hint = "Kontrolliere die Sättigung erneut.";
        touchStep("B");
        return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // Lagerung
    if (/oberkörper|lagerung/.test(low) && /hoch/.test(low)) {
        reply.accepted = true;
        reply.evaluation = "Oberkörper hochgelagert -> Atemarbeit erleichtert.";
        touchStep("E"); // Oder B, je nach Lehrmeinung, hier E als "Exposure/Environment"
        return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // Standard-Fallback für Schemata Buttons (werden als "Info" gesendet)
    if (/sampler info/.test(low)) {
        const s = state.anamnesis?.SAMPLER || {};
        reply.finding = `S: ${text(s.S)}\nA: ${text(s.A)}\nM: ${text(s.M)}\nP: ${text(s.P)}\nL: ${text(s.L)}\nE: ${text(s.E)}\nR: ${text(s.R)}`;
        reply.accepted = true;
        return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    
    // Diagnosen speichern
    if (ua.startsWith("Verdachtsdiagnose:")) {
        meas.diagnosis = ua.split(":")[1];
        reply.accepted = true;
        reply.evaluation = "Diagnose notiert.";
        return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // --- Fallback für unbekannte Eingabe ---
    // Hier sagen wir dem Nutzer NICHT "Fehler", sondern geben einen Tipp
    reply.outside_scope = true;
    reply.evaluation = "Maßnahme nicht eindeutig zugeordnet.";
    reply.next_hint = "Versuche Standardbegriffe wie 'RR messen', 'O2 geben', 'Lagerung'.";

    return { statusCode:200, headers, body: JSON.stringify(reply) };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};