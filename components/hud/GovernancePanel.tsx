"use client";

import { useEffect, useState } from "react";
import type { AuditEntry, ApprovalRequest } from "@/types/game";
import HudFlyout from "./HudFlyout";

const RISK_COLORS: Record<string, string> = {
  low: "#4caf50",
  medium: "#ffb300",
  high: "#f44336",
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toTimeString().slice(0, 8);
}

function RiskBadge({ level }: { level?: string }) {
  if (!level) return null;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 5px",
        borderRadius: 2,
        fontSize: 7,
        fontWeight: 700,
        background: RISK_COLORS[level] ?? "#888",
        color: "#000",
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      {level}
    </span>
  );
}

function AuditLogTab({ entries }: { entries: AuditEntry[] }) {
  return (
    <div style={{ overflowY: "auto", maxHeight: 300 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
        <thead>
          <tr style={{ color: "var(--pixel-muted)", textTransform: "uppercase", letterSpacing: 1 }}>
            <th style={{ textAlign: "left", padding: "4px 6px", fontWeight: 400 }}>Time</th>
            <th style={{ textAlign: "left", padding: "4px 6px", fontWeight: 400 }}>Actor</th>
            <th style={{ textAlign: "left", padding: "4px 6px", fontWeight: 400 }}>Action</th>
            <th style={{ textAlign: "left", padding: "4px 6px", fontWeight: 400 }}>Target</th>
            <th style={{ textAlign: "left", padding: "4px 6px", fontWeight: 400 }}>Risk</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                style={{ padding: "8px 6px", color: "var(--pixel-muted)", fontSize: 9 }}
              >
                No audit entries.
              </td>
            </tr>
          ) : (
            entries
              .slice()
              .reverse()
              .map((e) => (
                <tr key={e.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <td style={{ padding: "3px 6px", whiteSpace: "nowrap" }}>{formatTime(e.ts)}</td>
                  <td style={{ padding: "3px 6px", color: "var(--pixel-accent)" }}>{e.actor}</td>
                  <td style={{ padding: "3px 6px" }}>{e.action}</td>
                  <td style={{ padding: "3px 6px", color: "var(--pixel-muted)" }}>
                    {e.target ?? "—"}
                  </td>
                  <td style={{ padding: "3px 6px" }}>
                    <RiskBadge level={e.riskLevel} />
                  </td>
                </tr>
              ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ApprovalQueueTab({ requests }: { requests: ApprovalRequest[] }) {
  const pending = requests.filter((r) => r.status === "pending");
  return (
    <div style={{ overflowY: "auto", maxHeight: 300 }}>
      {pending.length === 0 ? (
        <div style={{ padding: "8px 6px", color: "var(--pixel-muted)", fontSize: 9 }}>
          No pending approvals.
        </div>
      ) : (
        pending.map((r) => (
          <div
            key={r.id}
            style={{
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              padding: "6px 4px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 9 }}>
              <span style={{ color: "var(--pixel-accent)" }}>{r.agentId}</span>
              {" → "}
              <span>{r.action}</span>
            </div>
            <div style={{ fontSize: 8, color: "var(--pixel-muted)" }}>{r.detail}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
              <button
                type="button"
                className="pixel-button pixel-button--primary"
                style={{ fontSize: 7, padding: "3px 8px" }}
                onClick={() => console.log("approve", r.id)}
              >
                Approve
              </button>
              <button
                type="button"
                className="pixel-button"
                style={{ fontSize: 7, padding: "3px 8px" }}
                onClick={() => console.log("reject", r.id)}
              >
                Reject
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function GovernancePanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"audit" | "approvals">("audit");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [approvals] = useState<ApprovalRequest[]>([]);

  useEffect(() => {
    async function fetchAudit() {
      try {
        const res = await fetch("/api/internal/audit");
        if (res.ok) {
          const data = await res.json();
          setEntries(data as AuditEntry[]);
        }
      } catch {
        // silently ignore fetch errors
      }
    }

    fetchAudit();
    const interval = setInterval(fetchAudit, 15_000);
    return () => clearInterval(interval);
  }, []);

  const pendingCount = approvals.filter((r) => r.status === "pending").length;

  return (
    <HudFlyout
      title="Governance"
      subtitle="Audit log & approval queue"
      headerAction={
        <button
          type="button"
          className="pixel-button"
          style={{ fontSize: 7, padding: "4px 8px" }}
          onClick={onClose}
        >
          Close
        </button>
      }
    >
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: 8,
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {(["audit", "approvals"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 10px",
              fontSize: 8,
              color: activeTab === tab ? "var(--pixel-accent)" : "var(--pixel-muted)",
              borderBottom:
                activeTab === tab ? "2px solid var(--pixel-accent)" : "2px solid transparent",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {tab === "audit"
              ? "Audit Log"
              : `Approval Queue${pendingCount > 0 ? ` (${pendingCount})` : ""}`}
          </button>
        ))}
      </div>

      {activeTab === "audit" ? (
        <AuditLogTab entries={entries} />
      ) : (
        <ApprovalQueueTab requests={approvals} />
      )}
    </HudFlyout>
  );
}
