// netlify/functions/case-step.js
export async function handler(event) {
  // ===== 1) CORS =====
  const ALLOWED_ORIGINS = [
    'https://www.mediciq.de',
    'https://mediciq.de',
    'https://mediciq.webflow.io'
  ];
  const reqOrigin = event.headers.origin || event.headers.Origin || '';
  const allowOrigin = ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0];
  const headers = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const { case_state, user_action, role = 'RS' } = JSON.parse(event.body || '{}');
    if (!case_state || !user_action) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'case_state oder user_action fehlt' }) };
    }

    // ===== 2) Helper =====
    const text = String(user_action || '').trim().toLowerCase();
    const includesAny = (arr) => arr.some(k => text.includes(k));

    const hidden = case_state.hidden || {};
    const base = hidden.vitals_baseline || {};
    const keepVitals = (v) => ({
      RR: v?.RR ?? null,
      SpO2: v?.SpO2 ?? null,
      AF: v?.AF ?? null,
      Puls: v?.Puls ?? null,
      BZ: v?.BZ ?? null,
      Temp: v?.Temp ?? null,
      GCS: v?.GCS ?? null,
    });

    let result = {
      accepted: false,
      outside_scope: false,
      unsafe: false,
      score_delta: 0,
      rationale: "",
      next_hint: "",
      updated_vitals: null,
      observation: null,   // <- kurzer Befundtext
      done: false,
      solution: null       // <- wird nur bei "Lösung" / Diagnoseabfrage gefüllt
    };

    // ===== 3) Sicherheits-/Scope-Check minimal (nur RS/NotSan) =====
    const isRS = (role || case_state?.scope?.role || 'RS') === 'RS';

    // ===== 4) Heuristiken für typische Schritte =====

    // --- Messungen: RR ---
    if (includesAny(['rr', 'blutdruck'])) {
      result.accepted = true;
      result.score_delta = 1;
      result.rationale = "Blutdruck gemessen.";
      result.observation = `RR: ${base.RR || '—'}`;
      result.updated_vitals = keepVitals({ ...base });
      result.next_hint = "Weitere Vitalparameter erheben (Puls, SpO₂, AF, BZ).";
    }

    // --- SpO2 ---
    else if (includesAny(['spo2', 'sättigung', 'sauerstoffsättigung'])) {
      result.accepted = true;
      result.score_delta = 1;
      result.rationale = "SpO₂ gemessen.";
      result.observation = `SpO₂: ${base.SpO2 ?? '—'} %`;
      result.updated_vitals = keepVitals({ ...base });
      if (base.SpO2 && base.SpO2 < 90) {
        result.next_hint = "O₂-Gabe ist indiziert. Monitoring fortführen.";
      } else {
        result.next_hint = "Monitoring fortführen.";
      }
    }

    // --- AF ---
    else if (includesAny(['af ', 'atemfrequenz', 'respiration'])) {
      result.accepted = true;
      result.score_delta = 1;
      result.rationale = "Atemfrequenz gezählt.";
      result.observation = `AF: ${base.AF ?? '—'} /min`;
      result.updated_vitals = keepVitals({ ...base });
      result.next_hint = "Weiter Puls und EKG erheben.";
    }

    // --- Puls ---
    else if (includesAny(['puls', 'herzfrequenz'])) {
      result.accepted = true;
      result.score_delta = 1;
      result.rationale = "Puls gezählt.";
      result.observation = `Puls: ${base.Puls ?? '—'} /min`;
      result.updated_vitals = keepVitals({ ...base });
      result.next_hint = "EKG ableiten (3- oder 12-Kanal) und Monitoring fortführen.";
    }

    // --- BZ ---
    else if (includesAny(['bz', 'blutzucker'])) {
      result.accepted = true;
      result.score_delta = 1;
      result.rationale = "BZ gemessen (v. a. bei neurologischen Symptomen wichtig).";
      result.observation = `BZ: ${base.BZ ?? '—'} mg/dl`;
      result.updated_vitals = keepVitals({ ...base });
      result.next_hint = "Neurologische Untersuchung/BEFAST ergänzen.";
    }

    // --- Temp ---
    else if (includesAny(['temp', 'temperatur', 'fieber'])) {
      result.accepted = true;
      result.score_delta = 1;
      result.rationale = "Temperatur gemessen.";
      result.observation = `Temp: ${base.Temp ?? '—'} °C`;
      result.updated_vitals = keepVitals({ ...base });
      result.next_hint = "Monitoring, weitere Diagnostik.";
    }

    // --- GCS ---
    else if (includesAny(['gcs', 'bewusstsein'])) {
      result.accepted = true;
      result.score_delta = 1;
      result.rationale = "GCS/Bewusstseinslage erhoben.";
      result.observation = `GCS: ${base.GCS ?? '—'}`;
      result.updated_vitals = keepVitals({ ...base });
      result.next_hint = "ABCDE fortführen, Pupillenreaktion prüfen.";
    }

    // --- Pupillen ---
    else if (includesAny(['pupille', 'pupillen'])) {
      result.accepted = true;
      result.score_delta = 1;
      result.rationale = "Pupillen geprüft.";
      result.observation = hidden.pupils || "isokor, prompt lichtreagibel";
      result.next_hint = "Neurologischen Status/BEFAST prüfen.";
    }

    // --- Mundraum ---
    else if (includesAny(['mund', 'mundraum', 'zunge'])) {
      result.accepted = true;
      result.score_delta = 1;
      result.rationale = "Mundraum inspiziert.";
      result.observation = hidden.mouth || "unauffällig, keine Aspiration.";
      result.next_hint = "Weiter ABCDE/Monitoring.";
    }

    // --- Auskultation Lunge ---
    else if (includesAny(['auskultation', 'lunge'])) {
      result.accepted = true;
      result.score_delta = 1;
      result.rationale = "Lunge auskultiert.";
      result.observation = hidden.lung || "seitengleiches Atemgeräusch, keine RGs.";
      result.next_hint = "AF/SpO₂ im Blick, ggf. O₂ bei Hypoxie.";
    }

    // --- Abdomen ---
    else if (includesAny(['abdomen', 'bauch'])) {
      result.accepted = true;
      result.score_delta = 1;
      result.rationale = "Abdomen palpiert.";
      result.observation = hidden.abdomen || "weich, keine Abwehrspannung.";
      result.next_hint = "ABCDE fortsetzen.";
    }

    // --- EKG 3-Kanal ---
    else if (includesAny(['3-kanal', '3 kanal', 'monitor', 'monitoring ekg'])) {
      result.accepted = true;
      result.score_delta = 1;
      result.rationale = "3-Kanal-EKG abgeleitet.";
      result.observation = hidden.ekg3 || "Sinusrhythmus, Frequenz ~90/min, keine Hebungen";
      result.next_hint = "Bei Thoraxschmerz 12-Kanal-EKG ergänzen.";
    }

    // --- EKG 12-Kanal ---
    else if (includesAny(['12-kanal', '12 kanal', 'zwölf-kanal', '12kanal'])) {
      result.accepted = true;
      result.score_delta = 2;
      result.rationale = "12-Kanal-EKG abgeleitet.";
      result.observation = hidden.ekg12 || "Kein STEMI-Muster, Sinusrhythmus.";
      if (hidden.ekg12?.toLowerCase().includes('st-heb')) {
        result.next_hint = "ACS/STEMI wahrscheinlich → zügiger Transport, NA nachfordern je nach SOP.";
      } else {
        result.next_hint = "EKG kontrollieren/überwachen, weitere Diagnostik.";
      }
    }

    // --- BEFAST / neurologisch ---
    else if (includesAny(['befast', 'neurologisch', 'stroke-screen', 'stroke screen'])) {
      result.accepted = true;
      result.score_delta = 2;
      result.rationale = "BEFAST/neurologischer Status erhoben.";
      if (hidden.befast) {
        const b = hidden.befast;
        result.observation =
          `BEFAST: Balance=${b.Balance}; Face=${b.Face}; Arms=${b.Arms}; Speech=${b.Speech}; Time=${b.Time}`;
      } else if (hidden.neuro) {
        result.observation = `Neurologischer Status: ${hidden.neuro}`;
      } else {
        result.observation = "Keine fokalneurologischen Auffälligkeiten.";
      }
      result.next_hint = "Stroke-Unit Transport erwägen (Zeitfenster beachten) / BZ prüfen.";
    }

    // --- O2 geben (als Hinweis, keine automatische Vitalveränderung) ---
    else if (includesAny(['o2', 'sauerstoff', 'oxygen'])) {
      result.accepted = true;
      result.score_delta = 1;
      result.rationale = "Sauerstoffgabe in Erwägung gezogen / begonnen (Indikation beachten).";
      result.next_hint = "Monitoring fortführen, SpO₂-Trend beobachten.";
    }

    // --- ABCDE allgemein / unspezifisch ---
    else if (includesAny(['abcde', 'primary survey'])) {
      result.accepted = true;
      result.score_delta = 1;
      result.rationale = "ABCDE strukturiert abgearbeitet.";
      result.next_hint = "Gezielt Messungen/Befunde ergänzen (z. B. SpO₂, EKG, Pupillen, BZ).";
    }

    // --- Diagnose / Lösung anfordern ---
    else if (includesAny(['lösung', 'loesung', 'diagnose', 'was hat der patient', 'was hat die patientin'])) {
      result.accepted = true;
      result.score_delta = 0;
      result.rationale = "Zusammenfassung & Lernziel/Diagnose.";
      result.solution = case_state.solution || {
        diagnosis: "Verdachtsdiagnose nicht eindeutig.",
        justification: []
      };
      result.done = true;
      result.next_hint = "Falls etwas fehlt: gezielte Diagnostik ergänzen (EKG/BEFAST/BZ etc.).";
    }

    // --- Unbekannte Aktion: Knappes Coaching ---
    else {
      result.accepted = false;
      result.score_delta = 0;
      result.rationale = "Aktion nicht eindeutig zuordenbar.";
      result.next_hint = "Nutze klare Kurzbefehle, z. B. „RR messen“, „SpO₂ messen“, „Pupillen prüfen“, „12-Kanal-EKG“, „BEFAST“.";
    }

    // ===== 5) Rückgabe =====
    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
