/**
 * server.js — Express API server.
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchEmails, cleanEmailBody, trimEmailFooter } from './fetchEmails.js';
import { analyzeEmails, analyzeEmailsBatched, classifySingleEmail } from './analyzeEmails.js';
import { screenSenders } from './screenSenders.js';
import 'dotenv/config';

const __dirname       = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH     = path.join(__dirname, '..', 'processed_emails.json');
const RAW_PATH        = path.join(__dirname, '..', 'raw_emails.json');
const GOLD_PATH       = path.join(__dirname, '..', 'gold_standard_failures.json');
const FEEDBACK_PATH   = path.join(__dirname, '..', 'classification_feedback.json');
const HISTORY_PATH    = path.join(__dirname, '..', 'scan_history.json');
const SETTINGS_PATH   = path.join(__dirname, '..', 'user_settings.json');
const PORT            = process.env.PORT ?? 3001;

const app = express();
app.use(cors({
  origin: (origin, callback) => {
    // Allow: no origin (curl/Postman), localhost dev, Chrome extensions
    if (!origin || origin.startsWith('chrome-extension://') ||
        origin === 'http://localhost:5173' || origin === 'http://localhost:3000' ||
        origin === 'https://mail.google.com') {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
}));
app.use(express.json());

// ── Helpers ────────────────────────────────────────────────────────────────

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ── Routes ────────────────────────────────────────────────────────────────

// GET /api/emails — return processed emails (classified feed + scan_results)
app.get('/api/emails', (req, res) => {
  const data = readJson(OUTPUT_PATH);
  if (!data) {
    return res.status(404).json({ error: 'No data yet. Run a scan first.' });
  }
  res.json(data);
});

// POST /api/scan — SSE stream: fetches emails then analyzes in batches of 20.
// Emits events: { type:'fetched' } → { type:'batch' } × N → { type:'complete' } | { type:'error' }
// Body (optional): { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
app.post('/api/scan', async (req, res) => {
  // Server-Sent Events headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if proxied
  res.flushHeaders();

  function send(obj) {
    if (!res.destroyed) res.write(`data: ${JSON.stringify(obj)}\n\n`);
  }

  try {
    const { startDate, endDate } = req.body ?? {};
    console.log(`Scan triggered via API (SSE)... range: ${startDate ?? 'default'} → ${endDate ?? 'default'}`);

    const { emails, dateRange } = await fetchEmails({ startDate, endDate });
    const scannedAt = new Date().toISOString();

    send({ type: 'fetched', total: emails.length, dateRange, scannedAt });

    // Agent 1: screen senders before full LLM analysis
    const settings = readJson(SETTINGS_PATH, {});
    const provider = settings.preferred_model ?? 'gemini';
    const apiKey   = provider === 'claude'
      ? (settings.claude_api_key  || process.env.ANTHROPIC_API_KEY)
      : (settings.gemini_api_key  || process.env.GEMINI_API_KEY);

    if (!apiKey) {
      const providerName = provider === 'claude' ? 'Anthropic (Claude)' : 'Gemini';
      send({ type: 'error', error: `No ${providerName} API key found. Go to Settings in the extension to add your key.` });
      return res.end();
    }

    const modelConfig = { provider, apiKey };
    const { eligible, screenedOut, usedFallback } = await screenSenders(emails, {
      excludedSenders: settings.excluded_senders ?? [],
      modelConfig,
    });
    const totalBatches = Math.ceil(eligible.length / 20);

    send({
      type: 'screened',
      totalFetched:  emails.length,
      eligible:      eligible.length,
      screenedOut:   screenedOut.length,
      totalBatches,
      usedFallback,
    });

    const result = await analyzeEmailsBatched(eligible, {
      dateRange,
      scannedAt,
      modelConfig,
      onBatch: async ({ batchIndex, totalBatches: tb, batchEnriched, batchScanResults, emailsDone, emailsTotal, classifiedSoFar }) => {
        if (res.destroyed) throw new Error('Client disconnected');
        send({ type: 'batch', batchIndex, totalBatches: tb, newClassified: batchEnriched, newScanResults: batchScanResults, emailsDone, emailsTotal, classifiedSoFar });
      },
    });

    // Merge screened-out emails into the final result
    const finalResult = {
      ...result,
      total_fetched:      emails.length,
      total_screened_out: screenedOut.length,
      screening_fallback: usedFallback,
      screened_out:       screenedOut,
    };

    // Persist for /api/emails and archive to history
    writeJson(OUTPUT_PATH, finalResult);

    const historyEntry = {
      timestamp:          finalResult.scanned_at,
      date_range:         finalResult.date_range,
      total_fetched:      finalResult.total_fetched,
      total_scanned:      finalResult.total_scanned,
      total_screened_out: finalResult.total_screened_out,
      total_flagged:      finalResult.total_flagged,
      batch_errors:       finalResult.batch_errors ?? 0,
      screening_fallback: finalResult.screening_fallback,
      emails:             finalResult.emails,
      scan_results:       finalResult.scan_results,
      screened_out:       finalResult.screened_out,
    };
    const history        = readJson(HISTORY_PATH, []);
    const dedupedHistory = history.filter((h) => h.timestamp !== finalResult.scanned_at);
    writeJson(HISTORY_PATH, [historyEntry, ...dedupedHistory]);
    console.log(`✓ Archived scan ${finalResult.scanned_at} to scan_history.json (${dedupedHistory.length + 1} total)`);

    send({ type: 'complete', ...finalResult });
    res.end();
  } catch (err) {
    console.error('Scan error:', err.message);
    send({ type: 'error', error: err.message });
    if (!res.destroyed) res.end();
  }
});

// POST /api/scan/sync — same batched analysis as /api/scan but returns a single JSON response.
// Used by the Chrome extension (service workers cannot consume SSE streams).
app.post('/api/scan/sync', async (req, res) => {
  try {
    const { startDate, endDate } = req.body ?? {};
    console.log(`Sync scan triggered... range: ${startDate ?? 'default'} → ${endDate ?? 'default'}`);
    const { emails, dateRange } = await fetchEmails({ startDate, endDate });
    const result = await analyzeEmailsBatched(emails, { dateRange });

    writeJson(OUTPUT_PATH, result);

    const historyEntry = {
      timestamp:     result.scanned_at,
      date_range:    result.date_range,
      total_scanned: result.total_scanned,
      total_flagged: result.total_flagged,
      batch_errors:  result.batch_errors ?? 0,
      emails:        result.emails,
      scan_results:  result.scan_results,
    };
    const history        = readJson(HISTORY_PATH, []);
    const dedupedHistory = history.filter((h) => h.timestamp !== result.scanned_at);
    writeJson(HISTORY_PATH, [historyEntry, ...dedupedHistory]);

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Sync scan error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/history — return scan metadata list (no full email payloads)
app.get('/api/history', (req, res) => {
  const history = readJson(HISTORY_PATH, []);
  const meta = history.map(({ timestamp, total_scanned, total_flagged, date_range }) => ({
    timestamp, total_scanned, total_flagged, date_range,
  }));
  res.json(meta);
});

// GET /api/history/:timestamp — return full scan data for a specific timestamp
app.get('/api/history/:timestamp', (req, res) => {
  const history = readJson(HISTORY_PATH, []);
  const entry   = history.find((h) => h.timestamp === req.params.timestamp);
  if (!entry) return res.status(404).json({ error: 'Scan not found.' });
  res.json(entry);
});

// GET /api/feedback — return all false-positive reports
app.get('/api/feedback', (req, res) => {
  res.json(readJson(FEEDBACK_PATH, []));
});

// DELETE /api/feedback/:id — remove a misclassification report
app.delete('/api/feedback/:id', (req, res) => {
  const existing = readJson(FEEDBACK_PATH, []);
  const updated  = existing.filter((e) => e.id !== req.params.id);
  writeJson(FEEDBACK_PATH, updated);
  res.json({ success: true, total: updated.length });
});

// GET /api/gold-standard — return evaluation set
app.get('/api/gold-standard', (req, res) => {
  const data = readJson(GOLD_PATH, []);
  res.json(data);
});

// POST /api/evaluation — add emails to gold_standard_failures.json
// Body: { emailIds: string[] }
app.post('/api/evaluation', (req, res) => {
  const { emailIds } = req.body;
  if (!Array.isArray(emailIds) || emailIds.length === 0) {
    return res.status(400).json({ error: 'emailIds must be a non-empty array.' });
  }

  // Look up full email data from raw_emails.json (has body)
  const raw = readJson(RAW_PATH, []);
  const rawMap = new Map(raw.map((e) => [e.id, e]));

  const existing  = readJson(GOLD_PATH, []);
  const existingIds = new Set(existing.map((e) => e.id));

  const added = [];
  for (const id of emailIds) {
    if (existingIds.has(id)) continue; // skip duplicates
    const email = rawMap.get(id);
    if (!email) continue;
    added.push({
      id:       email.id,
      threadId: email.threadId,
      subject:  email.subject,
      sender:   email.sender,
      date:     email.date,
      body:     email.body,
      added_at: new Date().toISOString(),
    });
  }

  const updated = [...existing, ...added];
  writeJson(GOLD_PATH, updated);

  console.log(`✓ Added ${added.length} email(s) to gold_standard_failures.json`);
  res.json({ success: true, added: added.length, total: updated.length });
});

// DELETE /api/evaluation/:id — remove an email from the evaluation set
app.delete('/api/evaluation/:id', (req, res) => {
  const existing = readJson(GOLD_PATH, []);
  const updated  = existing.filter((e) => e.id !== req.params.id);
  writeJson(GOLD_PATH, updated);
  res.json({ success: true, total: updated.length });
});

// POST /api/feedback — save a false-positive report to classification_feedback.json
// Body: { emailId, comment }
app.post('/api/feedback', (req, res) => {
  const { emailId, comment } = req.body;
  if (!emailId) return res.status(400).json({ error: 'emailId is required.' });

  // Pull full email data from both sources
  const processed = readJson(OUTPUT_PATH);
  const raw       = readJson(RAW_PATH, []);

  const classified = processed?.emails ?? [];
  const email      = classified.find((e) => e.id === emailId);
  if (!email) return res.status(404).json({ error: 'Email not found in classified results.' });

  // Enrich with raw body (classified entry may have truncated body)
  const rawEmail = raw.find((e) => e.id === emailId) ?? {};

  const entry = {
    id:           emailId,
    reported_at:  new Date().toISOString(),
    user_comment: comment ?? '',
    original_email: {
      id:       email.id,
      threadId: email.threadId,
      subject:  email.subject,
      sender:   email.sender,
      date:     email.date,
      body:     rawEmail.body ?? email.body ?? '',
    },
    llm_classification: {
      emergent_category: email.emergent_category,
      financial_signal:  email.financial_signal,
      reasoning:         email.reasoning,
      confidence_score:  email.confidence_score,
      deadline:          email.deadline ?? null,
    },
  };

  const existing    = readJson(FEEDBACK_PATH, []);
  const deduplicated = existing.filter((e) => e.id !== emailId); // replace if re-reported
  writeJson(FEEDBACK_PATH, [...deduplicated, entry]);

  console.log(`✓ False positive reported: "${email.subject?.slice(0, 50)}" — ${comment}`);
  res.json({ success: true });
});

// POST /api/widget/classify — classify a single email from the Chrome extension
app.post('/api/widget/classify', async (req, res) => {
  try {
    const { id, threadId, subject, sender, date, plainText, htmlText } = req.body;
    if (!id || !threadId) return res.status(400).json({ error: 'id and threadId required' });

    // Run through the same cleaning pipeline as the web app
    const rawSource = plainText || htmlText || '';
    const cleaned   = cleanEmailBody(rawSource);
    const { body: trimmed, footerSnippet } = trimEmailFooter(cleaned);

    const is_unavailable_content = trimmed.length > 4000;
    const unavailable_reason = is_unavailable_content
      ? `${trimmed.length.toLocaleString()} chars after cleaning — truncated to 4,000`
      : null;
    const finalBody = trimmed.slice(0, 4000);

    // Check image-heavy
    const is_image_heavy = finalBody.trim().length < 150;

    const emailForClassification = {
      id, threadId, subject, sender,
      date: date ? new Date(date).toISOString().split('T')[0] : '',
      body: finalBody,
    };

    const result = await classifySingleEmail(emailForClassification);

    return res.json({
      classified: !!result,
      emergent_category: result?.emergent_category ?? null,
      perk_value:        result?.perk_value ?? null,
      reasoning:         result?.reasoning ?? null,
      confidence_score:  result?.confidence_score ?? null,
      deadline:          result?.deadline ?? null,
      is_unavailable_content,
      unavailable_reason,
      is_image_heavy,
      footer_detected: !!footerSnippet,
      // echo back metadata
      subject, sender, date: emailForClassification.date, id, threadId,
    });
  } catch (e) {
    console.error('/api/widget/classify error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/settings — return user settings (API keys are not returned)
app.get('/api/settings', (req, res) => {
  const s = readJson(SETTINGS_PATH, {});
  res.json({
    excluded_senders: s.excluded_senders ?? [],
    preferred_model:  s.preferred_model  ?? 'gemini',
    gemini_key_set:   !!(s.gemini_api_key),
    claude_key_set:   !!(s.claude_api_key),
  });
});

// PUT /api/settings — merge new values into stored settings
app.put('/api/settings', (req, res) => {
  const { excluded_senders, preferred_model, gemini_api_key, claude_api_key } = req.body;
  const existing = readJson(SETTINGS_PATH, {});

  if (excluded_senders !== undefined && !Array.isArray(excluded_senders)) {
    return res.status(400).json({ error: 'excluded_senders must be an array.' });
  }

  const updated = {
    excluded_senders: excluded_senders !== undefined
      ? excluded_senders.map(s => String(s).trim()).filter(Boolean)
      : (existing.excluded_senders ?? []),
    preferred_model: preferred_model ?? existing.preferred_model ?? 'gemini',
    gemini_api_key:  gemini_api_key  !== undefined ? gemini_api_key  : (existing.gemini_api_key  ?? ''),
    claude_api_key:  claude_api_key  !== undefined ? claude_api_key  : (existing.claude_api_key  ?? ''),
  };

  writeJson(SETTINGS_PATH, updated);
  res.json({
    success:         true,
    excluded_senders: updated.excluded_senders,
    preferred_model:  updated.preferred_model,
    gemini_key_set:   !!(updated.gemini_api_key),
    claude_key_set:   !!(updated.claude_api_key),
  });
});

app.listen(PORT, () => {
  console.log(`Eclat API running on http://localhost:${PORT}`);
});
