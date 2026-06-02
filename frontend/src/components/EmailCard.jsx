import { useState } from 'react'

const CHIP = {
  'Merchant Promotions':              { label: 'Merchant',      bg: '#FFFBEB', color: '#B45309', dot: '#F59E0B' },
  'Financial Rewards & Perks':        { label: 'Rewards',       bg: '#F5F3FF', color: '#6D28D9', dot: '#8B5CF6' },
  'Credit Card Rewards':              { label: 'Rewards',       bg: '#F5F3FF', color: '#6D28D9', dot: '#8B5CF6' },
  'Subscription & Status Management': { label: 'Subscription',  bg: '#FEF2F2', color: '#B91C1C', dot: '#EF4444' },
  'Subscription Management':          { label: 'Subscription',  bg: '#FEF2F2', color: '#B91C1C', dot: '#EF4444' },
}

function fmt(str) {
  if (!str) return ''
  const d = new Date(str.length === 10 ? str + 'T12:00:00' : str)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function hoursUntil(str) {
  if (!str) return null
  return (new Date(str + 'T12:00:00') - Date.now()) / 36e5
}

function parseSender(raw) {
  if (!raw) return ''
  const m = raw.match(/^"?([^"<]+)"?\s*</)
  return m ? m[1].trim() : raw.split('@')[0]
}

