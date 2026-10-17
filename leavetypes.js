/* ==========================================
   leavetypes.js — بەشی جۆرەکانی مۆڵەت
   جۆرەکان لە لیستێکەوە هەڵدەبژێردرێن، یان جۆری تر خۆت دەینووسیت
   دەبێت دوای employee.js و branches.js بار بکرێت
   ========================================== */
const LEAVE_PRESETS = [
    { id: 'regular',    name: 'ئاسایی',      icon: '📅' },
    { id: 'sick',       name: 'نەخۆشی',      icon: '🤒' },
    { id: 'travel',     name: 'سەفەر',       icon: '✈️' },
    { id: 'maternity',  name: 'دائیرە',      icon: '👶' },
    { id: 'condolence', name: 'تازیە',       icon: '🕊️' },
    { id: 'marriage',   name: 'هاوسەرگیری',  icon: '💍' }
];

function readLeaveTypes() {
    try { return JSON.parse(localStorage.getItem('leaveTypesList')) || []; } catch (e) { return []; }
}
function writeLeaveTypes(list) { localStorage.setItem('leaveTypesList', JSON.stringify(list)); }

// پێشتر خۆی ٧ جۆری دەخستە ناو لیستەکە؛ ئێستا تەنها ئەوەی تۆ زیادت کردووە دەمێنێت
function loadLeaveTypes() { return readLeaveTypes(); }

/* لیستی هەڵبژاردن: ئەو جۆرانەی هێشتا زیاد نەکراون + «جۆری تر» */
function fillLeavePick() {
    const sel = document.getElementById('leaveTypePick');
    if (!sel) return;
    const have = readLeaveTypes();
    const free = LEAVE_PRESETS.filter(p => !have.some(t => t.id === p.id || t.name === p.name));
    sel.innerHTML = free.map(p => `<option value="${p.id}">${p.icon} ${p.name}</option>`).join('')
        + '<option value="__custom">✍️ جۆری تر (خۆت بنووسە)...</option>';
    onLeavePick();
}

function onLeavePick() {
    const custom = document.getElementById('leaveTypePick').value === '__custom';
    document.getElementById('newLeaveTypeName').style.display = custom ? '' : 'none';
}

function renderLeaveTypes() {
    const box = document.getElementById('leaveTypesList');
    const count = document.getElementById('leaveTypeCount');
    if (!box) return;
    const types = readLeaveTypes();
    count.innerText = `(${types.length} جۆر)`;
    box.innerHTML = types.length ? types.map(t => `
        <div class="leave-type-item">
            <div class="leave-type-info"><span class="icon">${esc(t.icon || '📌')}</span><span>${esc(t.name)}</span></div>
            <button class="leave-type-delete" onclick="deleteLeaveType('${esc(t.id)}')" title="سڕینەوە">🗑️</button>
        </div>`).join('')
        : '<div class="empty-msg" style="grid-column:1/-1;"><span class="icon">📋</span>هێشتا هیچ جۆرێک زیاد نەکراوە</div>';
    fillLeavePick();
}

function addNewLeaveType() {
    const sel = document.getElementById('leaveTypePick');
    const input = document.getElementById('newLeaveTypeName');
    const types = readLeaveTypes();
    let t;

    if (sel.value === '__custom') {
        const name = input.value.trim();
        if (!name) { showMessage('leaveTypeMessage', 'تکایە ناوی جۆری مۆڵەت بنووسە!', 'error'); return; }
        if (types.some(x => x.name === name)) { showMessage('leaveTypeMessage', 'ئەم جۆرە پێشتر هەیە!', 'error'); return; }
        t = { id: 'custom_' + Date.now(), name, icon: '📌' };
    } else {
        const p = LEAVE_PRESETS.find(x => x.id === sel.value);
        if (!p) return;
        t = { ...p };
    }

    types.push(t);
    writeLeaveTypes(types);
    input.value = '';
    renderLeaveTypes();
    showMessage('leaveTypeMessage', `✅ جۆری "${t.name}" بە سەرکەوتوویی زیادکرا`, 'success');
}

function deleteLeaveType(id) {
    if (!confirm('دڵنیایت لە سڕینەوەی ئەم جۆرە؟')) return;
    const types = readLeaveTypes();
    const gone = types.find(t => t.id === id);
    writeLeaveTypes(types.filter(t => t.id !== id));
    renderLeaveTypes();
    if (gone) showMessage('leaveTypeMessage', `🗑️ جۆری "${gone.name}" سڕدرایەوە`, 'success');
}

// خۆی دەستپێدەکات، تەنانەت ئەگەر init ی employee.js بۆ هەر هۆیەک وەستابێت
document.addEventListener('DOMContentLoaded', renderLeaveTypes);