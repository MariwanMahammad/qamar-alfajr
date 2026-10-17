/* ==========================================
   employees.js — بەشی کارمەند + کۆتایی گرێبەست
   دەبێت دوای employee.js و branches.js بار بکرێت (فەنکشنە هاوتاکانیان دەگۆڕێت)
   فایلەکان (وێنە / PDF) لە IndexedDB دەپارێزرێن نەک localStorage
   ========================================== */
const REL = ['باوک', 'دایک', 'برا', 'خوشک', 'خێزان', 'مام', 'خاڵ'];
const DOC_TYPES = { 'national': 'هەویەی نیشتمانی', 'info': 'هەویەی زانیاری', 'passport': 'پاسەپۆرت', 'residence': 'کارتی نیشتەجێبوون', 'nationality': 'ڕەگەزنامە', 'other': 'هیتر',
                    'id-card': 'هەویەی نیشتمانی', 'info-card': 'هەویەی زانیاری' };   // دوو کۆتایی: بۆ تۆمارە کۆنەکان
const DOC_PICK = ['national', 'info', 'passport', 'residence', 'nationality', 'other'];
const ROLE_OPTS = [['employee', 'کارمەند'], ['dept-manager', 'بەڕێوەبەری لق'], ['general-manager', 'بەڕێوەبەری گشتی']];
const STATUS_OPTS = [['active', 'چالاک'], ['inactive', 'ناچالاک'], ['leave', 'لە مۆڵەتدا']];
const RE = {
    user: /^[A-Za-z][A-Za-z0-9._-]{2,31}$/,
    en: /^[A-Za-z][A-Za-z .'-]*$/,
    ar: /^[\u0600-\u06FF\u200c\u200d ]+$/,
    phone: /^\+?[0-9 ()-]{7,18}$/,
    mail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
};
const byId = id => document.getElementById(id);
const loadEmps = () => { try { return JSON.parse(localStorage.getItem('employeesList')) || []; } catch (e) { return []; } };
const saveEmps = l => localStorage.setItem('employeesList', JSON.stringify(l));
const parseMoney = s => String(s || '').replace(/,/g, '').trim();
const fmtNum = v => (v === undefined || v === null || v === '') ? '' : Number(v).toLocaleString('en-US');
// کاتێک دەنووسیت، فاریزە لە نێوان هەزارەکان دادەنێت: 2,100,000
function formatMoneyInput(el) {
    const before = el.value.slice(0, el.selectionStart).replace(/[^\d.]/g, '').length;
    let raw = el.value.replace(/[^\d.]/g, '');
    const dot = raw.indexOf('.');
    if (dot !== -1) raw = raw.slice(0, dot + 1) + raw.slice(dot + 1).replace(/\./g, '').slice(0, 2);
    const [i, d] = raw.split('.');
    const out = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d !== undefined ? '.' + d : '');
    el.value = out;
    let c = 0, p = 0;
    while (p < out.length && c < before) { if (/[\d.]/.test(out[p])) c++; p++; }
    el.setSelectionRange(p, p);
}
const lastDigits = s => String(s || '').replace(/\D/g, '').slice(-10);
const words = s => s.trim().split(/\s+/).filter(Boolean).length;
const changed = () => window.dispatchEvent(new Event('royaEmployeesChanged'));
const CUR_OPTS = '<option value="IQD">دینار</option><option value="USD">دۆلار</option>';
const fmtMoney = (v, c) => (v === '' || v == null) ? '' : `${Number(v).toLocaleString('en-US')} ${c === 'USD' ? 'دۆلار' : 'دینار'}`;

const fpState = {};          // id => [{name, type, file?, ref?}]
let docSeq = 0, editingId = null, removedRefs = [];

/* ---------- IndexedDB بۆ فایلەکان ---------- */
const fileDB = {
    db: null,
    open() {
        if (this.db) return Promise.resolve(this.db);
        return new Promise((res, rej) => {
            const r = indexedDB.open('royaFiles', 1);
            r.onupgradeneeded = () => r.result.createObjectStore('files');
            r.onsuccess = () => { this.db = r.result; res(this.db); };
            r.onerror = () => rej(r.error);
        });
    },
    async tx(mode, fn) {
        const db = await this.open();
        return new Promise((res, rej) => {
            const t = db.transaction('files', mode);
            const req = fn(t.objectStore('files'));
            t.oncomplete = () => res(req && req.result);
            t.onerror = () => rej(t.error);
        });
    },
    put(id, blob) { return this.tx('readwrite', s => s.put(blob, id)); },
    get(id) { return this.tx('readonly', s => s.get(id)); },
    del(id) { return this.tx('readwrite', s => s.delete(id)); }
};

// وێنە بچووک دەکاتەوە (١٦٠٠px)، PDF وەک خۆی
function shrink(file) {
    if (!file.type.startsWith('image/')) return Promise.resolve(file);
    return new Promise(res => {
        const url = URL.createObjectURL(file), img = new Image();
        img.onload = () => {
            const r = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
            c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);
            c.toBlob(b => res(b || file), 'image/jpeg', 0.8);
        };
        img.onerror = () => { URL.revokeObjectURL(url); res(file); };
        img.src = url;
    });
}

async function persistFiles(items) {
    const out = [];
    for (const it of items) {
        if (it.ref) { out.push(it.ref); continue; }
        const blob = await shrink(it.file);
        const id = 'f-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        await fileDB.put(id, blob);
        out.push({ id, name: it.name, type: blob.type || it.type });
    }
    return out;
}

/* ---------- لیستی فایلەکان (وێنە یان PDF، هەر چەند بێت) ---------- */
const openBlob = b => window.open(URL.createObjectURL(b), '_blank');
async function viewFile(fid) {
    const w = window.open('', '_blank');
    const b = await fileDB.get(fid);
    if (b && w) w.location.href = URL.createObjectURL(b);
    else { if (w) w.close(); alert('فایلەکە نەدۆزرایەوە'); }
}
const fileChips = files => (files || []).map(f => `<a class="fp-chip" href="#" onclick="viewFile('${f.id}');return false">${f.type === 'application/pdf' ? '📄' : '🖼️'} ${esc(f.name)}</a>`).join('');

