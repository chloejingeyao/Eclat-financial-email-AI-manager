import { useState as _useState, useRef as _useRef, useEffect as _useEffect } from 'react'

// ── icons ──────────────────────────────────────────────────────────────────

const WalletIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="4" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M1 7h14" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M11 10.5h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M4 1.5L12 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
)

const AllIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M1.5 4h12M1.5 7.5h12M1.5 11h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
)

const ScanResultsIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <rect x="1.5" y="1.5" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M4.5 5h6M4.5 7.5h6M4.5 10h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
)

const HealthIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M1.5 7.5h2.5l2-4 2.5 8 2-4H13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// ── category dot colors ────────────────────────────────────────────────────

const CATEGORY_DOT = {
  'Merchant Promotions':              '#F59E0B',
  'Financial Rewards & Perks':        '#8B5CF6',
  'Subscription & Status Management': '#EF4444',
}

// ── NavItem ────────────────────────────────────────────────────────────────

function NavItem({ icon, label, count, isActive, onClick, dot }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', width: '100%', gap: 9,
        padding: '6px 10px', borderRadius: 7, border: 'none',
        background: isActive ? '#F5F4F1' : 'transparent',
        color: isActive ? '#111827' : '#6B7280',
        cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.12s, color 0.12s, box-shadow 0.12s',
        fontFamily: 'inherit',
        boxShadow: isActive ? 'inset 2px 0 0 #111827' : 'none',
        position: 'relative',
      }}
      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = '#F5F4F1'; e.currentTarget.style.color = '#374151' }}}
      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B7280' }}}
    >
      {dot ? (
        <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: isActive ? dot : '#D1D5DB', transition: 'background 0.12s' }} />
      ) : (
        <span style={{ flexShrink: 0, lineHeight: 0 }}>{icon}</span>
      )}
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: isActive ? 500 : 400, lineHeight: 1 }}>
        {label}
      </span>
      {count != null && count > 0 && (
        <span style={{
          fontSize: 11, fontWeight: 600, minWidth: 18, textAlign: 'center',
          padding: '1px 5px', borderRadius: 10,
          background: isActive ? '#111827' : '#EBEBEA',
          color: isActive ? '#fff' : '#9CA3AF',
          flexShrink: 0,
          transition: 'background 0.12s, color 0.12s',
        }}>
          {count}
        </span>
      )}
    </button>
  )
}

function Divider() {
  return <div style={{ height: 1, background: '#F3F4F6', margin: '8px 4px' }} />
}


// ── DateRangePicker ────────────────────────────────────────────────────────

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES   = ['Su','Mo','Tu','We','Th','Fr','Sa']

