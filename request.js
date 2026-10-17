/* ==========================================
   Helpers
   ========================================== */
function loadEmployees() {
    return JSON.parse(localStorage.getItem('employeesList')) || [];
}

function loadBranches() {
    return JSON.parse(localStorage.getItem('branchesList')) || [];
}

function loadLeaveRequests() {
    return JSON.parse(localStorage.getItem('leaveRequests')) || [];
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

/* ==========================================
   Populate Dropdowns
   ========================================== */
function populateEmployeeDropdown() {
    const select = document.getElementById('selectEmployee');
    if (!select) return;
    const employees = loadEmployees();

    select.innerHTML = '<option value="">-- کارمەند هەڵبژێرە --</option>';

    if (employees.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '⚠️ هیچ کارمەندێک نییە — سەرەتا کارمەند زیاد بکە';
        opt.disabled = true;
        select.appendChild(opt);
        return;
    }

    employees.forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.id;
        opt.textContent = emp.name + (emp.branch ? ` (${getBranchName(emp.branch)})` : '');
        select.appendChild(opt);
    });
}

function populateLeaveCategories() {
    const select = document.getElementById('leaveCategory');
    if (!select) return;
    const types = loadLeaveTypes();

    select.innerHTML = '<option value="">-- هۆکار هەڵبژێرە --</option>';
    types.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = `${t.icon || '📌'} ${t.name}`;
        select.appendChild(opt);
    });
}

/* ==========================================
   Fill Employee Data
   ========================================== */
function fillEmployeeData() {
    const empId = document.getElementById('selectEmployee').value;
    const emp = loadEmployees().find(e => e.id === empId);

    if (emp) {
        document.getElementById('empNameAuto').value = emp.name || '';
        document.getElementById('empPhoneAuto').value = emp.phone || '';
    } else {
        document.getElementById('empNameAuto').value = '';
        document.getElementById('empPhoneAuto').value = '';
    }
}

/* ==========================================
   Toggle Leave Mode (ڕۆژانە / کاتژمێری)
   ========================================== */
function toggleLeaveMode() {
    const mode = document.getElementById('leaveType').value;
    const daysGroup = document.getElementById('daysGroup');
    const timeRangeGroup = document.getElementById('timeRangeGroup');
    const timeAlert = document.getElementById('timeErrorAlert');

    daysGroup.style.display = 'none';
    timeRangeGroup.style.display = 'none';

    if (mode === 'کاتژمێری') {
        timeRangeGroup.style.display = 'block';
        document.getElementById('leaveDays').value = 1;
    } else {
        daysGroup.style.display = 'flex';
        document.getElementById('startTime').value = '';
        document.getElementById('endTime').value = '';
    }

    timeAlert.style.display = 'none';
    timeAlert.classList.remove('show');
    calculateDates();
}

/* ==========================================
   Calculate Time Difference (کاتژمێری)
   ========================================== */
function calculateTimeDifference() {
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const errorAlert = document.getElementById('timeErrorAlert');
    const autoRange = document.getElementById('autoDateRange');

    if (!startTime || !endTime) {
        autoRange.value = 'تکایە هەردوو کاتەکە دیاری بکە';
        return;
    }

    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;

    if (startMins >= endMins) {
        errorAlert.innerHTML = '⚠️ هەڵە: کاتی دەستپێک نابێت لە کاتی کۆتایی گەورەتر بێت!';
        errorAlert.classList.add('show');
        autoRange.value = 'هەڵە لە دیاریکردنی کاتەکاندا';
        return;
    }

    errorAlert.classList.remove('show');

    const diffMins = endMins - startMins;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    let resultText = 'مۆڵەتی کاتژمێری: ';
    if (hours > 0) resultText += `${hours} کاتژمێر `;
    if (mins > 0) resultText += `و ${mins} دەقیقە`;
    autoRange.value = resultText;
}

/* ==========================================
   Calculate Dates (ڕۆژانە)
   ========================================== */
function calculateDates() {
    const startDateVal = document.getElementById('leaveStartDate').value;
    const leaveType = document.getElementById('leaveType').value;
    const daysCount = parseInt(document.getElementById('leaveDays').value) || 1;
    const autoRange = document.getElementById('autoDateRange');

    if (!startDateVal) return;

    if (leaveType === 'کاتژمێری') {
        calculateTimeDifference();
        return;
    }

    const startDate = new Date(startDateVal);
    let endDateFormatted = startDateVal;

    if (daysCount > 1) {
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + (daysCount - 1));
        endDateFormatted = endDate.toISOString().split('T')[0];
    }

    autoRange.value = `${daysCount} ڕۆژ (لە ${startDateVal} تا ${endDateFormatted})`;

    window.tempEndDateFormatted = endDateFormatted;
    window.tempDays = daysCount;
}

