/* ==========================================
   نەخشەی ڕۆڵەکان
   ========================================== */
const ROLE_MAP = {
    'admin': { name: 'بەڕێوەبەری سیستەم', level: 4 },
    'general-manager': { name: 'بەڕێوەبەری گشتی', level: 3 },
    'dept-manager': { name: 'بەڕێوەبەری بەش', level: 2 },
    'employee': { name: 'کارمەند', level: 1 }
};

const LEAVE_ENTITLEMENT = { annual: 21, daily: 10, hourly: 40 };
const HOURS_PER_DAY = 8;

/* ==========================================
   جۆرەکانی مۆڵەت لە localStorage دەخوێنرێنەوە
   ========================================== */
let LEAVE_TYPES = {};

function loadLeaveTypesFromStorage() {
    const stored = localStorage.getItem('leaveTypesList');
    const typesArray = stored ? JSON.parse(stored) : [];

    const typesObj = {};
    typesArray.forEach(t => {
        let color = '#00f3ff';
        if (t.id === 'sick') color = '#f87171';
        if (t.id === 'maternity') color = '#f9a8d4';
        if (t.id === 'travel') color = '#a5f3fc';
        if (t.id === 'condolence') color = '#cbd5e1';
        if (t.id === 'marriage') color = '#fcd34d';
        if (t.id === 'unpaid') color = '#c4b5fd';
        if (t.id.startsWith('custom_')) color = '#a78bfa';

        typesObj[t.id] = {
            name: t.name,
            icon: t.icon || '📌',
            color: color
        };
    });

    LEAVE_TYPES = typesObj;
}

const STATUS_TYPES = {
    'pending':  { name: 'چاوەڕوانکراو', icon: '⏳', color: '#fbbf24' },
    'rejected': { name: 'ڕەتکراوە',     icon: '❌', color: '#ef4444' },
    'approved': { name: 'پەسەندکراو',   icon: '✅', color: '#22c55e' }
};

/* ==========================================
   Helpers
   ========================================== */
function loadBranches() { return JSON.parse(localStorage.getItem('branchesList')) || []; }
function loadEmployees() { return JSON.parse(localStorage.getItem('employeesList')) || []; }
function loadLeaveRequests() { return JSON.parse(localStorage.getItem('leaveRequests')) || []; }
function getCurrentUser() { return JSON.parse(localStorage.getItem('currentLoggedInUser')); }

function getBranchName(branchId) {
    const branches = loadBranches();
    const b = branches.find(x => x.id === branchId);
    return b ? b.name : '—';
}

