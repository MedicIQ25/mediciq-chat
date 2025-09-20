// netlify/functions/case-step.js
export async function handler(event) {
  // ===== 1) CORS =====
  const ALLOWED_ORIGINS = [
    'https://www.mediciq.de',
    'https://mediciq.de',
    'https://mediciq.webflow.io'
  ];
  const reqOrigin = event.headers.origin || event.headers.Origin || '';
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
    // ===== 2) Input =====
    const { case_state, user_action, role = 'RS' } = JSON.parse(event.body || '{}');
    if (!case_state || !user_action) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'case_state oder user_action fehlt' }) };
    }

    // ===== 3) Helfer =====
    const uaRaw = String(user_action || '');
    const ua = uaRaw.trim().toLowerCase();

    const includesAny = (txt, arr) => arr.some(k => txt.includes(k));
    const pick = (obj, k, fallback) => (obj && obj[k] != null ? obj[k] : fallback);

    // ===== 4) Patient / Fall konstruieren (Default + Case) =====
    const initialVitals = case_state.vitals || case_state.initial_vitals || {};
    const patient = {
      id: case_state.id || 'fall',
      age: pick(case_state, 'age', 65),
      sex: pick(case_state, 'sex', 'm'),
      complaint: pick(case_state, 'complaint', 'akute Brustschmerzen und Atemnot'),
      history: case_state.history || ['Hypertonie', 'Diabetes'],
      meds: case_state.meds || ['Metformin', 'Amlodipin'],
      allergies: case_state.allergies || 'keine Allergien bekannt',
      risks: case_state.risks || { smoker: false, alcohol: 'gelegentlich' },
      // Aktuelle Vitalwerte
      vitals: {
        RR: pick(initialVitals, 'RR', '140/90'),
        SpO2: pick(initialVitals, 'SpO2', 92),
        AF: pick(initialVitals, 'AF', 18),
        Puls: pick(initialVitals, 'Puls', 88),
        BZ: pick(initialVitals, 'BZ', 150),
        Temp: pick(initialVitals, 'Temp', 37.2),
        GCS: pick(initialVitals, 'GCS', 15)
      },
      // Beispielbefunde (können bei Fallgenerierung künftig dynamisch kommen)
      exam: case_state.exam || {
        airway: { mouth: 'Mundraum frei, keine Aspiration, Zunge mittig.' },
        breathing: {
          inspection: 'Atemarbeit leicht erhöht.',
          auscultation: 'Beidseits vesikuläres Atemgeräusch, keine Rasselgeräusche.'
        },
        circulation: {
          skin: 'Haut warm, rosig, trockene Haut.',
          cap_refill: 'Kapilläre Füllung < 2 s.'
        },
        neuro: {
          pupils: 'Pupillen isokor und prompt lichtreagibel.',
          status: 'GCS 15, orientiert x3, keine fokal-neurologischen Ausfälle.'
        },
        abdomen: 'Weich, kein Abwehrschmerz, Darmgeräusche vorhanden.',
        pain: { nrs: 6, location: 'retrosternal', character: 'drückend' }
      },
      ekg: case_state.ekg || {
        rhythm: 'Sinusrhythmus',
        rate: 90,
        st: 'keine ST-Hebungen',
        remarks: 'keine akuten Ischämiezeichen'
      }
    };

    // ===== 5) Ergebnis-Grundgerüst =====
    let result = {
      accepted: false,
      outside_scope: false,
      unsafe: false,
      score_delta: 0,
      rationale: '',
      next_hint: '',
      updated_vitals: null,
      
      done: false
    };

    // ===== 6) Maßnahmen-Logik (therapeutisch) =====
    const allowed_actions_RS = [
      'eigenschutz', 'umfeld sichern',
      'patientenansprache', 'bewusstsein prüfen', 'avpu', 'gcs',
      'abcde', 'primary survey',
      'monitoring', 'rr', 'spO2', 'puls', 'af', 'bz',
      'lagerung', 'wärmeerhalt', 'psychologische betreuung',
      'o2', 'sauerstoff', 'sauerstoffgabe',
      'notarzt nachfordern', 'übergabe',
      'vitalzeichenkontrolle',
      'puls messen', 'blutdruck', 'blutdruckmessung',
      'kapillarfüllung', 'rekap', 'rekapillarisierungszeit',
      'pupillenreaktion', 'pupillen prüfen',
      'pulsoxymetrie',
      'temperaturmessung',
      'ekg', 'monitoring ekg', '12-kanal-ekg',
      'mund-rachen-inspektion',
      'fremdkörper entfernen', 'absaugen',
      'kopf überstrecken', 'esmarch', 'kreuzgriff',
      'stabile seitenlage',
      'guedel', 'wendl',
      'beutel-maske', 'beatmung',
      'larynxmaske', 'larynxtubus',
      'aed', 'defibrillator',
      'schock einschätzen', 'schocklagerung',
      'blutung stillen', 'druckverband', 'tourniquet',
      'verband', 'dms-kontrolle',
      'helmabnahme', 'rautek',
      'heimlich',
      'kühlung', 'wärmen',
      'rettung aus wasser'
    ];

    const therapeuticMatched = () => {
      // O2-Gabe
      if (includesAny(ua, ['o2', 'sauerstoff'])) {
        result.accepted = true;
        result.score_delta = 1;
        result.rationale = 'Sauerstoffgabe indiziert bei Dyspnoe/SpO2 < 94%.';
        const newSpO2 = Math.min(100, Number(patient.vitals.SpO2) + 2);
        result.updated_vitals = { ...patient.vitals, SpO2: newSpO2 };
        result.next_hint = 'Monitoring fortführen, Schmerzskala erheben, EKG ableiten.';
        return true;
      }

      // EKG
      if (includesAny(ua, ['ekg'])) {
        result.accepted = true;
        result.score_delta = 1;
        result.rationale = `EKG erhoben: ${patient.ekg.rhythmus || patient.ekg.rhythm || 'Sinusrhythmus'}, Frequenz ${patient.ekg.rate || 90}/min, ${patient.ekg.st || 'keine ST-Hebungen'}.`;
        result.next_hint = 'Monitoring fortführen, erneute EKG-Kontrolle bei Symptomänderung.';
        return true;
      }

      // Monitoring / Vitalzeichen
      if (includesAny(ua, ['monitoring', 'rr', 'blutdruck', 'spO2', 'puls', 'af'])) {
        result.accepted = true;
        result.score_delta = 1;
        result.rationale = `Monitoring durchgeführt. RR: ${patient.vitals.RR}, SpO₂: ${patient.vitals.SpO2}%, AF: ${patient.vitals.AF}/min, Puls: ${patient.vitals.Puls}/min.`;
        result.next_hint = 'Schmerzskala erheben, EKG ableiten, Atemwege/Lunge prüfen.';
        return true;
      }

      // Schmerzen erfassen
      if (includesAny(ua, ['schmerz', 'nrs'])) {
        const nrs = pick(patient.exam.pain, 'nrs', 6);
        result.accepted = true;
        result.score_delta = 1;
        result.rationale = `Schmerzskala erhoben: NRS ${nrs}/10, ${patient.exam.pain.character || 'drückend'} retrosternal.`;
        result.next_hint = 'EKG ableiten, Monitoring, erneute Re-Evaluation.';
        return true;
      }

      // Standard: Wenn eine RS-Maßnahme genannt wird, aber oben nicht gesondert behandelt:
      if (includesAny(ua, allowed_actions_RS)) {
        result.accepted = true;
        result.score_delta = 1;
        result.rationale = 'Maßnahme ist im Kompetenzbereich und sinnvoll.';
        result.next_hint = 'ABCDE weiterführen, Monitoring & Reevaluation.';
        return true;
      }
      return false;
    };

    // ===== 7) Diagnostik-Logik (konkrete Befunde liefern) =====
    const diagnosticsMatched = () => {
      // Vorerkrankungen / Anamnese
      if (includesAny(ua, ['vorerkrank', 'anamnese'])) {
        result.accepted = true;
        result.score_delta = 1;
        result.rationale = `Vorerkrankungen: ${patient.history.join(', ')}.`;
        result.next_hint = 'Medikamente und Allergien abfragen.';
        return true;
      }

      // Medikamente / Allergien
      if (includesAny(ua, ['medikament'])) {
        result.accepted = true;
        result.score_delta = 1;
        result.rationale = `Aktuelle Medikation: ${patient.meds.join(', ')}.`;
        result.next_hint = 'Allergien erfragen.';
        return true;
      }
      if (includesAny(ua, ['allergie'])) {
        result.accepted = true;
        result.score_delta = 1;
        result.rationale = `Allergien: ${patient.allergies}.`;
        result.next_hint = 'ABCDE weiterführen.';
        return true;
      }

      // Mundraum / Atemwege
      if (includesAny(ua, ['mundraum', 'mund-raum', 'mund'])) {
        result.accepted = true;
        result.score_delta = 1;
        result.rationale = patient.exam.airway.mouth || 'Mundraum unauffällig.';
        result.next_hint = 'Atemwege/Lunge inspizieren und auskultieren.';
        return true;
      }

      // Pupillen
      if (includesAny(ua, ['pupille', 'pupillen'])) {
        result.accepted = true;
        result.score_delta = 1;
        result.rationale = patient.exam.neuro.pupils || 'Pupillen beidseits isokor, lichtreagibel.';
        result.next_hint = 'Neurologischen Status prüfen.';
        return true;
      }

      // Neurologie
      if (includesAny(ua, ['neurolog', 'neurologie', 'gcs'])) {
        result.accepted = true;
        result.score_delta = 1;
        const gcsTxt = `GCS ${patient.vitals.GCS}`;
        result.rationale = `${patient.exam.neuro.status || 'Keine fokal-neurologischen Defizite.'} (${gcsTxt}).`;
        result.next_hint = 'Weiter mit ABCDE und Monitoring.';
        return true;
      }

      // Lunge
      if (includesAny(ua, ['auskult', 'lunge', 'thorax'])) {
        result.accepted = true;
        result.score_delta = 1;
        const inspektion = patient.exam.breathing.inspection || 'Atemarbeit unauffällig.';
        const ausk = patient.exam.breathing.auscultation || 'Vesikuläres Atemgeräusch beidseits, keine Rasselgeräusche.';
        result.rationale = `Inspektion: ${inspektion} Auskultation: ${ausk}`;
        result.next_hint = 'SpO₂, AF und ggf. O₂-Therapie beurteilen.';
        return true;
      }

      // Haut / Kapillarfüllung
      if (includesAny(ua, ['haut', 'kapillar', 'rekap'])) {
        result.accepted = true;
        result.score_delta = 1;
        const skin = patient.circulation?.skin || patient.exam.circulation?.skin || 'warm, rosig, trocken';
        const cap = patient.circulation?.cap_refill || patient.exam.circulation?.cap_refill || '< 2 s';
        result.rationale = `Haut: ${skin}. Kapilläre Füllung: ${cap}.`;
        result.next_hint = 'RR/Puls prüfen, Schockzeichen beachten.';
        return true;
      }

      // Abdomen
      if (includesAny(ua, ['abdomen', 'bauch'])) {
        result.accepted = true;
        result.score_delta = 1;
        result.rationale = patient.exam.abdomen || 'Abdomen weich, kein Abwehrschmerz, Darmgeräusche vorhanden.';
        result.next_hint = 'ABCDE fortführen.';
        return true;
      }

      // Vitalwerte abfragen
      if (includesAny(ua, ['spO2', 'sättigung'])) {
        result.accepted = true;
        result.score_delta = 1;
        result.rationale = `SpO₂: ${patient.vitals.SpO2}%.`;
        result.next_hint = 'Bei SpO₂ < 94% O₂-Gabe erwägen.';
        return true;
      }
      if (includesAny(ua, ['blutdruck', 'rr'])) {
        result.accepted = true;
        result.score_delta = 1;
        result.rationale = `RR: ${patient.vitals.RR}. Puls: ${patient.vitals.Puls}/min.`;
        result.next_hint = 'Monitoring fortführen, Kreislauf im Blick behalten.';
        return true;
      }
      if (includesAny(ua, ['bz', 'blutzucker'])) {
        result.accepted = true;
        result.score_delta = 1;
        const newBZ = patient.vitals.BZ; // hier optional anpassen/aktualisieren
        result.rationale = `Blutzucker gemessen: ${newBZ} mg/dl.`;
        result.next_hint = 'ABCDE fortführen, EKG erwägen.';
        return true;
      }
      if (includesAny(ua, ['temperatur', 'temp'])) {
        result.accepted = true;
        result.score_delta = 1;
        result.rationale = `Temperatur: ${patient.vitals.Temp}°C.`;
        result.next_hint = 'Gesamtbild beurteilen, Infektionszeichen?';
        return true;
      }

      // EKG-Befund (diagnostisch abgefragt, nicht als Maßnahme)
      if (includesAny(ua, ['ekg-befund', 'ekg befund', 'ekg ergebnis'])) {
        result.accepted = true;
        result.score_delta = 1;
        result.rationale = `EKG: ${patient.ekg.rhythm || 'Sinusrhythmus'}, ${patient.ekg.rate || 90}/min, ${patient.ekg.st || 'keine ST-Hebungen'} (${patient.ekg.remarks || 'unauffällig'}).`;
        result.next_hint = 'Bei Änderung der Symptome EKG wiederholen.';
        return true;
      }

      // Generischer Befund-Request („Befund?“)
      if (includesAny(ua, ['befund', 'was ist der befund', 'was sehe ich'])) {
        result.accepted = true;
        result.score_delta = 1;
        result.rationale = 'Befundübersicht: Atemwege frei, Lunge vesikulär, Haut warm/rosig, Pupillen isokor, Abdomen weich, GCS 15.';
        result.next_hint = 'Monitoring/Schmerzskala/12-Kanal-EKG fortsetzen.';
        return true;
      }

      return false;
    };

    // ===== 8) Reihenfolge: erst Diagnostik, dann Therapie prüfen =====
    const hitDiag = diagnosticsMatched();
    const hitTher = !hitDiag && therapeuticMatched();

    if (!hitDiag && !hitTher) {
      // Weder Diagnostik noch Maßnahme erkannt -> neutraler Hinweis
      result.accepted = false;
      result.score_delta = 0;
      result.rationale = 'Aktion nicht eindeutig zuordenbar. Beispiele: „Mundraum inspizieren“, „Pupillen prüfen“, „EKG ableiten“, „O₂ geben“, „BZ messen“, „RR messen“, „Auskultation Lunge“, „Schmerzskala erheben“.';
      result.next_hint = 'Nutze klare, kurze Aktions-/Befund-Statements (z. B. „Mundraum schauen“, „Pupillen prüfen“, „EKG schreiben“).';
    }

    // ===== 9) Rückgabe =====
    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
