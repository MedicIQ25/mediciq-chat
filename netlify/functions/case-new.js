/**
 * Netlify Function: case-new
 * Generates a new RS case with guaranteed answerable fields.
 */
exports.handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const specialty = (body.specialty || "internistisch").toLowerCase();
    const role = body.role || "RS";
    const difficulty = body.difficulty || "mittel";

    // Simple case factory per specialty
    const cases = {
      internistisch: () => ({
        id: "rs_asthma_01",
        specialty: "internistisch",
        role,
        story: "17-jähriger auf dem Sportplatz mit akuter Atemnot nach Sprint. Sprechdyspnoe, 2-Wort-Sätze.",
        target_outcome: "AF und SpO₂ verbessern (O₂ + inhalatives β₂-Mimetikum), Transport vorbereiten.",
        key_findings: ["Dyspnoe", "verlängertes Exspirium", "Giemen", "Sprechdyspnoe"],
        red_flags: ["SpO₂ < 90 %", "Erschöpfung", "Silent chest"],
        vitals: { RR: "138/86", SpO2: 85, AF: 28, Puls: 124, BZ: 108, Temp: 36.8, GCS: 15 },
        anamnesis: {
          SAMPLER: { S: "Atemnot", A: "keine bekannt", M: "Bedarfs-Salbutamol", P: "Anstrengung", L: "keine",
                     E: "Belastung, kalte Luft", R: "nein" },
          vorerkrankungen: ["Asthma bronchiale"],
          medikation: ["Salbutamol Spray bei Bedarf"],
          allergien: [],
          antikoagulation: false
        },
        hidden: {
          pupils: "isokor, mittelweit, prompt",
          mouth: "Mund-/Rachenraum frei, kein Erbrochenes",
          lung: "Giemen beidseits, verlängertes Exspirium",
          abdomen: "weich, kein Abwehrspannungsbefund",
          skin: "rosig, leicht kaltschweißig",
          ekg3: "Sinusrhythmus 110/min, keine ST-Hebungen",
          ekg12: "Sinus, keine Ischämiezeichen",
          befast: "ohne Auffälligkeiten",
          lkw: "nicht relevant",
          pain: { nrs: 2 },
          injuries: []
        }
      }),
      neurologisch: () => ({
        id: "rs_hypogly_01",
        specialty: "neurologisch",
        role,
        story: "68-jährige Person, verwirrt in der Wohnung aufgefunden. Diabetes bekannt.",
        target_outcome: "BZ-Messung, Hypoglykämie behandeln, Vigilanz stabilisieren, Transport.",
        key_findings: ["Vigilanzminderung", "kaltschweißig", "zittrig"],
        red_flags: ["GCS < 13", "Krampfanfall", "Persistierende Hypoglykämie"],
        vitals: { RR: "150/90", SpO2: 96, AF: 18, Puls: 104, BZ: 42, Temp: 36.4, GCS: 13 },
        anamnesis: {
          SAMPLER: { S: "Unruhe, Schwitzen", A: "Penicillin", M: "Insulin", P: "wenig gegessen", L: "keine",
                     E: "vermutlich Mahlzeit ausgelassen", R: "nein" },
          vorerkrankungen: ["Diabetes mellitus Typ 2", "Hypertonie"],
          medikation: ["Insulin", "ACE-Hemmer"],
          allergien: ["Penicillin"],
          antikoagulation: false,
          OPQRST: { O:"schleichend", P:"-", Q:"-", R:"-", S:"-", T:"heute" }
        },
        hidden: {
          pupils: "isokor, prompt",
          mouth: "trocken",
          lung: "vesikulär beidseits",
          abdomen: "weich",
          skin: "kaltschweißig",
          ekg12: "Sinus 100/min",
          befast: "unauffällig",
          lkw: "heute Morgen",
          pain: { nrs: 0 },
          injuries: []
        }
      }),
      trauma: () => ({
        id: "rs_trauma_01",
        specialty: "trauma",
        role,
        story: "Sturz vom Fahrrad, Landstraße. Schmerzen am rechten Unterarm, Schürfwunden am Knie.",
        target_outcome: "XABCDE, Blutstillung, Immobilisation, DMS vor/nach, Transport.",
        key_findings: ["sichtbare Blutung", "Schmerz Unterarm rechts", "Schürfwunden"],
        red_flags: ["starke Blutung", "instabiles Becken", "neurologische Ausfälle"],
        vitals: { RR: "128/82", SpO2: 97, AF: 20, Puls: 102, BZ: 112, Temp: 36.9, GCS: 15 },
        anamnesis: {
          SAMPLER: { S: "Schmerzen r. Unterarm", A: "keine", M: "keine", P: "Sturz Fahrrad", L: "keine",
                     E: "Schutzkleidung: Helm", R: "nein" },
          vorerkrankungen: [], medikation: [], allergien: [], antikoagulation: false
        },
        hidden: {
          pupils: "isokor, prompt",
          mouth: "frei",
          lung: "beidseits belüftet",
          abdomen: "weich",
          skin: "Schürfwunden Knie re., kleine venöse Blutung Unterarm re.",
          ekg3: "Sinus 100/min",
          befast: "unauffällig",
          lkw: "nicht relevant",
          pain: { nrs: 6 },
          injuries: [
            { kind:"bleeding", location:"Unterarm rechts", severity:2, vessel:"venös", controlled:false },
            { kind:"fracture", location:"Unterarm rechts", open:false },
            { kind:"abrasion", location:"Knie rechts" }
          ],
          nexus: { positive: false, criteria: ["kein Mittellinienschmerz", "keine fokal-neuro. Defizite", "wach & nüchtern"] }
        }
      }),
      paediatrisch: () => ({
        id: "rs_paed_01",
        specialty: "pädiatrisch",
        role,
        story: "5-jähriges Kind, Fieber und Husten seit 2 Tagen, heute erschöpft.",
        target_outcome: "ABCDE, Fiebermanagement, O₂ bei Bedarf, Transport nach Beurteilung.",
        key_findings: ["Fieber", "Husten", "müde"],
        red_flags: ["Einziehungen", "Zyanose", "Apathie"],
        vitals: { RR: "110/70", SpO2: 94, AF: 30, Puls: 130, BZ: 90, Temp: 38.9, GCS: 15 },
        anamnesis: {
          SAMPLER: { S: "Fieber, Husten", A: "keine", M: "Ibuprofen Saft", P: "Infekt", L: "keine",
                     E: "Kita-Ausbruch", R: "nein" },
          vorerkrankungen: [], medikation: ["Ibuprofen Saft"], allergien: [], antikoagulation: false
        },
        hidden: {
          pupils: "isokor, prompt",
          mouth: "geröteter Rachen",
          lung: "RG basal, leichte Einziehungen",
          abdomen: "weich",
          skin: "warm, gerötet",
          ekg12: "Sinus 120/min",
          befast: "nicht relevant",
          lkw: "nicht relevant",
          pain: { nrs: 3 },
          injuries: []
        }
      })
    };

    const pick = cases[specialty] || cases["internistisch"];
    let c = pick();
    c = ensureExamDefaults(c);

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*"
      },
      body: JSON.stringify(c)
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

