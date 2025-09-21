// ================================================================
// medicIQ – Fallgenerator (case-new.js)
// ================================================================
export async function handler(event) {
  
  // ----- CORS -----
  const ALLOWED_ORIGINS = [
    "https://www.mediciq.de",
    "https://mediciq.de",
    "https://mediciq.webflow.io"
  ];
  const reqOrigin   = event.headers.origin || event.headers.Origin || "";
  const allowOrigin = ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0];
  const headers = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    const { specialty = "internistisch", difficulty = "mittel", role = "RS" } =
      JSON.parse(event.body || "{}");

    // ----- Helpers -----
    const newId    = () => "fall_" + Math.random().toString(36).slice(2, 8);
    const pick     = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const rint     = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
    const jitter   = (base, d) => base + rint(-d, d);
    const vitals   = (bpSys, bpDia, spo2, af, puls, bz, temp, gcs = 15) => ({
      RR: `${bpSys}/${bpDia}`, SpO2: spo2, AF: af, Puls: puls, BZ: bz, Temp: temp, GCS: gcs
    });

    // ----- Kompetenz -----
    const scopeRS = {
      role: "RS",
      allowed_actions: [
        "Eigenschutz/Umfeld sichern",
        "Patientenansprache, Bewusstsein prüfen (AVPU/GCS)",
        "ABCDE-Assessment",
        "Monitoring: RR, SpO2, Puls, AF, BZ, Temp, GCS",
        "Pupillen prüfen", "Mundraum inspizieren", "Auskultation Lunge",
        "Schmerzskala", "EKG (3-/12-Kanal)", "BEFAST",
        "Lagerung (OKH, Sitz, SSL, Schocklage)",
        "Wärmeerhalt/Kühlung", "Absaugen",
        "Sauerstoffgabe (bei Indikation)",
        "NA nachfordern", "Transport einleiten", "Übergabe"
      ],
      disallowed_examples: [
        "i.v.-Zugang", "RSI/Intubation", "Medikamentengabe (arztpflichtig)"
      ]
    };
    const scopeNotSan = {
      role: "NotSan",
      allowed_actions: [...scopeRS.allowed_actions, "i.v.-Zugang (SOP)", "erweiterte Maßnahmen (SOP)"],
      disallowed_examples: ["RSI/Narkose"]
    };
    const SCOPE = role === "NotSan" ? scopeNotSan : scopeRS;

    // ----- Specialty Map -----
    const MAP = {
      internistisch: "internistisch", internal: "internistisch", innere: "internistisch",
      medizinisch: "internistisch", "innere medizin": "internistisch",
      neurologisch: "neurologisch", neurologie: "neurologisch",
      trauma: "trauma", unfall: "trauma", unfallchirurgie: "trauma",
      pädiatrisch: "paediatrisch", paediatrisch: "paediatrisch",
      kinder: "paediatrisch", kinderheilkunde: "paediatrisch", pediatrisch: "paediatrisch"
    };
    const normalized = MAP[(specialty || "").toString().trim().toLowerCase()] || "internistisch";

    // ----- Anamnese-Builder -----
    const mkAnam = (over = {}) => ({
      SAMPLER: { S: "", A: "keine bekannt", M: "keine", P: "keine Auffälligkeiten", L: "", E: "", R: "", ...(over.SAMPLER || {}) },
      OPQRST:  { O: "", P: "", Q: "", R: "", S: "", T: "", ...(over.OPQRST || {}) },
      vorerkrankungen: over.vorerkrankungen || [],
      medikation     : over.medikation || [],
      allergien      : over.allergien || [],
      antikoagulation: !!over.antikoagulation,
      sozial         : over.sozial || {}
    });

    // ===== INTERNISTISCH (Auswahl) =====
    const int_genACS = () => {
      const bpS=jitter(125,12), bpD=jitter(80,8), spo2=jitter(88,3), af=jitter(20,3),
            puls=jitter(100,8), bz=jitter(110,10), temp=36.8;
      const side = pick(["linken","rechten"]);
      return {
        diagnosis: "Akutes Koronarsyndrom (ACS, STEMI möglich)",
        story: `65-jähriger Mann mit drückendem Brustschmerz, Ausstrahlung in den ${side} Arm, Übelkeit, Schweiß.`,
        key_findings: ["drückender Thoraxschmerz","Dyspnoe","Risikofaktoren"],
        red_flags: ["Thoraxschmerz >15 min","vegetative Begleitsymptome"],
        target_outcome: "Monitoring, 12-Kanal-EKG, ACS-Transport.",
        patient: { name: "Herr K.", age: 65, sex: "m" },
        anamnesis: mkAnam({
          SAMPLER:{ S:"Druck auf der Brust mit Ausstrahlung, Übelkeit, kalter Schweiß",
            A:"ASS: Magenbeschwerden", M:"ASS 100, Ramipril, Atorvastatin",
            P:"KHK, HTN, Hyperlipidämie", L:"Kaffee heute früh",
            E:"unter Stress beim Treppensteigen", R:"männlich, Raucher, Alter, HTN" },
          OPQRST:{ O:"seit 20 min", P:"keine Linderung in Ruhe", Q:"drückend/enge",
            R:"retrosternal → Arm/Unterkiefer", S:"8/10", T:"progredient" },
          vorerkrankungen:["KHK","Hypertonie","Hyperlipidämie"],
          medikation:["ASS 100","Ramipril","Atorvastatin"],
          allergien:["keine bekannt"]
        }),
        patho: { tag:["ACS","kardiovaskulär"], severity:2, hypoxia_sensitivity:1, dehydration:0, baseline_deterioration:1 },
        hidden: {
          vitals_baseline: vitals(bpS,bpD,spo2,af,puls,bz,temp),
          pupils:"isokor, prompt", mouth:"rosige Schleimhäute",
          lung:"normales Atemgeräusch, evtl. Tachypnoe", abdomen:"weich",
          ekg3:`Sinus ${puls}/min`, ekg12: pick(["STEMI inferior","NSTEMI-Zeichen"]),
          befast:null, neuro:null
        }
      };
    };

    const int_genPneumonia = () => {
      const bpS=jitter(130,10), bpD=jitter(80,8), spo2=jitter(90,3), af=jitter(26,4),
            puls=jitter(105,10), bz=jitter(120,10), temp=38.6;
      return {
        diagnosis:"Pneumonie mit Hypoxie",
        story:"72-jährige Patientin mit Husten, Fieber, zunehmender Atemnot seit 2 Tagen.",
        key_findings:["Fieber","basale feuchte RG","Hypoxie"],
        red_flags:["Tachypnoe + Hypoxie"],
        target_outcome:"O2 nach Indikation, Monitoring, Klinik.",
        patient:{ name:"Frau S.", age:72, sex:"w" },
        anamnesis: mkAnam({
          SAMPLER:{ S:"Husten, Fieber, Atemnot", A:"Penicillin: Ausschlag",
            M:"Amlodipin", P:"COPD leicht, HTN", L:"Suppe vor 3h",
            E:"seit Infektverschlechterung", R:"Alter, COPD" },
          OPQRST:{ O:"seit 48 h, zunehmend", P:"Sitzen erleichtert etwas",
            Q:"Atemnot", R:"beidseitig", S:"7/10 (Atemnot)", T:"progredient" },
          vorerkrankungen:["COPD leicht","Hypertonie"], medikation:["Amlodipin"], allergien:["Penicillin"]
        }),
        patho:{ tag:["infektiös","obstruktiv"], severity:2, hypoxia_sensitivity:2, dehydration:1, baseline_deterioration:1 },
        hidden:{ vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp), pupils:"isokor", mouth:"mukopurulentes Sekret",
          lung:"basal feuchte RG rechts>links", abdomen:"weich",
          ekg3:`Sinus ${puls}/min`, ekg12:"Sinus", befast:null, neuro:null }
      };
    };

    const int_genHF = () => {
      const v = vitals(jitter(135,12),jitter(85,8),jitter(90,4),jitter(24,4),jitter(108,10),jitter(120,10),36.9);
      return {
        diagnosis:"Akute kardiale Dekompensation",
        story:"Älterer Patient mit Orthopnoe, Beinödemen, nächtlicher Dyspnoe.",
        key_findings:["Orthopnoe","Rasselgeräusche basal","Ödeme"],
        red_flags:["Ruhedyspnoe","Hypoxie"],
        target_outcome:"Sitzlagerung, O2 bei Indikation, Monitoring, zügiger Transport.",
        patient:{ name:"Herr B.", age:78, sex:"m" },
        anamnesis: mkAnam({ SAMPLER:{ S:"Atemnot in Ruhe, Husten schaumig",
          A:"keine", M:"Diuretikum unregelmäßig", P:"Herzinsuffizienz, HTN",
          L:"Frühstück", E:"seit heute Morgen deutlich schlechter", R:"Alter, Herzkrankheit" } }),
        patho:{ tag:["kardiovaskulär","stauung"], severity:2, hypoxia_sensitivity:2, dehydration:0, baseline_deterioration:1 },
        hidden:{ vitals_baseline:v, pupils:"isokor", mouth:"schaumiger Speichel",
          lung:"basal feuchte RG beidseits", abdomen:"weich",
          ekg3:`Sinus ${v.Puls}/min`, ekg12:"Sinus" }
      };
    };

    const int_genAsthmaCOPD = () => {
      const v = vitals(jitter(130,10),jitter(80,8),jitter(90,4),jitter(28,5),jitter(104,10),110,36.8);
      return {
        diagnosis:"Akute obstruktive Exazerbation (Asthma/COPD)",
        story:"Bekannter Asthmatiker/COPD mit Giemen und verlängertem Exspirium.",
        key_findings:["Giemen"," verlängertes Exspirium","Dyspnoe"],
        red_flags:["Erschöpfung","Zyanose"],
        target_outcome:"Atemerleichternde Lagerung, O2 vorsichtig titriert, Monitoring.",
        patient:{ name:"Frau R.", age:66, sex:"w" },
        anamnesis: mkAnam({ SAMPLER:{ S:"Atemnot, pfeifende Atmung", A:"keine",
          M:"SABA bei Bedarf", P:"COPD/Asthma", L:"—", E:"Kälte/Infekt", R:"Raucherin" } }),
        patho:{ tag:["obstruktiv"], severity:2, hypoxia_sensitivity:3, dehydration:0, baseline_deterioration:1 },
        hidden:{ vitals_baseline:v, pupils:"isokor", mouth:"trocken", lung:"Giemen, exspiratorisch",
          abdomen:"weich", ekg3:`Sinus ${v.Puls}/min`, ekg12:"Sinus" }
      };
    };

    const int_genPE = () => {
      const v = vitals(jitter(120,10),jitter(75,8),jitter(90,4),jitter(24,4),jitter(108,12),110,37.0);
      return {
        diagnosis:"Lungenembolie (PE)",
        story:"Plötzliche Dyspnoe, stechender Thoraxschmerz, Tachykardie; Thromboserisiko.",
        key_findings:["plötzlich Dyspnoe","Tachykardie","Risikofaktoren"],
        red_flags:["Synkope","Hypoxie"],
        target_outcome:"Monitoring, O2, Transport mit PE-Verdacht.",
        patient:{ name:"Herr D.", age:58, sex:"m" },
        anamnesis: mkAnam({ SAMPLER:{ S:"plötzliche Atemnot, Thoraxschmerz",
          A:"keine", M:"—", P:"TVT vor 1 Jahr", L:"—", E:"nach langer Autofahrt", R:"Rauchen, Immobilisation" } }),
        patho:{ tag:["vaskulär"], severity:2, hypoxia_sensitivity:2, baseline_deterioration:1 },
        hidden:{ vitals_baseline:v, pupils:"isokor", mouth:"trocken", lung:"evtl. verminderte Atemgeräusche rechts",
          abdomen:"weich", ekg3:`Sinus ${v.Puls}/min`, ekg12:"Sinus" }
      };
    };

    const int_genHypogly = () => {
      const v = vitals(jitter(130,10),jitter(80,8),jitter(97,2),jitter(18,3),jitter(88,8),jitter(40,5),36.6,13);
      return {
        diagnosis:"Hypoglykämie bei Typ-1-Diabetes",
        story:"Verwirrtheit, Schweiß, Zittern, ggf. Krampf.",
        key_findings:["niedriger BZ","Schweiß","Bewusstsein reduziert"],
        red_flags:["Krampfanfall","Aspiration"],
        target_outcome:"BZ anheben (NotSan), Monitoring, Transport.",
        patient:{ name:"Lena T.", age:21, sex:"w" },
        anamnesis: mkAnam({ SAMPLER:{ S:"Schwitzen, Zittern, Übelkeit",
          A:"keine", M:"Insulin", P:"T1D", L:"nicht gegessen", E:"Sport/Überdosierung?", R:"—" } }),
        patho:{ tag:["metabolisch"], severity:2, hypoxia_sensitivity:0, baseline_deterioration:1 },
        hidden:{ vitals_baseline:v, pupils:"isokor", mouth:"feucht",
          lung:"unauff.", abdomen:"weich", ekg3:`Sinus ${v.Puls}/min`, ekg12:"Sinus" }
      };
    };

    const int_genDKA = () => {
      const v = vitals(jitter(110,10),jitter(70,8),jitter(95,2),jitter(26,3),jitter(102,8),jitter(380,25),37.2,14);
      return {
        diagnosis:"Diabetische Ketoazidose",
        story:"19-jähriger Typ-1-Diabetiker mit Durst, Polyurie, Bauchschmerzen, Kussmaul-Atmung.",
        key_findings:["Kussmaul-Atmung","hoher BZ","Exsikkose"],
        red_flags:["Bewusstseinsminderung möglich"],
        target_outcome:"Monitoring, zügiger Transport.",
        patient:{ name:"Max M.", age:19, sex:"m" },
        anamnesis: mkAnam({
          SAMPLER:{ S:"Durst, Polyurie, Bauchschmerzen, tiefe Atmung",
            A:"Penicillin (Exanthem)", M:"Insulin basal/bolus – unregelmäßig",
            P:"T1D seit 8J", L:"gestern Abend", E:"seit 2 Tagen Infekt/Übelkeit", R:"Dehydratation" },
          OPQRST:{ O:"seit 24 h", P:"keine", Q:"diffuser Bauchschmerz, krampfartig",
            R:"diffus", S:"6/10", T:"progredient" },
          vorerkrankungen:["T1D"], medikation:["Insulin glargin","Insulin lispro"], allergien:["Penicillin"]
        }),
        patho:{ tag:["metabolisch","DKA"], severity:2, hypoxia_sensitivity:0, dehydration:2, baseline_deterioration:1 },
        hidden:{ vitals_baseline:v, pupils:"isokor", mouth:"Azetongeruch, trocken",
          lung:"tief, regelmäßig", abdomen:"diffus druckschmerzhaft",
          ekg3:`Sinus ${v.Puls}/min`, ekg12:"Sinus" }
      };
    };

    // … weitere internistische: Sepsis, Hypertensive Krise, Anaphylaxie, GI-Blutung (aus Platzgründen ausgelassen – wie zuvor aufgebaut) …

    // ===== NEUROLOGISCH (Auswahl) =====
    const neuro_genStrokeRight = () => {
      const v = vitals(jitter(160,12),jitter(95,8),jitter(96,2),jitter(18,3),jitter(84,6),110,36.8);
      return {
        diagnosis:"ischämischer Schlaganfall (rechtshemisphärisch)",
        story:"akute Hemiparese links, Fazialisparese, Sprachstörung.",
        key_findings:["BEFAST+","RR↑"],
        red_flags:["Zeitfenster!"],
        target_outcome:"FAST/BEFAST, Monitoring, Stroke-Unit.",
        patient:{ name:"Frau N.", age:74, sex:"w" },
        anamnesis: mkAnam({ SAMPLER:{ S:"Schwäche links, Sprachprobleme",
          P:"Hypertonie, Vorhofflimmern", M:"Marcumar?/NOAK", L:"—", E:"plötzlich", R:"Alter, HTN, VHF" } }),
        patho:{ tag:["neurologisch","ischämie"], severity:2, baseline_deterioration:1 },
        hidden:{ vitals_baseline:v, pupils:"isokor", lung:"unauff.",
          ekg3:`Vorhofflimmern ${v.Puls}/min`, ekg12:"VHF", befast:"positiv (links)", neuro:"Links-Arm/Bein schwach" }
      };
    };

    // … weitere neurologische/traumatologische Generatoren wie zuvor (gekürzt) …

    // ----- Pools -----
    const POOLS = {
      internistisch: [int_genACS, int_genPneumonia, int_genHF, int_genAsthmaCOPD, int_genPE, int_genHypogly, int_genDKA],
      neurologisch:  [neuro_genStrokeRight],
      trauma:        []
    };

    const pool    = (POOLS[normalized] && POOLS[normalized].length) ? POOLS[normalized] : POOLS.internistisch;
    const gen     = pick(pool);
    const scen    = gen();

    const caseData = {
      id: newId(),
      specialty: normalized,
      difficulty,
      role,
      story: scen.story,
      initial_vitals: null,
      key_findings: scen.key_findings,
      red_flags: scen.red_flags,
      target_outcome: scen.target_outcome,
      scope: SCOPE,
      steps_done: [],
      score: 0,
      hidden: scen.hidden,
      patient: scen.patient || null,
      anamnesis: scen.anamnesis || null,
      patho: scen.patho || null,
      solution: { diagnosis: scen.diagnosis, justification: scen.key_findings }
    };

    return { statusCode: 200, headers, body: JSON.stringify(caseData) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
