import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Code2, Trophy, Users, Terminal, Star, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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
      {/* ── Hero ─── */}
      <section className="splash-page" style={{ minHeight: '100vh' }}>
        <div className="splash-bg" />
        <div className="splash-grid" />
        <MatrixRain />

        {/* Orbs */}
        <div className="orb orb-purple animate-float" style={{ width: 500, height: 500, top: -100, left: -200 }} />
        <div className="orb orb-cyan animate-float" style={{ width: 400, height: 400, bottom: -150, right: -150, animationDelay: '1.5s' }} />
        <div className="orb orb-pink" style={{ width: 300, height: 300, top: '40%', right: '20%', filter: 'blur(100px)', opacity: 0.3 }} />

        <div className="container" style={{ position: 'relative', zIndex: 10, textAlign: 'center' }}>
          {/* Badge */}
          <div className="flex justify-center" style={{ marginBottom: 24 }}>
            <div className="badge badge-purple animate-pulse-glow" style={{ padding: '8px 18px', fontSize: 12 }}>
              <Zap size={12} /> MCA Placement Prep Platform • v2.0
            </div>
          </div>

          {/* Main Heading */}
          <h1 className="font-display animate-fade-up" style={{ fontSize: 'clamp(48px, 8vw, 96px)', fontWeight: 800, lineHeight: 1.05, marginBottom: 24 }}>
            <span className="gradient-text">Code.</span>{' '}
            <span style={{ color: 'var(--text-1)' }}>Compete.</span>
            <br />
            <span style={{ color: 'var(--cyan)' }}>Conquer.</span>
          </h1>

          <p className="animate-fade-up" style={{ fontSize: 'clamp(16px, 2.5vw, 22px)', color: 'var(--text-2)', maxWidth: 600, margin: '0 auto 40px', lineHeight: 1.7, animationDelay: '0.1s' }}>
            The comprehensive coding and assessment portal for <strong style={{ color: 'var(--purple-light)' }}>MCA students</strong>. 
            Practice industry-level algorithmic problems, execute SQL lab queries, and succeed in technical campus placements.
          </p>

          {/* CTA Buttons */}
          <div className="flex justify-center gap-4 flex-wrap animate-fade-up" style={{ animationDelay: '0.2s', marginBottom: 64 }}>
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
                <Link to="/register" className="btn btn-primary btn-lg" style={{ fontSize: 16, padding: '16px 40px' }}>
                  <Zap size={18} /> Get Started Free <ArrowRight size={16} />
                </Link>
                <Link to="/login" className="btn btn-outline btn-lg">
                  Already a coder? Login
                </Link>
              </>
            )}
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-8 flex-wrap animate-fade-up" style={{ animationDelay: '0.3s' }}>
            {stats.map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div className="font-display" style={{ fontSize: 40, fontWeight: 800, color: i === 0 ? 'var(--purple-light)' : i === 1 ? 'var(--cyan)' : i === 2 ? 'var(--pink)' : 'var(--yellow)' }}>{s.num}</div>
                <div style={{ fontSize: 13, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--text-3)', fontSize: 12 }}>
          <span>Scroll to explore</span>
          <div style={{ width: 20, height: 32, border: '2px solid var(--border-glow)', borderRadius: 99, display: 'flex', justifyContent: 'center', padding: 4 }}>
            <div style={{ width: 3, height: 8, background: 'var(--purple)', borderRadius: 99, animation: 'float 1.5s ease-in-out infinite' }} />
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
