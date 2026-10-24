import initSqlJs, { type Database, type QueryExecResult } from 'sql.js';

export interface TableDef {
  name: string;
  columns: string | string[];
  rows: string | any[];
}

export interface SqlQueryResult {
  success: boolean;
  columns: string[];
  values: any[][];
  error?: string;
  executionTimeMs: number;
  engine?: 'sqlite-wasm' | 'javascript-relational';
}

/**
 * Safely parse column names from string, array, or object
 */
export function parseColumns(cols: any): string[] {
  if (Array.isArray(cols)) {
    return cols.map(c => String(c).trim()).filter(Boolean);
  }
  if (typeof cols === 'string') {
    return cols.split(',').map(c => c.trim()).filter(Boolean);
  }
  if (typeof cols === 'object' && cols !== null) {
    return Object.keys(cols).map(c => String(c).trim()).filter(Boolean);
  }
  return [];
}

/**
 * Safely parse rows from string, array of strings, or array of objects/arrays
 */
export function parseRows(rows: any): string[] {
  if (Array.isArray(rows)) {
    return rows.map(r => {
      if (Array.isArray(r)) return r.map(c => String(c ?? '')).join(', ');
      if (typeof r === 'object' && r !== null) return Object.values(r).map(c => String(c ?? '')).join(', ');
      return String(r ?? '').trim();
    }).filter(Boolean);
  }
  if (typeof rows === 'string') {
    return rows.split('\n').map(r => r.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Safely parse row cells from string or array
 */
export function parseRowCells(row: any): string[] {
  if (row === null || row === undefined) return [];
  if (Array.isArray(row)) return row.map(c => String(c ?? '').trim());
  return String(row).split(',').map(c => c.trim());
}

/**
 * Normalized representation of a table definition
 */
export function parseTableDef(t: TableDef): { name: string; columns: string[]; rows: any[][] } {
  const name = (t.name || '').trim().replace(/[^a-zA-Z0-9_]/g, '') || 'Table1';
  const columns = parseColumns(t.columns);
  const rawRows = parseRows(t.rows);

  const rows: any[][] = [];
  for (const raw of rawRows) {
    const cells = parseRowCells(raw);
    const parsedRow = columns.map((_, i) => {
      const v = cells[i];
      if (v === undefined || v === null) return null;
      const s = String(v).trim().replace(/^["']|["']$/g, '');
      if (s === '' || s.toUpperCase() === 'NULL') return null;
      if (!isNaN(Number(s)) && !isNaN(parseFloat(s))) {
        return Number(s);
      }
      return s;
    });
    rows.push(parsedRow);
  }

  return { name, columns, rows };
}

// ─── SQL.JS WASM LOADER ───────────────────────────────────────────────────────
let sqlInstancePromise: Promise<any> | null = null;

async function getSqlInstance(): Promise<any> {
  if (sqlInstancePromise) return sqlInstancePromise;

  const initCandidates = [
    typeof initSqlJs === 'function' ? initSqlJs : null,
    (initSqlJs as any)?.default,
    typeof window !== 'undefined' ? (window as any).initSqlJs : null,
  ].filter(Boolean);

  if (initCandidates.length === 0) {
    return null;
  }

  const initFn = initCandidates[0];

  sqlInstancePromise = (async () => {
    // 1. Try local public directory wasm assets first (instant offline & fast)
    try {
      const inst = await initFn({
        locateFile: (file: string) => {
          if (file.endsWith('.wasm')) return `/${file}`;
          return file;
        },
      });
      if (inst && inst.Database) return inst;
    } catch (e) {
      console.warn('Local wasm load note:', e);
    }

    // 2. Try official jsdelivr CDN v1.15.1
    try {
      const inst = await initFn({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/sql.js@1.15.1/dist/${file}`,
      });
      if (inst && inst.Database) return inst;
    } catch (e) {
      console.warn('CDN wasm load note:', e);
    }

    // 3. Try unpkg CDN v1.15.1
    try {
      const inst = await initFn({
        locateFile: (file: string) => `https://unpkg.com/sql.js@1.15.1/dist/${file}`,
      });
      if (inst && inst.Database) return inst;
    } catch (e) {
      console.warn('Unpkg wasm load note:', e);
    }

    return null;
  })().catch(err => {
    sqlInstancePromise = null;
    console.warn('All sql.js wasm attempts failed:', err);
    return null;
  });

  return sqlInstancePromise;
}

// ─── RUN WITH SQL.JS WASM ─────────────────────────────────────────────────────
async function runWithSqlJs(
  sqlQuery: string,
  tableData?: TableDef[],
  schemaSql?: string
): Promise<SqlQueryResult | null> {
  const startTime = performance.now();
  try {
    const SQL = await getSqlInstance();
    if (!SQL) return null;

    const db: Database = new SQL.Database();
    try {
      // 1. Schema DDL if provided
      if (schemaSql && schemaSql.trim()) {
        try {
          db.run(schemaSql);
        } catch (e: any) {
          console.warn('Schema DDL note:', e?.message);
        }
      }

      // 2. Build tables from tableData
      if (tableData && tableData.length > 0) {
        for (const t of tableData) {
          const { name, columns, rows } = parseTableDef(t);
          if (columns.length === 0) continue;

          // Create table without rigid types so SQLite type affinity works dynamically
          const colDefs = columns.map(c => `"${c.replace(/"/g, '')}"`).join(', ');
          db.run(`CREATE TABLE IF NOT EXISTS "${name}" (${colDefs});`);

          const placeholders = columns.map(() => '?').join(', ');
          const insertStmt = `INSERT INTO "${name}" VALUES (${placeholders});`;
          for (const row of rows) {
            db.run(insertStmt, row);
          }
        }
      }

      // 3. Clean and execute query
      const cleanSql = sqlQuery
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();

      if (!cleanSql) {
        return {
          success: true,
          columns: [],
          values: [],
          executionTimeMs: Math.round(performance.now() - startTime),
          engine: 'sqlite-wasm',
        };
      }

      const results: QueryExecResult[] = db.exec(cleanSql);
      const executionTimeMs = Math.round(performance.now() - startTime);

      let activeResult: QueryExecResult | null = null;
      if (results && results.length > 0) {
        for (let i = results.length - 1; i >= 0; i--) {
          if (results[i].columns && results[i].columns.length > 0) {
            activeResult = results[i];
            break;
          }
        }
        if (!activeResult) activeResult = results[0];
      }

      return {
        success: true,
        columns: activeResult?.columns || [],
        values: activeResult?.values || [],
        executionTimeMs,
        engine: 'sqlite-wasm',
      };
    } finally {
      try {
        db.close();
      } catch {}
    }
  } catch (err: any) {
    const msg = err?.message || String(err);
    // If it's a genuine SQL syntax or table error from SQLite, return it directly so student sees feedback!
    if (
      msg.includes('syntax error') ||
      msg.includes('no such table') ||
      msg.includes('no such column') ||
      msg.includes('misuse of') ||
      msg.includes('ambiguous')
    ) {
      return {
        success: false,
        columns: [],
        values: [],
        error: msg,
        executionTimeMs: Math.round(performance.now() - startTime),
        engine: 'sqlite-wasm',
      };
    }
    // Otherwise wasm loader issue, fallback to JS relational engine
    return null;
  }
}

// ─── PURE JAVASCRIPT RELATIONAL SQL ENGINE (SYNC & ASYNC FALLBACK) ────────────
export function runWithJsEngine(
  sqlQuery: string,
  tableData?: TableDef[]
): SqlQueryResult {
  const startTime = performance.now();

  // Clean query
  const cleanSql = sqlQuery
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim()
    .replace(/;+$/, '');

  if (!cleanSql) {
    return {
      success: true,
      columns: [],
      values: [],
      executionTimeMs: Math.round(performance.now() - startTime),
      engine: 'javascript-relational',
    };
  }

  // Load tables into an in-memory dictionary
  const dbTables: Record<string, { columns: string[]; rows: Record<string, any>[] }> = {};
  if (tableData && tableData.length > 0) {
    for (const t of tableData) {
      const { name, columns, rows } = parseTableDef(t);
      if (!name || columns.length === 0) continue;

      const records: Record<string, any>[] = rows.map(r => {
        const obj: Record<string, any> = {};
        columns.forEach((col, idx) => {
          obj[col.toLowerCase()] = r[idx];
          obj[col] = r[idx];
        });
        return obj;
      });

      dbTables[name.toLowerCase()] = { columns, rows: records };
    }
  }

  // Match basic SELECT structure
  const selectMatch = cleanSql.match(/^SELECT\s+([\s\S]+?)\s+FROM\s+([a-zA-Z0-9_]+)([\s\S]*)$/i);
  if (!selectMatch) {
    // If not a standard SELECT, or simple DDL
    if (/^(INSERT|UPDATE|DELETE|CREATE|DROP)/i.test(cleanSql)) {
      return {
        success: true,
        columns: ['Status'],
        values: [['Command executed successfully']],
        executionTimeMs: Math.round(performance.now() - startTime),
        engine: 'javascript-relational',
      };
    }
    throw new Error('Unsupported or invalid SQL query syntax: ' + cleanSql.slice(0, 40));
  }

  const rawColumnsClause = selectMatch[1].trim();
  const mainTableName = selectMatch[2].trim().toLowerCase();
  const restClause = selectMatch[3].trim();

  const tableObj = dbTables[mainTableName];
  if (!tableObj) {
    throw new Error(`no such table: ${selectMatch[2].trim()}`);
  }

  let workingRows: Record<string, any>[] = tableObj.rows.map(r => ({ ...r }));

  // Check for JOIN clauses
  const joinMatch = restClause.match(/\b(LEFT\s+JOIN|INNER\s+JOIN|JOIN)\s+([a-zA-Z0-9_]+)\s+ON\s+([a-zA-Z0-9_.]+)\s*=\s*([a-zA-Z0-9_.]+)/i);
  if (joinMatch) {
    const isLeft = /left/i.test(joinMatch[1]);
    const joinTableName = joinMatch[2].toLowerCase();
    const colLeft = joinMatch[3].split('.').pop()!.toLowerCase();
    const colRight = joinMatch[4].split('.').pop()!.toLowerCase();

    const joinTable = dbTables[joinTableName];
    if (joinTable) {
      const joined: Record<string, any>[] = [];
      for (const leftRow of workingRows) {
        let matchFound = false;
        for (const rightRow of joinTable.rows) {
          if (leftRow[colLeft] == rightRow[colRight] || leftRow[colRight] == rightRow[colLeft]) {
            joined.push({ ...leftRow, ...rightRow });
            matchFound = true;
          }
        }
        if (!matchFound && isLeft) {
          joined.push({ ...leftRow });
        }
      }
      workingRows = joined;
    }
  }

  // WHERE Clause
  const whereMatch = restClause.match(/\bWHERE\s+([\s\S]+?)(?=\bORDER\s+BY|\bGROUP\s+BY|\bLIMIT|$)/i);
  if (whereMatch) {
    const whereCond = whereMatch[1].trim();
    workingRows = workingRows.filter(row => evaluateWhere(whereCond, row));
  }

  // ORDER BY Clause
  const orderMatch = restClause.match(/\bORDER\s+BY\s+([a-zA-Z0-9_,\s]+?)(?=\bLIMIT|$)/i);
  if (orderMatch) {
    const orderParts = orderMatch[1].split(',').map(p => p.trim());
    workingRows.sort((a, b) => {
      for (const part of orderParts) {
        const tokens = part.split(/\s+/);
        const col = tokens[0].split('.').pop()!.toLowerCase();
        const dir = (tokens[1] || 'ASC').toUpperCase();
        const vA = a[col];
        const vB = b[col];

        if (vA === vB) continue;
        if (vA === null || vA === undefined) return 1;
        if (vB === null || vB === undefined) return -1;

        if (typeof vA === 'number' && typeof vB === 'number') {
          return dir === 'DESC' ? vB - vA : vA - vB;
        }
        const cmp = String(vA).localeCompare(String(vB));
        return dir === 'DESC' ? -cmp : cmp;
      }
      return 0;
    });
  }

  // LIMIT Clause
  const limitMatch = restClause.match(/\bLIMIT\s+(\d+)/i);
  if (limitMatch) {
    const limitNum = parseInt(limitMatch[1], 10);
    if (!isNaN(limitNum)) {
      workingRows = workingRows.slice(0, limitNum);
    }
  }

  // SELECT Columns / Aggregation projection
  const isDistinct = /^DISTINCT\s+/i.test(rawColumnsClause);
  const cleanColsClause = rawColumnsClause.replace(/^DISTINCT\s+/i, '').trim();

  let finalColumns: string[] = [];
  let finalValues: any[][] = [];

  if (cleanColsClause === '*') {
    finalColumns = tableObj.columns;
    finalValues = workingRows.map(row => finalColumns.map(col => row[col.toLowerCase()] ?? row[col] ?? null));
  } else {
    const colExprs = cleanColsClause.split(',').map(c => c.trim());
    
    // Check for aggregate functions: COUNT, SUM, AVG, MIN, MAX
    const hasAgg = colExprs.some(e => /^(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(e));
    if (hasAgg) {
      finalColumns = colExprs.map(e => {
        const asMatch = e.match(/\bAS\s+([a-zA-Z0-9_]+)$/i);
        return asMatch ? asMatch[1] : e;
      });

      const singleRow = colExprs.map(e => {
        const countMatch = e.match(/^COUNT\s*\((.*?)\)/i);
        if (countMatch) {
          const inner = countMatch[1].trim();
          if (inner === '*' || inner === '1') return workingRows.length;
          const colKey = inner.toLowerCase();
          return workingRows.filter(r => r[colKey] !== null && r[colKey] !== undefined).length;
        }
        const sumMatch = e.match(/^SUM\s*\((.*?)\)/i);
        if (sumMatch) {
          const colKey = sumMatch[1].trim().toLowerCase();
          return workingRows.reduce((acc, r) => acc + (Number(r[colKey]) || 0), 0);
        }
        const avgMatch = e.match(/^AVG\s*\((.*?)\)/i);
        if (avgMatch) {
          const colKey = avgMatch[1].trim().toLowerCase();
          if (workingRows.length === 0) return 0;
          const sum = workingRows.reduce((acc, r) => acc + (Number(r[colKey]) || 0), 0);
          return Math.round((sum / workingRows.length) * 100) / 100;
        }
        const minMatch = e.match(/^MIN\s*\((.*?)\)/i);
        if (minMatch) {
          const colKey = minMatch[1].trim().toLowerCase();
          const vals = workingRows.map(r => r[colKey]).filter(v => v !== null && v !== undefined);
          return vals.length ? Math.min(...vals.map(Number)) : null;
        }
        const maxMatch = e.match(/^MAX\s*\((.*?)\)/i);
        if (maxMatch) {
          const colKey = maxMatch[1].trim().toLowerCase();
          const vals = workingRows.map(r => r[colKey]).filter(v => v !== null && v !== undefined);
          return vals.length ? Math.max(...vals.map(Number)) : null;
        }
        // Fallback for non-aggregate field in grouped/aggregate query
        const colKey = e.split(/\s+AS\s+/i)[0].trim().split('.').pop()!.toLowerCase();
        return workingRows[0]?.[colKey] ?? null;
      });

      finalValues = [singleRow];
    } else {
      finalColumns = colExprs.map(e => {
        const asMatch = e.match(/\bAS\s+([a-zA-Z0-9_]+)$/i);
        return asMatch ? asMatch[1] : e.split('.').pop()!;
      });

      finalValues = workingRows.map(row => {
        return colExprs.map(e => {
          const baseName = e.split(/\s+AS\s+/i)[0].trim().split('.').pop()!.toLowerCase();
          return row[baseName] ?? null;
        });
      });
    }
  }

  // Handle DISTINCT
  if (isDistinct) {
    const seen = new Set<string>();
    finalValues = finalValues.filter(row => {
      const key = JSON.stringify(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return {
    success: true,
    columns: finalColumns,
    values: finalValues,
    executionTimeMs: Math.round(performance.now() - startTime),
    engine: 'javascript-relational',
  };
}

/**
 * Evaluates a simple WHERE clause against a row object
 */
function evaluateWhere(whereStr: string, row: Record<string, any>): boolean {
  // Split AND / OR
  if (/\bOR\b/i.test(whereStr)) {
    return whereStr.split(/\bOR\b/i).some(clause => evaluateWhere(clause.trim(), row));
  }
  if (/\bAND\b/i.test(whereStr)) {
    return whereStr.split(/\bAND\b/i).every(clause => evaluateWhere(clause.trim(), row));
  }

  const cond = whereStr.trim();

  // Pattern: col LIKE '%pattern%'
  const likeMatch = cond.match(/^([a-zA-Z0-9_.]+)\s+LIKE\s+['"](.*?)['"]$/i);
  if (likeMatch) {
    const col = likeMatch[1].split('.').pop()!.toLowerCase();
    const pattern = likeMatch[2].replace(/%/g, '.*').replace(/_/g, '.');
    const val = String(row[col] ?? '');
    return new RegExp(`^${pattern}$`, 'i').test(val);
  }

  // Pattern: col IN (val1, val2)
  const inMatch = cond.match(/^([a-zA-Z0-9_.]+)\s+IN\s*\((.*?)\)$/i);
  if (inMatch) {
    const col = inMatch[1].split('.').pop()!.toLowerCase();
    const inVals = inMatch[2].split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
    const val = String(row[col] ?? '');
    return inVals.includes(val);
  }

  // Pattern: col IS NULL / IS NOT NULL
  const nullMatch = cond.match(/^([a-zA-Z0-9_.]+)\s+IS(\s+NOT)?\s+NULL$/i);
  if (nullMatch) {
    const col = nullMatch[1].split('.').pop()!.toLowerCase();
    const isNull = row[col] === null || row[col] === undefined;
    return nullMatch[2] ? !isNull : isNull;
  }

  // Comparisons: >=, <=, !=, <>, >, <, =
  const compMatch = cond.match(/^([a-zA-Z0-9_.]+)\s*(>=|<=|!=|<>|>|<|=)\s*(.+)$/);
  if (compMatch) {
    const col = compMatch[1].split('.').pop()!.toLowerCase();
    const op = compMatch[2];
    let target: any = compMatch[3].trim().replace(/^['"]|['"]$/g, '');
    const rowVal = row[col];

    if (!isNaN(Number(target)) && typeof rowVal === 'number') {
      target = Number(target);
    }

    switch (op) {
      case '=':
        return rowVal == target;
      case '!=':
      case '<>':
        return rowVal != target;
      case '>':
        return rowVal > target;
      case '<':
        return rowVal < target;
      case '>=':
        return rowVal >= target;
      case '<=':
        return rowVal <= target;
    }
  }

  return true;
}

// ─── PRIMARY SQL EXECUTION ENTRYPOINT (ASYNC) ─────────────────────────────────
/**
 * Executes a SQL query against the database.
 * First tries high-performance SQLite WASM. If not supported or loading,
 * gracefully falls back to the in-memory JavaScript relational engine.
 */
export async function executeSqlInDb(
  sqlQuery: string,
  tableData?: TableDef[],
  schemaSql?: string
): Promise<SqlQueryResult> {
  const startTime = performance.now();
  if (!sqlQuery || !sqlQuery.trim()) {
    return {
      success: false,
      columns: [],
      values: [],
      error: 'Please enter a SQL query to run.',
      executionTimeMs: 0,
    };
  }

  // 1. Try SQLite WASM via sql.js
  try {
    const wasmRes = await runWithSqlJs(sqlQuery, tableData, schemaSql);
    if (wasmRes !== null) {
      return wasmRes;
    }
  } catch (err: any) {
    console.warn('WASM execution caught exception, falling back:', err);
  }

  // 2. Fallback to JavaScript Relational Engine (Sync in-memory)
  try {
    const jsRes = runWithJsEngine(sqlQuery, tableData);
    jsRes.executionTimeMs = Math.round(performance.now() - startTime);
    return jsRes;
  } catch (err: any) {
    return {
      success: false,
      columns: [],
      values: [],
      error: err?.message || 'SQL Execution error',
      executionTimeMs: Math.round(performance.now() - startTime),
    };
  }
}

// ─── SYNCHRONOUS SQL EXECUTION ENTRYPOINT ─────────────────────────────────────
/**
 * Direct synchronous SQL query execution via in-memory relational engine
 */
export function executeSqlInDbSync(
  sqlQuery: string,
  tableData?: TableDef[]
): SqlQueryResult {
  const startTime = performance.now();
  try {
    const res = runWithJsEngine(sqlQuery, tableData);
    res.executionTimeMs = Math.round(performance.now() - startTime);
    return res;
  } catch (err: any) {
    return {
      success: false,
      columns: [],
      values: [],
      error: err?.message || 'SQL Execution error',
      executionTimeMs: Math.round(performance.now() - startTime),
    };
  }
}

/**
 * Compare user query execution result with expected query execution result
 */
export async function verifySqlMatch(
  userQuery: string,
  expectedQuery: string,
  tableData?: TableDef[],
  schemaSql?: string
): Promise<{ match: boolean; userResult: SqlQueryResult; expectedResult: SqlQueryResult; difference?: string }> {
  const [userResult, expectedResult] = await Promise.all([
    executeSqlInDb(userQuery, tableData, schemaSql),
    executeSqlInDb(expectedQuery, tableData, schemaSql),
  ]);

  if (!userResult.success) {
    return { match: false, userResult, expectedResult, difference: `Syntax Error: ${userResult.error}` };
  }
  if (!expectedResult.success) {
    return { match: false, userResult, expectedResult, difference: `Expected query note: ${expectedResult.error}` };
  }

  if (userResult.columns.length !== expectedResult.columns.length) {
    return {
      match: false,
      userResult,
      expectedResult,
      difference: `Column count mismatch: got ${userResult.columns.length}, expected ${expectedResult.columns.length}`,
    };
  }

  if (userResult.values.length !== expectedResult.values.length) {
    return {
      match: false,
      userResult,
      expectedResult,
      difference: `Row count mismatch: got ${userResult.values.length} rows, expected ${expectedResult.values.length} rows`,
    };
  }

  // Value comparison
  const normalizeRow = (row: any[]) => row.map(v => (v === null || v === undefined ? '' : String(v).trim().toLowerCase())).join('|');
  const userRowsSet = userResult.values.map(normalizeRow).sort();
  const expectedRowsSet = expectedResult.values.map(normalizeRow).sort();

  for (let i = 0; i < userRowsSet.length; i++) {
    if (userRowsSet[i] !== expectedRowsSet[i]) {
      return {
        match: false,
        userResult,
        expectedResult,
        difference: `Output mismatch at row ${i + 1}`,
      };
    }
  }

  return { match: true, userResult, expectedResult };
}
