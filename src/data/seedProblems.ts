// Seed data — 10 real MCA placement problems
import type { Problem } from '../pages/ProblemsPage';

type SeedProblem = Omit<Problem, 'id' | 'createdAt' | 'solvedCount' | 'likes' | 'dislikes' | 'addedBy'>;

export const SEED_PROBLEMS: SeedProblem[] = [
  {
    title: "Two Sum",
    difficulty: "easy",
    category: "Arrays",
    tags: ["array", "hashmap", "placement-favorite"],
    description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice.",
    inputFormat: "First line contains N (size of array) and target T.\nSecond line contains N space-separated integers.",
    outputFormat: "Print two space-separated indices (0-based) of the two numbers that add up to target.",
    constraints: "2 ≤ N ≤ 10^4\n-10^9 ≤ nums[i] ≤ 10^9\n-10^9 ≤ target ≤ 10^9\nExactly one valid answer exists.",
    examples: [
      { input: "4 9\n2 7 11 15", output: "0 1", explanation: "nums[0] + nums[1] = 2 + 7 = 9, so return indices 0 and 1." },
      { input: "3 6\n3 2 4", output: "1 2", explanation: "nums[1] + nums[2] = 2 + 4 = 6." }
    ],
    testCases: [
      { input: "4 9\n2 7 11 15", expectedOutput: "0 1" },
      { input: "3 6\n3 2 4", expectedOutput: "1 2" },
      { input: "2 6\n3 3", expectedOutput: "0 1" },
    ],
    starterCode: {
      java: `import java.util.*;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt(), target = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        // Your solution here
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < n; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                System.out.println(map.get(complement) + " " + i);
                return;
            }
            map.put(nums[i], i);
        }
    }
}`,
      c: `#include <stdio.h>
#include <stdlib.h>
int main() {
    int n, target;
    scanf("%d %d", &n, &target);
    int nums[n];
    for (int i = 0; i < n; i++) scanf("%d", &nums[i]);
    // Your solution here
    for (int i = 0; i < n; i++)
        for (int j = i+1; j < n; j++)
            if (nums[i] + nums[j] == target) {
                printf("%d %d\\n", i, j);
                return 0;
            }
    return 0;
}`,
      python: `n, target = map(int, input().split())
nums = list(map(int, input().split()))
# Your solution here
seen = {}
for i, num in enumerate(nums):
    complement = target - num
    if complement in seen:
        print(seen[complement], i)
        break
    seen[num] = i`,
      javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').split('\\n');
const [n, target] = lines[0].split(' ').map(Number);
const nums = lines[1].split(' ').map(Number);
// Your solution here
const map = new Map();
for (let i = 0; i < nums.length; i++) {
  const comp = target - nums[i];
  if (map.has(comp)) { console.log(map.get(comp), i); break; }
  map.set(nums[i], i);
}`
    }
  },
  {
    title: "Reverse a String",
    difficulty: "easy",
    category: "Strings",
    tags: ["string", "basic", "beginner"],
    description: "Given a string S, print it in reverse order. Do not use any built-in reverse functions — implement it manually.",
    inputFormat: "Single line containing the string S.",
    outputFormat: "Print the reversed string.",
    constraints: "1 ≤ |S| ≤ 10^5\nString contains only printable ASCII characters.",
    examples: [
      { input: "hello", output: "olleh", explanation: "Reading from right to left gives 'olleh'." },
      { input: "MCA2025", output: "5202ACM" }
    ],
    testCases: [
      { input: "hello", expectedOutput: "olleh" },
      { input: "MCA2025", expectedOutput: "5202ACM" },
      { input: "abcde", expectedOutput: "edcba" },
    ],
    starterCode: {
      java: `import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.nextLine();
        // Reverse manually without built-in reverse
        char[] arr = s.toCharArray();
        int l = 0, r = arr.length - 1;
        while (l < r) {
            char temp = arr[l]; arr[l] = arr[r]; arr[r] = temp;
            l++; r--;
        }
        System.out.println(new String(arr));
    }
}`,
      c: `#include <stdio.h>
#include <string.h>
int main() {
    char s[100001];
    scanf("%s", s);
    int n = strlen(s);
    for (int i = 0; i < n/2; i++) {
        char tmp = s[i]; s[i] = s[n-1-i]; s[n-1-i] = tmp;
    }
    printf("%s\\n", s);
    return 0;
}`,
      python: `s = input()
# Reverse manually
result = ''
for i in range(len(s)-1, -1, -1):
    result += s[i]
print(result)`,
      javascript: `const s = require('fs').readFileSync('/dev/stdin','utf8').trim();
let result = '';
for (let i = s.length - 1; i >= 0; i--) result += s[i];
console.log(result);`
    }
  },
  {
    title: "Fibonacci Series",
    difficulty: "easy",
    category: "Math",
    tags: ["math", "recursion", "dp", "placement-favorite"],
    description: "Print the first N numbers of the Fibonacci sequence. The Fibonacci sequence starts with 0 and 1, and each subsequent number is the sum of the two preceding ones: 0, 1, 1, 2, 3, 5, 8, 13, ...",
    inputFormat: "A single integer N.",
    outputFormat: "Print N space-separated Fibonacci numbers.",
    constraints: "1 ≤ N ≤ 50",
    examples: [
      { input: "7", output: "0 1 1 2 3 5 8", explanation: "First 7 Fibonacci numbers." },
      { input: "1", output: "0" }
    ],
    testCases: [
      { input: "7", expectedOutput: "0 1 1 2 3 5 8" },
      { input: "1", expectedOutput: "0" },
      { input: "10", expectedOutput: "0 1 1 2 3 5 8 13 21 34" },
    ],
    starterCode: {
      java: `import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        long a = 0, b = 1;
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < n; i++) {
            sb.append(a);
            if (i < n - 1) sb.append(" ");
            long next = a + b; a = b; b = next;
        }
        System.out.println(sb);
    }
}`,
      c: `#include <stdio.h>
