// enStill — form-submission email relay
// Receives Netlify's "outgoing webhook" for form submissions and sends:
//   1) an internal notification to hello@enstill.life with a per-form subject line
//   2) for athlete-support only: a confirmation email to the submitter with the
//      enStill Athlete Support Overview PDF attached
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
const ATHLETE_OVERVIEW_URL =
  process.env.ATHLETE_OVERVIEW_URL ||
  'https://enstill.netlify.app/assets/enStill_Athlete_Support_Overview.pdf';

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

    // 2) Athlete Support only — confirmation to the submitter with the overview attached
    if (formName === 'athlete-support' && submitterEmail) {
      await sendViaResend({
        from: CONFIRM_FROM,
        to: [submitterEmail],
        subject: SUBJECTS['athlete-support'],
        text:
          "Thank you. Your request has been received. You'll receive the overview " +
          'along with a note to arrange a brief, discreet conversation.\n\n' +
          'The enStill Athlete Support overview is attached.\n\n' +
          '— enStill · enstill.life · hello@enstill.life',
        attachments: [
          {
            filename: 'enStill_Athlete_Support_Overview.pdf',
            path: ATHLETE_OVERVIEW_URL,
          },
        ],
      });
    }
  } catch (err) {
    console.error('form-email send failed:', err.message);
    return { statusCode: 500, body: 'Email send failed' };
  }

  return { statusCode: 200, body: 'ok' };
};
