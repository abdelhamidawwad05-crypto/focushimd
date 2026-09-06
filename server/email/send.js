// ---------------------------------------------------------------------------
// Brevo transactional email sender.
//
// Sends transactional mail to the user's inbox through Brevo's HTTPS API.
// The API key lives ONLY in the BREVO_API_KEY env var
// (server-side). Nothing here ever prints the key or the verification code.
// ---------------------------------------------------------------------------

const SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Focus Himd';
// Optional sender override. If focushimd.site is verified as a sender domain
// on Brevo, this reads as "Focus Himd <noreply@focushimd.site>". Otherwise
// set BREVO_SENDER_EMAIL to a sender email/delivery address added in your
// Brevo account (their default sending domain) until yours is verified.
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'noreply@focushimd.site';

async function sendTransactionalEmail({ to, subject, htmlContent }) {
  if (!process.env.BREVO_API_KEY) throw new Error('BREVO_API_KEY is not configured');
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15000);
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent,
      }),
      signal: ctrl.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = body.message || body.code || `HTTP ${response.status}`;
      const error = new Error(`Brevo send failed [HTTP ${response.status}]: ${message}`);
      error.status = response.status;
      throw error;
    }
    return body.messageId || '';
  } finally {
    clearTimeout(timeout);
  }
}

// Straightforward, readable HTML — works in standard email clients.
function verificationHtml(code) {
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e4e4e7;">
      <div style="font-size:18px;font-weight:700;color:#18181b;margin-bottom:4px;">Focus Himd</div>
      <div style="font-size:13px;color:#71717a;margin-bottom:24px;">Reclaim your attention and peak flow.</div>

      <div style="font-size:15px;color:#3f3f46;line-height:1.5;">Your verification code is:</div>

      <div style="font-size:40px;font-weight:700;letter-spacing:10px;color:#18181b;text-align:center;
                  background:#fafafa;border:1px dashed #d4d4d8;border-radius:10px;margin:16px 0;padding:18px 0;">
        ${code}
      </div>

      <p style="font-size:14px;color:#3f3f46;line-height:1.6;margin:0 0 6px;">
        Enter this code on the Focus Himd website to verify your email address. It expires in
        <strong>10 minutes</strong>.
      </p>
      <p style="font-size:13px;color:#71717a;line-height:1.5;margin:0 0 20px;">
        If you didn't request this code, you can safely ignore this email.
      </p>

      <div style="border-top:1px solid #e4e4e7;padding-top:16px;font-size:12px;color:#a1a1aa;">
        &copy; Focus Himd &middot; This is an automated email, please do not reply.</div>
    </div>
    <div style="text-align:center;font-size:12px;color:#a1a1aa;margin-top:16px;">
      This is an automated message sent by Focus Himd.
    </div>
  </div>
</body>
</html>`;
}

function passwordResetHtml(resetUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e4e4e7;">
      <div style="font-size:18px;font-weight:700;color:#18181b;margin-bottom:4px;">Focus Himd</div>
      <div style="font-size:13px;color:#71717a;margin-bottom:24px;">Reclaim your attention and peak flow.</div>
      <p style="font-size:15px;color:#3f3f46;line-height:1.5;">We received a request to reset your password.</p>
      <p style="text-align:center;margin:26px 0 24px;"><a href="${resetUrl}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;border-radius:8px;padding:14px 24px;font-size:15px;font-weight:700;">Reset your password</a></p>
      <p style="font-size:14px;color:#3f3f46;line-height:1.6;margin:0 0 6px;">This link expires in <strong>45 minutes</strong> and can only be used once.</p>
      <p style="font-size:13px;color:#71717a;line-height:1.5;margin:0 0 20px;">If you did not request this, you can safely ignore this email.</p>
      <div style="border-top:1px solid #e4e4e7;padding-top:16px;font-size:12px;color:#a1a1aa;">&copy; Focus Himd &middot; This is an automated email, please do not reply.</div>
    </div>
  </div>
</body>
</html>`;
}

