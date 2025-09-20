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

    // ===== 3) Normalisieren =====
    const ua = String(user_action).toLowerCase().trim();

    // Vitalwerte vorsichtig in Zahlen wandeln (wenn möglich)
    const v = { ...(case_state.initial_vitals || {}) };
    const num = (x) => (typeof x === 'number' ? x : (parseFloat(String(x).replace(',', '.')) || 0));
    const vitals = {
      RR: v.RR ?? '120/80',
      SpO2: num(v.SpO2 || 96),
      AF: num(v.AF || 14),
      Puls: num(v.Puls || 80),
      BZ: num(v.BZ || 100),
      Temp: num(v.Temp || 36.8),
      GCS: num(v.GCS || 15),
    };

    // ===== 4) Ergebnis-Grundgerüst =====
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

    // ===== 5) Hilfsfunktionen =====
    const includesAny = (str, arr) => arr.some(k => str.includes(k));
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

    const accept = (why, next = '', delta = 1, updateVitals = null) => {
      result.accepted = true;
      result.score_delta = delta;
      result.rationale = why;
      result.next_hint = next;
      if (updateVitals) result.updated_vitals = updateVitals;
    };
    const decline = (why, next = '', delta = 0) => {
      result.accepted = false;
      result.score_delta = delta;
      result.rationale = why;
      result.next_hint = next;
    };
    const outOfScope = (why, next = '') => {
      result.accepted = false;
      result.outside_scope = true;
      result.score_delta = 0;
      result.rationale = why;
      result.next_hint = next || 'Bitte im Rahmen der Kompetenz bleiben oder Notarzt hinzuziehen.';
    };
    const unsafe = (why, next = '') => {
      result.accepted = false;
      result.unsafe = true;
      result.score_delta = -1;
      result.rationale = why;
      result.next_hint = next || 'Sichere Vorgehensweise wählen.';
    };

    // ===== 6) Maßnahmen-Heuristiken =====
    // (Reihenfolge: spezifisch → generisch)

    // --- Eigenschutz / Lagebild ---
    if (includesAny(ua, ['eigenschutz', 'umfeld sichern', 'einsatzstelle sichern', 'lagesicherung'])) {
      accept('Eigenschutz und Umfeldsicherung haben Priorität.', 'ABCDE-Assessment beginnen.');
    }

    // --- ABCDE / Bewusstsein / Atemkontrolle ---
    else if (includesAny(ua, ['abcde', 'bewusstsein prüfen', 'avpu', 'gcs prüfen', 'atmen prüfen', 'atmung prüfen'])) {
      accept('ABCDE/Primärcheck ist sinnvoll.', 'Atemwege sichern, Monitoring und Anamnese.');
    }

    // --- Atemwege freimachen / Esmarch / Absaugen / Guedel/Wendl ---
    else if (includesAny(ua, ['atemweg', 'atemwege sichern', 'freimachen', 'absaugen', 'magill', 'esmarch', 'kopf überstrecken'])) {
      accept('Atemwege sichern ist indiziert.', 'O2-Gabe je nach SpO₂, Monitoring fortsetzen.');
    }
    else if (includesAny(ua, ['guedel', 'wendl', 'nasenweg', 'oropharyngeal'])) {
      accept('Atemwegshilfen können bei Bewusstseinsstörung sinnvoll sein.', 'Überwachung und O₂ je nach SpO₂.');
    }

    // --- Beutel-Masken-Beatmung ---
    else if (includesAny(ua, ['beutel-masken', 'beutelmasken', 'bvm', 'beatmung'])) {
      accept('Beutel-Masken-Beatmung ist bei Hypoventilation/Atemstillstand korrekt.', 'Monitoring und Vorbereitung Transport.');
      result.updated_vitals = { ...vitals, SpO2: clamp(vitals.SpO2 + 3, 0, 100), AF: clamp(vitals.AF + 2, 0, 60) };
    }

    // --- O₂-Gabe ---
    else if (includesAny(ua, ['o2', 'sauerstoff'])) {
      const newSpO2 = clamp(vitals.SpO2 + 2, 0, 100);
      accept('Sauerstoffgabe ist in dieser Situation indiziert.', 'Monitoring und EKG durchführen.', 1,
        { ...vitals, SpO2: newSpO2 });
    }

    // --- Lagerung ---
    else if (includesAny(ua, ['oberkörper hoch', 'ok-hoch', 'oberkörperhoch'])) {
      accept('Oberkörperhochlagerung kann Dyspnoe entlasten.', 'Monitoring fortsetzen.');
    }
    else if (includesAny(ua, ['stabile seitenlage'])) {
      accept('Stabile Seitenlage ist bei Bewusstlosigkeit mit erhaltener Atmung sinnvoll.', 'Monitoring, O₂ je nach SpO₂.');
    }
    else if (includesAny(ua, ['schocklage'])) {
      // Vorsicht – kann bei ACS/Trauma kontraindiziert sein → neutral/leicht positiv
      accept('Schocklage kann kurzfristig sinnvoll sein, Kontraindikationen beachten.', 'Ursache adressieren, Monitoring.', 0);
    }
    else if (includesAny(ua, ['wärmeerhalt', 'wärme erhalten', 'decken', 'rettungsdecke'])) {
      accept('Wärmeerhalt ist sinnvoll.', 'Vitalwerte regelmäßig kontrollieren.');
    }

    // --- Monitoring / EKG / Vitalwerte ---
    else if (includesAny(ua, ['monitoring', 'überwachung', 'rr messen', 'blutdruck', 'puls messen', 'spo2 messen', 'sättigung messen'])) {
      accept('Monitoring/Vitalzeichenkontrolle ist korrekt.', 'EKG, Anamnese, Schmerzskala/FAST je nach Lage.');
    }
    else if (includesAny(ua, ['ekg'])) {
      accept('EKG ist in dieser Situation sinnvoll.', 'Schmerzskala/Anamnese und Monitoring fortsetzen.');
    }
    else if (includesAny(ua, ['bz', 'blutzucker'])) {
      accept('BZ-Messung ist sinnvoll (z. B. bei Bewusstseinsstörung, ACS).', 'Weitere Diagnostik/Monitoring fortsetzen.');
    }
    else if (includesAny(ua, ['temperatur', 'temp messen', 'fieber'])) {
      accept('Temperaturmessung ist sinnvoll.', 'Weitere ABCDE-Schritte und Monitoring.');
    }
    else if (includesAny(ua, ['pupillen', 'rekap', 'rekapillarisierung'])) {
      accept('Pupillen-/Durchblutungskontrolle ist sinnvoll.', 'Monitoring/Vitalwerte fortführen.');
    }
    else if (includesAny(ua, ['schmerzskala', 'nrs', 'schmerz einschätzen'])) {
      accept('Schmerzskala/NRS erheben ist sinnvoll.', 'Monitoring und EKG fortsetzen.');
    }
    else if (includesAny(ua, ['fast', 'stroke check'])) {
      accept('FAST (Stroke-Screening) ist sinnvoll bei neurologischen Symptomen.', 'Monitoring und zeitkritischen Transport planen.');
    }
    else if (includesAny(ua, ['gcs'])) {
      accept('GCS-Bewertung ist sinnvoll.', 'Monitoring und ABCDE fortführen.');
    }

    // --- Blutung / Wunde / Immobilisation ---
    else if (includesAny(ua, ['druckverband', 'blutung stillen', 'blutstillung'])) {
      accept('Direkte Blutstillung/Druckverband ist korrekt.', 'DMS kontrollieren, Monitoring.');
    }
    else if (includesAny(ua, ['tourniquet', 'abbinden'])) {
      accept('Tourniquet bei starker Blutung ist korrekt.', 'Zeit dokumentieren, Monitoring.', 1);
    }
    else if (includesAny(ua, ['wundabdeckung', 'steril abdecken', 'feuchte abdeckung'])) {
      accept('Sterile Wundabdeckung ist korrekt.', 'Schmerzmanagement/Monitoring.');
    }
    else if (includesAny(ua, ['immobilisation', 'schiene', 'vakuumschiene', 'becken', 'beckenschlinge', 'ked', 'vakuummatratze'])) {
      accept('Schonende Immobilisation/Beckenschlinge ist korrekt.', 'DMS kontrollieren, Monitoring.');
    }

    // --- Notarzt / Übergabe ---
    else if (includesAny(ua, ['notarzt', 'na nachfordern'])) {
      accept('Notarzt anfordern kann sinnvoll sein.', 'Bis zum Eintreffen Monitoring und Maßnahmen fortsetzen.', 0);
    }
    else if (includesAny(ua, ['übergabe', 'handover', 'sbarr', 'isbar'])) {
      accept('Strukturierte Übergabe ist wichtig.', 'Transport/weitere Versorgung.', 0);
    }

    // --- Reanimation / AED ---
    else if (includesAny(ua, ['reanimation', 'cpr', 'herzdruckmassage', 'drücken'])) {
      accept('Kardiopulmonale Reanimation bei Kreislaufstillstand korrekt.', 'AED/Defi einsetzen, Atemweg/O₂ sicherstellen.');
      result.updated_vitals = { ...vitals, Puls: 0, AF: 0, SpO2: clamp(vitals.SpO2 - 2, 0, 100) };
    }
    else if (includesAny(ua, ['aed', 'defibrillator', 'defi'])) {
      accept('AED/Defibrillator gemäß Algorithmus anwenden.', 'Reanimations-Ablauf beachten.', 1);
    }

    // --- Rolle-basierte Grenzen (RS) ---
    else if (includesAny(ua, ['i.v', 'iv-zugang', 'venenzugang'])) {
      if (role.toLowerCase() === 'rs') outOfScope('i.v.-Zugang liegt außerhalb der RS-Kompetenz.', 'NotSan/NA einbeziehen.');
      else accept('i.v.-Zugang kann je nach SOP sinnvoll sein.', 'Monitoring und indizierte Medikation.');
    }
    else if (includesAny(ua, ['intubation', 'rsi', 'tubus'])) {
      outOfScope('Intubation/RSI ist arztpflichtig bzw. außerhalb RS-Kompetenz.', 'Notarzt einbeziehen.');
    }
    else if (includesAny(ua, ['medikament', 'gabe', 'analgesie', 'opioid', 'nitro', 'heparin', 'katecholamin'])) {
      if (role.toLowerCase() === 'rs') outOfScope('Medikamentengabe außerhalb RS-Kompetenz.', 'Notarzt/NotSan nach SOP.');
      else accept('Medikamentengabe ggf. nach SOP/Indikation.', 'Monitoring & Reevaluation.');
    }

    // --- Generischer Fallback ---
    else {
      decline('Maßnahme nicht eindeutig bewertbar.', 'ABCDE fortführen, Monitoring/Anamnese und geeignete nächste Schritte planen.');
    }

    // ===== 7) Rückgabe =====
    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
