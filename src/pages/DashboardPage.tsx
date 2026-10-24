import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  collection, getDocs, query, where,
  doc, onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import {
  Code2, Trophy, Clock, CheckCircle2, XCircle,
  TrendingUp, BookOpen, Database, RefreshCw,
  Flame, Calendar, ListChecks,
  PlayCircle, Award, Terminal, ArrowRight
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
  date: string;
  points: number;
}

interface ProblemItem {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  category: string;
  solvedCount?: number;
}

interface DbmsItem {
  id: string;
  title: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  type?: string;
}

interface LiveTestItem {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  totalQuestions: number;
  type: "mcq" | "coding" | "mixed";
  status: string;
  assignedTeacher?: string;
  assignedClass?: string;
  startTime?: any;
  endTime?: any;
}

const LANG_COLORS: Record<string, string> = {
  java: "lang-java", c: "lang-c", python: "lang-python", javascript: "lang-js", sql: "lang-sql",
};

const today = new Date().toISOString().slice(0, 10);

// Professional runtime tier for college assessments
const runtimeTier = (ms: number) => {
  if (ms <= 0)   return { label: "Standard", color: "var(--cyan)" };
  if (ms < 120)  return { label: "Optimal (<120ms)", color: "var(--cyan)" };
  if (ms < 300)  return { label: "Fast (<300ms)",    color: "var(--green)" };
  if (ms < 600)  return { label: "Standard",         color: "var(--yellow)" };
  return           { label: "Needs Review",     color: "var(--pink)" };
};

const streakColor = (streak: number) => {
  if (streak >= 30) return "#38bdf8";
  if (streak >= 14) return "#818cf8";
  if (streak >= 7)  return "var(--cyan)";
  if (streak >= 3)  return "var(--yellow)";
  return "var(--text-3)";
};

