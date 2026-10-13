import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Search, CheckCircle2, Circle, Code2 } from 'lucide-react';
import Navbar from '../components/Navbar';

export interface Problem {
  id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  tags: string[];
  description: string;
  inputFormat: string;
  outputFormat: string;
  examples: { input: string; output: string; explanation?: string }[];
  constraints: string;
  starterCode: { java: string; c: string; python: string; javascript: string };
  testCases: { input: string; expectedOutput: string }[];
  createdAt: any;
  solvedCount: number;
  likes: number;
  dislikes: number;
  addedBy: string;
}

const DIFFICULTIES = ['All', 'easy', 'medium', 'hard'];
const CATEGORIES = ['All', 'Arrays', 'Strings', 'Math', 'Sorting', 'Dynamic Programming', 'Graphs', 'Trees', 'Recursion'];

const ProblemsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [diff, setDiff] = useState('All');
  const [cat, setCat] = useState('All');
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const q = query(collection(db, 'problems'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Problem));
        setProblems(data);

        if (user) {
          const sq = query(collection(db, 'submissions'), where('userId', '==', user.uid), where('status', '==', 'accepted'));
          const ss = await getDocs(sq);
          setSolvedIds(new Set(ss.docs.map(d => d.data().problemId)));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const filtered = problems.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchDiff = diff === 'All' || p.difficulty === diff;
    const matchCat = cat === 'All' || p.category === cat;
    return matchSearch && matchDiff && matchCat;
  });

  const diffColor = (d: string) => d === 'easy' ? 'diff-easy' : d === 'medium' ? 'diff-medium' : 'diff-hard';

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-content">
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <h1 className="font-display gradient-text" style={{ fontSize: 40, fontWeight: 800 }}>Problem Set</h1>
            <p style={{ color: 'var(--text-2)', marginTop: 8 }}>
              {problems.length} problems • {solvedIds.size} solved • grind mode activated 💪
            </p>
          </div>

          {/* Filters */}
          <div className="glass-card" style={{ padding: 20, marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 220px' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
              <input className="input" style={{ paddingLeft: 38, paddingTop: 9, paddingBottom: 9 }} placeholder="Search problems, tags..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-2 flex-wrap">
              {DIFFICULTIES.map(d => (
                <button key={d} onClick={() => setDiff(d)} className={`badge ${diff === d ? 'badge-purple' : ''}`} style={{ cursor: 'pointer', border: diff === d ? undefined : '1px solid var(--border)', background: diff === d ? undefined : 'transparent', color: diff === d ? undefined : 'var(--text-2)', padding: '6px 14px', borderRadius: 99 }}>
                  {d === 'All' ? 'All' : d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
            <select className="input" style={{ flex: '0 0 auto', width: 180 }} value={cat} onChange={e => setCat(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Problems List */}
          {loading ? (
            <div className="flex justify-center items-center" style={{ height: 200 }}>
              <div className="spinner" />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-3)' }}>
              <Code2 size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p style={{ fontSize: 18 }}>No problems found. Admin will add some soon!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 100px 120px 80px 80px', gap: 16, padding: '8px 20px', color: 'var(--text-3)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                <div>#</div>
                <div>Title</div>
                <div>Difficulty</div>
                <div>Category</div>
                <div>Solved</div>
                <div>Status</div>
              </div>
              {filtered.map((p, i) => {
                const solved = solvedIds.has(p.id);
                return (
                  <div key={p.id} className="glass-card" style={{ padding: '0', cursor: 'pointer', border: solved ? '1px solid rgba(16,185,129,0.3)' : undefined }}
                    onClick={() => navigate(`/problems/${p.id}`)}>
                    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 100px 120px 80px 80px', gap: 16, padding: '16px 20px', alignItems: 'center' }}>
                      <div style={{ color: 'var(--text-3)', fontSize: 13, fontFamily: 'monospace' }}>{i + 1}</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{p.title}</div>
                        <div className="flex gap-1 flex-wrap">
                          {p.tags?.slice(0, 3).map(t => <span key={t} className="tag" style={{ fontSize: 10 }}>{t}</span>)}
                        </div>
                      </div>
                      <div><span className={`badge ${diffColor(p.difficulty)}`}>{p.difficulty}</span></div>
                      <div style={{ color: 'var(--text-2)', fontSize: 13 }}>{p.category}</div>
                      <div style={{ color: 'var(--text-2)', fontSize: 13 }}>{p.solvedCount || 0}</div>
                      <div>
                        {solved ? <CheckCircle2 size={18} color="var(--green)" /> : <Circle size={18} color="var(--text-3)" />}
                      </div>
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

export default ProblemsPage;
