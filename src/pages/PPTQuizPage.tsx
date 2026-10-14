import React, { useState, useRef, useEffect } from 'react';
import Navbar from '../components/Navbar';
import {
  Upload, Brain, CheckCircle2, XCircle, RotateCcw,
  FileText, Zap, BookOpen, AlertTriangle, Loader2,
  ChevronRight, Trophy, Clock, Target,
} from 'lucide-react';

interface MCQ {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface QuizResult {
  questionId: number;
  selectedIndex: number;
  correct: boolean;
}

type Phase = 'upload' | 'generating' | 'quiz' | 'results';

// ── Fake Gemini AI MCQ generator (replace with real API call if needed) ──────
// In production you'd POST the pptx text to a backend endpoint that calls Gemini.
// For now we extract text from the uploaded file name/meta and generate demo Qs.
async function generateMCQsFromText(text: string): Promise<MCQ[]> {
  // Simulate network delay
  await new Promise(r => setTimeout(r, 2500));

  // Demo MCQs based on slide text (in production, call Gemini API)
  const lines = text.split('\n').filter(l => l.trim().length > 10).slice(0, 30);
  const topics = lines.length > 0 ? lines : ['Database Management System', 'SQL', 'Normalization'];

  const templates: MCQ[] = [
    {
      id: 1,
      question: `Based on your presentation, which of the following best describes a Primary Key?`,
      options: ['A key that can have NULL values', 'A unique identifier for each record in a table', 'A key used to link two tables', 'A key that stores duplicate values'],
      correctIndex: 1,
      explanation: 'A Primary Key uniquely identifies each record in a table and cannot contain NULL values.',
    },
    {
      id: 2,
      question: 'What does SQL stand for?',
      options: ['Structured Query Language', 'Simple Query Language', 'Standard Question Language', 'Sequential Query Logic'],
      correctIndex: 0,
      explanation: 'SQL stands for Structured Query Language, the standard language for relational databases.',
    },
    {
      id: 3,
      question: 'Which normal form eliminates transitive dependencies?',
      options: ['1NF', '2NF', '3NF', 'BCNF'],
      correctIndex: 2,
      explanation: '3NF (Third Normal Form) eliminates transitive dependencies — non-key attributes should not depend on other non-key attributes.',
    },
    {
      id: 4,
      question: 'What is the result of a JOIN operation in SQL?',
      options: ['Removes duplicate rows', 'Combines rows from two or more tables based on a related column', 'Sorts the result set', 'Filters rows using a condition'],
      correctIndex: 1,
      explanation: 'A JOIN combines rows from two or more tables based on a related column between them.',
    },
    {
      id: 5,
      question: 'Which SQL command is used to retrieve data from a database?',
      options: ['INSERT', 'UPDATE', 'SELECT', 'DELETE'],
      correctIndex: 2,
      explanation: 'The SELECT statement is used to retrieve data from one or more tables in a database.',
    },
    {
      id: 6,
      question: 'What does ACID stand for in database transactions?',
      options: ['Atomicity, Consistency, Isolation, Durability', 'Add, Create, Insert, Delete', 'Access, Control, Integrity, Data', 'Atomicity, Consistency, Integration, Deletion'],
      correctIndex: 0,
      explanation: 'ACID stands for Atomicity, Consistency, Isolation, and Durability — properties that guarantee database transactions are processed reliably.',
    },
    {
      id: 7,
      question: 'Which command removes all rows from a table without deleting the table structure?',
      options: ['DROP TABLE', 'DELETE FROM', 'TRUNCATE TABLE', 'REMOVE FROM'],
      correctIndex: 2,
      explanation: 'TRUNCATE TABLE removes all rows quickly without logging individual row deletions, but keeps the table structure.',
    },
    {
      id: 8,
      question: 'What is a Foreign Key?',
      options: ['A key from another database', 'A field that links to the Primary Key of another table', 'A key that encrypts data', 'A backup key for the table'],
      correctIndex: 1,
      explanation: 'A Foreign Key is a field (or group of fields) in one table that refers to the Primary Key in another table, establishing a relationship between them.',
    },
    {
      id: 9,
      question: 'Which clause is used to filter groups in SQL?',
      options: ['WHERE', 'HAVING', 'GROUP BY', 'ORDER BY'],
      correctIndex: 1,
      explanation: 'HAVING clause is used to filter groups created by GROUP BY, whereas WHERE filters individual rows before grouping.',
    },
    {
      id: 10,
      question: 'What type of JOIN returns all records when there is a match in either the left or right table?',
      options: ['INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL OUTER JOIN'],
      correctIndex: 3,
      explanation: 'FULL OUTER JOIN returns all records when there is a match in either the left or right table, with NULL for missing matches.',
    },
  ];

  // Shuffle and return up to 8
  return templates.sort(() => Math.random() - 0.5).slice(0, 8).map((q, i) => ({ ...q, id: i + 1 }));
}

// ── Extract readable text from file (name + dummy extraction) ───────────────
function extractTextFromFile(file: File): string {
  // In production you'd send the file to a backend for text extraction.
  // Here we use the filename and type as a proxy.
  return `Presentation: ${file.name}\nType: ${file.type}\nDatabase Management Systems, SQL, Normalization, Transactions, ACID, Joins`;
}

const PPTQuizPage: React.FC = () => {
  const [phase, setPhase]   = useState<Phase>('upload');
  const [file, setFile]     = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [questions, setQuestions]   = useState<MCQ[]>([]);
  const [current, setCurrent]       = useState(0);
  const [results, setResults]       = useState<QuizResult[]>([]);
  const [selected, setSelected]     = useState<number | null>(null);
  const [revealed, setRevealed]     = useState(false);
  const [timeLeft, setTimeLeft]     = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleFile = (f: File) => {
    const allowed = ['.ppt','.pptx','.pdf','.txt','.doc','.docx'];
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
    if (!allowed.some(a => ext.includes(a.replace('.',''))) && !f.name.includes('.')) {
      // Accept anyway for demo
    }
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const startGeneration = async () => {
    if (!file) return;
    setPhase('generating');
    try {
      const text = extractTextFromFile(file);
      const qs   = await generateMCQsFromText(text);
      setQuestions(qs);
      setCurrent(0);
      setResults([]);
      setSelected(null);
      setRevealed(false);
      setTimeLeft(30);
      setPhase('quiz');
      startTimer();
    } catch (err) {
      console.error(err);
      setPhase('upload');
    }
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(30);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // Auto-advance on timeout
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSelect = (idx: number) => {
    if (revealed) return;
    setSelected(idx);
    setRevealed(true);
    if (timerRef.current) clearInterval(timerRef.current);
    const q = questions[current];
    setResults(prev => [...prev, { questionId: q.id, selectedIndex: idx, correct: idx === q.correctIndex }]);
  };

  const handleNext = () => {
    if (current + 1 >= questions.length) {
      setPhase('results');
    } else {
      setCurrent(c => c + 1);
      setSelected(null);
      setRevealed(false);
      setTimeLeft(30);
      startTimer();
    }
  };

  const restart = () => {
    setFile(null); setQuestions([]); setCurrent(0);
    setResults([]); setSelected(null); setRevealed(false);
    setPhase('upload');
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const score = results.filter(r => r.correct).length;
  const pct   = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  const getScoreGrade = () => {
    if (pct >= 90) return { grade: 'A+', label: 'Outstanding! 🏆', color: 'var(--yellow)' };
    if (pct >= 75) return { grade: 'A',  label: 'Excellent! 🎉',  color: 'var(--green)' };
    if (pct >= 60) return { grade: 'B',  label: 'Good Work! 👍',  color: 'var(--cyan)' };
    if (pct >= 40) return { grade: 'C',  label: 'Keep Going! 💪', color: 'var(--yellow)' };
    return { grade: 'D', label: 'Review & Retry! 📖', color: 'var(--red)' };
  };

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-content" style={{ maxWidth: 780 }}>

          {/* ═══════════════ UNDER MAINTENANCE OVERLAY ═══════════════ */}
          <div style={{ position:'fixed', inset:0, zIndex:9998, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'rgba(7,7,20,0.94)', backdropFilter:'blur(8px)', padding:24 }}>
            <style>{`
              @keyframes spin-gear { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
              @keyframes bounce-hard { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-20px)} }
              @keyframes glitch {
                0%,90%,100%{transform:none;filter:none}
                91%{transform:translate(2px,-1px);filter:hue-rotate(90deg)}
                93%{transform:translate(-2px,1px);filter:hue-rotate(-90deg)}
                95%{transform:translate(1px,2px);filter:blur(1px)}
                97%{transform:none;filter:none}
              }
              @keyframes confetti-fall {
                0%{transform:translateY(-10px) rotate(0deg);opacity:1}
                100%{transform:translateY(60px) rotate(360deg);opacity:0}
              }
              @keyframes worker-walk {
                0%,100%{transform:translateX(-5px) scaleX(1)}
                50%{transform:translateX(5px) scaleX(-1)}
              }
            `}</style>
            {/* Floating gears */}
            <div style={{ position:'absolute', top:60, left:'10%', fontSize:80, opacity:0.07, animation:'spin-gear 8s linear infinite' }}>⚙️</div>
            <div style={{ position:'absolute', top:120, right:'8%', fontSize:50, opacity:0.07, animation:'spin-gear 5s linear infinite reverse' }}>⚙️</div>
            <div style={{ position:'absolute', bottom:80, left:'5%', fontSize:60, opacity:0.06, animation:'spin-gear 12s linear infinite' }}>⚙️</div>

            <div style={{ textAlign:'center', maxWidth:520 }}>
              {/* Animated worker */}
              <div style={{ fontSize:72, marginBottom:8, animation:'bounce-hard 1.2s ease-in-out infinite' }}>🚧</div>
              <div style={{ fontSize:40, marginBottom:4, animation:'worker-walk 2s ease-in-out infinite' }}>👷</div>

              <h1 style={{ fontSize:'clamp(28px,5vw,48px)', fontWeight:900, marginBottom:8, animation:'glitch 4s ease-in-out infinite',
                background:'linear-gradient(135deg,#f59e0b,#ef4444)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                Under Maintenance
              </h1>

              <div style={{ fontSize:32, marginBottom:20, letterSpacing:4 }}>
                {'🔧 🛠️ 🔩'}
              </div>

              <div className="glass-card" style={{ padding:'20px 28px', border:'1px solid rgba(245,158,11,0.35)', background:'rgba(245,158,11,0.06)', marginBottom:24 }}>
                <p style={{ fontSize:16, color:'var(--text-1)', lineHeight:1.7, margin:0 }}>
                  📋 The <strong style={{ color:'var(--yellow)' }}>MCQ Quiz section</strong> is currently under maintenance.
                </p>
                <p style={{ fontSize:13, color:'var(--text-3)', marginTop:8, marginBottom:0 }}>
                  Our hamsters are running on their wheels 🐹 trying to fix this. Come back soon!<br/>
                  <em style={{ fontSize:11, opacity:0.7 }}>(Our developers are vigorously Googling solutions 😅)</em>
                </p>
              </div>

              <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap', marginBottom:24 }}>
                {['Fixing bugs 🐛','Drinking coffee ☕','Blaming each other 👀','Stack Overflow-ing 🔍'].map(s => (
                  <span key={s} style={{ fontSize:11, padding:'4px 12px', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:99, color:'var(--yellow)' }}>{s}</span>
                ))}
              </div>

              <a href="/problems" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'12px 24px', background:'linear-gradient(135deg,var(--purple),var(--purple-light))', color:'#fff', textDecoration:'none', borderRadius:10, fontWeight:700, fontSize:14, boxShadow:'0 4px 20px rgba(139,92,246,0.4)' }}>
                🚀 Go to Problems Instead
              </a>
              <div style={{ marginTop:12, fontSize:11, color:'var(--text-3)', fontFamily:'JetBrains Mono,monospace' }}>
                // ETA: when the coffee runs out ☕
              </div>
            </div>
          </div>


          {/* Watermark */}
          <div style={{ position:'fixed', bottom:18, right:22, zIndex:9999, pointerEvents:'none', opacity:0.15,
            fontSize:10, fontFamily:'JetBrains Mono,monospace', color:'var(--pink)',
            letterSpacing:'0.12em', textTransform:'uppercase', userSelect:'none' }}>
            ⚡ Created by Rakshil Gandhi
          </div>

          {/* Header */}
          <div style={{ textAlign:'center', marginBottom:36 }}>
            <div style={{ width:60, height:60, borderRadius:16, margin:'0 auto 14px', display:'flex', alignItems:'center', justifyContent:'center',
              background:'linear-gradient(135deg,rgba(236,72,153,0.22),rgba(139,92,246,0.15))',
              border:'1px solid rgba(236,72,153,0.38)', boxShadow:'0 0 30px rgba(236,72,153,0.18)' }}>
              <Brain size={28} color="var(--pink)" />
            </div>
            <h1 className="font-display gradient-text" style={{ fontSize:'clamp(22px,3.5vw,30px)', fontWeight:800, lineHeight:1.15 }}>
              PPT → MCQ Quiz
            </h1>
            <p style={{ color:'var(--text-3)', fontSize:12, marginTop:6 }}>
              Upload your presentation — get an instant quiz • for personal reference only (not on leaderboard)
            </p>
            <div style={{ display:'inline-flex', alignItems:'center', gap:5, marginTop:10, padding:'4px 13px', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:99 }}>
              <AlertTriangle size={10} color="var(--yellow)"/>
              <span style={{ fontSize:10, color:'var(--yellow)' }}>For Reference Only — scores are NOT saved to leaderboard</span>
            </div>
          </div>

          {/* ── UPLOAD PHASE ── */}
          {phase === 'upload' && (
            <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
              {/* Drop Zone */}
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? 'var(--pink)' : file ? 'var(--green)' : 'rgba(236,72,153,0.35)'}`,
                  borderRadius:'var(--radius-lg)', padding:'48px 24px', textAlign:'center', cursor:'pointer',
                  background: isDragging ? 'rgba(236,72,153,0.06)' : file ? 'rgba(16,185,129,0.04)' : 'rgba(236,72,153,0.02)',
                  transition:'all 0.22s ease',
                }}>
                <input ref={fileRef} type="file" accept=".ppt,.pptx,.pdf,.txt,.doc,.docx" style={{ display:'none' }}
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                {file ? (
                  <>
                    <CheckCircle2 size={40} color="var(--green)" style={{ marginBottom:12 }}/>
                    <p style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>{file.name}</p>
                    <p style={{ color:'var(--text-3)', fontSize:12 }}>{(file.size/1024).toFixed(1)} KB · Click to change</p>
                  </>
                ) : (
                  <>
                    <Upload size={40} color="var(--pink)" style={{ marginBottom:14, opacity:0.6 }}/>
                    <p style={{ fontWeight:700, fontSize:16, marginBottom:6 }}>Drop your presentation here</p>
                    <p style={{ color:'var(--text-3)', fontSize:12 }}>or click to browse</p>
                    <p style={{ color:'var(--text-3)', fontSize:11, marginTop:8 }}>Supports: .pptx · .ppt · .pdf · .docx · .txt</p>
                  </>
                )}
              </div>

              {/* Info cards */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:12 }}>
                {[
                  { icon:<FileText size={16}/>, title:'Any Format', desc:'PPT, PDF, DOCX accepted', color:'var(--cyan)' },
                  { icon:<Brain size={16}/>, title:'AI Generated', desc:'10 questions auto-created', color:'var(--pink)' },
                  { icon:<Clock size={16}/>, title:'Timed Quiz', desc:'30 seconds per question', color:'var(--yellow)' },
                  { icon:<Target size={16}/>, title:'Ref Only', desc:'Scores not on leaderboard', color:'var(--green)' },
                ].map((c,i) => (
                  <div key={i} className="glass-card" style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ color:c.color, flexShrink:0 }}>{c.icon}</div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:12 }}>{c.title}</div>
                      <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>{c.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <button className="btn btn-primary"
                style={{ width:'100%', justifyContent:'center', background:'linear-gradient(135deg,var(--pink),#9333ea)', boxShadow:'0 6px 24px rgba(236,72,153,0.3)', padding:'14px 24px', fontSize:15, fontWeight:700 }}
                disabled={!file}
                onClick={startGeneration}>
                <Zap size={16}/> Generate Quiz from Presentation
              </button>
            </div>
          )}

          {/* ── GENERATING PHASE ── */}
          {phase === 'generating' && (
            <div style={{ textAlign:'center', padding:'60px 0' }}>
              <div style={{ position:'relative', width:80, height:80, margin:'0 auto 20px' }}>
                <div style={{ width:80, height:80, borderRadius:999, border:'3px solid rgba(236,72,153,0.15)', position:'absolute' }}/>
                <div style={{ width:80, height:80, borderRadius:999, border:'3px solid transparent', borderTop:'3px solid var(--pink)', position:'absolute', animation:'spin-slow 0.9s linear infinite' }}/>
                <Brain size={30} style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', color:'var(--pink)' }}/>
              </div>
              <h2 style={{ fontWeight:700, fontSize:18, marginBottom:8 }}>Analysing your presentation...</h2>
              <p style={{ color:'var(--text-3)', fontSize:13 }}>Generating 8–10 MCQ questions from your content</p>
              <div style={{ display:'flex', gap:4, justifyContent:'center', marginTop:16 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width:6, height:6, borderRadius:99, background:'var(--pink)', animation:`bounce ${0.6+i*0.15}s ease infinite alternate` }}/>
                ))}
              </div>
            </div>
          )}

          {/* ── QUIZ PHASE ── */}
          {phase === 'quiz' && questions.length > 0 && (
            <div>
              {/* Progress bar */}
              <div style={{ marginBottom:20 }}>
                <div className="flex items-center justify-between" style={{ marginBottom:8 }}>
                  <span style={{ fontSize:12, color:'var(--text-3)' }}>Question {current + 1} of {questions.length}</span>
                  <div className="flex items-center gap-2">
                    <Clock size={12} color={timeLeft <= 10 ? 'var(--red)' : 'var(--text-3)'}/>
                    <span style={{ fontSize:13, fontWeight:700, color: timeLeft <= 10 ? 'var(--red)' : 'var(--text-2)', fontFamily:'JetBrains Mono,monospace' }}>
                      {timeLeft}s
                    </span>
                  </div>
                </div>
                <div style={{ height:5, background:'rgba(255,255,255,0.06)', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:99, background:'linear-gradient(90deg,var(--pink),var(--purple-light))', width:`${((current+1)/questions.length)*100}%`, transition:'width 0.4s ease' }}/>
                </div>
                <div style={{ height:4, background:'rgba(255,255,255,0.04)', borderRadius:99, marginTop:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:99, background: timeLeft<=10?'var(--red)':'var(--cyan)', width:`${(timeLeft/30)*100}%`, transition:'width 1s linear' }}/>
                </div>
              </div>

              {/* Question card */}
              <div className="glass-card" style={{ padding:'26px 24px', marginBottom:16, border:'1px solid rgba(236,72,153,0.2)' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:20 }}>
                  <div style={{ width:32, height:32, borderRadius:99, background:'rgba(236,72,153,0.15)', border:'1px solid rgba(236,72,153,0.3)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13, color:'var(--pink)' }}>
                    {current + 1}
                  </div>
                  <p style={{ fontWeight:600, fontSize:15, lineHeight:1.55, flex:1 }}>{questions[current].question}</p>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {questions[current].options.map((opt, idx) => {
                    const isCorrect = idx === questions[current].correctIndex;
                    const isSelected = idx === selected;
                    let borderColor = 'var(--border)';
                    let bg = 'transparent';
                    let textColor = 'var(--text-1)';
                    if (revealed) {
                      if (isCorrect)  { borderColor='var(--green)'; bg='rgba(16,185,129,0.1)'; textColor='var(--green)'; }
                      if (isSelected && !isCorrect) { borderColor='var(--red)'; bg='rgba(239,68,68,0.1)'; textColor='var(--red)'; }
                    } else if (isSelected) {
                      borderColor='var(--pink)'; bg='rgba(236,72,153,0.08)';
                    }
                    return (
                      <button key={idx} onClick={() => handleSelect(idx)} disabled={revealed}
                        style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:'var(--radius-md)',
                          border:`1px solid ${borderColor}`, background:bg, color:textColor,
                          cursor: revealed ? 'default' : 'pointer', transition:'all 0.18s ease',
                          textAlign:'left', fontFamily:'Space Grotesk,sans-serif', fontSize:13, fontWeight:500, width:'100%' }}>
                        <div style={{ width:26, height:26, borderRadius:99, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700,
                          background: revealed && isCorrect ? 'rgba(16,185,129,0.2)' : revealed && isSelected && !isCorrect ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)',
                          border:`1px solid ${borderColor}` }}>
                          {revealed ? (isCorrect ? <CheckCircle2 size={13}/> : isSelected ? <XCircle size={13}/> : String.fromCharCode(65+idx)) : String.fromCharCode(65+idx)}
                        </div>
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation */}
                {revealed && (
                  <div style={{ marginTop:16, padding:'12px 14px', background:'rgba(139,92,246,0.07)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:'var(--radius-sm)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
                      <BookOpen size={12} color="var(--purple-light)"/>
                      <span style={{ fontWeight:700, fontSize:11, color:'var(--purple-light)' }}>Explanation</span>
                    </div>
                    <p style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.6, margin:0 }}>{questions[current].explanation}</p>
                  </div>
                )}
              </div>

              {revealed && (
                <button className="btn btn-primary"
                  style={{ width:'100%', justifyContent:'center', padding:'12px 24px' }}
                  onClick={handleNext}>
                  {current + 1 >= questions.length ? '📊 See Results' : 'Next Question'} <ChevronRight size={15}/>
                </button>
              )}
            </div>
          )}

          {/* ── RESULTS PHASE ── */}
          {phase === 'results' && (() => {
            const g = getScoreGrade();
            return (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {/* Score hero */}
                <div className="glass-card" style={{ padding:'32px 24px', textAlign:'center', border:`1px solid ${g.color}30`, background:`linear-gradient(135deg,${g.color}10,${g.color}03)` }}>
                  <div style={{ fontSize:72, fontWeight:800, fontFamily:'Syne,sans-serif', color:g.color, lineHeight:1 }}>{g.grade}</div>
                  <div style={{ fontSize:18, fontWeight:700, marginTop:8, marginBottom:4 }}>{g.label}</div>
                  <div style={{ color:'var(--text-3)', fontSize:13 }}>
                    {score}/{questions.length} correct · {pct}% score
                  </div>

                  <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:16, padding:'7px 18px', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.22)', borderRadius:99 }}>
                    <AlertTriangle size={11} color="var(--yellow)"/>
                    <span style={{ fontSize:11, color:'var(--yellow)' }}>Reference only · Not added to leaderboard</span>
                  </div>
                </div>

                {/* Per-question breakdown */}
                <div className="glass-card" style={{ padding:0, overflow:'hidden' }}>
                  <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
                    <Trophy size={15} color="var(--yellow)"/>
                    <span style={{ fontWeight:700, fontSize:14 }}>Question Review</span>
                  </div>
                  {questions.map((q, i) => {
                    const r = results.find(r => r.questionId === q.id);
                    return (
                      <div key={q.id} style={{ padding:'14px 18px', borderBottom: i < questions.length-1 ? '1px solid var(--border)' : 'none', display:'flex', alignItems:'flex-start', gap:12 }}>
                        <div style={{ width:28, height:28, borderRadius:99, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                          background: r?.correct ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          border: `1px solid ${r?.correct ? 'var(--green)' : 'var(--red)'}` }}>
                          {r?.correct ? <CheckCircle2 size={14} color="var(--green)"/> : <XCircle size={14} color="var(--red)"/>}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontWeight:500, fontSize:13, marginBottom:4 }}>{q.question}</p>
                          {r && !r.correct && (
                            <p style={{ fontSize:11, color:'var(--text-3)' }}>
                              Your answer: <span style={{ color:'var(--red)' }}>{q.options[r.selectedIndex]}</span>
                              {' · '}Correct: <span style={{ color:'var(--green)' }}>{q.options[q.correctIndex]}</span>
                            </p>
                          )}
                          {r?.correct && <p style={{ fontSize:11, color:'var(--green)' }}>✓ {q.options[q.correctIndex]}</p>}
                        </div>
                        <span style={{ fontWeight:700, fontSize:12, color: r?.correct ? 'var(--green)' : 'var(--red)', flexShrink:0 }}>
                          {r?.correct ? '+1' : '0'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <button className="btn btn-ghost"
                  style={{ width:'100%', justifyContent:'center', padding:'12px 24px' }}
                  onClick={restart}>
                  <RotateCcw size={14}/> Start New Quiz
                </button>
              </div>
            );
          })()}

          {/* Footer watermark */}
          <div style={{ textAlign:'center', marginTop:44, paddingTop:14, borderTop:'1px solid rgba(236,72,153,0.08)', fontSize:11, color:'rgba(236,72,153,0.22)', fontFamily:'JetBrains Mono,monospace', letterSpacing:'0.1em' }}>
            ⚡ PPT Quiz Feature — CodeForge MCA — by <strong style={{ color:'rgba(236,72,153,0.38)' }}>Rakshil Gandhi</strong>
          </div>

        </div>
      </div>
    </>
  );
};

export default PPTQuizPage;
