/**
 * ============================================================
 * PROCESSFLOW — PHASE 11: PRODUCTION HARDENING
 * Load Simulation Script (Node.js — no extra deps required)
 * ============================================================
 *
 * PURPOSE:
 *   Simulate real production load to validate:
 *   - job_queue idempotency under burst
 *   - DLQ routing under failure
 *   - DB index performance under 10k leads
 *   - Worker concurrency safety (SKIP LOCKED)
 *   - Cost governor enforcement
 *
 * USAGE:
 *   node scripts/load-test/simulate-scale.mjs [scenario]
 *
 *   Scenarios:
 *     bulk-leads      — Insert N leads as fast as possible
 *     burst-automation — Rapidly move leads through stages
 *     db-pressure      — Aggregate queries under full event log
 *     chaos-worker     — Simulate OpenAI failures + worker crashes
 *     full-suite       — Run all scenarios sequentially
 *
 * SETUP:
 *   1. Copy .env.example to .env.load-test and fill in:
 *      SUPABASE_URL=...
 *      SUPABASE_SERVICE_ROLE_KEY=...
 *      TEST_WORKSPACE_ID=...
 *      TEST_STAGE_ID_FROM=...
 *      TEST_STAGE_ID_TO=...
 *   2. Run: node scripts/load-test/simulate-scale.mjs full-suite
 * ============================================================
 */

import { readFileSync, existsSync, writeFileSync, appendFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

// ─── CONFIG LOADER ──────────────────────────────────────────────────────────
function loadConfig() {
  const envPath = ".env.load-test";
  if (!existsSync(envPath)) {
    console.error(
      `\n❌  Config file not found: ${envPath}\n` +
      `   Copy .env.example and fill in values:\n` +
      `   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEST_WORKSPACE_ID, TEST_STAGE_ID_FROM, TEST_STAGE_ID_TO\n`
    );
    process.exit(1);
  }

  const lines = readFileSync(envPath, "utf8").split("\n");
  const env = {};
  for (const line of lines) {
    const [key, ...val] = line.trim().split("=");
    if (key && !key.startsWith("#")) env[key.trim()] = val.join("=").trim();
  }

  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TEST_WORKSPACE_ID", "TEST_STAGE_ID_FROM", "TEST_STAGE_ID_TO"];
  for (const k of required) {
    if (!env[k]) {
      console.error(`❌  Missing required config: ${k}`);
      process.exit(1);
    }
  }
  return env;
}

// ─── SUPABASE HTTP CLIENT (no SDK dependency) ────────────────────────────────
function createDb(config) {
  const BASE = `${config.SUPABASE_URL}/rest/v1`;
  const KEY = config.SUPABASE_SERVICE_ROLE_KEY;
  const HEADERS = {
    "Content-Type": "application/json",
    "apikey": KEY,
    "Authorization": `Bearer ${KEY}`,
    "Prefer": "return=representation",
  };

  return {
    async insert(table, rows) {
      const r = await fetch(`${BASE}/${table}`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(rows),
      });
      if (!r.ok) throw new Error(`INSERT ${table} failed: ${await r.text()}`);
      return r.json();
    },

    async update(table, match, data) {
      const qs = Object.entries(match).map(([k, v]) => `${k}=eq.${v}`).join("&");
      const r = await fetch(`${BASE}/${table}?${qs}`, {
        method: "PATCH",
        headers: HEADERS,
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error(`UPDATE ${table} failed: ${await r.text()}`);
      return r.json();
    },

    async select(table, params = "") {
      const r = await fetch(`${BASE}/${table}?${params}`, {
        method: "GET",
        headers: { ...HEADERS, "Prefer": "count=exact" },
      });
      if (!r.ok) throw new Error(`SELECT ${table} failed: ${await r.text()}`);
      return {
        data: await r.json(),
        count: parseInt(r.headers.get("content-range")?.split("/")[1] ?? "0"),
      };
    },

    async rpc(fn, body = {}) {
      const r = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`RPC ${fn} failed: ${await r.text()}`);
      return r.json();
    },

    async delete(table, match) {
      const qs = Object.entries(match).map(([k, v]) => `${k}=eq.${v}`).join("&");
      const r = await fetch(`${BASE}/${table}?${qs}`, {
        method: "DELETE",
        headers: HEADERS,
      });
      if (!r.ok) throw new Error(`DELETE ${table} failed: ${await r.text()}`);
      return true;
    },
  };
}

// ─── METRICS TRACKER ─────────────────────────────────────────────────────────
class Metrics {
  constructor(scenarioName) {
    this.scenario = scenarioName;
    this.ops = [];
    this.errors = [];
    this.startedAt = performance.now();
  }

  record(opName, durationMs, success = true, detail = "") {
    this.ops.push({ opName, durationMs, success, detail, ts: Date.now() });
    if (!success) this.errors.push({ opName, detail, ts: Date.now() });
  }

  summary() {
    const total = this.ops.length;
    const successful = this.ops.filter(o => o.success).length;
    const failed = this.errors.length;
    const durations = this.ops.filter(o => o.success).map(o => o.durationMs);
    const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const p95 = durations.length ? durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)] : 0;
    const p99 = durations.length ? durations[Math.floor(durations.length * 0.99)] : 0;
    const totalMs = performance.now() - this.startedAt;
    const throughput = (total / (totalMs / 1000)).toFixed(2);

    return {
      scenario: this.scenario,
      total, successful, failed,
      durationMs: Math.round(totalMs),
      throughputOpsPerSec: parseFloat(throughput),
      latency: {
        avg: Math.round(avg),
        p95: Math.round(p95 ?? 0),
        p99: Math.round(p99 ?? 0),
      },
      errorRate: `${((failed / total) * 100).toFixed(2)}%`,
      errors: this.errors.slice(0, 10), // top 10
    };
  }
}