const diffBadge = (d: string) => {
  if (d === "hard") return <span className="badge badge-red" style={{ fontSize: 10, textTransform: "capitalize" }}>Hard</span>;
  if (d === "medium") return <span className="badge badge-yellow" style={{ fontSize: 10, textTransform: "capitalize" }}>Medium</span>;
  return <span className="badge badge-green" style={{ fontSize: 10, textTransform: "capitalize" }}>Easy</span>;
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
  const [pendingProblems, setPendingProblems] = useState(0);
  const [liveTests, setLiveTests] = useState<LiveTestItem[]>([]);
  const [myTestResults, setMyTestResults] = useState<Record<string, any>>({});
  const [latestProblems, setLatestProblems] = useState<ProblemItem[]>([]);
  const [latestDbms, setLatestDbms] = useState<DbmsItem[]>([]);
  const [solvedProblemIds, setSolvedProblemIds] = useState<Set<string>>(new Set());
  const [passedDbmsIds, setPassedDbmsIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Real-time profile listener
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), snap => {
      if (snap.exists()) setFreshProfile(snap.data());
    });
    return unsub;
  }, [user]);

  // Fetch all dashboard data
  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [
        allSubSnap,
        probSnap,
        dbmsSnap,
        dbmsSubSnap,
        dailyTaskSnap,
        testsSnap,
        userResultsSnap
      ] = await Promise.all([
        getDocs(query(collection(db, "submissions"), where("userId", "==", user.uid))),
        getDocs(collection(db, "problems")),
        getDocs(collection(db, "dbms_questions")),
        getDocs(query(collection(db, "dbms_submissions"), where("userId", "==", user.uid))),
        getDocs(query(collection(db, "daily_tasks"), where("date", "==", today))),
        getDocs(collection(db, "mcq_tests")),
        getDocs(query(collection(db, "test_results"), where("userId", "==", user.uid)))
      ]);

      // Submissions sorted client-side
      const allSubs: Submission[] = allSubSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Submission))
        .sort((a, b) => {
          const ta = a.createdAt?.toDate?.()?.getTime?.() ?? (typeof a.createdAt === 'number' ? a.createdAt : 0);
          const tb = b.createdAt?.toDate?.()?.getTime?.() ?? (typeof b.createdAt === 'number' ? b.createdAt : 0);
          return tb - ta;
        });

      setAllSubmissions(allSubs);
      setRecentSubmissions(allSubs.slice(0, 8));
      setTotalProblems(probSnap.size);
      setTotalDbms(dbmsSnap.size);

      // Latest 4 problems
      const probList: ProblemItem[] = probSnap.docs.map(d => ({
        id: d.id,
        title: d.data().title || "Untitled Problem",
        difficulty: d.data().difficulty || "easy",
        category: d.data().category || "General",
        solvedCount: d.data().solvedCount || 0,
      }));
      setLatestProblems(probList.slice(0, 4));

      // Latest 4 DBMS questions
      const dbmsList: DbmsItem[] = dbmsSnap.docs.map(d => ({
        id: d.id,
        title: d.data().title || "Untitled Query",
        topic: d.data().topic || "SQL",
        difficulty: d.data().difficulty || "easy",
        type: d.data().type || "query",
      }));
      setLatestDbms(dbmsList.slice(0, 4));

      // DBMS passed unique
      const passedQIds = new Set<string>();
      dbmsSubSnap.docs.forEach(d => {
        const data = d.data() as any;
        if (data.status === "pass") passedQIds.add(data.questionId);
      });
      setDbmsPassed(passedQIds.size);
      setPassedDbmsIds(passedQIds);

      // Coding solved unique
      const acceptedIds = new Set<string>(
        allSubs.filter(s => s.status === "accepted").map(s => s.problemId)
      );
      setSolvedProblemIds(acceptedIds);

      // Daily tasks
      setDailyTasks(dailyTaskSnap.docs.map(d => ({ id: d.id, ...d.data() } as DailyTask)));

      // Today stats
      const todayStr = today;
      const todayAccepted = allSubs.filter(s => {
        if (s.status !== 'accepted') return false;
        if ((s as any).todayDate) return (s as any).todayDate === todayStr;
        const d = s.createdAt?.toDate?.();
        if (d) return d.toISOString().slice(0, 10) === todayStr;
        return false;
      });
      setTodayCodeSolves(todayAccepted.length);

      const dbmsTodayPass = dbmsSubSnap.docs.filter(d => {
        const data = d.data() as any;
        if (data.status !== 'pass') return false;
        if (data.todayDate) return data.todayDate === todayStr;
        const dt = data.createdAt?.toDate?.();
        if (dt) return dt.toISOString().slice(0, 10) === todayStr;
        return false;
      });
      setTodayDbmsPasses(dbmsTodayPass.length);

      // Pending problems
      const attemptedProbIds = new Set(allSubs.map(s => s.problemId));
      const pending = [...attemptedProbIds].filter(pid => !acceptedIds.has(pid)).length;
      setPendingProblems(pending);

      // User test results map
      const resultMap: Record<string, any> = {};
      userResultsSnap.docs.forEach(d => {
        resultMap[d.data().testId] = d.data();
      });
      setMyTestResults(resultMap);

      // Live & Active Tests
      const now = new Date();
      const tests = testsSnap.docs.map(d => ({ id: d.id, ...d.data() } as LiveTestItem));
      const active = tests.filter(t => {
        if (t.status === 'active') return true;
        if (t.status === 'draft' || t.status === 'ended') return false;
        if (t.startTime?.toDate && t.endTime?.toDate) {
          const s = t.startTime.toDate();
          const e = t.endTime.toDate();
          return now >= s && now <= e;
        }
        return false;
      });
      setLiveTests(active);

    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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

  // Derived metrics
  const codeSubs = allSubmissions;
  const acceptedSubs = codeSubs.filter(s => s.status === "accepted");
  const totalSubs = codeSubs.length;
  const accuracy = totalSubs > 0 ? Math.round((acceptedSubs.length / totalSubs) * 100) : 0;

  const problemsSolved = freshProfile?.problemsSolved ?? acceptedSubs.length;
  const totalScore = freshProfile?.score ?? 0;
  const totalSubmissions = freshProfile?.totalSubmissions ?? totalSubs;
  const currentStreak = freshProfile?.currentStreak ?? 0;
  const longestStreak = freshProfile?.longestStreak ?? 0;
  const lastSolveDate = freshProfile?.lastSolveDate ?? "";

  const totalSolved = problemsSolved + dbmsPassed;
  const totalAvailable = totalProblems + totalDbms;
  const progressPct = totalAvailable > 0
    ? Math.min((totalSolved / totalAvailable) * 100, 100)
    : 0;

  return (
    <>
      <Navbar />
      <div className="page" style={{ background: "var(--bg-base)" }}>
        <div className="page-content" style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 20px" }}>

          {/* ══════════════════════════════════════════════════════════════
              WELCOME HEADER
          ══════════════════════════════════════════════════════════════ */}
          <div style={{ marginBottom: 24 }}>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="avatar" style={{ width: 56, height: 56, fontSize: 22, border: "2px solid rgba(56,189,248,0.4)" }}>
                {freshProfile?.displayName?.[0]?.toUpperCase() || "U"}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h1 className="font-display" style={{ fontSize: "clamp(22px, 3.5vw, 30px)", fontWeight: 800, letterSpacing: "-0.02em" }}>
                    Welcome back, <span className="gradient-text">{freshProfile?.displayName?.split(" ")[0] || "Candidate"}</span>
                  </h1>
                  <span className="badge badge-purple" style={{ fontSize: 11, fontWeight: 700 }}>
                    {freshProfile?.role === "superadmin" ? "Super Admin"
                      : freshProfile?.role === "admin" ? "Faculty / Admin"
                      : "MCA Candidate"}
                  </span>
                  <span className="badge badge-yellow" style={{ fontSize: 11, fontWeight: 700 }}>
                    🏆 {totalScore} Points
                  </span>
                  <span className="badge badge-cyan" style={{ fontSize: 11, fontWeight: 700 }}>
                    ⚡ {totalSubmissions} Submissions
                  </span>
                </div>
                <p style={{ color: "var(--text-3)", marginTop: 4, fontSize: 13 }}>
                  CodeForge MCA Assessment Platform • Academic Year 2024-2026
                </p>
              </div>

              <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  onClick={handleRefresh}
                  className="btn btn-ghost"
                  style={{ padding: "8px 14px", opacity: refreshing ? 0.6 : 1 }}
                  disabled={refreshing}
                  title="Refresh Dashboard"
                >
                  <RefreshCw size={14} style={{ animation: refreshing ? "spin-slow 0.8s linear infinite" : "none" }} />
                  <span style={{ fontSize: 12, marginLeft: 6 }}>Sync Data</span>
                </button>
                <Link to="/tests" className="btn btn-ghost" style={{ border: "1px solid var(--border)" }}>
                  <Trophy size={14} /> Assessments
                </Link>
                <Link to="/problems" className="btn btn-primary">
                  <Code2 size={15} /> Solve Problems
                </Link>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              FEATURE 1: LIVE TEST BANNER / ACTIVE ASSESSMENT CARD
          ══════════════════════════════════════════════════════════════ */}
          {liveTests.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{
                background: "linear-gradient(135deg, rgba(14,165,233,0.15), rgba(30,58,138,0.25))",
                border: "1px solid rgba(56,189,248,0.35)",
                borderRadius: "var(--radius-lg)",
                padding: "20px 24px",
                position: "relative",
                overflow: "hidden"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: "var(--green)", animation: "pulse 1.2s infinite" }} />
                      <span style={{ color: "var(--cyan)", fontWeight: 800, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        Active Live Assessment in Progress
                      </span>
                    </div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-1)", marginBottom: 4 }}>
                      {liveTests[0].title}
                    </h2>
                    <p style={{ color: "var(--text-2)", fontSize: 13, maxWidth: 650, lineHeight: 1.5 }}>
                      {liveTests[0].description || "Live placement evaluation test. Ranks shuffle in real-time as students submit."}
                    </p>
                    <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 12, color: "var(--text-3)", flexWrap: "wrap" }}>
                      <span>⏱️ <strong>{liveTests[0].durationMinutes} Minutes</strong></span>
                      <span>📋 <strong>{liveTests[0].totalQuestions} Questions</strong></span>
                      <span>👨‍🏫 Faculty: <strong>{liveTests[0].assignedTeacher || "Department Assigned"}</strong></span>
                      <span>🎯 Target: <strong>{liveTests[0].assignedClass || "All MCA"}</strong></span>
                    </div>
                  </div>

                  <div style={{ alignSelf: "center" }}>
                    {myTestResults[liveTests[0].id] ? (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, color: "var(--green)", fontWeight: 700, marginBottom: 4 }}>
                          ✓ Assessment Completed
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-1)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                          Score: {myTestResults[liveTests[0].id].score} / {myTestResults[liveTests[0].id].totalMarks}
                        </div>
                        <Link to={`/tests?leaderboard=${liveTests[0].id}`} className="btn btn-ghost btn-sm" style={{ marginTop: 8, fontSize: 11 }}>
                          View Live Leaderboard →
                        </Link>
                      </div>
                    ) : (
                      <Link
                        to={`/test/${liveTests[0].id}`}
                        className="btn btn-primary"
                        style={{
                          padding: "12px 22px",
                          fontWeight: 800,
                          fontSize: 14,
                          boxShadow: "0 0 20px rgba(56,189,248,0.3)"
                        }}
                      >
                        <PlayCircle size={16} /> Enter Live Test Now
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              ACADEMIC READINESS & STREAK OVERVIEW
          ══════════════════════════════════════════════════════════════ */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
            {/* Academic Readiness */}
            <div className="glass-card" style={{ padding: 22 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <div>
                  <span style={{ fontWeight: 800, fontSize: 15, color: "var(--text-1)" }}>
                    Placement Readiness Index
                  </span>
                  <p style={{ color: "var(--text-3)", fontSize: 12, marginTop: 2 }}>
                    Solved: <strong>{totalSolved}</strong> of <strong>{totalAvailable}</strong> curriculum problems
                    <span style={{ color: "var(--cyan)", marginLeft: 6 }}>
                      (Coding: {problemsSolved} • DBMS: {dbmsPassed})
                    </span>
                  </p>
                </div>
                <span style={{ fontSize: 28, fontWeight: 800, color: "var(--cyan)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {Math.round(progressPct)}%
                </span>
              </div>
              <div className="progress-bar" style={{ height: 8, borderRadius: 4 }}>
                <div className="progress-fill" style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, var(--cyan), var(--blue))" }} />
              </div>
              <div className="flex justify-between" style={{ marginTop: 8, fontSize: 11, color: "var(--text-3)" }}>
                <span>Foundation Level</span>
                <span>Core Competency</span>
                <span style={{ color: "var(--cyan)", fontWeight: 700 }}>Placement Qualified</span>
              </div>
            </div>

            {/* Academic Consistency Streak */}
            <div className="glass-card" style={{
              padding: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: currentStreak > 0
                ? "linear-gradient(135deg, rgba(56,189,248,0.08), rgba(30,58,138,0.15))"
                : undefined,
              border: currentStreak > 0 ? "1px solid rgba(56,189,248,0.3)" : undefined
            }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Practice Continuity
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, color: streakColor(currentStreak), fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.1, marginTop: 4 }}>
                  {currentStreak} <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text-2)" }}>Days Active</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
                  Academic Record: <strong>{longestStreak} days streak</strong>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: "rgba(56,189,248,0.1)",
                  border: "1px solid rgba(56,189,248,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 0 6px auto"
                }}>
                  <Flame size={28} color={streakColor(currentStreak)} />
                </div>
                {lastSolveDate === today ? (
                  <span className="badge badge-green" style={{ fontSize: 10 }}>Completed Today</span>
                ) : (
                  <span className="badge badge-yellow" style={{ fontSize: 10 }}>Pending for Today</span>
                )}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              DAILY TASKS (ACADEMIC ASSIGNMENTS)
          ══════════════════════════════════════════════════════════════ */}
          {dailyTasks.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div className="section-heading" style={{ marginBottom: 12 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                  <Calendar size={16} color="var(--cyan)" />
                  Today's Curriculum Practice Targets
                </h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
                {dailyTasks.map(task => {
                  const progress = task.type === "dbms" ? todayDbmsPasses
                    : task.type === "code" ? todayCodeSolves
                    : todayCodeSolves + todayDbmsPasses;
                  const done = progress >= task.targetCount;
                  const pct = Math.min((progress / Math.max(task.targetCount, 1)) * 100, 100);
                  return (
                    <div key={task.id} className="glass-card" style={{
                      padding: 16,
                      border: done ? "1px solid var(--green)" : "1px solid var(--border)",
                      background: done ? "rgba(16,185,129,0.06)" : undefined,
                    }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <ListChecks size={15} style={{ color: done ? "var(--green)" : "var(--cyan)" }} />
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{task.title}</span>
                        </div>
                        <span className={`badge ${task.type === "code" ? "badge-purple" : task.type === "dbms" ? "badge-cyan" : "badge-yellow"}`} style={{ fontSize: 10 }}>
                          {task.type.toUpperCase()}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 8 }}>{task.description}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                        <span style={{ color: "var(--text-2)" }}>{progress} / {task.targetCount} tasks achieved</span>
                        <span style={{ color: "var(--yellow)", fontWeight: 700 }}>+{task.points} Points</span>
                      </div>
                      <div className="progress-bar" style={{ height: 5 }}>
                        <div className="progress-fill" style={{ width: `${pct}%`, background: done ? "var(--green)" : undefined }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              FEATURE 2: 2 CORE SECTIONS (CODING & SQL) WITH NEW PROBLEMS
          ══════════════════════════════════════════════════════════════ */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 20, marginBottom: 28 }}>

            {/* ── TRACK 1: ALGORITHMIC CODING ───────────────────────── */}
            <div className="glass-card" style={{ padding: 22, border: "1px solid rgba(129,140,248,0.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(129,140,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Code2 size={16} color="var(--purple-light)" />
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-1)" }}>
                      Section 1: Algorithmic Coding Track
                    </h3>
                  </div>
                  <p style={{ color: "var(--text-3)", fontSize: 12, marginTop: 4 }}>
                    Data Structures, Algorithms &amp; Problem Solving (DSA)
                  </p>
                </div>
                <Link to="/problems" className="btn btn-ghost btn-sm" style={{ color: "var(--purple-light)", fontSize: 12 }}>
                  All Problems <ArrowRight size={13} />
                </Link>
              </div>

              {/* Coding Quick Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", padding: "10px 12px", borderRadius: "var(--radius-md)", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--green)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {problemsSolved}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Solved</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", padding: "10px 12px", borderRadius: "var(--radius-md)", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--yellow)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {pendingProblems}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>In-Review</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", padding: "10px 12px", borderRadius: "var(--radius-md)", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--cyan)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {accuracy}%
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Accuracy</div>
                </div>
              </div>

              {/* Newly Added Coding Problems */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Newly Added Coding Problems
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {latestProblems.map(p => {
                    const isSolved = solvedProblemIds.has(p.id);
                    return (
                      <div key={p.id} style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        borderRadius: "var(--radius-md)",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid var(--border)"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {isSolved ? (
                            <CheckCircle2 size={16} color="var(--green)" />
                          ) : (
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--cyan)" }} />
                          )}
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)" }}>{p.title}</div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                              {diffBadge(p.difficulty)}
                              <span style={{ fontSize: 11, color: "var(--text-3)" }}>{p.category}</span>
                            </div>
                          </div>
                        </div>

                        <Link to={`/problems/${p.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "4px 10px" }}>
                          {isSolved ? "Review" : "Solve →"}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── TRACK 2: SQL & DBMS LAB ───────────────────────────── */}
            <div className="glass-card" style={{ padding: 22, border: "1px solid rgba(56,189,248,0.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(56,189,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Database size={16} color="var(--cyan)" />
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-1)" }}>
                      Section 2: SQL &amp; DBMS Lab Track
                    </h3>
                  </div>
                  <p style={{ color: "var(--text-3)", fontSize: 12, marginTop: 4 }}>
                    Relational Queries, Joins, Aggregations &amp; Schema Lab
                  </p>
                </div>
                <Link to="/dbms" className="btn btn-ghost btn-sm" style={{ color: "var(--cyan)", fontSize: 12 }}>
                  SQL Terminal <ArrowRight size={13} />
                </Link>
              </div>

              {/* DBMS Quick Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", padding: "10px 12px", borderRadius: "var(--radius-md)", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--cyan)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {dbmsPassed} / {totalDbms}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Queries Passed</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", padding: "10px 12px", borderRadius: "var(--radius-md)", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--green)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {totalDbms > 0 ? `${Math.round((dbmsPassed / totalDbms) * 100)}%` : "0%"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Lab Complete</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", padding: "10px 12px", borderRadius: "var(--radius-md)", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--yellow)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {Math.max(totalDbms - dbmsPassed, 0)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Remaining</div>
                </div>
              </div>

              {/* Newly Added SQL Lab Tasks */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Newly Added SQL Lab Tasks
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {latestDbms.map(q => {
                    const isPassed = passedDbmsIds.has(q.id);
                    return (
                      <div key={q.id} style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        borderRadius: "var(--radius-md)",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid var(--border)"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {isPassed ? (
                            <CheckCircle2 size={16} color="var(--green)" />
                          ) : (
                            <Terminal size={15} color="var(--cyan)" />
                          )}
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)" }}>{q.title}</div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                              {diffBadge(q.difficulty)}
                              <span style={{ fontSize: 11, color: "var(--text-3)" }}>{q.topic}</span>
                            </div>
                          </div>
                        </div>

                        <Link to={`/dbms?q=${q.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "4px 10px" }}>
                          {isPassed ? "Executed ✓" : "Run Query →"}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>

          {/* ══════════════════════════════════════════════════════════════
              UNIFIED SUBMISSIONS HISTORY & QUICK TOOLS
          ══════════════════════════════════════════════════════════════ */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 }}>

            {/* Unified Submissions Table */}
            <div>
              <div className="section-heading" style={{ marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800 }}>Recent Submissions Log</h3>
              </div>
              {loading ? (
                <div className="flex justify-center" style={{ padding: 40 }}><div className="spinner" /></div>
              ) : recentSubmissions.length === 0 ? (
                <div className="glass-card" style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>
                  <Code2 size={36} style={{ marginBottom: 10, opacity: 0.3 }} />
                  <p style={{ fontSize: 14 }}>No submissions recorded yet.</p>
                  <Link to="/problems" className="btn btn-primary btn-sm" style={{ marginTop: 14 }}>
                    Solve Your First Problem
                  </Link>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {recentSubmissions.map(s => {
                    const tier = runtimeTier(s.runtime);
                    const isAccepted = s.status === "accepted";
                    const isSql = s.language?.toLowerCase() === "sql";

                    return (
                      <Link
                        key={s.id}
                        to={isSql ? "/dbms" : `/problems/${s.problemId}`}
                        style={{ textDecoration: "none" }}
                      >
                        <div className="glass-card" style={{ padding: "12px 16px", cursor: "pointer", transition: "transform 0.15s ease" }}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {isAccepted ? (
                                <CheckCircle2 size={16} color="var(--green)" />
                              ) : (
                                <XCircle size={16} color="var(--red)" />
                              )}
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)" }}>
                                  {s.problemTitle}
                                </div>
                                <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
                                  <span className={`lang-badge ${LANG_COLORS[s.language] || "lang-python"}`}>
                                    {s.language?.toUpperCase()}
                                  </span>
                                  {!isSql && (
                                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                                      <Clock size={10} style={{ verticalAlign: "middle" }} /> {s.runtime}ms
                                    </span>
                                  )}
                                  <span style={{ fontSize: 11, color: tier.color, fontWeight: 600 }}>
                                    {isSql ? "SQL Evaluation" : tier.label}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div style={{ textAlign: "right" }}>
                              <span className={`badge ${isAccepted ? "badge-green" : "badge-red"}`} style={{ fontSize: 10 }}>
                                {isAccepted ? "ACCEPTED" : "FAILED"}
                              </span>
                              {isAccepted && s.score > 0 && (
                                <div style={{ fontSize: 11, color: "var(--yellow)", marginTop: 2, fontWeight: 700 }}>
                                  +{Math.round(s.score)} pts
                                </div>
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

            {/* Quick Department Shortcuts */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="section-heading" style={{ marginBottom: 4 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800 }}>Department Resources</h3>
              </div>

              {[
                { label: "Algorithms & Problems", desc: "Curated coding questions with test suites", icon: <BookOpen size={18} />, link: "/problems", color: "var(--purple-light)" },
                { label: "DBMS SQL Terminal", desc: "Execute in-browser SQLite queries", icon: <Database size={18} />, link: "/dbms", color: "var(--cyan)" },
                { label: "Assessment Test Suite", desc: "MCQ & live programming examinations", icon: <Award size={18} />, link: "/tests", color: "var(--blue)" },
                { label: "Academic Leaderboard", desc: "Track batch rankings and performance points", icon: <Trophy size={18} />, link: "/leaderboard", color: "var(--yellow)" },
                { label: "Candidate Profile", desc: "Review academic history and submission logs", icon: <TrendingUp size={18} />, link: "/profile", color: "var(--green)" },
              ].map((a, i) => (
                <Link key={i} to={a.link} style={{ textDecoration: "none" }}>
                  <div className="glass-card" style={{ padding: "13px 16px", cursor: "pointer" }}>
                    <div className="flex items-center gap-3">
                      <div style={{
                        color: a.color,
                        background: "rgba(255,255,255,0.03)",
                        border: `1px solid ${a.color}40`,
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0
                      }}>
                        {a.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)" }}>{a.label}</div>
                        <div style={{ color: "var(--text-3)", fontSize: 11 }}>{a.desc}</div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

          </div>

        </div>
      </div>
    </>
  );
};

export default DashboardPage;
