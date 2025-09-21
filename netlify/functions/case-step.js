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
   
    const { case_state, user_action, role = 'RS' } = JSON.parse(event.body || '{}');
    if (!case_state || !user_action) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'case_state oder user_action fehlt' }) };
    }

    // kompakten Zustand bauen
    const state = {
      id: case_state.id,
      specialty: case_state.specialty,
      difficulty: case_state.difficulty,
      role: case_state.role || role,
      hidden: case_state.hidden || {},           // hier liegen unsere "wahren" Befunde
      steps_done: Array.isArray(case_state.steps_done) ? case_state.steps_done : [],
      current_vitals: case_state.initial_vitals || null
    };

    // Helper
    const ua = String(user_action).toLowerCase();
    const h  = state.hidden || {};
    const baseVitals = h.vitals_baseline || {};

    function resp({
      accepted = false,
      outside_scope = false,
      unsafe = false,
      score_delta = 0,
      rationale = '',
      finding = '',
      hint = '',
      updated_vitals = null,
      done = false
    }) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          accepted, outside_scope, unsafe, score_delta,
          rationale, finding, hint,
          updated_vitals, done
        })
      };
    }

    // ===== 2) Intent-Erkennung =====
    // Vitalmessungen
    if (/(^|\b)(rr|blutdruck|druck)\b/.test(ua)) {
      return resp({
        accepted: true,
        score_delta: 1,
        rationale: 'Blutdruck gemessen.',
        finding: baseVitals.RR ? `RR: ${baseVitals.RR} mmHg.` : 'RR erhoben.',
        updated_vitals: baseVitals.RR ? { RR: baseVitals.RR } : null,
        hint: 'Weitere Vitalparameter erheben (SpO₂, AF, Puls, BZ, Temp).'
      });
    }
    if (/(spo2|sättigung|sauerstoffsättigung)/.test(ua)) {
      return resp({
        accepted: true,
        score_delta: 1,
        rationale: 'SpO₂ erhoben.',
        finding: baseVitals.SpO2 != null ? `SpO₂: ${baseVitals.SpO2} %` : 'SpO₂ dokumentiert.',
        updated_vitals: baseVitals.SpO2 != null ? { SpO2: baseVitals.SpO2 } : null,
        hint: 'Monitoring fortführen.'
      });
    }
    if (/\b(af|atemfrequenz|respiratorische rate|resp)\b/.test(ua)) {
      return resp({
        accepted: true,
        score_delta: 1,
        rationale: 'AF gezählt.',
        finding: baseVitals.AF != null ? `AF: ${baseVitals.AF}/min` : 'AF dokumentiert.',
        updated_vitals: baseVitals.AF != null ? { AF: baseVitals.AF } : null
      });
    }
    if (/\b(puls|herzfrequenz|hf)\b/.test(ua)) {
      return resp({
        accepted: true,
        score_delta: 1,
        rationale: 'Puls gezählt.',
        finding: baseVitals.Puls != null ? `Puls: ${baseVitals.Puls}/min` : 'Puls dokumentiert.',
        updated_vitals: baseVitals.Puls != null ? { Puls: baseVitals.Puls } : null
      });
    }
    if (/\b(bz|zucker|blutzucker)\b/.test(ua)) {
      return resp({
        accepted: true,
        score_delta: 1,
        rationale: 'BZ gemessen.',
        finding: baseVitals.BZ != null ? `BZ: ${baseVitals.BZ} mg/dl` : 'BZ dokumentiert.',
        updated_vitals: baseVitals.BZ != null ? { BZ: baseVitals.BZ } : null
      });
    }
    if (/\b(temp|temperatur|fieber)\b/.test(ua)) {
      return resp({
        accepted: true,
        score_delta: 1,
        rationale: 'Temperatur gemessen.',
        finding: baseVitals.Temp != null ? `Temp: ${baseVitals.Temp} °C` : 'Temperatur dokumentiert.',
        updated_vitals: baseVitals.Temp != null ? { Temp: baseVitals.Temp } : null
      });
    }
    if (/\b(gcs|avpu)\b/.test(ua)) {
      return resp({
        accepted: true,
        score_delta: 1,
        rationale: 'Neurologischer Status (GCS/AVPU) erhoben.',
        finding: baseVitals.GCS != null ? `GCS: ${baseVitals.GCS}` : 'GCS dokumentiert.',
        updated_vitals: baseVitals.GCS != null ? { GCS: baseVitals.GCS } : null
      });
    }

    // Körperstatus / Befunde
    if (/(mund|oral|mundraum|rachen|schleimhaut|zunge)/.test(ua)) {
      return resp({
        accepted: true,
        score_delta: 1,
        rationale: 'Mundraum inspiziert.',
        finding: h.mouth || 'Mundraum unauffällig.',
        hint: 'Atemweg/Schutzreflexe mitbeurteilen.'
      });
    }
    if (/(pupill|augen)/.test(ua)) {
      return resp({
        accepted: true,
        score_delta: 1,
        rationale: 'Pupillen geprüft.',
        finding: h.pupils || 'Pupillen unauffällig.',
        hint: 'Neurologischen Status komplettieren (z. B. GCS).'
      });
    }
    if (/(auskultation|abhören|lungen|atemb|rassel|giemen|stridor)/.test(ua)) {
      return resp({
        accepted: true,
        score_delta: 1,
        rationale: 'Lunge auskultiert.',
        finding: h.lung || 'Seitengleiches Atemgeräusch, keine Nebengeräusche.',
        hint: 'AF/SpO₂ und Arbeit der Atmung mitbewerten.'
      });
    }
    if (/(perkuss|klopfen|schall|tympan|gedämpft).*(thorax|brust)/.test(ua)) {
      return resp({
        accepted: true,
        score_delta: 1,
        rationale: 'Thorax perkutiert.',
        finding: h.percussion || 'Perkussionsschall seitengleich, nicht gedämpft.',
        hint: 'Bei Pathologie: Pneumothorax/Hämatothorax differenzieren.'
      });
    }
    if (/(abdomen|bauch|inspekt|palpier|periton).*/.test(ua)) {
      return resp({
        accepted: true,
        score_delta: 1,
        rationale: 'Abdomen untersucht.',
        finding: h.abdomen || 'Abdomen weich, keine Abwehrspannung.',
        hint: 'Übelkeit/Erbrechen/Schmerzskala berücksichtigen.'
      });
    }
    if (/(haut|blässe|zyanose|schweiß|kaltschweiß)/.test(ua)) {
      return resp({
        accepted: true,
        score_delta: 1,
        rationale: 'Hautbefund erhoben.',
        finding: h.skin || 'Haut rosig/warm/trocken.',
        hint: 'Perfusion/Schockzeichen im Verlauf erneut prüfen.'
      });
    }
    if (/(dms|perfus|kapill|ödeme|ödem|durchblutung|motorik|sensibilität)/.test(ua)) {
      return resp({
        accepted: true,
        score_delta: 1,
        rationale: 'DMS/Perfusion überprüft.',
        finding: h.dms || 'DMS unauffällig, periphere Perfusion ausreichend.',
        hint: 'Bei Trauma: Compartments, Schmerz, Schwellung beachten.'
      });
    }

    // EKG
    if (/(^|\b)(ekg|3.*kanal|dreikanal)\b/.test(ua)) {
      return resp({
        accepted: true,
        score_delta: 1,
        rationale: '3-Kanal-EKG abgeleitet.',
        finding: h.ekg3 || 'Sinusrhythmus, keine eindeutigen ST-Hebungen.',
        hint: '12-Kanal-EKG ergänzen.'
      });
    }
    if (/(12.*kanal|zwölf.*kanal|12-kanal|zwölfkanal)/.test(ua)) {
      return resp({
        accepted: true,
        score_delta: 1,
        rationale: '12-Kanal-EKG aufgezeichnet.',
        finding: h.ekg12 || 'Sinusrhythmus, keine ST-Hebungen.',
        hint: 'In passenden Ableitungen auf ST-Hebungen/Spiegelbilder achten.'
      });
    }

    // Neurologie
    if (/(befast|fast).*(check|durchführen|prüfen|machen)?/.test(ua)) {
      return resp({
        accepted: true,
        score_delta: 1,
        rationale: 'BEFAST durchgeführt.',
        finding: h.befast ? JSON.stringify(h.befast) : 'BEFAST ohne Auffälligkeiten.',
        hint: 'Zeitfenster bewerten, Stroke-Unit anfahren.'
      });
    }

    // Schmerzskala
    if (/(schmerzskala|pain scale|nrs|numeric rating)/.test(ua)) {
      return resp({
        accepted: true,
        score_delta: 1,
        rationale: 'Schmerzskala erhoben.',
        finding: h.pain || 'NRS notiert.',
        hint: 'Analgesie nach SOP erwägen (Berufs-/Rechtslage beachten).'
      });
    }

    // generischer Fallback
    return resp({
      accepted: false,
      rationale: 'Aktion nicht eindeutig zuordenbar.',
      hint: 'Nutze klare, kurze Aktions-/Befund-Statements (z. B. „Mundraum schauen“, „Pupillen prüfen“, „EKG 12-Kanal schreiben“).'
    });

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
