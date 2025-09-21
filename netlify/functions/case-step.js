// ============================
// netlify/functions/case-step.js
// ============================
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
    Vary: 'Origin'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const case_state = body.case_state || null;
    const role       = (body.role || case_state?.role || 'RS').toString();
    let ua           = (body.user_action || '').toString();

    if (!case_state || !ua) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'case_state oder user_action fehlt' }) };
    }

    // ===== 2) Eingabe normalisieren =====
    ua = ua.normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();

    // ===== 3) Antwort-Skelett =====
    const reply = { accepted:false, outside_scope:false, unsafe:false, score_delta:0, evaluation:'', found:'', finding:'', result_text:'', next_hint:'', updated_vitals:null, done:false, case_state:null };
    const accept    = (t)=>{ reply.accepted=true; if(t) reply.evaluation=t; if(reply.score_delta<1) reply.score_delta=1; };
    const setFinding= (t)=>{ if(!t) return; reply.found=t; reply.finding=t; reply.result_text=t; };
    const hint      = (t)=>{ if(t) reply.next_hint=t; };

    // ===== 4) State =====
    const state  = { ...case_state };
    state.steps_done    = Array.isArray(state.steps_done) ? state.steps_done : [];
    state.current_vitals= state.current_vitals || {};
    const hidden        = state.hidden || {};
    const base          = hidden.vitals_baseline || null;

    // ===== 5) Matcher =====
    const R_O2     = /(o2|sauerstoff|oxygen)/i;
    const R_MESSEN = /(messen|prufen|pruefen|kontrollieren|erheben|bestimmen)/i;
    const R_EKG3   = /(ekg.*(3|drei)|monitoring\b(?!.*12))/i;
    const R_EKG12  = /(12.?kanal|zwolf.?kanal|12.?ableitung|12.*ekg|ekg.*12)/i;
    const R_RR     = /\b(rr|blutdruck)\b/i;
    const R_SPO2   = /\b(spo2|sauerstoffsatt|sattigung|pulsoxi)\b/i;
    const R_AF     = /\b(af|atemfrequenz)\b/i;
    const R_PULS   = /\b(puls|herzfrequenz|hf)\b/i;
    const R_BZ     = /\b(bz|blutzucker|glukose|glucose)\b/i;
    const R_TEMP   = /\b(temp|temperatur|fieber)\b/i;
    const R_GCS    = /\b(gcs|glasgow)\b/i;

    const R_MUND   = /(mundraum|mund|rachen|oropharynx|zunge|aspiration)/i;
    const R_PUPIL  = /(pupille|pupillen)/i;
    const R_AUSK   = /(auskultation|abhorchen|lungengerau?sch|giemen|rassel|stridor)/i;
    const R_PERK   = /(perkussion|beklopfen|hypersonor|gedampft)/i;
    const R_HAUT   = /(haut|blasse|zyanose|schweiss|schweissig|kaltschweiss)/i;
    const R_SCHMERZ= /(schmerzskala|nrs|schmerzscore)/i;
    const R_BEDM   = /(dms|durchblutung.*motorik.*sensibilitat|perfusionscheck|kapill|rekap|kapillarfuellung)/i;
    const R_BEFAST = /\bbefast\b/i;
    const R_NEURO  = /(neurolog|status)/i;

    // Anamnese
    const R_SAMPLER= /\b(sampler|sample-r?)\b/i;
    const R_OPQRST = /\b(opqrst)\b/i;
    const R_VK     = /(vorerkrankung(en)?|grunderkrankung(en)?|krankengeschichte)/i;
    const R_MEDIK  = /(medikation|medikamente|einnahmen)/i;
    const R_ALLERG = /(allergie(n)?|unvertraglichkeit(en)?)/i;
    const R_ANTIKO = /(antikoagulation|blutverduenn(er)?|blutverdunner)/i;
    const R_SOZIAL = /(sozialanamnese|rauchen|alkohol|drogen|wohnsituation)/i;
    const R_LMEAL  = /(letzte(r|n)? (mahlzeit|essen|nahrungsaufnahme))/i;

    // Lagerung
    const R_LAG_OKH  = /(oberkorper(hoch)?|herzbett|kopf hoch|okh|hochlagern)/i;
    const R_LAG_SITZ = /(sitzen|sitzend|kutschersitz|komfortlagerung|atemerleichternd)/i;
    const R_LAG_SSL  = /(stabile seitenlage|ssl)/i;
    const R_LAG_SCHOCK = /(schocklage|beine hoch)/i;

    // ===== 6) Tools =====
    const num    = (x,d)=>isFinite(+x)?+x:d;
    const clamp  = (v,lo,hi)=>Math.max(lo,Math.min(hi,v));

    const getCurrentVitals = () => {
      const baseRR = (base?.RR||'120/80').split('/');
      const RR = state.current_vitals.RR || `${num(baseRR[0],120)}/${num(baseRR[1],80)}`;
      return {
        RR,
        SpO2: num(state.current_vitals.SpO2, num(base?.SpO2, 96)),
        AF:   num(state.current_vitals.AF,   num(base?.AF,   16)),
        Puls: num(state.current_vitals.Puls, num(base?.Puls, 80)),
        BZ:   num(state.current_vitals.BZ,   num(base?.BZ,  110)),
        Temp: num(state.current_vitals.Temp, num(base?.Temp, 36.8)),
        GCS:  num(state.current_vitals.GCS,  num(base?.GCS,  15))
      };
    };
    const setVitals = (v) => { reply.updated_vitals = { ...(reply.updated_vitals||{}), ...v }; state.current_vitals = { ...(state.current_vitals||{}), ...v }; };

    const naturalProgression = () => {
      const p = state.patho || {};
      const v = getCurrentVitals();
      const w = num(p.baseline_deterioration, 0);
      if (w>0) {
        const AF = clamp(v.AF + (w>=2? 1:0), 6, 40);
        const SpO2 = clamp(v.SpO2 - (w>=2? 1:0), 70, 100);
        const Puls = clamp(v.Puls + (w>=2? 2:1), 40, 180);
        setVitals({ AF, SpO2, Puls });
      }
    };

    // ===== 7) Effekt-Engine =====
    const EFFECTS = {
      O2: () => {
        const v = getCurrentVitals();
        const tag = state.patho?.tag || [];
        let inc = v.SpO2 < 88 ? 4 : v.SpO2 < 92 ? 3 : 2;
        if (tag.includes('obstruktiv')) inc = Math.max(1, inc-1);
        setVitals({ SpO2: clamp(v.SpO2 + inc, 90, 99), AF: clamp(v.AF - 1, 6, 40), Puls: clamp(v.Puls - 1, 40, 180) });
      },
      LAGERUNG_OKH: () => { const v=getCurrentVitals(); setVitals({ AF: clamp(v.AF-1,6,40), SpO2: clamp(v.SpO2+1,70,100) }); },
      LAGERUNG_SITZ: () => { const v=getCurrentVitals(); setVitals({ AF: clamp(v.AF-2,6,40), SpO2: clamp(v.SpO2+1,70,100) }); },
      LAGERUNG_SSL:  () => { const v=getCurrentVitals(); const bonus = v.GCS < 15 ? 1:0; setVitals({ SpO2: clamp(v.SpO2+bonus,70,100) }); },
      LAGERUNG_SCHOCK: () => { const v=getCurrentVitals(); if ((state.patho?.tag||[]).includes('ACS')) { setVitals({ AF: clamp(v.AF+1,6,40), Puls: clamp(v.Puls+2,40,180) }); } else { setVitals({ Puls: clamp(v.Puls-1,40,180) }); } }
    };

    // ===== 8) Anamnese-Antwort =====
    const answerAnamnesis = (key,label) => {
      const a = state.anamnesis || {};
      const val = a[key];
      if (!val) return `Zu ${label} liegen keine Angaben vor.`;
      if (typeof val === 'string') return `${label}: ${val}`;
      if (Array.isArray(val)) return `${label}: ${val.join(', ') || 'o.B.'}`;
      if (typeof val === 'object') {
        return `${label}: ` + Object.entries(val).map(([k,v]) => `${k.toUpperCase()}: ${Array.isArray(v)?v.join(', '):v}`).join(' • ');
      }
      return `${label}: ${val}`;
    };

    // ===== 9) Aktionen parsen =====
    const a = state.anamnesis || {};

    // Anamnese
    if (R_SAMPLER.test(ua)) { accept('SAMPLER erfragt.'); setFinding(answerAnamnesis('SAMPLER','SAMPLER')); hint('Ergänze OPQRST oder gezielte Risikofaktoren.'); }
    else if (R_OPQRST.test(ua)) { accept('OPQRST erfragt.'); setFinding(answerAnamnesis('OPQRST','OPQRST')); }
    else if (R_VK.test(ua)) { accept('Vorerkrankungen erfragt.'); setFinding(answerAnamnesis('vorerkrankungen','Vorerkrankungen')); }
    else if (R_MEDIK.test(ua)) { accept('Medikation erfragt.'); setFinding(answerAnamnesis('medikation','Medikation')); }
    else if (R_ALLERG.test(ua)) { accept('Allergien erfragt.'); setFinding(answerAnamnesis('allergien','Allergien')); }
    else if (R_ANTIKO.test(ua)) { accept('Antikoagulation erfragt.'); setFinding(a.antikoagulation ? 'Patient ist antikoaguliert.' : 'Keine Antikoagulation bekannt.'); }
    else if (R_SOZIAL.test(ua)) { accept('Sozialanamnese erfragt.'); setFinding(answerAnamnesis('sozial','Sozialanamnese')); }
    else if (R_LMEAL.test(ua)) { accept('Letzte Nahrungsaufnahme erfragt.'); setFinding(a?.SAMPLER?.L ? `Letzte Nahrungsaufnahme: ${a.SAMPLER.L}` : 'Keine Angabe zur letzten Nahrungsaufnahme.'); }

    // Monitoring & Untersuchungen (Werte kommen stets aus dem Zustand)
    else if (R_EKG12.test(ua)) { accept('12-Kanal-EKG abgeleitet.'); setFinding(`12-Kanal-EKG: ${hidden.ekg12 || 'Sinusrhythmus'}`); }
    else if (R_EKG3.test(ua)) { accept('Monitoring / 3-Kanal-EKG angelegt.'); setFinding(hidden.ekg3 || 'Monitoring läuft.'); }
    else if (R_RR.test(ua))  { accept('RR gemessen.');  const v=getCurrentVitals(); setFinding(`RR: ${v.RR} mmHg`); }
    else if (R_SPO2.test(ua)) { accept('SpO₂ gemessen.'); const v=getCurrentVitals(); setFinding(`SpO₂: ${v.SpO2} %`); }
    else if (R_AF.test(ua))   { accept('AF gezählt.');    const v=getCurrentVitals(); setFinding(`AF: ${v.AF} /min`); }
    else if (R_PULS.test(ua)) { accept('Puls gezählt.');  const v=getCurrentVitals(); setFinding(`Puls: ${v.Puls} /min`); }
    else if (R_BZ.test(ua))   { accept('BZ gemessen.');   const v=getCurrentVitals(); setFinding(`BZ: ${v.BZ} mg/dL`); }
    else if (R_TEMP.test(ua)) { accept('Temperatur gemessen.'); const v=getCurrentVitals(); setFinding(`Temp: ${v.Temp} °C`); }
    else if (R_GCS.test(ua))  { accept('GCS erhoben.');   const v=getCurrentVitals(); setFinding(`GCS: ${v.GCS}`); }

    else if (R_MUND.test(ua)) { accept('Mundraum inspiziert.'); setFinding(`Mundraum: ${hidden.mouth || 'unauffällig'}`); }
    else if (R_PUPIL.test(ua)) { accept('Pupillen geprüft.'); setFinding(`Pupillen: ${hidden.pupils || 'isokor, prompt'}`); }
    else if (R_AUSK.test(ua)) { accept('Lunge auskultiert.'); setFinding(`Auskultation: ${hidden.lung || 'vesikulär'}`); }
    else if (R_PERK.test(ua)) { accept('Thorax perkutiert.'); setFinding('Perkussion: unauffällig'); }
    else if (R_HAUT.test(ua)) { accept('Haut beurteilt.'); setFinding('Haut: rosig/weiß? Schweiß? — je nach Fall.'); }
    else if (R_SCHMERZ.test(ua)) { accept('Schmerzskala erfragt.'); setFinding(a.OPQRST?.S ? `Schmerz: ${a.OPQRST.S}` : 'Schmerzskala erhoben.'); }
    else if (R_BEDM.test(ua)) { accept('DMS/Perfusion geprüft.'); setFinding(hidden.neuro || 'DMS/Perfusion o.B.'); }
    else if (R_BEFAST.test(ua) || R_NEURO.test(ua)) { accept('Neurologischer Status.'); setFinding(hidden.befast || hidden.neuro || 'BEFAST unauffällig.'); }

    // Maßnahmen (wirken auf Vitalwerte)
    else if (R_O2.test(ua) && !R_MESSEN.test(ua)) { accept('Sauerstoffgabe durchgeführt.'); EFFECTS.O2(); setFinding('O₂ gegeben (titriert nach Indikation).'); hint('Reevaluation: SpO₂/AF/Puls erneut prüfen, EKG/12-Kanal erwägen.'); }
    else if (R_LAG_OKH.test(ua)) { accept('Oberkörper hoch gelagert.'); EFFECTS.LAGERUNG_OKH(); setFinding('Lagerung: Oberkörper hoch.'); }
    else if (R_LAG_SITZ.test(ua)) { accept('Sitzlagerung durchgeführt.'); EFFECTS.LAGERUNG_SITZ(); setFinding('Lagerung: sitzend/atemerleichternd.'); }
    else if (R_LAG_SSL.test(ua))  { accept('Stabile Seitenlage durchgeführt.'); EFFECTS.LAGERUNG_SSL(); setFinding('Lagerung: stabile Seitenlage.'); }
    else if (R_LAG_SCHOCK.test(ua)) { accept('Schocklage durchgeführt.'); EFFECTS.LAGERUNG_SCHOCK(); setFinding('Lagerung: Schocklage.'); }

    // Unklare Eingabe → Hinweis & Drift
    else {
      hint("Ich habe dich nicht ganz verstanden. Versuche: 'SAMPLER', 'OPQRST', 'SpO₂ messen', 'O₂ geben', '12-Kanal-EKG', 'Oberkörper hoch' …");
    }

    // ===== 10) Verlauf anwenden =====
    naturalProgression();

    // ===== 11) Abschluss/Kriterien (einfaches Beispiel)
    const v = getCurrentVitals();
    if (v.SpO2 >= 94 && state.target_outcome) {
      // Ziel noch nicht automatisch abschließen; das passiert bei Übergabe/Transport in deinem Frontend.
      reply.done = false;
    }

    reply.case_state = state;
    
    return { statusCode: 200, headers, body: JSON.stringify(reply) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