int main() {
    int n; scanf("%d", &n);
    long long a = 0, b = 1;
    for (int i = 0; i < n; i++) {
        printf("%lld", a);
        if (i < n-1) printf(" ");
        long long next = a + b; a = b; b = next;
    }
    printf("\\n");
    return 0;
}`,
      python: `n = int(input())
a, b = 0, 1
result = []
for _ in range(n):
    result.append(a)
    a, b = b, a + b
print(*result)`,
      javascript: `const n = parseInt(require('fs').readFileSync('/dev/stdin','utf8').trim());
let a = 0n, b = 1n, res = [];
for (let i = 0; i < n; i++) { res.push(String(a)); [a, b] = [b, a+b]; }
console.log(res.join(' '));`
    }
  },
  {
    title: "Check Palindrome",
    difficulty: "easy",
    category: "Strings",
    tags: ["string", "two-pointer", "palindrome"],
    description: "Given a string S, determine if it is a palindrome. A palindrome reads the same forwards and backwards. Consider only alphanumeric characters and ignore cases.",
    inputFormat: "A single string S.",
    outputFormat: "Print YES if it is a palindrome, NO otherwise.",
    constraints: "1 ≤ |S| ≤ 10^5",
    examples: [
      { input: "racecar", output: "YES", explanation: "'racecar' reads the same forwards and backwards." },
      { input: "hello", output: "NO" },
      { input: "A man a plan a canal Panama", output: "YES" }
    ],
    testCases: [
      { input: "racecar", expectedOutput: "YES" },
      { input: "hello", expectedOutput: "NO" },
      { input: "madam", expectedOutput: "YES" },
    ],
    starterCode: {
      java: `import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.nextLine().toLowerCase().replaceAll("[^a-z0-9]", "");
        int l = 0, r = s.length() - 1;
        boolean isPalin = true;
        while (l < r) {
            if (s.charAt(l) != s.charAt(r)) { isPalin = false; break; }
            l++; r--;
        }
        System.out.println(isPalin ? "YES" : "NO");
    }
}`,
      c: `#include <stdio.h>
