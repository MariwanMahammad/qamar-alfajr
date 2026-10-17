/* ==========================================
   Helpers
   ========================================== */
function loadAllLeaves() {
    return JSON.parse(localStorage.getItem('leaveRequests')) || [];
}

function loadAllEmployees() {
    return JSON.parse(localStorage.getItem('employeesList')) || [];
}

function loadBranches() {
    return JSON.parse(localStorage.getItem('branchesList')) || [];
}

function loadLeaveTypes() {
    return JSON.parse(localStorage.getItem('leaveTypesList')) || [];
}

function getBranchName(branchId) {
    let branches = loadBranches();
    let b = branches.find(x => x.id === branchId);
    return b ? b.name : '—';
}

function getEmployeeBranch(empName) {
    let employees = loadAllEmployees();
    let emp = employees.find(e => e.name === empName);
    if (emp && emp.branch) return getBranchName(emp.branch);
    return '—';
}

/* ==========================================
   حسابکردنی ڕۆژەکانی قمر الفجر و قمر لێل
   ========================================== */
function calculateBranchDays(leave) {
    let typeLabel = leave.typeLabel || leave.leaveType || leave.type || '';

    if (typeLabel === 'کاتی' || typeLabel === 'کاتژمێری') {
        if (!leave.startDate) return { fajr: 0, lail: 0 };
        let startDate = new Date(leave.startDate);
        let dayOfWeek = startDate.getDay();
        if (dayOfWeek === 5 || dayOfWeek === 6) {
            return { fajr: 1, lail: 0 };
        } else {
            return { fajr: 0, lail: 1 };
        }
    }

    let fajrDays = leave.fajrDays || 0;
    let lailDays = leave.lailDays || 0;
    if (fajrDays > 0 || lailDays > 0) {
        return { fajr: fajrDays, lail: lailDays };
    }

    if (!leave.startDate) return { fajr: 0, lail: 0 };
    let startDate = new Date(leave.startDate);
    let endDate = leave.endDate ? new Date(leave.endDate) : startDate;
    let fajr = 0, lail = 0;
    let curr = new Date(startDate);
    while (curr <= endDate) {
        let day = curr.getDay();
        if (day === 5 || day === 6) fajr++;
        else lail++;
        curr.setDate(curr.getDate() + 1);
    }
    return { fajr: fajr, lail: lail };
}

function getFajrDepartment(leave) {
    let validDepts = ['صندوق', 'کاشێر', 'حوالات', 'فیزەکارت'];
    if (leave.branchDepartment && validDepts.includes(leave.branchDepartment)) {
        return leave.branchDepartment;
    }
    return '';
}

/* ==========================================
   فۆرماتکردنی خانەکان
   ========================================== */
function formatBranchColumn(leave) {
    let days = calculateBranchDays(leave);
    let parts = [];
    if (days.fajr > 0) {
        let dept = getFajrDepartment(leave);
        let deptText = dept ? ` (${dept})` : '';
        parts.push(`<span style="color:#38bdf8;">🏢 قمر الفجر${deptText}</span>: <strong>${days.fajr} ڕۆژ</strong>`);
    }
    if (days.lail > 0) {
        parts.push(`<span style="color:#06b6d4;">🏢 قمر لێل</span>: <strong>${days.lail} ڕۆژ</strong>`);
    }
    return parts.length > 0 ? parts.join('<br>') : '<span style="color:#475569;">—</span>';
}

function formatDateRange(leave) {
    let start = leave.startDate || '—';
    let end = leave.endDate || '—';
    let typeLabel = leave.typeLabel || leave.leaveType || '';
    // ✅ بۆ مۆڵەتی کاتژمێری تەنها یەک ڕێکەوت پیشان دەدەین
    if (typeLabel === 'کاتژمێری' || start === end || !leave.endDate) {
        return `<span style="color:#e2e8f0;">${start}</span>`;
    }
    return `<span style="color:#e2e8f0;">${start}</span> <span style="color:#64748b;">→</span> <span style="color:#e2e8f0;">${end}</span>`;
}

function formatDateTime(leave, dateField, timeField) {
    if (!leave[dateField]) return '—';
    let time = leave[timeField] ? `<br><span style="font-size:10px; color:#64748b;">🕐 ${leave[timeField]}</span>` : '';
    return `${leave[dateField]}${time}`;
}

function formatNote(leave) {
    let note = leave.note || '';
    if (!note || note.trim() === '') return '<span style="color:#475569;">—</span>';
    if (note.length > 30) return `<span title="${note}">${note.substring(0, 30)}...</span>`;
    return note;
}

