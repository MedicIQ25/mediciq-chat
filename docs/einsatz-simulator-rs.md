# Einsatz-Simulator Rettungssanitäter

Der neue RS-Simulator liegt unter `public/einsatz/` und ist nach dem Deploy unter
`https://ornate-chimera-b77016.netlify.app/einsatz/` erreichbar. Der bisherige Fallbeispiel-Simulator
(`public/index.html`) bleibt unverändert unter `/` erreichbar, bis du in Webflow umstellst.

## Verhältnis zum NotSan-Simulator

Der RS-Simulator ist eine **eigenständige Kopie** der Einsatz-Engine des Notfallsanitäter-Simulators
(Repo `medicIQ-notsan-engine`). Im NotSan-Repo wurde **nichts** geändert. Bilder und Töne liegen als
eigene, komprimierte Kopien in `public/einsatz/assets/` (WebP statt PNG: ca. 2 MB statt 337 MB).
Änderungen am RS-Simulator wirken sich deshalb nie auf den NotSan-Simulator aus – und umgekehrt.

## Dateien

| Datei | Inhalt |
|---|---|
| `public/einsatz/index.html` | Seite: Patient, Monitor, Patientenakte, Maßnahmen-Tabs, Untersuchungsfenster |
| `public/einsatz/style.css` | Optik (wie NotSan) plus Smartphone-Layout |
| `public/einsatz/js/rs-actions.js` | **Maßnahmenkatalog** (nur RS-Kompetenz) und Konstanten |
| `public/einsatz/js/rs-cases.js` | **85 Fälle** (Internistisch 20, Neurologisch 20, Trauma 25, Pädiatrie 20) |
| `public/einsatz/js/rs-engine.js` | Ablauf, Vitalwerte-Verlauf, Notarzt, AED-Reanimation, Bewertung, SINNHAFT |
| `public/einsatz/js/rs-ui.js` | Monitor-Kurven, Töne, interaktive Untersuchungen, PDF-Protokoll |
| `public/einsatz/rs-result-handler.js` | Speichert Ergebnisse in Memberstack (für die Webflow-Seite) |

## Was ist anders als beim NotSan-Simulator?

- **Maßnahmen:** keine Medikamente, kein i.v./i.o., keine Intubation/SGA, kein CPAP, keine
  Thoraxentlastung. Dafür RS-Maßnahmen wie Notarzt-/Feuerwehr-/Polizei-Nachforderung,
  Schutzausrüstung, Esmarch, Rückenschläge/Heimlich, Zum-Husten-Ermutigen, Chest Seal,
  Atemtechnik, kalte Luft (Pseudokrupp), Puls tasten, RR beidseits, EKG-Monitoring,
  12-Kanal-EKG schreiben & übermitteln, Zugang/Infusion **für den NA vorbereiten**, Glukose oral
  (nur wach & schluckfähig), Meningismus, qSOFA, Kühlen, Spülen, Augen abdecken, Amputat sichern,
  Polstern in vorgefundener Stellung, Helmabnahme u.a.
- **Notarzt:** Die Nachforderung ist ein zentraler Bewertungspunkt. Nach ca. 2,5 Minuten trifft der
  Notarzt ein, übernimmt fallabhängig die ärztliche Therapie (z.B. Glukose i.v., Naloxon,
  Entlastungspunktion, Analgesie) und der Patient stabilisiert sich.
- **Reanimation:** mit AED (Pads kleben, Analyse, Schock nur wenn empfohlen), Herzdruckmassage
  und Beatmung selbst oder durch den Helfer; bei Kindern Hinweis auf 5 initiale Beatmungen/15:2.
- **Pädiatrie** als eigene Kategorie.
- **Bewertung:** xABCDE-Teilnoten wie beim NotSan-Simulator, dazu fallentscheidende RS-Maßnahmen
  und Kontraindikationen je Fall, Verdachtsdiagnose, Zielklinik und Notarzt-Indikation.
  Die Auswertung zeigt zusätzlich die **Musterlösung** des Falls.

