document.addEventListener('DOMContentLoaded', () => {
    // 1. Data parsing
    const starters = {
        "DOL": 2,
        "YD": 1.5,
        "SS": 1.5,
        "VSD": 1.25,
        "adjustable": 1.1
    };

    const motors = [];
    const kWList = [];
    // rows 4 to 33 (0-indexed 4 to 33 corresponds to C5 containing kW)
    for (let i = 4; i < 34; i++) {
        if (dataCSV[i] && dataCSV[i].C5) {
            const kw = parseFloat(dataCSV[i].C5);
            if (!isNaN(kw)) {
                motors.push({
                    kw: kw,
                    rateCurrent: parseFloat(dataCSV[i].C6)
                });
                kWList.push(dataCSV[i].C5);
            }
        }
    }

    const breakers = [];
    for (let i = 10; i < 36; i++) {
        if (dataCSV[i] && dataCSV[i].C1 && dataCSV[i].C2) {
            const at = parseFloat(dataCSV[i].C1);
            const af = parseFloat(dataCSV[i].C2);
            if (!isNaN(at)) {
                breakers.push({ at, af });
            }
        }
    }

    const cableMap = {};
    for (let i = 2; i < cableCSV.length; i++) {
        const row = cableCSV[i];
        if (row && row.C1) {
            cableMap[row.C1] = {
                lCable: row.C5 || "",
                lSize: row.C6 || "",
                lUnit: row.C7 || "",
                lType: row.C8 || "",
                gCable: row.C9 || "",
                gSize: row.C10 || "",
                gUnit: row.C11 || "",
                gType: row.C12 || "",
                rIn: row.C13 || "",
                rSize: row.C14 || "",
                rType: row.C15 || ""
            };
        }
    }

    // 2. Calculation logic
    function getRateCurrent(kw) {
        const motor = motors.find(m => m.kw === parseFloat(kw));
        return motor ? motor.rateCurrent : 0;
    }

    function getBreaker(sumIn) {
        if (sumIn === 0) return { at: "-", af: "-" };
        for (const b of breakers) {
            if (b.at >= sumIn) {
                return b;
            }
        }
        return { at: "-", af: "-" };
    }

    function getCable(kw, cableType, starter) {
        let normStarter = starter;
        if (starter === "SS" || starter === "VSD") normStarter = "DOL";
        const key = `${kw}|${cableType}|${normStarter}`;
        return cableMap[key] || {
            lCable: "-", lSize: "-", lType: "-", gCable: "-", gSize: "-", gType: "-", rIn: "-", rSize: "-", rType: "-"
        };
    }

    // 3. State Management
    let feeders = [];
    let feederCounter = 1;

    const tbody = document.getElementById('feeders-body');
    const btnAdd = document.getElementById('add-feeder-btn');

    function createFeeder() {
        const f = {
            id: feederCounter++,
            name: `F${feederCounter - 1}`,
            kw: "11",
            start: "YD",
            cableType: "PVC SC",
            rateCurrent: 0,
            xIn: 0,
            sumIn: 0,
            breakerAT: "-",
            breakerAF: "-",
            isMax: false,
            inCal: 0,
            cable: null
        };
        feeders.push(f);
        updateCalculations();
        render();
    }

    function deleteFeeder(id) {
        feeders = feeders.filter(f => f.id !== id);
        updateCalculations();
        render();
    }

    function updateFeeder(id, field, value) {
        const f = feeders.find(f => f.id === id);
        if (f) {
            f[field] = value;
            updateCalculations();
            render();
        }
    }

    function updateCalculations() {
        // Step 1: Base calc
        let maxInCal = 0;
        let maxFeederId = null;

        feeders.forEach(f => {
            f.rateCurrent = getRateCurrent(f.kw);
            f.xIn = starters[f.start] || 1;
            f.sumIn = f.rateCurrent * f.xIn;
            
            const b = getBreaker(f.sumIn);
            f.breakerAT = b.at;
            f.breakerAF = b.af;
            
            f.inCal = b.at !== "-" ? b.at : 0;
            if (f.inCal > maxInCal) {
                maxInCal = f.inCal;
                maxFeederId = f.id;
            }
            
            f.cable = getCable(f.kw, f.cableType, f.start);
        });

        // Step 2: Main calc
        let totalRateCurrent = 0;
        let calculatedMainCurrent = 0;

        feeders.forEach(f => {
            f.isMax = (f.id === maxFeederId);
            totalRateCurrent += f.rateCurrent;
            if (f.isMax) {
                calculatedMainCurrent += f.inCal;
            } else {
                calculatedMainCurrent += f.rateCurrent;
            }
        });

        const mainBreaker = getBreaker(calculatedMainCurrent);

        document.getElementById('summary-rate-current').textContent = totalRateCurrent.toFixed(2) + " A";
        document.getElementById('summary-calc-current').textContent = calculatedMainCurrent.toFixed(2) + " A";
        document.getElementById('summary-at').textContent = mainBreaker.at + " AT";
        document.getElementById('summary-af').textContent = mainBreaker.af + " AF";
    }

    function render() {
        tbody.innerHTML = '';
        feeders.forEach(f => {
            const tr = document.createElement('tr');
            
            // Name
            const tdName = document.createElement('td');
            tdName.className = "sticky-col";
            const inpName = document.createElement('input');
            inpName.type = "text";
            inpName.value = f.name;
            inpName.onchange = (e) => updateFeeder(f.id, 'name', e.target.value);
            tdName.appendChild(inpName);

            // kW
            const tdKW = document.createElement('td');
            const selKW = document.createElement('select');
            kWList.forEach(kw => {
                const opt = document.createElement('option');
                opt.value = kw;
                opt.textContent = kw;
                if (kw == f.kw) opt.selected = true;
                selKW.appendChild(opt);
            });
            selKW.onchange = (e) => updateFeeder(f.id, 'kw', e.target.value);
            tdKW.appendChild(selKW);

            // Start
            const tdStart = document.createElement('td');
            const selStart = document.createElement('select');
            ["DOL", "YD", "SS", "VSD", "adjustable"].forEach(st => {
                const opt = document.createElement('option');
                opt.value = st;
                opt.textContent = st;
                if (st === f.start) opt.selected = true;
                selStart.appendChild(opt);
            });
            selStart.onchange = (e) => updateFeeder(f.id, 'start', e.target.value);
            tdStart.appendChild(selStart);

            // Cable Type
            const tdCType = document.createElement('td');
            const selCType = document.createElement('select');
            ["PVC SC", "PVC MC", "XLPE SC", "XLPE MC"].forEach(ct => {
                const opt = document.createElement('option');
                opt.value = ct;
                opt.textContent = ct;
                if (ct === f.cableType) opt.selected = true;
                selCType.appendChild(opt);
            });
            selCType.onchange = (e) => updateFeeder(f.id, 'cableType', e.target.value);
            tdCType.appendChild(selCType);

            // Outputs
            const htmlOut = `
                <td class="val-computed">${f.rateCurrent.toFixed(2)}</td>
                <td class="val-computed">${f.xIn}</td>
                <td class="val-computed">${f.sumIn.toFixed(2)}</td>
                <td class="val-highlight">${f.breakerAT}</td>
                <td class="val-computed">${f.breakerAF}</td>
                <td class="val-computed">${f.cable ? f.cable.lCable + ' ' + f.cable.lSize : '-'}</td>
                <td class="val-computed">${f.cable ? f.cable.lType : '-'}</td>
                <td class="val-computed">${f.cable ? f.cable.gCable + ' ' + f.cable.gSize : '-'}</td>
                <td class="val-computed">${f.cable ? f.cable.gType : '-'}</td>
                <td class="val-computed">${f.cable ? f.cable.rIn : '-'}</td>
                <td class="val-computed">${f.cable ? f.cable.rSize : '-'}</td>
                <td class="val-computed">${f.cable ? f.cable.rType : '-'}</td>
                <td>
                    <button class="btn danger" onclick="document.dispatchEvent(new CustomEvent('delete-feeder', {detail: ${f.id}}))">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"></path></svg>
                    </button>
                </td>
            `;
            
            tr.appendChild(tdName);
            tr.appendChild(tdKW);
            tr.appendChild(tdStart);
            tr.appendChild(tdCType);
            tr.insertAdjacentHTML('beforeend', htmlOut);
            
            if (f.isMax) {
                tr.style.backgroundColor = "rgba(59, 130, 246, 0.1)";
            }
            tbody.appendChild(tr);
        });
    }

    document.addEventListener('delete-feeder', (e) => {
        deleteFeeder(e.detail);
    });

    btnAdd.addEventListener('click', createFeeder);

    // Initial setup matching the original file
    createFeeder(); // F1 11kW YD
    createFeeder(); // F2 11kW YD
    createFeeder(); // F3 11kW YD
    
    // Modify F3 to be 2.2kW DOL
    updateFeeder(3, 'kw', "2.2");
    updateFeeder(3, 'start', "DOL");

});