/* ==========================================
   دروستکردنی ڕیز
   ========================================== */
function buildRow(leave, index, rowNumber, statusType) {
    let branchHtml = formatBranchColumn(leave);
    let dateRangeHtml = formatDateRange(leave);
    let noteHtml = formatNote(leave);
    let submitHtml = formatDateTime(leave, 'submitDate', 'submitTime');
    let empBranch = getEmployeeBranch(leave.employee || leave.employeeName);

    let displayType = leave.typeLabel || leave.leaveType || leave.type || '—';
    let displayCategory = leave.category || leave.categoryName || '—';
    
    // ✅ زیادکردنی کاتەکان بۆ ماوەی مۆڵەت لە خشتەکەدا
    let displayDuration = leave.duration || '—';
    if ((displayType === 'کاتژمێری' || leave.type === 'hourly') && leave.startTime && leave.endTime) {
        displayDuration = `${leave.duration} (${leave.startTime} - ${leave.endTime})`;
    }

    let responseHtml = '';
    let rejectReasonHtml = '';

    if (statusType === 'approved' || statusType === 'rejected') {
        let statusText = statusType === 'approved' ? '✔️ پەسەندکراو' : '❌ ڕەتکراوە';
        let statusColor = statusType === 'approved' ? '#4ade80' : '#f87171';
        let responseDate = leave.responseDate || '—';
        let responseTime = leave.responseTime ? `<br><span style="font-size:10px; color:#64748b;">🕐 ${leave.responseTime}</span>` : '';
        responseHtml = `
            <td>
                <span style="color:${statusColor}; font-weight:bold;">${statusText}</span>
                <br><span style="font-size:10px; color:#94a3b8;">📅 ${responseDate}${responseTime}</span>
            </td>
        `;
    }

    if (statusType === 'rejected') {
        let reason = leave.rejectReason || leave.statusNote || '—';
        rejectReasonHtml = `<td style="font-size:11px; color:#fca5a5;">${reason}</td>`;
    }

    let actionsHtml = '';
    if (statusType === 'pending') {
        actionsHtml = `
            <button class="btn-action btn-approve" onclick="updateStatus(${index}, 'پەسەندکراو')">✅ پەسەند</button>
            <button class="btn-action btn-reject" onclick="updateStatus(${index}, 'ڕەتکراوە')">❌ ڕەت</button>
            <button class="btn-action btn-edit" onclick="openEditModal(${index})">✏️ دەستکاری</button>
            <button class="btn-action btn-delete" onclick="deleteLeave(${index})">🗑️ سڕینەوە</button>
        `;
    } else {
        actionsHtml = `
            <button class="btn-action btn-revert" onclick="openRevertModal(${index})">🔄 گەڕاندنەوە</button>
            <button class="btn-action btn-delete" onclick="deleteLeave(${index})">🗑️ سڕینەوە</button>
        `;
    }

    return `
        <tr>
            <td style="text-align:center; font-weight:bold; color:#00f3ff;">${rowNumber}</td>
            <td>
                <span style="color:#00f3ff; font-weight:bold;">${leave.employee || leave.employeeName || 'نادیار'}</span>
                <br><span style="font-size:11px; color:#94a3b8;">${leave.phone || ''}</span>
            </td>
            <td style="font-size:11px;">${empBranch}</td>
            <td>${displayType}</td>
            <td>${displayCategory}</td>
            <td>${displayDuration}</td>
            <td style="font-size:11px;">${dateRangeHtml}</td>
            <td style="font-size:11px;">${noteHtml}</td>
            ${statusType === 'rejected' ? rejectReasonHtml : ''}
            <td style="font-size:11px;">${submitHtml}</td>
            ${responseHtml}
            <td>
                <div class="action-btns">${actionsHtml}</div>
            </td>
        </tr>
    `;
}

/* ==========================================
   بارکردنی هەموو داتاکان
   ========================================== */
