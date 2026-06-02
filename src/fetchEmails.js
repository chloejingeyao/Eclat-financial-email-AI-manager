/**
 * fetchEmails.js — Fetch inbox emails within a date range from Gmail.
 * Writes raw sanitized data to raw_emails.json.
 *
 * Processing pipeline (per email):
 *   1. Decode MIME body → prefer text/plain, fallback to text/html
 *   2. Run full cleanEmailBody pipeline (always treats content as potentially HTML):
 *      - Nuke structural noise (doctype, head, script, style, comments)
 *      - Preserve CTA link text as [text](url) markdown
 *      - Strip remaining HTML tags + decode entities
 *      - Remove invisible Unicode chars + long tracking URLs
 *      - Collapse whitespace
 *   3. trimEmailFooter — detect and strip footer boilerplate
 *   4. Apply 4000-char limit AFTER cleaning + footer removal
 *      → is_unavailable_content = true if cut
 *   5. is_image_heavy detection (any condition triggers):
 *      - 3+ <img> tags in source HTML AND readable text < 400 chars, OR
 *      - HTML source > 2000 chars AND readable text < 200 chars (bloated layout, e.g. Parks Project), OR
 *      - readable text < 50 chars (extreme fallback)
 *      → inject rich HTML metadata (alt-texts, headings, CTAs) as body
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createOAuth2Client, loadToken } from './auth.js';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_PATH  = path.join(__dirname, '..', 'raw_emails.json');

// ── Text extraction ───────────────────────────────────────────────────────

// Convert <a href="url">text</a> → [text](url) before stripping tags
function preserveLinks(html) {
  return html.replace(
    /<a\b[^>]*?href=["']([^"']{1,300})["'][^>]*?>([\s\S]*?)<\/a\s*>/gi,
    (_, url, inner) => {
      const text = inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const cleanUrl = url.trim();
      if (text.length >= 2 && cleanUrl.startsWith('http') && cleanUrl.length <= 150) {
        return `[${text}](${cleanUrl}) `;
      }
      return text ? text + ' ' : '';
    }
  );
}

// Full cleaning pipeline — always treats content as potentially HTML regardless of MIME label
function cleanEmailBody(raw) {
  let t = raw;
  // 1. Nuke structural noise blocks entirely
  t = t.replace(/<!doctype[^>]*>/gi, '');
  t = t.replace(/<head[\s\S]*?<\/head>/gi, '');
  t = t.replace(/<script[\s\S]*?<\/script>/gi, '');
  t = t.replace(/<style[\s\S]*?<\/style>/gi, '');
  t = t.replace(/<!--[\s\S]*?-->/g, '');
  // 2. Preserve CTA / link text before stripping
  t = preserveLinks(t);
  // 3. Strip all remaining HTML tags
  t = t.replace(/<[^>]+>/g, ' ');
  // 4. Decode HTML entities
  t = t
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#\d+;/g, ' ');
  // 5. Remove invisible Unicode spacers
  t = t.replace(/[\u200B\u200C\u200D\u00AD\uFEFF\u00A0]/g, ' ');
  // 6. Remove bare long tracking URLs (not inside [text](url) markdown)
  t = t.replace(/(?<!\])\(https?:\/\/\S{80,}\)/g, '');
  t = t.replace(/https?:\/\/\S{80,}/g, '');
  // 7. Collapse whitespace
  return t.replace(/\s+/g, ' ').trim();
}

// Detect footer boundary and trim — returns { body, footerSnippet }
function trimEmailFooter(text) {
  const markers = [
    /\bunsubscribe\b/i,
    /\bprivacy policy\b/i,
    /you('re| are) receiving this (email|message)/i,
    /to (stop|opt[- ]?out|manage|change) (receiving|your (email|preferences))/i,
    /\ball rights reserved\b/i,
    /©\s*20\d\d/,
    /this (email|message) was sent to/i,
    /you('re)? receiving this because/i,
    /manage (your )?email preferences/i,
    /to ensure delivery/i,
    /add .{3,60} to your (address book|contacts)/i,
    /\bdo not reply to this email\b/i,
  ];

  // Footer cannot start in the first 25% to avoid false positives on mentions in body
  const minStart = Math.floor(text.length * 0.25);
  let footerStart = text.length;

  for (const marker of markers) {
    const idx = text.search(marker);
    if (idx > minStart && idx < footerStart) {
      footerStart = idx;
    }
  }

  if (footerStart < text.length) {
    return {
      body: text.slice(0, footerStart).trim(),
      footerSnippet: text.slice(footerStart, footerStart + 100).trim(),
    };
  }
  return { body: text, footerSnippet: null };
}

// ── Image metadata extraction (OCR fallback) ──────────────────────────────

// Extract visual metadata from raw HTML for image-heavy emails
function extractImageMetadata(html) {
  if (!html) return '';
  const parts = [];

  const alts = [...new Set(
    [...html.matchAll(/alt=["']([^"']{4,100})["']/gi)]
      .map((m) => m[1].trim())
      .filter((a) => !/^(image|img|photo|banner|spacer|pixel|logo|icon|email|bg|background)$/i.test(a)),
  )].slice(0, 10);
  if (alts.length) parts.push(`Alt texts: "${alts.join('", "')}"`);

  const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]{3,120}?)<\/h[1-3]>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    .filter((h) => h.length >= 3);
  if (headings.length) parts.push(`Headings: "${headings.slice(0, 5).join('", "')}"`);

  const ctaText = [...new Set(
    [...html.matchAll(/<(?:button|a)\b[^>]*>([\s\S]{4,80}?)<\/(?:button|a)>/gi)]
      .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
      .filter((b) => b.length >= 4 && !/^(click here|here|view|read more|unsubscribe|privacy policy)$/i.test(b)),
  )].slice(0, 8);
  if (ctaText.length) parts.push(`CTA text: "${ctaText.join('", "')}"`);

  const fnames = [...new Set(
    [...html.matchAll(/src=["'][^"']*\/([^/"'?]{5,}\.(?:jpg|jpeg|png|gif|webp))/gi)]
      .map((m) => m[1].split('?')[0].replace(/[-_.]/g, ' ').replace(/\.[^.]+$/, '').trim())
      .filter((f) => !/^(spacer|pixel|track|1x1|logo|header|footer|bg|\d+)$/i.test(f)),
  )].slice(0, 6);
  if (fnames.length) parts.push(`Image names: "${fnames.join('", "')}"`);

  return parts.join('; ');
}

// Extract { plainText, htmlText } from a Gmail MIME payload part
function getRawContent(part) {
  if (!part) return { plainText: '', htmlText: '' };
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return { plainText: Buffer.from(part.body.data, 'base64').toString('utf8'), htmlText: '' };
  }
  if (part.mimeType === 'text/html' && part.body?.data) {
    return { plainText: '', htmlText: Buffer.from(part.body.data, 'base64').toString('utf8') };
  }
  if (part.parts) {
    const plain = part.parts.find((p) => p.mimeType === 'text/plain');
    const html  = part.parts.find((p) => p.mimeType === 'text/html');
    const plainText = plain?.body?.data ? Buffer.from(plain.body.data, 'base64').toString('utf8') : '';
    const htmlText  = html?.body?.data  ? Buffer.from(html.body.data,  'base64').toString('utf8') : '';
    if (plainText || htmlText) return { plainText, htmlText };
    for (const p of part.parts) {
      const r = getRawContent(p);
      if (r.plainText || r.htmlText) return r;
    }
  }
  return { plainText: '', htmlText: '' };
}

// ── Header helper ─────────────────────────────────────────────────────────

function extractHeader(headers, name) {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

// ── Main fetch ────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {string} [opts.startDate]  YYYY-MM-DD — Gmail after: filter (inclusive)
 * @param {string} [opts.endDate]    YYYY-MM-DD — Gmail before: filter (exclusive)
 * Defaults to last 7 days if not provided.
 */
