/**
 * CodeForge MCA - Code Security & Policy Validator
 * 
 * Enforces MCA academic lab and test environment policies:
 * 1. Java: Disable I/O imports (java.io, java.nio) and file/stream I/O operations.
 *    (Students must use java.util.Scanner and System.out for standard I/O).
 * 2. C: Disable pointers (pointer variable declarations, dereferencing, -> arrow operator,
 *    and dynamic memory allocation like malloc/calloc/free).
 */

import type { LangId } from './judgeRunner';

export interface CodeValidationResult {
  valid: boolean;
  error?: string;
  ruleViolated?: 'java_io' | 'c_pointer';
}

/**
 * Remove comments and string/char literals so syntax checking doesn't flag
 * text inside comments, strings, or logs.
 */
export function stripCommentsAndLiterals(code: string): string {
  let cleaned = code;
  // Strip block comments /* ... */
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Strip single-line comments // ...
  cleaned = cleaned.replace(/\/\/[^\r\n]*/g, ' ');
  // Strip double-quoted string literals "..."
  cleaned = cleaned.replace(/"(?:\\.|[^"\\])*"/g, '""');
  // Strip single-quoted char literals '...'
  cleaned = cleaned.replace(/'(?:\\.|[^'\\])*'/g, "''");
  return cleaned;
}

/**
 * Validates Java code against MCA restrictions:
 * Disallows java.io/java.nio imports and file/stream I/O operations.
 */
export function validateJavaRestrictions(code: string): CodeValidationResult {
  const cleaned = stripCommentsAndLiterals(code);

  // 1. Check for java.io or java.nio imports
  const ioImportRegex = /\bimport\s+(?:static\s+)?java\.(?:io|nio)\b/i;
  if (ioImportRegex.test(cleaned)) {
    return {
      valid: false,
      ruleViolated: 'java_io',
      error: 'MCA Policy Violation: Java I/O imports (`java.io.*` or `java.nio.*`) are disabled. Please use `java.util.Scanner` and `System.out` for input/output.',
    };
  }

  // 2. Check for explicit package usage without import: java.io. or java.nio.
  const ioPackageRegex = /\bjava\.(?:io|nio)\b/i;
  if (ioPackageRegex.test(cleaned)) {
    return {
      valid: false,
      ruleViolated: 'java_io',
      error: 'MCA Policy Violation: Direct usage of `java.io` or `java.nio` packages is disabled. Please use standard `java.util.Scanner` and `System.out`.',
    };
  }

  // 3. Check for specific restricted File / Stream / Buffer classes
  const ioClassesRegex = /\b(FileReader|FileWriter|FileInputStream|FileOutputStream|RandomAccessFile|BufferedReader|BufferedWriter|PrintWriter|PrintStream|InputStreamReader|OutputStreamWriter|ByteArrayInputStream|ByteArrayOutputStream|DataInputStream|DataOutputStream|ObjectInputStream|ObjectOutputStream)\b/;
  const matchClass = cleaned.match(ioClassesRegex);
  if (matchClass) {
    return {
      valid: false,
      ruleViolated: 'java_io',
      error: `MCA Policy Violation: Usage of \`${matchClass[1]}\` is disabled. File and stream I/O operations are restricted. Use \`java.util.Scanner\` and \`System.out\`.`,
    };
  }

  // 4. Check for File instantiation or declaration: new File(...) or File f
  if (/\bnew\s+File\s*\(/.test(cleaned) || /\bFile\s+[A-Za-z_]\w*\s*(?:=|[;,)])/.test(cleaned)) {
    return {
      valid: false,
      ruleViolated: 'java_io',
      error: 'MCA Policy Violation: File operations (`new File(...)`) are disabled in this evaluation environment.',
    };
  }

  // 5. Check for NIO Files / Paths methods
  if (/\b(?:Files|Paths)\s*\.\s*[A-Za-z_]/.test(cleaned)) {
    return {
      valid: false,
      ruleViolated: 'java_io',
      error: 'MCA Policy Violation: `Files` and `Paths` utility operations are disabled.',
    };
  }

  // 6. Check for Process / OS execution
  if (/\b(?:ProcessBuilder|Runtime\.getRuntime)\b/.test(cleaned)) {
    return {
      valid: false,
      ruleViolated: 'java_io',
      error: 'MCA Policy Violation: Process execution and system operations are strictly forbidden.',
    };
  }

  return { valid: true };
}

/**
 * Validates C code against MCA restrictions:
 * Disallows pointer declarations, dereferencing, arrow operator (->),
 * and dynamic memory allocation (malloc, calloc, realloc, free).
 */
