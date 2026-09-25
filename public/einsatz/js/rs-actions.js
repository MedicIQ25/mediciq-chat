// ==========================================================================================
// medicIQ – Einsatz-Simulator Rettungssanitäter: Maßnahmenkatalog & Konstanten
// ==========================================================================================
// Abgeleitet vom Notfallsanitäter-Einsatzsimulator (medicIQ-notsan-engine, js/script.js). Diese
// RS-Version ist eine eigenständige Kopie - Änderungen hier wirken sich NICHT auf den NotSan-
// Simulator aus (und umgekehrt).
//
// Maßnahmen-Felder (wie im NotSan-Simulator):
//   token           interner Schlüssel (Befundtexte in rs-cases.js hängen daran)
//   time            Dauer in Sekunden (Fortschrittsbalken)
//   needsMaterial   öffnet "Material richten" mit der Liste mat
//   targets         Auswahl des Anlageorts (Tourniquet, Schiene ...)
//   needsUpperSkin / needsLowerSkin   nur möglich, wenn Oberkörper/Beine entkleidet sind
//   toggleable + activeFlag            Maßnahme kann wieder beendet werden (z.B. Sauerstoff)
//   therapy         zählt als "Handlung" für die SINNHAFT-Übergabe (Schritt H)
// ==========================================================================================

// Bilder/Töne liegen komprimiert im eigenen Ordner (public/einsatz/assets). Über window.RS_ASSET_BASE
// kann der Pfad bei Bedarf überschrieben werden (z.B. für ein CDN).
const RS_ASSET_BASE = (typeof window !== 'undefined' && window.RS_ASSET_BASE) || 'assets/';
function asset(file) { return RS_ASSET_BASE + file; }

