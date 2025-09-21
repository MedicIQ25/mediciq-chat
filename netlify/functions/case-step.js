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

  // ==== kleine Helfer ====
  const parseNumber = (s) => {
    const m = String(s).match(/-?\d+([.,]\d+)?/);
    if (!m) return null;
    return Number(m[0].replace(',', '.'));
  };

  // RR: 120/80
  const parseRR = (s) => {
    const m = String(s).match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
    return m ? `${m[1]}/${m[2]}` : null;
  };

  // Messwert-Parser
  const tryParseVitals = (ua) => {
    const v = {};
    // Reihenfolge: spezifisch vor generisch
    const rr = parseRR(ua);
    if (rr) v.RR = rr;

    const spo2m = ua.match(/sp[o0]2\s*[:=]?\s*(\d{2})\s*%/i);
    if (spo2m) v.SpO2 = parseNumber(spo2m[1]);

    const puls = ua.match(/\b(puls|hr|herzfrequenz)\b[^0-9\-]*(-?\d{2,3})/i);
    if (puls) v.Puls = parseNumber(puls[2]);

    const af = ua.match(/\b(af|atemfrequenz)\b[^0-9\-]*(-?\d{1,2})/i);
    if (af) v.AF = parseNumber(af[2]);

    const bz = ua.match(/\b(bz|blutzucker|glukose)\b[^0-9\-]*(-?\d{1,3})/i);
    if (bz) v.BZ = parseNumber(bz[2]);

    const temp = ua.match(/\b(temp|temperatur)\b[^0-9\-]*(-?\d{1,2}([.,]\d)?)\b/i);
    if (temp) v.Temp = parseNumber(temp[2]);

    const gcs = ua.match(/\bgcs\b[^0-9\-]*(-?\d{1,2})/i);
    if (gcs) v.GCS = parseNumber(gcs[1]);

    return v;
  };

  // ===== 2) Logik =====
  try {
    const { case_state, user_action, role = 'RS' } = JSON.parse(event.body || '{}');
    if (!case_state || !user_action) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'case_state oder user_action fehlt' }) };
    }

    const ua = String(user_action).trim().toLowerCase();
    const state = case_state;
    const vitals = { ...(state.current_vitals || {}) };

    const result = {
      accepted: false,
      outside_scope: false,
      unsafe: false,
      score_delta: 0,
      message: '',       // kurze Bewertung/Ausgabe
      hint: '',          // nächster sinnvoller Schritt
      updated_vitals: null,
      done: false,
      diagnosis: null,   // optionale Arbeitsdiagnose
      rationale: null    // Begründung zur Diagnose
    };

    // 2.1 Messwerte extrahieren
    const newVals = tryParseVitals(ua);
    if (Object.keys(newVals).length) {
      Object.assign(vitals, newVals);
      result.accepted = true;
      result.score_delta = 1;
      result.updated_vitals = vitals;
      result.message = 'Messwerte übernommen.';
      result.hint = 'Weitere Basisparameter erheben, Monitoring & Reevaluation.';
    }

    // 2.2 Standard-Checks / Untersuchungen
    const say = (msg, hint = '') => {
      result.accepted = true;
      if (!result.message) result.message = msg;
      result.hint = hint;
    };

    // ABCDE/Primary Survey
    if (/\babcde\b|\bprimary\b/i.test(ua)) {
      say('ABCDE begonnen. Atemwege frei, Spontanatmung vorhanden. Monitoring starten, weitere Diagnostik schrittweise.', 'Vitalwerte erheben (RR, SpO2, Puls, AF, BZ, Temp, GCS).');
    }

    // Mundraum
    if (/mund(raum)? (insp|schau|kontroll|inspek)/i.test(ua)) {
      say('Mundraum inspiziert: keine Aspiration, kein Fremdkörper, kein Blut – Atemwege frei.', 'Atemfrequenz, SpO₂, RR, Puls erfassen.');
    }

    // Pupillen
    if (/pupill(en)? (prüf|kontroll|check)/i.test(ua)) {
      say('Pupillen isokor, prompt lichtreagibel (sofern nicht anders vorgegeben).', 'GCS erfassen, neurologischen Screening-Test erwägen.');
    }

    // Auskultation
    if (/auskult/i.test(ua)) {
      say('Auskultation: vesikuläres Atemgeräusch bds., kein Stridor/Rasseln; Herzrhythmus regelmäßig.', 'SpO₂, RR/Puls, ggf. EKG/12-Kanal.');
    }

    // EKG
    if (/\bekg\b(?!\s*12)/i.test(ua)) {
      const msg = 'EKG angelegt: Sinusrhythmus, keine akuten ST-Hebungen (falls Story nicht kardial geprägt).';
      say(msg, 'Bei unklarer Thoraxsymptomatik 12-Kanal-EKG erwägen.');
    }
    if (/12\s*kanal|12\-kanal|zwölf/i.test(ua) && /ekg/i.test(ua)) {
      say('12-Kanal-EKG erhoben: keine akuten STEMI-Zeichen. Bei Brustschmerz: Verlauf, Troponin (präklinisch meist nicht), Transport mit Voranmeldung.', 'Schmerzskala, RR, SpO₂, O₂ nach Indikation.');
    }

    // BEFAST/FAST
    if (/\bbe-?fast\b|\bfast\b/i.test(ua)) {
      if (state.flags?.neuroSuspicion) {
        const befastBefund = [
          'B (Balance): unsicherer Stand/Gang',
          'E (Eyes): Blickabweichung/Sehprobleme möglich',
          'F (Face): Facialisparese wahrscheinlich',
          'A (Arms): Armabsenkung rechts',
          'S (Speech): Dysarthrie/Wortfindungsstörung',
          'T (Time): Symptombeginn < 4.5 h – Stroke-Window möglich'
        ];
        say(
          `BEFAST erhoben – Auffälligkeiten:\n• ${befastBefund.join('\n• ')}`,
          'BZ prüfen (Hypo ausschließen), RR dokumentieren, Stroke-Voranmeldung erwägen.'
        );
      } else {
        say('BEFAST ohne klare Auffälligkeiten. Differentialdiagnosen weiter prüfen.', 'BZ, RR, GCS, Verlauf; ggf. andere Ursachen abklären.');
      }
    }

    // O₂ Gabe
    if (/\bo2\b|\boxygen|\bsauerstoff\b/i.test(ua)) {
      say('Sauerstoffgabe nach Indikation: Ziel SpO₂ 94–98 % (COPD ggf. 88–92 %).', 'SpO₂ kontinuierlich überwachen.');
    }

    // Schmerzskala
    if (/schmerz(skala)?|nrs\b/i.test(ua)) {
      say('Schmerzskala erhoben (NRS). Therapie je nach SOP und Rolle.', 'Monitoring, Verlauf, Ursache weiter eingrenzen.');
    }

    // 2.3 „Genug Information?“ → Arbeitsdiagnose vorschlagen
    const enoughNeuro =
      (state.flags?.neuroSuspicion || /be-?fast|fast|neurolog/i.test(ua)) &&
      (vitals.BZ != null) && (vitals.GCS != null || /speech|sprache|dysarthrie|aphasie/i.test(state.story));

    if (!result.diagnosis && enoughNeuro) {
      // Wenn neurologischer Verdacht + BZ ok ⇒ wahrscheinlicher akuter Schlaganfall (ohne Garantie!)
      const bzOk = vitals.BZ != null && vitals.BZ >= 70 && vitals.BZ <= 200;
      if (bzOk) {
        result.diagnosis = 'Wahrscheinlicher akuter neurologischer Ausfall (Schlaganfall möglich).';
        result.rationale = 'Neurologische Symptome + BEFAST-Auffälligkeiten; Hypoglykämie ausgeschlossen (BZ normal). Stroke-Window prüfen, Voranmeldung erwägen.';
        result.score_delta += 1;
        result.hint ||= 'CT-fähige Klinik, Zeitfenster, Antikoagulation/NOAK-Anamnese, Transport priorisieren.';
      }
    }

    // 2.4 falls noch nichts gegriffen hat
    if (!result.accepted && !result.message) {
      result.message = 'Aktion nicht eindeutig zuordenbar. Nutze klare Formulierungen (z. B. „RR 130/85“, „SpO2 95%“, „Mundraum inspizieren“, „BEFAST“).';
      result.hint = 'Basisdiagnostik komplettieren: RR, SpO₂, AF, Puls, BZ, Temp, GCS, EKG/12-Kanal, neurologisches Screening.';
    }

    // 2.5 Rückgabe
    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
