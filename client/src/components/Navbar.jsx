import { Link, useLocation } from 'react-router-dom';
import playClick from '../utils/sounds';

const Navbar = () => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <Link to="/" onClick={playClick}>Focus Himd</Link>
      </div>
      <div className="navbar-links">
        <Link to="/" className={isActive('/') ? 'active' : ''} onClick={playClick}>Focus</Link>
        <Link to="/history" className={isActive('/history') ? 'active' : ''} onClick={playClick}>History</Link>
        <Link to="/stats" className={isActive('/stats') ? 'active' : ''} onClick={playClick}>Stats</Link>
      </div>
    </nav>
  );
};

export default Navbar;