function ensureExamDefaults(c){
  c.anamnesis = c.anamnesis || {};
  c.hidden = c.hidden || {};
  c.hidden.vitals_baseline = c.hidden.vitals_baseline || { RR:"120/80", SpO2:96, AF:16, Puls:80, BZ:110, Temp:36.8, GCS:15 };
  c.hidden.pupils  = c.hidden.pupils  || "isokor, mittelweit, prompt";
  c.hidden.mouth   = c.hidden.mouth   || "Mund-/Rachenraum frei, kein Erbrochenes";
  c.hidden.lung    = c.hidden.lung    || "vesikuläres Atemgeräusch beidseits, keine RG";
  c.hidden.abdomen = c.hidden.abdomen || "weich, kein Abwehrspannungsbefund";
  c.hidden.skin    = c.hidden.skin    || "warm, rosig, keine Auffälligkeiten";
  c.hidden.ekg3    = c.hidden.ekg3    || "Sinusrhythmus, keine akuten Auffälligkeiten";
  c.hidden.ekg12   = c.hidden.ekg12   || "Sinus, ohne Ischämiezeichen";
  c.hidden.befast  = c.hidden.befast  || "ohne Auffälligkeiten";
  c.hidden.lkw     = c.hidden.lkw     || "nicht ermittelbar";
  c.hidden.pain = c.hidden.pain || { nrs: 0 };
  c.hidden.injuries = Array.isArray(c.hidden.injuries) ? c.hidden.injuries : [];
  return c;
}
