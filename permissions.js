/* ==========================================
   Helpers
   ========================================== */
function loadEmployees() { return JSON.parse(localStorage.getItem('employeesList')) || []; }
function saveEmployees(list) { localStorage.setItem('employeesList', JSON.stringify(list)); }
function loadBranches() { return JSON.parse(localStorage.getItem('branchesList')) || []; }

function loadRoles() {
    let roles = JSON.parse(localStorage.getItem('rolesList'));
    if (!roles || !Array.isArray(roles) || roles.length === 0) {
        roles = [
            { id: 'admin', name: 'بەڕێوەبەری سیستەم' },
            { id: 'general-manager', name: 'بەڕێوەبەری گشتی' },
            { id: 'dept-manager', name: 'بەڕێوەبەری بەش' },
            { id: 'employee', name: 'کارمەند' }
        ];
        localStorage.setItem('rolesList', JSON.stringify(roles));
    }
    return roles;
}

function getBranchName(branchId) {
    const b = loadBranches().find(x => x.id === branchId);
    return branchId === 'all' ? 'هەموو لقەکان' : (b ? b.name : '—');
}

function getRoleName(roleId) {
    const r = loadRoles().find(x => x.id === roleId);
    return r ? r.name : '—';
}

/* ==========================================
   پێناسەی دەسەڵاتەکان (شەش بەش)
   ========================================== */
const PERMISSION_STRUCTURE = {
    dashboard: { icon: '🏠', title: 'پەڕەی سەرەکی', subs: [
        { key: 'view', label: 'بینین' } ] },
    request: { icon: '📄', title: 'داواکردنی مۆڵەت', subs: [
        { key: 'view', label: 'بینین' }, { key: 'add', label: 'زیادکردن' },
        { key: 'edit', label: 'دەستکاری' }, { key: 'delete', label: 'سڕینەوە' } ] },
    response: { icon: '✅', title: 'وەڵامدانەوەی مۆڵەت', subs: [
        { key: 'view', label: 'بینین' }, { key: 'edit', label: 'دەستکاری' },
        { key: 'delete', label: 'سڕینەوە' }, { key: 'reject', label: 'ڕەتکردنەوە' },
        { key: 'approve', label: 'پەسەندکردن' } ] },
    reports: { icon: '📊', title: 'ڕاپۆرتەکان', subs: [
        { key: 'view', label: 'بینین' }, { key: 'export', label: 'دەرکردن (Excel/PDF)' },
        { key: 'print', label: 'پرینت' } ] },
    addEmployee: { icon: '👤', title: 'زیادکردنی کارمەند', subs: [
        { key: 'view', label: 'بینین' }, { key: 'add', label: 'زیادکردن' },
        { key: 'edit', label: 'دەستکاری' }, { key: 'delete', label: 'سڕینەوە' } ] },
    permissions: { icon: '🔒', title: 'دەسەڵاتی کارمەند', subs: [
        { key: 'view', label: 'بینین' }, { key: 'edit', label: 'دەستکاری' } ] }
};

/* دەسەڵاتە بنەڕەتییەکان بەپێی ڕۆڵ (کاتێک کارمەند هێشتا دەسەڵاتی تایبەتی نییە) */
const ROLE_DEFAULT_PERMISSIONS = {
    'employee': {
        dashboard: { view: true },
        request: { view: true, add: true, edit: false, delete: false },
        response: { view: false, edit: false, delete: false, reject: false, approve: false },
        reports: { view: true, export: false, print: false },
        addEmployee: { view: false, add: false, edit: false, delete: false },
        permissions: { view: false, edit: false }
    },
    'dept-manager': {
        dashboard: { view: true },
        request: { view: true, add: true, edit: true, delete: false },
        response: { view: true, edit: true, delete: false, reject: true, approve: true },
        reports: { view: true, export: true, print: true },
        addEmployee: { view: true, add: false, edit: false, delete: false },
        permissions: { view: false, edit: false }
    },
    'general-manager': {
        dashboard: { view: true },
        request: { view: true, add: true, edit: true, delete: true },
        response: { view: true, edit: true, delete: true, reject: true, approve: true },
        reports: { view: true, export: true, print: true },
        addEmployee: { view: true, add: true, edit: true, delete: false },
        permissions: { view: true, edit: false }
    },
    'admin': {
        dashboard: { view: true },
        request: { view: true, add: true, edit: true, delete: true },
        response: { view: true, edit: true, delete: true, reject: true, approve: true },
        reports: { view: true, export: true, print: true },
        addEmployee: { view: true, add: true, edit: true, delete: true },
        permissions: { view: true, edit: true }
    }
};

