import { useState } from 'react';
import { Link } from 'react-router-dom';
import playClick from '../utils/sounds';

// ---------------------------------------------------------------------------
// Reset password page. Uses the exact same background stack as every other
// page (body + site-wide AnimatedBackground + MouseGlow in App.jsx) — no
// page-local background layers, so there are no seams or boxed artifacts.
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!EMAIL_RE.test(email.trim().toLowerCase())) {
      setError('Enter a valid email address');
      return;
    }
    setLoading(true);
    playClick();
    // TODO: wire to POST /api/auth/forgot-password once email sending exists
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    setSuccess(true);
  };

  return (
    <div className="fh-auth-wrap">
      <div className="fh-auth-top">
        <h1>Welcome to Focus Himd</h1>
        <p>Reclaim your attention and peak flow.</p>
      </div>

      <div className="fh-card">
        {success ? (
          <div className="fh-center">
            <div className="fh-check">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h1 className="fh-verify-title">Check your email</h1>
            <p className="fh-verify-sub">
              If an account exists for <strong>{email.trim().toLowerCase()}</strong>, you&apos;ll receive a reset link shortly.
            </p>
            <div className="fh-back-row">
              <Link className="fh-edit" to="/login" onClick={playClick}>Back to login</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <h1 className="fh-verify-title">Reset password</h1>
            <p className="fh-verify-sub">Enter your email and we&apos;ll send you a reset link.</p>

            {error && <div className="fh-error" role="alert">{error}</div>}

            <label className="fh-label" htmlFor="fp-email">Email</label>
            <input id="fp-email" className="fh-input" type="email"
              placeholder="name@work.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" disabled={loading} required />

            <button type="submit" className="fh-submit" disabled={loading}>
              <span>{loading ? 'Sending…' : 'Send reset link'}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </button>

            <div className="fh-back-row">
              <Link className="fh-edit" to="/login" onClick={playClick}>Back to login</Link>
            </div>
          </form>
        )}
      </div>

      <div className="fh-status"><span className="fh-dot" /> All systems operational</div>
      <div className="fh-foot">
        <span>Privacy</span><span>Terms</span><span>Security</span>
      </div>
    </div>
  );
};

export default ForgotPassword;