function loadAllData() {
    let allLeaves = loadAllLeaves();

    let pendingTable = document.getElementById('pendingLeavesTable');
    let approvedTable = document.getElementById('approvedLeavesTable');
    let rejectedTable = document.getElementById('rejectedLeavesTable');

    pendingTable.innerHTML = '';
    approvedTable.innerHTML = '';
    rejectedTable.innerHTML = '';

    let todayStr = new Date().toISOString().split('T')[0];

    let pendingCount = 0, approvedCount = 0, rejectedCount = 0;

    allLeaves.forEach((leave, index) => {
        let status = leave.status || 'چاوەڕوانکراو';

        if (status === 'چاوەڕوانکراو' || status === 'pending') {
            pendingCount++;
            pendingTable.innerHTML += buildRow(leave, index, pendingCount, 'pending');
        } else if (status === 'پەسەندکراو' || status === 'approved') {
            if (leave.responseDate === todayStr) {
                approvedCount++;
                approvedTable.innerHTML += buildRow(leave, index, approvedCount, 'approved');
            }
        } else if (status === 'ڕەتکراوە' || status === 'rejected') {
            if (leave.responseDate === todayStr) {
                rejectedCount++;
                rejectedTable.innerHTML += buildRow(leave, index, rejectedCount, 'rejected');
            }
        }
    });

    if (pendingCount === 0) {
        pendingTable.innerHTML = `<tr><td colspan="10" style="text-align:center; color:#666; padding:20px;">هیچ داواکارییەکی چاوەڕوانکراو نییە</td></tr>`;
    }
    if (approvedCount === 0) {
        approvedTable.innerHTML = `<tr><td colspan="11" style="text-align:center; color:#666; padding:20px;">ئەمڕۆ هیچ مۆڵەتێکی پەسەندکراو نییە</td></tr>`;
    }
    if (rejectedCount === 0) {
        rejectedTable.innerHTML = `<tr><td colspan="12" style="text-align:center; color:#666; padding:20px;">ئەمڕۆ هیچ مۆڵەتێکی ڕەتکراو نییە</td></tr>`;
    }

    populateFilters(allLeaves);
}

/* ==========================================
   پڕکردنەوەی فلتەرەکان
   ========================================== */
function populateFilters(allLeaves) {
    let branchSelect = document.getElementById('filterBranch');
    let currentBranch = branchSelect.value;
    let branches = loadBranches();
    branchSelect.innerHTML = '<option value="">هەموو لقەکان</option>';
    branches.forEach(b => {
        let opt = document.createElement('option');
        opt.value = b.name;
        opt.textContent = `🏢 ${b.name}`;
        branchSelect.appendChild(opt);
    });
    branchSelect.value = currentBranch;

    let categorySelect = document.getElementById('filterCategory');
    let currentCategory = categorySelect.value;
    let leaveTypes = loadLeaveTypes();
    if (leaveTypes.length === 0) {
        leaveTypes = [
            { id: 'regular', name: 'ئاسایی', icon: '📅' },
            { id: 'sick', name: 'نەخۆشی', icon: '🤒' },
            { id: 'maternity', name: 'دائیرە', icon: '👶' },
            { id: 'travel', name: 'سەفەر', icon: '✈️' },
            { id: 'condolence', name: 'تازیە', icon: '🕊️' },
            { id: 'marriage', name: 'هاوسەرگیری', icon: '💍' },
            { id: 'unpaid', name: 'بێ مووچە', icon: '💰' }
        ];
    }
    categorySelect.innerHTML = '<option value="">هەموو هۆکارەکان</option>';
    leaveTypes.forEach(t => {
        let opt = document.createElement('option');
        opt.value = t.name;
        opt.textContent = `${t.icon || '📌'} ${t.name}`;
        categorySelect.appendChild(opt);
    });
    categorySelect.value = currentCategory;

    let employeeSelect = document.getElementById('filterEmployee');
    let currentEmployee = employeeSelect.value;
    let employeeSet = new Set();
    allLeaves.forEach(leave => {
        if (leave.employee || leave.employeeName) {
            employeeSet.add(leave.employee || leave.employeeName);
        }
    });
    employeeSelect.innerHTML = '<option value="">هەموو کارمەندەکان</option>';
    Array.from(employeeSet).sort().forEach(emp => {
        let opt = document.createElement('option');
        opt.value = emp;
        opt.textContent = emp;
        employeeSelect.appendChild(opt);
    });
    employeeSelect.value = currentEmployee;
}

/* ==========================================
   گۆڕینی دۆخ
   ========================================== */
window.updateStatus = function(index, newStatus) {
    let allLeaves = loadAllLeaves();

    if (newStatus === 'ڕەتکراوە') {
        let reason = prompt('تکایە هۆکاری ڕەتکردنەوە بنووسە:');
        if (reason === null) return;
        if (reason.trim() === '') { alert('تکایە هۆکارێک بنووسە!'); return; }
        allLeaves[index].rejectReason = reason;
        allLeaves[index].statusNote = reason;
    }

    let now = new Date();
    allLeaves[index].status = newStatus;
    allLeaves[index].responseDate = now.toISOString().split('T')[0];
    allLeaves[index].responseTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    localStorage.setItem('leaveRequests', JSON.stringify(allLeaves));
    loadAllData();

    if (newStatus === 'پەسەندکراو') {
        alert('✅ داواکارییەکە بە سەرکەوتوویی پەسەندکرا و چووە بەشی پەسەندکراوەکان.');
    } else if (newStatus === 'ڕەتکراوە') {
        alert('❌ داواکارییەکە ڕەتکرایەوە و چووە بەشی ڕەتکراوەکان.');
    }
}

