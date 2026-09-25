(function () {
    // ======================================================================================
    // medicIQ – Anzeige der Einsatz-Simulator-Ergebnisse im RS-Dashboard (/dashboard)
    // ======================================================================================
    // Wird im Code-Embed des RS-Dashboards per <script src> eingebunden. Liest den Memberstack-
    // Schlüssel "simulatorRS" (geschrieben von rs-result-handler.js) und setzt ein eigenes Panel
    // "Einsatz-Simulator" oben in die Hauptspalte (#mq-dashboard .mq-col-main).
    // Fehlt das Dashboard oder Memberstack, passiert nichts - die Seite bleibt wie sie ist.
    // ======================================================================================
    if (window.__mqSimDashboard) return;
    window.__mqSimDashboard = true;

    const SIM_URL = '/fallbeispiele';
    const PASS_SCORE = 50; // ab "Ausreichend" gilt ein Einsatz als bestanden (wie im Simulator)
    const LETTERS = [
        { k: 'x', l: 'X', name: 'Kritische Blutung' },
        { k: 'a', l: 'A', name: 'Atemweg' },
        { k: 'b', l: 'B', name: 'Atmung' },
        { k: 'c', l: 'C', name: 'Kreislauf' },
        { k: 'd', l: 'D', name: 'Neurologie' },
        { k: 'e', l: 'E', name: 'Erweiterte Untersuchung' }
    ];
    const CATEGORY = { intern: 'Internistisch', neuro: 'Neurologisch', trauma: 'Trauma', paed: 'Pädiatrie' };

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const nums = (a) => (Array.isArray(a) ? a : []).map(Number).filter(v => isFinite(v));
    const avg = (a) => { const v = nums(a); return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null; };
    const tone = (v) => v >= 75 ? 'gut' : v >= 50 ? 'mittel' : 'schwach';

    function waitFor(test, timeoutMs) {
        return new Promise(resolve => {
            const t0 = Date.now();
            (function check() {
                let val = null;
                try { val = test(); } catch (e) { val = null; }
                if (val) return resolve(val);
                if (Date.now() - t0 > timeoutMs) return resolve(null);
                setTimeout(check, 150);
            })();
        });
    }

    async function loadSimData() {
        const ms = window.$memberstackDom || window.MemberStack || window.$memberstack;
        if (!ms) return null;
        const current = await ms.getCurrentMember();
        const member = current && (current.data || current);
        if (!member || !member.id) return null;
        const res = await ms.getMemberJSON(member.id);
        const all = (res && res.data) || {};
        return all.simulatorRS || {};
    }

    function injectStyle() {
        if (document.getElementById('mqsim-style')) return;
        const st = document.createElement('style');
        st.id = 'mqsim-style';
        st.textContent = `
        .mqsim-panel .mq-panel-head { gap: 10px; flex-wrap: wrap; }
        .mqsim-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
        .mqsim-kpi { border: 1px solid var(--border, #e2e8f0); border-radius: 14px; padding: 12px 14px; background: rgba(255,255,255,.7); }
        .mqsim-kpi strong { display: block; font-size: 1.35rem; line-height: 1.1; color: var(--text, #0f172a); }
        .mqsim-kpi small { display: block; margin-top: 4px; font-size: .72rem; text-transform: uppercase; letter-spacing: .03em; color: var(--text-light, #64748b); }
        .mqsim-rows { display: flex; flex-direction: column; gap: 9px; }
        .mqsim-row { display: grid; grid-template-columns: 26px minmax(0, 190px) 1fr 44px; align-items: center; gap: 10px; font-size: .86rem; }
        .mqsim-letter { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; font-weight: 800; font-size: .8rem; background: var(--primary-light, #ccfbf1); color: var(--primary, #0f766e); }
        .mqsim-name { color: var(--text, #0f172a); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mqsim-track { height: 8px; border-radius: 999px; background: #eef2f1; overflow: hidden; }
        .mqsim-track > i { display: block; height: 100%; border-radius: 999px; min-width: 6px; transition: width .8s ease; }
        .mqsim-val { text-align: right; font-weight: 800; }
        .mqsim-track.mqsim-gut > i { background: var(--c-green, #10b981); }
        .mqsim-track.mqsim-mittel > i { background: var(--c-orange, #f97316); }
        .mqsim-track.mqsim-schwach > i { background: var(--c-red, #ef4444); }
        .mqsim-val.mqsim-gut { color: var(--c-green, #10b981); }
        .mqsim-val.mqsim-mittel { color: var(--c-orange, #f97316); }
        .mqsim-val.mqsim-schwach { color: var(--c-red, #ef4444); }
        .mqsim-hint { margin: 16px 0 0; padding: 10px 12px; border-radius: 12px; background: var(--primary-light, #ccfbf1); color: var(--text, #0f172a); font-size: .86rem; line-height: 1.45; }
        .mqsim-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
        .mqsim-cols h4 { margin: 0 0 10px; font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; color: var(--text-light, #64748b); }
        .mqsim-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .mqsim-list li { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: .85rem; color: var(--text, #0f172a); padding-bottom: 8px; border-bottom: 1px solid #f1f5f9; }
        .mqsim-list li:last-child { border-bottom: 0; padding-bottom: 0; }
        .mqsim-list .mqsim-meta { display: block; font-size: .74rem; color: var(--text-light, #64748b); margin-top: 2px; }
        .mqsim-pill { flex: 0 0 auto; border-radius: 999px; padding: 2px 9px; font-size: .78rem; font-weight: 800; color: #fff; }
        .mqsim-pill.mqsim-gut { background: var(--c-green, #10b981); }
        .mqsim-pill.mqsim-mittel { background: var(--c-orange, #f97316); }
        .mqsim-pill.mqsim-schwach { background: var(--c-red, #ef4444); }
        .mqsim-count { flex: 0 0 auto; font-size: .75rem; font-weight: 700; color: var(--text-light, #64748b); }
        .mqsim-empty-note { font-size: .85rem; color: var(--text-light, #64748b); font-style: italic; }
        .mqsim-btn { display: inline-flex; align-items: center; justify-content: center; margin-top: 20px; min-height: 44px; padding: 0 18px; border-radius: 12px; background: var(--primary, #0f766e); color: #fff !important; font-weight: 700; font-size: .9rem; text-decoration: none !important; }
        .mqsim-btn:hover { filter: brightness(1.08); }
        .mqsim-empty { text-align: center; padding: 6px 0 2px; }
        .mqsim-empty p { margin: 0; color: var(--text-light, #64748b); font-size: .9rem; line-height: 1.5; }
        @media (max-width: 800px) {
            .mqsim-cols { grid-template-columns: 1fr; }
            .mqsim-row { grid-template-columns: 26px 1fr 44px; }
            .mqsim-row .mqsim-track { grid-column: 1 / -1; order: 4; }
        }
        @media (max-width: 420px) { .mqsim-kpis { gap: 8px; } .mqsim-kpi { padding: 10px; } .mqsim-kpi strong { font-size: 1.1rem; } .mqsim-kpi small { font-size: .64rem; } }`;
        document.head.appendChild(st);
    }

    function frequentErrors(sim) {
        const counts = new Map();
        (Array.isArray(sim.fehlerLog) ? sim.fehlerLog : []).forEach(run => {
            (Array.isArray(run && run.fehler) ? run.fehler : []).forEach(t => {
                const text = String(t || '').trim();
                if (!text || /^Keine Fehler/i.test(text)) return;
                counts.set(text, (counts.get(text) || 0) + 1);
            });
        });
        return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    }

    function render(host, sim) {
        injectStyle();
        let panel = document.getElementById('mqsim-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'mqsim-panel';
            panel.className = 'mq-panel mqsim-panel';
            host.insertBefore(panel, host.firstChild);
        }
        const faelle = Number(sim && sim.faelle) || 0;
        const head = `<div class="mq-panel-head"><h3>Einsatz-Simulator</h3><span class="mq-tag">${faelle} ${faelle === 1 ? 'Einsatz' : 'Einsätze'}</span></div>`;

        if (!faelle) {
            panel.innerHTML = head + `<div class="mqsim-empty"><p>Du hast noch keinen Einsatz abgeschlossen.<br>Nach jedem Einsatz siehst du hier deine Ergebnisse nach dem xABCDE-Schema.</p>
                <a class="mqsim-btn" href="${SIM_URL}">Ersten Einsatz starten</a></div>`;
            return;
        }

        const scores = nums(sim.gesamt);
        const overall = avg(scores);
        const passed = scores.filter(v => v >= PASS_SCORE).length;
        const letterAvgs = LETTERS.map(L => ({ ...L, v: avg(sim[L.k]) })).filter(L => L.v !== null);
        const weakest = letterAvgs.length ? letterAvgs.reduce((a, b) => (b.v < a.v ? b : a)) : null;

        const kpis = `<div class="mqsim-kpis">
            <div class="mqsim-kpi"><strong>${faelle}</strong><small>Einsätze</small></div>
            <div class="mqsim-kpi"><strong>${overall !== null ? overall + ' %' : '–'}</strong><small>Ø Ergebnis</small></div>
            <div class="mqsim-kpi"><strong>${scores.length ? passed + '/' + scores.length : '–'}</strong><small>bestanden</small></div>
        </div>`;

        const rows = `<div class="mqsim-rows">${letterAvgs.map(L => `
            <div class="mqsim-row" title="${esc(L.l + ' – ' + L.name)}">
                <span class="mqsim-letter">${L.l}</span>
                <span class="mqsim-name">${esc(L.name)}</span>
                <span class="mqsim-track mqsim-${tone(L.v)}"><i style="width:${Math.max(0, Math.min(100, L.v))}%"></i></span>
                <span class="mqsim-val mqsim-${tone(L.v)}">${L.v} %</span>
            </div>`).join('')}</div>`;

        const hint = weakest && weakest.v < 90
            ? `<p class="mqsim-hint">Deine größte Baustelle ist <strong>${esc(weakest.l)} – ${esc(weakest.name)}</strong> (Ø&nbsp;${weakest.v}&nbsp;%). Achte im nächsten Einsatz genau auf diesen Schritt.</p>`
            : (weakest ? `<p class="mqsim-hint">Stark! Du arbeitest das xABCDE-Schema in allen Bereichen sicher ab.</p>` : '');

        const verlauf = (Array.isArray(sim.verlauf) ? sim.verlauf : []).slice(0, 5);
        const recent = verlauf.length ? `<ul class="mqsim-list">${verlauf.map(r => {
            const d = r && r.datum ? new Date(r.datum) : null;
            const when = d && !isNaN(d) ? d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '';
            const cat = CATEGORY[r.kategorie] || '';
            const g = Math.max(0, Math.min(100, Math.round(Number(r.gesamt) || 0)));
            return `<li><span>${esc(r.diagnose || 'Einsatz')}<span class="mqsim-meta">${esc([when, cat].filter(Boolean).join(' · '))}</span></span><span class="mqsim-pill mqsim-${tone(g)}">${g} %</span></li>`;
        }).join('')}</ul>` : '<p class="mqsim-empty-note">Noch keine Einträge.</p>';

        const errs = frequentErrors(sim);
        const errList = errs.length ? `<ul class="mqsim-list">${errs.map(([t, n]) =>
            `<li><span>${esc(t)}</span>${n > 1 ? `<span class="mqsim-count">${n}×</span>` : ''}</li>`).join('')}</ul>`
            : '<p class="mqsim-empty-note">In deinen letzten Einsätzen wurden keine Fehler protokolliert.</p>';

        panel.innerHTML = head + kpis + rows + hint
            + `<div class="mqsim-cols"><div><h4>Letzte Einsätze</h4>${recent}</div><div><h4>Zuletzt übersehen</h4>${errList}</div></div>`
            + `<a class="mqsim-btn" href="${SIM_URL}">Neuen Einsatz starten</a>`;
    }

    async function start() {
        const host = await waitFor(() => document.querySelector('#mq-dashboard .mq-col-main'), 15000);
        if (!host) return;
        await waitFor(() => window.$memberstackDom || window.MemberStack || window.$memberstack, 10000);
        let sim = null;
        try { sim = await loadSimData(); } catch (e) { console.warn('RS-Dashboard: Simulator-Daten nicht ladbar:', e); }
        if (sim === null) return; // nicht eingeloggt / kein Memberstack: nichts anzeigen
        render(host, sim);
    }
    window.mqRenderSimPanel = render;

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
