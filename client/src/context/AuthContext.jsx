import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth';

// ---------------------------------------------------------------------------
// Auth state lives here so every page shares one session. On mount (and
// therefore on every page reload) we ask the backend GET /api/auth/me — the
// httpOnly session cookie is sent automatically, so a valid session restores
// the user without any token in localStorage. Only the pending (unverified)
// email is kept in sessionStorage so /verify survives a reload.
// ---------------------------------------------------------------------------

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingEmail, setPendingEmail] = useState(
    () => sessionStorage.getItem('fh_pending_email') || ''
  );

  const savePendingEmail = (email) => {
    setPendingEmail(email || '');
    if (email) sessionStorage.setItem('fh_pending_email', email);
    else sessionStorage.removeItem('fh_pending_email');
  };

  useEffect(() => {
    authApi.me()
      .then((d) => { if (d.user) setUser(d.user); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const signup = useCallback(async (email, password, confirmPassword) => {
    const data = await authApi.signup(email, password, confirmPassword);
    savePendingEmail(data.user.email);
    return data;
  }, []);

  const login = useCallback(async (email, password, rememberMe) => {
    const data = await authApi.login(email, password, rememberMe);
    if (data.needsVerification) {
      savePendingEmail(data.user.email);
      const err = new Error(data.message || 'Please verify your email first');
      err.needsVerification = true;
      err.user = data.user;
      throw err;
    }
    savePendingEmail('');
    setUser(data.user);
    return data;
  }, []);

  const verify = useCallback(async (email, code) => {
    const data = await authApi.verify(email, code);
    savePendingEmail('');
    setUser(data.user);
    return data;
  }, []);

  const resend = useCallback((email) => authApi.resend(email), []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch (e) {}
    savePendingEmail('');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, pendingEmail, setPendingEmail: savePendingEmail, signup, login, verify, resend, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
