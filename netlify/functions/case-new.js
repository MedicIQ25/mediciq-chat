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

    // ===== 2) Helpers für Variation =====
    const id = () => 'fall_' + Math.random().toString(36).slice(2, 6);
    const randPick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const randInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
    const jitter = (base, d) => base + randInt(-d, d); // z. B. jitter(120, 5)

    // kleine Funktion für Vitalwerte als Zahlen + Strings
    const vitals = (bpSys, bpDia, spo2, af, puls, bz, temp, gcs=15) => ({
      RR: `${bpSys}/${bpDia}`,
      SpO2: spo2,
      AF: af,
      Puls: puls,
      BZ: bz,
      Temp: temp,
      GCS: gcs
    });

    // ===== 3) Kompetenz/Scope =====
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
        "erweiterte Maßnahmen (gemäß lokaler SOP)"
      ],
      disallowed_examples: [
        "RSI/Narkose und klar arztpflichtige Maßnahmen"
      ]
    };
    const SCOPE = role === 'NotSan' ? baseScope_NotSan : baseScope_RS;

    // ===== 4) Szenario-Generatoren =====
    // Jeder Generator gibt ein Objekt mit {diagnosis, story, key_findings, red_flags, target_outcome, hidden:{...}} zurück
    // hidden.vitals_baseline MUSS vorhanden sein. Weitere Felder nutzt dein case-step.

    // ---- INTERNISTISCH ----
    const genACS = () => {
      const bpS = jitter(150, 10), bpD = jitter(95, 8);
      const spo2 = jitter(94, 2), af = jitter(20, 3), puls = jitter(98, 8);
      const temp = 37.2, bz = jitter(110, 15);
      const leftOrRight = randPick(['linken', 'rechten']);
      return {
        diagnosis: "Akutes Koronarsyndrom (ACS, STEMI möglich)",
        story: `Ein 65-jähriger Mann klagt über akute, drückende Brustschmerzen mit Ausstrahlung in den ${leftOrRight} Arm sowie Atemnot. Risikofaktoren: Hypertonie, Diabetes.`,
        key_findings: ["Brustschmerz, drückend", "Dyspnoe", "Risikofaktoren (HTN, DM)"],
        red_flags: ["Anhaltender Thoraxschmerz > 15 min", "Vegetative Begleiterscheinungen (Übelkeit, Kaltschweißigkeit)"],
        target_outcome: "Reevaluation, Monitoring, 12-Kanal-EKG, Transport mit ACS-Verdacht in geeignete Klinik.",
        hidden: {
          vitals_baseline: vitals(bpS, bpD, spo2, af, puls, bz, temp, 15),
          pupils: "isokor, prompt lichtreagibel",
          mouth: "unauffällig, keine Aspiration, Schleimhäute rosig",
          lung: "seitengleiches Atemgeräusch, ggf. leichte Tachypnoe",
          abdomen: "weich, keine Abwehrspannung",
          ekg3: `Sinusrhythmus, Frequenz ${puls}/min, keine eindeutigen Hebungen`,
          ekg12: randPick([
            "ST-Hebungen V2-V4, ischämisches Muster mit Spiegelbildungen",
            "ST-Senkungen infero-lateral, T-Wellen-Inversionen"
          ]),
          befast: null, neuro: null
        }
      };
    };

    const genPneumonia = () => {
      const bpS = jitter(130, 10), bpD = jitter(80, 8);
      const spo2 = jitter(91, 3), af = jitter(24, 4), puls = jitter(105, 10);
      const temp = 38.5, bz = jitter(120, 10);
      return {
        diagnosis: "Pneumonie mit Hypoxie",
        story: "Eine 72-jährige Patientin klagt über Husten, Fieber, zunehmende Atemnot seit 2 Tagen.",
        key_findings: ["Fieber", "Auskultatorisch Rasselgeräusche basal", "Hypoxie"],
        red_flags: ["RR normal/leicht erniedrigt + Hypoxie", "Tachypnoe"],
        target_outcome: "O2 nach Indikation, Monitoring, Transport in Klinik.",
        hidden: {
          vitals_baseline: vitals(bpS, bpD, spo2, af, puls, bz, temp, 15),
          pupils: "isokor, prompt lichtreagibel",
          mouth: "mukopurulentes Sekret, sonst frei",
          lung: "seitendifferent: basal feuchte RGs, abgeschwächtes AG rechts",
          abdomen: "weich, kein Peritonismus",
          ekg3: `Sinusrhythmus, Frequenz ${puls}/min`,
          ekg12: "Sinusrhythmus, keine ST-Hebungen",
          befast: null, neuro: null
        }
      };
    };

    const genHF = () => {
      const bpS = jitter(160, 15), bpD = jitter(100, 10);
      const spo2 = jitter(92, 3), af = jitter(22, 3), puls = jitter(95, 8);
      const temp = 36.8, bz = jitter(130, 15);
      return {
        diagnosis: "Akute kardiale Dekompensation (Linksherzinsuffizienz)",
        story: "Ein 78-jähriger Patient berichtet über belastungsabhängige Atemnot, Orthopnoe und Knöchelödeme.",
        key_findings: ["Belastungsdyspnoe/Orthopnoe", "Ödeme", "Rasselgeräusche basal"],
        red_flags: ["Hypertonie + Dyspnoe", "Hypoxie möglich"],
        target_outcome: "Monitoring, 12-Kanal-EKG, sitzende Lagerung, Transport.",
        hidden: {
          vitals_baseline: vitals(bpS, bpD, spo2, af, puls, bz, temp, 15),
          pupils: "isokor, prompt lichtreagibel",
          mouth: "Schaumig-wässriges Sekret möglich, Aspiration ausschließen",
          lung: "beidseits feuchte RGs basal, ggf. verlängertes Exspirium",
          abdomen: "weich, keine Abwehr",
          ekg3: `Sinusrhythmus, Frequenz ${puls}/min`,
          ekg12: "Sinusrhythmus, evtl. unspezifische ST/T-Veränderungen",
          befast: null, neuro: null
        }
      };
    };

    const genAsthmaCOPD = () => {
      const bpS = jitter(140, 10), bpD = jitter(85, 10);
      const spo2 = jitter(90, 3), af = jitter(26, 5), puls = jitter(110, 12);
      const temp = 37.1, bz = jitter(120, 10);
      return {
        diagnosis: "Exazerbation Asthma/COPD",
        story: "Ein 60-jähriger starker Raucher hat seit Stunden zunehmende Atemnot mit exspiratorischem Pfeifen.",
        key_findings: ["verlängertes Exspirium", "Giemen/Pfeifen", "Hypoxie"],
        red_flags: ["Tachypnoe", "Erschöpfung möglich"],
        target_outcome: "Monitoring, O2 nach Indikation, Transport.",
        hidden: {
          vitals_baseline: vitals(bpS, bpD, spo2, af, puls, bz, temp, 15),
          pupils: "isokor, prompt lichtreagibel",
          mouth: "trocken, keine Aspiration",
          lung: "diffuses Giemen/Pfeifen, verlängertes Exspirium",
          abdomen: "weich",
          ekg3: `Sinusrhythmus, Frequenz ${puls}/min`,
          ekg12: "Sinusrhythmus, keine ST-Hebungen",
          befast: null, neuro: null
        }
      };
    };

    const genPE = () => {
      const bpS = jitter(135, 10), bpD = jitter(85, 10);
      const spo2 = jitter(90, 4), af = jitter(24, 5), puls = jitter(110, 12);
      const temp = 37.0, bz = jitter(115, 10);
      return {
        diagnosis: "Lungenembolie (PE) wahrscheinlich",
        story: "Eine 45-jährige Patientin mit kürzlicher Immobilisation klagt über plötzliche Atemnot und stechende Thoraxschmerzen.",
        key_findings: ["plötzliche Dyspnoe", "Tachykardie", "Hypoxie"],
        red_flags: ["Immobilisation/Thromboserisiko", "pleuritischer Schmerz"],
        target_outcome: "Monitoring, O2 nach Indikation, Transport in Klinik.",
        hidden: {
          vitals_baseline: vitals(bpS, bpD, spo2, af, puls, bz, temp, 15),
          pupils: "isokor, prompt lichtreagibel",
          mouth: "trocken",
          lung: "häufig unauffällig, evtl. diskrete Nebengeräusche",
          abdomen: "weich",
          ekg3: `Sinusrhythmus, Frequenz ${puls}/min`,
          ekg12: "evtl. S1Q3T3, unspezifisch",
          befast: null, neuro: null
        }
      };
    };

    const genHypogly = () => {
      const bpS = jitter(125, 10), bpD = jitter(80, 8);
      const spo2 = jitter(96, 2), af = jitter(14, 2), puls = jitter(90, 8);
      const temp = 36.7, bz = jitter(45, 5); // niedrig!
      return {
        diagnosis: "Hypoglykämie",
        story: "Ein 54-jähriger Diabetiker ist blass, schwitzt und wirkt verwirrt.",
        key_findings: ["Schwitzen/Bäche", "Verwirrtheit", "niedriger Blutzucker"],
        red_flags: ["Bewusstseinsstörung möglich", "Krampfanfall möglich"],
        target_outcome: "BZ messen, Monitoring, zügige Therapie in Klinik.",
        hidden: {
          vitals_baseline: vitals(bpS, bpD, spo2, af, puls, bz, temp, 15),
          pupils: "isokor, prompt lichtreagibel",
          mouth: "unauffällig",
          lung: "unauffällig",
          abdomen: "weich",
          ekg3: `Sinusrhythmus, Frequenz ${puls}/min`,
          ekg12: "Sinusrhythmus",
          befast: null, neuro: null
        }
      };
    };

    // ---- NEUROLOGISCH ----
    const genStrokeRight = () => {
      const bpS = jitter(165, 12), bpD = jitter(100, 10);
      const spo2 = jitter(96, 2), af = jitter(16, 2), puls = jitter(82, 6);
      const temp = 36.8, bz = jitter(105, 10);
      return {
        diagnosis: "Akuter ischämischer Schlaganfall rechtshemisphärisch",
        story: "Vor 30–45 Minuten Sprachstörungen und Schwäche der linken Körperhälfte. Angehörige berichten über hängenden Mundwinkel links.",
        key_findings: ["Hemiparese links", "Aphasie/Dysarthrie", "Zeitfenster < 4,5 h"],
        red_flags: ["akuter fokal-neurologischer Ausfall", "Thrombolyse-Zeitfenster beachten"],
        target_outcome: "BEFAST/Neurologie-Check, BZ ausschließen, zügiger Transport in Stroke-Unit.",
        hidden: {
          vitals_baseline: vitals(bpS, bpD, spo2, af, puls, bz, temp, 15),
          pupils: "isokor, prompt lichtreagibel",
          mouth: "leichte Mundwinkelhängung links",
          lung: "unauffällig",
          abdomen: "weich",
          ekg3: `Sinusrhythmus, Frequenz ${puls}/min`,
          ekg12: "Sinusrhythmus",
          befast: { Balance:"unsicher", Eyes:"ok", Face:"links hängend", Arms:"links schwächer", Speech:"verwaschen", Time:"Beginn ~40 min" },
          neuro: "linksseitige Schwäche Arm/Bein, Fazialisparese links, Aphasie leicht"
        }
      };
    };

    const genStrokeLeft = () => {
      const bpS = jitter(170, 12), bpD = jitter(105, 10);
      const spo2 = jitter(96, 2), af = jitter(16, 2), puls = jitter(82, 6);
      const temp = 36.9, bz = jitter(110, 10);
      return {
        diagnosis: "Akuter ischämischer Schlaganfall linkshemisphärisch",
        story: "Seit ca. 1 Stunde Wortfindungsstörungen, Schwäche rechts. Angehörige berichten über hängenden Mundwinkel rechts.",
        key_findings: ["Hemiparese rechts", "Sprachstörung", "Zeitfenster < 4,5 h"],
        red_flags: ["akuter fokal-neurologischer Ausfall", "Thrombolyse-Zeitfenster beachten"],
        target_outcome: "BEFAST/Neurologie-Check, BZ ausschließen, zügiger Transport in Stroke-Unit.",
        hidden: {
          vitals_baseline: vitals(bpS, bpD, spo2, af, puls, bz, temp, 15),
          pupils: "isokor, prompt lichtreagibel",
          mouth: "Mundwinkel rechts hängend",
          lung: "unauffällig",
          abdomen: "weich",
          ekg3: `Sinusrhythmus, Frequenz ${puls}/min`,
          ekg12: "Sinusrhythmus",
          befast: { Balance:"etwas unsicher", Eyes:"ok", Face:"rechts hängend", Arms:"rechts drift", Speech:"aphasisch", Time:"Beginn ~60 min" },
          neuro: "rechtsseitige Schwäche, Aphasie/Sprachstörung"
        }
      };
    };

    const genTIA = () => {
      const bpS = jitter(155, 10), bpD = jitter(95, 8);
      const spo2 = jitter(97, 1), af = jitter(14, 2), puls = jitter(78, 6);
      const temp = 36.7, bz = jitter(105, 10);
      return {
        diagnosis: "TIA (transitorische ischämische Attacke), Symptome regredient",
        story: "Patient berichtet über vorübergehende Schwäche im Arm und Wortfindungsstörungen, aktuell rückläufig.",
        key_findings: ["kurzzeitige Symptome", "Risikofaktoren möglich"],
        red_flags: ["Warnsignal: Schlaganfallrisiko hoch"],
        target_outcome: "Neurologische Abklärung, Monitoring, Transport in Klinik.",
        hidden: {
          vitals_baseline: vitals(bpS, bpD, spo2, af, puls, bz, temp, 15),
          pupils: "isokor",
          mouth: "unauffällig",
          lung: "unauffällig",
          abdomen: "weich",
          ekg3: `Sinusrhythmus, Frequenz ${puls}/min`,
          ekg12: "Sinusrhythmus",
          befast: { Balance:"ok", Eyes:"ok", Face:"ok", Arms:"ok", Speech:"ok", Time:"Beginn ~90 min, Rückgang" },
          neuro: "derzeit unauffällig (anamnestisch positiv)"
        }
      };
    };

    const genPostictal = () => {
      const bpS = jitter(140, 10), bpD = jitter(85, 8);
      const spo2 = jitter(95, 2), af = jitter(18, 3), puls = jitter(92, 8);
      const temp = 37.0, bz = jitter(110, 10);
      return {
        diagnosis: "Postiktaler Zustand nach Krampfanfall",
        story: "Zeugen berichten von generalisiertem Krampfanfall, jetzt schläfrig, desorientiert.",
        key_findings: ["postiktal: Desorientierung, Kopfschmerz", "Seitenzunge evtl. gebissen"],
        red_flags: ["Verletzungen ausschließen", "Hypoglykämie ausschließen"],
        target_outcome: "Monitoring, BZ messen, Transport, weitere Abklärung.",
        hidden: {
          vitals_baseline: vitals(bpS, bpD, spo2, af, puls, bz, temp, 15),
          pupils: "isokor, prompt",
          mouth: "Zungenbiss möglich, kein Fremdkörper",
          lung: "unauffällig",
          abdomen: "weich",
          ekg3: `Sinusrhythmus, Frequenz ${puls}/min`,
          ekg12: "Sinusrhythmus",
          befast: { Balance:"schläfrig", Eyes:"ok", Face:"ok", Arms:"ok", Speech:"verlangsamt", Time:"Ereignis vor ~10 min" },
          neuro: "postiktal schläfrig, orientierungsgemindert"
        }
      };
    };

    // Pools pro Fachrichtung
    const POOLS = {
      internistisch: [genACS, genPneumonia, genHF, genAsthmaCOPD, genPE, genHypogly],
      neurologisch : [genStrokeRight, genStrokeLeft, genTIA, genPostictal]
    };

    const pool = POOLS[specialty] || POOLS.internistisch;
    const scenario = randPick(pool)(); // -> Generator aufrufen

    // ===== 5) Response-Objekt bauen =====
    const caseData = {
      id: id(),
      specialty,
      difficulty,
      role,
      story: scenario.story,
      initial_vitals: null,                 // <— werden erst durch Messungen gesetzt
      key_findings: scenario.key_findings,
      red_flags: scenario.red_flags,
      target_outcome: scenario.target_outcome,
      scope: SCOPE,
      steps_done: [],
      score: 0,
      hidden: scenario.hidden,
      solution: {
        diagnosis: scenario.diagnosis,
        justification: scenario.key_findings
      }
    };

    return { statusCode: 200, headers, body: JSON.stringify(caseData) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