/* ئەگەر کارمەند دەسەڵاتی تایبەتی نەبوو، لە دەسەڵاتی ڕۆڵەکەیەوە کۆپی دەکرێت */
function ensurePerms(emp) {
    if (!emp.permissions) {
        emp.permissions = JSON.parse(JSON.stringify(ROLE_DEFAULT_PERMISSIONS[emp.role] || ROLE_DEFAULT_PERMISSIONS['employee']));
    }
    return emp.permissions;
}

function selectedEmpId() { return document.getElementById('employeeSelect').value; }

/* ==========================================
   فلتەرەکان: ڕۆڵ + لق => کارمەند
   ========================================== */
function populateBranchSelect() {
    document.getElementById('branchSelect').innerHTML =
        '<option value="">-- هەموو لقەکان --</option>' +
        loadBranches().map(b => `<option value="${b.id}">🏢 ${b.name}</option>`).join('');
}

function populateEmployeeSelect() {
    const role = document.getElementById('roleSelect').value;
    const branch = document.getElementById('branchSelect').value;

    const list = loadEmployees().filter(e =>
        (!role || e.role === role) && (!branch || String(e.branch) === branch || e.branch === 'all'));

    document.getElementById('employeeSelect').innerHTML =
        '<option value="">-- کارمەند هەڵبژێرە --</option>' +
        list.map(e => `<option value="${e.id}">${e.name}${e.branch ? ` (${getBranchName(e.branch)})` : ''}</option>`).join('');

    onEmployeeChange();
}

/* کاتێک ناوی کارمەند هەڵدەبژێردرێت، خۆکارانە شەش بەشەکە دەردەکەون */
function onEmployeeChange() {
    const emp = loadEmployees().find(e => String(e.id) === selectedEmpId());
    const card = document.getElementById('permissionsCard');
    if (!emp) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    document.getElementById('selectedEmpName').innerText = emp.name;
    renderEmployeePermissions(emp);
}

/* ==========================================
   شەش خانەکە: چالاک / ناچالاک + دەسەڵاتی ناو هەر بەش
   ========================================== */
function renderEmployeePermissions(emp) {
    const perms = emp.permissions || ROLE_DEFAULT_PERMISSIONS[emp.role] || ROLE_DEFAULT_PERMISSIONS['employee'];

    document.getElementById('permissionsContainer').innerHTML = Object.entries(PERMISSION_STRUCTURE).map(([key, sec]) => {
        const sp = perms[key] || {};
        const on = !!sp.view;

        // "بینین" هەمان سویچی چالاک/ناچالاکە، بۆیە لێرە پیشان نادرێت
        const subs = sec.subs.filter(s => s.key !== 'view').map(s => `
            <label class="permission-sub ${sp[s.key] ? 'active' : ''}">
                <input type="checkbox" ${sp[s.key] ? 'checked' : ''} ${on ? '' : 'disabled'}
                       onchange="onSubPermissionChange(this, '${key}', '${s.key}')">
                <span>${s.label}</span>
            </label>`).join('') || '<span class="section-desc">ئەم بەشە تەنها بینینی هەیە.</span>';

        return `
            <div class="permission-section ${on ? '' : 'denied'}">
                <div class="permission-header">
                    <span class="perm-icon">${sec.icon}</span>
                    <span class="perm-title">${sec.title}</span>
                    <label class="permission-sub ${on ? 'active' : ''}" style="font-weight:bold;">
                        <input type="checkbox" ${on ? 'checked' : ''} onchange="onMainPermissionChange(this, '${key}')">
                        <span>${on ? 'چالاک' : 'ناچالاک'}</span>
                    </label>
                </div>
                <div class="permission-sub-list">${subs}</div>
            </div>`;
    }).join('');
}

/* گۆڕانکاری لەسەر کارمەندی هەڵبژێردراو + پاشەکەوتکردن + نوێکردنەوەی خشتە */
function updatePerm(fn) {
    const employees = loadEmployees();
    const emp = employees.find(e => String(e.id) === selectedEmpId());
    if (!emp) return;
    fn(ensurePerms(emp));
    saveEmployees(employees);
    renderEmployeePermissions(emp);
    renderPermissionsTable();
}

