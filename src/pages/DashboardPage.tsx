import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import { Code2, Trophy, Zap, Clock, CheckCircle2, XCircle, Target, TrendingUp, BookOpen, Star } from 'lucide-react';

interface Submission {
  id: string;
  problemTitle: string;
  problemId: string;
  language: string;
  status: 'accepted' | 'wrong_answer' | 'error';
  runtime: number;
  score: number;
  createdAt: any;
}

const LANG_COLORS: Record<string, string> = {
  java: 'lang-java', c: 'lang-c', python: 'lang-python', javascript: 'lang-js'
};

const DashboardPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalProblems, setTotalProblems] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [subSnap, probSnap] = await Promise.all([
          getDocs(query(collection(db, 'submissions'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(10))),
          getDocs(collection(db, 'problems')),
        ]);
        setSubmissions(subSnap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));
        setTotalProblems(probSnap.size);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [user]);

  const acceptedCount = submissions.filter(s => s.status === 'accepted').length;
  const accuracy = submissions.length > 0 ? Math.round((acceptedCount / submissions.length) * 100) : 0;
  const avgRuntime = submissions.filter(s => s.status === 'accepted').length > 0
    ? Math.round(submissions.filter(s => s.status === 'accepted').reduce((a, s) => a + s.runtime, 0) / submissions.filter(s => s.status === 'accepted').length)
    : 0;

  const progressPct = totalProblems > 0 ? Math.min((profile?.problemsSolved || 0) / totalProblems * 100, 100) : 0;

  const statCards = [
    { label: 'Problems Solved', value: profile?.problemsSolved || 0, icon: <CheckCircle2 size={22} />, color: 'var(--green)', gradient: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))' },
    { label: 'Total Score', value: profile?.score || 0, icon: <Star size={22} />, color: 'var(--yellow)', gradient: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))' },
    { label: 'Submissions', value: profile?.totalSubmissions || 0, icon: <Zap size={22} />, color: 'var(--purple-light)', gradient: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05))' },
    { label: 'Accuracy', value: `${accuracy}%`, icon: <Target size={22} />, color: 'var(--cyan)', gradient: 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(34,211,238,0.05))' },
    { label: 'Avg Runtime', value: `${avgRuntime}ms`, icon: <Clock size={22} />, color: 'var(--pink)', gradient: 'linear-gradient(135deg, rgba(236,72,153,0.2), rgba(236,72,153,0.05))' },
    { label: 'Available', value: totalProblems, icon: <BookOpen size={22} />, color: 'var(--text-2)', gradient: 'linear-gradient(135deg, rgba(148,163,184,0.1), rgba(148,163,184,0.02))' },
  ];

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-content">
          {/* Welcome */}
          <div style={{ marginBottom: 36 }}>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="avatar" style={{ width: 64, height: 64, fontSize: 26 }}>
                {profile?.displayName?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <h1 className="font-display" style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800 }}>
                  Hey, <span className="gradient-text">{profile?.displayName?.split(' ')[0] || 'Coder'}!</span> 👋
                </h1>
                <p style={{ color: 'var(--text-2)', marginTop: 4, fontSize: 15 }}>
                  {profile?.email} • {profile?.role === 'superadmin' ? '👑 Super Admin' : profile?.role === 'admin' ? '🛡️ Admin' : '🎓 MCA Student'}
                </p>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <Link to="/problems" className="btn btn-primary">
                  <Code2 size={16} /> Keep Coding
                </Link>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="glass-card" style={{ padding: 24, marginBottom: 28 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 16 }}>Placement Readiness</span>
                <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 2 }}>
                  {profile?.problemsSolved || 0} / {totalProblems} problems solved
                </p>
              </div>
              <span className="font-display gradient-text" style={{ fontSize: 32, fontWeight: 800 }}>
                {Math.round(progressPct)}%
              </span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="flex justify-between" style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>
              <span>🐣 Beginner</span>
              <span>🚀 Placement Ready</span>
            </div>
          </div>

          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 36 }}>
            {statCards.map((c, i) => (
              <div key={i} className="stat-card" style={{ background: c.gradient, border: `1px solid ${c.color}30` }}>
                <div style={{ color: c.color, display: 'flex', justifyContent: 'center', marginBottom: 10 }}>{c.icon}</div>
                <div className="stat-number" style={{ color: c.color }}>{c.value}</div>
                <div style={{ color: 'var(--text-3)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Recent Activity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>
            {/* Recent Submissions */}
            <div>
              <div className="section-heading">
                <h2 style={{ fontSize: 20, fontWeight: 700 }}>Recent Submissions</h2>
              </div>
              {loading ? (
                <div className="flex justify-center" style={{ padding: 40 }}><div className="spinner" /></div>
              ) : submissions.length === 0 ? (
                <div className="glass-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>
                  <Code2 size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                  <p style={{ fontSize: 16 }}>No submissions yet!</p>
                  <Link to="/problems" className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>
                    Solve a problem
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {submissions.map(s => (
                    <Link key={s.id} to={`/problems/${s.problemId}`} style={{ textDecoration: 'none' }}>
                      <div className="glass-card" style={{ padding: '14px 18px', cursor: 'pointer' }}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {s.status === 'accepted'
                              ? <CheckCircle2 size={18} color="var(--green)" />
                              : <XCircle size={18} color="var(--red)" />}
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14 }}>{s.problemTitle}</div>
                              <div className="flex items-center gap-2" style={{ marginTop: 3 }}>
                                <span className={`lang-badge ${LANG_COLORS[s.language] || 'lang-python'}`}>{s.language?.toUpperCase()}</span>
                                <span style={{ fontSize: 12, color: 'var(--text-3)' }}><Clock size={11} style={{ verticalAlign: 'middle' }} /> {s.runtime}ms</span>
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span className={`badge ${s.status === 'accepted' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10 }}>
                              {s.status === 'accepted' ? 'AC' : s.status === 'wrong_answer' ? 'WA' : 'RE'}
                            </span>
                            {s.status === 'accepted' && (
                              <div style={{ fontSize: 13, color: 'var(--yellow)', marginTop: 4, fontWeight: 600 }}>+{Math.round(s.score)} pts</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="section-heading">
                <h2 style={{ fontSize: 20, fontWeight: 700 }}>Quick Actions</h2>
              </div>
              {[
                { label: 'Practice Problems', desc: 'Browse all problems', icon: <BookOpen size={20} />, link: '/problems', color: 'var(--purple)' },
                { label: 'Leaderboard', desc: 'Check your ranking', icon: <Trophy size={20} />, link: '/leaderboard', color: 'var(--yellow)' },
                { label: 'Profile', desc: 'View your stats', icon: <TrendingUp size={20} />, link: '/profile', color: 'var(--cyan)' },
              ].map((a, i) => (
                <Link key={i} to={a.link} style={{ textDecoration: 'none' }}>
                  <div className="glass-card" style={{ padding: '16px 20px', cursor: 'pointer' }}>
                    <div className="flex items-center gap-3">
                      <div style={{ color: a.color, background: `${a.color}20`, border: `1px solid ${a.color}40`, width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {a.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{a.label}</div>
                        <div style={{ color: 'var(--text-3)', fontSize: 12 }}>{a.desc}</div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}

              {/* Language Streak */}
              <div className="glass-card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 15 }}>🔥 Language Stats</div>
                {['java', 'c', 'python', 'javascript'].map(lang => {
                  const count = submissions.filter(s => s.language === lang).length;
                  const pct = submissions.length > 0 ? (count / submissions.length) * 100 : 0;
                  return (
                    <div key={lang} style={{ marginBottom: 10 }}>
                      <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
                        <span className={`lang-badge ${LANG_COLORS[lang]}`}>{lang.toUpperCase()}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{count}</span>
                      </div>
                      <div className="progress-bar" style={{ height: 4 }}>
                        <div className="progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DashboardPage;
