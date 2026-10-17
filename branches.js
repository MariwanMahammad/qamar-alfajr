/* ==========================================
   branches.js — بەشی لق: وێنە + شوێن + دەستکاری + قفڵی سڕینەوە
   دەبێت دوای employee.js بار بکرێت (فەنکشنە هاوتاکانی ئەو دەگۆڕێت)
   ========================================== */
let branchPhotoData = '';        // وێنەی فۆرمی زیادکردن
let editBranchPhotoData = null;  // null = نەگۆڕدراوە، '' = لابراوە، دەق = وێنەی نوێ

const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// وێنە بچووک دەکاتەوە (٣٢٠px) تاکو localStorage پڕ نەبێت
function readImage(file, done) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('تکایە وێنە هەڵبژێرە'); return; }
    const reader = new FileReader();
    reader.onload = e => {
        const img = new Image();
        img.onload = () => {
            const r = Math.min(1, 320 / Math.max(img.width, img.height));
            const c = document.createElement('canvas');
            c.width = Math.round(img.width * r);
            c.height = Math.round(img.height * r);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            done(c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.82));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function trySaveBranches(list) {
    try { saveBranches(list); return true; }
    catch (err) { return false; }
}

/* ---------- زیادکردنی لق ---------- */
function initBranchForm() {
    if (window.__bfInit) return;
    window.__bfInit = true;
    const form = document.getElementById('branch-form');
    const preview = document.getElementById('branchPhotoPreview');

    document.getElementById('branch-photo').addEventListener('change', e => {
        readImage(e.target.files[0], data => {
            branchPhotoData = data;
            preview.innerHTML = `<img src="${data}" alt="">`;
        });
    });

    form.addEventListener('reset', () => { branchPhotoData = ''; preview.innerHTML = '🏢'; });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const name = document.getElementById('branch-name').value.trim();
        const location = document.getElementById('branch-location').value.trim();

        if (!name) { showMessage('branchMessage', 'تکایە ناوی لق بنووسە', 'error'); return; }

        const branches = loadBranches();
        if (branches.some(b => b.name === name)) { showMessage('branchMessage', 'ئەم لقە پێشتر هەیە!', 'error'); return; }

        branches.push({ id: 'branch-' + Date.now(), name, location, photo: branchPhotoData, active: true });
        if (!trySaveBranches(branches)) {
            showMessage('branchMessage', '⚠️ شوێنی پاشەکەوتکردن پڕ بووە، وێنەیەکی بچووکتر هەڵبژێرە', 'error');
            return;
        }

        showMessage('branchMessage', `✅ لقی "${name}" بە سەرکەوتوویی زیادکرا`, 'success');
        this.reset();
        renderBranchesList();
        populateSelects();
    });
}

/* ---------- لیستی لقەکان ---------- */
function renderBranchesList() {
    const container = document.getElementById('branchesList');
    const branches = loadBranches();
    document.getElementById('branchCount').innerText = `(${branches.length} لق)`;

    if (branches.length === 0) {
        container.innerHTML = `<div class="empty-msg" style="grid-column:1/-1;"><span class="icon">🏢</span>هێشتا هیچ لقێک زیاد نەکراوە</div>`;
        return;
    }

    container.innerHTML = branches.map(b => {
        const n = countEmployeesInBranch(b.id);
        const locked = n > 0;   // کارمەندی تێدایە => سڕینەوە قەدەغەیە
        return `
        <div class="branch-card${b.active ? '' : ' inactive'}">
            <div class="branch-icon">${b.photo ? `<img src="${b.photo}" alt="">` : '🏢'}</div>
            <div class="branch-info">
                <div class="branch-name">${esc(b.name)}</div>
                ${b.location ? `<div class="branch-loc">📍 ${esc(b.location)}</div>` : ''}
                <div class="branch-meta">
                    <span>👥 ${n} کارمەند</span>
                    <span>${b.active ? '🟢 چالاک' : '🔴 ناچالاک'}</span>
                    ${!b.active && locked ? '<span style="color:#f87171;">⚠️ کارمەندان ناتوانن بچنە ژوورەوە</span>' : ''}
                </div>
            </div>
            <div class="branch-actions">
                <button class="btn btn-secondary btn-icon" onclick="editBranch('${b.id}')" title="دەستکاری">✏️</button>
                <button class="btn btn-icon ${b.active ? 'btn-warning' : 'btn-success'}" onclick="toggleBranchActive('${b.id}')" title="${b.active ? 'ناچالاککردن' : 'چالاککردن'}">${b.active ? '🚫' : '✅'}</button>
                <button class="btn btn-danger btn-icon" onclick="deleteBranch('${b.id}')"
                        title="${locked ? 'ناتوانرێت بسڕدرێتەوە — کارمەندی تێدایە' : 'سڕینەوە'}"
                        ${locked ? 'style="opacity:.4; cursor:not-allowed;"' : ''}>${locked ? '🔒' : '🗑️'}</button>
            </div>
        </div>`;
    }).join('');
}

