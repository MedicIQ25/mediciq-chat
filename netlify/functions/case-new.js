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
          story: "Einsatzstichwort: 'Übelkeit/Erbrechen'. Ort: Jugendzimmer. Lisa (16) liegt im Bett, wirkt schläfrig. Es riecht komisch im Zimmer (süßlich/Obstatom).",
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
        })
      ],

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