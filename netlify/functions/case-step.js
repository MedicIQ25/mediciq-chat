// ================================================================
// medicIQ – Step-Engine (case-step.js)
// ================================================================
export async function handler(event) {
  // ----- CORS -----
  const ALLOWED_ORIGINS = [
    "https://www.mediciq.de",
    "https://mediciq.de",
    "https://mediciq.webflow.io"
  ];
  const reqOrigin = event.headers.origin || event.headers.Origin || "";
  const allowOrigin = ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0];
  const headers = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin"
  };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    const body       = JSON.parse(event.body || "{}");
    const case_state = body.case_state || null;
    const role       = (body.role || case_state?.role || "RS").toString();
    let ua           = (body.user_action || "").toString();

    if (!case_state || !ua) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "case_state oder user_action fehlt" }) };
    }

    // ----- Normalize input -----
    ua = ua.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

    // ----- Reply skeleton -----
    const reply = {
      accepted:false, outside_scope:false, unsafe:false, score_delta:0,
      evaluation:"", found:"", finding:"", result_text:"", next_hint:"",
      updated_vitals:null, done:false, case_state:null
    };
    const accept     = (t)=>{ reply.accepted=true; if(t) reply.evaluation=t; if(reply.score_delta<1) reply.score_delta=1; };
    const setFinding = (t)=>{ if(t){ reply.found=t; reply.finding=t; reply.result_text=t; } };
    const hint       = (t)=>{ if(t) reply.next_hint=t; };

    // ----- State -----
    const state   = { ...case_state };
    state.steps_done      = Array.isArray(state.steps_done) ? state.steps_done : [];
    state.current_vitals  = state.current_vitals || {};         // NUR für UI
    state.engine          = state.engine || { vitals: {} };     // intern
    const hidden          = state.hidden || {};
    const base            = hidden.vitals_baseline || null;

    // ----- Regex matcher -----
    const R_DIAG   = /(diagnose|arbeitsdiagnose|verdacht|was hat der patient|was hat die patientin|was ist los)/i;

    const R_O2     = /(o2|sauerstoff|oxygen)/i;
    const R_MESSEN = /(messen|prufen|pruefen|kontrollieren|erheben|bestimmen)/i;

    const R_EKG12  = /(12.?kanal|zwolf.?kanal|12.?ableitung|12.*ekg|ekg.*12)/i;
    // alles „ekg“/„monitoring“, sofern nicht 12-kanalig
    const R_EKG3   = /\b(ekg(?!.*12)|monitoring|telemetrie|3\\s*(kanal|ableitung)|5\\s*(kanal|ableitung)|6\\s*(kanal|ableitung))\b/i;

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
    const R_LAG_OKH    = /(oberkorper(hoch)?|herzbett|kopf hoch|okh|hochlagern)/i;
    const R_LAG_SITZ   = /(sitzen|sitzend|kutschersitz|komfortlagerung|atemerleichternd)/i;
    const R_LAG_SSL    = /(stabile seitenlage|ssl)/i;
    const R_LAG_SCHOCK = /(schocklage|beine hoch)/i;

    // Shortcuts
    const R_NA     = /(na nachfordern|notarzt nachfordern|arzt nachfordern)/i;
    const R_TRANSP = /(transport einleiten|fahrt aufnehmen|abfahrt|losfahren)/i;
    const R_UEGABE = /(ubergabe|uebergabe|report|handover)/i;

    // RS-Maßnahmen extra
    const R_ABSAUG = /(absaugen|sekret absaugen|absaugung)/i;
    const R_WARM   = /(warme|warmeerhalt|zudecken|decken|isomantel)/i;
    const R_KUEHL  = /(kuhlen|kuhlung|eiskompresse|kaltkompresse)/i;

    // ----- Tools / vitals -----
    const num   = (x,d)=>isFinite(+x)?+x:d;
    const clamp = (v,lo,hi)=>Math.max(lo,Math.min(hi,v));

    const getIV = () => {
      const baseRR = (base?.RR || "120/80").split("/");
      const iv = state.engine?.vitals || {};
      return {
        RR:   iv.RR   || `${num(baseRR[0],120)}/${num(baseRR[1],80)}`,
        SpO2: num(iv.SpO2, num(base?.SpO2, 96)),
        AF:   num(iv.AF,   num(base?.AF,   16)),
        Puls: num(iv.Puls, num(base?.Puls, 80)),
        BZ:   num(iv.BZ,   num(base?.BZ,  110)),
        Temp: num(iv.Temp, num(base?.Temp, 36.8)),
        GCS:  num(iv.GCS,  num(base?.GCS,  15))
      };
    };
    const setIV = (patch) => {
      state.engine = { ...(state.engine || {}), vitals: { ...(state.engine?.vitals || {}), ...patch } };
    };
    const exposeMeasured = (key) => {
      const iv = getIV();
      const value = iv[key];
      const patch = { [key]: value };
      reply.updated_vitals = { ...(reply.updated_vitals || {}), ...patch };
      state.current_vitals = { ...(state.current_vitals || {}), ...patch };
    };

    const naturalProgression = () => {
      const p = state.patho || {};
      const v = getIV();
      const w = num(p.baseline_deterioration, 0);
      if (w>0) {
        const AF = clamp(v.AF + (w>=2? 1:0), 6, 40);
        const SpO2 = clamp(v.SpO2 - (w>=2? 1:0), 70, 100);
        const Puls = clamp(v.Puls + (w>=2? 2:1), 40, 180);
        setIV({ AF, SpO2, Puls });
      }
    };

    // ----- Effekte (nur intern) -----
    const EFFECTS = {
      O2: () => {
        const v = getIV();
        const tag = state.patho?.tag || [];
        let inc = v.SpO2 < 88 ? 4 : v.SpO2 < 92 ? 3 : 2;
        if (tag.includes("obstruktiv")) inc = Math.max(1, inc-1);
        setIV({ SpO2: clamp(v.SpO2 + inc, 90, 99), AF: clamp(v.AF - 1, 6, 40), Puls: clamp(v.Puls - 1, 40, 180) });
      },
      LAGERUNG_OKH: () => { const v=getIV(); setIV({ AF: clamp(v.AF-1,6,40), SpO2: clamp(v.SpO2+1,70,100) }); },
      LAGERUNG_SITZ: () => { const v=getIV(); setIV({ AF: clamp(v.AF-2,6,40), SpO2: clamp(v.SpO2+1,70,100) }); },
      LAGERUNG_SSL:  () => { const v=getIV(); const bonus = v.GCS < 15 ? 1:0; setIV({ SpO2: clamp(v.SpO2+bonus,70,100) }); },
      LAGERUNG_SCHOCK: () => { const v=getIV(); if ((state.patho?.tag||[]).includes("ACS")) { setIV({ AF: clamp(v.AF+1,6,40), Puls: clamp(v.Puls+2,40,180) }); } else { setIV({ Puls: clamp(v.Puls-1,40,180) }); } },
      ABSAUGEN: () => { const v=getIV(); setIV({ SpO2: clamp(v.SpO2+1,70,100), AF: clamp(v.AF-1,6,40) }); },
      WARME: () => { const v=getIV(); setIV({ Puls: clamp(v.Puls-1,40,180) }); },
      KUEHLEN: () => { const v=getIV(); setIV({ Puls: clamp(v.Puls-1,40,180) }); }
    };

    // ----- Anamnese-Formatter -----
    const answerAnamnesis = (key,label) => {
      const a = state.anamnesis || {};
      const val = a[key];
      if (!val) return `Zu ${label} liegen keine Angaben vor.`;
      if (typeof val === "string") return `${label}: ${val}`;
      if (Array.isArray(val)) return `${label}: ${val.join(", ") || "o.B."}`;
      if (typeof val === "object") {
        return `${label}: ` + Object.entries(val).map(([k,v]) => `${k.toUpperCase()}: ${Array.isArray(v)?v.join(", "):v}`).join(" • ");
      }
      return `${label}: ${val}`;
    };

    // ===== Aktionen =====
    const a = state.anamnesis || {};

    // Diagnose
    if (R_DIAG.test(ua)) { accept("Arbeitsdiagnose benannt."); setFinding(`Arbeitsdiagnose: ${state.solution?.diagnosis || "—"}`); }
    // Anamnese
    else if (R_SAMPLER.test(ua)) { accept("SAMPLER erfragt."); setFinding(answerAnamnesis("SAMPLER","SAMPLER")); hint("Ergänze OPQRST oder gezielte Risikofaktoren."); }
    else if (R_OPQRST.test(ua))  { accept("OPQRST erfragt.");  setFinding(answerAnamnesis("OPQRST","OPQRST")); }
    else if (R_VK.test(ua))      { accept("Vorerkrankungen erfragt."); setFinding(answerAnamnesis("vorerkrankungen","Vorerkrankungen")); }
    else if (R_MEDIK.test(ua))   { accept("Medikation erfragt."); setFinding(answerAnamnesis("medikation","Medikation")); }
    else if (R_ALLERG.test(ua))  { accept("Allergien erfragt."); setFinding(answerAnamnesis("allergien","Allergien")); }
    else if (R_ANTIKO.test(ua))  { accept("Antikoagulation erfragt."); setFinding(a.antikoagulation ? "Patient ist antikoaguliert." : "Keine Antikoagulation bekannt."); }
    else if (R_SOZIAL.test(ua))  { accept("Sozialanamnese erfragt."); setFinding(answerAnamnesis("sozial","Sozialanamnese")); }
    else if (R_LMEAL.test(ua))   { accept("Letzte Nahrungsaufnahme erfragt."); setFinding(a?.SAMPLER?.L ? `Letzte Nahrungsaufnahme: ${a.SAMPLER.L}` : "Keine Angabe zur letzten Nahrungsaufnahme."); }

    // Monitoring / Befunde (→ UI nur Einzelwert updaten)
    else if (R_EKG12.test(ua)) { accept("12-Kanal-EKG abgeleitet."); setFinding(`12-Kanal-EKG: ${hidden.ekg12 || "Sinus"}`); }
    else if (R_EKG3.test(ua))  { accept("Monitoring / Nicht-12-Kanal-EKG angelegt."); setFinding(hidden.ekg3 || "Monitoring läuft."); }
    else if (R_RR.test(ua))    { accept("RR gemessen.");   exposeMeasured("RR");   setFinding(`RR: ${getIV().RR} mmHg`); }
    else if (R_SPO2.test(ua))  { accept("SpO₂ gemessen."); exposeMeasured("SpO2"); setFinding(`SpO₂: ${getIV().SpO2} %`); }
    else if (R_AF.test(ua))    { accept("AF gezählt.");    exposeMeasured("AF");   setFinding(`AF: ${getIV().AF} /min`); }
    else if (R_PULS.test(ua))  { accept("Puls gezählt.");  exposeMeasured("Puls"); setFinding(`Puls: ${getIV().Puls} /min`); }
    else if (R_BZ.test(ua))    { accept("BZ gemessen.");   exposeMeasured("BZ");   setFinding(`BZ: ${getIV().BZ} mg/dL`); }
    else if (R_TEMP.test(ua))  { accept("Temperatur gemessen."); exposeMeasured("Temp"); setFinding(`Temp: ${getIV().Temp} °C`); }
    else if (R_GCS.test(ua))   { accept("GCS erhoben.");   exposeMeasured("GCS"); setFinding(`GCS: ${getIV().GCS}`); }

    else if (R_MUND.test(ua))  { accept("Mundraum inspiziert."); setFinding(`Mundraum: ${hidden.mouth || "unauffällig"}`); }
    else if (R_PUPIL.test(ua)) { accept("Pupillen geprüft."); setFinding(`Pupillen: ${hidden.pupils || "isokor, prompt"}`); }
    else if (R_AUSK.test(ua))  { accept("Lunge auskultiert."); setFinding(`Auskultation: ${hidden.lung || "vesikulär"}`); }
    else if (R_PERK.test(ua))  { accept("Thorax perkutiert."); setFinding("Perkussion: unauffällig"); }
    else if (R_HAUT.test(ua))  { accept("Haut beurteilt."); setFinding("Haut: passend zum Fall (z. B. kalt/klatschig, zyanotisch)."); }
    else if (R_SCHMERZ.test(ua)) { accept("Schmerzskala erfragt."); setFinding(a.OPQRST?.S ? `Schmerz: ${a.OPQRST.S}` : "Schmerzskala erhoben."); }
    else if (R_BEDM.test(ua))  { accept("DMS/Perfusion geprüft."); setFinding(hidden.neuro || "DMS/Perfusion o.B."); }
    else if (R_BEFAST.test(ua) || R_NEURO.test(ua)) { accept("Neurologischer Status."); setFinding(hidden.befast || hidden.neuro || "BEFAST unauffällig."); }

    // Maßnahmen (nur intern wirken; UI erst nach Messung)
    else if (R_O2.test(ua) && !R_MESSEN.test(ua)) { accept("Sauerstoffgabe durchgeführt."); EFFECTS.O2(); setFinding("O₂ gegeben (titriert nach Indikation)."); hint("Reevaluation: SpO₂/AF/Puls erneut prüfen, EKG/12-Kanal erwägen."); }
    else if (R_LAG_OKH.test(ua))   { accept("Oberkörper hoch gelagert."); EFFECTS.LAGERUNG_OKH(); setFinding("Lagerung: Oberkörper hoch."); }
    else if (R_LAG_SITZ.test(ua))  { accept("Sitzlagerung durchgeführt."); EFFECTS.LAGERUNG_SITZ(); setFinding("Lagerung: sitzend/atemerleichternd."); }
    else if (R_LAG_SSL.test(ua))   { accept("Stabile Seitenlage durchgeführt."); EFFECTS.LAGERUNG_SSL(); setFinding("Lagerung: stabile Seitenlage."); }
    else if (R_LAG_SCHOCK.test(ua)){ accept("Schocklage durchgeführt."); EFFECTS.LAGERUNG_SCHOCK(); setFinding("Lagerung: Schocklage."); }

    // Extra-RS
    else if (R_ABSAUG.test(ua)) { accept("Absaugung durchgeführt."); EFFECTS.ABSAUGEN(); setFinding("Sekret abgesaugt, Atemweg freier."); }
    else if (R_WARM.test(ua))   { accept("Wärmeerhalt sichergestellt."); EFFECTS.WARME(); setFinding("Wärmeerhalt umgesetzt."); }
    else if (R_KUEHL.test(ua))  { accept("Kühlung durchgeführt."); EFFECTS.KUEHLEN(); setFinding("Kühlung lokal durchgeführt."); }

    // Shortcuts
    else if (R_NA.test(ua))     { accept("Notarzt nachgefordert."); setFinding("NA nachgefordert – Eintreffen abwarten, Lagebericht fortlaufend."); }
    else if (R_TRANSP.test(ua)) { accept("Transport eingeleitet.");  setFinding("Transport eingeleitet – Monitoring fortführen, Zielklinik gemäß Verdacht."); }
    else if (R_UEGABE.test(ua)) { accept("Übergabe durchgeführt.");  setFinding("Übergabe nach MIST/SBAR erfolgt."); reply.done = true; }

    // Unklare Eingabe
    else {
      hint("Versuche: 'SAMPLER', 'OPQRST', 'SpO₂ messen', 'O₂ geben', '12-Kanal-EKG', 'ekg' (Monitoring), 'Oberkörper hoch', 'Transport einleiten', 'NA nachfordern', 'Übergabe' …");
    }

    // ----- Verlauf anwenden -----
    naturalProgression();

    // ----- Zielprüfung (optional) -----
    const iv = getIV();
    if (iv.SpO2 >= 94 && state.target_outcome) {
      reply.done = reply.done || false;
    }

    reply.case_state = state;
    return { statusCode: 200, headers, body: JSON.stringify(reply) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
