import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc, getDoc, collection, addDoc, getDocs, query, where, orderBy,
  serverTimestamp, updateDoc, increment, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import Editor from '@monaco-editor/react';
import {
  Play, Send, ThumbsUp, ThumbsDown, MessageCircle, Clock,
  Loader2, CheckCircle2, XCircle, Terminal, BookOpen, Trophy, RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import type { Problem } from './ProblemsPage';

// ── Language options ──────────────────────────────────────────────
type LangId = 'java' | 'c' | 'python' | 'javascript';

const LANG_OPTIONS: { id: LangId; label: string; pistonLang: string; pistonVersion: string }[] = [
  { id: 'java',       label: 'Java',       pistonLang: 'java',       pistonVersion: '15.0.2'  },
  { id: 'c',         label: 'C',          pistonLang: 'c',          pistonVersion: '10.2.0'  },
  { id: 'python',    label: 'Python',     pistonLang: 'python',     pistonVersion: '3.10.0'  },
  { id: 'javascript',label: 'JavaScript', pistonLang: 'javascript', pistonVersion: '18.15.0' },
];

// ── Types ─────────────────────────────────────────────────────────
interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: { toDate?: () => Date } | null;
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
  createdAt: { toDate?: () => Date } | null;
}

interface RunResult {
  status: 'accepted' | 'wrong_answer' | 'error';
  output: string;
  runtime: number;
  passed: number;
  total: number;
  testDetails: { input: string; expected: string; got: string; passed: boolean }[];
}

// ── Anti-cheat (paste + devtools block, inside Monaco only) ──────
function useAntiCheat() {
  useEffect(() => {
    const blockPaste = (e: ClipboardEvent) => {
      const target = e.target as Element;
      if (target.closest?.('.monaco-editor') || target.closest?.('[data-mode-id]')) {
        e.stopPropagation();
        e.preventDefault();
        toast.error('🚫 Pasting is disabled! Type your solution.', { id: 'no-paste' });
      }
    };
    const blockCtxMenu = (e: MouseEvent) => {
      if ((e.target as Element).closest?.('.monaco-editor')) e.preventDefault();
    };
    const blockKeys = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) ||
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
        toast.error('🚫 DevTools disabled!', { id: 'no-devtools' });
      }
    };
    document.addEventListener('paste', blockPaste, true);
    document.addEventListener('contextmenu', blockCtxMenu, true);
    document.addEventListener('keydown', blockKeys, true);
    return () => {
      document.removeEventListener('paste', blockPaste, true);
      document.removeEventListener('contextmenu', blockCtxMenu, true);
      document.removeEventListener('keydown', blockKeys, true);
    };
  }, []);
}

// ── Real code execution via Piston API (free, no API key) ────────
const PISTON_URL = 'https://emkc.org/api/v2/piston/execute';

