import os, sys

target = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src', 'pages', 'DBMSPage.tsx')

code = r"""import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import Navbar from '../components/Navbar';
import {
  Database, Search, BookOpen, ChevronDown, ChevronUp,
  Eye, EyeOff, Lightbulb, Table2, Code2, BookMarked,
  GraduationCap, Zap, CheckCircle2,
} from 'lucide-react';

interface TableDef {
  name: string;
  columns: string;
  rows: string;
}

interface DbmsQuestion {
  id: string;
  title: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'query' | 'theory' | 'normalization' | 'design';
  description: string;
  hint?: string;
  sampleSchema?: string;
  expectedQuery?: string;
  explanation?: string;
  tableData?: TableDef[];
  addedBy?: string;
}

const typeColor = (t: string) =>
  t === 'query' ? 'badge-cyan' : t === 'theory' ? 'badge-purple'
  : t === 'normalization' ? 'badge-yellow' : 'badge-pink';
const typeIcon = (t: string) =>
  t === 'query' ? '🔍' : t === 'theory' ? '📖' : t === 'normalization' ? '🗂️' : '🏗️';

const TOPICS = ['All', 'SQL Basics', 'Joins', 'Subqueries', 'Aggregation', 'Normalization',
  'Indexing', 'Transactions', 'Stored Procedures', 'Views', 'ER Diagrams',
  'ACID Properties', 'Concurrency Control', 'Keys & Constraints'];
const DIFFICULTIES = ['All', 'easy', 'medium', 'hard'] as const;
const TYPES = ['All', 'query', 'theory', 'normalization', 'design'] as const;

const DBMSPage: React.FC = () => {
  const [questions, setQuestions] = useState<DbmsQuestion[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [topicFilter, setTopicFilter]   = useState('All');
  const [diffFilter, setDiffFilter]     = useState<(typeof DIFFICULTIES)[number]>('All');
  const [typeFilter, setTypeFilter]     = useState<(typeof TYPES)[number]>('All');
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const [showHints, setShowHints] = useState<Set<string>>(new Set());
  const [showAnswers, setShowAnswers] = useState<Set<string>>(new Set());
  const [userQuery, setUserQuery] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'dbms_questions'), orderBy('createdAt', 'desc')));
        setQuestions(snap.docs.map(d => ({ id: d.id, ...d.data() } as DbmsQuestion)));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = questions.filter(q => {
    const s = search.toLowerCase();
    const matchSearch = !s || q.title.toLowerCase().includes(s) || q.description.toLowerCase().includes(s) || q.topic.toLowerCase().includes(s);
    const matchTopic  = topicFilter === 'All' || q.topic === topicFilter;
    const matchDiff   = diffFilter  === 'All' || q.difficulty === diffFilter;
    const matchType   = typeFilter  === 'All' || q.type === typeFilter;
    return matchSearch && matchTopic && matchDiff && matchType;
  });

  const toggle = (id: string, set: Set<string>, setter: (s: Set<string>) => void) => {
    const ns = new Set(set);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    setter(ns);
  };

  const stats = {
    total: questions.length,
    easy:   questions.filter(q => q.difficulty === 'easy').length,
    medium: questions.filter(q => q.difficulty === 'medium').length,
    hard:   questions.filter(q => q.difficulty === 'hard').length,
  };

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-content">

          {/* Watermark */}
          <div style={{ position:'fixed', bottom:18, right:22, zIndex:9999, pointerEvents:'none', opacity:0.15,
            fontSize:10, fontFamily:'JetBrains Mono,monospace', color:'var(--cyan)',
            letterSpacing:'0.12em', textTransform:'uppercase', userSelect:'none' }}>
            ⚡ Created by Rakshil Gandhi
          </div>

          {/* Header */}
          <div style={{ marginBottom:28 }}>
            <div className="flex items-center gap-3" style={{ marginBottom:8 }}>
              <div style={{ width:52, height:52, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center',
                background:'linear-gradient(135deg,rgba(34,211,238,0.22),rgba(34,211,238,0.05))',
                border:'1px solid rgba(34,211,238,0.38)', boxShadow:'0 0 28px rgba(34,211,238,0.15)' }}>
                <Database size={24} color="var(--cyan)" />
              </div>
              <div>
                <h1 className="font-display gradient-text" style={{ fontSize:'clamp(22px,3.5vw,32px)', fontWeight:800, lineHeight:1.15 }}>
                  DBMS Practice Lab
                </h1>
                <p style={{ color:'var(--text-3)', fontSize:12, marginTop:3 }}>
                  SQL queries · Theory · Normalization · Schema Design
                </p>
              </div>
            </div>

            {/* Quick stats */}
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:16 }}>
              {[
                { label:'Total', value:stats.total, color:'var(--cyan)' },
                { label:'Easy', value:stats.easy, color:'var(--green)' },
                { label:'Medium', value:stats.medium, color:'var(--yellow)' },
                { label:'Hard', value:stats.hard, color:'var(--red)' },
              ].map((s,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px',
                  background:`rgba(0,0,0,0.25)`, border:'1px solid var(--border)', borderRadius:99 }}>
                  <span style={{ fontWeight:800, color:s.color, fontSize:14 }}>{s.value}</span>
                  <span style={{ fontSize:11, color:'var(--text-3)' }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Search & Filters */}
          <div style={{ marginBottom:20, display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ position:'relative' }}>
              <Search size={15} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)' }} />
              <input className="input" style={{ paddingLeft:40 }} placeholder="Search questions, topics..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                {DIFFICULTIES.map(d => (
                  <button key={d} onClick={() => setDiffFilter(d)}
                    style={{ padding:'4px 11px', borderRadius:99, fontSize:11, fontWeight:600, border:'1px solid',
                      background: diffFilter===d ? (d==='easy'?'rgba(16,185,129,0.22)':d==='medium'?'rgba(245,158,11,0.22)':d==='hard'?'rgba(239,68,68,0.22)':'rgba(139,92,246,0.22)') : 'transparent',
                      borderColor: diffFilter===d ? (d==='easy'?'var(--green)':d==='medium'?'var(--yellow)':d==='hard'?'var(--red)':'var(--purple)') : 'var(--border)',
                      color: d==='all'||diffFilter===d ? 'var(--text-1)' : 'var(--text-3)', cursor:'pointer', transition:'all 0.18s' }}>
                    {d === 'All' ? 'All Levels' : d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
              <div style={{ width:1, height:20, background:'var(--border)' }} />
              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                {TYPES.map(t => (
                  <button key={t} onClick={() => setTypeFilter(t)}
                    style={{ padding:'4px 11px', borderRadius:99, fontSize:11, fontWeight:600, border:'1px solid',
                      background: typeFilter===t ? 'rgba(34,211,238,0.14)' : 'transparent',
                      borderColor: typeFilter===t ? 'var(--cyan)' : 'var(--border)',
                      color: typeFilter===t ? 'var(--cyan)' : 'var(--text-3)', cursor:'pointer', transition:'all 0.18s' }}>
                    {t === 'All' ? 'All Types' : typeIcon(t)+' '+t}
                  </button>
                ))}
              </div>
            </div>
            {/* Topic filter scrollable */}
            <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4 }}>
              {TOPICS.map(t => (
                <button key={t} onClick={() => setTopicFilter(t)}
                  style={{ whiteSpace:'nowrap', padding:'3px 11px', borderRadius:99, fontSize:10, fontWeight:600, border:'1px solid', flexShrink:0,
                    background: topicFilter===t ? 'rgba(139,92,246,0.18)' : 'transparent',
                    borderColor: topicFilter===t ? 'var(--purple)' : 'var(--border)',
                    color: topicFilter===t ? 'var(--purple-light)' : 'var(--text-3)', cursor:'pointer', transition:'all 0.15s' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Results count */}
          <div style={{ marginBottom:14, fontSize:12, color:'var(--text-3)' }}>
            Showing <strong style={{ color:'var(--text-1)' }}>{filtered.length}</strong> of {questions.length} questions
          </div>

          {loading
            ? <div className="flex justify-center" style={{ padding:70 }}><div className="spinner" /></div>
            : filtered.length === 0
              ? <div style={{ textAlign:'center', padding:'70px 0', color:'var(--text-3)' }}>
                  <Database size={48} style={{ marginBottom:14, opacity:0.22 }} />
                  <p style={{ fontSize:16 }}>No questions match your filters.</p>
                </div>
              : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {filtered.map(q => {
                  const isExpanded = expanded.has(q.id);
                  const showHint   = showHints.has(q.id);
                  const showAns    = showAnswers.has(q.id);
                  const dc = q.difficulty==='easy'?'diff-easy':q.difficulty==='medium'?'diff-medium':'diff-hard';
                  return (
                    <div key={q.id} className="glass-card" style={{ border:'1px solid rgba(34,211,238,0.1)', overflow:'hidden', transition:'border-color 0.2s', ...(isExpanded?{borderColor:'rgba(34,211,238,0.28)'}:{}) }}>
                      {/* Card Header — clickable */}
                      <div style={{ padding:'16px 20px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}
                        onClick={() => toggle(q.id, expanded, setExpanded)}>
                        <div className="flex items-center gap-3" style={{ flex:1, minWidth:0 }}>
                          <span style={{ fontSize:20, flexShrink:0 }}>{typeIcon(q.type)}</span>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontWeight:600, fontSize:14, marginBottom:5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{q.title}</div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`badge ${dc}`}>{q.difficulty}</span>
                              <span className={`badge ${typeColor(q.type)}`}>{q.type}</span>
                              <span style={{ fontSize:10, color:'var(--text-3)' }}>📚 {q.topic}</span>
                              {q.tableData?.some(t => t.name) && (
                                <span style={{ fontSize:10, color:'var(--cyan)', display:'flex', alignItems:'center', gap:2 }}>
                                  <Table2 size={9}/> {q.tableData.filter(t=>t.name).length}T
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{ color:'var(--text-3)', flexShrink:0 }}>
                          {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                        </div>
                      </div>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div style={{ borderTop:'1px solid var(--border)', padding:'20px' }}>
                          {/* Description */}
                          <p style={{ color:'var(--text-1)', fontSize:14, lineHeight:1.7, marginBottom:18 }}>{q.description}</p>

                          {/* Tables */}
                          {q.tableData && q.tableData.some(t => t.name || t.columns) && (
                            <div style={{ marginBottom:18 }}>
                              <div className="flex items-center gap-2" style={{ marginBottom:10 }}>
                                <Table2 size={14} color="var(--cyan)"/>
                                <span style={{ fontWeight:700, fontSize:13, color:'var(--cyan)' }}>Sample Tables</span>
                              </div>
                              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                                {q.tableData.filter(t => t.columns).map((tbl, ti) => (
                                  <div key={ti}>
                                    {tbl.name && <p style={{ fontSize:12, color:'var(--cyan)', fontWeight:600, marginBottom:5 }}>📊 {tbl.name}</p>}
                                    <div style={{ overflowX:'auto', borderRadius:'var(--radius-sm)' }}>
                                      <table style={{ fontSize:12, fontFamily:'JetBrains Mono,monospace', borderCollapse:'collapse', minWidth:'100%' }}>
                                        <thead>
                                          <tr>
                                            {tbl.columns.split(',').map((col, ci) => (
                                              <th key={ci} style={{ background:'rgba(34,211,238,0.12)', padding:'5px 12px', borderBottom:'1px solid rgba(34,211,238,0.18)', textAlign:'left', color:'var(--cyan)', whiteSpace:'nowrap' }}>
                                                {col.trim()}
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(tbl.rows||'').split('\n').filter(r=>r.trim()).map((row,ri) => (
                                            <tr key={ri} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                                              {row.split(',').map((cell,ci) => (
                                                <td key={ci} style={{ padding:'4px 12px', color:'var(--text-2)' }}>{cell.trim()}</td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Schema */}
                          {q.sampleSchema && (
                            <div style={{ marginBottom:18 }}>
                              <div className="flex items-center gap-2" style={{ marginBottom:8 }}>
                                <Code2 size={13} color="var(--purple-light)"/>
                                <span style={{ fontWeight:700, fontSize:13, color:'var(--purple-light)' }}>SQL Schema</span>
                              </div>
                              <pre style={{ background:'rgba(0,0,0,0.4)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:'var(--radius-sm)', padding:'12px 16px', fontFamily:'JetBrains Mono,monospace', fontSize:12, overflowX:'auto', color:'var(--text-1)', lineHeight:1.6, margin:0 }}>
                                {q.sampleSchema}
                              </pre>
                            </div>
                          )}

                          {/* User Query Box (for SQL questions) */}
                          {q.type === 'query' && (
                            <div style={{ marginBottom:16 }}>
                              <div className="flex items-center gap-2" style={{ marginBottom:6 }}>
                                <Code2 size={13} color="var(--yellow)"/>
                                <span style={{ fontWeight:600, fontSize:12, color:'var(--yellow)' }}>Your SQL Answer (practice)</span>
                              </div>
                              <textarea
                                className="input"
                                rows={4}
                                style={{ fontFamily:'JetBrains Mono,monospace', fontSize:12 }}
                                placeholder="SELECT * FROM ..."
                                value={userQuery[q.id] || ''}
                                onChange={e => setUserQuery(prev => ({ ...prev, [q.id]: e.target.value }))}
                              />
                            </div>
                          )}

                          {/* Actions row */}
                          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom: (showHint||showAns) ? 16 : 0 }}>
                            {q.hint && (
                              <button className="btn btn-ghost btn-sm"
                                style={{ color:'var(--yellow)', borderColor:'rgba(245,158,11,0.28)' }}
                                onClick={() => toggle(q.id, showHints, setShowHints)}>
                                <Lightbulb size={11}/> {showHint ? 'Hide Hint' : 'Show Hint'}
                              </button>
                            )}
                            {q.expectedQuery && (
                              <button className="btn btn-ghost btn-sm"
                                style={{ color:'var(--green)', borderColor:'rgba(16,185,129,0.28)' }}
                                onClick={() => toggle(q.id, showAnswers, setShowAnswers)}>
                                {showAns ? <EyeOff size={11}/> : <Eye size={11}/>} {showAns ? 'Hide Answer' : 'Reveal Answer'}
                              </button>
                            )}
                          </div>

                          {/* Hint */}
                          {showHint && q.hint && (
                            <div style={{ padding:'11px 14px', background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.22)', borderRadius:'var(--radius-sm)', marginBottom:12 }}>
                              <div className="flex items-center gap-2" style={{ marginBottom:5 }}>
                                <Lightbulb size={12} color="var(--yellow)"/>
                                <span style={{ fontWeight:700, fontSize:12, color:'var(--yellow)' }}>Hint</span>
                              </div>
                              <p style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.6, margin:0 }}>{q.hint}</p>
                            </div>
                          )}

                          {/* Answer */}
                          {showAns && q.expectedQuery && (
                            <div style={{ marginBottom:12 }}>
                              <div style={{ padding:'11px 14px', background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.22)', borderRadius:'var(--radius-sm)' }}>
                                <div className="flex items-center gap-2" style={{ marginBottom:8 }}>
                                  <CheckCircle2 size={12} color="var(--green)"/>
                                  <span style={{ fontWeight:700, fontSize:12, color:'var(--green)' }}>Answer</span>
                                </div>
                                <pre style={{ fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'var(--text-1)', overflowX:'auto', margin:0, lineHeight:1.6 }}>
                                  {q.expectedQuery}
                                </pre>
                              </div>
                              {q.explanation && (
                                <div style={{ marginTop:10, padding:'11px 14px', background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:'var(--radius-sm)' }}>
                                  <div className="flex items-center gap-2" style={{ marginBottom:6 }}>
                                    <BookOpen size={12} color="var(--purple-light)"/>
                                    <span style={{ fontWeight:700, fontSize:12, color:'var(--purple-light)' }}>Explanation</span>
                                  </div>
                                  <p style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.7, margin:0 }}>{q.explanation}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
          }

          {/* Footer watermark */}
          <div style={{ textAlign:'center', marginTop:48, paddingTop:16, borderTop:'1px solid rgba(34,211,238,0.08)', fontSize:11, color:'rgba(34,211,238,0.25)', fontFamily:'JetBrains Mono,monospace', letterSpacing:'0.1em' }}>
            ⚡ CodeForge MCA — DBMS Lab — by <strong style={{ color:'rgba(34,211,238,0.4)' }}>Rakshil Gandhi</strong>
          </div>

        </div>
      </div>
    </>
  );
};

export default DBMSPage;
"""

with open(target, 'w', encoding='utf-8') as f:
    f.write(code)
print(f"DBMSPage.tsx written! Size: {os.path.getsize(target):,} bytes")
