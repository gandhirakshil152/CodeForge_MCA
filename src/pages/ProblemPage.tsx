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
  Loader2, CheckCircle2, XCircle, Terminal, BookOpen, Trophy, RotateCcw, ShieldAlert,
  Code2, Eye, Copy, Check, Sparkles, Maximize2, Minimize2, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import type { Problem } from './ProblemsPage';
import { validateCodeRestrictions } from '../utils/codeValidator';
import { registerBasicSuggestions, LANGUAGE_QUICK_METHODS } from '../utils/editorSuggestions';

// ── Language options ──────────────────────────────────────────────
type LangId = 'java' | 'c' | 'python' | 'javascript';

const LANG_OPTIONS: { id: LangId; label: string }[] = [
  { id: 'java',        label: 'Java'       },
  { id: 'c',           label: 'C'          },
  { id: 'python',      label: 'Python'     },
  { id: 'javascript',  label: 'JavaScript' },
];

// Judge0 CE language IDs (https://ce.judge0.com)
const JUDGE0_LANG_ID: Record<LangId, number> = {
  c:          50,   // C  (GCC 9.2.0)
  java:       62,   // Java (OpenJDK 13.0.1)
  python:     71,   // Python (3.8.1)
  javascript: 63,   // JavaScript (Node.js 12.14.0)
};

// Language input guide — shown to users so they know how to read stdin
const LANG_GUIDE: Record<LangId, { title: string; snippet: string; tip: string }> = {
  python: {
    title: 'Python — stdin reading',
    snippet: `import sys
input = sys.stdin.readline

n = int(input())           # single integer
arr = list(map(int, input().split()))  # array on one line
s = input().strip()        # string`,
    tip: 'Arrays are space-separated on a single line. Each input() call reads the next line.',
  },
  java: {
    title: 'Java — Scanner (java.io & java.nio Disabled)',
    snippet: `import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();             // single integer
        int[] arr = new int[n];
        for (int i = 0; i < n; i++)
            arr[i] = sc.nextInt();        // space/newline separated
        String s = sc.next();             // word
    }
}`,
    tip: '⚠️ MCA Policy: java.io and java.nio imports and operations are disabled. Use java.util.Scanner and System.out.',
  },
  c: {
    title: 'C — scanf / printf (Pointers Disabled)',
    snippet: `#include <stdio.h>
int main() {
    int n;
    scanf("%d", &n);           // single integer
    int arr[n];
    for (int i = 0; i < n; i++)
        scanf("%d", &arr[i]); // space-separated array
    return 0;
}`,
    tip: '⚠️ MCA Policy: Pointer types (*ptr), arrow operator (->), and malloc/free are disabled. Use static arrays and value types.',
  },
  javascript: {
    title: 'JavaScript — stdin via readline',
    snippet: `const lines = require('fs').readFileSync('/dev/stdin','utf8').split('\\n');
let idx = 0;
const readline = () => lines[idx++]?.trim() ?? '';

const n = parseInt(readline());                     // single integer
const arr = readline().split(' ').map(Number);      // array
const s = readline();                               // string`,
    tip: 'Each readline() call returns the next line. Split spaces for arrays.',
  },
};

// Judge0 CE compiles Java as "Main.java" and runs "java Main".
// Whatever class name the user types, we must rename it to Main.
const JAVA_CLASS_REGEX = /public\s+class\s+\w+/g;
function normaliseJavaClassName(code: string): string {
  return code.replace(JAVA_CLASS_REGEX, 'public class Main');
}

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
  code?: string;
  score?: number;
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

// ── Real code execution via Judge0 CE (free public instance) ─────
// Uses ce.judge0.com with api.judge0.com as inline fallback.
const JUDGE0_URL = 'https://ce.judge0.com';

/** Normalise output for comparison: trim, collapse \r\n → \n, strip trailing blanks per line */
function normaliseOutput(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trimEnd())
    .join('\n')
    .trim();
}

interface Judge0Response {
  token?: string;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  status: { id: number; description: string };
  time: string | null;
  memory: number | null;
}