#include <string.h>
#include <ctype.h>
int main() {
    char s[100001]; fgets(s, sizeof(s), stdin);
    int n = strlen(s);
    if (s[n-1]=='\\n') s[--n]=0;
    for(int i=0;i<n;i++) s[i]=tolower(s[i]);
    int l=0, r=n-1;
    while(l<r && s[l]==s[r]) { l++; r--; }
    printf("%s\\n", l>=r ? "YES" : "NO");
    return 0;
}`,
      python: `s = input().lower()
s = ''.join(c for c in s if c.isalnum())
print("YES" if s == s[::-1] else "NO")`,
      javascript: `const s = require('fs').readFileSync('/dev/stdin','utf8').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
console.log(s === s.split('').reverse().join('') ? 'YES' : 'NO');`
    }
  },
  {
    title: "Find Maximum Subarray Sum",
    difficulty: "medium",
    category: "Dynamic Programming",
    tags: ["dp", "kadane", "array", "placement-favorite"],
    description: "Given an integer array nums, find the contiguous subarray (containing at least one number) which has the largest sum and return its sum. This is the famous Kadane's Algorithm problem — asked in almost every placement!",
    inputFormat: "First line: N (size of array)\nSecond line: N space-separated integers.",
    outputFormat: "Print a single integer — the maximum subarray sum.",
    constraints: "1 ≤ N ≤ 10^5\n-10^4 ≤ nums[i] ≤ 10^4",
    examples: [
      { input: "9\n-2 1 -3 4 -1 2 1 -5 4", output: "6", explanation: "Subarray [4,-1,2,1] has the largest sum = 6." },
      { input: "1\n1", output: "1" }
    ],
    testCases: [
      { input: "9\n-2 1 -3 4 -1 2 1 -5 4", expectedOutput: "6" },
      { input: "1\n1", expectedOutput: "1" },
      { input: "4\n-2 -1 -3 -4", expectedOutput: "-1" },
    ],
    starterCode: {
      java: `import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        // Kadane's Algorithm
        int maxSum = nums[0], currentSum = nums[0];
        for (int i = 1; i < n; i++) {
            currentSum = Math.max(nums[i], currentSum + nums[i]);
            maxSum = Math.max(maxSum, currentSum);
        }
        System.out.println(maxSum);
    }
}`,
      c: `#include <stdio.h>
int main() {
    int n; scanf("%d", &n);
    int nums[n];
    for (int i = 0; i < n; i++) scanf("%d", &nums[i]);
    int maxSum = nums[0], cur = nums[0];
    for (int i = 1; i < n; i++) {
        cur = nums[i] > cur + nums[i] ? nums[i] : cur + nums[i];
        if (cur > maxSum) maxSum = cur;
    }
    printf("%d\\n", maxSum);
    return 0;
}`,
      python: `n = int(input())
nums = list(map(int, input().split()))
max_sum = cur = nums[0]
for x in nums[1:]:
    cur = max(x, cur + x)
    max_sum = max(max_sum, cur)
