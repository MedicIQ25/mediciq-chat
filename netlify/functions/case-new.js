// netlify/functions/case-new.js
export async function handler(event) {
  // ===== 1) CORS =====
  const ALLOWED_ORIGINS = [
    'https://www.mediciq.de',
    'https://mediciq.de',
    'https://mediciq.webflow.io'
    // ggf. deine Netlify-Preview-URL hier ergänzen
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
    const { specialty = 'internistisch', difficulty = 'mittel', role = 'RS' } = JSON.parse(event.body || '{}');

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'OPENAI_API_KEY fehlt' })
      };
    }

    // ===== 3) Scope-Definition (kompakt) =====
    const SCOPE_MAP = {
      RS: {
        role: 'RS',
        allowed_actions: [
          "Eigenschutz und Umfeld sichern",
          "Patientenansprache, Bewusstsein prüfen (AVPU/GCS)",
          "ABCDE-Assessment",
          "Monitoring: RR, SpO2, Puls, AF, BZ",
          "Lagerung je nach Zustand (Oberkörperhoch / stabile Seitenlage)",
          "Wärmeerhalt, psychologische Betreuung",
          "O2-Gabe bei Indikation (z. B. SpO2 < 90%)",
          "NA nachfordern (bei Bedarf), Übergabe",
          "Vitalzeichenkontrolle: Atmung, Bewusstsein, Kreislauf"
        ],
        disallowed_examples: [
          "i.v.-Zugang legen",
          "Medikamentengabe (außer lokal explizit erlaubt)",
          "Intubation/RSI",
          "Analgesie mit Opioiden",
          "Katecholamine"
        ]
      },
      NotSan: {
        role: 'NotSan',
        allowed_actions: [
          "Alles aus RS",
          "i.v.-Zugang legen",
          "erweiterte Maßnahmen/Medikamente gemäß lokalem SOP",
          "erweiterte Atemwegssicherung (ohne RSI)"
        ],
        disallowed_examples: [
          "Arztpflichtige Maßnahmen (RSI, Narkose, invasive Prozeduren mit ärztlicher Aufsichtspflicht)"
        ]
      }
    };
    const SCOPE = role === 'NotSan' ? SCOPE_MAP.NotSan : SCOPE_MAP.RS;

    // ===== 4) Prompt (JSON-only) =====
    const system = `
Du erstellst einen kompakten, realistischen Rettungsdienst-Fall (Training).
Antworte AUSSCHLIESSLICH als valides JSON-Objekt (ohne Markdown, ohne Codeblöcke).
Keine urheberrechtlich geschützten Leitlinien zitieren; nur allgemein anerkannte Prinzipien.
Felder (Pflicht):
{
  "id": "<kurze id>",
  "specialty": "<internistisch|trauma|neurologie|päd|kardiologie|pulmo|...>",
  "difficulty": "<leicht|mittel|schwer>",
  "role": "<RS|NotSan>",
  "story": "1-3 Sätze Einsatzbild/Anamnese (präklinisch, neutral, realistisch).",
  "initial_vitals": { "RR": "120/80", "SpO2": 96, "AF": 14, "Puls": 80, "BZ": 100, "Temp": 36.8, "GCS": 15 },
  "key_findings": ["3-6 kurze Stichpunkte aus Anamnese/Untersuchung"],
  "red_flags": ["0-4 knappe Warnhinweise, ggf. leer []"],
  "target_outcome": "Was ist grob das Ziel der präklinischen Versorgung?",
  "evaluation_policy": "Wie Maßnahmen zu bewerten sind (1 Satz)."
}
Validation: Alle Felder müssen vorhanden sein.
`;

    const user = `
Neuen Fall erzeugen:
- Fachrichtung: ${specialty}
- Schwierigkeit: ${difficulty}
- Rolle: ${SCOPE.role}
- Denke an zulässige Maßnahmen (allowed_actions) je nach Rolle.
- JSON-only, keine Zusatztexte, keine Code fences.
`;

    // ===== 5) OpenAI-Aufruf =====
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        // falls das Modell response_format unterstützt – erzwingt JSON:
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system.trim() },
          { role: 'user', content: user.trim() }
        ]
      })
    });

    const txt = await resp.text();

    // Zum Debuggen in den Netlify-Logs:
    // console.log('[case-new raw]', txt);

    if (!resp.ok) {
      return { statusCode: resp.status, headers, body: JSON.stringify({ error: txt || 'OpenAI-Fehler' }) };
    }

    // ===== 6) Robust JSON-Parsing =====
    let data;
    try {
      data = JSON.parse(txt);
    } catch {
      // Fallback: JSON im Text suchen (z.B. falls Modell doch drum herum textet)
      const start = txt.indexOf('{');
      const end = txt.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          data = JSON.parse(txt.slice(start, end + 1));
        } catch (e2) {
          return { statusCode: 500, headers, body: JSON.stringify({ error: 'JSON-Parsing fehlgeschlagen', raw: txt }) };
        }
      } else {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Keine JSON-Struktur gefunden', raw: txt }) };
      }
    }

    // Bei Chat-Completions kann die eigentliche Antwort unter choices[0].message.content liegen:
    if (data?.choices?.[0]?.message?.content) {
      const content = data.choices[0].message.content;
      try {
        data = JSON.parse(content);
      } catch {
        const s = content.indexOf('{');
        const e = content.lastIndexOf('}');
        if (s >= 0 && e > s) {
          try {
            data = JSON.parse(content.slice(s, e + 1));
          } catch (e3) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Content-JSON-Parsing fehlgeschlagen', raw: content }) };
          }
        } else {
          return { statusCode: 500, headers, body: JSON.stringify({ error: 'Content enthielt kein JSON', raw: content }) };
        }
      }
    }

    // ===== 7) Pflichtfelder validieren + Defaults =====
    const safe = (o, d) => (o === undefined || o === null ? d : o);

    const out = {
      id: safe(data.id, Math.random().toString(36).slice(2, 8)),
      specialty: safe(data.specialty, specialty),
      difficulty: safe(data.difficulty, difficulty),
      role: SCOPE.role,
      story: safe(data.story, 'Kurzbeschreibung des Einsatzes.'),
      initial_vitals: {
        RR: safe(data.initial_vitals?.RR, '120/80'),
        SpO2: safe(data.initial_vitals?.SpO2, 96),
        AF: safe(data.initial_vitals?.AF, 14),
        Puls: safe(data.initial_vitals?.Puls, 80),
        BZ: safe(data.initial_vitals?.BZ, 100),
        Temp: safe(data.initial_vitals?.Temp, 36.8),
        GCS: safe(data.initial_vitals?.GCS, 15)
      },
      key_findings: Array.isArray(data.key_findings) ? data.key_findings : [],
      red_flags: Array.isArray(data.red_flags) ? data.red_flags : [],
      target_outcome: safe(data.target_outcome, 'Stabilisierung, Monitoring, zielgerichteter Transport.'),
      evaluation_policy: safe(data.evaluation_policy, 'Maßnahmen gemäß Rolle bewerten; außerhalb Kompetenz → outside_scope.'),
      scope: SCOPE,
      steps_done: [],
      score: 0
    };

    // ===== 8) Rückgabe =====
    return { statusCode: 200, headers, body: JSON.stringify(out) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
