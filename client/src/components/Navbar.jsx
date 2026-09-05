import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import playClick from '../utils/sounds';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    playClick();
    await logout();
    navigate('/login');
  };

  const onAuthPage = ['/login', '/register', '/verify', '/forgot-password'].includes(location.pathname);

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <img src="/logo.png" alt="Focus Himd logo" width="38" height="38" className="logo-img" />
        <Link to="/" onClick={playClick}>Focus Himd</Link>
      </div>
      {!onAuthPage && (
        <div className="navbar-links">
          <Link to="/" className={isActive('/') ? 'active' : ''} onClick={playClick}>Focus</Link>
          <Link to="/history" className={isActive('/history') ? 'active' : ''} onClick={playClick}>History</Link>
          <Link to="/stats" className={isActive('/stats') ? 'active' : ''} onClick={playClick}>Stats</Link>
        </div>
      )}
      <div className="navbar-auth">
        {!loading && (user ? (
          <>
            <span className="navbar-email">{user.email}</span>
            <button type="button" className="navbar-logout" onClick={handleLogout}>Sign out</button>
          </>
        ) : (
          !onAuthPage && <Link to="/login" className="navbar-login" onClick={playClick}>Log In</Link>
        ))}
      </div>
    </nav>
  );
};

export default Navbar;