function formatDate(d) {
    if (!d) return '—';
    try {
        const date = new Date(d);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${year}/${month}/${day}`;
    } catch (e) { return '—'; }
}

/* ==========================================
   فۆرماتکردنی کاتژمێر بە شێوەی "H:MM"
   ========================================== */
function formatHoursMinutes(totalMinutes) {
    if (!totalMinutes || totalMinutes <= 0) return '0:00';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const mm = String(minutes).padStart(2, '0');
    return `${hours}:${mm}`;
}

/* ==========================================
   فۆرماتکردنی کات بە شێوەی "X ڕۆژ و H:MM سعات"
   ========================================== */
function formatShortDuration(totalMinutes) {
    if (!totalMinutes || totalMinutes <= 0) return '0';
    const totalHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const days = Math.floor(totalHours / HOURS_PER_DAY);
    const hours = totalHours % HOURS_PER_DAY;
    const mm = String(minutes).padStart(2, '0');
    const hm = `${hours}:${mm}`;

    if (days > 0 && (hours > 0 || minutes > 0)) {
        return `${days} ڕۆژ و ${hm} سعات`;
    } else if (days > 0) {
        return `${days} ڕۆژ`;
    } else if (hours > 0 || minutes > 0) {
        return `${hm} سعات`;
    }
    return '0';
}

/* ==========================================
   ✅ فۆرماتکردنی بڕی مۆڵەت بەپێی جۆر
   ========================================== */
function formatLeaveAmount(totalDaily, totalMinutes) {
    let parts = [];
    
    if (totalDaily > 0) {
        parts.push(`${totalDaily} ڕۆژ`);
    }
    
    if (totalMinutes > 0) {
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        let timeText = '';
        if (h > 0) timeText += `${h} سعات`;
        if (m > 0) timeText += (h > 0 ? ' و ' : '') + `${m} دقیقە`;
        if (timeText) parts.push(timeText);
    }
    
    return parts.length > 0 ? parts.join(' و ') : '0';
}

/* ==========================================
   فلتەرکردنی کارمەندان
   ========================================== */
function getFilteredEmployees() {
    const user = getCurrentUser();
    const employees = loadEmployees();
    if (!user) return [];
    const roleId = user.role || user.selectedRole;
    const roleInfo = ROLE_MAP[roleId];
    const level = roleInfo ? roleInfo.level : 0;
    let filtered = employees;

    if (level === 2) {
        filtered = filtered.filter(e => e.branch === user.branch);
    } else if (level === 1) {
        filtered = filtered.filter(e => e.id === user.id);
    } else if (level >= 3) {
        const selectedBranch = document.getElementById('branchFilter')?.value || 'all';
        if (selectedBranch !== 'all') {
            filtered = filtered.filter(e => e.branch === selectedBranch);
        }
    }
    return filtered;
}

/* ==========================================
   کورتەی مۆڵەت
   ========================================== */
function getLeaveSummary(empId) {
    const requests = loadLeaveRequests();
    const approved = requests.filter(r => r.employeeId === empId && 
        (r.status === 'پەسەندکراو' || r.status === 'approved')
    );
    let annualDays = 0, dailyDays = 0, hourlyMinutes = 0;

    approved.forEach(r => {
        const amount = Number(r.amount) || 0;
        const typeLabel = r.typeLabel || r.leaveType || '';
        if (r.type === 'annual' || r.categoryId === 'regular') annualDays += amount;
        else if (r.type === 'daily' || typeLabel === 'ڕۆژانە') dailyDays += amount;
        else if (r.type === 'hourly' || typeLabel === 'کاتژمێری') hourlyMinutes += amount;
    });

    const totalTakenMinutes = (annualDays * HOURS_PER_DAY * 60) + (dailyDays * HOURS_PER_DAY * 60) + hourlyMinutes;
    const totalEntitlementMinutes = LEAVE_ENTITLEMENT.annual * HOURS_PER_DAY * 60;
    const remainingMinutes = Math.max(0, totalEntitlementMinutes - totalTakenMinutes);
    const extraMinutes = totalTakenMinutes > totalEntitlementMinutes ? totalTakenMinutes - totalEntitlementMinutes : 0;

    return {
        annualDays, dailyDays, hourlyMinutes,
        totalTakenMinutes, remainingMinutes, extraMinutes,
        annualTotal: LEAVE_ENTITLEMENT.annual,
        dailyTotal: LEAVE_ENTITLEMENT.daily,
        hourlyTotal: LEAVE_ENTITLEMENT.hourly
    };
}

/* ==========================================
   ✅ وردەکاری جۆرەکانی مۆڵەت (دەستکاریکراو)
   ئێستا بۆ هەر جۆرێک، هەردوو بڕی ڕۆژ و خولەک هەڵدەگرێت
   ========================================== */
function getLeaveDetails(empId) {
    const requests = loadLeaveRequests().filter(r => r.employeeId === empId);
    const details = {};
    
    // دەستپێکردن بە بەتاڵ بۆ هەموو جۆرەکان
    Object.keys(LEAVE_TYPES).forEach(t => { 
        details[t] = { daily: 0, minutes: 0 }; 
    });
    
    requests.forEach(r => {
        if ((r.status === 'پەسەندکراو' || r.status === 'approved') && details.hasOwnProperty(r.categoryId)) {
            const amount = Number(r.amount) || 0;
            const typeLabel = r.typeLabel || r.leaveType || '';
            
            if (typeLabel === 'کاتژمێری' || r.type === 'hourly') {
                details[r.categoryId].minutes += amount;
            } else {
                details[r.categoryId].daily += amount;
            }
        }
    });
    
    const statuses = {
        pending: requests.filter(r => r.status === 'چاوەڕوانکراو' || r.status === 'pending').length,
        rejected: requests.filter(r => r.status === 'ڕەتکراوە' || r.status === 'rejected').length,
        approved: requests.filter(r => r.status === 'پەسەندکراو' || r.status === 'approved').length
    };
    
    return { byType: details, statuses };
}

/* ==========================================
   دروستکردنی لیستی خانەکان
   ========================================== */
function buildDashboardCards() {
    const cards = [
        { key: 'total_emp', title: 'کۆی کارمەند', icon: '👥', type: 'total', color: '#00f3ff' },
        { key: 'pending',   title: 'مۆڵەتی چاوەڕوانکراو', icon: '⏳', type: 'status', value: 'pending', color: '#fbbf24' },
        { key: 'approved',  title: 'مۆڵەتی پەسەندکراو', icon: '✅', type: 'status', value: 'approved', color: '#22c55e' },
        { key: 'rejected',  title: 'مۆڵەتی ڕەتکراوە', icon: '❌', type: 'status', value: 'rejected', color: '#ef4444' },
        { key: 'extra',     title: 'مۆڵەتی زیاد بەکارهاتوو', icon: '⚠️', type: 'extra', color: '#f87171' }
    ];

    Object.keys(LEAVE_TYPES).forEach(typeId => {
        const t = LEAVE_TYPES[typeId];
        cards.push({
            key: typeId,
            title: `مۆڵەتی ${t.name}`,
            icon: t.icon,
            type: 'leaveType',
            value: typeId,
            color: t.color
        });
    });

    return cards;
}

/* ==========================================
   حسابکردنی بەها بۆ هەر خانەیەک
   ========================================== */
function getCardValue(card, employees, requests) {
    const empIds = new Set(employees.map(e => e.id));
    const filteredReqs = requests.filter(r => empIds.has(r.employeeId));

    if (card.type === 'total') return employees.length;

    if (card.type === 'status') {
        let statusKeys = [];
        if (card.value === 'pending') statusKeys = ['چاوەڕوانکراو', 'pending'];
        if (card.value === 'approved') statusKeys = ['پەسەندکراو', 'approved'];
        if (card.value === 'rejected') statusKeys = ['ڕەتکراوە', 'rejected'];
        return filteredReqs.filter(r => statusKeys.includes(r.status)).length;
    }

    if (card.type === 'extra') {
        let totalExtra = 0;
        employees.forEach(emp => { totalExtra += getLeaveSummary(emp.id).extraMinutes; });
        return formatShortDuration(totalExtra);
    }

    if (card.type === 'leaveType') {
        let totalDaily = 0;
        let totalMinutes = 0;
        
        filteredReqs.forEach(r => {
            let status = r.status || '';
            let isApproved = status === 'پەسەندکراو' || status === 'approved';
            let matchesType = r.categoryId === card.value || 
                              (LEAVE_TYPES[card.value] && r.categoryName === LEAVE_TYPES[card.value].name);
            
            if (isApproved && matchesType) {
                const amount = Number(r.amount) || 0;
                const typeLabel = r.typeLabel || r.leaveType || '';
                
                if (typeLabel === 'کاتژمێری' || r.type === 'hourly') {
                    totalMinutes += amount;
                } else {
                    totalDaily += amount;
                }
            }
        });
        
        return formatLeaveAmount(totalDaily, totalMinutes);
    }

    return 0;
}

/* ==========================================
   پیشاندانی خانەکان
   ========================================== */
function renderCards(employees) {
    const grid = document.getElementById('cardsGrid');
    if (!grid) return;
    const requests = loadLeaveRequests();
    grid.innerHTML = '';

    const cards = buildDashboardCards();

    cards.forEach(card => {
        const value = getCardValue(card, employees, requests);
        const el = document.createElement('div');
        el.className = 'card-item';
        el.style.setProperty('--color', card.color);
        el.onclick = () => openCardModal(card, employees);
        el.innerHTML = `
            <span class="card-icon">${card.icon}</span>
            <div class="card-label">${card.title}</div>
            <div class="card-value">${value}</div>
            <span class="card-click-hint">👁️ کلیک بکە</span>
        `;
        grid.appendChild(el);
    });
}

/* ==========================================
   کردنەوەی مۆداڵ
   ========================================== */
function openCardModal(card, employees) {
    const requests = loadLeaveRequests();
    const empIds = new Set(employees.map(e => e.id));
    const filteredReqs = requests.filter(r => empIds.has(r.employeeId));
    let resultList = [];

    if (card.type === 'total') {
        resultList = employees.map(e => ({ emp: e, info: '👤 کارمەند' }));
    } else if (card.type === 'status') {
        let statusKeys = [];
        if (card.value === 'pending') statusKeys = ['چاوەڕوانکراو', 'pending'];
        if (card.value === 'approved') statusKeys = ['پەسەندکراو', 'approved'];
        if (card.value === 'rejected') statusKeys = ['ڕەتکراوە', 'rejected'];

        const statusEmpIds = new Set(
            filteredReqs.filter(r => statusKeys.includes(r.status)).map(r => r.employeeId)
        );
        resultList = employees.filter(e => statusEmpIds.has(e.id)).map(e => {
            const count = filteredReqs.filter(r =>
                r.employeeId === e.id && statusKeys.includes(r.status)
            ).length;
            return { emp: e, info: `📄 ${count} داواکاری` };
        });
    } else if (card.type === 'extra') {
        resultList = employees.filter(e => getLeaveSummary(e.id).extraMinutes > 0).map(e => {
            const sum = getLeaveSummary(e.id);
            return { emp: e, info: `⚠️ ${formatShortDuration(sum.extraMinutes)} زیادە` };
        });
    } else if (card.type === 'leaveType') {
        const typeEmpData = {};
        
        filteredReqs.forEach(r => {
            let status = r.status || '';
            let isApproved = status === 'پەسەندکراو' || status === 'approved';
            let matchesType = r.categoryId === card.value || 
                              (LEAVE_TYPES[card.value] && r.categoryName === LEAVE_TYPES[card.value].name);
            
            if (isApproved && matchesType) {
                if (!typeEmpData[r.employeeId]) {
                    typeEmpData[r.employeeId] = { daily: 0, minutes: 0 };
                }
                const amount = Number(r.amount) || 0;
                const typeLabel = r.typeLabel || r.leaveType || '';
                
                if (typeLabel === 'کاتژمێری' || r.type === 'hourly') {
                    typeEmpData[r.employeeId].minutes += amount;
                } else {
                    typeEmpData[r.employeeId].daily += amount;
                }
            }
        });

        resultList = employees
            .filter(e => typeEmpData[e.id])
            .map(e => {
                const data = typeEmpData[e.id];
                const formatted = formatLeaveAmount(data.daily, data.minutes);
                return { emp: e, info: `📊 ${formatted}` };
            });
    }

    const modal = document.getElementById('empModal');
    const title = document.getElementById('empModalTitle');
    const body = document.getElementById('empModalBody');

    title.innerHTML = `${card.icon} ${card.title} <span class="modal-count">(${resultList.length} کارمەند)</span>`;

    if (resultList.length === 0) {
        body.innerHTML = `<div class="emp-modal-empty"><span class="icon">📭</span>هیچ کارمەندێک نەدۆزرایەوە بۆ ئەم بەشە</div>`;
    } else {
        body.innerHTML = resultList.map(item => `
            <div class="emp-modal-item" style="--item-color: ${card.color};">
                <span class="emp-modal-name">👤 ${item.emp.name || '—'}</span>
                <span class="emp-modal-info">
                    <span>🏢 ${getBranchName(item.emp.branch)}</span>
                    <span>${item.info}</span>
                </span>
            </div>
        `).join('');
    }
    modal.classList.add('show');
}

function closeCardModal(event) {
    const modal = document.getElementById('empModal');
    if (!modal) return;
    if (!event || event.target === modal) modal.classList.remove('show');
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.getElementById('empModal')?.classList.remove('show');
});

/* ==========================================
   ✅ خشتەی گەورە (دەستکاریکراو - وردەکاری بە فۆرماتی جوان)
   ========================================== */
function renderTable(employees) {
    const tbody = document.getElementById('tableBody');
    const countEl = document.getElementById('tableCount');
    countEl.innerText = `(${employees.length} کارمەند)`;

    if (employees.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="empty-row"><span class="icon">📭</span>هیچ داتایەک نییە بۆ پیشاندان</td></tr>`;
        return;
    }
    tbody.innerHTML = '';

    employees.forEach(emp => {
        const sum = getLeaveSummary(emp.id);
        const details = getLeaveDetails(emp.id);
        const contracts = emp.contracts || [];
        const lastContract = contracts.length > 0 ? contracts[contracts.length - 1] : null;
        const endDate = lastContract && lastContract.end ? formatDate(lastContract.end) : '—';

        let contractClass = '', contractIcon = '📄';
        if (lastContract && lastContract.end) {
            const endD = new Date(lastContract.end);
            if (endD < new Date()) { contractClass = 'td-negative'; contractIcon = '⏳'; }
            else { contractClass = 'td-positive'; contractIcon = '✅'; }
        }

        let remainingClass = 'td-positive';
        if (sum.remainingMinutes === 0) remainingClass = 'td-warning';
        else if (sum.remainingMinutes < HOURS_PER_DAY * 60 * 3) remainingClass = 'td-warning';
        const extraClass = sum.extraMinutes > 0 ? 'td-negative' : 'td-muted';

        const mainRow = document.createElement('tr');
        mainRow.className = 'main-row';
        mainRow.setAttribute('data-emp-id', emp.id);
        mainRow.onclick = () => toggleRow(emp.id);
        mainRow.innerHTML = `
            <td style="text-align:center;"><span class="expand-icon">◀</span></td>
            <td class="td-name">${emp.name || '—'}</td>
            <td class="${contractClass}">${contractIcon} ${endDate}</td>
            <td class="td-branch">${getBranchName(emp.branch)}</td>
            <td class="td-number">${sum.annualTotal} ڕۆژ</td>
            <td class="td-number">${sum.dailyDays} ڕۆژ</td>
            <td class="td-number td-info">${formatHoursMinutes(sum.hourlyMinutes)} سعات</td>
            <td class="td-number">${formatShortDuration(sum.totalTakenMinutes)}</td>
            <td class="td-number ${remainingClass}">${formatShortDuration(sum.remainingMinutes)}</td>
            <td class="td-number ${extraClass}">${sum.extraMinutes > 0 ? '⚠️ ' + formatShortDuration(sum.extraMinutes) : '—'}</td>
        `;
        tbody.appendChild(mainRow);

        const detailRow = document.createElement('tr');
        detailRow.className = 'detail-row';
        detailRow.id = 'detail-' + emp.id;
        let itemsHtml = '';
        itemsHtml += `
            <div class="detail-item" style="--item-color: ${STATUS_TYPES.pending.color};">
                <div class="detail-icon">${STATUS_TYPES.pending.icon}</div>
                <div class="detail-info"><div class="detail-label">${STATUS_TYPES.pending.name}</div><div class="detail-value">${details.statuses.pending}</div></div>
            </div>
            <div class="detail-item" style="--item-color: ${STATUS_TYPES.rejected.color};">
                <div class="detail-icon">${STATUS_TYPES.rejected.icon}</div>
                <div class="detail-info"><div class="detail-label">${STATUS_TYPES.rejected.name}</div><div class="detail-value">${details.statuses.rejected}</div></div>
            </div>
            <div class="detail-item" style="--item-color: ${STATUS_TYPES.approved.color};">
                <div class="detail-icon">${STATUS_TYPES.approved.icon}</div>
                <div class="detail-info"><div class="detail-label">${STATUS_TYPES.approved.name}</div><div class="detail-value">${details.statuses.approved}</div></div>
            </div>
        `;
        
        // ✅ گۆڕانکاری: بەکارهێنانی formatLeaveAmount بۆ هەر جۆرێک
        Object.keys(LEAVE_TYPES).forEach(type => {
            const t = LEAVE_TYPES[type];
            const data = details.byType[type] || { daily: 0, minutes: 0 };
            const amount = formatLeaveAmount(data.daily, data.minutes);
            itemsHtml += `
                <div class="detail-item" style="--item-color: ${t.color};">
                    <div class="detail-icon">${t.icon}</div>
                    <div class="detail-info"><div class="detail-label">${t.name}</div><div class="detail-value">${amount}</div></div>
                </div>
            `;
        });
        
        detailRow.innerHTML = `<td colspan="10"><div class="detail-grid">${itemsHtml}</div></td>`;
        tbody.appendChild(detailRow);
    });
}

