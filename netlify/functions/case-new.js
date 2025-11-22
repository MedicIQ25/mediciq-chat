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

  const cases = {
    internistisch: [
      {
        diagnosis: "Diabetische Ketoazidose (DKA)",
        story: "19-jähriger Typ-1-Diabetiker, seit Tagen Durst, Erbrechen, tiefe schnappende Atmung.",
        patient: { name: "Max Mustermann", age: 19, sex: "m" },
        anamnesis: { SAMPLER: { S: "starker Durst, Übelkeit, Erbrechen", A: "keine", M: "Insulin vergessen", P: "Typ-1-DM", L: "gestern", E: "vergessene Dosis", R: "grippaler Infekt" } },
        hidden: {
          mouth: "trockene Schleimhäute, starker Azetongeruch",
          abdomen: "weich, diffus druckschmerzhaft",
          pain: { location: "Oberbauch", nrs: 7 },
          lung: "tiefe Kussmaul-Atmung",
          pupillen: "isokor, lichtreagibel",
          vitals_baseline: { RR: "100/60", SpO2: 97, AF: 32, Puls: 118, BZ: 485, Temp: "37.8", GCS: 14 }
        }
      },
      {
        diagnosis: "Lungenembolie",
        story: "48-jährige Frau nach Langstreckenflug, plötzlich Luftnot und stechender Thoraxschmerz.",
        patient: { name: "Sandra L.", age: 48, sex: "w" },
        anamnesis: { SAMPLER: { S: "Luftnot, Thoraxschmerz", A: "keine", M: "Pille", P: "DVT vor 5 Jahren", L: "Flug gestern", E: "Immobilisation", R: "Raucherin" } },
        hidden: {
          lung: "rechts basal abgeschwächt",
          pain: { location: "rechts Thorax", nrs: 9 },
          vitals_baseline: { RR: "95/60", SpO2: 86, AF: 34, Puls: 128, BZ: 115, Temp: "37.2", GCS: 15 }
        }
      },
      {
        diagnosis: "Akute Hypoglykämie",
        story: "72-jährige Diabetikerin, plötzlich verwirrt, schwitzt, zittert.",
        patient: { name: "Hilde K.", age: 72, sex: "w" },
        anamnesis: { SAMPLER: { S: "Schwitzen, Zittern", A: "keine", M: "Metformin + Insulin", P: "Typ-2-DM", L: "Mahlzeit ausgelassen", E: "zu viel Insulin", R: "keine" } },
        hidden: { vitals_baseline: { RR: "145/85", SpO2: 99, AF: 18, Puls: 62, BZ: 32, Temp: "36.5", GCS: 13 } }
      }
    ],
    neurologisch: [
      {
        diagnosis: "Ischämischer Schlaganfall",
        story: "66-jähriger Mann, plötzlich Sprachstörung und rechtsseitige Schwäche vor 45 Min.",
        patient: { name: "Werner G.", age: 66, sex: "m" },
        hidden: {
          befast: { F: true, A: true, S: true },
          vitals_baseline: { RR: "195/105", SpO2: 94, AF: 18, Puls: 78, BZ: 138, Temp: "36.7", GCS: 11 }
        }
      }
    ]
  };

  const pool = cases[specialty] || cases.internistisch;
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      id: "fall_" + Date.now(),
      specialty,
      story: chosen.story,
      patient: chosen.patient,
      anamnesis: chosen.anamnesis || {},
      hidden: chosen.hidden,
      score: 0,
      steps_done: [],
      solution: { diagnosis: chosen.diagnosis }
    })
  };
}