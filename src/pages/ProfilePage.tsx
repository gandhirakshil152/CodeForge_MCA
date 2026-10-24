import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import {
  Trophy, Code2, Target, Clock, CheckCircle2, XCircle, Star,
  MessageSquare, Eye, X,
} from 'lucide-react';

const LANG_COLORS: Record<string, string> = {
  java: 'lang-java',
  c: 'lang-c',
  python: 'lang-python',
  javascript: 'lang-js',
  sql: 'badge-cyan',
};

interface NormalizedSubmission {
  id: string;
  problemTitle: string;
  language: string;
  status: 'accepted' | 'wrong_answer' | 'runtime_error' | 'pending';
  runtime: number;
  score: number;
  date: Date;
  type: 'code' | 'sql';
  adminRemarks?: string;
  code?: string;
}

const ProfilePage: React.FC = () => {
  const { user, profile } = useAuth();
  const [freshProfile, setFreshProfile] = useState<any>(null);
  const [submissions, setSubmissions] = useState<NormalizedSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [rank, setRank] = useState<number>(0);
  const [subFilter, setSubFilter] = useState<'all' | 'code' | 'sql' | 'accepted' | 'failed'>('all');
  const [selectedSub, setSelectedSub] = useState<NormalizedSubmission | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [profileSnap, subSnap, dbmsSnap, usersSnap] = await Promise.all([
          getDoc(doc(db, 'users', user.uid)),
          getDocs(query(collection(db, 'submissions'), where('userId', '==', user.uid))),
          getDocs(query(collection(db, 'dbms_submissions'), where('userId', '==', user.uid))),
          getDocs(query(collection(db, 'users'), orderBy('score', 'desc'))),
        ]);

        if (profileSnap.exists()) setFreshProfile(profileSnap.data());

        const merged: NormalizedSubmission[] = [];
        const seenKeys = new Set<string>();

        // 1. Process code submissions collection
        subSnap.docs.forEach(d => {
          const s = d.data() as any;
          const isSql = s.language === 'sql' || s.problemTitle?.startsWith('[SQL]');
          const dateObj = s.createdAt?.toDate?.() || new Date();
          const key = `${s.problemId || s.problemTitle}_${s.status}_${Math.floor(dateObj.getTime() / 60000)}`;
          seenKeys.add(key);

          merged.push({
            id: d.id,
            problemTitle: s.problemTitle || s.problemId || 'Code Problem',
            language: s.language || 'code',
            status: s.status || 'accepted',
            runtime: s.runtime || 12,
            score: s.score || 0,
            date: dateObj,
            type: isSql ? 'sql' : 'code',
            adminRemarks: s.adminRemarks || '',
            code: s.code || s.userQuery || '',
          });
        });

        // 2. Process DBMS submissions collection (ensuring complete SQL lab history)
        dbmsSnap.docs.forEach(d => {
          const s = d.data() as any;
          const dateObj = s.submittedAt?.toDate?.() || s.createdAt?.toDate?.() || new Date();
          const key = `${s.questionId || s.questionTitle}_${s.status === 'pass' ? 'accepted' : 'wrong_answer'}_${Math.floor(dateObj.getTime() / 60000)}`;

          // Avoid duplicate if mirrored in submissions collection
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            merged.push({
              id: d.id,
              problemTitle: s.questionTitle ? `[SQL] ${s.questionTitle}` : '[SQL] DBMS Lab Query',
              language: 'sql',
              status: s.status === 'pass' ? 'accepted' : s.status === 'fail' ? 'wrong_answer' : 'pending',
              runtime: 14,
              score: s.points || 0,
              date: dateObj,
              type: 'sql',
              adminRemarks: s.adminRemarks || '',
              code: s.userQuery || '',
            });
          }
        });

        // Sort all submissions chronologically descending
        merged.sort((a, b) => b.date.getTime() - a.date.getTime());
        setSubmissions(merged);

        const idx = usersSnap.docs.findIndex(d => d.id === user.uid);
        setRank(idx >= 0 ? idx + 1 : 0);
      } catch (err) {
        console.error('Failed to load profile submissions:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  // Use freshProfile when available, fall back to AuthContext profile
  const p = freshProfile || profile;

  const accepted = submissions.filter(s => s.status === 'accepted');
  const accuracy = submissions.length > 0 ? Math.round((accepted.length / submissions.length) * 100) : 0;
  const avgRuntime = accepted.length > 0 ? Math.round(accepted.reduce((a, s) => a + s.runtime, 0) / accepted.length) : 0;
  const langCounts = submissions.reduce((acc, s) => { acc[s.language] = (acc[s.language] || 0) + 1; return acc; }, {} as Record<string, number>);
  const favLang = Object.entries(langCounts).sort(([, countA], [, countB]) => (countB as number) - (countA as number))[0]?.[0] || 'None';

  // Submissions filtered list
  const filteredSubmissions = submissions.filter(s => {
    if (subFilter === 'code') return s.type === 'code';
    if (subFilter === 'sql') return s.type === 'sql';
    if (subFilter === 'accepted') return s.status === 'accepted';
    if (subFilter === 'failed') return s.status === 'wrong_answer';
    return true;
  });

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
                {p?.displayName?.[0]?.toUpperCase() || 'U'}
              </div>
              <div style={{ flex: 1 }}>
                <h1 className="font-display" style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>
                  {p?.displayName}
                </h1>
                <p style={{ color: 'var(--text-2)', marginBottom: 8 }}>{p?.email}</p>
                <div className="flex gap-2 flex-wrap">
                  <span className={`badge ${p?.role === 'superadmin' ? 'badge-yellow' : p?.role === 'admin' ? 'badge-purple' : 'badge-cyan'}`}>
                    {p?.role === 'superadmin' ? '👑 Super Admin & Competitor' : p?.role === 'admin' ? '🛡️ Admin' : '🎓 MCA Student'}
                  </span>
                  <span className="badge badge-purple">{p?.university || 'MCA University'}</span>
                  {rank > 0 && <span className="badge badge-yellow">🏆 Rank #{rank}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="font-display gradient-text" style={{ fontSize: 56, fontWeight: 800, lineHeight: 1 }}>{p?.score || 0}</div>
                <div style={{ color: 'var(--text-3)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Total Score</div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 28 }}>
            {[
              { icon: <CheckCircle2 size={20} />, value: p?.problemsSolved || accepted.length, label: 'Solved', color: 'var(--green)' },
              { icon: <Code2 size={20} />, value: p?.totalSubmissions || submissions.length, label: 'Submissions', color: 'var(--purple-light)' },
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
              { emoji: '🚀', label: 'First Solve', unlocked: (p?.problemsSolved || 0) >= 1 || accepted.length >= 1 },
              { emoji: '🔥', label: '10 Solved', unlocked: (p?.problemsSolved || 0) >= 10 || accepted.length >= 10 },
              { emoji: '💯', label: '100% Accuracy', unlocked: accuracy === 100 && submissions.length > 0 },
              { emoji: '⚡', label: 'Speed Coder', unlocked: avgRuntime < 100 && accepted.length > 0 },
              { emoji: '🏆', label: 'Top 10', unlocked: rank > 0 && rank <= 10 },
              { emoji: '👑', label: 'Problem Master', unlocked: (p?.problemsSolved || 0) >= 50 },
            ].map((a, i) => (
              <div key={i} className="glass-card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10, opacity: a.unlocked ? 1 : 0.3, border: a.unlocked ? '1px solid var(--purple)' : undefined, filter: a.unlocked ? undefined : 'grayscale(1)' }}>
                <span style={{ fontSize: 24 }}>{a.emoji}</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{a.label}</span>
                {a.unlocked && <span className="badge badge-green" style={{ fontSize: 9 }}>✓</span>}
              </div>
            ))}
          </div>

          {/* ── All Submissions History Section ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div className="section-heading" style={{ marginBottom: 0 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>My Submissions & Lab History</h2>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: `All (${submissions.length})` },
                { id: 'code', label: `Coding (${submissions.filter(s => s.type === 'code').length})` },
                { id: 'sql', label: `SQL Lab (${submissions.filter(s => s.type === 'sql').length})` },
                { id: 'accepted', label: `Passed (${submissions.filter(s => s.status === 'accepted').length})` },
                { id: 'failed', label: `Needs Revision (${submissions.filter(s => s.status === 'wrong_answer').length})` },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setSubFilter(f.id as any)}
                  className={`btn btn-sm ${subFilter === f.id ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 11, padding: '4px 10px' }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center" style={{ padding: 40 }}><div className="spinner" /></div>
          ) : filteredSubmissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
              <Code2 size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p>No submissions found in this filter category.</p>
            </div>
          ) : (
            <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 780 }}>
                  <thead>
                    <tr>
                      <th>Problem / Lab</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th>Runtime</th>
                      <th>Score</th>
                      <th>Faculty Remarks</th>
                      <th>Date</th>
                      <th>View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubmissions.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ fontWeight: 600, fontSize: 13, maxWidth: 220 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.problemTitle}>
                            {s.problemTitle}
                          </div>
                        </td>
                        <td>
                          <span className={`lang-badge ${LANG_COLORS[s.language.toLowerCase()] || 'badge-cyan'}`}>
                            {s.language.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            {s.status === 'accepted' ? (
                              <CheckCircle2 size={14} color="var(--green)" />
                            ) : s.status === 'pending' ? (
                              <Clock size={14} color="var(--yellow)" />
                            ) : (
                              <XCircle size={14} color="var(--red)" />
                            )}
                            <span
                              className={`badge ${s.status === 'accepted' ? 'badge-green' : s.status === 'pending' ? 'badge-yellow' : 'badge-red'}`}
                              style={{ fontSize: 10 }}>
                              {s.status === 'accepted' ? 'Passed' : s.status === 'pending' ? 'Pending' : 'Revision'}
                            </span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--cyan)', fontFamily: 'monospace', fontSize: 12 }}>{s.runtime}ms</td>
                        <td style={{ color: 'var(--yellow)', fontWeight: 700, fontSize: 12 }}>
                          {s.status === 'accepted' ? `+${Math.round(s.score)}` : '0'}
                        </td>
                        <td style={{ maxWidth: 220 }}>
                          {s.adminRemarks ? (
                            <span style={{ fontSize: 11, color: 'var(--text-1)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }} title={s.adminRemarks}>
                              <MessageSquare size={11} color="var(--yellow)" />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                                "{s.adminRemarks}"
                              </span>
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>—</span>
                          )}
                        </td>
                        <td style={{ color: 'var(--text-3)', fontSize: 11 }}>
                          {s.date.toLocaleDateString()}
                        </td>
                        <td>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '3px 8px', fontSize: 11, color: 'var(--cyan)', border: '1px solid rgba(34,211,238,0.2)' }}
                            onClick={() => setSelectedSub(s)}>
                            <Eye size={11} /> Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Submission Details Modal ── */}
          {selectedSub && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(3,7,18,0.85)', backdropFilter: 'blur(8px)',
              zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
            }}>
              <div className="glass-card" style={{
                width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto',
                border: '1px solid rgba(34,211,238,0.3)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 10, color: 'var(--cyan)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {selectedSub.type === 'sql' ? 'SQL Lab Submission' : 'Coding Problem Submission'}
                    </span>
                    <h2 style={{ fontSize: 18, fontWeight: 800, margin: '2px 0 0' }}>{selectedSub.problemTitle}</h2>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedSub(null)}>
                    <X size={16} />
                  </button>
                </div>

                {/* Status and Score Row */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', flex: 1 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'block' }}>Status</span>
                    <strong style={{
                      color: selectedSub.status === 'accepted' ? 'var(--green)' : selectedSub.status === 'pending' ? 'var(--yellow)' : 'var(--red)',
                      fontSize: 13
                    }}>
                      {selectedSub.status === 'accepted' ? '✓ Passed / Accepted' : selectedSub.status === 'pending' ? '⏳ Pending Faculty Review' : '✕ Needs Revision / Failed'}
                    </strong>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', flex: 1 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'block' }}>Score Awarded</span>
                    <strong style={{ color: 'var(--yellow)', fontSize: 13 }}>+{selectedSub.score} pts</strong>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', flex: 1 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'block' }}>Date</span>
                    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{selectedSub.date.toLocaleString()}</span>
                  </div>
                </div>

                {/* Faculty Remarks Callout */}
                {selectedSub.adminRemarks ? (
                  <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--yellow)', fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
                      <MessageSquare size={13} /> Faculty Remarks & Feedback:
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-1)', lineHeight: 1.6, fontStyle: 'italic' }}>
                      "{selectedSub.adminRemarks}"
                    </p>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    No faculty remarks left for this submission yet.
                  </div>
                )}

                {/* Submitted Code / Query */}
                {selectedSub.code && (
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6, display: 'block' }}>
                      Submitted Solution:
                    </label>
                    <pre style={{
                      background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(34,211,238,0.18)', borderRadius: 8,
                      padding: 12, fontFamily: 'JetBrains Mono,monospace', fontSize: 12, maxHeight: 220, overflow: 'auto',
                      color: 'var(--text-1)', margin: 0, whiteSpace: 'pre-wrap'
                    }}>
                      {selectedSub.code}
                    </pre>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <button className="btn btn-ghost" onClick={() => setSelectedSub(null)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ProfilePage;
