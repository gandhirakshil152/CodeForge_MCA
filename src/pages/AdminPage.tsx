import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, getDocs, query, orderBy, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import {
  Shield, Plus, Trash2, Edit3, Users, BookOpen, BarChart2,
  Save, X, AlertTriangle, UserCheck, UserX, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Problem } from './ProblemsPage';

type AdminTab = 'problems' | 'users' | 'stats';

// ── Default starter code templates
// IMPORTANT: Java class MUST be named 'Main' — Judge0 CE compiles as Main.java
const DEFAULT_STARTER: Problem['starterCode'] = {
  java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Write your solution here
        // Example: int n = sc.nextInt();
        //          System.out.println(n);
    }
}`,
  c: `#include <stdio.h>
#include <string.h>

int main() {
    // Write your solution here
    // Example: int n; scanf("%d", &n); printf("%d\\n", n);
    return 0;
}`,
  python: `import sys
input = sys.stdin.readline

# Write your solution here
# Example: n = int(input())
#          print(n)
`,
  javascript: `const lines = require('fs').readFileSync('/dev/stdin', 'utf8').split('\\n');
let idx = 0;
const input = () => lines[idx++]?.trim() ?? '';

// Write your solution here
// Example: const n = parseInt(input());
//          console.log(n);
`,
};

const EMPTY_PROBLEM: {
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  tags: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  examples: { input: string; output: string; explanation: string }[];
  testCases: { input: string; expectedOutput: string }[];
  starterCode: Problem['starterCode'];
} = {
  title: '',
  difficulty: 'easy',
  category: 'Arrays',
  tags: '',
  description: '',
  inputFormat: '',
  outputFormat: '',
  constraints: '',
  examples: [{ input: '', output: '', explanation: '' }],
  testCases: [{ input: '', expectedOutput: '' }],
  starterCode: { ...DEFAULT_STARTER },
};

const AdminPage: React.FC = () => {
  const { profile, isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>('problems');
  const [problems, setProblems] = useState<Problem[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_PROBLEM });
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ totalUsers: 0, totalSubmissions: 0, totalProblems: 0, acceptedSubmissions: 0 });

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pSnap, uSnap] = await Promise.all([
        getDocs(query(collection(db, 'problems'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'users')),
      ]);
      setProblems(pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Problem)));
      setUsers(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const subSnap = await getDocs(collection(db, 'submissions'));
      const allSubs = subSnap.docs.map(d => d.data());
      setStats({
        totalUsers: uSnap.size,
        totalProblems: pSnap.size,
        totalSubmissions: subSnap.size,
        acceptedSubmissions: allSubs.filter(s => s.status === 'accepted').length,
      });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const resetForm = () => { setForm({ ...EMPTY_PROBLEM }); setEditingId(null); setShowForm(false); };

  const handleEdit = (p: Problem) => {
    setForm({
      title: p.title,
      difficulty: p.difficulty,
      category: p.category,
      tags: p.tags?.join(', ') || '',
      description: p.description,
      inputFormat: p.inputFormat || '',
      outputFormat: p.outputFormat || '',
      constraints: p.constraints || '',
      examples: p.examples?.length
        ? p.examples.map(e => ({ input: e.input, output: e.output, explanation: e.explanation ?? '' }))
        : [{ input: '', output: '', explanation: '' }],
      testCases: p.testCases?.length ? p.testCases : [{ input: '', expectedOutput: '' }],
      starterCode: p.starterCode || { ...DEFAULT_STARTER },
    });
    setEditingId(p.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Title and description are required!'); return;
    }
    setSaving(true);
    try {
      const data = {
        title: form.title.trim(),
        difficulty: form.difficulty,
        category: form.category,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        description: form.description.trim(),
        inputFormat: form.inputFormat.trim(),
        outputFormat: form.outputFormat.trim(),
        constraints: form.constraints.trim(),
        examples: form.examples.filter(e => e.input || e.output),
        testCases: form.testCases.filter(t => t.input || t.expectedOutput),
        starterCode: form.starterCode,
        solvedCount: 0,
        likes: 0,
        dislikes: 0,
        addedBy: profile?.displayName || 'Admin',
        ...(editingId ? { updatedAt: serverTimestamp() } : { createdAt: serverTimestamp() }),
      };
      if (editingId) {
        await updateDoc(doc(db, 'problems', editingId), data);
        toast.success('Problem updated! ✅');
      } else {
        await addDoc(collection(db, 'problems'), data);
        toast.success('Problem added! 🎉');
      }
      resetForm();
      loadData();
    } catch (err) { toast.error('Failed to save!'); console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'problems', id));
      toast.success('Problem deleted!');
      loadData();
    } catch { toast.error('Failed to delete!'); }
  };

  const toggleUserRole = async (userId: string, currentRole: string) => {
    if (!isSuperAdmin) { toast.error('Only Super Admin can manage admins!'); return; }
    const newRole = currentRole === 'admin' ? 'student' : 'admin';
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      toast.success(`Role changed to ${newRole}!`);
      loadData();
    } catch { toast.error('Failed!'); }
  };

  const deleteUser = async (userId: string, name: string) => {
    if (!isSuperAdmin) { toast.error('Only Super Admin can delete users!'); return; }
    if (!window.confirm(`Remove user "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      toast.success('User removed!');
      loadData();
    } catch { toast.error('Failed!'); }
  };

  if (!isAdmin) return null;

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-content">
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <div className="flex items-center gap-3" style={{ marginBottom: 8 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={22} color="var(--yellow)" />
              </div>
              <div>
                <h1 className="font-display" style={{ fontSize: 32, fontWeight: 800 }}>
                  Admin Panel <span style={{ fontSize: 14, color: 'var(--yellow)' }}>{isSuperAdmin ? '👑 Super Admin' : '🛡️ Admin'}</span>
                </h1>
                <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Manage problems, users, and platform settings</p>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                {tab === 'problems' && !showForm && (
                  <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
                    <Plus size={16} /> Add Problem
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
            {[
              { label: 'Total Users', value: stats.totalUsers, color: 'var(--cyan)', icon: <Users size={18} /> },
              { label: 'Problems', value: stats.totalProblems, color: 'var(--purple-light)', icon: <BookOpen size={18} /> },
              { label: 'Submissions', value: stats.totalSubmissions, color: 'var(--yellow)', icon: <BarChart2 size={18} /> },
              { label: 'Accepted', value: stats.acceptedSubmissions, color: 'var(--green)', icon: <UserCheck size={18} /> },
            ].map((s, i) => (
              <div key={i} className="glass-card" style={{ padding: 20 }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 8, color: s.color }}>{s.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: 28, maxWidth: 400 }}>
            <button className={`tab ${tab === 'problems' ? 'active' : ''}`} onClick={() => setTab('problems')}>
              <BookOpen size={14} /> Problems
            </button>
            <button className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
              <Users size={14} /> Users
            </button>
          </div>

          {/* ── PROBLEMS TAB ── */}
          {tab === 'problems' && (
            <>
              {/* Add / Edit Form */}
              {showForm && (
                <div className="admin-section" style={{ marginBottom: 32 }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
                    <h2 style={{ fontWeight: 700, fontSize: 20 }}>
                      {editingId ? '✏️ Edit Problem' : '➕ Add New Problem'}
                    </h2>
                    <button className="btn btn-ghost btn-sm" onClick={resetForm}><X size={14} /> Cancel</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label>Problem Title *</label>
                      <input className="input" placeholder="e.g. Two Sum" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                    </div>
                    <div>
                      <label>Difficulty *</label>
                      <select className="input" value={form.difficulty} onChange={e => setForm(p => ({ ...p, difficulty: e.target.value as any }))}>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                    <div>
                      <label>Category *</label>
                      <select className="input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                        {['Arrays', 'Strings', 'Math', 'Sorting', 'Dynamic Programming', 'Graphs', 'Trees', 'Recursion', 'Hashing', 'Binary Search', 'Stack/Queue', 'Linked List'].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label>Tags (comma separated)</label>
                      <input className="input" placeholder="array, hashmap, two-pointer" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
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
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label>Constraints</label>
                      <textarea className="input" rows={2} placeholder="1 ≤ N ≤ 10^5" value={form.constraints} onChange={e => setForm(p => ({ ...p, constraints: e.target.value }))} />
                    </div>

                    {/* Examples */}
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                        <label style={{ marginBottom: 0 }}>Examples</label>
                        <button className="btn btn-ghost btn-sm" onClick={() => setForm(p => ({ ...p, examples: [...p.examples, { input: '', output: '', explanation: '' }] }))}>
                          <Plus size={12} /> Add Example
                        </button>
                      </div>
                      {form.examples.map((ex, i) => (
                        <div key={i} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 12 }}>
                          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-2)' }}>Example {i + 1}</span>
                            {form.examples.length > 1 && (
                              <button className="btn btn-ghost btn-sm" onClick={() => setForm(p => ({ ...p, examples: p.examples.filter((_, j) => j !== i) }))}>
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                            <div>
                              <label style={{ fontSize: 11 }}>Input</label>
                              <textarea className="input" rows={2} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }} value={ex.input} onChange={e => setForm(p => ({ ...p, examples: p.examples.map((x, j) => j === i ? { ...x, input: e.target.value } : x) }))} />
                            </div>
                            <div>
                              <label style={{ fontSize: 11 }}>Output</label>
                              <textarea className="input" rows={2} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }} value={ex.output} onChange={e => setForm(p => ({ ...p, examples: p.examples.map((x, j) => j === i ? { ...x, output: e.target.value } : x) }))} />
                            </div>
                          </div>
                          <input className="input" placeholder="Explanation (optional)" value={ex.explanation} onChange={e => setForm(p => ({ ...p, examples: p.examples.map((x, j) => j === i ? { ...x, explanation: e.target.value } : x) }))} />
                        </div>
                      ))}
                    </div>

                    {/* Test Cases */}
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                        <label style={{ marginBottom: 0 }}>Test Cases (hidden)</label>
                        <button className="btn btn-ghost btn-sm" onClick={() => setForm(p => ({ ...p, testCases: [...p.testCases, { input: '', expectedOutput: '' }] }))}>
                          <Plus size={12} /> Add Test Case
                        </button>
                      </div>
                      {form.testCases.map((tc, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: 10, marginBottom: 10, alignItems: 'start' }}>
                          <div>
                            {i === 0 && <label style={{ fontSize: 11 }}>Input</label>}
                            <textarea className="input" rows={2} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }} placeholder="Test input" value={tc.input} onChange={e => setForm(p => ({ ...p, testCases: p.testCases.map((t, j) => j === i ? { ...t, input: e.target.value } : t) }))} />
                          </div>
                          <div>
                            {i === 0 && <label style={{ fontSize: 11 }}>Expected Output</label>}
                            <textarea className="input" rows={2} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }} placeholder="Expected output" value={tc.expectedOutput} onChange={e => setForm(p => ({ ...p, testCases: p.testCases.map((t, j) => j === i ? { ...t, expectedOutput: e.target.value } : t) }))} />
                          </div>
                          {form.testCases.length > 1 && (
                            <button className="btn btn-ghost btn-sm" style={{ marginTop: i === 0 ? 22 : 0 }} onClick={() => setForm(p => ({ ...p, testCases: p.testCases.filter((_, j) => j !== i) }))}>
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Starter Code */}
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label>Starter Code Templates</label>
                      <div className="tabs" style={{ marginBottom: 12 }}>
                        {['java', 'c', 'python', 'javascript'].map(l => (
                          <button key={l} className="tab active" style={{ cursor: 'default', fontSize: 11 }}>{l.toUpperCase()}</button>
                        ))}
                      </div>
                      {(['java', 'c', 'python', 'javascript'] as const).map(l => (
                        <div key={l} style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 11 }}>{l.toUpperCase()}</label>
                          <textarea className="input" rows={4} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }} value={form.starterCode[l]} onChange={e => setForm(p => ({ ...p, starterCode: { ...p.starterCode, [l]: e.target.value } }))} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 size={15} style={{ animation: 'spin-slow 0.8s linear infinite' }} /> : <Save size={15} />}
                      {editingId ? 'Update Problem' : 'Publish Problem'}
                    </button>
                    <button className="btn btn-ghost" onClick={resetForm}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Problems List */}
              {loading ? (
                <div className="flex justify-center" style={{ padding: 60 }}><div className="spinner" /></div>
              ) : problems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-3)' }}>
                  <BookOpen size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
                  <p style={{ fontSize: 18 }}>No problems yet! Add your first one. 🚀</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {problems.map(p => {
                    const diffClass = p.difficulty === 'easy' ? 'diff-easy' : p.difficulty === 'medium' ? 'diff-medium' : 'diff-hard';
                    return (
                      <div key={p.id} className="glass-card" style={{ padding: '16px 20px' }}>
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-3 flex-1">
                            <span className={`badge ${diffClass}`} style={{ flexShrink: 0 }}>{p.difficulty}</span>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 15 }}>{p.title}</div>
                              <div className="flex items-center gap-2" style={{ marginTop: 3 }}>
                                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{p.category}</span>
                                <span style={{ color: 'var(--text-3)', fontSize: 12 }}>• {p.solvedCount || 0} solved</span>
                                <span style={{ color: 'var(--text-3)', fontSize: 12 }}>• by {p.addedBy}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(p)}>
                              <Edit3 size={13} /> Edit
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id, p.title)}>
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── USERS TAB ── */}
          {tab === 'users' && (
            <div>
              {!isSuperAdmin && (
                <div className="glass-card" style={{ padding: 16, marginBottom: 20, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}>
                  <div className="flex gap-2 items-center" style={{ color: 'var(--yellow)' }}>
                    <AlertTriangle size={16} />
                    <span style={{ fontSize: 13 }}>Only the Super Admin can promote/remove admins.</span>
                  </div>
                </div>
              )}
              {loading ? (
                <div className="flex justify-center" style={{ padding: 60 }}><div className="spinner" /></div>
              ) : (
                <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Solved</th>
                        <th>Score</th>
                        {isSuperAdmin && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id}>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>{u.displayName?.[0]?.toUpperCase() || 'U'}</div>
                              <span style={{ fontWeight: 500 }}>{u.displayName}</span>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{u.email}</td>
                          <td>
                            <span className={`badge ${u.role === 'superadmin' ? 'badge-yellow' : u.role === 'admin' ? 'badge-purple' : 'badge-cyan'}`}>
                              {u.role === 'superadmin' ? '👑 Super' : u.role === 'admin' ? '🛡️ Admin' : 'Student'}
                            </span>
                          </td>
                          <td style={{ color: 'var(--cyan)', fontWeight: 600 }}>{u.problemsSolved || 0}</td>
                          <td style={{ color: 'var(--yellow)', fontWeight: 600 }}>{u.score || 0}</td>
                          {isSuperAdmin && (
                            <td>
                              {u.role !== 'superadmin' && (
                                <div className="flex gap-2">
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => toggleUserRole(u.id, u.role)}
                                    title={u.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                                  >
                                    {u.role === 'admin' ? <UserX size={12} /> : <UserCheck size={12} />}
                                    {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                                  </button>
                                  <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u.id, u.displayName)}>
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
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
    </>
  );
};

export default AdminPage;
