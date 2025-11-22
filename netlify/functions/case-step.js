// netlify/functions/case-step.js
// 100 % kompatibel mit deinem aktuellen Frontend + alle Modals + neue Befunde
export async function handler(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  let input;
  try { input = JSON.parse(event.body || "{}"); } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { action, case: c } = input;
  if (!action || !c) return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing" }) };

  const h = c.hidden || {};
  const v = h.vitals_baseline || {};

  const resp = {
    feedback: "",
    vitals_update: {},
    finding_text: "",
    modal_type: null,
    modal_data: null,
    score_change: 0
  };

  // ==================== VITALWERTE ====================
  const vitalsMap = {
    "RR messen":          { k: "RR",    v: v.RR    || "105/65 mmHg" },
    "SpO2 messen":        { k: "SpO2",  v: (v.SpO2 || 96) + " %" },
    "AF messen":          { k: "AF",    v: (v.AF   || 18) + "/min" },
    "Puls messen":        { k: "Puls",  v: (v.Puls || 110) + "/min" },
    "BZ messen":          { k: "BZ",    v: (v.BZ   || 420) + " mg/dl" },
    "Temperatur messen":  { k: "Temp",  v: (v.Temp || 37.4).toFixed(1) + " °C" },
    "GCS bestimmen":      { k: "GCS",   v: (v.GCS  || 14) + "/15" }
  };

  if (vitalsMap[action]) {
    resp.vitals_update[vitalsMap[action].k] = vitalsMap[action].v;
    resp.feedback = `${action} → ${vitalsMap[action].v}`;
    resp.score_change = 8;
    return { statusCode: 200, headers, body: JSON.stringify(resp) };
  }

  // ==================== MODALS ====================
  if (action === "4S-Schema") {
    resp.modal_type = "4s";
    resp.modal_data = {};                    // dein Frontend füllt das automatisch
    resp.feedback = "4S-Schema geöffnet.";
    resp.score_change = 10;
    return { statusCode: 200, headers, body: JSON.stringify(resp) };
  }

  if (action === "SAMPLER") {
    const sampler = c.anamnesis?.SAMPLER || {
      S: "keine Angaben", A: "-", M: "-", P: "-", L: "-", E: "-", R: "-"
    };
    resp.modal_type = "sampler";
    resp.modal_data = sampler;
    resp.feedback = "SAMPLER-Anamnese erhoben.";
    resp.score_change = 15;
    return { statusCode: 200, headers, body: JSON.stringify(resp) };
  }

  if (action === "BE-FAST") {
    const positive = !!h.befast;
    resp.modal_type = "befast";
    resp.modal_data = h.befast || {};
    resp.finding_text = positive ? "BE-FAST positiv → Schlaganfallverdacht!" : "BE-FAST negativ.";
    resp.feedback = positive ? "Stroke-Alarm!" : "Kein Schlaganfall.";
    resp.score_change = positive ? 30 : 10;
    return { statusCode: 200, headers, body: JSON.stringify(resp) };
  }

  if (action === "Schmerzskala (NRS)") {
    resp.modal_type = "pain";
    resp.modal_data = h.pain || { location: "keine Angabe", nrs: 0 };
    resp.finding_text = h.pain ? `Schmerz: ${h.pain.location}, NRS ${h.pain.nrs}/10` : "Kein Schmerz";
    resp.feedback = "Schmerzskala abgefragt.";
    resp.score_change = 12;
    return { statusCode: 200, headers, body: JSON.stringify(resp) };
  }

  // ==================== NEUE BEFUNDE (ohne Modal) ====================
  const simpleFindings = {
    "Mund inspizieren":     h.mouth   || "Schleimhäute feucht, kein Geruch",
    "Bauch abtasten":       h.abdomen || "Abdomen weich, unauffällig",
    "Pupillen prüfen":      h.pupillen || "isokor, prompt lichtreagibel",
    "Lunge auskultieren":   h.lung    || "vesikulär beidseits",
    "Thorax inspizieren":   "keine äußeren Verletzungen sichtbar",
    "O2 geben":             "Sauerstoff appliziert.",
    "Blutstillung":         h.injuries?.some(i => i.kind === "bleeding") ? "Massive Blutung gestoppt!" : "Keine Blutung",
    "Beckenschlinge anlegen": h.injuries?.some(i => i.kind === "pelvis") ? "Beckenschlinge korrekt angelegt!" : "Keine Beckenverletzung"
  };

  if (simpleFindings[action]) {
    resp.finding_text = simpleFindings[action];
    resp.feedback = action + " durchgeführt.";
    resp.score_change = action.includes("Blut") ? 30 : action.includes("Becken") ? 25 : 10;
    return { statusCode: 200, headers, body: JSON.stringify(resp) };
  }

  // Fallback
  resp.feedback = `${action} durchgeführt.`;
  resp.score_change = 5;
  return { statusCode: 200, headers, body: JSON.stringify(resp) };
}