/* ==========================================
   دەستکاری
   ========================================== */
window.openEditModal = function(index) {
    let allLeaves = loadAllLeaves();
    let leave = allLeaves[index];
    if (!leave) { alert('مۆڵەتەکە نەدۆزرایەوە!'); return; }

    localStorage.setItem('editLeaveData', JSON.stringify({
        index: index,
        data: leave
    }));

    window.location.href = '../request-leave/request.html';
}

/* ==========================================
   گەڕاندنەوە
   ========================================== */
window.openRevertModal = function(index) {
    let allLeaves = loadAllLeaves();
    let leave = allLeaves[index];
    if (!leave) { alert('مۆڵەتەکە نەدۆزرایەوە!'); return; }

    let currentStatus = leave.status || 'چاوەڕوانکراو';
    let revertSelect = document.getElementById('revertStatus');
    revertSelect.innerHTML = '';

    if (currentStatus === 'پەسەندکراو') {
        revertSelect.innerHTML = `
            <option value="چاوەڕوانکراو">⏳ چاوەڕوانکراو</option>
            <option value="ڕەتکراوە">❌ ڕەتکراوە</option>
        `;
    } else if (currentStatus === 'ڕەتکراوە') {
        revertSelect.innerHTML = `
            <option value="چاوەڕوانکراو">⏳ چاوەڕوانکراو</option>
            <option value="پەسەندکراو">✅ پەسەندکراو</option>
        `;
    } else {
        revertSelect.innerHTML = `
            <option value="چاوەڕوانکراو">⏳ چاوەڕوانکراو</option>
            <option value="پەسەندکراو">✅ پەسەندکراو</option>
            <option value="ڕەتکراوە">❌ ڕەتکراوە</option>
        `;
    }

    document.getElementById('revertIndex').value = index;
    document.getElementById('revertReason').value = '';
    document.getElementById('revertReasonGroup').style.display = 'none';

    if (revertSelect.value === 'ڕەتکراوە') {
        document.getElementById('revertReasonGroup').style.display = 'flex';
    }

    revertSelect.onchange = function() {
        document.getElementById('revertReasonGroup').style.display =
            this.value === 'ڕەتکراوە' ? 'flex' : 'none';
    };

    document.getElementById('revertModal').style.display = 'flex';
}

window.closeRevertModal = function() {
    document.getElementById('revertModal').style.display = 'none';
}

window.confirmRevert = function() {
    let index = document.getElementById('revertIndex').value;
    let newStatus = document.getElementById('revertStatus').value;
    let reason = document.getElementById('revertReason').value;

    let allLeaves = loadAllLeaves();
    if (!allLeaves[index]) { alert('مۆڵەتەکە نەدۆزرایەوە!'); return; }

    if (newStatus === 'ڕەتکراوە') {
        if (reason.trim() === '') { alert('تکایە هۆکاری ڕەتکردنەوە بنووسە!'); return; }
        allLeaves[index].status = 'ڕەتکراوە';
        allLeaves[index].rejectReason = reason;
        allLeaves[index].statusNote = reason;
    } else if (newStatus === 'پەسەندکراو') {
        allLeaves[index].status = 'پەسەندکراو';
        allLeaves[index].rejectReason = '';
        allLeaves[index].statusNote = '';
    } else {
        allLeaves[index].status = 'چاوەڕوانکراو';
        allLeaves[index].rejectReason = '';
        allLeaves[index].statusNote = '';
    }

    let now = new Date();
    allLeaves[index].responseDate = now.toISOString().split('T')[0];
    allLeaves[index].responseTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    localStorage.setItem('leaveRequests', JSON.stringify(allLeaves));
    closeRevertModal();
    loadAllData();
    alert(`داواکارییەکە گەڕایەوە بۆ دۆخی "${newStatus}"!`);
}

/* ==========================================
   سڕینەوەی مۆڵەت
   ========================================== */
