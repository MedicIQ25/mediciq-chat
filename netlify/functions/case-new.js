// netlify/functions/case-new.js
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Pfad zur cases.json (Netlify unterstützt __dirname nicht direkt → workaround)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function handler(event) {
  // ----- CORS -----
  const ALLOWED_ORIGINS = [
    "https://www.mediciq.de",
    "https://mediciq.de",
    "https://mediciq.webflow.io"
  ];
  const reqOrigin = event.headers?.origin || event.headers?.Origin || "";
  const allowOrigin = ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0];

  const headers = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const specialty = (body.specialty || "internistisch").toString().toLowerCase();
    const role = (body.role || "RS").toString();

    // ----- Helper -----
    const newId = () => "fall_" + Math.random().toString(36).slice(2, 8);
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const rint = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
    const jitter = (base, range = 5) => base + rint(-range, range);

    // ----- Rollen-Scope -----
    const scopeRS = {
      role: "RS",
      allowed_actions: ["Eigenschutz", "XABCDE", "Monitoring", "O₂", "Blutstillung", "Immobilisation", "Transport"],
      disallowed_examples: ["i.v.-Zugang", "Medikamente (außer SOP)"]
    };
    const scopeNotSan = {
      role: "NotSan",
      allowed_actions: [...scopeRS.allowed_actions, "i.v./i.o.", "Volumen", "SOP-Medikamente"],
      disallowed_examples: ["Narkose"]
    };
    const SCOPE = role === "NotSan" ? scopeNotSan : scopeRS;

    // ----- Specialty Mapping -----
    const MAP = {
      internistisch: "internistisch", internal: "internistisch", innere: "internistisch",
      neurologisch: "neurologisch", neuro: "neurologisch",
      trauma: "trauma", traumatologie: "trauma",
      paediatrisch: "paediatrisch", pädiatrisch: "paediatrisch", kind: "paediatrisch", pädiatrie: "paediatrisch"
    };
    const normalized = MAP[specialty] || "internistisch";

    // ----- Lade alle Fälle aus cases.json -----
    const casesData = JSON.parse(readFileSync(join(__dirname, "cases.json"), "utf8"));
    const pool = casesData[normalized];
    if (!pool || pool.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Keine Fälle für diese Fachrichtung" }) };
    }

    const chosen = pick(pool);

    // Vitalwerte mit Jitter berechnen
    const base = chosen.vitals_baseline;
    const v = {
      RR: `${jitter(base.bpSys, base.jitter)}/${jitter(base.bpDia, base.jitter)}`,
      SpO2: jitter(base.spo2, base.jitter),
      AF: jitter(base.af, base.jitter),
      Puls: jitter(base.puls, base.jitter),
      BZ: jitter(base.bz, base.jitter ?? 20),
      Temp: base.temp + (Math.random() * 0.4 - 0.2).toFixed(1),
      GCS: base.gcs
    };

    const caseData = {
      id: newId(),
      specialty: normalized,
      role: role,
      story: chosen.story,
      initial_vitals: null,                    // bleibt leer → werden erst bei Messung sichtbar
      key_findings: chosen.key_findings,
      red_flags: chosen.red_flags,
      target_outcome: chosen.target_outcome,
      scope: SCOPE,
      steps_done: [],
      score: 0,
      hidden: {
        ...chosen.hidden,
        vitals_baseline: v,
        expected_dx: chosen.diagnosis
      },
      patient: chosen.patient,
      anamnesis: chosen.anamnesis,
      patho: chosen.patho || {},
      solution: { diagnosis: chosen.diagnosis }
    };

    return { statusCode: 200, headers, body: JSON.stringify(caseData) };

  } catch (err) {
    console.error("case-new error:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
}