/**
 * analyzeEmails.js — Send sanitized emails to Gemini for financial signal detection.
 * Reads raw_emails.json, writes processed_emails.json.
 * Now also writes scan_results: all 50 emails flagged classified/not-classified.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

async function callLLM(modelConfig, systemPrompt, userMessage) {
  const { provider = 'gemini', apiKey } = modelConfig ?? {};
  if (provider === 'claude') {
    const client = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    return msg.content[0]?.type === 'text' ? msg.content[0].text : '';
  }
  const genAI = new GoogleGenerativeAI(apiKey || process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
  });
  const result = await model.generateContent(userMessage);
  return result.response.text();
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_PATH    = path.join(__dirname, '..', 'raw_emails.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'processed_emails.json');

const SYSTEM_PROMPT = `ROLE & SCOPE GUARDRAILS
You are a high-precision Financial Signal Classifier. Your goal is to identify emails that affect the user's Expenses, Savings, or Assets.

ANALYSIS DIMENSIONS
Body: PRIMARY source. Look for the actual offer, action item, or date.
Sender & Subject: Contextual hints.
The Grounding Rule: Classification must be based SOLELY on explicit text in the email body. You are strictly forbidden from inferring, guessing, or supplementing financial details (dates, amounts, percentages) not present in the provided text. If an email is "vague" but lacks specific financial data, SKIP it.

CORE DOMAIN DEFINITION
Classify only if the email impacts the user's Consumer Spending, Recurring Liabilities, or Asset Yield.
Focus: "Money leaving the pocket" (Expenses) and "Incentives for keeping money" (Rewards/Interest).
The "Labor" Boundary (Root Cause Fix): Exclude any financial figures that represent Compensation for Labor or Time. Whether it is a salary, a project fee, or a bonus for work, it belongs to the "Earnings" domain and is strictly Out-of-Scope.

SETTLED EVENT FILTER - apply this before anything else.
A financial event is settled when the user has already made the decision and the money or status change is committed. Settled emails require no further action and must be skipped entirely. Examples of settled events:
- Order confirmations, receipts, delivery notifications ("your order is ready", "your tickets are ready")
- Booking confirmations ("thanks for booking", "your reservation is confirmed")
- Payment confirmations ("thanks for your payment", "your payment was processed", "your statement is available")
- Cancellation confirmations ("your membership has been canceled", "your subscription was canceled", "your xxx will be canceled/downgraded"), as the user already acted; the change already occurred
If the email is reporting on something that already happened, SKIP it. Only proceed if the email is about something that has NOT yet happened.

THE THREE-WAY TRANSACTIONAL GATE
Evaluate the Relationship and Flow before assigning a category:
Relationship Direction:
Is the sender an entity the user pays (or could pay) for a product, service, or space? (e.g., Retailers, Landlords, Subscription, Utilities). -> PROCEED
Nature of the Value:
Cost: Does it reduce the MSRP or the bill of a service? (e.g., $ off, % off a purchase, renewal). -> PROCEED
Asset Optimization: Does it increase the value of money already held? (e.g., Interest rates, Cash back). -> PROCEED
Actionability:
Does it contain an action for the user to take, such as a deadline (e.g. cancel), a claimable monetary benefit (e.g. redeem, upgrade, purchase)? If yes -> proceed | If no -> Skip
Note: "Keep an eye on your usage" or "monitor your account" are NOT actions — they are advisories. An action requires a specific step the user can take that has a direct FINANCIAL consequence.

IMAGE-HEAVY EMAILS — if the body starts with "[IMAGE-HEAVY EMAIL", the email's content is primarily visual. Rely on the Sender and Subject as primary signals, and treat any extracted metadata as supporting evidence.

FORWARDED EMAILS — if the subject starts with "Fwd:" or the body contains forwarding headers (e.g. "---------- Forwarded message ---------"), the actual sender is the original merchant inside the body, NOT the person who forwarded it. Ignore the forwarder's identity entirely. Evaluate the email based on the original merchant's content found in the body.

CATEGORY DEFINITIONS

"Merchant Promotions"
Logic: A reduction in the cost of a consumer purchase or service.
Scope: Includes any entity selling products or providing any kinds of paid services.
Threshold: Does the email offer a specific advantage (lower price, earlier access, or exclusive availability) that is contingently unlocked only if the user performs a purchase-related action (e.g., buying, booking, or subscribing)? If YES, proceed. If NO, skip.
Example:
Discounts, promo codes, or exclusive access to lower pricing
Monetary: specific % off, $ off, BOGO, or unique promotions
Early access to sales (loyalty/VIP), exclusive product drops, member-only windows, and cart abandonment recovery offers (often with hidden discounts or free shipping) should also be considered

"Financial Rewards & Perks"
Logic: Incentives that provide a "Rebate" or "Yield" on existing assets or spending.
Threshold: Does the offer provide an incremental return, rebate, or financial gain (e.g., cashback, points multiplier, or deposit match) triggered by a financial maneuver (e.g., depositing, referring, or using a specific payment instrument)? If YES, proceed. If NO, skip.
Example:
Credit card bonus categories (e.g. 5x points on groceries this quarter)
Cash back activations, merchant-linked offers (Amex Offers, Chase Offers)
Fintech incentives: deposit matches, transfer bonuses (e.g. Robinhood Gold IRA 3% match), referral cash, interest rate promotions

"Subscription & Status Management"
Logic:
The Existing Relationship Rule: ONLY classify here if the email is clearly addressed to someone who already has an active trial, subscription, or account with the sender.
Timing matters — a payment confirmation ("thanks for your payment", "your $X payment was processed") signals that a subscription is healthy and nothing is at risk. There is no decision left to make. Only classify subscription-related emails that point to a FUTURE state the user needs to be aware of: an upcoming charge, an ending trial, a price that is about to change.
Threshold: Does the email identify a future-dated change (e.g., an upcoming charge, trial expiration, or price hike) that will occur automatically and result in a financial or status loss unless the user intervenes? If YES, proceed. If NO, skip.
Skip examples: a payment receipt, a cancellation confirmation (user already acted — no further intervention possible), a usage warning that does not explicitly state an automatic charge or service downgrade will occur.
Example:
Your subscription is about to renew
Your trial is ending
Price hike notices

Any email that does not clearly fit one of these three categories must be ignored entirely.

For each qualifying email, respond with a JSON object inside a JSON array. Return ONLY valid JSON — no markdown, no explanation, no extra text.

Required fields per email:
- id: the email's id string (copy exactly from input)
- threadId: the email's threadId string (copy exactly from input)
- emergent_category: one of the three category names above (exact string match)
- perk_value: a short, punchy value statement — the "so what" in 2–5 words (e.g. "20% Off", "$50 IRA Match", "Trial Ends Tomorrow", "VIP Early Access")
- deadline: expiration or action date in YYYY-MM-DD format, or null if none found
- reasoning: 1-2 sentences explaining why this email provides actionable financial value
- confidence_score: a float from 0.0 to 1.0 reflecting your certainty

Example output format:
[
  {
    "id": "abc123",
    "threadId": "thread456",
    "emergent_category": "Merchant Promotions",
    "perk_value": "30% Off Sitewide",
    "deadline": "2024-11-10",
    "reasoning": "Email contains a limited-time promotional discount code with a clear expiration date.",
    "confidence_score": 0.97
  }
]

If no emails qualify, return an empty array: []`;

/**
 * Core batched analysis — processes emails in chunks of BATCH_SIZE.
 * Does NOT read/write files; callers handle persistence.
 *
 * @param {object[]} emails       — pre-loaded email objects
 * @param {object}   opts
 * @param {Function} opts.onBatch — async callback after each batch: ({ batchIndex, totalBatches, batchEnriched, batchScanResults })
 * @param {object}   [opts.dateRange]
 * @param {string}   [opts.scannedAt]  — ISO timestamp; defaults to now
 */
