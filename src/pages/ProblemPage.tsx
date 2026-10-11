import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import Editor from '@monaco-editor/react';
import { Play, Send, ThumbsUp, ThumbsDown, MessageCircle, ChevronDown, ChevronUp, Clock, Loader2, CheckCircle2, XCircle, Terminal, BookOpen, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import type { Problem } from './ProblemsPage';

const LANG_OPTIONS = [
  { id: 'java', label: 'Java', mono: 'java' },
  { id: 'c', label: 'C', mono: 'c' },
  { id: 'python', label: 'Python', mono: 'python' },
  { id: 'javascript', label: 'JavaScript', mono: 'javascript' },
];

interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: any;
  likes: string[];
  dislikes: string[];
}

interface Submission {
  id: string;
  userId: string;
  userName: string;
  language: string;
  status: 'accepted' | 'wrong_answer' | 'error';
  runtime: number;
  createdAt: any;
}

// ── Anti-paste / anti-inspect security ──
const useAntiCheat = (editorRef: React.MutableRefObject<any>) => {
  useEffect(() => {
    const blockPaste = (e: ClipboardEvent) => {
      const target = e.target as Element;
      if (target.closest('.monaco-editor') || target.closest('[data-mode-id]')) {
        e.stopPropagation();
        // Allow normal typing but block paste
        e.preventDefault();
        toast.error('🚫 Pasting is disabled! Type your solution.', { id: 'no-paste' });
      }
    };
    const blockContextMenu = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target.closest('.monaco-editor')) { e.preventDefault(); }
    };
    const blockKeys = (e: KeyboardEvent) => {
      // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+Shift+C
      if (e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) ||
        (e.ctrlKey && e.key === 'U')) {
        e.preventDefault();
        toast.error('🚫 DevTools disabled!', { id: 'no-devtools' });
      }
    };
    document.addEventListener('paste', blockPaste, true);
    document.addEventListener('contextmenu', blockContextMenu, true);
    document.addEventListener('keydown', blockKeys, true);
    return () => {
      document.removeEventListener('paste', blockPaste, true);
      document.removeEventListener('contextmenu', blockContextMenu, true);
      document.removeEventListener('keydown', blockKeys, true);
    };
  }, []);
};

// ── Simulated test runner (runs in browser) ──
const simulateRun = async (code: string, lang: string, testCases: { input: string; expectedOutput: string }[]) => {
  // In a real app this would call a Judge0 API or similar
  // For now we simulate with a realistic delay and random results based on code quality
  await new Promise(r => setTimeout(r, 1000 + Math.random() * 1500));
  
  const hasMainLogic = code.length > 100;
  const runtime = Math.floor(50 + Math.random() * 300);
  
  if (!hasMainLogic) {
    return { status: 'error' as const, output: 'Compilation Error: No meaningful code detected.', runtime: 0, passed: 0, total: testCases.length };
  }
  
  // Simulate passing test cases
  const passed = Math.floor(testCases.length * (0.5 + Math.random() * 0.5));
  const status = passed === testCases.length ? 'accepted' as const : 'wrong_answer' as const;
  
  const output = passed === testCases.length 
    ? `✅ All ${testCases.length}/${testCases.length} test cases passed!\nRuntime: ${runtime}ms`
    : `❌ ${passed}/${testCases.length} test cases passed.\nFailed on test case ${passed + 1}:\nExpected: ${testCases[passed]?.expectedOutput || 'N/A'}\nGot: Wrong output`;
  
  return { status, output, runtime, passed, total: testCases.length };
};

const ProblemPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const editorRef = useRef<any>(null);
  
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<'java' | 'c' | 'python' | 'javascript'>('python');
  const [code, setCode] = useState('');
  const [activeTab, setActiveTab] = useState<'description' | 'submissions' | 'comments'>('description');
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runResult, setRunResult] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [problemLiked, setProblemLiked] = useState(false);
  const [problemDisliked, setProblemDisliked] = useState(false);

  useAntiCheat(editorRef);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, 'problems', id));
        if (!snap.exists()) { navigate('/problems'); return; }
        const p = { id: snap.id, ...snap.data() } as Problem;
        setProblem(p);
        setCode(p.starterCode?.[lang] || '// Write your solution here\n');
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  useEffect(() => {
    if (problem) setCode(problem.starterCode?.[lang] || `// Write your ${lang} solution here\n`);
  }, [lang, problem]);

  const loadComments = useCallback(async () => {
    if (!id) return;
    const q = query(collection(db, 'problems', id, 'comments'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment)));
  }, [id]);

  const loadSubmissions = useCallback(async () => {
    if (!id) return;
    const q = query(collection(db, 'submissions'), where('problemId', '==', id), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));
  }, [id]);

  useEffect(() => {
    if (activeTab === 'comments') loadComments();
    if (activeTab === 'submissions') loadSubmissions();
  }, [activeTab]);

  const handleRun = async () => {
    if (!problem) return;
    setRunning(true);
    setRunResult(null);
    try {
      const result = await simulateRun(code, lang, problem.testCases?.slice(0, 3) || []);
      setRunResult(result);
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !profile || !problem) { toast.error('Login to submit!'); navigate('/login'); return; }
    setSubmitting(true);
    setRunResult(null);
    try {
      const result = await simulateRun(code, lang, problem.testCases || []);
      setRunResult(result);
      
      // Save submission
      await addDoc(collection(db, 'submissions'), {
        userId: user.uid,
        userName: profile.displayName,
        problemId: id,
        problemTitle: problem.title,
        language: lang,
        code, // In production, don't store raw code or encrypt it
        status: result.status,
        runtime: result.runtime,
        score: result.status === 'accepted' ? Math.max(100 - result.runtime / 10, 10) : 0,
        createdAt: serverTimestamp(),
      });

      // Update problem solved count & user stats
      if (result.status === 'accepted') {
        await updateDoc(doc(db, 'problems', id!), { solvedCount: increment(1) });
        await updateDoc(doc(db, 'users', user.uid), {
          problemsSolved: increment(1),
          score: increment(Math.max(100 - result.runtime / 10, 10)),
          totalSubmissions: increment(1),
        });
        toast.success('🎉 Accepted! You crushed it!');
      } else if (result.status === 'wrong_answer') {
        await updateDoc(doc(db, 'users', user.uid), { totalSubmissions: increment(1) });
        toast.error('Wrong Answer. Keep grinding! 💪');
      } else {
        toast.error('Runtime Error. Debug your code!');
      }
      loadSubmissions();
    } catch (err) { toast.error('Submission failed!'); console.error(err); }
    finally { setSubmitting(false); }
  };

  const postComment = async () => {
    if (!user || !profile) { toast.error('Login to comment!'); return; }
    if (!newComment.trim()) return;
    setPostingComment(true);
    try {
      await addDoc(collection(db, 'problems', id!, 'comments'), {
        userId: user.uid,
        userName: profile.displayName,
        text: newComment.trim(),
        createdAt: serverTimestamp(),
        likes: [],
        dislikes: [],
      });
      setNewComment('');
      loadComments();
      toast.success('Comment posted! 💬');
    } finally { setPostingComment(false); }
  };

  const toggleCommentLike = async (commentId: string, liked: boolean) => {
    if (!user) { toast.error('Login to like!'); return; }
    const ref = doc(db, 'problems', id!, 'comments', commentId);
    await updateDoc(ref, liked
      ? { likes: arrayRemove(user.uid), dislikes: arrayUnion(user.uid) }
      : { likes: arrayUnion(user.uid), dislikes: arrayRemove(user.uid) }
    );
    loadComments();
  };

  const toggleProblemLike = async (type: 'like' | 'dislike') => {
    if (!user) { toast.error('Login to vote!'); return; }
    const ref = doc(db, 'problems', id!);
    if (type === 'like') {
      await updateDoc(ref, { likes: increment(problemLiked ? -1 : 1) });
      if (problemDisliked) await updateDoc(ref, { dislikes: increment(-1) });
      setProblemLiked(p => !p);
      setProblemDisliked(false);
    } else {
      await updateDoc(ref, { dislikes: increment(problemDisliked ? -1 : 1) });
      if (problemLiked) await updateDoc(ref, { likes: increment(-1) });
      setProblemDisliked(p => !p);
      setProblemLiked(false);
    }
    // Reload problem
    const snap = await getDoc(doc(db, 'problems', id!));
    if (snap.exists()) setProblem({ id: snap.id, ...snap.data() } as Problem);
  };

  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    // Add IntelliSense suggestions
    editor.addAction({
      id: 'no-paste',
      label: 'Paste disabled',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV],
      run: () => { toast.error('🚫 Pasting is disabled! Type your solution.', { id: 'no-paste' }); },
    });
  };

  if (loading) return (
    <>
      <Navbar />
      <div className="page flex items-center justify-center" style={{ height: '100vh' }}>
        <div className="spinner" style={{ width: 48, height: 48 }} />
      </div>
    </>
  );

  if (!problem) return null;

  const diffClass = problem.difficulty === 'easy' ? 'diff-easy' : problem.difficulty === 'medium' ? 'diff-medium' : 'diff-hard';

  return (
    <>
      <Navbar />
      <div className="problem-layout" style={{ marginTop: 64 }}>
        {/* ── Left: Description/Comments/Submissions ── */}
        <div className="problem-desc-panel">
          {/* Problem Header */}
          <div style={{ marginBottom: 24 }}>
            <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: 12 }}>
              <span className={`badge ${diffClass}`}>{problem.difficulty}</span>
              <span className="badge badge-purple">{problem.category}</span>
              {problem.tags?.map(t => <span key={t} className="tag">{t}</span>)}
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>{problem.title}</h1>
            
            {/* Like/Dislike */}
            <div className="flex items-center gap-3">
              <button onClick={() => toggleProblemLike('like')} className="flex items-center gap-1" style={{ background: 'none', border: 'none', cursor: 'pointer', color: problemLiked ? 'var(--green)' : 'var(--text-2)', fontSize: 14, fontFamily: 'inherit' }}>
                <ThumbsUp size={15} /> {problem.likes || 0}
              </button>
              <button onClick={() => toggleProblemLike('dislike')} className="flex items-center gap-1" style={{ background: 'none', border: 'none', cursor: 'pointer', color: problemDisliked ? 'var(--red)' : 'var(--text-2)', fontSize: 14, fontFamily: 'inherit' }}>
                <ThumbsDown size={15} /> {problem.dislikes || 0}
              </button>
              <span style={{ color: 'var(--text-3)', fontSize: 13 }}><Clock size={13} style={{ verticalAlign: 'middle' }} /> {problem.solvedCount || 0} solved</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: 24 }}>
            {[{id: 'description', label: 'Description', icon: <BookOpen size={14} />},
              {id: 'submissions', label: 'Submissions', icon: <Trophy size={14} />},
              {id: 'comments', label: `Comments`, icon: <MessageCircle size={14} />},
            ].map(t => (
              <button key={t.id} className={`tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id as any)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'description' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h3 style={{ marginBottom: 10, color: 'var(--text-2)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Problem</h3>
                <p style={{ lineHeight: 1.8, color: 'var(--text-1)' }}>{problem.description}</p>
              </div>
              {problem.inputFormat && (
                <div>
                  <h3 style={{ marginBottom: 8, fontSize: 15, fontWeight: 600 }}>Input Format</h3>
                  <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>{problem.inputFormat}</p>
                </div>
              )}
              {problem.outputFormat && (
                <div>
                  <h3 style={{ marginBottom: 8, fontSize: 15, fontWeight: 600 }}>Output Format</h3>
                  <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>{problem.outputFormat}</p>
                </div>
              )}
              {problem.examples?.map((ex, i) => (
                <div key={i}>
                  <h3 style={{ marginBottom: 10, fontSize: 15, fontWeight: 600 }}>Example {i + 1}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4, fontWeight: 600 }}>INPUT</div>
                      <div className="terminal" style={{ minHeight: 60 }}>{ex.input}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4, fontWeight: 600 }}>OUTPUT</div>
                      <div className="terminal" style={{ minHeight: 60 }}>{ex.output}</div>
                    </div>
                  </div>
                  {ex.explanation && <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 8, fontStyle: 'italic' }}>💡 {ex.explanation}</p>}
                </div>
              ))}
              {problem.constraints && (
                <div>
                  <h3 style={{ marginBottom: 8, fontSize: 15, fontWeight: 600 }}>Constraints</h3>
                  <div className="terminal" style={{ minHeight: 40 }}>{problem.constraints}</div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'submissions' && (
            <div>
              {submissions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
                  <Trophy size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                  <p>No submissions yet. Be the first!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {submissions.map(s => (
                    <div key={s.id} className="glass-card" style={{ padding: '14px 18px' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>{s.userName?.[0]?.toUpperCase() || 'U'}</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{s.userName}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.language?.toUpperCase()} • {s.runtime}ms</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {s.status === 'accepted' ? <CheckCircle2 size={16} color="var(--green)" /> : <XCircle size={16} color="var(--red)" />}
                          <span className={`badge ${s.status === 'accepted' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10 }}>
                            {s.status === 'accepted' ? 'Accepted' : s.status === 'wrong_answer' ? 'Wrong Answer' : 'Error'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'comments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Add comment */}
              {user && (
                <div className="glass-card" style={{ padding: 16 }}>
                  <textarea className="input" style={{ marginBottom: 10 }} placeholder="Share your approach, hint, or feedback... 💬" rows={3} value={newComment} onChange={e => setNewComment(e.target.value)} />
                  <button className="btn btn-primary btn-sm" onClick={postComment} disabled={postingComment || !newComment.trim()}>
                    {postingComment ? <Loader2 size={14} className="animate-spin" /> : null} Post Comment
                  </button>
                </div>
              )}
              {!user && (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-3)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <a href="/login" style={{ color: 'var(--purple-light)' }}>Login</a> to join the discussion!
                </div>
              )}
              {comments.map(c => (
                <div key={c.id} className="comment-card">
                  <div className="flex gap-3">
                    <div className="comment-avatar">{c.userName?.[0]?.toUpperCase() || 'U'}</div>
                    <div style={{ flex: 1 }}>
                      <div className="flex items-center gap-2 justify-between" style={{ marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{c.userName}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{c.createdAt?.toDate?.()?.toLocaleDateString() || 'Just now'}</span>
                      </div>
                      <p style={{ color: 'var(--text-2)', lineHeight: 1.7, fontSize: 14 }}>{c.text}</p>
                      <div className="flex gap-3 items-center" style={{ marginTop: 10 }}>
                        <button onClick={() => toggleCommentLike(c.id, c.likes?.includes(user?.uid || ''))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.likes?.includes(user?.uid || '') ? 'var(--green)' : 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontFamily: 'inherit' }}>
                          <ThumbsUp size={13} /> {c.likes?.length || 0}
                        </button>
                        <button onClick={() => toggleCommentLike(c.id, !c.dislikes?.includes(user?.uid || ''))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.dislikes?.includes(user?.uid || '') ? 'var(--red)' : 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontFamily: 'inherit' }}>
                          <ThumbsDown size={13} /> {c.dislikes?.length || 0}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Code Editor ── */}
        <div className="problem-code-panel">
          {/* Editor Top Bar */}
          <div className="editor-topbar">
            <div className="flex gap-2 items-center">
              {LANG_OPTIONS.map(l => (
                <button key={l.id} onClick={() => setLang(l.id as any)} className={`lang-badge lang-${l.id} ${lang === l.id ? '' : 'btn-ghost'}`} style={{ cursor: 'pointer', border: lang === l.id ? undefined : '1px solid var(--border)', background: lang === l.id ? undefined : 'transparent', color: lang === l.id ? undefined : 'var(--text-3)', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                  {l.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost btn-sm" onClick={handleRun} disabled={running || submitting}>
                {running ? <Loader2 size={14} style={{ animation: 'spin-slow 0.8s linear infinite' }} /> : <Play size={14} />}
                Run
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={running || submitting}>
                {submitting ? <Loader2 size={14} style={{ animation: 'spin-slow 0.8s linear infinite' }} /> : <Send size={14} />}
                Submit
              </button>
            </div>
          </div>

          {/* Monaco Editor */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Editor
              height="100%"
              language={lang === 'c' ? 'c' : lang}
              value={code}
              onChange={v => setCode(v || '')}
              onMount={handleEditorMount}
              theme="vs-dark"
              options={{
                fontSize: 14,
                fontFamily: 'JetBrains Mono, monospace',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 16, bottom: 16 },
                lineNumbers: 'on',
                roundedSelection: true,
                wordWrap: 'on',
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
                parameterHints: { enabled: true },
                autoIndent: 'full',
                formatOnType: true,
                tabSize: 4,
                renderLineHighlight: 'all',
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
              }}
            />
          </div>

          {/* Output Panel */}
          {runResult && (
            <div style={{ padding: 16, borderTop: '1px solid var(--border)', background: 'rgba(5,5,15,0.9)' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                <Terminal size={14} color="var(--purple-light)" />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Output</span>
                {runResult.status === 'accepted'
                  ? <span className="badge badge-green" style={{ fontSize: 10 }}>✓ Accepted</span>
                  : runResult.status === 'wrong_answer'
                  ? <span className="badge badge-red" style={{ fontSize: 10 }}>✗ Wrong Answer</span>
                  : <span className="badge badge-yellow" style={{ fontSize: 10 }}>! Error</span>
                }
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--cyan)' }}><Clock size={12} style={{ verticalAlign: 'middle' }} /> {runResult.runtime}ms</span>
              </div>
              <div className="terminal" style={{ fontSize: 12, maxHeight: 120, overflowY: 'auto' }}>
                <span className={runResult.status === 'accepted' ? 'success' : 'error'}>
                  {runResult.output}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ProblemPage;
