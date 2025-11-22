/**
 * Netlify Function: case-step
 * Processes a user action against a case_state.
 * Version: Schemas + Debrief + einfache Vital-Logik
 */
exports.handler = async (event) => {
  const headers = {
    "content-type": "application/json",
    "access-control-allow-origin": "*"
  };

  try {
    const body  = event.body ? JSON.parse(event.body) : {};
    const state = body.case_state || {};
    const ua    = String(body.user_action || "").trim();
    const low   = ua.toLowerCase();

    // --- Grundstruktur sicherstellen ---
    state.id         = state.id || "unknown_case";
    state.specialty  = state.specialty || body.specialty || "internistisch";
    state.role       = state.role || body.role || "RS";
    state.difficulty = state.difficulty || body.difficulty || "mittel";
    state.vitals     = state.vitals || {};
    state.hidden     = state.hidden || {};
    state.steps_done = Array.isArray(state.steps_done) ? state.steps_done : [];
    state.score      = typeof state.score === "number" ? state.score : 0;
    state.history    = Array.isArray(state.history) ? state.history : [];

    // Messungen für Debriefing
    state.measurements = state.measurements || {
      vitals: {},     // z.B. { RR:true, SpO2:true, ... }
      schemas: {},    // z.B. { "4S":true, "SAMPLER":true, "BEFAST":true }
      pain: { documented:false, nrs:null },
      diagnosis: null,
      transport: null
    };
    state.measurements.vitals  = state.measurements.vitals  || {};
    state.measurements.schemas = state.measurements.schemas || {};
    state.measurements.pain    = state.measurements.pain    || { documented:false, nrs:null };

    const meas = state.measurements;
    const H    = state.hidden;

    if (ua) {
      state.history.push({ ts:new Date().toISOString(), action:ua });
      if (state.history.length > 300) state.history.shift();
    }

    const reply = {
      accepted: false,
      outside_scope: false,
      unsafe: false,
      finding: undefined,
      evaluation: undefined,
      next_hint: undefined,
      updated_vitals: {},
      debrief: undefined,
      case_state: state
    };

    // --- Helper ---
    function text(v) {
      if (v === undefined || v === null) return "—";
      const s = String(v).trim();
      return s === "" ? "—" : s;
    }
    function list(arr) {
      if (!Array.isArray(arr) || !arr.length) return "—";
      return arr.join(", ");
    }
    function clamp(v,min,max) {
      return Math.max(min, Math.min(max, v));
    }
    function updVitals(obj) {
      state.vitals = state.vitals || {};
      for (const k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
        state.vitals[k] = obj[k];
        reply.updated_vitals[k] = obj[k];
      }
    }
    function markVital(name) {
      meas.vitals[name] = true;
    }
    function markSchema(name) {
      meas.schemas[name] = true;
    }
    const STEP_LABEL = {
      X: "X – Exsanguination",
      A: "A – Airway",
      B: "B – Breathing",
      C: "C – Circulation",
      D: "D – Disability",
      E: "E – Exposure"
    };
    function touchStep(letter) {
      const label = STEP_LABEL[letter];
      if (!label) return;
      if (!Array.isArray(state.steps_done)) state.steps_done = [];
      if (!state.steps_done.some(x => String(x).toUpperCase().startsWith(letter))) {
        state.steps_done.push(label);
        state.score += 1;
      }
    }
    function credit(pts) {
      if (typeof pts !== "number" || !isFinite(pts)) return;
      state.score += pts;
    }

    // --- Kein Input ---
    if (!ua) {
      reply.evaluation = "";
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // =========================================================
    // 1) Debriefing
    // =========================================================
    if (/debrief/.test(low)) {
      const steps  = Array.isArray(state.steps_done) ? state.steps_done : [];
      const order  = ["X","A","B","C","D","E"];
      const open   = order.filter(l => !steps.some(x => String(x).toUpperCase().startsWith(l)));

      const vitalsAll     = ["RR","SpO2","AF","Puls","BZ","Temp","GCS"];
      const vitalsDone    = vitalsAll.filter(k => meas.vitals[k]);
      const vitalsMissing = vitalsAll.filter(k => !meas.vitals[k]);

      const pain = meas.pain || {};
      let painLine = "Schmerzskala nicht erhoben.";
      if (pain.documented) {
        painLine = "Schmerzskala dokumentiert (NRS " + (pain.nrs != null ? pain.nrs : "—") + ").";
      }

      const schemaLines = [];
      schemaLines.push(meas.schemas["4S"]      ? "4S-Schema angewandt"      : "4S-Schema nicht dokumentiert");
      schemaLines.push(meas.schemas["SAMPLER"] ? "SAMPLER-Anamnese erhoben" : "SAMPLER noch nicht genutzt");
      schemaLines.push(meas.schemas["BEFAST"]  ? "BE-FAST geprüft"          : "BE-FAST nicht dokumentiert");

      let dxLine = "Verdachtsdiagnose noch nicht dokumentiert.";
      if (meas.diagnosis) dxLine = "Verdachtsdiagnose: " + meas.diagnosis;
      let trLine = "Transportpriorität noch nicht festgelegt.";
      if (meas.transport) trLine = "Transportentscheidung: " + meas.transport;

      const lines = [];
      lines.push("XABCDE-Fortschritt: " + (steps.length ? steps.join(" → ") : "keine Schritte dokumentiert."));
      lines.push(open.length ? ("Offene Bereiche: " + open.join(", ") + ".") : "Alle XABCDE-Bereiche wurden mindestens einmal angesprochen.");
      lines.push("Vitals erhoben: " + (vitalsDone.length ? vitalsDone.join(", ") : "keine vollständigen Vitalparameter."));
      if (vitalsMissing.length) lines.push("Fehlende Vitals: " + vitalsMissing.join(", ") + ".");
      lines.push("Schemata: " + schemaLines.join(" | "));
      lines.push(painLine);
      lines.push(dxLine);
      lines.push(trLine);
      lines.push("Tipp: Verknüpfe Maßnahmen mit Verlauf (O₂ → SpO₂/AF, Analgesie → NRS, Volumen → RR, Lagerung → Atmung) und dokumentiere Re-Assessments.");

      const txt = lines.join("\n");
      reply.accepted   = true;
      reply.debrief    = txt;
      reply.evaluation = txt;
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // =========================================================
    // 2) 4S-Schema
    // =========================================================
    if (/4s info/.test(low)) {
      markSchema("4S");
      const s = state.scene_4s || {};
      reply.accepted = true;
      reply.evaluation =
        "4S\n" +
        "Sicherheit: "         + text(s.sicherheit)        + "\n" +
        "Szene: "              + text(s.szene)             + "\n" +
        "Sichtung/Personen: "  + text(s.sichtung_personen) + "\n" +
        "Support-Empfehlung: " + text(s.support_empfehlung);
      reply.next_hint = "Prüfe, ob du zusätzlichen Support (NA, Feuerwehr, Polizei, RTH) nachfordern möchtest.";
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/\b4s\b/.test(low)) {
      markSchema("4S");
      reply.accepted   = true;
      reply.evaluation = "4S-Schema dokumentiert.";
      reply.next_hint  = "Führe nun XABCDE durch und erhebe Vitalparameter.";
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // =========================================================
    // 3) Support-Nachforderung (X / 4S)
    // =========================================================
    const supportMap = [
      { re: /(na|notarzt).*nachfordern|^na nachfordern$/, type:"NA" },
      { re: /feuerwehr.*nachfordern|fw.*nachfordern/,     type:"Feuerwehr" },
      { re: /polizei.*nachfordern/,                       type:"Polizei" },
      { re: /(rth|hubschrauber|helikopter).*nachfordern/, type:"RTH" }
    ];
    for (const s of supportMap) {
      if (s.re.test(low)) {
        state.support = state.support || { calls: [] };
        state.support.calls.push({ type:s.type, time:new Date().toISOString() });
        reply.accepted   = true;
        reply.evaluation = s.type + " nachgefordert.";
        reply.next_hint  = "Arbeite das XABCDE-Schema weiter ab und dokumentiere deine Befunde.";
        credit(1);
        return { statusCode:200, headers, body: JSON.stringify(reply) };
      }
    }

    // =========================================================
    // 4) SAMPLER / Anamnese
    // =========================================================
    if (/sampler info|anamnese\b/.test(low)) {
      markSchema("SAMPLER");
      const a = state.anamnesis || {};
      const S = a.SAMPLER || {};
      const O = a.OPQRST || {};
      reply.accepted = true;
      reply.evaluation =
        "SAMPLER → " +
        "S:" + text(S.S) + " | " +
        "A:" + text(S.A) + " | " +
        "M:" + text(S.M) + " | " +
        "P:" + text(S.P) + " | " +
        "L:" + text(S.L) + " | " +
        "E:" + text(S.E) + " | " +
        "R:" + text(S.R) + "\n" +
        "Vorerkrankungen: " + list(a.vorerkrankungen) + "\n" +
        "Medikation: " + list(a.medikation) + "\n" +
        "Allergien: " + list(a.allergien) + "\n" +
        "Antikoagulation: " + (a.antikoagulation ? "ja" : "nein") + "\n" +
        (O.O || O.P || O.Q || O.R || O.S || O.T
          ? ("OPQRST → O:" + text(O.O) + " | P:" + text(O.P) + " | Q:" + text(O.Q) +
             " | R:" + text(O.R) + " | S:" + text(O.S) + " | T:" + text(O.T))
          : "");
      reply.next_hint = "Nutze die Informationen, um deine Verdachtsdiagnose zu schärfen und passende Untersuchungen zu planen.";
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/sampler/.test(low)) {
      markSchema("SAMPLER");
      reply.accepted   = true;
      reply.evaluation = "SAMPLER-Anamnese dokumentiert.";
      reply.next_hint  = "Führe nun körperliche Untersuchung und Vitalzeichen-Erhebung durch.";
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // =========================================================
    // 5) BE-FAST / Neurologie
    // =========================================================
    if (/befast info/.test(low)) {
      markSchema("BEFAST");
      reply.accepted   = true;
      reply.evaluation = "BE-FAST: " + text(H.befast) + " | LKW: " + text(H.lkw);
      reply.next_hint  = "Bei Schlaganfall-Verdacht zügigen Transport mit hoher Priorität in Stroke-Unit planen.";
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/befast/.test(low)) {
      markSchema("BEFAST");
      reply.accepted   = true;
      reply.evaluation = "BE-FAST-Dokumentation übernommen.";
      reply.next_hint  = "Sichere Vitalparameter und plane Transport/Stroke-Unit.";
      touchStep("D");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // =========================================================
    // 6) Schmerz / NRS
    // =========================================================
    if (/schmerz info/.test(low)) {
      const p = H.pain || {};
      reply.accepted   = true;
      reply.evaluation = "Schmerz laut Fall: NRS " + text(p.nrs) +
        " | Ort: " + text(p.ort) +
        " | Charakter: " + text(p.charakter);
      reply.next_hint  = "Erhebe eine eigene NRS (0–10) und denke an Analgesie nach SOP.";
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    const nrsMatch = low.match(/\bnrs\s*([0-9]{1,2})\b/);
    if (nrsMatch) {
      const n = Number(nrsMatch[1]);
      meas.pain.documented = true;
      meas.pain.nrs = n;
      reply.accepted   = true;
      reply.evaluation = "Schmerzskala dokumentiert: NRS " + n + ".";
      reply.next_hint  = "Dokumentiere den Verlauf der Schmerzen (z. B. nach Analgesie).";
      credit(1);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/(schmerz|nrs|schmerzskala)/.test(low)) {
      const p = H.pain || {};
      reply.accepted   = true;
      reply.evaluation = "Schmerz laut Fall: NRS " + text(p.nrs) +
        " | Ort: " + text(p.ort) +
        " | Charakter: " + text(p.charakter);
      reply.next_hint  = "Trage eine NRS (0–10) ein, z. B. 'NRS 6'.";
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // =========================================================
    // 7) Körperliche Untersuchung (inkl. Bodycheck)
    // =========================================================
    if (/bodycheck|ganzk[oö]rper/.test(low)) {
      const parts = [];
      if (H.skin)    parts.push("Haut: " + text(H.skin));
      if (H.abdomen) parts.push("Abdomen: " + text(H.abdomen));
      if (Array.isArray(H.injuries) && H.injuries.length) {
        parts.push("Verletzungen: " + H.injuries.join(", "));
      }
      reply.accepted   = true;
      reply.evaluation = parts.join("\n") || "Kein besonderer Verletzungsbefund beschrieben.";
      reply.next_hint  = "Denke an Exposition, Blutungsquellen und Schmerzlokalisation.";
      touchStep("E");
      credit(1);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    const examMap = {
      "pupillen": "pupils",
      "mund":     "mouth",
      "mundraum": "mouth",
      "thorax":   "lung",
      "lunge":    "lung",
      "abdomen":  "abdomen",
      "bauch":    "abdomen",
      "haut":     "skin",
      "ekg":      "ekg12",
      "12-kanal-ekg": "ekg12"
    };
    for (const key in examMap) {
      if (!Object.prototype.hasOwnProperty.call(examMap, key)) continue;
      if (low.includes(key)) {
        const field = examMap[key];
        reply.accepted   = true;
        reply.finding    = text(H[field]);
        reply.evaluation = "Befund aufgenommen.";
        reply.next_hint  = "Leite passende Maßnahmen ein und erhebe Vitalparameter.";
        if (/pupille|gcs|bewusst/.test(key))      touchStep("D");
        else if (/thorax|lunge/.test(key))        touchStep("B");
        else if (/abdomen|bauch|haut/.test(key))  touchStep("E");
        credit(1);
        return { statusCode:200, headers, body: JSON.stringify(reply) };
      }
    }

    // =========================================================
    // 8) Vitalparameter
    // =========================================================
    const baseV = H.vitals_baseline || {
      RR: "120/80", SpO2:96, AF:16, Puls:80, BZ:110, Temp:36.8, GCS:15
    };

    // RR
    if (/rr messen|blutdruck/.test(low)) {
      const v = state.vitals.RR ?? baseV.RR;
      updVitals({ RR:v });
      markVital("RR");
      reply.accepted   = true;
      reply.evaluation = "RR gemessen.";
      reply.finding    = "RR: " + v;
      reply.next_hint  = "Denk an Schockindex und wiederholte Messungen.";
      touchStep("C");
      credit(1);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // SpO2
    if (/sp[o0]2 messen/.test(low)) {
      const v = state.vitals.SpO2 ?? baseV.SpO2;
      updVitals({ SpO2:v });
      markVital("SpO2");
      reply.accepted   = true;
      reply.evaluation = "SpO₂ gemessen.";
      reply.finding    = "SpO₂: " + v + " %";
      reply.next_hint  = "Monitor im Blick behalten und Verlauf interpretieren.";
      touchStep("B");
      credit(1);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // AF
    if (/af messen/.test(low)) {
      const v = state.vitals.AF ?? baseV.AF;
      updVitals({ AF:v });
      markVital("AF");
      reply.accepted   = true;
      reply.evaluation = "Atemfrequenz erhoben.";
      reply.finding    = "AF: " + v + " /min";
      reply.next_hint  = "Beobachte den Verlauf und dokumentiere Re-Assessments.";
      touchStep("B");
      credit(1);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // Puls
    if (/puls messen|herzfrequenz|hf\b/.test(low)) {
      const v = state.vitals.Puls ?? baseV.Puls;
      updVitals({ Puls:v });
      markVital("Puls");
      reply.accepted   = true;
      reply.evaluation = "Puls erhoben.";
      reply.finding    = "Puls: " + v + " /min";
      reply.next_hint  = "Qualität (rhythmisch, kräftig) mitdenken.";
      touchStep("C");
      credit(1);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // BZ
    if (/bz messen|blutzucker/.test(low)) {
      const v = state.vitals.BZ ?? baseV.BZ;
      updVitals({ BZ:v });
      markVital("BZ");
      reply.accepted   = true;
      reply.evaluation = "BZ gemessen.";
      reply.finding    = "BZ: " + v + " mg/dl";
      reply.next_hint  = "Bei Entgleisung Therapie nach SOP.";
      touchStep("D");
      credit(1);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // Temperatur
    if (/temp messen|temperatur/.test(low)) {
      const v = state.vitals.Temp ?? baseV.Temp;
      updVitals({ Temp:v });
      markVital("Temp");
      reply.accepted   = true;
      reply.evaluation = "Temperatur gemessen.";
      reply.finding    = "Temp: " + v + " °C";
      reply.next_hint  = "Hypo-/Hyperthermie gezielt behandeln.";
      touchStep("E");
      credit(1);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // GCS
    if (/gcs erheben|gcs\b|glasgow/.test(low)) {
      const v = state.vitals.GCS ?? baseV.GCS;
      updVitals({ GCS:v });
      markVital("GCS");
      reply.accepted   = true;
      reply.evaluation = "GCS erhoben.";
      reply.finding    = "GCS: " + v;
      reply.next_hint  = "Entwicklung der Vigilanz im Verlauf dokumentieren.";
      touchStep("D");
      credit(1);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // =========================================================
    // 9) Maßnahmen mit Vitaleffekt
    // =========================================================
    if (/o2 geben|sauerstoff/.test(low)) {
      const baseSpO2 = Number(state.vitals.SpO2 ?? baseV.SpO2 ?? 94);
      const baseAF   = Number(state.vitals.AF   ?? baseV.AF   ?? 20);
      const newSpO2  = clamp(baseSpO2 + 4, 80, 100);
      const newAF    = clamp(baseAF - 2, 8, 40);
      updVitals({ SpO2:newSpO2, AF:newAF });
      markVital("SpO2");
      markVital("AF");
      reply.accepted   = true;
      reply.evaluation = "Sauerstoffgabe eingeleitet.";
      reply.next_hint  = "SpO₂ und AF im Verlauf kontrollieren.";
      touchStep("B");
      credit(2);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    if (/volumen 500/.test(low)) {
      const baseRR = String(state.vitals.RR ?? baseV.RR ?? "100/60");
      const parts  = baseRR.split("/");
      let sys = parseInt(parts[0],10);
      let dia = parseInt(parts[1] || "60",10);
      if (!isNaN(sys)) sys = clamp(sys + 5, 80, 200);
      if (!isNaN(dia)) dia = clamp(dia + 3, 40, 130);
      const newRR = sys + "/" + dia;
      updVitals({ RR:newRR });
      markVital("RR");
      reply.accepted   = true;
      reply.evaluation = "500 ml Volumen gegeben.";
      reply.next_hint  = "RR und klinische Perfusion prüfen.";
      touchStep("C");
      credit(2);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    if (/wärme\b|decken|wärmeerhalt/.test(low)) {
      reply.accepted   = true;
      reply.evaluation = "Wärmeerhalt sichergestellt.";
      reply.next_hint  = "Temperatur und Kreislauf beobachten.";
      touchStep("E");
      credit(1);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    if (/oberkörper hoch lagern|kopfteil hoch/.test(low)) {
      reply.accepted   = true;
      reply.evaluation = "Oberkörper hoch gelagert.";
      reply.next_hint  = "Atemarbeit beurteilen, ggf. O₂-Anpassung.";
      touchStep("E");
      credit(1);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    if (/druckverband/.test(low)) {
      reply.accepted   = true;
      reply.evaluation = "Druckverband angelegt, Blutung kontrolliert.";
      reply.next_hint  = "Vitalzeichen (RR, Puls, Haut) kontrollieren.";
      touchStep("X");
      credit(2);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    if (/tourniquet/.test(low)) {
      reply.accepted   = true;
      reply.evaluation = "Tourniquet angelegt, starke Blutung gestillt.";
      reply.next_hint  = "Anlagezeit merken und dokumentieren.";
      touchStep("X");
      credit(2);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    if (/hämostyptika|haemostyptika|hämostyptikum|haemostyptikum/.test(low)) {
      reply.accepted   = true;
      reply.evaluation = "Hämostyptikum angewendet.";
      reply.next_hint  = "Wirkung und Perfusion der Extremität beurteilen.";
      touchStep("X");
      credit(1);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    if (/beckenschlinge/.test(low)) {
      reply.accepted   = true;
      reply.evaluation = "Beckenschlinge angelegt.";
      reply.next_hint  = "RR, Puls und Schmerzverhalten beobachten.";
      touchStep("C");
      credit(2);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // Airway-Maßnahmen
    if (/esmarch/.test(low)) {
      reply.accepted   = true;
      reply.evaluation = "Esmarch-Handgriff angewandt.";
      reply.next_hint  = "Atemwege kontrollieren, ggf. Guedel/Wendel einlegen.";
      touchStep("A");
      credit(1);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/guedel/.test(low) || /wendel/.test(low)) {
      reply.accepted   = true;
      reply.evaluation = "Atemwegshilfe eingelegt.";
      reply.next_hint  = "Beatmungs- und Spontanatmungssituation kontrollieren.";
      touchStep("A");
      credit(1);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/absaugen/.test(low)) {
      reply.accepted   = true;
      reply.evaluation = "Atemwege abgesaugt.";
      reply.next_hint  = "Erneute Kontrolle von Atmung und SpO₂.";
      touchStep("A");
      credit(1);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }
    if (/beutel-masken-beatmung/.test(low)) {
      reply.accepted   = true;
      reply.evaluation = "Beutel-Masken-Beatmung begonnen.";
      reply.next_hint  = "AF, Thoraxexkursion und SpO₂ engmaschig überwachen.";
      touchStep("A");
      credit(2);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // =========================================================
    // 10) EKG
    // =========================================================
    if (/12-kanal-ekg|12 kanal ekg|ekg\b/.test(low)) {
      reply.accepted   = true;
      reply.finding    = text(H.ekg12);
      reply.evaluation = "12-Kanal-EKG beurteilt.";
      reply.next_hint  = "Bei Ischämiezeichen ACS-Algorithmus einleiten.";
      touchStep("C");
      credit(1);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // =========================================================
    // 11) Verdachtsdiagnose & Transport
    // =========================================================
    if (/^verdachtsdiagnose[:]/.test(low)) {
      meas.diagnosis = ua;
      const prioMatch = ua.match(/priorit[aä]t[: ]+([^|]+)/i);
      if (prioMatch) {
        meas.transport = prioMatch[1].trim();
      }
      reply.accepted   = true;
      reply.evaluation = "Verdachtsdiagnose und Transportpriorität dokumentiert.";
      reply.next_hint  = "Prüfe, ob dein Vorgehen (Maßnahmen, Monitoring, Transportziel) dazu passt.";
      credit(2);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    if (/diagnose|was ist los|verdacht/.test(low)) {
      const spec = String(state.specialty || "").toLowerCase();
      let dx;
      if (spec === "internistisch") {
        dx = "Klinik je nach Befunden z. B. vereinbar mit akuter Bronchialobstruktion, ACS oder metabolischer Entgleisung.";
      } else if (spec === "neurologisch") {
        dx = "Klinik kompatibel z. B. mit Schlaganfall, Krampfanfall oder metabolischer Ursache.";
      } else if (spec === "trauma") {
        dx = "Traumatisches Geschehen mit potenziell relevanten Verletzungen – Frakturen / Blutungen / SHT bedenken.";
      } else if (spec === "pädiatrisch" || spec === "paediatrisch") {
        dx = "Pädiatrischer Notfall – Atmung, Kreislauf und Bewusstsein engmaschig überwachen.";
      } else {
        dx = "Nicht eindeutig – strukturiere Diagnose über XABCDE, SAMPLER und zielgerichtete Untersuchung.";
      }
      reply.accepted   = true;
      reply.evaluation = dx;
      reply.next_hint  = "Formuliere eine konkrete Verdachtsdiagnose über das Tool 'Verdachtsdiagnose & Transport'.";
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // =========================================================
    // 12) Fall beenden
    // =========================================================
    if (/fall beenden/.test(low)) {
      reply.accepted   = true;
      reply.evaluation = "Fall beendet. Du kannst nun ein Debriefing anfordern.";
      reply.done       = true;
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // =========================================================
    // Fallback
    // =========================================================
    reply.outside_scope = true;
    reply.evaluation    = "Aktion nicht erkannt. Beispiele: '4S Info', 'SAMPLER Info', 'SpO2 messen', 'AF messen', 'BZ messen', 'NRS 6', 'Verdachtsdiagnose: …'.";
    reply.next_hint     = "Arbeite Schritt für Schritt nach XABCDE, nutze die Schema-Buttons und erhebe vollständige Vitalparameter.";
    return { statusCode:200, headers, body: JSON.stringify(reply) };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || String(err) })
    };
  }
};
