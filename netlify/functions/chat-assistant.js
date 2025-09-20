// netlify/functions/chat-assistant.js
export async function handler(event) {
  // Erlaubte Aufrufer (Webflow + deine Domain)
  const ALLOWED_ORIGINS = [
    'https://www.mediciq.de',
    'https://mediciq.de',
    'https://mediciq.webflow.io',
    // optional: 'https://<dein-site-name>.netlify.app',
  ];
  const reqOrigin = event.headers.origin || event.headers.Origin || '';
  const allowOrigin = ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0];

  const headers = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    'Content-Type': 'application/json'
  };

  // Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const { message } = JSON.parse(event.body || '{}');
    if (!message) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'message fehlt' }) };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const assistantId = process.env.OPENAI_ASSISTANT_ID;
    if (!apiKey || !assistantId) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'API Key oder Assistant ID fehlt' }) };
    }

    // 1) Antwortlauf (Responses API) starten
    let resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistant_id: assistantId,
        input: message
        // Tipp: Wenn du Verlauf mitsenden willst, baue hier statt "message" ein
        // zusammengefügtes Prompt aus den letzten N User-/AI-Turns.
      })
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(()=> '');
      return { statusCode: resp.status, headers, body: JSON.stringify({ error: txt || 'OpenAI-Fehler' }) };
    }

    let data = await resp.json();

    // 2) Auf Fertigstellung poll’en
    const responseId = data.id;
    let status = data.status;
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    let attempts = 40; // ~30s

    while (status === 'in_progress' && attempts-- > 0) {
      await wait(750);
      const p = await fetch(`https://api.openai.com/v1/responses/${responseId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      data = await p.json();
      status = data.status;
    }

    if (status !== 'completed') {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Antwort nicht abgeschlossen', status }) };
    }

    // 3) Text extrahieren
    const textItem = (data.output || []).find(o => o.type === 'output_text');
    const reply = textItem?.text?.value || 'Keine Antwort erhalten.';
    return { statusCode: 200, headers, body: JSON.stringify({ reply }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
}
