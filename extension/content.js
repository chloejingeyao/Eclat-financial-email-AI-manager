(function () {
  'use strict';

  // ── Helpers ───────────────────────────────────────────────────────────────
  function localDateStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
  function nDaysAgo(n) {
    const d = new Date(); d.setDate(d.getDate() - n); return localDateStr(d);
  }
  function fmtDate(str) {
    if (!str) return '';
    const d = new Date(str + 'T12:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function fmtSender(raw) {
    if (!raw) return '';
    const m = raw.match(/^"?([^"<]+)"?\s*</);
    return m ? m[1].trim() : raw.split('@')[0];
  }
  function debounce(fn, ms) {
    let t; return function() { const a = arguments; clearTimeout(t); t = setTimeout(() => fn.apply(null, a), ms); };
  }
  function gmailUrl(threadId) {
    return 'https://mail.google.com/mail/u/0/#all/' + threadId;
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let panelOpen = false;
  let widgetRoot = null;
  let shadow = null;
  let triggerBtn = null;
  let scanning = false;
  let startDate = nDaysAgo(7);
  let endDate   = localDateStr();

  // ── Tab / history state ───────────────────────────────────────────────────
  let activeTab = 'scan';

  function fmtTs(isoStr) {
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' at ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  function fmtHistRange(dateRange) {
    if (!dateRange) return 'All emails';
    const s = fmtDate(dateRange.start);
    const e = fmtDate(dateRange.end);
    if (!s && !e) return 'All emails';
    if (s === e) return s || 'All emails';
    return `${s} \u2192 ${e}`;
  }

  // ── Calendar state ────────────────────────────────────────────────────────
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAY_NAMES   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  let calOpen    = false;
  let calYear    = new Date().getFullYear();
  let calMonth   = new Date().getMonth();
  let calPicking = null;
  let calHovered = null;

  function toISO(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  function fmtPill(str) {
    if (!str) return '\u2014';
    const d = new Date(str + 'T12:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function updatePill() {
    const pill = shadow && shadow.getElementById('date-pill');
    if (pill) pill.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="flex-shrink:0;color:#9CA3AF">
        <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
        <path d="M1 5h10" stroke="currentColor" stroke-width="1.2"/>
        <path d="M4 1v2M8 1v2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
      ${fmtPill(startDate)} \u2192 ${fmtPill(endDate)}`;
  }
  function openCal() {
    calOpen = true;
    calPicking = null;
    const calEl = shadow.getElementById('cal-panel');
    const pill  = shadow.getElementById('date-pill');
    const ctrl  = shadow.querySelector('.controls');
    const box   = shadow.getElementById('date-box');
    renderCalendar();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (calEl) calEl.classList.add('cal-visible');
      if (box)   box.classList.add('box-open');
    }));
    if (pill) pill.classList.add('pill-expanded');
    if (ctrl) ctrl.classList.add('cal-open');
  }
  function closeCal() {
    calOpen = false;
    calPicking = null;
    calHovered = null;
    const calEl = shadow.getElementById('cal-panel');
    const pill  = shadow.getElementById('date-pill');
    const ctrl  = shadow.querySelector('.controls');
    const box   = shadow.getElementById('date-box');
    if (calEl) calEl.classList.remove('cal-visible');
    if (box)   box.classList.remove('box-open');
    if (pill)  pill.classList.remove('pill-expanded');
    if (ctrl)  ctrl.classList.remove('cal-open');
  }
  function renderCalendar() {
    const calEl = shadow && shadow.getElementById('cal-inner-wrap');
    if (!calEl) return;
    const year = calYear, month = calMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const effectiveStart = calPicking || startDate;
    const effectiveEnd   = calPicking ? null : endDate;
    const lo = effectiveStart && effectiveEnd ? (effectiveStart < effectiveEnd ? effectiveStart : effectiveEnd) : null;
    const hi = effectiveStart && effectiveEnd ? (effectiveStart < effectiveEnd ? effectiveEnd : effectiveStart) : null;
    const hLo = calPicking && calHovered ? (calPicking < calHovered ? calPicking : calHovered) : null;
    const hHi = calPicking && calHovered ? (calPicking < calHovered ? calHovered : calPicking) : null;

    let dnames = DAY_NAMES.map(n => `<div class="cal-dname">${n}</div>`).join('');
    let empty  = Array(firstDay).fill('<div></div>').join('');
    let days   = '';
    for (let d = 1; d <= totalDays; d++) {
      const iso   = toISO(year, month, d);
      const isSt  = iso === effectiveStart;
      const isEn  = iso === effectiveEnd;
      const inR   = lo && hi && iso > lo && iso < hi;
      const inHov = hLo && hHi && iso > hLo && iso < hHi;
      const inPickingMode = !!calPicking;
      const edgeCls = inPickingMode && isSt ? 'cal-picking-start'
                    : isSt ? 'cal-edge cal-edge-start'
                    : isEn ? 'cal-edge cal-edge-end' : '';
      const cls = ['cal-day', edgeCls, (inR || inHov) ? 'cal-inrange' : ''].filter(Boolean).join(' ');
      days += `<div class="${cls}" data-iso="${iso}"><div class="cal-inner">${d}</div></div>`;
    }

    calEl.innerHTML = `
      <div class="cal-nav">
        <button class="cal-nav-btn" id="cal-prev">&#8249;</button>
        <span class="cal-month-label">${MONTH_NAMES[month]} ${year}</span>
        <button class="cal-nav-btn" id="cal-next">&#8250;</button>
      </div>
      <div class="cal-grid">${dnames}${empty}${days}</div>`;

    shadow.getElementById('cal-prev').addEventListener('click', e => {
      e.stopPropagation();
      calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
      renderCalendar();
    });
    shadow.getElementById('cal-next').addEventListener('click', e => {
      e.stopPropagation();
      calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
      renderCalendar();
    });
    calEl.querySelectorAll('.cal-day').forEach(el => {
      const iso = el.dataset.iso;
      el.addEventListener('click', e => {
        e.stopPropagation();
        if (!calPicking) {
          calPicking = iso;
          startDate = iso;
          endDate = iso;
          updatePill();
          renderCalendar();
        } else {
          const picked = calPicking;
          calPicking = null;
          startDate = picked < iso ? picked : iso;
          endDate   = picked < iso ? iso : picked;
          updatePill();
          renderCalendar();
        }
      });
      el.addEventListener('mouseenter', () => { calHovered = iso; });
      el.addEventListener('mouseleave', () => { calHovered = null; });
    });
  }

  const CATEGORIES = [
    { key: 'Merchant Promotions',              label: 'Merchant',     chipClass: 'chip-merchant', dot: '#F59E0B' },
    { key: 'Financial Rewards & Perks',        label: 'Rewards',      chipClass: 'chip-rewards',  dot: '#8B5CF6' },
    { key: 'Credit Card Rewards',              label: 'Rewards',      chipClass: 'chip-rewards',  dot: '#8B5CF6' },
    { key: 'Subscription & Status Management', label: 'Subscription', chipClass: 'chip-sub',      dot: '#EF4444' },
    { key: 'Subscription Management',         label: 'Subscription', chipClass: 'chip-sub',      dot: '#EF4444' },
  ];

  // ── Shadow DOM Setup ──────────────────────────────────────────────────────
  function buildWidget() {
    widgetRoot = document.createElement('div');
    widgetRoot.id = 'eclat-widget-root';
    widgetRoot.style.cssText = 'position:fixed;z-index:9999999;top:0;right:0;pointer-events:none;';
    document.body.appendChild(widgetRoot);
    shadow = widgetRoot.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      :host { font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; }

      #panel {
        pointer-events: all;
        position: fixed; top: 52px; right: 14px;
        width: 384px;
        background: #FAFAF9;
        border: 1px solid rgba(0,0,0,0.09);
        border-radius: 18px;
        box-shadow: 0 16px 48px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.06);
        display: none; flex-direction: column;
        max-height: 580px; overflow-y: auto;
        animation: fadeIn 0.2s cubic-bezier(0.16,1,0.3,1);
        scroll-behavior: smooth;
      }
      #panel.open { display: flex; }
      #panel::-webkit-scrollbar { width: 3px; }
      #panel::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 4px; }
      @keyframes fadeIn { from { opacity:0; transform:translateY(-10px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }

      .hdr {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 16px; border-bottom: 1px solid rgba(0,0,0,0.06);
        flex-shrink: 0; background: #fff; border-radius: 18px 18px 0 0;
      }
      .brand { display: flex; align-items: center; gap: 9px; }
      .brand-icon {
        width: 26px; height: 26px; border-radius: 7px; background: #111827;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .brand-name { font-size: 15px; font-weight: 600; color: #111827; letter-spacing: -0.02em; }
      .close-btn {
        background: none; border: none; cursor: pointer; color: #9CA3AF;
        width: 28px; height: 28px; border-radius: 7px;
        display: flex; align-items: center; justify-content: center;
        transition: color 0.12s, background 0.12s;
      }
      .close-btn:hover { color: #374151; background: #F3F4F6; }

      .controls {
        padding: 12px 14px;
        flex-shrink: 0; background: #fff;
        border-bottom: 1px solid rgba(0,0,0,0.06);
        transition: border-bottom-color 0.2s, padding-bottom 0.2s;
      }
      .controls.cal-open { border-bottom-color: transparent; padding-bottom: 0; }

      /* Unified box that wraps pill + calendar when open */
      .date-box {
        border: 1px solid #E5E7EB; border-radius: 11px;
        overflow: hidden;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      .date-box.box-open { border-color: #D1D5DB; box-shadow: 0 2px 10px rgba(0,0,0,0.06); }

      .date-pill {
        width: 100%; padding: 9px 12px; border-radius: 0;
        border: none; background: transparent;
        font-size: 12.5px; font-weight: 500; color: #374151;
        cursor: pointer; font-family: inherit; letter-spacing: 0.01em;
        transition: background 0.15s;
        display: flex; align-items: center; justify-content: center; gap: 7px;
      }
      .date-pill:hover:not(.pill-expanded) { background: #F5F4F1; }
      .date-pill.pill-expanded { cursor: default; pointer-events: none; }

      .cal-panel {
        background: #fff; padding: 0 10px;
        overflow: hidden;
        max-height: 0; opacity: 0;
        transition: max-height 0.32s cubic-bezier(0.16,1,0.3,1), opacity 0.22s ease;
        border-top: 0px solid #F0EFEB;
        transition: max-height 0.32s cubic-bezier(0.16,1,0.3,1), opacity 0.22s ease, border-top-width 0.1s;
      }
      .cal-panel.cal-visible {
        max-height: 340px; opacity: 1;
        border-top-width: 1px;
      }
      .cal-nav { display: flex; align-items: center; justify-content: space-between; padding: 10px 0 4px; width: 224px; margin: 0 auto; }
      .cal-nav-btn {
        background: none; border: none; cursor: pointer; color: #6B7280;
        width: 28px; height: 28px; border-radius: 7px; font-size: 18px;
        display: flex; align-items: center; justify-content: center;
        font-family: inherit; transition: background 0.12s, color 0.12s;
      }
      .cal-nav-btn:hover { background: #EBEBEA; color: #111827; }
      .cal-month-label { font-size: 13px; font-weight: 600; color: #111827; letter-spacing: -0.01em; }
      .cal-grid { display: grid; grid-template-columns: repeat(7, 32px); justify-content: center; padding-bottom: 4px; }
      .cal-dname { width: 32px; text-align: center; font-size: 10px; font-weight: 600; color: #9CA3AF; padding: 2px 0 7px; letter-spacing: 0.04em; }
      .cal-day { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
      .cal-day.cal-inrange { background: #F3F2EF; }
      .cal-day.cal-edge    { background: #F3F2EF; }
      .cal-day.cal-edge-start { border-radius: 50% 0 0 50%; }
      .cal-day.cal-edge-end   { border-radius: 0 50% 50% 0; }
      .cal-inner { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; color: #111827; transition: background 0.1s; }
      .cal-day.cal-edge .cal-inner { background: #111827; color: #fff; font-weight: 600; }
      .cal-day.cal-picking-start .cal-inner { background: #111827; color: #fff; font-weight: 600; }
      .cal-day:not(.cal-edge):not(.cal-picking-start):hover .cal-inner { background: #DDDCDA; }

      /* Cancel / Confirm footer */
      .cal-actions {
        display: flex; gap: 8px; padding: 10px 0 12px;
        border-top: 1px solid #F0EFEB; margin-top: 4px;
      }
      .cal-cancel {
        flex: 1; padding: 7px 0; border-radius: 8px;
        border: 1px solid #E5E7EB; background: transparent;
        font-size: 12.5px; font-weight: 500; color: #6B7280;
        cursor: pointer; font-family: inherit;
        transition: background 0.12s, border-color 0.12s;
      }
      .cal-cancel:hover { background: #EBEBEA; border-color: #D1D5DB; }
      .cal-confirm {
        flex: 1; padding: 7px 0; border-radius: 8px;
        border: none; background: #111827;
        font-size: 12.5px; font-weight: 500; color: #fff;
        cursor: pointer; font-family: inherit;
        transition: background 0.12s;
      }
      .cal-confirm:hover { background: #1F2937; }

      .scan-btn {
        width: 100%; padding: 10px 0; border-radius: 9px; border: none;
        background: #111827; color: #fff; font-size: 13.5px; font-weight: 500;
        cursor: pointer; font-family: inherit; letter-spacing: 0.01em;
        box-shadow: 0 1px 4px rgba(0,0,0,0.2);
        transition: background 0.15s, box-shadow 0.15s;
        display: flex; align-items: center; justify-content: center; gap: 8px;
      }
      .scan-btn:hover:not(:disabled) { background: #1F2937; box-shadow: 0 2px 8px rgba(0,0,0,0.25); }
      .scan-btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }

      .spinner {
        width: 13px; height: 13px; border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
        animation: spin 0.7s linear infinite; flex-shrink: 0;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes shimmer { 0%{background-position:-300px 0} 100%{background-position:300px 0} }
      @keyframes slide-indeterminate { 0%{transform:translateX(-150%)} 100%{transform:translateX(450%)} }
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

      /* spacing scale: xs=4 sm=8 md=12 lg=16 xl=24 */

      .results { padding: 16px 14px 14px; }
      .scan-footer { padding: 4px 14px 22px; }

      .scan-meta { font-size: 11.5px; color: #9CA3AF; margin-bottom: 16px; letter-spacing: 0.01em; }
      .scan-meta b { color: #374151; font-weight: 600; }

      /* xl gap between category groups; last group lets results padding handle the bottom */
      .cat-section { margin-bottom: 24px; }
      .cat-section:last-child { margin-bottom: 0; }
      .cat-header { display: flex; align-items: center; gap: 6px; margin-bottom: 11px; padding-bottom: 0; }
      .cat-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
      .cat-name { font-size: 10px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.08em; flex: 1; }
      .cat-count { font-size: 10.5px; font-weight: 600; padding: 1px 6px; border-radius: 8px; background: #F3F4F6; color: #6B7280; }

      .email-card {
        padding: 12px; border: 1px solid #EBEBEB; border-radius: 11px;
        margin-bottom: 8px; background: #fff;
        display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;
        transition: box-shadow 0.15s, border-color 0.15s, transform 0.15s;
      }
      .email-card:last-child { margin-bottom: 0; }
      .email-card:hover { border-color: #D1D5DB; box-shadow: 0 3px 12px rgba(0,0,0,0.07); transform: translateY(-1px); }
      .email-info { flex: 1; min-width: 0; }

      .email-chip {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 2px 7px 2px 5px; border-radius: 20px; margin-bottom: 7px;
        font-size: 9.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
      }
      .email-chip-dot { width: 4px; height: 4px; border-radius: 50%; flex-shrink: 0; }
      .chip-merchant { background: #FFFBEB; color: #92400E; border: 1px solid #FDE68A; }
      .chip-merchant .email-chip-dot { background: #F59E0B; }
      .chip-rewards  { background: #F5F3FF; color: #5B21B6; border: 1px solid #DDD6FE; }
      .chip-rewards  .email-chip-dot { background: #8B5CF6; }
      .chip-sub      { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }
      .chip-sub      .email-chip-dot { background: #EF4444; }

      .email-perk { font-size: 12.5px; font-weight: 600; color: #111827; margin-bottom: 5px; line-height: 1.35; letter-spacing: -0.015em; }
      .email-meta { font-size: 11px; color: #9CA3AF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .email-meta b { color: #6B7280; font-weight: 500; }
      .email-due { color: #D97706; font-weight: 500; }
      .open-link { font-size: 12px; color: #C4C9D4; text-decoration: none; flex-shrink: 0; transition: color 0.12s; padding-top: 2px; }
      .open-link:hover { color: #111827; }

      .state-idle { padding: 36px 8px 16px; text-align: center; }
      .state-idle-icon { margin-bottom: 14px; }
      .state-idle-title { font-size: 13.5px; font-weight: 500; color: #374151; margin-bottom: 6px; letter-spacing: -0.01em; }
      .state-idle-sub { font-size: 12px; color: #9CA3AF; line-height: 1.6; }

      .state-error { padding: 12px 13px; border-radius: 9px; background: #FEF2F2; border: 1px solid #FECACA; color: #B91C1C; font-size: 12px; line-height: 1.55; }
      .state-model-warn { padding: 10px 12px; border-radius: 9px; background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; font-size: 11.5px; line-height: 1.55; margin-top: 10px; }
      .no-signals { text-align: center; padding: 28px 0; color: #9CA3AF; font-size: 13px; }

      .progress-wrap { padding: 12px 4px 22px; }
      .progress-label { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #6B7280; margin-bottom: 10px; }
      .progress-dot { width: 6px; height: 6px; border-radius: 50%; background: #111827; display: inline-block; margin-right: 6px; animation: pulse 1.2s ease-in-out infinite; }
      .progress-track { height: 2px; background: #F0F0EE; border-radius: 2px; overflow: hidden; }
      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #111827 0%, #6B7280 50%, #111827 100%);
        background-size: 300px 100%;
        border-radius: 2px; transition: width 0.6s ease;
        animation: shimmer 1.8s linear infinite;
      }
      .progress-fill.indeterminate {
        width: 30%; transition: none;
        animation: shimmer 1.8s linear infinite, slide-indeterminate 1.6s ease-in-out infinite;
      }

      /* ── Tabs ── */
      .tab-bar {
        display: flex; padding: 0 14px; flex-shrink: 0;
        background: #fff; border-bottom: 1px solid rgba(0,0,0,0.06);
      }
      .tab-btn {
        padding: 11px 12px 10px; border: none; background: none;
        font-size: 13px; font-weight: 500; color: #9CA3AF;
        cursor: pointer; font-family: inherit; letter-spacing: -0.01em;
        border-bottom: 2px solid transparent; margin-bottom: -1px;
        display: inline-flex; align-items: center; gap: 5px;
        transition: color 0.12s, border-color 0.12s;
      }
      .tab-btn.active { color: #111827; border-bottom-color: #111827; }
      .tab-btn:hover:not(.active) { color: #374151; }

      /* ── History list ── */
      .history-view { padding: 14px 14px 22px; }
      .history-empty { text-align: center; padding: 40px 8px; color: #9CA3AF; font-size: 13px; }
      .hist-item {
        padding: 12px; border: 1px solid #EBEBEB; border-radius: 11px;
        margin-bottom: 8px; background: #fff; cursor: pointer;
        display: flex; align-items: center; gap: 10px;
        transition: border-color 0.12s, box-shadow 0.12s, transform 0.12s;
      }
      .hist-item:last-child { margin-bottom: 0; }
      .hist-item:hover { border-color: #D1D5DB; box-shadow: 0 3px 10px rgba(0,0,0,0.06); transform: translateY(-1px); }
      .hist-item-main { flex: 1; min-width: 0; }
      .hist-dr { font-size: 12.5px; font-weight: 500; color: #111827; margin-bottom: 3px; letter-spacing: -0.01em; }
      .hist-meta { font-size: 11px; color: #9CA3AF; }
      .hist-badge {
        font-size: 10.5px; font-weight: 500; padding: 2px 8px; border-radius: 20px;
        background: #F3F4F6; color: #374151; white-space: nowrap; flex-shrink: 0;
      }
      .hist-chevron { flex-shrink: 0; color: #D1D5DB; }

      /* ── History detail back button ── */
      .hist-back {
        display: flex; align-items: center; gap: 5px; margin-bottom: 0;
        background: none; border: none; cursor: pointer; padding: 0;
        font-size: 12px; font-weight: 500; color: #6B7280;
        font-family: inherit; transition: color 0.12s;
      }
      .hist-back:hover { color: #111827; }

      /* ── Screened-out section ── */
      .screened-toggle {
        display: flex; align-items: center; gap: 8px; width: 100%;
        background: none; border: none; cursor: pointer; padding: 16px 0 0;
        border-top: 1px solid #F0EFEB; margin-top: 16px;
        font-family: inherit;
      }
      .screened-label {
        font-size: 10px; font-weight: 700; color: #9CA3AF;
        text-transform: uppercase; letter-spacing: 0.08em; flex: 1; text-align: left;
      }
      .screened-count {
        font-size: 10.5px; font-weight: 600; padding: 1px 6px; border-radius: 8px;
        background: #F3F4F6; color: #6B7280;
      }
      .screened-chevron { color: #9CA3AF; transition: transform 0.15s; flex-shrink: 0; }
      .screened-chevron.open { transform: rotate(180deg); }
      .screened-list { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
      .screened-row {
        display: flex; align-items: flex-start; gap: 8px;
        padding: 9px 10px; border-radius: 8px;
        background: #FAFAF9; border: 1px solid #F0EFEB;
      }
      .screened-info { flex: 1; min-width: 0; }
      .screened-subject {
        font-size: 12px; font-weight: 500; color: #374151;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .screened-sender {
        font-size: 11px; color: #9CA3AF; margin-top: 2px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .screened-reason {
        font-size: 10px; color: #9CA3AF; background: #F3F4F6;
        border: 1px solid #EBEBEA; padding: 2px 6px; border-radius: 20px;
        white-space: nowrap; flex-shrink: 0; align-self: center;
      }
      .screened-reason.user-excluded { color: #6B7280; background: #F3F4F6; border-color: #E5E7EB; }

      /* ── Settings pane ── */
      .settings-pane { padding: 16px 14px 24px; }
      .settings-section { margin-bottom: 24px; }
      .settings-section:last-child { margin-bottom: 0; }
      .settings-label { font-size: 11px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; }
      .settings-desc { font-size: 12px; color: #6B7280; margin-bottom: 12px; line-height: 1.55; }

      .model-toggle { display: flex; gap: 8px; }
      .model-option { flex: 1; }
      .model-option input[type=radio] { display: none; }
      .model-option label {
        display: flex; flex-direction: column; align-items: center; gap: 3px;
        padding: 11px 8px; border: 1.5px solid #E5E7EB; border-radius: 10px;
        cursor: pointer; transition: border-color 0.15s, background 0.15s;
        font-size: 12.5px; font-weight: 500; color: #374151; text-align: center;
      }
      .model-option input:checked + label { border-color: #111827; background: #F9F9F8; color: #111827; }
      .model-option label:hover { border-color: #D1D5DB; }
      .model-provider-tag { font-size: 10px; color: #9CA3AF; font-weight: 400; }
      .model-option input:checked + label .model-provider-tag { color: #6B7280; }

      .key-block { margin-bottom: 16px; }
      .key-input-row { display: flex; gap: 6px; margin-bottom: 7px; }
      .key-input {
        flex: 1; padding: 9px 11px; border: 1px solid #E5E7EB; border-radius: 9px;
        font-size: 12.5px; font-family: inherit; color: #111827; background: #fff;
        outline: none; transition: border-color 0.15s; min-width: 0;
      }
      .key-input:focus { border-color: #9CA3AF; }
      .key-input::placeholder { color: #C4C9D4; letter-spacing: 0; }
      .key-vis-btn {
        width: 36px; height: 36px; flex-shrink: 0;
        border: 1px solid #E5E7EB; border-radius: 9px;
        background: #F9F9F8; cursor: pointer; color: #9CA3AF;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.12s, color 0.12s;
      }
      .key-vis-btn:hover { background: #EBEBEA; color: #374151; }
      .key-cta {
        font-size: 11px; color: #6B7280; text-decoration: none;
        display: inline-flex; align-items: center; gap: 2px;
        transition: color 0.12s;
      }
      .key-cta:hover { color: #111827; }

      .privacy-note {
        display: flex; gap: 7px; align-items: flex-start;
        font-size: 11px; color: #9CA3AF; line-height: 1.6;
      }
      .privacy-icon { flex-shrink: 0; margin-top: 1px; color: #9CA3AF; }

      .sender-add-row { display: flex; gap: 6px; margin-bottom: 10px; }
      .sender-input {
        flex: 1; padding: 9px 11px; border: 1px solid #E5E7EB; border-radius: 9px;
        font-size: 12px; font-family: inherit; color: #111827; background: #fff;
        outline: none; transition: border-color 0.15s; min-width: 0;
      }
      .sender-input:focus { border-color: #9CA3AF; }
      .sender-input::placeholder { color: #C4C9D4; }
      .sender-add-btn {
        padding: 9px 13px; border-radius: 9px; border: none; background: #111827;
        font-size: 12px; font-weight: 500; color: #fff; cursor: pointer;
        font-family: inherit; transition: background 0.12s; white-space: nowrap; flex-shrink: 0;
      }
      .sender-add-btn:hover { background: #1F2937; }
      .sender-list { display: flex; flex-direction: column; gap: 5px; }
      .sender-item {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 10px; border-radius: 8px; background: #F9F9F8; border: 1px solid #F0EFEB;
      }
      .sender-name { flex: 1; font-size: 12px; color: #374151; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sender-remove {
        background: none; border: none; cursor: pointer; color: #C4C9D4;
        font-size: 15px; line-height: 1; padding: 0 2px; transition: color 0.12s; flex-shrink: 0;
      }
      .sender-remove:hover { color: #EF4444; }
      .sender-empty { font-size: 11.5px; color: #9CA3AF; padding: 4px 0; }

      .settings-save-btn {
        width: 100%; padding: 11px 0; border-radius: 9px; border: none;
        background: #111827; color: #fff; font-size: 13px; font-weight: 500;
        cursor: pointer; font-family: inherit; transition: background 0.15s; letter-spacing: 0.01em;
      }
      .settings-save-btn:hover:not(:disabled) { background: #1F2937; }
      .settings-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .settings-save-status { text-align: center; font-size: 11.5px; margin-top: 9px; min-height: 17px; }
    `;
    shadow.appendChild(style);

    const panel = document.createElement('div');
    panel.id = 'panel';
    panel.innerHTML = `
      <div class="hdr">
        <div class="brand">
          <div class="brand-icon">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="4" width="14" height="10" rx="1.5" stroke="#fff" stroke-width="1.4"/>
              <path d="M1 7h14" stroke="#fff" stroke-width="1.4"/>
              <path d="M11 10.5h1" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M4 1.5h8" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </div>
          <span class="brand-name">Eclat</span>
        </div>
        <button class="close-btn" id="close-btn">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="tab-bar">
        <button class="tab-btn active" id="tab-scan">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" stroke-width="1.3"/>
            <path d="M9 9l2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          Scan
        </button>
        <button class="tab-btn" id="tab-history">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.3"/>
            <path d="M6.5 4v2.5l1.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          History
        </button>
        <button class="tab-btn" id="tab-settings">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M5.3 1.5h2.4l.35 1.4c.28.1.54.24.78.4l1.35-.45 1.2 2.1-1 .95c.03.17.04.35.04.6s-.01.43-.04.6l1 .95-1.2 2.1-1.35-.45c-.24.16-.5.3-.78.4L7.7 11.5H5.3l-.35-1.4a3.2 3.2 0 01-.78-.4l-1.35.45-1.2-2.1 1-.95A3.5 3.5 0 012.5 6.5c0-.25.01-.43.04-.6l-1-.95 1.2-2.1 1.35.45c.24-.16.5-.3.78-.4L5.3 1.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
            <circle cx="6.5" cy="6.5" r="1.5" stroke="currentColor" stroke-width="1.2"/>
          </svg>
          Settings
        </button>
      </div>

      <div id="scan-pane">
        <div class="controls">
          <div class="date-box" id="date-box">
            <button class="date-pill" id="date-pill"></button>
            <div class="cal-panel" id="cal-panel">
              <div id="cal-inner-wrap"></div>
              <div class="cal-actions">
                <button class="cal-cancel" id="cal-cancel">Cancel</button>
                <button class="cal-confirm" id="cal-confirm">Confirm</button>
              </div>
            </div>
          </div>
        </div>

        <div class="results" id="results">
          <div class="state-idle">
            <div class="state-idle-icon">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="4" y="9" width="32" height="24" rx="3" stroke="#E5E7EB" stroke-width="1.5"/>
                <path d="M4 15h32" stroke="#E5E7EB" stroke-width="1.5"/>
                <path d="M28 22.5h3" stroke="#D1D5DB" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M10 4h20" stroke="#E5E7EB" stroke-width="1.5" stroke-linecap="round"/>
                <circle cx="18" cy="26" r="5" stroke="#9CA3AF" stroke-width="1.3"/>
                <path d="M18 24v2.5l1.5 1.5" stroke="#9CA3AF" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="state-idle-title">Ready to scan</div>
            <div class="state-idle-sub">Pick a date range and scan your<br>inbox for financial signals</div>
          </div>
        </div>
        <div class="scan-footer">
          <button class="scan-btn" id="scan-btn">Scan inbox</button>
        </div>
      </div>

      <div id="history-pane" style="display:none"></div>
      <div id="settings-pane" style="display:none"></div>
    `;
    shadow.appendChild(panel);

    updatePill();

    shadow.getElementById('date-pill').addEventListener('click', e => {
      e.stopPropagation();
      calOpen ? closeCal() : openCal();
    });

    shadow.getElementById('scan-btn').addEventListener('click', doScan);
    shadow.getElementById('close-btn').addEventListener('click', closePanel);
    shadow.getElementById('cal-cancel').addEventListener('click', e => { e.stopPropagation(); closeCal(); updatePill(); });
    shadow.getElementById('cal-confirm').addEventListener('click', e => { e.stopPropagation(); closeCal(); });
    shadow.getElementById('tab-scan').addEventListener('click', () => switchTab('scan'));
    shadow.getElementById('tab-history').addEventListener('click', () => switchTab('history'));
    shadow.getElementById('tab-settings').addEventListener('click', () => switchTab('settings'));
  }

  // ── Scan ──────────────────────────────────────────────────────────────────
  function setScanBtnLoading(on) {
    scanning = on;
    const btn = shadow.getElementById('scan-btn');
    if (!btn) return;
    btn.disabled = on;
    btn.innerHTML = on
      ? '<div class="spinner"></div> Scanning\u2026'
      : 'Scan inbox';
  }

  function renderProgress({ stage, emailCount = 0, eligible = 0, screenedOut = 0, hitCap = false, emailsDone = 0, emailsTotal = 0, classifiedSoFar = 0 }) {
    const results = shadow && shadow.getElementById('results');
    if (!results || !scanning) return;

    let label, barMode = 'none', pct = 0; // barMode: 'none' | 'indeterminate' | 'percent'
    if (stage === 'fetched') {
      label   = `Found ${hitCap ? '100+' : emailCount} email${emailCount !== 1 ? 's' : ''} \u00b7 Screening senders\u2026`;
      barMode = 'indeterminate';
    } else if (stage === 'screened') {
      label   = `Classifying ${eligible} email${eligible !== 1 ? 's' : ''}\u2026`;
      barMode = 'indeterminate';
    } else {
      pct     = emailsTotal > 0 ? Math.round((emailsDone / emailsTotal) * 100) : 0;
      label   = `Classifying\u2026 ${emailsDone} / ${emailsTotal} emails`;
      if (classifiedSoFar > 0) label += ` \u00b7 ${classifiedSoFar} signal${classifiedSoFar !== 1 ? 's' : ''} found`;
      barMode = emailsTotal > 0 ? 'percent' : 'indeterminate';
    }

    const barHTML = barMode === 'none' ? '' :
      barMode === 'indeterminate'
        ? `<div class="progress-track"><div class="progress-fill indeterminate"></div></div>`
        : `<div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>`;

    results.innerHTML = `
      <div class="progress-wrap">
        <div class="progress-label">
          <span><span class="progress-dot"></span>${label}</span>
          <span style="font-weight:500;font-variant-numeric:tabular-nums">${barMode === 'percent' ? pct + '%' : ''}</span>
        </div>
        ${barHTML}
      </div>`;
  }

  function renderResults(data) {
    const results = shadow.getElementById('results');
    const dr = (startDate && endDate) ? fmtDate(startDate) + '\u2013' + fmtDate(endDate) : '';
    results.innerHTML = buildResultsHTML(data, dr);
    const toggle = shadow.getElementById('screened-toggle');
    const list   = shadow.getElementById('screened-list');
    if (toggle && list) {
      toggle.addEventListener('click', () => {
        const open = list.style.display !== 'none';
        list.style.display = open ? 'none' : 'flex';
        toggle.querySelector('.screened-chevron').classList.toggle('open', !open);
      });
    }
  }

  // ── History ───────────────────────────────────────────────────────────────
  function switchTab(tab) {
    activeTab = tab;
    shadow.getElementById('scan-pane').style.display     = tab === 'scan'     ? '' : 'none';
    shadow.getElementById('history-pane').style.display  = tab === 'history'  ? '' : 'none';
    shadow.getElementById('settings-pane').style.display = tab === 'settings' ? '' : 'none';
    ['scan', 'history', 'settings'].forEach(t => {
      shadow.getElementById(`tab-${t}`).classList.toggle('active', t === tab);
    });
    if (tab === 'history') renderHistoryList();
    if (tab === 'settings') renderSettingsPane();
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  async function renderSettingsPane() {
    const pane = shadow.getElementById('settings-pane');
    pane.innerHTML = `<div class="settings-pane"><div class="scan-meta" style="margin-bottom:0">Loading\u2026</div></div>`;
    try {
      const res = await fetch('http://localhost:3001/api/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      const settings = await res.json();
      buildSettingsUI(pane, settings);
    } catch (e) {
      pane.innerHTML = `<div class="settings-pane"><div class="state-error">&#9888; ${e.message}</div></div>`;
    }
  }

  function buildSettingsUI(pane, settings) {
    const {
      excluded_senders = [],
      preferred_model  = 'gemini',
      gemini_key_set   = false,
      claude_key_set   = false,
    } = settings;

    pane.innerHTML = `
      <div class="settings-pane">

        <div class="settings-section" style="margin-bottom:12px">
          <div class="settings-label">AI Model</div>
          <div class="model-toggle">
            <div class="model-option">
              <input type="radio" name="s-model" id="s-model-gemini" value="gemini" ${preferred_model !== 'claude' ? 'checked' : ''}>
              <label for="s-model-gemini">
                Gemini Flash
              </label>
            </div>
            <div class="model-option">
              <input type="radio" name="s-model" id="s-model-claude" value="claude" ${preferred_model === 'claude' ? 'checked' : ''}>
              <label for="s-model-claude">
                Claude Haiku
              </label>
            </div>
          </div>
        </div>

        <div class="privacy-note" style="margin-bottom:14px">
          <svg class="privacy-icon" width="13" height="14" viewBox="0 0 13 14" fill="none" style="flex-shrink:0;margin-top:1px">
            <path d="M6.5 1.5L1.5 3.5v4C1.5 10.3 3.7 12.7 6.5 13.5c2.8-.8 5-3.2 5-6V3.5L6.5 1.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
          </svg>
          <span>Your API keys are stored only on this device and sent directly to the provider. Eclat never accesses or stores them.</span>
        </div>

        <div class="settings-section key-block" id="s-gemini-block" style="${preferred_model === 'claude' ? 'display:none' : ''}">
          <div class="key-input-row">
            <input type="password" class="key-input" id="s-gemini-key"
              placeholder="${gemini_key_set ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022  (saved \u2014 enter to replace)' : 'Paste your Gemini API key'}">
            <button class="key-vis-btn" id="s-gemini-vis" title="Show / hide key" aria-label="Toggle visibility">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.3"/></svg>
            </button>
          </div>
          <a href="https://aistudio.google.com/app/apikey" target="_blank" class="key-cta">
            Get key at aistudio.google.com &#8594;
          </a>
        </div>

        <div class="settings-section key-block" id="s-claude-block" style="${preferred_model !== 'claude' ? 'display:none' : ''}">
          <div class="key-input-row">
            <input type="password" class="key-input" id="s-claude-key"
              placeholder="${claude_key_set ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022  (saved \u2014 enter to replace)' : 'Paste your Claude API key'}">
            <button class="key-vis-btn" id="s-claude-vis" title="Show / hide key" aria-label="Toggle visibility">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.3"/></svg>
            </button>
          </div>
          <a href="https://console.anthropic.com/settings/keys" target="_blank" class="key-cta">
            Get key at console.anthropic.com &#8594;
          </a>
        </div>

        <div style="border-top:1px solid #F0EFEB;margin:20px 0"></div>

        <div class="settings-section">
          <div class="settings-label">Excluded Senders</div>
          <div class="settings-desc">Emails from these senders are skipped before the processing.</div>
          <div class="sender-add-row">
            <input type="text" class="sender-input" id="s-sender-input" placeholder="e.g. noreply@github.com">
            <button class="sender-add-btn" id="s-sender-add">Add</button>
          </div>
          <div class="sender-list" id="s-sender-list">
            ${excluded_senders.length === 0
              ? `<div class="sender-empty">No senders excluded yet.</div>`
              : excluded_senders.map(s => `
                  <div class="sender-item" data-sender="${s}">
                    <span class="sender-name">${s}</span>
                    <button class="sender-remove">&#215;</button>
                  </div>`).join('')}
          </div>
        </div>

        <button class="settings-save-btn" id="s-save-btn">Save changes</button>
        <div class="settings-save-status" id="s-save-status"></div>
      </div>
    `;

    // Model toggle → show/hide key blocks
    pane.querySelectorAll('input[name="s-model"]').forEach(radio => {
      radio.addEventListener('change', () => {
        shadow.getElementById('s-gemini-block').style.display = radio.value === 'gemini' ? '' : 'none';
        shadow.getElementById('s-claude-block').style.display  = radio.value === 'claude'  ? '' : 'none';
      });
    });

    // Key visibility toggles
    const EYE_OPEN   = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.3"/></svg>`;
    const EYE_CLOSED = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M6.5 6.6A2.2 2.2 0 009.8 9.9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M3.5 4.3C2.1 5.3 1 8 1 8s2.5 5 7 5c1.5 0 2.8-.5 3.9-1.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.2 3.1C6.8 3 7.4 3 8 3c4.5 0 7 5 7 5s-.8 1.5-2.2 2.7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    [['s-gemini-key', 's-gemini-vis'], ['s-claude-key', 's-claude-vis']].forEach(([inputId, btnId]) => {
      const input = shadow.getElementById(inputId);
      const btn   = shadow.getElementById(btnId);
      if (!input || !btn) return;
      btn.addEventListener('click', () => {
        const hidden = input.type === 'password';
        input.type   = hidden ? 'text' : 'password';
        btn.innerHTML = hidden ? EYE_CLOSED : EYE_OPEN;
      });
    });

    // Sender add
    const senderInput = shadow.getElementById('s-sender-input');
    const senderList  = shadow.getElementById('s-sender-list');

    function addSender(raw) {
      const val = raw.trim().toLowerCase();
      if (!val) return;
      const existing = [...senderList.querySelectorAll('.sender-item')].map(el => el.dataset.sender);
      if (existing.includes(val)) return;
      const empty = senderList.querySelector('.sender-empty');
      if (empty) empty.remove();
      const item = document.createElement('div');
      item.className = 'sender-item';
      item.dataset.sender = val;
      item.innerHTML = `<span class="sender-name">${val}</span><button class="sender-remove">&#215;</button>`;
      item.querySelector('.sender-remove').addEventListener('click', () => {
        item.remove();
        if (!senderList.querySelector('.sender-item')) {
          senderList.innerHTML = `<div class="sender-empty">No senders excluded yet.</div>`;
        }
      });
      senderList.appendChild(item);
      senderInput.value = '';
    }

    shadow.getElementById('s-sender-add').addEventListener('click', () => addSender(senderInput.value));
    senderInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addSender(senderInput.value); } });

    senderList.querySelectorAll('.sender-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.sender-item').remove();
        if (!senderList.querySelector('.sender-item')) {
          senderList.innerHTML = `<div class="sender-empty">No senders excluded yet.</div>`;
        }
      });
    });

    // Save
    const saveBtn    = shadow.getElementById('s-save-btn');
    const saveStatus = shadow.getElementById('s-save-status');

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving\u2026';
      saveStatus.textContent = '';

      const preferred_model    = shadow.querySelector('input[name="s-model"]:checked')?.value ?? 'gemini';
      const geminiKeyVal       = shadow.getElementById('s-gemini-key')?.value.trim();
      const claudeKeyVal       = shadow.getElementById('s-claude-key')?.value.trim();
      const excluded_senders   = [...senderList.querySelectorAll('.sender-item')].map(el => el.dataset.sender).filter(Boolean);

      const payload = { excluded_senders, preferred_model };
      if (geminiKeyVal) payload.gemini_api_key = geminiKeyVal;
      if (claudeKeyVal) payload.claude_api_key = claudeKeyVal;

      try {
        const res = await fetch('http://localhost:3001/api/settings', {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Save failed');
        saveStatus.textContent = '\u2713 Saved';
        saveStatus.style.color = '#16A34A';
        // Refresh so placeholders update to reflect new key-set state
        const updated = await res.json();
        shadow.getElementById('s-gemini-key').placeholder = updated.gemini_key_set
          ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022  (saved — enter to replace)' : 'Paste your API key';
        shadow.getElementById('s-gemini-key').value = '';
        shadow.getElementById('s-claude-key').placeholder = updated.claude_key_set
          ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022  (saved — enter to replace)' : 'Paste your API key';
        shadow.getElementById('s-claude-key').value = '';
        setTimeout(() => { saveStatus.textContent = ''; }, 2500);
      } catch (e) {
        saveStatus.textContent = '\u2717 ' + e.message;
        saveStatus.style.color = '#B91C1C';
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save changes';
      }
    });
  }

  function buildMetaHTML(data, dateRangeLabel) {
    const scanResults = data.scan_results || [];
    const classified  = scanResults.filter(e => e.classified);
    const total       = data.total_scanned || scanResults.length;
    if (classified.length === 0) {
      return `Scanned <b>${total}</b> emails`;
    }
    return `<b>${classified.length}</b> signal${classified.length !== 1 ? 's' : ''} from <b>${total}</b> emails`;
  }

  function buildResultsHTML(data, dateRangeLabel, { skipMeta = false } = {}) {
    const scanResults = data.scan_results || [];
    const classified  = scanResults.filter(e => e.classified);
    const total       = data.total_scanned || scanResults.length;
    const ORDER = ['Merchant Promotions', 'Financial Rewards & Perks', 'Subscription & Status Management'];
    const ALIAS = { 'Credit Card Rewards': 'Financial Rewards & Perks', 'Subscription Management': 'Subscription & Status Management' };
    const groups = {};
    for (const email of classified) {
      const cat = ALIAS[email.emergent_category] || email.emergent_category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(email);
    }
    let html = '';
    if (classified.length === 0) {
      if (!skipMeta) html += `<div class="scan-meta">${buildMetaHTML(data, dateRangeLabel)}</div>`;
      html += `<div class="no-signals">No financial signals found</div>`;
    } else {
      if (!skipMeta) html += `<div class="scan-meta">${buildMetaHTML(data, dateRangeLabel)}</div>`;
      for (const catKey of ORDER) {
        const emails = groups[catKey];
        if (!emails || emails.length === 0) continue;
        const catInfo   = CATEGORIES.find(c => c.key === catKey);
        const label     = catInfo ? catInfo.label.toUpperCase() : catKey.toUpperCase();
        const dot       = catInfo ? catInfo.dot : '#9CA3AF';
        const chipClass = catInfo ? catInfo.chipClass : '';
        const chipLabel = catInfo ? catInfo.label : catKey;
        html += `<div class="cat-section">
          <div class="cat-header">
            <span class="cat-dot" style="background:${dot}"></span>
            <span class="cat-name">${label}</span>
            <span class="cat-count">${emails.length}</span>
          </div>`;
        for (const e of emails) {
          const perk   = e.perk_value || e.financial_signal || '\u2014';
          const sender = fmtSender(e.sender);
          const date   = fmtDate(e.date);
          const due    = e.deadline ? ` \u00b7 <span class="email-due">Due ${fmtDate(e.deadline)}</span>` : '';
          const url    = gmailUrl(e.threadId);
          html += `<div class="email-card">
            <div class="email-info">
              <div class="email-chip ${chipClass}"><span class="email-chip-dot"></span>${chipLabel}</div>
              <div class="email-perk">${perk}</div>
              <div class="email-meta"><b>${sender}</b> \u00b7 ${date}${due}</div>
            </div>
            <a class="open-link" href="${url}" target="_blank" rel="noopener noreferrer">&#8599;</a>
          </div>`;
        }
        html += `</div>`;
      }
    }
    if (data.batch_errors > 0) {
      html += `<div class="state-model-warn">&#9888; The AI model had trouble processing ${data.batch_errors} emails \u2014 results may be incomplete.</div>`;
    }

    const screenedOut = data.screened_out || [];
    if (screenedOut.length > 0) {
      html += `
        <button class="screened-toggle" id="screened-toggle">
          <span class="screened-label">Screened out</span>
          <span class="screened-count">${screenedOut.length}</span>
          <svg class="screened-chevron" width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2 4.5l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="screened-list" id="screened-list" style="display:none">
          ${screenedOut.map(e => `
            <div class="screened-row">
              <div class="screened-info">
                <div class="screened-subject">${e.subject || '(no subject)'}</div>
                <div class="screened-sender">${fmtSender(e.sender)}</div>
              </div>
              <span class="screened-reason${e.user_excluded ? ' user-excluded' : ''}">
                ${e.user_excluded ? 'User excluded' : (e.screen_reason || 'Screened')}
              </span>
            </div>`).join('')}
        </div>`;
    }

    return html;
  }

  async function renderHistoryList() {
    const pane = shadow.getElementById('history-pane');
    pane.innerHTML = `<div class="history-view"><div class="scan-meta" style="margin-bottom:0">Loading\u2026</div></div>`;
    try {
      const res = await fetch('http://localhost:3001/api/history');
      if (!res.ok) throw new Error('Failed to load history');
      const history = await res.json();

      if (history.length === 0) {
        pane.innerHTML = `<div class="history-view"><div class="history-empty">No scans yet.<br>Run your first scan to see results here.</div></div>`;
        return;
      }

      let html = '<div class="history-view">';
      for (const entry of history) {
        const dr      = fmtHistRange(entry.date_range);
        const ts      = fmtTs(entry.timestamp);
        const signals = entry.total_flagged ?? 0;
        const total   = entry.total_scanned ?? 0;
        const warn    = entry.batch_errors > 0 ? ' \u26A0' : '';
        html += `<div class="hist-item" data-ts="${entry.timestamp}">
          <div class="hist-item-main">
            <div class="hist-dr">${dr}</div>
            <div class="hist-meta">${total} scanned \u00b7 ${ts}${warn}</div>
          </div>
          <div class="hist-badge">${signals} signal${signals !== 1 ? 's' : ''}</div>
          <svg class="hist-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4.5 2.5L8.5 6L4.5 9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>`;
      }
      html += '</div>';
      pane.innerHTML = html;

      pane.querySelectorAll('.hist-item').forEach(el => {
        el.addEventListener('click', () => loadHistoryDetail(el.dataset.ts));
      });
    } catch (e) {
      pane.innerHTML = `<div class="history-view"><div class="state-error">&#9888; ${e.message}</div></div>`;
    }
  }

  async function loadHistoryDetail(timestamp) {
    const pane = shadow.getElementById('history-pane');
    pane.innerHTML = `<div class="history-view"><div class="scan-meta" style="margin-bottom:0">Loading\u2026</div></div>`;
    try {
      const res = await fetch(`http://localhost:3001/api/history/${encodeURIComponent(timestamp)}`);
      if (!res.ok) throw new Error('Scan not found');
      const entry = await res.json();
      const dr = fmtHistRange(entry.date_range);

      let html = `<div class="history-view">
        <button class="hist-back" id="hist-back" style="margin-bottom:20px">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4.5 7L9 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          All scans
        </button>`;
      html += buildResultsHTML(entry, dr, { skipMeta: true });
      html += '</div>';
      pane.innerHTML = html;
      pane.querySelector('#hist-back').addEventListener('click', () => renderHistoryList());
      const toggle = pane.querySelector('#screened-toggle');
      const list   = pane.querySelector('#screened-list');
      if (toggle && list) {
        toggle.addEventListener('click', () => {
          const open = list.style.display !== 'none';
          list.style.display = open ? 'none' : 'flex';
          toggle.querySelector('.screened-chevron').classList.toggle('open', !open);
        });
      }
    } catch (e) {
      pane.innerHTML = `<div class="history-view">
        <button class="hist-back" id="hist-back">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4.5 7L9 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          All scans
        </button>
        <div class="state-error">&#9888; ${e.message}</div>
      </div>`;
      pane.querySelector('#hist-back').addEventListener('click', () => renderHistoryList());
    }
  }

  async function doScan() {
    if (scanning) return;
    setScanBtnLoading(true);
    renderProgress({ stage: 'batch', done: 0, total: 0 });

    try {
      const data = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'SCAN', startDate, endDate }, result => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (result && result.error) return reject(new Error(result.error));
          resolve(result);
        });
      });
      renderResults(data);
    } catch (e) {
      shadow.getElementById('results').innerHTML =
        `<div class="state-error">&#9888; Scan failed \u2014 ${e.message}</div>`;
    } finally {
      setScanBtnLoading(false);
    }
  }

  // ── Trigger injection ─────────────────────────────────────────────────────
  function injectTrigger() {
    if (document.getElementById('eclat-trigger')) return;
    const anchor = document.querySelector('[data-tooltip="Settings"], [aria-label*="Settings"], [gh="sm"]');
    if (!anchor) return;

    triggerBtn = document.createElement('div');
    triggerBtn.id = 'eclat-trigger';
    triggerBtn.title = 'Eclat';
    triggerBtn.style.cssText =
      'display:inline-flex;align-items:center;justify-content:center;' +
      'width:40px;height:40px;border-radius:50%;cursor:pointer;transition:background 0.1s;';
    triggerBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="5.5" width="16" height="11" rx="2" stroke="#444746" stroke-width="1.5"/>
        <path d="M2 8.5h16" stroke="#444746" stroke-width="1.5"/>
        <path d="M13.5 12.5H15" stroke="#444746" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M5.5 2.5h9" stroke="#444746" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`;
    triggerBtn.addEventListener('mouseenter', () => triggerBtn.style.background = '#f1f3f4');
    triggerBtn.addEventListener('mouseleave', () => triggerBtn.style.background = '');
    triggerBtn.addEventListener('click', e => { e.stopPropagation(); togglePanel(); });
    anchor.parentNode.insertBefore(triggerBtn, anchor);
  }

  // ── Panel open/close ──────────────────────────────────────────────────────
  function openPanel() {
    panelOpen = true;
    shadow.getElementById('panel').classList.add('open');
    setTimeout(() => document.addEventListener('click', onClickAway), 50);
  }
  function closePanel() {
    panelOpen = false;
    shadow.getElementById('panel').classList.remove('open');
    document.removeEventListener('click', onClickAway);
  }
  function togglePanel() { panelOpen ? closePanel() : openPanel(); }
  function onClickAway(e) {
    if (!widgetRoot.contains(e.target) && e.target !== triggerBtn && !triggerBtn.contains(e.target))
      closePanel();
  }

  // ── MutationObserver — re-inject if Gmail re-renders ─────────────────────
  const observer = new MutationObserver(debounce(injectTrigger, 600));

  // ── Progress relay from background ───────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'SCAN_PROGRESS') {
      renderProgress(msg);
    }
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    buildWidget();
    injectTrigger();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
