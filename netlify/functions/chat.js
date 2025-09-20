// netlify/functions/chat.js
export async function handler(event) {
  // 1) Erlaubte Origins (füge hier ggf. deine Netlify-Preview-URL hinzu)
  const ALLOWED_ORIGINS = [
    'https://www.mediciq.de',
    'https://mediciq.de',
    'https://mediciq.webflow.io',
    'https://ornate-chimera-b77016.netlify.app/', 
    // 'https://DEIN-NETLIFY-SITE.netlify.app', // optional
  ];

  // Aktuelle Origin aus dem Request (Browser schickt die bei CORS mit)
  const reqOrigin = event.headers.origin || event.headers.Origin || '';
  const allowOrigin = ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0];

  const baseHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin', // wichtig für Caching-Proxies/CDNs
  };

  // 2) Preflight (OPTIONS)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: baseHeaders, body: '' };
  }

  try {
    // 3) Request-Body prüfen
    const { message } = JSON.parse(event.body || '{}');
    if (!message) {
      return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ error: 'message fehlt' }) };
    }

    // 4) API-Key laden
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers: baseHeaders, body: JSON.stringify({ error: 'OPENAI_API_KEY fehlt' }) };
    }

    // 5) OpenAI-Request
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Du bist ein digitaler Tutor für Rettungssanitäter in Ausbildung,Deine Aufgaben: Anatomie, Physiologie, Notfallmedizin und Fallbeispiele erklären, praxisnah darstellen und interaktiv abfragen.Regeln Sprache: Immer Deutsch, leicht verständlich, sachlich. Niveau: Rettungssanitäter in Ausbildung, kein Arztwissen. Struktur: Wichtige Begriffe fett markieren. Klare Listen und Aufzählungen verwenden. Keine Platzhalter (z. B. „null“, „keine Angabe“). Wenn ein Punkt nicht relevant ist → Überschrift komplett weglassen. Quellen: Wenn gefragt → „Dieses Wissen basiert auf anerkannten rettungsdienstlichen Ausbildungsinhalten und Standardliteratur, angepasst für Rettungssanitäter.“ (Keine konkreten Bücher/Dokumente nennen.) Medizinische Inhalte Anatomie/Physiologie: Immer strukturiert → Definition, Aufbau, Funktion, klinische Relevanz. Fallbeispiele: Immer mit X-ABCDE-Schema analysieren. X – Exsanguination (lebensbedrohliche Blutung stillen) A – Airway (Atemweg sichern) B – Breathing (Atmung prüfen/unterstützen) C – Circulation (Kreislauf stabilisieren) D – Disability (Neurologische Funktion/Bewusstsein) E – Exposure (Entkleiden, Untersuchung, Wärmeerhalt) Nur relevante Punkte nennen, keine leeren Überschriften. Abschluss jeder Antwort Red Flags: Wichtige Warnzeichen akuter Lebensgefahr. Merksatz: Kurz, prägnant, einprägsam. Verständnisfrage: Eine konkrete Lernkontrollfrage stellen.' },
          { role: 'user', content: message },
        ],
        temperature: 0.4,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      return { statusCode: resp.status, headers: baseHeaders, body: JSON.stringify({ error: txt || 'OpenAI-Fehler' }) };
    }

    const data = await resp.json();
    const reply = data?.choices?.[0]?.message?.content || 'Keine Antwort erhalten.';
    return { statusCode: 200, headers: baseHeaders, body: JSON.stringify({ reply }) };

  } catch (error) {
    return { statusCode: 500, headers: baseHeaders, body: JSON.stringify({ error: error.message }) };
  }
}