export default function EmailCard({ email, onReport }) {
  const [reasonOpen,   setReasonOpen]   = useState(false)
  const [reportOpen,   setReportOpen]   = useState(false)
  const [comment,      setComment]      = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [submitted,    setSubmitted]    = useState(false)

  const chip    = CHIP[email.emergent_category]
  const hours   = hoursUntil(email.deadline)
  const urgent  = hours !== null && hours > 0 && hours < 72
  const expired = hours !== null && hours <= 0
  const url     = `https://mail.google.com/mail/u/0/#all/${email.threadId}`

  async function submitReport() {
    if (!comment.trim()) return
    setSubmitting(true)
    try {
      await onReport(email.id, comment.trim())
      setSubmitted(true)
      setReportOpen(false)
      setComment('')
      setTimeout(() => setSubmitted(false), 4000)
    } finally {
      setSubmitting(false)
    }
  }

  function cancelReport() {
    setReportOpen(false)
    setComment('')
  }

  return (
    <div
      style={{
        background: '#fff', border: '1px solid #E8E7E3', borderRadius: 12,
        overflow: 'hidden',
        transition: 'box-shadow 0.18s, border-color 0.18s, transform 0.18s',
        animation: 'fadeUp 0.35s cubic-bezier(0.16,1,0.3,1) both',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'
        e.currentTarget.style.borderColor = '#C9C8C4'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = '#E8E7E3'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div style={{ padding: '18px 20px 14px' }}>

        {/* Category chip + unavailable badge + deadline */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            {chip ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600,
                background: chip.bg, color: chip.color, flexShrink: 0,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: chip.dot }} />
                {chip.label}
              </span>
            ) : <span />}
          </div>

          {email.deadline && !expired && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12.5, fontWeight: 500, flexShrink: 0,
              color: urgent ? '#DC2626' : '#6B7280',
            }}>
              {urgent && (
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#EF4444',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }} />
              )}
              {urgent ? 'Expires ' : 'Due '}{fmt(email.deadline)}
            </span>
          )}
        </div>


        {/* Perk value */}
        <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4, color: '#111827', marginBottom: 8, letterSpacing: '-0.01em' }}>
          {email.perk_value || email.financial_signal}
        </p>

        {/* Sender · date */}
        <p style={{ fontSize: 13, color: '#6B7280' }}>
          <span style={{ fontWeight: 500, color: '#374151' }}>{parseSender(email.sender)}</span>
          <span style={{ margin: '0 8px', color: '#E5E7EB' }}>·</span>
          {fmt(email.date)}
        </p>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', borderTop: '1px solid #F0EFEB', background: '#FAFAF9',
      }}>
        {/* Left: reasoning + report */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => setReasonOpen(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, background: 'none',
              border: 'none', cursor: 'pointer', padding: 0,
              fontSize: 12.5, color: reasonOpen ? '#374151' : '#9CA3AF',
              transition: 'color 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#374151'}
            onMouseLeave={e => e.currentTarget.style.color = reasonOpen ? '#374151' : '#9CA3AF'}
          >
            <svg
              width="10" height="10" viewBox="0 0 10 10" fill="none"
              style={{ transition: 'transform 0.15s', transform: reasonOpen ? 'rotate(90deg)' : 'rotate(0)' }}
            >
              <path d="M3 1.5L7 5L3 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Why flagged?
          </button>

          {/* Report false positive */}
          {submitted ? (
            <span style={{ fontSize: 12, color: '#059669', fontWeight: 500 }}>✓ Reported</span>
          ) : (
            <button
              onClick={() => setReportOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, background: 'none',
                border: 'none', cursor: 'pointer', padding: 0,
                fontSize: 12.5, color: reportOpen ? '#DC2626' : '#9CA3AF',
                transition: 'color 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
              onMouseLeave={e => e.currentTarget.style.color = reportOpen ? '#DC2626' : '#9CA3AF'}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M2 1h6l-1.5 3.5L8 8H2V1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                <path d="M2 9.5v-10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Report
            </button>
          )}
        </div>

        {/* Right: confidence + Gmail link */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {email.confidence_score != null && (
            <span style={{ fontSize: 12, color: '#D1D5DB', fontWeight: 500 }}>
              {/* {Math.round(email.confidence_score * 100)}% match */}
            </span>
          )}
          <a
            href={url} target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 13, fontWeight: 500, color: '#374151',
              textDecoration: 'none', transition: 'color 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#111827'}
            onMouseLeave={e => e.currentTarget.style.color = '#374151'}
          >
            Open
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M2 9L9 2M9 2H5M9 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>
      </div>

      {/* Reasoning drawer */}
      {reasonOpen && (
        <div style={{ padding: '0 20px 16px', background: '#FAFAF9' }}>
          <p style={{
            fontSize: 13, lineHeight: 1.65, color: '#4B5563',
            padding: '11px 14px', background: '#fff',
            border: '1px solid #E5E7EB', borderRadius: 8,
          }}>
            {email.reasoning}
          </p>
        </div>
      )}

      {/* Report drawer */}
      {reportOpen && (
        <div style={{ padding: '0 20px 16px', background: '#FAFAF9', borderTop: '1px solid #F0EFEB' }}>
          <div style={{
            padding: '14px', background: '#fff',
            border: '1px solid #FECACA', borderRadius: 8,
          }}>
            <p style={{ fontSize: 12.5, fontWeight: 500, color: '#B91C1C', marginBottom: 10 }}>
              Report incorrect classification
            </p>
            <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 10, lineHeight: 1.5 }}>
              Describe why this email was misclassified. Your feedback will be saved as a negative sample to improve the model.
            </p>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder='e.g. "This is just an order receipt, not a promotion."'
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '9px 11px', borderRadius: 7,
                border: '1px solid #E5E7EB', fontSize: 13,
                color: '#111827', resize: 'vertical', outline: 'none',
                fontFamily: 'inherit', lineHeight: 1.5,
                transition: 'border-color 0.1s',
              }}
              onFocus={e => e.currentTarget.style.borderColor = '#9CA3AF'}
              onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={submitReport}
                disabled={!comment.trim() || submitting}
                style={{
                  padding: '7px 14px', borderRadius: 7, border: 'none',
                  background: comment.trim() && !submitting ? '#111827' : '#E5E7EB',
                  color: comment.trim() && !submitting ? '#fff' : '#9CA3AF',
                  fontSize: 12.5, fontWeight: 500,
                  cursor: comment.trim() && !submitting ? 'pointer' : 'not-allowed',
                  transition: 'background 0.1s, color 0.1s',
                }}
              >
                {submitting ? 'Saving…' : 'Submit report'}
              </button>
              <button
                onClick={cancelReport}
                style={{
                  padding: '7px 14px', borderRadius: 7,
                  border: '1px solid #E5E7EB', background: 'transparent',
                  fontSize: 12.5, color: '#6B7280', cursor: 'pointer',
                  transition: 'border-color 0.1s, color 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#374151' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#6B7280' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}
