export type LangId = 'java' | 'c' | 'python' | 'javascript';

export const LANG_OPTIONS: { id: LangId; label: string }[] = [
  { id: 'java', label: 'Java' },
  { id: 'c', label: 'C' },
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
];

export const JUDGE0_LANG_ID: Record<LangId, number> = {
  c: 50, // C (GCC 9.2.0)
  java: 62, // Java (OpenJDK 13/14)
  python: 71, // Python (3.8.1)
  javascript: 63, // JavaScript (Node.js 12.14.0)
};

export const MONACO_LANG: Record<LangId, string> = {
  java: 'java',
  c: 'c',
  python: 'python',
  javascript: 'javascript',
};

export function normaliseJavaClassName(code: string): string {
  return code.replace(/\bpublic\s+class\s+([A-Za-z0-9_]+)/g, 'public class Main');
}

export function normaliseOutput(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trimEnd())
    .join('\n')
    .trim();
}

export interface Judge0Response {
  token?: string;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  time: string | null;
  memory: number | null;
  status: { id: number; description: string };
}

export interface TestCaseResult {
  input: string;
  expected: string;
  got: string;
  passed: boolean;
}

export interface RunResult {
  status: 'accepted' | 'wrong_answer' | 'error' | 'timeout';
  output: string;
  runtime: number;
  passed: number;
  total: number;
  testDetails: TestCaseResult[];
}

import { validateCodeRestrictions, type CodeValidationResult } from './codeValidator';
export { validateCodeRestrictions, type CodeValidationResult };

const JUDGE0_URL = 'https://ce.judge0.com';

export async function submitToJudge0(
  sourceCode: string,
  langId: LangId,
  stdin: string,
): Promise<Judge0Response> {
  const policyCheck = validateCodeRestrictions(sourceCode, langId);
  if (!policyCheck.valid) {
    throw new Error(policyCheck.error || 'Code policy violation');
  }

  const src = langId === 'java' ? normaliseJavaClassName(sourceCode) : sourceCode;
  const normalStdin = stdin.endsWith('\n') ? stdin : stdin + '\n';

  const body = JSON.stringify({
    source_code: src,
    language_id: JUDGE0_LANG_ID[langId],
    stdin: normalStdin,
    cpu_time_limit: 5,
    wall_time_limit: 10,
    memory_limit: 128_000,
  });

  const endpoints = [JUDGE0_URL, 'https://api.judge0.com'];
  let lastError: Error = new Error('No endpoint available');

  for (const base of endpoints) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`${base}/submissions?base64_encoded=false&wait=true`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body,
      });
      clearTimeout(tid);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        lastError = new Error(`Judge0 HTTP ${res.status}${text ? ': ' + text.slice(0, 120) : ''}`);
        continue;
      }
      return res.json() as Promise<Judge0Response>;
    } catch (e) {
      clearTimeout(tid);
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError;
}

export async function runJudge0Code(
  code: string,
  langId: LangId,
  testCases: { input: string; expectedOutput: string }[],
): Promise<RunResult> {
  const policyCheck = validateCodeRestrictions(code, langId);
  if (!policyCheck.valid) {
    const errMsg = policyCheck.error || 'Evaluation Policy Violation';
    const cases = testCases && testCases.length > 0 ? testCases : [{ input: '', expectedOutput: '' }];
    return {
      status: 'error',
      output: `⚠️ CodeForge MCA Policy Violation:\n\n${errMsg}`,
      runtime: 0,
      passed: 0,
      total: cases.length,
      testDetails: cases.map(tc => ({
        input: tc.input || '',
        expected: tc.expectedOutput || '',
        got: errMsg,
        passed: false,
      })),
    };
  }

  if (!testCases || testCases.length === 0) {
    // If no test cases provided, run with empty input
    const start = Date.now();
    try {
      const res = await submitToJudge0(code, langId, '');
      const runtime = Date.now() - start;
      const out = res.stdout || res.compile_output || res.stderr || '(no output)';
      const ok = res.status.id === 3;
      return {
        status: ok ? 'accepted' : 'error',
        output: out,
        runtime,
        passed: ok ? 1 : 0,
        total: 1,
        testDetails: [{ input: '', expected: '', got: out, passed: ok }],
      };
    } catch (err: any) {
      return {
        status: 'error',
        output: err.message || 'Execution error',
        runtime: 0,
        passed: 0,
        total: 1,
        testDetails: [{ input: '', expected: '', got: err.message, passed: false }],
      };
    }
  }

  const testDetails: TestCaseResult[] = [];
  let passed = 0;
  let totalRuntime = 0;

  for (const tc of testCases) {
    const start = Date.now();
    try {
      const result = await submitToJudge0(code, langId, tc.input);
      totalRuntime += Date.now() - start;

      const statusId = result.status.id;

      if (statusId === 6) {
        const errMsg = result.compile_output?.trim() || result.stderr?.trim() || 'Compilation Error';
        return {
          status: 'error',
          output: `Compilation Error:\n${errMsg}`,
          runtime: 0,
          passed: 0,
          total: testCases.length,
          testDetails: [{ input: tc.input, expected: tc.expectedOutput, got: errMsg, passed: false }],
        };
      }

      if (statusId !== 3) {
        const errMsg = result.stderr?.trim() || result.status.description;
        testDetails.push({ input: tc.input, expected: normaliseOutput(tc.expectedOutput), got: errMsg, passed: false });
        continue;
      }

      const got = normaliseOutput(result.stdout || '');
      const expected = normaliseOutput(tc.expectedOutput);
      const ok = got === expected;
      if (ok) passed++;
      testDetails.push({ input: tc.input, expected, got: got || '(no output)', passed: ok });
    } catch (err: any) {
      totalRuntime += Date.now() - start;
      const msg = err instanceof Error ? err.message : 'Unknown error';
      testDetails.push({ input: tc.input, expected: tc.expectedOutput, got: `⚠️ ${msg}`, passed: false });
    }
  }

  const total = testCases.length;
  const avgRuntime = total > 0 ? Math.round(totalRuntime / total) : 0;

  if (passed === total) {
    return {
      status: 'accepted',
      output: `All ${total}/${total} test cases passed! 🎉`,
      runtime: avgRuntime,
      passed,
      total,
      testDetails,
    };
  }

  return {
    status: 'wrong_answer',
    output: `${passed}/${total} test cases passed. Output did not match expected result.`,
    runtime: avgRuntime,
    passed,
    total,
    testDetails,
  };
}
