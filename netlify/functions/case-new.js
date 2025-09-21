// netlify/functions/case-new.js
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
    const { specialty = 'internistisch', difficulty = 'mittel', role = 'RS' } = JSON.parse(event.body || '{}');
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY fehlt' }) };
    }

    // System: nicht voreingenommen, keine Diagnose verraten, kein Messwert gesetzt.
    const system = `Du erzeugst einen prägnanten Rettungsdienst-Fall.
- Gib KEINE Diagnose vorweg.
- Keine Messwerte erfinden; schreibe Hinweise, die zu typischen Erstmaßnahmen anregen.
- Antworte als VALIDE JSON ohne Zusatztext:
{
  "id": "<kurze id>",
  "specialty": "<internistisch|trauma|neurologie|päd ...>",
  "difficulty": "<leicht|mittel|schwer>",
  "role": "<RS|NotSan>",
  "story": "2-4 Sätze Lage/Anamnese ohne Diagnose-Nennung",
  "initial_vitals": { "RR": null, "SpO2": null, "AF": null, "Puls": null, "BZ": null, "Temp": null, "GCS": null },
  "clues": ["kurze Befundhinweise ohne Messwerte"],
  "red_flags": ["kurz"],
  "target": "kurz: was ungefähr erreicht werden sollte (z.B. Monitoring, Transport, Reeval.)"
}`;

    const user = `Erzeuge einen Fall:
Fachrichtung: ${specialty}; Schwierigkeit: ${difficulty}; Rolle: ${role}.
Keine Diagnose explizit nennen. Keine Messwerte setzen.`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.5,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });

    const txt = await resp.text();
    if (!resp.ok) {
      return { statusCode: resp.status, headers, body: JSON.stringify({ error: txt || 'OpenAI-Fehler' }) };
    }

    // JSON robust extrahieren
    let data;
    try { data = JSON.parse(txt); }
    catch {
      const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
      data = JSON.parse(txt.slice(a, b + 1));
    }

    // Ergänze zusätzliche Metafelder für die Schrittlogik
    const state = {
      id: data.id || Math.random().toString(36).slice(2, 8),
      specialty: data.specialty || specialty,
      difficulty: data.difficulty || difficulty,
      role,
      story: data.story || '',
      initial_vitals: data.initial_vitals || { RR: null, SpO2: null, AF: null, Puls: null, BZ: null, Temp: null, GCS: null },
      current_vitals: { RR: null, SpO2: null, AF: null, Puls: null, BZ: null, Temp: null, GCS: null },
      clues: data.clues || [],
      red_flags: data.red_flags || [],
      target: data.target || 'Monitoring beginnen, schrittweise Diagnostik und Reevaluation.',
      steps_done: [],
      score: 0,
      // interne Marker für Checks
      flags: {
        neuroSuspicion: /sprach|facialis|lähm|schwäche|verwirrt|kopfschmerz/i.test(data.story || '') || (data.clues||[]).some(c=>/neurolog/i.test(c)),
        chestPain: /brust|thorax|druck|stich/i.test(data.story||'')
      }
    };

    return { statusCode: 200, headers, body: JSON.stringify(state) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
