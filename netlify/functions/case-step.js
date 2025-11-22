export async function handler(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  let input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { action, case: c } = input;
  if (!action || !c) return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing action or case" }) };

  const h = c.hidden || {};
  const v = h.vitals_baseline || {};
  const a = c.anamnesis || {};

  const resp = {
    feedback: "",
    vitals_update: {},
    finding_text: "",
    modal_type: null,
    modal_data: null,
    score_change: 0
  };

  // Vitalwerte (dynamisch)
  const vitalActions = {
    "RR messen": "RR", "SpO2 messen": "SpO2", "AF messen": "AF", "Puls messen": "Puls", "BZ messen": "BZ", "Temperatur messen": "Temp", "GCS bestimmen": "GCS"
  };
  if (vitalActions[action]) {
    const key = vitalActions[action];
    const val = v[key];
    if (val) {
      resp.vitals_update[key] = val;
      resp.feedback = `${action}: ${val}`;
      resp.score_change = 10;
    }
    return { statusCode: 200, headers, body: JSON.stringify(resp) };
  }

  // Modals mit vollen Data
  if (action === "SAMPLER") {
    resp.modal_type = "sampler";
    resp.modal_data = a.SAMPLER || { S: "keine Angaben", A: "keine", M: "keine", P: "keine", L: "keine", E: "keine", R: "keine" };
    resp.feedback = "SAMPLER-Anamnese geöffnet.";
    resp.score_change = 20;
  } else if (action === "BE-FAST") {
    resp.modal_type = "befast";
    resp.modal_data = h.befast || { B: false, E: false, F: false, A: false, S: false };
    resp.finding_text = h.befast ? "BE-FAST positiv – Stroke-Alarm!" : "BE-FAST negativ.";
    resp.feedback = "BE-FAST durchgeführt.";
    resp.score_change = h.befast ? 30 : 10;
  } else if (action === "Schmerzskala (NRS)") {
    resp.modal_type = "nrs";
    resp.modal_data = h.pain || { location: "keine", nrs: 0 };
    resp.finding_text = h.pain ? `NRS ${h.pain.nrs}/10 im ${h.pain.location}` : "Kein Schmerz.";
    resp.feedback = "Schmerzskala geöffnet.";
    resp.score_change = 15;
  } else if (action === "4S-Schema") {
    resp.modal_type = "4s";
    resp.modal_data = { // Beispiel-Data für 4S
      sicherheit: "Umfeld gesichert",
      szene: "Szene beurteilt",
      sichtung: "1 Patient",
      support: "NotSan nachgefordert"
    };
    resp.feedback = "4S-Schema geöffnet.";
    resp.score_change = 10;
  } else if (action === "Mund inspizieren") {
    resp.finding_text = h.mouth || "Normale Schleimhäute.";
    resp.feedback = "Mund inspiziert.";
    resp.score_change = 12;
  } else if (action === "Bauch abtasten") {
    resp.finding_text = h.abdomen || "Abdomen weich.";
    resp.feedback = "Bauch abgetastet.";
    resp.score_change = 12;
  } else if (action === "Lunge auskultieren") {
    resp.finding_text = h.lung || "Normale Atemgeräusche.";
    resp.feedback = "Lunge auskultiert.";
    resp.score_change = 15;
  } else if (action === "Pupillen prüfen") {
    resp.finding_text = h.pupillen || "Pupillen normal.";
    resp.feedback = "Pupillen geprüft.";
    resp.score_change = 10;
  } else if (action === "O2 geben") {
    resp.feedback = "Sauerstoff appliziert – SpO2 verbessert sich.";
    resp.score_change = 20;
  } else if (action === "Blutstillung") {
    if (h.injuries) {
      resp.feedback = "Blutung gestoppt – RR stabilisiert.";
      resp.score_change = 30;
    } else {
      resp.feedback = "Keine Blutung vorhanden.";
      resp.score_change = 5;
    }
  } else {
    resp.feedback = `${action} durchgeführt.`;
    resp.score_change = 5;
  }

  return { statusCode: 200, headers, body: JSON.stringify(resp) };
}