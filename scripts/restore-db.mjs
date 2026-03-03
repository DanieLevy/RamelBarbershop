#!/usr/bin/env node

/**
 * Ramel Barbershop - Database Restore Script
 *
 * DESTRUCTIVE — Replaces ALL data in the database with backup data.
 * Use with extreme caution. Always create a fresh backup first.
 *
 * Prerequisites:
 *   1. Add DATABASE_URL to .env.local
 *      Get it from: Supabase Dashboard → Project Settings → Database → Connection string (URI)
 *      Format: postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres
 *
 *   2. Install pg: npm install --save-dev pg
 *
 * Usage:
 *   node scripts/restore-db.mjs                          (uses latest backup)
 *   node scripts/restore-db.mjs backups/2026-03-03_15-30-00  (specific backup)
 */

import pg from 'pg';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline/promises';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const TABLES_IN_ORDER = [
  'barbershop_settings',
  'barbershop_closures',
  'products',
  'reminder_batch_logs',
  'users',
  'customers',
  'services',
  'work_days',
  'barber_closures',
  'barber_messages',
  'barber_gallery',
  'barber_notification_settings',
  'barber_booking_settings',
  'barber_breakouts',
  'push_subscriptions',
  'customer_notification_settings',
  'trusted_devices',
  'reservations',
  'reservation_changes',
  'notification_logs',
  'recurring_appointments',
];

const JSONB_COLUMNS = {
  reservation_changes: new Set(['old_values', 'new_values']),
  notification_logs: new Set(['payload']),
  reminder_batch_logs: new Set(['details']),
};

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