function toggleRow(empId) {
    const mainRow = document.querySelector(`.main-row[data-emp-id="${empId}"]`);
    const detailRow = document.getElementById('detail-' + empId);
    if (!mainRow || !detailRow) return;
    document.querySelectorAll('.main-row.expanded').forEach(r => { if (r.getAttribute('data-emp-id') !== empId) r.classList.remove('expanded'); });
    document.querySelectorAll('.detail-row.show').forEach(r => { if (r.id !== 'detail-' + empId) r.classList.remove('show'); });
    mainRow.classList.toggle('expanded');
    detailRow.classList.toggle('show');
}

/* ==========================================
   نوێکردنەوەی سیستەم (Soft Refresh)
   ========================================== */
function softRefresh() {
    loadLeaveTypesFromStorage();
    refreshDashboard();
    console.log("سیستەمەکە نوێکرایەوە");
}

/* ==========================================
   فەنکشنەکانی بەکارهێنەر
   ========================================== */
function toggleUserDropdown(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('profileDropdown');
    const badge = document.getElementById('userBadge');
    if (dropdown) {
        dropdown.classList.toggle('show');
        badge.classList.toggle('active');
    }
}

document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('profileDropdown');
    const badge = document.getElementById('userBadge');
    if (dropdown && dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
        badge.classList.remove('active');
    }
});

