/* ==========================================
   متغیرە گشتییەکان
   ========================================== */
let currentMenuLeave = null;
let openMenuKey = null;
const HOURS_PER_DAY = 8;
const ANNUAL_LEAVE_DAYS = 21;

/* ==========================================
   Helpers — خوێندنەوە لە localStorage
   ========================================== */
function loadLeaveRequests() {
    return JSON.parse(localStorage.getItem('leaveRequests')) || [];
}

function loadEmployees() {
    return JSON.parse(localStorage.getItem('employeesList')) || [];
}

function loadBranches() {
    return JSON.parse(localStorage.getItem('branchesList')) || [];
}

function loadLeaveTypes() {
    const stored = JSON.parse(localStorage.getItem('leaveTypesList'));
    if (!stored || !Array.isArray(stored) || stored.length === 0) {
        const defaults = [
            { id: 'regular', name: 'ئاسایی', icon: '📅' },
            { id: 'sick', name: 'نەخۆشی', icon: '🤒' },
            { id: 'maternity', name: 'دائیرە', icon: '👶' },
            { id: 'travel', name: 'سەفەر', icon: '✈️' },
            { id: 'condolence', name: 'تازیە', icon: '🕊️' },
            { id: 'marriage', name: 'هاوسەرگیری', icon: '💍' },
            { id: 'unpaid', name: 'بێ مووچە', icon: '💰' }
        ];
        localStorage.setItem('leaveTypesList', JSON.stringify(defaults));
        return defaults;
    }
    return stored;
}

function getBranchName(branchId) {
    const branches = loadBranches();
    const b = branches.find(x => x.id === branchId);
    return b ? b.name : '—';
}

function getEmployeeBranch(empName) {
    const employees = loadEmployees();
    const emp = employees.find(e => e.name === empName);
    if (emp && emp.branch) return getBranchName(emp.branch);
    return '—';
}

function getEmployeeBranchId(empName) {
    const employees = loadEmployees();
    const emp = employees.find(e => e.name === empName);
    return emp ? emp.branch : '';
}

/* ==========================================
   فۆرماتکردنی کات
   ========================================== */
function formatDuration(days, hours, minutes) {
    let parts = [];
    if (days > 0) parts.push(`${days} ڕۆژ`);
    if (hours > 0) parts.push(`${hours} سعات`);
    if (minutes > 0) parts.push(`${minutes} دقیقە`);
    return parts.length > 0 ? parts.join(' و ') : '0';
}

function minutesToDaysHoursMin(totalMinutes) {
    const isNegative = totalMinutes < 0;
    totalMinutes = Math.abs(totalMinutes);
    const totalHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const days = Math.floor(totalHours / HOURS_PER_DAY);
    const hours = totalHours % HOURS_PER_DAY;
    return { days, hours, minutes, isNegative };
}

/* ==========================================
   حسابکردنی ماوەی گرێبەست (لە ئەمڕۆوە)
   ========================================== */
function getContractRemaining(endDate) {
    if (!endDate) return '<span style="color:#64748b;">—</span>';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return '<span style="color:#ef4444; font-weight:bold;">⏳ کۆتایی هاتووە</span>';
    if (diffDays === 0) return '<span style="color:#f59e0b; font-weight:bold;">⚠️ کۆتایی ئەمڕۆ</span>';
    if (diffDays < 30) return `<span style="color:#f59e0b; font-weight:bold;">${diffDays} ڕۆژ</span>`;
    return `<span style="color:#10b981; font-weight:bold;">${diffDays} ڕۆژ</span>`;
}

function getContractStatus(emp) {
    const contracts = emp.contracts || [];
    if (contracts.length === 0) return 'no_contract';
    const lastContract = contracts[contracts.length - 1];
    if (!lastContract.end) return 'no_contract';
    const endDate = new Date(lastContract.end);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    return endDate >= today ? 'active' : 'expired';
}

/* ==========================================
   هەژمارکردنی بڕی مۆڵەت
   ========================================== */
function calculateLeaveAmounts(leave) {
    let dailyDays = 0;
    let hourlyMinutes = 0;

    const typeLabel = leave.typeLabel || leave.leaveType || leave.type || '';
    const amount = Number(leave.amount) || 0;

    if (typeLabel === 'کاتژمێری' || leave.type === 'hourly') {
        hourlyMinutes = amount;
    } else {
        dailyDays = amount;
    }
    return { dailyDays, hourlyMinutes };
}

function isApproved(leave) {
    const status = leave.status || '';
    return status === 'پەسەندکراو' || status === 'approved';
}

function isPending(leave) {
    const status = leave.status || 'چاوەڕوانکراو';
    return status === 'چاوەڕوانکراو' || status === 'pending';
}

function isRejected(leave) {
    const status = leave.status || '';
    return status === 'ڕەتکراوە' || status === 'rejected';
}

/* ==========================================
   پڕکردنەوەی فلتەرەکان
   ========================================== */
function loadFilterOptions() {
    const branchSelect = document.getElementById('filterBranch');
    const branches = loadBranches();
    branchSelect.innerHTML = '<option value="">هەموو لقەکان</option>';
    branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = `🏢 ${b.name}`;
        branchSelect.appendChild(opt);
    });

    const empSelect = document.getElementById('filterEmployee');
    const employees = loadEmployees();
    empSelect.innerHTML = '<option value="">هەموو کارمەندەکان</option>';
    employees.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.name;
        opt.textContent = emp.name;
        empSelect.appendChild(opt);
    });

    const catSelect = document.getElementById('filterCategory');
    const leaveTypes = loadLeaveTypes();
    catSelect.innerHTML = '<option value="">هەموو جۆرەکان</option>';
    leaveTypes.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.name;
        opt.textContent = `${t.icon || '📌'} ${t.name}`;
        catSelect.appendChild(opt);
    });

    const editCatSelect = document.getElementById('editCategory');
    if (editCatSelect) {
        editCatSelect.innerHTML = '';
        leaveTypes.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.name;
            opt.textContent = `${t.icon || '📌'} ${t.name}`;
            editCatSelect.appendChild(opt);
        });
    }
}

/* ==========================================
   دروستکردنی ڕیزەکان
   ========================================== */
