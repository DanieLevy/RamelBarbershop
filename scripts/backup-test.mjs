#!/usr/bin/env node

/**
 * Ramel Barbershop - Backup/Restore Verification Test
 *
 * Tests the full backup → restore cycle on a SINGLE small table ("products", 7 rows)
 * to verify everything works before running a real full backup.
 *
 * SAFETY:
 *   - Phase 1 (backup): Pure READ-ONLY via Supabase REST API.
 *   - Phase 2 (restore dry-run): Runs inside a transaction that ALWAYS ROLLS BACK.
 *     The database is never modified — even if the script crashes mid-way, the
 *     transaction is aborted and PostgreSQL discards all changes automatically.
 *
 * Prerequisites for Phase 2 (optional):
 *   - DATABASE_URL in .env.local (Phase 2 is skipped if missing)
 *   - pg package installed (npm install --save-dev pg)
 *
 * Usage: node scripts/backup-test.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const TEST_TABLE = 'products';

function loadEnv() {
  const envPath = join(ROOT_DIR, '.env.local');
  const content = readFileSync(envPath, 'utf-8');
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    vars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return vars;
}

function pass(msg) { console.log(`  [PASS] ${msg}`); }
function fail(msg) { console.error(`  [FAIL] ${msg}`); return false; }
function info(msg) { console.log(`  [INFO] ${msg}`); }
function skip(msg) { console.log(`  [SKIP] ${msg}`); }

async function main() {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║   Backup / Restore — Verification Test           ║');
  console.log('  ║   Table: "products" (7 rows, no dependencies)    ║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');

  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = env.DATABASE_URL;
  let allPassed = true;

  if (!supabaseUrl || !serviceRoleKey) {
    fail('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ─────────────────────────────────────────────────
  // PHASE 1: Backup test (READ-ONLY)
  // ─────────────────────────────────────────────────
  console.log('  Phase 1 — Backup (READ-ONLY)');
  console.log('  ' + '─'.repeat(46));

  info(`Fetching "${TEST_TABLE}" from Supabase…`);
  const { data: liveRows, error: fetchErr } = await supabase
    .from(TEST_TABLE)
    .select('*');

  if (fetchErr) {
    fail(`Fetch failed: ${fetchErr.message}`);
    process.exit(1);
  }

  pass(`Fetched ${liveRows.length} rows from live database`);

  const testDir = join(ROOT_DIR, 'backups', '_test_verification');
  mkdirSync(testDir, { recursive: true });
  const backupFile = join(testDir, `${TEST_TABLE}.json`);

  writeFileSync(backupFile, JSON.stringify(liveRows, null, 2), 'utf-8');
  pass(`Saved backup to backups/_test_verification/${TEST_TABLE}.json`);

  // 1a: Verify file can be read back and parsed
  let parsedRows;
  try {
    parsedRows = JSON.parse(readFileSync(backupFile, 'utf-8'));
    pass(`Backup file parses as valid JSON`);
  } catch {
    allPassed = fail('Backup file is not valid JSON');
    process.exit(1);
  }

  // 1b: Row count match
  if (parsedRows.length === liveRows.length) {
    pass(`Row count matches: ${parsedRows.length}`);
  } else {
    allPassed = fail(`Row count mismatch: file=${parsedRows.length}, live=${liveRows.length}`);
  }

  // 1c: Column integrity — every row has the same keys
  const expectedColumns = Object.keys(liveRows[0] || {}).sort();
  for (let i = 0; i < parsedRows.length; i++) {
    const rowCols = Object.keys(parsedRows[i]).sort();
    if (JSON.stringify(rowCols) !== JSON.stringify(expectedColumns)) {
      allPassed = fail(`Row ${i} has different columns than expected`);
      break;
    }
  }
  if (allPassed) pass(`All rows have identical column structure (${expectedColumns.length} columns)`);

  // 1d: Deep data equality — compare each row field-by-field
  let dataMatch = true;
  for (let i = 0; i < liveRows.length; i++) {
    const liveJson = JSON.stringify(liveRows[i]);
    const backupJson = JSON.stringify(parsedRows[i]);
    if (liveJson !== backupJson) {
      allPassed = fail(`Data mismatch at row ${i} (id=${liveRows[i].id})`);
      dataMatch = false;
      break;
    }
  }
  if (dataMatch) pass(`All ${liveRows.length} rows are byte-identical between live DB and backup file`);

  // 1e: Re-fetch from Supabase to confirm the DB was not modified
  const { data: verifyRows, error: verifyErr } = await supabase
    .from(TEST_TABLE)
    .select('*');

  if (verifyErr) {
    allPassed = fail(`Verification fetch failed: ${verifyErr.message}`);
  } else if (verifyRows.length !== liveRows.length) {
    allPassed = fail(`DB row count changed during backup! Before=${liveRows.length}, After=${verifyRows.length}`);
  } else {
    pass(`Database unchanged after backup (${verifyRows.length} rows confirmed)`);
  }

  console.log('');

  // ─────────────────────────────────────────────────
  // PHASE 2: Restore dry-run (ROLLBACK — zero changes)
  // ─────────────────────────────────────────────────
  console.log('  Phase 2 — Restore dry-run (transaction + ROLLBACK)');
  console.log('  ' + '─'.repeat(46));

  if (!databaseUrl) {
    skip('DATABASE_URL not set in .env.local — skipping restore test');
    skip('To test restore: add DATABASE_URL from Supabase Dashboard → Settings → Database');
    console.log('');
  } else {
    let pg;
    try {
      pg = await import('pg');
    } catch {
      skip('pg package not installed — skipping restore test (npm install --save-dev pg)');
      console.log('');
      databaseUrl && printResult(allPassed);
      return;
    }

    const { Client } = pg.default || pg;
    const client = new Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      statement_timeout: 30_000,
    });

    try {
      await client.connect();
      pass('Connected to PostgreSQL');

      // Everything inside BEGIN → ROLLBACK. Nothing persists.
      await client.query('BEGIN');
      info('Transaction started (will ROLLBACK at end — no changes persist)');

      // Disable triggers on the test table
      await client.query(`ALTER TABLE public."${TEST_TABLE}" DISABLE TRIGGER ALL`);
      pass('Triggers disabled');

      // Truncate
      await client.query(`TRUNCATE TABLE public."${TEST_TABLE}" CASCADE`);
      pass('Table truncated (inside transaction)');

      // Verify it's empty
      const emptyResult = await client.query(`SELECT COUNT(*)::int AS c FROM public."${TEST_TABLE}"`);
      if (emptyResult.rows[0].c === 0) {
        pass('Confirmed table is empty after truncate');
      } else {
        allPassed = fail('Table not empty after truncate');
      }

      // Insert backup data
      if (parsedRows.length > 0) {
        const columns = Object.keys(parsedRows[0]);
        const quotedCols = columns.map((c) => `"${c}"`).join(', ');
        const values = [];
        const valueSets = [];
        let paramIdx = 1;

        for (const row of parsedRows) {
          const placeholders = [];
          for (const col of columns) {
            values.push(row[col] ?? null);
            placeholders.push(`$${paramIdx++}`);
          }
          valueSets.push(`(${placeholders.join(', ')})`);
        }

        await client.query(
          `INSERT INTO public."${TEST_TABLE}" (${quotedCols}) VALUES ${valueSets.join(', ')}`,
          values,
        );
        pass(`Inserted ${parsedRows.length} rows from backup`);
      }

      // Verify count after insert
      const countResult = await client.query(`SELECT COUNT(*)::int AS c FROM public."${TEST_TABLE}"`);
      const restoredCount = countResult.rows[0].c;
      if (restoredCount === parsedRows.length) {
        pass(`Row count verified after restore: ${restoredCount}`);
      } else {
        allPassed = fail(`Row count mismatch: expected=${parsedRows.length}, got=${restoredCount}`);
      }

      // Deep verify: read back every row and compare
      const { rows: restoredRows } = await client.query(
        `SELECT * FROM public."${TEST_TABLE}" ORDER BY id`,
      );
      const sortedOriginal = [...parsedRows].sort((a, b) => a.id.localeCompare(b.id));

      let deepMatch = true;
      for (let i = 0; i < sortedOriginal.length; i++) {
        const orig = sortedOriginal[i];
        const restored = restoredRows[i];
        for (const col of Object.keys(orig)) {
          const origVal = JSON.stringify(orig[col]);
          const restVal = JSON.stringify(restored[col]);
          if (origVal !== restVal) {
            allPassed = fail(`Field mismatch: row ${i}, col "${col}" — original=${origVal}, restored=${restVal}`);
            deepMatch = false;
            break;
          }
        }
        if (!deepMatch) break;
      }
      if (deepMatch) pass(`All ${restoredRows.length} rows verified field-by-field — data is identical`);

      // Re-enable triggers
      await client.query(`ALTER TABLE public."${TEST_TABLE}" ENABLE TRIGGER ALL`);
      pass('Triggers re-enabled');

      // ROLLBACK — discard everything, database returns to original state
      await client.query('ROLLBACK');
      pass('Transaction ROLLED BACK — database is completely unchanged');

      // Final verification: confirm original data is still there
      const finalResult = await client.query(`SELECT COUNT(*)::int AS c FROM public."${TEST_TABLE}"`);
      if (finalResult.rows[0].c === liveRows.length) {
        pass(`Final verification: table has ${finalResult.rows[0].c} rows (unchanged)`);
      } else {
        allPassed = fail(`Final count mismatch: expected=${liveRows.length}, actual=${finalResult.rows[0].c}`);
      }
    } catch (err) {
      allPassed = false;
      console.error(`  [FAIL] ${err.message}`);
      try { await client.query('ROLLBACK'); } catch {}
    } finally {
      await client.end();
    }

    console.log('');
  }

  // Cleanup test files
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
    info('Cleaned up test files');
  }

  printResult(allPassed);
}

function printResult(allPassed) {
  console.log('');
  if (allPassed) {
    console.log('  ╔══════════════════════════════════════════════════╗');
    console.log('  ║  ALL CHECKS PASSED                                ║');
    console.log('  ║  Safe to run: npm run db:backup                   ║');
    console.log('  ╚══════════════════════════════════════════════════╝');
  } else {
    console.log('  ╔══════════════════════════════════════════════════╗');
    console.log('  ║  SOME CHECKS FAILED — review output above        ║');
    console.log('  ╚══════════════════════════════════════════════════╝');
  }
  console.log('');
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('');
  console.error('  Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