function logout(event) {
    if (event) event.preventDefault();
    localStorage.removeItem('currentLoggedInUser');
    window.location.href = '../login/login.html';
}

function changePassword(event) {
    if (event) event.preventDefault();
    alert('تکایە بۆ گۆڕینی وشەی نهێنی، پەیوەندی بە بەڕێوەبەری سیستەم بکە.');
}

/* ==========================================
   هەڵبژاردنی لق
   ========================================== */
function populateBranchSelector() {
    const user = getCurrentUser();
    if (!user) return;
    const roleId = user.role || user.selectedRole;
    const roleInfo = ROLE_MAP[roleId];
    const level = roleInfo ? roleInfo.level : 0;
    const selectorWrap = document.getElementById('branchSelector');
    const select = document.getElementById('branchFilter');
    if (level < 3) { selectorWrap.style.display = 'none'; return; }
    selectorWrap.style.display = 'flex';
    const branches = loadBranches();
    select.innerHTML = '<option value="all">🌍 هەموو لقەکان</option>';
    branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = `🏢 ${b.name}`;
        select.appendChild(opt);
    });
}

function onBranchChange() { refreshDashboard(); }

/* ==========================================
   نوێکردنەوەی داشبۆرد
   ========================================== */
function refreshDashboard() {
    const employees = getFilteredEmployees();
    renderCards(employees);
    renderTable(employees);
}