function fpAdd(id) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.multiple = true; inp.accept = 'image/*,application/pdf';
    inp.onchange = () => {
        fpState[id] = fpState[id] || [];
        [...inp.files].forEach(f => {
            if (!(f.type.startsWith('image/') || f.type === 'application/pdf')) return;
            if (f.size > 15 * 1024 * 1024) { showMessage('employeeMessage', `⚠️ فایلی "${f.name}" زۆر گەورەیە (زۆرترین ١٥ MB)`, 'error'); return; }
            fpState[id].push({ name: f.name, type: f.type, file: f });
        });
        fpRender(id);
    };
    inp.click();
}
function fpRender(id) {
    const box = byId('fpl-' + id);
    if (!box) return;
    box.innerHTML = (fpState[id] || []).map((it, i) => `<span class="fp-chip"><a href="#" onclick="fpView('${id}',${i});return false">${it.type === 'application/pdf' ? '📄' : '🖼️'} ${esc(it.name)}</a><button type="button" onclick="fpRemove('${id}',${i})">✕</button></span>`).join('');
}
function fpRemove(id, i) { const it = fpState[id].splice(i, 1)[0]; if (it && it.ref) removedRefs.push(it.ref); fpRender(id); }
function fpView(id, i) { const it = fpState[id][i]; if (it.ref) viewFile(it.ref.id); else openBlob(it.file); }

/* ---------- هەویەکان (چەند دانە) ---------- */
function addDocFromPick() {
    const t = byId('docTypePick').value, name = byId('docOtherName').value.trim();
    if (t === 'other' && !name) { showMessage('employeeMessage', 'تکایە ناوی هەویەکە بنووسە', 'error'); return; }
    addDocRow(t, [], t === 'other' ? name : '');
    byId('docOtherName').value = '';
}
function addDocRow(type = 'national', items = [], label = '') {
    const k = 'doc' + (++docSeq);
    fpState[k] = items;
    const row = document.createElement('div');
    row.className = 'doc-row'; row.id = 'row-' + k; row.dataset.k = k; row.dataset.type = type; row.dataset.label = label;
    row.innerHTML = `<div class="doc-title">🪪 ${esc(label || DOC_TYPES[type] || type)}</div>
        <div class="fp"><button type="button" class="btn btn-secondary btn-sm" onclick="fpAdd('${k}')">📎 زیادکردنی وێنە یان PDF</button><div class="fp-list" id="fpl-${k}"></div></div>
        <button type="button" class="btn btn-danger btn-sm" onclick="removeDocRow('${k}')">🗑️</button>`;
    byId('docRows').appendChild(row);
    fpRender(k);
}
function removeDocRow(k) {
    (fpState[k] || []).forEach(it => it.ref && removedRefs.push(it.ref));
    delete fpState[k];
    byId('row-' + k).remove();
}

/* ---------- فۆرمی کارمەند ---------- */
function buildForm() {
    const R = ' <span class="required">*</span>';
    const inp = (id, label, o = {}) => `<div class="input-group${o.full ? ' full-width' : ''}"><label>${label}${o.req ? R : ''}</label><input type="${o.type || 'text'}" id="${id}"${o.dir ? ` dir="${o.dir}"` : ''}${o.ph ? ` placeholder="${o.ph}"` : ''}${o.attr ? ' ' + o.attr : ''} autocomplete="off"></div>`;
    const sel = (id, label, o = {}) => `<div class="input-group${o.full ? ' full-width' : ''}"><label>${label}${o.req ? R : ''}</label><select id="${id}"></select></div>`;
    const fp = (id, label) => `<div class="input-group full-width"><label>${label}</label><div class="fp"><button type="button" class="btn btn-secondary btn-sm" onclick="fpAdd('${id}')">📎 زیادکردنی وێنە یان PDF</button><div class="fp-list" id="fpl-${id}"></div></div></div>`;
    const sec = t => `<div class="form-section">${t}</div>`;

    byId('employee-form').innerHTML = `
    <div class="form-grid">
        ${sec('👤 زانیاری کەسی')}
        <div class="input-group full-width"><label>وێنەی کارمەند</label>
            <div class="photo-upload" onclick="byId('emp-photo').click()">
                <div class="photo-preview" id="photoPreview"><span class="placeholder">📷</span></div>
                <div class="photo-label">کلیک بکە بۆ هەڵبژاردنی وێنە</div>
                <input type="file" id="emp-photo" accept="image/*">
            </div></div>
        ${inp('emp-name-ku', 'ناوی چواری بە کوردی', { req: 1, ph: 'ماریوان ئەحمەد محەمەد عەلی' })}
        ${inp('emp-name-ar', 'ناوی چواری بە عەرەبی', { req: 1, dir: 'rtl', ph: 'مروان أحمد محمد علي' })}
        ${inp('emp-name-en', 'ناوی چواری بە ئینگلیزی', { req: 1, dir: 'ltr', ph: 'Marwan Ahmed Mohammed Ali', full: 1 })}
        ${inp('emp-phone', 'ژمارە مۆبایلی خۆت', { req: 1, type: 'tel', dir: 'ltr', ph: '0770xxxxxxx' })}
        ${inp('emp-email', 'ئیمەیل (ئارەزوومەندانە)', { type: 'email', dir: 'ltr', ph: 'name@example.com' })}
        ${sel('emp-rel', 'کەسی یەکەم (پەیوەندی)', { req: 1 })}
        ${inp('emp-rel-phone', 'ژمارە مۆبایلی کەسی یەکەم', { req: 1, type: 'tel', dir: 'ltr', ph: '0750xxxxxxx' })}
        ${inp('emp-address', 'ناونیشانی ماڵی کارمەند', { full: 1 })}

        ${sec('🔐 زانیاری چوونەژوورەوە')}
        ${inp('emp-username', 'ناوی بەکارهێنەر (بە ئینگلیزی)', { req: 1, dir: 'ltr', ph: 'marwan.ahmed' })}
        <div class="input-group"><label>وشەی نهێنی${R}</label>
            <div class="input-wrapper"><input type="password" id="emp-password" class="has-icon" dir="ltr" autocomplete="new-password" placeholder="Aa1@...">
            <button type="button" class="toggle-password" onclick="toggleEmpPassword(this)">👁️‍🗨️</button></div>
            <div class="photo-label" style="text-align:start;margin-top:6px;">بە ئینگلیزی، پیتی گەورە و بچووک و ژمارە و هێما، ٤ تا ٣٢ پیت</div></div>

        ${sec('🏢 کار')}
        ${sel('emp-branch', 'شوێنی کارکردن (لق)', { req: 1 })}
        ${sel('emp-role', 'ڕۆلی کارمەند', { req: 1 })}
        ${sel('emp-status', 'دۆخی کارمەند', { req: 1, full: 1 })}
        ${inp('emp-salary', 'مووچە', { dir: 'ltr', ph: '2,100,000', attr: 'inputmode="decimal" oninput="formatMoneyInput(this)"' })}
        ${sel('emp-currency', 'دراو')}

        ${sec('🪪 هەویە')}
        <div class="full-width">
            <div class="doc-add">
                <select id="docTypePick" onchange="byId('docOtherName').style.display = this.value === 'other' ? '' : 'none'">${DOC_PICK.map(k => `<option value="${k}">${DOC_TYPES[k]}</option>`).join('')}</select>
                <input type="text" id="docOtherName" placeholder="ناوی هەویە" style="display:none">
                <button type="button" class="btn btn-primary btn-sm" onclick="addDocFromPick()">➕ زیادکردنی هەویە</button>
            </div>
            <div id="docRows"></div></div>

        ${sec('📄 گرێبەست')}
        ${inp('emp-contract-start', 'دەستپێکی گرێبەست', { type: 'date' })}
        ${inp('emp-contract-end', 'کۆتایی گرێبەست', { type: 'date' })}
        ${fp('contract', 'وێنەی گرێبەست (هەر چەند پەڕێک یان PDF)')}

        ${sec('🛡️ کەفیل')}
        ${inp('emp-guar-name', 'ناوی چواری کەفیل')}
        ${inp('emp-guar-phone', 'ژمارە مۆبایلی کەفیل', { type: 'tel', dir: 'ltr' })}
        ${fp('guar', 'وێنەی فۆرمی پشتگیری (وێنە یان PDF)')}

        <div class="input-group full-width"><label>تێبینی</label><textarea id="emp-notes"></textarea></div>
    </div>
    <div class="form-actions">
        <button type="submit" class="btn btn-primary" id="empSubmitBtn">💾 پاشەکەوتکردنی کارمەند</button>
        <button type="button" class="btn btn-secondary" id="empCancelBtn" style="display:none" onclick="byId('employee-form').reset()">✖ هەڵوەشاندنەوەی دەستکاری</button>
        <button type="reset" class="btn btn-secondary">🔄 پاککردنەوەی فۆرم</button>
    </div>`;
}

