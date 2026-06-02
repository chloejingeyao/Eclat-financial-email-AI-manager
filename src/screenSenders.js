/**
 * screenSenders.js — Agent 1: sender/subject pre-filter.
 *
 * Two-stage pipeline:
 *   1. User exclusions  — deterministic, no LLM cost
 *   2. LLM screener     — subject-intent classification on remaining emails
 *
 * Returns { eligible, screenedOut, usedFallback }
 *   eligible    — emails to pass to Agent 2 (full content analysis)
 *   screenedOut — emails removed, each with screen_reason + user_excluded flag
 *   usedFallback — true if the LLM call failed and all emails were passed through
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

async function callLLM(modelConfig, systemPrompt, userMessage) {
  const { provider = 'gemini', apiKey } = modelConfig ?? {};
  if (provider === 'claude') {
    const client = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
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

const SCREEN_PROMPT = `You are a pre-filter for a financial email classifier. Your only job is to decide
whether an email is WORTH READING based on its sender name and subject line alone.

You are NOT classifying the email. You are deciding if it should be passed to a
deeper analysis stage.

PASS an email if its subject line suggests it could plausibly contain:
- A promotion, discount, sale, or exclusive offer
- A reward, cashback, points, or referral bonus
- A subscription renewal, trial expiration, or upcoming charge
- A billing notice, invoice, or price change
- Any other future financial action the user may need to take

REJECT an email only when the subject makes financial content IMPOSSIBLE.
Clear examples of rejection:
- Developer activity: "PR merged", "Build failed", "Deployment complete", "New comment on your issue"
- Delivery updates: "Your package has been delivered", "Out for delivery"
- Meeting / calendar: "Invitation: standup", "Your meeting starts in 10 minutes"
- Social activity: "X liked your post", "You have 3 new connections"
- Transactional receipts with no future action: "Your order is confirmed", "Booking confirmed"
- Security / account alerts: "New sign-in to your account", "Password changed successfully"

CRITICAL RULES:
- Never reject based on sender identity alone. GitHub, GCP, FedEx, or any platform
  can send both noise AND financial emails — judge by subject only.
- When in doubt, PASS. A false negative (missing a real signal) is worse than a
  false positive (passing a non-financial email to the next stage).
- Treat every sender as capable of sending subscription or billing emails.

Return ONLY a JSON array. No markdown, no explanation.

Required fields per email:
- id: the email's id string (copy exactly)
- pass: true or false
- reason: one short phrase explaining the decision (e.g. "subscription renewal",
  "build notification", "unclear — passing through")`;

export async function screenSenders(emails, { excludedSenders = [], modelConfig } = {}) {
  // ── Stage 1: User exclusions (deterministic, free) ────────────────────────
  const userExcluded = [];
  const remaining    = [];

  for (const email of emails) {
    const senderStr = (email.sender || '').toLowerCase();
    const matched   = excludedSenders.find(ex => senderStr.includes(ex.toLowerCase()));
    if (matched) {
      userExcluded.push({
        id:            email.id,
        threadId:      email.threadId,
        subject:       email.subject,
        sender:        email.sender,
        date:          email.date,
        screen_reason: `Excluded by user (matched "${matched}")`,
        user_excluded: true,
      });
    } else {
      remaining.push(email);
    }
  }

  if (remaining.length === 0) {
    console.log(`  ↳ All ${emails.length} emails excluded by user settings — skipping Agent 1`);
    return { eligible: [], screenedOut: userExcluded, usedFallback: false };
  }

  // ── Stage 2: LLM subject-intent screen ───────────────────────────────────
  try {
    const input = remaining.map(e => ({
      id:      e.id,
      sender:  e.sender,
      subject: e.subject,
    }));

    const userMessage =
      `Screen the following ${remaining.length} emails. Return a JSON array with one entry per email.\n\n` +
      JSON.stringify(input, null, 2);

    const rawOutput = (await callLLM(modelConfig, SCREEN_PROMPT, userMessage)).trim();

    let screenResults;
    try {
      screenResults = JSON.parse(rawOutput);
    } catch {
      const cleaned = rawOutput.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      screenResults = JSON.parse(cleaned);
    }

    if (!Array.isArray(screenResults)) throw new Error('Agent 1 returned non-array response');

    const resultMap = new Map(screenResults.map(r => [r.id, r]));

    const eligible     = [];
    const agentScreened = [];

    for (const email of remaining) {
      const r = resultMap.get(email.id);
      if (!r || r.pass !== false) {
        eligible.push(email);
      } else {
        agentScreened.push({
          id:            email.id,
          threadId:      email.threadId,
          subject:       email.subject,
          sender:        email.sender,
          date:          email.date,
          screen_reason: r.reason || 'Screened by sender filter',
          user_excluded: false,
        });
      }
    }

    console.log(
      `Agent 1 complete — ${eligible.length} eligible, ` +
      `${agentScreened.length} screened out, ${userExcluded.length} user-excluded`
    );

    return {
      eligible,
      screenedOut: [...userExcluded, ...agentScreened],
      usedFallback: false,
    };
  } catch (err) {
    console.warn(`Agent 1 (sender screener) failed — falling back to full scan: ${err.message}`);
    return {
      eligible:     remaining,
      screenedOut:  userExcluded,
      usedFallback: true,
    };
  }
}
