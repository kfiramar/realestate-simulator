// Prepayments module
(function() {
    let prepayments = [];
    let prepayIdCounter = 0;
    let runSimCallback = null;

    function init(runSim) {
        runSimCallback = runSim;
    }

    function getPrepayments() {
        return prepayments;
    }

    function setPrepayments(arr) {
        prepayments = arr;
    }

    function getActiveTracksForPrepay() {
        const tracks = [
            { id: 'p', name: 'Prime', pct: parseFloat(document.getElementById('pctPrime')?.value) || 0 },
            { id: 'k', name: 'Kalats', pct: parseFloat(document.getElementById('pctKalats')?.value) || 0 },
            { id: 'm', name: 'Malatz', pct: parseFloat(document.getElementById('pctMalatz')?.value) || 0 },
            { id: 'z', name: 'Katz', pct: parseFloat(document.getElementById('pctKatz')?.value) || 0 },
            { id: 'mt', name: 'Matz', pct: parseFloat(document.getElementById('pctMatz')?.value) || 0 }
        ];
        return tracks.filter(t => t.pct > 0);
    }

    function getTrackInitialBalance(trackId) {
        const eq = parseFloat(document.getElementById('inpEquity')?.value) || 0;
        const downPct = (parseFloat(document.getElementById('rDown')?.value) || 25) / 100;
        const loan = eq / downPct - eq;
        const pctMap = { p: 'Prime', k: 'Kalats', m: 'Malatz', z: 'Katz', mt: 'Matz' };
        const elId = pctMap[trackId];
        if (!elId) return 0;
        const pct = parseFloat(document.getElementById('pct' + elId)?.value) || 0;
        return loan * pct / 100;
    }

    function getTrackBalanceAtYear(trackId, year) {
        const initial = getTrackInitialBalance(trackId);
        if (initial <= 0 || year <= 0) return initial;

        const rateMap = { p: 'Prime', k: 'Kalats', m: 'Malatz', z: 'Katz', mt: 'Matz' };
        const rateName = rateMap[trackId];
        const rate = (parseFloat(document.getElementById('rate' + rateName)?.value) || 5) / 100;
        const termYears = parseInt(document.getElementById('term' + rateName)?.value) ||
                          parseInt(document.getElementById('rDur')?.value) || 25;

        const monthlyRate = rate / 12;
        const totalMonths = termYears * 12;
        const paidMonths = year * 12;

        if (monthlyRate === 0) {
            return initial * (1 - paidMonths / totalMonths);
        }

        const factor = Math.pow(1 + monthlyRate, totalMonths);
        const paidFactor = Math.pow(1 + monthlyRate, paidMonths);
        const remaining = initial * (factor - paidFactor) / (factor - 1);
        return Math.max(0, remaining);
    }

    function getRemainingForTrack(trackId, excludeId = null, atYear = null) {
        const p = excludeId !== null ? prepayments.find(x => x.id === excludeId) : null;
        const year = atYear !== null ? atYear : (p ? p.yr : 0);
        const balanceAtYear = year > 0 ? getTrackBalanceAtYear(trackId, year) : getTrackInitialBalance(trackId);
        const used = prepayments
            .filter(pp => pp.track === trackId && pp.id !== excludeId && pp.yr <= year)
            .reduce((sum, pp) => sum + pp.amt, 0);
        return Math.max(0, balanceAtYear - used);
    }

    function getMaxPrepayForTrack(trackId, year, excludeId) {
        const balanceAtYear = getTrackBalanceAtYear(trackId, year);
        const otherPrepays = prepayments
            .filter(pp => pp.track === trackId && pp.id !== excludeId && pp.yr <= year)
            .reduce((sum, pp) => sum + pp.amt, 0);
        return Math.round(Math.max(0, balanceAtYear - otherPrepays));
    }

    function addPrepayment() {
        const active = getActiveTracksForPrepay();
        if (active.length === 0) {
            alert('No active tracks to prepay. Add allocation to at least one track first.');
            return;
        }
        const trackWithBalance = active.find(t => getRemainingForTrack(t.id) > 0);
        if (!trackWithBalance) {
            alert('All track balances are fully allocated to existing prepayments.');
            return;
        }
        const remaining = getRemainingForTrack(trackWithBalance.id);
        const id = prepayIdCounter++;
        prepayments.push({ id, track: trackWithBalance.id, amt: Math.min(100000, remaining), yr: 5 });
        renderPrepayments();
        if (runSimCallback) runSimCallback();
    }

    function removePrepayment(id) {
        prepayments = prepayments.filter(p => p.id !== id);
        renderPrepayments();
        if (runSimCallback) runSimCallback();
    }

    function updatePrepayment(id, field, value) {
        const p = prepayments.find(x => x.id === id);
        if (!p) return;

        let needsRender = false;

        if (field === 'yr') {
            const newYr = Math.max(1, Math.min(30, parseInt(value) || 1));
            if (newYr !== p.yr) {
                const oldMax = getMaxPrepayForTrack(p.track, p.yr, id);
                const wasAtMax = p.amt >= oldMax - 1;
                p.yr = newYr;
                const newMax = getMaxPrepayForTrack(p.track, p.yr, id);
                if (wasAtMax) p.amt = newMax;
                else if (p.amt > newMax) p.amt = newMax;
                needsRender = true;
            }
        } else if (field === 'amt') {
            const requested = parseFloat(value) || 0;
            const max = getMaxPrepayForTrack(p.track, p.yr, id);
            p.amt = Math.round(Math.min(requested, max));
            const items = document.querySelectorAll('.prepay-item');
            const idx = prepayments.findIndex(x => x.id === id);
            if (items[idx]) {
                const maxEl = items[idx].querySelector('.prepay-max');
                if (maxEl) maxEl.textContent = `/ ${Math.round(max/1000)}K`;
                const inp = items[idx].querySelector('input[type="number"]');
                if (inp && requested >= max) {
                    inp.value = p.amt;
                    inp.blur();
                }
            }
        } else if (field === 'track') {
            p.track = value;
            const max = getMaxPrepayForTrack(value, p.yr, id);
            if (p.amt > max) p.amt = max;
            needsRender = true;
        }

        if (needsRender) renderPrepayments();
        if (runSimCallback) runSimCallback();
    }

    function renderPrepayments() {
        const list = document.getElementById('prepayList');
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
