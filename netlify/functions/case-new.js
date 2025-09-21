// ================================================================
// medicIQ – Fallgenerator (case-new.js)
// 4 Fachrichtungen × 7 Fälle, konsistente Anamnese/Vitals/Hidden-Infos
// + Trauma-Modelle inkl. DMS, NEXUS, Spannungspneumothorax
// ================================================================
export async function handler(event) {
  // ----- CORS -----
  const ALLOWED_ORIGINS = [
    "https://www.mediciq.de",
    "https://mediciq.de",
    "https://mediciq.webflow.io"
  ];
  const reqOrigin = (event.headers && (event.headers.origin || event.headers.Origin)) || "";
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
    const body = event.body ? JSON.parse(event.body) : {};
    const specialty = (body.specialty || "internistisch").toString();
    const difficulty = (body.difficulty || "mittel").toString();
    const role = (body.role || "RS").toString();

    // ----- Helpers -----
    const newId  = () => "fall_" + Math.random().toString(36).slice(2, 8);
    const pick   = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const rint   = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
    const jitter = (base, d) => base + rint(-d, d);
    const vitals = (bpSys, bpDia, spo2, af, puls, bz, temp, gcs = 15) => ({
      RR: `${bpSys}/${bpDia}`, SpO2: spo2, AF: af, Puls: puls, BZ: bz, Temp: temp, GCS: gcs
    });

    // ----- Rollen-/Kompetenzrahmen -----
    const scopeRS = {
      role: "RS",
      allowed_actions: [
        "Eigenschutz/Umfeld sichern",
        "XABCDE-Assessment",
        "Monitoring: RR, SpO2, Puls, AF, BZ, Temp, GCS, Pupillen",
        "Atemwege: Esmarch, Absaugen, OPA (Guedel), NPA (Wendel), BVM",
        "EKG (3-/12-Kanal), BEFAST",
        "Lagerung (OKH, Sitz, SSL, Schocklage)",
        "Wärmeerhalt/Kühlung",
        "Sauerstoffgabe (bei Indikation)",
        "Blutstillung (Druckverband, Tourniquet, Hämostyptika)",
        "Beckenschlinge",
        "Immobilisation (Vakuummatratze/Spineboard/Halskrause/Schiene)",
        "DMS vor/nach Schienung",
        "NA nachfordern, Transport einleiten, Übergabe"
      ],
      disallowed_examples: ["i.v.-/i.o.-Zugang", "Entlastungspunktion", "Larynxtubus", "RSI/Intubation", "arztpflichtige Medikamente"]
    };
    const scopeNotSan = {
      role: "NotSan",
      allowed_actions: [...scopeRS.allowed_actions,
        "i.v.-/i.o.-Zugang (SOP)", "Volumentherapie (SOP)",
        "Larynxtubus (SOP)", "Entlastungspunktion (SOP)", "Glukosegabe (SOP)"],
      disallowed_examples: ["RSi/Narkose"]
    };
    const SCOPE = role === "NotSan" ? scopeNotSan : scopeRS;

    // ----- Specialty Map -----
    const MAP = {
      internistisch: "internistisch", internal: "internistisch", innere: "internistisch",
      medizinisch: "internistisch", "innere medizin": "internistisch",
      neurologisch: "neurologisch", neurologie: "neurologisch", neuro: "neurologisch",
      trauma: "trauma", traumatologie: "trauma", unfall: "trauma", unfallchirurgie: "trauma",
      paediatrisch: "paediatrisch", "pädiatrisch": "paediatrisch",
      paediatrie: "paediatrisch", "pädiatrie": "paediatrisch",
      kinder: "paediatrisch", pediatrisch: "paediatrisch", pediatric: "paediatrisch", child: "paediatrisch"
    };
    const normalized = MAP[specialty.trim().toLowerCase()] || "internistisch";

    // ----- Anamnese-Builder -----
    const mkAnam = (over = {}) => ({
      SAMPLER: {
        S: "", A: "keine bekannt", M: "keine", P: "keine Auffälligkeiten",
        L: "", E: "", R: ""
      , ...(over.SAMPLER || {}) },
      OPQRST:  { O: "", P: "", Q: "", R: "", S: "", T: "", ...(over.OPQRST || {}) },
      vorerkrankungen: over.vorerkrankungen || [],
      medikation     : over.medikation || [],
      allergien      : over.allergien || [],
      antikoagulation: !!over.antikoagulation,
      sozial         : over.sozial || {}
    });

    // =====================================================================================
    // INTERNISTISCH – 7 Fälle
    // =====================================================================================
    const int_dka = () => {
      const v = vitals(jitter(110,10),jitter(70,8),jitter(95,2),jitter(26,3),jitter(102,8),jitter(380,25),37.2,14);
      return {
        diagnosis:"Diabetische Ketoazidose",
        story:"19-jähriger Typ-1-Diabetiker mit Durst, Polyurie, Bauchschmerzen, Kussmaul-Atmung.",
        key_findings:["Kussmaul-Atmung","hoher BZ","Exsikkose"],
        red_flags:["Bewusstseinsminderung möglich"],
        target_outcome:"Monitoring, zügiger Transport.",
        patient:{ name:"Max M.", age:19, sex:"m" },
        anamnesis: mkAnam({
          SAMPLER:{ S:"Durst, Polyurie, Bauchschmerzen, tiefe Atmung", M:"Insulin basal/bolus – unregelmäßig", P:"T1D seit 8J", E:"seit 2 Tagen Infekt/Übelkeit", R:"Dehydratation" },
          OPQRST:{ O:"24 h", P:"keine", Q:"krampfartig/diffus", R:"diffus", S:"6/10", T:"progredient" }
        }),
        patho:{ tag:["metabolisch","DKA"], severity:2, dehydration:2, baseline_deterioration:1 },
        hidden:{ vitals_baseline:v, pupils:"isokor", mouth:"Azetongeruch, trocken", lung:"tief, regelmäßig", abdomen:"diffus druckschmerzhaft",
          ekg3:`Sinus ${v.Puls}/min`, ekg12:"Sinus" }
      };
    };

    const int_hypogly = () => {
      const v = vitals(jitter(130,10),jitter(80,8),jitter(97,2),jitter(18,3),jitter(88,8),jitter(40,5),36.6,13);
      return {
        diagnosis:"Hypoglykämie bei Typ-1-Diabetes",
        story:"Verwirrtheit, Schweiß, Zittern, ggf. Krampf.",
        key_findings:["niedriger BZ","Schweiß","Bewusstsein reduziert"],
        red_flags:["Krampfanfall","Aspiration"],
        target_outcome:"BZ anheben (NotSan), Monitoring, Transport.",
        patient:{ name:"Lena T.", age:21, sex:"w" },
        anamnesis: mkAnam({ SAMPLER:{ S:"Schwitzen, Zittern, Übelkeit", M:"Insulin", P:"T1D", L:"nicht gegessen", E:"Sport/Überdosierung?", R:"—" } }),
        patho:{ tag:["metabolisch"], severity:2, baseline_deterioration:1 },
        hidden:{ vitals_baseline:v, pupils:"isokor", mouth:"feucht", lung:"unauff.", abdomen:"weich", ekg3:`Sinus ${v.Puls}/min`, ekg12:"Sinus" }
      };
    };

    const int_ahf = () => {
      const v = vitals(jitter(135,12),jitter(85,8),jitter(90,4),jitter(24,4),jitter(108,10),jitter(120,10),36.9,15);
      return {
        diagnosis:"Akute kardiale Dekompensation",
        story:"Älterer Patient mit Orthopnoe, Beinödemen, nächtlicher Dyspnoe.",
        key_findings:["Orthopnoe","Rasselgeräusche basal","Ödeme"],
        red_flags:["Ruhedyspnoe","Hypoxie"],
        target_outcome:"Sitzlagerung, O₂ bei Indikation, Monitoring, zügiger Transport.",
        patient:{ name:"Herr B.", age:78, sex:"m" },
        anamnesis: mkAnam({ SAMPLER:{ S:"Atemnot in Ruhe, schaumiger Husten", M:"Diuretikum unregelmäßig", P:"Herzinsuffizienz, HTN", E:"seit heute Morgen schlechter", R:"Alter, Herzkrankheit" } }),
        patho:{ tag:["kardiovaskulär","stauung"], severity:2, hypoxia_sensitivity:2 },
        hidden:{ vitals_baseline:v, pupils:"isokor", mouth:"schaumig", lung:"basal feuchte RG beidseits", ekg3:`Sinus ${v.Puls}/min`, ekg12:"Sinus" }
      };
    };

    const int_pe = () => {
      const v = vitals(jitter(120,10),jitter(75,8),jitter(92,3),jitter(24,4),jitter(108,12),110,37.0,15);
      return {
        diagnosis:"Lungenembolie (PE)",
        story:"Plötzliche Dyspnoe, stechender Thoraxschmerz, Tachykardie; Thromboserisiko.",
        key_findings:["plötzlich Dyspnoe","Tachykardie","Risikofaktoren"],
        red_flags:["Synkope","Hypoxie"],
        target_outcome:"Monitoring, O₂, Transport mit PE-Verdacht.",
        patient:{ name:"Herr D.", age:58, sex:"m" },
        anamnesis: mkAnam({ SAMPLER:{ S:"plötzliche Atemnot, Thoraxschmerz", P:"TVT vor 1 Jahr", E:"lange Autofahrt", R:"Rauchen, Immobilisation" } }),
        patho:{ tag:["vaskulär"], severity:2, hypoxia_sensitivity:2, baseline_deterioration:1 },
        hidden:{ vitals_baseline:v, pupils:"isokor", mouth:"trocken", lung:"evtl. AG rechts vermindert", ekg3:`Sinus ${v.Puls}/min`, ekg12:"Sinus" }
      };
    };

    const int_copd = () => {
      const v = vitals(jitter(135,10),jitter(85,7),jitter(88,3),jitter(28,4),jitter(110,12),jitter(110,10),37.1,15);
      return {
        diagnosis:"COPD-Exazerbation",
        story:"Bekannter COPD-Patient mit Giemen und verlängertem Exspirium.",
        key_findings:["Giemen","verlängertes Exspirium","Dyspnoe"],
        red_flags:["Erschöpfung","Zyanose"],
        target_outcome:"Atemerleichternde Lagerung, O₂ vorsichtig titriert, Monitoring.",
        patient:{ name:"Herr S.", age:66, sex:"m" },
        anamnesis: mkAnam({ SAMPLER:{ S:"Atemnot, pfeifende Atmung", M:"SABA bei Bedarf", P:"COPD/Asthma", E:"Kälte/Infekt", R:"Raucher" } }),
        patho:{ tag:["obstruktiv"], severity:2, hypoxia_sensitivity:3, baseline_deterioration:1 },
        hidden:{ vitals_baseline:v, lung:"giemend, exspiratorisch", mouth:"—", ekg3:`Sinus ${v.Puls}/min`, ekg12:"Sinus" }
      };
    };

    const int_acs = () => {
      const v = vitals(jitter(150,12),jitter(90,8),jitter(95,2),jitter(20,3),jitter(96,8),110,36.9,15);
      return {
        diagnosis:"Akutes Koronarsyndrom (STEMI inferior möglich)",
        story:"Druck auf der Brust mit Ausstrahlung in linken Arm, Übelkeit, Schweiß.",
        key_findings:["typischer Thoraxschmerz","vegetative Symptome","Risikofaktoren"],
        red_flags:["Hypotonie/Arrhythmie möglich"],
        target_outcome:"Monitoring, 12-Kanal-EKG, zügiger Transport (PCI).",
        patient:{ name:"Peter A.", age:62, sex:"m" },
        anamnesis: mkAnam({ SAMPLER:{ S:"Druck retrosternal, Ausstrahlung linker Arm", P:"Hypertonie, Hyperlipidämie", R:"Alter, Raucher" } }),
        patho:{ tag:["kardiovaskulär"], severity:2, baseline_deterioration:1 },
        hidden:{ vitals_baseline:v, lung:"vesikulär", ekg12:"ST-Hebungen II/III/aVF", ekg3:`Sinus ${v.Puls}/min` }
      };
    };

    const int_sepsis_pna = () => {
      const v = vitals(jitter(105,10),jitter(65,8),jitter(92,3),jitter(26,4),jitter(120,12),110,39.1,15);
      return {
        diagnosis:"Pneumonie mit Sepsis",
        story:"Hohes Fieber, Schüttelfrost, Husten mit eitrigem Auswurf, Tachykardie.",
        key_findings:["Fieber","Tachykardie","fokale RG"],
        red_flags:["Hypotonie/Sepsis-Warnzeichen"],
        target_outcome:"Monitoring, O₂ nach Bedarf, zügiger Transport.",
        patient:{ name:"Frau R.", age:71, sex:"w" },
        anamnesis: mkAnam({ SAMPLER:{ S:"Husten, Fieber, Schüttelfrost", P:"COPD/Herzinsuffizienz?", E:"seit 2 Tagen schlechter" } }),
        patho:{ tag:["infekt","sepsis"], severity:2, hypoxia_sensitivity:2, baseline_deterioration:1 },
        hidden:{ vitals_baseline:v, lung:"rechts basal feuchte RG", ekg3:`Sinus ${v.Puls}/min`, ekg12:"Sinus" }
      };
    };

    // =====================================================================================
    // NEUROLOGISCH – 7 Fälle
    // =====================================================================================
    const neuro_stroke_left = () => {
      const v = vitals(jitter(160,12),jitter(92,8),jitter(96,2),jitter(18,3),jitter(86,6),110,36.7,14);
      return {
        diagnosis:"Ischämischer Schlaganfall (linkshemisphärisch)",
        story:"Aphasie, Hemiparese rechts, Blickdeviation nach links.",
        key_findings:["BEFAST positiv","Aphasie","Hemiparese rechts"],
        red_flags:["Zeitfenster!"],
        target_outcome:"Monitoring, Stroke-Unit.",
        patient:{ name:"Herr P.", age:69, sex:"m" },
        patho:{ tag:["neurologisch","ischämie"], severity:2 },
        hidden:{ vitals_baseline:v, befast:"positiv (rechts)", neuro:"Aphasie, Arm/Bein rechts schwach" }
      };
    };

    const neuro_stroke_right = () => {
      const v = vitals(jitter(165,12),jitter(95,8),jitter(96,2),jitter(18,3),jitter(84,6),110,36.8,14);
      return {
        diagnosis:"Ischämischer Schlaganfall (rechtshemisphärisch)",
        story:"Schwäche/Taubheit links, Fazialisparese links, verwaschene Sprache.",
        key_findings:["BEFAST positiv","fokale Ausfälle links","RR erhöht"],
        red_flags:["Zeitfenster!"],
        target_outcome:"Monitoring, Stroke-Unit.",
        patient:{ name:"Frau K.", age:73, sex:"w" },
        patho:{ tag:["neurologisch","ischämie"], severity:2 },
        hidden:{ vitals_baseline:v, befast:"positiv (links)", neuro:"Arm/Bein links schwach" }
      };
    };

    const neuro_posterior = () => {
      const v = vitals(jitter(155,12),jitter(90,8),jitter(96,2),jitter(20,3),jitter(88,6),110,36.8,15);
      return {
        diagnosis:"Hinterer Kreislauf – Kleinhirninfarkt",
        story:"Akuter Schwindel, Ataxie, Dysarthrie, Doppelbilder, Übelkeit.",
        key_findings:["BEFAST partiell","Ataxie","Nystagmus"],
        red_flags:["Atemwegsschutz bei Erbrechen"],
        target_outcome:"Monitoring, Stroke-Unit.",
        patient:{ name:"Herr R.", age:61, sex:"m" },
        patho:{ tag:["neurologisch"], severity:2 },
        hidden:{ vitals_baseline:v, befast:"verdächtig (Balance/Eyes)", neuro:"Ataxie, Nystagmus" }
      };
    };

    const neuro_tia = () => {
      const v = vitals(jitter(150,12),jitter(90,8),jitter(97,2),jitter(18,3),jitter(82,6),110,36.8,15);
      return {
        diagnosis:"TIA (transitorische ischämische Attacke)",
        story:"Kurzzeitige Sprach-/Sehstörung, jetzt rückläufig.",
        key_findings:["anamnestisch Ausfälle","jetzt grenzwertig"],
        red_flags:["Rezidiv"],
        target_outcome:"Monitoring, Stroke-Abklärung.",
        patient:{ name:"Frau S.", age:64, sex:"w" },
        patho:{ tag:["neurologisch"], severity:1 },
        hidden:{ vitals_baseline:v, befast:"vorhin positiv, jetzt grenzwertig", neuro:"nahezu unauffällig" }
      };
    };

    const neuro_ich = () => {
      const v = vitals(jitter(190,15),jitter(105,10),jitter(96,2),jitter(18,3),jitter(72,6),110,36.8,13);
      return {
        diagnosis:"Intrazerebrale Blutung",
        story:"Plötzliche Hemiparese, Vigilanz↓, sehr hoher RR.",
        key_findings:["fokale Defizite","RR stark erhöht","GCS↓"],
        red_flags:["AIRWAY/ASPIRATION","rasche Verschlechterung"],
        target_outcome:"Monitoring, Transport in Stroke-Center.",
        patient:{ name:"Herr L.", age:76, sex:"m" },
        patho:{ tag:["neurologisch","blutung"], severity:3 },
        hidden:{ vitals_baseline:v, befast:"positiv", neuro:"Hemiparese, GCS 13" }
      };
    };

    const neuro_sah = () => {
      const v = vitals(jitter(160,12),jitter(92,8),jitter(97,2),jitter(22,3),jitter(96,6),110,36.8,14);
      return {
        diagnosis:"Subarachnoidalblutung (SAB)",
        story:"Vernichtungskopfschmerz, Übelkeit/Erbrechen, Nackensteifigkeit.",
        key_findings:["plötzlicher starker Kopfschmerz","Meningismus"],
        red_flags:["Bewusstseinsminderung","Erbrechen"],
        target_outcome:"Monitoring, Analgesie ärztlich, Transport mit Eile.",
        patient:{ name:"Frau E.", age:54, sex:"w" },
        patho:{ tag:["neurologisch","blutung"], severity:2 },
        hidden:{ vitals_baseline:v, neuro:"Meningismus, Photophobie" }
      };
    };

    const neuro_postictal = () => {
      const v = vitals(jitter(140,12),jitter(85,8),jitter(97,2),jitter(20,3),jitter(98,8),110,37.2,13);
      return {
        diagnosis:"Postiktaler Zustand nach generalisiertem Krampfanfall",
        story:"Zeuge berichtet Krampf (~2 min), jetzt somnolent, Schutzreflexe vorhanden.",
        key_findings:["Zungenbiss?","postiktal","GCS↓"],
        red_flags:["Status epilepticus","Aspiration"],
        target_outcome:"Basisschutz, Seitenlage nach Bedarf, Monitoring.",
        patient:{ name:"Frau J.", age:33, sex:"w" },
        patho:{ tag:["neurologisch"], severity:1 },
        hidden:{ vitals_baseline:v, mouth:"seitlicher Zungenbiss?", lung:"schnarchend", neuro:"postiktal, langsam orientiert" }
      };
    };

    // =====================================================================================
    // TRAUMA – 7 Fälle (DMS, NEXUS, Spannungspneumothorax)
    // =====================================================================================
    const tr_motorbike = () => {
      const v = vitals(125,80,97,22,108,110,36.8,15);
      const fx = { kind:"fracture", location:"Unterschenkel links", open:true, deformity:true, immobilized:false,
                   dms:{ perfusion:"schwach", motor:true, sensory:true } };
      const bl = { kind:"bleeding", location:"Unterarm rechts", vessel:"arteriell", severity:2, external:true, controlled:false };
      return {
        diagnosis:"Motorradsturz – offene Unterschenkelfraktur links, arterielle Blutung Unterarm rechts",
        story:"Motorradfahrer gestürzt, starke Schmerzen LUS, blutende Wunde UA rechts.",
        key_findings:["äußere Blutung","Deformität Unterschenkel links"],
        red_flags:["anhaltende Blutung → Schock"],
        target_outcome:"Blutstillung, Immobilisation, Monitoring.",
        patient:{ name:"Tom H.", age:32, sex:"m" },
        patho:{ tag:["trauma"], severity:2, baseline_deterioration:1 },
        hidden:{
          vitals_baseline:v,
          injuries:[ bl, fx ],
          spine:{ nexus:{ midlineTenderness:false, neuroDeficit:false, altered:false, intox:false, distracting:true } }
        }
      };
    };

    const tr_fall_pelvis = () => {
      const v = vitals(120,78,96,24,112,110,36.9,15);
      const pel = { kind:"pelvis", location:"Becken", unstable:true, binder_applied:false, bleeding_severity:2 };
      return {
        diagnosis:"Sturz aus 4 m – instabiles Becken, Verdacht innere Blutung",
        story:"Sturz von Gerüst, Becken-/Unterbauchschmerz, Hämatom suprapubisch.",
        key_findings:["Becken instabil?","Tachykardie"],
        red_flags:["innere Blutung → Schock"],
        target_outcome:"Beckenschlinge, rascher Transport, Monitoring.",
        patient:{ name:"Karl N.", age:45, sex:"m" },
        patho:{ tag:["trauma"], severity:3, baseline_deterioration:2 },
        hidden:{
          vitals_baseline:v,
          injuries:[ pel ],
          spine:{ nexus:{ midlineTenderness:false, neuroDeficit:false, altered:false, intox:false, distracting:true } }
        }
      };
    };

    const tr_saw_thigh = () => {
      const v = vitals(118,75,96,22,110,110,36.8,15);
      const bl = { kind:"bleeding", location:"Oberschenkel links", vessel:"arteriell", severity:3, external:true, controlled:false };
      const fx = { kind:"fracture", location:"Unterarm links", open:false, deformity:false, immobilized:false,
                   dms:{ perfusion:"gut", motor:true, sensory:true } };
      return {
        diagnosis:"Schnittverletzung Oberschenkel links – starke Blutung",
        story:"Arbeitsunfall mit Kreissäge; tiefe Schnittwunde OS links, spritzende Blutung.",
        key_findings:["starke Extremitätenblutung"],
        red_flags:["anhaltende Blutung → Tourniquet erwägen"],
        target_outcome:"Blutstillung (Druckverband/TQ), Immobilisation, Monitoring.",
        patient:{ name:"Milan F.", age:39, sex:"m" },
        patho:{ tag:["trauma"], severity:3, baseline_deterioration:2 },
        hidden:{
          vitals_baseline:v,
          injuries:[ bl, fx ],
          spine:{ nexus:{ midlineTenderness:false, neuroDeficit:false, altered:false, intox:false, distracting:false } }
        }
      };
    };

    const tr_tension_pnx = () => {
      const v = vitals(110,70,90,30,118,110,36.9,15);
      const pnx = { kind:"pneumothorax", side:"links", tension:true, severity:2 };
      return {
        diagnosis:"Spannungspneumothorax links",
        story:"Stumpfes Thoraxtrauma, plötzliche Dyspnoe, einseitig abgeschwächtes Atemgeräusch.",
        key_findings:["einseitig leise","Hypoxie","Tachypnoe/-kardie"],
        red_flags:["rasch lebensbedrohlich"],
        target_outcome:"O₂, Monitoring, (NotSan) Entlastungspunktion.",
        patient:{ name:"Sven Y.", age:27, sex:"m" },
        patho:{ tag:["trauma","obstruktiv"], severity:3, hypoxia_sensitivity:3, baseline_deterioration:2 },
        hidden:{ vitals_baseline:v, injuries:[ pnx ], lung:"links deutlich abgeschwächtes AG" }
      };
    };

    const tr_head_cspine = () => {
      const v = vitals(135,85,97,18,92,110,36.7,14);
      return {
        diagnosis:"Sturz auf Kopf – Commotio, HWS-Gefährdung",
        story:"Sturz von Leiter, kurz benommen, Nackenschmerz mittig.",
        key_findings:["GCS 14","HWS-Schmerz Mittellinie"],
        red_flags:["Erbrechen, Vigilanzänderung"],
        target_outcome:"HWS sichern (NEXUS), Monitoring, Transport.",
        patient:{ name:"Alina W.", age:51, sex:"w" },
        patho:{ tag:["trauma"], severity:2, baseline_deterioration:0 },
        hidden:{ vitals_baseline:v, spine:{ nexus:{ midlineTenderness:true, neuroDeficit:false, altered:true, intox:false, distracting:false } } }
      };
    };

    const tr_ankle_dislocation = () => {
      const v = vitals(128,78,98,18,96,110,36.8,15);
      const fx = { kind:"fracture", location:"Sprunggelenk rechts (Luxationsfraktur)", open:false, deformity:true, immobilized:false,
                   dms:{ perfusion:"keine", motor:false, sensory:false } };
      return {
        diagnosis:"Luxationsfraktur OSG rechts",
        story:"Umknicken beim Sport; Fehlstellung, starke Schmerzen, Fuß kalt/blass.",
        key_findings:["deutliche Fehlstellung","DMS distal aufgehoben"],
        red_flags:["Ischämie distal"],
        target_outcome:"Schienung/Immobilisation, DMS vor/nach.",
        patient:{ name:"Nora E.", age:29, sex:"w" },
        patho:{ tag:["trauma"], severity:2, baseline_deterioration:1 },
        hidden:{ vitals_baseline:v, injuries:[ fx ] }
      };
    };

    const tr_forearm_venous = () => {
      const v = vitals(122,76,98,18,92,110,36.7,15);
      const bl = { kind:"bleeding", location:"Unterarm links (Rissverletzung)", vessel:"venös", severity:2, external:true, controlled:false };
      return {
        diagnosis:"Rissverletzung UA links – venöse Blutung",
        story:"Scherbe beim Putzen; Blutung mäßig, nicht spritzend.",
        key_findings:["äußere Blutung venös"],
        red_flags:["weiter blutend → Volumenverlust"],
        target_outcome:"Druckverband/Hämostyptikum, Kontrolle, Monitoring.",
        patient:{ name:"Klara Z.", age:41, sex:"w" },
        patho:{ tag:["trauma"], severity:1, baseline_deterioration:0 },
        hidden:{ vitals_baseline:v, injuries:[ bl ] }
      };
    };

    // =====================================================================================
    // PÄDIATRISCH – 7 Fälle
    // =====================================================================================
    const ped_asthma = () => {
      const v = vitals(110,70,92,32,118,100,37.6,15);
      return {
        diagnosis:"Asthma-Exazerbation (Kind)",
        story:"8-jähriges Kind mit pfeifender Atmung, Atemnot nach Infekt.",
        key_findings:["Giemen","verlängertes Exspirium","Einziehungen"],
        red_flags:["Erschöpfung","Zyanose"],
        target_outcome:"Atemerleichterung, O₂ vorsichtig, Monitoring.",
        patient:{ name:"Jonas K.", age:8, sex:"m" },
        patho:{ tag:["pädiatrisch","obstruktiv"], severity:2, hypoxia_sensitivity:3 },
        hidden:{ vitals_baseline:v, lung:"giemend, exspiratorisch" }
      };
    };

    const ped_croup = () => {
      const v = vitals(105,65,93,30,124,100,38.6,15);
      return {
        diagnosis:"Pseudokrupp",
        story:"Bellender Husten, inspiratorischer Stridor nachts, 3 Jahre.",
        key_findings:["Stridor","Heiserkeit"],
        red_flags:["Erschöpfung","Zyanose"],
        target_outcome:"Ruhigstellung, kühle Luft, O₂ nach Bedarf, Transport.",
        patient:{ name:"Mira P.", age:3, sex:"w" },
        patho:{ tag:["pädiatrisch","obstruktiv"], severity:2, hypoxia_sensitivity:3 },
        hidden:{ vitals_baseline:v, lung:"inspiratorischer Stridor" }
      };
    };

    const ped_febrile_seizure = () => {
      const v = vitals(105,65,97,24,110,110,39.4,14);
      return {
        diagnosis:"Fieberkrampf",
        story:"2-jähriges Kind, kurzer generalisierter Krampfanfall, jetzt schläfrig.",
        key_findings:["Fieber","postiktal"],
        red_flags:["langer Anfall","Aspiration"],
        target_outcome:"Schutz, SSL bei Bedarf, Monitoring.",
        patient:{ name:"Luca S.", age:2, sex:"m" },
        patho:{ tag:["pädiatrisch","neurologisch"], severity:1 },
        hidden:{ vitals_baseline:v, mouth:"Zungenbiss?", lung:"schnarchend" }
      };
    };

    const ped_gastro_dehyd = () => {
      const v = vitals(95,60,97,26,130,90,38.2,15);
      return {
        diagnosis:"Gastroenteritis mit Dehydratation",
        story:"4-jähriges Kind mit Erbrechen/Durchfall, wenig getrunken.",
        key_findings:["trockene Schleimhäute","stehende Hautfalte"],
        red_flags:["Apathie","Schock"],
        target_outcome:"Wärmeerhalt, Monitoring, Transport.",
        patient:{ name:"Elif T.", age:4, sex:"w" },
        patho:{ tag:["pädiatrisch","dehydratation"], severity:2 },
        hidden:{ vitals_baseline:v, mouth:"trocken", abdomen:"weich" }
      };
    };

    const ped_bronchiolitis = () => {
      const v = vitals(100,60,92,38,140,100,37.9,15);
      return {
        diagnosis:"RSV-Bronchiolitis (Säugling)",
        story:"8 Monate, Trinkschwäche, Tachypnoe, Einziehungen.",
        key_findings:["Tachypnoe","Giemen/Knistern","Einziehungen"],
        red_flags:["Apnoe","Hypoxie"],
        target_outcome:"Monitoring, O₂ vorsichtig, Transport.",
        patient:{ name:"Baby A.", age:0.7, sex:"m" },
        patho:{ tag:["pädiatrisch","obstruktiv"], severity:2, hypoxia_sensitivity:3 },
        hidden:{ vitals_baseline:v, lung:"beidseits feinblasige RG" }
      };
    };

    const ped_anaphylaxis = () => {
      const v = vitals(95,55,92,30,140,110,37.5,15);
      return {
        diagnosis:"Anaphylaxie (Kind, leicht–mittel)",
        story:"Erdnusskontakt; Urtikaria, Husten, Dyspnoe.",
        key_findings:["Urtikaria","Atembeschwerden"],
        red_flags:["Hypotonie/Atemwegsödem"],
        target_outcome:"Lagerung, O₂, zügiger Transport (Medikation ärztl./SOP).",
        patient:{ name:"Maya L.", age:6, sex:"w" },
        patho:{ tag:["pädiatrisch","allergisch"], severity:2 },
        hidden:{ vitals_baseline:v, mouth:"Schwellung Lippen leicht", lung:"Giemen" }
      };
    };

    const ped_hypogly = () => {
      const v = vitals(100,60,98,22,110,45,36.3,14);
      return {
        diagnosis:"Hypoglykämie (Kleinkind, Nüchternheit)",
        story:"Müde, blass, reizbar; wenig gegessen.",
        key_findings:["niedriger BZ","blass","müde"],
        red_flags:["Krampfanfall möglich"],
        target_outcome:"BZ anheben (NotSan), Monitoring, Transport.",
        patient:{ name:"Paul R.", age:3, sex:"m" },
        patho:{ tag:["pädiatrisch","metabolisch"], severity:1 },
        hidden:{ vitals_baseline:v }
      };
    };

    // ----- Pools -----
    const POOLS = {
      internistisch: [int_dka, int_hypogly, int_ahf, int_pe, int_copd, int_acs, int_sepsis_pna],
      neurologisch : [neuro_stroke_left, neuro_stroke_right, neuro_posterior, neuro_tia, neuro_ich, neuro_sah, neuro_postictal],
      trauma       : [tr_motorbike, tr_fall_pelvis, tr_saw_thigh, tr_tension_pnx, tr_head_cspine, tr_ankle_dislocation, tr_forearm_venous],
      paediatrisch : [ped_asthma, ped_croup, ped_febrile_seizure, ped_gastro_dehyd, ped_bronchiolitis, ped_anaphylaxis, ped_hypogly]
    };

    const generator = pick(POOLS[normalized]);
    const chosen = generator();

    const caseData = {
      id: newId(),
      specialty: normalized,
      difficulty: difficulty,
      role: role,
      story: chosen.story,
      initial_vitals: null,
      key_findings: chosen.key_findings,
      red_flags: chosen.red_flags,
      target_outcome: chosen.target_outcome,
      scope: SCOPE,
      steps_done: [],
      score: 0,
      hidden: chosen.hidden,
      patient: chosen.patient || null,
      anamnesis: chosen.anamnesis || null,
      patho: chosen.patho || null,
      solution: { diagnosis: chosen.diagnosis, justification: chosen.key_findings }
    };

    return { statusCode: 200, headers, body: JSON.stringify(caseData) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
