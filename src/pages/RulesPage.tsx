import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import {
  Trophy, Zap, Flame, Database, ClipboardList, CheckCircle2,
  ShieldCheck, AlertTriangle, ArrowRight, BookOpen, Scale
} from 'lucide-react';

const RulesPage: React.FC = () => {
  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-content" style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 60 }}>
          
          {/* ── Page Header ────────────────────────────────────── */}
          <div style={{ textAlign: 'center', marginBottom: 40, marginTop: 10 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)',
              padding: '4px 14px', borderRadius: 99, color: 'var(--cyan)',
              fontSize: 12, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
              marginBottom: 14, letterSpacing: '0.05em'
            }}>
              <Scale size={14} /> ACADEMIC EVALUATION &amp; SCORING RULES
            </div>
            <h1 className="font-display gradient-text" style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, marginBottom: 12 }}>
              How Points &amp; Rankings Work
            </h1>
            <p style={{ color: 'var(--text-2)', maxWidth: 650, margin: '0 auto', fontSize: 15, lineHeight: 1.6 }}>
              CodeForge MCA uses transparent, runtime-weighted evaluation metrics, daily streak incentives, and fair tie-breaking for department assessments and leaderboard standings.
            </p>
          </div>

          {/* ── Quick KPI Highlights ───────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 36 }}>
            <div className="glass-card" style={{ padding: '20px 18px', borderLeft: '4px solid var(--blue-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Zap size={20} color="var(--blue-light)" />
                <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)' }}>Coding Tier</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-1)' }}>50 - 150 <span style={{ fontSize: 14, color: 'var(--text-3)' }}>pts</span></div>
              <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '4px 0 0' }}>Runtime-tiered efficiency scoring per accepted solution</p>
            </div>

            <div className="glass-card" style={{ padding: '20px 18px', borderLeft: '4px solid var(--yellow)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Flame size={20} color="var(--yellow)" />
                <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)' }}>Daily Streaks</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--yellow)' }}>+5 <span style={{ fontSize: 14, color: 'var(--text-3)' }}>pts/day</span></div>
              <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '4px 0 0' }}>Consecutive daily solves bonus (capped at +100 bonus pts)</p>
            </div>

            <div className="glass-card" style={{ padding: '20px 18px', borderLeft: '4px solid var(--cyan)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Database size={20} color="var(--cyan)" />
                <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)' }}>SQL Lab</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--cyan)' }}>10 / 25 / 50 <span style={{ fontSize: 14, color: 'var(--text-3)' }}>pts</span></div>
              <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '4px 0 0' }}>Easy, Medium &amp; Hard query verification in relational engine</p>
            </div>

            <div className="glass-card" style={{ padding: '20px 18px', borderLeft: '4px solid var(--green)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Trophy size={20} color="var(--green)" />
                <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)' }}>Leaderboard</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--green)' }}>Real-Time</div>
              <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '4px 0 0' }}>Ranked by total score with completion time speed tie-breakers</p>
            </div>
          </div>

          {/* ── Rule Section 1: Coding Runtime Scoring ───────────── */}
          <div className="glass-card" style={{ padding: 28, marginBottom: 24, border: '1px solid rgba(59,130,246,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Zap size={18} color="var(--blue-light)" />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>1. Algorithmic Problem Scoring (Runtime Tiered)</h2>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>How points are computed when code passes all automated test cases</span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 18 }}>
              Points are evaluated based on both <strong>correctness</strong> and <strong>execution speed</strong> via Judge0. Faster algorithms consume fewer CPU cycles and earn higher scores:
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-3)' }}>
                    <th style={{ padding: '10px 14px' }}>Runtime Window</th>
                    <th style={{ padding: '10px 14px' }}>Base Points Awarded</th>
                    <th style={{ padding: '10px 14px' }}>Evaluation Tier Badge</th>
                    <th style={{ padding: '10px 14px' }}>Typical Algorithm Profile</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: 'var(--cyan)' }}>&lt; 100 ms</td>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--green)' }}>+150 Points</td>
                    <td style={{ padding: '12px 14px' }}><span className="badge badge-green">⚡ Blazing Fast</span></td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-2)' }}>Optimal O(1) or O(N) single-pass with minimal I/O overhead</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: 'var(--cyan)' }}>100 ms - 299 ms</td>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--blue-light)' }}>+125 Points</td>
                    <td style={{ padding: '12px 14px' }}><span className="badge badge-cyan">🚀 Fast</span></td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-2)' }}>Efficient O(N log N) sorting, binary search, or two pointers</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: 'var(--cyan)' }}>300 ms - 499 ms</td>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--yellow)' }}>+100 Points</td>
                    <td style={{ padding: '12px 14px' }}><span className="badge badge-yellow">⏱️ Standard</span></td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-2)' }}>Acceptable baseline solution passing all constraints</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: 'var(--cyan)' }}>500 ms - 999 ms</td>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#fb923c' }}>+75 Points</td>
                    <td style={{ padding: '12px 14px' }}><span className="badge" style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)' }}>⏳ Slow</span></td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-2)' }}>Higher constant factor or brute-force approach near time limit</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: 'var(--cyan)' }}>&gt;= 1000 ms</td>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--red)' }}>+50 Points</td>
                    <td style={{ padding: '12px 14px' }}><span className="badge badge-red">🐢 Very Slow</span></td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-2)' }}>Barely passes execution timeout window</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: 'var(--text-3)' }}>Failed / Error</td>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--text-3)' }}>0 Points</td>
                    <td style={{ padding: '12px 14px' }}><span className="badge badge-red">✕ Wrong Answer</span></td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-3)' }}>Did not pass one or more test cases</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{
              marginTop: 16, padding: '12px 16px', background: 'rgba(59,130,246,0.06)',
              border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--text-2)', display: 'flex', gap: 10, alignItems: 'flex-start'
            }}>
              <CheckCircle2 size={16} color="var(--blue-light)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ color: 'var(--blue-light)' }}>First-Time Solve Rule:</strong> Base score is credited once when you achieve your first accepted verdict on each unique problem. Re-submitting solutions records execution telemetry and updates your accuracy profile, but will not duplicate leaderboard points.
              </div>
            </div>
          </div>

          {/* ── Rule Section 2: Streak Mechanics ───────────────── */}
          <div className="glass-card" style={{ padding: 28, marginBottom: 24, border: '1px solid rgba(245,158,11,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Flame size={18} color="var(--yellow)" />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>2. Daily Streak &amp; Consistency Multiplier</h2>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Consistent daily coding rewards extra bonus points</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 8, padding: 18 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px', color: 'var(--yellow)' }}>🔥 How Streaks Advance</h3>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  <li>Solve at least <strong>1 coding challenge</strong> each consecutive calendar day.</li>
                  <li>Streak increments by <strong>+1 day</strong> on your first solve of each day.</li>
                  <li>If you miss a calendar day, your streak resets back to <strong>1</strong>.</li>
                </ul>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 8, padding: 18 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px', color: 'var(--yellow)' }}>💎 Bonus Points Formula</h3>
                <div style={{
                  padding: '8px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                  borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--yellow)', marginBottom: 8
                }}>
                  Streak Bonus = min(Days * 5, 100) pts
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
                  E.g., A 10-day streak awards <strong>+50 extra bonus points</strong> on every accepted solve, up to a maximum cap of <strong>+100 bonus pts</strong>!
                </p>
              </div>
            </div>
          </div>

          {/* ── Rule Section 3: DBMS & SQL Lab ─────────────────── */}
          <div className="glass-card" style={{ padding: 28, marginBottom: 24, border: '1px solid rgba(34,211,238,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(34,211,238,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Database size={18} color="var(--cyan)" />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>3. Section 2: SQL &amp; DBMS Lab Points</h2>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Evaluated in browser-relational SQL engine with strict result matching</span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 16 }}>
              DBMS queries are executed directly on the in-memory SQLite/WASM relational sandbox with sample schemas. Points depend on problem difficulty:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <div style={{ padding: 14, background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.18)', borderRadius: 8 }}>
                <span className="badge badge-green" style={{ fontSize: 10 }}>Easy Difficulty</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)', margin: '6px 0 2px' }}>+10 Points</div>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Basic SELECT, WHERE filters, ORDER BY, LIMIT</span>
              </div>
              <div style={{ padding: 14, background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.18)', borderRadius: 8 }}>
                <span className="badge badge-yellow" style={{ fontSize: 10 }}>Medium Difficulty</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--yellow)', margin: '6px 0 2px' }}>+25 Points</div>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>INNER/LEFT JOINs, GROUP BY, HAVING, Aggregate functions</span>
              </div>
              <div style={{ padding: 14, background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.18)', borderRadius: 8 }}>
                <span className="badge badge-red" style={{ fontSize: 10 }}>Hard Difficulty</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--red)', margin: '6px 0 2px' }}>+50 Points</div>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Complex subqueries, window functions, CTEs &amp; normalization</span>
              </div>
            </div>
          </div>

          {/* ── Rule Section 4: Tests & Contests ───────────────── */}
          <div className="glass-card" style={{ padding: 28, marginBottom: 24, border: '1px solid rgba(139,92,246,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <ClipboardList size={18} color="var(--purple-light)" />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>4. Placement Tests &amp; Speed Tie-Breaking</h2>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Official academic assessments with anti-cheat monitoring</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 6px', color: 'var(--purple-light)' }}>
                  🎯 Scoring Components
                </h3>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  <li><strong>MCQ Questions:</strong> Standard +10 points per correct answer (faculty can set negative marking for incorrect choices).</li>
                  <li><strong>Live Coding Challenges:</strong> Automated test case evaluation matching Judge0 output.</li>
                  <li><strong>Final Test Score:</strong> Sum of earned MCQ and coding points.</li>
                </ul>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 6px', color: 'var(--cyan)' }}>
                  ⚡ Speed Tie-Breaker Rule
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  In the event two or more students earn identical total scores, <strong>completion time (timeTaken)</strong> serves as the official tie-breaker. The candidate who completes the test in less elapsed time is awarded the higher ranking.
                </p>
              </div>
            </div>
          </div>

          {/* ── Rule Section 5: Permissions & Submission Auditing ── */}
          <div className="glass-card" style={{ padding: 28, marginBottom: 28, border: '1px solid rgba(16,185,129,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <ShieldCheck size={18} color="var(--green)" />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>5. Role Permissions &amp; Academic Integrity</h2>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Strict policies to uphold fair assessment standards</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--red)', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                  <AlertTriangle size={15} /> Student Submission Restrictions
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  Students can inspect their own submission receipts and verdict history. However, <strong>reloading previous submissions directly into the editor or running them from the submission inspector is disabled</strong> for students to promote original problem solving and prevent unintended code overwrites.
                </p>
              </div>

              <div style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                  <ShieldCheck size={15} /> SuperAdmin &amp; Faculty Auditing
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  <strong>SuperAdmin</strong> holds full administrative privileges to load student submissions into the editor, re-execute against updated testcases, audit plagiarized code, and leave official faculty remarks on individual submissions.
                </p>
              </div>
            </div>

            <div style={{
              marginTop: 18, padding: '12px 16px', background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6
            }}>
              <strong>🔒 System Policy Guards:</strong> Direct file systems (<code>java.io.*</code>), arbitrary memory allocation (<code>malloc/free</code> in C), and network requests are blocked in student sandbox execution. All code must read from standard input and write to standard output.
            </div>
          </div>

          {/* ── Navigation CTA ─────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Link to="/leaderboard" className="btn btn-primary" style={{ gap: 8 }}>
              <Trophy size={16} /> View Academic Leaderboard
            </Link>
            <Link to="/problems" className="btn btn-ghost" style={{ gap: 8 }}>
              <BookOpen size={16} /> Explore Coding Problems <ArrowRight size={14} />
            </Link>
          </div>

        </div>
      </div>
    </>
  );
};

export default RulesPage;
