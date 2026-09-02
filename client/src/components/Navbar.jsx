import { Link, useLocation } from 'react-router-dom';
import playClick from '../utils/sounds';

const Navbar = () => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="logo">⏱</div>
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
