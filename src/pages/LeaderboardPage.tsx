import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Trophy, Medal, Crown, Zap, Clock, Code2, Star } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';

interface LeaderboardUser {
  uid: string;
  displayName: string;
  email: string;
  score: number;
  problemsSolved: number;
  totalSubmissions: number;
  university: string;
}

const TABS = ['Overall', 'This Week', 'Today'];

const LeaderboardPage: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overall');

  useEffect(() => {
    const load = async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('score', 'desc'), limit(100));
        const snap = await getDocs(q);
        setUsers(snap.docs.map(d => ({ ...d.data() } as LeaderboardUser)));
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown size={20} color="#f59e0b" fill="#f59e0b" />;
    if (rank === 2) return <Medal size={20} color="#94a3b8" fill="#94a3b8" />;
    if (rank === 3) return <Medal size={20} color="#b45309" fill="#b45309" />;
    return <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: 'var(--text-3)', fontWeight: 700 }}>#{rank}</span>;
  };

  const myRank = users.findIndex(u => u.uid === user?.uid) + 1;

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-content">
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div className="badge badge-yellow" style={{ marginBottom: 16, fontSize: 13 }}>
              <Trophy size={13} /> Live Rankings
            </div>
            <h1 className="font-display gradient-text" style={{ fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 800 }}>Leaderboard 🏆</h1>
            <p style={{ color: 'var(--text-2)', marginTop: 12, fontSize: 16 }}>
              Ranked by performance score • Runtime + Accuracy + Consistency
            </p>
          </div>

          {/* My Rank Card (if logged in) */}
          {user && myRank > 0 && (
            <div className="glass-card" style={{ padding: 20, marginBottom: 32, border: '1px solid rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.05)' }}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <Zap size={20} color="var(--purple-light)" />
                  <span style={{ fontWeight: 700, fontSize: 16 }}>Your Rank: #{myRank}</span>
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

          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: 24, maxWidth: 400 }}>
            {TABS.map(t => <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>{t}</button>)}
          </div>

          {/* Full Table */}
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
              {/* Header */}
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
      </div>
    </>
  );
};

export default LeaderboardPage;
