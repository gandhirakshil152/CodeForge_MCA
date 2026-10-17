import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  collection, getDocs, query, where, orderBy, onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  ClipboardList, Clock, Trophy, Lock, CheckCircle2, Play,
  Calendar, BookOpen, X, ExternalLink
} from 'lucide-react';
import Navbar from '../components/Navbar';

export interface MCQTest {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  totalQuestions: number;
  startTime: any;
  endTime: any;
  assignedTo: string[];   // teacher UIDs
  assignedClasses: string[]; // class/group tags
  createdBy: string;
  createdAt: any;
  status: 'draft' | 'scheduled' | 'active' | 'ended';
  passingScore: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResult: 'immediate' | 'after_end';
  type: 'mcq' | 'coding' | 'mixed';
  negativeMarking: number; // 0 means no negative marking
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'badge-purple',
  scheduled: 'badge-yellow',
  active: 'badge-green',
  ended: 'badge-red',
};

const TestsPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [tests, setTests] = useState<MCQTest[]>([]);
  const [myResults, setMyResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'available' | 'completed' | 'all'>('available');

  // Live leaderboard modal
  const [selectedLeaderboardTest, setSelectedLeaderboardTest] = useState<MCQTest | null>(null);
  const [leaderboardResults, setLeaderboardResults] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    // Real-time listener for tests
    const q = query(collection(db, 'mcq_tests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as MCQTest));
      setTests(all);
      setLoading(false);

      // Check URL query param ?leaderboard=<id>
      const urlParams = new URLSearchParams(window.location.search);
      const targetLb = urlParams.get('leaderboard');
      if (targetLb) {
        const found = all.find(t => t.id === targetLb);
        if (found) setSelectedLeaderboardTest(found);
      }
    });

    // Load my results
    const loadResults = async () => {
      try {
        const rSnap = await getDocs(
          query(collection(db, 'test_results'), where('userId', '==', user.uid))
        );
        const m: Record<string, any> = {};
        rSnap.docs.forEach(d => { m[d.data().testId] = d.data(); });
        setMyResults(m);
      } catch (e) { console.error(e); }
    };
    loadResults();

    return unsub;
  }, [user]);

  // Real-time leaderboard listener for selected test
  useEffect(() => {
    if (!selectedLeaderboardTest) { setLeaderboardResults([]); return; }
    const q = query(
      collection(db, 'test_results'),
      where('testId', '==', selectedLeaderboardTest.id)
    );
    const unsub = onSnapshot(q, snap => {
      const res = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.sort((a: any, b: any) => {
        if (b.score !== a.score) return (b.score || 0) - (a.score || 0);
        return (a.timeTaken || 0) - (b.timeTaken || 0);
      });
      setLeaderboardResults(res);
    });
    return unsub;
  }, [selectedLeaderboardTest]);

  const now = new Date();

  const getTestStatus = (t: MCQTest): MCQTest['status'] => {
    // If admin explicitly set status to active/draft/ended, honor it immediately!
    if (t.status === 'active') return 'active';
    if (t.status === 'draft') return 'draft';
    if (t.status === 'ended') return 'ended';

    if (!t.startTime?.toDate) return t.status || 'active';
    const start = t.startTime.toDate();
    const end = t.endTime?.toDate ? t.endTime.toDate() : null;
    if (end && now > end) return 'ended';
    if (now >= start) return 'active';
    return 'scheduled';
  };

  const [typeFilter, setTypeFilter] = useState<'all' | 'mcq' | 'coding'>('all');

  const visibleTests = tests.filter(t => {
    if (isAdmin) return true;
    return t.status !== 'draft';
  });

  const filteredTests = visibleTests.filter(t => {
    // Type Filter (MCQ vs Programming)
    if (typeFilter === 'mcq' && t.type === 'coding') return false;
    if (typeFilter === 'coding' && t.type !== 'coding' && t.type !== 'mixed') return false;

    // Status Filter
    const liveStatus = getTestStatus(t);
    if (activeTab === 'available') return liveStatus === 'active' || liveStatus === 'scheduled';
    if (activeTab === 'completed') return !!myResults[t.id];
    return true;
  });

  const fmtDuration = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const fmtDate = (ts: any) => {
    if (!ts?.toDate) return '—';
    return ts.toDate().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const canTake = (t: MCQTest) => {
    const s = getTestStatus(t);
    return (s === 'active' || t.status === 'active') && (!myResults[t.id] || isAdmin);
  };

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-content">
          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center',
                justifyContent: 'center', background: 'linear-gradient(135deg,rgba(34,211,238,0.2),rgba(34,211,238,0.05))',
                border: '1px solid rgba(34,211,238,0.4)',
              }}>
                <ClipboardList size={22} color="var(--cyan)" />
              </div>
              <div>
                <h1 className="font-display gradient-text" style={{ fontSize: 'clamp(28px,5vw,40px)', fontWeight: 800, lineHeight: 1.1 }}>
                  Tests &amp; Assessments
                </h1>
                <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 4 }}>
                  Placement preparation, MCQ tests &amp; live programming challenges with independent leaderboards
                </p>
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
              {[
                { label: 'MCQ Tests', val: tests.filter(t => t.type !== 'coding').length, color: 'var(--cyan)' },
                { label: 'Programming Tests', val: tests.filter(t => t.type === 'coding' || t.type === 'mixed').length, color: 'var(--purple-light)' },
                { label: 'Active Now', val: tests.filter(t => getTestStatus(t) === 'active').length, color: 'var(--green)' },
                { label: 'Completed', val: Object.keys(myResults).length, color: 'var(--yellow)' },
              ].map(s => (
                <div key={s.label} className="glass-card" style={{ padding: '12px 20px', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'Syne,sans-serif' }}>{s.val}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Test Type Tabs: ALL vs MCQ vs PROGRAMMING */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <button
              className="btn btn-sm"
              style={{
                background: typeFilter === 'all' ? 'linear-gradient(135deg, var(--purple), var(--cyan))' : 'rgba(255,255,255,0.03)',
                color: typeFilter === 'all' ? '#fff' : 'var(--text-2)',
                border: typeFilter === 'all' ? 'none' : '1px solid var(--border)',
                fontWeight: 700,
                padding: '7px 16px',
              }}
              onClick={() => setTypeFilter('all')}
            >
              ⚡ All Tests ({visibleTests.length})
            </button>

            <button
              className="btn btn-sm"
              style={{
                background: typeFilter === 'mcq' ? 'linear-gradient(135deg, var(--cyan), #0284c7)' : 'rgba(255,255,255,0.03)',
                color: typeFilter === 'mcq' ? '#fff' : 'var(--text-2)',
                border: typeFilter === 'mcq' ? 'none' : '1px solid var(--border)',
                fontWeight: 700,
                padding: '7px 16px',
              }}
              onClick={() => setTypeFilter('mcq')}
            >
              📝 MCQ Tests ({visibleTests.filter(t => t.type !== 'coding').length})
            </button>

            <button
              className="btn btn-sm"
              style={{
                background: typeFilter === 'coding' ? 'linear-gradient(135deg, var(--purple-light), #7c3aed)' : 'rgba(255,255,255,0.03)',
                color: typeFilter === 'coding' ? '#fff' : 'var(--text-2)',
                border: typeFilter === 'coding' ? 'none' : '1px solid var(--border)',
                fontWeight: 700,
                padding: '7px 16px',
              }}
              onClick={() => setTypeFilter('coding')}
            >
              💻 Programming Tests ({visibleTests.filter(t => t.type === 'coding' || t.type === 'mixed').length})
            </button>
          </div>

          {/* Sub-Tabs: Available vs Completed vs All */}
          <div className="tabs" style={{ marginBottom: 24, maxWidth: 380 }}>
            {(['available', 'completed', 'all'] as const).map(t => (
              <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
                {t === 'available' ? '🟢 Available' : t === 'completed' ? '✅ Completed' : '📋 All Status'}
              </button>
            ))}
          </div>

          {/* Tests Grid */}
          {loading ? (
            <div className="flex justify-center items-center" style={{ height: 200 }}>
              <div className="spinner" />
            </div>
          ) : filteredTests.length === 0 ? (
            <div className="glass-card" style={{ padding: 60, textAlign: 'center' }}>
              <ClipboardList size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
              <p style={{ color: 'var(--text-2)', fontSize: 17, fontWeight: 600 }}>
                {activeTab === 'available' ? 'No active tests right now.' : 'No tests found.'}
              </p>
              <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 8 }}>
                {activeTab === 'available' ? 'Your faculty will assign tests soon.' : ''}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
              {filteredTests.map(t => {
                const liveStatus = getTestStatus(t);
                const done = !!myResults[t.id];
                const result = myResults[t.id];
                const canGo = canTake(t);

                return (
                  <div key={t.id} className="glass-card" style={{
                    padding: 24, cursor: canGo ? 'pointer' : 'default',
                    border: liveStatus === 'active' ? '1px solid rgba(16,185,129,0.4)' : undefined,
                    position: 'relative', overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  }}
                    onClick={() => {
                      if (canGo) navigate(`/test/${t.id}`);
                    }}
                  >
                    {/* Glow top border */}
                    {liveStatus === 'active' && (
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                        background: 'linear-gradient(90deg, var(--green), var(--cyan))',
                      }} />
                    )}

                    <div>
                      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                        <span className={`badge ${STATUS_COLOR[liveStatus] || 'badge-purple'}`}>
                          {liveStatus === 'active' && '🟢 '}{liveStatus.toUpperCase()}
                        </span>
                        <span className="badge" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                          {t.type === 'mcq' ? '📝 MCQ' : t.type === 'coding' ? '💻 Coding' : '🔀 Mixed'}
                        </span>
                      </div>

                      <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>{t.title}</h3>
                      {t.description && (
                        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.5 }}>
                          {t.description.slice(0, 100)}{t.description.length > 100 ? '…' : ''}
                        </p>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                        {[
                          { icon: <BookOpen size={13} />, val: `${t.totalQuestions} Questions` },
                          { icon: <Clock size={13} />, val: fmtDuration(t.durationMinutes) },
                          { icon: <Calendar size={13} />, val: fmtDate(t.startTime) },
                          { icon: <Trophy size={13} />, val: `Pass: ${t.passingScore}%` },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-2" style={{ fontSize: 12, color: 'var(--text-2)' }}>
                            <span style={{ color: 'var(--purple-light)', flexShrink: 0 }}>{item.icon}</span>
                            {item.val}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Result or CTA + Live Leaderboard button */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                      {done ? (
                        <div style={{
                          padding: '10px 14px', borderRadius: 10,
                          background: result.score >= t.passingScore ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          border: `1px solid ${result.score >= t.passingScore ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                          display: 'flex', alignItems: 'center', gap: 10,
                        }}>
                          <CheckCircle2 size={16} color={result.score >= t.passingScore ? 'var(--green)' : 'var(--red)'} />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>
                            Score: {result.score}/{result.totalMarks} ({Math.round((result.score / result.totalMarks) * 100)}%)
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>
                            {result.score >= t.passingScore ? 'PASS' : 'FAIL'}
                          </span>
                        </div>
                      ) : canGo ? (
                        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                          <Play size={15} /> Start Test
                        </button>
                      ) : liveStatus === 'scheduled' ? (
                        <div className="flex items-center gap-2" style={{ color: 'var(--yellow)', fontSize: 13 }}>
                          <Calendar size={14} /> Opens {fmtDate(t.startTime)}
                        </div>
                      ) : liveStatus === 'ended' ? (
                        <div className="flex items-center gap-2" style={{ color: 'var(--text-3)', fontSize: 13 }}>
                          <Lock size={14} /> Test has ended
                        </div>
                      ) : null}

                      {/* Live Leaderboard button */}
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{
                          width: '100%', justifyContent: 'center',
                          color: t.type === 'coding' ? 'var(--purple-light)' : 'var(--cyan)',
                          border: t.type === 'coding' ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(34,211,238,0.3)',
                          fontWeight: 600,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLeaderboardTest(t);
                        }}
                      >
                        <Trophy size={13} /> View {t.type === 'coding' ? 'Programming' : 'MCQ'} Leaderboard
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════
            STUDENT LIVE LEADERBOARD MODAL
        ══════════════════════════════════════════════════════════════ */}
        {selectedLeaderboardTest && (
          <div className="modal-overlay" onClick={() => setSelectedLeaderboardTest(null)}>
            <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span className={`badge ${selectedLeaderboardTest.type === 'coding' ? 'badge-purple' : 'badge-green'}`} style={{ fontSize: 10 }}>
                      {selectedLeaderboardTest.type === 'coding' ? '💻 Programming Challenge Test' : '📝 MCQ Assessment Test'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      Pass: {selectedLeaderboardTest.passingScore || 50}%
                    </span>
                  </div>
                  <h3 style={{ fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Trophy size={18} color="var(--yellow)" />
                    {selectedLeaderboardTest.title}
                  </h3>
                  <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>
                    Real-time rankings based on score and test completion speed
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Link
                    to={`/leaderboard?testId=${selectedLeaderboardTest.id}`}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, color: 'var(--cyan)', border: '1px solid rgba(34,211,238,0.3)' }}
                    title="Open on full Leaderboard page with podium"
                  >
                    <ExternalLink size={12} /> Full Page
                  </Link>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedLeaderboardTest(null)}><X size={15} /></button>
                </div>
              </div>

              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {leaderboardResults.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
                    <Trophy size={36} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                    <p>No student results yet for this test.</p>
                    <p style={{ fontSize: 12, marginTop: 4 }}>Be the first candidate to complete it!</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {leaderboardResults.map((r, i) => {
                      const isTop3 = i < 3;
                      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
                      const isMe = r.userId === user?.uid;

                      return (
                        <div
                          key={r.id || i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            borderRadius: 'var(--radius-md)',
                            background: isMe
                              ? 'rgba(139,92,246,0.18)'
                              : isTop3
                              ? 'rgba(245,158,11,0.08)'
                              : 'rgba(255,255,255,0.02)',
                            border: isMe
                              ? '1px solid var(--purple)'
                              : isTop3
                              ? '1px solid rgba(245,158,11,0.3)'
                              : '1px solid var(--border)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: isTop3 ? 20 : 13, fontWeight: 700, width: 28, textAlign: 'center' }}>
                              {medal}
                            </span>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14, color: isMe ? 'var(--purple-light)' : 'var(--text-1)' }}>
                                {r.userName || 'Student'} {isMe && '(You)'}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                                ⏱ {r.timeTaken ? `${Math.floor(r.timeTaken / 60)}m ${r.timeTaken % 60}s` : '—'} • {r.correct || 0} Correct
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: r.passed ? 'var(--green)' : 'var(--yellow)', fontFamily: 'Syne,sans-serif' }}>
                              {r.score} / {r.totalMarks}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                              {r.percentage}% {r.passed ? '✓ Passed' : ''}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  ⚡ Live leaderboard updates in real-time
                </span>
                <button className="btn btn-ghost" onClick={() => setSelectedLeaderboardTest(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default TestsPage;
