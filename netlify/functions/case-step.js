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

  try {
    // ===== 2) Eingabe =====
    const { case_state, user_action, role = 'RS' } = JSON.parse(event.body || '{}');
    if (!case_state || !user_action) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'case_state oder user_action fehlt' }) };
    }

    // ===== 3) Helpers =====
    const ua = (user_action || '').toLowerCase().trim();
    const includesAny = (needles) => needles.some(w => ua.includes(w));
    const includesAll = (needles) => needles.every(w => ua.includes(w));

    const keepVitals = (v) => ({
      RR:   v?.RR   ?? null,
      SpO2: v?.SpO2 ?? null,
      AF:   v?.AF   ?? null,
      Puls: v?.Puls ?? null,
      BZ:   v?.BZ   ?? null,
      Temp: v?.Temp ?? null,
      GCS:  v?.GCS  ?? null
    });

    const base = case_state?.hidden?.vitals_baseline || {};
    const current = keepVitals(case_state?.current_vitals || {});
    const mergeVitals = (patch) => keepVitals({ ...current, ...patch });

    const result = {
      accepted: false,
      outside_scope: false,
      unsafe: false,
      score_delta: 0,
      rationale: '',
      next_hint: '',
      observation: '',
      updated_vitals: null,
      done: false
    };

    // ===== 4) Heuristiken =====
    // --- RR ---
    if (includesAny(['rr', 'blutdruck', 'druck messen', 'blutdruck messen'])) {
      result.accepted = true; result.score_delta = 1;
      result.rationale = 'Blutdruck gemessen.';
      const v = base.RR ?? current.RR ?? '—';
      result.observation = `RR: ${v}`;
      result.updated_vitals = mergeVitals({ RR: base.RR ?? current.RR ?? null });
      result.next_hint = 'Weitere Vitalparameter erheben (Puls, SpO₂, AF, BZ).';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // --- SpO₂ ---
    if (includesAny(['spo2', 'sättigung', 'sauerstoffsättigung', 'pulsoxy'])) {
      result.accepted = true; result.score_delta = 1;
      result.rationale = 'SpO₂ gemessen.';
      const v = base.SpO2 ?? current.SpO2 ?? '—';
      result.observation = `SpO₂: ${v}%`;
      result.updated_vitals = mergeVitals({ SpO2: base.SpO2 ?? current.SpO2 ?? null });
      result.next_hint = 'Bei Hypoxie O₂-Gabe erwägen, Monitoring fortführen.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // --- Puls ---
    if (includesAny(['puls', 'herzfrequenz'])) {
      result.accepted = true; result.score_delta = 1;
      result.rationale = 'Puls gemessen.';
      const v = base.Puls ?? current.Puls ?? '—';
      result.observation = `Puls: ${v}/min`;
      result.updated_vitals = mergeVitals({ Puls: base.Puls ?? current.Puls ?? null });
      result.next_hint = 'Rhythmusbeurteilung am EKG erwägen.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // --- AF ---
    if (includesAny(['af', 'atemfrequenz', 'respiration'])) {
      result.accepted = true; result.score_delta = 1;
      result.rationale = 'Atemfrequenz gemessen.';
      const v = base.AF ?? current.AF ?? '—';
      result.observation = `AF: ${v}/min`;
      result.updated_vitals = mergeVitals({ AF: base.AF ?? current.AF ?? null });
      result.next_hint = 'Atemarbeit/Spannung beurteilen; Monitoring fortführen.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // --- BZ ---
    if (includesAny(['bz', 'blutzucker', 'zucker'])) {
      result.accepted = true; result.score_delta = 1;
      result.rationale = 'BZ gemessen.';
      const v = base.BZ ?? current.BZ ?? '—';
      result.observation = `BZ: ${v} mg/dl`;
      result.updated_vitals = mergeVitals({ BZ: base.BZ ?? current.BZ ?? null });
      result.next_hint = 'Bei Hypo-/Hyperglykämie je nach SOP handeln.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // --- Temp ---
    if (includesAny(['temp', 'temperatur', 'fieber'])) {
      result.accepted = true; result.score_delta = 1;
      result.rationale = 'Temperatur gemessen.';
      const v = base.Temp ?? current.Temp ?? '—';
      result.observation = `Temp: ${v} °C`;
      result.updated_vitals = mergeVitals({ Temp: base.Temp ?? current.Temp ?? null });
      result.next_hint = 'Anamnese/Inspektion ergänzen; Monitoring fortführen.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // --- GCS ---
    if (includesAny(['gcs', 'glasgow'])) {
      result.accepted = true; result.score_delta = 1;
      result.rationale = 'GCS erhoben.';
      const v = base.GCS ?? current.GCS ?? '—';
      result.observation = `GCS: ${v}`;
      result.updated_vitals = mergeVitals({ GCS: base.GCS ?? current.GCS ?? null });
      result.next_hint = 'Neurologische Tests (Pupillen, FAST/BEFAST) ergänzen.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // --- EKG ---
    if (includesAny(['ekg', '12 kanal', 'zwölf kanal'])) {
      result.accepted = true; result.score_delta = 1;
      result.rationale = 'EKG abgeleitet.';
      result.observation = 'EKG: Sinusrhythmus ~90/min, keine ST-Hebungen (Beispiel).';
      result.updated_vitals = mergeVitals({});
      result.next_hint = 'Bei ACS-Verdacht serielles EKG, Monitoring & Reevaluation.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // --- Mundraum ---
    if (includesAny(['mundraum', 'mund ansehen', 'mund inspizieren', 'zunge'])) {
      result.accepted = true; result.score_delta = 1;
      result.rationale = 'Mundraum inspiziert.';
      result.observation = 'Befund: Mundraum frei, keine Aspiration/Blutung sichtbar (Beispiel).';
      result.updated_vitals = mergeVitals({});
      result.next_hint = 'Atemwege/Atmung weiter beurteilen (AF, SpO₂), Pupillen prüfen.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // --- Pupillen ---
    if (includesAny(['pupille', 'pupillen', 'lichtreflex', 'isokor'])) {
      result.accepted = true; result.score_delta = 1;
      result.rationale = 'Pupillen geprüft.';
      result.observation = 'Pupillen isokor, prompt lichtreagibel (Beispiel).';
      result.updated_vitals = mergeVitals({});
      result.next_hint = 'Neurologischen Status komplettieren (GCS, FAST/BEFAST).';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // --- FAST / BEFAST ---
    if (includesAny(['fast', 'befast'])) {
      result.accepted = true; result.score_delta = 1;
      result.rationale = ua.includes('befast') ? 'BEFAST durchgeführt.' : 'FAST durchgeführt.';
      result.observation = 'Neurologische Auffälligkeiten: z. B. Fazialisparese, Armschwäche, Sprachstörung (Beispiel).';
      result.updated_vitals = mergeVitals({});
      result.next_hint = 'Zeitfenster prüfen, Stroke-SOP beachten, zügiger Transport in geeignete Klinik.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // --- ABCDE ---
    if (includesAny(['abcde', 'a b c d e', 'primärsurvey'])) {
      result.accepted = true; result.score_delta = 1;
      result.rationale = 'ABCDE-Assessment begonnen.';
      result.observation = 'A/B/C/D/E strukturiert abarbeiten, Vitalwerte seriell, Monitoring.';
      result.updated_vitals = mergeVitals({});
      result.next_hint = 'Atemwege/Atmung/Kreislauf/Neurologie/Exposure gezielt untersuchen und dokumentieren.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // --- O2 ---
    if (includesAny(['o2', 'sauerstoff', 'oxygen'])) {
      result.accepted = true; result.score_delta = 1;
      result.rationale = 'Sauerstoffgabe veranlasst (bei Indikation).';
      result.updated_vitals = mergeVitals({});
      result.next_hint = 'Wirksamkeit an SpO₂/AF/Klinik prüfen, Monitoring fortführen.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ===== Differenzierte AUSKULTATION zuerst (spezifisch) =====
    if (includesAny(['auskult', 'lungen anhören', 'lungen abhören', 'thorax abhören', 'lungenauskult'])) {
      // Spezifische Schlüsselwörter prüfen:
      if (includesAny(['rassel', 'rg', 'krepit'])) {
        result.accepted = true; result.score_delta = 1;
        result.rationale = 'Lungenauskultation: feuchte RG.';
        result.observation = 'Auskultation: basal beidseits feuchte RG (Beispiel).';
        result.updated_vitals = mergeVitals({});
        result.next_hint = 'Ddy: kardial/pulmonal – O₂, aufgestellte Oberkörperlagerung, Diuretika/NA je nach SOP erwägen.';
        return { statusCode: 200, headers, body: JSON.stringify(result) };
      }
      if (includesAny(['giemen', 'wheez', 'brummen'])) {
        result.accepted = true; result.score_delta = 1;
        result.rationale = 'Lungenauskultation: exspiratorisches Giemen.';
        result.observation = 'Auskultation: exspiratorisches Giemen (Beispiel).';
        result.updated_vitals = mergeVitals({});
        result.next_hint = 'Bronchodilatatorisch nach SOP (z. B. BDT), O₂ titriert, Monitoring.';
        return { statusCode: 200, headers, body: JSON.stringify(result) };
      }
      if (includesAny(['stridor'])) {
        result.accepted = true; result.score_delta = 1;
        result.rationale = 'Lungenauskultation: inspiratorischer Stridor.';
        result.observation = 'Auskultation: inspiratorischer Stridor (Beispiel).';
        result.updated_vitals = mergeVitals({});
        result.next_hint = 'Obere Atemwege sichern: Sitzen lassen, O₂, ggf. Adrenalin-Inhalation/NA/Algorithmus Atemwegsmanagement.';
        return { statusCode: 200, headers, body: JSON.stringify(result) };
      }
      if (includesAny(['einseitig', 'seitendifferenz', 'vermindert rechts', 'vermindert links', 'rechts vermindert', 'links vermindert', 'abgeschwächt'])) {
        result.accepted = true; result.score_delta = 1;
        result.rationale = 'Lungenauskultation: Seitendifferenz.';
        result.observation = 'Auskultation: Atemgeräusch einseitig abgeschwächt (Beispiel).';
        result.updated_vitals = mergeVitals({});
        result.next_hint = 'Ddy: Pneumothorax, Atelektase – Perkussion, SpO₂, Sonographie/Transport-Priorität; NA-Nachforderung erwägen.';
        return { statusCode: 200, headers, body: JSON.stringify(result) };
      }
      // Generische Auskultation (wenn nichts Spezifisches erkannt)
      result.accepted = true; result.score_delta = 1;
      result.rationale = 'Lungenauskultation durchgeführt.';
      result.observation = 'Auskultation: vesikuläres Atemgeräusch beidseits, keine RG/Giemen (Beispiel).';
      result.updated_vitals = mergeVitals({});
      result.next_hint = 'Bei Auffälligkeiten entsprechend SOP handeln; Monitoring/AF/SpO₂ seriell.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ===== Thorax-PERKUSSION =====
    if (includesAny(['perkuss', 'perkut', 'klopfschall']) && includesAny(['thorax', 'brust', 'brustkorb'])) {
      result.accepted = true; result.score_delta = 1;
      result.rationale = 'Thorax perkutiert.';
      result.observation = 'Perkussion: sonorer Klopfschall beidseits, keine Dämpfung/Tympanie (Beispiel).';
      result.updated_vitals = mergeVitals({});
      result.next_hint = 'Bei Seitendifferenz/Auffälligkeit: Ddy Pneumothorax/Pleuraerguss – weitere Diagnostik/NA je nach SOP.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ===== Thorax-INSPEKTION/PALPATION =====
    if (
      includesAny(['thorax', 'brustkorb', 'brust', 'rippen', 'sternum']) &&
      includesAny(['inspiz', 'ansehen', 'inspect', 'palpier', 'druckschmerz', 'kontusion'])
    ) {
      result.accepted = true; result.score_delta = 1;
      result.rationale = 'Thorax inspiziert/palpatorisch untersucht.';
      result.observation = 'Thorax: symmetrische Atemexkursion, keine Prellmarken, kein Druck-/Instabilitätszeichen (Beispiel).';
      result.updated_vitals = mergeVitals({});
      result.next_hint = 'Bei Trauma-/Schmerzbefund Analgesie/Immobilisation/Monitoring je nach SOP; 12-Kanal-EKG erwägen.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ===== Abdomen-INSPEKTION/PALPATION =====
    if (
      includesAny(['abdomen', 'bauch']) &&
      includesAny(['inspiz', 'ansehen', 'inspect', 'palpier', 'palpation', 'druckschmerz'])
    ) {
      result.accepted = true; result.score_delta = 1;
      result.rationale = 'Abdomen untersucht (Inspektion/Palpation).';
      result.observation = 'Abdomen: weich, kein Abwehrspannung, kein palpatorischer Druckschmerz, kein Peritonismus (Beispiel).';
      result.updated_vitals = mergeVitals({});
      result.next_hint = 'Bei pathologischen Zeichen Volumentherapie/Schmerztherapie/Transport-Priorisierung je nach SOP.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ===== HAUTBEFUND / Perfusion =====
    if (includesAny(['haut', 'hautbefund', 'zyanose', 'blässe', 'schweiß', 'schweißig', 'kaltschweißig', 'perfusion', 'peripher', 'kapillar', 'rekap'])) {
      result.accepted = true; result.score_delta = 1;
      result.rationale = 'Hautstatus/Perfusion beurteilt.';

      // spezifische Keywörter einfließen lassen
      let parts = [];
      if (includesAny(['blässe', 'blass'])) parts.push('blass');
      if (includesAny(['zyanose', 'zyanot'])) parts.push('zyanotisch');
      if (includesAny(['schweiß', 'schweißig', 'kaltschweiß'])) parts.push('kaltschweißig');
      let skin = parts.length ? parts.join(', ') : 'rosig, warm, trocken';

      // Kapillarfüllung
      let crt = includesAny(['kapillar', 'rekap']) ? '< 2 s' : '—';

      result.observation = `Haut: ${skin}. Kapilläre Füllung: ${crt}.`;
      result.updated_vitals = mergeVitals({});
      result.next_hint = 'Bei schlechter Perfusion Schock-Algorithmus/SOP; O₂/Volumen/NA je nach Klinikbild.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ===== ÖDEME =====
    if (includesAny(['ödem', 'ödeme', 'geschwollen', 'knöchelödem', 'bein geschwollen', 'fuß geschwollen'])) {
      result.accepted = true; result.score_delta = 1;
      result.rationale = 'Ödeme überprüft.';
      result.observation = 'Periphere Ödeme: Knöchel beidseits leicht eindrückbar (Beispiel).';
      result.updated_vitals = mergeVitals({});
      result.next_hint = 'Ddy kardial/renal – Anamnese/Diurese/Belastungssymptome, Monitoring, ggf. NA je nach SOP.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ===== DMS (Durchblutung-Motorik-Sensibilität) =====
    if (includesAny(['dms', 'durchblutung motorik sensibilität', 'durchblutung', 'motorik', 'sensibil'])) {
      result.accepted = true; result.score_delta = 1;
      result.rationale = 'DMS geprüft.';
      result.observation = 'DMS: durchblutet, Motorik erhalten, Sensibilität erhalten (Beispiel).';
      result.updated_vitals = mergeVitals({});
      result.next_hint = 'Bei Auffälligkeit Immobilisation/Schienung, Re-DMS nach Maßnahme, Transport-Priorisierung.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ===== SCHMERZSKALA (NRS) =====
    if (includesAny(['schmerz', 'nrs', 'numeric rating'])) {
      const m = ua.match(/(?:nrs|schmerz(?:skala)?)\D{0,5}(\d{1,2})/i);
      let nrs = null;
      if (m) {
        const val = parseInt(m[1], 10);
        if (!Number.isNaN(val) && val >= 0 && val <= 10) nrs = val;
      }
      result.accepted = true; result.score_delta = 1;
      result.rationale = 'Schmerzskala (NRS) erhoben.';
      result.observation = nrs !== null ? `NRS: ${nrs}/10.` : 'NRS erfasst (Wert 0–10 bitte angeben).';
      result.updated_vitals = mergeVitals({});
      result.next_hint =
        nrs !== null && nrs >= 4
          ? 'Analgesie nach SOP erwägen, Wirkung reevaluieren (NRS seriell).'
          : 'Monitoring fortführen; bei Schmerzanstieg Analgesie nach SOP erwägen.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // --- Gefährlich/außerhalb Scope ---
    if (includesAny(['opioid geben', 'morphin spritzen', 'notfallnarkose']) && role === 'RS') {
      result.accepted = false; result.unsafe = true; result.outside_scope = true; result.score_delta = -1;
      result.rationale = 'Maßnahme außerhalb RS-Kompetenz / potentiell gefährlich.';
      result.updated_vitals = mergeVitals({});
      result.next_hint = 'Notarzt nachfordern / SOP beachten.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ===== 5) Fallback =====
    result.accepted = false;
    result.score_delta = 0;
    result.rationale = 'Aktion nicht eindeutig zuordenbar.';
    result.updated_vitals = mergeVitals({});
    result.next_hint =
      'Nutze klare Kurzbefehle/Befunde: „RR messen“, „SpO₂ messen“, „Puls/AF messen“, „BZ messen“, „Temp messen“, „EKG abgeleitet“, „Mundraum inspizieren“, „Pupillen prüfen“, „Auskultation Lunge“, „Thorax inspizieren/perkutieren“, „Abdomen palpieren“, „Hautbefund“, „Ödeme prüfen“, „Perfusion/Kapillarfüllung“, „DMS“, „NRS 6/10“ …';

    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