/* ==========================================
   Prepare Preview
   ========================================== */
function preparePreview(event) {
    event.preventDefault();

    const empId = document.getElementById('selectEmployee').value;
    const emp = loadEmployees().find(e => e.id === empId);

    if (!emp) { alert('⚠️ تکایە سەرەتا کارمەندێک هەڵبژێرە'); return; }

    const categoryId = document.getElementById('leaveCategory').value;
    if (!categoryId) { alert('⚠️ تکایە هۆکاری مۆڵەت هەڵبژێرە'); return; }

    const leaveTypeVal = document.getElementById('leaveType').value;
    const startDateVal = document.getElementById('leaveStartDate').value;

    if (!startDateVal) { alert('⚠️ تکایە ڕێکەوتی دەستپێک دیاری بکە'); return; }

    let amount = 0;
    let durationText = '';

    if (leaveTypeVal === 'ڕۆژانە') {
        amount = parseInt(document.getElementById('leaveDays').value) || 1;
        durationText = `${amount} ڕۆژ`;
    } else if (leaveTypeVal === 'کاتژمێری') {
        const st = document.getElementById('startTime').value;
        const et = document.getElementById('endTime').value;
        if (!st || !et) { alert('⚠️ تکایە کاتی دەستپێک و کۆتایی دیاری بکە'); return; }
        const [sh, sm] = st.split(':').map(Number);
        const [eh, em] = et.split(':').map(Number);
        const diffMins = (eh * 60 + em) - (sh * 60 + sm);
        if (diffMins <= 0) { alert('⚠️ کاتەکان هەڵەن'); return; }
        amount = diffMins;
        const h = Math.floor(diffMins / 60);
        const m = diffMins % 60;
        durationText = `${h}:${String(m).padStart(2, '0')} سعات`;
    }

    const now = new Date();
    const submitDate = now.toISOString().split('T')[0];
    const submitTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    let typeForDashboard = 'daily';
    if (leaveTypeVal === 'کاتژمێری') typeForDashboard = 'hourly';

    const categoryName = document.getElementById('leaveCategory').selectedOptions[0].textContent.trim();

    const leaveData = {
        id: 'req-' + Date.now(),
        employeeId: emp.id,
        employeeName: emp.name,
        employee: emp.name,
        phone: emp.phone,
        branch: emp.branch,
        type: typeForDashboard,
        typeLabel: leaveTypeVal,
        leaveType: leaveTypeVal,
        categoryId: categoryId,
        categoryName: categoryName,
        category: categoryName,
        amount: amount,
        startDate: startDateVal,
        endDate: leaveTypeVal === 'ڕۆژانە' ? (window.tempEndDateFormatted || startDateVal) : startDateVal,
        startTime: document.getElementById('startTime').value || '',
        endTime: document.getElementById('endTime').value || '',
        duration: durationText,
        note: document.getElementById('leaveNote').value.trim(),
        status: 'چاوەڕوانکراو',
        submitDate: submitDate,
        submitTime: submitTime,
        responseDate: '',
        responseTime: '',
        statusNote: ''
    };

    window.tempLeaveData = leaveData;
    document.getElementById('previewReceiptContent').innerHTML = buildReceiptHtml(leaveData, emp);
    document.getElementById('previewModal').classList.add('show');
}

/* ==========================================
   ✅ Build Receipt HTML (دەستکاریکراو بۆ مۆڵەتی کاتژمێری)
   ========================================== */