function buildEmployeeRows(emp, empLeaves, contractInfo) {
    const rows = [];
    const sortedLeaves = [...empLeaves].sort((a, b) => {
        const aKey = (a.submitDate || '') + ' ' + (a.submitTime || '');
        const bKey = (b.submitDate || '') + ' ' + (b.submitTime || '');
        return aKey.localeCompare(bKey);
    });

    let runningBalance = ANNUAL_LEAVE_DAYS * HOURS_PER_DAY * 60;
    let runningUsed = 0;
    const balances = [];
    const usedTotals = [];

    sortedLeaves.forEach((leave) => {
        const { dailyDays, hourlyMinutes } = calculateLeaveAmounts(leave);
        const leaveMinutes = (dailyDays * HOURS_PER_DAY * 60) + hourlyMinutes;
        if (isApproved(leave)) {
            runningBalance -= leaveMinutes;
            runningUsed += leaveMinutes;
        }
        balances.push(runningBalance);
        usedTotals.push(runningUsed);
    });

    sortedLeaves.forEach((leave, idx) => {
        let leaveDateRange = '—';
        if (leave.startDate) {
            const typeLabel = leave.typeLabel || leave.leaveType || '';
            if (typeLabel === 'کاتژمێری' || leave.type === 'hourly') {
                leaveDateRange = `${leave.startDate}<br><span style="font-size:10px; color:#94a3b8;">${leave.startTime || ''} → ${leave.endTime || ''}</span>`;
            } else {
                leaveDateRange = `${leave.startDate}<br><span style="font-size:10px; color:#64748b;">→</span> ${leave.endDate || leave.startDate}`;
            }
        }

        const submitInfo = leave.submitDate
            ? `${leave.submitDate}<br><span style="font-size:10px; color:#94a3b8;">🕐 ${leave.submitTime || ''}</span>`
            : '—';

        let statusText = 'چاوەڕوانکراو';
        let statusColor = '#f59e0b';
        let statusIcon = '⏳';
        if (isApproved(leave)) {
            statusText = 'پەسەندکراو'; statusColor = '#10b981'; statusIcon = '✅';
        } else if (isRejected(leave)) {
            statusText = 'ڕەتکراوە'; statusColor = '#ef4444'; statusIcon = '❌';
        }

        let responseInfo = `<span style="color:${statusColor}; font-weight:bold;">${statusIcon} ${statusText}</span>`;
        if (leave.responseDate) {
            responseInfo += `<br><span style="font-size:10px; color:#94a3b8;">📅 ${leave.responseDate}<br>🕐 ${leave.responseTime || ''}</span>`;
        }

        let responseNote = '—';
        if (isRejected(leave) && (leave.rejectReason || leave.statusNote)) {
            responseNote = `<span style="color:#fca5a5;">${leave.rejectReason || leave.statusNote}</span>`;
        } else if (leave.statusNote) {
            responseNote = leave.statusNote;
        }

        const remBalance = balances[idx];
        let remainingText;
        if (remBalance < 0) {
            const over = minutesToDaysHoursMin(Math.abs(remBalance));
            remainingText = `<span style="color:#ef4444; font-weight:bold;">⚠️ ${formatDuration(over.days, over.hours, over.minutes)} زیاتر</span>`;
        } else {
            const rem = minutesToDaysHoursMin(remBalance);
            remainingText = `<span style="color:#10b981; font-weight:bold;">${formatDuration(rem.days, rem.hours, rem.minutes)}</span>`;
        }

        const usedB = usedTotals[idx];
        const used = minutesToDaysHoursMin(usedB);
        const usedText = formatDuration(used.days, used.hours, used.minutes);

        const categoryName = leave.category || leave.categoryName || '—';
        const annualLeaveInfo = `<b style="color:#00f3ff;">${categoryName}</b>`;

        const { dailyDays, hourlyMinutes } = calculateLeaveAmounts(leave);
        const dailyText = dailyDays > 0 ? `${dailyDays} ڕۆژ` : '—';
        const hourlyText = hourlyMinutes > 0
            ? `${Math.floor(hourlyMinutes / 60)}:${String(hourlyMinutes % 60).padStart(2, '0')} سعات`
            : '—';

        let leaveMode = leave.typeLabel || leave.leaveType || leave.type || '—';
        if (leaveMode === 'daily') leaveMode = 'ڕۆژانە';
        if (leaveMode === 'hourly') leaveMode = 'کاتژمێری';

        const noteText = leave.note
            ? (leave.note.length > 30 ? leave.note.substring(0, 30) + '...' : leave.note)
            : '—';

        const branchName = getEmployeeBranch(emp.name);
        const safeName = (emp.name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const safeSubmit = (leave.submitDate || '').replace(/'/g, "\\'");
        const safeStart = (leave.startDate || '').replace(/'/g, "\\'");

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align:center; font-weight:bold; color:#fbbf24;">${idx + 1}</td>
            <td style="font-weight:bold; color:#00f3ff;">${emp.name || '—'}</td>
            <td style="font-size:11px;">${contractInfo.remaining}</td>
            <td style="font-size:11px;">${annualLeaveInfo}</td>
            <td style="font-size:11px; color:#cbd5e1;">${branchName}</td>
            <td style="font-weight:bold; color:#a78bfa;">${leaveMode}</td>
            <td style="color:#a855f7; font-weight:bold;">${dailyText}</td>
            <td style="color:#a855f7; font-weight:bold;">${hourlyText}</td>
            <td style="color:#fbbf24; font-weight:bold;">${usedText}</td>
            <td>${remainingText}</td>
            <td style="font-size:11px; color:#cbd5e1;">${noteText}</td>
            <td style="font-size:11px; line-height:1.6;">${leaveDateRange}</td>
            <td style="font-size:11px; line-height:1.6; color:#38bdf8;">${submitInfo}</td>
            <td style="font-size:11px; line-height:1.6;">${responseInfo}</td>
            <td style="font-size:11px; line-height:1.6;">${responseNote}</td>
            <td style="text-align:center;">
                <button class="action-menu-btn" onclick="showActionMenu(event, '${safeName}', '${safeSubmit}', '${safeStart}')">⋮</button>
            </td>
        `;
        rows.push(tr);
    });

    return rows;
}

/* ==========================================
   فلتەرکردن و پیشاندان
   ========================================== */
window.applyFilters = function () {
    const branchFilter = document.getElementById('filterBranch').value;
    const empFilter = document.getElementById('filterEmployee').value;
    const startDateFilter = document.getElementById('filterStartDate').value;
    const endDateFilter = document.getElementById('filterEndDate').value;
    const contractFilter = document.getElementById('filterContract').value;
    const catFilter = document.getElementById('filterCategory').value;
    const typeFilter = document.getElementById('filterType').value;
    const statusFilter = document.getElementById('filterStatus').value;

    const leaves = loadLeaveRequests();
    const employees = loadEmployees();
    const tbody = document.querySelector('#reports-table tbody');
    tbody.innerHTML = '';

    if (employees.length === 0) {
        tbody.innerHTML = `<tr><td colspan="16" class="empty-row">هیچ کارمەندێک تۆمار نەکراوە</td></tr>`;
        return;
    }

    const filteredLeaves = leaves.filter(l => {
        if (empFilter && (l.employee || l.employeeName) !== empFilter) return false;
        if (branchFilter) {
            const empBranchId = getEmployeeBranchId(l.employee || l.employeeName);
            if (empBranchId !== branchFilter) return false;
        }
        if (startDateFilter && l.startDate && l.startDate < startDateFilter) return false;
        if (endDateFilter && l.endDate && l.endDate > endDateFilter) return false;
        if (catFilter && (l.category || l.categoryName) !== catFilter) return false;
        if (typeFilter) {
            const typeLabel = l.typeLabel || l.leaveType || '';
            if (typeFilter === 'ڕۆژانە' && typeLabel !== 'ڕۆژانە') return false;
            if (typeFilter === 'کاتژمێری' && typeLabel !== 'کاتژمێری') return false;
        }
        if (statusFilter) {
            if (statusFilter === 'پەسەندکراو' && !isApproved(l)) return false;
            if (statusFilter === 'ڕەتکراوە' && !isRejected(l)) return false;
            if (statusFilter === 'چاوەڕوانکراو' && !isPending(l)) return false;
        }
        return true;
    });

    const filteredByEmployee = {};
    filteredLeaves.forEach(l => {
        const empName = l.employee || l.employeeName || 'نادیار';
        if (!filteredByEmployee[empName]) filteredByEmployee[empName] = [];
        filteredByEmployee[empName].push(l);
    });

    let employeesToShow = employees;
    if (empFilter) employeesToShow = employees.filter(e => e.name === empFilter);
    if (branchFilter) employeesToShow = employeesToShow.filter(e => e.branch === branchFilter);

    if (contractFilter) {
        employeesToShow = employeesToShow.filter(emp => {
            const status = getContractStatus(emp);
            return status === contractFilter;
        });
    }

    let found = false;
    let counter = 0;

    employeesToShow.forEach(emp => {
        const empFilteredLeaves = filteredByEmployee[emp.name] || [];
        if (empFilteredLeaves.length === 0) return;

        const contractInfo = { remaining: '—' };
        if (emp.contracts && emp.contracts.length > 0) {
            const lastContract = emp.contracts[emp.contracts.length - 1];
            contractInfo.remaining = getContractRemaining(lastContract.end);
        }

        const rows = buildEmployeeRows(emp, empFilteredLeaves, contractInfo);
        rows.forEach(tr => {
            tr.querySelector('td:first-child').textContent = ++counter;
            tbody.appendChild(tr);
        });
        found = true;
    });

    if (!found) {
        tbody.innerHTML = `<tr><td colspan="16" class="empty-row">هیچ زانیارییەک نەدۆزرایەوە بەپێی ئەم فلتەرە</td></tr>`;
    }
}

window.resetFilters = function () {
    document.getElementById('filterBranch').value = '';
    document.getElementById('filterEmployee').value = '';
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    document.getElementById('filterContract').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterType').value = '';
    document.getElementById('filterStatus').value = '';
    document.querySelector('#reports-table tbody').innerHTML = `<tr><td colspan="16" class="empty-row">بۆ بینینی زانیارییەکان، تکایە دوگمەی "گەڕان" دابگرە</td></tr>`;
}

/* ==========================================
   Action Menu — Toggle
   ========================================== */
window.showActionMenu = function (event, empName, submitDate, startDate) {
    event.stopPropagation();
    event.preventDefault();

    const overlay = document.getElementById('actionMenuOverlay');
    const btn = event.currentTarget || event.target;
    const currentKey = empName + '|' + submitDate + '|' + startDate;

    if (openMenuKey === currentKey && overlay.classList.contains('show')) {
        overlay.classList.remove('show');
        openMenuKey = null;
        currentMenuLeave = null;
        return;
    }

    openMenuKey = currentKey;
    currentMenuLeave = { empName, submitDate, startDate };

    overlay.style.visibility = 'hidden';
    overlay.classList.add('show');

    const rect = btn.getBoundingClientRect();
    const menuWidth = 180;
    const menuHeight = overlay.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let leftPos = rect.left - menuWidth + rect.width;
    if (leftPos < 5) leftPos = 5;
    if (leftPos + menuWidth > window.innerWidth - 5) {
        leftPos = window.innerWidth - menuWidth - 5;
    }

    if (spaceBelow >= menuHeight + 10) {
        overlay.style.top = (rect.bottom + 5) + 'px';
    } else if (spaceAbove >= menuHeight + 10) {
        overlay.style.top = (rect.top - menuHeight - 5) + 'px';
    } else {
        overlay.style.top = Math.max(5, rect.bottom - menuHeight) + 'px';
    }

    overlay.style.left = leftPos + 'px';
    overlay.style.visibility = 'visible';
}

/* ==========================================
   فەنکشنەکانی مێنیۆ
   ========================================== */
window.menuView = function () {
    if (!currentMenuLeave) return;
    document.getElementById('actionMenuOverlay').classList.remove('show');
    openMenuKey = null;
    viewLeaveDetails(currentMenuLeave.empName, currentMenuLeave.submitDate, currentMenuLeave.startDate);
}

window.menuRevert = function () {
    if (!currentMenuLeave) return;
    document.getElementById('actionMenuOverlay').classList.remove('show');
    openMenuKey = null;
    openStatusModalWith(currentMenuLeave.empName, currentMenuLeave.submitDate, currentMenuLeave.startDate, 'چاوەڕوانکراو');
}

window.menuEdit = function () {
    if (!currentMenuLeave) return;
    document.getElementById('actionMenuOverlay').classList.remove('show');
    openMenuKey = null;
    openEditModalForEmp(currentMenuLeave.empName, currentMenuLeave.submitDate, currentMenuLeave.startDate);
}

window.menuDelete = function () {
    if (!currentMenuLeave) return;
    document.getElementById('actionMenuOverlay').classList.remove('show');
    openMenuKey = null;
    deleteSingleLeave(currentMenuLeave.empName, currentMenuLeave.submitDate, currentMenuLeave.startDate);
}

window.menuPrint = function () {
    if (!currentMenuLeave) return;
    document.getElementById('actionMenuOverlay').classList.remove('show');
    openMenuKey = null;
    printSingleLeaveReport(currentMenuLeave.empName, currentMenuLeave.submitDate, currentMenuLeave.startDate);
}

/* ==========================================
   وردەکاری مۆڵەت
   ========================================== */
window.viewLeaveDetails = function (empName, submitDate, startDate) {
    const leaves = loadLeaveRequests();
    const employees = loadEmployees();
    const empData = employees.find(e => e.name === empName);

    const leave = leaves.find(l =>
        (l.employee || l.employeeName) === empName &&
        (l.submitDate || '') === submitDate &&
        (l.startDate || '') === startDate
    );

    if (!leave) { alert('مۆڵەتەکە نەدۆزرایەوە!'); return; }

    let statusText = 'چاوەڕوانکراو';
    let statusColor = '#f59e0b';
    if (isApproved(leave)) { statusText = 'پەسەندکراو'; statusColor = '#10b981'; }
    else if (isRejected(leave)) { statusText = 'ڕەتکراوە'; statusColor = '#ef4444'; }

    let rejectionBox = '';
    if (isRejected(leave) && (leave.rejectReason || leave.statusNote)) {
        rejectionBox = `<div class="note-box" style="background:#fee2e2; border-color:#ef4444; color:#991b1b;"><b>هۆکاری ڕەتکردنەوە:</b><div>${leave.rejectReason || leave.statusNote}</div></div>`;
    }

    let photoHtml = '<span style="font-size:28px;">👤</span>';
    if (empData && empData.photo) photoHtml = `<img src="${empData.photo}" style="width:100%; height:100%; object-fit:cover;">`;

    const popupHtml = `<!DOCTYPE html>
    <html dir="rtl"><head><title>وردەکاری مۆڵەت</title>
    <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Vazirmatn', sans-serif; background: #f8fafc; padding: 20px; direction: rtl; }
        .receipt { max-width: 620px; margin: 0 auto; background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 15px; }
        .header h1 { font-size: 20px; color: #0f172a; margin: 0; }
        .header p { font-size: 13px; color: #334155; margin: 5px 0 0; }
        .emp-box { background: linear-gradient(135deg, #0b0f19, #1e293b); color: #fff; padding: 12px 18px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-right: 4px solid #00f3ff; }
        .emp-photo { width: 55px; height: 55px; border-radius: 50%; background: #030407; border: 2px solid #00f3ff; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .info-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px 18px; margin-bottom: 15px; font-size: 13px; color: #1e293b; }
        .info-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #e2e8f0; }
        .info-row:last-child { border-bottom: none; }
        .note-box { background: #fefce8; border: 1px solid #fde047; border-radius: 10px; padding: 12px 18px; font-size: 12px; color: #854d0e; margin-bottom: 15px; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 6px; font-weight: bold; color: #fff; background: ${statusColor}; }
        .footer { border-top: 1px dashed #cbd5e1; margin-top: 25px; padding-top: 15px; display: flex; justify-content: space-between; font-size: 12px; color: #334155; }
    </style></head><body>
    <div class="receipt">
        <div class="header">
            <h1>نووسینگەی قمر لێل</h1>
            <p>وردەکاری کامڵی مۆڵەت</p>
        </div>
        <div class="emp-box">
            <div style="display:flex; align-items:center; gap:15px;">
                <div class="emp-photo">${photoHtml}</div>
                <div>
                    <div style="font-size:12px; color:#94a3b8;">ناوی کارمەند:</div>
                    <div style="font-size:15px; font-weight:bold; color:#00f3ff;">${empName}</div>
                </div>
            </div>
            <div style="text-align:left;">
                <div style="font-size:12px; color:#94a3b8;">ژمارەی مۆبایل:</div>
                <div style="font-size:14px; color:#38bdf8; font-weight:bold;">${empData ? empData.phone : '-'}</div>
            </div>
        </div>
        <div class="info-box">
            <div class="info-row"><span>ڕۆڵ:</span><b>${empData ? empData.role : '-'}</b></div>
            <div class="info-row"><span>لق:</span><b>${getEmployeeBranch(empName)}</b></div>
            <div class="info-row"><span>دۆخی کارمەند:</span><b>${empData ? empData.status : '-'}</b></div>
        </div>
        <div class="info-box">
            <div class="info-row"><span>شێوازی مۆڵەت:</span><b>${leave.typeLabel || leave.leaveType || leave.type || '-'}</b></div>
            <div class="info-row"><span>جۆری مۆڵەت:</span><b>${leave.category || leave.categoryName || '-'}</b></div>
            <div class="info-row"><span>ماوە:</span><b>${leave.duration || '-'}</b></div>
            <div class="info-row"><span>لە ڕێکەوتی:</span><b>${leave.startDate || '-'}</b></div>
            <div class="info-row"><span>بۆ ڕێکەوتی:</span><b>${leave.endDate || '-'}</b></div>
            <div class="info-row"><span>داواکاری مۆڵەت:</span><b>${leave.submitDate || '-'} - ${leave.submitTime || ''}</b></div>
            <div class="info-row"><span>وەڵامدانەوە:</span><span class="status-badge">${statusText}</span></div>
            ${leave.responseDate ? `<div class="info-row"><span>ڕێکەوتی وەڵام:</span><b>${leave.responseDate} - ${leave.responseTime || ''}</b></div>` : ''}
        </div>
        ${rejectionBox}
        <div class="note-box">
            <b>تێبینی:</b>
            <div>${leave.note || 'هیچ تێبینییەک نییە'}</div>
        </div>
        <div class="footer">
            <div>ئیمزای کارمەند: __________________</div>
            <div>ئیمزای بەڕێوەبەر: __________________</div>
        </div>
    </div>
    </body></html>`;

    const popupWindow = window.open('', '', 'height=700,width=800');
    popupWindow.document.write(popupHtml);
    popupWindow.document.close();
}

/* ==========================================
   دەستکاری مۆڵەت
   ========================================== */
window.openEditModalForEmp = function (empName, submitDate, startDate) {
    const leaves = loadLeaveRequests();
    const leaveIndex = leaves.findIndex(l =>
        (l.employee || l.employeeName) === empName &&
        (l.submitDate || '') === submitDate &&
        (l.startDate || '') === startDate
    );

    if (leaveIndex === -1) { alert('مۆڵەتەکە نەدۆزرایەوە!'); return; }

    const l = leaves[leaveIndex];
    document.getElementById('editIndex').value = leaveIndex;
    document.getElementById('editType').value = l.typeLabel || l.leaveType || l.type || 'ڕۆژانە';
    document.getElementById('editCategory').value = l.category || l.categoryName || '';
    document.getElementById('editDuration').value = l.duration || '';
    document.getElementById('editStartDate').value = l.startDate || '';
    document.getElementById('editEndDate').value = l.endDate || '';
    document.getElementById('editNote').value = l.note || '';
    document.getElementById('editModal').style.display = 'flex';
}

window.closeEditModal = function () {
    document.getElementById('editModal').style.display = 'none';
}

window.saveEditLeave = function () {
    const index = document.getElementById('editIndex').value;
    const leaves = loadLeaveRequests();
    leaves[index].typeLabel = document.getElementById('editType').value;
    leaves[index].leaveType = document.getElementById('editType').value;
    leaves[index].category = document.getElementById('editCategory').value;
    leaves[index].categoryName = document.getElementById('editCategory').value;
    leaves[index].duration = document.getElementById('editDuration').value;
    leaves[index].startDate = document.getElementById('editStartDate').value;
    leaves[index].endDate = document.getElementById('editEndDate').value;
    leaves[index].note = document.getElementById('editNote').value;
    localStorage.setItem('leaveRequests', JSON.stringify(leaves));
    closeEditModal();
    alert('مۆڵەتەکە بە سەرکەوتوویی دەستکاری کرا!');
    applyFilters();
}

/* ==========================================
   گۆڕینی دۆخ
   ========================================== */
window.openStatusModalWith = function (empName, submitDate, startDate, status) {
    document.getElementById('statusEmpName').value = empName;
    document.getElementById('statusSubmitDate').value = submitDate;
    document.getElementById('statusStartDate').value = startDate;
    document.getElementById('newStatus').value = status;
    document.getElementById('statusNote').value = '';
    document.getElementById('statusModal').style.display = 'flex';
}

window.closeStatusModal = function () {
    document.getElementById('statusModal').style.display = 'none';
}

window.saveStatusChange = function () {
    const empName = document.getElementById('statusEmpName').value;
    const submitDate = document.getElementById('statusSubmitDate').value;
    const startDate = document.getElementById('statusStartDate').value;
    const newStatus = document.getElementById('newStatus').value;
    const note = document.getElementById('statusNote').value;

    if (note.trim() === '') {
        alert('تکایە هۆکار / تێبینی بنووسە بۆ گۆڕینی دۆخ!');
        return;
    }

    const now = new Date();
    const responseDate = now.toISOString().split('T')[0];
    const responseTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const leaves = loadLeaveRequests();
    const idx = leaves.findIndex(l =>
        (l.employee || l.employeeName) === empName &&
        (l.submitDate || '') === submitDate &&
        (l.startDate || '') === startDate
    );

    if (idx === -1) { alert('مۆڵەتەکە نەدۆزرایەوە!'); return; }

    leaves[idx].status = newStatus;
    leaves[idx].statusNote = note;
    if (newStatus === 'ڕەتکراوە') leaves[idx].rejectReason = note;
    leaves[idx].responseDate = responseDate;
    leaves[idx].responseTime = responseTime;

    localStorage.setItem('leaveRequests', JSON.stringify(leaves));
    closeStatusModal();
    alert('دۆخی مۆڵەتەکە بە سەرکەوتوویی گۆڕدرا!');
    applyFilters();
}

/* ==========================================
   سڕینەوە
   ========================================== */
window.deleteSingleLeave = function (empName, submitDate, startDate) {
    if (!confirm(`ئایا دڵنیایت لە سڕینەوەی ئەم مۆڵەتە؟`)) return;

    const leaves = loadLeaveRequests();
    const idx = leaves.findIndex(l =>
        (l.employee || l.employeeName) === empName &&
        (l.submitDate || '') === submitDate &&
        (l.startDate || '') === startDate
    );

    if (idx === -1) { alert('مۆڵەتەکە نەدۆزرایەوە!'); return; }

    leaves.splice(idx, 1);
    localStorage.setItem('leaveRequests', JSON.stringify(leaves));
    alert('مۆڵەتەکە بە سەرکەوتوویی سڕدرایەوە!');
    applyFilters();
}

/* ==========================================
   ✅ پرینتی تاکە مۆڵەت — A5 Portrait (وەک پسوولەی جوان)
   ========================================== */
window.printSingleLeaveReport = function (empName, submitDate, startDate) {
    const leaves = loadLeaveRequests();
    const employees = loadEmployees();
    const empData = employees.find(e => e.name === empName);

    const leave = leaves.find(l =>
        (l.employee || l.employeeName) === empName &&
        (l.submitDate || '') === submitDate &&
        (l.startDate || '') === startDate
    );

    if (!leave) { alert('مۆڵەتەکە نەدۆزرایەوە!'); return; }

    let statusText = 'چاوەڕوانکراو';
    let statusColor = '#f59e0b';
    if (isApproved(leave)) { statusText = 'پەسەندکراو'; statusColor = '#10b981'; }
    else if (isRejected(leave)) { statusText = 'ڕەتکراوە'; statusColor = '#ef4444'; }

    let photoHtml = '<span style="font-size: 22px;">👤</span>';
    if (empData && empData.photo) {
        photoHtml = `<img src="${empData.photo}" style="width: 100%; height: 100%; object-fit: cover;">`;
    }

    const branchName = getEmployeeBranch(empName);
    const categoryText = leave.category || leave.categoryName || '—';
    const leaveTypeText = leave.typeLabel || leave.leaveType || leave.type || '—';
    const startDateVal = leave.startDate || '—';
    const endDateVal = leave.endDate || leave.startDate || '—';
    const submitDateVal = leave.submitDate || '—';
    const submitTimeVal = leave.submitTime || '—';
    const responseDateVal = leave.responseDate || '—';
    const responseTimeVal = leave.responseTime || '—';

    let rejectReason = '';
    if (isRejected(leave) && (leave.rejectReason || leave.statusNote)) {
        rejectReason = leave.rejectReason || leave.statusNote;
    }

    const printWindow = window.open('', '', 'height=800,width=800');
    printWindow.document.write('<!DOCTYPE html><html dir="rtl"><head><title>پسوولەی مۆڵەت</title>');
    printWindow.document.write('<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700&display=swap" rel="stylesheet">');
    printWindow.document.write(`<style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Vazirmatn', sans-serif; 
            background: #f1f5f9; 
            padding: 10px; 
            direction: rtl; 
            color: #0f172a; 
        }
        
        .receipt { 
            width: 148mm; 
            height: 210mm;
            margin: 0 auto; 
            background: #fff; 
            padding: 8mm 10mm; 
            border-radius: 8px; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            display: flex;
            flex-direction: column;
        }
        
        .header { 
            text-align: center; 
            border-bottom: 2px solid #0284c7; 
            padding-bottom: 8px; 
            margin-bottom: 12px;
            flex-shrink: 0;
        }
        .header h1 { font-size: 16px; color: #0f172a; margin: 0; font-weight: 700; }
        .header p { font-size: 10px; color: #334155; margin: 3px 0 0; }
        .header .meta { font-size: 9px; color: #64748b; margin-top: 3px; }
        
        .emp-box { 
            background: linear-gradient(135deg, #0b0f19, #1e293b); 
            color: #fff; 
            padding: 8px 12px; 
            border-radius: 8px; 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            border-right: 4px solid #00f3ff; 
            margin-bottom: 12px;
            flex-shrink: 0;
        }
        .emp-left { display: flex; align-items: center; gap: 10px; }
        .emp-photo { 
            width: 40px; height: 40px; 
            border-radius: 50%; 
            background: #030407; 
            border: 2px solid #00f3ff; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            overflow: hidden; 
            flex-shrink: 0; 
        }
        .emp-photo img { width: 100%; height: 100%; object-fit: cover; }
        .emp-name-label { font-size: 9px; color: #94a3b8; }
        .emp-name-value { font-size: 13px; font-weight: bold; color: #00f3ff; margin-top: 2px; }
        .emp-right { text-align: left; }
        .emp-phone-label { font-size: 9px; color: #94a3b8; }
        .emp-phone-value { font-size: 12px; color: #38bdf8; font-weight: bold; margin-top: 2px; }
        
        .info-box { 
            background: #f8fafc; 
            border: 1px solid #cbd5e1; 
            border-radius: 8px; 
            padding: 8px 12px; 
            margin-bottom: 10px;
        }
        .info-box-title {
            font-size: 11px;
            font-weight: 700;
            color: #0284c7;
            margin-bottom: 6px;
            padding-bottom: 4px;
            border-bottom: 1px solid #e2e8f0;
        }
        .info-row { 
            display: flex; 
            justify-content: space-between; 
            padding: 4px 0; 
            border-bottom: 1px dashed #e2e8f0; 
            font-size: 10px; 
        }
        .info-row:last-child { border-bottom: none; }
        .info-label { color: #64748b; }
        .info-value { color: #0f172a; font-weight: 700; }
        .status-badge { 
            display: inline-block; 
            padding: 2px 10px; 
            border-radius: 5px; 
            font-weight: bold; 
            color: #fff; 
            background: ${statusColor}; 
            font-size: 9px; 
        }
        
        .note-box { 
            background: #fefce8; 
            border: 1px solid #fde047; 
            border-radius: 8px; 
            padding: 8px 12px; 
            font-size: 10px; 
            color: #854d0e; 
            margin-bottom: 10px;
        }
        .note-title { font-weight: bold; margin-bottom: 3px; color: #713f12; font-size: 10px; }
        .note-content { color: #713f12; line-height: 1.5; font-size: 10px; }
        
        .reject-box { 
            background: #fee2e2; 
            border: 1px solid #ef4444; 
            border-radius: 8px; 
            padding: 8px 12px; 
            font-size: 10px; 
            color: #991b1b; 
            margin-bottom: 10px;
        }
        .reject-title { font-weight: bold; margin-bottom: 3px; }
        
        .footer { 
            border-top: 1px dashed #cbd5e1; 
            padding-top: 10px; 
            display: flex; 
            justify-content: space-between; 
            gap: 10px; 
            margin-top: auto;
            flex-shrink: 0;
        }
        .footer-col { flex: 1; text-align: center; }
        .footer-box { 
            font-size: 9px; 
            color: #64748b; 
            margin-bottom: 8px; 
            padding: 6px; 
            border-radius: 6px; 
            text-align: center; 
        }
        .footer-box.blue { background: #eff6ff; border: 1px solid #bfdbfe; }
        .footer-box.green { background: #ecfdf5; border: 1px solid #a7f3d0; }
        .footer-box .fb-title { font-size: 8px; color: #64748b; margin-bottom: 2px; }
        .footer-box .fb-value { font-size: 10px; font-weight: 700; color: #0f172a; }
        .footer-box .fb-value.green { color: #065f46; }
        .footer-title { font-weight: bold; color: #1e293b; font-size: 10px; margin-bottom: 2px; }
        .footer-sub { font-size: 8px; color: #64748b; margin-bottom: 3px; }
        .footer-line { border-bottom: 1px solid #64748b; width: 100%; margin-top: 20px; }
        
        @page { size: A5 portrait; margin: 0; }
        
        @media print { 
            body { background: #fff; padding: 0; margin: 0; }
            .receipt { 
                box-shadow: none; 
                width: 148mm;
                height: 210mm;
                padding: 8mm 10mm;
                margin: 0;
                border-radius: 0;
            }
        }
    </style></head><body>`);

    printWindow.document.write(`
    <div class="receipt">
        <div class="header">
            <h1>کۆمپانیای قمر الفجر</h1>
            <p>پسوولەی فەرمی داواکردنی مۆڵەتی کارمەند</p>
            <div class="meta">ڕێکەوتی داواکردن: ${submitDateVal} — کات: ${submitTimeVal}</div>
        </div>

        <div class="emp-box">
            <div class="emp-left">
                <div class="emp-photo">${photoHtml}</div>
                <div>
                    <div class="emp-name-label">ناوی کارمەند:</div>
                    <div class="emp-name-value">${empName}</div>
                </div>
            </div>
            <div class="emp-right">
                <div class="emp-phone-label">ژمارەی مۆبایل:</div>
                <div class="emp-phone-value">${empData && empData.phone ? empData.phone : '—'}</div>
            </div>
        </div>

        <div class="info-box">
            <div class="info-row">
                <span class="info-label">جۆری مۆڵەت:</span>
                <span class="info-value">${leaveTypeText}</span>
            </div>
            <div class="info-row">
                <span class="info-label">هۆکار:</span>
                <span class="info-value">${categoryText}</span>
            </div>
            <div class="info-row">
                <span class="info-label">ماوەی مۆڵەت:</span>
                <span class="info-value">${leave.duration || '—'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">لق:</span>
                <span class="info-value">${branchName}</span>
            </div>
            <div class="info-row">
                <span class="info-label">لە ڕێکەوتی:</span>
                <span class="info-value">${startDateVal}</span>
            </div>
            <div class="info-row">
                <span class="info-label">تاوەکو:</span>
                <span class="info-value">${endDateVal}</span>
            </div>
            <div class="info-row">
                <span class="info-label">دۆخی مۆڵەت:</span>
                <span class="status-badge">${statusText}</span>
            </div>
        </div>

        <div class="note-box">
            <div class="note-title">📝 تێبینی / هۆکاری تێر و تەسەل:</div>
            <div class="note-content">${leave.note || 'هیچ تێبینییەک نییە...'}</div>
        </div>

        ${rejectReason ? `
        <div class="reject-box">
            <div class="reject-title">❌ هۆکاری ڕەتکردنەوە:</div>
            <div>${rejectReason}</div>
        </div>
        ` : ''}

        <div class="footer">
            <div class="footer-col">
                <div class="footer-box blue">
                    <div class="fb-title">📅 ڕێکەوتی پێشکەشکردن:</div>
                    <div class="fb-value">${submitDateVal}</div>
                    <div class="fb-title" style="margin-top: 5px;">⏰ سعاتی پێشکەشکردن:</div>
                    <div class="fb-value">${submitTimeVal}</div>
                </div>
                <div class="footer-title">ئیمزای کارمەند</div>
                <div class="footer-sub">کۆمپانیای قمر الفجر</div>
                <div class="footer-line"></div>
            </div>
            <div class="footer-col">
                <div class="footer-box green">
                    <div class="fb-title">📅 ڕێکەوتی وەڵامدانەوە:</div>
                    <div class="fb-value green">${responseDateVal}</div>
                    <div class="fb-title" style="margin-top: 5px;">⏰ سعاتی وەڵامدانەوە:</div>
                    <div class="fb-value green">${responseTimeVal}</div>
                </div>
                <div class="footer-title">ئیمزای بەڕێوەبەر</div>
                <div class="footer-sub">نووسینگەی قمر لێل</div>
                <div class="footer-line"></div>
            </div>
        </div>
    </div>
    `);

    printWindow.document.write('</body></html>');
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 700);
}

/* ==========================================
   Excel Export
   ========================================== */
window.exportToExcel = function () {
    const leaves = loadLeaveRequests();
    const employees = loadEmployees();
    if (employees.length === 0) { alert('هیچ داتایەک نییە!'); return; }

    const groupedByEmployee = {};
    leaves.forEach(l => {
        const empName = l.employee || l.employeeName || 'نادیار';
        if (!groupedByEmployee[empName]) groupedByEmployee[empName] = [];
        groupedByEmployee[empName].push(l);
    });

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="UTF-8"><style>
        table { border-collapse: collapse; width: 100%; font-family: Vazirmatn, sans-serif; }
        th { background: #0b0f19; color: #00f3ff; padding: 8px; border: 1px solid #1e293b; font-size: 11px; }
        td { padding: 6px; border: 1px solid #ccc; font-size: 11px; text-align: right; }
        @page { size: A4 landscape; margin: 10mm; }
    </style></head><body>
    <h2 style="text-align:center;">نووسینگەی قمر لێل - ڕاپۆرتی گشتی</h2>
    <table><thead><tr>
    <th>ژمارە</th><th>ناوی کارمەند</th><th>ماوەی گرێبەست</th><th>هۆکار</th><th>لق</th><th>شێوازی مۆڵەت</th>
    <th>ڕۆژانە</th><th>کاتژمێری</th><th>کۆی بەکارهاتوو</th><th>کۆی ماوە</th><th>تێبینی</th>
    <th>ڕێکەوتی مۆڵەت</th><th>داواکاری مۆڵەت</th><th>دۆخ و وەڵام</th><th>تێبینی وەڵام</th>
    </tr></thead><tbody>`;

    employees.forEach(emp => {
        const empLeaves = groupedByEmployee[emp.name] || [];
        if (empLeaves.length === 0) return;

        let contractRemaining = '—';
        if (emp.contracts && emp.contracts.length > 0) {
            const last = emp.contracts[emp.contracts.length - 1];
            contractRemaining = getContractRemaining(last.end).replace(/<[^>]*>/g, '');
        }

        const sortedLeaves = [...empLeaves].sort((a, b) => {
            const aKey = (a.submitDate || '') + ' ' + (a.submitTime || '');
            const bKey = (b.submitDate || '') + ' ' + (b.submitTime || '');
            return aKey.localeCompare(bKey);
        });

        let runningBalance = ANNUAL_LEAVE_DAYS * HOURS_PER_DAY * 60;
        let runningUsed = 0;
        const balances = [], usedTotals = [];
        sortedLeaves.forEach(leave => {
            const { dailyDays, hourlyMinutes } = calculateLeaveAmounts(leave);
            const leaveMinutes = (dailyDays * HOURS_PER_DAY * 60) + hourlyMinutes;
            if (isApproved(leave)) {
                runningBalance -= leaveMinutes;
                runningUsed += leaveMinutes;
            }
            balances.push(runningBalance);
            usedTotals.push(runningUsed);
        });

        sortedLeaves.forEach((leave, idx) => {
            const branchName = getEmployeeBranch(emp.name);
            const leaveMode = leave.typeLabel || leave.leaveType || leave.type || '—';
            const categoryName = leave.category || leave.categoryName || '—';
            const { dailyDays, hourlyMinutes } = calculateLeaveAmounts(leave);
            const dailyText = dailyDays > 0 ? dailyDays + ' ڕۆژ' : '—';
            const hourlyText = hourlyMinutes > 0 ? Math.floor(hourlyMinutes / 60) + ':' + String(hourlyMinutes % 60).padStart(2, '0') + ' سعات' : '—';

            const remB = balances[idx];
            let remText = '—';
            if (remB < 0) {
                const o = minutesToDaysHoursMin(Math.abs(remB));
                remText = '⚠️ ' + formatDuration(o.days, o.hours, o.minutes) + ' زیاتر';
            } else {
                const r = minutesToDaysHoursMin(remB);
                remText = formatDuration(r.days, r.hours, r.minutes);
            }

            const usedB = usedTotals[idx];
            const u = minutesToDaysHoursMin(usedB);
            const usedText = formatDuration(u.days, u.hours, u.minutes);

            let statusText = 'چاوەڕوانکراو';
            if (isApproved(leave)) statusText = 'پەسەندکراو';
            else if (isRejected(leave)) statusText = 'ڕەتکراوە';

            const responseText = statusText + (leave.responseDate ? ' (' + leave.responseDate + ')' : '');
            const responseNote = leave.rejectReason || leave.statusNote || '—';

            html += `<tr>
                <td>${idx + 1}</td><td>${emp.name}</td><td>${contractRemaining}</td>
                <td>${categoryName}</td><td>${branchName}</td>
                <td>${leaveMode}</td><td>${dailyText}</td><td>${hourlyText}</td>
                <td>${usedText}</td><td>${remText}</td><td>${leave.note || '—'}</td>
                <td>${leave.startDate || '—'} → ${leave.endDate || '—'}</td>
                <td>${leave.submitDate || '—'} ${leave.submitTime || ''}</td>
                <td>${responseText}</td><td>${responseNote}</td>
            </tr>`;
        });
    });
    html += `</tbody></table></body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reports_' + new Date().toISOString().split('T')[0] + '.xls';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/* ==========================================
   PDF Export (ڕاپۆرتی گشتی)
   ========================================== */
window.exportToPDF = function () {
    const branchFilter = document.getElementById('filterBranch').value;
    const empFilter = document.getElementById('filterEmployee').value;
    const startDateFilter = document.getElementById('filterStartDate').value;
    const endDateFilter = document.getElementById('filterEndDate').value;
    const contractFilter = document.getElementById('filterContract').value;
    const catFilter = document.getElementById('filterCategory').value;
    const typeFilter = document.getElementById('filterType').value;
    const statusFilter = document.getElementById('filterStatus').value;

    const leaves = loadLeaveRequests();
    const employees = loadEmployees();

    const filteredLeaves = leaves.filter(l => {
        if (empFilter && (l.employee || l.employeeName) !== empFilter) return false;
        if (branchFilter) {
            const empBranchId = getEmployeeBranchId(l.employee || l.employeeName);
            if (empBranchId !== branchFilter) return false;
        }
        if (startDateFilter && l.startDate && l.startDate < startDateFilter) return false;
        if (endDateFilter && l.endDate && l.endDate > endDateFilter) return false;
        if (catFilter && (l.category || l.categoryName) !== catFilter) return false;
        if (typeFilter) {
            const typeLabel = l.typeLabel || l.leaveType || '';
            if (typeFilter === 'ڕۆژانە' && typeLabel !== 'ڕۆژانە') return false;
            if (typeFilter === 'کاتژمێری' && typeLabel !== 'کاتژمێری') return false;
        }
        if (statusFilter) {
            if (statusFilter === 'پەسەندکراو' && !isApproved(l)) return false;
            if (statusFilter === 'ڕەتکراوە' && !isRejected(l)) return false;
            if (statusFilter === 'چاوەڕوانکراو' && !isPending(l)) return false;
        }
        return true;
    });

    const filteredByEmployee = {};
    filteredLeaves.forEach(l => {
        const empName = l.employee || l.employeeName || 'نادیار';
        if (!filteredByEmployee[empName]) filteredByEmployee[empName] = [];
        filteredByEmployee[empName].push(l);
    });

    let employeesToShow = employees;
    if (empFilter) employeesToShow = employees.filter(e => e.name === empFilter);
    if (branchFilter) employeesToShow = employeesToShow.filter(e => e.branch === branchFilter);
    if (contractFilter) {
        employeesToShow = employeesToShow.filter(emp => getContractStatus(emp) === contractFilter);
    }

    const branchTitle = branchFilter ? getBranchName(branchFilter) : 'هەموو لقەکان';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB');
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    let pdfHtml = `<!DOCTYPE html>
    <html dir="rtl">
    <head>
        <title>ڕاپۆرتی مۆڵەت - کۆمپانیای قمر الفجر</title>
        <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Vazirmatn', sans-serif; direction: rtl; padding: 12px; color: #0f172a; background: #fff; }
            .report-header { text-align: center; border-bottom: 3px double #0284c7; padding-bottom: 10px; margin-bottom: 15px; }
            .report-header h1 { font-size: 20px; color: #0f172a; margin: 0 0 5px; }
            .report-header .branch-name { font-size: 14px; color: #0284c7; font-weight: 600; margin-bottom: 5px; }
            .report-header .meta { font-size: 10px; color: #64748b; }
            .employee-section { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; margin-bottom: 15px; page-break-inside: avoid; }
            .employee-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #00f3ff; }
            .employee-name { font-size: 14px; font-weight: 700; color: #0284c7; }
            .employee-phone { font-size: 11px; color: #334155; margin-top: 2px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 8px; font-size: 11px; }
            .info-item { padding: 5px 8px; background: #fff; border-radius: 5px; border: 1px solid #e2e8f0; color: #334155; }
            .info-item b { color: #0f172a; }
            .summary-box { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 10px; }
            .summary-item { text-align: center; padding: 8px; border-radius: 6px; }
            .summary-item.taken { background: #fef3c7; border: 1px solid #fbbf24; }
            .summary-item.remaining { background: #d1fae5; border: 1px solid #10b981; }
            .summary-item.extra { background: #fee2e2; border: 1px solid #ef4444; }
            .summary-item .label { font-size: 10px; color: #64748b; margin-bottom: 3px; }
            .summary-item .value { font-size: 12px; font-weight: 700; color: #0f172a; }
            .breakdown-title { font-size: 12px; font-weight: 700; color: #0284c7; margin-bottom: 5px; }
            .breakdown-table { width: 100%; border-collapse: collapse; font-size: 10px; }
            .breakdown-table th { background: #0b0f19; color: #00f3ff; padding: 6px; border: 1px solid #1e293b; text-align: center; }
            .breakdown-table td { padding: 5px 8px; border: 1px solid #e2e8f0; text-align: center; color: #334155; }
            .breakdown-table tr:nth-child(even) td { background: #f8fafc; }
            .no-data { text-align: center; padding: 40px; color: #94a3b8; font-size: 14px; }
            .footer-note { margin-top: 20px; text-align: center; font-size: 9px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
            @page { size: A4 portrait; margin: 10mm; }
        </style>
    </head>
    <body>
        <div class="report-header">
            <h1>🏢 کۆمپانیای قمر الفجر</h1>
            <div class="branch-name">لق: ${branchTitle}</div>
            <div class="meta">ڕێکەوتی پرینت: ${dateStr} - کات: ${timeStr}</div>
        </div>
    `;

    let hasData = false;

    employeesToShow.forEach(emp => {
        const empFilteredLeaves = filteredByEmployee[emp.name] || [];
        if (empFilteredLeaves.length === 0) return;
        hasData = true;

        let contractStart = '—', contractEnd = '—';
        if (emp.contracts && emp.contracts.length > 0) {
            const last = emp.contracts[emp.contracts.length - 1];
            contractStart = last.start || '—';
            contractEnd = last.end || '—';
        }

        let totalDailyDays = 0, totalHourlyMinutes = 0;
        const categoryStats = {};
        const leaveTypes = loadLeaveTypes();
        leaveTypes.forEach(t => { categoryStats[t.name] = { daily: 0, minutes: 0 }; });

        empFilteredLeaves.forEach(leave => {
            if (isApproved(leave)) {
                const { dailyDays, hourlyMinutes } = calculateLeaveAmounts(leave);
                totalDailyDays += dailyDays;
                totalHourlyMinutes += hourlyMinutes;

                const cat = leave.category || leave.categoryName || '—';
                if (!categoryStats[cat]) categoryStats[cat] = { daily: 0, minutes: 0 };
                categoryStats[cat].daily += dailyDays;
                categoryStats[cat].minutes += hourlyMinutes;
            }
        });

        const totalUsedMinutes = (totalDailyDays * HOURS_PER_DAY * 60) + totalHourlyMinutes;
        const totalEntitlementMinutes = ANNUAL_LEAVE_DAYS * HOURS_PER_DAY * 60;
        const remainingMinutes = totalEntitlementMinutes - totalUsedMinutes;
        const extraMinutes = remainingMinutes < 0 ? Math.abs(remainingMinutes) : 0;

        const used = minutesToDaysHoursMin(totalUsedMinutes);
        const usedText = formatDuration(used.days, used.hours, used.minutes);

        let remainingText, extraText;
        if (remainingMinutes >= 0) {
            const rem = minutesToDaysHoursMin(remainingMinutes);
            remainingText = formatDuration(rem.days, rem.hours, rem.minutes);
            extraText = '—';
        } else {
            remainingText = '—';
            const ext = minutesToDaysHoursMin(extraMinutes);
            extraText = formatDuration(ext.days, ext.hours, ext.minutes);
        }

        const typeSet = new Set();
        empFilteredLeaves.forEach(l => {
            const typeLabel = l.typeLabel || l.leaveType || l.type || '';
            if (typeLabel) {
                if (typeLabel === 'daily') typeSet.add('ڕۆژانە');
                else if (typeLabel === 'hourly') typeSet.add('کاتژمێری');
                else typeSet.add(typeLabel);
            }
        });
        const typeDisplay = Array.from(typeSet).join(' / ') || '—';

        const allStartDates = empFilteredLeaves.map(l => l.startDate).filter(Boolean).sort();
        const dateRange = allStartDates.length > 0
            ? (allStartDates.length === 1
                ? allStartDates[0]
                : `${allStartDates[0]} → ${allStartDates[allStartDates.length - 1]}`)
            : '—';

        pdfHtml += `
        <div class="employee-section">
            <div class="employee-header">
                <div>
                    <div class="employee-name">👤 ${emp.name}</div>
                    <div class="employee-phone">📱 ${emp.phone || '—'}</div>
                </div>
                <div style="text-align: left;">
                    <div style="font-size: 10px; color: #64748b;">جۆری مۆڵەتی وەرگیراو</div>
                    <div style="font-size: 12px; font-weight: 700; color: #0284c7;">${typeDisplay}</div>
                </div>
            </div>

            <div class="info-grid">
                <div class="info-item">📅 ڕێکەوتی مۆڵەت: <b>${dateRange}</b></div>
                <div class="info-item">📄 گرێبەست: <b>${contractStart} → ${contractEnd}</b></div>
            </div>

            <div class="summary-box">
                <div class="summary-item taken">
                    <div class="label">📊 کۆی وەرگیراو</div>
                    <div class="value">${usedText}</div>
                </div>
                <div class="summary-item remaining">
                    <div class="label">✅ کۆی ماوە</div>
                    <div class="value">${remainingText}</div>
                </div>
                <div class="summary-item extra">
                    <div class="label">⚠️ کۆی زیادە</div>
                    <div class="value">${extraText}</div>
                </div>
            </div>

            <div class="breakdown-title">📋 وردەکاری جۆرەکانی مۆڵەت:</div>
            <table class="breakdown-table">
                <thead>
                    <tr>
                        <th>جۆری مۆڵەت</th>
                        <th>ڕۆژ</th>
                        <th>سعات و دقیقە</th>
                    </tr>
                </thead>
                <tbody>
        `;

        let hasCategories = false;
        Object.keys(categoryStats).forEach(cat => {
            const s = categoryStats[cat];
            if (s.daily > 0 || s.minutes > 0) {
                hasCategories = true;
                const hh = Math.floor(s.minutes / 60);
                const mm = String(s.minutes % 60).padStart(2, '0');
                pdfHtml += `
                    <tr>
                        <td>${cat}</td>
                        <td>${s.daily > 0 ? s.daily + ' ڕۆژ' : '—'}</td>
                        <td>${s.minutes > 0 ? hh + ':' + mm + ' سعات' : '—'}</td>
                    </tr>
                `;
            }
        });

        if (!hasCategories) {
            pdfHtml += `<tr><td colspan="3" style="text-align:center; color:#94a3b8;">هیچ مۆڵەتێکی پەسەندکراو نییە</td></tr>`;
        }

        pdfHtml += `
                </tbody>
            </table>
        </div>
        `;
    });

    if (!hasData) {
        pdfHtml += `<div class="no-data">📭 هیچ داتایەک نەدۆزرایەوە بەپێی ئەم فلتەرە</div>`;
    }

    pdfHtml += `
        <div class="footer-note">
            ئەم ڕاپۆرتە بە شێوەی ئۆتۆماتیکی لە سیستەمی مۆڵەتی کۆمپانیای قمر الفجر دروستکراوە
        </div>
    </body>
    </html>
    `;

    const printWindow = window.open('', '', 'height=800,width=1000');
    printWindow.document.write(pdfHtml);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 600);
}

/* ==========================================
   ئەستێرەکان
   ========================================== */
function createStars() {
    const starsContainer = document.getElementById('stars');
    if (!starsContainer) return;
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

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
}

/* ==========================================
   Init
   ========================================== */
document.addEventListener('DOMContentLoaded', function () {
    createStars();
    loadFilterOptions();

    document.querySelector('#reports-table tbody').innerHTML = `<tr><td colspan="16" class="empty-row">بۆ بینینی زانیارییەکان، تکایە دوگمەی "گەڕان" دابگرە</td></tr>`;

    document.addEventListener('click', function (e) {
        const overlay = document.getElementById('actionMenuOverlay');
        if (overlay && overlay.classList.contains('show')) {
            if (!e.target.closest('.action-menu-btn') && !e.target.closest('.action-menu-overlay')) {
                overlay.classList.remove('show');
                openMenuKey = null;
            }
        }
    });
});