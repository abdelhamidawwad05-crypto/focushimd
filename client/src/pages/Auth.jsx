import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth';
import playClick from '../utils/sounds';

// ---------------------------------------------------------------------------
// Single auth card with a pill tab switcher (Log In / Sign Up) per the
// reference screenshot. /login renders mode="login", /register renders
// mode="signup" — same component, same card, same glow (the site-wide
// <MouseGlow /> in App.jsx is reused, not recreated).
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
  );
}

const Auth = ({ mode }) => {
  const isSignup = mode === 'signup';
  const { signup, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [googleMsg, setGoogleMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const switchTab = (next) => {
    playClick();
    navigate(next === 'signup' ? '/register' : '/login');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) { setError('Enter a valid email address'); return; }
    if (!password || password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password.length > 128) { setError('Password is too long'); return; }
    setLoading(true);
    playClick();
    try {
      if (isSignup) {
        await signup(cleanEmail, password);
        navigate('/verify');
      } else {
        await login(cleanEmail, password);
        navigate('/');
      }
    } catch (err) {
      if (err.needsVerification) navigate('/verify');
      else setError(err.message || 'Something went wrong, please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    playClick();
    setGoogleMsg('');
    try {
      await authApi.google();
    } catch (err) {
      setGoogleMsg(err.message || 'Google sign-in is not configured yet');
    }
  };

  return (
    <div className="fh-auth-wrap">
      <div className="fh-auth-top">
        <h1>Welcome to Focus Himd</h1>
        <p>Reclaim your attention and peak flow.</p>
      </div>

      <div className="fh-card">
        <div className="fh-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={!isSignup}
            className={`fh-tab ${!isSignup ? 'active' : ''}`}
            onClick={() => isSignup && switchTab('login')}>Log In</button>
          <button type="button" role="tab" aria-selected={isSignup}
            className={`fh-tab ${isSignup ? 'active' : ''}`}
            onClick={() => !isSignup && switchTab('signup')}>Sign Up</button>
        </div>

        <button type="button" className="fh-google" onClick={handleGoogle} disabled={loading}>
          <GoogleG />
          <span>Continue with Google</span>
        </button>
        {googleMsg && <div className="fh-note">{googleMsg}</div>}

        <div className="fh-or"><span>OR</span></div>

        {error && <div className="fh-error" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <label className="fh-label" htmlFor="fh-email">Email</label>
          <input id="fh-email" className="fh-input" type="email"
            placeholder="name@work.com" value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email" disabled={loading} required />

          <div className="fh-label-row">
            <label className="fh-label" htmlFor="fh-password">Password</label>
            <Link className="fh-forgot" to="/forgot-password" onClick={playClick}>Forgot?</Link>
          </div>
          <div className="fh-pw-wrap">
            <input id="fh-password" className="fh-input fh-pw" type={showPw ? 'text' : 'password'}
              placeholder="••••••••" value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              minLength={8} disabled={loading} required />
            <button type="button" className="fh-eye" aria-label={showPw ? 'Hide password' : 'Show password'}
              onClick={() => { playClick(); setShowPw((v) => !v); }} tabIndex={-1}>
              <EyeIcon open={showPw} />
            </button>
          </div>

          <button type="submit" className="fh-submit" disabled={loading}>
            <span>{loading ? (isSignup ? 'Creating account…' : 'Signing in…') : (isSignup ? 'Sign Up' : 'Log In')}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
          </button>
        </form>
      </div>

      <div className="fh-status"><span className="fh-dot" /> All systems operational</div>
      <div className="fh-foot">
        <Link to="/login" onClick={playClick}>Privacy</Link>
        <Link to="/login" onClick={playClick}>Terms</Link>
        <Link to="/login" onClick={playClick}>Security</Link>
      </div>
    </div>
  );
};

export default Auth;
