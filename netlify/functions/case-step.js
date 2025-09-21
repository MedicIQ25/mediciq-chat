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
    const body = JSON.parse(event.body || '{}');
    const case_state = body.case_state || null;
    const role       = (body.role || case_state?.role || 'RS').toString();
    let   ua         = (body.user_action || '').toString();

    if (!case_state || !ua) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'case_state oder user_action fehlt' }) };
    }

    // ===== 2) Normalisierung der Eingabe =====
    ua = ua
      .normalize('NFKD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    // ===== 3) Antwort-Skelett =====
    const reply = {
      accepted: false,
      outside_scope: false,
      unsafe: false,
      score_delta: 0,
      evaluation: '',
      found: '',
      next_hint: '',
      updated_vitals: null,
      done: false,
      case_state: null
    };
    const accept = (t) => { reply.accepted = true; if (t) reply.evaluation = t; if (reply.score_delta < 1) reply.score_delta = 1; };
    const reject = (t) => { reply.accepted = false; if (t) reply.evaluation = t; };
    const found  = (t) => { if (t) reply.found = t; };
    const hint   = (t) => { if (t) reply.next_hint = t; };
    const vitals = (v) => { reply.updated_vitals = { ...(reply.updated_vitals || {}), ...v }; };

    // ===== 4) State / Hidden =====
    const state  = { ...case_state };
    state.steps_done     = Array.isArray(state.steps_done) ? state.steps_done : [];
    state.current_vitals = state.current_vitals || {};
    const hidden = state.hidden || {};
    const base   = hidden.vitals_baseline || null;

    // ===== 5) Matcher =====
    const has = (...w) => w.some(x => new RegExp(x, 'i').test(ua));

    // Maßnahmen
    const R_O2      = /(o2|sauerstoff|oxygen)/i;
    const R_MESSEN  = /(messen|prufen|pruefen|kontrollieren|erheben|bestimmen)/i;
    const R_EKG3    = /(ekg.*(3|drei)|monitoring\b(?!.*12))/i;
    const R_EKG12   = /(12.?kanal|zwolf.?kanal|12.?ableitung|12.*ekg|ekg.*12)/i;
    const R_RR      = /\b(rr|blutdruck)\b/i;
    const R_SPO2    = /\b(spo2|sauerstoffsatt|sattigung|pulsoxi)\b/i;
    const R_AF      = /\b(af|atemfrequenz)\b/i;
    const R_PULS    = /\b(puls|herzfrequenz|hf)\b/i;
    const R_BZ      = /\b(bz|blutzucker|glukose|glucose)\b/i;
    const R_TEMP    = /\b(temp|temperatur|fieber)\b/i;
    const R_GCS     = /\b(gcs|glasgow)\b/i;
    const R_MUND    = /(mundraum|mund|rachen|oropharynx|zunge|aspiration)/i;
    const R_PUPIL   = /(pupille|pupillen)/i;
    const R_AUSK    = /(auskultation|abhorchen|lungengerau?sch|giemen|rassel|stridor)/i;
    const R_PERK    = /(perkussion|beklopfen|hypersonor|gedampft)/i;
    const R_HAUT    = /(haut|blasse|zyanose|schweiss|schweissig|kaltschweiss)/i;
    const R_SCHMERZ = /(schmerzskala|nrs|schmerzensskala)/i;
    const R_BEDM    = /(dms|durchblutung.*motorik.*sensibilitat|perfusionscheck|kapill|rekap)/i;
    const R_BEFAST  = /\bbefast\b/i;
    const R_NEURO   = /(neurolog|status)/i;
    const R_ANAM    = /(anamnese|vorerkrank|medikation|allergien|antikoagul|blutverdunner)/i;

    // Informations-Abfragen
    const R_DIAG    = /(diagnose|verdachtsdiagnose|arbeitsdiagnose|was hat der patient|was ist die diagnose|was ist es\b|was fehlt)/i;
    const R_SUMMARY = /(zusammenfassung|fazit|kurzfassung|summary)/i;
    const R_FLAGS   = /(red ?flags?|warnzeichen)/i;
    const R_FINDS   = /(wichtige befunde|key findings|schlusselbefunde)/i;
    const R_GOAL    = /\b(ziel|weiteres vorgehen|plan|strategie)\b/i;

    // ===== 6) Informations-Abfragen zuerst =====
    if (R_DIAG.test(ua)) {
      const diag  = state.solution?.diagnosis || 'Diagnose noch nicht eindeutig.';
      const why   = Array.isArray(state.solution?.justification) ? state.solution.justification.join(' • ') : (state.solution?.justification || state.key_findings?.join(' • ') || '');
      accept('Informationsabfrage erkannt.');
      found(`Diagnose/Verdacht: ${diag}${why ? ` — Begründung: ${why}.` : ''}`);
      hint(state.target_outcome || 'Monitoring fortführen, weitere Befunde erheben.');
    }

    else if (R_SUMMARY.test(ua)) {
      accept('Zusammenfassung des aktuellen Falls.');
      const id = state.id || '–';
      const story = state.story || '—';
      const flags = Array.isArray(state.red_flags) ? state.red_flags.join(' • ') : (state.red_flags || '—');
      const finds = Array.isArray(state.key_findings) ? state.key_findings.join(' • ') : (state.key_findings || '—');
      const diag  = state.solution?.diagnosis || '—';
      found(`FALL-ID: ${id}\nStory: ${story}\nRed Flags: ${flags}\nWichtige Befunde: ${finds}\nDiagnose/Verdacht: ${diag}`);
      hint(state.target_outcome || '');
    }

    else if (R_FLAGS.test(ua)) {
      accept('Informationsabfrage: Red Flags.');
      const flags = Array.isArray(state.red_flags) ? state.red_flags.join(' • ') : (state.red_flags || 'Keine Red Flags hinterlegt.');
      found(`Red Flags: ${flags}`);
      hint('Passe Prioritäten und Transportziel entsprechend an.');
    }

    else if (R_FINDS.test(ua)) {
      accept('Informationsabfrage: Wichtige Befunde.');
      const finds = Array.isArray(state.key_findings) ? state.key_findings.join(' • ') : (state.key_findings || 'Keine Schlüsselbefunde hinterlegt.');
      found(`Wichtige Befunde: ${finds}`);
      hint('Ergänze Befunde mit gezielter Diagnostik (EKG, BZ, Auskultation …).');
    }

    else if (R_GOAL.test(ua)) {
      accept('Informationsabfrage: Ziel/Vorgehen.');
      found(state.target_outcome || 'Ziel/Vorgehen ist im Fall nicht explizit hinterlegt.');
      hint('Weiter mit Monitoring, Reevaluation und Übergabe/Transportplanung.');
    }

    // ===== 7) Maßnahmen-Erkennung =====

    // O2-Gabe
    else if (R_O2.test(ua) && !R_MESSEN.test(ua)) {
      accept('Sauerstoffgabe in dieser Situation sinnvoll.');
      if (state.current_vitals.SpO2 == null && base?.SpO2 && base.SpO2 < 92) {
        vitals({ SpO2: Math.min(95, base.SpO2 + 2) });
      }
      hint('Monitoring fortführen, EKG erwägen, weitere Diagnostik (BZ, Pupillen, Auskultation).');
    }

    // EKG
    else if (R_EKG12.test(ua)) {
      accept('12-Kanal-EKG abgeleitet.');
      found(hidden.ekg12 ? `EKG-Befund: ${hidden.ekg12}.` : 'EKG-Befund: Sinus, keine akuten Hebungen.');
      hint('Befund bewerten, Transport/NA, Verlaufskontrolle planen.');
    } else if (R_EKG3.test(ua)) {
      accept('Monitoring/3-Kanal-EKG angelegt.');
      found(hidden.ekg3 ? `Monitoring: ${hidden.ekg3}.` : 'Monitoring: Sinusrhythmus.');
      hint('Bei Thoraxschmerz 12-Kanal-EKG ergänzen.');
    }

    // Mundraum
    else if (R_MUND.test(ua)) {
      accept('Mundraum inspiziert.');
      found(hidden.mouth || 'Keine Fremdkörper, Schleimhäute rosig, keine Aspiration erkennbar.');
      hint('Bei Atemproblemen: Auskultation, SpO₂, ggf. O₂, ggf. Absaugen (SOP).');
    }

    // Pupillen
    else if (R_PUPIL.test(ua)) {
      accept('Pupillen geprüft.');
      found(hidden.pupils || 'Pupillen isokor, prompt lichtreagibel.');
      hint('Bei Bewusstseinsstörung: GCS, BZ, EKG, ggf. BEFAST.');
    }

    // Auskultation
    else if (R_AUSK.test(ua)) {
      accept('Lunge auskultiert.');
      found(hidden.lung || 'Seitengleiches Atemgeräusch, keine groben Nebengeräusche.');
      hint('Perkussion/Inspektion ergänzen, SpO₂/AF dokumentieren.');
    }

    // Perkussion
    else if (R_PERK.test(ua)) {
      accept('Thorax perkutiert.');
      found('Perkussionsbefund unauffällig (kein deutlicher Klopfschalldifferenz).');
      hint('Auskultation/Inspektion fortführen, Monitoring komplettieren.');
    }

    // Hautbefund
    else if (R_HAUT.test(ua)) {
      accept('Hautbefund erhoben.');
      found('Haut warm, rosig; keine Zyanose, ggf. leicht kaltschweißig je nach Belastung.');
      hint('Vitalparameter komplettieren, Kapilläre Füllung prüfen.');
    }

    // DMS / Perfusion
    else if (R_BEDM.test(ua)) {
      accept('Durchblutung, Motorik, Sensibilität (DMS) geprüft.');
      found('DMS unauffällig, Kapilläre Füllung < 2 s.');
      hint('Bei Trauma: Pulse, Sensibilität/Motorik dokumentieren, Schienung/Lagerung nach Bedarf.');
    }

    // Schmerzskala
    else if (R_SCHMERZ.test(ua)) {
      accept('Schmerzskala erhoben.');
      found('NRS 6/10, drückend retrosternal (Beispiel; je nach Fall variabel).');
      hint('Analgesie nach SOP erwägen, Monitoring weiterführen.');
    }

    // BEFAST
    else if (R_BEFAST.test(ua)) {
      accept('BEFAST durchgeführt.');
      if (hidden.befast) {
        const b = hidden.befast;
        found(`BEFAST: Balance=${b.Balance}, Eyes=${b.Eyes}, Face=${b.Face}, Arms=${b.Arms}, Speech=${b.Speech}, Time=${b.Time}.`);
      } else {
        found('BEFAST unauffällig oder nicht eindeutig pathologisch.');
      }
      hint('Zeitfenster beachten, Stroke-Unit / Transport organisieren.');
    }

    // Neurologischer Status
    else if (R_NEURO.test(ua)) {
      accept('Neurologischer Status erhoben.');
      found(hidden.neuro || 'Keine groben fokal-neurologischen Defizite; Bewusstsein klar.');
      hint('Bei Auffälligkeit: Stroke-Protokoll, BZ, EKG, Transport priorisieren.');
    }

    // Anamnese / Vorerkrankungen / Medikation
    else if (R_ANAM.test(ua)) {
      accept('Anamnese/Vorerkrankungen erfragt.');
      if (hidden.anamnesis) {
        found(hidden.anamnesis);
      } else {
        const dx = (state.solution?.diagnosis || '').toLowerCase();
        if (dx.includes('koronar') || dx.includes('acs') || dx.includes('stemi') || dx.includes('nstemi')) {
          found('Vorerkrankungen: Hypertonie, Diabetes; Medikation: Ramipril, Metformin; Allergien: keine; Kein Antikoagulans.');
        } else if (dx.includes('schlaganfall') || dx.includes('stroke')) {
          found('Vorerkrankungen: Hypertonie; Medikation: Amlodipin; Allergien: keine; Beginn laut Angehörigen vor ~30–60 min.');
        } else {
          found('Vorerkrankungen/Medikation nach Patient/Angehörigen; Allergien verneint; Risikofaktoren möglich.');
        }
      }
      hint('Ergänze Allergien, Dauermedikation, Antikoagulation, frühere Ereignisse, Noxen.');
    }

    // Vitalparameter messen
    else if (R_RR.test(ua) && R_MESSEN.test(ua)) {
      accept('Blutdruck gemessen.');
      const RR = base?.RR || '120/80';
      found(`Befund: RR ${RR}`);
      vitals({ RR });
      hint('Vitalparameter komplettieren (SpO₂, AF, Puls, BZ, Temp, GCS).');
    } else if (R_SPO2.test(ua) && R_MESSEN.test(ua)) {
      accept('SpO₂ gemessen.');
      const SpO2 = base?.SpO2 ?? 97;
      found(`Befund: SpO₂ ${SpO2}%`);
      vitals({ SpO2 });
      hint('Bei Hypoxie O₂-Gabe erwägen, Monitoring fortführen.');
    } else if (R_AF.test(ua) && R_MESSEN.test(ua)) {
      accept('Atemfrequenz gezählt.');
      const AF = base?.AF ?? 16;
      found(`Befund: AF ${AF}/min`);
      vitals({ AF });
      hint('Auskultation/Perkussion ergänzen, Verlauf dokumentieren.');
    } else if (R_PULS.test(ua) && R_MESSEN.test(ua)) {
      accept('Puls/Herzfrequenz erhoben.');
      const Puls = base?.Puls ?? 80;
      found(`Befund: Puls ${Puls}/min`);
      vitals({ Puls });
      hint('EKG/Monitoring ergänzen, Rhythmus kontrollieren.');
    } else if (R_BZ.test(ua) && R_MESSEN.test(ua)) {
      accept('Blutzucker gemessen.');
      const BZ = base?.BZ ?? 110;
      found(`Befund: BZ ${BZ} mg/dl`);
      vitals({ BZ });
      hint('Bei Entgleisung Maßnahmen nach SOP, Monitoring fortführen.');
    } else if (R_TEMP.test(ua) && R_MESSEN.test(ua)) {
      accept('Temperatur gemessen.');
      const Temp = base?.Temp ?? 36.8;
      found(`Befund: Temp ${Temp}°C`);
      vitals({ Temp });
      hint('Weiterer klinischer Kontext berücksichtigen (Infekt/Sepsis?).');
    } else if (R_GCS.test(ua) && R_MESSEN.test(ua)) {
      accept('GCS erhoben.');
      const GCS = base?.GCS ?? 15;
      found(`Befund: GCS ${GCS}`);
      vitals({ GCS });
      hint('Bei Reduktion: Ursachen klären (BZ, Kopf, Intox, Hypoxie).');
    }

    // Fallback
    else {
      reject('Aktion/Frage nicht eindeutig zuordenbar.');
      found('Nutze klare, kurze Statements (z. B. „Mundraum schauen“, „Pupillen prüfen“, „EKG schreiben“, „RR messen“, „Diagnose?“).');
      hint('Vitalzeichen komplettieren, Auskultation/Perkussion, EKG, ggf. BEFAST.');
    }

    // ===== 8) State aktualisieren =====
    if (reply.accepted) state.steps_done.push(ua);
    if (reply.updated_vitals) state.current_vitals = { ...(state.current_vitals || {}), ...reply.updated_vitals };
    reply.case_state = state;

    return { statusCode: 200, headers, body: JSON.stringify(reply) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
