export async function handler(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  const { action, case: c } = JSON.parse(event.body || "{}");
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

  // Vitalwerte
  if (action.includes("messen") || action === "GCS bestimmen") {
    const map = { RR: v.RR, SpO2: v.SpO2 + " %", AF: v.AF + "/min", Puls: v.Puls + "/min", BZ: v.BZ + " mg/dl", Temp: v.Temp + " °C", GCS: v.GCS + "/15" };
    const key = action.split(" ")[0].replace("mess", "").replace("en", "").replace("bestimmen", "");
    if (map[key]) {
      resp.vitals_update[key] = map[key];
      resp.feedback = `${action}: ${map[key]}`;
      resp.score_change = 10;
      return { statusCode: 200, headers, body: JSON.stringify(resp) };
    }
  }

  // Befunde + Modals
  if (action === "Mund inspizieren") { resp.finding_text = h.mouth || "feucht, unauffällig"; resp.score_change = 15; }
  else if (action === "Bauch abtasten") { resp.finding_text = h.abdomen || "weich"; resp.score_change = 15; }
  else if (action === "Schmerzskala (NRS)") { resp.modal_type = "pain"; resp.modal_data = h.pain || { location: "keiner", nrs: 0 }; resp.score_change = 15; }
  else if (action === "SAMPLER") { resp.modal_type = "sampler"; resp.modal_data = a.SAMPLER; resp.score_change = 20; }
  else if (action === "BE-FAST") { resp.modal_type = "befast"; resp.modal_data = h.befast || {}; resp.finding_text = h.befast ? "BE-FAST positiv!" : "BE-FAST negativ"; resp.score_change = h.befast ? 30 : 10; }
  else if (action === "4S-Schema") { resp.modal_type = "4s"; resp.score_change = 10; }
  else if (action === "Lunge auskultieren") { resp.finding_text = h.lung || "vesikulär beidseits"; resp.score_change = 15; }
  else if (action === "Pupillen prüfen") { resp.finding_text = h.pupillen || "isokor, prompt"; resp.score_change = 10; }
  else if (action === "Blutstillung") { resp.feedback = "Massive Blutung gestoppt!"; resp.score_change = 30; }
  else { resp.feedback = `${action} durchgeführt.`; resp.score_change = 5; }

  return { statusCode: 200, headers, body: JSON.stringify(resp) };
}