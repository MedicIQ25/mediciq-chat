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
      disallowed_examples: ["i.v.-Zugang", "RSI/Intubation", "arztpflichtige Medikamente"]
    };
    const scopeNotSan = {
      role: "NotSan",
      allowed_actions: [...scopeRS.allowed_actions, "i.v.-Zugang (SOP)", "erweiterte Maßnahmen (SOP)"],
      disallowed_examples: ["RSI/Narkose"]
    };
    const SCOPE = role === "NotSan" ? scopeNotSan : scopeRS;

    // ----- Specialty Map (robust) -----
    const MAP = {
      // Internistisch
      internistisch: "internistisch", internal: "internistisch", innere: "internistisch",
      medizinisch: "internistisch", "innere medizin": "internistisch",
      // Neurologisch
      neurologisch: "neurologisch", neurologie: "neurologisch",
      // Trauma
      trauma: "trauma", traumatologie: "trauma", unfall: "trauma", unfallchirurgie: "trauma",
      // Pädiatrisch
      paediatrisch: "paediatrisch", "pädiatrisch": "paediatrisch",
      paediatrie: "paediatrisch", "pädiatrie": "paediatrisch",
      kinder: "paediatrisch", kinderheilkunde: "paediatrisch",
      pediatrisch: "paediatrisch", pediatric: "paediatrisch", child: "paediatrisch"
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

    // ===== INTERNISTISCH =====
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
          A:"keine", M:"—", P:"TVT vor 1 Jahr", L:"—", E:"lange Autofahrt", R:"Rauchen, Immobilisation" } }),
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

    // ===== TRAUMA =====
    const tr_genSpineTrauma = () => {
      const v = vitals(jitter(125,12),jitter(80,8),98,22,108,110,36.8,15);
      return {
        diagnosis:"Wirbelsäulentrauma (BWS/LWS)",
        story:"Sturz vom Pferd, Rückenschmerz, DMS erhalten.",
        key_findings:["Rückenschmerz","DMS prüfen"],
        red_flags:["neurologische Ausfälle","starke Schmerzen"],
        target_outcome:"Immobilisation nach Standard, DMS, Monitoring.",
        patient:{ name:"Manuela D.", age:25, sex:"w" },
        anamnesis: mkAnam({ SAMPLER:{ S:"Rückenschmerz mit Ausstrahlung in Beine", A:"keine", M:"keine", P:"-", L:"Frühstück", E:"vom Pferd gestürzt", R:"-" },
                             OPQRST:{ O:"vor 10 min", P:"Bewegung verstärkt", Q:"dumpf", R:"BWS/LWS", S:"4 in Ruhe / 7 bei Bewegung", T:"gleichbleibend" } }),
        patho:{ tag:["trauma"], severity:2, baseline_deterioration:0 },
        hidden:{ vitals_baseline:v, neuro:"DMS Beine o.B." }
      };
    };

    const tr_genRibFractures = () => {
      const v=vitals(jitter(130,10),jitter(80,8),96,22,105,110,36.9);
      return {
        diagnosis:"Rippenfrakturen",
        story:"Stumpfes Thoraxtrauma, atemabhängiger Schmerz.",
        key_findings:["lokaler Druckschmerz","Schonatmung"],
        red_flags:["Pneumothorax?"],
        target_outcome:"Schmerzreduktion (Kälte), Monitoring.",
        patient:{ name:"—", age:45, sex:"m" },
        anamnesis: mkAnam({ OPQRST:{ O:"seit 30 min", P:"Atem/Bewegung", Q:"stechend", R:"rechts lateral", S:"6/10", T:"gleichbleibend" } }),
        patho:{ tag:["trauma"], severity:1, baseline_deterioration:0 },
        hidden:{ vitals_baseline:v, lung:"rechts atemabhängiger Druckschmerz" }
      };
    };

    const tr_genPneumothorax = () => {
      const v=vitals(jitter(120,10),jitter(75,8),92,26,110,110,36.8);
      return {
        diagnosis:"(Spannungs-)Pneumothorax?",
        story:"Stumpfes Thoraxtrauma, plötzliche Dyspnoe, einseitig abgeschwächtes AG.",
        key_findings:["einseitig leiser","Hypoxie"],
        red_flags:["Verschlechterung → NA"],
        target_outcome:"O2, Monitoring, NA.",
        patho:{ tag:["trauma","obstruktiv"], severity:3, hypoxia_sensitivity:3, baseline_deterioration:2 },
        hidden:{ vitals_baseline:v, lung:"links abgeschwächt", ekg3:`Sinus ${v.Puls}/min` }
      };
    };

    // ===== PÄDIATRISCH =====
    const ped_genAsthma = () => {
      const v=vitals(110,70,92,32,118,100,37.6,15);
      return {
        diagnosis:"Asthma-Exazerbation (Kind)",
        story:"8-jähriges Kind mit pfeifender Atmung, Atemnot nach Infekt.",
        key_findings:["Giemen","verlängertes Exspirium","Einziehungen"],
        red_flags:["Erschöpfung","Zyanose"],
        target_outcome:"Atemerleichterung, O2 vorsichtig, Monitoring.",
        patient:{ name:"Ben", age:8, sex:"m" },
        anamnesis: mkAnam({ SAMPLER:{ S:"Atemnot, Giemen", A:"keine", M:"SABA Spray", P:"Asthma", L:"—", E:"Infekt", R:"—" } }),
        patho:{ tag:["obstruktiv","pädiatrisch"], severity:2, hypoxia_sensitivity:3, baseline_deterioration:1 },
        hidden:{ vitals_baseline:v, lung:"giemend, exspiratorisch", mouth:"—" }
      };
    };

    const ped_genFieberkrampf = () => {
      const v=vitals(105,65,97,24,110,110,39.4,14);
      return {
        diagnosis:"Fieberkrampf (Kind)",
        story:"2-jähriges Kind, kurzer generalisierter Krampfanfall, jetzt schläfrig.",
        key_findings:["Fieber","postiktal"],
        red_flags:["langer Anfall","Aspiration"],
        target_outcome:"Schutz, Seitenlage bei Bedarf, Monitoring.",
        patient:{ name:"Mia", age:2, sex:"w" },
        anamnesis: mkAnam({ SAMPLER:{ S:"Krampf ~1–2 min, jetzt müde", A:"—", M:"—", P:"—", L:"—", E:"seit heute Fieber", R:"—" } }),
        patho:{ tag:["neurologisch","pädiatrisch"], severity:1, baseline_deterioration:0 },
        hidden:{ vitals_baseline:v, mouth:"Zungenbiss?", lung:"schnarchend", befast:"—" }
      };
    };

    const ped_genGastroDehyd = () => {
      const v=vitals(95,60,97,26,130,90,38.2);
      return {
        diagnosis:"Gastroenteritis mit Dehydratation (Kind)",
        story:"4-jähriges Kind mit Erbrechen/Durchfall, wenig getrunken.",
        key_findings:["trockene Schleimhäute","stehende Hautfalte"],
        red_flags:["Apathie","Schock"],
        target_outcome:"Wärmeerhalt, Monitoring, zügiger Transport.",
        patient:{ name:"Luca", age:4, sex:"m" },
        anamnesis: mkAnam({ SAMPLER:{ S:"Erbrechen/Durchfall, kaum Trinkmenge", A:"—", M:"—", P:"—", L:"—", E:"seit 1–2 Tagen", R:"—" } }),
        patho:{ tag:["pädiatrisch","dehydratation"], severity:2, baseline_deterioration:1 },
        hidden:{ vitals_baseline:v, mouth:"trocken", abdomen:"weich" }
      };
    };

    // ----- Pools -----
    const POOLS = {
      internistisch: [int_genACS, int_genHF, int_genPE, int_genHypogly, int_genDKA],
      neurologisch:  [],            // (bei Bedarf ergänzen)
      trauma:        [tr_genSpineTrauma, tr_genRibFractures, tr_genPneumothorax],
      paediatrisch:  [ped_genAsthma, ped_genFieberkrampf, ped_genGastroDehyd]
    };

    const pool    = (POOLS[normalized] && POOLS[normalized].length) ? POOLS[normalized] : POOLS.internistisch;
    const scen    = pick(pool)();

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