function resetFormState() {
    document.querySelectorAll('#employee-form .has-error').forEach(x => x.classList.remove('has-error'));
    Object.keys(fpState).forEach(k => delete fpState[k]);
    byId('docRows').innerHTML = '';
    docSeq = 0; removedRefs = []; editingId = null;
    ['contract', 'guar'].forEach(k => { fpState[k] = []; fpRender(k); });
    resetPhoto();
    byId('empSubmitBtn').textContent = '💾 پاشەکەوتکردنی کارمەند';
    byId('empCancelBtn').style.display = 'none';
}

function initPhotoUpload() {
    if (window.__puInit) return;
    window.__puInit = true;
    byId('emp-photo').addEventListener('change', e => readImage(e.target.files[0], d => {
        empPhotoData = d;
        byId('photoPreview').innerHTML = `<img src="${d}" alt="">`;
    }));
}

// بەڕێوەبەری گشتی: «هەموو لقەکان» یان تەنها یەک لق؛ ڕۆڵەکانی تر: دەبێت لقێک هەڵبژێرن
function fillBranchSelect(keep) {
    const el = byId('emp-branch');
    if (!el) return;
    const gm = byId('emp-role') && byId('emp-role').value === 'general-manager';
    const cur = keep !== undefined ? keep : el.value;
    el.innerHTML = (gm ? '<option value="all">🌐 هەموو لقەکان</option>' : '<option value="" disabled selected>-- شوێنی کارکردن هەڵبژێرە --</option>')
        + loadBranches().filter(b => b.active || b.id === cur).map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
    el.value = (cur && [...el.options].some(o => o.value === cur)) ? cur : (gm ? 'all' : '');
}

function populateSelects(keepBranch) {
    const set = (id, html) => { const el = byId(id); if (!el) return; const cur = el.value; el.innerHTML = html; if (cur) el.value = cur; };
    const opts = a => a.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
    set('emp-role', '<option value="" disabled selected>-- ڕۆل هەڵبژێرە --</option>' + opts(ROLE_OPTS));
    set('emp-status', '<option value="" disabled selected>-- دۆخ هەڵبژێرە --</option>' + opts(STATUS_OPTS));
    set('emp-rel', '<option value="" disabled selected>-- هەڵبژێرە --</option>' + opts(REL.map(r => [r, r])));
    set('emp-currency', CUR_OPTS);
    const br = loadBranches();
    fillBranchSelect(keepBranch);
    set('ctBranch', '<option value="">-- هەموو لقەکان --</option>' + br.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join(''));
}

/* ---------- پشکنین ---------- */
function pwError(p) {
    if (p.length < 4 || p.length > 32) return 'وشەی نهێنی نابێت لە ٤ پیت کەمتر بێت و لە ٣٢ پیت زیاتر';
    if (!/^[\x21-\x7E]+$/.test(p)) return 'وشەی نهێنی دەبێت تەنها بە ئینگلیزی بێت و بۆشایی نەبێت';
    if (!/[A-Z]/.test(p) || !/[a-z]/.test(p) || !/[0-9]/.test(p) || !/[^A-Za-z0-9]/.test(p)) return 'وشەی نهێنی دەبێت پیتی گەورە و بچووک و ژمارە و هێمای تێدابێت';
    return '';
}

