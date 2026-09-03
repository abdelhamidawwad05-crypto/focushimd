import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import playClick from '../utils/sounds';

// ---------------------------------------------------------------------------
// Step 2 of 2: 6-box verification code. Boxes auto-advance, backspace moves
// back, full-code paste is supported. Resend has a 33s client countdown that
// mirrors the server's 30s anti-spam cooldown.
// ---------------------------------------------------------------------------

const RESEND_WAIT = 33;

const Verify = () => {
  const { pendingEmail, setPendingEmail, verify, resend } = useAuth();
  const navigate = useNavigate();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_WAIT);
  const inputs = useRef([]);

  useEffect(() => {
    if (!pendingEmail) navigate('/register');
  }, [pendingEmail, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => { inputs.current[0] && inputs.current[0].focus(); }, []);

  const setDigit = (i, v) => {
    setDigits((d) => { const n = [...d]; n[i] = v; return n; });
  };

  const handleChange = (i, e) => {
    const v = e.target.value.replace(/\D/g, '').slice(-1);
    setDigit(i, v);
    if (v && i < 5) inputs.current[i + 1].focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1].focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    const n = ['', '', '', '', '', ''];
    for (let i = 0; i < text.length; i++) n[i] = text[i];
    setDigits(n);
    inputs.current[Math.min(text.length, 5)].focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const code = digits.join('');
    if (!/^\d{6}$/.test(code)) { setError('Enter the 6-digit code'); return; }
    setLoading(true);
    playClick();
    try {
      await verify(pendingEmail, code);
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
      await resend(pendingEmail);
      setCooldown(RESEND_WAIT);
    } catch (err) {
      setError(err.message || 'Could not resend the code');
    }
  }, [cooldown, loading, pendingEmail, resend]);

  return (
    <div className="fh-auth-wrap fh-verify-wrap">
      <div className="fh-card fh-verify-card">
        <div className="fh-verify-top">
          <div className="fh-mail-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></svg>
            <svg className="fh-mail-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <span className="fh-step">STEP 2 OF 2</span>
        </div>

        <h1 className="fh-verify-title">Check your inbox</h1>
        <p className="fh-verify-sub">
          We sent a 6-digit verification code to <strong>{pendingEmail}</strong>
        </p>
        <button type="button" className="fh-edit" onClick={() => { playClick(); setPendingEmail(''); navigate('/register'); }}>
          Edit
        </button>

        {error && <div className="fh-error" role="alert">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="fh-code-label-row">
            <label className="fh-label">Enter verification code</label>
            <span className="fh-paste-hint">Paste supported</span>
          </div>
          <div className="fh-code-row" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input key={i} ref={(el) => (inputs.current[i] = el)}
                className="fh-code-box" inputMode="numeric" autoComplete="one-time-code"
                maxLength={1} value={d} disabled={loading}
                placeholder="•" aria-label={`Digit ${i + 1}`}
                onChange={(e) => handleChange(i, e)}
                onKeyDown={(e) => handleKeyDown(i, e)} />
            ))}
          </div>

          <button type="submit" className="fh-submit" disabled={loading}>
            <span>{loading ? 'Verifying…' : 'Verify & Continue'}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
          </button>
        </form>

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
      </div>

      <div className="fh-foot fh-verify-foot">
        <span>Privacy Policy</span><span className="fh-sep">·</span>
        <span>Terms</span><span className="fh-sep">·</span>
        <span>Need help?</span>
      </div>
    </div>
  );
};

export default Verify;
