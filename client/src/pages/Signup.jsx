import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CodeInput from '../components/CodeInput';
import playClick from '../utils/sounds';

// ---------------------------------------------------------------------------
// Signup in two steps on one page:
//  1. Email + password + confirm (match is validated before anything is
//     sent), "Send verification code" creates the real user row + emails the
//     code via POST /api/auth/signup.
//  2. Code entry -> POST /api/auth/verify marks the account verified and the
//     backend sets the session cookie, so the user lands logged in.
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_WAIT = 33;

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
  );
}

const Signup = () => {
  const { signup, verify, resend } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const cleanEmail = email.trim().toLowerCase();

  const handleSend = async (e) => {
    e.preventDefault();
    setError('');
    if (!EMAIL_RE.test(cleanEmail)) { setError('Enter a valid email address'); return; }
    if (!password || password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password.length > 128) { setError('Password is too long'); return; }
    if (new TextEncoder().encode(password).length > 72) { setError('Password must be 72 UTF-8 bytes or fewer'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    playClick();
    try {
      await signup(cleanEmail, password, confirm);
      setStep(2);
      setCooldown(RESEND_WAIT);
    } catch (err) {
      setError(err.message || 'Something went wrong, please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code)) { setError('Enter the 6-digit code'); return; }
    setLoading(true);
    playClick();
    try {
      await verify(cleanEmail, code);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || loading) return;
    setError('');
    playClick();
    try {
      await resend(cleanEmail);
      setCooldown(RESEND_WAIT);
    } catch (err) {
      setError(err.message || 'Could not resend the code');
    }
  }, [cooldown, loading, cleanEmail, resend]);

  return (
    <div className="fh-auth-wrap">
      <div className="fh-auth-top">
        <h1>Welcome to Focus Himd</h1>
        <p>Reclaim your attention and peak flow.</p>
      </div>

      <div className="fh-card">
        {error && <div className="fh-error" role="alert">{error}</div>}

        {step === 1 ? (
          <form onSubmit={handleSend} noValidate>
            <label className="fh-label" htmlFor="su-email">Email</label>
            <input id="su-email" className="fh-input" type="email"
              placeholder="name@work.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" disabled={loading} required />

            <label className="fh-label" htmlFor="su-password">Password</label>
            <div className="fh-pw-wrap">
              <input id="su-password" className="fh-input fh-pw" type={showPw ? 'text' : 'password'}
                placeholder="••••••••" value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password" minLength={8} disabled={loading} required />
              <button type="button" className="fh-eye" aria-label={showPw ? 'Hide password' : 'Show password'}
                onClick={() => { playClick(); setShowPw((v) => !v); }} tabIndex={-1}>
                <EyeIcon open={showPw} />
              </button>
            </div>

            <label className="fh-label" htmlFor="su-confirm">Confirm Password</label>
            <input id="su-confirm" className="fh-input" type={showPw ? 'text' : 'password'}
              placeholder="••••••••" value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password" disabled={loading} required />

            <button type="submit" className="fh-submit" disabled={loading}>
              <span>{loading ? 'Sending…' : 'Send verification code'}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            <p className="fh-verify-sub">
              Code sent to <strong>{cleanEmail}</strong>
            </p>
            <button type="button" className="fh-edit" onClick={() => { playClick(); setStep(1); setCode(''); setError(''); }}>
              Edit email
            </button>

            <div className="fh-code-label-row">
              <label className="fh-label">Enter verification code</label>
              <span className="fh-paste-hint">Paste supported</span>
            </div>
            <CodeInput value={code} onChange={setCode} disabled={loading} />

            <button type="submit" className="fh-submit" disabled={loading}>
              <span>{loading ? 'Verifying…' : 'Verify & Continue'}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </button>

            <div className="fh-resend">
              {cooldown > 0 ? (
                <span className="fh-resend-wait">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  Resend code in {cooldown}s
                </span>
              ) : (
                <button type="button" className="fh-resend-btn" onClick={handleResend}>
                  Resend code
                </button>
              )}
            </div>

            <div className="fh-secure">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              <span>End-to-end encrypted · Zero-knowledge authentication</span>
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

export default Signup;
