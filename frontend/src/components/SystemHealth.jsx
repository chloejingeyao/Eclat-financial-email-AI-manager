import { useState } from 'react'

const CHIP = {
  'Merchant Promotions':     { label: 'Merchant Promotions',     bg: '#FFFBEB', color: '#B45309' },
  'Credit Card Rewards':     { label: 'Financial Rewards & Perks',  bg: '#F5F3FF', color: '#6D28D9' },
  'Subscription Management': { label: 'Subscription Management', bg: '#FEF2F2', color: '#B91C1C' },
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

function parseSender(raw) {
  if (!raw) return ''
  const m = raw.match(/^"?([^"<]+)"?\s*</)
  return m ? m[1].trim() : raw.split('@')[0]
}

// ── Tabs ──────────────────────────────────────────────────────────────────

function Tabs({ active, onChange, counts }) {
  const tabs = [
    { key: 'failures',        label: 'Failures to classify',    count: counts.failures },
    { key: 'misclassified',   label: 'Misclassification reports', count: counts.misclassified },
  ]
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      background: '#F3F4F6', borderRadius: 9, padding: 3,
      marginBottom: 28,
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
              transition: 'background 0.12s, color 0.12s',
              fontFamily: 'inherit',
            }}
          >
            {tab.label}
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 10,
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

// ── Failure row (missed email) ─────────────────────────────────────────────