/* ==========================================
   زانیاری بەکارهێنەر
   ========================================== */
function renderUserBadge() {
    const user = getCurrentUser();
    if (!user) return;
    const badge = document.getElementById('userBadge');
    const nameEl = document.getElementById('badgeName');
    const subEl = document.getElementById('headerSubtitle');
    const avatarEl = document.getElementById('userAvatar');
    const roleId = user.role || user.selectedRole;
    const roleInfo = ROLE_MAP[roleId] || { name: 'نەزانراو' };
    nameEl.innerText = user.name || '—';
    badge.style.display = 'flex';
    if (avatarEl) {
        avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=0D8ABC&color=fff&rounded=true`;
    }
    if (roleId === 'employee') subEl.innerText = `تەنها داتای خۆت دەبینیت`;
    else if (roleId === 'dept-manager') subEl.innerText = `لقی ${getBranchName(user.branch)} — کارمەندانی لقی خۆت`;
    else if (roleId === 'general-manager') subEl.innerText = `دەتوانیت هەموو لقەکان یان یەک لق هەڵبژێریت`;
    else subEl.innerText = `دەستڕاگەیشتنی تەواو بە هەموو لقەکان`;
}

/* ==========================================
   Sidebar Toggle & Stars & Init
   ========================================== */
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('active');
}

function createStars() {
    const starsContainer = document.getElementById('stars');
    const starCount = window.innerWidth < 768 ? 40 : 80;
    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        const size = Math.random() * 2 + 1;
        star.style.width = size + 'px';
        star.style.height = size + 'px';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.animationDelay = Math.random() * 3 + 's';
        star.style.animationDuration = (Math.random() * 2 + 2) + 's';
        starsContainer.appendChild(star);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = '../login/login.html';
        return;
    }
    loadLeaveTypesFromStorage();
    createStars();
    renderUserBadge();
    populateBranchSelector();
    refreshDashboard();
});