window.deleteLeave = function(index) {
    if (confirm('ئایا دڵنیایت لە سڕینەوەی ئەم داواکارییە؟')) {
        let allLeaves = loadAllLeaves();
        let deletedLeaves = JSON.parse(localStorage.getItem('deleted_leaves')) || [];
        let deletedLeave = { ...allLeaves[index] };
        deletedLeave.deletedDate = new Date().toISOString().split('T')[0];
        deletedLeave.deletedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        deletedLeaves.push(deletedLeave);
        localStorage.setItem('deleted_leaves', JSON.stringify(deletedLeaves));

        allLeaves.splice(index, 1);
        localStorage.setItem('leaveRequests', JSON.stringify(allLeaves));
        loadAllData();
        alert('داواکارییەکە بە سەرکەوتوویی سڕدرایەوە!');
    }
}

/* ==========================================
   فلتەرکردن
   ========================================== */
window.applyFilter = function() {
    let branchFilter = document.getElementById('filterBranch').value;
    let empFilter = document.getElementById('filterEmployee').value;
    let startDateFilter = document.getElementById('filterStartDate').value;
    let endDateFilter = document.getElementById('filterEndDate').value;
    let catFilter = document.getElementById('filterCategory').value;
    let typeFilter = document.getElementById('filterType').value;
    let statusFilter = document.getElementById('filterStatus').value;

    let allLeaves = loadAllLeaves();

    let filteredLeaves = allLeaves.filter(l => {
        let empBranch = getEmployeeBranch(l.employee || l.employeeName);
        if (branchFilter && empBranch !== branchFilter) return false;
        if (empFilter && (l.employee || l.employeeName) !== empFilter) return false;
        if (catFilter && (l.category || l.categoryName) !== catFilter) return false;
        if (typeFilter) {
            let typeLabel = l.typeLabel || l.leaveType || '';
            if (typeFilter === 'ڕۆژانە' && typeLabel !== 'ڕۆژانە') return false;
            if (typeFilter === 'کاتژمێری' && typeLabel !== 'کاتژمێری') return false;
        }
        if (statusFilter && (l.status || 'چاوەڕوانکراو') !== statusFilter) return false;
        if (startDateFilter && l.startDate && l.startDate < startDateFilter) return false;
        if (endDateFilter && l.endDate && l.endDate > endDateFilter) return false;
        return true;
    });

    let pendingTable = document.getElementById('pendingLeavesTable');
    let approvedTable = document.getElementById('approvedLeavesTable');
    let rejectedTable = document.getElementById('rejectedLeavesTable');
    pendingTable.innerHTML = '';
    approvedTable.innerHTML = '';
    rejectedTable.innerHTML = '';

    let pendingCount = 0, approvedCount = 0, rejectedCount = 0;

    filteredLeaves.forEach((leave) => {
        let originalIndex = allLeaves.indexOf(leave);
        let status = leave.status || 'چاوەڕوانکراو';

        if (status === 'چاوەڕوانکراو' || status === 'pending') {
            pendingCount++;
            pendingTable.innerHTML += buildRow(leave, originalIndex, pendingCount, 'pending');
        } else if (status === 'پەسەندکراو' || status === 'approved') {
            approvedCount++;
            approvedTable.innerHTML += buildRow(leave, originalIndex, approvedCount, 'approved');
        } else if (status === 'ڕەتکراوە' || status === 'rejected') {
            rejectedCount++;
            rejectedTable.innerHTML += buildRow(leave, originalIndex, rejectedCount, 'rejected');
        }
    });

    if (pendingCount === 0) pendingTable.innerHTML = `<tr><td colspan="10" style="text-align:center; color:#666; padding:20px;">هیچ داتایەک نەدۆزرایەوە بەپێی ئەم فلتەرە</td></tr>`;
    if (approvedCount === 0) approvedTable.innerHTML = `<tr><td colspan="11" style="text-align:center; color:#666; padding:20px;">هیچ داتایەک نەدۆزرایەوە بەپێی ئەم فلتەرە</td></tr>`;
    if (rejectedCount === 0) rejectedTable.innerHTML = `<tr><td colspan="12" style="text-align:center; color:#666; padding:20px;">هیچ داتایەک نەدۆزرایەوە بەپێی ئەم فلتەرە</td></tr>`;
}

window.resetFilter = function() {
    document.getElementById('filterBranch').value = '';
    document.getElementById('filterEmployee').value = '';
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterType').value = '';
    document.getElementById('filterStatus').value = '';
    loadAllData();
}

/* ==========================================
   ئەستێرەکان & Init
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

document.addEventListener('DOMContentLoaded', () => {
    createStars();
    loadAllData();
});