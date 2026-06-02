import { useState, useEffect } from 'react'

const CHIP = {
  'Merchant Promotions':              { label: 'Merchant',     bg: '#FFFBEB', color: '#B45309' },
  'Financial Rewards & Perks':        { label: 'Rewards',      bg: '#F5F3FF', color: '#6D28D9' },
  'Credit Card Rewards':              { label: 'Rewards',      bg: '#F5F3FF', color: '#6D28D9' },
  'Subscription & Status Management': { label: 'Subscription', bg: '#FEF2F2', color: '#B91C1C' },
  'Subscription Management':          { label: 'Subscription', bg: '#FEF2F2', color: '#B91C1C' },
}

function fmt(str) {
  if (!str) return ''
  const d = new Date(str.length === 10 ? str + 'T12:00:00' : str)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTs(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function fmtDate(str) {
  if (!str) return ''
  const d = new Date(str + 'T12:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function parseSender(raw) {
  if (!raw) return ''
  const m = raw.match(/^"?([^"<]+)"?\s*</)
  return m ? m[1].trim() : raw.split('@')[0]
}

function gmailUrl(threadId) {
  return `https://mail.google.com/mail/u/0/#all/${threadId}`
}

// ── Open in Gmail link ────────────────────────────────────────────────────

function GmailLink({ threadId }) {
  return (
    <a
      href={gmailUrl(threadId)}
      target="_blank"
      rel="noopener noreferrer"
      style={{ fontSize: 12, color: '#6B7280', textDecoration: 'none', flexShrink: 0, transition: 'color 0.1s' }}
      onMouseEnter={e => e.currentTarget.style.color = '#111827'}
      onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}
    >
      Open ↗
    </a>
  )
}

// ── Scan selector dropdown ────────────────────────────────────────────────

function fmtDateRange(dr) {
  if (!dr || !dr.start || !dr.end) return null
  const s = new Date(dr.start + 'T12:00:00')
  const e = new Date(dr.end   + 'T12:00:00')
  const sMonth = s.toLocaleDateString(undefined, { month: 'short' })
  const eMonth = e.toLocaleDateString(undefined, { month: 'short' })
  const sDay = s.getDate()
  const eDay = e.getDate()
  if (sMonth === eMonth) return `${sMonth} ${sDay}–${eDay}`
  return `${sMonth} ${sDay}–${eMonth} ${eDay}`
}

function ScanSelector({ scanHistory, selectedTs, latestTs, onChange }) {
  if (!scanHistory || scanHistory.length <= 1) return null

  return (
    <div style={{ position: 'relative' }}>
      <select
        value={selectedTs ?? latestTs ?? ''}
        onChange={e => onChange(e.target.value === latestTs ? null : e.target.value)}
        style={{
          appearance: 'none', WebkitAppearance: 'none',
          padding: '6px 32px 6px 12px', borderRadius: 8,
          border: '1px solid #E5E7EB', background: '#fff',
          fontSize: 13, fontWeight: 500, color: '#111827',
          cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
          transition: 'border-color 0.1s',
        }}
        onFocus={e => e.currentTarget.style.borderColor = '#9CA3AF'}
        onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}
      >
        {scanHistory.map((s, i) => {
          const dr      = fmtDateRange(s.date_range)
          const dateStr = dr ? `From ${dr}` : 'All emails'
          const scanStr = `Scanned on ${fmtTs(s.timestamp)}`
          const errFlag = s.batch_errors > 0 ? ' ⚠' : ''
          const label   = `${dateStr} · ${scanStr} (${s.total_flagged}/${s.total_scanned})${errFlag}`
          return (
            <option key={s.timestamp} value={s.timestamp}>
              {label}
            </option>
          )
        })}
      </select>
      {/* Chevron icon */}
      <svg
        width="12" height="12" viewBox="0 0 12 12" fill="none"
        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
      >
        <path d="M2.5 4.5L6 8L9.5 4.5" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

// ── Filter tabs ───────────────────────────────────────────────────────────

function UnavailableInfo({ reason }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginTop: 5 }}>
      <button
        onClick={e => { e.stopPropagation(); e.preventDefault(); setOpen(o => !o) }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', padding: 0,
          cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 11, color: '#9CA3AF',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="5" stroke="#D1D5DB" strokeWidth="1.2"/>
          <path d="M6 5.5v2.5M6 3.8v.5" stroke="#9CA3AF" strokeWidth="1.1" strokeLinecap="round"/>
        </svg>
        Content unavailable
        <svg
          width="8" height="8" viewBox="0 0 8 8" fill="none"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
        >
          <path d="M1.5 3L4 5.5L6.5 3" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && reason && (
        <p style={{ margin: '3px 0 0 16px', fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>
          {reason}
        </p>
      )}
    </div>
  )
}

function FilterTabs({ active, onChange, counts }) {
  const tabs = [
    { key: 'all',          label: 'All',            count: counts.all },
    { key: 'classified',   label: 'Classified',     count: counts.classified },
    { key: 'unclassified', label: 'Not classified', count: counts.unclassified },
    { key: 'unavailable',  label: 'Unavailable',    count: counts.unavailable },
    { key: 'screened',     label: 'Screened out',   count: counts.screened },
  ].filter(t => (t.key !== 'unavailable' || counts.unavailable > 0) && (t.key !== 'screened' || counts.screened > 0))

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      background: '#EBEBEA', borderRadius: 9, padding: 3,
    }}>
      {tabs.map(tab => {
        const isActive = active === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 13px', borderRadius: 7, border: 'none',
              background: isActive ? '#fff' : 'transparent',
              color: isActive ? '#111827' : '#6B7280',
              fontSize: 13, fontWeight: isActive ? 500 : 400,
              cursor: 'pointer',
              boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'background 0.12s, color 0.12s, box-shadow 0.12s',
            }}
          >
            {tab.label}
            <span style={{
              fontSize: 11, fontWeight: 600,
              padding: '1px 6px', borderRadius: 10,
              background: isActive ? '#F3F4F6' : 'transparent',
              color: isActive ? '#374151' : '#9CA3AF',
            }}>
              {tab.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Classified row ────────────────────────────────────────────────────────

function ClassifiedRow({ email }) {
  const chip = CHIP[email.emergent_category]
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14,
      padding: '14px 16px', background: '#fff',
      border: '1px solid #E8E7E3', borderRadius: 10,
      transition: 'border-color 0.15s',
    }}>
      {/* green check */}
      <div style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
        background: '#ECFDF5', border: '1px solid #A7F3D0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5l2.5 2.5L8 3" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          {chip && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: chip.bg, color: chip.color }}>
              {chip.label}
            </span>
          )}
          <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{email.perk_value || email.financial_signal}</span>
        </div>
        <p style={{ fontSize: 12.5, color: '#6B7280' }}>
          <span style={{ fontWeight: 500, color: '#374151' }}>{parseSender(email.sender)}</span>
          <span style={{ margin: '0 6px', color: '#D1D5DB' }}>·</span>
          {fmt(email.date)}
          {email.deadline && (
            <>
              <span style={{ margin: '0 6px', color: '#D1D5DB' }}>·</span>
              <span>Due {fmt(email.deadline)}</span>
            </>
          )}
        </p>
        {email.is_unavailable_content && <UnavailableInfo reason={email.unavailable_reason} />}
      </div>

      <GmailLink threadId={email.threadId} />
    </div>
  )
}