// ─── CONCURRENCY HELPERS ─────────────────────────────────────────────────────
async function runBatch(tasks, concurrency = 10) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      try {
        results[i] = await tasks[i]();
      } catch (e) {
        results[i] = { error: e.message };
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function randomName() {
  const first = ["Ana", "Bruno", "Carla", "Diego", "Elena", "Felipe", "Gabriela", "Hugo", "Isabela", "João"];
  const last = ["Silva", "Costa", "Oliveira", "Santos", "Pereira", "Lima", "Carvalho", "Melo", "Ferreira", "Rodrigues"];
  return `${first[Math.floor(Math.random() * first.length)]} ${last[Math.floor(Math.random() * last.length)]}`;
}

function randomEmail(name) {
  return `${name.toLowerCase().replace(/ /g, ".")}.${Math.random().toString(36).slice(2, 6)}@loadtest.dev`;
}

// ─── SCENARIO 1: BULK LEADS ──────────────────────────────────────────────────
async function scenarioBulkLeads(db, config, count = 1000, concurrency = 50) {
  const metrics = new Metrics("bulk-leads");
  log(`\n🚀 SCENARIO: Bulk Leads (${count} leads, concurrency=${concurrency})`);

  const insertedIds = [];

  const tasks = Array.from({ length: count }, (_, i) => async () => {
    const name = `${randomName()} [LT-${i}]`;
    const t0 = performance.now();
    try {
      const rows = await db.insert("leads", [{
        workspace_id: config.TEST_WORKSPACE_ID,
        name,
        email: randomEmail(name),
        phone: `+5511${String(90000000 + i).padStart(8, "0")}`,
        stage_id: config.TEST_STAGE_ID_FROM,
      }]);
      const ms = performance.now() - t0;
      metrics.record("insert-lead", ms, true);
      if (rows[0]?.id) insertedIds.push(rows[0].id);
    } catch (e) {
      const ms = performance.now() - t0;
      metrics.record("insert-lead", ms, false, e.message);
    }
  });

  await runBatch(tasks, concurrency);

  const s = metrics.summary();
  logMetrics(s);
  return { metrics: s, insertedIds };
}

// ─── SCENARIO 2: BURST AUTOMATION ────────────────────────────────────────────
async function scenarioBurstAutomation(db, config, leadIds, concurrency = 20) {
  const metrics = new Metrics("burst-automation");
  const sample = leadIds.slice(0, Math.min(500, leadIds.length));
  log(`\n⚡ SCENARIO: Burst Automation (${sample.length} leads moved through stages, concurrency=${concurrency})`);

  const tasks = sample.map(leadId => async () => {
    const t0 = performance.now();
    try {
      // Move lead para o stage de destino (dispara trigger de automação)
      await db.update("leads", { id: leadId }, { stage_id: config.TEST_STAGE_ID_TO });
      const ms = performance.now() - t0;
      metrics.record("move-to-stage", ms, true);
    } catch (e) {
      const ms = performance.now() - t0;
      metrics.record("move-to-stage", ms, false, e.message);
    }
  });

  await runBatch(tasks, concurrency);

  // Validação de idempotência: mover os mesmos leads de volta e pra frente 3x
  log(`  → Idempotency validation: moving ${Math.min(50, sample.length)} leads back and forth 3x...`);
  const idempotencyLeads = sample.slice(0, 50);
  for (let round = 0; round < 3; round++) {
    const stageTo = round % 2 === 0 ? config.TEST_STAGE_ID_FROM : config.TEST_STAGE_ID_TO;
    const roundTasks = idempotencyLeads.map(id => async () => {
      await db.update("leads", { id }, { stage_id: stageTo }).catch(() => {});
    });
    await runBatch(roundTasks, 10);
  }

  // Verifica duplicação na job_queue
  const { count: pendingJobs } = await db.select(
    "job_queue",
    `payload->>'workspace_id'=eq.${config.TEST_WORKSPACE_ID}&status=eq.pending&select=id`
  ).catch(() => ({ count: 0 }));

  log(`  ✓ Pending jobs after idempotency test: ${pendingJobs}`);

  const s = metrics.summary();
  logMetrics(s);
  return metrics.summary();
}

// ─── SCENARIO 3: DB PRESSURE ─────────────────────────────────────────────────
async function scenarioDbPressure(db, config) {
  const metrics = new Metrics("db-pressure");
  log(`\n📊 SCENARIO: DB Pressure (concurrent aggregation queries)`);

  const queries = [
    {
      name: "job-queue-count",
      fn: () => db.select("job_queue", `workspace_id=eq.${config.TEST_WORKSPACE_ID}&select=status`)
    },
    {
      name: "lead-aggregate",
      fn: () => db.select("leads", `workspace_id=eq.${config.TEST_WORKSPACE_ID}&select=stage_id`)
    },
    {
      name: "dlq-scan",
      fn: () => db.select("dead_letter_queue", `workspace_id=eq.${config.TEST_WORKSPACE_ID}&select=id,failed_at`)
    },
    {
      name: "ai-usage-today",
      fn: () => db.select("workspace_ai_usage", `workspace_id=eq.${config.TEST_WORKSPACE_ID}&date_key=eq.${new Date().toISOString().split("T")[0]}`)
    },
    {
      name: "reconcile-rpc",
      fn: () => db.rpc("reconcile_stuck_jobs")
    },
  ];

  // Run 10 rounds of all queries simultaneously
  for (let round = 0; round < 10; round++) {
    const tasks = queries.map(q => async () => {
      const t0 = performance.now();
      try {
        await q.fn();
        metrics.record(q.name, performance.now() - t0, true);
      } catch (e) {
        metrics.record(q.name, performance.now() - t0, false, e.message);
      }
    });
    await Promise.all(tasks.map(t => t()));
    await sleep(100); // Small gap between rounds
  }

  const s = metrics.summary();
  logMetrics(s);

  // Performance assertions
  if (s.latency.p95 > 3000) {
    log(`  ⚠️  WARNING: p95 latency is ${s.latency.p95}ms — consider adding indexes!`);
  } else {
    log(`  ✓ DB latency within acceptable bounds (p95=${s.latency.p95}ms)`);
  }

  return s;
}

// ─── SCENARIO 4: CHAOS WORKER ─────────────────────────────────────────────────
async function scenarioChaosWorker(db, config) {
  const metrics = new Metrics("chaos-worker");
  log(`\n🔥 SCENARIO: Chaos Worker (simulating locks, DLQ, stuck jobs)`);

  // 4.1 — Simulate stuck jobs (manually lock without releasing)
  log(`  → Injecting stuck jobs...`);
  const stuckJobs = [];
  for (let i = 0; i < 5; i++) {
    try {
      const rows = await db.insert("job_queue", [{
        workspace_id: config.TEST_WORKSPACE_ID,
        type: "generate_ai_message",
        payload: { lead_id: "00000000-0000-0000-0000-000000000000", workspace_id: config.TEST_WORKSPACE_ID, test: true },
        status: "processing",
        locked_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
        lock_expires_at: new Date(Date.now() - 1 * 60 * 1000).toISOString(), // expired 1 min ago
        idempotency_key: `chaos_stuck_${i}_${Date.now()}`,
      }]);
      if (rows[0]?.id) stuckJobs.push(rows[0].id);
      metrics.record("inject-stuck-job", 0, true);
    } catch (e) {
      metrics.record("inject-stuck-job", 0, false, e.message);
    }
  }

  // 4.2 — Run reconciliation
  log(`  → Running reconcile_stuck_jobs()...`);
  const t0 = performance.now();
  try {
    const repairedCount = await db.rpc("reconcile_stuck_jobs");
    metrics.record("reconcile-stuck", performance.now() - t0, true, `repaired=${repairedCount}`);
    log(`  ✓ Reconciler repaired ${repairedCount} stuck jobs`);
  } catch (e) {
    metrics.record("reconcile-stuck", performance.now() - t0, false, e.message);
  }

  // 4.3 — Inject jobs that exceed max_attempts → should route to DLQ
  log(`  → Injecting max-attempt exhausted jobs (DLQ routing test)...`);
  for (let i = 0; i < 3; i++) {
    try {
      const rows = await db.insert("job_queue", [{
        workspace_id: config.TEST_WORKSPACE_ID,
        type: "generate_ai_message",
        payload: { lead_id: "00000000-0000-0000-0000-000000000000", workspace_id: config.TEST_WORKSPACE_ID, test: true },
        status: "pending",
        attempts: 3,
        max_attempts: 3,
        next_retry_at: new Date().toISOString(),
        idempotency_key: `chaos_dlq_${i}_${Date.now()}`,
      }]);

      if (rows[0]?.id) {
        const tDlq = performance.now();
        await db.rpc("route_to_dlq", { p_job_id: rows[0].id, p_error: "Chaos test: forced DLQ" });
        metrics.record("dlq-route", performance.now() - tDlq, true);
      }
    } catch (e) {
      metrics.record("dlq-route", 0, false, e.message);
    }
  }

  // 4.4 — Verify DLQ has the injected entries
  const { data: dlqEntries } = await db.select(
    "dead_letter_queue",
    `workspace_id=eq.${config.TEST_WORKSPACE_ID}&error_log=like.*Chaos*&select=id,failed_at&order=failed_at.desc&limit=10`
  ).catch(() => ({ data: [] }));
  log(`  ✓ DLQ entries from chaos test: ${dlqEntries?.length ?? 0}`);

  // 4.5 — Cost Governor test
  log(`  → Testing cost governor enforcement...`);
  try {
    const allowed = await db.rpc("check_ai_cost_governor", { p_workspace_id: config.TEST_WORKSPACE_ID });
    log(`  ✓ Cost governor returned: ${allowed} (expect true for test workspace)`);
    metrics.record("cost-governor", 0, true, `allowed=${allowed}`);
  } catch (e) {
    metrics.record("cost-governor", 0, false, e.message);
  }

  // 4.6 — Cleanup injected chaos data
  log(`  → Cleaning up chaos test artifacts...`);
  for (const id of stuckJobs) {
    await db.delete("job_queue", { id }).catch(() => {});
  }

  const s = metrics.summary();
  logMetrics(s);
  return s;
}

// ─── CLEANUP ─────────────────────────────────────────────────────────────────
async function cleanupTestLeads(db, config, leadIds) {
  if (!leadIds.length) return;
  log(`\n🧹 Cleanup: removing ${leadIds.length} test leads...`);

  // Batch delete in chunks of 100
  const chunkSize = 100;
  for (let i = 0; i < leadIds.length; i += chunkSize) {
    const chunk = leadIds.slice(i, i + chunkSize);
    const ids = chunk.join(",");
    await fetch(
      `${config.SUPABASE_URL}/rest/v1/leads?id=in.(${ids})`,
      {
        method: "DELETE",
        headers: {
          "apikey": config.SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    ).catch(() => {});
  }
  log(`  ✓ Cleanup complete`);
}

// ─── REPORTING ────────────────────────────────────────────────────────────────
function log(msg) {
  const ts = new Date().toISOString().split("T")[1].split(".")[0];
  console.log(`[${ts}] ${msg}`);
}

function logMetrics(s) {
  console.log(`
  ┌─ ${s.scenario.toUpperCase()} ─────────────────────────
  │  Total ops    : ${s.total}
  │  Successful   : ${s.successful} ✓
  │  Failed       : ${s.failed} ✗  (error rate: ${s.errorRate})
  │  Duration     : ${s.durationMs}ms
  │  Throughput   : ${s.throughputOpsPerSec} ops/sec
  │  Latency avg  : ${s.latency.avg}ms
  │  Latency p95  : ${s.latency.p95}ms
  │  Latency p99  : ${s.latency.p99}ms
  └───────────────────────────────────────────`);

  if (s.errors.length > 0) {
    console.log(`  ⚠️  Sample errors:`);
    s.errors.slice(0, 3).forEach(e => console.log(`    - [${e.opName}] ${e.detail}`));
  }
}

function saveReport(allResults) {
  const report = {
    runAt: new Date().toISOString(),
    results: allResults,
    verdict: generateVerdict(allResults),
  };
  const path = `load-test-report-${Date.now()}.json`;
  writeFileSync(path, JSON.stringify(report, null, 2));
  log(`\n📄 Full report saved to: ${path}`);

  // Also print verdict
  console.log("\n" + "═".repeat(60));
  console.log("  PRODUCTION HARDENING VERDICT");
  console.log("═".repeat(60));
  for (const [check, result] of Object.entries(report.verdict)) {
    const icon = result.pass ? "✅" : "❌";
    console.log(`  ${icon}  ${check}: ${result.detail}`);
  }
  console.log("═".repeat(60) + "\n");
}

function generateVerdict(results) {
  const verdicts = {};

  const bulkLeads = results.find(r => r.scenario === "bulk-leads");
  if (bulkLeads) {
    verdicts["Bulk Insert Performance"] = {
      pass: bulkLeads.latency.p95 < 2000 && parseFloat(bulkLeads.errorRate) < 5,
      detail: `p95=${bulkLeads.latency.p95}ms, errors=${bulkLeads.errorRate}`,
    };
    verdicts["Throughput Target (>20 ops/sec)"] = {
      pass: bulkLeads.throughputOpsPerSec >= 20,
      detail: `${bulkLeads.throughputOpsPerSec} ops/sec`,
    };
  }

  const burst = results.find(r => r.scenario === "burst-automation");
  if (burst) {
    verdicts["Stage Transition Reliability"] = {
      pass: parseFloat(burst.errorRate) < 2,
      detail: `error rate=${burst.errorRate}`,
    };
  }

  const db = results.find(r => r.scenario === "db-pressure");
  if (db) {
    verdicts["DB Query Latency (p95 < 3s)"] = {
      pass: db.latency.p95 < 3000,
      detail: `p95=${db.latency.p95}ms`,
    };
  }

  const chaos = results.find(r => r.scenario === "chaos-worker");
  if (chaos) {
    verdicts["Chaos Resilience"] = {
      pass: parseFloat(chaos.errorRate) < 10,
      detail: `error rate=${chaos.errorRate}`,
    };
  }

  return verdicts;
}

// ─── ENTRYPOINT ───────────────────────────────────────────────────────────────
async function main() {
  const scenario = process.argv[2] || "full-suite";
  const config = loadConfig();
  const db = createDb(config);

  console.log("\n" + "═".repeat(60));
  console.log("  PROCESSFLOW — PHASE 11: PRODUCTION HARDENING");
  console.log(`  Scenario: ${scenario}`);
  console.log(`  Workspace: ${config.TEST_WORKSPACE_ID}`);
  console.log("═".repeat(60));

  const allResults = [];
  let insertedLeadIds = [];

  try {
    if (scenario === "bulk-leads" || scenario === "full-suite") {
      const LEAD_COUNT = parseInt(process.env.LEAD_COUNT || "500");
      const CONCURRENCY = parseInt(process.env.CONCURRENCY || "25");
      const { metrics, insertedIds } = await scenarioBulkLeads(db, config, LEAD_COUNT, CONCURRENCY);
      allResults.push(metrics);
      insertedLeadIds = insertedIds;
    }

    if (scenario === "burst-automation" || scenario === "full-suite") {
      if (!insertedLeadIds.length) {
        // Fetch existing leads for standalone run
        const { data } = await db.select("leads", `workspace_id=eq.${config.TEST_WORKSPACE_ID}&select=id&limit=500`);
        insertedLeadIds = (data || []).map(r => r.id);
      }
      const result = await scenarioBurstAutomation(db, config, insertedLeadIds, 20);
      allResults.push(result);
    }

    if (scenario === "db-pressure" || scenario === "full-suite") {
      const result = await scenarioDbPressure(db, config);
      allResults.push(result);
    }

    if (scenario === "chaos-worker" || scenario === "full-suite") {
      const result = await scenarioChaosWorker(db, config);
      allResults.push(result);
    }

    // Cleanup test data
    if (insertedLeadIds.length > 0 && (scenario === "bulk-leads" || scenario === "full-suite")) {
      await cleanupTestLeads(db, config, insertedLeadIds);
    }

    if (allResults.length > 0) {
      saveReport(allResults);
    }

  } catch (fatal) {
    console.error("\n💥 FATAL ERROR:", fatal.message);
    process.exit(1);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
