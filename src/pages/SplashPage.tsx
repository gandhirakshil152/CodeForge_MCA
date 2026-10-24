import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Code2, Trophy, Users, Terminal, Star, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';

// Matrix rain canvas effect
const MatrixRain: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const chars = '01アイウエオカキクケコJAVAPYTHONCODEFORGE{}[]();=></>'.split('');
    const cols = Math.floor(canvas.width / 16);
    const drops: number[] = Array(cols).fill(1);

    const draw = () => {
      ctx.fillStyle = 'rgba(5,5,15,0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(139,92,246,0.4)';
      ctx.font = '13px JetBrains Mono, monospace';
      drops.forEach((y, i) => {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillStyle = i % 3 === 0 ? 'rgba(34,211,238,0.5)' : 'rgba(139,92,246,0.4)';
        ctx.fillText(char, i * 16, y * 16);
        if (y * 16 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      });
    };

    const interval = setInterval(draw, 50);
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);
    return () => { clearInterval(interval); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, opacity: 0.15, pointerEvents: 'none' }} />;
};

const features = [
  { icon: <Code2 size={24} />, title: 'Multi-Language Support', desc: 'Code in Java, C, Python, and JavaScript with full syntax highlighting and IntelliSense.', color: 'var(--purple)' },
  { icon: <Trophy size={24} />, title: 'Real-Time Leaderboard', desc: 'Compete with peers ranked by runtime performance, accuracy, and efficiency scores.', color: 'var(--cyan)' },
  { icon: <Terminal size={24} />, title: 'Smart Code Editor', desc: 'Monaco editor with code suggestions, auto-complete, and anti-cheat protection.', color: 'var(--pink)' },
  { icon: <Users size={24} />, title: 'Community & Comments', desc: 'Discuss solutions, like approaches, and learn from the MCA community.', color: 'var(--yellow)' },
  { icon: <Zap size={24} />, title: 'Daily Challenges', desc: 'New problems every day added by admins — never run out of practice material.', color: 'var(--green)' },
  { icon: <Star size={24} />, title: 'Placement Ready', desc: 'Problems curated for MCA placements covering DSA, algorithms, and competitive coding.', color: 'var(--purple-light)' },
];

const stats = [
  { num: '500+', label: 'Problems' },
  { num: '4', label: 'Languages' },
  { num: 'SQL', label: 'DBMS Lab' },
  { num: '100%', label: 'Placement Prep' },
];

const SplashPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div style={{ minHeight: '100vh', overflowX: 'hidden' }}>
      <Navbar />

      {/* ── Hero ─── */}
      <section className="splash-page" style={{ minHeight: '100vh', padding: 'clamp(90px, 14vh, 130px) 16px 48px', overflow: 'hidden' }}>
        <div className="splash-bg" />
        <div className="splash-grid" />
        <MatrixRain />

        {/* Orbs */}
        <div className="orb orb-purple animate-float" style={{ width: 450, height: 450, top: -100, left: -150, maxWidth: '100vw' }} />
        <div className="orb orb-cyan animate-float" style={{ width: 380, height: 380, bottom: -120, right: -120, animationDelay: '1.5s', maxWidth: '100vw' }} />
        <div className="orb orb-pink" style={{ width: 260, height: 260, top: '40%', right: '10%', filter: 'blur(100px)', opacity: 0.25 }} />

        <div className="container" style={{ position: 'relative', zIndex: 10, textAlign: 'center', maxWidth: 960 }}>
          {/* Badge */}
          <div className="flex justify-center" style={{ marginBottom: 20 }}>
            <div className="badge badge-purple animate-pulse-glow" style={{ padding: '6px 16px', fontSize: 12 }}>
              <Zap size={12} /> MCA Placement Prep Platform • v2.0
            </div>
          </div>

          {/* Main Heading */}
          <h1 className="font-display animate-fade-up" style={{ fontSize: 'clamp(34px, 7vw, 84px)', fontWeight: 800, lineHeight: 1.08, marginBottom: 20 }}>
            <span className="gradient-text">Code.</span>{' '}
            <span style={{ color: 'var(--text-1)' }}>Compete.</span>
            <br />
            <span style={{ color: 'var(--cyan)' }}>Conquer.</span>
          </h1>

          <p className="animate-fade-up" style={{ fontSize: 'clamp(15px, 2vw, 19px)', color: 'var(--text-2)', maxWidth: 620, margin: '0 auto 36px', lineHeight: 1.7, animationDelay: '0.1s' }}>
            The comprehensive coding and assessment portal for <strong style={{ color: 'var(--purple-light)' }}>MCA students</strong>. 
            Practice industry-level algorithmic problems, execute SQL lab queries, and succeed in technical campus placements.
          </p>

          {/* CTA Buttons */}
          <div className="flex justify-center gap-3 flex-wrap animate-fade-up" style={{ animationDelay: '0.2s', marginBottom: 48 }}>
            {user ? (
              <>
                <Link to="/problems" className="btn btn-primary btn-lg">
                  <Code2 size={18} /> Start Coding <ArrowRight size={16} />
                </Link>
                <Link to="/leaderboard" className="btn btn-outline btn-lg">
                  <Trophy size={18} /> Leaderboard
                </Link>
              </>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary btn-lg" style={{ fontSize: 15, padding: '14px 32px' }}>
                  <Zap size={18} /> Get Started Free <ArrowRight size={16} />
                </Link>
                <Link to="/login" className="btn btn-outline btn-lg" style={{ fontSize: 15, padding: '14px 28px' }}>
                  Already a coder? Login
                </Link>
              </>
            )}
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-6 flex-wrap animate-fade-up" style={{ animationDelay: '0.3s' }}>
            {stats.map((s, i) => (
              <div key={i} style={{ textAlign: 'center', minWidth: 100, padding: '8px 12px' }}>
                <div className="font-display" style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, color: i === 0 ? 'var(--purple-light)' : i === 1 ? 'var(--cyan)' : i === 2 ? 'var(--pink)' : 'var(--yellow)' }}>{s.num}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Scroll indicator - safely in document flow so it never overrides stats */}
          <div style={{ marginTop: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 11 }}>
            <span>Scroll to explore</span>
            <div style={{ width: 18, height: 28, border: '1px solid var(--border-glow)', borderRadius: 99, display: 'flex', justifyContent: 'center', padding: 3 }}>
              <div style={{ width: 3, height: 6, background: 'var(--purple)', borderRadius: 99, animation: 'float 1.5s ease-in-out infinite' }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─── */}
      <section style={{ padding: '100px 0', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent, rgba(139,92,246,0.03), transparent)' }} />
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div className="badge badge-cyan" style={{ marginBottom: 16 }}>Platform Features</div>
            <h2 className="font-display gradient-text" style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 800 }}>Academic Excellence</h2>
            <p style={{ color: 'var(--text-2)', fontSize: 18, marginTop: 16, maxWidth: 500, margin: '16px auto 0' }}>
              Engineered for syllabus mastery, rigorous evaluation, and placement success.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            {features.map((f, i) => (
              <div key={i} className="glass-card" style={{ padding: 28, animationDelay: `${i * 0.1}s` }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: `${f.color}20`, border: `1px solid ${f.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: f.color, marginBottom: 16 }}>
                  {f.icon}
                </div>
                <h3 style={{ fontWeight: 700, marginBottom: 8, fontSize: 18 }}>{f.title}</h3>
                <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─── */}
      <section style={{ padding: '80px 0' }}>
        <div className="container">
          <div style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(30,58,138,0.25))', border: '1px solid var(--border-glow)', borderRadius: 'var(--radius-xl)', padding: 'clamp(40px, 6vw, 80px)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div className="orb orb-purple" style={{ width: 300, height: 300, top: -100, right: -100, opacity: 0.3 }} />
            <h2 className="font-display" style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, marginBottom: 16 }}>
              Ready to <span className="gradient-text">accelerate your career</span>?
            </h2>
            <p style={{ color: 'var(--text-2)', fontSize: 18, marginBottom: 32 }}>
              Join your MCA peers, complete proctored evaluations, and showcase your verified skills.
            </p>
            {!user && (
              <Link to="/register" className="btn btn-primary btn-lg" style={{ fontSize: 16 }}>
                <Zap size={18} /> Create Student Account — Free
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '32px 24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
        <div className="font-display gradient-text" style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>CodeForge MCA</div>
        <p>MCA Assessment &amp; Placement Preparation Platform • Department of Computer Applications</p>
      </footer>
    </div>
  );
};

export default SplashPage;
