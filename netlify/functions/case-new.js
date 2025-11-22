// netlify/functions/case-new.js
export async function handler(event) {
  const ALLOWED_ORIGINS = [
    "https://www.mediciq.de",
    "https://mediciq.de",
    "https://mediciq.webflow.io",
    "https://ornate-chimera-b77016.netlify.app"
  ];
  const origin = event.headers?.origin || "";
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

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

    const newId = () => "fall_" + Math.random().toString(36).slice(2, 8);
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const rint = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
    const jitter = (base, range = 5) => base + rint(-range, range);

    const scopeRS = {
      role: "RS",
      allowed_actions: ["Eigenschutz", "XABCDE", "Monitoring", "O₂", "Blutstillung", "Immobilisation"],
      disallowed_examples: ["i.v.-Zugang", "Medikamente (außer SOP)"]
    };
    const scopeNotSan = {
      role: "NotSan",
      allowed_actions: [...scopeRS.allowed_actions, "i.v./i.o.", "Volumen", "SOP-Medikamente"],
      disallowed_examples: ["Narkose"]
    };
    const SCOPE = role === "NotSan" ? scopeNotSan : scopeRS;

    const MAP = {
      internistisch: "internistisch", internal: "internistisch", innere: "internistisch",
      neurologisch: "neurologisch", neuro: "neurologisch",
      trauma: "trauma", traumatologie: "trauma",
      paediatrisch: "paediatrisch", pädiatrisch: "paediatrisch", kind: "paediatrisch"
    };
    const normalized = MAP[specialty] || "internistisch";

    const CASES = {
      internistisch: [
        { diagnosis: "Diabetische Ketoazidose (DKA)", story: "19-jähriger Typ-1-Diabetiker, Durst, Erbrechen, tiefe schnappende Atmung.", patient: { name: "Max Mustermann", age: 19, sex: "m" },
          key_findings: ["Kussmaul-Atmung", "BZ >350", "Exsikkose", "Azetongeruch"], red_flags: ["Bewusstlosigkeit droht"], target_outcome: "Schneller Transport, Flüssigkeit (NotSan)",
          hidden: { lung: "tiefe Kussmaul-Atmung", mouth: "trocken, Azetongeruch", abdomen: "weich, druckschmerzhaft", pain: { location: "Bauch", nrs: 7 } },
          vitals_baseline: { bpSys: 105, bpDia: 65, spo2: 96, af: 28, puls: 110, bz: 420, temp: 37.4, gcs: 14, jitter: 8 }
        },
        { diagnosis: "Akute Hypoglykämie", story: "72-jährige Diabetikerin, plötzlich verwirrt, schwitzt, zittert.", patient: { name: "Hilde K.", age: 72, sex: "w" },
          key_findings: ["BZ <50", "Schwitzen", "Verwirrtheit"], red_flags: ["Krampfanfall droht"],
          hidden: { pain: { nrs: 0 } },
          vitals_baseline: { bpSys: 140, bpDia: 80, spo2: 98, af: 18, puls: 110, bz: 38, temp: 36.6, gcs: 13, jitter: 6 }
        },
        { diagnosis: "Lungenembolie", story: "48-jährige Frau nach Langstreckenflug, plötzlich Luftnot und stechende Thoraxschmerzen.", patient: { name: "Sandra L.", age: 48, sex: "w" },
          hidden: { lung: "rechts basal abgeschwächt" },
          vitals_baseline: { bpSys: 100, bpDia: 65, spo2: 88, af: 32, puls: 124, bz: 110, temp: 37.1, gcs: 15, jitter: 7 }
        }
      ],
      neurologisch: [
        { diagnosis: "Ischämischer Schlaganfall (MCA links)", story: "66-jähriger Mann, plötzlich Sprachstörung und rechtsseitige Schwäche vor 50 Min.", patient: { name: "Werner G.", age: 66, sex: "m" },
          hidden: { befast: { F: true, A: true, S: true }, lkw: "vor 50 Minuten", pupillen: "isokor, prompt" },
          vitals_baseline: { bpSys: 190, bpDia: 100, spo2: 95, af: 18, puls: 82, bz: 140, temp: 36.8, gcs: 12, jitter: 10 }
        }
      ],
      trauma: [
        { diagnosis: "Polytrauma Motorradunfall", story: "34-jähriger Motorradfahrer, Frontalaufprall, Helm abgeflogen, lag bewusstlos.", patient: { name: "Tim R.", age: 34, sex: "m" },
          hidden: { injuries: [{ kind: "bleeding", location: "Oberschenkel links", type: "arterial" }], lung: "rechts abgeschwächt" },
          vitals_baseline: { bpSys: 85, bpDia: 50, spo2: 89, af: 28, puls: 130, bz: 95, temp: 35.9, gcs: 9, jitter: 12 }
        }
      ],
      paediatrisch: [
        { diagnosis: "Schwerer Asthmaanfall", story: "7-jähriges Mädchen mit Asthma, pfeifende Atmung, Einziehungen, spricht kaum.", patient: { name: "Leonie S.", age: 7, sex: "w" },
          hidden: { lung: "diffuses Giemen, prolongiertes Exspirium" },
          vitals_baseline: { bpSys: 105, bpDia: 70, spo2: 88, af: 40, puls: 150, bz: 110, temp: 37.6, gcs: 15, jitter: 6 }
        }
      ]
    };

    const pool = CASES[normalized];
    if (!pool || pool.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Keine Fälle für diese Fachrichtung" }) };
    }

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
      initial_vitals: null,
      key_findings: chosen.key_findings || [],
      red_flags: chosen.red_flags || [],
      target_outcome: chosen.target_outcome || "",
      scope: SCOPE,
      steps_done: [],
      score: 0,
      hidden: { ...chosen.hidden, vitals_baseline: v, expected_dx: chosen.diagnosis },
      solution: { diagnosis: chosen.diagnosis }
    };

    return { statusCode: 200, headers, body: JSON.stringify(caseData) };

  } catch (err) {
    console.error("case-new Fehler:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Interner Fehler" }) };
  }
}