print(max_sum)`,
      javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').split('\\n');
const nums = lines[1].split(' ').map(Number);
let [max, cur] = [nums[0], nums[0]];
for (let i = 1; i < nums.length; i++) {
  cur = Math.max(nums[i], cur + nums[i]);
  max = Math.max(max, cur);
}
console.log(max);`
    }
  },
  {
    title: "Binary Search",
    difficulty: "easy",
    category: "Binary Search",
    tags: ["binary-search", "array", "sorted"],
    description: "Given a sorted array of N integers and a target value T, implement binary search to find the index of T in the array. If the element is not found, print -1.",
    inputFormat: "First line: N and T\nSecond line: N sorted space-separated integers.",
    outputFormat: "Print the 0-based index of T, or -1 if not found.",
    constraints: "1 ≤ N ≤ 10^6\n-10^9 ≤ nums[i], T ≤ 10^9",
    examples: [
      { input: "7 9\n1 3 5 7 9 11 13", output: "4", explanation: "9 is at index 4 (0-based)." },
      { input: "5 6\n1 2 3 4 5", output: "-1" }
    ],
    testCases: [
      { input: "7 9\n1 3 5 7 9 11 13", expectedOutput: "4" },
      { input: "5 6\n1 2 3 4 5", expectedOutput: "-1" },
      { input: "1 5\n5", expectedOutput: "0" },
    ],
    starterCode: {
      java: `import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt(), target = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        int lo = 0, hi = n - 1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            if (nums[mid] == target) { System.out.println(mid); return; }
            else if (nums[mid] < target) lo = mid + 1;
            else hi = mid - 1;
        }
        System.out.println(-1);
    }
}`,
      c: `#include <stdio.h>
int main() {
    int n, target; scanf("%d %d", &n, &target);
    int nums[n];
    for (int i = 0; i < n; i++) scanf("%d", &nums[i]);
    int lo = 0, hi = n-1;
    while (lo <= hi) {
        int mid = lo + (hi-lo)/2;
        if (nums[mid] == target) { printf("%d\\n", mid); return 0; }
        else if (nums[mid] < target) lo = mid+1;
        else hi = mid-1;
    }
    printf("-1\\n");
    return 0;
}`,
      python: `n, target = map(int, input().split())
nums = list(map(int, input().split()))
lo, hi = 0, n - 1
result = -1
while lo <= hi:
    mid = (lo + hi) // 2
    if nums[mid] == target:
        result = mid; break
    elif nums[mid] < target:
        lo = mid + 1
    else:
        hi = mid - 1
print(result)`,
      javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').split('\\n');
const [n, target] = lines[0].split(' ').map(Number);
const nums = lines[1].split(' ').map(Number);
let lo = 0, hi = n - 1;
while (lo <= hi) {
  const mid = (lo + hi) >> 1;
  if (nums[mid] === target) { console.log(mid); process.exit(); }
  else if (nums[mid] < target) lo = mid + 1;
  else hi = mid - 1;
}
console.log(-1);`
    }
  },
  {
    title: "Count Occurrences",
    difficulty: "easy",
    category: "Hashing",
    tags: ["hashmap", "frequency", "string"],
    description: "Given a string, count the frequency of each character and print them in alphabetical order. Only print characters that appear at least once.",
    inputFormat: "A single string S (no spaces).",
    outputFormat: "Print each character and its count on a separate line in format: char count",
    constraints: "1 ≤ |S| ≤ 10^5\nString contains only lowercase English letters.",
    examples: [
      { input: "banana", output: "a 3\nb 1\nn 2", explanation: "'a' appears 3 times, 'b' once, 'n' twice." },
    ],
    testCases: [
      { input: "banana", expectedOutput: "a 3\nb 1\nn 2" },
      { input: "hello", expectedOutput: "e 1\nh 1\nl 2\no 1" },
      { input: "aaa", expectedOutput: "a 3" },
    ],
    starterCode: {
      java: `import java.util.*;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.nextLine();
        Map<Character, Integer> freq = new TreeMap<>();
        for (char c : s.toCharArray())
            freq.put(c, freq.getOrDefault(c, 0) + 1);
        for (Map.Entry<Character, Integer> e : freq.entrySet())
            System.out.println(e.getKey() + " " + e.getValue());
    }
}`,
      c: `#include <stdio.h>
#include <string.h>
int main() {
    char s[100001]; scanf("%s", s);
    int freq[26] = {0};
    for (int i = 0; s[i]; i++) freq[s[i]-'a']++;
    for (int i = 0; i < 26; i++)
        if (freq[i]) printf("%c %d\\n", 'a'+i, freq[i]);
    return 0;
}`,
      python: `from collections import Counter
s = input()
freq = Counter(s)
for ch in sorted(freq):
    print(ch, freq[ch])`,
      javascript: `const s = require('fs').readFileSync('/dev/stdin','utf8').trim();
const freq = {};
for (const c of s) freq[c] = (freq[c]||0)+1;
Object.keys(freq).sort().forEach(c => console.log(c, freq[c]));`
    }
  },
  {
    title: "Linked List Reversal",
    difficulty: "medium",
    category: "Linked List",
    tags: ["linked-list", "pointer", "classic"],
    description: "Given N numbers representing a linked list, reverse it and print the reversed list. This is one of the most asked interview questions in MCA placements!",
    inputFormat: "First line: N\nSecond line: N space-separated integers.",
    outputFormat: "Print the reversed list space-separated.",
    constraints: "1 ≤ N ≤ 10^4\n-10^9 ≤ val ≤ 10^9",
    examples: [
      { input: "5\n1 2 3 4 5", output: "5 4 3 2 1" },
      { input: "3\n10 20 30", output: "30 20 10" }
    ],
    testCases: [
      { input: "5\n1 2 3 4 5", expectedOutput: "5 4 3 2 1" },
      { input: "3\n10 20 30", expectedOutput: "30 20 10" },
      { input: "1\n42", expectedOutput: "42" },
    ],
    starterCode: {
      java: `import java.util.*;
