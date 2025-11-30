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
      internistisch: [
        // ---------------------------------------------------------
        // FALL 1: ACS / HINTERWANDINFARKT (Vollständig)
        // ---------------------------------------------------------
        () => ({
          id: "rs_acs_hwi_01",
          specialty: "internistisch",
          story: "Einsatzstichwort: 'Thoraxschmerz'. Ort: Wohnzimmer. Herr Weber (58) sitzt blass und schweißgebadet auf dem Sofa. Er hält sich die Brust.",
          intro_dialogue: "Es brennt so... *stöhn*... wie Feuer hinter dem Brustbein. Mir ist schlecht.",
          target_outcome: "Oberkörper hoch, O2-Gabe, 12-Kanal EKG, NA-Nachforderung, Vorbereitung Zugang.",
          vitals: { RR: "105/60", SpO2: 95, AF: 18, Puls: 54, BZ: 110, Temp: 36.6, GCS: 15 },
          scene_4s: {
            sicherheit: "Keine Gefahr für das Team.",
            szene: "Ruhige häusliche Umgebung, Ehefrau anwesend.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA-Indikation: ACS Verdacht + Bradykardie."
          },
          anamnesis: {
            SAMPLER: {
              S: "Brennender retrosternaler Schmerz, Übelkeit",
              A: "Pollen",
              M: "Betablocker (Bisoprolol)",
              P: "KHK, Hypertonie",
              L: "Frühstück vor 1h",
              E: "Ruheschmerz",
              R: "Raucher, KHK"
            },
            OPQRST: { O: "Seit 20 min", P: "Keine Linderung", Q: "Brennend/Drückend", R: "Ausstrahlung rechter Arm/Oberbauch", S: "8/10", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["ACS", "Infarkt", "STEMI", "Hinterwand"],
            // X - Blutung
            bleeding_info: "Keine kritischen Blutungen sichtbar.",
            // A - Atemweg
            mouth: "Mundraum frei, keine Zyanose im Mundbereich.",
            // B - Beatmung
            lung: "Vesikuläres Atemgeräusch beidseits, keine Rasselgeräusche.",
            // C - Kreislauf
            skin: "Fahl, gräulich, kaltschweißig (Schocksymptomatik).",
            abdomen: "Weich, leichter Druckschmerz im Oberbauch (DD: Infarkt).",
            // D - Neuro
            pupils: "Isokor, mittelweit, prompt reagibel.",
            befast: "Unauffällig. Keine Paresen.",
            // EKG
            ekg_pattern: "sinus", 
            ekg12: "Sinusbradykardie. ST-Hebungen in II, III, aVF (Verdacht auf HWI).",
            // Schmerz & Verletzungen
            pain: { nrs: 8, ort: "Brust/Oberbauch", charakter: "Brennend" },
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 2: COPD EXAZERBATION (Vollständig)
        // ---------------------------------------------------------
        () => ({
          id: "rs_copd_01",
          specialty: "internistisch",
          story: "Einsatzstichwort: 'Atemnot'. Ort: Verrauchte Kleinwohnung. Frau Müller (68) sitzt im Sessel, nutzt die Atemhilfsmuskulatur und atmet gegen die geschlossenen Lippen (Lippenbremse).",
          intro_dialogue: "Ich krieg... die alte Luft... nicht raus! *hust*... Mein Spray... hilft nicht!",
          target_outcome: "Lippenbremse coachen, O2 vorsichtig (Ziel 88-92%), Kutschersitz, Beruhigen.",
          vitals: { RR: "155/95", SpO2: 86, AF: 26, Puls: 110, BZ: 140, Temp: 37.1, GCS: 15 },
          scene_4s: {
            sicherheit: "Starker Zigarettengeruch, Lüften empfohlen.",
            szene: "Patientin sitzt, wirkt erschöpft. O2-Gerät steht in der Ecke (leer).",
            sichtung_personen: "1 Patientin.",
            support_empfehlung: "NA bei Erschöpfung oder Sättigungsabfall."
          },
          anamnesis: {
            SAMPLER: {
              S: "Luftnot, produktiver Husten",
              A: "Keine",
              M: "Foster Spray, Spiriva",
              P: "COPD Gold IV",
              L: "Wasser",
              E: "Verschlechterung seit 2 Tagen, jetzt akut",
              R: "Raucherin (40 pack years)"
            },
            OPQRST: { O: "Schleichend, jetzt akut", P: "Belastung ++", Q: "Enge", R: "-", S: "Luftnot", T: "Dauerzustand verschlimmert" }
          },
          hidden: {
            diagnosis_keys: ["COPD", "Exazerbation", "Obstruktion"],
            // X
            bleeding_info: "Keine Blutungen.",
            // A
            mouth: "Mundschleimhaut trocken, Lippenzyanose sichtbar.",
            // B
            lung: "Verlängertes Exspirium, Giemen und Brummen über allen Lungenfeldern.",
            // C
            skin: "Zentral zyanotisch (blaue Lippen), Uhrglasnägel an den Fingern.",
            abdomen: "Weich, unauffällig.",
            // D
            pupils: "Isokor, prompt.",
            befast: "Unauffällig.",
            // EKG
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie, P-pulmonale (hohes P).",
            pain: { nrs: 0, ort: "Thorax", charakter: "Engegefühl" },
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 3: LUNGENEMBOLIE (Vollständig)
        // ---------------------------------------------------------
        () => ({
          id: "rs_lae_01",
          specialty: "internistisch",
          story: "Einsatzstichwort: 'Kollaps/Atemnot'. Ort: Bushaltestelle. Ein junger Mann (28) saß nach einer langen Busreise auf der Bank und hat plötzlich stechende Schmerzen beim Atmen bekommen.",
          intro_dialogue: "Hilfe! Meine Brust... *keuch*... sticht so beim Atmen! Ich krieg keine Luft!",
          target_outcome: "Oberkörper hoch, High-Flow O2, Beruhigung, NA-Nachforderung (Verdacht LAE).",
          vitals: { RR: "100/60", SpO2: 88, AF: 30, Puls: 128, BZ: 98, Temp: 36.8, GCS: 15 },
          scene_4s: {
            sicherheit: "Verkehrsraum (Haltestelle), Eigenschutz beachten.",
            szene: "Patient sitzt vornübergebeugt, panisch.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA zwingend (LAE Verdacht, Tachykardie/Hypoxie)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Atemabhängiger Brustschmerz, Dyspnoe",
              A: "-",
              M: "-",
              P: "Kürzlich Knie-OP (vor 2 Wochen)",
              L: "Snack im Bus",
              E: "Aufgestanden nach 6h Busfahrt",
              R: "Immobilisation nach OP"
            },
            OPQRST: { O: "Schlagartig", P: "Einatmen schmerzt extrem", Q: "Messerstichartig", R: "Lokalisiert rechts", S: "9/10", T: "Sofort" }
          },
          hidden: {
            diagnosis_keys: ["Lungenembolie", "LAE", "Embolie"],
            // X
            bleeding_info: "Keine äußeren Blutungen.",
            // A
            mouth: "Frei.",
            // B
            lung: "Atemgeräusch seitengleich, evtl. leicht abgeschwächt rechts. Keine Rasselgeräusche.",
            // C
            skin: "Marmorierte Haut, gestaute Halsvenen sichtbar.",
            abdomen: "Weich.",
            // D
            pupils: "Isokor, prompt.",
            befast: "Unauffällig.",
            // EKG
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie. SI-QIII-Typ (McGinn-White) erkennbar.",
            pain: { nrs: 9, ort: "Thorax rechts", charakter: "Stechend, atemabhängig" },
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 4: AKUTES LUNGENÖDEM (Vollständig)
        // ---------------------------------------------------------
        () => ({
          id: "rs_oedem_01",
          specialty: "internistisch",
          story: "Einsatzstichwort: 'Atemnot akut'. Ort: Schlafzimmer, nachts. Herr Klein (75) sitzt an der Bettkante, ringt massiv nach Luft. Es brodelt hörbar beim Atmen.",
          intro_dialogue: "*Blubbern*... ich... *röchel*... ersticke!",
          target_outcome: "Herzbettlagerung (Beine tief!), O2, NA sofort, Beruhigen.",
          vitals: { RR: "190/110", SpO2: 82, AF: 32, Puls: 100, BZ: 130, Temp: 36.5, GCS: 14 },
          scene_4s: {
            sicherheit: "Keine Gefahr.",
            szene: "Patient sitzt aufrecht, Beine aus dem Bett. Distanzrasseln hörbar.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA mit Priorität (Lungenödem)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Todesangst, Luftnot, Brodeln",
              A: "-",
              M: "Furosemid, Ramipril",
              P: "Bekannte Herzinsuffizienz",
              L: "Abendessen (salzig)",
              E: "Im Liegen schlimmer geworden",
              R: "Alter, Hypertonie"
            },
            OPQRST: { O: "Zunehmend nachts", P: "Liegen unmöglich", Q: "Ertrinkungsgefühl", R: "-", S: "10/10 (Not)", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Lungenödem", "Herzinsuffizienz", "Linksherzinsuffizienz"],
            // X
            bleeding_info: "Keine Blutung.",
            // A
            mouth: "Schaum vor dem Mund (leicht rötlich), Atemwege sonst frei.",
            // B
            lung: "Grobblasige Rasselgeräusche beidseits basal bis mittlere Felder ('Brodeln').",
            // C
            skin: "Schweißig, blass.",
            abdomen: "Weich.",
            // D
            pupils: "Isokor, prompt.",
            befast: "Unauffällig.",
            // EKG
            ekg_pattern: "sinus",
            ekg12: "Sinusrhythmus, Linkstyp, Zeichen der Hypertrophie.",
            pain: { nrs: 0, ort: "-", charakter: "-" },
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 5: HYPERTENSIVE KRISE (Vollständig)
        // ---------------------------------------------------------
        () => ({
          id: "rs_rr_01",
          specialty: "internistisch",
          story: "Einsatzstichwort: 'Kopfschmerz/Hoher Blutdruck'. Ort: Arztpraxis (Warteraum). Die Arzthelferin ruft euch. Frau Berg (50) klagt über massiven Kopfdruck und Nasenbluten.",
          intro_dialogue: "Mein Kopf platzt gleich... und es blutet so aus der Nase. Mir ist ganz schwindelig.",
          target_outcome: "Oberkörper hoch, Beruhigen, Vitalwerte, ggf. NA bei neurologischen Ausfällen.",
          vitals: { RR: "210/120", SpO2: 97, AF: 16, Puls: 88, BZ: 95, Temp: 36.9, GCS: 15 },
          scene_4s: {
            sicherheit: "Keine Gefahr.",
            szene: "Arzthelferin hat Patientin Papiertücher gegeben (blutig).",
            sichtung_personen: "1 Patientin.",
            support_empfehlung: "NA nur bei nicht kontrollierbarem RR oder neurologischen Symptomen."
          },
          anamnesis: {
            SAMPLER: {
              S: "Kopfschmerz (Stirn), Epistaxis (Nasenbluten), Ohrensausen",
              A: "Penicillin",
              M: "Candesartan (heute vergessen)",
              P: "Arterielle Hypertonie",
              L: "Kaffee",
              E: "Stress im Wartezimmer",
              R: "Tabletten-Non-Compliance"
            },
            OPQRST: { O: "Vor 30 min", P: "Licht/Lärm stört", Q: "Pochend, drückend", R: "Ganze Stirn", S: "7/10", T: "Zunehmend" }
          },
          hidden: {
            diagnosis_keys: ["Hypertensive Krise", "Bluthochdruck", "Hypertonie", "Epistaxis"],
            // X
            bleeding_info: "Nasenbluten (Epistaxis) - läuft, aber nicht lebensbedrohlich spritzend.",
            // A
            mouth: "Blut im Rachenraum durch Nasenbluten, Schluckreflex intakt.",
            // B
            lung: "Frei belüftet.",
            // C
            skin: "Hochrot (Gesicht/Flush).",
            abdomen: "Weich.",
            // D
            pupils: "Isokor, prompt.",
            befast: "Keine neurologischen Ausfälle (wichtig zur Abgrenzung Apoplex!).",
            // EKG
            ekg_pattern: "sinus",
            ekg12: "Sinusrhythmus, unauffällig.",
            pain: { nrs: 7, ort: "Kopf", charakter: "Pochend" },
            injuries: []
          }
        }),
        // ---------------------------------------------------------
        // FALL 6: ANAPHYLAXIE (Vollständig)
        // ---------------------------------------------------------
        () => ({
          id: "rs_ana_01",
          specialty: "internistisch",
          story: "Einsatzstichwort: 'Allergische Reaktion'. Ort: Gartenfest. Tim (24) wurde beim Grillen gestochen. Er hat jetzt eine kloßige Stimme und rote Flecken am Hals.",
          intro_dialogue: "Ich hab... so einen Kloß im Hals... *schluck*... und alles juckt!",
          target_outcome: "Allergen entfernen (Stachel?), O2, Kühlen, NA sofort (Atemwege bedroht!), Überwachung.",
          vitals: { RR: "100/60", SpO2: 93, AF: 22, Puls: 115, BZ: 100, Temp: 37.0, GCS: 15 },
          scene_4s: {
            sicherheit: "Wespen noch in der Nähe? Eigenschutz.",
            szene: "Patient sitzt auf Gartenstuhl, kratzt sich.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA zwingend (beginnender anaphylaktischer Schock)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Juckreiz, Globusgefühl (Kloß), Atemnot beginnend",
              A: "Wespengift (bekannt)",
              M: "Hat sein Notfallset nicht dabei",
              P: "Allergie",
              L: "Bratwurst",
              E: "Stich in den Unterarm vor 5 min",
              R: "-"
            },
            OPQRST: { O: "Sofort nach Stich", P: "-", Q: "Juckend, schwellend", R: "Ganzer Körper (Exanthem)", S: "Bedrohlich", T: "Schnell fortschreitend" }
          },
          hidden: {
            diagnosis_keys: ["Anaphylaxie", "Allergie", "Schock"],
            // X
            bleeding_info: "Keine Blutung, aber starke Rötung (Exanthem).",
            // A - Kritisch hier!
            mouth: "Zunge leicht geschwollen, Uvulaödem sichtbar (Atemweg gefährdet!).",
            // B
            lung: "Leichtes Giemen (beginnende Obstruktion), Stridor über Hals hörbar.",
            // C
            skin: "Urtikaria (Quaddeln) am ganzen Stamm, Rötung, warm.",
            abdomen: "Weich.",
            // D
            pupils: "Isokor, prompt.",
            befast: "Unauffällig.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 3, ort: "Einstichstelle Arm", charakter: "Brennend/Juckend" },
            injuries: [] // Keine Verletzungen, nur der Stich
          }
        }),

        // ---------------------------------------------------------
        // FALL 7: GASTROINTESTINALE BLUTUNG (Vollständig)
        // ---------------------------------------------------------
        () => ({
          id: "rs_gi_01",
          specialty: "internistisch",
          story: "Einsatzstichwort: 'Erbrechen'. Ort: Badezimmer. Herr Schmidt (55) kniet vor der Toilette. In der Schüssel ist kaffeesatzartiges Erbrechen.",
          intro_dialogue: "Mir ist so schlecht... *würg*... und mir wird schwarz vor Augen, wenn ich aufstehe.",
          target_outcome: "Flachlagerung, Vitalwerte, Zugang vorbereiten, NA (Volumenmangel/Schockgefahr).",
          vitals: { RR: "90/50", SpO2: 96, AF: 20, Puls: 118, BZ: 105, Temp: 36.4, GCS: 14 },
          scene_4s: {
            sicherheit: "Infektionsgefahr (Blut/Erbrochenes) -> Handschuhe!",
            szene: "Blutiges/Schwarzes Erbrechen in Toilette. Streng fauliger Geruch.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA erforderlich (Kreislaufinstabilität, GI-Blutung)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Hämatemesis (Kaffeesatz), Schwindel, Schwäche",
              A: "-",
              M: "Ibuprofen 600 (wegen Rückenschmerzen, nimmt er oft)",
              P: "Gastritis bekannt",
              L: "Gestern Abend",
              E: "Übelkeit seit Stunden",
              R: "NSAR-Abusus, Alkohol"
            },
            OPQRST: { O: "Heute morgen", P: "Aufstehen (Schwindel)", Q: "Übelkeit", R: "Oberbauch", S: "Schwindel stark", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["GI-Blutung", "Magenblutung", "Ulcus"],
            // X
            bleeding_info: "Keine äußere Spritzblutung, aber Hämatemesis (Erbrechen von Blut).",
            // A
            mouth: "Reste von kaffeesatzartigem Erbrechen im Mundwinkel.",
            // B
            lung: "Frei.",
            // C
            skin: "Blass, kaltschweißig, verlängerte Rekap-Zeit (> 2 Sek).",
            abdomen: "Druckschmerz im Epigastrium (Oberbauch). Abwehrspannung weich.",
            // D
            pupils: "Isokor, prompt.",
            befast: "Unauffällig.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie (Volumenmangel).",
            pain: { nrs: 4, ort: "Oberbauch", charakter: "Drückend/Brennend" },
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 8: HYPERGLYKÄMIE / KETOAZIDOSE (Vollständig)
        // ---------------------------------------------------------
        () => ({
          id: "rs_hyper_01",
          specialty: "internistisch",
          story: "Einsatzstichwort: 'Übelkeit/Erbrechen'. Ort: Jugendzimmer. Lisa (18) liegt im Bett, wirkt schläfrig. Es riecht komisch im Zimmer (süßlich/Obstatom).",
          intro_dialogue: "Ich hab so Durst... *stöhn*... und Bauchweh... muss dauernd aufs Klo...",
          target_outcome: "BZ messen (!), Flüssigkeit vorbereiten, NA (Ketoazidose), Überwachung.",
          vitals: { RR: "105/70", SpO2: 98, AF: 28, Puls: 112, BZ: 450, Temp: 37.2, GCS: 13 },
          scene_4s: {
            sicherheit: "-",
            szene: "Acetongeruch (Nagellackentferner/faulige Äpfel) in der Luft.",
            sichtung_personen: "1 Patientin, Eltern besorgt.",
            support_empfehlung: "NA (diabetisches Koma droht)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Polydipsie (Durst), Polyurie (viel Urin), Bauchschmerzen",
              A: "-",
              M: "Insulin (Pumpe - Schlauch abgeknickt?)",
              P: "Diabetes Typ 1",
              L: "Wasser",
              E: "Pumpe hat wohl Alarm gegeben, wurde ignoriert",
              R: "Infekt als Auslöser?"
            },
            OPQRST: { O: "Seit gestern schlechter", P: "-", Q: "Bauchweh diffus", R: "-", S: "-", T: "Verschlechterung" }
          },
          hidden: {
            diagnosis_keys: ["Hyperglykämie", "Ketoazidose", "Diabetes"],
            // X
            bleeding_info: "Keine Blutung.",
            // A
            mouth: "Mundhöhle sehr trocken, Acetongeruch.",
            // B
            lung: "Tiefe, angestrengte Atmung (Kussmaul-Atmung) zum Abatmen der Säure.",
            // C
            skin: "Trocken, warm, stehende Hautfalten (Exsikkose).",
            abdomen: "Harter Bauch (Pseudoperitonitis durch Azidose).",
            // D
            pupils: "Isokor, träge.",
            befast: "Verwaschene Sprache durch Somnolenz/trockenen Mund.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 5, ort: "Bauch", charakter: "Diffus" },
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 9: SYNKOPE / EXSIKKOSE (Vollständig)
        // ---------------------------------------------------------
        () => ({
          id: "rs_exsikkose_01",
          specialty: "internistisch",
          story: "Einsatzstichwort: 'Hilflose Person'. Ort: Überhitzte Dachgeschosswohnung im Sommer. Frau Krause (82) wurde von der Tochter am Boden gefunden, ist jetzt wieder ansprechbar.",
          intro_dialogue: "Wo bin ich? Ich wollte nur zum Fenster... dann ging das Licht aus.",
          target_outcome: "Vitalwerte, Flüssigkeit (Trinken lassen oder Zugang), kühle Umgebung, Sturz abklären.",
          vitals: { RR: "95/60", SpO2: 94, AF: 18, Puls: 98, BZ: 110, Temp: 37.8, GCS: 14 },
          scene_4s: {
            sicherheit: "Wohnung extrem warm.",
            szene: "Patientin liegt am Boden, keine offensichtlichen Frakturen.",
            sichtung_personen: "1 Patientin.",
            support_empfehlung: "KTW ausreichend, wenn keine Verletzung. NA nur bei Schock."
          },
          anamnesis: {
            SAMPLER: {
              S: "Schwindel, Schwäche, trockener Mund",
              A: "-",
              M: "Wassertabletten (Diuretika), Betablocker",
              P: "Herzschwäche",
              L: "Frühstück kaum gegessen, wenig getrunken",
              E: "Hitzeperiode seit 3 Tagen",
              R: "Alter, Hitze, Diuretika"
            },
            OPQRST: { O: "Plötzlich schwarz vor Augen", P: "Aufstehen", Q: "-", R: "-", S: "-", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Exsikkose", "Synkope", "Austrocknung", "Kollaps"],
            // X
            bleeding_info: "Minimale Blutung am Hinterkopf (Platzwunde).",
            // A
            mouth: "Zunge trocken wie Borke, kaum Speichel.",
            // B
            lung: "Frei.",
            // C
            skin: "Stehende Hautfalte am Handrücken, warm.",
            abdomen: "Weich.",
            // D
            pupils: "Isokor, prompt.",
            befast: "Unauffällig.",
            ekg_pattern: "sinus",
            ekg12: "Sinusrhythmus.",
            pain: { nrs: 2, ort: "Hinterkopf", charakter: "Pochern" },
            injuries: ["Kleine Platzwunde Hinterkopf"]
          }
        }),

        // ---------------------------------------------------------
        // FALL 10: ALKOHOLINTOXIKATION (Vollständig)
        // ---------------------------------------------------------
        () => ({
          id: "rs_c2_01",
          specialty: "internistisch",
          story: "Einsatzstichwort: 'Nicht ansprechbar'. Ort: Parkbank. Passanten haben einen Mann (ca. 45) gefunden, der nicht auf Ansprache reagiert. Neben ihm liegen leere Flaschen.",
          intro_dialogue: "*Lallt unverständlich*... lass misch... *schläft ein*",
          target_outcome: "Stabile Seitenlage, BZ-Ausschluss (!), Wärmeerhalt, Überwachung, Eigenschutz.",
          vitals: { RR: "110/70", SpO2: 95, AF: 12, Puls: 80, BZ: 85, Temp: 35.8, GCS: 10 },
          scene_4s: {
            sicherheit: "Keine Gewalt, aber Flaschen (Scherben?).",
            szene: "Starker Foetor ex ore (Alkoholgeruch).",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "RTW ausreichend, wenn Atemwege sicher. NA bei GCS < 8 oder Trauma."
          },
          anamnesis: {
            SAMPLER: {
              S: "Somnolenz, Lallen",
              A: "Unbekannt",
              M: "Unbekannt",
              P: "Unbekannt",
              L: "Alkohol",
              E: "Alkoholkonsum",
              R: "Aspirationsgefahr"
            },
            OPQRST: { O: "-", P: "-", Q: "-", R: "-", S: "-", T: "-" }
          },
          hidden: {
            diagnosis_keys: ["Intoxikation", "C2", "Alkohol", "Vollrausch"],
            // X
            bleeding_info: "Keine Blutung.",
            // A
            mouth: "Frei, aber Geruch nach Alkohol. Zunge fällt leicht zurück (Schnarchen?).",
            // B
            lung: "Frei, keine Aspiration hörbar.",
            // C
            skin: "Kühl, rosig.",
            abdomen: "Weich.",
            // D
            pupils: "Isokor, leicht verzögert.",
            befast: "Nicht beurteilbar (Somnolenz).",
            ekg_pattern: "sinus",
            ekg12: "Sinusrhythmus.",
            pain: { nrs: 0, ort: "-", charakter: "-" },
            injuries: []
          }
        }),
        // ---------------------------------------------------------
        // FALL 11: HYPOGLYKÄMIE (Der Klassiker)
        // ---------------------------------------------------------
        () => ({
          id: "rs_hypo_int_01",
          specialty: "internistisch",
          story: "Einsatzstichwort: 'Hilflose Person / Aggressiv'. Ort: Supermarkt. Ein Mann (40) pöbelt an der Kasse und zittert am ganzen Körper. Er wirkt extrem unkooperativ.",
          intro_dialogue: "Fasst mich nicht an! Ich will... Schokolade... mir ist so komisch...",
          target_outcome: "Eigenschutz, BZ messen (!), schnelle Glucosegabe (Cola/Jubbin/i.v.), Ursachenforschung.",
          vitals: { RR: "160/90", SpO2: 98, AF: 20, Puls: 115, BZ: 38, Temp: 36.2, GCS: 13 }, // BZ < 40 ist kritisch!
          scene_4s: {
            sicherheit: "Patient verbal aggressiv (Hungerast).",
            szene: "Patient ist klitschnass geschwitzt.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA, falls Zugang durch RS nicht möglich oder Aspiration droht."
          },
          anamnesis: {
            SAMPLER: {
              S: "Zittern (Tremor), Kaltschweißigkeit, Aggression (Neuroglykopenie)",
              A: "-",
              M: "Insulin (Actrapid)",
              P: "Diabetes Typ 1",
              L: "Mittagessen ausgefallen",
              E: "Stress auf Arbeit, dann Einkaufen",
              R: "Insulin gespritzt ohne Essen"
            },
            OPQRST: { O: "Seit 15 min", P: "Essen hilft", Q: "Schwäche", R: "-", S: "-", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Hypoglykämie", "Unterzucker", "Diabetes"],
            // X
            bleeding_info: "Keine.",
            // A
            mouth: "Frei.",
            // B
            lung: "Frei.",
            // C - TYPISCH
            skin: "Nass, kalt, blass (Sympathikus-Aktivierung).",
            abdomen: "Weich, Heißhunger.",
            // D
            pupils: "Seitengleich, weit.",
            befast: "Neurologisch diffus auffällig (Wortfindungsstörung), aber keine Halbseitenlähmung. Bessert sich sofort nach Glucose.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 0, ort: "-", charakter: "-" },
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 12: PNEUMONIE / SEPTISCHER INFEKT
        // ---------------------------------------------------------
        () => ({
          id: "rs_pneumonie_01",
          specialty: "internistisch",
          story: "Einsatzstichwort: 'Hohes Fieber/Atemnot'. Ort: Pflegeheim. Frau S. (88) ist heute kaum ansprechbar. Die Pflegekraft berichtet von starkem Husten seit 3 Tagen.",
          intro_dialogue: "*Röchelt leise*... Durst... heiß...",
          target_outcome: "Oberkörper hoch, O2-Gabe, Sepsis-Screening (qSOFA), Hydrierung, Transport.",
          vitals: { RR: "100/60", SpO2: 89, AF: 32, Puls: 110, BZ: 130, Temp: 39.5, GCS: 12 }, // Kritisch: AF hoch, SpO2 tief, Fieber
          scene_4s: {
            sicherheit: "Eigenschutz (Maske tragen!).",
            szene: "Patientin liegt flach, rasselt beim Atmen. Taschentücher mit grünlichem Auswurf.",
            sichtung_personen: "1 Patientin.",
            support_empfehlung: "NA (Sepsis-Verdacht, respiratorische Insuffizienz)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Fieber, produktiver Husten, Dyspnoe",
              A: "-",
              M: "ASS 100, Ramipril",
              P: "Z.n. Herzinfarkt, Demenz",
              L: "Frühstück verweigert",
              E: "Verschlechterung über Tage",
              R: "Alter, Bettlägerigkeit"
            },
            OPQRST: { O: "Seit Tagen", P: "-", Q: "-", R: "Thorax (pleuritischer Schmerz beim Husten)", S: "-", T: "-" }
          },
          hidden: {
            diagnosis_keys: ["Pneumonie", "Lungenentzündung", "Sepsis", "Infekt"],
            // X
            bleeding_info: "Keine.",
            // A
            mouth: "Trocken, borkig.",
            // B - BEFUND
            lung: "Rechts basal feuchte Rasselgeräusche, links frei. Tachypnoe.",
            // C
            skin: "Heiß, trocken (Exsikkose) und rot (Fieber).",
            abdomen: "Weich.",
            // D
            pupils: "Isokor.",
            befast: "Unauffällig, aber Vigilanz gemindert (Somnolenz durch Infekt).",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 4, ort: "Brustkorb rechts", charakter: "Stechend beim Husten" },
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 13: VORHOFFLIMMERN (Tachyarrhythmie)
        // ---------------------------------------------------------
        () => ({
          id: "rs_vhf_01",
          specialty: "internistisch",
          story: "Einsatzstichwort: 'Herzrasen'. Ort: Büro. Herr L. (55) sitzt am Schreibtisch und fasst sich an den Hals. Er wirkt sehr unruhig und ängstlich.",
          intro_dialogue: "Mein Herz... es stolpert so... es springt mir fast aus der Brust! Mir ist schwindelig.",
          target_outcome: "Beruhigung, Valsalva-Manöver versuchen (wenn Protokoll erlaubt), 12-Kanal EKG, Transport Monitorüberwacht.",
          vitals: { RR: "110/80", SpO2: 97, AF: 18, Puls: 160, BZ: 100, Temp: 36.8, GCS: 15 }, // Puls viel zu schnell!
          scene_4s: {
            sicherheit: "-",
            szene: "Patient wirkt panisch, Hyperventilation droht.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA bei Instabilität (Schock) oder Brustschmerz (Ischämie)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Palpitationen (Herzrasen), Schwindel, Unruhe",
              A: "-",
              M: "Schilddrüsen-Tabletten (L-Thyroxin) - Dosis erhöht?",
              P: "Hyperthyreose",
              L: "Kaffee (3 Tassen)",
              E: "Plötzlicher Beginn",
              R: "Stress, Koffein"
            },
            OPQRST: { O: "Vor 1h", P: "Keine Änderung", Q: "Stolpern/Rasen", R: "-", S: "Unangenehm", T: "Anhaltend" }
          },
          hidden: {
            diagnosis_keys: ["VHF", "Vorhofflimmern", "Tachyarrhythmie", "Arrhythmie"],
            // X
            bleeding_info: "Keine.",
            // A
            mouth: "Frei.",
            // B
            lung: "Frei.",
            // C - TASTBEFUND
            skin: "Leicht schweißig.",
            abdomen: "Weich.",
            // D
            pupils: "Isokor.",
            befast: "Unauffällig.",
            ekg_pattern: "vhf", // Wichtig für Monitor-Anzeige (unregelmäßig)
            ekg12: "Absolute Arrhythmie bei Vorhofflimmern. Frequenz ~150-170/min. Keine P-Wellen.",
            pain: { nrs: 0, ort: "Brust", charakter: "Rasen (kein Schmerz)" },
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 14: NOROVIRUS / GASTROENTERITIS (Kollaps)
        // ---------------------------------------------------------
        () => ({
          id: "rs_gastro_01",
          specialty: "internistisch",
          story: "Einsatzstichwort: 'Kreislaufkollaps'. Ort: Seniorenresidenz. Frau B. (79) ist im Bad kollabiert. Seit gestern herrscht im Heim eine Norovirus-Welle.",
          intro_dialogue: "Ich bin so schwach... nicht aufstehen... mir wird schwarz...",
          target_outcome: "Volumengabe (Zugang!), Infektionsschutz (Handschuhe/Kittel!), Flachlagerung.",
          vitals: { RR: "85/50", SpO2: 95, AF: 16, Puls: 105, BZ: 110, Temp: 37.2, GCS: 14 }, // Hypotonie
          scene_4s: {
            sicherheit: "Hohe Ansteckungsgefahr! Schutzkleidung!",
            szene: "Patientin liegt am Boden, Durchfallspuren sichtbar.",
            sichtung_personen: "1 Patientin.",
            support_empfehlung: "RTW (Volumenmangel). NA nur bei Sturzfolge/Verletzung."
          },
          anamnesis: {
            SAMPLER: {
              S: "Massives Erbrechen und Durchfall seit 24h, Synkope",
              A: "-",
              M: "Betablocker",
              P: "KHK",
              L: "Nichts behalten",
              E: "Norovirus-Ausbruch im Heim",
              R: "Alter + Exsikkose"
            },
            OPQRST: { O: "Gestern", P: "-", Q: "Krampfartig", R: "Bauch", S: "5/10", T: "Wellenartig" }
          },
          hidden: {
            diagnosis_keys: ["Gastroenteritis", "Norovirus", "Brechdurchfall", "Exsikkose"],
            // X
            bleeding_info: "Keine.",
            // A
            mouth: "Trocken.",
            // B
            lung: "Frei.",
            // C
            skin: "Stehende Hautfalten, trocken, blass.",
            abdomen: "Druckschmerz im gesamten Bauch, lebhafte Darmgeräusche.",
            // D
            pupils: "Isokor.",
            befast: "Unauffällig.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie (Volumenmangel).",
            pain: { nrs: 5, ort: "Bauch", charakter: "Krampfartig" },
            injuries: ["Prellmarke an der Hüfte (Sturz)"]
          }
        }),

        // ---------------------------------------------------------
        // FALL 15: AORTENDISSEKTION (Red Flag Rückenschmerz)
        // ---------------------------------------------------------
        () => ({
          id: "rs_aorta_01",
          specialty: "internistisch",
          story: "Einsatzstichwort: 'Rückenschmerzen'. Ort: Werkstatt. Ein Mechaniker (50) hat beim Reifenwechseln plötzlich geschrien und liegt nun gekrümmt am Boden.",
          intro_dialogue: "Es zerreißt mich! Mitten im Rücken... wie ein Messerstoß! Aaaah!",
          target_outcome: "Verdacht schöpfen (Vernichtungsschmerz!), RR beidseits messen (Differenz?), NA sofort (Lebensgefahr!), Schockraum.",
          vitals: { RR: "210/110", SpO2: 98, AF: 22, Puls: 100, BZ: 120, Temp: 36.5, GCS: 15 }, // Hypertensive Entgleisung als Auslöser
          scene_4s: {
            sicherheit: "-",
            szene: "Patient windet sich vor Schmerzen.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA mit höchster Prio (V.a. Aortendissektion/Ruptur)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Vernichtungsschmerz zwischen den Schulterblättern",
              A: "-",
              M: "Nimmt keine (trotz hohem RR)",
              P: "Unbehandelter Bluthochdruck",
              L: "Mittag",
              E: "Schwere körperliche Arbeit (Blutdruckspitze)",
              R: "Hypertonie"
            },
            OPQRST: { O: "Schlagartig", P: "Keine Linderung", Q: "Reißend / Schneidend", R: "Wandert nach unten", S: "10/10", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Aortendissektion", "Aorta", "Dissektion", "Ruptur"],
            // X
            bleeding_info: "Keine äußere Blutung.",
            // A
            mouth: "Frei.",
            // B
            lung: "Frei.",
            // C - DER CLOU
            skin: "Blass, schweißig (Schockzeichen trotz hohem RR!).",
            abdomen: "Pulsierende Resistenz im Oberbauch tastbar? (Evtl. Bauchaorta betroffen).",
            // D
            pupils: "Isokor.",
            befast: "Evtl. leichte Beinschwäche (Durchblutung Rückenmark?), sonst o.B.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie. KEINE ST-Hebung (Abgrenzung Herzinfarkt!).",
            pain: { nrs: 10, ort: "Zwischen Schulterblättern", charakter: "Reißend" },
            injuries: []
          }
        }),
        // ---------------------------------------------------------
        // FALL 16: NIERENKOLIK (Extremer Schmerz)
        // ---------------------------------------------------------
        () => ({
          id: "rs_kolik_01",
          specialty: "internistisch",
          story: "Einsatzstichwort: 'Flankenschmerzen'. Ort: Wohnung. Herr R. (45) läuft unruhig im Wohnzimmer auf und ab. Er krümmt sich und stöhnt laut.",
          intro_dialogue: "Es zerreißt mich... Aaaah! Ich halte es nicht aus... ich kann nicht liegen, nicht stehen!",
          target_outcome: "Schmerzmanagement (NA!), Lagerung nach Wunsch (Patient ist motorisch unruhig), Urin beurteilen (Blut?), Transport.",
          vitals: { RR: "160/100", SpO2: 98, AF: 24, Puls: 110, BZ: 100, Temp: 36.9, GCS: 15 },
          scene_4s: {
            sicherheit: "-",
            szene: "Patient extrem unruhig ('Tigern'), typisch für Kolik.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA zur Analgesie (NRS 10/10)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Wellenförmiger Flankenschmerz, Ausstrahlung Leiste, Übelkeit",
              A: "-",
              M: "Keine",
              P: "Nierensteine vor 5 Jahren",
              L: "Wasser",
              E: "Plötzlicher Beginn",
              R: "Wenig getrunken in letzter Zeit"
            },
            OPQRST: { O: "Schlagartig", P: "Keine Position hilft", Q: "Wellenartig / Wehenartig", R: "Rechte Flanke -> Hoden", S: "10/10", T: "Seit 30 min" }
          },
          hidden: {
            diagnosis_keys: ["Nierenkolik", "Urolithiasis", "Nierenstein", "Kolik"],
            // X
            bleeding_info: "Keine.",
            // A
            mouth: "Frei, Lippen zerbissen vor Schmerz.",
            // B
            lung: "Frei.",
            // C
            skin: "Schweißgebadet, blass.",
            abdomen: "Klopfschmerz im Nierenlager rechts positiv. Bauch weich.",
            // D
            pupils: "Isokor.",
            befast: "Unauffällig.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie (Schmerz).",
            pain: { nrs: 10, ort: "Rechte Flanke", charakter: "Wellenartig/Vernichtend" },
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 17: HITZSCHLAG (Umwelt-Notfall)
        // ---------------------------------------------------------
        () => ({
          id: "rs_hitze_01",
          specialty: "internistisch",
          story: "Einsatzstichwort: 'Bewusstlos auf Baustelle'. Ort: Dachstuhl (Sommer, 35°C). Ein Dachdecker (22) ist zusammengebrochen. Er redet wirres Zeug.",
          intro_dialogue: "*Lallt*... mir ist so heiß... wo ist mein Wasser...",
          target_outcome: "Sofort raus aus der Hitze! (Cooling), Vitalwerte, Flüssigkeit i.v. (NA), Transport in kühler Umgebung.",
          vitals: { RR: "100/60", SpO2: 96, AF: 22, Puls: 130, BZ: 90, Temp: 40.8, GCS: 12 }, // Lebensgefahr durch Hyperthermie!
          scene_4s: {
            sicherheit: "Hitze im Dachstuhl! Eigenschutz (nicht zu lange bleiben).",
            szene: "Patient liegt in der prallen Sonne (oder unter Dach).",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA (Hitzschlag ist lebensgefährlich -> Hirnödem). Rettung evtl. mit Drehleiter?"
          },
          anamnesis: {
            SAMPLER: {
              S: "Verwirrtheit, heiße Haut, Tachykardie",
              A: "-",
              M: "-",
              P: "Gesund",
              L: "Energy Drink morgens",
              E: "Arbeit in praller Hitze ohne Kopfbedeckung",
              R: "Zu wenig Wasser"
            },
            OPQRST: { O: "-", P: "-", Q: "-", R: "-", S: "-", T: "-" }
          },
          hidden: {
            diagnosis_keys: ["Hitzschlag", "Hyperthermie", "Sonnenstich"],
            // X
            bleeding_info: "Keine.",
            // A
            mouth: "Extrem trocken.",
            // B
            lung: "Frei.",
            // C - WICHTIGES UNTERSCHEIDUNGSMERKMAL
            skin: "Heiß und TROCKEN (kein Schweiß mehr -> Schweißdrüsenversagen). Rot.",
            abdomen: "Weich.",
            // D
            pupils: "Isokor, weit.",
            befast: "Somnolent, desorientiert.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 0, ort: "-", charakter: "-" },
            injuries: ["Evtl. Sturzmarken prüfen"]
          }
        }),

        // ---------------------------------------------------------
        // FALL 18: MECHANISCHER ILEUS (Darmverschluss)
        // ---------------------------------------------------------
        () => ({
          id: "rs_ileus_01",
          specialty: "internistisch",
          story: "Einsatzstichwort: 'Bauchschmerzen/Erbrechen'. Ort: Pflegeheim. Herr T. (80) erbricht seit Stunden. Sein Bauch ist dick wie ein Trommel.",
          intro_dialogue: "Mir ist so übel... *würg*... es kommt Kot hoch... es riecht so schlimm...",
          target_outcome: "Aspirationsschutz, Volumengabe, NA (Miserere = Stuhlerbrechen), Transport Chirurgie.",
          vitals: { RR: "110/70", SpO2: 94, AF: 20, Puls: 100, BZ: 110, Temp: 37.5, GCS: 15 },
          scene_4s: {
            sicherheit: "-",
            szene: "Erbrochenes sieht dunkelbraun aus und riecht fäkal (Miserere).",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA (Akutes Abdomen, Aspirationsgefahr, OP-Indikation)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Stuhlerbrechen (Miserere), geblähter Bauch, Stuhlverhalt",
              A: "-",
              M: "Opiate (Schmerzpflaster - begünstigt Verstopfung)",
              P: "Z.n. Bauch-OP (Verwachsungen?)",
              L: "Gestern",
              E: "Seit 3 Tagen kein Stuhlgang",
              R: "Opiate, Vor-OPs"
            },
            OPQRST: { O: "Schleichend, jetzt akut", P: "-", Q: "Krampfartig / Kolik", R: "Ganzer Bauch", S: "8/10", T: "Seit Tagen" }
          },
          hidden: {
            diagnosis_keys: ["Ileus", "Darmverschluss", "Miserere", "Akutes Abdomen"],
            // X
            bleeding_info: "Keine.",
            // A
            mouth: "Fäkalgeruch.",
            // B
            lung: "Frei, evtl. Zwerchfellhochstand (flache Atmung).",
            // C
            skin: "Trocken, gespannt.",
            abdomen: "Prall gespannt, 'Meteorismus' (Blähbauch). Auskultation: 'Hochgestellte, klingende Darmgeräusche' (oder Totenstille).",
            // D
            pupils: "Isokor.",
            befast: "Unauffällig.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 8, ort: "Bauch", charakter: "Wellenartig" },
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 19: INTOXIKATION (Suizidversuch Betablocker)
        // ---------------------------------------------------------
        () => ({
          id: "rs_suizid_01",
          specialty: "internistisch",
          story: "Einsatzstichwort: 'Bewusstlos / Abschiedsbrief'. Ort: Wohnung. Junge Frau (25) wurde von Freundin gefunden. Auf dem Tisch liegen leere Blister 'Bisoprolol' und 'Ramipril'.",
          intro_dialogue: "*Keine Reaktion auf Ansprache*... *atmet ruhig*",
          target_outcome: "Sicherung Asservate (Blister), Vitalwerte (Bradykardie/Hypotonie?), Atropin/Adrenalin vorbereiten (NA), Transport unter Reanimationsbereitschaft.",
          vitals: { RR: "70/40", SpO2: 95, AF: 12, Puls: 35, BZ: 80, Temp: 35.8, GCS: 9 }, // Kritischer Schock durch Betablocker!
          scene_4s: {
            sicherheit: "Eigenschutz (Tablettenreste). Polizei dazu (Suizidversuch).",
            szene: "Leere Schachteln: 50 Tabletten Bisoprolol fehlen.",
            sichtung_personen: "1 Patientin.",
            support_empfehlung: "NA sofort (Intoxikation mit kardiogenem Schock)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Somnolenz, Bradykardie, Hypotonie",
              A: "-",
              M: "Antidepressiva (bekannt)",
              P: "Depression",
              L: "Unbekannt",
              E: "Suizidversuch",
              R: "-"
            },
            OPQRST: { O: "-", P: "-", Q: "-", R: "-", S: "-", T: "-" }
          },
          hidden: {
            diagnosis_keys: ["Intoxikation", "Suizid", "Tabletten", "Betablocker", "Bradykardie"],
            // X
            bleeding_info: "Keine.",
            // A
            mouth: "Tablettenreste/Brei im Mund? (Prüfen!).",
            // B
            lung: "Frei.",
            // C
            skin: "Blass, kalt, schweißig (kardiogener Schock).",
            abdomen: "Weich.",
            // D
            pupils: "Isokor, prompt.",
            befast: "Somnolent.",
            ekg_pattern: "sinus", // oder AV-Block
            ekg12: "Sinusbradykardie oder AV-Block III. Grades (Dissoziation). Frequenz 35/min.",
            pain: { nrs: 0, ort: "-", charakter: "-" },
            injuries: [] // Evtl. Ritzspuren am Arm (alt/neu)
          }
        }),

        // ---------------------------------------------------------
        // FALL 20: PERIKARDITIS / MYOKARDITIS (Brustschmerz jung)
        // ---------------------------------------------------------
        () => ({
          id: "rs_myokard_01",
          specialty: "internistisch",
          story: "Einsatzstichwort: 'Thoraxschmerz'. Ort: Wohnung. Ein 19-jähriger Fußballspieler klagt über stechende Brustschmerzen. Er hatte vor 2 Wochen eine schwere Grippe, hat aber gestern wieder trainiert.",
          intro_dialogue: "Es sticht so in der Brust... vor allem wenn ich liege. Im Sitzen geht es besser.",
          target_outcome: "Schonung! (Herzgefahr), 12-Kanal EKG, NA zur Abklärung, Transport.",
          vitals: { RR: "115/75", SpO2: 97, AF: 18, Puls: 105, BZ: 98, Temp: 37.8, GCS: 15 }, // Leichtes Fieber
          scene_4s: {
            sicherheit: "-",
            szene: "Patient sitzt vornübergebeugt auf dem Sofa.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA (Verdacht auf Herzmuskelentzündung, Rhythmusstörungen möglich). RTW reicht oft, wenn stabil."
          },
          anamnesis: {
            SAMPLER: {
              S: "Thoraxschmerz (lageabhängig), Leistungsknick",
              A: "-",
              M: "-",
              P: "Grippaler Infekt vor 2 Wochen",
              L: "Müsli",
              E: "Wiederaufnahme Sporttraining gestern",
              R: "Sport trotz Infekt ('Verschleppte Grippe')"
            },
            OPQRST: { O: "Seit gestern Abend", P: "Liegen verschlimmert, Vornüberbeugen bessert (typisch Perikarditis)", Q: "Stechend", R: "Lokal", S: "6/10", T: "Anhaltend" }
          },
          hidden: {
            diagnosis_keys: ["Myokarditis", "Perikarditis", "Herzmuskelentzündung"],
            // X
            bleeding_info: "Keine.",
            // A
            mouth: "Frei.",
            // B
            lung: "Frei.",
            // C
            skin: "Warm, leicht rot (subfebril).",
            abdomen: "Weich.",
            // D
            pupils: "Isokor.",
            befast: "Unauffällig.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie. Evtl. konkave ST-Hebungen in vielen Ableitungen (Perikarditis-Zeichen), anders als beim Infarkt.",
            pain: { nrs: 6, ort: "Brust", charakter: "Stechend, lageabhängig" },
            injuries: []
          }
        }),
        
      ],

      neurologisch: [
        // ---------------------------------------------------------
        // FALL 1: SCHLAGANFALL (Medi-Infarkt rechts) - Der Klassiker
        // ---------------------------------------------------------
        () => ({
          id: "rs_stroke_01",
          specialty: "neurologisch",
          story: "Einsatzstichwort: 'Sprachstörungen'. Ort: Wohnzimmer. Frau H. (72) sitzt im Sessel. Der Ehemann berichtet, sie habe beim Frühstück plötzlich die Kaffeetasse fallen lassen.",
          intro_dialogue: "D... da... is... alles... so... k-komisch...",
          target_outcome: "BE-FAST positiv erkennen, Stroke-Unit Anmeldung, Oberkörper 30°, BZ-Ausschluss, O2 bei Bedarf.",
          vitals: { RR: "170/95", SpO2: 96, AF: 14, Puls: 88, BZ: 110, Temp: 36.8, GCS: 14 },
          scene_4s: {
            sicherheit: "Keine Gefahr.",
            szene: "Patientin wirkt wach, aber desorientiert. Hängender Mundwinkel.",
            sichtung_personen: "1 Patientin.",
            support_empfehlung: "NA nachfordern (Schlaganfall-Verdacht)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Lähmung rechts, Aphasie (Sprachstörung)",
              A: "Keine",
              M: "Marcumar (Blutverdünner!), Ramipril",
              P: "Vorhofflimmern",
              L: "Frühstück (Kaffee)",
              E: "Plötzlicher Beginn vor 30 min",
              R: "Alter, Vorhofflimmern, Hypertonie"
            },
            OPQRST: { O: "Schlagartig", P: "-", Q: "-", R: "-", S: "-", T: "Time is Brain!" }
          },
          hidden: {
            diagnosis_keys: ["Apoplex", "Schlaganfall", "Insult", "Stroke"],
            // X
            bleeding_info: "Keine äußeren Blutungen.",
            // A
            mouth: "Speichelfluss aus rechtem Mundwinkel, keine Zahnprothesen-Probleme.",
            // B
            lung: "Frei.",
            // C
            skin: "Rosig, warm.",
            abdomen: "Weich.",
            // D - NEURO HIGHLIGHTS
            pupils: "Isokor, prompt.",
            befast: "B (Balance): Schwankt beim Sitzen. E (Eyes): Blickwendung nach links (Herdblick). F (Face): Mundwinkel hängt rechts. A (Arm): Rechter Arm sinkt sofort ab. S (Speech): Aphasie.",
            ekg_pattern: "sinus", // Oder absolute Arrhythmie
            ekg12: "Absolute Arrhythmie bei Vorhofflimmern (VHF).",
            pain: { nrs: 0, ort: "-", charakter: "-" },
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 2: GENERALISIERTER KRAMPFANFALL (Postiktal)
        // ---------------------------------------------------------
        () => ({
          id: "rs_krampf_01",
          specialty: "neurologisch",
          story: "Einsatzstichwort: 'Krampfanfall'. Ort: Supermarkt Gang 3. Ein junger Mann (20) liegt am Boden. Umstehende berichten, er habe gezuckt und Schaum vor dem Mund gehabt. Jetzt ist er 'weggetreten'.",
          intro_dialogue: "*Schnarcht laut*... *reagiert nur auf Schmerzreiz mit Abwehr*",
          target_outcome: "Seitenlage (Atemweg sichern), Kopfschutz, Monitoring, NA (Status epilepticus ausgeschlossen?), Verletzungen checken.",
          vitals: { RR: "140/80", SpO2: 92, AF: 12, Puls: 110, BZ: 98, Temp: 37.5, GCS: 7 }, // Somnolent/Soporös
          scene_4s: {
            sicherheit: "Viele Gaffer im Supermarkt.",
            szene: "Patient liegt stabil, krampft aktuell NICHT mehr (postiktal).",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA zur medikamentösen Abschirmung / Transportbegleitung."
          },
          anamnesis: {
            SAMPLER: {
              S: "Bewusstlosigkeit, Zungenbiss, Einnässen",
              A: "-",
              M: "Lamotrigin (Epilepsiemittel)",
              P: "Epilepsie bekannt",
              L: "Unbekannt",
              E: "Lichtflackern in der Elektroabteilung?",
              R: "Schlafentzug?"
            },
            OPQRST: { O: "Vor 5 min", P: "-", Q: "-", R: "-", S: "-", T: "Anfall dauerte ca. 3 min" }
          },
          hidden: {
            diagnosis_keys: ["Krampfanfall", "Epilepsie", "Grand Mal", "Postiktal"],
            // X
            bleeding_info: "Blutiger Speichel am Mund.",
            // A - WICHTIG
            mouth: "Seitlicher Zungenbiss (blutet leicht), Atemwege sonst frei, schnarchende Atmung.",
            // B
            lung: "Frei.",
            // C
            skin: "Schweißig, warm. Hose im Schritt nass (Einnässen).",
            abdomen: "Weich.",
            // D
            pupils: "Isokor, weit, träge.",
            befast: "Nicht prüfbar (GCS niedrig).",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 0, ort: "-", charakter: "-" },
            injuries: ["Zungenbiss", "Leichte Prellung Schulter"]
          }
        }),

        // ---------------------------------------------------------
        // FALL 3: HIRNBLUTUNG (ICB / SAB) - Der "Kopfschmerz"-Fall
        // ---------------------------------------------------------
        () => ({
          id: "rs_icb_01",
          specialty: "neurologisch",
          story: "Einsatzstichwort: 'Extremer Kopfschmerz'. Ort: Büro. Herr F. (50) sitzt mit dem Kopf auf dem Schreibtisch. Er hält sich den Nacken und erbricht in den Papierkorb.",
          intro_dialogue: "Mein Kopf... es ist, als ob etwas geplatzt ist! *würg*... Licht aus, bitte!",
          target_outcome: "Oberkörper 30°, Licht dimmen (Reizabschirmung), Analgesie (NA), Transport Neurochirurgie.",
          vitals: { RR: "220/110", SpO2: 98, AF: 20, Puls: 60, BZ: 105, Temp: 36.6, GCS: 13 }, // Cushing-Reflex Ansätze?
          scene_4s: {
            sicherheit: "-",
            szene: "Patient erbricht schwallartig.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA dringend (Intracerebrale Blutung?)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Vernichtungskopfschmerz, Nackensteifigkeit, Erbrechen",
              A: "-",
              M: "Keine",
              P: "Unbehandelter Bluthochdruck",
              L: "Kaffee",
              E: "Beim Tragen von schweren Aktenordnern",
              R: "Hypertonie"
            },
            OPQRST: { O: "Schlagartig ('Donnerschlag')", P: "Jede Bewegung ++", Q: "Explosiv", R: "Nacken/Hinterkopf", S: "10/10", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["SAB", "Blutung", "Hirnblutung", "ICB", "Migräne"],
            // X
            bleeding_info: "Keine.",
            // A
            mouth: "Frei (nach Erbrechen spülen lassen).",
            // B
            lung: "Frei.",
            // C
            skin: "Blass, schweißig.",
            abdomen: "Weich.",
            // D - PUPILLEN WICHTIG
            pupils: "Anisokorie möglich (Rechts weiter als Links?), träge Reaktion.",
            befast: "Meningismus (Nackensteif) positiv. Keine Halbseitenlähmung, aber Vigilanz schwankend.",
            ekg_pattern: "sinus",
            ekg12: "Sinusbradykardie (Druckpuls?).",
            pain: { nrs: 10, ort: "Kopf/Nacken", charakter: "Vernichtend" },
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 4: HYPOGLYKÄMIE (Neuro-Mimic) - Das Chamäleon
        // ---------------------------------------------------------
        () => ({
          id: "rs_hypo_neuro",
          specialty: "neurologisch",
          story: "Einsatzstichwort: 'Wesensveränderung/Aggressiv'. Ort: Küche. Die Polizei ist schon da. Herr S. (35) randaliert leicht, wirkt völlig verwirrt und schwankt.",
          intro_dialogue: "Weg da! Ich will... wo ist mein... *lallt*... lasst mich!",
          target_outcome: "Eigenschutz, BZ messen (!), Glucose-Gabe, Überwachung.",
          vitals: { RR: "150/90", SpO2: 97, AF: 22, Puls: 110, BZ: 35, Temp: 36.4, GCS: 12 }, // BZ Kritisches Tief!
          scene_4s: {
            sicherheit: "Patient aggressiv/unkooperativ -> Polizei sichert.",
            szene: "Patient schwitzt stark (nass).",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA, wenn kein i.v. Zugang durch RS möglich oder Glukagon nicht wirkt."
          },
          anamnesis: {
            SAMPLER: {
              S: "Verwirrtheit, Aggression, Schwitzen",
              A: "-",
              M: "Insulin",
              P: "Diabetes Typ 1",
              L: "Gestern",
              E: "Sport gemacht, Essen vergessen",
              R: "Insulin gespritzt"
            },
            OPQRST: { O: "Seit 20 min", P: "-", Q: "-", R: "-", S: "-", T: "-" }
          },
          hidden: {
            diagnosis_keys: ["Hypoglykämie", "Unterzucker"],
            // X
            bleeding_info: "Keine.",
            // A
            mouth: "Frei.",
            // B
            lung: "Frei.",
            // C
            skin: "Nasskalt, profuser Schweiß (typisch Hypo).",
            abdomen: "Weich, hungriges Magenknurren.",
            // D
            pupils: "Seitengleich, weit.",
            befast: "Neurologie diffus gestört, keine klare Parese, aber aphasisch/verwirrt.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 0, ort: "-", charakter: "-" },
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 5: MENINGITIS (Verdacht)
        // ---------------------------------------------------------
        () => ({
          id: "rs_meningitis",
          specialty: "neurologisch",
          story: "Einsatzstichwort: 'Hohes Fieber/Krampf?'. Ort: Studentenbude. Lena (19) liegt im abgedunkelten Zimmer im Bett. Sie wimmert bei jedem Geräusch.",
          intro_dialogue: "Licht aus... mein Nacken tut so weh... mir ist kalt...",
          target_outcome: "Infektionsschutz (Maske!), Vitalwerte, Meningismus prüfen, NA (Antibiotika?), Transport isoliert.",
          vitals: { RR: "110/70", SpO2: 95, AF: 24, Puls: 115, BZ: 100, Temp: 39.8, GCS: 14 },
          scene_4s: {
            sicherheit: "Ansteckungsgefahr? FFP2/3 Maske anziehen!",
            szene: "Dunkles Zimmer, Patientin lichtscheu.",
            sichtung_personen: "1 Patientin.",
            support_empfehlung: "NA (Verdacht auf bakterielle Meningitis)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Fieber, Nackensteifigkeit, Lichtscheu",
              A: "Novalgin",
              M: "Pille",
              P: "Keine",
              L: "Tee",
              E: "Seit 2 Tagen Grippegefühl, jetzt Nackensteif",
              R: "WG-Leben (Meningokokken?)"
            },
            OPQRST: { O: "Schleichend, jetzt akut", P: "Kopfneigen unmöglich", Q: "Ziehend, pochend", R: "Rücken/Nacken", S: "8/10", T: "Seit Stunden" }
          },
          hidden: {
            diagnosis_keys: ["Meningitis", "Hirnhautentzündung", "Sepsis"],
            // X
            bleeding_info: "Achtung: Petechien (kleine Punktblutungen) am Rumpf suchen! -> Hier: Vereinzelte rote Punkte am Bauch.",
            // A
            mouth: "Trocken.",
            // B
            lung: "Frei.",
            // C
            skin: "Heiß, rot. Petechien sichtbar (Alarmzeichen!).",
            abdomen: "Weich.",
            // D
            pupils: "Isokor, lichtscheu (schmerzhaft).",
            befast: "Nackensteifigkeit (Meningismus) positiv: Kinn kann nicht auf Brust genommen werden.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 8, ort: "Kopf/Nacken", charakter: "Pochend" },
            injuries: []
          }
        }),
        // ---------------------------------------------------------
        // FALL 6: OPIAT-INTOXIKATION (Atemdepression)
        // ---------------------------------------------------------
        () => ({
          id: "rs_opiat_01",
          specialty: "neurologisch",
          story: "Einsatzstichwort: 'Bewusstlose Person'. Ort: Bahnhofstoilette. Ein Mann (ca. 30) liegt zusammengesackt in der Kabine. Neben ihm liegt eine Spritze.",
          intro_dialogue: "*Keine Reaktion auf Ansprache*... *atmet sehr selten und flach*",
          target_outcome: "Beatmung (Beutel-Maske) priorisieren!, Naloxon (durch NA), Eigenschutz (Nadeln).",
          vitals: { RR: "100/60", SpO2: 82, AF: 4, Puls: 60, BZ: 90, Temp: 35.5, GCS: 6 }, // AF 4 ist lebensgefährlich!
          scene_4s: {
            sicherheit: "Achtung: Offene Nadeln? Fixerbesteck? Eigenschutz!",
            szene: "Enge Toilette, schlechtes Licht. Patient zyanotisch.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA zwingend (Atemstillstand droht / Antidot)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Bewusstlosigkeit, Bradypnoe (Atemdepression), Zyanose",
              A: "Unbekannt",
              M: "Unbekannt",
              P: "Einstichstellen (Drogenabusus?)",
              L: "Unbekannt",
              E: "Drogenkonsum i.v.",
              R: "Aspiration, HIV/Hepatitis-Gefahr bei Nadelstich"
            },
            OPQRST: { O: "-", P: "-", Q: "-", R: "-", S: "-", T: "-" }
          },
          hidden: {
            diagnosis_keys: ["Opiat", "Intoxikation", "Heroin", "Überdosis"],
            // X
            bleeding_info: "Keine Blutung, aber alte und frische Einstichstellen in der Ellenbeuge.",
            // A
            mouth: "Frei, evtl. Erbrochenes (prüfen!). Zunge fällt zurück.",
            // B
            lung: "Frei, aber kaum Atemexkursionen (Hypoventilation).",
            // C
            skin: "Blass, zyanotisch (blau), kühl.",
            abdomen: "Weich.",
            // D - KLASSIKER
            pupils: "Bidseitigstecknadelkopfgroß (Miosis). Reagieren kaum.",
            befast: "Koma (GCS 6).",
            ekg_pattern: "sinus", // oder Bradykardie
            ekg12: "Sinusbradykardie.",
            pain: { nrs: 0, ort: "-", charakter: "-" },
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 7: CO-VERGIFTUNG (Das Chamäleon)
        // ---------------------------------------------------------
        () => ({
          id: "rs_co_01",
          specialty: "neurologisch",
          story: "Einsatzstichwort: 'Synkope im Bad'. Ort: Altbauwohnung, Badezimmer. Frau K. (40) klagt über massive Kopfschmerzen und Übelkeit, nachdem sie duschen wollte. Ihr Mann liegt benommen im Flur.",
          intro_dialogue: "Mein Kopf... mir ist so schwindelig... ich bin einfach umgekippt...",
          target_outcome: "Sofort raus aus der Wohnung (CO-Warner?!), Fenster auf, High-Flow O2, Druckkammer-Klinik prüfen.",
          vitals: { RR: "130/80", SpO2: 99, AF: 24, Puls: 105, BZ: 110, Temp: 37.0, GCS: 14 }, // SpO2 ist FALSCH HOCH bei CO!
          scene_4s: {
            sicherheit: "ALARM! Gastherme im Bad? CO-Warner Checken! Fenster auf! Eigenschutz geht vor!",
            szene: "Mehrere Personen betroffen (Mann + Frau) = Umweltgift verdächtig.",
            sichtung_personen: "2 Patienten (MANV-Alarm? Erstmal Eigenschutz).",
            support_empfehlung: "NA + Feuerwehr (Messung)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Kopfschmerz, Schwindel, rosige Haut, Übelkeit",
              A: "-",
              M: "-",
              P: "Keine",
              L: "Frühstück",
              E: "Gastherme lief während dem Duschen",
              R: "Defekte Therme"
            },
            OPQRST: { O: "Schleichend", P: "Frische Luft bessert", Q: "Pochend", R: "Ganze Stirn", S: "7/10", T: "Seit 20 min" }
          },
          hidden: {
            diagnosis_keys: ["CO", "Kohlenmonoxid", "Gas", "Intoxikation"],
            // X
            bleeding_info: "Keine.",
            // A
            mouth: "Frei.",
            // B
            lung: "Frei. SpO2-Wert ist trügerisch (CO bindet besser als O2)!",
            // C
            skin: "Auffällig rosig/kirschrot (typisch CO, aber selten so deutlich).",
            abdomen: "Weich, Übelkeit.",
            // D
            pupils: "Isokor.",
            befast: "Neurologie o.B., aber Schwindel/Verwirrtheit.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 7, ort: "Kopf", charakter: "Drückend" },
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 8: ALKOHOLENTZUG (Delirium Tremens)
        // ---------------------------------------------------------
        () => ({
          id: "rs_delir_01",
          specialty: "neurologisch",
          story: "Einsatzstichwort: 'Zittert stark / Verwirrt'. Ort: Obdachlosenunterkunft. Herr B. (55) sitzt auf seiner Pritsche. Er zittert am ganzen Leib, schlägt nach unsichtbaren Fliegen.",
          intro_dialogue: "Weg da! Die Spinnen! Überall Spinnen! *zittert extrem*",
          target_outcome: "Vitalwerte (Hypertensive Krise?), Beruhigung, Krampfschutz vorbereiten, NA (Sedierung).",
          vitals: { RR: "190/110", SpO2: 96, AF: 28, Puls: 130, BZ: 80, Temp: 38.2, GCS: 13 }, // Hyperton, Tachykard, Febril
          scene_4s: {
            sicherheit: "Patient unberechenbar? Abstand halten.",
            szene: "Leere Flaschen, aber Patient wirkt nüchtern (Entzug).",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA (Delir ist lebensgefährlich -> Herz-Kreislauf-Versagen)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Tremor (Zittern), Halluzinationen, Tachykardie",
              A: "-",
              M: "-",
              P: "C2-Abusus bekannt",
              L: "Kein Alkohol seit 24h (Geld alle)",
              E: "Entzugssyndrom",
              R: "Krampfanfallrisiko"
            },
            OPQRST: { O: "Seit heute morgen", P: "-", Q: "-", R: "-", S: "-", T: "Zunehmend" }
          },
          hidden: {
            diagnosis_keys: ["Entzug", "Delir", "C2", "Alkohol"],
            // X
            bleeding_info: "Keine.",
            // A
            mouth: "Zunge stark belegt, trocken.",
            // B
            lung: "Frei.",
            // C
            skin: "Schweißgebadet, heiß, rot.",
            abdomen: "Weich, Leber vergrößert tastbar (Hepatomegalie).",
            // D
            pupils: "Weit, lichtstarr durch Stress.",
            befast: "Grob neurologisch o.B., aber psychisch alteriert (optische Halluzinationen).",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 0, ort: "-", charakter: "-" },
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 9: EPIDURALHÄMATOM (Das freie Intervall)
        // ---------------------------------------------------------
        () => ({
          id: "rs_sht_01",
          specialty: "neurologisch", // Eigentlich Trauma, aber Neuro-Fokus
          story: "Einsatzstichwort: 'Erbrechen nach Sturz'. Ort: Skatepark. Ein 19-Jähriger ist vor 1h ohne Helm gestürzt. War kurz bewusstlos, dann fit ('Luzides Intervall'). Jetzt wird er wieder müde.",
          intro_dialogue: "Mir ist schlecht... ich will schlafen... mein Kopf tut so weh...",
          target_outcome: "Sofortiger Transport (Neurochirurgie!), Voranmeldung, Pupillenkontrolle engmaschig, NA (Intubationsbereitschaft).",
          vitals: { RR: "160/70", SpO2: 97, AF: 14, Puls: 55, BZ: 100, Temp: 36.5, GCS: 12 }, // GCS fallend!
          scene_4s: {
            sicherheit: "-",
            szene: "Patient sitzt am Boden, wird von Freunden gestützt.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA sofort (Einklemmungsgefahr)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Kopfschmerz, Eintrübung, Erbrechen",
              A: "-",
              M: "-",
              P: "-",
              L: "Energy Drink",
              E: "Sturz auf die Schläfe (Tennisball-große Beule)",
              R: "Kein Helm"
            },
            OPQRST: { O: "Schmerz sofort, Müdigkeit erst jetzt", P: "-", Q: "Druck", R: "Schläfe rechts", S: "8/10", T: "Verschlechterung nach Besserung" }
          },
          hidden: {
            diagnosis_keys: ["Epiduralhämatom", "SHT", "Blutung", "Hirndruck"],
            // X
            bleeding_info: "Keine aktive Blutung, riesiges Hämatom Schläfe rechts.",
            // A
            mouth: "Frei.",
            // B
            lung: "Frei.",
            // C
            skin: "Blass.",
            abdomen: "Weich.",
            // D - KRITISCH
            pupils: "Anisokorie: Rechts weiter als links und träge (Hirndruckzeichen!).",
            befast: "Linker Arm wird schwächer (Gegenseite der Verletzung).",
            ekg_pattern: "sinus",
            ekg12: "Sinusbradykardie (Cushing-Reflex beginnend).",
            pain: { nrs: 8, ort: "Kopf rechts", charakter: "Drückend" },
            injuries: ["Prellmarke Schläfe rechts"]
          }
        }),

        // ---------------------------------------------------------
        // FALL 10: TIA (Transitorische Ischämische Attacke)
        // ---------------------------------------------------------
        () => ({
          id: "rs_tia_01",
          specialty: "neurologisch",
          story: "Einsatzstichwort: 'V.a. Schlaganfall'. Ort: Altersheim. Die Pflegekraft hat Sie gerufen, weil Herr P. (80) plötzlich nicht mehr sprechen konnte. Jetzt wirkt er wieder fit.",
          intro_dialogue: "Ich weiß gar nicht, was die Schwester hat. Mir geht es gut. Nur der Arm war kurz taub.",
          target_outcome: "Behandeln wie Schlaganfall! Transport in Klinik mit Stroke Unit (hohes Rezidivrisiko).",
          vitals: { RR: "160/90", SpO2: 95, AF: 16, Puls: 82, BZ: 120, Temp: 36.8, GCS: 15 },
          scene_4s: {
            sicherheit: "-",
            szene: "Bewohner sitzt im Bett, wirkt orientiert.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "KTW oder RTW (je nach lokalen Vorgaben), NA meist nicht nötig wenn symptomfrei, aber Klinik zwingend."
          },
          anamnesis: {
            SAMPLER: {
              S: "Vorübergehende Aphasie und Armschwäche (jetzt weg)",
              A: "-",
              M: "ASS 100, Ramipril",
              P: "Z.n. Apoplex vor 5 Jahren",
              L: "Mittagessen",
              E: "Symptome hielten 15 min an",
              R: "Hohes Alter, Vorerkrankung"
            },
            OPQRST: { O: "Plötzlich", P: "-", Q: "-", R: "-", S: "0/10 (jetzt)", T: "Regredient" }
          },
          hidden: {
            diagnosis_keys: ["TIA", "Transitorisch", "Ischämie"],
            // X
            bleeding_info: "Keine.",
            // A
            mouth: "Frei.",
            // B
            lung: "Frei.",
            // C
            skin: "Rosig.",
            abdomen: "Weich.",
            // D
            pupils: "Isokor, prompt.",
            befast: "Aktuell unauffällig! (Das ist die Tücke: Symptome sind weg, aber die Ursache ist noch da).",
            ekg_pattern: "sinus",
            ekg12: "Sinusrhythmus.",
            pain: { nrs: 0, ort: "-", charakter: "-" },
            injuries: []
          }
        }),
        // ---------------------------------------------------------
        // FALL 11: TRANSIENTE GLOBALE AMNESIE (TGA) - "Die Schallplatte"
        // ---------------------------------------------------------
        () => ({
          id: "rs_tga_01",
          specialty: "neurologisch",
          story: "Einsatzstichwort: 'Verwirrte Person'. Ort: Häuslich. Herr M. (65) wirkt körperlich fit, stellt aber seiner Ehefrau alle 2 Minuten dieselben Fragen.",
          intro_dialogue: "Wo sind wir hier? Was ist passiert? ... [2 min später] ... Wo sind wir hier?",
          target_outcome: "Beruhigung, BZ-Ausschluss, Stroke-Ausschluss, Transport zur Abklärung (TGA ist Ausschlussdiagnose).",
          vitals: { RR: "150/90", SpO2: 97, AF: 16, Puls: 80, BZ: 105, Temp: 36.8, GCS: 14 }, // GCS 14 wegen Desorientierung
          scene_4s: {
            sicherheit: "-",
            szene: "Patient wirkt ratlos, aber nicht somnolent.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "RTW ausreichend (wenn Stroke ausgeschlossen), NA nicht zwingend."
          },
          anamnesis: {
            SAMPLER: {
              S: "Anterograde Amnesie (kann sich nichts Neues merken)",
              A: "-",
              M: "Simvastatin",
              P: "Cholesterin",
              L: "Mittagessen",
              E: "Vielleicht körperliche Anstrengung/kaltes Wasser vorher?",
              R: "-"
            },
            OPQRST: { O: "Plötzlich", P: "-", Q: "-", R: "-", S: "-", T: "Seit 1 Stunde unverändert" }
          },
          hidden: {
            diagnosis_keys: ["TGA", "Amnesie", "Gedächtnisverlust"],
            // X
            bleeding_info: "Keine.",
            // A
            mouth: "Frei.",
            // B
            lung: "Frei.",
            // C
            skin: "Warm, trocken.",
            abdomen: "Weich.",
            // D
            pupils: "Isokor, prompt.",
            befast: "Motorik und Sprache intakt! Nur das Kurzzeitgedächtnis fehlt ('Reset-Knopf').",
            ekg_pattern: "sinus",
            ekg12: "Sinusrhythmus.",
            pain: { nrs: 0, ort: "-", charakter: "-" },
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 12: UROSEPSIS (Neuro-Fokus: qSOFA)
        // ---------------------------------------------------------
        () => ({
          id: "rs_sepsis_01",
          specialty: "neurologisch", // Wird oft als "Verwirrt" gemeldet
          story: "Einsatzstichwort: 'AZ-Verschlechterung/Verwirrt'. Ort: Pflegeheim. Frau L. (85) ist heute Morgen sehr schläfrig und redet wirres Zeug. Der Urin im Beutel ist sehr dunkel.",
          intro_dialogue: "*Murmelt unverständlich*... die Katzen... wo sind die Katzen...",
          target_outcome: "qSOFA erkennen (AF hoch? GCS tief? RR tief?), Sepsis-Verdacht, Schocklagerung nein (Volumen!), Voranmeldung.",
          vitals: { RR: "90/50", SpO2: 93, AF: 26, Puls: 110, BZ: 120, Temp: 38.9, GCS: 12 },
          scene_4s: {
            sicherheit: "-",
            szene: "Urinbeutel trüb/flockig, strenger Geruch.",
            sichtung_personen: "1 Patientin.",
            support_empfehlung: "NA (Sepsis/Kreislaufinstabilität)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Vigilanzminderung, Fieber, Tachypnoe",
              A: "-",
              M: "Viele (Pflegebericht)",
              P: "Dauerkatheter (DK)",
              L: "Frühstück verweigert",
              E: "Zunehmende Eintrübung seit gestern",
              R: "Katheter, Alter, Immobilität"
            },
            OPQRST: { O: "Schleichend", P: "-", Q: "-", R: "-", S: "Kritisch", T: "-" }
          },
          hidden: {
            diagnosis_keys: ["Sepsis", "Harnwegsinfekt", "Urosepsis", "Infekt"],
            // X
            bleeding_info: "Keine.",
            // A
            mouth: "Trocken, Borkig (Exsikkose + Infekt).",
            // B
            lung: "Rasselgeräusche basal möglich (durch Liegen), aber AF erhöht (26/min!).",
            // C
            skin: "Heiß, trocken oder marmoriert (beginnender Schock).",
            abdomen: "Druckschmerz Unterbauch (Blase).",
            // D
            pupils: "Isokor.",
            befast: "Keine Herdsymptomatik, aber GCS reduziert (Septische Enzephalopathie).",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 0, ort: "-", charakter: "-" }, // Patientin äußert sich nicht klar
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 13: AKUTE PSYCHOSE (Ausschluss organische Ursache)
        // ---------------------------------------------------------
        () => ({
          id: "rs_psych_01",
          specialty: "neurologisch",
          story: "Einsatzstichwort: 'Psychiatrischer Notfall'. Ort: Fußgängerzone. Ein junger Mann (25) schreit Passanten an, er werde vom Geheimdienst verfolgt. Er wirkt extrem angespannt.",
          intro_dialogue: "Fasst mich nicht an! Ich weiß, dass ihr Wanzen habt! Seht ihr die Drohnen nicht?!",
          target_outcome: "Eigenschutz!, Deeskalation ('Talk down'), Organische Ursachen ausschließen (BZ, Hypoxie, Trauma, Drogen).",
          vitals: { RR: "160/90", SpO2: 98, AF: 20, Puls: 110, BZ: 95, Temp: 36.9, GCS: 15 },
          scene_4s: {
            sicherheit: "Patient verbal aggressiv. Fluchtweg freihalten! Polizei dazu?",
            szene: "Keine Waffen sichtbar.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "Polizei (bei Eigen-/Fremdgefährdung - PsychKG), NA oft nicht nötig wenn kooperativ, sonst Zwangseinweisung durch Arzt."
          },
          anamnesis: {
            SAMPLER: {
              S: "Wahnvorstellungen, Paranoia, motorische Unruhe",
              A: "-",
              M: "Nimmt seine Medikamente nicht mehr",
              P: "Schizophrenie bekannt (Fremdanamnese Passanten/Ausweis)",
              L: "-",
              E: "Medikamente abgesetzt",
              R: "-"
            },
            OPQRST: { O: "-", P: "-", Q: "-", R: "-", S: "-", T: "-" }
          },
          hidden: {
            diagnosis_keys: ["Psychose", "Schizophrenie", "Wahn"],
            // X
            bleeding_info: "Keine.",
            // A
            mouth: "Frei.",
            // B
            lung: "Frei.",
            // C
            skin: "Schweißig durch Stress.",
            abdomen: "Weich.",
            // D - WICHTIG ZUM AUSSCHLUSS
            pupils: "Isokor, prompt (spricht gegen Kokain/Amphetamine, ist aber kein Beweis).",
            befast: "Unauffällig. Neurologisch organisch gesund.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 0, ort: "-", charakter: "-" },
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 14: STATUS MIGRAENOSUS (vs. Schlaganfall)
        // ---------------------------------------------------------
        () => ({
          id: "rs_migraene_01",
          specialty: "neurologisch",
          story: "Einsatzstichwort: 'Kopfschmerz/Sehstörung'. Ort: Arbeitsplatz. Frau T. (30) sitzt mit Sonnenbrille im dunklen Pausenraum. Sie sieht 'Blitze' und muss sich übergeben.",
          intro_dialogue: "Bitte nicht so laut... es pocht so einseitig... ich sehe Zick-Zack-Linien...",
          target_outcome: "Reizabschirmung, Antiemetika (durch NA), Abgrenzung zu SAB/Stroke (BE-FAST), Transport.",
          vitals: { RR: "135/85", SpO2: 99, AF: 16, Puls: 90, BZ: 90, Temp: 36.5, GCS: 15 },
          scene_4s: {
            sicherheit: "-",
            szene: "Patientin hält sich Eimer bereit (Übelkeit).",
            sichtung_personen: "1 Patientin.",
            support_empfehlung: "NA zur Schmerztherapie (Analgesie) oft hilfreich."
          },
          anamnesis: {
            SAMPLER: {
              S: "Hemikranie (halbseitiger Kopfschmerz), Aura (Visus), Photophobie",
              A: "-",
              M: "Triptane (helfen nicht mehr)",
              P: "Migräne mit Aura",
              L: "-",
              E: "Stress auf Arbeit, Wetterumschwung",
              R: "-"
            },
            OPQRST: { O: "Vor 1h mit Aura begonnen", P: "Licht/Lärm ++", Q: "Pochend, hämmernd", R: "Rechte Schläfe/Auge", S: "8/10", T: "Länger als sonst" }
          },
          hidden: {
            diagnosis_keys: ["Migräne", "Kopfschmerz"],
            // X
            bleeding_info: "Keine.",
            // A
            mouth: "Frei.",
            // B
            lung: "Frei.",
            // C
            skin: "Blass.",
            abdomen: "Weich.",
            // D
            pupils: "Isokor. Licht schmerzt (Photophobie), aber Reaktion intakt.",
            befast: "Motorik intakt. Sensibilität im Gesicht evtl. kribbelig (Begleitsymptom), aber keine Lähmung.",
            ekg_pattern: "sinus",
            ekg12: "Sinusrhythmus.",
            pain: { nrs: 8, ort: "Kopf rechts", charakter: "Pochend" },
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 15: CAUDA-EQUINA / BANDSCHEIBENVORFALL (Red Flag!)
        // ---------------------------------------------------------
        () => ({
          id: "rs_bsv_01",
          specialty: "neurologisch", // Ortho/Neuro Grenzgebiet
          story: "Einsatzstichwort: 'Rückenschmerzen akut'. Ort: Garten. Herr O. (55) wollte eine Kiste heben. Jetzt liegt er flach und kann nicht aufstehen. Er sagt, sein Bein sei taub.",
          intro_dialogue: "Es hat 'Knack' gemacht... mein Rücken... aber viel schlimmer: Ich spüre meinen Hintern nicht mehr richtig...",
          target_outcome: "DMS-Kontrolle zwingend!, Immobilisation (Vakuummatratze), Transport Neurochirurgie (Not-OP Indikation?), NA-Analgesie.",
          vitals: { RR: "150/90", SpO2: 98, AF: 20, Puls: 100, BZ: 100, Temp: 36.7, GCS: 15 },
          scene_4s: {
            sicherheit: "-",
            szene: "Patient liegt auf dem Rasen.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA für Analgesie (starke Schmerzen)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Lumbalgie, Reithosenanästhesie (Taubheit im Schritt), Inkontinenz?",
              A: "-",
              M: "Ibuprofen",
              P: "Bandscheibenprobleme L5/S1",
              L: "-",
              E: "Hebetrauma",
              R: "-"
            },
            OPQRST: { O: "Sofort", P: "Jede Bewegung ++", Q: "Einschießend", R: "In das rechte Bein", S: "9/10", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Bandscheibenvorfall", "BSV", "Cauda", "Prolaps", "Ischialgie"],
            // X
            bleeding_info: "Keine.",
            // A
            mouth: "Frei.",
            // B
            lung: "Frei.",
            // C
            skin: "Schweißig vor Schmerz.",
            abdomen: "Weich. (Ggf. Blase voll/überlaufend? - fragen nach Wasserlassen).",
            // D - DER ENTSCHEIDENDE BEFUND
            pupils: "Isokor.",
            befast: "Unauffällig (Hirn ok). ABER: DMS (Durchblutung/Motorik/Sensibilität) rechtes Bein gestört. Fußheber schwach.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 9, ort: "Lendenwirbelsäule", charakter: "Stechend" },
            injuries: []
          }
        }),
        // ---------------------------------------------------------
        // FALL 16: CHRONISCHES SUBDURALHÄMATOM (Der "vergessene" Sturz)
        // ---------------------------------------------------------
        () => ({
          id: "rs_sdh_chron_01",
          specialty: "neurologisch",
          story: "Einsatzstichwort: 'AZ-Verschlechterung'. Ort: Seniorenheim. Herr W. (82) ist seit Tagen zunehmend verwirrt und schläfrig. Die Pflegekraft sagt, er sei 'nicht mehr er selbst'.",
          intro_dialogue: "*Reagiert kaum*... ich will... mein Bett... *nuschelt*",
          target_outcome: "Fremdanamnese (Sturz vor Wochen?), Antikoagulanzien checken, Transport Neurochirurgie.",
          vitals: { RR: "135/80", SpO2: 94, AF: 14, Puls: 72, BZ: 115, Temp: 36.6, GCS: 12 }, // Somnolent
          scene_4s: {
            sicherheit: "-",
            szene: "Patient sitzt im Rollstuhl, Kopf sinkt auf die Brust.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "RTW + NA (bei Eintrübung)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Somnolenz, Wesensänderung, Gangunsicherheit",
              A: "-",
              M: "ASS 100, Eliquis (Blutverdünner!)",
              P: "Vorhofflimmern",
              L: "Brei",
              E: "Ist vor 4 Wochen nachts aus dem Bett gefallen (Bagatelltrauma)",
              R: "Alter + Blutverdünner = Sickerblutung"
            },
            OPQRST: { O: "Schleichend über Tage", P: "-", Q: "-", R: "-", S: "-", T: "Progredient" }
          },
          hidden: {
            diagnosis_keys: ["Subduralhämatom", "SDH", "Hämatom", "Blutung"],
            // X
            bleeding_info: "Keine äußere Blutung, evtl. alte gelbe Hämatomreste am Kopf.",
            // A
            mouth: "Frei, Zahnprothese locker.",
            // B
            lung: "Frei.",
            // C
            skin: "Pergamenthaut, blass.",
            abdomen: "Weich.",
            // D
            pupils: "Isokor, aber träge. (Bei chronischem SDH oft noch keine Anisokorie).",
            befast: "Psychomotorisch verlangsamt, keine klare Parese, aber allgemeine Schwäche.",
            ekg_pattern: "sinus", // oder VHF
            ekg12: "Vorhofflimmern (Arrhythmie).",
            pain: { nrs: 0, ort: "-", charakter: "-" },
            injuries: ["Alte Hämatome am Arm"]
          }
        }),

        // ---------------------------------------------------------
        // FALL 17: AKINETISCHE KRISE (Parkinson-Notfall)
        // ---------------------------------------------------------
        () => ({
          id: "rs_parkinson_01",
          specialty: "neurologisch",
          story: "Einsatzstichwort: 'Bewegungsunfähig'. Ort: Häuslich. Frau P. (70) liegt im Bett und ist steif wie ein Brett. Sie kann nicht sprechen und schluckt nicht.",
          intro_dialogue: "*Starrer Blick*... *keine Antwort möglich*... *speichelt*",
          target_outcome: "Aspirationsschutz, Flüssigkeitsgabe (Dehydrierung?), Temperatur messen (Hyperthermie?), NA (Lebensgefahr!).",
          vitals: { RR: "160/95", SpO2: 96, AF: 28, Puls: 110, BZ: 120, Temp: 38.5, GCS: 10 }, // Fieber + Tachykardie = Malignes Syndrom möglich
          scene_4s: {
            sicherheit: "-",
            szene: "Patientin wirkt wach, ist aber 'eingefroren'.",
            sichtung_personen: "1 Patientin.",
            support_empfehlung: "NA (Akinetische Krise ist intensivpflichtig)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Rigor (Steifigkeit), Akinese (Unbeweglichkeit), Fieber",
              A: "-",
              M: "L-Dopa (Madopar) - Packung ist leer!",
              P: "Morbus Parkinson",
              L: "Gestern (Schluckstörung)",
              E: "Medikamente seit 2 Tagen nicht genommen (Rezept fehlte)",
              R: "Abruptes Absetzen von L-Dopa"
            },
            OPQRST: { O: "Seit heute morgen extrem", P: "-", Q: "-", R: "-", S: "-", T: "Akut auf chronisch" }
          },
          hidden: {
            diagnosis_keys: ["Parkinson", "Krise", "Akinetisch", "L-Dopa"],
            // X
            bleeding_info: "Keine.",
            // A
            mouth: "Speichelsee im Mund (Schluckstörung!), Aspirationsgefahr.",
            // B
            lung: "Flache Atmung durch Brustwandstarre.",
            // C
            skin: "Ölige Salbengesicht (Seborrhö), heiß.",
            abdomen: "Weich.",
            // D
            pupils: "Isokor.",
            befast: "Extremer Rigor (Zahnradphänomen an den Gelenken). Keine Willkürbewegung möglich.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 0, ort: "-", charakter: "-" },
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 18: PSYCHOGENER KRAMPFANFALL (Dississoziativ)
        // ---------------------------------------------------------
        () => ({
          id: "rs_psych_krampf",
          specialty: "neurologisch",
          story: "Einsatzstichwort: 'Krampfanfall'. Ort: Schule. Eine Schülerin (17) liegt im Flur und schlägt wild um sich. Die Augen sind fest zugekniffen.",
          intro_dialogue: "*Schreit*... *schlägt wild mit den Armen*... Nein! Nein!",
          target_outcome: "Verletzungsschutz, Differenzierung zu Epilepsie (Augen zu? Asynchron?), Beruhigen, keine Gewalt anwenden.",
          vitals: { RR: "130/70", SpO2: 99, AF: 24, Puls: 100, BZ: 90, Temp: 36.8, GCS: 12 }, // SpO2 99% spricht gegen Grand Mal
          scene_4s: {
            sicherheit: "-",
            szene: "Viele aufgeregte Mitschüler. Patientin 'krampft' sehr theatralisch.",
            sichtung_personen: "1 Patientin.",
            support_empfehlung: "RTW, NA nur wenn Status nicht auszuschließen (hier aber typisch psychogen)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Unkontrollierte Bewegungen, Schreien",
              A: "-",
              M: "-",
              P: "Bekannte Angststörung",
              L: "Pausenbrot",
              E: "Streit mit Freund in der Pause",
              R: "Emotionaler Stress"
            },
            OPQRST: { O: "Nach dem Streit", P: "Zuschauer verstärken Symptome", Q: "-", R: "-", S: "-", T: "-" }
          },
          hidden: {
            diagnosis_keys: ["Psychogen", "Dissoziativ", "PNES", "Hysterie"],
            // X
            bleeding_info: "Keine.",
            // A
            mouth: "Fest zusammengepresst, aber kein Zungenbiss.",
            // B
            lung: "Hyperventilation zwischen den Schreien.",
            // C
            skin: "Rosig, warm.",
            abdomen: "Weich.",
            // D - WICHTIG
            pupils: "Augen sind aktiv zugekniffen (Widerstand beim Öffnen!). Pupillen lichtreagibel (wenn man sie aufbekommt). Blick wendet sich vom Untersucher ab.",
            befast: "Bewegungen sind asynchron (Kopfschütteln, Beckenstoßen) – untypisch für Epilepsie.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie durch Anstrengung.",
            pain: { nrs: 0, ort: "-", charakter: "-" },
            injuries: [] // Fällt meist "weich", keine Verletzung
          }
        }),

        // ---------------------------------------------------------
        // FALL 19: MULTIPLE SKLEROSE (Akuter Schub)
        // ---------------------------------------------------------
        () => ({
          id: "rs_ms_01",
          specialty: "neurologisch",
          story: "Einsatzstichwort: 'Sehstörung/Lähmung'. Ort: Wohnung. Frau D. (29) sagt, sie sehe auf dem rechten Auge nur noch Nebel und ihr Bein kribbelt komisch.",
          intro_dialogue: "Es ist wie Milchglas vor dem Auge... und mein Bein schläft ein beim Gehen.",
          target_outcome: "Neurologische Untersuchung, Beruhigung, Ausschluss Stroke (junges Alter?), Transport Neurologie.",
          vitals: { RR: "120/80", SpO2: 98, AF: 14, Puls: 78, BZ: 95, Temp: 37.1, GCS: 15 },
          scene_4s: {
            sicherheit: "-",
            szene: "Patientin wirkt besorgt, aber stabil.",
            sichtung_personen: "1 Patientin.",
            support_empfehlung: "KTW/RTW, kein NA nötig (keine vitale Bedrohung)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Visusverlust rechts, Parästhesien (Kribbeln) Bein",
              A: "-",
              M: "Keine",
              P: "Mutter hat MS",
              L: "-",
              E: "Seit 2 Tagen schleichend, jetzt schlimmer",
              R: "-"
            },
            OPQRST: { O: "Subakut", P: "Augenbewegung schmerzt", Q: "-", R: "-", S: "-", T: "-" }
          },
          hidden: {
            diagnosis_keys: ["MS", "Sklerose", "Neuritis", "Schub"],
            // X
            bleeding_info: "Keine.",
            // A
            mouth: "Frei.",
            // B
            lung: "Frei.",
            // C
            skin: "Unauffällig.",
            abdomen: "Weich.",
            // D
            pupils: "Isokor. Aber: Schmerzen bei Augenbewegung (Retrobulbärneuritis).",
            befast: "Kraft im Bein leicht vermindert (Barre-Test sinkt ab). Sensibilität gestört ('Ameisenlaufen').",
            ekg_pattern: "sinus",
            ekg12: "Unauffällig.",
            pain: { nrs: 3, ort: "Auge rechts", charakter: "Bei Bewegung" },
            injuries: []
          }
        }),

        // ---------------------------------------------------------
        // FALL 20: HIRNTUMOR (Erstmanifestation Krampf)
        // ---------------------------------------------------------
        () => ({
          id: "rs_tumor_01",
          specialty: "neurologisch",
          story: "Einsatzstichwort: 'Erster Krampfanfall'. Ort: Büro. Herr G. (50) hatte am Schreibtisch einen Anfall. Er ist jetzt wieder wach, klagt aber über morgendliche Kopfschmerzen seit Wochen.",
          intro_dialogue: "Was... ist passiert? Mein Kopf... diese Kopfschmerzen habe ich jeden Morgen...",
          target_outcome: "Transport, Anfallsüberwachung, Anamnese bzgl. Kopfschmerz (Red Flag: Morgens + Erbrechen?), NA bei Nachkrampfen.",
          vitals: { RR: "145/90", SpO2: 96, AF: 16, Puls: 92, BZ: 105, Temp: 36.5, GCS: 14 },
          scene_4s: {
            sicherheit: "-",
            szene: "Patient sitzt auf Stuhl, Kollegen besorgt.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "RTW (Erstmanifestation Krampf muss in Klinik)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Z.n. Krampfanfall, chronischer Kopfschmerz, Wesensänderung?",
              A: "-",
              M: "Ibuprofen (hilft kaum)",
              P: "Keine",
              L: "Kaffee",
              E: "Krampf aus voller Gesundheit",
              R: "Morgendlicher Nüchternkopfschmerz (Hirndruckzeichen)"
            },
            OPQRST: { O: "Kopfschmerz seit 3 Wochen", P: "Bücken/Pressen verstärkt", Q: "Dumpf", R: "-", S: "5/10", T: "Morgens schlimmer" }
          },
          hidden: {
            diagnosis_keys: ["Tumor", "Raumforderung", "Metastase", "Glioblastom"],
            // X
            bleeding_info: "Zungenbiss lateral (vom Anfall).",
            // A
            mouth: "Frei.",
            // B
            lung: "Frei.",
            // C
            skin: "Blass.",
            abdomen: "Weich.",
            // D
            pupils: "Leichte Anisokorie (Links weiter?) möglich durch Raumforderung.",
            befast: "Leichte Wortfindungsstörungen (Aphasie), sonst grob orientierend unauffällig postiktal.",
            ekg_pattern: "sinus",
            ekg12: "Unauffällig.",
            pain: { nrs: 5, ort: "Kopf", charakter: "Dumpf, drückend" },
            injuries: ["Zungenbiss"]
          }
        }),
      ],

trauma: [
        // ---------------------------------------------------------
        // FALL 1: UNTERARMFRAKTUR
        // ---------------------------------------------------------
        () => ({
          id: "rs_trauma_arm",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Fahrradsturz'. Ort: Radweg. Lena S. (29) sitzt am Boden und hält ihren rechten Unterarm. Der Arm weist eine deutliche Fehlstellung (Bajonett) auf.",
          intro_dialogue: "Aua! Mein Arm! Scheiße, das tut so weh... bitte helfen Sie mir, da hat es laut geknackt!",
          target_outcome: "CMS-Kontrolle (vor/nach), SAM-Splint/Vakuumschiene, Schmerzmanagement (NA?), Kühlung.",
          vitals: { RR: "135/82", SpO2: 98, AF: 20, Puls: 110, BZ: 102, Temp: 36.7, GCS: 15 },
          scene_4s: {
            sicherheit: "Radweg absichern (Polizei?).",
            szene: "Patientin trägt Helm (intakt). Fahrrad liegt daneben.",
            sichtung_personen: "1 Patientin.",
            support_empfehlung: "RTW + NA (wegen starker Schmerzen zur Reposition)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Extremer Schmerz rechter Unterarm, Fehlstellung",
              A: "Keine",
              M: "Pille",
              P: "Keine",
              L: "Kaffee",
              E: "Sturz über Bordsteinkante",
              R: "-"
            },
            OPQRST: { O: "Sofort", P: "Jede Bewegung ++", Q: "Stechend", R: "Lokal begrenzt", S: "9/10", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Fraktur", "Radius", "Unterarm", "Bruch"],
            bleeding_info: "Schürfwunden am Arm, keine kritische Blutung.",
            mouth: "Frei, keine Zahnverletzungen.",
            lung: "Frei.",
            skin: "Rosig, warm. Schwellung am Arm.",
            abdomen: "Weich.",
            pupils: "Isokor, prompt.",
            befast: "Unauffällig.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie (Schmerz).",
            pain: { nrs: 9, ort: "Rechter Unterarm", charakter: "Stechend" },
            
            // HIER WAR DER FEHLER: Die Map für das Bild hat gefehlt!
            injury_map: ["arm_r"], // Färbt den rechten Arm rot
            injuries: ["Geschlossene distale Radiusfraktur rechts", "Schürfwunden"],
            
            nexus_criteria: { summary: "Keine HWS-Indikation (Patientin wach, kein HWS-Schmerz, keine Defizite), aber ablenkende Verletzung (Arm) beachten!" },
            polytrauma_criteria: { vitals: "Stabil", anatomical: "Isolierte Extremität", mechanism: "Niedrigenergie", special: "-" }
          }
        }),

        // ---------------------------------------------------------
        // FALL 2: AMPUTATIONSVERLETZUNG
        // ---------------------------------------------------------
        () => ({
          id: "rs_ampu_01",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Arbeitsunfall Kreissäge'. Ort: Tischlerei. Ein Schreiner (45) liegt am Boden. Neben ihm eine riesige Blutlache. Er hält sich den linken Oberschenkelstumpf.",
          intro_dialogue: "Hilfe! Es hört nicht auf! Ich verblute! *Schreit*",
          target_outcome: "PRIO 1: Tourniquet (C-ABCDE -> X-ABCDE!), Druckverband reicht nicht! Schocklage, Volumen, NA, Amputatversorgung.",
          vitals: { RR: "80/40", SpO2: 92, AF: 28, Puls: 140, BZ: 110, Temp: 36.0, GCS: 14 },
          scene_4s: {
            sicherheit: "Maschine aus? Strom weg?",
            szene: "Viel Blut am Boden, Patient blass. Amputat liegt unter der Bank.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA sofort (Lebensgefahr Verbluten)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Traumatische Amputation, Todesangst",
              A: "-",
              M: "-",
              P: "-",
              L: "-",
              E: "Abgerutscht an der Formatkreissäge",
              R: "-"
            },
            OPQRST: { O: "Sofort", P: "-", Q: "-", R: "-", S: "10/10", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Amputation", "Blutung", "Schock", "Hämorrhagisch"],
            bleeding_info: "Massive, spritzende Blutung aus dem linken Oberschenkelstumpf (A. femoralis). Lebensgefahr!",
            mouth: "Frei, blass.",
            lung: "Frei, Tachypnoe (Schock).",
            skin: "Marmoriet, kalt, schweißig. Rekap > 3 sek.",
            abdomen: "Weich.",
            pupils: "Isokor.",
            befast: "Unruhig durch Schock.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie (Frequenz 140).",
            pain: { nrs: 10, ort: "Bein links", charakter: "Vernichtend" },
            
            // KORREKTUR:
            injury_map: ["leg_l"], // Linkes Bein rot
            injuries: ["Oberschenkelamputation links"],
            
            nexus_criteria: { summary: "Kein HWS-Fokus, Prio liegt auf X!" },
            polytrauma_criteria: { vitals: "RR < 90, Puls > 120 (Positiv)", anatomical: "Amputation proximal Hand/Fuß (Positiv)", mechanism: "-", special: "-" }
          }
        }),

        // ---------------------------------------------------------
        // FALL 3: SCHENKELHALSFRAKTUR
        // ---------------------------------------------------------
        () => ({
          id: "rs_shf_01",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Häuslicher Sturz'. Ort: Flur. Frau K. (82) liegt auf den Fliesen und kommt nicht mehr hoch. Sie klagt über Schmerzen in der rechten Hüfte.",
          intro_dialogue: "Ich bin über den Teppich gestolpert... mein Bein tut so weh, ich kann nicht aufstehen.",
          target_outcome: "Immobilisation (Vakuummatratze), Schmerzmittel (NA), Wärmeerhalt (liegt auf Fliesen!), DMS-Check.",
          vitals: { RR: "150/85", SpO2: 95, AF: 16, Puls: 80, BZ: 110, Temp: 36.2, GCS: 15 },
          scene_4s: {
            sicherheit: "Stolperfalle Teppich?",
            szene: "Patientin liegt kühl. Rechtes Bein wirkt verkürzt.",
            sichtung_personen: "1 Patientin.",
            support_empfehlung: "RTW + NA (Analgesiebedarf vor Umlagerung)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Schmerzen Hüfte/Leiste, Bewegungsunfähigkeit",
              A: "-",
              M: "Marcumar, Beta-Blocker",
              P: "Osteoporose, KHK",
              L: "Frühstück",
              E: "Sturz aus dem Stand",
              R: "Osteoporose"
            },
            OPQRST: { O: "Sofort", P: "Bewegung unmöglich", Q: "Dumpf/Stechend", R: "Leiste", S: "7/10", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Schenkelhals", "SHF", "Hüftfraktur", "Oberschenkel"],
            bleeding_info: "Keine außen, aber Blutverlust nach innen möglich (bis 1-2L!).",
            mouth: "Frei.",
            lung: "Frei.",
            skin: "Blass (Schmerz/Alter). Rechtes Bein ist verkürzt und außenrotiert (Typisch für SHF).",
            abdomen: "Weich.",
            pupils: "Isokor.",
            befast: "Unauffällig.",
            ekg_pattern: "sinus",
            ekg12: "Sinusrhythmus.",
            pain: { nrs: 7, ort: "Hüfte rechts", charakter: "Tief sitzend" },
            
            // KORREKTUR:
            injury_map: ["leg_r"], // Rechtes Bein rot
            injuries: ["V.a. Schenkelhalsfraktur rechts"],

            nexus_criteria: { summary: "Unauffällig, aber Schmerzen lenken ab." },
            polytrauma_criteria: { vitals: "Stabil", anatomical: "Nein", mechanism: "Niedrigenergie", special: "Alter > 65 + Antikoagulation (Marcumar) -> Risiko!" }
          }
        }),

        // ---------------------------------------------------------
        // FALL 4: SPANNUNGSPNEUMOTHORAX
        // ---------------------------------------------------------
        () => ({
          id: "rs_stich_01",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Schlägerei / Stichverletzung'. Ort: Vor einer Disco. Ein Mann (25) sitzt japsend an einer Hauswand. Er hält sich die rechte Brustseite. Blut am Hemd.",
          intro_dialogue: "Luft... ich krieg... keine... Luft! *keuch*",
          target_outcome: "Wunde verschließen (Chest Seal?), O2, Entlastungspunktion (durch NA) vorbereiten, Schocklage.",
          vitals: { RR: "90/60", SpO2: 85, AF: 34, Puls: 130, BZ: 100, Temp: 36.8, GCS: 14 },
          scene_4s: {
            sicherheit: "Täter noch vor Ort? Messer? Polizei ist Prio 1!",
            szene: "Patient panisch, ringt nach Luft.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA sofort (Lebensgefahr Spannungspneu)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Massive Atemnot, Stechen Thorax",
              A: "-",
              M: "Alkohol?",
              P: "Gesund",
              L: "Bier",
              E: "Streit, dann Stich gespürt",
              R: "-"
            },
            OPQRST: { O: "Sofort", P: "-", Q: "-", R: "-", S: "10/10", T: "-" }
          },
          hidden: {
            diagnosis_keys: ["Pneumothorax", "Spannungspneu", "Stich", "Thorax"],
            bleeding_info: "Stichwunde Thorax rechts (ca. 2cm), blutet mäßig, schäumt evtl. leicht.",
            mouth: "Frei.",
            lung: "Rechts kein Atemgeräusch! Halsvenen gestaut! Trachea weicht nach links ab (Spätzeichen).",
            skin: "Zyanotisch, schweißig.",
            abdomen: "Weich.",
            pupils: "Isokor, weit (Stress/Hypoxie).",
            befast: "Unruhig, hypoxisch.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie (Niedervoltage rechts?).",
            pain: { nrs: 9, ort: "Brust rechts", charakter: "Stechend" },
            
            // KORREKTUR:
            injury_map: ["torso"], // Rumpf rot
            injuries: ["Stichwunde Thorax rechts"],

            nexus_criteria: { summary: "Nicht beurteilbar (GCS/Schock), HWS-Schutz empfohlen bis Ausschluss." },
            polytrauma_criteria: { vitals: "RR < 90, AF > 29, GCS < 14 (Positiv)", anatomical: "Penetrierendes Trauma Rumpf (Positiv)", mechanism: "-", special: "-" }
          }
        }),

        // ---------------------------------------------------------
        // FALL 5: POLYTRAUMA (Das aus deinem Screenshot)
        // ---------------------------------------------------------
        () => ({
          id: "rs_poly_sturz",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Sturz aus Höhe > 3m'. Ort: Baustelle. Ein Dachdecker ist vom Gerüst gefallen. Er liegt auf Schotter, bewegt sich nicht.",
          intro_dialogue: "*Stöhnt nur*... *reagiert kaum auf Ansprache*",
          target_outcome: "Vollimmobilisation (HWS/Spineboard), Load & Go, Voranmeldung Schockraum, O2, Wärmeerhalt.",
          vitals: { RR: "100/60", SpO2: 90, AF: 24, Puls: 115, BZ: 110, Temp: 36.2, GCS: 9 },
          scene_4s: {
            sicherheit: "Fällt noch was runter? Helm tragen!",
            szene: "Patient liegt verdreht.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA + RTH (Hubschrauber) für schnellen Transport in Traumazentrum."
          },
          anamnesis: {
            SAMPLER: {
              S: "Polytrauma, Bewusstseinsstörung",
              A: "Unbekannt",
              M: "Unbekannt",
              P: "Unbekannt",
              L: "Unbekannt",
              E: "Arbeitsunfall",
              R: "-"
            },
            OPQRST: { O: "-", P: "-", Q: "-", R: "-", S: "-", T: "-" }
          },
          hidden: {
            diagnosis_keys: ["Polytrauma", "SHT", "Beckenfraktur", "Sturz"],
            bleeding_info: "Keine spritzende Blutung, aber große Schürfwunden.",
            mouth: "Blutig (Zähne ausgeschlagen?).",
            lung: "Links abgeschwächt (Hämatothorax?).",
            skin: "Blass, kalt. Becken instabil (Kompressionsschmerz -> Nicht federn! Schlinge anlegen!).",
            abdomen: "Hart (Abwehrspannung -> Innere Blutung?).",
            pupils: "Anisokorie (Rechts weiter -> SHT).",
            befast: "GCS 9, keine gezielte Bewegung.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 10, ort: "Ganzkörper", charakter: "Diffus" },
            
            // KORREKTUR: Jetzt färben sich Kopf und Rumpf rot!
            injury_map: ["head", "torso"], 
            injuries: ["SHT", "Beckenfraktur", "Serienrippenfraktur links"],

            nexus_criteria: { summary: "POSITIV: Vigilanzminderung, Ablenkende Verletzungen. HWS-Immobilisation zwingend!" },
            polytrauma_criteria: { vitals: "GCS < 13 (Positiv)", anatomical: "Instabiles Becken (Positiv)", mechanism: "Sturz > 3m (Positiv)", special: "-" }
          }
        }),
    // ---------------------------------------------------------
        // FALL 6: VERBRENNUNG (Grillunfall)
        // ---------------------------------------------------------
        () => ({
          id: "rs_brand_01",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Verbrennung'. Ort: Gartenparty. Ein Mann (30) hat Spiritus in den Grill geschüttet. Er hat Verbrennungen an Armen, Brust und Gesicht.",
          intro_dialogue: "Wasser! Ich brauche Wasser! Es brennt so höllisch!",
          target_outcome: "Kühlung (nur kurz/lauwarm!), Wunden steril abdecken (Aluderm), Wärmeerhalt (Restkörper!), Volumenmangel antizipieren.",
          vitals: { RR: "110/70", SpO2: 96, AF: 24, Puls: 120, BZ: 100, Temp: 37.0, GCS: 15 },
          scene_4s: {
            sicherheit: "Feuer aus? Spiritusflasche weg?",
            szene: "Patient steht unter Schock, Kleidung teilweise verbrannt.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA (bei Verbrennung Gesicht/Atemwege oder >10-15% KOF)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Stärkste Schmerzen, Rötung/Blasenbildung",
              A: "-",
              M: "-",
              P: "-",
              L: "Grillfleisch",
              E: "Stichflamme durch Spiritus",
              R: "Inhalationstrauma?"
            },
            OPQRST: { O: "Sofort", P: "Luftzug schmerzt", Q: "Brennend", R: "Oberkörper", S: "10/10", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Verbrennung", "Brandwunde", "Grillunfall", "Combustio"],
            bleeding_info: "Keine Blutung, aber nässende Brandwunden.",
            mouth: "Ruß im Mund/Nasenbereich? -> Hier: Ja, Rußspuren an der Nase (Inhalationstrauma möglich!).",
            lung: "Frei, kein Stridor (noch nicht).",
            skin: "Rötung (Grad 1) und Blasen (Grad 2a/b) an beiden Armen und Thorax. Gesicht rot.",
            abdomen: "Weich.",
            pupils: "Isokor.",
            befast: "Unauffällig.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 10, ort: "Oberkörper", charakter: "Brennend" },
            
            // NEU: Färbt Oberkörper, beide Arme und Kopf rot
            injury_map: ["torso", "arm_r", "arm_l", "head"],
            injuries: ["Verbrennung 2. Grades (ca. 18% KOF)", "V.a. Inhalationstrauma"],

            nexus_criteria: { summary: "Unauffällig." },
            polytrauma_criteria: { vitals: "Stabil", anatomical: "Verbrennung > 20% oder Gesicht (Positiv für Zentrum)", mechanism: "-", special: "-" }
          }
        }),

        // ---------------------------------------------------------
        // FALL 7: COMMOTIO CEREBRI (Sportunfall)
        // ---------------------------------------------------------
        () => ({
          id: "rs_commotio_01",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Kopfverletzung Sportplatz'. Ort: Fußballfeld. Ein Spieler (18) ist mit einem anderen zusammengestoßen. Er war kurz weg, jetzt wieder wach, aber übel.",
          intro_dialogue: "Mir ist schlecht... *würg*... Was mach ich hier? Haben wir gewonnen?",
          target_outcome: "HWS-Immobilisation (bis Ausschluss), Überwachung (Vigilanz), Transport zum CCT (Ausschluss Blutung).",
          vitals: { RR: "125/80", SpO2: 97, AF: 16, Puls: 80, BZ: 95, Temp: 36.6, GCS: 14 }, // GCS 14 (konfus)
          scene_4s: {
            sicherheit: "-",
            szene: "Patient sitzt am Rasen, Trainer hält Kopf.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "RTW reicht meist, wenn stabil. NA nur bei Bewusstlosigkeit/Krampf."
          },
          anamnesis: {
            SAMPLER: {
              S: "Amnesie (weiß Spielstand nicht), Übelkeit, Kopfschmerz",
              A: "-",
              M: "-",
              P: "-",
              L: "Sportriegel",
              E: "Kopf-an-Kopf Zusammenstoß",
              R: "-"
            },
            OPQRST: { O: "Sofort", P: "-", Q: "Brummschädel", R: "Stirn", S: "4/10", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Commotio", "Gehirnerschütterung", "SHT"],
            bleeding_info: "Platzwunde an der Stirn (blutet stark, typisch Kopfschwarte).",
            mouth: "Frei.",
            lung: "Frei.",
            skin: "Blass.",
            abdomen: "Weich.",
            pupils: "Isokor, prompt. (Wichtig zum Ausschluss schweres SHT).",
            befast: "Retrograde Amnesie (Filmriss vor dem Unfall). Sonst motorisch fit.",
            ekg_pattern: "sinus",
            ekg12: "Sinusrhythmus.",
            pain: { nrs: 4, ort: "Kopf", charakter: "Dumpf" },
            
            // NEU: Kopf rot
            injury_map: ["head"],
            injuries: ["Platzwunde Stirn", "Commotio Cerebri"],

            nexus_criteria: { summary: "Vigilanz leicht gemindert (GCS 14)? -> HWS Immobilisation empfohlen bis Klinik." },
            polytrauma_criteria: { vitals: "Stabil", anatomical: "-", mechanism: "-", special: "-" }
          }
        }),

        // ---------------------------------------------------------
        // FALL 8: OFFENE UNTERSCHENKELFRAKTUR (Fußball)
        // ---------------------------------------------------------
        () => ({
          id: "rs_offen_tib_01",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Offener Bruch'. Ort: Sportplatz. Ein Spieler (25) wurde gefoult. Der linke Unterschenkel steht im 90° Winkel ab, Knochen sichtbar.",
          intro_dialogue: "Schaut euch das nicht an! *Weint*... Mein Bein! Macht, dass es aufhört!",
          target_outcome: "Sterile Abdeckung, DMS checken, Schienung in vorgefundener Lage (oder grob Längszug durch NA), Analgesie!",
          vitals: { RR: "140/90", SpO2: 98, AF: 22, Puls: 115, BZ: 100, Temp: 36.8, GCS: 15 },
          scene_4s: {
            sicherheit: "-",
            szene: "Knochenfragment hat Stutzen durchspießt. Infektionsgefahr!",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA zwingend (Analgesie, Infektionsprophylaxe, Reposition)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Extremer Schmerz, Fehlstellung, offene Wunde",
              A: "-",
              M: "-",
              P: "-",
              L: "-",
              E: "Foulspiel",
              R: "-"
            },
            OPQRST: { O: "Sofort", P: "Unmöglich", Q: "Explosiv", R: "Unterschenkel", S: "10/10", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Fraktur", "Offen", "Unterschenkel", "Tibia"],
            bleeding_info: "Sickerblutung aus der Frakturstelle (venös), kein arterieller Jet.",
            mouth: "Frei.",
            lung: "Frei.",
            skin: "Schweißig. Fußpulse tastbar? (DMS!).",
            abdomen: "Weich.",
            pupils: "Isokor.",
            befast: "Unauffällig.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 10, ort: "Unterschenkel links", charakter: "Vernichtend" },
            
            // NEU: Linkes Bein rot
            injury_map: ["leg_l"],
            injuries: ["Offene Unterschenkelfraktur II. Grades"],

            nexus_criteria: { summary: "Ablenkende Verletzung massiv vorhanden!" },
            polytrauma_criteria: { vitals: "Stabil", anatomical: "Offene Fraktur (Kriterium für Zentrum je nach Grad)", mechanism: "-", special: "-" }
          }
        }),

        // ---------------------------------------------------------
        // FALL 9: STUMPFES BAUCHTRAUMA (Lenkradanprall)
        // ---------------------------------------------------------
        () => ({
          id: "rs_abd_trauma",
          specialty: "trauma",
          story: "Einsatzstichwort: 'PKW gegen Baum'. Ort: Landstraße. Fahrer (40) war nicht angeschnallt (oder Gurtstraffer), Lenkrad ist verbogen. Er klagt über Bauchweh.",
          intro_dialogue: "Mir ist schlecht... mein Bauch tut weh... ich glaub, ich muss mich übergeben...",
          target_outcome: "Schockzeichen erkennen (Blutverlust nach innen!), Load & Go, Abdomen nicht unnötig palipieren, NA/RTH.",
          vitals: { RR: "100/60", SpO2: 95, AF: 24, Puls: 120, BZ: 110, Temp: 36.2, GCS: 15 }, // Kompensierter Schock
          scene_4s: {
            sicherheit: "Airbags ausgelöst? Rauch? Verkehr sichern.",
            szene: "Spiderapp in Frontscheibe, Lenkrad deformiert (Impact!).",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA (Verdacht auf Milz-/Leberruptur)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Abdominalschmerz, Übelkeit, Schwindel",
              A: "-",
              M: "Aspirin (Blutverdünnung!)",
              P: "Keine",
              L: "Mittag",
              E: "Aufprall mit ca. 50 km/h",
              R: "Aspirin verschlechtert Gerinnung"
            },
            OPQRST: { O: "Sofort", P: "Liegen geht so", Q: "Dumpf", R: "Linker Oberbauch (Milz?)", S: "7/10", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Abdominaltrauma", "Milzruptur", "Leberruptur", "Blutung"],
            bleeding_info: "Keine außen.",
            mouth: "Frei.",
            lung: "Prellmarke Thorax durch Gurt?",
            skin: "Blass, kalt, schweißig. Prellmarke am Bauch (Lenkradabdruck?).",
            abdomen: "Abwehrspannung (bretthart). Druckschmerz.",
            pupils: "Isokor.",
            befast: "Unauffällig.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 7, ort: "Bauch", charakter: "Dumpf" },
            
            // NEU: Rumpf rot
            injury_map: ["torso"],
            injuries: ["Stumpfes Bauchtrauma", "V.a. Milzruptur"],

            nexus_criteria: { summary: "Unauffällig." },
            polytrauma_criteria: { vitals: "Grenzwerte (Puls 120)", anatomical: "Verdacht auf penetrierendes/stumpfes Rumpftrauma", mechanism: "Verformung Innenraum > 50cm (Lenkrad)", special: "-" }
          }
        }),

        // ---------------------------------------------------------
        // FALL 10: QUERSCHNITTSLÄHMUNG (Motorradunfall)
        // ---------------------------------------------------------
        () => ({
          id: "rs_quer_01",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Motorrad vs. PKW'. Ort: Kreuzung. Der Motorradfahrer (30) liegt 10m vom Krad entfernt. Er ist wach, sagt aber, er spüre seine Beine nicht.",
          intro_dialogue: "Warum bewegt sich mein Bein nicht? Ich will aufstehen... aber es geht nicht! Spüren Sie das?",
          target_outcome: "Vollimmobilisation (Spineboard/Vakuum), Helmabnahme (zu zweit, Zug!), Neurogener Schock erkennen (Warm + Hypoton).",
          vitals: { RR: "80/40", SpO2: 96, AF: 18, Puls: 56, BZ: 100, Temp: 36.5, GCS: 15 }, // Neurogener Schock
          scene_4s: {
            sicherheit: "Verkehr sichern.",
            szene: "Patient liegt rückenlings. Helm noch auf.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA (Wirbelsäulentrauma + Schock)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Paraplegie (Lähmung ab Taille), keine Schmerzen in den Beinen",
              A: "-",
              M: "-",
              P: "-",
              L: "-",
              E: "Frontalkollision",
              R: "-"
            },
            OPQRST: { O: "Sofort", P: "-", Q: "Taubheit", R: "Beine", S: "0/10 (in Beinen), Rücken 8/10", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Querschnitt", "Wirbelsäule", "HWS", "Lähmung"],
            bleeding_info: "Keine großen Blutungen.",
            mouth: "Frei.",
            lung: "Frei.",
            skin: "Oberhalb der Verletzung blass/kalt, unterhalb der Verletzung (Beine) warm/rosig (Vasodilatation). Puls langsam (Vagus überwiegt).",
            abdomen: "Weich.",
            pupils: "Isokor.",
            befast: "Arme bewegen sich. Beine komplett schlaff. Sensibilität ab Bauchnabel aufgehoben.",
            ekg_pattern: "sinus",
            ekg12: "Sinusbradykardie.",
            pain: { nrs: 8, ort: "Rücken (Bruchstelle)", charakter: "Dumpf" },
            
            // NEU: Rumpf rot
            injury_map: ["torso"],
            injuries: ["V.a. Fraktur BWS/LWS", "Querschnittslähmung"],

            nexus_criteria: { summary: "POSITIV: Neurologische Ausfälle (Lähmung). HWS-Schutz zwingend." },
            polytrauma_criteria: { vitals: "RR < 90 (Positiv)", anatomical: "Lähmung (Positiv)", mechanism: "Motorradunfall", special: "-" }
          }
        }),
        // ---------------------------------------------------------
        // FALL 11: PERFORIERENDE AUGENVERLETZUNG (Metallsplitter)
        // ---------------------------------------------------------
        () => ({
          id: "rs_auge_01",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Fremdkörper im Auge'. Ort: Hobbywerkstatt. Ein Mann (40) hat ohne Brille geflext. Jetzt hält er sich die Hände vors Gesicht und schreit.",
          intro_dialogue: "Mein Auge! Da steckt was drin! Ich trau mich nicht zu gucken! Macht es raus!",
          target_outcome: "Fremdkörper NICHT entfernen! Beidseitige Augenabdeckung (sympathische Augenbewegung verhindern), Beruhigung, sitzender Transport.",
          vitals: { RR: "150/90", SpO2: 98, AF: 20, Puls: 110, BZ: 100, Temp: 36.8, GCS: 15 },
          scene_4s: {
            sicherheit: "Laufende Maschinen?",
            szene: "Patient sitzt am Boden.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "RTW (Augenklinik). NA nur bei unstillbaren Schmerzen/Panik."
          },
          anamnesis: {
            SAMPLER: {
              S: "Fremdkörpergefühl, Schmerz, Visusverlust",
              A: "-",
              M: "-",
              P: "-",
              L: "-",
              E: "Arbeit mit dem Winkelschleifer",
              R: "Keine Schutzbrille"
            },
            OPQRST: { O: "Sofort", P: "Augenbewegung schmerzt extrem", Q: "Stechend", R: "-", S: "9/10", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Auge", "Perforation", "Bulbus", "Fremdkörper"],
            bleeding_info: "Keine starke Blutung, Tränenfluss blutig tingiert.",
            mouth: "Frei.",
            lung: "Frei.",
            skin: "Schweißig.",
            abdomen: "Weich.",
            pupils: "Rechts: Metallsplitter steckt in der Iris/Hornhaut. Pupille entrundet (verzogen). Links: Unauffällig.",
            befast: "Unauffällig.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 9, ort: "Auge rechts", charakter: "Stechend" },
            
            // NEU: Kopf rot
            injury_map: ["head"],
            injuries: ["Perforierende Bulbusverletzung rechts"],

            nexus_criteria: { summary: "Unauffällig." },
            polytrauma_criteria: { vitals: "Stabil", anatomical: "-", mechanism: "-", special: "-" }
          }
        }),

        // ---------------------------------------------------------
        // FALL 12: INSTABILER THORAX (Paradoxe Atmung)
        // ---------------------------------------------------------
        () => ({
          id: "rs_flail_chest",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Sturz auf Kante'. Ort: Baustelle. Ein Arbeiter ist seitlich auf ein Metallgeländer gefallen. Er hält sich die Seite und atmet sehr flach.",
          intro_dialogue: "*Keuch*... es knirscht so... ich krieg keine Luft... *Hustet blutig*",
          target_outcome: "Paradoxe Atmung erkennen, O2-Gabe, Oberkörper hoch (Schonhaltung), Analgesie (NA), Voranmeldung (Pneu-Gefahr).",
          vitals: { RR: "110/70", SpO2: 88, AF: 30, Puls: 120, BZ: 100, Temp: 36.5, GCS: 15 }, // Hypoxie!
          scene_4s: {
            sicherheit: "-",
            szene: "Patient sitzt gekrümmt.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA (Ateminsuffizienz durch Schmerz + Instabilität)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Atemnot, Knirschen (Krepitation), Hämoptyse (Bluthusten)",
              A: "-",
              M: "-",
              P: "-",
              L: "-",
              E: "Sturz aus 1m auf Geländerkante",
              R: "-"
            },
            OPQRST: { O: "Sofort", P: "Atmen unmöglich", Q: "Stechend", R: "Flanke links", S: "9/10", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Rippenserienfraktur", "Instabil", "Thorax", "Flail"],
            bleeding_info: "Keine äußere Blutung.",
            mouth: "Leicht blutiger Auswurf (Lungenkontusion).",
            lung: "Links abgeschwächt. Paradoxe Atmung: Ein Teil der Brustwand zieht sich bei Einatmung nach innen! Hautemphysem tastbar (Knisten).",
            skin: "Zyanotisch, schweißig.",
            abdomen: "Weich (aber Milz checken bei linksseitigem Trauma!).",
            pupils: "Isokor.",
            befast: "Unauffällig.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 9, ort: "Thorax links", charakter: "Stechend" },
            
            // NEU: Rumpf rot
            injury_map: ["torso"],
            injuries: ["Instabiler Thorax", "Lungenkontusion"],

            nexus_criteria: { summary: "Unauffällig." },
            polytrauma_criteria: { vitals: "AF > 29 (Positiv)", anatomical: "Instabiler Thorax (Positiv)", mechanism: "-", special: "-" }
          }
        }),

        // ---------------------------------------------------------
        // FALL 13: SCHÄDELBASISBRUCH (Panda-Augen)
        // ---------------------------------------------------------
        () => ({
          id: "rs_sbb_01",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Treppensturz'. Ort: Hausflur. Frau M. (60) ist rückwärts die Kellertreppe hinabgestürzt. Sie ist wach, aber verlangsamt. Sie hat dunkle Ringe um die Augen.",
          intro_dialogue: "Mein Kopf brummt... was ist passiert? Mir läuft so Wasser aus der Nase...",
          target_outcome: "Keine nasalen Sonden/Zugänge! (Gefahr Hirnverletzung), HWS-Immobilisation, Oberkörper 30°, BZ messen.",
          vitals: { RR: "140/85", SpO2: 96, AF: 14, Puls: 70, BZ: 110, Temp: 36.6, GCS: 14 },
          scene_4s: {
            sicherheit: "-",
            szene: "Patientin sitzt am Treppenabsatz.",
            sichtung_personen: "1 Patientin.",
            support_empfehlung: "RTW + NA (SHT Grad 2-3 Verdacht)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Kopfschmerz, Amnesie, Rhinoliquorrhö (Nasenlaufen)",
              A: "-",
              M: "L-Thyroxin",
              P: "-",
              L: "-",
              E: "Sturz Hinterkopf",
              R: "-"
            },
            OPQRST: { O: "Unbekannt (Amnesie)", P: "-", Q: "Dumpf", R: "-", S: "5/10", T: "-" }
          },
          hidden: {
            diagnosis_keys: ["Schädelbasisbruch", "SBB", "SHT", "Brillenhaematom"],
            bleeding_info: "Platzwunde Hinterkopf.",
            mouth: "Frei. Aber: Klare Flüssigkeit tropft aus der Nase (Liquor!).",
            lung: "Frei.",
            skin: "Blass. 'Brillenhaematom' (Bluterguss um beide Augen) entwickelt sich. 'Battle-Sign' (blauer Fleck hinterm Ohr) noch nicht sichtbar.",
            abdomen: "Weich.",
            pupils: "Isokor, prompt.",
            befast: "Verlangsamt, Retrograde Amnesie.",
            ekg_pattern: "sinus",
            ekg12: "Sinusrhythmus.",
            pain: { nrs: 5, ort: "Kopf", charakter: "Dumpf" },
            
            // NEU: Kopf rot
            injury_map: ["head"],
            injuries: ["V.a. Schädelbasisbruch", "Platzwunde"],

            nexus_criteria: { summary: "Vigilanz gemindert? HWS-Schmerz? -> Immobilisation indiziert." },
            polytrauma_criteria: { vitals: "Stabil", anatomical: "-", mechanism: "Sturz Kellertreppe (Energie?)", special: "-" }
          }
        }),

        // ---------------------------------------------------------
        // FALL 14: OBERSCHENKELFRAKTUR (Femur-Schaft)
        // ---------------------------------------------------------
        () => ({
          id: "rs_femur_01",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Reitunfall'. Ort: Koppel. Eine Reiterin (20) wurde abgeworfen und vom Pferd am Oberschenkel getreten. Das Bein ist massiv geschwollen.",
          intro_dialogue: "Mein Bein platzt gleich! Aaaaah! Nicht anfassen!",
          target_outcome: "Volumenmangelschock antizipieren (bis 1.5L Blut im Oberschenkel!), Schienung (Vakuum), Analgesie (NA), DMS.",
          vitals: { RR: "105/65", SpO2: 98, AF: 20, Puls: 115, BZ: 95, Temp: 36.8, GCS: 15 }, // Beginnender Schock
          scene_4s: {
            sicherheit: "Pferd gesichert?",
            szene: "Patientin liegt im Sand. Oberschenkel prall elastisch gespannt.",
            sichtung_personen: "1 Patientin.",
            support_empfehlung: "NA zur Analgesie (Fentanyl/Ketamin). Beinzug ohne Schmerzmittel kaum möglich."
          },
          anamnesis: {
            SAMPLER: {
              S: "Extremer Schmerz, Schwellung",
              A: "-",
              M: "-",
              P: "-",
              L: "-",
              E: "Hufschlag gegen Oberschenkel",
              R: "-"
            },
            OPQRST: { O: "Sofort", P: "Unmöglich", Q: "Explosiv", R: "Oberschenkel rechts", S: "9/10", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Femur", "Oberschenkel", "Fraktur"],
            bleeding_info: "Keine äußere Blutung, aber massives inneres Hämatom (Beinumfang rechts >> links).",
            mouth: "Frei.",
            lung: "Frei.",
            skin: "Blass, kaltschweißig. Fußpulse rechts schwächer tastbar (Druck durch Hämatom?).",
            abdomen: "Weich.",
            pupils: "Isokor.",
            befast: "Unauffällig.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 9, ort: "Oberschenkel rechts", charakter: "Berstend" },
            
            // NEU: Rechtes Bein rot
            injury_map: ["leg_r"],
            injuries: ["Femurschaftfraktur rechts"],

            nexus_criteria: { summary: "Ablenkende Verletzung!" },
            polytrauma_criteria: { vitals: "Grenzwerte", anatomical: "Femurschaftfraktur (Kriterium Schockraum je nach Protokoll)", mechanism: "Hufschlag (hohe Energie)", special: "-" }
          }
        }),

        // ---------------------------------------------------------
        // FALL 15: STRANGULATION (Suizidversuch)
        // ---------------------------------------------------------
        () => ({
          id: "rs_hanging_01",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Suizidversuch'. Ort: Garage. Ehefrau hat Mann (45) am Strick gefunden und sofort abgeschnitten. Er liegt am Boden, atmet rasselnd.",
          intro_dialogue: "*Röchelt*... *würgt*... Stimme ist kaum hörbar (Heiserkeit)",
          target_outcome: "HWS-Immobilisation (Genickbruch?), Airway-Management (Kehlkopfödem!), NA-Nachforderung, Psyche beachten (Polizei).",
          vitals: { RR: "150/90", SpO2: 92, AF: 20, Puls: 110, BZ: 100, Temp: 36.5, GCS: 13 },
          scene_4s: {
            sicherheit: "Strick entfernt? Messer weg? Polizei für Zwangseinweisung/Eigenschutz.",
            szene: "Patient liegt am Boden. Strangmarke am Hals sichtbar.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA zwingend (Atemwegsgefahr durch Schwellung, HWS-Trauma)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Atemnot, Hals-Schmerz, Heiserkeit (Warnsignal!)",
              A: "-",
              M: "Antidepressiva",
              P: "Depression",
              L: "-",
              E: "Erhängen",
              R: "-"
            },
            OPQRST: { O: "-", P: "Schlucken tut weh", Q: "-", R: "-", S: "-", T: "-" }
          },
          hidden: {
            diagnosis_keys: ["Strangulation", "Erhängen", "Suizid", "HWS"],
            bleeding_info: "Keine.",
            mouth: "Zungenspitze blau? Petechien (Punktblutungen) in den Augen/Mundschleimhaut. Stridor hörbar (Kehlkopfschwellung!).",
            lung: "Frei.",
            skin: "Stauungszeichen Kopf (rot/blau), Körper blass.",
            abdomen: "Weich. Evtl. Urinabgang.",
            pupils: "Isokor.",
            befast: "Somnolent, motorisch aber intakt (keine Querschnittszeichen bisher).",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 7, ort: "Hals", charakter: "Brennend" },
            
            // NEU: Kopf rot (Hals)
            injury_map: ["head"],
            injuries: ["Strangmarke", "V.a. Larynxtrauma", "V.a. HWS-Fraktur"],

            nexus_criteria: { summary: "Mechanismus Erhängen = Hohes Risiko HWS. Immobilisation!" },
            polytrauma_criteria: { vitals: "Stabil", anatomical: "Halsverletzung (Atemweg gefährdet)", mechanism: "-", special: "-" }
          }
        }),
        // ---------------------------------------------------------
        // FALL 16: EXPLOSIONSTRAUMA (Böllerunfall)
        // ---------------------------------------------------------
        () => ({
          id: "rs_blast_01",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Handverletzung durch Feuerwerk'. Ort: Straße (Silvester). Ein junger Mann (20) hält seine blutende Hand hoch. Ein Böller ist zu früh losgegangen.",
          intro_dialogue: "Meine Finger! Sind sie noch dran? Ich hör nichts mehr... es piept so im Ohr!",
          target_outcome: "Blutung stillen (Druckverband, ggf. Tourniquet wenn arteriell spritzend), Amputat suchen?, Tinnitus beachten, Analgesie.",
          vitals: { RR: "130/80", SpO2: 98, AF: 22, Puls: 115, BZ: 100, Temp: 36.6, GCS: 15 },
          scene_4s: {
            sicherheit: "Explosivstoffe? Eigenschutz.",
            szene: "Patient steht schreiend auf der Straße. Hand ist in ein blutiges Tuch gewickelt.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "RTW + NA (Analgesie, Handchirurgie nötig)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Massiver Schmerz Hand, Tinnitus/Hörminderung",
              A: "-",
              M: "Alkohol",
              P: "-",
              L: "-",
              E: "Illegale Böller",
              R: "-"
            },
            OPQRST: { O: "Sofort", P: "-", Q: "Zerfetzend", R: "Rechte Hand", S: "9/10", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Explosion", "Handtrauma", "Amputation", "Knalltrauma"],
            bleeding_info: "Starke Blutung aus Fingerstümpfen D2/D3. Zerfetzte Weichteile.",
            mouth: "Frei.",
            lung: "Frei.",
            skin: "Schmauchspuren im Gesicht und an der Hand. Blass.",
            abdomen: "Weich.",
            pupils: "Isokor.",
            befast: "Unauffällig, aber Patient hört schlecht (Knalltrauma).",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 9, ort: "Rechte Hand", charakter: "Pochend" },
            
            // NEU: Rechter Arm (Hand)
            injury_map: ["arm_r"],
            injuries: ["Teilamputation Zeige-/Mittelfinger", "Verbrennungen", "Knalltrauma"],

            nexus_criteria: { summary: "Unauffällig." },
            polytrauma_criteria: { vitals: "Stabil", anatomical: "Amputation distal Handgelenk (Zuweisung Handchirurgie)", mechanism: "Explosion", special: "-" }
          }
        }),

        // ---------------------------------------------------------
        // FALL 17: STROMUNFALL (Haushaltsstrom)
        // ---------------------------------------------------------
        () => ({
          id: "rs_strom_01",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Stromschlag'. Ort: Küche. Ein Heimwerker (35) wollte eine Lampe anschließen und hat 'eine gewischt bekommen'. Er sitzt jetzt zitternd am Boden.",
          intro_dialogue: "Das hat voll reingehauen... mein Herz stolpert so komisch... und meine Hand ist taub.",
          target_outcome: "EKG-Monitoring zwingend! (Rhythmusstörungen?), Strommarken suchen (Eintritt/Austritt), 24h Überwachung in Klinik.",
          vitals: { RR: "140/90", SpO2: 97, AF: 18, Puls: 90, BZ: 95, Temp: 36.8, GCS: 15 }, // Puls unregelmäßig?
          scene_4s: {
            sicherheit: "Sicherung raus? Spannung weg? Erst prüfen, dann anfassen!",
            szene: "Schraubenzieher liegt am Boden, Kabel offen.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "RTW (Monitoring). NA nur bei maligner Arrhythmie.",
          },
          anamnesis: {
            SAMPLER: {
              S: "Palpitationen (Herzstolpern), Taubheit im Arm",
              A: "-",
              M: "-",
              P: "Gesund",
              L: "-",
              E: "Kontakt mit 230V",
              R: "-"
            },
            OPQRST: { O: "Sofort", P: "-", Q: "Kribbeln", R: "Rechter Arm", S: "3/10", T: "-" }
          },
          hidden: {
            diagnosis_keys: ["Strom", "Elektrisiert", "Arrhythmie", "Verbrennung"],
            bleeding_info: "Keine.",
            mouth: "Frei.",
            lung: "Frei.",
            skin: "Strommarke (kleine weiße Verkohlung) am Zeigefinger rechts (Eintritt). Austrittswunde linker Fuß? (Suchen!).",
            abdomen: "Weich.",
            pupils: "Isokor.",
            befast: "Unauffällig.",
            ekg_pattern: "ves", // Vereinzelte Extrasystolen
            ekg12: "Sinusrhythmus mit gehäuften ventriculären Extrasystolen (VES). Gefahr von Kammerflimmern beachten!",
            pain: { nrs: 3, ort: "Hand", charakter: "Kribbelnd" },
            
            // NEU: Eintritt (Arm rechts) und Austritt (Bein links)
            injury_map: ["arm_r", "leg_l"],
            injuries: ["Strommarke Finger rechts", "V.a. kardiale Beteiligung"],

            nexus_criteria: { summary: "Unauffällig." },
            polytrauma_criteria: { vitals: "Stabil", anatomical: "-", mechanism: "-", special: "-" }
          }
        }),

        // ---------------------------------------------------------
        // FALL 18: PFÄHLUNGSVERLETZUNG (Gartenzaun)
        // ---------------------------------------------------------
        () => ({
          id: "rs_pfaehlung_01",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Person in Zaun'. Ort: Vorgarten. Ein Maler ist von der Leiter gefallen und mit dem linken Oberschenkel auf einer Metallspitze des Zauns gelandet.",
          intro_dialogue: "Holt mich hier runter! Zieht es raus! Es tut so weh!",
          target_outcome: "Fremdkörper NICHT entfernen! (Tamponiert Blutung), Stabilisieren (Polstern), Feuerwehr zur technischen Rettung (Zaun absägen), Analgesie.",
          vitals: { RR: "110/70", SpO2: 96, AF: 22, Puls: 110, BZ: 100, Temp: 36.5, GCS: 15 },
          scene_4s: {
            sicherheit: "Leiter sicher? Zaun stabil?",
            szene: "Patient 'hängt' bzw. sitzt am Zaun fest. Metallstab steckt im Bein.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA + Feuerwehr (Patientenbefreiung)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Fixierter Fremdkörper, Schmerz",
              A: "-",
              M: "-",
              P: "-",
              L: "-",
              E: "Leitersturz",
              R: "Tetanusschutz?"
            },
            OPQRST: { O: "Sofort", P: "Jede Bewegung", Q: "Stechend", R: "-", S: "8/10", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Pfählung", "Fremdkörper", "Trauma", "Zaun"],
            bleeding_info: "Leichte Sickerblutung um den Spieß. Gefahr der massiven Blutung erst beim Entfernen!",
            mouth: "Frei.",
            lung: "Frei.",
            skin: "Blass, schweißig.",
            abdomen: "Weich.",
            pupils: "Isokor.",
            befast: "Unauffällig.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 8, ort: "Oberschenkel", charakter: "Stechend" },
            
            // NEU: Linkes Bein rot
            injury_map: ["leg_l"],
            injuries: ["Pfählungsverletzung Oberschenkel links"],

            nexus_criteria: { summary: "Unauffällig." },
            polytrauma_criteria: { vitals: "Stabil", anatomical: "Pfählungsverletzung Rumpf/Stammnahe (Positiv)", mechanism: "Sturz", special: "-" }
          }
        }),

        // ---------------------------------------------------------
        // FALL 19: HUNDEBISS (Multiple Wunden)
        // ---------------------------------------------------------
        () => ({
          id: "rs_biss_01",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Tierbiss'. Ort: Park. Eine Joggerin (28) wurde von einem Schäferhund angegriffen. Sie hat Bisswunden am rechten Unterarm und an der rechten Wade.",
          intro_dialogue: "Der hat einfach zugebissen! Überall Blut... und ich glaube, da ist was abgerissen!",
          target_outcome: "Wundversorgung, DMS (Nerven/Sehnen betroffen?), Impfstatus checken, Polizei (Hundesicherung?), Analgesie.",
          vitals: { RR: "130/80", SpO2: 98, AF: 20, Puls: 105, BZ: 95, Temp: 37.0, GCS: 15 },
          scene_4s: {
            sicherheit: "Ist der Hund weg/gesichert? Besitzer vor Ort?",
            szene: "Patientin sitzt auf Bank, hält sich den Arm.",
            sichtung_personen: "1 Patientin.",
            support_empfehlung: "RTW. NA nur bei massivem Weichteilschaden/Schock."
          },
          anamnesis: {
            SAMPLER: {
              S: "Schmerzen, blutende Wunden, Angst",
              A: "Penicillin",
              M: "-",
              P: "-",
              L: "-",
              E: "Hundeangriff",
              R: "Infektionsgefahr"
            },
            OPQRST: { O: "Sofort", P: "-", Q: "Reißend", R: "Arm/Bein", S: "6/10", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Biss", "Hundebiss", "Wunde"],
            bleeding_info: "Tiefe Fleischwunden Unterarm (venös blutend) und Wade. Zerfetzte Ränder.",
            mouth: "Frei.",
            lung: "Frei.",
            skin: "Blass.",
            abdomen: "Weich.",
            pupils: "Isokor.",
            befast: "Fingerbeweglichkeit eingeschränkt (Sehne durchtrennt?). Sensibilität an der Hand gestört (Nerv verletzt?).",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 6, ort: "Arm/Bein", charakter: "Brennend" },
            
            // NEU: Rechter Arm und rechtes Bein
            injury_map: ["arm_r", "leg_r"],
            injuries: ["Multiple Bisswunden", "V.a. Sehnenverletzung Arm"],

            nexus_criteria: { summary: "Unauffällig." },
            polytrauma_criteria: { vitals: "Stabil", anatomical: "-", mechanism: "-", special: "-" }
          }
        }),

        // ---------------------------------------------------------
        // FALL 20: EVISZERATION (Offene Bauchverletzung)
        // ---------------------------------------------------------
        () => ({
          id: "rs_evisz_01",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Schnittverletzung Bauch'. Ort: Küche. Ein Mann ist in eine Glastür gefallen. Eine große Scherbe hat den Bauchraum eröffnet. Darmschlingen sind sichtbar.",
          intro_dialogue: "Oh Gott... mein Bauch... haltet das fest! Das kommt alles raus!",
          target_outcome: "Darm NICHT zurückdrücken! Feucht und steril abdecken (Kochsalz-Kompressen), Beine anwinkeln (Bauchdecke entlasten), Wärmeerhalt, NA.",
          vitals: { RR: "100/60", SpO2: 96, AF: 24, Puls: 115, BZ: 100, Temp: 36.3, GCS: 15 },
          scene_4s: {
            sicherheit: "Scherben am Boden?",
            szene: "Patient liegt am Rücken, hält sich den Bauch.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA zwingend (Offenes Abdomen ist lebensgefährlich)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Eviszeration (Darmvorfall), Schmerz",
              A: "-",
              M: "-",
              P: "-",
              L: "-",
              E: "Sturz in Glastür",
              R: "-"
            },
            OPQRST: { O: "Sofort", P: "Husten/Pressen drückt Darm raus", Q: "Schneidend", R: "Bauch", S: "8/10", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Eviszeration", "Offenes Abdomen", "Schnitt", "Bauch"],
            bleeding_info: "Mäßige Blutung aus der Bauchdecke, aber Darm liegt frei vor (Infektionsgefahr/Austrocknung).",
            mouth: "Frei.",
            lung: "Frei.",
            skin: "Blass, kaltschweißig (Vagale Reaktion + Schreck).",
            abdomen: "Offene Wunde ca. 10cm, Dünndarmschlingen prolabiert.",
            pupils: "Isokor.",
            befast: "Unauffällig.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 8, ort: "Bauch", charakter: "Schneidend" },
            
            // NEU: Rumpf rot
            injury_map: ["torso"],
            injuries: ["Offenes Bauchtrauma mit Eviszeration"],

            nexus_criteria: { summary: "Unauffällig." },
            polytrauma_criteria: { vitals: "Stabil", anatomical: "Penetrierendes Rumpftrauma (Positiv)", mechanism: "-", special: "-" }
          }
        }),
        // ---------------------------------------------------------
        // FALL 21: PERTHES-SYNDROM (Traumatische Asphyxie)
        // ---------------------------------------------------------
        () => ({
          id: "rs_perthes_01",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Person unter PKW'. Ort: Werkstatt. Ein Mechaniker lag unter dem Auto, als der Wagenheber nachgab. Der Brustkorb wurde kurzzeitig eingequetscht. Kollegen haben ihn befreit.",
          intro_dialogue: "*Hustet blutig*... ich hab keine Luft bekommen... mein Gesicht fühlt sich so dick an...",
          target_outcome: "Oberkörper hoch, O2, Monitoring (Herzschäden?), NA (hohes Risiko für innere Verletzungen trotz Wachheit).",
          vitals: { RR: "110/70", SpO2: 92, AF: 26, Puls: 110, BZ: 105, Temp: 36.6, GCS: 15 },
          scene_4s: {
            sicherheit: "-",
            szene: "Patient sitzt, Gesicht sieht dunkelblau/violett aus, der Rest des Körpers ist blass.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA (Thoraxtrauma + Hypoxie-Folgen)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Atemnot, bläuliche Verfärbung Gesicht, Sehstörung",
              A: "-",
              M: "-",
              P: "-",
              L: "-",
              E: "Thoraxkompression durch PKW",
              R: "-"
            },
            OPQRST: { O: "Sofort", P: "-", Q: "Druck", R: "Brust/Kopf", S: "8/10", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Perthes", "Druckstauung", "Asphyxie", "Quetschung"],
            bleeding_info: "Keine äußere Blutung.",
            mouth: "Zunge geschwollen, blau. Petechien (Punktblutungen) an der Schleimhaut.",
            lung: "Beidseits belüftet, aber rasselnd (Lungenkontusion?).",
            skin: "Kopf/Hals dunkelblau-violett verfärbt, punktförmige Einblutungen. Ab Hals abwärts blass.",
            abdomen: "Weich.",
            pupils: "Einblutungen im Weißen des Auges (Hyposphagma).",
            befast: "Unauffällig.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 8, ort: "Brustkorb", charakter: "Dumpf" },
            
            // NEU: Kopf (blau) und Rumpf (gequetscht)
            injury_map: ["head", "torso"],
            injuries: ["Traumatische Asphyxie", "Thoraxkontusion"],

            nexus_criteria: { summary: "Unauffällig." },
            polytrauma_criteria: { vitals: "Stabil", anatomical: "Thoraxtrauma mit Lungenbeteiligung", mechanism: "Verschüttung (Positiv)", special: "-" }
          }
        }),

        // ---------------------------------------------------------
        // FALL 22: OFFENER PNEUMOTHORAX (Saugende Wunde)
        // ---------------------------------------------------------
        () => ({
          id: "rs_open_pneu",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Schussverletzung'. Ort: Jagdhütte. Ein Jäger (50) hat sich beim Reinigen der Waffe versehentlich in die Brust geschossen.",
          intro_dialogue: "Verdammt... *keuch*... es blubbert in meiner Brust... Luft fehlt...",
          target_outcome: "Wunde luftdicht verschließen (Chest Seal mit Ventil!), O2, Schocklage, NA.",
          vitals: { RR: "100/60", SpO2: 88, AF: 28, Puls: 125, BZ: 100, Temp: 36.5, GCS: 15 },
          scene_4s: {
            sicherheit: "Waffe gesichert? Polizei?",
            szene: "Patient sitzt, hält Hand auf Wunde. Hellroter Blutschaum.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA zwingend (Lebensgefahr)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Atemnot, schlürfendes Geräusch an der Wunde",
              A: "-",
              M: "-",
              P: "-",
              L: "-",
              E: "Schussunfall",
              R: "-"
            },
            OPQRST: { O: "Sofort", P: "-", Q: "Stechend", R: "-", S: "9/10", T: "-" }
          },
          hidden: {
            diagnosis_keys: ["Pneumothorax", "Offen", "Schuss", "Sucking"],
            bleeding_info: "Schusswunde Thorax links, ca. 2cm. Blubbert und zieht Luft (Sucking Chest Wound).",
            mouth: "Frei.",
            lung: "Links abgeschwächt. Wunde 'atmet' mit.",
            skin: "Blass, schweißig.",
            abdomen: "Weich.",
            pupils: "Isokor.",
            befast: "Unauffällig.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 9, ort: "Brust links", charakter: "Stechend" },
            
            // NEU: Rumpf rot
            injury_map: ["torso"],
            injuries: ["Offener Pneumothorax links"],

            nexus_criteria: { summary: "Unauffällig." },
            polytrauma_criteria: { vitals: "AF > 29, SpO2 < 90 (Positiv)", anatomical: "Penetrierende Rumpfverletzung (Positiv)", mechanism: "Schuss (Positiv)", special: "-" }
          }
        }),

        // ---------------------------------------------------------
        // FALL 23: PATELLALUXATION (Sportverletzung)
        // ---------------------------------------------------------
        () => ({
          id: "rs_patella_01",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Knieverletzung'. Ort: Turnhalle. Ein Handballer (19) liegt am Boden und hält sein Knie. Das Bein ist angewinkelt, die Kniescheibe steht außen.",
          intro_dialogue: "Mein Knie! Es ist rausgesprungen! Fasst es nicht an! Aaaaaah!",
          target_outcome: "Lagerung in vorgefundener Stellung (Polstern), Kühlung (vorsichtig), DMS checken, NA für Analgesie & Reposition.",
          vitals: { RR: "145/85", SpO2: 99, AF: 20, Puls: 110, BZ: 95, Temp: 37.0, GCS: 15 },
          scene_4s: {
            sicherheit: "-",
            szene: "Patient hat starke Schmerzen, lässt niemanden ran.",
            sichtung_personen: "1 Patient.",
            support_empfehlung: "NA (Reposition ohne Narkose oft nicht möglich/qualvoll)."
          },
          anamnesis: {
            SAMPLER: {
              S: "Deformität Knie, Schmerz, Fixiertheit",
              A: "-",
              M: "-",
              P: "Schon mal passiert",
              L: "-",
              E: "Drehbewegung beim Stoppen",
              R: "Bandlaxizität"
            },
            OPQRST: { O: "Sofort", P: "Jede Erschütterung ++", Q: "Ausrenken", R: "Knie", S: "8/10", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Luxation", "Patella", "Knie", "Verrenkung"],
            bleeding_info: "Keine.",
            mouth: "Frei.",
            lung: "Frei.",
            skin: "Rosig. Kniegelenk deformiert, Patella liegt lateral (außen).",
            abdomen: "Weich.",
            pupils: "Isokor.",
            befast: "Unauffällig.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 8, ort: "Knie rechts", charakter: "Verschoben" },
            
            // NEU: Rechtes Bein rot
            injury_map: ["leg_r"],
            injuries: ["Patellaluxation rechts"],

            nexus_criteria: { summary: "Unauffällig." },
            polytrauma_criteria: { vitals: "Stabil", anatomical: "-", mechanism: "-", special: "-" }
          }
        }),

        // ---------------------------------------------------------
        // FALL 24: CHEMISCHE VERÄTZUNG (Säure)
        // ---------------------------------------------------------
        () => ({
          id: "rs_acid_01",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Chemieunfall'. Ort: Reinigungslager. Eine Putzkraft (55) hat beim Umfüllen Rohrreiniger (Schwefelsäure) über den rechten Arm und ins Gesicht bekommen.",
          intro_dialogue: "Es brennt! Meine Haut schmilzt! Wasser! Schnell!",
          target_outcome: "Eigenschutz (Handschuhe!), Spülen, Spülen, Spülen (mind. 20 min)! Kontaminierte Kleidung weg. Auge betroffen? -> Augendusche.",
          vitals: { RR: "160/95", SpO2: 98, AF: 22, Puls: 115, BZ: 100, Temp: 36.8, GCS: 15 },
          scene_4s: {
            sicherheit: "Stoff identifizieren (Sicherheitsdatenblatt?). Kontakt vermeiden! Schutzbrille!",
            szene: "Patientin steht am Waschbecken. Kleidung raucht/zersetzt sich.",
            sichtung_personen: "1 Patientin.",
            support_empfehlung: "NA (Analgesie), ggf. Giftnotruf Rücksprache."
          },
          anamnesis: {
            SAMPLER: {
              S: "Brennender Schmerz, Rötung/Verätzung",
              A: "-",
              M: "-",
              P: "-",
              L: "-",
              E: "Umfüllen von Industrie-Reiniger",
              R: "-"
            },
            OPQRST: { O: "Sofort", P: "-", Q: "Ätzend", R: "Arm/Wange", S: "9/10", T: "Fortschreitend" }
          },
          hidden: {
            diagnosis_keys: ["Verätzung", "Säure", "Chemie", "Lauge"],
            bleeding_info: "Keine Blutung, aber Haut weißlich verfärbt/nekrotisch (Koagulationsnekrose).",
            mouth: "Frei (Glück gehabt, nichts geschluckt).",
            lung: "Frei.",
            skin: "Rechter Arm und Wange: Verätzung Grad 2-3.",
            abdomen: "Weich.",
            pupils: "Isokor. Auge zum Glück verschont (Lidschlussreflex).",
            befast: "Unauffällig.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 9, ort: "Arm/Gesicht", charakter: "Ätzend" },
            
            // NEU: Arm und Kopf rot
            injury_map: ["arm_r", "head"],
            injuries: ["Säureverätzung Arm/Gesicht"],

            nexus_criteria: { summary: "Unauffällig." },
            polytrauma_criteria: { vitals: "Stabil", anatomical: "-", mechanism: "Chemieunfall", special: "-" }
          }
        }),

        // ---------------------------------------------------------
        // FALL 25: SKALPIERUNGSVERLETZUNG (Degloving)
        // ---------------------------------------------------------
        () => ({
          id: "rs_scalp_01",
          specialty: "trauma",
          story: "Einsatzstichwort: 'Haare in Maschine'. Ort: Fabrik. Einer Arbeiterin (30) wurden die langen Haare von einer Welle erfasst. Große Teile der Kopfhaut sind abgerissen.",
          intro_dialogue: "*Schreit hysterisch*... Mein Kopf! Alles voller Blut! Hilfe!",
          target_outcome: "Blutung stillen (Kopfhaut blutet stark!), Amputat (Kopfhautstück) sichern & kühlen, Wundauflage, Schockbehandlung.",
          vitals: { RR: "110/70", SpO2: 96, AF: 24, Puls: 130, BZ: 95, Temp: 36.5, GCS: 15 },
          scene_4s: {
            sicherheit: "Maschine aus?",
            szene: "Patientin hält sich Handtuch auf den Kopf, das ist durchgeblutet. Skalp liegt in der Maschine.",
            sichtung_personen: "1 Patientin.",
            support_empfehlung: "NA (Analgesie, Volumen). Transport in Klinik mit Plastischer Chirurgie."
          },
          anamnesis: {
            SAMPLER: {
              S: "Massive Blutung, Schmerz, Schock",
              A: "-",
              M: "-",
              P: "-",
              L: "-",
              E: "Arbeitsunfall",
              R: "Kein Haarnetz getragen"
            },
            OPQRST: { O: "Sofort", P: "-", Q: "Reißend", R: "Kopf", S: "10/10", T: "Akut" }
          },
          hidden: {
            diagnosis_keys: ["Skalpierung", "Degloving", "Kopfschwarte", "Blutung"],
            bleeding_info: "Massive Blutung aus der Kopfschwarte (sehr gut durchblutet). Druckverband schwierig, manueller Druck nötig.",
            mouth: "Frei.",
            lung: "Frei.",
            skin: "Blass, tachykard.",
            abdomen: "Weich.",
            pupils: "Isokor.",
            befast: "Unauffällig.",
            ekg_pattern: "sinus",
            ekg12: "Sinustachykardie.",
            pain: { nrs: 10, ort: "Kopf", charakter: "Reißend" },
            
            // NEU: Kopf rot
            injury_map: ["head"],
            injuries: ["Skalpierungsverletzung (Degloving)"],

            nexus_criteria: { summary: "Unauffällig." },
            polytrauma_criteria: { vitals: "Puls > 120 (Positiv)", anatomical: "Skalpierung (Weichteilschaden)", mechanism: "-", special: "-" }
          }
        }),
      ],
    };

    
    // ---------- Fall auswählen (MIT ZUFALLS-LOGIK) ----------
    
    // 1. Hole den Eintrag für die gewählte Fachrichtung (oder Fallback auf internistisch)
    const selection = cases[specialty] || cases["internistisch"];
    let createCase;

    // 2. Prüfen: Ist es eine Liste (Array) von Fällen?
    if (Array.isArray(selection)) {
        // JA: Wähle zufällig einen aus
        const randomIndex = Math.floor(Math.random() * selection.length);
        createCase = selection[randomIndex];
    } else {
        // NEIN: Es ist noch ein einzelner Fall (alte Logik für trauma/neuro etc.)
        createCase = selection;
    }

    // 3. Fall generieren (Funktion ausführen)
    let c = createCase();

    // ---------- Defaults & Fallbacks ----------
    c.role = role;
    c.difficulty = difficulty;
    c.score = 0;
    c.steps_done = [];
    c.history = [];
    
    // Safety Fallbacks
    c.vitals = c.vitals || { RR: "120/80", SpO2: 96, AF: 16, Puls: 80, BZ: 100, Temp: 36.5, GCS: 15 };
    c.measurements = c.measurements || {}; // Wichtig für Initialisierung
    
    // Hidden Fallbacks
    c.hidden = c.hidden || {};
    c.hidden.vitals_baseline = c.hidden.vitals_baseline || { ...c.vitals };
    c.hidden.injuries = c.hidden.injuries || [];
    c.hidden.diagnosis_keys = c.hidden.diagnosis_keys || [];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(c)
    };
  } catch (err) {
    console.error(err); // Fehler im Netlify Log anzeigen
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || String(err) })
    };
  }
};