function onMainPermissionChange(checkbox, sectionKey) {
    updatePerm(p => {
        p[sectionKey] = p[sectionKey] || {};
        p[sectionKey].view = checkbox.checked;
        // ناچالاک کرا => هەموو دەسەڵاتەکانی ناوی دەگیرێن
        if (!checkbox.checked) PERMISSION_STRUCTURE[sectionKey].subs.forEach(s => p[sectionKey][s.key] = false);
    });
}

function onSubPermissionChange(checkbox, sectionKey, subKey) {
    updatePerm(p => {
        p[sectionKey] = p[sectionKey] || {};
        p[sectionKey][subKey] = checkbox.checked;
    });
}

function saveEmployeePermissions() {
    const emp = loadEmployees().find(e => String(e.id) === selectedEmpId());
    if (!emp) { alert('⚠️ تکایە سەرەتا کارمەندێک هەڵبژێرە'); return; }
    alert(`✅ دەسەڵاتەکانی "${emp.name}" بە سەرکەوتوویی پاشەکەوتکران!`);
    renderPermissionsTable();
}

/* ==========================================
   خشتەی کورتە
   ========================================== */
function renderPermissionsTable() {
    const tbody = document.getElementById('permissionsTableBody');
    const employees = loadEmployees();

    if (employees.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="empty-row">هیچ کارمەندێک تۆمار نەکراوە</td></tr>`;
        return;
    }

    const sections = Object.keys(PERMISSION_STRUCTURE);
    tbody.innerHTML = [...employees].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(emp => {
        const perms = emp.permissions || ROLE_DEFAULT_PERMISSIONS[emp.role] || ROLE_DEFAULT_PERMISSIONS['employee'];
        const cells = sections.map(s => `
            <td><input type="checkbox" class="custom-checkbox" data-emp="${emp.id}" data-section="${s}" data-sub="view" ${perms[s]?.view ? 'checked' : ''}></td>`).join('');
        return `
            <tr>
                <td class="emp-name">👤 ${emp.name || '—'}</td>
                <td class="emp-role">${getRoleName(emp.role)}</td>
                ${cells}
                <td><button class="btn btn-secondary btn-sm" onclick="loadEmployeeFromTable('${emp.id}')">✏️ دەستکاری</button></td>
            </tr>`;
    }).join('');
}

function loadEmployeeFromTable(empId) {
    const emp = loadEmployees().find(e => String(e.id) === String(empId));
    if (!emp) return;

    document.getElementById('roleSelect').value = emp.role || '';
    document.getElementById('branchSelect').value = emp.branch || '';
    populateEmployeeSelect();
    document.getElementById('employeeSelect').value = emp.id;
    onEmployeeChange();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function selectAllPermissions(checked) {
    const msg = checked
        ? 'ئایا دڵنیایت کە دەتەوێت هەموو دەسەڵاتەکان بۆ هەموو کارمەندان چالاک بکەیت؟'
        : 'ئایا دڵنیایت کە دەتەوێت هەموو دەسەڵاتەکان بۆ هەموو کارمەندان ناچالاک بکەیت؟';
    if (!confirm(msg)) return;

    const employees = loadEmployees();
    employees.forEach(emp => {
        const p = ensurePerms(emp);
        Object.keys(PERMISSION_STRUCTURE).forEach(s => {
            p[s] = p[s] || {};
            PERMISSION_STRUCTURE[s].subs.forEach(sub => p[s][sub.key] = checked);
        });
    });
    saveEmployees(employees);
    renderPermissionsTable();
    onEmployeeChange();
    alert(checked ? '✅ هەموو دەسەڵاتەکان چالاککران' : '❌ هەموو دەسەڵاتەکان ناچالاککران');
}

function saveAllPermissions() {
    const employees = loadEmployees();

    document.querySelectorAll('#permissionsTableBody .custom-checkbox').forEach(cb => {
        const emp = employees.find(e => String(e.id) === cb.dataset.emp);
        if (!emp) return;
        const p = ensurePerms(emp);
        const s = cb.dataset.section;
        p[s] = p[s] || {};
        p[s].view = cb.checked;
        // بەشی ناچالاک => هەموو دەسەڵاتەکانی ناوی دەگیرێن
        if (!cb.checked) PERMISSION_STRUCTURE[s].subs.forEach(sub => p[s][sub.key] = false);
    });

    saveEmployees(employees);
    onEmployeeChange();
    alert('✅ هەموو دەسەڵاتەکان بە سەرکەوتوویی پاشەکەوتکران!');
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

document.addEventListener('DOMContentLoaded', function () {
    createStars();
    populateBranchSelect();
    populateEmployeeSelect();
    renderPermissionsTable();
});