const ACTIONS = {
    ANAMNESE: [
        { label: '4S-Erkundung durchführen', token: '4s_check', time: 0 },
        { label: 'Schutzausrüstung anlegen (Handschuhe, FFP2, Brille, Kittel)', token: 'psa', time: 3 },
        { label: 'Oberkörper entkleiden', token: 'entkleiden_oben', time: 4 },
        { label: 'Hose entfernen', token: 'entkleiden_unten', time: 4 },
        { label: 'SAMPLER-Anamnese', token: 'SAMPLER' },
        { label: 'OPQRST (Schmerzanamnese)', token: 'OPQRST', time: 3 },
        { label: 'Schmerzskala (NRS)', token: 'NRS', time: 2 },
        { label: 'qSOFA (Sepsis-Screening)', token: 'qsofa', time: 0 },
        { label: 'Patient betreuen / beruhigen', token: 'betreuung', time: 5, therapy: true },
        { label: 'Asservate sichern (Tabletten, Behälter)', token: 'asservate', time: 3, therapy: true },
        { label: '🚑 Notarzt nachfordern', token: 'call_nef', time: 2 },
        { label: '🚒 Feuerwehr nachfordern', token: 'call_fw', time: 2 },
        { label: '🚓 Polizei nachfordern', token: 'call_pol', time: 2 },
        { label: 'In den RTW verlegen', token: 'toggle_rtw', time: 3, toggleable: true, activeFlag: 'inRTW', therapy: true }
    ],
    X: [
        { label: 'Kritische Blutungen suchen', token: 'X-Check', needsUpperSkin: true, needsLowerSkin: true },
        { label: 'Blutungsräume abtasten', token: 'blutungsraeume', time: 0, needsUpperSkin: true, needsLowerSkin: true },
        { label: 'Druckverband anlegen', token: 'druckverband', needsMaterial: true, mat: ['Verbandpäckchen', 'Druckpolster', 'Mullbinde'], time: 5, therapy: true,
          targets: [{ v: 'rechts-unterarm', l: 'Rechter Unterarm' }, { v: 'links-unterarm', l: 'Linker Unterarm' }, { v: 'kopf', l: 'Kopf (Kopfschwarte)' }] },
        { label: 'Tourniquet anlegen', token: 'tourniquet', needsMaterial: true, mat: ['Tourniquet'], time: 4, therapy: true,
          targets: [{ v: 'links-arm', l: 'Linker Arm' }, { v: 'rechts-arm', l: 'Rechter Arm' }, { v: 'links-bein', l: 'Linkes Bein' }, { v: 'rechts-bein', l: 'Rechtes Bein' }] },
        { label: 'Nasenbluten versorgen', token: 'nasenbluten', time: 4, therapy: true },
        { label: 'Fremdkörper stabilisieren (umpolstern)', token: 'fremdk_stabi', needsMaterial: true, mat: ['Verbandpäckchen', 'Polstermaterial', 'Fixierbinde'], time: 6, therapy: true },
        { label: 'Fremdkörper herausziehen', token: 'fremdk_raus', time: 2 }
    ],
    A: [
        { label: 'Mundraum inspizieren', token: 'mundraum', time: 0 },
        { label: 'Esmarch-Handgriff / Kopf überstrecken', token: 'esmarch', time: 2, therapy: true },
        { label: 'Manuelle HWS-Stabilisierung', token: 'man_hws', time: 2, therapy: true },
        { label: 'Zum Husten ermutigen', token: 'husten_ermutigen', time: 3, therapy: true },
        { label: 'Rückenschläge / Heimlich-Manöver', token: 'fremdkoerper_manoever', time: 4, therapy: true },
        { label: 'Guedel-Tubus einlegen', token: 'guedel', needsMaterial: true, mat: ['Guedel-Tubus (passende Größe)'], time: 4, therapy: true },
        { label: 'Wendl-Tubus einlegen', token: 'wendel', needsMaterial: true, mat: ['Wendl-Tubus', 'Gleitgel'], time: 4, therapy: true }
    ],
    B: [
        { label: 'Atemfrequenz zählen', token: 'AF_zählen', time: 0 },
        { label: 'Thorax inspizieren', token: 'Thorax_insp', time: 3, needsUpperSkin: true },
        { label: 'Lunge auskultieren', token: 'Lunge', time: 4, needsUpperSkin: true },
        { label: 'Pulsoxymetrie (SpO₂)', token: 'spo2_clip', needsMaterial: true, mat: ['SpO₂-Sensor'], time: 3 },
        { label: 'Oberkörperhochlagerung', token: 'okh', time: 2, therapy: true },
        { label: 'Sauerstoffgabe', token: 'o2_modal', toggleable: true, activeFlag: 'o2Active', therapy: true },
        { label: 'Beutel-Masken-Beatmung', token: 'bvm', needsMaterial: true, mat: ['Beatmungsbeutel', 'Maske (passende Größe)', 'Sauerstoff'], time: 5, toggleable: true, activeFlag: 'bvm', therapy: true },
        { label: 'Atemtechnik anleiten (Lippenbremse, Kutschersitz)', token: 'atemtechnik', time: 4, therapy: true },
        { label: 'Kalte, feuchte Luft (Fenster öffnen)', token: 'kaltluft', time: 3, therapy: true },
        { label: 'Chest Seal (Ventilverband) kleben', token: 'chest_seal', needsMaterial: true, mat: ['Chest Seal mit Ventil', 'Kompresse'], time: 5, needsUpperSkin: true, therapy: true }
    ],
    C: [
        { label: 'Puls tasten', token: 'puls', time: 3 },
        { label: 'Rekapillarisierungszeit (CRT)', token: 'recap', time: 2 },
        { label: 'Hautstatus (Farbe, Temperatur)', token: 'hautstatus', time: 2 },
        { label: 'Blutdruck messen', token: 'RR_Measure', needsMaterial: true, mat: ['RR-Manschette', 'Stethoskop'], time: 10, needsUpperSkin: true },
        { label: 'Blutdruck an beiden Armen messen', token: 'rr_beidseits', needsMaterial: true, mat: ['RR-Manschette', 'Stethoskop'], time: 15, needsUpperSkin: true },
        { label: 'EKG-Monitoring anlegen', token: 'ekg_monitor', needsMaterial: true, mat: ['EKG-Kabel', 'Elektroden'], time: 5, needsUpperSkin: true },
        { label: '12-Kanal-EKG schreiben & übermitteln', token: 'ekg', needsMaterial: true, mat: ['EKG-Kabel', 'Elektroden (10 Stück)'], time: 15, needsUpperSkin: true },
        { label: 'Schocklage (Beine hoch)', token: 'schocklage', time: 2, therapy: true },
        { label: 'Flach lagern', token: 'flach', time: 2, therapy: true },
        { label: 'Bauchdecke entlasten (Knierolle)', token: 'knierolle', time: 2, therapy: true },
        { label: 'Zugang & Infusion für NA vorbereiten', token: 'iv_vorbereiten', needsMaterial: true, mat: ['Venenverweilkanüle', 'Stauschlauch', 'Desinfektion', 'Vollelektrolytlösung + Infusionssystem'], time: 10, therapy: true },
        { label: 'Zu trinken geben', token: 'trinken', time: 4, therapy: true }
    ],
    D: [
        { label: 'Pupillen prüfen', token: 'Neuro', time: 2 },
        { label: 'GCS erheben', token: 'gcs', time: 2 },
        { label: 'BE-FAST-Test', token: 'befast', time: 0 },
        { label: 'Blutzucker messen', token: 'BZ', needsMaterial: true, mat: ['BZ-Messgerät', 'Lanzette', 'Teststreifen'], time: 8 },
        { label: 'DMS (Durchblutung, Motorik, Sensibilität)', token: 'dms', time: 4 },
        { label: 'Meningismus prüfen', token: 'meningismus', time: 3 },
        { label: 'Stabile Seitenlage', token: 'ssl', time: 3, therapy: true },
        { label: 'Glukose oral geben', token: 'glukose_oral', needsMaterial: true, mat: ['Glukose-Gel / Traubenzucker / Saft'], time: 4, therapy: true },
        { label: 'Vor Verletzungen schützen (Krampfanfall)', token: 'schutz_krampf', time: 3, therapy: true }
    ],
    E: [
        { label: 'Bodycheck (Ganzkörperuntersuchung)', token: 'bodycheck', time: 12 },
        { label: 'Abdomen abtasten', token: 'abdomen', time: 4, needsUpperSkin: true },
        { label: 'Temperatur messen', token: 'temperatur', time: 3 },
        { label: 'Wärmeerhalt (Decke)', token: 'waerme', needsMaterial: true, mat: ['Rettungsdecke / Wolldecke'], time: 4, therapy: true },
        { label: 'Kühlen', token: 'kuehlung', needsMaterial: true, mat: ['Kühlpack / feuchte Tücher', 'Polsterung'], time: 5, therapy: true },
        { label: 'Wunde steril versorgen', token: 'wund_sek', needsMaterial: true, mat: ['Sterile Kompressen', 'Verbandmaterial'], time: 8, therapy: true },
        { label: 'Brandwunden steril abdecken', token: 'brandwunde', needsMaterial: true, mat: ['Brandwundenverbandtuch (z.B. Metalline)'], time: 6, therapy: true },
        { label: 'Spülen (Haut / Mund)', token: 'spuelen', needsMaterial: true, mat: ['Reichlich Wasser / Spüllösung'], time: 10, therapy: true },
        { label: 'Augen abdecken', token: 'augen', needsMaterial: true, mat: ['Sterile Augenkompressen', 'Pflaster'], time: 4, therapy: true },
        { label: 'Amputat sichern', token: 'amputat', needsMaterial: true, mat: ['Sterile Kompresse', 'Replantatbeutel', 'Kühlbeutel'], time: 5, therapy: true },
        { label: 'Vakuumschiene anlegen', token: 'schiene', needsMaterial: true, mat: ['Vakuumschiene', 'Absaugpumpe'], time: 10, therapy: true,
          targets: [{ v: 'arm-rechts', l: 'Rechter Arm' }, { v: 'arm-links', l: 'Linker Arm' }, { v: 'bein-rechts', l: 'Rechtes Bein' }, { v: 'bein-links', l: 'Linkes Bein' }] },
        { label: 'Alu-Polsterschiene (SAM-Splint)', token: 'alu_schiene', needsMaterial: true, mat: ['Alu-Polsterschiene', 'Fixierbinde'], time: 8, therapy: true,
          targets: [{ v: 'arm-rechts', l: 'Rechter Arm' }, { v: 'arm-links', l: 'Linker Arm' }, { v: 'bein-rechts', l: 'Rechtes Bein' }, { v: 'bein-links', l: 'Linkes Bein' }] },
        { label: 'In vorgefundener Stellung polstern', token: 'polstern', needsMaterial: true, mat: ['Polstermaterial / Decken'], time: 5, therapy: true }
    ],
    TRAUMA: [
        { label: 'NEXUS-Kriterien prüfen', token: 'NEXUS', time: 3 },
        { label: 'HWS-Immobilisation (Stifneck)', token: 'hws', needsMaterial: true, mat: ['Zervikalstütze (passende Größe)'], time: 6, therapy: true },
        { label: 'Helmabnahme (zu zweit)', token: 'helm', time: 6, therapy: true },
        { label: 'Beckenschlinge anlegen', token: 'beckenschlinge', needsMaterial: true, mat: ['Beckenschlinge'], time: 10, therapy: true },
        { label: 'Vakuummatratze', token: 'vakuum', needsMaterial: true, mat: ['Vakuummatratze', 'Absaugpumpe', 'Schaufeltrage'], time: 20, therapy: true }
    ],
    HANDOVER: [{ label: 'Übergabe nach SINNHAFT', token: 'handover_start' }]
};

