import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import EmailCard from './components/EmailCard'
import ScanResults from './components/ScanResults'
import SystemHealth from './components/SystemHealth'
import './index.css'

const CATEGORY_ORDER = [
  'Merchant Promotions',
  'Financial Rewards & Perks',
  'Subscription & Status Management',
]

// Aliases for backwards-compatibility with older scan data
const CATEGORY_ALIAS = {
  'Credit Card Rewards':    'Financial Rewards & Perks',
  'Subscription Management': 'Subscription & Status Management',
}

const SECTION_DOT = {
  'Merchant Promotions':              '#F59E0B',
  'Financial Rewards & Perks':        '#8B5CF6',
  'Subscription & Status Management': '#EF4444',
}

const VIEW_LABEL = {
  'all':                              'All Emails',
  'Merchant Promotions':              'Merchant Promotions',
  'Financial Rewards & Perks':        'Financial Rewards',
  'Subscription & Status Management': 'Subscription Management',
}

// ── Tiny primitives ──────────────────────────────────────────────────────

function Spinner() {
  return (
    <>
      <span style={{
        display: 'inline-block', width: 18, height: 18, borderRadius: '50%',
        border: '2px solid #E5E7EB', borderTopColor: '#374151',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}

function EmptyState({ onScan, scanning }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '80px 0', textAlign: 'center' }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12, background: '#F3F4F6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M2 5.5L11 12L20 5.5V17a1 1 0 01-1 1H3a1 1 0 01-1-1V5.5z" stroke="#9CA3AF" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M2 5.5L11 12L20 5.5" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 5 }}>No signals yet</p>
        <p style={{ fontSize: 13.5, color: '#6B7280', lineHeight: 1.6 }}>Scan your inbox to surface financial signals.</p>
      </div>
      <button
        onClick={onScan} disabled={scanning}
        style={{
          marginTop: 4, padding: '9px 20px', borderRadius: 8, border: 'none',
          background: '#111827', color: '#fff', fontSize: 13.5, fontWeight: 500,
          cursor: scanning ? 'not-allowed' : 'pointer', opacity: scanning ? 0.6 : 1,
        }}
      >
        {scanning ? 'Scanning…' : 'Scan inbox'}
      </button>
    </div>
  )
}

function SectionHeader({ category, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: SECTION_DOT[category] ?? '#9CA3AF', flexShrink: 0 }} />
      <span style={{ fontSize: 11.5, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {category}
      </span>
      <span style={{ fontSize: 11.5, color: '#D1D5DB', fontWeight: 500 }}>{count}</span>
      <div style={{ flex: 1, height: 1, background: '#E8E7E3' }} />
    </div>
  )
}

// ── App ──────────────────────────────────────────────────────────────────

/** Format a Date as YYYY-MM-DD in the user's LOCAL timezone (not UTC). */
function localDateStr(d = new Date()) {
  const y  = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${dy}`
}
function todayStr()      { return localDateStr() }
function nDaysAgoStr(n)  { const d = new Date(); d.setDate(d.getDate() - n); return localDateStr(d) }

// In dev, call the backend directly for SSE so Vite's proxy doesn't buffer the stream.
// In production the frontend is served from the same origin as the backend.
const SSE_BASE = import.meta.env.DEV ? 'http://localhost:3001' : ''

export default function App() {
  const [data,         setData]         = useState(null)
  const [goldStandard, setGoldStandard] = useState([])
  const [feedback,     setFeedback]     = useState([])
  const [scanHistory,  setScanHistory]  = useState([])
  const [dateRange,    setDateRange]    = useState({ start: nDaysAgoStr(7), end: todayStr() })
  const [loading,      setLoading]      = useState(true)
  const [scanning,     setScanning]     = useState(false)
  const [scanProgress, setScanProgress] = useState(null)   // { done: K, total: M } during scan
  const [hitCap,       setHitCap]       = useState(false)
  const [error,        setError]        = useState(null)
  const [scanError,    setScanError]    = useState(null)   // non-fatal: keeps last results
  const [view,         setView]         = useState('all')

  // ── Data loaders ──────────────────────────────────────────────────────

  async function loadEmails() {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/emails')
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to load')
      setData(await r.json())
    } catch (e) { setError(e.message) }
    finally     { setLoading(false) }
  }

  async function loadGoldStandard() {
    try {
      const r = await fetch('/api/gold-standard')
      if (r.ok) setGoldStandard(await r.json())
    } catch { /* non-fatal */ }
  }

  async function loadFeedback() {
    try {
      const r = await fetch('/api/feedback')
      if (r.ok) setFeedback(await r.json())
    } catch { /* non-fatal */ }
  }

  async function loadScanHistory() {
    try {
      const r = await fetch('/api/history')
      if (r.ok) setScanHistory(await r.json())
    } catch { /* non-fatal */ }
  }

  async function scan() {
    setScanning(true)
    setScanError(null)
    setScanProgress(null)
    setView('scan-results')  // navigate immediately so progress is visible

    let buffer = ''
    try {
      const response = await fetch(`${SSE_BASE}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: dateRange.start, endDate: dateRange.end }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error ?? 'Scan failed')
      }

      const reader  = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSE events are delimited by blank lines (\n\n)
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data: ')) continue
          let event
          try { event = JSON.parse(line.slice(6)) } catch { continue }

          if (event.type === 'fetched') {
            setHitCap(!!event.hitCap)
            setScanProgress({ stage: 'fetched', done: 0, total: 0, emailCount: event.total, hitCap: !!event.hitCap })
            // Initialise an empty result so scan-results page renders immediately
            setData({
              scanned_at:    event.scannedAt,
              date_range:    event.dateRange,
              total_fetched: event.total,
              total_scanned: 0,
              total_flagged: 0,
              emails:        [],
              scan_results:  [],
              screened_out:  [],
            })
          }

          if (event.type === 'screened') {
            setScanProgress({
              stage:       'screened',
              done:        0,
              total:       event.totalBatches,
              eligible:    event.eligible,
              screenedOut: event.screenedOut,
            })
            setData(prev => prev ? {
              ...prev,
              total_scanned:      event.eligible,
              total_screened_out: event.screenedOut,
              screening_fallback: event.usedFallback,
            } : prev)
          }

          if (event.type === 'batch') {
            setScanProgress(prev => prev ? { ...prev, stage: 'batch', done: event.batchIndex } : null)
            // Append new scan results incrementally — main signal feed waits for complete
            setData(prev => {
              if (!prev) return prev
              return {
                ...prev,
                total_flagged: (prev.total_flagged ?? 0) + event.newClassified.length,
                scan_results:  [...(prev.scan_results ?? []), ...event.newScanResults],
              }
            })
          }

          if (event.type === 'complete') {
            const { type: _, ...result } = event
            setData(result)         // replace with final sorted data
            setScanProgress(null)
            loadScanHistory()
          }

          if (event.type === 'error') throw new Error(event.error)
        }
      }
    } catch (e) {
      setScanError(e.message)
      setScanProgress(null)
    } finally {
      setScanning(false)
    }
  }

  async function addToEvaluation(emailIds) {
    const r = await fetch('/api/evaluation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailIds }),
    })
    if (r.ok) await loadGoldStandard()
  }

  async function removeFromEvaluation(id) {
    const r = await fetch(`/api/evaluation/${id}`, { method: 'DELETE' })
    if (r.ok) setGoldStandard(prev => prev.filter(e => e.id !== id))
  }

  async function reportFalsePositive(emailId, comment) {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId, comment }),
    })
    loadFeedback()
  }

  async function removeFeedback(id) {
    const r = await fetch(`/api/feedback/${id}`, { method: 'DELETE' })
    if (r.ok) setFeedback(prev => prev.filter(e => e.id !== id))
  }

  useEffect(() => { loadEmails(); loadGoldStandard(); loadFeedback(); loadScanHistory() }, [])

  // ── Derived state ──────────────────────────────────────────────────────

  const grouped = {}
  if (data?.emails) {
    for (const cat of CATEGORY_ORDER) {
      const items = data.emails.filter(e => {
        const resolved = CATEGORY_ALIAS[e.emergent_category] ?? e.emergent_category
        return resolved === cat
      })
      if (items.length) grouped[cat] = items
    }
    for (const email of data.emails) {
      const resolved = CATEGORY_ALIAS[email.emergent_category] ?? email.emergent_category
      if (!CATEGORY_ORDER.includes(resolved)) {
        if (!grouped[resolved]) grouped[resolved] = []
        grouped[resolved].push(email)
      }
    }
  }

  const counts = Object.fromEntries(
    Object.entries(grouped).map(([k, v]) => [k, v.length])
  )

  const isSignalView  = view === 'all' || CATEGORY_ORDER.includes(view)
  const visibleGroups = view === 'all'
    ? Object.entries(grouped)
    : Object.entries(grouped).filter(([k]) => k === view)
  const totalVisible  = visibleGroups.reduce((a, [, v]) => a + v.length, 0)

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F5F4F1' }}>
      <Sidebar
        active={view}
        onChange={setView}
        counts={counts}
        scanning={scanning}
        onScan={scan}
        goldCount={goldStandard.length}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        meta={data ? {
          scanned_at:    data.scanned_at,
          total_scanned: data.total_scanned,
          total_flagged: data.total_flagged,
        } : null}
      />

      <main style={{ flex: 1, minWidth: 0, height: '100vh', overflowY: 'auto', padding: '44px 56px 80px' }}>
        <div style={{ maxWidth: 720 }}>

          {/* Error banner */}
          {error && (
            <div style={{
              marginBottom: 24, padding: '12px 16px', borderRadius: 10,
              background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 13.5, color: '#B91C1C',
            }}>
              {error}
            </div>
          )}

          {/* ── Scan Results view ── */}
          {view === 'scan-results' && (
            <ScanResults
              scanResults={data?.scan_results}
              scannedAt={data?.scanned_at}
              totalScanned={data?.total_scanned}
              dateRange={data?.date_range}
              screenedOut={data?.screened_out ?? []}
              batchErrors={data?.batch_errors ?? 0}
              scanHistory={scanHistory}
              onAddToEvaluation={addToEvaluation}
              scanError={scanError}
              scanning={scanning}
              scanProgress={scanProgress}
              hitCap={hitCap}
            />
          )}

          {/* ── System Health view ── */}
          {view === 'system-health' && (
            <SystemHealth
              goldStandard={goldStandard}
              feedback={feedback}
              onRemove={removeFromEvaluation}
              onRemoveFeedback={removeFeedback}
            />
          )}

          {/* ── Signal feed views (All / category filters) ── */}
          {isSignalView && (
            <>
              {/* Page header */}
              <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 26, fontWeight: 600, color: '#111827', letterSpacing: '-0.025em', marginBottom: 4 }}>
                  {VIEW_LABEL[view] ?? view}
                </h1>
                {!loading && data && (
                  <p style={{ fontSize: 13.5, color: '#6B7280' }}>
                    {totalVisible === 0
                      ? 'No signals found'
                      : `${totalVisible} email${totalVisible !== 1 ? 's' : ''}`}
                    {data.scanned_at && (
                      <span style={{ marginLeft: 10, fontSize: 12.5, color: '#9CA3AF' }}>
                        ·  {new Date(data.scanned_at).toLocaleString(undefined, {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Model error banner */}
              {!loading && !scanning && data && (data.batch_errors > 0 || scanError) && (
                <div style={{
                  marginBottom: 28, padding: '13px 16px', borderRadius: 10,
                  background: '#FFFBEB', border: '1px solid #FDE68A',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                      <path d="M7.5 1L14 13H1L7.5 1z" stroke="#D97706" strokeWidth="1.3" strokeLinejoin="round"/>
                      <path d="M7.5 6v3M7.5 10.5v.5" stroke="#D97706" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    <p style={{ fontSize: 12.5, color: '#92400E', lineHeight: 1.5 }}>
                      {scanError
                        ? `Scan failed — ${scanError}`
                        : `The AI model had trouble processing ${data.batch_errors} of ${data.total_scanned} emails — results may be incomplete.`}
                    </p>
                  </div>
                  <button
                    onClick={scan}
                    style={{
                      flexShrink: 0, padding: '5px 13px', borderRadius: 7, border: '1px solid #FCD34D',
                      background: '#fff', color: '#92400E', fontSize: 12.5, fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}
                  >
                    Run again
                  </button>
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '80px 0' }}>
                  <Spinner />
                  <p style={{ fontSize: 13.5, color: '#9CA3AF' }}>Loading your feed…</p>
                </div>
              )}

              {/* Empty */}
              {!loading && !error && data && visibleGroups.length === 0 && (
                <EmptyState onScan={scan} scanning={scanning} />
              )}

              {/* Feed */}
              {!loading && visibleGroups.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                  {visibleGroups.map(([category, emails]) => (
                    <section key={category}>
                      {view === 'all' && <SectionHeader category={category} count={emails.length} />}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {emails.map(email => <EmailCard key={email.id} email={email} onReport={reportFalsePositive} />)}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </>
          )}

        </div>
      </main>
    </div>
  )
}
