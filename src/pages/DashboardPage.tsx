import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  collection, getDocs, query, where, orderBy, limit,
  doc, onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import {
  Code2, Trophy, Zap, Clock, CheckCircle2, XCircle,
  Target, TrendingUp, BookOpen, Star, Database, RefreshCw,
  Flame, Calendar, ListChecks, ChevronRight,
} from "lucide-react";

interface Submission {
  id: string;
  problemTitle: string;
  problemId: string;
  language: string;
  status: "accepted" | "wrong_answer" | "error";
  runtime: number;
  score: number;
  createdAt: any;
}

interface DailyTask {
  id: string;
  title: string;
  description: string;
  type: "code" | "dbms" | "any";
  targetCount: number;
  date: string; // YYYY-MM-DD
  points: number;
}

const LANG_COLORS: Record<string, string> = {
  java: "lang-java", c: "lang-c", python: "lang-python", javascript: "lang-js",
};

const today = new Date().toISOString().slice(0, 10);

// Runtime tier label + color
const runtimeTier = (ms: number) => {
  if (ms < 100)  return { label: "⚡ Blazing", color: "var(--cyan)" };
  if (ms < 300)  return { label: "🚀 Fast",    color: "var(--green)" };
  if (ms < 500)  return { label: "✅ Decent",  color: "var(--yellow)" };
  if (ms < 1000) return { label: "🐢 Slow",   color: "var(--pink)" };
  return           { label: "🦆 Very Slow",   color: "var(--text-3)" };
};

// ── Streak flame color ───────────────────────────────────────────
const streakColor = (streak: number) => {
  if (streak >= 30) return "#ff4500";
  if (streak >= 14) return "#ff8c00";
  if (streak >= 7)  return "#ffd700";
  if (streak >= 3)  return "var(--yellow)";
  return "var(--text-3)";
};

