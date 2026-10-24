import initSqlJs, { type Database, type QueryExecResult } from 'sql.js';

export interface TableDef {
  name: string;
  columns: string; // comma-separated column names
  rows: string;    // newline-separated rows, each comma-separated
}

export interface SqlQueryResult {
  success: boolean;
  columns: string[];
  values: any[][];
  error?: string;
  executionTimeMs: number;
}

let sqlPromise: Promise<any> | null = null;

export async function getSqlInstance() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`,
    });
  }
  return sqlPromise;
}

/**
 * Execute a SQL query against an in-memory SQLite database initialized with the given tables and schema.
 */
export async function executeSqlInDb(
  sqlQuery: string,
  tableData?: TableDef[],
  schemaSql?: string
): Promise<SqlQueryResult> {
  const startTime = performance.now();
  try {
    const SQL = await getSqlInstance();
    const db: Database = new SQL.Database();

    // 1. Run schema DDL if provided
    if (schemaSql && schemaSql.trim()) {
      try {
        db.run(schemaSql);
      } catch (e: any) {
        console.warn('Schema pre-run note:', e?.message);
      }
    }

    // 2. Create tables from tableData
    if (tableData && tableData.length > 0) {
      for (const t of tableData) {
        if (!t.name || !t.name.trim()) continue;
        const tableName = t.name.trim().replace(/[^a-zA-Z0-9_]/g, '');
        const cols = t.columns
          .split(',')
          .map(c => c.trim())
          .filter(Boolean);

        if (cols.length === 0) continue;

        // Create table
        const colDefs = cols.map(c => `"${c.replace(/"/g, '')}" TEXT`).join(', ');
        db.run(`CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs});`);

        // Insert rows
        const rows = (t.rows || '').split('\n').map(r => r.trim()).filter(Boolean);
        for (const row of rows) {
          const cells = row.split(',').map(c => c.trim());
          const placeholders = cols.map(() => '?').join(', ');
          const paddedValues = cols.map((_, i) => cells[i] ?? null);
          db.run(`INSERT INTO "${tableName}" VALUES (${placeholders});`, paddedValues);
        }
      }
    }

    // 3. Execute the student's or admin's query
    const results: QueryExecResult[] = db.exec(sqlQuery);
    const executionTimeMs = Math.round(performance.now() - startTime);

    if (results.length === 0) {
      return {
        success: true,
        columns: [],
        values: [],
        executionTimeMs,
      };
    }

    const firstResult = results[0];
    return {
      success: true,
      columns: firstResult.columns,
      values: firstResult.values,
      executionTimeMs,
    };
  } catch (err: any) {
    const executionTimeMs = Math.round(performance.now() - startTime);
    return {
      success: false,
      columns: [],
      values: [],
      error: err?.message || 'SQL Execution error',
      executionTimeMs,
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
    return { match: false, userResult, expectedResult, difference: `Syntax/Runtime Error: ${userResult.error}` };
  }
  if (!expectedResult.success) {
    // If expected query fails for some reason, match is uncertain
    return { match: false, userResult, expectedResult, difference: `Expected query error: ${expectedResult.error}` };
  }

  // Compare columns count
  if (userResult.columns.length !== expectedResult.columns.length) {
    return {
      match: false,
      userResult,
      expectedResult,
      difference: `Column count mismatch: got ${userResult.columns.length}, expected ${expectedResult.columns.length}`,
    };
  }

  // Compare rows count
  if (userResult.values.length !== expectedResult.values.length) {
    return {
      match: false,
      userResult,
      expectedResult,
      difference: `Row count mismatch: got ${userResult.values.length} rows, expected ${expectedResult.values.length} rows`,
    };
  }

  // Compare row content stringified
  const uStr = JSON.stringify(userResult.values);
  const eStr = JSON.stringify(expectedResult.values);
  const match = uStr.toLowerCase() === eStr.toLowerCase();

  return {
    match,
    userResult,
    expectedResult,
    difference: match ? undefined : 'Output values do not match expected records',
  };
}
