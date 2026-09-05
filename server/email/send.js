// ---------------------------------------------------------------------------
// Brevo transactional email sender.
//
// Sends the 6-digit verification code to the user's inbox via Brevo's
// official Node.js SDK. The API key lives ONLY in the BREVO_API_KEY env var
// (server-side). Nothing here ever prints the key or the verification code.
// ---------------------------------------------------------------------------

const SibApiV3Sdk = require('sib-api-v3-sdk');

const SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Focus Himd';
// Optional sender override. If focushimd.site is verified as a sender domain
// on Brevo, this reads as "Focus Himd <noreply@focushimd.site>". Otherwise
// set BREVO_SENDER_EMAIL to a sender email/delivery address added in your
// Brevo account (their default sending domain) until yours is verified.
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'noreply@focushimd.site';

function api() {
  const client = SibApiV3Sdk.ApiClient.instance;
  const auth = client.authentications['api-key'];
  auth.apiKey = process.env.BREVO_API_KEY;
  return new SibApiV3Sdk.TransactionalEmailsApi();
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

// Sends the code email. Resolves with Brevo's messageId on success (logged so
// every send is provable in the server logs). Throws on failure so the caller
// can surface a real error to the frontend (never a fake "check your email").
async function sendVerificationEmail({ to, code }) {
  const apiInstance = api();
  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.sender = { name: SENDER_NAME, email: SENDER_EMAIL };
  sendSmtpEmail.to = [{ email: to }];
  sendSmtpEmail.subject = 'Your Focus Himd verification code';
  sendSmtpEmail.htmlContent = verificationHtml(code);

  try {
    // NOTE: sendTransacEmail resolves with the CreateSmtpEmail model itself
    // (it has .messageId), NOT with a {data, response} wrapper.
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    const messageId = (result && result.messageId) || '';
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

module.exports = { sendVerificationEmail };