// Maßnahmen, die nur im Kreislaufstillstand über das REA-Panel laufen (AED-Pads).
const REA_ACTIONS = {
    pads: { label: 'AED-Pads kleben', token: 'pads', needsMaterial: true, mat: ['AED-Pads (Erwachsene/Kinder)', 'Rasierer'], time: 6, needsUpperSkin: false }
};

// Beschriftung eines Tokens für Auswertung/SINNHAFT (erste passende Maßnahme im Katalog).
function actionLabel(token) {
    if (token === 'o2_applied' || token === 'o2_modal') return 'Sauerstoffgabe';
    if (token === 'befast_time') return 'Symptombeginn erfragt (BE-FAST „T“)';
    if (token === 'pads') return REA_ACTIONS.pads.label;
    for (const list of Object.values(ACTIONS)) {
        const a = list.find(x => x.token === token);
        if (a) return a.label.replace(/^[^\wÄÖÜäöü(]+\s*/, '');
    }
    return token;
}

const CATEGORY_NAMES = { intern: 'Internistisch', neuro: 'Neurologisch', trauma: 'Trauma', paed: 'Pädiatrie' };

// Einsatzort-Hintergründe (WebP, siehe assets/).
const SCENE_BACKGROUNDS = {
    wohnzimmer: 'hintergrund-wohnzimmer.webp', strasse: 'hintergrund-strasse.webp', schlafzimmer: 'hintergrund-schlafzimmer.webp',
    pflegeheim: 'hintergrund-pflegeheim.webp', bad: 'hintergrund-bad.webp', wartezimmer: 'hintergrund-wartezimmer.webp',
    verkehrsunfall: 'hintergrund-verkehrsunfall.webp', baustelle: 'hintergrund-baustelle.webp', kueche: 'hintergrund-kueche.webp',
    garten: 'hintergrund-garten.webp', sport: 'hintergrund-sport.webp', wald: 'hintergrund-wald.webp', bar: 'hintergrund-bar.webp',
    gleise: 'hintergrund-gleise.webp', skaterpark: 'hintergrund-skatepark.webp', reitstall: 'hintergrund-reitstall.webp'
};
const RTW_BACKGROUND_FILE = 'hintergrund-rtw.webp';

const SINNHAFT_ENV_LABELS = {
    home: "Häuslicher Bereich (Wohnung/Zuhause)",
    street: "Straße / öffentlicher Verkehrsraum",
    factory: "Betriebs-/Werksgelände",
    club: "Freizeiteinrichtung (Club/Bar)",
    traffic: "Verkehrsunfallstelle",
    work: "Arbeitsplatz/Baustelle",
    public: "Öffentliche Einrichtung/Sportstätte",
    nature: "Freigelände/Natur"
};
const SINNHAFT_ENV_VALUES = Object.keys(SINNHAFT_ENV_LABELS);

// Umgebungsgeräusch je env (fehlende Einträge = kein Umgebungsgeräusch).
const AMBIENT_FILES = { home: 'ambient_home.mp3', street: 'ambient_street.mp3', traffic: 'ambient_traffic.mp3', club: 'ambient_club.mp3', factory: 'ambient_factory.mp3', work: 'ambient_factory.mp3', public: 'ambient_home.mp3' };

// Zeit bis zum Eintreffen des Notarztes nach der Nachforderung (Millisekunden). Für Tests über
// window.RS_NA_DELAY_MS überschreibbar.
const NA_DELAY_MS = (typeof window !== 'undefined' && window.RS_NA_DELAY_MS) || 150000;
