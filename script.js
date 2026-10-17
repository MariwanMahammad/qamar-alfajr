document.addEventListener('DOMContentLoaded', function() {
    // 1. هێنانی داتا لە localStorage
    let employees = JSON.parse(localStorage.getItem('all_employees')) || [];
    let leaves = JSON.parse(localStorage.getItem('all_leaves')) || [];

    // ⚠️ داتای نموونە (تەنها بۆ تاقیکردنەوە، ئەگەر داتات نییە ئەمە دەیخاتە سەر شاشە)
    if (employees.length === 0) {
        employees = [
            { name: 'یەحیا یحیى', role: 'کارمەند', status: 'چالاک', contracts: [{ start: '2025-01-01', end: '2026-12-31' }] }
        ];
        localStorage.setItem('all_employees', JSON.stringify(employees));
    }
    if (leaves.length === 0) {
        leaves = [
            { employee: 'یەحیا یحیى', type: 'ڕۆژانە', category: 'ئاسایی', duration: '10', status: 'پەسەندکراو', startDate: '2026-01-01', endDate: '2026-01-10' },
            { employee: 'یەحیا یحیى', type: 'کاتژمێری', category: 'نەخۆشی', duration: '4 کاتژمێر', status: 'پەسەندکراو', startDate: '2026-02-01', endDate: '2026-02-01' },
            { employee: 'یەحیا یحیى', type: 'ڕۆژانە', category: 'سەفەر', duration: '2', status: 'چاوەڕوانکراو', startDate: '2026-03-01', endDate: '2026-03-02' }
        ];
        localStorage.setItem('all_leaves', JSON.stringify(leaves));
    }

    // 2. پڕکردنەوەی کارتەکانی ئامار (Stats)
    document.getElementById('total-employees').innerText = employees.length;
    
    let pending = leaves.filter(l => !l.status || l.status === 'چاوەڕوانکراو' || l.status === 'چاوەڕوان').length;
    let approved = leaves.filter(l => l.status === 'پەسەندکراو').length;
    let rejected = leaves.filter(l => l.status === 'ڕەتکراوە').length;

    document.getElementById('pending-leaves').innerText = pending;
    document.getElementById('approved-leaves').innerText = approved;
    document.getElementById('rejected-leaves').innerText = rejected;

    // 3. ژماردنی جۆرەکانی مۆڵەت
    let categories = { 'ئاسایی': 0, 'نەخۆشی': 0, 'دائیرە': 0, 'سەفەر': 0, 'تازیە': 0, 'بێ مووچە': 0 };
    leaves.forEach(l => {
        let cat = l.category || 'ئاسایی';
        if (categories[cat] !== undefined) categories[cat]++;
    });

    document.getElementById('normal-leave').innerText = categories['ئاسایی'] + ' جار';
    document.getElementById('sick-leave').innerText = categories['نەخۆشی'] + ' جار';
    document.getElementById('office-leave').innerText = categories['دائیرە'] + ' جار';
    document.getElementById('travel-leave').innerText = categories['سەفەر'] + ' جار';
    document.getElementById('funeral-leave').innerText = categories['تازیە'] + ' جار';
    document.getElementById('unpaid-leave').innerText = categories['بێ مووچە'] + ' جار';

    // 4. پڕکردنەوەی خشتەی کورتە (Table)
    let tbody = document.getElementById('dashboard-tbody');
    tbody.innerHTML = ''; // پاککردنەوەی خشتەکە

    if (employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">هیچ کارمەندێک تۆمار نەکراوە</td></tr>';
        return;
    }

    employees.forEach(emp => {
        // هەژمارکردنی مۆڵەتە پەسەندکراوەکانی ئەم کارمەندە
        let empLeaves = leaves.filter(l => 
            (l.employee === emp.name || l.employeeName === emp.name) && l.status === 'پەسەندکراو'
        );
        
        let dailyDays = 0;
        let hourlyHours = 0;
        
        empLeaves.forEach(l => {
            if (l.type === 'ڕۆژانە') {
                dailyDays += parseInt(l.duration) || 0;
            } else if (l.type === 'کاتژمێری') {
                let match = (l.duration || '').match(/(\d+)\s*کاتژمێر/);
                if (match) hourlyHours += parseInt(match[1]);
            }
        });

        let totalAnnual = 21; // مۆڵەتی ساڵانە ٢١ ڕۆژە
        let remainingDays = totalAnnual - dailyDays;
        let remainingText = '';
        
        if (remainingDays < 0) {
            remainingText = `<span style="color: #ef4444; font-weight: bold;">${Math.abs(remainingDays)} ڕۆژ زیاتر</span>`;
        } else {
            remainingText = `<span style="color: #27ae60; font-weight: bold;">${remainingDays} ڕۆژ ماوە</span>`;
        }

        // وەرگرتنی کۆتایی گرێبەست
        let contractEnd = '-';
        if (emp.contracts && emp.contracts.length > 0) {
            contractEnd = emp.contracts[emp.contracts.length - 1].end || '-';
        }

        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${emp.name}</td>
            <td>${contractEnd}</td>
            <td>${totalAnnual} ڕۆژ</td>
            <td>${dailyDays} ڕۆژ</td>
            <td>${hourlyHours} کاتژمێر</td>
            <td>${remainingText}</td>
        `;
        tbody.appendChild(tr);
    });
});