"use client";

import { useEffect, useState } from "react";
import { gameEvents } from "@/lib/events";
import { usageTracker, type AgentUsage } from "@/lib/usage-tracker";
import HudFlyout from "./HudFlyout";

interface UsagePanelProps {
  agentId?: string;
}

function pressureBarColor(pressurePct: number): string {
  if (pressurePct > 85) return "#ef4444";
  if (pressurePct > 60) return "#facc15";
  return "#4ade80";
}

function riskBadgeStyle(riskLevel: AgentUsage["riskLevel"]): React.CSSProperties {
  const colors: Record<AgentUsage["riskLevel"], string> = {
    low: "#4ade80",
    medium: "#facc15",
    high: "#ef4444",
  };
  return {
    display: "inline-block",
    padding: "1px 5px",
    fontSize: 7,
    color: "#0d0d0d",
    background: colors[riskLevel],
    borderRadius: 2,
    textTransform: "uppercase",
    letterSpacing: 1,
  };
}

function PressureBar({ pressurePct }: { pressurePct: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: 6,
        background: "var(--pixel-bg2, #1a1a2e)",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.min(pressurePct, 100)}%`,
          height: "100%",
          background: pressureBarColor(pressurePct),
          transition: "width 0.4s ease, background 0.4s ease",
        }}
      />
    </div>
  );
}

function TeamOverview({ entries }: { entries: AgentUsage[] }) {
  const totals = usageTracker.getTeamTotals();

  if (entries.length === 0) {
    return (
      <div style={{ fontSize: 8, color: "var(--pixel-muted)", padding: "8px 0" }}>
        No usage data yet
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 70px 56px 60px 40px",
          gap: "0 6px",
          fontSize: 7,
          color: "var(--pixel-muted)",
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 4,
          paddingBottom: 4,
          borderBottom: "1px solid var(--pixel-border, #2a2a3e)",
        }}
      >
        <span>Agent</span>
        <span style={{ textAlign: "right" }}>Tokens</span>
        <span style={{ textAlign: "right" }}>Cost</span>
        <span>Context</span>
        <span>Risk</span>
      </div>
      {entries.map((entry) => {
        const totalTokens = entry.totalPromptTokens + entry.totalCompletionTokens;
        return (
          <div
            key={entry.agentId}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 70px 56px 60px 40px",
              gap: "0 6px",
              alignItems: "center",
              fontSize: 8,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                color: "var(--pixel-fg, #e0e0e0)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {entry.agentId}
            </span>
            <span style={{ textAlign: "right", color: "var(--pixel-accent, #7dd3fc)" }}>
              {totalTokens.toLocaleString()}
            </span>
            <span style={{ textAlign: "right", color: "var(--pixel-fg, #e0e0e0)" }}>
              ${entry.totalCostUsd.toFixed(4)}
            </span>
            <div>
              <PressureBar pressurePct={entry.pressurePct} />
              <span style={{ fontSize: 6, color: "var(--pixel-muted)" }}>
                {entry.pressurePct.toFixed(0)}%
              </span>
            </div>
            <span style={riskBadgeStyle(entry.riskLevel)}>{entry.riskLevel}</span>
          </div>
        );
      })}
      <div
        style={{
          borderTop: "1px solid var(--pixel-border, #2a2a3e)",
          paddingTop: 6,
          marginTop: 2,
          fontSize: 7,
          color: "var(--pixel-muted)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>Total tokens: {totals.totalTokens.toLocaleString()}</span>
        <span>Total cost: ${totals.totalCostUsd.toFixed(4)}</span>
      </div>
    </>
  );
}

function AgentDetail({ usage }: { usage: AgentUsage }) {
  return (
    <div style={{ fontSize: 8 }}>
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            fontSize: 7,
            color: "var(--pixel-muted)",
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 4,
          }}
        >
          Context Pressure
        </div>
        <PressureBar pressurePct={usage.pressurePct} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 7,
            color: "var(--pixel-muted)",
            marginTop: 2,
          }}
        >
          <span>{usage.pressurePct.toFixed(1)}% used</span>
          <span>
            {usage.contextUsed.toLocaleString()} / {usage.contextMax.toLocaleString()} tokens
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 7,
              color: "var(--pixel-muted)",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 2,
            }}
          >
            Prompt tokens
          </div>
          <div style={{ color: "var(--pixel-accent, #7dd3fc)" }}>
            {usage.totalPromptTokens.toLocaleString()}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 7,
              color: "var(--pixel-muted)",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 2,
            }}
          >
            Completion tokens
          </div>
          <div style={{ color: "var(--pixel-accent, #7dd3fc)" }}>
            {usage.totalCompletionTokens.toLocaleString()}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 7,
              color: "var(--pixel-muted)",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 2,
            }}
          >
            Total cost
          </div>
          <div style={{ color: "var(--pixel-fg, #e0e0e0)" }}>${usage.totalCostUsd.toFixed(4)}</div>
        </div>
        <div>
          <div
            style={{
              fontSize: 7,
              color: "var(--pixel-muted)",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 2,
            }}
          >
            Budget spent
          </div>
          <div style={{ color: "var(--pixel-fg, #e0e0e0)" }}>
            ${usage.spentUsd.toFixed(4)} / ${usage.budgetUsd.toFixed(4)}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            fontSize: 7,
            color: "var(--pixel-muted)",
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          Budget risk
        </span>
        <span style={riskBadgeStyle(usage.riskLevel)}>{usage.riskLevel}</span>
      </div>
    </div>
  );
}

export default function UsagePanel({ agentId }: UsagePanelProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    const off1 = gameEvents.on("usage:tokens", refresh);
    const off2 = gameEvents.on("usage:context", refresh);
    const off3 = gameEvents.on("usage:budget", refresh);
    return () => {
      off1();
      off2();
      off3();
    };
  }, []);

  if (agentId) {
    const usage = usageTracker.getAgent(agentId);
    return (
      <HudFlyout title="Usage" subtitle={agentId}>
        {usage ? (
          <AgentDetail usage={usage} />
        ) : (
          <div style={{ fontSize: 8, color: "var(--pixel-muted)", padding: "8px 0" }}>
            No usage data for {agentId}
          </div>
        )}
      </HudFlyout>
    );
  }

  const entries = usageTracker.getAll();
  const totals = usageTracker.getTeamTotals();

  return (
    <HudFlyout
      title="Usage"
      subtitle={`${totals.agentCount} agent${totals.agentCount !== 1 ? "s" : ""} · $${totals.totalCostUsd.toFixed(4)}`}
    >
      <TeamOverview entries={entries} />
    </HudFlyout>
  );
}
