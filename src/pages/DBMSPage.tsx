import React, { useEffect, useState } from "react";
import {
  collection, getDocs, query, orderBy, addDoc, serverTimestamp,
  doc, updateDoc, increment,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import {
  Database, Search, ChevronDown, ChevronUp,
  Lightbulb, Table2, Code2, BookOpen,
  CheckCircle2, Send, Clock,
  Lock, ShieldOff,
} from "lucide-react";
import toast from "react-hot-toast";

interface TableDef { name: string; columns: string; rows: string; }

interface DbmsQuestion {
  id: string; title: string; topic: string;
  difficulty: "easy" | "medium" | "hard";
  type: "query" | "theory" | "normalization" | "design";
  description: string; hint?: string; sampleSchema?: string;
  expectedQuery?: string; explanation?: string;
  tableData?: TableDef[]; addedBy?: string;
}

const POINTS: Record<string, number> = { easy: 10, medium: 25, hard: 50 };

const typeColor = (t: string) =>
  t === "query" ? "badge-cyan" : t === "theory" ? "badge-purple"
  : t === "normalization" ? "badge-yellow" : "badge-pink";

const TOPICS = ["All","SQL Basics","Joins","Subqueries","Aggregation","Normalization",
  "Indexing","Transactions","Stored Procedures","Views","ER Diagrams","Keys & Constraints","Other"];

// Helper to normalize SQL for comparison (strip comments, whitespace, trailing semicolons, lowercase)
const normalizeSql = (sql: string): string => {
  return sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

const DBMSPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [questions, setQuestions] = useState<DbmsQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState("All");
  const [diffFilter, setDiffFilter] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showHints, setShowHints] = useState<Record<string, boolean>>({});
  const [userQuery, setUserQuery] = useState<Record<string, string>>({});
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [qSnap, subSnap] = await Promise.all([
          getDocs(query(collection(db, "dbms_questions"), orderBy("createdAt", "desc"))),
          user
            ? getDocs(query(collection(db, "dbms_submissions"), orderBy("submittedAt", "desc")))
            : Promise.resolve(null),
        ]);
        setQuestions(qSnap.docs.map(d => ({ id: d.id, ...d.data() } as DbmsQuestion)));
        if (subSnap && user) {
          const solvedIds = new Set<string>();
          const pendingIds = new Set<string>();
          subSnap.docs.forEach(d => {
            const data = d.data() as any;
            if (data.userId !== user.uid) return;
            if (data.status === "pass") solvedIds.add(data.questionId);
            else if (data.status === "pending") pendingIds.add(data.questionId);
          });
          setSolved(solvedIds);
          setPending(pendingIds);
        }

        // Auto-expand question if passed via ?q= URL query parameter (e.g. from Daily Tasks)
        const urlParams = new URLSearchParams(window.location.search);
        const targetQ = urlParams.get('q');
        if (targetQ) {
          setExpanded(prev => ({ ...prev, [targetQ]: true }));
          setTimeout(() => {
            const el = document.getElementById(`q-${targetQ}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 350);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, [user]);

  const handleSubmit = async (q: DbmsQuestion) => {
    if (!user || !profile) { toast.error("Please login first!"); return; }
    const sql = userQuery[q.id] || "";
    if (!sql.trim()) { toast.error("Please type your SQL query first!"); return; }
    setIsSubmitting(true);
    try {
      const todayDate = new Date().toISOString().slice(0, 10);
      const earnedPts = POINTS[q.difficulty] || 10;
      
      // Auto-verify if expectedQuery matches
      const isExpectedMatch = Boolean(
        q.expectedQuery && 
        normalizeSql(sql) === normalizeSql(q.expectedQuery)
      );

      const status = isExpectedMatch ? "pass" : "pending";
      const pts = isExpectedMatch ? earnedPts : 0;

      // 1. Record in dbms_submissions
      await addDoc(collection(db, "dbms_submissions"), {
        userId: user.uid,
        userName: profile.displayName || user.displayName || "Student",
        userEmail: user.email,
        questionId: q.id,
        questionTitle: q.title,
        topic: q.topic,
        difficulty: q.difficulty,
        userQuery: sql,
        status,
        points: pts,
        todayDate,
        createdAt: serverTimestamp(),
        submittedAt: serverTimestamp(),
      });

      // 2. Also record in main submissions collection so it appears in student submission counts & history
      await addDoc(collection(db, "submissions"), {
        userId: user.uid,
        userName: profile.displayName || user.displayName || "Student",
        userEmail: user.email,
        problemId: q.id,
        problemTitle: `[SQL] ${q.title}`,
        language: "sql",
        status: isExpectedMatch ? "accepted" : "pending",
        runtime: 14,
        score: pts,
        todayDate,
        createdAt: serverTimestamp(),
      });

      // 3. Update user profile stats
      const userUpdate: Record<string, any> = {
        totalSubmissions: increment(1),
      };
      if (isExpectedMatch && !solved.has(q.id)) {
        userUpdate.problemsSolved = increment(1);
        userUpdate.score = increment(pts);
      }
      await updateDoc(doc(db, "users", user.uid), userUpdate);

      if (isExpectedMatch) {
        setSolved(prev => new Set([...prev, q.id]));
        setPending(prev => {
          const next = new Set(prev);
          next.delete(q.id);
          return next;
        });
        toast.success(`Query Verified & Accepted! +${pts} pts awarded 🎉`);
      } else {
        setPending(prev => new Set([...prev, q.id]));
        toast.success("Query submitted! Counted in your submissions & sent for review.");
      }
    } catch (err) {
      toast.error("Submission failed!");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggle = (id: string, setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>) => {
    setter(p => ({ ...p, [id]: !p[id] }));
  };

  const blockCopyPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    toast.error("Copy/Paste is disabled for fair assessment!");
  };

  const filtered = questions.filter(q => {
    const matchSearch = q.title.toLowerCase().includes(search.toLowerCase()) ||
      q.description.toLowerCase().includes(search.toLowerCase()) ||
      q.topic.toLowerCase().includes(search.toLowerCase());
    const matchTopic = topicFilter === "All" || q.topic === topicFilter;
    const matchDiff = diffFilter === "all" || q.difficulty === diffFilter;
    return matchSearch && matchTopic && matchDiff;
  });

  const solvedCount = questions.filter(q => solved.has(q.id)).length;
  const totalPoints = questions.filter(q => solved.has(q.id)).reduce((sum, q) => sum + (POINTS[q.difficulty] || 0), 0);

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-content" style={{ maxWidth: 900 }}>
          <div style={{ marginBottom: 32 }}>
            <div className="flex items-center gap-3" style={{ marginBottom: 10 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,rgba(34,211,238,0.2),rgba(6,182,212,0.1))", border: "1px solid rgba(34,211,238,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Database size={22} color="var(--cyan)" />
              </div>
              <div>
                <h1 className="font-display" style={{ fontSize: "clamp(22px,4vw,34px)", fontWeight: 800, margin: 0, lineHeight: 1.1 }}>
                  DBMS <span style={{ background: "linear-gradient(135deg,var(--cyan),#0891b2)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Lab</span>
                </h1>
                <p style={{ color: "var(--text-3)", fontSize: 13, margin: 0 }}>Write your SQL query — admin reviews and grades your submission</p>
              </div>
            </div>
            {user && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                  { label: "Passed", value: `${solvedCount}/${questions.length}`, color: "var(--cyan)" },
                  { label: "Points Earned", value: `${totalPoints} pts`, color: "var(--yellow)" },
                  { label: "Pending", value: questions.filter(q => pending.has(q.id)).length, color: "var(--yellow)" },
                  { label: "Easy", value: questions.filter(q=>q.difficulty==="easy").length, color: "var(--green)" },
                  { label: "Medium", value: questions.filter(q=>q.difficulty==="medium").length, color: "var(--yellow)" },
                  { label: "Hard", value: questions.filter(q=>q.difficulty==="hard").length, color: "var(--red)" },
                ].map((s, i) => (
                  <div key={i} className="glass-card" style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: "Plus Jakarta Sans, sans-serif" }}>{s.value}</span>
                    <span style={{ fontSize: 10, color: "var(--text-3)" }}>{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "1 1 220px" }}>
              <Search size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
              <input className="input" style={{ paddingLeft: 36 }} placeholder="Search questions..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input" style={{ flex: "0 0 auto" }} value={topicFilter} onChange={e => setTopicFilter(e.target.value)}>
              {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="flex gap-2">
              {["all","easy","medium","hard"].map(d => (
                <button key={d} onClick={() => setDiffFilter(d)}
                  className={`btn btn-sm ${diffFilter===d ? (d==="easy"?"btn-primary":d==="medium"?"btn-ghost":d==="hard"?"btn-danger":"btn-primary") : "btn-ghost"}`}
                  style={{ fontSize: 11, textTransform: "capitalize" }}>{d}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20, padding: "12px 16px", background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 10, fontSize: 12, color: "var(--text-2)", lineHeight: 1.7 }}>
            <strong style={{ color: "var(--cyan)" }}>How it works:</strong> Read the question, write your SQL query below, and click <em>Submit Query</em>. Your instructor reviews and marks it <strong style={{ color: "var(--green)" }}>Pass</strong> or <strong style={{ color: "var(--red)" }}>Fail</strong>. Points are awarded on Pass only.
            <div style={{ marginTop: 6, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ color: "var(--green)", fontSize: 11 }}>Easy = 10 pts</span>
              <span style={{ color: "var(--yellow)", fontSize: 11 }}>Medium = 25 pts</span>
              <span style={{ color: "var(--red)", fontSize: 11 }}>Hard = 50 pts</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(239,68,68,0.8)" }}>
                <ShieldOff size={11} /> Copy/Paste disabled for fair assessment
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center" style={{ padding: 80 }}><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-3)" }}>
              <Database size={48} style={{ marginBottom: 12, opacity: 0.2 }} />
              <p style={{ fontSize: 16 }}>{questions.length === 0 ? "No DBMS questions added yet. Ask your admin!" : "No questions match your filters."}</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filtered.map(q => {
                const isExpanded = expanded[q.id];
                const showHint = showHints[q.id];
                const isSolved = solved.has(q.id);
                const isPending = pending.has(q.id);
                const pts = POINTS[q.difficulty] || 10;
                const dc = q.difficulty === "easy" ? "diff-easy" : q.difficulty === "medium" ? "diff-medium" : "diff-hard";
                const cardBorder = isSolved
                  ? "1px solid rgba(16,185,129,0.35)"
                  : isPending ? "1px solid rgba(245,158,11,0.35)"
                  : "1px solid var(--border)";

                return (
                  <div key={q.id} id={`q-${q.id}`} className="glass-card" style={{ padding: 0, overflow: "hidden", border: cardBorder, transition: "all 0.2s" }}>
                    <button onClick={() => toggle(q.id, setExpanded)} style={{ width: "100%", background: "none", border: "none", padding: "16px 20px", cursor: "pointer", textAlign: "left" }}>
                      <div className="flex items-center justify-between gap-3" style={{ flexWrap: "wrap" }}>
                        <div className="flex items-center gap-3 flex-1" style={{ minWidth: 0 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.2)", fontWeight: 800, fontSize: 11, color: "var(--cyan)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                            {q.type === "query" ? "SQL" : q.type === "theory" ? "TH" : q.type === "normalization" ? "NF" : "SD"}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 4 }}>
                              {isSolved && <CheckCircle2 size={14} color="var(--green)" />}
                              {isPending && !isSolved && <Clock size={14} color="var(--yellow)" />}
                              <span style={{ fontWeight: 700, fontSize: 15 }}>{q.title}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`badge ${dc}`}>{q.difficulty}</span>
                              <span className={`badge ${typeColor(q.type)}`}>{q.type}</span>
                              <span style={{ fontSize: 11, color: "var(--text-3)" }}>{q.topic}</span>
                              <span style={{ fontSize: 11, color: "var(--yellow)", marginLeft: "auto" }}>+{pts} pts</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {isSolved ? (
                            <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 700 }}>PASSED</span>
                          ) : isPending ? (
                            <span style={{ fontSize: 11, color: "var(--yellow)", fontWeight: 700 }}>PENDING</span>
                          ) : (
                            <span style={{ fontSize: 11, color: "var(--text-3)" }}>attempt</span>
                          )}
                          {isExpanded ? <ChevronUp size={16} color="var(--text-3)" /> : <ChevronDown size={16} color="var(--text-3)" />}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--border)" }}>
                        <div style={{ paddingTop: 16 }}>
                          <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.75, marginBottom: 18 }}>{q.description}</p>

                          {q.tableData && q.tableData.some(t => t.name) && (
                            <div style={{ marginBottom: 18 }}>
                              <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                                <Table2 size={13} color="var(--cyan)" />
                                <span style={{ fontWeight: 700, fontSize: 13, color: "var(--cyan)" }}>Sample Data Tables</span>
                              </div>
                              {q.tableData.filter(t => t.name).map((t, ti) => (
                                <div key={ti} style={{ marginBottom: 12 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 6, fontFamily: "JetBrains Mono,monospace" }}>Table: {t.name}</div>
                                  <div style={{ overflowX: "auto" }}>
                                    <table style={{ width: "auto", minWidth: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "JetBrains Mono,monospace" }}>
                                      <thead>
                                        <tr style={{ background: "rgba(34,211,238,0.08)" }}>
                                          {t.columns.split(",").map((col, ci) => (
                                            <th key={ci} style={{ padding: "6px 14px", textAlign: "left", color: "var(--cyan)", fontSize: 11, borderBottom: "1px solid rgba(34,211,238,0.2)" }}>{col.trim()}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {t.rows.split("\n").filter(Boolean).map((row, ri) => (
                                          <tr key={ri} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                            {row.split(",").map((cell, ci) => (
                                              <td key={ci} style={{ padding: "5px 14px", color: "var(--text-2)" }}>{cell.trim()}</td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {q.sampleSchema && (
                            <div style={{ marginBottom: 18 }}>
                              <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                                <Code2 size={13} color="var(--purple-light)" />
                                <span style={{ fontWeight: 700, fontSize: 13, color: "var(--purple-light)" }}>SQL Schema</span>
                              </div>
                              <pre style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: "var(--radius-sm)", padding: "12px 16px", fontFamily: "JetBrains Mono,monospace", fontSize: 12, overflowX: "auto", color: "var(--text-1)", lineHeight: 1.6, margin: 0 }}>{q.sampleSchema}</pre>
                            </div>
                          )}

                          <div style={{ marginBottom: 16 }}>
                            <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                              <Send size={13} color="var(--yellow)" />
                              <span style={{ fontWeight: 700, fontSize: 13, color: "var(--yellow)" }}>Write Your SQL Query</span>
                              <span style={{ fontSize: 10, color: "rgba(239,68,68,0.8)", marginLeft: "auto", display: "flex", alignItems: "center", gap: 3 }}>
                                <ShieldOff size={9} /> No copy/paste
                              </span>
                            </div>

                            <div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)", borderRadius: 8, marginBottom: 10, fontSize: 12, color: "var(--text-2)", lineHeight: 1.7 }}>
                              <strong>Instructions:</strong> Type your SQL query directly in the box below. Copy/paste is disabled. Your instructor will review and mark it Pass or Fail.
                            </div>

                            {isSolved ? (
                              <div style={{ padding: "14px 16px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
                                <CheckCircle2 size={18} color="var(--green)" />
                                <div>
                                  <div style={{ color: "var(--green)", fontWeight: 700, fontSize: 14 }}>Passed! +{pts} points awarded</div>
                                  <div style={{ color: "var(--text-3)", fontSize: 12, marginTop: 2 }}>Admin has marked your submission as Pass.</div>
                                </div>
                              </div>
                            ) : isPending ? (
                              <div style={{ padding: "14px 16px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
                                <Clock size={18} color="var(--yellow)" />
                                <div>
                                  <div style={{ color: "var(--yellow)", fontWeight: 700, fontSize: 14 }}>Submission Pending Review</div>
                                  <div style={{ color: "var(--text-3)", fontSize: 12, marginTop: 2 }}>Your query has been submitted. Waiting for admin to grade it.</div>
                                </div>
                              </div>
                            ) : (
                              <>
                                <textarea
                                  className="input"
                                  rows={6}
                                  style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 13, resize: "vertical" }}
                                  placeholder={"Write your SQL query here...\n\nExample:\nSELECT name, salary\nFROM Employee\nWHERE salary > 50000\nORDER BY salary DESC;"}
                                  value={userQuery[q.id] || ""}
                                  onChange={e => setUserQuery(p => ({ ...p, [q.id]: e.target.value }))}
                                  onCopy={blockCopyPaste}
                                  onCut={blockCopyPaste}
                                  onPaste={blockCopyPaste}
                                  disabled={!user}
                                  spellCheck={false}
                                  autoCorrect="off"
                                  autoCapitalize="off"
                                />
                                {!user && (
                                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 5 }}>
                                    <Lock size={11} /> Login to submit your query
                                  </div>
                                )}
                                <button
                                  onClick={() => handleSubmit(q)}
                                  disabled={isSubmitting || !user}
                                  style={{ marginTop: 12, padding: "10px 22px", background: user ? "linear-gradient(135deg,var(--cyan),#0891b2)" : "rgba(0,0,0,0.3)", color: user ? "#000" : "var(--text-3)", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: user ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s", boxShadow: user ? "0 4px 16px rgba(34,211,238,0.28)" : "none" }}>
                                  {isSubmitting
                                    ? <><div style={{ width: 13, height: 13, border: "2px solid rgba(0,0,0,0.3)", borderTop: "2px solid #000", borderRadius: "50%", animation: "spin-slow 0.8s linear infinite" }} /> Submitting...</>
                                    : user
                                    ? <><Send size={13} /> Submit Query (earn {pts} pts on pass)</>
                                    : <><Lock size={13} /> Login to Submit</>}
                                </button>
                              </>
                            )}
                          </div>

                          {q.hint && (
                            <div style={{ marginBottom: 12 }}>
                              <button className="btn btn-ghost btn-sm" style={{ color: "var(--yellow)", borderColor: "rgba(245,158,11,0.28)" }} onClick={() => toggle(q.id, setShowHints)}>
                                <Lightbulb size={11} /> {showHint ? "Hide Hint" : "Show Hint"}
                              </button>
                              {showHint && (
                                <div style={{ marginTop: 8, padding: "11px 14px", background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.22)", borderRadius: "var(--radius-sm)" }}>
                                  <span style={{ fontWeight: 700, fontSize: 12, color: "var(--yellow)" }}>Hint: </span>
                                  <span style={{ fontSize: 13, color: "var(--text-2)" }}>{q.hint}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {isSolved && q.explanation && (
                            <div style={{ marginTop: 12, padding: "11px 14px", background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.22)", borderRadius: "var(--radius-sm)" }}>
                              <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                                <BookOpen size={12} color="var(--purple-light)" />
                                <span style={{ fontWeight: 700, fontSize: 12, color: "var(--purple-light)" }}>Explanation (unlocked after passing)</span>
                              </div>
                              <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.7, margin: 0 }}>{q.explanation}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ textAlign: "center", marginTop: 48, paddingTop: 16, borderTop: "1px solid rgba(34,211,238,0.08)", fontSize: 11, color: "rgba(34,211,238,0.25)", fontFamily: "JetBrains Mono,monospace", letterSpacing: "0.1em" }}>
            CodeForge MCA -- DBMS Lab -- by <strong style={{ color: "rgba(34,211,238,0.4)" }}>Rakshil Gandhi</strong>
          </div>
        </div>
      </div>
    </>
  );
};

export default DBMSPage;
