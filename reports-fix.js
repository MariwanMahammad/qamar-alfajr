/* ==========================================
   reports-fix.js — چاکسازی و وەرگێڕانی پەڕەی ڕاپۆرتی تەواو
   دەبێت دوای reports.js و پێش sidebar.js بار بکرێت
   ========================================== */
(function () {
    const read = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
    const trText = t => (window.royaTr ? window.royaTr(t) : t);   // sidebar.js: وەرگێڕان بەپێی زمانی هەڵبژێردراو

    /* ١) جۆرەکانی مۆڵەت: ئیتر خۆکارانە ٧ جۆر نادرێنە ناو لیستەکەوە (تەنها ئەوەی لە بەشی «زیادکردن» دانراوە) */
    window.loadLeaveTypes = () => read('leaveTypesList');

    /* ٢) ماوە بە کوردیی ڕەسەن: ڕۆژ، کاتژمێر، خولەک */
    window.formatDuration = function (days, hours, minutes) {
        const parts = [];
        if (days > 0) parts.push(`${days} ڕۆژ`);
        if (hours > 0) parts.push(`${hours} کاتژمێر`);
        if (minutes > 0) parts.push(`${minutes} خولەک`);
        return parts.length ? parts.join(' و ') : '0';
    };

    /* ٣) بەڕێوەبەری گشتی (لقی «هەموو لقەکان») */
    window.getBranchName = id => id === 'all' ? 'هەموو لقەکان' : ((read('branchesList').find(b => b.id === id) || {}).name || '—');
    window.loadEmployees = function () {
        const list = read('employeesList');
        const sel = document.getElementById('filterBranch');
        const chosen = sel ? sel.value : '';
        // کاتێک لقێک هەڵبژێردرابێت، بەڕێوەبەری هەموو لقەکان لەو لقەشدا دەردەکەوێت
        return chosen ? list.map(e => e.branch === 'all' ? { ...e, branch: chosen } : e) : list;
    };

    /* ٤) پەنجەرەکانی پرینت / وردەکاری / PDF: بەپێی زمانی هەڵبژێردراو وەردەگێڕدرێن */
    function translatePopup(w) {
        try {
            const d = w.document, lang = localStorage.getItem('royaLang') || 'ku';
            d.documentElement.lang = lang;
            d.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
            const walker = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT);
            const nodes = [];
            while (walker.nextNode()) nodes.push(walker.currentNode);
            nodes.forEach(n => { if (n.nodeValue.trim()) n.nodeValue = trText(n.nodeValue); });
            if (d.title) d.title = trText(d.title);
        } catch (e) { console.error('popup translate', e); }
    }
    const nativeOpen = window.open;
    window.open = function (...args) {
        const w = nativeOpen.apply(window, args);
        if (w && args[0] === '') {
            const close = w.document.close.bind(w.document);
            w.document.close = function () { close(); translatePopup(w); };
        }
        return w;
    };

    /* ٥) Excel: دەقی نێوان تاگەکان بەپێی زمان وەردەگێڕدرێت */
    const trHtml = html => html.replace(/>([^<>]+)</g, (m, t) => t.trim() ? '>' + trText(t) + '<' : m);
    const NativeBlob = window.Blob;
    window.Blob = function (parts, opts) {
        if (opts && /excel/i.test(opts.type || '')) parts = parts.map(p => typeof p === 'string' ? trHtml(p) : p);
        return new NativeBlob(parts, opts);
    };
    window.Blob.prototype = NativeBlob.prototype;
})();