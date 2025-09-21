// ================================================================
// medicIQ – Netlify Functions
// case-new.js  (Fallgenerator)
// case-step.js (Interaktion/Step-Engine)
// ================================================================
// HINWEIS: Diese Datei enthält BEIDE Functions in einem Dokument,
// damit du sie 1:1 kopieren kannst. Trenne sie in deinem Projekt in
// zwei Dateien:
//   netlify/functions/case-new.js
//   netlify/functions/case-step.js
// ================================================================

// ===========================
// netlify/functions/case-new.js
// ===========================
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
    const newId    = () => 'fall_' + Math.random().toString(36).slice(2, 8);
    const randPick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const randInt  = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
    const jitter   = (base, d) => base + randInt(-d, d);
    const clamp    = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    // Vitalwerte
    const vitals = (bpSys, bpDia, spo2, af, puls, bz, temp, gcs = 15) => ({
      RR: `${bpSys}/${bpDia}`, SpO2: spo2, AF: af, Puls: puls, BZ: bz, Temp: temp, GCS: gcs
    });

    // ===== 3) Kompetenz/Scope =====
    const baseScope_RS = {
      role: 'RS',
      allowed_actions: [
        'Eigenschutz und Umfeld sichern',
        'Patientenansprache, Bewusstsein prüfen (AVPU/GCS)',
        'ABCDE-Assessment',
        'Monitoring: RR, SpO2, Puls, AF, BZ, Temp, GCS',
        'Lagerung (OKH, Sitz, SSL, Schocklage je nach Situation)',
        'Wärmeerhalt, psychologische Betreuung',
        'O2-Gabe (bei Indikation)',
        'NA nachfordern (bei Bedarf), Übergabe',
        'Pupillen prüfen', 'Mundraum inspizieren', 'Auskultation Lunge', 'Schmerzskala',
        'EKG (3-/12-Kanal)', 'BEFAST (neurologischer Check)'
      ],
      disallowed_examples: [
        'i.v.-Zugang legen', 'Intubation/RSI', 'Medikamentengabe (außer lokal erlaubt)'
      ]
    };
    const baseScope_NotSan = {
      role: 'NotSan',
      allowed_actions: [
        ...baseScope_RS.allowed_actions,
        'i.v.-Zugang legen', 'erweiterte Maßnahmen (gemäß SOP)'
      ],
      disallowed_examples: [ 'RSI/Narkose und arztpflichtige Maßnahmen' ]
    };
    const SCOPE = role === 'NotSan' ? baseScope_NotSan : baseScope_RS;

    // ===== 4) Specialty-Normalisierung =====
    const SPECIALTY_MAP = {
      // Internistisch
      'internistisch':'internistisch','internal':'internistisch','innere':'internistisch','medizinisch':'internistisch','innere medizin':'internistisch',
      // Neurologisch
      'neurologisch':'neurologisch','neurologie':'neurologisch',
      // Trauma
      'trauma':'trauma','traumatologie':'trauma','unfall':'trauma','unfallchirurgie':'trauma',
      // Pädiatrisch
      'paediatrisch':'paediatrisch','pädiatrisch':'paediatrisch','kinder':'paediatrisch','kinderheilkunde':'paediatrisch','pediatrisch':'paediatrisch','pediatrics':'paediatrisch'
    };
    const normalized = SPECIALTY_MAP[(specialty||'').toString().trim().toLowerCase()] || 'internistisch';

    // ===== 5) Szenario-Generatoren =====
    // Hilfsfunktion, um strukturierte Anamnese zu bauen
    const mkAnam = (over={}) => ({
      SAMPLER: { S:'', A:'keine bekannt', M:'keine', P:'keine Auffälligkeiten', L:'', E:'', R:'' , ...(over.SAMPLER||{}) },
      OPQRST : { O:'', P:'', Q:'', R:'', S:'', T:'' , ...(over.OPQRST||{}) },
      vorerkrankungen: over.vorerkrankungen || [],
      medikation     : over.medikation || [],
      allergien      : over.allergien || [],
      antikoagulation: !!over.antikoagulation,
      sozial         : over.sozial || {}
    });

    // === INTERNISTISCH ===
    const int_genACS = () => {
      const bpS=jitter(125,12), bpD=jitter(80,8), spo2=jitter(88,3), af=jitter(20,3), puls=jitter(100,8), bz=jitter(110,10), temp=36.8;
      const side=randPick(['linken','rechten']);
      return {
        diagnosis: 'Akutes Koronarsyndrom (ACS, STEMI möglich)',
        story: `65-jähriger Mann mit drückendem Brustschmerz, Ausstrahlung in den ${side} Arm, Übelkeit, Schweiß.`,
        key_findings: ['drückender Thoraxschmerz','Dyspnoe','Risikofaktoren'],
        red_flags: ['Thoraxschmerz >15 min','vegetative Begleitsymptome'],
        target_outcome: 'Monitoring, 12-Kanal-EKG, ACS-Transport.',
        patient: { name:'Herr K.', age:65, sex:'m' },
        anamnesis: mkAnam({
          SAMPLER:{ S:'Druck auf der Brust mit Ausstrahlung, Übelkeit, kalter Schweiß', A:'ASS: Magenbeschwerden', M:'ASS 100, Ramipril, Atorvastatin', P:'KHK, HTN, Hyperlipidämie', L:'Kaffee heute früh', E:'unter Stress beim Treppensteigen', R:'männlich, Raucher, Alter, HTN' },
          OPQRST:{ O:'seit 20 min', P:'keine Linderung in Ruhe', Q:'drückend/enge', R:'retrosternal → Arm/Unterkiefer', S:'8/10', T:'progredient' },
          vorerkrankungen:['KHK','Hypertonie','Hyperlipidämie'],
          medikation:['ASS 100','Ramipril','Atorvastatin'],
          allergien:['keine bekannt']
        }),
        patho: { tag:['ACS','kardiovaskulär'], severity:2, hypoxia_sensitivity:1, dehydration:0, baseline_deterioration:1 },
        hidden: {
          vitals_baseline: vitals(bpS,bpD,spo2,af,puls,bz,temp),
          pupils:'isokor, prompt', mouth:'rosige Schleimhäute', lung:'normales Atemgeräusch, evtl. Tachypnoe', abdomen:'weich',
          ekg3:`Sinus ${puls}/min`, ekg12: randPick(['STEMI inferior','NSTEMI-Zeichen']), befast:null, neuro:null
        }
      };
    };

    const int_genPneumonia = () => {
      const bpS=jitter(130,10), bpD=jitter(80,8), spo2=jitter(90,3), af=jitter(26,4), puls=jitter(105,10), bz=jitter(120,10), temp=38.6;
      return {
        diagnosis:'Pneumonie mit Hypoxie',
        story:'72-jährige Patientin mit Husten, Fieber, zunehmender Atemnot seit 2 Tagen.',
        key_findings:['Fieber','basale feuchte RG','Hypoxie'],
        red_flags:['Tachypnoe + Hypoxie'],
        target_outcome:'O2 nach Indikation, Monitoring, Klinik.',
        patient:{ name:'Frau S.', age:72, sex:'w' },
        anamnesis: mkAnam({
          SAMPLER:{ S:'Husten, Fieber, Atemnot', A:'Penicillin: Ausschlag', M:'Amlodipin', P:'COPD leicht, HTN', L:'Suppe vor 3h', E:'seit Infektverschlechterung', R:'Alter, COPD' },
          OPQRST:{ O:'seit 48 h, zunehmend', P:'Sitzen erleichtert etwas', Q:'Atemnot', R:'beidseitig', S:'7/10 (Atemnot)', T:'progredient' },
          vorerkrankungen:['COPD leicht','Hypertonie'], medikation:['Amlodipin'], allergien:['Penicillin']
        }),
        patho:{ tag:['infektiös','obstruktiv'], severity:2, hypoxia_sensitivity:2, dehydration:1, baseline_deterioration:1 },
        hidden:{ vitals_baseline:vitals(bpS,bpD,spo2,af,puls,bz,temp), pupils:'isokor', mouth:'mukopurulentes Sekret', lung:'basal feuchte RG rechts>links', abdomen:'weich', ekg3:`Sinus ${puls}/min`, ekg12:'Sinus', befast:null, neuro:null }
      };
    };

    const int_genHF = () => {
      const v = vitals(jitter(135,12),jitter(85,8),jitter(90,4),jitter(24,4),jitter(108,10),jitter(120,10),36.9);
      return {
        diagnosis:'Akute kardiale Dekompensation',
        story:'Älterer Patient mit Orthopnoe, Beinödemen, nächtlicher Dyspnoe.',
        key_findings:['Orthopnoe','Rasselgeräusche basal','Ödeme'],
        red_flags:['Ruhedyspnoe','Hypoxie'],
        target_outcome:'Sitzlagerung, O2 bei Indikation, Monitoring, zügiger Transport.',
        patient:{ name:'Herr B.', age:78, sex:'m' },
        anamnesis: mkAnam({ SAMPLER:{ S:'Atemnot in Ruhe, Husten schaumig', A:'keine', M:'Diuretikum unregelmäßig', P:'Herzinsuffizienz, HTN', L:'Frühstück', E:'seit heute Morgen deutlich schlechter', R:'Alter, Herzkrankheit' } }),
        patho:{ tag:['kardiovaskulär','stauung'], severity:2, hypoxia_sensitivity:2, dehydration:0, baseline_deterioration:1 },
        hidden:{ vitals_baseline:v, pupils:'isokor', mouth:'schaumiger Speichel', lung:'basal feuchte RG beidseits', abdomen:'weich', ekg3:`Sinus ${v.Puls}/min`, ekg12:'Sinus' }
      };
    };

    const int_genAsthmaCOPD = () => {
      const v = vitals(jitter(130,10),jitter(80,8),jitter(90,4),jitter(28,5),jitter(104,10),110,36.8);
      return {
        diagnosis:'Akute obstruktive Exazerbation (Asthma/COPD)',
        story:'Bekannter Asthmatiker/COPD mit Giemen und verlängertem Exspirium.',
        key_findings:['Giemen',' verlängertes Exspirium','Dyspnoe'],
        red_flags:['Erschöpfung','Zyanose'],
        target_outcome:'Atemerleichternde Lagerung, O2 vorsichtig titriert, Monitoring.',
        patient:{ name:'Frau R.', age:66, sex:'w' },
        anamnesis: mkAnam({ SAMPLER:{ S:'Atemnot, pfeifende Atmung', A:'keine', M:'SABA bei Bedarf', P:'COPD/Asthma', L:'—', E:'Kälte/Infekt', R:'Raucherin' } }),
        patho:{ tag:['obstruktiv'], severity:2, hypoxia_sensitivity:3, dehydration:0, baseline_deterioration:1 },
        hidden:{ vitals_baseline:v, pupils:'isokor', mouth:'trocken', lung:'Giemen, exspiratorisch', abdomen:'weich', ekg3:`Sinus ${v.Puls}/min`, ekg12:'Sinus' }
      };
    };

    const int_genPE = () => {
      const v = vitals(jitter(120,10),jitter(75,8),jitter(90,4),jitter(24,4),jitter(108,12),110,37.0);
      return {
        diagnosis:'Lungenembolie (PE)',
        story:'Plötzliche Dyspnoe, stechender Thoraxschmerz, Tachykardie; Thromboserisiko.',
        key_findings:['plötzlich Dyspnoe','Tachykardie','Risikofaktoren'],
        red_flags:['Synkope','Hypoxie'],
        target_outcome:'Monitoring, O2, Transport mit PE-Verdacht.',
        patient:{ name:'Herr D.', age:58, sex:'m' },
        anamnesis: mkAnam({ SAMPLER:{ S:'plötzliche Atemnot, Thoraxschmerz', A:'keine', M:'—', P:'TVT vor 1 Jahr', L:'—', E:'nach langer Autofahrt', R:'Rauchen, Immobilisation' } }),
        patho:{ tag:['vaskulär'], severity:2, hypoxia_sensitivity:2, baseline_deterioration:1 },
        hidden:{ vitals_baseline:v, pupils:'isokor', mouth:'trocken', lung:'evtl. verminderte Atemgeräusche rechts', abdomen:'weich', ekg3:`Sinus ${v.Puls}/min`, ekg12:'Sinus' }
      };
    };

    const int_genHypogly = () => {
      const v = vitals(jitter(130,10),jitter(80,8),jitter(97,2),jitter(18,3),jitter(88,8),jitter(40,5),36.6,13);
      return {
        diagnosis:'Hypoglykämie bei Typ-1-Diabetes',
        story:'Verwirrtheit, Schweiß, Zittern, ggf. Krampf.',
        key_findings:['niedriger BZ','Schweiß','Bewusstsein reduziert'],
        red_flags:['Krampfanfall','Aspiration'],
        target_outcome:'BZ anheben (NotSan), Monitoring, Transport.',
        patient:{ name:'Lena T.', age:21, sex:'w' },
        anamnesis: mkAnam({ SAMPLER:{ S:'Schwitzen, Zittern, Übelkeit', A:'keine', M:'Insulin', P:'T1D', L:'nicht gegessen', E:'Sport/Überdosierung?', R:'—' } }),
        patho:{ tag:['metabolisch'], severity:2, hypoxia_sensitivity:0, baseline_deterioration:1 },
        hidden:{ vitals_baseline:v, pupils:'isokor', mouth:'feucht', lung:'unauff.', abdomen:'weich', ekg3:`Sinus ${v.Puls}/min`, ekg12:'Sinus' }
      };
    };

    const int_genDKA = () => {
      const v = vitals(jitter(110,10),jitter(70,8),jitter(95,2),jitter(26,3),jitter(102,8),jitter(380,25),37.2,14);
      return {
        diagnosis:'Diabetische Ketoazidose',
        story:'19-jähriger Typ-1-Diabetiker mit Durst, Polyurie, Bauchschmerzen, Kussmaul-Atmung.',
        key_findings:['Kussmaul-Atmung','hoher BZ','Exsikkose'],
        red_flags:['Bewusstseinsminderung möglich'],
        target_outcome:'Monitoring, zügiger Transport.',
        patient:{ name:'Max M.', age:19, sex:'m' },
        anamnesis: mkAnam({
          SAMPLER:{ S:'Durst, Polyurie, Bauchschmerzen, tiefe Atmung', A:'Penicillin (Exanthem)', M:'Insulin basal/bolus – unregelmäßig', P:'T1D seit 8J', L:'gestern Abend', E:'seit 2 Tagen Infekt/Übelkeit', R:'Dehydratation' },
          OPQRST:{ O:'seit 24 h', P:'keine', Q:'diffuser Bauchschmerz, krampfartig', R:'diffus', S:'6/10', T:'progredient' },
          vorerkrankungen:['T1D'], medikation:['Insulin glargin','Insulin lispro'], allergien:['Penicillin']
        }),
        patho:{ tag:['metabolisch','DKA'], severity:2, hypoxia_sensitivity:0, dehydration:2, baseline_deterioration:1 },
        hidden:{ vitals_baseline:v, pupils:'isokor', mouth:'Azetongeruch, trocken', lung:'tief, regelmäßig', abdomen:'diffus druckschmerzhaft', ekg3:`Sinus ${v.Puls}/min`, ekg12:'Sinus' }
      };
    };

    const int_genSepsisUrosepsis = () => {
      const v = vitals(jitter(105,12),jitter(65,8),jitter(94,2),jitter(24,4),jitter(112,12),110,38.9,14);
      return { diagnosis:'Sepsis (Urosepsis)', story:'Fieber, Schüttelfrost, Flankenschmerz, Hypotonie droht.', key_findings:['Fieber','Tachykardie','Hypotonie'], red_flags:['Verschlechterung, Schock'], target_outcome:'Monitoring, zügiger Transport.', patient:{name:'Frau K.',age:68,sex:'w'}, anamnesis: mkAnam({ SAMPLER:{ S:'Fieber, Schüttelfrost, Übelkeit', A:'—', M:'—', P:'rez. HWI', L:'—', E:'seit 24h', R:'Alter' } }), patho:{ tag:['infektiös'], severity:2, hypoxia_sensitivity:1, baseline_deterioration:1 }, hidden:{ vitals_baseline:v, pupils:'isokor', mouth:'trocken', lung:'tachypnoisch', abdomen:'Flankendruckschmerz', ekg3:`Sinus ${v.Puls}/min`, ekg12:'Sinus' } };
    };

    const int_genHypertensiveCrisis = () => {
      const v = vitals(jitter(200,15),jitter(110,10),jitter(96,2),jitter(18,3),jitter(98,8),110,36.8);
      return { diagnosis:'Hypertensiver Notfall/Krise', story:'Kopfschmerz, Schwindel, ggf. Übelkeit.', key_findings:['sehr hoher RR','Kopfschmerz'], red_flags:['neurologische Ausfälle','Thoraxschmerz'], target_outcome:'Monitoring, Neurologie/Kardiologie je nach Symptomen.', patient:{name:'Herr S.',age:62,sex:'m'}, anamnesis: mkAnam({ SAMPLER:{ S:'Kopfschmerz, Benommenheit', P:'Hypertonie', M:'Amlodipin, vergessene Einnahme', L:'—' } }), patho:{ tag:['kardiovaskulär'], severity:2, hypoxia_sensitivity:0, baseline_deterioration:1 }, hidden:{ vitals_baseline:v, pupils:'isokor', mouth:'—', lung:'unauff.', abdomen:'weich', ekg3:`Sinus ${v.Puls}/min`, ekg12:'LVH möglich' } };
    };

    const int_genAnaphylaxis = () => {
      const v = vitals(jitter(100,12),jitter(60,8),jitter(93,4),jitter(26,5),jitter(112,12),110,37.0);
      return { diagnosis:'Anaphylaxie (früh)', story:'Juckreiz, Quaddeln, Globusgefühl, Dyspnoe nach Allergen.', key_findings:['Urtikaria','Atemnot'], red_flags:['rasche Progredienz','Hypotonie'], target_outcome:'Allergen entfernen, O2, NA nachfordern.', patient:{name:'Mia L.',age:34,sex:'w'}, anamnesis: mkAnam({ SAMPLER:{ S:'Atemnot, Juckreiz', A:'Erdnuss', M:'—', P:'Heuschnupfen', L:'—', E:'nach Nussriegel', R:'—' } }), patho:{ tag:['allergisch','obstruktiv'], severity:2, hypoxia_sensitivity:3, baseline_deterioration:2 }, hidden:{ vitals_baseline:v, pupils:'isokor', mouth:'Ödem Zunge/uvula leicht', lung:'Giemen/Stridor', abdomen:'weich', ekg3:`Sinus ${v.Puls}/min`, ekg12:'Sinus' } };
    };

    const int_genGIbleed = () => {
      const v = vitals(jitter(105,12),jitter(65,8),jitter(97,2),jitter(20,3),jitter(110,10),110,36.7,15);
      return { diagnosis:'GI-Blutung (oberer GI-Trakt?)', story:'Schwarz gefärbter Stuhl/Bluterbrechen, Schwindel.', key_findings:['Meläna/Hämatemesis','Tachykardie'], red_flags:['Schockgefahr'], target_outcome:'Schonung, Monitoring, zügiger Transport.', patient:{name:'Herr A.',age:70,sex:'m'}, anamnesis: mkAnam({ SAMPLER:{ S:'Schwarzstuhl, Unwohlsein', A:'keine', M:'ASS 100', P:'Ulkus in der Vorgeschichte', L:'—', E:'seit heute früh', R:'ASS' } }), patho:{ tag:['blutung'], severity:2, hypoxia_sensitivity:0, baseline_deterioration:1 }, hidden:{ vitals_baseline:v, pupils:'isokor', mouth:'—', lung:'unauff.', abdomen:'epigastrisch empfindlich', ekg3:`Sinus ${v.Puls}/min`, ekg12:'Sinus' } };
    };

    // === NEUROLOGISCH ===
    const neuro_genStrokeRight = () => {
      const v = vitals(jitter(160,12),jitter(95,8),jitter(96,2),jitter(18,3),jitter(84,6),110,36.8);
      return { diagnosis:'ischämischer Schlaganfall (rechtshemisphärisch)', story:'akute Hemiparese links, Fazialisparese, Sprachstörung.', key_findings:['BEFAST+','RR↑'], red_flags:['Zeitfenster!'], target_outcome:'FAST/BEFAST, Monitoring, Stroke-Unit.', patient:{name:'Frau N.',age:74,sex:'w'}, anamnesis: mkAnam({ SAMPLER:{ S:'Schwäche links, Sprachprobleme', P:'Hypertonie, Vorhofflimmern', M:'Marcumar? / NOAK', L:'—', E:'plötzlich', R:'Alter, HTN, VHF' } }), patho:{ tag:['neurologisch','ischämie'], severity:2, baseline_deterioration:1 }, hidden:{ vitals_baseline:v, pupils:'isokor', mouth:'—', lung:'unauff.', abdomen:'weich', ekg3:`Vorhofflimmern ${v.Puls}/min`, ekg12:'VHF', befast:'positiv (links)', neuro:'Links-Arm/Bein schwach' } };
    };

    const neuro_genStrokeLeft = () => {
      const v = vitals(jitter(165,12),jitter(98,8),jitter(96,2),jitter(18,3),jitter(86,6),110,36.8);
      return { diagnosis:'ischämischer Schlaganfall (linkshemisphärisch)', story:'akute Aphasie/Sprachstörung, Hemiparese rechts.', key_findings:['BEFAST+','RR↑'], red_flags:['Zeitfenster!'], target_outcome:'FAST/BEFAST, Monitoring, Stroke-Unit.', patient:{name:'Herr O.',age:76,sex:'m'}, anamnesis: mkAnam({ SAMPLER:{ S:'Sprachstörung, Schwäche rechts', P:'Hypertonie, DM2', M:'Metformin', L:'—', E:'plötzlich', R:'Alter, HTN' } }), patho:{ tag:['neurologisch','ischämie'], severity:2, baseline_deterioration:1 }, hidden:{ vitals_baseline:v, pupils:'isokor', lung:'unauff.', ekg3:`Sinus ${v.Puls}/min`, ekg12:'Sinus', befast:'positiv (rechts)', neuro:'Rechts-Arm/Bein schwach' } };
    };

    const neuro_genTIA = () => {
      const v = vitals(jitter(150,10),jitter(90,8),jitter(97,2),jitter(18,3),jitter(80,6),110,36.7);
      return { diagnosis:'TIA', story:'kurzzeitige Lähmungs-/Sprachsymptome, aktuell regredient.', key_findings:['neurol. Symptome regredient'], red_flags:['Rezidiv'], target_outcome:'Monitoring, Stroke-Abklärung.', patient:{name:'—',age:72,sex:'w'}, anamnesis: mkAnam({ SAMPLER:{ S:'vorübergehende Sprachstörung', P:'HTN', M:'—', E:'vor 30 min begonnen, jetzt besser' } }), patho:{ tag:['neurologisch'], severity:1, baseline_deterioration:0 }, hidden:{ vitals_baseline:v, befast:'grenzwertig', neuro:'o.B.' } };
    };

    const neuro_genPostictal = () => {
      const v = vitals(jitter(135,10),jitter(85,8),jitter(95,2),jitter(20,3),jitter(105,10),110,36.8,13);
      return { diagnosis:'Postiktaler Zustand (Entzug?)', story:'abgelaufener Krampfanfall, eingenässt, Zungenbiss, zunehmend wacher.', key_findings:['Zungenbiss','postiktal'], red_flags:['erneuter Anfall'], target_outcome:'Schutz, Seitenlage bei Bedarf, Monitoring.', patient:{name:'Eddi S.',age:49,sex:'m'}, anamnesis: mkAnam({ SAMPLER:{ S:'Krampf am ganzen Körper (2 min), jetzt schläfrig', A:'keine', M:'keine', P:'Alkoholabhängigkeit, versucht Entzug', L:'Frühstück', E:'beim Fernsehen', R:'Alkohol' } }), patho:{ tag:['neurologisch','postiktal'], severity:1, baseline_deterioration:0 }, hidden:{ vitals_baseline:v, pupils:'isokor', mouth:'Zungenbiss', lung:'schnarchend', abdomen:'weich', befast:'negativ', neuro:'schläfrig, orientierung zunehmend' } };
    };

    const neuro_genICH = () => {
      const v = vitals(jitter(180,15),jitter(105,10),jitter(96,2),jitter(18,3),jitter(82,6),110,36.7,13);
      return { diagnosis:'intrazerebrale Blutung', story:'plötzlich stärkster Kopfschmerz, Erbrechen, Vigilanz↓.', key_findings:['RR sehr hoch','neurologische Ausfälle'], red_flags:['Bewusstseinseintrübung'], target_outcome:'Monitoring, NA nachfordern.', patient:{name:'—',age:69,sex:'w'}, anamnesis: mkAnam({ SAMPLER:{ S:'heftiger Kopfschmerz, Übelkeit', P:'HTN', M:'—', L:'—', E:'plötzlich' } }), patho:{ tag:['neurologisch','blutung'], severity:3, baseline_deterioration:2 }, hidden:{ vitals_baseline:v, pupils:'weit/reaktionsarm möglich', befast:'positiv?', neuro:'Vigilanz↓' } };
    };

    const neuro_genMeningitis = () => {
      const v = vitals(jitter(120,10),jitter(75,8),jitter(95,3),jitter(22,4),jitter(108,10),110,39.2,14);
      return { diagnosis:'Meningitis', story:'Fieber, Kopfschmerz, Nackensteife, Lichtscheu.', key_findings:['Fieber','Meningismus'], red_flags:['Bewusstsein↓'], target_outcome:'Monitoring, Isolationshinweis.', patient:{name:'—',age:30,sex:'m'}, anamnesis: mkAnam({ SAMPLER:{ S:'starker Kopfschmerz, Nackensteife', A:'—', M:'—', P:'—', L:'—', E:'seit gestern', R:'—' } }), patho:{ tag:['infektiös','neurologisch'], severity:2, baseline_deterioration:1 }, hidden:{ vitals_baseline:v, pupils:'isokor', neuro:'Meningismus', befast:'—' } };
    };

    const neuro_genGuillainBarre = () => {
      const v = vitals(jitter(125,10),jitter(80,8),jitter(96,2),jitter(18,3),jitter(84,6),110,36.8);
      return { diagnosis:'Guillain-Barré-Syndrom (früh)', story:'aufsteigende Schwäche, Parästhesien, Infekt vorausgegangen.', key_findings:['aufsteigende Parese'], red_flags:['Ateminsuffizienz'], target_outcome:'Monitoring, Atemfrequenz/VC beachten.', patient:{name:'—',age:28,sex:'w'}, anamnesis: mkAnam({ SAMPLER:{ S:'Schwäche Beine, Kribbeln', E:'1 Woche nach Infekt', R:'—' } }), patho:{ tag:['neurologisch','neuromuskulär'], severity:2, baseline_deterioration:1 }, hidden:{ vitals_baseline:v, neuro:'areflexie distal', befast:'negativ' } };
    };

    const neuro_genMigraine = () => {
      const v = vitals(jitter(130,10),jitter(80,8),jitter(98,1),jitter(16,2),jitter(80,6),110,36.7);
      return { diagnosis:'Migräneattacke', story:'pulsierender Kopfschmerz, Photophobie, Übelkeit.', key_findings:['Lichtscheu','einseitiger Schmerz'], red_flags:['Thunderclap? nein'], target_outcome:'Abdunkeln, Ruhe, Monitoring.', patient:{name:'—',age:24,sex:'w'}, anamnesis: mkAnam({ SAMPLER:{ S:'Kopfschmerz links, Übelkeit', P:'Migräne bekannt', E:'Aura vorher' } }), patho:{ tag:['neurologisch','benigne'], severity:1, baseline_deterioration:0 }, hidden:{ vitals_baseline:v } };
    };

    const neuro_genBellPalsy = () => {
      const v = vitals(jitter(135,10),jitter(80,8),jitter(98,1),jitter(16,2),jitter(84,6),110,36.7);
      return { diagnosis:'periphere Fazialisparese (Bell-Parese)', story:'akute Gesichtslähmung, Stirnmitbewegung fehlt.', key_findings:['periphere Fazialisparese'], red_flags:['Stroke-Differenzial'], target_outcome:'BEFAST, Monitoring, Differenzialdiagnose.', patient:{name:'—',age:45,sex:'m'}, anamnesis: mkAnam({ SAMPLER:{ S:'Gesichtslähmung links', E:'plötzlich', R:'—' } }), patho:{ tag:['neurologisch'], severity:1, baseline_deterioration:0 }, hidden:{ vitals_baseline:v, neuro:'periphere Fazialisparese links', befast:'negativ' } };
    };

    const neuro_genSyncope = () => {
      const v = vitals(jitter(115,10),jitter(70,8),jitter(98,1),jitter(18,2),jitter(78,6),110,36.6);
      return { diagnosis:'Synkope (unklar)', story:'kurzzeitige Bewusstlosigkeit, aktuell beschwerdefrei.', key_findings:['kurz OH', 'Prodromi?'], red_flags:['Trauma?', 'kardial?'], target_outcome:'Monitoring, EKG, Anamnese.', patient:{name:'—',age:40,sex:'w'}, anamnesis: mkAnam({ SAMPLER:{ S:'Schwarz vor Augen, Schweiß', E:'stehend in warmem Raum', R:'—' } }), patho:{ tag:['kardiovaskulär'], severity:1, baseline_deterioration:0 }, hidden:{ vitals_baseline:v } };
    };

    const neuro_genToxicMetabolic = () => {
      const v = vitals(jitter(120,10),jitter(75,8),jitter(96,2),jitter(18,3),jitter(90,8),jitter(65,8),36.6,14);
      return { diagnosis:'toxisch-metabolisch (z. B. Hypoglykämie/Intox)', story:'Vigilanzminderung, ggf. Alkohol/Medikamente.', key_findings:['GCS↓','abweichende BZ'], red_flags:['Atemweg sichern'], target_outcome:'Monitoring, Ursachen suchen.', patient:{name:'—',age:52,sex:'m'}, anamnesis: mkAnam({ SAMPLER:{ S:'müde, verwirrt', A:'—', M:'—', P:'—', L:'—', E:'—' } }), patho:{ tag:['metabolisch'], severity:2, baseline_deterioration:1 }, hidden:{ vitals_baseline:v } };
    };

    // === TRAUMA (Auswahl) ===
    const tr_genSpineTrauma = () => {
      const v = vitals(jitter(125,12),jitter(80,8),98,22,108,110,36.8,15);
      return { diagnosis:'Wirbelsäulentrauma (BWS/LWS)', story:'Sturz vom Pferd, Rücken-Schmerz, DMS erhalten.', key_findings:['Rückenschmerz','DMS prüfen'], red_flags:['neurologische Ausfälle','starke Schmerzen'], target_outcome:'Immobilisation nach lokalem Standard, DMS, Monitoring.', patient:{name:'Manuela D.',age:25,sex:'w'}, anamnesis: mkAnam({ SAMPLER:{ S:'Rückenschmerz mit Ausstrahlung in Beine', A:'keine', M:'keine', P:'alte Handgelenksfrakturen', L:'Frühstück', E:'vom Pferd gestürzt', R:'—' }, OPQRST:{ O:'vor 10 min', P:'Bewegung verstärkt', Q:'dumpf', R:'BWS/LWS', S:'4 in Ruhe / 7 bei Bewegung', T:'gleichbleibend' } }), patho:{ tag:['trauma'], severity:2, baseline_deterioration:0 }, hidden:{ vitals_baseline:v, pupils:'isokor', lung:'leicht beschl.', abdomen:'unauff.', neuro:'DMS Beine o.B.' } };
    };

    const tr_genRibFractures = () => { const v=vitals(jitter(130,10),jitter(80,8),96,22,105,110,36.9); return { diagnosis:'Rippenfrakturen', story:'Stumpfes Thoraxtrauma, atemabhängiger Schmerz.', key_findings:['lokaler Druckschmerz','Schonatmung'], red_flags:['Pneumothorax?'], target_outcome:'Schmerzreduktion (Kälte), Monitoring.', patient:{name:'—',age:45,sex:'m'}, anamnesis: mkAnam({ OPQRST:{ O:'seit 30 min', P:'Atem/Bewegung', Q:'stechend', R:'rechts lateral', S:'6/10', T:'gleichbleibend' } }), patho:{ tag:['trauma'], severity:1, baseline_deterioration:0 }, hidden:{ vitals_baseline:v } } };

    const tr_genPneumothorax = () => { const v=vitals(jitter(120,10),jitter(75,8),92,26,110,110,36.8); return { diagnosis:'(Spannungs-)Pneumothorax?', story:'stumpfes Thoraxtrauma, plötzliche Dyspnoe, einseitig abgeschwächtes AG.', key_findings:['einseitig leiser','Hypoxie'], red_flags:['Verschlechterung → NA'], target_outcome:'O2, Monitoring, NA.', patho:{ tag:['trauma','obstruktiv'], severity:3, hypoxia_sensitivity:3, baseline_deterioration:2 }, hidden:{ vitals_baseline:v, lung:'links abgeschwächt', ekg3:`Sinus ${v.Puls}/min` } } };

    // Pools
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
      trauma: [ tr_genSpineTrauma, tr_genRibFractures, tr_genPneumothorax ]
    };

    const chosenPool = (POOLS[normalized] && POOLS[normalized].length)
      ? POOLS[normalized]
      : POOLS.internistisch;

    const scenarioGen = randPick(chosenPool);
    const scenario    = scenarioGen();

    const caseData = {
      id: newId(),
      specialty: normalized,
      difficulty,
      role,
      story: scenario.story,
      initial_vitals: null,
      key_findings: scenario.key_findings,
      red_flags: scenario.red_flags,
      target_outcome: scenario.target_outcome,
      scope: SCOPE,
      steps_done: [],
      score: 0,
      hidden: scenario.hidden,
      patient: scenario.patient || null,
      anamnesis: scenario.anamnesis || null,
      patho: scenario.patho || null,
      solution: { diagnosis: scenario.diagnosis, justification: scenario.key_findings }
    };

    return { statusCode: 200, headers, body: JSON.stringify(caseData) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}


