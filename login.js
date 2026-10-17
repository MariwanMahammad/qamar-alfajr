/* ==========================================
   ڕێکخستن
   ========================================== */
// true = وشەی نهێنی لە لۆگیندا دەبێت مەرجەکانی هەبێت (کەپیتاڵ + ژمارە + هێما)
// ئەگەر کارمەندی کۆنت هەیە بە وشەی نهێنی ئاسایی، بیکە false
const REQUIRE_STRONG_ON_LOGIN = true;

// true = کۆدی گەڕاندنەوە لەسەر شاشە پیشان دەدرێت (تاقیکردنەوە)
// کاتێک بەستتەوە بە ئیمەیل/SMS ی ڕاستەقینە (deliverCode)، بیکە false
const DEMO_MODE = true;

/* ==========================================
   داتای بنەڕەتی
   ========================================== */
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

const ROLE_MAP = {
    'admin': 'بەڕێوەبەری سیستەم',
    'general-manager': 'بەڕێوەبەری گشتی',
    'dept-manager': 'بەڕێوەبەری بەش',
    'employee': 'کارمەند'
};

/* ==========================================
   Helpers
   ========================================== */
const g = id => document.getElementById(id);

function loadEmployees() {
    try { return JSON.parse(localStorage.getItem('employeesList')) || []; } catch (e) { return []; }
}

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

function getRoleDisplayName(roleId) {
    if (ROLE_MAP[roleId]) return ROLE_MAP[roleId];
    const found = loadRoles().find(r => r.id === roleId);
    return found ? found.name : '';
}

// ژمارەی مۆبایل: ئەگەر ناوی خانەکە لە add-employee جیاوازە، لێرە زیادی بکە
const phoneOf = e => e.phone || e.mobile || e.phoneNumber || '';
const normName = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const lastDigits = s => String(s || '').replace(/\D/g, '').slice(-10);

/* ==========================================
   مەرجەکانی وشەی نهێنی
   ========================================== */
const PW_RULES = [
    { id: 'up',  text: 'یەک پیتی کەپیتاڵ (A-Z)', ok: p => /[A-Z]/.test(p) },
    { id: 'num', text: 'یەک ژمارە (0-9)', ok: p => /[0-9]/.test(p) },
    { id: 'sym', text: 'یەک هێما (!@#$%...)', ok: p => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(p) }
];
const isStrong = p => PW_RULES.every(r => r.ok(p));
const PW_ERROR = '❌ وشەی نهێنی دەبێت یەک پیتی کەپیتاڵ و یەک ژمارە و یەک هێمای تێدابێت';

function bindRules(inputId, boxId) {
    const input = g(inputId), box = g(boxId);
    box.innerHTML = PW_RULES.map(r => `<span class="rule" data-id="${r.id}">${r.text}</span>`).join('');
    input.addEventListener('input', () => {
        PW_RULES.forEach(r => box.querySelector(`[data-id="${r.id}"]`).classList.toggle('ok', r.ok(input.value)));
    });
}

// چاو: وشەی نهێنی بە شاراوەیی دەست پێدەکات، کلیک لەسەر چاو پیشانی دەدات
const SVG = p => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const EYE = SVG('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>');
const EYE_OFF = SVG('<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>');

function setEye(btn, show) {
    btn.previousElementSibling.type = show ? 'text' : 'password';
    btn.innerHTML = show ? EYE : EYE_OFF;
    btn.setAttribute('aria-label', show ? 'شاردنەوەی وشەی نهێنی' : 'پیشاندانی وشەی نهێنی');
}
function hideAllPasswords() { document.querySelectorAll('.toggle-password').forEach(b => setEye(b, false)); }
function togglePassword(inputId, btn) { setEye(btn, g(inputId).type === 'password'); }

/* ==========================================
   ئەستێرەکان
   ========================================== */
function createStars() {
    const starsContainer = g('stars');
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

/* ==========================================
   ڕێکەوت و کات
   ========================================== */
function updateDateTime() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
    g('datetime').innerText = `${day}/${month}/${now.getFullYear()} | ${timeStr}`;
}
setInterval(updateDateTime, 1000);
updateDateTime();