function fmtPill(str) {
  if (!str) return '—'
  const d = new Date(str + 'T12:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function addMonths(year, month, delta) {
  let m = month + delta
  let y = year
  while (m > 11) { m -= 12; y++ }
  while (m < 0)  { m += 12; y-- }
  return { year: y, month: m }
}

function buildDays(year, month) {
  const first = new Date(year, month, 1).getDay()
  const total = new Date(year, month + 1, 0).getDate()
  return { first, total }
}

function toISO(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function MonthGrid({ year, month, start, end, hovered, onDay, onHover }) {
  const { first, total } = buildDays(year, month)
  const cells = []
  for (let i = 0; i < first; i++) cells.push(null)
  for (let d = 1; d <= total; d++) cells.push(d)

  function dayISO(d) { return toISO(year, month, d) }

  function isStart(d)   { return start && dayISO(d) === start }
  function isEnd(d)     { return end   && dayISO(d) === end   }
  function inRange(d) {
    const lo = start && end ? (start < end ? start : end) : start
    const hi = start && end ? (start < end ? end : start) : null
    if (!lo || !hi) return false
    const iso = dayISO(d)
    return iso > lo && iso < hi
  }
  function inHoverRange(d) {
    if (!start || end) return false
    const lo = start < (hovered || '') ? start : hovered
    const hi = start < (hovered || '') ? hovered : start
    if (!lo || !hi) return false
    const iso = dayISO(d)
    return iso > lo && iso < hi
  }

  const weeks = []
  let row = []
  cells.forEach((d, i) => {
    row.push(d)
    if (row.length === 7) { weeks.push(row); row = [] }
  })
  if (row.length > 0) {
    while (row.length < 7) row.push(null)
    weeks.push(row)
  }

  return (
    <div>
      <div style={{ textAlign: 'center', fontWeight: 600, fontSize: 13.5, marginBottom: 10, color: '#111827' }}>
        {MONTH_NAMES[month]} {year}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 32px)', gap: 0 }}>
        {DAY_NAMES.map(n => (
          <div key={n} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#9CA3AF', padding: '2px 0 6px' }}>{n}</div>
        ))}
        {weeks.map((week, wi) => week.map((d, di) => {
          if (!d) return <div key={`e-${wi}-${di}`} />
          const iso   = dayISO(d)
          const isSt  = isStart(d)
          const isEn  = isEnd(d)
          const inR   = inRange(d)
          const inHov = inHoverRange(d)
          const isEdge = isSt || isEn
          return (
            <div
              key={`d-${wi}-${di}`}
              onClick={() => onDay(iso)}
              onMouseEnter={() => onHover(iso)}
              onMouseLeave={() => onHover(null)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, cursor: 'pointer', position: 'relative',
                background: (isSt || isEn || inR || inHov) ? '#EBEBEA' : 'transparent',
                borderRadius: isSt ? '50% 0 0 50%' : isEn ? '0 50% 50% 0' : 0,
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: isEdge ? '#111827' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{
                  fontSize: 13, fontWeight: isEdge ? 600 : 400,
                  color: isEdge ? '#fff' : '#111827',
                }}>
                  {d}
                </span>
              </div>
            </div>
          )
        }))}
      </div>
    </div>
  )
}

function DateRangePicker({ dateRange, onChange }) {
  const [open,    setOpen]    = _useState(false)
  const [hovered, setHovered] = _useState(null)
  const [picking, setPicking] = _useState(null) // partial: start chosen, waiting for end

  const today  = new Date()
  const [viewYear,  setViewYear]  = _useState(today.getFullYear())
  const [viewMonth, setViewMonth] = _useState(today.getMonth())

  const panelRef = _useRef(null)

  _useEffect(() => {
    if (!open) return
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
        setPicking(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const next = addMonths(viewYear, viewMonth, 1)

  function handleDay(iso) {
    if (!picking) {
      // First click: set start, clear end
      setPicking(iso)
      onChange({ start: iso, end: iso })
    } else {
      // Second click: set end (or swap if needed), close
      const lo = picking < iso ? picking : iso
      const hi = picking < iso ? iso : picking
      onChange({ start: lo, end: hi })
      setPicking(null)
      setOpen(false)
    }
  }

  function navPrev() {
    const p = addMonths(viewYear, viewMonth, -1)
    const minYear = today.getFullYear() - 1
    if (p.year < minYear || (p.year === minYear && p.month < today.getMonth())) return
    setViewYear(p.year); setViewMonth(p.month)
  }
  function navNext() {
    const n = addMonths(viewYear, viewMonth, 1)
    setViewYear(n.year); setViewMonth(n.month)
  }

  const pillStart = dateRange.start ? fmtPill(dateRange.start) : '—'
  const pillEnd   = dateRange.end   ? fmtPill(dateRange.end)   : '—'

  const inputStyle = {
    padding: '5px 8px', borderRadius: 6,
    border: '1px solid #E5E7EB', background: '#F9FAFB',
    fontSize: 12, color: '#374151', fontFamily: 'inherit',
    outline: 'none', flex: 1,
  }

  return (
    <div style={{ padding: '10px 10px 6px', borderTop: '1px solid #F3F4F6', position: 'relative' }}>
      <p style={{ fontSize: 10.5, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
      
      </p>
      {/* Pill button */}
      <button
        onClick={() => { setOpen(o => !o); setPicking(null) }}
        style={{
          width: '100%', padding: '7px 10px', borderRadius: 8,
          border: '1px solid #E5E7EB', background: open ? '#F9FAFB' : '#fff',
          fontSize: 12.5, fontWeight: 500, color: '#374151',
          cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit',
          transition: 'border-color 0.1s, background 0.1s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#9CA3AF' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
      >
        {pillStart} to {pillEnd}
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed', left: 260, bottom: 16,
            background: '#fff', borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)',
            minWidth: 540, zIndex: 9999, padding: 20,
          }}
        >
          {/* Date display */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>From</p>
              <div style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #E8E7E3', background: '#FAFAF9', fontSize: 13, color: '#374151', fontWeight: 500 }}>
                {fmtPill(dateRange.start)}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>To</p>
              <div style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #E8E7E3', background: '#FAFAF9', fontSize: 13, color: '#374151', fontWeight: 500 }}>
                {fmtPill(dateRange.end)}
              </div>
            </div>
          </div>

          {/* Month navigation header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button onClick={navPrev} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, color: '#6B7280', fontSize: 16, lineHeight: 1 }}>‹</button>
            <div style={{ flex: 1 }} />
            <button onClick={navNext} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, color: '#6B7280', fontSize: 16, lineHeight: 1 }}>›</button>
          </div>

          {/* Two months side by side */}
          <div style={{ display: 'flex', gap: 32 }}>
            <MonthGrid
              year={viewYear} month={viewMonth}
              start={picking || dateRange.start} end={picking ? null : dateRange.end}
              hovered={hovered}
              onDay={handleDay}
              onHover={setHovered}
            />
            <MonthGrid
              year={next.year} month={next.month}
              start={picking || dateRange.start} end={picking ? null : dateRange.end}
              hovered={hovered}
              onDay={handleDay}
              onHover={setHovered}
            />
          </div>

          {/* Done button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button
              onClick={() => { setOpen(false); setPicking(null) }}
              style={{
                padding: '7px 18px', borderRadius: 8, border: 'none',
                background: '#111827', color: '#fff',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────

export default function Sidebar({ active, onChange, counts, scanning, onScan, meta, goldCount, dateRange, onDateRangeChange }) {
  const total    = Object.values(counts).reduce((a, b) => a + b, 0)
  const scannedAt = meta?.scanned_at
    ? new Date(meta.scanned_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <aside style={{
      width: 252, height: '100vh', background: '#FAFAF9',
      borderRight: '1px solid #E8E7E3',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      position: 'sticky', top: 0, zIndex: 10,
    }}>

      {/* Brand */}
      <div style={{ padding: '18px 14px 14px', borderBottom: '1px solid #E8E7E3' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7, background: '#111827',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            color: '#fff',
          }}>
            <WalletIcon />
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#111827', letterSpacing: '-0.02em' }}>
            Eclat
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 6px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, background: '#FAFAF9' }}>

        <p style={{ padding: '4px 10px 6px', fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        </p>
        <NavItem icon={<AllIcon />} label="All Emails" count={total} isActive={active === 'all'} onClick={() => onChange('all')} />
        <NavItem dot={CATEGORY_DOT['Merchant Promotions']}              label="Merchant Promotions"      count={counts['Merchant Promotions'] ?? 0}              isActive={active === 'Merchant Promotions'}              onClick={() => onChange('Merchant Promotions')} />
        <NavItem dot={CATEGORY_DOT['Financial Rewards & Perks']}        label="Financial Rewards"        count={counts['Financial Rewards & Perks'] ?? 0}        isActive={active === 'Financial Rewards & Perks'}        onClick={() => onChange('Financial Rewards & Perks')} />
        <NavItem dot={CATEGORY_DOT['Subscription & Status Management']} label="Subscription Management"  count={counts['Subscription & Status Management'] ?? 0} isActive={active === 'Subscription & Status Management'} onClick={() => onChange('Subscription & Status Management')} />

        <Divider />

        <p style={{ padding: '4px 10px 6px', fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Tools
        </p>
        <NavItem
          icon={<ScanResultsIcon />}
          label="Scan Results"
          isActive={active === 'scan-results'}
          onClick={() => onChange('scan-results')}
        />
        <NavItem
          icon={<HealthIcon />}
          label="Reported Cases"
          isActive={active === 'system-health'}
          onClick={() => onChange('system-health')}
        />

      </nav>

      {/* Date range picker */}
      <DateRangePicker dateRange={dateRange} onChange={onDateRangeChange} />

      {/* Scan button + meta */}
      <div style={{ padding: '8px 10px 18px' }}>
        <button
          onClick={onScan}
          disabled={scanning}
          style={{
            width: '100%', padding: '9px 0', borderRadius: 8, border: 'none',
            background: '#111827', color: '#fff',
            fontSize: 13.5, fontWeight: 500, cursor: scanning ? 'not-allowed' : 'pointer',
            opacity: scanning ? 0.55 : 1, transition: 'opacity 0.15s, background 0.1s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => { if (!scanning) e.currentTarget.style.background = '#1F2937' }}
          onMouseLeave={e => { if (!scanning) e.currentTarget.style.background = '#111827' }}
        >
          {scanning ? (
            <>
              <span style={{
                width: 12, height: 12, borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                animation: 'spin 0.7s linear infinite', flexShrink: 0,
              }} />
              Scanning…
            </>
          ) : 'Scan inbox'}
        </button>

        {scannedAt && (
          <p style={{ marginTop: 9, fontSize: 11.5, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.55 }}>
            Last Scanned {scannedAt}
          </p>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </aside>
  )
}
