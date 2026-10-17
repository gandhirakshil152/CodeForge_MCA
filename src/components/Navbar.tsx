import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Trophy, BookOpen, LayoutDashboard, LogOut, Shield, Zap,
  Database, FileQuestion, Bell, X, CheckCheck, Menu, ClipboardList,
} from 'lucide-react';
import {
  collection, query, where, onSnapshot, orderBy, limit,
  updateDoc, doc, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

interface Notif {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: any;
}

const Navbar: React.FC = () => {
  const { user, profile, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setShowNotifs(false);
  }, [location.pathname]);

  // Real-time notifications listener
  useEffect(() => {
    if (!user) { setNotifs([]); return; }
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20),
    );
    const unsub = onSnapshot(q, snap => {
      setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notif)));
    });
    return unsub;
  }, [user]);

  // Close notif dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unreadCount = notifs.filter(n => !n.read).length;

  const markAllRead = async () => {
    if (!user) return;
    const unread = notifs.filter(n => !n.read);
    if (!unread.length) return;
    const batch = writeBatch(db);
    unread.forEach(n => batch.update(doc(db, 'notifications', n.id), { read: true }));
    await batch.commit();
  };

  const markOneRead = async (n: Notif) => {
    if (n.read) return;
    await updateDoc(doc(db, 'notifications', n.id), { read: true });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const notifTypeColor = (type: string) => {
    switch (type) {
      case 'solve':       return 'var(--green)';
      case 'new_problem': return 'var(--purple-light)';
      case 'daily_task':  return 'var(--cyan)';
      case 'streak':      return 'var(--yellow)';
      default:            return 'var(--text-2)';
    }
  };

  const timeAgo = (ts: any) => {
    if (!ts?.toDate) return '';
    const diff = Date.now() - ts.toDate().getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const navLinks = user ? (
    <>
      <Link to="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>
        <LayoutDashboard size={15} /> Dashboard
      </Link>
      <Link to="/problems" className={`nav-link ${isActive('/problems') ? 'active' : ''}`}>
        <BookOpen size={15} /> Problems
      </Link>
      <Link to="/tests" className={`nav-link ${isActive('/tests') || isActive('/test') ? 'active' : ''}`}>
        <ClipboardList size={15} /> Tests
      </Link>
      <Link to="/dbms" className={`nav-link ${isActive('/dbms') ? 'active' : ''}`}>
        <Database size={15} /> DBMS
      </Link>
      <Link to="/ppt-quiz" className={`nav-link ${isActive('/ppt-quiz') ? 'active' : ''}`}>
        <FileQuestion size={15} /> PPT Quiz
      </Link>
      <Link to="/leaderboard" className={`nav-link ${isActive('/leaderboard') ? 'active' : ''}`}>
        <Trophy size={15} /> Leaderboard
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
      <Link to="/tests" className="nav-link"><ClipboardList size={15} /> Tests</Link>
      <Link to="/dbms" className="nav-link"><Database size={15} /> DBMS</Link>
      <Link to="/ppt-quiz" className="nav-link"><FileQuestion size={15} /> PPT Quiz</Link>
      <Link to="/leaderboard" className="nav-link"><Trophy size={15} /> Leaderboard</Link>
    </>
  );

  return (
    <>
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
          {navLinks}
        </div>

        {/* Desktop Auth Buttons + Notifications */}
        <div className="flex items-center gap-3 navbar-desktop-auth">
          {user ? (
            <>
              {/* Notification Bell */}
              <div ref={bellRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => { setShowNotifs(v => !v); if (!showNotifs) markAllRead(); }}
                  style={{
                    position: 'relative', background: 'var(--bg-glass)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                    padding: '7px 10px', cursor: 'pointer', color: 'var(--text-2)',
                    display: 'flex', alignItems: 'center', gap: 4,
                    transition: 'border-color 0.2s',
                  }}
                >
                  <Bell size={16} style={{ color: unreadCount > 0 ? 'var(--yellow)' : undefined }} />
                  {unreadCount > 0 && (
                    <span style={{
                      position: 'absolute', top: -5, right: -5,
                      background: 'var(--red, #ef4444)', color: '#fff',
                      borderRadius: '50%', width: 18, height: 18,
                      fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '2px solid var(--bg-deep)',
                    }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {showNotifs && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                    width: 340, maxHeight: 440,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                    overflow: 'hidden', zIndex: 9999,
                  }}>
                    {/* Header */}
                    <div style={{
                      padding: '14px 16px', borderBottom: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>🔔 Notifications</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {unreadCount > 0 && (
                          <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--purple-light)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCheck size={13} /> Mark all read
                          </button>
                        )}
                        <button onClick={() => setShowNotifs(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}>
                          <X size={14} />
                        </button>
                      </div>
                    </div>

                    {/* List */}
                    <div style={{ overflowY: 'auto', maxHeight: 380 }}>
                      {notifs.length === 0 ? (
                        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                          <Bell size={28} style={{ marginBottom: 8, opacity: 0.3 }} />
                          <p>No notifications yet</p>
                        </div>
                      ) : notifs.map(n => (
                        <div
                          key={n.id}
                          onClick={() => markOneRead(n)}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--border)',
                            background: n.read ? 'transparent' : 'rgba(139,92,246,0.06)',
                            cursor: 'default',
                            transition: 'background 0.2s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <div style={{
                              width: 8, height: 8, borderRadius: '50%',
                              background: notifTypeColor(n.type),
                              flexShrink: 0, marginTop: 5,
                              opacity: n.read ? 0.3 : 1,
                            }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>{n.title}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.5 }}>{n.message}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{timeAgo(n.createdAt)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

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

        {/* Mobile: Hamburger toggle */}
        <button
          className="navbar-mobile-toggle"
          onClick={() => setMobileOpen(v => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile Menu */}
      <div className={`navbar-mobile-menu ${mobileOpen ? 'open' : ''}`}>
        {navLinks}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 10 }}>
          {user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Link to="/profile" className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="avatar" style={{ width: 24, height: 24, fontSize: 11 }}>
                  {(profile?.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
                {profile?.displayName?.split(' ')[0] || 'Profile'}
              </Link>
              {unreadCount > 0 && (
                <div style={{ padding: '8px 16px', fontSize: 13, color: 'var(--yellow)' }}>
                  🔔 {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
                </div>
              )}
              <button
                className="nav-link"
                style={{ color: 'var(--red)', textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}
                onClick={handleLogout}
              >
                <LogOut size={15} /> Logout
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                <Zap size={14} /> Join Now
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Navbar;
