import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import playClick from '../utils/sounds';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
  );
}

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) { setError('Enter a valid email address'); return; }
    if (!password) { setError('Enter your password'); return; }
    setLoading(true);
    playClick();
    try {
      await login(cleanEmail, password);
      const dest = location.state?.from || '/';
      navigate(dest, { replace: true });
    } catch (err) {
      if (err.needsVerification) navigate('/verify');
      else setError(err.message || 'Something went wrong, please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fh-auth-wrap">
      <div className="fh-auth-top">
        <h1>Welcome to Focus Himd</h1>
        <p>Reclaim your attention and peak flow.</p>
      </div>

      <div className="fh-card">
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
              autoComplete="current-password" disabled={loading} required />
            <button type="button" className="fh-eye" aria-label={showPw ? 'Hide password' : 'Show password'}
              onClick={() => { playClick(); setShowPw((v) => !v); }} tabIndex={-1}>
              <EyeIcon open={showPw} />
            </button>
          </div>

          <button type="submit" className="fh-submit" disabled={loading}>
            <span>{loading ? 'Signing in…' : 'Log In'}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
          </button>
        </form>

        <div className="fh-create">
          <Link to="/register" onClick={playClick}>Create your account</Link>
        </div>
      </div>

      <div className="fh-status"><span className="fh-dot" /> All systems operational</div>
      <div className="fh-foot">
        <span>Privacy</span><span>Terms</span><span>Security</span>
      </div>
    </div>
  );
};

export default Login;
