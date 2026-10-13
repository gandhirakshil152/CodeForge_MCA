import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import { Trophy, Code2, Target, Clock, CheckCircle2, XCircle, Star } from 'lucide-react';

const LANG_COLORS: Record<string, string> = { java: 'lang-java', c: 'lang-c', python: 'lang-python', javascript: 'lang-js' };

const ProfilePage: React.FC = () => {
  const { user, profile } = useAuth();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rank, setRank] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [subSnap, usersSnap] = await Promise.all([
          getDocs(query(collection(db, 'submissions'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'users'), orderBy('score', 'desc'))),
        ]);
        setSubmissions(subSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        const idx = usersSnap.docs.findIndex(d => d.id === user.uid);
        setRank(idx >= 0 ? idx + 1 : 0);
      } finally { setLoading(false); }
    };
    load();
  }, [user]);

  const accepted = submissions.filter(s => s.status === 'accepted');
  const accuracy = submissions.length > 0 ? Math.round((accepted.length / submissions.length) * 100) : 0;
  const avgRuntime = accepted.length > 0 ? Math.round(accepted.reduce((a, s) => a + s.runtime, 0) / accepted.length) : 0;
  const langCounts = submissions.reduce((acc, s) => { acc[s.language] = (acc[s.language] || 0) + 1; return acc; }, {} as Record<string, number>);
  const favLang = Object.entries(langCounts).sort(([, countA], [, countB]) => (countB as number) - (countA as number))[0]?.[0] || 'None';

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-content">
          {/* Profile Hero */}
          <div className="glass-card" style={{ padding: 'clamp(24px, 4vw, 48px)', marginBottom: 28, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.15), transparent)', pointerEvents: 'none' }} />
            <div className="flex items-center gap-6 flex-wrap">
              <div className="avatar" style={{ width: 88, height: 88, fontSize: 36, boxShadow: '0 0 30px rgba(139,92,246,0.4)', border: '3px solid var(--purple)' }}>
                {profile?.displayName?.[0]?.toUpperCase() || 'U'}
              </div>
              <div style={{ flex: 1 }}>
                <h1 className="font-display" style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>
                  {profile?.displayName}
                </h1>
                <p style={{ color: 'var(--text-2)', marginBottom: 8 }}>{profile?.email}</p>
                <div className="flex gap-2 flex-wrap">
                  <span className={`badge ${profile?.role === 'superadmin' ? 'badge-yellow' : profile?.role === 'admin' ? 'badge-purple' : 'badge-cyan'}`}>
                    {profile?.role === 'superadmin' ? '👑 Super Admin' : profile?.role === 'admin' ? '🛡️ Admin' : '🎓 MCA Student'}
                  </span>
                  <span className="badge badge-purple">{profile?.university || 'MCA University'}</span>
                  {rank > 0 && <span className="badge badge-yellow">🏆 Rank #{rank}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="font-display gradient-text" style={{ fontSize: 56, fontWeight: 800, lineHeight: 1 }}>{profile?.score || 0}</div>
                <div style={{ color: 'var(--text-3)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Total Score</div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 28 }}>
            {[
              { icon: <CheckCircle2 size={20} />, value: profile?.problemsSolved || 0, label: 'Solved', color: 'var(--green)' },
              { icon: <Code2 size={20} />, value: profile?.totalSubmissions || 0, label: 'Submissions', color: 'var(--purple-light)' },
              { icon: <Target size={20} />, value: `${accuracy}%`, label: 'Accuracy', color: 'var(--cyan)' },
              { icon: <Clock size={20} />, value: `${avgRuntime}ms`, label: 'Avg Runtime', color: 'var(--pink)' },
              { icon: <Trophy size={20} />, value: rank ? `#${rank}` : 'N/A', label: 'Rank', color: 'var(--yellow)' },
              { icon: <Star size={20} />, value: favLang.toUpperCase(), label: 'Fav Language', color: 'var(--text-2)' },
            ].map((s, i) => (
              <div key={i} className="stat-card">
                <div style={{ color: s.color, display: 'flex', justifyContent: 'center', marginBottom: 10 }}>{s.icon}</div>
                <div className="stat-number" style={{ color: s.color, fontSize: 28 }}>{s.value}</div>
                <div style={{ color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Achievements */}
          <div className="section-heading"><h2 style={{ fontSize: 20, fontWeight: 700 }}>Achievements 🏅</h2></div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
            {[
              { emoji: '🚀', label: 'First Solve', unlocked: (profile?.problemsSolved || 0) >= 1 },
              { emoji: '🔥', label: '10 Solved', unlocked: (profile?.problemsSolved || 0) >= 10 },
              { emoji: '💯', label: '100% Accuracy', unlocked: accuracy === 100 && submissions.length > 0 },
              { emoji: '⚡', label: 'Speed Coder', unlocked: avgRuntime < 100 && accepted.length > 0 },
              { emoji: '🏆', label: 'Top 10', unlocked: rank > 0 && rank <= 10 },
              { emoji: '👑', label: 'Problem Master', unlocked: (profile?.problemsSolved || 0) >= 50 },
            ].map((a, i) => (
              <div key={i} className="glass-card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10, opacity: a.unlocked ? 1 : 0.3, border: a.unlocked ? '1px solid var(--purple)' : undefined, filter: a.unlocked ? undefined : 'grayscale(1)' }}>
                <span style={{ fontSize: 24 }}>{a.emoji}</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{a.label}</span>
                {a.unlocked && <span className="badge badge-green" style={{ fontSize: 9 }}>✓</span>}
              </div>
            ))}
          </div>

          {/* Submission History */}
          <div className="section-heading"><h2 style={{ fontSize: 20, fontWeight: 700 }}>Submission History</h2></div>
          {loading ? (
            <div className="flex justify-center" style={{ padding: 40 }}><div className="spinner" /></div>
          ) : submissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
              <Code2 size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p>No submissions yet. Start solving! 💻</p>
            </div>
          ) : (
            <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Problem</th>
                    <th>Language</th>
                    <th>Status</th>
                    <th>Runtime</th>
                    <th>Score</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 500 }}>{s.problemTitle || 'Unknown'}</td>
                      <td><span className={`lang-badge ${LANG_COLORS[s.language] || ''}`}>{s.language?.toUpperCase()}</span></td>
                      <td>
                        <div className="flex items-center gap-1">
                          {s.status === 'accepted' ? <CheckCircle2 size={14} color="var(--green)" /> : <XCircle size={14} color="var(--red)" />}
                          <span className={`badge ${s.status === 'accepted' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10 }}>
                            {s.status === 'accepted' ? 'AC' : s.status === 'wrong_answer' ? 'WA' : 'RE'}
                          </span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--cyan)', fontFamily: 'monospace' }}>{s.runtime}ms</td>
                      <td style={{ color: 'var(--yellow)', fontWeight: 600 }}>{s.status === 'accepted' ? `+${Math.round(s.score)}` : '0'}</td>
                      <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{s.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ProfilePage;
