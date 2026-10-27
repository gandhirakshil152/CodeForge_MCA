import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Trophy, Medal, Crown, Zap, Code2, ClipboardList,
  ChevronRight, Download
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

interface LeaderboardUser {
  uid: string;
  displayName: string;
  email: string;
  score: number;
  problemsSolved: number;
  totalSubmissions: number;
  university: string;
}

interface TestItem {
  id: string;
  title: string;
  type?: 'mcq' | 'coding' | 'mixed';
  durationMinutes?: number;
  totalQuestions?: number;
  passingScore?: number;
  status?: string;
}

const TABS = ['Overall', 'This Week', 'Today'];

const LeaderboardPage: React.FC = () => {
  const { user } = useAuth();
  
  // Category: 'global' | 'mcq' | 'coding'
  const [category, setCategory] = useState<'global' | 'mcq' | 'coding'>('global');
  
  // Global leaderboard state
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overall');

  // Test-specific leaderboard state
  const [allTests, setAllTests] = useState<TestItem[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testResultsLoading, setTestResultsLoading] = useState(false);

  // 1. Load global user rankings
  useEffect(() => {
    const loadGlobal = async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('score', 'desc'), limit(100));
        const snap = await getDocs(q);
        setUsers(snap.docs.map(d => ({ ...d.data() } as LeaderboardUser)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadGlobal();
  }, []);

  // 2. Load all tests (MCQ and Programming tests)
  useEffect(() => {
    const q = query(collection(db, 'mcq_tests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as TestItem));
      setAllTests(list);

      // Check query params for direct deep-link
      const params = new URLSearchParams(window.location.search);
      const qTestId = params.get('testId');
      const qType = params.get('type');

      if (qTestId) {
        const target = list.find(t => t.id === qTestId);
        if (target) {
          setSelectedTestId(target.id);
          setCategory(target.type === 'coding' ? 'coding' : 'mcq');
          return;
        }
      }

      if (qType === 'mcq') {
        setCategory('mcq');
      } else if (qType === 'coding') {
        setCategory('coding');
      }
    });

    return unsub;
  }, []);

  // Filter tests by current category
  const mcqTests = allTests.filter(t => t.type !== 'coding');
  const codingTests = allTests.filter(t => t.type === 'coding' || t.type === 'mixed');
  const activeCategoryTests = category === 'coding' ? codingTests : mcqTests;

  // Auto-select first test if none selected in test categories
  useEffect(() => {
    if ((category === 'mcq' || category === 'coding') && !selectedTestId) {
      if (activeCategoryTests.length > 0) {
        setSelectedTestId(activeCategoryTests[0].id);
      }
    } else if (category === 'mcq' && selectedTestId) {
      // If selected test is not in mcq, switch to first mcq
      const exists = mcqTests.some(t => t.id === selectedTestId);
      if (!exists && mcqTests.length > 0) setSelectedTestId(mcqTests[0].id);
    } else if (category === 'coding' && selectedTestId) {
      // If selected test is not in coding, switch to first coding
      const exists = codingTests.some(t => t.id === selectedTestId);
      if (!exists && codingTests.length > 0) setSelectedTestId(codingTests[0].id);
    }
  }, [category, activeCategoryTests, selectedTestId]);

  // 3. Real-time listener for the selected test's individual leaderboard
  useEffect(() => {
    if (!selectedTestId || category === 'global') {
      setTestResults([]);
      return;
    }

    setTestResultsLoading(true);
    const q = query(
      collection(db, 'test_results'),
      where('testId', '==', selectedTestId)
    );

    const unsub = onSnapshot(q, snap => {
      const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort client-side by score desc, then timeTaken asc
      results.sort((a: any, b: any) => {
        if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
        return (a.timeTaken || 0) - (b.timeTaken || 0);
      });
      setTestResults(results);
      setTestResultsLoading(false);
    });

    return unsub;
  }, [selectedTestId, category]);

  const selectedTest = allTests.find(t => t.id === selectedTestId);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown size={20} color="#f59e0b" fill="#f59e0b" />;
    if (rank === 2) return <Medal size={20} color="#94a3b8" fill="#94a3b8" />;
    if (rank === 3) return <Medal size={20} color="#b45309" fill="#b45309" />;
    return <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: 'var(--text-3)', fontWeight: 700 }}>#{rank}</span>;
  };

  const myRank = users.findIndex(u => u.uid === user?.uid) + 1;
  const myTestRank = testResults.findIndex(r => r.userId === user?.uid) + 1;

  // Export results of the current test
  const exportTestResultsCsv = () => {
    if (!selectedTest || testResults.length === 0) return;
    const isCoding = selectedTest.type === 'coding' || selectedTest.type === 'mixed';
    
    const headers = ['Rank', 'Candidate Name', 'Email', 'Score', 'Total Marks', 'Percentage', 'Status', isCoding ? 'Test Cases Passed' : 'Correct MCQ', 'Time Taken (s)', 'Submitted At'];
    const rows = testResults.map((r, i) => [
      i + 1,
      `"${r.userName || 'Student'}"`,
      `"${r.userEmail || ''}"`,
      r.score || 0,
      r.totalMarks || 0,
      `${r.percentage || 0}%`,
      r.passed ? 'PASSED' : 'FAILED',
      r.correct || 0,
      r.timeTaken || 0,
      r.submittedAt?.toDate ? `"${r.submittedAt.toDate().toLocaleString()}"` : '—',
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedTest.title.replace(/[^a-zA-Z0-9]/g, '_')}_Leaderboard.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-content">
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div className="badge badge-yellow" style={{ marginBottom: 14, fontSize: 13 }}>
              <Trophy size={13} /> Live Hall of Fame
            </div>
            <h1 className="font-display gradient-text" style={{ fontSize: 'clamp(32px, 5vw, 54px)', fontWeight: 800 }}>
              Live Leaderboard &amp; Rankings 🏆
            </h1>
            <p style={{ color: 'var(--text-2)', marginTop: 8, fontSize: 15, maxWidth: 620, margin: '8px auto 0' }}>
              Compare performances across Global DSA challenges, placement MCQ tests, and live Programming coding drives.
            </p>
            <div style={{ marginTop: 14 }}>
              <Link to="/rules" className="btn btn-ghost btn-sm" style={{ gap: 6, fontSize: 12, borderColor: 'rgba(245,158,11,0.3)', color: 'var(--yellow)' }}>
                📜 View How Points &amp; Rankings are Counted →
              </Link>
            </div>
          </div>

          {/* PRIMARY CATEGORY SELECTOR (GLOBAL vs MCQ TESTS vs PROGRAMMING TESTS) */}
          <div style={{
            display: 'flex', justifyContent: 'center', marginBottom: 32,
          }}>
            <div style={{
              display: 'flex', gap: 6, padding: 6, borderRadius: 'var(--radius-lg)',
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
              flexWrap: 'wrap', justifyContent: 'center',
            }}>
              <button
                className="btn btn-sm"
                style={{
                  background: category === 'global' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent',
                  color: category === 'global' ? '#fff' : 'var(--text-2)',
                  fontWeight: 700,
                  border: 'none',
                  padding: '8px 18px',
                }}
                onClick={() => setCategory('global')}
              >
                <Trophy size={15} /> 🌟 Global Platform
              </button>

              <button
                className="btn btn-sm"
                style={{
                  background: category === 'mcq' ? 'linear-gradient(135deg, var(--cyan), #0284c7)' : 'transparent',
                  color: category === 'mcq' ? '#fff' : 'var(--text-2)',
                  fontWeight: 700,
                  border: 'none',
                  padding: '8px 18px',
                }}
                onClick={() => {
                  setCategory('mcq');
                  if (mcqTests.length > 0 && !selectedTestId) setSelectedTestId(mcqTests[0].id);
                }}
              >
                <ClipboardList size={15} /> 📝 MCQ Test Leaderboards ({mcqTests.length})
              </button>

              <button
                className="btn btn-sm"
                style={{
                  background: category === 'coding' ? 'linear-gradient(135deg, var(--purple-light), #7c3aed)' : 'transparent',
                  color: category === 'coding' ? '#fff' : 'var(--text-2)',
                  fontWeight: 700,
                  border: 'none',
                  padding: '8px 18px',
                }}
                onClick={() => {
                  setCategory('coding');
                  if (codingTests.length > 0 && !selectedTestId) setSelectedTestId(codingTests[0].id);
                }}
              >
                <Code2 size={15} /> 💻 Programming Test Leaderboards ({codingTests.length})
              </button>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              VIEW 1: GLOBAL PLATFORM LEADERBOARD
          ══════════════════════════════════════════════════════════════ */}
          {category === 'global' && (
            <div>
              {/* My Rank Card */}
              {user && myRank > 0 && (
                <div className="glass-card" style={{ padding: 20, marginBottom: 32, border: '1px solid rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.05)' }}>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <Zap size={20} color="var(--purple-light)" />
                      <span style={{ fontWeight: 700, fontSize: 16 }}>Your Global Rank: #{myRank}</span>
                    </div>
                    <div className="flex gap-6 flex-wrap">
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--purple-light)' }}>
                          {users[myRank - 1]?.score || 0}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Score</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--cyan)' }}>
                          {users[myRank - 1]?.problemsSolved || 0}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Solved</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Top 3 Podium */}
              {!loading && users.length >= 3 && (
                <div className="flex justify-center gap-4 items-end flex-wrap" style={{ marginBottom: 48 }}>
                  {/* 2nd place */}
                  <div style={{ textAlign: 'center' }}>
                    <div className="avatar" style={{ width: 56, height: 56, fontSize: 22, margin: '0 auto 8px', background: 'linear-gradient(135deg, #94a3b8, #64748b)' }}>
                      {users[1]?.displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{users[1]?.displayName}</div>
                    <div style={{ color: 'var(--text-2)', fontSize: 13 }}>{users[1]?.score} pts</div>
                    <div style={{ marginTop: 12, background: 'rgba(148,163,184,0.15)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: '12px 12px 0 0', padding: '20px 24px 8px', width: 120, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
                      <Medal size={28} color="#94a3b8" fill="#94a3b8" />
                    </div>
                  </div>
                  {/* 1st place */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>👑</div>
                    <div className="avatar" style={{ width: 72, height: 72, fontSize: 28, margin: '0 auto 8px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 0 30px rgba(245,158,11,0.4)' }}>
                      {users[0]?.displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{users[0]?.displayName}</div>
                    <div style={{ color: 'var(--yellow)', fontSize: 14, fontWeight: 600 }}>{users[0]?.score} pts</div>
                    <div style={{ marginTop: 12, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px 12px 0 0', padding: '28px 24px 8px', width: 120, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
                      <Crown size={32} color="#f59e0b" fill="#f59e0b" />
                    </div>
                  </div>
                  {/* 3rd place */}
                  <div style={{ textAlign: 'center' }}>
                    <div className="avatar" style={{ width: 56, height: 56, fontSize: 22, margin: '0 auto 8px', background: 'linear-gradient(135deg, #b45309, #92400e)' }}>
                      {users[2]?.displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{users[2]?.displayName}</div>
                    <div style={{ color: 'var(--text-2)', fontSize: 13 }}>{users[2]?.score} pts</div>
                    <div style={{ marginTop: 12, background: 'rgba(180,83,9,0.15)', border: '1px solid rgba(180,83,9,0.3)', borderRadius: '12px 12px 0 0', padding: '14px 24px 8px', width: 120, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
                      <Medal size={24} color="#b45309" fill="#b45309" />
                    </div>
                  </div>
                </div>
              )}

              {/* Time Tabs */}
              <div className="tabs" style={{ marginBottom: 24, maxWidth: 400 }}>
                {TABS.map(t => (
                  <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
                    {t}
                  </button>
                ))}
              </div>

              {/* Full Global Table */}
              {loading ? (
                <div className="flex justify-center items-center" style={{ height: 200 }}>
                  <div className="spinner" />
                </div>
              ) : users.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-3)' }}>
                  <Trophy size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
                  <p style={{ fontSize: 18 }}>No users yet. Be the first to join! 🚀</p>
                </div>
              ) : (
                <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
                  <div className="leaderboard-row" style={{ borderBottom: '1px solid var(--border)', padding: '12px 20px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Rank</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Student</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Solved</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Submissions</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Score</div>
                  </div>
                  {users.map((u, i) => {
                    const rank = i + 1;
                    const isMe = u.uid === user?.uid;
                    return (
                      <div key={u.uid} className={`leaderboard-row ${rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : ''}`}
                        style={{ borderBottom: '1px solid rgba(139,92,246,0.05)', background: isMe ? 'rgba(139,92,246,0.08)' : undefined }}>
                        <div className="flex items-center justify-center" style={{ width: 40 }}>{getRankIcon(rank)}</div>
                        <div className="flex items-center gap-3">
                          <div className="avatar" style={{ width: 36, height: 36, fontSize: 14, flexShrink: 0 }}>
                            {u.displayName?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>
                              {u.displayName}
                              {isMe && <span className="badge badge-purple" style={{ marginLeft: 8, fontSize: 9 }}>You</span>}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{u.university || 'MCA Student'}</div>
                          </div>
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--cyan)', fontSize: 15 }}>{u.problemsSolved || 0}</div>
                        <div style={{ color: 'var(--text-2)', fontSize: 14 }}>{u.totalSubmissions || 0}</div>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 16, color: rank <= 3 ? 'var(--yellow)' : 'var(--purple-light)' }}>
                            {u.score || 0}
                          </span>
                          <span style={{ color: 'var(--text-3)', fontSize: 12 }}> pts</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              VIEW 2: INDIVIDUAL TEST LEADERBOARD (MCQ or PROGRAMMING)
          ══════════════════════════════════════════════════════════════ */}
          {(category === 'mcq' || category === 'coding') && (
            <div>
              {/* Test Picker Header */}
              <div className="glass-card" style={{ padding: '16px 20px', marginBottom: 24, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                      Select {category === 'coding' ? 'Programming' : 'MCQ'} Test:
                    </label>
                    <select
                      className="input"
                      style={{ maxWidth: 420 }}
                      value={selectedTestId}
                      onChange={e => setSelectedTestId(e.target.value)}
                    >
                      {activeCategoryTests.length === 0 ? (
                        <option value="">No tests found in this category</option>
                      ) : (
                        activeCategoryTests.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.title} ({t.totalQuestions || 0} Qs • {t.durationMinutes}m)
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {selectedTest && testResults.length > 0 && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={exportTestResultsCsv}
                      style={{ color: 'var(--cyan)', border: '1px solid rgba(34,211,238,0.3)' }}
                    >
                      <Download size={14} /> Export Test Leaderboard CSV
                    </button>
                  )}
                </div>
              </div>

              {/* No tests found in category */}
              {activeCategoryTests.length === 0 ? (
                <div className="glass-card" style={{ padding: 60, textAlign: 'center' }}>
                  {category === 'coding' ? (
                    <Code2 size={48} style={{ margin: '0 auto 16px', opacity: 0.3, color: 'var(--purple-light)' }} />
                  ) : (
                    <ClipboardList size={48} style={{ margin: '0 auto 16px', opacity: 0.3, color: 'var(--cyan)' }} />
                  )}
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                    No {category === 'coding' ? 'Programming' : 'MCQ'} Tests Available
                  </h3>
                  <p style={{ color: 'var(--text-3)', fontSize: 13, maxWidth: 440, margin: '0 auto 16px' }}>
                    Faculty or Admin has not created any {category === 'coding' ? 'Programming' : 'MCQ'} tests yet.
                  </p>
                  <Link to="/tests" className="btn btn-primary btn-sm">
                    View All Active Tests
                  </Link>
                </div>
              ) : !selectedTest ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </div>
              ) : (
                <div>
                  {/* Selected Test Information Banner */}
                  <div className="glass-card" style={{
                    padding: '20px 24px', marginBottom: 28,
                    border: category === 'coding' ? '1px solid rgba(168,85,247,0.35)' : '1px solid rgba(34,211,238,0.35)',
                    background: category === 'coding' ? 'rgba(168,85,247,0.04)' : 'rgba(34,211,238,0.04)',
                    borderRadius: 'var(--radius-lg)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span className={`badge ${category === 'coding' ? 'badge-purple' : 'badge-green'}`} style={{ fontSize: 11 }}>
                            {category === 'coding' ? '💻 Programming Challenge Test' : '📝 MCQ Assessment Test'}
                          </span>
                          <span className="badge" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', fontSize: 11 }}>
                            Passing Score: {selectedTest.passingScore ?? 50}%
                          </span>
                        </div>
                        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', marginBottom: 6 }}>
                          {selectedTest.title}
                        </h2>
                        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-3)', flexWrap: 'wrap' }}>
                          <span>⏱️ {selectedTest.durationMinutes || 30} Minutes Duration</span>
                          <span>📚 {selectedTest.totalQuestions || 0} Questions</span>
                          <span>👥 {testResults.length} Candidate Submissions</span>
                        </div>
                      </div>

                      <Link
                        to={`/test/${selectedTest.id}`}
                        className="btn btn-sm btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        Take This Test <ChevronRight size={14} />
                      </Link>
                    </div>

                    {/* Candidate's Own Rank In This Test */}
                    {user && myTestRank > 0 && (
                      <div style={{
                        marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Zap size={16} color="var(--yellow)" />
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>
                            Your Ranking in this Test: <span style={{ color: 'var(--yellow)', fontSize: 15 }}>#{myTestRank}</span> of {testResults.length}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: testResults[myTestRank - 1]?.passed ? 'var(--green)' : 'var(--yellow)' }}>
                          Score: {testResults[myTestRank - 1]?.score} / {testResults[myTestRank - 1]?.totalMarks} ({testResults[myTestRank - 1]?.percentage}%)
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Test-Specific Podium (Top 3) */}
                  {!testResultsLoading && testResults.length >= 3 && (
                    <div className="flex justify-center gap-4 items-end flex-wrap" style={{ marginBottom: 40 }}>
                      {/* 2nd place */}
                      <div style={{ textAlign: 'center' }}>
                        <div className="avatar" style={{ width: 56, height: 56, fontSize: 20, margin: '0 auto 8px', background: 'linear-gradient(135deg, #94a3b8, #64748b)' }}>
                          {testResults[1]?.userName?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{testResults[1]?.userName}</div>
                        <div style={{ color: 'var(--text-2)', fontSize: 12 }}>{testResults[1]?.score} / {testResults[1]?.totalMarks} ({testResults[1]?.percentage}%)</div>
                        <div style={{ marginTop: 10, background: 'rgba(148,163,184,0.15)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: '12px 12px 0 0', padding: '16px 20px 8px', width: 110, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
                          <Medal size={26} color="#94a3b8" fill="#94a3b8" />
                        </div>
                      </div>
                      {/* 1st place */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 22, marginBottom: 2 }}>👑</div>
                        <div className="avatar" style={{ width: 70, height: 70, fontSize: 26, margin: '0 auto 8px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 0 25px rgba(245,158,11,0.35)' }}>
                          {testResults[0]?.userName?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>{testResults[0]?.userName}</div>
                        <div style={{ color: 'var(--yellow)', fontSize: 13, fontWeight: 700 }}>{testResults[0]?.score} / {testResults[0]?.totalMarks} ({testResults[0]?.percentage}%)</div>
                        <div style={{ marginTop: 10, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px 12px 0 0', padding: '24px 20px 8px', width: 110, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
                          <Crown size={30} color="#f59e0b" fill="#f59e0b" />
                        </div>
                      </div>
                      {/* 3rd place */}
                      <div style={{ textAlign: 'center' }}>
                        <div className="avatar" style={{ width: 56, height: 56, fontSize: 20, margin: '0 auto 8px', background: 'linear-gradient(135deg, #b45309, #92400e)' }}>
                          {testResults[2]?.userName?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{testResults[2]?.userName}</div>
                        <div style={{ color: 'var(--text-2)', fontSize: 12 }}>{testResults[2]?.score} / {testResults[2]?.totalMarks} ({testResults[2]?.percentage}%)</div>
                        <div style={{ marginTop: 10, background: 'rgba(180,83,9,0.15)', border: '1px solid rgba(180,83,9,0.3)', borderRadius: '12px 12px 0 0', padding: '12px 20px 8px', width: 110, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
                          <Medal size={22} color="#b45309" fill="#b45309" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Test Rankings Table */}
                  {testResultsLoading ? (
                    <div className="flex justify-center items-center" style={{ height: 200 }}>
                      <div className="spinner" />
                    </div>
                  ) : testResults.length === 0 ? (
                    <div className="glass-card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>
                      <Trophy size={42} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                      <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>
                        No Submissions Yet for this Test
                      </h4>
                      <p style={{ fontSize: 13, maxWidth: 360, margin: '0 auto 16px' }}>
                        Be the first student to take this {category === 'coding' ? 'programming challenge' : 'MCQ test'} and claim rank #1!
                      </p>
                      <Link to={`/test/${selectedTest.id}`} className="btn btn-primary btn-sm">
                        Start Test Now 🚀
                      </Link>
                    </div>
                  ) : (
                    <div className="glass-card" style={{ overflowX: 'auto', padding: 0 }}>
                      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)', color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            <th style={{ padding: '14px 16px', width: 70, textAlign: 'center' }}>Rank</th>
                            <th style={{ padding: '14px 16px' }}>Candidate Name</th>
                            <th style={{ padding: '14px 16px' }}>Score</th>
                            <th style={{ padding: '14px 16px' }}>Percentage</th>
                            <th style={{ padding: '14px 16px' }}>Status</th>
                            <th style={{ padding: '14px 16px' }}>
                              {category === 'coding' ? 'Test Cases Passed' : 'Correct MCQ'}
                            </th>
                            <th style={{ padding: '14px 16px' }}>Time Taken</th>
                            <th style={{ padding: '14px 16px' }}>Submitted</th>
                          </tr>
                        </thead>
                        <tbody>
                          {testResults.map((r, i) => {
                            const rank = i + 1;
                            const isMe = r.userId === user?.uid;

                            return (
                              <tr
                                key={r.id || i}
                                style={{
                                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                                  background: isMe
                                    ? 'rgba(139,92,246,0.12)'
                                    : rank === 1
                                    ? 'rgba(245,158,11,0.05)'
                                    : undefined,
                                }}
                              >
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                  {getRankIcon(rank)}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div className="avatar" style={{ width: 32, height: 32, fontSize: 12, flexShrink: 0 }}>
                                      {r.userName?.[0]?.toUpperCase() || 'U'}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 700, color: isMe ? 'var(--purple-light)' : 'var(--text-1)' }}>
                                        {r.userName || 'Student'} {isMe && '(You)'}
                                      </div>
                                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                                        {r.userEmail || ''}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{ fontWeight: 800, fontSize: 15, color: r.passed ? 'var(--green)' : 'var(--yellow)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                                    {r.score}
                                  </span>
                                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}> / {r.totalMarks}</span>
                                </td>
                                <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                                  {r.percentage}%
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span className={`badge ${r.passed ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10 }}>
                                    {r.passed ? '✓ PASSED' : '✕ FAILED'}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px', color: 'var(--text-2)' }}>
                                  {category === 'coding' ? (
                                    <span>🧪 {r.correct || 0} passed</span>
                                  ) : (
                                    <span>✓ {r.correct || 0} / {selectedTest.totalQuestions}</span>
                                  )}
                                </td>
                                <td style={{ padding: '12px 16px', color: 'var(--text-3)' }}>
                                  ⏱ {r.timeTaken ? `${Math.floor(r.timeTaken / 60)}m ${r.timeTaken % 60}s` : '—'}
                                </td>
                                <td style={{ padding: '12px 16px', color: 'var(--text-3)', fontSize: 11 }}>
                                  {r.submittedAt?.toDate ? r.submittedAt.toDate().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default LeaderboardPage;