export function validateCRestrictions(code: string): CodeValidationResult {
  let cleaned = stripCommentsAndLiterals(code);

  // Normalize standard main signature so `int main(int argc, char *argv[])` or `char **argv` doesn't flag
  cleaned = cleaned.replace(/\bint\s+main\s*\([^)]*\)/, 'int main()');

  // 1. Arrow operator `->` (pointer struct/union member access)
  if (/->/.test(cleaned)) {
    return {
      valid: false,
      ruleViolated: 'c_pointer',
      error: 'MCA Policy Violation: Pointer arrow operator (`->`) is disabled. Pointers are not allowed in C submissions.',
    };
  }

  // 2. Dynamic memory allocation for pointers: malloc, calloc, realloc, free
  const allocMatch = cleaned.match(/\b(malloc|calloc|realloc|free)\s*\(/);
  if (allocMatch) {
    return {
      valid: false,
      ruleViolated: 'c_pointer',
      error: `MCA Policy Violation: Dynamic memory management function \`${allocMatch[1]}()\` is disabled. Pointers are not allowed.`,
    };
  }

  // 3. Pointer type casting, e.g., (int *), (char *), (void *)
  const castMatch = cleaned.match(/\(\s*(?:int|char|float|double|void|long|short|unsigned|signed|size_t|bool|struct\s+[A-Za-z_]\w*)\s*\*+\s*\)/);
  if (castMatch) {
    return {
      valid: false,
      ruleViolated: 'c_pointer',
      error: 'MCA Policy Violation: Pointer type casting is disabled. Pointers are not allowed in C submissions.',
    };
  }

  // 4. Pointer declarations, e.g. `int *p`, `char* s`, `void *ptr`, `int **arr`
  // Note: Matches a type followed by asterisk(s)
  const typePointerRegex = /\b(int|char|float|double|void|long|short|unsigned|signed|size_t|bool|FILE|struct\s+[A-Za-z_]\w*)\s*\*+/;
  const matchTypePtr = cleaned.match(typePointerRegex);
  if (matchTypePtr) {
    return {
      valid: false,
      ruleViolated: 'c_pointer',
      error: `MCA Policy Violation: Pointer declaration (\`${matchTypePtr[0].trim()}\`) is disabled. Pointers are not allowed. Please use standard value types and static arrays.`,
    };
  }

  // 5. Multiple pointer declarations after comma, e.g. `int a, *b;` or `int a, **b;`
  if (/,\s*\*+\s*[A-Za-z_]\w*/.test(cleaned)) {
    return {
      valid: false,
      ruleViolated: 'c_pointer',
      error: 'MCA Policy Violation: Pointer variable declaration is disabled. Please use standard value types and static arrays.',
    };
  }

  // 6. Pointer dereferencing `*ptr`
  // Check for unary asterisk (dereference).
  // In C expressions:
  // - Binary multiplication: preceded by an operand (identifier, number, closing paren `)`, closing bracket `]`)
  // - Compound assignment: `*=`
  // - Unary dereference: preceded by start of statement/line, `=`, `(`, `,`, `;`, `{`, `}`, `return`, `+`, `-`, `/`, `%`, `&`, `|`, `^`, `<`, `>`, `!`
  // We tokenize or test unary asterisks.
  const lines = cleaned.split('\n');
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    // Find all asterisks
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '*') {
        // Skip compound assignment: *=
        if (line[i + 1] === '=') {
          i++;
          continue;
        }

        // Look back at the last non-whitespace character before this asterisk
        let j = i - 1;
        while (j >= 0 && /\s/.test(line[j])) {
          j--;
        }

        // If at the very start of the line or no preceding char, it's unary dereference!
        if (j < 0) {
          // Check if followed by identifier or parenthesis or another asterisk
          if (/[A-Za-z_*(]/.test(line.slice(i + 1).trimStart())) {
            return {
              valid: false,
              ruleViolated: 'c_pointer',
              error: `MCA Policy Violation: Pointer dereferencing (\`${line.trim()}\`) is disabled. Pointers are not allowed in C submissions.`,
            };
          }
          continue;
        }

        const prevChar = line[j];

        // Characters that indicate binary multiplication:
        // [a-zA-Z0-9_] (identifier or number), ')', ']'
        const isBinaryOperand = /[A-Za-z0-9_)\]]/.test(prevChar);

        if (!isBinaryOperand) {
          // Preceded by punctuation like `=`, `(`, `,`, `;`, `{`, `}`, `+`, `-`, `/`, `%`, `<`, `>`, `!`, `&`, `|`, `^`, `return`
          // Verify if followed by identifier, `(`, or `*`
          const nextPart = line.slice(i + 1).trimStart();
          if (/^[A-Za-z_*(]/.test(nextPart)) {
            return {
              valid: false,
              ruleViolated: 'c_pointer',
              error: `MCA Policy Violation: Pointer dereferencing (\`${line.trim()}\`) is disabled. Pointers are not allowed in C submissions.`,
            };
          }
        }
      }
    }
  }

  return { valid: true };
}

/**
 * Universal validator called before running or submitting code.
 */
export function validateCodeRestrictions(code: string, langId: LangId): CodeValidationResult {
  if (langId === 'java') {
    return validateJavaRestrictions(code);
  }
  if (langId === 'c') {
    return validateCRestrictions(code);
  }
  return { valid: true };
}
