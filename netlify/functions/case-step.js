// netlify/functions/case-step.js
// Voll kompatibel mit deinem aktuellen Frontend + alle neuen Befunde
export async function handler(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  let input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { action, case: currentCase } = input;
  if (!action || !currentCase) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing action or case" }) };
  }

  const hidden = currentCase.hidden || {};
  const vitals = hidden.vitals_baseline || {};
  let response = {
    feedback: "",
    vitals_update: {},
    finding_text: "",
    modal_type: null,
    modal_data: null,
    score_change: 0
  };

  // ==================== VITALWERTE ====================
  const vitalMap = {
    "RR messen": { key: "RR", val: vitals.RR ? `${vitals.RR} mmHg` : "105/65 mmHg" },
    "SpO2 messen": { key: "SpO2", val: vitals.SpO2 ? `${vitals.SpO2} %` : "96 %" },
    "AF messen": { key: "AF", val: vitals.AF ? `${vitals.AF}/min` : "28/min" },
    "Puls messen": { key: "Puls", val: vitals.Puls ? `${vitals.Puls}/min` : "110/min" },
    "BZ messen": { key: "BZ", val: vitals.BZ ? `${vitals.BZ} mg/dl` : "420 mg/dl" },
    "Temperatur messen": { key: "Temp", val: vitals.Temp ? `${vitals.Temp} °C` : "37.4 °C" },
    "GCS bestimmen": { key: "GCS", val: vitals.GCS ? `${vitals.GCS}/15` : "14/15" }
  };

  if (vitalMap[action]) {
    response.vitals_update[vitalMap[action].key] = vitalMap[action].val;
    response.feedback = `${action}: ${vitalMap[action].val}`;
    response.score_change = 8;
    return { statusCode: 200, headers, body: JSON.stringify(response) };
  }

  // ==================== NEUE BEFUNDE ====================
  const findings = {
    "Mund inspizieren": hidden.mouth || "Schleimhäute feucht, kein Geruch",
    "Bauch abtasten": hidden.abdomen || "Abdomen weich, unauffällig",
    "Schmerz abfragen": hidden.pain ? `Schmerz im ${hidden.pain.location}, NRS ${hidden.pain.nrs}/10` : "Kein Schmerz angegeben",
    "Pupillen prüfen": hidden.pupillen || "Pupillen isokor, prompt lichtreagibel",
    "Lunge auskultieren": hidden.lung || "Vesikuläres Atemgeräusch beidseits",
    "Thorax inspizieren": hidden.chest || "Keine sichtbaren Verletzungen",
    "BE-FAST": hidden.befast ? "BE-FAST positiv → sofort Stroke-Unit!" : "BE-FAST negativ",
    "SAMPLER": currentCase.anamnesis?.SAMPLER || null
  };

  if (findings[action]) {
    response.finding_text = findings[action];
    response.feedback = action + " durchgeführt.";
    response.score_change = action === "BE-FAST" && hidden.befast ? 25 : 12;

    if (action === "SAMPLER" && findings[action]) {
      response.modal_type = "sampler";
      response.modal_data = findings[action];
    }
    if (action === "BE-FAST") {
      response.modal_type = "befast";
      response.modal_data = findings[action] === "BE-FAST positiv → sofort Stroke-Unit!" ? { positive: true } : { positive: false };
    }

    return { statusCode: 200, headers, body: JSON.stringify(response) };
  }

  // ==================== STANDARD-AKTIONEN ====================
  const standard = {
    "O2 geben": "Sauerstoff appliziert.",
    "Blutstillung": hidden.injuries?.some(i => i.kind === "bleeding") ? "Massive Blutung gestoppt! +30" : "Keine relevante Blutung",
    "Beckenschlinge anlegen": hidden.injuries?.some(i => i.kind === "pelvis") ? "Beckenschlinge korrekt angelegt! +20" : "Keine Beckeninstabilität",
    "X-ABCDE": "Systematisches Vorgehen – sehr gut! +15",
    "Eigenschutz": "Eigenschutz beachtet – top! +10"
  };

  if (standard[action]) {
    response.feedback = standard[action];
    response.score_change = standard[action].includes("+") ? parseInt(standard[action].match(/\+(\d+)/)[1]) : 10;
    return { statusCode: 200, headers, body: JSON.stringify(response) };
  }

  // Fallback
  response.feedback = `${action} durchgeführt.`;
  response.score_change = 5;
  return { statusCode: 200, headers, body: JSON.stringify(response) };
}