public class Main {
    static class Node { int val; Node next; Node(int v){val=v;} }
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        Node head = null, tail = null;
        for (int i = 0; i < n; i++) {
            Node node = new Node(sc.nextInt());
            if (head == null) { head = tail = node; }
            else { tail.next = node; tail = node; }
        }
        // Reverse
        Node prev = null, curr = head;
        while (curr != null) {
            Node next = curr.next; curr.next = prev; prev = curr; curr = next;
        }
        head = prev;
        StringBuilder sb = new StringBuilder();
        while (head != null) { sb.append(head.val); if(head.next!=null) sb.append(" "); head=head.next; }
        System.out.println(sb);
    }
}`,
      c: `#include <stdio.h>
int main() {
    int n; scanf("%d", &n);
    int arr[n];
    for (int i = 0; i < n; i++) scanf("%d", &arr[i]);
    for (int i = n-1; i >= 0; i--) {
        printf("%d", arr[i]);
        if (i > 0) printf(" ");
    }
    printf("\\n");
    return 0;
}`,
      python: `n = int(input())
arr = list(map(int, input().split()))
print(*arr[::-1])`,
      javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').split('\\n');
const arr = lines[1].split(' ').map(Number);
console.log(arr.reverse().join(' '));`
    }
  },
  {
    title: "Prime Numbers Sieve",
    difficulty: "medium",
    category: "Math",
    tags: ["math", "sieve", "prime", "number-theory"],
    description: "Given a number N, print all prime numbers up to N (inclusive) using the Sieve of Eratosthenes algorithm. This efficient algorithm is a must-know for competitive programming!",
    inputFormat: "A single integer N.",
    outputFormat: "Print all prime numbers up to N, space-separated.",
    constraints: "2 ≤ N ≤ 10^6",
    examples: [
      { input: "20", output: "2 3 5 7 11 13 17 19" },
      { input: "10", output: "2 3 5 7" }
    ],
    testCases: [
      { input: "20", expectedOutput: "2 3 5 7 11 13 17 19" },
      { input: "10", expectedOutput: "2 3 5 7" },
      { input: "2", expectedOutput: "2" },
    ],
    starterCode: {
      java: `import java.util.*;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        boolean[] sieve = new boolean[n + 1];
        Arrays.fill(sieve, true);
        sieve[0] = sieve[1] = false;
        for (int i = 2; i * i <= n; i++)
            if (sieve[i])
                for (int j = i*i; j <= n; j += i) sieve[j] = false;
        StringBuilder sb = new StringBuilder();
        for (int i = 2; i <= n; i++) if (sieve[i]) { if(sb.length()>0)sb.append(" "); sb.append(i); }
        System.out.println(sb);
    }
}`,
      c: `#include <stdio.h>
#include <string.h>
int main() {
    int n; scanf("%d", &n);
    char sieve[n+1]; memset(sieve, 1, sizeof(sieve));
    sieve[0]=sieve[1]=0;
    for (int i=2; (long long)i*i<=n; i++)
        if (sieve[i]) for (int j=i*i; j<=n; j+=i) sieve[j]=0;
    int first=1;
    for (int i=2; i<=n; i++) if(sieve[i]){ if(!first)printf(" "); printf("%d",i); first=0; }
    printf("\\n");
    return 0;
}`,
      python: `n = int(input())
sieve = [True] * (n + 1)
sieve[0] = sieve[1] = False
for i in range(2, int(n**0.5) + 1):
    if sieve[i]:
        for j in range(i*i, n+1, i):
            sieve[j] = False
print(*[i for i in range(2, n+1) if sieve[i]])`,
      javascript: `const n = parseInt(require('fs').readFileSync('/dev/stdin','utf8').trim());
const sieve = new Uint8Array(n+1).fill(1);
sieve[0]=sieve[1]=0;
for(let i=2;i*i<=n;i++) if(sieve[i]) for(let j=i*i;j<=n;j+=i) sieve[j]=0;
console.log(Array.from({length:n-1},(_,i)=>i+2).filter(i=>sieve[i]).join(' '));`
    }
  },
  {
    title: "Stack Using Array",
    difficulty: "medium",
    category: "Stack/Queue",
    tags: ["stack", "data-structure", "implementation"],
    description: "Implement a stack using an array and process Q operations:\n- PUSH X: Push integer X onto stack\n- POP: Pop top element and print it (print 'EMPTY' if stack is empty)\n- TOP: Print top element without removing (print 'EMPTY' if empty)\n- SIZE: Print current size of stack",
    inputFormat: "First line: Q (number of operations)\nNext Q lines: one operation each.",
    outputFormat: "Print output for POP, TOP, SIZE operations.",
    constraints: "1 ≤ Q ≤ 10^5\n-10^9 ≤ X ≤ 10^9",
    examples: [
      { input: "6\nPUSH 5\nPUSH 10\nTOP\nPOP\nSIZE\nPOP", output: "10\n10\n1\n5" },
    ],
    testCases: [
      { input: "6\nPUSH 5\nPUSH 10\nTOP\nPOP\nSIZE\nPOP", expectedOutput: "10\n10\n1\n5" },
      { input: "3\nPOP\nPUSH 1\nSIZE", expectedOutput: "EMPTY\n1" },
    ],
    starterCode: {
      java: `import java.util.*;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int q = sc.nextInt(); sc.nextLine();
        Deque<Integer> stack = new ArrayDeque<>();
        StringBuilder sb = new StringBuilder();
        while (q-- > 0) {
            String line = sc.nextLine().trim();
            if (line.startsWith("PUSH")) { stack.push(Integer.parseInt(line.split(" ")[1])); }
            else if (line.equals("POP")) { sb.append(stack.isEmpty() ? "EMPTY" : stack.pop()).append("\\n"); }
            else if (line.equals("TOP")) { sb.append(stack.isEmpty() ? "EMPTY" : stack.peek()).append("\\n"); }
            else if (line.equals("SIZE")) { sb.append(stack.size()).append("\\n"); }
        }
        System.out.print(sb);
    }
}`,
      c: `#include <stdio.h>
int stack[100001], top = -1;
int main() {
    int q; scanf("%d\\n", &q);
    while (q--) {
        char op[10]; scanf("%s", op);
        if (op[0]=='P' && op[1]=='U') { int x; scanf("%d", &x); stack[++top]=x; }
        else if (op[0]=='P') { printf("%s\\n", top<0?"EMPTY":""); if(top>=0) printf("%d\\n",stack[top--]); }
        else if (op[0]=='T') { printf("%s\\n", top<0?"EMPTY":""); if(top>=0) printf("%d\\n",stack[top]); }
        else { printf("%d\\n", top+1); }
        scanf("\\n");
    }
    return 0;
}`,
      python: `import sys
input = sys.stdin.readline
q = int(input())
stack = []
for _ in range(q):
    op = input().split()
    if op[0] == 'PUSH': stack.append(int(op[1]))
    elif op[0] == 'POP': print(stack.pop() if stack else 'EMPTY')
    elif op[0] == 'TOP': print(stack[-1] if stack else 'EMPTY')
    elif op[0] == 'SIZE': print(len(stack))`,
      javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').split('\\n');
const q = parseInt(lines[0]);
const stack = [], out = [];
for (let i = 1; i <= q; i++) {
  const parts = lines[i].trim().split(' ');
  if (parts[0]==='PUSH') stack.push(+parts[1]);
  else if (parts[0]==='POP') out.push(stack.length ? stack.pop() : 'EMPTY');
  else if (parts[0]==='TOP') out.push(stack.length ? stack[stack.length-1] : 'EMPTY');
  else if (parts[0]==='SIZE') out.push(stack.length);
}
console.log(out.join('\\n'));`
    }
  },
];