async function fetchEmails({ startDate, endDate } = {}) {
  const oauth2Client = createOAuth2Client();
  if (!loadToken(oauth2Client)) {
    console.error('No token.json found. Run `npm run auth` first.');
    process.exit(1);
  }

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Default: last 7 days — use LOCAL date strings so PDT/PST is respected.
  function localDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  if (!startDate) {
    const d = new Date(); d.setDate(d.getDate() - 7);
    startDate = localDateStr(d);
  }
  if (!endDate) {
    endDate = localDateStr(new Date());
  }

  // Gmail's before: operator is EXCLUSIVE (stops at midnight at the START of that day).
  // To include all emails on endDate, advance the query boundary by +1 day.
  // Parsing as 'T00:00:00' (no timezone suffix) uses LOCAL time, keeping PDT/PST aligned.
  const endExclusive = new Date(endDate + 'T00:00:00')
  endExclusive.setDate(endExclusive.getDate() + 1)
  const beforeStr = [
    endExclusive.getFullYear(),
    String(endExclusive.getMonth() + 1).padStart(2, '0'),
    String(endExclusive.getDate()).padStart(2, '0'),
  ].join('/')

  // after: is inclusive of its date, so startDate needs no adjustment.
  const afterStr = startDate.replace(/-/g, '/')
  const query    = `in:inbox after:${afterStr} before:${beforeStr}`
  console.log(`Fetching inbox emails: ${query} (user window: ${startDate} → ${endDate})`);

  // Paginate through all results in the date window
  let pageToken;
  const allMessages = [];
  do {
    const res = await gmail.users.messages.list({
      userId: 'me', q: query, maxResults: 500,
      ...(pageToken ? { pageToken } : {}),
    });
    allMessages.push(...(res.data.messages ?? []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  console.log(`Fetching full content for ${allMessages.length} inbox emails...`);

  const emails = await Promise.all(
    allMessages.map(async (msg) => {
      const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
      const { payload, threadId, internalDate } = full.data;
      const headers  = payload?.headers ?? [];
      const subject  = extractHeader(headers, 'subject');
      const sender   = extractHeader(headers, 'from');
      const date     = new Date(parseInt(internalDate)).toISOString().split('T')[0];

      const { plainText, htmlText } = getRawContent(payload);

      // Always run through full cleaning pipeline regardless of MIME source.
      // Some senders (e.g. Robinhood) put raw HTML in their text/plain part.
      const rawSource = plainText || htmlText;
      const cleaned   = cleanEmailBody(rawSource);

      // Trim footer before applying the character limit so budget is pure signal
      const { body: trimmed, footerSnippet } = trimEmailFooter(cleaned);

      // Apply 4000-char limit AFTER cleaning + footer removal
      const is_unavailable_content = trimmed.length > 4000;
      const unavailable_reason = is_unavailable_content
        ? `${trimmed.length.toLocaleString()} chars after cleaning — truncated to 4,000`
        : null;
      let body = trimmed.slice(0, 4000);

      // OCR fallback for image-heavy emails.
      // Measure readable text only — strip URL portions from markdown links like [text](url)
      // so that URL characters don't inflate the count and mask truly image-only emails.
      const readableLength = body.replace(/\([^)]*\)/g, '').trim().length;
      const imgCount = (htmlText?.match(/<img\b/gi) ?? []).length;
      const htmlLen  = htmlText?.length ?? 0;
      const is_image_heavy =
        (imgCount >= 3 && readableLength < 400) ||   // many images, sparse text
        (htmlLen > 2000 && readableLength < 200) ||   // bloated HTML, almost no text (e.g. Parks Project)
        (readableLength < 50);                        // extreme fallback: near-zero content

      if (is_image_heavy) {
        const metadata = extractImageMetadata(htmlText);
        body = `[IMAGE-HEAVY EMAIL — only ${readableLength} chars of readable text extracted. `
          + (metadata ? `Extracted visual metadata: ${metadata}. ` : `No alt-text or headings found. `)
          + `Classify using subject and sender. Subject: "${subject}" | From: "${sender}"]`;
      }

      return {
        id: msg.id, threadId, subject, sender, date, body,
        is_image_heavy,
        is_unavailable_content,
        unavailable_reason,
        footer_detected: !!footerSnippet,
        footer_snippet: footerSnippet ?? null,
      };
    })
  );

  const dateRange = { start: startDate, end: endDate };
  fs.writeFileSync(RAW_PATH, JSON.stringify(emails, null, 2));
  const unavailCount = emails.filter((e) => e.is_unavailable_content).length;
  const imageCount   = emails.filter((e) => e.is_image_heavy).length;
  const footerCount  = emails.filter((e) => e.footer_detected).length;
  console.log(`✓ Saved ${emails.length} emails to raw_emails.json`);
  if (footerCount)   console.log(`  ↳ ${footerCount} footer(s) detected and trimmed`);
  if (unavailCount)  console.log(`  ↳ ${unavailCount} email(s) with unavailable content (body > 4,000 chars)`);
  if (imageCount)    console.log(`  ↳ ${imageCount} image-heavy email(s) — metadata injected`);
  console.log('');
  return { emails, dateRange };
}

// Run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fetchEmails().catch((err) => { console.error('Fetch error:', err.message); process.exit(1); });
}

export { fetchEmails, cleanEmailBody, trimEmailFooter };
