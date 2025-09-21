// netlify/functions/case-new.js
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
    const { specialty = 'internistisch', difficulty = 'mittel', role = 'RS' } = JSON.parse(event.body || '{}');

    // ===== 2) Szenarien (lokal, deterministisch) =====
    // Wir bauen die Fälle lokal (ohne OpenAI), damit die Inhalte stabil und schnell sind.
    // Wichtig: initial_vitals sind NICHT vorbefüllt – erscheinen erst nach Messung!
    const id = `fall_${Math.random().toString(36).slice(2, 6)}`;

    // Eine kleine Helper-Funktion
    const baseScope_RS = {
      role: 'RS',
      allowed_actions: [
        "Eigenschutz und Umfeld sichern",
        "Patientenansprache, Bewusstsein prüfen (AVPU/GCS)",
        "ABCDE-Assessment",
        "Monitoring: RR, SpO2, Puls, AF, BZ",
        "Lagerung (z. B. Oberkörper hoch, stabile Seitenlage je nach Zustand)",
        "Wärmeerhalt, psychologische Betreuung",
        "O2-Gabe (bei Indikation, z. B. SpO2 < 90%)",
        "NA nachfordern (bei Bedarf), Übergabe",
        "Vitalzeichenkontrolle",
        "Pupillen prüfen",
        "EKG ableiten (3-Kanal / 12-Kanal)",
        "BZ messen",
        "AF/Puls zählen",
        "GCS erheben",
        "Mundraum inspizieren",
        "Auskultation Lunge (links/rechts, Nebengeräusche)",
        "Schmerzskala erheben",
        "BEFAST (neurologischer Check)"
      ],
      disallowed_examples: [
        "i.v.-Zugang legen",
        "Intubation/RSI",
        "Medikamentengabe (außer SOP-lokal und ausdrücklich erlaubt)"
      ]
    };

    const baseScope_NotSan = {
      role: 'NotSan',
      allowed_actions: [
        ...baseScope_RS.allowed_actions,
        "i.v.-Zugang legen",
        "erweiterte Maßnahmen (gemäß lokaler SOP)",
      ],
      disallowed_examples: [
        "RSI/Narkose und klar arztpflichtige Maßnahmen"
      ]
    };

    const SCOPE = role === 'NotSan' ? baseScope_NotSan : baseScope_RS;

    // Zwei Beispiel-Szenarien (du kannst jederzeit weitere ergänzen)
    const templates = {
      internistisch: () => ({
        diagnosis: "Akutes Koronarsyndrom (STEMI wahrscheinlich)",
        story: "Ein 65-jähriger Mann klagt über akute, drückende Brustschmerzen mit Ausstrahlung in den linken Arm sowie Atemnot. Risikofaktoren: Hypertonie, Diabetes.",
        key_findings: [
          "Brustschmerz, drückend",
          "Dyspnoe",
          "Risikofaktoren (HTN, DM)"
        ],
        red_flags: [
          "Anhaltender Thoraxschmerz > 15 min",
          "Vegetative Begleiterscheinungen (Übelkeit, Kaltschweißigkeit)"
        ],
        target_outcome: "Reevaluation, Monitoring, 12-Kanal-EKG, Transport mit ACS-Verdacht in geeignete Klinik.",
        // Versteckte Wahrheit (für Diagnostik-Schritte)
        hidden: {
          vitals_baseline: { RR: "150/95", SpO2: 94, AF: 20, Puls: 98, BZ: 120, Temp: 37.2, GCS: 15 },
          pupils: "isokor, prompt lichtreagibel",
          mouth: "unauffällig, keine Aspiration, Schleimhäute rosig",
          lung: "seitengleiches Atemgeräusch, leichte Tachypnoe",
          abdomen: "weich, keine Abwehrspannung",
          ekg3: "Sinusrhythmus, Frequenz 95/min, keine eindeutigen Hebungen",
          ekg12: "ST-Hebungen V2-V4, ischämisches Muster mit Spiegelbildungen",
          befast: null, // nicht relevant
          neuro: null
        }
      }),
      neurologisch: () => ({
        diagnosis: "Akuter ischämischer Schlaganfall (rechtshemisphärisch, Zeitfenster gegeben)",
        story: "Ein 65-jähriger Patient entwickelte vor 30 Minuten plötzlich Sprachstörungen und Schwäche der rechten Körperhälfte. Angehörige berichten über hängenden Mundwinkel rechts.",
        key_findings: [
          "Aphasie/Sprachstörung",
          "Rechtsseitige Schwäche",
          "Zeitfenster < 4,5 h"
        ],
        red_flags: [
          "Akuter fokal-neurologischer Ausfall",
          "Bewusstseinsstörung ausschließen"
        ],
        target_outcome: "Neurologischer Check (BEFAST), Blutzucker ausschließen, zügiger Transport in Stroke-Unit.",
        hidden: {
          vitals_baseline: { RR: "160/100", SpO2: 96, AF: 16, Puls: 82, BZ: 105, Temp: 36.8, GCS: 15 },
          pupils: "isokor, prompt lichtreagibel",
          mouth: "leichte Mundwinkelhängung rechts, Zunge weicht leicht ab",
          lung: "seitengleich, unauffällig",
          abdomen: "weich, keine Abwehrspannung",
          ekg3: "Sinusrhythmus, Frequenz 80/min",
          ekg12: "Sinusrhythmus, keine ST-Hebungen",
          befast: {
            Balance: "leicht unsicher beim Stehen",
            Eyes: "keine Doppelbilder",
            Face: "hängender Mundwinkel rechts",
            Arms: "rechts schwächer (Drift)",
            Speech: "verwaschen",
            Time: "Beginn vor ~30 min"
          },
          neuro: "rechtsseitige Schwäche (Arm/Bein), leichte Fazialisparese rechts, aphasisch"
        }
      })
    };

    const make = templates[specialty] || templates['internistisch'];
    const t = make();

    const caseData = {
      id,
      specialty,
      difficulty,
      role,
      story: t.story,
      // initial_vitals bewusst NICHT gesetzt – erst durch Messung erscheinen Werte
      initial_vitals: null,
      key_findings: t.key_findings,
      red_flags: t.red_flags,
      target_outcome: t.target_outcome,
      scope: SCOPE,
      steps_done: [],
      score: 0,
      // "hidden" einmal an den Client geben – optional könntest du das serverseitig halten,
      // hier behalten wir es im State, um deterministische Diagnostik zu liefern.
      hidden: t.hidden,
      solution: {
        diagnosis: t.diagnosis,
        justification: t.key_findings
      }
    };

    return { statusCode: 200, headers, body: JSON.stringify(caseData) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
