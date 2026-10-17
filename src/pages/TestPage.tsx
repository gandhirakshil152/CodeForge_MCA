import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc, getDoc, collection, getDocs, addDoc, query,
  where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import Editor from '@monaco-editor/react';
import {
  ChevronLeft, ChevronRight, AlertCircle, Send, Flag, Eye, EyeOff,
  Play, Code2, CheckCircle2, XCircle, Terminal, Clock, Trophy,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import {
  type LangId, LANG_OPTIONS, MONACO_LANG, type RunResult, runJudge0Code,
} from '../utils/judgeRunner';

interface QuestionItem {
  id: string;
  type?: 'mcq' | 'coding';
  question: string;
  options?: string[];
  correctIndex?: number; // hidden from student
  explanation?: string;
  marks: number;
  negativeMarks?: number;
  imageUrl?: string;
  order?: number;
  // Coding specific
  problemTitle?: string;
  starterCode?: Record<LangId, string>;
  testCases?: { input: string; expectedOutput: string }[];
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  difficulty?: string;
}

interface TestData {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  totalQuestions: number;
  startTime: any;
  endTime: any;
  passingScore: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResult: 'immediate' | 'after_end';
  negativeMarking: number;
  type: string;
  status: string;
}

const DEFAULT_STARTER: Record<LangId, string> = {
  java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Write your solution here
        
    }
}`,
  c: `#include <stdio.h>

int main() {
    // Write your solution here
    
    return 0;
}`,
  python: `import sys

def main():
    # Read from standard input
    lines = sys.stdin.read().split()
    if not lines:
        return
    # Write your solution here

if __name__ == "__main__":
    main()`,
  javascript: `const fs = require('fs');

