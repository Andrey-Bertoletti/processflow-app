"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface SystemHealth {
  status: "healthy" | "degraded" | "critical";
  snapshot_at: string;
  queue: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    zombie: number;
  };
  latency: {
    avg_ms: number;
    p95_ms: number;
  };
  throughput: {
    jobs_per_min: number;
    last_5m: number;
    last_15m: number;
    last_60m: number;
  };
  reliability: {
    success_rate_1h_pct: number;
    retry_rate_pct: number;
    retried_jobs: number;
  };
  dlq: {
    total: number;
    last_1h: number;
    last_24h: number;
    breakdown: Record<string, number>;
  };
  cost: {
    total_tokens_today: number;
    total_ai_jobs_today: number;
    active_workspaces: number;
    estimated_usd_today: number;
  };
  top_workspaces: Array<{
    workspace_name: string;
    jobs_processed: number;
    estimated_cost_usd: number;
    quota_usage_pct: number;
    is_suspended: boolean;
  }>;
  alerts: Array<{ level: "info" | "warning" | "critical"; message: string }>;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 0) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

function fmtMs(ms: number | null | undefined) {
  if (ms == null || ms === 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function timeAgo(isoTs: string) {
  const secs = Math.floor((Date.now() - new Date(isoTs).getTime()) / 1000);
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SystemHealth["status"] }) {
  const cfg = {
    healthy: {
      bg: "rgba(34, 197, 94, 0.15)",
      color: "#22c55e",
      dot: "#22c55e",
      label: "HEALTHY",
    },
    degraded: {
      bg: "rgba(245, 158, 11, 0.15)",
      color: "#f59e0b",
      dot: "#f59e0b",
      label: "DEGRADED",
    },
    critical: {
      bg: "rgba(239, 68, 68, 0.15)",
      color: "#ef4444",
      dot: "#ef4444",
      label: "CRITICAL",
    },
  }[status];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 12px",
        borderRadius: "100px",
        background: cfg.bg,
        color: cfg.color,
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.08em",
        fontFamily: "monospace",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: cfg.dot,
          boxShadow: `0 0 6px ${cfg.dot}`,
          animation: status !== "healthy" ? "pulse 1.5s infinite" : undefined,
        }}
      />
      {cfg.label}
    </span>
  );
}

// ─── METRIC CARD ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  color,
  icon,
  large,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon: string;
  large?: boolean;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "16px",
        padding: large ? "24px" : "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {label}
        </span>
        <span style={{ fontSize: large ? 22 : 18 }}>{icon}</span>
      </div>
      <div
        style={{
          fontSize: large ? "32px" : "24px",
          fontWeight: 800,
          color: color || "#fff",
          fontFamily: "monospace",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{sub}</div>
      )}
    </div>
  );
}

// ─── QUEUE BAR ────────────────────────────────────────────────────────────────

