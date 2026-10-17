/* Roya — ژمێریاری هاتن و چوون و مووچە بەپێی کاتژمێر
   هاوبەشە لە نێوان «ڕاپۆرتی هاتن و چوون» و «ڕاپۆرتی مووچە» (ئەم فایلە لەتەک attendance.html دابنێ لە پوشەی reports) */
(function () {
    const read = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
    const readMap = k => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
    const pad = n => String(n).padStart(2, '0');

        const toMin = t => { if (!t) return null; const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
        const fmtDur = mins => {
            if (!mins) return '—';
            const h = Math.floor(mins / 60), m = Math.round(mins % 60), p = [];
            if (h) p.push(`${h} کاتژمێر`);
            if (m) p.push(`${m} خولەک`);
            return p.join(' و ');
        };
        const mkWeeks = (start, end, brk, off) => Array.from({ length: 4 }, () => Array.from({ length: 7 }, (_, wd) => ({ on: !off.includes(wd), start, end, brk })));
        const roundIQD = x => { const r = x % 250, b = x - r; return r >= 125.55 ? b + 250 : b; };

        // ڕۆژەکانی دوای هەفتەکانی خشتەکە (بۆ نموونە ٢٩+ ئەگەر ٤ هەفتە بێت): هەفتە دووبارە نابێتەوە،
        // هەر ڕۆژێکی هەفتە بەپێی زۆرینەی هەفتەکان دەبێت (هەینی ١ لە ٤ دەوامە ← پشوو؛ شەممە ٣ لە ٤ دەوامە ← دەوام)
        function cellFor(sched, d, wd) {
            const N = sched.weeks.length;
            if (d <= N * 7) return sched.weeks[Math.ceil(d / 7) - 1][wd];
            const cells = sched.weeks.map(w => w[wd]), on = cells.filter(c => c.on);
            return on.length * 2 > cells.length ? Object.assign({}, on[0], { on: true }) : Object.assign({}, cells[0], { on: false });
        }

        // کاتژمێری کارکردن = (چوون - هاتن) - دواکەوتن لە هاتنەوە لە پشوو. ماوەی پشوو لەناو کاتژمێرەکانی کارە (٨ کاتژمێر).
        function calcDay(rec, brk) {
            const i = toMin(rec.in), o = toMin(rec.out), bo = toMin(rec.bOut), bi = toMin(rec.bIn);
            const span = (i != null && o != null) ? Math.max(0, o - i) : 0;
            let taken = 0, lateRet = 0;
            if (span) {
                if (bo != null && bi != null && bi > bo) { taken = bi - bo; lateRet = Math.max(0, taken - brk); }
                else if (span > brk) taken = brk;
            }
            return { span, taken, lateRet, worked: Math.max(0, span - lateRet) };
        }

        // ڕۆژەکانی مانگێک بۆ یەک کارمەند بەپێی خشتەی کاتی کاری خۆی (sched.weeks)
        // extras: { 'empId|date': خولەک } = زیاد کارکردن ، overrides: { 'empId|date': {type, from, to, note} } = دۆخی دەستی
        function buildDays(emp, y, m, sched, records, leaves, todayStr, extras, overrides) {
            const pd = n => String(n).padStart(2, '0');
            const dim = new Date(y, m, 0).getDate();
            const dailyLeaves = leaves.filter(l => ((l.employee || l.employeeName) === emp.name) && (l.status === 'پەسەندکراو' || l.status === 'approved')
                && l.startDate && ((l.typeLabel || l.leaveType || '') !== 'کاتژمێری'));
            const tot = { dim, workDays: 0, present: 0, absent: 0, leaveDays: 0, leaveMin: 0, hourlyManual: 0, restDays: 0, late: 0, early: 0, over: 0, breakTaken: 0, lateReturn: 0, extra: 0, worked: 0, schedMin: 0 };
            const rows = [];
            for (let d = 1; d <= dim; d++) {
                const ds = `${y}-${pd(m)}-${pd(d)}`, wd = new Date(y, m - 1, d).getDay();
                const cell = cellFor(sched, d, wd);
                const brk = Number(cell.brk !== undefined ? cell.brk : sched.breakMin) || 0;
                const key = `${emp.id}|${ds}`, rec = records[key] || {}, ov = overrides && overrides[key];
                const ex = Number(extras && extras[key]) || 0;
                const row = { n: d, date: ds, wd, on: !!cell.on, start: cell.start, end: cell.end, in: rec.in || '', out: rec.out || '', bOut: rec.bOut || '', bIn: rec.bIn || '', status: '', late: 0, early: 0, over: 0, extra: ex, worked: 0, note: (ov && ov.note) || '' };
                const came = !!(rec.in || rec.out), c = calcDay(rec, brk);
                tot.extra += ex; tot.worked += ex;
                if (!cell.on) {
                    tot.restDays++;
                    // هاتن لە ڕۆژی پشوو بۆ مووچە ناژمێردرێت؛ تەنها لە «زیاد کارکردن» دەژمێردرێت
                    row.status = came ? 'restwork' : (ex ? 'extra' : 'off');
                } else {
                    const sm = Math.max(0, toMin(cell.end) - toMin(cell.start));        // کاتژمێری پێویستی ئەو ڕۆژە (٨ کاتژمێر، پشوو لەخۆدەگرێت)
                    tot.workDays++; tot.schedMin += sm;
                    const punches = () => {
                        if (rec.in) row.late = Math.max(0, toMin(rec.in) - toMin(cell.start));
                        if (rec.out) { row.early = Math.max(0, toMin(cell.end) - toMin(rec.out)); row.over = Math.max(0, toMin(rec.out) - toMin(cell.end)); }
                        row.worked = c.worked;
                        tot.late += row.late; tot.early += row.early; tot.over += row.over; tot.worked += c.worked; tot.breakTaken += c.taken; tot.lateReturn += c.lateRet;
                    };
                    if (ov && ov.type === 'absent') { row.status = 'absent'; tot.absent++; }
                    else if (ov && ov.type === 'leave') { row.status = 'leave'; tot.leaveDays++; tot.leaveMin += sm; }
                    else if (ov && ov.type === 'hourly') {
                        const hm = Math.max(0, toMin(ov.to) - toMin(ov.from));
                        row.status = 'hourly'; row.hFrom = ov.from; row.hTo = ov.to; tot.hourlyManual += hm; tot.leaveMin += hm;
                        if (came) { tot.present++; punches(); }
                    }
                    else if (ov && ov.type === 'present' && !came) { row.status = 'present'; tot.present++; row.worked = sm; tot.worked += sm; }
                    else if (came) { row.status = 'present'; tot.present++; punches(); }
                    else if (dailyLeaves.some(l => l.startDate <= ds && ds <= (l.endDate || l.startDate))) { row.status = 'leave'; tot.leaveDays++; tot.leaveMin += sm; }
                    else if (ds > todayStr) row.status = ex ? 'present' : 'upcoming';
                    else { row.status = 'absent'; tot.absent++; }
                }
                rows.push(row);
            }
            return { rows, tot };
        }

        // مووچە بەپێی کاتژمێر: مووچەی مانگانە ÷ کاتژمێری پێویستی مانگ × کاتژمێری کارکردن (دینار ← نزیکترین ٢٥٠، دۆلار ← نزیکترین ١)
        function payFor(tot, salary, currency, countLeave) {
            if (!salary || !tot.schedMin) return null;
            const paidMin = tot.worked + (countLeave ? tot.leaveMin : 0);
            const raw = salary * paidMin / tot.schedMin;
            return { rate: salary / (tot.schedMin / 60), paidMin, amount: currency === 'USD' ? Math.round(raw) : roundIQD(raw) };
        }
        

    /* ---------- خشتەی کاتی کار، زیاد کارکردن، مووچە لە گرێبەستەوە ---------- */
    function schedules() {
        const s = readMap('attendanceSchedules');
        if (!s.default) { const old = readMap('attendanceSettings'); s.default = { weeks: mkWeeks(old.start || '08:00', old.end || '16:00', 60, old.off || [5]) }; }
        return s;
    }
    // خشتەی کارمەند: خۆی ← خشتەی لقەکەی (کۆن) ← بنەڕەت
    const schedFor = emp => { const s = schedules(); return s[emp.id] || (emp.branch && emp.branch !== 'all' && s[emp.branch]) || s.default; };

    const addDays = (ds, n) => { const d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

    // خولەکی کارکردنی زیاتر بۆ هەر ڕۆژێک: { 'empId|date': خولەک }
    //  - کاتژمێری: لە (from) بۆ (to)
    //  - ڕۆژانە: چەند ڕۆژێک لە دوای یەک؛ هەر ڕۆژێک بە درێژی ڕۆژەکەی لە خشتەی کاتی کاری کارمەندەکە (بۆ نموونە ٨ کاتژمێر)
    function extrasMap() {
        const m = {}, emps = read('employeesList');
        read('attendanceExtra').forEach(x => {
            if (x.type === 'daily') {
                const emp = emps.find(e => e.id === x.empId);
                if (!emp) return;
                const sched = schedFor(emp), n = Math.max(1, Number(x.days) || 1);
                for (let i = 0; i < n; i++) {
                    const ds = addDays(x.date, i), dt = new Date(ds + 'T00:00:00');
                    const cell = cellFor(sched, dt.getDate(), dt.getDay());
                    const k = `${x.empId}|${ds}`;
                    m[k] = (m[k] || 0) + Math.max(0, toMin(cell.end) - toMin(cell.start));
                }
            } else {
                const k = `${x.empId}|${x.date}`;
                m[k] = (m[k] || 0) + Math.max(0, toMin(x.to) - toMin(x.from));
            }
        });
        return m;
    }

    // مووچەی گرێبەستی ئەو مانگە. strict = تەنها گرێبەستێک کە مانگەکەی گرتبێتەوە (نەک دوایین گرێبەست)
    function contractSalary(emp, y, m, strict) {
        const cs = (emp.contracts || []).filter(c => c && c.salary !== undefined && c.salary !== '' && c.salary !== null);
        const dim = new Date(y, m, 0).getDate();
        let best = null, bestN = 0;
        cs.forEach(c => { let n = 0; for (let d = 1; d <= dim; d++) { const ds = `${y}-${pad(m)}-${pad(d)}`; if ((!c.start || c.start <= ds) && (!c.end || ds <= c.end)) n++; } if (n > 0 && n >= bestN) { best = c; bestN = n; } });
        return best || (strict ? null : (cs[cs.length - 1] || null));
    }

    // مووچەی یەک مانگ بەپێی کاتژمێری کارکردن (بۆ ڕاپۆرتی مووچە). null = ئەو مانگە گرێبەستی نییە
    // مۆڵەتی پەسەندکراو وەک کاتژمێری کارکردن دەژمێردرێت (مۆڵەتی کاتژمێری و ڕۆژانە)
    function monthHoursPay(emp, y, m) {
        const c = contractSalary(emp, y, m, true);
        if (!c) return null;
        const cur = c.currency === 'USD' ? 'USD' : 'IQD';
        const today = new Date().toISOString().slice(0, 10);
        const { tot } = buildDays(emp, y, m, schedFor(emp), readMap('attendanceRecords'), read('leaveRequests'), today, extrasMap(), readMap('attendanceStatus'));
        const p = payFor(tot, Number(c.salary), cur, true);
        return { amount: p ? p.amount : 0, currency: cur, tot };
    }

    // «مووچە بەپێی پەنجەمۆر»: بۆ هەر کارمەندێک و هەر مانگێک جیا. گۆڕینی مانگێک مووچەی مانگەکانی تر ناگۆڕێت.
    const fpKey = (id, y, m) => `${id}|${y}-${pad(m)}`;
    const isFingerprintPay = (id, y, m) => !!readMap('attendanceFingerprintPay')[fpKey(id, y, m)];
    function setFingerprintPay(id, y, m, on) {
        const all = readMap('attendanceFingerprintPay');
        if (on) all[fpKey(id, y, m)] = true; else delete all[fpKey(id, y, m)];
        localStorage.setItem('attendanceFingerprintPay', JSON.stringify(all));
    }

    window.RoyaAtt = { toMin, fmtDur, mkWeeks, roundIQD, cellFor, calcDay, buildDays, payFor, schedules, schedFor, extrasMap, addDays, contractSalary, monthHoursPay, isFingerprintPay, setFingerprintPay };
})();