/**
 * Netlify Function: case-step
 * Verarbeitet eine User-Aktion gegen den aktuellen Fallzustand.
 * Unterstützt:
 * - XABCDE-Schritte, Vitalwerte, Interventionen
 * - 4S, SAMPLER, BE-FAST, NRS
 * - Verdachtsdiagnose & Transport
 * - Debriefing inkl. Bewertung der Verdachtsdiagnose
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

    // ---------- Grundstruktur im Fall sicherstellen ----------
    state.id         = state.id || "unknown_case";
    state.specialty  = state.specialty || body.specialty || "internistisch";
    state.role       = state.role || body.role || "RS";
    state.difficulty = state.difficulty || body.difficulty || "mittel";
    state.vitals     = state.vitals || {};
    state.hidden     = state.hidden || {};
    state.steps_done = Array.isArray(state.steps_done) ? state.steps_done : [];
    state.history    = Array.isArray(state.history)    ? state.history    : [];
    state.score      = typeof state.score === "number" ? state.score      : 0;

    state.measurements = state.measurements || {
      vitals: {},
      schemas: {},
      pain: { documented:false, nrs:null },
      diagnosis: null,
      transport: null,
      dx_eval: null       // { ok:boolean, expected:string, comment:string }
    };
    const meas = state.measurements;
    meas.vitals  = meas.vitals  || {};
    meas.schemas = meas.schemas || {};
    meas.pain    = meas.pain    || { documented:false, nrs:null };

    const H = state.hidden;

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
      done: false,
      case_state: state
    };

    // ---------- Helper ----------
    const text = (v) => {
      if (v === undefined || v === null) return "—";
      const s = String(v).trim();
      return s === "" ? "—" : s;
    };
    const list = (arr) => {
      if (!Array.isArray(arr) || !arr.length) return "—";
      return arr.join(", ");
    };
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    const updVitals = (obj) => {
      state.vitals = state.vitals || {};
      for (const k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
        state.vitals[k] = obj[k];
        reply.updated_vitals[k] = obj[k];
      }
    };

    const markVital  = (name) => { meas.vitals[name] = true; };
    const markSchema = (name) => { meas.schemas[name] = true; };

    const STEP_LABEL = {
      X: "X – Exsanguination",
      A: "A – Airway",
      B: "B – Breathing",
      C: "C – Circulation",
      D: "D – Disability",
      E: "E – Exposure"
    };
    const touchStep = (letter) => {
      const label = STEP_LABEL[letter];
      if (!label) return;
      if (!Array.isArray(state.steps_done)) state.steps_done = [];
      if (!state.steps_done.some(x => String(x).toUpperCase().startsWith(letter))) {
        state.steps_done.push(label);
        state.score += 1;
      }
    };
    const credit = (pts) => {
      if (typeof pts === "number" && isFinite(pts)) state.score += pts;
    };

    const baseVitals = H.vitals_baseline || {
      RR: "120/80",
      SpO2: 96,
      AF: 16,
      Puls: 80,
      BZ: 110,
      Temp: 36.8,
      GCS: 15
    };

    // =====================================================================
    // 0) Kein Input → nur leere Antwort
    // =====================================================================
    if (!ua) {
      reply.evaluation = "";
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // =====================================================================
    // A) Debriefing (mit Bewertung der Verdachtsdiagnose)
    // =====================================================================
    if (/debrief/.test(low)) {
      const steps = Array.isArray(state.steps_done) ? state.steps_done : [];
      const order = ["X","A","B","C","D","E"];
      const open  = order.filter(l =>
        !steps.some(x => String(x).toUpperCase().startsWith(l))
      );

      const vitalsAll     = ["RR","SpO2","AF","Puls","BZ","Temp","GCS"];
      const vitalsDone    = vitalsAll.filter(k => meas.vitals[k]);
      const vitalsMissing = vitalsAll.filter(k => !meas.vitals[k]);

      const schemaLines = [];
      schemaLines.push(meas.schemas["4S"]      ? "4S-Schema angewandt"      : "4S-Schema nicht dokumentiert");
      schemaLines.push(meas.schemas["SAMPLER"] ? "SAMPLER-Anamnese erhoben" : "SAMPLER noch nicht genutzt");
      schemaLines.push(meas.schemas["BEFAST"]  ? "BE-FAST geprüft"          : "BE-FAST nicht dokumentiert");

      const pain = meas.pain || {};
      let painLine = "Schmerzskala nicht erhoben.";
      if (pain.documented) {
        painLine = `Schmerzskala dokumentiert (NRS ${pain.nrs ?? "—"}).`;
      }

      let dxLine    = "Verdachtsdiagnose noch nicht dokumentiert.";
      let trLine    = "Transportpriorität noch nicht festgelegt.";
      let dxFeedback = "";

      if (meas.diagnosis) {
        dxLine = "Verdachtsdiagnose: " + meas.diagnosis;
        if (meas.transport) {
          trLine = "Transportentscheidung: " + meas.transport;
        }

        const ev = meas.dx_eval || {};
        if (ev.ok === true) {
          dxFeedback = ev.comment || "Deine Verdachtsdiagnose passt gut zu den Leitsymptomen des Falls.";
        } else if (ev.ok === false) {
          dxFeedback = ev.comment || "Deine Verdachtsdiagnose weicht von der wahrscheinlichen Hauptursache ab.";
        }
      }

      const lines = [];
      lines.push("XABCDE-Fortschritt: " + (steps.length ? steps.join(" → ") : "keine Schritte dokumentiert."));
      lines.push(open.length ? ("Offene Bereiche: " + open.join(", ") + ".") : "Alle XABCDE-Bereiche wurden mindestens einmal angesprochen.");
      lines.push("Vitals erhoben: " + (vitalsDone.length ? vitalsDone.join(", ") : "keine vollständigen Vitalparameter."));
      if (vitalsMissing.length) lines.push("Fehlende Vitals: " + vitalsMissing.join(", ") + ".");
      lines.push("Schemata: " + schemaLines.join(" | "));
      lines.push(painLine);
      lines.push(dxLine);
      lines.push(trLine);
      if (dxFeedback) lines.push("Bewertung Verdachtsdiagnose: " + dxFeedback);
      lines.push("Tipp: Verknüpfe Maßnahmen mit Verlauf (O₂ → SpO₂/AF, Analgesie → NRS, Volumen → RR, Lagerung → Atmung) und dokumentiere Re-Assessments.");

      const txt = lines.join("\n");
      reply.accepted   = true;
      reply.debrief    = txt;
      reply.evaluation = txt;

      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // =====================================================================
    // B) 4S-Schema
    // =====================================================================
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
      reply.next_hint = "Prüfe, ob zusätzlicher Support (NA, Feuerwehr, Polizei, RTH) nötig ist.";
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    if (/4s dokumentiert|4s abgearbeitet|\b4s\b/.test(low)) {
      markSchema("4S");
      reply.accepted   = true;
      reply.evaluation = "4S-Schema dokumentiert.";
      reply.next_hint  = "Arbeite nun strukturiert X→A→B→C→D→E ab.";
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // =====================================================================
    // C) SAMPLER-Anamnese
    // =====================================================================
    if (/sampler info|anamnese/.test(low)) {
      markSchema("SAMPLER");
      const a = state.anamnesis || {};
      const S = a.SAMPLER || {};
      const O = a.OPQRST  || {};
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
        "Medikation: "      + list(a.medikation)      + "\n" +
        "Allergien: "       + list(a.allergien)       + "\n" +
        "Antikoagulation: " + (a.antikoagulation ? "ja" : "nein") + "\n" +
        (O.O || O.P || O.Q || O.R || O.S || O.T
          ? ("OPQRST → O:" + text(O.O) + " | P:" + text(O.P) +
             " | Q:" + text(O.Q) + " | R:" + text(O.R) +
             " | S:" + text(O.S) + " | T:" + text(O.T))
          : "");
      reply.next_hint = "Nutze die Anamnese, um deine Verdachtsdiagnose zu schärfen.";
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    if (/sampler dokumentiert|sampler\b/.test(low)) {
      markSchema("SAMPLER");
      reply.accepted   = true;
      reply.evaluation = "SAMPLER-Anamnese dokumentiert.";
      reply.next_hint  = "Jetzt körperliche Untersuchung und Vitalwerte erheben.";
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // =====================================================================
    // D) BE-FAST
    // =====================================================================
    if (/befast info/.test(low)) {
      markSchema("BEFAST");
      reply.accepted   = true;
      reply.evaluation = "BE-FAST laut Fall: " + text(H.befast) + " | LKW: " + text(H.lkw);
      reply.next_hint  = "Bei Verdacht auf Schlaganfall frühzeitigen Stroke-Unit-Transport planen.";
      touchStep("D");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    if (/befast:|befast dokumentiert/.test(low)) {
      markSchema("BEFAST");
      reply.accepted   = true;
      reply.evaluation = "BE-FAST-Befund dokumentiert.";
      reply.next_hint  = "Achte auf Zeitfenster und Transportziel.";
      touchStep("D");
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // =====================================================================
    // E) Schmerz / NRS
    // =====================================================================
    if (/schmerz info/.test(low)) {
      const p = H.pain || {};
      reply.accepted   = true;
      reply.evaluation =
        "Schmerz laut Fall: NRS " + text(p.nrs) +
        " | Ort: " + text(p.ort) +
        " | Charakter: " + text(p.charakter);
      reply.next_hint  = "Erhebe eine eigene NRS (0–10) und behandle ggf. nach SOP.";
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    const nrsMatch = low.match(/\bnrs\s*([0-9]{1,2})\b/);
    if (nrsMatch) {
      const n = Number(nrsMatch[1]);
      meas.pain.documented = true;
      meas.pain.nrs = n;
      reply.accepted   = true;
      reply.evaluation = "Schmerzskala dokumentiert: NRS " + n + ".";
      reply.next_hint  = "Dokumentiere auch den Verlauf nach Analgesie.";
      credit(1);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    if (/(schmerz|nrs|schmerzskala)/.test(low)) {
      const p = H.pain || {};
      reply.accepted   = true;
      reply.evaluation =
        "Schmerz laut Fall: NRS " + text(p.nrs) +
        " | Ort: " + text(p.ort) +
        " | Charakter: " + text(p.charakter);
      reply.next_hint  = "Trage eine NRS (0–10) ein, z. B. 'NRS 6'.";
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // =====================================================================
    // F) Körperliche Untersuchung / Bodycheck
    // =====================================================================
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
      "lunge":    "lung",
      "thorax":   "lung",
      "abdomen":  "abdomen",
      "bauch":    "abdomen",
      "haut":     "skin",
      "ekg":      "ekg12",
      "12-kanal-ekg": "ekg12"
    };
    for (const key in examMap) {
      if (!Object.prototype.hasOwnProperty.call(examMap, key)) continue;
      if (!low.includes(key)) continue;
      const field = examMap[key];
      reply.accepted   = true;
      reply.finding    = text(H[field]);
      reply.evaluation = "Befund aufgenommen.";
      reply.next_hint  = "Leite passende Maßnahmen ein und erhebe Vitalparameter.";
      if (/pupille/.test(key))       touchStep("D");
      else if (/lunge|thorax/.test(key))   touchStep("B");
      else if (/abdomen|bauch|haut/.test(key)) touchStep("E");
      credit(1);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // =====================================================================
    // G) Vitalparameter
    // =====================================================================
    // RR
    if (/rr messen|blutdruck/.test(low)) {
      const v = state.vitals.RR ?? baseVitals.RR;
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
      const v = state.vitals.SpO2 ?? baseVitals.SpO2;
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
      const v = state.vitals.AF ?? baseVitals.AF;
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
      const v = state.vitals.Puls ?? baseVitals.Puls;
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
      const v = state.vitals.BZ ?? baseVitals.BZ;
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

    // Temp
    if (/temp messen|temperatur/.test(low)) {
      const v = state.vitals.Temp ?? baseVitals.Temp;
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
      const v = state.vitals.GCS ?? baseVitals.GCS;
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

    // =====================================================================
    // H) Interventionen mit Vital-Effekt
    // =====================================================================
    if (/o2 geben|sauerstoff/.test(low)) {
      const baseSpO2 = Number(state.vitals.SpO2 ?? baseVitals.SpO2 ?? 94);
      const baseAF   = Number(state.vitals.AF   ?? baseVitals.AF   ?? 20);
      const newSpO2  = clamp(baseSpO2 + 4, 80, 100);
      const newAF    = clamp(baseAF   - 2,  6, 40);
      updVitals({ SpO2:newSpO2, AF:newAF });
      markVital("SpO2");
      markVital("AF");
      reply.accepted   = true;
      reply.evaluation = "Sauerstoffgabe eingeleitet.";
      reply.next_hint  = "SpO₂ und AF im Verlauf kontrollieren und dokumentieren.";
      touchStep("B");
      credit(2);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    if (/volumen 500/.test(low)) {
      const baseRR = String(state.vitals.RR ?? baseVitals.RR ?? "100/60");
      const parts  = baseRR.split("/");
      let sys = parseInt(parts[0], 10);
      let dia = parseInt(parts[1] || "60", 10);
      if (!isNaN(sys)) sys = clamp(sys + 5, 80, 220);
      if (!isNaN(dia)) dia = clamp(dia + 3, 40, 140);
      updVitals({ RR: sys + "/" + dia });
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
      reply.next_hint  = "Beatmung und Spontanatmung kontrollieren.";
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

    // =====================================================================
    // I) EKG
    // =====================================================================
    if (/12-kanal-ekg|12 kanal ekg|ekg\b/.test(low)) {
      reply.accepted   = true;
      reply.finding    = text(H.ekg12);
      reply.evaluation = "12-Kanal-EKG beurteilt.";
      reply.next_hint  = "Bei Ischämiezeichen ACS-Algorithmus einleiten.";
      touchStep("C");
      credit(1);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // =====================================================================
    // J) Verdachtsdiagnose & Transport
    // =====================================================================
    function evaluateDiagnosis(textDx) {
      const t = textDx.toLowerCase();
      let expected = "";
      let ok = false;
      let comment = "";

      if (state.id.startsWith("rs_asthma")) {
        expected = "Asthma / akute Bronchialobstruktion";
        ok = /(asthma|bronchialobstruktion|bronchoobstruktion)/.test(t);
        if (ok) {
          comment = "Du hast die Bronchialobstruktion erkannt (Dyspnoe, Giemen, verlängertes Exspirium, bekannte Asthma-Anamnese).";
        } else {
          comment = "Im Fall stehen akute Atemnot nach Belastung, Giemen und bekannte Asthma-Anamnese im Vordergrund – das spricht eher für eine Bronchialobstruktion als z. B. für ein primäres kardiales Problem.";
        }
      } else if (state.id.startsWith("rs_hypoglyk")) {
        expected = "Hypoglykämie bei Diabetes";
        ok = /(hypo[gk]lyk|niedriger blutzucker|unterzucker)/.test(t);
        if (ok) {
          comment = "Du hast die Hypoglykämie erkannt (kaltschweißig, verwirrt, niedriger BZ, bekannte Diabetes-Anamnese).";
        } else {
          comment = "Verwirrtheit, Kaltschweißigkeit und sehr niedriger BZ bei bekanntem Diabetes passen gut zu einer Hypoglykämie – darauf sollte die Verdachtsdiagnose abzielen.";
        }
      } else if (state.id.startsWith("rs_trauma_unterarm")) {
        expected = "Traumatische Unterarmfraktur / Extremitätenverletzung";
        ok = /(fraktur|unterarm|radius|ulna|extremit[aä]tentrauma)/.test(t);
        if (ok) {
          comment = "Du hast die fokale Extremitätenverletzung korrekt priorisiert (lokaler Schmerz, Deformität, Mechanismus).";
        } else {
          comment = "Der Mechanismus (Sturz auf ausgestreckten Arm), lokaler Schmerz und Deformität sprechen in erster Linie für eine Fraktur des Unterarms.";
        }
      } else if (state.id.startsWith("rs_paed_bronchiolitis")) {
        expected = "infektiöse Bronchiolitis / obstruktive Bronchitis im Säuglingsalter";
        ok = /(bronchiolitis|obstruktive bronchitis|bronchitis|untere atemwegsinfektion)/.test(t);
        if (ok) {
          comment = "Du ordnest die Symptomatik korrekt als unteren Atemwegsinfekt mit Obstruktion ein (Tachypnoe, Einziehungen, Giemen, Fieber).";
        } else {
          comment = "Husten, Tachypnoe, Einziehungen, Giemen und Fieber beim Säugling sprechen eher für eine Bronchiolitis / obstruktive Bronchitis als für eine reine obere Infektion.";
        }
      }

      meas.dx_eval = { ok, expected, comment };
    }

    if (/^verdachtsdiagnose[:]/.test(ua)) {
      meas.diagnosis = ua;
      const prioMatch = ua.match(/priorit[aä]t[: ]+([^|]+)/i);
      if (prioMatch) meas.transport = prioMatch[1].trim();

      evaluateDiagnosis(ua);

      reply.accepted   = true;
      reply.evaluation = "Verdachtsdiagnose und Transportpriorität dokumentiert.";
      reply.next_hint  = "Prüfe, ob Maßnahmen, Monitoring und Transportziel zu deiner Verdachtsdiagnose passen.";
      credit(2);
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    if (/diagnose|was ist los|verdacht/.test(low)) {
      const spec = String(state.specialty || "").toLowerCase();
      let dx;
      if (spec === "internistisch") {
        dx = "Nutze Anamnese (SAMPLER), Atembefund und EKG, um zwischen Bronchialobstruktion, kardialen Ursachen und metabolischen Problemen zu unterscheiden.";
      } else if (spec === "neurologisch") {
        dx = "Überlege bei veränderter Vigilanz u. a. Hypoglykämie, Schlaganfall, Epilepsie oder Intoxikation.";
      } else if (spec === "trauma") {
        dx = "Bewerte, ob es sich um ein isoliertes Extremitätentrauma oder ein mögliches Polytrauma handelt.";
      } else if (spec === "pädiatrisch" || spec === "paediatrisch") {
        dx = "Beachte bei pädiatrischen Notfällen immer zuerst Atmung, Kreislauf und Bewusstsein; häufig sind Infekte oder obstruktive Atemwegserkrankungen.";
      } else {
        dx = "Strukturiere deine Verdachtsdiagnose über XABCDE, SAMPLER und zielgerichtete Untersuchung.";
      }
      reply.accepted   = true;
      reply.evaluation = dx;
      reply.next_hint  = "Formuliere deine konkrete Verdachtsdiagnose über das Tool 'Verdachtsdiagnose & Transport'.";
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // =====================================================================
    // K) Fall beenden
    // =====================================================================
    if (/fall beenden/.test(low)) {
      reply.accepted   = true;
      reply.evaluation = "Fall beendet. Fordere gern ein Debriefing an.";
      reply.done       = true;
      return { statusCode:200, headers, body: JSON.stringify(reply) };
    }

    // =====================================================================
    // L) Fallback – nicht erkannte Aktion
    // =====================================================================
    reply.outside_scope = true;
    reply.evaluation =
      "Aktion nicht erkannt. Beispiele: '4S Info', 'SAMPLER Info', 'SpO2 messen', 'AF messen', 'BZ messen', 'NRS 6', 'Verdachtsdiagnose: ...'.";
    reply.next_hint =
      "Arbeite Schritt für Schritt nach XABCDE, nutze die Schema-Buttons und erhebe vollständige Vitalparameter.";

    return { statusCode:200, headers, body: JSON.stringify(reply) };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || String(err) })
    };
  }
};
