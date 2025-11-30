/**
 * Netlify Function: case-new
 * Erzeugt einen neuen Fall mit vollständigen Feldern und Patienten-Dialogen.
 */

exports.handler = async (event) => {
  const headers = {
    "content-type": "application/json",
    "access-control-allow-origin": "*"
  };

  try {
    const body       = event.body ? JSON.parse(event.body) : {};
    const specialty  = (body.specialty || "internistisch").toLowerCase();
    const role       = body.role || "RS";
    const difficulty = body.difficulty || "mittel";

    // ---------- Fallkatalog ----------
    const cases = {
      internistisch: () => ({
        id: "rs_asthma_01",
        specialty: "internistisch",
        role,
        difficulty,
        // SZENE (Das liest du)
        story: "Einsatz auf dem Sportplatz: Patient Lukas M. (17 Jahre) sitzt im Kutschersitz auf der Bank nach einem 100m-Sprint.",
        // DIALOG (Das hörst du - Gehetzt, Atemnot)
        intro_dialogue: "Hilfe... ich krieg... kaum Luft! *keuch* ... Hab mein Spray... vergessen!",
        
        target_outcome: "AF und SpO₂ verbessern (O₂ + inhalatives β₂-Mimetikum), Transport vorbereiten.",
        key_findings: ["Dyspnoe", "verlängertes Exspirium", "Giemen", "Sprechdyspnoe"],
        red_flags: ["SpO₂ < 90 %", "Erschöpfung", "Silent chest"],

        vitals: { RR: "138/86", SpO2: 85, AF: 28, Puls: 124, BZ: 108, Temp: 36.8, GCS: 15 },

        scene_4s: {
          sicherheit: "Keine akute Eigen-/Fremdgefährdung, Sportplatz gesichert.",
          szene: "Sportplatz, Lukas sitzt nach vorne gebeugt (Kutschersitz).",
          sichtung_personen: "1 Patient, Trainer und Mannschaftskameraden anwesend.",
          support_empfehlung: "NA bei fehlender Besserung unter Therapie."
        },

        anamnesis: {
          SAMPLER: {
            S: "akute Atemnot nach Sprint, bekannte Asthma bronchiale",
            A: "Pollen, Hausstaub",
            M: "Salbutamol Spray (Bedarf)",
            P: "Asthma bronchiale seit Kindheit",
            L: "keine Krankenhausaufenthalte in letzter Zeit",
            E: "Belastung/Sport, Pollenflug",
            R: "keine Reise"
          },
          vorerkrankungen: ["Asthma bronchiale"], medikation: ["β₂-Mimetikum Spray"], allergien: ["Pollen", "Hausstaub"], antikoagulation: false,
          OPQRST: { O: "plötzlich", P: "Sitzen besser", Q: "Engegefühl", R: "-", S: "Luftnot 8/10", T: "seit 10 min" }
        },
        hidden: { diagnosis_keys: ["Asthma", "Obstruktion"], bleeding_info: "Keine äußeren Blutungen.", ekg_pattern: "sinus", pupils: "isokor, mittel", lung: "Giemen beidseits", injuries: [] }
      }),

      neurologisch: () => ({
        id: "rs_hypoglyk_01",
        specialty: "neurologisch",
        role,
        difficulty,
        // SZENE
        story: "Einsatz in Privatwohnung: Der 65-jährige Karl H. sitzt verwirrt auf dem Sofa. Er ist kaltschweißig und zittert.",
        // DIALOG (Verwirrt, langsam)
        intro_dialogue: "Was... wo bin ich hier? Mir ist so... komisch... alles dreht sich irgendwie.",

        target_outcome: "Hypoglykämie erkennen, Glukosegabe.",
        key_findings: ["Vigilanzminderung", "kaltschweißig", "niedriger BZ"],
        red_flags: ["Bewusstlosigkeit", "Krampfanfälle"],

        vitals: { RR: "146/88", SpO2: 96, AF: 18, Puls: 96, BZ: 42, Temp: 36.4, GCS: 13 },

        scene_4s: {
          sicherheit: "Wohnung sicher.",
          szene: "Patient auf Sofa, reagiert verzögert.",
          sichtung_personen: "1 Patient, Ehefrau anwesend.",
          support_empfehlung: "NA bei Bewusstlosigkeit."
        },

        anamnesis: {
          SAMPLER: {
            S: "Verwirrtheit, Zittern, Schwitzen",
            A: "-",
            M: "Insulin (Lantus), Metformin",
            P: "Diabetes Typ 2",
            L: "Abendessen gestern",
            E: "Insulin gespritzt aber Frühstück vergessen",
            R: "-"
          },
          vorerkrankungen: ["Diabetes mellitus Typ 2"], medikation: ["Insulin", "Metformin"], allergien: [], antikoagulation: false,
          OPQRST: { O: "seit 30 min", P: "-", Q: "Schwäche", R: "-", S: "-", T: "progredient" }
        },
        hidden: { diagnosis_keys: ["Hypoglykämie", "Unterzucker"], bleeding_info: "Keine Blutung, kaltschweißig.", ekg_pattern: "sinus", pupils: "isokor", lung: "frei", injuries: [] }
      }),

      trauma: () => ({
        id: "rs_trauma_unterarm_01",
        specialty: "trauma",
        role,
        difficulty,
        // SZENE
        story: "Fahrradsturz auf dem Radweg: Die 29-jährige Lena S. hält ihren rechten Unterarm, der deutlich fehlsteht.",
        // DIALOG (Schmerzverzerrt, panisch)
        intro_dialogue: "Aua! Mein Arm! Scheiße, das tut so weh... bitte helfen Sie mir, da hat es laut geknackt!",

        target_outcome: "Immobilisation, Schmerztherapie.",
        key_findings: ["deformierter Unterarm", "Druckschmerz"],
        red_flags: ["DMS-Ausfall", "starke Blutung"],

        vitals: { RR: "132/84", SpO2: 98, AF: 18, Puls: 110, BZ: 102, Temp: 36.7, GCS: 15 },

        scene_4s: {
          sicherheit: "Radweg gesichert. Helm intakt.",
          szene: "Patientin sitzt am Boden.",
          sichtung_personen: "1 Patientin.",
          support_empfehlung: "NA zur Analgesie."
        },

        anamnesis: {
          SAMPLER: {
            S: "starke Schmerzen rechter Arm",
            A: "-",
            M: "Pille",
            P: "-",
            L: "2h",
            E: "Sturz auf Arm",
            R: "-"
          },
          vorerkrankungen: [], medikation: ["Kontrazeptiva"], allergien: [], antikoagulation: false,
          OPQRST: { O: "sofort", P: "Bewegung unmöglich", Q: "stechend", R: "lokal", S: "NRS 9", T: "akut" }
        },
        hidden: { diagnosis_keys: ["Fraktur", "Unterarm"], injury_map: ["arm_r"], bleeding_info: "Schürfwunden Arm, keine arterielle Blutung.", ekg_pattern: "sinus", pupils: "ok", lung: "frei", injuries: ["Fraktur Unterarm rechts"] }
      }),

      pädiatrisch: () => ({
        id: "rs_paed_bronchiolitis_01",
        specialty: "pädiatrisch",
        role,
        difficulty,
        // SZENE
        story: "Häuslicher Notfall: Der 9 Monate alte Säugling 'Ben' hustet schwer und atmet sehr schnell. Die Mutter hält ihn im Arm.",
        // DIALOG (Mutter spricht für das Kind)
        intro_dialogue: "Bitte schauen Sie nach Ben! Er atmet so schnell und pfeift richtig... er will auch nichts trinken!",

        target_outcome: "Oxygenierung verbessern, Transport.",
        key_findings: ["Tachypnoe", "Einziehungen", "Nasenflügeln"],
        red_flags: ["Zyanose", "Erschöpfung"],

        vitals: { RR: "110/70", SpO2: 90, AF: 45, Puls: 160, BZ: 96, Temp: 38.7, GCS: 15 },

        scene_4s: {
          sicherheit: "Wohnung sicher.",
          szene: "Kinderzimmer.",
          sichtung_personen: "Kind + Mutter.",
          support_empfehlung: "Kinderarzt/NA bei Erschöpfung."
        },

        anamnesis: {
          SAMPLER: {
            S: "Husten, Schnappatmung, Trinkschwäche",
            A: "-",
            M: "Paracetamol",
            P: "Frühgeburt 36. SSW",
            L: "4h",
            E: "Infekt seit 2 Tagen",
            R: "-"
          },
          vorerkrankungen: ["Frühgeburt"], medikation: ["Paracetamol"], allergien: [], antikoagulation: false,
          OPQRST: { O: "schleichend", P: "-", Q: "Atemnot", R: "-", S: "-", T: "verschlechtert" }
        },
        hidden: { diagnosis_keys: ["Bronchiolitis", "RSV"], bleeding_info: "Keine.", ekg_pattern: "sinus", pupils: "ok", lung: "Giemen/Pfeifen", injuries: [] }
      })
    };

    // ---------- Fall auswählen ----------
    const createCase = cases[specialty] || cases["internistisch"];
    let c = createCase();

    // ---------- Generische Defaults ----------
    c.role = role;
    c.difficulty = difficulty;
    c.score = 0;
    c.steps_done = [];
    c.history = [];
    
    // Fallbacks für leere Felder
    c.vitals = c.vitals || { RR: "120/80", SpO2: 96, AF: 16, Puls: 80, BZ: 100, Temp: 36.5, GCS: 15 };
    c.hidden.vitals_baseline = c.hidden.vitals_baseline || { ...c.vitals };
    c.hidden.injuries = c.hidden.injuries || [];
    c.hidden.diagnosis_keys = c.hidden.diagnosis_keys || [];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(c)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || String(err) })
    };
  }
};