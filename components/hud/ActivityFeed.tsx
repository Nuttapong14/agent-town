"use client";

import { useEffect, useRef, useState } from "react";
import { gameEvents } from "@/lib/events";
import HudFlyout from "./HudFlyout";

type LogLevel = "info" | "warn" | "error";
type FilterMode = "all" | "errors" | "stalled";

interface LogEntry {
  id: number;
  agentId: string;
  level: LogLevel;
  msg: string;
  ts: number;
}

const LEVEL_COLOR: Record<LogLevel, string> = {
  info: "#4ade80",
  warn: "#facc15",
  error: "#f87171",
};

let entrySeq = 0;

function formatTs(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export default function ActivityFeed({ maxEntries = 200 }: { maxEntries?: number }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  pausedRef.current = paused;

  useEffect(() => {
    const unsub = gameEvents.on("agent:log", (agentId, level, msg, ts) => {
      setEntries((prev) => {
        const next = [...prev, { id: ++entrySeq, agentId, level, msg, ts }];
        return next.length > maxEntries ? next.slice(next.length - maxEntries) : next;
      });
    });
    return unsub;
  }, [maxEntries]);

  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, paused]);

  const visible = entries.filter((e) => {
    if (filter === "errors") return e.level === "error";
    if (filter === "stalled") return e.level === "warn";
    return true;
  });

  const filters: { label: string; value: FilterMode }[] = [
    { label: "All", value: "all" },
    { label: "Errors", value: "errors" },
    { label: "Stalled", value: "stalled" },
  ];

  return (
    <HudFlyout
      title="Activity Feed"
      subtitle={`${entries.length} entries`}
      headerAction={
        <div style={{ display: "flex", gap: 4 }}>
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              style={{
                fontSize: 7,
                padding: "3px 7px",
                border: "1px solid var(--pixel-border)",
                borderRadius: 3,
                background: filter === f.value ? "var(--pixel-accent)" : "rgba(0,0,0,0.3)",
                color: filter === f.value ? "#000" : "var(--pixel-muted)",
                cursor: "pointer",
                fontFamily: "inherit",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      }
    >
      <div
        ref={scrollRef}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        style={{
          overflowY: "auto",
          flex: 1,
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 9,
          lineHeight: "16px",
          padding: "4px 0",
        }}
      >
        {visible.length === 0 ? (
          <div className="hud-empty">No log entries yet.</div>
        ) : (
          visible.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: "flex",
                gap: 6,
                padding: "1px 8px",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
              }}
            >
              <span style={{ color: "var(--pixel-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
                {formatTs(entry.ts)}
              </span>
              <span
                style={{
                  color: LEVEL_COLOR[entry.level],
                  textTransform: "uppercase",
                  fontSize: 7,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  alignSelf: "center",
                }}
              >
                {entry.level}
              </span>
              <span style={{ color: "var(--pixel-accent)", whiteSpace: "nowrap", flexShrink: 0 }}>
                {entry.agentId}:
              </span>
              <span
                style={{
                  color: "var(--pixel-text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {entry.msg}
              </span>
            </div>
          ))
        )}
      </div>
      {paused && (
        <div
          style={{
            textAlign: "center",
            fontSize: 7,
            color: "var(--pixel-muted)",
            padding: "3px 0",
            borderTop: "1px solid var(--pixel-border)",
          }}
        >
          SCROLL PAUSED — move mouse away to resume
        </div>
      )}
    </HudFlyout>
  );
}
