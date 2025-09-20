// netlify/functions/case-new.js
export async function handler(event) {
  // ===== CORS =====
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
    
    const { specialty = 'internistisch', difficulty = 'mittel', role = 'RS' } = JSON.parse(event.body || '{}');
   
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY fehlt' }) };

    // ===== Systemprompt mit REICHEM Befund-Schema =====
    const system = `
Du erzeugst kompakte, trainingsgeeignete Fälle für den Rettungsdienst.
Antwort AUSSCHLIESSLICH als VALIDE JSON ohne Erklärtext.
Allgemeinwissen, keine lokalen SOPs/Lizenzen; keine marken-/leitliniengeschützten Texte.

Felder (Schema):
{
  "id": "<zufällige kurze id>",
  "specialty": "<internistisch|trauma|neurologie|päd|kardio|pulmo|...>",
  "difficulty": "<leicht|mittel|schwer>",
  "role": "<RS|NotSan>",

  "story": "1-3 Sätze Einsatzbild/Anamnese in natürlicher Sprache",

  "initial_vitals": {
    "RR": "120/80",
    "SpO2": 96,
    "AF": 14,
    "Puls": 80,
    "BZ": 100,
    "Temp": 36.8,
    "GCS": 15
  },

  "key_findings": ["kurze Stichpunkte"],
  "red_flags": ["kurze Stichpunkte"],
  "target_outcome": "1 Satz (Zielrichtung)",
  "evaluation_policy": "1 Satz wie bewertet wird",

  "exam": {
    "airway_mouth": "Mund/Rachen-Befund (Fremdkörper? Schwellung? Speichel? Geruch?)",
    "breathing_auscultation": "Auskultation Lunge beidseits (Rasselgeräusche? Giemen? Abschwächung?)",
    "breathing_percussion": "Perkussion Thorax (sonor/dämpfung, asymmetrisch?)",
    "heart_auscultation": "Herzgeräusche, Rhythmus, Systolen/Diastolen-Bemerkungen",
    "jvd": "Halsvenenstatus (normal/gestaut)",
    "edema": "Ödeme (keine/Knöchel/Generalisiert)",
    "cap_refill": "Kapillarfüllungszeit (Sekunden, Stelle)",
    "skin_color_temp": "Hautfarbe & Temperatur (blass/warm/clammy etc.)",
    "peripheral_pulses": "Periphere Pulse (radial/dorsalis pedis etc.) fühlbar?, Qualität",
    "central_pulse": "Carotis/femoralis, Qualität",

    "neuro_pupils": "Isokor? Lichtreaktion prompt? Größe?",
    "neuro_gcs_detail": "E M V aufgeschlüsselt",
    "neuro_orientation": "orientiert zu Person/Ort/Zeit/Situation?",
    "neuro_motor_sens": "Motorik/Sensibilität kurz, Seitenvergleich",
    "stroke_screen": "FAST/BE-FAST (Befund/negativ)",

    "abdomen_inspection": "Inspektion (aufgetrieben/Narben etc.)",
    "abdomen_auscultation": "Darmgeräusche (normal/reduziert/erhöht)",
    "abdomen_palpation": "lokale/Diffuse Druckschmerzhaftigkeit? Abwehrspannung?",
    "back_exam": "Rücken/Nierenlager, Wirbelsäule, Dekubitus",
    "extremities_exam": "Durchblutung/Motorik/Sensibilität (DMS), Deformitäten",

    "fluids_hydration": "Dehydratations-Zeichen (Hautturgor, Schleimhäute)",
    "pain_score_comment": "NRS 0-10 / kurze Einordnung",

    "history_opqrst": "OPQRST-Schmerz-Anamnese in 2-3 Sätzen",
    "history_sample": {
      "S": "Symptome/Leitsymptom kurz",
      "A": "Allergien (falls bekannt)",
      "M": "Medikamente (wichtigste, ggf. Antikoagulation/Insulin)",
      "P": "Vorgeschichte/Erkrankungen/OPs",
      "L": "Letzte Mahlzeit/Trinken",
      "E": "Ereignis/Trigger/Exposition"
    },

    "urine_output_hint": "Urinmenge/Harndrang/auffällig ja/nein",
    "pregnancy_hint": "Bei Frauen im Alter: ggf. Schwangerschaftstest-Info/Hinweis"
  },

  "labs": {
    "glucose": 100,
    "lactate_hint": "hoch/norm, kurzer Hinweis",
    "ketones_hint": "ja/nein/Hinweis",
    "troponin_hint": "nicht gemessen/verdächtig/normbereich (nur Hinweis)"
  },

  "monitor_rhythm_summary": "Monitoring-Rhythmus-Kurztext",
  "ekg_12lead_summary": "12-Kanal-EKG-Befund (sofern sinnvoll, z. B. ST-T-Veränderungen)",
  "cxr_hint": "Röntgen-Thorax-Hinweis (nur falls thematisch passend, sonst weglassen)"
}

Regeln:
- Werte plausibel & konsistent.
- Keine konkreten Klinikdiagnosen, nur Hinweise/Befunde.
- exam-Felder mit sinnvollen, kurzen Texten füllen (keine 'unbekannt'/keine leeren Strings).
`;

    const user = `Erzeuge einen neuen Fall.
Fachrichtung: ${specialty}. Schwierigkeit: ${difficulty}. Rolle: ${role}.
Fokus: realistische, rettungsdienstnahe Situationen.`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });

    const raw = await resp.text();
    if (!resp.ok) return { statusCode: resp.status, headers, body: JSON.stringify({ error: raw || 'OpenAI-Fehler' }) };

    let data;
    try { data = JSON.parse(raw); } catch {
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      data = JSON.parse(raw.slice(s, e + 1));
    }

    // Minimal-Fallbacks
    data.specialty ??= specialty;
    data.difficulty ??= difficulty;
    data.role ??= role;
    data.exam ??= {};
    data.labs ??= {};
    data.initial_vitals ??= { RR: '120/80', SpO2: 97, AF: 14, Puls: 80, BZ: 100, Temp: 36.8, GCS: 15 };
    data.monitor_rhythm_summary ??= 'Sinusrhythmus';
    data.ekg_12lead_summary ??= 'Sinusrhythmus, keine eindeutige Ischämiezeichen';

    // Frontend-Hilfsfelder
    data.steps_done = []; // für ABCDE/„gesehen“
    data.score = 0;

    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
