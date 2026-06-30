#!/usr/bin/env node
/**
 * RunComfy Serverless audit — lokalny, bez GPU (domyślnie).
 * Usage (from backend/):
 *   npm run audit:runcomfy
 *   npm run audit:runcomfy -- --json --strict
 *   npm run audit:runcomfy -- --live --probe-api --bundle
 *   ./scripts/audit-runcomfy.sh
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initDatabase, getDb } from '../src/db/init.js';
import { resolveWanRenderParams } from '../src/video/wanConfig.js';
import {
  BACKEND_ROOT,
  checkWritableDir,
  loadBackendEnv,
  maskSecret,
  parseAuditArgs,
  parseDeploymentId,
  validateRunComfyEnv,
} from './lib/runcomfy-cli.mjs';
import {
  auditWorkflowContract,
  EXPECTED_MODEL_PATHS,
  EXPECTED_PAYLOAD_NODE_IDS,
  WAN_WORKFLOW_TEMPLATE_PATH,
} from '../src/video/runcomfyWorkflowAudit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUCK_JOB_MINUTES = 15;

class AuditReport {
  constructor() {
    this.sections = [];
    this.findings = [];
  }

  addSection(name, findings) {
    this.sections.push({ name, findings });
    this.findings.push(...findings);
  }

  counts() {
    return {
      pass: this.findings.filter((f) => f.level === 'PASS').length,
      warn: this.findings.filter((f) => f.level === 'WARN').length,
      fail: this.findings.filter((f) => f.level === 'FAIL').length,
    };
  }

  exitCode(strict) {
    const { fail, warn } = this.counts();
    if (fail > 0) return 1;
    if (strict && warn > 0) return 1;
    return 0;
  }
}

function pass(code, message, details = null) {
  return { level: 'PASS', code, message, details };
}

function warn(code, message, details = null) {
  return { level: 'WARN', code, message, details };
}

function fail(code, message, details = null) {
  return { level: 'FAIL', code, message, details };
}

function auditConfiguration(paths) {
  const findings = [];
  const { errors, warnings } = validateRunComfyEnv();

  for (const message of errors) {
    findings.push(fail('env_error', message));
  }
  for (const message of warnings) {
    findings.push(warn('env_warn', message));
  }

  const deploymentId = parseDeploymentId(process.env.RUNCOMFY_ENDPOINT);
  if (deploymentId) {
    findings.push(pass('deployment_id', `Deployment UUID: ${deploymentId}`));
  } else {
    findings.push(fail('deployment_id', 'Nie rozpoznano UUID deploymentu w RUNCOMFY_ENDPOINT'));
  }

  findings.push(pass('api_key', `RUNCOMFY_API_KEY: ${maskSecret(process.env.RUNCOMFY_API_KEY)}`));
  const wanParams = resolveWanRenderParams();
  findings.push(pass(
    'wan_quality',
    `WAN_LENGTH=${wanParams.length}, ${wanParams.width}×${wanParams.height}, steps=${wanParams.steps}`,
  ));

  const outCheck = checkWritableDir(paths.outputDir, 'OUTPUT_DIR');
  const upCheck = checkWritableDir(paths.uploadsDir, 'UPLOADS_DIR');
  for (const message of [...outCheck.errors, ...upCheck.errors]) {
    findings.push(fail('dir_error', message));
  }
  for (const message of [...outCheck.warnings, ...upCheck.warnings]) {
    findings.push(warn('dir_warn', message));
  }

  if (errors.length === 0 && outCheck.errors.length === 0) {
    findings.push(pass('config_ok', 'Konfiguracja .env wygląda poprawnie'));
  }

  return findings;
}

function auditWorkflowSection() {
  const contract = auditWorkflowContract();
  const findings = [...contract.findings];

  if (!findings.some((f) => f.level === 'FAIL')) {
    findings.unshift(pass(
      'workflow_contract',
      `Kontrakt workflow OK (${EXPECTED_PAYLOAD_NODE_IDS.length} nodów, SaveWEBM node 52)`,
    ));
  }

  findings.push(pass(
    'model_paths',
    'Ścieżki modeli w szablonie (do weryfikacji przez RunComfy)',
    EXPECTED_MODEL_PATHS,
  ));

  return { findings, contract };
}

function isRunComfyJobRow(row) {
  const err = (row.error_message || '').toLowerCase();
  const msg = (row.status_message || '').toLowerCase();
  const out = (row.output_path || '').toLowerCase();
  return err.includes('runcomfy')
    || msg.includes('runcomfy')
    || out.endsWith('.webm')
    || out.endsWith('.webp');
}

function minutesSince(iso) {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

function auditJobHistory(dbPath) {
  const findings = [];

  if (!fs.existsSync(dbPath)) {
    findings.push(warn('db_missing', `Brak bazy SQLite: ${dbPath}`));
    return findings;
  }

  try {
    initDatabase(dbPath);
    const db = getDb();

    const rows = db.prepare(`
      SELECT id, status, progress, error_message, status_message, output_path,
             created_at, updated_at, completed_at
      FROM video_jobs
      ORDER BY created_at DESC
      LIMIT 30
    `).all();

    const rcRows = rows.filter(isRunComfyJobRow);
    findings.push(pass('db_jobs', `Ostatnie joby: ${rows.length} łącznie, ~${rcRows.length} RunComfy`));

    const completed = rcRows.filter((r) => r.status === 'completed');
    const failed = rcRows.filter((r) => r.status === 'failed');
    const stuck = rows.filter((r) => {
      const active = r.status === 'processing' || r.status === 'pending';
      const mins = minutesSince(r.updated_at);
      return active && mins != null && mins >= STUCK_JOB_MINUTES;
    });

    findings.push(pass('job_stats', `RunComfy: ${completed.length} completed, ${failed.length} failed`, {
      stuck: stuck.length,
    }));

    if (stuck.length > 0) {
      findings.push(warn(
        'jobs_stuck',
        `${stuck.length} job(ów) processing/pending > ${STUCK_JOB_MINUTES} min`,
        stuck.map((r) => ({ id: r.id, status: r.status, updated_at: r.updated_at })),
      ));
    }

    const staleFails = failed.filter((r) => /zawieszone|timed out|stale/i.test(r.error_message || ''));
    if (staleFails.length >= 2) {
      findings.push(warn(
        'stale_pattern',
        `${staleFails.length} faili ze wzorcem stale/timeout — typowy objaw freeze GPU`,
        staleFails.slice(0, 3).map((r) => ({ id: r.id, error: r.error_message?.slice(0, 120) })),
      ));
    }

    if (completed.length >= 1 && failed.length >= 2 && completed[0].created_at < failed[0].created_at) {
      findings.push(warn(
        'success_then_fail',
        'Wzorzec: wcześniejszy sukces, potem fail — zgodne z freeze po WAN21',
      ));
    }

    const lastOk = completed.find((r) => (r.output_path || '').toLowerCase().endsWith('.webm'));
    if (lastOk) {
      findings.push(pass('last_webm_job', `Ostatni WEBM job: ${lastOk.id}`, {
        output_path: lastOk.output_path,
        completed_at: lastOk.completed_at,
      }));
    } else {
      findings.push(warn('no_webm_job', 'Brak udanego joba z output_path .webm w ostatnich 30'));
    }

    if (rcRows[0]) {
      findings.push(pass('latest_rc_job', `Ostatni RunComfy job: ${rcRows[0].id} (${rcRows[0].status})`, {
        error_message: rcRows[0].error_message?.slice(0, 200) || null,
      }));
    }
  } catch (err) {
    findings.push(fail('db_error', `Błąd odczytu SQLite: ${err.message}`));
  }

  return findings;
}

function auditOutputDir(outputDir) {
  const findings = [];

  if (!fs.existsSync(outputDir)) {
    findings.push(warn('output_empty', 'Katalog output nie istnieje'));
    return findings;
  }

  const webmFiles = fs.readdirSync(outputDir)
    .filter((f) => f.toLowerCase().endsWith('.webm'))
    .map((f) => {
      const full = path.join(outputDir, f);
      const stat = fs.statSync(full);
      return { name: f, size: stat.size, mtime: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime));

  if (webmFiles.length === 0) {
    findings.push(warn('no_webm_files', 'Brak plików .webm w output/'));
    return findings;
  }

  const latest = webmFiles[0];
  findings.push(pass('output_webm', `${webmFiles.length} plik(ów) .webm; najnowszy: ${latest.name} (${latest.size} B)`));

  if (latest.size < 10_000) {
    findings.push(warn('webm_small', `Najnowszy WEBM bardzo mały (${latest.size} B)`));
  }

  return findings;
}

async function auditLiveHealth(port) {
  const findings = [];
  const url = `http://127.0.0.1:${port}/api/health`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      findings.push(warn('health_http', `GET /api/health → HTTP ${res.status}`));
      return findings;
    }
    const body = await res.json();
    findings.push(pass('health_ok', `Backend działa na :${port}`, { service: body.service, llm: body.llm }));
  } catch (err) {
    findings.push(warn('health_unreachable', `Backend niedostępny (${url}): ${err.message}`));
  }

  return findings;
}

async function auditProbeApi() {
  const findings = [];
  const endpoint = process.env.RUNCOMFY_ENDPOINT?.trim();
  const apiKey = process.env.RUNCOMFY_API_KEY?.trim();

  if (!endpoint || !apiKey) {
    findings.push(fail('probe_skip', 'Brak endpoint/key — pominięto probe-api'));
    return findings;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: '{}',
      signal: AbortSignal.timeout(15000),
    });

    const text = await res.text();
    let body = text;
    try {
      body = JSON.parse(text);
    } catch {
      // keep text
    }

    if (res.status === 401 || res.status === 403) {
      findings.push(fail('probe_auth', `POST inference → HTTP ${res.status} (błędny RUNCOMFY_API_KEY?)`, body));
    } else if (res.status === 404) {
      findings.push(fail('probe_endpoint', `POST inference → HTTP 404 (zły deployment URL?)`, body));
    } else if (res.status >= 200 && res.status < 500) {
      findings.push(pass(
        'probe_reachable',
        `POST inference → HTTP ${res.status} (endpoint żyje; pusty body oczekiwanie 4xx)`,
        typeof body === 'object' ? body : { raw: String(body).slice(0, 200) },
      ));
    } else {
      findings.push(warn('probe_http', `POST inference → HTTP ${res.status}`, body));
    }
  } catch (err) {
    findings.push(fail('probe_network', `Probe API nieudany: ${err.message}`));
  }

  return findings;
}

function runSmokeDryRun() {
  const findings = [];
  const script = path.join(BACKEND_ROOT, 'scripts/runcomfy-smoke.mjs');
  const result = spawnSync(
    process.execPath,
    ['--use-system-ca', '--experimental-sqlite', script, '--dry-run'],
    { cwd: BACKEND_ROOT, encoding: 'utf8' },
  );

  if (result.status === 0) {
    findings.push(pass('smoke_dry_run', 'runcomfy-smoke --dry-run OK'));
  } else {
    findings.push(fail('smoke_dry_run', 'runcomfy-smoke --dry-run FAIL', {
      stderr: result.stderr?.slice(0, 500),
      stdout: result.stdout?.slice(0, 500),
    }));
  }

  return findings;
}

function writeBundle(report, contract, paths) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bundleDir = path.join(paths.outputDir, `runcomfy-audit-${stamp}`);
  fs.mkdirSync(bundleDir, { recursive: true });

  const summary = {
    generated_at: new Date().toISOString(),
    deployment_id: parseDeploymentId(process.env.RUNCOMFY_ENDPOINT),
    wan_length: resolveWanRenderParams().length,
    counts: report.counts(),
    sections: report.sections,
    model_paths: EXPECTED_MODEL_PATHS,
  };

  fs.writeFileSync(path.join(bundleDir, 'report.json'), JSON.stringify(summary, null, 2));
  fs.copyFileSync(WAN_WORKFLOW_TEMPLATE_PATH, path.join(bundleDir, 'wan_workflow_api.json'));

  const txt = [
    'RunComfy Serverless — audit bundle',
    `Generated: ${summary.generated_at}`,
    `Deployment: ${summary.deployment_id}`,
    `WAN_LENGTH: ${summary.wan_length}`,
    '',
    ...report.sections.flatMap((s) => [
      `## ${s.name}`,
      ...s.findings.map((f) => `[${f.level}] ${f.code}: ${f.message}`),
      '',
    ]),
  ].join('\n');

  fs.writeFileSync(path.join(bundleDir, 'report.txt'), txt);

  return bundleDir;
}

function printHumanReport(report) {
  console.log('=== RunComfy audit (Serverless, bez GPU) ===\n');

  for (const section of report.sections) {
    console.log(`── ${section.name} ──`);
    for (const f of section.findings) {
      const icon = f.level === 'PASS' ? '✓' : f.level === 'WARN' ? '!' : '✗';
      console.log(`  ${icon} [${f.level}] ${f.message}`);
      if (f.details && f.level !== 'PASS') {
        console.log(`      ${JSON.stringify(f.details).slice(0, 200)}`);
      }
    }
    console.log('');
  }

  const { pass: p, warn: w, fail: f } = report.counts();
  console.log(`Podsumowanie: ${p} PASS, ${w} WARN, ${f} FAIL`);
}

async function main() {
  const args = parseAuditArgs(process.argv.slice(2));
  const paths = loadBackendEnv();
  const report = new AuditReport();

  report.addSection('Konfiguracja (.env)', auditConfiguration(paths));

  const workflow = auditWorkflowSection();
  report.addSection('Kontrakt workflow', workflow.findings);

  report.addSection('Historia jobów (SQLite)', auditJobHistory(paths.dbPath));
  report.addSection('Pliki output/', auditOutputDir(paths.outputDir));

  if (args.live) {
    report.addSection('Backend live', await auditLiveHealth(paths.port));
  }

  if (args.probeApi) {
    report.addSection('Probe API (pusty POST, bez renderu)', await auditProbeApi());
  }

  if (args.withSmoke) {
    report.addSection('Smoke dry-run', runSmokeDryRun());
  }

  if (args.json) {
    console.log(JSON.stringify({
      generated_at: new Date().toISOString(),
      deployment_id: parseDeploymentId(process.env.RUNCOMFY_ENDPOINT),
      counts: report.counts(),
      sections: report.sections,
    }, null, 2));
  } else {
    printHumanReport(report);
  }

  if (args.bundle) {
    const bundleDir = writeBundle(report, workflow.contract, paths);
    if (!args.json) {
      console.log(`Bundle zapisany: ${bundleDir}`);
      console.log('Wyślij report.txt + wan_workflow_api.json do supportu RunComfy.');
    }
  }

  if (!args.json) {
    console.log('\nNastępny krok (GPU): npm run smoke:runcomfy -- --repeat 2');
    console.log('Docs: docs/RUNCOMFY_DEPLOYMENT.md');
  }

  process.exit(report.exitCode(args.strict));
}

main().catch((err) => {
  console.error('Audit crash:', err);
  process.exit(1);
});
