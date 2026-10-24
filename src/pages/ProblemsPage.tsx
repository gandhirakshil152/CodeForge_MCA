import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  Search, CheckCircle2, Circle, Code2, Flame,
  Database, ArrowRight, Zap, Trophy,
} from 'lucide-react';
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

interface DbmsQuestion {
  id: string;
  title: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  type: string;
  description: string;
}

const DIFFICULTIES = ['All', 'easy', 'medium', 'hard'];
const CATEGORIES = ['All', 'Arrays', 'Strings', 'Math', 'Sorting', 'Dynamic Programming', 'Graphs', 'Trees', 'Recursion'];

const ProblemsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [dbmsQuestions, setDbmsQuestions] = useState<DbmsQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [diff, setDiff] = useState('All');
  const [cat, setCat] = useState('All');
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [solvedDbmsIds, setSolvedDbmsIds] = useState<Set<string>>(new Set());
  const [customDailyTask, setCustomDailyTask] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const [pSnap, dSnap, taskSnap] = await Promise.all([
          getDocs(query(collection(db, 'problems'), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'dbms_questions'), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'daily_tasks'), where('date', '==', todayStr))),
        ]);

        const pData = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Problem));
        const dData = dSnap.docs.map(d => ({ id: d.id, ...d.data() } as DbmsQuestion));
        setProblems(pData);
        setDbmsQuestions(dData);

        if (!taskSnap.empty) {
          setCustomDailyTask(taskSnap.docs[0].data());
        }

        if (user) {
          const [subSnap, dbmsSubSnap] = await Promise.all([
            getDocs(query(collection(db, 'submissions'), where('userId', '==', user.uid), where('status', '==', 'accepted'))),
            getDocs(query(collection(db, 'dbms_submissions'), where('userId', '==', user.uid), where('status', '==', 'pass'))),
          ]);
          setSolvedIds(new Set(subSnap.docs.map(d => d.data().problemId)));
          setSolvedDbmsIds(new Set(dbmsSubSnap.docs.map(d => d.data().questionId)));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  // Determine today's daily coding problem and query question
  const todaySeed = new Date().toISOString().slice(0, 10).split('-').reduce((a, c) => a + Number(c), 0);
  const dailyProblem = problems.length > 0 ? problems[todaySeed % problems.length] : null;
  const queryQuestions = dbmsQuestions.filter(q => q.type === 'query' || !q.type);
  const dailyQuery = (queryQuestions.length > 0 ? queryQuestions : dbmsQuestions)[todaySeed % Math.max(1, (queryQuestions.length > 0 ? queryQuestions : dbmsQuestions).length)] || null;

  const isDailyCodeSolved = dailyProblem ? solvedIds.has(dailyProblem.id) : false;
  const isDailyQuerySolved = dailyQuery ? solvedDbmsIds.has(dailyQuery.id) : false;
  const dailyTasksCompleted = (isDailyCodeSolved ? 1 : 0) + (isDailyQuerySolved ? 1 : 0);

  const filtered = problems.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchDiff = diff === 'All' || p.difficulty === diff;
    const matchCat = cat === 'All' || p.category === cat;
    return matchSearch && matchDiff && matchCat;
  });

  const diffColor = (d: string) => d === 'easy' ? 'diff-easy' : d === 'medium' ? 'diff-medium' : 'diff-hard';

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-content">
          {/* Header */}
          <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 className="font-display gradient-text" style={{ fontSize: 'clamp(30px, 5vw, 42px)', fontWeight: 800, lineHeight: 1.1 }}>
                Problem Set &amp; Daily Tasks
              </h1>
              <p style={{ color: 'var(--text-2)', marginTop: 8, fontSize: 14 }}>
                {problems.length} problems • {solvedIds.size} solved • 4 languages (Java, C, Python, JS) + DBMS queries
              </p>
            </div>
            {/* Quick streak / completion badge */}
            <div className="glass-card" style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Flame size={20} color="var(--yellow)" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Daily Tasks</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: dailyTasksCompleted === 2 ? 'var(--green)' : 'var(--yellow)' }}>
                  {dailyTasksCompleted}/2 Completed {dailyTasksCompleted === 2 && '🎉'}
                </div>
              </div>
            </div>
          </div>

          {/* Tech Evaluation Rules Banner */}
          <div className="tech-status-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="tech-pulse-dot" />
              <span style={{ color: 'var(--cyan)', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                MCA COMPILER RULES:
              </span>
              <span style={{ color: 'var(--text-2)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>
                Algorithmic standard policy enforced.
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="tech-hud-badge" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.08)', color: '#fca5a5' }}>
                JAVA: IO DISABLED (SCANNER ONLY)
              </span>
              <span className="tech-hud-badge" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.08)', color: '#fca5a5' }}>
                C: POINTERS DISABLED (ARRAYS ONLY)
              </span>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              DAILY TASKS SECTION (Coding in 4 Languages + DBMS Query)
          ══════════════════════════════════════════════════════════════ */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(34,211,238,0.08) 50%, rgba(5,5,15,0.85) 100%)',
            border: '1px solid rgba(139,92,246,0.35)',
            borderRadius: 'var(--radius-xl)',
            padding: '24px',
            marginBottom: 32,
            boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Top banner header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>🔥</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
                      Today's Daily Tasks
                    </span>
                    <span className="badge badge-purple" style={{ fontSize: 11, padding: '2px 8px' }}>
                      {todayFormatted}
                    </span>
                    {customDailyTask && (
                      <span className="badge badge-cyan" style={{ fontSize: 11 }}>Admin Pick</span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                    Solve today's coding task in your preferred language (Java, C, Python, JavaScript) &amp; practice today's SQL query challenge!
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: 'var(--green)', fontSize: 12, fontWeight: 700 }}>
                  <Trophy size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> +75 XP Daily Bonus
                </span>
              </div>
            </div>

            {/* Daily Tasks Cards Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 16,
            }}>
              {/* Task 1: Coding Challenge (4 Languages) */}
              <div style={{
                background: isDailyCodeSolved ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)',
                border: isDailyCodeSolved ? '1px solid rgba(16,185,129,0.4)' : '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.25s ease',
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="badge badge-purple" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        <Zap size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} /> Daily Code Task
                      </span>
                      {dailyProblem && (
                        <span className={`badge ${diffColor(dailyProblem.difficulty)}`} style={{ fontSize: 10 }}>
                          {dailyProblem.difficulty}
                        </span>
                      )}
                    </div>
                    {isDailyCodeSolved ? (
                      <span className="badge badge-green" style={{ fontSize: 11 }}>
                        <CheckCircle2 size={12} style={{ marginRight: 4 }} /> Completed
                      </span>
                    ) : (
                      <span className="badge" style={{ fontSize: 11, background: 'rgba(245,158,11,0.1)', color: 'var(--yellow)', border: '1px solid rgba(245,158,11,0.3)' }}>
                        Pending (+50 pts)
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginBottom: 6 }}>
                    {dailyProblem ? dailyProblem.title : 'Loading today\'s coding challenge...'}
                  </h3>

                  <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 14 }}>
                    {dailyProblem?.description ? `${dailyProblem.description.slice(0, 110)}...` : 'Strengthen your DSA fundamentals across multiple programming languages.'}
                  </p>

                  {/* 4 Language Badges */}
                  <div style={{ marginBottom: 16 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
                      Solvable in 4 Languages:
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span className="tag" style={{ fontSize: 11, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                        ☕ Java
                      </span>
                      <span className="tag" style={{ fontSize: 11, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}>
                        ⚡ C
                      </span>
                      <span className="tag" style={{ fontSize: 11, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}>
                        🐍 Python
                      </span>
                      <span className="tag" style={{ fontSize: 11, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}>
                        🟨 JavaScript
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => dailyProblem && navigate(`/problems/${dailyProblem.id}`)}
                  className={isDailyCodeSolved ? 'btn btn-ghost btn-sm' : 'btn btn-primary btn-sm'}
                  style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                  disabled={!dailyProblem}
                >
                  <Code2 size={14} />
                  {isDailyCodeSolved ? 'Practice Again (4 Languages)' : 'Solve in 4 Languages'}
                  <ArrowRight size={13} style={{ marginLeft: 4 }} />
                </button>
              </div>

              {/* Task 2: DBMS Query Challenge */}
              <div style={{
                background: isDailyQuerySolved ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)',
                border: isDailyQuerySolved ? '1px solid rgba(16,185,129,0.4)' : '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.25s ease',
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="badge badge-cyan" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        <Database size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} /> Daily Query Task
                      </span>
                      {dailyQuery && (
                        <span className={`badge ${diffColor(dailyQuery.difficulty || 'medium')}`} style={{ fontSize: 10 }}>
                          {dailyQuery.difficulty || 'medium'}
                        </span>
                      )}
                    </div>
                    {isDailyQuerySolved ? (
                      <span className="badge badge-green" style={{ fontSize: 11 }}>
                        <CheckCircle2 size={12} style={{ marginRight: 4 }} /> Completed
                      </span>
                    ) : (
                      <span className="badge" style={{ fontSize: 11, background: 'rgba(34,211,238,0.1)', color: 'var(--cyan)', border: '1px solid rgba(34,211,238,0.3)' }}>
                        Pending (+25 pts)
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginBottom: 6 }}>
                    {dailyQuery ? dailyQuery.title : 'Loading daily DBMS query...'}
                  </h3>

                  <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 14 }}>
                    {dailyQuery?.description ? `${dailyQuery.description.slice(0, 110)}...` : 'Write and test SQL queries (SELECT, JOIN, Aggregations, GROUP BY) against live schemas.'}
                  </p>

                  {/* Query Features */}
                  <div style={{ marginBottom: 16 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
                      Topic &amp; Engine:
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span className="tag" style={{ fontSize: 11, background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.3)', color: 'var(--cyan)' }}>
                        🐬 {dailyQuery?.topic || 'SQL Query'}
                      </span>
                      <span className="tag" style={{ fontSize: 11, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: 'var(--purple-light)' }}>
                        ⚡ Live Schema Runner
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => dailyQuery ? navigate(`/dbms?q=${dailyQuery.id}`) : navigate('/dbms')}
                  className={isDailyQuerySolved ? 'btn btn-ghost btn-sm' : 'btn btn-primary btn-sm'}
                  style={{ width: '100%', justifyContent: 'center', marginTop: 8, borderColor: 'var(--cyan)', color: isDailyQuerySolved ? undefined : '#000', background: isDailyQuerySolved ? undefined : 'var(--cyan)' }}
                  disabled={!dailyQuery}
                >
                  <Database size={14} />
                  {isDailyQuerySolved ? 'Review SQL Query' : 'Solve SQL Query'}
                  <ArrowRight size={13} style={{ marginLeft: 4 }} />
                </button>
              </div>
            </div>
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
