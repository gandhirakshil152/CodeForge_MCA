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
  CheckCircle2, Send, XCircle, Star,
  Lock, Trophy,
} from "lucide-react";
import toast from "react-hot-toast";

interface TableDef { name: string; columns: string; rows: string; }

interface DbmsQuestion {
  id: string; title: string; topic: string;
  difficulty: "easy" | "medium" | "hard";
  type: "query" | "theory" | "normalization" | "design";
  description: string; hint?: string; sampleSchema?: string;
  expectedQuery?: string; expectedOutput?: string; explanation?: string;
  tableData?: TableDef[]; addedBy?: string;
}

const POINTS: Record<string, number> = { easy: 10, medium: 25, hard: 50 };

const typeColor = (t: string) =>
  t === "query" ? "badge-cyan" : t === "theory" ? "badge-purple"
  : t === "normalization" ? "badge-yellow" : "badge-pink";

const TOPICS = ["All","SQL Basics","Joins","Subqueries","Aggregation","Normalization",
  "Indexing","Transactions","Stored Procedures","Views","ER Diagrams","Keys & Constraints","Other"];

const normalizeOutput = (s: string) =>
  s.trim().toLowerCase()
   .replace(/\r\n/g, "\n")
   .replace(/[ \t]+/g, " ")
   .replace(/ *\| */g, "|")
   .replace(/\n+/g, "\n")
   .replace(/^[-|+ \t]+$/gm, "")
   .split("\n").map(l => l.trim()).filter(Boolean).join("\n");

const DBMSPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [questions, setQuestions] = useState<DbmsQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState("All");
  const [diffFilter, setDiffFilter] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showHints, setShowHints] = useState<Record<string, boolean>>({});
  const [userOutput, setUserOutput] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, "correct" | "wrong" | null>>({});
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [qSnap, subSnap] = await Promise.all([
          getDocs(query(collection(db, "dbms_questions"), orderBy("createdAt", "desc"))),
          user ? getDocs(query(collection(db, "dbms_submissions"), orderBy("submittedAt", "desc"))) : Promise.resolve(null),
        ]);
        setQuestions(qSnap.docs.map(d => ({ id: d.id, ...d.data() } as DbmsQuestion)));
        if (subSnap && user) {
          const solvedIds = new Set<string>();
          subSnap.docs.forEach(d => {
            const data = d.data() as any;
            if (data.userId === user.uid && data.status === "correct") solvedIds.add(data.questionId);
          });
          setSolved(solvedIds);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, [user]);

  const handleSubmit = async (q: DbmsQuestion) => {
    if (!user || !profile) { toast.error("Please login first!"); return; }
    const userAns = userOutput[q.id] || "";
    if (!userAns.trim()) { toast.error("Please paste your query output first!"); return; }
    setIsSubmitting(true);
    try {
      const expected = q.expectedOutput || "";
      const isCorrect = expected.trim() ? normalizeOutput(userAns) === normalizeOutput(expected) : false;
      const status = isCorrect ? "correct" : "wrong";
      const pts = isCorrect ? (POINTS[q.difficulty] ?? 10) : 0;
      await addDoc(collection(db, "dbms_submissions"), {
        userId: user.uid, userName: profile.displayName, userEmail: user.email,
        questionId: q.id, questionTitle: q.title, topic: q.topic, difficulty: q.difficulty,
        userOutput: userAns, expectedOutput: expected, status, points: pts,
        submittedAt: serverTimestamp(),
      });
      if (isCorrect && !solved.has(q.id)) {
        await updateDoc(doc(db, "users", user.uid), {
          score: increment(pts), problemsSolved: increment(1),
        });
        setSolved(prev => new Set([...prev, q.id]));
        toast.success(`Correct! +${pts} points!`);
      } else if (isCorrect) {
        toast.success("Correct! (already solved, no extra points)");
      } else {
        if (!expected.trim()) toast.error("No expected output set by admin yet. Ask your admin to add it!");
        else toast.error("Output does not match. Check your query and try again!");
      }
      setResults(p => ({ ...p, [q.id]: status }));
    } catch (err) { toast.error("Submission failed!"); console.error(err); }
    finally { setIsSubmitting(false); }
  };

  const toggle = (id: string, map: Record<string, boolean>, setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>) => {
    setter(p => ({ ...p, [id]: !p[id] }));
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

          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <div className="flex items-center gap-3" style={{ marginBottom: 10 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,rgba(34,211,238,0.2),rgba(6,182,212,0.1))", border: "1px solid rgba(34,211,238,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Database size={22} color="var(--cyan)" />
              </div>
              <div>
                <h1 className="font-display" style={{ fontSize: "clamp(22px,4vw,34px)", fontWeight: 800, margin: 0, lineHeight: 1.1 }}>
                  DBMS <span style={{ background: "linear-gradient(135deg,var(--cyan),#0891b2)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Lab</span>
                </h1>
                <p style={{ color: "var(--text-3)", fontSize: 13, margin: 0 }}>Output-based SQL grading — write your query, run it, paste the result</p>
              </div>
            </div>

            {user && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                  { label: "Solved", value: `${solvedCount}/${questions.length}`, color: "var(--cyan)" },
                  { label: "Points Earned", value: `${totalPoints} pts`, color: "var(--yellow)" },
                  { label: "Easy", value: questions.filter(q=>q.difficulty==="easy").length, color: "var(--green)" },
                  { label: "Medium", value: questions.filter(q=>q.difficulty==="medium").length, color: "var(--yellow)" },
                  { label: "Hard", value: questions.filter(q=>q.difficulty==="hard").length, color: "var(--red)" },
                ].map((s, i) => (
                  <div key={i} className="glass-card" style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: "Syne,sans-serif" }}>{s.value}</span>
                    <span style={{ fontSize: 10, color: "var(--text-3)" }}>{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Filters */}
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

          {/* Grading info banner */}
          <div style={{ marginBottom: 20, padding: "12px 16px", background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 10, fontSize: 12, color: "var(--text-2)", lineHeight: 1.7 }}>
            <strong style={{ color: "var(--cyan)" }}>How output-based grading works:</strong> Write your SQL query in any SQL tool (MySQL Workbench, SQLite, DBeaver, etc.), execute it, copy the result table, and paste it below. The system compares your output with the admin-defined expected output. Multiple valid SQL queries that produce the same output are all accepted!
            <div style={{ marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span style={{ color: "var(--green)", fontSize: 11 }}>Easy = 10 pts</span>
              <span style={{ color: "var(--yellow)", fontSize: 11 }}>Medium = 25 pts</span>
              <span style={{ color: "var(--red)", fontSize: 11 }}>Hard = 50 pts</span>
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
                const result = results[q.id];
                const isSolved = solved.has(q.id);
                const pts = POINTS[q.difficulty] || 10;
                const dc = q.difficulty === "easy" ? "diff-easy" : q.difficulty === "medium" ? "diff-medium" : "diff-hard";

                return (
                  <div key={q.id} className="glass-card" style={{ padding: 0, overflow: "hidden", border: isSolved ? "1px solid rgba(16,185,129,0.3)" : "1px solid var(--border)", transition: "all 0.2s" }}>
                    {/* Question header */}
                    <button onClick={() => toggle(q.id, expanded, setExpanded)} style={{ width: "100%", background: "none", border: "none", padding: "16px 20px", cursor: "pointer", textAlign: "left" }}>
                      <div className="flex items-center justify-between gap-3" style={{ flexWrap: "wrap" }}>
                        <div className="flex items-center gap-3 flex-1" style={{ minWidth: 0 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.2)", fontWeight: 800, fontSize: 11, color: "var(--cyan)", fontFamily: "Syne,sans-serif" }}>
                            {q.type === "query" ? "SQL" : q.type === "theory" ? "TH" : q.type === "normalization" ? "NF" : "SD"}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 4 }}>
                              {isSolved && <CheckCircle2 size={14} color="var(--green)" />}
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
                            <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 700 }}>SOLVED</span>
                          ) : (
                            <span style={{ fontSize: 11, color: "var(--text-3)" }}>attempt</span>
                          )}
                          {isExpanded ? <ChevronUp size={16} color="var(--text-3)" /> : <ChevronDown size={16} color="var(--text-3)" />}
                        </div>
                      </div>
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--border)" }}>
                        <div style={{ paddingTop: 16 }}>

                          <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.75, marginBottom: 18 }}>{q.description}</p>

                          {/* Sample data tables */}
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

                          {/* Output submission area */}
                          <div style={{ marginBottom: 16 }}>
                            <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                              <Send size={13} color="var(--yellow)" />
                              <span style={{ fontWeight: 700, fontSize: 13, color: "var(--yellow)" }}>Submit Your Output</span>
                              <span style={{ fontSize: 10, color: "var(--text-3)", marginLeft: "auto", display: "flex", alignItems: "center", gap: 3 }}>
                                <Lock size={9} /> Output-based grading
                              </span>
                            </div>

                            <div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)", borderRadius: 8, marginBottom: 10, fontSize: 12, color: "var(--text-2)", lineHeight: 1.7 }}>
                              <strong>How to submit:</strong> Run your SQL query in any tool (MySQL, SQLite, DBeaver, etc.), copy the output table, paste it below. Any valid SQL that produces the correct result is accepted!
                            </div>

                            <textarea
                              className="input" rows={5}
                              style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 12, resize: "vertical", borderColor: result === "correct" ? "rgba(16,185,129,0.4)" : result === "wrong" ? "rgba(239,68,68,0.4)" : undefined }}
                              placeholder={"Paste your query output here...\n\nExample:\nname     | salary\n---------|--------\nAlice    | 75000\nBob      | 90000"}
                              value={userOutput[q.id] || ""}
                              onChange={e => { setUserOutput(p => ({ ...p, [q.id]: e.target.value })); setResults(p => ({ ...p, [q.id]: null })); }}
                              disabled={isSolved}
                            />

                            {result === "correct" && (
                              <div style={{ marginTop: 8, padding: "10px 14px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.35)", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
                                <CheckCircle2 size={16} color="var(--green)" />
                                <span style={{ color: "var(--green)", fontWeight: 700, fontSize: 13 }}>Correct! +{pts} points awarded!</span>
                              </div>
                            )}
                            {result === "wrong" && (
                              <div style={{ marginTop: 8, padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
                                <XCircle size={16} color="var(--red)" />
                                <span style={{ color: "var(--red)", fontWeight: 700, fontSize: 13 }}>Output does not match. Check your query and try again!</span>
                              </div>
                            )}
                            {isSolved && result !== "correct" && (
                              <div style={{ marginTop: 8, padding: "8px 14px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 8, fontSize: 12, color: "var(--green)" }}>You have already solved this question!</div>
                            )}

                            {!isSolved && (
                              <button onClick={() => handleSubmit(q)} disabled={isSubmitting || !user}
                                style={{ marginTop: 12, padding: "10px 22px", background: user ? "linear-gradient(135deg,var(--cyan),#0891b2)" : "rgba(0,0,0,0.3)", color: user ? "#000" : "var(--text-3)", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: user ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s", boxShadow: user ? "0 4px 16px rgba(34,211,238,0.28)" : "none" }}>
                                {isSubmitting ? <><div style={{ width: 13, height: 13, border: "2px solid rgba(0,0,0,0.3)", borderTop: "2px solid #000", borderRadius: "50%", animation: "spin-slow 0.8s linear infinite" }} /> Checking...</> : user ? <><Send size={13} /> Submit Output (+{pts} pts)</> : <><Lock size={13} /> Login to Submit</>}
                              </button>
                            )}
                          </div>

                          {q.hint && (
                            <div style={{ marginBottom: 12 }}>
                              <button className="btn btn-ghost btn-sm" style={{ color: "var(--yellow)", borderColor: "rgba(245,158,11,0.28)" }} onClick={() => toggle(q.id, showHints, setShowHints)}>
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
                                <span style={{ fontWeight: 700, fontSize: 12, color: "var(--purple-light)" }}>Explanation (unlocked after solving)</span>
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