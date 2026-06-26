#!/usr/bin/env node
/**
 * Strażnik izolacji najemcy (CRITICAL build blocker).
 *
 * Wymóg #2 (Ślepy Odczyt / Zero Global Lookups): KAŻDE zapytanie SQL dotykające
 * tabeli `scene_snapshots` musi być zawężone do najemcy:
 *   - SELECT / UPDATE / DELETE  →  musi mieć `WHERE ... tenant_id = :tenant_id`
 *   - INSERT                    →  musi wstawiać kolumnę `tenant_id`
 *
 * Zapytanie bez tego filtra jest traktowane jako KRYTYCZNE naruszenie
 * architektury i blokuje build (exit code 1). Skrypt jest podpięty pod `pretest`,
 * więc `npm test` nie ruszy, dopóki naruszenie nie zostanie usunięte.
 *
 * Skan jest statyczny (regex po źródłach), świadomie konserwatywny: lepiej
 * fałszywy alarm wymuszający jawny `WHERE tenant_id` niż przeoczony global lookup.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, '..', 'src');

/** Tabele objęte rygorem multi-tenant (każde zapytanie musi mieć tenant_id). */
const TENANT_SCOPED_TABLES = ['scene_snapshots'];

/** Rekurencyjnie zbiera pliki .js (pomija node_modules). */
function collectJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectJsFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

/**
 * Wyciąga treści template-literali przekazanych do `.prepare(`...`)`.
 * Zwraca listę { sql, index } (index = offset początku, do numeru linii).
 */
function extractPreparedSql(source) {
  const results = [];
  const re = /\.prepare\(\s*`([\s\S]*?)`/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    results.push({ sql: m[1], index: m.index });
  }
  return results;
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

function violationsForSql(sql) {
  const problems = [];

  for (const table of TENANT_SCOPED_TABLES) {
    const touchesTable = new RegExp(`\\b(from|join|into|update)\\s+${table}\\b`, 'i').test(sql);
    if (!touchesTable) continue;

    const isInsert = /\binsert\s+into\b/i.test(sql);
    const hasTenantPredicate = /tenant_id\s*=\s*:tenant_id/i.test(sql);
    const insertsTenantColumn = /\btenant_id\b/i.test(sql);

    if (isInsert) {
      if (!insertsTenantColumn) {
        problems.push(`INSERT do ${table} bez kolumny tenant_id`);
      }
    } else if (!hasTenantPredicate) {
      // SELECT/UPDATE/DELETE — wymagamy jawnego predykatu tenant_id = :tenant_id.
      problems.push(`zapytanie na ${table} bez "WHERE tenant_id = :tenant_id"`);
    }
  }

  return [...new Set(problems)];
}

function main() {
  const files = collectJsFiles(SRC_DIR).filter((f) => !f.includes(`${path.sep}tests${path.sep}`));
  const violations = [];

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    if (!TENANT_SCOPED_TABLES.some((t) => source.includes(t))) continue;
    for (const { sql, index } of extractPreparedSql(source)) {
      const problems = violationsForSql(sql);
      for (const problem of problems) {
        violations.push({
          file: path.relative(SRC_DIR, file),
          line: lineOf(source, index),
          problem,
          snippet: sql.trim().replace(/\s+/g, ' ').slice(0, 100),
        });
      }
    }
  }

  if (violations.length > 0) {
    console.error('\n\x1b[31m✖ CRITICAL VIOLATION — izolacja najemcy (multi-tenant):\x1b[0m');
    console.error('  Zapytanie SQL na tabeli tenant-scoped bez "WHERE tenant_id = :tenant_id" blokuje build.\n');
    for (const v of violations) {
      console.error(`  \x1b[31m✖\x1b[0m ${v.file}:${v.line} — ${v.problem}`);
      console.error(`      SQL: ${v.snippet}${v.snippet.length >= 100 ? '…' : ''}`);
    }
    console.error(`\n  ${violations.length} naruszenie(a). Build zablokowany.\n`);
    process.exit(1);
  }

  console.log('\x1b[32m✓\x1b[0m Tenant-scope guard: wszystkie zapytania na tabelach tenant-scoped mają WHERE tenant_id.');
}

main();
