// netlify/functions/case-new.js
export async function handler(event) {
  const ALLOWED_ORIGINS = ["https://www.mediciq.de", "https://mediciq.de", "https://mediciq.webflow.io", "https://ornate-chimera-b77016.netlify.app"];
  const reqOrigin = event.headers?.origin || "";
  const allowOrigin = ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0];

  const headers = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const specialty = (body.specialty || "internistisch").toLowerCase();
    const role = (body.role || "RS");

    const newId = () => "fall_" + Math.random().toString(36).slice(2, 8);
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const rint = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
    const jitter = (base, range = 5) => base + rint(-range, range);

    const scopeRS = { role: "RS", allowed_actions: ["alles bis SOP"], disallowed_examples: ["i.v.", "Medis"] };
    const scopeNotSan = { role: "NotSan", allowed_actions: [...scopeRS.allowed_actions, "i.v./i.o.", "Volumen", "SOP-Medis"] };
    const SCOPE = role === "NotSan" ? scopeNotSan : scopeRS;

    const MAP = { internistisch: "internistisch", neurologisch: "neurologisch", trauma: "trauma", paediatrisch: "paediatrisch" };
    const normalized = MAP[specialty] || "internistisch";

    // ─── ALLE FÄLLE DIREKT IM CODE (kein externes JSON mehr!) ─────────────────
    const ALL_CASES = {
      internistisch: [
        { diagnosis: "Diabetische Ketoazidose (DKA)", story: "19-jähriger Typ-1-Diabetiker, Durst, Erbrechen, Kussmaul-Atmung.", patient: { name: "Max Mustermann", age: 19, sex: "m" },
          key_findings: ["Kussmaul", "BZ >350", "Exsikkose"], red_flags: ["Azidose", "Bewusstlosigkeit"], target_outcome: "Transport + Flüssigkeit",
          hidden: { lung: "tiefe Kussmaul-Atmung", mouth: "trocken, Azetongeruch", abdomen: "weich, druckdolent", pain: { location: "Bauch", nrs: 7 } },
          vitals_baseline: { bpSys: 105, bpDia: 65, spo2: 96, af: 28, puls: 110, bz: 420, temp: 37.4, gcs: 14, jitter: 8 }
        },
        { diagnosis: "Akute Hypoglykämie", story: "72-jährige Diabetikerin, verwirrt, schwitzt, zittert.", patient: { name: "Hilde K.", age: 72, sex: "w" },
          hidden: { pain: { nrs: 0 } }, vitals_baseline: { bpSys: 140, bpDia: 80, spo2: 98, af: 18, puls: 110, bz: 38, temp: 36.6, gcs: 13, jitter: 6 }
        },
        { diagnosis: "Lungenembolie", story: "48-jährige Frau nach Flug, plötzlich Luftnot + Thoraxschmerz.", patient: { name: "Sandra L.", age: 48, sex: "w" },
          hidden: { lung: "rechts basal abgeschwächt" }, vitals_baseline: { bpSys: 100, bpDia: 65, spo2: 88, af: 32, puls: 124, bz: 110, temp: 37.1, gcs: 15, jitter: 7 }
        }
      ],
      neurologisch: [
        { diagnosis: "Ischämischer Schlaganfall (MCA links)", story: "66-jähriger Mann, plötzlich Aphasie + Rechtschwäche.", patient: { name: "Werner G.", age: 66, sex: "m" },
          hidden: { befast: { F: true, A: true, S: true }, lkw: "vor 50 Minuten" }, vitals_baseline: { bpSys: 190, bpDia: 100, spo2: 95, af: 18, puls: 82, bz: 140, temp: 36.8, gcs: 12, jitter: 10 }
        }
      ],
      trauma: [
        { diagnosis: "Polytrauma Motorradunfall", story: "34-jähriger Motorradfahrer, offene Oberschenkelfraktur + Beckenschmerz.", patient: { name: "Tim R.", age: 34, sex: "m" },
          hidden: { injuries: [{ kind: "bleeding", location: "Oberschenkel links", type: "arterial" }], lung: "rechts abgeschwächt" },
          vitals_baseline: { bpSys: 85, bpDia: 50, spo2: 89, af: 28, puls: 130, bz: 95, temp: 35.9, gcs: 9, jitter: 12 }
        }
      ],
      paediatrisch: [
        { diagnosis: "Schwerer Asthmaanfall", story: "7-jähriges Mädchen, Giemen, Einziehungen, SpO₂ 88%.", patient: { name: "Leonie S.", age: 7, sex: "w" },
          hidden: { lung: "diffuses Giemen, prolongiertes Exspirium" }, vitals_baseline: { bpSys: 105, bpDia: 70, spo2: 88, af: 40, puls: 150, bz: 110, temp: 37.6, gcs: 15, jitter: 6 }
        }
      ]
    };
    // ───────────────────────────────────────────────────────────────────────

    const pool = ALL_CASES[normalized];
    if (!pool) return { statusCode: 400, headers, body: JSON.stringify({ error: "Fachrichtung nicht gefunden" }) };

    const chosen = pick(pool);
    const b = chosen.vitals_baseline;
    const v = {
      RR: `${jitter(b.bpSys, b.jitter)}/${jitter(b.bpDia, b.jitter)}`,
      SpO2: jitter(b.spo2, b.jitter),
      AF: jitter(b.af, b.jitter),
      Puls: jitter(b.puls, b.jitter),
      BZ: jitter(b.bz, b.jitter ?? 20),
      Temp: (b.temp + (Math.random() * 0.4 - 0.2)).toFixed(1),
      GCS: b.gcs
    };

    const caseData = {
      id: newId(),
      specialty: normalized,
      role: role,
      story: chosen.story,
      patient: chosen.patient,
      key_findings: chosen.key_findings || [],
      red_flags: chosen.red_flags || [],
      target_outcome: chosen.target_outcome || "",
      scope: SCOPE,
      steps_done: [],
      score: 0,
      hidden: { ...chosen.hidden, vitals_baseline: v, expected_dx: chosen.diagnosis },
      anamnesis: chosen.anamnesis || { SAMPLER: {} },
      patho: chosen.patho || {},
      solution: { diagnosis: chosen.diagnosis }
    };

    return { statusCode: 200, headers, body: JSON.stringify(caseData) };

  } catch (err) {
    console.error("case-new Fehler:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
}