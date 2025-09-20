// netlify/functions/case-step.js
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
    
    const { case_state, user_action, role = 'RS' } = JSON.parse(event.body || '{}');
    if (!case_state || !user_action) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'case_state oder user_action fehlt' }) };
    }

    const result = {
      accepted: false,
      outside_scope: false,
      unsafe: false,
      score_delta: 0,
      rationale: '',
      next_hint: '',
      updated_vitals: null,
      updated_case_state: null,
      observation: '',
      done: false
    };

    const ua = (user_action || '').toLowerCase();
    const t = (s) => (s || '').toString().trim();
    const ex = case_state.exam || {};
    const labs = case_state.labs || {};
    const vit = { ...(case_state.initial_vitals || {}) };

    // ===== Schutz: Maßnahmen außerhalb Kompetenz (für RS) =====
    if (role === 'RS') {
      const forbidden = /(iv|i\.v\.|zugang legen|venflon|intubation|rs[i]|ketamin|opioid|katecholamin|adrenalin(?!.*aed))/i;
      if (forbidden.test(ua)) {
        result.outside_scope = true;
        result.accepted = false;
        result.rationale = 'Maßnahme erfordert ärztliche/erweiterte Kompetenz.';
        result.next_hint = 'Notarzt nachfordern, Monitoring/ABCDE fortsetzen.';
        return { statusCode: 200, headers, body: JSON.stringify(result) };
      }
    }

    // ===== ABCDE-Makro =====
    if (/(abcde|ich arbeite abcde ab|primary survey|primärcheck)/i.test(ua)) {
      const seen = case_state.steps_done ? [...case_state.steps_done] : [];
      const ordered = [
        { flag: 'A_mouth',  text: ex.airway_mouth,           label: 'A – Mund/Rachen' },
        { flag: 'B_ausc',   text: ex.breathing_auscultation, label: 'B – Auskultation' },
        { flag: 'B_perc',   text: ex.breathing_percussion,   label: 'B – Perkussion' },
        { flag: 'C_skin',   text: ex.skin_color_temp,        label: 'C – Haut/Kreislauf' },
        { flag: 'C_pulse',  text: ex.peripheral_pulses,      label: 'C – Periphere Pulse' },
        { flag: 'C_jvd',    text: ex.jvd,                    label: 'C – Halsvenen' },
        { flag: 'C_edema',  text: ex.edema,                  label: 'C – Ödeme' },
        { flag: 'D_pupils', text: ex.neuro_pupils,           label: 'D – Pupillen' },
        { flag: 'D_gcs',    text: ex.neuro_gcs_detail,       label: 'D – GCS' },
        { flag: 'D_orient', text: ex.neuro_orientation,      label: 'D – Orientierung' },
        { flag: 'E_abd',    text: ex.abdomen_palpation,      label: 'E – Abdomen' },
        { flag: 'E_back',   text: ex.back_exam,              label: 'E – Rücken' },
        { flag: 'E_ext',    text: ex.extremities_exam,       label: 'E – Extremitäten/DMS' }
      ];
      const next = ordered.find(o => t(o.text) && !seen.includes(o.flag));
      if (next) {
        seen.push(next.flag);
        result.accepted = true;
        result.score_delta = 1;
        result.rationale = 'ABCDE: nächster Untersuchungsschritt durchgeführt.';
        result.observation = `${next.label}: ${t(next.text)}`;
        result.next_hint = 'Weiter ABCDE oder gezielt untersuchen (Pupillen, Auskultation, Abdomen usw.).';
        result.updated_case_state = { steps_done: seen };
        return { statusCode: 200, headers, body: JSON.stringify(result) };
      }
      // alles gesehen
      result.accepted = true;
      result.rationale = 'ABCDE vollständig.';
      result.next_hint = 'Gezielt Diagnostik vertiefen (z. B. EKG, Stroke-Screen, Laborhinweise, Anamnese).';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ===== Vital-Messungen =====
    const vitalMap = [
      { re: /(blutdruck|rr|druck messen|druck)/i,        key: 'RR',    label: 'RR' },
      { re: /(puls( |$)|herzfrequenz|hf|herzschlag)/i,   key: 'Puls',  label: 'Puls' },
      { re: /(spo2|sättigung|sauerstoffsättigung)/i,     key: 'SpO2',  label: 'SpO₂' },
      { re: /(atemfrequenz|af|atemzug)/i,                key: 'AF',    label: 'AF' },
      { re: /(temperatur|fieber)/i,                      key: 'Temp',  label: 'Temperatur' },
      { re: /(bz|blutzucker|glukose|glucose)/i,          key: 'BZ',    label: 'BZ' }
    ];
    const vm = vitalMap.find(v => v.re.test(ua));
    if (vm) {
      const v = vit[vm.key];
      result.accepted = true;
      result.score_delta = 1;
      result.rationale = 'Vitalwert erhoben.';
      if (vm.key === 'Puls' && t(case_state.monitor_rhythm_summary)) {
        result.observation = `${vm.label}: ${v} – Monitoring: ${t(case_state.monitor_rhythm_summary)}.`;
      } else {
        result.observation = `${vm.label}: ${v}`;
      }
      result.next_hint = 'ABCDE/Monitoring fortführen; bei Abweichungen reevaluieren.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ===== Standard-Diagnostik-Intents =====
    const intents = [
      { re: /(mund|rachen|mundraum|airway|zunge|öffnung)/i,      text: ex.airway_mouth,           label: 'Mund/Rachen' },
      { re: /(auskultier|abhören|vesikulär|giemen|rassel|lunge)/i, text: ex.breathing_auscultation, label: 'Lunge – Auskultation' },
      { re: /(perkussion|perkutier|klopfen.*thorax)/i,           text: ex.breathing_percussion,   label: 'Thorax – Perkussion' },
      { re: /(herz.*abhören|herzgeräusch|kardiak.*auskult)/i,    text: ex.heart_auscultation,     label: 'Herz – Auskultation' },
      { re: /(halsvene|jvd)/i,                                   text: ex.jvd,                    label: 'Halsvenen' },
      { re: /(ödem|ödeme|beine geschwollen|knöchel)/i,           text: ex.edema,                  label: 'Ödeme' },
      { re: /(kapillar|capillary|rekapill)/i,                    text: ex.cap_refill,             label: 'Kapillarfüllung' },
      { re: /(haut(?!.*(schnitt|wunde))|hauttemperatur|clammy|blass|cyanotisch)/i, text: ex.skin_color_temp, label: 'Haut' },
      { re: /(peripher.*puls|radial|fußpuls|dorsalis)/i,         text: ex.peripheral_pulses,      label: 'Periphere Pulse' },
      { re: /(zentraler puls|carotis|femoralis)/i,               text: ex.central_pulse,          label: 'Zentraler Puls' },

      { re: /(pupill|isokor|lichtreaktion)/i,                    text: ex.neuro_pupils,           label: 'Pupillen' },
      { re: /(gcs|glasgow)/i,                                    text: ex.neuro_gcs_detail,       label: 'GCS' },
      { re: /(orientier|person.*ort.*zeit|situation)/i,          text: ex.neuro_orientation,      label: 'Orientierung' },
      { re: /(motorik|sensibilit|seitenvergleich|pares)/i,       text: ex.neuro_motor_sens,       label: 'Motorik/Sensibilität' },
      { re: /(fast|be-fast|stroke|schlaganfalltest)/i,           text: ex.stroke_screen,          label: 'Stroke-Screen' },

      { re: /(abdomen.*(palp|drück|schmerz)|bauchschmerz)/i,     text: ex.abdomen_palpation,      label: 'Abdomen – Palpation' },
      { re: /(abdomen.*auskult|darmgeräusch)/i,                  text: ex.abdomen_auscultation,   label: 'Abdomen – Auskultation' },
      { re: /(abdomen.*inspek|bauch.*ansehen)/i,                 text: ex.abdomen_inspection,     label: 'Abdomen – Inspektion' },
      { re: /(rücken|wirbelsäule|nierenlager|dekubitus)/i,       text: ex.back_exam,              label: 'Rücken' },
      { re: /(extremität|dms|durchblutung.*motorik.*sens)/i,     text: ex.extremities_exam,       label: 'Extremitäten/DMS' },

      { re: /(turgor|dehydrat|schleimhaut)/i,                    text: ex.fluids_hydration,       label: 'Hydration' },
      { re: /(schmerzskala|nrs|schmerz.*(0|1|2|3|4|5|6|7|8|9|10))/i, text: ex.pain_score_comment, label: 'Schmerzskala (NRS)' },

      { re: /(opqrst|schmerz-anamnese)/i,                        text: ex.history_opqrst,         label: 'OPQRST' },
      { re: /(sample|anamnese|allerg|medikament|vorgeschicht|ereignis|letzte mahlzeit)/i,
        text: (() => {
          const s = ex.history_sample || {};
          return `S:${t(s.S)} | A:${t(s.A)} | M:${t(s.M)} | P:${t(s.P)} | L:${t(s.L)} | E:${t(s.E)}`;
        })(), label: 'SAMPLE' },

      { re: /(urin|harndrang|diurese)/i,                         text: ex.urine_output_hint,      label: 'Urin/Diurese' },
      { re: /(schwanger|pregnancy)/i,                            text: ex.pregnancy_hint,         label: 'Schwangerschaftshinweis' }
    ];

    const intent = intents.find(i => i.re.test(ua));
    if (intent) {
      const out = t(typeof intent.text === 'function' ? intent.text() : intent.text);
      result.accepted = true;
      result.score_delta = 1;
      result.rationale = 'Befund erhoben.';
      result.observation = `${intent.label}: ${out || 'unauffällig.'}`;
      result.next_hint = 'Gezielt weitere Bereiche prüfen oder Therapie beginnen.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ===== EKG / Monitoring =====
    if (/(12.?kanal|ekg|rhythmusstreifen|monitoring)/i.test(ua)) {
      if (/(12.?kanal|ekg)/i.test(ua)) {
        result.accepted = true;
        result.score_delta = 1;
        result.rationale = '12-Kanal-EKG abgeleitet.';
        result.observation = `EKG (12-Kanal): ${t(case_state.ekg_12lead_summary)}`;
        result.next_hint = 'Monitoring fortführen, ST-Strecke & Rhythmus beurteilen.';
        return { statusCode: 200, headers, body: JSON.stringify(result) };
      } else {
        result.accepted = true;
        result.score_delta = 1;
        result.rationale = 'Monitoring angelegt.';
        result.observation = `Monitoring: ${t(case_state.monitor_rhythm_summary)}`;
        result.next_hint = 'Bei Auffälligkeiten 12-Kanal-EKG ergänzen.';
        return { statusCode: 200, headers, body: JSON.stringify(result) };
      }
    }

    // ===== Labor-/POC-Hinweise =====
    if (/(laktat|lactate)/i.test(ua)) {
      result.accepted = true;
      result.score_delta = 1;
      result.rationale = 'POC-Hinweis abgerufen.';
      result.observation = `Laktat: ${t(labs.lactate_hint) || 'kein Hinweis'}.`;
      result.next_hint = 'Klinische Gesamtschau, ggf. Reevaluation.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }
    if (/(keton|ketone)/i.test(ua)) {
      result.accepted = true;
      result.score_delta = 1;
      result.observation = `Ketone: ${t(labs.ketones_hint) || 'kein Hinweis'}.`;
      result.rationale = 'POC-Hinweis abgerufen.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }
    if (/(troponin)/i.test(ua)) {
      result.accepted = true;
      result.score_delta = 1;
      result.observation = `Troponin: ${t(labs.troponin_hint) || 'nicht gemessen'}.`;
      result.rationale = 'Laborhinweis (nur Information).';
      result.next_hint = 'Transportziel & Prioritäten abwägen.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ===== „Reevaluiere/zeige aktuelle Vitalwerte“ =====
    if (/(reeval|reevaluiere|kontrolliere vital|neue vitalwerte|nochmal messen)/i.test(ua)) {
      result.accepted = true;
      result.score_delta = 1;
      result.rationale = 'Reevaluation durchgeführt.';
      result.observation = `Aktuelle Vitalwerte → RR: ${vit.RR}, SpO₂: ${vit.SpO2}%, AF: ${vit.AF}/min, Puls: ${vit.Puls}/min, BZ: ${vit.BZ} mg/dl, Temp: ${vit.Temp}°C, GCS: ${vit.GCS}.`;
      result.next_hint = 'Weiter mit ABCDE/Diagnostik oder Therapie.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ===== Beispiel-Maßnahme: Sauerstoffgabe =====
    if (/(o2|sauerstoff).*gabe|sauerstoff anlegen|oxygen/i.test(ua)) {
      const updated = { ...vit };
      if (typeof updated.SpO2 === 'number') {
        updated.SpO2 = Math.min(99, updated.SpO2 + (updated.SpO2 < 95 ? 3 : 1));
      }
      result.accepted = true;
      result.score_delta = 1;
      result.rationale = 'Sauerstoffgabe in dieser Situation plausibel.';
      result.updated_vitals = updated;
      result.observation = `SpO₂ verbessert ggf. auf ~${updated.SpO2}%.`;
      result.next_hint = 'Monitoring & erneute Auskultation/Beurteilung.';
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ===== Fallback =====
    result.accepted = false;
    result.rationale = 'Aktion nicht eindeutig bewertbar/erkannt.';
    result.next_hint = 'Beispiele: „ich arbeite ABCDE ab“, „Pupillen prüfen“, „Lunge auskultieren“, „BZ messen“, „12-Kanal-EKG“, „OPQRST“, „SAMPLE“, „Stroke-Screen“, „Kapillarfüllung“, „Abdomen palpieren“ …';
    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
