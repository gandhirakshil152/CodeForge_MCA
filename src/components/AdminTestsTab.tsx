import React, { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, setDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  ClipboardList, Plus, Trash2, Edit3, Upload, Download,
  Eye, Clock, Users, Trophy, X, FileSpreadsheet,
  HelpCircle, Code2, ExternalLink, Sparkles, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { MCQTest } from '../pages/TestsPage';
import { SEED_PROBLEMS } from '../data/seedProblems';

interface AdminTestsTabProps {
  onRefresh?: () => void;
  users?: any[];
}

interface ParsedQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  marks: number;
  explanation: string;
}

const DEFAULT_STARTER = {
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

export const AdminTestsTab: React.FC<AdminTestsTabProps> = ({ users = [] }) => {
  const { profile } = useAuth();
  const [tests, setTests] = useState<MCQTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminTypeFilter, setAdminTypeFilter] = useState<'all' | 'mcq' | 'coding'>('all');

  // Test Modal
  const [showTestModal, setShowTestModal] = useState(false);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [savingTest, setSavingTest] = useState(false);
  const [testForm, setTestForm] = useState({
    title: '',
    description: '',
    durationMinutes: 30,
    totalQuestions: 0,
    startTime: '',
    endTime: '',
    assignedTeacher: '',
    assignedClass: 'All MCA',
    passingScore: 50,
    negativeMarking: 0,
    shuffleQuestions: true,
    shuffleOptions: true,
    showResult: 'immediate' as 'immediate' | 'after_end',
    type: 'mcq' as 'mcq' | 'coding' | 'mixed',
    status: 'active' as 'draft' | 'scheduled' | 'active' | 'ended',
  });

  // CSV Upload Modal
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvTest, setCsvTest] = useState<MCQTest | null>(null);
  const [csvQuestions, setCsvQuestions] = useState<ParsedQuestion[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Coding Test / Problems Management Modal
  const [showCodingModal, setShowCodingModal] = useState(false);
  const [codingTest, setCodingTest] = useState<MCQTest | null>(null);
  const [codingQuestions, setCodingQuestions] = useState<any[]>([]);
  const [codingTab, setCodingTab] = useState<'import' | 'custom' | 'attached'>('import');
  const [selectedProblemsToImport, setSelectedProblemsToImport] = useState<string[]>([]);
  const [importingProblems, setImportingProblems] = useState(false);
  const [customCodingForm, setCustomCodingForm] = useState({
    problemTitle: '',
    difficulty: 'easy' as 'easy' | 'medium' | 'hard',
    marks: 10,
    description: '',
    inputFormat: '',
    outputFormat: '',
    constraints: '',
    testCases: [{ input: '', expectedOutput: '' }],
    starterJava: DEFAULT_STARTER.java,
    starterC: DEFAULT_STARTER.c,
    starterPy: DEFAULT_STARTER.python,
    starterJs: DEFAULT_STARTER.javascript,
  });
  const [savingCustomProblem, setSavingCustomProblem] = useState(false);

  // Live Monitor Modal
  const [monitoringTest, setMonitoringTest] = useState<MCQTest | null>(null);
  const [liveResults, setLiveResults] = useState<any[]>([]);
  const [liveProgress, setLiveProgress] = useState<any[]>([]);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorViewTab, setMonitorViewTab] = useState<'all' | 'live' | 'shuffled'>('all');

  // Live Leaderboard Modal
  const [leaderboardTest, setLeaderboardTest] = useState<MCQTest | null>(null);
  const [leaderboardResults, setLeaderboardResults] = useState<any[]>([]);

  // Real-time listener for tests
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'mcq_tests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as MCQTest));
      setTests(all);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Real-time monitor listener (test_results + test_live_progress)
  useEffect(() => {
    if (!monitoringTest) {
      setLiveResults([]);
      setLiveProgress([]);
      return;
    }
    setMonitorLoading(true);
    const q = query(
      collection(db, 'test_results'),
      where('testId', '==', monitoringTest.id)
    );
    const unsub = onSnapshot(q, snap => {
      const res = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by score desc, then timeTaken asc so points shuffle in real-time!
      res.sort((a: any, b: any) => {
        if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
        return (a.timeTaken || 0) - (b.timeTaken || 0);
      });
      setLiveResults(res);
      setMonitorLoading(false);
    });

    const progQ = query(
      collection(db, 'test_live_progress'),
      where('testId', '==', monitoringTest.id)
    );
    const progUnsub = onSnapshot(progQ, snap => {
      const prog = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLiveProgress(prog);
    });

    return () => {
      unsub();
      progUnsub();
    };
  }, [monitoringTest]);

  // Real-time leaderboard listener
  useEffect(() => {
    if (!leaderboardTest) return;
    const q = query(
      collection(db, 'test_results'),
      where('testId', '==', leaderboardTest.id)
    );
    const unsub = onSnapshot(q, snap => {
      const res = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by score desc, then by timeTaken asc
      res.sort((a: any, b: any) => {
        if (b.score !== a.score) return (b.score || 0) - (a.score || 0);
        return (a.timeTaken || 0) - (b.timeTaken || 0);
      });
      setLeaderboardResults(res);
    });
    return unsub;
  }, [leaderboardTest]);

  // Real-time questions listener for Coding/Test manager modal
  useEffect(() => {
    if (!codingTest) { setCodingQuestions([]); return; }
    const q = query(
      collection(db, 'mcq_questions'),
      where('testId', '==', codingTest.id)
    );
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => (Number(a.order) || 0) - (Number(b.order) || 0));
      setCodingQuestions(list);
    });
    return unsub;
  }, [codingTest]);

  // Toggle Test Live status (Instant 1-Click Go-Live)
  const toggleTestLive = async (t: MCQTest) => {
    const willBeLive = t.status !== 'active';
    try {
      const testRef = doc(db, 'mcq_tests', t.id);
      if (willBeLive) {
        await updateDoc(testRef, {
          status: 'active',
          startTime: serverTimestamp(),
          endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days window
          updatedAt: serverTimestamp(),
        });
        toast.success(`"${t.title}" is now LIVE! 🟢 Candidates can take it immediately.`, { duration: 4500 });
      } else {
        await updateDoc(testRef, {
          status: 'ended',
          updatedAt: serverTimestamp(),
        });
        toast.success(`"${t.title}" has been closed/ended. ⏸️`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update test status!');
    }
  };

  // Open Coding Modal
  const openCodingModal = (t: MCQTest) => {
    setCodingTest(t);
    setSelectedProblemsToImport([]);
    setCodingTab('import');
    setShowCodingModal(true);
  };

  // Import Selected Coding Problems to Test
  const handleImportProblemsToTest = async () => {
    if (!codingTest || selectedProblemsToImport.length === 0) {
      toast.error('Please select at least one coding problem to import!');
      return;
    }
    setImportingProblems(true);
    try {
      const batch = writeBatch(db);
      const baseOrder = codingQuestions.length;
      const problemsToAdd = SEED_PROBLEMS.filter(p => selectedProblemsToImport.includes(p.title));

      problemsToAdd.forEach((p, idx) => {
        const qRef = doc(collection(db, 'mcq_questions'));
        batch.set(qRef, {
          testId: codingTest.id,
          type: 'coding',
          problemTitle: p.title,
          question: p.description,
          difficulty: p.difficulty,
          marks: 10,
          inputFormat: p.inputFormat || '',
          outputFormat: p.outputFormat || '',
          constraints: p.constraints || '',
          testCases: p.testCases || [],
          starterCode: p.starterCode || DEFAULT_STARTER,
          order: baseOrder + idx + 1,
          createdAt: serverTimestamp(),
        });
      });

      // Update test document: ensure active & update total questions
      const testRef = doc(db, 'mcq_tests', codingTest.id);
      batch.update(testRef, {
        totalQuestions: (codingTest.totalQuestions || 0) + problemsToAdd.length,
        type: codingTest.type === 'mcq' ? 'mixed' : codingTest.type,
        status: 'active', // Automatically make live!
        startTime: serverTimestamp(),
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      toast.success(`Added ${problemsToAdd.length} coding problem(s) to "${codingTest.title}"! Test is LIVE 🟢`, { duration: 4000 });
      setSelectedProblemsToImport([]);
      setCodingTab('attached');
    } catch (err) {
      console.error(err);
      toast.error('Failed to import coding problems!');
    } finally {
      setImportingProblems(false);
    }
  };

  // Save Custom Coding Problem
  const handleSaveCustomCodingProblem = async () => {
    if (!codingTest) return;
    if (!customCodingForm.problemTitle.trim()) { toast.error('Please enter problem title!'); return; }
    if (!customCodingForm.description.trim()) { toast.error('Please enter problem description!'); return; }

    const validTestCases = customCodingForm.testCases.filter(tc => tc.input.trim() || tc.expectedOutput.trim());
    if (validTestCases.length === 0) {
      toast.error('Please add at least one test case with input and expected output!');
      return;
    }

    setSavingCustomProblem(true);
    try {
      const qRef = doc(collection(db, 'mcq_questions'));
      await setDoc(qRef, {
        testId: codingTest.id,
        type: 'coding',
        problemTitle: customCodingForm.problemTitle.trim(),
        question: customCodingForm.description.trim(),
        difficulty: customCodingForm.difficulty,
        marks: Number(customCodingForm.marks) || 10,
        inputFormat: customCodingForm.inputFormat.trim(),
        outputFormat: customCodingForm.outputFormat.trim(),
        constraints: customCodingForm.constraints.trim(),
        testCases: validTestCases,
        starterCode: {
          java: customCodingForm.starterJava || DEFAULT_STARTER.java,
          c: customCodingForm.starterC || DEFAULT_STARTER.c,
          python: customCodingForm.starterPy || DEFAULT_STARTER.python,
          javascript: customCodingForm.starterJs || DEFAULT_STARTER.javascript,
        },
        order: codingQuestions.length + 1,
        createdAt: serverTimestamp(),
      });

      // Update test document
      const testRef = doc(db, 'mcq_tests', codingTest.id);
      await updateDoc(testRef, {
        totalQuestions: (codingTest.totalQuestions || 0) + 1,
        type: codingTest.type === 'mcq' ? 'mixed' : codingTest.type,
        status: 'active',
        startTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success(`Coding problem "${customCodingForm.problemTitle}" added to test! 🎉`);
      setCustomCodingForm({
        problemTitle: '',
        difficulty: 'easy',
        marks: 10,
        description: '',
        inputFormat: '',
        outputFormat: '',
        constraints: '',
        testCases: [{ input: '', expectedOutput: '' }],
        starterJava: DEFAULT_STARTER.java,
        starterC: DEFAULT_STARTER.c,
        starterPy: DEFAULT_STARTER.python,
        starterJs: DEFAULT_STARTER.javascript,
      });
      setCodingTab('attached');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save coding problem!');
    } finally {
      setSavingCustomProblem(false);
    }
  };

  // Delete Question from test
  const handleDeleteQuestionFromTest = async (qId: string, qTitle: string) => {
    if (!codingTest) return;
    if (!window.confirm(`Delete question "${qTitle}" from this test?`)) return;
    try {
      await deleteDoc(doc(db, 'mcq_questions', qId));
      const testRef = doc(db, 'mcq_tests', codingTest.id);
      await updateDoc(testRef, {
        totalQuestions: Math.max(0, (codingTest.totalQuestions || 1) - 1),
        updatedAt: serverTimestamp(),
      });
      toast.success('Question removed from test.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete question!');
    }
  };

  // Reset form
  const resetForm = () => {
    setTestForm({
      title: '',
      description: '',
      durationMinutes: 30,
      totalQuestions: 0,
      startTime: '',
      endTime: '',
      assignedTeacher: '',
      assignedClass: 'All MCA',
      passingScore: 50,
      negativeMarking: 0,
      shuffleQuestions: true,
      shuffleOptions: true,
      showResult: 'immediate',
      type: 'mcq',
      status: 'active',
    });
    setEditingTestId(null);
    setShowTestModal(false);
  };

  const openEdit = (t: MCQTest) => {
    const sDate = t.startTime?.toDate ? t.startTime.toDate().toISOString().slice(0, 16) : '';
    const eDate = t.endTime?.toDate ? t.endTime.toDate().toISOString().slice(0, 16) : '';
    setTestForm({
      title: t.title,
      description: t.description || '',
      durationMinutes: t.durationMinutes || 30,
      totalQuestions: t.totalQuestions || 0,
      startTime: sDate,
      endTime: eDate,
      assignedTeacher: (t.assignedTo && t.assignedTo[0]) || '',
      assignedClass: (t.assignedClasses && t.assignedClasses[0]) || 'All MCA',
      passingScore: t.passingScore ?? 50,
      negativeMarking: t.negativeMarking ?? 0,
      shuffleQuestions: t.shuffleQuestions ?? true,
      shuffleOptions: t.shuffleOptions ?? true,
      showResult: t.showResult || 'immediate',
      type: t.type || 'mcq',
      status: t.status || 'active',
    });
    setEditingTestId(t.id);
    setShowTestModal(true);
  };

  const handleSaveTest = async () => {
    if (!testForm.title.trim()) { toast.error('Please enter a test title!'); return; }
    setSavingTest(true);

    try {
      const startTimestamp = testForm.startTime ? new Date(testForm.startTime) : new Date();
      const endTimestamp = testForm.endTime
        ? new Date(testForm.endTime)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days fallback

      const payload = {
        title: testForm.title.trim(),
        description: testForm.description.trim(),
        durationMinutes: Number(testForm.durationMinutes) || 30,
        totalQuestions: Number(testForm.totalQuestions) || 0,
        startTime: startTimestamp,
        endTime: endTimestamp,
        assignedTo: testForm.assignedTeacher ? [testForm.assignedTeacher] : ['Faculty Coordinator'],
        assignedClasses: testForm.assignedClass ? [testForm.assignedClass] : ['All MCA'],
        passingScore: Number(testForm.passingScore) || 50,
        negativeMarking: Number(testForm.negativeMarking) || 0,
        shuffleQuestions: testForm.shuffleQuestions,
        shuffleOptions: testForm.shuffleOptions,
        showResult: testForm.showResult,
        type: testForm.type,
        status: testForm.status,
        updatedAt: serverTimestamp(),
      };

      if (editingTestId) {
        await updateDoc(doc(db, 'mcq_tests', editingTestId), payload);
        toast.success('Test updated successfully! ✅');
      } else {
        await addDoc(collection(db, 'mcq_tests'), {
          ...payload,
          createdBy: profile?.displayName || 'Admin',
          createdAt: serverTimestamp(),
        });
        toast.success('Placement test created! 🎉');
      }

      resetForm();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save test!');
    } finally {
      setSavingTest(false);
    }
  };

  const handleDeleteTest = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete test "${title}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'mcq_tests', id));
      toast.success('Test deleted successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete test!');
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // CSV PARSING & UPLOAD
  // ══════════════════════════════════════════════════════════════════

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError(null);

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const text = evt.target?.result as string;
        parseCSV(text);
      } catch (err: any) {
        setCsvError(err.message || 'Error parsing CSV file');
      }
    };
    reader.readAsText(file);
  };

  // Parse CSV lines respecting quotes
  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      throw new Error('CSV must contain a header row and at least one question row.');
    }

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          if (inQuotes && line[i + 1] === char) {
            current += char;
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const header = parseLine(lines[0]).map(h => h.toLowerCase());
    const qIdx = header.findIndex(h => h.includes('question') || h.includes('text') || h.includes('title'));
    const aIdx = header.findIndex(h => h.includes('option a') || h.includes('opt a') || h === 'a');
    const bIdx = header.findIndex(h => h.includes('option b') || h.includes('opt b') || h === 'b');
    const cIdx = header.findIndex(h => h.includes('option c') || h.includes('opt c') || h === 'c');
    const dIdx = header.findIndex(h => h.includes('option d') || h.includes('opt d') || h === 'd');
    const ansIdx = header.findIndex(h => h.includes('correct') || h.includes('ans'));
    const marksIdx = header.findIndex(h => h.includes('mark') || h.includes('point') || h.includes('score'));
    const expIdx = header.findIndex(h => h.includes('exp') || h.includes('solution') || h.includes('hint'));

    const parsed: ParsedQuestion[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseLine(lines[i]);
      if (row.length < 5) continue; // skip incomplete rows

      const qText = qIdx !== -1 ? row[qIdx] : row[0];
      const optA = aIdx !== -1 ? row[aIdx] : row[1];
      const optB = bIdx !== -1 ? row[bIdx] : row[2];
      const optC = cIdx !== -1 ? row[cIdx] : row[3];
      const optD = dIdx !== -1 ? row[dIdx] : row[4];
      const rawAns = ansIdx !== -1 ? row[ansIdx] : row[5];
      const marksVal = marksIdx !== -1 ? Number(row[marksIdx]) || 1 : 1;
      const explanation = expIdx !== -1 ? row[expIdx] : (row[7] || '');

      if (!qText || !optA || !optB) continue;

      let correctIndex = 0;
      const ansClean = String(rawAns || '').trim().toUpperCase();
      if (ansClean === 'A' || ansClean === '1' || ansClean === 'OPT A' || ansClean === optA.toUpperCase()) {
        correctIndex = 0;
      } else if (ansClean === 'B' || ansClean === '2' || ansClean === 'OPT B' || ansClean === optB.toUpperCase()) {
        correctIndex = 1;
      } else if (ansClean === 'C' || ansClean === '3' || ansClean === 'OPT C' || ansClean === optC.toUpperCase()) {
        correctIndex = 2;
      } else if (ansClean === 'D' || ansClean === '4' || ansClean === 'OPT D' || (optD && ansClean === optD.toUpperCase())) {
        correctIndex = 3;
      }

      parsed.push({
        question: qText,
        options: [optA, optB, optC, optD].filter(Boolean),
        correctIndex,
        marks: marksVal,
        explanation,
      });
    }

    if (parsed.length === 0) {
      throw new Error('No valid questions found in CSV. Please verify column formatting.');
    }

    setCsvQuestions(parsed);
    toast.success(`Parsed ${parsed.length} questions from CSV!`);
  };

  const handleCommitCsv = async () => {
    if (!csvTest || csvQuestions.length === 0) return;
    setCsvUploading(true);
    try {
      const batch = writeBatch(db);
      csvQuestions.forEach((q, index) => {
        const qRef = doc(collection(db, 'mcq_questions'));
        batch.set(qRef, {
          testId: csvTest.id,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          marks: q.marks,
          negativeMarks: csvTest.negativeMarking || 0,
          explanation: q.explanation || '',
          order: index + 1,
          createdAt: serverTimestamp(),
        });
      });

      // Update test totalQuestions count AND immediately activate test!
      const testRef = doc(db, 'mcq_tests', csvTest.id);
      batch.update(testRef, {
        totalQuestions: (csvTest.totalQuestions || 0) + csvQuestions.length,
        status: 'active', // Immediately active for candidates!
        startTime: serverTimestamp(),
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7-day fallback window
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      toast.success(`Successfully uploaded ${csvQuestions.length} questions! "${csvTest.title}" is now LIVE 🟢 for all students! 🎉`, { duration: 5000 });
      setShowCsvModal(false);
      setCsvQuestions([]);
      setCsvTest(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload questions to database.');
    } finally {
      setCsvUploading(false);
    }
  };

  const downloadSampleCsv = () => {
    const csvContent =
      'Question,Option A,Option B,Option C,Option D,Correct Option,Marks,Explanation\n' +
      '"What is the time complexity of searching in a Balanced Binary Search Tree?","O(n)","O(log n)","O(n log n)","O(1)","B",1,"Balanced BST has height O(log n), making search logarithmic."\n' +
      '"Which SQL clause is used to filter aggregated group records?","WHERE","ORDER BY","HAVING","GROUP BY","C",1,"HAVING filters grouped aggregates, WHERE filters individual rows."\n' +
      '"In Java, which collection class does not allow duplicate elements?","ArrayList","LinkedList","HashSet","Vector","C",1,"HashSet implements Set interface which prohibits duplicates."\n' +
      '"Which of the following is not an ACID property in DBMS?","Atomicity","Consistency","Inheritance","Durability","C",1,"ACID stands for Atomicity, Consistency, Isolation, Durability."\n' +
      '"What will be the output of `print(2 ** 3)` in Python?","5","6","8","9","C",1,"The ** operator is exponentiation in Python: 2^3 = 8."';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'CodeForge_MCQ_Sample_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Sample CSV Template downloaded!');
  };

  // ══════════════════════════════════════════════════════════════════
  // EXPORT RESULTS TO CSV
  // ══════════════════════════════════════════════════════════════════

  const exportResultsToCsv = (test: MCQTest, results: any[]) => {
    if (!results.length) { toast.error('No candidate submissions to export!'); return; }

    const headers = ['Rank', 'Candidate Name', 'Email', 'Score', 'Total Marks', 'Percentage', 'Status', 'Tab Switch Warnings', 'Time Taken (sec)', 'Submitted At'];
    const rows = results.map((r, i) => [
      i + 1,
      `"${r.userName || 'Anonymous'}"`,
      `"${r.userEmail || ''}"`,
      r.score || 0,
      r.totalMarks || 0,
      `${r.percentage || 0}%`,
      r.passed ? 'PASSED' : 'FAILED',
      r.warnings || 0,
      r.timeTaken || 0,
      r.submittedAt?.toDate ? `"${r.submittedAt.toDate().toLocaleString()}"` : '—',
    ]);

    const csvData = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${test.title.replace(/[^a-zA-Z0-9]/g, '_')}_Placement_Results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Results exported to CSV! 📊');
  };

  const fmtDate = (ts: any) => {
    if (!ts) return '—';
    if (ts.toDate) return ts.toDate().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    if (ts instanceof Date) return ts.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    return String(ts);
  };

  return (
    <div>
      {/* Top Banner & Action */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 14, marginBottom: 20,
      }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={20} color="var(--cyan)" />
            Placement Tests &amp; Faculty Proctoring
          </h2>
          <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 4 }}>
            Create tests, assign faculty/teachers, upload questions via CSV, monitor live candidates &amp; view leaderboards
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={downloadSampleCsv}
            title="Download CSV Template for MCQ upload"
          >
            <Download size={14} /> Download CSV Template
          </button>
          <button
            className="btn btn-primary"
            onClick={() => { resetForm(); setShowTestModal(true); }}
          >
            <Plus size={15} /> Create Placement Test
          </button>
        </div>
      </div>

      {/* Category Filter Pills: All vs MCQ vs Programming */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <button
          className="btn btn-sm"
          style={{
            background: adminTypeFilter === 'all' ? 'linear-gradient(135deg, var(--purple), var(--cyan))' : 'rgba(255,255,255,0.03)',
            color: adminTypeFilter === 'all' ? '#fff' : 'var(--text-2)',
            border: adminTypeFilter === 'all' ? 'none' : '1px solid var(--border)',
            fontWeight: 700,
            padding: '7px 16px',
          }}
          onClick={() => setAdminTypeFilter('all')}
        >
          📋 All Tests ({tests.length})
        </button>

        <button
          className="btn btn-sm"
          style={{
            background: adminTypeFilter === 'mcq' ? 'linear-gradient(135deg, var(--cyan), #0284c7)' : 'rgba(255,255,255,0.03)',
            color: adminTypeFilter === 'mcq' ? '#fff' : 'var(--text-2)',
            border: adminTypeFilter === 'mcq' ? 'none' : '1px solid var(--border)',
            fontWeight: 700,
            padding: '7px 16px',
          }}
          onClick={() => setAdminTypeFilter('mcq')}
        >
          📝 MCQ Tests ({tests.filter(t => t.type !== 'coding').length})
        </button>

        <button
          className="btn btn-sm"
          style={{
            background: adminTypeFilter === 'coding' ? 'linear-gradient(135deg, var(--purple-light), #7c3aed)' : 'rgba(255,255,255,0.03)',
            color: adminTypeFilter === 'coding' ? '#fff' : 'var(--text-2)',
            border: adminTypeFilter === 'coding' ? 'none' : '1px solid var(--border)',
            fontWeight: 700,
            padding: '7px 16px',
          }}
          onClick={() => setAdminTypeFilter('coding')}
        >
          💻 Programming Tests ({tests.filter(t => t.type === 'coding' || t.type === 'mixed').length})
        </button>
      </div>

      {/* Tests Grid */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-3)' }}>Loading tests...</p>
        </div>
      ) : tests.length === 0 ? (
        <div className="glass-card" style={{ padding: 60, textAlign: 'center' }}>
          <ClipboardList size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No Placement Tests Created Yet</h3>
          <p style={{ color: 'var(--text-3)', fontSize: 13, maxWidth: 450, margin: '0 auto 20px' }}>
            Faculty members can conduct MCQ and Coding placement tests. Create your first test and upload questions via CSV!
          </p>
          <button className="btn btn-primary" onClick={() => setShowTestModal(true)}>
            <Plus size={15} /> Create First Test
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 18 }}>
          {tests
            .filter(t => {
              if (adminTypeFilter === 'mcq') return t.type !== 'coding';
              if (adminTypeFilter === 'coding') return t.type === 'coding' || t.type === 'mixed';
              return true;
            })
            .map(t => {
            const isLive = t.status === 'active';
            return (
              <div
                key={t.id}
                className="glass-card"
                style={{
                  padding: 22,
                  border: isLive ? '1px solid rgba(16,185,129,0.45)' : '1px solid var(--border)',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                {/* Glow bar on live */}
                {isLive && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    background: 'linear-gradient(90deg, var(--green), var(--cyan))',
                  }} />
                )}

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className={`badge ${t.status === 'active' ? 'badge-green' : t.status === 'scheduled' ? 'badge-yellow' : t.status === 'draft' ? 'badge-purple' : 'badge-red'}`}>
                        {t.status === 'active' && '🟢 '}{t.status?.toUpperCase() || 'ACTIVE'}
                      </span>
                      <span className="badge" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', fontSize: 11 }}>
                        {t.type === 'mcq' ? '📝 MCQ' : t.type === 'coding' ? '💻 Coding' : '🔀 Mixed'}
                      </span>
                    </div>

                    <span style={{ fontSize: 11, color: 'var(--cyan)', fontWeight: 600 }}>
                      Class: {t.assignedClasses?.[0] || 'All'}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: 'var(--text-1)' }}>
                    {t.title}
                  </h3>

                  {t.description && (
                    <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 16 }}>
                      {t.description.slice(0, 100)}{t.description.length > 100 ? '…' : ''}
                    </p>
                  )}

                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                    padding: '10px 12px', background: 'rgba(255,255,255,0.02)',
                    borderRadius: 'var(--radius-md)', marginBottom: 16, border: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <div className="flex items-center gap-2" style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      <HelpCircle size={13} color="var(--purple-light)" />
                      <span>{t.totalQuestions || 0} Questions</span>
                    </div>
                    <div className="flex items-center gap-2" style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      <Clock size={13} color="var(--yellow)" />
                      <span>{t.durationMinutes} mins</span>
                    </div>
                    <div className="flex items-center gap-2" style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      <Users size={13} color="var(--cyan)" />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.assignedTo?.[0] || 'Faculty'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2" style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      <Trophy size={13} color="var(--green)" />
                      <span>Pass: {t.passingScore}%</span>
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 16 }}>
                    📅 <strong>Timing:</strong> {fmtDate(t.startTime)} → {fmtDate(t.endTime)}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* PROMINENT LIVE TOGGLE & PREVIEW */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      className="btn btn-sm"
                      style={{
                        flex: 1,
                        background: isLive
                          ? 'rgba(16,185,129,0.15)'
                          : 'linear-gradient(135deg, #10b981, #059669)',
                        border: isLive ? '1px solid rgba(16,185,129,0.5)' : 'none',
                        color: isLive ? 'var(--green)' : '#fff',
                        fontWeight: 800,
                        justifyContent: 'center',
                        boxShadow: isLive ? 'none' : '0 2px 10px rgba(16,185,129,0.3)',
                      }}
                      onClick={() => toggleTestLive(t)}
                      title={isLive ? 'Test is currently LIVE. Click to End test' : 'Activate test immediately so students can start right away'}
                    >
                      {isLive ? (
                        <>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 1.5s infinite' }} />
                          LIVE NOW (Click to End)
                        </>
                      ) : (
                        <>🚀 Make Live Now</>
                      )}
                    </button>

                    <a
                      href={`/test/${t.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                      title="Open test taking screen directly to test as student"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--cyan)', border: '1px solid rgba(34,211,238,0.25)' }}
                    >
                      <ExternalLink size={13} /> Test View
                    </a>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {/* Live Monitor */}
                    <button
                      className="btn btn-sm"
                      style={{
                        background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))',
                        border: '1px solid rgba(239,68,68,0.4)',
                        color: '#f87171',
                        fontWeight: 700,
                        justifyContent: 'center',
                      }}
                      onClick={() => setMonitoringTest(t)}
                    >
                      <Eye size={13} /> 🔴 Live Monitor
                    </button>

                    {/* Live Leaderboard */}
                    <button
                      className="btn btn-sm"
                      style={{
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))',
                        border: '1px solid rgba(245,158,11,0.4)',
                        color: 'var(--yellow)',
                        fontWeight: 700,
                        justifyContent: 'center',
                      }}
                      onClick={() => setLeaderboardTest(t)}
                    >
                      <Trophy size={13} /> Leaderboard
                    </button>
                  </div>

                  {/* Question Management: CSV MCQs & Coding Problems */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ flex: 1, minWidth: 100, justifyContent: 'center', color: 'var(--cyan)', border: '1px solid rgba(34,211,238,0.2)' }}
                      onClick={() => { setCsvTest(t); setCsvQuestions([]); setCsvError(null); setShowCsvModal(true); }}
                      title="Upload Multiple Choice Questions via CSV"
                    >
                      <Upload size={13} /> CSV MCQs
                    </button>

                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ flex: 1, minWidth: 110, justifyContent: 'center', color: 'var(--purple-light)', border: '1px solid rgba(168,85,247,0.3)' }}
                      onClick={() => openCodingModal(t)}
                      title="Organize Coding Problems for this test"
                    >
                      <Code2 size={13} /> 💻 Coding Problems
                    </button>

                    {/* Edit */}
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => openEdit(t)}
                      title="Edit Test Settings"
                    >
                      <Edit3 size={13} />
                    </button>

                    {/* Delete */}
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--red)' }}
                      onClick={() => handleDeleteTest(t.id, t.title)}
                      title="Delete Test"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          CREATE / EDIT TEST MODAL
      ══════════════════════════════════════════════════════════════ */}
      {showTestModal && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClipboardList size={18} color="var(--purple-light)" />
                {editingTestId ? 'Edit Placement Test' : 'Create Placement Test'}
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={resetForm}><X size={15} /></button>
            </div>

            <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Title */}
                <div>
                  <label className="label">Test Title *</label>
                  <input
                    className="input"
                    placeholder="e.g. Campus Placement Aptitude & Technical Drive - Round 1"
                    value={testForm.title}
                    onChange={e => setTestForm(p => ({ ...p, title: e.target.value }))}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="label">Description / Instructions</label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Provide details about syllabus, rules, negative marking..."
                    value={testForm.description}
                    onChange={e => setTestForm(p => ({ ...p, description: e.target.value }))}
                  />
                </div>

                {/* Grid 2 cols */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label">Test Type</label>
                    <select
                      className="input"
                      value={testForm.type}
                      onChange={e => setTestForm(p => ({ ...p, type: e.target.value as any }))}
                    >
                      <option value="mcq">📝 MCQ Assessment Test (Upload via CSV)</option>
                      <option value="coding">💻 Programming Test (Coding Challenges: Java, C, Python, JS)</option>
                      <option value="mixed">🔀 Mixed Test (MCQ + Programming)</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Status</label>
                    <select
                      className="input"
                      value={testForm.status}
                      onChange={e => setTestForm(p => ({ ...p, status: e.target.value as any }))}
                    >
                      <option value="active">Active (Available Now)</option>
                      <option value="scheduled">Scheduled (Opens at Start Time)</option>
                      <option value="draft">Draft (Hidden from students)</option>
                      <option value="ended">Ended (Closed)</option>
                    </select>
                  </div>
                </div>

                {/* Timings */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label">Start Time *</label>
                    <input
                      className="input"
                      type="datetime-local"
                      value={testForm.startTime}
                      onChange={e => setTestForm(p => ({ ...p, startTime: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="label">End Time (Closing Deadline) *</label>
                    <input
                      className="input"
                      type="datetime-local"
                      value={testForm.endTime}
                      onChange={e => setTestForm(p => ({ ...p, endTime: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Duration & Passing Score */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label">Duration (Minutes)</label>
                    <input
                      className="input"
                      type="number"
                      min={5}
                      max={300}
                      value={testForm.durationMinutes}
                      onChange={e => setTestForm(p => ({ ...p, durationMinutes: Number(e.target.value) }))}
                    />
                  </div>

                  <div>
                    <label className="label">Passing Score (%)</label>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={100}
                      value={testForm.passingScore}
                      onChange={e => setTestForm(p => ({ ...p, passingScore: Number(e.target.value) }))}
                    />
                  </div>

                  <div>
                    <label className="label">Negative Marks (per wrong)</label>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={5}
                      step={0.25}
                      value={testForm.negativeMarking}
                      onChange={e => setTestForm(p => ({ ...p, negativeMarking: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                {/* Faculty & Class Assign */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label">Assign Faculty / Teacher</label>
                    <input
                      className="input"
                      list="faculty-teachers-list"
                      placeholder="e.g. Prof. Sharma (Placement Cell)"
                      value={testForm.assignedTeacher}
                      onChange={e => setTestForm(p => ({ ...p, assignedTeacher: e.target.value }))}
                    />
                    <datalist id="faculty-teachers-list">
                      {users.map((u: any) => (
                        <option key={u.id || u.email} value={`${u.displayName || u.email} (${u.role || 'faculty'})`} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="label">Assigned Batch / Class</label>
                    <input
                      className="input"
                      placeholder="e.g. MCA Batch 2024-26"
                      value={testForm.assignedClass}
                      onChange={e => setTestForm(p => ({ ...p, assignedClass: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', paddingTop: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={testForm.shuffleQuestions}
                      onChange={e => setTestForm(p => ({ ...p, shuffleQuestions: e.target.checked }))}
                    />
                    Shuffle Questions for students
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={testForm.shuffleOptions}
                      onChange={e => setTestForm(p => ({ ...p, shuffleOptions: e.target.checked }))}
                    />
                    Shuffle Options (A, B, C, D)
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={resetForm}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveTest} disabled={savingTest}>
                {savingTest ? 'Saving…' : editingTestId ? 'Update Test' : 'Create Test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          CSV QUESTION UPLOADER MODAL
      ══════════════════════════════════════════════════════════════ */}
      {showCsvModal && csvTest && (
        <div className="modal-overlay" onClick={() => setShowCsvModal(false)}>
          <div className="modal" style={{ maxWidth: 760 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Upload size={18} color="var(--cyan)" />
                  Upload MCQ Questions via CSV
                </h3>
                <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>
                  Target: <strong>{csvTest.title}</strong>
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCsvModal(false)}><X size={15} /></button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Instructions & Template download */}
              <div style={{
                padding: '14px 16px', background: 'rgba(34,211,238,0.06)',
                border: '1px solid rgba(34,211,238,0.2)', borderRadius: 'var(--radius-md)',
                marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
              }}>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  <strong>CSV Columns Required:</strong><br />
                  <code style={{ color: 'var(--cyan)' }}>Question, Option A, Option B, Option C, Option D, Correct Option, Marks, Explanation</code>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={downloadSampleCsv}>
                  <Download size={13} /> Download Template
                </button>
              </div>

              {/* Upload Input Area */}
              <div
                style={{
                  border: '2px dashed rgba(139,92,246,0.3)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '28px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'rgba(5,5,15,0.4)',
                  marginBottom: 16,
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={handleCsvFile}
                />
                <FileSpreadsheet size={36} color="var(--purple-light)" style={{ margin: '0 auto 10px', opacity: 0.8 }} />
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>
                  Click to Browse or Drag &amp; Drop CSV File
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                  Supports UTF-8 CSV exports from Excel, Google Sheets, or LMS
                </div>
              </div>

              {csvError && (
                <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#f87171', fontSize: 12, marginBottom: 14 }}>
                  ⚠️ {csvError}
                </div>
              )}

              {/* Questions Preview Table */}
              {csvQuestions.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--green)' }}>
                      ✓ {csvQuestions.length} Questions Ready to Upload
                    </span>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--red)', fontSize: 11 }}
                      onClick={() => setCsvQuestions([])}
                    >
                      Clear Preview
                    </button>
                  </div>

                  <div style={{ overflowX: 'auto', maxHeight: 260, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)', color: 'var(--text-3)' }}>
                          <th style={{ padding: '8px 10px' }}>#</th>
                          <th style={{ padding: '8px 10px' }}>Question</th>
                          <th style={{ padding: '8px 10px' }}>Options</th>
                          <th style={{ padding: '8px 10px' }}>Correct</th>
                          <th style={{ padding: '8px 10px' }}>Marks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvQuestions.map((q, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '8px 10px', color: 'var(--text-3)' }}>{i + 1}</td>
                            <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-1)', maxWidth: 260 }}>
                              {q.question.slice(0, 75)}{q.question.length > 75 ? '…' : ''}
                            </td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-2)' }}>
                              {q.options.map((opt, oIdx) => (
                                <span
                                  key={oIdx}
                                  style={{
                                    display: 'inline-block',
                                    marginRight: 6,
                                    color: oIdx === q.correctIndex ? 'var(--green)' : 'var(--text-3)',
                                    fontWeight: oIdx === q.correctIndex ? 700 : 400,
                                  }}
                                >
                                  {['A', 'B', 'C', 'D'][oIdx]}: {opt.slice(0, 20)}
                                </span>
                              ))}
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <span className="badge badge-green" style={{ fontSize: 10 }}>
                                Option {['A', 'B', 'C', 'D'][q.correctIndex]}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', color: 'var(--cyan)' }}>{q.marks} pt</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowCsvModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={csvQuestions.length === 0 || csvUploading}
                onClick={handleCommitCsv}
              >
                {csvUploading ? 'Uploading to Database…' : `Confirm & Save ${csvQuestions.length} Questions`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          FACULTY LIVE MONITORING MODAL
      ══════════════════════════════════════════════════════════════ */}
      {monitoringTest && (() => {
        const submittedUserIds = new Set(liveResults.map(r => r.userId));
        const activeStudents = liveProgress.filter(p => !submittedUserIds.has(p.userId) && p.status !== 'submitted');

        return (
          <div className="modal-overlay" onClick={() => setMonitoringTest(null)}>
            <div className="modal" style={{ maxWidth: 960, width: '95%' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--red)', animation: 'pulse 1.5s infinite' }} />
                    <h3 style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-1)' }}>
                      Faculty Live Proctor & Monitor — {monitoringTest.title}
                    </h3>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 6, fontSize: 12 }}>
                    <span style={{ background: 'rgba(56,189,248,0.12)', color: 'var(--cyan)', border: '1px solid rgba(56,189,248,0.3)', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                      👨‍🏫 Assigned Faculty: {monitoringTest.assignedTeacher || 'All MCA Department Faculty'}
                    </span>
                    <span style={{ background: 'rgba(129,140,248,0.12)', color: 'var(--purple-light)', border: '1px solid rgba(129,140,248,0.3)', padding: '2px 8px', borderRadius: 6 }}>
                      🎓 Target: {monitoringTest.assignedClass || 'All MCA Batches'}
                    </span>
                    <span style={{ color: 'var(--text-3)' }}>
                      Pass Mark: {monitoringTest.passingScore}% • Anti-cheat: Active
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => exportResultsToCsv(monitoringTest, liveResults)}
                    title="Export results to CSV"
                  >
                    <Download size={13} /> Export CSV
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setMonitoringTest(null)}><X size={15} /></button>
                </div>
              </div>

              <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                {/* Live KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: 'Taking Live Now', val: activeStudents.length, color: 'var(--green)' },
                    { label: 'Submitted', val: liveResults.length, color: 'var(--purple-light)' },
                    { label: 'Passed', val: liveResults.filter(r => r.passed).length, color: 'var(--cyan)' },
                    { label: 'Failed', val: liveResults.filter(r => !r.passed).length, color: 'var(--red)' },
                    {
                      label: 'Avg Score',
                      val: liveResults.length > 0 ? `${Math.round(liveResults.reduce((a, c) => a + (c.percentage || 0), 0) / liveResults.length)}%` : '0%',
                      color: 'var(--yellow)',
                    },
                    {
                      label: 'Tab Violations',
                      val: liveResults.reduce((a, c) => a + (c.warnings || 0), 0),
                      color: 'var(--red)',
                    },
                  ].map(s => (
                    <div key={s.label} className="glass-card" style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.val}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Real-time Shuffle Notification Notice */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  background: 'rgba(56,189,248,0.06)',
                  border: '1px solid rgba(56,189,248,0.2)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  color: 'var(--text-2)',
                  marginBottom: 16
                }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 1s infinite' }} />
                  <span><strong>Live Shuffling Leaderboard:</strong> Scores and ranks automatically re-order and shuffle in real-time as each student completes their test.</span>
                </div>

                {/* Filter Tabs */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <button
                    className="btn btn-sm"
                    style={{
                      background: monitorViewTab === 'all' ? 'var(--blue)' : 'rgba(255,255,255,0.04)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                    onClick={() => setMonitorViewTab('all')}
                  >
                    Combined Live View
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{
                      background: monitorViewTab === 'live' ? 'var(--blue)' : 'rgba(255,255,255,0.04)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                    onClick={() => setMonitorViewTab('live')}
                  >
                    🔴 Live In-Progress ({activeStudents.length})
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{
                      background: monitorViewTab === 'shuffled' ? 'var(--blue)' : 'rgba(255,255,255,0.04)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                    onClick={() => setMonitorViewTab('shuffled')}
                  >
                    🏆 Shuffled Ranks ({liveResults.length})
                  </button>
                </div>

                {/* Section 1: Live In-Progress Candidates (Faculty Monitoring) */}
                {(monitorViewTab === 'all' || monitorViewTab === 'live') && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 1.2s infinite' }} />
                        Candidates In-Progress Right Now ({activeStudents.length})
                      </h4>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Real-time question sync & tab focus tracker</span>
                    </div>

                    {activeStudents.length === 0 ? (
                      <div className="glass-card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                        No candidates are actively answering right now. When students begin the test, their live question progress will stream here.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                        {activeStudents.map((p, idx) => {
                          const total = p.totalQuestions || monitoringTest.totalQuestions || 1;
                          const answered = p.answeredCount || 0;
                          const pct = Math.min(100, Math.round((answered / total) * 100));
                          const currQ = (p.currentQuestionIndex ?? 0) + 1;

                          return (
                            <div key={p.userId || idx} className="glass-card" style={{ padding: 12, border: '1px solid rgba(56,189,248,0.25)', background: 'rgba(11,23,48,0.6)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)' }}>{p.userName || 'Student'}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{p.userEmail || ''}</div>
                                </div>
                                <span className="badge badge-green" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} /> Live
                                </span>
                              </div>

                              <div style={{ marginTop: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                                  <span style={{ color: 'var(--text-2)' }}>Progress: {answered}/{total} Answered</span>
                                  <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>{pct}%</span>
                                </div>
                                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--cyan), var(--blue))', transition: 'width 0.3s ease' }} />
                                </div>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 11 }}>
                                <span style={{ color: 'var(--purple-light)', fontWeight: 600 }}>
                                  📍 At Question #{currQ}
                                </span>
                                {p.tabSwitches && p.tabSwitches > 0 ? (
                                  <span style={{ color: 'var(--red)', fontWeight: 600 }}>
                                    ⚠️ {p.tabSwitches} Tab switch{p.tabSwitches > 1 ? 'es' : ''}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--green)' }}>✓ Focused</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Section 2: Real-time Shuffled Submissions Leaderboard */}
                {(monitorViewTab === 'all' || monitorViewTab === 'shuffled') && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Trophy size={15} color="var(--yellow)" />
                        Real-time Shuffled Leaderboard ({liveResults.length} Submissions)
                      </h4>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Sorted by score &amp; speed (Ranks shuffle live)</span>
                    </div>

                    {monitorLoading && liveResults.length === 0 ? (
                      <div style={{ padding: 40, textAlign: 'center' }}>
                        <div className="spinner" style={{ margin: '0 auto 10px' }} />
                        <p style={{ color: 'var(--text-3)' }}>Connecting to live monitor stream...</p>
                      </div>
                    ) : liveResults.length === 0 ? (
                      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
                        <Clock size={32} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                        <p>No student submissions recorded yet.</p>
                        <p style={{ fontSize: 12, marginTop: 4 }}>Submissions will shuffle here in real-time as candidates finish.</p>
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)', color: 'var(--text-3)' }}>
                              <th style={{ padding: '10px 12px' }}>Rank</th>
                              <th style={{ padding: '10px 12px' }}>Candidate</th>
                              <th style={{ padding: '10px 12px' }}>Score</th>
                              <th style={{ padding: '10px 12px' }}>Status</th>
                              <th style={{ padding: '10px 12px' }}>Anti-Cheat Violations</th>
                              <th style={{ padding: '10px 12px' }}>Time Taken</th>
                              <th style={{ padding: '10px 12px' }}>Submitted</th>
                            </tr>
                          </thead>
                          <tbody>
                            {liveResults.map((r, i) => {
                              const isTop3 = i < 3;
                              const medal = i === 0 ? '🥇 #1' : i === 1 ? '🥈 #2' : i === 2 ? '🥉 #3' : `#${i + 1}`;
                              return (
                                <tr key={r.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isTop3 ? 'rgba(56,189,248,0.04)' : 'transparent' }}>
                                  <td style={{ padding: '10px 12px', fontWeight: 800, color: isTop3 ? 'var(--yellow)' : 'var(--text-3)' }}>
                                    {medal}
                                  </td>
                                  <td style={{ padding: '10px 12px' }}>
                                    <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>{r.userName || 'Student'}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.userEmail || ''}</div>
                                  </td>
                                  <td style={{ padding: '10px 12px' }}>
                                    <div style={{ fontWeight: 700, color: r.passed ? 'var(--green)' : 'var(--red)', fontSize: 13 }}>
                                      {r.score}/{r.totalMarks} ({r.percentage}%)
                                    </div>
                                    <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
                                      ✓ {r.correct || 0} | ✗ {r.incorrect || 0}
                                    </div>
                                  </td>
                                  <td style={{ padding: '10px 12px' }}>
                                    <span className={`badge ${r.passed ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10 }}>
                                      {r.passed ? 'PASSED' : 'FAILED'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 12px' }}>
                                    {r.warnings && r.warnings > 0 ? (
                                      <span style={{ color: r.warnings >= 3 ? 'var(--red)' : 'var(--yellow)', fontWeight: 600 }}>
                                        ⚠️ {r.warnings} switch{r.warnings > 1 ? 'es' : ''} {r.autoSubmitted ? '(Auto-submitted)' : ''}
                                      </span>
                                    ) : (
                                      <span style={{ color: 'var(--green)', fontSize: 11 }}>✓ 0 (Clean)</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '10px 12px', color: 'var(--text-2)' }}>
                                    {r.timeTaken ? `${Math.floor(r.timeTaken / 60)}m ${r.timeTaken % 60}s` : '—'}
                                  </td>
                                  <td style={{ padding: '10px 12px', color: 'var(--text-3)' }}>
                                    {r.submittedAt?.toDate ? r.submittedAt.toDate().toLocaleTimeString() : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  🔴 Live streaming active • Ranks shuffle dynamically on student submissions
                </span>
                <button className="btn btn-ghost" onClick={() => setMonitoringTest(null)}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════
          LIVE MCQ LEADERBOARD MODAL
      ══════════════════════════════════════════════════════════════ */}
      {leaderboardTest && (
        <div className="modal-overlay" onClick={() => setLeaderboardTest(null)}>
          <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Trophy size={18} color="var(--yellow)" />
                  Live Leaderboard — {leaderboardTest.title}
                </h3>
                <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>
                  Top rankers sorted by highest score &amp; fastest completion time
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <a
                  href={`/leaderboard?testId=${leaderboardTest.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--cyan)', border: '1px solid rgba(34,211,238,0.3)', fontSize: 12 }}
                >
                  <ExternalLink size={13} /> Full Leaderboard Page
                </a>
                <button className="btn btn-ghost btn-sm" onClick={() => setLeaderboardTest(null)}><X size={15} /></button>
              </div>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {leaderboardResults.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
                  <Trophy size={36} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                  <p>No results submitted yet for this test.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {leaderboardResults.map((r, i) => {
                    const isTop3 = i < 3;
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
                    return (
                      <div
                        key={r.id || i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          borderRadius: 'var(--radius-md)',
                          background: isTop3 ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)',
                          border: isTop3 ? '1px solid rgba(245,158,11,0.3)' : '1px solid var(--border)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: isTop3 ? 20 : 13, fontWeight: 700, width: 28, textAlign: 'center' }}>
                            {medal}
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>
                              {r.userName || 'Student'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                              ⏱ {r.timeTaken ? `${Math.floor(r.timeTaken / 60)}m ${r.timeTaken % 60}s` : '—'} • {r.correct || 0} Correct
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: r.passed ? 'var(--green)' : 'var(--yellow)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                            {r.score} / {r.totalMarks}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            {r.percentage}% {r.passed ? '✓ Passed' : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setLeaderboardTest(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          CODING TEST & PROGRAMMING PROBLEMS ORGANIZER MODAL
      ══════════════════════════════════════════════════════════════ */}
      {showCodingModal && codingTest && (
        <div className="modal-overlay" onClick={() => setShowCodingModal(false)}>
          <div className="modal" style={{ maxWidth: 840, width: '95%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', background: 'rgba(168,85,247,0.15)',
                    border: '1px solid rgba(168,85,247,0.3)',
                  }}>
                    <Code2 size={18} color="var(--purple-light)" />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-1)' }}>
                      Organize Coding Test — {codingTest.title}
                    </h3>
                    <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>
                      Organize programming challenges, test cases &amp; starter code in Java, C, Python, JavaScript
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <a
                  href={`/test/${codingTest.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--cyan)', border: '1px solid rgba(34,211,238,0.3)' }}
                >
                  <ExternalLink size={13} /> Try Test Live
                </a>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowCodingModal(false)}>
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Sub-Tabs: 1-Click Import | Custom Problem | Attached Questions */}
            <div style={{
              display: 'flex', gap: 8, padding: '12px 24px 0', borderBottom: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.01)', overflowX: 'auto',
            }}>
              <button
                className={`tab ${codingTab === 'import' ? 'active' : ''}`}
                style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 10 }}
                onClick={() => setCodingTab('import')}
              >
                <Sparkles size={14} color="var(--yellow)" />
                ⚡ Import from Problem Bank ({SEED_PROBLEMS.length})
              </button>

              <button
                className={`tab ${codingTab === 'custom' ? 'active' : ''}`}
                style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 10 }}
                onClick={() => setCodingTab('custom')}
              >
                <Plus size={14} color="var(--cyan)" />
                ➕ Add Custom Coding Program
              </button>

              <button
                className={`tab ${codingTab === 'attached' ? 'active' : ''}`}
                style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 10 }}
                onClick={() => setCodingTab('attached')}
              >
                <Layers size={14} color="var(--purple-light)" />
                📋 Attached Test Questions ({codingQuestions.length})
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
              {/* TAB 1: IMPORT FROM PROBLEM BANK */}
              {codingTab === 'import' && (
                <div>
                  <div style={{
                    padding: '12px 16px', background: 'rgba(168,85,247,0.06)',
                    border: '1px solid rgba(168,85,247,0.2)', borderRadius: 'var(--radius-md)',
                    marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
                  }}>
                    <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      Select MCA placement programming problems to import with test cases &amp; starter code in 4 languages:
                    </div>
                    {selectedProblemsToImport.length > 0 && (
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={importingProblems}
                        onClick={handleImportProblemsToTest}
                      >
                        {importingProblems ? 'Importing…' : `Import ${selectedProblemsToImport.length} Selected to Test 🚀`}
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {SEED_PROBLEMS.map(p => {
                      const isSelected = selectedProblemsToImport.includes(p.title);
                      const isAlreadyInTest = codingQuestions.some((q: any) => q.problemTitle === p.title);

                      return (
                        <div
                          key={p.title}
                          className="glass-card"
                          style={{
                            padding: '14px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 14,
                            border: isSelected ? '1px solid var(--purple-light)' : '1px solid var(--border)',
                            background: isSelected ? 'rgba(168,85,247,0.08)' : 'rgba(255,255,255,0.01)',
                            opacity: isAlreadyInTest ? 0.65 : 1,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
                            <input
                              type="checkbox"
                              checked={isSelected || isAlreadyInTest}
                              disabled={isAlreadyInTest}
                              onChange={() => {
                                if (isSelected) {
                                  setSelectedProblemsToImport(prev => prev.filter(t => t !== p.title));
                                } else {
                                  setSelectedProblemsToImport(prev => [...prev, p.title]);
                                }
                              }}
                              style={{ marginTop: 4, cursor: isAlreadyInTest ? 'not-allowed' : 'pointer' }}
                            />
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>
                                  {p.title}
                                </span>
                                <span className={`badge ${p.difficulty === 'easy' ? 'badge-green' : p.difficulty === 'medium' ? 'badge-yellow' : 'badge-red'}`} style={{ fontSize: 10 }}>
                                  {p.difficulty.toUpperCase()}
                                </span>
                                <span className="badge" style={{ background: 'var(--bg-glass)', fontSize: 10, border: '1px solid var(--border)' }}>
                                  {p.category}
                                </span>
                                {isAlreadyInTest && (
                                  <span className="badge badge-purple" style={{ fontSize: 10 }}>
                                    ✓ Already in test
                                  </span>
                                )}
                              </div>
                              <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4, margin: 0 }}>
                                {p.description.slice(0, 110)}{p.description.length > 110 ? '…' : ''}
                              </p>
                              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--cyan)', marginTop: 6 }}>
                                <span>🧪 {p.testCases.length} Test Cases</span>
                                <span>☕ Java • C • 🐍 Python • JS</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            {isAlreadyInTest ? (
                              <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
                                Added
                              </span>
                            ) : (
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{
                                  color: isSelected ? 'var(--purple-light)' : 'var(--text-2)',
                                  border: isSelected ? '1px solid var(--purple-light)' : '1px solid var(--border)',
                                }}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedProblemsToImport(prev => prev.filter(t => t !== p.title));
                                  } else {
                                    setSelectedProblemsToImport(prev => [...prev, p.title]);
                                  }
                                }}
                              >
                                {isSelected ? '✓ Selected' : '+ Select'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: CREATE CUSTOM CODING PROBLEM */}
              {codingTab === 'custom' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="label">Problem Title *</label>
                      <input
                        className="input"
                        placeholder="e.g. Reverse a Linked List"
                        value={customCodingForm.problemTitle}
                        onChange={e => setCustomCodingForm(p => ({ ...p, problemTitle: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label">Difficulty</label>
                      <select
                        className="input"
                        value={customCodingForm.difficulty}
                        onChange={e => setCustomCodingForm(p => ({ ...p, difficulty: e.target.value as any }))}
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Marks / Score</label>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        value={customCodingForm.marks}
                        onChange={e => setCustomCodingForm(p => ({ ...p, marks: Number(e.target.value) }))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Problem Description &amp; Statement *</label>
                    <textarea
                      className="input"
                      rows={3}
                      placeholder="Explain the problem statement clearly for candidates..."
                      value={customCodingForm.description}
                      onChange={e => setCustomCodingForm(p => ({ ...p, description: e.target.value }))}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="label">Input Format</label>
                      <input
                        className="input"
                        placeholder="e.g. First line contains N, next line contains N numbers"
                        value={customCodingForm.inputFormat}
                        onChange={e => setCustomCodingForm(p => ({ ...p, inputFormat: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label">Output Format</label>
                      <input
                        className="input"
                        placeholder="e.g. Print single integer representing output"
                        value={customCodingForm.outputFormat}
                        onChange={e => setCustomCodingForm(p => ({ ...p, outputFormat: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Constraints</label>
                    <input
                      className="input"
                      placeholder="e.g. 1 <= N <= 10^5, -10^9 <= A[i] <= 10^9"
                      value={customCodingForm.constraints}
                      onChange={e => setCustomCodingForm(p => ({ ...p, constraints: e.target.value }))}
                    />
                  </div>

                  {/* Test Cases */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label className="label" style={{ margin: 0 }}>Test Cases (Auto-verified by Judge0) *</label>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, color: 'var(--cyan)' }}
                        onClick={() => setCustomCodingForm(p => ({
                          ...p,
                          testCases: [...p.testCases, { input: '', expectedOutput: '' }]
                        }))}
                      >
                        + Add Test Case
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {customCodingForm.testCases.map((tc, idx) => (
                        <div key={idx} style={{
                          padding: 12, background: 'rgba(255,255,255,0.02)',
                          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                          display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'center'
                        }}>
                          <div>
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Input #{idx + 1}</span>
                            <textarea
                              className="input"
                              rows={2}
                              placeholder="e.g. 4 9\n2 7 11 15"
                              value={tc.input}
                              onChange={e => {
                                const val = e.target.value;
                                setCustomCodingForm(p => {
                                  const list = [...p.testCases];
                                  list[idx].input = val;
                                  return { ...p, testCases: list };
                                });
                              }}
                            />
                          </div>
                          <div>
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Expected Output #{idx + 1}</span>
                            <textarea
                              className="input"
                              rows={2}
                              placeholder="e.g. 0 1"
                              value={tc.expectedOutput}
                              onChange={e => {
                                const val = e.target.value;
                                setCustomCodingForm(p => {
                                  const list = [...p.testCases];
                                  list[idx].expectedOutput = val;
                                  return { ...p, testCases: list };
                                });
                              }}
                            />
                          </div>
                          {customCodingForm.testCases.length > 1 && (
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--red)', marginTop: 14 }}
                              onClick={() => setCustomCodingForm(p => ({
                                ...p,
                                testCases: p.testCases.filter((_, i) => i !== idx)
                              }))}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                    <button
                      className="btn btn-primary"
                      disabled={savingCustomProblem}
                      onClick={handleSaveCustomCodingProblem}
                    >
                      {savingCustomProblem ? 'Saving…' : 'Save Coding Problem to Test 🎉'}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: ATTACHED QUESTIONS LIST */}
              {codingTab === 'attached' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h4 style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>
                      Total Questions in Test: {codingQuestions.length}
                    </h4>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      Questions will be presented to candidate in order
                    </span>
                  </div>

                  {codingQuestions.length === 0 ? (
                    <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
                      <Code2 size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                      <p style={{ color: 'var(--text-3)' }}>No questions attached yet to this test.</p>
                      <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setCodingTab('import')}>
                        ⚡ Import from Problem Bank
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {codingQuestions.map((q, idx) => {
                        const isCoding = q.type === 'coding' || codingTest.type === 'coding';
                        return (
                          <div
                            key={q.id || idx}
                            className="glass-card"
                            style={{
                              padding: '12px 16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-3)', width: 24 }}>
                                #{idx + 1}
                              </span>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                  <span className={`badge ${isCoding ? 'badge-purple' : 'badge-green'}`} style={{ fontSize: 10 }}>
                                    {isCoding ? '💻 Coding' : '📝 MCQ'}
                                  </span>
                                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)' }}>
                                    {q.problemTitle || q.question?.slice(0, 50) || `Question ${idx + 1}`}
                                  </span>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                                  {isCoding ? `🧪 ${(q.testCases || []).length} Test cases • ${q.marks || 10} Marks` : `4 Options • ${q.marks || 1} Mark`}
                                </div>
                              </div>
                            </div>

                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--red)' }}
                              onClick={() => handleDeleteQuestionFromTest(q.id, q.problemTitle || q.question || 'Question')}
                              title="Delete question from test"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {codingTest.status === 'active' ? (
                  <span style={{ color: 'var(--green)', fontWeight: 600 }}>🟢 Test is currently LIVE for students</span>
                ) : (
                  <span style={{ color: 'var(--yellow)' }}>⚠️ Test is not live. Click "Make Live Now" on the card when ready.</span>
                )}
              </div>
              <button className="btn btn-primary" onClick={() => setShowCodingModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
