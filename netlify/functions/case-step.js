/**
 * Netlify Function: case-step
 * Processes a user action against a case_state.
 */
exports.handler = async (event) => {
  const headers = {
    "content-type": "application/json",
    "access-control-allow-origin": "*"
  };
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const state = body.case_state || {};
    const role = body.role || state.role || "RS";
    const ua = String(body.user_action || "").trim();

    // canonical reply object
    const reply = {
      accepted: false,
      outside_scope: false,
      unsafe: false,
      finding: undefined,
      evaluation: undefined,
      next_hint: undefined,
      updated_vitals: {}
    };

    if (!ua) {
      reply.evaluation = "Keine Eingabe erkannt.";
      return { statusCode: 200, headers, body: JSON.stringify(reply) };
    }

    // helpers
    const low = ua.toLowerCase();
    function textOrNA(x){ return (x && String(x).trim()) ? String(x) : "Keine Auffälligkeiten angegeben."; }
    function formatList(arr){ return Array.isArray(arr)&&arr.length ? arr.join(", ") : "keine Angaben"; }
    function answerAnamnesis(st){
      const a = st.anamnesis || {};
      const s = a.SAMPLER || {};
      const o = a.OPQRST  || {};
      return (
        `SAMPLER → S:${s.S||"-"} | A:${s.A||"-"} | M:${s.M||"-"} | P:${s.P||"-"} | L:${s.L||"-"} | E:${s.E||"-"} | R:${s.R||"-"}\n`+
        `Vorerkrankungen: ${formatList(a.vorerkrankungen)}\n`+
        `Medikation: ${formatList(a.medikation)}\n`+
        `Allergien: ${formatList(a.allergien)}\n`+
        `Antikoagulation: ${a.antikoagulation ? "ja" : "nein"}\n`+
        (o.O || o.P || o.Q || o.R || o.S || o.T ? 
          `OPQRST → O:${o.O||"-"} | P:${o.P||"-"} | Q:${o.Q||"-"} | R:${o.R||"-"} | S:${o.S||"-"} | T:${o.T||"-"}` 
          : "")
      ).trim();
    }
    function answerExam(st, key){
      const H = st.hidden || {};
      const map = { mund:"mouth", mundraum:"mouth", pupillen:"pupils", lunge:"lung", thorax:"lung",
                    abdomen:"abdomen", bauch:"abdomen", haut:"skin", ekg:"ekg12", "ekg 12":"ekg12", "ekg3":"ekg3" };
      const k = map[key] || key;
      return textOrNA(H[k]);
    }
    function ofKind(kind){
      const H = state.hidden || {};
      return (H.injuries||[]).filter(x => x.kind === kind);
    }
    function updateVitals(patch){
      state.vitals = state.vitals || {};
      for (const k in patch){
        state.vitals[k] = patch[k];
        reply.updated_vitals[k] = patch[k];
      }
    }
    function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

    // === NON-MODIFYING INFO QUERIES ===
    if (/(^| )anamnese|sampler|opqrst|vorerkrank|medikati|allergi|sozial|antikoag/.test(low)) {
      reply.accepted = true;
      reply.evaluation = answerAnamnesis(state);
      reply.next_hint = "Arbeite X→A→B→C→D→E weiter ab oder erhebe gezielt Vitalwerte.";
      return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
    }
    // Körperliche Untersuchung
    const examKeys = ["mund","mundraum","pupillen","lunge","thorax","abdomen","bauch","haut","ekg","ekg 12","ekg3"];
    for (const k of examKeys){
      if (low.includes(k)){
        reply.accepted = true;
        reply.finding = answerExam(state, k);
        reply.evaluation = "Befund aufgenommen.";
        reply.next_hint = "Erhebe oder überprüfe passende Vitalwerte (z. B. SpO₂, AF, RR).";
        return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
      }
    }
    // BEFAST / LKW
    if (/(befast|lkw\b|letzte.*wohl|last.*well|last known well)/.test(low)) {
      const H = state.hidden || {};
      reply.accepted = true;
      reply.evaluation = `BEFAST: ${textOrNA(H.befast)} | LKW: ${textOrNA(H.lkw)}`;
      return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
    }

    // === VITAL MEASUREMENTS (zeigen EINEN Wert – wie gewünscht) ===
    if (/^rr|blutdruck|rr messen/.test(low)){
      reply.accepted = true;
      reply.evaluation = "RR gemessen.";
      reply.finding = `RR: ${state.vitals?.RR || state.hidden?.vitals_baseline?.RR || "—"}`;
      return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
    }
    if (/sp[o0]2|sauerstoffs[aä]ttigung/.test(low)){
      reply.accepted = true;
      const v = (state.vitals && state.vitals.SpO2 != null) ? state.vitals.SpO2 : (state.hidden?.vitals_baseline?.SpO2 || "—");
      reply.evaluation = "SpO₂ gemessen.";
      reply.finding = `SpO₂: ${v} %`;
      return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
    }
    if (/atemfrequenz|af\b|atmung.*frequenz/.test(low)){
      reply.accepted = true;
      const v = (state.vitals && state.vitals.AF != null) ? state.vitals.AF : (state.hidden?.vitals_baseline?.AF || "—");
      reply.evaluation = "AF gezählt.";
      reply.finding = `AF: ${v} /min`;
      return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
    }
    if (/puls|herzfrequenz|hf\b/.test(low)){
      reply.accepted = true;
      const v = (state.vitals && state.vitals.Puls != null) ? state.vitals.Puls : (state.hidden?.vitals_baseline?.Puls || "—");
      reply.evaluation = "Puls erhoben.";
      reply.finding = `Puls: ${v} /min`;
      return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
    }
    if (/b(l|)utzucker|bz\b/.test(low)){
      reply.accepted = true;
      const v = (state.vitals && state.vitals.BZ != null) ? state.vitals.BZ : (state.hidden?.vitals_baseline?.BZ || "—");
      reply.evaluation = "BZ gemessen.";
      reply.finding = `BZ: ${v} mg/dl`;
      return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
    }
    if (/temperatur|temp\b|fieber/.test(low)){
      reply.accepted = true;
      const v = (state.vitals && state.vitals.Temp != null) ? state.vitals.Temp : (state.hidden?.vitals_baseline?.Temp || "—");
      reply.evaluation = "Temperatur gemessen.";
      reply.finding = `Temp: ${v} °C`;
      return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
    }
    if (/gcs|glasgow/.test(low)){
      reply.accepted = true;
      const v = (state.vitals && state.vitals.GCS != null) ? state.vitals.GCS : (state.hidden?.vitals_baseline?.GCS || "—");
      reply.evaluation = "GCS erhoben.";
      reply.finding = `GCS: ${v}`;
      return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
    }

    // === TRAUMA INFO ===
    if (/fraktur(en)? sichtbar|brueche|brüche sichtbar/.test(low)) {
      const fx = ofKind("fracture");
      reply.accepted = true;
      reply.finding = fx.length ? fx.map(f=>`${f.location} (${f.open?"offen":"geschlossen"})`).join(" • ") : "Keine sichtbaren Frakturen.";
      return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
    }
    if (/blutung(en)? sichtbar/.test(low)) {
      const b = ofKind("bleeding");
      reply.accepted = true;
      reply.finding = b.length ? b.map(x=>`${x.location} (${x.vessel||"unbekannt"}), Stärke ${x.severity}${x.controlled?" – gestillt":""}`).join(" • ") : "Keine sichtbaren Blutungen.";
      return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
    }
    if (/becken.*pruef|becken.*prüf|becken.*stabil/.test(low)) {
      const p = ofKind("pelvis")[0];
      reply.accepted = true;
      reply.finding = p ? `Becken ${p.unstable? "instabil" : "stabil"}; Beckenschlinge ${p.binder_applied? "liegt" : "noch nicht angelegt"}.`
                        : "Kein Hinweis auf relevante Beckenverletzung.";
      return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
    }
    if (/nexus.*pruef|nexus.*prüf|c-spine|halswirbelsaeule|halswirbelsäule/.test(low)) {
      const nx = (state.hidden && state.hidden.nexus) || { positive: false, criteria: ["keine Mittellinien-Schmerzen","keine fokal-neuro Defizite","wach, nüchtern, nicht intox"] };
      reply.accepted = true;
      reply.finding = `NEXUS: ${nx.positive? "positiv (Halskrause indiziert)" : "negativ"}. Kriterien: ${nx.criteria?.join(", ")||"–"}`;
      reply.next_hint = nx.positive ? "Lege einen C-Collar an und immobilisiere achsengerecht." : "Bei negativer NEXUS kann auf Halskrause verzichtet werden.";
      return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
    }
    if (/dms/.test(low)) {
      reply.accepted = true;
      reply.finding = "DMS unauffällig (vor Maßnahme).";
      return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
    }

    // === INTERVENTIONS (with effects) ===
    if (/o2|sauerstoff(gabe)?|oxygen/.test(low)){
      reply.accepted = true;
      reply.evaluation = "Sauerstoffgabe eingeleitet.";
      const base = Number(state.vitals?.SpO2 || state.hidden?.vitals_baseline?.SpO2 || 94);
      const newSpO2 = clamp(base + 4, 88, 100);
      const newAF = clamp((state.vitals?.AF ?? state.hidden?.vitals_baseline?.AF ?? 20) - 2, 8, 40);
      updateVitals({ SpO2: newSpO2, AF: newAF });
      reply.next_hint = "Erwäge inhalatives β₂-Mimetikum bei obstruktiver Komponente.";
      return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
    }
    if (/salbutamol|saba|inhalation|vernebler/.test(low)){
      reply.accepted = true;
      reply.evaluation = "Inhalation (β₂-Mimetikum) verabreicht.";
      const newAF = clamp((state.vitals?.AF ?? 24) - 3, 8, 40);
      updateVitals({ AF: newAF });
      reply.next_hint = "Re-Assessment in 5 Min., SpO₂ & AF prüfen.";
      return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
    }
    if (/glukose|traubenzucker|glucose|dextrose/.test(low)){
      reply.accepted = true;
      reply.evaluation = "Glukosegabe durchgeführt.";
      const newBZ = clamp((state.vitals?.BZ ?? 40) + 40, 60, 180);
      const newGCS = clamp((state.vitals?.GCS ?? 13) + 2, 3, 15);
      updateVitals({ BZ: newBZ, GCS: newGCS });
      reply.next_hint = "Re-Assessment: Vigilanz, BZ nach 10–15 Min. erneut prüfen.";
      return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
    }
    if (/druckverband|blutung stillen|blood stop/.test(low)){
      reply.accepted = true;
      reply.evaluation = "Druckverband angelegt.";
      const H = state.hidden || {}; H.injuries = H.injuries || [];
      H.injuries = H.injuries.map(x => (x.kind==="bleeding" ? { ...x, controlled:true, severity: Math.max(0,(x.severity||1)-1)} : x));
      state.hidden = H;
      return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
    }
    if (/tourniquet|tk/.test(low)){
      reply.accepted = true;
      reply.evaluation = "Tourniquet angelegt.";
      const H = state.hidden || {}; H.injuries = H.injuries || [];
      H.injuries = H.injuries.map(x => (x.kind==="bleeding" ? { ...x, controlled:true, severity:0 } : x));
      state.hidden = H;
      return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
    }
    if (/halskrause|c-collar|stif{1,2}neck/.test(low)){
      reply.accepted = true;
      reply.evaluation = "Halskrause angelegt.";
      const H = state.hidden || {}; H.nexus = H.nexus || { positive:false, criteria:[] };
      H.nexus.applied = true; state.hidden = H;
      return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
    }
    if (/beckenschlinge|pelvic binder/.test(low)){
      reply.accepted = true;
      reply.evaluation = "Beckenschlinge angelegt.";
      const H = state.hidden || {}; H.injuries = H.injuries || [];
      H.injuries = H.injuries.map(x => (x.kind==="pelvis" ? { ...x, binder_applied:true } : x));
      state.hidden = H;
      return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
    }

    // Diagnose-Frage
    if (/diagnose|was ist los|verdacht/.test(low)){
      reply.accepted = true;
      const spec = (state.specialty||"").toLowerCase();
      let dx = "Die Daten deuten auf ein unspezifisches Geschehen hin – führe strukturierte Diagnostik fort.";
      if (spec==="internistisch") dx = "Wahrscheinlich: akute Bronchialobstruktion (Asthma-Exazerbation).";
      if (spec==="neurologisch") dx = "Wahrscheinlich: Hypoglykämie-bedingte Vigilanzminderung.";
      if (spec==="trauma") dx = "Wahrscheinlich: geschlossene Fraktur/Weichteilverletzung Unterarm rechts; keine Anzeichen für Polytrauma.";
      if (spec==="pädiatrisch") dx = "Wahrscheinlich: virale Atemwegsinfektion mit Fieber.";
      reply.evaluation = dx;
      reply.next_hint = "Bestätige durch gezielte Untersuchung und Monitoring; entscheide Transport/Nachforderung NA.";
      return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
    }

    // Default fallback
    reply.outside_scope = true;
    reply.evaluation = "Aktion nicht erkannt. Formuliere frei (z. B. „Ich gebe 2 l O₂ über Brille“ oder „RR messen“).";
    reply.next_hint = "Nutze X→A→B→C→D→E oder frage nach Anamnese, Pupillen, Lunge, EKG, BEFAST, DMS.";
    return { statusCode:200, headers, body: JSON.stringify({ ...reply, case_state: state }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
