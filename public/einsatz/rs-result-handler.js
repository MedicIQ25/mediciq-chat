(function () {
    // ======================================================================================
    // medicIQ – Ergebnis-Speicherung für den Einsatz-Simulator Rettungssanitäter
    // ======================================================================================
    // Wird auf der Webflow-Seite eingebunden, auf der der RS-Simulator als iFrame läuft
    // (siehe docs/einsatz-simulator-rs.md). Empfängt die Nachricht "RS_SIMULATOR_ERGEBNIS"
    // aus dem Simulator und speichert sie in Memberstack unter dem EIGENEN Schlüssel
    // "simulatorRS" - die NotSan-Statistik ("simulator") wird dadurch nie verändert.
    //
    // Gespeichertes Format (Member-JSON):
    //   simulatorRS = {
    //     faelle: Anzahl,
    //     x/a/b/c/d/e/gesamt: [Prozentwerte der letzten 100 Einsätze],
    //     verlauf: [{ datum, fallId, kategorie, diagnose, gesamt, dauerSekunden }]  (letzte 50),
    //     fehlerLog: [{ datum, fehler: [...] }]                                     (letzte 5)
    //   }
    //
    // Optionale Anzeige: Elemente mit den IDs #rs-sim-faelle, #rs-sim-gesamt, #rs-val-x ... #rs-val-e
    // und #rs-bar-x ... #rs-bar-e werden automatisch befüllt, falls vorhanden.
    // ======================================================================================

    // Absender, denen vertraut wird: die Site(s), auf denen /einsatz/ ausgeliefert wird. Zusätzlich
    // wird jede Nachricht akzeptiert, die nachweislich aus einem iFrame dieser Seite stammt, dessen
    // Adresse "/einsatz" enthält - so funktioniert es auch ohne gepflegte Liste.
    const ALLOWED_ORIGINS = ['https://ornate-chimera-b77016.netlify.app', window.location.origin];

    const $ = (s) => document.querySelector(s);
    const avg = (arr) => arr && arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    function updateRSSimulatorUI(sim) {
        if (!sim || !sim.faelle) return;
        if ($('#rs-sim-faelle')) $('#rs-sim-faelle').textContent = sim.faelle;
        if ($('#rs-sim-gesamt')) $('#rs-sim-gesamt').textContent = avg(sim.gesamt) + '%';
        ['x', 'a', 'b', 'c', 'd', 'e'].forEach(l => {
            const v = avg(sim[l]);
            if ($('#rs-val-' + l)) $('#rs-val-' + l).textContent = v + '%';
            if ($('#rs-bar-' + l)) $('#rs-bar-' + l).style.width = v + '%';
        });
    }
    window.updateRSSimulatorUI = updateRSSimulatorUI;

    function fromTrustedSource(event) {
        if (ALLOWED_ORIGINS.includes(event.origin)) return true;
        return Array.from(document.querySelectorAll('iframe')).some(f => f.contentWindow === event.source && (f.src || '').indexOf(event.origin) === 0 && (f.src || '').includes('/einsatz'));
    }

    const clampPct = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

    window.addEventListener('message', async function (event) {
        if (!event.data || event.data.typ !== 'RS_SIMULATOR_ERGEBNIS') return;
        if (!fromTrustedSource(event)) return;
        const r = event.data.ergebnisse || {};

        const ms = window.$memberstackDom || window.MemberStack;
        if (!ms) return;
        try {
            const current = await ms.getCurrentMember();
            const member = current && (current.data || current);
            if (!member || !member.id) return;
            const res = await ms.getMemberJSON(member.id);
            const all = (res && res.data) || {};
            const sim = all.simulatorRS || {};
            sim.faelle = (sim.faelle || 0) + 1;
            ['x', 'a', 'b', 'c', 'd', 'e', 'gesamt'].forEach(k => {
                if (!Array.isArray(sim[k])) sim[k] = [];
                sim[k].push(clampPct(r[k]));
                if (sim[k].length > 100) sim[k].shift();
            });
            if (!Array.isArray(sim.verlauf)) sim.verlauf = [];
            sim.verlauf.unshift({
                datum: new Date().toISOString(),
                fallId: String(r.fallId || '').slice(0, 60),
                kategorie: String(r.kategorie || '').slice(0, 20),
                diagnose: String(r.diagnose || '').slice(0, 120),
                gesamt: clampPct(r.gesamt),
                dauerSekunden: Math.max(0, Math.round(Number(r.dauerSekunden) || 0))
            });
            if (sim.verlauf.length > 50) sim.verlauf.length = 50;
            if (!Array.isArray(sim.fehlerLog)) sim.fehlerLog = [];
            if (Array.isArray(r.fehlerLog)) {
                sim.fehlerLog.unshift({ datum: new Date().toISOString(), fehler: r.fehlerLog.slice(0, 40).map(t => String(t).slice(0, 300)) });
                if (sim.fehlerLog.length > 5) sim.fehlerLog.length = 5;
            }
            all.simulatorRS = sim;
            await ms.updateMemberJSON({ json: all });
            updateRSSimulatorUI(sim);
        } catch (e) {
            console.error('RS-Simulator: Ergebnis konnte nicht gespeichert werden:', e);
        }
    });
})();
