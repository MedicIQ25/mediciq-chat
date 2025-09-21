// netlify/functions/case-new.js
export async function handler(event) {
  // ===== 1) CORS =====
  const ALLOWED_ORIGINS = [
    'https://www.mediciq.de',
    'https://mediciq.de',
    'https://mediciq.webflow.io'
  ];
  const reqOrigin   = event.headers.origin || event.headers.Origin || '';
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

    // ===== 2) Helpers =====
    const newId   = () => 'fall_' + Math.random().toString(36).slice(2, 6);
    const randPick= (arr) => arr[Math.floor(Math.random() * arr.length)];
    const randInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
    const jitter  = (base, d) => base + randInt(-d, d);

    // Vitalwerte-Helfer
    const vitals = (bpSys, bpDia, spo2, af, puls, bz, temp, gcs = 15) => ({
      RR: `${bpSys}/${bpDia}`, SpO2: spo2, AF: af, Puls: puls, BZ: bz, Temp: temp, GCS: gcs
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

    // ===== 4) Specialty-Normalisierung =====
    const SPECIALTY_MAP = {
      // Internistisch
      'internistisch': 'internistisch', 'internal': 'internistisch', 'innere': 'internistisch', 'medizinisch': 'internistisch', 'innere medizin': 'internistisch',
      // Neurologisch
      'neurologisch': 'neurologisch', 'neurologie': 'neurologisch',
      // Trauma (derzeit leerer Pool)
      'trauma': 'trauma', 'traumatologie': 'trauma', 'unfall': 'trauma', 'unfallchirurgie': 'trauma',
      // Pädiatrisch
      'paediatrisch': 'paediatrisch', 'pädiatrisch': 'paediatrisch', 'kinder': 'paediatrisch', 'kinderheilkunde': 'paediatrisch', 'pediatrisch': 'paediatrisch', 'pediatrics': 'paediatrisch'
    };
    const raw        = (specialty || '').toString().trim().toLowerCase();
    const normalized = SPECIALTY_MAP[raw] || 'internistisch';

    // ===== 5) Szenario-Generatoren =====
    // --- INTERNISTISCH (10) ---
    const int_genACS = () => {
      const bpS=jitter(150,10), bpD=jitter(95,8), spo2=jitter(94,2), af=jitter(20,3), puls=jitter(98,8), bz=jitter(110,15), temp=37.2;
      const side=randPick(['linken','rechten']);
      return {
        diagnosis: "Akutes Koronarsyndrom (ACS, STEMI möglich)",
        story: `65-jähriger Mann mit akuten, drückenden Brustschmerzen, Ausstrahlung in den ${side} Arm, Atemnot. HTN, DM.`,
        key_findings: ["drückender Thoraxschmerz","Dyspnoe","Risikofaktoren"],
        red_flags: ["Thoraxschmerz >15 min","vegetative Begleitsymptome"],
        target_outcome: "Monitoring, 12-Kanal-EKG, ACS-Transport.",
        hidden: {
          vitals_baseline: vitals(bpS,bpD,spo2,af,puls,bz,temp),
          pupils:"isokor, prompt", mouth:"rosige Schleimhäute, frei",
          lung:"seitengleich, evtl. Tachypnoe", abdomen:"weich",
          ekg3:`Sinus ${puls}/min`, ekg12: randPick(["STEMI anteroseptal","NSTEMI-Zeichen"]),
          befast:null, neuro:null
        }
      };
    };
    const int_genPneumonia = () => {
      const bpS=jitter(130,10), bpD=jitter(80,8), spo2=jitter(91,3), af=jitter(24,4), puls=jitter(105,10), bz=jitter(120,10), temp=38.5;
      return {
        diagnosis:"Pneumonie mit Hypoxie",
        story:"72-jährige Patientin mit Husten, Fieber, zunehmender Atemnot seit 2 Tagen.",
        key_findings:["Fieber","basale feuchte RG","Hypoxie"],
        red_flags:["Tachypnoe + Hypoxie"],
        target_outcome:"O2 nach Indikation, Monitoring, Klinik.",
        hidden:{
          vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp),
          pupils:"isokor", mouth:"mukopurulentes Sekret", lung:"basal feuchte RG rechts > links",
          abdomen:"weich", ekg3:`Sinus ${puls}/min`, ekg12:"Sinus, keine Hebungen", befast:null, neuro:null
        }
      };
    };
    const int_genHF = () => {
      const bpS=jitter(160,15), bpD=jitter(100,10), spo2=jitter(92,3), af=jitter(22,3), puls=jitter(95,8), bz=jitter(130,15), temp=36.8;
      return {
        diagnosis:"Akute kardiale Dekompensation",
        story:"78-jähriger Patient mit Orthopnoe, nächtlicher Dyspnoe, Knöchelödemen.",
        key_findings:["Orthopnoe","Ödeme","basale RG"],
        red_flags:["Dyspnoe + Hypertonie"],
        target_outcome:"Sitzend lagern, Monitoring, 12-Kanal-EKG, Transport.",
        hidden:{
          vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp),
          pupils:"isokor", mouth:"schaumig möglich", lung:"beidseits basale RG", abdomen:"weich",
          ekg3:`Sinus ${puls}/min`, ekg12:"unspezifische ST/T", befast:null, neuro:null
        }
      };
    };
    const int_genAsthmaCOPD = () => {
      const bpS=jitter(140,10), bpD=jitter(85,10), spo2=jitter(90,3), af=jitter(26,5), puls=jitter(110,12), bz=jitter(120,10), temp=37.1;
      return {
        diagnosis:"Exazerbation Asthma/COPD",
        story:"60-jähriger Raucher mit zunehmender exspiratorischer Atemnot.",
        key_findings:["verlängertes Exspirium","Giemen/Pfeifen","Hypoxie"],
        red_flags:["Erschöpfung droht"],
        target_outcome:"O2 nach Indikation, Monitoring, Transport.",
        hidden:{
          vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp),
          pupils:"isokor", mouth:"trocken", lung:"diffuses Giemen, verlängertes Exspirium",
          abdomen:"weich", ekg3:`Sinus ${puls}/min`, ekg12:"Sinus", befast:null, neuro:null
        }
      };
    };
    const int_genPE = () => {
      const bpS=jitter(135,10), bpD=jitter(85,10), spo2=jitter(90,4), af=jitter(24,5), puls=jitter(110,12), bz=jitter(115,10), temp=37.0;
      return {
        diagnosis:"Lungenembolie (PE)",
        story:"45-jährige Patientin nach Immobilisation mit plötzlicher Dyspnoe, stechenden Thoraxschmerzen.",
        key_findings:["plötzliche Dyspnoe","Tachykardie","Hypoxie"],
        red_flags:["Immobilisation"],
        target_outcome:"Monitoring, O2, Transport in Klinik.",
        hidden:{
          vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp),
          pupils:"isokor", mouth:"trocken", lung:"oft unauffällig",
          abdomen:"weich", ekg3:`Sinus ${puls}/min`, ekg12:"evtl. S1Q3T3", befast:null, neuro:null
        }
      };
    };
    const int_genHypogly = () => {
      const bpS=jitter(125,10), bpD=jitter(80,8), spo2=jitter(96,2), af=jitter(14,2), puls=jitter(90,8), bz=jitter(45,5), temp=36.7;
      return {
        diagnosis:"Hypoglykämie",
        story:"54-jähriger Diabetiker blass, schwitzig, verwirrt.",
        key_findings:["Schwitzen","Verwirrtheit","niedriger BZ"],
        red_flags:["Bewusstseinsstörung möglich"],
        target_outcome:"BZ messen, Monitoring, ggf. Therapie, Transport.",
        hidden:{
          vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp),
          pupils:"isokor", mouth:"unauffällig", lung:"unauffällig",
          abdomen:"weich", ekg3:`Sinus ${puls}/min`, ekg12:"Sinus", befast:null, neuro:null
        }
      };
    };
    const int_genDKA = () => {
      const bpS=jitter(120,10), bpD=jitter(75,8), spo2=jitter(96,2), af=jitter(28,4), puls=jitter(105,10), bz=jitter(420,40), temp=37.0;
      return {
        diagnosis:"Diabetische Ketoazidose",
        story:"19-jähriger Typ-1-Diabetiker mit Durst, Polyurie, Bauchschmerzen, tiefer Atmung.",
        key_findings:["Kussmaul-Atmung","hoher BZ","Dehydratation"],
        red_flags:["Bewusstseinsminderung möglich"],
        target_outcome:"Monitoring, zügiger Transport.",
        hidden:{
          vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp),
          pupils:"isokor", mouth:"Azetongeruch, trocken", lung:"tief, regelmäßig",
          abdomen:"diffus druckschmerzhaft", ekg3:`Sinus ${puls}/min`, ekg12:"Sinus", befast:null, neuro:null
        }
      };
    };
    const int_genSepsisUrosepsis = () => {
      const bpS=jitter(100,10), bpD=jitter(60,8), spo2=jitter(95,2), af=jitter(24,4), puls=jitter(110,12), bz=jitter(130,10), temp=39.1;
      return {
        diagnosis:"Sepsis (Urosepsis wahrscheinlich)",
        story:"82-jährige Patientin febril, verwirrt, Hypotonie, Flankenschmerz.",
        key_findings:["Fieber","Hypotonie","Tachykardie","AF↑"],
        red_flags:["Schockgefahr"],
        target_outcome:"Schockraum/Klinik, Monitoring.",
        hidden:{
          vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp,14),
          pupils:"isokor", mouth:"trocken", lung:"evtl. tachypnoisch",
          abdomen:"Flankendruckschmerz", ekg3:`Sinus ${puls}/min`, ekg12:"Sinus", befast:null, neuro:"leicht desorientiert"
        }
      };
    };
    const int_genHypertensiveCrisis = () => {
      const bpS=jitter(220,15), bpD=jitter(120,10), spo2=jitter(97,1), af=jitter(18,2), puls=jitter(90,8), bz=jitter(110,10), temp=36.9;
      return {
        diagnosis:"Hypertensive Krise",
        story:"68-jähriger Patient mit Kopfschmerz, Sehstörungen, RR sehr hoch.",
        key_findings:["RR massiv↑","Kopfschmerz","Sehstörungen"],
        red_flags:["Hypertensive Notfall-Komplikationen möglich"],
        target_outcome:"Monitoring, zügiger Transport.",
        hidden:{
          vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp),
          pupils:"isokor", mouth:"unauff.", lung:"unauff.",
          abdomen:"weich", ekg3:`Sinus ${puls}/min`, ekg12:"LVH-Zeichen möglich", befast:null, neuro:"unauff. außer Kopfschmerz"
        }
      };
    };
    const int_genAnaphylaxis = () => {
      const bpS=jitter(90,10), bpD=jitter(55,8), spo2=jitter(88,4), af=jitter(26,5), puls=jitter(120,12), bz=jitter(110,10), temp=37.0;
      return {
        diagnosis:"Anaphylaxie",
        story:"35-jährige Person nach Insektenstich: Urtikaria, Dyspnoe, Schwellungen.",
        key_findings:["Hypotonie","Dyspnoe","Hautzeichen"],
        red_flags:["Atemwegsbedrohung"],
        target_outcome:"Sofortmaßnahmen, Transport.",
        hidden:{
          vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp,14),
          pupils:"isokor", mouth:"Zunge/Lippen geschwollen", lung:"Giemen, Stridor möglich",
          abdomen:"übelkeit", ekg3:`Sinus ${puls}/min`, ekg12:"Sinus", befast:null, neuro:"unruhig"
        }
      };
    };
    const int_genGIbleed = () => {
      const bpS=jitter(95,10), bpD=jitter(60,8), spo2=jitter(97,1), af=jitter(20,3), puls=jitter(110,12), bz=jitter(120,10), temp=36.6;
      return {
        diagnosis:"Obere GI-Blutung",
        story:"70-jähriger Patient mit Hämatemesis, Teerstuhl, Schwindel.",
        key_findings:["Hämatemesis","Hypotonie","Tachykardie"],
        red_flags:["Schockgefahr"],
        target_outcome:"Schock/Endoskopie-Klinik.",
        hidden:{
          vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp,14),
          pupils:"isokor", mouth:"Blutreste", lung:"unauffällig", abdomen:"epigastrisch druckschmerzhaft",
          ekg3:`Sinus ${puls}/min`, ekg12:"Sinus", befast:null, neuro:"blass, kaltschweißig"
        }
      };
    };

    // --- NEUROLOGISCH (10) ---
    const neuro_genStrokeRight = () => {
      const bpS=jitter(165,12), bpD=jitter(100,10), spo2=jitter(96,2), af=jitter(16,2), puls=jitter(82,6), bz=jitter(105,10), temp=36.8;
      return {
        diagnosis:"Ischämischer Schlaganfall rechts",
        story:"Plötzliche Sprachstörung, Schwäche links, Beginn <45 min.",
        key_findings:["Hemiparese links","Aphasie/Dysarthrie","Zeitfenster"],
        red_flags:["akuter neurologischer Ausfall"],
        target_outcome:"BEFAST, BZ, Stroke-Unit.",
        hidden:{
          vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp),
          pupils:"isokor", mouth:"leicht hängender Mundwinkel links",
          lung:"unauff.", abdomen:"weich",
          ekg3:`Sinus ${puls}/min`, ekg12:"Sinus",
          befast:{Balance:"unsicher",Eyes:"ok",Face:"links hängend",Arms:"links schwächer",Speech:"verwaschen",Time:"~40 min"},
          neuro:"links Arm/Bein schwächer"
        }
      };
    };
    const neuro_genStrokeLeft  = () => {
      const bpS=jitter(170,12), bpD=jitter(105,10), spo2=jitter(96,2), af=jitter(16,2), puls=jitter(82,6), bz=jitter(110,10), temp=36.9;
      return {
        diagnosis:"Ischämischer Schlaganfall links",
        story:"Wortfindungsstörungen, Schwäche rechts, Beginn ~1 h.",
        key_findings:["Hemiparese rechts","Sprachstörung","Zeitfenster"],
        red_flags:["akuter Ausfall"],
        target_outcome:"BEFAST, BZ, Stroke-Unit.",
        hidden:{
          vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp),
          pupils:"isokor", mouth:"rechts hängender Mundwinkel",
          lung:"unauff.", abdomen:"weich",
          ekg3:`Sinus ${puls}/min`, ekg12:"Sinus",
          befast:{Balance:"ok",Eyes:"ok",Face:"rechts hängend",Arms:"rechts drift",Speech:"aphasisch",Time:"~60 min"},
          neuro:"rechtsseitige Schwäche"
        }
      };
    };
    const neuro_genTIA = () => {
      const bpS=jitter(155,10), bpD=jitter(95,8), spo2=jitter(97,1), af=jitter(14,2), puls=jitter(78,6), bz=jitter(105,10), temp=36.7;
      return {
        diagnosis:"TIA, regredient",
        story:"Kurzzeitige Sprachstörung und Schwäche, aktuell fast normal.",
        key_findings:["anamnestisch fokal","regredient"],
        red_flags:["Warnsignal"],
        target_outcome:"Neuroll. Abklärung, Transport.",
        hidden:{
          vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp),
          pupils:"isokor", mouth:"unauff.", lung:"unauff.", abdomen:"weich",
          ekg3:`Sinus ${puls}/min`, ekg12:"Sinus",
          befast:{Balance:"ok",Eyes:"ok",Face:"ok",Arms:"ok",Speech:"ok",Time:"~90 min, rückläufig"},
          neuro:"aktuell unauff."
        }
      };
    };
    const neuro_genPostictal = () => {
      const bpS=jitter(140,10), bpD=jitter(85,8), spo2=jitter(95,2), af=jitter(18,3), puls=jitter(92,8), bz=jitter(110,10), temp=37.0;
      return {
        diagnosis:"Postiktaler Zustand",
        story:"Zeugen berichten Krampfanfall, nun schläfrig, desorientiert.",
        key_findings:["postiktal","müde","Zungenbiss evtl."],
        red_flags:["Verletzungen ausschließen"],
        target_outcome:"Monitoring, BZ, Transport.",
        hidden:{
          vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp),
          pupils:"isokor, prompt", mouth:"seitlicher Zungenbiss möglich",
          lung:"unauff.", abdomen:"weich",
          ekg3:`Sinus ${puls}/min`, ekg12:"Sinus",
          befast:{Balance:"schläfrig",Eyes:"ok",Face:"ok",Arms:"ok",Speech:"langsam",Time:"10 min"},
          neuro:"postiktal schläfrig"
        }
      };
    };
    const neuro_genICH = () => {
      const bpS=jitter(190,15), bpD=jitter(110,10), spo2=jitter(97,1), af=jitter(18,2), puls=jitter(78,6), bz=jitter(110,10), temp=36.8;
      return {
        diagnosis:"Intrazerebrale Blutung (V. a.)",
        story:"Plötzlicher, stärkster Kopfschmerz („Thunderclap“), Übelkeit, Neuro-Ausfall.",
        key_findings:["starker Kopfschmerz","RR↑","neurologische Defizite"],
        red_flags:["Blutung möglich"],
        target_outcome:"Schneller Transport (Neuro).",
        hidden:{
          vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp),
          pupils:"evtl. asymmetrisch leicht", mouth:"unauff.",
          lung:"unauff.", abdomen:"weich",
          ekg3:`Sinus ${puls}/min`, ekg12:"Sinus",
          befast:{Balance:"unsicher",Eyes:"ok",Face:"leichte Asymmetrie",Arms:"Drift",Speech:"verwaschen",Time:"akut"},
          neuro:"neurologische Ausfälle"
        }
      };
    };
    const neuro_genMeningitis = () => {
      const bpS=jitter(110,12), bpD=jitter(70,10), spo2=jitter(96,2), af=jitter(22,3), puls=jitter(110,10), bz=jitter(120,10), temp=39.5;
      return {
        diagnosis:"Meningitis (V. a.)",
        story:"Fieber, Nackensteifigkeit, Kopfschmerz, Photophobie.",
        key_findings:["Fieber","Meningismus","AZ↓"],
        red_flags:["Sepsis/Neuro-Notfall"],
        target_outcome:"Schnell Klinik.",
        hidden:{
          vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp,14),
          pupils:"isokor", mouth:"trocken", lung:"tachypnoisch möglich",
          abdomen:"weich", ekg3:`Sinus ${puls}/min`, ekg12:"Sinus", befast:null, neuro:"Nackensteifigkeit"
        }
      };
    };
    const neuro_genGuillainBarre = () => {
      const bpS=jitter(130,10), bpD=jitter(80,8), spo2=jitter(95,2), af=jitter(18,2), puls=jitter(90,8), bz=jitter(110,10), temp=36.8;
      return {
        diagnosis:"Guillain-Barré-Syndrom (V. a.)",
        story:"Aufsteigende Muskelschwäche, Parästhesien, nach Infekt.",
        key_findings:["aufsteigende Parese","Reflexe ↓"],
        red_flags:["Atembeteiligung möglich"],
        target_outcome:"Klinik, Monitoring.",
        hidden:{
          vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp),
          pupils:"isokor", mouth:"unauff.", lung:"evtl. flache Atmung",
          abdomen:"weich", ekg3:`Sinus ${puls}/min`, ekg12:"Sinus", befast:null, neuro:"beinbetont schwach"
        }
      };
    };
    const neuro_genMigraine = () => {
      const bpS=jitter(135,10), bpD=jitter(85,8), spo2=jitter(97,1), af=jitter(16,2), puls=jitter(80,6), bz=jitter(110,10), temp=36.7;
      return {
        diagnosis:"Migräneattacke",
        story:"Starker, pulsierender Kopfschmerz, Photophobie, Übelkeit, typische Anamnese.",
        key_findings:["Kopfschmerztypisch","Auren evtl."],
        red_flags:["Atypik ausschließen"],
        target_outcome:"Monitoring, Transport bei Bedarf.",
        hidden:{
          vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp),
          pupils:"isokor", mouth:"unauff.", lung:"unauff.", abdomen:"Übelkeit",
          ekg3:`Sinus ${puls}/min`, ekg12:"Sinus", befast:null, neuro:"unauffällig"
        }
      };
    };
    const neuro_genBellPalsy = () => {
      const bpS=jitter(140,10), bpD=jitter(85,8), spo2=jitter(98,1), af=jitter(14,2), puls=jitter(78,6), bz=jitter(110,10), temp=36.8;
      return {
        diagnosis:"Fazialisparese (Bell-Palsy) V. a.)",
        story:"Akut hängender Mundwinkel, Stirnrunzeln rechts/links nicht möglich, rest neurologisch unauff.",
        key_findings:["periphere Fazialisparese"],
        red_flags:["Stroke-Mimik beachten"],
        target_outcome:"Klinik zur Abklärung.",
        hidden:{
          vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp),
          pupils:"isokor", mouth:"Asymmetrie", lung:"unauff.", abdomen:"weich",
          ekg3:`Sinus ${puls}/min`, ekg12:"Sinus",
          befast:{Balance:"ok",Eyes:"ok",Face:"stark hängend peripher",Arms:"ok",Speech:"ok",Time:"akut"},
          neuro:"periphere Fazialisparese"
        }
      };
    };
    const neuro_genSyncope = () => {
      const bpS=jitter(100,10), bpD=jitter(65,8), spo2=jitter(98,1), af=jitter(14,2), puls=jitter(60,6), bz=jitter(100,10), temp=36.6;
      return {
        diagnosis:"Synkope (vasovagal) V. a.)",
        story:"Kurz bewusstlos nach Schmerz/Stress, rasche Erholung.",
        key_findings:["Prodromi","kurzzeitige Bewusstlosigkeit"],
        red_flags:["Trauma/Arythmie ausschließen"],
        target_outcome:"Monitoring, Transport bei Bedarf.",
        hidden:{
          vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp),
          pupils:"isokor", mouth:"unauff.", lung:"unauff.", abdomen:"weich",
          ekg3:`Sinus/Brady ${puls}/min`, ekg12:"Sinus/Brady", befast:null, neuro:"unauff."
        }
      };
    };
    const neuro_genToxicMetabolic = () => {
      const bpS=jitter(120,10), bpD=jitter(75,8), spo2=jitter(97,1), af=jitter(16,2), puls=jitter(84,6), bz=jitter(60,8), temp=36.7;
      return {
        diagnosis:"Toxisch-metabolische Enzephalopathie (Hypo/Hyper-BZ als Beispiel)",
        story:"Verwirrtheit, kein lateralisiertes Defizit.",
        key_findings:["globale Vigilanzminderung","BZ-Abweichung"],
        red_flags:["Ausschluss anderer Ursachen"],
        target_outcome:"Monitoring, Transport.",
        hidden:{
          vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp,14),
          pupils:"isokor", mouth:"unauff.", lung:"unauff.", abdomen:"weich",
          ekg3:`Sinus ${puls}/min`, ekg12:"Sinus", befast:null, neuro:"global beeinträchtigt"
        }
      };
    };

    // --- PÄDIATRISCH (10) ---
    const ped_genFebrileSeizure = () => {
      const v=vitals(jitter(105,10),jitter(65,8),97,22,120,100,38.9,14);
      return {
        diagnosis:"Fieberkrampf (kleines Kind)",
        story:"Kind nach Fieberkrampf, jetzt schläfrig, Eltern berichten 2–3 min Dauer.",
        key_findings:["Fieber","postiktale Müdigkeit"],
        red_flags:["komplizierter Verlauf ausschließen"],
        target_outcome:"Monitoring, Transport.",
        hidden:{ vitals_baseline:{...v}, pupils:"isokor", mouth:"unauff.", lung:"unauff.", abdomen:"weich", ekg3:`Sinus 120/min`, ekg12:"Sinus", befast:null, neuro:"postiktal müde" }
      };
    };
    const ped_genAsthmaExac = () => {
      const v=vitals(jitter(110,10),jitter(70,8),91,28,130,100,37.8);
      return {
        diagnosis:"Asthma-Exazerbation (Kind)",
        story:"Pfeifende Atmung, spricht nur in kurzen Sätzen, bekannte Anfälle.",
        key_findings:["Giemen","AF↑","Erschöpfung droht"],
        red_flags:["Atemnot"],
        target_outcome:"O2 nach Indikation, Transport.",
        hidden:{ vitals_baseline:{...v}, pupils:"isokor", mouth:"unauff.", lung:"diffuses Giemen", abdomen:"weich", ekg3:`Sinus 130/min`, ekg12:"Sinus", befast:null, neuro:null }
      };
    };
    const ped_genCroup = () => {
      const v=vitals(jitter(110,10),jitter(70,8),95,28,120,100,37.9);
      return {
        diagnosis:"Pseudokrupp (Croup)",
        story:"Bellender Husten, inspiratorischer Stridor, nachts schlimmer.",
        key_findings:["Stridor","Heiserkeit","bellender Husten"],
        red_flags:["Atemwegsengstellung"],
        target_outcome:"Ruhige Lagerung, O2 nach Indikation, Transport.",
        hidden:{ vitals_baseline:{...v}, pupils:"isokor", mouth:"Schleimhaut ödematös", lung:"Stridor", abdomen:"weich", ekg3:`Sinus 120/min`, ekg12:"Sinus", befast:null, neuro:null }
      };
    };
    const ped_genDehydrationGE = () => {
      const v=vitals(jitter(95,8),jitter(55,6),97,24,120,70,37.8);
      return {
        diagnosis:"Gastroenteritis mit Dehydratation",
        story:"Kind erbricht und hat Durchfall seit 24 h, trinkt schlecht, eingefallene Augen.",
        key_findings:["dehydriert","trockene Schleimhäute"],
        red_flags:["Schockgefahr"],
        target_outcome:"Transport, Rehydratation in Klinik.",
        hidden:{ vitals_baseline:{...v}, pupils:"isokor", mouth:"trocken", lung:"unauff.", abdomen:"weich/kolikartig", ekg3:`Sinus 120/min`, ekg12:"Sinus", befast:null, neuro:"müde" }
      };
    };
    const ped_genAnaphylaxis = () => {
      const v=vitals(jitter(85,8),jitter(50,6),88,30,140,100,37.2,14);
      return {
        diagnosis:"Anaphylaxie (Kind)",
        story:"Nach Nusskontakt Schwellungen, Urtikaria, Dyspnoe.",
        key_findings:["Hypotonie","Dyspnoe","Haut"],
        red_flags:["Atemwegsnot"],
        target_outcome:"Sofortmaßnahmen, Transport.",
        hidden:{ vitals_baseline:{...v}, pupils:"isokor", mouth:"Zunge/Lippen geschwollen", lung:"Giemen/Stridor", abdomen:"übelkeit", ekg3:`Sinus 140/min`, ekg12:"Sinus", befast:null, neuro:"unruhig" }
      };
    };
    const ped_genFBaspiration = () => {
      const v=vitals(jitter(110,10),jitter(70,8),90,30,130,100,37.0);
      return {
        diagnosis:"Fremdkörperaspiration",
        story:"Plötzliches Husten, einseitig AG ↓, Erdnuss in Anamnese.",
        key_findings:["einseitig AG ↓","Hustenanfälle"],
        red_flags:["Atemwegsverlegung"],
        target_outcome:"Transport (Bronchoskopie).",
        hidden:{ vitals_baseline:{...v}, pupils:"isokor", mouth:"Speichelfluss", lung:"rechts AG ↓", abdomen:"weich", ekg3:`Sinus 130/min`, ekg12:"Sinus", befast:null, neuro:null }
      };
    };
    const ped_genSepsisNeonate = () => {
      const v=vitals(jitter(75,6),jitter(45,5),95,40,160,90,38.5,12);
      return {
        diagnosis:"Neonatale Sepsis (V. a.)",
        story:"Lethargisch, trinkt schlecht, Fieber/Hypothermie, Blässe.",
        key_findings:["AZ↓","Tachykardie","AF↑"],
        red_flags:["Schock"],
        target_outcome:"Schnell Klinik.",
        hidden:{ vitals_baseline:{...v}, pupils:"isokor", mouth:"trocken", lung:"tachypnoisch", abdomen:"weich", ekg3:`Sinus 160/min`, ekg12:"Sinus", befast:null, neuro:"müde" }
      };
    };
    const ped_genDKAteen = () => {
      const v=vitals(jitter(110,10),jitter(70,8),96,28,115,420,37.2);
      return {
        diagnosis:"DKA (Adoleszent)",
        story:"Jugendliche/r mit Polyurie, Durst, Bauchschmerz, tiefer Atmung.",
        key_findings:["Kussmaul","BZ↑","Dehydratation"],
        red_flags:["Bewusstseinsminderung"],
        target_outcome:"Transport (Kinderklinik).",
        hidden:{ vitals_baseline:{...v}, pupils:"isokor", mouth:"Azeton, trocken", lung:"tief", abdomen:"diffus druckschmerzhaft", ekg3:`Sinus 115/min`, ekg12:"Sinus", befast:null, neuro:null }
      };
    };
    const ped_genHeadInjury = () => {
      const v=vitals(jitter(100,10),jitter(60,8),98,22,110,100,37.0,14);
      return {
        diagnosis:"Leichtes SHT (Kind)",
        story:"Sturz vom Klettergerüst, kurze Benommenheit, Übelkeit.",
        key_findings:["GCS 14","Übelkeit","Amnesie kurz"],
        red_flags:["Erbrechen mehrfach?"],
        target_outcome:"Monitoring, Transport.",
        hidden:{ vitals_baseline:{...v}, pupils:"isokor", mouth:"unauff.", lung:"unauff.", abdomen:"weich", ekg3:`Sinus 110/min`, ekg12:"Sinus", befast:null, neuro:"leicht benommen" }
      };
    };
    const ped_genAppendicitis = () => {
      const v=vitals(jitter(105,10),jitter(65,8),98,22,110,100,38.0);
      return {
        diagnosis:"Appendizitis (V. a.)",
        story:"Kind mit Bauchschmerz nabelnah → rechts unten, Fieber, Appetit↓.",
        key_findings:["McBurney druckschmerzhaft","Fieber"],
        red_flags:["Perforation möglich"],
        target_outcome:"Kinderklinik.",
        hidden:{ vitals_baseline:{...v}, pupils:"isokor", mouth:"unauff.", lung:"unauff.", abdomen:"rechter Unterbauch druckschmerzhaft", ekg3:`Sinus 110/min`, ekg12:"Sinus", befast:null, neuro:null }
      };
    };

    // TRAUMA (10)