// ── Not-classified row ────────────────────────────────────────────────────

function UnclassifiedRow({ email, selected, onToggle }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 16px',
      background: selected ? '#F5F4F1' : '#fff',
      border: `1px solid ${selected ? '#C9C8C4' : '#E8E7E3'}`,
      borderRadius: 10, cursor: 'pointer',
      transition: 'background 0.1s, border-color 0.1s',
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 2,
        border: `1.5px solid ${selected ? '#111827' : '#D1D5DB'}`,
        background: selected ? '#111827' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.1s, border-color 0.1s',
      }}>
        {selected && (
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M1.5 4.5l2 2L7 2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <input type="checkbox" checked={selected} onChange={onToggle} style={{ display: 'none' }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 13.5, fontWeight: 500, color: '#374151', margin: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>
            {email.subject || '(no subject)'}
          </p>
        </div>
        <p style={{ fontSize: 12, color: '#9CA3AF' }}>
          {parseSender(email.sender)}
          <span style={{ margin: '0 6px', color: '#E5E7EB' }}>·</span>
          {fmt(email.date)}
        </p>
        {email.is_unavailable_content && <UnavailableInfo reason={email.unavailable_reason} />}
      </div>

      <span onClick={e => e.preventDefault()}>
        <GmailLink threadId={email.threadId} />
      </span>
    </label>
  )
}

// ── Section header ────────────────────────────────────────────────────────

function SectionHeader({ label, count, badge }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </span>
      <span style={{
        fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 20,
        background: badge === 'green' ? '#ECFDF5' : '#F3F4F6',
        color: badge === 'green' ? '#059669' : '#6B7280',
      }}>
        {count}
      </span>
      <div style={{ flex: 1, height: 1, background: '#F3F4F6' }} />
    </div>
  )
}

