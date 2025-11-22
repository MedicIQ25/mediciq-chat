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
  const role = body.role || "RS";

  const id = "fall_" + Math.random().toString(36).substr(2, 6);

  const cases = {
    internistisch: [
      {
        diagnosis: "Diabetische Ketoazidose",
        story: "19-jähriger Typ-1-Diabetiker, seit Tagen Durst, Erbrechen, tiefe schnappende Atmung.",
        patient: { name: "Max Mustermann", age: 19, sex: "m" },
        anamnesis: {
          SAMPLER: {
            S: "starker Durst, Polyurie, Übelkeit, Erbrechen",
            A: "keine",
            M: "Insulin (vergessen)",
            P: "Typ-1-Diabetes seit 10 Jahren",
            L: "letzte Mahlzeit vor 12 Std.",
            E: "vergessene Insulindosis",
            R: "grippaler Infekt"
          }
        },
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
        anamnesis: {
          SAMPLER: {
            S: "Schwindel, Schwitzen, Zittern",
            A: "keine",
            M: "Metformin + Insulin",
            P: "Typ-2-Diabetes",
            L: "Mahlzeit ausgelassen",
            E: "Insulin-Überdosis",
            R: "keine"
          }
        },
        hidden: {
          mouth: "feucht, kein Geruch",
          pain: { location: "keiner", nrs: 0 },
          lung: "normal",
          vitals_baseline: { RR: "145/85", SpO2: 99, AF: 18, Puls: 62, BZ: 32, Temp: "36.5", GCS: 13 }
        }
      },
      {
        diagnosis: "Lungenembolie",
        story: "48-jährige Frau nach Langstreckenflug, plötzlich Luftnot + stechender Thoraxschmerz.",
        patient: { name: "Sandra L.", age: 48, sex: "w" },
        anamnesis: {
          SAMPLER: {
            S: "plötzliche Luftnot, Thoraxschmerz",
            A: "keine",
            M: "keine",
            P: "DVT-Vorgeschichte",
            L: "Flug vor 8 Std.",
            E: "Langstreckenflug",
            R: "Raucherin"
          }
        },
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
        anamnesis: {
          SAMPLER: {
            S: "Sprachstörung, Schwäche rechts",
            A: "keine",
            M: "Aspirin",
            P: "Hypertonie",
            L: "Mahlzeit vor 1 Std.",
            E: "plötzlicher Beginn",
            R: "Raucher"
          }
        },
        hidden: {
          befast: { F: true, A: true, S: true },
          pupillen: "isokor, prompt",
          vitals_baseline: { RR: "195/105", SpO2: 94, AF: 18, Puls: 78, BZ: 138, Temp: "36.7", GCS: 11 }
        }
      }
    ],
    trauma: [
      {
        diagnosis: "Polytrauma",
        story: "34-jähriger Motorradfahrer, Unfall bei 80 km/h, offene Fraktur + Blutung.",
        patient: { name: "Tim R.", age: 34, sex: "m" },
        anamnesis: {
          SAMPLER: {
            S: "Schmerzen Bein, Schock",
            A: "keine",
            M: "keine",
            P: "keine",
            L: "vor Unfall",
            E: "Sturz bei 80 km/h",
            R: "keine"
          }
        },
        hidden: {
          injuries: [{ kind: "bleeding", type: "arterial" }],
          lung: "abgeschwächt rechts",
          vitals_baseline: { RR: "85/50", SpO2: 89, AF: 28, Puls: 130, BZ: 95, Temp: "35.9", GCS: 9 }
        }
      }
    ],
    paediatrisch: [
      {
        diagnosis: "Asthmaanfall",
        story: "7-jähriges Mädchen, Giemen, Einziehungen.",
        patient: { name: "Leonie S.", age: 7, sex: "w" },
        anamnesis: {
          SAMPLER: {
            S: "Luftnot, Giemen",
            A: "keine",
            M: "Salbutamol",
            P: "Asthma",
            L: "vor 2 Std.",
            E: "Infekt",
            R: "keine"
          }
        },
        hidden: {
          lung: "diffuses Giemen",
          vitals_baseline: { RR: "105/70", SpO2: 88, AF: 40, Puls: 150, BZ: 110, Temp: "37.6", GCS: 15 }
        }
      }
    ]
  };

  const pool = cases[specialty] || cases.internistisch;
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  const caseData = {
    id,
    specialty,
    role,
    story: chosen.story,
    patient: chosen.patient,
    anamnesis: chosen.anamnesis || {},
    initial_vitals: null,
    key_findings: chosen.key_findings || [],
    red_flags: chosen.red_flags || [],
    target_outcome: chosen.target_outcome || "",
    scope: role === "NotSan" ? { allowed: ["i.v.", "Medis"] } : { allowed: ["Monitoring"] },
    steps_done: [],
    score: 0,
    hidden: chosen.hidden,
    solution: { diagnosis: chosen.diagnosis }
  };

  return { statusCode: 200, headers, body: JSON.stringify(caseData) };
}