async function submitToJudge0(
  sourceCode: string,
  langId: LangId,
  stdin: string,
): Promise<Judge0Response> {
  const policyCheck = validateCodeRestrictions(sourceCode, langId);
  if (!policyCheck.valid) {
    throw new Error(policyCheck.error || 'Code policy violation');
  }

  // Judge0 CE compiles Java as Main.java — class MUST be named Main
  const src = langId === 'java' ? normaliseJavaClassName(sourceCode) : sourceCode;

  // Normalise stdin: ensure it ends with a newline so programs can read last line
  const normalStdin = stdin.endsWith('\n') ? stdin : stdin + '\n';

  const body = JSON.stringify({
    source_code: src,
    language_id: JUDGE0_LANG_ID[langId],
    stdin: normalStdin,
    cpu_time_limit: 5,
    wall_time_limit: 10,
    memory_limit: 128_000,
  });

  // Try primary then fallback CE instances
  const endpoints = [JUDGE0_URL, 'https://api.judge0.com'];
  let lastError: Error = new Error('No endpoint available');

  for (const base of endpoints) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(
        `${base}/submissions?base64_encoded=false&wait=true`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body,
        },
      );
      clearTimeout(tid);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        lastError = new Error(`Judge0 HTTP ${res.status}${text ? ': ' + text.slice(0, 120) : ''}`);
        continue; // try next endpoint
      }
      return res.json() as Promise<Judge0Response>;
    } catch (e) {
      clearTimeout(tid);
      lastError = e instanceof Error ? e : new Error(String(e));
      // try next endpoint
    }
  }
  throw lastError;
}

async function runCode(
  code: string,
  langId: LangId,
  testCases: { input: string; expectedOutput: string }[],
): Promise<RunResult> {
  const policyCheck = validateCodeRestrictions(code, langId);
  if (!policyCheck.valid) {
    const errMsg = policyCheck.error || 'Evaluation Policy Violation';
    const cases = testCases && testCases.length > 0 ? testCases : [{ input: '', expectedOutput: '' }];
    return {
      status: 'error',
      output: `⚠️ CodeForge MCA Policy Violation:\n\n${errMsg}`,
      runtime: 0,
      passed: 0,
      total: cases.length,
      testDetails: cases.map(tc => ({
        input: tc.input || '',
        expected: tc.expectedOutput || '',
        got: errMsg,
        passed: false,
      })),
    };
  }

  const testDetails: RunResult['testDetails'] = [];
  let passed = 0;
  let totalRuntime = 0;

  for (const tc of testCases) {
    const start = Date.now();
    try {
      const result = await submitToJudge0(code, langId, tc.input);
      totalRuntime += Date.now() - start;

      const statusId = result.status.id;

      // Compile Error (statusId = 6)
      if (statusId === 6) {
        const errMsg = result.compile_output?.trim() || result.stderr?.trim() || 'Compilation Error';
        return {
          status: 'error',
          output: `Compilation Error:\n${errMsg}`,
          runtime: 0,
          passed: 0,
          total: testCases.length,
          testDetails: [{ input: tc.input, expected: tc.expectedOutput, got: errMsg, passed: false }],
        };
      }

      // Runtime errors (statusId 7=TLE, 8=MLE, 9=OLE, 10=RE, 11=Internal, 12=Exec Format)
      if (statusId !== 3) {
        const errMsg = result.stderr?.trim() || result.status.description;
        testDetails.push({ input: tc.input, expected: normaliseOutput(tc.expectedOutput), got: errMsg, passed: false });
        continue;
      }

      // Accepted run (statusId = 3) — compare stdout
      const got = normaliseOutput(result.stdout || '');
      const expected = normaliseOutput(tc.expectedOutput);
      const ok = got === expected;
      if (ok) passed++;
      testDetails.push({ input: tc.input, expected, got: got || '(no output)', passed: ok });

    } catch (err) {
      totalRuntime += Date.now() - start;
      const msg = err instanceof Error ? err.message : 'Unknown error';
      testDetails.push({ input: tc.input, expected: tc.expectedOutput, got: `⚠️ ${msg}`, passed: false });
    }
  }

  const total = testCases.length;
  const allPassed = passed === total;
  const runtime = Math.round(totalRuntime / Math.max(total, 1));

  const firstFail = testDetails.find(t => !t.passed);
  const output = allPassed
    ? `✅ All ${total}/${total} test cases passed!  Runtime: ~${runtime}ms`
    : `❌ ${passed}/${total} test cases passed.\n\nFailed on:\nInput:    ${firstFail?.input}\nExpected: ${firstFail?.expected}\nGot:      ${firstFail?.got || '(no output)'}`;

  const hasError = testDetails.some(t => !t.passed && (t.got.startsWith('⚠️') || t.got.includes('Error')));
  return {
    status: allPassed ? 'accepted' : (hasError ? 'error' : 'wrong_answer'),
    output,
    runtime,
    passed,
    total,
    testDetails,
  };
}