// ── Scan progress bar ─────────────────────────────────────────────────────

function ScanProgressBar({ progress, hitCap }) {
  const stage = progress?.stage ?? 'batch'
  const pct   = (progress?.total > 0) ? Math.round((progress.done / progress.total) * 100) : 0

  let label, showPct
  if (stage === 'fetched') {
    label   = hitCap ? 'Found 100+ emails · Screening senders…' : `Found ${progress?.emailCount ?? '…'} emails · Screening senders…`
    showPct = false
  } else if (stage === 'screened') {
    label   = `Screened ${progress?.screenedOut ?? 0} · Analyzing ${progress?.eligible ?? 0} emails…`
    showPct = false
  } else {
    label   = 'Analyzing emails…'
    showPct = true
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#6B7280' }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: '#111827', flexShrink: 0,
            animation: 'pulse 1.4s ease-in-out infinite',
          }} />
          {label}
        </span>
        {showPct && <span style={{ fontSize: 12, color: '#9CA3AF', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>}
      </div>
      {hitCap && (
        <p style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 8 }}>
          Your inbox has more than 100 emails in this range — only the first 100 are being scanned.
        </p>
      )}
      <div style={{ height: 3, background: '#EBEBEA', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: 'linear-gradient(90deg, #111827 0%, #4B5563 50%, #111827 100%)',
          backgroundSize: '600px 100%',
          borderRadius: 2,
          transition: 'width 0.5s ease',
          animation: 'shimmer 2s linear infinite',
        }} />
      </div>
      <style>{`@keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
    </div>
  )
}

// ── ScanResults ───────────────────────────────────────────────────────────

export default function ScanResults({
  // Latest scan (always available from App state)
  scanResults, scannedAt, totalScanned, dateRange, screenedOut = [],
  // Model error count for the latest scan
  batchErrors = 0,
  // History metadata list for the selector
  scanHistory,
  // Callbacks
  onAddToEvaluation,
  scanError,
  // Scanning state
  scanning, scanProgress, hitCap = false,
}) {
  const [selected,    setSelected]    = useState(new Set())
  const [adding,      setAdding]      = useState(false)
  const [added,       setAdded]       = useState(false)
  const [activeTab,   setActiveTab]   = useState('all')

  // Which historical timestamp is selected (null = show latest from props)
  const [selectedTs,  setSelectedTs]  = useState(null)
  const [histData,    setHistData]    = useState(null)   // loaded historical scan
  const [histLoading, setHistLoading] = useState(false)
  const [histError,   setHistError]   = useState(null)

  // Load a historical scan by timestamp
  async function loadHistoricalScan(ts) {
    if (!ts) { setHistData(null); setSelectedTs(null); return }
    setHistLoading(true); setHistError(null)
    try {
      const r = await fetch(`/api/history/${encodeURIComponent(ts)}`)
      if (!r.ok) throw new Error('Failed to load scan')
      setHistData(await r.json())
      setSelectedTs(ts)
    } catch (e) {
      setHistError(e.message)
    } finally {
      setHistLoading(false)
      setSelected(new Set())
      setActiveTab('all')
    }
  }

  // Resolve which data to display
  const activeResults      = histData ? histData.scan_results    : scanResults
  const activeScannedAt    = histData ? histData.timestamp       : scannedAt
  const activeTotalScanned = histData ? histData.total_scanned   : totalScanned
  const activeDateRange    = histData ? histData.date_range      : dateRange
  const activeScreenedOut  = histData ? (histData.screened_out ?? []) : (screenedOut ?? [])

  // Determine the latest timestamp (first in history list = newest)
  const latestTs = scanHistory?.[0]?.timestamp ?? scannedAt

  const fmtScan = activeScannedAt
    ? new Date(activeScannedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  const isViewingLatest = !selectedTs || selectedTs === latestTs

  // ── Empty state ───────────────────────────────────────────────────────

  if (!activeResults || activeResults.length === 0) {
    return (
      <div>
        {scanError && <ScanErrorBanner message={scanError} />}
        {histError && <ScanErrorBanner message={histError} />}
        {!scanError && batchErrors > 0 && !scanning && (
          <BatchErrorBanner count={batchErrors} total={totalScanned ?? 0} />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 600, color: '#111827', letterSpacing: '-0.025em', flexShrink: 0 }}>
            Scan results
          </h1>
          <ScanSelector scanHistory={scanHistory} selectedTs={selectedTs} latestTs={latestTs} onChange={loadHistoricalScan} />
        </div>
        {scanning && !histData
          ? <ScanProgressBar progress={scanProgress} hitCap={hitCap} />
          : (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
              {histLoading ? 'Loading scan…' : 'No scan results yet. Run a scan to see results here.'}
            </div>
          )
        }
      </div>
    )
  }

  const classified   = activeResults.filter(e =>  e.classified)
  const unclassified = activeResults.filter(e => !e.classified && !e.batch_failed)
  const unavailable  = activeResults.filter(e =>  e.is_unavailable_content && !e.batch_failed)

  const visibleClassified   = (activeTab === 'all' || activeTab === 'classified')   ? classified   : []
  const visibleUnclassified = (activeTab === 'all' || activeTab === 'unclassified') ? unclassified : []
  // 'unavailable' tab shows all unavailable emails split by classified status
  const visibleUnavailClassified   = activeTab === 'unavailable' ? classified.filter(e => e.is_unavailable_content)   : []
  const visibleUnavailUnclassified = activeTab === 'unavailable' ? unclassified.filter(e => e.is_unavailable_content) : []

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // The unclassified rows currently in view (includes unavailable tab's unclassified)
  const currentUnclassified = activeTab === 'unavailable' ? visibleUnavailUnclassified : visibleUnclassified

  function selectAll() {
    if (selected.size === currentUnclassified.length) setSelected(new Set())
    else setSelected(new Set(currentUnclassified.map(e => e.id)))
  }

  async function handleAddToEval() {
    if (selected.size === 0) return
    setAdding(true)
    await onAddToEvaluation([...selected])
    setAdded(true)
    setSelected(new Set())
    setAdding(false)
    setTimeout(() => setAdded(false), 3000)
  }

  return (
    <div>
      {/* Page header: title + history selector on one row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 26, fontWeight: 600, color: '#111827', letterSpacing: '-0.025em', flexShrink: 0 }}>
          Scan results
        </h1>
        <ScanSelector
          scanHistory={scanHistory}
          selectedTs={selectedTs ?? latestTs}
          latestTs={latestTs}
          onChange={ts => loadHistoricalScan(ts === latestTs ? null : ts)}
        />
      </div>

      {/* Progress bar — visible while a new scan is streaming in */}
      {scanning && !histData && <ScanProgressBar progress={scanProgress} hitCap={hitCap} />}

      {/* Filter tabs on their own row */}
      <div style={{ marginBottom: 28 }}>
        <FilterTabs
          active={activeTab}
          onChange={tab => { setActiveTab(tab); setSelected(new Set()) }}
          counts={{ all: activeResults.length, classified: classified.length, unclassified: unclassified.length, unavailable: unavailable.length, screened: activeScreenedOut.length }}
        />
      </div>

      {/* Scan failure / model error banners */}
      {scanError && isViewingLatest && <ScanErrorBanner message={scanError} />}
      {histError && <ScanErrorBanner message={histError} />}
      {!scanError && isViewingLatest && batchErrors > 0 && !scanning && (
        <BatchErrorBanner count={batchErrors} total={activeTotalScanned ?? 0} />
      )}
      {histData?.batch_errors > 0 && (
        <BatchErrorBanner count={histData.batch_errors} total={histData.total_scanned ?? 0} />
      )}

      {/* Loading overlay for history fetch */}
      {histLoading && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 13.5 }}>
          Loading scan…
        </div>
      )}

      {!histLoading && (
        <>
          {/* Classified section */}
          {visibleClassified.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              {activeTab === 'all' && <SectionHeader label="Classified" count={classified.length} badge="green" />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {visibleClassified.map(e => <ClassifiedRow key={e.id} email={e} />)}
              </div>
            </div>
          )}

          {/* Not classified section */}
          {visibleUnclassified.length > 0 && (
            <div>
              {/* Header + toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                {activeTab === 'all' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Not classified
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: '#F3F4F6', color: '#6B7280' }}>
                      {unclassified.length}
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: 13, color: '#6B7280' }}>
                    {visibleUnclassified.length} email{visibleUnclassified.length !== 1 ? 's' : ''}
                  </span>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <button
                    onClick={selectAll}
                    style={{ fontSize: 12.5, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'color 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#111827'}
                    onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}
                  >
                    {selected.size === currentUnclassified.length && currentUnclassified.length > 0 ? 'Deselect all' : 'Select all'}
                  </button>

                  {selected.size > 0 && (
                    <button
                      onClick={handleAddToEval}
                      disabled={adding}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '7px 14px', borderRadius: 8, border: 'none',
                        background: '#111827', color: '#fff',
                        fontSize: 13, fontWeight: 500,
                        cursor: adding ? 'not-allowed' : 'pointer',
                        opacity: adding ? 0.6 : 1,
                        transition: 'opacity 0.1s',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      Add {selected.size} to evaluation set
                    </button>
                  )}

                  {added && (
                    <span style={{ fontSize: 12.5, color: '#059669', fontWeight: 500 }}>✓ Added</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {visibleUnclassified.map(e => (
                  <UnclassifiedRow
                    key={e.id}
                    email={e}
                    selected={selected.has(e.id)}
                    onToggle={() => toggle(e.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Unavailable tab — shows all unavailable emails split by classified status */}
          {activeTab === 'unavailable' && (
            <>
              {visibleUnavailClassified.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                  <SectionHeader label="Classified" count={visibleUnavailClassified.length} badge="green" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {visibleUnavailClassified.map(e => <ClassifiedRow key={e.id} email={e} />)}
                  </div>
                </div>
              )}

              {visibleUnavailUnclassified.length > 0 && (
                <div>
                  <SectionHeader label="Not classified" count={visibleUnavailUnclassified.length} badge="grey" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {visibleUnavailUnclassified.map(e => (
                      <UnclassifiedRow key={e.id} email={e} selected={selected.has(e.id)} onToggle={() => toggle(e.id)} />
                    ))}
                  </div>
                </div>
              )}

              {visibleUnavailClassified.length === 0 && visibleUnavailUnclassified.length === 0 && (
                <div style={{ padding: '60px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 13.5 }}>
                  No unavailable emails in this scan.
                </div>
              )}
            </>
          )}

          {activeTab !== 'unavailable' && activeTab !== 'screened' && visibleClassified.length === 0 && visibleUnclassified.length === 0 && batchErrors === 0 && (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 13.5 }}>
              No emails in this category.
            </div>
          )}

          {/* Screened-out tab */}
          {activeTab === 'screened' && (
            <ScreenedOutSection emails={activeScreenedOut} expanded />
          )}
        </>
      )}
    </div>
  )
}

// ── Screened-out section ──────────────────────────────────────────────────

function ScreenedOutSection({ emails, expanded = false }) {
  const [open, setOpen] = useState(false)
  const userExcluded  = emails.filter(e => e.user_excluded)
  const agentScreened = emails.filter(e => !e.user_excluded)
  const isOpen        = expanded || open

  const rows = (
    <div style={{ marginTop: expanded ? 0 : 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {userExcluded.length > 0 && agentScreened.length > 0 && (
        <p style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 6 }}>
          {userExcluded.length} excluded by your settings · {agentScreened.length} filtered by sender screen
        </p>
      )}
      {emails.map(e => (
        <div key={e.id} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '8px 10px', borderRadius: 8, background: '#FAFAF9',
          border: '1px solid #F0EFEB',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.subject || '(no subject)'}
            </div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.sender}
            </div>
          </div>
          <span style={{
            fontSize: 10.5, color: e.user_excluded ? '#6B7280' : '#9CA3AF',
            background: e.user_excluded ? '#F3F4F6' : '#F9F8F6',
            border: `1px solid ${e.user_excluded ? '#E5E7EB' : '#EBEBEA'}`,
            padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            {e.user_excluded ? 'User excluded' : e.screen_reason}
          </span>
        </div>
      ))}
    </div>
  )

  if (expanded) return rows

  return (
    <div style={{ marginTop: 32, borderTop: '1px solid #F0EFEB', paddingTop: 20 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%' }}
      >
        <span style={{ fontSize: 11.5, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', flex: 1, textAlign: 'left' }}>
          Screened out
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: '#F3F4F6', color: '#6B7280' }}>
          {emails.length}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: '#9CA3AF', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
          <path d="M2 4.5l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {isOpen && rows}
    </div>
  )
}

// ── Shared banners ────────────────────────────────────────────────────────

function ScanErrorBanner({ message }) {
  return (
    <div style={{
      marginBottom: 20, padding: '11px 14px', borderRadius: 10,
      background: '#FEF2F2', border: '1px solid #FECACA',
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
        <path d="M7.5 1L14 13H1L7.5 1z" stroke="#DC2626" strokeWidth="1.3" strokeLinejoin="round"/>
        <path d="M7.5 6v3M7.5 10.5v.5" stroke="#DC2626" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
      <p style={{ fontSize: 12.5, color: '#B91C1C' }}>Scan failed — {message}</p>
    </div>
  )
}

function BatchErrorBanner({ count, total }) {
  return (
    <div style={{
      marginBottom: 20, padding: '11px 14px', borderRadius: 10,
      background: '#FFFBEB', border: '1px solid #FDE68A',
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
        <path d="M7.5 1L14 13H1L7.5 1z" stroke="#D97706" strokeWidth="1.3" strokeLinejoin="round"/>
        <path d="M7.5 6v3M7.5 10.5v.5" stroke="#D97706" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
      <p style={{ fontSize: 12.5, color: '#92400E', lineHeight: 1.5 }}>
        The AI model had trouble processing {count} of {total} emails — results may be incomplete.
      </p>
    </div>
  )
}
