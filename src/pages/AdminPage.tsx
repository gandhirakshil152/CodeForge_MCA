import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, getDocs, query, orderBy, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, increment, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import {
  Shield, Plus, Trash2, Edit3, Users, BookOpen, BarChart2,
  Save, X, AlertTriangle, UserCheck, UserX, Loader2,
  Database, CheckCircle2, Activity, Award, Clock, Zap,
  Eye, EyeOff, Table2, ThumbsUp, ThumbsDown, Calendar, ListChecks,
  ClipboardList, Code2, Play, MessageSquare, Terminal,
  Maximize2, Minimize2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Problem } from './ProblemsPage';
import { AdminTestsTab } from '../components/AdminTestsTab';
import { executeSqlInDb, parseColumns, parseRows, parseRowCells, type SqlQueryResult } from '../utils/sqlRunner';

// ─── Types ────────────────────────────────────────────────────────────────────
type AdminTab = 'problems' | 'dbms' | 'tests' | 'users' | 'stats' | 'submissions' | 'daily_tasks';

interface DailyTask {
  id: string;
  title: string;
  description: string;
  type: 'code' | 'dbms' | 'any';
  targetCount: number;
  date: string; // YYYY-MM-DD
  points: number;
  createdBy?: string;
}

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
  expectedOutput?: string;
  explanation?: string;
  tableData?: TableDef[];
  addedBy?: string;
  createdAt?: unknown;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_STARTER: Problem['starterCode'] = {
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
input = sys.stdin.readline

# Write your solution here
`,
  javascript: `const lines = require('fs').readFileSync('/dev/stdin', 'utf8').split('\\n');
let idx = 0;
const readline = () => lines[idx++]?.trim() ?? '';

// Write your solution here
`,
};

const EMPTY_PROBLEM = {
  title: '', difficulty: 'easy' as 'easy' | 'medium' | 'hard', category: 'Arrays',
  tags: '', description: '', inputFormat: '', outputFormat: '', constraints: '',
  examples: [{ input: '', output: '', explanation: '' }],
  testCases: [{ input: '', expectedOutput: '' }],
  starterCode: { ...DEFAULT_STARTER },
};

const DBMS_TOPICS = [
  'SQL Basics', 'Joins', 'Subqueries', 'Aggregation', 'Normalization',
  'Indexing', 'Transactions', 'Stored Procedures', 'Views',
  'ER Diagrams', 'ACID Properties', 'Concurrency Control', 'Keys & Constraints',
];

export const DBMS_TYPES = ['query', 'theory', 'normalization', 'design'] as const;

const EMPTY_DBMS: Omit<DbmsQuestion, 'id'> = {
  title: '', topic: 'SQL Basics', difficulty: 'easy', type: 'query',
  description: '', hint: '', sampleSchema: '', expectedQuery: '', expectedOutput: '', explanation: '',
  tableData: [{ name: '', columns: 'id, name, value', rows: '1, Alice, 100\n2, Bob, 200' }],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const typeColor = (t: string) =>
  t === 'query' ? 'badge-cyan' : t === 'theory' ? 'badge-purple'
  : t === 'normalization' ? 'badge-yellow' : 'badge-pink';
const typeIcon = (t: string) =>
  t === 'query' ? '🔍' : t === 'theory' ? '📖' : t === 'normalization' ? '🗂️' : '🏗️';

// ─── Component ────────────────────────────────────────────────────────────────
const AdminPage: React.FC = () => {
  const { profile, isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>('problems');

  // Problems state
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]         = useState({ ...EMPTY_PROBLEM });
  const [saving, setSaving]     = useState(false);

  // DBMS state
  const [dbmsQuestions, setDbmsQuestions] = useState<DbmsQuestion[]>([]);
  const [showDbmsForm, setShowDbmsForm]   = useState(false);
  const [editingDbmsId, setEditingDbmsId] = useState<string | null>(null);
  const [dbmsForm, setDbmsForm]           = useState<Omit<DbmsQuestion, 'id'>>({ ...EMPTY_DBMS });
  const [savingDbms, setSavingDbms]       = useState(false);
  const [showAnswer, setShowAnswer]       = useState(false);

  // Users + stats
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0, totalSubmissions: 0, totalProblems: 0,
    acceptedSubmissions: 0, totalDbms: 0, totalDbmsSubmissions: 0,
  });
  // Submissions
  const [dbmsSubmissions, setDbmsSubmissions] = useState<any[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<any[]>([]);
  const [deletingSubId, setDeletingSubId] = useState<string | null>(null);
  const [gradingId, setGradingId] = useState<string | null>(null);

  // Interactive DBMS Evaluation Modal State
  const [inspectingSub, setInspectingSub] = useState<any | null>(null);
  const [adminRemarksDraft, setAdminRemarksDraft] = useState('');
  const [studentQueryResult, setStudentQueryResult] = useState<SqlQueryResult | null>(null);
  const [expectedQueryResult, setExpectedQueryResult] = useState<SqlQueryResult | null>(null);
  const [runningStudentSql, setRunningStudentSql] = useState(false);
  const [runningExpectedSql, setRunningExpectedSql] = useState(false);
  const [savingRemarksId, setSavingRemarksId] = useState<string | null>(null);
  const [editingRemarksSubId, setEditingRemarksSubId] = useState<string | null>(null);
  const [inlineRemarksDraft, setInlineRemarksDraft] = useState('');

  // Daily Tasks state
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', type: 'code' as 'code'|'dbms'|'any', targetCount: 1, date: new Date().toISOString().slice(0,10), points: 50 });
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string|null>(null);
  const [testsCount, setTestsCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pSnap, uSnap, dbmsSnap, subSnap, dbmsSubSnap, taskSnap, testSnap] = await Promise.all([
        getDocs(query(collection(db, 'problems'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'dbms_questions'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'submissions')),
        getDocs(query(collection(db, 'dbms_submissions'), orderBy('submittedAt', 'desc'))),
        getDocs(query(collection(db, 'daily_tasks'), orderBy('date', 'desc'))),
        getDocs(collection(db, 'mcq_tests')),
      ]);
      setProblems(pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Problem)));
      setUsers(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setDbmsQuestions(dbmsSnap.docs.map(d => ({ id: d.id, ...d.data() } as DbmsQuestion)));
      const subs = subSnap.docs.map(d => d.data());
      const dbmsSubs = dbmsSubSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllSubmissions(subSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setDbmsSubmissions(dbmsSubs);
      setDailyTasks(taskSnap.docs.map(d => ({ id: d.id, ...d.data() } as DailyTask)));
      setTestsCount(testSnap.size);
      setStats({
        totalUsers: uSnap.size, totalProblems: pSnap.size,
        totalDbms: dbmsSnap.size, totalSubmissions: subSnap.size,
        acceptedSubmissions: subs.filter((s: any) => s.status === 'accepted').length,
        totalDbmsSubmissions: dbmsSubSnap.size,
      });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const deleteDbmsSubmission = async (id: string) => {
    if (!window.confirm('Delete this submission?')) return;
    setDeletingSubId(id);
    try {
      await deleteDoc(doc(db, 'dbms_submissions', id));
      toast.success('Submission removed!');
      loadData();
    } catch { toast.error('Failed!'); }
    finally { setDeletingSubId(null); }
  };

  const DBMS_POINTS: Record<string, number> = { easy: 10, medium: 25, hard: 50 };

  const gradeDbmsSubmission = async (sub: any, verdict: 'pass' | 'fail', customRemarks?: string) => {
    setGradingId(sub.id);
    try {
      const qObj = dbmsQuestions.find(q => q.id === sub.questionId);
      const title = qObj?.title || sub.questionTitle || 'DBMS Question';
      const remarks = customRemarks !== undefined ? customRemarks : (sub.adminRemarks || '');
      const pts = verdict === 'pass' ? (DBMS_POINTS[sub.difficulty] ?? 10) : 0;

      await updateDoc(doc(db, 'dbms_submissions', sub.id), {
        status: verdict,
        points: pts,
        adminRemarks: remarks,
        questionTitle: title,
        gradedAt: serverTimestamp(),
      });

      if (verdict === 'pass') {
        await updateDoc(doc(db, 'users', sub.userId), {
          score: increment(pts),
          problemsSolved: increment(1),
        });

        // Record in primary submissions collection so student dashboard, profile, and leaderboard recognize it
        await addDoc(collection(db, 'submissions'), {
          userId: sub.userId,
          userName: sub.userName,
          userEmail: sub.userEmail,
          problemId: sub.questionId,
          problemTitle: `[SQL] ${title}`,
          language: 'sql',
          status: 'accepted',
          adminRemarks: remarks,
          runtime: 12,
          score: pts,
          todayDate: new Date().toISOString().slice(0, 10),
          createdAt: serverTimestamp(),
        });

        toast.success(`Marked PASS (+${pts} pts) & awarded to ${sub.userName}`);
      } else {
        await addDoc(collection(db, 'submissions'), {
          userId: sub.userId,
          userName: sub.userName,
          userEmail: sub.userEmail,
          problemId: sub.questionId,
          problemTitle: `[SQL] ${title}`,
          language: 'sql',
          status: 'wrong_answer',
          adminRemarks: remarks,
          runtime: 15,
          score: 0,
          todayDate: new Date().toISOString().slice(0, 10),
          createdAt: serverTimestamp(),
        });
        toast.success(`Marked FAIL / Needs Revision for ${sub.userName}${remarks ? ' (remarks saved)' : ''}`);
      }

      if (inspectingSub?.id === sub.id) {
        setInspectingSub(null);
      }
      loadData();
    } catch (err) { toast.error('Grading failed!'); console.error(err); }
    finally { setGradingId(null); }
  };

  const saveAdminRemarksOnly = async (subId: string, remarks: string) => {
    setSavingRemarksId(subId);
    try {
      await updateDoc(doc(db, 'dbms_submissions', subId), {
        adminRemarks: remarks,
      });
      toast.success('Remarks updated for student!');
      setEditingRemarksSubId(null);
      loadData();
    } catch (err) {
      toast.error('Failed to update remarks');
    } finally {
      setSavingRemarksId(null);
    }
  };

  const openDbmsInspector = (sub: any) => {
    setInspectingSub(sub);
    setAdminRemarksDraft(sub.adminRemarks || '');
    setStudentQueryResult(null);
    setExpectedQueryResult(null);
  };

  const runStudentSqlInModal = async (sub: any) => {
    const q = dbmsQuestions.find(x => x.id === sub.questionId);
    const sql = sub.userQuery || sub.userOutput || '';
    if (!sql.trim()) {
      toast.error('No SQL query found in this submission!');
      return;
    }
    setRunningStudentSql(true);
    try {
      const res = await executeSqlInDb(sql, q?.tableData, q?.sampleSchema);
      setStudentQueryResult(res);
      if (res.success) {
        toast.success(`Executed in ${res.executionTimeMs}ms (${res.values.length} rows returned)`);
      } else {
        toast.error('SQLite execution error: ' + (res.error || 'Failed'));
      }
    } catch (e: any) {
      toast.error('Runner exception: ' + e?.message);
    } finally {
      setRunningStudentSql(false);
    }
  };

  const runExpectedSqlInModal = async (sub: any) => {
    const q = dbmsQuestions.find(x => x.id === sub.questionId);
    if (!q?.expectedQuery) {
      toast.error('No Reference/Expected SQL query configured for this question.');
      return;
    }
    setRunningExpectedSql(true);
    try {
      const res = await executeSqlInDb(q.expectedQuery, q.tableData, q.sampleSchema);
      setExpectedQueryResult(res);
      if (res.success) {
        toast.success(`Reference query ran in ${res.executionTimeMs}ms (${res.values.length} rows)`);
      } else {
        toast.error('SQLite execution error: ' + (res.error || 'Failed'));
      }
    } catch (e: any) {
      toast.error('Runner exception: ' + e?.message);
    } finally {
      setRunningExpectedSql(false);
    }
  };

  const deleteCodeSubmission = async (id: string) => {
    if (!window.confirm('Delete this submission?')) return;
    try {
      await deleteDoc(doc(db, 'submissions', id));
      toast.success('Submission removed!');
      loadData();
    } catch { toast.error('Failed!'); }
  };

  // deleteProblemComment is available for future use via admin submissions tab

  // ── Problems CRUD ──────────────────────────────────────────────────────────
  const resetForm = () => { setForm({ ...EMPTY_PROBLEM }); setEditingId(null); setShowForm(false); };

  const handleEdit = (p: Problem) => {
    setForm({
     title: p.title,
    difficulty: p.difficulty,
  category: p.category,
      tags: p.tags?.join(', ') || '', description: p.description,
      inputFormat: p.inputFormat || '', outputFormat: p.outputFormat || '',
      constraints: p.constraints || '',
      examples: p.examples?.length
        ? p.examples.map(e => ({ input: e.input, output: e.output, explanation: e.explanation ?? '' }))
        : [{ input: '', output: '', explanation: '' }],
      testCases: p.testCases?.length ? p.testCases : [{ input: '', expectedOutput: '' }],
      starterCode: p.starterCode || { ...DEFAULT_STARTER },
    });
    setEditingId(p.id); setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Title and description are required!'); return;
    }
    setSaving(true);
    try {
      const data = {
        title: form.title.trim(), difficulty: form.difficulty, category: form.category,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        description: form.description.trim(),
        inputFormat: form.inputFormat.trim(), outputFormat: form.outputFormat.trim(),
        constraints: form.constraints.trim(),
        examples: form.examples.filter(e => e.input || e.output),
        testCases: form.testCases.filter(t => t.input || t.expectedOutput),
        starterCode: form.starterCode, solvedCount: 0, likes: 0, dislikes: 0,
        addedBy: profile?.displayName || 'Admin',
        ...(editingId ? { updatedAt: serverTimestamp() } : { createdAt: serverTimestamp() }),
      };
      if (editingId) {
        await updateDoc(doc(db, 'problems', editingId), data);
        toast.success('Updated! ✅');
      } else {
        await addDoc(collection(db, 'problems'), data);
        toast.success('Published! 🎉');
        // Broadcast notification to all users about new problem
        try {
          const uSnap = await getDocs(collection(db, 'users'));
          const batch = writeBatch(db);
          uSnap.docs.forEach(u => {
            const nRef = doc(collection(db, 'notifications'));
            batch.set(nRef, {
              userId: u.id,
              type: 'new_problem',
              title: '🆕 New Problem Added!',
              message: `"${form.title.trim()}" (${form.difficulty}) was just added. Go solve it!`,
              read: false,
              createdAt: serverTimestamp(),
            });
          });
          await batch.commit();
        } catch (ne) { console.warn('Notification batch failed', ne); }
      }
      resetForm(); loadData();
    } catch (err) { toast.error('Failed!'); console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    try { await deleteDoc(doc(db, 'problems', id)); toast.success('Deleted!'); loadData(); }
    catch { toast.error('Failed!'); }
  };

  // ── DBMS CRUD ──────────────────────────────────────────────────────────────
  const resetDbmsForm = () => {
    setDbmsForm({ ...EMPTY_DBMS }); setEditingDbmsId(null); setShowDbmsForm(false); setShowAnswer(false);
  };

  const handleDbmsEdit = (q: DbmsQuestion) => {
    setDbmsForm({
      title: q.title, topic: q.topic, difficulty: q.difficulty, type: q.type,
      description: q.description, hint: q.hint || '',
      sampleSchema: q.sampleSchema || '', expectedQuery: q.expectedQuery || '',
      expectedOutput: q.expectedOutput || '',
      explanation: q.explanation || '',
      tableData: q.tableData?.length ? q.tableData : [{ name: '', columns: '', rows: '' }],
    });
    setEditingDbmsId(q.id); setShowDbmsForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDbmsSave = async () => {
    if (!dbmsForm.title.trim() || !dbmsForm.description.trim()) {
      toast.error('Title and description required!'); return;
    }
    if (!dbmsForm.expectedOutput || !dbmsForm.expectedOutput.trim()) {
      toast.error('⚠️ Expected Output is mandatory! Students need this to verify their answers.');
      return;
    }
    setSavingDbms(true);
    try {
      const data = {
        ...dbmsForm,
        title: dbmsForm.title.trim(),
        description: dbmsForm.description.trim(),
        expectedOutput: dbmsForm.expectedOutput.trim(),
        addedBy: profile?.displayName || 'Admin',
        ...(editingDbmsId ? { updatedAt: serverTimestamp() } : { createdAt: serverTimestamp() }),
      };
      if (editingDbmsId) { await updateDoc(doc(db, 'dbms_questions', editingDbmsId), data); toast.success('Updated! ✅'); }
      else               { await addDoc(collection(db, 'dbms_questions'), data);             toast.success('Added! 🎉'); }
      resetDbmsForm(); loadData();
    } catch (err) { toast.error('Failed!'); console.error(err); }
    finally { setSavingDbms(false); }
  };

  const handleDbmsDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    try { await deleteDoc(doc(db, 'dbms_questions', id)); toast.success('Deleted!'); loadData(); }
    catch { toast.error('Failed!'); }
  };

  // ── User management ────────────────────────────────────────────────────────
  const toggleUserRole = async (userId: string, currentRole: string) => {
    if (!isSuperAdmin) { toast.error('Only Super Admin!'); return; }
    const newRole = currentRole === 'admin' ? 'student' : 'admin';
    try { await updateDoc(doc(db, 'users', userId), { role: newRole }); toast.success(`Role → ${newRole}`); loadData(); }
    catch { toast.error('Failed!'); }
  };

  const deleteUser = async (userId: string, name: string) => {
    if (!isSuperAdmin) { toast.error('Only Super Admin!'); return; }
    if (!window.confirm(`Remove "${name}"?`)) return;
    try { await deleteDoc(doc(db, 'users', userId)); toast.success('Removed!'); loadData(); }
    catch { toast.error('Failed!'); }
  };

  // ── Daily Tasks CRUD ──────────────────────────────────────────────────────
  const resetTaskForm = () => { setTaskForm({ title: '', description: '', type: 'code', targetCount: 1, date: new Date().toISOString().slice(0,10), points: 50 }); setEditingTaskId(null); setShowTaskForm(false); };

  const handleTaskSave = async () => {
    if (!taskForm.title.trim()) { toast.error('Title required!'); return; }
    setSavingTask(true);
    try {
      if (editingTaskId) {
        await updateDoc(doc(db, 'daily_tasks', editingTaskId), { ...taskForm, updatedAt: serverTimestamp() });
        toast.success('Task updated! ✅');
      } else {
        await addDoc(collection(db, 'daily_tasks'), {
          ...taskForm,
          createdBy: profile?.displayName || 'Admin',
          createdAt: serverTimestamp(),
        });
        toast.success('Daily task created! 🎉');
        // Notify all users about the new daily task
        try {
          const uSnap = await getDocs(collection(db, 'users'));
          const batch = writeBatch(db);
          uSnap.docs.forEach(u => {
            const nRef = doc(collection(db, 'notifications'));
            batch.set(nRef, {
              userId: u.id,
              type: 'daily_task',
              title: '📅 New Daily Task!',
              message: `"${taskForm.title}" — ${taskForm.description || 'Complete today\'s challenge!'} (+${taskForm.points} pts)`,
              read: false,
              createdAt: serverTimestamp(),
            });
          });
          await batch.commit();
        } catch (ne) { console.warn('Notification failed', ne); }
      }
      resetTaskForm(); loadData();
    } catch (err) { toast.error('Failed!'); console.error(err); }
    finally { setSavingTask(false); }
  };

  const handleTaskDelete = async (id: string) => {
    if (!window.confirm('Delete this daily task?')) return;
    try { await deleteDoc(doc(db, 'daily_tasks', id)); toast.success('Deleted!'); loadData(); }
    catch { toast.error('Failed!'); }
  };

  if (!isAdmin) return null;

  const TABS = [
    { id: 'problems'    as AdminTab, label: '1. Coding Problems', icon: <Code2 size={14} />,   count: stats.totalProblems },
    { id: 'dbms'        as AdminTab, label: '2. SQL & DBMS Lab',  icon: <Database size={14} />,count: stats.totalDbms },
    { id: 'tests'       as AdminTab, label: 'Placement Tests',    icon: <ClipboardList size={14} />, count: testsCount },
    { id: 'submissions' as AdminTab, label: 'Submissions',        icon: <Eye size={14} />,        count: stats.totalSubmissions + stats.totalDbmsSubmissions },
    { id: 'users'       as AdminTab, label: 'Users',              icon: <Users size={14} />,      count: stats.totalUsers },
    { id: 'daily_tasks' as AdminTab, label: 'Daily Tasks',        icon: <Calendar size={14} />,  count: dailyTasks.length },
    { id: 'stats'       as AdminTab, label: 'Analytics',          icon: <BarChart2 size={14} /> },
  ];

  const tabAccent = (id: AdminTab) =>
    id === 'dbms' ? 'var(--cyan)' : id === 'tests' ? 'var(--yellow)' : id === 'stats' ? 'var(--yellow)' : id === 'users' ? 'var(--pink)' : id === 'submissions' ? 'var(--green)' : id === 'daily_tasks' ? 'var(--cyan)' : 'var(--blue-light)';

  return (
    <>
      <Navbar />
      <div className="page" style={{ paddingTop: 64, minHeight: '100vh', width: '100%' }}>
        <div className="admin-page-full" style={{ position: 'relative' }}>

          {/* ── Fixed Watermark ────────────────────────────────── */}
          <div style={{
            position: 'fixed', bottom: 18, right: 22, zIndex: 9999, pointerEvents: 'none',
            opacity: 0.18, fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
            color: 'var(--blue-light)', letterSpacing: '0.12em', textTransform: 'uppercase', userSelect: 'none',
          }}>
            ⚡ CodeForge MCA
          </div>

          {/* ── Header ─────────────────────────────────────────── */}
          <div style={{ marginBottom: 26 }}>
            <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
              <div style={{
                width: 50, height: 50, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg,rgba(59,130,246,0.22),rgba(59,130,246,0.05))',
                border: '1px solid rgba(59,130,246,0.42)', boxShadow: '0 0 28px rgba(59,130,246,0.18)',
              }}>
                <Shield size={22} color="var(--blue-light)" />
              </div>
              <div>
                <h1 className="font-display" style={{ fontSize: 'clamp(20px,3.5vw,30px)', fontWeight: 800, lineHeight: 1.15 }}>
                  Admin Panel{' '}
                  <span style={{
                    fontSize: 11, color: 'var(--blue-light)', background: 'rgba(59,130,246,0.12)',
                    border: '1px solid rgba(59,130,246,0.32)', borderRadius: 99, padding: '2px 9px', verticalAlign: 'middle',
                  }}>
                    {isSuperAdmin ? '👑 Super Admin' : '🛡️ Admin'}
                  </span>
                </h1>
                <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 3 }}>
                  College Assessment Hub · 2 Problem Tracks (Coding & SQL) · Live MCQ Tests · Analytics · Edge-to-Edge Full Screen
                </p>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{
                    color: isFullscreen ? 'var(--cyan)' : 'var(--text-2)',
                    borderColor: isFullscreen ? 'rgba(34,211,238,0.4)' : 'var(--border)',
                    background: isFullscreen ? 'rgba(34,211,238,0.1)' : 'transparent',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                  onClick={toggleFullscreen}
                  title="Toggle Fullscreen Edge-to-Edge Mode">
                  {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Mode'}
                </button>
                {tab === 'problems' && !showForm && (
                  <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
                    <Plus size={14} /> Add Coding Problem
                  </button>
                )}
                {tab === 'dbms' && !showDbmsForm && (
                  <button className="btn"
                    style={{ background: 'linear-gradient(135deg,var(--cyan),#0891b2)', color: '#000', boxShadow: '0 4px 18px rgba(34,211,238,0.32)', fontWeight: 700 }}
                    onClick={() => { resetDbmsForm(); setShowDbmsForm(true); }}>
                    <Plus size={14} /> Add SQL Question
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={loadData}><Zap size={12}/> Refresh</button>
              </div>
            </div>
          </div>

          {/* ── Stats Row ───────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 24 }}>
            {[
              { label: 'Students',    value: stats.totalUsers,            color: 'var(--cyan)',         icon: <Users size={16} />,        bg: 'rgba(34,211,238,0.07)' },
              { label: 'Coding Probs',value: stats.totalProblems,         color: 'var(--blue-light)',   icon: <Code2 size={16} />,        bg: 'rgba(59,130,246,0.07)' },
              { label: 'SQL Probs',   value: stats.totalDbms,             color: 'var(--cyan)',         icon: <Database size={16} />,     bg: 'rgba(34,211,238,0.05)' },
              { label: 'Submissions', value: stats.totalSubmissions,      color: 'var(--yellow)',       icon: <Zap size={16} />,          bg: 'rgba(245,158,11,0.07)' },
              { label: 'Accepted',    value: stats.acceptedSubmissions,   color: 'var(--green)',        icon: <CheckCircle2 size={16} />, bg: 'rgba(16,185,129,0.07)' },
            ].map((s, i) => (
              <div key={i} className="glass-card" style={{ padding: '14px 12px', background: s.bg, border: `1px solid ${s.color}20` }}>
                <div style={{ color: s.color, marginBottom: 5 }}>{s.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Plus Jakarta Sans, sans-serif', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Tab Bar ─────────────────────────────────────────── */}
          <div className="admin-tab-bar">
            {TABS.map(t => {
              const active = tab === t.id;
              const accent = tabAccent(t.id);
              return (
                <button key={t.id}
                  onClick={() => { setTab(t.id); setShowForm(false); setShowDbmsForm(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                    borderRadius: 10, border: 'none', cursor: 'pointer',
                    fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, fontSize: 12,
                    transition: 'all 0.22s ease',
                    background: active ? `linear-gradient(135deg,${accent}30,${accent}10)` : 'transparent',
                    color: active ? accent : 'var(--text-3)',
                    boxShadow: active ? '0 2px 12px rgba(0,0,0,0.2)' : 'none',
                  }}>
                  {t.icon} {t.label}
                  {t.count !== undefined && (
                    <span style={{ background: 'rgba(0,0,0,0.32)', borderRadius: 99, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{t.count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ══════════════ PROBLEMS TAB ══════════════ */}
          {tab === 'problems' && (
            <>
              {/* Notice 2 Sections Banner */}
              <div style={{
                marginBottom: 20, padding: '16px 20px',
                background: 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(56,189,248,0.03))',
                border: '1px solid rgba(59,130,246,0.3)', borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                        background: 'rgba(59,130,246,0.2)', color: 'var(--blue-light)',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        Track 1 of 2
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
                        Section 1: Algorithmic Coding Problems ({problems.length} Available)
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-2)', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                      Students solve these in Java, C, Python, or JavaScript with automated Judge0 testcases. For Database queries, manage <strong style={{ color: 'var(--cyan)' }}>Section 2: SQL &amp; DBMS Lab</strong>.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => { resetForm(); setShowForm(true); }}
                    >
                      <Plus size={13} /> Add Coding Problem
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      style={{ color: 'var(--cyan)', border: '1px solid rgba(34,211,238,0.3)' }}
                      onClick={() => { setTab('dbms'); resetDbmsForm(); }}
                    >
                      <Database size={13} /> Switch to SQL Section ({stats.totalDbms}) →
                    </button>
                  </div>
                </div>
              </div>
              {showForm && (
                <div className="glass-card" style={{ padding: 26, marginBottom: 28, border: '1px solid rgba(139,92,246,0.28)' }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
                    <h2 style={{ fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Edit3 size={16} color="var(--purple-light)" />
                      {editingId ? 'Edit Problem' : 'Add New Problem'}
                    </h2>
                    <button className="btn btn-ghost btn-sm" onClick={resetForm}><X size={13} /> Cancel</button>
                  </div>
                  <div className="admin-analytics-grid">
                    <div style={{ gridColumn: '1/-1' }}>
                      <label>Problem Title *</label>
                      <input className="input" placeholder="e.g. Two Sum" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                    </div>
                    <div>
                      <label>Difficulty *</label>
                      <select className="input" value={form.difficulty} onChange={e => setForm(p => ({ ...p, difficulty: e.target.value as any }))}>
                        <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                      </select>
                    </div>
                    <div>
                      <label>Category *</label>
                      <select className="input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                        {['Arrays','Strings','Math','Sorting','Dynamic Programming','Graphs','Trees','Recursion','Hashing','Binary Search','Stack/Queue','Linked List'].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label>Tags (comma separated)</label>
                      <input className="input" placeholder="array, hashmap, two-pointer" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label>Problem Description *</label>
                      <textarea className="input" rows={4} placeholder="Describe the problem clearly..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                    </div>
                    <div>
                      <label>Input Format</label>
                      <textarea className="input" rows={2} placeholder="First line contains N..." value={form.inputFormat} onChange={e => setForm(p => ({ ...p, inputFormat: e.target.value }))} />
                    </div>
                    <div>
                      <label>Output Format</label>
                      <textarea className="input" rows={2} placeholder="Print a single integer..." value={form.outputFormat} onChange={e => setForm(p => ({ ...p, outputFormat: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label>Constraints</label>
                      <textarea className="input" rows={2} placeholder="1 ≤ N ≤ 10^5" value={form.constraints} onChange={e => setForm(p => ({ ...p, constraints: e.target.value }))} />
                    </div>
                    {/* Examples */}
                    <div style={{ gridColumn: '1/-1' }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                        <label style={{ marginBottom: 0 }}>Examples</label>
                        <button className="btn btn-ghost btn-sm" onClick={() => setForm(p => ({ ...p, examples: [...p.examples, { input: '', output: '', explanation: '' }] }))}>
                          <Plus size={11} /> Add
                        </button>
                      </div>
                      {form.examples.map((ex, i) => (
                        <div key={i} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 10 }}>
                          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                            <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-2)' }}>Example {i + 1}</span>
                            {form.examples.length > 1 && (
                              <button className="btn btn-ghost btn-sm" onClick={() => setForm(p => ({ ...p, examples: p.examples.filter((_, j) => j !== i) }))}><Trash2 size={11} /></button>
                            )}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
                            <div><label style={{ fontSize: 10 }}>Input</label>
                              <textarea className="input" rows={2} style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }} value={ex.input}
                                onChange={e => setForm(p => ({ ...p, examples: p.examples.map((x, j) => j === i ? { ...x, input: e.target.value } : x) }))} /></div>
                            <div><label style={{ fontSize: 10 }}>Output</label>
                              <textarea className="input" rows={2} style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }} value={ex.output}
                                onChange={e => setForm(p => ({ ...p, examples: p.examples.map((x, j) => j === i ? { ...x, output: e.target.value } : x) }))} /></div>
                          </div>
                          <input className="input" placeholder="Explanation (optional)" value={ex.explanation}
                            onChange={e => setForm(p => ({ ...p, examples: p.examples.map((x, j) => j === i ? { ...x, explanation: e.target.value } : x) }))} />
                        </div>
                      ))}
                    </div>
                    {/* Test Cases */}
                    <div style={{ gridColumn: '1/-1' }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                        <label style={{ marginBottom: 0 }}>Hidden Test Cases</label>
                        <button className="btn btn-ghost btn-sm" onClick={() => setForm(p => ({ ...p, testCases: [...p.testCases, { input: '', expectedOutput: '' }] }))}>
                          <Plus size={11} /> Add
                        </button>
                      </div>
                      {form.testCases.map((tc, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 34px', gap: 8, marginBottom: 8, alignItems: 'start' }}>
                          <div>
                            {i === 0 && <label style={{ fontSize: 10 }}>Input</label>}
                            <textarea className="input" rows={2} style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }} value={tc.input}
                              onChange={e => setForm(p => ({ ...p, testCases: p.testCases.map((t, j) => j === i ? { ...t, input: e.target.value } : t) }))} />
                          </div>
                          <div>
                            {i === 0 && <label style={{ fontSize: 10 }}>Expected Output</label>}
                            <textarea className="input" rows={2} style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }} value={tc.expectedOutput}
                              onChange={e => setForm(p => ({ ...p, testCases: p.testCases.map((t, j) => j === i ? { ...t, expectedOutput: e.target.value } : t) }))} />
                          </div>
                          {form.testCases.length > 1 && (
                            <button className="btn btn-ghost btn-sm" style={{ marginTop: i === 0 ? 20 : 0 }}
                              onClick={() => setForm(p => ({ ...p, testCases: p.testCases.filter((_, j) => j !== i) }))}><Trash2 size={11} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Starter Code */}
                    <div style={{ gridColumn: '1/-1' }}>
                      <label>Starter Code Templates</label>
                      {(['java', 'c', 'python', 'javascript'] as const).map(l => (
                        <div key={l} style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 10, color: l === 'java' ? 'var(--yellow)' : l === 'c' ? 'var(--cyan)' : l === 'python' ? 'var(--green)' : 'var(--pink)' }}>{l.toUpperCase()}</label>
                          <textarea className="input" rows={4} style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}
                            value={form.starterCode[l]} onChange={e => setForm(p => ({ ...p, starterCode: { ...p.starterCode, [l]: e.target.value } }))} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 size={13} style={{ animation: 'spin-slow 0.8s linear infinite' }} /> : <Save size={13} />}
                      {editingId ? 'Update Problem' : 'Publish Problem'}
                    </button>
                    <button className="btn btn-ghost" onClick={resetForm}>Cancel</button>
                  </div>
                </div>
              )}
              {loading
                ? <div className="flex justify-center" style={{ padding: 60 }}><div className="spinner" /></div>
                : problems.length === 0
                  ? <div style={{ textAlign: 'center', padding: '70px 0', color: 'var(--text-3)' }}>
                    <BookOpen size={44} style={{ marginBottom: 14, opacity: 0.25 }} />
                    <p style={{ fontSize: 17 }}>No problems yet 🚀</p>
                  </div>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {problems.map(p => {
                      const dc = p.difficulty === 'easy' ? 'diff-easy' : p.difficulty === 'medium' ? 'diff-medium' : 'diff-hard';
                      return (
                        <div key={p.id} className="glass-card" style={{ padding: '14px 18px' }}>
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-3 flex-1">
                              <span className={`badge ${dc}`} style={{ flexShrink: 0 }}>{p.difficulty}</span>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.title}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{p.category} • {p.solvedCount || 0} solved • by {p.addedBy}</div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(p)}><Edit3 size={12} /> Edit</button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id, p.title)}><Trash2 size={12} /> Del</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
              }
            </>
          )}

          {/* ══════════════ DBMS TAB ══════════════ */}
          {tab === 'dbms' && (
            <>
              {!showDbmsForm && (
                <div style={{
                  marginBottom: 20, padding: '16px 20px',
                  background: 'linear-gradient(135deg, rgba(34,211,238,0.08), rgba(6,182,212,0.02))',
                  border: '1px solid rgba(34,211,238,0.28)', borderRadius: 'var(--radius-md)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                          background: 'rgba(34,211,238,0.2)', color: 'var(--cyan)',
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                          Track 2 of 2
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
                          Section 2: SQL Queries &amp; DBMS Lab ({dbmsQuestions.length} Questions)
                        </span>
                      </div>
                      <p style={{ color: 'var(--text-2)', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                        Manage SQL query tasks, normalization exercises, and schema evaluation for college labs.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-sm"
                        style={{ background: 'linear-gradient(135deg,var(--cyan),#0891b2)', color: '#000', fontWeight: 700 }}
                        onClick={() => { resetDbmsForm(); setShowDbmsForm(true); }}
                      >
                        <Plus size={13} /> Add SQL Question
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        style={{ color: 'var(--blue-light)', border: '1px solid rgba(59,130,246,0.3)' }}
                        onClick={() => { setTab('problems'); resetForm(); }}
                      >
                        <Code2 size={13} /> ← Switch to Coding Section ({stats.totalProblems})
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {showDbmsForm && (
                <div className="glass-card" style={{ padding: 26, marginBottom: 28, border: '1px solid rgba(34,211,238,0.28)' }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
                    <h2 style={{ fontWeight: 700, fontSize: 18, color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Database size={17} /> {editingDbmsId ? 'Edit DBMS Question' : 'Add DBMS Question'}
                    </h2>
                    <button className="btn btn-ghost btn-sm" onClick={resetDbmsForm}><X size={13} /> Cancel</button>
                  </div>
                  <div className="admin-analytics-grid">
                    <div style={{ gridColumn: '1/-1' }}>
                      <label>Question Title *</label>
                      <input className="input" placeholder="e.g. Find employees with salary > 50000"
                        value={dbmsForm.title} onChange={e => setDbmsForm(p => ({ ...p, title: e.target.value }))} />
                    </div>
                    <div>
                      <label>Topic *</label>
                      <select className="input" value={dbmsForm.topic} onChange={e => setDbmsForm(p => ({ ...p, topic: e.target.value }))}>
                        {DBMS_TOPICS.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>Type *</label>
                      <select className="input" value={dbmsForm.type} onChange={e => setDbmsForm(p => ({ ...p, type: e.target.value as any }))}>
                        <option value="query">🔍 SQL Query</option>
                        <option value="theory">📖 Theory / Concept</option>
                        <option value="normalization">🗂️ Normalization</option>
                        <option value="design">🏗️ Schema Design</option>
                      </select>
                    </div>
                    <div>
                      <label>Difficulty *</label>
                      <select className="input" value={dbmsForm.difficulty} onChange={e => setDbmsForm(p => ({ ...p, difficulty: e.target.value as any }))}>
                        <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label>Description *</label>
                      <textarea className="input" rows={4} placeholder="Describe the DBMS problem clearly..."
                        value={dbmsForm.description} onChange={e => setDbmsForm(p => ({ ...p, description: e.target.value }))} />
                    </div>

                    {/* ── Easy Table Uploader for Admin/Super Admin ── */}
                    <div style={{ gridColumn: '1/-1' }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                        <div className="flex items-center gap-2">
                          <Table2 size={14} color="var(--cyan)" />
                          <label style={{ marginBottom: 0 }}>
                            Sample Tables <span style={{ fontSize: 10, color: 'var(--text-3)' }}>(add rows, see live preview)</span>
                          </label>
                        </div>
                        <button className="btn btn-ghost btn-sm"
                          onClick={() => setDbmsForm(p => ({ ...p, tableData: [...(p.tableData || []), { name: '', columns: 'id, name', rows: '1, Alice\n2, Bob' }] }))}>
                          <Plus size={11} /> Add Table
                        </button>
                      </div>
                      {(dbmsForm.tableData || []).map((tbl, ti) => (
                        <div key={ti} style={{ background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.18)', borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 10 }}>
                          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: 'var(--cyan)', fontWeight: 600 }}>
                              📊 Table {ti + 1} {tbl.name && `— ${tbl.name}`}
                            </span>
                            {(dbmsForm.tableData || []).length > 1 && (
                              <button className="btn btn-ghost btn-sm"
                                onClick={() => setDbmsForm(p => ({ ...p, tableData: (p.tableData || []).filter((_, j) => j !== ti) }))}>
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, marginBottom: 8 }}>
                            <div>
                              <label style={{ fontSize: 10 }}>Table Name</label>
                              <input className="input" style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }} placeholder="Employee"
                                value={tbl.name}
                                onChange={e => setDbmsForm(p => ({ ...p, tableData: (p.tableData || []).map((t, j) => j === ti ? { ...t, name: e.target.value } : t) }))} />
                            </div>
                            <div>
                              <label style={{ fontSize: 10 }}>Columns (comma-separated)</label>
                              <input className="input" style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }} placeholder="emp_id, name, salary"
                                value={tbl.columns}
                                onChange={e => setDbmsForm(p => ({ ...p, tableData: (p.tableData || []).map((t, j) => j === ti ? { ...t, columns: e.target.value } : t) }))} />
                            </div>
                          </div>
                          <label style={{ fontSize: 10 }}>Rows (one row per line, values comma-separated)</label>
                          <textarea className="input" rows={4} style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}
                            placeholder={"1, Alice, 75000\n2, Bob, 45000\n3, Carol, 90000"}
                            value={tbl.rows}
                            onChange={e => setDbmsForm(p => ({ ...p, tableData: (p.tableData || []).map((t, j) => j === ti ? { ...t, rows: e.target.value } : t) }))} />

                          {/* Live Preview Table */}
                          {tbl.columns && tbl.rows && (
                            <div style={{ marginTop: 10, overflowX: 'auto' }}>
                              <p style={{ fontSize: 10, color: 'var(--cyan)', marginBottom: 5, fontWeight: 600 }}>
                                👁️ PREVIEW: {tbl.name || 'Table'}
                              </p>
                              <table style={{ fontSize: 11, fontFamily: 'JetBrains Mono,monospace', borderCollapse: 'collapse', minWidth: '100%' }}>
                                <thead>
                                  <tr>
                                    {parseColumns(tbl.columns).map((col, ci) => (
                                      <th key={ci} style={{ background: 'rgba(34,211,238,0.14)', padding: '4px 10px', borderBottom: '1px solid rgba(34,211,238,0.2)', textAlign: 'left', color: 'var(--cyan)', whiteSpace: 'nowrap', fontSize: 11 }}>
                                        {col}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {parseRows(tbl.rows).map((row, ri) => (
                                    <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                      {parseRowCells(row).map((cell, ci) => (
                                        <td key={ci} style={{ padding: '3px 10px', color: 'var(--text-2)', fontSize: 11 }}>{cell}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div style={{ gridColumn: '1/-1' }}>
                      <label>SQL CREATE Schema <span style={{ fontSize: 10, color: 'var(--text-3)' }}>(optional)</span></label>
                      <textarea className="input" rows={5} style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}
                        placeholder={"CREATE TABLE Employee (\n  emp_id INT PRIMARY KEY,\n  name VARCHAR(50),\n  salary DECIMAL(10,2)\n);"}
                        value={dbmsForm.sampleSchema} onChange={e => setDbmsForm(p => ({ ...p, sampleSchema: e.target.value }))} />
                    </div>

                    <div style={{ gridColumn: '1/-1' }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                        <label style={{ marginBottom: 0 }}>Reference SQL Query <span style={{ fontSize: 10, color: 'var(--text-3)' }}>(🔒 hidden from students)</span></label>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowAnswer(!showAnswer)}>
                          {showAnswer ? <EyeOff size={11} /> : <Eye size={11} />} {showAnswer ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <textarea className="input" rows={4}
                        style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12, filter: showAnswer ? 'none' : 'blur(4px)', transition: 'filter 0.2s ease' }}
                        placeholder="SELECT name, salary FROM Employee WHERE salary > 50000 ORDER BY salary DESC;"
                        value={dbmsForm.expectedQuery} onChange={e => setDbmsForm(p => ({ ...p, expectedQuery: e.target.value }))} />
                      <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>🔒 For admin reference only. Students submit output, not this query.</p>
                    </div>

                    {/* Expected Output — this is what students must match */}
                    <div style={{ gridColumn: '1/-1' }}>
                      <label>Expected Output <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700 }}>★ REQUIRED for grading</span></label>
                      <div style={{ padding:'8px 12px', background:'rgba(34,211,238,0.06)', border:'1px solid rgba(34,211,238,0.22)', borderRadius:8, marginBottom:8, fontSize:11, color:'var(--text-2)' }}>
                        💡 Paste the exact output that students must match. Comparison is case-insensitive and whitespace-normalized. E.g:
                        <pre style={{ margin:'6px 0 0', fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'var(--cyan)' }}>{"Alice | 75000\nBob   | 90000"}</pre>
                      </div>
                      <textarea className="input" rows={5}
                        style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}
                        placeholder={"Paste exact expected output here...\nExample:\nAlice | 75000\nBob | 90000"}
                        value={(dbmsForm as any).expectedOutput || ''}
                        onChange={e => setDbmsForm(p => ({ ...p, expectedOutput: e.target.value }))} />
                      <p style={{ fontSize: 10, color: 'var(--cyan)', marginTop: 3 }}>✅ Students must match this output exactly (case/whitespace insensitive) to earn points.</p>
                    </div>

                    <div style={{ gridColumn: '1/-1' }}>
                      <label>Hint <span style={{ fontSize: 10, color: 'var(--text-3)' }}>(shown on student request)</span></label>
                      <textarea className="input" rows={2} placeholder="Think about which SQL clause filters rows..."
                        value={dbmsForm.hint} onChange={e => setDbmsForm(p => ({ ...p, hint: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label>Explanation / Walkthrough <span style={{ fontSize: 10, color: 'var(--text-3)' }}>(optional)</span></label>
                      <textarea className="input" rows={3} placeholder="Step-by-step solution explanation..."
                        value={dbmsForm.explanation} onChange={e => setDbmsForm(p => ({ ...p, explanation: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                    <button className="btn"
                      style={{ background: 'linear-gradient(135deg,var(--cyan),#0891b2)', color: '#000', boxShadow: '0 4px 16px rgba(34,211,238,0.32)', fontWeight: 700 }}
                      onClick={handleDbmsSave} disabled={savingDbms}>
                      {savingDbms ? <Loader2 size={13} style={{ animation: 'spin-slow 0.8s linear infinite' }} /> : <Save size={13} />}
                      {editingDbmsId ? 'Update Question' : 'Publish Question'}
                    </button>
                    <button className="btn btn-ghost" onClick={resetDbmsForm}>Cancel</button>
                  </div>
                </div>
              )}

              {loading
                ? <div className="flex justify-center" style={{ padding: 60 }}><div className="spinner" /></div>
                : dbmsQuestions.length === 0 && !showDbmsForm
                  ? <div style={{ textAlign: 'center', padding: '70px 0', color: 'var(--text-3)' }}>
                    <Database size={52} style={{ marginBottom: 14, opacity: 0.2 }} />
                    <p style={{ fontSize: 17, marginBottom: 8 }}>No DBMS questions yet! 🗄️</p>
                    <button className="btn"
                      style={{ marginTop: 14, background: 'linear-gradient(135deg,var(--cyan),#0891b2)', color: '#000' }}
                      onClick={() => { resetDbmsForm(); setShowDbmsForm(true); }}>
                      <Plus size={13} /> Add First Question
                    </button>
                  </div>
                  : !showDbmsForm && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {dbmsQuestions.length > 0 && (
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 5 }}>
                          {Array.from(new Set(dbmsQuestions.map(q => q.topic))).map(topic => (
                            <span key={topic} style={{ fontSize: 10, color: 'var(--cyan)', background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.16)', borderRadius: 99, padding: '2px 9px' }}>
                              {topic} ({dbmsQuestions.filter(q => q.topic === topic).length})
                            </span>
                          ))}
                        </div>
                      )}
                      {dbmsQuestions.map(q => {
                        const dc = q.difficulty === 'easy' ? 'diff-easy' : q.difficulty === 'medium' ? 'diff-medium' : 'diff-hard';
                        return (
                          <div key={q.id} className="glass-card" style={{ padding: '15px 18px', border: '1px solid rgba(34,211,238,0.1)' }}>
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                              <div className="flex items-center gap-3 flex-1" style={{ minWidth: 0 }}>
                                <span style={{ fontSize: 18, flexShrink: 0 }}>{typeIcon(q.type)}</span>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{q.title}</div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`badge ${dc}`}>{q.difficulty}</span>
                                    <span className={`badge ${typeColor(q.type)}`}>{q.type}</span>
                                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>📚 {q.topic}</span>
                                    {q.tableData && q.tableData.some(t => t.name) && (
                                      <span style={{ fontSize: 10, color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <Table2 size={9} /> {q.tableData.filter(t => t.name).length} table(s)
                                      </span>
                                    )}
                                    {q.addedBy && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>· by {q.addedBy}</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2" style={{ flexShrink: 0 }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => handleDbmsEdit(q)}><Edit3 size={11} /> Edit</button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDbmsDelete(q.id, q.title)}><Trash2 size={11} /> Del</button>
                              </div>
                            </div>
                            {q.description && (
                              <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-2)', borderTop: '1px solid var(--border)', paddingTop: 8, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                {q.description}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
              }
            </>
          )}

          {/* ══════════════ SUBMISSIONS TAB ══════════════ */}
          {tab === 'submissions' && (
            <div>
              {/* DBMS Submissions */}
              <div className="glass-card" style={{ overflow:'hidden', padding:0, marginBottom:20 }}>
                <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  <Database size={15} color="var(--cyan)"/>
                  <span style={{ fontWeight:700, fontSize:14 }}>DBMS Submissions & Lab Assessments</span>
                  <span style={{ fontSize:11, color:'var(--yellow)', background:'rgba(245,158,11,0.1)', padding:'2px 8px', borderRadius:99, border:'1px solid rgba(245,158,11,0.25)' }}>
                    {dbmsSubmissions.filter((s:any)=>s.status==='pending').length} pending review
                  </span>
                  <span style={{ fontSize:11, color:'var(--text-3)', marginLeft:'auto' }}>{dbmsSubmissions.length} total</span>
                </div>
                {dbmsSubmissions.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-3)' }}><p>No DBMS submissions yet.</p></div>
                ) : (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', minWidth:920 }}>
                      <thead><tr>
                        <th>Student</th>
                        <th>Question & Topic</th>
                        <th>Diff</th>
                        <th>Student SQL Query</th>
                        <th>Status</th>
                        <th>Pts</th>
                        <th>Faculty Remarks</th>
                        <th>Grade / Test</th>
                        <th>Del</th>
                      </tr></thead>
                      <tbody>
                        {dbmsSubmissions.map((s: any) => {
                          const qObj = dbmsQuestions.find(q => q.id === s.questionId);
                          const qTitle = qObj?.title || s.questionTitle || 'DBMS Question';
                          const qTopic = qObj?.topic || s.topic || 'SQL';
                          const qDiff = qObj?.difficulty || s.difficulty || 'easy';

                          return (
                            <tr key={s.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)', background: s.status==='pending'?'rgba(245,158,11,0.03)':undefined }}>
                              <td>
                                <div style={{ fontWeight:600, fontSize:13 }}>{s.userName}</div>
                                <div style={{ fontSize:10, color:'var(--text-3)' }}>{s.userEmail}</div>
                              </td>
                              <td style={{ maxWidth:200 }}>
                                <div style={{ fontWeight:600, fontSize:13, color:'var(--text-1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={qTitle}>
                                  {qTitle}
                                </div>
                                <div className="flex items-center gap-1" style={{ marginTop:2 }}>
                                  <span style={{ fontSize:10, color:'var(--cyan)', background:'rgba(34,211,238,0.08)', padding:'1px 6px', borderRadius:4 }}>{qTopic}</span>
                                  {qObj?.tableData && qObj.tableData.length > 0 && (
                                    <span style={{ fontSize:9, color:'var(--text-3)' }}>({qObj.tableData.length} tbl)</span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <span className={`badge ${qDiff==='easy'?'diff-easy':qDiff==='medium'?'diff-medium':'diff-hard'}`}>{qDiff}</span>
                              </td>
                              <td style={{ maxWidth:240 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => openDbmsInspector(s)}
                                    style={{ fontSize:11, padding:'4px 8px', color:'var(--cyan)', border:'1px solid rgba(34,211,238,0.25)', display:'flex', alignItems:'center', gap:4 }}
                                    title="Open interactive SQLite test bench">
                                    <Play size={10} /> Test in SQLite
                                  </button>
                                  <details style={{ cursor:'pointer' }}>
                                    <summary style={{ fontSize:10, color:'var(--text-3)', cursor:'pointer' }}>Code</summary>
                                    <pre style={{ fontSize:11, fontFamily:'JetBrains Mono,monospace', color:'var(--text-1)', background:'rgba(0,0,0,0.5)', padding:'8px 10px', borderRadius:6, marginTop:4, maxHeight:110, overflow:'auto', whiteSpace:'pre-wrap', border:'1px solid rgba(34,211,238,0.12)' }}>
                                      {s.userQuery || s.userOutput || '(no query)'}
                                    </pre>
                                  </details>
                                </div>
                              </td>
                              <td>
                                <span style={{ fontWeight:700, fontSize:11,
                                  padding:'3px 8px', borderRadius:6,
                                  background: s.status==='pass'?'rgba(16,185,129,0.1)':s.status==='fail'?'rgba(239,68,68,0.1)':'rgba(245,158,11,0.1)',
                                  color: s.status==='pass'?'var(--green)':s.status==='fail'?'var(--red)':'var(--yellow)',
                                  border: `1px solid ${s.status==='pass'?'rgba(16,185,129,0.3)':s.status==='fail'?'rgba(239,68,68,0.3)':'rgba(245,158,11,0.3)'}` }}>
                                  {s.status==='pass' ? '✅ Pass' : s.status==='fail' ? '❌ Fail' : '⏳ Pending'}
                                </span>
                              </td>
                              <td style={{ fontWeight:700, color:'var(--yellow)', fontSize:13 }}>{s.points || 0}</td>
                              <td style={{ maxWidth:220 }}>
                                {editingRemarksSubId === s.id ? (
                                  <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                                    <input
                                      className="input"
                                      style={{ fontSize:11, padding:'3px 8px' }}
                                      value={inlineRemarksDraft}
                                      placeholder="Add remarks..."
                                      onChange={e => setInlineRemarksDraft(e.target.value)}
                                    />
                                    <button
                                      className="btn btn-sm"
                                      style={{ background:'var(--cyan)', color:'#000', padding:'2px 6px', fontSize:10 }}
                                      onClick={() => saveAdminRemarksOnly(s.id, inlineRemarksDraft)}>
                                      Save
                                    </button>
                                    <button
                                      className="btn btn-ghost btn-sm"
                                      style={{ padding:'2px 5px', fontSize:10 }}
                                      onClick={() => setEditingRemarksSubId(null)}>
                                      <X size={10} />
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                    {s.adminRemarks ? (
                                      <span style={{ fontSize:11, color:'var(--text-2)', fontStyle:'italic', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:170 }} title={s.adminRemarks}>
                                        💬 "{s.adminRemarks}"
                                      </span>
                                    ) : (
                                      <span style={{ fontSize:11, color:'var(--text-3)' }}>No remarks</span>
                                    )}
                                    <button
                                      className="btn btn-ghost btn-sm"
                                      style={{ padding:'2px 4px', color:'var(--text-3)' }}
                                      title="Edit remarks"
                                      onClick={() => {
                                        setEditingRemarksSubId(s.id);
                                        setInlineRemarksDraft(s.adminRemarks || '');
                                      }}>
                                      <Edit3 size={10} />
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td>
                                <div style={{ display:'flex', gap:4 }}>
                                  <button
                                    className="btn btn-sm"
                                    onClick={() => openDbmsInspector(s)}
                                    style={{ background:'rgba(34,211,238,0.12)', color:'var(--cyan)', border:'1px solid rgba(34,211,238,0.3)', padding:'4px 8px', fontSize:11 }}
                                    title="Open live test bench & grade">
                                    <Terminal size={11} /> Test & Grade
                                  </button>
                                  {s.status === 'pending' && (
                                    <>
                                      <button
                                        className="btn btn-sm"
                                        disabled={gradingId === s.id}
                                        style={{ background:'rgba(16,185,129,0.15)', color:'var(--green)', border:'1px solid rgba(16,185,129,0.3)', padding:'4px 7px' }}
                                        onClick={() => gradeDbmsSubmission(s, 'pass')}
                                        title="Quick Pass">
                                        {gradingId===s.id ? <Loader2 size={10} style={{animation:'spin-slow 0.8s linear infinite'}}/> : <ThumbsUp size={11}/>}
                                      </button>
                                      <button
                                        className="btn btn-sm"
                                        disabled={gradingId === s.id}
                                        style={{ background:'rgba(239,68,68,0.12)', color:'var(--red)', border:'1px solid rgba(239,68,68,0.28)', padding:'4px 7px' }}
                                        onClick={() => gradeDbmsSubmission(s, 'fail')}
                                        title="Quick Fail">
                                        {gradingId===s.id ? <Loader2 size={10} style={{animation:'spin-slow 0.8s linear infinite'}}/> : <ThumbsDown size={11}/>}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                              <td>
                                <button className="btn btn-danger btn-sm" disabled={deletingSubId === s.id} onClick={() => deleteDbmsSubmission(s.id)}>
                                  <Trash2 size={11}/>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ── Admin Live DBMS Inspector & Evaluation Modal ── */}
              {inspectingSub && (() => {
                const sub = inspectingSub;
                const q = dbmsQuestions.find(x => x.id === sub.questionId);
                const qTitle = q?.title || sub.questionTitle || 'DBMS Question';
                const qTopic = q?.topic || sub.topic || 'SQL';
                const qDiff = q?.difficulty || sub.difficulty || 'easy';
                const pts = DBMS_POINTS[qDiff] ?? 10;

                return (
                  <div style={{
                    position:'fixed', top:0, left:0, right:0, bottom:0,
                    background:'rgba(3,7,18,0.85)', backdropFilter:'blur(8px)',
                    zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16
                  }}>
                    <div className="glass-card" style={{
                      width:'100%', maxWidth:980, maxHeight:'92vh', overflowY:'auto',
                      border:'1px solid rgba(34,211,238,0.3)', boxShadow:'0 20px 60px rgba(0,0,0,0.8)',
                      padding:24, display:'flex', flexDirection:'column', gap:18
                    }}>
                      {/* Modal Header */}
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', borderBottom:'1px solid var(--border)', paddingBottom:14 }}>
                        <div>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                            <span style={{ fontSize:10, fontWeight:700, color:'var(--cyan)', background:'rgba(34,211,238,0.1)', padding:'2px 8px', borderRadius:4, border:'1px solid rgba(34,211,238,0.25)' }}>
                              DBMS LAB INSPECTOR
                            </span>
                            <span className={`badge ${qDiff==='easy'?'diff-easy':qDiff==='medium'?'diff-medium':'diff-hard'}`}>{qDiff}</span>
                            <span style={{ fontSize:11, color:'var(--text-3)' }}>📚 {qTopic}</span>
                            <span style={{ fontSize:11, color:'var(--yellow)', fontWeight:700 }}>+{pts} pts</span>
                          </div>
                          <h2 style={{ fontSize:20, fontWeight:800, margin:0, color:'var(--text-1)' }}>{qTitle}</h2>
                          <p style={{ fontSize:12, color:'var(--text-3)', margin:'3px 0 0' }}>
                            Student: <strong style={{ color:'var(--text-1)' }}>{sub.userName}</strong> ({sub.userEmail}) · Submitted query evaluation
                          </p>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => setInspectingSub(null)} style={{ padding:'6px 10px' }}>
                          <X size={16} />
                        </button>
                      </div>

                      {/* Question Description & Context */}
                      {q?.description && (
                        <div style={{ background:'rgba(34,211,238,0.04)', border:'1px solid rgba(34,211,238,0.15)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'var(--text-2)', lineHeight:1.6 }}>
                          <strong style={{ color:'var(--cyan)', display:'block', marginBottom:2 }}>Problem Prompt:</strong>
                          {q.description}
                        </div>
                      )}

                      {/* Sample Tables Preview */}
                      {q?.tableData && q.tableData.length > 0 && (
                        <div style={{ background:'rgba(0,0,0,0.25)', border:'1px solid var(--border)', borderRadius:8, padding:12 }}>
                          <span style={{ fontSize:11, fontWeight:700, color:'var(--cyan)', display:'flex', alignItems:'center', gap:4, marginBottom:6 }}>
                            <Table2 size={12} /> Test Database Tables Available: {q.tableData.map(t => t.name).filter(Boolean).join(', ')}
                          </span>
                          <div style={{ display:'flex', gap:10, overflowX:'auto' }}>
                            {q.tableData.map((t, ti) => (
                              <div key={ti} style={{ background:'rgba(34,211,238,0.06)', border:'1px solid rgba(34,211,238,0.16)', borderRadius:6, padding:'6px 10px', fontSize:11, minWidth:140 }}>
                                <strong style={{ color:'var(--text-1)' }}>{t.name}</strong>
                                <div style={{ fontSize:10, color:'var(--text-3)', fontFamily:'monospace' }}>{t.columns}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Side-by-Side: Student Query vs Reference Expected Query */}
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(420px, 1fr))', gap:16 }}>
                        {/* Student Query Box */}
                        <div style={{ background:'rgba(0,0,0,0.4)', border:'1px solid rgba(34,211,238,0.2)', borderRadius:10, padding:14, display:'flex', flexDirection:'column', gap:10 }}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                            <span style={{ fontSize:12, fontWeight:700, color:'var(--cyan)', display:'flex', alignItems:'center', gap:5 }}>
                              <Code2 size={13} /> Student's Submitted Query
                            </span>
                            <button
                              className="btn btn-sm"
                              disabled={runningStudentSql}
                              onClick={() => runStudentSqlInModal(sub)}
                              style={{ background:'linear-gradient(135deg,var(--cyan),#0891b2)', color:'#000', fontWeight:700, fontSize:11, padding:'4px 10px', display:'flex', alignItems:'center', gap:4 }}>
                              {runningStudentSql ? <Loader2 size={11} style={{ animation:'spin-slow 0.8s linear infinite' }} /> : <Play size={11} />}
                              Run in SQLite
                            </button>
                          </div>
                          <pre style={{
                            fontSize:12, fontFamily:'JetBrains Mono,monospace', background:'rgba(0,0,0,0.6)',
                            padding:10, borderRadius:6, color:'var(--text-1)', maxHeight:130, overflow:'auto',
                            margin:0, border:'1px solid rgba(255,255,255,0.06)', whiteSpace:'pre-wrap'
                          }}>
                            {sub.userQuery || sub.userOutput || '(no query provided)'}
                          </pre>

                          {/* Student Query SQLite Output */}
                          {studentQueryResult && (
                            <div style={{ marginTop:4, borderTop:'1px solid rgba(34,211,238,0.15)', paddingTop:8 }}>
                              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                                <span style={{ fontSize:11, fontWeight:700, color: studentQueryResult.success ? 'var(--green)' : 'var(--red)' }}>
                                  {studentQueryResult.success ? `✓ Output (${studentQueryResult.executionTimeMs}ms, ${studentQueryResult.values.length} rows)` : '✕ SQLite Error'}
                                </span>
                              </div>
                              {studentQueryResult.success ? (
                                studentQueryResult.columns.length === 0 ? (
                                  <div style={{ fontSize:11, color:'var(--text-3)' }}>Query returned 0 rows / no columns.</div>
                                ) : (
                                  <div style={{ maxHeight:160, overflow:'auto', border:'1px solid rgba(255,255,255,0.06)', borderRadius:6 }}>
                                    <table style={{ width:'100%', fontSize:11, fontFamily:'JetBrains Mono,monospace', borderCollapse:'collapse' }}>
                                      <thead>
                                        <tr style={{ background:'rgba(34,211,238,0.15)' }}>
                                          {studentQueryResult.columns.map((c, ci) => (
                                            <th key={ci} style={{ padding:'4px 8px', textAlign:'left', color:'var(--cyan)', borderBottom:'1px solid rgba(34,211,238,0.2)' }}>{c}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {studentQueryResult.values.map((row, ri) => (
                                          <tr key={ri} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                                            {row.map((cell, ci) => (
                                              <td key={ci} style={{ padding:'3px 8px', color:'var(--text-2)' }}>{String(cell ?? 'NULL')}</td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )
                              ) : (
                                <pre style={{ color:'var(--red)', fontSize:11, fontFamily:'monospace', margin:0, whiteSpace:'pre-wrap' }}>
                                  {studentQueryResult.error}
                                </pre>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Reference / Expected Solution (How it was done) */}
                        <div style={{ background:'rgba(0,0,0,0.4)', border:'1px solid rgba(139,92,246,0.25)', borderRadius:10, padding:14, display:'flex', flexDirection:'column', gap:10 }}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                            <span style={{ fontSize:12, fontWeight:700, color:'var(--purple-light)', display:'flex', alignItems:'center', gap:5 }}>
                              <BookOpen size={13} /> Reference Solution (How it is done)
                            </span>
                            {q?.expectedQuery && (
                              <button
                                className="btn btn-sm"
                                disabled={runningExpectedSql}
                                onClick={() => runExpectedSqlInModal(sub)}
                                style={{ background:'rgba(139,92,246,0.2)', color:'var(--purple-light)', border:'1px solid rgba(139,92,246,0.4)', fontWeight:600, fontSize:11, padding:'4px 10px', display:'flex', alignItems:'center', gap:4 }}>
                                {runningExpectedSql ? <Loader2 size={11} style={{ animation:'spin-slow 0.8s linear infinite' }} /> : <Play size={11} />}
                                Run Reference
                              </button>
                            )}
                          </div>

                          <pre style={{
                            fontSize:12, fontFamily:'JetBrains Mono,monospace', background:'rgba(0,0,0,0.6)',
                            padding:10, borderRadius:6, color:'var(--text-1)', maxHeight:130, overflow:'auto',
                            margin:0, border:'1px solid rgba(139,92,246,0.15)', whiteSpace:'pre-wrap'
                          }}>
                            {q?.expectedQuery || '(No reference expected query configured for this problem)'}
                          </pre>

                          {q?.explanation && (
                            <div style={{ fontSize:11, color:'var(--text-2)', background:'rgba(139,92,246,0.06)', padding:'6px 10px', borderRadius:6, lineHeight:1.5 }}>
                              <strong style={{ color:'var(--purple-light)' }}>Explanation:</strong> {q.explanation}
                            </div>
                          )}

                          {/* Reference Query SQLite Output */}
                          {expectedQueryResult && (
                            <div style={{ marginTop:4, borderTop:'1px solid rgba(139,92,246,0.15)', paddingTop:8 }}>
                              <span style={{ fontSize:11, fontWeight:700, color: expectedQueryResult.success ? 'var(--green)' : 'var(--red)', display:'block', marginBottom:4 }}>
                                {expectedQueryResult.success ? `✓ Reference Output (${expectedQueryResult.executionTimeMs}ms, ${expectedQueryResult.values.length} rows)` : '✕ Error'}
                              </span>
                              {expectedQueryResult.success && expectedQueryResult.columns.length > 0 && (
                                <div style={{ maxHeight:140, overflow:'auto', border:'1px solid rgba(255,255,255,0.06)', borderRadius:6 }}>
                                  <table style={{ width:'100%', fontSize:11, fontFamily:'JetBrains Mono,monospace', borderCollapse:'collapse' }}>
                                    <thead>
                                      <tr style={{ background:'rgba(139,92,246,0.15)' }}>
                                        {expectedQueryResult.columns.map((c, ci) => (
                                          <th key={ci} style={{ padding:'4px 8px', textAlign:'left', color:'var(--purple-light)', borderBottom:'1px solid rgba(139,92,246,0.2)' }}>{c}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {expectedQueryResult.values.map((row, ri) => (
                                        <tr key={ri} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                                          {row.map((cell, ci) => (
                                            <td key={ci} style={{ padding:'3px 8px', color:'var(--text-2)' }}>{String(cell ?? 'NULL')}</td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Faculty Remarks Input */}
                      <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)', borderRadius:10, padding:14 }}>
                        <label style={{ fontSize:12, fontWeight:700, color:'var(--yellow)', display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                          <MessageSquare size={13} /> Faculty Remarks & Feedback for Student:
                        </label>
                        <p style={{ fontSize:11, color:'var(--text-3)', margin:'0 0 8px' }}>
                          These remarks will be visible to <strong>{sub.userName}</strong> in their SQL Lab page and Submission History so they can learn or revise.
                        </p>
                        <textarea
                          className="input"
                          rows={3}
                          style={{ fontSize:12, fontFamily:'Plus Jakarta Sans, sans-serif' }}
                          placeholder="e.g. Excellent query structure! Or: Your query failed to filter active employees, please check WHERE condition."
                          value={adminRemarksDraft}
                          onChange={e => setAdminRemarksDraft(e.target.value)}
                        />
                        {/* Quick preset remarks */}
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                          {[
                            'Well done! Accurate and optimized SQL query.',
                            'Needs Revision: Incorrect WHERE clause condition.',
                            'Needs Revision: Missing required column aliases or ordering.',
                            'Syntax Error in SQL statement. Please test before submitting.',
                          ].map((remark, ri) => (
                            <button
                              key={ri}
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize:10, padding:'2px 8px', color:'var(--text-3)', border:'1px solid rgba(255,255,255,0.08)' }}
                              onClick={() => setAdminRemarksDraft(remark)}>
                              + "{remark.slice(0, 32)}..."
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Evaluation Decision Buttons */}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap', borderTop:'1px solid var(--border)', paddingTop:16 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <button
                            className="btn"
                            disabled={gradingId === sub.id}
                            onClick={() => gradeDbmsSubmission(sub, 'pass', adminRemarksDraft)}
                            style={{ background:'linear-gradient(135deg,var(--green),#059669)', color:'#fff', fontWeight:700, padding:'8px 18px', display:'flex', alignItems:'center', gap:6, boxShadow:'0 4px 16px rgba(16,185,129,0.3)' }}>
                            {gradingId === sub.id ? <Loader2 size={13} style={{ animation:'spin-slow 0.8s linear infinite' }} /> : <ThumbsUp size={13} />}
                            Grade as PASS (+{pts} pts)
                          </button>
                          <button
                            className="btn"
                            disabled={gradingId === sub.id}
                            onClick={() => gradeDbmsSubmission(sub, 'fail', adminRemarksDraft)}
                            style={{ background:'linear-gradient(135deg,var(--red),#dc2626)', color:'#fff', fontWeight:700, padding:'8px 18px', display:'flex', alignItems:'center', gap:6, boxShadow:'0 4px 16px rgba(239,68,68,0.3)' }}>
                            {gradingId === sub.id ? <Loader2 size={13} style={{ animation:'spin-slow 0.8s linear infinite' }} /> : <ThumbsDown size={13} />}
                            Grade as FAIL / Needs Revision
                          </button>
                          <button
                            className="btn btn-ghost"
                            disabled={savingRemarksId === sub.id}
                            onClick={() => saveAdminRemarksOnly(sub.id, adminRemarksDraft)}
                            style={{ padding:'8px 16px', display:'flex', alignItems:'center', gap:6 }}>
                            {savingRemarksId === sub.id ? <Loader2 size={13} style={{ animation:'spin-slow 0.8s linear infinite' }} /> : <Save size={13} />}
                            Save Remarks Only
                          </button>
                        </div>
                        <button className="btn btn-ghost" onClick={() => setInspectingSub(null)}>
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Code Submissions */}
              <div className="glass-card" style={{ overflow:'hidden', padding:0 }}>
                <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
                  <CheckCircle2 size={14} color="var(--green)"/>
                  <span style={{ fontWeight:700, fontSize:14 }}>Code Submissions</span>
                  <span style={{ fontSize:11, color:'var(--text-3)', marginLeft:'auto' }}>{allSubmissions.length} total</span>
                </div>
                {allSubmissions.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-3)' }}><p>No code submissions yet.</p></div>
                ) : (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', minWidth:700 }}>
                      <thead><tr>
                        <th>Student</th><th>Problem</th><th>Language</th><th>Status</th><th>Runtime</th><th>Actions</th>
                      </tr></thead>
                      <tbody>
                        {allSubmissions.slice(0, 50).map((s: any) => (
                          <tr key={s.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ fontSize:12 }}>{s.userName || s.userId?.slice(0,8)}</td>
                            <td style={{ fontSize:12 }}>{s.problemTitle || s.problemId}</td>
                            <td><span className="badge badge-cyan" style={{ fontSize:9 }}>{s.language || 'N/A'}</span></td>
                            <td>
                              <span style={{ fontWeight:700, fontSize:12, color:s.status==='accepted'?'var(--green)':s.status==='wrong_answer'?'var(--red)':'var(--yellow)' }}>
                                {s.status || 'unknown'}
                              </span>
                            </td>
                            <td style={{ fontSize:12, color:'var(--text-3)' }}>{s.runtime ? s.runtime+'ms' : '—'}</td>
                            <td>
                              <button className="btn btn-danger btn-sm" onClick={() => deleteCodeSubmission(s.id)}>
                                <Trash2 size={11}/>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {allSubmissions.length > 50 && <div style={{ textAlign:'center', padding:12, fontSize:11, color:'var(--text-3)' }}>Showing latest 50 of {allSubmissions.length}</div>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════ USERS TAB ══════════════ */}
          {tab === 'users' && (
            <div>
              {!isSuperAdmin && (
                <div className="glass-card" style={{ padding: 13, marginBottom: 16, border: '1px solid rgba(245,158,11,0.28)', background: 'rgba(245,158,11,0.04)' }}>
                  <div className="flex gap-2 items-center" style={{ color: 'var(--yellow)' }}>
                    <AlertTriangle size={14} />
                    <span style={{ fontSize: 12 }}>Only Super Admin can promote/demote admins and delete users.</span>
                  </div>
                </div>
              )}
              {loading
                ? <div className="flex justify-center" style={{ padding: 60 }}><div className="spinner" /></div>
                : <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
                  <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users size={14} color="var(--pink)" />
                    <span style={{ fontWeight: 700, fontSize: 14 }}>All Users</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>{users.length} registered</span>
                  </div>
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>User</th><th>Email</th><th>Role</th><th>Solved</th><th>Score</th>
                        {isSuperAdmin && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id}>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{u.displayName?.[0]?.toUpperCase() || 'U'}</div>
                              <span style={{ fontWeight: 500, fontSize: 13 }}>{u.displayName}</span>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-2)', fontSize: 12 }}>{u.email}</td>
                          <td>
                            <span className={`badge ${u.role === 'superadmin' ? 'badge-yellow' : u.role === 'admin' ? 'badge-purple' : 'badge-cyan'}`}>
                              {u.role === 'superadmin' ? '👑 Super' : u.role === 'admin' ? '🛡️ Admin' : '🎓 Student'}
                            </span>
                          </td>
                          <td style={{ color: 'var(--cyan)', fontWeight: 600, fontSize: 13 }}>{u.problemsSolved || 0}</td>
                          <td style={{ color: 'var(--yellow)', fontWeight: 600, fontSize: 13 }}>{u.score || 0}</td>
                          {isSuperAdmin && (
                            <td>
                              {u.role !== 'superadmin' && (
                                <div className="flex gap-2">
                                  <button className="btn btn-ghost btn-sm" onClick={() => toggleUserRole(u.id, u.role)}>
                                    {u.role === 'admin' ? <UserX size={11} /> : <UserCheck size={11} />}
                                    {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                                  </button>
                                  <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u.id, u.displayName)}><Trash2 size={11} /></button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              }
            </div>
          )}

          {/* ══════════════ ANALYTICS TAB ══════════════ */}
          {tab === 'stats' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
                {[
                  { label: 'Acceptance Rate', color: 'var(--green)', icon: <CheckCircle2 size={20} />,
                    value: stats.totalSubmissions > 0 ? `${Math.round(stats.acceptedSubmissions / stats.totalSubmissions * 100)}%` : 'N/A',
                    bg: 'linear-gradient(135deg,rgba(16,185,129,0.13),rgba(16,185,129,0.03))',
                    sub: `${stats.acceptedSubmissions} accepted / ${stats.totalSubmissions} total` },
                  { label: 'Avg Solved / User', color: 'var(--purple-light)', icon: <Activity size={20} />,
                    value: stats.totalUsers > 0 ? (users.reduce((a, u) => a + (u.problemsSolved || 0), 0) / stats.totalUsers).toFixed(1) : '0',
                    bg: 'linear-gradient(135deg,rgba(139,92,246,0.13),rgba(139,92,246,0.03))',
                    sub: `across ${stats.totalUsers} students` },
                  { label: 'Total Submissions', color: 'var(--yellow)', icon: <Zap size={20} />,
                    value: stats.totalSubmissions,
                    bg: 'linear-gradient(135deg,rgba(245,158,11,0.13),rgba(245,158,11,0.03))',
                    sub: 'all code submissions' },
                  { label: 'Content Library', color: 'var(--cyan)', icon: <BookOpen size={20} />,
                    value: stats.totalProblems + stats.totalDbms,
                    bg: 'linear-gradient(135deg,rgba(34,211,238,0.13),rgba(34,211,238,0.03))',
                    sub: `${stats.totalProblems} coding + ${stats.totalDbms} DBMS` },
                ].map((card, i) => (
                  <div key={i} className="glass-card" style={{ padding: 20, background: card.bg }}>
                    <div style={{ color: card.color, marginBottom: 9 }}>{card.icon}</div>
                    <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'Plus Jakarta Sans, sans-serif', color: card.color, lineHeight: 1 }}>{card.value}</div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}>{card.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{card.sub}</div>
                  </div>
                ))}
              </div>

              <div className="admin-analytics-grid">
                {/* Top performers */}
                <div className="glass-card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Award size={16} color="var(--yellow)" /><span style={{ fontWeight: 700, fontSize: 14 }}>Top Performers</span>
                  </div>
                  {users.slice().sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5).map((u, i) => (
                    <div key={u.id} className="flex items-center gap-3" style={{ marginBottom: 11 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 99, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800,
                        background: i === 0 ? 'rgba(245,158,11,0.2)' : i === 1 ? 'rgba(148,163,184,0.12)' : 'rgba(180,83,9,0.12)',
                        border: `1px solid ${i === 0 ? 'rgba(245,158,11,0.4)' : i === 1 ? 'rgba(148,163,184,0.3)' : 'rgba(180,83,9,0.3)'}`,
                        color: i === 0 ? 'var(--yellow)' : i === 1 ? 'var(--text-2)' : '#cd7c2f' }}>
                        {i + 1}
                      </div>
                      <div className="avatar" style={{ width: 26, height: 26, fontSize: 10, flexShrink: 0 }}>{u.displayName?.[0]?.toUpperCase() || 'U'}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.displayName} {u.role === 'superadmin' ? '👑' : u.role === 'admin' ? '🛡️' : ''}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{u.problemsSolved || 0} solved</div>
                      </div>
                      <div style={{ color: 'var(--yellow)', fontWeight: 700, fontSize: 12 }}>{u.score || 0} pts</div>
                    </div>
                  ))}
                  {users.length === 0 && <p style={{ color: 'var(--text-3)', fontSize: 12 }}>No competitors yet.</p>}
                </div>

                {/* Content breakdown */}
                <div className="glass-card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <BarChart2 size={16} color="var(--purple-light)" /><span style={{ fontWeight: 700, fontSize: 14 }}>Content Breakdown</span>
                  </div>
                  {[
                    { label: 'Easy Problems',   count: problems.filter(p => p.difficulty === 'easy').length,   color: 'var(--green)',        total: problems.length },
                    { label: 'Medium Problems', count: problems.filter(p => p.difficulty === 'medium').length, color: 'var(--yellow)',       total: problems.length },
                    { label: 'Hard Problems',   count: problems.filter(p => p.difficulty === 'hard').length,   color: 'var(--red)',          total: problems.length },
                    { label: 'DBMS Queries',    count: dbmsQuestions.filter(q => q.type === 'query').length,   color: 'var(--cyan)',         total: dbmsQuestions.length },
                    { label: 'DBMS Theory',     count: dbmsQuestions.filter(q => q.type === 'theory').length,  color: 'var(--purple-light)', total: dbmsQuestions.length },
                  ].map((item, i) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{item.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.count}</span>
                      </div>
                      <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 99, background: item.color, width: item.total > 0 ? `${(item.count / item.total) * 100}%` : '0%', transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={10} color="var(--text-3)" />
                    <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{new Date().toLocaleTimeString()}</span>
                    <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={loadData}><Zap size={9} /> Refresh</button>
                  </div>
                </div>
              </div>

              {/* Role distribution */}
              <div className="glass-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Shield size={15} color="var(--yellow)" /><span style={{ fontWeight: 700, fontSize: 14 }}>Role Distribution</span>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {[
                    { role: 'superadmin', label: '👑 Super Admin', color: 'var(--yellow)', bg: 'rgba(245,158,11,0.07)' },
                    { role: 'admin',      label: '🛡️ Admin',       color: 'var(--purple-light)', bg: 'rgba(139,92,246,0.07)' },
                    { role: 'student',    label: '🎓 Student',     color: 'var(--cyan)', bg: 'rgba(34,211,238,0.07)' },
                  ].map(r => {
                    const count = users.filter(u => u.role === r.role).length;
                    return (
                      <div key={r.role} style={{ flex: '1 1 130px', padding: '13px 16px', background: r.bg, borderRadius: 'var(--radius-md)', border: `1px solid ${r.color}25` }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: r.color, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{count}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{r.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{stats.totalUsers > 0 ? Math.round(count / stats.totalUsers * 100) : 0}% of users</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════ PLACEMENT TESTS TAB ══════════════ */}
          {tab === 'tests' && (
            <AdminTestsTab users={users} onRefresh={loadData} />
          )}

          {/* ══════════════ DAILY TASKS TAB ══════════════ */}
          {tab === 'daily_tasks' && (
            <>
              {/* Form */}
              {showTaskForm && (
                <div className="glass-card" style={{ padding: 24, marginBottom: 24, border: '1px solid rgba(34,211,238,0.3)' }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
                    <h2 style={{ fontWeight: 700, fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ListChecks size={16} color="var(--cyan)" />
                      {editingTaskId ? 'Edit Daily Task' : 'Create Daily Task'}
                    </h2>
                    <button className="btn btn-ghost btn-sm" onClick={resetTaskForm}><X size={13} /> Cancel</button>
                  </div>
                  <div className="admin-form-grid">
                    <div style={{ gridColumn: '1/-1' }}>
                      <label>Task Title *</label>
                      <input className="input" placeholder="e.g. Solve 2 problems today" value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label>Description</label>
                      <input className="input" placeholder="Brief description..." value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} />
                    </div>
                    <div>
                      <label>Type</label>
                      <select className="input" value={taskForm.type} onChange={e => setTaskForm(p => ({ ...p, type: e.target.value as any }))}>
                        <option value="code">Code Problems</option>
                        <option value="dbms">DBMS Problems</option>
                        <option value="any">Any (Code + DBMS)</option>
                      </select>
                    </div>
                    <div>
                      <label>Date</label>
                      <input className="input" type="date" value={taskForm.date} onChange={e => setTaskForm(p => ({ ...p, date: e.target.value }))} />
                    </div>
                    <div>
                      <label>Target Count (# to solve)</label>
                      <input className="input" type="number" min={1} max={20} value={taskForm.targetCount} onChange={e => setTaskForm(p => ({ ...p, targetCount: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <label>Bonus Points</label>
                      <input className="input" type="number" min={0} max={500} step={5} value={taskForm.points} onChange={e => setTaskForm(p => ({ ...p, points: Number(e.target.value) }))} />
                    </div>
                  </div>
                  <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
                    <button className="btn btn-primary" onClick={handleTaskSave} disabled={savingTask}>
                      {savingTask ? <Loader2 size={14} style={{ animation: 'spin-slow 0.8s linear infinite' }} /> : <Save size={14} />}
                      {editingTaskId ? 'Update Task' : 'Create Task'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={resetTaskForm}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Add button */}
              {!showTaskForm && (
                <div style={{ marginBottom: 18 }}>
                  <button className="btn" style={{ background: 'linear-gradient(135deg,var(--cyan),#0891b2)', color: '#000', fontWeight: 700 }}
                    onClick={() => { resetTaskForm(); setShowTaskForm(true); }}>
                    <Plus size={14} /> Add Daily Task
                  </button>
                </div>
              )}

              {/* Task list */}
              {dailyTasks.length === 0 ? (
                <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
                  <Calendar size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
                  <p>No daily tasks yet. Create one!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {dailyTasks.map(t => (
                    <div key={t.id} className="glass-card" style={{ padding: '16px 20px' }}>
                      <div className="flex items-center justify-between gap-3">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                          <ListChecks size={18} style={{ color: 'var(--cyan)', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{t.title}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{t.description}</div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, background: 'rgba(34,211,238,0.15)', color: 'var(--cyan)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{t.type.toUpperCase()}</span>
                              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>📅 {t.date}</span>
                              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>🎯 Solve {t.targetCount}</span>
                              <span style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 600 }}>+{t.points} pts</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setTaskForm({ title: t.title, description: t.description, type: t.type, targetCount: t.targetCount, date: t.date, points: t.points }); setEditingTaskId(t.id); setShowTaskForm(true); }}>
                            <Edit3 size={12} /> Edit
                          </button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red, #ef4444)' }} onClick={() => handleTaskDelete(t.id)}>
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Footer Watermark ───────────────────────────────── */}
          <div style={{
            textAlign: 'center', marginTop: 52, paddingTop: 18,
            borderTop: '1px solid rgba(139,92,246,0.1)',
            fontSize: 11, color: 'rgba(139,92,246,0.3)',
            fontFamily: 'JetBrains Mono,monospace', letterSpacing: '0.1em',
          }}>
            ⚡ CodeForge MCA — Engineered for Department Assessments by{' '}
            <strong style={{ color: 'rgba(167,139,250,0.7)' }}>Rakshil Gandhi</strong>
          </div>

        </div>
      </div>
    </>
  );
};

export default AdminPage;
