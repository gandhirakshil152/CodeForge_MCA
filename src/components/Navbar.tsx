import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Code2, Trophy, BookOpen, LayoutDashboard, LogOut, User, Shield, Menu, X, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Navbar: React.FC = () => {
  const { user, profile, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav className="navbar" style={{ boxShadow: scrolled ? '0 4px 30px rgba(0,0,0,0.5)' : 'none' }}>
      <Link to="/" className="navbar-brand" style={{ textDecoration: 'none' }}>
        <div className="navbar-logo">{'</>'}</div>
        <div>
          <span className="font-display gradient-text" style={{ fontSize: 20, fontWeight: 800 }}>CodeForge</span>
          <span style={{ color: 'var(--purple-light)', fontSize: 10, display: 'block', marginTop: -4, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600 }}>MCA Platform</span>
        </div>
      </Link>

      {/* Desktop Links */}
      <div className="navbar-links" style={{ display: 'flex' }}>
        {user ? (
          <>
            <Link to="/problems" className={`nav-link ${isActive('/problems') ? 'active' : ''}`}>
              <BookOpen size={15} /> Problems
            </Link>
            <Link to="/leaderboard" className={`nav-link ${isActive('/leaderboard') ? 'active' : ''}`}>
              <Trophy size={15} /> Leaderboard
            </Link>
            <Link to="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>
              <LayoutDashboard size={15} /> Dashboard
            </Link>
            {isAdmin && (
              <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'active' : ''}`} style={{ color: 'var(--yellow)' }}>
                <Shield size={15} /> Admin
              </Link>
            )}
          </>
        ) : (
          <>
            <Link to="/problems" className="nav-link"><BookOpen size={15} /> Problems</Link>
            <Link to="/leaderboard" className="nav-link"><Trophy size={15} /> Leaderboard</Link>
          </>
        )}
      </div>

      {/* Auth Buttons */}
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <Link to="/profile" style={{ textDecoration: 'none' }}>
              <div className="flex items-center gap-2" style={{ cursor: 'pointer', padding: '6px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
                <div className="avatar" style={{ width: 28, height: 28, fontSize: 12 }}>
                  {(profile?.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>
                  {profile?.displayName?.split(' ')[0] || 'User'}
                </span>
              </div>
            </Link>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
              <LogOut size={14} /> Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
            <Link to="/register" className="btn btn-primary btn-sm">
              <Zap size={14} /> Join Now
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