const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  const [freshProfile, setFreshProfile] = useState<any>(null);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [totalProblems, setTotalProblems] = useState(0);
  const [totalDbms, setTotalDbms] = useState(0);
  const [dbmsPassed, setDbmsPassed] = useState(0);
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [todayCodeSolves, setTodayCodeSolves] = useState(0);
  const [todayDbmsPasses, setTodayDbmsPasses] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Real-time profile listener ───────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), snap => {
      if (snap.exists()) setFreshProfile(snap.data());
    });
    return unsub;
  }, [user]);

  // ── Fetch submissions + problem counts + daily tasks ────────────
  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [
        allSubSnap,
        recentSubSnap,
        probSnap,
        dbmsSnap,
        dbmsSubSnap,
        dailyTaskSnap,
        todayCodeSnap,
        todayDbmsSnap,
      ] = await Promise.all([
        getDocs(query(
          collection(db, "submissions"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
        )),
        getDocs(query(
          collection(db, "submissions"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(10),
        )),
        getDocs(collection(db, "problems")),
        getDocs(collection(db, "dbms_questions")),
        getDocs(query(
          collection(db, "dbms_submissions"),
          where("userId", "==", user.uid),
        )),
        // Today's daily tasks
        getDocs(query(
          collection(db, "daily_tasks"),
          where("date", "==", today),
        )),
        // Today's accepted code submissions (for daily task progress)
        getDocs(query(
          collection(db, "submissions"),
          where("userId", "==", user.uid),
          where("status", "==", "accepted"),
          where("todayDate", "==", today),
        )),
        // Today's DBMS passes
        getDocs(query(
          collection(db, "dbms_submissions"),
          where("userId", "==", user.uid),
          where("status", "==", "pass"),
          where("todayDate", "==", today),
        )),
      ]);

      setAllSubmissions(allSubSnap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));
      setRecentSubmissions(recentSubSnap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));
      setTotalProblems(probSnap.size);
      setTotalDbms(dbmsSnap.size);

      const passedQIds = new Set<string>();
      dbmsSubSnap.docs.forEach(d => {
        const data = d.data() as any;
        if (data.status === "pass") passedQIds.add(data.questionId);
      });
      setDbmsPassed(passedQIds.size);

      setDailyTasks(dailyTaskSnap.docs.map(d => ({ id: d.id, ...d.data() } as DailyTask)));
      setTodayCodeSolves(todayCodeSnap.size);
      setTodayDbmsPasses(todayDbmsSnap.size);

    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchData();
  }, [user, fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // ── Derived stats ────────────────────────────────────────────────
  const codeSubs      = allSubmissions;
  const acceptedSubs  = codeSubs.filter(s => s.status === "accepted");
  const totalSubs     = codeSubs.length;
  const accuracy      = totalSubs > 0 ? Math.round((acceptedSubs.length / totalSubs) * 100) : 0;
  const avgRuntime    = acceptedSubs.length > 0
    ? Math.round(acceptedSubs.reduce((a, s) => a + (s.runtime || 0), 0) / acceptedSubs.length)
    : 0;

  // Unique code problems solved (from profile = authoritative)
  const problemsSolved    = freshProfile?.problemsSolved ?? 0;
  const totalScore        = freshProfile?.score ?? 0;
  const totalSubmissions  = freshProfile?.totalSubmissions ?? totalSubs;
  const currentStreak     = freshProfile?.currentStreak ?? 0;
  const longestStreak     = freshProfile?.longestStreak ?? 0;
  const lastSolveDate     = freshProfile?.lastSolveDate ?? "";

  // Combined solved for progress
  const totalSolved = problemsSolved + dbmsPassed;
  const progressPct = (totalProblems + totalDbms) > 0
    ? Math.min(totalSolved / (totalProblems + totalDbms) * 100, 100)
    : 0;

  // Best runtime among accepted
  const bestRuntime = acceptedSubs.length > 0 ? Math.min(...acceptedSubs.map(s => s.runtime || 9999)) : 0;

  // Stat cards — Code section
  const codeStatCards = [
    {
      label: "Code Solved", value: problemsSolved,
      icon: <CheckCircle2 size={20} />, color: "var(--green)",
      gradient: "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))",
    },
    {
      label: "Total Score", value: totalScore,
      icon: <Star size={20} />, color: "var(--yellow)",
      gradient: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))",
    },
    {
      label: "Submissions", value: totalSubmissions,
      icon: <Zap size={20} />, color: "var(--purple-light)",
      gradient: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05))",
    },
    {
      label: "Accuracy", value: `${accuracy}%`,
      icon: <Target size={20} />, color: "var(--pink)",
      gradient: "linear-gradient(135deg, rgba(236,72,153,0.2), rgba(236,72,153,0.05))",
    },
    {
      label: "Avg Runtime", value: `${avgRuntime}ms`,
      icon: <Clock size={20} />, color: "var(--text-2)",
      gradient: "linear-gradient(135deg, rgba(148,163,184,0.1), rgba(148,163,184,0.02))",
    },
    {
      label: "Best Runtime", value: bestRuntime > 0 ? `${bestRuntime}ms` : "—",
      icon: <TrendingUp size={20} />, color: "var(--cyan)",
      gradient: "linear-gradient(135deg, rgba(34,211,238,0.2), rgba(34,211,238,0.05))",
    },
  ];

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-content">

          {/* ── Welcome Header ────────────────────────────────────── */}
          <div style={{ marginBottom: 28 }}>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="avatar" style={{ width: 64, height: 64, fontSize: 26 }}>
                {freshProfile?.displayName?.[0]?.toUpperCase() || "U"}
              </div>
              <div>
                <h1 className="font-display" style={{ fontSize: "clamp(22px, 4vw, 34px)", fontWeight: 800 }}>
                  Hey, <span className="gradient-text">{freshProfile?.displayName?.split(" ")[0] || "Coder"}!</span> 👋
                </h1>
                <p style={{ color: "var(--text-2)", marginTop: 4, fontSize: 14 }}>
                  {freshProfile?.email} •{" "}
                  {freshProfile?.role === "superadmin" ? "👑 Super Admin"
                    : freshProfile?.role === "admin" ? "🛡️ Admin"
                    : "🎓 MCA Student"}
                </p>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  onClick={handleRefresh}
                  className="btn"
                  style={{ padding: "8px 14px", opacity: refreshing ? 0.6 : 1 }}
                  disabled={refreshing}
                  title="Refresh"
                >
                  <RefreshCw size={15} style={{ animation: refreshing ? "spin-slow 0.8s linear infinite" : "none" }} />
                </button>
                <Link to="/problems" className="btn btn-primary">
                  <Code2 size={16} /> Keep Coding
                </Link>
              </div>
            </div>
          </div>

          {/* ── Top row: Progress + Streak ────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, marginBottom: 24 }}>
            {/* Placement Readiness */}
            <div className="glass-card" style={{ padding: 24 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>🎯 Placement Readiness</span>
                  <p style={{ color: "var(--text-2)", fontSize: 13, marginTop: 2 }}>
                    {totalSolved} / {totalProblems + totalDbms} problems solved
                    <span style={{ color: "var(--text-3)", marginLeft: 6 }}>
                      (Code: {problemsSolved} · DBMS: {dbmsPassed})
                    </span>
                  </p>
                </div>
                <span className="font-display gradient-text" style={{ fontSize: 32, fontWeight: 800 }}>
                  {Math.round(progressPct)}%
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="flex justify-between" style={{ marginTop: 8, fontSize: 12, color: "var(--text-3)" }}>
                <span>🐣 Beginner</span>
                <span>🚀 Placement Ready</span>
              </div>
            </div>

            {/* Streak Card */}
            <div className="glass-card" style={{
              padding: 24, textAlign: "center",
              background: currentStreak > 0
                ? `linear-gradient(135deg, rgba(255,165,0,0.12), rgba(255,69,0,0.06))`
                : undefined,
              border: currentStreak > 0 ? `1px solid ${streakColor(currentStreak)}40` : undefined,
            }}>
              <Flame size={40} style={{ color: streakColor(currentStreak), marginBottom: 6 }} />
              <div className="font-display" style={{ fontSize: 48, fontWeight: 800, color: streakColor(currentStreak), lineHeight: 1 }}>
                {currentStreak}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4, fontWeight: 600 }}>Day Streak 🔥</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>
                Best: {longestStreak} days
              </div>
              {lastSolveDate === today
                ? <div style={{ marginTop: 10, fontSize: 11, color: "var(--green)", fontWeight: 600 }}>✅ Solved today!</div>
                : <div style={{ marginTop: 10, fontSize: 11, color: "var(--pink)" }}>⚠️ Solve today to keep streak!</div>
              }
            </div>
          </div>

          {/* ── Daily Tasks ───────────────────────────────────────── */}
          {dailyTasks.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div className="section-heading" style={{ marginBottom: 12 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                  <Calendar size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />
                  Daily Tasks — {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
                {dailyTasks.map(task => {
                  const progress = task.type === "dbms" ? todayDbmsPasses
                    : task.type === "code" ? todayCodeSolves
                    : todayCodeSolves + todayDbmsPasses;
                  const done = progress >= task.targetCount;
                  const pct  = Math.min((progress / Math.max(task.targetCount, 1)) * 100, 100);
                  return (
                    <div key={task.id} className="glass-card" style={{
                      padding: 18,
                      border: done ? "1px solid var(--green)" : "1px solid var(--border)",
                      background: done ? "linear-gradient(135deg, rgba(16,185,129,0.08), transparent)" : undefined,
                    }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <ListChecks size={16} style={{ color: done ? "var(--green)" : "var(--cyan)" }} />
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{task.title}</span>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "2px 8px",
                          borderRadius: 20,
                          background: task.type === "code" ? "rgba(139,92,246,0.2)" : task.type === "dbms" ? "rgba(34,211,238,0.2)" : "rgba(245,158,11,0.2)",
                          color: task.type === "code" ? "var(--purple-light)" : task.type === "dbms" ? "var(--cyan)" : "var(--yellow)",
                        }}>
                          {task.type.toUpperCase()}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 10 }}>{task.description}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                        <span style={{ color: "var(--text-2)" }}>{progress} / {task.targetCount} done</span>
                        <span style={{ color: "var(--yellow)", fontWeight: 600 }}>+{task.points} pts</span>
                      </div>
                      <div className="progress-bar" style={{ height: 5 }}>
                        <div className="progress-fill" style={{ width: `${pct}%`, background: done ? "var(--green)" : undefined }} />
                      </div>
                      {done && <div style={{ fontSize: 11, color: "var(--green)", marginTop: 6, fontWeight: 600 }}>🎉 Completed!</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Code Stats ────────────────────────────────────────── */}
          <div style={{ marginBottom: 8 }}>
            <div className="section-heading" style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                <Code2 size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />
                Code Problem Stats
              </h2>
              <Link to="/problems" style={{ fontSize: 13, color: "var(--purple-light)", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
                View All <ChevronRight size={14} />
              </Link>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 24 }}>
            {codeStatCards.map((c, i) => (
              <div key={i} className="stat-card" style={{ background: c.gradient, border: `1px solid ${c.color}30` }}>
                <div style={{ color: c.color, display: "flex", justifyContent: "center", marginBottom: 8 }}>{c.icon}</div>
                <div className="stat-number" style={{ color: c.color, fontSize: 24 }}>{c.value}</div>
                <div style={{ color: "var(--text-3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* ── DBMS Stats ────────────────────────────────────────── */}
          <div style={{ marginBottom: 8 }}>
            <div className="section-heading" style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                <Database size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />
                DBMS Lab Stats
              </h2>
              <Link to="/dbms" style={{ fontSize: 13, color: "var(--cyan)", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
                Go to DBMS <ChevronRight size={14} />
              </Link>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 28 }}>
            {[
              {
                label: "DBMS Passed", value: `${dbmsPassed}/${totalDbms}`,
                icon: <CheckCircle2 size={20} />, color: "var(--cyan)",
                gradient: "linear-gradient(135deg, rgba(34,211,238,0.2), rgba(34,211,238,0.05))",
              },
              {
                label: "Completion", value: totalDbms > 0 ? `${Math.round(dbmsPassed / totalDbms * 100)}%` : "0%",
                icon: <Target size={20} />, color: "var(--green)",
                gradient: "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))",
              },
              {
                label: "Remaining", value: Math.max(totalDbms - dbmsPassed, 0),
                icon: <TrendingUp size={20} />, color: "var(--pink)",
                gradient: "linear-gradient(135deg, rgba(236,72,153,0.2), rgba(236,72,153,0.05))",
              },
            ].map((c, i) => (
              <div key={i} className="stat-card" style={{ background: c.gradient, border: `1px solid ${c.color}30` }}>
                <div style={{ color: c.color, display: "flex", justifyContent: "center", marginBottom: 8 }}>{c.icon}</div>
                <div className="stat-number" style={{ color: c.color, fontSize: 24 }}>{c.value}</div>
                <div style={{ color: "var(--text-3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* ── Recent Activity + Quick Actions ──────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 290px", gap: 24, alignItems: "start" }}>

            {/* Recent Submissions */}
            <div>
              <div className="section-heading" style={{ marginBottom: 12 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>Recent Submissions</h2>
              </div>
              {loading ? (
                <div className="flex justify-center" style={{ padding: 40 }}><div className="spinner" /></div>
              ) : recentSubmissions.length === 0 ? (
                <div className="glass-card" style={{ padding: 48, textAlign: "center", color: "var(--text-3)" }}>
                  <Code2 size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                  <p style={{ fontSize: 16 }}>No submissions yet!</p>
                  <Link to="/problems" className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>
                    Solve your first problem
                  </Link>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {recentSubmissions.map(s => {
                    const tier = runtimeTier(s.runtime);
                    return (
                      <Link key={s.id} to={`/problems/${s.problemId}`} style={{ textDecoration: "none" }}>
                        <div className="glass-card" style={{ padding: "13px 16px", cursor: "pointer" }}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {s.status === "accepted"
                                ? <CheckCircle2 size={17} color="var(--green)" />
                                : <XCircle size={17} color="var(--red, #ef4444)" />}
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{s.problemTitle}</div>
                                <div className="flex items-center gap-2" style={{ marginTop: 3 }}>
                                  <span className={`lang-badge ${LANG_COLORS[s.language] || "lang-python"}`}>{s.language?.toUpperCase()}</span>
                                  <span style={{ fontSize: 11, color: tier.color, fontWeight: 600 }}>{tier.label}</span>
                                  <span style={{ fontSize: 11, color: "var(--text-3)" }}><Clock size={10} style={{ verticalAlign: "middle" }} /> {s.runtime}ms</span>
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <span className={`badge ${s.status === "accepted" ? "badge-green" : "badge-red"}`} style={{ fontSize: 10 }}>
                                {s.status === "accepted" ? "AC" : s.status === "wrong_answer" ? "WA" : "RE"}
                              </span>
                              {s.status === "accepted" && (
                                <div style={{ fontSize: 12, color: "var(--yellow)", marginTop: 3, fontWeight: 600 }}>+{Math.round(s.score)} pts</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right panel */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Quick Actions */}
              <div className="section-heading" style={{ marginBottom: 4 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>Quick Actions</h2>
              </div>
              {[
                { label: "Practice Problems", desc: "Browse all problems",    icon: <BookOpen size={18} />, link: "/problems",    color: "var(--purple)" },
                { label: "DBMS Lab",           desc: "SQL questions",          icon: <Database size={18} />, link: "/dbms",        color: "var(--cyan)" },
                { label: "Leaderboard",        desc: "Check your ranking",     icon: <Trophy size={18} />,   link: "/leaderboard", color: "var(--yellow)" },
                { label: "My Profile",         desc: "View your stats",        icon: <TrendingUp size={18} />, link: "/profile",   color: "var(--green)" },
              ].map((a, i) => (
                <Link key={i} to={a.link} style={{ textDecoration: "none" }}>
                  <div className="glass-card" style={{ padding: "14px 16px", cursor: "pointer" }}>
                    <div className="flex items-center gap-3">
                      <div style={{
                        color: a.color, background: `${a.color}20`,
                        border: `1px solid ${a.color}40`,
                        width: 40, height: 40, borderRadius: 10,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>{a.icon}</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{a.label}</div>
                        <div style={{ color: "var(--text-3)", fontSize: 11 }}>{a.desc}</div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}

              {/* Language Stats */}
              <div className="glass-card" style={{ padding: 18 }}>
                <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>🔥 Language Stats</div>
                {["java", "c", "python", "javascript"].map(lang => {
                  const count = allSubmissions.filter(s => s.language === lang).length;
                  const pct   = allSubmissions.length > 0 ? (count / allSubmissions.length) * 100 : 0;
                  return (
                    <div key={lang} style={{ marginBottom: 10 }}>
                      <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
                        <span className={`lang-badge ${LANG_COLORS[lang]}`}>{lang.toUpperCase()}</span>
                        <span style={{ fontSize: 11, color: "var(--text-3)" }}>{count}</span>
                      </div>
                      <div className="progress-bar" style={{ height: 4 }}>
                        <div className="progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DashboardPage;
