export async function handler(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  const body = event.body ? JSON.parse(event.body) : {};
  const specialty = (body.specialty || "internistisch").toLowerCase();

  const id = "fall_" + Math.random().toString(36).substr(2, 6);

  const cases = {
    internistisch: [
      {
        diagnosis: "Diabetische Ketoazidose",
        story: "19-jähriger Typ-1-Diabetiker, seit Tagen Durst, Erbrechen, tiefe schnappende Atmung.",
        patient: { name: "Max Mustermann", age: 19, sex: "m" },
        hidden: {
          mouth: "trockene Schleimhäute, starker Azetongeruch",
          abdomen: "weich, diffus druckschmerzhaft",
          pain: { location: "Oberbauch", nrs: 7 },
          lung: "tiefe Kussmaul-Atmung",
          vitals_baseline: { RR: "100/60", SpO2: 97, AF: 32, Puls: 118, BZ: 485, Temp: "37.8", GCS: 14 }
        }
      },
      {
        diagnosis: "Akute Hypoglykämie",
        story: "72-jährige Diabetikerin, plötzlich verwirrt, schwitzt, zittert.",
        patient: { name: "Hilde K.", age: 72, sex: "w" },
        hidden: {
          mouth: "feucht, kein Geruch",
          pain: { location: "keiner", nrs: 0 },
          vitals_baseline: { RR: "145/85", SpO2: 99, AF: 18, Puls: 62, BZ: 32, Temp: "36.5", GCS: 13 }
        }
      },
      {
        diagnosis: "Lungenembolie",
        story: "48-jährige Frau nach Langstreckenflug, plötzlich Luftnot + stechender Thoraxschmerz.",
        patient: { name: "Sandra L.", age: 48, sex: "w" },
        hidden: {
          lung: "rechts basal abgeschwächt",
          pain: { location: "rechts Thorax", nrs: 9 },
          vitals_baseline: { RR: "95/60", SpO2: 86, AF: 34, Puls: 128, BZ: 115, Temp: "37.2", GCS: 15 }
        }
      }
    ],
    neurologisch: [
      {
        diagnosis: "Ischämischer Schlaganfall",
        story: "66-jähriger Mann, plötzlich Sprachstörung + rechtsseitige Schwäche vor 45 Min.",
        patient: { name: "Werner G.", age: 66, sex: "m" },
        hidden: {
          befast: { F: true, A: true, S: true },
          pupillen: "isokor, prompt",
          vitals_baseline: { RR: "195/105", SpO2: 94, AF: 18, Puls: 78, BZ: 138, Temp: "36.7", GCS: 11 }
        }
      }
    ]
  };

  const pool = cases[specialty] || cases.internistisch;
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  const base = {
    id,
    specialty,
    story: chosen.story,
    patient: chosen.patient,
    hidden: chosen.hidden,
    score: 0,
    steps_done: [],
    solution: { diagnosis: chosen.diagnosis }
  };

  return { statusCode: 200, headers, body: JSON.stringify(base) };
}