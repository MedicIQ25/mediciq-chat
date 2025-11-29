/**
 * Netlify Function: case-new
 * Erzeugt einen neuen Fall mit vollständigen, auswertbaren Feldern
 * inkl. EKG Pattern und Patientennamen in der Story.
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
        // UPDATE: Name hinzugefügt
        story:
          "Einsatz auf dem Sportplatz: Patient Lukas M. (17 Jahre) klagt über akute Atemnot nach einem 100m-Sprint. Er spricht nur in 2-Wort-Sätzen.",
        target_outcome:
          "AF und SpO₂ verbessern (O₂ + inhalatives β₂-Mimetikum), Transport vorbereiten.",
        key_findings: ["Dyspnoe", "verlängertes Exspirium", "Giemen", "Sprechdyspnoe"],
        red_flags: ["SpO₂ < 90 %", "Erschöpfung", "Silent chest"],

        vitals: { RR: "138/86", SpO2: 85, AF: 28, Puls: 124, BZ: 108, Temp: 36.8, GCS: 15 },

        scene_4s: {
          sicherheit: "Keine akute Eigen-/Fremdgefährdung, Sportplatz gesichert.",
          szene: "Sportplatz, Lukas sitzt nach vorne gebeugt (Kutschersitz).",
          sichtung_personen: "1 Patient, Trainer und Mannschaftskameraden anwesend.",
          support_empfehlung:
            "NA bei fehlender Besserung unter Therapie oder klinischer Verschlechterung erwägen."
        },

        anamnesis: {
          SAMPLER: {
            S: "akute Atemnot nach Sprint, bekannte Asthma bronchiale",
            A: "Pollen, Hausstaub",
            M: "Salbutamol Spray (Bedarf), Budesonid (Controller, unregelmäßig)",
            P: "Asthma bronchiale seit Kindheit",
            L: "keine Krankenhausaufenthalte in letzter Zeit",
            E: "Belastung/Sport, Pollenflug, Inhalator in der Tasche vergessen",
            R: "keine Reise, kein Fieber"
          },
          vorerkrankungen: ["Asthma bronchiale"],
          medikation: ["β₂-Mimetikum Spray", "inhalatives Steroid (unregelmäßig)"],
          allergien: ["Pollen", "Hausstaub"],
          antikoagulation: false,
          OPQRST: {
            O: "plötzlich nach Sprint",
            P: "schlimmer bei Belastung, besser im Sitzen nach vorne gebeugt",
            Q: "Engegefühl in der Brust",
            R: "kein Ausstrahlen",
            S: "NRS 2–3 (Druck), subjektive Luftnot 8/10",
            T: "seit ca. 10 Minuten zunehmend"
          }
        },

        hidden: {
          diagnosis_keys: ["Asthma", "Obstruktion", "Spastik", "Atemnot"],
          bleeding_info: "Keine äußeren Blutungen sichtbar. Kleidung trocken.",
          ekg_pattern: "sinus", 
          pupils: "isokor, mittelweit, prompt",
          mouth: "Mund-/Rachenraum frei, kein Stridor, kein Erbrochenes",
          lung: "Giemen beidseits, verlängertes Exspirium, keine Rasselgeräusche",
          abdomen: "weich, kein Abwehrspannungsbefund",
          skin: "rosig, leicht schweißig",
          ekg3: "Sinusrhythmus 124/min, P-Wellen vorhanden",
          ekg12: "Sinustachykardie, keine Ischämiezeichen",
          befast: "ohne Auffälligkeiten",
          lkw: "nicht relevant",
          pain: { nrs: 2, ort: "thorakal, diffus", charakter: "Engegefühl/Pressen" },
          injuries: [],
          vitals_baseline: { RR: "130/80", SpO2: 94, AF: 18, Puls: 98, BZ: 108, Temp: 36.8, GCS: 15 }
        }
      }),

      neurologisch: () => ({
        id: "rs_hypoglyk_01",
        specialty: "neurologisch",
        role,
        difficulty,
        // UPDATE: Name hinzugefügt
        story:
          "Einsatz in Privatwohnung: Der 65-jährige Karl H. wurde von seiner Frau verwirrt auf dem Sofa vorgefunden. Er wirkt kaltschweißig und desorientiert. Die Ehefrau erwähnt Diabetes.",
        target_outcome:
          "Hypoglykämie erkennen, Glukosegabe, Bewusstseinslage und BZ im Verlauf dokumentieren.",
        key_findings: ["Vigilanzminderung", "kaltschweißig", "niedriger BZ", "Diabetesanamnese"],
        red_flags: ["Bewusstlosigkeit", "Krampfanfälle", "fehlende Besserung nach Glukose"],

        vitals: { RR: "146/88", SpO2: 96, AF: 18, Puls: 96, BZ: 42, Temp: 36.4, GCS: 13 },

        scene_4s: {
          sicherheit: "Wohnung, keine akute Gefährdungslage, Zugang frei.",
          szene: "Patient halb auf dem Sofa, reagiert verzögert, Wohnumgebung unauffällig.",
          sichtung_personen: "1 Patient, Ehefrau anwesend.",
          support_empfehlung: "NA bei Bewusstlosigkeit oder fehlender Besserung nach Therapie."
        },

        anamnesis: {
          SAMPLER: {
            S: "Verwirrtheit, Zittern, Schwitzen, Wortfindungsstörungen",
            A: "keine bekannt",
            M: "Insulin (Lantus), Metformin, Ramipril",
            P: "Diabetes mellitus Typ 2, Hypertonie",
            L: "abends wenig gegessen, morgens keine Mahlzeit",
            E: "Mahlzeit ausgelassen, Insulin dennoch gespritzt",
            R: "keine Reise, keine Infektsymptome"
          },
          vorerkrankungen: ["Diabetes mellitus Typ 2", "arterielle Hypertonie"],
          medikation: ["Basalinsulin", "Metformin", "ACE-Hemmer"],
          allergien: [],
          antikoagulation: false,
          OPQRST: {
            O: "seit ca. 30 Minuten zunehmende Verwirrtheit",
            P: "keine klare Provokation außer Nahrungsverzicht",
            Q: "kein Schmerz, eher Schwächegefühl",
            R: "-",
            S: "-",
            T: "progredient über 30–60 Minuten"
          }
        },

        hidden: {
          diagnosis_keys: ["Hypoglykämie", "Unterzucker", "Glucose", "Zucker"],
          bleeding_info: "Keine Blutungen. Patient schwitzt stark (kaltschweißig).",
          ekg_pattern: "sinus",
          pupils: "isokor, mittelweit, prompt",
          mouth: "Mund-/Rachenraum frei",
          lung: "vesikuläres Atemgeräusch beidseits, keine RG",
          abdomen: "weich, kein Druckschmerz",
          skin: "kaltschweißig, leicht blass",
          ekg3: "Sinusrhythmus 96/min",
          ekg12: "Sinusrhythmus, keine akuten Ischämiezeichen",
          befast: "ohne fokal-neurologische Ausfälle",
          lkw: "kein Schlaganfallverdacht, daher nicht relevant",
          pain: { nrs: 0, ort: "kein Schmerz", charakter: "-" },
          injuries: [],
          vitals_baseline: { RR: "140/80", SpO2: 97, AF: 16, Puls: 82, BZ: 120, Temp: 36.6, GCS: 15 }
        }
      }),

      trauma: () => ({
        id: "rs_trauma_unterarm_01",
        specialty: "trauma",
        role,
        difficulty,
        // UPDATE: Name hinzugefügt
        story:
          "Fahrradsturz auf dem Radweg: Die 29-jährige Lena S. hat sich beim Sturz mit dem rechten Arm abgefangen. Der Unterarm steht deutlich fehl.",
        target_outcome:
          "Blutungskontrolle, adäquate Immobilisation, Schmerztherapie einleiten, Traumaschema anwenden.",
        key_findings: ["deformierter Unterarm", "Druckschmerz", "Schwellung", "Bewegungsschmerz"],
        red_flags: ["starke Blutung", "neurologische Ausfälle der Hand", "weitere Verletzungen übersehen"],

        vitals: { RR: "132/84", SpO2: 98, AF: 18, Puls: 88, BZ: 102, Temp: 36.7, GCS: 15 },

        scene_4s: {
          sicherheit: "Radweg, gesichert. Helm wurde getragen (intakt).",
          szene: "Fahrradsturz, Lena sitzt am Gehwegrand, hält ihren rechten Arm.",
          sichtung_personen: "1 Patientin, Zeuge vor Ort.",
          support_empfehlung:
            "NA nur bei zusätzlicher Kopfverletzung, Polytrauma oder Schockzeichen."
        },

        anamnesis: {
          SAMPLER: {
            S: "starke Schmerzen rechter Unterarm, 'Knacken' gehört",
            A: "keine bekannt",
            M: "Pille (Kontrazeptiva)",
            P: "keine relevanten Vorerkrankungen",
            L: "Frühstück vor 2 Stunden",
            E: "Fahrradsturz, Sturz auf ausgestreckten Arm",
            R: "keine Reise, kein Infekt"
          },
          vorerkrankungen: [],
          medikation: [],
          allergien: [],
          antikoagulation: false,
          OPQRST: {
            O: "sofort nach Sturz",
            P: "Bewegung / Belastung verschlechtert massiv, Ruhigstellung bessert",
            Q: "stechender, lokaler Schmerz",
            R: "kein Ausstrahlen",
            S: "NRS 8 (initial)",
            T: "konstant seit Sturz"
          }
        },

        hidden: {
          diagnosis_keys: ["Fraktur", "Bruch", "Unterarm", "Radius", "Ulna"],
          injury_map: ["arm_r"],
          bleeding_info: "Sickerblutung am Unterarm durch Schürfwunden. Keine spritzende arterielle Blutung. Kleidung sonst trocken.",
          ekg_pattern: "sinus",
          pupils: "isokor, mittelweit, prompt",
          mouth: "Mund-/Rachenraum frei",
          lung: "vesikulär beidseits, keine RG",
          abdomen: "weich, kein Druckschmerz",
          skin: "Schürfwunden am rechten Unterarm, Hämatom, keine große offene Wunde",
          ekg3: "Sinusrhythmus 88/min",
          ekg12: "Sinus, keine Auffälligkeiten",
          befast: "ohne Auffälligkeiten",
          lkw: "nicht relevant",
          pain: { nrs: 8, ort: "rechter Unterarm", charakter: "stechend, pulsierend" },
          injuries: ["vermutete distale Unterarmfraktur rechts"],
          vitals_baseline: { RR: "128/78", SpO2: 98, AF: 16, Puls: 80, BZ: 102, Temp: 36.7, GCS: 15 }
        }
      }),

      pädiatrisch: () => ({
        id: "rs_paed_bronchiolitis_01",
        specialty: "pädiatrisch",
        role,
        difficulty,
        // UPDATE: Name hinzugefügt
        story:
          "Häuslicher Notfall: Der 9 Monate alte Säugling 'Ben' hustet seit gestern und atmet heute sehr schwer. Die Eltern sind besorgt.",
        target_outcome:
          "Respiratorische Situation einschätzen, Oxygenierung verbessern, Transport mit Monitoring in Kinderklinik.",
        key_findings: ["Tachypnoe", "Einziehungen", "Nasenflügeln", "geringe Trinkmenge", "Fieber"],
        red_flags: ["Apnoen", "Zyanose", "Erschöpfung", "SpO₂ < 92 % trotz O₂"],

        vitals: { RR: "110/70", SpO2: 90, AF: 42, Puls: 168, BZ: 96, Temp: 38.7, GCS: 15 },

        scene_4s: {
          sicherheit: "Wohnung, keine akute Gefährdung. Eltern anwesend.",
          szene: "Kind liegt im Bettchen, wirkt erschöpft, atmet schnell.",
          sichtung_personen: "1 Kind, Eltern anwesend.",
          support_empfehlung:
            "NA / Kinderarzt bei drohender respiratorischer Erschöpfung oder Apnoen."
        },

        anamnesis: {
          SAMPLER: {
            S: "Husten, schnelle Atmung, trinkt schlecht (< 50% der Norm)",
            A: "keine bekannt",
            M: "Paracetamol Zäpfchen vor 4h",
            P: "Frühgeboren 36+0, sonst unauffällig",
            L: "Flasche vor 4 Stunden, kaum getrunken",
            E: "seit 2 Tagen Husten und Schnupfen, seit heute deutlich schlechter",
            R: "kein Auslandsaufenthalt, Kontakt zu erkälteten Geschwistern (Kita)"
          },
          vorerkrankungen: ["Frühgeburt 36+0"],
          medikation: ["Paracetamol nach Bedarf"],
          allergien: [],
          antikoagulation: false,
          OPQRST: {
            O: "schleichender Beginn vor 2 Tagen",
            P: "Lagewechsel kaum Einfluss, Sitzen auf dem Arm bessert etwas",
            Q: "kein Schmerz, eher Luftnot/Unruhe",
            R: "-",
            S: "-",
            T: "progredient"
          }
        },

        hidden: {
          diagnosis_keys: ["Bronchiolitis", "RSV", "Infekt", "Obstruktion", "Atemwegsinfekt"],
          bleeding_info: "Keine Blutungen sichtbar. Windelbereich nicht beurteilt.",
          ekg_pattern: "sinus", 
          pupils: "isokor, altersentsprechend, prompt",
          mouth: "Nasen-Rachenraum mit klarem Sekret, kein Stridor",
          lung:
            "beidseits giemende und pfeifende Atemgeräusche, verlängertes Exspirium, leichte Einziehungen",
          abdomen: "weich, kein Druckschmerz",
          skin: "leicht febril, etwas blass, periphere Zyanose bei Belastung",
          ekg3: "Sinusrhythmus 168/min",
          ekg12: "nicht routinemäßig abgeleitet; kein Hinweis auf kardiale Problematik",
          befast: "nicht relevant",
          lkw: "nicht relevant",
          pain: { nrs: 3, ort: "unklar (Kind kann es nicht äußern)", charakter: "Unruhe, Quengeln" },
          injuries: [],
          vitals_baseline: { RR: "105/65", SpO2: 95, AF: 32, Puls: 150, BZ: 96, Temp: 37.8, GCS: 15 }
        }
      })
    };

    // ---------- Fall auswählen ----------
    const createCase = cases[specialty] || cases["internistisch"];
    let c = createCase();

    // ---------- Generische Defaults / Aufräumen ----------
    c.role       = role;
    c.difficulty = difficulty;
    c.score      = typeof c.score === "number" ? c.score : 0;
    c.steps_done = Array.isArray(c.steps_done) ? c.steps_done : [];
    c.history    = Array.isArray(c.history) ? c.history : [];

    c.vitals = c.vitals || {
      RR: "120/80",
      SpO2: 96,
      AF: 16,
      Puls: 80,
      BZ: 110,
      Temp: 36.8,
      GCS: 15
    };

    c.scene_4s = c.scene_4s || {
      sicherheit: "keine Angaben",
      szene: "keine Angaben",
      sichtung_personen: "keine Angaben",
      support_empfehlung: "keine Empfehlung"
    };

    c.anamnesis = c.anamnesis || {};
    c.anamnesis.SAMPLER = c.anamnesis.SAMPLER || {
      S: "—",
      A: "—",
      M: "—",
      P: "—",
      L: "—",
      E: "—",
      R: "—"
    };
    c.anamnesis.vorerkrankungen = Array.isArray(c.anamnesis.vorerkrankungen)
      ? c.anamnesis.vorerkrankungen
      : [];
    c.anamnesis.medikation = Array.isArray(c.anamnesis.medikation)
      ? c.anamnesis.medikation
      : [];
    c.anamnesis.allergien = Array.isArray(c.anamnesis.allergien) ? c.anamnesis.allergien : [];
    if (typeof c.anamnesis.antikoagulation !== "boolean") {
      c.anamnesis.antikoagulation = false;
    }
    c.anamnesis.OPQRST = c.anamnesis.OPQRST || {
      O: "—",
      P: "—",
      Q: "—",
      R: "—",
      S: "—",
      T: "—"
    };

    c.hidden = c.hidden || {};
    c.hidden.vitals_baseline = c.hidden.vitals_baseline || {
      RR: c.vitals.RR || "120/80",
      SpO2: c.vitals.SpO2 || 96,
      AF: c.vitals.AF || 16,
      Puls: c.vitals.Puls || 80,
      BZ: c.vitals.BZ || 110,
      Temp: c.vitals.Temp || 36.8,
      GCS: c.vitals.GCS || 15
    };

    c.hidden.pupils  = c.hidden.pupils  || "isokor, mittelweit, prompt";
    c.hidden.mouth   = c.hidden.mouth   || "Mund-/Rachenraum frei, kein Erbrochenes";
    c.hidden.lung    = c.hidden.lung    || "vesikuläres Atemgeräusch beidseits, keine RG";
    c.hidden.abdomen = c.hidden.abdomen || "weich, kein Abwehrspannungsbefund";
    c.hidden.skin    = c.hidden.skin    || "warm, rosig, keine Auffälligkeiten";
    c.hidden.ekg3    = c.hidden.ekg3    || "Sinusrhythmus, keine akuten Auffälligkeiten";
    c.hidden.ekg12   = c.hidden.ekg12   || "Sinus, ohne Ischämiezeichen";
    c.hidden.befast  = c.hidden.befast  || "ohne Auffälligkeiten";
    c.hidden.lkw     = c.hidden.lkw     || "nicht ermittelbar";
    c.hidden.pain    = c.hidden.pain || { nrs: 0, ort: "—", charakter: "—" };
    c.hidden.injuries = Array.isArray(c.hidden.injuries) ? c.hidden.injuries : [];
    
    c.hidden.diagnosis_keys = Array.isArray(c.hidden.diagnosis_keys) ? c.hidden.diagnosis_keys : [];
    c.hidden.injury_map = Array.isArray(c.hidden.injury_map) ? c.hidden.injury_map : [];
    c.hidden.bleeding_info = c.hidden.bleeding_info || "Keine äußeren Blutungen.";
    c.hidden.ekg_pattern = c.hidden.ekg_pattern || "sinus";

    c.support = c.support || { calls: [] };

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