async function runCode(
  code: string,
  langId: LangId,
  testCases: { input: string; expectedOutput: string }[],
): Promise<RunResult> {
  const opt = LANG_OPTIONS.find(l => l.id === langId)!;
  const testDetails: RunResult['testDetails'] = [];
  let passed = 0;
  let totalRuntime = 0;

  for (const tc of testCases) {
    const start = Date.now();
    try {
      const res = await fetch(PISTON_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: opt.pistonLang,
          version: opt.pistonVersion,
          files: [{ name: langId === 'java' ? 'Main.java' : `solution.${langId === 'javascript' ? 'js' : langId}`, content: code }],
          stdin: tc.input,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json() as {
        run: { stdout: string; stderr: string; code: number; signal: string | null };
        compile?: { stdout: string; stderr: string; code: number };
      };

      totalRuntime += Date.now() - start;

      // Check compile errors first
      if (data.compile && data.compile.code !== 0 && data.compile.stderr) {
        return {
          status: 'error',
          output: `Compilation Error:\n${data.compile.stderr}`,
          runtime: Date.now() - start,
          passed: 0,
          total: testCases.length,
          testDetails: [{ input: tc.input, expected: tc.expectedOutput, got: data.compile.stderr, passed: false }],
        };
      }

      if (data.run.signal === 'SIGKILL') {
        testDetails.push({ input: tc.input, expected: tc.expectedOutput, got: 'Time Limit Exceeded', passed: false });
        continue;
      }

      if (data.run.code !== 0 && data.run.stderr) {
        testDetails.push({ input: tc.input, expected: tc.expectedOutput, got: data.run.stderr.trim(), passed: false });
        continue;
      }

      const got = data.run.stdout.trim();
      const expected = tc.expectedOutput.trim();
      const ok = got === expected;
      if (ok) passed++;
      testDetails.push({ input: tc.input, expected, got, passed: ok });
    } catch {
      totalRuntime += Date.now() - start;
      testDetails.push({ input: tc.input, expected: tc.expectedOutput, got: 'Network error executing code', passed: false });
    }
  }

  const total = testCases.length;
  const allPassed = passed === total;
  const runtime = Math.round(totalRuntime / Math.max(testCases.length, 1));

  let output: string;
  if (allPassed) {
    output = `✅ All ${total}/${total} test cases passed!\nAverage runtime: ${runtime}ms`;
  } else {
    const first = testDetails.find(t => !t.passed)!;
    output = `❌ ${passed}/${total} test cases passed.\n\nFailed test case:\nInput:    ${first.input}\nExpected: ${first.expected}\nGot:      ${first.got || '(no output)'}`;
  }

  return {
    status: allPassed ? 'accepted' : (testDetails.some(t => !t.passed && t.got.includes('Error')) ? 'error' : 'wrong_answer'),
    output,
    runtime,
    passed,
    total,
    testDetails,
  };
}

// ── Component ─────────────────────────────────────────────────────
const ProblemPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  useAntiCheat(); // ← called once, no duplicate

  // Per-language code cache: preserve user's code when switching languages
  const codeCache = useRef<Partial<Record<LangId, string>>>({});

  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<LangId>('python');
  const [code, setCode] = useState('');
  const [activeTab, setActiveTab] = useState<'description' | 'submissions' | 'comments'>('description');
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [problemLiked, setProblemLiked] = useState(false);
  const [problemDisliked, setProblemDisliked] = useState(false);

  // Load problem from Firestore
  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, 'problems', id));
        if (!snap.exists()) { navigate('/problems'); return; }
        const p = { id: snap.id, ...snap.data() } as Problem;
        setProblem(p);
        // Seed codeCache with starter code for all languages
        LANG_OPTIONS.forEach(l => {
          if (!codeCache.current[l.id]) {
            codeCache.current[l.id] = p.starterCode?.[l.id] || `// Write your ${l.label} solution here\n`;
          }
        });
        setCode(codeCache.current['python'] || p.starterCode?.['python'] || '# Write your solution here\n');
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Language switch: save current code to cache, restore cached code for new lang
  const switchLang = useCallback((newLang: LangId) => {
    // Save the current editor content before switching
    codeCache.current[lang] = code;
    // Restore cached code for the new language (or starter code)
    const cached = codeCache.current[newLang];
    const starter = problem?.starterCode?.[newLang] || `// Write your ${newLang} solution here\n`;
    setCode(cached || starter);
    setLang(newLang);
    setRunResult(null); // clear previous result on lang change
  }, [lang, code, problem]);

  // Reset to starter code for current language
  const resetCode = useCallback(() => {
    const starter = problem?.starterCode?.[lang] || `// Write your ${lang} solution here\n`;
    codeCache.current[lang] = starter;
    setCode(starter);
    toast.success('Code reset to starter template');
  }, [problem, lang]);

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
  }, [activeTab, loadComments, loadSubmissions]);

  const handleRun = async () => {
    if (!problem) return;
    setRunning(true);
    setRunResult(null);
    const toastId = toast.loading('⚙️ Running your code...');
    try {
      // Run against visible examples as test cases
      const visibleCases = (problem.examples || []).map(ex => ({
        input: ex.input,
        expectedOutput: ex.output,
      }));
      const cases = visibleCases.length > 0 ? visibleCases : (problem.testCases?.slice(0, 3) || []);
      const result = await runCode(code, lang, cases);
      setRunResult(result);
      toast.dismiss(toastId);
      if (result.status === 'accepted') toast.success('✅ All visible tests passed!');
      else if (result.status === 'wrong_answer') toast.error('❌ Wrong answer on some tests');
      else toast.error('💥 Runtime/Compile error');
    } catch {
      toast.dismiss(toastId);
      toast.error('Failed to run code. Check your connection.');
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !profile || !problem) { toast.error('Login to submit!'); navigate('/login'); return; }
    setSubmitting(true);
    setRunResult(null);
    const toastId = toast.loading('🚀 Submitting against all test cases...');
    try {
      const result = await runCode(code, lang, problem.testCases || []);
      setRunResult(result);
      toast.dismiss(toastId);

      await addDoc(collection(db, 'submissions'), {
        userId: user.uid,
        userName: profile.displayName,
        problemId: id,
        problemTitle: problem.title,
        language: lang,
        code,
        status: result.status,
        runtime: result.runtime,
        score: result.status === 'accepted' ? Math.max(100 - result.runtime / 10, 10) : 0,
        createdAt: serverTimestamp(),
      });

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
        toast.error('Runtime/Compile Error. Debug your code!');
      }
      loadSubmissions();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error('Submission failed!');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
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

  const toggleCommentLike = async (commentId: string, hasLiked: boolean) => {
    if (!user) { toast.error('Login to like!'); return; }
    const ref = doc(db, 'problems', id!, 'comments', commentId);
    await updateDoc(ref, hasLiked
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
    const snap = await getDoc(doc(db, 'problems', id!));
    if (snap.exists()) setProblem({ id: snap.id, ...snap.data() } as Problem);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    // Block paste inside Monaco at the editor API level too
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
        {/* ── Left: Description / Comments / Submissions ── */}
        <div className="problem-desc-panel">
          {/* Problem Header */}
          <div style={{ marginBottom: 24 }}>
            <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: 12 }}>
              <span className={`badge ${diffClass}`}>{problem.difficulty}</span>
              <span className="badge badge-purple">{problem.category}</span>
              {problem.tags?.map(t => <span key={t} className="tag">{t}</span>)}
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>{problem.title}</h1>
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
            {[
              { id: 'description', label: 'Description', icon: <BookOpen size={14} /> },
              { id: 'submissions', label: 'Submissions', icon: <Trophy size={14} /> },
              { id: 'comments',    label: 'Comments',    icon: <MessageCircle size={14} /> },
            ].map(t => (
              <button key={t.id} className={`tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id as typeof activeTab)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Description tab */}
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

          {/* Submissions tab */}
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

          {/* Comments tab */}
          {activeTab === 'comments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {user ? (
                <div className="glass-card" style={{ padding: 16 }}>
                  <textarea className="input" style={{ marginBottom: 10 }} placeholder="Share your approach, hint, or feedback... 💬" rows={3} value={newComment} onChange={e => setNewComment(e.target.value)} />
                  <button className="btn btn-primary btn-sm" onClick={postComment} disabled={postingComment || !newComment.trim()}>
                    {postingComment ? <Loader2 size={14} className="animate-spin" /> : null} Post Comment
                  </button>
                </div>
              ) : (
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
                        <button onClick={() => toggleCommentLike(c.id, c.likes?.includes(user?.uid ?? ''))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.likes?.includes(user?.uid ?? '') ? 'var(--green)' : 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontFamily: 'inherit' }}>
                          <ThumbsUp size={13} /> {c.likes?.length || 0}
                        </button>
                        <button onClick={() => toggleCommentLike(c.id, c.dislikes?.includes(user?.uid ?? ''))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.dislikes?.includes(user?.uid ?? '') ? 'var(--red)' : 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontFamily: 'inherit' }}>
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
            {/* Language switcher */}
            <div className="flex gap-2 items-center">
              {LANG_OPTIONS.map(l => (
                <button
                  key={l.id}
                  onClick={() => switchLang(l.id)}
                  className={`lang-badge lang-${l.id}`}
                  style={{
                    cursor: 'pointer',
                    border: lang === l.id ? undefined : '1px solid var(--border)',
                    background: lang === l.id ? undefined : 'transparent',
                    color: lang === l.id ? undefined : 'var(--text-3)',
                    borderRadius: 6, padding: '4px 10px', fontSize: 12,
                    fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                    transition: 'all 0.15s',
                  }}
                >
                  {l.label}
                </button>
              ))}
            </div>
            {/* Actions */}
            <div className="flex gap-2 items-center">
              <button title="Reset to starter code" className="btn btn-ghost btn-sm" onClick={resetCode} style={{ padding: '4px 8px' }}>
                <RotateCcw size={13} />
              </button>
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
              language={lang}
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
                // Performance: disable expensive features
                codeLens: false,
                folding: true,
                renderWhitespace: 'none',
              }}
            />
          </div>

          {/* Output Panel */}
          {runResult && (
            <div style={{ padding: 16, borderTop: '1px solid var(--border)', background: 'rgba(5,5,15,0.9)', maxHeight: 280, overflowY: 'auto' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                <Terminal size={14} color="var(--purple-light)" />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Output</span>
                {runResult.status === 'accepted'
                  ? <span className="badge badge-green" style={{ fontSize: 10 }}>✓ Accepted</span>
                  : runResult.status === 'wrong_answer'
                  ? <span className="badge badge-red" style={{ fontSize: 10 }}>✗ Wrong Answer</span>
                  : <span className="badge badge-yellow" style={{ fontSize: 10 }}>! Error</span>
                }
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--cyan)' }}>
                  <Clock size={12} style={{ verticalAlign: 'middle' }} /> {runResult.runtime}ms
                </span>
              </div>
              {/* Summary line */}
              <div className="terminal" style={{ fontSize: 12, marginBottom: 8 }}>
                <span className={runResult.status === 'accepted' ? 'success' : 'error'}>
                  {runResult.output}
                </span>
              </div>
              {/* Per-test-case breakdown */}
              {runResult.testDetails.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {runResult.testDetails.map((t, i) => (
                    <div key={i} style={{
                      border: `1px solid ${t.passed ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                      borderRadius: 6, padding: '8px 12px', fontSize: 12,
                      background: t.passed ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
                    }}>
                      <div className="flex items-center gap-2" style={{ marginBottom: t.passed ? 0 : 4 }}>
                        {t.passed ? <CheckCircle2 size={12} color="var(--green)" /> : <XCircle size={12} color="var(--red)" />}
                        <span style={{ fontWeight: 600, color: t.passed ? 'var(--green)' : 'var(--red)' }}>
                          Test {i + 1}: {t.passed ? 'Passed' : 'Failed'}
                        </span>
                      </div>
                      {!t.passed && (
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-2)', marginTop: 4 }}>
                          <div>Input: <span style={{ color: 'var(--text-1)' }}>{t.input}</span></div>
                          <div>Expected: <span style={{ color: 'var(--green)' }}>{t.expected}</span></div>
                          <div>Got: <span style={{ color: 'var(--red)' }}>{t.got || '(no output)'}</span></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ProblemPage;
