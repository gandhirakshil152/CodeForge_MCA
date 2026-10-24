import React, { useEffect, useState } from "react";
import {
  collection, getDocs, query, orderBy, where, addDoc, serverTimestamp,
  doc, updateDoc, increment,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import {
  Database, Search, ChevronDown, ChevronUp,
  Lightbulb, Table2, Code2, BookOpen,
  CheckCircle2, Send, Clock,
  Lock, ShieldOff, Play, AlertCircle,
  MessageSquare, Terminal, Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  executeSqlInDb, verifySqlMatch, parseColumns, parseRows, parseRowCells,
  type TableDef, type SqlQueryResult, type SqlDialect, SQL_DIALECT_OPTIONS,
} from "../utils/sqlRunner";

interface DbmsQuestion {
  id: string;
  title: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  type: "query" | "theory" | "normalization" | "design";
  description: string;
  hint?: string;
  sampleSchema?: string;
  expectedQuery?: string;
  expectedOutput?: string;
  explanation?: string;
  tableData?: TableDef[];
  addedBy?: string;
}

const POINTS: Record<string, number> = { easy: 10, medium: 25, hard: 50 };

const typeColor = (t: string) =>
  t === "query" ? "badge-cyan" : t === "theory" ? "badge-purple"
  : t === "normalization" ? "badge-yellow" : "badge-pink";

const TOPICS = [
  "All", "SQL Basics", "Joins", "Subqueries", "Aggregation", "Normalization",
  "Indexing", "Transactions", "Stored Procedures", "Views", "ER Diagrams",
  "Keys & Constraints", "Other",
];

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
  
  // Submission Status tracking
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [userSubmissions, setUserSubmissions] = useState<Record<string, any>>({});
  const [mySubmissionsList, setMySubmissionsList] = useState<any[]>([]);
  const [showMySubmissions, setShowMySubmissions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // In-Browser Multi-Dialect SQL Runner State (SQLite, MySQL, MSSQL)
  const [selectedDialect, setSelectedDialect] = useState<Record<string, SqlDialect>>({});
  const [testResults, setTestResults] = useState<Record<string, SqlQueryResult>>({});
  const [runningTest, setRunningTest] = useState<Record<string, boolean>>({});
  const [referenceResults, setReferenceResults] = useState<Record<string, SqlQueryResult>>({});
  const [runningReference, setRunningReference] = useState<Record<string, boolean>>({});

  const getDialect = (qId: string): SqlDialect => selectedDialect[qId] || 'sqlite';

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const qQuery = query(collection(db, "dbms_questions"), orderBy("createdAt", "desc"));
        const subQuery = user
          ? query(collection(db, "dbms_submissions"), where("userId", "==", user.uid))
          : null;

        const [qSnap, subSnap] = await Promise.all([
          getDocs(qQuery),
          subQuery ? getDocs(subQuery) : Promise.resolve(null),
        ]);

        setQuestions(qSnap.docs.map(d => ({ id: d.id, ...d.data() } as DbmsQuestion)));

        if (subSnap && user) {
          const solvedIds = new Set<string>();
          const failedIds = new Set<string>();
          const pendingIds = new Set<string>();
          const subMap: Record<string, any> = {};
          const allUserSubs: any[] = [];
          const prefillQueries: Record<string, string> = {};

          // Sort by submittedAt descending client-side to prevent composite index requirements
          const docs = subSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          docs.sort((a: any, b: any) => {
            const tA = a.submittedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
            const tB = b.submittedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
            return tB - tA;
          });

          docs.forEach((data: any) => {
            allUserSubs.push(data);
            if (!subMap[data.questionId]) {
              subMap[data.questionId] = data;
              if (data.userQuery) {
                prefillQueries[data.questionId] = data.userQuery;
              }
              if (data.status === "pass") solvedIds.add(data.questionId);
              else if (data.status === "fail") failedIds.add(data.questionId);
              else if (data.status === "pending") pendingIds.add(data.questionId);
            }
          });

          setUserSubmissions(subMap);
          setSolved(solvedIds);
          setFailed(failedIds);
          setPending(pendingIds);
          setMySubmissionsList(allUserSubs);
          setUserQuery(prev => ({ ...prefillQueries, ...prev }));
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

  // Execute student's SQL query in in-memory SQLite database with dialect support
  const handleRunUserSql = async (q: DbmsQuestion) => {
    const sql = userQuery[q.id] || "";
    if (!sql.trim()) {
      toast.error("Please write a SQL query to run!");
      return;
    }
    const dialect = getDialect(q.id);
    setRunningTest(p => ({ ...p, [q.id]: true }));
    try {
      const res = await executeSqlInDb(sql, q.tableData, q.sampleSchema, dialect);
      setTestResults(p => ({ ...p, [q.id]: res }));
      if (res.success) {
        toast.success(`[${dialect.toUpperCase()}] Executed in ${res.executionTimeMs}ms (${res.values.length} rows returned)`);
      } else {
        toast.error(`[${dialect.toUpperCase()}] SQL Error: ` + (res.error || "Query failed to execute"));
      }
    } catch (err: any) {
      toast.error("Runner error: " + err?.message);
    } finally {
      setRunningTest(p => ({ ...p, [q.id]: false }));
    }
  };

  // Execute reference expected query in in-memory SQLite so student can inspect how it works
  const handleRunReferenceSql = async (q: DbmsQuestion) => {
    if (!q.expectedQuery) {
      toast.error("No reference query configured for this problem.");
      return;
    }
    setRunningReference(p => ({ ...p, [q.id]: true }));
    try {
      const res = await executeSqlInDb(q.expectedQuery, q.tableData, q.sampleSchema);
      setReferenceResults(p => ({ ...p, [q.id]: res }));
      if (res.success) {
        toast.success(`Reference solution executed in ${res.executionTimeMs}ms`);
      } else {
        toast.error("Reference SQL Error: " + (res.error || "Failed"));
      }
    } catch (err: any) {
      toast.error("Runner error: " + err?.message);
    } finally {
      setRunningReference(p => ({ ...p, [q.id]: false }));
    }
  };

  const handleSubmit = async (q: DbmsQuestion) => {
    if (!user || !profile) { toast.error("Please login first!"); return; }
    const sql = userQuery[q.id] || "";
    if (!sql.trim()) { toast.error("Please type your SQL query first!"); return; }
    setIsSubmitting(true);
    try {
      const todayDate = new Date().toISOString().slice(0, 10);
      const earnedPts = POINTS[q.difficulty] || 10;
      
      const dialect = getDialect(q.id);

      // Auto-verify if expectedQuery matches (direct text match OR relational output equivalence across dialects)
      let isExpectedMatch = Boolean(
        q.expectedQuery && 
        normalizeSql(sql) === normalizeSql(q.expectedQuery)
      );

      if (!isExpectedMatch && q.expectedQuery) {
        try {
          const matchRes = await verifySqlMatch(sql, q.expectedQuery, q.tableData, q.sampleSchema, dialect);
          if (matchRes.match) {
            isExpectedMatch = true;
          }
        } catch (e) {
          console.warn("SQL auto-verify exception:", e);
        }
      }

      const status = isExpectedMatch ? "pass" : "pending";
      const pts = isExpectedMatch ? earnedPts : 0;

      // 1. Record in dbms_submissions
      const subDocRef = await addDoc(collection(db, "dbms_submissions"), {
        userId: user.uid,
        userName: profile.displayName || user.displayName || "Student",
        userEmail: user.email,
        questionId: q.id,
        questionTitle: q.title,
        topic: q.topic,
        difficulty: q.difficulty,
        userQuery: sql,
        dialect,
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
        problemTitle: `[SQL/${dialect.toUpperCase()}] ${q.title}`,
        language: `sql-${dialect}`,
        status: isExpectedMatch ? "accepted" : "pending",
        runtime: 14,
        score: pts,
        code: sql,
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

      const newSubData = {
        id: subDocRef.id,
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
        submittedAt: new Date(),
      };

      setUserSubmissions(prev => ({ ...prev, [q.id]: newSubData }));
      setMySubmissionsList(prev => [newSubData, ...prev]);

      if (isExpectedMatch) {
        setSolved(prev => new Set([...prev, q.id]));
        setFailed(prev => { const next = new Set(prev); next.delete(q.id); return next; });
        setPending(prev => { const next = new Set(prev); next.delete(q.id); return next; });
        toast.success(`Query Verified & Accepted! +${pts} pts awarded 🎉`);
      } else {
        setPending(prev => new Set([...prev, q.id]));
        setFailed(prev => { const next = new Set(prev); next.delete(q.id); return next; });
        toast.success("Query submitted! Saved in your submissions & sent for faculty review.");
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
  const failedCount = questions.filter(q => failed.has(q.id)).length;
  const pendingCount = questions.filter(q => pending.has(q.id)).length;
  const totalPoints = questions.filter(q => solved.has(q.id)).reduce((sum, q) => sum + (POINTS[q.difficulty] || 0), 0);

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-content" style={{ maxWidth: 960 }}>
          {/* Hero Section */}
          <div style={{ marginBottom: 28 }}>
            <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,rgba(34,211,238,0.2),rgba(6,182,212,0.1))", border: "1px solid rgba(34,211,238,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Database size={22} color="var(--cyan)" />
              </div>
              <div>
                <h1 className="font-display" style={{ fontSize: "clamp(22px,4vw,34px)", fontWeight: 800, margin: 0, lineHeight: 1.1 }}>
                  DBMS <span style={{ background: "linear-gradient(135deg,var(--cyan),#0891b2)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Lab & Query Studio</span>
                </h1>
                <p style={{ color: "var(--text-3)", fontSize: 13, margin: 0 }}>Interactive in-browser SQLite environment — test your queries, view faculty feedback, and learn solutions</p>
              </div>
            </div>

            {user && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {[
                  { label: "Passed", value: `${solvedCount}/${questions.length}`, color: "var(--green)" },
                  { label: "Needs Revision", value: `${failedCount}`, color: "var(--red)" },
                  { label: "Pending Review", value: `${pendingCount}`, color: "var(--yellow)" },
                  { label: "Points Earned", value: `${totalPoints} pts`, color: "var(--cyan)" },
                ].map((s, i) => (
                  <div key={i} className="glass-card" style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: "Plus Jakarta Sans, sans-serif" }}>{s.value}</span>
                    <span style={{ fontSize: 10, color: "var(--text-3)" }}>{s.label}</span>
                  </div>
                ))}

                {/* My SQL Submissions Toggle Button */}
                <button
                  className="btn btn-ghost btn-sm"
                  style={{
                    marginLeft: "auto",
                    background: showMySubmissions ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.04)",
                    color: showMySubmissions ? "var(--cyan)" : "var(--text-2)",
                    border: "1px solid rgba(34,211,238,0.25)",
                    padding: "8px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                  onClick={() => setShowMySubmissions(!showMySubmissions)}>
                  <Clock size={13} />
                  My SQL Submissions & Feedback ({mySubmissionsList.length})
                  {showMySubmissions ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>
            )}
          </div>

          {/* ── My SQL Submissions & Feedback Drawer ── */}
          {showMySubmissions && (
            <div className="glass-card" style={{ marginBottom: 24, padding: 0, overflow: "hidden", border: "1px solid rgba(34,211,238,0.28)" }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(34,211,238,0.04)" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--cyan)", display: "flex", alignItems: "center", gap: 6 }}>
                  <MessageSquare size={14} /> My SQL Submissions & Instructor Reviews
                </span>
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>{mySubmissionsList.length} submissions recorded</span>
              </div>
              {mySubmissionsList.length === 0 ? (
                <div style={{ padding: "28px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
                  You haven't submitted any SQL queries yet. Select a problem below to begin!
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Question</th>
                        <th>Status</th>
                        <th>Score</th>
                        <th>Query Preview</th>
                        <th>Faculty Remarks & Feedback</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mySubmissionsList.map((sub, i) => (
                        <tr key={sub.id || i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ fontWeight: 600 }}>{sub.questionTitle || sub.questionId}</td>
                          <td>
                            <span style={{
                              fontWeight: 700, fontSize: 11, padding: "2px 7px", borderRadius: 4,
                              background: sub.status === "pass" ? "rgba(16,185,129,0.12)" : sub.status === "fail" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
                              color: sub.status === "pass" ? "var(--green)" : sub.status === "fail" ? "var(--red)" : "var(--yellow)",
                              border: `1px solid ${sub.status === "pass" ? "rgba(16,185,129,0.3)" : sub.status === "fail" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`
                            }}>
                              {sub.status === "pass" ? "✓ Passed" : sub.status === "fail" ? "✕ Needs Revision" : "⏳ Pending"}
                            </span>
                          </td>
                          <td style={{ color: "var(--yellow)", fontWeight: 700 }}>+{sub.points || 0}</td>
                          <td style={{ maxWidth: 200 }}>
                            <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {sub.userQuery || "(no query text)"}
                            </div>
                          </td>
                          <td style={{ maxWidth: 260 }}>
                            {sub.adminRemarks ? (
                              <div style={{ fontSize: 11, color: "var(--text-1)", fontStyle: "italic", background: "rgba(0,0,0,0.25)", padding: "4px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)" }}>
                                💬 "{sub.adminRemarks}"
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: "var(--text-3)" }}>No remarks yet</span>
                            )}
                          </td>
                          <td style={{ fontSize: 11, color: "var(--text-3)" }}>
                            {sub.submittedAt?.toDate?.()?.toLocaleDateString() || sub.todayDate || "Recent"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Search & Topic Filters */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "1 1 220px" }}>
              <Search size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
              <input className="input" style={{ paddingLeft: 36 }} placeholder="Search DBMS questions by title or keyword..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input" style={{ flex: "0 0 auto" }} value={topicFilter} onChange={e => setTopicFilter(e.target.value)}>
              {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="flex gap-2">
              {["all", "easy", "medium", "hard"].map(d => (
                <button key={d} onClick={() => setDiffFilter(d)}
                  className={`btn btn-sm ${diffFilter === d ? (d === "easy" ? "btn-primary" : d === "medium" ? "btn-ghost" : d === "hard" ? "btn-danger" : "btn-primary") : "btn-ghost"}`}
                  style={{ fontSize: 11, textTransform: "capitalize" }}>{d}</button>
              ))}
            </div>
          </div>

          {/* Quick Lab Guide */}
          <div style={{ marginBottom: 20, padding: "12px 16px", background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 10, fontSize: 12, color: "var(--text-2)", lineHeight: 1.7 }}>
            <strong style={{ color: "var(--cyan)" }}>Interactive DBMS Lab:</strong> Write your SQL query and click <strong style={{ color: "var(--cyan)" }}>"Test in SQLite"</strong> to execute in real-time and inspect output tables. Once satisfied, click <strong style={{ color: "var(--yellow)" }}>"Submit Query"</strong>. If your query needs revision, your instructor's remarks will appear directly in this section so you can adjust and re-test!
            <div style={{ marginTop: 6, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ color: "var(--green)", fontSize: 11 }}>Easy = 10 pts</span>
              <span style={{ color: "var(--yellow)", fontSize: 11 }}>Medium = 25 pts</span>
              <span style={{ color: "var(--red)", fontSize: 11 }}>Hard = 50 pts</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(239,68,68,0.8)" }}>
                <ShieldOff size={11} /> Copy/Paste disabled for fair assessment
              </span>
            </div>
          </div>

          {/* Questions List */}
          {loading ? (
            <div className="flex justify-center" style={{ padding: 80 }}><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-3)" }}>
              <Database size={48} style={{ marginBottom: 12, opacity: 0.2 }} />
              <p style={{ fontSize: 16 }}>{questions.length === 0 ? "No DBMS questions added yet. Ask your instructor!" : "No questions match your filters."}</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {filtered.map(q => {
                const isExpanded = expanded[q.id];
                const showHint = showHints[q.id];
                const isSolved = solved.has(q.id);
                const isFailed = failed.has(q.id) && !isSolved;
                const isPending = pending.has(q.id) && !isSolved;
                const sub = userSubmissions[q.id];
                const pts = POINTS[q.difficulty] || 10;
                const dc = q.difficulty === "easy" ? "diff-easy" : q.difficulty === "medium" ? "diff-medium" : "diff-hard";
                const qTestResult = testResults[q.id];
                const qRefResult = referenceResults[q.id];

                const cardBorder = isSolved
                  ? "1px solid rgba(16,185,129,0.35)"
                  : isFailed
                  ? "1px solid rgba(239,68,68,0.35)"
                  : isPending
                  ? "1px solid rgba(245,158,11,0.35)"
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
                              {isFailed && <AlertCircle size={14} color="var(--red)" />}
                              {isPending && <Clock size={14} color="var(--yellow)" />}
                              <span style={{ fontWeight: 700, fontSize: 15 }}>{q.title}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`badge ${dc}`}>{q.difficulty}</span>
                              <span className={`badge ${typeColor(q.type)}`}>{q.type}</span>
                              <span style={{ fontSize: 11, color: "var(--text-3)" }}>📚 {q.topic}</span>
                              <span style={{ fontSize: 11, color: "var(--yellow)", marginLeft: "auto" }}>+{pts} pts</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {isSolved ? (
                            <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 700 }}>PASSED</span>
                          ) : isFailed ? (
                            <span style={{ fontSize: 11, color: "var(--red)", fontWeight: 700 }}>NEEDS REVISION</span>
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
                          {/* Problem Description */}
                          <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.75, marginBottom: 18 }}>{q.description}</p>

                          {/* Sample Data Tables */}
                          {q.tableData && q.tableData.some(t => t.name) && (
                            <div style={{ marginBottom: 18 }}>
                              <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                                <Table2 size={13} color="var(--cyan)" />
                                <span style={{ fontWeight: 700, fontSize: 13, color: "var(--cyan)" }}>Sample Data Tables</span>
                              </div>
                              {q.tableData.filter(t => t.name).map((t, ti) => {
                                const cols = parseColumns(t.columns);
                                const rows = parseRows(t.rows);
                                return (
                                  <div key={ti} style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 6, fontFamily: "JetBrains Mono,monospace" }}>Table: {t.name}</div>
                                    <div style={{ overflowX: "auto" }}>
                                      <table style={{ width: "auto", minWidth: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "JetBrains Mono,monospace" }}>
                                        <thead>
                                          <tr style={{ background: "rgba(34,211,238,0.08)" }}>
                                            {cols.map((col, ci) => (
                                              <th key={ci} style={{ padding: "6px 14px", textAlign: "left", color: "var(--cyan)", fontSize: 11, borderBottom: "1px solid rgba(34,211,238,0.2)" }}>{col}</th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {rows.map((row, ri) => (
                                            <tr key={ri} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                              {parseRowCells(row).map((cell, ci) => (
                                                <td key={ci} style={{ padding: "5px 14px", color: "var(--text-2)" }}>{cell}</td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Schema DDL */}
                          {q.sampleSchema && (
                            <div style={{ marginBottom: 18 }}>
                              <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                                <Code2 size={13} color="var(--purple-light)" />
                                <span style={{ fontWeight: 700, fontSize: 13, color: "var(--purple-light)" }}>SQL Schema</span>
                              </div>
                              <pre style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: "var(--radius-sm)", padding: "12px 16px", fontFamily: "JetBrains Mono,monospace", fontSize: 12, overflowX: "auto", color: "var(--text-1)", lineHeight: 1.6, margin: 0 }}>{q.sampleSchema}</pre>
                            </div>
                          )}

                          {/* ── Status Banners: Pass / Fail with Remarks / Pending ── */}
                          {isSolved ? (
                            <div style={{ padding: "14px 18px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8, marginBottom: 16 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <CheckCircle2 size={18} color="var(--green)" />
                                <div>
                                  <div style={{ color: "var(--green)", fontWeight: 700, fontSize: 14 }}>Passed! +{pts} points awarded</div>
                                  <div style={{ color: "var(--text-3)", fontSize: 12, marginTop: 2 }}>Your submission was evaluated and accepted.</div>
                                </div>
                              </div>
                              {sub?.adminRemarks && (
                                <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(16,185,129,0.2)", fontSize: 12, color: "var(--text-1)" }}>
                                  <strong style={{ color: "var(--green)" }}>👨‍🏫 Faculty Feedback: </strong>
                                  <em>"{sub.adminRemarks}"</em>
                                </div>
                              )}
                            </div>
                          ) : isFailed ? (
                            <div style={{ padding: "14px 18px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, marginBottom: 16 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                                <AlertCircle size={18} color="var(--red)" />
                                <div>
                                  <div style={{ color: "var(--red)", fontWeight: 700, fontSize: 14 }}>Needs Revision / Submission Failed</div>
                                  <div style={{ color: "var(--text-3)", fontSize: 12, marginTop: 1 }}>Instructor has reviewed your query. Check remarks below and re-submit.</div>
                                </div>
                              </div>
                              {sub?.adminRemarks ? (
                                <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(0,0,0,0.3)", borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)", fontSize: 12, color: "var(--text-1)" }}>
                                  <strong style={{ color: "var(--yellow)" }}>👨‍🏫 Faculty Remarks: </strong>
                                  <span style={{ color: "#f87171" }}>"{sub.adminRemarks}"</span>
                                </div>
                              ) : (
                                <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                                  Your query did not pass verification. Use the in-browser SQLite runner below to test your query against the sample tables before re-submitting.
                                </div>
                              )}
                            </div>
                          ) : isPending ? (
                            <div style={{ padding: "14px 18px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                              <Clock size={18} color="var(--yellow)" />
                              <div>
                                <div style={{ color: "var(--yellow)", fontWeight: 700, fontSize: 14 }}>Submission Pending Faculty Review</div>
                                <div style={{ color: "var(--text-3)", fontSize: 12, marginTop: 2 }}>Your query has been submitted. Waiting for instructor to evaluate.</div>
                              </div>
                            </div>
                          ) : null}

                          {/* ── SQL Query Editor & Multi-Dialect Test Runner ── */}
                          <div style={{ marginBottom: 18 }}>
                            <div className="flex items-center gap-2" style={{ marginBottom: 8, flexWrap: "wrap" }}>
                              <Send size={13} color="var(--yellow)" />
                              <span style={{ fontWeight: 700, fontSize: 13, color: "var(--yellow)" }}>
                                {isSolved ? "Your Accepted SQL Query" : isFailed ? "Revise Your SQL Query" : "Write Your SQL Query"}
                              </span>

                              {/* Dialect Selector Tabs */}
                              <div style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                background: "rgba(0,0,0,0.45)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 8,
                                padding: "2px 4px",
                                marginLeft: "auto"
                              }}>
                                <span style={{ fontSize: 10, color: "var(--text-3)", padding: "0 6px", fontWeight: 700, letterSpacing: "0.05em" }}>DIALECT:</span>
                                {SQL_DIALECT_OPTIONS.map(opt => {
                                  const isActive = getDialect(q.id) === opt.id;
                                  return (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      disabled={isSolved}
                                      onClick={() => setSelectedDialect(prev => ({ ...prev, [q.id]: opt.id }))}
                                      title={opt.tip}
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        fontFamily: "JetBrains Mono, monospace",
                                        padding: "3px 8px",
                                        borderRadius: 6,
                                        border: isActive ? "1px solid rgba(34,211,238,0.5)" : "1px solid transparent",
                                        background: isActive ? "rgba(34,211,238,0.18)" : "transparent",
                                        color: isActive ? "var(--cyan)" : "var(--text-3)",
                                        cursor: isSolved ? "not-allowed" : "pointer",
                                        transition: "all 0.15s ease",
                                      }}>
                                      {opt.icon} {opt.label}
                                    </button>
                                  );
                                })}
                              </div>

                              <span style={{ fontSize: 10, color: "rgba(239,68,68,0.8)", display: "flex", alignItems: "center", gap: 3 }}>
                                <ShieldOff size={9} /> Fair assessment
                              </span>
                            </div>

                            <textarea
                              className="input"
                              rows={6}
                              style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 13, resize: "vertical" }}
                              placeholder={`Write your ${getDialect(q.id).toUpperCase()} query here...\n\nExample (${getDialect(q.id).toUpperCase()}):\n${
                                getDialect(q.id) === 'mysql'
                                  ? 'SELECT `name`, IF(salary > 50000, "High", "Standard") AS tier\nFROM Employee\nORDER BY salary DESC LIMIT 5;'
                                  : getDialect(q.id) === 'mssql'
                                  ? 'SELECT TOP 5 [name], IIF(salary > 50000, \'High\', \'Standard\') AS tier\nFROM Employee\nORDER BY salary DESC;'
                                  : 'SELECT name, salary\nFROM Employee\nWHERE salary > 50000\nORDER BY salary DESC LIMIT 5;'
                              }`}
                              value={userQuery[q.id] || ""}
                              onChange={e => setUserQuery(p => ({ ...p, [q.id]: e.target.value }))}
                              onCopy={blockCopyPaste}
                              onCut={blockCopyPaste}
                              onPaste={blockCopyPaste}
                              disabled={!user || isSolved}
                              spellCheck={false}
                              autoCorrect="off"
                              autoCapitalize="off"
                            />

                            {!user && (
                              <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 5 }}>
                                <Lock size={11} /> Login to test and submit your query
                              </div>
                            )}

                            {/* Runner and Submit Buttons */}
                            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                              {/* Direct Multi-Dialect Runner Button */}
                              <button
                                onClick={() => handleRunUserSql(q)}
                                disabled={runningTest[q.id] || !userQuery[q.id]?.trim()}
                                className="btn"
                                style={{
                                  background: "linear-gradient(135deg,rgba(34,211,238,0.25),rgba(6,182,212,0.15))",
                                  color: "var(--cyan)",
                                  border: "1px solid rgba(34,211,238,0.4)",
                                  fontWeight: 700,
                                  fontSize: 12,
                                  padding: "8px 16px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6
                                }}>
                                {runningTest[q.id] ? (
                                  <Loader2 size={13} style={{ animation: "spin-slow 0.8s linear infinite" }} />
                                ) : (
                                  <Play size={13} />
                                )}
                                Run in {getDialect(q.id).toUpperCase()} Environment
                              </button>

                              {/* Submit Button */}
                              {!isSolved && (
                                <button
                                  onClick={() => handleSubmit(q)}
                                  disabled={isSubmitting || !user || !userQuery[q.id]?.trim()}
                                  className="btn"
                                  style={{
                                    background: user ? "linear-gradient(135deg,var(--cyan),#0891b2)" : "rgba(0,0,0,0.3)",
                                    color: user ? "#000" : "var(--text-3)",
                                    border: "none",
                                    fontWeight: 700,
                                    fontSize: 12,
                                    padding: "8px 18px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    boxShadow: user ? "0 4px 16px rgba(34,211,238,0.28)" : "none"
                                  }}>
                                  {isSubmitting ? (
                                    <><Loader2 size={13} style={{ animation: "spin-slow 0.8s linear infinite" }} /> Submitting...</>
                                  ) : isFailed ? (
                                    <><Send size={13} /> Re-Submit Query ({getDialect(q.id).toUpperCase()})</>
                                  ) : isPending ? (
                                    <><Send size={13} /> Update Submission ({getDialect(q.id).toUpperCase()})</>
                                  ) : (
                                    <><Send size={13} /> Submit Query in {getDialect(q.id).toUpperCase()} (earn {pts} pts)</>
                                  )}
                                </button>
                              )}
                            </div>

                            {/* ── Direct Dialect Execution Output Table ── */}
                            {qTestResult && (
                              <div style={{ marginTop: 14, background: "rgba(0,0,0,0.45)", border: `1px solid ${qTestResult.success ? "rgba(34,211,238,0.3)" : "rgba(239,68,68,0.35)"}`, borderRadius: 8, padding: 12 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: qTestResult.success ? "var(--cyan)" : "var(--red)", display: "flex", alignItems: "center", gap: 5 }}>
                                    <Terminal size={12} />
                                    {qTestResult.success
                                      ? `${(qTestResult.dialect || getDialect(q.id)).toUpperCase()} Output (${qTestResult.executionTimeMs}ms, ${qTestResult.values.length} rows returned)`
                                      : `${(qTestResult.dialect || getDialect(q.id)).toUpperCase()} Execution Error`}
                                  </span>
                                  {qTestResult.engine && (
                                    <span style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "JetBrains Mono,monospace" }}>
                                      engine: {qTestResult.engine}
                                    </span>
                                  )}
                                </div>
                                {qTestResult.success ? (
                                  qTestResult.columns.length === 0 ? (
                                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>Query executed successfully with 0 columns returned.</div>
                                  ) : (
                                    <div style={{ overflowX: "auto", maxHeight: 180 }}>
                                      <table style={{ width: "100%", fontSize: 11, fontFamily: "JetBrains Mono,monospace", borderCollapse: "collapse" }}>
                                        <thead>
                                          <tr style={{ background: "rgba(34,211,238,0.12)" }}>
                                            {qTestResult.columns.map((col, ci) => (
                                              <th key={ci} style={{ padding: "5px 10px", textAlign: "left", color: "var(--cyan)", borderBottom: "1px solid rgba(34,211,238,0.2)" }}>{col}</th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {qTestResult.values.map((row, ri) => (
                                            <tr key={ri} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                              {row.map((cell, ci) => (
                                                <td key={ci} style={{ padding: "4px 10px", color: "var(--text-2)" }}>{String(cell ?? "NULL")}</td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )
                                ) : (
                                  <pre style={{ fontSize: 11, color: "var(--red)", fontFamily: "monospace", margin: 0, whiteSpace: "pre-wrap" }}>
                                    {qTestResult.error}
                                  </pre>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Hint */}
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

                          {/* ── How it was done: Unlocked after Passing ── */}
                          {isSolved && (
                            <div style={{ marginTop: 14, padding: "14px 16px", background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: "var(--radius-sm)" }}>
                              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                                <div className="flex items-center gap-2">
                                  <BookOpen size={13} color="var(--purple-light)" />
                                  <span style={{ fontWeight: 700, fontSize: 13, color: "var(--purple-light)" }}>
                                    How it was done — Reference Solution
                                  </span>
                                </div>
                                {q.expectedQuery && (
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => handleRunReferenceSql(q)}
                                    disabled={runningReference[q.id]}
                                    style={{ fontSize: 11, color: "var(--purple-light)", border: "1px solid rgba(139,92,246,0.3)" }}>
                                    {runningReference[q.id] ? <Loader2 size={11} style={{ animation: "spin-slow 0.8s linear infinite" }} /> : <Play size={11} />}
                                    Run Reference Solution
                                  </button>
                                )}
                              </div>

                              {q.expectedQuery && (
                                <pre style={{
                                  fontSize: 12, fontFamily: "JetBrains Mono,monospace", background: "rgba(0,0,0,0.5)",
                                  padding: 10, borderRadius: 6, color: "var(--text-1)", border: "1px solid rgba(139,92,246,0.2)",
                                  margin: "0 0 10px", whiteSpace: "pre-wrap"
                                }}>
                                  {q.expectedQuery}
                                </pre>
                              )}

                              {q.explanation && (
                                <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.7, margin: 0 }}>
                                  {q.explanation}
                                </p>
                              )}

                              {/* Reference Solution SQLite Table output */}
                              {qRefResult && (
                                <div style={{ marginTop: 10, background: "rgba(0,0,0,0.4)", borderRadius: 6, padding: 10, border: "1px solid rgba(139,92,246,0.2)" }}>
                                  <span style={{ fontSize: 11, color: "var(--purple-light)", fontWeight: 700, display: "block", marginBottom: 6 }}>
                                    Reference Table Output:
                                  </span>
                                  {qRefResult.success && qRefResult.columns.length > 0 && (
                                    <div style={{ overflowX: "auto", maxHeight: 150 }}>
                                      <table style={{ width: "100%", fontSize: 11, fontFamily: "monospace", borderCollapse: "collapse" }}>
                                        <thead>
                                          <tr style={{ background: "rgba(139,92,246,0.15)" }}>
                                            {qRefResult.columns.map((c, ci) => (
                                              <th key={ci} style={{ padding: "4px 8px", textAlign: "left", color: "var(--purple-light)", borderBottom: "1px solid rgba(139,92,246,0.2)" }}>{c}</th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {qRefResult.values.map((row, ri) => (
                                            <tr key={ri} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                                              {row.map((cell, ci) => (
                                                <td key={ci} style={{ padding: "3px 8px", color: "var(--text-2)" }}>{String(cell ?? "NULL")}</td>
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
            CodeForge MCA -- DBMS Lab Studio -- by <strong style={{ color: "rgba(34,211,238,0.4)" }}>Rakshil Gandhi</strong>
          </div>
        </div>
      </div>
    </>
  );
};

export default DBMSPage;
