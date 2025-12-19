// Prepayments module
(function() {
    let prepayments = [], prepayIdCounter = 0, runSimCallback = null;
    const TRACKS = { p: 'Prime', k: 'Kalats', m: 'Malatz', z: 'Katz', mt: 'Matz' };
    const $ = id => document.getElementById(id);
    const $val = id => parseFloat($(id)?.value) || 0;
    const $int = id => parseInt($(id)?.value) || 0;

    function init(runSim) { runSimCallback = runSim; }
    function getPrepayments() { return prepayments; }
    function setPrepayments(arr) { 
        prepayments = arr;
        // Update counter to avoid ID collisions
        if (arr.length > 0) {
            prepayIdCounter = Math.max(...arr.map(p => p.id)) + 1;
        }
    }

    function getActiveTracksForPrepay() {
        return Object.entries(TRACKS).map(([id, name]) => ({ id, name, pct: $val('pct' + name) })).filter(t => t.pct > 0);
    }

    function getTrackInitialBalance(trackId) {
        const eq = $val('inpEquity'), downPct = ($val('rDown') || 25) / 100;
        const loan = eq / downPct - eq;
        return loan * $val('pct' + TRACKS[trackId]) / 100;
    }

    function getTrackBalanceAtYear(trackId, year) {
        const initial = getTrackInitialBalance(trackId);
        if (initial <= 0 || year <= 0) return initial;
        const name = TRACKS[trackId];
        const rate = ($val('rate' + name) || 5) / 100;
        const termYears = $int('term' + name) || $int('rDur') || 25;
        const r = rate / 12, n = termYears * 12, k = year * 12;
        if (r === 0) return initial * (1 - k / n);
        const factor = Math.pow(1 + r, n), paidFactor = Math.pow(1 + r, k);
        return Math.max(0, initial * (factor - paidFactor) / (factor - 1));
    }

    function getRemainingForTrack(trackId, excludeId = null, atYear = null) {
        const p = excludeId !== null ? prepayments.find(x => x.id === excludeId) : null;
        const year = atYear !== null ? atYear : (p ? p.yr : 0);
        const balance = year > 0 ? getTrackBalanceAtYear(trackId, year) : getTrackInitialBalance(trackId);
        const used = prepayments.filter(pp => pp.track === trackId && pp.id !== excludeId && pp.yr <= year).reduce((s, pp) => s + pp.amt, 0);
        return Math.max(0, balance - used);
    }

    function getMaxPrepayForTrack(trackId, year, excludeId) {
        const balance = getTrackBalanceAtYear(trackId, year);
        const used = prepayments.filter(pp => pp.track === trackId && pp.id !== excludeId && pp.yr <= year).reduce((s, pp) => s + pp.amt, 0);
        return Math.round(Math.max(0, balance - used));
    }

    function addPrepayment() {
        const active = getActiveTracksForPrepay();
        if (!active.length) return alert('No active tracks to prepay. Add allocation to at least one track first.');
        const track = active.find(t => getRemainingForTrack(t.id) > 0);
        if (!track) return alert('All track balances are fully allocated to existing prepayments.');
        prepayments.push({ id: prepayIdCounter++, track: track.id, amt: Math.min(100000, getRemainingForTrack(track.id)), yr: 5 });
        renderPrepayments();
        runSimCallback?.();
    }

    function removePrepayment(id) {
        prepayments = prepayments.filter(p => p.id !== id);
        renderPrepayments();
        runSimCallback?.();
    }

    function updatePrepayment(id, field, value) {
        const p = prepayments.find(x => x.id === id);
        if (!p) return;
        let needsRender = false;

        if (field === 'yr') {
            const newYr = Math.max(1, Math.min(30, parseInt(value) || 1));
            if (newYr !== p.yr) {
                const wasAtMax = p.amt >= getMaxPrepayForTrack(p.track, p.yr, id) - 1;
                p.yr = newYr;
                const newMax = getMaxPrepayForTrack(p.track, p.yr, id);
                p.amt = wasAtMax ? newMax : Math.min(p.amt, newMax);
                needsRender = true;
            }
        } else if (field === 'amt') {
            const max = getMaxPrepayForTrack(p.track, p.yr, id);
            p.amt = Math.round(Math.min(parseFloat(value) || 0, max));
        } else if (field === 'track') {
            p.track = value;
            const max = getMaxPrepayForTrack(value, p.yr, id);
            if (p.amt > max) p.amt = max;
            needsRender = true;
        }

        if (needsRender) renderPrepayments();
        runSimCallback?.();
    }

    function renderPrepayments() {
        const list = $('prepayList');
        if (!list) return;
        const active = getActiveTracksForPrepay();

        list.innerHTML = prepayments.map(p => {
            const trackValid = active.some(t => t.id === p.track);
            if (!trackValid && active.length > 0) p.track = active[0].id;

            const balanceAtYear = getTrackBalanceAtYear(p.track, p.yr);
            const otherPrepays = prepayments
                .filter(pp => pp.track === p.track && pp.id !== p.id && pp.yr <= p.yr)
                .reduce((sum, pp) => sum + pp.amt, 0);
            const maxVal = Math.max(0, balanceAtYear - otherPrepays);
            if (p.amt > maxVal) p.amt = maxVal;

            const options = active.map(t => 
                `<option value="${t.id}" ${p.track === t.id ? 'selected' : ''}>${t.name}</option>`
            ).join('');

            return `<div class="prepay-item">
                <select onchange="window.Prepayments.updatePrepayment(${p.id},'track',this.value)">${options}</select>
                <span class="prepay-label">₪</span>
                <div class="prepay-amt-group">
                    <input type="number" value="${p.amt}" min="0" max="${maxVal}" step="10000" oninput="window.Prepayments.updatePrepayment(${p.id},'amt',this.value)">
                    <span class="prepay-max-btn" onclick="window.Prepayments.maxPrepayment(${p.id})">MAX</span>
                </div>
                <span class="prepay-label">Yr</span>
                <input type="number" value="${p.yr}" min="1" max="30" style="width:45px" oninput="window.Prepayments.updatePrepayment(${p.id},'yr',this.value)">
                <span class="prepay-remove" onclick="window.Prepayments.removePrepayment(${p.id})">✕</span>
            </div>`;
        }).join('');
    }

    function maxPrepayment(id) {
        const p = prepayments.find(x => x.id === id);
        if (!p) return;
        p.amt = getMaxPrepayForTrack(p.track, p.yr, id);
        renderPrepayments();
        if (runSimCallback) runSimCallback();
    }

    window.Prepayments = {
        init,
        getPrepayments,
        setPrepayments,
        getActiveTracksForPrepay,
        getTrackInitialBalance,
        getTrackBalanceAtYear,
        getRemainingForTrack,
        getMaxPrepayForTrack,
        addPrepayment,
        removePrepayment,
        updatePrepayment,
        renderPrepayments,
        maxPrepayment
    };
})();
