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

  // ===== 2) Input =====
  try {
    const { case_state, user_action, role = 'RS' } = JSON.parse(event.body || '{}');
    if (!case_state || !user_action) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'case_state oder user_action fehlt' }) };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY fehlt' }) };

    // kurze, tokenarme Version des Case-States
    const compactState = {
      id: case_state.id,
      specialty: case_state.specialty,
      difficulty: case_state.difficulty,
      story: case_state.story,
      vitals: case_state.initial_vitals,
      steps_done: case_state.steps_done || [],
      target_outcome: case_state.target_outcome
    };

    // Scope wiederholen (aus case_state.scope oder fallback minimal)
    const scope = case_state.scope || {
      role,
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
      disallowed_examples: ["i.v.-Zugang", "Medikamentengabe", "RSI/Intubation"]
    };

    // ===== 3) OpenAI-Aufruf (sehr knapper JSON-Output) =====
    const system = `Bewerte nur anhand der allowed_actions. 
Antworte ausschließlich als VALIDE JSON (keine Erklärtexte).
Schema:
{
  "accepted": true/false,
  "outside_scope": true/false,
  "unsafe": true/false,
  "score_delta": -1|0|1,
  "rationale": "max. 1 Satz, knapp",
  "next_hint": "max. 1 Satz, nächster Schritt",
  "updated_vitals": { "RR":"", "SpO2": 0, "AF": 0, "Puls": 0, "BZ": 0, "Temp": 0, "GCS": 15 } | null,
  "done": true/false
}`;

    const user = `Fall (kompakt): ${JSON.stringify(compactState)}
Rolle: ${scope.role}
Erlaubt: ${scope.allowed_actions.join(' | ')}
Aktion des Lernenden: "${user_action}"
Beachte: Wenn Aktion außerhalb Kompetenz -> outside_scope: true, accepted: false.
Wenn gefährlich -> unsafe: true.
Sonst knapp bewerten.`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });

    const txt = await resp.text();
    if (!resp.ok) return { statusCode: resp.status, headers, body: JSON.stringify({ error: txt || 'OpenAI-Fehler' }) };

    let data;
    try { data = JSON.parse(txt); } catch {
      const start = txt.indexOf('{'); const end = txt.lastIndexOf('}');
      data = JSON.parse(txt.slice(start, end + 1));
    }

    // Minimal-Defaults
    data = {
      accepted: !!data.accepted,
      outside_scope: !!data.outside_scope,
      unsafe: !!data.unsafe,
      score_delta: typeof data.score_delta === 'number' ? data.score_delta : (data.accepted ? 1 : 0),
      rationale: data.rationale || '',
      next_hint: data.next_hint || '',
      updated_vitals: data.updated_vitals || null,
      done: !!data.done
    };

    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
