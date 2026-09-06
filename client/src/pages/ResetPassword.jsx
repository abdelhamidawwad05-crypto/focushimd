import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import playClick from '../utils/sounds';
import { authApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';

const ResetPassword = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const initialToken = params.get('token') || '';
  const [token] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(token ? '' : 'This reset link is invalid or expired');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Do not leave the one-time secret in browser history or the address bar
  // after capturing it for the form submission.
  useEffect(() => {
    if (initialToken) navigate('/reset-password', { replace: true });
  }, [initialToken, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (new TextEncoder().encode(password).length > 72) { setError('Password must be 72 UTF-8 bytes or fewer'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    playClick();
    try {
      await authApi.resetPassword(token, password, confirmPassword);
      setSuccess(true);
      // If the reset was performed in an already-open session, clear its stale
      // cookie and context before allowing the user back to login.
      try { await logout(); } catch (_) {}
    } catch (err) {
      setError(err.message || 'Could not reset password, please try again');
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
        {success ? (
          <div className="fh-center">
            <div className="fh-check">✓</div>
            <h1 className="fh-verify-title">Password updated</h1>
            <p className="fh-verify-sub">Your password was changed. Sign in with your new password.</p>
            <div className="fh-back-row"><Link className="fh-edit" to="/login" onClick={playClick}>Back to login</Link></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <h1 className="fh-verify-title">Choose a new password</h1>
            <p className="fh-verify-sub">Use at least 8 characters. The reset link expires after 45 minutes.</p>
            {error && <div className="fh-error" role="alert">{error}</div>}
            <label className="fh-label" htmlFor="reset-password">New password</label>
            <input id="reset-password" className="fh-input" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" disabled={loading || !token} required />
            <label className="fh-label" htmlFor="reset-confirm">Confirm new password</label>
            <input id="reset-confirm" className="fh-input" type="password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" disabled={loading || !token} required />
            <button type="submit" className="fh-submit" disabled={loading || !token}>
              <span>{loading ? 'Updating…' : 'Update password'}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </button>
            <div className="fh-back-row"><Link className="fh-edit" to="/login" onClick={playClick}>Back to login</Link></div>
          </form>
        )}
      </div>
      <div className="fh-status"><span className="fh-dot" /> All systems operational</div>
      <div className="fh-foot"><span>Privacy</span><span>Terms</span><span>Security</span></div>
    </div>
  );
};

export default ResetPassword;