function FailureRow({ email, onRemove }) {
  const url = `https://mail.google.com/mail/u/0/#inbox/${email.threadId}`
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginBottom: 4,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email.subject || '(no subject)'}
            </p>
            <p style={{ fontSize: 12.5, color: '#6B7280' }}>
              <span style={{ fontWeight: 500, color: '#374151' }}>{parseSender(email.sender)}</span>
              <span style={{ margin: '0 6px', color: '#D1D5DB' }}>·</span>
              {fmt(email.date)}
              <span style={{ margin: '0 6px', color: '#D1D5DB' }}>·</span>
              <span style={{ color: '#9CA3AF' }}>Added {fmtTs(email.added_at)}</span>
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <a
              href={url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12.5, color: '#6B7280', textDecoration: 'none', transition: 'color 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#111827'}
              onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}
            >Open ↗</a>
            <button
              onClick={() => onRemove(email.id)}
              style={{
                fontSize: 12, color: '#9CA3AF', background: 'none', border: 'none',
                cursor: 'pointer', padding: '2px 6px', borderRadius: 5,
                transition: 'color 0.1s, background 0.1s', fontFamily: 'inherit',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = '#FEF2F2' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = 'none' }}
            >Remove</button>
          </div>
        </div>
        {email.body && (
          <p style={{
            marginTop: 10, fontSize: 12.5, color: '#9CA3AF', lineHeight: 1.55,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {email.body}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Misclassification report row ──────────────────────────────────────────

function ReportRow({ entry, onRemove }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const url  = `https://mail.google.com/mail/u/0/#inbox/${entry.original_email?.threadId}`
  const chip = CHIP[entry.llm_classification?.emergent_category]

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px' }}>

        {/* Subject + meta row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginBottom: 3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entry.original_email?.subject || '(no subject)'}
            </p>
            <p style={{ fontSize: 12.5, color: '#6B7280' }}>
              <span style={{ fontWeight: 500, color: '#374151' }}>{parseSender(entry.original_email?.sender)}</span>
              <span style={{ margin: '0 6px', color: '#D1D5DB' }}>·</span>
              {fmt(entry.original_email?.date)}
              <span style={{ margin: '0 6px', color: '#D1D5DB' }}>·</span>
              <span style={{ color: '#9CA3AF' }}>Reported {fmtTs(entry.reported_at)}</span>
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <a
              href={url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12.5, color: '#6B7280', textDecoration: 'none', transition: 'color 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#111827'}
              onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}
            >Open ↗</a>
            <button
              onClick={() => onRemove(entry.id)}
              style={{
                fontSize: 12, color: '#9CA3AF', background: 'none', border: 'none',
                cursor: 'pointer', padding: '2px 6px', borderRadius: 5,
                transition: 'color 0.1s, background 0.1s', fontFamily: 'inherit',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = '#FEF2F2' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = 'none' }}
            >Remove</button>
          </div>
        </div>

        {/* User comment — primary detail, always visible */}
        {entry.user_comment && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '10px 12px', background: '#FFF7ED', borderRadius: 8,
            border: '1px solid #FED7AA', marginBottom: 10,
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M2 1h7l-1.5 3L9 8H2V1z" stroke="#F97316" strokeWidth="1.1" strokeLinejoin="round"/>
              <path d="M2 10v-1" stroke="#F97316" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
            <p style={{ fontSize: 13, color: '#92400E', lineHeight: 1.55, fontStyle: 'italic' }}>
              "{entry.user_comment}"
            </p>
          </div>
        )}

        {/* Incorrect label badge */}
        {chip && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>Misclassified as</span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
              background: chip.bg, color: chip.color,
            }}>
              {chip.label}
            </span>
          </div>
        )}

        {/* "View classification details" expander */}
        <button
          onClick={() => setDetailsOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, marginTop: 10,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: 12, color: '#9CA3AF', fontFamily: 'inherit', transition: 'color 0.1s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#374151'}
          onMouseLeave={e => e.currentTarget.style.color = '#9CA3AF'}
        >
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="none"
            style={{ transition: 'transform 0.15s', transform: detailsOpen ? 'rotate(90deg)' : 'rotate(0)' }}
          >
            <path d="M3 1.5L7 5L3 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {detailsOpen ? 'Hide classification details' : 'View classification details'}
        </button>
      </div>

      {/* LLM details drawer — hidden by default */}
      {detailsOpen && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid #F3F4F6', background: '#FAFAFA' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <div style={{ padding: '10px 12px', background: '#fff', borderRadius: 7, border: '1px solid #F3F4F6' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                LLM's signal
              </p>
              <p style={{ fontSize: 13, color: '#374151', marginBottom: 3 }}>
                {entry.llm_classification?.financial_signal || '—'}
              </p>
              <p style={{ fontSize: 12, color: '#9CA3AF' }}>
                Confidence: {entry.llm_classification?.confidence_score != null
                  ? `${Math.round(entry.llm_classification.confidence_score * 100)}%`
                  : '—'}
              </p>
            </div>
            <div style={{ padding: '10px 12px', background: '#fff', borderRadius: 7, border: '1px solid #F3F4F6' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                LLM's reasoning
              </p>
              <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                {entry.llm_classification?.reasoning || '—'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Info banner ───────────────────────────────────────────────────────────

function InfoBanner({ tab }) {
  const text = tab === 'failures'
    ? <>Emails added here were <strong style={{ fontWeight: 500, color: '#374151' }}>missed</strong> by the classifier. Use their subjects, senders, and body text as <strong style={{ fontWeight: 500, color: '#374151' }}>few-shot positive examples</strong> in the system prompt to improve recall. Saved to <Code>gold_standard_failures.json</Code>.</>
    : <>These emails were <strong style={{ fontWeight: 500, color: '#374151' }}>incorrectly classified</strong> by the model. Use the user comments and original labels as <strong style={{ fontWeight: 500, color: '#374151' }}>negative samples</strong> to tighten precision. Saved to <Code>classification_feedback.json</Code>.</>

  return (
    <div style={{
      padding: '12px 16px', borderRadius: 10, marginBottom: 24,
      background: '#F9FAFB', border: '1px solid #E5E7EB',
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
        <circle cx="7.5" cy="7.5" r="6.5" stroke="#9CA3AF" strokeWidth="1.2"/>
        <path d="M7.5 5v3.5M7.5 10v.5" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
      <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>{text}</p>
    </div>
  )
}

function Code({ children }) {
  return (
    <code style={{ fontSize: 12, background: '#F3F4F6', padding: '1px 5px', borderRadius: 4, color: '#374151' }}>
      {children}
    </code>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────

function EmptyCard({ tab }) {
  return (
    <div style={{ padding: '60px 0', textAlign: 'center', border: '1px dashed #E5E7EB', borderRadius: 12 }}>
      <p style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 6 }}>
        {tab === 'failures' ? 'No missed emails yet' : 'No reports yet'}
      </p>
      <p style={{ fontSize: 13, color: '#D1D5DB' }}>
        {tab === 'failures'
          ? 'Go to Scan results and flag missed emails to add them here.'
          : 'Click "Report" on a classified card to flag a misclassification.'}
      </p>
    </div>
  )
}

// ── SystemHealth ──────────────────────────────────────────────────────────

export default function SystemHealth({ goldStandard, feedback, onRemove, onRemoveFeedback }) {
  const [activeTab, setActiveTab] = useState('failures')

  const gs = goldStandard ?? []
  const fb = feedback ?? []

  const totalIssues = gs.length + fb.length

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 600, color: '#111827', letterSpacing: '-0.025em', marginBottom: 4 }}>
          Reported Cases
        </h1>
        <p style={{ fontSize: 13.5, color: '#6B7280' }}>
          {totalIssues === 0
            ? 'No issues logged yet.'
            : `${gs.length} missed · ${fb.length} misclassified`}
        </p>
      </div>

      {/* Tabs */}
      <Tabs
        active={activeTab}
        onChange={setActiveTab}
        counts={{ failures: gs.length, misclassified: fb.length }}
      />

      {/* Info banner */}
      <InfoBanner tab={activeTab} />

      {/* Content */}
      {activeTab === 'failures' && (
        gs.length === 0
          ? <EmptyCard tab="failures" />
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {gs.map(email => (
                <FailureRow key={email.id} email={email} onRemove={onRemove} />
              ))}
            </div>
          )
      )}

      {activeTab === 'misclassified' && (
        fb.length === 0
          ? <EmptyCard tab="misclassified" />
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fb.map(entry => (
                <ReportRow key={entry.id} entry={entry} onRemove={onRemoveFeedback} />
              ))}
            </div>
          )
      )}
    </div>
  )
}