// Sends the code email. Resolves with Brevo's messageId on success (logged so
// every send is provable in the server logs). Throws on failure so the caller
// can surface a real error to the frontend (never a fake "check your email").
async function sendVerificationEmail({ to, code }) {
  try {
    const messageId = await sendTransactionalEmail({
      to,
      subject: 'Your Focus Himd verification code',
      htmlContent: verificationHtml(code),
    });
    if (!messageId) {
      console.log(`[email] verification email accepted by Brevo for ${to} (no messageId returned)`);
      return messageId;
    }
    // Proof of send: recipient + Brevo messageId. Never the code, never the key.
    console.log(`[email] verification email accepted by Brevo for ${to} (messageId=${messageId})`);
    // Brevo can ACCEPT the API call (HTTP 201) yet still fail the delivery a
    // moment later (e.g. invalid sender → event=error). Confirm no hard
    // failure was recorded for this message before reporting success.
    await confirmNoDeliveryError(messageId, to);
    return messageId;
  } catch (err) {
    // Extract a useful reason (status + message) for the server log. We never
    // log the API key and never log the verification code.
    let reason = err && err.message ? err.message : 'unknown error';
    const status = err && err.status;
    const body = err && err.response && err.response.body;
    const bodyMsg = body && (body.message || (body.code ? `code=${body.code}` : ''));
    if (bodyMsg) reason = `${reason} (${bodyMsg})`;
    const e = new Error(`Brevo send failed${status ? ` [HTTP ${status}]` : ''}: ${reason}`);
    throw e;
  }
}

async function sendPasswordResetEmail({ to, token }) {
  const appUrl = (process.env.APP_URL || 'https://focushimd.site').trim().replace(/\/$/, '');
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  try {
    const messageId = await sendTransactionalEmail({
      to,
      subject: 'Reset your Focus Himd password',
      htmlContent: passwordResetHtml(resetUrl),
    });
    console.log(`[email] password reset email accepted by Brevo for ${to}${messageId ? ` (messageId=${messageId})` : ''}`);
    if (messageId) await confirmNoDeliveryError(messageId, to);
    return messageId;
  } catch (err) {
    let reason = err && err.message ? err.message : 'unknown error';
    const status = err && err.status;
    const body = err && err.response && err.response.body;
    const bodyMsg = body && (body.message || (body.code ? `code=${body.code}` : ''));
    if (bodyMsg) reason = `${reason} (${bodyMsg})`;
    throw new Error(`Brevo send failed${status ? ` [HTTP ${status}]` : ''}: ${reason}`);
  }
}

// After Brevo accepts a send, poll its event log for this messageId and fail
// fast if a hard delivery failure (error/blocked) is recorded. Hard failures
// (e.g. invalid sender) are indexed within the same second, so one immediate
// check plus one retry catches them; anything else fails open (the send was
// accepted, and the messageId in the log above keeps it traceable) so a
// successful signup never waits on Brevo event indexing.
async function confirmNoDeliveryError(messageId, to) {
  const url = `https://api.brevo.com/v3/smtp/statistics/events?messageId=${encodeURIComponent(messageId)}&limit=10&offset=0`;
  const FAIL = new Set(['error', 'blocked']);
  for (let attempt = 1; attempt <= 2; attempt++) {
    let events = null;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(url, { headers: { 'api-key': process.env.BREVO_API_KEY, Accept: 'application/json' }, signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        events = Array.isArray(body.events) ? body.events : [];
      }
    } catch (_) {
      events = null; // monitoring call failed — fail open, keep the 201 path
    }
    if (events && events.length) {
      const bad = events.find((e) => e && FAIL.has(e.event));
      if (bad) {
        const reason = bad.reason || `event=${bad.event}`;
        throw new Error(`Brevo recorded a delivery failure for ${to}: ${reason}`);
      }
      return; // request logged, no failure — accepted for delivery
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 1200));
  }
  console.log(`[email] delivery confirmation timed out for ${to} (messageId=${messageId}); send was accepted`);
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
