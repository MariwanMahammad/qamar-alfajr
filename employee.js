/* ==========================================
   employee.js — یارمەتیدەرە بنەڕەتییەکان (داتای لق، مۆداڵ، پەیام)
   ئەمە employee.js ە (بێ s) — جیاوازە لە employees.js (بە s)!
   ڕیزبەندی بارکردن: employee.js ← branches.js ← employees.js ← leavetypes.js ← sidebar.js
   ========================================== */

/* ---------- داتای بنەڕەتی ---------- */
const DEFAULT_BRANCHES = [
    { id: 'qamar-fajr', name: 'کۆمپانیای قمر الفجر', active: true },
    { id: 'qamar-layl', name: 'نووسینگەی قمر لیل', active: true },
    { id: 'cc', name: 'نووسینگەی سی سی', active: true },
    { id: 'dani', name: 'نووسینگەی دانی', active: true },
    { id: 'qamar', name: 'نووسینگەی قمر', active: true }
];

const DEFAULT_ROLES = [
    { id: 'admin', name: 'بەڕێوەبەری سیستەم' },
    { id: 'general-manager', name: 'بەڕێوەبەری گشتی' },
    { id: 'dept-manager', name: 'بەڕێوەبەری بەش' },
    { id: 'employee', name: 'کارمەند' }
];

const STATUS_MAP = {
    'active': { text: 'چالاک', class: 'tag-status-active' },
    'inactive': { text: 'ناچالاک', class: 'tag-status-inactive' },
    'leave': { text: 'لە مۆڵەتدا', class: 'tag-status-leave' }
};

/* ---------- localStorage ---------- */
function loadBranches() {
    let data = JSON.parse(localStorage.getItem('branchesList'));
    if (!data || !Array.isArray(data) || data.length === 0) {
        data = [...DEFAULT_BRANCHES];
        localStorage.setItem('branchesList', JSON.stringify(data));
    }
    data.forEach(b => { if (typeof b.active === 'undefined') b.active = true; });
    return data;
}

function loadRoles() {
    let data = JSON.parse(localStorage.getItem('rolesList'));
    if (!data || !Array.isArray(data) || data.length === 0) {
        data = [...DEFAULT_ROLES];
        localStorage.setItem('rolesList', JSON.stringify(data));
    }
    return data;
}

function saveBranches(list) {
    localStorage.setItem('branchesList', JSON.stringify(list));
}

function countEmployeesInBranch(branchId) {
    const employees = JSON.parse(localStorage.getItem('employeesList')) || [];
    return employees.filter(e => e.branch === branchId).length;
}

/* ---------- ئەستێرەکان و مێنیۆ ---------- */
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
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('active');
}

/* ---------- پەیام ---------- */
function showMessage(elementId, text, type = 'error') {
    const msg = document.getElementById(elementId);
    if (!msg) return;
    msg.innerText = text;
    msg.className = 'message ' + type + ' show';
    clearTimeout(msg._timeout);
    msg._timeout = setTimeout(() => msg.classList.remove('show'), 4000);
}

/* ---------- چالاک / ناچالاک و سڕینەوەی لق ---------- */
function toggleBranchActive(id) {
    const branches = loadBranches();
    const idx = branches.findIndex(b => b.id === id);
    if (idx === -1) return;

    const wasActive = branches[idx].active;
    const empCount = countEmployeesInBranch(id);

    let msg = '';
    if (wasActive) {
        msg = empCount > 0
            ? `⚠️ ئاگاداربە: لقی "${branches[idx].name}" ${empCount} کارمەندی تێدایە.\n\nئەگەر ناچالاکی بکەیت، ئەم کارمەندانە ناتوانن بچنە ژوورەوە.\n\nدڵنیایت لە ناچالاککردن؟`
            : `دڵنیایت لە ناچالاککردنی لقی "${branches[idx].name}"؟`;
    } else {
        msg = `دڵنیایت لە چالاککردنی لقی "${branches[idx].name}"؟\nکارمەندانی ئەم لقە ئیتر دەتوانن بچنە ژوورەوە.`;
    }
    if (!confirm(msg)) return;

    branches[idx].active = !wasActive;
    saveBranches(branches);
    renderBranchesList();
    populateSelects();

    showMessage('branchMessage', wasActive
        ? `🚫 لقی "${branches[idx].name}" ناچالاک کرا — کارمەندان ناتوانن بچنە ژوورەوە`
        : `✅ لقی "${branches[idx].name}" چالاک کرا — کارمەندان دەتوانن بچنە ژوورەوە`, 'success');
}

function deleteBranch(id) {
    const branches = loadBranches();
    const branch = branches.find(b => b.id === id);
    if (!branch) return;

    const empCount = countEmployeesInBranch(id);
    if (empCount > 0) {
        showMessage('branchMessage', `🔒 ناتوانیت لقی "${branch.name}" بسڕیتەوە — ${empCount} کارمەندی تێدایە. سەرەتا کارمەندەکان بگوازەرەوە.`, 'error');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }
    if (!confirm(`دڵنیایت لە سڕینەوەی لقی "${branch.name}"؟`)) return;

    saveBranches(branches.filter(b => b.id !== id));
    renderBranchesList();
    populateSelects();
}

function toggleSwitch(el) {
    el.classList.toggle('on');
}

/* ---------- وێنەی کارمەند و وشەی نهێنی ---------- */
let empPhotoData = null;

function resetPhoto() {
    empPhotoData = null;
    const prev = document.getElementById('photoPreview');
    const file = document.getElementById('emp-photo');
    if (prev) prev.innerHTML = '<span class="placeholder">📷</span>';
    if (file) file.value = '';
}

function toggleEmpPassword(btn) {
    const input = btn.previousElementSibling;
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.innerText = input.type === 'password' ? '👁️‍🗨️' : '👁️';
}

function toggleCardPassword(empId, btn) {
    const el = document.getElementById('pwd-' + empId);
    if (!el) return;
    const realPwd = el.getAttribute('data-pwd');
    if (el.innerText === '••••••') {
        el.innerText = realPwd;
        btn.innerText = '🙈';
    } else {
        el.innerText = '••••••';
        btn.innerText = '👁️';
    }
}

/* ---------- مۆداڵ ---------- */
function openModal(id) {
    document.getElementById(id).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    document.body.style.overflow = '';
}

function initModalClose() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', function (e) {
            if (e.target === this) { this.classList.remove('active'); document.body.style.overflow = ''; }
        });
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(m => { m.classList.remove('active'); document.body.style.overflow = ''; });
        }
    });
}

/* ==========================================
   دەستپێکردن — هەر هەنگاوێک جیا دەکرێت، بۆ ئەوەی هەڵەیەک هەموو شتێک نەوەستێنێت
   (ئەو فەنکشنانە لە branches.js و employees.js و leavetypes.js دەهێنرێن)
   ========================================== */
document.addEventListener('DOMContentLoaded', () => {
    ['createStars', 'populateSelects', 'renderBranchesList', 'renderEmployeesList', 'renderLeaveTypes',
        'initBranchForm', 'initEditBranchForm', 'initEmployeeForm', 'initEditEmployeeForm',
        'initRenewContractForm', 'initPhotoUpload', 'initModalClose'
    ].forEach(name => {
        try { if (typeof window[name] === 'function') window[name](); }
        catch (e) { console.error(name, e); }
    });
});