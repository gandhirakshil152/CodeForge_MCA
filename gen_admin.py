import os

target = os.path.join(os.path.dirname(__file__), 'src', 'pages', 'AdminPage.tsx')

code = r"""import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, getDocs, query, orderBy, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import {
  Shield, Plus, Trash2, Edit3, Users, BookOpen, BarChart2,
  Save, X, AlertTriangle, UserCheck, UserX, Loader2,
  Database, CheckCircle2, Activity, Award, Clock, Zap,
  Eye, EyeOff, Table2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Problem } from './ProblemsPage';

// ─── Types ────────────────────────────────────────────────────────────────────
type AdminTab = 'problems' | 'dbms' | 'users' | 'stats';

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
  title: '', difficulty: 'easy' as const, category: 'Arrays',
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

const DBMS_TYPES = ['query', 'theory', 'normalization', 'design'] as const;

const EMPTY_DBMS: Omit<DbmsQuestion, 'id'> = {
  title: '', topic: 'SQL Basics', difficulty: 'easy', type: 'query',
  description: '', hint: '', sampleSchema: '', expectedQuery: '', explanation: '',
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
    acceptedSubmissions: 0, totalDbms: 0,
  });

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pSnap, uSnap, dbmsSnap] = await Promise.all([
        getDocs(query(collection(db, 'problems'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'dbms_questions'), orderBy('createdAt', 'desc'))),
      ]);
      setProblems(pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Problem)));
      setUsers(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setDbmsQuestions(dbmsSnap.docs.map(d => ({ id: d.id, ...d.data() } as DbmsQuestion)));
      const subSnap = await getDocs(collection(db, 'submissions'));
      const subs    = subSnap.docs.map(d => d.data());
      setStats({
        totalUsers: uSnap.size, totalProblems: pSnap.size,
        totalDbms: dbmsSnap.size, totalSubmissions: subSnap.size,
        acceptedSubmissions: subs.filter((s: any) => s.status === 'accepted').length,
      });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // ── Problems CRUD ──────────────────────────────────────────────────────────
  const resetForm = () => { setForm({ ...EMPTY_PROBLEM }); setEditingId(null); setShowForm(false); };

  const handleEdit = (p: Problem) => {
    setForm({
      title: p.title, difficulty: p.difficulty, category: p.category,
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
      if (editingId) { await updateDoc(doc(db, 'problems', editingId), data); toast.success('Updated! ✅'); }
      else           { await addDoc(collection(db, 'problems'), data);        toast.success('Published! 🎉'); }
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
    setSavingDbms(true);
    try {
      const data = {
        ...dbmsForm, title: dbmsForm.title.trim(), description: dbmsForm.description.trim(),
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

  if (!isAdmin) return null;

  const TABS = [
    { id: 'problems' as AdminTab, label: 'Problems',  icon: <BookOpen size={14} />, count: stats.totalProblems },
    { id: 'dbms'     as AdminTab, label: 'DBMS',      icon: <Database size={14} />, count: stats.totalDbms },
    { id: 'users'    as AdminTab, label: 'Users',     icon: <Users size={14} />,    count: stats.totalUsers },
    { id: 'stats'    as AdminTab, label: 'Analytics', icon: <BarChart2 size={14} /> },
  ];

  const tabAccent = (id: AdminTab) =>
    id === 'dbms' ? 'var(--cyan)' : id === 'stats' ? 'var(--yellow)' : id === 'users' ? 'var(--pink)' : 'var(--purple-light)';

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-content" style={{ position: 'relative' }}>

          {/* ── Fixed Watermark ────────────────────────────────── */}
          <div style={{
            position: 'fixed', bottom: 18, right: 22, zIndex: 9999, pointerEvents: 'none',
            opacity: 0.18, fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
            color: 'var(--purple-light)', letterSpacing: '0.12em', textTransform: 'uppercase', userSelect: 'none',
          }}>
            ⚡ Created by Rakshil Gandhi
          </div>

          {/* ── Header ─────────────────────────────────────────── */}
          <div style={{ marginBottom: 26 }}>
            <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
              <div style={{
                width: 50, height: 50, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg,rgba(245,158,11,0.22),rgba(245,158,11,0.05))',
                border: '1px solid rgba(245,158,11,0.42)', boxShadow: '0 0 28px rgba(245,158,11,0.18)',
              }}>
                <Shield size={22} color="var(--yellow)" />
              </div>
              <div>
                <h1 className="font-display" style={{ fontSize: 'clamp(20px,3.5vw,30px)', fontWeight: 800, lineHeight: 1.15 }}>
                  Admin Panel{' '}
                  <span style={{
                    fontSize: 11, color: 'var(--yellow)', background: 'rgba(245,158,11,0.1)',
                    border: '1px solid rgba(245,158,11,0.32)', borderRadius: 99, padding: '2px 9px', verticalAlign: 'middle',
                  }}>
                    {isSuperAdmin ? '👑 Super Admin' : '🛡️ Admin'}
                  </span>
                </h1>
                <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 3 }}>
                  Manage problems · DBMS bank · users · analytics
                </p>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                {tab === 'problems' && !showForm && (
                  <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
                    <Plus size={14} /> Add Problem
                  </button>
                )}
                {tab === 'dbms' && !showDbmsForm && (
                  <button className="btn"
                    style={{ background: 'linear-gradient(135deg,var(--cyan),#0891b2)', color: '#000', boxShadow: '0 4px 18px rgba(34,211,238,0.32)', fontWeight: 700 }}
                    onClick={() => { resetDbmsForm(); setShowDbmsForm(true); }}>
                    <Plus size={14} /> Add DBMS Q
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Stats Row ───────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 24 }}>
            {[
              { label: 'Users',       value: stats.totalUsers,            color: 'var(--cyan)',         icon: <Users size={16} />,        bg: 'rgba(34,211,238,0.07)' },
              { label: 'Problems',    value: stats.totalProblems,         color: 'var(--purple-light)', icon: <BookOpen size={16} />,     bg: 'rgba(139,92,246,0.07)' },
              { label: 'DBMS Qs',     value: stats.totalDbms,             color: 'var(--cyan)',         icon: <Database size={16} />,     bg: 'rgba(34,211,238,0.05)' },
              { label: 'Submissions', value: stats.totalSubmissions,      color: 'var(--yellow)',       icon: <Zap size={16} />,          bg: 'rgba(245,158,11,0.07)' },
              { label: 'Accepted',    value: stats.acceptedSubmissions,   color: 'var(--green)',        icon: <CheckCircle2 size={16} />, bg: 'rgba(16,185,129,0.07)' },
            ].map((s, i) => (
              <div key={i} className="glass-card" style={{ padding: '14px 12px', background: s.bg, border: `1px solid ${s.color}20` }}>
                <div style={{ color: s.color, marginBottom: 5 }}>{s.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Syne,sans-serif', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Tab Bar ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 3, marginBottom: 24, background: 'rgba(0,0,0,0.38)', borderRadius: 14, padding: 5, border: '1px solid var(--border)', width: 'fit-content', flexWrap: 'wrap' }}>
            {TABS.map(t => {
              const active = tab === t.id;
              const accent = tabAccent(t.id);
              return (
                <button key={t.id}
                  onClick={() => { setTab(t.id); setShowForm(false); setShowDbmsForm(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 15px',
                    borderRadius: 10, border: 'none', cursor: 'pointer',
                    fontFamily: 'Space Grotesk,sans-serif', fontWeight: 600, fontSize: 12,
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
              {showForm && (
                <div className="glass-card" style={{ padding: 26, marginBottom: 28, border: '1px solid rgba(139,92,246,0.28)' }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
                    <h2 style={{ fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Edit3 size={16} color="var(--purple-light)" />
                      {editingId ? 'Edit Problem' : 'Add New Problem'}
                    </h2>
                    <button className="btn btn-ghost btn-sm" onClick={resetForm}><X size={13} /> Cancel</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
                  marginBottom: 16, padding: '11px 16px',
                  background: 'linear-gradient(135deg,rgba(34,211,238,0.08),rgba(34,211,238,0.02))',
                  border: '1px solid rgba(34,211,238,0.22)', borderRadius: 'var(--radius-md)',
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                }}>
                  <Database size={15} color="var(--cyan)" />
                  <span style={{ fontWeight: 600, color: 'var(--cyan)', fontSize: 13 }}>DBMS Question Bank</span>
                  <span style={{ color: 'var(--text-3)', fontSize: 12 }}>— SQL queries, theory, normalization & schema design</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {DBMS_TYPES.map(t => <span key={t} className={`badge ${typeColor(t)}`}>{typeIcon(t)} {t}</span>)}
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
                                    {tbl.columns.split(',').map((col, ci) => (
                                      <th key={ci} style={{ background: 'rgba(34,211,238,0.14)', padding: '4px 10px', borderBottom: '1px solid rgba(34,211,238,0.2)', textAlign: 'left', color: 'var(--cyan)', whiteSpace: 'nowrap', fontSize: 11 }}>
                                        {col.trim()}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {tbl.rows.split('\n').filter(r => r.trim()).map((row, ri) => (
                                    <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                      {row.split(',').map((cell, ci) => (
                                        <td key={ci} style={{ padding: '3px 10px', color: 'var(--text-2)', fontSize: 11 }}>{cell.trim()}</td>
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
                        <label style={{ marginBottom: 0 }}>Expected Answer / SQL <span style={{ fontSize: 10, color: 'var(--text-3)' }}>(🔒 hidden from students)</span></label>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowAnswer(!showAnswer)}>
                          {showAnswer ? <EyeOff size={11} /> : <Eye size={11} />} {showAnswer ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <textarea className="input" rows={4}
                        style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12, filter: showAnswer ? 'none' : 'blur(4px)', transition: 'filter 0.2s ease' }}
                        placeholder="SELECT name, salary FROM Employee WHERE salary > 50000 ORDER BY salary DESC;"
                        value={dbmsForm.expectedQuery} onChange={e => setDbmsForm(p => ({ ...p, expectedQuery: e.target.value }))} />
                      <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>🔒 Not shown to students. Toggle to preview.</p>
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
                    <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'Syne,sans-serif', color: card.color, lineHeight: 1 }}>{card.value}</div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}>{card.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{card.sub}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Top performers */}
                <div className="glass-card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Award size={16} color="var(--yellow)" /><span style={{ fontWeight: 700, fontSize: 14 }}>Top Performers</span>
                  </div>
                  {users.filter(u => u.role !== 'superadmin').sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5).map((u, i) => (
                    <div key={u.id} className="flex items-center gap-3" style={{ marginBottom: 11 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 99, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800,
                        background: i === 0 ? 'rgba(245,158,11,0.2)' : i === 1 ? 'rgba(148,163,184,0.12)' : 'rgba(180,83,9,0.12)',
                        border: `1px solid ${i === 0 ? 'rgba(245,158,11,0.4)' : i === 1 ? 'rgba(148,163,184,0.3)' : 'rgba(180,83,9,0.3)'}`,
                        color: i === 0 ? 'var(--yellow)' : i === 1 ? 'var(--text-2)' : '#cd7c2f' }}>
                        {i + 1}
                      </div>
                      <div className="avatar" style={{ width: 26, height: 26, fontSize: 10, flexShrink: 0 }}>{u.displayName?.[0]?.toUpperCase() || 'U'}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.displayName}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{u.problemsSolved || 0} solved</div>
                      </div>
                      <div style={{ color: 'var(--yellow)', fontWeight: 700, fontSize: 12 }}>{u.score || 0} pts</div>
                    </div>
                  ))}
                  {users.filter(u => u.role !== 'superadmin').length === 0 && <p style={{ color: 'var(--text-3)', fontSize: 12 }}>No students yet.</p>}
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
                        <div style={{ fontSize: 24, fontWeight: 800, color: r.color, fontFamily: 'Syne,sans-serif' }}>{count}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{r.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{stats.totalUsers > 0 ? Math.round(count / stats.totalUsers * 100) : 0}% of users</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Footer Watermark ───────────────────────────────── */}
          <div style={{
            textAlign: 'center', marginTop: 52, paddingTop: 18,
            borderTop: '1px solid rgba(139,92,246,0.1)',
            fontSize: 11, color: 'rgba(139,92,246,0.3)',
            fontFamily: 'JetBrains Mono,monospace', letterSpacing: '0.1em',
          }}>
            ⚡ CodeForge MCA — crafted with 💜 by{' '}
            <strong style={{ color: 'rgba(167,139,250,0.5)' }}>Rakshil Gandhi</strong>
          </div>

        </div>
      </div>
    </>
  );
};

export default AdminPage;
"""

with open(target, 'w', encoding='utf-8') as f:
    f.write(code)

import os
print(f"AdminPage.tsx written! Size: {os.path.getsize(target):,} bytes")