## Einbau in Webflow

1. Branch mergen und von Netlify deployen lassen.
2. Auf der Webflow-Seite `/fallbeispiele` (RS) den Code des bisherigen Code-Embeds durch diesen
   Code ersetzen und die Seite veröffentlichen:

```html
<div class="mq-rs-frame" style="background-color:#1e2327; width:100%; height:100dvh; display:flex; overflow:hidden;">
  <iframe id="mq-rs-iframe" src="https://ornate-chimera-b77016.netlify.app/einsatz/"
          title="medicIQ Einsatz-Simulator Rettungssanitäter" allow="autoplay"
          style="width:100%; height:100%; border:none; background-color:#1e2327;"></iframe>
</div>
<style>
  /* Nur dieses Embed und sein Container - NICHT global .w-embed: Kopf- und Fußleiste sind ebenfalls
     Code-Embeds und würden sonst bildschirmhoch über dem Simulator liegen. */
  .w-embed:has(> .mq-rs-frame) { height: 100dvh !important; }
  .w-container:has(.mq-rs-frame) { max-width: none !important; width: 100% !important; padding: 0 !important; }
</style>
<script src="https://ornate-chimera-b77016.netlify.app/einsatz/rs-result-handler.js"></script>
```

3. `rs-result-handler.js` akzeptiert Ergebnisse von `https://ornate-chimera-b77016.netlify.app`
   und aus jedem eingebetteten `/einsatz/`-iFrame der Seite.

### Zurück zum alten Simulator

Der alte Fallbeispiel-Simulator bleibt unter `https://ornate-chimera-b77016.netlify.app/` erhalten.
Zum Zurückstellen im Code-Embed der Webflow-Seite `/fallbeispiele` wieder diesen Code eintragen
und die Seite veröffentlichen:

```html
<iframe 
  id="ekgFrame"
  src="https://ornate-chimera-b77016.netlify.app?v=3" 
  style="width: 100%; border:none; min-height:800px; transition: height 0.3s;" 
  scrolling="no">
</iframe>

<script>
  window.addEventListener('message', function(e) {
    if (e.data.type === 'setHeight') {
      const frame = document.getElementById('ekgFrame');
      if(frame) frame.style.height = e.data.height + 'px';
    }
  }, false);
</script>
```

## Ergebnisse im Dashboard

Nach jedem Einsatz sendet der Simulator `postMessage({ typ: 'RS_SIMULATOR_ERGEBNIS', ergebnisse })`
an die Webflow-Seite. `rs-result-handler.js` speichert das im Member-JSON unter **`simulatorRS`**
(eigener Schlüssel, die NotSan-Daten unter `simulator` bleiben unberührt):
`faelle`, Prozentwerte `x`–`e` und `gesamt` (letzte 100), `verlauf` (letzte 50 Einsätze mit Fall,
Diagnose, Ergebnis, Dauer) und `fehlerLog` (letzte 5). Soll das RS-Dashboard diese Werte anzeigen,
genügen Elemente mit den IDs `rs-sim-faelle`, `rs-sim-gesamt`, `rs-val-x` … `rs-val-e`
(und optional `rs-bar-x` … `rs-bar-e` als Balken) – sie werden automatisch befüllt.

## Fälle bearbeiten

Alle Fälle stehen lesbar in `public/einsatz/js/rs-cases.js` (Kopfkommentar erklärt die Felder).
Direktstart eines bestimmten Falls zum Testen oder für den Unterricht:
`https://ornate-chimera-b77016.netlify.app/einsatz/?fall=rs_stroke_01`

Kinder-Fälle zeigen eine eigene Kinder-Illustration; die Ebenen (Sauerstoffmaske, Schienen …)
gibt es bisher nur für den Erwachsenen-Körper. Die Maßnahmen erscheinen bei Kindern daher nur in
der Patientenakte.
