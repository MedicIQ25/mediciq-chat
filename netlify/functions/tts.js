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
    // Hier lesen wir jetzt auch die "voice" (Stimme) aus, die die App schickt
    const { text, voice } = JSON.parse(event.body || '{}');
    
    if (!text) return { statusCode: 400, body: "Text fehlt" };

    // Standard-Fallback, falls keine Stimme gewählt wurde
    const selectedVoice = voice || "onyx"; 
    const apiKey = process.env.OPENAI_API_KEY;

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

        // Wir nutzen das Modell "tts-1" (High Speed) statt "tts-1-hd" (High Quality, aber langsam)
        req.write(JSON.stringify({
            model: "tts-1",
            input: text,
            voice: selectedVoice, 
            speed: 1.05 // Ein Hauch schneller (5%) wirkt oft natürlicher und spart Zeit
        }));
        req.end();
    });

  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};