// ── Language Guide collapsible panel ─────────────────────────────
const LangGuide: React.FC<{ lang: LangId }> = ({ lang }) => {
  const [open, setOpen] = React.useState(false);
  const g = LANG_GUIDE[lang];
  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      background: open ? 'rgba(139,92,246,0.06)' : 'rgba(5,5,15,0.6)',
      transition: 'background 0.2s',
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--purple-light)', fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
          textAlign: 'left',
        }}
        title="How to read input / arrays in this language"
      >
        <BookOpen size={13} />
        📖 How to read input in {g.title} {open ? '▲' : '▼'}
        <span style={{ marginLeft: 'auto', color: 'var(--text-3)', fontWeight: 400, fontSize: 11 }}>
          {open ? 'Hide guide' : 'Show input guide (arrays, strings, etc.)'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 14px', animation: 'fadeIn 0.15s ease' }}>
          <p style={{ fontSize: 11, color: 'var(--cyan)', marginBottom: 8, fontWeight: 600 }}>
            💡 {g.tip}
          </p>
          <pre style={{
            margin: 0, fontSize: 11, lineHeight: 1.7,
            background: 'rgba(0,0,0,0.4)', borderRadius: 6,
            padding: '10px 14px', overflowX: 'auto', color: 'var(--text-1)',
            fontFamily: 'JetBrains Mono, monospace',
            border: '1px solid rgba(139,92,246,0.2)',
          }}>
            {g.snippet}
          </pre>
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
            ⚡ <strong>Test case format:</strong> Inputs are fed via stdin exactly as shown in examples.
            Arrays are usually space-separated on one line. Each line = one {'"'}input(){'"'} call.
          </p>
        </div>
      )}
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────
const ProblemPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile, isSuperAdmin } = useAuth();
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
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
  const [submissionFilter, setSubmissionFilter] = useState<'all' | 'mine'>('all');
  const [copiedSubId, setCopiedSubId] = useState<string | null>(null);
  const [justSubmittedReceipt, setJustSubmittedReceipt] = useState<{
    id: string;
    status: string;
    runtime: number;
    score: number;
    code: string;
    language: string;
  } | null>(null);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [problemLiked, setProblemLiked] = useState(false);
  const [problemDisliked, setProblemDisliked] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isEditorExpanded, setIsEditorExpanded] = useState(false);
  const [isOutputMinimized, setIsOutputMinimized] = useState(false);

  const insertMethodSnippet = (snippet: string) => {
    const cleanSnippet = snippet.replace(/\$\{\d+:?([^}]*)\}/g, '$1');
    if (editorRef.current) {
      const editor = editorRef.current;
      const selection = editor.getSelection();
      if (selection) {
        editor.executeEdits('student-suggestion', [{
          range: selection,
          text: cleanSnippet,
          forceMoveMarkers: true,
        }]);
      } else {
        const position = editor.getPosition() || { lineNumber: 1, column: 1 };
        editor.executeEdits('student-suggestion', [{
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          },
          text: cleanSnippet,
          forceMoveMarkers: true,
        }]);
      }
      editor.focus();
      toast.success('Inserted syntax snippet!', { duration: 1500 });
    } else {
      setCode(c => c + '\n' + cleanSnippet);
      toast.success('Inserted snippet!', { duration: 1500 });
    }
  };

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
    try {
      const q = query(collection(db, 'submissions'), where('problemId', '==', id));
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission));
      docs.sort((a, b) => {
        const tA = (a.createdAt as any)?.toMillis?.() || (a.createdAt as any)?.seconds * 1000 || 0;
        const tB = (b.createdAt as any)?.toMillis?.() || (b.createdAt as any)?.seconds * 1000 || 0;
        return tB - tA;
      });
      setSubmissions(docs);
    } catch (e) {
      console.warn('Submissions load note:', e);
    }
  }, [id]);

  useEffect(() => {
    loadSubmissions();
  }, [id, loadSubmissions]);

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

      const policyCheck = validateCodeRestrictions(code, lang);
      if (!policyCheck.valid) {
        toast.dismiss(toastId);
        toast.error(policyCheck.error || 'Evaluation Policy Violation', { duration: 5000 });
        const result = await runCode(code, lang, cases);
        setRunResult(result);
        return;
      }

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
      const policyCheck = validateCodeRestrictions(code, lang);
      if (!policyCheck.valid) {
        toast.dismiss(toastId);
        toast.error(policyCheck.error || 'Evaluation Policy Violation', { duration: 5000 });
        const result = await runCode(code, lang, problem.testCases || []);
        setRunResult(result);
        return;
      }

      const result = await runCode(code, lang, problem.testCases || []);
      setRunResult(result);
      toast.dismiss(toastId);

      // ── Runtime-efficiency tiered scoring ─────────────────────
      const baseScore = result.status === 'accepted'
        ? result.runtime < 100  ? 150
        : result.runtime < 300  ? 125
        : result.runtime < 500  ? 100
        : result.runtime < 1000 ? 75
        :                         50
        : 0;

      // ── Anti-Plagiarism Check ──────────────────────────────
      // SuperAdmin is exempt. Check if this exact code was already submitted by a DIFFERENT user.
      let penaltyApplied = 0;
      let penaltyReason = '';
      if (!isSuperAdmin) {
        try {
          const duplicateCheck = await getDocs(query(
            collection(db, 'submissions'),
            where('problemId', '==', id),
            where('code', '==', code),
          ));
          // Look for submissions by other users
          const byOtherUser = duplicateCheck.docs.find(d => d.data().userId !== user.uid);
          if (byOtherUser) {
            // Plagiarism detected! Deduct points — can make score negative!
            // Penalty is -2x baseScore (or -100 minimum) so final score is strictly negative
            const deduction = Math.max(baseScore * 2, 100);
            penaltyApplied = -deduction;
            penaltyReason = `Code matches submission by ${byOtherUser.data().userName || 'another student'}. Academic integrity violation.`;
            toast.error(`🚨 Plagiarism Detected! Code copied from another student. ${penaltyApplied} pts penalty applied!`, { duration: 7000 });
          }
        } catch (e) {
          console.warn('Plagiarism check error:', e);
        }
      }

      const finalScore = baseScore + penaltyApplied;

      const todayDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD for dashboard daily queries
      const docRef = await addDoc(collection(db, 'submissions'), {
        userId: user.uid,
        userName: profile.displayName,
        userEmail: user.email,
        problemId: id,
        problemTitle: problem.title,
        language: lang,
        code,
        status: result.status,
        runtime: result.runtime,
        score: finalScore,
        penalty: penaltyApplied,
        penaltyReason: penaltyReason || null,
        todayDate,  // ← required for Dashboard daily task progress tracking
        createdAt: serverTimestamp(),
      });

      setJustSubmittedReceipt({
        id: docRef.id,
        status: result.status,
        runtime: result.runtime,
        score: finalScore,
        code,
        language: lang,
      });

      // Reload submissions immediately so student sees their entry in history
      loadSubmissions();

      if (result.status === 'accepted') {
        // Check if already solved
        const prevAccepted = await getDocs(query(
          collection(db, 'submissions'),
          where('userId', '==', user.uid),
          where('problemId', '==', id),
          where('status', '==', 'accepted'),
        ));
        const isFirstSolve = prevAccepted.size <= 1;

        // ── Streak calculation ─────────────────────────────────
        let streakBonus = 0;
        let newStreak = 1;
        if (isFirstSolve) {
          const userSnap = await getDocs(query(collection(db, 'users'), where('__name__', '==', user.uid)));
          const userData = userSnap.docs[0]?.data() as any;
          const lastDate: string | undefined = userData?.lastSolveDate;
          const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
          const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
          const prevStreak = userData?.currentStreak ?? 0;

          if (lastDate === today) {
            // already solved today — keep streak
            newStreak = prevStreak;
          } else if (lastDate === yesterday) {
            // consecutive day — extend streak
            newStreak = prevStreak + 1;
          } else {
            // streak broken
            newStreak = 1;
          }
          streakBonus = Math.min(newStreak * 5, 100); // 5 pts/day streak, cap 100
        }

        const totalScore = finalScore + streakBonus; // finalScore already has penalty applied

        if (isFirstSolve) {
          await updateDoc(doc(db, 'problems', id!), { solvedCount: increment(1) });
          await updateDoc(doc(db, 'users', user.uid), {
            problemsSolved: increment(1),
            score: increment(totalScore), // can be negative if plagiarism detected
            totalSubmissions: increment(1),
            currentStreak: newStreak,
            longestStreak: increment(0), // will update below
            lastSolveDate: new Date().toISOString().slice(0, 10),
          });
          // Update longestStreak separately
          const uSnap = await getDocs(query(collection(db, 'users'), where('__name__', '==', user.uid)));
          const longest = uSnap.docs[0]?.data()?.longestStreak ?? 0;
          if (newStreak > longest) {
            await updateDoc(doc(db, 'users', user.uid), { longestStreak: newStreak });
          }

          // ── Notification: problem solved ───────────────────────
          await addDoc(collection(db, 'notifications'), {
            userId: user.uid,
            type: 'solve',
            title: '✅ Problem Solved!',
            message: `You solved "${problem.title}" (+${totalScore} pts${streakBonus > 0 ? `, 🔥 ${newStreak}-day streak bonus +${streakBonus}` : ''})`,
            read: false,
            createdAt: serverTimestamp(),
          });

          if (penaltyApplied < 0) {
            toast.error(`🚨 Plagiarism penalty! Final score: ${finalScore} pts (${penaltyApplied} pts deducted)`, { duration: 6000 });
          } else if (streakBonus > 0) {
            toast.success(`🎉 Accepted! +${totalScore} pts (🔥 ${newStreak}-day streak +${streakBonus} bonus!)`);
          } else {
            toast.success(`🎉 Accepted! +${finalScore} pts (${result.runtime < 100 ? '⚡ Blazing Fast!' : result.runtime < 500 ? '🚀 Fast!' : '✅ Solved!'})`);
          }
        } else {
          await updateDoc(doc(db, 'users', user.uid), {
            totalSubmissions: increment(1),
            ...(penaltyApplied < 0 ? { score: increment(penaltyApplied) } : {}),
          });
          if (penaltyApplied < 0) {
            toast.error(`🚨 Plagiarism penalty! ${penaltyApplied} pts deducted from your total score.`);
          } else {
            toast.success('✅ Accepted again! (already counted for score)');
          }
        }
      } else if (result.status === 'wrong_answer') {
        await updateDoc(doc(db, 'users', user.uid), {
          totalSubmissions: increment(1),
          ...(penaltyApplied < 0 ? { score: increment(penaltyApplied) } : {}),
        });
        if (penaltyApplied < 0) {
          toast.error(`🚨 Plagiarism penalty! ${penaltyApplied} pts deducted. Wrong Answer.`);
        } else {
          toast.error('Wrong Answer. Keep grinding! 💪');
        }
      } else {
        if (penaltyApplied < 0) {
          await updateDoc(doc(db, 'users', user.uid), {
            totalSubmissions: increment(1),
            score: increment(penaltyApplied),
          });
          toast.error(`🚨 Plagiarism penalty! ${penaltyApplied} pts deducted.`);
        }
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
    try {
      registerBasicSuggestions(monaco);
    } catch (e) {
      console.warn('Monaco suggestion error:', e);
    }
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
      <div className={`problem-layout ${isEditorExpanded ? 'editor-expanded' : ''}`} style={{ marginTop: 64 }}>
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
          {activeTab === 'submissions' && (() => {
            const displayedSubs = submissions.filter(s => {
              if (submissionFilter === 'mine') return s.userId === user?.uid;
              return true;
            });
            const myCount = submissions.filter(s => s.userId === user?.uid).length;

            return (
              <div>
                {/* Filter Controls */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    className={`btn btn-sm ${submissionFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ fontSize: 11, padding: '4px 10px' }}
                    onClick={() => setSubmissionFilter('all')}>
                    All Submissions ({submissions.length})
                  </button>
                  <button
                    className={`btn btn-sm ${submissionFilter === 'mine' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ fontSize: 11, padding: '4px 10px' }}
                    onClick={() => setSubmissionFilter('mine')}>
                    My Submissions ({myCount})
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 8px', color: 'var(--text-3)' }}
                    onClick={loadSubmissions}
                    title="Refresh Submissions">
                    <RotateCcw size={12} /> Refresh
                  </button>
                </div>

                {displayedSubs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-3)', background: 'rgba(0,0,0,0.2)', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.08)' }}>
                    <Trophy size={36} style={{ marginBottom: 10, opacity: 0.3 }} />
                    <p style={{ fontSize: 13, marginBottom: 6 }}>
                      {submissionFilter === 'mine' ? "You haven't submitted this problem yet." : "No submissions recorded yet. Be the first!"}
                    </p>
                    {submissionFilter === 'mine' && (
                      <span style={{ fontSize: 11, color: 'var(--purple-light)' }}>
                        Write your code and click Submit to test and store your submission!
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {displayedSubs.map(s => {
                      const isMine = s.userId === user?.uid;
                      const isExpanded = expandedSubId === s.id;
                      const isCopied = copiedSubId === s.id;
                      const dateStr = s.createdAt?.toDate?.()
                        ? s.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
                        : 'Recently';

                      return (
                        <div key={s.id} className="glass-card" style={{ padding: '12px 16px', border: isMine ? '1px solid rgba(139,92,246,0.35)' : '1px solid var(--border)' }}>
                          <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 8 }}>
                            <div className="flex items-center gap-3">
                              <div className="avatar" style={{ width: 30, height: 30, fontSize: 12, background: isMine ? 'linear-gradient(135deg,var(--purple),var(--cyan))' : undefined }}>
                                {s.userName?.[0]?.toUpperCase() || 'U'}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span>{s.userName}</span>
                                  {isMine && <span className="badge badge-purple" style={{ fontSize: 9, padding: '1px 5px' }}>You</span>}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                                  <span style={{ fontFamily: 'JetBrains Mono, monospace', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 3, color: 'var(--text-2)' }}>
                                    {s.language?.toUpperCase()}
                                  </span>
                                  <span>•</span>
                                  <span>{s.runtime}ms</span>
                                  {typeof s.score === 'number' && s.score > 0 && (
                                    <>
                                      <span>•</span>
                                      <span style={{ color: 'var(--yellow)', fontWeight: 700 }}>+{s.score} pts</span>
                                    </>
                                  )}
                                  <span>•</span>
                                  <span>{dateStr}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {s.status === 'accepted' ? <CheckCircle2 size={15} color="var(--green)" /> : <XCircle size={15} color="var(--red)" />}
                              <span className={`badge ${s.status === 'accepted' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10 }}>
                                {s.status === 'accepted' ? 'Accepted' : s.status === 'wrong_answer' ? 'Wrong Answer' : 'Error'}
                              </span>
                              {s.code && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedSubId(isExpanded ? null : s.id)}
                                  className="btn btn-ghost btn-sm"
                                  style={{
                                    fontSize: 11,
                                    padding: '3px 8px',
                                    gap: 4,
                                    color: isExpanded ? 'var(--cyan)' : 'var(--text-2)',
                                    border: isExpanded ? '1px solid rgba(34,211,238,0.3)' : '1px solid var(--border)',
                                    background: isExpanded ? 'rgba(34,211,238,0.08)' : 'transparent',
                                  }}>
                                  <Code2 size={12} />
                                  {isExpanded ? 'Hide Code' : 'View Code'}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Expandable Submitted Code Inspector */}
                          {isExpanded && s.code && (
                            <div style={{
                              marginTop: 10,
                              background: 'rgba(5, 5, 12, 0.95)',
                              border: '1px solid rgba(34,211,238,0.25)',
                              borderRadius: 6,
                              overflow: 'hidden',
                            }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 12px',
                                background: 'rgba(34,211,238,0.06)',
                                borderBottom: '1px solid rgba(34,211,238,0.15)',
                                fontSize: 11,
                                fontFamily: 'JetBrains Mono, monospace',
                              }}>
                                <span style={{ color: 'var(--cyan)' }}>
                                  Submitted {s.language.toUpperCase()} Solution ({s.code.split('\n').length} lines)
                                </span>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(s.code || '');
                                      setCopiedSubId(s.id);
                                      toast.success('Code copied to clipboard!');
                                      setTimeout(() => setCopiedSubId(null), 2000);
                                    }}
                                    className="btn btn-ghost btn-sm"
                                    style={{ fontSize: 10, padding: '2px 7px', gap: 3 }}>
                                    {isCopied ? <Check size={11} color="var(--green)" /> : <Copy size={11} />}
                                    {isCopied ? 'Copied' : 'Copy'}
                                  </button>
                                  {isSuperAdmin ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const sLang = (s.language || 'python').toLowerCase() as LangId;
                                          if (LANG_OPTIONS.some(l => l.id === sLang)) {
                                            switchLang(sLang);
                                          }
                                          setCode(s.code || '');
                                          toast.success(`👑 [SuperAdmin] Loaded ${s.language.toUpperCase()} submission into editor!`);
                                        }}
                                        className="btn btn-ghost btn-sm"
                                        style={{ fontSize: 10, padding: '2px 7px', gap: 3, color: 'var(--yellow)', border: '1px solid rgba(245,158,11,0.3)' }}
                                        title="SuperAdmin: Load into live editor">
                                        <RotateCcw size={11} />
                                        Load into Editor
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const sLang = (s.language || 'python').toLowerCase() as LangId;
                                          if (LANG_OPTIONS.some(l => l.id === sLang)) {
                                            switchLang(sLang);
                                          }
                                          setCode(s.code || '');
                                          toast.success(`👑 [SuperAdmin] Executing solution in editor...`);
                                          setTimeout(() => handleRun(), 200);
                                        }}
                                        className="btn btn-ghost btn-sm"
                                        style={{ fontSize: 10, padding: '2px 7px', gap: 3, color: 'var(--green)', border: '1px solid rgba(16,185,129,0.3)' }}
                                        title="SuperAdmin: Load and execute in editor">
                                        <Play size={11} />
                                        Run in Editor
                                      </button>
                                    </>
                                  ) : (
                                    <span style={{ fontSize: 10, color: 'var(--text-3)', padding: '2px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                      🔒 Read-Only
                                    </span>
                                  )}
                                </div>
                              </div>
                              <pre style={{
                                margin: 0,
                                padding: '10px 12px',
                                fontFamily: 'JetBrains Mono, monospace',
                                fontSize: 12,
                                lineHeight: 1.5,
                                color: 'var(--text-1)',
                                overflowX: 'auto',
                                maxHeight: 260,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                              }}>
                                {s.code}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

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
            <div className="flex gap-2 items-center flex-wrap">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowSuggestions(v => !v)}
                style={{
                  color: showSuggestions ? 'var(--cyan)' : 'var(--text-3)',
                  borderColor: showSuggestions ? 'rgba(34,211,238,0.4)' : undefined,
                  background: showSuggestions ? 'rgba(34,211,238,0.08)' : 'transparent',
                  gap: 4, padding: '4px 8px', fontSize: 11
                }}
                title="Toggle basic student syntax & common methods helper">
                <Sparkles size={13} /> {showSuggestions ? 'Hide Syntax' : 'Syntax Hints'}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setIsEditorExpanded(v => !v)}
                style={{
                  color: isEditorExpanded ? 'var(--blue-light)' : 'var(--text-3)',
                  borderColor: isEditorExpanded ? 'rgba(59,130,246,0.4)' : undefined,
                  background: isEditorExpanded ? 'rgba(59,130,246,0.08)' : 'transparent',
                  gap: 4, padding: '4px 8px', fontSize: 11
                }}
                title={isEditorExpanded ? 'Restore Normal Width' : 'Expand Editor to 75% Screen Width'}>
                {isEditorExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                {isEditorExpanded ? 'Contract' : 'Expand'}
              </button>
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

          {/* ── Student Basic Syntax & Method Suggestions Drawer ── */}
          {showSuggestions && (
            <div style={{
              background: 'rgba(7, 12, 26, 0.98)',
              borderBottom: '1px solid rgba(56,189,248,0.3)',
              padding: '10px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              fontSize: 12,
              animation: 'fadeIn 0.15s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--cyan)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={13} /> Basic {lang.toUpperCase()} Methods &amp; Syntax:
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  Click to insert at cursor
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 110, overflowY: 'auto' }}>
                {(LANGUAGE_QUICK_METHODS[lang] || []).map((m, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => insertMethodSnippet(m.snippet)}
                    className="btn btn-ghost btn-sm"
                    style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 6,
                      background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(56,189,248,0.18)',
                      fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-1)',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}
                    title={`${m.detail} — Click to insert`}>
                    <code style={{ color: 'var(--cyan)' }}>{m.label}</code>
                    <span style={{ fontSize: 9, opacity: 0.7 }}>({m.category})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Just Submitted Receipt Banner ── */}
          {justSubmittedReceipt && (
            <div style={{
              background: justSubmittedReceipt.status === 'accepted' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              borderBottom: `1px solid ${justSubmittedReceipt.status === 'accepted' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
              fontSize: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {justSubmittedReceipt.status === 'accepted' ? (
                  <CheckCircle2 size={15} color="var(--green)" />
                ) : (
                  <XCircle size={15} color="var(--red)" />
                )}
                <span style={{ fontWeight: 700, color: justSubmittedReceipt.status === 'accepted' ? 'var(--green)' : 'var(--red)' }}>
                  {justSubmittedReceipt.status === 'accepted' ? 'Submission Evaluated & Accepted!' : 'Submission Recorded & Evaluated'}
                </span>
                <span style={{ color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                  [{justSubmittedReceipt.language.toUpperCase()}] • {justSubmittedReceipt.runtime}ms
                  {justSubmittedReceipt.score > 0 ? ` • +${justSubmittedReceipt.score} pts` : ''}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '2px 8px', fontSize: 11, color: 'var(--cyan)', border: '1px solid rgba(34,211,238,0.3)' }}
                  onClick={() => {
                    setActiveTab('submissions');
                    setSubmissionFilter('mine');
                    setExpandedSubId(justSubmittedReceipt.id);
                  }}>
                  <Eye size={12} /> View in Submissions History
                </button>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: '0 4px', fontSize: 13 }}
                  onClick={() => setJustSubmittedReceipt(null)}>
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* ── Policy Restriction Banner ── */}
          {lang === 'java' && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
              padding: '6px 14px',
              fontSize: 12,
              fontFamily: 'JetBrains Mono, monospace',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#fca5a5',
            }}>
              <ShieldAlert size={14} style={{ color: 'var(--red)', flexShrink: 0 }} />
              <span><strong>[RESTRICTION ACTIVE]:</strong> Java <code>java.io.*</code> &amp; <code>java.nio.*</code> are disabled. Use <code>java.util.Scanner</code> &amp; <code>System.out</code>.</span>
            </div>
          )}
          {lang === 'c' && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
              padding: '6px 14px',
              fontSize: 12,
              fontFamily: 'JetBrains Mono, monospace',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#fca5a5',
            }}>
              <ShieldAlert size={14} style={{ color: 'var(--red)', flexShrink: 0 }} />
              <span><strong>[RESTRICTION ACTIVE]:</strong> C pointers (<code>*ptr</code>, <code>-&gt;</code>, <code>malloc/free</code>) are disabled. Use static arrays and value variables.</span>
            </div>
          )}

          {/* ── Language Input Guide ── */}
          <LangGuide lang={lang} />

          {/* Monaco Editor */}
          <div className="problem-editor-container" style={{ flex: 1, minHeight: 380, overflow: 'hidden' }}>
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
                padding: { top: 16, bottom: 24 },
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
                automaticLayout: true,
                scrollbar: {
                  vertical: 'visible',
                  horizontal: 'visible',
                  verticalScrollbarSize: 10,
                  horizontalScrollbarSize: 10,
                  useShadows: false,
                  alwaysConsumeMouseWheel: false,
                },
                // Performance: disable expensive features
                codeLens: false,
                folding: true,
                renderWhitespace: 'none',
              }}
            />
          </div>

          {/* Output Panel */}
          {runResult && (
            <div style={{
              padding: isOutputMinimized ? '8px 16px' : 16,
              borderTop: '1px solid var(--border)',
              background: 'rgba(5,5,15,0.96)',
              maxHeight: isOutputMinimized ? 44 : 320,
              overflowY: isOutputMinimized ? 'hidden' : 'auto',
              transition: 'all 0.2s ease',
            }}>
              <div className="flex items-center gap-2" style={{ marginBottom: isOutputMinimized ? 0 : 10 }}>
                <Terminal size={14} color="var(--purple-light)" />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Output</span>
                {runResult.status === 'accepted'
                  ? <span className="badge badge-green" style={{ fontSize: 10 }}>✓ Accepted</span>
                  : runResult.status === 'wrong_answer'
                  ? <span className="badge badge-red" style={{ fontSize: 10 }}>✗ Wrong Answer</span>
                  : <span className="badge badge-yellow" style={{ fontSize: 10 }}>! Error</span>
                }
                <span style={{ fontSize: 12, color: 'var(--cyan)' }}>
                  <Clock size={12} style={{ verticalAlign: 'middle' }} /> {runResult.runtime}ms &nbsp;
                  <span style={{ color: 'var(--text-3)' }}>{runResult.passed}/{runResult.total} passed</span>
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 7px', fontSize: 11, gap: 4 }}
                    onClick={() => setIsOutputMinimized(v => !v)}
                    title={isOutputMinimized ? 'Expand Output' : 'Minimize Output'}>
                    {isOutputMinimized ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {isOutputMinimized ? 'Expand' : 'Minimize'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 6px', fontSize: 11 }}
                    onClick={() => setRunResult(null)}
                    title="Close output panel">
                    <X size={12} />
                  </button>
                </div>
              </div>
              {/* Summary line */}
              <div className="terminal" style={{ fontSize: 12, marginBottom: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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
                      borderRadius: 6, padding: '10px 14px', fontSize: 12,
                      background: t.passed ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
                    }}>
                      <div className="flex items-center gap-2" style={{ marginBottom: t.passed ? 0 : 6 }}>
                        {t.passed ? <CheckCircle2 size={12} color="var(--green)" /> : <XCircle size={12} color="var(--red)" />}
                        <span style={{ fontWeight: 600, color: t.passed ? 'var(--green)' : 'var(--red)' }}>
                          Test {i + 1}: {t.passed ? 'Passed ✓' : 'Failed ✗'}
                        </span>
                      </div>
                      {!t.passed && (
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 4, padding: '4px 8px' }}>
                            <span style={{ color: 'var(--text-3)', fontSize: 10, display: 'block', marginBottom: 2 }}>INPUT</span>
                            <span style={{ color: 'var(--text-1)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{t.input || '(empty)'}</span>
                          </div>
                          <div style={{ background: 'rgba(16,185,129,0.06)', borderRadius: 4, padding: '4px 8px' }}>
                            <span style={{ color: 'var(--text-3)', fontSize: 10, display: 'block', marginBottom: 2 }}>EXPECTED</span>
                            <span style={{ color: 'var(--green)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{t.expected || '(empty)'}</span>
                          </div>
                          <div style={{ background: 'rgba(239,68,68,0.06)', borderRadius: 4, padding: '4px 8px' }}>
                            <span style={{ color: 'var(--text-3)', fontSize: 10, display: 'block', marginBottom: 2 }}>YOUR OUTPUT</span>
                            <span style={{ color: 'var(--red)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{t.got || '(no output)'}</span>
                          </div>
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