/* ---------- دەستکاریکردنی لق (ناو / وێنە / شوێن / دۆخ) ---------- */
function setEditBranchPreview(src) {
    document.getElementById('editBranchPhotoPreview').innerHTML = src ? `<img src="${src}" alt="">` : '🏢';
}

function removeEditBranchPhoto() {
    editBranchPhotoData = '';
    setEditBranchPreview('');
    document.getElementById('edit-branch-photo').value = '';
}

function editBranch(id) {
    const b = loadBranches().find(x => x.id === id);
    if (!b) return;

    document.getElementById('edit-branch-id').value = b.id;
    document.getElementById('edit-branch-name').value = b.name;
    document.getElementById('edit-branch-location').value = b.location || '';
    document.getElementById('edit-branch-photo').value = '';
    document.getElementById('edit-branch-switch').classList.toggle('on', !!b.active);
    editBranchPhotoData = null;
    setEditBranchPreview(b.photo);
    openModal('editBranchModal');
}

function initEditBranchForm() {
    if (window.__ebfInit) return;
    window.__ebfInit = true;
    document.getElementById('edit-branch-photo').addEventListener('change', e => {
        readImage(e.target.files[0], data => { editBranchPhotoData = data; setEditBranchPreview(data); });
    });

    document.getElementById('edit-branch-form').addEventListener('submit', function (e) {
        e.preventDefault();
        const id = document.getElementById('edit-branch-id').value;
        const name = document.getElementById('edit-branch-name').value.trim();
        const location = document.getElementById('edit-branch-location').value.trim();
        const isActive = document.getElementById('edit-branch-switch').classList.contains('on');

        if (!name) { alert('تکایە ناوی لق بنووسە'); return; }

        const branches = loadBranches();
        const idx = branches.findIndex(b => b.id === id);
        if (idx === -1) return;

        if (branches.some((b, i) => b.name === name && i !== idx)) { alert('ئەم لقە پێشتر هەیە!'); return; }

        const n = countEmployeesInBranch(id);
        if (!isActive && branches[idx].active && n > 0) {
            if (!confirm(`⚠️ ئاگاداربە: لقی "${name}" ${n} کارمەندی تێدایە.\n\nئەگەر ناچالاکی بکەیت، ئەم کارمەندانە ناتوانن بچنە ژوورەوە.\n\nدڵنیایت؟`)) return;
        }

        branches[idx].name = name;
        branches[idx].location = location;
        branches[idx].active = isActive;
        if (editBranchPhotoData !== null) branches[idx].photo = editBranchPhotoData;

        if (!trySaveBranches(branches)) { alert('⚠️ شوێنی پاشەکەوتکردن پڕ بووە، وێنەیەکی بچووکتر هەڵبژێرە'); return; }

        closeModal('editBranchModal');
        renderBranchesList();
        renderEmployeesList();
        populateSelects();
        showMessage('branchMessage', '✅ لق نوێکرایەوە', 'success');
    });
}

// خۆی دەستپێدەکات، تەنانەت ئەگەر init ی employee.js بۆ هەر هۆیەک وەستابێت (بۆ ئەوەی لیستی لقەکان نەفەوتێت)
document.addEventListener('DOMContentLoaded', () => {
    [initBranchForm, initEditBranchForm, renderBranchesList].forEach(fn => { try { fn(); } catch (e) { console.error(fn.name, e); } });
});