function main() {
    const input = fs.readFileSync(0, 'utf-8').trim();
    // Write your solution here
    
}
main();`,
};

const TestPage: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [test, setTest] = useState<TestData | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});   // qId -> optionIndex for MCQs
  const [codingCodes, setCodingCodes] = useState<Record<string, { code: string; lang: LangId; passed: number; total: number }>>({});
  const [currentLang, setCurrentLang] = useState<Record<string, LangId>>({});
  const [runResults, setRunResults] = useState<Record<string, RunResult | null>>({});
  const [runningCode, setRunningCode] = useState(false);

  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [alreadyDone, setAlreadyDone] = useState(false);

  // Timer
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Warning count (anti-cheat tab detection)
  const [warnings, setWarnings] = useState(0);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showReviewPanel, setShowReviewPanel] = useState(false);

  const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

  useEffect(() => {
    if (!user || !testId) return;
    loadTest();

    // Tab visibility anti-cheat detector
    const onVisibilityChange = () => {
      if (document.hidden && !submitted) {
        setWarnings(w => {
          const next = w + 1;
          toast.error(`⚠️ Warning ${next}/3: Tab switch detected!`, { duration: 4000 });
          if (next >= 3) {
            toast.error('Auto-submitting test due to multiple tab switches!', { duration: 5000 });
            handleAutoSubmit();
          }
          return next;
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user, testId]);

  const loadTest = async () => {
    try {
      const testDoc = await getDoc(doc(db, 'mcq_tests', testId!));
      if (!testDoc.exists()) {
        toast.error('Test not found!');
        navigate('/tests');
        return;
      }
      const testData = { id: testDoc.id, ...testDoc.data() } as TestData;

      // Check if candidate already submitted this test
      const existing = await getDocs(
        query(collection(db, 'test_results'), where('userId', '==', user!.uid), where('testId', '==', testId))
      );
      if (!existing.empty) {
        setAlreadyDone(true);
        setResult(existing.docs[0].data());
        setTest(testData);
        setLoading(false);
        return;
      }

      // Check test timing — IF test status is 'active', bypass startTime restriction so students can immediately start!
      const now = new Date();
      if (testData.status !== 'active') {
        const start = testData.startTime?.toDate ? testData.startTime.toDate() : (testData.startTime ? new Date(testData.startTime) : null);
        const end = testData.endTime?.toDate ? testData.endTime.toDate() : (testData.endTime ? new Date(testData.endTime) : null);

        if (start && now < start) {
          toast.error('Test has not started yet!');
          navigate('/tests');
          return;
        }
        if (end && now > end) {
          toast.error('This test has ended!');
          navigate('/tests');
          return;
        }
      }

      // Load questions WITHOUT orderBy to prevent composite index requirements
      const qSnap = await getDocs(
        query(collection(db, 'mcq_questions'), where('testId', '==', testId))
      );

      let qs = qSnap.docs.map(d => ({ id: d.id, ...d.data() } as QuestionItem));
      // Sort client-side in memory by order or fallback index
      qs.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

      if (testData.shuffleQuestions && testData.type !== 'coding') {
        qs = shuffle(qs);
      }

      // Initialize coding codes and languages
      const initCodes: Record<string, { code: string; lang: LangId; passed: number; total: number }> = {};
      const initLang: Record<string, LangId> = {};

      qs.forEach(item => {
        if (item.type === 'coding' || testData.type === 'coding') {
          const l: LangId = 'java';
          initLang[item.id] = l;
          const starter = (item.starterCode && item.starterCode[l]) || DEFAULT_STARTER[l];
          initCodes[item.id] = { code: starter, lang: l, passed: 0, total: item.testCases?.length || 0 };
        }
      });

      setCodingCodes(initCodes);
      setCurrentLang(initLang);
      setTest(testData);
      setQuestions(qs);

      // Setup countdown timer
      const totalSecs = (testData.durationMinutes || 30) * 60;
      let secs = totalSecs;
      if (testData.status !== 'active') {
        const endTime = testData.endTime?.toDate ? testData.endTime.toDate() : (testData.endTime ? new Date(testData.endTime) : null);
        const secsUntilEnd = endTime ? Math.floor((endTime.getTime() - Date.now()) / 1000) : Infinity;
        secs = Math.min(totalSecs, secsUntilEnd > 0 ? secsUntilEnd : totalSecs);
      }
      setTimeLeft(Math.max(60, secs));
      startTimeRef.current = Date.now();
    } catch (err) {
      console.error('Error loading test:', err);
      toast.error('Failed to load test questions. Please check connection.');
    } finally {
      setLoading(false);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0 || submitted || alreadyDone || !test) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          toast.error('⏰ Time is up! Submitting your test…', { duration: 5000 });
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [test, submitted, alreadyDone]);

  const handleAutoSubmit = useCallback(() => {
    if (submitted) return;
    submitTest(true);
  }, [submitted, answers, codingCodes, questions]);

  // Code runner for coding problems
  const handleRunCode = async (qItem: QuestionItem) => {
    const l = currentLang[qItem.id] || 'java';
    const code = codingCodes[qItem.id]?.code || (qItem.starterCode?.[l] || DEFAULT_STARTER[l]);
    const cases = qItem.testCases || [];

    setRunningCode(true);
    try {
      const res = await runJudge0Code(code, l, cases);
      setRunResults(p => ({ ...p, [qItem.id]: res }));
      setCodingCodes(p => ({
        ...p,
        [qItem.id]: {
          code,
          lang: l,
          passed: res.passed,
          total: res.total,
        },
      }));
      if (res.status === 'accepted') {
        toast.success(`✓ All ${res.total} test cases passed!`);
      } else {
        toast.error(`${res.passed}/${res.total} test cases passed.`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Execution failed');
    } finally {
      setRunningCode(false);
    }
  };

  const handleLangChange = (qId: string, newLang: LangId, qItem: QuestionItem) => {
    setCurrentLang(p => ({ ...p, [qId]: newLang }));
    // Update starter code if not heavily edited
    const currentCode = codingCodes[qId]?.code;
    const isDefault = Object.values(DEFAULT_STARTER).some(s => s.trim() === currentCode?.trim()) || !currentCode;
    if (isDefault) {
      const newStarter = (qItem.starterCode && qItem.starterCode[newLang]) || DEFAULT_STARTER[newLang];
      setCodingCodes(p => ({
        ...p,
        [qId]: { code: newStarter, lang: newLang, passed: 0, total: qItem.testCases?.length || 0 },
      }));
    } else {
      setCodingCodes(p => ({
        ...p,
        [qId]: { ...(p[qId] || { passed: 0, total: 0 }), code: currentCode, lang: newLang },
      }));
    }
  };

  const submitTest = async (auto = false) => {
    if (submitting || submitted) return;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);

      // Fetch correct answers securely from database
      const qSnap = await getDocs(
        query(collection(db, 'mcq_questions'), where('testId', '==', testId))
      );
      const correctMap: Record<string, any> = {};
      qSnap.docs.forEach(d => {
        correctMap[d.id] = d.data();
      });

      let score = 0;
      let totalMarks = 0;
      let correct = 0;
      let incorrect = 0;
      let unanswered = 0;
      const detailedAnswers: any[] = [];

      questions.forEach(qItem => {
        const info = correctMap[qItem.id] || qItem;
        const marks = Number(info.marks) || 1;
        totalMarks += marks;

        if (qItem.type === 'coding' || test?.type === 'coding') {
          // Score coding question based on test cases passed
          const codeInfo = codingCodes[qItem.id];
          const passedCount = codeInfo?.passed || 0;
          const totalCount = codeInfo?.total || (qItem.testCases?.length || 1);
          const earned = totalCount > 0 ? Math.round((passedCount / totalCount) * marks) : 0;
          score += earned;
          if (passedCount === totalCount && totalCount > 0) correct++;
          else if (passedCount > 0) correct += 0.5;
          else unanswered++;

          detailedAnswers.push({
            qId: qItem.id,
            type: 'coding',
            problemTitle: qItem.problemTitle || qItem.question,
            lang: codeInfo?.lang || 'java',
            code: codeInfo?.code || '',
            passed: passedCount,
            total: totalCount,
            marksEarned: earned,
            marksPossible: marks,
          });
        } else {
          // MCQ Question
          const answered = answers[qItem.id] !== undefined;
          const correctIdx = info.correctIndex ?? 0;
          const neg = Number(info.negativeMarks) || (test?.negativeMarking || 0);

          if (!answered) {
            unanswered++;
            detailedAnswers.push({
              qId: qItem.id,
              type: 'mcq',
              given: null,
              correct: correctIdx,
              isCorrect: false,
            });
            return;
          }

          const isCorrect = answers[qItem.id] === correctIdx;
          if (isCorrect) {
            score += marks;
            correct++;
          } else {
            score -= neg;
            incorrect++;
          }
          detailedAnswers.push({
            qId: qItem.id,
            type: 'mcq',
            given: answers[qItem.id],
            correct: correctIdx,
            isCorrect,
          });
        }
      });

      score = Math.max(0, score);
      const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;

      const resultData = {
        userId: user!.uid,
        userName: profile?.displayName || user!.displayName || 'Student',
        userEmail: user!.email,
        testId,
        testTitle: test!.title,
        testType: test!.type || 'mcq',
        score,
        totalMarks,
        percentage,
        correct: Math.floor(correct),
        incorrect,
        unanswered,
        passed: percentage >= (test!.passingScore || 50),
        timeTaken,
        autoSubmitted: auto,
        warnings,
        detailedAnswers,
        submittedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'test_results'), resultData);
      setResult(resultData);
      setSubmitted(true);
      toast.success(auto ? 'Test auto-submitted!' : 'Test submitted successfully! 🎉');
    } catch (err) {
      console.error(err);
      toast.error('Submission failed. Please check network.');
    } finally {
      setSubmitting(false);
    }
  };

  const fmtTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const timerColor = timeLeft < 120 ? 'var(--red)' : timeLeft < 300 ? 'var(--yellow)' : 'var(--green)';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-deep)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-3)', fontFamily: 'Space Grotesk, sans-serif' }}>
            Preparing your placement test...
          </p>
        </div>
      </div>
    );
  }

  // ── RESULT SCREEN (After Submission or Already Done) ──
  if (submitted || alreadyDone) {
    const r = result;
    const passed = r?.passed ?? (r?.score >= (test?.passingScore ?? 50));
    return (
      <>
        <Navbar />
        <div className="page">
          <div className="page-content" style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px' }}>
            <div className="glass-card" style={{
              padding: 40, textAlign: 'center',
              border: passed ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(239,68,68,0.4)',
            }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>
                {passed ? '🎉' : '📋'}
              </div>
              <h2 className="font-display" style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
                {passed ? 'Congratulations!' : 'Test Completed'}
              </h2>
              <p style={{ color: 'var(--text-2)', marginBottom: 28, fontSize: 15 }}>
                {test?.title}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 30 }}>
                {[
                  { label: 'Score', val: `${r?.score}/${r?.totalMarks}`, color: 'var(--purple-light)' },
                  { label: 'Percentage', val: `${r?.percentage}%`, color: passed ? 'var(--green)' : 'var(--red)' },
                  { label: 'Correct', val: r?.correct ?? 0, color: 'var(--cyan)' },
                  { label: 'Incorrect', val: r?.incorrect ?? 0, color: 'var(--red)' },
                  { label: 'Time Taken', val: r?.timeTaken ? fmtTime(r.timeTaken) : '—', color: 'var(--text-2)' },
                  { label: 'Status', val: passed ? 'PASSED' : 'NEEDS PRACTICE', color: passed ? 'var(--green)' : 'var(--yellow)' },
                ].map((s, i) => (
                  <div key={i} className="glass-card" style={{ padding: '14px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: 'Syne,sans-serif' }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => navigate('/tests?leaderboard=' + testId)}>
                  <Trophy size={14} style={{ marginRight: 6 }} /> View Live Leaderboard
                </button>
                <button className="btn btn-ghost" onClick={() => navigate('/tests')}>
                  ← Back to Tests
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // If test has no questions
  if (!test || questions.length === 0) {
    return (
      <>
        <Navbar />
        <div className="page">
          <div className="page-content" style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center' }}>
            <div className="glass-card" style={{ padding: 40 }}>
              <Code2 size={48} color="var(--purple-light)" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No Questions in this Test Yet</h2>
              <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
                The faculty coordinator is currently uploading the questions for <strong>{test?.title || 'this test'}</strong>.
                Please check back in a few moments.
              </p>
              <button className="btn btn-primary" onClick={() => navigate('/tests')}>
                ← Back to Tests List
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const q = questions[currentIdx];
  const isCoding = q.type === 'coding' || test.type === 'coding';
  const answeredMCQs = Object.keys(answers).length;
  const answeredCoding = Object.values(codingCodes).filter(c => c.passed > 0).length;
  const totalAnswered = answeredMCQs + answeredCoding;
  const flaggedCount = flagged.size;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-deep)', display: 'flex', flexDirection: 'column' }}>
      {/* ── Fixed Top Exam Bar ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: 'rgba(5,5,15,0.95)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)', padding: '10px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        flexWrap: 'wrap',
      }}>
        <div className="flex items-center gap-3">
          <div className="navbar-logo" style={{ fontSize: 13 }}>{'</>'}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>{test.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
              Q {currentIdx + 1}/{questions.length} • {totalAnswered} answered • {test.type?.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {warnings > 0 && (
            <div className="flex items-center gap-1 badge badge-red" style={{ fontSize: 11 }}>
              <AlertCircle size={12} /> {warnings} warning{warnings > 1 ? 's' : ''}
            </div>
          )}

          <div style={{
            padding: '6px 16px', borderRadius: 10, fontFamily: 'JetBrains Mono, monospace',
            fontSize: 18, fontWeight: 700, color: timerColor,
            background: 'rgba(0,0,0,0.4)', border: `1px solid ${timerColor}40`,
            minWidth: 85, textAlign: 'center',
          }}>
            ⏱ {fmtTime(timeLeft)}
          </div>

          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowReviewPanel(v => !v)}
            title="Question Navigator"
          >
            {showReviewPanel ? <EyeOff size={13} /> : <Eye size={13} />} Palette
          </button>

          <button
            className="btn btn-sm"
            style={{ background: 'linear-gradient(135deg,var(--green),#059669)', color: 'white', fontWeight: 700 }}
            onClick={() => setShowSubmitModal(true)}
          >
            <Send size={12} /> Submit
          </button>
        </div>
      </div>

      {/* ── Main Exam Body ── */}
      <div style={{ paddingTop: 68, display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Question Panel */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <div style={{ maxWidth: isCoding ? 1100 : 780, margin: '0 auto' }}>

            {/* Question Header Card */}
            <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <div className="flex items-center gap-2">
                  <span className="badge badge-purple" style={{ fontWeight: 700 }}>
                    Question {currentIdx + 1}
                  </span>
                  <span className="badge" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', fontSize: 11 }}>
                    {isCoding ? '💻 Coding Problem' : '📝 Multiple Choice'}
                  </span>
                  {q.difficulty && (
                    <span className="badge badge-yellow" style={{ fontSize: 10 }}>{q.difficulty}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{q.marks} marks</span>
                  <button
                    onClick={() => setFlagged(prev => {
                      const next = new Set(prev);
                      if (next.has(q.id)) next.delete(q.id); else next.add(q.id);
                      return next;
                    })}
                    style={{
                      background: flagged.has(q.id) ? 'rgba(245,158,11,0.2)' : 'var(--bg-glass)',
                      border: flagged.has(q.id) ? '1px solid var(--yellow)' : '1px solid var(--border)',
                      borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
                      color: flagged.has(q.id) ? 'var(--yellow)' : 'var(--text-2)',
                      fontSize: 12, display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    <Flag size={12} /> {flagged.has(q.id) ? 'Flagged' : 'Flag for review'}
                  </button>
                </div>
              </div>

              {/* Title & Statement */}
              {q.problemTitle && (
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>
                  {q.problemTitle}
                </h3>
              )}
              <p style={{ fontSize: 15, lineHeight: 1.7, fontWeight: 400, color: 'var(--text-1)', whiteSpace: 'pre-wrap' }}>
                {q.question}
              </p>

              {q.imageUrl && (
                <img src={q.imageUrl} alt="diagram" style={{ maxWidth: '100%', borderRadius: 10, marginTop: 12 }} />
              )}

              {/* Coding Constraints & I/O specs */}
              {isCoding && (q.inputFormat || q.outputFormat || q.constraints) && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                  {q.inputFormat && (
                    <div style={{ fontSize: 12 }}>
                      <span style={{ color: 'var(--purple-light)', fontWeight: 600 }}>Input Format:</span>
                      <p style={{ color: 'var(--text-2)', marginTop: 2 }}>{q.inputFormat}</p>
                    </div>
                  )}
                  {q.outputFormat && (
                    <div style={{ fontSize: 12 }}>
                      <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>Output Format:</span>
                      <p style={{ color: 'var(--text-2)', marginTop: 2 }}>{q.outputFormat}</p>
                    </div>
                  )}
                  {q.constraints && (
                    <div style={{ fontSize: 12 }}>
                      <span style={{ color: 'var(--yellow)', fontWeight: 600 }}>Constraints:</span>
                      <p style={{ color: 'var(--text-2)', marginTop: 2 }}>{q.constraints}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── QUESTION BODY (CODING vs MCQ) ── */}
            {isCoding ? (
              /* CODING INTERACTION */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {/* Language Switcher Bar */}
                <div className="glass-card" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Code2 size={16} color="var(--purple-light)" />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Select Language:</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {LANG_OPTIONS.map(opt => {
                        const active = (currentLang[q.id] || 'java') === opt.id;
                        return (
                          <button
                            key={opt.id}
                            className={`badge ${active ? 'badge-purple' : ''}`}
                            style={{
                              cursor: 'pointer',
                              border: active ? undefined : '1px solid var(--border)',
                              background: active ? undefined : 'transparent',
                              padding: '4px 10px',
                            }}
                            onClick={() => handleLangChange(q.id, opt.id, q)}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Run Code Button */}
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={runningCode}
                    onClick={() => handleRunCode(q)}
                  >
                    <Play size={13} /> {runningCode ? 'Compiling & Running…' : 'Run Test Cases'}
                  </button>
                </div>

                {/* Monaco Code Editor */}
                <div style={{
                  height: 380, borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                  border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                }}>
                  <Editor
                    theme="vs-dark"
                    language={MONACO_LANG[currentLang[q.id] || 'java']}
                    value={codingCodes[q.id]?.code || (q.starterCode?.[currentLang[q.id] || 'java'] || DEFAULT_STARTER[currentLang[q.id] || 'java'])}
                    onChange={val => setCodingCodes(p => ({
                      ...p,
                      [q.id]: {
                        code: val || '',
                        lang: currentLang[q.id] || 'java',
                        passed: p[q.id]?.passed || 0,
                        total: q.testCases?.length || 0,
                      },
                    }))}
                    options={{
                      fontSize: 14,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  />
                </div>

                {/* Live Output & Test Cases Results */}
                {runResults[q.id] && (
                  <div className="glass-card" style={{ padding: 16 }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                      <Terminal size={14} color="var(--purple-light)" />
                      <span style={{ fontSize: 13, fontWeight: 700 }}>Test Run Output</span>
                      <span className={`badge ${runResults[q.id]?.status === 'accepted' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10 }}>
                        {runResults[q.id]?.status === 'accepted' ? 'Passed ✓' : 'Failed ✗'}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--cyan)' }}>
                        <Clock size={12} style={{ verticalAlign: 'middle' }} /> {runResults[q.id]?.runtime}ms • {runResults[q.id]?.passed}/{runResults[q.id]?.total} passed
                      </span>
                    </div>

                    <div className="terminal" style={{ fontSize: 12, marginBottom: 10, minHeight: 60 }}>
                      {runResults[q.id]?.output}
                    </div>

                    {runResults[q.id]?.testDetails && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                        {runResults[q.id]?.testDetails.map((td, tIdx) => (
                          <div
                            key={tIdx}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 8,
                              background: td.passed ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                              border: td.passed ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)',
                              fontSize: 11,
                            }}
                          >
                            <div className="flex items-center gap-2" style={{ fontWeight: 600, color: td.passed ? 'var(--green)' : 'var(--red)' }}>
                              {td.passed ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                              Test Case {tIdx + 1}: {td.passed ? 'Passed' : 'Failed'}
                            </div>
                            {!td.passed && (
                              <div style={{ marginTop: 4, color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
                                <div>Exp: <span style={{ color: 'var(--green)' }}>{td.expected}</span></div>
                                <div>Got: <span style={{ color: 'var(--red)' }}>{td.got}</span></div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* MCQ OPTIONS INTERACTION */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {q.options && q.options.length > 0 ? (
                  q.options.map((opt, idx) => {
                    const selected = answers[q.id] === idx;
                    return (
                      <button
                        key={idx}
                        onClick={() => setAnswers(prev => ({ ...prev, [q.id]: idx }))}
                        style={{
                          padding: '14px 18px', borderRadius: 12,
                          background: selected ? 'rgba(139,92,246,0.18)' : 'var(--bg-card)',
                          border: selected ? '1px solid var(--purple)' : '1px solid var(--border)',
                          color: 'var(--text-1)', fontSize: 14, textAlign: 'left', cursor: 'pointer',
                          transition: 'all 0.18s ease', display: 'flex', alignItems: 'center', gap: 14,
                          fontWeight: selected ? 600 : 400,
                        }}
                      >
                        <span style={{
                          width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'flex',
                          alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                          background: selected ? 'var(--purple)' : 'var(--bg-glass)',
                          border: selected ? 'none' : '1px solid var(--border)',
                          fontSize: 12, color: selected ? 'white' : 'var(--text-2)',
                        }}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        {opt}
                      </button>
                    );
                  })
                ) : (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)' }}>
                    No options found for this question.
                  </div>
                )}
              </div>
            )}

            {/* Navigation Footer */}
            <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 10 }}>
              <button
                className="btn btn-ghost"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx(i => i - 1)}
              >
                <ChevronLeft size={16} /> Previous
              </button>

              <div className="flex items-center gap-2">
                {!isCoding && answers[q.id] !== undefined && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setAnswers(prev => { const n = { ...prev }; delete n[q.id]; return n; });
                    }}
                    style={{ color: 'var(--text-3)' }}
                  >
                    Clear Choice
                  </button>
                )}
              </div>

              {currentIdx < questions.length - 1 ? (
                <button
                  className="btn btn-primary"
                  onClick={() => setCurrentIdx(i => i + 1)}
                >
                  Next <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  className="btn"
                  style={{ background: 'linear-gradient(135deg,var(--green),#059669)', color: 'white', fontWeight: 700 }}
                  onClick={() => setShowSubmitModal(true)}
                >
                  <Send size={14} /> Submit Final Test
                </button>
              )}
            </div>

          </div>
        </div>

        {/* ── Review Panel (Slide-in Question Navigator) ── */}
        {showReviewPanel && (
          <div style={{
            width: 280, borderLeft: '1px solid var(--border)', background: 'var(--bg-card)',
            padding: 18, display: 'flex', flexDirection: 'column', zIndex: 900,
          }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Question Navigator</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowReviewPanel(false)}><EyeOff size={13} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 18, overflowY: 'auto' }}>
              {questions.map((item, idx) => {
                const isItemCoding = item.type === 'coding' || test.type === 'coding';
                const isAns = isItemCoding
                  ? (codingCodes[item.id]?.passed || 0) > 0
                  : answers[item.id] !== undefined;
                const isFlg = flagged.has(item.id);
                const isCur = idx === currentIdx;

                let bg = 'var(--bg-glass)';
                let border = '1px solid var(--border)';
                let color = 'var(--text-2)';

                if (isCur) { border = '2px solid var(--purple)'; color = 'white'; }
                if (isAns) { bg = 'rgba(16,185,129,0.2)'; border = '1px solid var(--green)'; color = 'var(--green)'; }
                if (isFlg) { bg = 'rgba(245,158,11,0.2)'; border = '1px solid var(--yellow)'; color = 'var(--yellow)'; }

                return (
                  <button
                    key={item.id}
                    onClick={() => { setCurrentIdx(idx); }}
                    style={{
                      height: 38, borderRadius: 8, background: bg, border,
                      color, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, color: 'var(--text-3)', marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(16,185,129,0.3)', border: '1px solid var(--green)' }} /> Answered / Passed
              </div>
              <div className="flex items-center gap-2">
                <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(245,158,11,0.3)', border: '1px solid var(--yellow)' }} /> Flagged
              </div>
              <div className="flex items-center gap-2">
                <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--bg-glass)', border: '1px solid var(--border)' }} /> Unattempted
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Submit Confirmation Modal ── */}
      {showSubmitModal && (
        <div className="modal-overlay" onClick={() => setShowSubmitModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 800 }}>Submit Test?</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowSubmitModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
                {[
                  { label: 'Attempted', val: totalAnswered, color: 'var(--green)' },
                  { label: 'Flagged', val: flaggedCount, color: 'var(--yellow)' },
                  { label: 'Unattempted', val: questions.length - totalAnswered, color: 'var(--red)' },
                ].map(s => (
                  <div key={s.label} className="glass-card" style={{ padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'Syne,sans-serif' }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <p style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.5 }}>
                Are you sure you want to finish? Your score and rankings will be recorded immediately on the live placement leaderboard.
              </p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowSubmitModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={submitting} onClick={() => { setShowSubmitModal(false); submitTest(false); }}>
                {submitting ? 'Submitting…' : 'Confirm Submission'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestPage;