const tr_genAnkleFracture = () => {
  const v=vitals(jitter(135,10),jitter(85,8),98,16,88,110,36.8); // RR as string later
  return {
    diagnosis:"Sprunggelenksfraktur",
    story:"Sturz beim Sport, Fuß deformiert, belastungsschmerz.",
    key_findings:["Deformität","Schmerz","DMS prüfen!"],
    red_flags:["Durchblutung/Motorik/Sensibilität sichern"],
    target_outcome:"Immobilisation, Schmerzbeobachtung, Klinik.",
    hidden:{
      vitals_baseline:{...v, RR:`${jitter(135,10)}/${jitter(85,8)}`},
      pupils:"isokor", mouth:"unauff.", lung:"unauff.", abdomen:"weich",
      ekg3:`Sinus 88/min`, ekg12:"Sinus", befast:null, neuro:"DMS peripher ↓ bei Druck"
    }
  };
};
const tr_genForearmFracture = () => {
  const v=vitals(jitter(130,10),jitter(80,8),98,16,88,110,36.8);
  return {
    diagnosis:"Unterarmfraktur",
    story:"Sturz auf ausgestreckten Arm, Fehlstellung, Schmerzen.",
    key_findings:["Fehlstellung","Schmerz","DMS!"],
    red_flags:["Kompartment möglich"],
    target_outcome:"Schienung, Klinik.",
    hidden:{ vitals_baseline:{...v, RR:`${jitter(130,10)}/${jitter(80,8)}`}, pupils:"isokor", mouth:"unauff.", lung:"unauff.", abdomen:"weich", ekg3:`Sinus 88/min`, ekg12:"Sinus", befast:null, neuro:"DMS leicht erniedrigt" }
  };
};
const tr_genHipFractureElderly = () => {
  const v=vitals(jitter(145,10),jitter(85,8),97,18,96,120,36.9);
  return {
    diagnosis:"Schenkelhalsfraktur",
    story:"Ältere Person nach Stolpern, Bein verkürzt und außenrotiert.",
    key_findings:["Fehlstellung Bein","Belastung unmöglich"],
    red_flags:["Delir/Antikoagulation beachten"],
    target_outcome:"Schmerz, Schienung, Klinik.",
    hidden:{ vitals_baseline:{...v, RR:`${jitter(145,10)}/${jitter(85,8)}`}, pupils:"isokor", mouth:"unauff.", lung:"unauff.", abdomen:"weich", ekg3:`Sinus 96/min`, ekg12:"Sinus", befast:null, neuro:"unruhig möglich" }
  };
};
const tr_genRibFractures = () => {
  const v=vitals(jitter(140,10),jitter(85,8),95,22,100,110,37.0);
  return {
    diagnosis:"Rippenfrakturen",
    story:"Thoraxprellung nach Sturz, atemabhängiger Schmerz.",
    key_findings:["lokaler Druckschmerz","Atemzugschmerz"],
    red_flags:["Pneumothorax ausschließen"],
    target_outcome:"Monitoring, Klinik.",
    hidden:{ vitals_baseline:{...v, RR:`${jitter(140,10)}/${jitter(85,8)}`}, pupils:"isokor", mouth:"unauff.", lung:"seitendifferent evtl. abgeschwächt", abdomen:"weich", ekg3:`Sinus 100/min`, ekg12:"Sinus", befast:null, neuro:null }
  };
};
const tr_genPneumothorax = () => {
  const v=vitals(jitter(135,10),jitter(85,8),90,26,110,110,36.9);
  return {
    diagnosis:"Spannungs-/Pneumothorax (V. a.)",
    story:"Stumpfes Thoraxtrauma, zunehmende Dyspnoe, einseitig abgeschwächtes AG.",
    key_findings:["Dyspnoe","AG einseitig ↓","AF↑"],
    red_flags:["Spannungspneu möglich"],
    target_outcome:"Sofortmaßnahmen, Klinik.",
    hidden:{ vitals_baseline:{...v, RR:`${jitter(135,10)}/${jitter(85,8)}`}, pupils:"isokor", mouth:"unauff.", lung:"links deutlich abgeschwächt", abdomen:"weich", ekg3:`Sinus 110/min`, ekg12:"Sinus", befast:null, neuro:null }
  };
};
const tr_genHeadInjuryMild = () => {
  const v=vitals(jitter(135,10),jitter(85,8),98,16,82,110,36.8,14);
  return {
    diagnosis:"Leichtes SHT",
    story:"Sturz mit Kopfaufprall, retrograde Amnesie, Übelkeit.",
    key_findings:["GCS 14","Kopfschmerz","Amnesie"],
    red_flags:["Antikoagulation? Erbrechen?"],
    target_outcome:"Monitoring, Klinik.",
    hidden:{ vitals_baseline:{...v, RR:`${jitter(135,10)}/${jitter(85,8)}`}, pupils:"isokor, prompt", mouth:"unauff.", lung:"unauff.", abdomen:"weich", ekg3:`Sinus 82/min`, ekg12:"Sinus", befast:null, neuro:"leichte Desorientierung" }
  };
};
const tr_genHeadInjurySevere = () => {
  const v=vitals(jitter(150,12),jitter(95,10),96,20,90,110,37.0,10);
  return {
    diagnosis:"SHT moderat bis schwer",
    story:"Verkehrsunfall, kurzzeitige Bewusstlosigkeit, GCS 10.",
    key_findings:["GCS↓","Traumamechanismus"],
    red_flags:["c-Spine, Atemweg beachten"],
    target_outcome:"Schockraum.",
    hidden:{ vitals_baseline:{...v, RR:`${jitter(150,12)}/${jitter(95,10)}`}, pupils:"evtl. anisokor", mouth:"Blut in Mund", lung:"evtl. aspir.", abdomen:"weich", ekg3:`Sinus 90/min`, ekg12:"Sinus", befast:null, neuro:"fokale Zeichen möglich" }
  };
};
const tr_genPelvicFracture = () => {
  const v=vitals(jitter(95,10),jitter(60,8),95,24,110,120,36.7,13);
  return {
    diagnosis:"Beckenfraktur (instabil?)",
    story:"Hochrasanztrauma, Beckenschmerz, instabiler Kreislauf möglich.",
    key_findings:["Beckenschmerz","Instabilität","Schockgefahr"],
    red_flags:["große Blutung intern möglich"],
    target_outcome:"Schockraum.",
    hidden:{ vitals_baseline:{...v, RR:`${jitter(95,10)}/${jitter(60,8)}`}, pupils:"isokor", mouth:"unauff.", lung:"tachypnoisch", abdomen:"weich/empfindlich", ekg3:`Sinus 110/min`, ekg12:"Sinus", befast:null, neuro:null }
  };
};
const tr_genOpenFractureTibia = () => {
  const v=vitals(jitter(130,10),jitter(80,8),97,18,95,110,36.9);
  return {
    diagnosis:"Offene Unterschenkelfraktur",
    story:"Sturz mit offener Wunde, Knochen sichtbar, Blutung.",
    key_findings:["offene Fraktur","Blutung","DMS!"],
    red_flags:["Infektions-/Blutungskontrolle"],
    target_outcome:"Steril abdecken, Schienung, Klinik.",
    hidden:{ vitals_baseline:{...v, RR:`${jitter(130,10)}/${jitter(80,8)}`}, pupils:"isokor", mouth:"unauff.", lung:"unauff.", abdomen:"weich", ekg3:`Sinus 95/min`, ekg12:"Sinus", befast:null, neuro:"DMS erhalten" }
  };
};
const tr_genBurnsPartialThickness = () => {
  const v=vitals(jitter(125,10),jitter(80,8),98,18,90,110,36.8);
  return {
    diagnosis:"Verbrennung 2. Grades (ca. kleine Fläche)",
    story:"Haushaltsunfall mit heißer Flüssigkeit, Blasenbildung, starker Schmerz.",
    key_findings:["Rötung/Blasen","Schmerz"],
    red_flags:["Ausmaß/Ort beachten"],
    target_outcome:"Kühlen begrenzt, sterile Abdeckung, Klinik.",
    hidden:{ vitals_baseline:{...v, RR:`${jitter(125,10)}/${jitter(80,8)}`}, pupils:"isokor", mouth:"unauff.", lung:"unauff.", abdomen:"weich", ekg3:`Sinus 90/min`, ekg12:"Sinus", befast:null, neuro:null }
  };
};


    // ===== 6) Pools =====
    const POOLS = {
      internistisch: [
        int_genACS, int_genPneumonia, int_genHF, int_genAsthmaCOPD, int_genPE,
        int_genHypogly, int_genDKA, int_genSepsisUrosepsis, int_genHypertensiveCrisis,
        int_genAnaphylaxis, int_genGIbleed
      ].slice(0,10),
      neurologisch: [
        neuro_genStrokeRight, neuro_genStrokeLeft, neuro_genTIA, neuro_genPostictal,
        neuro_genICH, neuro_genMeningitis, neuro_genGuillainBarre, neuro_genMigraine,
        neuro_genBellPalsy, neuro_genSyncope, neuro_genToxicMetabolic
      ].slice(0,10),
      trauma: [
        tr_genAnkleFracture, tr_genForearmFracture, tr_genHipFractureElderly, tr_genRibFractures,
    tr_genPneumothorax, tr_genHeadInjuryMild, tr_genHeadInjurySevere, tr_genPelvicFracture,
    tr_genOpenFractureTibia, tr_genBurnsPartialThickness
      ],
      paediatrisch: [
        ped_genFebrileSeizure, ped_genAsthmaExac, ped_genCroup, ped_genDehydrationGE,
        ped_genAnaphylaxis, ped_genFBaspiration, ped_genSepsisNeonate, ped_genDKAteen,
        ped_genHeadInjury, ped_genAppendicitis
      ]
    };

    // Fallback, falls Pool leer ist (z. B. trauma momentan leer)
    const chosenPool = (POOLS[normalized] && POOLS[normalized].length)
      ? POOLS[normalized]
      : POOLS.internistisch;

    // ===== 7) Szenario ziehen & Case bauen =====
    const scenarioGen = randPick(chosenPool);
    const scenario    = scenarioGen(); // WICHTIG: aufrufen!

    const caseData = {
      id: newId(),
      specialty: normalized,
      difficulty,
      role,
      story: scenario.story,
      initial_vitals: null, // werden erst durch Messungen gesetzt
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
