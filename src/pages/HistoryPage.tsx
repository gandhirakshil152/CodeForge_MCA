import React, { useEffect, useState, useMemo } from 'react';
import {
  collection, getDocs, query, orderBy, where, limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import {
  History, Search, CheckCircle2, XCircle, Clock,
  Code2, Database, TrendingDown, AlertTriangle,
  ChevronDown, ChevronUp, Eye, EyeOff,
  RefreshCw, Shield, Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Submission {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  problemId?: string;
  problemTitle?: string;
  questionId?: string;
  questionTitle?: string;
  language?: string;
  status: string;
  runtime?: number;
  score?: number;
  points?: number;
  code?: string;
  userQuery?: string;
  todayDate?: string;
  createdAt: any;
  submittedAt?: any;
  penalty?: number;
  penaltyReason?: string;
  source?: 'coding' | 'dbms';
  adminRemarks?: string;
  topic?: string;
  difficulty?: string;
  dialect?: string;
}

const statusColor = (status: string) => {
  if (status === 'accepted' || status === 'pass') return 'var(--green)';
  if (status === 'wrong_answer' || status === 'fail') return 'var(--red)';
  if (status === 'pending') return 'var(--yellow)';
  return 'var(--text-3)';
};

const statusLabel = (status: string) => {
  if (status === 'accepted') return '✓ Accepted';
  if (status === 'pass') return '✓ Passed';
  if (status === 'wrong_answer') return '✕ Wrong Answer';
  if (status === 'fail') return '✕ Failed';
  if (status === 'pending') return '⏳ Pending';
  if (status === 'error') return '💥 Error';
  return status;
};

const HistoryPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCode, setShowCode] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [allUsers, setAllUsers] = useState<{ uid: string; displayName: string; email: string }[]>([]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [codingSnap, dbmsSnap] = await Promise.all([
        isAdmin
          ? getDocs(query(collection(db, 'submissions'), orderBy('createdAt', 'desc'), limit(500)))
          : getDocs(query(collection(db, 'submissions'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(200))),
        isAdmin
          ? getDocs(query(collection(db, 'dbms_submissions'), orderBy('createdAt', 'desc'), limit(500)))
          : getDocs(query(collection(db, 'dbms_submissions'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(200))),
      ]);

      const coding: Submission[] = codingSnap.docs.map(d => ({
        id: d.id, source: 'coding' as const, ...d.data() as any,
      }));
      const dbms: Submission[] = dbmsSnap.docs.map(d => ({
        id: d.id, source: 'dbms' as const, ...d.data() as any,
      }));

      const all = [...coding, ...dbms].sort((a, b) => {
        const tA = a.createdAt?.toMillis?.() || a.submittedAt?.toMillis?.() || 0;
        const tB = b.createdAt?.toMillis?.() || b.submittedAt?.toMillis?.() || 0;
        return tB - tA;
      });

      setSubmissions(all);

      if (isAdmin) {
        const usersSnap = await getDocs(query(collection(db, 'users'), orderBy('displayName')));
        setAllUsers(usersSnap.docs.map(d => {
          const data = d.data() as any;
          return { uid: d.id, displayName: data.displayName || 'Unknown', email: data.email || '' };
        }));
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user, isAdmin]);

  const filtered = useMemo(() => {
    return submissions.filter(s => {
      const title = s.problemTitle || s.questionTitle || s.problemId || s.questionId || '';
      const name = s.userName || '';
      const email = s.userEmail || '';
      const matchSearch = !search || title.toLowerCase().includes(search.toLowerCase()) ||
        name.toLowerCase().includes(search.toLowerCase()) ||
        email.toLowerCase().includes(search.toLowerCase()) ||
        (s.language || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || s.status === statusFilter ||
        (statusFilter === 'penalized' && ((s.penalty || 0) < 0 || !!s.penaltyReason));
      const matchSource = sourceFilter === 'all' || s.source === sourceFilter;
      const matchUser = userFilter === 'all' || s.userId === userFilter;
      return matchSearch && matchStatus && matchSource && matchUser;
    });
  }, [submissions, search, statusFilter, sourceFilter, userFilter]);

  const stats = useMemo(() => ({
    total: filtered.length,
    accepted: filtered.filter(s => s.status === 'accepted' || s.status === 'pass').length,
    wrong: filtered.filter(s => s.status === 'wrong_answer' || s.status === 'fail').length,
    pending: filtered.filter(s => s.status === 'pending').length,
    penalties: filtered.filter(s => (s.penalty || 0) < 0 || !!s.penaltyReason).length,
    codingCount: filtered.filter(s => s.source === 'coding').length,
    dbmsCount: filtered.filter(s => s.source === 'dbms').length,
  }), [filtered]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
    toast.success('History refreshed!');
  };

  const formatDate = (ts: any) => {
    if (!ts) return '—';
    try {
      const d = ts?.toDate?.() || (ts instanceof Date ? ts : new Date(ts));
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return '—'; }
  };

  if (!user) return (
    <>
      <Navbar />
      <div className="page flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>
          <History size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <p>Please login to view your submission history.</p>
        </div>
      </div>
    </>
  );

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-content" style={{ maxWidth: 1100 }}>
          {/* Hero */}
          <div style={{ marginBottom: 28 }}>
            <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.1))',
                border: '1px solid rgba(99,102,241,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <History size={22} color="var(--purple-light)" />
              </div>
              <div>
                <h1 className="font-display" style={{ fontSize: 'clamp(20px,4vw,30px)', fontWeight: 800, margin: 0, lineHeight: 1.1 }}>
                  {isAdmin ? 'All Submissions' : 'My Submission'}{' '}
                  <span style={{ background: 'linear-gradient(135deg,var(--purple-light),var(--cyan))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    History
                  </span>
                </h1>
                <p style={{ color: 'var(--text-3)', fontSize: 13, margin: 0 }}>
                  {isAdmin
                    ? `Viewing all student submissions — ${submissions.length} total`
                    : 'Your complete coding & DBMS submission record'
                  }
                </p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing || loading}
                style={{
                  marginLeft: 'auto', background: 'var(--bg-glass)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '7px 12px', cursor: 'pointer', color: 'var(--text-2)',
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                }}
              >
                <RefreshCw size={13} style={{ animation: refreshing ? 'spin-slow 0.8s linear infinite' : 'none' }} />
                Refresh
              </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { label: 'Total', value: stats.total, color: 'var(--text-1)', icon: <Activity size={14} /> },
                { label: 'Accepted', value: stats.accepted, color: 'var(--green)', icon: <CheckCircle2 size={14} /> },
                { label: 'Wrong/Fail', value: stats.wrong, color: 'var(--red)', icon: <XCircle size={14} /> },
                { label: 'Pending', value: stats.pending, color: 'var(--yellow)', icon: <Clock size={14} /> },
                { label: 'Coding', value: stats.codingCount, color: 'var(--purple-light)', icon: <Code2 size={14} /> },
                { label: 'DBMS SQL', value: stats.dbmsCount, color: 'var(--cyan)', icon: <Database size={14} /> },
              ].map((s, i) => (
                <div key={i} className="glass-card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: s.color }}>{s.icon}</span>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Admin: Anti-plagiarism info */}
          {isAdmin && (
            <div style={{
              marginBottom: 20, padding: '12px 18px',
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <Shield size={18} color="var(--red)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--red)', marginBottom: 4 }}>
                  Anti-Plagiarism Rule Active
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>
                  Students who submit code previously submitted by another student receive an automatic point penalty
                  (score can go <strong style={{ color: 'var(--red)' }}>negative</strong>). SuperAdmin is exempt from this rule.
                  Penalized submissions are flagged with a <TrendingDown size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> icon.
                </p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 220px' }}>
              <Search size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
              <input
                className="input" style={{ paddingLeft: 36 }}
                placeholder="Search by problem, user, language..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>

            {isAdmin && (
              <select className="input" style={{ flex: '0 0 200px' }} value={userFilter} onChange={e => setUserFilter(e.target.value)}>
                <option value="all">All Students</option>
                {allUsers.map(u => (
                  <option key={u.uid} value={u.uid}>{u.displayName} ({u.email})</option>
                ))}
              </select>
            )}

            <select className="input" style={{ flex: '0 0 140px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="accepted">Accepted</option>
              <option value="pass">Passed (SQL)</option>
              <option value="wrong_answer">Wrong Answer</option>
              <option value="fail">Failed (SQL)</option>
              <option value="pending">Pending Review</option>
              <option value="error">Runtime Error</option>
            </select>

            <div className="flex gap-2">
              {[
                { id: 'all', label: 'All' },
                { id: 'coding', label: '💻 Coding' },
                { id: 'dbms', label: '🗄️ DBMS' },
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => setSourceFilter(s.id)}
                  className={`btn btn-sm ${sourceFilter === s.id ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 11 }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex justify-center" style={{ padding: 80 }}>
              <div className="spinner" style={{ width: 48, height: 48 }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
              <History size={48} style={{ marginBottom: 12, opacity: 0.2 }} />
              <p style={{ fontSize: 16 }}>{submissions.length === 0 ? 'No submissions yet. Start solving problems!' : 'No submissions match your filters.'}</p>
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                      {isAdmin && <th style={{ width: 150 }}>Student</th>}
                      <th>Problem / Question</th>
                      <th style={{ width: 80 }}>Type</th>
                      <th style={{ width: 130 }}>Status</th>
                      <th style={{ width: 80 }}>Score</th>
                      <th style={{ width: 100 }}>Language</th>
                      <th style={{ width: 150 }}>Submitted</th>
                      <th style={{ width: 80 }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((sub) => {
                      const isExpanded = expandedId === sub.id;
                      const isPenalized = (sub.penalty || 0) < 0 || !!sub.penaltyReason;
                      const title = sub.problemTitle || sub.questionTitle || sub.problemId || sub.questionId || '—';
                      const lang = sub.language || sub.dialect || '—';
                      const score = sub.score ?? sub.points ?? 0;

                      return (
                        <React.Fragment key={sub.id}>
                          <tr style={{
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            background: isPenalized ? 'rgba(239,68,68,0.04)' : 'transparent',
                          }}>
                            {isAdmin && (
                              <td>
                                <div className="flex items-center gap-2">
                                  <div className="avatar" style={{ width: 26, height: 26, fontSize: 11 }}>
                                    {(sub.userName || 'U')[0].toUpperCase()}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: 12 }}>{sub.userName || '—'}</div>
                                    <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{sub.userEmail || ''}</div>
                                  </div>
                                </div>
                              </td>
                            )}
                            <td>
                              <div className="flex items-center gap-2">
                                {isPenalized && <TrendingDown size={13} color="var(--red)" />}
                                <span style={{ fontWeight: 600, color: isPenalized ? '#f87171' : 'var(--text-1)' }}>{title}</span>
                              </div>
                              {isPenalized && sub.penaltyReason && (
                                <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 2 }}>⚠️ {sub.penaltyReason}</div>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${sub.source === 'dbms' ? 'badge-cyan' : 'badge-purple'}`} style={{ fontSize: 10 }}>
                                {sub.source === 'dbms' ? '🗄️ SQL' : '💻 Code'}
                              </span>
                            </td>
                            <td>
                              <span style={{
                                fontWeight: 700, fontSize: 11, padding: '3px 8px', borderRadius: 6,
                                background: `${statusColor(sub.status)}18`,
                                color: statusColor(sub.status),
                                border: `1px solid ${statusColor(sub.status)}44`,
                              }}>
                                {statusLabel(sub.status)}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontWeight: 700, fontSize: 13, color: score < 0 ? 'var(--red)' : score > 0 ? 'var(--yellow)' : 'var(--text-3)' }}>
                                {score > 0 ? '+' : ''}{score}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-2)' }}>
                                {lang}
                              </span>
                            </td>
                            <td style={{ fontSize: 11, color: 'var(--text-3)' }}>
                              {formatDate(sub.createdAt || sub.submittedAt)}
                            </td>
                            <td>
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
                                }}
                              >
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr>
                              <td colSpan={isAdmin ? 8 : 7} style={{ padding: 0 }}>
                                <div style={{
                                  padding: '16px 20px', background: 'rgba(0,0,0,0.25)',
                                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                                  animation: 'fadeIn 0.2s ease',
                                }}>
                                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                                    {sub.runtime !== undefined && (
                                      <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                                        <span style={{ color: 'var(--text-3)' }}>Runtime: </span>
                                        <strong>{sub.runtime}ms</strong>
                                      </div>
                                    )}
                                    {sub.topic && (
                                      <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                                        <span style={{ color: 'var(--text-3)' }}>Topic: </span>
                                        <strong>{sub.topic}</strong>
                                      </div>
                                    )}
                                    {sub.difficulty && (
                                      <span className={`badge diff-${sub.difficulty}`}>{sub.difficulty}</span>
                                    )}
                                    {isPenalized && sub.penaltyReason && (
                                      <div style={{ fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <AlertTriangle size={13} />
                                        <strong>Penalty: </strong> {sub.penaltyReason}
                                      </div>
                                    )}
                                  </div>

                                  {sub.adminRemarks && (
                                    <div style={{
                                      padding: '10px 14px', background: 'rgba(245,158,11,0.07)',
                                      border: '1px solid rgba(245,158,11,0.22)', borderRadius: 8, marginBottom: 12,
                                    }}>
                                      <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--yellow)' }}>👨‍🏫 Faculty Feedback: </span>
                                      <span style={{ fontSize: 12, color: 'var(--text-1)' }}>{sub.adminRemarks}</span>
                                    </div>
                                  )}

                                  {(sub.code || sub.userQuery) && (
                                    <div>
                                      <button
                                        onClick={() => setShowCode(showCode === sub.id ? null : sub.id)}
                                        style={{
                                          background: 'none', border: 'none', cursor: 'pointer',
                                          color: 'var(--purple-light)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5,
                                          marginBottom: 8,
                                        }}
                                      >
                                        {showCode === sub.id ? <EyeOff size={13} /> : <Eye size={13} />}
                                        {showCode === sub.id ? 'Hide' : 'View'} {sub.source === 'dbms' ? 'SQL Query' : 'Code'}
                                      </button>
                                      {showCode === sub.id && (
                                        <pre style={{
                                          background: 'rgba(0,0,0,0.5)', borderRadius: 8,
                                          padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace',
                                          fontSize: 12, color: 'var(--text-1)', overflowX: 'auto',
                                          border: '1px solid rgba(139,92,246,0.2)', margin: 0,
                                          maxHeight: 300, lineHeight: 1.6,
                                        }}>
                                          {sub.code || sub.userQuery}
                                        </pre>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-3)', textAlign: 'right' }}>
                Showing {filtered.length} of {submissions.length} submissions
              </div>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: 48, fontSize: 11, color: 'rgba(139,92,246,0.25)', fontFamily: 'JetBrains Mono,monospace', letterSpacing: '0.1em' }}>
            CodeForge MCA -- Submission History -- by <strong style={{ color: 'rgba(139,92,246,0.4)' }}>Rakshil Gandhi</strong>
          </div>
        </div>
      </div>
    </>
  );
};

export default HistoryPage;
