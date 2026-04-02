"use client";

import type { Agent, AgentStatus } from "@/types/game";
import { formatRelativeTime } from "@/lib/constants";
import HudFlyout from "./HudFlyout";

const STATUS_COLORS: Record<AgentStatus, { bg: string; color: string }> = {
  idle: { bg: "rgba(34,197,94,0.2)", color: "#4ade80" },
  working: { bg: "rgba(59,130,246,0.2)", color: "#60a5fa" },
  thinking: { bg: "rgba(234,179,8,0.2)", color: "#facc15" },
  blocked: { bg: "rgba(239,68,68,0.2)", color: "#f87171" },
  offline: { bg: "rgba(107,114,128,0.2)", color: "#9ca3af" },
  retiring: { bg: "rgba(249,115,22,0.2)", color: "#fb923c" },
};

function StatusBadge({ status }: { status: AgentStatus }) {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.offline;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 6px",
        borderRadius: 3,
        fontSize: 8,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        background: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.color}44`,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

export default function FleetPanel({
  agents,
  onSelectAgent,
}: {
  agents: Agent[];
  onSelectAgent?: (id: string) => void;
}) {
  const active = agents.filter((a) => a.status !== "offline").length;

  return (
    <HudFlyout title="Fleet" subtitle={`${active}/${agents.length} online`}>
      {agents.length === 0 ? (
        <div className="hud-empty">No agents registered.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 9,
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            <thead>
              <tr
                style={{
                  color: "var(--pixel-muted)",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  fontSize: 7,
                  borderBottom: "1px solid var(--pixel-border)",
                }}
              >
                <th style={{ padding: "4px 6px", textAlign: "left", fontWeight: 500 }}>Av</th>
                <th style={{ padding: "4px 6px", textAlign: "left", fontWeight: 500 }}>Name</th>
                <th style={{ padding: "4px 6px", textAlign: "left", fontWeight: 500 }}>Role</th>
                <th style={{ padding: "4px 6px", textAlign: "left", fontWeight: 500 }}>Status</th>
                <th style={{ padding: "4px 6px", textAlign: "left", fontWeight: 500 }}>
                  Capabilities
                </th>
                <th style={{ padding: "4px 6px", textAlign: "right", fontWeight: 500 }}>Seen</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr
                  key={agent.id}
                  onClick={() => onSelectAgent?.(agent.id)}
                  style={{
                    cursor: onSelectAgent ? "pointer" : "default",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background =
                      "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                  }}
                >
                  <td style={{ padding: "5px 6px", fontSize: 14 }}>{agent.emote ?? "🤖"}</td>
                  <td
                    style={{
                      padding: "5px 6px",
                      color: "var(--pixel-text)",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {agent.name}
                  </td>
                  <td
                    style={{
                      padding: "5px 6px",
                      color: "var(--pixel-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {agent.role}
                  </td>
                  <td style={{ padding: "5px 6px" }}>
                    <StatusBadge status={agent.status} />
                  </td>
                  <td
                    style={{
                      padding: "5px 6px",
                      color: "var(--pixel-accent)",
                      maxWidth: 140,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={agent.capabilities.join(", ")}
                  >
                    {agent.capabilities.join(", ")}
                  </td>
                  <td
                    style={{
                      padding: "5px 6px",
                      color: "var(--pixel-muted)",
                      textAlign: "right",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatRelativeTime(new Date(agent.heartbeatAt).toISOString())}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </HudFlyout>
  );
}
