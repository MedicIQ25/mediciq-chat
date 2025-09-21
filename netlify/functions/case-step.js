// netlify/functions/case-step.js
export async function handler(event) {
  
  const ALLOWED_ORIGINS = [
    'https://www.mediciq.de',
    'https://mediciq.de',
    'https://mediciq.webflow.io'
  ];
  const reqOrigin  = event.headers.origin || event.headers.Origin || '';
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
    const { case_state, user_action = '', role = 'RS' } = JSON.parse(event.body || '{}');
    if (!case_state || !user_action) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'case_state oder user_action fehlt' }) };
    }

    const txt = String(user_action).toLowerCase();
    const hidden = case_state.hidden || {};
    const updated_vitals = {};
    let evaluation = '';
    let finding = '';
    let next_hint = '';

    // ==== Vitalwerte messen ====
    const give = (k, val) => { if (val != null) updated_vitals[k] = val; };

    if (/\b(rr|blutdruck)\b.*(messen|prüfen)|\brr\b/.test(txt)) {
      give('RR', hidden.vitals_baseline?.RR || '—');
      evaluation = 'Blutdruck gemessen.';
      finding    = `RR: ${updated_vitals.RR}`;
      next_hint  = 'Weiter: SpO₂, AF, Puls, BZ, Temp, GCS erheben.';
    }
    else if (/sp[oö]2|sättigung|sauerstoffsättigung/.test(txt)) {
      give('SpO2', hidden.vitals_baseline?.SpO2 ?? '—');
      evaluation = 'SpO₂ gemessen.';
      finding    = `SpO₂: ${updated_vitals.SpO2}%`;
      next_hint  = 'AF und Puls zählen, BZ messen, Temp prüfen.';
    }
    else if (/\b(af|atemfrequenz)\b.*(messen|zählen)|\baf\b/.test(txt)) {
      give('AF', hidden.vitals_baseline?.AF ?? '—');
      evaluation = 'Atemfrequenz erhoben.';
      finding    = `AF: ${updated_vitals.AF}/min`;
      next_hint  = 'Puls zählen, BZ messen, Temp prüfen.';
    }
    else if (/\b(puls)\b.*(messen|zählen)|\bpuls\b/.test(txt)) {
      give('Puls', hidden.vitals_baseline?.Puls ?? '—');
      evaluation = 'Puls erhoben.';
      finding    = `Puls: ${updated_vitals.Puls}/min`;
      next_hint  = 'BZ messen, Temp prüfen.';
    }
    else if (/\b(bz|blutzucker)\b.*(messen)|\bbz\b/.test(txt)) {
      give('BZ', hidden.vitals_baseline?.BZ ?? '—');
      evaluation = 'Blutzucker gemessen.';
      finding    = `BZ: ${updated_vitals.BZ} mg/dl`;
      next_hint  = 'Temperatur und GCS prüfen.';
    }
    else if (/\b(temp|temperatur)\b.*(messen)|\btemp\b/.test(txt)) {
      give('Temp', hidden.vitals_baseline?.Temp ?? '—');
      evaluation = 'Körpertemperatur erhoben.';
      finding    = `Temp: ${updated_vitals.Temp} °C`;
      next_hint  = 'GCS prüfen.';
    }
    else if (/\b(gcs|bewusstsein|avpu)\b.*(messen|prüfen)|\bgcs\b/.test(txt)) {
      give('GCS', hidden.vitals_baseline?.GCS ?? '—');
      evaluation = 'GCS/Bewusstsein erhoben.';
      finding    = `GCS: ${updated_vitals.GCS}`;
      next_hint  = 'EKG ableiten oder weiterführende Diagnostik.';
    }

    // ==== Spezifische Befunde ====
    else if (/mundraum|mundraum inspizieren|mundraum anschauen|atemweg/.test(txt)) {
      evaluation = 'Befund erhoben.';
      finding    = hidden.mouth || 'Mundraum unauffällig, keine Aspiration, Schleimhäute rosig.';
      next_hint  = 'Weiter mit Pupillen, Auskultation, EKG, ggf. BZ/BEFAST.';
    }
    else if (/pupillen? (prüfen|checken|kontrollieren)|\bpupillen\b/.test(txt)) {
      evaluation = 'Befund erhoben.';
      finding    = hidden.pupils || 'Pupillen isokor, prompt lichtreagibel.';
      next_hint  = 'Auskultation und EKG sinnvoll.';
    }
    else if (/(auskultation|thorax auskultieren|lungen auskultieren|auskultieren)/.test(txt)) {
      evaluation = 'Thorax auskultiert.';
      finding    = hidden.lung || 'Seitengleiches Atemgeräusch, keine RGs, ggf. leichte Tachypnoe.';
      next_hint  = 'Perkussion/Inspektion und EKG prüfen.';
    }
    else if (/thorax(-|\s)?perkussion|perkussion (thorax|brustkorb)/.test(txt)) {
      evaluation = 'Thorax perkutiert.';
      finding    = 'Sonorer Klopfschall beidseits, keine Dämpfung/Hypersonorität.';
      next_hint  = 'In Kombination mit Auskultationsbefund bewerten.';
    }
    else if (/abdomen (inspizieren|palpieren|perkutieren)|bauch (anschauen|abtasten)/.test(txt)) {
      evaluation = 'Abdomen untersucht.';
      finding    = hidden.abdomen || 'Weiches Abdomen, keine Abwehrspannung/';
      next_hint  = 'Bei Schmerz/Übelkeit weiter differenzieren.';
    }
    else if (/haut( prüf(en)?| ansehen| checken)|blässe|zyanose|schweiß/.test(txt)) {
      evaluation = 'Hautbefund erhoben.';
      finding    = 'Haut warm/rosig; Kapilläre Füllung < 2 s; ggf. Kaltschweißigkeit abhängig von Fall.';
      next_hint  = 'Perfusion/DMS (Extremitäten) prüfen.';
    }
    else if (/(ödeme|perfusion|dms) (prüfen|checken)|dms\b/.test(txt)) {
      evaluation = 'Perfusion/DMS geprüft.';
      finding    = 'Periphere Perfusion intakt, DMS unauffällig, keine Ödeme.';
      next_hint  = 'EKG/NIT/Transport nach Algorithmus.';
    }

    // ==== EKG ====
    else if (/\b(ekg|3-kanal|3 kanal)\b/.test(txt)) {
      evaluation = '3-Kanal-EKG abgeleitet.';
      finding    = hidden.ekg3 || 'Sinusrhythmus, Frequenz ~90/min, keine eindeutigen ST-Hebungen.';
      next_hint  = 'Bei ACS-Verdacht → 12-Kanal-EKG.';
    }
    else if (/\b(12-kanal|zwölf kanal|12 kanal)\b/.test(txt)) {
      evaluation = '12-Kanal-EKG abgeleitet.';
      finding    = hidden.ekg12 || 'Sinusrhythmus, keine ST-Streckenhebung.';
      if (hidden.ekg12?.toLowerCase().includes('st-heb')) {
        next_hint = 'ACS/STEMI wahrscheinlich – ACS-Versorgung/Transport zügig einleiten.';
      } else {
        next_hint = 'Ischämiezeichen beachten, Reevaluation/Monitoring fortsetzen.';
      }
    }

    // ==== Neurologisch ====
    else if (/\bbefast\b|neurolog(isch|ie) (checken|prüfen|status)/.test(txt)) {
      evaluation = 'Neurologischer Status/BEFAST erhoben.';
      if (hidden.befast) {
        finding = Object.entries(hidden.befast).map(([k,v]) => `${k}: ${v}`).join(' • ');
      } else if (hidden.neuro) {
        finding = hidden.neuro;
      } else {
        finding = 'Neurologisch unauffällig.';
      }
      next_hint = 'Bei Schlaganfallverdacht: Stroke-Unit, Zeitfenster beachten, BZ ausschließen.';
    }

    // ==== Fallback ====
    else {
      evaluation = 'Aktion nicht eindeutig zuordenbar.';
      finding    = 'Nutze klare, kurze Aktions-/Befund-Statements (z. B. „Mundraum schauen“, „Pupillen prüfen“, „EKG schreiben“, „RR messen“).';
      next_hint  = 'Vorschlag: Vitalzeichen komplettieren, Auskultation/Perkussion, EKG, ggf. BEFAST.';
    }

    // Case-State zurückgeben (optional anreichern)
    const new_state = { ...case_state };
    if (Object.keys(updated_vitals).length) {
      new_state.current_vitals = { ...(case_state.current_vitals || {}), ...updated_vitals };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        accepted      : true,
        evaluation,
        finding,        // <— wird im Frontend als „Befund:“ angezeigt
        next_hint,
        updated_vitals,
        case_state    : new_state
      })
    };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
