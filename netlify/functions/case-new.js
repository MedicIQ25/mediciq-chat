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

  // ===== 2) Input =====
  try {
    const { specialty = 'internistisch', difficulty = 'mittel', role = 'RS' } = JSON.parse(event.body || '{}');
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY fehlt' }) };

    // ===== 3) Scope-Definition (kurz & kompakt) =====
    const SCOPE_MAP = {
      RS: {
        role: 'RS',
        allowed_actions: [
          "Eigenschutz und Umfeld sichern",
          "Patientenansprache, Bewusstsein prüfen (AVPU/GCS)",
          "ABCDE-Assessment",
          "Monitoring: RR, SpO2, Puls, AF, BZ",
          "Lagerung (z. B. Oberkörper hoch, stabile Seitenlage je nach Zustand)",
          "Wärmeerhalt, psychologische Betreuung",
          "O2-Gabe (bei Indikation, z. B. SpO2 < 90%)",
          "NA nachfordern (bei Bedarf), Übergabe",
          "Vitalzeichenkontrolle: Atmung, Bewusstsein, Kreislauf",
        "Puls- und Blutdruckmessung (manuell/automatisch)",
"Rekapillarisierungszeit prüfen",
"Pupillenreaktion prüfen",
"Blutzuckermessung (Kapillarblut)",
"Pulsoxymetrie (SpO₂)",
"Temperaturmessung",
"3- bis 6-Kanal-EKG zur Rhythmusüberwachung (Monitoring)",
"Mund-Rachen-Inspektion",
"Entfernen von Fremdkörpern (manuell, Absaugen, Magill-Zange)",
"Kopf überstrecken, Esmarch-Handgriff, Kreuzgriff",
"stabile Seitenlage",
"Anwendung von Guedel- oder Wendl-Tubus",
"Beutel-Masken-Beatmung (assistiert/kontrolliert)",
"supraglottische Atemwegshilfen (Larynxtubus, Larynxmaske – je nach Landesrecht)",
"Sauerstoffgabe über Maske oder Brille",
"Berechnung Flascheninhalt/Flow",
"Erkennen von Kreislaufstillstand (Bewusstsein, Atmung, Puls)",
"Durchführung kardiopulmonaler Reanimation (Thoraxkompressionen, Beatmung)",
"Einsatz AED/Defibrillator",
"Schockeinschätzung nach ABCDE / C-ABCDE",
"Schocklagerung (sofern keine Kontraindikation)",
"Wärmeerhalt (Rettungsdecke, Heizung im RTW, Kleidung)",
"Blutstillung durch direkten Druck",
"Anlage von Druckverband",
"Tourniquet bei starken Blutungen",
"Sterile Wundabdeckung, Verbandstechniken",
"DMS-Kontrolle nach Verband oder Schienung",
"Feuchte Abdeckung bei vorgefallenen Organen",
"Helmabnahme mit zweitem Helfer",
"Rautek-Rettungsgriff",
"Heimlich-Manöver bei Atemwegsverlegung",
"Schocklage, Oberkörperhochlagerung, Bauchdeckenschonende Lagerung, Linksseitenlage bei Schwangeren",
"Immobilisation von Frakturen und Luxationen (Vakuumschienen, Sam-Splint, Dreiecktuch, Beckenschlinge, Vakuummatratze, KED-System)",
"Kontrolle und Dokumentation von Durchblutung, Motorik und Sensibilität vor/nach Immobilisation",
"Schonende Rettungstechniken anwenden, Eigenschutz beachten",
"Patientengerechte Lagerung je nach Notfallbild (z. B. Oberkörperhoch bei Atemnot, stabile Seitenlage bei Bewusstlosigkeit)",
"Betreuung und psychische Stabilisierung des Patienten, auch Angehörige einbeziehen (v. a. bei Kindern, Schwangeren)",
"Blutzuckermessung bei Bewusstseinsstörungen und metabolischen Notfällen",
"Basiskühlung bei Hyperthermie (Hitzeerschöpfung, Hitzschlag: kühle Umgebung, feuchte Tücher, Kleidung öffnen)",
"Passives Erwärmen bei Hypothermie (Decken, Wärmeerhalt, beheizter RTW)",
"Rettung aus Wasser bei Ertrinkungsunfällen unter Beachtung Eigenschutz",
"Atemwegssicherung, Beatmung und ggf. Reanimation bei Ertrinkungsopfern",
"Wärmeerhalt und Transport in geeignete Klinik bei Ertrinkungs- oder Tauchunfällen",
"Regelmäßige Kontrolle und Dokumentation aller Vitalwerte",
"Übergabe mit vollständiger Dokumentation an Notarzt oder Klinikpersonal"
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

    // ===== 4) OpenAI-Aufruf =====
    const prompt = {
      system: `Du erstellst einen prägnanten Rettungsdienst-Fall für Training.
Gib ausschließlich VALIDE JSON-Antwort (keine Erklärtexte). 
Text kurz halten. Maximale Neutralität, keine urheberrechtlich geschützten Leitlinien, nur allgemein anerkannte Prinzipien.
Felder:
{
  "id": "<zufällige kurze id>",
  "specialty": "<internistisch|trauma|neurologie|päd etc.>",
  "difficulty": "<leicht|mittel|schwer>",
  "role": "<RS|NotSan>",
  "story": "1-3 Sätze, Einsatzbild/Anamnese",
  "initial_vitals": { "RR": "120/80", "SpO2": 96, "AF": 14, "Puls": 80, "BZ": 100, "Temp": 36.8, "GCS": 15 },
  "key_findings": ["kurze Stichpunkte"],
  "red_flags": ["kurze Stichpunkte"],
  "target_outcome": "Was grob erreicht werden soll",
  "evaluation_policy": "Ein Satz: bewerten anhand erlaubter Maßnahmen; außerhalb Kompetenz -> als outside_scope kennzeichnen"
}`,
      user: `Erzeuge einen neuen Fall.
Fachrichtung: ${specialty}. Schwierigkeit: ${difficulty}. Rolle: ${SCOPE.role}.
Behalte zulässige Maßnahmen im Hinterkopf (allowed_actions).`
    };

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ]
      })
    });

    const txt = await resp.text();
    if (!resp.ok) return { statusCode: resp.status, headers, body: JSON.stringify({ error: txt || 'OpenAI-Fehler' }) };

    let data;
    try { data = JSON.parse(txt); } catch { 
      // Fallback: grob extrahieren
      const start = txt.indexOf('{'); const end = txt.lastIndexOf('}');
      data = JSON.parse(txt.slice(start, end + 1));
    }

    // Minimale Validierung:
    if (!data || !data.initial_vitals) data = { error: 'JSON fehlerhaft', raw: txt };

    // Scope beilegen (Frontend braucht es für Anzeige/Checks)
    data.scope = SCOPE;
    data.steps_done = [];
    data.score = 0;

    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
