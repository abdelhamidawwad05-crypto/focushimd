import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ---------------------------------------------------------------------------
// Route guard.
//  - Protected: if the user is not logged in, redirect to /login (keeping the
//    deep link so they return after signing in). All app pages (Focus/History/
//    Stats) are wrapped in this so the whole app is private.
//  - Guest: auth pages (login/signup/verify/forgot). If the user is ALREADY
//    logged in, redirect them into the app — never show the login form again.
//    Only guest pages can render while logged out.
// ---------------------------------------------------------------------------

export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="loading">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
};

export const GuestRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading…</div>;
  }
  if (user) {
    return <Navigate to="/" replace />;
  }
  return children;
};