function resolveBackupDir() {
  const arg = process.argv[2];

  if (arg) {
    const resolved = isAbsolute(arg) ? arg : join(ROOT_DIR, arg);
    if (!existsSync(resolved)) {
      console.error(`  ERROR: Backup directory not found: ${arg}`);
      process.exit(1);
    }
    return resolved;
  }

  const backupsRoot = join(ROOT_DIR, 'backups');
  if (!existsSync(backupsRoot)) {
    console.error('  ERROR: No backups/ directory found. Run a backup first.');
    process.exit(1);
  }

  const dirs = readdirSync(backupsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .reverse();

  if (!dirs.length) {
    console.error('  ERROR: No backup directories found inside backups/');
    process.exit(1);
  }

  return join(backupsRoot, dirs[0]);
}

function readBackupData(backupDir) {
  const dataDir = join(backupDir, 'data');
  if (!existsSync(dataDir)) {
    console.error(`  ERROR: Missing data/ folder in backup: ${backupDir}`);
    process.exit(1);
  }

  const tableData = {};
  for (const table of TABLES_IN_ORDER) {
    const filePath = join(dataDir, `${table}.json`);
    if (!existsSync(filePath)) {
      console.error(`  ERROR: Missing backup file: data/${table}.json`);
      process.exit(1);
    }
    tableData[table] = JSON.parse(readFileSync(filePath, 'utf-8'));
  }
  return tableData;
}

function prepareValue(tableName, columnName, value) {
  if (value === null || value === undefined) return null;
  if (JSONB_COLUMNS[tableName]?.has(columnName)) {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  return value;
}

async function batchInsert(client, tableName, rows) {
  if (!rows.length) return;

  const columns = Object.keys(rows[0]);
  const quotedCols = columns.map((c) => `"${c}"`).join(', ');
  const BATCH_SIZE = 200;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = [];
    const valueSets = [];
    let paramIdx = 1;

    for (const row of batch) {
      const placeholders = [];
      for (const col of columns) {
        values.push(prepareValue(tableName, col, row[col]));
        placeholders.push(`$${paramIdx++}`);
      }
      valueSets.push(`(${placeholders.join(', ')})`);
    }

    await client.query(
      `INSERT INTO public."${tableName}" (${quotedCols}) VALUES ${valueSets.join(', ')}`,
      values,
    );
  }
}

async function main() {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║   Ramel Barbershop — Database Restore            ║');
  console.log('  ║   WARNING: This REPLACES all data in the DB      ║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');

  const env = loadEnv();
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('  ERROR: DATABASE_URL not found in .env.local');
    console.error('');
    console.error('  Add it from: Supabase Dashboard → Settings → Database → Connection string');
    console.error('  Format: postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres');
    console.error('');
    process.exit(1);
  }

  const backupDir = resolveBackupDir();
  const backupName = backupDir.split('/').slice(-2).join('/');

  const metadataPath = join(backupDir, 'metadata.json');
  if (!existsSync(metadataPath)) {
    console.error(`  ERROR: metadata.json not found in ${backupName}`);
    process.exit(1);
  }

  const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
  console.log(`  Backup source  : ${backupName}`);
  console.log(`  Backup created : ${metadata.created_at}`);
  console.log(`  Total rows     : ${metadata.total_rows}`);
  console.log(`  Tables         : ${metadata.table_count}`);
  console.log('');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('  Type "RESTORE" to proceed (this is irreversible): ');
  rl.close();

  if (answer.trim() !== 'RESTORE') {
    console.log('  Aborted.');
    process.exit(0);
  }

  console.log('');
  console.log('  Reading backup files…');
  const tableData = readBackupData(backupDir);

  console.log('  Connecting to database…');
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 120_000,
  });

  await client.connect();
  console.log('  Connected.');
  console.log('');

  try {
    await client.query('BEGIN');

    console.log('  Disabling triggers on all tables…');
    for (const table of TABLES_IN_ORDER) {
      await client.query(`ALTER TABLE public."${table}" DISABLE TRIGGER ALL`);
    }

    console.log('  Truncating all tables…');
    const allTables = TABLES_IN_ORDER.map((t) => `public."${t}"`).join(', ');
    await client.query(`TRUNCATE TABLE ${allTables} CASCADE`);

    console.log('');
    console.log('  Inserting backup data…');
    console.log('  ' + '─'.repeat(56));

    for (const table of TABLES_IN_ORDER) {
      const rows = tableData[table];
      const t0 = Date.now();

      await batchInsert(client, table, rows);

      const elapsed = Date.now() - t0;
      const rowStr = String(rows.length).padStart(6);
      const timeStr = `${elapsed}ms`.padStart(8);
      console.log(`    ${table.padEnd(38)} ${rowStr} rows ${timeStr}`);
    }

    console.log('  ' + '─'.repeat(56));

    console.log('');
    console.log('  Re-enabling triggers…');
    for (const table of TABLES_IN_ORDER) {
      await client.query(`ALTER TABLE public."${table}" ENABLE TRIGGER ALL`);
    }

    console.log('  Verifying row counts…');
    let allMatch = true;
    for (const table of TABLES_IN_ORDER) {
      const result = await client.query(`SELECT COUNT(*)::int AS count FROM public."${table}"`);
      const actual = result.rows[0].count;
      const expected = tableData[table].length;
      if (actual !== expected) {
        console.error(`    MISMATCH: ${table} — expected ${expected}, got ${actual}`);
        allMatch = false;
      }
    }

    if (!allMatch) {
      console.error('');
      console.error('  Row count mismatch detected — rolling back.');
      await client.query('ROLLBACK');
      process.exit(1);
    }

    await client.query('COMMIT');

    console.log('');
    console.log('  ╔══════════════════════════════════════════════════╗');
    console.log('  ║  Restore complete — all rows verified             ║');
    console.log('  ╚══════════════════════════════════════════════════╝');
    console.log('');
  } catch (err) {
    console.error('');
    console.error('  Restore failed — rolling back transaction.');
    console.error('  Error:', err.message);

    try {
      await client.query('ROLLBACK');
      console.error('  Rollback succeeded — database unchanged.');
    } catch (rollbackErr) {
      console.error('  Rollback error:', rollbackErr.message);
    }

    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('');
  console.error('  Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
