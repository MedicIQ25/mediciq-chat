/**
 * Netlify Function: case-new
 * (Content-Rich Edition: Detailed Medical Scenarios)
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

    // ---------- Fallkatalog (DETAILREICH) ----------
    const cases = {
      internistisch: () => ({
        id: "rs_asthma_01",
        specialty: "internistisch",
        
        // STORY & DIALOG
        story: "Einsatzstichwort: 'Atemnot'. Ort: Sportplatz. Du triffst auf Lukas M. (17), der nach einem 100m-Sprint auf der Bank sitzt. Er stützt sich mit den Armen auf den Oberschenkeln ab (Kutschersitz) und ringt deutlich nach Luft.",
        intro_dialogue: "Hilfe... ich krieg... kaum Luft! *keuch* ... Hab mein Spray... in der Kabine... vergessen!",
        
        target_outcome: "Lagerung, Lippenbremse, O2-Gabe, Medikamentengabe (Spray) unterstützen, Transport.",
        
        vitals: { RR: "138/86", SpO2: 85, AF: 28, Puls: 124, BZ: 108, Temp: 36.8, GCS: 15 },

        // 4S - WICHTIG: Hier stehen die Details
        scene_4s: {
          sicherheit: "Keine akute Eigen- oder Fremdgefährdung. Sportplatz ist offen, Untergrund fest.",
          szene: "Patient sitzt isoliert auf einer Bank, wirkt panisch. Trainer steht hilflos daneben.",
          sichtung_personen: "1 Patient (Lukas), ansprechbar aber dyspnoisch. Trainer als Auskunftsperson.",
          support_empfehlung: "NA-Nachforderung bei Sättigung < 90% trotz O2 oder Erschöpfung erwägen."
        },

        anamnesis: {
          SAMPLER: {
            S: "Akute Atemnot, thorakales Engegefühl, 'wie zugeschnürt'",
            A: "Birkenpollen, Hausstaubmilben",
            M: "Salbutamol Spray (Bedarf), Budesonid (morgens)",
            P: "Bekanntes Asthma bronchiale seit dem 6. Lebensjahr",
            L: "Müsliriegel vor 1 Stunde",
            E: "Belastungssprint bei hohem Pollenflug",
            R: "Keine Auslandsreisen, kein Infektzeichen"
          },
          vorerkrankungen: ["Asthma bronchiale"],
          medikation: ["Salbutamol", "Kortisonspray"],
          allergien: ["Pollen"],
          antikoagulation: false,
          OPQRST: {
            O: "Plötzlich nach Belastungsspitze",
            P: "Laufen verschlimmert, Sitzen/Kutschersitz lindert leicht",
            Q: "Engegefühl, Giemen hörbar",
            R: "Keine Ausstrahlung",
            S: "Subjektive Luftnot 8/10",
            T: "Seit ca. 10 Minuten anhaltend"
          }
        },

        hidden: {
          diagnosis_keys: ["Asthma", "Obstruktion", "Spastik"],
          // X-ABCDE DETAILS
          bleeding_info: "Keine kritischen Blutungen sichtbar. Haut ist intakt, keine Traumazeichen.",
          mouth: "Mundraum frei, Schleimhäute leicht trocken, kein Fremdkörper, keine Schwellung.",
          lung: "Auskeultation: Deutlich verlängertes Exspirium mit Giemen und Pfeifen über allen Lungenfeldern. Silent Chest basal nicht auszuschließen.",
          abdomen: "Bauchdecke weich, kein Druckschmerz, Darmgeräusche vorhanden.",
          skin: "Haut blass, leicht schweißig, leichte periphere Zyanose an den Lippen.",
          pupils: "Pupillen isokor, mittelweit, reagieren prompt auf Licht.",
          befast: "Keine neurologischen Ausfälle. Arme werden seitengleich gehalten, Sprache dyspnoisch abgehackt aber verständlich.",
          ekg_pattern: "sinus",
          ekg12: "Sinustachykardie (124/min), Lagetyp unauffällig, keine ST-Strecken-Veränderungen.",
          pain: { nrs: 0, ort: "Brustkorb", charakter: "Druck/Enge (kein Schmerz)" },
          injuries: []
        }
      }),

      neurologisch: () => ({
        id: "rs_hypoglyk_01",
        specialty: "neurologisch",
        
        story: "Einsatzstichwort: 'Verwirrte Person'. Ort: Einfamilienhaus. Die Ehefrau führt dich ins Wohnzimmer. Karl H. (65) sitzt auf dem Sofa, wirkt abwesend und zittert leicht.",
        intro_dialogue: "Was... wer seid ihr? Ich... mir ist so... komisch... alles dreht sich...",

        vitals: { RR: "146/88", SpO2: 96, AF: 18, Puls: 96, BZ: 42, Temp: 36.4, GCS: 13 },

        scene_4s: {
          sicherheit: "Wohnung sicher, keine Waffen/Gefahrenstoffe sichtbar. Hund ist weggesperrt.",
          szene: "Patient auf Sofa, kaltschweißig. Essensreste auf dem Tisch (unangerührt).",
          sichtung_personen: "1 Patient, Ehefrau ist aufgeregt aber kooperativ.",
          support_empfehlung: "Notarzt bei Bewusstlosigkeit oder Krampfanfall nachfordern."
        },

        anamnesis: {
          SAMPLER: {
            S: "Desorientiertheit, Kaltschweißigkeit, Tremor (Zittern)",
            A: "Penicillin",
            M: "Insulin (Lantus), Metformin, Ramipril",
            P: "Diabetes Typ 2 (seit 15 Jahren), Hypertonie",
            L: "Gestern Abend. Frühstück heute vergessen.",
            E: "Insulin gespritzt, aber Frühstück ausgelassen",
            R: "-"
          },
          OPQRST: { O: "Seit 30 min", P: "-", Q: "Schwächegefühl", R: "-", S: "-", T: "Zunehmende Verschlechterung" }
        },

        hidden: {
          diagnosis_keys: ["Hypoglykämie", "Unterzucker"],
          bleeding_info: "Keine Blutungen. Patient ist jedoch auffällig kaltschweißig (nasses T-Shirt).",
          mouth: "Mundraum frei, Zunge intakt (kein Biss), kein Prothesen-Problem.",
          lung: "Vesikuläres Atemgeräusch beidseits, keine Rasselgeräusche.",
          skin: "Haut blass, feucht, kühl (typischer Hypoglykämie-Schweiß).",
          pupils: "Isokor, mittelweit, prompt.",
          befast: "Grobe Kraft erhalten, verwaschene Sprache durch Vigilanzminderung, kein einseitiges Defizit.",
          ekg_pattern: "sinus",
          ekg12: "Sinusrhythmus 96/min, keine Ischämiezeichen.",
          pain: { nrs: 0, ort: "-", charakter: "-" },
          injuries: []
        }
      }),

trauma: () => ({
        id: "rs_trauma_arm",
        specialty: "trauma",
        
        story: "Fahrradsturz auf Radweg. Lena S. (29) sitzt am Boden und hält ihren rechten Unterarm. Der Arm weist eine deutliche Bajonett-Fehlstellung auf.",
        intro_dialogue: "Aua! Mein Arm! Scheiße, das tut so weh... bitte helfen Sie mir, da hat es laut geknackt!",

        vitals: { RR: "135/82", SpO2: 98, AF: 20, Puls: 110, BZ: 102, Temp: 36.7, GCS: 15 },

        scene_4s: {
          sicherheit: "Radweg, Gefahrenstelle durch Polizei abgesichert. Helm wurde getragen (intakt).",
          szene: "Patientin sitzt, hält Arm schonend. Fahrrad liegt daneben.",
          sichtung_personen: "1 Patientin. Keine weiteren Verletzten.",
          support_empfehlung: "Notarzt zur Analgesie (Schmerzbekämpfung) und Reposition zwingend erforderlich."
        },

        anamnesis: {
          SAMPLER: {
            S: "Extremer Schmerz rechter Unterarm, Fehlstellung",
            A: "Keine",
            M: "Pille (Kontrazeptiva)",
            P: "Keine Vorerkrankungen",
            L: "Kaffee vor 2h",
            E: "Sturz über Bordsteinkante auf ausgestreckten Arm",
            R: "-"
          },
          OPQRST: { O: "Sofort", P: "Jede Bewegung ++", Q: "Stechend, vernichtend", R: "Lokal begrenzt", S: "NRS 9/10", T: "Akut" }
        },

        hidden: {
          diagnosis_keys: ["Fraktur", "Radius", "Unterarm"],
          injury_map: ["arm_r"],
          bleeding_info: "Schürfwunden am Unterarm, keine spritzende Blutung. Hämatom entwickelt sich schnell.",
          mouth: "Frei, keine Zahnverletzungen.",
          lung: "Beidseits belüftet, unauffällig.",
          skin: "Rosig, warm. Am rechten Arm Schwellung und Fehlstellung.",
          pupils: "Isokor, prompt.",
          befast: "Motorik rechte Hand schmerzbedingt eingeschränkt, DMS prüfen!",
          ekg_pattern: "sinus",
          ekg12: "Sinustachykardie (Schmerzstress), sonst o.B.",
          pain: { nrs: 9, ort: "Rechter Unterarm", charakter: "Stechend, pulsierend" },
          injuries: ["Geschlossene distale Radiusfraktur rechts", "Schürfwunden Ellenbogen"],
          
          // NEU: NEXUS-Kriterien
          nexus_criteria: {
            summary: "Patient ist wach und ansprechbar (GCS 15), neurologische Untersuchung ist unauffällig. Es liegt jedoch eine sehr schmerzhafte, ablenkende Fraktur vor.",
            c1: false, // Empfindlichkeit in der HWS
            c2: false, // Neurologische Ausfälle
            c3: false, // Vigilanz-/Bewusstseinsstörung
            c4: false, // Intoxikation
            c5: true,  // Ablenkende Verletzung (Fraktur NRS 9/10)
          },
          
          // NEU: Polytrauma-Kriterien
          polytrauma_criteria: {
            vitals: "RR 135/82, SpO2 98%, GCS 15. Kriterien nicht erfüllt.",
            anatomical: "Isolierte Fraktur am Unterarm. Kein Becken, Thorax oder penetrierendes Trauma. Kriterien nicht erfüllt.",
            mechanism: "Fahrradsturz über Bordsteinkante (Niedrigenergie). Kriterien nicht erfüllt.",
            special: "Keine (Alter 29, keine Antikoagulation)."
          }
        }
      })
    };

    
    // ---------- Fall auswählen ----------
    const createCase = cases[specialty] || cases["internistisch"];
    let c = createCase();

    // ---------- Defaults & Fallbacks ----------
    c.role = role;
    c.difficulty = difficulty;
    c.score = 0;
    c.steps_done = [];
    c.history = [];
    
    // Safety Fallbacks
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