// Basic language syntax & method suggestions for MCA students (clean, non-extreme)

let registered = false;

export interface MethodSnippet {
  label: string;
  detail: string;
  snippet: string;
  category: 'I/O' | 'Math' | 'Array / String' | 'Control Flow';
}

export const LANGUAGE_QUICK_METHODS: Record<string, MethodSnippet[]> = {
  java: [
    { label: 'System.out.println', detail: 'Print line to console', snippet: 'System.out.println(${1:output});', category: 'I/O' },
    { label: 'System.out.print', detail: 'Print without newline', snippet: 'System.out.print(${1:output});', category: 'I/O' },
    { label: 'Scanner sc', detail: 'Create input Scanner', snippet: 'Scanner sc = new Scanner(System.in);', category: 'I/O' },
    { label: 'sc.nextInt()', detail: 'Read next integer', snippet: 'int ${1:n} = sc.nextInt();', category: 'I/O' },
    { label: 'sc.nextLine()', detail: 'Read next string line', snippet: 'String ${1:line} = sc.nextLine();', category: 'I/O' },
    { label: 'Arrays.sort()', detail: 'Sort an array in ascending order', snippet: 'Arrays.sort(${1:arr});', category: 'Array / String' },
    { label: 'str.length()', detail: 'String character count', snippet: '${1:str}.length()', category: 'Array / String' },
    { label: 'str.charAt(i)', detail: 'Character at index', snippet: '${1:str}.charAt(${2:i})', category: 'Array / String' },
    { label: 'Math.max(a, b)', detail: 'Maximum of two numbers', snippet: 'Math.max(${1:a}, ${2:b})', category: 'Math' },
    { label: 'Math.min(a, b)', detail: 'Minimum of two numbers', snippet: 'Math.min(${1:a}, ${2:b})', category: 'Math' },
    { label: 'Math.abs(n)', detail: 'Absolute value', snippet: 'Math.abs(${1:n})', category: 'Math' },
    { label: 'Math.pow(a, b)', detail: 'Power a^b', snippet: 'Math.pow(${1:base}, ${2:exp})', category: 'Math' },
    { label: 'for loop', detail: 'Standard indexed for loop', snippet: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3}\n}', category: 'Control Flow' },
    { label: 'enhanced for', detail: 'For-each item in array', snippet: 'for (${1:int} ${2:item} : ${3:arr}) {\n    ${4}\n}', category: 'Control Flow' },
  ],
  python: [
    { label: 'print(...)', detail: 'Print values to console', snippet: 'print(${1:value})', category: 'I/O' },
    { label: 'int(input())', detail: 'Read single integer', snippet: 'n = int(input().strip())', category: 'I/O' },
    { label: 'map(int, input().split())', detail: 'Read space-separated integers', snippet: 'arr = list(map(int, input().split()))', category: 'I/O' },
    { label: 'len(...)', detail: 'Length of list/string', snippet: 'len(${1:arr})', category: 'Array / String' },
    { label: 'list.append(...)', detail: 'Add element to end', snippet: '${1:arr}.append(${2:val})', category: 'Array / String' },
    { label: 'list.sort()', detail: 'Sort list in-place', snippet: '${1:arr}.sort()', category: 'Array / String' },
    { label: 'sorted(...)', detail: 'Return new sorted list', snippet: 'sorted(${1:arr})', category: 'Array / String' },
    { label: 'max(a, b)', detail: 'Maximum value', snippet: 'max(${1:arr})', category: 'Math' },
    { label: 'min(a, b)', detail: 'Minimum value', snippet: 'min(${1:arr})', category: 'Math' },
    { label: 'sum(...)', detail: 'Sum of iterable elements', snippet: 'sum(${1:arr})', category: 'Math' },
    { label: 'abs(...)', detail: 'Absolute value', snippet: 'abs(${1:n})', category: 'Math' },
    { label: 'for i in range(n)', detail: 'Loop 0 to n-1', snippet: 'for ${1:i} in range(${2:n}):\n    ${3:pass}', category: 'Control Flow' },
    { label: 'for item in arr', detail: 'Iterate over collection', snippet: 'for ${1:item} in ${2:arr}:\n    ${3:pass}', category: 'Control Flow' },
    { label: 'def func():', detail: 'Define helper function', snippet: 'def ${1:solve}(${2:args}):\n    ${3:return None}', category: 'Control Flow' },
  ],
  c: [
    { label: 'printf', detail: 'Formatted print', snippet: 'printf("${1:%d}\\n", ${2:val});', category: 'I/O' },
    { label: 'scanf', detail: 'Formatted read', snippet: 'scanf("${1:%d}", &${2:val});', category: 'I/O' },
    { label: 'strlen', detail: 'Length of C string', snippet: 'strlen(${1:str})', category: 'Array / String' },
    { label: 'strcmp', detail: 'Compare two strings', snippet: 'strcmp(${1:s1}, ${2:s2})', category: 'Array / String' },
    { label: 'abs', detail: 'Integer absolute value', snippet: 'abs(${1:n})', category: 'Math' },
    { label: 'for loop', detail: 'Standard for loop', snippet: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3}\n}', category: 'Control Flow' },
    { label: 'while loop', detail: 'Standard while loop', snippet: 'while (${1:condition}) {\n    ${2}\n}', category: 'Control Flow' },
  ],
  javascript: [
    { label: 'console.log', detail: 'Print to standard output', snippet: 'console.log(${1:output});', category: 'I/O' },
    { label: 'parseInt', detail: 'Parse string to integer', snippet: 'parseInt(${1:val}, 10)', category: 'Math' },
    { label: 'Math.max', detail: 'Maximum value', snippet: 'Math.max(${1:a}, ${2:b})', category: 'Math' },
    { label: 'Math.min', detail: 'Minimum value', snippet: 'Math.min(${1:a}, ${2:b})', category: 'Math' },
    { label: 'Math.abs', detail: 'Absolute value', snippet: 'Math.abs(${1:n})', category: 'Math' },
    { label: 'arr.push', detail: 'Append element', snippet: '${1:arr}.push(${2:item});', category: 'Array / String' },
    { label: 'arr.map', detail: 'Transform array', snippet: '${1:arr}.map(${2:x} => ${3:x})', category: 'Array / String' },
    { label: 'arr.filter', detail: 'Filter array', snippet: '${1:arr}.filter(${2:x} => ${3:condition})', category: 'Array / String' },
    { label: 'arr.length', detail: 'Array item count', snippet: '${1:arr}.length', category: 'Array / String' },
    { label: 'for loop', detail: 'Standard index loop', snippet: 'for (let ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3}\n}', category: 'Control Flow' },
  ],
};

// Register completion items inside Monaco Editor
export function registerBasicSuggestions(monaco: any) {
  if (registered || !monaco || !monaco.languages) return;
  registered = true;

  const languages = ['java', 'python', 'c', 'javascript'];

  languages.forEach(lang => {
    const methods = LANGUAGE_QUICK_METHODS[lang] || [];
    monaco.languages.registerCompletionItemProvider(lang, {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions = methods.map(m => ({
          label: m.label,
          kind: monaco.languages.CompletionItemKind.Method,
          detail: `[Student Hint] ${m.detail}`,
          documentation: `Basic syntax for MCA students: ${m.label}`,
          insertText: m.snippet.replace(/\$\{\d+:?([^}]*)\}/g, '$1'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        }));

        return { suggestions };
      },
    });
  });
}
