// netlify/functions/case-step.js
export async function handler(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  try {
    const { action, case: currentCase } = JSON.parse(event.body || "{}");

    // Vitalwerte erst bei Messung sichtbar machen
    if (["RR", "SpO2", "AF", "Puls", "BZ", "Temp", "GCS"].includes(action)) {
      const v = currentCase.hidden.vitals_baseline;
      const display = {
        RR: v.RR,
        SpO2: v.SpO2 + " %",
        AF: v.AF + "/min",
        Puls: v.Puls + "/min",
        BZ: v.BZ + " mg/dl",
        Temp: v.Temp + " °C",
        GCS: v.GCS + "/15"
      };
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          feedback: `${action} gemessen: ${display[action]}`,
          vitals: { [action]: display[action] },
          score_change: 5
        })
      };
    }

    // Neue Befunde
    const findings = {
      "Mund inspizieren": currentCase.hidden.mouth || "Mundschleimhaut feucht, kein besonderer Befund",
      "Bauch abtasten": currentCase.hidden.abdomen || "Abdomen weich, unauffällig",
      "Schmerz abfragen": currentCase.hidden.pain ? `Schmerz im ${currentCase.hidden.pain.location}, NRS ${currentCase.hidden.pain.nrs}/10` : "Patient gibt keinen Schmerz an",
      "Pupillen prüfen": currentCase.hidden.pupillen || "Pupillen isokor, prompt lichtreagibel",
      "Lunge auskultieren": currentCase.hidden.lung || "Vesikuläres Atemgeräusch beidseits, kein Nebengeräusch",
      "BE-FAST": currentCase.hidden.befast ? "BE-FAST positiv → Verdacht auf Schlaganfall!" : "BE-FAST negativ",
      "SAMPLER": currentCase.anamnesis?.SAMPLER || { S: "keine Angaben", A: "-", M: "-", P: "-", L: "-", E: "-", R: "-" },
    };

    if (findings[action]) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          feedback: findings[action],
          score_change: action === "BE-FAST" && currentCase.hidden.befast ? 20 : 10
        })
      };
    }

    // Standard-ABCDE-Feedback (kann später erweitert werden)
    const abcdeFeedback = {
      "XABCDE": "X-ABCDE-Schema korrekt angewendet! +15 Punkte",
      "Eigenschutz": "Eigenschutz beachtet – sehr gut!",
      "O₂": "Sauerstoff appliziert – korrekt bei SpO₂ <94%",
      "Blutstillung": currentCase.hidden.injuries ? "Massive Blutung erfolgreich gestoppt! +25" : "Keine relevante Blutung vorhanden"
    };

    if (abcdeFeedback[action]) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          feedback: abcdeFeedback[action],
          score_change: abcdeFeedback[action].includes("+") ? parseInt(abcdeFeedback[action].match(/\+\d+/)?.[0] || 10) : 10
        })
      };
    }

    // Fallback
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        feedback: `${action} durchgeführt.`,
        score_change: 5
      })
    };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Interner Fehler" }) };
  }
}