async function analyzeEmailsBatched(emails, { onBatch, dateRange, scannedAt, modelConfig } = {}) {
  const BATCH_SIZE = 20;
  const _scannedAt = scannedAt ?? new Date().toISOString();
  const totalBatches = Math.ceil(emails.length / BATCH_SIZE);
  const providerLabel = (modelConfig?.provider === 'claude') ? 'Claude Haiku' : 'Gemini';

  console.log(`Analyzing ${emails.length} emails with ${providerLabel} (${totalBatches} batch${totalBatches !== 1 ? 'es' : ''} of ${BATCH_SIZE}, parallel)...`);

  const allEnriched    = [];
  const allScanResults = [];
  let   batchErrors    = 0;
  let   emailsDone     = 0;
  let   classifiedSoFar = 0;

  // Build chunks upfront so batchIndex is stable across parallel runs
  const chunks = [];
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    chunks.push(emails.slice(i, i + BATCH_SIZE));
  }

  // Run all batches concurrently — same token cost, latency = max(batch) not sum(batches)
  await Promise.all(chunks.map(async (chunk, idx) => {
    const batchIndex = idx + 1;
    console.log(`  → Batch ${batchIndex}/${totalBatches} (${chunk.length} emails)...`);

    const fallbackScanResults = chunk.map((raw) => ({
      id:                     raw.id,
      threadId:               raw.threadId,
      subject:                raw.subject,
      sender:                 raw.sender,
      date:                   raw.date,
      body:                   raw.body,
      classified:             false,
      batch_failed:           true,
      is_image_heavy:         raw.is_image_heavy         ?? false,
      is_unavailable_content: raw.is_unavailable_content ?? false,
      unavailable_reason:     raw.unavailable_reason     ?? null,
      footer_detected:        raw.footer_detected        ?? false,
    }));

    try {
      const emailsText = chunk.map((e, j) =>
        `--- EMAIL ${j + 1} ---
id: ${e.id}
threadId: ${e.threadId}
Subject: ${e.subject}
From: ${e.sender}
Date: ${e.date}
Body:
${e.body}
`
      ).join('\n');

      const userMessage = `Analyze the following ${chunk.length} emails. Return only a JSON array of the ones with financial value. Ignore all others.\n\n${emailsText}`;

      const rawOutput = (await callLLM(modelConfig, SYSTEM_PROMPT, userMessage)).trim();

      let batchResults;
      try {
        batchResults = JSON.parse(rawOutput);
      } catch {
        const cleaned = rawOutput.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        try {
          batchResults = JSON.parse(cleaned);
        } catch {
          console.warn(`  ⚠ Batch ${batchIndex} response could not be parsed — skipping`);
          batchErrors  += chunk.length;
          emailsDone   += chunk.length;
          allScanResults.push(...fallbackScanResults);
          if (onBatch) await onBatch({ batchIndex, totalBatches, batchEnriched: [], batchScanResults: fallbackScanResults, emailsDone, emailsTotal: emails.length, classifiedSoFar });
          return;
        }
      }
      if (!Array.isArray(batchResults)) batchResults = [];

      const emailMap      = new Map(chunk.map((e) => [e.id, e]));
      const batchEnriched = batchResults
        .filter((r) => emailMap.has(r.id))
        .map((r) => {
          const original = emailMap.get(r.id);
          return {
            ...r,
            perk_value:             r.perk_value ?? r.financial_signal ?? '',
            subject:                original.subject                ?? '',
            sender:                 original.sender                 ?? '',
            date:                   original.date                   ?? '',
            is_image_heavy:         original.is_image_heavy         ?? false,
            is_unavailable_content: original.is_unavailable_content ?? false,
            unavailable_reason:     original.unavailable_reason     ?? null,
            footer_detected:        original.footer_detected        ?? false,
          };
        });

      allEnriched.push(...batchEnriched);

      const classifiedIds    = new Set(batchEnriched.map((e) => e.id));
      const batchScanResults = chunk.map((raw) => {
        if (classifiedIds.has(raw.id)) {
          const signal = batchEnriched.find((e) => e.id === raw.id);
          return { ...raw, classified: true, ...signal };
        }
        return {
          id:                     raw.id,
          threadId:               raw.threadId,
          subject:                raw.subject,
          sender:                 raw.sender,
          date:                   raw.date,
          body:                   raw.body,
          classified:             false,
          is_image_heavy:         raw.is_image_heavy         ?? false,
          is_unavailable_content: raw.is_unavailable_content ?? false,
          unavailable_reason:     raw.unavailable_reason     ?? null,
          footer_detected:        raw.footer_detected        ?? false,
        };
      });

      allScanResults.push(...batchScanResults);
      emailsDone    += chunk.length;
      classifiedSoFar += batchEnriched.length;

      if (onBatch) await onBatch({ batchIndex, totalBatches, batchEnriched, batchScanResults, emailsDone, emailsTotal: emails.length, classifiedSoFar });
    } catch (batchErr) {
      console.warn(`  ⚠ Batch ${batchIndex} failed: ${batchErr.message} — skipping`);
      batchErrors  += chunk.length;
      emailsDone   += chunk.length;
      allScanResults.push(...fallbackScanResults);
      if (onBatch) await onBatch({ batchIndex, totalBatches, batchEnriched: [], batchScanResults: fallbackScanResults, emailsDone, emailsTotal: emails.length, classifiedSoFar });
    }
  }));

  // Sort all classified after all batches are complete
  allEnriched.sort((a, b) => {
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return b.confidence_score - a.confidence_score;
  });

  console.log(`✓ Flagged ${allEnriched.length} emails out of ${emails.length} scanned.`);

  return {
    scanned_at:    _scannedAt,
    ...(dateRange ? { date_range: dateRange } : {}),
    total_scanned: emails.length,
    total_flagged: allEnriched.length,
    batch_errors:  batchErrors,
    emails:        allEnriched,
    scan_results:  allScanResults,
  };
}

