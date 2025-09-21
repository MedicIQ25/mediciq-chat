// ================================================================
/* medicIQ – Step-Engine (case-step.js)
   XABCDE-Schema vollständig + Maßnahmen:
   - X: Blutstillung, Hämostyptika, Tourniquet
   - A: Esmarch, Absaugen, OPA/NPA, BVM, (NotSan) Larynxtubus
   - B: Thorax-Inspektion/Palpation/Perkussion/Auskultation,
        (NotSan) Entlastungspunktion
   - C: Pulsqualität, Rekap-Zeit, RR, EKG, (NotSan) i.v./i.o. + Volumen
   - D: GCS/AVPU, Pupillen, BZ, (NotSan) Glukosegabe
   - E: Entkleiden/Bodycheck, Temp, Wärmeerhalt
   - Trauma: sichtbare Verletzungen, **DMS vor/nach** (auch ohne Fraktur),
             Beckenschlinge, Schienung, Halskrause, NEXUS
   - Einzelwert-Messungen → updated_vitals nur für den angefragten Wert
*/
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
    const deny       = (t)=>{ reply.outside_scope=true; reply.evaluation=t||"Außerhalb Kompetenzen."; };
    const setFinding = (t)=>{ if(t){ reply.found=t; reply.finding=t; reply.result_text=t; } };
    const hint       = (t)=>{ if(t) reply.next_hint=t; };

    // ----- State -----
    const state   = { ...case_state };
    state.steps_done      = Array.isArray(state.steps_done) ? state.steps_done : [];
    state.current_vitals  = state.current_vitals || {};         // UI (nur gemessen)
    state.engine          = state.engine || { vitals: {}, immobilization:{}, dms_log:[] }; // intern
    const hidden          = state.hidden || {};
    const base            = hidden.vitals_baseline || null;

    // Injuries / DMS store
    const injuries = Array.isArray(hidden.injuries) ? hidden.injuries : [];
    state.engine.dms_log = state.engine.dms_log || []; // [{when:'vor/nach/jetzt', text}]

    // ----- Regex matcher (Stichworte) -----
    const R_DIAG   = /(diagnose|arbeitsdiagnose|verdacht|was hat der patient|was hat die patientin|was ist los)/i;

    // XABCDE
    const R_XABC   = /\bx[-\s]*abcde\b|\b(primary|primary survey)\b/i;
    const R_STEP_X = /(^|\s)x($|\s)|exsang|massive blut|massive bleed/i;
    const R_STEP_A = /(^|\s)a($|\s)|airway|atemweg/i;
    const R_STEP_B = /(^|\s)b($|\s)|breathing|atmung|thorax/i;
    const R_STEP_C = /(^|\s)c($|\s)|circulation|kreislauf/i;
    const R_STEP_D = /(^|\s)d($|\s)|disability|neurolog/i;
    const R_STEP_E = /(^|\s)e($|\s)|exposure|environment|entkleiden|bodycheck|top.*to.*toe|head.*to.*toe/i;

    // Airway Maßnahmen
    const R_ESMARCH  = /(esmarch|jaw.?thrust|kinn.*hebel|esmarch-?handgriff)/i;
    const R_OPA      = /(guedel|oropharyngeal.*tubus|opa\b)/i;
    const R_NPA      = /(wendel|nasopharyngeal.*tubus|npa\b)/i;
    const R_BVM      = /(beutel.*maske|bvm|beatmen|maskenbeatmung|druckbeatmung)/i;
    const R_LT       = /(larynx.*tubus|larynxtubus|lt\b)/i;

    // B / Thorax
    const R_THX_INS  = /(thorax|brustkorb).*(ansehen|inspektion|beurteil|symmetrie|bewegung)/i;
    const R_THX_PALP = /(thorax|rippen|brustkorb).*(palp|tast|stabil)/i;
    const R_THX_PERK = /(thorax|brustkorb).*(perkuss|klopfen)/i;
    const R_THX_AUSK = /(thorax|brustkorb|lungen).*(auskult|abh[oö]r)/i;
    const R_NEEDLE   = /(entlastungspunktion|dekompressionspunktion|nadel.*thorax|thorax.*entlast)/i;

    // C / Circulation
    const R_CFT      = /(rekap|kapillar.*full|kapillar.*zeit|cft)/i;
    const R_IV       = /\b(i\.?v\.?|venen(zu|zu)gang|zugang legen|venflon|braunule|branule|peripherer zugang)\b/i;
    const R_IO       = /\b(i\.?o\.?|intraoss[aä]r|bohrung)\b/i;
    const R_VOLUME   = /(volumen|infusion|ringer|nacl|kristalloid|bolus|500 ?ml|1000 ?ml)/i;

    // D / Disability
    const R_GLUCOSE  = /(glukose|dextrose|traubenzucker|glucose)\s*(geben|gabe|iv|io)?/i;

    // E / Exposure
    const R_EXPOSE   = /(entkleiden|bodycheck|top.*to.*toe|head.*to.*toe|vollstandig entkleiden)/i;

    // Monitoring / Messungen
    const R_O2     = /(o2|sauerstoff|oxygen)\b/i;
    const R_MESSEN = /(messen|prufen|pruefen|kontrollieren|erheben|bestimmen)/i;
    const R_EKG12  = /(12.?kanal|zwolf.?kanal|12.?ableitung|12.*ekg|ekg.*12)/i;
    const R_EKG3   = /\b(ekg(?!.*12)|monitoring|telemetrie|3\s*(kanal|ableitung)|5\s*(kanal|ableitung)|6\s*(kanal|ableitung))\b/i;

    const R_RR     = /\b(rr|blutdruck)\b/i;
    const R_SPO2   = /\b(spo2|sauerstoffsatt|sattigung|pulsoxi)\b/i;
    const R_AF     = /\b(af|atemfrequenz)\b/i;
    const R_PULS   = /\b(puls|herzfrequenz|hf)\b/i;
    const R_BZ     = /\b(bz|blutzucker|glukose|glucose)\b/i;
    const R_TEMP   = /\b(temp|temperatur|fieber)\b/i;
    const R_GCS    = /\b(gcs|glasgow|avpu)\b/i;

    const R_MUND   = /(mundraum|mund|rachen|oropharynx|zunge|aspiration)/i;
    const R_PUPIL  = /(pupille|pupillen)/i;
    const R_AUSK   = /(auskultation|abhorchen|lungengerau?sch|giemen|rassel|stridor)/i;
    const R_HAUT   = /(haut|blasse|zyanose|schweiss|schweissig|kaltschweiss)/i;
    const R_SCHMERZ= /(schmerzskala|nrs|schmerzscore)/i;
    const R_BEFAST = /\bbefast\b/i;
    const R_NEURO  = /(neurolog|status)/i;

    // Trauma – Sichtbefunde & Maßnahmen
    const R_SEE_INJ = /(sehe ich|sichtbare|gibt es|wo).*verletz(ung|ungen|te)|verletzungen sichtbar|wunden sichtbar/i;
    const R_SEE_BLEED   = /(sehe ich|sichtbare|gibt es|wo).*blut(ung|et)/i;
    const R_BLEED_CONT  = /(blutet es noch|blutet.*weiter|blutung.*gestoppt|kontrolle blutung)/i;
    const R_SEE_FRACT   = /(fraktur(en)?|bruch|deformit(a|ä)t|fehlstellung)/i;
    const R_CHECK_PELV  = /(becken).*(stabil|pruf|prüf|stabilitat|stabilität|kompression)/i;

    const R_PRESSURE    = /(druckverband|direkter druck|kompression|verband mit druck|druck auf die wunde)/i;
    const R_TOURNIQUET  = /(tourniquet|tq|abbinde|abbindesystem|c.?a.?t|combat.*application)/i;
    const R_HEMOSTAT    = /(haemost|hämost|quikclot|celox|combat.*gauze|haemostypt)/i;
    const R_BECKENSL    = /(beckenschlinge|beckengurt|pelvic binder|beckenring)/i;

    const R_VACUUM      = /(vakuum.?matratze|vakuummatratze|vac.?mat)/i;
    const R_SPINEBOARD  = /(spineboard|schaufeltrage|sked)/i;
    const R_COLLAR      = /(halskrause|stiff.?neck|c.?collar|cervical.*stuetze|cervical.*stütze|hws.*immobil)/i;
    const R_SPLINT      = /(schiene|schienen|vakuumschiene|sam.?splint|kramer.?schiene)(.*(an|am)\s+([a-zäöüß\s]+))?/i;
    // **NEXUS – jetzt tolerant (mit/ohne "Kriterien"/"prüfen")**
    const R_NEXUS       = /\b(nexus|c.?spine|hws)\b.*(pruf|prüf|check|kriter|criteria)?/i;

    // **DMS – neu: mit Ort + vor/nach**
    const R_DMS_AT      = /(dms|durchblutung.*motorik.*sensibilit[aä]t|durchblutung|motorik|sensibilit[aä]t)\s*(vor|nach)?\s*(schienung|anlage)?\s*(?:an|am|im|der|des)?\s*([a-zäöüß\s\-]+)$/i;
    const R_DMS_SIMPLE  = /\b(dms|durchblutung.*motorik.*sensibilit[aä]t|durchblutung|motorik|sensibilit[aä]t)\b/i;

    // ----- Tools / vitals -----
    const num   = (x,d)=>isFinite(+x)?+x:d;
    const clamp = (v,lo,hi)=>Math.max(lo,Math.min(hi,v));
    const parseRR  = (RRStr) => { const [s,d]=(RRStr||"120/80").split("/").map(x=>num(x,0)); return { sys:s||120, dia:d||80 }; };
    const formatRR = (o)=>`${Math.round(o.sys)}/${Math.round(o.dia)}`;

    const getIV = () => {
      const baseRR = parseRR(base?.RR || "120/80");
      const iv = state.engine?.vitals || {};
      return {
        RR:   iv.RR || formatRR(baseRR),
        SpO2: num(iv.SpO2, num(base?.SpO2, 96)),
        AF:   num(iv.AF,   num(base?.AF,   16)),
        Puls: num(iv.Puls, num(base?.Puls, 80)),
        BZ:   num(iv.BZ,   num(base?.BZ,  110)),
        Temp: num(iv.Temp, num(base?.Temp, 36.8)),
        GCS:  num(iv.GCS,  num(base?.GCS,  15))
      };
    };
    const setIV = (patch) => { state.engine = { ...(state.engine || {}), vitals: { ...(state.engine?.vitals || {}), ...patch } }; };
    const exposeMeasured = (key) => {
      const iv = getIV(); const value = iv[key];
      const patch = { [key]: value };
      reply.updated_vitals = { ...(reply.updated_vitals || {}), ...patch };
      state.current_vitals = { ...(state.current_vitals || {}), ...patch };
    };

    // ----- Injury helpers -----
    const ofKind   = (k)=>injuries.filter(x=>x.kind===k);
    const findByText = (text, k) => {
      const want = (text||"").toLowerCase();
      const list = ofKind(k);
      if (list.length <= 1) return list[0] || null;
      const tokens = want.split(/[^a-zäöüß]+/i).filter(Boolean);
      const scored = list.map(it => {
        const loc = (it.location||"").toLowerCase();
        const s = tokens.reduce((acc,t)=> acc + (loc.includes(t)?1:0),0);
        return { it, s };
      }).sort((a,b)=>b.s-a.s);
      return (scored[0]?.s>0) ? scored[0].it : list[0] || null;
    };

    // ----- DMS helpers -----
    const normWhere = (txt) => {
      const t = (txt||"").toLowerCase().trim();
      if (!t) return "";
      if (/bein|beine|untere|fuss|fuß|fuesse|füße|sprunggelenk|osg|usg/.test(t)) return "Beine";
      if (/arm|arme|hand|unterarm|oberarm|handgelenk|finger/.test(t)) return "Arme";
      if (/links|li\b/.test(t)) return "links";
      if (/rechts|re\b/.test(t)) return "rechts";
      return t;
    };
    const dmsText = (d) => `Perfusion: ${d.perfusion}, Motorik: ${d.motor?"ja":"nein"}, Sensibilität: ${d.sensory?"ja":"nein"}`;

    // DMS Ausgabe – auch wenn keine Frakturmodelle vorhanden sind
    const checkDMS = (whereText) => {
      const fxList = ofKind("fracture");
      const pelvis = ofKind("pelvis");
      // 1) Mit Fraktur(en): echte, fallabhängige DMS
      if (fxList.length) {
        const target = whereText ? findByText(whereText, "fracture") : null;
        if (target) return `${target.location} – ${dmsText(target.dms)}`;
        return fxList.map(f => `${f.location} – ${dmsText(f.dms)}`).join(" • ");
      }
      // 2) Kein Frakturmodell: generische DMS, ggf. differenziert
      const w = normWhere(whereText||"");
      if (w==="links" || w==="rechts") return `Bein ${w}: Perfusion gut, Motorik ja, Sensibilität ja`;
      if (w==="beine") return "Beide Beine – Perfusion gut, Motorik ja, Sensibilität ja";
      if (w==="arme")  return "Beide Arme – Perfusion gut, Motorik ja, Sensibilität ja";
      if (pelvis.length) return "Beine – Perfusion gut, Motorik ja, Sensibilität ja (trotz Beckenschlinge regelmäßig kontrollieren).";
      return "Perfusion/Motorik/Sensibilität distal o.B.";
    };
    const logDMS = (when, whereText) => {
      const txt = checkDMS(whereText);
      state.engine.dms_log.push({ when, text: txt });
      return txt;
    };

    // ----- Progression -----
    const bleedingLoad = () => {
      let load = 0;
      for (const b of ofKind("bleeding")) if (!b.controlled) load += num(b.severity,1);
      for (const p of ofKind("pelvis"))   if (p.unstable && !p.binder_applied) load += num(p.bleeding_severity,0);
      return load;
    };
    const naturalProgression = () => {
      const w = bleedingLoad();
      const v = getIV();
      const rr = parseRR(v.RR);
      if (w>0) { rr.sys = clamp(rr.sys - 2*w, 70, 220); rr.dia = clamp(rr.dia - 1*w, 40, 130); setIV({ RR: formatRR(rr), Puls: clamp(v.Puls + 3*w, 40, 180) }); }
      if (v.SpO2 < 92) setIV({ Puls: clamp(v.Puls + 1, 40, 190), AF: clamp(v.AF + 1, 6, 40) });
    };

    // ----- Effekte & Interventionen -----
    const EFFECTS = {
      // Airway/Breathing/Circulation basics
      O2: () => { const v=getIV(); setIV({ SpO2: clamp(v.SpO2 + (v.SpO2<90?4:2), 90, 99), AF: clamp(v.AF-1,6,40) }); },
      ESMARCH: () => { const v=getIV(); setIV({ SpO2: clamp(v.SpO2+1,70,100), AF: clamp(v.AF-1,6,40) }); return "Esmarch-Handgriff durchgeführt."; },
      OPA: () => { const v=getIV(); setIV({ SpO2: clamp(v.SpO2+2,70,100), AF: clamp(v.AF-1,6,40) }); return "Guedel-Tubus eingelegt."; },
      NPA: () => { const v=getIV(); setIV({ SpO2: clamp(v.SpO2+2,70,100), AF: clamp(v.AF-1,6,40) }); return "Wendel-Tubus eingelegt."; },
      BVM: () => { const v=getIV(); setIV({ SpO2: clamp(v.SpO2+4,70,100), AF: clamp(v.AF-2,6,40) }); return "Beutel-Masken-Beatmung begonnen."; },
      LT: ()  => { const v=getIV(); setIV({ SpO2: clamp(v.SpO2+4,70,100), AF: clamp(v.AF-2,6,40) }); return "Larynxtubus gelegt."; },

      LAGERUNG_OKH: () => { const v=getIV(); setIV({ AF: clamp(v.AF-1,6,40), SpO2: clamp(v.SpO2+1,70,100) }); },
      LAGERUNG_SITZ: () => { const v=getIV(); setIV({ AF: clamp(v.AF-2,6,40), SpO2: clamp(v.SpO2+1,70,100) }); },
      LAGERUNG_SSL:  () => { const v=getIV(); setIV({ SpO2: clamp(v.SpO2+1,70,100) }); },
      ABSAUGEN: ()    => { const v=getIV(); setIV({ SpO2: clamp(v.SpO2+1,70,100), AF: clamp(v.AF-1,6,40) }); },
      WARME: ()       => { const v=getIV(); setIV({ Puls: clamp(v.Puls-1,40,180) }); },
      KUEHLEN: ()     => { const v=getIV(); setIV({ Puls: clamp(v.Puls-1,40,180) }); },

      // Blutstillung
      DRUCKVERBAND: (t) => {
        if (!t) return "Kein Ziel gefunden.";
        if (t.kind!=="bleeding") return "Druckverband wirkt nur bei Blutungen.";
        if (t.vessel === "arteriell" && t.severity >= 2) { t.severity=Math.max(1,t.severity-1); t.controlled=false; return `Druckverband an ${t.location}. Blutung reduziert, aber nicht sicher gestoppt (arteriell).`; }
        t.controlled=true; t.severity=Math.max(0,t.severity-1); return `Druckverband an ${t.location}. Blutung gestoppt.`;
      },
      HEMOSTAT: (t) => {
        if (!t) return "Kein Ziel gefunden.";
        if (t.kind!=="bleeding") return "Hämostyptika sind für stark blutende Wunden.";
        t.severity = Math.max(0, t.severity-2); t.controlled = (t.severity===0);
        return `Hämostyptikum in ${t.location} eingebracht. Blutung ${t.controlled?"gestoppt":"deutlich reduziert"}.`;
      },
      TOURNIQUET: (t) => {
        if (!t) return "Kein Ziel gefunden.";
        if (t.kind!=="bleeding") return "Tourniquet ist nur für Extremitätenblutungen.";
        t.controlled=true; t.severity=0;
        const fx=findByText(t.location,"fracture"); if (fx && fx.dms) fx.dms.perfusion="keine";
        const v=getIV(); setIV({ Puls: clamp(v.Puls+1,40,180) });
        return `Tourniquet an ${t.location}. Blutung gestoppt; DMS distal perfusionslos.`;
      },
      BECKENSLINGE: (p) => {
        if (!p) return "Beckenverletzung nicht sicher identifiziert.";
        p.binder_applied=true; const v=getIV(); const rr=parseRR(v.RR);
        rr.sys = clamp(rr.sys + 2, 70, 220); setIV({ RR: formatRR(rr), Puls: clamp(v.Puls-1,40,180) });
        return "Beckenschlinge angelegt. Blutung im Becken reduziert.";
      },

      // Immobilisation
      VACUUM: () => "Vakuummatratze: Ganzkörperimmobilisation erreicht.",
      SPINEBOARD: () => "Spineboard/Schaufeltrage verwendet.",
      COLLAR: (ind) => ind ? "Halskrause (C-Collar) angelegt – NEXUS positiv."
                           : "Halskrause angelegt – nach NEXUS nicht zwingend, aber tolerierbar.",
      SPLINT: (target) => {
        if (!target) return "Keine passende Fraktur gefunden.";
        target.immobilized = true;
        if (target.dms && target.dms.perfusion === "keine") target.dms.perfusion = "schwach";
        else if (target.dms && target.dms.perfusion === "schwach") target.dms.perfusion = "gut";
        return `Schiene an ${target.location} angelegt.`;
      },

      // Thorax – Entlastung
      NEEDLE: (pnx) => {
        if (!pnx) return "Kein Spannungspneumothorax erkennbar.";
        pnx.tension=false; pnx.severity=Math.max(0,(pnx.severity||1)-2);
        const v=getIV(); setIV({ SpO2: clamp(v.SpO2+5,70,100), AF: clamp(v.AF-3,6,40), Puls: clamp(v.Puls-3,40,180) });
        return `Entlastungspunktion auf der ${pnx.side||"betroffenen"} Seite durchgeführt. Atemgeräusch bessert sich.`;
      },

      // C-Maßnahmen
      IV:  ()=>"i.v.-Zugang gelegt.",
      IO:  ()=>"i.o.-Zugang gelegt.",
      VOL: ()=>{ const v=getIV(); const rr=parseRR(v.RR); rr.sys = clamp(rr.sys+3,70,220); setIV({ RR: formatRR(rr), Puls: clamp(v.Puls-1,40,180) }); return "Volumenbolus gegeben."; },

      // D-Maßnahme
      GLUCOSE: ()=>{ const v=getIV(); if (v.BZ<70) { setIV({ BZ:100, GCS: Math.max(v.GCS, 14) }); return "Glukosegabe: BZ steigt, Vigilanz bessert sich."; } return "Glukosegabe ohne klare Indikation (BZ nicht niedrig)."; }
    };

    // ----- Status-Helfer für XABCDE -----
    const airwayStatus = () => {
      const v = getIV();
      const m = (state.hidden?.mouth || "").toLowerCase();
      let hintTxt = "Atemwege frei";
      if (/blut|erbroch|sekret|schwell|oedem|ödem|fremdkorper|fremdkörper/.test(m)) hintTxt = `Atemwege: ${state.hidden.mouth}`;
      if (v.GCS <= 8) hintTxt += " • Vigilanz ↓ → Atemweg gefährdet";
      return `${hintTxt}.`;
    };
    const breathingStatus = () => {
      const v=getIV(); const lung = state.hidden?.lung || "vesikulär";
      let sym = "Thorax bewegt sich symmetrisch";
      const pnx = ofKind("pneumothorax")[0];
      if (pnx?.tension) sym = `Thorax asymmetrisch, AG ${pnx.side} abgeschwächt`;
      return `AF ${v.AF}/min, SpO₂ ${v.SpO2} %, ${sym}. Auskultation: ${lung}.`;
    };
    const circulationStatus = () => {
      const v=getIV(); const rr=parseRR(v.RR);
      const w = bleedingLoad();
      const pulsQual = (w>0 || rr.sys<100) ? "schwach/rasch" : "kräftig";
      let cft = "2 s"; if (w>=2) cft=">4 s"; else if (w===1) cft="3–4 s";
      return `RR ${v.RR} mmHg, Puls ${v.Puls}/min (${pulsQual}), Rekap-Zeit ~${cft}.`;
    };
    const disabilityStatus = () => {
      const v=getIV(); const pup = state.hidden?.pupils || "isokor, prompt";
      return `GCS ${v.GCS}, Pupillen ${pup}. BZ ${v.BZ} mg/dL.`;
    };
    const exposureStatus = () => {
      const parts=[];
      const bl=ofKind("bleeding"); if(bl.length) parts.push("Blutungen: "+bl.map(b=>`${b.location} – ${b.vessel}`).join(" • "));
      const fx=ofKind("fracture"); if(fx.length) parts.push("Frakturen: "+fx.map(f=>`${f.location} – ${f.open?"offen":"geschlossen"}`).join(" • "));
      if (ofKind("pelvis").length) parts.push("Beckenverletzung möglich");
      return parts.length?parts.join(" • "):"Keine offensichtlichen Verletzungen.";
    };

    // ===== Aktionen =====

    // Diagnose
    if (R_DIAG.test(ua)) { accept("Arbeitsdiagnose benannt."); setFinding(`Arbeitsdiagnose: ${state.solution?.diagnosis || "—"}`); }

    // XABCDE – Zusammenfassungen / Schrittweise
    else if (R_XABC.test(ua)) { accept("XABCDE-Übersicht."); setFinding(`X: priorisiere massive Blutung • A: ${airwayStatus()} • B: ${breathingStatus()} • C: ${circulationStatus()} • D: ${disabilityStatus()} • E: ${exposureStatus()}`); }
    else if (R_STEP_X.test(ua)) { accept("X – Exsanguination."); setFinding("Prüfe/stoppe lebensbedrohliche Blutungen: Druckverband, Hämostyptika, Tourniquet."); hint("Sag z. B. 'Druckverband am Unterarm rechts' oder 'Tourniquet am Oberschenkel links'."); }
    else if (R_STEP_A.test(ua)) { accept("A – Airway."); setFinding(airwayStatus()); hint("Maßnahmen: 'Esmarch', 'Absaugen', 'Guedel', 'Wendel', 'BVM' – (NotSan) 'Larynxtubus'."); }
    else if (R_STEP_B.test(ua)) { accept("B – Breathing."); setFinding(breathingStatus()); hint("Du kannst Thorax 'inspektieren', 'palpieren', 'perkutieren', 'auskultieren' oder bei Spannungspneu (NotSan) 'Entlastungspunktion' durchführen."); }
    else if (R_STEP_C.test(ua)) { accept("C – Circulation."); setFinding(circulationStatus()); hint("Messungen: RR/Puls/CFT. Maßnahmen: Blutstillung, EKG, (NotSan) i.v./i.o. + Volumen."); }
    else if (R_STEP_D.test(ua)) { accept("D – Disability."); setFinding(disabilityStatus()); hint("Prüfe GCS/AVPU, Pupillen, BZ. (NotSan) 'Glukose geben' bei Hypoglykämie."); }
    else if (R_STEP_E.test(ua)) { accept("E – Exposure."); setFinding(exposureStatus()); hint("Komplett entkleiden (sofern sicher), Bodycheck, Temp erheben, Wärmeerhalt."); }

    // Airway Maßnahmen
    else if (R_ESMARCH.test(ua)) { accept("Esmarch-Handgriff."); setFinding(EFFECTS.ESMARCH()); }
    else if (R_OPA.test(ua))     { accept("OPA (Guedel).");      setFinding(EFFECTS.OPA()); }
    else if (R_NPA.test(ua))     { accept("NPA (Wendel).");      setFinding(EFFECTS.NPA()); }
    else if (R_BVM.test(ua))     { accept("BVM-Beatmung.");      setFinding(EFFECTS.BVM()); }
    else if (R_LT.test(ua))      { if (role!=="NotSan") { deny("Larynxtubus: nur NotSan/SOP."); } else { accept("Larynxtubus gelegt."); setFinding(EFFECTS.LT()); } }

    // Thorax-Checks
    else if (R_THX_INS.test(ua)) { accept("Thorax inspiziert."); setFinding(breathingStatus()); }
    else if (R_THX_PALP.test(ua)) { accept("Thorax palpiert."); setFinding("Druckschmerz/Instabilität je nach Fall; Subkut. Emphysem?"); }
    else if (R_THX_PERK.test(ua)) { accept("Thorax perkutiert."); setFinding("Klopfschall seitengleich bzw. ggf. hypersonor auf betroffener Seite."); }
    else if (R_THX_AUSK.test(ua) || R_AUSK.test(ua)) { accept("Lunge auskultiert."); setFinding(state.hidden?.lung || "vesikulär seitengleich."); }

    // Entlastungspunktion (NotSan)
    else if (R_NEEDLE.test(ua)) {
      if (role!=="NotSan") { deny("Entlastungspunktion ist NotSan-/ärztliche Maßnahme."); }
      else { const pnx = ofKind("pneumothorax")[0]; accept("Entlastungspunktion durchgeführt."); setFinding(EFFECTS.NEEDLE(pnx)); }
    }

    // C – Zusatz
    else if (R_CFT.test(ua)) { accept("Kapilläre Wiederfüllzeit erhoben."); setFinding(circulationStatus()); }
    else if (R_IV.test(ua))  { if (role!=="NotSan") deny("i.v.-Zugang: nur NotSan/SOP."); else { accept("i.v.-Zugang."); setFinding(EFFECTS.IV()); } }
    else if (R_IO.test(ua))  { if (role!=="NotSan") deny("i.o.-Zugang: nur NotSan/SOP."); else { accept("i.o.-Zugang."); setFinding(EFFECTS.IO()); } }
    else if (R_VOLUME.test(ua)) { if (role!=="NotSan") deny("Volumentherapie: nur NotSan/SOP."); else { accept("Volumen gegeben."); setFinding(EFFECTS.VOL()); } }

    // D – Zusatz
    else if (R_GLUCOSE.test(ua)) { if (role!=="NotSan") deny("Glukosegabe: nur NotSan/SOP."); else { accept("Glukosegabe."); setFinding(EFFECTS.GLUCOSE()); } }

    // E – Zusatz
    else if (R_EXPOSE.test(ua)) { accept("Bodycheck durchgeführt."); setFinding(exposureStatus()); hint("Wärmeerhalt sicherstellen."); }

    // Monitoring / Messungen (→ nur Einzelwert zeigen)
    else if (R_EKG12.test(ua)) { accept("12-Kanal-EKG abgeleitet."); setFinding(state.hidden?.ekg12 || "12-Kanal: Sinus"); }
    else if (R_EKG3.test(ua))  { accept("Monitoring / Nicht-12-Kanal-EKG.");   setFinding(state.hidden?.ekg3  || "Monitoring läuft."); }
    else if (R_RR.test(ua))    { accept("RR gemessen.");   exposeMeasured("RR");   setFinding(`RR: ${getIV().RR} mmHg`); }
    else if (R_SPO2.test(ua))  { accept("SpO₂ gemessen."); exposeMeasured("SpO2"); setFinding(`SpO₂: ${getIV().SpO2} %`); }
    else if (R_AF.test(ua))    { accept("AF gezählt.");    exposeMeasured("AF");   setFinding(`AF: ${getIV().AF} /min`); }
    else if (R_PULS.test(ua))  { accept("Puls gezählt.");  exposeMeasured("Puls"); setFinding(`Puls: ${getIV().Puls} /min`); }
    else if (R_BZ.test(ua))    { accept("BZ gemessen.");   exposeMeasured("BZ");   setFinding(`BZ: ${getIV().BZ} mg/dL`); }
    else if (R_TEMP.test(ua))  { accept("Temperatur gemessen."); exposeMeasured("Temp"); setFinding(`Temp: ${getIV().Temp} °C`); }
    else if (R_GCS.test(ua))   { accept("Bewusstsein erhoben."); exposeMeasured("GCS"); setFinding(`GCS: ${getIV().GCS}`); }

    else if (R_MUND.test(ua))  { accept("Mundraum inspiziert."); setFinding(`Mundraum: ${state.hidden?.mouth || "unauffällig"}`); }
    else if (R_PUPIL.test(ua)) { accept("Pupillen geprüft."); setFinding(`Pupillen: ${state.hidden?.pupils || "isokor, prompt"}`); }
    else if (R_HAUT.test(ua))  { accept("Haut beurteilt."); setFinding("Haut: passend zum Fall (z. B. blass/schweißig)."); }
    else if (R_SCHMERZ.test(ua)) { accept("Schmerzskala erfragt."); setFinding("Schmerzskala dokumentiert."); }
    else if (R_BEFAST.test(ua) || R_NEURO.test(ua)) { accept("Neurologischer Status."); setFinding(state.hidden?.befast || state.hidden?.neuro || "BEFAST unauffällig."); }

    // ---------- TRAUMA: Sichtbefunde ----------
    else if (R_SEE_INJ.test(ua)) {
      accept("Sichtbare Verletzungen erfasst.");
      const parts = [];
      const bl = ofKind("bleeding"); if (bl.length) parts.push("Blutungen: " + bl.map(b=>`${b.location} – ${b.vessel}, ${b.controlled?"kontrolliert":"unkontrolliert"}`).join(" • "));
      const fx = ofKind("fracture"); if (fx.length) parts.push("Frakturen/Deformitäten: " + fx.map(f=>`${f.location} – ${f.open?"offen":"geschlossen"}${f.deformity?", deform":""}`).join(" • "));
      if (ofKind("pelvis").length) parts.push("Beckenverletzung möglich.");
      if (ofKind("pneumothorax").length) parts.push("Hinweis auf (Spannungs-)Pneumothorax.");
      setFinding(parts.length ? parts.join(" • ") : "Keine offensichtlichen Verletzungen.");
    }
    else if (R_SEE_BLEED.test(ua)) {
      accept("Blutungen beurteilt.");
      const list = ofKind("bleeding");
      setFinding(list.length ? list.map(b=>`${b.location} – ${b.vessel}, ${b.controlled?"kontrolliert":"unkontrolliert"}`).join(" • ")
                             : "Keine sichtbaren äußeren Blutungen.");
      hint("Maßnahmen: 'Druckverband an ___', 'Hämostyptika in ___', 'Tourniquet an ___'.");
    }
    else if (R_BLEED_CONT.test(ua)) {
      accept("Blutungskontrolle überprüft.");
      const list = ofKind("bleeding");
      setFinding(list.length ? list.map(b=>`${b.location}: ${b.controlled?"gestoppt":"blutet weiter"}`).join(" • ")
                             : "Keine äußeren Blutungen vorhanden.");
    }
    else if (R_SEE_FRACT.test(ua)) {
      accept("Frakturen/Deformitäten beurteilt.");
      const list = ofKind("fracture");
      setFinding(list.length ? list.map(f=>`${f.location} – ${f.open?"offen":"geschlossen"}${f.deformity?", deform":""}${f.immobilized?" (immobilisiert)":" (nicht immobilisiert)"}`).join(" • ")
                             : "Keine auffälligen Deformitäten.");
      hint("Du kannst 'Schiene an ___' oder 'Vakuummatratze/Spineboard' sagen und danach 'DMS prüfen'.");
    }
    else if (R_CHECK_PELV.test(ua)) {
      accept("Becken geprüft.");
      const p = ofKind("pelvis")[0];
      setFinding(p ? `Becken: ${p.unstable?"instabil":"stabil"}${p.binder_applied?" (Beckenschlinge liegt)":" (keine Beckenschlinge)"}`
                   : "Becken klinisch unauffällig/stabil.");
    }

    // ---------- TRAUMA: Maßnahmen ----------
    else if (R_PRESSURE.test(ua))   { const t=findByText(ua,"bleeding"); accept("Druckverband durchgeführt."); setFinding(EFFECTS.DRUCKVERBAND(t)); }
    else if (R_HEMOSTAT.test(ua))   { const t=findByText(ua,"bleeding"); accept("Hämostyptikum angewendet."); setFinding(EFFECTS.HEMOSTAT(t)); }
    else if (R_TOURNIQUET.test(ua)) { const t=findByText(ua,"bleeding"); accept("Tourniquet angelegt.");    setFinding(EFFECTS.TOURNIQUET(t)); hint("DMS distal erneut prüfen."); }
    else if (R_BECKENSL.test(ua))   { const p=ofKind("pelvis")[0];       accept("Beckenschlinge angelegt."); setFinding(EFFECTS.BECKENSLINGE(p)); }

    else if (R_VACUUM.test(ua))     { accept("Vakuummatratze verwendet."); setFinding(EFFECTS.VACUUM()); for (const f of ofKind("fracture")) f.immobilized=true; hint("DMS nach Immobilisation prüfen."); }
    else if (R_SPINEBOARD.test(ua)) { accept("Spineboard/Schaufeltrage verwendet."); setFinding(EFFECTS.SPINEBOARD()); hint("DMS nach Fixierung prüfen."); }
    else if (R_SPLINT.test(ua))     { const t=findByText(ua,"fracture"); accept("Schienung durchgeführt."); setFinding(EFFECTS.SPLINT(t)); hint("DMS nach Schienung prüfen."); }

    // HWS / NEXUS (tolerant)
    else if (R_NEXUS.test(ua)) {
      accept("NEXUS-Kriterien geprüft.");
      const nx = state.hidden?.spine?.nexus || { midlineTenderness:false, neuroDeficit:false, altered:false, intox:false, distracting:false };
      const pos = Object.entries(nx).filter(([k,v])=>!!v).map(([k])=>k);
      setFinding(pos.length ? `NEXUS positiv: ${pos.join(", ")}` : "NEXUS negativ: keine HWS-Immobilisation zwingend.");
      hint("Bei positivem NEXUS: 'Halskrause anlegen'.");
    }
    else if (R_COLLAR.test(ua)) {
      const nx = state.hidden?.spine?.nexus || { midlineTenderness:false, neuroDeficit:false, altered:false, intox:false, distracting:false };
      const indicated = !!(nx.midlineTenderness || nx.neuroDeficit || nx.altered || nx.intox || nx.distracting);
      state.engine.immobilization.collar = true;
      accept("HWS immobilisiert."); setFinding(EFFECTS.COLLAR(indicated));
    }

    // ----- **DMS prüfen** (neu)
    else if (R_DMS_AT.test(ua) || R_DMS_SIMPLE.test(ua)) {
      const m = R_DMS_AT.exec(ua);
      const when = /nach/.test(ua) ? "nach" : (/vor/.test(ua) ? "vor" : "jetzt");
      const where = m ? m[4] : ""; // Ortsteil aus Regex
      accept("DMS geprüft.");
      setFinding(logDMS(when, where));
    }

    // ----- Sonstige Maßnahmen / Shortcuts -----
    else if (R_O2.test(ua) && !R_MESSEN.test(ua)) { accept("Sauerstoffgabe durchgeführt."); setFinding("O₂ gegeben (titriert nach Indikation)."); EFFECTS.O2(); hint("Reevaluation: SpO₂/AF/Puls erneut prüfen."); }
    else if (/(oberkorper(hoch)?|herzbett|kopf hoch|okh|hochlagern)/i.test(ua)) { accept("Oberkörper hoch gelagert."); EFFECTS.LAGERUNG_OKH(); setFinding("Lagerung: Oberkörper hoch."); }
    else if (/(sitzen|sitzend|kutschersitz|komfortlagerung|atemerleichternd)/i.test(ua)) { accept("Sitzlagerung durchgeführt."); EFFECTS.LAGERUNG_SITZ(); setFinding("Lagerung: sitzend/atemerleichternd."); }
    else if (/(stabile seitenlage|ssl)/i.test(ua)) { accept("Stabile Seitenlage durchgeführt."); EFFECTS.LAGERUNG_SSL(); setFinding("Lagerung: stabile Seitenlage."); }
    else if (/(absaugen|sekret absaugen|absaugung)/i.test(ua)) { accept("Absaugung durchgeführt."); EFFECTS.ABSAUGEN(); setFinding("Sekret abgesaugt, Atemweg freier."); }
    else if (/(warme|warmeerhalt|zudecken|decken|isomantel)/i.test(ua)) { accept("Wärmeerhalt sichergestellt."); EFFECTS.WARME(); setFinding("Wärmeerhalt umgesetzt."); }
    else if (/(kuhlen|kuhlung|eiskompresse|kaltkompresse)/i.test(ua)) { accept("Kühlung durchgeführt."); EFFECTS.KUEHLEN(); setFinding("Kühlung lokal durchgeführt."); }

    else if (/(na nachfordern|notarzt nachfordern|arzt nachfordern)/i.test(ua)) { accept("Notarzt nachgefordert."); setFinding("NA nachgefordert – Eintreffen abwarten, Lagebericht fortlaufend."); }
    else if (/(transport einleiten|fahrt aufnehmen|abfahrt|losfahren)/i.test(ua)) { accept("Transport eingeleitet.");  setFinding("Transport eingeleitet – Monitoring fortführen, Zielklinik gemäß Verdacht."); }
    else if (/(ubergabe|uebergabe|report|handover)/i.test(ua)) { accept("Übergabe durchgeführt.");  setFinding("Übergabe nach MIST/SBAR erfolgt."); reply.done = true; }

    // Unklare Eingabe
    else {
      hint("Beispiele: 'XABCDE', 'A', 'B', 'C', 'D', 'E', 'Verletzungen sichtbar?', 'DMS prüfen', 'DMS Beine', 'Schiene an Unterschenkel links', 'Druckverband am Unterarm rechts', 'Hämostyptika in Oberschenkel links', 'Tourniquet am Oberschenkel links', 'Becken prüfen', 'Beckenschlinge anlegen', 'NEXUS prüfen', 'Halskrause anlegen', 'Entlastungspunktion', 'i.v. Zugang', 'Volumen', 'Glukose geben', 'SpO2 messen', 'RR messen' …");
    }

    // ----- Verlauf anwenden -----
    naturalProgression();

    reply.case_state = state;
    return { statusCode: 200, headers, body: JSON.stringify(reply) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
