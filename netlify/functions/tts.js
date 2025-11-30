// netlify/functions/tts.js
const https = require('https');

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "audio/mpeg"
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const { text } = JSON.parse(event.body || '{}');
    if (!text) return { statusCode: 400, body: "Text fehlt" };

    const apiKey = process.env.OPENAI_API_KEY; // Zieht den Key aus Netlify
    
    // Wir nutzen das Node.js https modul nativ um externe Abhängigkeiten zu vermeiden
    return new Promise((resolve, reject) => {
        const req = https.request('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        }, (res) => {
            const chunks = [];
            res.on('data', d => chunks.push(d));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                resolve({
                    statusCode: 200,
                    headers,
                    body: buffer.toString('base64'),
                    isBase64Encoded: true
                });
            });
        });

        req.on('error', (e) => {
            resolve({ statusCode: 500, headers, body: JSON.stringify({ error: e.message }) });
        });

        req.write(JSON.stringify({
            model: "tts-1",
            input: text,
            voice: "onyx", // "onyx" (männlich, tief) oder "nova" (weiblich, klar) oder "shimmer" (weiblich, sanft)
            speed: 1.0
        }));
        req.end();
    });

  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};