function buildReceiptHtml(leaveData, emp) {
    let photoHtml = '<span style="font-size: 28px;">👤</span>';
    if (emp && emp.photo) {
        photoHtml = `<img src="${emp.photo}" style="width: 100%; height: 100%; object-fit: cover;">`;
    }

    const categoryText = leaveData.categoryName || '—';
    const branchName = getBranchName(leaveData.branch);

    // ✅ دیاریکردنی ڕێکەوت بەپێی جۆری مۆڵەت
    let dateDisplayHtml = '';
    let durationDisplay = leaveData.duration;

    if (leaveData.typeLabel === 'کاتژمێری' || leaveData.type === 'hourly') {
        // بۆ مۆڵەتی کاتژمێری: تەنها یەک ڕێکەوت، و کاتەکان لەگەڵ ماوەکە
        dateDisplayHtml = `
            <div style="margin-bottom: 8px;">
                لە ڕێکەوتی: <strong style="color: #0f172a;">${leaveData.startDate}</strong>
            </div>
        `;
        if (leaveData.startTime && leaveData.endTime) {
            durationDisplay = `${leaveData.duration} (لە ${leaveData.startTime} بۆ ${leaveData.endTime})`;
        }
    } else {
        // بۆ مۆڵەتی ڕۆژانە: هەردوو ڕێکەوت
        dateDisplayHtml = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>لە ڕێکەوتی: <strong style="color: #0f172a;">${leaveData.startDate}</strong></span>
                <span>تاوەکو: <strong style="color: #0f172a;">${leaveData.endDate}</strong></span>
            </div>
        `;
    }

    return `
        <div style="text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 15px;">
            <div style="font-size: 20px; font-weight: bold; color: #0f172a;">کۆمپانیای قمر الفجر</div>
            <div style="font-size: 13px; color: #334155; margin-top: 3px;">پسوولەی فەرمی داواکردنی مۆڵەتی کارمەند</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">ڕێکەوتی داواکردن: ${leaveData.submitDate} — کات: ${leaveData.submitTime}</div>
        </div>

        <div style="background: linear-gradient(135deg, #0b0f19, #1e293b); color: #fff; padding: 12px 18px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-right: 4px solid #00f3ff;">
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="width: 55px; height: 55px; border-radius: 50%; background: #030407; border: 2px solid #00f3ff; display: flex; align-items: center; justify-content: center; overflow: hidden;">${photoHtml}</div>
                <div>
                    <div style="font-size: 12px; color: #94a3b8;">ناوی کارمەند:</div>
                    <div style="font-size: 15px; font-weight: bold; color: #00f3ff;">${leaveData.employeeName}</div>
                </div>
            </div>
            <div style="font-size: 13px; color: #e2e8f0; text-align: left;">
                <div style="font-size: 12px; color: #94a3b8;">ژمارەی مۆبایل:</div>
                <div style="font-size: 14px; color: #38bdf8; font-weight: bold;">${leaveData.phone || '—'}</div>
            </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px 18px; margin-bottom: 15px; font-size: 13px; color: #1e293b;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 8px;">
                <span>جۆری مۆڵەت: <strong style="color: #0284c7;">${leaveData.leaveType}</strong></span>
                <span>هۆکار: <strong style="color: #0d9488;">${categoryText}</strong></span>
            </div>
            <div style="margin-bottom: 8px;">ماوەی مۆڵەت: <strong style="color: #0f172a;">${durationDisplay}</strong></div>
            <div style="margin-bottom: 8px;">لق: <strong style="color: #0f172a;">${branchName}</strong></div>
            ${dateDisplayHtml}
        </div>

        <div style="background: #fefce8; border: 1px solid #fde047; border-radius: 10px; padding: 12px 18px; margin-bottom: 15px; font-size: 12px; color: #854d0e;">
            <strong>تێبینی / هۆکاری تێر و تەسەل:</strong>
            <div style="margin-top: 5px; color: #713f12;">${leaveData.note || 'هیچ تێبینییەک نییە...'}</div>
        </div>

        <div style="border-top: 1px dashed #cbd5e1; margin-top: 25px; padding-top: 15px; display: flex; justify-content: space-between; gap: 20px;">
            <div style="flex: 1; text-align: center;">
                <div style="font-size: 11px; color: #64748b; margin-bottom: 15px; background: #f1f5f9; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
                    📅 ڕێکەوتی پێشکەشکردن: <strong style="color: #0f172a;">${leaveData.submitDate || '—'}</strong><br>
                    ⏰ سعاتی پێشکەشکردن: <strong style="color: #0f172a;">${leaveData.submitTime || '—'}</strong>
                </div>
                <div style="font-weight: bold; color: #1e293b; font-size: 12px;">ئیمزای کارمەند</div>
                <div style="margin-top: 30px; border-bottom: 1px solid #64748b; width: 100%;"></div>
            </div>
            <div style="flex: 1; text-align: center;">
                <div style="font-size: 11px; color: #64748b; margin-bottom: 15px; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 8px; border-radius: 6px;">
                    📅 ڕێکەوتی وەڵامدانەوە: <strong style="color: #065f46;">${leaveData.responseDate || '—'}</strong><br>
                    ⏰ سعاتی وەڵامدانەوە: <strong style="color: #047857;">${leaveData.responseTime || '—'}</strong>
                </div>
                <div style="font-weight: bold; color: #1e293b; font-size: 12px;">ئیمزای بەڕێوەبەر</div>
                <div style="font-size: 10px; color: #64748b; margin-bottom: 5px;">کۆمپانیای قمر الفجر</div>
                <div style="border-bottom: 1px solid #64748b; width: 100%;"></div>
            </div>
        </div>
    `;
}

/* ==========================================
   Confirm Submit
   ========================================== */
function confirmSubmit() {
    const leaveData = window.tempLeaveData;
    if (!leaveData) { alert('هەڵەیەک ڕوویدا، تکایە دووبارە هەوڵبدەوە.'); return; }

    let editData = JSON.parse(localStorage.getItem('editLeaveData'));

    if (editData) {
        leaveData.id = editData.data.id;
        leaveData.submitDate = editData.data.submitDate;
        leaveData.submitTime = editData.data.submitTime;

        let allLeaves = loadLeaveRequests();
        allLeaves[editData.index] = leaveData;
        localStorage.setItem('leaveRequests', JSON.stringify(allLeaves));

        localStorage.removeItem('editLeaveData');

        document.getElementById('previewModal').classList.remove('show');
        alert('✅ دەستکارییەکە بە سەرکەوتوویی پاشەکەوت کرا!');
        window.location.href = '../response-leave/response.html';
        return;
    }

    const allLeaves = loadLeaveRequests();
    allLeaves.push(leaveData);
    localStorage.setItem('leaveRequests', JSON.stringify(allLeaves));

    document.getElementById('previewModal').classList.remove('show');
    alert('✅ داواکاری مۆڵەت بە سەرکەوتوویی تۆمارکرا!');

    document.querySelector('form').reset();
    document.getElementById('empNameAuto').value = '';
    document.getElementById('empPhoneAuto').value = '';
    document.getElementById('autoDateRange').value = '';
    document.getElementById('timeErrorAlert').classList.remove('show');

    window.tempLeaveData = null;
    window.tempEndDateFormatted = null;
    window.tempDays = 0;

    toggleLeaveMode();
}

/* ==========================================
   Cancel Preview
   ========================================== */
function cancelPreview() {
    document.getElementById('previewModal').classList.remove('show');
}

/* ==========================================
   Sidebar Toggle & Stars & Init
   ========================================== */
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
}

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

function checkEditMode() {
    let editData = JSON.parse(localStorage.getItem('editLeaveData'));
    if (!editData) return;

    let leave = editData.data;

    document.getElementById('selectEmployee').value = leave.employeeId || '';
    fillEmployeeData();

    let typeLabel = leave.typeLabel || leave.leaveType || 'ڕۆژانە';
    if (typeLabel === 'ڕۆژ و کاتژمێر') typeLabel = 'ڕۆژانە';
    
    document.getElementById('leaveType').value = typeLabel;
    toggleLeaveMode();

    document.getElementById('leaveCategory').value = leave.categoryId || '';
    document.getElementById('leaveStartDate').value = leave.startDate || '';

    if (typeLabel === 'کاتژمێری') {
        document.getElementById('startTime').value = leave.startTime || '';
        document.getElementById('endTime').value = leave.endTime || '';
        calculateTimeDifference();
    } else {
        document.getElementById('leaveDays').value = leave.amount || 1;
        calculateDates();
    }

    document.getElementById('leaveNote').value = leave.note || '';
    document.getElementById('submitBtn').innerText = '💾 پاشەکەوتکردنی دەستکاری';

    let infoBox = document.createElement('div');
    infoBox.style.cssText = 'background:#fef3c7; color:#92400e; padding:10px 15px; border-radius:10px; margin-bottom:15px; font-size:13px; text-align:center;';
    infoBox.innerHTML = '✏️ ئێستا لە دۆخی دەستکاریکردندانە — دەستکارییەکان بکە و پاشەکەوتی بکەوە.';
    document.querySelector('form').prepend(infoBox);
}

document.addEventListener('DOMContentLoaded', () => {
    createStars();
    populateEmployeeDropdown();
    populateLeaveCategories();
    toggleLeaveMode();
    checkEditMode();
});