// netlify/functions/case-step.js
export async function handler(event) {
  // ===== 1) CORS =====
  const ALLOWED_ORIGINS = [
    "https://www.mediciq.de",
    "https://mediciq.de",
    "https://mediciq.webflow.io",
  ];
  const reqOrigin =
    event.headers.origin || event.headers.Origin || "";
  const allowOrigin = ALLOWED_ORIGINS.includes(reqOrigin)
    ? reqOrigin
    : ALLOWED_ORIGINS[0];
  const headers = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const case_state = body.case_state || null;
    const role = (body.role || case_state?.role || "RS").toString();
    let ua = (body.user_action || "").toString();

    if (!case_state || !ua) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "case_state oder user_action fehlt",
        }),
      };
    }

    // ===== 2) Eingabe normalisieren =====
    ua = ua
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

    // ===== 3) Antwort-Skelett =====
    const reply = {
      accepted: false,
      outside_scope: false,
      unsafe: false,
      score_delta: 0,
      evaluation: "",
      // für dein Frontend: alle drei befüllen
      found: "",
      finding: "",
      result_text: "",
      next_hint: "",
      updated_vitals: null,
      done: false,
     
     case_state: null,
    };

    const accept = (t) => {
      reply.accepted = true;
      if (t) reply.evaluation = t;
      if (reply.score_delta < 1) reply.score_delta = 1;
    };
    const setFinding = (t) => {
      if (!t) return;
      reply.found = t;
      reply.finding = t;
      reply.result_text = t;
    };
    const hint = (t) => {
      if (t) reply.next_hint = t;
    };
    const vitals = (v) => {
      reply.updated_vitals = {
        ...(reply.updated_vitals || {}),
        ...v,
      };
    };

    // ===== 4) State / Hidden =====
    const state = { ...case_state };
    state.steps_done = Array.isArray(state.steps_done)
      ? state.steps_done
      : [];
    state.current_vitals = state.current_vitals || {};
    const hidden = state.hidden || {};
    const base = hidden.vitals_baseline || null;

    // ===== 5) Matcher =====
    const R_O2 = /(o2|sauerstoff|oxygen)/i;
    const R_MESSEN =
      /(messen|prufen|pruefen|kontrollieren|erheben|bestimmen)/i;
    const R_EKG3 = /(ekg.*(3|drei)|monitoring\b(?!.*12))/i;
    const R_EKG12 =
      /(12.?kanal|zwolf.?kanal|12.?ableitung|12.*ekg|ekg.*12)/i;
    const R_RR = /\b(rr|blutdruck)\b/i;
    const R_SPO2 = /\b(spo2|sauerstoffsatt|sattigung|pulsoxi)\b/i;
    const R_AF = /\b(af|atemfrequenz)\b/i;
    const R_PULS = /\b(puls|herzfrequenz|hf)\b/i;
    const R_BZ = /\b(bz|blutzucker|glukose|glucose)\b/i;
    const R_TEMP = /\b(temp|temperatur|fieber)\b/i;
    const R_GCS = /\b(gcs|glasgow)\b/i;

    const R_MUND =
      /(mundraum|mund|rachen|oropharynx|zunge|aspiration)/i;
    const R_PUPIL = /(pupille|pupillen)/i;
    const R_AUSK =
      /(auskultation|abhorchen|lungengerau?sch|giemen|rassel|stridor)/i;
    const R_PERK = /(perkussion|beklopfen|hypersonor|gedampft)/i;
    const R_HAUT =
      /(haut|blasse|zyanose|schweiss|schweissig|kaltschweiss)/i;
    const R_SCHMERZ =
      /(schmerzskala|nrs|schmerzensskala|schmerzscore)/i;
    const R_BEDM =
      /(dms|durchblutung.*motorik.*sensibilitat|perfusionscheck|kapill|rekap|kapillarfuellung)/i;
    const R_BEFAST = /\bbefast\b/i;
    const R_NEURO = /(neurolog|status)/i;

    const R_ANAM =
      /(anamnese|vorerkrank|vorgeschichte|sampler|allergien|medikation|antikoagul|blutverdunner|opqrst)/i;

    // Lagerung
    const R_LAG_OKH =
      /(oberkorper(hoch)?|herzbett|kopf hoch|okh|hochlagern)/i;
    const R_LAG_SITZ =
      /(sitzen|sitzend|kutschersitz|komfortlagerung|atemerleichternd)/i;
    const R_LAG_SSL =
      /(stabile seitenlage|seitenlage|ssl)/i;
    const R_LAG_SCHOCK =
      /(schocklage|beine hoch|beinehochlagerung)/i;

    // Info-Abfragen
    const R_DIAG =
      /(diagnose|verdachtsdiagnose|arbeitsdiagnose|was hat der patient|was ist die diagnose|was ist es\b)/i;
    const R_SUMMARY =
      /(zusammenfassung|fazit|kurzfassung|summary)/i;
    const R_FLAGS = /(red ?flags?|warnzeichen)/i;
    const R_FINDS =
      /(wichtige befunde|key findings|schlusselbefunde)/i;
    const R_GOAL = /\b(ziel|weiteres vorgehen|plan|strategie)\b/i;

    // kleine Helfer
    const num = (x, d) =>
      isFinite(+x) ? +x : d;
    const clamp = (v, lo, hi) =>
      Math.max(lo, Math.min(hi, v));

    // ===== Sauerstoff-Anhebung realistisch =====
    function applyO2() {
      const current =
        num(state.current_vitals.SpO2, null) ??
        num(base?.SpO2, null) ??
        92;
      let inc = current < 88 ? 4 : current < 92 ? 3 : 2;
      const next = clamp(current + inc, 94, 99);
      vitals({ SpO2: next });
    }

    // ===== 6) Informations-Abfragen zuerst =====
    if (R_DIAG.test(ua)) {
      const diag =
        state.solution?.diagnosis ||
        "Diagnose noch nicht eindeutig.";
      const why = Array.isArray(state.solution?.justification)
        ? state.solution.justification.join(" • ")
        : state.solution?.justification ||
          state.key_findings?.join(" • ") ||
          "";
      accept("Informationsabfrage erkannt.");
      setFinding(
        `Diagnose/Verdacht: ${diag}${
          why ? ` — Begründung: ${why}.` : ""
        }`
      );
      hint(
        state.target_outcome ||
          "Monitoring fortführen, weitere Befunde erheben."
      );
    } else if (R_SUMMARY.test(ua)) {
      accept("Zusammenfassung des aktuellen Falls.");
      const id = state.id || "–";
      const story = state.story || "—";
      const flags = Array.isArray(state.red_flags)
        ? state.red_flags.join(" • ")
        : state.red_flags || "—";
      const finds = Array.isArray(state.key_findings)
        ? state.key_findings.join(" • ")
        : state.key_findings || "—";
      const diag = state.solution?.diagnosis || "—";
      setFinding(
        `FALL-ID: ${id}\nStory: ${story}\nRed Flags: ${flags}\nWichtige Befunde: ${finds}\nDiagnose/Verdacht: ${diag}`
      );
      hint(state.target_outcome || "");
    } else if (R_FLAGS.test(ua)) {
      accept("Informationsabfrage: Red Flags.");
      const flags = Array.isArray(state.red_flags)
        ? state.red_flags.join(" • ")
        : state.red_flags || "Keine Red Flags hinterlegt.";
      setFinding(`Red Flags: ${flags}`);
      hint("Prioritäten/Transportziel entsprechend anpassen.");
    } else if (R_FINDS.test(ua)) {
      accept("Informationsabfrage: Wichtige Befunde.");
      const finds = Array.isArray(state.key_findings)
        ? state.key_findings.join(" • ")
        : state.key_findings || "Keine Schlüsselbefunde hinterlegt.";
      setFinding(`Wichtige Befunde: ${finds}`);
      hint(
        "Gezielte Diagnostik ergänzen (EKG, BZ, Auskultation …)."
      );
    } else if (R_GOAL.test(ua)) {
      accept("Informationsabfrage: Ziel/Vorgehen.");
      setFinding(
        state.target_outcome ||
          "Ziel/Vorgehen ist im Fall nicht explizit hinterlegt."
      );
      hint(
        "Weiter mit Monitoring, Reevaluation und Übergabe/Transportplanung."
      );
    }

    // ===== 7) Maßnahmen-Erkennung =====

    // Lagerungen
    else if (R_LAG_OKH.test(ua)) {
      accept("Oberkörperhochlagerung durchgeführt.");
      setFinding("Lagerung: Oberkörper hoch (herzentlastend).");
      hint(
        "Atemerleichterung prüfen, O₂/Gabe nach Indikation, Monitoring fortführen."
      );
    } else if (R_LAG_SITZ.test(ua)) {
      accept("Atemerleichternde Sitzhaltung angelegt.");
      setFinding("Lagerung: Sitzend/Kutschersitz (komfortabel).");
      hint("AF/SpO₂ beobachten, Auskultation ergänzen.");
    } else if (R_LAG_SSL.test(ua)) {
      accept("Stabile Seitenlage durchgeführt.");
      setFinding("Lagerung: Stabile Seitenlage.");
      hint("Atemwege sichern, Monitoring fortführen.");
    } else if (R_LAG_SCHOCK.test(ua)) {
      accept("Schocklage/Beine hoch durchgeführt.");
      setFinding("Lagerung: Beine hoch (Schocklage).");
      hint(
        "Kreislauf beobachten; je nach Verdacht begrenzt sinnvoll (z. B. bei ACS oft nicht bevorzugt)."
      );
    }

    // O2-Gabe
    else if (R_O2.test(ua) && !R_MESSEN.test(ua)) {
      accept("Sauerstoffgabe in dieser Situation indiziert.");
      applyO2();
      setFinding("O₂ gegeben (dosiert, nach Indikation).");
      hint(
        "Monitoring fortführen, EKG/12-Kanal erwägen, BZ/Pupillen/Auskultation ergänzen."
      );
    }

    // EKG
    else if (R_EKG12.test(ua)) {
      accept("12-Kanal-EKG abgeleitet.");
      setFinding(
        hidden.ekg12
          ? `EKG-Befund: ${hidden.ekg12}.`
          : "EKG-Befund: Sinus, keine akuten ST-Hebungen."
      );
      hint("Befund bewerten, NA/Transport, Verlaufskontrolle.");
    } else if (R_EKG3.test(ua)) {
      accept("Monitoring/3-Kanal-EKG angelegt.");
      setFinding(
        hidden.ekg3
          ? `Monitoring: ${hidden.ekg3}.`
          : "Monitoring: Sinusrhythmus."
      );
      hint("Bei Thoraxschmerz 12-Kanal-EKG ergänzen.");
    }

    // Mundraum
    else if (R_MUND.test(ua)) {
      accept("Mundraum inspiziert.");
      setFinding(
        hidden.mouth ||
          "Keine Fremdkörper, Schleimhäute rosig, keine Aspiration erkennbar."
      );
      hint(
        "Bei Atemproblemen: Auskultation, SpO₂, ggf. O₂, ggf. Absaugen (SOP)."
      );
    }

    // Pupillen
    else if (R_PUPIL.test(ua)) {
      accept("Pupillen geprüft.");
      setFinding(
        hidden.pupils || "Pupillen isokor, prompt lichtreagibel."
      );
      hint("Bei Vigilanzstörung: GCS, BZ, EKG, ggf. BEFAST.");
    }

    // Auskultation
    else if (R_AUSK.test(ua)) {
      accept("Lunge auskultiert.");
      setFinding(
        hidden.lung ||
          "Seitengleiches Atemgeräusch, keine groben Nebengeräusche."
      );
      hint("Perkussion/Inspektion ergänzen, SpO₂/AF dokumentieren.");
    }

    // Perkussion
    else if (R_PERK.test(ua)) {
      accept("Thorax perkutiert.");
      setFinding(
        "Perkussionsbefund unauffällig (kein deutlicher Klopfschalldifferenz)."
      );
      hint("Auskultation/Inspektion, Monitoring komplettieren.");
    }

    // Hautbefund
    else if (R_HAUT.test(ua)) {
      accept("Hautbefund erhoben.");
      setFinding(
        "Haut warm/rosig; keine Zyanose, ggf. leicht kaltschweißig je nach Belastung."
      );
      hint("Kapilläre Füllung prüfen, weitere Vitalzeichen dokumentieren.");
    }

    // DMS / Perfusion
    else if (R_BEDM.test(ua)) {
      accept("Durchblutung/Motorik/Sensibilität (DMS) geprüft.");
      setFinding("DMS unauffällig, kapilläre Füllung < 2 s.");
      hint(
        "Bei Trauma: Pulse/Sensibilität/Motorik dokumentieren, Schienung/Lagerung nach Bedarf."
      );
    }

    // Schmerzskala
    else if (R_SCHMERZ.test(ua)) {
      accept("Schmerzskala erhoben.");
      setFinding(
        "NRS 6/10, drückend retrosternal (Beispiel; je nach Fall variabel)."
      );
      hint("Analgesie nach SOP erwägen; Monitoring weiterführen.");
    }

    // BEFAST
    else if (R_BEFAST.test(ua)) {
      accept("BEFAST durchgeführt.");
      if (hidden.befast) {
        const b = hidden.befast;
        setFinding(
          `BEFAST: Balance=${b.Balance}, Eyes=${b.Eyes}, Face=${b.Face}, Arms=${b.Arms}, Speech=${b.Speech}, Time=${b.Time}.`
        );
      } else {
        setFinding(
          "BEFAST unauffällig oder nicht eindeutig pathologisch."
        );
      }
      hint(
        "Zeitfenster beachten, Stroke-Unit/Transport organisieren."
      );
    }

    // Neurologischer Status
    else if (R_NEURO.test(ua)) {
      accept("Neurologischer Status erhoben.");
      setFinding(
        hidden.neuro ||
          "Kein grober fokal-neurologischer Ausfall; Bewusstsein klar."
      );
      hint("Bei Auffälligkeit: Stroke-Protokoll, BZ, EKG, Transport priorisieren.");
    }

    // Anamnese / SAMPLER / OPQRST
    else if (R_ANAM.test(ua)) {
      accept("Anamnese/Vorerkrankungen erfragt.");
      if (hidden.anamnesis) {
        // direkt aus dem Fall (empfohlen: SAMPLER/OPQRST Block in case-new)
        setFinding(hidden.anamnesis);
      } else {
        // fallback je nach Verdacht
        const dx = (state.solution?.diagnosis || "").toLowerCase();
        if (
          dx.includes("koronar") ||
          dx.includes("acs") ||
          dx.includes("stemi") ||
          dx.includes("nstemi")
        ) {
          setFinding(
            "SAMPLER: S Thoraxschmerz (drückend), Dyspnoe | A Pollen | M Ramipril, Metformin | P k.A. | L heute wenig | E Belastung/Stress | R Raucher*in. OPQRST: O akut <30 min, P Belastung↑, Q drückend, R retrosternal/Arm, S 6/10, T zunehmend."
          );
        } else if (
          dx.includes("schlaganfall") ||
          dx.includes("stroke")
        ) {
          setFinding(
            "SAMPLER: S Sprachstörung/Hemiparese | A k.A. | M Amlodipin | P Hypertonie | L normal | E plötzlich, Zeitfenster < 1 h | R Gefäßerkrankungen. OPQRST: neurologisch nicht anwendbar."
          );
        } else {
          setFinding(
            "Anamnese: Allergien verneint; Dauermedikation/Antikoagulation erfragen; Vorerkrankungen unklar; letzte Nahrungsaufnahme/Umstände erheben; Risikofaktoren (Nikotin, Adipositas, Diabetes) prüfen."
          );
        }
      }
      hint("Ergänze Allergien, Dauermedikation, Antikoagulation, frühere Ereignisse, Noxen.");
    }

    // Vitalparameter messen
    else if (R_RR.test(ua) && R_MESSEN.test(ua)) {
      accept("Blutdruck gemessen.");
      const RR = base?.RR || "120/80";
      setFinding(`Befund: RR ${RR}`);
      vitals({ RR });
      hint("Vitalparameter komplettieren (SpO₂, AF, Puls, BZ, Temp, GCS).");
    } else if (R_SPO2.test(ua) && R_MESSEN.test(ua)) {
      accept("SpO₂ gemessen.");
      const SpO2 =
        num(base?.SpO2, null) ?? 97;
      setFinding(`Befund: SpO₂ ${SpO2}%`);
      vitals({ SpO2 });
      hint("Bei Hypoxie O₂-Gabe erwägen, Monitoring fortführen.");
    } else if (R_AF.test(ua) && R_MESSEN.test(ua)) {
      accept("Atemfrequenz gezählt.");
      const AF = num(base?.AF, null) ?? 16;
      setFinding(`Befund: AF ${AF}/min`);
      vitals({ AF });
      hint("Auskultation/Perkussion ergänzen, Verlauf dokumentieren.");
    } else if (R_PULS.test(ua) && R_MESSEN.test(ua)) {
      accept("Puls/Herzfrequenz erhoben.");
      const Puls = num(base?.Puls, null) ?? 80;
      setFinding(`Befund: Puls ${Puls}/min`);
      vitals({ Puls });
      hint("EKG/Monitoring ergänzen, Rhythmus kontrollieren.");
    } else if (R_BZ.test(ua) && R_MESSEN.test(ua)) {
      accept("Blutzucker gemessen.");
      const BZ = num(base?.BZ, null) ?? 110;
      setFinding(`Befund: BZ ${BZ} mg/dl`);
      vitals({ BZ });
      hint("Bei Entgleisung SOP-Maßnahmen, Monitoring fortführen.");
    } else if (R_TEMP.test(ua) && R_MESSEN.test(ua)) {
      accept("Temperatur gemessen.");
      const Temp = num(base?.Temp, null) ?? 36.8;
      setFinding(`Befund: Temp ${Temp}°C`);
      vitals({ Temp });
      hint("Klinischen Kontext berücksichtigen (Infekt/Sepsis?).");
    } else if (R_GCS.test(ua) && R_MESSEN.test(ua)) {
      accept("GCS erhoben.");
      const GCS = num(base?.GCS, null) ?? 15;
      setFinding(`Befund: GCS ${GCS}`);
      vitals({ GCS });
      hint("Bei Reduktion: Ursachen klären (BZ, Kopf, Intox, Hypoxie).");
    }

    // Fallback
    else {
      reply.accepted = false;
      reply.evaluation =
        "Aktion/Frage nicht eindeutig zuordenbar.";
      setFinding(
        'Nutze klare, kurze Statements (z. B. „Mundraum schauen“, „Pupillen prüfen“, „EKG schreiben“, „RR messen“, „Diagnose?“, „Oberkörper hoch“, „O₂ geben“).'
      );
      hint(
        "Vitalzeichen komplettieren, Auskultation/Perkussion, EKG, ggf. BEFAST."
      );
    }

    // ===== 8) State aktualisieren =====
    if (reply.accepted) state.steps_done.push(ua);
    if (reply.updated_vitals) {
      state.current_vitals = {
        ...(state.current_vitals || {}),
        ...reply.updated_vitals,
      };
    }
    reply.case_state = state;

    return { statusCode: 200, headers, body: JSON.stringify(reply) };
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message }),
    };
  }
}