function showMessage(text, type = 'error', ms = 6000) {
    const msg = g('message');
    msg.innerHTML = text;
    msg.className = 'message ' + type + ' show';
    clearTimeout(window._msgTimeout);
    window._msgTimeout = setTimeout(() => msg.classList.remove('show'), ms);
}

function setLoading(isLoading) {
    const loginBtn = g('loginBtn');
    const btnText = loginBtn.querySelector('.btn-text');
    loginBtn.disabled = isLoading;
    loginBtn.classList.toggle('loading', isLoading);
    btnText.innerText = isLoading ? 'چاوەڕێ بکە...' : 'چوونە ژوورەوە';
}

/* ==========================================
   چوونەژوورەوە (ناوی بەکارهێنەر + وشەی نهێنی)
   ========================================== */
g('login-form').addEventListener('submit', function (event) {
    event.preventDefault();

    const inputName = g('login-name').value;
    const inputPassword = g('login-password').value;

    if (!inputName.trim() || !inputPassword) {
        showMessage('تکایە هەموو خانەکان پڕ بکەرەوە', 'error');
        return;
    }

    if (REQUIRE_STRONG_ON_LOGIN && !isStrong(inputPassword)) {
        showMessage(PW_ERROR, 'error');
        return;
    }

    setLoading(true);

    setTimeout(() => {
        const foundEmployee = loadEmployees().find(emp =>
            normName(emp.username || emp.name) === normName(inputName) && emp.password === inputPassword
        );

        if (!foundEmployee) {
            showMessage('❌ ناوی بەکارهێنەر یان وشەی نهێنی هەڵەیە', 'error');
            setLoading(false);
            return;
        }

        if (foundEmployee.status === 'inactive') {
            showMessage('🚫 ئەکاونتەکەت ناچالاک کراوە.<br>تکایە پەیوەندی بە بەڕێوەبەری سیستەم بکە.', 'error');
            setLoading(false);
            return;
        }

        if (foundEmployee.status === 'leave') {
            showMessage('⏸️ ئەکاونتەکەت لە مۆڵەتدایە.<br>تکایە پەیوەندی بە بەڕێوەبەری سیستەم بکە.', 'warning');
            setLoading(false);
            return;
        }

        const branchObj = loadBranches().find(b => b.id === foundEmployee.branch);
        if (branchObj && branchObj.active === false) {
            showMessage(`🚫 لقی <strong>"${branchObj.name}"</strong> ناچالاک کراوە.<br>ناتوانیت بچیتە ژوورەوە تاکو بەڕێوەبەر چالاکی بکاتەوە.`, 'error');
            setLoading(false);
            return;
        }

        const roleName = getRoleDisplayName(foundEmployee.role);
        localStorage.setItem('currentLoggedInUser', JSON.stringify({
            ...foundEmployee,
            roleName: roleName,
            loginTime: new Date().toISOString()
        }));

        showMessage(`✅ بەخێر هاتیت، ${foundEmployee.name}`, 'success');
        setTimeout(() => showWelcomeScreen(foundEmployee.name, roleName), 400);
    }, 600);
});

/* ==========================================
   پەڕەی بەخێرهاتن => پەڕەی سەرەکی (dashboard)
   ========================================== */
function showWelcomeScreen(userName, roleName) {
    g('loginCard').classList.add('hide');

    setTimeout(() => {
        const nameEl = g('welcomeName');
        const roleEl = g('welcomeRole');

        nameEl.innerText = userName;
        nameEl.style.display = 'block';

        const sameAsName = roleName && userName && roleName.trim() === userName.trim();
        if (roleName && roleName.trim() !== '' && !sameAsName) {
            roleEl.innerText = roleName;
            roleEl.style.display = 'inline-block';
        } else {
            roleEl.style.display = 'none';
        }

        g('welcomeScreen').classList.add('show');

        setTimeout(() => { window.location.href = '../dashboard/dashboard.html'; }, 3000);
    }, 400);
}

/* ==========================================
   وشەی نهێنیت لەبیر چووە؟
   ========================================== */
let resetState = null; // { id, code, expires, tries, verified }

function showReset() { hideAllPasswords(); g('loginView').hidden = true; g('resetView').hidden = false; gotoStep(1); }
function showLogin() { hideAllPasswords(); g('resetView').hidden = true; g('loginView').hidden = false; resetState = null; }
function gotoStep(n) { [1, 2, 3].forEach(i => g('step' + i).hidden = i !== n); }