function validate(d, list) {
    const errs = [], bad = (id, msg) => errs.push({ id, msg });
    const name = (id, v, re, label, reLabel) => {
        if (!v) bad(id, `ناوی چواری بە ${label} بنووسە`);
        else if (words(v) < 4) bad(id, `ناوی ${label} دەبێت چواری بێت (لانیکەم ٤ بەش)`);
        else if (!re.test(v)) bad(id, `ناوی ${label} دەبێت ${reLabel} بێت`);
    };
    name('emp-name-ku', d.nameKu, RE.ar, 'کوردی', 'بە پیتی کوردی');
    name('emp-name-ar', d.nameAr, RE.ar, 'عەرەبی', 'بە پیتی عەرەبی');
    name('emp-name-en', d.nameEn, RE.en, 'ئینگلیزی', 'تەنها بە پیتی ئینگلیزی');
    if (!d.phone) bad('emp-phone', 'ژمارە مۆبایلی خۆت بنووسە'); else if (!RE.phone.test(d.phone)) bad('emp-phone', 'ژمارە مۆبایلی خۆت دروست نییە');
    if (!d.relType) bad('emp-rel', 'کەسی یەکەم دیاری بکە');
    if (!d.relPhone) bad('emp-rel-phone', 'ژمارە مۆبایلی کەسی یەکەم بنووسە'); else if (!RE.phone.test(d.relPhone)) bad('emp-rel-phone', 'ژمارە مۆبایلی کەسی یەکەم دروست نییە');
    if (d.email && !RE.mail.test(d.email)) bad('emp-email', 'ئیمەیلەکە دروست نییە');
    if (!d.username) bad('emp-username', 'ناوی بەکارهێنەر بنووسە');
    else if (!RE.user.test(d.username)) bad('emp-username', 'ناوی بەکارهێنەر دەبێت بە ئینگلیزی بێت (٣ تا ٣٢ پیت، ژمارە و . _ - ڕێگەپێدراوە)');
    if (!d.password) bad('emp-password', 'وشەی نهێنی بنووسە');
    else { const pe = pwError(d.password); if (pe) bad('emp-password', pe); }
    if (!d.role) bad('emp-role', 'ڕۆڵی کارمەند دیاری بکە');
    if (!d.branch && d.role !== 'general-manager') bad('emp-branch', 'لق دیاری بکە');
    if (!d.status) bad('emp-status', 'دۆخی کارمەند دیاری بکە');
    if (d.gPhone && !RE.phone.test(d.gPhone)) bad('emp-guar-phone', 'ژمارە مۆبایلی کەفیل دروست نییە');
    if ((d.cStart || d.cEnd) && !(d.cStart && d.cEnd)) bad(d.cStart ? 'emp-contract-end' : 'emp-contract-start', 'دەستپێک و کۆتایی گرێبەست هەردووکیان پێویستن');
    else if (d.cStart && d.cEnd && d.cStart > d.cEnd) bad('emp-contract-end', 'دەستپێکی گرێبەست نابێت دوای کۆتایی بێت');
    if (d.salary !== '' && (isNaN(d.salary) || Number(d.salary) < 0)) bad('emp-salary', 'مووچە دروست نییە');
    const others = list.filter(x => x.id !== editingId);
    if (d.username && others.some(x => (x.username || '').toLowerCase() === d.username.toLowerCase())) bad('emp-username', 'ئەم ناوی بەکارهێنەرە پێشتر هەیە');
    if (d.phone && others.some(x => lastDigits(x.phone) === lastDigits(d.phone))) bad('emp-phone', 'ئەم ژمارە مۆبایلە پێشتر تۆمارکراوە');
    if (d.email && others.some(x => (x.email || '').toLowerCase() === d.email.toLowerCase())) bad('emp-email', 'ئەم ئیمەیلە پێشتر تۆمارکراوە');
    return errs;
}

// خانە هەڵە یان بەتاڵەکان سوور دەکات
function markErrors(errs) {
    document.querySelectorAll('#employee-form .has-error').forEach(x => x.classList.remove('has-error'));
    errs.forEach(({ id }) => { const el = byId(id); if (el) (el.closest('.input-group') || el.parentElement).classList.add('has-error'); });
}

/* ---------- خەزنکردن (زیادکردن + دەستکاری) ---------- */
function initEmployeeForm() {
    if (window.__efInit) return;
    window.__efInit = true;
    const form = byId('employee-form');
    form.addEventListener('reset', resetFormState);
    byId('emp-role').addEventListener('change', () => fillBranchSelect());
    const clearErr = ev => { const g = ev.target.closest && ev.target.closest('.input-group'); if (g) g.classList.remove('has-error'); };
    form.addEventListener('input', clearErr);
    form.addEventListener('change', clearErr);
    form.addEventListener('submit', async e => { e.preventDefault(); await saveEmployee(); });
}

async function saveEmployee() {
    const v = id => byId(id).value.trim();
    const d = {
        nameKu: v('emp-name-ku'), nameAr: v('emp-name-ar'), nameEn: v('emp-name-en'), phone: v('emp-phone'), email: v('emp-email'),
        relType: byId('emp-rel').value, relPhone: v('emp-rel-phone'), address: v('emp-address'), username: v('emp-username'),
        password: byId('emp-password').value, branch: byId('emp-branch').value, role: byId('emp-role').value, status: byId('emp-status').value,
        cStart: byId('emp-contract-start').value, cEnd: byId('emp-contract-end').value, salary: parseMoney(v('emp-salary')), currency: byId('emp-currency').value, gName: v('emp-guar-name'), gPhone: v('emp-guar-phone'), notes: v('emp-notes')
    };
    if (d.role === 'general-manager' && !d.branch) d.branch = 'all';
    const list = loadEmps();
    const errs = validate(d, list);
    markErrors(errs);
    if (errs.length) {
        showMessage('employeeMessage', `⚠️ ${errs[0].msg}${errs.length > 1 ? ` (+${errs.length - 1} خانەی تر)` : ''}`, 'error');
        const first = byId(errs[0].id);
        if (first) { first.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (first.focus) first.focus({ preventScroll: true }); }
        return;
    }

    const btn = byId('empSubmitBtn');
    btn.disabled = true;
    try {
        const old = editingId ? list.find(x => x.id === editingId) : null;
        const contractFiles = await persistFiles(fpState.contract || []);
        const guarFiles = await persistFiles(fpState.guar || []);
        const docs = [];
        for (const r of document.querySelectorAll('#docRows .doc-row')) {
            const files = await persistFiles(fpState[r.dataset.k] || []);
            if (files.length) docs.push({ type: r.dataset.type, label: r.dataset.label || '', files });
        }

        const emp = old || { id: 'emp-' + Date.now(), createdAt: new Date().toISOString(), contracts: [] };
        const contracts = emp.contracts || [];
        const cData = { start: d.cStart, end: d.cEnd, files: contractFiles, salary: d.salary === '' ? '' : Number(d.salary), currency: d.currency };
        if (d.cStart || d.cEnd || contractFiles.length || d.salary !== '') {
            if (old && contracts.length) Object.assign(contracts[contracts.length - 1], cData);
            else contracts.push({ id: 'c-' + Date.now(), ...cData, createdAt: new Date().toISOString() });
        }
        Object.assign(emp, {
            name: d.nameKu, nameKu: d.nameKu, nameAr: d.nameAr, nameEn: d.nameEn, phone: d.phone, email: d.email,
            relative: { type: d.relType, phone: d.relPhone }, address: d.address, username: d.username, password: d.password,
            branch: d.branch, role: d.role, status: d.status, docs, contracts, notes: d.notes,
            guarantor: { name: d.gName, phone: d.gPhone, files: guarFiles },
            photo: empPhotoData !== null ? empPhotoData : (emp.photo || ''), updatedAt: new Date().toISOString()
        });
        if (!old) list.push(emp);
        saveEmps(list);
        for (const r of removedRefs) { try { await fileDB.del(r.id); } catch (e) { } }

        showMessage('employeeMessage', `✅ کارمەندی "${d.nameKu}" بە سەرکەوتوویی ${old ? 'نوێکرایەوە' : 'تۆمارکرا'}`, 'success');
        byId('employee-form').reset();
        renderEmployeesList(); renderBranchesList(); renderContractEnd(); changed();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
        showMessage('employeeMessage', '⚠️ پاشەکەوت نەکرا: شوێنی پاشەکەوتکردن پڕ بووە یان هەڵەیەک ڕوویدا', 'error');
    } finally { btn.disabled = false; }
}

