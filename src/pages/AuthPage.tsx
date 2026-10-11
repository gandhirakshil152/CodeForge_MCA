import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Zap, Code2, ArrowRight, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const AuthPage: React.FC<{ mode: 'login' | 'register' }> = ({ mode }) => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'register' && form.password !== form.confirm) {
      toast.error('Passwords do not match!'); return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters!'); return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
        toast.success('Welcome back! 🔥');
        navigate('/problems');
      } else {
        if (!form.name.trim()) { toast.error('Enter your name!'); setLoading(false); return; }
        await register(form.email, form.password, form.name.trim());
        toast.success('Account created! Let\'s code! 🚀');
        navigate('/problems');
      }
    } catch (err: any) {
      const msg = err.code === 'auth/user-not-found' ? 'User not found!' :
                  err.code === 'auth/wrong-password' ? 'Wrong password!' :
                  err.code === 'auth/email-already-in-use' ? 'Email already registered!' :
                  err.code === 'auth/invalid-email' ? 'Invalid email!' :
                  err.message || 'Something went wrong!';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px 40px', position: 'relative' }}>
      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 30% 50%, rgba(139,92,246,0.1) 0%, transparent 50%), radial-gradient(ellipse at 70% 50%, rgba(34,211,238,0.08) 0%, transparent 50%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div className="navbar-logo" style={{ width: 56, height: 56, fontSize: 24, borderRadius: 16 }}>{'</>'}</div>
            <span className="font-display gradient-text" style={{ fontSize: 28, fontWeight: 800 }}>CodeForge MCA</span>
          </Link>
          <p style={{ color: 'var(--text-2)', marginTop: 8, fontSize: 15 }}>
            {mode === 'login' ? 'Welcome back, coder! 👋' : 'Join the MCA coding community 🚀'}
          </p>
        </div>

        {/* Card */}
        <div className="glass-card" style={{ padding: 36 }}>
          {/* Tab switcher */}
          <div className="tabs" style={{ marginBottom: 28 }}>
            <Link to="/login" className={`tab ${mode === 'login' ? 'active' : ''}`} style={{ textDecoration: 'none', textAlign: 'center' }}>Login</Link>
            <Link to="/register" className={`tab ${mode === 'register' ? 'active' : ''}`} style={{ textDecoration: 'none', textAlign: 'center' }}>Register</Link>
          </div>

          <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {mode === 'register' && (
              <div>
                <label>Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                  <input className="input" style={{ paddingLeft: 40 }} placeholder="Rakshil Gandhi" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                </div>
              </div>
            )}
            <div>
              <label>Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                <input className="input" type="email" style={{ paddingLeft: 40 }} placeholder="you@university.ac.in" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
              </div>
            </div>
            <div>
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                <input className="input" type={showPw ? 'text' : 'password'} style={{ paddingLeft: 40, paddingRight: 44 }} placeholder="••••••••" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required minLength={6} />
                <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {mode === 'register' && (
              <div>
                <label>Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                  <input className="input" type={showPw ? 'text' : 'password'} style={{ paddingLeft: 40 }} placeholder="••••••••" value={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} required />
                </div>
              </div>
            )}

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '13px', marginTop: 4 }}>
              {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> :
                mode === 'login' ? <><Zap size={16} /> Login</> : <><ArrowRight size={16} /> Create Account</>
              }
            </button>
          </form>

          {mode === 'login' && (
            <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-3)', fontSize: 13 }}>
              New here?{' '}
              <Link to="/register" style={{ color: 'var(--purple-light)', textDecoration: 'none', fontWeight: 600 }}>
                Create account →
              </Link>
            </p>
          )}
          {mode === 'register' && (
            <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-3)', fontSize: 13 }}>
              Already a coder?{' '}
              <Link to="/login" style={{ color: 'var(--purple-light)', textDecoration: 'none', fontWeight: 600 }}>
                Login →
              </Link>
            </p>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-3)', fontSize: 12 }}>
          By joining, you agree to practice coding and not cheat. 😤
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