// ئیمەیل => بەپێی email ی ئەکاونت، ژمارە => بەپێی ژمارەی مۆبایلی ئەکاونت
function findByContact(value) {
    const v = value.trim();
    const list = loadEmployees();
    if (v.includes('@')) {
        const emp = list.find(e => (e.email || '').trim().toLowerCase() === v.toLowerCase());
        return emp ? { emp, channel: 'email', dest: emp.email } : null;
    }
    const d = lastDigits(v);
    if (d.length < 7) return null;
    const emp = list.find(e => lastDigits(phoneOf(e)) === d);
    return emp ? { emp, channel: 'phone', dest: phoneOf(emp) } : null;
}

function maskDest(channel, dest) {
    if (channel === 'email') {
        const [u, d] = dest.split('@');
        return u[0] + '***@' + d;
    }
    return '*******' + String(dest).replace(/\D/g, '').slice(-3);
}

// ⚠️ ناردنی ڕاستەقینە: لێرە بیبەستەرەوە بە EmailJS (ئیمەیل) یان Twilio (SMS)
function deliverCode(channel, dest, code) {
    const masked = maskDest(channel, dest);
    if (DEMO_MODE) {
        showMessage(`🧪 دۆخی تاقیکردنەوە: کۆدەکەت <strong dir="ltr">${code}</strong><br>(لە وەشانی ڕاستەقینەدا بۆ ${masked} دەنێردرێت)`, 'warning', 30000);
    } else {
        showMessage(`✅ کۆد نێردرا بۆ ${masked}`, 'success');
    }
}

function sendResetCode() {
    const hit = findByContact(g('reset-contact').value);
    if (!hit) {
        showMessage('❌ ئەم ئیمەیل یان ژمارەیە لە هیچ ئەکاونتێکدا تۆمار نەکراوە', 'error');
        return;
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    resetState = { id: hit.emp.id, code, expires: Date.now() + 5 * 60 * 1000, tries: 0, verified: false };
    g('reset-code').value = '';
    deliverCode(hit.channel, hit.dest, code);
    gotoStep(2);
}

function verifyCode() {
    if (!resetState || Date.now() > resetState.expires) {
        showMessage('⏰ کۆدەکە بەسەرچووە، دووبارە بینێرە', 'error');
        gotoStep(1);
        return;
    }
    if (++resetState.tries > 5) {
        resetState = null;
        showMessage('🚫 زۆر هەوڵت دا، دووبارە کۆد بنێرە', 'error');
        gotoStep(1);
        return;
    }
    if (g('reset-code').value.trim() !== resetState.code) {
        showMessage('❌ کۆدەکە هەڵەیە', 'error');
        return;
    }
    resetState.verified = true;
    g('message').classList.remove('show');
    gotoStep(3);
}

function saveNewPassword() {
    if (!resetState || !resetState.verified) { gotoStep(1); return; }

    const pass = g('new-password').value;
    if (!isStrong(pass)) { showMessage(PW_ERROR, 'error'); return; }
    if (pass !== g('confirm-password').value) { showMessage('❌ دوو وشەی نهێنییەکە وەک یەک نین', 'error'); return; }

    const list = loadEmployees();
    const emp = list.find(e => String(e.id) === String(resetState.id));
    if (!emp) { showMessage('❌ ئەکاونتەکە نەدۆزرایەوە', 'error'); return; }

    emp.password = pass;
    localStorage.setItem('employeesList', JSON.stringify(list));

    const name = emp.name;
    ['new-password', 'confirm-password', 'reset-contact', 'reset-code'].forEach(id => g(id).value = '');
    ['newRules'].forEach(id => g(id).querySelectorAll('.rule').forEach(r => r.classList.remove('ok')));
    showLogin();
    g('login-name').value = name;
    g('login-password').value = '';
    showMessage('✅ وشەی نهێنی نوێکرایەوە، ئێستا بچۆ ژوورەوە', 'success');
}

document.addEventListener('DOMContentLoaded', () => {
    createStars();
    hideAllPasswords();
    bindRules('new-password', 'newRules');
});