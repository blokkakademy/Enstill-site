// enStill — form-submission email relay
// Receives Netlify's "outgoing webhook" for form submissions and sends:
//   1) an internal notification to hello@enstill.life with a per-form subject line
//      (all four forms)
//   2) Organizations: a confirmation email to the submitter with the
//      corporate one-pager + buyer/procurement FAQ attached
//   3) Athlete Support: a text-only confirmation email to the submitter —
//      no attachment, no overview promise. The overview PDF is sent manually
//      by Blokk after personally reviewing the inquiry and confirming fit —
//      that send stays human-initiated, not automated.
const crypto = require('crypto');

const SUBJECTS = {
  'intronaut-series': '[enStill] Intronaut Series inquiry',
  'private-work':     '[enStill] Private Work inquiry',
  'organizations':    '[enStill] Corporate inquiry',
  'athlete-support':  '[enStill] Athlete Support inquiry',
};

const TO = 'hello@enstill.life';
const FROM = process.env.NOTIFY_FROM || 'enStill forms <forms@enstill.life>';
const CONFIRM_FROM = process.env.CONFIRM_FROM || 'enStill <hello@enstill.life>';

const ORG_ATTACHMENT_BASE =
  process.env.ORG_ATTACHMENT_BASE_URL || 'https://enstill.netlify.app/assets';
const ORG_ATTACHMENTS = [
  { filename: 'enStill_Steadiness_at_Work_One-Pager.docx', path: `${ORG_ATTACHMENT_BASE}/enStill_Steadiness_at_Work_One-Pager_1.docx` },
  { filename: 'enStill_Buyer_Procurement_FAQ.docx',        path: `${ORG_ATTACHMENT_BASE}/enStill_Buyer_Procurement_FAQ_2.docx` },
];

const ORG_CONFIRMATION_TEXT =
  "Thank you for your interest in enStill's Corporate Workforce practice.\n\n" +
  "Attached are the two documents you requested: the Steadiness at Work overview " +
  "and the Buyer & Procurement FAQ.\n\n" +
  "If it looks like a fit, the next step is a brief scoping conversation about " +
  "your setting — just reply to this email at your convenience.\n\n" +
  '— enStill · enstill.life · hello@enstill.life';

const ATHLETE_CONFIRMATION_TEXT =
  "Thank you.\n\n" +
  "Your request has been received. If there appears to be a fit, the next step " +
  "is a brief, discreet conversation to clarify context and the right next step.\n\n" +
  '— enStill · enstill.life · hello@enstill.life';

function verifySignature(token, secret, rawBody) {
  if (!token || !secret) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [header, payload, sig] = parts;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (claims.iss !== 'netlify') return false;
    if (claims.sha256) {
      const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
      if (claims.sha256 !== bodyHash) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function sendViaResend(payload) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend ${res.status}: ${detail}`);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const rawBody = event.body || '';
  const token =
    event.headers['x-webhook-signature'] || event.headers['X-Webhook-Signature'];

  const secret = process.env.NETLIFY_WEBHOOK_SECRET;
  if (secret && !verifySignature(token, secret, rawBody)) {
    return { statusCode: 401, body: 'Invalid signature' };
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, body: 'Bad JSON' };
  }

  const formName = payload.form_name || 'unknown';
  const subject = SUBJECTS[formName] || `[enStill] ${formName} inquiry`;

  const data = payload.data || {};
  const skip = new Set(['bot-field', 'ip', 'user_agent', 'referrer']);
  const lines = Object.entries(data)
    .filter(([k, v]) => !skip.has(k) && v !== '' && v != null)
    .map(([k, v]) => `${k}: ${v}`);

  const submitterEmail = data.email || data['work-email'] || undefined;

  const internalText =
    `New submission — ${formName}\n\n` +
    `${lines.join('\n')}\n\n` +
    `Submitted: ${payload.created_at || ''}`;

  try {
    // 1) Internal notification — every form
    await sendViaResend({
      from: FROM,
      to: [TO],
      subject,
      text: internalText,
      ...(submitterEmail ? { reply_to: submitterEmail } : {}),
    });

    // 2) Organizations only — auto-send the one-pager + FAQ to the submitter
    if (formName === 'organizations' && submitterEmail) {
      await sendViaResend({
        from: CONFIRM_FROM,
        to: [submitterEmail],
        subject: SUBJECTS['organizations'],
        text: ORG_CONFIRMATION_TEXT,
        attachments: ORG_ATTACHMENTS,
      });
    }

    // 3) Athlete Support — text-only confirmation to the submitter, no attachment.
    // The overview PDF is sent manually by Blokk after reviewing fit — that send
    // stays human-initiated, not automated.
    if (formName === 'athlete-support' && submitterEmail) {
      await sendViaResend({
        from: CONFIRM_FROM,
        to: [submitterEmail],
        subject: SUBJECTS['athlete-support'],
        text: ATHLETE_CONFIRMATION_TEXT,
      });
    }
  } catch (err) {
    console.error('form-email send failed:', err.message);
    return { statusCode: 500, body: 'Email send failed' };
  }

  return { statusCode: 200, body: 'ok' };
};
