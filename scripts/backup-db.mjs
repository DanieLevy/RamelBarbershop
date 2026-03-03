#!/usr/bin/env node

/**
 * Ramel Barbershop - Database Backup Script
 *
 * STRICTLY READ-ONLY — Only performs SELECT operations.
 * No data is modified, inserted, updated, or deleted in the database.
 *
 * Usage:  node scripts/backup-db.mjs
 * Output: backups/YYYY-MM-DD_HH-mm-ss/
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

async function fetchAllRows(supabase, tableName) {
  const PAGE_SIZE = 1000;
  let allRows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to fetch "${tableName}": ${error.message}`);
    }

    allRows = allRows.concat(data || []);

    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allRows;
}

function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return [
    date.getFullYear(),
    '-', pad(date.getMonth() + 1),
    '-', pad(date.getDate()),
    '_',
    pad(date.getHours()),
    '-', pad(date.getMinutes()),
    '-', pad(date.getSeconds()),
  ].join('');
}

async function main() {
  const startTime = Date.now();

  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║   Ramel Barbershop — Database Backup             ║');
  console.log('  ║   Mode: READ-ONLY (zero changes to database)     ║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');

  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('  ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();
  const ts = formatTimestamp(now);
  const backupDir = join(ROOT_DIR, 'backups', ts);
  const dataDir = join(backupDir, 'data');

  mkdirSync(dataDir, { recursive: true });

  const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
  console.log(`  Supabase project : ${projectRef}`);
  console.log(`  Backup directory : backups/${ts}/`);
  console.log('');
  console.log('  Fetching tables…');
  console.log('  ' + '─'.repeat(56));

  const summary = {};
  let totalRows = 0;

  for (const table of TABLES_IN_ORDER) {
    const t0 = Date.now();
    const rows = await fetchAllRows(supabase, table);
    const elapsed = Date.now() - t0;

    writeFileSync(
      join(dataDir, `${table}.json`),
      JSON.stringify(rows, null, 2),
      'utf-8',
    );

    summary[table] = rows.length;
    totalRows += rows.length;

    const rowStr = String(rows.length).padStart(6);
    const timeStr = `${elapsed}ms`.padStart(8);
    console.log(`    ${table.padEnd(38)} ${rowStr} rows ${timeStr}`);
  }

  const metadata = {
    backup_version: '1.0.0',
    created_at: now.toISOString(),
    supabase_url: supabaseUrl,
    supabase_project_ref: projectRef,
    tables: summary,
    total_rows: totalRows,
    table_count: TABLES_IN_ORDER.length,
    table_order: TABLES_IN_ORDER,
  };

  writeFileSync(
    join(backupDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf-8',
  );

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('  ' + '─'.repeat(56));
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log(`  ║  Backup complete                                  ║`);
  console.log(`  ║  Tables : ${String(TABLES_IN_ORDER.length).padEnd(5)}                                    ║`);
  console.log(`  ║  Rows   : ${String(totalRows).padEnd(7)}                                  ║`);
  console.log(`  ║  Time   : ${(totalElapsed + 's').padEnd(7)}                                  ║`);
  console.log(`  ║  Saved  : backups/${ts}/            ║`);
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');
}

main().catch((err) => {
  console.error('');
  console.error('  Backup failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