function QueueBar({ queue }: { queue: SystemHealth["queue"] }) {
  const total = queue.pending + queue.processing + queue.completed + queue.failed;
  if (total === 0) return null;
  const pct = (n: number) => ((n / total) * 100).toFixed(1);

  const segments = [
    { key: "completed", color: "#22c55e", label: "Completed" },
    { key: "processing", color: "#3b82f6", label: "Processing" },
    { key: "pending", color: "#f59e0b", label: "Pending" },
    { key: "failed", color: "#ef4444", label: "Failed" },
  ] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", height: "10px", borderRadius: "6px", overflow: "hidden", gap: "2px" }}>
        {segments.map(({ key, color }) =>
          queue[key] > 0 ? (
            <div
              key={key}
              title={`${key}: ${queue[key]} (${pct(queue[key])}%)`}
              style={{
                background: color,
                width: `${pct(queue[key])}%`,
                minWidth: 2,
                borderRadius: "3px",
                transition: "width 0.6s ease",
              }}
            />
          ) : null
        )}
      </div>
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        {segments.map(({ key, color, label }) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
            {label}: <strong style={{ color: "#fff" }}>{queue[key]}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ALERT BANNER ────────────────────────────────────────────────────────────

function AlertBanner({ alert }: { alert: { level: string; message: string } }) {
  const cfg = {
    info: { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)", icon: "ℹ️" },
    warning: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", icon: "⚠️" },
    critical: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.4)", icon: "🚨" },
  }[alert.level] ?? { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)", icon: "•" };

  return (
    <div
      style={{
        padding: "10px 16px",
        borderRadius: "10px",
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        fontSize: 13,
        color: "rgba(255,255,255,0.85)",
        display: "flex",
        gap: "10px",
        alignItems: "flex-start",
      }}
    >
      <span style={{ flexShrink: 0 }}>{cfg.icon}</span>
      <span>{alert.message}</span>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealth = useCallback(async () => {
    try {
      const { data, error } = await (supabase.rpc as any)("get_system_health_snapshot");
      if (error) throw error;
      setHealth(data as SystemHealth);
      setLastRefreshed(new Date());
      setError(null);
    } catch (e: any) {
      const raw = e?.message || "Failed to fetch health data";
      const isPermission =
        /permission denied/i.test(raw) ||
        /not authorized/i.test(raw) ||
        String(e?.code || "").toLowerCase() === "42501";

      if (isPermission) {
        setAutoRefresh(false);
      }

      setError(
        isPermission
          ? "Acesso restrito: este painel é ops-only e o RPC foi bloqueado para usuários autenticados. Use as telas de Admin do Workspace em /admin."
          : raw,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchHealth, 10_000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchHealth]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #090d17; font-family: 'Inter', sans-serif; color: #fff; }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #090d17 0%, #0d1526 50%, #090d17 100%)",
          padding: "32px",
          animation: "fadeIn 0.4s ease",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
              <span style={{ fontSize: 28 }}>🛡️</span>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>System Health</h1>
              {health && <StatusBadge status={health.status} />}
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
              Real-time observability &bull; ProcessFlow Platform
              {lastRefreshed && ` · Updated ${timeAgo(lastRefreshed.toISOString())}`}
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: 13, color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
                style={{ accentColor: "#6366f1" }}
              />
              Auto-refresh (10s)
            </label>
            <button
              id="btn-refresh-health"
              onClick={fetchHealth}
              style={{
                padding: "8px 16px",
                borderRadius: "10px",
                background: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(99,102,241,0.3)",
                color: "#6366f1",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px" }}>
            <div style={{ width: 40, height: 40, border: "3px solid rgba(99,102,241,0.2)", borderTop: "3px solid #6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{ padding: "20px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "12px", color: "#f87171", fontSize: 14 }}>
            ❌ {error}
            <br />
            <small style={{ color: "rgba(255,255,255,0.4)" }}>Make sure the migration 20260505500000_system_health_observability.sql has been applied and you have admin access.</small>
          </div>
        )}

        {health && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

            {/* Alerts */}
            {health.alerts.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {health.alerts.map((a, i) => <AlertBanner key={i} alert={a} />)}
              </div>
            )}

            {/* Top-level KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px" }}>
              <MetricCard
                icon="⚡"
                label="Throughput"
                value={`${fmt(health.throughput.jobs_per_min, 1)}/min`}
                sub={`${fmt(health.throughput.last_60m)} jobs last 60m`}
                color="#6366f1"
                large
              />
              <MetricCard
                icon="✅"
                label="Success Rate (1h)"
                value={health.reliability.success_rate_1h_pct != null ? `${fmt(health.reliability.success_rate_1h_pct, 1)}%` : "—"}
                sub={`${fmt(health.queue.completed)} completed`}
                color={health.reliability.success_rate_1h_pct >= 95 ? "#22c55e" : health.reliability.success_rate_1h_pct >= 80 ? "#f59e0b" : "#ef4444"}
              />
              <MetricCard
                icon="⏱️"
                label="Avg Job Latency"
                value={fmtMs(health.latency.avg_ms)}
                sub={`p95: ${fmtMs(health.latency.p95_ms)}`}
                color={health.latency.p95_ms < 5000 ? "#22c55e" : "#f59e0b"}
              />
              <MetricCard
                icon="🔁"
                label="Retry Rate"
                value={health.reliability.retry_rate_pct != null ? `${fmt(health.reliability.retry_rate_pct, 1)}%` : "—"}
                sub={`${fmt(health.reliability.retried_jobs)} retried`}
                color={health.reliability.retry_rate_pct <= 10 ? "#22c55e" : "#f59e0b"}
              />
              <MetricCard
                icon="💀"
                label="DLQ (24h)"
                value={fmt(health.dlq.last_24h)}
                sub={`${fmt(health.dlq.total)} total`}
                color={health.dlq.last_24h === 0 ? "#22c55e" : health.dlq.last_24h <= 5 ? "#f59e0b" : "#ef4444"}
              />
              <MetricCard
                icon="👻"
                label="Zombie Jobs"
                value={fmt(health.queue.zombie)}
                sub="lock expired, not released"
                color={health.queue.zombie === 0 ? "#22c55e" : "#ef4444"}
              />
              <MetricCard
                icon="💰"
                label="AI Cost Today"
                value={`$${fmt(health.cost.estimated_usd_today, 4)}`}
                sub={`${fmt(health.cost.total_tokens_today)} tokens · ${fmt(health.cost.total_ai_jobs_today)} jobs`}
                color="#a78bfa"
              />
              <MetricCard
                icon="🏢"
                label="Active Workspaces"
                value={fmt(health.cost.active_workspaces)}
                sub="with AI usage today"
                color="#38bdf8"
              />
            </div>

            {/* Queue Breakdown */}
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "16px",
                padding: "24px",
              }}
            >
              <div style={{ marginBottom: "16px" }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: "4px" }}>Job Queue</h2>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Last 24 hours · Total: {fmt(health.queue.pending + health.queue.processing + health.queue.completed + health.queue.failed)}</p>
              </div>
              <QueueBar queue={health.queue} />
            </div>

            {/* Two-column: DLQ breakdown + Top workspaces */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

              {/* DLQ Breakdown */}
              <div
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "16px",
                  padding: "24px",
                }}
              >
                <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: "16px" }}>Dead Letter Queue</h2>
                <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
                  {[
                    { label: "Last 1h", value: health.dlq.last_1h, color: health.dlq.last_1h > 5 ? "#ef4444" : "#22c55e" },
                    { label: "Last 24h", value: health.dlq.last_24h, color: "#f59e0b" },
                    { label: "All time", value: health.dlq.total, color: "rgba(255,255,255,0.5)" },
                  ].map(m => (
                    <div key={m.label} style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: m.color, fontFamily: "monospace" }}>{fmt(m.value)}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{m.label}</div>
                    </div>
                  ))}
                </div>
                {health.dlq.breakdown && Object.keys(health.dlq.breakdown).length > 0 && (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "14px" }}>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>By error type (24h)</p>
                    {Object.entries(health.dlq.breakdown).map(([cat, count]) => (
                      <div key={cat} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <span style={{ color: "rgba(255,255,255,0.6)", fontFamily: "monospace", fontSize: 12 }}>{cat}</span>
                        <span style={{ fontWeight: 700 }}>{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Workspaces */}
              <div
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "16px",
                  padding: "24px",
                  overflowX: "auto",
                }}
              >
                <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: "16px" }}>Top Workspaces Today</h2>
                {health.top_workspaces.length === 0 ? (
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>No AI activity today.</p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        {["Workspace", "Jobs", "Cost", "Quota %", "Status"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "4px 8px", fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {health.top_workspaces.map((ws, i) => (
                        <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                          <td style={{ padding: "8px", color: "rgba(255,255,255,0.85)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ws.workspace_name}</td>
                          <td style={{ padding: "8px", fontFamily: "monospace", fontWeight: 700 }}>{fmt(ws.jobs_processed)}</td>
                          <td style={{ padding: "8px", fontFamily: "monospace", color: "#a78bfa" }}>${fmt(ws.estimated_cost_usd, 4)}</td>
                          <td style={{ padding: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden", minWidth: 40 }}>
                                <div style={{ height: "100%", width: `${Math.min(ws.quota_usage_pct, 100)}%`, background: ws.quota_usage_pct > 90 ? "#ef4444" : ws.quota_usage_pct > 70 ? "#f59e0b" : "#22c55e", borderRadius: 2 }} />
                              </div>
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{fmt(ws.quota_usage_pct, 0)}%</span>
                            </div>
                          </td>
                          <td style={{ padding: "8px" }}>
                            {ws.is_suspended
                              ? <span style={{ color: "#ef4444", fontWeight: 700, fontSize: 11 }}>SUSPENDED</span>
                              : <span style={{ color: "#22c55e", fontSize: 11 }}>active</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Footer */}
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center", paddingTop: "8px" }}>
              ProcessFlow Ops Dashboard · Powered by <code>get_system_health_snapshot()</code> · Snapshot: {health.snapshot_at ? timeAgo(health.snapshot_at) : "—"}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