/** CLI entry-point: reads raw_emails.json → analyzes → writes processed_emails.json */
async function analyzeEmails({ dateRange } = {}) {
  if (!fs.existsSync(RAW_PATH)) {
    console.error('raw_emails.json not found. Run `npm run fetch` first.');
    process.exit(1);
  }

  const emails = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
  const output = await analyzeEmailsBatched(emails, { dateRange });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`✓ Saved to processed_emails.json\n`);

  return output;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  analyzeEmails().catch((err) => {
    console.error('Analysis error:', err.message);
    process.exit(1);
  });
}

export async function classifySingleEmail(email, modelConfig) {
  const emailText = `--- EMAIL ---
id: ${email.id}
threadId: ${email.threadId}
Subject: ${email.subject}
From: ${email.sender}
Date: ${email.date}
Body:
${email.body}`;

  const raw = (await callLLM(
    modelConfig,
    SYSTEM_PROMPT,
    `Analyze the following single email. Return a JSON array with 0 or 1 elements.\n\n${emailText}`
  )).trim();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    parsed = JSON.parse(cleaned);
  }
  const r = Array.isArray(parsed) ? parsed[0] : null;
  if (!r) return null;
  return {
    ...r,
    perk_value: r.perk_value ?? r.financial_signal ?? '',
  };
}

export { analyzeEmails, analyzeEmailsBatched };
