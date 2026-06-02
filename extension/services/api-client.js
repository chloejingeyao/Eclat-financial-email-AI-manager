// Option A: Proxy through the local Eclat backend.
// To switch to Option B (direct Gemini), replace this file only.

const BACKEND = 'http://localhost:3001';

export async function scanEmails(startDate, endDate) {
  const res = await fetch(`${BACKEND}/api/scan/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate, endDate }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Backend error ${res.status}`);
  }
  return res.json();
}

/**
 * Streaming version of scanEmails using SSE.
 * @param {string}   startDate
 * @param {string}   endDate
 * @param {Function} onProgress  — called with ({ done, total }) after each batch
 */
export async function scanEmailsStreaming(startDate, endDate, onProgress) {
  const res = await fetch(`${BACKEND}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate, endDate }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Backend error ${res.status}`);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data: ')) continue;
      let event;
      try { event = JSON.parse(line.slice(6)); } catch { continue; }

      if (event.type === 'fetched' && onProgress) {
        onProgress({ stage: 'fetched', emailCount: event.total, hitCap: !!event.hitCap });
      }
      if (event.type === 'screened' && onProgress) {
        onProgress({
          stage:        'screened',
          emailCount:   event.totalFetched,
          eligible:     event.eligible,
          screenedOut:  event.screenedOut,
          total:        event.totalBatches,
          done:         0,
          usedFallback: event.usedFallback,
        });
      }
      if (event.type === 'batch' && onProgress) {
        onProgress({ stage: 'batch', emailsDone: event.emailsDone, emailsTotal: event.emailsTotal, classifiedSoFar: event.classifiedSoFar });
      }
      if (event.type === 'complete') {
        const { type: _, ...result } = event;
        finalResult = result;
      }
      if (event.type === 'error') {
        throw new Error(event.error);
      }
    }
  }

  if (!finalResult) throw new Error('Scan completed without a result');
  return finalResult;
}