/* ---------- دەستکاری: هەموو شتێک دەگۆڕدرێت ---------- */
function editEmployee(id) {
    const e = loadEmps().find(x => x.id === id);
    if (!e) return;
    byId('employee-form').reset();
    editingId = id;
    populateSelects(e.branch);
    const roleSel = byId('emp-role');
    if (![...roleSel.options].some(o => o.value === e.role)) roleSel.insertAdjacentHTML('beforeend', `<option value="${esc(e.role)}">${esc(getRoleLabel(e.role))}</option>`);

    const set = (k, val) => { byId(k).value = val || ''; };
    set('emp-name-ku', e.nameKu || e.name); set('emp-name-ar', e.nameAr); set('emp-name-en', e.nameEn);
    set('emp-phone', e.phone); set('emp-email', e.email);
    set('emp-rel', (e.relative || {}).type); set('emp-rel-phone', (e.relative || {}).phone);
    set('emp-address', e.address); set('emp-username', e.username); set('emp-password', e.password);
    set('emp-role', e.role); fillBranchSelect(e.branch); set('emp-status', e.status);
    set('emp-guar-name', (e.guarantor || {}).name); set('emp-guar-phone', (e.guarantor || {}).phone); set('emp-notes', e.notes);

    const c = (e.contracts || []).slice(-1)[0];
    if (c) { set('emp-contract-start', c.start); set('emp-contract-end', c.end); set('emp-salary', fmtNum(c.salary)); set('emp-currency', c.currency || 'IQD'); fpState.contract = (c.files || []).map(f => ({ name: f.name, type: f.type, ref: f })); fpRender('contract'); }
    fpState.guar = ((e.guarantor || {}).files || []).map(f => ({ name: f.name, type: f.type, ref: f })); fpRender('guar');
    (e.docs || []).forEach(d => addDocRow(d.type, d.files.map(f => ({ name: f.name, type: f.type, ref: f })), d.label || ''));

    byId('photoPreview').innerHTML = e.photo ? `<img src="${e.photo}" alt="">` : '<span class="placeholder">📷</span>';
    byId('empSubmitBtn').textContent = '💾 پاشەکەوتکردنی گۆڕانکاری';
    byId('empCancelBtn').style.display = '';
    byId('employee-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function initEditEmployeeForm() { }   // مۆداڵی کۆن لابراوە، دەستکاری لەناو فۆرمی سەرەکییە

const getRoleLabel = id => (ROLE_OPTS.find(r => r[0] === id) || [0, (loadRoles().find(r => r.id === id) || {}).name || '—'])[1];

/* ---------- نوێکردنەوەی گرێبەست (کۆنەکان دەمێنن) ---------- */
function openRenewContract(id) {
    const e = loadEmps().find(x => x.id === id);
    if (!e) return;
    byId('renew-emp-id').value = id;
    byId('contractEmployeeName').innerText = `👤 ${e.name}`;
    byId('oldContractsList').innerHTML = '<div class="old-contracts-title">📋 گرێبەستە کۆنەکان:</div>' +
        ((e.contracts || []).map((c, i, a) => `<div class="old-contract-item">${i === a.length - 1 ? '🟢' : '⚪'} ${c.start || '—'} → ${c.end || '—'} ${c.salary !== undefined && c.salary !== '' ? `<span>💰 ${fmtMoney(c.salary, c.currency)}</span>` : ''} ${fileChips(c.files)}</div>`).join('') || '<div class="old-contract-item">—</div>');
    ['renew-start', 'renew-end', 'renew-notes'].forEach(x => byId(x).value = '');
    const lc = (e.contracts || []).slice(-1)[0] || {};
    byId('renew-currency').innerHTML = CUR_OPTS;
    byId('renew-currency').value = lc.currency || 'IQD';
    byId('renew-salary').value = fmtNum(lc.salary);   // مووچەی پێشوو دەنووسرێت، دەتوانیت بیگۆڕیت
    fpState.renew = []; fpRender('renew');
    openModal('renewContractModal');
}

function initRenewContractForm() {
    if (window.__rcInit) return;
    window.__rcInit = true;
    byId('renew-contract-form').addEventListener('submit', async ev => {
        ev.preventDefault();
        const id = byId('renew-emp-id').value, start = byId('renew-start').value, end = byId('renew-end').value, notes = byId('renew-notes').value.trim(), salary = parseMoney(byId('renew-salary').value), currency = byId('renew-currency').value;
        if (!start || !end) { alert('تکایە دەستپێک و کۆتایی گرێبەست دیاری بکە'); return; }
        if (start > end) { alert('دەستپێک نابێت دوای کۆتایی بێت'); return; }
        if (salary === '' || isNaN(salary) || Number(salary) < 0) { alert('تکایە مووچەی نوێ بنووسە'); return; }
        const list = loadEmps(), emp = list.find(x => x.id === id);
        if (!emp) return;
        try {
            const files = await persistFiles(fpState.renew || []);
            (emp.contracts = emp.contracts || []).push({ id: 'c-' + Date.now(), start, end, notes, files, salary: Number(salary), currency, createdAt: new Date().toISOString() });
            saveEmps(list);
        } catch (e) { alert('⚠️ پاشەکەوت نەکرا'); return; }
        closeModal('renewContractModal');
        renderEmployeesList(); renderContractEnd(); changed();
        alert('✅ گرێبەستی نوێ زیادکرا (گرێبەستە کۆنەکان دەمێننەوە)');
    });
}

/* ---------- سڕینەوە: تەنها ئەگەر هیچ داواکاری مۆڵەتی نەبێت ---------- */
function employeeHasActivity(emp) {
    if (!emp) return false;
    try { return (JSON.parse(localStorage.getItem('leaveRequests')) || []).some(r => r.employeeId === emp.id); } catch (e) { return false; }
}
function showEmployeeLockedMsg(name) {
    showMessage('employeeMessage', `🔒 ناتوانیت کارمەندی "${name}" بسڕیتەوە — داواکاری مۆڵەتی هەیە.`, 'error');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function deleteEmployee(id) {
    const list = loadEmps(), emp = list.find(x => x.id === id);
    if (!emp) return;
    if (employeeHasActivity(emp)) { showEmployeeLockedMsg(emp.name); return; }
    if (!confirm(`دڵنیایت لە سڕینەوەی کارمەندی "${emp.name}"؟`)) return;
    const refs = [...(emp.docs || []).flatMap(d => d.files), ...(emp.contracts || []).flatMap(c => c.files || []), ...((emp.guarantor || {}).files || [])];
    for (const r of refs) { try { await fileDB.del(r.id); } catch (e) { } }
    saveEmps(list.filter(x => x.id !== id));
    renderEmployeesList(); renderBranchesList(); renderContractEnd(); changed();
}

/* ---------- لیستی کارمەندەکان ---------- */
const DAY = 864e5;
function daysLeft(end) { const t = new Date(); t.setHours(0, 0, 0, 0); return Math.ceil((new Date(end + 'T00:00:00') - t) / DAY); }
function lastContract(e) { const c = (e.contracts || []).filter(x => x.end); return c.length ? c.reduce((a, b) => a.end >= b.end ? a : b) : null; }

function renderEmployeesList() {
    const box = byId('employeesList'), list = loadEmps(), branches = loadBranches();
    byId('empCount').innerText = `(${list.length} کارمەند)`;
    if (!list.length) { box.innerHTML = '<div class="empty-msg" style="grid-column:1/-1;"><span class="icon">👥</span>هێشتا هیچ کارمەندێک تۆمار نەکراوە</div>'; return; }

    box.innerHTML = list.map(e => {
        const b = branches.find(x => x.id === e.branch), st = STATUS_MAP[e.status] || { text: '—', class: '' };
        const c = lastContract(e), d = c ? daysLeft(c.end) : null, locked = employeeHasActivity(e);
        const cl = (e.contracts || []).slice(-1)[0], curSal = cl ? fmtMoney(cl.salary, cl.currency) : '';
        const ctTag = !c ? '' : d < 0 ? '<span class="tag tag-status-inactive">⛔ گرێبەست کۆتایی هاتووە</span>'
            : d <= 30 ? `<span class="tag tag-status-leave">⏰ ${d} ڕۆژ ماوە</span>` : `<span class="tag tag-role">📄 ${c.end}</span>`;
        const det = [];
        if ((e.docs || []).length) det.push('<div class="det-t">🪪 هەویە</div>' + e.docs.map(x => `<div>${esc(x.label || DOC_TYPES[x.type] || x.type)}: ${fileChips(x.files)}</div>`).join(''));
        if ((e.contracts || []).length) det.push('<div class="det-t">📄 گرێبەستەکان</div>' + e.contracts.map(x => `<div>${x.start || '—'} → ${x.end || '—'} ${fmtMoney(x.salary, x.currency) ? `<span>💰 ${fmtMoney(x.salary, x.currency)}</span>` : ''} ${fileChips(x.files)}</div>`).join(''));
        const g = e.guarantor || {};
        if (g.name || g.phone || (g.files || []).length) det.push(`<div class="det-t">🛡️ کەفیل</div><div>${esc(g.name)} ${esc(g.phone)} ${fileChips(g.files)}</div>`);
        if (e.notes) det.push(`<div class="det-t">📝 تێبینی</div><div>${esc(e.notes)}</div>`);
        return `
        <div class="employee-card">
            <div class="emp-actions">
                <button class="emp-action-btn" onclick="printEmployee('${e.id}')" title="پرینت">🖨️</button>
                <button class="emp-action-btn" onclick="editEmployee('${e.id}')" title="دەستکاری">✏️</button>
                <button class="emp-action-btn" onclick="openRenewContract('${e.id}')" title="نوێکردنەوەی گرێبەست">📄</button>
                <button class="emp-action-btn danger" onclick="${locked ? `showEmployeeLockedMsg('${esc(e.name).replace(/'/g, '')}')` : `deleteEmployee('${e.id}')`}" title="${locked ? 'ناتوانرێت بسڕدرێتەوە — داواکاری مۆڵەتی هەیە' : 'سڕینەوە'}"${locked ? ' style="opacity:.4;cursor:not-allowed;"' : ''}>${locked ? '🔒' : '🗑️'}</button>
            </div>
            <div class="emp-photo">${e.photo ? `<img src="${e.photo}" alt="">` : '👤'}</div>
            <div class="emp-details">
                <div class="emp-name">${esc(e.nameKu || e.name)}</div>
                <div class="emp-sub">${esc(e.nameEn)}${e.nameAr ? ' · ' + esc(e.nameAr) : ''}</div>
                <div class="emp-tags">
                    <span class="tag tag-role">${esc(getRoleLabel(e.role))}</span>
                    <span class="tag ${st.class}">${st.text}</span>
                    <span class="tag tag-branch-inactive">🏢 ${e.branch === 'all' ? 'هەموو لقەکان' : b ? esc(b.name) : '—'}</span>${ctTag}
                </div>
                <div class="emp-info">
                    <div>📱 <strong>${esc(e.phone)}</strong></div>
                    ${curSal ? `<div>💰 <strong>${curSal}</strong></div>` : ''}
                    ${(e.relative || {}).type ? `<div>👪 ${esc(e.relative.type)}: <strong>${esc(e.relative.phone)}</strong></div>` : ''}
                    <div>🆔 <strong>${esc(e.username || '—')}</strong>${e.email ? ' · ' + esc(e.email) : ''}</div>
                    ${e.address ? `<div>🏠 ${esc(e.address)}</div>` : ''}
                    <div class="pwd-row">🔑 وشەی نهێنی: <span class="pwd-value" id="pwd-${e.id}" data-pwd="${esc(e.password)}">••••••</span>
                        <button class="pwd-toggle" onclick="toggleCardPassword('${e.id}', this)">👁️</button></div>
                    ${det.length ? `<details><summary>📂 وردەکاری و فایلەکان</summary>${det.join('')}</details>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

/* ---------- کۆتایی گرێبەستەکان (٣٠ ڕۆژ یان کەمتر) ---------- */
function renderContractEnd() {
    const box = byId('ctList');
    if (!box) return;
    const b = byId('ctBranch').value, branches = loadBranches();
    const items = loadEmps().filter(e => e.status !== 'inactive' && (!b || e.branch === b || e.branch === 'all'))
        .map(e => ({ e, c: lastContract(e) })).filter(x => x.c && daysLeft(x.c.end) <= 30)
        .map(x => ({ ...x, d: daysLeft(x.c.end) })).sort((a, z) => a.d - z.d);
    byId('ctCount').innerText = `(${items.length} کارمەند)`;
    box.innerHTML = items.length ? items.map(({ e, c, d }) => {
        const br = branches.find(x => x.id === e.branch);
        return `<div class="employee-card">
            <div class="emp-actions"><button class="emp-action-btn" onclick="openRenewContract('${e.id}')" title="نوێکردنەوەی گرێبەست">📄</button></div>
            <div class="emp-photo">${e.photo ? `<img src="${e.photo}" alt="">` : '👤'}</div>
            <div class="emp-details">
                <div class="emp-name">${esc(e.nameKu || e.name)}</div>
                <div class="emp-tags"><span class="tag tag-branch-inactive">🏢 ${e.branch === 'all' ? 'هەموو لقەکان' : br ? esc(br.name) : '—'}</span>
                    ${d < 0 ? '<span class="tag tag-status-inactive">⛔ گرێبەست کۆتایی هاتووە</span>' : `<span class="tag ${d <= 7 ? 'tag-status-inactive' : 'tag-status-leave'}">⏰ ${d} ڕۆژ ماوە</span>`}</div>
                <div class="emp-info"><div>📅 ${c.start || '—'} → <strong>${c.end}</strong></div><div>📱 ${esc(e.phone)}</div></div>
            </div></div>`;
    }).join('') : '<div class="empty-msg" style="grid-column:1/-1;"><span class="icon">✅</span>هیچ کارمەندێک نزیک نییە لە کۆتایی گرێبەست</div>';
}

/* ---------- پرینتی هەموو زانیارییەکانی کارمەند ---------- */
function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    const base = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
    return new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = base + 'pdf.min.js';
        s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js'; res(window.pdfjsLib); };
        s.onerror = () => rej(new Error('pdf.js'));
        document.head.appendChild(s);
    });
}

// هەر لاپەڕەیەکی PDF دەکاتە وێنە (زۆرترین ٣٠ لاپەڕە بۆ هەر PDF)
async function pdfPages(blob) {
    const lib = await loadPdfJs();
    const pdf = await lib.getDocument({ data: await blob.arrayBuffer() }).promise;
    const pages = [];
    for (let n = 1; n <= Math.min(pdf.numPages, 30); n++) {
        const page = await pdf.getPage(n), vp = page.getViewport({ scale: 1.6 });
        const c = document.createElement('canvas');
        c.width = vp.width; c.height = vp.height;
        await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        pages.push(c.toDataURL('image/jpeg', 0.85));
    }
    return { pages, total: pdf.numPages };
}

async function printEmployee(id) {
    const e = loadEmps().find(x => x.id === id);
    if (!e) return;
    const w = window.open('', '_blank');   // دەبێت ڕاستەوخۆ لەگەڵ کلیکەکە بکرێتەوە
    if (!w) { alert('تکایە ڕێگە بدە بە کردنەوەی پەنجەرەی نوێ (Pop-up) بۆ ئەم پەڕەیە'); return; }
    w.document.write('<body style="font-family:sans-serif;padding:30px">⏳ ...</body>');

    const T = k => (window.royaTr ? window.royaTr(k) : k);
    const dir = document.documentElement.dir || 'rtl';
    const toData = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
    let hasPdf = false;
    const gallery = async files => {
        let out = '';
        for (const f of files || []) {
            const b = await fileDB.get(f.id);
            if (b && f.type && f.type.startsWith('image/')) {
                out += `<figure><img src="${await toData(b)}" alt=""><figcaption>${esc(f.name)}</figcaption></figure>`;
            } else if (b && f.type === 'application/pdf') {
                hasPdf = true;
                try {
                    const r = await pdfPages(b);
                    out += `<div class="pdfdoc"><div class="pdf">📄 ${esc(f.name)} (${r.total})</div>${r.pages.map(p => `<figure><img src="${p}" alt=""></figure>`).join('')}</div>`;
                } catch (err) {
                    out += `<div class="pdfdoc"><div class="pdf">📄 ${esc(f.name)} — PDF (⚠️ ئینتەرنێت پێویستە بۆ پرینتی لاپەڕەکان)</div></div>`;
                }
            } else out += `<div class="pdf">📄 ${esc(f.name)}</div>`;
        }
        return out ? `<div class="gal">${out}</div>` : '';
    };
    const money = c => c && c.salary !== undefined && c.salary !== '' ? `${Number(c.salary).toLocaleString('en-US')} ${T(c.currency === 'USD' ? 'دۆلار' : 'دینار')}` : '';
    const row = (k, v) => v ? `<tr><th>${T(k)}</th><td>${v}</td></tr>` : '';
    const ltr = s => s ? `<span dir="ltr">${esc(s)}</span>` : '';

    const br = loadBranches().find(b => b.id === e.branch), st = STATUS_MAP[e.status];
    const rel = e.relative || {}, g = e.guarantor || {}, cs = e.contracts || [], lc = cs[cs.length - 1];

    const info = [
        row('ڕۆلی کارمەند', esc(T(getRoleLabel(e.role)))),
        row('شوێنی کارکردن (لق)', e.branch === 'all' ? T('هەموو لقەکان') : br ? esc(br.name) + (br.location ? ' — ' + esc(br.location) : '') : ''),
        row('دۆخی کارمەند', st ? T(st.text) : ''),
        row('ژمارە مۆبایلی خۆت', ltr(e.phone)),
        row('کەسی یەکەم (پەیوەندی)', rel.type ? `${esc(T(rel.type))} — ${ltr(rel.phone)}` : ''),
        row('ناونیشانی ماڵی کارمەند', esc(e.address)),
        row('ئیمەیل', ltr(e.email)),
        row('ناوی بەکارهێنەر (بە ئینگلیزی)', ltr(e.username)),
        `<tr id="pw" style="display:none"><th>${T('وشەی نهێنی')}</th><td dir="ltr">${esc(e.password)}</td></tr>`,
        row('مووچەی ئێستا', money(lc)),
        row('تێبینی', esc(e.notes))
    ].join('');

    let docs = '';
    for (const d of e.docs || []) docs += `<h4>${esc(T(d.label || DOC_TYPES[d.type] || d.type))}</h4>` + await gallery(d.files);
    let cts = '';
    for (const c of cs) cts += `<div class="ct"><b>${c.start || '—'} → ${c.end || '—'}</b>${money(c) ? ` &nbsp; 💰 ${money(c)}` : ''}${c.notes ? `<div>${esc(c.notes)}</div>` : ''}${await gallery(c.files)}</div>`;
    const guar = (g.name || g.phone || (g.files || []).length)
        ? `<table>${row('ناوی چواری کەفیل', esc(g.name))}${row('ژمارە مۆبایلی کەفیل', ltr(g.phone))}</table>` + await gallery(g.files) : '';

    const html = `<!DOCTYPE html><html dir="${dir}"><head><meta charset="utf-8"><title>${esc(e.nameKu || e.name)}</title><style>
        @page { size: A4; margin: 14mm; }
        body { font-family: 'Segoe UI', Tahoma, 'Noto Kufi Arabic', sans-serif; color: #111; margin: 0; padding: 18px; }
        .bar { position: sticky; top: 0; background: #f1f5f9; padding: 8px 12px; display: flex; gap: 14px; align-items: center; margin-bottom: 12px; border-radius: 8px; }
        .bar button { padding: 8px 16px; font: inherit; cursor: pointer; }
        header { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #0284c7; padding-bottom: 10px; margin-bottom: 14px; }
        .logo { width: 54px; height: 54px; border-radius: 50%; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; font: 700 14px 'Segoe UI', sans-serif; direction: ltr; }
        h1 { font-size: 20px; margin: 0; } h2 { margin: 0 0 4px; font-size: 20px; }
        h3 { font-size: 15px; color: #0369a1; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin: 18px 0 8px; }
        h4 { margin: 10px 0 4px; font-size: 13px; }
        .top { display: flex; gap: 16px; align-items: center; margin-bottom: 12px; }
        .photo { width: 110px; height: 110px; object-fit: cover; border-radius: 12px; border: 1px solid #cbd5e1; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: start; vertical-align: top; }
        th { width: 34%; background: #f1f5f9; }
        .gal { display: flex; flex-wrap: wrap; gap: 10px; }
        figure { margin: 0; width: 48%; break-inside: avoid; }
        figure img { width: 100%; max-height: 330px; object-fit: contain; border: 1px solid #cbd5e1; }
        figcaption { font-size: 10px; color: #64748b; }
        .pdf { padding: 8px 12px; border: 1px dashed #94a3b8; border-radius: 8px; font-size: 12px; }
        .pdfdoc { width: 100%; }
        .pdfdoc figure { width: 100%; break-inside: avoid; break-after: page; margin-bottom: 8px; }
        .pdfdoc figure img { max-height: 250mm; }
        body.nopdf .pdfdoc { display: none; }
        .ct { margin-bottom: 12px; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 8px; break-inside: avoid; }
        @media print { .no-print { display: none; } }
    </style></head><body>
        <div class="bar no-print"><button onclick="print()">🖨️ ${T('پرینت')}</button>
            <label><input type="checkbox" onchange="document.getElementById('pw').style.display = this.checked ? '' : 'none'"> ${T('وشەی نهێنی پیشان بدە')}</label>
            ${hasPdf ? `<label><input type="checkbox" checked onchange="document.body.classList.toggle('nopdf', !this.checked)"> 📄 ${T('PDF لەگەڵ پرینت بکرێت')}</label>` : ''}</div>
        <header><div class="logo">Roya</div><div><h1>${T('زانیاری کارمەند')}</h1><small>${T('بەرواری پرینت')}: ${new Date().toLocaleDateString('en-GB')}</small></div></header>
        <div class="top">${e.photo ? `<img class="photo" src="${e.photo}" alt="">` : ''}
            <div><h2>${esc(e.nameKu || e.name)}</h2><div>${esc(e.nameAr)}</div><div dir="ltr">${esc(e.nameEn)}</div></div></div>
        <table>${info}</table>
        ${docs ? `<h3>🪪 ${T('هەویە')}</h3>${docs}` : ''}
        ${cts ? `<h3>📄 ${T('گرێبەستەکان')}</h3>${cts}` : ''}
        ${guar ? `<h3>🛡️ ${T('کەفیل')}</h3>${guar}` : ''}
    </body></html>`;
    w.document.open(); w.document.write(html); w.document.close();
}

/* ---------- دەستپێکردن ---------- */
buildForm();   // پێش DOMContentLoaded، تا init ی employee.js فۆرمە نوێیەکە ببینێت
document.addEventListener('DOMContentLoaded', () => {
    // ئەگەر init ی employee.js بۆ هەر هۆیەک وەستابێت، ئەمە هەموو شتێک دەگەڕێنێتەوە
    const safe = fn => { try { fn(); } catch (e) { console.error(fn.name, e); } };
    [populateSelects, renderBranchesList, renderEmployeesList, initEmployeeForm, initPhotoUpload, initRenewContractForm, resetFormState].forEach(safe);
    byId('ctBranch').addEventListener('change', renderContractEnd);
    safe(renderContractEnd);
});